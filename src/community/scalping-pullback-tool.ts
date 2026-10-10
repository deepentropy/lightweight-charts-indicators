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
 * Arrows are markers (arrowUp below the bar, arrowDown above the bar); the arrow height of the original (20 to 50
 * pixels) is not ported. The original also plots two bar counters with an na colour ("barssince(haClose<pacC)" and
 * "barssince(haClose>pacC)"): they draw nothing and are not in the output. 2 alert conditions are not ported.
 *
 * Reference: "Scalping PullBack Tool R1.1 by JustUncleL" by JustUncleL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';

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

/**
 * Heikin Ashi candles of the bars (heikinashi(tickerid) on the chart timeframe): close = ohlc4, open = the average of
 * the previous Heikin Ashi open and close ((open + close) / 2 on the first bar), high / low = the extremes of the bar
 * high / low and the Heikin Ashi open and close.
 */
function heikinAshi(bars: Bar[]): Array<{ open: number; high: number; low: number; close: number }> {
  const out: Array<{ open: number; high: number; low: number; close: number }> = [];
  bars.forEach((b, i) => {
    const close = (b.open + b.high + b.low + b.close) / 4;
    const prev = out[i - 1];
    const open = prev ? (prev.open + prev.close) / 2 : (b.open + b.close) / 2;
    out.push({ open, high: Math.max(b.high, open, close), low: Math.min(b.low, open, close), close });
  });
  return out;
}

export function calculate(bars: Bar[], inputs: Partial<ScalpingPullbackToolInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const delay = cfg.delayArrow ? 1 : 0;

  const candles = cfg.useHAcandles ? heikinAshi(bars) : bars;
  const haOpen = candles.map((b) => b.open);
  const haClose = candles.map((b) => b.close);
  const closeSeries = Series.fromArray(bars, haClose);
  const fastEMA = A(ta.ema(closeSeries, cfg.fastEMAlength));
  const mediumEMA = A(ta.ema(closeSeries, cfg.mediumEMAlength));
  const slowEMA = A(ta.ema(closeSeries, cfg.slowEMAlength));
  const pacC = A(ta.ema(closeSeries, cfg.hiLoLen));
  const pacL = A(ta.ema(Series.fromArray(bars, candles.map((b) => b.low)), cfg.hiLoLen));
  const pacU = A(ta.ema(Series.fromArray(bars, candles.map((b) => b.high)), cfg.hiLoLen));

  const high = (i: number) => (i >= 0 ? bars[i].high : NaN);
  const low = (i: number) => (i >= 0 ? bars[i].low : NaN);
  const t = (i: number) => bars[i].time;

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  const bgGreen = T(GREEN, 90);
  const bgRed = T(RED, 90);
  const bgYellow = T(YELLOW, 90);
  const arrowUp = T(GREEN, 20);
  const arrowDown = T(MAROON, 20);

  // valuewhen(filteredtopf, high[2], 0 / 1 / 2) and valuewhen(filteredbotf, low[2], 0 / 1 / 2)
  const tops: number[] = [NaN, NaN, NaN];
  const bottoms: number[] = [NaN, NaN, NaN];
  // barssince(haClose < pacC), barssince(haClose > pacC)
  let sinceBelow = NaN;
  let sinceAbove = NaN;
  const tradeDirection: number[] = [];

  for (let i = 0; i < n; i++) {
    const trendDirection = gt(fastEMA[i], mediumEMA[i]) && gt(pacL[i], mediumEMA[i]) ? 1
      : lt(fastEMA[i], mediumEMA[i]) && lt(pacU[i], mediumEMA[i]) ? -1 : 0;

    // Fractals on the chart highs / lows; the centre is 2 bars back
    const h0 = high(i), h1 = high(i - 1), h2 = high(i - 2), h3 = high(i - 3), h4 = high(i - 4);
    const l0 = low(i), l1 = low(i - 1), l2 = low(i - 2), l3 = low(i - 3), l4 = low(i - 4);
    const topf = cfg.filterBW
      ? lt(h4, h3) && lt(h3, h2) && gt(h2, h1) && gt(h1, h0)
      : lt(h4, h2) && le(h3, h2) && ge(h2, h1) && gt(h2, h0);
    const botf = cfg.filterBW
      ? gt(l4, l3) && gt(l3, l2) && lt(l2, l1) && lt(l1, l0)
      : gt(l4, l2) && ge(l3, l2) && le(l2, l1) && lt(l2, l0);
    if (topf) tops.unshift(h2);
    if (botf) bottoms.unshift(l2);
    const higherhigh = topf && lt(tops[1], tops[0]) && lt(tops[2], tops[0]);
    const lowerhigh = topf && gt(tops[1], tops[0]) && gt(tops[2], tops[0]);
    const higherlow = botf && lt(bottoms[1], bottoms[0]) && lt(bottoms[2], bottoms[0]);
    const lowerlow = botf && gt(bottoms[1], bottoms[0]) && gt(bottoms[2], bottoms[0]);

    // barcolor(ShowBarColor ? BARcolor : na)
    if (cfg.showBarColor) {
      barColors.push({ time: t(i), color: gt(haClose[i], pacU[i]) ? BLUE : lt(haClose[i], pacL[i]) ? RED : GRAY });
    }
    // bgcolor(ShowTrendBGcolor ? BGcolor : na, transp = 90)
    if (cfg.showTrendBGcolor) {
      bgColors.push({ time: t(i), color: trendDirection === 1 ? bgGreen : trendDirection === -1 ? bgRed : bgYellow });
    }

    // plotshape(..., offset = -2): the shape of bar i is drawn on bar i - 2
    if (i >= 2) {
      const at = t(i - 2);
      if (cfg.showFractals && topf) markers.push({ time: at, position: 'aboveBar', shape: 'triangleDown', color: RED });
      if (cfg.showFractals && botf) markers.push({ time: at, position: 'belowBar', shape: 'triangleUp', color: LIME });
      if (cfg.showHHLL && higherhigh) markers.push({ time: at, position: 'aboveBar', shape: 'square', color: MAROON, text: '[HH]' });
      if (cfg.showHHLL && lowerhigh) markers.push({ time: at, position: 'aboveBar', shape: 'square', color: MAROON, text: '[LH]' });
      if (cfg.showHHLL && higherlow) markers.push({ time: at, position: 'belowBar', shape: 'square', color: GREEN, text: '[HL]' });
      if (cfg.showHHLL && lowerlow) markers.push({ time: at, position: 'belowBar', shape: 'square', color: GREEN, text: '[LL]' });
    }

    // Pullback recovery
    sinceBelow = lt(haClose[i], pacC[i]) ? 0 : sinceBelow + 1;
    sinceAbove = gt(haClose[i], pacC[i]) ? 0 : sinceAbove + 1;
    const pacExitU = lt(haOpen[i], pacU[i]) && gt(haClose[i], pacU[i]) && le(sinceBelow, cfg.lookback);
    const pacExitL = gt(haOpen[i], pacL[i]) && lt(haClose[i], pacL[i]) && le(sinceAbove, cfg.lookback);
    const buy = trendDirection === 1 && pacExitU;
    const sell = trendDirection === -1 && pacExitL;
    // Keep the trading state until a pullback or a new recovery
    const prev = i > 0 ? tradeDirection[i - 1] : 0;
    tradeDirection.push(prev === 1 && lt(haClose[i], pacC[i]) ? 0
      : prev === -1 && gt(haClose[i], pacC[i]) ? 0
        : prev === 0 && buy ? 1
          : prev === 0 && sell ? -1 : prev);

    // plotarrow(ShowBuySell and nz(TradeDirection[1 + Delay]) == 0 and TradeDirection[Delay] != 0
    //   ? TradeDirection[Delay] : na, offset = -Delay)
    if (cfg.showBuySell && i - delay >= 0) {
      const before = i - delay - 1 >= 0 ? tradeDirection[i - delay - 1] : 0;
      const now = tradeDirection[i - delay];
      if (before === 0 && now !== 0) {
        markers.push(now > 0
          ? { time: t(i - delay), position: 'belowBar', shape: 'arrowUp', color: arrowUp }
          : { time: t(i - delay), position: 'aboveBar', shape: 'arrowDown', color: arrowDown });
      }
    }
  }

  const P = (values: number[], on: boolean) => bars.map((b, i) => ({ time: b.time, value: on ? values[i] : NaN }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: P(pacL, true),
      plot1: P(pacU, true),
      plot2: P(pacC, true),
      plot3: P(fastEMA, cfg.showFastEMA),
      plot4: P(mediumEMA, cfg.showMediumEMA),
      plot5: P(slowEMA, cfg.showSlowEMA),
    },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: T(GRAY, 90), title: 'Fill HiLo PAC' } }],
    markers,
    barColors,
    bgColors,
  };
}

export const ScalpingPullbackTool = { calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig };
