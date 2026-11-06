/**
 * QuantumTrend SwiftEdge
 *
 * A Supertrend on hlc3 (ATR, or SMA of the true range, times a multiplier), Keltner Channels (EMA of the close
 * +/- ATR * multiplier) and a trend EMA. The sensitivity (1..5) sets all lengths and multipliers unless the manual
 * settings are used. The Supertrend line is drawn only when the close is within ATR * factor of it. Buy: the
 * Supertrend turns up, the close crosses over the upper Keltner band and is above the EMA; Sell is the mirror.
 * The lines and fills take a red-to-green colour from a 5-bar EMA of the trend (-1 / 1); the EMA is green in an
 * up trend and red in a down trend.
 * Alerts (alertcondition, `alerts` of the result): 'QuantumTrend SwiftEdge Buy' / 'QuantumTrend SwiftEdge Sell' (the
 * signals, also with the signals hidden) and 'Trend Change' (the Supertrend direction changes).
 *
 * Reference: "QuantumTrend SwiftEdge" by SwiftEdge
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'QuantumTrend SwiftEdge Buy', message: 'QuantumTrend SwiftEdge Buy Signal!' },
  { id: 'alert1', title: 'QuantumTrend SwiftEdge Sell', message: 'QuantumTrend SwiftEdge Sell Signal!' },
  { id: 'alert2', title: 'Trend Change', message: 'QuantumTrend SwiftEdge Trend Change!' },
];

export interface QuantumTrendSwiftEdgeInputs {
  /** Use the manual settings instead of the sensitivity */
  useManualSettings: boolean;
  /** Signal sensitivity (1 = low, 5 = high) */
  sensitivity: number;
  /** ATR (RMA of the true range) when true, SMA of the true range when false */
  changeATR: boolean;
  showSignals: boolean;
  /** Highlight fill between OHLC4 and the visible Supertrend line */
  highlighting: boolean;
  manualAtrPeriod: number;
  manualMultiplier: number;
  manualKcLength: number;
  manualKcMultiplier: number;
  manualKcAtrLength: number;
  manualEmaLength: number;
}

export const defaultInputs: QuantumTrendSwiftEdgeInputs = {
  useManualSettings: false,
  sensitivity: 3,
  changeATR: true,
  showSignals: true,
  highlighting: true,
  manualAtrPeriod: 10,
  manualMultiplier: 3.0,
  manualKcLength: 20,
  manualKcMultiplier: 1.5,
  manualKcAtrLength: 10,
  manualEmaLength: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'useManualSettings', type: 'bool', title: 'Use Manual Settings? (If unchecked, uses Sensitivity)', defval: false },
  { id: 'sensitivity', type: 'int', title: 'Signal Sensitivity (1=Low, 5=High)', defval: 3, min: 1, max: 5, step: 1 },
  { id: 'changeATR', type: 'bool', title: 'Change ATR Calculation Method?', defval: true },
  { id: 'showSignals', type: 'bool', title: 'Show Buy/Sell Signals?', defval: true },
  { id: 'highlighting', type: 'bool', title: 'Highlighter On/Off?', defval: true },
  { id: 'manualAtrPeriod', type: 'int', title: 'ATR Period (Manual)', defval: 10, min: 1 },
  { id: 'manualMultiplier', type: 'float', title: 'ATR Multiplier (Manual)', defval: 3.0, min: 0.1, step: 0.1 },
  { id: 'manualKcLength', type: 'int', title: 'Keltner Channel Length (Manual)', defval: 20, min: 1 },
  { id: 'manualKcMultiplier', type: 'float', title: 'Keltner Channel Multiplier (Manual)', defval: 1.5, min: 0.1, step: 0.1 },
  { id: 'manualKcAtrLength', type: 'int', title: 'Keltner ATR Length (Manual)', defval: 10, min: 1 },
  { id: 'manualEmaLength', type: 'int', title: 'EMA Length (Manual)', defval: 100, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: '#00FF00', lineWidth: 2 },
  { id: 'plot1', title: 'Down Trend', color: '#FF0000', lineWidth: 2 },
  { id: 'plot2', title: 'Keltner Upper', color: '#00FF00', lineWidth: 1 },
  { id: 'plot3', title: 'Keltner Lower', color: '#00FF00', lineWidth: 1 },
  { id: 'plot4', title: '100 EMA', color: color.green, lineWidth: 2 },
  { id: 'plot5', title: 'OHLC4', color: 'transparent', lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'QuantumTrend SwiftEdge',
  shortTitle: 'QuantumTrend SwiftEdge',
  overlay: true,
  precision: 2,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** Value of the sensitivity 1..5 (Pine: sensitivity == 1 ? a : ... == 4 ? d : e) */
const bySens = (s: number, v: [number, number, number, number, number]) =>
  s === 1 ? v[0] : s === 2 ? v[1] : s === 3 ? v[2] : s === 4 ? v[3] : v[4];

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface QtVars {
  /** var int trend = 1 */
  trend: number;
}

interface QtRun extends BarRunState<QtVars> {
  atr: { step(h: number, l: number, c: number): number; commit(): void };
  emaKC: Ma;
  kcAtr: ReturnType<typeof taStep.atr>;
  ema100: Ma;
  trendSmooth: Ma;
  up: number[];
  dn: number[];
  trendArr: number[];
  kcUpper: number[];
  kcLower: number[];
  plots: Point[][];
  kcFill: string[];
  upFill: string[];
  dnFill: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<QuantumTrendSwiftEdgeInputs>): BarStudy<QtRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const sens = cfg.sensitivity;
  const manual = cfg.useManualSettings;

  const atrPeriod = manual ? cfg.manualAtrPeriod : bySens(sens, [14, 12, 10, 8, 6]);
  const multiplier = manual ? cfg.manualMultiplier : bySens(sens, [4.0, 3.5, 3.0, 2.5, 2.0]);
  const kcLength = manual ? cfg.manualKcLength : bySens(sens, [30, 25, 20, 15, 10]);
  const kcMultiplier = manual ? cfg.manualKcMultiplier : bySens(sens, [2.0, 1.75, 1.5, 1.25, 1.0]);
  const kcAtrLength = manual ? cfg.manualKcAtrLength : bySens(sens, [14, 12, 10, 8, 6]);
  const emaLength = manual ? cfg.manualEmaLength : bySens(sens, [150, 125, 100, 75, 50]);
  const thresholdFactor = bySens(sens, [2.0, 1.5, 1.0, 0.75, 0.5]);
  const noFill = String(color.new(color.white, 100));

  return {
    init() {
      // Supertrend: src = hlc3; atr = changeATR ? ta.atr(atrPeriod) : ta.sma(ta.tr, atrPeriod)
      let atr: QtRun['atr'];
      if (cfg.changeATR) atr = taStep.atr(atrPeriod);
      else {
        const tr = taStep.tr();
        const sma = new WindowSma(atrPeriod);
        atr = { step: (h, l, c) => sma.step(tr.step(h, l, c)), commit: () => { tr.commit(); sma.commit(); } };
      }
      const s: QtRun = {
        atr,
        // Keltner Channels and EMA
        emaKC: taStep.ema(kcLength),
        kcAtr: taStep.atr(kcAtrLength),
        ema100: taStep.ema(emaLength),
        // Gradient colour from ta.ema(trend, 5)
        trendSmooth: taStep.ema(5),
        up: [], dn: [], trendArr: [], kcUpper: [], kcLower: [],
        plots: [[], [], [], [], [], []], kcFill: [], upFill: [], dnFill: [],
        markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: { trend: 1 }, lists: [], series: [],
      };
      s.steps = [s.atr, s.emaKC, s.kcAtr, s.ema100, s.trendSmooth];
      s.lists = [s.markers, ...s.times];
      s.series = [s.up, s.dn, s.trendArr, s.kcUpper, s.kcLower, ...s.plots, s.kcFill, s.upFill, s.dnFill, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time;
      const close = b.close;
      const atr = s.atr.step(b.high, b.low, close);
      const src = (b.high + b.low + b.close) / 3;
      let u = src - multiplier * atr;
      const up1 = i > 0 && !isNaN(s.up[i - 1]!) ? s.up[i - 1]! : u; // nz(up[1], up)
      const c1 = i > 0 ? bars[i - 1]!.close : NaN;
      u = gt(c1, up1) ? Math.max(u, up1) : u;
      let d = src + multiplier * atr;
      const dn1 = i > 0 && !isNaN(s.dn[i - 1]!) ? s.dn[i - 1]! : d; // nz(dn[1], dn)
      d = lt(c1, dn1) ? Math.min(d, dn1) : d;
      s.up[i] = u;
      s.dn[i] = d;
      // trend := nz(trend[1], trend); trend := trend == -1 and close > dn1 ? 1 : trend == 1 and close < up1 ? -1 : trend
      const prevTrend = s.vars.trend;
      const trend = prevTrend === -1 && gt(close, dn1) ? 1 : prevTrend === 1 && lt(close, up1) ? -1 : prevTrend;
      s.vars.trend = trend;
      s.trendArr[i] = trend;

      const emaKC = s.emaKC.step(close);
      const kcAtr = s.kcAtr.step(b.high, b.low, close);
      const kcUpper = emaKC + kcMultiplier * kcAtr;
      const kcLower = emaKC - kcMultiplier * kcAtr;
      s.kcUpper[i] = kcUpper;
      s.kcLower[i] = kcLower;
      const ema100 = s.ema100.step(close);

      // (trendSmooth + 1) / 2 from red (0) to green (1)
      const ts = s.trendSmooth.step(trend);
      const f = (ts + 1) / 2;
      const gradientColor = String(color.rgb(Math.round(255 + f * (0 - 255)), Math.round(0 + f * (255 - 0)), Math.round(0 + f * (0 - 0))));

      const threshold = atr * thresholdFactor;
      const distanceUp = close - u;
      const distanceDown = d - close;
      const showUp = trend === 1 && ge(distanceUp, 0) && le(distanceUp, threshold);
      const showDn = trend === -1 && ge(distanceDown, 0) && le(distanceDown, threshold);

      // ta.crossover(a, b): a > b and a[1] <= b[1] (exact comparisons: no 1e-10 tolerance, unlike the operators)
      const prev = i > 0 ? s.trendArr[i - 1]! : NaN;
      const pc = c1;
      const crossUp = i > 0 && close > kcUpper && pc <= s.kcUpper[i - 1]!;
      const crossDn = i > 0 && kcLower > close && s.kcLower[i - 1]! <= pc;
      const buySignal = gt(close, ema100) && crossUp && trend === 1 && prev === -1;
      const sellSignal = lt(close, ema100) && crossDn && trend === -1 && prev === 1;
      // plotshape(buySignal and showSignals ? up : na, location.absolute, shape.labelup, color.green, size.tiny, "Buy")
      if (buySignal && cfg.showSignals && !isNaN(u)) {
        s.markers.push({ time, position: 'atPriceBottom', price: u, shape: 'labelUp', color: color.green,
          size: 'tiny', text: 'Buy', textColor: color.white });
      }
      if (sellSignal && cfg.showSignals && !isNaN(d)) {
        s.markers.push({ time, position: 'atPriceTop', price: d, shape: 'labelDown', color: color.red,
          size: 'tiny', text: 'Sell', textColor: color.white });
      }

      s.plots[0]![i] = { time, value: showUp ? u : NaN, color: gradientColor };
      s.plots[1]![i] = { time, value: showDn ? d : NaN, color: gradientColor };
      s.plots[2]![i] = { time, value: kcUpper, color: gradientColor };
      s.plots[3]![i] = { time, value: kcLower, color: gradientColor };
      s.plots[4]![i] = { time, value: ema100, color: trend === 1 ? color.green : color.red };
      s.plots[5]![i] = { time, value: (b.open + b.high + b.low + b.close) / 4 };
      // fill(kcUpperPlot, kcLowerPlot, color.new(gradientColor, 90), title = "Keltner Channel Fill")
      s.kcFill[i] = String(color.new(gradientColor, 90));
      // fill(mPlot, upPlot, highlighting and showUpTrend ? color.new(gradientColor, 90) : color.new(color.white, 100))
      s.upFill[i] = cfg.highlighting && showUp ? String(color.new(gradientColor, 90)) : noFill;
      s.dnFill[i] = cfg.highlighting && showDn ? String(color.new(gradientColor, 90)) : noFill;

      // alertcondition(buySignal), (sellSignal), (ta.change(trend) != 0) (na on bar 0: false)
      const change = i > 0 && trend !== prev;
      s.flags[0]![i] = buySignal;
      s.flags[1]![i] = sellSignal;
      s.flags[2]![i] = change;
      if (buySignal) s.times[0]!.push(time as number);
      if (sellSignal) s.times[1]!.push(time as number);
      if (change) s.times[2]!.push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
        plots: {
          plot0: p[0]!.slice(), plot1: p[1]!.slice(), plot2: p[2]!.slice(), plot3: p[3]!.slice(), plot4: p[4]!.slice(), plot5: p[5]!.slice(),
        },
        fills: [
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Keltner Channel Fill' }, colors: s.kcFill.slice() },
          { plot1: 'plot5', plot2: 'plot0', options: { title: 'Up Trend Highlight' }, colors: s.upFill.slice() },
          { plot1: 'plot5', plot2: 'plot1', options: { title: 'Down Trend Highlight' }, colors: s.dnFill.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QuantumTrendSwiftEdgeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<QuantumTrendSwiftEdgeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const QuantumTrendSwiftEdge = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
