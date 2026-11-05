/**
 * Ichimoku Kinko Hyo (一目均衡表) [RickSimpson]
 *
 * An Ichimoku with adaptive lengths, signals, support / resistance zones and the three Hosoda theories.
 * - Source: the chosen source or an OHLC formula (or a Heikin-Ashi pick of high / low), smoothed by a 4-bar SWMA.
 * - Adaptive lengths: each line (Tenkan, Kijun, Senkou B, Chikou) has a length between its minimum and maximum. On
 *   each bar it shrinks by the smoothing % when all its enabled filters confirm (volume oscillator above the
 *   threshold, fast ATR above slow ATR, Chikou breakout above the high of the filter period), else it grows by the
 *   same ratio. A preset (Classic, 5D, Crypto, Slow) uses fixed lengths instead.
 * - Lines: Tenkan and Kijun are the middle of the highest high and lowest low of their length (blended with a shorter
 *   length when the reactivity divider is above 1); Senkou A is their mean, Senkou B the middle of its own length;
 *   both are drawn "Senkou Span Offset - 1" bars ahead, with a Kumo fill coloured by direction (gradient on the RSI
 *   of the Kumo middle). The Chikou is the source drawn back: as a plot (fixed offset) or as lines (adaptive offset,
 *   the last 468 segments kept with the default options).
 * - Signals: a triangle when all enabled filters turn bullish or bearish after the warm-up (with a flat market
 *   filter); each signal flips the regime and starts a support / resistance zone (line or box, labels, pruned by
 *   distance in ATR and by the maximum count).
 * - Optional: TK-Range boxes (close between Tenkan and Kijun), swing points, waves (I, V, N, P, Y, W), price targets
 *   from the N wave, Kihon Suchi and Taito Suchi time projections, time x price confluence boxes and diamonds.
 * - Bar colours by mode, TK / KJ price labels on the last bar and a panel (table) with five scores and a consensus.
 *
 * Chart context (optional third argument): `chart.mintick` (label prices, TK-Range tolerance, Kumo thickness floor,
 * TK = KJ test; fallback 0.01) and `chart.foregroundColor` (label, box and panel texts; fallback the dark theme
 * colour).
 *
 * Alerts: the original's 22 alert conditions (signals, S/R zone flip / retest / breaks / median crossing, TK-Range
 * breakouts and median crossing, swings, waves, price targets reached, Kihon / Taito time windows, time x price
 * confluence, panel consensus change), each computed per bar as the original does.
 *
 * Limits of the port: the Chikou line width and the S/R line width come from inputs: the plot
 * width of the fixed Chikou plot is the default 1.
 *
 * Reference: "Ichimoku Kinko Hyo (一目均衡表)" by RickSimpson
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RickSimpson — Ichimoku Kinko Hyo (一目均衡表). Based on the work of Goichi Hosoda (細田悟一), 1935
 */

import {
  taCore as ta, math, str, color, line, box, label, table, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  barInterval, barTime,
  type Box, type Label, type Line, type Table, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { foregroundColorOf, mintickOf, type ChartContext } from '../chart-context';

type SourceName = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'hlcc4' | 'ohlc4' | 'volume';

const G = ['SOURCE', 'ICHIMOKU CORE (一目均衡表)', 'ADAPTIVE LENGTHS', 'VOLUME ANALYSIS', 'VOLATILITY (ATR)', 'SIGNAL FILTERS', 'SUPPORT & RESISTANCE', 'TK-RANGE (転換・基準)', 'HOSODA THEORIES — SWING DETECTION (スイング)', 'HOSODA THEORIES — WAVE THEORY (波動論)', 'HOSODA THEORIES — PRICE THEORY (値幅観測論)', 'HOSODA THEORIES — TIME THEORY (時間論)', 'HOSODA THEORIES — TIME x PRICE CONFLUENCE (時間・値幅合流)', 'BAR COLORS', 'PANEL', 'PANEL COLORS'];

export interface IchimokuKinkHyInputs {
  srcPrice: SourceName;
  altSourceFormula: 'Default Source' | '(open + close +3 * (high + low)) / 8' | 'close + high + low -2 * open' | '(close +5 * (high + low) -7 * (open)) / 4' | '(open + close +5 * (high + low)) / 12' | '(close > open ? high : low)' | 'Heiken-Ashi';
  wmaSmoothing: boolean;
  preset: 'Classic 9/26/52/26' | '5D 8/22/44/22' | 'Crypto 10/30/60/30' | 'Slow 20/60/120/60' | 'Custom (Adaptive Lengths)';
  presetPanelOnly: boolean;
  lineDivider: number;
  showTenkan: boolean;
  tenkanColor: string;
  showKijun: boolean;
  kijunColor: string;
  showPriceLabels: boolean;
  tkkjLabelBullColor: string;
  tkkjLabelBearColor: string;
  tkkjLabelNeutralColor: string;
  showChikou: boolean;
  chikouMode: 'Fixed' | 'Adaptive';
  chikouBullColor: string;
  chikouBearColor: string;
  chikouNeutralColor: string;
  chikouLinewidth: number;
  showSenkouA: boolean;
  showSenkouB: boolean;
  kumoBullColor: string;
  kumoBearColor: string;
  kumoNeutralColor: string;
  kumoFillEnabled: boolean;
  kumoFillTransparency: number;
  kumoFillStyle: 'Solid' | 'Gradient';
  showSignals: boolean;
  bullEventColor: string;
  bearEventColor: string;
  tkMinLength: number;
  tkMaxLength: number;
  tkDynPct: number;
  tkVolFilter: boolean;
  tkAtrFilter: boolean;
  tkChikouFilter: boolean;
  kjMinLength: number;
  kjMaxLength: number;
  kjDynPct: number;
  kjVolFilter: boolean;
  kjAtrFilter: boolean;
  kjChikouFilter: boolean;
  chMinLength: number;
  chMaxLength: number;
  chDynPct: number;
  chFilterPeriod: number;
  chVolFilter: boolean;
  chAtrFilter: boolean;
  chTrendFilter: boolean;
  skMinLength: number;
  skMaxLength: number;
  skDynPct: number;
  skOffsetLength: number;
  skVolFilter: boolean;
  skAtrFilter: boolean;
  skChikouFilter: boolean;
  volOscType: 'TFS Volume Oscillator' | 'On Balance Volume' | 'Klinger Volume Oscillator' | 'Cumulative Volume Oscillator' | 'Volume Zone Oscillator';
  volOscTypeTk: 'TFS Volume Oscillator' | 'On Balance Volume' | 'Klinger Volume Oscillator' | 'Cumulative Volume Oscillator' | 'Volume Zone Oscillator';
  volOscTypeKj: 'TFS Volume Oscillator' | 'On Balance Volume' | 'Klinger Volume Oscillator' | 'Cumulative Volume Oscillator' | 'Volume Zone Oscillator';
  volOscTypeSk: 'TFS Volume Oscillator' | 'On Balance Volume' | 'Klinger Volume Oscillator' | 'Cumulative Volume Oscillator' | 'Volume Zone Oscillator';
  volOscTypeCh: 'TFS Volume Oscillator' | 'On Balance Volume' | 'Klinger Volume Oscillator' | 'Cumulative Volume Oscillator' | 'Volume Zone Oscillator';
  volPeakThreshold: number;
  volFastLength: number;
  volSlowLength: number;
  volZoneLength: number;
  volRatioType: 'On Balance Volume' | 'Cumulative Volume Delta' | 'Price Volume Trend';
  volRatioLength: number;
  volEmaLength1: number;
  volEmaLength2: number;
  atrFastLength: number;
  atrSlowLength: number;
  filterVolume: boolean;
  filterTkKjCross: boolean;
  filterAtrVolatility: boolean;
  filterChikouVsPrice: boolean;
  filterMomentum: boolean;
  filterPriceVsKumo: boolean;
  filterPriceVsTenkan: boolean;
  filterChikouTrend: boolean;
  filterConsolidation: boolean;
  srEnabled: boolean;
  srZoneLayout: 'Line' | 'Zone';
  srZonePlacement: 'Wick' | 'Body' | 'Median';
  srMaxZones: number;
  srZoneWidth: number;
  srExtend: boolean;
  srFlipEnabled: boolean;
  srShowLabels: boolean;
  srLabelSize: 'Tiny' | 'Small' | 'Normal';
  tkrEnabled: boolean;
  tkrColor: string;
  tkrMinBars: number;
  tkrShowMedian: boolean;
  tkrExtend: boolean;
  tkrShowLabel: boolean;
  tkrMaxHistory: number;
  swingEnabled: boolean;
  swingLength: number;
  swingShowHl: boolean;
  swingMaxStored: number;
  waveEnabled: boolean;
  waveShowI: boolean;
  waveColorI: string;
  waveShowV: boolean;
  waveColorV: string;
  waveShowN: boolean;
  waveColorN: string;
  waveShowP: boolean;
  waveColorP: string;
  waveShowY: boolean;
  waveColorY: string;
  waveShowW: boolean;
  waveColorW: string;
  waveMaxDisplay: number;
  waveOverlap: boolean;
  priceTEnabled: boolean;
  priceTShowV: boolean;
  priceTColorV: string;
  priceTShowN: boolean;
  priceTColorN: string;
  priceTShowE: boolean;
  priceTColorE: string;
  priceTShowNT: boolean;
  priceTColorNT: string;
  priceTShow2E: boolean;
  priceTColor2E: string;
  priceTShow3E: boolean;
  priceTColor3E: string;
  priceTValidate: boolean;
  priceTDeveloping: boolean;
  kihonEnabled: boolean;
  kihonAnchor: 'Signals (▲▼)' | 'Tenkan Cross' | 'Kijun Cross' | 'TK x KJ Cross' | 'Kumo Change' | 'Swing Highs' | 'Swing Lows' | 'Swings (H+L)' | 'Wave Completion';
  kihonRange: 'Basic (9/17/26)' | 'Extended (+33/42/51)' | 'Full (+65→257)';
  kihonHistory: number;
  kihonColor: string;
  taitoEnabled: boolean;
  taitoCount: number;
  taitoHarmonics: number;
  taitoColor: string;
  txpEnabled: boolean;
  txpShowForecast: boolean;
  txpKumoEnhance: boolean;
  txpTolerance: number;
  txpColor: string;
  txpKumoColor: string;
  barcolorMode: 'Disabled' | 'Price vs TK/KJ' | 'Price vs Kumo' | 'Confluence Strength' | 'Current Regime' | 'Kumo Future Bias';
  barBullColor: string;
  barBearColor: string;
  barNeutralColor: string;
  panelEnabled: boolean;
  panelLiteMode: boolean;
  panelPosition: 'Top Right' | 'Bottom Right' | 'Top Left' | 'Bottom Left';
  panelTextSize: 'Tiny' | 'Small' | 'Normal' | 'Large';
  panelHeaderColor: string;
  panelBgColor: string;
  panelShowTkCross: boolean;
  panelShowKijun: boolean;
  panelShowChikouConfirm: boolean;
  panelShowPriceKumo: boolean;
  panelShowKumoTwist: boolean;
  panelShowDetails: boolean;
  panelColorStrongBull: string;
  panelColorWeakBull: string;
  panelColorStrongBear: string;
  panelColorWeakBear: string;
  panelColorEquilibrium: string;
  panelColorNeutral: string;
}

export const defaultInputs: IchimokuKinkHyInputs = {
  srcPrice: 'close',
  altSourceFormula: 'Default Source',
  wmaSmoothing: true,
  preset: 'Custom (Adaptive Lengths)',
  presetPanelOnly: false,
  lineDivider: 1,
  showTenkan: true,
  tenkanColor: 'rgba(0,127,255,1)',
  showKijun: true,
  kijunColor: 'rgba(229,57,53,1)',
  showPriceLabels: true,
  tkkjLabelBullColor: 'rgba(38,166,154,0.3)',
  tkkjLabelBearColor: 'rgba(239,83,80,0.3)',
  tkkjLabelNeutralColor: 'rgba(255,152,0,0.3)',
  showChikou: true,
  chikouMode: 'Adaptive',
  chikouBullColor: 'rgba(38,166,154,1)',
  chikouBearColor: 'rgba(239,83,80,1)',
  chikouNeutralColor: 'rgba(255,152,0,1)',
  chikouLinewidth: 1,
  showSenkouA: true,
  showSenkouB: true,
  kumoBullColor: 'rgba(38,166,154,1)',
  kumoBearColor: 'rgba(239,83,80,1)',
  kumoNeutralColor: 'rgba(176,190,197,1)',
  kumoFillEnabled: true,
  kumoFillTransparency: 75,
  kumoFillStyle: 'Gradient',
  showSignals: true,
  bullEventColor: 'rgba(38,166,154,1)',
  bearEventColor: 'rgba(239,83,80,1)',
  tkMinLength: 9,
  tkMaxLength: 30,
  tkDynPct: 96.85,
  tkVolFilter: true,
  tkAtrFilter: true,
  tkChikouFilter: true,
  kjMinLength: 20,
  kjMaxLength: 60,
  kjDynPct: 96.85,
  kjVolFilter: true,
  kjAtrFilter: true,
  kjChikouFilter: true,
  chMinLength: 26,
  chMaxLength: 50,
  chDynPct: 96.85,
  chFilterPeriod: 25,
  chVolFilter: true,
  chAtrFilter: true,
  chTrendFilter: true,
  skMinLength: 50,
  skMaxLength: 120,
  skDynPct: 96.85,
  skOffsetLength: 26,
  skVolFilter: true,
  skAtrFilter: true,
  skChikouFilter: true,
  volOscType: 'On Balance Volume',
  volOscTypeTk: 'On Balance Volume',
  volOscTypeKj: 'On Balance Volume',
  volOscTypeSk: 'On Balance Volume',
  volOscTypeCh: 'On Balance Volume',
  volPeakThreshold: 50,
  volFastLength: 34,
  volSlowLength: 55,
  volZoneLength: 21,
  volRatioType: 'Price Volume Trend',
  volRatioLength: 14,
  volEmaLength1: 8,
  volEmaLength2: 21,
  atrFastLength: 14,
  atrSlowLength: 46,
  filterVolume: true,
  filterTkKjCross: true,
  filterAtrVolatility: true,
  filterChikouVsPrice: true,
  filterMomentum: true,
  filterPriceVsKumo: true,
  filterPriceVsTenkan: true,
  filterChikouTrend: true,
  filterConsolidation: true,
  srEnabled: true,
  srZoneLayout: 'Line',
  srZonePlacement: 'Wick',
  srMaxZones: 12,
  srZoneWidth: 1,
  srExtend: true,
  srFlipEnabled: false,
  srShowLabels: true,
  srLabelSize: 'Small',
  tkrEnabled: false,
  tkrColor: 'rgba(255,179,0,0.15)',
  tkrMinBars: 3,
  tkrShowMedian: true,
  tkrExtend: true,
  tkrShowLabel: true,
  tkrMaxHistory: 5,
  swingEnabled: false,
  swingLength: 10,
  swingShowHl: true,
  swingMaxStored: 50,
  waveEnabled: false,
  waveShowI: true,
  waveColorI: 'rgba(233,30,99,1)',
  waveShowV: true,
  waveColorV: 'rgba(249,168,37,1)',
  waveShowN: true,
  waveColorN: 'rgba(74,138,212,1)',
  waveShowP: true,
  waveColorP: 'rgba(0,151,167,1)',
  waveShowY: true,
  waveColorY: 'rgba(255,93,0,1)',
  waveShowW: true,
  waveColorW: 'rgba(0,200,83,1)',
  waveMaxDisplay: 8,
  waveOverlap: false,
  priceTEnabled: false,
  priceTShowV: true,
  priceTColorV: 'rgba(255,171,0,0.8)',
  priceTShowN: true,
  priceTColorN: 'rgba(66,165,245,0.8)',
  priceTShowE: true,
  priceTColorE: 'rgba(236,64,122,0.8)',
  priceTShowNT: true,
  priceTColorNT: 'rgba(102,187,106,0.8)',
  priceTShow2E: false,
  priceTColor2E: 'rgba(255,112,67,0.8)',
  priceTShow3E: false,
  priceTColor3E: 'rgba(171,71,188,0.8)',
  priceTValidate: true,
  priceTDeveloping: true,
  kihonEnabled: false,
  kihonAnchor: 'Signals (▲▼)',
  kihonRange: 'Basic (9/17/26)',
  kihonHistory: 1,
  kihonColor: 'rgba(120,123,134,1)',
  taitoEnabled: false,
  taitoCount: 3,
  taitoHarmonics: 1,
  taitoColor: 'rgba(171,71,188,1)',
  txpEnabled: false,
  txpShowForecast: true,
  txpKumoEnhance: true,
  txpTolerance: 0.5,
  txpColor: '#78909C',
  txpKumoColor: '#546E7A',
  barcolorMode: 'Price vs TK/KJ',
  barBullColor: 'rgba(46,125,50,1)',
  barBearColor: 'rgba(198,40,40,1)',
  barNeutralColor: 'rgba(120,144,156,1)',
  panelEnabled: true,
  panelLiteMode: false,
  panelPosition: 'Bottom Right',
  panelTextSize: 'Small',
  panelHeaderColor: 'rgba(0,0,0,0.8)',
  panelBgColor: 'rgba(105,105,105,0.2)',
  panelShowTkCross: true,
  panelShowKijun: true,
  panelShowChikouConfirm: true,
  panelShowPriceKumo: true,
  panelShowKumoTwist: true,
  panelShowDetails: true,
  panelColorStrongBull: 'rgba(0,137,123,1)',
  panelColorWeakBull: 'rgba(38,166,154,1)',
  panelColorStrongBear: 'rgba(229,57,53,1)',
  panelColorWeakBear: 'rgba(239,83,80,1)',
  panelColorEquilibrium: 'rgba(245,124,0,1)',
  panelColorNeutral: 'rgba(158,158,158,1)',
};

export const inputConfig: InputConfig[] = [
  { id: 'srcPrice', type: 'source', title: 'Source', defval: 'close', group: G[0], tooltip: 'Primary price source used for all Ichimoku calculations.\nDefault: Close. Other options (HL2, HLC3, etc.) can smooth signals but may reduce responsiveness.' },
  { id: 'altSourceFormula', type: 'string', title: 'Alternative Source', defval: 'Default Source', options: ['Default Source', '(open + close +3 * (high + low)) / 8', 'close + high + low -2 * open', '(close +5 * (high + low) -7 * (open)) / 4', '(open + close +5 * (high + low)) / 12', '(close > open ? high : low)', 'Heiken-Ashi'], group: G[0], tooltip: 'Alternative price formulas for Ichimoku calculations.\n• Default Source: Uses the Source selected above\n• Other options: Custom weighted formulas combining OHLC values for smoother or more reactive signals\n• Heiken-Ashi: Smoothed candle-based calculation\nAdvanced users may experiment with different formulas to reduce noise.' },
  { id: 'wmaSmoothing', type: 'bool', title: 'SWMA Smoothing', defval: true, group: G[0], tooltip: 'Applies a Symmetrically Weighted Moving Average to the price source before Ichimoku calculations.\nSWMA uses balanced weights across 4 bars, giving more importance to the two middle bars. This produces cleaner signals with less noise, at the cost of slightly more lag.' },
  { id: 'preset', type: 'string', title: 'Preset', defval: 'Custom (Adaptive Lengths)', options: ['Classic 9/26/52/26', '5D 8/22/44/22', 'Crypto 10/30/60/30', 'Slow 20/60/120/60', 'Custom (Adaptive Lengths)'], group: G[1], tooltip: 'Classic/5D/Crypto/Slow use standard Ichimoku presets.\nCustom (Adaptive Lengths) uses your dynamic bounds & offset.\nIn Custom mode, each Ichimoku line (Tenkan, Kijun, Senkou, Chikou) has its own independent adaptive length engine based on its filters.' },
  { id: 'presetPanelOnly', type: 'bool', title: 'Preset → Panel Only', defval: false, group: G[1], tooltip: 'When enabled, preset (Classic/5D/Crypto/Slow) applies ONLY to the Panel calculations.\n• Disabled (default): Preset applies to both Chart and Panel\n• Enabled: Chart uses Custom adaptive lengths, Panel uses preset lengths\nUseful for comparing custom adaptive setup against standard Ichimoku consensus.' },
  { id: 'lineDivider', type: 'int', title: 'Reactivity Divider', defval: 1, min: 1, max: 4, group: G[1], tooltip: 'Global fine-tuning tool that affects both Tenkan-Sen and Kijun-Sen calculations.\nDivides each line\'s length to create a shorter reactive sub-component, then blends both averages.\n• 1 = Standard (default, no sub-component effect)\n• 2 = 2x more reactive\n• 3-4 = Very reactive (experimental)\nApplies to both chart lines and panel consensus calculations.' },
  { id: 'showTenkan', type: 'bool', title: 'Tenkan-Sen', defval: true, group: G[1], inline: 'tenkan', tooltip: 'Tenkan-Sen = Toggle visibility of the Tenkan-Sen (Conversion Line).\nColor = Line color on chart.' },
  { id: 'tenkanColor', type: 'color', title: '', defval: 'rgba(0,127,255,1)', group: G[1], inline: 'tenkan' },
  { id: 'showKijun', type: 'bool', title: 'Kijun-Sen    ', defval: true, group: G[1], inline: 'kijun', tooltip: 'Kijun-Sen = Toggle visibility of the Kijun-Sen (Base Line).\nColor = Line color on chart.' },
  { id: 'kijunColor', type: 'color', title: '', defval: 'rgba(229,57,53,1)', group: G[1], inline: 'kijun' },
  { id: 'showPriceLabels', type: 'bool', title: 'Show TK/KJ Labels', defval: true, group: G[1], tooltip: 'Display smart price labels at the end of Tenkan and Kijun lines.\nLABEL CONTENT:\n• TK: Price + Spread vs KJ in () — momentum indicator\n• KJ: Price + Distance from Price in [] — mean reversion ref\nLABEL FEATURES:\n• Direction arrows (↗↘→) show line trend\n• Dynamic colors: Teal=Support, Red=Resistance, Orange=Equilibrium\n• Auto-merge into single label when TK ≈ KJ\n• Rich tooltip with detailed analysis on hover' },
  { id: 'tkkjLabelBullColor', type: 'color', title: 'Bullish', defval: 'rgba(38,166,154,0.3)', group: G[1], inline: 'tkkjlbl', tooltip: 'Bullish = Label background when price is ABOVE the line (support level).\nBearish = Label background when price is BELOW the line (resistance level).\nEquilibrium = Label background when TK ≈ KJ (equilibrium state).' },
  { id: 'tkkjLabelBearColor', type: 'color', title: 'Bearish', defval: 'rgba(239,83,80,0.3)', group: G[1], inline: 'tkkjlbl' },
  { id: 'tkkjLabelNeutralColor', type: 'color', title: 'Equilibrium', defval: 'rgba(255,152,0,0.3)', group: G[1], inline: 'tkkjlbl' },
  { id: 'showChikou', type: 'bool', title: 'Chikou Span (遅行)', defval: true, group: G[1], tooltip: 'Toggle visibility of the Chikou Span (Lagging Span).\nThe Chikou plots current price shifted back in time, allowing visual comparison with past price action. Color changes based on position relative to past price (Bull/Bear/Equilibrium colors below).' },
  { id: 'chikouMode', type: 'string', title: 'Chikou Offset (遅行)', defval: 'Adaptive', options: ['Fixed', 'Adaptive'], group: G[1], tooltip: 'How the Chikou Span offset is determined:\nFIXED (Orthodox Hosoda): Uses preset offset (26, 22, 30, etc.), represents fixed market cycles, recommended for traditional Ichimoku.\nADAPTIVE (Dynamic): Uses adaptive Chikou length, offset adjusts with market conditions, more responsive but less orthodox.' },
  { id: 'chikouBullColor', type: 'color', title: 'Bullish', defval: 'rgba(38,166,154,1)', group: G[1], inline: 'chikoucolor' },
  { id: 'chikouBearColor', type: 'color', title: 'Bearish', defval: 'rgba(239,83,80,1)', group: G[1], inline: 'chikoucolor' },
  { id: 'chikouNeutralColor', type: 'color', title: 'Equilibrium', defval: 'rgba(255,152,0,1)', group: G[1], inline: 'chikoucolor' },
  { id: 'chikouLinewidth', type: 'int', title: 'Chikou Line Width', defval: 1, min: 1, max: 5, group: G[1], tooltip: 'Thickness of the Chikou Span line on chart.\nApplies to both Fixed and Adaptive offset modes.\n• 1 = Default (thin, matches TK/KJ)\n• 2-3 = Medium emphasis\n• 4-5 = Strong visual prominence' },
  { id: 'showSenkouA', type: 'bool', title: 'Senkou Span A', defval: true, group: G[1], inline: 'senkou', tooltip: 'Senkou Span A = Toggle visibility of the Leading Span A line.\nSenkou Span B = Toggle visibility of the Leading Span B line.' },
  { id: 'showSenkouB', type: 'bool', title: 'Senkou Span B', defval: true, group: G[1], inline: 'senkou' },
  { id: 'kumoBullColor', type: 'color', title: 'Bullish', defval: 'rgba(38,166,154,1)', group: G[1], inline: 'senkoucolor' },
  { id: 'kumoBearColor', type: 'color', title: 'Bearish', defval: 'rgba(239,83,80,1)', group: G[1], inline: 'senkoucolor' },
  { id: 'kumoNeutralColor', type: 'color', title: 'Equilibrium', defval: 'rgba(176,190,197,1)', group: G[1], inline: 'senkoucolor' },
  { id: 'kumoFillEnabled', type: 'bool', title: 'Kumo Fill Transparency       ', defval: true, group: G[1], inline: 'kumo', tooltip: 'Kumo Fill = Toggle Kumo (cloud) shading between Senkou Span A and B.\nTransparency = How see-through the fill is (1 = nearly solid, 100 = fully invisible).' },
  { id: 'kumoFillTransparency', type: 'int', title: '', defval: 75, min: 1, max: 100, group: G[1], inline: 'kumo' },
  { id: 'kumoFillStyle', type: 'string', title: 'Kumo Fill Style', defval: 'Gradient', options: ['Solid', 'Gradient'], group: G[1], tooltip: 'Visual style for Kumo (cloud) fill:\n• Solid: Single color based on Kumo direction\n• Gradient: Smooth strength-based 2-color gradient' },
  { id: 'showSignals', type: 'bool', title: 'Show Signals', defval: true, group: G[1], tooltip: 'Toggle signal markers (▲▼) on chart.\nSignals mark structural trend reversals where all enabled Ichimoku filters align.\n• ▲ Triangle Up = Bullish reversal\n• ▼ Triangle Down = Bearish reversal\nThese signals also anchor S/R zones and can optionally anchor Kihon Sūchi time cycles (see Anchor Mode in Time Theory).' },
  { id: 'bullEventColor', type: 'color', title: 'Bullish Event', defval: 'rgba(38,166,154,1)', group: G[1], inline: 'evt_clr', tooltip: 'Global colors for bullish/bearish events.\nApplied to:\n• Signal markers (▲▼)\n• S/R Zones (Support/Resistance)\n• Time Theory (Kihon & Taito Sūchi projections)\n• Swing markers (●)' },
  { id: 'bearEventColor', type: 'color', title: 'Bearish Event', defval: 'rgba(239,83,80,1)', group: G[1], inline: 'evt_clr' },
  { id: 'tkMinLength', type: 'int', title: 'Tenkan Min Length', defval: 9, min: 1, max: 1000000000000, group: G[2], tooltip: 'Lower bound for adaptive length — contracts toward this value when adaptive filters (Volume/ATR/Chikou Trend) confirm.\n⚠ If ALL filters are disabled, length stays at Max Length (no contraction).' },
  { id: 'tkMaxLength', type: 'int', title: 'Tenkan Max Length', defval: 30, min: 1, max: 1000000000000, group: G[2], tooltip: 'Upper bound for adaptive length — expands toward this value when adaptive filters don\'t confirm.\nThe length oscillates between Min and Max based on market conditions.' },
  { id: 'tkDynPct', type: 'float', title: 'Tenkan Smoothing %', defval: 96.85, min: 0, max: 100, group: G[2], tooltip: 'Controls how smoothly the Tenkan-Sen adaptive length transitions between Min and Max.\nHigher values (closer to 100%) = slower, smoother transitions.\nLower values = faster, more reactive length changes.\nDefault 96.85% provides gradual adaptation.' },
  { id: 'tkVolFilter', type: 'bool', title: 'Volume', defval: true, group: G[2], inline: 'tkf', tooltip: 'Tenkan-Sen adaptive length filters.\nVolume = Use volume oscillator to contract/expand length.\nATR = Use ATR volatility to contract/expand length.\nChikou Trend = Use Chikou trend to contract/expand length.\n⚠ If ALL are disabled, length stays at Max Length (no contraction).' },
  { id: 'tkAtrFilter', type: 'bool', title: 'ATR', defval: true, group: G[2], inline: 'tkf' },
  { id: 'tkChikouFilter', type: 'bool', title: 'Chikou Trend', defval: true, group: G[2], inline: 'tkf' },
  { id: 'kjMinLength', type: 'int', title: 'Kijun Min Length', defval: 20, min: 1, max: 1000000000000, group: G[2], tooltip: 'Lower bound for adaptive length — contracts toward this value when adaptive filters (Volume/ATR/Chikou Trend) confirm.\n⚠ If ALL filters are disabled, length stays at Max Length (no contraction).' },
  { id: 'kjMaxLength', type: 'int', title: 'Kijun Max Length', defval: 60, min: 1, max: 1000000000000, group: G[2], tooltip: 'Upper bound for adaptive length — expands toward this value when adaptive filters don\'t confirm.\nThe length oscillates between Min and Max based on market conditions.' },
  { id: 'kjDynPct', type: 'float', title: 'Kijun Smoothing %', defval: 96.85, min: 0, max: 100, group: G[2], tooltip: 'Controls how smoothly the Kijun-Sen adaptive length transitions between Min and Max.\nHigher values (closer to 100%) = slower, smoother transitions.\nLower values = faster, more reactive length changes.\nDefault 96.85% provides gradual adaptation.' },
  { id: 'kjVolFilter', type: 'bool', title: 'Volume', defval: true, group: G[2], inline: 'kjf', tooltip: 'Kijun-Sen adaptive length filters.\nVolume = Use volume oscillator to contract/expand length.\nATR = Use ATR volatility to contract/expand length.\nChikou Trend = Use Chikou trend to contract/expand length.\n⚠ If ALL are disabled, length stays at Max Length (no contraction).' },
  { id: 'kjAtrFilter', type: 'bool', title: 'ATR', defval: true, group: G[2], inline: 'kjf' },
  { id: 'kjChikouFilter', type: 'bool', title: 'Chikou Trend', defval: true, group: G[2], inline: 'kjf' },
  { id: 'chMinLength', type: 'int', title: 'Chikou Min Length', defval: 26, min: 1, max: 1000000000000, group: G[2], tooltip: 'Lower bound for adaptive length — contracts toward this value when adaptive filters (Volume/ATR/Chikou Trend) confirm.\n⚠ If ALL filters are disabled, length stays at Max Length (no contraction).' },
  { id: 'chMaxLength', type: 'int', title: 'Chikou Max Length', defval: 50, min: 1, max: 1000000000000, group: G[2], tooltip: 'Upper bound for adaptive length — expands toward this value when adaptive filters don\'t confirm.\nThe length oscillates between Min and Max based on market conditions.' },
  { id: 'chDynPct', type: 'float', title: 'Chikou Smoothing %', defval: 96.85, min: 0, max: 100, group: G[2], tooltip: 'Controls how smoothly the Chikou Span adaptive length transitions between Min and Max.\nHigher values (closer to 100%) = slower, smoother transitions.\nLower values = faster, more reactive length changes.\nDefault 96.85% provides gradual adaptation.' },
  { id: 'chFilterPeriod', type: 'int', title: 'Chikou Filter Period', defval: 25, min: 1, max: 1000000000000, group: G[2], tooltip: 'Lookback period for the Chikou breakout filter.\nDetermines how many past bars the Chikou Span is compared against. Used by adaptive length engine, signal Chikou Trend filter, and bar color confluence.\nHigher values detect longer-term breakouts, lower values are more responsive.' },
  { id: 'chVolFilter', type: 'bool', title: 'Volume', defval: true, group: G[2], inline: 'chf', tooltip: 'Chikou Span adaptive length filters.\nVolume = Use volume oscillator to contract/expand length.\nATR = Use ATR volatility to contract/expand length.\nChikou Trend = Use Chikou trend to contract/expand length.\n⚠ If ALL are disabled, length stays at Max Length (no contraction).' },
  { id: 'chAtrFilter', type: 'bool', title: 'ATR', defval: true, group: G[2], inline: 'chf' },
  { id: 'chTrendFilter', type: 'bool', title: 'Chikou Trend', defval: true, group: G[2], inline: 'chf' },
  { id: 'skMinLength', type: 'int', title: 'Senkou Min Length', defval: 50, min: 1, max: 1000000000000, group: G[2], tooltip: 'Lower bound for adaptive length — contracts toward this value when adaptive filters (Volume/ATR/Chikou Trend) confirm.\n⚠ If ALL filters are disabled, length stays at Max Length (no contraction).' },
  { id: 'skMaxLength', type: 'int', title: 'Senkou Max Length', defval: 120, min: 1, max: 1000000000000, group: G[2], tooltip: 'Upper bound for adaptive length — expands toward this value when adaptive filters don\'t confirm.\nThe length oscillates between Min and Max based on market conditions.' },
  { id: 'skDynPct', type: 'float', title: 'Senkou Smoothing %', defval: 96.85, min: 0, max: 100, group: G[2], tooltip: 'Controls how smoothly the Senkou Span adaptive length transitions between Min and Max.\nHigher values (closer to 100%) = slower, smoother transitions.\nLower values = faster, more reactive length changes.\nDefault 96.85% provides gradual adaptation.' },
  { id: 'skOffsetLength', type: 'int', title: 'Senkou Span Offset', defval: 26, min: 1, max: 1000000000000, group: G[2], tooltip: 'Offset (in bars) for Senkou Span projection into the future.\nAlso used for Chikou Span when Chikou Offset (遅行) is set to Fixed.\nPreset values: Classic=26, 5D=22, Crypto=30, Slow=60' },
  { id: 'skVolFilter', type: 'bool', title: 'Volume', defval: true, group: G[2], inline: 'sn_chks', tooltip: 'Senkou Span adaptive length filters.\nVolume = Use volume oscillator to contract/expand length.\nATR = Use ATR volatility to contract/expand length.\nChikou Trend = Use Chikou trend to contract/expand length.\n⚠ If ALL are disabled, length stays at Max Length (no contraction).' },
  { id: 'skAtrFilter', type: 'bool', title: 'ATR', defval: true, group: G[2], inline: 'sn_chks' },
  { id: 'skChikouFilter', type: 'bool', title: 'Chikou Trend', defval: true, group: G[2], inline: 'sn_chks' },
  { id: 'volOscType', type: 'string', title: 'Volume Oscillator Type', defval: 'On Balance Volume', options: ['TFS Volume Oscillator', 'On Balance Volume', 'Klinger Volume Oscillator', 'Cumulative Volume Oscillator', 'Volume Zone Oscillator'], group: G[3], tooltip: 'Main volume oscillator for signal generation.\n• On Balance Volume (OBV): Tracks cumulative volume flow\n• TFS: Normalized accumulation indicator\n• Klinger: Trend-based with smoothing (uses Fast/Slow Length below)\n• Cumulative: Multi-method volume delta (uses RVSI parameters below)\n• Volume Zone Oscillator (VZO): Ranges from -100 to +100 (uses VZO Length below)' },
  { id: 'volOscTypeTk', type: 'string', title: '├─ Tenkan Oscillator', defval: 'On Balance Volume', options: ['TFS Volume Oscillator', 'On Balance Volume', 'Klinger Volume Oscillator', 'Cumulative Volume Oscillator', 'Volume Zone Oscillator'], group: G[3], tooltip: 'Volume oscillator for Tenkan-Sen adaptive length calculation.\nSame parameter dependencies as main oscillator.' },
  { id: 'volOscTypeKj', type: 'string', title: '├─ Kijun Oscillator', defval: 'On Balance Volume', options: ['TFS Volume Oscillator', 'On Balance Volume', 'Klinger Volume Oscillator', 'Cumulative Volume Oscillator', 'Volume Zone Oscillator'], group: G[3], tooltip: 'Volume oscillator for Kijun-Sen adaptive length calculation.\nSame parameter dependencies as main oscillator.' },
  { id: 'volOscTypeSk', type: 'string', title: '├─ Senkou Oscillator', defval: 'On Balance Volume', options: ['TFS Volume Oscillator', 'On Balance Volume', 'Klinger Volume Oscillator', 'Cumulative Volume Oscillator', 'Volume Zone Oscillator'], group: G[3], tooltip: 'Volume oscillator for Senkou Span adaptive length calculation.\nSame parameter dependencies as main oscillator.' },
  { id: 'volOscTypeCh', type: 'string', title: '└─ Chikou Oscillator', defval: 'On Balance Volume', options: ['TFS Volume Oscillator', 'On Balance Volume', 'Klinger Volume Oscillator', 'Cumulative Volume Oscillator', 'Volume Zone Oscillator'], group: G[3], tooltip: 'Volume oscillator for Chikou Span adaptive length calculation.\nSame parameter dependencies as main oscillator.' },
  { id: 'volPeakThreshold', type: 'float', title: 'Volume Breakout Threshold', defval: 50, min: 1, max: 1000000000000, group: G[3], tooltip: 'Threshold level for volume breakout signals.\n⚠ Works best with Volume Zone Oscillator (VZO) which has a fixed -100 to +100 scale. Other oscillators have unbounded scales, making a fixed threshold less effective.\nRecommended for VZO: 40-60 (default 50)' },
  { id: 'volFastLength', type: 'int', title: '┌─ Klinger Fast Length', defval: 34, min: 1, max: 1000000000000, group: G[3], tooltip: '⚠ CONDITIONAL PARAMETER\nOnly used when oscillator type = \'Klinger Volume Oscillator\'\nFast smoothing period for Klinger calculation.\nSmaller values react faster to volume changes.\nDefault: 34' },
  { id: 'volSlowLength', type: 'int', title: '└─ Klinger Slow Length', defval: 55, min: 1, max: 1000000000000, group: G[3], tooltip: '⚠ CONDITIONAL PARAMETER\nOnly used when oscillator type = \'Klinger Volume Oscillator\'\nSlow smoothing period for Klinger calculation.\nLarger values provide a steadier baseline.\nDefault: 55' },
  { id: 'volZoneLength', type: 'int', title: '─── VZO Length', defval: 21, min: 1, max: 1000000000000, group: G[3], tooltip: '⚠ CONDITIONAL PARAMETER\nOnly used when oscillator type = \'Volume Zone Oscillator\'\nSmoothing period for VZO calculation.\nSmaller = more reactive, Larger = smoother.\nDefault: 21' },
  { id: 'volRatioType', type: 'string', title: '┌─ RVSI Base Type', defval: 'Price Volume Trend', options: ['On Balance Volume', 'Cumulative Volume Delta', 'Price Volume Trend'], group: G[3], tooltip: '⚠ CONDITIONAL PARAMETER\nOnly used when oscillator type = \'Cumulative Volume Oscillator\'\nBase calculation method for cumulative volume:\n• On Balance Volume: Classic directional volume flow\n• Cumulative Volume Delta: Net buying vs selling pressure\n• Price Volume Trend: Volume weighted by price changes (default)' },
  { id: 'volRatioLength', type: 'int', title: '─── TFS Length', defval: 14, min: 1, max: 1000000000000, group: G[3], tooltip: '⚠ CONDITIONAL PARAMETER\nOnly used when oscillator type = \'TFS Volume Oscillator\'\nLookback period for TFS accumulation calculation.\nDefault: 14' },
  { id: 'volEmaLength1', type: 'int', title: '├─ RVSI EMA Fast', defval: 8, min: 1, max: 1000000000000, group: G[3], tooltip: '⚠ CONDITIONAL PARAMETER\nOnly used when oscillator type = \'Cumulative Volume Oscillator\'\nFast smoothing period for cumulative volume.\nSmaller = more reactive to recent volume changes.\nDefault: 8' },
  { id: 'volEmaLength2', type: 'int', title: '└─ RVSI EMA Slow', defval: 21, min: 1, max: 1000000000000, group: G[3], tooltip: '⚠ CONDITIONAL PARAMETER\nOnly used when oscillator type = \'Cumulative Volume Oscillator\'\nSlow smoothing period for cumulative volume.\nLarger = smoother baseline for comparison.\nDefault: 21' },
  { id: 'atrFastLength', type: 'int', title: 'ATR Fast Length', defval: 14, group: G[4], tooltip: 'Fast ATR period for volatility comparison. Used to detect expanding volatility when fast ATR > slow ATR.' },
  { id: 'atrSlowLength', type: 'int', title: 'ATR Slow Length', defval: 46, group: G[4], tooltip: 'Slow ATR period for volatility baseline. When fast ATR exceeds slow ATR, volatility is considered expanding.' },
  { id: 'filterVolume', type: 'bool', title: 'Volume Filter', defval: true, group: G[5], tooltip: 'Confirms the selected Volume Oscillator output is above (bull) or below (bear) the Breakout Threshold (set in Volume section).\n⚠ If ALL filters are disabled, signals cannot be generated.' },
  { id: 'filterTkKjCross', type: 'bool', title: 'Tenkan/Kijun Cross', defval: true, group: G[5], tooltip: 'Confirms a Tenkan/Kijun crossover in the signal direction.' },
  { id: 'filterAtrVolatility', type: 'bool', title: 'ATR Volatility', defval: true, group: G[5], tooltip: 'Confirms market volatility is expanding (fast ATR > slow ATR).' },
  { id: 'filterChikouVsPrice', type: 'bool', title: 'Chikou > Price', defval: true, group: G[5], tooltip: 'Confirms Chikou Span is above (bull) or below (bear) past price.' },
  { id: 'filterMomentum', type: 'bool', title: 'Chikou Momentum', defval: true, group: G[5], tooltip: 'Confirms Chikou momentum aligns with the signal direction.' },
  { id: 'filterPriceVsKumo', type: 'bool', title: 'Price > Kumo', defval: true, group: G[5], tooltip: 'Confirms price is clearly above the Kumo top (bull) or below it (bear).\nNote: Price inside the Kumo is treated as bearish bias — only a full breakout above the cloud confirms bullish.' },
  { id: 'filterPriceVsTenkan', type: 'bool', title: 'Price > Tenkan', defval: true, group: G[5], tooltip: 'Confirms price is above (bull) or below (bear) the Tenkan-Sen.' },
  { id: 'filterChikouTrend', type: 'bool', title: 'Chikou Trend', defval: true, group: G[5], tooltip: 'Confirms the Chikou Span has broken above recent highs (bull) or below recent lows (bear).\nThis measures whether price has achieved a clear directional breakout relative to past price action over the Chikou lookback period.' },
  { id: 'filterConsolidation', type: 'bool', title: 'Flat Market Filter', defval: true, group: G[5], tooltip: 'Blocks all signals when the market is in deep consolidation — detected when trend strength is very low and the Kumo is extremely thin.\nRecommended to avoid low-quality signals in ranging markets.' },
  { id: 'srEnabled', type: 'bool', title: 'Show S/R Zones', defval: true, group: G[6], tooltip: 'Master toggle for Support/Resistance zone engine.\nZones are created at each signal event (▲▼) — structural trend reversals detected by the Ichimoku system.\nEach zone tracks price interaction: contact, break, retest, and optional flip (S↔R).' },
  { id: 'srZoneLayout', type: 'string', title: 'Zone Style', defval: 'Line', options: ['Line', 'Zone'], group: G[6], tooltip: 'Visual style for S/R zones:\n• Line: Horizontal line at the level\n• Zone: Border-only box with a dotted median line at the equilibrium point. Box size depends on Zone Placement setting.' },
  { id: 'srZonePlacement', type: 'string', title: 'Zone Placement', defval: 'Wick', options: ['Wick', 'Body', 'Median'], group: G[6], tooltip: 'Where to anchor the S/R level:\n• Wick: High/Low range — full rejection zone (default)\n• Body: Open/Close range — tighter zones\n• Median: (High+Low)/2 — Hosoda\'s equilibrium principle\nWick is the classic S/R approach: levels are defined by the full candle range where price was rejected. Body gives tighter zones focused on where the market actually closed. Median uses Hosoda\'s balance point — breakouts are detected earlier but may trigger prematurely in volatile markets.' },
  { id: 'srMaxZones', type: 'int', title: 'Max Zones', defval: 12, min: 2, max: 50, group: G[6], tooltip: 'Maximum number of S/R zones visible on the chart.\nDYNAMIC ATR PRUNING: Zones beyond (Max Zones x 1.5) x ATR are auto-removed every bar. Handles distance — removes zones too far from price.\n• 20 zones → 30x ATR radius\n• 12 zones → 18x ATR radius (default)\n• 8 zones → 12x ATR radius\nAGE-BASED QUOTA: When more zones exist than Max Zones, the oldest ones are removed first. Recent zones always survive. ATR handles distance, quota handles freshness.' },
  { id: 'srZoneWidth', type: 'int', title: 'Line/Border Width', defval: 1, min: 1, max: 3, group: G[6], tooltip: 'Thickness of S/R zone lines or box borders.\n• 1 = Thin (default, less visual clutter)\n• 2 = Medium\n• 3 = Thick (more prominent zones)' },
  { id: 'srExtend', type: 'bool', title: 'Extend Zones (Live)', defval: true, group: G[6], tooltip: 'When enabled (default), all zones extend to the current bar continuously.\nWhen disabled, zones extend until their first touch by price. Once touched, the zone freezes.\nUntouched zones continue to extend until price reaches them.' },
  { id: 'srFlipEnabled', type: 'bool', title: 'Flip Zone on Break (S↔R)', defval: false, group: G[6], tooltip: 'When enabled, broken zones flip their type:\n• Broken Support → becomes Resistance\n• Broken Resistance → becomes Support\nThis reflects the classic trading principle that old support becomes new resistance (and vice-versa).\nFlipped zones behave like new zones: freeze state and touch tracking reset.' },
  { id: 'srShowLabels', type: 'bool', title: 'Show Zone Labels', defval: true, group: G[6], tooltip: 'Display informative labels on S/R zones.\nLABEL CONTENT:\n• Zone type (S / R)\n• Price level (anchor point from Zone Placement)\nEXAMPLE: \'S • 45230.50\'\nLabels update position when zones freeze on first touch (Extend OFF).' },
  { id: 'srLabelSize', type: 'string', title: '└─ Label Size', defval: 'Small', options: ['Tiny', 'Small', 'Normal'], group: G[6], tooltip: 'Size of price labels on S/R zones. Only applies when \'Show Zone Labels\' is enabled.' },
  { id: 'tkrEnabled', type: 'bool', title: 'Show TK-Range Highlight', defval: false, group: G[7], tooltip: 'Highlight phases where price is trapped BETWEEN Tenkan and Kijun lines.\nDetection is based on CLOSE price — a breakout is confirmed only when close exits the TK/KJ band.\nIf TK/KJ converge while price is still inside (spread collapses), the zone exits as CONVERGED (⇔) — no directional breakout is assigned.\nFEATURES:\n• Median line shows center of consolidation\n• Optional zone extension (like S/R)\n• Smart merge prevents overlapping zones\n• Contextual labels (duration + direction while active, direction + move % after breakout)\n• Hover tooltips with ATR-based range quality' },
  { id: 'tkrColor', type: 'color', title: 'Box Color', defval: 'rgba(255,179,0,0.15)', group: G[7], tooltip: 'Color for TK-Range consolidation boxes.\nDefault amber/orange is chosen to be:\n• Distinct from bullish teal and bearish red\n• Visible against both Kumo colors\n• Neutral, reflecting the directionless nature of consolidation' },
  { id: 'tkrMinBars', type: 'int', title: 'Min Bars to Qualify', defval: 3, min: 1, max: 20, group: G[7], tooltip: 'Minimum consecutive bars with CLOSE inside TK/KJ range before displaying the box.\nHigher values = fewer but more significant consolidation zones.\nRecommended: 3-5 bars' },
  { id: 'tkrShowMedian', type: 'bool', title: 'Show Median Line', defval: true, group: G[7], tooltip: 'Display a dotted line at the center of each TK-Range box.\nThe median represents the equilibrium point within the consolidation zone and can act as a micro support/resistance level.' },
  { id: 'tkrExtend', type: 'bool', title: 'Extend Zones', defval: true, group: G[7], tooltip: 'When enabled, TK-Range boxes extend to the current bar (like S/R zones).\nWhen disabled, boxes end exactly when price exits the consolidation.\nNote: Extended zones that overlap will automatically merge.' },
  { id: 'tkrShowLabel', type: 'bool', title: 'Show Labels', defval: true, group: G[7], tooltip: 'Display a centered label inside each TK-Range box.\nFORMAT:\n• Active zone: Duration + Direction (e.g. \'7b • →\')\n• Completed zone (Extend OFF): Duration + Direction (e.g. \'7b • ↑\')\n• Completed zone (Extend ON): Duration + Direction + Move % (e.g. \'7b • ↑ +3.2%\')\n• Converged zone: Duration + ⇔ (e.g. \'7b • ⇔\') — TK/KJ spread collapsed' },
  { id: 'tkrMaxHistory', type: 'int', title: 'Max Historical Zones', defval: 5, min: 1, max: 100, group: G[7], tooltip: 'Maximum number of past consolidation zones to keep on the chart.\nOldest zones are removed when this limit is reached.\nEXTEND MODE: Zones too far from price are automatically pruned (distance threshold = Max Zones x 3 x ATR).' },
  { id: 'swingEnabled', type: 'bool', title: 'Swing Detection', defval: false, group: G[8], tooltip: 'Detect swing highs/lows — the foundation for Hosoda\'s three theories:\n• 波動論 Wave Theory — pattern recognition\n• 値幅観測論 Price Theory — price targets\n• 時間論 Time Theory — cycle analysis\nA bar is confirmed as a swing if it remains the highest (or lowest) within Swing Length bars on both sides.\n⚠ Markers appear with a delay equal to Swing Length.' },
  { id: 'swingLength', type: 'int', title: 'Swing Length', defval: 10, min: 2, max: 50, group: G[8], tooltip: 'Bars on EACH SIDE to confirm a swing point.\n• 3-5: More swings, minor moves\n• 8-15: Balanced (recommended)\n• 20+: Major pivots only\nAlso determines detection delay.' },
  { id: 'swingShowHl', type: 'bool', title: 'Show Swing Markers', defval: true, group: G[8], tooltip: 'Display ● markers on confirmed swing highs (above bar) and lows (below bar).\nMarkers appear at the actual swing bar, offset back by Swing Length.\nColors follow Bullish/Bearish Event colors.' },
  { id: 'swingMaxStored', type: 'int', title: 'Max Stored Points', defval: 50, min: 20, max: 100, group: G[8], tooltip: 'Maximum swing points kept in memory.\nData source for Wave, Price, and Time theories.\n• 50: Recommended\n• Higher: More depth for higher timeframes' },
  { id: 'waveEnabled', type: 'bool', title: 'Wave Detection', defval: false, group: G[9], tooltip: '波動論 (Hadōron) — Detect Hosoda\'s wave patterns from swing points.\nBASIC (2-4 points):\n• I — Impulse: single leg A→B\n• V — Return: price returns to origin\n• N — Continuation: impulse-correction-continuation\nCOMPLEX (4-5 points):\n• P — Converging triangle\n• Y — Expanding triangle\n• W — Double formation\nThe N-wave is the most important — it drives Price Theory targets.\n⚠ Requires Swing Detection.' },
  { id: 'waveShowI', type: 'bool', title: 'Basic:       ', defval: true, group: G[9], inline: 'wave_basic', tooltip: 'N-wave = core pattern — a 4-point A→B→C→D structure.\nWhen detected, it triggers Price Theory targets:\n• V = B + (B - C)\n• E = B + (B - A)\n• N = C + (B - A)\n• NT = C + (C - A)' },
  { id: 'waveColorI', type: 'color', title: 'I', defval: 'rgba(233,30,99,1)', group: G[9], inline: 'wave_basic' },
  { id: 'waveShowV', type: 'bool', title: '', defval: true, group: G[9], inline: 'wave_basic' },
  { id: 'waveColorV', type: 'color', title: 'V', defval: 'rgba(249,168,37,1)', group: G[9], inline: 'wave_basic' },
  { id: 'waveShowN', type: 'bool', title: '', defval: true, group: G[9], inline: 'wave_basic' },
  { id: 'waveColorN', type: 'color', title: 'N ', defval: 'rgba(74,138,212,1)', group: G[9], inline: 'wave_basic' },
  { id: 'waveShowP', type: 'bool', title: 'Complex:', defval: true, group: G[9], inline: 'wave_complex', tooltip: 'Complex waves require 4-5 swing points.\n• P — Range narrows (C-D tighter than A-B). Compression before breakout.\n• Y — Range widens (C-D wider than A-B). Increasing volatility.\n• W — Repeating structure (A≈C≈E, B≈D). Double bottom/top.\nLess frequent than I/V/N but signal important structural shifts.' },
  { id: 'waveColorP', type: 'color', title: 'P', defval: 'rgba(0,151,167,1)', group: G[9], inline: 'wave_complex' },
  { id: 'waveShowY', type: 'bool', title: '', defval: true, group: G[9], inline: 'wave_complex' },
  { id: 'waveColorY', type: 'color', title: 'Y', defval: 'rgba(255,93,0,1)', group: G[9], inline: 'wave_complex' },
  { id: 'waveShowW', type: 'bool', title: '', defval: true, group: G[9], inline: 'wave_complex' },
  { id: 'waveColorW', type: 'color', title: 'W', defval: 'rgba(0,200,83,1)', group: G[9], inline: 'wave_complex' },
  { id: 'waveMaxDisplay', type: 'int', title: 'Max Waves Displayed', defval: 8, min: 1, max: 20, group: G[9], tooltip: 'Maximum number of waves to show on the chart.\nOldest waves are removed when this limit is reached.\nKeep low (5-8) for readability, increase (15-20) for comprehensive analysis.' },
  { id: 'waveOverlap', type: 'bool', title: 'Allow Overlapping', defval: false, group: G[9], tooltip: 'ON: All detected waves shown, even if they share endpoints. Labels may stack.\nOFF (default): Only highest-priority wave per endpoint.\nPriority: N > W > P > Y > V > I' },
  { id: 'priceTEnabled', type: 'bool', title: 'Price Targets', defval: false, group: G[10], tooltip: '値幅観測論 (Nehaba Kansokuron) — Project WHERE price is likely to reach from N-wave geometry.\nTWO MODES:\n• Completed N-wave (A→B→C→D): targets beyond D\n• Developing N-wave (A→B→C): targets where D should complete\nTARGETS:\n• V = B + (B - C)\n• N = C + (B - A)\n• E = B + (B - A)\n• NT = C + (C - A)\n• 2E / 3E = extended multiples\nTarget lines extend into the Senkou projection zone for Price x Kumo confluence reading.\n⚠ Requires Swing + Wave Detection.' },
  { id: 'priceTShowV', type: 'bool', title: 'Basic:', defval: true, group: G[10], inline: 'pt_basic', tooltip: 'V = quickest target (from correction).\nN = classic continuation.\nE = strongest projection.\nNT = most conservative.\nAll derived from the same N-wave geometry.' },
  { id: 'priceTColorV', type: 'color', title: 'V', defval: 'rgba(255,171,0,0.8)', group: G[10], inline: 'pt_basic' },
  { id: 'priceTShowN', type: 'bool', title: '', defval: true, group: G[10], inline: 'pt_basic' },
  { id: 'priceTColorN', type: 'color', title: 'N', defval: 'rgba(66,165,245,0.8)', group: G[10], inline: 'pt_basic' },
  { id: 'priceTShowE', type: 'bool', title: '', defval: true, group: G[10], inline: 'pt_basic' },
  { id: 'priceTColorE', type: 'color', title: 'E', defval: 'rgba(236,64,122,0.8)', group: G[10], inline: 'pt_basic' },
  { id: 'priceTShowNT', type: 'bool', title: '', defval: true, group: G[10], inline: 'pt_basic' },
  { id: 'priceTColorNT', type: 'color', title: 'NT', defval: 'rgba(102,187,106,0.8)', group: G[10], inline: 'pt_basic' },
  { id: 'priceTShow2E', type: 'bool', title: 'Extended:', defval: false, group: G[10], inline: 'pt_ext', tooltip: 'Extended multiples of the E distance.\n• 2E = B + 2x(B - A)\n• 3E = B + 3x(B - A)\nRare extreme targets — useful in strong trending markets.' },
  { id: 'priceTColor2E', type: 'color', title: '2E', defval: 'rgba(255,112,67,0.8)', group: G[10], inline: 'pt_ext' },
  { id: 'priceTShow3E', type: 'bool', title: '', defval: false, group: G[10], inline: 'pt_ext' },
  { id: 'priceTColor3E', type: 'color', title: '3E', defval: 'rgba(171,71,188,0.8)', group: G[10], inline: 'pt_ext' },
  { id: 'priceTValidate', type: 'bool', title: 'Show Validation', defval: true, group: G[10], tooltip: 'Track whether price has reached each target.\n• Reached ✓ — price hit the level\n• Pending ⋯ — still an active projection\nWhen disabled, all targets show as Completed.' },
  { id: 'priceTDeveloping', type: 'bool', title: 'Show Developing Targets', defval: true, group: G[10], tooltip: 'Project targets from a DEVELOPING N-wave (3 points: A→B→C) before D completes.\nThe most actionable feature — shows WHERE price is expected to go.\n• Targets show where D should reach\n• Visual: lighter dotted lines\n• Updates dynamically as the wave develops\n⚠ Disappear once the wave completes or the pattern breaks.' },
  { id: 'kihonEnabled', type: 'bool', title: 'Kihon Sūchi (基本数値)', defval: false, group: G[11], tooltip: '時間論 (Jikanron) — Project fixed time cycles from anchor events.\nIdentifies universal rhythm points where trend changes are more likely.\nNUMBERS: 9, 17, 26, 33, 42, 51, 65, 76, 129, 172, 200, 257\n• 9 anchor modes (Signals, Crosses, Swings, Waves...)\n• Multi-anchor: track 1-3 recent events\n• Confluence: gold highlight when cycles converge (±1 bar)\n• Past validation: ✓ where price made a swing\n⚠ Cycles indicate WHEN, not direction.' },
  { id: 'kihonAnchor', type: 'string', title: '├─ Anchor Mode', defval: 'Signals (▲▼)', options: ['Signals (▲▼)', 'Tenkan Cross', 'Kijun Cross', 'TK x KJ Cross', 'Kumo Change', 'Swing Highs', 'Swing Lows', 'Swings (H+L)', 'Wave Completion'], group: G[11], tooltip: 'Event that anchors Kihon Sūchi projections:\n• Signals (▲▼): Structural trend reversals\n• Tenkan Cross: Price x Tenkan-Sen\n• Kijun Cross: Price x Kijun-Sen\n• TK x KJ Cross: Tenkan x Kijun (Golden/Dead Cross)\n• Kumo Change: Kumo color flip\n• Swing High / Low / Both: Confirmed pivots\n• Wave: End of detected wave pattern\n⚠ Swing/Wave modes require their respective modules.' },
  { id: 'kihonRange', type: 'string', title: '├─ Cycle Range', defval: 'Basic (9/17/26)', options: ['Basic (9/17/26)', 'Extended (+33/42/51)', 'Full (+65→257)'], group: G[11], tooltip: 'Kihon Sūchi cycles to project:\nBASIC: 9, 17, 26 — most reliable\nEXTENDED: + 33, 42, 51\nFULL: + 65, 76, 129, 172, 200, 257' },
  { id: 'kihonHistory', type: 'int', title: '├─ Anchor History', defval: 1, min: 1, max: 3, group: G[11], tooltip: 'Recent anchor events to track simultaneously.\n• 1: Current event only (cleanest)\n• 2-3: Enables CONFLUENCE detection — gold marker when cycles from different anchors converge (±1 bar)' },
  { id: 'kihonColor', type: 'color', title: '└─ Kihon Color', defval: 'rgba(120,123,134,1)', group: G[11], tooltip: 'Base color for Kihon Sūchi lines and badges.\nOverrides:\n• Active windows (±1 bar) use Bullish/Bearish Event colors\n• Confluence zones use gold highlight' },
  { id: 'taitoEnabled', type: 'bool', title: 'Taito Sūchi (対等数値)', defval: false, group: G[11], tooltip: '対等数値 (Taitō Sūchi) — Project time symmetry from swing durations.\nMeasures the TIME between consecutive swings, then projects that duration forward — markets tend to reproduce symmetric time periods.\nCounterpart of Price Theory:\n• Price Theory → WHERE (price geometry)\n• Taito Sūchi → WHEN (time symmetry)\nExample: Swing A→B took 34 bars → next move from B expected around B + 34.\n⚠ Requires Swing Detection.' },
  { id: 'taitoCount', type: 'int', title: '├─ Swing Pairs', defval: 3, min: 1, max: 5, group: G[11], tooltip: 'Recent consecutive swing intervals to project.\n• 1: Most recent pair only\n• 3: Last 3 intervals (default) — emerging rhythm\n• 5: Full context — dominant periodicities' },
  { id: 'taitoHarmonics', type: 'int', title: '├─ Harmonics', defval: 1, min: 1, max: 9, group: G[11], tooltip: 'Harmonic multiples to project per swing pair.\n• 1: Base duration T only (default)\n• 3: T, 2T, 3T — harmonic rhythm\n• 9: Full series — comprehensive analysis\nIf a move took 34 bars, reversal windows exist at 34, 68, 102...\nHigher harmonics fade progressively.' },
  { id: 'taitoColor', type: 'color', title: '└─ Taito Color', defval: 'rgba(171,71,188,1)', group: G[11], tooltip: 'Color for Taito Sūchi projection lines and badges.' },
  { id: 'txpEnabled', type: 'bool', title: 'Time x Price Confluence', defval: false, group: G[12], tooltip: '時間・値幅合流 (Jikan-Nehaba Gōryū) — WHERE and WHEN converge.\nClusters independent time cycles x price targets into scored zones where multiple Hosoda methods point to the same price at the same time.\nSCORING:\n  score = weighted_time + price_sources + kumo_bonus\n  Cycles weighted by significance (重み Omomi):\n  K26/K42/K76/K129 = 3, K17/K33/K51/K65/K172/K200/K257 = 2, K9 = 1\n  Only score ≥ 4 displayed.\n◆ Diamond = target reached during time window.\n  Fires independently of forecast score.\n⚠ Requires Kihon/Taito + Price Targets enabled.\n  Developing targets (3-point waves) excluded.' },
  { id: 'txpShowForecast', type: 'bool', title: '├─ Forecast Zones', defval: true, group: G[12], tooltip: 'Display cluster zones projected into the future.\nBox height = tolerance zone (±ATR). Box width = ±2 bars around cluster center. Opacity and border scale with score. Score displayed centered in box — hover for full details.\nBorder uses chart foreground for theme-agnostic visibility.\nNote: box = clustering tolerance zone. Price may enter the box without reaching the exact target. ◆ only confirms at exact target level.' },
  { id: 'txpKumoEnhance', type: 'bool', title: '├─ Kumo Enhancement', defval: true, group: G[12], tooltip: 'Award +1 score when a cluster zone intersects the projected Kumo (current Senkou values).\nTriple confluence (Time x Price x Kumo) is the strongest setup in Hosoda\'s framework. Kumo-enhanced clusters use a distinct color.\nNote: uses current projected Kumo as approximation for near-future bars.' },
  { id: 'txpTolerance', type: 'float', title: '├─ Price Tolerance (xATR)', defval: 0.5, min: 0.1, max: 2, step: 0.1, group: G[12], tooltip: 'Proximity threshold for clustering (xATR14).\nTwo intersections merge into one cluster when their price levels are within this tolerance AND their time bars are within ±2 bars.\n• 0.5: Tight — only close targets merge\n• 1.0: Medium — accommodates volatility\n• 2.0: Loose — captures broader zones\nAlso defines vertical height of forecast boxes.' },
  { id: 'txpColor', type: 'color', title: '   Base', defval: '#78909C', group: G[12], inline: 'txp_colors', tooltip: 'Fill color for standard confluence zones and confirmed ◆ markers. Border always uses chart foreground for theme-agnostic visibility.\nDefault slate blue-grey is chosen to be:\n• Distinct from bullish/bearish signal colors\n• Visible against both dark and light chart themes\n• Neutral-analytical, reflecting structural overlay' },
  { id: 'txpKumoColor', type: 'color', title: 'Kumo', defval: '#546E7A', group: G[12], inline: 'txp_colors', tooltip: 'Fill color for Kumo-enhanced triple confluence (Time x Price x Kumo). Used when score ≥ 5 or zone intersects projected Kumo.\nDeeper slate variant creates visual hierarchy with base zones while maintaining neutral-analytical tone.' },
  { id: 'barcolorMode', type: 'string', title: 'Bar Color Mode', defval: 'Price vs TK/KJ', options: ['Disabled', 'Price vs TK/KJ', 'Price vs Kumo', 'Confluence Strength', 'Current Regime', 'Kumo Future Bias'], group: G[13], tooltip: 'Choose how bar colors are determined:\nBASIC MODES\n• Price vs TK/KJ: Bull when price > both Tenkan & Kijun\n• Price vs Kumo: Bull when price > Kumo\n• Current Regime: Follows signal direction (▲▼)\nADVANCED MODES\n• Confluence Strength: Gradient intensity based on aligned Ichimoku conditions\n• Kumo Future Bias: Based on projected Kumo direction (predictive)\n• Disabled: Turns off bar coloring' },
  { id: 'barBullColor', type: 'color', title: 'Bull', defval: 'rgba(46,125,50,1)', group: G[13], inline: 'barcolor' },
  { id: 'barBearColor', type: 'color', title: 'Bear', defval: 'rgba(198,40,40,1)', group: G[13], inline: 'barcolor' },
  { id: 'barNeutralColor', type: 'color', title: 'Equilibrium', defval: 'rgba(120,144,156,1)', group: G[13], inline: 'barcolor' },
  { id: 'panelEnabled', type: 'bool', title: 'Show Panel', defval: true, group: G[14], tooltip: 'Master toggle for the Ichimoku analysis panel.\nThe panel displays a real-time summary of all Ichimoku conditions (TK position, Kumo breakout, Chikou signal, etc.) with color-coded strength indicators.' },
  { id: 'panelLiteMode', type: 'bool', title: 'Lite Mode (Mobile)', defval: false, group: G[14], tooltip: '2-column panel optimized for mobile screens.\nDifferences from full panel:\n• 2 columns instead of 3\n• Compact header\n• Shortened terminology in DETAILS' },
  { id: 'panelPosition', type: 'string', title: 'Position', defval: 'Bottom Right', options: ['Top Right', 'Bottom Right', 'Top Left', 'Bottom Left'], group: G[14], tooltip: 'Screen position of the analysis panel.\nChoose a corner that doesn\'t overlap with your chart\'s price action.' },
  { id: 'panelTextSize', type: 'string', title: 'Text Size', defval: 'Small', options: ['Tiny', 'Small', 'Normal', 'Large'], group: G[14], tooltip: 'Font size for panel text.\n• Tiny: Compact, ideal for small screens or when panel must be minimal\n• Small: Default, good balance of readability and space\n• Normal/Large: Better readability on larger monitors' },
  { id: 'panelHeaderColor', type: 'color', title: 'Header Color', defval: 'rgba(0,0,0,0.8)', group: G[14], tooltip: 'Background color for the panel header row (STATUS / CONSENSUS).\nAdjust transparency to blend with your chart theme.' },
  { id: 'panelBgColor', type: 'color', title: 'Background Color', defval: 'rgba(105,105,105,0.2)', group: G[14], tooltip: 'Background color for all panel data rows.\nDefault is semi-transparent gray (80% transparency) to remain readable on both dark and light chart themes.' },
  { id: 'panelShowTkCross', type: 'bool', title: 'Show TK Cross vs Kumo', defval: true, group: G[14], tooltip: 'Shows the Tenkan/Kijun cross strength relative to Kumo.\n\nStrong: TK range fully above (bull) or below (bear) Kumo, with TK trend aligned.\nWeak: Position confirmed but trend diverges.\n\nNote: Hiding panel rows is display-only — CONSENSUS always uses all 5 signals.' },
  { id: 'panelShowKijun', type: 'bool', title: 'Show Kijun Position', defval: true, group: G[14], tooltip: 'Shows the Kijun-Sen position relative to Kumo combined with price vs Kijun trend.\n\nStrong: Kijun above (bull) or below (bear) Kumo, with price confirming.\nWeak: Position confirmed but price diverges from Kijun.' },
  { id: 'panelShowChikouConfirm', type: 'bool', title: 'Show Chikou Confirm', defval: true, group: G[14], tooltip: 'Shows Chikou Span confirmation strength: compares current price with past highs/lows (Chikou above/below past candles) and evaluates price position relative to Kumo.\n\nStrong: Chikou clears past price AND price is on the same side of Kumo.\nWeak: Chikou confirms direction but price is inside or on the wrong side of Kumo.' },
  { id: 'panelShowPriceKumo', type: 'bool', title: 'Show Price vs Kumo', defval: true, group: G[14], tooltip: 'Shows price position relative to the Kumo (cloud).\n\nStrong Bull: Price above Kumo.\nStrong Bear: Price below Kumo.\nNeutral: Price inside Kumo (no clear trend).' },
  { id: 'panelShowKumoTwist', type: 'bool', title: 'Show Kumo Twist', defval: true, group: G[14], tooltip: 'Shows Kumo direction (Senkou A vs B) combined with price position.\n\nStrong: Kumo direction (A > B = bull, A < B = bear) aligns with price breakout.\nWeak: Kumo direction confirmed but price is on the opposite side or inside.' },
  { id: 'panelShowDetails', type: 'bool', title: 'Show Details Section', defval: true, group: G[14], tooltip: 'Display DETAILS section at bottom of panel.\n• Filters — Are all enabled conditions met?\n• Missing — Which filter conditions are not yet confirmed\n• Regime — Current trend direction and duration\n• Preset — Active Ichimoku period settings' },
  { id: 'panelColorStrongBull', type: 'color', title: 'Strong Bull ', defval: 'rgba(0,137,123,1)', group: G[15], inline: 'panel_bull' },
  { id: 'panelColorWeakBull', type: 'color', title: 'Weak Bull  ', defval: 'rgba(38,166,154,1)', group: G[15], inline: 'panel_bull' },
  { id: 'panelColorStrongBear', type: 'color', title: 'Strong Bear', defval: 'rgba(229,57,53,1)', group: G[15], inline: 'panel_bear' },
  { id: 'panelColorWeakBear', type: 'color', title: 'Weak Bear', defval: 'rgba(239,83,80,1)', group: G[15], inline: 'panel_bear' },
  { id: 'panelColorEquilibrium', type: 'color', title: 'Equilibrium ', defval: 'rgba(245,124,0,1)', group: G[15], inline: 'panel_consolidation' },
  { id: 'panelColorNeutral', type: 'color', title: 'Neutral      ', defval: 'rgba(158,158,158,1)', group: G[15], inline: 'panel_consolidation' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Senkou Span A', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Senkou Span B', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Tenkan-Sen', color: '#007FFF', lineWidth: 1 },
  { id: 'plot3', title: 'Kijun-Sen', color: '#E53935', lineWidth: 1 },
  { id: 'plot4', title: 'Chikou Span (Fixed)', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'Ichimoku Kinko Hyo (一目均衡表)',
  shortTitle: 'Ichimoku Kinko Hyo (一目均衡表)',
  overlay: true,
};

type VolOsc = IchimokuKinkHyInputs['volOscType'];

/** indicator(max_lines_count = 500, max_labels_count = 500, max_boxes_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
const cnew = (c: string, t: number): string => String(color.new(c, t));
const WHITE = '#FFFFFF';

function sourceOf(bars: Bar[], name: SourceName): number[] {
  switch (name) {
    case 'open': return bars.map((b) => b.open);
    case 'high': return bars.map((b) => b.high);
    case 'low': return bars.map((b) => b.low);
    case 'hl2': return bars.map((b) => (b.high + b.low) / 2);
    case 'hlc3': return bars.map((b) => (b.high + b.low + b.close) / 3);
    case 'hlcc4': return bars.map((b) => (b.high + b.low + b.close + b.close) / 4);
    case 'ohlc4': return bars.map((b) => (b.open + b.high + b.low + b.close) / 4);
    case 'volume': return bars.map((b) => b.volume ?? NaN);
    default: return bars.map((b) => b.close);
  }
}

/** check_filters(): the value of the first enabled filter, AND the other enabled ones; false when none is enabled */
function checkFilters(enabled: boolean[], values: boolean[]): boolean {
  let result = false;
  for (let k = 0; k < enabled.length; k++) {
    if (enabled[k]) {
      result = values[k];
      break;
    }
  }
  for (let k = 0; k < enabled.length; k++) if (enabled[k]) result = result && values[k];
  return result;
}

/** calc_signal_strength(pos, uptrend) */
function signalStrength(pos: number, uptrend: boolean): number {
  if (uptrend) return pos === 1 ? 1 : pos === 0 ? 2 : 3;
  return pos === -1 ? -1 : pos === 0 ? -2 : -3;
}

interface SrZone {
  line?: Line;
  box?: Box;
  median?: Line;
  label?: Label;
  isRes: boolean;
  frozen: boolean;
  level: number;
  top: number;
  bot: number;
  leftX: number;
  firstTouched: boolean;
  broken: boolean;
  /** Retest confirmed on the bar before (price in contact with the zone) */
  inContact: boolean;
  medianBroken: boolean;
}

interface TkrZone {
  box?: Box;
  median?: Line;
  label?: Label;
  top: number;
  bot: number;
  start: number;
  dur: number;
  rangePct: number;
  active: boolean;
  brkDir: number;
  exitPx: number;
}

/**
 * N-wave price targets V, N, E, NT, 2E, 3E of the swing prices A, B, C. Pine evaluates `x + (y - z)` on series values
 * as `x + y - z` (measured: C + (B - A) gives 30.314999999999998 for 22.875, 27.5575, 25.6325, not 30.315): the
 * four sums are written in that order.
 */
function nTargets(a: number, b: number, c: number): number[] {
  return [b + b - c, c + b - a, b + b - a, c + c - a, b + 2 * (b - a), b + 3 * (b - a)];
}

/** SwingPoint (the bar time of the original is not used by any output) */
interface SwingPoint {
  barIdx: number;
  price: number;
  dir: number;
}

const KIHON_MODE: Record<IchimokuKinkHyInputs['kihonAnchor'], string> = {
  'Signals (▲▼)': 'Signal',
  'Tenkan Cross': 'TK Cross',
  'Kijun Cross': 'KJ Cross',
  'TK x KJ Cross': 'TKxKJ Cross',
  'Kumo Change': 'Kumo Change',
  'Swing Highs': 'Swing High',
  'Swing Lows': 'Swing Low',
  'Swings (H+L)': 'Swing',
  'Wave Completion': 'Wave',
};

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Signal: Bullish Reversal ▲', message: 'SIGNAL: Bullish Reversal — All Ichimoku filters aligned ▲ — {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert1', title: 'Signal: Bearish Reversal ▼', message: 'SIGNAL: Bearish Reversal — All Ichimoku filters aligned ▼ — {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert2', title: 'S/R: Zone Flipped (S↔R)', message: 'Ichimoku: S/R zone flipped type (Support ↔ Resistance) - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert3', title: 'S/R: Zone Retested', message: 'Ichimoku: S/R zone retested (price rejected at level) - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert4', title: 'S/R: Resistance Broken ↑', message: 'Ichimoku: Resistance broken upward (bullish breakout) - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert5', title: 'S/R: Support Broken ↓', message: 'Ichimoku: Support broken downward (bearish breakdown) - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert6', title: 'S/R: Median (Equilibrium) Crossed', message: 'Ichimoku: S/R equilibrium (median) crossed — Hosoda balance point breached - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert7', title: 'TK-Range: Bullish Breakout ↑', message: 'TK-RANGE BREAKOUT: Price broke ABOVE TK/KJ consolidation zone - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert8', title: 'TK-Range: Bearish Breakdown ↓', message: 'TK-RANGE BREAKDOWN: Price broke BELOW TK/KJ consolidation zone - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert9', title: 'TK-Range: Median (Equilibrium) Crossed', message: 'TK-RANGE MEDIAN: Equilibrium crossed within extended consolidation zone - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert10', title: 'Swing: High Detected', message: 'SWING HIGH detected - Structural pivot confirmed - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert11', title: 'Swing: Low Detected', message: 'SWING LOW detected - Structural pivot confirmed - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert12', title: 'Wave: Bullish Pattern Detected', message: 'WAVE THEORY: Bullish wave pattern completed (I/V/N/P/Y/W) - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert13', title: 'Wave: Bearish Pattern Detected', message: 'WAVE THEORY: Bearish wave pattern completed (I/V/N/P/Y/W) - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert14', title: 'Price Target: Bullish Target Reached ↑', message: 'PRICE THEORY: Bullish N-wave target reached (V/N/E/NT/2E/3E) - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert15', title: 'Price Target: Bearish Target Reached ↓', message: 'PRICE THEORY: Bearish N-wave target reached (V/N/E/NT/2E/3E) - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert16', title: 'Kihon: Time Cycle Window', message: 'KIHON SŪCHI: Time cycle window active (±1 bar) - Potential reversal timing - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert17', title: 'Taito: Time Symmetry Window', message: 'TAITO SŪCHI: Time symmetry projection reached (±1 bar) - Duration echo detected - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert18', title: 'TxP: Time Window with Active Targets', message: 'TIME x PRICE: Kihon/Taito window active with unreached price targets — watch for confluence - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert19', title: 'TxP: Bullish Confluence CONFIRMED ◆', message: 'TIME x PRICE CONFLUENCE CONFIRMED ◆ — Bullish target reached during time cycle window - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert20', title: 'TxP: Bearish Confluence CONFIRMED ◆', message: 'TIME x PRICE CONFLUENCE CONFIRMED ◆ — Bearish target reached during time cycle window - {{ticker}} {{interval}} @ {{close}}' },
  { id: 'alert21', title: 'Panel: Consensus Direction Changed', message: 'PANEL: CONSENSUS DIRECTION CHANGED - Check panel for new bias - {{ticker}} {{interval}} @ {{close}}' },
];

export function calculate(
  bars: Bar[],
  inputs: Partial<IchimokuKinkHyInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const mintick = mintickOf(chart);
  const fg = foregroundColorOf(chart);
  const open = bars.map((b) => b.open);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const close = bars.map((b) => b.close);
  const volume = bars.map((b) => b.volume ?? NaN);
  const ohlc4 = bars.map((b) => (b.open + b.high + b.low + b.close) / 4);
  const bullEv = cfg.bullEventColor;
  const bearEv = cfg.bearEventColor;
  const tick = (v: number) => str.tostring(v, 'mintick', mintick);
  const rtm = (v: number) => math.round_to_mintick(v, mintick);

  // ═══ § 1. Source and ATR ═══
  const haOpen: number[] = [];
  for (let i = 0; i < n; i++) {
    haOpen.push(i === 0 || isNaN(haOpen[i - 1]) ? (open[i] + close[i]) / 2 : (haOpen[i - 1] + ohlc4[i - 1]) / 2);
  }
  const srcPrice = sourceOf(bars, cfg.srcPrice);
  const alternative = bars.map((b, i) => {
    switch (cfg.altSourceFormula) {
      case '(open + close +3 * (high + low)) / 8': return (b.open + b.close + 3 * (b.high + b.low)) / 8;
      case 'close + high + low -2 * open': return b.close + b.high + b.low - 2 * b.open;
      case '(close +5 * (high + low) -7 * (open)) / 4': return (b.close + 5 * (b.high + b.low) - 7 * b.open) / 4;
      case '(open + close +5 * (high + low)) / 12': return (b.open + b.close + 5 * (b.high + b.low)) / 12;
      case '(close > open ? high : low)': return gt(b.close, b.open) ? b.high : b.low;
      case 'Heiken-Ashi': return gt(ohlc4[i], haOpen[i]) ? b.high : b.low;
      default: return srcPrice[i];
    }
  });
  const price = cfg.wmaSmoothing ? ta.swma(alternative) : alternative;
  const atr5 = ta.atr(5, high, low, close);
  const atr14 = ta.atr(14, high, low, close);
  const atrFast = ta.atr(cfg.atrFastLength, high, low, close);
  const atrSlow = ta.atr(cfg.atrSlowLength, high, low, close);

  // ═══ § 2. Volume and volatility ═══
  // calc_vol_oscillator(): every call computes all types with the same inputs, so one series per type is enough
  const oscillators = new Map<VolOsc, number[]>();
  const volOsc = (type: VolOsc): number[] => {
    const known = oscillators.get(type);
    if (known) return known;
    let r: number[];
    switch (type) {
      case 'TFS Volume Oscillator': {
        const len = cfg.volRatioLength;
        const flow = close.map((c, i) => (gt(c, open[i]) ? volume[i] : lt(c, open[i]) ? -volume[i] : 0));
        r = (math.sum(flow, len) as number[]).map((x) => x / len);
        break;
      }
      case 'On Balance Volume':
        r = ta.cum(close.map((c, i) => (i === 0 ? NaN : Math.sign(c - close[i - 1]) * volume[i])));
        break;
      case 'Klinger Volume Oscillator': {
        const xtrend = close.map((c, i) => (i > 0 && gt(c, close[i - 1]) ? volume[i] * 100 : -volume[i] * 100));
        const fast = ta.ema(xtrend, cfg.volFastLength);
        const slow = ta.ema(xtrend, cfg.volSlowLength);
        r = fast.map((x, i) => x - slow[i]);
        break;
      }
      case 'Cumulative Volume Oscillator': {
        // calc_volume_signal()
        const rate = (cond: boolean, tw: number, bw: number, body: number) => {
          const denom = tw + bw + body;
          return eq(denom, 0) ? 0.5 : 0.5 * (tw + bw + (cond ? 2 * body : 0)) / denom;
        };
        const delta = bars.map((b, i) => {
          const tw = b.high - Math.max(b.open, b.close);
          const bw = Math.min(b.open, b.close) - b.low;
          const body = Math.abs(b.close - b.open);
          const up = volume[i] * rate(le(b.open, b.close), tw, bw, body);
          const down = volume[i] * rate(gt(b.open, b.close), tw, bw, body);
          return ge(b.close, b.open) ? up : -down;
        });
        const cv = cfg.volRatioType === 'On Balance Volume' ? ta.obv(close, volume)
          : cfg.volRatioType === 'Cumulative Volume Delta' ? ta.cum(delta) : ta.pvt(close, volume);
        const e1 = ta.ema(cv, cfg.volEmaLength1);
        const e2 = ta.ema(cv, cfg.volEmaLength2);
        r = e1.map((x, i) => x - e2[i]);
        break;
      }
      default: {
        // calc_zone_oscillator()
        const vp = close.map((c, i) => (i > 0 && gt(c, close[i - 1]) ? volume[i] : i > 0 && lt(c, close[i - 1]) ? -volume[i] : 0));
        const denom = ta.ema(volume, cfg.volZoneLength);
        const numer = ta.ema(vp, cfg.volZoneLength);
        r = denom.map((d, i) => (eq(d, 0) ? 0 : 100 * (numer[i] / d)));
      }
    }
    oscillators.set(type, r);
    return r;
  };
  const thr = cfg.volPeakThreshold;
  const tkVol = volOsc(cfg.volOscTypeTk);
  const kjVol = volOsc(cfg.volOscTypeKj);
  const skVol = volOsc(cfg.volOscTypeSk);
  const chVol = volOsc(cfg.volOscTypeCh);
  const volSum = volOsc(cfg.volOscType);
  const atrActive = atrFast.map((x, i) => gt(x, atrSlow[i]));

  // calc_chikou_color(price, ch_filter_period, ...)
  const P = cfg.chFilterPeriod;
  const hhP = ta.highest(high, P);
  const llP = ta.lowest(low, P);
  const chikouColor: string[] = [];
  const chikouSig: number[] = [];
  for (let i = 0; i < n; i++) {
    const isUp = i >= P && gt(price[i], hhP[i - P]);
    const isDown = i >= P && lt(price[i], llP[i - P]);
    chikouColor.push(isDown ? cfg.chikouBearColor : isUp ? cfg.chikouBullColor : cfg.chikouNeutralColor);
    chikouSig.push(isUp ? 1 : isDown ? -1 : 0);
  }

  // ═══ § 3. Presets and adaptive lengths ═══
  const isAdaptiveMode = cfg.preset === 'Custom (Adaptive Lengths)';
  const chartAdaptive = isAdaptiveMode || cfg.presetPanelOnly;
  const presetIdx = ['Classic 9/26/52/26', '5D 8/22/44/22', 'Crypto 10/30/60/30', 'Slow 20/60/120/60'].indexOf(cfg.preset);
  const pick = (values: number[], custom: number) => (presetIdx >= 0 ? values[presetIdx] : custom);
  const eff = (values: number[], custom: number) => (chartAdaptive ? custom : pick(values, custom));
  const effTkMin = eff([9, 8, 10, 20], cfg.tkMinLength);
  const effTkMax = eff([30, 22, 30, 60], cfg.tkMaxLength);
  const effKjMin = eff([20, 22, 30, 60], cfg.kjMinLength);
  const effKjMax = eff([60, 44, 60, 120], cfg.kjMaxLength);
  const effSkMin = eff([50, 44, 60, 120], cfg.skMinLength);
  const effSkMax = eff([120, 88, 120, 240], cfg.skMaxLength);
  const effChMin = eff([26, 22, 30, 60], cfg.chMinLength);
  const effChMax = eff([50, 44, 60, 120], cfg.chMaxLength);
  const effOffset = eff([26, 22, 30, 60], cfg.skOffsetLength);
  const warmup = Math.max(effTkMax, effKjMax, effSkMax, effChMax, effOffset);
  const tkBase = pick([9, 8, 10, 20], cfg.tkMinLength);
  const kjBase = pick([26, 22, 30, 60], cfg.kjMinLength);
  const skBase = pick([52, 44, 60, 120], cfg.skMinLength);
  const chBase = pick([26, 22, 30, 60], cfg.chMinLength);
  const chikouAdaptive = cfg.chikouMode === 'Adaptive';

  const dyn = [NaN, NaN, NaN, NaN];
  const adapt = (id: number, para: boolean, pct: number, minL: number, maxL: number): number => {
    let m = dyn[id];
    if (isNaN(m)) m = (minL + maxL) / 2;
    // Expansion factor (2 - pct) mirrors contraction (pct)
    m = para ? Math.max(minL, m * pct) : Math.min(maxL, m * (2 - pct));
    dyn[id] = m;
    return Math.trunc(m);
  };
  const tkLen: number[] = [];
  const kjLen: number[] = [];
  const skLen: number[] = [];
  const chLen: number[] = [];
  for (let i = 0; i < n; i++) {
    const chUp = chikouSig[i] === 1;
    const tkRaw = adapt(0, checkFilters([cfg.tkVolFilter, cfg.tkAtrFilter, cfg.tkChikouFilter],
      [gt(tkVol[i], thr), atrActive[i], chUp]), cfg.tkDynPct / 100.0, effTkMin, effTkMax);
    const kjRaw = adapt(1, checkFilters([cfg.kjVolFilter, cfg.kjAtrFilter, cfg.kjChikouFilter],
      [gt(kjVol[i], thr), atrActive[i], chUp]), cfg.kjDynPct / 100.0, effKjMin, effKjMax);
    const skRaw = adapt(2, checkFilters([cfg.skVolFilter, cfg.skAtrFilter, cfg.skChikouFilter],
      [gt(skVol[i], thr), atrActive[i], chUp]), cfg.skDynPct / 100.0, effSkMin, effSkMax);
    const chRaw = adapt(3, checkFilters([cfg.chVolFilter, cfg.chAtrFilter, cfg.chTrendFilter],
      [gt(chVol[i], thr), atrActive[i], chUp]), cfg.chDynPct / 100.0, effChMin, effChMax);
    tkLen.push(chartAdaptive ? tkRaw : tkBase);
    kjLen.push(chartAdaptive ? kjRaw : kjBase);
    skLen.push(chartAdaptive ? skRaw : skBase);
    chLen.push(chartAdaptive ? chRaw : chBase);
  }
  // Effective Chikou offset: Fixed uses the preset offset, Adaptive the dynamic length
  const chOff = chLen.map((x) => (chikouAdaptive ? x : effOffset));

  // ═══ § 4. Lookback buffer and Donchian lines ═══
  // price_history_buffer: newest first, at most max(Chikou max, offset) + 200 values
  const bufMax = Math.max(effChMax, effOffset) + 200;
  const pastAt = (i: number, k: number) => (k >= 0 && k < Math.min(i + 1, bufMax) ? price[i - k] : NaN);
  const chikouPast = chOff.map((k, i) => pastAt(i, k));
  const chikouPastPrev = chOff.map((k, i) => pastAt(i, k - 1));
  const chikouBelowPast = chikouPast.map((p, i) => !isNaN(p) && lt(price[i], p));
  const chikouAbovePast = chikouPast.map((p, i) => !isNaN(p) && gt(price[i], p));

  // calc_donchian(len): one ta.lowest / ta.highest call site per call, with a length per bar
  const donchian = (lens: number[]): number[] => {
    const conv = lens.map((len) => Math.max(1, Math.trunc(len / cfg.lineDivider)));
    const lo = ta.lowest(low, lens);
    const hi = ta.highest(high, lens);
    const lo2 = ta.lowest(low, conv);
    const hi2 = ta.highest(high, conv);
    return lo.map((x, i) => ((x + hi[i]) / 2 + (lo2[i] + hi2[i]) / 2) / 2);
  };

  // ═══ § 5. Ichimoku core ═══
  const tenkan = donchian(tkLen);
  const kijun = donchian(kjLen);
  const senkouA = tenkan.map((x, i) => (x + kijun[i]) / 2);
  const skHi = ta.highest(high, skLen);
  const skLo = ta.lowest(low, skLen);
  const senkouB = skHi.map((x, i) => (x + skLo[i]) / 2);
  const off1 = effOffset - 1;
  const aPresent = senkouA.map((_, i) => (i >= off1 ? senkouA[i - off1] : NaN));
  const bPresent = senkouB.map((_, i) => (i >= off1 ? senkouB[i - off1] : NaN));
  const kumoTop = aPresent.map((a, i) => Math.max(a, bPresent[i]));
  const kumoBottom = aPresent.map((a, i) => Math.min(a, bPresent[i]));
  const momentum = chikouPastPrev.map((p, i) => (!isNaN(p) ? price[i] - p : NaN));
  const bearMomentum = momentum.map((m) => !isNaN(m) && lt(m, 0));
  const bullMomentum = momentum.map((m) => !isNaN(m) && gt(m, 0));
  // price_below_kumo uses kumo_top: being inside the Kumo is already a bearish bias
  const priceBelowKumo = price.map((p, i) => lt(p, kumoTop[i]));
  const priceAboveKumo = price.map((p, i) => gt(p, kumoTop[i]));

  // ═══ § 6. Market context and panel ═══
  // calc_trend_strength(14): ADX-like
  const trueRange = ta.tr(false, high, low, close);
  const plusDm = high.map((h, i) => (i > 0 && gt(h - high[i - 1], low[i - 1] - low[i]) ? Math.max(h - high[i - 1], 0) : 0));
  const minusDm = low.map((l, i) => (i > 0 && gt(low[i - 1] - l, high[i] - high[i - 1]) ? Math.max(low[i - 1] - l, 0) : 0));
  const trSmooth = ta.ema(trueRange, 14);
  const plusSmooth = ta.ema(plusDm, 14);
  const minusSmooth = ta.ema(minusDm, 14);
  const dx = trSmooth.map((t, i) => {
    const plusDi = gt(t, 0) ? 100 * plusSmooth[i] / t : 0;
    const minusDi = gt(t, 0) ? 100 * minusSmooth[i] / t : 0;
    const sumDi = plusDi + minusDi;
    return gt(sumDi, 0) ? 100 * Math.abs(plusDi - minusDi) / sumDi : 0;
  });
  const trendStrength = ta.ema(dx, 14);
  const notInConsolidation = kumoTop.map((top, i) => {
    if (!cfg.filterConsolidation) return true;
    const bot = kumoBottom[i];
    const base = Math.max(Math.abs(top), Math.abs(bot), mintick);
    const thickness = Math.abs(top - bot) / base * 100;
    return !(lt(thickness, 0.3) && lt(trendStrength[i], 20));
  });

  // get_panel_lengths(), clamped as calc_panel_scores()
  const panelLens: number[][] = presetIdx >= 0
    ? [[9, 26, 52, 26], [8, 22, 44, 22], [10, 30, 60, 30], [20, 60, 120, 60]][presetIdx].map((v) => new Array<number>(n).fill(v))
    : [tkLen, kjLen, skLen, chOff];
  const clamp = (x: number) => Math.max(1, Math.min(x, 4999));
  const useTk = panelLens[0].map(clamp);
  const useKj = panelLens[1].map(clamp);
  const useSk = panelLens[2].map(clamp);
  const useOff = panelLens[3].map((x) => clamp(x) - 1);
  const panelTenkan = donchian(useTk);
  const panelKijun = donchian(useKj);
  const panelSpanA = panelTenkan.map((x, i) => (x + panelKijun[i]) / 2);
  const pSkHi = ta.highest(high, useSk);
  const pSkLo = ta.lowest(low, useSk);
  const panelSpanB = pSkHi.map((x, i) => (x + pSkLo[i]) / 2);
  /** calc_panel_scores() on bar i: [score_1 .. score_5, consensus] */
  const panelScores = (i: number): number[] => {
    const off = useOff[i];
    const back = (a: number[]) => (i >= off ? a[i - off] : NaN);
    const kTop = Math.max(back(panelSpanA), back(panelSpanB));
    const kBot = Math.min(back(panelSpanA), back(panelSpanB));
    const tkTop = Math.max(panelTenkan[i], panelKijun[i]);
    const tkBot = Math.min(panelTenkan[i], panelKijun[i]);
    const tkPos = gt(tkBot, kTop) ? 1 : lt(tkTop, kBot) ? -1 : 0;
    const s1 = signalStrength(tkPos, gt(panelTenkan[i], panelKijun[i]));
    const kjPos = gt(panelKijun[i], kTop) ? 1 : lt(panelKijun[i], kBot) ? -1 : 0;
    const s2 = signalStrength(kjPos, gt(close[i], panelKijun[i]));
    const chTrend = gt(close[i], back(high)) ? 1 : lt(close[i], back(low)) ? -1 : 0;
    const chPos = gt(close[i], kTop) ? 1 : lt(close[i], kBot) ? -1 : 0;
    const s3 = chTrend === 1 ? signalStrength(chPos, true) : chTrend === -1 ? signalStrength(chPos, false) : 0;
    const s4 = gt(close[i], kTop) ? 1 : lt(close[i], kBot) ? -1 : 0;
    const s5 = signalStrength(s4, gt(panelSpanA[i], panelSpanB[i]));
    const all = [s1, s2, s3, s4, s5];
    const mx = Math.max(...all);
    const mn = Math.min(...all);
    return [s1, s2, s3, s4, s5, mn > 0 ? mx : mx < 0 ? mn : 0];
  };

  // ═══ § 7. Signals ═══
  const enabledFilters = [cfg.filterVolume, cfg.filterAtrVolatility, cfg.filterTkKjCross, cfg.filterMomentum,
    cfg.filterChikouVsPrice, cfg.filterPriceVsKumo, cfg.filterPriceVsTenkan, cfg.filterChikouTrend];
  const downConditions = (i: number) => [lt(volSum[i], thr), atrActive[i], lt(tenkan[i], kijun[i]), bearMomentum[i],
    chikouBelowPast[i], priceBelowKumo[i], lt(price[i], tenkan[i]), chikouSig[i] === -1];
  const upConditions = (i: number) => [gt(volSum[i], thr), atrActive[i], gt(tenkan[i], kijun[i]), bullMomentum[i],
    chikouAbovePast[i], priceAboveKumo[i], gt(price[i], tenkan[i]), chikouSig[i] === 1];
  const regimeArr: number[] = [];
  const flipBull: boolean[] = [];
  const flipBear: boolean[] = [];
  let regime = 0;
  let barsInRegime = 0;
  let prevBear = false;
  let prevBull = false;
  for (let i = 0; i < n; i++) {
    const tkEqual = eq(tenkan[i], kijun[i]);
    // TK Equal Rule: when TK == KJ, the previous bar gives the cross direction
    const bearCondition = ((tkEqual && i > 0 && gt(tenkan[i - 1], kijun[i - 1])) || checkFilters(enabledFilters, downConditions(i)))
      && notInConsolidation[i];
    const bullCondition = ((tkEqual && i > 0 && lt(tenkan[i - 1], kijun[i - 1])) || checkFilters(enabledFilters, upConditions(i)))
      && notInConsolidation[i];
    const warmedUp = i >= warmup;
    const signalShort = warmedUp && bearCondition && !prevBear;
    const signalLong = warmedUp && bullCondition && !prevBull;
    prevBear = bearCondition;
    prevBull = bullCondition;
    const before = i > 0 ? regimeArr[i - 1] : NaN;
    if (signalShort && regime >= 0) regime = -1;
    if (signalLong && regime <= 0) regime = 1;
    regimeArr.push(regime);
    flipBear.push(regime === -1 && !isNaN(before) && before !== -1);
    flipBull.push(regime === 1 && !isNaN(before) && before !== 1);
    barsInRegime = flipBull[i] || flipBear[i] ? 0 : barsInRegime + 1;
  }
  // 0.85 x ATR(5): offset of the signal markers
  const atrOffset = atr5.map((x) => 0.85 * x);

  // ═══ Drawings ═══
  resetDrawings({ line: MAX_OBJECTS, box: MAX_OBJECTS, label: MAX_OBJECTS });
  const lineMode = cfg.srZoneLayout === 'Line';
  const zoneMode = cfg.srZoneLayout === 'Zone';
  const medianPlacement = cfg.srZonePlacement === 'Median';
  const srLabelSize = cfg.srLabelSize === 'Tiny' ? 'tiny' : cfg.srLabelSize === 'Small' ? 'small' : 'normal';
  const swingLen = cfg.swingLength;
  const swingPh = ta.pivothigh(high, swingLen, swingLen);
  const swingPl = ta.pivotlow(low, swingLen, swingLen);
  const tkCross = ta.cross(close, tenkan);
  const kjCross = ta.cross(close, kijun);
  const tkKjCross = ta.cross(tenkan, kijun);
  const rangeHi = ta.highest(high, 300);
  const rangeLo = ta.lowest(low, 300);
  const kihonBasic = cfg.kihonRange === 'Basic (9/17/26)';
  const kihonFull = cfg.kihonRange === 'Full (+65→257)';
  const kihonCycles = (): number[] => {
    const cycles = [9, 17, 26];
    if (!kihonBasic) cycles.push(33, 42, 51);
    if (kihonFull) cycles.push(65, 76, 129, 172, 200, 257);
    return cycles;
  };
  const showPt = [cfg.priceTShowV, cfg.priceTShowN, cfg.priceTShowE, cfg.priceTShowNT, cfg.priceTShow2E, cfg.priceTShow3E];
  const ptColors = [cfg.priceTColorV, cfg.priceTColorN, cfg.priceTColorE, cfg.priceTColorNT, cfg.priceTColor2E, cfg.priceTColor3E];
  const PT_NAMES = ['V', 'N', 'E', 'NT', '2E', '3E'];

  // TK-Range state
  const tkrZones: TkrZone[] = [];
  let tkrConsec = 0;
  let tkrStart = NaN;
  let tkrHigh = NaN;
  let tkrLow = NaN;
  let tkrCreated = false;
  const tkrBox = varDrawing<Box>();
  const tkrMedian = varDrawing<Line>();
  const tkrLabel = varDrawing<Label>();
  // S/R state
  const srZones: SrZone[] = [];
  // Chikou (adaptive) state
  const chBufX: number[] = [];
  const chBufY: number[] = [];
  const chBufC: string[] = [];
  const chikouLines: Line[] = [];
  let chikouLastX = NaN;
  // TK / KJ labels of the last bar
  const tkLabelVar = varDrawing<Label>();
  const kjLabelVar = varDrawing<Label>();
  const mergedLabelVar = varDrawing<Label>();
  // Swings
  const swingPoints: SwingPoint[] = [];
  const swingLabels: Label[] = [];
  // Wave completion and price target tracker
  let lastWaveBar = -1;
  const ptAlert = [NaN, NaN, NaN, NaN, NaN, NaN];
  let ptAlertBias = 0;
  const ptReached = [false, false, false, false, false, false];
  // Kihon anchors (newest first)
  const kihonFlipBars: number[] = [];
  const kihonFlipDirs: number[] = [];
  let table1: Table | undefined;

  const tkrFormatLabel = (barsCount: number, isActive: boolean, dir: number, brkPct: number) => {
    const barsTxt = str.format('{0}b', barsCount);
    if (isActive) return barsTxt + ' • →';
    const dirTxt = dir === 1 ? '↑' : dir === -1 ? '↓' : '⇔';
    const core = str.format('{0} • {1}', barsTxt, dirTxt);
    if (cfg.tkrExtend && !isNaN(brkPct) && dir !== 0) {
      return core + ' ' + str.format('{0}{1}%', ge(brkPct, 0) ? '+' : '', math.round(brkPct, 2));
    }
    return core;
  };
  const tkrQuality = (pct: number) => (lt(pct, 75) ? 'Tight squeeze — explosive potential\n'
    : gt(pct, 100) ? 'Wide range — measured move likely\n' : '');
  const tkrActiveTip = (dur: number, quality: string, mid: number) => str.format(
    'TK-Range Consolidation (ACTIVE)\n\nDuration: {0} bars\n{1}\nMedian: {2}\n⟷ Watch for breakout direction', dur, quality, tick(mid));
  const tkrUpdateLabel = (lbl: Label | undefined, x: number, top: number, bot: number, dur: number, rangePct: number,
    isActive: boolean, dir: number, brkPct: number, exitPx: number) => {
    if (!lbl) return;
    const mid = (top + bot) / 2;
    label.set_xy(lbl, x, mid);
    label.set_text(lbl, tkrFormatLabel(dur, isActive, dir, brkPct));
    const quality = tkrQuality(rangePct);
    const medianStr = tick(mid);
    let tip: string;
    if (isActive) tip = tkrActiveTip(dur, quality, mid);
    else if (dir === 0) {
      tip = str.format('TK-Range Consolidation (CONVERGED)\n\nDuration: {0} bars\n{1}\nMedian: {2}\nEXIT: TK/KJ spread collapsed — no directional breakout',
        dur, quality, medianStr);
    } else {
      const moveStr = str.format('{0}{1}%', ge(brkPct, 0) ? '+' : '', math.round(brkPct, 2));
      tip = str.format('TK-Range Consolidation (COMPLETED)\n\nDuration: {0} bars\n{1}\nMedian: {2}\nBREAKOUT\nDirection: {3}\nPrice: {4}\nMove: {5}',
        dur, quality, medianStr, dir === 1 ? '↑ Bullish' : '↓ Bearish', tick(exitPx), moveStr);
    }
    label.set_tooltip(lbl, tip);
  };
  const tkrDeleteZone = (idx: number) => {
    if (idx < 0 || idx >= tkrZones.length) return;
    const z = tkrZones[idx];
    if (z.box) box.delete(z.box);
    if (z.median) line.delete(z.median);
    if (z.label) label.delete(z.label);
    tkrZones.splice(idx, 1);
  };
  const tkrMerge = (i: number, atr: number) => {
    if (!(cfg.tkrExtend && tkrZones.length > 1)) return;
    let merged = true;
    let iterations = 0;
    // Max 5 cascade passes
    while (merged && iterations < 5) {
      merged = false;
      iterations += 1;
      const sz = tkrZones.length;
      if (sz <= 1) continue;
      const a = sz - 1;
      const zi = tkrZones[a];
      const topI = zi.top;
      const botI = zi.bot;
      for (let j = a - 1; j >= 0; j--) {
        if (j >= tkrZones.length) continue;
        const zj = tkrZones[j];
        if (!(ge(topI, zj.bot) && le(botI, zj.top))) continue;
        // Merge j into i (i is more recent: its breakout direction is kept)
        const newTop = Math.max(topI, zj.top);
        const newBot = Math.min(botI, zj.bot);
        const newDur = Math.max(zi.dur, zj.dur);
        const newPct = gt(atr, 0) ? (newTop - newBot) / atr * 100 : 50;
        zi.top = newTop;
        zi.bot = newBot;
        zi.dur = newDur;
        zi.rangePct = newPct;
        const earliest = Math.min(zi.start, zj.start);
        zi.start = earliest;
        if (zi.box) {
          box.set_top(zi.box, newTop);
          box.set_bottom(zi.box, newBot);
          box.set_left(zi.box, earliest);
        }
        if (cfg.tkrShowMedian && zi.median) {
          const newMid = (newTop + newBot) / 2;
          line.set_y1(zi.median, newMid);
          line.set_y2(zi.median, newMid);
          line.set_x1(zi.median, earliest);
        }
        if (cfg.tkrShowLabel) {
          let brk = 0;
          if (!zi.active && !isNaN(zi.exitPx) && gt(zi.exitPx, 0)) {
            if (zi.brkDir === 1 && gt(newTop, 0)) brk = (close[i] - newTop) / newTop * 100;
            else if (zi.brkDir === -1 && gt(newBot, 0)) brk = (newBot - close[i]) / newBot * 100;
          }
          tkrUpdateLabel(zi.label, Math.trunc((earliest + i) / 2), newTop, newBot, newDur, newPct, zi.active, zi.brkDir, brk, zi.exitPx);
        }
        tkrDeleteZone(j);
        merged = true;
        break;
      }
    }
  };

  // A zone sets its label text again on every bar: each level is formatted once (0 is not kept, as -0 is the same key)
  const srTexts = [new Map<number, string>(), new Map<number, string>()];
  const srText = (isRes: boolean, level: number) => {
    const memo = srTexts[isRes ? 0 : 1];
    let text = memo.get(level);
    if (text === undefined) {
      text = str.format('{0} • {1}', isRes ? 'R' : 'S', rtm(level));
      if (level !== 0) memo.set(level, text);
    }
    return text;
  };
  const deleteSrZone = (idx: number) => {
    const z = srZones[idx];
    if (z.line) line.delete(z.line);
    if (z.box) box.delete(z.box);
    if (z.median) line.delete(z.median);
    if (z.label) label.delete(z.label);
    srZones.splice(idx, 1);
  };
  const createSrZone = (i: number, isRes: boolean) => {
    const b = bars[i];
    let level: number;
    let top: number;
    let bot: number;
    if (cfg.srZonePlacement === 'Wick') {
      level = isRes ? b.high : b.low;
      top = b.high;
      bot = b.low;
    } else if (cfg.srZonePlacement === 'Body') {
      level = isRes ? Math.max(b.open, b.close) : Math.min(b.open, b.close);
      top = Math.max(b.open, b.close);
      bot = Math.min(b.open, b.close);
    } else {
      level = (b.high + b.low) / 2;
      top = b.high;
      bot = b.low;
    }
    const zc = isRes ? bearEv : bullEv;
    const z: SrZone = {
      isRes, frozen: false, level, top, bot, leftX: i, firstTouched: false, broken: false, inContact: false, medianBroken: false,
    };
    if (lineMode) z.line = line.new(i, level, i, level, 'bar_index', undefined, zc, 'solid', cfg.srZoneWidth);
    if (zoneMode) {
      z.box = box.new(i, top, i, bot, zc, cfg.srZoneWidth, undefined, undefined, 'bar_index', cnew(zc, 100), undefined, undefined, WHITE);
      const my = (top + bot) / 2;
      z.median = line.new(i, my, i, my, 'bar_index', undefined, zc, 'dotted', cfg.srZoneWidth);
    }
    if (cfg.srShowLabels) {
      z.label = label.new(i, level, srText(isRes, level), 'bar_index', undefined, cnew(zc, 100), 'label_left', zc, srLabelSize);
    }
    srZones.push(z);
  };
  /**
   * update_sr_zones(): the zones on bar i; gives the original's flags [resistance broken up, support broken down,
   * median crossed up, median crossed down, zone flipped, zone retested]
   */
  const updateSrZones = (i: number): boolean[] => {
    let resBrokenUp = false;
    let supBrokenDown = false;
    let medCrossedUp = false;
    let medCrossedDown = false;
    let zoneFlipped = false;
    let zoneRetested = false;
    const c = close[i];
    const c1 = i > 0 ? close[i - 1] : NaN;
    const frozenOffset = atrSlow[i] * 0.5;
    const byLevel = lineMode || medianPlacement;
    const sz = cfg.srEnabled ? srZones.length : 0;
    for (let k = sz - 1; k >= 0; k--) {
      const z = srZones[k];
      let isRes = z.isRes;
      const wasFrozen = z.frozen;
      let level = z.level;
      const { top, bot, leftX } = z;
      const wasContact = z.inContact;
      let wasTouched = z.firstTouched;
      const wasBroken = z.broken;
      const wasMedBroken = z.medianBroken;
      let zoneColor = isRes ? bearEv : bullEv;
      const fresh = i === leftX;
      let justBroke = false;
      let justFlipped = false;
      // STEP 1: breakout (a zone born beyond the price is reconciled silently: no alert)
      if (!fresh && !wasBroken) {
        let brokeUp = false;
        let isCatchup = false;
        if (byLevel) {
          if (isRes && gt(c, level) && le(c1, level)) {
            justBroke = true;
            brokeUp = true;
          } else if (!isRes && lt(c, level) && ge(c1, level)) justBroke = true;
        } else if (isRes && gt(c, top) && le(c1, top)) {
          justBroke = true;
          brokeUp = true;
        } else if (!isRes && lt(c, bot) && ge(c1, bot)) justBroke = true;
        if (!justBroke) {
          const beyond = byLevel ? (isRes ? gt(c, level) : lt(c, level)) : (isRes ? gt(c, top) : lt(c, bot));
          if (beyond) {
            justBroke = true;
            brokeUp = isRes;
            isCatchup = true;
          }
        }
        if (justBroke) {
          if (!isCatchup) {
            if (brokeUp) resBrokenUp = true;
            else supBrokenDown = true;
            // In Zone + Median the breakout is the median crossing
            if (zoneMode && medianPlacement) {
              if (brokeUp) medCrossedUp = true;
              else medCrossedDown = true;
              z.medianBroken = true;
            }
          }
          if (cfg.srFlipEnabled) {
            z.isRes = !isRes;
            isRes = !isRes;
            if (!medianPlacement) {
              level = isRes ? top : bot;
              z.level = level;
              if (lineMode && z.line) {
                line.set_y1(z.line, level);
                line.set_y2(z.line, level);
              }
            }
            zoneColor = isRes ? bearEv : bullEv;
            justFlipped = true;
            zoneFlipped = true;
            z.frozen = false;
            z.firstTouched = false;
            z.medianBroken = false;
            z.inContact = true;
            if (z.label) {
              label.set_text(z.label, srText(z.isRes, level));
              label.set_textcolor(z.label, zoneColor);
              label.set_y(z.label, level);
            }
          } else {
            z.broken = true;
          }
        }
      }
      // STEP 2: retest (wick touches the level / entry lip, close rejects), only without a break
      let retest = false;
      if (!justBroke && !fresh && !wasBroken) {
        retest = byLevel
          ? (isRes ? ge(high[i], level) && lt(c, level) : le(low[i], level) && gt(c, level))
          : (isRes ? ge(high[i], bot) && lt(c, bot) : le(low[i], top) && gt(c, top));
      }
      // STEP 3: first touch (wick reaches the zone)
      let justTouched = false;
      if (!fresh && !wasBroken && !wasTouched) {
        justTouched = byLevel ? (isRes ? ge(high[i], level) : le(low[i], level)) : (isRes ? ge(high[i], bot) : le(low[i], top));
      }
      if (justTouched) {
        z.firstTouched = true;
        wasTouched = true;
      }
      // Freeze on first touch (Extend OFF only)
      if (!cfg.srExtend && justTouched) z.frozen = true;
      if (wasTouched && retest && !wasContact && !z.frozen && !justTouched) zoneRetested = true;
      z.inContact = retest;
      // STEP 4: median crossing (Zone layout)
      if (zoneMode && !fresh && !wasBroken && !wasMedBroken && !justBroke) {
        const my = (top + bot) / 2;
        if (gt(c, my) && le(c1, my)) {
          medCrossedUp = true;
          z.medianBroken = true;
        } else if (lt(c, my) && ge(c1, my)) {
          medCrossedDown = true;
          z.medianBroken = true;
        }
      }
      const nowFrozen = z.frozen;
      const shouldExtend = !nowFrozen || justFlipped || justTouched;
      if (z.line) {
        if (shouldExtend) line.set_x2(z.line, i);
        line.set_color(z.line, zoneColor);
      }
      if (z.box) {
        if (shouldExtend) box.set_right(z.box, i);
        box.set_border_color(z.box, zoneColor);
        box.set_bgcolor(z.box, cnew(zoneColor, 100));
      }
      if (z.median) {
        if (shouldExtend) line.set_x2(z.median, i);
        line.set_color(z.median, zoneColor);
      }
      const lb = z.label;
      if (lb) {
        if (justFlipped && wasFrozen) {
          label.set_x(lb, i);
          label.set_y(lb, level);
          label.set_style(lb, 'label_left');
          label.set_textcolor(lb, zoneColor);
          label.set_text(lb, srText(isRes, level));
        } else if (nowFrozen && !wasFrozen) {
          const centerX = leftX + Math.trunc(Math.round((i - leftX) * 0.5));
          label.set_x(lb, centerX);
          label.set_y(lb, isRes ? level + frozenOffset : level - frozenOffset);
          label.set_style(lb, isRes ? 'label_down' : 'label_up');
          label.set_textcolor(lb, zoneColor);
          label.set_text(lb, srText(isRes, level));
        } else if (!nowFrozen) {
          label.set_x(lb, i);
          label.set_y(lb, level);
          label.set_textcolor(lb, zoneColor);
          label.set_text(lb, srText(isRes, level));
        } else {
          label.set_textcolor(lb, zoneColor);
          label.set_y(lb, isRes ? level + frozenOffset : level - frozenOffset);
          label.set_text(lb, srText(isRes, level));
        }
      }
    }
    return [resBrokenUp, supBrokenDown, medCrossedUp, medCrossedDown, zoneFlipped, zoneRetested];
  };

  const waveColor = (tag: string) => {
    switch (tag) {
      case 'I': return cfg.waveColorI;
      case 'V': return cfg.waveColorV;
      case 'N': return cfg.waveColorN;
      case 'P': return cfg.waveColorP;
      case 'Y': return cfg.waveColorY;
      case 'W': return cfg.waveColorW;
      default: return '#787B86';
    }
  };
  const WAVE_DESC: Record<string, string> = {
    I: 'Impulse — single directional leg (A→B)',
    V: 'Return — price returns near origin (A→B→C ≈ A)',
    N: 'Continuation — impulse, correction, continuation (A→B→C→D exceeds B)',
    P: 'Converging triangle — narrowing range (compression)',
    Y: 'Expanding triangle — widening range (expansion)',
    W: 'Double formation — repeating structure (A≈C≈E, B≈D)',
  };
  const WAVE_STRUCTURE: Record<string, string> = {
    I: 'A→B: impulse',
    V: 'A→B: impulse | B→C: return to A',
    N: 'A→B: impulse | B→C: correction | C→D: continuation',
    P: 'A-C: contracting | B-D: contracting',
    Y: 'A-C: expanding | B-D: expanding',
    W: 'A→B→C→D→E: double pattern',
  };
  const waveTooltip = (tag: string, bias: number, ampPct: number, duration: number) => str.format(
    'Wave {0} ({1})\n{2}\n\nStructure: {3}\nDuration: {4} bars | Amplitude: {5}%',
    tag, bias === 1 ? '▲ Bullish' : '▼ Bearish', WAVE_DESC[tag] ?? '', WAVE_STRUCTURE[tag] ?? '', duration, str.tostring(ampPct, '#.#'));
  /** N wave of the points A, B, C, D: 1 bullish, -1 bearish, 0 none (20 % of the A-B leg as tolerance) */
  const nWave = (A: SwingPoint, B: SwingPoint, C: SwingPoint, D: SwingPoint) => {
    const th = Math.abs(A.price - B.price) * 0.2;
    const isBull = lt(A.price, B.price) && gt(C.price, A.price + th) && lt(C.price, B.price - th) && gt(D.price, B.price + th);
    const isBear = gt(A.price, B.price) && lt(C.price, A.price - th) && gt(C.price, B.price + th) && lt(D.price, B.price - th);
    return isBull ? 1 : isBear ? -1 : 0;
  };

  const timeLineTop = rangeHi.map((x, i) => x + atr14[i] * 1.5);
  const timeLineBot = rangeLo.map((x, i) => x - atr14[i] * 1.5);
  const reservedLines = (cfg.srEnabled ? cfg.srMaxZones * (zoneMode ? 2 : 1) : 0)
    + (cfg.tkrEnabled && cfg.tkrShowMedian ? cfg.tkrMaxHistory : 0)
    + (cfg.waveEnabled ? 30 : 0)
    + (cfg.priceTEnabled ? 12 : 0)
    + (cfg.kihonEnabled ? cfg.kihonHistory * (kihonBasic ? 3 : kihonFull ? 12 : 6) : 0)
    + (cfg.taitoEnabled ? cfg.taitoCount * (1 + cfg.taitoHarmonics * 2) : 0)
    + 20;
  const maxChikouLines = Math.max(50, 500 - reservedLines);

  // Alert flags per bar, in the original's declaration order (alert0 .. alert21)
  const af: boolean[][] = alertConditions.map(() => new Array<boolean>(n).fill(false));
  // TK-Range state of the bar before: consecutive bars inside, top and bottom of the TK / KJ band
  let tkrConsecPrev = 0;
  let tkrTopPrev = NaN;
  let tkrBotPrev = NaN;

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    setDrawingBar(i, isLast);
    const c = close[i];
    const tk = tenkan[i];
    const kj = kijun[i];

    // ═══ § 9. TK-Range ═══
    // tkr_inside / tkr_top / tkr_bot are series of every bar (the breakout alerts read them)
    const tkrHave = !isNaN(tk) && !isNaN(kj);
    const tkrTopNow = tkrHave ? Math.max(tk, kj) : NaN;
    const tkrBotNow = tkrHave ? Math.min(tk, kj) : NaN;
    const tkrInsideNow = tkrHave && ge(Math.abs(tk - kj), atr14[i] * 0.10) && ge(c, tkrBotNow - mintick * 0.5)
      && le(c, tkrTopNow + mintick * 0.5);
    if (cfg.tkrEnabled) {
      const haveLines = !isNaN(tk) && !isNaN(kj);
      const top = haveLines ? Math.max(tk, kj) : NaN;
      const bot = haveLines ? Math.min(tk, kj) : NaN;
      const spread = haveLines ? Math.abs(tk - kj) : NaN;
      const rangePct = gt(atr14[i], 0) && !isNaN(spread) ? spread / atr14[i] * 100 : 50;
      const tolerance = mintick * 0.5;
      const inside = haveLines && ge(spread, atr14[i] * 0.10) && ge(c, bot - tolerance) && le(c, top + tolerance);
      if (inside) {
        tkrConsec += 1;
        if (tkrConsec === 1) {
          tkrStart = i;
          tkrHigh = top;
          tkrLow = bot;
          tkrCreated = false;
        } else {
          tkrHigh = Math.max(tkrHigh, top);
          tkrLow = Math.min(tkrLow, bot);
        }
        if (tkrConsec >= cfg.tkrMinBars) {
          if (!tkrCreated) {
            // a box without a text colour has white text in v6
            tkrBox.value = box.new(tkrStart, tkrHigh, i, tkrLow, cnew(cfg.tkrColor, 45), 1, 'dotted', undefined, 'bar_index', cfg.tkrColor,
              undefined, undefined, WHITE);
            if (cfg.tkrShowMedian) {
              const my = (tkrHigh + tkrLow) / 2;
              tkrMedian.value = line.new(tkrStart, my, i, my, 'bar_index', undefined, cnew(cfg.tkrColor, 35), 'dotted', 1);
            }
            if (cfg.tkrShowLabel) {
              const ly = (tkrHigh + tkrLow) / 2;
              tkrLabel.value = label.new(Math.trunc((tkrStart + i) / 2), ly, tkrFormatLabel(tkrConsec, true, 0, 0), 'bar_index', 'price',
                cnew(cfg.tkrColor, 90), 'label_center', fg, 'small', undefined, tkrActiveTip(tkrConsec, tkrQuality(rangePct), ly));
            }
            tkrCreated = true;
            tkrZones.push({ box: tkrBox.value, median: tkrMedian.value, label: tkrLabel.value, top: tkrHigh, bot: tkrLow,
              start: tkrStart, dur: tkrConsec, rangePct, active: true, brkDir: 0, exitPx: NaN });
            while (tkrZones.length > cfg.tkrMaxHistory) tkrDeleteZone(0);
          } else {
            if (tkrBox.value) {
              box.set_right(tkrBox.value, i);
              box.set_top(tkrBox.value, tkrHigh);
              box.set_bottom(tkrBox.value, tkrLow);
            }
            if (cfg.tkrShowMedian && tkrMedian.value) {
              const my = (tkrHigh + tkrLow) / 2;
              line.set_x2(tkrMedian.value, i);
              line.set_y1(tkrMedian.value, my);
              line.set_y2(tkrMedian.value, my);
            }
            if (cfg.tkrShowLabel && tkrLabel.value) {
              const ly = (tkrHigh + tkrLow) / 2;
              label.set_xy(tkrLabel.value, Math.trunc((tkrStart + i) / 2), ly);
              label.set_text(tkrLabel.value, tkrFormatLabel(tkrConsec, true, 0, 0));
              label.set_tooltip(tkrLabel.value, tkrActiveTip(tkrConsec, tkrQuality(rangePct), ly));
            }
            const last = tkrZones[tkrZones.length - 1];
            if (last) {
              last.dur = tkrConsec;
              last.top = tkrHigh;
              last.bot = tkrLow;
              last.rangePct = rangePct;
            }
          }
        }
      } else {
        if (tkrCreated) {
          const z = tkrZones[tkrZones.length - 1];
          if (z) {
            z.active = false;
            // Breakout direction (definitive); 0 = TK / KJ convergence exit
            const dir = ge(c, z.top) ? 1 : le(c, z.bot) ? -1 : 0;
            z.brkDir = dir;
            z.exitPx = dir !== 0 ? c : NaN;
            if (cfg.tkrShowLabel && z.label) {
              let brk = 0;
              if (dir === 1 && gt(z.top, 0)) brk = (c - z.top) / z.top * 100;
              else if (dir === -1 && gt(z.bot, 0)) brk = (z.bot - c) / z.bot * 100;
              tkrUpdateLabel(z.label, Math.trunc((z.start + i) / 2), z.top, z.bot, z.dur, z.rangePct, false, dir, brk, c);
            }
          }
        }
        tkrConsec = 0;
        tkrStart = NaN;
        tkrHigh = NaN;
        tkrLow = NaN;
        tkrCreated = false;
        tkrBox.value = undefined;
        tkrMedian.value = undefined;
        tkrLabel.value = undefined;
      }
      if (cfg.tkrExtend) {
        // ATR distance pruning of the inactive zones (radius: max zones x 3 ATR)
        if (gt(atr14[i], 0) && tkrZones.length > 0) {
          const radius = cfg.tkrMaxHistory * 3.0 * atr14[i];
          for (let k = tkrZones.length - 1; k >= 0; k--) {
            const z = tkrZones[k];
            if (k < tkrZones.length && !z.active && gt(Math.abs(c - (z.top + z.bot) / 2), radius)) tkrDeleteZone(k);
          }
        }
        for (const z of tkrZones) {
          if (z.active) continue;
          if (z.box) box.set_right(z.box, i);
          if (cfg.tkrShowMedian && z.median) line.set_x2(z.median, i);
          if (cfg.tkrShowLabel && z.label) {
            let brk = 0;
            if (!isNaN(z.exitPx) && gt(z.exitPx, 0)) {
              if (z.brkDir === 1 && gt(z.top, 0)) brk = (c - z.top) / z.top * 100;
              else if (z.brkDir === -1 && gt(z.bot, 0)) brk = (z.bot - c) / z.bot * 100;
            }
            tkrUpdateLabel(z.label, Math.trunc((z.start + i) / 2), z.top, z.bot, z.dur, z.rangePct, false, z.brkDir, brk, z.exitPx);
          }
        }
        tkrMerge(i, atr14[i]);
      }
    }
    // TK-Range breakout and median crossing alerts
    {
      const wasInside = tkrConsecPrev >= cfg.tkrMinBars;
      af[7][i] = wasInside && !tkrInsideNow && gt(c, tkrTopPrev);
      af[8][i] = wasInside && !tkrInsideNow && lt(c, tkrBotPrev);
      let medUp = false;
      let medDown = false;
      if (cfg.tkrEnabled && cfg.tkrExtend && cfg.tkrShowMedian) {
        const c1 = i > 0 ? close[i - 1] : NaN;
        for (const z of tkrZones) {
          if (z.active) continue;
          const mid = (z.top + z.bot) / 2;
          if (ge(c, z.bot) && le(c, z.top)) {
            if (gt(c, mid) && le(c1, mid)) medUp = true;
            if (lt(c, mid) && ge(c1, mid)) medDown = true;
          }
        }
      }
      af[9][i] = cfg.tkrExtend && (medUp || medDown);
      tkrConsecPrev = tkrConsec;
      tkrTopPrev = tkrTopNow;
      tkrBotPrev = tkrBotNow;
    }

    // ═══ § 10. Support & resistance ═══
    if (cfg.srEnabled) {
      if (flipBull[i]) createSrZone(i, false);
      if (flipBear[i]) createSrZone(i, true);
    }
    const srFlags = updateSrZones(i);
    af[0][i] = flipBull[i];
    af[1][i] = flipBear[i];
    af[2][i] = srFlags[4];
    af[3][i] = srFlags[5];
    af[4][i] = srFlags[0];
    af[5][i] = srFlags[1];
    af[6][i] = zoneMode && (srFlags[2] || srFlags[3]);
    // ATR distance pruning (radius max zones x 1.5 slow ATR)
    const srMaxDist = atrSlow[i] * (cfg.srMaxZones * 1.5);
    if (cfg.srEnabled && srZones.length > 0 && !isNaN(srMaxDist) && gt(srMaxDist, 0)) {
      for (let k = srZones.length - 1; k >= 0; k--) {
        if (gt(Math.abs(c - srZones[k].level), srMaxDist)) deleteSrZone(k);
      }
    }
    // Quota: the oldest zone of the over-represented type (or the oldest one) goes first
    if (cfg.srEnabled) {
      while (srZones.length > cfg.srMaxZones) {
        const resCount = srZones.filter((z) => z.isRes).length;
        const supCount = srZones.length - resCount;
        const evictRes = resCount > supCount;
        const evictSup = supCount > resCount;
        let oldIdx = -1;
        let oldBar = i;
        srZones.forEach((z, k) => {
          if ((evictRes && !z.isRes) || (evictSup && z.isRes)) return;
          if (z.leftX < oldBar) {
            oldBar = z.leftX;
            oldIdx = k;
          }
        });
        deleteSrZone(oldIdx === -1 ? 0 : oldIdx);
      }
    }

    // ═══ § 11. Chikou span (adaptive: line segments) ═══
    if (chikouAdaptive && cfg.showChikou) {
      const cx = i - chLen[i];
      const cy = price[i];
      const cc = chikouColor[i];
      chBufX.push(cx);
      chBufY.push(cy);
      chBufC.push(cc);
      while (chBufX.length > 1000) {
        chBufX.shift();
        chBufY.shift();
        chBufC.shift();
      }
      if (isNaN(chikouLastX) || cx > chikouLastX) {
        // Best previous point: the largest x below the current one (the Pine loop over a one-point buffer reads
        // the current point only)
        let bestIdx = -1;
        let bestX = NaN;
        for (let k = 0; k <= chBufX.length - 2; k++) {
          const x = chBufX[k];
          if (x < cx && (isNaN(bestX) || x > bestX)) {
            bestX = x;
            bestIdx = k;
          }
        }
        // Gap of 10 bars or less: connect the points
        if (bestIdx >= 0 && cx - bestX <= 10) {
          chikouLines.push(line.new(bestX, chBufY[bestIdx], cx, cy, undefined, undefined, cc, undefined, cfg.chikouLinewidth));
        }
        chikouLastX = cx;
        while (chikouLines.length > maxChikouLines) line.delete(chikouLines.shift()!);
      }
    } else {
      for (const l of chikouLines) line.delete(l);
      chikouLines.length = 0;
      chBufX.length = 0;
      chBufY.length = 0;
      chBufC.length = 0;
      chikouLastX = NaN;
    }

    // ═══ § 12. TK / KJ price labels ═══
    if (cfg.showPriceLabels && isLast) {
      for (const v of [tkLabelVar, kjLabelVar, mergedLabelVar]) if (v.value) label.delete(v.value);
      const spread = ne(kj, 0) ? (tk - kj) / kj * 100 : 0;
      const spreadStr = str.format('{0}{1}%', ge(spread, 0) ? '+' : '', str.tostring(spread, '#.##'));
      const tk1 = i > 0 ? tenkan[i - 1] : NaN;
      const kj1 = i > 0 ? kijun[i - 1] : NaN;
      const tkDir = gt(tk, tk1) ? '↗' : lt(tk, tk1) ? '↘' : '→';
      const kjDir = gt(kj, kj1) ? '↗' : lt(kj, kj1) ? '↘' : '→';
      const aboveTk = gt(c, tk);
      const aboveKj = gt(c, kj);
      const tkDist = ne(tk, 0) ? (c - tk) / tk * 100 : 0;
      const kjDist = ne(kj, 0) ? (c - kj) / kj * 100 : 0;
      const isEquilibrium = le(Math.abs(tk - kj), mintick);
      const tkBg = isEquilibrium ? cfg.tkkjLabelNeutralColor : aboveTk ? cfg.tkkjLabelBullColor : cfg.tkkjLabelBearColor;
      const kjBg = isEquilibrium ? cfg.tkkjLabelNeutralColor : aboveKj ? cfg.tkkjLabelBullColor : cfg.tkkjLabelBearColor;
      const trendText = (d: string) => (d === '↗' ? 'Rising ↗' : d === '↘' ? 'Falling ↘' : 'Flat →');
      const posText = (above: boolean) => (above ? '▲ Above (Support)' : '▼ Below (Resistance)');
      const state = gt(tk, kj) ? 'TK > KJ — ▲ Bullish' : lt(tk, kj) ? 'TK < KJ — ▼ Bearish' : 'TK = KJ — → Flat';
      const lineTip = (name: string, v: number, dist: number, above: boolean, d: string) => str.format(
        name + '\n{0}\n\nPOSITION\nDistance: {1}%\nPrice is {2}\n\nCONTEXT\nTrend: {3}\nSpread: {4}\nTK vs KJ: {5}',
        str.tostring(rtm(v)), str.tostring(dist, '#.##'), posText(above), trendText(d), spreadStr, state);
      if (isEquilibrium && cfg.showTenkan && cfg.showKijun) {
        const mp = (tk + kj) / 2;
        const mergedTip = str.format('EQUILIBRIUM\nTK ≈ KJ\n\nLEVELS\nTenkan: {0}\nKijun: {1}\nSpread: {2}\n\nINSIGHT\n⇄ Lines converged — Loss of momentum\nWatch for breakout or reversal',
          str.tostring(rtm(tk)), str.tostring(rtm(kj)), spreadStr);
        mergedLabelVar.value = label.new(i, mp, str.format('TK≈KJ {0} {1}', tkDir === kjDir ? tkDir : '⇄', rtm(mp)), undefined, undefined,
          cfg.tkkjLabelNeutralColor, 'label_left', fg, 'small', undefined, mergedTip);
      } else {
        if (cfg.showTenkan) {
          tkLabelVar.value = label.new(i, tk, str.format('TK {0} {1} ({2})', tkDir, rtm(tk), spreadStr), undefined, undefined,
            tkBg, 'label_left', fg, 'small', undefined, lineTip('TENKAN-SEN', tk, tkDist, aboveTk, tkDir));
        }
        if (cfg.showKijun) {
          const kjDistStr = str.format('{0}{1}%', ge(kjDist, 0) ? '+' : '', str.tostring(kjDist, '#.##'));
          kjLabelVar.value = label.new(i, kj, str.format('KJ {0} {1} [{2}]', kjDir, rtm(kj), kjDistStr), undefined, undefined,
            kjBg, 'label_left', fg, 'small', undefined, lineTip('KIJUN-SEN', kj, kjDist, aboveKj, kjDir));
        }
      }
    }

    // ═══ § 13. Swing detection ═══
    const ph = swingPh[i];
    const pl = swingPl[i];
    af[10][i] = cfg.swingEnabled && !isNaN(ph);
    af[11][i] = cfg.swingEnabled && !isNaN(pl);
    if (cfg.swingEnabled) {
      const swingBar = i - swingLen;
      // Consecutive pivots of one side: keep the highest high / lowest low
      if (!isNaN(ph)) {
        const last = swingPoints[swingPoints.length - 1];
        if (last && last.dir === 1) {
          if (gt(ph, last.price)) {
            last.barIdx = swingBar;
            last.price = ph;
          }
        } else swingPoints.push({ barIdx: swingBar, price: ph, dir: 1 });
      }
      if (!isNaN(pl)) {
        const last = swingPoints[swingPoints.length - 1];
        if (last && last.dir === -1) {
          if (lt(pl, last.price)) {
            last.barIdx = swingBar;
            last.price = pl;
          }
        } else swingPoints.push({ barIdx: swingBar, price: pl, dir: -1 });
      }
      while (swingPoints.length > cfg.swingMaxStored) swingPoints.shift();
    }
    if (cfg.swingEnabled && cfg.swingShowHl) {
      if (!isNaN(ph)) swingLabels.push(label.new(i - swingLen, ph, '', undefined, 'abovebar', bearEv, 'circle', WHITE, 'auto'));
      if (!isNaN(pl)) swingLabels.push(label.new(i - swingLen, pl, '', undefined, 'belowbar', bullEv, 'circle', WHITE, 'auto'));
      while (swingLabels.length > cfg.swingMaxStored * 2) label.delete(swingLabels.shift()!);
    }

    // ═══ § 14. Wave theory (last bar) ═══
    if (cfg.swingEnabled && cfg.waveEnabled && isLast) {
      const sz = swingPoints.length;
      let idx = sz - 1;
      let found = 0;
      while (sz >= 2 && idx >= 1 && found < cfg.waveMaxDisplay) {
        let tag = '';
        let bias = 0;
        let mpts = 0;
        let amp = 0;
        const pt = (k: number) => swingPoints[k];
        if (tag === '' && idx >= 3 && cfg.waveShowN) {
          const [A, B, C, D] = [pt(idx - 3), pt(idx - 2), pt(idx - 1), pt(idx)];
          const w = nWave(A, B, C, D);
          if (w !== 0 && D.barIdx - A.barIdx >= 9) {
            tag = 'N';
            bias = w;
            mpts = 4;
            amp = ne(A.price, 0) ? Math.abs(A.price - B.price) / A.price * 100 : 0;
          }
        }
        if (tag === '' && idx >= 4 && cfg.waveShowW) {
          const [A, B, C, D, E] = [pt(idx - 4), pt(idx - 3), pt(idx - 2), pt(idx - 1), pt(idx)];
          const leg = Math.abs(A.price - B.price);
          const th = leg * 0.2;
          const isPattern = le(Math.abs(A.price - C.price), th) && le(Math.abs(C.price - E.price), th)
            && le(Math.abs(B.price - D.price), th) && A.dir === C.dir && B.dir === D.dir;
          if (isPattern && E.barIdx - A.barIdx >= 9) {
            tag = 'W';
            bias = gt(B.price, A.price) ? -1 : 1;
            mpts = 5;
            amp = ne(A.price, 0) ? leg / A.price * 100 : 0;
          }
        }
        if (tag === '' && idx >= 3 && cfg.waveShowP) {
          const [A, B, C, D] = [pt(idx - 3), pt(idx - 2), pt(idx - 1), pt(idx)];
          const rangeAB = Math.abs(A.price - B.price);
          const rangeCD = Math.abs(C.price - D.price);
          if (lt(rangeCD, rangeAB * 0.85) && gt(rangeCD, rangeAB * 0.1) && D.barIdx - A.barIdx >= 9) {
            const hi = Math.max(A.price, B.price);
            const lo = Math.min(A.price, B.price);
            if (le(C.price, hi) && ge(C.price, lo) && le(D.price, hi) && ge(D.price, lo)) {
              tag = 'P';
              bias = D.dir === 1 ? 1 : -1;
              mpts = 4;
              amp = ne(A.price, 0) ? rangeAB / A.price * 100 : 0;
            }
          }
        }
        if (tag === '' && idx >= 3 && cfg.waveShowY) {
          const [A, B, C, D] = [pt(idx - 3), pt(idx - 2), pt(idx - 1), pt(idx)];
          const rangeAB = Math.abs(A.price - B.price);
          const rangeCD = Math.abs(C.price - D.price);
          if (gt(rangeCD, rangeAB * 1.15) && D.barIdx - A.barIdx >= 9) {
            const hi = Math.max(A.price, B.price);
            const lo = Math.min(A.price, B.price);
            if ((gt(C.price, hi) || lt(C.price, lo)) && (gt(D.price, hi) || lt(D.price, lo))) {
              tag = 'Y';
              bias = D.dir === 1 ? 1 : -1;
              mpts = 4;
              amp = ne(A.price, 0) ? rangeCD / A.price * 100 : 0;
            }
          }
        }
        if (tag === '' && idx >= 2 && cfg.waveShowV) {
          const [A, B, C] = [pt(idx - 2), pt(idx - 1), pt(idx)];
          const leg = Math.abs(A.price - B.price);
          if (le(Math.abs(C.price - A.price), leg * 0.2) && C.barIdx - A.barIdx >= 9) {
            tag = 'V';
            bias = C.dir === -1 ? 1 : -1;
            mpts = 3;
            amp = ne(A.price, 0) ? leg / A.price * 100 : 0;
          }
        }
        if (tag === '' && idx >= 1 && cfg.waveShowI) {
          const [A, B] = [pt(idx - 1), pt(idx)];
          if (B.barIdx - A.barIdx >= 9) {
            tag = 'I';
            bias = gt(B.price, A.price) ? 1 : -1;
            mpts = 2;
            amp = ne(A.price, 0) ? Math.abs(A.price - B.price) / A.price * 100 : 0;
          }
        }
        if (tag === '') {
          idx -= 1;
          continue;
        }
        const clr = waveColor(tag);
        const startI = idx - mpts + 1;
        // Skip waves too far from the current bar (max_bars_back)
        if (i - pt(startI).barIdx > 4999) {
          idx -= mpts - 1;
          continue;
        }
        const tip = waveTooltip(tag, bias, amp, pt(idx).barIdx - pt(startI).barIdx);
        if (tag === 'P' || tag === 'Y') {
          const [pA, pB, pC, pD] = [pt(startI), pt(startI + 1), pt(startI + 2), pt(startI + 3)];
          line.new(pA.barIdx, pA.price, pC.barIdx, pC.price, undefined, undefined, clr, 'solid', 2);
          line.new(pB.barIdx, pB.price, pD.barIdx, pD.price, undefined, undefined, clr, 'solid', 2);
        } else {
          for (let j = startI; j <= idx - 1; j++) {
            line.new(pt(j).barIdx, pt(j).price, pt(j + 1).barIdx, pt(j + 1).price, undefined, undefined, clr, 'solid', 2);
          }
        }
        const end = pt(idx);
        label.new(end.barIdx, end.price, tag, undefined, end.dir === 1 ? 'abovebar' : 'belowbar', undefined, 'none', clr, 'normal', undefined, tip);
        found += 1;
        idx -= cfg.waveOverlap ? 1 : mpts - 1;
      }
    }

    // ═══ § 15. Price theory (last bar) ═══
    if (cfg.swingEnabled && cfg.waveEnabled && cfg.priceTEnabled && isLast) {
      const sz = swingPoints.length;
      let nFound = false;
      let nA = NaN;
      let nB = NaN;
      let nC = NaN;
      let nDBar = NaN;
      let nBias = 0;
      if (sz >= 4) {
        let scan = sz - 1;
        // The last 20 swing points at most
        const scanLimit = Math.max(3, sz - 20);
        while (scan >= scanLimit && !nFound) {
          const [A, B, C, D] = [swingPoints[scan - 3], swingPoints[scan - 2], swingPoints[scan - 1], swingPoints[scan]];
          const w = nWave(A, B, C, D);
          if (w !== 0 && D.barIdx - A.barIdx >= 9) {
            nA = A.price;
            nB = B.price;
            nC = C.price;
            nDBar = D.barIdx;
            nBias = w;
            nFound = true;
          }
          scan -= 1;
        }
      }
      const targets = nTargets(nA, nB, nC);
      const formulaOf = (name: string, a: number, b: number, cc: number) => {
        switch (name) {
          case 'V': return str.format('V = B + (B - C) = {0} + ({0} - {1})', tick(b), tick(cc));
          case 'E': return str.format('E = B + (B - A) = {0} + ({0} - {1})', tick(b), tick(a));
          case 'N': return str.format('N = C + (B - A) = {0} + ({1} - {2})', tick(cc), tick(b), tick(a));
          case 'NT': return str.format('NT = C + (C - A) = {0} + ({0} - {1})', tick(cc), tick(a));
          case '2E': return str.format('2E = B + 2x(B - A) = {0} + 2x({0} - {1})', tick(b), tick(a));
          default: return str.format('3E = B + 3x(B - A) = {0} + 3x({0} - {1})', tick(b), tick(a));
        }
      };
      if (nFound) {
        const barsSinceD = i - nDBar;
        if (barsSinceD <= 4999) {
          let hiSinceD = high[i];
          let loSinceD = low[i];
          for (let k = 0; k <= barsSinceD - 1; k++) {
            hiSinceD = Math.max(hiSinceD, high[i - k]);
            loSinceD = Math.min(loSinceD, low[i - k]);
          }
          for (let k = 0; k < 6; k++) {
            if (!showPt[k]) continue;
            const lvl = targets[k];
            const clr = ptColors[k];
            const nm = PT_NAMES[k];
            const reached = cfg.priceTValidate && (nBias === 1 ? ge(hiSinceD, lvl) : le(loSinceD, lvl));
            const validMark = cfg.priceTValidate ? (reached ? ' ✓' : ' ⋯') : '';
            const validState = cfg.priceTValidate ? (reached ? '(Reached ✓)' : '(Pending ⋯)') : '(Completed)';
            const tip = str.format('Price Target {0} {1}\n{2} N-wave\n\n{3}\n= {4}', nm, validState,
              nBias === 1 ? '▲ Bullish' : '▼ Bearish', formulaOf(nm, nA, nB, nC), tick(lvl));
            line.new(nDBar, lvl, i + effOffset, lvl, undefined, undefined, clr, 'dashed', 1);
            label.new(i + effOffset, lvl, str.format('{0} • {1}{2}', nm, tick(lvl), validMark), 'bar_index', undefined,
              cnew(clr, 100), 'label_left', clr, 'small', undefined, tip);
          }
        }
      }
      // Developing N wave (A -> B -> C): where D should reach
      if (cfg.priceTDeveloping && sz >= 3) {
        const [dA, dB, dC] = [swingPoints[sz - 3], swingPoints[sz - 2], swingPoints[sz - 1]];
        const th = Math.abs(dA.price - dB.price) * 0.2;
        const devBull = lt(dA.price, dB.price) && gt(dC.price, dA.price + th) && lt(dC.price, dB.price - th);
        const devBear = gt(dA.price, dB.price) && lt(dC.price, dA.price - th) && gt(dC.price, dB.price + th);
        if ((devBull || devBear) && dC.barIdx - dA.barIdx >= 9) {
          const a = dA.price;
          const b = dB.price;
          const cc = dC.price;
          const levels = nTargets(a, b, cc);
          for (let k = 0; k < 6; k++) {
            if (!showPt[k]) continue;
            const dlvl = levels[k];
            const dclr = ptColors[k];
            const dnm = PT_NAMES[k];
            // Skip when a completed target is at the same level (0.1 % relative)
            if (nFound && lt(Math.abs(dlvl - targets[k]) / Math.max(dlvl, 1), 0.001)) continue;
            const devTip = str.format('Price Target ⟨{0}⟩ (Developing)\n{1} N-wave (A→B→C forming)\n\n{2}\n= {3}', dnm,
              devBull ? '▲ Bullish' : '▼ Bearish', formulaOf(dnm, a, b, cc), tick(dlvl));
            line.new(dC.barIdx, dlvl, i + effOffset, dlvl, undefined, undefined, cnew(dclr, 35), 'dotted', 1);
            label.new(i + effOffset, dlvl, str.format('⟨{0}⟩ • {1}', dnm, tick(dlvl)), 'bar_index', undefined,
              cnew(dclr, 100), 'label_left', cnew(dclr, 15), 'small', undefined, devTip);
          }
        }
      }
    }

    // ═══ § 16. Time theory ═══
    let waveCompleted = false;
    let waveDir = 0;
    let waveType = '';
    if (cfg.swingEnabled && cfg.waveEnabled && swingPoints.length >= 2) {
      const wsz = swingPoints.length;
      const latest = swingPoints[wsz - 1];
      // A swing point added (or moved) on this bar
      if (latest.barIdx === i - swingLen) {
        const sp = (k: number) => swingPoints[wsz - k];
        const done = (dir: number, type: string) => {
          waveCompleted = true;
          waveDir = dir;
          waveType = type;
          lastWaveBar = latest.barIdx;
        };
        if (wsz >= 4 && lastWaveBar !== latest.barIdx) {
          const w = nWave(sp(4), sp(3), sp(2), sp(1));
          if (w !== 0 && sp(1).barIdx - sp(4).barIdx >= 9) done(w, 'N');
        }
        if (!waveCompleted && wsz >= 5 && lastWaveBar !== latest.barIdx) {
          const [A, B, C, D, E] = [sp(5), sp(4), sp(3), sp(2), sp(1)];
          const th = Math.abs(A.price - B.price) * 0.2;
          const isW = le(Math.abs(A.price - C.price), th) && le(Math.abs(C.price - E.price), th)
            && le(Math.abs(B.price - D.price), th) && A.dir === C.dir && B.dir === D.dir;
          if (isW && E.barIdx - A.barIdx >= 9) done(gt(B.price, A.price) ? -1 : 1, 'W');
        }
        if (!waveCompleted && wsz >= 4 && lastWaveBar !== latest.barIdx) {
          const [A, B, C, D] = [sp(4), sp(3), sp(2), sp(1)];
          const rangeAB = Math.abs(A.price - B.price);
          const rangeCD = Math.abs(C.price - D.price);
          if (lt(rangeCD, rangeAB * 0.85) && gt(rangeCD, rangeAB * 0.1) && D.barIdx - A.barIdx >= 9) {
            const hi = Math.max(A.price, B.price);
            const lo = Math.min(A.price, B.price);
            if (le(C.price, hi) && ge(C.price, lo) && le(D.price, hi) && ge(D.price, lo)) done(D.dir === 1 ? 1 : -1, 'P');
          }
        }
        if (!waveCompleted && wsz >= 4 && lastWaveBar !== latest.barIdx) {
          const [A, B, C, D] = [sp(4), sp(3), sp(2), sp(1)];
          const rangeAB = Math.abs(A.price - B.price);
          const rangeCD = Math.abs(C.price - D.price);
          if (gt(rangeCD, rangeAB * 1.15) && D.barIdx - A.barIdx >= 9) {
            const hi = Math.max(A.price, B.price);
            const lo = Math.min(A.price, B.price);
            if ((gt(C.price, hi) || lt(C.price, lo)) && (gt(D.price, hi) || lt(D.price, lo))) done(D.dir === 1 ? 1 : -1, 'Y');
          }
        }
        if (!waveCompleted && wsz >= 3 && lastWaveBar !== latest.barIdx) {
          const [A, B, C] = [sp(3), sp(2), sp(1)];
          if (le(Math.abs(C.price - A.price), Math.abs(A.price - B.price) * 0.2) && C.barIdx - A.barIdx >= 9) done(C.dir === -1 ? 1 : -1, 'V');
        }
        if (!waveCompleted && lastWaveBar !== latest.barIdx) {
          const [A, B] = [sp(2), sp(1)];
          if (B.barIdx - A.barIdx >= 9) done(gt(B.price, A.price) ? 1 : -1, 'I');
        }
      }
    }
    // Price targets of the last completed N wave, and when they are reached
    const reachedBefore = ptReached.slice();
    if (waveCompleted && waveType === 'N' && swingPoints.length >= 4) {
      const w = swingPoints.length;
      const a = swingPoints[w - 4].price;
      const b = swingPoints[w - 3].price;
      const cc = swingPoints[w - 2].price;
      // order V, N, E, NT, 2E, 3E
      nTargets(a, b, cc).forEach((v, k) => {
        ptAlert[k] = v;
        ptReached[k] = false;
      });
      ptAlertBias = waveDir;
    }
    af[12][i] = waveCompleted && waveDir === 1;
    af[13][i] = waveCompleted && waveDir === -1;
    if (ptAlertBias === 1 && !isNaN(ptAlert[0])) {
      for (let k = 0; k < 6; k++) {
        if (!ptReached[k] && ge(high[i], ptAlert[k])) {
          ptReached[k] = true;
          af[14][i] = true;
        }
      }
    } else if (ptAlertBias === -1 && !isNaN(ptAlert[0])) {
      for (let k = 0; k < 6; k++) {
        if (!ptReached[k] && le(low[i], ptAlert[k])) {
          ptReached[k] = true;
          af[15][i] = true;
        }
      }
    }

    // Kihon Suchi anchor events
    let eventBull = false;
    let eventBear = false;
    let anchorBar = i;
    switch (cfg.kihonAnchor) {
      case 'Signals (▲▼)':
        eventBull = flipBull[i];
        eventBear = flipBear[i];
        break;
      case 'Tenkan Cross':
        eventBull = !!tkCross[i] && gt(c, tk);
        eventBear = !!tkCross[i] && !gt(c, tk);
        break;
      case 'Kijun Cross':
        eventBull = !!kjCross[i] && gt(c, kj);
        eventBear = !!kjCross[i] && !gt(c, kj);
        break;
      case 'TK x KJ Cross':
        eventBull = !!tkKjCross[i] && gt(tk, kj);
        eventBear = !!tkKjCross[i] && !gt(tk, kj);
        break;
      case 'Kumo Change': {
        const nowUp = ge(senkouA[i], senkouB[i]);
        const change = i > 0 ? nowUp !== ge(senkouA[i - 1], senkouB[i - 1]) : nowUp;
        eventBull = change && nowUp;
        eventBear = change && !nowUp;
        break;
      }
      case 'Swing Highs':
        eventBear = cfg.swingEnabled && !isNaN(ph);
        anchorBar = i - swingLen;
        break;
      case 'Swing Lows':
        eventBull = cfg.swingEnabled && !isNaN(pl);
        anchorBar = i - swingLen;
        break;
      case 'Swings (H+L)':
        eventBull = cfg.swingEnabled && !isNaN(pl);
        eventBear = cfg.swingEnabled && !isNaN(ph);
        anchorBar = i - swingLen;
        break;
      default:
        eventBull = waveCompleted && waveDir === 1;
        eventBear = waveCompleted && waveDir === -1;
        if (cfg.swingEnabled && swingPoints.length > 0) anchorBar = swingPoints[swingPoints.length - 1].barIdx;
    }
    if (eventBull) {
      kihonFlipBars.unshift(anchorBar);
      kihonFlipDirs.unshift(1);
    }
    if (eventBear) {
      kihonFlipBars.unshift(anchorBar);
      kihonFlipDirs.unshift(-1);
    }
    while (kihonFlipBars.length > cfg.kihonHistory) {
      kihonFlipBars.pop();
      kihonFlipDirs.pop();
    }

    // Time windows (current bar within 1 bar of a projection)
    let kihonWindow = false;
    let taitoWindow = false;
    if (cfg.kihonEnabled && kihonFlipBars.length > 0) {
      const cycles = kihonCycles();
      for (const fb of kihonFlipBars) {
        if (kihonWindow) break;
        for (const cy of cycles) {
          if (Math.abs(i - (fb + cy)) <= 1) {
            kihonWindow = true;
            break;
          }
        }
      }
    }
    if (cfg.swingEnabled && cfg.taitoEnabled && swingPoints.length >= 2) {
      const tsz = swingPoints.length;
      const pairs = Math.min(cfg.taitoCount, tsz - 1);
      for (let p = 0; p <= pairs - 1; p++) {
        if (taitoWindow) break;
        const ib = tsz - 1 - p;
        const ia = ib - 1;
        if (ia < 0) continue;
        const dur = swingPoints[ib].barIdx - swingPoints[ia].barIdx;
        if (dur <= 0) continue;
        for (let m = 1; m <= cfg.taitoHarmonics; m++) {
          if (Math.abs(i - (swingPoints[ib].barIdx + dur * m)) <= 1) {
            taitoWindow = true;
            break;
          }
        }
      }
    }

    // ═══ § 16B. Time x price confluence: diamond at a confirmation ═══
    const hits = showPt.map((s, k) => s && ptReached[k] && !reachedBefore[k]);
    {
      const timeWindow = kihonWindow || taitoWindow;
      const hasTargets = !isNaN(ptAlert[0]) && showPt.some((s, k) => s && !ptReached[k]);
      const confirmed = cfg.txpEnabled && timeWindow && hits.some((h) => h);
      af[16][i] = kihonWindow;
      af[17][i] = taitoWindow;
      af[18][i] = cfg.txpEnabled && timeWindow && hasTargets && !confirmed;
      af[19][i] = confirmed && ptAlertBias === 1;
      af[20][i] = confirmed && ptAlertBias === -1;
    }
    if (cfg.txpEnabled && (kihonWindow || taitoWindow) && hits.some((h) => h)) {
      const confirmedBull = ptAlertBias === 1;
      const names: string[] = [];
      const levels: number[] = [];
      hits.forEach((h, k) => {
        if (!h) return;
        names.push(PT_NAMES[k] + ' @ ' + tick(ptAlert[k]));
        levels.push(ptAlert[k]);
      });
      let hitText = '';
      names.forEach((nm, k) => {
        hitText += '  • ' + nm;
        if (k < names.length - 1) hitText += '\n';
      });
      let diaLevel = NaN;
      let diaDist = 1e10;
      for (const lv of levels) {
        const d = Math.abs(c - lv);
        if (lt(d, diaDist)) {
          diaDist = d;
          diaLevel = lv;
        }
      }
      let atKumo = false;
      if (cfg.txpKumoEnhance && !isNaN(diaLevel)) {
        const kHi = Math.max(aPresent[i], bPresent[i]);
        const kLo = Math.min(aPresent[i], bPresent[i]);
        atKumo = ge(diaLevel, kLo - 0.5 * atr14[i]) && le(diaLevel, kHi + 0.5 * atr14[i]);
      }
      let anchorLn = '';
      if (kihonWindow && cfg.kihonEnabled) {
        let aligned = false;
        const lastSw = swingPoints[swingPoints.length - 1];
        const swingsOn = cfg.swingEnabled && swingPoints.length > 0;
        switch (cfg.kihonAnchor) {
          case 'Signals (▲▼)': aligned = (ptAlertBias === 1 && regimeArr[i] === 1) || (ptAlertBias === -1 && regimeArr[i] === -1); break;
          case 'Tenkan Cross': aligned = (ptAlertBias === 1 && gt(c, tk)) || (ptAlertBias === -1 && lt(c, tk)); break;
          case 'Kijun Cross': aligned = (ptAlertBias === 1 && gt(c, kj)) || (ptAlertBias === -1 && lt(c, kj)); break;
          case 'TK x KJ Cross': aligned = (ptAlertBias === 1 && gt(tk, kj)) || (ptAlertBias === -1 && lt(tk, kj)); break;
          case 'Kumo Change': aligned = (ptAlertBias === 1 && gt(senkouA[i], senkouB[i])) || (ptAlertBias === -1 && lt(senkouA[i], senkouB[i])); break;
          case 'Swing Highs': aligned = swingsOn && lt(c, lastSw.price); break;
          case 'Swing Lows': aligned = swingsOn && gt(c, lastSw.price); break;
          case 'Swings (H+L)': aligned = swingsOn && ((ptAlertBias === 1 && lastSw.dir === -1 && gt(c, lastSw.price))
            || (ptAlertBias === -1 && lastSw.dir === 1 && lt(c, lastSw.price))); break;
          default: aligned = true;
        }
        const mode = cfg.kihonAnchor === 'Signals (▲▼)' ? 'Signals' : cfg.kihonAnchor === 'Swings (H+L)' ? 'Swings'
          : KIHON_MODE[cfg.kihonAnchor];
        anchorLn = str.format('\n\nANCHOR: {0} — {1}', mode, aligned ? 'Aligned ✓' : 'Diverging ✗');
      } else if (taitoWindow && !kihonWindow) {
        anchorLn = '\n\nANCHOR: Taito Sūchi — Time symmetry';
      }
      const tip = str.format('TIME x PRICE CONFLUENCE — CONFIRMED ◆\n時間・値幅合流\n\nTARGET(S) REACHED:\n{0}\n\nTIMING: {1} window (±1 bar){2}{3}',
        hitText, kihonWindow ? 'Kihon Sūchi' : 'Taito Sūchi',
        atKumo ? '\n\n☁ KUMO: Target near cloud edge\n   └─ Triple confluence (TxPxK)' : '', anchorLn);
      // Permanent marker, outside the signal markers (1.8 x the signal offset)
      label.new(i, confirmedBull ? low[i] - atrOffset[i] * 1.8 : high[i] + atrOffset[i] * 1.8, '◆', undefined, undefined,
        atKumo ? cfg.txpKumoColor : cfg.txpColor, confirmedBull ? 'label_up' : 'label_down', fg, atKumo ? 'small' : 'tiny', undefined, tip);
    }

    // Kihon Suchi projections (last bar)
    if (isLast && cfg.kihonEnabled && kihonFlipBars.length > 0) {
      const cycles = kihonCycles();
      const maxFuture = i + 50;
      const tBars: number[] = [];
      const tCycles: number[] = [];
      const tAnchors: number[] = [];
      kihonFlipBars.forEach((fb, a) => {
        for (const cy of cycles) {
          if (fb + cy > maxFuture) continue;
          tBars.push(fb + cy);
          tCycles.push(cy);
          tAnchors.push(a);
        }
      });
      const total = tBars.length;
      const isConf = new Array<boolean>(total).fill(false);
      const skip = new Array<boolean>(total).fill(false);
      // Confluences: projections of different anchors within 1 bar
      for (let a = 0; a <= total - 2; a++) {
        if (skip[a]) continue;
        for (let b = a + 1; b <= total - 1; b++) {
          if (!skip[b] && tAnchors[a] !== tAnchors[b] && Math.abs(tBars[a] - tBars[b]) <= 1) {
            isConf[a] = true;
            skip[b] = true;
          }
        }
      }
      let nextFound = false;
      const modeText = KIHON_MODE[cfg.kihonAnchor];
      for (let k = 0; k < total; k++) {
        if (skip[k]) continue;
        const tb = tBars[k];
        const away = tb - i;
        if (Math.abs(away) > 4999) continue;
        const anchorIdx = tAnchors[k];
        const conf = isConf[k];
        const flipDir = kihonFlipDirs[anchorIdx];
        const isPast = away < -1;
        const isWindow = Math.abs(away) <= 1;
        const isFuture = away > 1;
        let isNext = false;
        if (isFuture && !nextFound) {
          isNext = true;
          nextFound = true;
        }
        // Past validation: a confirmed swing at the target +-1 bar
        let validated = false;
        if (isPast && cfg.swingEnabled && swingPoints.length > 0) {
          for (let s = swingPoints.length - 1; s >= 0; s--) {
            if (Math.abs(swingPoints[s].barIdx - tb) <= 1) {
              validated = true;
              break;
            }
            if (swingPoints[s].barIdx < tb - 1) break;
          }
        }
        const ageAlpha = anchorIdx * 15;
        let baseAlpha = conf ? 5 : isWindow ? 10 + ageAlpha : isNext ? 25 + ageAlpha : isFuture ? 50 + ageAlpha
          : validated ? 35 + ageAlpha : 65 + ageAlpha;
        baseAlpha = Math.min(baseAlpha, 85);
        const lineClr = conf ? cnew('#FFD700', baseAlpha) : isWindow ? cnew(flipDir === 1 ? bullEv : bearEv, baseAlpha) : cnew(cfg.kihonColor, baseAlpha);
        line.new(tb, timeLineBot[i], tb, timeLineTop[i], 'bar_index', undefined, lineClr,
          conf || isWindow || isNext ? 'dashed' : 'dotted', conf || isWindow ? 2 : 1);
        let badge: string;
        if (conf) {
          badge = str.tostring(tCycles[k]);
          if (k < total - 1) {
            for (let j = k + 1; j <= total - 1; j++) if (skip[j] && Math.abs(tBars[j] - tb) <= 1) badge += str.format('+{0}', tCycles[j]);
          }
        } else {
          badge = str.format('{0} {1}', flipDir === 1 ? '▲' : '▼', tCycles[k]);
        }
        if (isPast) badge += validated ? ' ✓' : ' ·';
        const badgeBg = conf ? cnew('#FFD700', Math.max(baseAlpha - 10, 0)) : isWindow ? (flipDir === 1 ? bullEv : bearEv)
          : cnew(cfg.kihonColor, Math.max(baseAlpha - 10, 0));
        const badgeFg = conf ? cnew('#000000', 0) : isWindow ? WHITE : cnew(fg, baseAlpha);
        const dirText = flipDir === 1 ? '▲ Bull' : '▼ Bear';
        const status = conf ? 'Time confluence — multiple cycles converge' : isWindow ? 'Reversal window active'
          : away === 0 ? 'Current bar' : isFuture ? str.format('Due in {0} bars from current bar', away)
            : str.format('Occurred {0} bars back from current bar', Math.abs(away));
        const validLine = isPast ? (validated ? '\nPrice swing detected ✓' : '\nNo significant swing ·') : '';
        const anchorLabel = kihonFlipBars.length > 1 ? str.format('Anchor: {0} {1} #{2}\n', dirText, modeText, anchorIdx + 1) : '';
        const tip = str.format('Kihon Sūchi {0}{1}\nKihon Sūchi — Time Cycle\n\n{2}{3}{4}', tCycles[k], conf ? ' (confluence)' : '',
          anchorLabel, status, validLine);
        label.new(tb, timeLineTop[i], badge, 'bar_index', undefined, badgeBg, 'label_down', badgeFg, conf || isWindow ? 'small' : 'tiny', undefined, tip);
      }
      // Anchor markers
      kihonFlipBars.forEach((fb, a) => {
        if (i - fb > 4999) return;
        const fd = kihonFlipDirs[a];
        const arrow = fd === 1 ? '▲' : '▼';
        label.new(fb, timeLineBot[i], arrow, 'bar_index', undefined, cnew(fd === 1 ? bullEv : bearEv, a * 20), 'label_up', WHITE, 'tiny',
          undefined, str.format('{0} {1} (#{2})\nKihon Sūchi anchor point', modeText, arrow, a + 1));
      });
    }

    // Taito Suchi projections (last bar)
    if (isLast && cfg.swingEnabled && cfg.taitoEnabled && swingPoints.length >= 2) {
      const sz = swingPoints.length;
      const pairs = Math.min(cfg.taitoCount, sz - 1);
      const maxFuture = i + 50;
      const bracketY = timeLineBot[i];
      for (let p = 0; p <= pairs - 1; p++) {
        const ib = sz - 1 - p;
        const ia = ib - 1;
        if (ia < 0) continue;
        const A = swingPoints[ia];
        const B = swingPoints[ib];
        const duration = B.barIdx - A.barIdx;
        if (duration <= 0) continue;
        const pairFade = p * 15;
        const bracketAlpha = Math.min(45 + pairFade, 90);
        // Measured interval A -> B
        if (i - A.barIdx <= 4999) {
          line.new(A.barIdx, bracketY, B.barIdx, bracketY, 'bar_index', undefined, cnew(cfg.taitoColor, bracketAlpha), 'solid', 1);
        }
        for (let m = 1; m <= cfg.taitoHarmonics; m++) {
          const target = B.barIdx + duration * m;
          if (target > maxFuture) continue;
          if (Math.abs(target - i) > 4999) continue;
          const away = target - i;
          const isPast = away < -1;
          const isWindow = Math.abs(away) <= 1;
          const isFuture = away > 1;
          let validated = false;
          if (isPast && swingPoints.length > 0) {
            for (let s = swingPoints.length - 1; s >= 0; s--) {
              if (Math.abs(swingPoints[s].barIdx - target) <= 1) {
                validated = true;
                break;
              }
              if (swingPoints[s].barIdx < target - 1) break;
            }
          }
          const harmonicFade = (m - 1) * 10;
          let baseAlpha = isWindow ? 10 + pairFade + harmonicFade : isFuture ? 30 + pairFade + harmonicFade
            : validated ? 30 + pairFade + harmonicFade : 60 + pairFade + harmonicFade;
          baseAlpha = Math.min(baseAlpha, 85);
          line.new(target, timeLineBot[i], target, timeLineTop[i], 'bar_index', undefined, cnew(cfg.taitoColor, baseAlpha),
            isWindow || isFuture ? 'dashed' : 'dotted', isWindow ? 2 : 1);
          // Bracket B -> target (projected)
          if (i - B.barIdx <= 4999) {
            line.new(B.barIdx, bracketY, target, bracketY, 'bar_index', undefined, cnew(cfg.taitoColor, bracketAlpha + harmonicFade), 'dotted', 1);
          }
          let badge = str.format('T={0}{1}', duration, m > 1 ? str.format(' x{0}', m) : '');
          if (isPast) badge += validated ? ' ✓' : ' ·';
          const status = isWindow ? 'Time symmetry window active' : away === 0 ? 'Current bar'
            : isFuture ? str.format('Due in {0} bars', away) : str.format('Occurred {0} bars ago', Math.abs(away));
          const validLine = isPast ? (validated ? '\nPrice swing detected ✓' : '\nNo significant swing ·') : '';
          const tip = str.format('Taito Sūchi T={0}{1}\nTaito Sūchi — Time Symmetry\n\nMeasured: Swing {2} → {3} = {0} bars\nProjected: {4} bars forward from {3}\n\n{5}{6}',
            duration, m > 1 ? str.format(' (x{0} harmonic)', m) : '', A.dir === 1 ? 'High' : 'Low', B.dir === 1 ? 'High' : 'Low',
            str.tostring(duration * m), status, validLine);
          label.new(target, timeLineTop[i], badge, 'bar_index', undefined, cnew(cfg.taitoColor, Math.max(baseAlpha - 10, 0)), 'label_down',
            isWindow ? WHITE : cnew(fg, baseAlpha), isWindow ? 'small' : 'tiny', undefined, tip);
        }
      }
    }

    // Time x price forecast zones (last bar)
    if (isLast && cfg.txpEnabled && cfg.txpShowForecast) {
      const tBars: number[] = [];
      const tSrcs: string[] = [];
      const tWeights: number[] = [];
      const maxBar = i + 50;
      if (cfg.kihonEnabled && kihonFlipBars.length > 0) {
        // Weights (Omomi): 26, 42, 76, 129 = 3; 17, 33, 51, 65, 172, 200, 257 = 2; 9 = 1
        const cycles = kihonCycles();
        const weights = [1, 2, 3, 2, 3, 2, 2, 3, 3, 2, 2, 2];
        kihonFlipBars.forEach((fb, a) => {
          cycles.forEach((cy, ci) => {
            const tb = fb + cy;
            if (tb >= i - 1 && tb <= maxBar) {
              tBars.push(tb);
              tSrcs.push(str.format('K{0}{1}', cy, a > 0 ? str.format('.{0}', a + 1) : ''));
              tWeights.push(weights[ci]);
            }
          });
        });
      }
      if (cfg.swingEnabled && cfg.taitoEnabled && swingPoints.length >= 2) {
        const tsz = swingPoints.length;
        const pairs = Math.min(cfg.taitoCount, tsz - 1);
        for (let p = 0; p <= pairs - 1; p++) {
          const ib = tsz - 1 - p;
          const ia = ib - 1;
          if (ia < 0) continue;
          const dur = swingPoints[ib].barIdx - swingPoints[ia].barIdx;
          if (dur <= 0) continue;
          for (let m = 1; m <= cfg.taitoHarmonics; m++) {
            const tb = swingPoints[ib].barIdx + dur * m;
            if (tb >= i - 1 && tb <= maxBar) {
              tBars.push(tb);
              // Pair index suffix: two pairs with the same duration stay apart
              tSrcs.push(str.format('T{0}p{1}', dur * m, p));
              tWeights.push(m === 1 ? 2 : 1);
            }
          }
        }
      }
      // Unreached targets
      const pLevels: number[] = [];
      const pNames: string[] = [];
      if (!isNaN(ptAlert[0])) {
        for (let k = 0; k < 6; k++) {
          if (showPt[k] && !ptReached[k]) {
            pLevels.push(ptAlert[k]);
            pNames.push(PT_NAMES[k]);
          }
        }
      }
      // Time bars x price levels (outer loop on time), then greedy clustering (+-2 bars, +-tolerance x ATR)
      const tolerance = cfg.txpTolerance * atr14[i];
      const clusters: Array<{ bar: number; level: number; count: number; nt: number; np: number; tt: string; pt: string }> = [];
      tBars.forEach((rb, t) => {
        pLevels.forEach((rl, p) => {
          const rts = tSrcs[t];
          const rps = pNames[p];
          const cl = clusters.find((q) => Math.abs(rb - q.bar) <= 2 && le(Math.abs(rl - q.level), tolerance));
          if (cl) {
            const cnt = cl.count;
            cl.bar = Math.trunc(Math.round((cl.bar * cnt + rb) / (cnt + 1.0)));
            cl.level = (cl.level * cnt + rl) / (cnt + 1);
            cl.count = cnt + 1;
            if (!cl.tt.includes('|' + rts + '|')) {
              cl.tt += rts + '|';
              cl.nt += tWeights[t];
            }
            if (!cl.pt.includes('|' + rps + '|')) {
              cl.pt += rps + '|';
              cl.np += 1;
            }
          } else {
            clusters.push({ bar: rb, level: rl, count: 1, nt: tWeights[t], np: 1, tt: '|' + rts + '|', pt: '|' + rps + '|' });
          }
        });
      });
      // Kumo proximity (current projected Kumo) and score
      const kHi = Math.max(senkouA[i], senkouB[i]);
      const kLo = Math.min(senkouA[i], senkouB[i]);
      for (const cl of clusters) {
        const nearK = cfg.txpKumoEnhance && ge(cl.level, kLo - 0.5 * atr14[i]) && le(cl.level, kHi + 0.5 * atr14[i]);
        const score = Math.min(cl.nt, 8) + cl.np + (nearK ? 1 : 0);
        if (score < 4) continue;
        if (Math.abs(cl.bar - i) > 4999) continue;
        let tt = cl.tt.substring(1, cl.tt.length - 1).split('|').join('+');
        const pt = cl.pt.substring(1, cl.pt.length - 1).split('|').join('+');
        for (const sfx of ['p0', 'p1', 'p2', 'p3', 'p4']) tt = tt.split(sfx).join('');
        const fillA = Math.max(92 - score * 6, 50);
        const borderA = Math.max(70 - score * 10, 20);
        const baseClr = nearK || score >= 5 ? cfg.txpKumoColor : cfg.txpColor;
        const halfH = cfg.txpTolerance * atr14[i];
        const away = cl.bar - i;
        box.new(cl.bar - 2, cl.level + halfH, cl.bar + 2, cl.level - halfH, cnew(fg, borderA), score >= 5 ? 2 : 1, undefined, undefined,
          'bar_index', cnew(baseClr, fillA), str.tostring(score), score >= 5 ? 'small' : 'tiny', fg, 'center', 'center');
        let priceDetail = '';
        PT_NAMES.forEach((nm, k) => {
          if (cl.pt.includes('|' + nm + '|')) priceDetail += '\n  • ' + nm + ' @ ' + tick(ptAlert[k]);
        });
        const srcText = str.format('{0} x {1}{2}', pt, tt, nearK ? ' ☁' : '');
        const tip = str.format('Time x Price Confluence — Score [{0}]\n{1}\n時間・値幅合流 (Kasanari)\n\nPRICE CONVERGENCE: {2}{3}\n\nTIME CONVERGENCE: {4}\n\nZone: ±2 bars around bar +{5} from current{6}',
          score, srcText, ptAlertBias === 1 ? 'Bullish' : 'Bearish', priceDetail, tt, away,
          nearK ? '\n\n☁ KUMO: Zone intersects projected cloud\n   └─ Triple confluence (TxPxK)' : '');
        label.new(cl.bar, cl.level, str.tostring(score), 'bar_index', undefined, cnew(fg, 100), 'label_center', cnew(fg, 100),
          score >= 5 ? 'small' : 'tiny', undefined, tip);
      }
    }

    // ═══ § 18. Panel ═══
    if (cfg.panelEnabled) {
      if (!table1) {
        const pos = cfg.panelPosition === 'Top Right' ? 'top_right' : cfg.panelPosition === 'Top Left' ? 'top_left'
          : cfg.panelPosition === 'Bottom Left' ? 'bottom_left' : 'bottom_right';
        table1 = table.new(pos, 3, 15, cfg.panelBgColor, undefined, undefined, undefined, 1);
      }
      if (isLast) panel(table1, i);
    }
  }
  setDrawingBar(null);

  /** The panel cells of the last bar */
  function panel(t1: Table, i: number) {
    table.clear(t1, 0, 0, 2, 14);
    const sz = cfg.panelTextSize === 'Tiny' ? 'tiny' : cfg.panelTextSize === 'Small' ? 'small' : cfg.panelTextSize === 'Large' ? 'large' : 'normal';
    const head = cfg.panelHeaderColor;
    const bg = cfg.panelBgColor;
    const [s1, s2, s3, s4, s5, consensus] = panelScores(i);
    const symbol = (v: number) => ({ 1: '↑ Strong', 2: '◈ Equilibrium', 3: '↗ Weak', [-1]: '↓ Strong', [-2]: '◈ Equilibrium', [-3]: '↘ Weak' } as Record<number, string>)[v] ?? '○ Neutral';
    const scoreColor = (v: number) => ({ 1: cfg.panelColorStrongBull, 2: cfg.panelColorEquilibrium, 3: cfg.panelColorWeakBull,
      [-1]: cfg.panelColorStrongBear, [-2]: cfg.panelColorEquilibrium, [-3]: cfg.panelColorWeakBear } as Record<number, string>)[v] ?? cfg.panelColorNeutral;
    const lite = cfg.panelLiteMode;
    const valueAlign = lite ? 'right' : 'center';
    const cell = (col: number, row: number, text: string, textColor: string, bgColor?: string, align?: 'left' | 'center' | 'right') =>
      table.cell(t1, col, row, text, undefined, undefined, textColor, align, undefined, sz, bgColor);
    const rowsOf: Array<[boolean, string, number]> = [
      [cfg.panelShowTkCross, 'TK Cross vs Kumo', s1],
      [cfg.panelShowKijun, 'Kijun Position', s2],
      [cfg.panelShowChikouConfirm, 'Chikou Confirm', s3],
      [cfg.panelShowPriceKumo, 'Price vs Kumo', s4],
      [cfg.panelShowKumoTwist, 'Kumo Twist', s5],
    ];
    let row = 0;
    cell(0, 0, 'CROSS SIGNALS', WHITE, head);
    cell(1, 0, 'STATUS', WHITE, head, valueAlign);
    if (!lite) table.merge_cells(t1, 1, 0, 2, 0);
    row = 1;
    for (const [show, name, score] of rowsOf) {
      if (!show) continue;
      cell(0, row, name, fg, bg);
      cell(1, row, symbol(score), scoreColor(score), bg, valueAlign);
      if (!lite) table.merge_cells(t1, 1, row, 2, row);
      row += 1;
    }
    cell(0, row, 'CONSENSUS', WHITE, head);
    cell(1, row, symbol(consensus), scoreColor(consensus), head, valueAlign);
    if (!lite) table.merge_cells(t1, 1, row, 2, row);
    row += 1;
    if (!cfg.panelShowDetails) return;
    const dim = cnew(fg, 50);
    cell(0, row, lite ? '─────' : '─────────', dim);
    cell(1, row, 'DETAILS', dim, undefined, valueAlign);
    if (!lite) cell(2, row, '─────────', dim);
    row += 1;
    // get_composite_direction(): bullish bias when the bullish met conditions are at least the bearish ones
    // (ATR is not directional)
    const up = upConditions(i);
    const down = downConditions(i);
    let bullMet = 0;
    let bearMet = 0;
    for (const k of [0, 2, 3, 4, 5, 6, 7]) {
      if (!enabledFilters[k]) continue;
      if (up[k]) bullMet += 1;
      if (down[k]) bearMet += 1;
    }
    const isBullDir = bullMet >= bearMet;
    // get_composite_status()
    const conditions = isBullDir ? up : down;
    const condNames = isBullDir ? ['Vol', 'ATR', 'TKxKJ', 'Mom', 'CS>P', 'P>K', 'P>TK', 'CS tr'] : ['Vol', 'ATR', 'TKxKJ', 'Mom', 'CS<P', 'P<K', 'P<TK', 'CS tr'];
    const missing = condNames.filter((_, k) => enabledFilters[k] && !conditions[k]);
    const msz = missing.length;
    const statusText = msz === 0 ? 'All conditions MET ✓' : str.format('Waiting for {0} condition{1}', msz, msz > 1 ? 's' : '');
    let missingText = missing.slice(0, 5).join(', ');
    if (msz > 5) missingText += '…';
    const statusColor = missingText === '' ? fg : cfg.panelColorStrongBear;
    const regime = regimeArr[i];
    const regimeArrow = regime === 1 ? '▲' : regime === -1 ? '▼' : '–';
    const regimeDir = regime === 1 ? 'Bull' : regime === -1 ? 'Bear' : 'Flat';
    const regimeColor = regime === 1 ? cfg.panelColorStrongBull : regime === -1 ? cfg.panelColorStrongBear : cfg.panelColorNeutral;
    if (lite) {
      let liteStatus = missingText === '' ? 'All MET ✓' : '';
      if (missingText !== '') {
        const num = statusText.split('Waiting for ').join('').split(' conditions').join('').split(' condition').join('');
        liteStatus = 'Pending (' + num + ')';
      }
      cell(0, row, 'Filters', fg, bg);
      cell(1, row, liteStatus, statusColor, bg, 'right');
      row += 1;
      if (missingText !== '') {
        let liteMissing = missingText;
        // At most 3 names on mobile: cut at the 3rd comma
        if (liteMissing.length - liteMissing.split(',').join('').length >= 3) {
          let pos = 0;
          let found = 0;
          for (let j = 0; j < liteMissing.length; j++) {
            if (liteMissing[j] === ',') {
              found += 1;
              if (found === 3) {
                pos = j;
                break;
              }
            }
          }
          if (pos > 0) liteMissing = liteMissing.substring(0, pos) + '…';
        }
        cell(0, row, 'Missing', fg, bg);
        cell(1, row, liteMissing, cfg.panelColorStrongBear, bg, 'right');
        row += 1;
      }
      cell(0, row, 'Regime', fg, bg);
      cell(1, row, str.format('{0} {1} ({2}b)', regimeArrow, regimeDir, barsInRegime), regimeColor, bg, 'right');
      row += 1;
      const presetShort = presetIdx >= 0 ? ['CLASSIC', '5D', 'CRYPTO', 'SLOW'][presetIdx] : 'CUSTOM';
      cell(0, row, 'PRESET', fg, bg);
      cell(1, row, presetShort, fg, bg, 'right');
      return;
    }
    cell(0, row, 'Filters', fg);
    cell(1, row, statusText, statusColor, undefined, 'center');
    table.merge_cells(t1, 1, row, 2, row);
    row += 1;
    if (missingText !== '') {
      cell(0, row, 'Missing', fg);
      cell(1, row, missingText, cfg.panelColorStrongBear, undefined, 'center');
      table.merge_cells(t1, 1, row, 2, row);
      row += 1;
    }
    cell(0, row, 'Regime', fg);
    cell(1, row, str.format('{0} {1} ({2} bars)', regimeArrow, regimeDir, barsInRegime), regimeColor, undefined, 'center');
    table.merge_cells(t1, 1, row, 2, row);
    row += 1;
    // format_lengths_display()
    const lengths = isAdaptiveMode
      ? str.format('Dyn: {0}/{1}/{2}/{3}', tkLen[i], kjLen[i], skLen[i], chikouAdaptive ? chLen[i] : effOffset)
      : presetIdx >= 0 ? ['9/26/52/26', '8/22/44/22', '10/30/60/30', '20/60/120/60'][presetIdx] : 'Custom';
    cell(0, row, 'PRESET', fg);
    cell(1, row, lengths, fg, undefined, 'center');
    table.merge_cells(t1, 1, row, 2, row);
  }

  // ═══ Outputs ═══
  const interval = barInterval(bars);
  const T = (j: number) => barTime(bars, j, interval);
  /** plot(..., offset = k): the value of bar i is drawn on bar i + k */
  const shifted = (values: number[], k: number, colorOf: (src: number) => string) => {
    const out: Array<{ time: number; value: number; color?: string }> = [];
    for (let j = Math.max(0, k); j < n + Math.max(0, k); j++) {
      const src = j - k;
      const inside = src >= 0 && src < n;
      const v = inside ? values[src] : NaN;
      out.push({ time: T(j), value: Number.isFinite(v) ? v : NaN, ...(inside ? { color: colorOf(src) } : {}) });
    }
    return out;
  };
  const plain = (values: number[], clr: string) => values.map((v, i) => ({ time: bars[i].time, value: Number.isFinite(v) ? v : NaN, color: clr }));

  // Kumo fill colour: solid by direction, or a gradient on the RSI of the Kumo middle
  const kumoMidRsi = ta.rsi(senkouA.map((a, i) => (a + senkouB[i]) / 2), 14);
  const fillColors = senkouA.map((a, i) => {
    if (!cfg.kumoFillEnabled) return 'transparent';
    const b = senkouB[i];
    let base: string;
    if (cfg.kumoFillStyle === 'Solid') base = gt(a, b) ? cfg.kumoBullColor : lt(a, b) ? cfg.kumoBearColor : cfg.kumoNeutralColor;
    else {
      base = gt(a, b) ? String(color.from_gradient(kumoMidRsi[i], 0, 100, cfg.kumoNeutralColor, cfg.kumoBullColor))
        : lt(a, b) ? String(color.from_gradient(kumoMidRsi[i], 0, 100, cfg.kumoNeutralColor, cfg.kumoBearColor)) : cfg.kumoNeutralColor;
    }
    return cnew(base, cfg.kumoFillTransparency);
  });

  // Bar colours
  const barColors: BarColorData[] = [];
  if (cfg.barcolorMode !== 'Disabled') {
    for (let i = 0; i < n; i++) {
      const c = close[i];
      const tk = tenkan[i];
      const kj = kijun[i];
      let clr: string;
      switch (cfg.barcolorMode) {
        case 'Price vs TK/KJ':
          clr = gt(c, tk) && gt(c, kj) ? cfg.barBullColor : lt(c, tk) && lt(c, kj) ? cfg.barBearColor : cfg.barNeutralColor;
          break;
        case 'Price vs Kumo':
          clr = gt(c, kumoTop[i]) ? cfg.barBullColor : lt(c, kumoBottom[i]) ? cfg.barBearColor : cfg.barNeutralColor;
          break;
        case 'Confluence Strength': {
          const cBull = (gt(c, kumoTop[i]) ? 1 : 0) + (gt(tk, kj) ? 1 : 0) + (gt(c, tk) ? 1 : 0) + (chikouAbovePast[i] ? 1 : 0) + (chikouSig[i] === 1 ? 1 : 0);
          const cBear = (lt(c, kumoBottom[i]) ? 1 : 0) + (lt(tk, kj) ? 1 : 0) + (lt(c, tk) ? 1 : 0) + (chikouBelowPast[i] ? 1 : 0) + (chikouSig[i] === -1 ? 1 : 0);
          // 80 - score x 16: 1 to 5 conditions -> transparency 64 to 0
          clr = cBull > cBear ? cnew(cfg.barBullColor, Math.max(0, 80 - cBull * 16))
            : cBear > cBull ? cnew(cfg.barBearColor, Math.max(0, 80 - cBear * 16)) : cfg.barNeutralColor;
          break;
        }
        case 'Current Regime':
          clr = regimeArr[i] === 1 ? cfg.barBullColor : regimeArr[i] === -1 ? cfg.barBearColor : cfg.barNeutralColor;
          break;
        default:
          clr = gt(senkouA[i], senkouB[i]) ? cfg.barBullColor : lt(senkouA[i], senkouB[i]) ? cfg.barBearColor : cfg.barNeutralColor;
      }
      barColors.push({ time: bars[i].time, color: clr });
    }
  }

  // Signal markers (plotshape at an absolute price)
  const markers: MarkerData[] = [];
  if (cfg.showSignals) {
    for (let i = 0; i < n; i++) {
      if (flipBear[i] && !isNaN(atrOffset[i])) {
        markers.push({ time: bars[i].time, position: 'atPriceMiddle', price: high[i] + atrOffset[i], shape: 'triangleDown', color: bearEv, size: 'small' });
      }
      if (flipBull[i] && !isNaN(atrOffset[i])) {
        markers.push({ time: bars[i].time, position: 'atPriceMiddle', price: low[i] - atrOffset[i], shape: 'triangleUp', color: bullEv, size: 'small' });
      }
    }
  }

  // Panel consensus direction change (calc_panel_scores() runs on every bar)
  let prevDir = NaN;
  for (let i = 0; i < n; i++) {
    const cons = panelScores(i)[5];
    const dir = cons > 0 ? 1 : cons < 0 ? -1 : 0;
    af[21][i] = !isNaN(prevDir) && dir !== prevDir && (dir !== 0 || prevDir !== 0);
    prevDir = dir;
  }

  const off = effOffset - 1;
  const showFixedChikou = !chikouAdaptive && cfg.showChikou;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: shifted(senkouA, off, () => (cfg.showSenkouA ? cfg.kumoBullColor : 'transparent')),
      plot1: shifted(senkouB, off, () => (cfg.showSenkouB ? cfg.kumoBearColor : 'transparent')),
      plot2: plain(tenkan, cfg.showTenkan ? cfg.tenkanColor : 'transparent'),
      plot3: plain(kijun, cfg.showKijun ? cfg.kijunColor : 'transparent'),
      plot4: shifted(showFixedChikou ? price : price.map(() => NaN), -off, (src) => chikouColor[src]),
    },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: fillColors }],
    markers,
    barColors,
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, af),
  };
}

export const IchimokuKinkHy = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
