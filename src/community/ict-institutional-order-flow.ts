/**
 * ICT Institutional Order Flow (fadi)
 *
 * Market structure, liquidity and imbalances of the last 1,000 bars:
 * - Short term highs / lows: a bar whose high is above the high of the next bar and above the last different high
 *   before it (lows: the mirror). A short term high that is above the short term highs on both sides is an
 *   intermediate term high, and an intermediate term high above its two neighbours is a long term high. Each shown
 *   pivot gets a label (by default "IT-HH", "LT-LL" ...: higher / lower than the pivot of the same term before it).
 * - Liquidity: a horizontal line from each shown pivot, extended a few bars after the last bar while price has not
 *   gone through the pivot (open), ended on the bar that went through it (claimed).
 * - Relative equal highs / lows: two pivots of the same kind closer than a share of the median of the last 14
 *   ATR(14) values, with no bar through the straight line between them: a level line, a link line between the two
 *   pivots and a shaded box. The level is claimed when price goes through it.
 * - Fair value gaps (the low above the high of two bars back, or the mirror, without an opening gap on this bar or
 *   the bar before), inverted fair value gaps (a fair value gap closed through, when it has the other direction than
 *   the gap before it), volume imbalances (two candle bodies that do not overlap) and opening gaps: two level lines,
 *   an optional line at the middle (C.E.), a link line at the right end and a fill. Each one ends on the bar that
 *   mitigated it and is extended after the last bar until then.
 * - Displacement (off by default): bar colour of a candle whose body is larger than a multiple of the standard
 *   deviation of the bodies (and, by default, leaves a fair value gap).
 *
 * All drawings are made on the last bar. The script only detects on closed bars: on a last bar that is still open
 * the imbalances are only tested for mitigation. At most 500 lines, 500 labels and 500 boxes are kept (the oldest
 * are removed); the default settings stay far below these counts.
 *
 * Chart values read: the state of the last bar (closed or still open). Without a chart context the last bar is taken
 * as closed.
 *
 * Reference: "ICT Institutional Order Flow (fadi)" by fadizeidan
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © fadizeidan. Displacement logic credit: Visualizing Displacement [TFO]
 */

import {
  ta, color, array, Series, line, label, box as pineBox, linefill, resetDrawings, setDrawingBar, varDrawing,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { BarColorData, BoxData, LabelData, LineDrawingData, LinefillData, PineSize } from '../types';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';

export interface IctInstitutionalOrderFlowInputs {
  /** Short */
  stShow: boolean;
  stColorBull: string;
  stColorBear: string;
  stLabelColor: string;
  /** Intermediate */
  itShow: boolean;
  itColorBull: string;
  itColorBear: string;
  itLabelColor: string;
  /** Long */
  ltShow: boolean;
  ltColorBull: string;
  ltColorBear: string;
  ltLabelColor: string;
  /** Short */
  stLabel: string;
  stTextSize: string;
  /** Intermediate */
  itLabel: string;
  itTextSize: string;
  /** Long */
  ltLabel: string;
  ltTextSize: string;
  /** Maximum number of labels */
  maxLabels: number;
  /** Short */
  stLiquidityShow: boolean;
  stLiquidityOpenColor: string;
  stLiquidityClaimedColor: string;
  stLiquiditySize: number;
  /** Intermediate */
  itLiquidityShow: boolean;
  itLiquidityOpenColor: string;
  itLiquidityClaimedColor: string;
  itLiquiditySize: number;
  /** Long */
  ltLiquidityShow: boolean;
  ltLiquidityOpenColor: string;
  ltLiquidityClaimedColor: string;
  ltLiquiditySize: number;
  /** Open */
  liquidityOpenStyle: string;
  /** Claimed */
  liquidityClaimedStyle: string;
  /** Extend */
  extend: number;
  /** Maximum number of lines */
  maxLines: number;
  /** Maximum number of claimed lines */
  maxClaimedLines: number;
  /** Equal Levels */
  eqShow: boolean;
  eqColorBull: string;
  eqColorBear: string;
  eqSize: number;
  eqStyle: string;
  /** link Levels */
  eqLinkShow: boolean;
  eqLinkColor: string;
  eqLinkSize: number;
  eqLinkStyle: string;
  /** Highlight */
  eqShade: boolean;
  eqShadeBull: string;
  eqShadeBear: string;
  /** Claimed Style */
  eqClaimedStyle: string;
  /** Distance Tolerance */
  eqTolerance: number;
  /** Maximum number of Equal Levels */
  eqMax: number;
  /** Maximum number of Claimed Levels */
  eqMaxClaimed: number;
  /** Highlight */
  displacementShow: boolean;
  displacementBull: string;
  displacementBear: string;
  /** Require FVG */
  displacementFvg: boolean;
  /** Use last X bars to calculate */
  displacementLength: number;
  /** Displacement Strength */
  displacementFactor: number;
  /** FVG */
  fvgShow: boolean;
  fvgColorBull: string;
  fvgColorBear: string;
  /** iFVG */
  ifvgShow: boolean;
  ifvgColorBull: string;
  ifvgColorBear: string;
  fvgType: string;
  /** Mitigation */
  fvgMitigatedShow: boolean;
  fvgMitigatedColorBull: string;
  fvgMitigatedColorBear: string;
  fvgMitigatedType: string;
  /** Open */
  fvgOpenShow: boolean;
  fvgOpenStyle: string;
  fvgOpenSize: number;
  /** Close */
  fvgCloseShow: boolean;
  fvgCloseStyle: string;
  fvgCloseSize: number;
  /** C.E. */
  fvgCeShow: boolean;
  fvgCeBullColor: string;
  fvgCeBearColor: string;
  fvgCeStyle: string;
  fvgCeSize: number;
  /** Link */
  fvgLinkShow: boolean;
  fvgLinkStyle: string;
  fvgLinkSize: number;
  /** Background Transparency */
  fvgFill: boolean;
  fvgFillPercent: number;
  /** Extend FVGs when overlapping with V.I. */
  fvgMergeVi: boolean;
  /** Max number of FVGs */
  fvgMaxCount: number;
  /** Max number of iFVGs */
  ifvgMaxCount: number;
  /** Volume Imbalance */
  viShow: boolean;
  viColorBull: string;
  viColorBear: string;
  /** Mitigated */
  viMitigatedShow: boolean;
  viMitigatedColorBull: string;
  viMitigatedColorBear: string;
  /** Background Transparency */
  viFill: boolean;
  viFillPercent: number;
  /** Max number of Imbalances */
  viMaxCount: number;
  /** Open Gaps */
  gapShow: boolean;
  gapColorBull: string;
  gapColorBear: string;
  /** Background Transparency */
  gapFill: boolean;
  gapFillPercent: number;
  /** Max number of Gaps */
  gapMaxCount: number;
}

export const defaultInputs: IctInstitutionalOrderFlowInputs = {
  stShow: false,
  stColorBull: '#363A45',
  stColorBear: '#363A45',
  stLabelColor: '#FFFFFF00',
  itShow: true,
  itColorBull: '#9C27B0',
  itColorBear: '#9C27B0',
  itLabelColor: '#FFFFFF00',
  ltShow: true,
  ltColorBull: '#2962FF',
  ltColorBear: '#2962FF',
  ltLabelColor: '#FFFFFF00',
  stLabel: 'High/Low',
  stTextSize: 'tiny',
  itLabel: 'High/Low',
  itTextSize: 'small',
  ltLabel: 'High/Low',
  ltTextSize: 'normal',
  maxLabels: 50,
  stLiquidityShow: false,
  stLiquidityOpenColor: 'rgba(54, 58, 69, 0.5)',
  stLiquidityClaimedColor: 'rgba(54, 58, 69, 0.5)',
  stLiquiditySize: 1,
  itLiquidityShow: true,
  itLiquidityOpenColor: 'rgba(156, 39, 176, 0.5)',
  itLiquidityClaimedColor: 'rgba(156, 39, 176, 0.5)',
  itLiquiditySize: 1,
  ltLiquidityShow: true,
  ltLiquidityOpenColor: 'rgba(41, 98, 255, 0.5)',
  ltLiquidityClaimedColor: 'rgba(41, 98, 255, 0.5)',
  ltLiquiditySize: 1,
  liquidityOpenStyle: '⎯⎯⎯',
  liquidityClaimedStyle: '····',
  extend: 5,
  maxLines: 50,
  maxClaimedLines: 5,
  eqShow: true,
  eqColorBull: '#434651',
  eqColorBear: '#434651',
  eqSize: 1,
  eqStyle: '⎯⎯⎯',
  eqLinkShow: true,
  eqLinkColor: '#787B86',
  eqLinkSize: 1,
  eqLinkStyle: '····',
  eqShade: true,
  eqShadeBull: 'rgba(41, 98, 255, 0.1)',
  eqShadeBear: 'rgba(255, 152, 0, 0.1)',
  eqClaimedStyle: '····',
  eqTolerance: 2,
  eqMax: 20,
  eqMaxClaimed: 5,
  displacementShow: false,
  displacementBull: '#bae3c5',
  displacementBear: '#ffc2c2',
  displacementFvg: true,
  displacementLength: 100,
  displacementFactor: 2,
  fvgShow: true,
  fvgColorBull: '#388E3C',
  fvgColorBear: '#1848CC',
  ifvgShow: true,
  ifvgColorBull: '#9C27B0',
  ifvgColorBear: '#FF9800',
  fvgType: 'Always Display',
  fvgMitigatedShow: true,
  fvgMitigatedColorBull: 'rgba(120, 123, 134, 0.05)',
  fvgMitigatedColorBear: 'rgba(120, 123, 134, 0.05)',
  fvgMitigatedType: 'Wick filled',
  fvgOpenShow: true,
  fvgOpenStyle: '····',
  fvgOpenSize: 1,
  fvgCloseShow: true,
  fvgCloseStyle: '····',
  fvgCloseSize: 1,
  fvgCeShow: true,
  fvgCeBullColor: 'rgba(54, 58, 69, 0.4)',
  fvgCeBearColor: 'rgba(54, 58, 69, 0.4)',
  fvgCeStyle: '····',
  fvgCeSize: 1,
  fvgLinkShow: true,
  fvgLinkStyle: '⎯⎯⎯',
  fvgLinkSize: 2,
  fvgFill: true,
  fvgFillPercent: 95,
  fvgMergeVi: false,
  fvgMaxCount: 20,
  ifvgMaxCount: 20,
  viShow: true,
  viColorBull: '#F23645',
  viColorBear: '#F23645',
  viMitigatedShow: true,
  viMitigatedColorBull: 'rgba(242, 54, 69, 0.05)',
  viMitigatedColorBear: 'rgba(242, 54, 69, 0.05)',
  viFill: true,
  viFillPercent: 70,
  viMaxCount: 20,
  gapShow: true,
  gapColorBull: '#ffcc80',
  gapColorBear: '#ffcc80',
  gapFill: true,
  gapFillPercent: 70,
  gapMaxCount: 5,
};

const G_MS = 'ICT Market Structure ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const G_LABEL = 'Label Format ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const OPTIONS_1 = ['■', '□', '▣', '◆', '◇', '◈', '●', '○', '◉', '▲▼', '△▽', '↑↓', 'S/I/L Term', 'High/Low'];
const OPTIONS_2 = ['tiny', 'small', 'normal', 'large', 'huge'];
const G_LIQ = 'Liquidity Levels ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const G_LIQ_STYLE = 'Liquidity Style ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const OPTIONS_3 = ['⎯⎯⎯', '----', '····'];
const G_EQ = 'Relative Equal Highs and Lows ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const G_DISP = 'Displacement ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const G_FVG = 'Fair Value Gap ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const OPTIONS_4 = ['Always Display', 'Same As Displacement', 'Level 1', 'Level 2', 'Level 3', 'Level 4'];
const OPTIONS_5 = ['None', 'Wick Touched', 'Wick filled', 'Body filled', 'Wick filled half', 'Body filled half'];
const G_VI = 'Volume Imbalance ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
const G_GAP = 'Open Gaps ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

export const inputConfig: InputConfig[] = [
  { id: 'stShow', type: 'bool', title: 'Short\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: false, inline: 'ST', group: G_MS },
  { id: 'stColorBull', type: 'color', title: '', defval: '#363A45', inline: 'ST', group: G_MS },
  { id: 'stColorBear', type: 'color', title: '', defval: '#363A45', inline: 'ST', group: G_MS },
  { id: 'stLabelColor', type: 'color', title: '', defval: '#FFFFFF00', inline: 'ST', group: G_MS },
  { id: 'itShow', type: 'bool', title: 'Intermediate\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: true, inline: 'IT', group: G_MS },
  { id: 'itColorBull', type: 'color', title: '', defval: '#9C27B0', inline: 'IT', group: G_MS },
  { id: 'itColorBear', type: 'color', title: '', defval: '#9C27B0', inline: 'IT', group: G_MS },
  { id: 'itLabelColor', type: 'color', title: '', defval: '#FFFFFF00', inline: 'IT', group: G_MS },
  { id: 'ltShow', type: 'bool', title: 'Long\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: true, inline: 'LT', group: G_MS },
  { id: 'ltColorBull', type: 'color', title: '', defval: '#2962FF', inline: 'LT', group: G_MS },
  { id: 'ltColorBear', type: 'color', title: '', defval: '#2962FF', inline: 'LT', group: G_MS },
  { id: 'ltLabelColor', type: 'color', title: '', defval: '#FFFFFF00', inline: 'LT', group: G_MS },
  { id: 'stLabel', type: 'string', title: 'Short\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: 'High/Low', options: OPTIONS_1, inline: '1', group: G_LABEL },
  { id: 'stTextSize', type: 'string', title: '', defval: 'tiny', options: OPTIONS_2, inline: '1', group: G_LABEL },
  { id: 'itLabel', type: 'string', title: 'Intermediate\u2007\u2007\u2007\u2007\u2007\u2007', defval: 'High/Low', options: OPTIONS_1, inline: '2', group: G_LABEL },
  { id: 'itTextSize', type: 'string', title: '', defval: 'small', options: OPTIONS_2, inline: '2', group: G_LABEL },
  { id: 'ltLabel', type: 'string', title: 'Long\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: 'High/Low', options: OPTIONS_1, inline: '3', group: G_LABEL },
  { id: 'ltTextSize', type: 'string', title: '', defval: 'normal', options: OPTIONS_2, inline: '3', group: G_LABEL },
  { id: 'maxLabels', type: 'int', title: 'Maximum number of labels\u2007\u2007\u2007\u2007', defval: 50, group: G_LABEL },
  { id: 'stLiquidityShow', type: 'bool', title: 'Short\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: false, inline: 'ST liquidity', group: G_LIQ },
  { id: 'stLiquidityOpenColor', type: 'color', title: '', defval: 'rgba(54, 58, 69, 0.5)', inline: 'ST liquidity', group: G_LIQ },
  { id: 'stLiquidityClaimedColor', type: 'color', title: '', defval: 'rgba(54, 58, 69, 0.5)', inline: 'ST liquidity', group: G_LIQ },
  { id: 'stLiquiditySize', type: 'int', title: '', defval: 1, min: 1, max: 4, inline: 'ST liquidity', group: G_LIQ }, // Pine options = [1, 2, 3, 4]
  { id: 'itLiquidityShow', type: 'bool', title: 'Intermediate\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: true, inline: 'IT liquidity', group: G_LIQ },
  { id: 'itLiquidityOpenColor', type: 'color', title: '', defval: 'rgba(156, 39, 176, 0.5)', inline: 'IT liquidity', group: G_LIQ },
  { id: 'itLiquidityClaimedColor', type: 'color', title: '', defval: 'rgba(156, 39, 176, 0.5)', inline: 'IT liquidity', group: G_LIQ },
  { id: 'itLiquiditySize', type: 'int', title: '', defval: 1, min: 1, max: 4, inline: 'IT liquidity', group: G_LIQ }, // Pine options = [1, 2, 3, 4]
  { id: 'ltLiquidityShow', type: 'bool', title: 'Long\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: true, inline: 'LT liquidity', group: G_LIQ },
  { id: 'ltLiquidityOpenColor', type: 'color', title: '', defval: 'rgba(41, 98, 255, 0.5)', inline: 'LT liquidity', group: G_LIQ },
  { id: 'ltLiquidityClaimedColor', type: 'color', title: '', defval: 'rgba(41, 98, 255, 0.5)', inline: 'LT liquidity', group: G_LIQ },
  { id: 'ltLiquiditySize', type: 'int', title: '', defval: 1, min: 1, max: 4, inline: 'LT liquidity', group: G_LIQ }, // Pine options = [1, 2, 3, 4]
  { id: 'liquidityOpenStyle', type: 'string', title: 'Open\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: '⎯⎯⎯', options: OPTIONS_3, group: G_LIQ_STYLE },
  { id: 'liquidityClaimedStyle', type: 'string', title: 'Claimed\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: '····', options: OPTIONS_3, group: G_LIQ_STYLE },
  { id: 'extend', type: 'int', title: 'Extend', defval: 5, min: 1, group: G_LIQ_STYLE },
  { id: 'maxLines', type: 'int', title: 'Maximum number of lines', defval: 50, min: 1, max: 250, group: G_LIQ_STYLE },
  { id: 'maxClaimedLines', type: 'int', title: 'Maximum number of claimed lines', defval: 5, min: 0, max: 250, group: G_LIQ_STYLE },
  { id: 'eqShow', type: 'bool', title: 'Equal Levels', defval: true, inline: 'EQ', group: G_EQ },
  { id: 'eqColorBull', type: 'color', title: '', defval: '#434651', inline: 'EQ', group: G_EQ },
  { id: 'eqColorBear', type: 'color', title: '', defval: '#434651', inline: 'EQ', group: G_EQ },
  { id: 'eqSize', type: 'int', title: '', defval: 1, min: 1, max: 4, inline: 'EQ', group: G_EQ }, // Pine options = [1, 2, 3, 4]
  { id: 'eqStyle', type: 'string', title: '', defval: '⎯⎯⎯', options: OPTIONS_3, inline: 'EQ', group: G_EQ },
  { id: 'eqLinkShow', type: 'bool', title: 'link Levels\u2007\u2007', defval: true, inline: 'EQ Link', group: G_EQ },
  { id: 'eqLinkColor', type: 'color', title: '', defval: '#787B86', inline: 'EQ Link', group: G_EQ },
  { id: 'eqLinkSize', type: 'int', title: '\u2007\u2007\u2007\u2007\u2007\u2007', defval: 1, min: 1, max: 4, inline: 'EQ Link', group: G_EQ }, // Pine options = [1, 2, 3, 4]
  { id: 'eqLinkStyle', type: 'string', title: '', defval: '····', options: OPTIONS_3, inline: 'EQ Link', group: G_EQ },
  { id: 'eqShade', type: 'bool', title: 'Highlight\u2007\u2007\u2007', defval: true, inline: 'EQ Shade', group: G_EQ },
  { id: 'eqShadeBull', type: 'color', title: '', defval: 'rgba(41, 98, 255, 0.1)', inline: 'EQ Shade', group: G_EQ },
  { id: 'eqShadeBear', type: 'color', title: '', defval: 'rgba(255, 152, 0, 0.1)', inline: 'EQ Shade', group: G_EQ },
  { id: 'eqClaimedStyle', type: 'string', title: 'Claimed Style', defval: '····', options: OPTIONS_3, group: G_EQ },
  { id: 'eqTolerance', type: 'int', title: 'Distance Tolerance', defval: 2, min: 1, max: 10, group: G_EQ }, // Pine options = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  { id: 'eqMax', type: 'int', title: 'Maximum number of Equal Levels', defval: 20, min: 1, group: G_EQ },
  { id: 'eqMaxClaimed', type: 'int', title: 'Maximum number of Claimed Levels', defval: 5, min: 1, group: G_EQ },
  { id: 'displacementShow', type: 'bool', title: 'Highlight\u2007\u2007\u2007\u2007', defval: false, inline: 'displacement', group: G_DISP },
  { id: 'displacementBull', type: 'color', title: '', defval: '#bae3c5', inline: 'displacement', group: G_DISP },
  { id: 'displacementBear', type: 'color', title: '', defval: '#ffc2c2', inline: 'displacement', group: G_DISP },
  { id: 'displacementFvg', type: 'bool', title: 'Require FVG', defval: true, group: G_DISP },
  { id: 'displacementLength', type: 'int', title: 'Use last X bars to calculate', defval: 100, min: 1, group: G_DISP },
  { id: 'displacementFactor', type: 'int', title: 'Displacement Strength', defval: 2, min: 1, max: 4, group: G_DISP }, // Pine options = [1, 2, 3, 4]
  { id: 'fvgShow', type: 'bool', title: 'FVG\u2007\u2007\u2007\u2007', defval: true, inline: '1', group: G_FVG },
  { id: 'fvgColorBull', type: 'color', title: '', defval: '#388E3C', inline: '1', group: G_FVG },
  { id: 'fvgColorBear', type: 'color', title: '', defval: '#1848CC', inline: '1', group: G_FVG },
  { id: 'ifvgShow', type: 'bool', title: 'iFVG\u2007\u2007\u2007\u2007', defval: true, inline: 'i1', group: G_FVG },
  { id: 'ifvgColorBull', type: 'color', title: '', defval: '#9C27B0', inline: 'i1', group: G_FVG },
  { id: 'ifvgColorBear', type: 'color', title: '', defval: '#FF9800', inline: 'i1', group: G_FVG },
  { id: 'fvgType', type: 'string', title: '', defval: 'Always Display', options: OPTIONS_4, inline: '1', group: G_FVG },
  { id: 'fvgMitigatedShow', type: 'bool', title: 'Mitigation', defval: true, inline: '2', group: G_FVG },
  { id: 'fvgMitigatedColorBull', type: 'color', title: '', defval: 'rgba(120, 123, 134, 0.05)', inline: '2', group: G_FVG },
  { id: 'fvgMitigatedColorBear', type: 'color', title: '', defval: 'rgba(120, 123, 134, 0.05)', inline: '2', group: G_FVG },
  { id: 'fvgMitigatedType', type: 'string', title: '', defval: 'Wick filled', options: OPTIONS_5, inline: '2', group: G_FVG },
  { id: 'fvgOpenShow', type: 'bool', title: 'Open\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: true, inline: 'open', group: G_FVG },
  { id: 'fvgOpenStyle', type: 'string', title: '', defval: '····', options: OPTIONS_3, inline: 'open', group: G_FVG },
  { id: 'fvgOpenSize', type: 'int', title: '', defval: 1, min: 1, max: 4, inline: 'open', group: G_FVG }, // Pine options = [1, 2, 3, 4]
  { id: 'fvgCloseShow', type: 'bool', title: 'Close\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: true, inline: 'close', group: G_FVG },
  { id: 'fvgCloseStyle', type: 'string', title: '', defval: '····', options: OPTIONS_3, inline: 'close', group: G_FVG },
  { id: 'fvgCloseSize', type: 'int', title: '', defval: 1, min: 1, max: 4, inline: 'close', group: G_FVG }, // Pine options = [1, 2, 3, 4]
  { id: 'fvgCeShow', type: 'bool', title: 'C.E.\u2007\u2007\u2007\u2007', defval: true, inline: '3', group: G_FVG },
  { id: 'fvgCeBullColor', type: 'color', title: '', defval: 'rgba(54, 58, 69, 0.4)', inline: '3', group: G_FVG },
  { id: 'fvgCeBearColor', type: 'color', title: '', defval: 'rgba(54, 58, 69, 0.4)', inline: '3', group: G_FVG },
  { id: 'fvgCeStyle', type: 'string', title: '', defval: '····', options: OPTIONS_3, inline: '3', group: G_FVG },
  { id: 'fvgCeSize', type: 'int', title: '', defval: 1, min: 1, max: 4, inline: '3', group: G_FVG }, // Pine options = [1, 2, 3, 4]
  { id: 'fvgLinkShow', type: 'bool', title: 'Link\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: true, inline: '4', group: G_FVG },
  { id: 'fvgLinkStyle', type: 'string', title: '\u2007', defval: '⎯⎯⎯', options: OPTIONS_3, inline: '4', group: G_FVG },
  { id: 'fvgLinkSize', type: 'int', title: '', defval: 2, min: 1, max: 4, inline: '4', group: G_FVG }, // Pine options = [1, 2, 3, 4]
  { id: 'fvgFill', type: 'bool', title: 'Background Transparency', defval: true, inline: 'fill', group: G_FVG },
  { id: 'fvgFillPercent', type: 'int', title: '', defval: 95, min: 50, max: 98, inline: 'fill', group: G_FVG }, // Pine options = [98, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]
  { id: 'fvgMergeVi', type: 'bool', title: 'Extend FVGs when overlapping with V.I.', defval: false, group: G_FVG },
  { id: 'fvgMaxCount', type: 'int', title: 'Max number of FVGs', defval: 20, group: G_FVG },
  { id: 'ifvgMaxCount', type: 'int', title: 'Max number of iFVGs', defval: 20, group: G_FVG },
  { id: 'viShow', type: 'bool', title: 'Volume Imbalance', defval: true, inline: '1', group: G_VI },
  { id: 'viColorBull', type: 'color', title: '', defval: '#F23645', inline: '1', group: G_VI },
  { id: 'viColorBear', type: 'color', title: '', defval: '#F23645', inline: '1', group: G_VI },
  { id: 'viMitigatedShow', type: 'bool', title: 'Mitigated\u2007\u2007\u2007\u2007\u2007\u2007\u2007', defval: true, inline: '2', group: G_VI },
  { id: 'viMitigatedColorBull', type: 'color', title: '', defval: 'rgba(242, 54, 69, 0.05)', inline: '2', group: G_VI },
  { id: 'viMitigatedColorBear', type: 'color', title: '', defval: 'rgba(242, 54, 69, 0.05)', inline: '2', group: G_VI },
  { id: 'viFill', type: 'bool', title: 'Background Transparency', defval: true, inline: 'fill', group: G_VI },
  { id: 'viFillPercent', type: 'int', title: '', defval: 70, min: 50, max: 98, inline: 'fill', group: G_VI }, // Pine options = [98, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]
  { id: 'viMaxCount', type: 'int', title: 'Max number of Imbalances', defval: 20, min: 1, max: 100, group: G_VI },
  { id: 'gapShow', type: 'bool', title: 'Open Gaps', defval: true, inline: '1', group: G_GAP },
  { id: 'gapColorBull', type: 'color', title: '', defval: '#ffcc80', inline: '1', group: G_GAP },
  { id: 'gapColorBear', type: 'color', title: '', defval: '#ffcc80', inline: '1', group: G_GAP },
  { id: 'gapFill', type: 'bool', title: 'Background Transparency', defval: true, inline: 'fill', group: G_GAP },
  { id: 'gapFillPercent', type: 'int', title: '', defval: 70, min: 50, max: 98, inline: 'fill', group: G_GAP }, // Pine options = [98, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50]
  { id: 'gapMaxCount', type: 'int', title: 'Max number of Gaps', defval: 5, group: G_GAP },
];
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'ICT Institutional Order Flow (fadi)',
  shortTitle: 'ICT Institutional Order Flow (fadi)',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500, max_boxes_count = 500) */
const MAX_OBJECTS = 500;
/** Internal maximum number of pivots (MAX_BUFFER) */
const MAX_BUFFER = 1000;
/** The script only works on the last 1,000 bars (last_bar_index - bar_index < 1000) */
const WINDOW = 1000;
/** color_transparent = #ffffff00 */
const TRANSPARENT = '#ffffff00';

// Pine float comparisons: a > b only when a - b > 1e-10 (na compares false)
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const ge = (a: number, b: number) => a - b >= -1e-10;
const le = (a: number, b: number) => b - a >= -1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

type LineStyle = 'solid' | 'dashed' | 'dotted';

/** helper.LineStyle(): any other value (also na) is a solid line */
function lineStyle(style: string | undefined): LineStyle {
  return style === '----' ? 'dashed' : style === '····' ? 'dotted' : 'solid';
}

type Line = ReturnType<typeof line.new>;
type Box = ReturnType<typeof pineBox.new>;
type Fill = ReturnType<typeof linefill.new>;

interface Pivot {
  index: number;
  time: number;
  price: number;
  timeLast: number;
  claimed: boolean;
  isHigh: boolean;
  isLow: boolean;
  isSHigherHigh: boolean;
  isSLowerLow: boolean;
  isIHigherHigh: boolean;
  isILowerLow: boolean;
  isLHigherHigh: boolean;
  isLLowerLow: boolean;
  isST: boolean;
  isIT: boolean;
  isLT: boolean;
}

interface EqualLevels {
  price: number;
  start: number;
  end: number;
  startTime: number;
  endTime: number;
  startIndex: number;
  endIndex: number;
  isHigh: boolean;
  isLow: boolean;
  isClaimed: boolean;
  lineEq?: Line;
  lineLink?: Line;
  boxLink?: Box;
}

interface ImbalanceBox {
  open: Line;
  close: Line;
  ce?: Line;
  link?: Line;
  fill?: Fill;
}

interface Imbalance {
  openTime: number;
  closeTime: number;
  open: number;
  middle: number;
  close: number;
  mitigated: boolean;
  mitigatedTime: number;
  invertable: boolean;
  inverted: boolean;
  isBullish: boolean;
  box?: ImbalanceBox;
}

interface ImbalanceSettings {
  show: boolean;
  colorBull: string;
  colorBear: string;
  mitigatedShow: boolean;
  mitigatedType: string;
  mitigatedColorBull: string;
  mitigatedColorBear: string;
  openShow: boolean;
  /** undefined = a field that the script leaves at na: a solid line */
  openStyle?: string;
  /** A width that the script leaves at na is 0 */
  openSize: number;
  closeShow: boolean;
  closeStyle?: string;
  closeSize: number;
  fill: boolean;
  fillPercent: number;
  ceShow: boolean;
  ceStyle?: string;
  ceSize: number;
  ceBullColor: string;
  ceBearColor: string;
  linkShow: boolean;
  linkStyle?: string;
  linkSize: number;
  maxCount: number;
}

interface ImbalanceStructure {
  type: 'FVG' | 'iFVG' | 'VI' | 'GAP';
  imbalance: Imbalance[];
  settings: ImbalanceSettings;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<IctInstitutionalOrderFlowInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  // barstate.isconfirmed on the last bar
  const lastConfirmed = lastBarConfirmedOf(chart);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // body = math.abs(open - close), std = ta.stdev(body, length)
  const body = bars.map((b) => Math.abs(b.open - b.close));
  const std = A(ta.stdev(Series.fromArray(bars, body), cfg.displacementLength));
  // median of the last 14 ATR(14) values
  const atr = A(ta.atr(bars, 14));
  // Trend_Settings.EQ_Tolerance = input / 10
  const tolerance = cfg.eqTolerance / 10;

  // Displacement: barcolor(..., offset = -1) with "Require FVG", barcolor(...) without it
  const barColors: BarColorData[] = [];
  if (cfg.displacementShow) {
    for (let i = 0; i < n; i++) {
      // f_highlightDisplacement() only answers on a closed bar
      if (i === n - 1 && !lastConfirmed) continue;
      const bar = bars[i];
      if (cfg.displacementFvg) {
        if (i < 2) continue;
        const p1 = bars[i - 1];
        const p2 = bars[i - 2];
        const fvg = gt(p1.close, p1.open) ? lt(p2.high, bar.low) : gt(p2.low, bar.high);
        if (gt(body[i - 1], std[i - 1] * cfg.displacementFactor) && fvg) {
          // barcolor(... and displacement_fvg ? candle : na, offset = -1)
          barColors.push({
            time: p1.time, color: lt(p1.open, p1.close) ? cfg.displacementBull : cfg.displacementBear, id: 'barcolor0',
          });
        }
      } else if (gt(body[i], std[i])) {
        // barcolor(... and not displacement_fvg ? candle : na)
        barColors.push({
          time: bar.time, color: lt(bar.open, bar.close) ? cfg.displacementBull : cfg.displacementBear, id: 'barcolor1',
        });
      }
    }
  }

  // Drawings live in the library registry (max_lines_count, max_labels_count, max_boxes_count = 500; linefills follow
  // max_lines_count). x: bar times (xloc.bar_time), except the tester line (bar indexes)
  resetDrawings({ line: MAX_OBJECTS, label: MAX_OBJECTS, box: MAX_OBJECTS });
  const newLine = (
    time1: number, price1: number, time2: number, price2: number, style: LineStyle, lineColor: string, width: number,
  ): Line => line.new(time1, price1, time2, price2, 'bar_time', 'none', lineColor, style, width);
  const deleteLine = (l: Line | undefined) => {
    if (l) line.delete(l);
  };
  const deleteBox = (b: Box | undefined) => {
    if (b) pineBox.delete(b);
  };

  // var line tester = line.new(na, na, na, na, color = color_transparent): moved by every testEQ() call (bar indexes)
  const tester = varDrawing(line.new(NaN, NaN, NaN, NaN, 'bar_index', 'none', TRANSPARENT));

  // Imbalance settings
  const fvgSettings: ImbalanceSettings = {
    show: cfg.fvgShow, colorBull: cfg.fvgColorBull, colorBear: cfg.fvgColorBear,
    mitigatedShow: cfg.fvgMitigatedShow, mitigatedType: cfg.fvgMitigatedType,
    mitigatedColorBull: cfg.fvgMitigatedColorBull, mitigatedColorBear: cfg.fvgMitigatedColorBear,
    openShow: cfg.fvgOpenShow, openStyle: cfg.fvgOpenStyle, openSize: cfg.fvgOpenSize,
    closeShow: cfg.fvgCloseShow, closeStyle: cfg.fvgCloseStyle, closeSize: cfg.fvgCloseSize,
    fill: cfg.fvgFill, fillPercent: cfg.fvgFillPercent,
    ceShow: cfg.fvgCeShow, ceStyle: cfg.fvgCeStyle, ceSize: cfg.fvgCeSize,
    ceBullColor: cfg.fvgCeBullColor, ceBearColor: cfg.fvgCeBearColor,
    linkShow: cfg.fvgLinkShow, linkStyle: cfg.fvgLinkStyle, linkSize: cfg.fvgLinkSize,
    maxCount: cfg.fvgMaxCount,
  };
  // The inverted gaps copy the settings of the gaps, except the C.E. width (left at na)
  const ifvgSettings: ImbalanceSettings = {
    ...fvgSettings, show: cfg.ifvgShow, colorBull: cfg.ifvgColorBull, colorBear: cfg.ifvgColorBear, ceSize: 0,
    maxCount: cfg.ifvgMaxCount,
  };
  // VI_Settings.color_bull = color.new(input, 100)
  const viColorBull = String(color.new(cfg.viColorBull, 100));
  const viColorBear = String(color.new(cfg.viColorBear, 100));
  const viSettings: ImbalanceSettings = {
    show: cfg.viShow, colorBull: viColorBull, colorBear: viColorBear,
    mitigatedShow: cfg.viMitigatedShow, mitigatedType: 'Body filled',
    mitigatedColorBull: cfg.viMitigatedColorBull, mitigatedColorBear: cfg.viMitigatedColorBear,
    openShow: false, openSize: 0, closeShow: false, closeSize: 0,
    fill: cfg.viFill, fillPercent: cfg.viFillPercent,
    ceShow: false, ceSize: 0, ceBullColor: 'transparent', ceBearColor: 'transparent',
    linkShow: false, linkSize: 0, maxCount: cfg.viMaxCount,
  };
  const gapSettings: ImbalanceSettings = {
    show: cfg.gapShow, colorBull: String(color.new(cfg.gapColorBull, 100)), colorBear: String(color.new(cfg.gapColorBear, 100)),
    mitigatedShow: false, mitigatedType: 'Body filled',
    mitigatedColorBull: viColorBull, mitigatedColorBear: viColorBear,
    openShow: true, openSize: 0, closeShow: true, closeSize: 0,
    fill: cfg.gapFill, fillPercent: cfg.gapFillPercent,
    ceShow: false, ceSize: 0, ceBullColor: 'transparent', ceBearColor: 'transparent',
    linkShow: false, linkSize: 0, maxCount: cfg.gapMaxCount,
  };
  const fvgs: ImbalanceStructure = { type: 'FVG', imbalance: [], settings: fvgSettings };
  const ifvgs: ImbalanceStructure = { type: 'iFVG', imbalance: [], settings: ifvgSettings };
  const vis: ImbalanceStructure = { type: 'VI', imbalance: [], settings: viSettings };
  const gaps: ImbalanceStructure = { type: 'GAP', imbalance: [], settings: gapSettings };

  // helper.GetFVGDisplacementLevel(): na for "Always Display" (not read then)
  const fvgLevel = cfg.fvgType === 'Same As Displacement' ? cfg.displacementFactor
    : cfg.fvgType === 'Level 1' ? 1 : cfg.fvgType === 'Level 2' ? 2 : cfg.fvgType === 'Level 3' ? 3
      : cfg.fvgType === 'Level 4' ? 4 : NaN;

  // Market structure
  const stAll: Pivot[] = [];
  const sth: Pivot[] = [];
  const ith: Pivot[] = [];
  const lth: Pivot[] = [];
  const stl: Pivot[] = [];
  const itl: Pivot[] = [];
  const ltl: Pivot[] = [];
  const eqs: EqualLevels[] = [];
  const eqClaimed: EqualLevels[] = [];

  /** Imbalance.clear() */
  const clear = (imb: Imbalance): void => {
    if (!imb.box) return;
    deleteLine(imb.box.open);
    deleteLine(imb.box.close);
    deleteLine(imb.box.ce);
    deleteLine(imb.box.link);
    if (imb.box.fill) linefill.delete(imb.box.fill);
    imb.box = undefined;
  };

  /** AddImbalance() */
  const addImbalance = (is: ImbalanceStructure, o: number, c: number, oTime: number, cTime: number): void => {
    const imb: Imbalance = {
      openTime: oTime, closeTime: cTime, open: o, middle: (o + c) / 2, close: c, mitigated: false, mitigatedTime: NaN,
      invertable: false, inverted: false, isBullish: lt(o, c),
    };
    if (is.imbalance.length > 0) imb.invertable = imb.isBullish !== is.imbalance[0].isBullish;
    is.imbalance.unshift(imb);
    if (is.imbalance.length > is.settings.maxCount) {
      const old = is.imbalance.pop();
      if (old) clear(old);
    }
  };

  const first = Math.max(0, n - WINDOW);
  for (let i = first; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const bar = bars[i];
    const { open, high, low, close, time } = bar;
    const isLast = i === n - 1;
    const confirmed = !isLast || lastConfirmed;
    const p1 = i >= 1 ? bars[i - 1] : undefined;
    const p2 = i >= 2 ? bars[i - 2] : undefined;
    const open1 = p1 ? p1.open : NaN;
    const high1 = p1 ? p1.high : NaN;
    const low1 = p1 ? p1.low : NaN;
    const close1 = p1 ? p1.close : NaN;
    const time1 = p1 ? p1.time : NaN;
    const open2 = p2 ? p2.open : NaN;
    const high2 = p2 ? p2.high : NaN;
    const low2 = p2 ? p2.low : NaN;
    const close2 = p2 ? p2.close : NaN;
    // time + (time - time[1]) * extend
    const extended = time + (time - time1) * cfg.extend;

    // FindImbalance(): fair value gaps, volume imbalances, opening gaps (closed bars only)
    if (confirmed) {
      const gap = gt(low, high1) || lt(high, low1);
      const fvg = lt(high, low2) || gt(low, high2);
      // Gap[1] / FVG[1]: the values of the call on the bar before (false on the first bar of the window)
      const prevGap = i > first ? gt(low1, high2) || lt(high1, low2) : false;
      const bodyTop = Math.max(open, close);
      const bodyBottom = Math.min(open, close);
      const bodyTop1 = Math.max(open1, close1);
      const bodyBottom1 = Math.min(open1, close1);
      const bodyTop2 = Math.max(open2, close2);
      const bodyBottom2 = Math.min(open2, close2);
      const merge = cfg.fvgMergeVi;

      if ((fvgSettings.show || ifvgSettings.show) && fvg && !gap && !prevGap) {
        let o = 0;
        let c = 0;
        if (gt(low, high2)) {
          c = gt(bodyBottom, bodyTop1) && merge ? bodyBottom : low;
          o = gt(bodyBottom1, bodyTop2) && merge ? bodyTop2 : high2;
        }
        if (lt(high, low2)) {
          c = lt(bodyTop, bodyBottom1) && merge ? bodyTop : high;
          o = gt(bodyBottom2, bodyTop1) && merge ? bodyBottom2 : low2;
        }
        if (cfg.fvgType === 'Always Display' || gt(body[i - 1], std[i - 1] * fvgLevel)) {
          if (merge) {
            const bodiesApart = gt(bodyBottom1, bodyTop2) || gt(bodyBottom2, bodyTop1);
            const prevFvg = i > first && i >= 3
              ? lt(high1, bars[i - 3].low) || gt(low1, bars[i - 3].high) : false;
            if (bodiesApart && prevFvg) {
              // UpdateImbalance()
              if (fvgs.imbalance.length > 0) {
                const first = fvgs.imbalance[0];
                first.close = c;
                first.closeTime = time;
                first.middle = (first.open + c) / 2;
              }
            } else {
              addImbalance(fvgs, o, c, time1, time);
            }
            if (viSettings.show && bodiesApart) {
              const merged = vis.imbalance.shift();
              if (merged) clear(merged);
            }
          } else {
            addImbalance(fvgs, o, c, time1, time);
          }
        }
      }
      if (viSettings.show && (gt(bodyBottom, bodyTop1) || lt(bodyTop, bodyBottom1)) && !gap && ((!fvg && merge) || !merge)) {
        const c = gt(bodyTop, bodyBottom1) ? bodyBottom : bodyTop;
        const o = gt(bodyBottom, bodyTop1) ? bodyTop1 : bodyBottom1;
        addImbalance(vis, o, c, time1, time);
      }
      if (gap) {
        const o = lt(high, low1) ? low1 : high1;
        const c = lt(high, low1) ? high : low;
        addImbalance(gaps, o, c, time1, time);
      }
    }

    // CheckMitigated()
    for (const is of [fvgs, ifvgs, vis, gaps]) {
      for (const imb of is.imbalance) {
        if (is.type === 'FVG') {
          if (imb.isBullish && imb.invertable && !imb.inverted) {
            imb.inverted = lt(close, imb.open);
            if (imb.inverted) addImbalance(ifvgs, imb.close, imb.open, imb.openTime, imb.closeTime);
          }
          if (!imb.isBullish && imb.invertable && !imb.inverted) {
            imb.inverted = gt(close, imb.open);
            if (imb.inverted) addImbalance(ifvgs, imb.close, imb.open, imb.openTime, imb.closeTime);
          }
        }
        if (!imb.mitigated) {
          switch (is.settings.mitigatedType) {
            case 'None':
              imb.mitigated = false;
              break;
            case 'Wick Touched':
              imb.mitigated = imb.isBullish ? lt(low, imb.close) : gt(high, imb.close);
              break;
            case 'Wick filled':
              imb.mitigated = imb.isBullish ? le(low, imb.open) : ge(high, imb.open);
              break;
            case 'Body filled':
              imb.mitigated = imb.isBullish ? le(Math.min(open, close), imb.open) : ge(Math.max(open, close), imb.open);
              break;
            case 'Wick filled half':
              imb.mitigated = imb.isBullish ? le(low, imb.middle) : ge(high, imb.middle);
              break;
            case 'Body filled half':
              imb.mitigated = imb.isBullish ? le(Math.min(open, close), imb.middle) : ge(Math.max(open, close), imb.middle);
              break;
            default:
              break;
          }
          if (imb.mitigated) imb.mitigatedTime = time;
        }
      }
    }

    // render(): the imbalances are drawn on the last bar
    if (isLast) {
      for (const is of [fvgs, ifvgs, vis, gaps]) {
        const s = is.settings;
        if (!s.show) continue;
        for (const imb of is.imbalance) {
          const buffer = imb.mitigated ? imb.mitigatedTime : extended;
          const c = imb.mitigated
            ? (imb.isBullish ? s.mitigatedColorBull : s.mitigatedColorBear)
            : (imb.isBullish ? s.colorBull : s.colorBear);
          const cce = imb.isBullish ? s.ceBullColor : s.ceBearColor;
          const box: ImbalanceBox = {
            open: newLine(imb.openTime, imb.open, buffer, imb.open, lineStyle(s.openStyle), s.openShow ? c : TRANSPARENT, s.openSize),
            close: newLine(imb.openTime, imb.close, buffer, imb.close, lineStyle(s.closeStyle), s.closeShow ? c : TRANSPARENT, s.closeSize),
          };
          imb.box = box;
          if (s.linkShow) box.link = newLine(buffer, imb.open, buffer, imb.close, lineStyle(s.linkStyle), c, s.linkSize);
          if (s.fill) box.fill = linefill.new(box.open, box.close, String(color.new(c, s.fillPercent)));
          if (s.ceShow) box.ce = newLine(imb.openTime, imb.middle, buffer, imb.middle, lineStyle(s.ceStyle), cce, s.ceSize);
          if (imb.mitigated && !s.mitigatedShow) clear(imb);
        }
      }
    }

    // Market structure (closed bars only)
    if (confirmed) {
      // spacing = median of the last 14 ATR values * tolerance
      const spacing = array.median(atr.slice(Math.max(0, i - 13), i + 1)) * tolerance;
      const highAt = (k: number) => (i - k >= 0 ? bars[i - k].high : NaN);
      const lowAt = (k: number) => (i - k >= 0 ? bars[i - k].low : NaN);

      /** testEQ(): no bar between the two pivots goes through the straight line between them */
      const testEQ = (a: Pivot, b: Pivot): boolean => {
        let valid = true;
        const t = tester.value as Line;
        line.set_xy1(t, a.index, a.price);
        line.set_xy2(t, b.index, b.price);
        const from = a.index + 1;
        const to = b.index - 1;
        const step = from <= to ? 1 : -1;
        for (let x = from; step > 0 ? x <= to : x >= to; x += step) {
          // tester.get_price(x)
          const p = line.get_price(t, x);
          const j = i - x;
          if (a.isHigh ? gt(highAt(j), p) : lt(lowAt(j), p)) valid = false;
        }
        return valid;
      };

      /** AddEQ() */
      const addEQ = (a: Pivot, b: Pivot): void => {
        if (!cfg.eqShow) return;
        const level: EqualLevels = {
          price: NaN, start: a.price, end: b.price, startTime: a.time, endTime: b.time, startIndex: a.index, endIndex: b.index,
          isHigh: a.isHigh, isLow: a.isLow, isClaimed: false,
        };
        level.price = level.isHigh
          ? (gt(level.start, level.end) ? level.start : level.end)
          : (lt(level.start, level.end) ? level.start : level.end);
        level.lineEq = newLine(level.startTime, level.price, time, level.price, lineStyle(cfg.eqStyle),
          level.isHigh ? cfg.eqColorBull : cfg.eqColorBear, cfg.eqSize);
        if (cfg.eqLinkShow) {
          level.lineLink = newLine(level.startTime, level.start, level.endTime, level.end, lineStyle(cfg.eqLinkStyle),
            cfg.eqLinkColor, cfg.eqLinkSize);
        }
        if (cfg.eqShade) {
          level.boxLink = pineBox.new(level.startTime, level.start, level.endTime, level.end, TRANSPARENT, undefined, undefined, undefined,
            'bar_time', level.isHigh ? cfg.eqShadeBull : cfg.eqShadeBear);
        }
        eqs.unshift(level);
        if (eqs.length > cfg.eqMax + cfg.eqMaxClaimed) {
          const old = eqs.pop();
          if (old) {
            deleteLine(old.lineEq);
            deleteLine(old.lineLink);
            deleteBox(old.boxLink);
          }
        }
      };

      /** ProcessEQ() */
      const processEQ = (a: Pivot, b: Pivot): void => {
        let matched = false;
        for (const level of eqs) {
          if (level.startIndex === a.index && !level.isClaimed) {
            if ((le(level.end, b.price) && level.isHigh) || (ge(level.end, b.price) && level.isLow)) {
              if (testEQ(a, b)) {
                level.end = b.price;
                level.endTime = b.time;
                level.endIndex = b.index;
                if (level.lineLink) line.set_xy2(level.lineLink, level.endTime, level.end);
                if (level.boxLink) pineBox.set_rightbottom(level.boxLink, level.endTime, level.end);
              }
            }
            matched = true;
            break;
          }
          if ((level.endIndex === b.index || level.endIndex === a.index) && (level.isLow === a.isLow || level.isLow === b.isLow)) {
            matched = true;
            break;
          }
        }
        if (!matched && testEQ(a, b)) addEQ(a, b);
      };

      /** Add(): a new short term high / low */
      const addPivot = (price: number, pivotTime: number, index: number, isHigh: boolean): void => {
        const pivot: Pivot = {
          index, time: pivotTime, price, timeLast: 0, claimed: false, isHigh: false, isLow: false, isSHigherHigh: false,
          isSLowerLow: false, isIHigherHigh: false, isILowerLow: false, isLHigherHigh: false, isLLowerLow: false,
          isST: true, isIT: false, isLT: false,
        };
        stAll.unshift(pivot);
        if (isHigh) {
          pivot.isHigh = true;
          if (sth.length > 0 && le(sth[0].price, price)) pivot.isSHigherHigh = true;
          sth.unshift(pivot);
        } else {
          pivot.isLow = true;
          if (stl.length > 0 && ge(stl[0].price, price)) pivot.isSLowerLow = true;
          stl.unshift(pivot);
        }
        // findEQ()
        if ((cfg.eqShow || cfg.eqLinkShow) && stAll.length > 2) {
          for (const p of stAll) {
            // p.index != pivot.index: false when one of them is na
            const otherBar = !Number.isNaN(p.index) && !Number.isNaN(pivot.index) && p.index !== pivot.index;
            if (((p.isHigh && pivot.isHigh) || (p.isLow && pivot.isLow)) && otherBar) {
              if (lt(Math.abs(p.price - pivot.price), spacing)) processEQ(p, pivot);
            }
          }
        }
        if (stAll.length > MAX_BUFFER) stAll.pop();
      };

      // FindST(): helper.SkipEQHigh(2) / SkipEQLow(2) go back over equal highs / lows
      let k = 2;
      while (eq(highAt(k), highAt(k - 1))) k += 1;
      const isHighPivot = gt(high1, highAt(k)) && gt(high1, high);
      k = 2;
      while (eq(lowAt(k), lowAt(k - 1))) k += 1;
      const isLowPivot = lt(low1, lowAt(k)) && lt(low1, low);
      // bar_index[1]: the script first reads the history of bar_index on the first bar of its window, where it is na
      const index1 = i > first ? i - 1 : NaN;
      if (isHighPivot) addPivot(high1, time1, index1, true);
      if (isLowPivot) addPivot(low1, time1, index1, false);

      // FindIT(): SkipEQPivot(2) is always 2 (its loop condition cannot hold)
      if (sth.length > 3) {
        const [h1, h2, h3] = sth;
        if (gt(h2.price, h3.price) && gt(h2.price, h1.price) && !h2.isIT) {
          h2.isIT = true;
          if (ith.length > 0 && le(ith[0].price, h2.price)) h2.isIHigherHigh = true;
          ith.unshift(h2);
        }
      }
      if (stl.length > 2) {
        const [l1, l2, l3] = stl;
        if (lt(l2.price, l3.price) && lt(l2.price, l1.price) && !l2.isIT) {
          l2.isIT = true;
          if (itl.length > 0 && ge(itl[0].price, l2.price)) l2.isILowerLow = true;
          itl.unshift(l2);
        }
      }
      // FindLT()
      if (ith.length > 2) {
        const [h1, h2, h3] = ith;
        if (gt(h2.price, h3.price) && gt(h2.price, h1.price) && !h2.isLT) {
          h2.isLT = true;
          if (lth.length > 0 && le(lth[0].price, h2.price)) h2.isLHigherHigh = true;
          lth.unshift(h2);
        }
      }
      if (itl.length > 2) {
        const [l1, l2, l3] = itl;
        if (lt(l2.price, l3.price) && lt(l2.price, l1.price) && !l2.isLT) {
          l2.isLT = true;
          if (ltl.length > 0 && ge(ltl[0].price, l2.price)) l2.isLLowerLow = true;
          ltl.unshift(l2);
        }
      }

      // CheckClaimed(): liquidity taken by this bar
      for (let s = stAll.length - 1; s >= 0; s--) {
        const pivot = stAll[s];
        if (!pivot.claimed && ((pivot.isHigh && gt(high, pivot.price)) || (pivot.isLow && lt(low, pivot.price)))) {
          pivot.claimed = true;
          pivot.timeLast = time;
        }
      }
      for (const level of eqs) {
        if (level.isClaimed) continue;
        if (level.isHigh) level.isClaimed = gt(high, level.price);
        if (level.isLow) level.isClaimed = lt(low, level.price);
        if (level.isClaimed) {
          eqClaimed.unshift(level);
          if (eqClaimed.length > cfg.eqMaxClaimed) {
            const old = eqClaimed.pop();
            if (old) {
              deleteLine(old.lineEq);
              deleteLine(old.lineLink);
              deleteBox(old.boxLink);
            }
          }
        }
        if (level.lineEq) {
          if (!level.isClaimed) {
            line.set_x2(level.lineEq, extended);
          } else {
            line.set_x2(level.lineEq, time);
            line.set_style(level.lineEq, lineStyle(cfg.eqClaimedStyle));
          }
        }
      }
    }

    // renderMS(): liquidity lines and pivot labels, on the last bar
    if (isLast) {
      let add = 0;
      let claim = 0;
      for (const pivot of stAll) {
        if ((pivot.claimed && claim < cfg.maxClaimedLines) || (!pivot.claimed && add < cfg.maxLines)) {
          // DrawLiquidity()
          const useLt = pivot.isLT && cfg.ltLiquidityShow;
          const useIt = pivot.isIT && cfg.itLiquidityShow;
          const openColor = useLt ? cfg.ltLiquidityOpenColor : useIt ? cfg.itLiquidityOpenColor : cfg.stLiquidityOpenColor;
          const claimedColor = useLt ? cfg.ltLiquidityClaimedColor : useIt ? cfg.itLiquidityClaimedColor : cfg.stLiquidityClaimedColor;
          const size = useLt ? cfg.ltLiquiditySize : useIt ? cfg.itLiquiditySize : cfg.stLiquiditySize;
          if (cfg.stLiquidityShow || useIt || useLt) {
            newLine(pivot.time, pivot.price, pivot.claimed ? pivot.timeLast : extended, pivot.price,
              lineStyle(pivot.claimed ? cfg.liquidityClaimedStyle : cfg.liquidityOpenStyle),
              pivot.claimed ? claimedColor : openColor, size);
          }
          if (pivot.claimed) claim += 1;
          else add += 1;
        }
        if (claim === cfg.maxClaimedLines && add === cfg.maxLines) break;
      }
      add = 0;
      for (const pivot of stAll) {
        if (cfg.stShow || (cfg.itShow && pivot.isIT) || (cfg.ltShow && pivot.isLT && add < cfg.maxLabels)) {
          // DrawLabel(): getLabelSettings()
          let labelColor = 'transparent';
          let textSize = 'normal';
          let textColor = 'transparent';
          if (cfg.stShow) {
            labelColor = cfg.stLabelColor;
            textSize = cfg.stTextSize;
            textColor = pivot.isHigh ? cfg.stColorBull : cfg.stColorBear;
          }
          if (cfg.itShow && pivot.isIT) {
            labelColor = cfg.itLabelColor;
            textSize = cfg.itTextSize;
            textColor = pivot.isHigh ? cfg.itColorBull : cfg.itColorBear;
          }
          if (cfg.ltShow && pivot.isLT) {
            labelColor = cfg.ltLabelColor;
            textSize = cfg.ltTextSize;
            textColor = pivot.isHigh ? cfg.ltColorBull : cfg.ltColorBear;
          }
          label.new(pivot.time, pivot.price, labelText(pivot, cfg), 'bar_time', 'price', labelColor,
            pivot.isHigh ? 'label_down' : 'label_up', textColor, textSize);
          add += 1;
        }
        if (add === cfg.maxLabels) break;
      }
    }
  }

  setDrawingBar(null);

  // Objects alive after the last bar; an object with an na coordinate is not drawn
  const T = (x: number, xloc: string) => (xloc === 'bar_time' ? x : bars[x]?.time ?? NaN);
  const lineData = (l: Line): LineDrawingData => {
    const out: LineDrawingData = { time1: T(l.x1, l.xloc), price1: l.y1, time2: T(l.x2, l.xloc), price2: l.y2 };
    // the tester line: no style and no width set by the script
    if (l === tester.value) return { ...out, color: String(l.color) };
    return { ...out, style: l.style as LineStyle, color: String(l.color), width: l.width };
  };
  const drawn = (l: LineDrawingData) => ![l.time1, l.price1, l.time2, l.price2].some((v) => Number.isNaN(v));
  const lines = line.all().map(lineData).filter(drawn);
  const boxes: BoxData[] = pineBox.all().map((b) => ({
    time1: b.left, price1: b.top, time2: b.right, price2: b.bottom, borderColor: String(b.border_color), bgColor: String(b.bgcolor),
  }));
  const labels: LabelData[] = label.all().map((l) => ({
    time: l.x, price: l.y, text: l.text ?? '', color: String(l.color), textColor: String(l.textcolor),
    style: l.style as 'label_down' | 'label_up', size: l.size as PineSize,
  }));
  const linefills: LinefillData[] = linefill.all()
    .map((f) => ({ line1: lineData(f.line1), line2: lineData(f.line2), color: String(f.color) }))
    .filter((f) => drawn(f.line1) && drawn(f.line2));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    barColors,
    lines,
    boxes,
    labels,
    linefills,
  };
}

/** One part of getLabel(): the text of a pivot for one term */
function termText(option: string, term: string, isHigh: boolean, higherHigh: boolean, lowerLow: boolean, text: string): string {
  if (option === 'S/I/L Term') return text + term + (isHigh ? 'H' : 'L');
  if (option === 'High/Low') return text + term + (isHigh ? (higherHigh ? '-HH' : '-LH') : lowerLow ? '-LL' : '-HL');
  const symbols = Array.from(option);
  // a single symbol replaces the text; a pair is the low symbol then the high symbol
  if (symbols.length === 1) return option;
  return text + (isHigh ? symbols[1] : symbols[0]);
}

/** getLabel() */
function labelText(pivot: Pivot, cfg: IctInstitutionalOrderFlowInputs): string {
  let text = '';
  if (cfg.stShow && pivot.isST && (!pivot.isIT || !cfg.itShow) && (!pivot.isLT || !cfg.ltShow)) {
    text = termText(cfg.stLabel, 'ST', pivot.isHigh, pivot.isSHigherHigh, pivot.isSLowerLow, text);
  }
  if (cfg.itShow && pivot.isIT && (!pivot.isLT || !cfg.ltShow)) {
    text = termText(cfg.itLabel, 'IT', pivot.isHigh, pivot.isIHigherHigh, pivot.isILowerLow, text);
  }
  if (cfg.ltShow && pivot.isLT) {
    text = termText(cfg.ltLabel, 'LT', pivot.isHigh, pivot.isLHigherHigh, pivot.isLLowerLow, text);
  }
  return text;
}

export const IctInstitutionalOrderFlow = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
