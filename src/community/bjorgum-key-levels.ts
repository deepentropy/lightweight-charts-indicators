/**
 * Bjorgum Key Levels
 *
 * Support / resistance zones from pivots. A pivot high or low of the source (Heikin Ashi body, candle body or
 * high / low) creates a zone box around the pivot price; its height is the ATR * "Zone Width", capped by "Max Zone
 * Percent" of the price. The last "Number of Pivots" pivot highs and pivot lows are tracked: their boxes grow to the
 * right on each bar, a new zone that overlaps a tracked zone takes its top and bottom ("Align Zones"), and a zone
 * turns bullish when the close is above it and bearish when the close is below it (the old box stops and a new box
 * of the other colour starts). Boxes of older pivots stay on the chart.
 *
 * Optional signals (all off by default): breakout / breakdown of all tracked zones, resistance / support breaks,
 * false breaks (arrows), up / down candles inside a zone, TSI curls inside a zone, and 18 candlestick patterns
 * found in a zone at a swing high / low, shown with labels and boxes. "Show Level Labels" adds price labels and
 * lines for the tracked zones on the last bar.
 *
 * The candlestick pattern functions come from the library "BjCandlePatterns" by Bjorgum (version 2, the version
 * the original imports); the functions used are ported in this file.
 * The original keeps at most 500 boxes and 500 labels (max_boxes_count, max_labels_count).
 * The port has closed bars only: "Wait For Confirmed Bar" has no effect, and the "Alerts Mode" input is kept for
 * the settings only (alerts are not ported).
 * The level labels round the price to the tick of the symbol; the port has no symbol information and uses a tick of
 * 0.01. The height of the false break arrows (third "False Break Color" input) is not ported.
 *
 * Reference: "Bjorgum Key Levels" by Bjorgum
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Bjorgum
 */

import { ta, Series, color, compare, math, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BoxData, LabelData, LineDrawingData } from '../types';
import { barTime } from '../bar-time';

export interface BjorgumKeyLevelsInputs {
  left: number;
  right: number;
  /** Number of pivot highs and of pivot lows tracked */
  nPiv: number;
  atrLen: number;
  /** Zone Width (ATR) */
  mult: number;
  /** Max Zone Percent */
  per: number;
  /** Max Boxes for Patterns */
  maxBoxes: number;
  /** Offset For Labels */
  fut: number;
  src: 'HA' | 'High/Low Body' | 'High/Low';
  alignZones: boolean;
  extend: boolean;
  lLab: boolean;
  dhighs: boolean;
  dlows: boolean;
  detectBO: boolean;
  detectBD: boolean;
  breakUp: boolean;
  breakDn: boolean;
  falseBull: boolean;
  falseBear: boolean;
  supPush: boolean;
  resPush: boolean;
  curl: boolean;
  /** Wait For Confirmed Bar (no effect: the port has closed bars only) */
  repaint: boolean;
  labels: boolean;
  sBox: boolean;
  detectDoji: boolean;
  detectEngulfing: boolean;
  detectHammerStar: boolean;
  detectDragonGrave: boolean;
  detectTweezers: boolean;
  detectSpinningTop: boolean;
  detectPiercingCloud: boolean;
  detectHarami: boolean;
  detectLongShadows: boolean;
  /** Alerts Mode (not used: alerts are not ported) */
  alertMode: 'once_per_bar' | 'once_per_bar_close';
  ecWick: boolean;
  colorMatch: boolean;
  closeHalf: boolean;
  atrMax: number;
  rejectWickMax: number;
  hammerFib: number;
  hsShadowPerc: number;
  hammerSize: number;
  dojiSize: number;
  dojiWickSize: number;
  luRatio: number;
  lookback: number;
  swing: number;
  reflect: number;
  offset: number;
  bullBorder: string;
  bullBgCol: string;
  bearBorder: string;
  bearBgCol: string;
  upCol: string;
  dnCol: string;
  supCol: string;
  resCol: string;
  fBull: string;
  fBear: string;
  /** Maximum height of the false break arrows in pixels (not ported) */
  arrowMax: number;
  moveBullCol: string;
  moveBearCol: string;
  curlBullCol: string;
  curlBearCol: string;
  patBullBg: string;
  patNeutBg: string;
  patBearBg: string;
  patBullBo: string;
  patNeutBo: string;
  patBearBo: string;
  textBullCol: string;
  textNeutCol: string;
  textBearCol: string;
  labBullCol: string;
  labNeutCol: string;
  labBearCol: string;
  strat: 'Fast' | 'Slow';
  longf: number;
  shortf: number;
  signalf: number;
  longs: number;
  shorts: number;
  signals: number;
}

// Colour input defaults: color.new(c, t) with the alpha of the input (2 decimals), e.g. transparency 95 = alpha 0.05
export const defaultInputs: BjorgumKeyLevelsInputs = {
  left: 20,
  right: 15,
  nPiv: 4,
  atrLen: 30,
  mult: 0.5,
  per: 5,
  maxBoxes: 10,
  fut: 30,
  src: 'HA',
  alignZones: true,
  extend: false,
  lLab: false,
  dhighs: true,
  dlows: true,
  detectBO: false,
  detectBD: false,
  breakUp: false,
  breakDn: false,
  falseBull: false,
  falseBear: false,
  supPush: false,
  resPush: false,
  curl: false,
  repaint: true,
  labels: false,
  sBox: false,
  detectDoji: false,
  detectEngulfing: false,
  detectHammerStar: false,
  detectDragonGrave: false,
  detectTweezers: false,
  detectSpinningTop: false,
  detectPiercingCloud: false,
  detectHarami: false,
  detectLongShadows: false,
  alertMode: 'once_per_bar_close',
  ecWick: false,
  colorMatch: false,
  closeHalf: false,
  atrMax: 0,
  rejectWickMax: 0,
  hammerFib: 33,
  hsShadowPerc: 5,
  hammerSize: 0.1,
  dojiSize: 5,
  dojiWickSize: 2,
  luRatio: 75,
  lookback: 2,
  swing: 5,
  reflect: 10,
  offset: 1,
  bullBorder: 'rgba(100,181,246,0.4)',
  bullBgCol: 'rgba(100,181,246,0.05)',
  bearBorder: 'rgba(255,235,59,0.4)',
  bearBgCol: 'rgba(255,235,59,0.05)',
  upCol: 'rgba(255,109,0,0.75)',
  dnCol: 'rgba(255,0,255,0.75)',
  supCol: 'rgba(23,255,0,0.75)',
  resCol: 'rgba(255,0,0,0.75)',
  fBull: 'rgba(23,255,0,0.75)',
  fBear: 'rgba(255,0,0,0.75)',
  arrowMax: 75,
  moveBullCol: 'rgba(100,181,246,0.75)',
  moveBearCol: 'rgba(255,235,59,0.75)',
  curlBullCol: 'rgba(23,255,0,0.6)',
  curlBearCol: 'rgba(243,255,0,0.6)',
  patBullBg: 'rgba(23,255,0,0.1)',
  patNeutBg: 'rgba(178,181,190,0.1)',
  patBearBg: 'rgba(255,0,0,0.1)',
  patBullBo: 'rgba(23,255,0,0.2)',
  patNeutBo: 'rgba(178,181,190,0.2)',
  patBearBo: 'rgba(255,0,0,0.2)',
  textBullCol: 'rgba(23,255,0,1)',
  textNeutCol: 'rgba(178,181,190,1)',
  textBearCol: 'rgba(255,0,0,1)',
  labBullCol: 'rgba(23,255,0,0.2)',
  labNeutCol: 'rgba(178,181,190,0.2)',
  labBearCol: 'rgba(255,0,0,0.2)',
  strat: 'Fast',
  longf: 25,
  shortf: 5,
  signalf: 14,
  longs: 25,
  shorts: 13,
  signals: 13,
};

const G_ZONES = 'Zones';
const G_DETECT = 'Detection';
const G_PATTERNS = 'Candle Patterns';
const G_FILTERS = 'Candle Filters';
const G_LOOKBACK = 'Lookback';
const G_LABEL_COL = 'Label Color (Text/Bg)';
const G_PAT_COL = 'Pattern Box Color';
const D = defaultInputs;

export const inputConfig: InputConfig[] = [
  { id: 'left', type: 'int', title: 'Look Left', defval: D.left, group: G_ZONES, tooltip: 'Look left for swing high/low in x number of bars to form pivot. The higher the number, the higher the script looks to the left for the highest/lowest point before drawing pivot' },
  { id: 'right', type: 'int', title: 'Look Right', defval: D.right, group: G_ZONES, tooltip: 'Look right for swing high/low in x number of bars to form pivot. The higher the number, the higher the script looks to the right for the highest/lowest point before drawing pivot' },
  { id: 'nPiv', type: 'int', title: 'Number of Pivots', defval: D.nPiv, group: G_ZONES, tooltip: 'This sets the array size, or the number of pivots to track at a time (x highs, and x number of lows)' },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: D.atrLen, group: G_ZONES, tooltip: 'Number of bars to average. ATR is used to standardize zone width between assets and timeframes' },
  { id: 'mult', type: 'float', title: 'Zone Width (ATR)', defval: D.mult, step: 0.1, group: G_ZONES, tooltip: 'ATR multiplier to set zone width. Default is half of one ATR from box bottom to box top' },
  { id: 'per', type: 'float', title: 'Max Zone Percent', defval: D.per, group: G_ZONES, tooltip: 'Max zone size as a percent of price. Some assets can be too volatile at low prices creating an unreasonably sized zone' },
  { id: 'maxBoxes', type: 'float', title: 'Max Boxes for Patterns', defval: D.maxBoxes, group: G_ZONES, tooltip: 'Number of boxes for candlestick patterns to track historically. Note: the higher the number the less pivot zones will be tracked when looking back in time due to the limitation on the number of box elements allowed at once' },
  { id: 'fut', type: 'int', title: 'Offset For Labels', defval: D.fut, group: G_ZONES, tooltip: 'Number of bars to offset labels for price levels' },
  { id: 'src', type: 'string', title: 'Source For Pivots', defval: D.src, options: ['HA', 'High/Low Body', 'High/Low'], group: G_ZONES, tooltip: 'Source input for pivots. Default tracks the highest and lowest bodies of HA candles to average price action, which can result in a level that sits in the overlap of support and resistance' },
  { id: 'alignZones', type: 'bool', title: 'Align Zones', defval: D.alignZones, group: G_ZONES, tooltip: "Aligns recurring zones who's edges overlap an existing zone creating a zone that ages in time and intensifies visually" },
  { id: 'extend', type: 'bool', title: 'Extend Right', defval: D.extend, group: G_ZONES, tooltip: 'Extends current zones right' },
  { id: 'lLab', type: 'bool', title: 'Show Level Labels', defval: D.lLab, group: G_ZONES, tooltip: 'Show labels for price levels extended off Key Levels' },

  { id: 'dhighs', type: 'bool', title: 'Detect Pivot Highs', defval: D.dhighs, group: G_DETECT, tooltip: 'Disabling will prevent highs from being tracked' },
  { id: 'dlows', type: 'bool', title: 'Detect Pivot Lows', defval: D.dlows, group: G_DETECT, tooltip: 'Disabling will prevent lows from being tracked' },
  { id: 'detectBO', type: 'bool', title: 'Detect Breakout', defval: D.detectBO, group: G_DETECT, tooltip: 'Show points that price action breaks above all pivots. An arrow from below is displayed' },
  { id: 'detectBD', type: 'bool', title: 'Detect Breakdown', defval: D.detectBD, group: G_DETECT, tooltip: 'Show points that price action breaks below all pivots. An arrow from above is displayed' },
  { id: 'breakUp', type: 'bool', title: 'Detect Resistance Break', defval: D.breakUp, group: G_DETECT, tooltip: 'Show points that price action breaks above resistance. An arrow from below is displayed' },
  { id: 'breakDn', type: 'bool', title: 'Detect Support Break', defval: D.breakDn, group: G_DETECT, tooltip: 'Show points that price action breaks below support. An arrow from above is displayed' },
  { id: 'falseBull', type: 'bool', title: 'Detect False Breakdown', defval: D.falseBull, group: G_DETECT, tooltip: 'Show points that price action initially breaks below support before reversing. False moves can lead to fast moves in the opposite direction (bear trap). A large arrow from below is displayed' },
  { id: 'falseBear', type: 'bool', title: 'Detect False Breakup', defval: D.falseBear, group: G_DETECT, tooltip: 'Show points that price action initially breaks above resistance before reversing. False moves can lead to fast moves in the opposite direction (bull trap). A large arrow from above is displayed' },
  { id: 'supPush', type: 'bool', title: 'Detect Moves Off Support', defval: D.supPush, group: G_DETECT, tooltip: 'Show up candles that are detected within a support zone. Can show points support is being respected. A triangle from below is displayed' },
  { id: 'resPush', type: 'bool', title: 'Detect Moves Off Resistance', defval: D.resPush, group: G_DETECT, tooltip: 'Show down candles that are detected within a resistance zone. Can show points resistance is being respected. A triangle from above is displayed' },
  { id: 'curl', type: 'bool', title: 'Detect TSI Curl', defval: D.curl, group: G_DETECT, tooltip: "Show Bjorgum TSI 'curl' when candles are detected in the range of a key zone. Can show momentum shift at Key Levels. (Correlates to Bjorgum TSI indicator)" },

  { id: 'repaint', type: 'bool', title: 'Wait For Confirmed Bar', defval: D.repaint, group: G_PATTERNS, tooltip: 'Wait for candles end before detecting patterns. False will show potential patterns forming before they are confirmed.' },
  { id: 'labels', type: 'bool', title: 'Show Label', defval: D.labels, group: G_PATTERNS, tooltip: 'Show a label for detected candle patterns' },
  { id: 'sBox', type: 'bool', title: 'Show Boxes Around Patterns', defval: D.sBox, group: G_PATTERNS, tooltip: 'Show a box around detected candle patterns' },
  { id: 'detectDoji', type: 'bool', title: 'Detect Doji', defval: D.detectDoji, group: G_PATTERNS, tooltip: 'Detect Doji candle patterns' },
  { id: 'detectEngulfing', type: 'bool', title: 'Detect Engulfing', defval: D.detectEngulfing, group: G_PATTERNS, tooltip: 'Detect Engulfing patterns' },
  { id: 'detectHammerStar', type: 'bool', title: 'Detect Hammers and Stars', defval: D.detectHammerStar, group: G_PATTERNS, tooltip: 'Detect Hammers and Shooting Star patterns' },
  { id: 'detectDragonGrave', type: 'bool', title: 'Detect Dragons and Graves', defval: D.detectDragonGrave, group: G_PATTERNS, tooltip: 'Detect Dragonfly Doji and Gravestone Doji patterns' },
  { id: 'detectTweezers', type: 'bool', title: 'Detect Tweezers', defval: D.detectTweezers, group: G_PATTERNS, tooltip: 'Detect Tweezer Top and Tweezer Bottom patterns' },
  { id: 'detectSpinningTop', type: 'bool', title: 'Detect Spinning Top', defval: D.detectSpinningTop, group: G_PATTERNS, tooltip: 'Detect Spinning Top patterns' },
  { id: 'detectPiercingCloud', type: 'bool', title: 'Detect Piercing and Clouds', defval: D.detectPiercingCloud, group: G_PATTERNS, tooltip: 'Detect Piercing and Dark Cloud Cover patterns' },
  { id: 'detectHarami', type: 'bool', title: 'Detect Harami', defval: D.detectHarami, group: G_PATTERNS, tooltip: 'Detect Harami candle patterns' },
  { id: 'detectLongShadows', type: 'bool', title: 'Detect Long Shadows', defval: D.detectLongShadows, group: G_PATTERNS, tooltip: 'Detect Long Upper Shadow and Long Lower Shadow patterns' },

  { id: 'alertMode', type: 'string', title: 'Alerts Mode', defval: D.alertMode, options: ['once_per_bar', 'once_per_bar_close'], group: 'Alert Frequency' },

  { id: 'ecWick', type: 'bool', title: 'Engulfing Must Engulf Wick', defval: D.ecWick, group: G_FILTERS, tooltip: 'Determines if engulfing candles must engulf the wick or just the body of the preceding candle' },
  { id: 'colorMatch', type: 'bool', title: 'H&S Must Match Color', defval: D.colorMatch, group: G_FILTERS, tooltip: 'Determines if hammers must be up candles and shooting stars must be down candles' },
  { id: 'closeHalf', type: 'bool', title: 'Tweezer Close Over Half', defval: D.closeHalf, group: G_FILTERS, tooltip: 'Determines if Tweezer patterns must close beyond the half way point of the preceding candle' },
  { id: 'atrMax', type: 'float', title: 'Max Candle Size (× ATR)', defval: D.atrMax, step: 0.1, group: G_FILTERS, tooltip: 'Maximum size of setup candles (as a multiplier of the current ATR)' },
  { id: 'rejectWickMax', type: 'float', title: '[EC] Max Reject Wick Size', defval: D.rejectWickMax, step: 1, group: G_FILTERS, tooltip: 'The maximum wick size as a percentage of body size allowable for a rejection wick on the resolution candle of the pattern. 0 disables the filter' },
  { id: 'hammerFib', type: 'float', title: '[HS] H&S Ratio (%)', defval: D.hammerFib, step: 1, group: G_FILTERS, tooltip: 'The relationship of body to candle size for hammers and stars. (ie. body is 33% of total candle size).' },
  { id: 'hsShadowPerc', type: 'float', title: '[HS] H&S Opposing Shadow (%)', defval: D.hsShadowPerc, step: 1, group: G_FILTERS, tooltip: 'The maximum allowable opposing wick size as a percent of body size (ex. top wick for a hammer pattern etc.)' },
  { id: 'hammerSize', type: 'float', title: '[HS] H&S Min Size (× ATR)', defval: D.hammerSize, step: 0.1, group: G_FILTERS, tooltip: 'The minimum size of hammers, stars, or long shadows as a multiplier of ATR. (To filter out tiny setups)' },
  { id: 'dojiSize', type: 'float', title: '[DJ] Doji Size (%)', defval: D.dojiSize, step: 1, group: G_FILTERS, tooltip: 'The relationship of body to candle size (ie. body is 5% of total candle size).' },
  { id: 'dojiWickSize', type: 'float', title: '[DJ] Max Doji Wick Size', defval: D.dojiWickSize, step: 1, group: G_FILTERS, tooltip: 'Maximum wick size comparative to the opposite wick. (eg. 2 = bottom wick must be less than or equal to 2x the top wick).' },
  { id: 'luRatio', type: 'float', title: '[LS] Long Shadow (%)', defval: D.luRatio, step: 1, group: G_FILTERS, tooltip: 'A relationship of the upper wick to the overall candle size expressed as a percent.' },

  { id: 'lookback', type: 'int', title: 'Lookback For Breaks', defval: D.lookback, group: G_LOOKBACK, tooltip: 'Number of candles that can be included in a false break signal' },
  { id: 'swing', type: 'int', title: 'swing High/Low', defval: D.swing, group: G_LOOKBACK, tooltip: 'Swing detection is used to filter signals on breakout type signals. A higher number will mean more significant points, but less of them' },
  { id: 'reflect', type: 'int', title: 'Significant High/Low', defval: D.reflect, group: G_LOOKBACK, tooltip: 'Filter to ensure a setup is a significant swing point. Look back this far' },
  { id: 'offset', type: 'int', title: 'Consider Bar From High/Low', defval: D.offset, group: G_LOOKBACK, tooltip: 'Candle pattern high/low distance from absolute swing high/low. Example: 0 would filter patterns that are only the highest/lowest, 1 filters second highest over the significant length, etc.' },

  { id: 'bullBorder', type: 'color', title: '', defval: D.bullBorder, inline: '0', group: 'Pivot Color' },
  { id: 'bullBgCol', type: 'color', title: '', defval: D.bullBgCol, inline: '0', group: 'Pivot Color', tooltip: 'Color of bullish Key Levels\n(border, background)' },
  { id: 'bearBorder', type: 'color', title: '', defval: D.bearBorder, inline: '1', group: 'Pivot Color' },
  { id: 'bearBgCol', type: 'color', title: '', defval: D.bearBgCol, inline: '1', group: 'Pivot Color', tooltip: 'Color of bearish Key Levels\n(border, background)' },

  { id: 'upCol', type: 'color', title: '', defval: D.upCol, inline: '2', group: 'Breakout Color' },
  { id: 'dnCol', type: 'color', title: '', defval: D.dnCol, inline: '2', group: 'Breakout Color', tooltip: 'Color of breakout arrows\n(bull, bear,)' },

  { id: 'supCol', type: 'color', title: '', defval: D.supCol, inline: '3', group: 'S&R Break Color' },
  { id: 'resCol', type: 'color', title: '', defval: D.resCol, inline: '3', group: 'S&R Break Color', tooltip: 'Color of triangles for broken support or resistance\n(bull, bear)' },

  { id: 'fBull', type: 'color', title: '', defval: D.fBull, inline: '4', group: 'False Break Color' },
  { id: 'fBear', type: 'color', title: '', defval: D.fBear, inline: '4', group: 'False Break Color' },
  { id: 'arrowMax', type: 'int', title: '', defval: D.arrowMax, inline: '4', group: 'False Break Color', tooltip: 'Color of arrows for false breaks\n(bull, bear, arrow max height in pixels)' },

  { id: 'moveBullCol', type: 'color', title: '', defval: D.moveBullCol, inline: '5', group: 'Moves From S&R Color' },
  { id: 'moveBearCol', type: 'color', title: '', defval: D.moveBearCol, inline: '5', group: 'Moves From S&R Color', tooltip: 'Color of triangles for candles that are detected within zones\n(bull, bear)' },

  { id: 'curlBullCol', type: 'color', title: '', defval: D.curlBullCol, inline: '6', group: 'Momentum Curl Color' },
  { id: 'curlBearCol', type: 'color', title: '', defval: D.curlBearCol, inline: '6', group: 'Momentum Curl Color', tooltip: "Show Bjorgum TSI 'curl' when candles are detected in the range of a key zone. Can show momentum shift at Key Levels. (Correlates to Bjorgum TSI indicator)" },

  { id: 'patBullBg', type: 'color', title: '', defval: D.patBullBg, inline: '7', group: G_PAT_COL },
  { id: 'patNeutBg', type: 'color', title: '', defval: D.patNeutBg, inline: '7', group: G_PAT_COL },
  { id: 'patBearBg', type: 'color', title: '', defval: D.patBearBg, inline: '7', group: G_PAT_COL },
  { id: 'patBullBo', type: 'color', title: '', defval: D.patBullBo, inline: '8', group: G_PAT_COL },
  { id: 'patNeutBo', type: 'color', title: '', defval: D.patNeutBo, inline: '8', group: G_PAT_COL },
  { id: 'patBearBo', type: 'color', title: '', defval: D.patBearBo, inline: '8', group: G_PAT_COL, tooltip: 'Color of boxes that wrap candestick patterns\nBackgrounds: (bull, neutral, bear)\nBorders: (bull, neutral, bear)' },

  { id: 'textBullCol', type: 'color', title: '', defval: D.textBullCol, inline: '9', group: G_LABEL_COL },
  { id: 'textNeutCol', type: 'color', title: '', defval: D.textNeutCol, inline: '9', group: G_LABEL_COL },
  { id: 'textBearCol', type: 'color', title: '', defval: D.textBearCol, inline: '9', group: G_LABEL_COL },
  { id: 'labBullCol', type: 'color', title: '', defval: D.labBullCol, inline: '10', group: G_LABEL_COL },
  { id: 'labNeutCol', type: 'color', title: '', defval: D.labNeutCol, inline: '10', group: G_LABEL_COL },
  { id: 'labBearCol', type: 'color', title: '', defval: D.labBearCol, inline: '10', group: G_LABEL_COL, tooltip: 'Color of labels that mark candestick patterns\nText: (bull, neutral, bear)\nLabels: (bull, neutral, bear)' },

  { id: 'strat', type: 'string', title: 'Select a Speed', defval: D.strat, options: ['Fast', 'Slow'], group: 'TSI Speed Control', tooltip: 'TSI speed control presets. Both speeds correlate to the Bjorgum TSI indicator' },

  { id: 'longf', type: 'int', title: 'Long Length', defval: D.longf, group: 'TSI Fast Settings' },
  { id: 'shortf', type: 'int', title: 'Short Length', defval: D.shortf, group: 'TSI Fast Settings' },
  { id: 'signalf', type: 'int', title: 'Signal Length', defval: D.signalf, group: 'TSI Fast Settings' },

  { id: 'longs', type: 'int', title: 'Long Length', defval: D.longs, group: 'TSI Slow Settings' },
  { id: 'shorts', type: 'int', title: 'Short Length', defval: D.shorts, group: 'TSI Slow Settings' },
  { id: 'signals', type: 'int', title: 'Signal Length', defval: D.signals, group: 'TSI Slow Settings' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Bjorgum Key Levels',
  shortTitle: 'Bj Key Levels',
  overlay: true,
};

/** Pine max_boxes_count / max_labels_count / max_lines_count */
const MAX_OBJECTS = 500;
/** syminfo.mintick is not available to the port (Bar has no symbol info) */
const MINTICK = 0.01;

/** Pine `for i = a to b`: counts down when a > b */
function pineRange(a: number, b: number): number[] {
  const out: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
}

/** Pine math.min: na when one of the values is na */
const pineMin = (a: number, b: number) => math.min(a, b) as number;

/** Pine array.get: an index outside the array is a runtime error */
function get<T>(arr: T[], i: number): T {
  if (!(i >= 0 && i < arr.length)) throw new Error(`Index ${i} is out of bounds, array size is ${arr.length}`);
  return arr[i];
}

/** A box of the script; a deleted box reads as na and ignores setters */
interface ScriptBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  border: string;
  bg: string;
  extend: 'none' | 'right';
  deleted: boolean;
}

/**
 * Live objects of one kind, oldest first. Pine: a creation that brings the count above max + 5 deletes the oldest
 * objects until max remain.
 */
class Registry<T extends { deleted: boolean }> {
  readonly live: T[] = [];
  add(obj: T): T {
    this.live.push(obj);
    if (this.live.length > MAX_OBJECTS + 5) {
      for (const old of this.live.splice(0, this.live.length - MAX_OBJECTS)) old.deleted = true;
    }
    return obj;
  }
  delete(obj: T | null): void {
    if (!obj || obj.deleted) return;
    obj.deleted = true;
    this.live.splice(this.live.indexOf(obj), 1);
  }
}

// Tooltips of the pattern labels (library BjCandlePatterns)
const TIP = {
  doji: 'Doji\nTransitional candle signifying equality or indecision with a small or non-existent real body as the session closes at or near its open',
  bullEngulf: "Bullish Engulfing\nAn up candle that closes higher than the previous day's opening after opening lower than the previous day's close",
  bearEngulf: "Bearish Engulfing\nA down candle that closes lower than the previous day's opening after opening higher than the previous day's close",
  hammer: 'Hammer\nBullish bottoming candle comprised of a long lower wick and small real body typically closing at or near the highs',
  star: 'Shooting Star\nBearish topping candle comprised of a long upper wick and small real body typically closing at or near the lows',
  dragonfly: 'Dragonfly Doji\nThis bullish doji varietal is defined by an open and a close at or near the highs of the bar',
  gravestone: 'Gravestone Doji\nThis bearish doji varietal is defined by an open and a close at or near the lows of the bar',
  tweezerBottom: "Tweezer Bottom\nAn up candle following a down candle in a downtrend who's lows are nearly identical. The defence of the double bottom and a push to close green can show bulls are ready to fight back and can signal reversal",
  tweezerTop: "TweezerTop\nA down candle following an up candle in a uptrend who's highs are nearly identical. The defence of the double top and a push to close red can show bears are ready to fight back and can signal reversal",
  spinningBull: 'Bullish Spinning Top\nAn up candle defined by a short body surrounded by long wicks of approximately the same length as one another with each wick greater than the size of the body. Typical sign of indecision and possible reversal when observed at the swing low, or continuation sign if price breaks beyond the swing point',
  spinningBear: 'Bearish Spinning Top\nA down candle defined by a short body surrounded by long wicks of approximately the same length as one another with each wick greater than the size of the body. Typical sign of indecision and possible reversal when observed at the swing high, or continuation sign if price breaks beyond the swing point',
  haramiBull: 'Bullish Harami\nThis 2 bar bullish pattern consists of a small-bodied green candle that is entirely encompassed within the body of what was once a red-bodied candle.',
  haramiBear: 'Bearish Harami\nThis 2 bar bearish pattern consists of a small-bodied red candle that is entirely encompassed within the body of what was once a green-bodied candle.',
  piercing: 'Piercing\nA two-candle bullish reversal candlestick pattern found in a downtrend. The first candle is red and has a larger than average body. The second candle is green and opens below the low of the prior candle, creating a gap, and then closes above the midpoint of the first candle.',
  darkCloud: 'Dark Cloud Cover\nA two-candle bearish reversal candlestick pattern found in an uptrend. The first candle is green and has a larger than average body. The second candle is red and opens above the high of the prior candle, creating a gap, and then closes below the midpoint of the first candle.',
  lls: 'Long Lower Shadow\nTo indicate seller domination of the first part of a session, candlesticks will present with long lower shadows, as well as short upper shadows, which leaves sellers underwater by candles end',
  lus: 'Long Upper Shadow\nTo indicate buyer domination of the first part of a session, candlesticks will present with long upper shadows, as well as short lower shadows, which leaves buyers underwater by candles end',
};

export function calculate(
  bars: Bar[],
  inputs: Partial<BjorgumKeyLevelsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; boxes: BoxData[]; labels: LabelData[]; lines: LineDrawingData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { left, right, nPiv, mult, per, fut, lookback, reflect } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const { gt, lt, ge, le, eq } = compare;
  const open = bars.map((b) => b.open);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const close = bars.map((b) => b.close);
  // x[k] on bar i (na before the first bar)
  const at = (arr: number[], i: number, k: number) => (i - k >= 0 ? arr[i - k] : NaN);
  const was = (arr: boolean[], i: number, k: number) => (i - k >= 0 ? arr[i - k] : false);

  const extrap: 'right' | 'none' = cfg.extend ? 'right' : 'none';
  const haSrc = cfg.src === 'HA';
  const hiLoSrc = cfg.src === 'High/Low';
  const tsifast = cfg.strat === 'Fast';

  // ---- Functional declarations: series
  const atr = A(ta.atr(bars, cfg.atrLen));
  // min = math.min(close * 0.02, atr * 0.3): na while the ATR is na
  const minPad = close.map((c, i) => pineMin(c * 0.02, atr[i] * 0.3));

  // _haBody(): Heikin Ashi open / close
  const haClose = bars.map((b) => (b.open + b.high + b.low + b.close) / 4);
  const haOpen: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? haOpen[i - 1] : NaN;
    haOpen[i] = Number.isNaN(prev) ? (open[i] + close[i]) / 2 : (prev + haClose[i - 1]) / 2;
  }

  const shortvar = tsifast ? cfg.shortf : cfg.shorts;
  const longvar = tsifast ? cfg.longf : cfg.longs;
  const signalvar = tsifast ? cfg.signalf : cfg.signals;
  const closeS = S(close);
  const tsiSeries = ta.tsi(closeS, shortvar, longvar);
  const tsi = A(tsiSeries);
  const tsl = A(ta.ema(tsiSeries, signalvar));

  const highestClose = A(ta.highest(closeS, right));
  const lowestClose = A(ta.lowest(closeS, right));
  const closeLows = A(ta.lowest(closeS, cfg.swing));
  const closeHigh = A(ta.highest(closeS, cfg.swing));

  // _count(src, l): number of the bars i = 0..l with src > src[i]
  const count = (arr: number[], i: number, l: number) => {
    let result = 0;
    for (const k of pineRange(0, l)) if (gt(arr[i], at(arr, i, k))) result += 1;
    return result;
  };

  const srcHigh = bars.map((b, i) => (haSrc ? Math.max(haClose[i], haOpen[i]) : hiLoSrc ? b.high : Math.max(b.close, b.open)));
  const srcLow = bars.map((b, i) => (haSrc ? Math.min(haClose[i], haOpen[i]) : hiLoSrc ? b.low : Math.min(b.close, b.open)));
  const pivotHighArr = A(ta.pivothigh(S(srcHigh), left, right));
  const pivotLowArr = A(ta.pivotlow(S(srcLow), left, right));
  // math.min(atr * mult, perc), read `right` bars back for the band
  const bandBase = close.map((c, i) => pineMin(atr[i] * mult, c * (per / 100)));

  // ---- Library BjCandlePatterns: candle measurements
  const topWickSize = bars.map((b) => Math.abs(Math.max(b.close, b.open) - b.high));
  const bottomWickSize = bars.map((b) => Math.abs(Math.min(b.close, b.open) - b.low));
  const bodySize = bars.map((b) => Math.abs(b.close - b.open));
  const bodyHigh = bars.map((b) => Math.max(b.close, b.open));
  const bodyLow = bars.map((b) => Math.min(b.close, b.open));
  const candleSize = bars.map((b) => Math.abs(b.high - b.low));
  const bodyAvg = A(ta.ema(S(bodySize), 14));
  const tallBody = bodySize.map((v, i) => gt(v, bodyAvg[i]));
  const shortBody = bodySize.map((v, i) => lt(v, bodyAvg[i]));
  const bodyPcnt = bodySize.map((v, i) => (v / candleSize[i]) * 100);
  // `5 / 100 * bodySize`: the division of two integer constants is an integer division in Pine v5 (0)
  const shadowFactor = Math.trunc(5 / 100);
  const topShadow = topWickSize.map((v, i) => gt(v, shadowFactor * bodySize[i]));
  const bottomShadow = bottomWickSize.map((v, i) => gt(v, shadowFactor * bodySize[i]));
  const middleBody = bodySize.map((v, i) => v / 2 + bodyLow[i]);
  const bodyIsDoji = bodyPcnt.map((v) => le(v, 5));
  const upCandle = bars.map((b) => gt(b.close, b.open));
  const dwnCandle = bars.map((b) => lt(b.close, b.open));

  // ---- Library BjCandlePatterns: pattern functions (bar i)
  const doji = (i: number) =>
    le(bodyPcnt[i], cfg.dojiSize) && le(topWickSize[i], bottomWickSize[i] * cfg.dojiWickSize) && le(bottomWickSize[i], topWickSize[i] * cfg.dojiWickSize);
  const bullEngulf = (i: number) => {
    const rejectionRule = eq(cfg.rejectWickMax, 0) || lt(topWickSize[i] / bodySize[i], cfg.rejectWickMax / 100);
    return le(at(close, i, 1), at(open, i, 1)) && ge(close[i], at(open, i, 1)) && le(open[i], at(close, i, 1)) && rejectionRule
      && (!cfg.ecWick || ge(close[i], at(high, i, 1))) && gt(bodySize[i], 0);
  };
  const bearEngulf = (i: number) => {
    const rejectionRule = eq(cfg.rejectWickMax, 0) || lt(bottomWickSize[i] / bodySize[i], cfg.rejectWickMax / 100);
    return ge(at(close, i, 1), at(open, i, 1)) && le(close[i], at(open, i, 1)) && ge(open[i], at(close, i, 1)) && rejectionRule
      && (!cfg.ecWick || le(close[i], at(low, i, 1))) && gt(bodySize[i], 0);
  };
  const hammer = (i: number) => {
    const bullRatio = (low[i] - high[i]) * (cfg.hammerFib / 100) + high[i];
    const hasShadow = gt(topWickSize[i], (cfg.hsShadowPerc / 100) * bodySize[i]);
    return gt(bodySize[i], 0) && ge(bodyLow[i], bullRatio) && !hasShadow;
  };
  const star = (i: number) => {
    const bearRatio = (high[i] - low[i]) * (cfg.hammerFib / 100) + low[i];
    const hasShadow = gt(bottomWickSize[i], (cfg.hsShadowPerc / 100) * bodySize[i]);
    return gt(bodySize[i], 0) && le(bodyHigh[i], bearRatio) && !hasShadow;
  };
  // dragonflyDoji() and gravestoneDoji() have the same expression in the library
  const dragonflyDoji = (i: number) => bodyIsDoji[i] && le(topWickSize[i], bodySize[i]);
  const gravestoneDoji = (i: number) => bodyIsDoji[i] && le(topWickSize[i], bodySize[i]);
  const hl2 = (i: number) => (i >= 0 ? (high[i] + low[i]) / 2 : NaN);
  const tweezerBottom = (i: number) => {
    const upperHalf = gt(close[i], hl2(i - 1));
    return (!bodyIsDoji[i] || (topShadow[i] && bottomShadow[i])) && le(Math.abs(low[i] - at(low, i, 1)), bodyAvg[i] * 0.05)
      && was(dwnCandle, i, 1) && upCandle[i] && was(tallBody, i, 1) && (!cfg.closeHalf || (cfg.closeHalf && upperHalf));
  };
  const tweezerTop = (i: number) => {
    const lowerHalf = lt(close[i], hl2(i - 1));
    return (!bodyIsDoji[i] || (topShadow[i] && bottomShadow[i])) && le(Math.abs(high[i] - at(high, i, 1)), bodyAvg[i] * 0.05)
      && was(upCandle, i, 1) && dwnCandle[i] && was(tallBody, i, 1) && (!cfg.closeHalf || (cfg.closeHalf && lowerHalf));
  };
  // spinningTop(wickSize = 34)
  const spinningTop = (i: number) =>
    ge(bottomWickSize[i], (candleSize[i] / 100) * 34) && ge(topWickSize[i], (candleSize[i] / 100) * 34) && !bodyIsDoji[i];
  const piercing = (i: number) =>
    was(dwnCandle, i, 1) && was(tallBody, i, 1) && upCandle[i] && le(open[i], at(low, i, 1)) && gt(close[i], at(middleBody, i, 1))
    && lt(close[i], at(open, i, 1));
  const darkCloudCover = (i: number) =>
    was(upCandle, i, 1) && was(tallBody, i, 1) && dwnCandle[i] && ge(open[i], at(high, i, 1)) && lt(close[i], at(middleBody, i, 1))
    && gt(close[i], at(open, i, 1));
  const haramiBull = (i: number) =>
    was(tallBody, i, 1) && was(dwnCandle, i, 1) && upCandle[i] && shortBody[i] && le(high[i], at(bodyHigh, i, 1)) && ge(low[i], at(bodyLow, i, 1));
  const haramiBear = (i: number) =>
    was(tallBody, i, 1) && was(upCandle, i, 1) && dwnCandle[i] && shortBody[i] && le(high[i], at(bodyHigh, i, 1)) && ge(low[i], at(bodyLow, i, 1));
  const lls = (i: number) => gt(bottomWickSize[i], (candleSize[i] / 100) * cfg.luRatio);
  const lus = (i: number) => gt(topWickSize[i], (candleSize[i] / 100) * cfg.luRatio);

  // ---- Drawing objects
  const boxReg = new Registry<ScriptBox>();
  type ScriptLabel = LabelData & { deleted: boolean };
  const labelReg = new Registry<ScriptLabel>();
  const newBox = (x1: number, top: number, r: number, bottom: number, border: string, bg: string, extend: 'none' | 'right') =>
    boxReg.add({ left: x1, top, right: r, bottom, border, bg, extend, deleted: false });
  const boxTop = (b: ScriptBox | null) => (b && !b.deleted ? b.top : NaN);
  const boxBottom = (b: ScriptBox | null) => (b && !b.deleted ? b.bottom : NaN);
  const alive = (b: ScriptBox | null): b is ScriptBox => b !== null && !b.deleted;

  // var pivotHigh / pivotLows = array.new_box(nPiv), highBull / lowsBull = array.new_bool(nPiv), boxes = array.new_box()
  const pivotHigh: Array<ScriptBox | null> = new Array(nPiv).fill(null);
  const pivotLows: Array<ScriptBox | null> = new Array(nPiv).fill(null);
  const highBull: Array<boolean | null> = new Array(nPiv).fill(null);
  const lowsBull: Array<boolean | null> = new Array(nPiv).fill(null);
  const patternBoxes: ScriptBox[] = [];

  const arrayLoad = (x: Array<boolean | null>, max: number, val: boolean) => {
    x.unshift(val);
    if (x.length > max) x.pop();
  };
  const arrayBox = (x: Array<ScriptBox | null>, max: number, val: ScriptBox) => {
    x.unshift(val);
    if (x.length > max) {
      const b = x.pop() ?? null;
      if (cfg.extend && alive(b)) b.extend = 'none';
    }
  };
  // _align(x, y): the newest box of y takes the top and bottom of a box of x that it overlaps
  const align = (x: Array<ScriptBox | null>, y: Array<ScriptBox | null>) => {
    for (const i of pineRange(0, x.length - 1)) {
      const y0 = get(y, 0);
      const T = boxTop(y0);
      const B = boxBottom(y0);
      const t = boxTop(get(x, i));
      const b = boxBottom(get(x, i));
      if ((gt(T, b) && lt(T, t)) || (lt(B, t) && gt(B, b)) || (gt(T, t) && lt(B, b)) || (gt(B, b) && lt(T, t))) {
        if (alive(y0)) {
          y0.top = t;
          y0.bottom = b;
        }
      }
    }
  };
  // _color(x, y): a zone turns bullish above its top and bearish below its bottom; returns the running count
  const colorZones = (x: Array<ScriptBox | null>, y: Array<boolean | null>, i: number, track: number) => {
    for (const k of pineRange(0, x.length - 1)) {
      const bx = get(x, k);
      const t = boxTop(bx);
      const b = boxBottom(bx);
      const isBull = get(y, k);
      if (gt(close[i], t) && !isBull) {
        if (alive(bx)) bx.extend = 'none';
        x[k] = newBox(i, t, i, b, cfg.bullBorder, cfg.bullBgCol, extrap);
        y[k] = true;
        track += 1;
      }
      if (lt(close[i], b) && isBull) {
        const cur = get(x, k);
        if (alive(cur)) cur.extend = 'none';
        x[k] = newBox(i, t, i, b, cfg.bearBorder, cfg.bearBgCol, extrap);
        y[k] = false;
        track -= 1;
      }
    }
    return track;
  };
  // _detect(x, y): the first zone the bar touches
  const detect = (x: Array<ScriptBox | null>, y: Array<boolean | null>, i: number): [boolean, boolean | null] => {
    let k = 0;
    let found = false;
    let isBull: boolean | null = null;
    while (!found && k < x.length) {
      const bx = get(x, k);
      if (lt(low[i], boxTop(bx)) && gt(high[i], boxBottom(bx))) {
        isBull = get(y, k);
        found = true;
      }
      k += 1;
    }
    return [found, isBull];
  };
  // _falseBreak(l): history of the running count
  const falseBreak = (l: number[], i: number): [boolean, boolean] => {
    let d = false;
    let u = false;
    for (const k of pineRange(1, lookback)) {
      if (at(l, i, k) < l[i] && at(l, i, k + 1) >= l[i] && at(l, i, 1) < l[i]) d = true;
      if (at(l, i, k) > l[i] && at(l, i, k + 1) <= l[i] && at(l, i, 1) > l[i]) u = true;
    }
    return [d, u];
  };
  // _check(src, l): src was true on one of the bars i = 0..l
  const checkAny = (arr: boolean[], i: number, l: number) => {
    let result = false;
    for (const k of pineRange(0, l)) if (was(arr, i, k)) result = true;
    return result;
  };

  const markers: MarkerData[] = [];
  const trackHigh: number[] = new Array(n);
  const trackLows: number[] = new Array(n);
  const isLows: boolean[] = new Array(n);
  const isHigh: boolean[] = new Array(n);
  const resBreakArr: boolean[] = new Array(n);
  const supBreakArr: boolean[] = new Array(n);
  const bullArr: boolean[] = new Array(n);
  const bearArr: boolean[] = new Array(n);
  const sigLowsArr: boolean[] = new Array(n);
  const sigHighArr: boolean[] = new Array(n);
  // var int _track = nPiv of each _color call
  let trackHighVar = nPiv;
  let trackLowsVar = nPiv;

  const truthy = (v: number) => !Number.isNaN(v) && v !== 0;
  const patternLabel = (i: number, text: string, bull: boolean, labelColor: string, textColor: string, tooltip: string) => {
    // label.new(bar_index, na, text, yloc = yloc.belowbar / yloc.abovebar, color = labelColor,
    //   style = label.style_label_up / label.style_label_down, textcolor = textColor, tooltip = ...)
    labelReg.add({
      deleted: false, time: bars[i].time, price: NaN, text, color: labelColor, textColor,
      style: bull ? 'label_up' : 'label_down', yloc: bull ? 'belowbar' : 'abovebar', tooltip,
    });
  };

  for (let i = 0; i < n; i++) {
    const band = at(bandBase, i, right) / 2;
    const HH = pivotHighArr[i] + band;
    const HL = pivotHighArr[i] - band;
    const LH = pivotLowArr[i] + band;
    const LL = pivotLowArr[i] - band;

    // ---- Logical order (every bar of the port is confirmed)
    if (truthy(pivotHighArr[i]) && cfg.dhighs) {
      arrayLoad(highBull, nPiv, false);
      arrayBox(pivotHigh, nPiv, newBox(i - right, HH, i, HL, cfg.bearBorder, cfg.bearBgCol, extrap));
    }
    if (truthy(pivotLowArr[i]) && cfg.dlows) {
      arrayLoad(lowsBull, nPiv, true);
      arrayBox(pivotLows, nPiv, newBox(i - right, LH, i, LL, cfg.bullBorder, cfg.bullBgCol, extrap));
    }
    if (cfg.alignZones) {
      align(pivotHigh, pivotHigh);
      align(pivotHigh, pivotLows);
      align(pivotLows, pivotLows);
      align(pivotLows, pivotHigh);
    }
    // _extend: the tracked boxes end on the current bar
    for (const k of pineRange(0, pivotHigh.length - 1)) {
      const b = get(pivotHigh, k);
      if (alive(b)) b.right = i;
    }
    for (const k of pineRange(0, pivotLows.length - 1)) {
      const b = get(pivotLows, k);
      if (alive(b)) b.right = i;
    }
    trackHighVar = colorZones(pivotHigh, highBull, i, trackHighVar);
    trackLowsVar = colorZones(pivotLows, lowsBull, i, trackLowsVar);
    trackHigh[i] = trackHighVar;
    trackLows[i] = trackLowsVar;

    // ---- Conditional parameters
    isLows[i] = eq(closeLows[i], close[i]);
    isHigh[i] = eq(closeHigh[i], close[i]);
    const wasLows = checkAny(isLows, i, lookback);
    const wasHigh = checkAny(isHigh, i, lookback);

    // _numLevel(highBull, lowsBull)
    let above = 0;
    let total = 0;
    for (const arr of [highBull, lowsBull]) {
      for (const k of pineRange(0, arr.length - 1)) {
        const isBull = get(arr, k);
        if (isBull) above += 1;
        if (isBull !== null) total += 1;
      }
    }

    const moveAbove = trackHigh[i] > at(trackHigh, i, 1);
    const moveBelow = trackLows[i] < at(trackLows, i, 1);
    const resBreak = trackLows[i] > at(trackLows, i, 1) || moveAbove;
    const supBreak = trackHigh[i] < at(trackHigh, i, 1) || moveBelow;
    resBreakArr[i] = resBreak;
    supBreakArr[i] = supBreak;

    const breakOut = moveAbove && eq(close[i], highestClose[i]) && above === total;
    const breakDwn = moveBelow && eq(close[i], lowestClose[i]) && above === 0;

    const [dh, uh] = falseBreak(trackHigh, i);
    const [dl, ul] = falseBreak(trackLows, i);
    const falseBreakBull = wasLows && (dh || dl);
    const falseBreakBear = wasHigh && (uh || ul);

    const [fh, hb] = detect(pivotHigh, highBull, i);
    const [fl, lb] = detect(pivotLows, lowsBull, i);
    // an na bool is false in a condition
    const anyBull = hb === true || lb === true;
    const bull = (fh || fl) && anyBull;
    const bear = (fh || fl) && !anyBull;
    bullArr[i] = bull;
    bearArr[i] = bear;

    const bullCheck = !resBreak && !was(resBreakArr, i, 1) && (fh || fl) && gt(close[i], open[i]) && anyBull;
    const bearCheck = !supBreak && !was(supBreakArr, i, 1) && (fh || fl) && lt(close[i], open[i]) && !anyBull;

    const highrange = reflect - cfg.offset;
    const lowsrange = cfg.offset;
    const sigLows = count(low, i, reflect) <= lowsrange;
    const sigHigh = count(high, i, reflect) >= highrange;
    sigLowsArr[i] = sigLows;
    sigHighArr[i] = sigHigh;

    const isBull1 = sigLows && bull;
    const isBear1 = sigHigh && bear;
    const isBull2 = (sigLows || was(sigLowsArr, i, 1)) && (bull || was(bullArr, i, 1));
    const isBear2 = (sigHigh || was(sigHighArr, i, 1)) && (bear || was(bearArr, i, 1));

    const data = gt(tsi[i], at(tsi, i, 1)) && lt(tsi[i], tsl[i]);
    const dtat = lt(tsi[i], at(tsi, i, 1)) && gt(tsi[i], tsl[i]);

    const hMatch = !cfg.colorMatch || gt(close[i], open[i]);
    const sMatch = !cfg.colorMatch || lt(close[i], open[i]);
    const hsFilter = ge(candleSize[i], cfg.hammerSize * atr[i]);
    const atrMaxSize = le(candleSize[i], cfg.atrMax * atr[i]) || eq(cfg.atrMax, 0);

    // ---- Pattern recognition
    const dw = isBull1 && cfg.detectDoji && atrMaxSize && doji(i);
    const db = isBear1 && cfg.detectDoji && atrMaxSize && doji(i);
    const bew = isBull2 && cfg.detectEngulfing && atrMaxSize && bullEngulf(i);
    const beb = isBear2 && cfg.detectEngulfing && atrMaxSize && bearEngulf(i);
    const h = isBull1 && cfg.detectHammerStar && atrMaxSize && hammer(i) && hsFilter && hMatch;
    const ss = isBear1 && cfg.detectHammerStar && atrMaxSize && star(i) && hsFilter && sMatch;
    const dd = isBull1 && cfg.detectDragonGrave && atrMaxSize && dragonflyDoji(i);
    const gd = isBear1 && cfg.detectDragonGrave && atrMaxSize && gravestoneDoji(i);
    const tb = isBull2 && cfg.detectTweezers && atrMaxSize && tweezerBottom(i);
    const tt = isBear2 && cfg.detectTweezers && atrMaxSize && tweezerTop(i);
    const stw = isBull1 && cfg.detectSpinningTop && atrMaxSize && spinningTop(i);
    const stb = isBear1 && cfg.detectSpinningTop && atrMaxSize && spinningTop(i);
    const p = isBull1 && cfg.detectPiercingCloud && atrMaxSize && piercing(i);
    const dcc = isBear1 && cfg.detectPiercingCloud && atrMaxSize && darkCloudCover(i);
    const bhw = isBull1 && cfg.detectHarami && atrMaxSize && haramiBull(i);
    const bhb = isBear1 && cfg.detectHarami && atrMaxSize && haramiBear(i);
    const ll = isBull1 && cfg.detectLongShadows && atrMaxSize && lls(i) && hsFilter;
    const lu = isBear1 && cfg.detectLongShadows && atrMaxSize && lus(i) && hsFilter;

    // ---- Graphical display
    const plotFalseDn = cfg.falseBull && falseBreakBull;
    const plotFalseUp = cfg.falseBear && falseBreakBear;
    const plotBreakOut = breakOut && cfg.detectBO && !plotFalseDn;
    const plotBreakDn = breakDwn && cfg.detectBD && !plotFalseUp;
    const plotResBreak = resBreak && cfg.breakUp && !(plotBreakOut || plotFalseDn);
    const plotSupBreak = supBreak && cfg.breakDn && !(plotBreakDn || plotFalseUp);
    const plotBullCheck = bullCheck && cfg.supPush;
    const plotBearCheck = bearCheck && cfg.resPush;
    const plotCurlBull = cfg.curl && data && bull;
    const plotCurlBear = cfg.curl && dtat && bear;

    const time = bars[i].time;
    // plotarrow(plotFalseUp ? coDiff : na, colorup = fBull, colordown = fBear, maxheight = arrowMax), and the same
    // with plotFalseDn: an up arrow below the bar for a positive value, a down arrow above the bar for a negative one
    const coDiff = close[i] - open[i];
    for (const on of [plotFalseUp, plotFalseDn]) {
      if (!on) continue;
      if (coDiff > 0) markers.push({ time, position: 'belowBar', shape: 'arrowUp', color: cfg.fBull });
      else if (coDiff < 0) markers.push({ time, position: 'aboveBar', shape: 'arrowDown', color: cfg.fBear });
    }
    if (plotBreakOut) markers.push({ time, position: 'belowBar', shape: 'arrowUp', color: cfg.upCol, size: 'small' });
    if (plotBreakDn) markers.push({ time, position: 'aboveBar', shape: 'arrowDown', color: cfg.dnCol, size: 'small' });
    if (plotResBreak) markers.push({ time, position: 'belowBar', shape: 'arrowUp', color: cfg.supCol, size: 'small' });
    if (plotSupBreak) markers.push({ time, position: 'aboveBar', shape: 'arrowDown', color: cfg.resCol, size: 'small' });
    if (plotBullCheck) markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.moveBullCol });
    if (plotBearCheck) markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.moveBearCol });
    if (plotCurlBull) markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.curlBullCol });
    if (plotCurlBear) markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.curlBearCol });

    // Pattern labels (library) and boxes: _wrap(cond, boxes, barsBack, borderColor, bgColor)
    const wrap = (cond: boolean, bb: number, bc: string, bgc: string) => {
      if (!cond) return;
      let hi = -Infinity;
      let lo = Infinity;
      for (let k = 0; k < bb; k++) {
        hi = Math.max(hi, at(high, i, k));
        lo = Math.min(lo, at(low, i, k));
      }
      // _arrayWrap(boxes, max, box): at most `max` pattern boxes, the oldest is deleted
      patternBoxes.unshift(newBox(i - bb, hi + minPad[i], i + 1, lo - minPad[i], bc, bgc, 'none'));
      if (patternBoxes.length > cfg.maxBoxes) boxReg.delete(patternBoxes.pop() ?? null);
    };
    const show = (cond: boolean, text: string, isBullLabel: boolean, labelColor: string, textColor: string, tip: string) => {
      if (cond && cfg.labels) patternLabel(i, text, isBullLabel, labelColor, textColor, tip);
    };
    const { labBullCol, labNeutCol, labBearCol, textBullCol, textNeutCol, textBearCol } = cfg;
    const { patBullBo, patNeutBo, patBearBo, patBullBg, patNeutBg, patBearBg, sBox } = cfg;
    show(dw, 'D', true, labNeutCol, textNeutCol, TIP.doji);
    wrap(dw && sBox, 1, patNeutBo, patNeutBg);
    show(bew, 'BE', true, labBullCol, textBullCol, TIP.bullEngulf);
    wrap(bew && sBox, 2, patBullBo, patBullBg);
    show(h, 'H', true, labBullCol, textBullCol, TIP.hammer);
    wrap(h && sBox, 1, patBullBo, patBullBg);
    show(dd, 'DD', true, labBullCol, textBullCol, TIP.dragonfly);
    wrap(dd && sBox, 1, patBullBo, patBullBg);
    show(tb, 'TB', true, labBullCol, textBullCol, TIP.tweezerBottom);
    wrap(tb && sBox, 2, patBullBo, patBullBg);
    show(stw, 'STW', true, labNeutCol, textNeutCol, TIP.spinningBull);
    wrap(stw && sBox, 1, patBullBo, patNeutBg);
    show(p, 'P', true, labBullCol, textBullCol, TIP.piercing);
    wrap(p && sBox, 2, patBullBo, patBullBg);
    show(bhw, 'HW', true, labBullCol, textBullCol, TIP.haramiBull);
    wrap(bhw && sBox, 2, patBullBo, patBullBg);
    show(ll, 'LLS', true, labBullCol, textBullCol, TIP.lls);
    wrap(ll && sBox, 1, patBullBo, patBullBg);

    show(db, 'D', true, labNeutCol, textNeutCol, TIP.doji);
    wrap(db && sBox, 1, patNeutBo, patNeutBg);
    show(beb, 'BE', false, labBearCol, textBearCol, TIP.bearEngulf);
    wrap(beb && sBox, 2, patBearBo, patBearBg);
    show(ss, 'SS', false, labBearCol, textBearCol, TIP.star);
    wrap(ss && sBox, 1, patBearBo, patBearBg);
    show(gd, 'GD', false, labBearCol, textBearCol, TIP.gravestone);
    wrap(gd && sBox, 1, patBearBo, patBearBg);
    show(tt, 'TT', false, labBearCol, textBearCol, TIP.tweezerTop);
    wrap(tt && sBox, 2, patBearBo, patBearBg);
    // stbLab of the library: a label below the bar
    show(stb, 'STB', true, labNeutCol, textNeutCol, TIP.spinningBear);
    wrap(stb && sBox, 1, patBearBo, patBearBg);
    show(dcc, 'DCC', false, labBearCol, textBearCol, TIP.darkCloud);
    wrap(dcc && sBox, 2, patBearBo, patBearBg);
    show(bhb, 'HB', false, labBearCol, textBearCol, TIP.haramiBear);
    wrap(bhb && sBox, 2, patBearBo, patBearBg);
    show(lu, 'LUS', false, labBearCol, textBearCol, TIP.lus);
    wrap(lu && sBox, 1, patBearBo, patBearBg);
  }

  // ---- _level(): price labels and lines of the tracked zones, on the last bar
  const lines: LineDrawingData[] = [];
  if (n > 0 && cfg.lLab) {
    const last = n - 1;
    const levelLabel = (y: number, style: 'label_up' | 'label_down', col1: string, col2: string) => {
      const transp = Math.min(color.t(col1), color.t(col2));
      const c = String(color.new(col1, transp));
      // label.new(sync + fut, y, text = str.tostring(math.round_to_mintick(y)), color = color.new(_col1, transp),
      //   style = _s, textcolor = color.white)
      labelReg.add({
        deleted: false, time: barTime(bars, last + fut), price: y,
        text: str.tostring(math.round_to_mintick(y, MINTICK) as number), color: c, style, textColor: String(color.white),
      });
      if (!cfg.extend && fut > 0) {
        lines.push({ time1: bars[last].time, price1: y, time2: barTime(bars, last + fut), price2: y, color: c });
      }
    };
    for (const [x, y] of [[pivotHigh, highBull], [pivotLows, lowsBull]] as const) {
      for (const k of pineRange(0, x.length - 1)) {
        const t = boxTop(get(x, k));
        const b = boxBottom(get(x, k));
        const isBull = get(y, k);
        const col1 = isBull ? cfg.bullBgCol : cfg.bearBgCol;
        const col2 = isBull ? cfg.bullBorder : cfg.bearBorder;
        const c = close[last];
        if (gt(c, t)) levelLabel(t, 'label_up', col1, col2);
        if (lt(c, b)) levelLabel(b, 'label_down', col1, col2);
        if (lt(c, t) && gt(c, b)) {
          levelLabel(t, 'label_down', col1, col2);
          levelLabel(b, 'label_up', col1, col2);
        }
      }
    }
  }

  // Labels alive after the last bar; a label on a bar before the first bar is not drawn
  const labels: LabelData[] = [];
  for (const l of labelReg.live) {
    const { deleted: _deleted, ...data } = l;
    if (Number.isFinite(data.time)) labels.push(data);
  }

  // Boxes alive after the last bar; a box with an na coordinate is not drawn
  const boxes: BoxData[] = [];
  for (const b of boxReg.live) {
    if (![b.left, b.top, b.right, b.bottom].every(Number.isFinite) || b.left < 0) continue;
    const box: BoxData = {
      time1: barTime(bars, b.left), price1: b.top, time2: barTime(bars, b.right), price2: b.bottom,
      bgColor: b.bg, borderColor: b.border,
    };
    if (b.extend !== 'none') box.extend = b.extend;
    boxes.push(box);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    boxes,
    labels,
    lines,
  };
}

export const BjorgumKeyLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
