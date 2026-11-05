/**
 * All Candlestick Patterns Identifier
 *
 * The 33 candle patterns of the original, each an arrow (a circle for the Doji) with its name, from the body / range
 * ratio of the bars (strong body >= 0.7, small body, doji body < 0.1), the shadows and the closes / opens of the
 * bars before: Dark Cloud Cover, Doji, Doji Star, Dragonfly Doji, Evening Star (Doji), Gravestone Doji, Hanging Man,
 * Morning Star (Doji), Piercing Pattern, Raindrop (Doji), Inverted Hammer, Star, Bearish / Bullish Thrusting,
 * Tweezers Bottom / Top, Tower Bottom / Top, Bullish / Bearish In Neck, Bullish / Bearish Separating Lines, Bullish /
 * Bearish Harami, Bullish / Bearish Engulfing and Doji Bullish / Bearish Engulfing. Bullish patterns are green arrows
 * below the bar, bearish ones red arrows above it.
 *
 * As in the original: a chained comparison `0.3 > x >= 0.1` is `(0.3 > x) >= 0.1`, so only `0.3 > x` counts; the
 * "Doji Bearish Engulfing" shape plots the condition of the Bearish Engulfing.
 *
 * Reference: "All Candlestick Patterns Identifier" (Pine title "Mamona Candles") by Robert N.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AllCandlestickPatternsInputs {}

export const defaultInputs: AllCandlestickPatternsInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'All Candlestick Patterns',
  shortTitle: 'CdlPat',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** The colours of the original (v1 constants red, green, white) */
const RED = '#FF0000';
const GREEN = '#008000';
const WHITE = '#FFFFFF';

type Ohlc = (k: number) => number;
interface Pattern {
  title: string;
  text: string;
  bullish: boolean;
  /** The Doji is a white circle below the bar */
  circle?: boolean;
  cond: (o: Ohlc, h: Ohlc, l: Ohlc, c: Ohlc) => boolean;
}

/** The 33 plotshape outputs of the original, in declaration order (ids shape0 .. shape32) */
const PATTERNS: Pattern[] = (() => {
  // abs(close[k]-open[k])/(high[k]-low[k]) (x / 0 is +-infinity, 0 / 0 na)
  const r = (o: Ohlc, h: Ohlc, l: Ohlc, c: Ohlc, k: number) => Math.abs(c(k) - o(k)) / (h(k) - l(k));
  const body = (o: Ohlc, c: Ohlc, k: number) => Math.abs(c(k) - o(k));
  const upper = (o: Ohlc, h: Ohlc, c: Ohlc, k: number) => h(k) - Math.max(c(k), o(k));
  const lower = (o: Ohlc, l: Ohlc, c: Ohlc, k: number) => Math.min(c(k), o(k)) - l(k);
  const data1: Pattern['cond'] = (o, h, l, c) => gt(c(1), o(1)) && ge(r(o, h, l, c, 1), 0.7) && lt(c(0), o(0))
    && ge(r(o, h, l, c, 0), 0.7) && ge(o(0), c(1)) && gt(c(0), o(1)) && lt(c(0), (o(1) + c(1)) / 2);
  const data31: Pattern['cond'] = (o, h, l, c) => gt(c(1), o(1)) && gt(0.3, r(o, h, l, c, 1)) && lt(c(0), o(0))
    && ge(r(o, h, l, c, 0), 0.7) && lt(h(1), o(0)) && gt(l(1), c(0));
  return [
    { title: 'Dark Cloud Cover', text: 'DarkCloudCover', bullish: false, cond: data1 },
    { title: 'Doji', text: 'Doji', bullish: true, circle: true, cond: (o, h, l, c) => lt(r(o, h, l, c, 0), 0.1)
      && gt(upper(o, h, c, 0), 3 * body(o, c, 0)) && gt(lower(o, l, c, 0), 3 * body(o, c, 0)) },
    { title: 'Doji Star', text: 'DojiStar', bullish: false, cond: (o, h, l, c) => gt(c(1), o(1))
      && ge(r(o, h, l, c, 1), 0.7) && lt(r(o, h, l, c, 0), 0.1) && lt(c(1), c(0)) && lt(c(1), o(0))
      && gt(upper(o, h, c, 0), 3 * body(o, c, 0)) && gt(lower(o, l, c, 0), 3 * body(o, c, 0)) },
    { title: 'Dragonfly Doji', text: 'DragonflyDoji', bullish: true, cond: (o, h, l, c) => lt(r(o, h, l, c, 0), 0.1)
      && gt(lower(o, l, c, 0), 3 * body(o, c, 0)) && lt(upper(o, h, c, 0), body(o, c, 0)) },
    { title: 'Evening Star', text: 'EveningStar', bullish: false, cond: (o, h, l, c) => gt(c(2), o(2))
      && ge(r(o, h, l, c, 2), 0.7) && gt(0.3, r(o, h, l, c, 1)) && lt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7)
      && lt(c(2), c(1)) && lt(c(2), o(1)) && gt(c(1), o(0)) && gt(o(1), o(0)) && lt(c(0), c(2)) },
    { title: 'Evening Star Doji', text: 'EveningStarDoji', bullish: false, cond: (o, h, l, c) => gt(c(2), o(2))
      && ge(r(o, h, l, c, 2), 0.7) && lt(r(o, h, l, c, 1), 0.1) && lt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7)
      && lt(c(2), c(1)) && lt(c(2), o(1)) && gt(c(1), o(0)) && gt(o(1), o(0)) && lt(c(0), c(2))
      && gt(upper(o, h, c, 1), 3 * body(o, c, 1)) && gt(lower(o, l, c, 1), 3 * body(o, c, 1)) },
    { title: 'Gravestone Doji', text: 'GravestoneDoji', bullish: false, cond: (o, h, l, c) => lt(r(o, h, l, c, 0), 0.1)
      && gt(upper(o, h, c, 0), 3 * body(o, c, 0)) && le(lower(o, l, c, 0), body(o, c, 0)) },
    { title: 'Hanging Man Red', text: 'HangingMan', bullish: false, cond: (o, h, l, c) => lt(c(0), o(0))
      && gt(0.3, r(o, h, l, c, 0)) && ge(lower(o, l, c, 0), 2 * body(o, c, 0)) && gt(upper(o, h, c, 0), 0.25 * body(o, c, 0)) },
    { title: 'Hanging Man Green', text: 'HangingMan', bullish: false, cond: (o, h, l, c) => gt(c(0), o(0))
      && gt(0.3, r(o, h, l, c, 0)) && ge(lower(o, l, c, 0), 2 * body(o, c, 0)) && gt(upper(o, h, c, 0), 0.25 * body(o, c, 0)) },
    { title: 'Morning Star', text: 'MorningStar', bullish: true, cond: (o, h, l, c) => lt(c(2), o(2))
      && ge(r(o, h, l, c, 2), 0.7) && gt(0.3, r(o, h, l, c, 1)) && gt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7)
      && gt(c(2), c(1)) && gt(c(2), o(1)) && lt(c(1), o(0)) && lt(o(1), o(0)) && gt(c(0), c(2)) },
    { title: 'Morning Star Doji', text: 'MorningStarDoji', bullish: true, cond: (o, h, l, c) => lt(c(2), o(2))
      && ge(r(o, h, l, c, 2), 0.7) && lt(r(o, h, l, c, 1), 0.1) && gt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7)
      && gt(c(2), c(1)) && gt(c(2), o(1)) && lt(c(1), o(0)) && lt(o(1), o(0)) && gt(c(0), c(2))
      && gt(upper(o, h, c, 1), 3 * body(o, c, 1)) && gt(lower(o, l, c, 1), 3 * body(o, c, 1)) },
    { title: 'Piercieng Pattern', text: 'PiercingPattern', bullish: true, cond: (o, h, l, c) => lt(c(1), o(1))
      && ge(r(o, h, l, c, 1), 0.7) && gt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7) && le(o(0), c(1))
      && lt(c(0), o(1)) && lt(c(0), (o(1) + c(1)) / 2) },
    { title: 'Raindrop', text: 'Raindrop', bullish: true, cond: (o, h, l, c) => lt(c(1), o(1))
      && ge(r(o, h, l, c, 1), 0.7) && gt(0.3, r(o, h, l, c, 0)) && gt(c(1), c(0)) && gt(c(1), o(0)) },
    { title: 'Raindrop Doji', text: 'RaindropDoji', bullish: true, cond: (o, h, l, c) => lt(c(1), o(1))
      && ge(r(o, h, l, c, 1), 0.7) && lt(r(o, h, l, c, 0), 0.1) && gt(c(1), c(0)) && gt(c(1), o(0))
      && gt(upper(o, h, c, 0), 3 * body(o, c, 0)) && gt(lower(o, l, c, 0), 3 * body(o, c, 0)) },
    { title: 'Inverted Hammer Red', text: 'InvertedHammer', bullish: true, cond: (o, h, l, c) => lt(c(0), o(0))
      && gt(0.3, r(o, h, l, c, 0)) && ge(upper(o, h, c, 0), 2 * body(o, c, 0)) && le(lower(o, l, c, 0), 0.25 * body(o, c, 0)) },
    { title: 'Inverted Hammer Green', text: 'InvertedHammer', bullish: true, cond: (o, h, l, c) => gt(c(0), o(0))
      && gt(0.3, r(o, h, l, c, 0)) && ge(upper(o, h, c, 0), 2 * body(o, c, 0)) && le(lower(o, l, c, 0), 0.25 * body(o, c, 0)) },
    { title: 'Star', text: 'Star', bullish: false, cond: (o, h, l, c) => gt(c(1), o(1)) && ge(r(o, h, l, c, 1), 0.7)
      && gt(0.3, r(o, h, l, c, 0)) && lt(c(1), c(0)) && lt(c(1), o(0)) },
    { title: 'Bearish Thrusting', text: 'BearishThrusting', bullish: false, cond: (o, h, l, c) => gt(c(1), o(1))
      && ge(r(o, h, l, c, 1), 0.7) && lt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7) && ge(o(0), c(1))
      && lt(c(0), c(1)) && ge(c(0), (o(1) + c(1)) / 2) },
    { title: 'Bullish Thrusting Pattern', text: 'BullishThrusting', bullish: true, cond: (o, h, l, c) => lt(c(1), o(1))
      && ge(r(o, h, l, c, 1), 0.7) && gt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7) && le(o(0), c(1))
      && gt(c(0), c(1)) && le(c(0), (o(1) + c(1)) / 2) },
    { title: 'Tweezers Bottom', text: 'TweezersBottom', bullish: true, cond: (o, h, l, c) => lt(c(1), o(1))
      && ge(r(o, h, l, c, 1), 0.7) && lt(c(0), o(0)) && gt(0.3, r(o, h, l, c, 0))
      && lt(Math.abs(l(0) / l(1) - 1), 0.05) && lt(body(o, c, 0), 2 * lower(o, l, c, 0)) },
    { title: 'Tweezers Top', text: 'TweezersTop', bullish: false, cond: (o, h, l, c) => gt(c(1), o(1))
      && ge(r(o, h, l, c, 1), 0.7) && gt(c(0), o(0)) && gt(0.3, r(o, h, l, c, 0))
      && lt(Math.abs(h(0) / h(1) - 1), 0.05) && lt(body(o, c, 1), 2 * upper(o, h, c, 1)) },
    { title: 'Tower Bottom', text: 'TowerBottom', bullish: true, cond: (o, h, l, c) => lt(c(3), o(3))
      && ge(r(o, h, l, c, 3), 0.7) && gt(c(2), o(2)) && gt(0.3, r(o, h, l, c, 2)) && gt(c(1), o(1))
      && gt(0.3, r(o, h, l, c, 1)) && gt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7) && gt(c(2), c(1))
      && gt(c(1), c(3)) && lt(o(2), c(3)) && lt(o(1), c(3)) && gt(c(0), (o(3) + c(3)) / 2) },
    { title: 'Tower Top', text: 'TowerTop', bullish: false, cond: (o, h, l, c) => gt(c(3), o(3))
      && ge(r(o, h, l, c, 3), 0.7) && lt(c(2), o(2)) && gt(0.3, r(o, h, l, c, 2)) && lt(c(1), o(1))
      && gt(0.3, r(o, h, l, c, 1)) && lt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7) && lt(c(2), c(1))
      && lt(c(1), c(3)) && gt(o(2), c(3)) && gt(o(1), c(3)) && lt(c(0), (o(3) + c(3)) / 2) },
    { title: 'Bullish In Neck', text: 'BullishInNeck', bullish: true, cond: (o, h, l, c) => lt(c(1), o(1))
      && gt(0.7, r(o, h, l, c, 1)) && gt(c(0), o(0)) && gt(0.7, r(o, h, l, c, 0)) && le(c(0), c(1)) && gt(c(0), l(1)) },
    { title: 'Bearish In Neck', text: 'BearishInNeck', bullish: false, cond: (o, h, l, c) => gt(c(1), o(1))
      && gt(0.7, r(o, h, l, c, 1)) && lt(c(0), o(0)) && gt(0.7, r(o, h, l, c, 0)) && ge(c(0), c(1)) && lt(c(0), h(1)) },
    { title: 'Bullish Separating Lines', text: 'BullishSeparatingLines', bullish: true, cond: (o, h, l, c) => gt(c(1), o(1))
      && gt(0.7, r(o, h, l, c, 1)) && lt(c(0), o(0)) && gt(0.7, r(o, h, l, c, 0)) && le(o(0), o(1)) && gt(o(0), l(1)) },
    { title: 'Bearish Separating Lines', text: 'BearishSeparatingLines', bullish: false, cond: (o, h, l, c) => lt(c(1), o(1))
      && gt(0.7, r(o, h, l, c, 1)) && gt(c(0), o(0)) && gt(0.7, r(o, h, l, c, 0)) && ge(o(0), o(1)) && lt(o(0), h(1)) },
    { title: 'Bullish Harami', text: 'BullishHarami', bullish: true, cond: (o, h, l, c) => lt(c(1), o(1))
      && ge(r(o, h, l, c, 1), 0.7) && gt(0.3, r(o, h, l, c, 0)) && lt(h(0), o(1)) && gt(l(0), c(1)) },
    { title: 'Bearish Harami', text: 'BearishHarami', bullish: false, cond: (o, h, l, c) => gt(c(1), o(1))
      && ge(r(o, h, l, c, 1), 0.7) && gt(0.3, r(o, h, l, c, 0)) && lt(h(0), c(1)) && gt(l(0), o(1)) },
    { title: 'Bullish Engulfing', text: 'BullishEngulfing', bullish: true, cond: (o, h, l, c) => lt(c(1), o(1))
      && gt(0.3, r(o, h, l, c, 1)) && gt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7) && lt(h(1), c(0)) && gt(l(1), o(0)) },
    { title: 'Bearish Engulfing', text: 'BearishEngulfing', bullish: false, cond: data31 },
    { title: 'Doji Bullish Engulfing', text: 'DojiBullishEngulfing', bullish: true, cond: (o, h, l, c) => lt(r(o, h, l, c, 1), 0.1)
      && gt(c(0), o(0)) && ge(r(o, h, l, c, 0), 0.7) && lt(h(1), c(0)) && gt(l(1), o(0))
      && gt(upper(o, h, c, 1), 3 * body(o, c, 1)) && le(lower(o, l, c, 1), body(o, c, 1)) },
    // plotshape(data31, title = "Doji Bearish Engulfing", ...): the original plots data31 (data33 is unused)
    { title: 'Doji Bearish Engulfing', text: 'DojiBearishEngulfing', bullish: false, cond: data31 },
  ];
})();

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface AcpRun extends BarRunState<Record<string, never>> {
  closePlot: { time: number; value: number }[];
  markers: MarkerData[];
}

function study(): BarStudy<AcpRun, Result> {
  return {
    init() {
      const s: AcpRun = { closePlot: [], markers: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.closePlot];
      return s;
    },
    bar(s, i, bars) {
      s.closePlot[i] = { time: bars[i].time, value: NaN };
      const at = (k: number, f: 'open' | 'high' | 'low' | 'close') => (i - k >= 0 ? bars[i - k][f] : NaN);
      const o: Ohlc = (k) => at(k, 'open');
      const h: Ohlc = (k) => at(k, 'high');
      const l: Ohlc = (k) => at(k, 'low');
      const c: Ohlc = (k) => at(k, 'close');
      PATTERNS.forEach((p, k) => {
        if (!p.cond(o, h, l, c)) return;
        // plotshape(dataK, title, text, color = red / green / white, style = arrowdown / arrowup / circle,
        //           location = abovebar / belowbar)
        s.markers.push(p.circle
          ? { id: `shape${k}`, time: bars[i].time, position: 'belowBar', shape: 'circle', color: WHITE, text: p.text }
          : {
            id: `shape${k}`, time: bars[i].time, position: p.bullish ? 'belowBar' : 'aboveBar',
            shape: p.bullish ? 'arrowUp' : 'arrowDown', color: p.bullish ? GREEN : RED, text: p.text,
          });
      });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.closePlot.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<AllCandlestickPatternsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<AllCandlestickPatternsInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const AllCandlestickPatterns = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
