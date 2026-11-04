/**
 * Horns Pattern Identifier
 *
 * Finds three-bar horn patterns. The distance between the first and the third high (low) of the last three bars,
 * divided by the three-bar range, is the normalized distance; a horn forms when it crosses under the threshold
 * while the middle bar sits below both outer highs (inverted horn, bearish) or above both outer lows (horn,
 * bullish). Each pattern draws the line between its two horn tops (bottoms), a dotted confirmation level at the
 * three-bar low (high) and a dashed take-profit level one range further; the two levels extend bar by bar until
 * the next pattern. A close crossing the confirmation level in the pattern's direction prints a "B" / "S" label
 * once per level.
 *
 * Reference: "Horns Pattern Identifier [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International
 * (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/ © LuxAlgo
 */

import {
  ta, line, resetDrawings, setDrawingBar, varDrawing, drawingOutputs, Series,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type Line,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';

export interface HornsPatternIdentifierInputs {
  /** Threshold of the normalized distance between the two horns */
  threshold: number;
  /** Bullish Horn Levels colour */
  bull_css: string;
  /** Bearish Horn Levels colour */
  bear_css: string;
}

export const defaultInputs: HornsPatternIdentifierInputs = {
  threshold: 0.05,
  bull_css: '#0cb51a',
  bear_css: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  { id: 'threshold', type: 'float', title: 'threshold', defval: 0.05, min: 0, step: 0.01 },
  { id: 'bull_css', type: 'color', title: 'Bullish Horn Levels', defval: '#0cb51a', group: 'Style' },
  { id: 'bear_css', type: 'color', title: 'Bearish Horn Levels', defval: '#ff1100', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [];

const BUY = '#0cb51a';
const SELL = '#ff1100';
const WHITE = '#FFFFFF';

export const shapeConfig: ShapeConfig[] = [
  {
    id: 'shape0', kind: 'shape', title: 'Buy Label', style: 'labelup', location: 'absolute', color: BUY, text: 'B',
    textcolor: WHITE, size: 'tiny',
  },
  {
    id: 'shape1', kind: 'shape', title: 'Sell Label', style: 'labeldown', location: 'absolute', color: SELL, text: 'S',
    textcolor: WHITE, size: 'tiny',
  },
];

export const drawingKinds: StudyDrawingKind[] = ['line'];

export const metadata = {
  title: 'Horns Pattern Identifier [LuxAlgo]',
  shortTitle: 'Horns Pattern Identifier [LuxAlgo]',
  overlay: true,
};

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const gt = (a: number, b: number) => a - b > EPS;
const neq = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > EPS;
/** Pine math.max / math.min: na when an argument is na */
const max3 = (a: number, b: number, c: number) => (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) ? NaN : Math.max(a, b, c));
const min3 = (a: number, b: number, c: number) => (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) ? NaN : Math.min(a, b, c));
const min2 = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.min(a, b));
const max2 = (a: number, b: number) => (Number.isNaN(a) || Number.isNaN(b) ? NaN : Math.max(a, b));

export function calculate(bars: Bar[], inputs: Partial<HornsPatternIdentifierInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const close = bars.map((b) => b.close);
  const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);

  // rolling max / min of 3 bars and the normalized distances (x / 0 is +-infinity, 0 / 0 na)
  const mx = high.map((_h, i) => max3(high[i], at(high, i - 1), at(high, i - 2)));
  const mn = low.map((_l, i) => min3(low[i], at(low, i - 1), at(low, i - 2)));
  const top = high.map((h, i) => Math.abs(h - at(high, i - 2)) / (mx[i] - mn[i]));
  const btm = low.map((l, i) => Math.abs(l - at(low, i - 2)) / (mx[i] - mn[i]));
  const thr = bars.map(() => cfg.threshold);
  const S = (v: number[]) => Series.fromArray(bars, v);
  const topCross = ta.crossunder(S(top), S(thr)).toArray();
  const btmCross = ta.crossunder(S(btm), S(thr)).toArray();

  resetDrawings({ line: 500 });
  const conf = varDrawing<Line>();
  const tp = varDrawing<Line>();
  let target = 0;
  let lvl = 0;
  let os = 0;
  let cross = NaN;
  const lvlHist: number[] = [];
  const markers: MarkerData[] = [];
  let prevClose = NaN;
  let prevLvl = NaN;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    if (conf.value) line.set_x2(conf.value, i);
    if (tp.value) line.set_x2(tp.value, i);

    // Inverted horn
    if (topCross[i] && lt(at(high, i - 1), min2(high[i], at(high, i - 2)))) {
      os = 0;
      if (conf.value) line.set_x2(conf.value, i - 2);
      if (tp.value) line.set_x2(tp.value, i - 2);
      line.new(i, high[i], i - 2, at(high, i - 2), 'bar_index', 'none', cfg.bear_css);
      lvl = mn[i];
      target = mn[i] - (mx[i] - mn[i]);
      conf.value = line.new(i, lvl, i + 1, lvl, 'bar_index', 'none', cfg.bear_css, 'dotted');
      tp.value = line.new(i, target, i + 1, target, 'bar_index', 'none', cfg.bear_css, 'dashed');
    }
    // Horn
    if (btmCross[i] && gt(at(low, i - 1), max2(low[i], at(low, i - 2)))) {
      os = 1;
      if (conf.value) line.set_x2(conf.value, i - 2);
      if (tp.value) line.set_x2(tp.value, i - 2);
      line.new(i, low[i], i - 2, at(low, i - 2), 'bar_index', 'none', cfg.bull_css);
      lvl = mx[i];
      target = mx[i] + (mx[i] - mn[i]);
      conf.value = line.new(i, lvl, i + 1, lvl, 'bar_index', 'none', cfg.bull_css, 'dotted');
      tp.value = line.new(i, target, i + 1, target, 'bar_index', 'none', cfg.bull_css, 'dashed');
    }
    lvlHist.push(lvl);

    // ta.crossover(close, lvl) / ta.crossunder(close, lvl): exact comparisons with the bar before
    const up = i > 0 && close[i] > lvl && prevClose <= prevLvl;
    const dn = i > 0 && close[i] < lvl && prevClose >= prevLvl;
    const buy = up && os === 1 && cross === 1;
    const sell = dn && os === 0 && cross === 1;
    // cross := lvl != lvl[1] ? 1 : buy or sell ? 0 : cross[1] (lvl[1] is na on the first bar)
    cross = neq(lvl, i > 0 ? lvlHist[i - 1] : NaN) ? 1 : buy || sell ? 0 : cross;
    prevClose = close[i];
    prevLvl = lvl;

    if (buy && !Number.isNaN(low[i])) {
      markers.push({
        id: 'shape0', time: bars[i].time, position: 'atPriceBottom', price: low[i], shape: 'labelUp', color: BUY,
        text: 'B', textColor: WHITE, size: 'tiny',
      });
    }
    if (sell && !Number.isNaN(high[i])) {
      markers.push({
        id: 'shape1', time: bars[i].time, position: 'atPriceTop', price: high[i], shape: 'labelDown', color: SELL,
        text: 'S', textColor: WHITE, size: 'tiny',
      });
    }
  }
  setDrawingBar(null);


  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    ...drawingOutputs(bars),
  };
}

export const HornsPatternIdentifier = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, drawingKinds,
};
