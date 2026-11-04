/**
 * AI Moving Average (Expo)
 *
 * Two k-nearest-neighbours (KNN) moving averages.
 * - AI(1): a moving average 'Select MA' of 'Data For Moving Average'. Its last 'DataPoints' values (at least
 *   'Neighbors') are labelled 1 when the classified source is above the average and the average rises, else 0. The
 *   current average is classified by the labels of its 'Neighbors' nearest past values (weights 1 / (distance +
 *   1e-6)): 1 bullish (lime), 0 bearish (red), between them neutral (blue). Three plots of the average, one per
 *   class colour.
 * - Box slope: a least squares line of the average since the last switch to bullish or bearish, drawn on each bar
 *   (lime when its slope is positive, else red).
 * - On each switch to bullish or bearish a box (high / low range of the switch bar and the 20 bars before it, then
 *   extended with each bar) and a dotted mid line. 'Remove All Boxes' / 'Remove All Line' (on by default) delete
 *   them on every bar, 'Remove Historical Boxes' deletes the box before when a new one starts.
 * - AI(2): sma(close, 'Smoothing Period'); mean of the 'Number of Closest Values' values, among the last 30 or more
 *   bars (current bar not included), nearest to that average: of the close (Moving Average 1) and of the average
 *   itself (Moving Average 2), smoothed by wma(5). While the average is na the mean is 0, as the original.
 *
 * The 'Line Width' input is the width of the mid lines.
 *
 * Reference: "AI Moving Average (Expo)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, array, getSourceSeries, line, box, resetDrawings, setDrawingBar, varDrawing, Series,
  type Bar, type Box, type IndicatorResult, type InputConfig, type Line, type PlotConfig, type SourceType,
} from 'oakscriptjs';
import type { BoxData, LineDrawingData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';

export interface AiMovingAverageInputs {
  /** Show AI(1) Moving Average */
  aiMa: boolean;
  /** Show AI(1) Slope */
  aiSlope: boolean;
  /** Select MA */
  maType: 'SMA' | 'EMA' | 'WMA' | 'RMA' | 'HMA' | 'VWMA';
  /** Moving average length */
  length: number;
  /** Neighbors */
  k: number;
  /** DataPoints */
  n: number;
  /** Show AI(2) Moving Average 1 */
  aiMa2: boolean;
  /** Show AI(2) Moving Average 2 */
  aiMa3: boolean;
  /** Number of Closest Values */
  numberOfClosestValues: number;
  /** Smoothing Period */
  smoothingPeriod: number;
  /** Data To Classify */
  dataToClassify: SourceType;
  /** Data For Moving Average (DataForComparison) */
  dataForMovingAverage: SourceType;
  /** Bearish box colour */
  negBoxCol: string;
  /** Bullish box colour */
  posBoxCol: string;
  /** Mid line colour */
  lineCol: string;
  /** Mid line width */
  lineWidth: number;
  /** Remove Historical Boxes */
  del: boolean;
  /** Remove All Boxes */
  delBoxes: boolean;
  /** Remove All Line */
  delLine: boolean;
}

export const defaultInputs: AiMovingAverageInputs = {
  aiMa: false,
  aiSlope: true,
  maType: 'SMA',
  length: 50,
  k: 5,
  n: 10,
  aiMa2: false,
  aiMa3: true,
  numberOfClosestValues: 15,
  smoothingPeriod: 20,
  dataToClassify: 'close',
  dataForMovingAverage: 'close',
  negBoxCol: 'rgba(255, 82, 82, 0.25)',
  posBoxCol: 'rgba(0, 230, 118, 0.25)',
  lineCol: '#FFA927',
  lineWidth: 2,
  del: false,
  delBoxes: true,
  delLine: true,
};

const T1 = "Number of neighbors used in the KNN algorithm. Increasing 'k' can make the prediction more resilient to noise but may decrease sensitivity to local variations.\n\nNumber of data points considered in the AI analysis. This affects how the AI interprets patterns in the price data.";
const T2 = 'Type of moving average to be applied. Various options allow for different smoothing techniques which can emphasize or dampen certain aspects of the price movement. \n\nLength of the moving average. A greater length will create a smoother curve but might lag behind recent price changes.';
const T3 = 'Source data used to classify price as bullish or bearish. Can be adjusted to consider different aspects of the price information.';
const T4 = 'Source data used to calculate the moving average for comparison. Different selections may emphasize different aspects of price movement.';
const T5 = 'Toggle to show or hide the AI-generated moving average line.';
const T6 = 'Toggle to show or hide the AI-calculated slope of the trend.';
const T7 = 'Option to remove or retain historical boxes.';
const T8 = 'Smoothing period for the initial moving average in the AI(2) algorithm.';
const T9 = 'Toggle to remove all boxes from the chart.';
const T10 = 'Toggle to remove all lines from the chart.';
const T11 = 'Number of closest values used for the calculation of AI(2) Moving Averages. A higher number may provide a smoother but less sensitive curve.';

export const inputConfig: InputConfig[] = [
  { id: 'aiMa', type: 'bool', title: 'Show AI(1) Moving Average', defval: false, group: 'AI(1) Average', tooltip: T5 },
  { id: 'aiSlope', type: 'bool', title: 'Show AI(1) Slope', defval: true, group: 'AI(1) Average', tooltip: T6 },
  { id: 'maType', type: 'string', title: 'Select MA', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'RMA', 'HMA', 'VWMA'],
    inline: 'MA', group: 'AI(1) Average' },
  { id: 'length', type: 'int', title: '', defval: 50, min: 1, inline: 'MA', group: 'AI(1) Average', tooltip: T2 },
  { id: 'k', type: 'int', title: 'Neighbors', defval: 5, min: 1, max: 100, inline: 'AI', group: 'AI(1) Settings' },
  { id: 'n', type: 'int', title: 'DataPoints', defval: 10, min: 1, max: 100, inline: 'AI', group: 'AI(1) Settings', tooltip: T1 },
  { id: 'aiMa2', type: 'bool', title: 'Show AI(2) Moving Average 1', defval: false, group: 'AI(2) Average', tooltip: T5 },
  { id: 'aiMa3', type: 'bool', title: 'Show AI(2) Moving Average 2', defval: true, group: 'AI(2) Average', tooltip: T6 },
  { id: 'numberOfClosestValues', type: 'int', title: 'Number of Closest Values', defval: 15, min: 2, max: 200,
    inline: 'AI2', group: 'AI(2) Settings', tooltip: T11 },
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 20, min: 2, max: 500, inline: 'aiMa_2',
    group: 'AI(2) Settings', tooltip: T8 },
  { id: 'dataToClassify', type: 'source', title: 'Data To Classify', defval: 'close', group: 'AI(1) Settings', tooltip: T3 },
  { id: 'dataForMovingAverage', type: 'source', title: 'Data For Moving Average (DataForComparison)', defval: 'close',
    group: 'AI(1) Settings', tooltip: T4 },
  { id: 'negBoxCol', type: 'color', title: '', defval: 'rgba(255, 82, 82, 0.25)', group: 'Style', inline: 'box' },
  { id: 'posBoxCol', type: 'color', title: '', defval: 'rgba(0, 230, 118, 0.25)', group: 'Style', inline: 'box' },
  { id: 'lineCol', type: 'color', title: '', defval: '#FFA927', group: 'Style', inline: 'box' },
  { id: 'lineWidth', type: 'int', title: '', defval: 2, group: 'Style', inline: 'box', tooltip: 'Box & Line coloring' },
  { id: 'del', type: 'bool', title: 'Remove Historical Boxes', defval: false, group: 'Style', tooltip: T7 },
  { id: 'delBoxes', type: 'bool', title: 'Remove All Boxes', defval: true, group: 'Style', tooltip: T9 },
  { id: 'delLine', type: 'bool', title: 'Remove All Line', defval: true, group: 'Style', tooltip: T10 },
];

const LIME = '#00E676';
const RED = '#FF5252';
const NEUTRAL = '#0088FF';
const AI2_1 = '#1FC7FF';
const YELLOW = '#FFEB3B';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AI(1) Bullish Trend', color: LIME, lineWidth: 2, palette: [LIME] },
  { id: 'plot1', title: 'AI(1) Bearish Trend', color: RED, lineWidth: 2, palette: [RED] },
  { id: 'plot2', title: 'AI(1) Moving Average', color: NEUTRAL, lineWidth: 1, palette: [NEUTRAL] },
  { id: 'plot3', title: 'AI(1) Box Slope', color: LIME, lineWidth: 1, palette: [LIME, RED] },
  { id: 'plot4', title: 'AI(2) Moving Average 1', color: AI2_1, lineWidth: 1 },
  { id: 'plot5', title: 'AI(2) Moving Average 2', color: YELLOW, lineWidth: 1 },
];

export const drawingKinds: StudyDrawingKind[] = ['box', 'line'];

export const metadata = {
  title: 'AI Moving Average (Expo)',
  shortTitle: 'AI Moving Average (Expo)',
  overlay: true,
};

/** Default max_boxes_count / max_lines_count */
const MAX_OBJECTS = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<AiMovingAverageInputs> = {},
): IndicatorResult & { boxes: BoxData[]; lines: LineDrawingData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const nBars = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const length = cfg.length;
  const k = cfg.k;
  const nPts = Math.max(k, cfg.n);
  const numberOfClosestValues = cfg.numberOfClosestValues;
  const windowSize = Math.max(numberOfClosestValues, 30);

  const maSrc = getSourceSeries(bars, cfg.dataForMovingAverage);
  const ma = A(
    cfg.maType === 'EMA' ? ta.ema(maSrc, length)
      : cfg.maType === 'WMA' ? ta.wma(maSrc, length)
        : cfg.maType === 'RMA' ? ta.rma(maSrc, length)
          : cfg.maType === 'HMA' ? ta.hma(maSrc, length)
            : cfg.maType === 'VWMA' ? ta.vwma(maSrc, length, new Series(bars, (b) => b.volume ?? NaN))
              : ta.sma(maSrc, length),
  );
  const cls = A(getSourceSeries(bars, cfg.dataToClassify));
  const at = (s: number[], i: number) => (i >= 0 ? s[i] : NaN);

  // knn_weighted(data, labels, k, ma) of each bar
  const label = new Array<number>(nBars).fill(NaN);
  for (let bar = 0; bar < nBars; bar++) {
    const data: number[] = [];
    const labels: number[] = [];
    for (let i = 0; i < nPts; i++) {
      data.push(at(ma, bar - i));
      const labelI = gt(at(cls, bar - i), at(ma, bar - i)) ? 1 : 0;
      const labelJ = gt(at(ma, bar - i), at(ma, bar - i - 1)) ? 1 : 0;
      labels.push(Math.trunc((labelI + labelJ) / 2));
    }
    const x = ma[bar];
    const distances = data.map((d) => Math.abs(x - d));
    const indices = data.map((_, i) => i);
    // bubble sort, ascending
    for (let i = 0; i <= nPts - 2; i++) {
      for (let j = 0; j <= nPts - i - 2; j++) {
        if (gt(distances[j], distances[j + 1])) {
          const tempDist = distances[j];
          distances[j] = distances[j + 1];
          distances[j + 1] = tempDist;
          const tempIndex = indices[j];
          indices[j] = indices[j + 1];
          indices[j + 1] = tempIndex;
        }
      }
    }
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < k; i++) {
      const weight = 1 / (distances[i] + 1e-6);
      weightedSum += weight * labels[indices[i]];
      totalWeight += weight;
    }
    label[bar] = weightedSum / totalWeight;
  }

  // meanOfKClosest(value_in_, target_)
  const close = bars.map((b) => b.close);
  const maS = A(ta.sma(new Series(bars, (b) => b.close), cfg.smoothingPeriod));
  const meanOfKClosest = (valueIn: number[], target: number[]) =>
    target.map((tgt, bar) => {
      const closestDistances = new Array<number>(numberOfClosestValues).fill(1e10);
      const closestValues = new Array<number>(numberOfClosestValues).fill(0);
      for (let i = 1; i <= windowSize; i++) {
        const value = at(valueIn, bar - i);
        const distance = Math.abs(tgt - value);
        let maxDistIndex = 0;
        let maxDistValue = closestDistances[0];
        for (let j = 1; j <= numberOfClosestValues - 1; j++) {
          if (gt(closestDistances[j], maxDistValue)) {
            maxDistIndex = j;
            maxDistValue = closestDistances[j];
          }
        }
        if (lt(distance, maxDistValue)) {
          closestDistances[maxDistIndex] = distance;
          closestValues[maxDistIndex] = value;
        }
      }
      return array.sum(array.from(...closestValues)) / numberOfClosestValues;
    });
  const knnPriceMa = meanOfKClosest(close, maS);
  const knnMaMa = meanOfKClosest(maS, maS);
  const wma1 = A(ta.wma(Series.fromArray(bars, knnPriceMa), 5));
  const wma2 = A(ta.wma(Series.fromArray(bars, knnMaMa), 5));

  const highPoint = A(ta.highest(new Series(bars, (b) => b.high), 20));
  const lowPoint = A(ta.lowest(new Series(bars, (b) => b.low), 20));

  resetDrawings({ box: MAX_OBJECTS, line: MAX_OBJECTS });
  const bo = varDrawing<Box>();
  const li = varDrawing<Line>();
  let maxHi = NaN;
  let minLo = NaN;
  const xValues = array.new_float(0);
  const yValues = array.new_float(0);
  const lineEq = new Array<number>(nBars).fill(NaN);
  const slopeArr = new Array<number>(nBars).fill(NaN);
  let prevRed = false;
  let prevGreen = false;
  let prevBlue = false;
  for (let i = 0; i < nBars; i++) {
    setDrawingBar(i, i === nBars - 1);
    const b = bars[i];
    const lab = label[i];
    const red = eq(lab, 0);
    const green = eq(lab, 1);
    const blue = !red && !green;
    const switchdown = (prevBlue || prevGreen) && red;
    const switchup = (prevBlue || prevRed) && green;
    prevRed = red;
    prevGreen = green;
    prevBlue = blue;

    // slope of the average since the last switch
    if (switchdown || switchup) {
      array.clear(xValues);
      array.clear(yValues);
    }
    array.push(xValues, i);
    array.push(yValues, ma[i]);
    let slope = NaN;
    let intercept = NaN;
    const count = array.size(xValues);
    if (count > 1) {
      const sumX = array.sum(xValues);
      const sumY = array.sum(yValues);
      let sumXY = 0;
      let sumX2 = 0;
      for (let j = 0; j < count; j++) {
        const x = array.get(xValues, j) ?? NaN;
        const y = array.get(yValues, j) ?? NaN;
        sumXY = sumXY + x * y;
        sumX2 = sumX2 + x * x;
      }
      slope = (count * sumXY - sumX * sumY) / (count * sumX2 - sumX * sumX);
      intercept = (sumY - slope * sumX) / count;
    }
    slopeArr[i] = slope;
    lineEq[i] = isNaN(slope) ? NaN : slope * i + intercept;

    // box and mid line
    if (switchdown || switchup) {
      if (cfg.del && bo.value) box.delete(bo.value);
      maxHi = isNaN(highPoint[i]) ? b.high : Math.max(highPoint[i], b.high);
      minLo = isNaN(lowPoint[i]) ? b.low : Math.min(lowPoint[i], b.low);
      bo.value = box.new(i, maxHi, i + 1, minLo, 'transparent', undefined, undefined, undefined, undefined,
        gt(lab, 0) ? cfg.posBoxCol : cfg.negBoxCol);
      const mid = (maxHi + minLo) / 2;
      li.value = line.new(i, mid, i, mid, 'bar_index', undefined, cfg.lineCol, 'dotted', cfg.lineWidth);
    }
    maxHi = Math.max(maxHi, b.high);
    minLo = Math.min(minLo, b.low);
    if (bo.value) {
      box.set_top(bo.value, maxHi);
      box.set_rightbottom(bo.value, i, minLo);
    }
    if (li.value) {
      line.set_y1(li.value, (maxHi + minLo) / 2);
      line.set_xy2(li.value, i, (maxHi + minLo) / 2);
    }
    if (cfg.delBoxes && bo.value) box.delete(bo.value);
    if (cfg.delLine && li.value) line.delete(li.value);
  }
  setDrawingBar(null);

  const pts = (show: boolean, values: number[], col?: (i: number) => string) =>
    bars.map((b, i) => ({
      time: b.time,
      value: show && Number.isFinite(values[i]) ? values[i] : NaN,
      ...(col ? { color: col(i) } : {}),
    }));
  const plots = {
    plot0: pts(cfg.aiMa, ma, (i) => (eq(label[i], 1) ? LIME : 'transparent')),
    plot1: pts(cfg.aiMa, ma, (i) => (eq(label[i], 0) ? RED : 'transparent')),
    plot2: pts(cfg.aiMa, ma, (i) => (eq(label[i], 1) ? 'transparent' : eq(label[i], 0) ? 'transparent' : NEUTRAL)),
    plot3: pts(cfg.aiSlope, lineEq, (i) => (gt(slopeArr[i], 0) ? LIME : RED)),
    plot4: pts(cfg.aiMa2, wma1),
    plot5: pts(cfg.aiMa3, wma2),
  };

  const t = (x: number) => bars[x].time as number;
  const boxes: BoxData[] = box.all().map((bx) => ({
    time1: t(bx.left), price1: bx.top, time2: t(bx.right), price2: bx.bottom,
    bgColor: String(bx.bgcolor), borderColor: 'transparent',
  }));
  const lines: LineDrawingData[] = line.all().map((l) => ({
    time1: t(l.x1), price1: l.y1, time2: t(l.x2), price2: l.y2, color: String(l.color),
    style: 'dotted' as const, width: l.width,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    boxes,
    lines,
  };
}

export const AiMovingAverage = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
