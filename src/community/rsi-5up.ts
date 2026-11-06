/**
 * RSI - 5UP
 *
 * RSI from the RMA of the up and down changes of the source, with bands at 70 / 50 / 30, a background fill between
 * 70 and 30, and gradient fills above 70 (green) and below 30 (red). An optional smoothing moving average (SMA,
 * SMA + Bollinger Bands, EMA, RMA, WMA or VWMA) of the RSI, with Bollinger Bands for "SMA + Bollinger Bands".
 * Optional regular divergences: RSI pivots (5 / 5 bars) whose RSI and price disagree with the previous pivot,
 * 5 to 60 bars apart, drawn on the pivot bar with Bull / Bear labels.
 * Alerts (alertcondition, `alerts` of the result): 'Regular Bullish Divergence' / 'Regular Bearish Divergence', true
 * on the bar that confirms the divergence (5 bars after its pivot); only with "Calculate Divergence" on.
 *
 * Reference: "RSI - 5UP" by Marrulk
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Marrulk
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, WindowSma, WindowStdev, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type MaType = 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';

export interface Rsi5UpInputs {
  rsiLength: number;
  rsiSource: SourceType;
  /** Detect regular divergences */
  calculateDivergence: boolean;
  /** Smoothing type */
  maType: MaType;
  /** Smoothing length */
  maLength: number;
  /** Bollinger Bands standard deviation multiplier */
  bbMult: number;
}

export const defaultInputs: Rsi5UpInputs = {
  rsiLength: 14,
  rsiSource: 'close',
  calculateDivergence: false,
  maType: 'SMA',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1, group: 'RSI Settings' },
  { id: 'rsiSource', type: 'source', title: 'Source', defval: 'close', group: 'RSI Settings' },
  { id: 'calculateDivergence', type: 'bool', title: 'Calculate Divergence', defval: false, group: 'RSI Settings',
    display: 'data_window', tooltip: 'Calculating divergences is needed in order for divergence alerts to fire.' },
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA', group: 'Smoothing', display: 'data_window',
    options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'data_window' },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5, group: 'Smoothing',
    display: 'data_window', tooltip: "Only applies when 'SMA + Bollinger Bands' is selected. Determines the distance between the SMA and the bands." },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 1 },
  // midLinePlot = plot(50, color = na, display = display.none): bounds the gradient fills
  { id: 'plot1', title: 'Middle Line', color: 'transparent', lineWidth: 1, display: 'none' },
  // display = enableMA ? display.all : display.none (result.visibility.enableMA)
  { id: 'plot2', title: 'RSI-based MA', color: color.yellow, lineWidth: 1, visible: 'enableMA' },
  // display = isBB ? display.all : display.none (result.visibility.isBB)
  { id: 'plot3', title: 'Upper Bollinger Band', color: color.green, lineWidth: 1, visible: 'isBB' },
  { id: 'plot4', title: 'Lower Bollinger Band', color: color.green, lineWidth: 1, visible: 'isBB' },
  // offset = -5, display = display.pane
  { id: 'plot5', title: 'Regular Bullish', color: color.green, lineWidth: 2, display: 'pane' },
  { id: 'plot6', title: 'Regular Bearish', color: color.red, lineWidth: 2, display: 'pane' },
];

const UPPER_COLOR = 'rgb(255, 0, 0)';
const MIDDLE_COLOR = String(color.new('#ffffff', 50));
const LOWER_COLOR = 'rgb(0, 130, 6)';
const BAND_FILL = 'rgba(126, 87, 194, 0.1)'; // color.rgb(126, 87, 194, 90)

/** hline(70 / 50 / 30): Pine default dashed style */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 70, title: 'RSI Upper Band', color: UPPER_COLOR, linestyle: 'dashed' },
  { id: 'hline_mid', price: 50, title: 'RSI Middle Band', color: MIDDLE_COLOR, linestyle: 'dashed' },
  { id: 'hline_lower', price: 30, title: 'RSI Lower Band', color: LOWER_COLOR, linestyle: 'dashed' },
];

/** fill(rsiUpperBand, rsiLowerBand, color.rgb(126, 87, 194, 90)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'hline_upper', plot2: 'hline_lower', color: BAND_FILL, title: 'RSI Background Fill' },
];

export const metadata = {
  title: 'RSI - 5UP',
  shortTitle: 'RSI-5UP',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; visibility: Record<string, boolean> } & { alerts: AlertConditionState[] };

interface Rsi5UpVars {
  /** src[1] */
  prevSrc: number;
  /** ta.valuewhen(found, x, 1) histories: the last two values (older first) */
  plRsi: readonly number[];
  plLow: readonly number[];
  phRsi: readonly number[];
  phHigh: readonly number[];
  /** Calls of the ta.barssince in _inRange (Pine v6 `and` is lazy) */
  plCalls: number;
  phCalls: number;
}

type Step = { step(v: number, volume: number): number; commit(): void };

interface Rsi5UpRun extends BarRunState<Rsi5UpVars> {
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  ma: Step | null;
  dev: WindowStdev | null;
  pl: PivotStep;
  ph: PivotStep;
  rsi: number[];
  plFound: boolean[];
  phFound: boolean[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
  /** plot(..., offset = -lookbackRight): one point per bar from bar 5 on, at the time of the bar 5 bars back */
  plot5: Point[];
  plot6: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** ta.valuewhen(found, x, 1) history: the value added on a bar where the condition is true */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (na before two values) */
const second = (h: readonly number[]): number => (h.length >= 2 ? h[h.length - 2]! : NaN);

function study(inputs: Partial<Rsi5UpInputs>): BarStudy<Rsi5UpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.rsiSource);
  // Smoothing MA and Bollinger Bands
  const enableMA = cfg.maType !== 'None';
  const isBB = cfg.maType === 'SMA + Bollinger Bands';
  // Regular divergences
  const lbR = 5;
  const lbL = 5;
  const rangeUpper = 60;
  const rangeLower = 5;
  const noneColor = String(color.new(color.white, 100));
  const maStep = (): Step | null => {
    switch (cfg.maType) {
      case 'None': return null;
      case 'EMA': { const m = taStep.ema(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, cfg.maLength), commit: () => m.commit() }; }
      case 'VWMA': { const m = new WindowVwma(cfg.maLength); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = new WindowSma(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) ? null : 'source of another study'),
    init() {
      const s: Rsi5UpRun = {
        up: taStep.rma(cfg.rsiLength), down: taStep.rma(cfg.rsiLength), ma: maStep(),
        dev: isBB ? new WindowStdev(cfg.maLength) : null,
        pl: new PivotStep(lbL, lbR, false), ph: new PivotStep(lbL, lbR, true),
        rsi: [], plFound: [], phFound: [], plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], plot5: [], plot6: [],
        markers: [], flags: [[], []], times: [[], []],
        steps: [],
        vars: { prevSrc: NaN, plRsi: [], plLow: [], phRsi: [], phHigh: [], plCalls: NaN, phCalls: NaN },
        lists: [], series: [],
      };
      s.steps = [s.up, s.down, ...(s.ma ? [s.ma] : []), ...(s.dev ? [s.dev] : []), ...(cfg.calculateDivergence ? [s.pl, s.ph] : [])];
      s.lists = [s.plot5, s.plot6, s.markers, ...s.times];
      s.series = [s.rsi, s.plFound, s.phFound, s.plot0, s.plot1, s.plot2, s.plot3, s.plot4, ...s.flags];
      return s;
    },
    copyVars: (v) => ({ ...v }),
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      // change = ta.change(src); up = ta.rma(math.max(change, 0)); down = ta.rma(-math.min(change, 0))
      const src = value(b);
      const change = i > 0 ? src - v.prevSrc : NaN;
      v.prevSrc = src;
      const up = s.up.step(isNaN(change) ? NaN : Math.max(change, 0));
      const down = s.down.step(isNaN(change) ? NaN : -Math.min(change, 0));
      // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
      const rsi = eq(down, 0) ? 100 : eq(up, 0) ? 0 : 100 - 100 / (1 + up / down);
      s.rsi[i] = rsi;

      const ma = s.ma ? s.ma.step(rsi, b.volume ?? NaN) : NaN;
      const sd = s.dev ? s.dev.step(rsi) * cfg.bbMult : NaN;
      s.plot0[i] = { time, value: rsi, color: '#7E57C2' };
      s.plot1[i] = { time, value: 50 };
      s.plot2[i] = { time, value: ma, color: color.yellow };
      s.plot3[i] = { time, value: ma + sd, color: color.green };
      s.plot4[i] = { time, value: ma - sd, color: color.green };

      const r = i - lbR >= 0 ? s.rsi[i - lbR] : NaN;
      let plFound = false;
      let phFound = false;
      let bullCond = false;
      let bearCond = false;
      if (cfg.calculateDivergence) {
        const lowLbr = i - lbR >= 0 ? bars[i - lbR].low : NaN;
        const highLbr = i - lbR >= 0 ? bars[i - lbR].high : NaN;
        // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
        plFound = !isNaN(s.pl.step(i, rsi));
        if (plFound) {
          v.plRsi = pushed(v.plRsi, r);
          v.plLow = pushed(v.plLow, lowLbr);
        }
        let rsiHL = false;
        if (gt(r, second(v.plRsi))) {
          if (i > 0 && s.plFound[i - 1]) v.plCalls = 0;
          else if (!isNaN(v.plCalls)) v.plCalls++;
          rsiHL = rangeLower <= v.plCalls && v.plCalls <= rangeUpper;
        }
        bullCond = lt(lowLbr, second(v.plLow)) && rsiHL && plFound;

        phFound = !isNaN(s.ph.step(i, rsi));
        if (phFound) {
          v.phRsi = pushed(v.phRsi, r);
          v.phHigh = pushed(v.phHigh, highLbr);
        }
        let rsiLH = false;
        if (lt(r, second(v.phRsi))) {
          if (i > 0 && s.phFound[i - 1]) v.phCalls = 0;
          else if (!isNaN(v.phCalls)) v.phCalls++;
          rsiLH = rangeLower <= v.phCalls && v.phCalls <= rangeUpper;
        }
        bearCond = gt(highLbr, second(v.phHigh)) && rsiLH && phFound;
      }
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;
      s.flags[0][i] = bullCond;
      s.flags[1][i] = bearCond;
      if (bullCond) s.times[0].push(time as number);
      if (bearCond) s.times[1].push(time as number);

      if (i >= lbR) {
        // plot(..., offset = -lookbackRight): the value of bar i is drawn on bar i - 5
        const backTime = bars[i - lbR].time;
        s.plot5.push({ time: backTime, value: plFound ? r : NaN, color: bullCond ? color.green : noneColor });
        s.plot6.push({ time: backTime, value: phFound ? r : NaN, color: bearCond ? color.red : noneColor });
        // plotshape(bullCond ? rsiLBR : na, offset = -5, " Bull ", shape.labelup, location.absolute, green, textcolor white)
        if (!isNaN(r)) {
          if (bullCond) {
            s.markers.push({ time: backTime, position: 'atPriceBottom', price: r, shape: 'labelUp', color: color.green, text: ' Bull ',
              textColor: color.white });
          }
          if (bearCond) {
            s.markers.push({ time: backTime, position: 'atPriceTop', price: r, shape: 'labelDown', color: color.red, text: ' Bear ',
              textColor: color.white });
          }
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      const bbFill = String(color.new(color.green, 90));
      const constant = <T>(v: T) => new Array<T>(n).fill(v);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
          plot2: s.plot2.slice(),
          plot3: s.plot3.slice(),
          plot4: s.plot4.slice(),
          plot5: s.plot5.slice(),
          plot6: s.plot6.slice(),
        },
        hlines: [
          { value: 70, options: { title: 'RSI Upper Band', color: UPPER_COLOR, linestyle: 'dashed' } },
          { value: 50, options: { title: 'RSI Middle Band', color: MIDDLE_COLOR, linestyle: 'dashed' } },
          { value: 30, options: { title: 'RSI Lower Band', color: LOWER_COLOR, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'RSI Background Fill' }, colors: constant(BAND_FILL) },
          // fill(rsiPlot, midLinePlot, 100, 70, top_color = color.new(color.green, 0), bottom_color = color.new(color.green, 100))
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Overbought Gradient Fill' },
            gradient: { topValue: constant(100), bottomValue: constant(70),
              topColor: constant(String(color.new(color.green, 0))), bottomColor: constant(String(color.new(color.green, 100))) } },
          // fill(rsiPlot, midLinePlot, 30, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Oversold Gradient Fill' },
            gradient: { topValue: constant(30), bottomValue: constant(0),
              topColor: constant(String(color.new(color.red, 100))), bottomColor: constant(String(color.new(color.red, 0))) } },
          // fill(bbUpperBand, bbLowerBand, color = isBB ? color.new(color.green, 90) : na, display = isBB ? all : none)
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Bollinger Bands Background Fill' },
            colors: constant(isBB ? bbFill : 'transparent') },
        ],
        markers: s.markers.slice(),
        visibility: { enableMA, isBB },
        // alertcondition(bullCond, ...) / alertcondition(bearCond, ...): on the bar the condition is found
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Rsi5UpInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Rsi5UpInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0',
    title: 'Regular Bullish Divergence',
    message: 'Found a new Regular Bullish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar.',
  },
  {
    id: 'alert1',
    title: 'Regular Bearish Divergence',
    message: 'Found a new Regular Bearish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar.',
  },
];

export const Rsi5Up = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
