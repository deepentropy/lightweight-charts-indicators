/**
 * Dynamic Support/Resistance Zones [ChartPrime]
 *
 * The prices of the last "Number of Pivots" pivot highs and pivot lows (pivot lengths 1 to 4, each one optional)
 * are counted in bins between the lowest and the highest of them ("Manual Precision" bins; with the precision box
 * off, the range divided by the average bar range, 10 to 100 bins). Each pivot adds its weight to its bin: 1
 * ("Linear"), its age rank ("Time": 1 + its bar - the oldest stored bar) or its volume ("Volume"). The bin scores are
 * smoothed with a sinc filter ("Filtering"; bandwidth filter + 1) and scaled to 1 .. "Distribution Scale". The
 * local maxima of the scaled scores are the support / resistance levels: a line from 3 bars after the bar (green
 * below the close, red above it), extended to the left, with an optional zone box of the bin. A bounce marker (a dot)
 * is drawn on each of the last "Show Bounces" bars whose wick or body rejects a level. The distribution is drawn to
 * the right of the bars as boxes (gradient from "Low Color" to "High Color", the score as text) and as a transparent
 * overlay extended to the left. The "Pivot Level Average" option plots the score-weighted average price of the bins
 * (an SMA of "MA" + 1 calls) with a glow of +- half the average bar range.
 *
 * The drawings are deleted and drawn again on each confirmed bar: on a live last bar (chart context
 * `lastBarConfirmed` false) they stay those of the bar before, and "Calculate on Real Time Only" computes on that
 * live bar only (no drawing). Only the drawings of the last confirmed bar survive, so the port draws on the last two
 * bars only (same objects).
 *
 * Reference: "Dynamic Support/Resistance Zones [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, color, callsite, Series, line, box, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type Box, type FillConfig, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';

type WeightStyle = 'Linear' | 'Time' | 'Volume';

export interface DynamicSupportResistanceZonesInputs {
  weight_style: WeightStyle;
  pivot_lookback: number;
  filter: number;
  precision: number;
  /** Manual precision box (on: "Manual Precision" bins; off: automatic precision) */
  manual_precision: boolean;
  real_time_only: boolean;
  length_1: number;
  include_5: boolean;
  length_2: number;
  include_10: boolean;
  length_3: number;
  include_20: boolean;
  length_4: number;
  include_50: boolean;
  include_ph: boolean;
  include_pl: boolean;
  show_lines: boolean;
  show_hits: boolean;
  hit_lookback: number;
  show_zone: boolean;
  zone_alpha: number;
  support_color: string;
  resistance_color: string;
  show_dist: boolean;
  show_score: boolean;
  scale: number;
  heat_map: boolean;
  heat_alpha: number;
  high_color: string;
  low_color: string;
  txt_color: string;
  enable_ma: boolean;
  /** MA smoothing (the original adds 1) */
  ma_smoothing: number;
  ma_color: string;
}

export const defaultInputs: DynamicSupportResistanceZonesInputs = {
  weight_style: 'Linear',
  pivot_lookback: 50,
  filter: 3,
  precision: 75,
  manual_precision: true,
  real_time_only: false,
  length_1: 5,
  include_5: true,
  length_2: 10,
  include_10: true,
  length_3: 20,
  include_20: true,
  length_4: 50,
  include_50: true,
  include_ph: true,
  include_pl: true,
  show_lines: true,
  show_hits: true,
  hit_lookback: 100,
  show_zone: false,
  zone_alpha: 88,
  support_color: '#00FF00',
  resistance_color: '#FF0000',
  show_dist: true,
  show_score: true,
  scale: 30,
  heat_map: true,
  heat_alpha: 85,
  high_color: '#00FFFF',
  low_color: '#FF00FF',
  txt_color: '#111111',
  enable_ma: false,
  ma_smoothing: 12,
  ma_color: '#5536E4',
};

const G_SET = 'Settings';
const G_PIV = 'Pivots';
const G_SR = 'Support/Resistance';
const G_DIST = 'Distribution';
const G_MA = 'Moving Average';

export const inputConfig: InputConfig[] = [
  {
    id: 'weight_style', type: 'string', title: 'Weighting', defval: 'Linear', options: ['Linear', 'Time', 'Volume'], group: G_SET,
    tooltip: ' Linear: Each pivot in is treated equally.\n\n Time: Newer pivots will have a greater impact.\n\n Volume: Each pivot will be scored based on its volume.',
  },
  {
    id: 'pivot_lookback', type: 'int', title: 'Number of Pivots', defval: 50, min: 1, group: G_SET,
    tooltip: 'The number of pivots to take into account. Pivot high and low are treated separately so you will have that number of each.',
  },
  {
    id: 'filter', type: 'float', title: 'Filtering', defval: 3, min: 0, max: 12, group: G_SET,
    tooltip: 'When this is greater than 0 it will smooth the distribution of pivots. This can provide a smoother picture at the price of accuracy.',
  },
  {
    id: 'precision', type: 'int', title: 'Manual Precision', defval: 75, min: 3, inline: 'Precision', group: G_SET,
    tooltip: 'Use this to manually set the number of divisions of the range.',
  },
  {
    id: 'manual_precision', type: 'bool', title: '', defval: true, inline: 'Precision', group: G_SET,
    tooltip: 'Use the average range of a candle to divide the range with a minimum of 10.',
  },
  { id: 'real_time_only', type: 'bool', title: 'Calculate on Real Time Only', defval: false, group: G_SET },
  { id: 'length_1', type: 'int', title: 'Length 1', defval: 5, min: 1, inline: 'Length_1', group: G_PIV },
  { id: 'include_5', type: 'bool', title: '', defval: true, inline: 'Length_1', group: G_PIV },
  { id: 'length_2', type: 'int', title: 'Length 2', defval: 10, min: 2, inline: 'Length_2', group: G_PIV },
  { id: 'include_10', type: 'bool', title: '', defval: true, inline: 'Length_2', group: G_PIV },
  { id: 'length_3', type: 'int', title: 'Length 3', defval: 20, min: 3, inline: 'Length_3', group: G_PIV },
  { id: 'include_20', type: 'bool', title: '', defval: true, inline: 'Length_3', group: G_PIV },
  { id: 'length_4', type: 'int', title: 'Length 4', defval: 50, min: 4, inline: 'Length_4', group: G_PIV },
  { id: 'include_50', type: 'bool', title: '', defval: true, inline: 'Length_4', group: G_PIV },
  { id: 'include_ph', type: 'bool', title: 'Include Pivot High', defval: true, group: G_PIV },
  { id: 'include_pl', type: 'bool', title: 'Include Pivot Low', defval: true, group: G_PIV },
  { id: 'show_lines', type: 'bool', title: 'Show Support/Resistance', defval: true, group: G_SR },
  { id: 'show_hits', type: 'bool', title: 'Show Bounces', defval: true, inline: 'Bounce', group: G_SR },
  { id: 'hit_lookback', type: 'int', title: '', defval: 100, min: 1, inline: 'Bounce', group: G_SR },
  { id: 'show_zone', type: 'bool', title: 'Show S/R Zone', defval: false, inline: 'Zone', group: G_SR },
  { id: 'zone_alpha', type: 'int', title: '', defval: 88, min: 0, max: 100, inline: 'Zone', group: G_SR },
  { id: 'support_color', type: 'color', title: 'Support Color', defval: '#00FF00', group: G_SR },
  { id: 'resistance_color', type: 'color', title: 'Resistance Color', defval: '#FF0000', group: G_SR },
  { id: 'show_dist', type: 'bool', title: 'Show Distribution', defval: true, group: G_DIST },
  { id: 'show_score', type: 'bool', title: 'Show Score in Distribution', defval: true, group: G_DIST },
  {
    id: 'scale', type: 'int', title: 'Distribution Scale', defval: 30, min: 5, group: G_DIST,
    tooltip: "This scales the distribution's size on the screen. It also impacts the precision of the calculations.",
  },
  { id: 'heat_map', type: 'bool', title: 'Show Distribution Overlay', defval: true, inline: 'MAP', group: G_DIST },
  { id: 'heat_alpha', type: 'int', title: '', defval: 85, min: 0, max: 100, inline: 'MAP', group: G_DIST },
  { id: 'high_color', type: 'color', title: 'High Color', defval: '#00FFFF', group: G_DIST },
  { id: 'low_color', type: 'color', title: 'Low Color', defval: '#FF00FF', group: G_DIST },
  { id: 'txt_color', type: 'color', title: 'Text Color', defval: '#111111', group: G_DIST },
  {
    id: 'enable_ma', type: 'bool', title: 'Pivot Level Average', defval: false, inline: 'MA', group: G_MA,
    tooltip: 'Show an average price weighted by the pivot points.',
  },
  { id: 'ma_smoothing', type: 'int', title: '', defval: 12, min: 0, max: 200, inline: 'MA', group: G_MA },
  { id: 'ma_color', type: 'color', title: 'MA Color', defval: '#5536E4', group: G_MA },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#5536E4', lineWidth: 2 },
  { id: 'plot1', title: 'MA Top', color: 'rgba(85, 54, 228, 0)', lineWidth: 1, display: 'data_window' },
  { id: 'plot2', title: 'MA Bottom', color: 'rgba(85, 54, 228, 0)', lineWidth: 1, display: 'data_window' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Glow Top' },
  { id: 'fill1', plot1: 'plot0', plot2: 'plot2', title: 'Glow Bottom' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'box', 'label'];

export const metadata = {
  title: 'Dynamic Support/Resistance Zones [ChartPrime]',
  shortTitle: 'Dynamic Support/Resistance Zones [ChartPrime]',
  overlay: true,
};

const MAX_OBJECTS = 500;

/** Pine float comparisons (1e-10; na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const le = (a: number, b: number) => b - a > -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** int == / != of int() values (na compares false) */
const ieq = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a === b;
const ine = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a !== b;

/** array.max / array.min of a float array (na when empty) */
const arrMax = (a: number[]) => (a.length === 0 ? NaN : Math.max(...a));
const arrMin = (a: number[]) => (a.length === 0 ? NaN : Math.min(...a));

/** sinc(source, bandwidth) */
function sinc(x: number, bandwidth: number): number {
  if (eq(x, 0)) return 1;
  return Math.sin((Math.PI * x) / bandwidth) / ((Math.PI * x) / bandwidth);
}

/** sinc_filter(source, length): the weights of a bandwidth are kept by distance (same values) */
function sincFilter(source: number[], length: number, cache: Map<number, number>): number[] {
  if (!(gt(length, 0) && source.length > 0)) return source;
  const size = source.length;
  const out = new Array<number>(size);
  const w = (d: number) => {
    let v = cache.get(d);
    if (v === undefined) {
      v = sinc(d, length + 1);
      cache.set(d, v);
    }
    return v;
  };
  for (let i = 0; i < size; i++) {
    let sum = 0;
    let sumw = 0;
    for (let j = 0; j < size; j++) {
      const weight = w(i - j);
      sum += source[j] * weight;
      sumw += weight;
    }
    const current = sum / sumw;
    out[i] = ge(current, 0) ? current : 0;
  }
  return out;
}

/** peak_detection(source, scale, real_minimum, true) */
function peakDetection(source: number[], scale: number, realMinimum: number): number[] {
  const peaks: number[] = [];
  const size = source.length;
  if (size === 0) return peaks;
  const max = arrMax(source) - realMinimum;
  const q = (v: number) => Math.trunc(((v - realMinimum) / max) * (scale - 1) + 1);
  let i = -1;
  while (i < size - 1) {
    i += 1;
    const center = q(source[i]);
    const previous = i > 0 ? q(source[i - 1]) : 0;
    const next = i < size - 1 ? q(source[i + 1]) : 0;
    if (center > previous) {
      let j = i + 1;
      if (ieq(center, next)) {
        while (j <= size - 1) {
          j += 1;
          const varyPrevious = q(source[j - 1]);
          const veryNext = j <= size - 1 ? q(source[j]) : 0;
          if (ine(veryNext, varyPrevious)) {
            if (center > veryNext) {
              const pIdx = Math.trunc((i + j) / 2.0);
              peaks.push(j - i > 2 && (j - i) % 2 !== 0 ? pIdx : pIdx - 0.5);
              i = j;
            } else {
              i = j - 1;
            }
            break;
          }
        }
      }
      if (center > next) peaks.push(i);
    }
  }
  return peaks;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<DynamicSupportResistanceZonesInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const unit = n > 0 && bars[0].time >= 1e12 ? 'ms' : 's';
  const autoPrecision = !cfg.manual_precision;
  const maSmoothing = cfg.ma_smoothing + 1;
  const lastConfirmed = lastBarConfirmedOf(chart);
  resetDrawings({ line: MAX_OBJECTS, box: MAX_OBJECTS, label: MAX_OBJECTS });

  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const lengths = [cfg.length_1, cfg.length_2, cfg.length_3, cfg.length_4];
  const includes = [cfg.include_5, cfg.include_10, cfg.include_20, cfg.include_50];
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const phs = lengths.map((len) => A(ta.pivothigh(highS, len, len)));
  const pls = lengths.map((len) => A(ta.pivotlow(lowS, len, len)));
  const H = bars.map((b) => b.high);
  const L = bars.map((b) => b.low);
  const O = bars.map((b) => b.open);
  const C = bars.map((b) => b.close);
  const V = bars.map((b) => b.volume ?? NaN);

  const pivotHigh: number[] = [];
  const pivotHighWeight: number[] = [];
  const pivotLow: number[] = [];
  const pivotLowWeight: number[] = [];

  const dist: Box[] = [];
  const peak: Line[] = [];
  const peakBox: Box[] = [];
  const heat: Box[] = [];
  const bounce: Label[] = [];

  const sincCache = new Map<number, number>();
  const maSite = callsite.sma();
  const maVals = new Array<number>(n).fill(NaN);
  const atrVals = new Array<number>(n).fill(NaN);
  let sudoMax = NaN;
  let cum = 0;

  const weightOf = (i: number, len: number): number => {
    switch (cfg.weight_style) {
      case 'Linear': return 1;
      case 'Time': return i - len;
      default: return i - len >= 0 ? V[i - len] : NaN;
    }
  };

  /** add_to_score */
  const addToScore = (self: number[], source: number[], weight: number[], i: number, minRange: number, binSize: number, precision: number) => {
    if (source.length === 0) return;
    const wMin = arrMin(weight);
    for (let k = 0; k < source.length; k++) {
      const w = weight[k];
      const W = cfg.weight_style === 'Time' ? 1 + (i - wMin) - (i - w) : w;
      const idx = Math.min(Math.floor((source[k] - minRange) / binSize), precision - 1);
      // an na index (no range) changes nothing
      if (Number.isNaN(idx) || idx < 0 || idx >= self.length) continue;
      self[idx] = self[idx] + W;
    }
  };

  /** ma(scores, min_range, bin_size, enable) */
  const maOf = (scores: number[], minRange: number, binSize: number): number => {
    let ma = NaN;
    if (cfg.enable_ma) {
      let weight = 0;
      let sum = 0;
      if (gt(arrMax(scores), 0)) {
        for (let k = 0; k < scores.length; k++) {
          const score = scores[k];
          if (eq(score, 0)) continue;
          const binTop = minRange + binSize * (k + 1);
          const binBottom = minRange + binSize * k;
          const price = (binTop + binBottom) / 2;
          weight += score;
          sum += price * score;
        }
        ma = sum / weight;
      }
    }
    return ma;
  };

  /** method hit(label[] self, level, lookback, atr, bear_bounce, bull_bounce) */
  const hit = (i: number, level: number, lookback: number, atr: number, bearBounce: string, bullBounce: string) => {
    const at = (arr: number[], k: number) => (i - k >= 0 ? arr[i - k] : NaN);
    for (let k = 0; k <= lookback - 1; k++) {
      const h = at(H, k);
      const l = at(L, k);
      const candleRange = h - l;
      const pLevel = level - l;
      const percent = pLevel / candleRange;
      if (!(le(percent, 1) && ge(percent, 0))) continue;
      const o = at(O, k);
      const c = at(C, k);
      const cNext = at(C, Math.max(k - 1, 0));
      const polarity = gt(c, o);
      const bodyTop = Math.max(o, c);
      const bodyBottom = Math.min(o, c);
      const topWickRange = h - bodyTop;
      const twLevel = level - bodyTop;
      const twPercent = twLevel / topWickRange;
      const bottomWickRange = bodyBottom - l;
      const bwPercent = pLevel / bottomWickRange;
      const topWickPortion = topWickRange / candleRange;
      const bottomWickPortion = bottomWickRange / candleRange;
      const topWickBounce = (le(twPercent, 1) && ge(twPercent, 0) && ge(twPercent, 0.5))
        || (le(topWickPortion, 0.25) && lt(level, h) && gt(level, bodyTop))
        || (le(candleRange, atr * 2) && le(level, h) && ge(level, bodyTop));
      const bottomWickBounce = (le(bwPercent, 1) && ge(bwPercent, 0) && le(bwPercent, 0.5))
        || (le(bottomWickPortion, 0.25) && gt(level, l) && lt(level, bodyBottom))
        || (le(candleRange, atr * 2) && le(level, bodyBottom) && ge(level, l));
      const bearCondition = lt(o, level) && lt(cNext, level);
      const bullCondition = gt(o, level) && gt(cNext, level);
      const candleBearBounce = polarity && ge(percent, 0.7);
      const candleBullBounce = !polarity && le(percent, 0.3);
      if ((topWickBounce || candleBearBounce) && bearCondition) {
        bounce.push(label.new(i - k, h, '⬤', 'bar_index', 'price', String(color.new(color.black, 100)), 'label_down', bearBounce));
        continue;
      }
      if ((bottomWickBounce || candleBullBounce) && bullCondition) {
        bounce.push(label.new(i - k, l, '⬤', 'bar_index', 'price', String(color.new(color.black, 100)), 'label_up', bullBounce));
      }
    }
  };

  const deleteAll = <T extends object>(arr: T[], del: (o: T) => void) => {
    for (let k = arr.length - 1; k >= 0; k--) {
      del(arr[k]);
      arr.splice(k, 1);
    }
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const isLast = i === n - 1;
    const isConfirmed = !isLast || lastConfirmed;
    const isRealtime = isLast && !lastConfirmed;

    for (let k = 0; k < 4; k++) {
      if (!Number.isNaN(phs[k][i]) && includes[k]) {
        pivotHigh.push(phs[k][i]);
        pivotHighWeight.push(weightOf(i, lengths[k]));
      }
    }
    for (let k = 0; k < 4; k++) {
      if (!Number.isNaN(pls[k][i]) && includes[k]) {
        pivotLow.push(pls[k][i]);
        pivotLowWeight.push(weightOf(i, lengths[k]));
      }
    }
    if (pivotHigh.length > cfg.pivot_lookback) {
      pivotHigh.shift();
      pivotHighWeight.shift();
    }
    if (pivotLow.length > cfg.pivot_lookback) {
      pivotLow.shift();
      pivotLowWeight.shift();
    }

    // ta.max(high), ta.cum(high - low)
    if (!Number.isNaN(H[i]) && !(H[i] <= sudoMax)) sudoMax = H[i];
    const range = H[i] - L[i];
    if (!Number.isNaN(range)) cum += range;
    // math.max / math.min: na when an argument is na
    const maxRange = Math.max(cfg.include_ph ? arrMax(pivotHigh) : 0, cfg.include_pl ? arrMax(pivotLow) : 0);
    const minRange = Math.min(cfg.include_ph ? arrMin(pivotHigh) : sudoMax, cfg.include_pl ? arrMin(pivotLow) : sudoMax);
    const atr = gt(cum, 0) ? cum / (i + 1) : 10;
    atrVals[i] = atr;
    const auto = autoPrecision ? Math.min(100, Math.max(10, Math.ceil((maxRange - minRange) / atr))) : cfg.precision;
    const binSize = (maxRange - minRange) / auto;

    // Only the drawings of the last confirmed bar survive (each confirmed bar deletes them all)
    const drawPhase = i >= n - 2;
    if (drawPhase && isConfirmed) {
      deleteAll(dist, (o) => box.delete(o));
      deleteAll(peak, (o) => line.delete(o));
      deleteAll(peakBox, (o) => box.delete(o));
      deleteAll(heat, (o) => box.delete(o));
      deleteAll(bounce, (o) => label.delete(o));
    }

    let ma = NaN;
    const speedHack = cfg.real_time_only ? isRealtime : true;
    if (speedHack && (cfg.enable_ma || drawPhase)) {
      const scores = Number.isNaN(auto) ? [] : new Array<number>(auto).fill(0);
      if (cfg.include_ph) addToScore(scores, pivotHigh, pivotHighWeight, i, minRange, binSize, auto);
      if (cfg.include_pl) addToScore(scores, pivotLow, pivotLowWeight, i, minRange, binSize, auto);
      const filtered = sincFilter(scores, cfg.filter, sincCache);
      const fMax = arrMax(filtered);
      if (gt(fMax, 0)) {
        // filtered_scores.min(nth): the smallest value that is not 0
        let realMinimum = 0;
        const sorted = [...filtered].sort((a, b) => a - b);
        for (const s of sorted) {
          if (!eq(s, 0)) {
            realMinimum = s;
            break;
          }
        }
        const peakIdx = peakDetection(filtered, cfg.scale, realMinimum);

        if (isConfirmed && drawPhase) {
          if (peakIdx.length > 0 && cfg.show_lines) {
            for (const pIdx of peakIdx) {
              const binTop = minRange + binSize * (pIdx + 1);
              const binBottom = minRange + binSize * pIdx;
              const score = (binTop + binBottom) / 2;
              const scoreColor = gt(C[i], score) ? cfg.support_color : cfg.resistance_color;
              if (cfg.show_hits) hit(i, score, cfg.hit_lookback, atr, cfg.resistance_color, cfg.support_color);
              peak.push(line.new(i + 3, score, i + cfg.scale + 3, score, 'bar_index', 'left', scoreColor, undefined, 2));
              if (cfg.show_zone) {
                const zoneColor = String(color.new(scoreColor, cfg.zone_alpha));
                peakBox.push(box.new(i - 1, binTop, i + cfg.scale + 3, binBottom, zoneColor, undefined, undefined, 'left', undefined, zoneColor));
              }
            }
          }
          if (cfg.show_dist || cfg.heat_map) {
            for (let k = 0; k < filtered.length; k++) {
              const maxScore = fMax - realMinimum;
              const rawScore = filtered[k];
              const score = Math.trunc(((rawScore - realMinimum) / maxScore) * (cfg.scale - 1) + 1);
              const scoreColor = String(color.from_gradient(score, 0, cfg.scale, cfg.low_color, cfg.high_color));
              const binTop = minRange + binSize * (k + 1);
              const binBottom = minRange + binSize * k;
              const txt = cfg.show_score
                ? (cfg.weight_style === 'Volume' ? str.tostring(rawScore, 'volume') : str.tostring(Math.ceil(rawScore)))
                : undefined;
              if (gt(rawScore, 0)) {
                if (cfg.show_dist) {
                  dist.push(box.new(i + cfg.scale - score + 3, binTop, i + cfg.scale + 3, binBottom, scoreColor, undefined, undefined,
                    undefined, undefined, scoreColor, txt, undefined, cfg.txt_color));
                }
                if (cfg.heat_map) {
                  const c = String(color.new(scoreColor, cfg.heat_alpha));
                  heat.push(box.new(i + cfg.scale - score + 3, binTop, i + cfg.scale + 3, binBottom, c, undefined, undefined, 'left',
                    undefined, c));
                }
              }
            }
          }
        }
        ma = maSite(i, maOf(filtered, minRange, binSize), maSmoothing);
      }
    }
    maVals[i] = ma;
  }
  setDrawingBar(null);

  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const maTop = maVals.map((m, i) => m + atrVals[i] / 2);
  const maBottom = maVals.map((m, i) => m - atrVals[i] / 2);
  const c100 = String(color.new(cfg.ma_color, 100));
  const c80 = String(color.new(cfg.ma_color, 80));
  const fillOf = (top: number[], bottom: number[], topColor: string, bottomColor: string) => ({
    topValue: top.map(fin), bottomValue: bottom.map(fin),
    topColor: new Array<string | null>(n).fill(topColor), bottomColor: new Array<string | null>(n).fill(bottomColor),
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(maVals[i]), color: cfg.ma_color })),
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(maTop[i]), color: c100 })),
      plot2: bars.map((b, i) => ({ time: b.time, value: fin(maBottom[i]), color: c100 })),
    },
    fills: [
      { id: 'fill0', plot1: 'plot0', plot2: 'plot1', options: { title: 'Glow Top' }, gradient: fillOf(maTop, maVals, c100, c80) },
      { id: 'fill1', plot1: 'plot0', plot2: 'plot2', options: { title: 'Glow Bottom' }, gradient: fillOf(maVals, maBottom, c80, c100) },
    ],
    ...drawingOutputs(bars, unit),
  } as IndicatorResult;
}

export const DynamicSupportResistanceZones = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  drawingKinds,
};
