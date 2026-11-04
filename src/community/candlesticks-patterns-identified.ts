/**
 * Candlesticks Patterns Identified
 *
 * Marks 9 candlestick patterns: Doji (a star with the text "Doji" when the body is at most `dojiSize` of the range),
 * Bearish / Bullish Harami, Bearish / Bullish Engulfing, Piercing Line, Bullish Belt (open = low under the lowest low
 * of the 10 previous bars), Bullish Kicker and Bearish Kicker. All patterns but the Doji also need a trend: the open
 * `trend` bars back above (bullish) or below (bearish) the open. Bullish patterns are arrows below the bar, bearish
 * patterns arrows above the bar. The original is a Pine v1 study: the shape colours carry the default transparency
 * 35 of that version. The script sets no text colour: the markers carry the default text colour (blue).
 *
 * Reference: "Candlesticks Patterns Identified" by repo32
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created by Robert N. 030715
 */

import {
  ta, Series, color,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CandlesticksPatternsIdentifiedInputs {
  /** Trend in bars: the open this many bars back is compared with the open */
  trend: number;
  /** Doji size: largest body as a fraction of the bar range */
  dojiSize: number;
}

export const defaultInputs: CandlesticksPatternsIdentifiedInputs = {
  trend: 5,
  dojiSize: 0.05,
};

export const inputConfig: InputConfig[] = [
  { id: 'trend', type: 'int', title: 'Trend in Bars', defval: 5, min: 1 },
  { id: 'dojiSize', type: 'float', title: 'Doji size', defval: 0.05, min: 0.01 },
];

/** No plot(): the outputs are the markers of the plotchar and the 8 plotshape calls */
export const plotConfig: PlotConfig[] = [];

/** Pine v1 white / red / lime with the default shape transparency 35 */
const WHITE = String(color.new('#FFFFFF', 35));
const RED = String(color.new('#FF0000', 35));
const LIME = String(color.new('#00FF00', 35));
/** Pine default text colour (color.blue) */
const TEXT = '#2962FF';
const STAR = '★';

export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'Doji', char: STAR, location: 'abovebar', color: WHITE, text: 'Doji' },
  { id: 'shape0', kind: 'shape', title: 'Bearish Harami', style: 'arrowdown', location: 'abovebar', color: RED, text: 'Bearish\nHarami' },
  { id: 'shape1', kind: 'shape', title: 'Bullish Harami', style: 'arrowup', location: 'belowbar', color: LIME, text: 'Bullish\nHarami' },
  { id: 'shape2', kind: 'shape', title: 'Bearish Engulfing', style: 'arrowdown', location: 'abovebar', color: RED, text: 'Bearish\nEngulfing' },
  { id: 'shape3', kind: 'shape', title: 'Bullish Engulfing', style: 'arrowup', location: 'belowbar', color: LIME, text: 'Bullish\nEngulfling' },
  { id: 'shape4', kind: 'shape', title: 'Piercing Line', style: 'arrowup', location: 'belowbar', color: LIME, text: 'Piercing\nLine' },
  { id: 'shape5', kind: 'shape', title: 'Bullish Belt', style: 'arrowup', location: 'belowbar', color: LIME, text: 'Bullish\nBelt' },
  { id: 'shape6', kind: 'shape', title: 'Bullish Kicker', style: 'arrowup', location: 'belowbar', color: LIME, text: 'Bullish\nKicker' },
  { id: 'shape7', kind: 'shape', title: 'Bearish Kicker', style: 'arrowdown', location: 'abovebar', color: RED, text: 'Bearish\nKicker' },
];

export const metadata = {
  title: 'Candles',
  shortTitle: 'Candles',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<CandlesticksPatternsIdentifiedInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const { trend, dojiSize } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  // lowest(10): lowest low of 10 bars
  const lowest10 = ta.lowest(new Series(bars, (b) => b.low), 10).toArray().map((v) => v ?? NaN);

  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    const { open, high, low, close, time } = bars[i];
    const p1 = i >= 1 ? bars[i - 1] : null;
    const open1 = p1 ? p1.open : NaN;
    const close1 = p1 ? p1.close : NaN;
    const high1 = p1 ? p1.high : NaN;
    const low1 = p1 ? p1.low : NaN;
    const openT = i >= trend ? bars[i - trend].open : NaN; // open[trend]
    const shape = (k: number, bull: boolean, text: string, on: boolean) => {
      if (!on) return;
      markers.push(bull
        ? { id: `shape${k}`, time, position: 'belowBar', shape: 'arrowUp', color: LIME, text, textColor: TEXT, size: 'auto' }
        : { id: `shape${k}`, time, position: 'aboveBar', shape: 'arrowDown', color: RED, text, textColor: TEXT, size: 'auto' });
    };

    // plotchar(data, title="Doji", text='Doji', color=white): default char and location.abovebar
    if (le(Math.abs(open - close), (high - low) * dojiSize)) {
      markers.push({ id: 'char0', time, position: 'aboveBar', shape: 'circle', char: STAR, color: WHITE, text: 'Doji', textColor: TEXT, size: 'auto' });
    }

    shape(0, false, 'Bearish\nHarami', gt(close1, open1) && gt(open, close) && le(open, close1) && le(open1, close)
      && lt(open - close, close1 - open1) && lt(openT, open));
    shape(1, true, 'Bullish\nHarami', gt(open1, close1) && gt(close, open) && le(close, open1) && le(close1, open)
      && lt(close - open, open1 - close1) && gt(openT, open));
    shape(2, false, 'Bearish\nEngulfing', gt(close1, open1) && gt(open, close) && ge(open, close1) && ge(open1, close)
      && gt(open - close, close1 - open1) && lt(openT, open));
    // The Pine text is "Bullish\nEngulfling"
    shape(3, true, 'Bullish\nEngulfling', gt(open1, close1) && gt(close, open) && ge(close, open1) && ge(close1, open)
      && gt(close - open, open1 - close1) && gt(openT, open));
    shape(4, true, 'Piercing\nLine', lt(close1, open1) && lt(open, low1) && gt(close, close1 + (open1 - close1) / 2)
      && lt(close, open1) && gt(openT, open));
    // lower = lowest(10)[1]
    const lower = i >= 1 ? lowest10[i - 1] : NaN;
    shape(5, true, 'Bullish\nBelt', eq(low, open) && lt(open, lower) && lt(open, close)
      && gt(close, (high1 - low1) / 2 + low1) && gt(openT, open));
    shape(6, true, 'Bullish\nKicker', gt(open1, close1) && ge(open, open1) && gt(close, open) && gt(openT, open));
    shape(7, false, 'Bearish\nKicker', lt(open1, close1) && le(open, open1) && le(close, open) && lt(openT, open));
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const CandlesticksPatternsIdentified = { calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig };
