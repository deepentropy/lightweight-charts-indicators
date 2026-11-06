/**
 * MACD Divergences by @DaviddTech
 *
 * MACD with regular (and hidden) divergence detection on the MACD line.
 * Alerts (alertcondition, `alerts` of the result): 'Bull', 'Bear', 'H Bull' and 'H Bear', true on the bar that confirms
 * the pivot of each divergence (lbR bars after the pivot, where the label is drawn).
 *
 * Reference: "MACD Divergences by @DaviddTech" (community, Pine v4)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface MACDDivergenceInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  /** Pine sma_source: "Oscillator MA Type" */
  oscMaType: 'SMA' | 'EMA';
  /** Pine sma_signal: "Signal Line MA Type" */
  signalMaType: 'SMA' | 'EMA';
  /** Pine lbR: "Pivot Lookback Right" */
  pivotLookback: number;
  /** Pine lbL: "Pivot Lookback Left" */
  pivotLookbackLeft: number;
  rangeUpper: number;
  rangeLower: number;
  dontTouchZero: boolean;
  plotBull: boolean;
  plotBear: boolean;
  /** Pine constant plotHiddenBull = false (not an input in Pine) */
  plotHiddenBull: boolean;
  /** Pine constant plotHiddenBear = false (not an input in Pine) */
  plotHiddenBear: boolean;
  src: SourceType;
}

export const defaultInputs: MACDDivergenceInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  oscMaType: 'EMA',
  signalMaType: 'EMA',
  pivotLookback: 5,
  pivotLookbackLeft: 5,
  rangeUpper: 60,
  rangeLower: 5,
  dontTouchZero: true,
  plotBull: true,
  plotBear: true,
  plotHiddenBull: false,
  plotHiddenBear: false,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, max: 50 },
  { id: 'oscMaType', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'signalMaType', type: 'string', title: 'Signal Line MA Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'dontTouchZero', type: 'bool', title: "Don't touch the zero line?", defval: true },
  { id: 'pivotLookback', type: 'int', title: 'Pivot Lookback Right', defval: 5 },
  { id: 'pivotLookbackLeft', type: 'int', title: 'Pivot Lookback Left', defval: 5 },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60 },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 5 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
];

// Pine v4 colours: color.green #4CAF50, color.red #FF5252; hidden colours color.new(.., 80)
const BULL_COLOR = '#4CAF50';
const BEAR_COLOR = '#FF5252';
const HIDDEN_BULL_COLOR = 'rgba(76,175,80,0.20)';
const HIDDEN_BEAR_COLOR = 'rgba(255,82,82,0.20)';
// Pine noneColor = color.new(color.white, 100)
const NONE_COLOR = 'rgba(255,255,255,0)';
// Pine: textColor = color.white (text of the divergence labels, plotshape location.absolute at the plotted value)
const TEXT_COLOR = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'columns' },
  { id: 'regBull', title: 'Regular Bullish', color: BULL_COLOR, lineWidth: 2 },
  { id: 'regBear', title: 'Regular Bearish', color: BEAR_COLOR, lineWidth: 2 },
  { id: 'hidBull', title: 'Hidden Bullish', color: HIDDEN_BULL_COLOR, lineWidth: 2 },
  { id: 'hidBear', title: 'Hidden Bearish', color: HIDDEN_BEAR_COLOR, lineWidth: 2 },
];

export const metadata = {
  title: 'MACD Divergence',
  shortTitle: 'MACDDiv',
  overlay: false,
};

type PlotPoint = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface MacdDivVars {
  /** _inRange barssince of plFound[1] / phFound[1] */
  plBars: number;
  phBars: number;
  /** valuewhen(plFound, osc[lbR], 1) and valuewhen(plFound, low[lbR], 1): on a pivot bar, the previous pivot */
  plLastOsc: number;
  plLastLow: number;
  phLastOsc: number;
  phLastHigh: number;
}

interface MacdDivRun extends BarRunState<MacdDivVars> {
  fast: Ma;
  slow: Ma;
  sig: Ma;
  pl: PivotStep;
  ph: PivotStep;
  hh: WindowExtreme;
  ll: WindowExtreme;
  macdArr: number[];
  hist: number[];
  plFound: boolean[];
  phFound: boolean[];
  macdPlot: PlotPoint[];
  sigPlot: PlotPoint[];
  histPlot: PlotPoint[];
  regBullPlot: PlotPoint[];
  regBearPlot: PlotPoint[];
  hidBullPlot: PlotPoint[];
  hidBearPlot: PlotPoint[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MACDDivergenceInputs>): BarStudy<MacdDivRun, Result> {
  const { fastLength, slowLength, signalLength, oscMaType, signalMaType, pivotLookback, pivotLookbackLeft,
    rangeUpper, rangeLower, dontTouchZero, plotBull, plotBear, plotHiddenBull, plotHiddenBear, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const lbR = pivotLookback;
  const lbL = pivotLookbackLeft;
  const maStep = (type: 'SMA' | 'EMA', length: number): Ma => (type === 'SMA' ? new WindowSma(length) : taStep.ema(length));
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: MacdDivRun = {
        // Pine: fast_ma / slow_ma with sma_source, signal with sma_signal
        fast: maStep(oscMaType, fastLength), slow: maStep(oscMaType, slowLength), sig: maStep(signalMaType, signalLength),
        pl: new PivotStep(lbL, lbR, false), ph: new PivotStep(lbL, lbR, true),
        // Pine: priceHHZero = highest(osc, lbL+lbR+5), priceLLZero = lowest(osc, lbL+lbR+5)
        hh: new WindowExtreme(false, lbL + lbR + 5), ll: new WindowExtreme(true, lbL + lbR + 5),
        macdArr: [], hist: [], plFound: [], phFound: [], macdPlot: [], sigPlot: [], histPlot: [], regBullPlot: [],
        regBearPlot: [], hidBullPlot: [], hidBearPlot: [], markers: [],
        flags: [[], [], [], []], times: [[], [], [], []], // bull, bear, hidden bull, hidden bear
        steps: [],
        vars: { plBars: NaN, phBars: NaN, plLastOsc: NaN, plLastLow: NaN, phLastOsc: NaN, phLastHigh: NaN },
        lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.sig, s.pl, s.ph, s.hh, s.ll];
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.macdArr, s.hist, s.plFound, s.phFound, s.macdPlot, s.sigPlot, s.histPlot, s.regBullPlot, s.regBearPlot,
        s.hidBullPlot, s.hidBearPlot, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const t = b.time;
      const x = value(b);
      const macd = s.fast.step(x) - s.slow.step(x);
      const signal = s.sig.step(macd);
      const h = macd - signal;
      s.macdArr[i] = macd;
      s.hist[i] = h;
      s.macdPlot[i] = { time: t, value: macd };
      s.sigPlot[i] = { time: t, value: signal };

      // Pine: hist>=0 ? (hist[1] < hist ? col_grow_above : col_fall_above) : (hist[1] < hist ? col_grow_below : col_fall_below)
      const prev = i > 0 ? s.hist[i - 1] : NaN;
      const grow = prev < h;
      const color = h >= 0 ? (grow ? '#26A69A' : '#B2DFDB') : (grow ? '#FFCDD2' : '#FF5252');
      s.histPlot[i] = { time: t, value: h, color };

      // osc = macd. plFound / phFound are true on the confirmation bar, lbR bars after the pivot bar.
      const plFound = !Number.isNaN(s.pl.step(i, macd));
      const phFound = !Number.isNaN(s.ph.step(i, macd));
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;
      const hhZero = s.hh.step(macd);
      const llZero = s.ll.step(macd);

      // Pine plots every pivot (value osc[lbR], offset=-lbR) and hides it with noneColor when there is no divergence:
      // bar i sets its own point to na; the point of the pivot bar is written by its confirmation bar on every run
      const na: PlotPoint = { time: t, value: NaN };
      s.regBullPlot[i] = na;
      s.regBearPlot[i] = na;
      s.hidBullPlot[i] = na;
      s.hidBearPlot[i] = na;
      const p = i - lbR;
      if (p >= 0 && p < i) {
        const back: PlotPoint = { time: bars[p].time, value: NaN };
        s.regBullPlot[p] = back;
        s.regBearPlot[p] = back;
        s.hidBullPlot[p] = back;
        s.hidBearPlot[p] = back;
      }

      // Pine: _inRange(cond) => bars = barssince(cond == true); rangeLower <= bars and bars <= rangeUpper,
      // called with plFound[1] / phFound[1]. Pine v4 `and` evaluates both sides, so barssince runs on every bar.
      if (i > 0 && s.plFound[i - 1]) v.plBars = 0;
      else if (!Number.isNaN(v.plBars)) v.plBars++;
      if (i > 0 && s.phFound[i - 1]) v.phBars = 0;
      else if (!Number.isNaN(v.phBars)) v.phBars++;
      const plInRange = rangeLower <= v.plBars && v.plBars <= rangeUpper;
      const phInRange = rangeLower <= v.phBars && v.phBars <= rangeUpper;

      let bullCond = false;
      let hiddenBullCond = false;
      let bearCond = false;
      let hiddenBearCond = false;

      if (plFound) {
        const osc = s.macdArr[p];
        const low = bars[p].low;
        const oscHL = osc > v.plLastOsc && plInRange && osc < 0;
        const priceLL = low < v.plLastLow;
        const blowzero = dontTouchZero ? hhZero < 0 : true;
        bullCond = plotBull && priceLL && oscHL && blowzero;
        const oscLL = osc < v.plLastOsc && plInRange;
        const priceHL = low > v.plLastLow;
        hiddenBullCond = plotHiddenBull && priceHL && oscLL;

        s.regBullPlot[p] = { time: bars[p].time, value: osc, color: bullCond ? BULL_COLOR : NONE_COLOR };
        s.hidBullPlot[p] = { time: bars[p].time, value: osc, color: hiddenBullCond ? HIDDEN_BULL_COLOR : NONE_COLOR };
        // ids: plotshape outputs "Regular Bullish Label" (shape0) and "Hidden Bullish Label" (shape1)
        if (bullCond) s.markers.push({ time: bars[p].time as number, position: 'atPriceBottom', price: osc, shape: 'labelUp', color: BULL_COLOR, text: ' Bull ', textColor: TEXT_COLOR, id: 'shape0' });
        if (hiddenBullCond) s.markers.push({ time: bars[p].time as number, position: 'atPriceBottom', price: osc, shape: 'labelUp', color: BULL_COLOR, text: ' H Bull ', textColor: TEXT_COLOR, id: 'shape1' });

        v.plLastOsc = osc;
        v.plLastLow = low;
      }

      if (phFound) {
        const osc = s.macdArr[p];
        const high = bars[p].high;
        const oscLH = osc < v.phLastOsc && phInRange && osc > 0;
        const priceHH = high > v.phLastHigh;
        const bearzero = dontTouchZero ? llZero > 0 : true;
        bearCond = plotBear && priceHH && oscLH && bearzero;
        const oscHH = osc > v.phLastOsc && phInRange;
        const priceLH = high < v.phLastHigh;
        hiddenBearCond = plotHiddenBear && priceLH && oscHH;

        s.regBearPlot[p] = { time: bars[p].time, value: osc, color: bearCond ? BEAR_COLOR : NONE_COLOR };
        s.hidBearPlot[p] = { time: bars[p].time, value: osc, color: hiddenBearCond ? HIDDEN_BEAR_COLOR : NONE_COLOR };
        // ids: plotshape outputs "Regular Bearish Label" (shape2) and "Hidden Bearish Label" (shape3)
        if (bearCond) s.markers.push({ time: bars[p].time as number, position: 'atPriceTop', price: osc, shape: 'labelDown', color: BEAR_COLOR, text: ' Bear ', textColor: TEXT_COLOR, id: 'shape2' });
        if (hiddenBearCond) s.markers.push({ time: bars[p].time as number, position: 'atPriceTop', price: osc, shape: 'labelDown', color: BEAR_COLOR, text: ' H Bear ', textColor: TEXT_COLOR, id: 'shape3' });

        v.phLastOsc = osc;
        v.phLastHigh = high;
      }

      const flags = s.flags;
      flags[0][i] = bullCond;
      flags[1][i] = bearCond;
      flags[2][i] = hiddenBullCond;
      flags[3][i] = hiddenBearCond;
      if (bullCond) s.times[0].push(t as number);
      if (bearCond) s.times[1].push(t as number);
      if (hiddenBullCond) s.times[2].push(t as number);
      if (hiddenBearCond) s.times[3].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.macdPlot.slice(),
          'plot1': s.sigPlot.slice(),
          'plot2': s.histPlot.slice(),
          'regBull': s.regBullPlot.slice(),
          'regBear': s.regBearPlot.slice(),
          'hidBull': s.hidBullPlot.slice(),
          'hidBear': s.hidBearPlot.slice(),
        },
        markers: s.markers.slice(),
        // alertcondition(bullCond / bearCond / hiddenBullCond / hiddenBearCond)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACDDivergenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MACDDivergenceInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bull', message: 'Regular Bull Div {{ticker}} XXmin' },
  { id: 'alert1', title: 'Bear', message: 'Regular Bear Div {{ticker}} XXmin' },
  { id: 'alert2', title: 'H Bull', message: 'Hidden Bull Div {{ticker}} XXmin' },
  { id: 'alert3', title: 'H Bear', message: 'Hidden Bear Div {{ticker}} XXmin' },
];

export const MACDDivergence = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
