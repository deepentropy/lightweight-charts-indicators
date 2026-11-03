/**
 * Volume Profile Plus
 *
 * A volume profile (or a market profile / TPO, where each candle counts 100) drawn on the right of the last bar. The
 * price range of the stored candles is cut into "Number of Rows" equal buckets; each candle spreads its volume evenly
 * over the buckets between its low and its high. The histogram rows are drawn as one polyline ("Max Width" bars for
 * the largest bucket, "Horizontal Offset" bars after the last bar); with "Show Volume Delta" the buy and sell volume
 * (candles that close above / below their open) are drawn as two more polylines. The point of control (largest
 * bucket) and the value area high / low (buckets where the cumulative volume reaches (100 - Value Area Percent) / 2 %
 * and 100 % minus that) are highlighted with a row, a dotted line extended to the left and a label with the price
 * rounded to the symbol tick (black or white text, whichever contrasts with the colour, Contrast Color Library). A
 * last vertical polyline in the chart background colour hides the right edge of the histogram.
 *
 * Candles: from the first bar where the range starts ("Visible Range": the first visible bar of the chart; "Anchored
 * Range": "Anchor Time"; "All Range": the first bar) and within the last "Max Lower Timeframe Bars" bars. On that bar
 * the script chooses the finest of the lower timeframes chart / 16, / 8, / 4, / 2 (at least 1 minute, or 1 second
 * with "Use Second-Based Timeframes") whose own bars meet the same two conditions, else the chart timeframe, and
 * from then on it stores the bars of that timeframe inside each chart bar (PineScript `request.security` and
 * `request.security_lower_tf` of the chart symbol). The lower timeframe bars come from the chart context
 * (`requiredSymbols`, `bars` accessor: the chart symbol on each lower timeframe that differs from the chart
 * timeframe); without them the port throws a MissingSymbolDataError that lists them. The visible range comes from the
 * chart context (`leftVisibleBarTime`; fallback: the first bar); the indicator must be calculated again when the
 * chart is scrolled (`usesVisibleRange`). `chart.bg_color` comes from the context (fallback #0F0F0F).
 *
 * Imported library, written in this file: contrast (Contrast Color Library, `contrast(bg, threshold)`).
 *
 * Reference: "Volume Profile Plus" by AlphaViz
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © algotraderdev
 */

import {
  array, color, math, str, timeframe, line, label, polyline, chartPoint, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Polyline,
} from 'oakscriptjs';
import { chartTimeframe } from '../anchor-period';
import {
  mintickOf, backgroundColorOf, tickeridOf, visibleRangeOf, symbolBarsOf, type ChartContext, type SymbolRequest,
} from '../chart-context';
import { securityOther, securityLowerTf, otherSymbolChart } from '../other-symbol';
import type { StudyDrawingKind } from '../style-outputs';

const VOLUME_PROFILE = 'Volume Profile';
const MARKET_PROFILE = 'Market Profile / TPO';
const VISIBLE_RANGE = 'Visible Range';
const ANCHORED_RANGE = 'Anchored Range';
const ALL_RANGE = 'All Range';

export interface VolumeProfilePlusInputs {
  MODE: string;
  RANGE_MODE: string;
  /** Anchor Time (ms) */
  ANCHORED_TIME: number;
  NUM_ROWS: number;
  MAX_LTF_BARS: number;
  USE_SECOND_BASED_TIMEFRAMES: boolean;
  HORIZONTAL_OFFSET: number;
  MAX_WIDTH: number;
  HEIGHT_PERCENTAGE_PER_ROW: number;
  SHOW_DELTA: boolean;
  COLOR: string;
  BUY_COLOR: string;
  SELL_COLOR: string;
  POC_COLOR: string;
  VAH_COLOR: string;
  VAL_COLOR: string;
  VALUE_AREA_PERCENT: number;
  DISPLAY_VA: boolean;
  DISPLAY_POC: boolean;
  EXTEND_LEFT: boolean;
}

export const defaultInputs: VolumeProfilePlusInputs = {
  MODE: VOLUME_PROFILE,
  RANGE_MODE: VISIBLE_RANGE,
  // timestamp('2023-01-01T12:00:00'): a date without a time zone is UTC
  ANCHORED_TIME: 1672574400000,
  NUM_ROWS: 300,
  MAX_LTF_BARS: 5000,
  USE_SECOND_BASED_TIMEFRAMES: false,
  HORIZONTAL_OFFSET: 20,
  MAX_WIDTH: 80,
  HEIGHT_PERCENTAGE_PER_ROW: 40,
  SHOW_DELTA: false,
  // input colours keep an alpha of 2 decimals: #5d606b77 is stored as 0.47 (byte 0x78)
  COLOR: '#5d606b78',
  BUY_COLOR: '#00bcd480',
  SELL_COLOR: '#e91e6380',
  POC_COLOR: '#FFEB3B',
  VAH_COLOR: '#2962FF',
  VAL_COLOR: '#2962FF',
  VALUE_AREA_PERCENT: 70,
  DISPLAY_VA: true,
  DISPLAY_POC: true,
  EXTEND_LEFT: true,
};

const RANGE_GROUP = 'TIME RANGE';
const GRANULARITY_GROUP = 'GRANULARITY';
const APPEARANCE_GROUP = 'APPEARANCE';
const COLOR_GROUP = 'COLOR';
const KEY_PRICES_GROUP = 'POC & Value Area';

export const inputConfig: InputConfig[] = [
  { id: 'MODE', type: 'string', title: 'Mode', defval: VOLUME_PROFILE, options: [VOLUME_PROFILE, MARKET_PROFILE],
    tooltip: 'This setting determines the mode in which the indicator operates.\n\nVolume Profile (Default Mode): In this mode, the volume of each bar is taken into consideration to construct the profile.\n\nMarket Profile (a.k.a. Time Price Opportunity): In this mode, volume data is disregarded. This indicator analyzes the price distribution solely over time.\n\nNOTE: in case the ticker does not have any volume data, this indicator uses the `Market Profile` mode.' },
  { id: 'RANGE_MODE', type: 'string', title: 'Range Mode', defval: VISIBLE_RANGE, options: [VISIBLE_RANGE, ANCHORED_RANGE, ALL_RANGE],
    group: RANGE_GROUP,
    tooltip: 'This setting determines the start time of the volume profile calculation.\n\nVisible Range (Default Mode): In this mode, the volume profile calculation begins at the time of the left-most bar displayed in the current viewport. As the user scrolls through the viewport, the volume profile updates automatically.\n\nAnchored Range: This mode allows the user to set the start time either by using the "Anchor Time" input box below or by dragging the anchor line on the chart.\n\nAll Range: In this mode, the volume profile calculation is based on all the historical bars available in the chart.' },
  { id: 'ANCHORED_TIME', type: 'time', title: 'Anchor Time', defval: 1672574400000, group: RANGE_GROUP,
    tooltip: 'The start time of the volume profile calculation. This setting is only used when the "Range Mode" above is set to "Anchored Range".' },
  { id: 'NUM_ROWS', type: 'int', title: 'Number of Rows', defval: 300, min: 100, max: 2500, step: 100, group: GRANULARITY_GROUP,
    tooltip: 'The number of rows to display in the volume profile histogram (Max 2500)' },
  { id: 'MAX_LTF_BARS', type: 'int', title: 'Max Lower Timeframe Bars', defval: 5000, min: 1000, step: 1000, group: GRANULARITY_GROUP,
    tooltip: 'The max number of lower timeframe bars to use for the volume profile calculation.\n\nNOTE: The higher the number, the more time and memory the calculation needs. If you encounter a time limit or memory limit error, please try lowering the number here.' },
  { id: 'USE_SECOND_BASED_TIMEFRAMES', type: 'bool', title: 'Use Second-Based Timeframes', defval: false, group: GRANULARITY_GROUP,
    tooltip: 'Whether to use second-based timeframes (e.g. 1 second, 5 seconds) when the chart\'s current timeframe is low (e.g. 5 minutes).' },
  { id: 'HORIZONTAL_OFFSET', type: 'int', title: 'Horizontal Offset', defval: 20, step: 5, group: APPEARANCE_GROUP,
    tooltip: 'The distance, measured in the number of bars, between the last bar in the chart and the left of the volume profile histogram.' },
  { id: 'MAX_WIDTH', type: 'int', title: 'Max Width', defval: 80, min: 10, max: 500, step: 10, group: APPEARANCE_GROUP,
    tooltip: 'The maximum width, measured in number of bars, for the volume profile histogram.' },
  { id: 'HEIGHT_PERCENTAGE_PER_ROW', type: 'int', title: 'Height % per Row', defval: 40, min: 1, max: 100, group: APPEARANCE_GROUP,
    tooltip: 'The height of each volume profile histogram row, measured as the percentage of the price range of each price bucket.' },
  { id: 'SHOW_DELTA', type: 'bool', title: 'Show Volume Delta', defval: false, group: APPEARANCE_GROUP,
    tooltip: 'Whether to show Volume Delta (the net difference between buying and selling volume).' },
  { id: 'COLOR', type: 'color', title: 'Default', defval: '#5d606b78', group: COLOR_GROUP },
  { id: 'BUY_COLOR', type: 'color', title: 'Buy Volume', defval: '#00bcd480', group: COLOR_GROUP },
  { id: 'SELL_COLOR', type: 'color', title: 'Sell Volume', defval: '#e91e6380', group: COLOR_GROUP },
  { id: 'POC_COLOR', type: 'color', title: 'POC (Point of Control)', defval: '#FFEB3B', group: COLOR_GROUP },
  { id: 'VAH_COLOR', type: 'color', title: 'VAH (Value Area High)', defval: '#2962FF', group: COLOR_GROUP },
  { id: 'VAL_COLOR', type: 'color', title: 'VAL (Value Area Low)', defval: '#2962FF', group: COLOR_GROUP },
  { id: 'VALUE_AREA_PERCENT', type: 'int', title: 'Value Area Percent', defval: 70, min: 1, max: 100, group: KEY_PRICES_GROUP,
    tooltip: 'The percentage of the total trading volume that\'s considered as the value area.' },
  { id: 'DISPLAY_VA', type: 'bool', title: 'Display VAH/VAL', defval: true, group: KEY_PRICES_GROUP },
  { id: 'DISPLAY_POC', type: 'bool', title: 'Display POC', defval: true, group: KEY_PRICES_GROUP },
  { id: 'EXTEND_LEFT', type: 'bool', title: 'Extend Key Price Lines to the Left', defval: true, group: KEY_PRICES_GROUP,
    tooltip: 'Whether to extend the key price lines (POC, VAH, VAL) to the left of the chart.' },
];

export const plotConfig: PlotConfig[] = [];

/** Drawing kinds of the original */
export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'polyline'];

/** The profile starts at the first visible bar by default: calculate again when the chart is scrolled */
export const usesVisibleRange = true;

export const metadata = {
  title: 'Volume Profile Plus',
  shortTitle: 'VP+',
  overlay: true,
};

/** Lower timeframes of the script: ltf(m) for m = 2, 4, 8, 16 (timeframe.from_seconds of chart seconds / m) */
const MULTIPLIERS = [2, 4, 8, 16];

function lowerTimeframes(chartTf: string, useSeconds: boolean): string[] {
  const seconds = timeframe.in_seconds(chartTf);
  const min = useSeconds ? 1 : 60;
  return MULTIPLIERS.map((m) => timeframe.from_seconds(Math.max(min, Math.round(seconds / m))));
}

/** The lower timeframes that differ from the chart timeframe (those need bars of their own) */
function requestedTimeframes(chartTf: string, useSeconds: boolean): string[] {
  const chartSeconds = timeframe.in_seconds(chartTf);
  const out: string[] = [];
  for (const tf of lowerTimeframes(chartTf, useSeconds)) {
    if (timeframe.in_seconds(tf) !== chartSeconds && !out.includes(tf)) out.push(tf);
  }
  return out;
}

/** Bars the indicator needs: the chart symbol on each lower timeframe of the script (none without a timeframe). */
export function requiredSymbols(inputs: Partial<VolumeProfilePlusInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const tf = chartTimeframe([], chart);
  if (tf === '') return [];
  const symbol = tickeridOf(chart);
  return requestedTimeframes(tf, cfg.USE_SECOND_BASED_TIMEFRAMES).map((t) => ({ symbol, timeframe: t }));
}

/** contrast(bg, threshold): black text on a bright background, else white (Contrast Color Library) */
function contrast(bg: string, threshold: number): string {
  const r = (color.r(bg) as number) / 255;
  const g = (color.g(bg) as number) / 255;
  const b = (color.b(bg) as number) / 255;
  const brightness = Math.sqrt(0.299 * r * r + 0.587 * g * g + 0.114 * b * b);
  return brightness > threshold ? '#000000' : '#ffffff';
}

/** A stored candle: high, low, volume and direction (1 buy, -1 sell, 0 none) */
interface Candle { high: number; low: number; volume: number; direction: number }

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeProfilePlusInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const result: IndicatorResult = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
  };
  resetDrawings();
  if (n === 0) return { ...result, ...drawingOutputs(bars) };
  const ms = chart?.timeUnit === 'ms' || (chart?.timeUnit === undefined && bars[0].time >= 1e12);
  const msOf = (t: number) => (ms ? t : t * 1000);
  const NUM_ROWS = cfg.NUM_ROWS;
  const BASE_OFFSET = cfg.HORIZONTAL_OFFSET + cfg.MAX_WIDTH;
  const LABEL_OFFSET = BASE_OFFSET + 2;
  const START_TIME = cfg.RANGE_MODE === VISIBLE_RANGE ? visibleRangeOf(bars, chart).leftTime
    : cfg.RANGE_MODE === ANCHORED_RANGE ? cfg.ANCHORED_TIME : 0;

  // ---- lower timeframes and their bars (request.security / request.security_lower_tf of the chart symbol)
  const chartTf = chartTimeframe(bars, chart) || '1D';
  const ltfs = lowerTimeframes(chartTf, cfg.USE_SECOND_BASED_TIMEFRAMES);
  const requested = requestedTimeframes(chartTf, cfg.USE_SECOND_BASED_TIMEFRAMES);
  const symbol = tickeridOf(chart);
  const otherBars = symbolBarsOf(requested.map((t) => ({ symbol, timeframe: t })), chart);
  const merge = otherSymbolChart(bars, chart);
  const calendar = { other: { timezone: chart?.timezone, session: chart?.session } };
  const toCandle = (b: Bar): Candle => ({
    high: b.high,
    low: b.low,
    volume: cfg.MODE === VOLUME_PROFILE ? (b.volume == null || Number.isNaN(b.volume) ? 100 : b.volume) : 100,
    direction: b.close - b.open > 1e-10 ? 1 : b.open - b.close > 1e-10 ? -1 : 0,
  });
  // canProcess = time >= START_TIME and (last_bar_index - bar_index) < MAX_LTF_BARS, on the bars of a timeframe
  const canProcessOf = (series: ReadonlyArray<Bar>) => series.map((b, k) => msOf(b.time) >= START_TIME
    && series.length - 1 - k < cfg.MAX_LTF_BARS);
  const chartCan = canProcessOf(bars);
  /** cp and the candles of one lower timeframe on each chart bar */
  const sources = ltfs.map((tf) => {
    const j = requested.indexOf(tf);
    if (j < 0) {
      // the chart timeframe itself
      return { cp: chartCan, candles: (i: number) => [toCandle(bars[i])] };
    }
    const ltfBars = otherBars[j];
    const can = canProcessOf(ltfBars);
    const shown = securityOther(bars, ltfBars, tf, merge, calendar);
    const ranges = securityLowerTf(bars, ltfBars, tf, merge, calendar);
    return {
      cp: shown.map((k) => k >= 0 && can[k]),
      candles: (i: number) => ltfBars.slice(ranges[i][0], ranges[i][1]).map(toCandle),
    };
  });
  const ltfOf = [chartTf, ...ltfs];
  const cpOf = [chartCan, ...sources.map((s) => s.cp)];
  const candlesOf = [(i: number) => [toCandle(bars[i])], ...sources.map((s) => s.candles)];

  // ---- var ltf: chosen on the first bar where one of cp16, cp8, cp4, cp2, cp1 is true; `switch ltf` takes the
  // first of ltf1, ltf2, ltf4, ltf8, ltf16 with that name
  const candles: Candle[] = [];
  let minPrice = NaN;
  let maxPrice = NaN;
  let chosen: number | null = null;
  for (let i = 0; i < n; i++) {
    if (chosen === null) {
      const k = [4, 3, 2, 1, 0].find((q) => cpOf[q][i]);
      if (k !== undefined) {
        const name = ltfOf[k];
        chosen = ltfOf.findIndex((t) => t === name);
      }
    }
    if (chosen !== null) {
      for (const c of candlesOf[chosen](i)) {
        candles.push(c);
        minPrice = Number.isNaN(minPrice) ? c.low : Math.min(minPrice, c.low);
        maxPrice = Number.isNaN(maxPrice) ? c.high : Math.max(maxPrice, c.high);
      }
    }
  }

  // ---- vp.update() on the last bar
  const last = n - 1;
  setDrawingBar(last, true);
  if (candles.length > 0) {
    const step = (maxPrice - minPrice) / NUM_ROWS;
    const bucketOf = (price: number) => Math.min(Math.floor((price - minPrice) / step), NUM_ROWS - 1);
    const bucketedPrice = (index: number) => (index + 0.5) * step + minPrice;
    const dist = new Array<number>(NUM_ROWS).fill(0);
    const deltaDist = new Array<number>(NUM_ROWS).fill(0);
    for (const c of candles) {
      const start = bucketOf(c.low);
      const end = bucketOf(c.high);
      const vol = c.volume / (end - start + 1);
      for (let i = start; i <= end; i++) {
        dist[i] += vol;
        deltaDist[i] += vol * c.direction;
      }
    }
    const maxVol = array.max(dist) as number;
    const baseX = last + BASE_OFFSET;
    const xs = dist.map((vol) => baseX - Math.round((vol / maxVol) * cfg.MAX_WIDTH));
    const height = (cfg.HEIGHT_PERCENTAGE_PER_ROW / 100) * step;

    const drawHistogram = (rows: number[], css: string): Polyline => {
      const gap = (step - height) / 2;
      const points = rows.flatMap((x, i) => {
        const lo = i * step + gap + minPrice;
        const hi = lo + height;
        return [chartPoint.from_index(baseX, lo), chartPoint.from_index(x, lo), chartPoint.from_index(x, hi),
          chartPoint.from_index(baseX, hi)];
      });
      return polyline.new(points, false, true, 'bar_index', css, css);
    };
    drawHistogram(xs, cfg.COLOR);
    if (cfg.SHOW_DELTA) {
      const width = (vol: number) => baseX - Math.round((Math.abs(vol) / maxVol) * cfg.MAX_WIDTH);
      drawHistogram(deltaDist.map((vol) => (vol > 1e-10 ? width(vol) : baseX)), cfg.BUY_COLOR);
      drawHistogram(deltaDist.map((vol) => (vol < -1e-10 ? width(vol) : baseX)), cfg.SELL_COLOR);
    }

    const cumdist = dist.slice();
    for (let i = 1; i < cumdist.length; i++) cumdist[i] = cumdist[i - 1] + cumdist[i];
    const totalVolume = cumdist[cumdist.length - 1];
    const tick = mintickOf(chart);
    /** VP.mark() -> Marker.set(): highlight row, dotted line extended to the left, label */
    const mark = (name: string, index: number, bg: string) => {
      const price = bucketedPrice(index);
      const left = xs[index];
      const right = last + BASE_OFFSET;
      const bottom = price - height / 2;
      const top = bottom + height;
      polyline.new([chartPoint.from_index(left, bottom), chartPoint.from_index(left, top),
        chartPoint.from_index(right, top), chartPoint.from_index(right, bottom)], false, false, 'bar_index', bg, bg);
      if (cfg.EXTEND_LEFT) line.new(left, price, right, price, 'bar_index', 'left', bg, 'dotted', 1);
      label.new(last + LABEL_OFFSET, price, str.format('{0}: {1}', name, math.round_to_mintick(price, tick)), 'bar_index', 'price', bg,
        'label_left', contrast(bg, 0.6), 'small');
    };
    if (cfg.DISPLAY_VA) {
      const valPercentile = (100 - cfg.VALUE_AREA_PERCENT) / 100 / 2;
      const vahPercentile = 1 - valPercentile;
      mark('VAL', array.binary_search_leftmost(cumdist, totalVolume * valPercentile), cfg.VAL_COLOR);
      mark('VAH', array.binary_search_leftmost(cumdist, totalVolume * vahPercentile), cfg.VAH_COLOR);
    }
    if (cfg.DISPLAY_POC) {
      // maxIndex(dist): the first largest bucket
      let pocIndex = 0;
      for (let i = 0; i < dist.length; i++) if (dist[i] - dist[pocIndex] > 1e-10) pocIndex = i;
      mark('POC', pocIndex, cfg.POC_COLOR);
    }
    // mask of the right edge of the histogram, in the chart background colour
    polyline.new([chartPoint.from_index(baseX, maxPrice), chartPoint.from_index(baseX, minPrice)], false, false,
      'bar_index', backgroundColorOf(chart));
  }
  setDrawingBar(null);
  return { ...result, ...drawingOutputs(bars) };
}

export const VolumeProfilePlus = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, requiredSymbols, usesVisibleRange,
};
