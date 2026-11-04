/**
 * Volume Bubbles & Liquidity Heatmap [LuxAlgo]
 *
 * Works on the last "Execute on last X bars" bars. The volume of each bar is split into a buy and a sell part by
 * the shape of the candle: a bullish candle gives its range to the buyers and its two wicks to the sellers, a bearish
 * candle the opposite (each part over the range plus the two wicks, rounded to a whole volume).
 *
 * Bubbles: the bars of each "Bubble Timeframe" period (a bubble starts on each new period) form an ellipse centred on
 * the middle bar and the middle price of the period. Its width is half the bars of the period times the volume of
 * the bubble over the largest bubble volume ("Bubble Size %"); its height follows from the largest bubble range per
 * bar and "Bubble Shape". "Buy & Sell Volume" splits the ellipse into a buy and a sell slice by their share (angles
 * in degrees), with a label for each part; "Total Volume" draws one ellipse with the total, "Delta Volume" one with
 * the buy minus sell volume (green when buyers lead, red otherwise). A dashed separator line marks the last bar of
 * each period.
 *
 * Liquidity heatmap: the price range of all the bars is cut into "Heatmap Rows" rows; each bar adds its volume to the
 * row of its rounded hlc3. A row starts a new cell when the price comes back into it after at least "Cell Minimum
 * Size" bars, else the cell grows; the last cell of a row extends to the right. Cell colours go from the third colour
 * (low volume) through the second to the first (the largest cell volume).
 *
 * Everything is drawn once, on the last closed bar (the bar before a live last bar). The original's object limits
 * apply: 100 polylines, 100 labels, 101 lines and 500 boxes (the oldest are deleted).
 *
 * Reference: "Volume Bubbles & Liquidity Heatmap [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  array, color, math, str, box, label, line, polyline, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ChartPoint,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { lastBarConfirmedOf, mintickOf, type ChartContext } from '../chart-context';
import { periodChanges } from '../anchor-period';

type BubbleMode = 'Total Volume' | 'Buy & Sell Volume' | 'Delta Volume';
type LabelLocation = 'Top' | 'Middle' | 'Bottom';

export interface VolumeBubblesLiquidityHeatmapInputs {
  /** Number of last bars used */
  lookbackPeriod: number;
  bubbles: boolean;
  bubblesMode: BubbleMode;
  /** Period of one bubble */
  bubbleTimeframe: string;
  /** Size of the bubbles in percent */
  bubbleSize: number;
  /** Vertical stretch of the bubbles */
  priceRatio: number;
  labels: boolean;
  /** Label text size (font size) */
  labelSize: number;
  labelLocation: LabelLocation;
  separators: boolean;
  separatorColor: string;
  heatmap: boolean;
  heatmapRows: number;
  /** Smallest number of bars of a heatmap cell */
  heatmapCell: number;
  heatmapColor1: string;
  heatmapColor2: string;
  heatmapColor3: string;
  buyColor: string;
  sellColor: string;
}

export const defaultInputs: VolumeBubblesLiquidityHeatmapInputs = {
  lookbackPeriod: 2000,
  bubbles: true,
  bubblesMode: 'Buy & Sell Volume',
  bubbleTimeframe: '1D',
  bubbleSize: 100,
  priceRatio: 0.5,
  labels: true,
  labelSize: 14,
  labelLocation: 'Bottom',
  separators: true,
  separatorColor: 'rgba(178, 181, 190, 0.5)',
  heatmap: true,
  heatmapRows: 25,
  heatmapCell: 20,
  heatmapColor1: 'rgba(242, 54, 69, 0.1)',
  heatmapColor2: 'rgba(253, 216, 53, 0.1)',
  heatmapColor3: 'rgba(41, 98, 255, 0.1)',
  buyColor: 'rgba(8, 153, 129, 0.5)',
  sellColor: 'rgba(242, 54, 69, 0.5)',
};

const BUBBLES_GROUP = 'BUBBLES';
const LABELS_GROUP = 'LABELS';
const SEPARATOR_GROUP = 'SEPARATORS';
const HISTOGRAM_GROUP = 'LIQUIDITY HEATMAP';
const STYLE_GROUP = 'STYLE';

export const inputConfig: InputConfig[] = [
  { id: 'lookbackPeriod', type: 'int', title: 'Execute on last X bars', defval: 2000, min: 100, max: 5000 },
  { id: 'bubbles', type: 'bool', title: 'Display Bubbles', defval: true, group: BUBBLES_GROUP },
  { id: 'bubblesMode', type: 'string', title: 'Bubble Mode', defval: 'Buy & Sell Volume',
    options: ['Total Volume', 'Buy & Sell Volume', 'Delta Volume'], group: BUBBLES_GROUP,
    tooltip: 'Select from the following options: total volume, buy and sell volume, or the delta between buy and sell volume.' },
  { id: 'bubbleTimeframe', type: 'timeframe', title: 'Bubble Timeframe', defval: '1D', group: BUBBLES_GROUP,
    tooltip: 'Select the timeframe for which the bubbles will be displayed.' },
  { id: 'bubbleSize', type: 'int', title: 'Bubble Size %', defval: 100, min: 10, max: 100, group: BUBBLES_GROUP,
    tooltip: 'Select the size of the bubbles as a percentage.' },
  { id: 'priceRatio', type: 'float', title: 'Bubble Shape', defval: 0.5, min: 0, step: 0.1, group: BUBBLES_GROUP,
    tooltip: 'Select the shape of the bubbles. The larger the number, the more vertical the bubbles will be stretched.' },
  { id: 'labels', type: 'bool', title: 'Display Labels', defval: true, group: LABELS_GROUP, inline: 'labels' },
  { id: 'labelSize', type: 'int', title: '', defval: 14, group: LABELS_GROUP, inline: 'labels' },
  { id: 'labelLocation', type: 'string', title: '', defval: 'Bottom', options: ['Top', 'Middle', 'Bottom'],
    group: LABELS_GROUP, inline: 'labels' },
  { id: 'separators', type: 'bool', title: 'Display Separators', defval: true, group: SEPARATOR_GROUP, inline: 'separators' },
  { id: 'separatorColor', type: 'color', title: '', defval: 'rgba(178, 181, 190, 0.5)', group: SEPARATOR_GROUP,
    inline: 'separators' },
  { id: 'heatmap', type: 'bool', title: 'Display Heatmap', defval: true, group: HISTOGRAM_GROUP },
  { id: 'heatmapRows', type: 'int', title: 'Heatmap Rows', defval: 25, min: 2, max: 500, group: HISTOGRAM_GROUP },
  { id: 'heatmapCell', type: 'int', title: 'Cell Minimum Size', defval: 20, min: 2, group: HISTOGRAM_GROUP },
  { id: 'heatmapColor1', type: 'color', title: '', defval: 'rgba(242, 54, 69, 0.1)', group: HISTOGRAM_GROUP, inline: 'histogram' },
  { id: 'heatmapColor2', type: 'color', title: '', defval: 'rgba(253, 216, 53, 0.1)', group: HISTOGRAM_GROUP, inline: 'histogram' },
  { id: 'heatmapColor3', type: 'color', title: '', defval: 'rgba(41, 98, 255, 0.1)', group: HISTOGRAM_GROUP, inline: 'histogram' },
  { id: 'buyColor', type: 'color', title: '', defval: 'rgba(8, 153, 129, 0.5)', group: STYLE_GROUP, inline: 'colors' },
  { id: 'sellColor', type: 'color', title: '', defval: 'rgba(242, 54, 69, 0.5)', group: STYLE_GROUP, inline: 'colors' },
];

export const plotConfig: PlotConfig[] = [];

/** Drawing kinds the script uses */
export const drawingKinds: StudyDrawingKind[] = ['box', 'label', 'line', 'polyline'];

export const metadata = {
  title: 'Volume Bubbles & Liquidity Heatmap [LuxAlgo]',
  shortTitle: 'LuxAlgo - Volume Bubbles & Liquidity Heatmap',
  overlay: true,
};

/** Text colour of a box without `text_color` in a v6 script (the boxes have no text) */
const BOX_TEXT = '#FFFFFF';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

interface BarData {
  buyVolume: number;
  sellVolume: number;
  highPrice: number;
  lowPrice: number;
  barIndex: number;
  newBubble: boolean;
}

interface Bubble {
  buyVolume: number[];
  sellVolume: number[];
  highs: number[];
  lows: number[];
  bars: number[];
}

interface HistogramBox {
  firstBar: number;
  lastBar: number;
  liquidity: number;
  extend: 'right' | 'none';
}

/** `for i = from to to` (step 1; counts down when from > to; no iteration with an na bound) */
function pineFor(from: number, to: number, body: (i: number) => void): void {
  if (isNaN(from) || isNaN(to)) return;
  if (from <= to) for (let i = from; i <= to; i++) body(i);
  else for (let i = from; i >= to; i--) body(i);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeBubblesLiquidityHeatmapInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lastBarIndex = n - 1;
  const lookback = Math.trunc(cfg.lookbackPeriod);
  const bubbleSize = Math.trunc(cfg.bubbleSize) * 0.01;
  const priceRatio = cfg.priceRatio;
  const rows = Math.trunc(cfg.heatmapRows);
  const minCell = Math.trunc(cfg.heatmapCell);
  const mintick = mintickOf(chart);
  const newPeriod = periodChanges(bars, cfg.bubbleTimeframe, chart);
  // barstate.islastconfirmedhistory: the bar before a live last bar, else the last bar
  const drawBar = lastBarConfirmedOf(chart) ? lastBarIndex : lastBarIndex - 1;
  const start = Math.max(0, lastBarIndex - lookback);

  resetDrawings({ polyline: 100, label: 100, line: 101, box: 500 });

  // fetchData() on each bar of the execution window up to the drawing bar
  const data: BarData[] = [];
  const histBars: { barIndex: number; barVolume: number; barPrice: number }[] = [];
  let histTop = 0;
  let histBottom = 0;
  for (let i = start; i <= drawBar; i++) {
    const b = bars[i];
    const vol = b.volume ?? NaN;
    const barTop = b.high - Math.max(b.open, b.close);
    const barBottom = Math.min(b.open, b.close) - b.low;
    const barRange = b.high - b.low;
    const bullBar = gt(b.close - b.open, 0);
    const buyRange = bullBar ? barRange : barTop + barBottom;
    const sellRange = bullBar ? barTop + barBottom : barRange;
    const totalRange = barRange + barTop + barBottom;
    const buyVolume = math.round((buyRange / totalRange) * vol);
    const sellVolume = math.round((sellRange / totalRange) * vol);
    if (data.length >= lookback) {
      data.shift();
      histBars.shift();
    }
    // timeframe.change() inside fetchData(), which only runs in the window: false on its first call
    const newBubble = i > start && newPeriod[i];
    data.push({ buyVolume, sellVolume, highPrice: b.high, lowPrice: b.low, barIndex: i, newBubble });
    histBars.push({ barIndex: i, barVolume: vol, barPrice: math.round_to_mintick((b.high + b.low + b.close) / 3, mintick) });
    if (histTop === 0) {
      histTop = b.high;
      histBottom = b.low;
    } else {
      histTop = Math.max(histTop, b.high);
      histBottom = Math.min(histBottom, b.low);
    }
  }

  if (drawBar >= start) {
    setDrawingBar(drawBar, drawBar === lastBarIndex, lastBarIndex);
    if (cfg.heatmap) drawHistogram();
    if (cfg.bubbles) drawBubbles();
    setDrawingBar(null);
  }

  /** drawHistogram() */
  function drawHistogram(): void {
    const rowSize = math.round_to_mintick((histTop - histBottom) / rows, mintick);
    const levels: { top: number; bottom: number; boxes: HistogramBox[] }[] = [];
    for (let index = 0; index <= rows - 1; index++) {
      const bottom = histBottom + index * rowSize;
      levels.push({ top: bottom + rowSize, bottom, boxes: [] });
    }
    let maxVolume = 0;
    let lastLevel = 0;
    for (const eachBar of histBars) {
      let level = Math.floor((eachBar.barPrice - histBottom) / rowSize);
      level = Math.min(level, levels.length - 1);
      const lv = array.get(levels, level);
      const boxes = lv.boxes;
      if (boxes.length === 0) {
        boxes.push({ firstBar: eachBar.barIndex, lastBar: eachBar.barIndex, liquidity: eachBar.barVolume, extend: 'right' });
      } else {
        const bx = boxes[boxes.length - 1];
        bx.lastBar = eachBar.barIndex;
        if (level === lastLevel) {
          bx.liquidity += eachBar.barVolume;
        } else if (bx.lastBar - bx.firstBar >= minCell) {
          bx.extend = 'none';
          boxes.push({ firstBar: eachBar.barIndex, lastBar: eachBar.barIndex, liquidity: eachBar.barVolume, extend: 'right' });
        } else {
          bx.liquidity += eachBar.barVolume;
        }
        maxVolume = Math.max(maxVolume, bx.liquidity);
      }
      lastLevel = level;
    }
    for (const lv of levels) {
      for (const bx of lv.boxes) {
        const r = bx.liquidity / maxVolume;
        const low = r <= 0.5;
        const bg = color.from_gradient(r, low ? 0.0 : 0.5, low ? 0.5 : 1.0, low ? cfg.heatmapColor3 : cfg.heatmapColor2,
          low ? cfg.heatmapColor2 : cfg.heatmapColor1);
        box.new(bx.firstBar, lv.top, bx.lastBar, lv.bottom, 'transparent', undefined, undefined, bx.extend, undefined,
          String(bg), undefined, undefined, BOX_TEXT);
      }
    }
  }

  /** fetchBubbles() + drawBubbles() */
  function drawBubbles(): void {
    const bubbles: Bubble[] = [];
    for (const eachBar of data) {
      if (eachBar.newBubble) bubbles.push({ buyVolume: [], sellVolume: [], highs: [], lows: [], bars: [] });
      if (bubbles.length !== 0) {
        const cur = bubbles[bubbles.length - 1];
        cur.highs.push(eachBar.highPrice);
        cur.lows.push(eachBar.lowPrice);
        cur.bars.push(eachBar.barIndex);
        cur.buyVolume.push(eachBar.buyVolume);
        cur.sellVolume.push(eachBar.sellVolume);
      }
    }
    const sumBuy = bubbles.map((bb) => array.sum(bb.buyVolume));
    const sumSell = bubbles.map((bb) => array.sum(bb.sellVolume));
    const volumes = bubbles.map((_, k) => sumBuy[k] + sumSell[k]);
    const ranges = bubbles.map((bb) => array.max(bb.highs) - array.min(bb.lows));
    const deltas = bubbles.map((_, k) => sumBuy[k] - sumSell[k]);
    const volumesMax = array.max(volumes);
    const rangesMax = array.max(ranges);
    const deltasMax = array.max(deltas);

    const coordinates = (anchorBar: number, anchorPrice: number, angle: number, radiusBar: number, radiusPrice: number) => {
      const x = Math.min(math.round(anchorBar + radiusBar * math.cos(math.toradians(angle))), lastBarIndex + 500);
      const y = anchorPrice + radiusPrice * math.sin(math.toradians(angle));
      return [x, y] as const;
    };
    // chart.point.new(na, x, y): the bar index of a point is an int
    const point = (x: number, y: number): ChartPoint => ({ time: null, index: Math.trunc(x), price: y });

    const drawLabel = (loc: LabelLocation, bubbleVolume: number, bubbleColor: string, anchorBar: number,
      anchorPrice: number, angle: number, radiusBar: number, radiusPrice: number) => {
      const [x, y] = coordinates(anchorBar, anchorPrice, angle, radiusBar, radiusPrice);
      const style = loc === 'Top' ? 'label_down' : loc === 'Middle' ? 'none' : 'label_up';
      label.new(x, y, str.tostring(bubbleVolume, 'volume'), 'bar_index', 'price', 'transparent', style,
        String(color.new(bubbleColor, 0)), Math.trunc(cfg.labelSize));
    };
    const separator = (bb: Bubble) => {
      if (!cfg.separators) return;
      const x = bb.bars[bb.bars.length - 1];
      line.new(x, array.max(bb.highs), x, array.min(bb.lows), 'bar_index', 'none', cfg.separatorColor, 'dashed');
    };

    bubbles.forEach((bb, k) => {
      const anchorBar = array.median(bb.bars);
      const anchorPrice = math.round_to_mintick(0.5 * (array.max(bb.highs) + array.min(bb.lows)), mintick);
      const size = bb.bars.length;
      if (cfg.bubblesMode === 'Buy & Sell Volume') {
        // drawSplitBubble()
        const bubbleVolume = sumBuy[k] + sumSell[k];
        const bubbleRatio = (bubbleVolume / volumesMax) * bubbleSize;
        const radiusBar = Math.floor(0.5 * size) * bubbleRatio;
        const range2barRatio = rangesMax / size;
        const radiusPrice = radiusBar * range2barRatio * priceRatio;
        const volumeRatio = bubbleVolume / 360;
        const normalizedBuyVolume = sumBuy[k] / volumeRatio;
        const normalizedSellVolume = sumSell[k] / volumeRatio;
        const buyPoints: ChartPoint[] = [point(anchorBar, anchorPrice)];
        pineFor(0, normalizedBuyVolume, (a) => {
          const [x, y] = coordinates(anchorBar, anchorPrice, a, radiusBar, radiusPrice);
          buyPoints.push(point(x, y));
        });
        buyPoints.push(point(anchorBar, anchorPrice));
        const sellPoints: ChartPoint[] = [point(anchorBar, anchorPrice)];
        pineFor(normalizedBuyVolume, normalizedBuyVolume + normalizedSellVolume, (a) => {
          const [x, y] = coordinates(anchorBar, anchorPrice, a, radiusBar, radiusPrice);
          sellPoints.push(point(x, y));
        });
        sellPoints.push(point(anchorBar, anchorPrice));
        if (cfg.labels) {
          const middle = cfg.labelLocation === 'Middle';
          const labelRadius = middle ? 0.5 * radiusPrice : radiusPrice;
          drawLabel(middle ? 'Middle' : 'Top', sumBuy[k], String(color.new(cfg.buyColor, 0)), anchorBar, anchorPrice, 90,
            radiusBar, labelRadius);
          drawLabel(middle ? 'Middle' : 'Bottom', sumSell[k], String(color.new(cfg.sellColor, 0)), anchorBar, anchorPrice,
            270, radiusBar, labelRadius);
        }
        separator(bb);
        polyline.new(buyPoints, false, true, 'bar_index', String(color.new(cfg.buyColor, 0)), cfg.buyColor);
        polyline.new(sellPoints, false, true, 'bar_index', String(color.new(cfg.sellColor, 0)), cfg.sellColor);
      } else {
        // drawFullBubble()
        const deltaBubble = cfg.bubblesMode === 'Delta Volume';
        const bubbleVolume = Math.abs(sumBuy[k] + (deltaBubble ? -1 : 1) * sumSell[k]);
        const bubbleRatio = (bubbleVolume / (deltaBubble ? deltasMax : volumesMax)) * bubbleSize;
        const radiusBar = Math.floor(0.5 * size) * bubbleRatio;
        const range2barRatio = rangesMax / size;
        const radiusPrice = radiusBar * range2barRatio * priceRatio;
        const points: ChartPoint[] = [];
        for (let a = 0; a <= 360; a++) {
          const [x, y] = coordinates(anchorBar, anchorPrice, a, radiusBar, radiusPrice);
          points.push(point(x, y));
        }
        const bubbleColor = gt(sumBuy[k] - sumSell[k], 0) ? cfg.buyColor : cfg.sellColor;
        if (cfg.labels) {
          const loc = cfg.labelLocation;
          const labelAngle = loc === 'Top' ? 90 : loc === 'Bottom' ? 270 : 0;
          drawLabel(loc, bubbleVolume, bubbleColor, anchorBar, anchorPrice, labelAngle, loc !== 'Middle' ? radiusBar : 0,
            loc !== 'Middle' ? radiusPrice : 0);
        }
        separator(bb);
        polyline.new(points, false, true, 'bar_index', String(color.new(bubbleColor, 0)), bubbleColor);
      }
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars, chart?.timeUnit === 'ms' ? 'ms' : 's'),
  };
}

export const VolumeBubblesLiquidityHeatmap = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
