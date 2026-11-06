/**
 * Scalping PullBack Tool R1.1
 *
 * A price action channel (PAC): the EMAs of the high, the low and the close over the channel length, with a ribbon
 * of three EMAs of the close (fast, medium, slow). Bars are blue when they close above the channel, red below it and
 * gray inside it. The background shows the trend: green when the fast EMA and the channel are above the medium EMA,
 * red when they are below it, yellow otherwise. Fractals (5-bar highs / lows) are marked two bars back, with
 * optional HH / LH / HL / LL squares. An arrow marks a pullback recovery: in an up trend the bar opens below the
 * channel top and closes above it while the close was below the channel centre at most `lookback` bars ago
 * (mirrored in a down trend); the next arrow needs the close to cross the channel centre again first.
 *
 * By default the channel, the EMAs, the bar colours and the arrows use the Heikin Ashi candles of the chart bars
 * (open = average of the previous Heikin Ashi open and close, close = ohlc4); the fractals always use the chart
 * bars. The Heikin Ashi open starts at the first bar, so the first bars depend on where the bars start.
 *
 * The recovery arrows are the original's plotarrow (`arrows` of the result, value +1 / -1); the arrow height of the
 * original (20 to 50 pixels) is not ported. The original also plots two bar counters with an na colour
 * ("barssince(haClose<pacC)" and "barssince(haClose>pacC)", the second counting from close > pacC on the chart
 * close): they are transparent xcross markers at the bottom on the bars where the count is not 0 or na.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Buy Condition' / 'Sell Condition', true on the bar on which the
 * trading state goes from 0 to 1 / -1 (the bar of the arrow without the closed-candle delay).
 *
 * Reference: "Scalping PullBack Tool R1.1 by JustUncleL" by JustUncleL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { ArrowData } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ScalpingPullbackToolInputs {
  /** High Low PAC channel Length */
  hiLoLen: number;
  fastEMAlength: number;
  mediumEMAlength: number;
  slowEMAlength: number;
  showFastEMA: boolean;
  showMediumEMA: boolean;
  showSlowEMA: boolean;
  /** Show the HH / LH / HL / LL squares */
  showHHLL: boolean;
  showFractals: boolean;
  /** Show Ideal Fractals Only (strictly rising then falling highs / falling then rising lows) */
  filterBW: boolean;
  showBarColor: boolean;
  showBuySell: boolean;
  /** Pullback Lookback for PAC Cross Check */
  lookback: number;
  /** Show Alert Arrows Only on Closed Candles (the arrow is confirmed one bar later) */
  delayArrow: boolean;
  showTrendBGcolor: boolean;
  /** Use Heikin Ashi Candles in Algo Calculations */
  useHAcandles: boolean;
}

export const defaultInputs: ScalpingPullbackToolInputs = {
  hiLoLen: 34,
  fastEMAlength: 89,
  mediumEMAlength: 200,
  slowEMAlength: 600,
  showFastEMA: true,
  showMediumEMA: true,
  showSlowEMA: false,
  showHHLL: false,
  showFractals: true,
  filterBW: false,
  showBarColor: true,
  showBuySell: true,
  lookback: 3,
  delayArrow: false,
  showTrendBGcolor: true,
  useHAcandles: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'hiLoLen', type: 'int', title: 'High Low PAC channel Length', defval: 34, min: 2 },
  { id: 'fastEMAlength', type: 'int', title: 'fastEMAlength', defval: 89, min: 2 },
  { id: 'mediumEMAlength', type: 'int', title: 'mediumEMAlength', defval: 200, min: 2 },
  { id: 'slowEMAlength', type: 'int', title: 'slowEMAlength', defval: 600, min: 2 },
  { id: 'showFastEMA', type: 'bool', title: 'ShowFastEMA', defval: true },
  { id: 'showMediumEMA', type: 'bool', title: 'ShowMediumEMA', defval: true },
  { id: 'showSlowEMA', type: 'bool', title: 'ShowSlowEMA', defval: false },
  { id: 'showHHLL', type: 'bool', title: 'ShowHHLL', defval: false },
  { id: 'showFractals', type: 'bool', title: 'ShowFractals', defval: true },
  { id: 'filterBW', type: 'bool', title: 'Show Ideal Fractals Only', defval: false },
  { id: 'showBarColor', type: 'bool', title: 'Show coloured Bars around PAC', defval: true },
  { id: 'showBuySell', type: 'bool', title: 'Show Buy/Sell Alert Arrows', defval: true },
  { id: 'lookback', type: 'int', title: 'Pullback Lookback for PAC Cross Check', defval: 3, min: 1 },
  { id: 'delayArrow', type: 'bool', title: 'Show Alert Arrows Only on Closed Candles', defval: false },
  { id: 'showTrendBGcolor', type: 'bool', title: 'ShowTrendBGcolor', defval: true },
  { id: 'useHAcandles', type: 'bool', title: 'Use Heikin Ashi Candles in Algo Calculations', defval: true },
];

// Pine v4 colour constants
const GRAY = '#787B86';
const RED = '#FF5252';
const BLUE = '#2196F3';
const GREEN = '#4CAF50';
const YELLOW = '#FFEB3B';
const BLACK = '#363A45';
const LIME = '#00E676';
const MAROON = '#880E4F';
const T = (c: string, transp: number) => String(color.new(c, transp));

export const plotConfig: PlotConfig[] = [
  // The titles are those of the original: "High PAC EMA" is the EMA of the low and "Low PAC EMA" the EMA of the high
  { id: 'plot0', title: 'High PAC EMA', color: T(GRAY, 50), lineWidth: 1 },
  { id: 'plot1', title: 'Low PAC EMA', color: T(GRAY, 50), lineWidth: 1 },
  { id: 'plot2', title: 'Close PAC EMA', color: RED, lineWidth: 2 },
  { id: 'plot3', title: 'fastEMA', color: T(GREEN, 20), lineWidth: 2 },
  { id: 'plot4', title: 'mediumEMA', color: T(BLUE, 20), lineWidth: 3 },
  { id: 'plot5', title: 'slowEMA', color: T(BLACK, 20), lineWidth: 4 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_0', plot1: 'plot0', plot2: 'plot1', color: T(GRAY, 90), title: 'Fill HiLo PAC' },
];

export const metadata = {
  title: 'Scalping PullBack Tool R1.1 by JustUncleL',
  shortTitle: 'SCALPTOOL R1.1',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number };
type Result = IndicatorResult & { arrows: ArrowData[] } & { alerts: AlertConditionState[] };

interface ScalpVars {
  /** heikinashi(): open and close of the Heikin Ashi candle before */
  haOpen: number;
  haClose: number;
  /** valuewhen(filteredtopf, high[2], 0 / 1 / 2) and valuewhen(filteredbotf, low[2], 0 / 1 / 2) (changed in place) */
  tops: number[];
  bottoms: number[];
  /** barssince(haClose < pacC), barssince(haClose > pacC), barssince(close > pacC) */
  sinceBelow: number;
  sinceAbove: number;
  sinceCloseAbove: number;
}

interface ScalpRun extends BarRunState<ScalpVars> {
  fast: ReturnType<typeof taStep.ema>;
  medium: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  pacCStep: ReturnType<typeof taStep.ema>;
  pacLStep: ReturnType<typeof taStep.ema>;
  pacUStep: ReturnType<typeof taStep.ema>;
  tradeDirection: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  arrows: ArrowData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
}

const highAt = (bars: Bar[], k: number) => (k >= 0 ? bars[k].high : NaN);
const lowAt = (bars: Bar[], k: number) => (k >= 0 ? bars[k].low : NaN);

function study(inputs: Partial<ScalpingPullbackToolInputs>): BarStudy<ScalpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const delay = cfg.delayArrow ? 1 : 0;
  const bgGreen = T(GREEN, 90);
  const bgRed = T(RED, 90);
  const bgYellow = T(YELLOW, 90);
  const arrowUp = T(GREEN, 20);
  const arrowDown = T(MAROON, 20);
  return {
    init() {
      const s: ScalpRun = {
        fast: taStep.ema(cfg.fastEMAlength), medium: taStep.ema(cfg.mediumEMAlength), slow: taStep.ema(cfg.slowEMAlength),
        pacCStep: taStep.ema(cfg.hiLoLen), pacLStep: taStep.ema(cfg.hiLoLen), pacUStep: taStep.ema(cfg.hiLoLen),
        tradeDirection: [], plots: [[], [], [], [], [], []], flags: [[], []], times: [[], []],
        markers: [], arrows: [], barColors: [], bgColors: [],
        steps: [],
        vars: {
          haOpen: NaN, haClose: NaN, tops: [NaN, NaN, NaN], bottoms: [NaN, NaN, NaN],
          sinceBelow: NaN, sinceAbove: NaN, sinceCloseAbove: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.fast, s.medium, s.slow, s.pacCStep, s.pacLStep, s.pacUStep];
      s.lists = [s.markers, s.arrows, s.barColors, s.bgColors, ...s.times];
      s.series = [s.tradeDirection, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      // heikinashi(tickerid) on the chart timeframe: the Heikin Ashi candles of the bars
      let haOpen = b.open;
      let haClose = b.close;
      let haHigh = b.high;
      let haLow = b.low;
      if (cfg.useHAcandles) {
        haClose = (b.open + b.high + b.low + b.close) / 4;
        haOpen = i > 0 ? (v.haOpen + v.haClose) / 2 : (b.open + b.close) / 2;
        haHigh = Math.max(b.high, haOpen, haClose);
        haLow = Math.min(b.low, haOpen, haClose);
        v.haOpen = haOpen;
        v.haClose = haClose;
      }
      const fastEMA = s.fast.step(haClose);
      const mediumEMA = s.medium.step(haClose);
      const slowEMA = s.slow.step(haClose);
      const pacC = s.pacCStep.step(haClose);
      const pacL = s.pacLStep.step(haLow);
      const pacU = s.pacUStep.step(haHigh);

      const trendDirection = gt(fastEMA, mediumEMA) && gt(pacL, mediumEMA) ? 1
        : lt(fastEMA, mediumEMA) && lt(pacU, mediumEMA) ? -1 : 0;

      // Fractals on the chart highs / lows; the centre is 2 bars back
      const h0 = highAt(bars, i), h1 = highAt(bars, i - 1), h2 = highAt(bars, i - 2), h3 = highAt(bars, i - 3), h4 = highAt(bars, i - 4);
      const l0 = lowAt(bars, i), l1 = lowAt(bars, i - 1), l2 = lowAt(bars, i - 2), l3 = lowAt(bars, i - 3), l4 = lowAt(bars, i - 4);
      const topf = cfg.filterBW
        ? lt(h4, h3) && lt(h3, h2) && gt(h2, h1) && gt(h1, h0)
        : lt(h4, h2) && le(h3, h2) && ge(h2, h1) && gt(h2, h0);
      const botf = cfg.filterBW
        ? gt(l4, l3) && gt(l3, l2) && lt(l2, l1) && lt(l1, l0)
        : gt(l4, l2) && ge(l3, l2) && le(l2, l1) && lt(l2, l0);
      const tops = v.tops;
      const bottoms = v.bottoms;
      if (topf) {
        tops[2] = tops[1];
        tops[1] = tops[0];
        tops[0] = h2;
      }
      if (botf) {
        bottoms[2] = bottoms[1];
        bottoms[1] = bottoms[0];
        bottoms[0] = l2;
      }
      const higherhigh = topf && lt(tops[1], tops[0]) && lt(tops[2], tops[0]);
      const lowerhigh = topf && gt(tops[1], tops[0]) && gt(tops[2], tops[0]);
      const higherlow = botf && lt(bottoms[1], bottoms[0]) && lt(bottoms[2], bottoms[0]);
      const lowerlow = botf && gt(bottoms[1], bottoms[0]) && gt(bottoms[2], bottoms[0]);

      // barcolor(ShowBarColor ? BARcolor : na)
      if (cfg.showBarColor) {
        s.barColors.push({ time, color: gt(haClose, pacU) ? BLUE : lt(haClose, pacL) ? RED : GRAY });
      }
      // bgcolor(ShowTrendBGcolor ? BGcolor : na, transp = 90)
      if (cfg.showTrendBGcolor) {
        s.bgColors.push({ time, color: trendDirection === 1 ? bgGreen : trendDirection === -1 ? bgRed : bgYellow });
      }

      // plotshape(..., offset = -2): the shape of bar i is drawn on bar i - 2
      const markers = s.markers;
      if (i >= 2) {
        const at = bars[i - 2].time;
        if (cfg.showFractals && topf) markers.push({ time: at, position: 'aboveBar', shape: 'triangleDown', color: RED, id: 'shape0' });
        if (cfg.showFractals && botf) markers.push({ time: at, position: 'belowBar', shape: 'triangleUp', color: LIME, id: 'shape1' });
        if (cfg.showHHLL && higherhigh) markers.push({ time: at, position: 'aboveBar', shape: 'square', color: MAROON, text: '[HH]', id: 'shape2' });
        if (cfg.showHHLL && lowerhigh) markers.push({ time: at, position: 'aboveBar', shape: 'square', color: MAROON, text: '[LH]', id: 'shape3' });
        if (cfg.showHHLL && higherlow) markers.push({ time: at, position: 'belowBar', shape: 'square', color: GREEN, text: '[HL]', id: 'shape4' });
        if (cfg.showHHLL && lowerlow) markers.push({ time: at, position: 'belowBar', shape: 'square', color: GREEN, text: '[LL]', id: 'shape5' });
      }

      // Pullback recovery
      v.sinceBelow = lt(haClose, pacC) ? 0 : v.sinceBelow + 1;
      v.sinceAbove = gt(haClose, pacC) ? 0 : v.sinceAbove + 1;
      v.sinceCloseAbove = gt(b.close, pacC) ? 0 : v.sinceCloseAbove + 1;
      // plotshape(barssince(haClose<pacC), color=na, location=location.bottom) and plotshape(barssince(close>pacC), ...):
      // the default xcross, drawn where the count is not 0 / na, with no colour
      if (v.sinceBelow > 0) markers.push({ time, position: 'bottom', shape: 'xcross', color: 'transparent', id: 'shape6' });
      if (v.sinceCloseAbove > 0) markers.push({ time, position: 'bottom', shape: 'xcross', color: 'transparent', id: 'shape7' });
      const pacExitU = lt(haOpen, pacU) && gt(haClose, pacU) && le(v.sinceBelow, cfg.lookback);
      const pacExitL = gt(haOpen, pacL) && lt(haClose, pacL) && le(v.sinceAbove, cfg.lookback);
      const buy = trendDirection === 1 && pacExitU;
      const sell = trendDirection === -1 && pacExitL;
      // Keep the trading state until a pullback or a new recovery
      const td = s.tradeDirection;
      const prev = i > 0 ? td[i - 1] : 0;
      const dir = prev === 1 && lt(haClose, pacC) ? 0
        : prev === -1 && gt(haClose, pacC) ? 0
          : prev === 0 && buy ? 1
            : prev === 0 && sell ? -1 : prev;
      td[i] = dir;

      // plotarrow(ShowBuySell and nz(TradeDirection[1 + Delay]) == 0 and TradeDirection[Delay] != 0
      //   ? TradeDirection[Delay] : na, offset = -Delay)
      if (cfg.showBuySell && i - delay >= 0) {
        const before = i - delay - 1 >= 0 ? td[i - delay - 1] : 0;
        const now = td[i - delay];
        if (before === 0 && now !== 0) {
          s.arrows.push({ time: bars[i - delay].time, id: 'arrow0', value: now, color: now > 0 ? arrowUp : arrowDown });
        }
      }

      // Long = nz(TradeDirection[1]) == 0 and TradeDirection == 1; Short: TradeDirection == -1
      const long = prev === 0 && dir === 1;
      const short = prev === 0 && dir === -1;
      s.flags[0][i] = long;
      s.flags[1][i] = short;
      if (long) s.times[0].push(time as number);
      if (short) s.times[1].push(time as number);

      s.plots[0][i] = { time, value: pacL };
      s.plots[1][i] = { time, value: pacU };
      s.plots[2][i] = { time, value: pacC };
      s.plots[3][i] = { time, value: cfg.showFastEMA ? fastEMA : NaN };
      s.plots[4][i] = { time, value: cfg.showMediumEMA ? mediumEMA : NaN };
      s.plots[5][i] = { time, value: cfg.showSlowEMA ? slowEMA : NaN };
    },
    copyVars: (v) => ({ ...v, tops: v.tops.slice(), bottoms: v.bottoms.slice() }),
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
          plot5: s.plots[5].slice(),
        },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: T(GRAY, 90), title: 'Fill HiLo PAC' } }],
        markers: s.markers.slice(),
        arrows: s.arrows.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(Long, "Buy Condition") / alertcondition(Short, "Sell Condition")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ScalpingPullbackToolInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ScalpingPullbackToolInputs> = {},
): IndicatorResult & { arrows: ArrowData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Condition', message: 'BUY' },
  { id: 'alert1', title: 'Sell Condition', message: 'SELL' },
];

export const ScalpingPullbackTool = {
  calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, alertConditions,
};
