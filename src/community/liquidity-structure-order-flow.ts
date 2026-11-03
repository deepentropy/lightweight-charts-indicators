/**
 * Liquidity Structure & Order Flow [LuxAlgo]
 *
 * A volume profile of the last "Lookback Period" bars, drawn on the last bar. The range from the lowest low to the
 * highest high of the lookback is cut into 150 bins; the volume of each bar (weighted 1 - i / lookback for the bar i
 * bars back with "Weight Recent Volume") goes to the bin of its close, and the 5-bar EMA of the signed bar volume
 * (+volume on an up bar, -volume on a down bar) to a delta profile. The bins are smoothed with weights 1 / (1 + |s|)
 * over +/- "Profile Smoothing" bins. From the smoothed profile:
 * - the point of control (POC, the largest bin): three glowing lines over the lookback and a "POC" label;
 * - the value area (the bins around the POC that hold "Value Area %" of the volume, the larger neighbour first):
 *   dotted VAH / VAL lines from the last bar to the curves, and a dotted mid-range line;
 * - the widest void (the longest run of bins below 15 % of the POC volume): a small box and a "Void" label;
 * - a heatmap of the bins over the lookback (transparency from the bin volume, upper half in the upper colour);
 * - two cumulative curves (polylines) that grow from the mid-range towards the high and the low, drawn
 *   "Curves X-Offset" bars to the right, with filled areas and "Upper Vol" / "Lower Vol" labels;
 * - the delta profile inside the value area, as boxes from the last bar to the curves;
 * - bubbles for the bars of the lookback whose volume has a z-score of at least "Sensitivity" against its 200-bar
 *   mean and standard deviation (and at least 1.5 times the mean), placed in up to three lanes above the high (down
 *   bars) or below the low (up bars), with a dashed connector, a size from the z-score and the volume as text for
 *   large ones;
 * - a dashboard table.
 * The inputs "Min Bubble Size" and "Max Bubble Size" exist in the original but are not used by its code.
 *
 * Chart values read: the tick size (dashboard prices), the chart foreground and background colours (range box,
 * void box and label, mid line; dark theme #DBDBDB / #0F0F0F without a context).
 *
 * Alert (alertcondition, `alerts` of the result): 'Unusual Volume Detected', volume > mean + sensitivity * stdev
 * (200 bars).
 *
 * Reference: "Liquidity Structure & Order Flow [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, color, array, Series, line, box, label, polyline, table, chartPoint, resetDrawings, setDrawingBar,
  drawingOutputs, type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ChartPoint,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { backgroundColorOf, foregroundColorOf, mintickOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

type DashPos = 'Top Right' | 'Bottom Right' | 'Bottom Left';
type DashSize = 'Tiny' | 'Small' | 'Normal';

export interface LiquidityStructureOrderFlowInputs {
  lookbackInput: number;
  weightedInput: boolean;
  vaPercentInput: number;
  smoothingInput: number;
  showHeatmapInput: boolean;
  heatmapTranspInput: number;
  showPriceDeltaInput: boolean;
  priceDeltaIntensityInput: number;
  priceDeltaWidthInput: number;
  deltaEmaLenInput: number;
  showPocInput: boolean;
  showVoidInput: boolean;
  showVaInput: boolean;
  curveResolutionInput: number;
  curvesOffsetInput: number;
  bullColorInput: string;
  bearColorInput: string;
  showBubblesInput: boolean;
  volThresholdInput: number;
  bubbleMinSize: 'tiny' | 'small' | 'normal';
  bubbleMaxSize: 'small' | 'normal' | 'large' | 'huge';
  showDashInput: boolean;
  dashPosInput: DashPos;
  dashSizeInput: DashSize;
}

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';
const POC_COLOR = '#ff9800';
const DATA = '#DBDBDB';
const HEADERS = '#808080';
const BACKGROUND = '#161616';
const BORDERS = '#2E2E2E';
const BINS_COUNT = 150;
/** Default box text colour of Pine v6 (the boxes have no text) */
const BOX_TEXT = '#FFFFFF';

export const defaultInputs: LiquidityStructureOrderFlowInputs = {
  lookbackInput: 300,
  weightedInput: false,
  vaPercentInput: 70.0,
  smoothingInput: 3,
  showHeatmapInput: true,
  heatmapTranspInput: 40,
  showPriceDeltaInput: true,
  priceDeltaIntensityInput: 50,
  priceDeltaWidthInput: 100,
  deltaEmaLenInput: 5,
  showPocInput: true,
  showVoidInput: true,
  showVaInput: true,
  curveResolutionInput: 2,
  curvesOffsetInput: 100,
  bullColorInput: BULL_COLOR,
  bearColorInput: BEAR_COLOR,
  showBubblesInput: true,
  volThresholdInput: 2.0,
  bubbleMinSize: 'tiny',
  bubbleMaxSize: 'large',
  showDashInput: true,
  dashPosInput: 'Top Right',
  dashSizeInput: 'Small',
};

const G1 = 'Volume Profile Settings';
const G2 = 'Visualization';
const G3 = 'Dashboard';
const G4 = 'Unusual Volume Bubbles';
const G_DELTA = 'Volume Delta Backdrop';

export const inputConfig: InputConfig[] = [
  { id: 'lookbackInput', type: 'int', title: 'Lookback Period', defval: 300, min: 50, group: G1 },
  { id: 'weightedInput', type: 'bool', title: 'Weight Recent Volume', defval: false, group: G1 },
  { id: 'vaPercentInput', type: 'float', title: 'Value Area %', defval: 70.0, min: 1, max: 100, step: 5, group: G1 },
  { id: 'smoothingInput', type: 'int', title: 'Profile Smoothing', defval: 3, min: 0, max: 10, group: G1 },
  { id: 'showHeatmapInput', type: 'bool', title: 'Show Heatmap', defval: true, group: G2 },
  { id: 'heatmapTranspInput', type: 'int', title: 'Heatmap Transparency', defval: 40, min: 0, max: 100, group: G2 },
  { id: 'showPriceDeltaInput', type: 'bool', title: 'Show Volume Delta Panel', defval: true, group: G_DELTA },
  { id: 'priceDeltaIntensityInput', type: 'int', title: 'Delta Intensity', defval: 50, min: 0, max: 100, group: G_DELTA },
  { id: 'priceDeltaWidthInput', type: 'int', title: 'Delta Panel Width', defval: 100, min: 10, max: 300, group: G_DELTA },
  { id: 'deltaEmaLenInput', type: 'int', title: 'Delta Smoothing Length', defval: 5, min: 1, group: G_DELTA },
  { id: 'showPocInput', type: 'bool', title: 'Show Point of Control (POC)', defval: true, group: G2 },
  { id: 'showVoidInput', type: 'bool', title: 'Highlight Widest Void', defval: true, group: G2 },
  { id: 'showVaInput', type: 'bool', title: 'Show Value Area (VAH/VAL)', defval: true, group: G2 },
  { id: 'curveResolutionInput', type: 'int', title: 'Curve Resolution (Sampling)', defval: 2, min: 1, max: 10, group: G2 },
  { id: 'curvesOffsetInput', type: 'int', title: 'Curves X-Offset (Future Bars)', defval: 100, min: 20, group: G2 },
  { id: 'bullColorInput', type: 'color', title: 'Lower Depth Color', defval: BULL_COLOR, group: G2, inline: 'c1' },
  { id: 'bearColorInput', type: 'color', title: 'Upper Depth Color', defval: BEAR_COLOR, group: G2, inline: 'c1' },
  { id: 'showBubblesInput', type: 'bool', title: 'Show Bubbles', defval: true, group: G4 },
  {
    id: 'volThresholdInput', type: 'float', title: 'Sensitivity (Z-Score)', defval: 2.0, min: 0.5, max: 10.0, step: 0.5,
    group: G4, tooltip: 'Standard deviations above mean volume to trigger a bubble.',
  },
  {
    id: 'bubbleMinSize', type: 'string', title: 'Min Bubble Size', defval: 'tiny', options: ['tiny', 'small', 'normal'],
    group: G4, inline: 'sz',
  },
  {
    id: 'bubbleMaxSize', type: 'string', title: 'Max Bubble Size', defval: 'large',
    options: ['small', 'normal', 'large', 'huge'], group: G4, inline: 'sz',
  },
  { id: 'showDashInput', type: 'bool', title: 'Show Dashboard', defval: true, group: G3 },
  {
    id: 'dashPosInput', type: 'string', title: 'Position', defval: 'Top Right',
    options: ['Top Right', 'Bottom Right', 'Bottom Left'], group: G3,
  },
  { id: 'dashSizeInput', type: 'string', title: 'Size', defval: 'Small', options: ['Tiny', 'Small', 'Normal'], group: G3 },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box', 'line', 'label', 'polyline', 'table'];

/** The original's alertcondition */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Unusual Volume Detected', message: 'Extreme volume spike detected on {{ticker}}' },
];

export const metadata = {
  title: 'Liquidity Structure & Order Flow [LuxAlgo]',
  shortTitle: 'LuxAlgo - Liquidity Structure & Order Flow',
  overlay: true,
};

/** max_lines_count / max_labels_count / max_boxes_count of the script */
const MAX_OBJECTS = 500;

/** Pine float comparisons (within 1e-10; na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const ge = (a: number, b: number) => a - b >= -1e-10;
const le = (a: number, b: number) => a - b <= 1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;
const nz = (v: number) => (Number.isNaN(v) ? 0 : v);

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquidityStructureOrderFlowInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const lookback = Math.trunc(cfg.lookbackInput);
  const smoothing = Math.trunc(cfg.smoothingInput);
  const offset = Math.trunc(cfg.curvesOffsetInput);
  const resolution = Math.trunc(cfg.curveResolutionInput);
  const thr = cfg.volThresholdInput;
  const bull = cfg.bullColorInput;
  const bear = cfg.bearColorInput;
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);
  const mintick = mintickOf(chart);
  const dashPos = ({ 'Top Right': 'top_right', 'Bottom Right': 'bottom_right', 'Bottom Left': 'bottom_left' } as const)[cfg.dashPosInput];
  const dashSize = ({ Tiny: 'tiny', Small: 'small', Normal: 'normal' } as const)[cfg.dashSizeInput];
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const num = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);

  const volume = bars.map((b) => num(b.volume));
  const volS = Series.fromArray(bars, volume);
  const volMa = ta.sma(volS, 200).toArray().map(num);
  const volStd = ta.stdev(volS, 200).toArray().map(num);
  // isUnusual = volume > volMa + volThresholdInput * volStd
  const unusual = volume.map((v, i) => gt(v, volMa[i] + thr * volStd[i]));
  const base = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    alerts: alertStates(alertConditions, bars, [unusual]),
  };

  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS, box: MAX_OBJECTS });
  if (n === 0) return base;

  const highs = ta.highest(new Series(bars, (b) => b.high), lookback).toArray().map(num);
  const lows = ta.lowest(new Series(bars, (b) => b.low), lookback).toArray().map(num);
  const rawBarDelta = bars.map((b) => (gt(b.close, b.open) ? num(b.volume) : lt(b.close, b.open) ? -num(b.volume) : 0.0));
  const smoothDelta = ta.ema(Series.fromArray(bars, rawBarDelta), Math.trunc(cfg.deltaEmaLenInput)).toArray().map(num);

  // barstate.islast
  const L = n - 1;
  setDrawingBar(L, true);
  const at = (a: ArrayLike<number>, k: number) => (k >= 0 && k < a.length ? a[k] : NaN);
  const closes = bars.map((b) => b.close);
  const opens = bars.map((b) => b.open);
  const hiArr = bars.map((b) => b.high);
  const loArr = bars.map((b) => b.low);
  const hi = highs[L];
  const lo = lows[L];
  const priceRange = hi - lo;
  const mid = (hi + lo) / 2;
  const binStep = priceRange / BINS_COUNT;

  const rawBins: number[] = new Array(BINS_COUNT).fill(0.0);
  const smoothBins: number[] = new Array(BINS_COUNT).fill(0.0);
  const dProfile: number[] = new Array(BINS_COUNT).fill(0.0);
  let buyAgg = 0.0, sellAgg = 0.0;

  // 1. raw profile and delta distribution
  for (let i = 0; i <= lookback - 1; i++) {
    const w = cfg.weightedInput ? 1.0 - i / lookback : 1.0;
    const p = at(closes, L - i);
    const v = nz(at(volume, L - i)) * w;
    if (gt(at(closes, L - i), at(opens, L - i))) buyAgg += v;
    else if (lt(at(closes, L - i), at(opens, L - i))) sellAgg += v;
    const bIdx = Math.min(BINS_COUNT - 1, Math.max(0, Math.trunc((p - lo) / binStep)));
    rawBins[bIdx] = rawBins[bIdx] + v;
    dProfile[bIdx] = dProfile[bIdx] + at(smoothDelta, L - i);
  }

  // 2. smoothed heatmap
  for (let k = 0; k <= BINS_COUNT - 1; k++) {
    let sum = 0.0, wSum = 0.0;
    for (let s = -smoothing; s <= smoothing; s++) {
      const idx = k + s;
      if (idx >= 0 && idx < BINS_COUNT) {
        const sw = 1.0 / (1.0 + Math.abs(s));
        sum += rawBins[idx] * sw;
        wSum += sw;
      }
    }
    smoothBins[k] = sum / wSum;
  }

  const maxVol = array.max(array.from(...smoothBins));
  const totalVol = array.sum(array.from(...rawBins));
  const pocIdx = array.indexof(array.from(...smoothBins), maxVol);
  const pocPrice = lo + binStep * pocIdx + binStep / 2;

  // 3. widest void
  const vThres = maxVol * 0.15;
  let lVoidStart = 0, lVoidEnd = 0, cVoidStart = -1, mVoidLen = 0;
  for (let k = 0; k <= BINS_COUNT - 1; k++) {
    if (lt(smoothBins[k], vThres)) {
      if (cVoidStart === -1) cVoidStart = k;
      const len = k - cVoidStart + 1;
      if (len > mVoidLen) {
        mVoidLen = len;
        lVoidStart = cVoidStart;
        lVoidEnd = k;
      }
    } else {
      cVoidStart = -1;
    }
  }
  const voidTop = lo + (lVoidEnd + 1) * binStep;
  const voidBot = lo + lVoidStart * binStep;
  const voidMid = (voidTop + voidBot) / 2;

  // 4. value area
  const vaTarget = totalVol * (cfg.vaPercentInput / 100.0);
  let curVaVol = at(smoothBins, pocIdx);
  let upIdx = pocIdx, dnIdx = pocIdx;
  while (lt(curVaVol, vaTarget) && (upIdx < BINS_COUNT - 1 || dnIdx > 0)) {
    const uV = upIdx < BINS_COUNT - 1 ? smoothBins[upIdx + 1] : 0.0;
    const dV = dnIdx > 0 ? smoothBins[dnIdx - 1] : 0.0;
    if (ge(uV, dV) && upIdx < BINS_COUNT - 1) {
      upIdx += 1;
      curVaVol += uV;
    } else if (dnIdx > 0) {
      dnIdx -= 1;
      curVaVol += dV;
    } else {
      break;
    }
  }
  const vah = lo + (upIdx + 1) * binStep;
  const val = lo + dnIdx * binStep;

  let upperVolTotal = 0.0, lowerVolTotal = 0.0;
  for (let k = 0; k <= BINS_COUNT - 1; k++) {
    if (ge(lo + k * binStep, mid)) upperVolTotal += smoothBins[k];
    else lowerVolTotal += smoothBins[k];
  }
  const upperPerc = (upperVolTotal / totalVol) * 100;
  const lowerPerc = (lowerVolTotal / totalVol) * 100;
  const deltaAgg = buyAgg - sellAgg;
  const skewRatio = upperVolTotal / Math.max(0.1, lowerVolTotal);
  const close = closes[L];
  const distToPoc = ((close - pocPrice) / close) * 100;
  const rangeLoc = ((close - lo) / Math.max(0.0001, priceRange)) * 100;

  // curve offsets
  let maxCum = 0.0, tempCum = 0.0;
  const midBin = Math.trunc(BINS_COUNT / 2);
  for (let k = 0; k <= BINS_COUNT - 1; k++) {
    tempCum += smoothBins[k] / maxVol;
    if (k === midBin || k === BINS_COUNT - 1) {
      maxCum = Math.max(maxCum, tempCum);
      tempCum = 0.0;
    }
  }
  const scaleFactor = (offset * 0.9) / Math.max(0.1, maxCum);
  const curveX: number[] = new Array(BINS_COUNT).fill(L + offset);
  for (let k = midBin; k <= BINS_COUNT - 1; k++) {
    let localCum = 0.0;
    for (let s = midBin; s <= k; s++) localCum += smoothBins[s] / maxVol;
    curveX[k] = L + offset - localCum * scaleFactor;
  }
  for (let k = midBin - 1; k >= 0; k--) {
    let localCum = 0.0;
    for (let s = k; s <= midBin - 1; s++) localCum += smoothBins[s] / maxVol;
    curveX[k] = L + offset - localCum * scaleFactor;
  }

  // 5. volume delta panel
  if (cfg.showPriceDeltaInput) {
    let maxD = 0.0;
    for (const dVal of dProfile) maxD = Math.max(maxD, Math.abs(dVal));
    const intensity = cfg.priceDeltaIntensityInput;
    for (let k = 0; k <= BINS_COUNT - 1; k++) {
      const dVal = dProfile[k];
      const bBot = lo + binStep * k;
      const bTop = bBot + binStep;
      if (gt(Math.abs(dVal), 0) && ge(bBot, val) && le(bTop, vah)) {
        // getDeltaColor(dVal, maxD, intensity)
        const norm = maxD > 0 ? Math.abs(dVal) / maxD : 0.0;
        const baseCol = ge(dVal, 0) ? BULL_COLOR : BEAR_COLOR;
        const transp = 100 - Math.trunc(norm * (intensity / 100.0) * 85);
        const dCol = String(color.new(baseCol, transp));
        const xLimit = Math.trunc(curveX[k]);
        if (xLimit > L) {
          box.new(L, bTop, xLimit, bBot, 'transparent', undefined, undefined, undefined, undefined, dCol, undefined,
            undefined, BOX_TEXT);
        }
      }
    }
  }

  // 6. liquidity heatmap
  if (cfg.showHeatmapInput) {
    const tr = cfg.heatmapTranspInput;
    for (let k = 0; k <= BINS_COUNT - 1; k++) {
      const norm = smoothBins[k] / maxVol;
      if (gt(norm, 0.01)) {
        const bBot = lo + binStep * k;
        const bTop = bBot + binStep;
        const dyTr = Math.trunc(tr + (100 - tr) * (1.0 - Math.pow(norm, 0.7)));
        const bCl = gt(bBot + binStep / 2, mid) ? bear : bull;
        box.new(L - lookback, bTop, L, bBot, 'transparent', undefined, undefined, undefined, undefined,
          String(color.new(bCl, dyTr)), undefined, undefined, BOX_TEXT);
      }
    }
    box.new(L - lookback, hi, L, lo, String(color.new(fg, 70)), undefined, 'dotted', undefined, undefined, 'transparent',
      undefined, undefined, BOX_TEXT);
  }

  // 6.1 unusual volume bubbles (lanes)
  if (cfg.showBubblesInput) {
    const bearBaseY = hi + priceRange * 0.08;
    const bullBaseY = lo - priceRange * 0.08;
    const laneGap = priceRange * 0.06;
    const bearLanesX = [1e10, 1e10, 1e10];
    const bullLanesX = [1e10, 1e10, 1e10];
    for (let i = 0; i <= lookback - 1; i++) {
      const j = L - i;
      const v = nz(at(volume, j));
      const ma = nz(at(volMa, j));
      const sd = nz(at(volStd, j));
      const z = sd > 0 ? (v - ma) / sd : 0.0;
      const rvol = ma > 0 ? v / ma : 0.0;
      if (ge(z, thr) && gt(rvol, 1.5)) {
        const isBull = gt(at(closes, j), at(opens, j));
        const baseCol = isBull ? bull : bear;
        const x = j;
        const clearance = ge(z, thr + 5) ? 14 : ge(z, thr + 3) ? 10 : 6;
        let lane = 0;
        const activeLanesX = isBull ? bullLanesX : bearLanesX;
        let foundLane = false;
        for (let l = 0; l <= 2; l++) {
          if (ge(activeLanesX[l] - x, clearance)) {
            lane = l;
            activeLanesX[l] = x;
            foundLane = true;
            break;
          }
        }
        if (!foundLane) {
          lane = array.indexof(array.from(...activeLanesX), Math.max(...activeLanesX));
          activeLanesX[lane] = x;
        }
        const targetY = isBull ? bullBaseY - lane * laneGap : bearBaseY + lane * laneGap;
        const startY = isBull ? at(loArr, j) : at(hiArr, j);
        line.new(x, startY, x, targetY, 'bar_index', 'none', String(color.new(baseCol, 75)), 'dashed', 1);
        const bSize = lt(z, thr + 1) ? 'tiny' : lt(z, thr + 3) ? 'small' : lt(z, thr + 5) ? 'normal' : lt(z, thr + 7) ? 'large' : 'huge';
        const normZ = Math.min(1.0, (z - thr) / 6.0);
        const bCol = String(color.new(baseCol, 20 + Math.trunc((1.0 - normZ) * 60)));
        const volTxt = ge(z, thr + 3) ? str.tostring(nz(at(volume, j)), 'volume') : '';
        if (ge(z, thr + 4)) {
          label.new(x, targetY, '', 'bar_index', 'price', String(color.new(baseCol, 85)), 'circle', undefined, 'huge');
        }
        label.new(x, targetY, volTxt, 'bar_index', 'price', bCol, volTxt !== '' ? 'label_center' : 'circle', color.white,
          bSize);
      }
    }
  }

  const boxEnd = L;
  const drawEnd = L + offset;
  if (cfg.showPocInput) {
    line.new(L - lookback, pocPrice, boxEnd, pocPrice, 'bar_index', 'none', String(color.new(POC_COLOR, 85)), 'solid', 10);
    line.new(L - lookback, pocPrice, boxEnd, pocPrice, 'bar_index', 'none', String(color.new(POC_COLOR, 60)), 'solid', 4);
    line.new(L - lookback, pocPrice, boxEnd, pocPrice, 'bar_index', 'none', POC_COLOR, 'solid', 1);
    label.new(boxEnd + 2, pocPrice, 'POC', 'bar_index', 'price', POC_COLOR, 'label_left', color.white, 'small');
  }
  if (cfg.showVoidInput) {
    box.new(L + 2, voidTop, L + 6, voidBot, String(color.new(fg, 70)), undefined, undefined, undefined, undefined,
      String(color.new(fg, 90)), undefined, undefined, BOX_TEXT);
    label.new(L + 6, voidMid, 'Void', 'bar_index', 'price', String(color.new(fg, 30)), 'label_left', bg, 'small');
  }
  if (cfg.showVaInput) {
    line.new(boxEnd, vah, drawEnd, vah, 'bar_index', 'none', bear, 'dotted');
    line.new(boxEnd, val, drawEnd, val, 'bar_index', 'none', bull, 'dotted');
  }
  line.new(boxEnd, mid, drawEnd, mid, 'bar_index', 'none', String(color.new(fg, 70)), 'dotted');

  // 7. cumulative curves
  const cpSf: ChartPoint[] = [], cpBf: ChartPoint[] = [];
  const cpSl: ChartPoint[] = [], cpBl: ChartPoint[] = [];
  cpSf.push(chartPoint.from_index(L + offset, mid));
  for (let k = midBin; k <= BINS_COUNT - 1; k += resolution) {
    const p = chartPoint.from_index(Math.trunc(curveX[k]), lo + binStep * k + binStep / 2);
    cpSf.push(p);
    cpSl.push(p);
  }
  cpSf.push(chartPoint.from_index(L + offset, hi));
  cpBf.push(chartPoint.from_index(L + offset, mid));
  for (let i = 0; i <= midBin - 1; i += resolution) {
    const k = midBin - 1 - i;
    const p = chartPoint.from_index(Math.trunc(curveX[k]), lo + binStep * k + binStep / 2);
    cpBf.push(p);
    cpBl.push(p);
  }
  cpBf.push(chartPoint.from_index(L + offset, lo));
  polyline.new(cpSf, false, true, 'bar_index', 'transparent', String(color.new(bear, 80)));
  polyline.new(cpBf, false, true, 'bar_index', 'transparent', String(color.new(bull, 80)));
  polyline.new(cpSl, false, false, 'bar_index', bear, undefined, undefined, 2);
  polyline.new(cpBl, false, false, 'bar_index', bull, undefined, undefined, 2);

  // labels of the curves
  const xHeatmapEnd = L;
  const xSpine = L + offset;
  const xMid = L + offset / 2;
  const xUpperTip = curveX[BINS_COUNT - 1];
  const xLowerTip = curveX[0];
  const labelXUp = eq(upperVolTotal, 0) || ge(xUpperTip, xSpine) ? xHeatmapEnd : le(xUpperTip, xMid) ? xMid : xUpperTip;
  const labelXDn = eq(lowerVolTotal, 0) || ge(xLowerTip, xSpine) ? xHeatmapEnd : le(xLowerTip, xMid) ? xMid : xLowerTip;
  label.new(Math.trunc(labelXUp), hi, `Upper Vol: ${str.tostring(upperVolTotal, 'volume')}`, 'bar_index', 'price', bear,
    eq(labelXUp, xMid) ? 'label_down' : 'label_right', color.white, 'small');
  label.new(Math.trunc(labelXDn), lo, `Lower Vol: ${str.tostring(lowerVolTotal, 'volume')}`, 'bar_index', 'price', bull,
    eq(labelXDn, xMid) ? 'label_up' : 'label_right', color.white, 'small');

  if (cfg.showDashInput) {
    const dash = table.new(dashPos, 2, 13, BACKGROUND, BORDERS, 1);
    const cell = (col: number, row: number, txt: string, c = '#FFFFFF', halign: 'left' | 'center' | 'right' = 'right') =>
      table.cell(dash, col, row, txt, undefined, undefined, c, halign, undefined, dashSize);
    const divider = (row: number, lastCol: number) => {
      table.merge_cells(dash, 0, row, lastCol, row);
      cell(0, row, '━━━━━━━━━━━━━━━━━━', BORDERS, 'center');
    };
    const pct = (x: number) => `${str.tostring(x, '#.##')}%`;
    table.merge_cells(dash, 0, 0, 1, 0);
    cell(0, 0, 'Liquidity Depth', DATA, 'center');
    divider(1, 1);
    cell(0, 2, 'POC Price', HEADERS, 'left');
    cell(1, 2, str.tostring(pocPrice, 'mintick', mintick), DATA);
    cell(0, 3, 'Dist. to POC', HEADERS, 'left');
    cell(1, 3, pct(distToPoc), DATA);
    cell(0, 4, 'VA Range', HEADERS, 'left');
    cell(1, 4, `${str.tostring(val, 'mintick', mintick)} - ${str.tostring(vah, 'mintick', mintick)}`, DATA);
    divider(5, 1);
    cell(0, 6, 'Mass Skew', HEADERS, 'left');
    cell(1, 6, `${str.tostring(skewRatio, '#.##')}x`, DATA);
    cell(0, 7, 'Upper Mass', bear, 'left');
    cell(1, 7, pct(upperPerc), DATA);
    cell(0, 8, 'Lower Mass', bull, 'left');
    cell(1, 8, pct(lowerPerc), DATA);
    divider(9, 1);
    cell(0, 10, 'Agg. Delta', HEADERS, 'left');
    cell(1, 10, str.tostring(deltaAgg, 'volume'), ge(deltaAgg, 0) ? BULL_COLOR : BEAR_COLOR);
    cell(0, 11, 'Range Loc.', HEADERS, 'left');
    cell(1, 11, pct(rangeLoc), DATA);
    cell(0, 12, 'Total Volume', HEADERS, 'left');
    cell(1, 12, str.tostring(totalVol, 'volume'), DATA);
  }
  setDrawingBar(null);

  return { ...base, ...drawingOutputs(bars, ms ? 'ms' : 's') };
}

export const LiquidityStructureOrderFlow = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  alertConditions,
};
