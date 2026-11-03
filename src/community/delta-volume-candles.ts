/**
 * Delta Volume Candles [LucF]
 *
 * Replacement candles coloured with volume delta measured on intrabars (bars of a lower timeframe of the chart
 * symbol). Each intrabar gives its volume to the up side when it closes above its open, to the down side when it
 * closes below; a doji uses the move from the close of the intrabar before, then the side of the intrabar before.
 * Per chart bar: up volume, down volume, their total and the bar balance (volume delta = up - down).
 *
 * Balances: Bar Balance (delta), Average Balance (EMA of up minus EMA of down volume), Momentum Balance (RSI of the
 * gap between those EMAs and SMAs of twice the length, minus 50), Relative Balance (ALMA of the up / down volume above
 * their EMAs), Percent Balance (ALMA of 100 * delta / chart volume) and Combined Balances (bull count - bear count of
 * the five). Tops and bottoms: segments added above / below the body, sized by the delta share of the volume times
 * the body size (or its 100-bar average); EMAs of tops / bottoms with a gradient fill; a divergence channel built on
 * bars whose balance polarity differs from the bar polarity; background gradients; volume discrepancy background
 * (intrabar volume differs from the chart volume by more than the tolerance); six marker conditions drawn as labels
 * with alert() calls; an information box (lower timeframe, average intrabars per chart bar, chart bars covered).
 *
 * Lower timeframe: chosen from "Intrabar precision" and the chart timeframe as the PineCoders lower_tf library does
 * (the "~N intrabars" choices give chart seconds / (4 N, or N for 24-hour markets) rounded to whole minutes from one
 * minute, else the next valid seconds timeframe; rule measured on the reference platform, which runs version 4 of the
 * library). The port asks for the intrabars with `requiredSymbols` (the chart symbol on that timeframe) and reads them
 * from the chart context (`bars` accessor, `symbolBarsOf`); without them it throws a MissingSymbolDataError. Chart bars
 * without intrabars have no intrabar volume (as in the original, where the platform limits the number of intrabars).
 *
 * Libraries written in this file: PineCoders/lower_tf (ltf, ltfStats), PineCoders/Time (formattedNoOfPeriods),
 * LucF/ta (upDnIntrabarVolumesByPolarity, divergenceChannel, gradientAdvDecPro, zeroOne, addTextIf).
 *
 * Chart context: timeframe, symbol type (24-hour markets), tickerid, exchange calendar (intrabar merge) and the state
 * of the last bar (`barstate.isconfirmed`, `barstate.isrealtime`, `barstate.islastconfirmedhistory`).
 *
 * Reference: "Delta Volume Candles [LucF]" by LucF
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, math, callsite, color, str, label, table, timeframe, Series, resetDrawings, setDrawingBar, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type BarColorConfig, type FillConfig, type FillData,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { AlertCall, BgColorData, PlotCandleData } from '../types';
import { chartTimeframe } from '../anchor-period';
import {
  lastBarConfirmedOf, symbolBarsOf, symbolTypeOf, tickeridOf, type ChartContext, type SymbolRequest,
} from '../chart-context';
import { otherSymbolChart, securityLowerTf } from '../other-symbol';

// Colours of the original
const GRAY = '#808080';
const GREEN = '#008000';
const LIME = '#00FF00';
const MAROON = '#800000';
const ORANGE = '#FF8000';
const PINK = '#FF0080';
const RED = '#FF0000';
// #EF535018 as an input default: alpha round(0x18 / 255, 2) = 0.09, byte 23
const REDLITE = '#EF535017';
const YELLOW = '#FFFF00';

const CB0 = 'None';
const CB1 = 'Bar Balance';
const CB2 = 'Average Balance';
const CB3 = 'Momentum Balance';
const CB4 = 'Relative Balance';
const CB5 = 'Percent Balance';
const CB6 = 'Combined Balances';
const CB7 = 'Markers Bias';
const CB8 = 'Bar polarity (like normal candles)';
const TB0 = 'None';
const TB1 = 'Up volume on top, down volume at bottom';
const TB2 = 'Volume delta on winning side only';
const TB3 = 'Momentum Balance on winning side only';
const SR0 = "Each candle's body size";
const SR1 = 'Average body size of last 100 bars';
const DL0 = 'None';
const DL1 = 'Body divergences';
const DL2 = 'Top and bottom divergences';
const DL3 = 'Both divergences';
const HL0 = 'Full Range';
const HL1 = 'Top and Bottom';
const HL2 = 'Open and Close';
const HL3 = 'High and Low';
const DV0 = 'Range: Full';
const DV1 = 'Range: Top to Bottom';
const DV2 = 'Range: Open to Close';
const DV3 = 'Range: High to Low';
const DV4 = 'Level: Top or Bottom';
const DV5 = 'Level: High or Low';
const DV6 = 'Level: Close';
const LTF1 = 'Covering most chart bars (least precise)';
const LTF2 = 'Covering some chart bars (less precise)';
const LTF3 = 'Covering less chart bars (more precise)';
const LTF4 = 'Covering few chart bars (very precise)';
const LTF5 = 'Covering the least chart bars (most precise)';
const LTF6 = '~12 intrabars per chart bar';
const LTF7 = '~24 intrabars per chart bar';
const LTF8 = '~50 intrabars per chart bar';
const LTF9 = '~100 intrabars per chart bar';
const LTF10 = '~250 intrabars per chart bar';
const TD1 = 'Both';
const TD2 = 'Longs Only';
const TD3 = 'Shorts Only';

const BALANCES = [CB0, CB1, CB2, CB3, CB4, CB5, CB6];

export interface DeltaVolumeCandlesInputs {
  bodyColorCalcInput: string;
  bodyUpColorInput: string;
  bodyDnColorInput: string;
  bodyGradientInput: boolean;
  bodyShowDivInput: boolean;
  bodyDivModeInput: string;
  bodyDivColorInput: string;
  bodyHollowOnDecVolInput: boolean;
  borderWickUpColorInput: string;
  borderWickDnColorInput: string;
  topBotRefModeInput: string;
  topBotModeInput: string;
  topBotBodyUpColorInput: string;
  topBotBodyDnColorInput: string;
  topBotWickUpColorInput: string;
  topBotWickDnColorInput: string;
  topBotShowDivInput: boolean;
  topBotDivModeInput: string;
  topBotDivColorInput: string;
  showMasInput: boolean;
  maUpColorInput: string;
  maDnColorInput: string;
  maFillCalcInput: string;
  maFillUpColorInput: string;
  maFillDnColorInput: string;
  divLevelsModeInput: string;
  divLevelsBullColorInput: string;
  divLevelsBearColorInput: string;
  divLevelsNeutColorInput: string;
  divLevelsModeHiLoInput: string;
  divLevelsModeHiLoRefInput: string;
  divLevelsFillInput: boolean;
  /** Fill brightness (0 darkest - 100 brightest); the fill transparency is 100 - this value */
  divLevelsFillBriteInput: number;
  bgCalcInput: string;
  bgUpColorInput: string;
  bgDnColorInput: string;
  /** Background brightness (0 - 100); the transparency is 100 - this value */
  bgBriteInput: number;
  volDiscShowInput: boolean;
  volDiscColorInput: string;
  /** Tolerance in percent */
  volDiscToleranceInput: number;
  ltfModeInput: string;
  showInfoBoxInput: boolean;
  infoBoxSizeInput: string;
  infoBoxYPosInput: string;
  infoBoxXPosInput: string;
  infoBoxColorInput: string;
  infoBoxTxtColorInput: string;
  markerDirInput: string;
  showMarker1Input: boolean;
  showMarker2Input: boolean;
  showMarker3Input: boolean;
  marker3ModeInput: string;
  showMarker4Input: boolean;
  marker4ModeInput: string;
  showMarker5Input: boolean;
  showMarker6Input: boolean;
  alertMsgUpInput: string;
  alertMsgDnInput: string;
  balAvgPeriodInput: number;
  balMomPeriodInput: number;
  balRelPeriodInput: number;
  balPctPeriodInput: number;
  biasPeriodInput: number;
  topBotMasPeriodInput: number;
}

export const defaultInputs: DeltaVolumeCandlesInputs = {
  bodyColorCalcInput: CB8,
  bodyUpColorInput: GREEN,
  bodyDnColorInput: MAROON,
  bodyGradientInput: false,
  bodyShowDivInput: false,
  bodyDivModeInput: CB1,
  bodyDivColorInput: YELLOW,
  bodyHollowOnDecVolInput: true,
  borderWickUpColorInput: GREEN,
  borderWickDnColorInput: MAROON,
  topBotRefModeInput: SR1,
  topBotModeInput: TB2,
  topBotBodyUpColorInput: LIME,
  topBotBodyDnColorInput: RED,
  topBotWickUpColorInput: LIME,
  topBotWickDnColorInput: PINK,
  topBotShowDivInput: false,
  topBotDivModeInput: CB2,
  topBotDivColorInput: ORANGE,
  showMasInput: false,
  maUpColorInput: GREEN,
  maDnColorInput: MAROON,
  maFillCalcInput: CB1,
  maFillUpColorInput: GREEN,
  maFillDnColorInput: MAROON,
  divLevelsModeInput: DL0,
  divLevelsBullColorInput: GREEN,
  divLevelsBearColorInput: MAROON,
  divLevelsNeutColorInput: GRAY,
  divLevelsModeHiLoInput: HL2,
  divLevelsModeHiLoRefInput: DV6,
  divLevelsFillInput: false,
  divLevelsFillBriteInput: 50,
  bgCalcInput: CB0,
  bgUpColorInput: GREEN,
  bgDnColorInput: MAROON,
  bgBriteInput: 30,
  volDiscShowInput: true,
  volDiscColorInput: REDLITE,
  volDiscToleranceInput: 1,
  ltfModeInput: LTF9,
  showInfoBoxInput: true,
  infoBoxSizeInput: 'small',
  infoBoxYPosInput: 'bottom',
  infoBoxXPosInput: 'right',
  infoBoxColorInput: '#787B86',
  infoBoxTxtColorInput: '#363A45',
  markerDirInput: TD1,
  showMarker1Input: false,
  showMarker2Input: false,
  showMarker3Input: false,
  marker3ModeInput: CB1,
  showMarker4Input: false,
  marker4ModeInput: CB2,
  showMarker5Input: false,
  showMarker6Input: false,
  alertMsgUpInput: '',
  alertMsgDnInput: '',
  balAvgPeriodInput: 50,
  balMomPeriodInput: 14,
  balRelPeriodInput: 14,
  balPctPeriodInput: 14,
  biasPeriodInput: 14,
  topBotMasPeriodInput: 14,
};

const GP00 = 'Normal Candles';
const GP01 = 'Volume Tops & Bottoms';
const GP02 = 'Divergence Channel';
const GP03 = 'Background';
const GP04 = 'Intrabars';
const GP05 = 'Markers';
const GP06 = 'Periods';
const TT_BRITE = '0 (darkest) — 100 (brightest).';

export const inputConfig: InputConfig[] = [
  { id: 'bodyColorCalcInput', type: 'string', title: 'Color bodies on', defval: CB8, inline: 'bodies', group: GP00, options: [CB0, CB8, CB1, CB2, CB3, CB4, CB5, CB6] },
  { id: 'bodyUpColorInput', type: 'color', title: '', defval: GREEN, inline: 'bodies', group: GP00 },
  {
    id: 'bodyDnColorInput', type: 'color', title: '', defval: MAROON, inline: 'bodies', group: GP00,
    tooltip: "These choices determine the coloring scheme used for candle bodies only, i.e., not the wicks nor the tops and bottoms. \n\nWhen 'Gradient' is selected, a color gradient is calculated on the advances/declines of the signal used. The gradient has no effect when '" + CB8 + "' is selected).\n\nUse 'None' if you do not want the indicator to display candle bodies and wicks so you can use your own candles on charts.",
  },
  { id: 'bodyGradientInput', type: 'bool', title: 'Gradient', defval: false, inline: 'bodies', group: GP00 },
  { id: 'bodyShowDivInput', type: 'bool', title: 'Body divergences calculated on', defval: false, inline: 'bodyDivs', group: GP00 },
  { id: 'bodyDivModeInput', type: 'string', title: '', defval: CB1, inline: 'bodyDivs', group: GP00, options: BALANCES },
  {
    id: 'bodyDivColorInput', type: 'color', title: '', defval: YELLOW, inline: 'bodyDivs', group: GP00,
    tooltip: 'Body divergences occur on discrepancies between the polarity of the bar and that of the specified balance, which is independent from the one used above to determine the color of bodies.',
  },
  {
    id: 'bodyHollowOnDecVolInput', type: 'bool', title: 'Empty bodies on decreasing volume', defval: true, group: GP00,
    tooltip: 'Coloring only the body of bars where volume increases can help you identify more significant bars.\n\nIf you choose to color bodies on divergences, that setting has precedence over this one.',
  },
  { id: 'borderWickUpColorInput', type: 'color', title: 'Borders & wicks ', defval: GREEN, inline: 'b&w', group: GP00 },
  { id: 'borderWickDnColorInput', type: 'color', title: '', defval: MAROON, inline: 'b&w', group: GP00, tooltip: "Borders and wicks are always colored using the bar's polarity." },
  {
    id: 'topBotRefModeInput', type: 'string', title: 'Size tops and bottoms relative to', defval: SR1, inline: 'ref', group: GP01, options: [SR0, SR1],
    tooltip: 'This determines the baseline from which the size of tops and bottoms is calculated.\n\nWith the first choice, the body size of each candle is used as the baseline. With the second choice an average is used, making it easier to appraise the relative size of consecutive tops and bottomes, as their size will be calculated from a more stable baseline.',
  },
  { id: 'topBotModeInput', type: 'string', title: 'Display', defval: TB2, inline: 'tbCalc', group: GP01, options: [TB0, TB1, TB2, TB3] },
  { id: 'topBotBodyUpColorInput', type: 'color', title: 'Fills: ', defval: LIME, inline: 'tbCalc', group: GP01 },
  { id: 'topBotBodyDnColorInput', type: 'color', title: '', defval: RED, inline: 'tbCalc', group: GP01 },
  { id: 'topBotWickUpColorInput', type: 'color', title: 'Borders: ', defval: LIME, inline: 'tbCalc', group: GP01 },
  { id: 'topBotWickDnColorInput', type: 'color', title: '', defval: PINK, inline: 'tbCalc', group: GP01, tooltip: '' },
  { id: 'topBotShowDivInput', type: 'bool', title: 'Top & bottom divergences calculated on', defval: false, inline: 'tbDivs', group: GP01 },
  { id: 'topBotDivModeInput', type: 'string', title: '', defval: CB2, inline: 'tbDivs', group: GP01, options: BALANCES },
  {
    id: 'topBotDivColorInput', type: 'color', title: '', defval: ORANGE, inline: 'tbDivs', group: GP01,
    tooltip: 'Top and bottom divergences occur on discrepancies between the polarity of the bar and that of the specified balance.',
  },
  { id: 'showMasInput', type: 'bool', title: 'Show EMAs of tops/bottoms', defval: false, inline: 'mas', group: GP01 },
  { id: 'maUpColorInput', type: 'color', title: '', defval: GREEN, inline: 'mas', group: GP01 },
  { id: 'maDnColorInput', type: 'color', title: '', defval: MAROON, inline: 'mas', group: GP01 },
  { id: 'maFillCalcInput', type: 'string', title: 'Color the EMA channel on', defval: CB1, inline: 'masColor', group: GP01, options: BALANCES },
  { id: 'maFillUpColorInput', type: 'color', title: '', defval: GREEN, inline: 'masColor', group: GP01 },
  { id: 'maFillDnColorInput', type: 'color', title: '', defval: MAROON, inline: 'masColor', group: GP01 },
  { id: 'divLevelsModeInput', type: 'string', title: 'Draw levels on', defval: DL0, inline: 'divsLevels', group: GP02, options: [DL0, DL1, DL2, DL3] },
  { id: 'divLevelsBullColorInput', type: 'color', title: '', defval: GREEN, inline: 'divsLevels', group: GP02 },
  { id: 'divLevelsBearColorInput', type: 'color', title: '', defval: MAROON, inline: 'divsLevels', group: GP02 },
  {
    id: 'divLevelsNeutColorInput', type: 'color', title: '', defval: GRAY, inline: 'divsLevels', group: GP02,
    tooltip: 'This controls the type of divergences that will trigger the creation of a new set of levels if the previous levels were breached, or the expansion of the current levels if they were not breached yet.',
  },
  { id: 'divLevelsModeHiLoInput', type: 'string', title: 'Hi/Lo levels', defval: HL2, inline: 'hiLoLevels', group: GP02, options: [HL0, HL1, HL2, HL3] },
  {
    id: 'divLevelsModeHiLoRefInput', type: 'string', title: 'Breach reference', defval: DV6, inline: 'hiLoLevels', group: GP02, options: [DV0, DV1, DV2, DV3, DV4, DV5, DV6],
    tooltip: 'The first selection here controls the levels used to establish or resize levels when a divergence occurs. The second choice determines which values must reach outside divergence levels for them to be breached.\n\nTogether, these settings control the sensitivity of the levels.',
  },
  { id: 'divLevelsFillInput', type: 'bool', title: 'Fill', defval: false, inline: 'fillLevels', group: GP02 },
  { id: 'divLevelsFillBriteInput', type: 'int', title: '🔆', defval: 50, inline: 'fillLevels', group: GP02, min: 0, max: 100, step: 5, tooltip: TT_BRITE },
  { id: 'bgCalcInput', type: 'string', title: 'Color On', defval: CB0, inline: '31', group: GP03, options: BALANCES },
  { id: 'bgUpColorInput', type: 'color', title: '', defval: GREEN, inline: '31', group: GP03 },
  { id: 'bgDnColorInput', type: 'color', title: '', defval: MAROON, inline: '31', group: GP03 },
  { id: 'bgBriteInput', type: 'int', title: '🔆', defval: 30, inline: '31', group: GP03, min: 0, max: 100, step: 5, tooltip: TT_BRITE },
  { id: 'volDiscShowInput', type: 'bool', title: 'Show volume discrepancies', defval: true, inline: 'volDiscs', group: GP03 },
  { id: 'volDiscColorInput', type: 'color', title: '', defval: REDLITE, inline: 'volDiscs', group: GP03 },
  {
    id: 'volDiscToleranceInput', type: 'float', title: 'Tolerance (%)', defval: 1, inline: 'volDiscs', group: GP03, min: 0, step: 0.25,
    tooltip: "This displays a background coloron historical bars to indicate that the volume from the chart's timeframe does not match the sum of intrabar volume.\n\nDiscrepancies occur when the two values differ by more than the percentage in the 'Tolerance' field, where '1' indicates 1%.\n\nSee my 'Volume X-ray' indicator's description for an explanation of why this occurs.",
  },
  {
    id: 'ltfModeInput', type: 'string', title: 'Intrabar precision', defval: LTF9, group: GP04, options: [LTF1, LTF2, LTF3, LTF4, LTF5, LTF6, LTF7, LTF8, LTF9, LTF10],
    tooltip: 'Your selection here controls how many intrabars will be analyzed for each chart bar. The more intrabars you analyze, the more precise the calculations will be, but the less chart bars will be covered by the indicator\'s calculations because a maximum of 100K intrabars can be analyzed.\n\nThe first five choices determine the lower timeframe used for intrabars using how much chart coverage you want. The last five choices allow you to select approximately how many intrabars you want analyzed per chart bar.',
  },
  { id: 'showInfoBoxInput', type: 'bool', title: 'Show information box', defval: true, group: GP04, tooltip: 'Displays the lower timeframe used to access intrabars and intrabar statistics in a configurable position and color.' },
  { id: 'infoBoxSizeInput', type: 'string', title: 'Size ', defval: 'small', inline: 'infoBox', group: GP04, options: ['tiny', 'small', 'normal', 'large', 'huge', 'auto'] },
  { id: 'infoBoxYPosInput', type: 'string', title: '↕', defval: 'bottom', inline: 'infoBox', group: GP04, options: ['top', 'middle', 'bottom'] },
  { id: 'infoBoxXPosInput', type: 'string', title: '↔', defval: 'right', inline: 'infoBox', group: GP04, options: ['left', 'center', 'right'] },
  { id: 'infoBoxColorInput', type: 'color', title: '', defval: '#787B86', inline: 'infoBox', group: GP04 },
  { id: 'infoBoxTxtColorInput', type: 'color', title: 'T', defval: '#363A45', inline: 'infoBox', group: GP04 },
  { id: 'markerDirInput', type: 'string', title: 'Direction', defval: TD1, inline: 'dir', group: GP05, options: [TD1, TD2, TD3] },
  {
    id: 'showMarker1Input', type: 'bool', title: 'Marker 1: bumps', defval: false, group: GP05,
    tooltip: "A bump up occurs when: \n• The bar's polarity is up.\n• The `close` is higher than the previous bar's `close`.\n• Bar Balance (VD) is positive.\n• Up volume is greater than the EMA of up volume calculated in the Average Balance.\n• Up volume is greater than the previous bar's up volume.\n\nA bump down occurs when:\n• The bar's polarity is down.\n• The `close` is lower than the previous bar's `close`.\n• Bar Balance (VD) is negative.\n• Down volume is greater than the EMA of down volume calculated in the Average Balance.\n• Down volume is greater (more negative) than the previous bar's down volume.",
  },
  { id: 'showMarker2Input', type: 'bool', title: 'Marker 2: double bumps', defval: false, group: GP05, tooltip: 'A double bump is two consecutive bumps up or down.' },
  {
    id: 'showMarker3Input', type: 'bool', title: 'Marker 3: divergence confirmations', defval: false, inline: 'm3', group: GP05,
    tooltip: 'A divergence is confirmed up/dn when the chosen balance is up/dn on the previous bar when that bar was dn/up, and this bar is up/dn.',
  },
  { id: 'marker3ModeInput', type: 'string', title: 'on', defval: CB1, inline: 'm3', group: GP05, options: [CB1, CB2, CB3, CB4, CB5, CB6] },
  { id: 'showMarker4Input', type: 'bool', title: 'Marker 4: Balance shifts', defval: false, inline: 'm4', group: GP05, tooltip: 'Balance shifts occur when the chosen balance crosses into bull/bear territory.' },
  { id: 'marker4ModeInput', type: 'string', title: 'on', defval: CB2, inline: 'm4', group: GP05, options: [CB2, CB3, CB4, CB5, CB6] },
  { id: 'showMarker5Input', type: 'bool', title: 'Marker 5: Markers Bias shifts', defval: false, group: GP05, tooltip: 'Marker bias shifts occur when it crosses into bull/bear territory.' },
  { id: 'showMarker6Input', type: 'bool', title: 'Marker 6: All balances agree', defval: false, group: GP05, tooltip: 'All balances are bull or bear.' },
  { id: 'alertMsgUpInput', type: 'text_area', title: 'Up alert message', defval: '', group: GP05, tooltip: 'This text will replace the alert message for up alerts.' },
  { id: 'alertMsgDnInput', type: 'text_area', title: 'Down alert message', defval: '', group: GP05, tooltip: 'This text will replace the alert message for down alerts.' },
  { id: 'balAvgPeriodInput', type: 'int', title: 'Average Balance', defval: 50, group: GP06, min: 2 },
  { id: 'balMomPeriodInput', type: 'int', title: 'Momentum Balance', defval: 14, group: GP06, min: 2 },
  { id: 'balRelPeriodInput', type: 'int', title: 'Relative Balance', defval: 14, group: GP06, min: 1 },
  { id: 'balPctPeriodInput', type: 'int', title: 'Percent Balance', defval: 14, group: GP06, min: 1 },
  { id: 'biasPeriodInput', type: 'int', title: 'Markers Bias', defval: 14, group: GP06, min: 2 },
  { id: 'topBotMasPeriodInput', type: 'int', title: 'Tops/Bottoms EMAs', defval: 14, group: GP06, min: 1 },
];

const DW = 'data_window' as const;
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume Delta', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot1', title: 'Volume Delta %', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot2', title: 'Up Volume', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot3', title: 'Dn Volume', color: RED, lineWidth: 1, display: DW },
  { id: 'plot4', title: 'Intrabar Volume', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot5', title: 'Chart bar Volume', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot6', title: '═════════════', color: GRAY, lineWidth: 1, display: DW },
  { id: 'plot7', title: 'Bar Balance', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot8', title: 'Average Balance', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot9', title: 'Momentum Balance ', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot10', title: 'Relative Balance', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot11', title: 'Percent Balance', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot12', title: 'Combined Balances', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot13', title: 'Marker Bias', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot14', title: '═════════════', color: GRAY, lineWidth: 1, display: DW },
  { id: 'plot15', title: 'Top', color: LIME, lineWidth: 1, display: DW },
  { id: 'plot16', title: 'Bottom', color: RED, lineWidth: 1, display: DW },
  { id: 'plot17', title: 'Divergence Hi Level', color: GRAY, lineWidth: 1 },
  { id: 'plot18', title: 'Divergence Lo Level', color: GRAY, lineWidth: 1 },
  { id: 'plot19', title: 'Tops MA', color: GREEN, lineWidth: 1 },
  { id: 'plot20', title: 'Botttoms MA', color: MAROON, lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot17', plot2: 'plot18', title: 'Plots Background' },
  { id: 'fill1', plot1: 'plot19', plot2: 'plot20', title: 'Plots Background' },
];

export const plotCandleConfig = [
  { id: 'candle0', title: 'Tops' },
  { id: 'candle1', title: 'Bottoms' },
  { id: 'candle2', title: 'Candle Structure' },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' }];

export const drawingKinds: StudyDrawingKind[] = ['label', 'table'];

export const hasAlertFunction = true;

export const metadata = {
  title: 'Delta Volume Candles [LucF]',
  shortTitle: 'Delta Volume Candles',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > EPS;
const nz = (x: number, r = 0) => (Number.isFinite(x) ? x : r);
/** Pine math.round: half away from zero */
const round = (x: number) => (x < 0 ? -Math.round(-x) : Math.round(x));
/** math.sign: na stays na */
const sign = (x: number) => (Number.isNaN(x) ? NaN : Math.sign(x));
const zeroOne = (c: boolean) => (c ? 1 : 0);
const addTextIf = (cond: boolean, msg: string, txt: string, sep: string) => (cond ? msg + (msg !== '' ? sep : '') + txt : msg);

/**
 * PineCoders lower_tf `ltf()`: the intrabar timeframe of a selection for a chart timeframe of `chartSeconds`.
 * The "~N intrabars" choices follow version 4 of the library as measured on the reference platform: chart seconds /
 * int(4 N x 0.25 on 24-hour markets, else 4 N); from 60 seconds whole minutes (rounded), else the next valid seconds
 * timeframe (1 second under 5 seconds).
 */
function ltfOf(selection: string, chartSeconds: number, symbolType: string): string {
  const ONE_MIN = 1;
  const ONE_HOUR = ONE_MIN * 60;
  const ONE_DAY = ONE_HOUR * 24;
  const ONE_WEEK = ONE_DAY * 7;
  const m = chartSeconds / 60;
  const h24 = symbolType === 'crypto' || symbolType === 'forex';
  const mktFactor = h24 ? 0.25 : 1.0;
  const perBar = (count: number): string => {
    const s = chartSeconds / Math.trunc(count * mktFactor);
    if (s >= 60) return String(round(s / 60));
    const t = Math.trunc(s);
    return timeframe.from_seconds(t < 5 ? 1 : t);
  };
  switch (selection) {
    case LTF1: return timeframe.from_seconds(Math.trunc(chartSeconds / 4));
    case LTF4:
      return m <= ONE_HOUR ? '5S' : m <= ONE_HOUR * 2 ? '15S' : m <= ONE_HOUR * 4 ? '30S'
        : m <= ONE_HOUR * 12 ? (h24 ? '1' : '30S') : m <= ONE_DAY ? (h24 ? '2' : '1') : m <= ONE_WEEK ? (h24 ? '15' : '5')
          : (h24 ? '60' : '30');
    case LTF5:
      return m <= ONE_HOUR ? '1S' : m <= ONE_HOUR * 2 ? '5S' : m <= ONE_HOUR * 4 ? '15S'
        : m <= ONE_HOUR * 12 ? (h24 ? '30S' : '15S') : m <= ONE_DAY ? (h24 ? '1' : '30S') : m <= ONE_WEEK ? (h24 ? '10' : '3')
          : (h24 ? '30' : '15');
    case LTF2:
      return m <= ONE_MIN ? '5S' : m <= ONE_MIN * 2 ? '10S' : m <= ONE_MIN * 3 ? '15S' : m <= ONE_MIN * 5 ? '30S'
        : m <= ONE_MIN * 15 ? '1' : m <= ONE_HOUR ? '3' : m < ONE_HOUR * 2 ? '5' : m < ONE_HOUR * 4 ? '15'
          : m < ONE_HOUR * 6 ? '30' : m < ONE_HOUR * 12 ? (h24 ? '60' : '30') : m < ONE_DAY ? (h24 ? '120' : '30')
            : m < ONE_WEEK ? (h24 ? '720' : '120') : 'D';
    case LTF3:
      return m <= ONE_MIN ? '1S' : m <= ONE_MIN * 2 ? '5S' : m <= ONE_MIN * 3 ? '10S' : m <= ONE_MIN * 5 ? '15S'
        : m <= ONE_MIN * 15 ? '30S' : m <= ONE_HOUR ? '1' : m < ONE_HOUR * 2 ? '2' : m < ONE_HOUR * 4 ? '3'
          : m < ONE_HOUR * 6 ? '5' : m < ONE_HOUR * 12 ? (h24 ? '10' : '5') : m < ONE_DAY ? (h24 ? '15' : '5')
            : m < ONE_WEEK ? (h24 ? '120' : '30') : '720';
    case LTF6: return perBar(48);
    case LTF7: return perBar(96);
    case LTF8: return perBar(200);
    case LTF9: return perBar(400);
    case LTF10: return perBar(1000);
    default: return '1S';
  }
}

/** The intrabar timeframe for the chart of the context (or of the bars) */
function intrabarTimeframe(cfg: DeltaVolumeCandlesInputs, bars: ReadonlyArray<{ time: number }>, chart?: ChartContext): string {
  const tf = chartTimeframe(bars, chart) || '1D';
  return ltfOf(cfg.ltfModeInput, timeframe.in_seconds(tf), symbolTypeOf(chart));
}

/** Bars the indicator needs: the chart symbol on the intrabar timeframe (none without a chart timeframe). */
export function requiredSymbols(inputs: Partial<DeltaVolumeCandlesInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  if (chartTimeframe([], chart) === '') return [];
  return [{ symbol: tickeridOf(chart), timeframe: intrabarTimeframe(cfg, [], chart) }];
}

/**
 * PineCoders Time `formattedNoOfPeriods(ms)` (version 2, as measured on the reference platform): the quantity rounded
 * to 2 decimals and the unit, plural only above 2 ("14 minutes", "2 hour", "1.5 minute", "2.01 seconds")
 */
function formattedNoOfPeriods(ms: number): string {
  const [unit, denominator] = ms < 60000 ? ['seconds', 1000] : ms < 3600000 ? ['minutes', 60000]
    : ms < 86400000 ? ['hours', 3600000] : ms < 604800000 ? ['days', 86400000]
      : ms < 2628003000 ? ['weeks', 604800000] : ['months', 2628003000];
  const qty = Math.round((ms / (denominator as number)) * 100) / 100;
  const unitString = qty > 2 ? (unit as string) : (unit as string).slice(0, -1);
  return `${str.tostring(qty)} ${unitString}`;
}

/** LucF ta `gradientAdvDecPro()`: one call site (its own var state, crossings and change) */
function gradientSite(steps: number, bearWeak: string, bearStrong: string, bullWeak: string, bullStrong: string) {
  let qtyAdvDec = 0;
  const maxSteps = Math.max(1, steps);
  const xUpSite = callsite.crossover();
  const xDnSite = callsite.crossunder();
  let prev = NaN;
  let result: string | null = null;
  return (source: number): string | null => {
    const xUp = xUpSite(source, 0);
    const xDn = xDnSite(source, 0);
    const chg = source - prev;
    prev = source;
    const up = gt(chg, 0);
    const dn = lt(chg, 0);
    const srcBull = gt(source, 0);
    const srcBear = lt(source, 0);
    qtyAdvDec = srcBull ? (xUp ? 1 : up ? Math.min(maxSteps, qtyAdvDec + 1) : dn ? Math.max(1, qtyAdvDec - 1) : qtyAdvDec)
      : srcBear ? (xDn ? 1 : dn ? Math.min(maxSteps, qtyAdvDec + 1) : up ? Math.max(1, qtyAdvDec - 1) : qtyAdvDec) : qtyAdvDec;
    if (srcBull) result = String(color.from_gradient(qtyAdvDec, 1, maxSteps, bullWeak, bullStrong));
    else if (srcBear) result = String(color.from_gradient(qtyAdvDec, 1, maxSteps, bearWeak, bearStrong));
    return result;
  };
}

type Point = { time: number; value: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<DeltaVolumeCandlesInputs> = {},
  chart?: ChartContext,
): IndicatorResult & {
  fills: FillData[]; plotCandles: Record<string, PlotCandleData[]>; bgColors: BgColorData[]; alertCalls: AlertCall[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (values: number[]) => Series.fromArray(bars, values);
  const lastConfirmed = lastBarConfirmedOf(chart);

  // ---- intrabars: request.security_lower_tf(syminfo.tickerid, intrabarTf, upDnIntrabarVolumesByPolarity())
  const intrabarTf = intrabarTimeframe(cfg, bars, chart);
  const [ltfBars] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: intrabarTf }], chart);
  const ranges = securityLowerTf(bars, ltfBars, intrabarTf, otherSymbolChart(bars, chart),
    { other: { timezone: chart?.timezone, session: chart?.session } });
  // upDnIntrabarVolumesByPolarity on the intrabar series (close[1], upVol[1], dnVol[1]: the intrabar before)
  const ibUp: number[] = [];
  const ibDn: number[] = [];
  for (let j = 0; j < ltfBars.length; j++) {
    const b = ltfBars[j];
    const v = b.volume ?? NaN;
    const c1 = j > 0 ? nz(ltfBars[j - 1].close) : 0;
    let upVol = 0;
    let dnVol = 0;
    if (gt(b.close, b.open)) upVol += v;
    else if (lt(b.close, b.open)) dnVol -= v;
    else if (gt(b.close, c1)) upVol += v;
    else if (lt(b.close, c1)) dnVol -= v;
    else if (j > 0 && nz(ibUp[j - 1]) > 0) upVol += v;
    else if (j > 0 && nz(ibDn[j - 1]) < 0) dnVol -= v;
    ibUp.push(upVol);
    ibDn.push(dnVol);
  }
  /** array.sum: skips na elements */
  const sumOf = (a: number[], from: number, to: number) => {
    let s = 0;
    for (let k = from; k < to; k++) if (!Number.isNaN(a[k])) s += a[k];
    return s;
  };
  const intrabars = ranges.map(([a, b]) => Math.max(0, b - a));
  const volB = ranges.map(([a, b]) => nz(sumOf(ibUp, a, b)));
  const volS = ranges.map(([a, b]) => -nz(sumOf(ibDn, a, b)));
  const volT = volB.map((v, i) => v + volS[i]);
  const volume = bars.map((b) => b.volume ?? NaN);

  // ---- balances
  const balBar = volB.map((v, i) => v - volS[i]);
  const balAvgBMa = A(ta.ema(S(volB), cfg.balAvgPeriodInput));
  const balAvgSMa = A(ta.ema(S(volS), cfg.balAvgPeriodInput));
  const balAvg = balAvgBMa.map((v, i) => v - balAvgSMa[i]);
  const balMomBMa = A(ta.sma(S(volB), cfg.balAvgPeriodInput * 2));
  const balMomSMa = A(ta.sma(S(volS), cfg.balAvgPeriodInput * 2));
  const balMomDeltaDelta = balAvgBMa.map((v, i) => (v - balMomBMa[i]) - (balAvgSMa[i] - balMomSMa[i]));
  const balMom = A(ta.rsi(S(balMomDeltaDelta), cfg.balMomPeriodInput)).map((v) => v - 50);
  const volUpDelta = volB.map((v, i) => Math.max(0, v - balAvgBMa[i]));
  const volDnDelta = volS.map((v, i) => Math.max(0, v - balAvgSMa[i]));
  const balRel = A(ta.alma(S(volUpDelta.map((v, i) => v - volDnDelta[i])), cfg.balRelPeriodInput, 0.85, 6));
  const balPct = A(ta.alma(S(balBar.map((v, i) => 100 * v / volume[i])), cfg.balPctPeriodInput, 0.85, 6));
  const balAll = balBar.map((_, i) => zeroOne(gt(balBar[i], 0)) + zeroOne(gt(balAvg[i], 0)) + zeroOne(gt(balMom[i], 0))
    + zeroOne(gt(balRel[i], 0)) + zeroOne(gt(balPct[i], 0)) - zeroOne(lt(balBar[i], 0)) - zeroOne(lt(balAvg[i], 0))
    - zeroOne(lt(balMom[i], 0)) - zeroOne(lt(balRel[i], 0)) - zeroOne(lt(balPct[i], 0)));
  const BALANCES_QTY = 5;

  // ---- tops and bottoms
  const bodyTop = bars.map((b) => Math.max(b.close, b.open));
  const bodyBot = bars.map((b) => Math.min(b.close, b.open));
  const bodySize = bodyTop.map((t, i) => t - bodyBot[i]);
  const referenceSize = cfg.topBotRefModeInput === SR0 ? bodySize
    : cfg.topBotRefModeInput === SR1 ? A(ta.sma(S(bodySize), 100)) : bodySize.map(() => NaN);
  const topFactor = balBar.map((bb, i) => {
    switch (cfg.topBotModeInput) {
      case TB1: return volB[i] / volT[i];
      case TB2: return gt(bb, 0) ? bb / volT[i] : NaN;
      case TB3: return gt(balAll[i], 0) ? balAll[i] / BALANCES_QTY : NaN;
      default: return NaN;
    }
  });
  const botFactor = balBar.map((bb, i) => {
    switch (cfg.topBotModeInput) {
      case TB1: return volS[i] / volT[i];
      case TB2: return lt(bb, 0) ? Math.abs(bb / volT[i]) : NaN;
      case TB3: return lt(balAll[i], 0) ? Math.abs(balAll[i] / BALANCES_QTY) : NaN;
      default: return NaN;
    }
  });
  const volTop = bodyTop.map((t, i) => t + referenceSize[i] * topFactor[i]);
  const volBot = bodyBot.map((b, i) => b - referenceSize[i] * botFactor[i]);

  // ---- markers
  const markerSignalOf = (balance: string): number[] => {
    switch (balance) {
      case CB1: return balBar;
      case CB2: return balAvg;
      case CB3: return balMom;
      case CB4: return balRel;
      case CB5: return balPct;
      case CB6: return balAll;
      default: return bars.map(() => NaN);
    }
  };
  const divFromMode = (balance: string): boolean[] => {
    const sig = markerSignalOf(balance);
    return bars.map((b, i) => ne(sign(sig[i]), sign(b.close - b.open)));
  };
  const doLongs = cfg.markerDirInput === TD1 || cfg.markerDirInput === TD2;
  const doShorts = cfg.markerDirInput === TD1 || cfg.markerDirInput === TD3;
  const closeArr = bars.map((b) => b.close);
  const rising = (a: number[]) => A(ta.rising(S(a), 1)).map((v) => v === 1);
  const falling = (a: number[]) => A(ta.falling(S(a), 1)).map((v) => v === 1);
  const closeUp = rising(closeArr);
  const closeDn = falling(closeArr);
  const volUp = rising(volume);
  const volBUp = rising(volB);
  const volSUp = rising(volS);
  const barUp = bars.map((b) => gt(b.close, b.open));
  const barDn = bars.map((b) => lt(b.close, b.open));
  const bumpUp = bars.map((_, i) => barUp[i] && closeUp[i] && gt(balBar[i], 0) && gt(volB[i], balAvgBMa[i]) && volBUp[i]);
  const bumpDn = bars.map((_, i) => barDn[i] && closeDn[i] && lt(balBar[i], 0) && gt(volS[i], balAvgSMa[i]) && volSUp[i]);
  const div = divFromMode(cfg.marker3ModeInput);
  const m4 = markerSignalOf(cfg.marker4ModeInput);
  const c4U = A(ta.crossover(S(m4), 0)).map((v) => v === 1);
  const c4D = A(ta.crossunder(S(m4), 0)).map((v) => v === 1);
  const c1U = bumpUp;
  const c1D = bumpDn;
  const c2U = bumpUp.map((u, i) => u && i > 0 && bumpUp[i - 1]);
  const c2D = bumpDn.map((d, i) => d && i > 0 && bumpDn[i - 1]);
  const c3U = barUp.map((u, i) => i > 0 && div[i - 1] && u && !div[i]);
  const c3D = barDn.map((d, i) => i > 0 && div[i - 1] && d && !div[i]);
  const cDiff = bars.map((_, i) => zeroOne(c1U[i]) + zeroOne(c2U[i]) + zeroOne(c3U[i]) + zeroOne(c4U[i])
    - (zeroOne(c1D[i]) + zeroOne(c2D[i]) + zeroOne(c3D[i]) + zeroOne(c4D[i])));
  const balMrk = A(math.sum(S(cDiff), cfg.biasPeriodInput));
  const c5U = A(ta.crossover(S(balMrk), 0)).map((v) => v === 1);
  const c5D = A(ta.crossunder(S(balMrk), 0)).map((v) => v === 1);
  const c6U = balAll.map((v) => eq(v, BALANCES_QTY));
  const c6D = balAll.map((v) => eq(v, -BALANCES_QTY));

  // ---- divergence channel
  let cum = 0;
  const available = volT.map((v) => {
    cum += nz(v);
    return ne(cum, 0);
  });
  const bodyDivRaw = divFromMode(cfg.bodyDivModeInput);
  const topBotDivRaw = divFromMode(cfg.topBotDivModeInput);
  const bodyDiv = bodyDivRaw.map((d, i) => available[i] && d);
  const topBotDiv = topBotDivRaw.map((d, i) => available[i] && d);

  const signalOf = (calc: string): number[] => {
    switch (calc) {
      case CB1: return balBar;
      case CB2: return balAvg;
      case CB3: return balMom;
      case CB4: return balRel;
      case CB5: return balPct;
      case CB6: return balAll;
      case CB7: return balMrk;
      case CB8: return bars.map((b) => b.close - b.open);
      default: return bars.map(() => NaN);
    }
  };
  const stepsOf = (calc: string) => (calc === CB8 ? 4 : 8);
  const masGradient = gradientSite(stepsOf(cfg.maFillCalcInput), String(color.new(cfg.maFillDnColorInput, 90)),
    cfg.maFillDnColorInput, String(color.new(cfg.maFillUpColorInput, 90)), cfg.maFillUpColorInput);
  const bodyGradient = gradientSite(stepsOf(cfg.bodyColorCalcInput), String(color.new(cfg.bodyDnColorInput, 90)),
    cfg.bodyDnColorInput, String(color.new(cfg.bodyUpColorInput, 90)), cfg.bodyUpColorInput);
  const bgBrite = 100 - cfg.bgBriteInput;
  const bgGradient = gradientSite(stepsOf(cfg.bgCalcInput), String(color.new(cfg.bgDnColorInput, Math.max(90, bgBrite))),
    String(color.new(cfg.bgDnColorInput, bgBrite)), String(color.new(cfg.bgUpColorInput, Math.max(90, bgBrite))),
    String(color.new(cfg.bgUpColorInput, bgBrite)));
  const masSignal = signalOf(cfg.maFillCalcInput);
  const bodySignal = signalOf(cfg.bodyColorCalcInput);
  const bgSignal = signalOf(cfg.bgCalcInput);
  const topsMa = cfg.showMasInput ? A(ta.ema(S(fixnanOf(volTop)), cfg.topBotMasPeriodInput)) : bars.map(() => NaN);
  const botsMa = cfg.showMasInput ? A(ta.ema(S(fixnanOf(volBot)), cfg.topBotMasPeriodInput)) : bars.map(() => NaN);
  const fillBrite = 100 - cfg.divLevelsFillBriteInput;
  const volDiscTolerance = cfg.volDiscToleranceInput / 100;
  const volDiscVisible = ne(Number(color.t(cfg.volDiscColorInput)), 100);

  // indicator(max_labels_count = 500)
  resetDrawings({ label: 500 });
  const plots: Record<string, Point[]> = {};
  for (const p of plotConfig) plots[p.id] = [];
  const fill0: string[] = [];
  const fill1: string[] = [];
  const tops: PlotCandleData[] = [];
  const bottoms: PlotCandleData[] = [];
  const candles: PlotCandleData[] = [];
  const bgColors: BgColorData[] = [];
  const alertCalls: AlertCall[] = [];
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  const pc = (c: string | null) => c ?? 'transparent';

  let channelHi = NaN;
  let channelLo = NaN;
  let wasBreached: boolean = false;
  let prevDiv = false;
  let coveredBars = 0;
  let cumIntrabars = 0;
  const lastHistory = lastConfirmed ? n - 1 : n - 2;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const t = b.time;
    const isConfirmed = i < n - 1 || lastConfirmed;
    const isRealtime = i === n - 1 && !lastConfirmed;
    const bull = gt(balBar[i], 0);
    const bear = lt(balBar[i], 0);
    coveredBars += sign(intrabars[i]);
    cumIntrabars += intrabars[i];
    const avgIntrabars = nz(cumIntrabars / coveredBars);

    // ---- data window
    const hl = (c: boolean) => (c ? LIME : RED);
    plots.plot0.push({ time: t, value: val(balBar[i]), color: hl(bull) });
    plots.plot1.push({ time: t, value: val(100 * balBar[i] / volT[i]), color: hl(bull) });
    plots.plot2.push({ time: t, value: val(volB[i]), color: bull ? LIME : GREEN });
    plots.plot3.push({ time: t, value: val(volS[i]), color: bear ? RED : MAROON });
    plots.plot4.push({ time: t, value: val(volT[i]), color: hl(bull) });
    plots.plot5.push({ time: t, value: val(volume[i]), color: hl(bull) });
    plots.plot6.push({ time: t, value: NaN, color: GRAY });
    plots.plot7.push({ time: t, value: val(balBar[i]), color: hl(bull) });
    plots.plot8.push({ time: t, value: val(balAvg[i]), color: hl(gt(balAvg[i], 0)) });
    plots.plot9.push({ time: t, value: val(balMom[i]), color: hl(gt(balMom[i], 0)) });
    plots.plot10.push({ time: t, value: val(balRel[i]), color: hl(gt(balRel[i], 0)) });
    plots.plot11.push({ time: t, value: val(balPct[i]), color: hl(gt(balPct[i], 0)) });
    plots.plot12.push({ time: t, value: val(balAll[i]), color: hl(gt(balAll[i], 0)) });
    plots.plot13.push({ time: t, value: val(balMrk[i]), color: hl(gt(balMrk[i], 0)) });
    plots.plot14.push({ time: t, value: NaN, color: GRAY });
    plots.plot15.push({ time: t, value: val(volTop[i]), color: LIME });
    plots.plot16.push({ time: t, value: val(volBot[i]), color: RED });

    // ---- divergence channel (LucF ta divergenceChannel)
    const divLevelsDiv = cfg.divLevelsModeInput === DL1 ? bodyDiv[i] : cfg.divLevelsModeInput === DL2 ? topBotDiv[i]
      : cfg.divLevelsModeInput === DL3 ? bodyDiv[i] || topBotDiv[i] : false;
    const hiNew = cfg.divLevelsModeHiLoInput === HL0 ? Math.max(nz(volTop[i], b.high), b.high)
      : cfg.divLevelsModeHiLoInput === HL1 ? nz(volTop[i], b.high) : cfg.divLevelsModeHiLoInput === HL2 ? bodyTop[i] : b.high;
    const loNew = cfg.divLevelsModeHiLoInput === HL0 ? Math.min(nz(volBot[i], b.low), b.low)
      : cfg.divLevelsModeHiLoInput === HL1 ? nz(volBot[i], b.low) : cfg.divLevelsModeHiLoInput === HL2 ? bodyBot[i] : b.low;
    const ref = cfg.divLevelsModeHiLoRefInput;
    const hiRef = ref === DV0 ? Math.min(nz(volBot[i], b.low), b.low) : ref === DV1 ? nz(volBot[i], b.low)
      : ref === DV2 ? bodyBot[i] : ref === DV3 ? b.low : ref === DV4 ? nz(volTop[i], b.high) : ref === DV5 ? b.high : b.close;
    const loRef = ref === DV0 ? Math.max(nz(volTop[i], b.high), b.high) : ref === DV1 ? nz(volTop[i], b.high)
      : ref === DV2 ? bodyTop[i] : ref === DV3 ? b.high : ref === DV4 ? nz(volBot[i], b.low) : ref === DV5 ? b.low : b.close;
    let isBull = gt(hiRef, channelHi) && !divLevelsDiv;
    let isBear = lt(loRef, channelLo) && !divLevelsDiv;
    const breaches: boolean = !divLevelsDiv && !wasBreached && (gt(hiRef, channelHi) || lt(loRef, channelLo));
    wasBreached = wasBreached || breaches;
    let newChannel = false;
    if (divLevelsDiv) {
      if (wasBreached && !prevDiv) {
        channelHi = hiNew;
        channelLo = loNew;
        isBull = false;
        isBear = false;
        wasBreached = false;
        newChannel = true;
      } else {
        channelHi = Math.max(nz(channelHi, hiNew), hiNew);
        channelLo = Math.min(nz(channelLo, loNew), loNew);
      }
    }
    prevDiv = divLevelsDiv;
    const divColor = isBull ? cfg.divLevelsBullColorInput : isBear ? cfg.divLevelsBearColorInput : cfg.divLevelsNeutColorInput;
    const drawLevels = cfg.divLevelsModeInput !== CB0;
    plots.plot17.push({ time: t, value: drawLevels ? val(channelHi) : NaN, color: newChannel ? 'transparent' : divColor });
    plots.plot18.push({ time: t, value: drawLevels ? val(channelLo) : NaN, color: newChannel ? 'transparent' : divColor });
    fill0.push(cfg.divLevelsFillInput && !newChannel ? String(color.new(divColor, fillBrite)) : 'transparent');

    // ---- tops / bottoms
    const buyWins = nz(topFactor[i]) > nz(botFactor[i]);
    const showDiv = cfg.topBotShowDivInput && topBotDiv[i];
    const topsColor = showDiv ? cfg.topBotDivColorInput : buyWins ? cfg.topBotBodyUpColorInput : null;
    const botsColor = showDiv ? cfg.topBotDivColorInput : buyWins ? null : cfg.topBotBodyDnColorInput;
    tops.push({ time: t, open: bodyTop[i], high: val(volTop[i]), low: bodyTop[i], close: val(volTop[i]),
      color: pc(buyWins ? topsColor : null), borderColor: cfg.topBotWickUpColorInput });
    bottoms.push({ time: t, open: bodyBot[i], high: val(volBot[i]), low: bodyBot[i], close: val(volBot[i]),
      color: pc(buyWins ? null : botsColor), borderColor: cfg.topBotWickDnColorInput });

    // ---- EMAs of tops / bottoms and their fill
    const masFill = masGradient(masSignal[i]);
    plots.plot19.push({ time: t, value: val(topsMa[i]), color: cfg.maUpColorInput });
    plots.plot20.push({ time: t, value: val(botsMa[i]), color: cfg.maDnColorInput });
    fill1.push(pc(masFill));

    // ---- normal candles
    const bodyGradientColor = bodyGradient(bodySignal[i]);
    let bodyColor: string | null;
    if (cfg.bodyColorCalcInput === CB0) bodyColor = null;
    else if (cfg.bodyShowDivInput && bodyDiv[i]) bodyColor = cfg.bodyDivColorInput;
    else if (cfg.bodyHollowOnDecVolInput && !volUp[i]) bodyColor = null;
    else if (cfg.bodyColorCalcInput !== CB8 && cfg.bodyGradientInput) bodyColor = bodyGradientColor;
    else if (gt(bodySignal[i], 0)) bodyColor = cfg.bodyUpColorInput;
    else if (lt(bodySignal[i], 0)) bodyColor = cfg.bodyDnColorInput;
    else bodyColor = null;
    const wick = cfg.bodyColorCalcInput === CB0 ? null : barUp[i] ? cfg.borderWickUpColorInput : cfg.borderWickDnColorInput;
    candles.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close, color: pc(bodyColor),
      wickColor: pc(wick), borderColor: pc(wick) });

    // ---- background
    const bgFill = bgGradient(bgSignal[i]);
    const volDiscrepancy = gt(Math.abs(volT[i] - volume[i]) / volume[i], volDiscTolerance);
    const bg = !isRealtime && cfg.volDiscShowInput && volDiscrepancy && volDiscVisible ? cfg.volDiscColorInput : bgFill;
    if (bg !== null) bgColors.push({ id: 'bgcolor0', time: t, color: bg });

    // ---- information box (once, on the last historical bar)
    if (cfg.showInfoBoxInput && i === lastHistory) {
      const infoBox = table.new(`${cfg.infoBoxYPosInput}_${cfg.infoBoxXPosInput}` as Parameters<typeof table.new>[0], 1, 1);
      let infoBoxBgColor = cfg.infoBoxColorInput;
      let txt = str.format(
        'Uses intrabars at {0}\nAvg intrabars per chart bar: {1,number,#.##}\nChart bars covered: {2} / {3} ({4,number,percent})',
        formattedNoOfPeriods(timeframe.in_seconds(intrabarTf) * 1000), avgIntrabars, coveredBars, i + 1, coveredBars / (i + 1));
      if (avgIntrabars < 5) {
        txt = 'This quantity of intrabars is dangerously small.\nResults will not be as reliable with so few.\n\n' + txt;
        infoBoxBgColor = '#FF5252';
      } else if (!available[i]) {
        txt = 'No intrabar volume exists for the symbol.\nCannot calculate values.\n\n' + txt;
        infoBoxBgColor = '#FF5252';
      }
      table.cell(infoBox, 0, 0, txt, undefined, undefined, cfg.infoBoxTxtColorInput, undefined, undefined,
        cfg.infoBoxSizeInput, infoBoxBgColor);
    }

    // ---- markers and alerts, on the bar's close
    if (isConfirmed) {
      const topPos = Math.max(nz(volTop[i]), b.high);
      const botPos = Math.min(nz(volBot[i], 10e15), b.low);
      const ups = [
        cfg.showMarker1Input && doLongs && c1U[i], cfg.showMarker2Input && doLongs && c2U[i],
        cfg.showMarker3Input && doLongs && c3U[i], cfg.showMarker4Input && doLongs && c4U[i],
        cfg.showMarker5Input && doLongs && c5U[i], cfg.showMarker6Input && doLongs && c6U[i],
      ];
      const dns = [
        cfg.showMarker1Input && doShorts && c1D[i], cfg.showMarker2Input && doShorts && c2D[i],
        cfg.showMarker3Input && doShorts && c3D[i], cfg.showMarker4Input && doShorts && c4D[i],
        cfg.showMarker5Input && doShorts && c5D[i], cfg.showMarker6Input && doShorts && c6D[i],
      ];
      let labelMsgUp = '';
      let labelMsgDn = '';
      let triggerLong = false;
      let triggerShort = false;
      for (let k = 0; k < ups.length; k++) {
        triggerLong = triggerLong || ups[k];
        triggerShort = triggerShort || dns[k];
        labelMsgUp = addTextIf(ups[k], labelMsgUp, `M${k + 1}▲`, '\n');
        labelMsgDn = addTextIf(dns[k], labelMsgDn, `M${k + 1}▼`, '\n');
      }
      if (triggerLong) {
        alertCalls.push({ time: t as number, message: cfg.alertMsgUpInput === '' ? labelMsgUp : cfg.alertMsgUpInput, freq: 'once_per_bar' });
        label.new(i, botPos, labelMsgUp, 'bar_index', 'price', 'transparent', 'label_up', LIME);
      }
      if (triggerShort) {
        alertCalls.push({ time: t as number, message: cfg.alertMsgDnInput === '' ? labelMsgDn : cfg.alertMsgDnInput, freq: 'once_per_bar' });
        label.new(i, topPos, labelMsgDn, 'bar_index', 'price', 'transparent', 'label_down', RED);
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills: [
      { id: 'fill0', plot1: 'plot17', plot2: 'plot18', options: { title: 'Plots Background' }, colors: fill0 },
      { id: 'fill1', plot1: 'plot19', plot2: 'plot20', options: { title: 'Plots Background' }, colors: fill1 },
    ],
    plotCandles: { candle0: tops, candle1: bottoms, candle2: candles },
    bgColors,
    alertCalls,
    ...drawingOutputs(bars),
  };
}

/** fixnan(): the last non-na value */
function fixnanOf(values: number[]): number[] {
  let last = NaN;
  return values.map((v) => {
    if (!Number.isNaN(v)) last = v;
    return last;
  });
}

export const DeltaVolumeCandles = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, plotCandleConfig, barColorConfig,
  drawingKinds, hasAlertFunction, requiredSymbols,
};
