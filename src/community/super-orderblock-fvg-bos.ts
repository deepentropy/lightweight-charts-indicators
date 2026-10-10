/**
 * Super OrderBlock / FVG / BoS Tools
 *
 * Price action tools drawn as boxes, shapes and bar colours:
 * - Order blocks (OB): a down bar followed by an up bar that closes above its high (bullish), or an up bar
 *   followed by a down bar that closes below its low (bearish). The box covers the first bar, from two bars back.
 * - Fair value gaps (FVG): the low is above the high of two bars back (bullish) or the high is below the low of two
 *   bars back (bearish). A gap that jumps over the last pivot top / bottom is a "structure breaking" gap, in its
 *   own colour.
 * - Rejection blocks (RJB, off by default): the wick part of an order block.
 * - Breaks of structure (BoS, off by default): the close (or high / low) crosses the last pivot top / bottom.
 * Each kind keeps its last boxes (the "Maximum ... Box Displayed" input, plus one). A box grows one bar to the
 * right on every bar until a bar crosses its top or its bottom; a mitigated box can take another colour.
 * - Pivot Top / Pivot Bottom: the last pivot high / low (ta.pivothigh / ta.pivotlow with "Pivot Lookup" bars on
 *   each side), drawn shifted back by the lookup and hidden on the bar where the level changes.
 * - PPDD shapes: an order block (triangle) or a weak one (cross) whose bars swept the last pivot and closed back
 *   beyond it. Diamonds: an order block followed by a fair value gap. Bar colours: high volume bars (volume above
 *   the multiplier times its EMA).
 *
 * Reference: "Super OrderBlock / FVG / BoS Tools by makuchaku & eFe" by makuchaku
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BoxData, MarkerData, PineSize } from '../types';
import { barInterval, barTime } from '../bar-time';

type BorderStyle = 'dashed' | 'dotted' | 'solid';

export interface SuperOrderblockFvgBosInputs {
  plotOB: boolean;
  obBullColor: string;
  obBearColor: string;
  obBoxBorder: BorderStyle;
  obBorderTransparency: number;
  obMaxBoxSet: number;
  filterMitOB: boolean;
  mitOBColor: string;
  plotFVG: boolean;
  plotStructureBreakingFVG: boolean;
  fvgBullColor: string;
  fvgBearColor: string;
  fvgStructBreakingColor: string;
  fvgBoxBorder: BorderStyle;
  fvgBorderTransparency: number;
  fvgMaxBoxSet: number;
  filterMitFVG: boolean;
  mitFVGColor: string;
  plotRJB: boolean;
  rjbBullColor: string;
  rjbBearColor: string;
  rjbBoxBorder: BorderStyle;
  rjbBorderTransparency: number;
  rjbMaxBoxSet: number;
  filterMitRJB: boolean;
  mitRJBColor: string;
  plotPVT: boolean;
  pivotLookup: number;
  pvtTopColor: string;
  pvtBottomColor: string;
  plotBOS: boolean;
  useHighLowForBullishBoS: boolean;
  useHighLowForBearishBoS: boolean;
  bosBoxFlag: boolean;
  bosBoxLength: number;
  bosBullColor: string;
  bosBearColor: string;
  bosBoxBorder: BorderStyle;
  bosBorderTransparency: number;
  bosMaxBoxSet: number;
  plotHVB: boolean;
  hvbBullColor: string;
  hvbBearColor: string;
  hvbEMAPeriod: number;
  hvbMultiplier: number;
  plotPPDD: boolean;
  ppddBullColor: string;
  ppddBearColor: string;
  plotOBFVG: boolean;
  obfvgBullColor: string;
  obfvgBearColor: string;
  plotLabelOB: boolean;
  obLabelColor: string;
  obLabelSize: PineSize;
  plotLabelFVG: boolean;
  fvgLabelColor: string;
  fvgLabelSize: PineSize;
  plotLabelRJB: boolean;
  rjbLabelColor: string;
  rjbLabelSize: PineSize;
  plotLabelBOS: boolean;
  bosLabelColor: string;
  bosLabelSize: PineSize;
}

// Pine v5 colour constants. An input default made with color.new(c, 90) has the alpha 0.1 (byte 26).
const GREEN = '#4CAF50';
const RED = '#FF5252';
const GRAY = '#787B86';
const SILVER = '#B2B5BE';
const GREEN_90 = 'rgba(76,175,80,0.1)';
const RED_90 = 'rgba(255,82,82,0.1)';
const GRAY_90 = 'rgba(120,123,134,0.1)';
const BLACK_90 = 'rgba(54,58,69,0.1)';
const BLUE_90 = 'rgba(41,98,255,0.1)';

export const defaultInputs: SuperOrderblockFvgBosInputs = {
  plotOB: true,
  obBullColor: GREEN_90,
  obBearColor: RED_90,
  obBoxBorder: 'solid',
  obBorderTransparency: 80,
  obMaxBoxSet: 10,
  filterMitOB: false,
  mitOBColor: GRAY_90,
  plotFVG: true,
  plotStructureBreakingFVG: true,
  fvgBullColor: BLACK_90,
  fvgBearColor: BLACK_90,
  fvgStructBreakingColor: BLUE_90,
  fvgBoxBorder: 'solid',
  fvgBorderTransparency: 80,
  fvgMaxBoxSet: 10,
  filterMitFVG: false,
  mitFVGColor: GRAY_90,
  plotRJB: false,
  rjbBullColor: GREEN_90,
  rjbBearColor: RED_90,
  rjbBoxBorder: 'solid',
  rjbBorderTransparency: 80,
  rjbMaxBoxSet: 10,
  filterMitRJB: false,
  mitRJBColor: GRAY_90,
  plotPVT: true,
  pivotLookup: 1,
  pvtTopColor: SILVER,
  pvtBottomColor: SILVER,
  plotBOS: false,
  useHighLowForBullishBoS: false,
  useHighLowForBearishBoS: false,
  bosBoxFlag: false,
  bosBoxLength: 3,
  bosBullColor: GREEN_90,
  bosBearColor: RED_90,
  bosBoxBorder: 'solid',
  bosBorderTransparency: 80,
  bosMaxBoxSet: 10,
  plotHVB: true,
  hvbBullColor: GREEN,
  hvbBearColor: RED,
  hvbEMAPeriod: 12,
  hvbMultiplier: 1.5,
  plotPPDD: true,
  ppddBullColor: GREEN,
  ppddBearColor: RED,
  plotOBFVG: true,
  obfvgBullColor: GREEN,
  obfvgBearColor: RED,
  plotLabelOB: true,
  obLabelColor: GRAY,
  obLabelSize: 'tiny',
  plotLabelFVG: true,
  fvgLabelColor: GRAY,
  fvgLabelSize: 'tiny',
  plotLabelRJB: true,
  rjbLabelColor: GRAY,
  rjbLabelSize: 'tiny',
  plotLabelBOS: true,
  bosLabelColor: GRAY,
  bosLabelSize: 'tiny',
};

const BORDER_OPTIONS = ['dashed', 'dotted', 'solid'];
const SIZE_OPTIONS = ['huge', 'large', 'small', 'tiny', 'auto', 'normal'];
const BORDER_TIP = 'To disable border, set Border Width below to 0';
const MAX_TIP = 'Minimum = 1, Maximum = 100';
const G_OB = 'Order Blocks';
const G_FVG = 'Fair Value Gaps';
const G_RJB = 'Rejection Blocks';
const G_PVT = 'Pivots';
const G_BOS = 'Crossovers';
const G_HVB = 'High Volume Bar';
const G_Q = 'Qualitative indicators';
const G_LAB = 'Label Options';
const CC = 'Set Custom Color';

export const inputConfig: InputConfig[] = [
  { id: 'plotOB', type: 'bool', title: 'Plot OB', defval: true, group: G_OB },
  { id: 'obBullColor', type: 'color', title: 'Bullish OB Color', defval: GREEN_90, inline: CC, group: G_OB },
  { id: 'obBearColor', type: 'color', title: 'Bearish OB Color', defval: RED_90, inline: CC, group: G_OB },
  { id: 'obBoxBorder', type: 'string', title: 'OB Box Border Style', defval: 'solid', options: BORDER_OPTIONS, group: G_OB, tooltip: BORDER_TIP },
  { id: 'obBorderTransparency', type: 'int', title: 'OB Border Box Transparency', defval: 80, min: 0, max: 100, group: G_OB },
  { id: 'obMaxBoxSet', type: 'int', title: 'Maximum OB Box Displayed', defval: 10, min: 1, max: 100, group: G_OB, tooltip: MAX_TIP },
  { id: 'filterMitOB', type: 'bool', title: 'Custom Color Mitigated OB', defval: false, group: G_OB },
  { id: 'mitOBColor', type: 'color', title: 'Mitigated OB Color', defval: GRAY_90, group: G_OB, inline: 'Set Custom Color Mit OB', tooltip: 'Set Transparency to 0 to make mitigated OB disappear' },

  { id: 'plotFVG', type: 'bool', title: 'Plot FVG', defval: true, group: G_FVG, inline: 'FVG sets' },
  { id: 'plotStructureBreakingFVG', type: 'bool', title: 'Plot Structure Breaking FVG', defval: true, group: G_FVG, inline: 'FVG sets' },
  { id: 'fvgBullColor', type: 'color', title: 'Bullish FVG Color', defval: BLACK_90, inline: CC, group: G_FVG },
  { id: 'fvgBearColor', type: 'color', title: 'Bearish FVG Color', defval: BLACK_90, inline: CC, group: G_FVG },
  { id: 'fvgStructBreakingColor', type: 'color', title: 'Structure Breaking FVG Color', defval: BLUE_90, inline: CC, group: G_FVG },
  { id: 'fvgBoxBorder', type: 'string', title: 'FVG Box Border Style', defval: 'solid', options: BORDER_OPTIONS, group: G_FVG, tooltip: BORDER_TIP },
  { id: 'fvgBorderTransparency', type: 'int', title: 'FVG Border Box Transparency', defval: 80, min: 0, max: 100, group: G_FVG },
  { id: 'fvgMaxBoxSet', type: 'int', title: 'Maximum FVG Box Displayed', defval: 10, min: 1, max: 100, group: G_FVG, tooltip: MAX_TIP },
  { id: 'filterMitFVG', type: 'bool', title: 'Custom Color Mitigated FVG', defval: false, group: G_FVG },
  { id: 'mitFVGColor', type: 'color', title: 'Mitigated FVG Color', defval: GRAY_90, group: G_FVG, inline: 'Set Custom Color Mit FVG', tooltip: 'Set Transparency to 0 to make mitigated FVG disappear' },

  { id: 'plotRJB', type: 'bool', title: 'Plot RJB', defval: false, group: G_RJB, inline: 'RJB sets' },
  { id: 'rjbBullColor', type: 'color', title: 'Bullish RJB Color', defval: GREEN_90, inline: CC, group: G_RJB },
  { id: 'rjbBearColor', type: 'color', title: 'Bearish RJB Color', defval: RED_90, inline: CC, group: G_RJB },
  { id: 'rjbBoxBorder', type: 'string', title: 'RJB Box Border Style', defval: 'solid', options: BORDER_OPTIONS, group: G_RJB, tooltip: BORDER_TIP },
  { id: 'rjbBorderTransparency', type: 'int', title: 'RJB Border Box Transparency', defval: 80, min: 0, max: 100, group: G_RJB },
  { id: 'rjbMaxBoxSet', type: 'int', title: 'Maximum RJB Box Displayed', defval: 10, min: 1, max: 100, group: G_RJB, tooltip: MAX_TIP },
  { id: 'filterMitRJB', type: 'bool', title: 'Custom Color Mitigated RJB', defval: false, group: G_RJB },
  { id: 'mitRJBColor', type: 'color', title: 'Mitigated RJB Color', defval: GRAY_90, group: G_RJB, inline: 'Set Custom Color Mit RJB', tooltip: 'Set to 100 to make mitigated RJB disappear' },

  { id: 'plotPVT', type: 'bool', title: 'Plot Pivots', defval: true, group: G_PVT },
  { id: 'pivotLookup', type: 'int', title: 'Pivot Lookup', defval: 1, min: 1, max: 5, group: G_PVT, tooltip: 'Minimum = 1, Maximum = 5' },
  { id: 'pvtTopColor', type: 'color', title: 'Pivot Top Color', defval: SILVER, group: G_PVT, inline: 'PVT Color' },
  { id: 'pvtBottomColor', type: 'color', title: 'Pivot Bottom Color', defval: SILVER, group: G_PVT, inline: 'PVT Color' },

  { id: 'plotBOS', type: 'bool', title: 'Plot BoS', defval: false, group: G_BOS, inline: 'BOS sets' },
  { id: 'useHighLowForBullishBoS', type: 'bool', title: 'Use High/Low for Bullish BoS (for Bearish setup)', defval: false, group: G_BOS },
  { id: 'useHighLowForBearishBoS', type: 'bool', title: 'Use High/Low for Bearish BoS (for Bullish setup)', defval: false, group: G_BOS },
  { id: 'bosBoxFlag', type: 'bool', title: 'BoS Box Length Manually', defval: false, group: G_BOS, tooltip: 'If activated the BoS Boxes will not extend unitl crossed by price. Instead will extend by the amount of bars choosen in the "Set BoS Box Length Manually" option' },
  { id: 'bosBoxLength', type: 'int', title: 'BoS Box Length Manually', defval: 3, min: 1, max: 5, group: G_BOS, inline: 'BoS Boxes', tooltip: 'If "Set BoS Box Length Manually" is marked, choose by how many bars. Minimum = 1, Maximum = 5' },
  { id: 'bosBullColor', type: 'color', title: 'Bullish BoS Color', defval: GREEN_90, inline: CC, group: G_BOS },
  { id: 'bosBearColor', type: 'color', title: 'Bearish BoS Color', defval: RED_90, inline: CC, group: G_BOS },
  { id: 'bosBoxBorder', type: 'string', title: 'BoS Box Border Style', defval: 'solid', options: BORDER_OPTIONS, group: G_BOS, tooltip: BORDER_TIP },
  { id: 'bosBorderTransparency', type: 'int', title: 'BoS Border Box Transparency', defval: 80, min: 0, max: 100, group: G_BOS },
  { id: 'bosMaxBoxSet', type: 'int', title: 'Maximum BoS Box Displayed', defval: 10, min: 1, max: 100, group: G_BOS, tooltip: MAX_TIP },

  { id: 'plotHVB', type: 'bool', title: 'Plot HVB', defval: true, group: G_HVB, tooltip: 'A candle where the average volume is higher than last few bars.' },
  { id: 'hvbBullColor', type: 'color', title: 'Bullish HVB Color', defval: GREEN, inline: CC, group: G_HVB },
  { id: 'hvbBearColor', type: 'color', title: 'Bearish HVB Color', defval: RED, inline: CC, group: G_HVB },
  { id: 'hvbEMAPeriod', type: 'int', title: 'Volume EMA Period', defval: 12, min: 1, group: G_HVB },
  { id: 'hvbMultiplier', type: 'float', title: 'Volume Multiplier', defval: 1.5, min: 1, max: 100, group: G_HVB },

  { id: 'plotPPDD', type: 'bool', title: "Plot PPDD OB's", defval: true, group: G_Q, tooltip: 'Premium Premium Discount Discount (PPDD) is an OB formed after liquidity sweep. It will show up by default as a triangle (Bull ▲ / Bear ▼). Also PPDD1 (by deafult maked with a x-cross ⨯) which is a weak OB formed after liquidity sweep, that fails to completely engulf the high/low, but closes beyond the trapped candles open price.' },
  { id: 'ppddBullColor', type: 'color', title: "Bullish PPDD OB's Color", defval: GREEN, group: G_Q, inline: 'PPDD Color' },
  { id: 'ppddBearColor', type: 'color', title: "Bearish PPDD OB's Color", defval: RED, group: G_Q, inline: 'PPDD Color' },
  { id: 'plotOBFVG', type: 'bool', title: 'Plot Stacked OB+FVG', defval: true, group: G_Q, tooltip: 'Marks the candle (default with a diamond ◆) when an OB & FVG are stacked, showing momentum' },
  { id: 'obfvgBullColor', type: 'color', title: 'Bullish Stacked OB+FVG Color', defval: GREEN, group: G_Q, inline: 'OBFVG Color' },
  { id: 'obfvgBearColor', type: 'color', title: 'Bearish Stacked OB+FVG Color', defval: RED, group: G_Q, inline: 'OBFVG Color' },

  { id: 'plotLabelOB', type: 'bool', title: 'Plot OB Label', defval: true, inline: 'OB label', group: G_LAB },
  { id: 'obLabelColor', type: 'color', title: 'Color', defval: GRAY, inline: 'OB label', group: G_LAB },
  { id: 'obLabelSize', type: 'string', title: 'Size', defval: 'tiny', options: SIZE_OPTIONS, inline: 'OB label', group: G_LAB },
  { id: 'plotLabelFVG', type: 'bool', title: 'Plot FVG Label', defval: true, inline: 'FVG label', group: G_LAB },
  { id: 'fvgLabelColor', type: 'color', title: 'Color', defval: GRAY, inline: 'FVG label', group: G_LAB },
  { id: 'fvgLabelSize', type: 'string', title: 'Size', defval: 'tiny', options: SIZE_OPTIONS, inline: 'FVG label', group: G_LAB },
  { id: 'plotLabelRJB', type: 'bool', title: 'Plot RJB Label', defval: true, inline: 'RJB label', group: G_LAB },
  { id: 'rjbLabelColor', type: 'color', title: 'Color', defval: GRAY, inline: 'RJB label', group: G_LAB },
  { id: 'rjbLabelSize', type: 'string', title: 'Size', defval: 'tiny', options: SIZE_OPTIONS, inline: 'RJB label', group: G_LAB },
  { id: 'plotLabelBOS', type: 'bool', title: 'Plot BoS Label', defval: true, inline: 'BOS label', group: G_LAB },
  { id: 'bosLabelColor', type: 'color', title: 'Color', defval: GRAY, inline: 'BOS label', group: G_LAB },
  { id: 'bosLabelSize', type: 'string', title: 'Size', defval: 'tiny', options: SIZE_OPTIONS, inline: 'BOS label', group: G_LAB },
];

export const plotConfig: PlotConfig[] = [
  // offset = -pivotLookup (the default lookup is 1); the points are already shifted
  { id: 'plot0', title: 'Pivot Top', color: SILVER, lineWidth: 1, offset: -1 },
  { id: 'plot1', title: 'Pivot Bottom', color: SILVER, lineWidth: 1, offset: -1 },
];

export const metadata = {
  title: 'Super OrderBlock / FVG / BoS Tools by makuchaku & eFe',
  shortTitle: 'Super OrderBlock / FVG / BoS Tools by makuchaku & eFe',
  overlay: true,
};

/** A box as the script keeps it (x in bar indexes) */
interface ScriptBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  bgColor: string;
  borderColor: string;
  borderStyle: BorderStyle;
  text: string;
  textSize: PineSize;
  textColor: string;
  deleted: boolean;
}

const OB = 1;
const FVG = 2;
const RJB = 3;
const BOS = 4;
const MAX_BOXES = 500;

export function calculate(
  bars: Bar[],
  inputs: Partial<SuperOrderblockFvgBosInputs> = {},
): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; boxes: BoxData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const interval = barInterval(bars);
  const { gt, lt, ne } = compare;

  // History reads: na before the first bar
  const O = (i: number) => (i >= 0 ? bars[i].open : NaN);
  const H = (i: number) => (i >= 0 ? bars[i].high : NaN);
  const L = (i: number) => (i >= 0 ? bars[i].low : NaN);
  const C = (i: number) => (i >= 0 ? bars[i].close : NaN);

  const isUp = (i: number) => gt(C(i), O(i));
  const isDown = (i: number) => lt(C(i), O(i));
  const isObUp = (i: number) => isDown(i - 1) && isUp(i) && gt(C(i), H(i - 1));
  const isObDown = (i: number) => isUp(i - 1) && isDown(i) && lt(C(i), L(i - 1));
  const isFvgUp = (i: number) => gt(L(i), H(i - 2));
  const isFvgDown = (i: number) => lt(H(i), L(i - 2));

  // Pivots: top = ta.valuewhen(hih, high[pivotLookup], 0) (hih as a condition: not na and not 0)
  const look = cfg.pivotLookup;
  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const closeS = new Series(bars, (b) => b.close);
  const hih = ta.pivothigh(highS, look, look).toArray();
  const lol = ta.pivotlow(lowS, look, look).toArray();
  const isTrue = (v: number | null | undefined) => v != null && !Number.isNaN(v) && v !== 0;
  const top: number[] = new Array(n).fill(NaN);
  const bottom: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    top[i] = isTrue(hih[i]) ? H(i - look) : i > 0 ? top[i - 1] : NaN;
    bottom[i] = isTrue(lol[i]) ? L(i - look) : i > 0 ? bottom[i - 1] : NaN;
  }
  const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);

  // plot(top, offset = -pivotLookup, color = top != top[1] ? na : (plotPVT ? pvtTopColor : na)): the value and
  // the colour of bar i are drawn on bar i - pivotLookup
  type Point = { time: number; value: number; color?: string };
  const plot0: Point[] = [];
  const plot1: Point[] = [];
  for (let i = look; i < n; i++) {
    const time = barTime(bars, i - look, interval);
    plot0.push({ time, value: top[i], color: ne(top[i], at(top, i - 1)) || !cfg.plotPVT ? 'transparent' : cfg.pvtTopColor });
    plot1.push({ time, value: bottom[i], color: ne(bottom[i], at(bottom, i - 1)) || !cfg.plotPVT ? 'transparent' : cfg.pvtBottomColor });
  }

  // Break of structure crossings (the calls are inside `if plotBOS`: an input, so they run on every bar or never)
  const topS = Series.fromArray(bars, top);
  const bottomS = Series.fromArray(bars, bottom);
  const bosUp = cfg.plotBOS ? ta.crossover(cfg.useHighLowForBullishBoS ? highS : closeS, topS).toArray() : [];
  const bosDown = cfg.plotBOS ? ta.crossunder(cfg.useHighLowForBearishBoS ? lowS : closeS, bottomS).toArray() : [];

  // High volume bars
  const volS = new Series(bars, (b) => b.volume ?? NaN);
  const volEma = ta.ema(volS, cfg.hvbEMAPeriod).toArray();

  const allBoxes: ScriptBox[] = [];
  let alive: ScriptBox[] = [];
  const newBox = (
    left: number, top_: number, right: number, bottom_: number, bg: string, borderTransp: number, style: BorderStyle,
    text: string, size: PineSize, textColor: string,
  ): ScriptBox => {
    const b: ScriptBox = {
      left, top: top_, right, bottom: bottom_, bgColor: bg, borderColor: String(color.new_color(bg, borderTransp)),
      borderStyle: style, text, textSize: size, textColor, deleted: false,
    };
    allBoxes.push(b);
    // max_boxes_count = 500: when a new box brings the count above 505, the oldest are deleted until 500 remain
    alive.push(b);
    if (alive.length > MAX_BOXES + 5) {
      alive = alive.filter((x) => !x.deleted);
      if (alive.length > MAX_BOXES + 5) {
        for (const old of alive.splice(0, alive.length - MAX_BOXES)) old.deleted = true;
      }
    }
    return b;
  };
  // if array.size(arr) > max: box.delete(array.shift(arr)); array.push(arr, box). A slot can hold na (no box made).
  const keep = (arr: Array<ScriptBox | null>, max: number, b: ScriptBox | null) => {
    if (arr.length > max) {
      const old = arr.shift();
      if (old) old.deleted = true;
    }
    arr.push(b);
  };

  const bearOB: Array<ScriptBox | null> = [];
  const bullOB: Array<ScriptBox | null> = [];
  const bearFVG: Array<ScriptBox | null> = [];
  const bullFVG: Array<ScriptBox | null> = [];
  const bearRJB: Array<ScriptBox | null> = [];
  const bullRJB: Array<ScriptBox | null> = [];
  const bearBOS: Array<ScriptBox | null> = [];
  const bullBOS: Array<ScriptBox | null> = [];

  // _controlBox: a box whose right edge is on the current bar grows one bar, unless the bar crosses its bottom
  // or its top
  const controlBox = (arr: Array<ScriptBox | null>, i: number, type: number) => {
    const high = H(i);
    const low = L(i);
    for (let k = arr.length - 1; k >= 0; k--) {
      const b = arr[k];
      if (!b || b.deleted) continue;
      const crossed = (gt(high, b.bottom) && lt(low, b.bottom)) || (gt(high, b.top) && lt(low, b.top));
      if (cfg.bosBoxFlag && type === BOS) {
        if (i + cfg.bosBoxLength - 1 === b.right && !crossed) b.right = i + cfg.bosBoxLength - 1;
      } else if ((cfg.filterMitOB && type === OB) || (cfg.filterMitFVG && type === FVG) || (cfg.filterMitRJB && type === RJB)) {
        if (i === b.right && !crossed) {
          b.right = i + 1;
        } else {
          const mit = type === OB ? cfg.mitOBColor : type === FVG ? cfg.mitFVGColor : cfg.mitRJBColor;
          b.bgColor = mit;
          b.borderColor = mit;
        }
      } else if (i === b.right && !crossed) {
        b.right = i + 1;
      }
    }
  };

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  for (let i = 0; i < n; i++) {
    const time = bars[i].time;

    // Order blocks
    if (isObUp(i - 1) && cfg.plotOB) {
      keep(bullOB, cfg.obMaxBoxSet, newBox(i - 2, H(i - 2), i, Math.min(L(i - 2), L(i - 1)), cfg.obBullColor,
        cfg.obBorderTransparency, cfg.obBoxBorder, cfg.plotLabelOB ? 'OB+' : '', cfg.obLabelSize, cfg.obLabelColor));
    }
    if (isObDown(i - 1) && cfg.plotOB) {
      keep(bearOB, cfg.obMaxBoxSet, newBox(i - 2, Math.max(H(i - 2), H(i - 1)), i, L(i - 2), cfg.obBearColor,
        cfg.obBorderTransparency, cfg.obBoxBorder, cfg.plotLabelOB ? 'OB-' : '', cfg.obLabelSize, cfg.obLabelColor));
    }
    if (cfg.plotOB) {
      controlBox(bearOB, i, OB);
      controlBox(bullOB, i, OB);
    }

    // Fair value gaps
    const fvgText = (sign: string) => (cfg.plotLabelFVG ? `FVG${sign}` : '');
    if (isFvgUp(i)) {
      let b: ScriptBox | null = null;
      const t = top[i];
      const structure = cfg.plotStructureBreakingFVG && gt(C(i - 1), t) && lt(L(i - 1), t) && lt(H(i - 2), t) && gt(L(i), t);
      if (structure || cfg.plotFVG) {
        b = newBox(i - 2, L(i), i, H(i - 2), structure ? cfg.fvgStructBreakingColor : cfg.fvgBullColor,
          cfg.fvgBorderTransparency, cfg.fvgBoxBorder, fvgText('+'), cfg.fvgLabelSize, cfg.fvgLabelColor);
      }
      keep(bullFVG, cfg.fvgMaxBoxSet, b);
    }
    if (isFvgDown(i)) {
      let b: ScriptBox | null = null;
      const bt = bottom[i];
      const structure = cfg.plotStructureBreakingFVG && lt(C(i - 1), bt) && gt(H(i - 1), bt) && gt(L(i - 2), bt) && lt(H(i), bt);
      if (structure || cfg.plotFVG) {
        b = newBox(i - 2, L(i - 2), i, H(i), structure ? cfg.fvgStructBreakingColor : cfg.fvgBearColor,
          cfg.fvgBorderTransparency, cfg.fvgBoxBorder, fvgText('-'), cfg.fvgLabelSize, cfg.fvgLabelColor);
      }
      keep(bearFVG, cfg.fvgMaxBoxSet, b);
    }
    if (cfg.plotFVG || cfg.plotStructureBreakingFVG) {
      controlBox(bearFVG, i, FVG);
      controlBox(bullFVG, i, FVG);
    }

    // Rejection blocks
    if (cfg.plotRJB) {
      const rjbBox = (left: number, top_: number, bottom_: number, bg: string, sign: string) =>
        newBox(left, top_, i, bottom_, bg, cfg.rjbBorderTransparency, cfg.rjbBoxBorder,
          cfg.plotLabelRJB ? `RJB${sign}` : '', cfg.rjbLabelSize, cfg.rjbLabelColor);
      const downOb = isObDown(i - 1);
      // on the wick of the trapped bar / on the wick of the signal bar
      if (downOb && lt(H(i - 1), C(i - 2) + 0.2 * (H(i - 2) - C(i - 2)))) {
        keep(bearRJB, cfg.rjbMaxBoxSet, rjbBox(i - 2, H(i - 2), C(i - 2), cfg.rjbBearColor, '-'));
      }
      if (downOb && gt(H(i - 1), H(i - 2))) {
        keep(bearRJB, cfg.rjbMaxBoxSet, rjbBox(i - 1, H(i - 1), O(i - 1), cfg.rjbBearColor, '-'));
      }
      const upOb = isObUp(i - 1);
      if (upOb && gt(L(i - 1), C(i - 2) - 0.2 * (C(i - 2) - L(i - 2)))) {
        keep(bullRJB, cfg.rjbMaxBoxSet, rjbBox(i - 2, C(i - 2), L(i - 2), cfg.rjbBullColor, '+'));
      }
      if (upOb && lt(L(i - 1), L(i - 2))) {
        keep(bullRJB, cfg.rjbMaxBoxSet, rjbBox(i - 1, O(i - 1), L(i - 1), cfg.rjbBullColor, '+'));
      }
      controlBox(bearRJB, i, RJB);
      controlBox(bullRJB, i, RJB);
    }

    // Breaks of structure
    if (cfg.plotBOS) {
      const right = cfg.bosBoxFlag ? i + cfg.bosBoxLength : i + 1;
      if (bosUp[i]) {
        keep(bullBOS, cfg.bosMaxBoxSet, newBox(i, top[i], right, bottom[i], cfg.bosBullColor, cfg.bosBorderTransparency,
          cfg.bosBoxBorder, cfg.plotLabelBOS ? 'BoS+' : '', cfg.bosLabelSize, cfg.bosLabelColor));
      }
      if (bosDown[i]) {
        keep(bearBOS, cfg.bosMaxBoxSet, newBox(i, top[i], right, bottom[i], cfg.bosBearColor, cfg.bosBorderTransparency,
          cfg.bosBoxBorder, cfg.plotLabelBOS ? 'BoS-' : '', cfg.bosLabelSize, cfg.bosLabelColor));
      }
      controlBox(bearBOS, i, BOS);
      controlBox(bullBOS, i, BOS);
    }

    // Premium Premium / Discount Discount
    const t0 = top[i];
    const t1 = at(top, i - 1);
    const b0 = bottom[i];
    const b1 = at(bottom, i - 1);
    const maxH = Math.max(H(i), H(i - 1));
    const minL = Math.min(L(i), L(i - 1));
    const sweptTop = (gt(maxH, t0) && lt(C(i), t0)) || (gt(maxH, t1) && lt(C(i), t1));
    const sweptBottom = (lt(minL, b0) && gt(C(i), b0)) || (lt(minL, b1) && gt(C(i), b1));
    const premiumPremium = cfg.plotPPDD && isObDown(i) && sweptTop;
    const discountDiscount = cfg.plotPPDD && isObUp(i) && sweptBottom;
    const premiumPremium1 = cfg.plotPPDD && isUp(i - 1) && isDown(i) && lt(C(i), O(i - 1)) && sweptTop && !premiumPremium;
    const discountDiscount1 = cfg.plotPPDD && isDown(i - 1) && isUp(i) && gt(C(i), O(i - 1)) && sweptBottom && !discountDiscount;
    if (premiumPremium) markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.ppddBearColor, size: 'tiny' });
    if (discountDiscount) markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.ppddBullColor, size: 'tiny' });
    if (premiumPremium1) markers.push({ time, position: 'aboveBar', shape: 'xcross', color: cfg.ppddBearColor, size: 'tiny' });
    if (discountDiscount1) markers.push({ time, position: 'belowBar', shape: 'xcross', color: cfg.ppddBullColor, size: 'tiny' });

    // High volume bars: barcolor(bull), then barcolor(bear)
    const vol = bars[i].volume ?? NaN;
    const isHighVolume = gt(vol, cfg.hvbMultiplier * (volEma[i] ?? NaN));
    if (cfg.plotHVB && isHighVolume) {
      if (isUp(i)) barColors.push({ time, color: cfg.hvbBullColor });
      else if (isDown(i)) barColors.push({ time, color: cfg.hvbBearColor });
    }

    // Stacked OB + FVG
    if (cfg.plotOBFVG && isFvgDown(i) && isObDown(i - 1)) {
      markers.push({ time, position: 'aboveBar', shape: 'diamond', color: cfg.obfvgBearColor, size: 'tiny' });
    }
    if (cfg.plotOBFVG && isFvgUp(i) && isObUp(i - 1)) {
      markers.push({ time, position: 'belowBar', shape: 'diamond', color: cfg.obfvgBullColor, size: 'tiny' });
    }
  }

  // Boxes alive after the last bar; a box with an na point (or a left edge before the first bar) is not drawn
  const boxes: BoxData[] = [];
  for (const b of allBoxes) {
    if (b.deleted || b.left < 0 || Number.isNaN(b.top) || Number.isNaN(b.bottom)) continue;
    boxes.push({
      time1: barTime(bars, b.left, interval), price1: b.top, time2: barTime(bars, b.right, interval), price2: b.bottom,
      bgColor: b.bgColor, borderColor: b.borderColor, borderWidth: 1, borderStyle: b.borderStyle,
      text: b.text, textSize: b.textSize, textColor: b.textColor, textHAlign: 'right', textVAlign: 'bottom',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    markers,
    barColors,
    boxes,
  };
}

export const SuperOrderblockFvgBos = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
