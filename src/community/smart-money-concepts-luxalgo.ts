/**
 * Smart Money Concepts (SMC) [LuxAlgo]
 *
 * Market structure from swing points. A leg changes when the high (low) of `size` bars ago is above (below) the
 * highest high (lowest low) of the last `size` bars: that bar is a pivot high (low). Three sizes run in parallel:
 * the swing structure (input, 50), the internal structure (5) and the equal highs / lows (input, 3).
 * - A close that crosses the last pivot is a break: "BOS" in the direction of the trend, "CHoCH" against it. Each
 *   break is a line from the pivot to the bar of the break (dashed: internal, solid: swing) with its text.
 * - Order blocks: on a break, the bar with the lowest (bullish) or highest (bearish) parsed price between the pivot
 *   and the break. A bar whose range is at least 2 x ATR(200) (or 2 x the cumulative mean range) is parsed with its
 *   high and low swapped. A block is removed when price goes through it. The last blocks are drawn as boxes extended
 *   to the right.
 * - Equal highs / lows: a new pivot within `threshold` x ATR(200) of the previous one (dotted line, "EQH" / "EQL").
 * - Strong / weak high and low: the trailing extremes since the last swing pivots.
 * - Fair value gaps (optional, other timeframe possible): 3-bar gaps, two boxes each, removed when filled.
 * - Previous day / week / month high and low (optional), premium / discount / equilibrium zones (optional),
 *   candles coloured by the internal trend (optional), swing point labels HH / LH / HL / LL (optional).
 *
 * The drawings are those alive after the last bar. Every bar given to calculate() is a closed bar: the last bar is
 * the last confirmed bar (order blocks and the day / week / month levels are drawn on it).
 * Line and label ends after the last bar are times (last bar time + 20 bar durations), as in the original.
 * Other timeframes (fair value gaps, day / week / month levels): the bars of that timeframe are built from the chart
 * bars (periods from the UTC calendar and the bars, see src/anchor-period.ts). Exact on UTC 24x7 symbols and on
 * symbols whose trading day is inside the UTC day; the first periods of the bars can differ. A fair value gap
 * timeframe below the chart timeframe needs data that the bars do not carry: the port throws an Error.
 * The automatic fair value gap threshold and the "Cumulative Mean Range" filter divide by the bar index: it counts
 * from the first bar given to calculate().
 *
 * Reference: "Smart Money Concepts (SMC) [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International
 * (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/ (c) LuxAlgo
 */

import {
  ta, Series, array, color, compare, math, str, callsite, timeframe, barTime,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { BoxData, LabelData, LabelStyle, LineDrawingData, PineSize, PlotCandleData } from '../types';
import { periodStarts, chartTimeframe } from '../anchor-period';

type Show = 'All' | 'BOS' | 'CHoCH';
type LabelSize = 'tiny' | 'small' | 'normal';
type LevelStyle = '⎯⎯⎯' | '----' | '····';

export interface SmartMoneyConceptsLuxalgoInputs {
  /** 'Historical': every structure; 'Present': only the most recent ones */
  mode: 'Historical' | 'Present';
  style: 'Colored' | 'Monochrome';
  /** Candles coloured by the internal trend */
  showTrend: boolean;
  showInternals: boolean;
  showInternalBull: Show;
  internalBullColor: string;
  showInternalBear: Show;
  internalBearColor: string;
  internalFilterConfluence: boolean;
  internalStructureSize: LabelSize;
  showStructure: boolean;
  showSwingBull: Show;
  swingBullColor: string;
  showSwingBear: Show;
  swingBearColor: string;
  swingStructureSize: LabelSize;
  /** Swing point labels (HH / LH / HL / LL) */
  showSwings: boolean;
  swingsLength: number;
  showHighLowSwings: boolean;
  showInternalOrderBlocks: boolean;
  internalOrderBlocksSize: number;
  showSwingOrderBlocks: boolean;
  swingOrderBlocksSize: number;
  orderBlockFilter: 'Atr' | 'Cumulative Mean Range';
  orderBlockMitigation: 'Close' | 'High/Low';
  internalBullishOrderBlockColor: string;
  internalBearishOrderBlockColor: string;
  swingBullishOrderBlockColor: string;
  swingBearishOrderBlockColor: string;
  showEqualHighsLows: boolean;
  equalHighsLowsLength: number;
  equalHighsLowsThreshold: number;
  equalHighsLowsSize: LabelSize;
  showFairValueGaps: boolean;
  fairValueGapsThreshold: boolean;
  /** Fair value gap timeframe ("" = the chart timeframe) */
  fairValueGapsTimeframe: string;
  fairValueGapsBullColor: string;
  fairValueGapsBearColor: string;
  fairValueGapsExtend: number;
  showDailyLevels: boolean;
  dailyLevelsStyle: LevelStyle;
  dailyLevelsColor: string;
  showWeeklyLevels: boolean;
  weeklyLevelsStyle: LevelStyle;
  weeklyLevelsColor: string;
  showMonthlyLevels: boolean;
  monthlyLevelsStyle: LevelStyle;
  monthlyLevelsColor: string;
  showPremiumDiscountZones: boolean;
  premiumZoneColor: string;
  equilibriumZoneColor: string;
  discountZoneColor: string;
}

const GREEN = '#089981';
const RED = '#F23645';
const BLUE = '#2157f3';
const GRAY = '#878b94';
const MONO_BULLISH = '#b2b5be';
const MONO_BEARISH = '#5d606b';

const BULLISH = 1;
const BEARISH = -1;
const BULLISH_LEG = 1;
const BEARISH_LEG = 0;

const ALL = 'All';
const BOS = 'BOS';
const CHOCH = 'CHoCH';
const SOLID = '⎯⎯⎯';
const DASHED = '----';
const DOTTED = '····';

export const defaultInputs: SmartMoneyConceptsLuxalgoInputs = {
  mode: 'Historical',
  style: 'Colored',
  showTrend: false,
  showInternals: true,
  showInternalBull: 'All',
  internalBullColor: GREEN,
  showInternalBear: 'All',
  internalBearColor: RED,
  internalFilterConfluence: false,
  internalStructureSize: 'tiny',
  showStructure: true,
  showSwingBull: 'All',
  swingBullColor: GREEN,
  showSwingBear: 'All',
  swingBearColor: RED,
  swingStructureSize: 'small',
  showSwings: false,
  swingsLength: 50,
  showHighLowSwings: true,
  showInternalOrderBlocks: true,
  internalOrderBlocksSize: 5,
  showSwingOrderBlocks: false,
  swingOrderBlocksSize: 5,
  orderBlockFilter: 'Atr',
  orderBlockMitigation: 'High/Low',
  // color.new(c, 80) as an input default: alpha byte 51; color.new(c, 70): alpha byte 77
  internalBullishOrderBlockColor: '#3179f533',
  internalBearishOrderBlockColor: '#f77c8033',
  swingBullishOrderBlockColor: '#1848cc33',
  swingBearishOrderBlockColor: '#b2283333',
  showEqualHighsLows: true,
  equalHighsLowsLength: 3,
  equalHighsLowsThreshold: 0.1,
  equalHighsLowsSize: 'tiny',
  showFairValueGaps: false,
  fairValueGapsThreshold: true,
  fairValueGapsTimeframe: '',
  fairValueGapsBullColor: '#00ff684D',
  fairValueGapsBearColor: '#ff00084D',
  fairValueGapsExtend: 1,
  showDailyLevels: false,
  dailyLevelsStyle: SOLID,
  dailyLevelsColor: BLUE,
  showWeeklyLevels: false,
  weeklyLevelsStyle: SOLID,
  weeklyLevelsColor: BLUE,
  showMonthlyLevels: false,
  monthlyLevelsStyle: SOLID,
  monthlyLevelsColor: BLUE,
  showPremiumDiscountZones: false,
  premiumZoneColor: RED,
  equilibriumZoneColor: GRAY,
  discountZoneColor: GREEN,
};

const SMART_GROUP = 'Smart Money Concepts';
const INTERNAL_GROUP = 'Real Time Internal Structure';
const SWING_GROUP = 'Real Time Swing Structure';
const BLOCKS_GROUP = 'Order Blocks';
const EQUAL_GROUP = 'EQH/EQL';
const GAPS_GROUP = 'Fair Value Gaps';
const LEVELS_GROUP = 'Highs & Lows MTF';
const ZONES_GROUP = 'Premium & Discount Zones';
const SHOWS = [ALL, BOS, CHOCH];
const SIZES = ['tiny', 'small', 'normal'];
const STYLES = [SOLID, DASHED, DOTTED];

export const inputConfig: InputConfig[] = [
  { id: 'mode', type: 'string', title: 'Mode', defval: 'Historical', options: ['Historical', 'Present'], group: SMART_GROUP,
    tooltip: 'Allows to display historical Structure or only the recent ones' },
  { id: 'style', type: 'string', title: 'Style', defval: 'Colored', options: ['Colored', 'Monochrome'], group: SMART_GROUP,
    tooltip: 'Indicator color theme' },
  { id: 'showTrend', type: 'bool', title: 'Color Candles', defval: false, group: SMART_GROUP,
    tooltip: 'Display additional candles with a color reflecting the current trend detected by structure' },

  { id: 'showInternals', type: 'bool', title: 'Show Internal Structure', defval: true, group: INTERNAL_GROUP,
    tooltip: 'Display internal market structure' },
  { id: 'showInternalBull', type: 'string', title: 'Bullish Structure', defval: ALL, options: SHOWS, group: INTERNAL_GROUP, inline: 'ibull' },
  { id: 'internalBullColor', type: 'color', title: '', defval: GREEN, group: INTERNAL_GROUP, inline: 'ibull' },
  { id: 'showInternalBear', type: 'string', title: 'Bearish Structure', defval: ALL, options: SHOWS, group: INTERNAL_GROUP, inline: 'ibear' },
  { id: 'internalBearColor', type: 'color', title: '', defval: RED, group: INTERNAL_GROUP, inline: 'ibear' },
  { id: 'internalFilterConfluence', type: 'bool', title: 'Confluence Filter', defval: false, group: INTERNAL_GROUP,
    tooltip: 'Filter non significant internal structure breakouts' },
  { id: 'internalStructureSize', type: 'string', title: 'Internal Label Size', defval: 'tiny', options: SIZES, group: INTERNAL_GROUP },

  { id: 'showStructure', type: 'bool', title: 'Show Swing Structure', defval: true, group: SWING_GROUP,
    tooltip: 'Display swing market Structure' },
  { id: 'showSwingBull', type: 'string', title: 'Bullish Structure', defval: ALL, options: SHOWS, group: SWING_GROUP, inline: 'bull' },
  { id: 'swingBullColor', type: 'color', title: '', defval: GREEN, group: SWING_GROUP, inline: 'bull' },
  { id: 'showSwingBear', type: 'string', title: 'Bearish Structure', defval: ALL, options: SHOWS, group: SWING_GROUP, inline: 'bear' },
  { id: 'swingBearColor', type: 'color', title: '', defval: RED, group: SWING_GROUP, inline: 'bear' },
  { id: 'swingStructureSize', type: 'string', title: 'Swing Label Size', defval: 'small', options: SIZES, group: SWING_GROUP },
  { id: 'showSwings', type: 'bool', title: 'Show Swings Points', defval: false, group: SWING_GROUP, inline: 'swings',
    tooltip: 'Display swing point as labels on the chart' },
  { id: 'swingsLength', type: 'int', title: '', defval: 50, min: 10, group: SWING_GROUP, inline: 'swings' },
  { id: 'showHighLowSwings', type: 'bool', title: 'Show Strong/Weak High/Low', defval: true, group: SWING_GROUP,
    tooltip: 'Highlight most recent strong and weak high/low points on the chart' },

  { id: 'showInternalOrderBlocks', type: 'bool', title: 'Internal Order Blocks', defval: true, group: BLOCKS_GROUP, inline: 'iob',
    tooltip: 'Display internal order blocks on the chart\n\nNumber of internal order blocks to display on the chart' },
  { id: 'internalOrderBlocksSize', type: 'int', title: '', defval: 5, min: 1, max: 20, group: BLOCKS_GROUP, inline: 'iob' },
  { id: 'showSwingOrderBlocks', type: 'bool', title: 'Swing Order Blocks', defval: false, group: BLOCKS_GROUP, inline: 'ob',
    tooltip: 'Display swing order blocks on the chart\n\nNumber of internal swing blocks to display on the chart' },
  { id: 'swingOrderBlocksSize', type: 'int', title: '', defval: 5, min: 1, max: 20, group: BLOCKS_GROUP, inline: 'ob' },
  { id: 'orderBlockFilter', type: 'string', title: 'Order Block Filter', defval: 'Atr', options: ['Atr', 'Cumulative Mean Range'], group: BLOCKS_GROUP,
    tooltip: 'Method used to filter out volatile order blocks \n\nIt is recommended to use the cumulative mean range method when a low amount of data is available' },
  { id: 'orderBlockMitigation', type: 'string', title: 'Order Block Mitigation', defval: 'High/Low', options: ['Close', 'High/Low'], group: BLOCKS_GROUP,
    tooltip: 'Select what values to use for order block mitigation' },
  { id: 'internalBullishOrderBlockColor', type: 'color', title: 'Internal Bullish OB', defval: '#3179f533', group: BLOCKS_GROUP },
  { id: 'internalBearishOrderBlockColor', type: 'color', title: 'Internal Bearish OB', defval: '#f77c8033', group: BLOCKS_GROUP },
  { id: 'swingBullishOrderBlockColor', type: 'color', title: 'Bullish OB', defval: '#1848cc33', group: BLOCKS_GROUP },
  { id: 'swingBearishOrderBlockColor', type: 'color', title: 'Bearish OB', defval: '#b2283333', group: BLOCKS_GROUP },

  { id: 'showEqualHighsLows', type: 'bool', title: 'Equal High/Low', defval: true, group: EQUAL_GROUP,
    tooltip: 'Display equal highs and equal lows on the chart' },
  { id: 'equalHighsLowsLength', type: 'int', title: 'Bars Confirmation', defval: 3, min: 1, group: EQUAL_GROUP,
    tooltip: 'Number of bars used to confirm equal highs and equal lows' },
  { id: 'equalHighsLowsThreshold', type: 'float', title: 'Threshold', defval: 0.1, min: 0, max: 0.5, step: 0.1, group: EQUAL_GROUP,
    tooltip: 'Sensitivity threshold in a range (0, 1) used for the detection of equal highs & lows\n\nLower values will return fewer but more pertinent results' },
  { id: 'equalHighsLowsSize', type: 'string', title: 'Label Size', defval: 'tiny', options: SIZES, group: EQUAL_GROUP },

  { id: 'showFairValueGaps', type: 'bool', title: 'Fair Value Gaps', defval: false, group: GAPS_GROUP,
    tooltip: 'Display fair values gaps on the chart' },
  { id: 'fairValueGapsThreshold', type: 'bool', title: 'Auto Threshold', defval: true, group: GAPS_GROUP,
    tooltip: 'Filter out non significant fair value gaps' },
  { id: 'fairValueGapsTimeframe', type: 'timeframe', title: 'Timeframe', defval: '', group: GAPS_GROUP,
    tooltip: 'Fair value gaps timeframe' },
  { id: 'fairValueGapsBullColor', type: 'color', title: 'Bullish FVG', defval: '#00ff684D', group: GAPS_GROUP },
  { id: 'fairValueGapsBearColor', type: 'color', title: 'Bearish FVG', defval: '#ff00084D', group: GAPS_GROUP },
  { id: 'fairValueGapsExtend', type: 'int', title: 'Extend FVG', defval: 1, min: 0, group: GAPS_GROUP,
    tooltip: 'Determine how many bars to extend the Fair Value Gap boxes on chart' },

  { id: 'showDailyLevels', type: 'bool', title: 'Daily', defval: false, group: LEVELS_GROUP, inline: 'daily' },
  { id: 'dailyLevelsStyle', type: 'string', title: '', defval: SOLID, options: STYLES, group: LEVELS_GROUP, inline: 'daily' },
  { id: 'dailyLevelsColor', type: 'color', title: '', defval: BLUE, group: LEVELS_GROUP, inline: 'daily' },
  { id: 'showWeeklyLevels', type: 'bool', title: 'Weekly', defval: false, group: LEVELS_GROUP, inline: 'weekly' },
  { id: 'weeklyLevelsStyle', type: 'string', title: '', defval: SOLID, options: STYLES, group: LEVELS_GROUP, inline: 'weekly' },
  { id: 'weeklyLevelsColor', type: 'color', title: '', defval: BLUE, group: LEVELS_GROUP, inline: 'weekly' },
  { id: 'showMonthlyLevels', type: 'bool', title: 'Monthly', defval: false, group: LEVELS_GROUP, inline: 'monthly' },
  { id: 'monthlyLevelsStyle', type: 'string', title: '', defval: SOLID, options: STYLES, group: LEVELS_GROUP, inline: 'monthly' },
  { id: 'monthlyLevelsColor', type: 'color', title: '', defval: BLUE, group: LEVELS_GROUP, inline: 'monthly' },

  { id: 'showPremiumDiscountZones', type: 'bool', title: 'Premium/Discount Zones', defval: false, group: ZONES_GROUP,
    tooltip: 'Display premium, discount, and equilibrium zones on chart' },
  { id: 'premiumZoneColor', type: 'color', title: 'Premium Zone', defval: RED, group: ZONES_GROUP },
  { id: 'equilibriumZoneColor', type: 'color', title: 'Equilibrium Zone', defval: GRAY, group: ZONES_GROUP },
  { id: 'discountZoneColor', type: 'color', title: 'Discount Zone', defval: GREEN, group: ZONES_GROUP },
];

// The only output with a plot slot is plotcandle (input "Color Candles")
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Smart Money Concepts [LuxAlgo]',
  shortTitle: 'LuxAlgo - Smart Money Concepts',
  overlay: true,
};

/** indicator(max_labels_count = 500, max_lines_count = 500, max_boxes_count = 500) */
const MAX_LABELS = 500;
const MAX_LINES = 500;
const MAX_BOXES = 500;

const { eq, ne, lt, gt, ge } = compare;
const TRANSPARENT = 'transparent';

type LineStyle = 'solid' | 'dashed' | 'dotted';

/** A drawing of the script. `held`: a `var` variable of the script still refers to it */
interface Drawing { alive: boolean; held: boolean }
/** Line with xloc.bar_time (NaN = na: the line exists but is not drawn) */
interface RawLine extends Drawing { x1: number; y1: number; x2: number; y2: number; color: string; style: LineStyle }
/** Label: `x` is a time, or a bar index when `byIndex` */
interface RawLabel extends Drawing {
  x: number; y: number; byIndex: boolean; text: string; textColor?: string; style: LabelStyle; size: PineSize;
}
/** Box with xloc.bar_time */
interface RawBox extends Drawing {
  left: number; top: number; right: number; bottom: number; bg?: string; border?: string; extend?: 'right';
}

/**
 * Drawings of one kind in creation order, with the maximum count of the script: when a creation brings the count
 * above the maximum + 5, the oldest are deleted until the maximum remain. A drawing that a `var` variable still
 * holds counts but is not deleted.
 */
class Pool<X extends Drawing> {
  readonly items: X[] = [];
  private count = 0;

  constructor(private readonly max: number) {}

  add(obj: X): X {
    this.items.push(obj);
    this.count++;
    if (this.count > this.max + 5) {
      // the new drawing (the last item) is never deleted
      for (let k = 0; k < this.items.length - 1 && this.count > this.max; k++) {
        const o = this.items[k];
        if (o.alive && !o.held) {
          o.alive = false;
          this.count--;
        }
      }
    }
    return obj;
  }

  /** line.delete() / label.delete() / box.delete(): nothing on na or on a deleted drawing */
  delete(obj: X | null): void {
    if (obj && obj.alive) {
      obj.alive = false;
      this.count--;
    }
  }
}

interface Pivot { currentLevel: number; lastLevel: number; crossed: boolean; barTime: number; barIndex: number }
interface Trend { bias: number }
interface OrderBlock { barHigh: number; barLow: number; barTime: number; bias: number }
interface FairValueGap { top: number; bottom: number; bias: number; topBox: RawBox; bottomBox: RawBox }
/** `var line` and `var label` of one drawStructure() call */
interface StructureSite { line: RawLine | null; label: RawLabel | null }
/** State of one displayStructure() call */
interface StructureState {
  bullishBar: boolean; bearishBar: boolean;
  over: (a: number, b: number) => boolean; under: (a: number, b: number) => boolean;
  bull: StructureSite; bear: StructureSite;
}
/** State of one getCurrentStructure() call: the `var leg` of leg() and the `var label` of its two drawLabel() calls */
interface LegState { leg: number; highest: number[]; lowest: number[]; lowLabel: RawLabel | null; highLabel: RawLabel | null }

function getStyle(style: string): LineStyle {
  return style === DASHED ? 'dashed' : style === DOTTED ? 'dotted' : 'solid';
}

/** Bars of the timeframe `tf` built from the chart bars, and the index of the period of each chart bar */
function timeframeBars(bars: Bar[], tf: string): { htf: Bar[]; group: number[] } {
  const starts = periodStarts(bars, tf);
  const htf: Bar[] = [];
  const group: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    if (i === 0 || starts[i] !== starts[i - 1]) {
      htf.push({ time: starts[i], open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });
    } else {
      const cur = htf[htf.length - 1];
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
    }
    group.push(htf.length - 1);
  }
  return { htf, group };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SmartMoneyConceptsLuxalgoInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const present = cfg.mode === 'Present';
  const mono = cfg.style === 'Monochrome';

  const H = bars.map((b) => b.high);
  const L = bars.map((b) => b.low);
  const O = bars.map((b) => b.open);
  const C = bars.map((b) => b.close);
  const T = bars.map((b) => b.time as number);
  /** x[k] history read: na before the first bar */
  const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const chartTf = chartTimeframe(bars);
  const chartSeconds = chartTf === '' ? NaN : timeframe.in_seconds(chartTf);
  const chartInfo = chartTf === '' ? null : timeframe.info(chartTf);
  const lastBarTime = n > 0 ? T[last] : NaN;

  const swingBullishColor = mono ? MONO_BULLISH : cfg.swingBullColor;
  const swingBearishColor = mono ? MONO_BEARISH : cfg.swingBearColor;
  const fairValueGapBullishColor = mono ? String(color.new(MONO_BULLISH, 70)) : cfg.fairValueGapsBullColor;
  const fairValueGapBearishColor = mono ? String(color.new(MONO_BEARISH, 70)) : cfg.fairValueGapsBearColor;
  const premiumZoneColor = mono ? MONO_BEARISH : cfg.premiumZoneColor;
  const discountZoneColor = mono ? MONO_BULLISH : cfg.discountZoneColor;

  const lines = new Pool<RawLine>(MAX_LINES);
  const labels = new Pool<RawLabel>(MAX_LABELS);
  const boxes = new Pool<RawBox>(MAX_BOXES);
  const newLine = (x1: number, y1: number, x2: number, y2: number, lineColor: string, style: LineStyle = 'solid'): RawLine =>
    lines.add({ alive: true, held: false, x1, y1, x2, y2, color: lineColor, style });
  const newLabel = (o: Omit<RawLabel, 'alive' | 'held'>): RawLabel => labels.add({ alive: true, held: false, ...o });
  const newBox = (o: Omit<RawBox, 'alive' | 'held'>): RawBox => boxes.add({ alive: true, held: false, ...o });
  /** A drawing kept by a `var` variable for the whole run */
  const hold = <X extends Drawing>(obj: X): X => {
    obj.held = true;
    return obj;
  };

  const newPivot = (): Pivot => ({ currentLevel: NaN, lastLevel: NaN, crossed: false, barTime: n > 0 ? T[0] : NaN, barIndex: 0 });
  const swingHigh = newPivot();
  const swingLow = newPivot();
  const internalHigh = newPivot();
  const internalLow = newPivot();
  const equalHigh = newPivot();
  const equalLow = newPivot();
  const swingTrend: Trend = { bias: 0 };
  const internalTrend: Trend = { bias: 0 };
  const equalHighDisplay: StructureSite = { line: null, label: null };
  const equalLowDisplay: StructureSite = { line: null, label: null };
  const fairValueGaps: FairValueGap[] = [];
  const parsedHighs: number[] = [];
  const parsedLows: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const times: number[] = [];
  const trailing = { top: NaN, bottom: NaN, barTime: NaN, barIndex: NaN, lastTopTime: NaN, lastBottomTime: NaN };
  const swingOrderBlocks: OrderBlock[] = [];
  const internalOrderBlocks: OrderBlock[] = [];
  const swingOrderBlocksBoxes: RawBox[] = [];
  const internalOrderBlocksBoxes: RawBox[] = [];
  const initialTime = n > 0 ? T[0] : NaN;

  // atrMeasure = ta.atr(200); volatilityMeasure = ATR ? atrMeasure : ta.cum(ta.tr) / bar_index
  const atrMeasure = A(ta.atr(bars, 200));
  const volatilityMeasure = cfg.orderBlockFilter === 'Atr' ? atrMeasure : A(ta.cum(ta.tr(bars, false))).map((v, i) => v / i);

  const highSeries = Series.fromArray(bars, H);
  const lowSeries = Series.fromArray(bars, L);
  const legState = (size: number): LegState => ({
    leg: 0, highest: A(ta.highest(highSeries, size)), lowest: A(ta.lowest(lowSeries, size)), lowLabel: null, highLabel: null,
  });
  const swingLeg = legState(cfg.swingsLength);
  const internalLeg = legState(5);
  const equalLeg = legState(cfg.equalHighsLowsLength);
  const structureState = (): StructureState => ({
    bullishBar: true, bearishBar: true, over: callsite.crossover(), under: callsite.crossunder(),
    bull: { line: null, label: null }, bear: { line: null, label: null },
  });
  const internalStructure = structureState();
  const swingStructure = structureState();

  // ---- other timeframes ----
  // drawFairValueGaps(): request.security(syminfo.tickerid, fairValueGapsTimeframeInput, [...], lookahead_on)
  let fvgBars: { htf: Bar[]; group: number[] } | null = null;
  if (cfg.showFairValueGaps) {
    const tf = cfg.fairValueGapsTimeframe;
    if (tf.trim() !== '' && chartTf !== '' && timeframe.in_seconds(tf) < chartSeconds) {
      throw new Error(`Fair value gap timeframe "${tf}" is below the chart timeframe "${chartTf}": the bars do not carry lower timeframe data`);
    }
    fvgBars = timeframeBars(bars, tf);
  }
  let fvgCum = 0; // ta.cum(math.abs(newTimeframe ? barDeltaPercent : 0))

  // drawHighLowSwings(): var lines and labels (made on the first call)
  let swingsDisplay: { topLine: RawLine; bottomLine: RawLine; topLabel: RawLabel; bottomLabel: RawLabel } | null = null;
  // drawZone(): var label and var box of the three calls
  const zones: Array<{ label: RawLabel; box: RawBox }> = [];
  const candles: PlotCandleData[] = [];

  /** drawStructure(): line and text of a break */
  const drawStructure = (
    site: StructureSite, p: Pivot, tag: string, structureColor: string, lineStyle: LineStyle, labelStyle: LabelStyle,
    labelSize: PineSize, i: number,
  ) => {
    if (site.line === null || site.label === null) {
      // var line l_ine = line.new(na, na, na, na, xloc = xloc.bar_time); var label l_abel = label.new(na, na)
      site.line = hold(newLine(NaN, NaN, NaN, NaN, '#2962FF'));
      site.label = hold(newLabel({ x: NaN, y: NaN, byIndex: true, text: '', style: 'label_down', size: 'normal' }));
    }
    if (present) {
      lines.delete(site.line);
      labels.delete(site.label);
    }
    // l_ine := line.new(...): the previous line of the variable is no longer held when the new one is counted
    site.line.held = false;
    site.label.held = false;
    site.line = hold(newLine(p.barTime, p.currentLevel, T[i], p.currentLevel, structureColor, lineStyle));
    site.label = hold(newLabel({
      x: math.round(0.5 * (p.barIndex + i)), y: p.currentLevel, byIndex: true, text: tag, textColor: structureColor,
      style: labelStyle, size: labelSize,
    }));
  };

  /** drawEqualHighLow(): line and text of an equal high (low) */
  const drawEqualHighLow = (p: Pivot, level: number, size: number, isHigh: boolean, i: number) => {
    const display = isHigh ? equalHighDisplay : equalLowDisplay;
    const tag = isHigh ? 'EQH' : 'EQL';
    const equalColor = isHigh ? swingBearishColor : swingBullishColor;
    const labelStyle: LabelStyle = isHigh ? 'label_down' : 'label_up';
    if (present) {
      lines.delete(display.line);
      labels.delete(display.label);
    }
    display.line = newLine(p.barTime, p.currentLevel, at(T, i - size), level, equalColor, 'dotted');
    const labelPosition = math.round(0.5 * (p.barIndex + i - size));
    display.label = newLabel({
      x: labelPosition, y: level, byIndex: true, text: tag, textColor: equalColor, style: labelStyle, size: cfg.equalHighsLowsSize,
    });
  };

  /** drawLabel() of a swing point: one `var label` per call */
  const drawSwingLabel = (prev: RawLabel | null, labelTime: number, labelPrice: number, tag: string, labelColor: string, labelStyle: LabelStyle) => {
    if (present) labels.delete(prev);
    if (prev) prev.held = false;
    return hold(newLabel({ x: labelTime, y: labelPrice, byIndex: false, text: tag, textColor: labelColor, style: labelStyle, size: 'small' }));
  };

  /** getCurrentStructure(): new pivots of one size, equal highs / lows, trailing extremes, swing point labels */
  const getCurrentStructure = (st: LegState, size: number, equalHighLow: boolean, internal: boolean, i: number) => {
    // leg(size)
    const prevLeg = st.leg;
    const newLegHigh = gt(at(H, i - size), st.highest[i]);
    const newLegLow = lt(at(L, i - size), st.lowest[i]);
    if (newLegHigh) st.leg = BEARISH_LEG;
    else if (newLegLow) st.leg = BULLISH_LEG;
    // ta.change(leg): na on the first bar
    const change = i > 0 ? st.leg - prevLeg : NaN;
    const isNewPivot = ne(change, 0);
    const pivotLow = eq(change, 1);
    if (!isNewPivot) return;

    const swing = !equalHighLow && !internal;
    if (pivotLow) {
      const p = equalHighLow ? equalLow : internal ? internalLow : swingLow;
      const level = at(L, i - size);
      if (equalHighLow && lt(Math.abs(p.currentLevel - level), cfg.equalHighsLowsThreshold * atrMeasure[i])) {
        drawEqualHighLow(p, level, size, false, i);
        // alert: Equal Lows
      }
      p.lastLevel = p.currentLevel;
      p.currentLevel = level;
      p.crossed = false;
      p.barTime = at(T, i - size);
      p.barIndex = i - size;
      if (swing) {
        trailing.bottom = p.currentLevel;
        trailing.barTime = p.barTime;
        trailing.barIndex = p.barIndex;
        trailing.lastBottomTime = p.barTime;
      }
      if (cfg.showSwings && swing) {
        st.lowLabel = drawSwingLabel(st.lowLabel, p.barTime, p.currentLevel, lt(p.currentLevel, p.lastLevel) ? 'LL' : 'HL', swingBullishColor, 'label_up');
      }
    } else {
      const p = equalHighLow ? equalHigh : internal ? internalHigh : swingHigh;
      const level = at(H, i - size);
      if (equalHighLow && lt(Math.abs(p.currentLevel - level), cfg.equalHighsLowsThreshold * atrMeasure[i])) {
        drawEqualHighLow(p, level, size, true, i);
        // alert: Equal Highs
      }
      p.lastLevel = p.currentLevel;
      p.currentLevel = level;
      p.crossed = false;
      p.barTime = at(T, i - size);
      p.barIndex = i - size;
      if (swing) {
        trailing.top = p.currentLevel;
        trailing.barTime = p.barTime;
        trailing.barIndex = p.barIndex;
        trailing.lastTopTime = p.barTime;
      }
      if (cfg.showSwings && swing) {
        st.highLabel = drawSwingLabel(st.highLabel, p.barTime, p.currentLevel, gt(p.currentLevel, p.lastLevel) ? 'HH' : 'LH', swingBearishColor, 'label_down');
      }
    }
  };

  /** storeOrdeBlock(): the bar with the extreme parsed price between the pivot and the current bar */
  const storeOrderBlock = (p: Pivot, internal: boolean, bias: number, i: number) => {
    if (!((!internal && cfg.showSwingOrderBlocks) || (internal && cfg.showInternalOrderBlocks))) return;
    let parsedIndex: number;
    if (bias === BEARISH) {
      const slice = array.slice(parsedHighs, p.barIndex, i);
      parsedIndex = p.barIndex + array.indexof(slice, array.max(slice));
    } else {
      const slice = array.slice(parsedLows, p.barIndex, i);
      parsedIndex = p.barIndex + array.indexof(slice, array.min(slice));
    }
    const block: OrderBlock = {
      barHigh: array.get(parsedHighs, parsedIndex), barLow: array.get(parsedLows, parsedIndex), barTime: array.get(times, parsedIndex), bias,
    };
    const orderBlocks = internal ? internalOrderBlocks : swingOrderBlocks;
    if (orderBlocks.length >= 100) orderBlocks.pop();
    orderBlocks.unshift(block);
  };

  /** displayStructure(): breaks of the last pivot high and low, with their order blocks */
  const displayStructure = (st: StructureState, internal: boolean, i: number) => {
    if (cfg.internalFilterConfluence) {
      const upperWick = H[i] - Math.max(C[i], O[i]);
      const lowerPart = Math.min(C[i], O[i] - L[i]);
      st.bullishBar = gt(upperWick, lowerPart);
      st.bearishBar = lt(upperWick, lowerPart);
    }
    const trend = internal ? internalTrend : swingTrend;
    const lineStyle: LineStyle = internal ? 'dashed' : 'solid';
    const labelSize: PineSize = internal ? cfg.internalStructureSize : cfg.swingStructureSize;
    const storeBlocks = (internal && cfg.showInternalOrderBlocks) || (!internal && cfg.showSwingOrderBlocks);
    const shown = (enabled: boolean, show: Show, tag: string) =>
      enabled && (show === ALL || (show === BOS && tag !== CHOCH) || (show === CHOCH && tag === CHOCH));

    let p = internal ? internalHigh : swingHigh;
    let extraCondition = internal ? ne(internalHigh.currentLevel, swingHigh.currentLevel) && st.bullishBar : true;
    const bullishColor = mono ? MONO_BULLISH : internal ? cfg.internalBullColor : cfg.swingBullColor;
    // ta.crossover(close, p_ivot.currentLevel) runs on every bar
    const crossedOver = st.over(C[i], p.currentLevel);
    if (crossedOver && !p.crossed && extraCondition) {
      const tag = trend.bias === BEARISH ? CHOCH : BOS;
      // alert: (Internal) Bullish BOS / CHoCH, by the tag
      p.crossed = true;
      trend.bias = BULLISH;
      const display = internal ? shown(cfg.showInternals, cfg.showInternalBull, tag) : shown(cfg.showStructure, cfg.showSwingBull, tag);
      if (display) drawStructure(st.bull, p, tag, bullishColor, lineStyle, 'label_down', labelSize, i);
      if (storeBlocks) storeOrderBlock(p, internal, BULLISH, i);
    }

    p = internal ? internalLow : swingLow;
    extraCondition = internal ? ne(internalLow.currentLevel, swingLow.currentLevel) && st.bearishBar : true;
    const bearishColor = mono ? MONO_BEARISH : internal ? cfg.internalBearColor : cfg.swingBearColor;
    const crossedUnder = st.under(C[i], p.currentLevel);
    if (crossedUnder && !p.crossed && extraCondition) {
      const tag = trend.bias === BULLISH ? CHOCH : BOS;
      // alert: (Internal) Bearish BOS / CHoCH, by the tag
      p.crossed = true;
      trend.bias = BEARISH;
      const display = internal ? shown(cfg.showInternals, cfg.showInternalBear, tag) : shown(cfg.showStructure, cfg.showSwingBear, tag);
      if (display) drawStructure(st.bear, p, tag, bearishColor, lineStyle, 'label_up', labelSize, i);
      if (storeBlocks) storeOrderBlock(p, internal, BEARISH, i);
    }
  };

  /** deleteOrderBlocks(): `for [index, block] in blocks` reads the array as it is at each step */
  const deleteOrderBlocks = (internal: boolean, i: number) => {
    const orderBlocks = internal ? internalOrderBlocks : swingOrderBlocks;
    const bearishSource = cfg.orderBlockMitigation === 'Close' ? C[i] : H[i];
    const bullishSource = cfg.orderBlockMitigation === 'Close' ? C[i] : L[i];
    for (let index = 0; index < orderBlocks.length; index++) {
      const block = orderBlocks[index];
      let crossed = false;
      if (gt(bearishSource, block.barHigh) && block.bias === BEARISH) {
        crossed = true;
        // alert: Bearish Internal / Swing OB Breakout
      } else if (lt(bullishSource, block.barLow) && block.bias === BULLISH) {
        crossed = true;
        // alert: Bullish Internal / Swing OB Breakout
      }
      if (crossed) orderBlocks.splice(index, 1);
    }
  };

  /** drawOrderBlocks(): the most recent blocks on the boxes made on the first bar */
  const drawOrderBlocks = (internal: boolean) => {
    const orderBlocks = internal ? internalOrderBlocks : swingOrderBlocks;
    const maxOrderBlocks = internal ? cfg.internalOrderBlocksSize : cfg.swingOrderBlocksSize;
    const blockBoxes = internal ? internalOrderBlocksBoxes : swingOrderBlocksBoxes;
    const shownCount = Math.min(maxOrderBlocks, orderBlocks.length);
    for (let index = 0; index < shownCount; index++) {
      const block = orderBlocks[index];
      const bearish = block.bias === BEARISH;
      const blockColor = mono
        ? String(color.new(bearish ? MONO_BEARISH : MONO_BULLISH, 80))
        : internal
          ? (bearish ? cfg.internalBearishOrderBlockColor : cfg.internalBullishOrderBlockColor)
          : (bearish ? cfg.swingBearishOrderBlockColor : cfg.swingBullishOrderBlockColor);
      const b = array.get(blockBoxes, index);
      b.left = block.barTime;
      b.top = block.barHigh;
      b.right = lastBarTime;
      b.bottom = block.barLow;
      b.border = internal ? TRANSPARENT : blockColor;
      b.bg = blockColor;
    }
  };

  /** drawLevels(): high and low of the previous day / week / month (of the bar on the same timeframe) */
  const drawLevels = (tf: 'D' | 'W' | 'M', sameTimeframe: boolean, style: string, levelColor: string, i: number) => {
    // request.security(syminfo.tickerid, timeframe, [high[1], low[1], time[1], time], lookahead = barmerge.lookahead_on)
    const { htf, group } = timeframeBars(bars, tf);
    const g = group[i];
    const previous = g > 0 ? htf[g - 1] : null;
    const parsedTop = sameTimeframe ? H[i] : previous ? previous.high : NaN;
    const parsedBottom = sameTimeframe ? L[i] : previous ? previous.low : NaN;
    const parsedLeftTime = sameTimeframe ? T[i] : previous ? (previous.time as number) : NaN;
    const parsedRightTime = sameTimeframe ? T[i] : (htf[g].time as number);
    let parsedTopTime = T[i];
    let parsedBottomTime = T[i];
    if (!sameTimeframe) {
      const leftIndex = array.binary_search_rightmost(times, parsedLeftTime);
      const rightIndex = array.binary_search_rightmost(times, parsedRightTime);
      const timeArray = array.slice(times, leftIndex, rightIndex);
      const topArray = array.slice(highs, leftIndex, rightIndex);
      const bottomArray = array.slice(lows, leftIndex, rightIndex);
      parsedTopTime = array.size(timeArray) > 0 ? array.get(timeArray, array.indexof(topArray, array.max(topArray))) : initialTime;
      parsedBottomTime = array.size(timeArray) > 0 ? array.get(timeArray, array.indexof(bottomArray, array.min(bottomArray))) : initialTime;
    }
    const rightTime = lastBarTime + 20 * (T[i] - at(T, i - 1));
    const lineStyle = getStyle(style);
    // var lines and labels: made here, the function runs on one bar
    hold(newLine(parsedTopTime, parsedTop, rightTime, parsedTop, levelColor, lineStyle));
    hold(newLine(parsedBottomTime, parsedBottom, rightTime, parsedBottom, levelColor, lineStyle));
    hold(newLabel({ x: rightTime, y: parsedTop, byIndex: false, text: str.format('P{0}H', tf), textColor: levelColor, style: 'label_left', size: 'small' }));
    hold(newLabel({ x: rightTime, y: parsedBottom, byIndex: false, text: str.format('P{0}L', tf), textColor: levelColor, style: 'label_left', size: 'small' }));
  };

  /** higherTimeframe(tf): the chart timeframe is above `tf` */
  const higherTimeframe = (tf: string) => chartSeconds > timeframe.in_seconds(tf);

  for (let i = 0; i < n; i++) {
    const barDuration = T[i] - at(T, i - 1); // time - time[1]

    // barstate.isfirst: the boxes of the order blocks
    if (i === 0) {
      if (cfg.showSwingOrderBlocks) {
        for (let k = 1; k <= cfg.swingOrderBlocksSize; k++) {
          swingOrderBlocksBoxes.push(newBox({ left: NaN, top: NaN, right: NaN, bottom: NaN, extend: 'right' }));
        }
      }
      if (cfg.showInternalOrderBlocks) {
        for (let k = 1; k <= cfg.internalOrderBlocksSize; k++) {
          internalOrderBlocksBoxes.push(newBox({ left: NaN, top: NaN, right: NaN, bottom: NaN, extend: 'right' }));
        }
      }
    }

    // A bar with a range of 2 volatility measures or more is parsed with its high and low swapped
    const highVolatilityBar = ge(H[i] - L[i], 2 * volatilityMeasure[i]);
    parsedHighs.push(highVolatilityBar ? L[i] : H[i]);
    parsedLows.push(highVolatilityBar ? H[i] : L[i]);
    highs.push(H[i]);
    lows.push(L[i]);
    times.push(T[i]);

    // plotcandle(showTrendInput ? open : na, high, low, close, color = candleColor, ...): no candle without the open
    if (cfg.showTrend) {
      const candleColor = internalTrend.bias === BULLISH ? swingBullishColor : swingBearishColor;
      candles.push({ time: bars[i].time, open: O[i], high: H[i], low: L[i], close: C[i], color: candleColor, wickColor: candleColor, borderColor: candleColor });
    }

    if (cfg.showHighLowSwings || cfg.showPremiumDiscountZones) {
      // updateTrailingExtremes()
      trailing.top = math.max(H[i], trailing.top) as number;
      trailing.lastTopTime = eq(trailing.top, H[i]) ? T[i] : trailing.lastTopTime;
      trailing.bottom = math.min(L[i], trailing.bottom) as number;
      trailing.lastBottomTime = eq(trailing.bottom, L[i]) ? T[i] : trailing.lastBottomTime;

      if (cfg.showHighLowSwings) {
        // drawHighLowSwings()
        if (swingsDisplay === null) {
          swingsDisplay = {
            topLine: hold(newLine(NaN, NaN, NaN, NaN, swingBearishColor)),
            bottomLine: hold(newLine(NaN, NaN, NaN, NaN, swingBullishColor)),
            topLabel: hold(newLabel({ x: NaN, y: NaN, byIndex: false, text: '', textColor: swingBearishColor, style: 'label_down', size: 'tiny' })),
            bottomLabel: hold(newLabel({ x: NaN, y: NaN, byIndex: false, text: '', textColor: swingBullishColor, style: 'label_up', size: 'tiny' })),
          };
        }
        const rightTimeBar = lastBarTime + 20 * barDuration;
        const d = swingsDisplay;
        Object.assign(d.topLine, { x1: trailing.lastTopTime, y1: trailing.top, x2: rightTimeBar, y2: trailing.top });
        Object.assign(d.topLabel, { x: rightTimeBar, y: trailing.top, text: swingTrend.bias === BEARISH ? 'Strong High' : 'Weak High' });
        Object.assign(d.bottomLine, { x1: trailing.lastBottomTime, y1: trailing.bottom, x2: rightTimeBar, y2: trailing.bottom });
        Object.assign(d.bottomLabel, { x: rightTimeBar, y: trailing.bottom, text: swingTrend.bias === BULLISH ? 'Strong Low' : 'Weak Low' });
      }

      if (cfg.showPremiumDiscountZones) {
        // drawPremiumDiscountZones(): three drawZone() calls
        const { top, bottom } = trailing;
        const middleIndex = math.round(0.5 * (trailing.barIndex + last));
        const equilibriumLevel = math.avg(top, bottom) as number;
        const zoneData: Array<[number, number, number, number, string, string, LabelStyle]> = [
          [top, middleIndex, top, 0.95 * top + 0.05 * bottom, 'Premium', premiumZoneColor, 'label_down'],
          [equilibriumLevel, last, 0.525 * top + 0.475 * bottom, 0.525 * bottom + 0.475 * top, 'Equilibrium', cfg.equilibriumZoneColor, 'label_left'],
          [bottom, middleIndex, 0.95 * bottom + 0.05 * top, bottom, 'Discount', discountZoneColor, 'label_up'],
        ];
        zoneData.forEach(([labelLevel, labelIndex, zoneTop, zoneBottom, tag, zoneColor, style], k) => {
          if (zones.length <= k) {
            zones.push({
              label: hold(newLabel({ x: NaN, y: NaN, byIndex: true, text: tag, textColor: zoneColor, style, size: 'small' })),
              box: hold(newBox({ left: NaN, top: NaN, right: NaN, bottom: NaN, bg: String(color.new(zoneColor, 80)), border: TRANSPARENT })),
            });
          }
          const zone = zones[k];
          Object.assign(zone.box, { left: trailing.barTime, top: zoneTop, right: lastBarTime, bottom: zoneBottom });
          Object.assign(zone.label, { x: labelIndex, y: labelLevel });
        });
      }
    }

    if (cfg.showFairValueGaps) {
      // deleteFairValueGaps(): `for [index, gap] in gaps` reads the array as it is at each step
      for (let index = 0; index < fairValueGaps.length; index++) {
        const gap = fairValueGaps[index];
        if ((lt(L[i], gap.bottom) && gap.bias === BULLISH) || (gt(H[i], gap.top) && gap.bias === BEARISH)) {
          boxes.delete(gap.topBox);
          boxes.delete(gap.bottomBox);
          fairValueGaps.splice(index, 1);
        }
      }
    }

    getCurrentStructure(swingLeg, cfg.swingsLength, false, false, i);
    getCurrentStructure(internalLeg, 5, false, true, i);
    if (cfg.showEqualHighsLows) getCurrentStructure(equalLeg, cfg.equalHighsLowsLength, true, false, i);

    if (cfg.showInternals || cfg.showInternalOrderBlocks || cfg.showTrend) displayStructure(internalStructure, true, i);
    if (cfg.showStructure || cfg.showSwingOrderBlocks || cfg.showHighLowSwings) displayStructure(swingStructure, false, i);

    if (cfg.showInternalOrderBlocks) deleteOrderBlocks(true, i);
    if (cfg.showSwingOrderBlocks) deleteOrderBlocks(false, i);

    if (fvgBars) {
      // drawFairValueGaps(): with lookahead on, every chart bar of a period has the values of that period
      const { htf, group } = fvgBars;
      const g = group[i];
      const cur = htf[g];
      const prev1 = g > 0 ? htf[g - 1] : null;
      const prev2 = g > 1 ? htf[g - 2] : null;
      const lastClose = prev1 ? prev1.close : NaN;
      const lastOpen = prev1 ? prev1.open : NaN;
      const lastTime = prev1 ? (prev1.time as number) : NaN;
      const currentHigh = cur.high;
      const currentLow = cur.low;
      const currentTime = cur.time as number;
      const last2High = prev2 ? prev2.high : NaN;
      const last2Low = prev2 ? prev2.low : NaN;

      const barDeltaPercent = (lastClose - lastOpen) / (lastOpen * 100);
      // timeframe.change(fairValueGapsTimeframeInput)
      const newTimeframe = i > 0 && group[i] !== group[i - 1];
      // ta.cum(): an na value adds nothing and gives na on that bar
      const delta = Math.abs(newTimeframe ? barDeltaPercent : 0);
      if (!Number.isNaN(delta)) fvgCum += delta;
      const threshold = cfg.fairValueGapsThreshold ? ((Number.isNaN(delta) ? NaN : fvgCum) / i) * 2 : 0;

      const bullishFairValueGap = gt(currentLow, last2High) && gt(lastClose, last2High) && gt(barDeltaPercent, threshold) && newTimeframe;
      const bearishFairValueGap = lt(currentHigh, last2Low) && lt(lastClose, last2Low) && gt(-barDeltaPercent, threshold) && newTimeframe;
      const fairValueGapBox = (topPrice: number, bottomPrice: number, boxColor: string) => newBox({
        left: lastTime, top: topPrice, right: currentTime + cfg.fairValueGapsExtend * barDuration, bottom: bottomPrice, border: boxColor, bg: boxColor,
      });
      if (bullishFairValueGap) {
        // alert: Bullish FVG
        const middle = math.avg(currentLow, last2High) as number;
        const topBox = fairValueGapBox(currentLow, middle, fairValueGapBullishColor);
        const bottomBox = fairValueGapBox(middle, last2High, fairValueGapBullishColor);
        fairValueGaps.unshift({ top: currentLow, bottom: last2High, bias: BULLISH, topBox, bottomBox });
      }
      if (bearishFairValueGap) {
        // alert: Bearish FVG
        const middle = math.avg(currentHigh, last2Low) as number;
        const topBox = fairValueGapBox(currentHigh, middle, fairValueGapBearishColor);
        const bottomBox = fairValueGapBox(middle, last2Low, fairValueGapBearishColor);
        fairValueGaps.unshift({ top: currentHigh, bottom: last2Low, bias: BEARISH, topBox, bottomBox });
      }
    }

    // barstate.islastconfirmedhistory or barstate.islast
    if (i === last) {
      if (cfg.showInternalOrderBlocks) drawOrderBlocks(true);
      if (cfg.showSwingOrderBlocks) drawOrderBlocks(false);

      // barstate.islastconfirmedhistory: previous day / week / month levels
      if (chartInfo) {
        if (cfg.showDailyLevels && !higherTimeframe('D')) drawLevels('D', chartInfo.isdaily, cfg.dailyLevelsStyle, cfg.dailyLevelsColor, i);
        if (cfg.showWeeklyLevels && !higherTimeframe('W')) drawLevels('W', chartInfo.isweekly, cfg.weeklyLevelsStyle, cfg.weeklyLevelsColor, i);
        if (cfg.showMonthlyLevels && !higherTimeframe('M')) drawLevels('M', chartInfo.ismonthly, cfg.monthlyLevelsStyle, cfg.monthlyLevelsColor, i);
      }
    }
  }

  // ---- output: the drawings alive after the last bar, in creation order ----
  // A time that is not a bar time is drawn on the next bar; a time after the last bar is kept as it is
  const onBar = (t: number): number => {
    if (!(t <= lastBarTime)) return t;
    let lo = 0;
    let hi = last;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (T[mid] < t) lo = mid + 1;
      else hi = mid;
    }
    return T[lo];
  };
  const indexTime = (index: number): number => barTime(bars, index);
  const outLines: LineDrawingData[] = [];
  for (const o of lines.items) {
    if (!o.alive || [o.x1, o.y1, o.x2, o.y2].some(Number.isNaN)) continue;
    const line: LineDrawingData = { time1: onBar(o.x1), price1: o.y1, time2: onBar(o.x2), price2: o.y2, color: o.color };
    if (o.style !== 'solid') line.style = o.style;
    outLines.push(line);
  }
  const outLabels: LabelData[] = [];
  for (const o of labels.items) {
    if (!o.alive || Number.isNaN(o.x) || Number.isNaN(o.y)) continue;
    const time = o.byIndex ? indexTime(o.x) : onBar(o.x);
    if (Number.isNaN(time)) continue;
    const label: LabelData = { time, price: o.y, text: o.text, color: TRANSPARENT, style: o.style, size: o.size };
    if (o.textColor !== undefined) label.textColor = o.textColor;
    outLabels.push(label);
  }
  const outBoxes: BoxData[] = [];
  for (const o of boxes.items) {
    if (!o.alive || [o.left, o.top, o.right, o.bottom].some(Number.isNaN)) continue;
    const box: BoxData = { time1: onBar(o.left), price1: o.top, time2: onBar(o.right), price2: o.bottom };
    if (o.bg !== undefined) box.bgColor = o.bg;
    if (o.border !== undefined) box.borderColor = o.border;
    if (o.extend) box.extend = o.extend;
    outBoxes.push(box);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: cfg.showTrend ? { trendCandles: candles } : {},
    lines: outLines,
    labels: outLabels,
    boxes: outBoxes,
  };
}

export const SmartMoneyConceptsLuxalgo = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
