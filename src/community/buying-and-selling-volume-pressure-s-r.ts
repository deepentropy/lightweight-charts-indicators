/**
 * Cumulative Buying and Selling Volume Pressure with Dynamic S/R
 *
 * Buying volume = volume * (close - low) / (high - low), selling volume = volume * (high - close) / (high - low)
 * (0 on a bar with high = low), summed over `lookback` bars (cum(x) - cum(x)[lookback], 0 while not available).
 * A cross of the buying sum above the selling sum starts a bullish trend and resets the support line to the low; a
 * cross below starts a bearish trend and resets the resistance line to the high. While the trend lasts, the support
 * follows the lowest low (bullish) and the resistance the highest high (bearish); otherwise they are kept. The mid
 * line is the SMA of the support / resistance midpoint, with standard deviation bands. Buy / Sell arrows when the
 * close crosses the mid line.
 *
 * Reference: "Cumulative Buying and Selling Volume Pressure with Dynamic S/R" by DinoTradez
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © DinoTradez
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BuyingAndSellingVolumePressureSRInputs {
  /** SMA / standard deviation length of the mid line */
  length: number;
  /** Band width in standard deviations */
  devMultiplier: number;
  /** Number of bars of the buying / selling volume sums */
  lookback: number;
}

export const defaultInputs: BuyingAndSellingVolumePressureSRInputs = {
  length: 20,
  devMultiplier: 2.0,
  lookback: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Mid Line Length', defval: 20, min: 1 },
  { id: 'devMultiplier', type: 'float', title: 'Deviation Multiplier', defval: 2.0 },
  { id: 'lookback', type: 'int', title: 'Cumulative Lookback', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Support', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'Resistance', color: color.red, lineWidth: 2 },
  { id: 'plot2', title: 'MidLine', color: color.white, lineWidth: 2 },
  { id: 'plot3', title: 'UpperLine', color: color.yellow, lineWidth: 2 },
  { id: 'plot4', title: 'LowerLine', color: color.yellow, lineWidth: 2 },
];

export const metadata = {
  title: 'Cumulative Buying and Selling Volume Pressure with Dynamic S/R',
  shortTitle: 'Cumulative Buying and Selling Volume Pressure with Dynamic S/R',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number };

interface PressureVars {
  /** ta.cum of the buying / selling volume */
  sb: number;
  ss: number;
  /** var float trendState = 0 */
  trendState: number;
  /** trendState[1] (na on bar 0) */
  prevTrend: number;
}

interface PressureRun extends BarRunState<PressureVars> {
  sma: WindowSma;
  dev: WindowStdev;
  cumBuy: number[];
  cumSell: number[];
  cBuy: number[];
  cSell: number[];
  support: number[];
  resistance: number[];
  mid: number[];
  plots: Point[][];
  markers: MarkerData[];
}

function study(inputs: Partial<BuyingAndSellingVolumePressureSRInputs>): BarStudy<PressureRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, devMultiplier, lookback } = cfg;
  const nz = (x: number) => (Number.isFinite(x) ? x : 0);
  const textColor = color.blue; // Pine plotshape default text colour
  return {
    init() {
      const s: PressureRun = {
        sma: new WindowSma(length), dev: new WindowStdev(length), cumBuy: [], cumSell: [], cBuy: [], cSell: [],
        support: [], resistance: [], mid: [], plots: [[], [], [], [], []], markers: [],
        steps: [], vars: { sb: 0, ss: 0, trendState: 0, prevTrend: NaN }, lists: [], series: [],
      };
      s.steps = [s.sma, s.dev];
      s.lists = [s.markers];
      s.series = [s.cumBuy, s.cumSell, s.cBuy, s.cSell, s.support, s.resistance, s.mid, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const vol = b.volume ?? NaN;
      const denominator = b.high - b.low;
      // denominator != 0 (Pine ==: within 1e-10)
      const nonZero = !isNaN(denominator) && Math.abs(denominator) > EPS;
      const buying = nonZero ? (vol * (b.close - b.low)) / denominator : 0.0;
      const selling = nonZero ? (vol * (b.high - b.close)) / denominator : 0.0;
      // ta.cum skips na values (keeps the previous sum)
      if (!isNaN(buying)) v.sb += buying;
      if (!isNaN(selling)) v.ss += selling;
      s.cumBuy[i] = v.sb;
      s.cumSell[i] = v.ss;
      const cBuy = nz(i - lookback >= 0 ? v.sb - s.cumBuy[i - lookback] : NaN);
      const cSell = nz(i - lookback >= 0 ? v.ss - s.cumSell[i - lookback] : NaN);
      s.cBuy[i] = cBuy;
      s.cSell[i] = cSell;

      const bullishCross = i > 0 && le(s.cBuy[i - 1], s.cSell[i - 1]) && gt(cBuy, cSell);
      const bearishCross = i > 0 && ge(s.cBuy[i - 1], s.cSell[i - 1]) && lt(cBuy, cSell);
      const prevTrend = v.prevTrend;
      let trendState: number;
      if (bullishCross) trendState = 1;
      else if (bearishCross) trendState = -1;
      else trendState = prevTrend; // trendState := trendState[1]
      v.trendState = trendState;

      const prevSupport = i > 0 ? s.support[i - 1] : NaN;
      let support: number;
      if (bullishCross) support = b.low;
      else if (eq(trendState, 1) && eq(prevTrend, 1)) support = isNaN(prevSupport) ? b.low : Math.min(prevSupport, b.low);
      else if (isNaN(prevSupport)) support = b.low;
      else support = prevSupport;
      s.support[i] = support;

      const prevResistance = i > 0 ? s.resistance[i - 1] : NaN;
      let resistance: number;
      if (bearishCross) resistance = b.high;
      else if (eq(trendState, -1) && eq(prevTrend, -1)) resistance = isNaN(prevResistance) ? b.high : Math.max(prevResistance, b.high);
      else if (isNaN(prevResistance)) resistance = b.high;
      else resistance = prevResistance;
      s.resistance[i] = resistance;

      v.prevTrend = trendState;

      const rawMid = (support + resistance) / 2.0;
      const mid = s.sma.step(rawMid);
      const sd = s.dev.step(rawMid);
      s.mid[i] = mid;
      const upper = mid + devMultiplier * sd;
      const lower = mid - devMultiplier * sd;

      const t = b.time;
      const f = (x: number) => (Number.isFinite(x) ? x : NaN);
      s.plots[0][i] = { time: t, value: f(support) };
      s.plots[1][i] = { time: t, value: f(resistance) };
      s.plots[2][i] = { time: t, value: f(mid) };
      s.plots[3][i] = { time: t, value: f(upper) };
      s.plots[4][i] = { time: t, value: f(lower) };

      if (i >= 1) {
        const c = b.close;
        const c1 = bars[i - 1].close;
        if (le(c1, s.mid[i - 1]) && gt(c, mid)) {
          s.markers.push({ time: t, position: 'belowBar', shape: 'arrowUp', color: color.green, size: 'tiny', text: 'Buy', textColor });
        }
        if (ge(c1, s.mid[i - 1]) && lt(c, mid)) {
          s.markers.push({ time: t, position: 'aboveBar', shape: 'arrowDown', color: color.red, size: 'tiny', text: 'Sell', textColor });
        }
      }
    },
    result(s) {
      const [plot0, plot1, plot2, plot3, plot4] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4 },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuyingAndSellingVolumePressureSRInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BuyingAndSellingVolumePressureSRInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const BuyingAndSellingVolumePressureSR = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
