/**
 * Smart Money Breakout Channels [AlgoAlpha]
 *
 * The close is normalised in the range of the last 'Normalization Length' bars and `vol` is its standard deviation
 * over 14 bars. `upper` / `lower` are the positions of the highest / lowest `vol` in the last 'Box Detection Length'
 * + 1 bars. `duration` is the number of bars since `lower` crossed over `upper`. When `upper` crosses over `lower`
 * after more than 10 bars, a channel is made from the highest high to the lowest low of these `duration` bars:
 * a grey box, a red box at its top and a green box at its bottom (each half an ATR high) and a dashed mid line.
 * A channel grows to the right until the price (the mid of the candle body with 'Strong Closes Only', else the
 * close) is above its top or below its bottom: a breakout label is drawn at the opposite side and the channel
 * stops there. Without 'Nested Channels' a new channel is not made while it overlaps a running one.
 *
 * Volume: two candle series are drawn from the mid line of the newest running channel (up volume above, down
 * volume below; total volume or volume delta in the other modes), scaled by the 20-bar average volume, and the
 * volume of the bar is written in the red or green box. On the last bar a gauge of 21 segments is drawn 2 bars
 * after the channel, with a pointer at the place of the volume delta between its lowest and highest value since
 * the last cross of `lower` over `upper`.
 *
 * Limit, lower-timeframe volume: the original reads the up volume, down volume and delta of each bar from the bars
 * of 'Volume Delta Timeframe Source' (default 1 minute) with `requestUpAndDownVolume()` of the ta library of the
 * platform. The bars passed to a port are the chart bars only, so the port ESTIMATES these three values from the
 * chart bars (src/lower-tf-volume.ts): all the volume of a bar is up volume or down volume by the library rule (up
 * when close > open, down when close < open, else by the close against the previous close, else as the previous bar).
 * So with the default inputs the volume numbers in the boxes, the heights of the volume candles and the gauge
 * pointer are NOT the values of the original. Also, the original has these values only on the bars where data of
 * the lower timeframe exists (the most recent bars for 1 minute; elsewhere its texts are "NaNK/NaNK", its candles
 * are flat and its pointer is missing), while the port has the estimate on every bar. Everything else (channels,
 * mid lines, breakout labels, gauge segments, colours, and the texts and candles of the mode "Volume") does not use
 * these values.
 * The timeframe input is kept. In the port it only does this: equal to the chart timeframe (taken from the bar
 * times), the chart bars are the bars of the request and the three values are the original ones; below the chart
 * timeframe, the estimate is used whatever its value; above the chart timeframe, the error of the library is
 * thrown.
 *
 * The script reads the chart foreground colour. A port has no chart theme: it uses the colour of the reference run
 * (#DBDBDB). A gauge pointer without a value (na) is not drawn and is left out. The 3 alert conditions of the
 * script have no output.
 *
 * Reference: "Smart Money Breakout Channels [AlgoAlpha]" by AlgoAlpha
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoAlpha
 */

import { ta, Series, color, math, str, timeframe, callsite, barTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LabelData, LineDrawingData, MarkerData, PineSize, PlotCandleData, TableData } from '../types';
import { chartTimeframe } from '../anchor-period';
import { upDownVolumeOfChartBars } from '../lower-tf-volume';

export interface SmartMoneyBreakoutChannelsInputs {
  /** Nested Channels: several channels can run at the same time */
  overlap: boolean;
  /** Strong Closes Only: a breakout needs the mid of the candle body outside the channel */
  strong: boolean;
  /** Normalization Length */
  normLength: number;
  /** Box Detection Length */
  length: number;
  /** Show Volume Analysis (the volume candles) */
  showVolume: boolean;
  volMode: 'Volume' | 'Comparison' | 'Delta';
  /** Volume Delta Timeframe Source (see the file header for what it does in the port) */
  tf: string;
  volScale: number;
  textSize: 'Tiny' | 'Small' | 'Medium' | 'Large';
  green: string;
  red: string;
}

export const defaultInputs: SmartMoneyBreakoutChannelsInputs = {
  overlap: false,
  strong: true,
  normLength: 100,
  length: 14,
  showVolume: true,
  volMode: 'Comparison',
  tf: '1',
  volScale: 0.5,
  textSize: 'Tiny',
  green: '#00ffbb',
  red: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'overlap', type: 'bool', title: 'Nested Channels', defval: false, group: 'Main Settings',
    tooltip: 'When enabled, allows multiple channels to overlap. When disabled, only one channel can exist at a time. Overlapping channels can show multiple breakout levels simultaneously.',
  },
  {
    id: 'strong', type: 'bool', title: 'Strong Closes Only', defval: true, group: 'Main Settings',
    tooltip: 'When enabled, breakouts only trigger when more than 50% of the candle body is outside the channel. This reduces false signals from wicks. When disabled, any price movement outside the channel triggers a breakout.',
  },
  {
    id: 'normLength', type: 'int', title: 'Normalization Length', defval: 100, min: 1, group: 'Main Settings',
    tooltip: 'The number of bars used to calculate the highest high and lowest low for price normalization. Higher values create more stable normalization but may be less responsive to recent price changes.',
  },
  {
    id: 'length', type: 'int', title: 'Box Detection Length', defval: 14, min: 1, group: 'Main Settings',
    tooltip: 'The number of bars used to detect channel formation patterns. Lower values create more frequent channels but may be more sensitive to noise. Higher values create fewer but potentially more significant channels.',
  },
  {
    id: 'showVolume', type: 'bool', title: 'Show Volume Analysis', defval: true, group: 'Volume Analysis',
    tooltip: 'When enabled, displays volume analysis as candle-like bars within the channel. This helps identify volume patterns that may precede breakouts.',
  },
  {
    id: 'volMode', type: 'string', title: 'Volume Display Mode', defval: 'Comparison', options: ['Volume', 'Comparison', 'Delta'], group: 'Volume Analysis',
    tooltip: 'Volume: Shows total volume as symmetrical bars. Comparison: Shows up volume above midline, down volume below. Delta: Shows net volume delta (positive above, negative below midline).',
  },
  {
    id: 'tf', type: 'timeframe', title: 'Volume Delta Timeframe Source', defval: '1', group: 'Volume Analysis',
    tooltip: 'The timeframe used to calculate volume delta data. Lower timeframes provide more granular volume analysis but may be noisier.',
  },
  {
    id: 'volScale', type: 'float', title: 'Volume Scale', defval: 0.5, min: 0.1, max: 2.0, step: 0.1, group: 'Volume Analysis',
    tooltip: 'Adjusts the height of volume bars relative to channel size. Higher values make volume bars more prominent, lower values make them more subtle.',
  },
  {
    id: 'textSize', type: 'string', title: 'Volume Text Size', defval: 'Tiny', options: ['Tiny', 'Small', 'Medium', 'Large'], group: 'Appearance',
    tooltip: 'Size of the volume text at the corner of the channels.',
  },
  {
    id: 'green', type: 'color', title: 'Bullish Colour', defval: '#00ffbb', group: 'Appearance',
    tooltip: 'Primary colour for bullish visual elements. Adjust for preferred palette – affects bars, fills, and labels when momentum is positive.',
  },
  {
    id: 'red', type: 'color', title: 'Bearish Colour', defval: '#ff1100', group: 'Appearance',
    tooltip: 'Primary colour for bearish visual elements. Adjust for preferred palette – affects bars, fills, and labels when momentum is negative.',
  },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Smart Money Breakout Channels [AlgoAlpha]',
  shortTitle: 'AlgoAlpha - Breakout Channels',
  overlay: true,
};

/** chart.fg_color of the reference run */
const CHART_FG = '#DBDBDB';
/** indicator(max_boxes_count = 500); lines keep the default of 50 */
const MAX_BOXES = 500;
const MAX_LINES = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** A drawing of the script with its place in the creation order (`dead` = deleted) */
interface Obj {
  dead: boolean;
}
interface BoxObj extends Obj {
  left: number;
  top: number;
  right: number;
  bottom: number;
  bg: string;
  text?: string;
  textHAlign?: 'right';
  textColor?: string;
  textSize?: PineSize;
}
interface LineObj extends Obj {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  style: 'solid' | 'dashed';
}

/**
 * The drawing count limit of Pine: when a creation brings the count of one kind above max + 5, the oldest objects
 * are deleted until max remain.
 */
function register<T extends Obj>(list: T[], obj: T, max: number): T {
  list.push(obj);
  if (list.length > max + 5) {
    for (const old of list.splice(0, list.length - max)) old.dead = true;
  }
  return obj;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SmartMoneyBreakoutChannelsInputs> = {},
): Omit<IndicatorResult, 'markers'> & {
    markers: MarkerData[];
    plotCandles: Record<string, PlotCandleData[]>;
    lines: LineDrawingData[];
    boxes: BoxData[];
    labels: LabelData[];
    tables: TableData[];
  } {
  const cfg = { ...defaultInputs, ...inputs };
  const { overlap, strong, length, volMode } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  // [uv, dv, vold] = ta.requestUpAndDownVolume(tf): checkLTF() of the library first
  const chartTf = chartTimeframe(bars);
  if (chartTf !== '' && timeframe.in_seconds(cfg.tf) > timeframe.in_seconds(chartTf)) {
    throw new Error(`Invalid lower timeframe: '${cfg.tf}'. The timeframe must be lower than or equal to '${chartTf}'`);
  }
  // The timeframe is the chart timeframe: the chart bars are the requested bars and the values are the original
  // ones. Below it, the same computation on the chart bars is the estimate of the port (see the file header).
  const { up: uv, down: dv, delta: vold } = upDownVolumeOfChartBars(bars);

  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const volume = bars.map((b) => b.volume ?? NaN);

  const lowestLow = A(ta.lowest(S(low), cfg.normLength));
  const highestHigh = A(ta.highest(S(high), cfg.normLength));
  const normalizedPrice = bars.map((b, i) => (b.close - lowestLow[i]) / (highestHigh[i] - lowestLow[i]));
  const vol = ta.stdev(S(normalizedPrice), 14);
  const upper = A(ta.highestbars(vol, length + 1)).map((v) => (v + length) / length);
  const lower = A(ta.lowestbars(vol, length + 1)).map((v) => (v + length) / length);
  const lowerOverUpper = A(ta.crossover(S(lower), S(upper)) as unknown as Series).map((v) => Boolean(v));
  const upperOverLower = A(ta.crossover(S(upper), S(lower)) as unknown as Series).map((v) => Boolean(v));
  const since = A(ta.barssince(S(lowerOverUpper.map((x) => (x ? 1 : 0)))));
  // duration = math.max(nz(ta.barssince(...)), 1); h = ta.highest(duration), l = ta.lowest(duration): series length
  const duration = since.map((v) => Math.max(Number.isFinite(v) ? v : 0, 1));
  const highestSite = callsite.highest();
  const lowestSite = callsite.lowest();
  const smoothedVol = A(ta.sma(S(volume), 20));
  const atr = A(ta.atr(bars, length));

  const fg90 = String(color.new(CHART_FG, 90));
  const fg50 = String(color.new(CHART_FG, 50));
  const fg30 = String(color.new(CHART_FG, 30));
  const red70 = String(color.new(cfg.red, 70));
  const green70 = String(color.new(cfg.green, 70));
  const textSize = ({ Tiny: 'tiny', Small: 'small', Medium: 'normal', Large: 'large' } as const)[cfg.textSize];
  const kText = (v: number) => `${str.tostring(math.round(v / 1000, 1))}K`;

  // All objects in creation order (count limit), and the arrays of the running channels (newest first)
  const allBoxes: BoxObj[] = [];
  const allLines: LineObj[] = [];
  const boxes: BoxObj[] = [];
  const boxesU: BoxObj[] = [];
  const boxesL: BoxObj[] = [];
  const centerLines: LineObj[] = [];
  // A deleted box has na coordinates
  const topOf = (b: BoxObj) => (b.dead ? NaN : b.top);
  const bottomOf = (b: BoxObj) => (b.dead ? NaN : b.bottom);
  const newBox = (left: number, top: number, right: number, bottom: number, bg: string) =>
    register<BoxObj>(allBoxes, { dead: false, left, top, right, bottom, bg }, MAX_BOXES);

  const markers: MarkerData[] = [];
  const upCandles: PlotCandleData[] = [];
  const downCandles: PlotCandleData[] = [];
  const labels: LabelData[] = [];
  const tables: TableData[] = [];
  let hvold = NaN;
  let lvold = NaN;

  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    const h = highestSite(bar.high, duration[i]);
    const l = lowestSite(bar.low, duration[i]);
    let upbreak = 0;
    let downbreak = 0;

    // var hvold = vold, var lvold = vold
    if (i === 0) {
      hvold = vold[i];
      lvold = vold[i];
    }
    if (lowerOverUpper[i]) {
      hvold = vold[i];
      lvold = vold[i];
    }
    if (gt(vold[i], hvold)) hvold = vold[i];
    if (gt(lvold, vold[i])) lvold = vold[i];

    const vola = atr[i] / 2;

    // New channel
    if (upperOverLower[i] && duration[i] > 10) {
      const canCreate = overlap || !boxes.some((b) => gt(h, bottomOf(b)) && gt(topOf(b), l));
      if (canCreate) {
        const left = i - duration[i];
        boxes.unshift(newBox(left, h, i, l, fg90));
        boxesU.unshift(newBox(left, h, i, h - vola, red70));
        boxesL.unshift(newBox(left, l + vola, i, l, green70));
        const centerY = (h + l) / 2;
        centerLines.unshift(register<LineObj>(
          allLines, { dead: false, x1: left, y1: centerY, x2: i, y2: centerY, color: fg50, width: 1, style: 'dashed' }, MAX_LINES,
        ));
      }
    }

    // Breakouts and running channels. The end of the loop is read again on each step (Pine v6), so after a
    // removal the next channel of the array is skipped on this bar.
    const price = strong ? (bar.close + bar.open) / 2 : bar.close;
    for (let k = 0; k <= boxes.length - 1; k++) {
      const top = topOf(boxes[k]);
      const bottom = bottomOf(boxes[k]);
      const isUp = gt(price, top);
      if (isUp || gt(bottom, price)) {
        if (isUp) upbreak = bottom;
        else downbreak = top;
        boxes.splice(k, 1);
        boxesU.splice(k, 1);
        boxesL.splice(k, 1);
        centerLines.splice(k, 1);
      } else {
        for (const b of [boxes[k], boxesU[k], boxesL[k]]) if (!b.dead) b.right = i;
        if (!centerLines[k].dead) centerLines[k].x2 = i;
        const volText = volMode === 'Volume' ? kText(volume[i])
          : volMode === 'Comparison' ? `${kText(uv[i])}/${kText(dv[i])}`
          : kText(vold[i]);
        // The price above the mid line: text in the lower (green) box, else in the upper (red) box
        const above = gt(price, (top + bottom) / 2);
        const withText = above ? boxesL[k] : boxesU[k];
        const without = above ? boxesU[k] : boxesL[k];
        withText.text = volText;
        withText.textHAlign = 'right';
        withText.textColor = fg30;
        withText.textSize = textSize;
        without.text = '';
      }
    }

    // Volume candles on the newest running channel
    if (boxes.length > 0 && cfg.showVolume) {
      const topBound = topOf(boxes[0]);
      const bottomBound = bottomOf(boxes[0]);
      const mid = (topBound + bottomBound) / 2;
      const quarter = ((topBound - bottomBound) * cfg.volScale) / 4;
      let upHeight: number;
      let downHeight: number;
      let upColor = cfg.green;
      let downColor = cfg.red;
      if (volMode === 'Volume') {
        const ratio = volume[i] / smoothedVol[i];
        upHeight = ratio * quarter;
        downHeight = -upHeight;
        // getVolumeTransparency
        const transparency = math.max(20, math.min(80, 80 - (ratio - 0.5) * 40) as number) as number;
        upColor = String(color.new(CHART_FG, transparency));
        downColor = upColor;
      } else if (volMode === 'Comparison') {
        upHeight = Number.isNaN(uv[i]) ? 0 : (uv[i] / smoothedVol[i]) * quarter;
        downHeight = Number.isNaN(dv[i]) ? 0 : (dv[i] / smoothedVol[i]) * quarter;
      } else {
        const deltaHeight = Number.isNaN(vold[i]) ? 0 : Math.abs(vold[i] / smoothedVol[i]) * quarter;
        const positive = ge(vold[i], 0);
        upHeight = positive ? deltaHeight : 0;
        downHeight = positive ? 0 : -deltaHeight;
      }
      // A candle with an na (or infinite) value is not drawn
      if (Number.isFinite(mid) && Number.isFinite(upHeight)) {
        upCandles.push({
          time: bar.time, open: mid, high: mid + upHeight, low: mid, close: mid + upHeight,
          color: upColor, wickColor: upColor, borderColor: upColor,
        });
      }
      if (Number.isFinite(mid) && Number.isFinite(downHeight)) {
        downCandles.push({
          time: bar.time, open: mid, high: mid, low: mid + downHeight, close: mid + downHeight,
          color: downColor, wickColor: downColor, borderColor: downColor,
        });
      }
    }

    // plotshape(upbreak != 0 ? upbreak : na, ...), plotshape(downbreak != 0 ? downbreak : na, ...)
    if (!Number.isNaN(upbreak) && !eq(upbreak, 0)) {
      markers.push({
        time: bar.time, position: 'atPriceBottom', price: upbreak, shape: 'labelUp', color: cfg.green, text: '▲', textColor: CHART_FG,
      });
    }
    if (!Number.isNaN(downbreak) && !eq(downbreak, 0)) {
      markers.push({
        time: bar.time, position: 'atPriceTop', price: downbreak, shape: 'labelDown', color: cfg.red, text: '▼', textColor: CHART_FG,
      });
    }

    // Gauge on the last bar
    if (i === n - 1 && boxes.length > 0 && eq(upbreak, 0) && eq(downbreak, 0)) {
      const topBound = topOf(boxes[0]);
      const bottomBound = bottomOf(boxes[0]);
      if (!Number.isNaN(topBound) && !Number.isNaN(bottomBound) && !eq(topBound, bottomBound)) {
        const segments = 21;
        const segLen = (topBound - bottomBound) / segments;
        for (let k = 0; k <= segments - 1; k++) {
          const y1 = topBound - k * segLen;
          const y2 = topBound - (k + 1) * segLen;
          const segCol = String(color.from_gradient(y1, bottomBound, topBound, cfg.red, cfg.green));
          register<LineObj>(allLines, { dead: false, x1: i + 2, y1, x2: i + 2, y2, color: segCol, width: 4, style: 'solid' }, MAX_LINES);
        }
        let delvol = -100 * 2 * ((vold[i] - lvold) / (hvold - lvold) - 0.5);
        delvol = math.max(math.min(delvol, 100) as number, -100) as number;
        const pointerPos = topBound - ((delvol + 100) / 200) * (topBound - bottomBound);
        if (Number.isFinite(pointerPos)) {
          labels.push({
            time: barTime(bars, i + 3), price: pointerPos, text: '◀', color: 'transparent', textColor: CHART_FG,
            size: 'small', style: 'label_left',
          });
        }
      }
    }

    // if not volumeAvailable: the warning table (made once, kept)
    if (Number.isNaN(volume[i]) && tables.length === 0) {
      tables.push({
        position: 'top_right', columns: 1, rows: 1, bgColor: cfg.red, borderWidth: 1, borderColor: CHART_FG,
        frameColor: CHART_FG, frameWidth: 1,
        cells: [{
          column: 0, row: 0, text: 'Volume not available\nGauge may not work as expected', textColor: CHART_FG,
          textHAlign: 'center', textSize: 'small',
        }],
      });
    }
  }

  const time = (index: number) => barTime(bars, index);
  const boxOut: BoxData[] = allBoxes.map((b) => ({
    time1: time(b.left), price1: b.top, time2: time(b.right), price2: b.bottom, bgColor: b.bg, borderColor: 'transparent',
    ...(b.text !== undefined ? { text: b.text } : {}),
    ...(b.textHAlign ? { textHAlign: b.textHAlign, textColor: b.textColor, textSize: b.textSize } : {}),
  }));
  const lineOut: LineDrawingData[] = allLines.map((ln) => ({
    time1: time(ln.x1), price1: ln.y1, time2: time(ln.x2), price2: ln.y2, color: ln.color, width: ln.width, style: ln.style,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    plotCandles: { volumeUp: upCandles, volumeDown: downCandles },
    lines: lineOut,
    boxes: boxOut,
    labels,
    tables,
  };
}

export const SmartMoneyBreakoutChannels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
