/**
 * TDI - Traders Dynamic Index [Goldminds]
 *
 * RSI of the close; its SMA over "Band Length" +- 1.6185 standard deviations gives the upper / lower bands and their
 * middle; SMAs of the RSI over "Fast MA on RSI" and "Slow MA on RSI" are the fast and slow lines. Levels 20 / 80
 * (dashed) and 50 / 70 / 30 (dotted) with a background fill between 70 and 30. Divergences on the slow line: pivot
 * lows / highs (lookback left / right) are compared with the previous pivot (within the lookback range); regular
 * bullish (price lower low, slow line higher low), hidden bullish (price higher low, slow line lower low), regular
 * bearish (price higher high, slow line lower high) and hidden bearish (price lower high, slow line higher high) are
 * drawn at the pivot (lbR bars back) as a line from pivot to pivot and a label.
 * Alerts (alertcondition, `alerts` of the result): 'Regular Bullish', 'Hidden Bullish', 'Regular Bearish' and
 * 'Hidden Bearish', true on the bar that confirms the pivot; alert() calls (`alertCalls`, once per bar) on the same
 * bars: "Regular Bullish. Price <close>", "Hidden Bullish. Price <close>", ...
 *
 * Reference: "TDI - Traders Dynamic Index [Goldminds]" by thienlovv (TDI by Goldminds, modified by Jakub a Babo)
 */

import { taStep, str, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  createBarRun, fullResult, liveAlertStates, PivotStep, WindowSma, WindowStdev,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface TdiRsiInputs {
  /** RSI Period */
  rsiPeriod: number;
  /** Band Length */
  bandLength: number;
  /** Fast MA on RSI (Pine lengthrsipl) */
  fastMALength: number;
  /** Slow MA on RSI (Pine lengthtradesl) */
  slowMALength: number;
  /** Pivot Lookback Right */
  lbR: number;
  /** Pivot Lookback Left */
  lbL: number;
  /** Max of Lookback Range */
  rangeUpper: number;
  /** Min of Lookback Range */
  rangeLower: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
}

export const defaultInputs: TdiRsiInputs = {
  rsiPeriod: 21,
  bandLength: 34,
  fastMALength: 7,
  slowMALength: 2,
  lbR: 5,
  lbL: 5,
  rangeUpper: 60,
  rangeLower: 5,
  plotBull: true,
  plotHiddenBull: false,
  plotBear: true,
  plotHiddenBear: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 21, min: 1 },
  { id: 'bandLength', type: 'int', title: 'Band Length', defval: 34, min: 1 },
  { id: 'fastMALength', type: 'int', title: 'Fast MA on RSI', defval: 7, min: 0 },
  { id: 'slowMALength', type: 'int', title: 'Slow MA on RSI', defval: 2, min: 1 },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5 },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 5 },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60 },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 5 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
];

// Pine v4 colours
const WHITE = '#FFFFFF';
const YELLOW = '#FFEB3B';
const AQUA = '#00BCD4';
const RED = '#FF5252';
const GREEN = '#4CAF50';
const BLUE = '#2196F3';
const HIDDEN_BULL_COLOR = 'rgba(76, 175, 80, 0.2)'; // color.new(color.green, 80)
const HIDDEN_BEAR_COLOR = 'rgba(255, 82, 82, 0.2)'; // color.new(color.red, 80)
const NONE_COLOR = 'rgba(255, 255, 255, 0)'; // color.new(color.white, 100)
const HLINE_COLOR = '#787B86';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: WHITE, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: WHITE, lineWidth: 1 },
  { id: 'plot2', title: 'Middle of Bands', color: YELLOW, lineWidth: 1 },
  { id: 'plot3', title: 'Slow MA', color: AQUA, lineWidth: 2 },
  { id: 'plot4', title: 'Fast MA', color: RED, lineWidth: 1 },
  // the divergence plots are coloured per point (divergence colour or transparent); offset -lbR applied in the data
  { id: 'plot5', title: 'Regular Bullish', color: BLUE, lineWidth: 2 },
  { id: 'plot6', title: 'Hidden Bullish', color: BLUE, lineWidth: 2 },
  { id: 'plot7', title: 'Regular Bearish', color: BLUE, lineWidth: 2 },
  { id: 'plot8', title: 'Hidden Bearish', color: BLUE, lineWidth: 2 },
];

/** hline(20), hline(80) (dashed, title "Level"), hline(50 / 70 / 30, dotted) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_20', price: 20, title: 'Level', color: HLINE_COLOR, linestyle: 'dashed' },
  { id: 'hline_80', price: 80, title: 'Level', color: HLINE_COLOR, linestyle: 'dashed' },
  { id: 'hline_mid', price: 50, title: 'Middle Line', color: HLINE_COLOR, linestyle: 'dotted' },
  { id: 'hline_ob', price: 70, title: 'Overbought', color: HLINE_COLOR, linestyle: 'dotted' },
  { id: 'hline_os', price: 30, title: 'Oversold', color: HLINE_COLOR, linestyle: 'dotted' },
];

/** fill(obLevel, osLevel, title = "Background", color = #9915FF, transp = 98) */
const BACKGROUND_FILL = 'rgba(153, 21, 255, 0.02)';
export const fillConfig: FillConfig[] = [
  { id: 'fill_background', plot1: 'hline_ob', plot2: 'hline_os', color: BACKGROUND_FILL, title: 'Background' },
];

export const metadata = {
  title: 'TDI - Traders Dynamic Index [Goldminds]',
  shortTitle: 'TDIGM DIV Alerts',
  overlay: false,
};

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Regular Bullish', message: 'Long  @ {{close}}' },
  { id: 'alert1', title: 'Hidden Bullish', message: 'Long  @ {{close}}' },
  { id: 'alert2', title: 'Regular Bearish', message: 'Short  @ {{close}}' },
  { id: 'alert3', title: 'Hidden Bearish', message: 'Short  @ {{close}}' },
];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type PlotPoint = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[]; alertCalls: AlertCall[] };

interface TdiVars {
  /** _inRange(plFound[1]): barssince(plFound[1] == true) */
  plBars: number;
  phBars: number;
  /** valuewhen(plFound, osc[lbR], 1) / valuewhen(plFound, low[lbR], 1) on a pivot bar: the previous pivot's values */
  plLastOsc: number;
  plLastLow: number;
  phLastOsc: number;
  phLastHigh: number;
}

interface TdiRun extends BarRunState<TdiVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ma: WindowSma;
  sd: WindowStdev;
  fast: WindowSma;
  slow: WindowSma;
  pl: PivotStep;
  ph: PivotStep;
  osc: number[];
  plFound: boolean[];
  phFound: boolean[];
  lines: PlotPoint[][];
  regBull: PlotPoint[];
  hidBull: PlotPoint[];
  regBear: PlotPoint[];
  hidBear: PlotPoint[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<TdiRsiInputs>): BarStudy<TdiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lbR, lbL, rangeUpper, rangeLower } = cfg;
  const fastValid = Math.floor(cfg.fastMALength) > 0;
  return {
    init() {
      const s: TdiRun = {
        rsi: taStep.rsi(cfg.rsiPeriod),
        ma: new WindowSma(cfg.bandLength),
        sd: new WindowStdev(cfg.bandLength),
        fast: new WindowSma(cfg.fastMALength),
        slow: new WindowSma(cfg.slowMALength),
        pl: new PivotStep(lbL, lbR, false),
        ph: new PivotStep(lbL, lbR, true),
        osc: [], plFound: [], phFound: [],
        lines: Array.from({ length: 5 }, () => []),
        regBull: [], hidBull: [], regBear: [], hidBear: [],
        markers: [],
        flags: [[], [], [], []],
        times: [[], [], [], []],
        alertCalls: [],
        steps: [],
        vars: { plBars: NaN, phBars: NaN, plLastOsc: NaN, plLastLow: NaN, phLastOsc: NaN, phLastHigh: NaN },
        lists: [], series: [],
      };
      s.steps = [s.rsi, s.ma, s.sd, s.fast, s.slow, s.pl, s.ph];
      s.lists = [s.markers, s.alertCalls, ...s.times];
      s.series = [s.osc, s.plFound, s.phFound, ...s.lines, s.regBull, s.hidBull, s.regBear, s.hidBear, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const t = bars[i].time as number;
      const r = s.rsi.step(bars[i].close);
      const ma = s.ma.step(r);
      const sd = s.sd.step(r);
      const up = ma + 1.6185 * sd;
      const dn = ma - 1.6185 * sd;
      const mid = (up + dn) / 2;
      // a length of 0 (the input's minimum) is the error of ta.sma
      const fastMA = fastValid ? s.fast.step(r) : taStep.sma().step(r, cfg.fastMALength);
      const osc = s.slow.step(r);
      s.osc[i] = osc;
      const time = bars[i].time;
      s.lines[0]![i] = { time, value: up };
      s.lines[1]![i] = { time, value: dn };
      s.lines[2]![i] = { time, value: mid };
      s.lines[3]![i] = { time, value: osc };
      s.lines[4]![i] = { time, value: fastMA };

      // plFound / phFound: pivotlow / pivothigh(osc, lbL, lbR) found (on the confirmation bar, lbR bars after the pivot)
      const plFound = !isNaN(s.pl.step(i, osc));
      const phFound = !isNaN(s.ph.step(i, osc));
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;

      // the divergence plots: bar i sets its own point to na and the point of bar i - lbR (offset = -lbR), so a new
      // price of the forming bar writes both again
      s.regBull[i] = { time: t, value: NaN };
      s.hidBull[i] = { time: t, value: NaN };
      s.regBear[i] = { time: t, value: NaN };
      s.hidBear[i] = { time: t, value: NaN };
      const p = i - lbR;
      if (p >= 0 && p < i) {
        const pt = bars[p].time as number;
        s.regBull[p] = { time: pt, value: NaN };
        s.hidBull[p] = { time: pt, value: NaN };
        s.regBear[p] = { time: pt, value: NaN };
        s.hidBear[p] = { time: pt, value: NaN };
      }

      if (i > 0 && s.plFound[i - 1]) v.plBars = 0;
      else if (!isNaN(v.plBars)) v.plBars++;
      if (i > 0 && s.phFound[i - 1]) v.phBars = 0;
      else if (!isNaN(v.phBars)) v.phBars++;
      const plInRange = rangeLower <= v.plBars && v.plBars <= rangeUpper;
      const phInRange = rangeLower <= v.phBars && v.phBars <= rangeUpper;
      const closeStr = () => str.tostring(bars[i].close);

      let bullCond = false, hiddenBullCond = false, bearCond = false, hiddenBearCond = false;
      if (plFound) {
        const o = s.osc[p]!;
        const low = bars[p].low;
        bullCond = cfg.plotBull && lt(low, v.plLastLow) && gt(o, v.plLastOsc) && plInRange;
        hiddenBullCond = cfg.plotHiddenBull && gt(low, v.plLastLow) && lt(o, v.plLastOsc) && plInRange;
        // plot(plFound ? osc[lbR] : na, offset = -lbR, color = bullCond ? bullColor : noneColor) (same for hidden)
        s.regBull[p] = { time: bars[p].time as number, value: o, color: bullCond ? GREEN : NONE_COLOR };
        s.hidBull[p] = { time: bars[p].time as number, value: o, color: hiddenBullCond ? HIDDEN_BULL_COLOR : NONE_COLOR };
        if (bullCond && !isNaN(o)) {
          s.markers.push({ time: bars[p].time as number, id: 'shape0', position: 'atPriceBottom', price: o, shape: 'labelUp',
            color: GREEN, text: ' Bull ', textColor: WHITE });
        }
        if (hiddenBullCond && !isNaN(o)) {
          s.markers.push({ time: bars[p].time as number, id: 'shape1', position: 'atPriceBottom', price: o, shape: 'labelUp',
            color: GREEN, text: ' H Bull ', textColor: WHITE });
        }
        v.plLastOsc = o;
        v.plLastLow = low;
      }
      if (phFound) {
        const o = s.osc[p]!;
        const high = bars[p].high;
        bearCond = cfg.plotBear && gt(high, v.phLastHigh) && lt(o, v.phLastOsc) && phInRange;
        hiddenBearCond = cfg.plotHiddenBear && lt(high, v.phLastHigh) && gt(o, v.phLastOsc) && phInRange;
        s.regBear[p] = { time: bars[p].time as number, value: o, color: bearCond ? RED : NONE_COLOR };
        s.hidBear[p] = { time: bars[p].time as number, value: o, color: hiddenBearCond ? HIDDEN_BEAR_COLOR : NONE_COLOR };
        if (bearCond && !isNaN(o)) {
          s.markers.push({ time: bars[p].time as number, id: 'shape2', position: 'atPriceTop', price: o, shape: 'labelDown',
            color: RED, text: ' Bear ', textColor: WHITE });
        }
        if (hiddenBearCond && !isNaN(o)) {
          s.markers.push({ time: bars[p].time as number, id: 'shape3', position: 'atPriceTop', price: o, shape: 'labelDown',
            color: RED, text: ' H Bear ', textColor: WHITE });
        }
        v.phLastOsc = o;
        v.phLastHigh = high;
      }
      const f = s.flags;
      f[0]![i] = bullCond;
      f[1]![i] = hiddenBullCond;
      f[2]![i] = bearCond;
      f[3]![i] = hiddenBearCond;
      for (let k = 0; k < 4; k++) if (f[k]![i]) s.times[k]!.push(t);
      // if bullCond: alert("Regular Bullish. Price " + tostring(close)) (default frequency: once per bar), ...
      if (bullCond) s.alertCalls.push({ time: t, message: 'Regular Bullish. Price ' + closeStr(), freq: 'once_per_bar' });
      if (hiddenBullCond) s.alertCalls.push({ time: t, message: 'Hidden Bullish. Price ' + closeStr(), freq: 'once_per_bar' });
      if (bearCond) s.alertCalls.push({ time: t, message: 'Regular Bearish. Price ' + closeStr(), freq: 'once_per_bar' });
      if (hiddenBearCond) s.alertCalls.push({ time: t, message: 'Hidden Bearish. Price ' + closeStr(), freq: 'once_per_bar' });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.lines[0]!.slice(),
          plot1: s.lines[1]!.slice(),
          plot2: s.lines[2]!.slice(),
          plot3: s.lines[3]!.slice(),
          plot4: s.lines[4]!.slice(),
          plot5: s.regBull.slice(),
          plot6: s.hidBull.slice(),
          plot7: s.regBear.slice(),
          plot8: s.hidBear.slice(),
        },
        hlines: hlineConfig.map((h) => ({ id: h.id, value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
        fills: [{ plot1: 'hline_ob', plot2: 'hline_os', options: { title: 'Background', color: BACKGROUND_FILL } }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TdiRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TdiRsiInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[]; alertCalls: AlertCall[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const TdiRsi = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig, alertConditions, hasAlertFunction };
