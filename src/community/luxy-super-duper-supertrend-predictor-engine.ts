/**
 * Luxy Super-Duper SuperTrend Predictor Engine
 *
 * An adaptive SuperTrend: bands at hl2 -+ ATR("ATR Length") * multiplier, the multiplier scaled by the trend strength
 * (|correlation of the close with the bar index|) and the volume weight ("Use Adaptive Multiplier"), each band
 * smoothed inside its trend ("Smoothing Factor"). The direction turns up when the close is above the upper band of
 * the bar before and down when it is below the lower band. The "Trading Style Preset" (by default from the chart
 * timeframe) sets the ATR length and multiplier, the volume momentum periods, the volume average length and
 * thresholds. A quality score (0-70: volume ratio, ATR regime, volume momentum) filters the BUY / SELL signals of the
 * flips; "Scalpel Mode" waits for a bounce over a pullback level a few bars after the flip instead.
 *
 * Outputs:
 * - plot0 "SuperTrend Line" (bullish / bearish colour; na on the flip bar and during the neutral bars)
 * - a 15-layer ribbon between the close and the line (split at the bar middle on a flip bar): 16 hidden plots and
 *   15 fills whose transparency falls with the volume ratio and the volume momentum
 * - labels: BUY / SELL signals (tooltip with volume, momentum, quality, the higher timeframe agreement and the stop /
 *   targets of GOD MODE), optional volume spike labels ("Show Info Labels")
 * - trend duration prediction on each flip: the durations of the past trends of the same direction most similar to
 *   the flip (volume, volatility, quality, distance, structure), percentiles, a Weibull 95 % threshold, context and
 *   Advanced multipliers; drawn as 30 gradient boxes over the predicted length, a "Trend Analysis" label and 5
 *   labels with the share of past trends that lasted that long (the last 5 predictions are kept)
 * - a dashboard table on the last bar; alert() calls on the signals and three alertconditions
 *
 * Higher TF 1 / 2 (`request.security` of the chart symbol, direction of `ta.supertrend`): the chart timeframe uses the
 * chart bars, a higher timeframe is built from them, a lower one needs the bars of the chart symbol on that timeframe
 * from the chart context (`requiredSymbols`, `bars` accessor; without them the port throws a MissingSymbolDataError
 * that lists them). Prices in the tooltips use the symbol tick of the context (`format.mintick`; 0.01 without it).
 * A live last bar (context `lastBarConfirmed` false) records no flip and creates no signal label
 * (`barstate.isconfirmed`), and shows the open bar of a higher timeframe.
 *
 * Reference: "Luxy Super-Duper SuperTrend Predictor Engine" by orenluxy
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, color, callsite, timeframe, array, label, box, table, resetDrawings, setDrawingBar, varDrawing,
  drawingOutputs, Series, type Bar, type Box, type FillConfig, type IndicatorResult, type InputConfig, type Label,
  type PlotConfig, type Table,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { AlertCall } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { lastBarConfirmedOf, mintickOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { otherSymbolChart, securityOther } from '../other-symbol';

export interface LuxySuperDuperSupertrendPredictorEngineInputs {
  /** Trading style preset ("Auto (Detect from TF)" reads the chart timeframe; "Custom" uses the inputs below) */
  tradingStyle: string;
  /** Show the dashboard table */
  showDashboard: boolean;
  /** Dashboard position */
  tablePosition: string;
  /** Dashboard text size */
  tableTextSize: string;
  /** Show the gradient ribbon fill */
  showRibbonFill: boolean;
  /** Show the SuperTrend line */
  showSupertrendLine: boolean;
  /** Bullish colour */
  bullColor: string;
  /** Bearish colour */
  bearColor: string;
  /** Show the BUY / SELL labels */
  showEntryLabels: boolean;
  /** Show the volume spike labels */
  showInfoLabels: boolean;
  /** Size of all labels */
  labelTextSize: string;
  /** ATR length (Custom style) */
  stLength: number;
  /** ATR multiplier (Custom style) */
  stMult: number;
  /** Adaptive multiplier (trend strength and volume weight) */
  stUseAdaptive: boolean;
  /** Band smoothing factor */
  stSmoothFactor: number;
  /** Bars without line and ribbon after a flip */
  stNeutralBars: number;
  /** Volume momentum filter (off in the Scalping style) */
  volumeMomentumEnabled: boolean;
  /** Volume momentum fast period (Custom style) */
  volMomFast: number;
  /** Volume momentum slow period (Custom style) */
  volMomSlow: number;
  /** Volume average length (Custom style) */
  volLength: number;
  /** High volume ratio (Custom style) */
  volHighThreshold: number;
  /** Spike volume ratio (Custom style) */
  volSpikeThreshold: number;
  /** Low volume ratio */
  volLowThreshold: number;
  /** Minimum quality score of a signal */
  minQualityScore: number;
  /** Signals need a volume ratio of 1 or more */
  requireVolumeConfirm: boolean;
  /** Scalpel Mode (pullback entries) */
  useScalpel: boolean;
  /** Bars after the flip to wait for the pullback */
  scalpelWindow: number;
  /** Minimum distance from the SuperTrend in ATR */
  scalpelMinDist: number;
  /** Minimum quality score in Scalpel Mode */
  scalpelQuality: number;
  /** Trend duration prediction */
  enablePrediction: boolean;
  /** Prediction mode (Simple / Standard / Advanced) */
  predictionMode: string;
  /** Asset type multiplier (Advanced) */
  stockType: string;
  /** Exponential weighting of the past trends */
  useEwa: boolean;
  /** Decay factor of the weighting */
  ewaDecay: number;
  /** "Filter Extreme Values" (not read by the original's computation) */
  outlierFilter: boolean;
  /** "Use Median" (not read by the original's computation) */
  useMedian: boolean;
  /** Pivot length of the market structure levels */
  structureLookback: number;
  /** Proximity to a level in ATR */
  structureSensitivity: number;
  /** Error learning (Advanced) */
  useErrorLearning: boolean;
  /** Error learning memory */
  errorMemoryDepth: number;
  /** GOD MODE: higher timeframe confluence, stop / targets */
  godmodeEnabled: boolean;
  /** Higher timeframe 1 */
  htf1Tf: string;
  /** Higher timeframe 2 */
  htf2Tf: string;
  /** Signals only when both higher timeframes agree */
  mtfGateSignals: boolean;
  /** Stop and targets in the signal tooltips */
  showRiskLevels: boolean;
  /** Target 1 in R */
  tp1R: number;
  /** Target 2 in R */
  tp2R: number;
}

export const defaultInputs: LuxySuperDuperSupertrendPredictorEngineInputs = {
  tradingStyle: 'Auto (Detect from TF)',
  showDashboard: true,
  tablePosition: 'Bottom Right',
  tableTextSize: 'Small',
  showRibbonFill: true,
  showSupertrendLine: true,
  bullColor: '#4CAF50', // color.green
  bearColor: '#F23645', // color.red
  showEntryLabels: true,
  showInfoLabels: false,
  labelTextSize: 'Normal',
  stLength: 10,
  stMult: 3.0,
  stUseAdaptive: true,
  stSmoothFactor: 0.15,
  stNeutralBars: 0,
  volumeMomentumEnabled: true,
  volMomFast: 5,
  volMomSlow: 20,
  volLength: 20,
  volHighThreshold: 1.5,
  volSpikeThreshold: 2.5,
  volLowThreshold: 0.5,
  minQualityScore: 30,
  requireVolumeConfirm: true,
  useScalpel: false,
  scalpelWindow: 5,
  scalpelMinDist: 0.4,
  scalpelQuality: 55,
  enablePrediction: true,
  predictionMode: 'Advanced',
  stockType: 'Blue Chip / Large Cap',
  useEwa: true,
  ewaDecay: 0.9,
  outlierFilter: true,
  useMedian: true,
  structureLookback: 10,
  structureSensitivity: 0.5,
  useErrorLearning: true,
  errorMemoryDepth: 10,
  godmodeEnabled: true,
  htf1Tf: '60',
  htf2Tf: '240',
  mtfGateSignals: false,
  showRiskLevels: true,
  tp1R: 2.0,
  tp2R: 3.5,
};

const G0 = "==== Quick Setup =======================";
const G1 = "==== Dashboard & Display ============";
const G2 = "==== Supertrend =======================";
const G3 = "==== Volume ===========================";
const G4 = "==== Quality Filters =================";
const G5 = "==== Trend Duration Prediction=====";
const G6 = "==== 🚀 GOD MODE =====================";

export const inputConfig: InputConfig[] = [
  { id: 'tradingStyle', type: 'string', title: "Trading Style Preset", defval: "Auto (Detect from TF)", options: ["Auto (Detect from TF)", "Scalping (1-5m)", "Day Trading (15m-1h)", "Swing Trading (4h-D)", "Position Trading (D-W)", "Custom"], group: G0, tooltip: "🎯 Trading Style Configuration\n\n🤖 AUTO (DETECT FROM TF) - RECOMMENDED ✅\nAutomatically selects optimal settings based on your chart timeframe:\n• 1m-5m → Scalping (ATR: 7, Mult: 2.0)\n• 15m-1h → Day Trading (ATR: 10, Mult: 2.5)\n• 2h-4h-D → Swing Trading (ATR: 14, Mult: 3.0)\n• W-M → Position Trading (ATR: 21, Mult: 4.0)\n\nBenefits:\n✅ Zero configuration - works immediately\n✅ Always matched to your timeframe\n✅ Switch TF = automatic adjustment\n\n📊 MANUAL PRESETS:\n📈 Scalping (1-5m): Ultra-fast signals, high sensitivity\n⚡ Day Trading (15m-1h): Balanced speed and accuracy\n🔄 Swing Trading (4h-D): Medium-term trends, less noise\n📊 Position Trading (D-W): Long-term trends, minimal false signals\n\n🛠️ CUSTOM MODE:\nFull manual control - uses YOUR input values below\nFor advanced users who want precise customization\n\n⚠️ NOTE: Presets override manual inputs. For custom values, select 'Custom'." },
  { id: 'showDashboard', type: 'bool', title: "Show Dashboard", defval: true, group: G1, tooltip: "Show/Hide Dashboard Table\n\nDisplays real-time metrics:\n• Signal Quality Score (0-70)\n• Supertrend direction & level\n• Volume state & ratio\n• Volatility regime\n• Prediction track record\n\nAll metrics update on each bar close.\n\n💡 Disable to reduce chart clutter" },
  { id: 'tablePosition', type: 'string', title: "Position", defval: "Bottom Right", options: ["Top Left", "Top Center", "Top Right", "Middle Left", "Middle Center", "Middle Right", "Bottom Left", "Bottom Center", "Bottom Right"], group: G1, inline: 'table_settings', tooltip: "Dashboard Position\n\nChoose where to display the dashboard table on your chart.\n\n9 positions available:\n• Top: Left, Center, Right\n• Middle: Left, Center, Right\n• Bottom: Left, Center, Right\n\n💡 Choose a position that doesn't overlap important price action" },
  { id: 'tableTextSize', type: 'string', title: "Text Size", defval: "Small", options: ["Auto", "Tiny", "Small", "Normal", "Large", "Huge"], group: G1, inline: 'table_settings', tooltip: "Dashboard Text Size\n\nControls the size of text in the dashboard table.\n\nOptions:\n• Auto - Adapts to chart size\n• Tiny - Smallest (minimal space)\n• Small - Compact (recommended)\n• Normal - Standard readability\n• Large - Easy to read\n• Huge - Maximum visibility\n\n💡 Use smaller sizes on busy charts" },
  { id: 'showRibbonFill', type: 'bool', title: "Show Ribbon Fill", defval: true, group: G1, inline: 'ribbon_viz', tooltip: "Toggles the visibility of the gradient background fill for the SuperTrend ribbon." },
  { id: 'showSupertrendLine', type: 'bool', title: "Show SuperTrend Line", defval: true, group: G1, inline: 'ribbon_viz', tooltip: "Toggles the visibility of the main SuperTrend line." },
  { id: 'bullColor', type: 'color', title: "Bullish Color", defval: "#4CAF50", group: G1, inline: 'ribbon_colors', tooltip: "Bullish Trend Color\n\nSets the color for:\n• Supertrend line (when bullish)\n• Gradient ribbon fill (when bullish)\n• BUY signal labels\n\nDefault: Green\n\n💡 Choose colors that match your chart theme" },
  { id: 'bearColor', type: 'color', title: "Bearish Color", defval: "#F23645", group: G1, inline: 'ribbon_colors', tooltip: "Bearish Trend Color\n\nSets the color for:\n• Supertrend line (when bearish)\n• Gradient ribbon fill (when bearish)\n• SELL signal labels\n\nDefault: Red\n\n💡 Choose colors that match your chart theme" },
  { id: 'showEntryLabels', type: 'bool', title: "Show Entry Signals (BUY/SELL)", defval: true, group: G1, tooltip: "Entry Signal Labels\n\nShows 🔪 BUY and 🔪 SELL signals on chart.\n\nIncludes:\n• Volume status\n• Volume Momentum\n• Quality score\n\nThese are your main trading signals." },
  { id: 'showInfoLabels', type: 'bool', title: "Show Info Labels (Volume)", defval: false, group: G1, tooltip: "Informative Labels\n\nShows additional market events:\n\n💥 Volume Spike\n• Significant volume increase\n• Cooldown: 8 bars\n\nThese provide context, not entry signals." },
  { id: 'labelTextSize', type: 'string', title: "Label Size (All)", defval: "Normal", options: ["Auto", "Tiny", "Small", "Normal", "Large", "Huge"], group: G1, tooltip: "Label Size\n\nControls text size for ALL labels:\n• Entry signals (BUY/SELL)\n• Volume spikes\n\nRecommended:\n• Small charts: Small\n• Normal charts: Normal (default)\n• Large charts: Large" },
  { id: 'stLength', type: 'int', title: "ATR Length", defval: 10, min: 1, max: 50, group: G2, inline: 'st1', tooltip: "Supertrend Settings - Optimized for All Trading Styles\n\nATR-based trend indicator:\n• Adapts to volatility automatically\n• Provides clear trend direction\n• Built-in stop levels\n\nOptimal by style:\n• Scalping: ATR 7-10, Mult 1.8-2.2\n• Day Trading: ATR 10-14, Mult 2.2-2.8\n• Swing Trading: ATR 14-21, Mult 2.8-3.5\n• Position Trading: ATR 21-30, Mult 3.5-4.5\n\nTighter = more signals, Wider = stronger signals" },
  { id: 'stMult', type: 'float', title: "ATR Multiplier (Base)", defval: 3, min: 0.5, step: 0.5, group: G2, inline: 'st1' },
  { id: 'stUseAdaptive', type: 'bool', title: "Use Adaptive Multiplier", defval: true, group: G2, inline: 'adapt', tooltip: "Adaptive Multiplier System\n\nDynamically adjusts multiplier (0.8x to 1.2x base) based on:\n• Trend Strength (price correlation)\n• Volume Weight (relative to average)\n\nBenefits:\n✅ Tighter bands in calm markets\n✅ Wider bands in volatile conditions\n✅ Better for biotech/small-cap stocks\n\nDisable for classic constant multiplier." },
  { id: 'stSmoothFactor', type: 'float', title: "Smoothing Factor", defval: 0.15, min: 0, max: 0.5, step: 0.05, group: G2, inline: 'adapt', tooltip: "EMA smoothing applied to Supertrend bands\n\n0.0 = no smoothing (instant response)\n0.15 = balanced (~13 bars)\n0.3+ = very smooth (slow response)\n\n💡 Volume Momentum filter compensates for lag" },
  { id: 'stNeutralBars', type: 'int', title: "Neutral Bars After Flip", defval: 0, min: 0, max: 10, group: G2, tooltip: "Neutral Bars After Flip\n\nHide Supertrend for X bars after trend flip.\n\nBenefits:\n✅ Reduces false signals immediately after flip\n✅ Gives price time to confirm new direction\n✅ Cleaner visual on choppy markets\n\nRecommended:\n• 0 = disabled (classic behavior)\n• 2-3 = balanced (swing trading)\n• 5+ = very conservative" },
  { id: 'volumeMomentumEnabled', type: 'bool', title: "Enable Volume Momentum Filter", defval: true, group: G2, inline: 'volmom1', tooltip: "Volume Momentum Confirmation - All Trading Styles\n\nCompares short-term vs long-term volume averages:\n• Confirms trend strength with actual money flow\n• Rising momentum = Recent volume > Historical average\n• No lag like price-based indicators\n• More intuitive than mathematical filters\n\nOptimal periods by style:\n• Scalping: 3 vs 10 (instant response)\n• Day Trading: 5 vs 20 (balanced)\n• Swing Trading: 10 vs 30 (trend stability)\n• Position Trading: 20 vs 50 (major moves)\n\n⚠️ AUTO-DISABLED for Scalping mode (too restrictive)\n\nON = Fewer but volume-confirmed signals\nOFF = All Supertrend signals (no filter)" },
  { id: 'volMomFast', type: 'int', title: "Fast Period", defval: 5, min: 2, max: 20, group: G2, inline: 'volmom1' },
  { id: 'volMomSlow', type: 'int', title: "Slow Period", defval: 20, min: 10, max: 50, group: G2, inline: 'volmom1', tooltip: "Volume Momentum Slow Period\n\nHistorical volume average for comparison.\n\nRepresents:\n• Long-term baseline volume\n• Historical average activity\n\nTypical values:\n• Scalping: 10 bars (recent baseline)\n• Day Trading: 20 bars (daily baseline) - DEFAULT\n• Swing: 30 bars (weekly baseline)\n• Position: 50 bars (monthly baseline)\n\nMust be larger than Fast Period.\n\n💡 Larger values = more stable baseline, less noise" },
  { id: 'volLength', type: 'int', title: "Volume MA Length", defval: 20, min: 5, max: 100, group: G3, inline: 'vol1', tooltip: "Volume Analysis - Critical for All Trading Styles\n\nThresholds are multipliers of average volume:\n\n🔥 HIGH = Strong participation\n💥 SPIKE = Major event/breakout\n📍 LOW = Weak participation\n\nOptimal by style:\n• Scalping: High 1.5-2.0x, Spike 2.5-3.5x\n• Day Trading: High 1.3-1.7x, Spike 2.2-3.0x\n• Swing Trading: High 1.2-1.5x, Spike 2.0-2.7x\n• Position Trading: High 1.1-1.3x, Spike 1.8-2.3x\n\nVolume confirmation improves signal quality." },
  { id: 'volHighThreshold', type: 'float', title: "High Volume (x)", defval: 1.5, min: 1, step: 0.1, group: G3, inline: 'vol2' },
  { id: 'volSpikeThreshold', type: 'float', title: "Spike Volume (x)", defval: 2.5, min: 1.5, step: 0.5, group: G3, inline: 'vol2' },
  { id: 'volLowThreshold', type: 'float', title: "Low Volume (x)", defval: 0.5, min: 0.1, max: 1, step: 0.1, group: G3, inline: 'vol3', tooltip: "Low Volume Threshold\n\nDefines when volume is considered LOW (weak participation).\n\nMeasured as multiplier of average volume:\n• 0.5x = Current volume is 50% of average\n• 0.7x = Current volume is 70% of average\n\nLow volume signals:\n⚠️ Weak trend confirmation\n⚠️ Lower quality setups\n⚠️ May indicate trend exhaustion\n\nDefault: 0.5x\n\n💡 Lower values = stricter definition of low volume" },
  { id: 'minQualityScore', type: 'int', title: "Minimum Quality Score", defval: 30, min: 0, max: 70, group: G4, tooltip: "Signal Quality Filtering\n\nQuality Score (0-70) based on:\n• Volume (30 points)\n• Volatility Expansion (30 points)\n• Volume Momentum (10 points)\n\nRecommended minimums:\n• 30 = GOOD+ (balanced)\n• 45 = STRONG+ (conservative)\n• 60 = EXCELLENT (very strict)" },
  { id: 'requireVolumeConfirm', type: 'bool', title: "Require Volume Confirmation", defval: true, group: G4, tooltip: "Only generate signals when volume > average" },
  { id: 'useScalpel', type: 'bool', title: "🔪 Scalpel Mode", defval: false, group: G4, tooltip: "🔪 Scalpel Mode - Pullback Entry System\n\nInstead of entering on SuperTrend flip bar:\n• Wait 2-5 bars for pullback\n• Enter when price bounces off ATR pullback level\n• Require strong volume momentum\n• Need volume spike/high\n• Must have good distance from ST\n\nAPPROACH:\n✓ More selective entries\n✓ Improved risk/reward potential\n✓ Focus on quality over quantity\n✓ Better alignment with money flow\n\nBased on:\n• Mark Minervini VCP pullbacks\n• William O'Neil volume confirmation\n• Dan Zanger volatility expansion" },
  { id: 'scalpelWindow', type: 'int', title: "Pullback Window", defval: 5, min: 2, max: 10, group: G4, inline: 'scalpel1', tooltip: "Bars to wait for pullback entry after flip" },
  { id: 'scalpelMinDist', type: 'float', title: "Min Distance (xATR)", defval: 0.4, min: 0.2, max: 1, step: 0.1, group: G4, inline: 'scalpel1', tooltip: "Minimum Distance from SuperTrend\n\nEnsures entry has sufficient distance from SuperTrend level for better risk/reward.\n\nMeasured in ATR multiples:\n• 0.2 = Very tight (20% of ATR)\n• 0.4 = Balanced (40% of ATR) - DEFAULT\n• 0.6 = Conservative (60% of ATR)\n• 1.0 = Very conservative (full ATR)\n\nHigher values:\n✅ Better risk/reward ratio\n✅ More room for stop placement\n❌ Fewer signals\n\nLower values:\n✅ More signals\n❌ Tighter stops needed\n\n💡 Use higher values (0.6-1.0) for volatile markets" },
  { id: 'scalpelQuality', type: 'int', title: "Scalpel Quality Min", defval: 55, min: 50, max: 90, group: G4, tooltip: "Quality threshold for Scalpel Mode (higher = stricter)\n\nMax possible score is 70. Default 55 keeps entries selective while still firing; 65+ almost never triggers (needs volume spike + expanding volatility + strong momentum together)." },
  { id: 'enablePrediction', type: 'bool', title: "Show Trend Duration Prediction", defval: true, group: G5, tooltip: "Display prediction box showing expected trend duration based on historical SuperTrend analysis. Analyzes last 15 trends to predict current trend lifespan." },
  { id: 'predictionMode', type: 'string', title: "Prediction Mode", defval: "Advanced", options: ["Simple", "Standard", "Advanced"], group: G5, tooltip: "Prediction Mode 🎯\n\nChoose your prediction complexity level:\n\n📊 SIMPLE:\n• Basic median-based predictions only\n• No advanced multipliers\n• Easiest to understand\n• Best for beginners\n\n⚙️ STANDARD (Recommended):\n• Full statistical analysis\n• All quality calculations\n• NO advanced multipliers\n• Balanced accuracy & simplicity\n\n🚀 ADVANCED:\n• Everything from Standard\n• PLUS 5 intelligent multipliers:\n  - Market Structure (±30%)\n  - Stock Type Behavior (±40%)\n  - Flip Strength (±20%)\n  - Error Learning (±15%)\n  - Regime Detection (±20%)\n• Highest accuracy (30-50% improvement)\n• Most complex\n\n💡 Recommendation:\n• Start with Standard\n• Move to Advanced after understanding basics" },
  { id: 'stockType', type: 'string', title: "Asset Type", defval: "Blue Chip / Large Cap", options: ["Small Cap", "Biotech / Speculative", "Blue Chip / Large Cap", "Tech Growth", "Dividend / Value", "Cyclical", "Crypto / High Volatility"], group: G5, tooltip: "Stock Type Classification\n\nDifferent assets have unique trend behaviors:\n\n📊 Small Cap (0.65x) - Shortest trends\n• High volatility, quick reversals\n• Best for: Penny stocks, micro-caps\n\n🧬 Biotech/Spec (0.55x) - Most volatile\n• News-driven, sharp moves\n• Best for: Biotech, pharma, speculative\n\n🏛️ Blue Chip (1.35x) - Longest trends\n• Stable, institutional\n• Best for: Large caps, indices\n\n🚀 Tech Growth (1.10x) - Extended trends\n• Growth stocks, momentum\n\n💰 Dividend (1.25x) - Stable trends\n• Value stocks, utilities\n\n🔄 Cyclical (0.90x) - Moderate trends\n• Sector rotation sensitive\n\n⚡ Crypto/High Vol (0.60x) - Extreme volatility\n• 24/7 markets, rapid changes" },
  { id: 'useEwa', type: 'bool', title: "Use Exponential Weighting", defval: true, group: G5, inline: 'ewa1', tooltip: "Exponential Weighted Average (EWA)\n\nGives more weight to recent trends vs older trends.\n\nBENEFITS:\n✅ More responsive to changing market conditions\n✅ Recent trends more relevant to current behavior\n✅ Adapts faster to regime changes\n\nDECAY FACTOR:\n• 0.95 = Slight preference to recent (balanced)\n• 0.90 = Moderate preference (recommended)\n• 0.80 = Strong preference (very adaptive)\n• 0.50 = Extreme preference (only recent matters)\n\nExample with 0.9:\n• Last trend: 100% weight\n• 2nd last: 90% weight\n• 3rd last: 81% weight\n• etc.\n\nDisable for equal weighting of all 15 trends." },
  { id: 'ewaDecay', type: 'float', title: "Decay Factor", defval: 0.9, min: 0.5, max: 0.99, step: 0.05, group: G5, inline: 'ewa1' },
  { id: 'outlierFilter', type: 'bool', title: "Filter Extreme Values", defval: true, group: G5, tooltip: "Outlier Filtering (IQR Method)\n\nRemoves extreme trend durations that could skew predictions.\n\nUses Interquartile Range (IQR):\n• Calculates Q1 (25th percentile) and Q3 (75th percentile)\n• Filters values outside Q1-2×IQR to Q3+2×IQR\n• Keeps at least 60% of data for reliability\n\nBenefits:\n✅ More stable predictions\n✅ Reduces impact of anomalies\n✅ Better accuracy in normal conditions\n\nDisable if:\n❌ You have very few samples (<10)\n❌ You want to include all historical data\n\nRecommended: ON (default)" },
  { id: 'useMedian', type: 'bool', title: "Use Median (more stable)", defval: true, group: G5, tooltip: "Use Median for Central Tendency\n\nChooses between median vs mean for predictions.\n\nMEDIAN (Recommended):\n✅ More robust to outliers\n✅ Represents typical trend duration\n✅ Better for skewed distributions\n✅ Stable with small sample sizes\n\nMEAN (Alternative):\n• Considers all data points equally\n• Sensitive to extreme values\n• Good for symmetric distributions\n\nThe indicator blends both (60% median + 40% trimmed mean) for optimal robustness.\n\nRecommended: ON (default)" },
  { id: 'structureLookback', type: 'int', title: "Structure Lookback", defval: 10, min: 3, max: 30, group: G5, inline: 'struct1', tooltip: "Market Structure Detection\n\nAnalyzes pivot highs/lows to identify key S/R levels.\n\nLOOKBACK PERIOD:\n• Bars left and right to confirm a pivot\n• Higher = stronger but fewer levels\n• Lower = more levels but less significant\n\nRecommended:\n• Scalping: 3-5 (recent levels)\n• Day Trading: 5-7 (intraday levels)\n• Swing: 10-15 (major levels)\n• Position: 20-30 (key levels)\n\nSENSITIVITY:\n• % of ATR to consider price \"near\" a level\n• 50% = within half ATR of level\n• 100% = within 1 full ATR\n\nAdjustment: Trends near levels get -30% duration" },
  { id: 'structureSensitivity', type: 'float', title: "Proximity (xATR)", defval: 0.5, min: 0.2, max: 1, step: 0.1, group: G5, inline: 'struct1' },
  { id: 'useErrorLearning', type: 'bool', title: "Enable Error Learning", defval: true, group: G5, inline: 'learn1', tooltip: "Error Learning System\n\nAdaptively learns from prediction mistakes:\n\n• Tracks last N predictions vs actual durations\n• Calculates error ratio (predicted / actual)\n• Adjusts future predictions accordingly\n\nMEMORY DEPTH:\n• How many past predictions to remember\n• Higher = more stable, slower adaptation\n• Lower = faster learning, more reactive\n\nRecommended:\n• 5 = Fast adaptation\n• 10 = Balanced (default)\n• 20 = Very stable\n\nExample:\n• If consistently over-predicting by 20%\n• System learns and reduces future predictions\n\nBenefits:\n✅ Self-correcting\n✅ Adapts to changing market regimes\n✅ Improves over time" },
  { id: 'errorMemoryDepth', type: 'int', title: "Memory Depth", defval: 10, min: 3, max: 20, group: G5, inline: 'learn1' },
  { id: 'godmodeEnabled', type: 'bool', title: "🚀 Enable GOD MODE", defval: true, group: G6, tooltip: "🚀 GOD MODE — Master Switch\n\nAdds a value layer on top of the classic engine:\n• MTF Confluence (higher-timeframe SuperTrend agreement)\n• SL / TP levels on every signal\n• Optional signal gating by higher-TF agreement\n\nOFF = the classic indicator, unchanged (zero behavior change).\nON  = full GOD MODE." },
  { id: 'htf1Tf', type: 'timeframe', title: "Higher TF 1", defval: "60", group: G6, inline: 'gm_mtf', active: { input: 'godmodeEnabled' }, tooltip: "Higher timeframes for confluence.\n\n⚠️ Set BOTH above your chart timeframe (e.g. on a 15m chart use 60 + 240).\nThe higher-TF SuperTrend direction is compared to the current chart for conviction." },
  { id: 'htf2Tf', type: 'timeframe', title: "Higher TF 2", defval: "240", group: G6, inline: 'gm_mtf', active: { input: 'godmodeEnabled' } },
  { id: 'mtfGateSignals', type: 'bool', title: "MTF: Only Signal When Higher TFs Agree", defval: false, group: G6, active: { input: 'godmodeEnabled' }, tooltip: "ON = a BUY needs BOTH higher TFs bullish (SELL needs both bearish). Fewer but higher-conviction signals.\nOFF = higher-TF info shown for context only; signals unchanged." },
  { id: 'showRiskLevels', type: 'bool', title: "Show SL / TP on Signals", defval: true, group: G6, active: { input: 'godmodeEnabled' }, tooltip: "Adds a Stop (at the SuperTrend line) and two R-multiple Take-Profit targets to every BUY/SELL tooltip." },
  { id: 'tp1R', type: 'float', title: "TP1 (x R)", defval: 2, min: 0.5, max: 10, step: 0.5, group: G6, inline: 'gm_tp', active: { input: 'godmodeEnabled' } },
  { id: 'tp2R', type: 'float', title: "TP2 (x R)", defval: 3.5, min: 0.5, max: 10, step: 0.5, group: G6, inline: 'gm_tp', active: { input: 'godmodeEnabled' } },
];

const RIBBON = Array.from({ length: 16 }, (_, k) => `plot${k + 1}`);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperTrend Line', color: '#4CAF50', lineWidth: 2 },
  ...RIBBON.map((id, k) => ({ id, title: `Ribbon Level ${k + 1}`, color: '#2962FF', lineWidth: 1, display: 'none' as const, editable: false })),
];

export const fillConfig: FillConfig[] = Array.from({ length: 15 }, (_, k) => ({
  id: `fill${k}`, plot1: RIBBON[k], plot2: RIBBON[k + 1], title: 'Plots Background', editable: false,
}));

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: "🟢 BUY Signal", message: "⬆️ LONG: {{ticker}} on {{interval}}\nSupertrend flipped bullish\nQuality Score: High\nVolume: Confirmed\n\nPrice: {{close}}\nTime: {{time}}" },
  { id: 'alert1', title: "🔴 SELL Signal", message: "⬇️ SHORT: {{ticker}} on {{interval}}\nSupertrend flipped bearish\nQuality Score: High\nVolume: Confirmed\n\nPrice: {{close}}\nTime: {{time}}" },
  { id: 'alert2', title: "🔔 ANY Signal (BUY or SELL)", message: "🔔 SIGNAL: {{ticker}} on {{interval}}\nSupertrend signal detected\n\nPrice: {{close}}\nTime: {{time}}\n\nCheck chart for direction!" },
];

/** The original also calls alert() on the signals */
export const hasAlertFunction = true;

export const drawingKinds: StudyDrawingKind[] = ['box', 'label', 'table'];

export const metadata = {
  title: 'Luxy Super-Duper SuperTrend Predictor Engine',
  shortTitle: 'Luxy SuperDuperTrend',
  overlay: true,
};

const MAX_BOXES = 500;
const MAX_LABELS = 50;
const PREDICTION_SAMPLES = 50;
const BOX_COUNT = 30;
const VOL_SPIKE_COOLDOWN = 8;
const BOLD = 1; // text.format_bold

const AUTO = 'Auto (Detect from TF)';
const SCALP = 'Scalping (1-5m)';
const DAY = 'Day Trading (15m-1h)';
const SWING = 'Swing Trading (4h-D)';
const POSITION = 'Position Trading (D-W)';

const POSITIONS: Record<string, string> = {
  'Top Left': 'top_left', 'Top Center': 'top_center', 'Top Right': 'top_right', 'Middle Left': 'middle_left',
  'Middle Center': 'middle_center', 'Middle Right': 'middle_right', 'Bottom Left': 'bottom_left',
  'Bottom Center': 'bottom_center', 'Bottom Right': 'bottom_right',
};
const SIZES: Record<string, string> = { Auto: 'auto', Tiny: 'tiny', Small: 'small', Normal: 'normal', Large: 'large', Huge: 'huge' };

/** Pine float comparisons (1e-10; na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const le = (a: number, b: number) => b - a > -EPS;
/** na() also holds for +-infinity */
const isNa = (x: number) => !Number.isFinite(x);
/** int(): truncation, na stays na */
const int = (x: number) => (Number.isFinite(x) ? Math.trunc(x) : NaN);

const A = (s: Series): number[] => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));

/** detect_trading_style() from the chart timeframe */
function detectTradingStyle(tf: string): string {
  const info = timeframe.info(tf);
  if (info.isminutes) return info.multiplier <= 5 ? SCALP : DAY;
  if (info.isintraday) return info.multiplier <= 1 ? DAY : SWING;
  if (info.isdaily) return SWING;
  if (info.isweekly || info.ismonthly) return POSITION;
  return DAY;
}

/** A preset value: the input in the Custom style (and for an unknown style), else the value of the style */
function preset<T>(style: string, custom: T, scalp: T, day: T, swing: T, position: T): T {
  if (style === 'Custom') return custom;
  if (style === SCALP) return scalp;
  if (style === DAY) return day;
  if (style === SWING) return swing;
  if (style === POSITION) return position;
  return custom;
}

/** Chart and requested timeframes in seconds ('' = the chart timeframe) */
function secondsOf(tf: string, chartSec: number): number {
  return tf.trim() === '' ? chartSec : timeframe.in_seconds(tf);
}

/** Bars the indicator needs: the chart symbol on each GOD MODE timeframe below the chart timeframe. */
export function requiredSymbols(inputs: Partial<LuxySuperDuperSupertrendPredictorEngineInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const chartTf = chartTimeframe([], chart);
  if (!cfg.godmodeEnabled || chartTf === '') return [];
  const chartSec = timeframe.in_seconds(chartTf);
  const symbol = tickeridOf(chart);
  const out: SymbolRequest[] = [];
  for (const tf of [cfg.htf1Tf, cfg.htf2Tf]) {
    if (secondsOf(tf, chartSec) < chartSec && !out.some((r) => r.timeframe === tf)) out.push({ symbol, timeframe: tf });
  }
  return out;
}

/** ewa_avg(): weights decay^(n - 1 - i), the newest value has weight 1 */
function ewaAvg(arr: number[], decay: number): number {
  if (arr.length === 0) return NaN;
  let sumWeighted = 0.0;
  let sumWeights = 0.0;
  const n = arr.length;
  for (let i = 0; i <= n - 1; i++) {
    const weight = Math.pow(decay, n - 1 - i);
    sumWeighted += arr[i] * weight;
    sumWeights += weight;
  }
  return sumWeighted / sumWeights;
}

/** get_stock_type_multiplier() */
function stockTypeMultiplier(stockType: string): number {
  switch (stockType) {
    case 'Small Cap': return 0.65;
    case 'Biotech / Speculative': return 0.55;
    case 'Blue Chip / Large Cap': return 1.35;
    case 'Tech Growth': return 1.10;
    case 'Dividend / Value': return 1.25;
    case 'Cyclical': return 0.90;
    case 'Crypto / High Volatility': return 0.60;
    default: return 1.0;
  }
}

/** calculate_flip_strength(): 0.5x (weak) to 2.0x (strong) */
function flipStrength(volRatio: number, atrRatio: number, quality: number): number {
  let strength = 0.0;
  if (ge(volRatio, 2.5)) strength += 40.0;
  else if (ge(volRatio, 1.5)) strength += 28.0;
  else if (ge(volRatio, 1.0)) strength += 15.0;
  if (ge(atrRatio, 1.2)) strength += 30.0;
  else if (ge(atrRatio, 1.0)) strength += 20.0;
  else if (ge(atrRatio, 0.8)) strength += 10.0;
  strength += (quality / 100.0) * 30.0;
  return 0.5 + (strength / 100.0) * 1.5;
}

/** calculate_learning_adjustment(): 0.85x to 1.15x from the average predicted / actual ratio */
function learningAdjustment(errorRatios: number[]): number {
  let learningMult = 1.0;
  if (errorRatios.length < 3) return learningMult;
  const avgErrorRatio = array.avg(errorRatios);
  if (gt(avgErrorRatio, 1.0)) learningMult = 1.0 - Math.min((avgErrorRatio - 1.0) * 0.5, 0.15);
  else if (lt(avgErrorRatio, 1.0)) learningMult = 1.0 + Math.min((1.0 - avgErrorRatio) * 0.5, 0.15);
  return learningMult;
}

/** find_probability_threshold(): inverse Weibull (k = 1.5) of the target, 5 to 500 bars */
function probabilityThreshold(target: number, medianDuration: number, decayRate: number): number {
  if (le(medianDuration, 0) || ge(target, 1.0)) return NaN;
  const k = 1.5;
  const lambda = medianDuration / Math.pow(0.693, 1 / k);
  let adjustedTarget = 0.5 + (target - 0.5) / decayRate;
  adjustedTarget = Math.max(0.01, Math.min(0.99, adjustedTarget));
  const x = lambda * Math.pow(-Math.log(1.0 - adjustedTarget), 1.0 / k);
  return Math.max(5, Math.min(500, x));
}

/** empirical_survival_pct(): % of the durations that are x or more */
function survivalPct(arr: number[], x: number): number {
  const n = arr.length;
  if (n === 0) return NaN;
  let cnt = 0;
  for (let i = 0; i <= n - 1; i++) if (ge(arr[i], x)) cnt += 1;
  return (100.0 * cnt) / n;
}

/** calculate_regime_multiplier(): recent (last `depth`) average against the average of all durations */
function regimeMultiplier(durations: number[], depth: number): number {
  let regimeMult = 1.0;
  const total = durations.length;
  if (total < depth) return regimeMult;
  let recentSum = 0.0;
  for (let i = 0; i <= depth - 1; i++) recentSum += durations[total - 1 - i];
  const recentAvg = recentSum / depth;
  const ratio = recentAvg / array.avg(durations);
  if (ge(ratio, 1.3)) regimeMult = 1.2;
  else if (ge(ratio, 1.1)) regimeMult = 1.1;
  else if (le(ratio, 0.7)) regimeMult = 0.8;
  else if (le(ratio, 0.9)) regimeMult = 0.9;
  return regimeMult;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LuxySuperDuperSupertrendPredictorEngineInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const unit = n > 0 && bars[0].time >= 1e12 ? 'ms' : 's';
  resetDrawings({ box: MAX_BOXES, label: MAX_LABELS });
  const mintick = mintickOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);
  const tostr = (v: number, fmt?: string): string => str.tostring(v, fmt, mintick);

  // ---- inputs and presets (Pine names)
  const chartTf = chartTimeframe(bars, chart) || '1D';
  const actual_style = cfg.tradingStyle === AUTO ? detectTradingStyle(chartTf) : cfg.tradingStyle;
  const st_length = preset(actual_style, cfg.stLength, 7, 10, 14, 21);
  const st_mult = preset(actual_style, cfg.stMult, 2.0, 2.5, 3.0, 4.0);
  const st_use_adaptive = cfg.stUseAdaptive;
  const st_smooth_factor = cfg.stSmoothFactor;
  const st_neutral_bars = cfg.stNeutralBars;
  const use_volume_momentum = actual_style === SCALP ? false : cfg.volumeMomentumEnabled;
  const vol_mom_fast = preset(actual_style, cfg.volMomFast, 3, 5, 10, 20);
  const vol_mom_slow = preset(actual_style, cfg.volMomSlow, 10, 20, 30, 50);
  const vol_length = preset(actual_style, cfg.volLength, 10, 20, 30, 50);
  const vol_high_threshold = preset(actual_style, cfg.volHighThreshold, 1.8, 1.5, 1.3, 1.2);
  const vol_spike_threshold = preset(actual_style, cfg.volSpikeThreshold, 3.0, 2.5, 2.2, 2.0);
  const vol_low_threshold = cfg.volLowThreshold;
  const min_quality_score = cfg.minQualityScore;
  const i_prediction_mode = cfg.predictionMode;
  const i_stock_type = cfg.stockType;
  const i_use_ewa = cfg.useEwa;
  const i_ewa_decay = cfg.ewaDecay;
  const i_use_error_learning = cfg.useErrorLearning;
  const i_error_memory_depth = cfg.errorMemoryDepth;
  const i_structure_lookback = cfg.structureLookback;
  const i_structure_sensitivity = cfg.structureSensitivity;
  const godmode_enabled = cfg.godmodeEnabled;
  const htf1_tf = cfg.htf1Tf;
  const htf2_tf = cfg.htf2Tf;
  const mtf_gate_signals = cfg.mtfGateSignals;
  const show_risk_levels = cfg.showRiskLevels;
  const tp1_r = cfg.tp1R;
  const tp2_r = cfg.tp2R;
  const label_size_const = SIZES[cfg.labelTextSize] ?? 'huge';
  const advanced = i_prediction_mode === 'Advanced';

  // ---- series
  const closeArr = bars.map((b) => b.close);
  const highArr = bars.map((b) => b.high);
  const lowArr = bars.map((b) => b.low);
  const volumeArr = bars.map((b) => b.volume ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const volS = S(volumeArr);
  const atrSArr = A(ta.atr(bars, st_length));
  const volStSma = A(ta.sma(volS, st_length));
  const corr = A(ta.correlation(S(closeArr), S(bars.map((_, i) => i)), st_length));
  const volMaFast = A(ta.sma(volS, vol_mom_fast));
  const volMaSlow = A(ta.sma(volS, vol_mom_slow));
  const volMa = A(ta.sma(volS, vol_length));
  const atrCurrentArr = A(ta.atr(bars, 14));
  const atrMaArr = A(ta.sma(S(atrCurrentArr), 20));
  const gPh = A(ta.pivothigh(S(highArr), i_structure_lookback, i_structure_lookback));
  const gPl = A(ta.pivotlow(S(lowArr), i_structure_lookback, i_structure_lookback));

  // ---- higher timeframe directions: request.security(syminfo.tickerid, tf, ta.supertrend(st_mult, st_length) direction)
  const htfDirs: number[][] = [new Array<number>(n).fill(NaN), new Array<number>(n).fill(NaN)];
  if (godmode_enabled && n > 0) {
    const chartSec = timeframe.in_seconds(chartTf);
    const lower = requiredSymbols(cfg, { ...chart, timeframe: chartTf } as ChartContext);
    const lowerBars = lower.length > 0 ? symbolBarsOf(lower, chart) : [];
    const merge = otherSymbolChart(bars, chart);
    const calendar = { other: { timezone: chart?.timezone, session: chart?.session } };
    [htf1_tf, htf2_tf].forEach((tf, k) => {
      const out = htfDirs[k];
      const sec = secondsOf(tf, chartSec);
      if (sec === chartSec) {
        const dir = A(ta.supertrend(bars, st_mult, st_length)[1]);
        for (let i = 0; i < n; i++) out[i] = dir[i];
      } else if (sec > chartSec) {
        const htf = higherTimeframeBars(bars, tf, chart);
        const dir = A(ta.supertrend(htf.htf, st_mult, st_length)[1]);
        for (let i = 0; i < n; i++) {
          // a live last bar shows the open bar of the timeframe; the other bars the latest completed one
          const g = !lastConfirmed && i === n - 1 ? htf.group[i] : htf.latest[i];
          out[i] = g >= 0 ? dir[g] : NaN;
        }
      } else {
        const ltf = lowerBars[lower.findIndex((r) => r.timeframe === tf)];
        const dir = A(ta.supertrend(ltf, st_mult, st_length)[1]);
        const shown = securityOther(bars, ltf, tf, merge, calendar);
        for (let i = 0; i < n; i++) out[i] = shown[i] >= 0 ? dir[shown[i]] : NaN;
      }
    });
  }

  // ---- outputs
  const plot0: { time: number; value: number; color: string }[] = [];
  const ribbonPlots: { time: number; value: number }[][] = RIBBON.map(() => []);
  const fillColors: string[][] = Array.from({ length: 15 }, () => []);
  const goldenFlags: boolean[] = [];
  const deathFlags: boolean[] = [];
  const alertCalls: AlertCall[] = [];

  // ---- state (var)
  let up_prev = NaN;
  let dn_prev = NaN;
  let dir_prev = NaN;
  let last_flip_bar = -1;
  let bars_since_bull_flip = 999;
  let bars_since_bear_flip = 999;
  let signal_given_in_bull_window = false;
  let signal_given_in_bear_window = false;
  const overPullback = callsite.crossover();
  const underPullback = callsite.crossunder();

  const bull_trend_durations: number[] = [];
  const bear_trend_durations: number[] = [];
  let current_trend_bars = 0;
  let flip_bar_index = 0;
  let flip_supertrend_level = NaN;
  const all_trend_durations: number[] = [];
  const all_trend_is_bullish: boolean[] = [];
  const prediction_boxes: Box[] = [];
  const prediction_labels: Label[] = [];
  const prediction_box_counts: number[] = [];
  const prediction_label_counts: number[] = [];
  const last_10_predicted_avg: number[] = [];
  const last_10_predicted_end: number[] = [];
  const last_10_actual_duration: number[] = [];
  const last_10_is_bullish: boolean[] = [];
  const trend_quality_scores: number[] = [];
  const trend_volume_ratios: number[] = [];
  const all_flip_volatility_ratios: number[] = [];
  const all_flip_distances_from_st: number[] = [];
  let current_predicted_avg = NaN;
  let current_predicted_end = NaN;
  let current_prediction_is_bullish = false;
  let success_count = 0;
  let success_rate = NaN;
  let avg_accuracy = NaN;
  let prediction_count = 0;
  const error_ratios: number[] = [];
  const all_flip_structure_mults: number[] = [];
  const all_flip_stock_type_mults: number[] = [];
  const all_flip_strength_mults: number[] = [];
  const all_flip_learning_mults: number[] = [];
  const all_flip_regime_mults: number[] = [];
  let advanced_structure_mult = 1.0;
  let advanced_stock_type_mult = 1.0;
  let advanced_flip_strength_mult = 1.0;
  let advanced_learning_mult = 1.0;
  let advanced_regime_mult = 1.0;
  const g_pivot_highs: number[] = [];
  const g_pivot_lows: number[] = [];
  let bars_since_vol_spike_label = 999;
  const dashTable = varDrawing<Table>();

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const isLast = i === n - 1;
    const isconfirmed = !isLast || lastConfirmed;
    const b = bars[i];
    const close = closeArr[i];
    const high = highArr[i];
    const low = lowArr[i];
    const volume = volumeArr[i];
    const hl2 = (high + low) / 2;
    const atrS = atrSArr[i];

    // ===== adaptive SuperTrend
    let volWeight = volume / volStSma[i];
    volWeight = isNa(volWeight) ? 1.0 : volWeight;
    let trendStrength = Math.abs(corr[i]);
    trendStrength = isNa(trendStrength) ? 0.5 : trendStrength;
    const adaptiveMult = st_use_adaptive
      ? st_mult * (0.8 + trendStrength * 0.4) * Math.sqrt(Math.max(0.1, volWeight))
      : st_mult;
    const upRaw = hl2 - atrS * adaptiveMult;
    const dnRaw = hl2 + atrS * adaptiveMult;
    let upLine: number;
    let dnLine: number;
    if (Number.isNaN(up_prev)) {
      upLine = upRaw;
      dnLine = dnRaw;
    } else {
      upLine = gt(close, up_prev) ? up_prev * (1 - st_smooth_factor) + upRaw * st_smooth_factor : upRaw;
      dnLine = lt(close, dn_prev) ? dn_prev * (1 - st_smooth_factor) + dnRaw * st_smooth_factor : dnRaw;
    }
    let stDir = Number.isNaN(dir_prev) ? (ge(close, hl2) ? 1 : -1) : dir_prev;
    stDir = stDir === -1 && gt(close, dn_prev) ? 1 : stDir === 1 && lt(close, up_prev) ? -1 : stDir;
    // stDir != stDir[1]: false on the first bar (na)
    const stFlip = i > 0 && stDir !== dir_prev;
    if (stFlip) last_flip_bar = i;
    let neutral = false;
    if (st_neutral_bars > 0) {
      const barsSinceFlip = last_flip_bar >= 0 ? i - last_flip_bar : NaN;
      neutral = barsSinceFlip >= 0 && barsSinceFlip < st_neutral_bars;
    }
    const supertrend = stDir === 1 ? upLine : dnLine;
    const is_bullish = stDir === 1;
    const is_bearish = stDir === -1;
    const supertrend_flip_bullish = stFlip && stDir === 1;
    const supertrend_flip_bearish = stFlip && stDir === -1;
    const st_line_color = is_bullish ? cfg.bullColor : cfg.bearColor;
    const show_line = cfg.showSupertrendLine && !neutral && !stFlip;
    plot0.push({ time: b.time, value: show_line && Number.isFinite(supertrend) ? supertrend : NaN, color: st_line_color });

    // ===== MTF confluence (ta.supertrend direction: -1 = up)
    const htf1_dir = htfDirs[0][i];
    const htf2_dir = htfDirs[1][i];
    const htf1_bull = htf1_dir < 0;
    const htf2_bull = htf2_dir < 0;
    const mtf_bull_count = (htf1_bull ? 1 : 0) + (htf2_bull ? 1 : 0);
    const mtf_agree_count = (isNa(htf1_dir) ? 0 : is_bullish === htf1_bull ? 1 : 0) + (isNa(htf2_dir) ? 0 : is_bullish === htf2_bull ? 1 : 0);

    // ===== volume momentum, volume, volatility
    const vol_momentum_ratio = volMaFast[i] / volMaSlow[i];
    const vol_momentum_rising = gt(vol_momentum_ratio, 1.0);
    const vol_momentum_strong = gt(vol_momentum_ratio, 1.2);
    const vol_momentum_confirms_bull = is_bullish && vol_momentum_rising;
    const vol_momentum_confirms_bear = is_bearish && vol_momentum_rising;
    const vol_momentum_strong_trend = (is_bullish && vol_momentum_strong) || (is_bearish && vol_momentum_strong);
    const vol_ma = volMa[i];
    const vol_ratio = volume / vol_ma;
    const vol_is_spike = ge(vol_ratio, vol_spike_threshold);
    const vol_is_high = ge(vol_ratio, vol_high_threshold);
    const vol_is_low = le(vol_ratio, vol_low_threshold);
    const vol_state = vol_is_spike ? "💥 SPIKE" : vol_is_high ? "🔥 HIGH" : vol_is_low ? "📍 LOW" : "➡️ NORMAL";
    const basic_volume_confirm = ge(vol_ratio, 1.0);
    const atr_current = atrCurrentArr[i];
    const atr_ma = atrMaArr[i];
    const atr_ratio = atr_current / atr_ma;
    const vol_expanding = ge(atr_ratio, 1.3);
    const vol_rising = ge(atr_ratio, 1.0) && lt(atr_ratio, 1.3);
    const vol_contracting = le(atr_ratio, 0.9);
    const volatility_state = ge(atr_ratio, 1.3) ? "🔥 EXPANDING" : vol_rising ? "📈 RISING" : vol_contracting ? "📉 CONTRACTING" : "➡️ STABLE";

    // ===== quality score (0-70)
    const quality_score = (vol_is_spike ? 30 : vol_is_high ? 20 : basic_volume_confirm ? 10 : 0)
      + (vol_expanding ? 30 : vol_rising ? 15 : 0)
      + (use_volume_momentum && vol_momentum_strong_trend ? 10 : use_volume_momentum && vol_momentum_rising ? 5 : 0);
    const quality_level = ge(quality_score, 60) ? "⭐⭐⭐ EXCELLENT" : ge(quality_score, 45) ? "⭐⭐ STRONG" : ge(quality_score, 30) ? "⭐ GOOD" : "⚠️ WEAK";

    // ===== signals
    const signal_quality_ok = quality_score >= min_quality_score;
    const volume_ok = !cfg.requireVolumeConfirm || basic_volume_confirm;
    const vol_momentum_ok_long = !use_volume_momentum || vol_momentum_confirms_bull;
    const vol_momentum_ok_short = !use_volume_momentum || vol_momentum_confirms_bear;
    const classic_long = supertrend_flip_bullish && signal_quality_ok && volume_ok && vol_momentum_ok_long;
    const classic_short = supertrend_flip_bearish && signal_quality_ok && volume_ok && vol_momentum_ok_short;

    // Scalpel Mode
    if (supertrend_flip_bullish) {
      bars_since_bull_flip = 0;
      signal_given_in_bull_window = false;
    } else if (bars_since_bull_flip < 999) bars_since_bull_flip += 1;
    if (supertrend_flip_bearish) {
      bars_since_bear_flip = 0;
      signal_given_in_bear_window = false;
    } else if (bars_since_bear_flip < 999) bars_since_bear_flip += 1;
    const in_bull_window = bars_since_bull_flip > 0 && bars_since_bull_flip <= cfg.scalpelWindow;
    const in_bear_window = bars_since_bear_flip > 0 && bars_since_bear_flip <= cfg.scalpelWindow;
    const pullback_level_long = is_bullish ? supertrend + atrS * 0.5 : NaN;
    const pullback_level_short = is_bearish ? supertrend - atrS * 0.5 : NaN;
    const bounce_long = overPullback(close, pullback_level_long);
    const scalpel_long = in_bull_window && is_bullish && bounce_long && vol_momentum_rising
      && ge(close - supertrend, atr_current * cfg.scalpelMinDist) && basic_volume_confirm
      && quality_score >= cfg.scalpelQuality && !signal_given_in_bull_window;
    const bounce_short = underPullback(close, pullback_level_short);
    const scalpel_short = in_bear_window && is_bearish && bounce_short && vol_momentum_rising
      && ge(supertrend - close, atr_current * cfg.scalpelMinDist) && basic_volume_confirm
      && quality_score >= cfg.scalpelQuality && !signal_given_in_bear_window;
    if (scalpel_long) signal_given_in_bull_window = true;
    if (scalpel_short) signal_given_in_bear_window = true;

    const mtf_long_ok = !(godmode_enabled && mtf_gate_signals) || mtf_bull_count === 2;
    const mtf_short_ok = !(godmode_enabled && mtf_gate_signals) || mtf_bull_count === 0;
    const goldenCross = (cfg.useScalpel ? scalpel_long : classic_long) && mtf_long_ok;
    const deathCross = (cfg.useScalpel ? scalpel_short : classic_short) && mtf_short_ok;
    goldenFlags.push(goldenCross);
    deathFlags.push(deathCross);

    // ===== S/R pivots (every bar)
    if (!Number.isNaN(gPh[i])) {
      g_pivot_highs.push(gPh[i]);
      if (g_pivot_highs.length > 10) g_pivot_highs.shift();
    }
    if (!Number.isNaN(gPl[i])) {
      g_pivot_lows.push(gPl[i]);
      if (g_pivot_lows.length > 10) g_pivot_lows.shift();
    }

    // ===== trend duration tracking and prediction
    if (stFlip && isconfirmed) {
      trend_quality_scores.push(quality_score);
      trend_volume_ratios.push(vol_ratio);
      if (trend_quality_scores.length > PREDICTION_SAMPLES) {
        trend_quality_scores.shift();
        trend_volume_ratios.shift();
      }
      if (advanced && i_use_error_learning && !isNa(current_predicted_end) && current_trend_bars > 0) {
        error_ratios.push(current_predicted_end / current_trend_bars);
        if (error_ratios.length > i_error_memory_depth) error_ratios.shift();
      }
      if (!isNa(current_predicted_avg) && !isNa(current_predicted_end)) {
        last_10_predicted_avg.push(current_predicted_avg);
        last_10_predicted_end.push(current_predicted_end);
        last_10_actual_duration.push(current_trend_bars);
        last_10_is_bullish.push(current_prediction_is_bullish);
        if (last_10_actual_duration.length > 10) {
          last_10_predicted_avg.shift();
          last_10_predicted_end.shift();
          last_10_actual_duration.shift();
          last_10_is_bullish.shift();
        }
      }

      advanced_structure_mult = 1.0;
      advanced_stock_type_mult = 1.0;
      advanced_flip_strength_mult = 1.0;
      advanced_learning_mult = 1.0;
      advanced_regime_mult = 1.0;
      if (advanced) {
        // get_structure_multiplier(close, g_pivot_highs, g_pivot_lows, i_structure_sensitivity)
        if (g_pivot_highs.length > 0 || g_pivot_lows.length > 0) {
          const proximity = atr_current * i_structure_sensitivity;
          const near = g_pivot_highs.some((lv) => le(Math.abs(close - lv), proximity))
            || g_pivot_lows.some((lv) => le(Math.abs(close - lv), proximity));
          advanced_structure_mult = near ? 0.70 : 1.0;
        }
        advanced_stock_type_mult = stockTypeMultiplier(i_stock_type);
        advanced_flip_strength_mult = flipStrength(vol_ratio, atr_ratio, quality_score);
        if (i_use_error_learning) advanced_learning_mult = learningAdjustment(error_ratios);
        advanced_regime_mult = regimeMultiplier(stDir === 1 ? bull_trend_durations : bear_trend_durations, 3);
      }

      // the trend that ends has the other direction
      const ended = stDir === 1 ? bear_trend_durations : bull_trend_durations;
      ended.push(current_trend_bars);
      if (ended.length > PREDICTION_SAMPLES) ended.shift();
      all_trend_durations.push(current_trend_bars);
      all_trend_is_bullish.push(stDir !== 1);
      all_flip_structure_mults.push(advanced_structure_mult);
      all_flip_stock_type_mults.push(advanced_stock_type_mult);
      all_flip_strength_mults.push(advanced_flip_strength_mult);
      all_flip_learning_mults.push(advanced_learning_mult);
      all_flip_regime_mults.push(advanced_regime_mult);
      all_flip_volatility_ratios.push(atr_ratio);
      all_flip_distances_from_st.push(Math.abs(close - supertrend));
      if (all_trend_durations.length > PREDICTION_SAMPLES) {
        for (const a of [all_trend_durations, all_trend_is_bullish, all_flip_structure_mults, all_flip_stock_type_mults,
          all_flip_strength_mults, all_flip_learning_mults, all_flip_regime_mults, all_flip_volatility_ratios,
          all_flip_distances_from_st]) a.shift();
      }

      flip_bar_index = i;
      flip_supertrend_level = supertrend;
      current_trend_bars = 1;

      if (cfg.enablePrediction) {
        const new_trend_is_bullish = stDir === 1;
        const current_dist = Math.abs(close - supertrend);
        const current_near_level = lt(advanced_structure_mult, 1.0);

        // get_similar_trends(..., 15, 5): durations of the same direction sorted by similarity (top 15), all of them
        // when 5 or fewer
        const scores: number[] = [];
        const durations: number[] = [];
        for (let k = 0; k <= all_trend_durations.length - 1; k++) {
          if (all_trend_is_bullish[k] !== new_trend_is_bullish) continue;
          const hist_near_level = lt(all_flip_structure_mults[k], 1.0);
          // calculate_similarity_score()
          let similarity = 0.0;
          const dv = Math.abs(vol_ratio - trend_volume_ratios[k]);
          if (le(dv, 0.5)) similarity += 30.0;
          else if (le(dv, 1.0)) similarity += 15.0;
          const da = Math.abs(atr_ratio - all_flip_volatility_ratios[k]);
          if (le(da, 0.3)) similarity += 30.0;
          else if (le(da, 0.6)) similarity += 15.0;
          const dq = Math.abs(quality_score - trend_quality_scores[k]);
          if (le(dq, 15)) similarity += 20.0;
          else if (le(dq, 30)) similarity += 10.0;
          if (le(Math.abs(current_dist / atr_current - all_flip_distances_from_st[k] / atr_current), 0.5)) similarity += 10.0;
          if (current_near_level === hist_near_level) similarity += 10.0;
          scores.push(similarity);
          durations.push(all_trend_durations[k]);
        }
        let trend_type_durations: number[];
        if (scores.length <= 5) {
          trend_type_durations = durations.slice();
        } else {
          const valid = scores.length;
          for (let p = 0; p <= valid - 2; p++) {
            for (let q = 0; q <= valid - 2 - p; q++) {
              if (lt(scores[q], scores[q + 1])) {
                [scores[q], scores[q + 1]] = [scores[q + 1], scores[q]];
                [durations[q], durations[q + 1]] = [durations[q + 1], durations[q]];
              }
            }
          }
          trend_type_durations = durations.slice(0, Math.min(15, valid));
        }
        const trend_samples = trend_type_durations.length;
        const min_samples_needed = actual_style === SCALP ? 5 : actual_style === DAY ? 3 : actual_style === SWING ? 2 : 1;

        if (trend_samples >= min_samples_needed) {
          let trend_predicted_end = NaN;
          let trend_avg = NaN;
          let trend_median = NaN;
          let trend_spread = NaN;
          let filtered_durations: number[];
          // calculate_decay_rate()
          let current_decay_rate = 1.0;
          if (gt(vol_ratio, 2.5)) current_decay_rate *= 1.3;
          else if (gt(vol_ratio, 1.5)) current_decay_rate *= 1.1;
          else if (lt(vol_ratio, 0.7)) current_decay_rate *= 0.85;
          if (gt(atr_ratio, 1.3)) current_decay_rate *= 1.2;
          else if (lt(atr_ratio, 0.8)) current_decay_rate *= 0.9;

          if (i_prediction_mode === 'Simple') {
            trend_median = array.median(trend_type_durations);
            trend_avg = trend_median;
            trend_spread = 0.0;
            filtered_durations = trend_type_durations.slice();
            trend_predicted_end = trend_median * 2.5;
          } else {
            filtered_durations = trend_type_durations.slice();
            if (filtered_durations.length >= 5) {
              const p10 = array.percentile_nearest_rank(filtered_durations, 10);
              const p90 = array.percentile_nearest_rank(filtered_durations, 90);
              for (let k = filtered_durations.length - 1; k >= 0; k--) {
                const val = filtered_durations[k];
                if (lt(val, p10) || gt(val, p90)) filtered_durations.splice(k, 1);
              }
            }
            trend_median = array.median(filtered_durations);
            const trim_count = int(filtered_durations.length * 0.2);
            const trimmed = filtered_durations.slice();
            array.sort(trimmed);
            if (trim_count > 0 && trimmed.length > 2 * trim_count) {
              for (let k = 0; k <= trim_count - 1; k++) {
                trimmed.shift();
                trimmed.pop();
              }
            }
            const trimmed_mean = trimmed.length > 0 ? (i_use_ewa ? ewaAvg(trimmed, i_ewa_decay) : array.avg(trimmed)) : trend_median;
            trend_avg = trend_median * 0.6 + trimmed_mean * 0.4;
            const deviations = filtered_durations.map((d) => Math.abs(d - trend_median));
            const mad = array.median(deviations);
            const iqr_spread = array.percentile_nearest_rank(filtered_durations, 75) - array.percentile_nearest_rank(filtered_durations, 25);
            trend_spread = mad * 1.4826 * 0.5 + iqr_spread * 0.7 * 0.5;
            const volatility_adj = gt(atr_ratio, 1.2) ? 0.85 : lt(atr_ratio, 0.8) ? 1.15 : 1.0;
            const volume_adj = gt(vol_ratio, 2.0) ? 0.8 : lt(vol_ratio, 0.7) ? 1.2 : 1.0;
            let style_multiplier = 1.0;
            if (actual_style === SCALP) {
              style_multiplier = 0.7;
              trend_spread = trend_spread * 0.8;
            } else if (actual_style === DAY) {
              style_multiplier = 0.85;
            } else if (actual_style === SWING) {
              style_multiplier = 1.1;
              trend_spread = trend_spread * 1.1;
            } else if (actual_style === POSITION) {
              style_multiplier = 1.3;
              trend_spread = trend_spread * 1.2;
            }
            const context_multiplier = volatility_adj * volume_adj * style_multiplier;
            const base_percentile = lt(advanced_flip_strength_mult, 0.7)
              ? array.percentile_nearest_rank(filtered_durations, 25)
              : gt(advanced_flip_strength_mult, 1.3) ? array.percentile_nearest_rank(filtered_durations, 90) : trend_median;
            trend_predicted_end = probabilityThreshold(0.95, base_percentile, current_decay_rate);
            if (!isNa(trend_predicted_end)) {
              trend_predicted_end = trend_predicted_end * context_multiplier;
              trend_predicted_end = Math.min(trend_predicted_end, 500);
            }
          }

          if (advanced) {
            let total_mult = advanced_structure_mult * advanced_stock_type_mult * advanced_flip_strength_mult * advanced_learning_mult * advanced_regime_mult;
            total_mult = Math.max(0.4, Math.min(2.0, total_mult));
            trend_predicted_end = trend_predicted_end * total_mult;
          }
          trend_predicted_end = Math.min(trend_predicted_end, 500);

          // tooltip
          const trend_samples_display = trend_samples;
          const trend_confidence = Math.min(100, (trend_samples_display / PREDICTION_SAMPLES) * 100);
          const trend_confidence_label = gt(trend_confidence, 80) ? 'High' : gt(trend_confidence, 50) ? 'Medium' : 'Low';
          const trend_data_quality = trend_samples_display >= PREDICTION_SAMPLES ? 'Excellent' : trend_samples_display >= 10 ? 'Good' : 'Limited';
          const weighting_method = i_use_ewa ? "EWA (Decay: " + tostr(i_ewa_decay, "#.##") + ")" : "Equal weights";
          const trend_min = array.min(trend_type_durations);
          const trend_max = array.max(trend_type_durations);
          let advanced_section = '';
          if (advanced) advanced_section = "\n\n─────────────────────────────\n" + "   ADVANCED ADJUSTMENTS 🚀\n" + "─────────────────────────────\n\n" + "🏛️ Market Structure: " + tostr(advanced_structure_mult, "#.##") + "x\n" + "📊 Stock Type (" + i_stock_type + "): " + tostr(advanced_stock_type_mult, "#.##") + "x\n" + "💪 Flip Strength: " + tostr(advanced_flip_strength_mult, "#.##") + "x\n" + (i_use_error_learning ? "🧠 Error Learning: " + tostr(advanced_learning_mult, "#.##") + "x\n" : "") + "⚡ Regime: " + tostr(advanced_regime_mult, "#.##") + "x\n" + "⚡ Total Impact: " + tostr(advanced_structure_mult * advanced_stock_type_mult * advanced_flip_strength_mult * advanced_learning_mult * advanced_regime_mult, "#.##") + "x\n\n💡 Advanced mode active";
          const mode_info = i_prediction_mode === "Simple" ? "📊 SIMPLE MODE - Basic median calculation" : i_prediction_mode === "Standard" ? "⚙️ STANDARD MODE - Full statistical analysis" : "🚀 ADVANCED MODE - Statistics + multipliers";
          const trend_tooltip = "════════════════════════════\n" + "  HISTORICAL TREND ANALYSIS\n" + "════════════════════════════\n\n" + mode_info + "\n\n" + "📊 Estimated Range: " + tostr(int(trend_predicted_end)) + " bars\n" + "   (Based on past trend patterns)\n" + "📈 Trend Type: " + (new_trend_is_bullish ? "Bullish" : "Bearish") + "\n\n" + "─────────────────────────────\n" + "       CONFIDENCE METRICS\n" + "─────────────────────────────\n\n" + "💪 Data Confidence: " + tostr(int(trend_confidence)) + "% (" + trend_confidence_label + ")\n" + "🔬 Sample Size: " + tostr(trend_samples_display) + " past trends\n" + "📊 Data Quality: " + trend_data_quality + "\n" + "⚖️ Weighting: " + weighting_method + "\n\n" + "─────────────────────────────\n" + "      HISTORICAL STATISTICS\n" + "─────────────────────────────\n\n" + "📉 Average: " + tostr(trend_avg, "#.#") + " bars (50% point)\n" + "📐 Spread: ±" + tostr(trend_spread, "#.#") + " bars\n" + "📌 Range: " + tostr(trend_min) + " - " + tostr(trend_max) + " bars\n" + "📊 Median: " + tostr(trend_median, "#.#") + " bars\n" + "🎯 Extended Range: " + tostr(trend_predicted_end, "#.#") + " bars" + advanced_section + "\n\n─────────────────────────────\n\n" + "⚠️ IMPORTANT:\n" + "This analyzes " + tostr(trend_samples_display) + " past SuperTrend trends.\n" + "Future trends may behave differently.\n" + "Not investment advice." + (i_use_ewa ? "\n\n💡 Using EWA: Recent trends weighted higher" : "");

          // delete the oldest prediction when 5 are kept
          if (prediction_box_counts.length >= 5) {
            const box_count = prediction_box_counts.shift() as number;
            const label_count = prediction_label_counts.shift() as number;
            for (let k = 0; k <= box_count - 1; k++) box.delete(prediction_boxes.shift() as Box);
            for (let k = 0; k <= label_count - 1; k++) label.delete(prediction_labels.shift() as Label);
          }

          const box_width = trend_predicted_end / BOX_COUNT;
          const box_height = atrS * 0.12;
          let box_top: number;
          let box_bottom: number;
          if (new_trend_is_bullish) {
            box_top = flip_supertrend_level - atrS * 0.03;
            box_bottom = box_top - box_height;
          } else {
            box_bottom = flip_supertrend_level + atrS * 0.03;
            box_top = box_bottom + box_height;
          }
          const base_color = new_trend_is_bullish ? color.green : color.red;
          let new_box_count = 0;
          let new_label_count = 0;
          for (let k = 0; k <= BOX_COUNT - 1; k++) {
            const box_left = flip_bar_index + int(k * box_width);
            const box_right = flip_bar_index + int((k + 1) * box_width);
            const opacity = 5 + int((k / 29.0) * 90);
            const box_color = String(color.new(base_color, opacity));
            // border_color = na; the v6 default box text colour is white
            prediction_boxes.push(box.new(box_left, box_top, box_right, box_bottom, 'transparent', undefined, undefined,
              undefined, undefined, box_color, undefined, undefined, color.white));
            new_box_count += 1;
          }
          const center_bar = flip_bar_index + int(trend_predicted_end / 2);
          prediction_labels.push(label.new(center_bar, box_top, "ℹ️ Trend Analysis", 'bar_index', 'price',
            String(color.new(color.blue, 0)), 'label_down', color.white, label_size_const, undefined, trend_tooltip));
          new_label_count += 1;

          const prob_positions = [0.25, 0.50, 0.75, 0.90, 1.00];
          for (let k = 0; k <= 4; k++) {
            const position_ratio = prob_positions[k];
            const prob_bar = flip_bar_index + int(position_ratio * trend_predicted_end);
            const bars_from_start = position_ratio * trend_predicted_end;
            const continuation_pct = survivalPct(filtered_durations, bars_from_start);
            const rounded_percentage = isNa(continuation_pct) ? 0 : int(Math.round(continuation_pct / 5.0) * 5);
            const prob_text = tostr(rounded_percentage) + "%";
            const prob_tooltip = "HISTORICAL TREND FREQUENCY\n" + "━━━━━━━━━━━━━━━━\n" + "At bar #" + tostr(int(bars_from_start)) + " from trend start\n\n" + "📈 " + tostr(rounded_percentage) + "% = Historical frequency: past trends reached here\n" + "📊 " + tostr(100 - rounded_percentage) + "% = Historical frequency: past trends ended before\n\n" + "Example: " + tostr(rounded_percentage) + "% means:\n" + "• " + tostr(rounded_percentage) + " out of 100 past trends continued to this point\n" + "• " + tostr(100 - rounded_percentage) + " out of 100 ended before reaching here\n\n" + "Based on:\n" + "• " + tostr(filtered_durations.length) + " past SuperTrend trends on this chart\n" + "• Current volume: " + tostr(vol_ratio, "#.#") + "x avg\n" + "• Current volatility: " + tostr(atr_ratio, "#.#") + "x avg\n\n" + "⚠️ DISCLAIMER:\n" + "This is historical analysis, not prediction.\n" + "Future trends may behave differently.\n" + "Not investment advice.";
            prediction_labels.push(label.new(prob_bar, box_bottom - 3 * mintick, prob_text, 'bar_index', 'price', undefined,
              'none', color.black, label_size_const, undefined, prob_tooltip, undefined, undefined, BOLD));
            new_label_count += 1;
          }

          prediction_box_counts.push(new_box_count);
          prediction_label_counts.push(new_label_count);
          current_predicted_avg = trend_avg;
          current_predicted_end = trend_predicted_end;
          current_prediction_is_bullish = new_trend_is_bullish;
        }
      }
    } else {
      current_trend_bars += 1;
    }

    // ===== retrospective backtest on the last bar (when no prediction completed)
    if (cfg.enablePrediction && isLast && last_10_actual_duration.length === 0) {
      const backtest_predicted_avg: number[] = [];
      const backtest_predicted_end: number[] = [];
      const backtest_actual_duration: number[] = [];
      const backtest_is_bullish: boolean[] = [];
      const total_trends = all_trend_durations.length;
      if (total_trends > 1) {
        for (let k = 1; k <= total_trends - 1; k++) {
          const current_duration = all_trend_durations[k];
          const current_is_bullish = all_trend_is_bullish[k];
          const prior: number[] = [];
          for (let j = 0; j <= k - 1; j++) if (all_trend_is_bullish[j] === current_is_bullish) prior.push(all_trend_durations[j]);
          if (prior.length >= 1) {
            backtest_predicted_avg.push(i_use_ewa ? ewaAvg(prior, i_ewa_decay) : array.avg(prior));
            backtest_predicted_end.push(probabilityThreshold(0.95, array.median(prior), 1.0));
            backtest_actual_duration.push(current_duration);
            backtest_is_bullish.push(current_is_bullish);
          }
        }
      }
      const backtest_count = backtest_actual_duration.length;
      if (backtest_count > 0) {
        for (let k = Math.max(0, backtest_count - 10); k <= backtest_count - 1; k++) {
          last_10_predicted_avg.push(backtest_predicted_avg[k]);
          last_10_predicted_end.push(backtest_predicted_end[k]);
          last_10_actual_duration.push(backtest_actual_duration[k]);
          last_10_is_bullish.push(backtest_is_bullish[k]);
        }
      }
    }

    // ===== statistics on the last bar (track record of the dashboard)
    if (cfg.enablePrediction && isLast) {
      const current_durations = is_bullish ? bull_trend_durations : bear_trend_durations;
      if (current_durations.length >= 1) {
        prediction_count = last_10_actual_duration.length;
        if (prediction_count > 0) {
          success_count = 0;
          let total_accuracy = 0.0;
          for (let k = 0; k <= prediction_count - 1; k++) {
            const actual = last_10_actual_duration[k];
            const pred_avg = last_10_predicted_avg[k];
            if (le(actual, last_10_predicted_end[k])) success_count = success_count + 1;
            const error_pct = (Math.abs(actual - pred_avg) / pred_avg) * 100;
            total_accuracy += Math.max(0, 100 - error_pct);
          }
          success_rate = (success_count / prediction_count) * 100;
          avg_accuracy = total_accuracy / prediction_count;
        }
      }
    }

    // ===== BUY / SELL labels
    if (goldenCross && cfg.showEntryLabels && isconfirmed) {
      const signal_mode = cfg.useScalpel ? "🔪 " : '';
      const sl_price = supertrend;
      const risk_ps = Math.max(Math.abs(close - sl_price), atrS);
      const risk_section = godmode_enabled && show_risk_levels ? "\n\n💰 RISK (Stop = SuperTrend)\nStop: " + tostr(sl_price, 'mintick') + " (risk " + tostr(risk_ps, 'mintick') + ")\nTP1 (" + tostr(tp1_r, "#.#") + "R): " + tostr(close + tp1_r * risk_ps, 'mintick') + "\nTP2 (" + tostr(tp2_r, "#.#") + "R): " + tostr(close + tp2_r * risk_ps, 'mintick') : "";
      const mtf_section = godmode_enabled ? "\n\n🔭 HTF (" + htf1_tf + "/" + htf2_tf + "): " + tostr(mtf_agree_count) + "/2 agree" : "";
      const label_text = signal_mode + "ℹ️ BUY";
      const label_tooltip = "🟢 BUY SIGNAL\n━━━━━━━━━━━━━━━━\nPrice: " + tostr(close, 'mintick') + "\nSupertrend: " + tostr(supertrend, 'mintick') + "\n\n📊 VOLUME:\n" + vol_state + " (" + tostr(vol_ratio, "#.##") + "x)\n\n📈 VOLUME MOMENTUM:\n" + (vol_momentum_strong ? "📊📊 STRONG (" + tostr(vol_momentum_ratio, "#.##") + "x)" : vol_momentum_rising ? "📈 Rising (" + tostr(vol_momentum_ratio, "#.##") + "x)" : "➡️ Neutral") + "\n\n⭐ QUALITY:\n" + quality_level + " (" + tostr(quality_score) + "/70)" + mtf_section + risk_section;
      label.new(i, low - 2 * mintick, label_text, 'bar_index', 'price', String(color.new(cfg.bullColor, 0)), 'label_up',
        color.white, label_size_const, undefined, label_tooltip);
    }
    if (deathCross && cfg.showEntryLabels && isconfirmed) {
      const signal_mode = cfg.useScalpel ? "🔪 " : '';
      const sl_price = supertrend;
      const risk_ps = Math.max(Math.abs(sl_price - close), atrS);
      const risk_section = godmode_enabled && show_risk_levels ? "\n\n💰 RISK (Stop = SuperTrend)\nStop: " + tostr(sl_price, 'mintick') + " (risk " + tostr(risk_ps, 'mintick') + ")\nTP1 (" + tostr(tp1_r, "#.#") + "R): " + tostr(close - tp1_r * risk_ps, 'mintick') + "\nTP2 (" + tostr(tp2_r, "#.#") + "R): " + tostr(close - tp2_r * risk_ps, 'mintick') : "";
      const mtf_section = godmode_enabled ? "\n\n🔭 HTF (" + htf1_tf + "/" + htf2_tf + "): " + tostr(mtf_agree_count) + "/2 agree" : "";
      const label_text = signal_mode + "ℹ️ SELL";
      const label_tooltip = "🔴 SELL SIGNAL\n━━━━━━━━━━━━━━━━\nPrice: " + tostr(close, 'mintick') + "\nSupertrend: " + tostr(supertrend, 'mintick') + "\n\n📊 VOLUME:\n" + vol_state + " (" + tostr(vol_ratio, "#.##") + "x)\n\n📉 VOLUME MOMENTUM:\n" + (vol_momentum_strong ? "📊📊 STRONG (" + tostr(vol_momentum_ratio, "#.##") + "x)" : vol_momentum_rising ? "📉 Rising (" + tostr(vol_momentum_ratio, "#.##") + "x)" : "➡️ Neutral") + "\n\n⭐ QUALITY:\n" + quality_level + " (" + tostr(quality_score) + "/70)" + mtf_section + risk_section;
      label.new(i, high + 2 * mintick, label_text, 'bar_index', 'price', String(color.new(cfg.bearColor, 0)), 'label_down',
        color.white, label_size_const, undefined, label_tooltip);
    }

    // ===== volume spike labels (cooldown of 8 bars after a label)
    if (bars_since_vol_spike_label < 999) bars_since_vol_spike_label += 1;
    const volume_spike_alert = vol_is_spike && !goldenCross && !deathCross && signal_quality_ok && volume_ok
      && (vol_momentum_ok_long || vol_momentum_ok_short) && bars_since_vol_spike_label >= VOL_SPIKE_COOLDOWN;
    if (volume_spike_alert && cfg.showInfoLabels && isconfirmed) {
      const spike_text = "💥\nVOL\nSPIKE\n" + tostr(vol_ratio, "#.#") + "x";
      const spike_tooltip = "💥 VOLUME SPIKE DETECTED\n━━━━━━━━━━━━━━━━━\nCurrent Volume: " + tostr(volume, "#") + "\nAverage (" + tostr(vol_length) + "): " + tostr(vol_ma, "#") + "\nRatio: " + tostr(vol_ratio, "#.##") + "x\n\nThreshold: " + tostr(vol_spike_threshold, "#.#") + "x\n\n✅ ALL ENTRY FILTERS PASSED:\n• Quality: " + tostr(quality_score) + "/" + tostr(min_quality_score) + " ✓\n• Volume: Confirmed ✓\n• Vol Momentum: Confirmed ✓\n\n💡 Major event with full confirmation!\nHigh-quality setup - watch for entry.";
      const spike_color = is_bullish ? color.aqua : color.orange;
      label.new(i, is_bullish ? low : high, spike_text, 'bar_index', 'price', String(color.new(spike_color, 0)),
        is_bullish ? 'label_up' : 'label_down', color.white, label_size_const, undefined, spike_tooltip);
      bars_since_vol_spike_label = 0;
    }

    // ===== gradient ribbon
    const ribbon_active = cfg.showRibbonFill && !neutral;
    const vol_intensity = -(vol_ratio - 1.0) * 30;
    const baseColor = is_bullish ? cfg.bullColor : cfg.bearColor;
    const vol_momentum_boost = use_volume_momentum
      && ((is_bullish && vol_momentum_confirms_bull) || (is_bearish && vol_momentum_confirms_bear)) ? 15 : 0;
    const bar_mid = (high + low) / 2;
    let ribbon_start: number;
    let ribbon_end: number;
    if (supertrend_flip_bullish) {
      ribbon_start = gt(close, bar_mid) ? bar_mid : close;
      ribbon_end = gt(close, bar_mid) ? high : bar_mid;
    } else if (supertrend_flip_bearish) {
      ribbon_start = lt(close, bar_mid) ? bar_mid : close;
      ribbon_end = lt(close, bar_mid) ? low : bar_mid;
    } else {
      ribbon_start = close;
      ribbon_end = supertrend;
    }
    for (let k = 0; k < 16; k++) {
      // get_layer(start, end, step) = (start * (15 - step) + end * step) / 15; l1 = start, l16 = end
      const v = k === 0 ? ribbon_start : k === 15 ? ribbon_end : (ribbon_start * (15 - k) + ribbon_end * k) / 15;
      ribbonPlots[k].push({ time: b.time, value: ribbon_active && Number.isFinite(v) ? v : NaN });
    }
    for (let k = 0; k < 15; k++) {
      // get_opacity(base) = max(5, min(95, base - boost + intensity)); bases 85, 81, ..., 33 and 30
      const base = k === 14 ? 30 : 85 - 4 * k;
      const opacity = Math.max(5, Math.min(95, base - vol_momentum_boost + vol_intensity));
      fillColors[k].push(ribbon_active ? String(color.new(baseColor, opacity)) : 'transparent');
    }

    // ===== dashboard
    if (cfg.showDashboard && isLast) {
      const tablePos = POSITIONS[cfg.tablePosition] ?? 'bottom_right';
      const tableTxtSize = SIZES[cfg.tableTextSize] ?? 'huge';
      const dash_bg = String(color.new(color.black, 0));
      const header_bg = String(color.new(color.gray, 50));
      const sep_color = String(color.new(color.gray, 50));
      const header_text = "SUPER-DUPER SUPERTREND";
      if (!dashTable.value) dashTable.value = table.new(tablePos as never, 2, 20, dash_bg, undefined, undefined, undefined, 0);
      const dash = dashTable.value;
      const header_tooltip = "Super-Duper SuperTrend Dashboard\n\nReal-time trend analysis combining:\n• BIAS-style adaptive Supertrend\n• Volume confirmation\n• Quality scoring system\n\nAll metrics update live on each bar close.";
      table.cell(dash, 0, 0, header_text, undefined, undefined, color.white, 'center', undefined, tableTxtSize, header_bg, header_tooltip);
      table.merge_cells(dash, 0, 0, 1, 0);

      const vol_points = vol_is_spike ? 30 : vol_is_high ? 20 : basic_volume_confirm ? 10 : 0;
      const volatility_points = vol_expanding ? 30 : vol_rising ? 15 : 0;
      const vol_momentum_points = use_volume_momentum && vol_momentum_strong_trend ? 10 : use_volume_momentum && vol_momentum_rising ? 5 : 0;
      const quality_label_tooltip = "Signal Quality Score (0-70 points)\n\nMeasures signal strength based on:\n\n📊 VOLUME (0-30 pts): " + tostr(vol_points) + " pts\n• Spike (2.5x+) = 30\n• High (1.5x+) = 20\n• Above average = 10\n\n🌪️ VOLATILITY (0-30 pts): " + tostr(volatility_points) + " pts\n• Expanding (1.3x+) = 30\n• Rising (1.0x+) = 15\n\n📈 VOL MOMENTUM BONUS (0-10 pts): " + tostr(vol_momentum_points) + " pts\n• Strong momentum = 10\n• Rising momentum = 5\n\nThresholds:\n• 60+ = EXCELLENT ⭐⭐⭐\n• 45-59 = STRONG ⭐⭐\n• 30-44 = GOOD ⭐\n• 0-29 = WEAK ⚠️";
      const quality_value_tooltip = "Current Score: " + tostr(quality_score) + "/70\nLevel: " + quality_level + "\n\n" + (ge(quality_score, min_quality_score) ? "✅ ABOVE minimum threshold (" + tostr(min_quality_score) + ")" : "❌ BELOW minimum threshold (" + tostr(min_quality_score) + ")") + "\n\nBREAKDOWN:\n━━━━━━━━━━━━\n📊 Volume: " + tostr(vol_points) + " pts (" + vol_state + ")\n🌪️ Volatility: " + tostr(volatility_points) + " pts (" + volatility_state + ")\n📈 Vol Momentum: " + tostr(vol_momentum_points) + " pts" + (use_volume_momentum ? " (" + tostr(vol_momentum_ratio, "#.##") + "x)" : " (disabled)") + "\n━━━━━━━━━━━━\nTOTAL: " + tostr(quality_score) + " pts\n\n" + (ge(quality_score, 60) ? "💡 EXCELLENT quality - very high probability signal" : ge(quality_score, 45) ? "💡 STRONG quality - reliable signal" : ge(quality_score, 30) ? "💡 GOOD quality - decent signal" : "⚠️ WEAK quality - consider waiting for better setup");
      table.cell(dash, 0, 1, "Signal Quality", undefined, undefined, color.white, 'left', undefined, tableTxtSize, undefined, quality_label_tooltip);
      table.cell(dash, 1, 1, quality_level + ' (' + tostr(quality_score) + '/70)', undefined, undefined, color.white, 'center', undefined,
        tableTxtSize, undefined, quality_value_tooltip);
      table.cell(dash, 0, 2, "═══════════════════", undefined, undefined, sep_color, 'center', undefined, 'tiny');
      table.merge_cells(dash, 0, 2, 1, 2);

      const st_text = is_bullish ? "🟢 BULLISH" : "🔴 BEARISH";
      const st_price = " @ " + tostr(supertrend, 'mintick');
      const multiplier_adjustment = st_use_adaptive ? (adaptiveMult / st_mult - 1.0) * 100 : 0;
      const base_band = atrS * st_mult;
      const adaptive_band = atrS * adaptiveMult;
      const st_label_tooltip = "BIAS-Style Adaptive Supertrend\n\nAdvanced calculation features:\n\n🔧 ADAPTIVE MULTIPLIER:" + (st_use_adaptive ? " ON" : " OFF") + "\n• Base multiplier: " + tostr(st_mult, "#.##") + "x\n• Current multiplier: " + tostr(adaptiveMult, "#.##") + "x\n• Adjustment: " + (gt(multiplier_adjustment, 0) ? "+" : "") + tostr(multiplier_adjustment, "#.#") + "%\n\nAdapts based on:\n• Volume weight: " + tostr(volWeight, "#.##") + "x\n• Trend strength: " + tostr(trendStrength * 100, "#") + "%\n\n📈 EMA SMOOTHING: " + tostr(st_smooth_factor * 100, "#") + "%\n• Reduces noise\n• ~" + tostr(int(1 / st_smooth_factor), "#") + " bar smoothing\n\n⏸️ NEUTRAL BARS: " + tostr(st_neutral_bars) + " bars\n• Hides ribbon after flip\n• Reduces false signals" + (gt(st_neutral_bars, 0) ? "\n• Currently: " + (neutral ? "IN NEUTRAL WINDOW" : "active") : "");
      const st_value_tooltip = "Current Trend: " + (is_bullish ? "🟢 BULLISH" : "🔴 BEARISH") + "\n\nSupertrend Level: " + tostr(supertrend, 'mintick') + "\nCurrent Price: " + tostr(close, 'mintick') + "\nDistance: " + tostr(Math.abs(close - supertrend), 'mintick') + " (" + tostr(Math.abs(close - supertrend) / close * 100, "#.##") + "%)\n\nLAST FLIP:\n• Direction: " + (is_bullish ? "Flipped to BULLISH" : "Flipped to BEARISH") + (neutral ? "\n• Status: ⏸️ IN NEUTRAL WINDOW" : "\n• Status: ✅ Active") + "\n\nBAND DETAILS:\n━━━━━━━━━━━━\nATR (" + tostr(st_length) + "): " + tostr(atrS, 'mintick') + "\nBase width: " + tostr(base_band, 'mintick') + "\nAdaptive width: " + tostr(adaptive_band, 'mintick') + "\nAdjustment: " + (gt(multiplier_adjustment, 0) ? "+" : "") + tostr(multiplier_adjustment, "#.#") + "%\n\n" + (is_bullish ? "💡 Support at " + tostr(supertrend, 'mintick') + "\n   Hold above = trend intact" : "💡 Resistance at " + tostr(supertrend, 'mintick') + "\n   Break above = trend reversal");
      table.cell(dash, 0, 3, "Supertrend", undefined, undefined, color.white, 'left', undefined, tableTxtSize, undefined, st_label_tooltip);
      table.cell(dash, 1, 3, st_text + st_price, undefined, undefined, color.white, 'center', undefined, tableTxtSize, undefined, st_value_tooltip);

      const vol_text = vol_state + " (" + tostr(vol_ratio, "#.#") + "x)";
      const vol_label_tooltip = "Volume Analysis System\n\nCompares current volume to " + tostr(vol_length) + "-bar average.\n\nTHRESHOLDS:\n━━━━━━━━━━━━\n💥 SPIKE: " + tostr(vol_spike_threshold, "#.#") + "x+ average\n   Major event/breakout\n   Highest quality signal\n\n🔥 HIGH: " + tostr(vol_high_threshold, "#.#") + "x+ average\n   Strong participation\n   Good confirmation\n\n➡️ NORMAL: 1.0x - " + tostr(vol_high_threshold, "#.#") + "x\n   Average activity\n   Neutral confirmation\n\n📍 LOW: Below " + tostr(vol_low_threshold, "#.#") + "x average\n   Weak participation\n   Lower quality signal\n\nVolume affects:\n• Quality score (0-30 points)\n• Ribbon darkness (gradual)\n• Adaptive multiplier strength";
      const vol_value_tooltip = "Current Volume State: " + vol_state + "\n\nVOLUME METRICS:\n━━━━━━━━━━━━\nCurrent: " + tostr(volume, "#") + "\nAverage (" + tostr(vol_length) + "): " + tostr(vol_ma, "#") + "\nRatio: " + tostr(vol_ratio, "#.##") + "x\n\nCATEGORY:\n" + (vol_is_spike ? "💥 SPIKE (" + tostr(vol_spike_threshold, "#.#") + "x+)\n   ✅ Exceptional confirmation!\n   +30 quality points" : vol_is_high ? "🔥 HIGH (" + tostr(vol_high_threshold, "#.#") + "x+)\n   ✅ Strong confirmation\n   +20 quality points" : vol_is_low ? "📍 LOW (below " + tostr(vol_low_threshold, "#.#") + "x)\n   ⚠️ Weak confirmation\n   +0 quality points" : "➡️ NORMAL\n   Basic confirmation\n   +10 quality points") + "\n\nRIBBON EFFECT:\n" + (gt(vol_ratio, 1.0) ? "Darkening: -" + tostr((vol_ratio - 1.0) * 30, "#") + "% transparency\nHigher volume = darker ribbon" : "No darkening (below average)") + "\n\n💡 " + (vol_is_spike || vol_is_high ? "Strong volume confirms trend strength!" : vol_is_low ? "Low volume - trend may be weak" : "Average volume - trend developing normally");
      table.cell(dash, 0, 4, "Volume", undefined, undefined, color.white, 'left', undefined, tableTxtSize, undefined, vol_label_tooltip);
      table.cell(dash, 1, 4, vol_text, undefined, undefined, color.white, 'center', undefined, tableTxtSize, undefined, vol_value_tooltip);
      const volatility_label_tooltip = "Volatility Analysis (ATR Regime)\n\nMeasures current volatility vs 20-bar average.\n\nREGIMES:\n━━━━━━━━━━━━\n🔥 EXPANDING (1.3x+)\n   Major price swings\n   Breakout potential\n   +30 quality points\n\n📈 RISING (1.0x - 1.3x)\n   Increasing volatility\n   Building momentum\n   +15 quality points\n\n➡️ STABLE (0.9x - 1.0x)\n   Normal conditions\n   Steady trend\n   +0 quality points\n\n📉 CONTRACTING (below 0.9x)\n   Low volatility\n   Consolidation phase\n   +0 quality points\n\nVolatility affects:\n• Quality score (0-30 pts)\n• Breakout probability\n• Stop-loss positioning";
      const volatility_value_tooltip = "Current Volatility: " + volatility_state + "\n\nATR METRICS:\n━━━━━━━━━━━━\nCurrent ATR(14): " + tostr(atr_current, 'mintick') + "\nAverage ATR(20): " + tostr(atr_ma, 'mintick') + "\nRatio: " + tostr(atr_ratio, "#.##") + "x\n\nREGIME ANALYSIS:\n" + (ge(atr_ratio, 1.3) ? "🔥 EXPANDING\n   ATR is 1.3x+ average\n   ✅ High volatility = breakout likely\n   ✅ +30 quality points\n   💡 Excellent for trend trades!" : vol_rising ? "📈 RISING\n   ATR is above average\n   ✅ Volatility increasing\n   ✅ +15 quality points\n   💡 Momentum building" : vol_contracting ? "📉 CONTRACTING\n   ATR below 0.9x average\n   ⚠️ Low volatility\n   ⚠️ +0 quality points\n   💡 Consolidation - wait for expansion" : "➡️ STABLE\n   ATR near average\n   Normal market conditions\n   +0 quality points\n   💡 Steady trend environment") + "\n\nSUPERTREND IMPACT:\n" + (st_use_adaptive ? "Adaptive bands adjust automatically\nBand width: " + tostr(adaptive_band, 'mintick') : "Fixed bands (adaptive disabled)");
      table.cell(dash, 0, 5, "Volatility", undefined, undefined, color.white, 'left', undefined, tableTxtSize, undefined, volatility_label_tooltip);
      table.cell(dash, 1, 5, volatility_state, undefined, undefined, color.white, 'center', undefined, tableTxtSize, undefined, volatility_value_tooltip);
      table.cell(dash, 0, 6, "═══════════════════", undefined, undefined, sep_color, 'center', undefined, 'tiny');
      table.merge_cells(dash, 0, 6, 1, 6);

      if (godmode_enabled) {
        const htf1_txt = isNa(htf1_dir) ? "⚪" : (htf1_bull ? "🟢" : "🔴");
        const htf2_txt = isNa(htf2_dir) ? "⚪" : (htf2_bull ? "🟢" : "🔴");
        const mtf_value = htf1_tf + " " + htf1_txt + "  " + htf2_tf + " " + htf2_txt + "  (" + tostr(mtf_agree_count) + "/2)";
        const mtf_tooltip = "Multi-Timeframe Confluence 🔭\n\nHigher-TF SuperTrend direction vs the current chart:\n\n🔭 " + htf1_tf + ": " + (isNa(htf1_dir) ? "no data" : (htf1_bull ? "🟢 Bullish" : "🔴 Bearish")) + "\n🔭 " + htf2_tf + ": " + (isNa(htf2_dir) ? "no data" : (htf2_bull ? "🟢 Bullish" : "🔴 Bearish")) + "\n\nAgreement with current chart: " + tostr(mtf_agree_count) + "/2\n\n" + (mtf_gate_signals ? "⚙️ Gate ON — signals require BOTH higher TFs to agree." : "⚙️ Gate OFF — shown for context only (toggle in GOD MODE settings).") + "\n\n💡 Set both TFs ABOVE your chart timeframe.\n💡 More agreement = higher-conviction entries.";
        table.cell(dash, 0, 7, "🔭 HTF Confluence", undefined, undefined, color.white, 'left', undefined, tableTxtSize, undefined, mtf_tooltip);
        table.cell(dash, 1, 7, mtf_value, undefined, undefined, color.white, 'center', undefined, tableTxtSize, undefined, mtf_tooltip);
      }

      if (cfg.enablePrediction) {
        const samples_check = (is_bullish ? bull_trend_durations : bear_trend_durations).length;
        if (prediction_count > 0) {
          let breakdown = '';
          for (let i = 0; i <= prediction_count - 1; i++) {
            const actual = last_10_actual_duration[i];
            const pred_avg = last_10_predicted_avg[i];
            const was_success = le(actual, last_10_predicted_end[i]);
            const trend_emoji = last_10_is_bullish[i] ? "🟢" : "🔴";
            const success_emoji = was_success ? "✅" : "❌";
            breakdown = breakdown + tostr(i + 1) + ". " + trend_emoji + " " + success_emoji + " Predicted: " + tostr(int(pred_avg)) + " bars | Actual: " + tostr(actual) + " bars\n";
          }
          const pred_header_tooltip = "Prediction Track Record\n\nShows performance of last 10 trend duration predictions:\n\n🎯 Success Rate:\nPercentage of trends that ended within the predicted 95% range\n\n📐 Average Accuracy:\nHow close predictions were to actual durations\nCalculated as: 100% - average(|error|)\n\n💡 Based on " + tostr(prediction_count) + " completed predictions";
          const success_tooltip = "SUCCESS RATE\n━━━━━━━━━━━━━━━━━━━━\n\n" + tostr(int(success_count)) + " out of " + tostr(prediction_count) + " trends ended within predicted range\n\n" + tostr(int(success_rate)) + "% = Percentage of trends that stayed within predicted 95% range\n\n━━━━━━━━━━━━━━━━━━━━\nLAST " + tostr(prediction_count) + " PREDICTIONS:\n━━━━━━━━━━━━━━━━━━━━\n\n" + breakdown + "\n✅ = Within predicted range\n❌ = Outside predicted range\n🟢 = Bullish trend\n🔴 = Bearish trend";
          const accuracy_tooltip = "AVERAGE ACCURACY\n━━━━━━━━━━━━━━━━━━━━\n\n" + tostr(int(avg_accuracy)) + "% = Average closeness to predicted duration\n\nCalculated as: 100% - average(|predicted - actual| / predicted × 100)\n\nExample:\n• Predicted: 50 bars\n• Actual: 45 bars\n• Error: |50-45|/50 = 10%\n• Accuracy: 100% - 10% = 90%\n\nHigher % = More accurate predictions";
          table.cell(dash, 0, 8, "📊 PREDICTION RECORD", undefined, undefined, color.white, 'center', undefined, tableTxtSize, header_bg, pred_header_tooltip);
          table.merge_cells(dash, 0, 8, 1, 8);
          table.cell(dash, 0, 9, "Success Rate", undefined, undefined, color.white, 'left', undefined, tableTxtSize, undefined, success_tooltip);
          table.cell(dash, 1, 9, tostr(int(success_count)) + '/10 (' + tostr(int(success_rate)) + '%)', undefined, undefined, color.white,
            'center', undefined, tableTxtSize, undefined, success_tooltip);
          table.cell(dash, 0, 10, "Avg Accuracy", undefined, undefined, color.white, 'left', undefined, tableTxtSize, undefined, accuracy_tooltip);
          table.cell(dash, 1, 10, tostr(int(avg_accuracy)) + '%', undefined, undefined, color.white, 'center', undefined, tableTxtSize,
            undefined, accuracy_tooltip);
        } else {
          const status_text = ge(samples_check, 1) ? "✅ Active\n" + tostr(samples_check) + " trends analyzed" : "⏳ Collecting data...\nNeed 1+ trend flip";
          const status_tooltip = "Trend Duration Prediction Status\n\n" + (ge(samples_check, 1) ? "ACTIVE ✅\n━━━━━━━━━━━━━━━\nPrediction is active and showing on chart!\n\nCurrent trend: " + (is_bullish ? "🟢 Bullish" : "🔴 Bearish") + "\nHistorical trends: " + tostr(samples_check) + "\n\n💡 Look for colored gradient box with prediction percentages on the chart.\n\nTrack record will appear here after 10 completed predictions." : "WAITING FOR DATA ⏳\n━━━━━━━━━━━━━━━\nPrediction needs at least 1 SuperTrend flip to start.\n\nCurrent status:\n• SuperTrend flips: " + tostr(samples_check) + "\n• Minimum needed: 1\n\n💡 Wait for the first trend flip, then predictions will appear automatically!");
          table.cell(dash, 0, 8, "📊 Prediction Status", undefined, undefined, color.white, 'left', undefined, tableTxtSize, undefined, status_tooltip);
          table.cell(dash, 1, 8, status_text, undefined, undefined, color.white, 'center', undefined, tableTxtSize, undefined, status_tooltip);
        }
      }
      if (cfg.enablePrediction && prediction_count > 0) {
        table.cell(dash, 0, 11, "═══════════════════", undefined, undefined, sep_color, 'center', undefined, 'tiny');
        table.merge_cells(dash, 0, 11, 1, 11);
      }

      if (cfg.enablePrediction && advanced) {
        // multipliers of the most recent flip
        const last = all_flip_structure_mults.length - 1;
        const last_structure_mult = last >= 0 ? all_flip_structure_mults[last] : 1.0;
        const last_stock_type_mult = last >= 0 ? all_flip_stock_type_mults[last] : 1.0;
        const last_flip_strength_mult = last >= 0 ? all_flip_strength_mults[last] : 1.0;
        const last_learning_mult = last >= 0 ? all_flip_learning_mults[last] : 1.0;
        const last_regime_mult = last >= 0 ? all_flip_regime_mults[last] : 1.0;
        const adv_header_tooltip = "Advanced Prediction Adjustments 🚀\n\nEnhances base predictions with 5 intelligent factors:\n\n1️⃣ Market Structure (±30%)\n• Detects S/R levels via pivot analysis\n• Near levels = shorter trends\n\n2️⃣ Stock Type (±40%)\n• Different assets have unique behaviors\n• " + i_stock_type + " multiplier applied\n\n3️⃣ Flip Strength (±20%)\n• Strong momentum = longer trends\n• Based on volume, volatility, quality at flip\n\n4️⃣ Error Learning (±15%)\n• Learns from past mistakes\n• Adapts predictions over time\n\n5️⃣ Regime Detection (±20%)\n• Analyzes recent trend patterns\n• Long recent trends → longer prediction\n• Short recent trends → shorter prediction\n\nThese multiply the base prediction for 30-50% better accuracy!";
        const structure_tooltip = "MARKET STRUCTURE: " + tostr(last_structure_mult, "#.##") + "x\n\n" + (lt(last_structure_mult, 1.0) ? "• Near S/R level (-30%)\n• Trend likely to reverse sooner" : "• No nearby S/R levels\n• Normal trend duration expected") + "\n\nDetects support/resistance via pivot analysis (" + tostr(i_structure_lookback) + " bars)\n\nProximity threshold: " + tostr(i_structure_sensitivity, "#.#") + " × ATR";
        const type_tooltip = "STOCK TYPE: " + tostr(last_stock_type_mult, "#.##") + "x\n\nAsset: " + i_stock_type + "\n\n" + (gt(last_stock_type_mult, 1.0) ? "• Stable asset → longer trends" : lt(last_stock_type_mult, 1.0) ? "• Volatile asset → shorter trends" : "• Moderate behavior") + "\n\nDifferent assets have unique trend patterns:\n• Blue Chip: 1.35x (longest)\n• Dividend: 1.25x\n• Tech Growth: 1.10x\n• Cyclical: 0.90x\n• Small Cap: 0.65x\n• Crypto: 0.60x\n• Biotech: 0.55x (shortest)";
        const flip_tooltip = "FLIP STRENGTH: " + tostr(last_flip_strength_mult, "#.##") + "x\n\nBased on:\n• Volume at flip\n• Volatility expansion\n• Quality score\n\n" + (gt(last_flip_strength_mult, 1.0) ? "• Strong flip → extended trend\n• High momentum = sustained move" : lt(last_flip_strength_mult, 1.0) ? "• Weak flip → shorter trend\n• Low momentum = quick reversal" : "• Moderate flip strength\n• Average trend expected");
        const learning_tooltip = "ERROR LEARNING: " + tostr(last_learning_mult, "#.##") + "x\n\nAdaptive correction from past errors\n\nMemory: " + tostr(error_ratios.length) + "/" + tostr(i_error_memory_depth) + " predictions\n\n" + (ge(error_ratios.length, 3) ? (lt(last_learning_mult, 1.0) ? "• Reducing predictions\n• System was over-predicting\n• Learning to be more conservative" : gt(last_learning_mult, 1.0) ? "• Increasing predictions\n• System was under-predicting\n• Learning to be more aggressive" : "• No adjustment needed\n• Predictions are accurate") : "• Not enough data yet\n• Need 3+ completed predictions\n• Currently learning...");
        const regime_tooltip = "REGIME DETECTION: " + tostr(last_regime_mult, "#.##") + "x\n\nAnalyzes last 3 trends (same type)\n\n" + (gt(last_regime_mult, 1.0) ? "• Recent trends LONGER than average\n• Market regime favors extended trends ✅\n• Expect continuation" : lt(last_regime_mult, 1.0) ? "• Recent trends SHORTER than average\n• Market regime favors brief trends ⚠️\n• Expect quick reversals" : "• Recent trends match historical average\n• Normal market regime ➡️\n• No bias detected");
        table.cell(dash, 0, 12, "🚀 ADVANCED FACTORS", undefined, undefined, color.white, 'center', undefined, tableTxtSize, header_bg, adv_header_tooltip);
        table.merge_cells(dash, 0, 12, 1, 12);
        const row = (r: number, name: string, value: number, tip: string) => {
          table.cell(dash, 0, r, name, undefined, undefined, color.white, 'left', undefined, tableTxtSize, undefined, tip);
          table.cell(dash, 1, r, tostr(value, '#.##') + 'x', undefined, undefined, color.white, 'center', undefined, tableTxtSize, undefined, tip);
        };
        row(13, 'Structure', last_structure_mult, structure_tooltip);
        row(14, 'Type', last_stock_type_mult, type_tooltip);
        row(15, 'Flip', last_flip_strength_mult, flip_tooltip);
        let current_row = 16;
        if (i_use_error_learning) {
          row(current_row, 'Learning', last_learning_mult, learning_tooltip);
          current_row += 1;
        }
        row(current_row, 'Regime', last_regime_mult, regime_tooltip);
      }

      if (cfg.enablePrediction) {
        const disclaimer_text = "⚠️ DISCLAIMER";
        const disclaimer_tooltip = "IMPORTANT LEGAL DISCLAIMER\n━━━━━━━━━━━━━━━━━━━━\n\n⚠️ NOT FINANCIAL ADVICE\nThis indicator provides historical analysis only.\nIt is NOT investment, financial, or trading advice.\n\n📊 HISTORICAL ANALYSIS\nPredictions are based on past SuperTrend patterns.\nPast performance does NOT guarantee future results.\n\n⚡ NO GUARANTEES\nMarkets are unpredictable and risky.\nTrends can reverse unexpectedly at any time.\n\n💰 USE AT YOUR OWN RISK\nYou are solely responsible for your trading decisions.\nNever risk more than you can afford to lose.\n\n🔍 DO YOUR OWN RESEARCH\nThis is an educational tool only.\nConsult a licensed financial advisor before trading.\n\n━━━━━━━━━━━━━━━━━━━━\n✅ By using this indicator, you acknowledge\n   these limitations and accept full responsibility.";
        table.cell(dash, 0, 18, disclaimer_text, undefined, undefined, color.orange, 'center', undefined, 'tiny', undefined, disclaimer_tooltip);
        table.merge_cells(dash, 0, 18, 1, 18);
      }
    }

    // ===== alert() calls
    if (goldenCross && isconfirmed) {
      const vol_momentum_status = use_volume_momentum ? (vol_momentum_strong ? " | Vol Momentum: 📊📊 STRONG (" + tostr(vol_momentum_ratio, "#.##") + "x)" : " | Vol Momentum: 📈 Rising (" + tostr(vol_momentum_ratio, "#.##") + "x)") : "";
      alertCalls.push({ time: b.time as number, message: "⬆️ LONG: Supertrend bullish + Quality: " + tostr(quality_score) + "/70\n" + "Volume: " + vol_state + vol_momentum_status, freq: 'once_per_bar_close' });
    }
    if (deathCross && isconfirmed) {
      const vol_momentum_status = use_volume_momentum ? (vol_momentum_strong ? " | Vol Momentum: 📊📊 STRONG (" + tostr(vol_momentum_ratio, "#.##") + "x)" : " | Vol Momentum: 📉 Rising (" + tostr(vol_momentum_ratio, "#.##") + "x)") : "";
      alertCalls.push({ time: b.time as number, message: "⬇️ SHORT: Supertrend bearish + Quality: " + tostr(quality_score) + "/70\n" + "Volume: " + vol_state + vol_momentum_status, freq: 'once_per_bar_close' });
    }

    up_prev = upLine;
    dn_prev = dnLine;
    dir_prev = stDir;
  }
  setDrawingBar(null);

  const plots: Record<string, { time: number; value: number; color?: string }[]> = { plot0 };
  RIBBON.forEach((id, k) => {
    plots[id] = ribbonPlots[k];
  });
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills: fillColors.map((colors, k) => ({ id: `fill${k}`, plot1: RIBBON[k], plot2: RIBBON[k + 1], options: { title: 'Plots Background' }, colors })),
    ...drawingOutputs(bars, unit),
    // alertcondition(goldenCross) / (deathCross) / (goldenCross or deathCross)
    alerts: alertStates(alertConditions, bars, [goldenFlags, deathFlags, goldenFlags.map((g, k) => g || deathFlags[k])]),
    alertCalls,
  } as IndicatorResult & { alerts: AlertConditionState[]; alertCalls: AlertCall[] };
}

export const LuxySuperDuperSupertrendPredictorEngine = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  alertConditions,
  hasAlertFunction,
  drawingKinds,
  requiredSymbols,
};
