/**
 * Institutional Order Flow Strength Classifier [LuxAlgo]
 *
 * Finds order blocks at breaks of structure and gives each one a strength score. Pivot highs and lows ("Pivot
 * Lookback" bars on each side) are the structure levels. When the close crosses above the last pivot high (a bullish
 * break), the order block is the bearish candle with the lowest low between the pivot bar and the break; when the
 * close crosses below the last pivot low, the bullish candle with the highest high. The level is then used up.
 *
 * Strength (0 to 100, one decimal): 60 % displacement (the distance from the block to the breaking close, against
 * five times the block height, capped at 1) and 40 % relative volume (the block volume against its 20-bar average,
 * halved and capped at 1). A bullish block is mitigated when a low goes below its bottom, a bearish block when a
 * high goes above its top.
 *
 * Plots: the top, bottom and median of the strongest unmitigated block among the newest "Strongest OB Buffer Size"
 * unmitigated blocks, with a fill; the colour is cut on the bar where the strongest block changes. On the last bar:
 * a dashed box (from the block bar to the last bar) and a strength label for each of the newest "Max Unmitigated
 * OBs" unmitigated blocks, without the blocks that overlap a newer drawn one ("Hide Overlapped Zones").
 *
 * Reference: "Institutional Order Flow Strength Classifier [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, color, math, callsite, Series, box, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Box, type Label, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { ChartContext } from '../chart-context';

export interface InstitutionalOrderFlowStrengthClassifierInputs {
  /** Bars on each side of a pivot */
  pivotLen: number;
  /** Largest number of drawn blocks */
  maxOBs: number;
  bullColor: string;
  bearColor: string;
  /** Do not draw a block that overlaps a newer drawn block */
  hideOverlapped: boolean;
  showLabels: boolean;
  showStrongest: boolean;
  /** Number of newest unmitigated blocks searched for the strongest one */
  bufferSize: number;
}

export const defaultInputs: InstitutionalOrderFlowStrengthClassifierInputs = {
  pivotLen: 5,
  maxOBs: 5,
  bullColor: 'rgba(8, 153, 129, 0.2)',
  bearColor: 'rgba(242, 54, 69, 0.2)',
  hideOverlapped: true,
  showLabels: true,
  showStrongest: true,
  bufferSize: 5,
};

const OB_GROUP = 'Order Block Settings';
const VIS_GROUP = 'Visualization';

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Pivot Lookback', defval: 5, min: 2, group: OB_GROUP },
  { id: 'maxOBs', type: 'int', title: 'Max Unmitigated OBs', defval: 5, min: 1, max: 50, group: OB_GROUP },
  { id: 'bullColor', type: 'color', title: 'Bullish OB Color', defval: 'rgba(8, 153, 129, 0.2)', group: VIS_GROUP },
  { id: 'bearColor', type: 'color', title: 'Bearish OB Color', defval: 'rgba(242, 54, 69, 0.2)', group: VIS_GROUP },
  { id: 'hideOverlapped', type: 'bool', title: 'Hide Overlapped Zones', defval: true, group: VIS_GROUP },
  { id: 'showLabels', type: 'bool', title: 'Show Strength Labels', defval: true, group: VIS_GROUP },
  { id: 'showStrongest', type: 'bool', title: 'Show Strongest OB Plot', defval: true, group: VIS_GROUP },
  { id: 'bufferSize', type: 'int', title: 'Strongest OB Buffer Size', defval: 5, min: 1, max: 100, group: VIS_GROUP },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Strongest OB Top', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Strongest OB Bottom', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Strongest OB Median', color: '#2962FF', lineWidth: 2 },
];

/** fill(plotTop, plotBtm, ..., "Strongest OB Zone Fill") */
export const fillConfig = [{ id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Strongest OB Zone Fill' }];

/** Drawing kinds the script uses */
export const drawingKinds: StudyDrawingKind[] = ['box', 'label'];

export const metadata = {
  title: 'Institutional Order Flow Strength Classifier [LuxAlgo]',
  shortTitle: 'LuxAlgo - Institutional Order Flow Strength Classifier',
  overlay: true,
};

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';
/** Text colour of a box without `text_color` in a v6 script (the boxes have no text) */
const BOX_TEXT = '#FFFFFF';

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => b - a >= -EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

interface OrderBlock {
  top: number;
  bottom: number;
  startTime: number;
  strength: number;
  isBullish: boolean;
  boxId: Box | null;
  labelId: Label | null;
  mitigated: boolean;
}

/** calculateStrength() */
function calculateStrength(obRange: number, breakoutDist: number, relVol: number): number {
  const dispFactor = Math.min(breakoutDist / (obRange * 5), 1.0);
  const volFactor = Math.min(relVol / 2.0, 1.0);
  const score = (dispFactor * 0.6 + volFactor * 0.4) * 100;
  return math.round(score, 1);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<InstitutionalOrderFlowStrengthClassifierInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const toMs = chart?.timeUnit === 'ms' ? 1 : 1000;
  const pivotLen = Math.trunc(cfg.pivotLen);
  const maxOBs = Math.trunc(cfg.maxOBs);
  const bufferSize = Math.trunc(cfg.bufferSize);

  const volSMA = ta.sma(new Series(bars, (b) => b.volume ?? NaN), 20).toArray();
  const hiArr = ta.pivothigh(new Series(bars, (b) => b.high), pivotLen, pivotLen).toArray();
  const loArr = ta.pivotlow(new Series(bars, (b) => b.low), pivotLen, pivotLen).toArray();
  const bullCross = callsite.crossover();
  const bearCross = callsite.crossunder();

  resetDrawings({ box: 100, label: 100 });
  const obArray: OrderBlock[] = [];
  let lastHi = NaN;
  let lastLo = NaN;
  let lastHiIdx = NaN;
  let lastLoIdx = NaN;
  let prevAvg = NaN;

  const top: number[] = new Array(n).fill(NaN);
  const btm: number[] = new Array(n).fill(NaN);
  const mid: number[] = new Array(n).fill(NaN);
  const topColors: string[] = new Array(n).fill('transparent');
  const midColors: string[] = new Array(n).fill('transparent');
  const fillColors: string[] = new Array(n).fill('transparent');

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const hi = hiArr[i] ?? NaN;
    const lo = loArr[i] ?? NaN;
    if (!isNaN(hi)) {
      lastHi = hi;
      lastHiIdx = i - pivotLen;
    }
    if (!isNaN(lo)) {
      lastLo = lo;
      lastLoIdx = i - pivotLen;
    }

    // Market structure break
    const bullBOS = bullCross(b.close, lastHi);
    const bearBOS = bearCross(b.close, lastLo);
    if (bullBOS || bearBOS) {
      const searchLen = i - (bullBOS ? lastHiIdx : lastLoIdx);
      let obTop = NaN;
      let obBtm = NaN;
      let obIdx = NaN;
      let obVol = NaN;
      // for i = 1 to searchLen (counts down when searchLen < 1)
      const step = searchLen >= 1 ? 1 : -1;
      if (bullBOS) {
        let minLow = NaN;
        for (let k = 1; step > 0 ? k <= searchLen : k >= searchLen; k += step) {
          const c = bars[i - k];
          if (c && lt(c.close, c.open)) {
            if (isNaN(minLow) || lt(c.low, minLow)) {
              minLow = c.low;
              obTop = c.high;
              obBtm = c.low;
              obIdx = k;
              obVol = c.volume ?? NaN;
            }
          }
        }
        lastHi = NaN;
      } else {
        let maxHigh = NaN;
        for (let k = 1; step > 0 ? k <= searchLen : k >= searchLen; k += step) {
          const c = bars[i - k];
          if (c && gt(c.close, c.open)) {
            if (isNaN(maxHigh) || gt(c.high, maxHigh)) {
              maxHigh = c.high;
              obTop = c.high;
              obBtm = c.low;
              obIdx = k;
              obVol = c.volume ?? NaN;
            }
          }
        }
        lastLo = NaN;
      }
      if (!isNaN(obIdx)) {
        const obHeight = obTop - obBtm;
        const breakoutDist = bullBOS ? b.close - obTop : obBtm - b.close;
        const avgVol = volSMA[i - obIdx] ?? NaN;
        const strength = calculateStrength(obHeight, breakoutDist, obVol / avgVol);
        obArray.unshift({
          top: obTop, bottom: obBtm, startTime: bars[i - obIdx].time * toMs, strength, isBullish: bullBOS,
          boxId: null, labelId: null, mitigated: false,
        });
      }
    }

    // 1. Mitigation
    for (const ob of obArray) {
      if (!ob.mitigated && (ob.isBullish ? lt(b.low, ob.bottom) : gt(b.high, ob.top))) ob.mitigated = true;
    }

    // 2. Strongest block within the buffer
    let strongestTop = NaN;
    let strongestBottom = NaN;
    let strongestAvgPrice = NaN;
    let strongestIsBullish = false;
    let maxStrength = -1.0;
    let checkedCount = 0;
    for (const ob of obArray) {
      if (ob.mitigated) continue;
      if (gt(ob.strength, maxStrength)) {
        maxStrength = ob.strength;
        strongestTop = ob.top;
        strongestBottom = ob.bottom;
        strongestAvgPrice = (ob.top + ob.bottom) / 2;
        strongestIsBullish = ob.isBullish;
      }
      checkedCount += 1;
      if (checkedCount >= bufferSize) break;
    }
    const plotCol = isNaN(strongestAvgPrice) ? undefined : strongestIsBullish ? cfg.bullColor : cfg.bearColor;
    const hasChanged = ne(strongestAvgPrice, prevAvg);
    prevAvg = strongestAvgPrice;
    if (cfg.showStrongest) {
      top[i] = strongestTop;
      btm[i] = strongestBottom;
      mid[i] = strongestAvgPrice;
    }
    // color.new(na, t) is black with transparency t (on bars without a block, where the values are na)
    if (!hasChanged) {
      topColors[i] = String(color.new(plotCol, 70));
      midColors[i] = String(color.new(plotCol, 40));
      fillColors[i] = String(color.new(plotCol, 90));
    }

    // 3. Drawings on the last bar
    if (i === n - 1) {
      let activeCount = 0;
      const occupiedTops: number[] = [];
      const occupiedBtms: number[] = [];
      for (const ob of obArray) {
        let isOverlapped = false;
        if (!ob.mitigated && cfg.hideOverlapped) {
          for (let j = 0; j < occupiedTops.length; j++) {
            const otherTop = occupiedTops[j];
            const otherBtm = occupiedBtms[j];
            if ((le(ob.top, otherTop) && ge(ob.top, otherBtm)) || (le(ob.bottom, otherTop) && ge(ob.bottom, otherBtm))
              || (ge(ob.top, otherTop) && le(ob.bottom, otherBtm))) {
              isOverlapped = true;
              break;
            }
          }
        }
        if (!ob.mitigated && !isOverlapped && activeCount < maxOBs) {
          activeCount += 1;
          occupiedTops.push(ob.top);
          occupiedBtms.push(ob.bottom);
          const obCol = ob.isBullish ? cfg.bullColor : cfg.bearColor;
          const labelCol = ob.isBullish ? BULL_COLOR : BEAR_COLOR;
          if (ob.boxId === null) {
            ob.boxId = box.new(ob.startTime, ob.top, b.time * toMs, ob.bottom, obCol, undefined, 'dashed', undefined,
              'bar_time', obCol, undefined, undefined, BOX_TEXT);
          }
          if (cfg.showLabels && ob.labelId === null) {
            ob.labelId = label.new(b.time * toMs, (ob.top + ob.bottom) / 2, str.format('{0}%', ob.strength), 'bar_time',
              'price', '#00000000', 'label_left', labelCol, 'small', 'center');
          }
        } else {
          if (ob.boxId !== null) {
            box.delete(ob.boxId);
            ob.boxId = null;
          }
          if (ob.labelId !== null) {
            label.delete(ob.labelId);
            ob.labelId = null;
          }
        }
      }
    }

    // 4. Memory management
    if (obArray.length > 100) {
      for (let k = obArray.length - 1; k >= 0; k--) {
        const ob = obArray[k];
        if (ob.mitigated && obArray.length > 50) obArray.splice(k, 1);
        else if (obArray.length > 100) obArray.pop();
      }
    }
  }
  setDrawingBar(null);

  const pts = (values: number[], colors: string[]) => values.map((v, i) => ({
    time: bars[i].time, value: Number.isFinite(v) ? v : NaN, color: colors[i],
  }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: pts(top, topColors), plot1: pts(btm, topColors), plot2: pts(mid, midColors) },
    fills: [{ id: 'fill0', plot1: 'plot0', plot2: 'plot1', options: { title: 'Strongest OB Zone Fill' }, colors: fillColors }],
    ...drawingOutputs(bars, toMs === 1 ? 'ms' : 's'),
  };
}

export const InstitutionalOrderFlowStrengthClassifier = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  drawingKinds,
};
