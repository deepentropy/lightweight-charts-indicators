/**
 * Liquidity Sweep Hunter Algo [AlgoAlpha]
 *
 * Liquidity levels: the highest high and the lowest low of three lookbacks (Fast, Mid, Slow). A level is stored when
 * its extreme has moved (it is above / below its value 3 bars back and unchanged since the bar before), rounded to
 * the symbol tick and merged with a stored level within 2 ticks. Upper levels are kept sorted from the highest down,
 * lower levels from the lowest up; a level is removed when a wick (or a close, "Remove On") goes through it, or
 * after "Max Age" bars (checked every 10 bars).
 *
 * Strength: each closed bar adds its volume, as a multiple of the 100-bar average volume (at most 3), to the three
 * nearest levels against its direction (a down bar to the upper levels above the close, an up bar to the lower levels
 * below it), with the weights 1, 0.25 and 0.05; a level holds at most 50.
 *
 * Heatmap: every "Cell Width" bars a box is drawn over the last cell for each of the three nearest upper and lower
 * levels, its height the price range of the last "Price Range Lookback" bars divided by "Price Resolution", its
 * colour the level strength against the strongest of the six (gradient Weak / Mid / Strong). A wick through a level
 * extends its last box to the bar.
 *
 * Signals: a closed bar whose wick sweeps at least two visibly distinct bands of recently drawn upper (lower) levels,
 * with an average strength of at least "Strength" % when the filter is on, is a pending sweep; a close back below
 * (above) every swept level within 2 bars gives a bearish (bullish) reversal label. With "Show TP/SL", the next bar
 * opens a trade drawing: a stop box to the lowest low (highest high) of the 4 bars before, a target box to "RR" times
 * the risk, three dashed target lines and a progress box that grows with each target reached, all "Signal Expiry"
 * bars long. A tick mark shows the bar that reaches the third target. At most 500 boxes and 500 lines are kept.
 *
 * Reference: "Liquidity Sweep Hunter Algo [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoAlpha
 */

import {
  ta, color, box, line, na, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type Box, type IndicatorResult, type InputConfig, type MarkerData, type PlotConfig,
  type ShapeConfig,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { lastBarConfirmedOf, mintickOf } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface LiquiditySweepHunterAlgoInputs {
  shortBars: number;
  mediumBars: number;
  longBars: number;
  keepLevelsForBars: number;
  removeLevelWhen: 'Wick' | 'Close';
  heatmapLookback: number;
  heatmapResolution: number;
  heatmapCellBars: number;
  filterSweepsByStrength: boolean;
  minimumSweepStrength: number;
  showTradeDrawings: boolean;
  tradeRiskReward: number;
  tradeExpiryBars: number;
  heatmapWeakColor: string;
  heatmapMidColor: string;
  heatmapStrongColor: string;
  bullishSignalColor: string;
  bearishSignalColor: string;
}

export const defaultInputs: LiquiditySweepHunterAlgoInputs = {
  shortBars: 14,
  mediumBars: 42,
  longBars: 120,
  keepLevelsForBars: 1000,
  removeLevelWhen: 'Wick',
  heatmapLookback: 777,
  heatmapResolution: 200,
  heatmapCellBars: 5,
  filterSweepsByStrength: true,
  minimumSweepStrength: 33,
  showTradeDrawings: true,
  tradeRiskReward: 3.0,
  tradeExpiryBars: 40,
  heatmapWeakColor: '#8C00FF',
  heatmapMidColor: '#00ffbb',
  heatmapStrongColor: '#FFE600',
  bullishSignalColor: '#00ffbb',
  bearishSignalColor: '#ff1100',
};

const LEVELS = 'Levels';
const SIGNALS = 'Signals';
const APPEARANCE = 'Appearance';

export const inputConfig: InputConfig[] = [
  { id: 'shortBars', type: 'int', title: 'Fast', defval: 14, min: 1, group: LEVELS, inline: 'lookbacks' },
  { id: 'mediumBars', type: 'int', title: 'Mid', defval: 42, min: 1, group: LEVELS, inline: 'lookbacks' },
  {
    id: 'longBars', type: 'int', title: 'Slow', defval: 120, min: 1, group: LEVELS, inline: 'lookbacks',
    tooltip: 'Fast, Mid, and Slow set the lookbacks used to detect short-term, medium-term, and major liquidity highs and lows. Higher values require broader price extremes before a new level is created.',
  },
  {
    id: 'keepLevelsForBars', type: 'int', title: 'Max Age', defval: 1000, min: 50, max: 5000, group: LEVELS,
    tooltip: 'Maximum number of bars a stored liquidity level can remain active before it is removed from memory.',
  },
  {
    id: 'removeLevelWhen', type: 'string', title: 'Remove On', defval: 'Wick', options: ['Wick', 'Close'], group: LEVELS,
    tooltip: 'Choose whether a level is mitigated as soon as price wicks through it or only after a candle closes beyond it.',
  },
  {
    id: 'heatmapLookback', type: 'int', title: 'Price Range Lookback', defval: 777, min: 20, max: 5000, group: LEVELS,
    tooltip: 'Number of recent bars used to measure the price range that determines each heatmap box height. Higher values produce a more slowly changing vertical scale.',
  },
  {
    id: 'heatmapResolution', type: 'int', title: 'Price Resolution', defval: 200, min: 2, max: 300, group: LEVELS,
    tooltip: 'Number of vertical divisions across the measured price range. Higher values make each liquidity heatmap band thinner.',
  },
  {
    id: 'heatmapCellBars', type: 'int', title: 'Cell Width', defval: 5, min: 1, max: 50, group: LEVELS,
    tooltip: 'Horizontal width of each historical heatmap box, measured in chart bars. Higher values create longer cells and fewer colour updates.',
  },
  { id: 'filterSweepsByStrength', type: 'bool', title: 'Filter Sweeps by Strength', defval: true, group: SIGNALS, inline: 'sweepStrength' },
  {
    id: 'minimumSweepStrength', type: 'int', title: 'Strength', defval: 33, min: 1, max: 90, group: SIGNALS, inline: 'sweepStrength',
    tooltip: 'Filter Sweeps by Strength enables or disables the signal filter. Strength sets the minimum average normalized strength, from 1% to 90%, required across the visibly distinct levels swept by the same candle. The value uses the same shared bull/bear scale that determines the box colours.',
  },
  { id: 'showTradeDrawings', type: 'bool', title: 'Show TP/SL', defval: true, group: SIGNALS, inline: 'tradeDrawings' },
  { id: 'tradeRiskReward', type: 'float', title: 'RR', defval: 3.0, min: 0.1, max: 20.0, step: 0.1, group: SIGNALS, inline: 'tradeDrawings' },
  {
    id: 'tradeExpiryBars', type: 'int', title: 'Signal Expiry', defval: 40, min: 1, max: 500, group: SIGNALS, inline: 'tradeDrawings',
    tooltip: "Show TP/SL enables the post-signal trade drawing. RR sets the final reward distance as a multiple of the four-bar stop distance. Signal Expiry sets how many bars the stop, target, and three milestone lines extend from the next bar's entry open.",
  },
  { id: 'heatmapWeakColor', type: 'color', title: 'Weak', defval: '#8C00FF', group: APPEARANCE, inline: 'boxColors' },
  { id: 'heatmapMidColor', type: 'color', title: 'Mid', defval: '#00ffbb', group: APPEARANCE, inline: 'boxColors' },
  {
    id: 'heatmapStrongColor', type: 'color', title: 'Strong', defval: '#FFE600', group: APPEARANCE, inline: 'boxColors',
    tooltip: 'Weak, Mid, and Strong set the low, midpoint, and high colours of the shared strength gradient used for both upper and lower liquidity boxes.',
  },
  { id: 'bullishSignalColor', type: 'color', title: 'Bullish Signal', defval: '#00ffbb', group: APPEARANCE, inline: 'signalColors' },
  {
    id: 'bearishSignalColor', type: 'color', title: 'Bearish Signal', defval: '#ff1100', group: APPEARANCE, inline: 'signalColors',
    tooltip: 'Bullish Signal and Bearish Signal set the colours of the reversal labels. The bullish colour is also used for both target boxes and all three target lines, while the bearish colour is used for the stop box.',
  },
];

export const plotConfig: PlotConfig[] = [];

export const shapeConfig: ShapeConfig[] = [
  {
    id: 'shape0', kind: 'shape', title: 'Bullish Multi-Level Sweep Reversal', style: 'labelup', location: 'absolute',
    color: '#00ffbb', text: '▲', textcolor: '#FFFFFF', size: 'small',
  },
  {
    id: 'shape1', kind: 'shape', title: 'Bearish Multi-Level Sweep Reversal', style: 'labeldown', location: 'absolute',
    color: '#ff1100', text: '▼', textcolor: '#FFFFFF', size: 'small',
  },
  { id: 'char2', kind: 'char', title: 'Bullish Third Target Wick', char: '✅', location: 'abovebar', color: '#00ffbb', size: 'tiny' },
  { id: 'char3', kind: 'char', title: 'Bearish Third Target Wick', char: '✅', location: 'belowbar', color: '#ff1100', size: 'tiny' },
];

export const drawingKinds: StudyDrawingKind[] = ['box', 'line'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Upper Liquidity Detected', message: 'A new upper liquidity level was detected.' },
  { id: 'alert1', title: 'Lower Liquidity Detected', message: 'A new lower liquidity level was detected.' },
  { id: 'alert2', title: 'Any Liquidity Detected', message: 'A new liquidity level was detected.' },
  { id: 'alert3', title: 'Upper Level Removed', message: 'An upper liquidity level was removed.' },
  { id: 'alert4', title: 'Lower Level Removed', message: 'A lower liquidity level was removed.' },
  { id: 'alert5', title: 'Any Level Removed', message: 'A liquidity level was removed.' },
  {
    id: 'alert6', title: 'Bullish Multi-Level Sweep Reversal',
    message: 'Price cleared at least two visibly distinct lower liquidity bands in one bar, passed the optional user-defined average-strength filter, and closed back above all swept bands within two bars.',
  },
  {
    id: 'alert7', title: 'Bearish Multi-Level Sweep Reversal',
    message: 'Price cleared at least two visibly distinct upper liquidity bands in one bar, passed the optional user-defined average-strength filter, and closed back below all swept bands within two bars.',
  },
];

export const metadata = {
  title: 'Liquidity Sweep Hunter Algo [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - Liquidity Sweep Hunter',
  overlay: true,
};

const SHIFT_COMPARISON_BARS = 3;
const LEVEL_MERGE_TICKS = 2;
const CLEANUP_BARS = 10;
const VOLUME_AVERAGE_BARS = 100;
const MAX_VOLUME_SCORE_PER_BAR = 3.0;
const FULL_HEATMAP_STRENGTH = 50.0;
const LEVEL_WEIGHTS = [1.0, 0.25, 0.05];
const MIN_LEVELS_FOR_SIGNAL = 2;
const SIGNAL_RECLAIM_BARS = 2;
const SIGNAL_ATR_LENGTH = 14;
const SIGNAL_OFFSET_MULTIPLIER = 0.15;
const TRADE_STOP_LOOKBACK_BARS = 4;
const TRADE_MILESTONE_COUNT = 3;

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const le = (a: number, b: number) => b - a > -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** One stored level: the parallel arrays of the original (prices, births, strengths, last box, norm, height, bar) */
interface Level {
  price: number;
  birth: number;
  strength: number;
  lastBox: Box | null;
  lastNorm: number;
  lastCellHeight: number;
  lastDrawBar: number;
}

interface PendingSweep {
  bar: number;
  reclaim: number;
}

interface Trade {
  direction: number;
  expiry: number;
  entry: number;
  stop: number;
  targets: [number, number, number];
  reached: number;
  progressBox: Box;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquiditySweepHunterAlgoInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const mintick = mintickOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);

  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const arr = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const hSrc = [cfg.shortBars, cfg.mediumBars, cfg.longBars].map((len) => arr(ta.highest(highS, len)));
  const lSrc = [cfg.shortBars, cfg.mediumBars, cfg.longBars].map((len) => arr(ta.lowest(lowS, len)));
  const barVolume = bars.map((b) => (b.volume === undefined || b.volume === null || isNaN(b.volume) ? 0.0 : b.volume));
  const volumeAverage = arr(ta.sma(Series.fromArray(bars, barVolume), VOLUME_AVERAGE_BARS));
  const heatmapHighRaw = arr(ta.highest(highS, cfg.heatmapLookback));
  const heatmapLowRaw = arr(ta.lowest(lowS, cfg.heatmapLookback));
  const signalAtr = arr(ta.atr(bars, SIGNAL_ATR_LENGTH));
  const prevLow = Series.fromArray(bars, bars.map((_b, i) => (i > 0 ? bars[i - 1].low : NaN)));
  const prevHigh = Series.fromArray(bars, bars.map((_b, i) => (i > 0 ? bars[i - 1].high : NaN)));
  const bullishStopCandidate = arr(ta.lowest(prevLow, TRADE_STOP_LOOKBACK_BARS));
  const bearishStopCandidate = arr(ta.highest(prevHigh, TRADE_STOP_LOOKBACK_BARS));

  resetDrawings({ box: 500, line: 500 });

  const mergeTolerance = mintick * LEVEL_MERGE_TICKS;
  const removeOnWick = cfg.removeLevelWhen === 'Wick';
  const bull = cfg.bullishSignalColor;
  const bear = cfg.bearishSignalColor;

  // var float h1 .. h3, l1 .. l3
  const hVar = [NaN, NaN, NaN];
  const lVar = [NaN, NaN, NaN];
  const upper: Level[] = [];
  const lower: Level[] = [];
  const pendingUpper: PendingSweep[] = [];
  const pendingLower: PendingSweep[] = [];
  const trades: Trade[] = [];

  const roundToTick = (v: number) => Math.round(v / mintick) * mintick;

  const findInsertIndex = (levels: Level[], price: number, descending: boolean) => {
    let lo = 0;
    let hi = levels.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) * 0.5);
      const midPrice = levels[mid].price;
      if (descending ? gt(midPrice, price) : lt(midPrice, price)) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };

  const addLevel = (levels: Level[], rawPrice: number, i: number, descending: boolean) => {
    if (isNaN(rawPrice)) return;
    const price = roundToTick(rawPrice);
    const size = levels.length;
    const insertIndex = findInsertIndex(levels, price, descending);
    let matchIndex = NaN;
    let bestDistance = NaN;
    if (insertIndex < size) {
      const distance = Math.abs(levels[insertIndex].price - price);
      if (le(distance, mergeTolerance)) {
        matchIndex = insertIndex;
        bestDistance = distance;
      }
    }
    if (insertIndex > 0) {
      const distance = Math.abs(levels[insertIndex - 1].price - price);
      if (le(distance, mergeTolerance) && (isNaN(bestDistance) || lt(distance, bestDistance))) matchIndex = insertIndex - 1;
    }
    if (isNaN(matchIndex)) {
      levels.splice(insertIndex, 0, {
        price, birth: i, strength: 0.0, lastBox: null, lastNorm: NaN, lastCellHeight: NaN, lastDrawBar: NaN,
      });
    } else {
      levels[matchIndex].birth = i;
    }
  };

  const pruneExpired = (levels: Level[], i: number) => {
    for (let k = levels.length - 1; k >= 0; k--) {
      if (i - levels[k].birth > cfg.keepLevelsForBars) levels.splice(k, 1);
    }
  };

  /** f_extendWickSweptUppers / Lowers */
  const extendWickSwept = (levels: Level[], wick: number, isUpper: boolean, i: number) => {
    for (let k = levels.length - 1; k >= 0; k--) {
      const p = levels[k].price;
      if (isUpper ? le(p, wick) : ge(p, wick)) {
        const lastBox = levels[k].lastBox;
        if (lastBox !== null && !na(lastBox)) box.set_right(lastBox, i);
      } else break;
    }
  };

  /** f_mitigateUppers / Lowers: the number of levels removed */
  const mitigate = (levels: Level[], price: number, isUpper: boolean) => {
    let removed = 0;
    while (levels.length > 0) {
      const p = levels[levels.length - 1].price;
      if (isUpper ? le(p, price) : ge(p, price)) {
        levels.pop();
        removed += 1;
      } else break;
    }
    return removed;
  };

  /** f_upperVisibleSweepStats / f_lowerVisibleSweepStats: [bandCount, reclaimLevel, averageStrength] */
  const visibleSweepStats = (levels: Level[], wick: number, isUpper: boolean, i: number): [number, number, number] => {
    let bandCount = 0;
    let reclaimLevel = NaN;
    let strengthSum = 0.0;
    let bandOpen = false;
    let bandEdge = NaN;
    let bandStrength = 0.0;
    for (let k = levels.length - 1; k >= 0; k--) {
      const lv = levels[k];
      const levelPrice = lv.price;
      if (!(isUpper ? le(levelPrice, wick) : ge(levelPrice, wick))) break;
      const recentlyDrawn = !isNaN(lv.lastDrawBar) && i - lv.lastDrawBar <= cfg.heatmapCellBars;
      const visibleLevel = recentlyDrawn && lv.lastBox !== null && !na(lv.lastBox) && !isNaN(lv.lastNorm)
        && !isNaN(lv.lastCellHeight) && gt(lv.lastCellHeight, 0.0);
      if (!visibleLevel) continue;
      const levelBottom = levelPrice - lv.lastCellHeight * 0.5;
      const levelTop = levelPrice + lv.lastCellHeight * 0.5;
      if (isUpper) {
        reclaimLevel = isNaN(reclaimLevel) ? levelPrice : Math.min(reclaimLevel, levelPrice);
        if (!bandOpen) {
          bandOpen = true;
          bandEdge = levelTop;
          bandStrength = lv.lastNorm;
        } else if (le(levelBottom, bandEdge)) {
          bandEdge = Math.max(bandEdge, levelTop);
          bandStrength = Math.max(bandStrength, lv.lastNorm);
        } else {
          bandCount += 1;
          strengthSum += bandStrength;
          bandEdge = levelTop;
          bandStrength = lv.lastNorm;
        }
      } else {
        reclaimLevel = isNaN(reclaimLevel) ? levelPrice : Math.max(reclaimLevel, levelPrice);
        if (!bandOpen) {
          bandOpen = true;
          bandEdge = levelBottom;
          bandStrength = lv.lastNorm;
        } else if (ge(levelTop, bandEdge)) {
          bandEdge = Math.min(bandEdge, levelBottom);
          bandStrength = Math.max(bandStrength, lv.lastNorm);
        } else {
          bandCount += 1;
          strengthSum += bandStrength;
          bandEdge = levelBottom;
          bandStrength = lv.lastNorm;
        }
      }
    }
    if (bandOpen) {
      bandCount += 1;
      strengthSum += bandStrength;
    }
    return [bandCount, reclaimLevel, bandCount > 0 ? strengthSum / bandCount : 0.0];
  };

  /** f_resolveUpperSweeps / Lowers */
  const resolveSweeps = (pending: PendingSweep[], closePrice: number, isUpper: boolean, i: number) => {
    let signal = false;
    for (let k = pending.length - 1; k >= 0; k--) {
      const age = i - pending[k].bar;
      const reclaim = pending[k].reclaim;
      if (age > SIGNAL_RECLAIM_BARS) pending.splice(k, 1);
      else if (isUpper ? lt(closePrice, reclaim) : gt(closePrice, reclaim)) {
        signal = true;
        pending.splice(k, 1);
      }
    }
    return signal;
  };

  /** The three nearest valid levels: indexes in the level array */
  const nearest = (levels: Level[], close: number, isUpper: boolean, i: number) => {
    const found: number[] = [];
    let k = levels.length - 1;
    while (k >= 0 && found.length < 3) {
      const lv = levels[k];
      const valid = (isUpper ? gt(lv.price, close) : lt(lv.price, close)) && i - lv.birth <= cfg.keepLevelsForBars;
      if (valid) found.push(k);
      k -= 1;
    }
    return found;
  };

  const heatmapColor = (norm: number) => {
    const clipped = Math.max(0.0, Math.min(1.0, norm));
    return le(clipped, 0.5)
      ? color.from_gradient(clipped, 0.0, 0.5, cfg.heatmapWeakColor, cfg.heatmapMidColor)
      : color.from_gradient(clipped, 0.5, 1.0, cfg.heatmapMidColor, cfg.heatmapStrongColor);
  };
  const heatmapNorm = (strength: number, maxStrength: number) =>
    gt(maxStrength, 0.0) ? Math.max(0.0, Math.min(1.0, (isNaN(strength) ? 0.0 : strength) / maxStrength)) : 0.0;

  const markers: MarkerData[] = [];
  const flags: boolean[][] = alertConditions.map(() => []);
  let prevBullishSweep = false;
  let prevBearishSweep = false;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const t = b.time;
    const confirmed = i < n - 1 || lastConfirmed;

    // Level source
    const shift = (src: number[], v: number, isHigh: boolean) => {
      const cur = src[i];
      if (isNaN(cur)) return false;
      if (isNaN(v)) return true;
      const back = i >= SHIFT_COMPARISON_BARS ? src[i - SHIFT_COMPARISON_BARS] : NaN;
      const prev = i >= 1 ? src[i - 1] : NaN;
      return !isNaN(back) && (isHigh ? gt(cur, back) : lt(cur, back)) && !eq(cur, back) && eq(cur, prev);
    };
    const hShift = hSrc.map((s, k) => shift(s, hVar[k], true));
    const lShift = lSrc.map((s, k) => shift(s, lVar[k], false));
    hShift.forEach((s, k) => { if (s) hVar[k] = hSrc[k][i]; });
    lShift.forEach((s, k) => { if (s) lVar[k] = lSrc[k][i]; });

    // Level memory update
    const upperMitigationPrice = removeOnWick ? b.high : b.close;
    const lowerMitigationPrice = removeOnWick ? b.low : b.close;
    let upperMitigated = false;
    let lowerMitigated = false;
    let bearishSweepSignal = false;
    let bullishSweepSignal = false;

    if (removeOnWick) {
      extendWickSwept(upper, b.high, true, i);
      extendWickSwept(lower, b.low, false, i);
    }

    if (confirmed) {
      const [upperBands, upperReclaim, upperAverage] = visibleSweepStats(upper, b.high, true, i);
      const [lowerBands, lowerReclaim, lowerAverage] = visibleSweepStats(lower, b.low, false, i);
      upperMitigated = mitigate(upper, upperMitigationPrice, true) > 0;
      lowerMitigated = mitigate(lower, lowerMitigationPrice, false) > 0;

      const minimumNormalized = cfg.minimumSweepStrength / 100.0;
      const upperQualified = !cfg.filterSweepsByStrength || ge(upperAverage, minimumNormalized);
      const lowerQualified = !cfg.filterSweepsByStrength || ge(lowerAverage, minimumNormalized);
      if (removeOnWick && upperBands >= MIN_LEVELS_FOR_SIGNAL && upperQualified && !isNaN(upperReclaim)) {
        pendingUpper.push({ bar: i, reclaim: upperReclaim });
      }
      if (removeOnWick && lowerBands >= MIN_LEVELS_FOR_SIGNAL && lowerQualified && !isNaN(lowerReclaim)) {
        pendingLower.push({ bar: i, reclaim: lowerReclaim });
      }
      bearishSweepSignal = resolveSweeps(pendingUpper, b.close, true, i);
      bullishSweepSignal = resolveSweeps(pendingLower, b.close, false, i);

      if (i % CLEANUP_BARS === 0) {
        pruneExpired(upper, i);
        pruneExpired(lower, i);
      }
      for (let k = 0; k < 3; k++) if (hShift[k]) addLevel(upper, hVar[k], i, true);
      for (let k = 0; k < 3; k++) if (lShift[k]) addLevel(lower, lVar[k], i, false);
    }

    // Nearest active levels
    const upperIdx = nearest(upper, b.close, true, i);
    const lowerIdx = nearest(lower, b.close, false, i);

    // Directional volume strength
    const avg = volumeAverage[i];
    const safeAverage = isNaN(avg) || le(avg, 0.0) ? barVolume[i] : avg;
    const rawNormalized = gt(safeAverage, 0.0) ? barVolume[i] / safeAverage : 0.0;
    const normalized = Math.min(rawNormalized, MAX_VOLUME_SCORE_PER_BAR);
    const direction = gt(b.close, b.open) ? 1.0 : lt(b.close, b.open) ? -1.0 : 0.0;
    const signed = normalized * direction;
    const addStrength = (levels: Level[], k: number | undefined, amount: number) => {
      if (k === undefined) return;
      if (k >= 0 && k < levels.length && gt(amount, 0.0)) {
        levels[k].strength = Math.min(levels[k].strength + amount, FULL_HEATMAP_STRENGTH);
      }
    };
    if (confirmed) {
      if (lt(signed, 0.0)) {
        const c = Math.abs(signed);
        LEVEL_WEIGHTS.forEach((w, j) => addStrength(upper, upperIdx[j], c * w));
      } else if (gt(signed, 0.0)) {
        LEVEL_WEIGHTS.forEach((w, j) => addStrength(lower, lowerIdx[j], signed * w));
      }
    }
    const upperStrength = upperIdx.map((k) => upper[k].strength);
    const lowerStrength = lowerIdx.map((k) => lower[k].strength);
    const maxStrength = Math.max(0, ...upperStrength, ...lowerStrength);

    // Persistent box heatmap cells
    const heatmapHigh = isNaN(heatmapHighRaw[i]) ? b.high : heatmapHighRaw[i];
    const heatmapLow = isNaN(heatmapLowRaw[i]) ? b.low : heatmapLowRaw[i];
    const heatmapPriceRange = Math.max(heatmapHigh - heatmapLow, mintick * cfg.heatmapResolution);
    const cellHeight = heatmapPriceRange / cfg.heatmapResolution;
    if (confirmed && (i + 1) % cfg.heatmapCellBars === 0) {
      const cellLeft = Math.trunc(Math.max(0, i - cfg.heatmapCellBars + 1));
      const cellRight = i + 1;
      const draw = (levels: Level[], idx: number[], strengths: number[]) => {
        idx.forEach((k, j) => {
          const lv = levels[k];
          const norm = heatmapNorm(strengths[j], maxStrength);
          const half = cellHeight * 0.5;
          lv.lastBox = box.new(cellLeft, lv.price + half, cellRight, lv.price - half, 'transparent', undefined,
            undefined, undefined, undefined, color.new(heatmapColor(norm), 33));
          lv.lastNorm = norm;
          lv.lastCellHeight = cellHeight;
          lv.lastDrawBar = i;
        });
      };
      draw(upper, upperIdx, upperStrength);
      draw(lower, lowerIdx, lowerStrength);
    }

    // Signals
    const signalOffset = (isNaN(signalAtr[i]) ? b.high - b.low : signalAtr[i]) * SIGNAL_OFFSET_MULTIPLIER;
    if (bullishSweepSignal) {
      markers.push({ id: 'shape0', time: t, position: 'atPriceBottom', price: b.low - signalOffset, shape: 'labelUp', color: bull, text: '▲', textColor: '#FFFFFF', size: 'small' });
    }
    if (bearishSweepSignal) {
      markers.push({ id: 'shape1', time: t, position: 'atPriceTop', price: b.high + signalOffset, shape: 'labelDown', color: bear, text: '▼', textColor: '#FFFFFF', size: 'small' });
    }

    // Trade drawings
    const openTrade = (dir: number, stopCandidate: number) => {
      const entry = b.open;
      const stop = stopCandidate;
      const risk = dir > 0 ? entry - stop : stop - entry;
      if (!gt(risk, mintick)) return;
      const step = risk * cfg.tradeRiskReward / TRADE_MILESTONE_COUNT;
      const targets: [number, number, number] = [entry + dir * step, entry + dir * step * 2.0, entry + dir * step * 3.0];
      const expiry = i + cfg.tradeExpiryBars;
      const clearBull = color.new(bull, 100);
      // stop box, target box, progress box
      box.new(i, dir > 0 ? entry : stop, expiry, dir > 0 ? stop : entry, color.new(bear, 100), undefined, undefined,
        'none', 'bar_index', color.new(bear, 82));
      box.new(i, dir > 0 ? targets[2] : entry, expiry, dir > 0 ? entry : targets[2], clearBull, undefined, undefined,
        'none', 'bar_index', color.new(bull, 90));
      const progressBox = box.new(i, entry, i, entry, clearBull, undefined, undefined, 'none', 'bar_index', clearBull);
      for (const y of targets) {
        line.new(i, y, expiry, y, 'bar_index', 'none', color.new(bull, 20), 'dashed', 1);
      }
      trades.push({ direction: dir, expiry, entry, stop, targets, reached: 0, progressBox });
    };
    if (cfg.showTradeDrawings && prevBullishSweep && !isNaN(bullishStopCandidate[i])) openTrade(1, bullishStopCandidate[i]);
    if (cfg.showTradeDrawings && prevBearishSweep && !isNaN(bearishStopCandidate[i])) openTrade(-1, bearishStopCandidate[i]);

    let bullishThirdTargetWick = false;
    let bearishThirdTargetWick = false;
    for (let k = trades.length - 1; k >= 0; k--) {
      const tr = trades[k];
      const pastExpiry = i > tr.expiry;
      const stopHit = tr.direction > 0 ? le(b.low, tr.stop) : ge(b.high, tr.stop);
      const [t1, t2, t3] = tr.targets;
      let newest = tr.reached;
      if (!pastExpiry) {
        newest = tr.direction > 0
          ? (ge(b.high, t3) ? 3 : ge(b.high, t2) ? 2 : ge(b.high, t1) ? 1 : tr.reached)
          : (le(b.low, t3) ? 3 : le(b.low, t2) ? 2 : le(b.low, t1) ? 1 : tr.reached);
      }
      if (newest > tr.reached) {
        if (newest >= TRADE_MILESTONE_COUNT && tr.reached < TRADE_MILESTONE_COUNT) {
          if (tr.direction > 0) bullishThirdTargetWick = true;
          else bearishThirdTargetWick = true;
        }
        const reachedPrice = newest === 3 ? t3 : newest === 2 ? t2 : t1;
        if (tr.direction > 0) {
          box.set_top(tr.progressBox, reachedPrice);
          box.set_bottom(tr.progressBox, tr.entry);
        } else {
          box.set_top(tr.progressBox, tr.entry);
          box.set_bottom(tr.progressBox, reachedPrice);
        }
        box.set_right(tr.progressBox, i);
        box.set_border_color(tr.progressBox, color.new(bull, 100));
        box.set_bgcolor(tr.progressBox, color.new(bull, 68));
        tr.reached = newest;
      }
      if (pastExpiry || stopHit || newest >= TRADE_MILESTONE_COUNT) trades.splice(k, 1);
    }

    if (bullishThirdTargetWick) {
      markers.push({ id: 'char2', time: t, position: 'aboveBar', shape: 'circle', char: '✅', color: bull, size: 'tiny' });
    }
    if (bearishThirdTargetWick) {
      markers.push({ id: 'char3', time: t, position: 'belowBar', shape: 'circle', char: '✅', color: bear, size: 'tiny' });
    }

    const upperDetected = confirmed && hShift.some(Boolean);
    const lowerDetected = confirmed && lShift.some(Boolean);
    [upperDetected, lowerDetected, upperDetected || lowerDetected, upperMitigated, lowerMitigated,
      upperMitigated || lowerMitigated, bullishSweepSignal, bearishSweepSignal].forEach((c, k) => flags[k].push(c));

    prevBullishSweep = bullishSweepSignal;
    prevBearishSweep = bearishSweepSignal;
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const LiquiditySweepHunterAlgo = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
  alertConditions,
};
