/**
 * High Probability Order Blocks [AlgoAlpha]
 *
 * Runs of up (down) candle bodies are summed (reset by a candle of the other side) and normalised as a z-score over
 * "Z-Score Window" bars. A z-score crossing above 4 creates a bullish order block on the last down candle (its high
 * to low, with a dashed mid line); a crossing of the down z-score creates a bearish block on the last up candle. With
 * "Prevent Overlap" a block that overlaps a live block is not created. Live blocks extend to the current bar; a
 * bullish block is mitigated by two closes below its bottom (bearish: two closes above its top) and expires after
 * "Max Box Age" bars: it then stops extending (the box stays on the chart). A close back across the top of a bullish
 * block (bottom of a bearish block) is a rejection: a character at 2 ATR(14) below the low (above the high).
 *
 * Reliability: a Kaplan-Meier survival curve per side from the latest "KM Training Window" blocks (mitigation =
 * event, expiry and live blocks = censored). On the last bar each live block shows its age and its survival
 * probability at that age ("N.E.D" below "Minimum Sample Size" blocks), and a panel 50 to 500 bars right of the last
 * bar draws the axes, a dotted grid with labels, and the two survival curves (polylines). The panel and box texts
 * use the chart foreground colour (chart context).
 *
 * Alerts (alertcondition, `alerts` of the result): Bullish Zone Created, Bearish Zone Created, Bullish Rejection,
 * Bearish Rejection.
 *
 * Reference: "High Probability Order Blocks [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoAlpha
 */

import {
  ta, str, color, line, label, box, polyline, chartPoint, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type Box, type ChartPoint, type IndicatorResult, type InputConfig, type Line, type MarkerData,
  type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import { foregroundColorOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface HighProbabilityOrderBlocksInputs {
  /** Do not create blocks that overlap live blocks */
  preventOverlap: boolean;
  /** Bars of the z-score */
  zLen: number;
  /** Bars after which a block expires */
  maxAge: number;
  /** Latest blocks per side used by the survival curve */
  kmLookback: number;
  /** Blocks needed for a survival value */
  kmMinSamples: number;
  /** Draw the survival panel */
  showKmPanel: boolean;
  kmAxisCol: string;
  kmGridCol: string;
  bullCol: string;
  bearCol: string;
  /** Size of the box texts */
  probTxtSizeOpt: 'Tiny' | 'Small' | 'Medium' | 'Large';
}

export const defaultInputs: HighProbabilityOrderBlocksInputs = {
  preventOverlap: true,
  zLen: 50,
  maxAge: 2000,
  kmLookback: 70,
  kmMinSamples: 5,
  showKmPanel: true,
  kmAxisCol: '#FFFFFF',
  kmGridCol: 'rgba(178, 181, 190, 0.4)',
  bullCol: '#00ffbb',
  bearCol: '#ff1100',
  probTxtSizeOpt: 'Tiny',
};

export const inputConfig: InputConfig[] = [
  { id: 'preventOverlap', type: 'bool', title: 'Prevent Overlap', defval: true, group: 'Calculation', tooltip: 'Avoid creating blocks that overlap existing ones.' },
  { id: 'zLen', type: 'int', title: 'Z-Score Window (bars)', defval: 50, min: 1, group: 'Calculation', tooltip: 'Bars used to normalize distance into z-scores. Bigger = smoother; smaller = faster.' },
  { id: 'maxAge', type: 'int', title: 'Max Box Age (bars)', defval: 2000, min: 1, group: 'Calculation', tooltip: 'Expire blocks after this many bars if not mitigated.' },
  { id: 'kmLookback', type: 'int', title: 'KM Training Window (zones)', defval: 70, min: 1, group: 'Reliability Calculation', tooltip: 'Recent mitigated blocks kept per side (bullish/bearish) for KM. Higher = smoother, lower = more reactive.' },
  { id: 'kmMinSamples', type: 'int', title: 'Minimum Sample Size', defval: 5, min: 5, group: 'Reliability Calculation', tooltip: 'Minimum mitigated blocks needed to compute KM. Otherwise shows not enough data (N.E.D.)' },
  { id: 'showKmPanel', type: 'bool', title: 'Show KM Panel', defval: true, group: 'Appearance', tooltip: 'Toggle KM axes/grid and curves.' },
  { id: 'kmAxisCol', type: 'color', title: 'KM Axis Color', defval: '#FFFFFF', group: 'Appearance', tooltip: 'Axis line color.' },
  { id: 'kmGridCol', type: 'color', title: 'KM Grid Color', defval: 'rgba(178, 181, 190, 0.4)', group: 'Appearance', tooltip: 'Grid line color.' },
  { id: 'bullCol', type: 'color', title: 'Bullish Colour', defval: '#00ffbb', group: 'Appearance', tooltip: 'Color for bullish blocks and curve.' },
  { id: 'bearCol', type: 'color', title: 'Bearish Colour', defval: '#ff1100', group: 'Appearance', tooltip: 'Color for bearish blocks and curve.' },
  { id: 'probTxtSizeOpt', type: 'string', title: 'Probability Text Size', defval: 'Tiny', options: ['Tiny', 'Small', 'Medium', 'Large'], group: 'Appearance', tooltip: 'Text size inside each orderblock label.' },
];

export const plotConfig: PlotConfig[] = [];

export const shapeConfig: ShapeConfig[] = [
  { id: 'char0', kind: 'char', title: 'Bullish Rejection', char: '▲', location: 'absolute', color: '#00ffbb', size: 'tiny' },
  { id: 'char1', kind: 'char', title: 'Bearish Rejection', char: '▼', location: 'absolute', color: '#ff1100', size: 'tiny' },
];

export const drawingKinds: StudyDrawingKind[] = ['box', 'line', 'label', 'polyline'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Zone Created', message: 'Bullish OrderBlock Created' },
  { id: 'alert1', title: 'Bearish Zone Created', message: 'Bearish OrderBlock Created' },
  { id: 'alert2', title: 'Bullish Rejection', message: 'Bullish Rejection Signal' },
  { id: 'alert3', title: 'Bearish Rejection', message: 'Bearish Rejection Signal' },
];

export const metadata = {
  title: 'High Probability Order Blocks [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - High Probability OB',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

const KM_GRID_Y_DIVS = 4;
const KM_GRID_X_STEP = 50;
const KM_X_AXIS_TITLE = 'Orderblock Age (Bars)';
const KM_Y_AXIS_TITLE = 'Probability of Zone Survival %';

/** The survival samples of the original (kmStartBars / kmEvent* / kmCensor* / kmOpenCensor* arrays, newest first) */
interface KmState {
  startBars: number[];
  startSides: number[];
  eventStarts: number[];
  eventSides: number[];
  eventAges: number[];
  censorStarts: number[];
  censorSides: number[];
  censorAges: number[];
  openStarts: number[];
  openSides: number[];
  openAges: number[];
}

/** includeStarts, E and C of f_km_survival / f_km_points */
function kmSamples(km: KmState, side: number, lookbackZones: number) {
  const includeStarts: number[] = [];
  for (let i = 0; i < km.startBars.length; i++) {
    if (includeStarts.length >= lookbackZones) break;
    if (km.startSides[i] === side) includeStarts.push(km.startBars[i]);
  }
  const E: number[] = [];
  const C: number[] = [];
  for (let i = 0; i < km.eventStarts.length; i++) {
    if (km.eventSides[i] === side && includeStarts.includes(km.eventStarts[i])) E.push(km.eventAges[i]);
  }
  for (let i = 0; i < km.censorStarts.length; i++) {
    if (km.censorSides[i] === side && includeStarts.includes(km.censorStarts[i])) C.push(km.censorAges[i]);
  }
  for (let i = 0; i < km.openStarts.length; i++) {
    if (km.openSides[i] === side && includeStarts.includes(km.openStarts[i])) C.push(km.openAges[i]);
  }
  E.sort((a, b) => a - b);
  C.sort((a, b) => a - b);
  return { includeStarts, E, C };
}

/** f_km_survival(): survival at ageBars, NaN with too few samples */
function kmSurvival(km: KmState, side: number, lookbackZones: number, minSamples: number, ageBars: number): number {
  const { includeStarts, E, C } = kmSamples(km, side, lookbackZones);
  const N0 = includeStarts.length;
  if (N0 < minSamples || E.length === 0) return NaN;
  let S = 1.0;
  let nRisk = N0;
  let ei = 0;
  let ci = 0;
  while (ei < E.length) {
    const ti = E[ei];
    if (gt(ti, ageBars)) break;
    while (ci < C.length && lt(C[ci], ti)) {
      nRisk -= 1;
      ci += 1;
    }
    let d = 0;
    while (ei < E.length && eq(E[ei], ti)) {
      d += 1;
      ei += 1;
    }
    if (nRisk > 0) S = S * (1.0 - d / nRisk);
    nRisk -= d;
    let cEq = 0;
    while (ci < C.length && eq(C[ci], ti)) {
      cEq += 1;
      ci += 1;
    }
    nRisk -= cEq;
  }
  return S;
}

/** f_km_points(): the survival curve as chart points */
function kmPoints(km: KmState, side: number, lookbackZones: number, minSamples: number, topY: number, botY: number,
  xStart: number, maxBars: number): ChartPoint[] {
  const pts: ChartPoint[] = [];
  if (maxBars <= 0) return pts;
  const { E, C } = kmSamples(km, side, lookbackZones);
  const total = E.length + C.length;
  if (total < minSamples || E.length === 0) return pts;
  let S = 1.0;
  let nRisk = total;
  let ei = 0;
  let ci = 0;
  pts.push(chartPoint.from_index(xStart, botY + S * (topY - botY)));
  while (ei < E.length) {
    const ti = Math.trunc(E[ei]);
    if (ti > maxBars) break;
    while (ci < C.length && Math.trunc(C[ci]) < ti) {
      nRisk -= 1;
      ci += 1;
    }
    pts.push(chartPoint.from_index(xStart + ti, botY + S * (topY - botY)));
    let d = 0;
    while (ei < E.length && Math.trunc(E[ei]) === ti) {
      d += 1;
      ei += 1;
    }
    if (nRisk > 0) S = S * (1.0 - d / nRisk);
    nRisk -= d;
    let cEq = 0;
    while (ci < C.length && Math.trunc(C[ci]) === ti) {
      cEq += 1;
      ci += 1;
    }
    nRisk -= cEq;
    pts.push(chartPoint.from_index(xStart + ti, botY + S * (topY - botY)));
  }
  pts.push(chartPoint.from_index(xStart + maxBars, botY + S * (topY - botY)));
  return pts;
}

/** f_remove_samples_for_start() */
function removeSamplesForStart(km: KmState, side: number, startBar: number): void {
  for (let k = km.eventStarts.length - 1; k >= 0; k--) {
    if (km.eventSides[k] === side && km.eventStarts[k] === startBar) {
      km.eventStarts.splice(k, 1);
      km.eventSides.splice(k, 1);
      km.eventAges.splice(k, 1);
    }
  }
  for (let k = km.censorStarts.length - 1; k >= 0; k--) {
    if (km.censorSides[k] === side && km.censorStarts[k] === startBar) {
      km.censorStarts.splice(k, 1);
      km.censorSides.splice(k, 1);
      km.censorAges.splice(k, 1);
    }
  }
}

/** f_trim_km_starts_and_samples(): keep the latest `lookback` starts of a side */
function trimKmStarts(km: KmState, side: number, lookback: number): void {
  const idxs: number[] = [];
  for (let i = 0; i < km.startBars.length; i++) if (km.startSides[i] === side) idxs.push(i);
  const n = idxs.length;
  if (n > lookback) {
    for (let j = n - 1; j >= lookback; j--) {
      const idx = idxs[j];
      if (km.startBars.length > idx) {
        removeSamplesForStart(km, side, km.startBars[idx]);
        km.startBars.splice(idx, 1);
        km.startSides.splice(idx, 1);
      }
    }
  }
}

const TEXT_SIZES = { Tiny: 'tiny', Small: 'small', Medium: 'normal', Large: 'large' } as const;

export function calculate(
  bars: Bar[],
  inputs: Partial<HighProbabilityOrderBlocksInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const fg = foregroundColorOf(chart);
  const { bullCol, bearCol, zLen, maxAge, kmLookback, kmMinSamples } = cfg;
  const probTxtSize = TEXT_SIZES[cfg.probTxtSizeOpt] ?? 'large';

  // updist / downdist: running sums of the bodies of a run of up (down) candles
  const updist: number[] = [];
  const downdist: number[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    updist.push(gt(b.close, b.open) ? (i > 0 ? updist[i - 1] : 0) + (b.close - b.open) : 0.0);
    downdist.push(lt(b.close, b.open) ? (i > 0 ? downdist[i - 1] : 0) + (b.open - b.close) : 0.0);
  }
  const arr = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const upS = Series.fromArray(bars, updist);
  const dnS = Series.fromArray(bars, downdist);
  const upMean = arr(ta.sma(upS, zLen));
  const upStdev = arr(ta.stdev(upS, zLen));
  const dnMean = arr(ta.sma(dnS, zLen));
  const dnStdev = arr(ta.stdev(dnS, zLen));
  const zUp = updist.map((u, i) => (u - upMean[i]) / (eq(upStdev[i], 0) ? NaN : upStdev[i]));
  const negZDn = downdist.map((d, i) => -((d - dnMean[i]) / (eq(dnStdev[i], 0) ? NaN : dnStdev[i])));
  const crossUp = ta.crossover(Series.fromArray(bars, zUp), 4).toArray();
  const crossDn = ta.crossunder(Series.fromArray(bars, negZDn), -4).toArray();
  const nz = (x: number) => (Number.isFinite(x) ? x : 0);
  const atr = arr(ta.atr(bars, 14));

  resetDrawings({ box: 500, line: 500, polyline: 100 });

  const bullBoxes: Box[] = [];
  const bearBoxes: Box[] = [];
  const bullStarts: number[] = [];
  const bearStarts: number[] = [];
  const bullMidlines: Line[] = [];
  const bearMidlines: Line[] = [];
  const km: KmState = {
    startBars: [], startSides: [], eventStarts: [], eventSides: [], eventAges: [], censorStarts: [], censorSides: [],
    censorAges: [], openStarts: [], openSides: [], openAges: [],
  };

  const canCreate = (tNew: number, bNew: number): boolean => {
    for (const ex of bullBoxes) if (gt(tNew, box.get_bottom(ex)) && lt(bNew, box.get_top(ex))) return false;
    for (const ex of bearBoxes) if (gt(tNew, box.get_bottom(ex)) && lt(bNew, box.get_top(ex))) return false;
    return true;
  };

  let lastDownIdx = NaN;
  let lastDownHigh = NaN;
  let lastDownLow = NaN;
  let lastUpIdx = NaN;
  let lastUpHigh = NaN;
  let lastUpLow = NaN;

  const markers: MarkerData[] = [];
  const flags: boolean[][] = Array.from({ length: 4 }, () => new Array(n).fill(false));

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const b = bars[i];
    const prevClose = i > 0 ? bars[i - 1].close : NaN;
    const bullish = !!crossUp[i] && nz(i > 0 ? zUp[i - 1] : NaN) !== 0;
    const bearish = !!crossDn[i] && nz(i > 0 ? negZDn[i - 1] : NaN) !== 0;
    let bullrej = false;
    let bearrej = false;
    let bullCreate = false;
    let bearCreate = false;

    // ta.valuewhen(close < open, ...): the last down candle
    if (lt(b.close, b.open)) {
      lastDownIdx = i;
      lastDownHigh = b.high;
      lastDownLow = b.low;
    }
    if (bullish && !Number.isNaN(lastDownIdx)) {
      if (!cfg.preventOverlap || canCreate(lastDownHigh, lastDownLow)) {
        const bx = box.new(lastDownIdx, lastDownHigh, lastDownIdx + 1, lastDownLow, color.new(bullCol, 95), undefined,
          undefined, undefined, undefined, color.new(bullCol, 85));
        bullBoxes.unshift(bx);
        bullStarts.unshift(lastDownIdx);
        km.startBars.unshift(lastDownIdx);
        km.startSides.unshift(1);
        trimKmStarts(km, 1, kmLookback);
        const midYB = (lastDownHigh + lastDownLow) / 2.0;
        bullMidlines.unshift(line.new(lastDownIdx, midYB, lastDownIdx + 1, midYB, 'bar_index', 'none',
          color.new(bullCol, 60), 'dashed', 1));
        bullCreate = true;
      }
    }

    if (gt(b.close, b.open)) {
      lastUpIdx = i;
      lastUpHigh = b.high;
      lastUpLow = b.low;
    }
    if (bearish && !Number.isNaN(lastUpIdx)) {
      if (!cfg.preventOverlap || canCreate(lastUpHigh, lastUpLow)) {
        const bx = box.new(lastUpIdx, lastUpHigh, lastUpIdx + 1, lastUpLow, color.new(bearCol, 95), undefined,
          undefined, undefined, undefined, color.new(bearCol, 85));
        bearBoxes.unshift(bx);
        bearStarts.unshift(lastUpIdx);
        km.startBars.unshift(lastUpIdx);
        km.startSides.unshift(-1);
        trimKmStarts(km, -1, kmLookback);
        const midYS = (lastUpHigh + lastUpLow) / 2.0;
        bearMidlines.unshift(line.new(lastUpIdx, midYS, lastUpIdx + 1, midYS, 'bar_index', 'none',
          color.new(bearCol, 60), 'dashed', 1));
        bearCreate = true;
      }
    }

    // live blocks: extend, mitigation / expiry (the box and its mid line stay on the chart), rejections
    const update = (boxes: Box[], starts: number[], mids: Line[], side: number) => {
      for (let k = boxes.length - 1; k >= 0; k--) {
        if (boxes.length <= k || starts.length <= k) continue;
        const bx = boxes[k];
        box.set_right(bx, i);
        if (mids.length > k) line.set_x2(mids[k], i);
        const top = box.get_top(bx);
        const bot = box.get_bottom(bx);
        const mitigated = side === 1
          ? lt(b.close, bot) && lt(prevClose, bot)
          : gt(b.close, top) && gt(prevClose, top);
        const start = starts[k];
        const expired = i - start >= maxAge;
        if (mitigated || expired) {
          if (mitigated) {
            km.eventStarts.unshift(start);
            km.eventSides.unshift(side);
            km.eventAges.unshift(i - start);
          } else {
            km.censorStarts.unshift(start);
            km.censorSides.unshift(side);
            km.censorAges.unshift(i - start);
          }
          boxes.splice(k, 1);
          starts.splice(k, 1);
          if (mids.length > k) mids.splice(k, 1);
        } else if (side === 1) {
          if (gt(b.close, top) && lt(prevClose, top)) bullrej = true;
        } else if (lt(b.close, bot) && gt(prevClose, bot)) {
          bearrej = true;
        }
      }
    };
    update(bullBoxes, bullStarts, bullMidlines, 1);
    update(bearBoxes, bearStarts, bearMidlines, -1);

    if (i === n - 1) renderKm(i, b);

    if (bullrej && Number.isFinite(b.low - atr[i] * 2)) {
      markers.push({ id: 'char0', time: b.time, position: 'atPriceMiddle', price: b.low - atr[i] * 2, shape: 'circle',
        char: '▲', color: bullCol, size: 'tiny' });
    }
    if (bearrej && Number.isFinite(b.high + atr[i] * 2)) {
      markers.push({ id: 'char1', time: b.time, position: 'atPriceMiddle', price: b.high + atr[i] * 2, shape: 'circle',
        char: '▼', color: bearCol, size: 'tiny' });
    }
    flags[0][i] = bullCreate;
    flags[1][i] = bearCreate;
    flags[2][i] = bullrej;
    flags[3][i] = bearrej;
  }
  setDrawingBar(null);

  /** The KM rendering of the last bar */
  function renderKm(i: number, b: Bar): void {
    km.openStarts.length = 0;
    km.openSides.length = 0;
    km.openAges.length = 0;
    for (const start of bullStarts) {
      km.openStarts.unshift(start);
      km.openSides.unshift(1);
      km.openAges.unshift(i - start);
    }
    for (const start of bearStarts) {
      km.openStarts.unshift(start);
      km.openSides.unshift(-1);
      km.openAges.unshift(i - start);
    }
    const rightStart = i + 50;
    const rightEnd = Math.min(rightStart + 450, i + 500);
    const maxBarsDraw = rightEnd - rightStart;
    let frameTop = NaN;
    let frameBottom = NaN;
    for (const bx of [...bullBoxes, ...bearBoxes]) {
      const t = box.get_top(bx);
      const btm = box.get_bottom(bx);
      frameTop = Number.isNaN(frameTop) ? t : Math.max(frameTop, t);
      frameBottom = Number.isNaN(frameBottom) ? btm : Math.min(frameBottom, btm);
    }
    let yTop = Number.isNaN(frameTop) ? b.high : frameTop;
    let yBottom = Number.isNaN(frameBottom) ? b.low : frameBottom;
    if (!gt(yTop, yBottom)) {
      yTop += 1;
      yBottom -= 1;
    }
    const clear = color.new(color.black, 100);
    if (cfg.showKmPanel) {
      polyline.new([chartPoint.from_index(rightStart, yBottom), chartPoint.from_index(rightEnd, yBottom)], false, false,
        'bar_index', cfg.kmAxisCol, undefined, 'solid');
      polyline.new([chartPoint.from_index(rightStart, yBottom), chartPoint.from_index(rightStart, yTop)], false, false,
        'bar_index', cfg.kmAxisCol, undefined, 'solid');
      for (let d = 0; d <= KM_GRID_Y_DIVS; d++) {
        const frac = d / KM_GRID_Y_DIVS;
        const yLvl = yBottom + frac * (yTop - yBottom);
        polyline.new([chartPoint.from_index(rightStart, yLvl), chartPoint.from_index(rightEnd, yLvl)], false, false,
          'bar_index', cfg.kmGridCol, undefined, 'dotted');
        label.new(rightEnd, yLvl, str.tostring(Math.round(frac * 100)) + '%', 'bar_index', 'price', clear, 'label_left',
          fg, 'tiny', 'left');
      }
      const vCount = Math.trunc(Math.floor(maxBarsDraw / KM_GRID_X_STEP));
      for (let k = 1; k <= vCount; k++) {
        const xoff = k * KM_GRID_X_STEP;
        polyline.new([chartPoint.from_index(rightStart + xoff, yBottom), chartPoint.from_index(rightStart + xoff, yTop)],
          false, false, 'bar_index', cfg.kmGridCol, undefined, 'dotted');
        label.new(rightStart + xoff, yBottom, str.tostring(xoff), 'bar_index', 'price', clear, 'label_down', fg, 'tiny',
          'center');
      }
      label.new(Math.trunc((rightStart + rightEnd) / 2), yBottom, KM_X_AXIS_TITLE, 'bar_index', 'price', clear,
        'label_up', fg, 'small', 'center');
      const yMid = yBottom + 0.5 * (yTop - yBottom);
      const yTitle = yMid - 0.04 * (yTop - yBottom);
      const titlePadBars = Math.max(6, Math.trunc(Math.round(maxBarsDraw * 0.02)));
      const titleX = Math.min(i + 500 - 1, rightEnd + titlePadBars);
      label.new(titleX, yTitle, KM_Y_AXIS_TITLE, 'bar_index', 'price', clear, 'label_left', fg, 'small', 'left');

      const curve = (boxes: Box[], side: number, col: string) => {
        if (boxes.length === 0) return;
        const top = box.get_top(boxes[0]);
        const bot = box.get_bottom(boxes[0]);
        if (Number.isNaN(top) || Number.isNaN(bot) || eq(top, bot)) return;
        const pts = kmPoints(km, side, kmLookback, kmMinSamples, yTop, yBottom, rightStart, maxBarsDraw);
        if (pts.length > 1) polyline.new(pts, false, false, 'bar_index', col, undefined, 'solid');
      };
      curve(bullBoxes, 1, bullCol);
      curve(bearBoxes, -1, bearCol);
    }

    const texts = (boxes: Box[], starts: number[], side: number) => {
      boxes.forEach((bx, k) => {
        const age = i - starts[k];
        const s = kmSurvival(km, side, kmLookback, kmMinSamples, age);
        box.set_text(bx, Number.isNaN(s) ? `Age ${str.tostring(age)} | N.E.D`
          : `Age ${str.tostring(age)} | ${str.tostring(Math.round(s * 100))}%`);
        box.set_text_halign(bx, 'right');
        box.set_text_valign(bx, side === 1 ? 'bottom' : 'top');
        box.set_text_color(bx, fg);
        box.set_text_size(bx, probTxtSize);
      });
    };
    texts(bullBoxes, bullStarts, 1);
    texts(bearBoxes, bearStarts, -1);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const HighProbabilityOrderBlocks = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
  alertConditions,
};
