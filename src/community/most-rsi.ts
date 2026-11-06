/**
 * MOST on RSI
 *
 * OTT-style trailing stop applied to an RSI moving average instead of price.
 * Includes RSI, RSI-based MA, MOST line, regular divergence detection on the RSI,
 * OB/OS gradient fills, and Bollinger Bands when the MA type is "Bollinger Bands".
 *
 * Alerts (alertcondition, `alerts` of the result): 'BUY' / 'SELL' (the RSI MA crossing the MOST line) and 'Regular
 * Bullish Divergence' / 'Regular Bearish Divergence' (on the bar the divergence is found, whether or not divergences
 * are shown).
 *
 * Reference: "MOST on RSI" (community, Pine v5)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type MOSTRSIMaType = 'SMA' | 'Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA' | 'VAR';

export interface MOSTRSIInputs {
  rsiLen: number;
  /** Pine rsiSourceInput: "Source" */
  src: SourceType;
  /** Pine maTypeInput: "MA Type" */
  maType: MOSTRSIMaType;
  maLen: number;
  percent: number;
  bbMult: number;
  showDivergence: boolean;
  showSignals: boolean;
}

export const defaultInputs: MOSTRSIInputs = {
  rsiLen: 14,
  src: 'close',
  maType: 'VAR',
  maLen: 5,
  percent: 9.0,
  bbMult: 2.0,
  showDivergence: true,
  showSignals: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'VAR', options: ['SMA', 'Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA', 'VAR'] },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 5 },
  { id: 'percent', type: 'float', title: 'STOP LOSS Percent', defval: 9.0, min: 0, step: 0.1 },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50 },
  { id: 'showDivergence', type: 'bool', title: 'Show Divergence', defval: true },
  { id: 'showSignals', type: 'bool', title: 'Show Signals?', defval: false },
];

// Pine v5 colours: color.green #4CAF50, color.red #FF5252, color.maroon #880E4F, color.yellow #FFEB3B
const BULL_COLOR = '#4CAF50';
const BEAR_COLOR = '#FF5252';
// Pine noneColor = color.new(color.white, 100)
const NONE_COLOR = 'rgba(255,255,255,0)';
// Pine: textColor = color.white (text of the divergence labels, plotshape location.absolute at the plotted value)
const TEXT_COLOR = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'rsi', title: 'RSI', color: '#7E57C2', lineWidth: 1 },
  { id: 'rsiMa', title: 'RSI-based MA', color: '#FFEB3B', lineWidth: 1 },
  { id: 'most', title: 'MOST', color: '#880E4F', lineWidth: 3 },
  { id: 'bullDiv', title: 'Regular Bullish', color: BULL_COLOR, lineWidth: 2 },
  { id: 'bearDiv', title: 'Regular Bearish', color: BEAR_COLOR, lineWidth: 2 },
  { id: 'midline', title: 'Middle Line', color: 'transparent', lineWidth: 0, display: 'none' },
  { id: 'bbUpper', title: 'Upper Bollinger Band', color: '#4CAF50', lineWidth: 1 },
  { id: 'bbLower', title: 'Lower Bollinger Band', color: '#4CAF50', lineWidth: 1 },
  { id: 'hline70', title: 'RSI Upper Band', color: '#787B86', lineWidth: 1, display: 'none' },
  { id: 'hline30', title: 'RSI Lower Band', color: '#787B86', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'MOST on RSI',
  shortTitle: 'MOST-RSI',
  overlay: false,
};

type PlotPoint = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface MostVars {
  /** Calls of the ta.barssince(plFound[1] / phFound[1]) of _inRange */
  plBars: number;
  phBars: number;
  /** ta.valuewhen(plFound, rsi[lookbackRight], 1): on a pivot bar, the previous pivot */
  lastPLRsi: number;
  lastPLPrice: number;
  lastPHRsi: number;
  lastPHPrice: number;
}

interface MostRun extends BarRunState<MostVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ma: { step(v: number, volume: number): number; commit(): void } | null;
  dev: WindowStdev | null;
  pl: PivotStep;
  ph: PivotStep;
  rsiArr: number[];
  plFound: boolean[];
  phFound: boolean[];
  rsiMa: number[];
  vud1: number[];
  vdd1: number[];
  longStop: number[];
  shortStop: number[];
  dir: number[];
  most: number[];
  rsiPlot: PlotPoint[];
  rsiMaPlot: PlotPoint[];
  mostPlot: PlotPoint[];
  bullDivPlot: PlotPoint[];
  bearDivPlot: PlotPoint[];
  midlinePlot: PlotPoint[];
  bbUpperPlot: PlotPoint[];
  bbLowerPlot: PlotPoint[];
  hline70Plot: PlotPoint[];
  hline30Plot: PlotPoint[];
  /** BUY / SELL labels (all before the divergence labels, as the original's plotshape order) */
  signalMarkers: MarkerData[];
  divMarkers: MarkerData[];
  /** cro, cru, bullCondAlert, bearCondAlert per bar and their bar times */
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MOSTRSIInputs>): BarStudy<MostRun, Result> {
  const { rsiLen, src, maType, maLen, percent, bbMult, showDivergence, showSignals } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const isBB = maType === 'Bollinger Bands';
  // Pine Var_Func(source, length): VAR (variable index dynamic average) with a 9-bar CMO
  const valpha = 2 / (maLen + 1);
  // Divergence (Pine constants: lookbackLeft=5, lookbackRight=5, rangeUpper=60, rangeLower=5)
  const lookbackLeft = 5;
  const lookbackRight = 5;
  const rangeUpper = 60;
  const rangeLower = 5;
  // Pine: rsiMA = ma(rsi, maLengthInput, maTypeInput)
  const maStep = (): MostRun['ma'] => {
    switch (maType) {
      case 'SMA':
      case 'Bollinger Bands': { const m = new WindowSma(maLen); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'EMA': { const m = taStep.ema(maLen); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(maLen); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, maLen), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(maLen); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: return null;
    }
  };
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: MostRun = {
        rsi: taStep.rsi(rsiLen), ma: maStep(), dev: isBB ? new WindowStdev(maLen) : null,
        pl: new PivotStep(lookbackLeft, lookbackRight, false), ph: new PivotStep(lookbackLeft, lookbackRight, true),
        rsiArr: [], plFound: [], phFound: [], rsiMa: [], vud1: [], vdd1: [], longStop: [], shortStop: [], dir: [], most: [],
        rsiPlot: [], rsiMaPlot: [], mostPlot: [], bullDivPlot: [], bearDivPlot: [], midlinePlot: [], bbUpperPlot: [],
        bbLowerPlot: [], hline70Plot: [], hline30Plot: [], signalMarkers: [], divMarkers: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [],
        vars: { plBars: NaN, phBars: NaN, lastPLRsi: NaN, lastPLPrice: NaN, lastPHRsi: NaN, lastPHPrice: NaN },
        lists: [], series: [],
      };
      s.steps = [s.rsi, ...(s.ma ? [s.ma] : []), ...(s.dev ? [s.dev] : []), s.pl, s.ph];
      s.lists = [s.signalMarkers, s.divMarkers, ...s.times];
      s.series = [
        s.rsiArr, s.plFound, s.phFound, s.rsiMa, s.vud1, s.vdd1, s.longStop, s.shortStop, s.dir, s.most, s.rsiPlot, s.rsiMaPlot, s.mostPlot,
        s.bullDivPlot, s.bearDivPlot, s.midlinePlot, s.bbUpperPlot, s.bbLowerPlot, s.hline70Plot, s.hline30Plot,
        ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const rsi = s.rsi.step(value(b));
      s.rsiArr[i] = rsi;

      let val: number;
      if (s.ma) {
        val = s.ma.step(rsi, b.volume ?? NaN);
      } else {
        // VAR: vud1/vdd1 are 0 where source or source[1] is na; math.sum(.., 9) is na on the first 8 bars;
        // vCMO = nz(..); VAR := nz(valpha * abs(vCMO) * source) + (1 - valpha * abs(vCMO)) * nz(VAR[1]): starts at 0
        const prev = i > 0 ? s.rsiArr[i - 1] : NaN;
        s.vud1[i] = rsi > prev ? rsi - prev : 0;
        s.vdd1[i] = rsi < prev ? prev - rsi : 0;
        let vCMO = 0;
        if (i >= 8) {
          let vUD = 0, vDD = 0;
          for (let j = i - 8; j <= i; j++) { vUD += s.vud1[j]; vDD += s.vdd1[j]; }
          const c = (vUD - vDD) / (vUD + vDD);
          vCMO = Number.isNaN(c) ? 0 : c;
        }
        const k = valpha * Math.abs(vCMO);
        const a = k * rsi;
        const prevVar = i > 0 ? s.rsiMa[i - 1] : NaN;
        val = (Number.isNaN(a) ? 0 : a) + (1 - k) * (Number.isNaN(prevVar) ? 0 : prevVar);
      }
      s.rsiMa[i] = val;

      // MOST (OTT-style trailing stop) on the RSI MA
      const fark = val * percent * 0.01;
      let longStop = val - fark;
      let shortStop = val + fark;
      let dir: number;
      if (i > 0) {
        const pl = s.longStop[i - 1];
        const ps = s.shortStop[i - 1];
        if (val > pl) longStop = Math.max(longStop, pl);
        if (val < ps) shortStop = Math.min(shortStop, ps);
        const pd = s.dir[i - 1];
        dir = pd;
        if (pd === -1 && val > ps) dir = 1;
        else if (pd === 1 && val < pl) dir = -1;
      } else {
        dir = 1;
      }
      s.longStop[i] = longStop;
      s.shortStop[i] = shortStop;
      s.dir[i] = dir;
      const most = dir === 1 ? longStop : shortStop;
      s.most[i] = most;

      // Pine: plot(rsi, "RSI", color=#7E57C2), plot(rsiMA, "RSI-based MA", color=color.yellow),
      // plot(MOST, color=color.new(color.maroon, 0), linewidth=3, title='MOST')
      s.rsiPlot[i] = { time, value: rsi };
      s.rsiMaPlot[i] = { time, value: val };
      s.mostPlot[i] = { time, value: most };
      s.midlinePlot[i] = { time, value: 50 };
      // Pine: bbUpperBand = plot(isBB ? rsiMA + ta.stdev(rsi, maLengthInput) * bbMultInput : na)
      const sd = s.dev ? s.dev.step(rsi) : NaN;
      s.bbUpperPlot[i] = { time, value: isBB ? val + sd * bbMult : NaN };
      s.bbLowerPlot[i] = { time, value: isBB ? val - sd * bbMult : NaN };
      // Constant hline plots for 70/30 fill
      s.hline70Plot[i] = { time, value: 70 };
      s.hline30Plot[i] = { time, value: 30 };

      // BUY/SELL markers. Pine: cro = ta.crossover(exMov, MOST), cru = ta.crossunder(exMov, MOST);
      // plotshape(..., location.bottom / location.top, shape.labelup / labeldown, size.tiny, color #0F18BF,
      // textcolor white). MarkerData has no pane top / bottom position: below / above the bar.
      let cro = false;
      let cru = false;
      if (i >= 1) {
        cro = val > most && s.rsiMa[i - 1] <= s.most[i - 1];
        cru = val < most && s.rsiMa[i - 1] >= s.most[i - 1];
        if (showSignals && cro) {
          s.signalMarkers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#0F18BF', text: 'BUY', textColor: '#FFFFFF', size: 'tiny' });
        }
        if (showSignals && cru) {
          s.signalMarkers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#0F18BF', text: 'SELL', textColor: '#FFFFFF', size: 'tiny' });
        }
      }

      // plFound / phFound are true on the confirmation bar, lookbackRight bars after the pivot bar
      const plFound = !Number.isNaN(s.pl.step(i, rsi));
      const phFound = !Number.isNaN(s.ph.step(i, rsi));
      // Pine plots every pivot (value rsi[lookbackRight], offset=-lookbackRight) and hides it with noneColor when
      // there is no divergence (or showDivergence is off): bar i sets its own point to na and the point of bar
      // i - lookbackRight (it is the only bar that writes it)
      s.bullDivPlot[i] = { time, value: NaN };
      s.bearDivPlot[i] = { time, value: NaN };
      const p = i - lookbackRight;
      if (p >= 0) {
        s.bullDivPlot[p] = { time: bars[p].time, value: NaN };
        s.bearDivPlot[p] = { time: bars[p].time, value: NaN };
      }

      // Pine: _inRange(cond) => bars = ta.barssince(cond == true); rangeLower <= bars and bars <= rangeUpper,
      // called with plFound[1] / phFound[1]. Pine v5 `and` evaluates both sides, so barssince runs on every bar.
      if (i > 0 && s.plFound[i - 1]) v.plBars = 0;
      else if (!Number.isNaN(v.plBars)) v.plBars++;
      if (i > 0 && s.phFound[i - 1]) v.phBars = 0;
      else if (!Number.isNaN(v.phBars)) v.phBars++;
      const plInRange = rangeLower <= v.plBars && v.plBars <= rangeUpper;
      const phInRange = rangeLower <= v.phBars && v.phBars <= rangeUpper;

      let bullAlert = false;
      let bearAlert = false;
      if (plFound) {
        const pivotRsi = s.rsiArr[p];
        const pivotPrice = bars[p].low;
        // Regular Bullish: RSI higher low, price lower low
        bullAlert = pivotPrice < v.lastPLPrice && pivotRsi > v.lastPLRsi && plInRange;
        const bullCond = showDivergence && bullAlert;
        s.bullDivPlot[p] = { time: bars[p].time, value: pivotRsi, color: bullCond ? BULL_COLOR : NONE_COLOR };
        if (bullCond) s.divMarkers.push({ time: bars[p].time, position: 'atPriceBottom', price: pivotRsi, shape: 'labelUp', color: BULL_COLOR, text: ' Bull ', textColor: TEXT_COLOR });
        v.lastPLRsi = pivotRsi;
        v.lastPLPrice = pivotPrice;
      }
      if (phFound) {
        const pivotRsi = s.rsiArr[p];
        const pivotPrice = bars[p].high;
        // Regular Bearish: RSI lower high, price higher high
        bearAlert = pivotPrice > v.lastPHPrice && pivotRsi < v.lastPHRsi && phInRange;
        const bearCond = showDivergence && bearAlert;
        s.bearDivPlot[p] = { time: bars[p].time, value: pivotRsi, color: bearCond ? BEAR_COLOR : NONE_COLOR };
        if (bearCond) s.divMarkers.push({ time: bars[p].time, position: 'atPriceTop', price: pivotRsi, shape: 'labelDown', color: BEAR_COLOR, text: ' Bear ', textColor: TEXT_COLOR });
        v.lastPHRsi = pivotRsi;
        v.lastPHPrice = pivotPrice;
      }
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;

      // alertcondition(cro, 'BUY') / (cru, 'SELL') / (bullCondAlert, ...) / (bearCondAlert, ...)
      const flags = [cro, cru, bullAlert, bearAlert];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      // Pine (v5 colours): midLinePlot = plot(50, display = display.none)
      //   fill(rsiPlot, midLinePlot, 100, 70, top_color = color.new(color.green, 0), bottom_color = color.new(color.green, 100))
      //   fill(rsiPlot, midLinePlot, 30, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
      const constant = <T>(c: T): T[] => new Array(n).fill(c);
      const fills: FillData[] = [
        // Pine: fill(rsiUpperBand, rsiLowerBand, color=color.rgb(126,87,194,90)) - purple fill between 70/30
        { plot1: 'hline70', plot2: 'hline30', options: { color: 'rgba(126,87,194,0.10)', title: 'RSI Background Fill' } },
        {
          plot1: 'rsi', plot2: 'midline', options: { title: 'Overbought Gradient Fill' },
          gradient: { topValue: constant(100), bottomValue: constant(70), topColor: constant('#4CAF50'), bottomColor: constant('#4CAF5000') },
        },
        {
          plot1: 'rsi', plot2: 'midline', options: { title: 'Oversold Gradient Fill' },
          gradient: { topValue: constant(30), bottomValue: constant(0), topColor: constant('#FF525200'), bottomColor: constant('#FF5252') },
        },
        // Pine: fill(bbUpperBand, bbLowerBand, color= isBB ? color.new(color.green, 90) : na)
        { plot1: 'bbUpper', plot2: 'bbLower', options: { color: 'rgba(76,175,80,0.10)', title: 'Bollinger Bands Background Fill' } },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'rsi': s.rsiPlot.slice(),
          'rsiMa': s.rsiMaPlot.slice(),
          'most': s.mostPlot.slice(),
          'bullDiv': s.bullDivPlot.slice(),
          'bearDiv': s.bearDivPlot.slice(),
          'midline': s.midlinePlot.slice(),
          'bbUpper': s.bbUpperPlot.slice(),
          'bbLower': s.bbLowerPlot.slice(),
          'hline70': s.hline70Plot.slice(),
          'hline30': s.hline30Plot.slice(),
        },
        hlines: [
          { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'RSI Upper Band' } },
          { value: 50, options: { color: 'rgba(120,123,134,0.5)', linestyle: 'dashed' as const, title: 'RSI Middle Band' } },
          { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'RSI Lower Band' } },
        ],
        fills,
        markers: [...s.signalMarkers, ...s.divMarkers],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MOSTRSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MOSTRSIInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY', message: 'BUY SIGNAL!' },
  { id: 'alert1', title: 'SELL', message: 'SELL SIGNAL!' },
  { id: 'alert2', title: 'Regular Bullish Divergence', message: 'Found a new Regular Bullish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar.' },
  { id: 'alert3', title: 'Regular Bearish Divergence', message: 'Found a new Regular Bearish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar.' },
];

export const MOSTRSI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
