/**
 * Smart Trader, Episode 03 (Candles and Tradelines)
 *
 * Splits the most recent `Window Bars` bars (from the closed bar, or from the current bar with the basis
 * "Current (bar[0])") into `Group Count` blocks of round(window / groups) bars and draws, on the last bar only:
 * - a number label above the oldest bar of each block and a box around each block (high / low of the block);
 * - optional composite ("ghost") candles: open of the oldest bar, close of the newest bar, block high / low, coloured
 *   by the block delta, with the chart candles dimmed by a bar colour (off by default);
 * - trend channels: blocks are compared by the middle of their high / low (higher, lower or equal); runs of blocks in
 *   one direction form a segment, drawn as an upper and a lower line through the extreme block highs / lows at the
 *   block centres. The angle of a segment is normalised by the Yang-Zhang volatility of the last 20 bars; at or below
 *   `Range Angle Threshold` it is a range. The latest segment is projected one block to the right and labelled;
 * - core levels: for each block, the high of the bar with the most / least buy volume and the low of the bar with the
 *   most / least sell volume, and the volume profile POC (25 bins, the volume of each bar spread over its range). The
 *   nearest level and POC above and below the reference close are drawn as lines with labels; a level inside the
 *   range of the reference bar is skipped for the next one;
 * - a dashboard table: volume of the reference bar, volume of the latest trend, pins and bodies, channel boundaries,
 *   a quality score and a generated market narrative (English, Turkish, Hindi or Arabic) with a disclaimer.
 * Buy / sell volume ("Geometry"): volume x (close - low) / range and volume x (high - close) / range.
 *
 * Limit, lower-timeframe volume (option "Intrabar (Precise)", off by default): the original reads the up and down
 * volume of each bar from the bars of the lower timeframe with `requestUpAndDownVolume()` of the ta library of the
 * platform. The bars passed to a port are the chart bars only, so the port ESTIMATES them from the chart bars
 * (src/lower-tf-volume.ts): all the volume of a bar is up or down volume (up when close > open, down when
 * close < open, else by the close against the previous close). The original also has these values only where data of
 * the lower timeframe exists; the port has them on every bar.
 *
 * Chart context: `syminfo.mintick` (price texts, consumed-level tolerance, POC bins).
 *
 * Reference: "Smart Trader, Episode 03, by Ata Sabancı | Candles and Tradelines" by ata_sabanci
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, math, color, line, label, box, table, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line, type Label, type Box, type Table,
  type BarColorConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { BarColorData } from '../types';
import { mintickOf, type ChartContext } from '../chart-context';
import { lowerTimeframe, upDownVolumeOfChartBars } from '../lower-tf-volume';

type Lang = 'English' | 'Türkçe' | 'हिन्दी' | 'العربية';

export interface SmartTraderEpisode03ByAtaSabanciInputs {
  window: number;
  groups: number;
  calcBasis: 'Closed (bar[1])' | 'Current (bar[0])';
  showGroupNums: boolean;
  showGroupBoxes: boolean;
  boxColor: string;
  boxTransp: number;
  textSize: number;
  showCompositeCandle: boolean;
  compositeCandleTransp: number;
  dimOriginalCandles: boolean;
  originalCandleDimLevel: number;
  narrativeEnable: boolean;
  narrativeLang: Lang;
  narrativeShowDisclaimer: boolean;
  calcMethod: 'Geometry (Approx)' | 'Intrabar (Precise)';
  useCustomLTF: boolean;
  customLTF: string;
  /** Kept as in the original (its value is not used by the outputs there either) */
  globalPeriodBoxes: number;
  showDash: boolean;
  dashPos: 'Top Right' | 'Bottom Right' | 'Bottom Left';
  trendEnable: boolean;
  rangeAngleThreshold: number;
  trendMinBlocks: number;
  showRangeSegments: boolean;
  trendUpColor: string;
  trendDnColor: string;
  trendRangeColor: string;
  trendLineWidth: number;
  trendLineStyle: 'solid' | 'dashed' | 'dotted';
  trendProject: boolean;
  coreEnable: boolean;
  coreDrawLines: boolean;
  coreProjectFwd: boolean;
  coreNearestOnly: boolean;
  coreShowMax: boolean;
  coreShowMin: boolean;
  pocEnable: boolean;
  pocShowNearest: boolean;
  pocBinProfile: boolean;
  pocBinCount: number;
  coreLineWidth: number;
}

export const defaultInputs: SmartTraderEpisode03ByAtaSabanciInputs = {
  window: 100,
  groups: 20,
  calcBasis: 'Closed (bar[1])',
  showGroupNums: true,
  showGroupBoxes: true,
  boxColor: '#787B86',
  boxTransp: 85,
  textSize: 12,
  showCompositeCandle: false,
  compositeCandleTransp: 50,
  dimOriginalCandles: true,
  originalCandleDimLevel: 95,
  narrativeEnable: true,
  narrativeLang: 'English',
  narrativeShowDisclaimer: true,
  calcMethod: 'Geometry (Approx)',
  useCustomLTF: true,
  customLTF: '15S',
  globalPeriodBoxes: 5,
  showDash: true,
  dashPos: 'Top Right',
  trendEnable: true,
  rangeAngleThreshold: 10.0,
  trendMinBlocks: 2,
  showRangeSegments: true,
  trendUpColor: '#22C55E',
  trendDnColor: '#EF4444',
  trendRangeColor: '#94A3B8',
  trendLineWidth: 2,
  trendLineStyle: 'solid',
  trendProject: true,
  coreEnable: true,
  coreDrawLines: true,
  coreProjectFwd: true,
  coreNearestOnly: true,
  coreShowMax: true,
  coreShowMin: true,
  pocEnable: true,
  pocShowNearest: true,
  pocBinProfile: true,
  pocBinCount: 25,
  coreLineWidth: 1,
};

const G_MAIN = '═══ Main Settings ═══';
const G_ANALYTICS = '═══ Block Analytics ═══';
const G_NARRATIVE = '═══ Market Narrative ═══';
const G_VOL = '═══ Volume Engine ═══';
const G_DASH = '═══ Smart Dashboard ═══';
const G_TREND = '═══ Multi-Segment Trend ═══';
const G_CORE = '═══ Core Calculation ═══';

export const inputConfig: InputConfig[] = [
  { id: 'window', type: 'int', title: 'Window Bars', defval: 100, min: 1, group: G_MAIN,
    tooltip: 'Total number of recent bars to analyze. This window is divided into equal groups for block-based analysis. Larger values cover more history but increase computation.' },
  { id: 'groups', type: 'int', title: 'Group Count', defval: 20, min: 1, group: G_MAIN,
    tooltip: 'Number of equal-sized blocks the window is divided into. Each block aggregates OHLC, volume, and analytics data. More groups = finer resolution but smaller blocks.' },
  { id: 'calcBasis', type: 'string', title: 'Calculation Basis', defval: 'Closed (bar[1])',
    options: ['Closed (bar[1])', 'Current (bar[0])'], group: G_MAIN,
    tooltip: 'Closed (bar[1]): Uses the last fully confirmed bar as reference — stable, no repainting. Current (bar[0]): Uses the live forming bar — updates in real-time but may repaint until the bar closes.' },
  { id: 'showGroupNums', type: 'bool', title: 'Show Group Numbers', defval: true, group: G_MAIN,
    tooltip: 'Displays a numeric label (1, 2, 3, …) above the last bar of each block, serving as a visual ruler for block boundaries on the chart.' },
  { id: 'showGroupBoxes', type: 'bool', title: 'Show Group Boxes', defval: true, group: G_MAIN,
    tooltip: 'Draws a semi-transparent rectangular box around each block, visually separating groups on the chart. Also required for composite candle rendering and block analytics.' },
  { id: 'boxColor', type: 'color', title: 'Box Color', defval: '#787B86', group: G_MAIN,
    tooltip: 'Base color for the group box rectangles. Combined with the Box Transparency setting to determine final appearance on the chart.' },
  { id: 'boxTransp', type: 'int', title: 'Box Transparency', defval: 85, min: 0, max: 100, group: G_MAIN,
    tooltip: 'Transparency level for group boxes. 0 = fully opaque, 100 = fully invisible. Higher values let the underlying chart show through more clearly.' },
  { id: 'textSize', type: 'int', title: 'Global Text Size (pt)', defval: 12, min: 6, max: 50, group: G_MAIN,
    tooltip: 'Font size in typographic points (Pine Script v6). Applies to ALL text elements on chart: labels, dashboard, trend lines, etc. Default: 12pt.' },
  { id: 'showCompositeCandle', type: 'bool', title: 'Show Composite Candle', defval: false, group: G_ANALYTICS,
    tooltip: 'Displays a ghost-like composite candle at the center of each block representing aggregated OHLC.' },
  { id: 'compositeCandleTransp', type: 'int', title: 'Composite Candle Transparency', defval: 50, min: 50, max: 95,
    group: G_ANALYTICS, tooltip: 'Transparency level for the ghost-like composite candle (higher = more transparent).' },
  { id: 'dimOriginalCandles', type: 'bool', title: 'Dim Original Candles', defval: true, group: G_ANALYTICS,
    tooltip: 'When composite candles are shown, dims the original chart candles to make composites stand out.' },
  { id: 'originalCandleDimLevel', type: 'int', title: 'Original Candle Dim Level', defval: 95, min: 50, max: 95,
    group: G_ANALYTICS, tooltip: 'Transparency level for dimmed original candles (higher = more transparent/faded).' },
  { id: 'narrativeEnable', type: 'bool', title: 'Enable Market Narrative', defval: true, group: G_NARRATIVE,
    tooltip: 'Displays -generated market analysis based on calculated data. Educational purposes only.' },
  { id: 'narrativeLang', type: 'string', title: 'Narrative Language', defval: 'English',
    options: ['English', 'Türkçe', 'हिन्दी', 'العربية'], group: G_NARRATIVE,
    tooltip: 'Select language for market narrative output.' },
  { id: 'narrativeShowDisclaimer', type: 'bool', title: 'Show Educational Disclaimer', defval: true, group: G_NARRATIVE,
    tooltip: 'Display legal disclaimer: Not investment advice, educational purposes only.' },
  { id: 'calcMethod', type: 'string', title: 'Calculation Method', defval: 'Geometry (Approx)',
    options: ['Geometry (Approx)', 'Intrabar (Precise)'], group: G_VOL,
    tooltip: 'Geometry: Approximates buy/sell volume using candle body position relative to range — works on all plans, no LTF data needed. Intrabar: Requests precise lower-timeframe tick data for accurate buy/sell split — more accurate but requires sufficient LTF history.' },
  { id: 'useCustomLTF', type: 'bool', title: 'Use custom lower timeframe', defval: true, group: G_VOL,
    tooltip: 'When enabled, uses your specified LTF for intrabar volume calculations. When disabled, the script automatically selects an appropriate LTF based on the chart\'s current timeframe.' },
  { id: 'customLTF', type: 'timeframe', title: 'Lower timeframe (LTF)', defval: '15S', group: G_VOL,
    tooltip: 'The lower timeframe used for intrabar volume decomposition. Must be strictly lower than the chart timeframe. Smaller LTF = more precise volume split but heavier data load. Example: 15S for a 1-minute chart, 1 for a 5-minute chart.' },
  { id: 'globalPeriodBoxes', type: 'int', title: 'Global Period (Boxes)', defval: 5, min: 1, max: 200, group: G_VOL,
    tooltip: 'Number of most recent blocks used for dashboard volume aggregation. Controls how many blocks contribute to the displayed trend volumetrics and pressure analysis.' },
  { id: 'showDash', type: 'bool', title: 'Show Dashboard', defval: true, group: G_DASH,
    tooltip: 'Displays the Smart Dashboard table on the chart, showing volume engine data, trend volumetrics, pressure & momentum, channel boundaries, trend intelligence, and market narrative.' },
  { id: 'dashPos', type: 'string', title: 'Position', defval: 'Top Right',
    options: ['Top Right', 'Bottom Right', 'Bottom Left'], group: G_DASH,
    tooltip: 'Select the dashboard display position on the chart.' },
  { id: 'trendEnable', type: 'bool', title: 'Enable Trend Detection', defval: true, group: G_TREND,
    tooltip: 'Multi-segment trend system using ghost candle HH/HL/LH/LL pattern detection.' },
  { id: 'rangeAngleThreshold', type: 'float', title: 'Range Angle Threshold (°)', defval: 10.0, min: 1.0, max: 45.0,
    step: 1.0, group: G_TREND, tooltip: 'Lines with angle ≤ this value are classified as RANGE.' },
  { id: 'trendMinBlocks', type: 'int', title: 'Minimum Blocks per Segment', defval: 2, min: 2, max: 10, group: G_TREND,
    tooltip: 'Minimum blocks required to draw a segment line.' },
  { id: 'showRangeSegments', type: 'bool', title: 'Show Range Segments', defval: true, group: G_TREND,
    tooltip: 'Draw lines for range/sideways segments.' },
  { id: 'trendUpColor', type: 'color', title: 'Uptrend Line Color', defval: '#22C55E', group: G_TREND,
    tooltip: 'Color for uptrend support lines (green).' },
  { id: 'trendDnColor', type: 'color', title: 'Downtrend Line Color', defval: '#EF4444', group: G_TREND,
    tooltip: 'Color for downtrend resistance lines (red).' },
  { id: 'trendRangeColor', type: 'color', title: 'Range Line Color', defval: '#94A3B8', group: G_TREND,
    tooltip: 'Color for range/sideways lines (gray).' },
  { id: 'trendLineWidth', type: 'int', title: 'Trend Line Width', defval: 2, min: 1, max: 5, group: G_TREND,
    tooltip: 'Pixel width of the upper and lower trend channel lines drawn on the chart. Thicker lines are more visible but may obscure nearby price action.' },
  { id: 'trendLineStyle', type: 'string', title: 'Trend Line Style', defval: 'solid',
    options: ['solid', 'dashed', 'dotted'], group: G_TREND,
    tooltip: 'Visual style for trend channel lines. Solid: continuous line. Dashed: segmented line. Dotted: small dots. Choose based on visual preference and chart clarity.' },
  { id: 'trendProject', type: 'bool', title: 'Project to Future', defval: true, group: G_TREND,
    tooltip: 'Extend trend lines into the future by one block width.' },
  { id: 'coreEnable', type: 'bool', title: 'Enable Core Calculation', defval: true, group: G_CORE,
    tooltip: 'Master switch for the core volume analysis engine. When enabled, calculates MAX/MIN buy/sell levels and POC for each block. Disabling turns off all core lines and related dashboard data.' },
  { id: 'coreDrawLines', type: 'bool', title: 'Draw Core Lines', defval: true, group: G_CORE,
    tooltip: 'Draws horizontal lines on the chart for the nearest core levels (MAX/MIN buy/sell) above and below the current price. Lines include labels showing level type, block number, and price.' },
  { id: 'coreProjectFwd', type: 'bool', title: 'Offset / Projection (to Future)', defval: true, group: G_CORE,
    tooltip: 'Extends core level lines and their labels into future bars (right side of chart) by one block width. Helps visualize where key levels will be relative to upcoming price action.' },
  { id: 'coreNearestOnly', type: 'bool', title: 'Nearest Only (1 Up / 1 Down)', defval: true, group: G_CORE,
    tooltip: 'When enabled, displays only the single nearest core level above and below the current price. This keeps the chart clean by avoiding multiple overlapping lines. When disabled, all qualifying levels are shown.' },
  { id: 'coreShowMax', type: 'bool', title: 'Include MAX Buy/Sell Levels', defval: true, group: G_CORE,
    tooltip: 'Includes the highest buying volume bar (MAX BUY) and highest selling volume bar (MAX SELL) from each block as candidate core levels. These represent bars where the most aggressive activity occurred.' },
  { id: 'coreShowMin', type: 'bool', title: 'Include MIN Buy/Sell Levels', defval: true, group: G_CORE,
    tooltip: 'Includes the lowest buying volume bar (MIN BUY) and lowest selling volume bar (MIN SELL) from each block as candidate core levels. These represent bars with minimal activity — potential exhaustion or vacuum zones.' },
  { id: 'pocEnable', type: 'bool', title: 'Enable POC', defval: true, group: G_CORE,
    tooltip: 'Enables the Point of Control (POC) calculation — the price level with the highest accumulated volume in each block. POC acts as a volume-based magnet where price tends to gravitate.' },
  { id: 'pocShowNearest', type: 'bool', title: 'Show POC Nearest Up/Down', defval: true, group: G_CORE,
    tooltip: 'Displays dashed horizontal lines for the nearest POC level above and below the current price. These high-volume zones often act as support/resistance where price may react.' },
  { id: 'pocBinProfile', type: 'bool', title: 'POC: Volume Profile Bins (All Plans)', defval: true, group: G_CORE,
    tooltip: 'True Volume Profile POC — available on all plans.\n\nHow it works: Divides each block\'s price range into equal bins, distributes each bar\'s volume proportionally across the bins its range overlaps, and selects the bin with the highest accumulated volume as the Point of Control.\n\nThis is significantly more accurate than the default single-bar method (which simply uses the average price of the highest-volume bar). When ON, POC reflects the actual high-volume price zone across all bars in the block.\n\nWhen OFF, the original single-bar method is used as fallback.' },
  { id: 'pocBinCount', type: 'int', title: 'POC Bin Resolution', defval: 25, min: 10, max: 100, group: G_CORE,
    tooltip: 'Number of equal price bins used to build the Volume Profile within each block.\n\nHigher values = finer price resolution = more precise POC, but heavier computation.\nLower values = coarser resolution = faster, but POC may be less precise.\n\nRecommended ranges:\n• 10–15: Fast, suitable for high-timeframe or low-volatility instruments.\n• 20–30: Good balance for most instruments and timeframes (default: 25).\n• 50–100: High precision for scalping or tick-level analysis on lower timeframes.\n\nThis setting has no effect when \'POC: Volume Profile Bins\' is OFF.' },
  { id: 'coreLineWidth', type: 'int', title: 'Line Width', defval: 1, min: 1, max: 4, group: G_CORE,
    tooltip: 'Pixel width for core level lines and POC lines drawn on the chart. Applies to all horizontal lines generated by the Core Calculation engine.' },
];

// No plot(): a bar colour (composite candle mode), drawings and a table
export const plotConfig: PlotConfig[] = [];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'table'];

export const metadata = {
  title: 'Smart Trader, Episode 03, by Ata Sabancı | Candles and Tradelines',
  shortTitle: 'ST-EP03',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !gt(a, b);
const na = (x: number) => !Number.isFinite(x);

const DIR_UP = 1;
const DIR_DOWN = -1;
const DIR_RANGE = 0;

const T_MAX_BUY = 0;
const T_MAX_SELL = 1;
const T_MIN_BUY = 2;
const T_MIN_SELL = 3;
const T_POC = 10;

interface BlockAnalytics {
  valid: boolean;
  totalBuy: number;
  totalSell: number;
  delta: number;
  avgUpperPin: number;
  avgLowerPin: number;
  avgBody: number;
  newOpen: number;
  newHigh: number;
  newLow: number;
  newClose: number;
  centerIdx: number;
  trendType: number;
  trendLocked: boolean;
}

const analyticsEmpty = (): BlockAnalytics => ({
  valid: false, totalBuy: NaN, totalSell: NaN, delta: NaN, avgUpperPin: NaN, avgLowerPin: NaN, avgBody: NaN,
  newOpen: NaN, newHigh: NaN, newLow: NaN, newClose: NaN, centerIdx: NaN, trendType: 0, trendLocked: false,
});

interface BoxCore {
  valid: boolean;
  pocPrice: number;
  pocOff: number;
  maxBuyOff: number;
  maxBuyHigh: number;
  maxSellOff: number;
  maxSellLow: number;
  minBuyOff: number;
  minBuyHigh: number;
  minSellOff: number;
  minSellLow: number;
}

const coreEmpty = (): BoxCore => ({
  valid: false, pocPrice: NaN, pocOff: NaN, maxBuyOff: NaN, maxBuyHigh: NaN, maxSellOff: NaN, maxSellLow: NaN,
  minBuyOff: NaN, minBuyHigh: NaN, minSellOff: NaN, minSellLow: NaN,
});

interface TrendChannel {
  channelType: number;
  startBlock: number;
  endBlock: number;
  angleDeg: number;
  upperX1: number;
  upperX2: number;
  lowerX1: number;
  lowerX2: number;
  upperY1: number;
  upperY2: number;
  lowerY1: number;
  lowerY2: number;
}

interface CurrentBarAnalysis {
  pattern: string;
  rangeStatus: string;
  delta: number;
  pressureStatus: string;
}

interface CompositeAnalysis {
  blockRelation: string;
}

interface TrendContext {
  currentType: number;
  qualityScore: number;
}

interface DisplayedLevels {
  hasPOCUp: boolean;
  pocUp: number;
  hasPOCDn: boolean;
  pocDn: number;
  hasCoreUp: boolean;
  coreUp: number;
  coreUpType: number;
  coreUpBox: number;
  hasCoreDn: boolean;
  coreDn: number;
  coreDnType: number;
  coreDnBox: number;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SmartTraderEpisode03ByAtaSabanciInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const mintick = mintickOf(chart);
  const lang = cfg.narrativeLang;
  const TS = cfg.textSize;
  const isIntrabar = cfg.calcMethod === 'Intrabar (Precise)';

  const O = bars.map((b) => b.open);
  const H = bars.map((b) => b.high);
  const Lo = bars.map((b) => b.low);
  const C = bars.map((b) => b.close);
  const V = bars.map((b) => b.volume ?? NaN);

  const baseOff = cfg.calcBasis === 'Current (bar[0])' ? 0 : 1;
  const groups = cfg.groups;
  const groupSize = Math.max(1, Math.trunc(Math.round(cfg.window / groups)));
  const effWindow = groupSize * groups;

  // Original candle dimming (bar colour)
  const barColors: BarColorData[] = [];
  if (cfg.showCompositeCandle && cfg.dimOriginalCandles) {
    const dimBull = String(color.new(color.rgb(34, 197, 94), cfg.originalCandleDimLevel));
    const dimBear = String(color.new(color.rgb(239, 68, 68), cfg.originalCandleDimLevel));
    const dimNeutral = String(color.new(color.rgb(120, 120, 120), cfg.originalCandleDimLevel));
    for (let i = 0; i < n; i++) {
      barColors.push({
        id: 'barcolor0', time: bars[i].time as number,
        color: gt(C[i], O[i]) ? dimBull : lt(C[i], O[i]) ? dimBear : dimNeutral,
      });
    }
  }

  // Language selector
  const tl = (en: string, tr: string, hi: string, ar: string) =>
    lang === 'Türkçe' ? tr : lang === 'हिन्दी' ? hi : lang === 'العربية' ? ar : en;

  // Volume engine
  const ltf = isIntrabar ? lowerTimeframe(bars, cfg.useCustomLTF, cfg.customLTF, chart).timeframe : '';
  let vBuy: number[];
  let vSell: number[];
  if (isIntrabar) {
    const ud = upDownVolumeOfChartBars(bars);
    vBuy = ud.up.map((u) => Math.abs(u));
    vSell = ud.down.map((d) => Math.abs(d));
  } else {
    vBuy = [];
    vSell = [];
    for (let i = 0; i < n; i++) {
      const r = H[i] - Lo[i];
      const vol = V[i];
      if (na(vol)) {
        vBuy.push(NaN);
        vSell.push(NaN);
      } else if (eq(r, 0)) {
        vBuy.push(vol * 0.5);
        vSell.push(vol * 0.5);
      } else {
        vBuy.push(vol * ((C[i] - Lo[i]) / r));
        vSell.push(vol * ((H[i] - C[i]) / r));
      }
    }
  }

  resetDrawings({ line: 500, label: 500, box: 500 });
  const empty: IndicatorResult & { barColors: BarColorData[] } = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    barColors,
  };
  if (n === 0) return empty;

  const atrArr = ta.atr(bars, 20).toArray().map((v) => v ?? NaN);
  const L = n - 1; // bar_index of the last bar
  setDrawingBar(L, true, L);
  const get = (arr: number[], off: number) => {
    const j = L - off;
    return j >= 0 && j < n ? arr[j] : NaN;
  };
  const hlc3 = (off: number) => (get(H, off) + get(Lo, off) + get(C, off)) / 3;

  // Yang-Zhang volatility of the last 20 bars (price units)
  const yz = (() => {
    let sumOvSq = 0.0, sumOv = 0.0, sumClSq = 0.0, sumCl = 0.0, sumRS = 0.0;
    const p = 20;
    for (let i = 0; i <= p - 1; i++) {
      const ov = math.log(get(O, i) / get(C, i + 1));
      sumOv += ov;
      sumOvSq += ov * ov;
      const cl = math.log(get(C, i) / get(O, i));
      sumCl += cl;
      sumClSq += cl * cl;
      const logHO = math.log(get(H, i) / get(O, i));
      const logHC = math.log(get(H, i) / get(C, i));
      const logLO = math.log(get(Lo, i) / get(O, i));
      const logLC = math.log(get(Lo, i) / get(C, i));
      sumRS += logHO * logHC + logLO * logLC;
    }
    const nm1 = p - 1;
    const varOv = sumOvSq / nm1 - (sumOv * sumOv) / (p * nm1);
    const varCl = sumClSq / nm1 - (sumCl * sumCl) / (p * nm1);
    const varRS = sumRS / p;
    const k = 0.34 / (1.34 + (p + 1) / (p - 1));
    const varYZ = varOv + k * varCl + (1.0 - k) * varRS;
    const sigma = Math.sqrt(Number.isNaN(varYZ) ? NaN : Math.max(0.0, varYZ));
    return sigma * get(C, 0);
  })();
  const globalAvgRange = atrArr[L];

  const histBarsDash = Math.min(Math.max(0, L - baseOff + 1), 5000);
  let scannableBars = 0;
  if (isIntrabar) {
    const probe = Math.min(histBarsDash, effWindow);
    for (let off = baseOff; off <= baseOff + probe - 1; off++) {
      if (!na(get(vBuy, off)) && !na(get(vSell, off))) scannableBars += 1;
      else break;
    }
  } else {
    scannableBars = Math.min(histBarsDash, effWindow);
  }

  // ── Group labels, boxes, analytics and composite candles ──
  const lblNums: Label[] = [];
  const grpBoxes: Box[] = [];
  let analyticsData: BlockAnalytics[] = [];
  const enoughHistory = L >= baseOff + effWindow - 1;
  const black70 = String(color.new(color.black, 70));
  const black85 = String(color.new(color.black, 85));
  const black100 = String(color.new(color.black, 100));
  const gray100 = String(color.new(color.gray, 100));
  if (enoughHistory) {
    if (cfg.showGroupNums) {
      for (let gi = 0; gi < groups; gi++) {
        lblNums.push(label.new(L, H[L], '', 'bar_index', 'price', black70, 'label_down', color.white, TS));
      }
      for (let gi = 0; gi < groups; gi++) {
        const endOff = baseOff + (gi + 1) * groupSize - 1;
        const lb = lblNums[gi];
        label.set_xy(lb, L - endOff, get(H, endOff));
        label.set_text(lb, str.tostring(gi + 1));
      }
    }
    if (cfg.showGroupBoxes) {
      const boxBg = String(color.new(cfg.boxColor, cfg.boxTransp));
      for (let gi = 0; gi < groups; gi++) {
        grpBoxes.push(box.new(L, H[L], L, Lo[L], black100, 0, undefined, undefined, undefined, boxBg));
      }
      analyticsData = Array.from({ length: groups }, analyticsEmpty);
      const bodies: Box[] = [];
      const upperWicks: Line[] = [];
      const lowerWicks: Line[] = [];
      if (cfg.showCompositeCandle) {
        for (let gi = 0; gi < groups; gi++) {
          bodies.push(box.new(L, H[L], L, Lo[L], String(color.new(color.gray, 60)), 1, undefined, undefined, undefined,
            String(color.new(color.gray, 75))));
        }
        for (let gi = 0; gi < groups; gi++) {
          upperWicks.push(line.new(L, H[L], L, H[L], 'bar_index', 'none', String(color.new(color.gray, 70)), undefined, 1));
        }
        for (let gi = 0; gi < groups; gi++) {
          lowerWicks.push(line.new(L, Lo[L], L, Lo[L], 'bar_index', 'none', String(color.new(color.gray, 70)), undefined, 1));
        }
      }
      const bullishCol = color.rgb(34, 197, 94);
      const bearishCol = color.rgb(239, 68, 68);
      const neutralCol = color.rgb(156, 163, 175);
      for (let gi = 0; gi < groups; gi++) {
        const startOff = baseOff + gi * groupSize;
        const endOff = baseOff + (gi + 1) * groupSize - 1;
        let top = NaN, bot = NaN;
        let sumBuyBlock = 0.0, sumSellBlock = 0.0;
        let sumUpperPin = 0.0, sumLowerPin = 0.0, sumBody = 0.0;
        let compOpen = NaN, compHigh = NaN, compLow = NaN, compClose = NaN;
        for (let k = startOff; k <= endOff; k++) {
          const h = get(H, k), l = get(Lo, k), o = get(O, k), c = get(C, k);
          if (na(top) || gt(h, top)) top = h;
          if (na(bot) || lt(l, bot)) bot = l;
          const bVol = get(vBuy, k), sVol = get(vSell, k);
          if (!na(bVol) && !na(sVol)) {
            sumBuyBlock += bVol;
            sumSellBlock += sVol;
          }
          sumUpperPin += h - Math.max(o, c);
          sumLowerPin += Math.min(o, c) - l;
          sumBody += Math.abs(c - o);
          if (k === endOff) compOpen = o;
          if (k === startOff) compClose = c;
          if (na(compHigh) || gt(h, compHigh)) compHigh = h;
          if (na(compLow) || lt(l, compLow)) compLow = l;
        }
        const xRight = L - startOff;
        const xLeft = L - endOff;
        const xCenter = Math.trunc(Math.round((xLeft + xRight) / 2.0));
        const bx = grpBoxes[gi];
        box.set_lefttop(bx, xLeft, top);
        box.set_rightbottom(bx, xRight, bot);
        box.set_bgcolor(bx, boxBg);
        box.set_border_color(bx, black100);
        box.set_border_width(bx, 0);

        const blockDelta = sumBuyBlock - sumSellBlock;
        analyticsData[gi] = {
          valid: true, totalBuy: sumBuyBlock, totalSell: sumSellBlock, delta: blockDelta,
          avgUpperPin: sumUpperPin / groupSize, avgLowerPin: sumLowerPin / groupSize, avgBody: sumBody / groupSize,
          newOpen: compOpen, newHigh: compHigh, newLow: compLow, newClose: compClose,
          centerIdx: xCenter, trendType: NaN, trendLocked: false,
        };

        if (cfg.showCompositeCandle && !na(compOpen) && !na(compHigh) && !na(compLow) && !na(compClose)) {
          const candleCol = gt(blockDelta, 0) ? bullishCol : lt(blockDelta, 0) ? bearishCol : neutralCol;
          const wickCol = String(color.new(candleCol, cfg.compositeCandleTransp - 15));
          const bodyCol = String(color.new(candleCol, cfg.compositeCandleTransp));
          const borderCol = String(color.new(candleCol, cfg.compositeCandleTransp - 25));
          const bodyTop = Math.max(compOpen, compClose);
          const bodyBot = Math.min(compOpen, compClose);
          const bodyBox = bodies[gi];
          box.set_lefttop(bodyBox, xCenter - 1, bodyTop);
          box.set_rightbottom(bodyBox, xCenter + 1, bodyBot);
          box.set_bgcolor(bodyBox, bodyCol);
          box.set_border_color(bodyBox, borderCol);
          box.set_border_width(bodyBox, 1);
          const uw = upperWicks[gi];
          line.set_xy1(uw, xCenter, bodyTop);
          line.set_xy2(uw, xCenter, compHigh);
          line.set_color(uw, wickCol);
          line.set_width(uw, 1);
          const lw = lowerWicks[gi];
          line.set_xy1(lw, xCenter, bodyBot);
          line.set_xy2(lw, xCenter, compLow);
          line.set_color(lw, wickCol);
          line.set_width(lw, 1);
        }
      }
    }
  }

  // ── Volume profile POC of each block (bins) ──
  const binPocPrice: number[] = [];
  const binPocOff: number[] = [];
  const nb = cfg.pocBinCount;
  for (let gi = 0; gi < groups; gi++) {
    const sOff = baseOff + gi * groupSize;
    const eOff = baseOff + (gi + 1) * groupSize - 1;
    let blockHigh = NaN, blockLow = NaN;
    for (let k = sOff; k <= eOff; k++) {
      const h = get(H, k), l = get(Lo, k);
      if (na(blockHigh) || gt(h, blockHigh)) blockHigh = h;
      if (na(blockLow) || lt(l, blockLow)) blockLow = l;
    }
    let bp = NaN, bo = NaN;
    if (!na(blockHigh) && !na(blockLow) && gt(blockHigh, blockLow)) {
      const binSize = (blockHigh - blockLow) / nb;
      const binVol = new Array<number>(nb).fill(0.0);
      for (let k = sOff; k <= eOff; k++) {
        const barH = get(H, k), barL = get(Lo, k);
        const bv = get(vBuy, k), sv = get(vSell, k);
        const total = (na(bv) ? 0.0 : bv) + (na(sv) ? 0.0 : sv);
        if (gt(total, 0.0) && gt(barH, barL)) {
          const firstBin = Math.max(0, Math.trunc(Math.floor((barL - blockLow) / binSize)));
          let lastBin = Math.min(nb - 1, Math.trunc(Math.floor((barH - blockLow - mintick * 0.01) / binSize)));
          lastBin = Math.max(firstBin, lastBin);
          const barRange = barH - barL;
          for (let b = firstBin; b <= lastBin; b++) {
            const bLow = blockLow + b * binSize;
            const bHigh = bLow + binSize;
            const overlap = Math.min(barH, bHigh) - Math.max(barL, bLow);
            const proportion = gt(barRange, 0.0) ? Math.max(0.0, overlap / barRange) : 0.0;
            binVol[b] = binVol[b] + total * proportion;
          }
        }
      }
      let maxVol = 0.0, maxBin = 0;
      for (let b = 0; b < nb; b++) {
        if (gt(binVol[b], maxVol)) {
          maxVol = binVol[b];
          maxBin = b;
        }
      }
      bp = blockLow + (maxBin + 0.5) * binSize;
      let minDist = NaN;
      for (let k = sOff; k <= eOff; k++) {
        const dist = Math.abs(hlc3(k) - bp);
        if (na(minDist) || lt(dist, minDist)) {
          minDist = dist;
          bo = k;
        }
      }
    }
    binPocPrice.push(bp);
    binPocOff.push(na(bo) ? 0 : bo);
  }

  // ── Core levels and POC lines ──
  const levels: DisplayedLevels = {
    hasPOCUp: false, pocUp: NaN, hasPOCDn: false, pocDn: NaN, hasCoreUp: false, coreUp: NaN, coreUpType: NaN,
    coreUpBox: NaN, hasCoreDn: false, coreDn: NaN, coreDnType: NaN, coreDnBox: NaN,
  };
  {
    const coreBuyCol = color.rgb(59, 130, 246);
    const coreSellCol = color.rgb(244, 63, 94);
    const pocCol = color.rgb(234, 179, 8);
    const pocColDim = String(color.new(pocCol, 25));
    const refX = L - baseOff;
    const projLen = cfg.coreProjectFwd ? groupSize : 0;
    const x2 = refX + projLen;
    const refPrice = get(C, baseOff);
    const hiBasis = get(H, baseOff), loBasis = get(Lo, baseOff);
    const consSrc: number[] = [];
    const consType: number[] = [];
    const consPrice: number[] = [];
    const isConsumed = (src: number, typ: number, prc: number) => {
      const tol = mintick * 0.5;
      let hit = false;
      for (let i = 0; i < consSrc.length; i++) {
        if (consSrc[i] === src && consType[i] === typ && le(Math.abs(consPrice[i] - prc), tol)) hit = true;
      }
      return hit;
    };
    const markConsumed = (src: number, typ: number, prc: number) => {
      consSrc.push(src);
      consType.push(typ);
      consPrice.push(prc);
      while (consSrc.length > 260) {
        consSrc.shift();
        consType.shift();
        consPrice.shift();
      }
    };
    const newLine = (col: string, st: 'solid' | 'dashed') =>
      line.new(L, C[L], L, C[L], 'bar_index', 'none', col, st, cfg.coreLineWidth);
    const lnCoreUp = newLine(coreBuyCol, 'solid');
    const lnCoreDn = newLine(coreSellCol, 'solid');
    const lnPOCUp = newLine(pocCol, 'dashed');
    const lnPOCDn = newLine(pocColDim, 'dashed');
    const hideLine = (l: Line, x: number, y: number) => {
      line.set_xy1(l, x, y);
      line.set_xy2(l, x, y);
      line.set_color(l, gray100);
    };
    const setHLine = (l: Line, xa: number, xb: number, y: number, col: string) => {
      line.set_xy1(l, xa, y);
      line.set_xy2(l, xb, y);
      line.set_color(l, col);
      line.set_width(l, cfg.coreLineWidth);
    };
    const newLabel = (col: string) => label.new(L, C[L], '', 'bar_index', 'price', black85, 'label_left', col, TS);
    const hideLabel = (lb: Label) => {
      label.set_text(lb, '');
      label.set_xy(lb, L, C[L]);
      label.set_textcolor(lb, gray100);
    };
    const setLineLabel = (lb: Label, x: number, y: number, txt: string, col: string) => {
      label.set_xy(lb, x, y);
      label.set_text(lb, txt);
      label.set_textcolor(lb, col);
      label.set_style(lb, 'label_left');
      label.set_size(lb, TS);
    };
    const typeName = (typ: number) =>
      typ === T_MAX_BUY ? 'MAX BUY' : typ === T_MAX_SELL ? 'MAX SELL' : typ === T_MIN_BUY ? 'MIN BUY'
        : typ === T_MIN_SELL ? 'MIN SELL' : 'LEVEL';
    const fmtMintick = (x: number) => str.tostring(x, 'mintick', mintick);

    if (!(L >= baseOff + effWindow - 1)) {
      hideLine(lnCoreUp, refX, refPrice);
      hideLine(lnCoreDn, refX, refPrice);
      hideLine(lnPOCUp, refX, refPrice);
      hideLine(lnPOCDn, refX, refPrice);
    } else {
      const coreBoxes: BoxCore[] = [];
      const validBarsCore = isIntrabar ? scannableBars : Math.min(histBarsDash, effWindow);
      const validGroupsCore = Math.min(Math.trunc(Math.floor(validBarsCore / groupSize)), groups);
      for (let gi = 0; gi < groups; gi++) {
        if (!cfg.coreEnable || !(gi < validGroupsCore)) {
          coreBoxes.push(coreEmpty());
          continue;
        }
        const startOff = baseOff + gi * groupSize;
        const endOff = baseOff + (gi + 1) * groupSize - 1;
        let gValid = true;
        let maxB = -1.0, maxBOff = NaN, minB = NaN, minBOff = NaN;
        let maxS = -1.0, maxSOff = NaN, minS = NaN, minSOff = NaN;
        let pocV = -1.0, pocOff = NaN;
        for (let k = startOff; k <= endOff; k++) {
          const b = get(vBuy, k), s = get(vSell, k);
          if (na(b) || na(s)) {
            gValid = false;
          } else {
            if (gt(b, maxB)) { maxB = b; maxBOff = k; }
            if (na(minB) || lt(b, minB)) { minB = b; minBOff = k; }
            if (gt(s, maxS)) { maxS = s; maxSOff = k; }
            if (na(minS) || lt(s, minS)) { minS = s; minSOff = k; }
            const totalVol = b + s;
            if (gt(totalVol, pocV)) { pocV = totalVol; pocOff = k; }
          }
        }
        if (!gValid || na(maxBOff) || na(maxSOff) || na(minBOff) || na(minSOff) || na(pocOff)) {
          coreBoxes.push(coreEmpty());
        } else {
          let finalPocPrice = hlc3(pocOff);
          let finalPocOff = pocOff;
          if (cfg.pocBinProfile && !na(binPocPrice[gi])) {
            finalPocPrice = binPocPrice[gi];
            finalPocOff = binPocOff[gi];
          }
          coreBoxes.push({
            valid: true, pocPrice: finalPocPrice, pocOff: finalPocOff,
            maxBuyOff: maxBOff, maxBuyHigh: get(H, maxBOff), maxSellOff: maxSOff, maxSellLow: get(Lo, maxSOff),
            minBuyOff: minBOff, minBuyHigh: get(H, minBOff), minSellOff: minSOff, minSellLow: get(Lo, minSOff),
          });
        }
      }

      interface Pick { upP: number; upSrc: number; upTyp: number; upBox: number; dnP: number; dnSrc: number; dnTyp: number; dnBox: number }
      const pickNearestExt = (refP: number): Pick => {
        const r: Pick = { upP: NaN, upSrc: NaN, upTyp: NaN, upBox: NaN, dnP: NaN, dnSrc: NaN, dnTyp: NaN, dnBox: NaN };
        let upDist = NaN, dnDist = NaN;
        const consider = (p: number, s: number, typ: number, gi: number) => {
          if (!na(p) && !isConsumed(s, typ, p)) {
            if (gt(p, refP)) {
              const d = p - refP;
              if (na(upDist) || lt(d, upDist)) { upDist = d; r.upP = p; r.upSrc = s; r.upTyp = typ; r.upBox = gi + 1; }
            }
            if (lt(p, refP)) {
              const d = refP - p;
              if (na(dnDist) || lt(d, dnDist)) { dnDist = d; r.dnP = p; r.dnSrc = s; r.dnTyp = typ; r.dnBox = gi + 1; }
            }
          }
        };
        for (let gi = 0; gi < groups; gi++) {
          const bc = coreBoxes[gi];
          if (!bc.valid) continue;
          if (cfg.coreShowMax) {
            consider(bc.maxBuyHigh, L - bc.maxBuyOff, T_MAX_BUY, gi);
            consider(bc.maxSellLow, L - bc.maxSellOff, T_MAX_SELL, gi);
          }
          if (cfg.coreShowMin) {
            consider(bc.minBuyHigh, L - bc.minBuyOff, T_MIN_BUY, gi);
            consider(bc.minSellLow, L - bc.minSellOff, T_MIN_SELL, gi);
          }
        }
        return r;
      };
      const pickNearestPOC = (refP: number): Pick => {
        const r: Pick = { upP: NaN, upSrc: NaN, upTyp: T_POC, upBox: NaN, dnP: NaN, dnSrc: NaN, dnTyp: T_POC, dnBox: NaN };
        let upDist = NaN, dnDist = NaN;
        for (let gi = 0; gi < groups; gi++) {
          const bc = coreBoxes[gi];
          if (!bc.valid) continue;
          const p = bc.pocPrice;
          const src = L - bc.pocOff;
          if (!na(p) && !isConsumed(src, T_POC, p)) {
            if (gt(p, refP)) {
              const d = p - refP;
              if (na(upDist) || lt(d, upDist)) { upDist = d; r.upP = p; r.upSrc = src; r.upBox = gi + 1; }
            }
            if (lt(p, refP)) {
              const d = refP - p;
              if (na(dnDist) || lt(d, dnDist)) { dnDist = d; r.dnP = p; r.dnSrc = src; r.dnBox = gi + 1; }
            }
          }
        }
        return r;
      };
      const noPick = (): Pick => ({ upP: NaN, upSrc: NaN, upTyp: NaN, upBox: NaN, dnP: NaN, dnSrc: NaN, dnTyp: NaN, dnBox: NaN });

      const showCoreNearest = cfg.coreDrawLines && cfg.coreNearestOnly && (cfg.coreShowMax || cfg.coreShowMin);
      let ext = showCoreNearest && cfg.coreEnable ? pickNearestExt(refPrice) : noPick();
      const showPOCNearest = cfg.pocEnable && cfg.pocShowNearest && cfg.coreEnable;
      let poc = showPOCNearest ? pickNearestPOC(refPrice) : noPick();
      const inBasis = (p: number) => le(loBasis, p) && le(p, hiBasis);
      for (let pass = 0; pass <= 1; pass++) {
        let changed = false;
        if (showCoreNearest && !na(ext.upP) && inBasis(ext.upP)) { markConsumed(ext.upSrc, ext.upTyp, ext.upP); changed = true; }
        if (showCoreNearest && !na(ext.dnP) && inBasis(ext.dnP)) { markConsumed(ext.dnSrc, ext.dnTyp, ext.dnP); changed = true; }
        if (showPOCNearest && !na(poc.upP) && inBasis(poc.upP)) { markConsumed(poc.upSrc, T_POC, poc.upP); changed = true; }
        if (showPOCNearest && !na(poc.dnP) && inBasis(poc.dnP)) { markConsumed(poc.dnSrc, T_POC, poc.dnP); changed = true; }
        if (changed) {
          if (showCoreNearest) ext = pickNearestExt(refPrice);
          if (showPOCNearest) poc = pickNearestPOC(refPrice);
        }
      }

      // Displayed levels for the narrative
      if (!na(poc.upP)) { levels.hasPOCUp = true; levels.pocUp = poc.upP; }
      if (!na(poc.dnP)) { levels.hasPOCDn = true; levels.pocDn = poc.dnP; }
      if (!na(ext.upP)) { levels.hasCoreUp = true; levels.coreUp = ext.upP; levels.coreUpType = ext.upTyp; levels.coreUpBox = ext.upBox; }
      if (!na(ext.dnP)) { levels.hasCoreDn = true; levels.coreDn = ext.dnP; levels.coreDnType = ext.dnTyp; levels.coreDnBox = ext.dnBox; }

      const lblCoreUp = newLabel(coreBuyCol);
      const lblCoreDn = newLabel(coreSellCol);
      const lblPOCUp = newLabel(pocCol);
      const lblPOCDn = newLabel(pocColDim);
      if (showCoreNearest && !na(ext.upP)) {
        setHLine(lnCoreUp, ext.upSrc, x2, ext.upP, coreBuyCol);
        setLineLabel(lblCoreUp, x2, ext.upP, `${typeName(ext.upTyp)} | Box ${str.tostring(ext.upBox)} | ${fmtMintick(ext.upP)}`, coreBuyCol);
      } else {
        hideLine(lnCoreUp, refX, refPrice);
        hideLabel(lblCoreUp);
      }
      if (showCoreNearest && !na(ext.dnP)) {
        setHLine(lnCoreDn, ext.dnSrc, x2, ext.dnP, coreSellCol);
        setLineLabel(lblCoreDn, x2, ext.dnP, `${typeName(ext.dnTyp)} | Box ${str.tostring(ext.dnBox)} | ${fmtMintick(ext.dnP)}`, coreSellCol);
      } else {
        hideLine(lnCoreDn, refX, refPrice);
        hideLabel(lblCoreDn);
      }
      if (showPOCNearest && !na(poc.upP)) {
        setHLine(lnPOCUp, poc.upSrc, x2, poc.upP, pocCol);
        setLineLabel(lblPOCUp, x2, poc.upP, `POC | Box ${str.tostring(poc.upBox)} | ${fmtMintick(poc.upP)}`, pocCol);
      } else {
        hideLine(lnPOCUp, refX, refPrice);
        hideLabel(lblPOCUp);
      }
      if (showPOCNearest && !na(poc.dnP)) {
        setHLine(lnPOCDn, poc.dnSrc, x2, poc.dnP, pocColDim);
        setLineLabel(lblPOCDn, x2, poc.dnP, `POC | Box ${str.tostring(poc.dnBox)} | ${fmtMintick(poc.dnP)}`, pocColDim);
      } else {
        hideLine(lnPOCDn, refX, refPrice);
        hideLabel(lblPOCDn);
      }
    }
  }

  // ── Trend channels ──
  const trendChannels: TrendChannel[] = [];
  const fmtMintick = (x: number) => str.tostring(x, 'mintick', mintick);
  if (cfg.trendEnable && analyticsData.length >= cfg.trendMinBlocks) {
    const lockBlockTrend = (blockIdx: number, trendType: number) => {
      if (blockIdx < analyticsData.length) {
        const blk = analyticsData[blockIdx];
        if (!blk.trendLocked) {
          blk.trendType = trendType;
          blk.trendLocked = true;
        }
      }
    };
    const isHigherPosition = (a: BlockAnalytics, b: BlockAnalytics) => {
      if (!a.valid || !b.valid) return DIR_RANGE;
      const midA = (a.newHigh + a.newLow) / 2;
      const midB = (b.newHigh + b.newLow) / 2;
      return gt(midA, midB) ? DIR_UP : lt(midA, midB) ? DIR_DOWN : DIR_RANGE;
    };
    const calcChannelAngle = (priceChange: number, barSpan: number, yzVolPrice: number) => {
      if (barSpan === 0 || le(yzVolPrice, 0.0)) return 0.0;
      const expectedMove = yzVolPrice * Math.sqrt(barSpan);
      const normalizedChange = gt(expectedMove, 0.0) ? priceChange / expectedMove : 0.0;
      return math.todegrees(math.atan(normalizedChange));
    };
    // Scan blocks and build continuous trend channels
    const numBlocks = analyticsData.length;
    if (numBlocks >= 2) {
      let i = 0;
      while (i < numBlocks - 1) {
        const newerBlk = analyticsData[i];
        const olderBlk = analyticsData[i + 1];
        const dir = newerBlk.trendLocked ? newerBlk.trendType : isHigherPosition(newerBlk, olderBlk);
        if (dir === DIR_RANGE) {
          lockBlockTrend(i, DIR_RANGE);
          i += 1;
          continue;
        }
        const segStart = i;
        let segEnd = i + 1;
        lockBlockTrend(segStart, dir);
        while (segEnd < numBlocks - 1) {
          const blkNewer = analyticsData[segEnd];
          const blkOlder = analyticsData[segEnd + 1];
          const nextDir = blkNewer.trendLocked ? blkNewer.trendType : isHigherPosition(blkNewer, blkOlder);
          if (nextDir === dir || (blkOlder.trendLocked && blkOlder.trendType === dir)) {
            lockBlockTrend(segEnd, dir);
            segEnd += 1;
          } else {
            lockBlockTrend(segEnd, nextDir);
            break;
          }
        }
        lockBlockTrend(segEnd, dir);

        // Extreme points of the segment
        let highestHigh = NaN, lowestHigh = NaN, highestLow = NaN, lowestLow = NaN;
        let hhIdx = NaN, lhIdx = NaN, hlIdx = NaN, llIdx = NaN;
        for (let j = segStart; j <= segEnd; j++) {
          if (j < analyticsData.length) {
            const blk = analyticsData[j];
            if (blk.valid) {
              if (na(highestHigh) || gt(blk.newHigh, highestHigh)) { highestHigh = blk.newHigh; hhIdx = blk.centerIdx; }
              if (na(lowestHigh) || lt(blk.newHigh, lowestHigh)) { lowestHigh = blk.newHigh; lhIdx = blk.centerIdx; }
              if (na(highestLow) || gt(blk.newLow, highestLow)) { highestLow = blk.newLow; hlIdx = blk.centerIdx; }
              if (na(lowestLow) || lt(blk.newLow, lowestLow)) { lowestLow = blk.newLow; llIdx = blk.centerIdx; }
            }
          }
        }

        if (!na(highestHigh) && !na(lowestHigh) && !na(highestLow) && !na(lowestLow)) {
          const blkOldest = analyticsData[segEnd];
          const blkNewest = analyticsData[segStart];
          const segmentX1 = blkOldest.centerIdx;
          const segmentX2 = blkNewest.centerIdx;
          let upperY1: number, upperY2: number, lowerY1: number, lowerY2: number;
          if (dir === DIR_DOWN) {
            const upperSpan = lhIdx - hhIdx;
            const lowerSpan = llIdx - hlIdx;
            const upperSlope = upperSpan !== 0 ? (lowestHigh - highestHigh) / upperSpan : 0.0;
            const lowerSlope = lowerSpan !== 0 ? (lowestLow - highestLow) / lowerSpan : 0.0;
            upperY1 = highestHigh + (upperSlope * (segmentX1 - hhIdx));
            upperY2 = highestHigh + (upperSlope * (segmentX2 - hhIdx));
            lowerY1 = highestLow + (lowerSlope * (segmentX1 - hlIdx));
            lowerY2 = highestLow + (lowerSlope * (segmentX2 - hlIdx));
          } else if (dir === DIR_UP) {
            const upperSpan = hhIdx - lhIdx;
            const lowerSpan = hlIdx - llIdx;
            const upperSlope = upperSpan !== 0 ? (highestHigh - lowestHigh) / upperSpan : 0.0;
            const lowerSlope = lowerSpan !== 0 ? (highestLow - lowestLow) / lowerSpan : 0.0;
            upperY1 = lowestHigh + (upperSlope * (segmentX1 - lhIdx));
            upperY2 = lowestHigh + (upperSlope * (segmentX2 - lhIdx));
            lowerY1 = lowestLow + (lowerSlope * (segmentX1 - llIdx));
            lowerY2 = lowestLow + (lowerSlope * (segmentX2 - llIdx));
          } else {
            upperY1 = blkOldest.newHigh;
            upperY2 = blkNewest.newHigh;
            lowerY1 = blkOldest.newLow;
            lowerY2 = blkNewest.newLow;
          }
          const midY1 = (upperY1 + lowerY1) / 2;
          const midY2 = (upperY2 + lowerY2) / 2;
          const angleDeg = calcChannelAngle(midY2 - midY1, Math.abs(segmentX2 - segmentX1), yz);
          const finalType = le(Math.abs(angleDeg), cfg.rangeAngleThreshold) ? 0 : dir;
          trendChannels.push({
            channelType: finalType, startBlock: segStart + 1, endBlock: segEnd + 1, angleDeg,
            upperX1: segmentX1, upperX2: segmentX2, lowerX1: segmentX1, lowerX2: segmentX2,
            upperY1, upperY2, lowerY1, lowerY2,
          });
        }
        i = segEnd + 1;
      }
    }

    // Draw the channels (projection only for the latest one)
    const projLen = cfg.trendProject ? groupSize + 2 : 0;
    const lstyle = cfg.trendLineStyle;
    for (let ci = 0; ci < trendChannels.length; ci++) {
      const ch = trendChannels[ci];
      if (ch.channelType === DIR_RANGE && !cfg.showRangeSegments) continue;
      const chCol = ch.channelType === DIR_UP ? cfg.trendUpColor : ch.channelType === DIR_DOWN ? cfg.trendDnColor : cfg.trendRangeColor;
      const curProj = ci === 0 ? projLen : 0;
      const upperBarSpan = ch.upperX2 - ch.upperX1;
      const lowerBarSpan = ch.lowerX2 - ch.lowerX1;
      const upperSlope = upperBarSpan > 0 ? (ch.upperY2 - ch.upperY1) / upperBarSpan : 0.0;
      const lowerSlope = lowerBarSpan > 0 ? (ch.lowerY2 - ch.lowerY1) / lowerBarSpan : 0.0;
      line.new(ch.upperX1, ch.upperY1, ch.upperX2 + curProj, ch.upperY2 + (upperSlope * curProj), 'bar_index', 'none',
        chCol, lstyle, cfg.trendLineWidth);
      line.new(ch.lowerX1, ch.lowerY1, ch.lowerX2 + curProj, ch.lowerY2 + (lowerSlope * curProj), 'bar_index', 'none',
        chCol, lstyle, cfg.trendLineWidth);
    }

    // Upper and lower channel labels
    if (trendChannels.length > 0) {
      const ch = trendChannels[0];
      const upperBarSpan = ch.upperX2 - ch.upperX1;
      const lowerBarSpan = ch.lowerX2 - ch.lowerX1;
      const upperSlope = upperBarSpan > 0 ? (ch.upperY2 - ch.upperY1) / upperBarSpan : 0.0;
      const lowerSlope = lowerBarSpan > 0 ? (ch.lowerY2 - ch.lowerY1) / lowerBarSpan : 0.0;
      const upperX2Proj = ch.upperX2 + projLen;
      const lowerX2Proj = ch.lowerX2 + projLen;
      const upperY2Proj = ch.upperY2 + (upperSlope * projLen);
      const lowerY2Proj = ch.lowerY2 + (lowerSlope * projLen);
      const upperAngleDeg = upperBarSpan > 0 && gt(yz, 0.0) ? math.todegrees(math.atan(upperSlope * Math.sqrt(upperBarSpan) / yz)) : 0.0;
      const lowerAngleDeg = lowerBarSpan > 0 && gt(yz, 0.0) ? math.todegrees(math.atan(lowerSlope * Math.sqrt(lowerBarSpan) / yz)) : 0.0;
      const currentPrice = get(C, baseOff);
      const resistDiff = upperY2Proj - currentPrice;
      const supportDiff = currentPrice - lowerY2Proj;
      const resistPct = !eq(currentPrice, 0) ? (resistDiff / currentPrice) * 100 : 0.0;
      const supportPct = !eq(currentPrice, 0) ? (supportDiff / currentPrice) * 100 : 0.0;
      const chCol = ch.channelType === DIR_UP ? cfg.trendUpColor : ch.channelType === DIR_DOWN ? cfg.trendDnColor : cfg.trendRangeColor;
      const blockRange = `Blk ${str.tostring(ch.startBlock)}-${str.tostring(ch.endBlock)}`;
      const upperText = `▲ Upper | ${blockRange} | ${fmtMintick(upperY2Proj)} (+${str.tostring(resistDiff, '#.##')} | +`
        + `${str.tostring(resistPct, '#.##')}%) | ${str.tostring(upperAngleDeg, '#.#')}°`;
      const lowerText = `▼ Lower | ${blockRange} | ${fmtMintick(lowerY2Proj)} (-${str.tostring(supportDiff, '#.##')} | -`
        + `${str.tostring(supportPct, '#.##')}%) | ${str.tostring(lowerAngleDeg, '#.#')}°`;
      label.new(upperX2Proj, upperY2Proj, upperText, 'bar_index', 'price', black85, 'label_left', chCol, TS, undefined,
        'Upper channel line: Block range | Price | Distance | Angle');
      label.new(lowerX2Proj, lowerY2Proj, lowerText, 'bar_index', 'price', black85, 'label_left', chCol, TS, undefined,
        'Lower channel line: Block range | Price | Distance | Angle');
    }
  }

  // ── Dashboard ──
  if (cfg.showDash) {
    const pos = cfg.dashPos === 'Bottom Right' ? 'bottom_right' : cfg.dashPos === 'Bottom Left' ? 'bottom_left' : 'top_right';
    const dashT: Table = table.new(pos, 4, 50, undefined, String(color.new(color.white, 85)), 1,
      String(color.new(color.white, 92)), 1);
    buildDashboard(dashT);
  }

  function buildDashboard(dashT: Table): void {
    const latestTrend = trendChannels.length > 0 ? trendChannels[0] : undefined;
    const trendValid = latestTrend !== undefined && cfg.trendEnable;
    let trendBuy = 0.0, trendSell = 0.0;
    let sumUpperPin = 0.0, sumLowerPin = 0.0, sumBody = 0.0;
    let firstBlockUpperPin = NaN, lastBlockUpperPin = NaN;
    let firstBlockLowerPin = NaN, lastBlockLowerPin = NaN;
    let firstBlockBody = NaN, lastBlockBody = NaN;
    let firstBlockVol = NaN, lastBlockVol = NaN;
    let trendBlocks = 0;
    if (trendValid) {
      const trendStart = latestTrend.startBlock - 1;
      const trendEnd = latestTrend.endBlock - 1;
      trendBlocks = trendEnd - trendStart + 1;
      for (let i = trendStart; i <= trendEnd; i++) {
        if (i < analyticsData.length) {
          const ba = analyticsData[i];
          if (ba.valid) {
            trendBuy += ba.totalBuy;
            trendSell += ba.totalSell;
            sumUpperPin += ba.avgUpperPin;
            sumLowerPin += ba.avgLowerPin;
            sumBody += ba.avgBody;
            if (i === trendEnd) {
              firstBlockUpperPin = ba.avgUpperPin;
              firstBlockLowerPin = ba.avgLowerPin;
              firstBlockBody = ba.avgBody;
              firstBlockVol = ba.totalBuy + ba.totalSell;
            }
            if (i === trendStart) {
              lastBlockUpperPin = ba.avgUpperPin;
              lastBlockLowerPin = ba.avgLowerPin;
              lastBlockBody = ba.avgBody;
              lastBlockVol = ba.totalBuy + ba.totalSell;
            }
          }
        }
      }
    }
    const trendDelta = trendBuy - trendSell;
    const trendDeltaPct = gt(trendBuy + trendSell, 0) ? (trendDelta / (trendBuy + trendSell)) * 100 : 0.0;
    const avgUpperPin = trendBlocks > 0 ? sumUpperPin / trendBlocks : NaN;
    const avgLowerPin = trendBlocks > 0 ? sumLowerPin / trendBlocks : NaN;
    const avgBody = trendBlocks > 0 ? sumBody / trendBlocks : NaN;
    const upperPinChg = !na(firstBlockUpperPin) && !na(lastBlockUpperPin) && !eq(firstBlockUpperPin, 0)
      ? ((lastBlockUpperPin - firstBlockUpperPin) / firstBlockUpperPin) * 100 : 0.0;
    const lowerPinChg = !na(firstBlockLowerPin) && !na(lastBlockLowerPin) && !eq(firstBlockLowerPin, 0)
      ? ((lastBlockLowerPin - firstBlockLowerPin) / firstBlockLowerPin) * 100 : 0.0;
    const bodyStatus = !na(firstBlockBody) && !na(lastBlockBody)
      ? (gt(lastBlockBody, firstBlockBody) ? 'EXPANDING' : lt(lastBlockBody, firstBlockBody) ? 'CONTRACTING' : 'STABLE') : '-';
    const volMom = !na(firstBlockVol) && !na(lastBlockVol) ? (gt(lastBlockVol, firstBlockVol) ? 'INCREASING ▲' : 'DECREASING ▼') : '-';

    const currentPrice = get(C, baseOff);
    const projLenCh = trendValid && cfg.trendProject ? groupSize + 2 : 0;
    let resistPrice = NaN, supportPrice = NaN;
    if (trendValid) {
      const upperSpanCh = latestTrend.upperX2 - latestTrend.upperX1;
      const lowerSpanCh = latestTrend.lowerX2 - latestTrend.lowerX1;
      const upperSlopeCh = upperSpanCh !== 0 ? (latestTrend.upperY2 - latestTrend.upperY1) / upperSpanCh : 0.0;
      const lowerSlopeCh = lowerSpanCh !== 0 ? (latestTrend.lowerY2 - latestTrend.lowerY1) / lowerSpanCh : 0.0;
      resistPrice = latestTrend.upperY2 + (upperSlopeCh * projLenCh);
      supportPrice = latestTrend.lowerY2 + (lowerSlopeCh * projLenCh);
    }
    const resistDiff = !na(resistPrice) ? resistPrice - currentPrice : NaN;
    const supportDiff = !na(supportPrice) ? currentPrice - supportPrice : NaN;
    const resistPct = !na(resistDiff) && !eq(currentPrice, 0) ? (resistDiff / currentPrice) * 100 : NaN;
    const supportPct = !na(supportDiff) && !eq(currentPrice, 0) ? (supportDiff / currentPrice) * 100 : NaN;
    const channelWidth = !na(resistPrice) && !na(supportPrice) ? resistPrice - supportPrice : NaN;
    const rrRatio = !na(resistDiff) && !na(supportDiff) && !eq(supportDiff, 0) ? resistDiff / supportDiff : NaN;
    const channelPos = !na(channelWidth) && !eq(channelWidth, 0) ? ((currentPrice - supportPrice) / channelWidth) * 100 : NaN;
    const posStatus = !na(channelPos) ? (gt(channelPos, 70) ? 'OVERBOUGHT' : lt(channelPos, 30) ? 'OVERSOLD' : 'NEUTRAL') : '-';

    // Quality score
    let quality = 50.0;
    let contradictions = 0;
    if (trendValid) {
      const absAngle = Math.abs(latestTrend.angleDeg);
      const angleRange = 45.0 - cfg.rangeAngleThreshold;
      quality += gt(angleRange, 0.0) ? 15.0 * Math.max(0.0, Math.min(1.0, (absAngle - cfg.rangeAngleThreshold) / angleRange)) : 0.0;
      let totalPairs = 0, consistentPairs = 0;
      for (let i = latestTrend.startBlock - 1; i <= latestTrend.endBlock - 1; i++) {
        if (i < analyticsData.length && i + 1 < analyticsData.length) {
          const d1 = analyticsData[i].delta;
          const d2 = analyticsData[i + 1].delta;
          if (!na(d1) && !na(d2)) {
            totalPairs += 1;
            if (math.sign(d1) === math.sign(d2)) consistentPairs += 1;
          }
        }
      }
      const deltaConsistent = totalPairs > 0 && consistentPairs === totalPairs;
      quality += 10.0 * (totalPairs > 0 ? consistentPairs / totalPairs : 0.0);
      if (!na(firstBlockVol) && !na(lastBlockVol) && gt(firstBlockVol, 0.0)) {
        const volGrowth = (lastBlockVol - firstBlockVol) / firstBlockVol;
        quality += 10.0 * Math.max(0.0, Math.min(1.0, volGrowth / 0.5));
      }
      if (!na(firstBlockBody) && !na(lastBlockBody) && gt(firstBlockBody, 0.0)) {
        const bodyGrowth = (lastBlockBody - firstBlockBody) / firstBlockBody;
        quality += 10.0 * Math.max(0.0, Math.min(1.0, bodyGrowth / 0.5));
      }
      const up0 = na(avgUpperPin) ? 0.0 : avgUpperPin;
      const lo0 = na(avgLowerPin) ? 0.0 : avgLowerPin;
      const pinTotal = up0 + lo0;
      let pinScore = 0.0;
      if (gt(pinTotal, 0.0)) {
        if (latestTrend.channelType === DIR_UP) pinScore = 8.0 * Math.max(0.0, Math.min(1.0, (lo0 / pinTotal - 0.5) / 0.3));
        else if (latestTrend.channelType === DIR_DOWN) pinScore = 8.0 * Math.max(0.0, Math.min(1.0, (up0 / pinTotal - 0.5) / 0.3));
      }
      const pinAligned = gt(pinScore, 4.0);
      quality += pinScore;
      if ((latestTrend.channelType === DIR_UP && lt(trendDelta, 0)) || (latestTrend.channelType === DIR_DOWN && gt(trendDelta, 0))) {
        contradictions += 1;
      }
      if (latestTrend.channelType === DIR_UP && !na(firstBlockVol) && !na(lastBlockVol) && lt(lastBlockVol, firstBlockVol)) {
        contradictions += 1;
      }
      quality -= contradictions * 5.0;
      if (deltaConsistent && pinAligned && contradictions === 0) quality += 5.0;
    }
    quality = Math.max(0, Math.min(100, quality));
    const confidenceLevel = !lt(quality, 80) ? 'HIGH' : !lt(quality, 60) ? 'MEDIUM' : 'LOW';
    const absAng = trendValid ? Math.abs(latestTrend.angleDeg) : NaN;
    const strengthRating = trendValid
      ? (gt(absAng, 45) ? 'VERY STRONG' : gt(absAng, 30) ? 'STRONG' : gt(absAng, 15) ? 'MODERATE' : 'WEAK') : '-';

    const trendPrimaryCol = trendValid
      ? (latestTrend.channelType === DIR_UP ? color.rgb(16, 185, 129) : latestTrend.channelType === DIR_DOWN ? color.rgb(239, 68, 68) : color.rgb(100, 116, 139))
      : color.rgb(100, 116, 139);
    const trendAccentCol = trendValid
      ? (latestTrend.channelType === DIR_UP ? color.rgb(52, 211, 153) : latestTrend.channelType === DIR_DOWN ? color.rgb(248, 113, 113) : color.rgb(148, 163, 184))
      : color.rgb(148, 163, 184);
    const qualityCol = !lt(quality, 80) ? color.rgb(34, 197, 94) : !lt(quality, 60) ? color.rgb(234, 179, 8) : color.rgb(239, 68, 68);

    const hdrBg = String(color.new(color.rgb(30, 41, 59), 5));
    const rowBg1 = String(color.new(color.rgb(51, 65, 85), 15));
    const rowBg2 = String(color.new(color.rgb(71, 85, 105), 20));
    const txtHdr = color.rgb(248, 250, 252);
    const txtLbl = color.rgb(148, 163, 184);
    const txtVal = color.rgb(226, 232, 240);
    const posCol = color.rgb(34, 197, 94);
    const negCol = color.rgb(239, 68, 68);
    const accentCol = color.rgb(59, 130, 246);

    const cBuy = get(vBuy, baseOff);
    const cSell = get(vSell, baseOff);
    const cTot = cBuy + cSell;
    const cDel = cBuy - cSell;
    const delCol = na(cDel) ? txtVal : (!lt(cDel, 0) ? posCol : negCol);
    const alignL = lang === 'العربية' ? 'right' : 'left';
    const fmtVol = (v: number) => (na(v) ? '-' : str.tostring(v, 'volume'));
    const fmtPrice = (v: number) => (na(v) ? '-' : fmtMintick(v));
    const f2 = (v: number) => str.tostring(v, '#.##');

    type Align = 'left' | 'center' | 'right';
    const cell = (c: number, r: number, text: string, textColor: string, bg: string, align: Align, tooltip?: string) =>
      table.cell(dashT, c, r, text, 0, 0, textColor, align, undefined, TS, bg, tooltip);
    const merge = (c0: number, r0: number, c1: number, r1: number) => table.merge_cells(dashT, c0, r0, c1, r1);

    const dashBuy = tl('▲ Buy', '▲ Alım', '▲ खरीद', '▲ شراء');
    const dashSell = tl('▼ Sell', '▼ Satış', '▼ बिक्री', '▼ بيع');
    const dashDelta = tl('Delta', 'Delta', 'डेल्टा', 'الدلتا');
    const engTxt = isIntrabar
      ? `${tl('(Intrabar • LTF:', '(Intrabar • LTF:', '(इंट्राबार • LTF:', '(داخل الشمعة • LTF:')} ${ltf})`
      : tl('(Geometric)', '(Geometrik)', '(ज्यामितीय)', '(هندسي)');

    // Row 0: header
    merge(0, 0, 3, 0);
    cell(0, 0, tl('VOLUME ENGINE', 'HACİM MOTORU', 'वॉल्यूम इंजन', 'محرك الحجم'), txtHdr, hdrBg, 'center',
      tl('Real-time volume calculation engine', 'Gerçek zamanlı hacim hesaplama motoru', 'वास्तविक समय वॉल्यूम गणना इंजन', 'محرك حساب الحجم في الوقت الفعلي'));
    // Row 1: engine
    cell(0, 1, tl('Engine:', 'Motor:', 'इंजन:', 'المحرك:'), txtLbl, rowBg1, 'right',
      tl('Volume calculation method', 'Hacim hesaplama yöntemi', 'वॉल्यूम गणना विधि', 'طريقة حساب الحجم'));
    cell(1, 1, engTxt, accentCol, rowBg1, alignL,
      tl('Intrabar: precise LTF data | Geometric: approximation', 'Intrabar: kesin LTF verisi | Geometrik: yaklaşık', 'इंट्राबार: सटीक LTF डेटा | ज्यामितीय: अनुमान', 'داخل الشمعة: بيانات LTF دقيقة | هندسي: تقريبي'));
    cell(2, 1, tl('Data:', 'Veri:', 'डेटा:', 'البيانات:'), txtLbl, rowBg1, 'right',
      tl('Available historical bars', 'Mevcut geçmiş barlar', 'उपलब्ध ऐतिहासिक बार', 'الشموع التاريخية المتاحة'));
    cell(3, 1, `${str.tostring(scannableBars)} ${tl('bar', 'bar', 'बार', 'شمعة')}`, txtVal, rowBg1, alignL,
      tl('Total scannable bars with valid volume data', 'Geçerli hacim verisi olan toplam taranabilir barlar', 'मान्य वॉल्यूम डेटा वाले कुल स्कैन करने योग्य बार', 'إجمالي الشموع القابلة للمسح ببيانات حجم صالحة'));
    // Row 2: candle header
    merge(0, 2, 3, 2);
    const candleHeader = baseOff === 0
      ? tl('CURRENT CANDLE • VOLUMETRIC', 'MEVCUT MUM • HACİMSEL', 'वर्तमान कैंडल • वॉल्यूमेट्रिक', 'الشمعة الحالية • حجمي')
      : tl('CLOSED CANDLE • VOLUMETRIC', 'KAPALI MUM • HACİMSEL', 'बंद कैंडल • वॉल्यूमेट्रिक', 'الشمعة المغلقة • حجمي');
    const candleTooltip = tl('Most recent ', 'En son ', 'सबसे हाल का ', 'أحدث ')
      + (baseOff === 0 ? tl('live', 'canlı', 'लाइव', 'مباشرة') : tl('closed', 'kapalı', 'बंद', 'مغلقة'))
      + tl(' candle analysis', ' mum analizi', ' कैंडल विश्लेषण', ' تحليل الشمعة');
    cell(0, 2, candleHeader, txtHdr, hdrBg, 'center', candleTooltip);
    // Row 3: buy / sell
    cell(0, 3, dashBuy, posCol, rowBg1, 'right',
      tl('Buying volume (aggressive buyers)', 'Alım hacmi (agresif alıcılar)', 'खरीद वॉल्यूम (आक्रामक खरीदार)', 'حجم الشراء (مشترون عدوانيون)'));
    cell(1, 3, fmtVol(cBuy), posCol, rowBg1, alignL);
    cell(2, 3, dashSell, negCol, rowBg1, 'right',
      tl('Selling volume (aggressive sellers)', 'Satış hacmi (agresif satıcılar)', 'बिक्री वॉल्यूम (आक्रामक विक्रेता)', 'حجم البيع (بائعون عدوانيون)'));
    cell(3, 3, fmtVol(cSell), negCol, rowBg1, alignL);
    // Row 4: total / delta
    cell(0, 4, tl('◆ Total', '◆ Toplam', '◆ कुल', '◆ الإجمالي'), txtLbl, rowBg2, 'right',
      tl('Total volume (buy + sell)', 'Toplam hacim (alım + satış)', 'कुल वॉल्यूम (खरीद + बिक्री)', 'الحجم الإجمالي (شراء + بيع)'));
    cell(1, 4, fmtVol(cTot), txtVal, rowBg2, alignL);
    const deltaIcon = na(cDel) ? '●' : (!lt(cDel, 0) ? '▲' : '▼');
    const deltaSign = na(cDel) ? '' : (gt(cDel, 0) ? '+' : '');
    cell(2, 4, `${deltaIcon} ${dashDelta}`, delCol, rowBg2, 'right',
      tl('Net delta (buy - sell)', 'Net delta (alım - satış)', 'शुद्ध डेल्टा (खरीद - बिक्री)', 'صافي الدلتا (شراء - بيع)'));
    cell(3, 4, deltaSign + fmtVol(cDel), delCol, rowBg2, alignL);
    // Row 5: trend volumetrics header
    merge(0, 5, 3, 5);
    const trendVolumetrics = tl('TREND VOLUMETRICS', 'TREND HACİMSEL', 'रुझान वॉल्यूमेट्रिक', 'حجم الاتجاه');
    const trendTitle = trendValid
      ? `${trendVolumetrics} • ${tl('Blk', 'Blk', 'ब्लॉक', 'كتلة')} ${str.tostring(latestTrend.startBlock)}-${str.tostring(latestTrend.endBlock)}`
      : `${trendVolumetrics} • N/A`;
    cell(0, 5, trendTitle, txtHdr, hdrBg, 'center',
      tl('Aggregated volume data across latest active trend', 'En son aktif trend boyunca toplanan hacim verisi', 'नवीनतम सक्रिय रुझान में एकत्रित वॉल्यूम डेटा', 'بيانات الحجم المجمّعة عبر أحدث اتجاه نشط'));
    // Rows 6-7: trend buy / sell / delta / type
    const trendDeltaCol = !lt(trendDelta, 0) ? posCol : negCol;
    cell(0, 6, dashBuy, posCol, rowBg1, 'center',
      tl('Total buy volume across trend blocks', 'Trend blokları boyunca toplam alım hacmi', 'रुझान ब्लॉकों में कुल खरीद वॉल्यूम', 'إجمالي حجم الشراء عبر كتل الاتجاه'));
    cell(1, 6, dashSell, negCol, rowBg1, 'center',
      tl('Total sell volume across trend blocks', 'Trend blokları boyunca toplam satış hacmi', 'रुझान ब्लॉकों में कुल बिक्री वॉल्यूम', 'إجمالي حجم البيع عبر كتل الاتجاه'));
    cell(2, 6, `◆ ${dashDelta}`, trendDeltaCol, rowBg1, 'center',
      tl('Net delta with percentage', 'Yüzde ile net delta', 'प्रतिशत के साथ शुद्ध डेल्टा', 'صافي الدلتا مع النسبة المئوية'));
    cell(3, 6, tl('Type', 'Tür', 'प्रकार', 'النوع'), txtLbl, rowBg1, 'center',
      tl('Trend direction classification', 'Trend yönü sınıflandırması', 'रुझान दिशा वर्गीकरण', 'تصنيف اتجاه الترند'));
    cell(0, 7, fmtVol(trendBuy), posCol, rowBg2, 'center');
    cell(1, 7, fmtVol(trendSell), negCol, rowBg2, 'center');
    cell(2, 7, `${gt(trendDelta, 0) ? '+' : ''}${fmtVol(trendDelta)} (${f2(trendDeltaPct)}%)`, trendDeltaCol, rowBg2, 'center');
    const trendTypeName = trendValid
      ? (latestTrend.channelType === DIR_UP ? tl('UPTREND', 'YÜKSELİŞ', 'तेजी', 'صاعد')
        : latestTrend.channelType === DIR_DOWN ? tl('DOWNTREND', 'DÜŞÜŞ', 'मंदी', 'هابط') : tl('RANGE', 'YATAY', 'दायरा', 'عرضي'))
      : '-';
    cell(3, 7, trendTypeName, trendPrimaryCol, rowBg2, 'center');
    // Row 8: pressure & momentum header
    merge(0, 8, 3, 8);
    cell(0, 8, tl('PRESSURE & MOMENTUM', 'BASKI & MOMENTUM', 'दबाव और गति', 'الضغط والزخم'), txtHdr, hdrBg, 'center',
      tl('Pin rejection pressure and volume momentum analysis', 'Pin reddetme baskısı ve hacim momentum analizi', 'पिन अस्वीकृति दबाव और वॉल्यूम गति विश्लेषण', 'تحليل ضغط رفض الفتيل وزخم الحجم'));
    // Rows 9-10: pins and bodies
    cell(0, 9, tl('▲ Sellers', '▲ Satıcılar', '▲ विक्रेता', '▲ البائعون'), negCol, rowBg1, 'center',
      tl('Average upper pin (seller rejection)', 'Ortalama üst pin (satıcı reddi)', 'औसत ऊपरी पिन (विक्रेता अस्वीकृति)', 'متوسط الفتيل العلوي (رفض البائعين)'));
    cell(1, 9, tl('▼ Buyers', '▼ Alıcılar', '▼ खरीदार', '▼ المشترون'), posCol, rowBg1, 'center',
      tl('Average lower pin (buyer rejection)', 'Ortalama alt pin (alıcı reddi)', 'औसत निचली पिन (खरीदार अस्वीकृति)', 'متوسط الفتيل السفلي (رفض المشترين)'));
    cell(2, 9, tl('Body AVG', 'Gövde ORT', 'बॉडी औसत', 'متوسط الجسم'), txtLbl, rowBg1, 'center',
      tl('Average candle body size', 'Ortalama mum gövdesi boyutu', 'औसत कैंडल बॉडी आकार', 'متوسط حجم جسم الشمعة'));
    cell(3, 9, tl('Trend', 'Trend', 'रुझान', 'الاتجاه'), txtLbl, rowBg1, 'center',
      tl('Body expansion status', 'Gövde genişleme durumu', 'बॉडी विस्तार स्थिति', 'حالة توسّع الجسم'));
    cell(0, 10, `${fmtPrice(avgUpperPin)} (${f2(upperPinChg)}%)`, negCol, rowBg2, 'center');
    cell(1, 10, `${fmtPrice(avgLowerPin)} (${f2(lowerPinChg)}%)`, posCol, rowBg2, 'center');
    cell(2, 10, fmtPrice(avgBody), txtVal, rowBg2, 'center');
    const bodyStatusLoc = bodyStatus === 'EXPANDING' ? tl('EXPANDING', 'GENİŞLEYEN', 'विस्तारित', 'متوسع')
      : bodyStatus === 'CONTRACTING' ? tl('CONTRACTING', 'DARALAN', 'संकुचित', 'متقلص') : tl('STABLE', 'STABLE', 'स्थिर', 'مستقر');
    const bodyStatusCol = bodyStatus === 'EXPANDING' ? posCol : bodyStatus === 'CONTRACTING' ? negCol : txtLbl;
    cell(3, 10, bodyStatusLoc, bodyStatusCol, rowBg2, 'center');
    // Row 11: channel boundaries header
    merge(0, 11, 3, 11);
    cell(0, 11, tl('TREND CHANNEL BOUNDARIES', 'TREND KANAL SINIRLARI', 'रुझान चैनल सीमाएं', 'حدود قناة الاتجاه'), txtHdr, hdrBg, 'center',
      tl('Upper/Lower trend-channel boundaries (display-aligned)', 'Üst/Alt trend-kanal sınırları (görüntüye hizalı)', 'ऊपरी/निचली रुझान-चैनल सीमाएं (प्रदर्शन-संरेखित)', 'الحدود العليا/السفلى لقناة الاتجاه (محاذاة العرض)'));
    // Row 12: upper / lower
    const upDiffSign = !na(resistDiff) && gt(resistDiff, 0) ? '+' : '';
    const upPctSign = !na(resistPct) && gt(resistPct, 0) ? '+' : '';
    const upperStr = trendValid
      ? `${tl('▲ Upper Channel @', '▲ Üst Kanal @', '▲ ऊपरी चैनल @', '▲ القناة العليا @')} ${fmtPrice(resistPrice)} (Δ ${upDiffSign}${f2(resistDiff)} | ${upPctSign}${f2(resistPct)}%)`
      : '-';
    const lowerStr = trendValid
      ? `${tl('▼ Lower Channel @', '▼ Alt Kanal @', '▼ निचला चैनल @', '▼ القناة السفلى @')} ${fmtPrice(supportPrice)} (Δ -${f2(supportDiff)} | -${f2(supportPct)}%)`
      : '-';
    merge(0, 12, 1, 12);
    cell(0, 12, upperStr, txtVal, rowBg1, 'center',
      tl('Upper channel boundary | Δ vs current price', 'Üst kanal sınırı | Mevcut fiyat karşısında Δ', 'ऊपरी चैनल सीमा | वर्तमान मूल्य बनाम Δ', 'حد القناة العليا | Δ مقابل السعر الحالي'));
    merge(2, 12, 3, 12);
    cell(2, 12, lowerStr, txtVal, rowBg1, 'center',
      tl('Lower channel boundary | Δ vs current price', 'Alt kanal sınırı | Mevcut fiyat karşısında Δ', 'निचली चैनल सीमा | वर्तमान मूल्य बनाम Δ', 'حد القناة السفلى | Δ مقابل السعر الحالي'));
    // Row 13: width / position / R:R / status
    const posStatusLoc = posStatus === 'OVERBOUGHT' ? tl('OVERBOUGHT', 'AŞIRI ALIM', 'अधिक खरीद', 'تشبّع شرائي')
      : posStatus === 'OVERSOLD' ? tl('OVERSOLD', 'AŞIRI SATIM', 'अधिक बिक्री', 'تشبّع بيعي') : tl('NEUTRAL', 'NÖTR', 'तटस्थ', 'محايد');
    const statusCol = posStatus === 'OVERBOUGHT' ? negCol : posStatus === 'OVERSOLD' ? posCol : txtLbl;
    cell(0, 13, trendValid ? fmtPrice(channelWidth) : '-', accentCol, rowBg2, 'center',
      tl('Channel width (upper - lower)', 'Kanal genişliği (üst - alt)', 'चैनल चौड़ाई (ऊपरी - निचली)', 'عرض القناة (العليا - السفلى)'));
    cell(1, 13, !na(channelPos) ? `${f2(channelPos)}%` : '-', txtVal, rowBg2, 'center',
      tl('Price position within channel (0%=lower, 100%=upper)', 'Kanal içinde fiyat pozisyonu (0%=alt, 100%=üst)', 'चैनल के भीतर मूल्य स्थिति (0%=निचला, 100%=ऊपरी)', 'موقع السعر داخل القناة (0%=السفلى، 100%=العليا)'));
    cell(2, 13, !na(rrRatio) ? `1:${f2(rrRatio)}` : '-', txtVal, rowBg2, 'center',
      tl('Risk/Reward ratio (distance to upper : distance to lower)', 'Risk/Ödül oranı (üste mesafe : alta mesafe)', 'जोखिम/इनाम अनुपात (ऊपर की दूरी : नीचे की दूरी)', 'نسبة المخاطرة/العائد (المسافة للعليا : المسافة للسفلى)'));
    cell(3, 13, posStatusLoc, statusCol, rowBg2, 'center',
      tl('Position status within channel', 'Kanal içinde pozisyon durumu', 'चैनल के भीतर स्थिति स्थिति', 'حالة الموقع داخل القناة'));
    // Row 14: trend intelligence header
    const q0 = str.tostring(quality, '#');
    const qc = str.tostring(contradictions);
    const qualityTooltip = tl(
      `Trend quality: Score: ${q0}/100 | Angle(15) + Delta(10) + Volume(10) + Body(10) + Pins(8) - Conflicts(${qc})`,
      `Trend kalitesi: Puan: ${q0}/100 | Açı(15) + Delta(10) + Hacim(10) + Gövde(10) + Pinler(8) - Çatışmalar(${qc})`,
      `रुझान गुणवत्ता: स्कोर: ${q0}/100 | कोण(15) + डेल्टा(10) + वॉल्यूम(10) + बॉडी(10) + पिन(8) - संघर्ष(${qc})`,
      `جودة الاتجاه: النقاط: ${q0}/100 | الزاوية(15) + الدلتا(10) + الحجم(10) + الجسم(10) + الفتيل(8) - التناقضات(${qc})`);
    merge(0, 14, 3, 14);
    cell(0, 14, tl('TREND INTELLIGENCE', 'TREND ZEKASI', 'रुझान बुद्धि', 'ذكاء الاتجاه'), txtHdr, hdrBg, 'center', qualityTooltip);
    // Row 15: quality / confidence / strength / momentum
    const confidenceLoc = confidenceLevel === 'HIGH' ? tl('HIGH', 'YÜKSEK', 'उच्च', 'مرتفع')
      : confidenceLevel === 'MEDIUM' ? tl('MEDIUM', 'ORTA', 'मध्यम', 'متوسط') : tl('LOW', 'DÜŞÜK', 'निम्न', 'منخفض');
    const strengthLoc = strengthRating === 'VERY STRONG' ? tl('VERY STRONG', 'ÇOK GÜÇLÜ', 'बहुत मजबूत', 'قوي جداً')
      : strengthRating === 'STRONG' ? tl('STRONG', 'GÜÇLÜ', 'मजबूत', 'قوي')
        : strengthRating === 'MODERATE' ? tl('MODERATE', 'ORTA', 'मध्यम', 'متوسط')
          : strengthRating === 'WEAK' ? tl('WEAK', 'ZAYIF', 'कमजोर', 'ضعيف') : '-';
    const volInc = volMom.includes('INCREASING');
    cell(0, 15, `${q0}/100`, qualityCol, rowBg1, 'center', qualityTooltip);
    cell(1, 15, confidenceLoc, qualityCol, rowBg1, 'center',
      tl('Confidence level based on quality score', 'Kalite puanına dayalı güven seviyesi', 'गुणवत्ता स्कोर के आधार पर विश्वास स्तर', 'مستوى الثقة بناءً على نقاط الجودة'));
    cell(2, 15, strengthLoc, trendAccentCol, rowBg1, 'center',
      tl('Trend strength based on angle steepness', 'Açı dikliğine dayalı trend gücü', 'कोण तीव्रता के आधार पर रुझान शक्ति', 'قوة الاتجاه بناءً على حدّة الزاوية'));
    cell(3, 15, volInc ? tl('INCREASING ▲', 'ARTIYOR ▲', 'बढ़ रहा है ▲', 'متزايد ▲') : tl('DECREASING ▼', 'AZALIYOR ▼', 'घट रहा है ▼', 'متناقص ▼'),
      volInc ? posCol : negCol, rowBg1, 'center',
      tl('Volume momentum direction across blocks', 'Bloklar boyunca hacim momentum yönü', 'ब्लॉकों में वॉल्यूम गति दिशा', 'اتجاه زخم الحجم عبر الكتل'));

    // ── Market narrative ──
    if (!(cfg.narrativeEnable && trendValid)) return;
    const cBar = analyzeCurrentBar(cBuy, cSell);
    const comp = analyzeComposite(
      analyticsData.length > 0 ? analyticsData[0] : analyticsEmpty(),
      analyticsData.length > 1 ? analyticsData[1] : analyticsEmpty());
    const ctx: TrendContext = { currentType: latestTrend.channelType, qualityScore: quality };
    const hasDivergence = (latestTrend.channelType === DIR_UP && lt(trendDelta, 0))
      || (latestTrend.channelType === DIR_DOWN && gt(trendDelta, 0));
    const parts = buildNarrativeParts(cBar, comp, ctx, latestTrend, trendDelta, trendDeltaPct, bodyStatus,
      upperPinChg, lowerPinChg, volMom, channelPos, posStatus, resistPrice, supportPrice, contradictions, hasDivergence);

    const narrHdrBg = String(color.new(color.rgb(15, 23, 42), 5));
    const narrRowBg = String(color.new(color.rgb(30, 41, 59), 10));
    const narrTxtHdr = color.rgb(234, 179, 8);
    const narrTxtMain = color.rgb(248, 250, 252);
    const narrTxtSub = color.rgb(148, 163, 184);
    merge(0, 16, 3, 16);
    cell(0, 16, tl('Market Analysis', 'Piyasa Analizi', 'बाजार विश्लेषण', 'تحليل السوق'), narrTxtHdr, narrHdrBg, 'center');
    const firstNarrRow = 17;
    const narrLines: string[] = [];
    for (const p of parts) narrLines.push(...wrapNarrative(p, 18, 90));
    const totalLines = narrLines.length;
    const rowsNeeded = Math.min(totalLines, 50 - firstNarrRow - (cfg.narrativeShowDisclaimer ? 3 : 0));
    for (let r = 0; r < rowsNeeded; r++) {
      const row = firstNarrRow + r;
      merge(0, row, 3, row);
      let txt = narrLines[r];
      if (r === rowsNeeded - 1 && totalLines > rowsNeeded) txt += ' …';
      cell(0, row, txt, narrTxtMain, narrRowBg, alignL);
    }
    if (cfg.narrativeShowDisclaimer) {
      const start = firstNarrRow + Math.max(rowsNeeded, 0);
      const lines = [
        tl('⚠️ IMPORTANT: This analysis is for educational purposes only',
          '⚠️ ÖNEMLİ: Bu analiz sadece eğitim amaçlıdır',
          '⚠️ महत्वपूर्ण: यह विश्लेषण केवल शैक्षिक उद्देश्यों के लिए है',
          '⚠️ هام: هذا التحليل لأغراض تعليمية فقط'),
        tl('and does not constitute investment advice. Always conduct your own research',
          've yatırım tavsiyesi teşkil etmez. Her zaman kendi araştırmanızı yapın',
          'और निवेश सलाह नहीं है। हमेशा अपना शोध करें',
          'ولا يُشكّل نصيحة استثمارية. قم دائماً بإجراء بحثك الخاص'),
        tl('and consult with a qualified financial advisor before making investment decisions.',
          've yatırım kararları vermeden önce kalifiye bir finansal danışmana danışın.',
          'और निवेश निर्णय लेने से पहले योग्य वित्तीय सलाहकार से परामर्श करें।',
          'واستشر مستشاراً مالياً مؤهلاً قبل اتخاذ قرارات الاستثمار.'),
      ];
      const discBg = String(color.new(color.rgb(30, 30, 30), 10));
      for (let k = 0; k <= 2; k++) {
        merge(0, start + k, 3, start + k);
        cell(0, start + k, lines[k], narrTxtSub, discBg, 'center');
      }
    }
  }

  // Candle pattern of a bar or a composite candle from its body / wick ratios (0-100)
  function classifyCandlePattern(bodyR: number, upperR: number, lowerR: number): string {
    if (lt(bodyR, 10.0)) {
      if (gt(lowerR, 65.0) && lt(upperR, 15.0)) return 'DRAGONFLY';
      if (gt(upperR, 65.0) && lt(lowerR, 15.0)) return 'GRAVESTONE';
      return 'DOJI';
    }
    if (lt(bodyR, 35.0) && lt(Math.abs(upperR - lowerR), 20.0)) return 'SPINNING_TOP';
    if (gt(bodyR, 80.0)) return 'MARUBOZU';
    if (lt(bodyR, 40.0)) {
      if (gt(lowerR, 55.0) && lt(upperR, 20.0)) return 'HAMMER';
      if (gt(upperR, 55.0) && lt(lowerR, 20.0)) return 'INV_HAMMER';
      if (gt(upperR, 45.0)) return 'LONG_UPPER';
      if (gt(lowerR, 45.0)) return 'LONG_LOWER';
      return 'STANDARD';
    }
    return 'STANDARD';
  }

  function analyzeCurrentBar(buyV: number, sellV: number): CurrentBarAnalysis {
    const off = baseOff;
    const h = get(H, off), l = get(Lo, off), o = get(O, off), c = get(C, off);
    const barRange = h - l;
    const bodySize = Math.abs(c - o);
    const upperWick = h - Math.max(o, c);
    const lowerWick = Math.min(o, c) - l;
    const bodyR = gt(barRange, 0) ? (bodySize / barRange) * 100 : 0.0;
    const upperR = gt(barRange, 0) ? (upperWick / barRange) * 100 : 0.0;
    const lowerR = gt(barRange, 0) ? (lowerWick / barRange) * 100 : 0.0;
    const pattern = classifyCandlePattern(bodyR, upperR, lowerR);
    const ratio = gt(globalAvgRange, 0) ? barRange / globalAvgRange : 1.0;
    const rangeStatus = gt(ratio, 1.5) ? 'WIDE' : lt(ratio, 0.6) ? 'NARROW' : 'NORMAL';
    const total = buyV + sellV;
    let pressureStatus: string;
    if (eq(total, 0)) {
      pressureStatus = 'BALANCED';
    } else {
      const buyPct = buyV / total * 100;
      pressureStatus = gt(buyPct, 55) ? 'BUYING' : lt(buyPct, 45) ? 'SELLING' : 'BALANCED';
    }
    return { pattern, rangeStatus, delta: buyV - sellV, pressureStatus };
  }

  function analyzeComposite(blk1: BlockAnalytics, blk2: BlockAnalytics): CompositeAnalysis {
    const result: CompositeAnalysis = { blockRelation: '' };
    if (blk1.valid) {
      if (blk2.valid) {
        const b1High = blk1.newHigh, b1Low = blk1.newLow;
        const b2High = blk2.newHigh, b2Low = blk2.newLow;
        const b1Body = Math.abs(blk1.newClose - blk1.newOpen);
        const b2Body = Math.abs(blk2.newClose - blk2.newOpen);
        if (le(b1High, b2High) && le(b2Low, b1Low)) result.blockRelation = 'INSIDE';
        else if (gt(b1High, b2High) && lt(b1Low, b2Low)) result.blockRelation = 'OUTSIDE';
        else if (gt(b1Body, b2Body * 1.3)) result.blockRelation = 'ENGULFING';
        else result.blockRelation = 'NORMAL';
      } else {
        result.blockRelation = 'NORMAL';
      }
    }
    return result;
  }

  function wrapNarrative(txt: string, maxWords: number, maxChars: number): string[] {
    const lines: string[] = [];
    const words = str.split(txt, ' ');
    let ln = '';
    let wcnt = 0;
    for (const w of words) {
      if (w.length === 0) continue;
      const cand = wcnt === 0 ? w : `${ln} ${w}`;
      const overflow = wcnt >= maxWords || cand.length > maxChars;
      if (overflow && wcnt > 0) {
        lines.push(ln);
        ln = w;
        wcnt = 1;
      } else {
        ln = cand;
        wcnt += 1;
      }
    }
    if (wcnt > 0) lines.push(ln);
    return lines;
  }

  function connect(key: string): string {
    switch (key) {
      case 'CURRENT_CANDLE': return tl('The current candle presents', 'Mevcut mum', 'वर्तमान कैंडल', 'الشمعة الحالية تُظهر');
      case 'WITH_RANGE': return tl('with', 'ile', 'के साथ', 'مع');
      case 'SHOWING': return tl('showing', 'gösteriyor', 'दिखा रहा है', 'تُظهر');
      case 'BROADER_CONTEXT': return tl('In the broader timeframe, the market is in', 'Daha geniş zaman diliminde piyasa', 'व्यापक समय सीमा में बाजार', 'في الإطار الزمني الأوسع، السوق في');
      case 'WITH_STRENGTH': return tl('with', 'ile', 'के साथ', 'بقوة');
      case 'AND_QUALITY': return tl('and quality', 've kalite', 'और गुणवत्ता', 'وجودة');
      case 'STRUCTURE_SHOWS': return tl('The price structure shows', 'Fiyat yapısı gösteriyor', 'मूल्य संरचना दिखाती है', 'هيكل السعر يُظهر');
      case 'CURRENT_BLOCK': return tl('The current block', 'Mevcut blok', 'वर्तमान ब्लॉक', 'الكتلة الحالية');
      case 'HOWEVER': return tl('However', 'Ancak', 'हालांकि', 'ومع ذلك');
      case 'IMPORTANT_CONTRADICTION': return tl('an important contradiction exists', 'önemli bir çelişki var', 'एक महत्वपूर्ण विरोधाभास है', 'يوجد تناقض مهم');
      case 'WHILE_PRICE': return tl('while price moves', 'fiyat hareket ederken', 'जबकि मूल्य चलता है', 'بينما يتحرك السعر');
      case 'VOLUME_SHOWS': return tl('volume shows', 'hacim gösteriyor', 'वॉल्यूम दिखाता है', 'الحجم يُظهر');
      case 'DOMINANCE_WITH': return tl('dominance with', 'hakimiyet ile', 'के साथ प्रभुत्व', 'هيمنة بنسبة');
      case 'THIS_DIVERGENCE': return tl('This divergence between price direction and volume flow indicates',
        'Fiyat yönü ile hacim akışı arasındaki bu uyumsuzluk gösterir',
        'मूल्य दिशा और वॉल्यूम प्रवाह के बीच यह विचलन संकेत देता है',
        'هذا التباين بين اتجاه السعر وتدفق الحجم يُشير إلى');
      case 'CONFIRMS_TREND': return tl('Volume also confirms this trend', 'Hacim de bu trendi doğruluyor', 'वॉल्यूम भी इस रुझान की पुष्टि करता है', 'الحجم يؤكد هذا الاتجاه أيضاً');
      case 'VOLUME_MOMENTUM': return tl('Volume momentum is', 'Hacim momentumu', 'वॉल्यूम गति', 'زخم الحجم');
      case 'INDICATING': return tl('indicating', 'gösteriyor', 'संकेत दे रहा है', 'مما يُشير إلى');
      case 'CANDLE_BODIES': return tl('Candle bodies are', 'Mum gövdeleri', 'कैंडल बॉडी', 'أجسام الشموع');
      case 'UPPER_WICKS': return tl('Upper wicks have', 'Üst fitiller', 'ऊपरी बत्तियां', 'الفتائل العلوية');
      case 'BY_PERCENT': return tl('by', 'ile', 'द्वारा', 'بنسبة');
      case 'INDICATING_PRESSURE': return tl('indicating', 'göstererek', 'संकेत करते हुए', 'مما يدل على');
      case 'SELL_PRESSURE_ABOVE': return tl('selling pressure at higher levels', 'üst seviyelerde satış baskısı', 'उच्च स्तर पर बिक्री दबाव', 'ضغط بيعي عند المستويات العليا');
      case 'LOWER_WICKS': return tl('Lower wicks have', 'Alt fitiller', 'निचली बत्तियां', 'الفتائل السفلية');
      case 'BUY_SUPPORT': return tl('buying support strengthening', 'alım desteği güçleniyor', 'खरीद समर्थन मजबूत हो रहा', 'تعزّز دعم الشراء');
      case 'PRICE_POSITION': return tl('Price is positioned in', 'Fiyat konumlanmış', 'मूल्य स्थित है', 'السعر يتموضع في');
      case 'OF_CHANNEL': return tl('of the channel', 'kanalın', 'चैनल का', 'من القناة');
      case 'KEY_NOTE': return tl('Important note', 'Önemli not', 'महत्वपूर्ण नोट', 'ملاحظة مهمة');
      case 'NEAR_RESISTANCE': return tl('Price has approached the upper channel at', 'Fiyat üst kanal sınırına yaklaştı', 'मूल्य ऊपरी चैनल सीमा के करीब पहुंच गया है', 'السعر اقترب من حد القناة العليا عند');
      case 'NEAR_SUPPORT': return tl('Price has approached the lower channel at', 'Fiyat alt kanal sınırına yaklaştı', 'मूल्य निचली चैनल सीमा के करीब पहुंच गया है', 'السعر اقترب من حد القناة السفلى عند');
      case 'DISTANCE': return tl('distance', 'mesafe', 'दूरी', 'المسافة');
      case 'POC_LEVEL': return tl('Price is near POC level at', 'Fiyat POC seviyesine yakın', 'मूल्य POC स्तर के पास है', 'السعر قريب من مستوى POC عند');
      case 'HIGH_VOLUME_AREA': return tl('which typically has high trading volume', 'ki genellikle yüksek işlem hacmi vardır', 'जिसमें आमतौर पर उच्च ट्रेडिंग वॉल्यूम होता है', 'والتي عادةً تشهد حجم تداول مرتفع');
      case 'DISTANCE_TO_LEVELS': return tl('Distance to upper channel', 'Üst kanala mesafe', 'ऊपरी चैनल की दूरी', 'المسافة إلى القناة العليا');
      case 'TO_SUPPORT': return tl('to lower channel', 'alt kanala', 'निचले चैनल तक', 'إلى القناة السفلى');
      case 'OVERALL': return tl('Overall', 'Genel olarak', 'कुल मिलाकर', 'بشكل عام');
      case 'DESPITE': return tl('despite', 'rağmen', 'के बावजूद', 'على الرغم من');
      case 'CONTRADICTIONS': return tl('technical contradictions', 'teknik çelişkiler', 'तकनीकी विरोधाभास', 'تناقضات فنية');
      case 'PATTERN_MAINTAINS': return tl('the overall pattern maintains', 'genel yapı koruyor', 'समग्र पैटर्न बनाए रखता है', 'النمط العام يحافظ على');
      case 'UPTREND_CHAR': return tl('uptrend characteristics', 'yükseliş özelliklerini', 'तेजी की विशेषताएं', 'خصائص الاتجاه الصاعد');
      case 'DOWNTREND_CHAR': return tl('downtrend characteristics', 'düşüş özelliklerini', 'मंदी की विशेषताएं', 'خصائص الاتجاه الهابط');
      case 'CONSOLIDATION': return tl('a consolidation phase', 'konsolidasyon fazında', 'एक समेकन चरण में', 'مرحلة تجميع');
      case 'THESE_CONTRADICTIONS': return tl('but these contradictions suggest potential change in market behavior',
        'ancak bu çelişkiler piyasa davranışında potansiyel değişim gösteriyor',
        'लेकिन ये विरोधाभास बाजार व्यवहार में संभावित परिवर्तन का सुझाव देते हैं',
        'لكن هذه التناقضات تُشير إلى تغيّر محتمل في سلوك السوق');
      case 'ALL_ALIGNED': return tl('all technical and volume indicators are aligned confirming',
        'tüm teknik ve hacim göstergeleri uyumlu ve doğruluyor',
        'सभी तकनीकी और वॉल्यूम संकेतक संरेखित हैं और पुष्टि करते हैं',
        'جميع المؤشرات الفنية والحجمية متوافقة وتؤكد');
      case 'NO_CLEAR_DIR': return tl('and has not yet selected a clear direction',
        've henüz net bir yön seçmedi',
        'और अभी तक स्पष्ट दिशा नहीं चुनी है',
        'ولم يختر اتجاهاً واضحاً بعد');
      default: return '';
    }
  }

  function patternDesc(pattern: string): string {
    switch (pattern) {
      case 'DOJI': return tl('a doji indicating market indecision and uncertainty',
        'belirsizlik ve kararsızlığı gösteren bir doji',
        'एक डोजी जो बाजार में अनिश्चितता दर्शाता है',
        'دوجي يُشير إلى تردد السوق وعدم اليقين');
      case 'HAMMER': return tl('a hammer suggesting rejection at lower levels and potential bullish reversal',
        'alt seviyelerde reddedilme ve potansiyel yükseliş dönüşünü gösteren bir çekiç',
        'एक हैमर जो निचले स्तर पर अस्वीकृति और संभावित तेजी उलटफेर का सुझाव देता है',
        'مطرقة تُشير إلى رفض عند المستويات الدنيا واحتمال انعكاس صعودي');
      case 'INV_HAMMER': return tl('an inverted hammer', 'ters çekiç', 'एक उल्टा हैमर', 'مطرقة مقلوبة');
      case 'DRAGONFLY': return tl('a dragonfly doji showing strong rejection at lows and buying pressure',
        'güçlü alış baskısı ve dipte reddedilme gösteren yusufçuk doji',
        'एक ड्रैगनफ्लाई डोजी जो निम्न स्तर पर मजबूत अस्वीकृति दिखाता है',
        'دوجي اليعسوب يُظهر رفضاً قوياً عند القيعان وضغطاً شرائياً');
      case 'GRAVESTONE': return tl('a gravestone doji showing strong rejection at highs and selling pressure',
        'güçlü satış baskısı ve tepede reddedilme gösteren mezar taşı doji',
        'एक ग्रेवस्टोन डोजी जो उच्च स्तर पर मजबूत अस्वीकृति दिखाता है',
        'دوجي شاهد القبر يُظهر رفضاً قوياً عند القمم وضغطاً بيعياً');
      case 'MARUBOZU': return tl('a marubozu with large body and small wicks indicating one-sided market power',
        'tek taraflı piyasa gücünü gösteren büyük gövdeli ve küçük fitilli marubozu',
        'एक मारूबोज़ू जो एकतरफा बाजार शक्ति दर्शाता है',
        'ماروبوزو بجسم كبير وفتائل صغيرة يدل على قوة سوقية أحادية الاتجاه');
      case 'LONG_UPPER': return tl('a candle with long upper wick indicating selling pressure and rejection at higher levels',
        'satış baskısı ve üst seviyelerde reddedilmeyi gösteren uzun üst fitilli mum',
        'एक कैंडल जो बिक्री दबाव दिखाती है',
        'شمعة بفتيل علوي طويل تدل على ضغط بيعي ورفض عند المستويات العليا');
      case 'LONG_LOWER': return tl('a candle with long lower wick indicating buying pressure and rejection at lower levels',
        'alım baskısı ve alt seviyelerde reddedilmeyi gösteren uzun alt fitilli mum',
        'एक कैंडल जो खरीद दबाव दिखाती है',
        'شمعة بفتيل سفلي طويل تدل على ضغط شرائي ورفض عند المستويات الدنيا');
      case 'SPINNING_TOP': return tl('a spinning top with small body and long wicks indicating imbalance between buyers and sellers',
        'alıcı ve satıcılar arasındaki dengesizliği gösteren küçük gövdeli topaç',
        'एक स्पिनिंग टॉप जो खरीदारों और विक्रेताओं के बीच असंतुलन दिखाता है',
        'قمة دوّارة بجسم صغير وفتائل طويلة تدل على اختلال التوازن بين المشترين والبائعين');
      default: return tl('a standard candle', 'standart bir mum', 'एक मानक कैंडल', 'شمعة قياسية');
    }
  }

  function blockRelDesc(relation: string): string {
    switch (relation) {
      case 'ENGULFING': return tl('completely encompasses the previous block, indicating increased power in current direction',
        'önceki bloğu tamamen kapsar ve mevcut yöndeki gücün arttığını gösterir',
        'पिछले ब्लॉक को पूरी तरह घेरता है, वर्तमान दिशा में बढ़ी शक्ति का संकेत देता है',
        'تبتلع الكتلة السابقة بالكامل، مما يدل على تزايد القوة في الاتجاه الحالي');
      case 'INSIDE': return tl('is completely within the previous block range, indicating reduced volatility and potential accumulation',
        'tamamen önceki blok aralığında ve azalan oynaklık gösterir',
        'पिछले ब्लॉक के दायरे में है, कम अस्थिरता का संकेत देता है',
        'تقع بالكامل ضمن نطاق الكتلة السابقة، مما يدل على انخفاض التذبذب واحتمال التجميع');
      case 'OUTSIDE': return tl('exceeds the previous block range, indicating increased volatility and market strength',
        'önceki blok aralığını aşar ve artan oynaklık gösterir',
        'पिछले ब्लॉक की सीमा से अधिक है, बढ़ी अस्थिरता का संकेत देता है',
        'تتجاوز نطاق الكتلة السابقة، مما يدل على تزايد التذبذب وقوة السوق');
      default: return '';
    }
  }

  function trendTypeStr(t: number): string {
    return t === DIR_UP ? tl('UPTREND', 'YÜKSELİŞ TRENDİ', 'तेजी का रुझान', 'اتجاه صاعد')
      : t === DIR_DOWN ? tl('DOWNTREND', 'DÜŞÜŞ TRENDİ', 'मंदी का रुझान', 'اتجاه هابط')
        : tl('RANGE', 'YATAY SEYİR', 'दायरा', 'نطاق عرضي');
  }

  function strengthStr(angle: number): string {
    const a = Math.abs(angle);
    return gt(a, 45) ? tl('VERY STRONG', 'ÇOK GÜÇLÜ', 'बहुत मजबूत', 'قوي جداً')
      : gt(a, 30) ? tl('STRONG', 'GÜÇLÜ', 'मजबूत', 'قوي')
        : gt(a, 15) ? tl('MODERATE', 'ORTA', 'मध्यम', 'متوسط')
          : tl('WEAK', 'ZAYIF', 'कमजोर', 'ضعيف');
  }

  function confidenceStr(q: number): string {
    return !lt(q, 80) ? tl('HIGH', 'YÜKSEK', 'उच्च', 'مرتفع')
      : !lt(q, 60) ? tl('MEDIUM', 'ORTA', 'मध्यम', 'متوسط')
        : tl('LOW', 'DÜŞÜK', 'निम्न', 'منخفض');
  }

  function positionZoneStr(p: number): string {
    return gt(p, 66.67) ? tl('UPPER ZONE', 'ÜST BÖLGE', 'ऊपरी क्षेत्र', 'المنطقة العليا')
      : lt(p, 33.33) ? tl('LOWER ZONE', 'ALT BÖLGE', 'निचला क्षेत्र', 'المنطقة السفلى')
        : tl('MIDDLE ZONE', 'ORTA BÖLGE', 'मध्य क्षेत्र', 'المنطقة الوسطى');
  }

  function bodyStatusStr(s: string): string {
    return s === 'EXPANDING' ? tl('EXPANDING', 'GENİŞLEYEN', 'विस्तारित', 'متوسع')
      : s === 'CONTRACTING' ? tl('CONTRACTING', 'DARALAN', 'संकुचित', 'متقلص')
        : tl('STABLE', 'STABLE', 'स्थिर', 'مستقر');
  }

  function rangeStatusStr(s: string): string {
    return s === 'WIDE' ? tl('WIDE RANGE', 'GENİŞ ARALIK', 'विस्तृत रेंज', 'نطاق واسع')
      : s === 'NARROW' ? tl('NARROW RANGE', 'DAR ARALIK', 'संकीर्ण रेंज', 'نطاق ضيق')
        : tl('NORMAL RANGE', 'NORMAL ARALIK', 'सामान्य रेंज', 'نطاق طبيعي');
  }

  function pressureStr(s: string): string {
    return s === 'BUYING' ? tl('Buying pressure', 'Alım baskısı', 'खरीद दबाव', 'ضغط شرائي')
      : s === 'SELLING' ? tl('Selling pressure', 'Satış baskısı', 'बिक्री दबाव', 'ضغط بيعي')
        : tl('Balanced pressure', 'Dengeli baskı', 'संतुलित दबाव', 'ضغط متوازن');
  }

  function checkProximity(price: number, level: number, threshold: number): [boolean, number] {
    if (na(level)) return [false, 0.0];
    const dist = Math.abs(price - level);
    const pct = !eq(price, 0) ? (dist / price) * 100 : 0.0;
    return [le(pct, threshold), pct];
  }

  function typeName(typ: number): string {
    return typ === T_MAX_BUY ? 'MAX BUY' : typ === T_MAX_SELL ? 'MAX SELL' : typ === T_MIN_BUY ? 'MIN BUY'
      : typ === T_MIN_SELL ? 'MIN SELL' : 'LEVEL';
  }

  function buildNarrativeParts(
    cBar: CurrentBarAnalysis, comp: CompositeAnalysis, ctx: TrendContext, ch: TrendChannel,
    trendDelta: number, trendDeltaPct: number, bodyStatus: string, upperPinChg: number, lowerPinChg: number,
    volMom: string, channelPos: number, posStatus: string, resistPrice: number, supportPrice: number,
    contradictions: number, hasDivergence: boolean,
  ): string[] {
    const f2 = (v: number) => str.tostring(v, '#.##');
    const currentPrice = get(C, baseOff);

    // Part 1: current candle, trend and structure
    let s = `${connect('CURRENT_CANDLE')} ${patternDesc(cBar.pattern)} `;
    s += `${connect('WITH_RANGE')} ${rangeStatusStr(cBar.rangeStatus)}. `;
    if (cBar.pressureStatus === 'BUYING') {
      s += `${connect('SHOWING')} ${pressureStr('BUYING')} (${gt(cBar.delta, 0) ? '+' : ''}${str.tostring(cBar.delta, 'volume')}). `;
    } else if (cBar.pressureStatus === 'SELLING') {
      s += `${connect('SHOWING')} ${pressureStr('SELLING')} (${str.tostring(cBar.delta, 'volume')}). `;
    } else {
      s += `${connect('SHOWING')} ${pressureStr('BALANCED')}. `;
    }
    s += `${connect('BROADER_CONTEXT')} ${trendTypeStr(ctx.currentType)} `;
    s += `${connect('WITH_STRENGTH')} ${strengthStr(ch.angleDeg)} `;
    s += `${connect('AND_QUALITY')} ${confidenceStr(ctx.qualityScore)} (${str.tostring(ctx.qualityScore, '#')}/100). `;
    s += `${connect('STRUCTURE_SHOWS')} `;
    if (ctx.currentType === DIR_UP) {
      s += `${tl('Higher Highs / Higher Lows', 'Yükselen Tepeler / Yükselen Dipler', 'उच्च ऊंचाई / उच्च निम्न', 'قمم أعلى / قيعان أعلى')}. `;
    } else if (ctx.currentType === DIR_DOWN) {
      s += `${tl('Lower Highs / Lower Lows', 'Alçalan Tepeler / Alçalan Dipler', 'निम्न ऊंचाई / निम्न निम्न', 'قمم أدنى / قيعان أدنى')}. `;
    } else {
      s += `${tl('mixed pattern with no clear direction', 'net yön olmayan karışık yapı', 'कोई स्पष्ट दिशा नहीं के साथ मिश्रित पैटर्न', 'نمط مختلط بدون اتجاه واضح')}. `;
    }
    if (comp.blockRelation !== 'NORMAL' && comp.blockRelation !== '') {
      s += `${connect('CURRENT_BLOCK')} ${blockRelDesc(comp.blockRelation)}. `;
    }
    const part1 = s;

    // Part 2: volume analysis
    s = '';
    if (hasDivergence) {
      s += `${connect('HOWEVER')}, ${connect('IMPORTANT_CONTRADICTION')}: `;
      s += `${connect('WHILE_PRICE')} `;
      if (ctx.currentType === DIR_UP) s += `${tl('upward', 'yukarı', 'ऊपर', 'صعوداً')}, `;
      else if (ctx.currentType === DIR_DOWN) s += `${tl('downward', 'aşağı', 'नीचे', 'هبوطاً')}, `;
      s += `${connect('VOLUME_SHOWS')} `;
      if (lt(trendDelta, 0)) {
        s += `${tl('selling', 'satış', 'बिक्री', 'بيع')} ${connect('DOMINANCE_WITH')} ${f2(Math.abs(trendDeltaPct))}%. `;
        s += `${connect('THIS_DIVERGENCE')} ${tl('sellers are active despite price rise', 'satıcılar fiyat artışına rağmen aktif', 'विक्रेता मूल्य वृद्धि के बावजूद सक्रिय हैं', 'البائعون نشطون رغم ارتفاع السعر')}. `;
      } else {
        s += `${tl('buying', 'alım', 'खरीद', 'شراء')} ${connect('DOMINANCE_WITH')} ${f2(trendDeltaPct)}%. `;
        s += `${connect('THIS_DIVERGENCE')} ${tl('buyers are accumulating despite price decline', 'alıcılar fiyat düşüşüne rağmen toplanıyor', 'खरीदार मूल्य गिरावट के बावजूद संचय कर रहे हैं', 'المشترون يُجمّعون رغم انخفاض السعر')}. `;
      }
    } else {
      s += `${connect('CONFIRMS_TREND')}, `;
      if (gt(trendDelta, 0)) {
        s += `${tl('buyers', 'alıcılar', 'खरीदार', 'المشترون')} ${connect('DOMINANCE_WITH')} ${f2(trendDeltaPct)}%. `;
      } else if (lt(trendDelta, 0)) {
        s += `${tl('sellers', 'satıcılar', 'विक्रेता', 'البائعون')} ${connect('DOMINANCE_WITH')} ${f2(Math.abs(trendDeltaPct))}%. `;
      } else {
        s += `${tl('balanced with no dominant side', 'dengeli hakimiyet yok', 'कोई प्रभावी पक्ष नहीं', 'متوازن بدون طرف مهيمن')}. `;
      }
    }
    const volMomStr = volMom.includes('INCREASING') ? tl('INCREASING', 'ARTIYOR', 'बढ़ रहा है', 'متزايد') : tl('DECREASING', 'AZALIYOR', 'घट रहा है', 'متناقص');
    s += `${connect('VOLUME_MOMENTUM')} ${volMomStr}, ${connect('INDICATING')} `;
    if (volMom.includes('INCREASING')) {
      s += `${tl('increased market participation', 'artan piyasa katılımı', 'बढ़ती बाजार भागीदारी', 'تزايد المشاركة في السوق')}. `;
    } else {
      s += `${tl('decreased market participation', 'azalan piyasa katılımı', 'घटती बाजार भागीदारी', 'تراجع المشاركة في السوق')}. `;
    }
    const part2 = s;

    // Part 3: momentum (pins and bodies) and channel position
    s = `${connect('CANDLE_BODIES')} ${bodyStatusStr(bodyStatus)}`;
    if (bodyStatus === 'EXPANDING') {
      s += `, ${connect('INDICATING')} ${tl('increasing power and momentum', 'artan güç ve momentum', 'बढ़ती शक्ति और गति', 'تزايد القوة والزخم')}. `;
    } else if (bodyStatus === 'CONTRACTING') {
      s += `, ${tl('which may indicate weakening trend strength', 'bu trend gücünün zayıflamasını gösterebilir', 'जो रुझान की कमजोरी का संकेत हो सकता है', 'مما قد يُشير إلى ضعف قوة الاتجاه')}. `;
    } else {
      s += '. ';
    }
    if (gt(Math.abs(upperPinChg), 15) || gt(Math.abs(lowerPinChg), 15)) {
      const increased = tl('increased', 'arttı', 'बढ़ा है', 'ازدادت');
      if (gt(upperPinChg, 15)) {
        s += `${connect('UPPER_WICKS')} ${increased} ${connect('BY_PERCENT')} ${f2(upperPinChg)}%, ${connect('INDICATING_PRESSURE')} ${connect('SELL_PRESSURE_ABOVE')}. `;
      }
      if (gt(lowerPinChg, 15)) {
        s += `${connect('LOWER_WICKS')} ${increased} ${connect('BY_PERCENT')} ${f2(lowerPinChg)}%, ${connect('INDICATING_PRESSURE')} ${connect('BUY_SUPPORT')}. `;
      }
      if (lt(lowerPinChg, -15)) {
        s += `${connect('LOWER_WICKS')} ${tl('decreased', 'azaldı', 'घटा है', 'انخفضت')} ${connect('BY_PERCENT')} ${f2(Math.abs(lowerPinChg))}%, `
          + `${tl('which may indicate weakening support', 'bu desteğin zayıflamasını gösterebilir', 'जो समर्थन कमजोर होने का संकेत हो सकता है', 'مما قد يُشير إلى ضعف الدعم')}. `;
      }
    }
    if (!na(channelPos)) {
      s += `${connect('PRICE_POSITION')} ${positionZoneStr(channelPos)} (${f2(channelPos)}% ${connect('OF_CHANNEL')})`;
      if (posStatus === 'OVERBOUGHT') s += ` ${tl('in overbought zone', 'aşırı alım bölgesinde', 'अधिक खरीद क्षेत्र में', 'في منطقة التشبّع الشرائي')}. `;
      else if (posStatus === 'OVERSOLD') s += ` ${tl('in oversold zone', 'aşırı satım bölgesinde', 'अधिक बिक्री क्षेत्र में', 'في منطقة التشبّع البيعي')}. `;
      else s += '. ';
    }
    const part3 = s;

    // Part 4: key levels (the displayed lines)
    s = '';
    const pocUpLevel = levels.hasPOCUp ? levels.pocUp : NaN;
    const pocDnLevel = levels.hasPOCDn ? levels.pocDn : NaN;
    const coreUpLevel = levels.hasCoreUp ? levels.coreUp : NaN;
    const coreDnLevel = levels.hasCoreDn ? levels.coreDn : NaN;
    const [nearResist, resistPct] = checkProximity(currentPrice, resistPrice, 2.0);
    const [nearSupport, supportPct] = checkProximity(currentPrice, supportPrice, 2.0);
    const [nearPOCUp, pocUpPct] = checkProximity(currentPrice, pocUpLevel, 1.5);
    const [nearPOCDn, pocDnPct] = checkProximity(currentPrice, pocDnLevel, 1.5);
    const [nearCoreUp, coreUpPct] = checkProximity(currentPrice, coreUpLevel, 1.0);
    const [nearCoreDn, coreDnPct] = checkProximity(currentPrice, coreDnLevel, 1.0);
    if (nearResist || nearSupport || nearPOCUp || nearPOCDn || nearCoreUp || nearCoreDn) {
      s += `${connect('KEY_NOTE')}: `;
      if (nearResist) s += `${connect('NEAR_RESISTANCE')} ${fmtMintick(resistPrice)} (${connect('DISTANCE')} ${f2(resistPct)}%). `;
      if (nearSupport) s += `${connect('NEAR_SUPPORT')} ${fmtMintick(supportPrice)} (${connect('DISTANCE')} ${f2(supportPct)}%). `;
      if (nearPOCUp) s += `${connect('POC_LEVEL')} ${fmtMintick(pocUpLevel)} (${connect('DISTANCE')} ${f2(pocUpPct)}%), ${connect('HIGH_VOLUME_AREA')}. `;
      if (nearPOCDn) s += `${connect('POC_LEVEL')} ${fmtMintick(pocDnLevel)} (${connect('DISTANCE')} ${f2(pocDnPct)}%), ${connect('HIGH_VOLUME_AREA')}. `;
      const near = tl('Price is near ', 'Fiyat şu seviyeye yakın: ', 'मूल्य इसके पास है: ', 'السعر قريب من ');
      if (nearCoreUp) {
        s += `${near}${typeName(levels.coreUpType)} | Box ${str.tostring(levels.coreUpBox)} @ ${fmtMintick(coreUpLevel)} (${connect('DISTANCE')} ${f2(coreUpPct)}%). `;
      }
      if (nearCoreDn) {
        s += `${near}${typeName(levels.coreDnType)} | Box ${str.tostring(levels.coreDnBox)} @ ${fmtMintick(coreDnLevel)} (${connect('DISTANCE')} ${f2(coreDnPct)}%). `;
      }
    } else {
      if (!na(resistPrice) && !na(supportPrice)) {
        s += `${connect('DISTANCE_TO_LEVELS')} ${f2(resistPrice - currentPrice)}, ${connect('TO_SUPPORT')} ${f2(currentPrice - supportPrice)}. `;
      }
      if (!na(pocUpLevel) || !na(pocDnLevel)) {
        const dUp = !na(pocUpLevel) ? Math.abs(currentPrice - pocUpLevel) : NaN;
        const dDn = !na(pocDnLevel) ? Math.abs(currentPrice - pocDnLevel) : NaN;
        const nearestPOC = na(dUp) ? pocDnLevel : na(dDn) ? pocUpLevel : (le(dUp, dDn) ? pocUpLevel : pocDnLevel);
        const pocPct = checkProximity(currentPrice, nearestPOC, 100.0)[1];
        s += `${tl(' Nearest POC: ', ' En yakın POC: ', ' निकटतम POC: ', ' أقرب POC: ')}${fmtMintick(nearestPOC)} (${f2(pocPct)}%). `;
      }
      if (!na(coreUpLevel) || !na(coreDnLevel)) {
        const cdUp = !na(coreUpLevel) ? Math.abs(currentPrice - coreUpLevel) : NaN;
        const cdDn = !na(coreDnLevel) ? Math.abs(currentPrice - coreDnLevel) : NaN;
        const nearestCore = na(cdUp) ? coreDnLevel : na(cdDn) ? coreUpLevel : (le(cdUp, cdDn) ? coreUpLevel : coreDnLevel);
        const corePct = checkProximity(currentPrice, nearestCore, 100.0)[1];
        s += `${tl(' Nearest core level: ', ' En yakın çekirdek seviye: ', ' निकटतम कोर स्तर: ', ' أقرب مستوى جوهري: ')}${fmtMintick(nearestCore)} (${f2(corePct)}%). `;
      }
    }
    const part4 = s;

    // Part 5: final assessment
    s = `${connect('OVERALL')}, `;
    if (contradictions > 0 || hasDivergence) {
      s += `${connect('DESPITE')} ${str.tostring(contradictions)} ${connect('CONTRADICTIONS')}, ${connect('PATTERN_MAINTAINS')} `;
      if (ctx.currentType === DIR_UP) s += connect('UPTREND_CHAR');
      else if (ctx.currentType === DIR_DOWN) s += connect('DOWNTREND_CHAR');
      else s += connect('CONSOLIDATION');
      s += `, ${connect('THESE_CONTRADICTIONS')}.`;
    } else {
      s += `${connect('ALL_ALIGNED')} `;
      if (ctx.currentType === DIR_UP) s += `${connect('UPTREND_CHAR')}.`;
      else if (ctx.currentType === DIR_DOWN) s += `${connect('DOWNTREND_CHAR')}.`;
      else s += `${connect('CONSOLIDATION')} ${connect('NO_CLEAR_DIR')}.`;
    }
    return [part1, part2, part3, part4, s];
  }

  setDrawingBar(null);
  const out = drawingOutputs(bars);
  return {
    ...empty,
    lines: out.lines ?? [],
    labels: out.labels ?? [],
    boxes: out.boxes ?? [],
    tables: out.tables ?? [],
  };
}

export const SmartTraderEpisode03ByAtaSabanci = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, barColorConfig, drawingKinds,
};
