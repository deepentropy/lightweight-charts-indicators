/**
 * Volumetric Order Flow Structure [LuxAlgo]
 *
 * Market structure breaks with a volume profile of the pivot candle. Pivots with "Pivot Length" bars on each side
 * give the last swing high and swing low. A close that crosses over the last swing high (under the last swing low)
 * is a break: "BOS" when it follows the trend, "CHoCH" when it turns it. A break draws, from the pivot bar to the
 * break bar, a thin band at the level, a glow and a core whose length is the share of the break candle range on the
 * side of the break (close - low or high - close over the range, at least 10 %), and the label. The pivot candle
 * gets an order block: 15 rows from its high to its low, from the pivot bar to 10 bars after the current bar (rows
 * in the candle body less transparent), and a histogram of 15 bars 11 bars after the current bar whose widths are a
 * fixed bell shape plus 5 for the rows in the body (the widest row in orange, the POC).
 *
 * The newest "Max Recent Blocks" blocks are kept; a close below a bullish block (above a bearish block) removes it.
 * The blocks follow the current bar. "Hide Overlapping Blocks" keeps, among overlapping blocks, only the one of the
 * pivot candle with the larger volume. A wick through the far side of a block that closes back inside (a raid) gets
 * a circle whose size is the bar volume against the highest volume of 200 bars ("Bubble Sensitivity" scales it)
 * and a label with the volume.
 *
 * Chart values read: the tick size (minimum candle range, band height without an ATR) and the chart foreground
 * colour (volume texts; dark theme #DBDBDB without a context).
 *
 * Reference: "Volumetric Order Flow Structure [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, color, callsite, Series, box, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type Box, type Label, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { foregroundColorOf, mintickOf, type ChartContext } from '../chart-context';

export interface VolumetricOrderFlowStructureInputs {
  pivotLen: number;
  volLookback: number;
  maxObs: number;
  boxTransparency: number;
  hideOverlapping: boolean;
  showManipulation: boolean;
  manipSize: number;
}

export const defaultInputs: VolumetricOrderFlowStructureInputs = {
  pivotLen: 3,
  volLookback: 20,
  maxObs: 5,
  boxTransparency: 80,
  hideOverlapping: false,
  showManipulation: true,
  manipSize: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Pivot Length', defval: 3, min: 1, group: 'Detection' },
  { id: 'volLookback', type: 'int', title: 'Volume Lookback', defval: 20, min: 1, group: 'Detection' },
  { id: 'maxObs', type: 'int', title: 'Max Recent Blocks', defval: 5, min: 1, group: 'Visuals' },
  { id: 'boxTransparency', type: 'int', title: 'Base Transparency', defval: 80, min: 0, max: 100, group: 'Visuals' },
  { id: 'hideOverlapping', type: 'bool', title: 'Hide Overlapping Blocks', defval: false, group: 'Visuals' },
  { id: 'showManipulation', type: 'bool', title: 'Show Manipulation Bubbles', defval: true, group: 'Manipulation' },
  { id: 'manipSize', type: 'float', title: 'Bubble Sensitivity', defval: 1.0, min: 0.1, group: 'Manipulation' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box', 'label'];

export const metadata = {
  title: 'Volumetric Order Flow Structure [LuxAlgo]',
  shortTitle: 'LuxAlgo - Volumetric Order Flow Structure',
  overlay: true,
};

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';
const POC_COLOR = '#ff9800';
const NA_COLOR = 'transparent';
/** v6 default text colour of a box (set explicitly) */
const WHITE = '#FFFFFF';
const ROWS = 15;

/** Pine float comparisons (within 1e-10; na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const ge = (a: number, b: number) => a - b >= -1e-10;
const le = (a: number, b: number) => a - b <= 1e-10;

interface OrderBlock {
  profileBoxes: Box[];
  histBoxes: Box[];
  high: number;
  low: number;
  volume: number;
  isBullish: boolean;
  rowWeights: number[];
  manipBubbles: Label[];
  manipTexts: Label[];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumetricOrderFlowStructureInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const pivotLen = Math.trunc(cfg.pivotLen);
  const maxObs = Math.trunc(cfg.maxObs);
  const boxTransparency = Math.trunc(cfg.boxTransparency);
  const { hideOverlapping, showManipulation, manipSize } = cfg;
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const mintick = mintickOf(chart);
  const fg = foregroundColorOf(chart);
  const base = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
  };
  resetDrawings({ box: 500, line: 500, label: 500 });
  if (n === 0) return base;

  const num = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);
  const A = (s: Series) => s.toArray().map(num);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const open = bars.map((b) => b.open);
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => num(b.volume));
  const ph = A(ta.pivothigh(new Series(bars, (b) => b.high), pivotLen, pivotLen));
  const pl = A(ta.pivotlow(new Series(bars, (b) => b.low), pivotLen, pivotLen));
  const atr = A(ta.atr(bars, 14));
  const maxVolLookback = A(ta.highest(new Series(bars, (b) => num(b.volume)), 200));
  // (totalVolume = math.max(1, nz(math.sum(volume, volLookback))) is not used by the outputs)

  const formatVolume = (vol: number) => {
    if (ge(vol, 1000000)) return `${str.tostring(vol / 1000000, '#.###')}M`;
    if (ge(vol, 1000)) return `${str.tostring(vol / 1000, '#.###')}K`;
    return str.tostring(vol, '#');
  };

  let trend = 0;
  const activeObs: OrderBlock[] = [];
  let lastPh = NaN;
  let lastPhIdx = NaN;
  let lastPl = NaN;
  let lastPlIdx = NaN;
  const crossUp = callsite.crossover();
  const crossDn = callsite.crossunder();

  const deleteOb = (ob: OrderBlock) => {
    for (const b of ob.profileBoxes) box.delete(b);
    for (const b of ob.histBoxes) box.delete(b);
    for (const l of ob.manipBubbles) label.delete(l);
    for (const l of ob.manipTexts) label.delete(l);
  };

  const drawStructure = (i: number, startIdx: number, level: number, labelText: string, css: string, isBullish: boolean) => {
    const k = startIdx;
    const pHigh = high[k];
    const pLow = low[k];
    const pOpen = open[k];
    const pClose = close[k];
    const pVol = volume[k];

    // Volume delta of the breakout bar
    const range = Math.max(mintick, high[i] - low[i]);
    let deltaPct = isBullish ? (close[i] - low[i]) / range : (high[i] - close[i]) / range;
    if (!Number.isFinite(deltaPct)) deltaPct = 0.5;

    // Overlaps
    const overlapping: number[] = [];
    if (hideOverlapping && activeObs.length > 0) {
      for (let j = 0; j < activeObs.length; j++) {
        const ob = activeObs[j];
        if (lt(pLow, ob.high) && gt(pHigh, ob.low)) overlapping.push(j);
      }
    }
    let shouldDraw = true;
    if (overlapping.length > 0) {
      for (const idx of overlapping) {
        if (le(pVol, activeObs[idx].volume)) {
          shouldDraw = false;
          break;
        }
      }
      if (shouldDraw) {
        overlapping.sort((a, b) => b - a);
        for (const idx of overlapping) {
          deleteOb(activeObs[idx]);
          activeObs.splice(idx, 1);
        }
      }
    }
    if (!shouldDraw) return;

    // Volumetric structure break bar
    const dist = i - startIdx;
    const fillEnd = startIdx + Math.round(dist * Math.max(0.1, deltaPct));
    const a = atr[i] * 0.05;
    const h = Number.isNaN(a) ? mintick * 15 : a;
    box.new(startIdx, level + h, i, level - h, NA_COLOR, undefined, undefined, undefined, undefined, String(color.new(css, 92)), '',
      undefined, WHITE);
    box.new(startIdx, level + h * 1.5, fillEnd, level - h * 1.5, NA_COLOR, undefined, undefined, undefined, undefined,
      String(color.new(css, 80)), '', undefined, WHITE);
    box.new(startIdx, level + h * 0.8, fillEnd, level - h * 0.8, NA_COLOR, undefined, undefined, undefined, undefined,
      String(color.new(css, 20)), '', undefined, WHITE);

    // Structure label (bullish above, bearish below)
    const labelY = isBullish ? level + h * 2 : level - h * 2;
    label.new(Math.round((startIdx + i) / 2), labelY, labelText, 'bar_index', 'price', '#00000000',
      isBullish ? 'label_down' : 'label_up', css, 'tiny');

    // Volume profile (15 rows)
    const baseLine = i + 11;
    const rowStep = (pHigh - pLow) / ROWS;
    const bodyMax = Math.max(pOpen, pClose);
    const bodyMin = Math.min(pOpen, pClose);
    const inBody = (y: number) => le(y, bodyMax) && ge(y, bodyMin);
    const boxes: Box[] = [];
    const histBoxes: Box[] = [];
    const weights: number[] = [];
    let maxWeight = 0;
    let pocIndex = -1;
    for (let r = 0; r < ROWS; r++) {
      const distFromMid = Math.abs(r - ROWS / 2.0);
      let w = Math.trunc(Math.max(2, 12 - distFromMid * 1.5));
      const rTop = pHigh - r * rowStep;
      const rBtm = rTop - rowStep;
      if (inBody(rTop) || inBody(rBtm)) w += 5;
      weights.push(w);
      if (w > maxWeight) {
        maxWeight = w;
        pocIndex = r;
      }
    }
    for (let r = 0; r < ROWS; r++) {
      const rTop = pHigh - r * rowStep;
      const rBtm = rTop - rowStep;
      const w = weights[r];
      const transp = boxTransparency + (inBody(rTop) ? 0 : 10);
      boxes.push(box.new(startIdx, rTop, i + 10, rBtm, NA_COLOR, undefined, undefined, undefined, undefined,
        String(color.new(css, Math.min(100, transp))), '', undefined, WHITE));
      const barColor = r === pocIndex ? POC_COLOR : css;
      histBoxes.push(box.new(baseLine, rTop, baseLine + w, rBtm, NA_COLOR, undefined, undefined, undefined, undefined,
        String(color.new(barColor, 50)), '', undefined, WHITE));
    }
    activeObs.push({
      profileBoxes: boxes, histBoxes, high: pHigh, low: pLow, volume: pVol, isBullish, rowWeights: weights,
      manipBubbles: [], manipTexts: [],
    });
    if (activeObs.length > maxObs) deleteOb(activeObs.shift()!);
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    if (!Number.isNaN(ph[i])) {
      lastPh = ph[i];
      lastPhIdx = i - pivotLen;
    }
    if (!Number.isNaN(pl[i])) {
      lastPl = pl[i];
      lastPlIdx = i - pivotLen;
    }

    // Update and detect manipulation
    if (activeObs.length > 0) {
      for (let j = activeObs.length - 1; j >= 0; j--) {
        const ob = activeObs[j];
        const mitigated = ob.isBullish ? lt(close[i], ob.low) : gt(close[i], ob.high);
        if (mitigated) {
          deleteOb(ob);
          activeObs.splice(j, 1);
        } else {
          const baseLine = i + 11;
          const rowStep = (ob.high - ob.low) / 15;
          for (const b of ob.profileBoxes) box.set_right(b, i + 10);
          for (let r = 0; r <= 14; r++) {
            const rTop = ob.high - r * rowStep;
            const rBtm = rTop - rowStep;
            const hBox = ob.histBoxes[r];
            box.set_lefttop(hBox, baseLine, rTop);
            box.set_rightbottom(hBox, baseLine + ob.rowWeights[r], rBtm);
          }
          if (showManipulation) {
            const raidHigh = !ob.isBullish && gt(high[i], ob.high) && le(close[i], ob.high);
            const raidLow = ob.isBullish && lt(low[i], ob.low) && ge(close[i], ob.low);
            if (raidHigh || raidLow) {
              const v = volume[i];
              const s = (v / maxVolLookback[i]) * manipSize;
              const mSize = gt(s, 0.8) ? 'huge' : gt(s, 0.6) ? 'large' : gt(s, 0.4) ? 'normal' : gt(s, 0.2) ? 'small' : 'tiny';
              const y = raidHigh ? high[i] : low[i];
              const mBubble = label.new(i, y, '', 'bar_index', 'price', String(color.new(raidHigh ? BEAR_COLOR : BULL_COLOR, 30)),
                'circle', undefined, mSize);
              const mText = label.new(i, y, formatVolume(v), 'bar_index', 'price', '#00000000', raidHigh ? 'label_down' : 'label_up',
                fg, 'small');
              ob.manipBubbles.push(mBubble);
              ob.manipTexts.push(mText);
            }
          }
        }
      }
    }

    // Detect breakouts
    const isCrossover = crossUp(close[i], lastPh);
    const isCrossunder = crossDn(close[i], lastPl);
    if (!Number.isNaN(lastPh) && isCrossover) {
      drawStructure(i, lastPhIdx, lastPh, trend === -1 ? 'CHoCH' : 'BOS', BULL_COLOR, true);
      trend = 1;
      lastPh = NaN;
    }
    if (!Number.isNaN(lastPl) && isCrossunder) {
      drawStructure(i, lastPlIdx, lastPl, trend === 1 ? 'CHoCH' : 'BOS', BEAR_COLOR, false);
      trend = -1;
      lastPl = NaN;
    }
  }
  setDrawingBar(null);

  return { ...base, ...drawingOutputs(bars, ms ? 'ms' : 's') };
}

export const VolumetricOrderFlowStructure = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
