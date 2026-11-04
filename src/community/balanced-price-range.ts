/**
 * Balanced Price Range (BPR)
 *
 * A balanced price range is the overlap of a bearish and a bullish fair value gap (FVG) that come within a few bars
 * of each other. A bearish FVG is a bar whose high is below the low of two bars back; a bullish FVG a bar whose low
 * is above the high of two bars back. When a bullish FVG comes at most "Bars to Look Back for BPR" bars after the
 * last bearish FVG, the overlap of the two gaps (from the higher of the two gap bottoms to the lower of the two gap
 * tops) is a bullish BPR when it is at least "BPR Threshold" high; the bearish BPR is the mirror case. "Only Clean
 * BPR" also asks that no bar between the two gaps entered the range.
 *
 * Each BPR is drawn as a box from the first gap to the bar after the confirmation (one bar later). The box grows by
 * one bar while price stays outside it (lows above the bottom of a bullish box, highs below the top of a bearish
 * box) and stops when price enters it. "Delete Old BPR" deletes a box when it is entered or when a new one of the
 * same side comes. At most 500 boxes are kept.
 *
 * Reference: "Balanced Price Range - BPR [TFO]" by tradeforopp
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tradeforopp
 */

import {
  box, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Box, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface BalancedPriceRangeInputs {
  /** Smallest height of a BPR */
  bprThreshold: number;
  /** Largest distance in bars between the two fair value gaps */
  barsSince: number;
  /** Only BPRs that price did not enter before they were complete */
  onlyCleanBpr: boolean;
  /** Delete the boxes that were entered or replaced */
  deleteOldBpr: boolean;
  bearishBprColor: string;
  bullishBprColor: string;
}

export const defaultInputs: BalancedPriceRangeInputs = {
  bprThreshold: 0,
  barsSince: 10,
  onlyCleanBpr: false,
  deleteOldBpr: false,
  bearishBprColor: 'rgba(255, 82, 82, 0.3)',
  bullishBprColor: 'rgba(76, 175, 80, 0.3)',
};

export const inputConfig: InputConfig[] = [
  { id: 'bprThreshold', type: 'float', title: 'BPR Threshold', defval: 0, step: 0.25,
    tooltip: "Valid BPR's must have a range greater than this number" },
  { id: 'barsSince', type: 'int', title: 'Bars to Look Back for BPR', defval: 10,
    tooltip: "Only look for BPR's when a sequence of bearish and bullish FVG's are within this many bars of each other" },
  { id: 'onlyCleanBpr', type: 'bool', title: 'Only Clean BPR', defval: false,
    tooltip: "Only show BPR's when price does not interfere with the range prior to its completion" },
  { id: 'deleteOldBpr', type: 'bool', title: 'Delete Old BPR', defval: false,
    tooltip: "Delete all BPR's that have been invalidated or overwritten. Only show current/active BPR's" },
  { id: 'bearishBprColor', type: 'color', title: 'bearish_bpr_color', defval: 'rgba(255, 82, 82, 0.3)' },
  { id: 'bullishBprColor', type: 'color', title: 'bullish_bpr_color', defval: 'rgba(76, 175, 80, 0.3)' },
];

export const plotConfig: PlotConfig[] = [];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Alert', message: 'New Bullish BPR' },
  { id: 'alert1', title: 'Bearish Alert', message: 'New Bearish BPR' },
];

/** Drawing kinds the script uses */
export const drawingKinds: StudyDrawingKind[] = ['box'];

export const metadata = {
  title: 'Balanced Price Range - BPR [TFO]',
  shortTitle: 'BPR [TFO]',
  overlay: true,
};

/** indicator(max_boxes_count = 500) */
const MAX_BOXES = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b when a - b >= -1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<BalancedPriceRangeInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const barsSince = Math.trunc(cfg.barsSince);
  const threshold = cfg.bprThreshold;
  const H = (i: number) => (i >= 0 ? bars[i].high : NaN);
  const L = (i: number) => (i >= 0 ? bars[i].low : NaN);

  // new_fvg_bearish = low[2] - high > 0, new_fvg_bullish = low - high[2] > 0
  const fvgBear = bars.map((b, i) => gt(L(i - 2) - b.high, 0));
  const fvgBull = bars.map((b, i) => gt(b.low - H(i - 2), 0));
  // bull_num_since = ta.barssince(new_fvg_bearish), bear_num_since = ta.barssince(new_fvg_bullish)
  const sinceBear: number[] = [];
  const sinceBull: number[] = [];
  let lastBear = NaN;
  let lastBull = NaN;
  for (let i = 0; i < n; i++) {
    if (fvgBear[i]) lastBear = i;
    if (fvgBull[i]) lastBull = i;
    sinceBear.push(i - lastBear);
    sinceBull.push(i - lastBull);
  }

  resetDrawings({ box: MAX_BOXES });
  const boxBearish = varDrawing<Box>();
  const boxBullish = varDrawing<Box>();

  /** One side; returns the per-bar result (bull_result / bear_result) */
  const side = (bull: boolean) => {
    const result: boolean[] = new Array(n).fill(false);
    const combinedLow: number[] = new Array(n).fill(NaN);
    const combinedHigh: number[] = new Array(n).fill(NaN);
    const since = bull ? sinceBear : sinceBull;
    const isFvg = bull ? fvgBull : fvgBear;
    for (let i = 0; i < n; i++) {
      const k = since[i];
      // cond_1: a new FVG of this side and the last FVG of the other side at most bars_since bars back
      const cond1 = isFvg[i] && le(k, barsSince);
      if (!cond1) continue;
      // cond_2 (a sum of positive prices, as written in the original)
      const lhs = H(i - k) + L(i - k - 2) + H(i - 2) + L(i);
      const cond2 = gt(lhs, Math.max(L(i - k - 2), L(i)) - Math.min(H(i - k), H(i - 2)));
      if (!cond2) continue;
      const lo = bull ? Math.max(H(i - k), H(i - 2)) : Math.max(H(i - k - 2), H(i));
      const hi = bull ? Math.min(L(i - k - 2), L(i)) : Math.min(L(i - k), L(i - 2));
      combinedLow[i] = lo;
      combinedHigh[i] = hi;
      let cond3 = true;
      if (cfg.onlyCleanBpr) {
        // for h = 2 to num_since (counts down when num_since < 2)
        const step = k >= 2 ? 1 : -1;
        for (let h = 2; step > 0 ? h <= k : h >= k; h += step) {
          if (bull ? gt(H(i - h), lo) : lt(L(i - h), hi)) cond3 = false;
        }
      }
      result[i] = cond3 && ge(hi - lo, threshold);
    }
    return { result, combinedLow, combinedHigh };
  };

  const bullSide = side(true);
  const bearSide = side(false);
  const bullAlert: boolean[] = new Array(n).fill(false);
  const bearAlert: boolean[] = new Array(n).fill(false);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    // Bullish BPR
    if (i > 0 && bullSide.result[i - 1]) {
      bullAlert[i] = true;
      if (cfg.deleteOldBpr && boxBullish.value) box.delete(boxBullish.value);
      boxBullish.value = box.new(i - sinceBear[i] - 1, bullSide.combinedHigh[i - 1], i + 1, bullSide.combinedLow[i - 1],
        cfg.bullishBprColor, 1, undefined, undefined, undefined, cfg.bullishBprColor);
    }
    if (boxBullish.value) {
      const bx = boxBullish.value;
      if (gt(b.low, box.get_bottom(bx))) box.set_right(bx, i + 1);
      else if (lt(b.low, box.get_bottom(bx))) {
        if (cfg.deleteOldBpr) box.delete(bx);
        else boxBullish.value = undefined;
      }
    }
    // Bearish BPR
    if (i > 0 && bearSide.result[i - 1]) {
      bearAlert[i] = true;
      if (cfg.deleteOldBpr && boxBearish.value) box.delete(boxBearish.value);
      boxBearish.value = box.new(i - sinceBull[i] - 1, bearSide.combinedHigh[i - 1], i + 1, bearSide.combinedLow[i - 1],
        cfg.bearishBprColor, 1, undefined, undefined, undefined, cfg.bearishBprColor);
    }
    if (boxBearish.value) {
      const bx = boxBearish.value;
      if (lt(b.high, box.get_top(bx))) box.set_right(bx, i + 1);
      else if (gt(b.high, box.get_top(bx))) {
        if (cfg.deleteOldBpr) box.delete(bx);
        else boxBearish.value = undefined;
      }
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    // alertcondition(bull_result[1], ...) / alertcondition(bear_result[1], ...)
    alerts: alertStates(alertConditions, bars, [bullAlert, bearAlert]),
  };
}

export const BalancedPriceRange = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  drawingKinds,
};
