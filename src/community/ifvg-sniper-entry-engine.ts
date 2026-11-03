/**
 * IFVG Sniper Entry Engine
 *
 * Keeps a hidden memory of three-bar fair value gaps (bullish: low above the high of two bars back; bearish: high
 * below the low of two bars back; at least "Minimum FVG Size" ticks), with the gap size / ATR, the body ratio and
 * the range / ATR of the candle that made them. Each gap ages by one bar and expires after "Max Hidden FVG Age"
 * bars (oldest dropped above "Hidden FVG Memory"). A close beyond the far side of a gap plus a clean-break ATR buffer
 * inverts it (newest gap first, one per bar): a bearish gap closed above becomes a bullish IFVG+, a bullish gap
 * closed below a bearish IFVG-. When the candle quality filter passes, an IFVG line (broken boundary, confirmation
 * close or midpoint) with a label is drawn; it is deleted when a close crosses back beyond the gap. The first IFVG
 * while no trade is active opens a visual trade: entry (IFVG line or confirmation close), stop at ATR x multiplier,
 * target at the selected R multiple, with TP / SL boxes, lines and labels that extend with the bars and are
 * deleted when the stop (checked first) or the target is touched. A dashboard shows the filter, the last signal,
 * the trade state and levels, and the counts. The engine runs on confirmed bars only (the open last bar is left
 * out); the trade box extension and the TP / SL check run on every bar.
 *
 * Chart values (optional third argument of calculate): the symbol tick (minimum gap, candle range floor, ATR
 * fallback, prices in the tooltips and the dashboard) and whether the last bar is still open.
 *
 * Reference: "IFVG Sniper Entry Engine [trade_w_samet]" by tradewsamet
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, color, line, label, box, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type Line, type Label, type Box,
} from 'oakscriptjs';
import { lastBarConfirmedOf, mintickOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

type FilterMode = 'Off' | 'Loose' | 'Balanced' | 'Strict' | 'Custom';
type LabelSize = 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';

export interface IfvgSniperEntryEngineInputs {
  maxHiddenFVG: number;
  maxFvgAge: number;
  minGapTicks: number;
  maxVisibleIFVG: number;
  ifvgLengthBars: number;
  linePriceMode: 'Broken Boundary' | 'Confirmation Close' | 'Midpoint';
  deleteInvalidIFVG: boolean;
  filterMode: FilterMode;
  customMinGapAtr: number;
  customMinBodyRatio: number;
  customMinRangeAtr: number;
  customBreakAtr: number;
  entryMode: 'IFVG Line' | 'Confirmation Close';
  atrLen: number;
  slAtrMult: number;
  tpRRInput: '1R' | '2R' | '3R' | '4R' | '5R' | '6R';
  initialBoxLength: number;
  themePackage: 'Obsidian Sniper' | 'Ice Blue' | 'Royal Gold';
  useThemePackage: boolean;
  customBullIFVGColor: string;
  customBearIFVGColor: string;
  ifvgLabelSizeInput: LabelSize;
  customEntryColor: string;
  customSLColor: string;
  customTPColor: string;
  customDashboardBg: string;
  customDashboardText: string;
  showDashboard: boolean;
}

export const defaultInputs: IfvgSniperEntryEngineInputs = {
  maxHiddenFVG: 120,
  maxFvgAge: 60,
  minGapTicks: 0,
  maxVisibleIFVG: 20,
  ifvgLengthBars: 50,
  linePriceMode: 'Broken Boundary',
  deleteInvalidIFVG: true,
  filterMode: 'Balanced',
  customMinGapAtr: 0.25,
  customMinBodyRatio: 0.5,
  customMinRangeAtr: 0.6,
  customBreakAtr: 0.05,
  entryMode: 'IFVG Line',
  atrLen: 14,
  slAtrMult: 1.5,
  tpRRInput: '3R',
  initialBoxLength: 5,
  themePackage: 'Obsidian Sniper',
  useThemePackage: true,
  customBullIFVGColor: '#0078FF',
  customBearIFVGColor: '#FF3C46',
  ifvgLabelSizeInput: 'Large',
  customEntryColor: '#FFFFFF',
  customSLColor: '#DC3232',
  customTPColor: '#00BE6E',
  customDashboardBg: '#0C0C10',
  customDashboardText: '#FFFFFF',
  showDashboard: true,
};

const G1 = '⚙️ 01. IFVG Engine';
const G2 = '💎 02. IFVG Filter';
const G3 = '🎯 03. IFVG Entry Model';
const G4 = '🎨 04. Visual Style';
const G5 = '📟 05. Dashboard';

export const inputConfig: InputConfig[] = [
  { id: 'maxHiddenFVG', type: 'int', title: '🧠 Hidden FVG Memory', defval: 120, min: 10, max: 500, group: G1, tooltip: 'Controls how many hidden FVG structures are stored internally before IFVG inversion is checked.' },
  { id: 'maxFvgAge', type: 'int', title: '⏳ Max Hidden FVG Age', defval: 60, min: 5, max: 500, group: G1, tooltip: 'Maximum bar age for hidden FVG structures before they expire.' },
  { id: 'minGapTicks', type: 'int', title: '📏 Minimum FVG Size / Ticks', defval: 0, min: 0, group: G1, tooltip: 'Minimum raw tick size required before a hidden FVG can be stored.' },
  { id: 'maxVisibleIFVG', type: 'int', title: '📌 Max Visible IFVG', defval: 20, min: 1, max: 100, group: G1, tooltip: 'Maximum number of visible IFVG lines kept on the chart.' },
  { id: 'ifvgLengthBars', type: 'int', title: '↔️ IFVG Line Length Bars', defval: 50, min: 5, max: 500, group: G1, tooltip: 'Controls how far IFVG lines extend to the right.' },
  { id: 'linePriceMode', type: 'string', title: '📍 IFVG Line Price', defval: 'Broken Boundary', options: ['Broken Boundary', 'Confirmation Close', 'Midpoint'], group: G1, tooltip: 'Controls whether IFVG lines are drawn from the broken boundary, confirmation close, or midpoint.' },
  { id: 'deleteInvalidIFVG', type: 'bool', title: '🧹 Delete Invalidated IFVG', defval: true, group: G1, tooltip: 'Automatically deletes IFVG lines when price invalidates the structure.' },
  { id: 'filterMode', type: 'string', title: '💎 IFVG Filter Mode', defval: 'Balanced', options: ['Off', 'Loose', 'Balanced', 'Strict', 'Custom'], group: G2, tooltip: 'Controls how strict the IFVG quality filter should be.' },
  { id: 'customMinGapAtr', type: 'float', title: '💎 Custom Minimum Gap / ATR', defval: 0.25, min: 0, step: 0.05, group: G2, tooltip: 'Custom minimum gap size measured against ATR. Used only in Custom mode.' },
  { id: 'customMinBodyRatio', type: 'float', title: '💎 Custom Minimum Body Ratio', defval: 0.5, min: 0, max: 1, step: 0.05, group: G2, tooltip: 'Custom minimum candle body ratio. Used only in Custom mode.' },
  { id: 'customMinRangeAtr', type: 'float', title: '💎 Custom Minimum Range / ATR', defval: 0.6, min: 0, step: 0.05, group: G2, tooltip: 'Custom minimum candle range measured against ATR. Used only in Custom mode.' },
  { id: 'customBreakAtr', type: 'float', title: '💎 Custom Clean Break Buffer / ATR', defval: 0.05, min: 0, step: 0.01, group: G2, tooltip: 'Extra ATR buffer required for IFVG confirmation. Used only in Custom mode.' },
  { id: 'entryMode', type: 'string', title: '🎯 Entry Price', defval: 'IFVG Line', options: ['IFVG Line', 'Confirmation Close'], group: G3, tooltip: 'IFVG Line uses the IFVG level as entry reference. Confirmation Close uses the close that confirmed the IFVG.' },
  { id: 'atrLen', type: 'int', title: '📐 ATR Length', defval: 14, min: 1, group: G3, tooltip: 'ATR length used for the visual SL calculation.' },
  { id: 'slAtrMult', type: 'float', title: '🛡️ SL ATR Multiplier', defval: 1.5, min: 0.1, step: 0.1, group: G3, tooltip: 'Controls how far the visual SL is placed from entry using ATR.' },
  { id: 'tpRRInput', type: 'string', title: '🎯 Take Profit RR', defval: '3R', options: ['1R', '2R', '3R', '4R', '5R', '6R'], group: G3, tooltip: 'Selects the visual take-profit RR target.' },
  { id: 'initialBoxLength', type: 'int', title: '📦 Initial TP / SL Box Length', defval: 5, min: 1, max: 50, group: G3, tooltip: 'Initial box extension length when a new IFVG trade model appears.' },
  { id: 'themePackage', type: 'string', title: '🎨 Theme Package', defval: 'Obsidian Sniper', options: ['Obsidian Sniper', 'Ice Blue', 'Royal Gold'], group: G4, tooltip: 'Applies one of three premium color packages to IFVG lines, trade boxes, trade levels, and dashboard colors.' },
  { id: 'useThemePackage', type: 'bool', title: '🎨 Use Theme Package Colors', defval: true, group: G4, tooltip: 'When enabled, colors are controlled by the selected theme package. Disable it to use custom colors.' },
  { id: 'customBullIFVGColor', type: 'color', title: '🟦 Custom Bullish IFVG Color', defval: '#0078FF', group: G4, tooltip: 'Custom bullish IFVG color. Used only when Theme Package Colors is disabled.' },
  { id: 'customBearIFVGColor', type: 'color', title: '🟥 Custom Bearish IFVG Color', defval: '#FF3C46', group: G4, tooltip: 'Custom bearish IFVG color. Used only when Theme Package Colors is disabled.' },
  { id: 'ifvgLabelSizeInput', type: 'string', title: '🏷️ IFVG Label Size', defval: 'Large', options: ['Tiny', 'Small', 'Normal', 'Large', 'Huge'], group: G4, tooltip: 'Controls IFVG+ and IFVG- label size.' },
  { id: 'customEntryColor', type: 'color', title: '⚪ Custom Entry Line Color', defval: '#FFFFFF', group: G4, tooltip: 'Custom ENTRY line color. Used only when Theme Package Colors is disabled.' },
  { id: 'customSLColor', type: 'color', title: '🛑 Custom SL Color', defval: '#DC3232', group: G4, tooltip: 'Custom SL line and box color. Used only when Theme Package Colors is disabled.' },
  { id: 'customTPColor', type: 'color', title: '🎯 Custom TP Color', defval: '#00BE6E', group: G4, tooltip: 'Custom TP line and box color. Used only when Theme Package Colors is disabled.' },
  { id: 'customDashboardBg', type: 'color', title: '📟 Custom Dashboard Background', defval: '#0C0C10', group: G4, tooltip: 'Custom dashboard background color. Used only when Theme Package Colors is disabled.' },
  { id: 'customDashboardText', type: 'color', title: '📟 Custom Dashboard Text', defval: '#FFFFFF', group: G4, tooltip: 'Custom dashboard text color. Used only when Theme Package Colors is disabled.' },
  { id: 'showDashboard', type: 'bool', title: '📟 Show Dashboard', defval: true, group: G5, tooltip: 'Shows or hides the IFVG Sniper dashboard.' },
];

// Drawings, a table and alert conditions only: no plots
export const plotConfig: PlotConfig[] = [];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'IFVG Sniper Bullish Entry', message: 'IFVG Sniper Entry Engine | Bullish IFVG Entry confirmed on {{ticker}} / {{interval}}' },
  { id: 'alert1', title: 'IFVG Sniper Bearish Entry', message: 'IFVG Sniper Entry Engine | Bearish IFVG Entry confirmed on {{ticker}} / {{interval}}' },
  { id: 'alert2', title: 'IFVG Sniper Bullish IFVG+', message: 'IFVG Sniper Entry Engine | Bullish IFVG+ formed on {{ticker}} / {{interval}}' },
  { id: 'alert3', title: 'IFVG Sniper Bearish IFVG-', message: 'IFVG Sniper Entry Engine | Bearish IFVG- formed on {{ticker}} / {{interval}}' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'table'];

export const metadata = {
  title: 'IFVG Sniper Entry Engine [trade_w_samet]',
  shortTitle: 'IFVG Sniper Entry Engine [trade_w_samet]',
  overlay: true,
};

/** Pine float comparisons: within 1e-10 is equal; na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** One hidden FVG of the memory */
interface RawFvg {
  top: number;
  bot: number;
  dir: number;
  age: number;
  gapAtr: number;
  bodyRatio: number;
  rangeAtr: number;
}

/** One visible IFVG */
interface VisibleIfvg {
  ln: Line;
  lb: Label | null;
  top: number;
  bot: number;
  dir: number;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<IfvgSniperEntryEngineInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const mintick = mintickOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);
  const filterMode = cfg.filterMode;
  const theme = cfg.themePackage;
  const ice = theme === 'Ice Blue';
  const gold = theme === 'Royal Gold';
  const rgb = (r: number, g: number, b: number) => String(color.rgb(r, g, b));

  // Theme engine
  const useTheme = cfg.useThemePackage;
  const bullIFVGColor = useTheme ? (ice ? rgb(0, 180, 255) : gold ? rgb(212, 175, 55) : rgb(0, 120, 255)) : cfg.customBullIFVGColor;
  const bearIFVGColor = useTheme ? (ice ? rgb(255, 80, 120) : gold ? rgb(210, 45, 65) : rgb(255, 60, 70)) : cfg.customBearIFVGColor;
  const entryColor = useTheme ? (ice ? rgb(235, 250, 255) : gold ? rgb(255, 245, 210) : color.white) : cfg.customEntryColor;
  const slColor = useTheme ? (ice ? rgb(255, 70, 115) : gold ? rgb(210, 45, 65) : rgb(220, 50, 50)) : cfg.customSLColor;
  const tpColor = useTheme ? (ice ? rgb(0, 220, 255) : gold ? rgb(212, 175, 55) : rgb(0, 190, 110)) : cfg.customTPColor;
  const dashboardBg = useTheme ? (ice ? rgb(8, 20, 32) : gold ? rgb(20, 15, 8) : rgb(12, 12, 16)) : cfg.customDashboardBg;
  const dashboardText = useTheme ? (ice ? rgb(230, 248, 255) : gold ? rgb(255, 245, 215) : color.white) : cfg.customDashboardText;

  // Core values
  const atr = ta.atr(bars, Math.trunc(cfg.atrLen)).toArray();
  const tpRR = cfg.tpRRInput === '1R' ? 1 : cfg.tpRRInput === '2R' ? 2 : cfg.tpRRInput === '3R' ? 3
    : cfg.tpRRInput === '4R' ? 4 : cfg.tpRRInput === '5R' ? 5 : 6;

  // Filter helpers
  const minGapAtr = filterMode === 'Off' ? 0 : filterMode === 'Loose' ? 0.15 : filterMode === 'Balanced' ? 0.25
    : filterMode === 'Strict' ? 0.4 : cfg.customMinGapAtr;
  const minBodyRatio = filterMode === 'Off' ? 0 : filterMode === 'Loose' ? 0.4 : filterMode === 'Balanced' ? 0.5
    : filterMode === 'Strict' ? 0.6 : cfg.customMinBodyRatio;
  const minRangeAtr = filterMode === 'Off' ? 0 : filterMode === 'Loose' ? 0.4 : filterMode === 'Balanced' ? 0.6
    : filterMode === 'Strict' ? 0.85 : cfg.customMinRangeAtr;
  const breakBufferAtr = filterMode === 'Off' ? 0 : filterMode === 'Loose' ? 0 : filterMode === 'Balanced' ? 0.05
    : filterMode === 'Strict' ? 0.1 : cfg.customBreakAtr;
  const qualityPass = (gapAtr: number, bodyRatio: number, rangeAtr: number) =>
    filterMode === 'Off' || (ge(gapAtr, minGapAtr) && ge(bodyRatio, minBodyRatio) && ge(rangeAtr, minRangeAtr));

  const priceText = (p: number) => (isNaN(p) ? '-' : str.tostring(p, 'mintick', mintick));
  const linePriceOf = (top: number, bot: number, confirmClose: number, dir: number) =>
    cfg.linePriceMode === 'Confirmation Close' ? confirmClose
      : cfg.linePriceMode === 'Midpoint' ? (top + bot) / 2 : dir === 1 ? top : bot;
  const ifvgLabelSize = cfg.ifvgLabelSizeInput.toLowerCase();
  const statusText = (s: number) => (s === 1 ? 'ACTIVE' : s === 2 ? 'TP HIT' : s === -1 ? 'SL HIT' : 'WAITING');
  const statusColor = (s: number) => String(s === -1 ? color.new(slColor, 0) : s === 2 ? color.new(tpColor, 0)
    : s === 1 ? color.new(color.orange, 15) : color.new(color.gray, 35));

  resetDrawings({ line: 500, label: 500, box: 100 });

  // Hidden FVG memory and visible IFVG objects (var arrays)
  let raw: RawFvg[] = [];
  const visible: VisibleIfvg[] = [];

  const deleteVisible = (idx: number) => {
    const v = visible[idx];
    line.delete(v.ln);
    if (v.lb) label.delete(v.lb);
    visible.splice(idx, 1);
  };

  const addVisible = (bar: number, top: number, bot: number, confirmClose: number, dir: number) => {
    const c = dir === 1 ? bullIFVGColor : bearIFVGColor;
    const linePrice = linePriceOf(top, bot, confirmClose, dir);
    const labelText = dir === 1 ? 'IFVG+' : 'IFVG-';
    const tooltip = 'IFVG Sniper Entry Engine\n'
      + 'Direction: ' + (dir === 1 ? 'Bullish IFVG+' : 'Bearish IFVG-') + '\n'
      + 'Filter Mode: ' + filterMode + '\n'
      + 'Top: ' + str.tostring(top, 'mintick', mintick) + '\n'
      + 'Bottom: ' + str.tostring(bot, 'mintick', mintick) + '\n'
      + 'Line Price: ' + str.tostring(linePrice, 'mintick', mintick);
    const ln = line.new(bar, linePrice, bar + cfg.ifvgLengthBars, linePrice, 'bar_index', 'none', c, 'solid', 1);
    const lb = label.new(bar + cfg.ifvgLengthBars, linePrice, labelText, 'bar_index', 'price', String(color.new(c, 0)),
      'label_left', color.white, ifvgLabelSize, undefined, tooltip);
    visible.push({ ln, lb, top, bot, dir });
    while (visible.length > cfg.maxVisibleIFVG) deleteVisible(0);
    return linePrice;
  };

  // Active trade objects only
  let tradeBoxes: Box[] = [];
  let tradeLines: Line[] = [];
  let tradeLabels: Label[] = [];
  const clearTradeObjects = () => {
    for (const bx of tradeBoxes) box.delete(bx);
    for (const ln of tradeLines) line.delete(ln);
    for (const lb of tradeLabels) label.delete(lb);
    tradeBoxes = [];
    tradeLines = [];
    tradeLabels = [];
  };
  const drawTradeObjects = (bar: number, entry: number, sl: number, tp: number) => {
    clearTradeObjects();
    const rightBar = bar + cfg.initialBoxLength;
    const tpTop = Math.max(entry, tp);
    const tpBot = Math.min(entry, tp);
    const slTop = Math.max(entry, sl);
    const slBot = Math.min(entry, sl);
    // the box text colour of Pine v6 is white (no text here)
    const tpBox = box.new(bar, tpTop, rightBar, tpBot, String(color.new(tpColor, 0)), 1, undefined, undefined,
      'bar_index', String(color.new(tpColor, 82)), undefined, undefined, color.white);
    const slBox = box.new(bar, slTop, rightBar, slBot, String(color.new(slColor, 0)), 1, undefined, undefined,
      'bar_index', String(color.new(slColor, 82)), undefined, undefined, color.white);
    const entryLine = line.new(bar, entry, rightBar, entry, 'bar_index', undefined, entryColor, undefined, 2);
    const slLine = line.new(bar, sl, rightBar, sl, 'bar_index', undefined, slColor, undefined, 2);
    const tpLine = line.new(bar, tp, rightBar, tp, 'bar_index', undefined, tpColor, undefined, 2);
    const entryLabel = label.new(rightBar, entry, 'ENTRY', 'bar_index', 'price', entryColor, 'label_left', color.black, 'small');
    const slLabel = label.new(rightBar, sl, 'SL', 'bar_index', 'price', slColor, 'label_left', color.white, 'small');
    const tpLabel = label.new(rightBar, tp, 'TP ' + cfg.tpRRInput, 'bar_index', 'price', tpColor, 'label_left', color.white, 'small');
    tradeBoxes = [tpBox, slBox];
    tradeLines = [entryLine, slLine, tpLine];
    tradeLabels = [entryLabel, slLabel, tpLabel];
  };
  const updateTradeRight = (right: number) => {
    if (tradeBoxes.length >= 2 && tradeLines.length >= 3 && tradeLabels.length >= 3) {
      box.set_right(tradeBoxes[0], right);
      box.set_right(tradeBoxes[1], right);
      for (let k = 0; k < 3; k++) line.set_x2(tradeLines[k], right);
      for (let k = 0; k < 3; k++) label.set_x(tradeLabels[k], right);
    }
  };

  // Trade state (var)
  let lastSignalDir = 0;
  let lastSignalBar = NaN;
  let lastEntry = NaN;
  let lastSL = NaN;
  let lastTP = NaN;
  let lastSignalSide = '-';
  let currentTradeStatus = 0;
  let tradeActive = false;
  let totalSignals = 0;
  let totalWins = 0;
  let totalLosses = 0;
  let filteredIFVG = 0;

  const flags: boolean[][] = [[], [], [], []];

  // var table dash = table.new(position.top_right, 2, 12, border_width = 1)
  const dash = n > 0 ? table.new('top_right', 2, 12, undefined, undefined, undefined, undefined, 1) : null;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const confirmed = i < n - 1 || lastConfirmed;
    const atrValue = atr[i] ?? NaN;
    const safeAtr = isNaN(atrValue) || atrValue <= 0 ? mintick : atrValue;

    let newBullEntry = false;
    let newBearEntry = false;
    let newBullIFVG = false;
    let newBearIFVG = false;
    let newTop = NaN;
    let newBot = NaN;
    let newConfirmClose = NaN;
    let newDir = 0;

    if (confirmed) {
      // Hidden FVG age update, then remove the expired ones
      for (const r of raw) r.age += 1;
      raw = raw.filter((r) => r.age <= cfg.maxFvgAge);

      const minGap = cfg.minGapTicks * mintick;
      const candleRange = Math.max(b.high - b.low, mintick);
      const candleBody = Math.abs(b.close - b.open);
      const bodyRatio = candleBody / candleRange;
      const rangeAtrRatio = candleRange / safeAtr;

      const high2 = i >= 2 ? bars[i - 2].high : NaN;
      const low2 = i >= 2 ? bars[i - 2].low : NaN;
      const rawBullFVG = !isNaN(high2) && gt(b.low, high2) && ge(b.low - high2, minGap);
      const rawBearFVG = !isNaN(low2) && lt(b.high, low2) && ge(low2 - b.high, minGap);
      if (rawBullFVG) {
        raw.push({ top: b.low, bot: high2, dir: 1, age: 0, gapAtr: (b.low - high2) / safeAtr, bodyRatio, rangeAtr: rangeAtrRatio });
      }
      if (rawBearFVG) {
        raw.push({ top: low2, bot: b.high, dir: -1, age: 0, gapAtr: (low2 - b.high) / safeAtr, bodyRatio, rangeAtr: rangeAtrRatio });
      }
      while (raw.length > cfg.maxHiddenFVG) raw.shift();

      // Detect IFVG inversion with filter (newest first, one per bar)
      const cleanBreakBuffer = safeAtr * breakBufferAtr;
      for (let k = raw.length - 1; k >= 0; k--) {
        const r = raw[k];
        const bullishInversion = r.dir === -1 && gt(b.close, r.top + cleanBreakBuffer);
        const bearishInversion = r.dir === 1 && lt(b.close, r.bot - cleanBreakBuffer);
        if (bullishInversion || bearishInversion) {
          if (qualityPass(r.gapAtr, r.bodyRatio, r.rangeAtr)) {
            newBullIFVG = bullishInversion;
            newBearIFVG = bearishInversion;
            newTop = r.top;
            newBot = r.bot;
            newConfirmClose = b.close;
            newDir = bullishInversion ? 1 : -1;
          } else {
            filteredIFVG += 1;
          }
          raw.splice(k, 1);
          break;
        }
      }

      // Only filtered IFVGs appear
      if (newBullIFVG || newBearIFVG) {
        const ifvgLinePrice = addVisible(i, newTop, newBot, newConfirmClose, newDir);
        if (!tradeActive) {
          const entryPrice = cfg.entryMode === 'Confirmation Close' ? newConfirmClose : ifvgLinePrice;
          const risk = atrValue * cfg.slAtrMult;
          const sl = newDir === 1 ? entryPrice - risk : entryPrice + risk;
          const tp = newDir === 1 ? entryPrice + risk * tpRR : entryPrice - risk * tpRR;
          drawTradeObjects(i, entryPrice, sl, tp);
          lastSignalDir = newDir;
          lastSignalBar = i;
          lastEntry = entryPrice;
          lastSL = sl;
          lastTP = tp;
          lastSignalSide = newDir === 1 ? 'Bullish' : 'Bearish';
          currentTradeStatus = 1;
          tradeActive = true;
          newBullEntry = newDir === 1;
          newBearEntry = newDir === -1;
          totalSignals += 1;
        }
      }
    }

    // Active trade box extension
    if (tradeActive && !isNaN(lastSignalBar)) {
      updateTradeRight(Math.max(i, lastSignalBar + cfg.initialBoxLength));
    }

    // IFVG invalidation (newest first)
    if (cfg.deleteInvalidIFVG && confirmed && visible.length > 0) {
      for (let k = visible.length - 1; k >= 0; k--) {
        const v = visible[k];
        const invalidBull = v.dir === 1 && lt(b.close, v.bot);
        const invalidBear = v.dir === -1 && gt(b.close, v.top);
        if (invalidBull || invalidBear) deleteVisible(k);
      }
    }

    // Trade status update: the stop is checked first
    if (tradeActive && !isNaN(lastEntry) && !isNaN(lastSignalBar) && i > lastSignalBar) {
      const hitSL = lastSignalDir === 1 ? le(b.low, lastSL) : ge(b.high, lastSL);
      const hitTP = lastSignalDir === 1 ? ge(b.high, lastTP) : le(b.low, lastTP);
      if (hitSL) {
        currentTradeStatus = -1;
        tradeActive = false;
        totalLosses += 1;
        clearTradeObjects();
      } else if (hitTP) {
        currentTradeStatus = 2;
        tradeActive = false;
        totalWins += 1;
        clearTradeObjects();
      }
    }

    flags[0].push(newBullEntry);
    flags[1].push(newBearEntry);
    flags[2].push(newBullIFVG);
    flags[3].push(newBearIFVG);

    // Dashboard
    if (cfg.showDashboard && i === n - 1 && dash) {
      const cell = (col: number, row: number, text: string, bg: string, tc: string, size: string) =>
        table.cell(dash, col, row, text, undefined, undefined, tc, undefined, undefined, size, bg);
      const bg0 = String(color.new(dashboardBg, 0));
      const bg25 = String(color.new(dashboardBg, 25));
      const gray35 = String(color.new(color.gray, 35));
      cell(0, 0, 'IFVG SNIPER', dashboardBg, dashboardText, 'small');
      cell(1, 0, 'ENGINE', dashboardBg, dashboardText, 'small');
      cell(0, 1, 'Filter', bg0, dashboardText, 'tiny');
      cell(1, 1, filterMode, bg25, dashboardText, 'tiny');
      cell(0, 2, 'Label Size', bg0, dashboardText, 'tiny');
      cell(1, 2, cfg.ifvgLabelSizeInput, bg25, dashboardText, 'tiny');
      cell(0, 3, 'Last Signal', bg0, dashboardText, 'tiny');
      cell(1, 3, lastSignalSide, lastSignalDir === 1 ? String(color.new(bullIFVGColor, 20))
        : lastSignalDir === -1 ? String(color.new(bearIFVGColor, 20)) : gray35, color.white, 'tiny');
      cell(0, 4, 'Trade Status', bg0, dashboardText, 'tiny');
      cell(1, 4, statusText(currentTradeStatus), statusColor(currentTradeStatus), color.white, 'tiny');
      cell(0, 5, 'Selected RR', bg0, dashboardText, 'tiny');
      cell(1, 5, cfg.tpRRInput, bg25, dashboardText, 'tiny');
      cell(0, 6, 'Entry', bg0, dashboardText, 'tiny');
      cell(1, 6, priceText(lastEntry), bg25, dashboardText, 'tiny');
      cell(0, 7, 'SL', bg0, dashboardText, 'tiny');
      cell(1, 7, priceText(lastSL), String(color.new(slColor, 70)), color.white, 'tiny');
      cell(0, 8, 'TP', bg0, dashboardText, 'tiny');
      cell(1, 8, priceText(lastTP), String(color.new(tpColor, 65)), color.white, 'tiny');
      cell(0, 9, 'Active Box', bg0, dashboardText, 'tiny');
      cell(1, 9, tradeActive ? 'VISIBLE' : 'HIDDEN', tradeActive ? String(color.new(tpColor, 65)) : gray35, color.white, 'tiny');
      cell(0, 10, 'Filtered IFVG', bg0, dashboardText, 'tiny');
      cell(1, 10, str.tostring(filteredIFVG), gray35, color.white, 'tiny');
      cell(0, 11, 'Trades / W / L', bg0, dashboardText, 'tiny');
      cell(1, 11, str.tostring(totalSignals) + ' / ' + str.tostring(totalWins) + ' / ' + str.tostring(totalLosses),
        bg25, dashboardText, 'tiny');
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const IfvgSniperEntryEngine = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  drawingKinds,
};
