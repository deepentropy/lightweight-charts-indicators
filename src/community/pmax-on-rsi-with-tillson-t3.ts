/**
 * PMax on RSI with Tillson T3
 *
 * The Profit Maximizer (PMax) trailing stop applied to an RSI instead of the price.
 * - RSI: Wilder averages (alpha = 1 / length, started at 0) of the up and down moves of the close.
 * - A "high" and a "low" RSI of the bar: the simple averages of the up / down moves of the last `length` bars, in
 *   which one bar is replaced by the move from the previous close to the high (to the low). The true range of the RSI
 *   is the largest of high RSI - low RSI and their distances to the previous RSI; its simple average is the ATR.
 * - Moving average: the Tillson T3 of the RSI (six chained EMAs combined with the volume factor).
 * - PMax: a stop at T3 - multiplier * ATR that only rises while T3 is above it (and the mirror stop above); the
 *   direction flips when T3 crosses the active stop.
 * Buy / Sell labels mark the crosses of T3 and PMax, and the area between the RSI and PMax is green when T3 is above
 * PMax, red when it is below.
 *
 * Alerts (alertcondition, `alerts` of the result): crosses of T3 and PMax (either way, over, under) and crosses of
 * the "Source" input (a price, compared with PMax as in the original) and PMax.
 *
 * Reference: "PMax on Rsi w T3" by KivancOzbilgic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © KivancOzbilgic
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun, WindowSma } from '../live-run';

export interface PmaxOnRsiWithTillsonT3Inputs {
  /** Source of the price cross alert conditions */
  src: SourceType;
  multiplier: number;
  /** Tillson T3 length */
  length: number;
  /** Tillson T3 volume factor */
  t3a1: number;
  /** ATR length */
  periods: number;
  rsiLength: number;
  showRsi: boolean;
  showSupport: boolean;
  showSignals: boolean;
  highlighting: boolean;
}

export const defaultInputs: PmaxOnRsiWithTillsonT3Inputs = {
  src: 'hl2',
  multiplier: 3,
  length: 8,
  t3a1: 0.7,
  periods: 10,
  rsiLength: 14,
  showRsi: true,
  showSupport: true,
  showSignals: true,
  highlighting: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'hl2' },
  { id: 'multiplier', type: 'float', title: 'ATR Multiplier', defval: 3, step: 0.1 },
  { id: 'length', type: 'int', title: 'Tillson T3 Length', defval: 8, min: 1 },
  { id: 't3a1', type: 'float', title: 'TILLSON T3 Volume Factor', defval: 0.7, step: 0.1 },
  { id: 'periods', type: 'int', title: 'ATR Length', defval: 10 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'showRsi', type: 'bool', title: 'Show RSI?', defval: true },
  { id: 'showSupport', type: 'bool', title: 'Show Moving Average?', defval: true },
  { id: 'showSignals', type: 'bool', title: 'Show Crossing Signals?', defval: true },
  { id: 'highlighting', type: 'bool', title: 'Highlighter On/Off ?', defval: true },
];

// Colour constants of Pine version 4
const BLACK = '#363A45';
const RED = '#FF5252';
const GREEN = '#4CAF50';
const WHITE = '#FFFFFF';
/** fill() without a transparency: 90 in this Pine version */
const GREEN_FILL = String(color.new(GREEN, 90));
const RED_FILL = String(color.new(RED, 90));
const BAND_FILL = String(color.new('#9915FF', 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#8E1599', lineWidth: 1 },
  { id: 'plot1', title: 'T3', color: BLACK, lineWidth: 2 },
  { id: 'plot2', title: 'PMax', color: RED, lineWidth: 2 },
  // plot(rsi, title = "", style = plot.style_circles, linewidth = 0, display = display.none): the edge of the fills
  { id: 'plot3', title: 'RSI (fill edge)', color: 'transparent', lineWidth: 1, style: 'circles', display: 'none' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 70, title: 'Upper Band', color: '#C0C0C0', linestyle: 'dashed' },
  { id: 'hline_lower', price: 30, title: 'Lower Band', color: '#C0C0C0', linestyle: 'dashed' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'hline_upper', plot2: 'hline_lower', color: BAND_FILL, title: 'Background' },
  { id: 'fill_up', plot1: 'plot3', plot2: 'plot2', color: GREEN_FILL, title: 'UpTrend Highligter' },
  { id: 'fill_down', plot1: 'plot3', plot2: 'plot2', color: RED_FILL, title: 'DownTrend Highligter' },
];

export const metadata = {
  title: 'PMax on Rsi w T3',
  shortTitle: 'PmR3',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine max(...): na when a value is na */
const max3 = (a: number, b: number, c: number) => (isNaN(a) || isNaN(b) || isNaN(c) ? NaN : Math.max(a, b, c));

type Point = { time: number; value: number };
type Result = IndicatorResult & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Cross = ReturnType<typeof taStep.crossover>;

interface PmaxVars {
  prevClose: number;
  /** Wwma_Func: WWMA := wwalpha * src + (1 - wwalpha) * nz(WWMA[1]) */
  avUp: number;
  avDown: number;
  prevRsi: number;
  longStopBefore: number;
  shortStopBefore: number;
  dirBefore: number;
}

interface PmaxRun extends BarRunState<PmaxVars> {
  avgUp: WindowSma;
  avgDown: WindowSma;
  atr: WindowSma;
  ema: ReturnType<typeof taStep.ema>[];
  buy: Cross;
  sell: ReturnType<typeof taStep.crossunder>;
  srcOver: Cross;
  srcUnder: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  upFill: string[];
  downFill: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PmaxOnRsiWithTillsonT3Inputs>): BarStudy<PmaxRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { multiplier, length, t3a1, periods, rsiLength } = cfg;
  const src = barSource(cfg.src);
  // rsi = rs == -1 ? 0 : 100 - 100 / (1 + rs): plain divisions (x / 0 is infinite, 0 / 0 is na)
  const rsiOf = (rs: number) => (eq(rs, -1) ? 0 : 100 - 100 / (1 + rs));
  const wwalpha = 1 / rsiLength;
  const c1 = -t3a1 * t3a1 * t3a1;
  const c2 = 3 * t3a1 * t3a1 + 3 * t3a1 * t3a1 * t3a1;
  const c3 = -6 * t3a1 * t3a1 - 3 * t3a1 - 3 * t3a1 * t3a1 * t3a1;
  const c4 = 1 + 3 * t3a1 + t3a1 * t3a1 * t3a1 + 3 * t3a1 * t3a1;
  const plotValue = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: PmaxRun = {
        avgUp: new WindowSma(rsiLength), avgDown: new WindowSma(rsiLength), atr: new WindowSma(periods),
        ema: Array.from({ length: 6 }, () => taStep.ema(length)),
        buy: taStep.crossover(), sell: taStep.crossunder(), srcOver: taStep.crossover(), srcUnder: taStep.crossunder(),
        plot0: [], plot1: [], plot2: [], plot3: [], upFill: [], downFill: [], markers: [],
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [],
        vars: {
          prevClose: NaN, avUp: 0, avDown: 0, prevRsi: NaN, longStopBefore: NaN, shortStopBefore: NaN, dirBefore: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.avgUp, s.avgDown, s.atr, ...s.ema, s.buy, s.sell, s.srcOver, s.srcUnder];
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.upFill, s.downFill, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const c = b.close;
      const cl1 = v.prevClose;
      v.prevClose = c;
      // i = close >= close[1] ? close - close[1] : 0, i2 = close < close[1] ? close[1] - close : 0
      const up = ge(c, cl1) ? c - cl1 : 0;
      const down = lt(c, cl1) ? cl1 - c : 0;
      const avgUp = s.avgUp.step(up);
      const avgDown = s.avgDown.step(down);

      v.avUp = wwalpha * up + (1 - wwalpha) * v.avUp;
      v.avDown = wwalpha * down + (1 - wwalpha) * v.avDown;
      const rsi = rsiOf(v.avUp / v.avDown);

      const k1 = gt(b.high, cl1) ? b.high - cl1 : 0;
      const k2 = lt(b.high, cl1) ? cl1 - b.high : 0;
      const k3 = gt(b.low, cl1) ? b.low - cl1 : 0;
      const k4 = lt(b.low, cl1) ? cl1 - b.low : 0;
      const avgUpH = (avgUp * (rsiLength - 1) + k1) / rsiLength;
      const avgDownH = (avgDown * (rsiLength - 1) + k2) / rsiLength;
      const avgUpL = (avgUp * (rsiLength - 1) + k3) / rsiLength;
      const avgDownL = (avgDown * (rsiLength - 1) + k4) / rsiLength;
      const rsih = rsiOf(avgUpH / avgDownH);
      const rsil = rsiOf(avgUpL / avgDownL);
      const rsi1 = v.prevRsi;
      v.prevRsi = rsi;
      const tr = max3(rsih - rsil, Math.abs(rsih - rsi1), Math.abs(rsil - rsi1));
      const atr = s.atr.step(tr);

      // Tillson T3 of the RSI
      const e1 = s.ema[0].step(rsi);
      const e2 = s.ema[1].step(e1);
      const e3 = s.ema[2].step(e2);
      const e4 = s.ema[3].step(e3);
      const e5 = s.ema[4].step(e4);
      const e6 = s.ema[5].step(e5);
      const m = c1 * e6 + c2 * e5 + c3 * e4 + c4 * e3;

      // Pmax_Func
      let longStop = m - multiplier * atr;
      // nz(longStop[1], longStop)
      const longStopPrev = Number.isFinite(v.longStopBefore) ? v.longStopBefore : longStop;
      longStop = gt(m, longStopPrev) ? Math.max(longStop, longStopPrev) : longStop;
      let shortStop = m + multiplier * atr;
      const shortStopPrev = Number.isFinite(v.shortStopBefore) ? v.shortStopBefore : shortStop;
      shortStop = lt(m, shortStopPrev) ? Math.min(shortStop, shortStopPrev) : shortStop;
      let dir = isNaN(v.dirBefore) ? 1 : v.dirBefore;
      dir = dir === -1 && gt(m, shortStopPrev) ? 1 : dir === 1 && lt(m, longStopPrev) ? -1 : dir;
      const pmax = dir === 1 ? longStop : shortStop;
      v.longStopBefore = longStop;
      v.shortStopBefore = shortStop;
      v.dirBefore = dir;

      const buy = s.buy.step(m, pmax);
      const sell = s.sell.step(m, pmax);
      // crossover(src, PMax) / crossunder(src, PMax)
      const sv = src(b);
      const srcOver = s.srcOver.step(sv, pmax);
      const srcUnder = s.srcUnder.step(sv, pmax);

      const time = b.time;
      s.plot0[i] = { time, value: cfg.showRsi ? plotValue(rsi) : NaN };
      s.plot1[i] = { time, value: cfg.showSupport ? plotValue(m) : NaN };
      s.plot2[i] = { time, value: plotValue(pmax) };
      s.plot3[i] = { time, value: plotValue(rsi) };
      s.upFill[i] = cfg.highlighting && gt(m, pmax) ? GREEN_FILL : 'transparent';
      s.downFill[i] = cfg.highlighting && lt(m, pmax) ? RED_FILL : 'transparent';
      if (cfg.showSignals && buy && Number.isFinite(pmax)) {
        s.markers.push({
          time, position: 'atPriceBottom', price: pmax * 0.995, shape: 'labelUp', color: GREEN, text: 'Buy', textColor: WHITE, size: 'tiny',
        });
      }
      if (cfg.showSignals && sell && Number.isFinite(pmax)) {
        s.markers.push({
          time, position: 'atPriceTop', price: pmax * 1.005, shape: 'labelDown', color: RED, text: 'Sell', textColor: WHITE, size: 'tiny',
        });
      }
      // alertcondition(cross(MAvg, PMax)) / crossover / crossunder; cross(src, PMax) / crossover / crossunder
      const flags = [buy || sell, buy, sell, srcOver || srcUnder, srcOver, srcUnder];
      for (let k = 0; k < flags.length; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        hlines: [
          { value: 70, options: { title: 'Upper Band', color: '#C0C0C0', linestyle: 'dashed' } },
          { value: 30, options: { title: 'Lower Band', color: '#C0C0C0', linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Background', color: BAND_FILL } },
          { plot1: 'plot3', plot2: 'plot2', options: { title: 'UpTrend Highligter' }, colors: s.upFill.slice() },
          { plot1: 'plot3', plot2: 'plot2', options: { title: 'DownTrend Highligter' }, colors: s.downFill.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PmaxOnRsiWithTillsonT3Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PmaxOnRsiWithTillsonT3Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Cross Alert', message: 'PMax - Moving Avg Crossing!' },
  { id: 'alert1', title: 'Crossover Alarm', message: 'Moving Avg BUY SIGNAL!' },
  { id: 'alert2', title: 'Crossunder Alarm', message: 'Moving Avg SELL SIGNAL!' },
  { id: 'alert3', title: 'Price Cross Alert', message: 'PMax - Price Crossing!' },
  { id: 'alert4', title: 'Price Crossover Alarm', message: 'PRICE OVER PMax - BUY SIGNAL!' },
  { id: 'alert5', title: 'Price Crossunder Alarm', message: 'PRICE UNDER PMax - SELL SIGNAL!' },
];

export const PmaxOnRsiWithTillsonT3 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig, alertConditions };
