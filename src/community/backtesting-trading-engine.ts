/**
 * Backtesting & Trading Engine
 *
 * A trade simulator that runs as an indicator. On each bar it looks for an entry trigger (entry strat: random,
 * external indicator, filter transitions / states, RSI crosses, Tenkan / Kijun crosses; trade direction, filters,
 * date range, more than "2. ATR Length" bars, no ruin). The trade is filled at the open of the next bar (rounded to
 * the tick, with slippage capped by the bar high / low); its entry stop (ATR multiple, %, value or external) gives X,
 * the risk unit of the trade. While in the trade the in-trade stop (trailing X / % / value, Donchian center, ATR,
 * Chandelier, volatility stop, last low / high) replaces the entry stop when it passes the kick-in level and only
 * moves in the trade direction; the trade exits when the close (rounded to the tick) breaches the stop of the bar
 * before or a hard exit fires (random, external, filter transitions, RSI, Tenkan / Kijun, take profit), and is closed
 * at the next open. Pyramiding entries, fees, position sizing and a post-exit analysis (PEA: opportunity and drawdown
 * in X over the next bars) are part of the results.
 *
 * Outputs: the 37 data-window values of the original (plotchar with an empty character: only the value is shown,
 * ported as data-window plots: global results, trade results, PEA); the entry level, entry stops, in-trade stop and
 * take-profit level (circles); the filter states, events and entry / exit markers; the traded background.
 *
 * The random strats are the original's pseudo-random generator: r = (3.14159 * r[1]) % (bar_index + seed) % range
 * per call site (r[1] = 1 on the first call); bar_index counts from the first bar of the given bars, so the random
 * entries depend on where the bars start.
 *
 * Plot colours: Pine version 3 gives the plots a default transparency of 35 for plain colours; colours made with
 * color(c, 0) are opaque.
 *
 * Chart values read: the symbol tick (prices rounded to the tick) and the exchange time zone (date range filter).
 *
 * Reference: "Backtesting & Trading Engine [PineCoders]" by PineCoders
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @author=LucF, for PineCoders
 */

import {
  taStep, getSourceSeries, time as ptime,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type BarColorConfig, type SourceType,
} from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import { mintickOf, timezoneOf, type ChartContext } from '../chart-context';
import type { AlertConditionDecl } from '../alert-states';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

// Option lists (A. Option list statics)
const TD1 = 'Both', TD2 = 'Longs Only', TD3 = 'Shorts Only';
const EN0 = '0. None', EN1 = '1. Random', EN2 = '2. External Indicator (+2/-2 or +stop/-stop)', EN3 = '3. Filter transitions',
  EN4 = '4. Filter states', EN5 = '5. RSI crosses', EN6 = '6. Tenkan/Kijun crosses';
const SE1 = '1. None', SE2 = '2. On Entries', SE3 = '3. All';
const ES1 = '1. External Indicator (+stop/-stop)', ES2 = '2. ATR multiple', ES3 = '3. Fixed %', ES4 = '4. Fixed Value';
const IS0 = '0. None', IS1 = '1. Trailing at X multiple', IS2 = '2. Trailing at %', IS3 = '3. Trailing at Fixed Value',
  IS4 = '4. Donchian Center (Kijun)', IS5 = '5. Simple ATR multiple (14,4)', IS6 = '6. Chandelier(20,3)',
  IS7 = '7. Volatility Stop (20,3)', IS8 = '8. Last Lo/Hi';
const IK1 = '1. Entry Stop', IK2 = '2. Entry +/- X multiple', IK3 = '3. Entry +/- %', IK4 = '4. Entry +/- Fixed Value';
const PY1 = 'Off', PY2 = 'Off but all opportunities displayed', PY3 = 'On';
const PT1 = '1. Every X Multiple', PT2 = '2. Every % Increment', PT3 = '3. Every Price Increment', PT4 = '4. On same entry',
  PT5 = '5. On different entry', PT6 = '6. At every opportunity';
const SL1 = '1. None', SL2 = '2. Percentage', SL3 = '3. Fixed Value';
const FE1 = '1. None', FE2 = '2. Percentage', FE3 = '3. Fixed Value';
const PA1 = 'Off', PA2 = 'On';
const PS1 = '1. Proportional to Stop -> Variable', PS2 = '2. % of Equity -> Variable', PS3 = '3. % of Capital -> Fixed';

export interface BacktestingTradingEngineInputs {
  // B. Display
  displaySection: boolean;
  showTradedBackground: boolean;
  showMarkers: boolean;
  showEntry: boolean;
  showTakeProfit: boolean;
  // C. Entries
  entriesSection: boolean;
  tradeDirection: string;
  entryA: string;
  entryB: string;
  entryType1Freq: number;
  entryType5Len: number;
  entryType5LongLvl: number;
  entryType5ShortLvl: number;
  entryType6TLen: number;
  entryType6KLen: number;
  // D. Filters
  showFilter: boolean;
  showFilteredOut: boolean;
  filterType1: boolean;
  filterType1Freq: number;
  filterType2: boolean;
  filterType3: boolean;
  filterType4: boolean;
  filterType5: boolean;
  filterType5Len: number;
  filterType5Bars: number;
  filterType6: boolean;
  filterType6MaxRisk: number;
  filterType7: boolean;
  filterType7IncPct: number;
  filterType8: boolean;
  filterType9: boolean;
  filterType9Len: number;
  filterType9OS: number;
  filterType9OB: number;
  filterType10: boolean;
  filterType10Len: number;
  filterType10Mult: number;
  filterType11: boolean;
  filterType11Len1: number;
  filterType11Len2: number;
  // E. Entry stops
  showEntryStop: string;
  entryStopType: string;
  entryStopType2Mult: number;
  entryStopType2Len: number;
  entryStopType3Pct: number;
  entryStopType4Val: number;
  // F. In-trade stops
  showInTradeStop: boolean;
  inTradeStopType: string;
  inTradeStopType1Mult: number;
  inTradeStopType2Pct: number;
  inTradeStopType3Val: number;
  inTradeStopType4Len: number;
  inTradeStopType567Len: number;
  inTradeStopType567Mult: number;
  inTradeKickType: string;
  inTradeKickType2Mult: number;
  inTradeKickType3Pct: number;
  inTradeKickType4Val: number;
  // G. Pyramiding rules
  pyramiding: string;
  pyramidingType: string;
  pyramidingFilterNeeded: boolean;
  pyramidingMaxCnt: number;
  pyramidingPosMult: number;
  pyramiding1MultX: number;
  pyramiding2Pct: number;
  pyramiding3Val: number;
  // H. Hard exits
  hardExitsSection: boolean;
  exitType1: boolean;
  exitType1Freq: number;
  exitType2: boolean;
  exitType3: boolean;
  exitType4: boolean;
  exitType4Len: number;
  exitType4LongLvl: number;
  exitType4ShortLvl: number;
  exitType5: boolean;
  exitType5TLen: number;
  exitType5KLen: number;
  exitType6: boolean;
  exitType6Mult: number;
  // I. Slippage
  slippageType: string;
  slippageType2InPct: number;
  slippageType2OutPct: number;
  slippageType3InVal: number;
  slippageType3OutVal: number;
  // J. Fees
  feesType: string;
  feesType2InPct: number;
  feesType2OutPct: number;
  feesType3InVal: number;
  feesType3OutVal: number;
  // K. In-trade events
  eventsSection: boolean;
  eventType1: boolean;
  eventType1Mult: number;
  eventType2: boolean;
  eventType3: boolean;
  eventType3Mult: number;
  eventType4: boolean;
  eventType4Mult: number;
  eventAtrLen: number;
  // L. Post-trade analysis
  pea: string;
  peaBars: number;
  // M. Date range filtering
  dateFilter: boolean;
  fromYear: number;
  fromMonth: number;
  fromDay: number;
  toYear: number;
  toMonth: number;
  toDay: number;
  // N. Alert configuration
  alertsSection: boolean;
  alertType1: boolean;
  alertType2: boolean;
  alertType3: boolean;
  alertType4: boolean;
  alertType5: boolean;
  alertType6: boolean;
  alertType7: boolean;
  alertType8: boolean;
  alertType9: boolean;
  alertType10: boolean;
  // O. Position sizing
  posType: string;
  posTypeCapital: number;
  posType1Risk: number;
  posType1Cap: number;
  posType2Pct: number;
  posType3Pct: number;
  // P. Misc.
  externalSection: boolean;
  externalIndie: SourceType;
}

export const defaultInputs: BacktestingTradingEngineInputs = {
  displaySection: true,
  showTradedBackground: true,
  showMarkers: true,
  showEntry: true,
  showTakeProfit: false,
  entriesSection: true,
  tradeDirection: TD1,
  entryA: EN1,
  entryB: EN0,
  entryType1Freq: 10.0,
  entryType5Len: 14,
  entryType5LongLvl: 30,
  entryType5ShortLvl: 70,
  entryType6TLen: 9,
  entryType6KLen: 26,
  showFilter: false,
  showFilteredOut: false,
  filterType1: false,
  filterType1Freq: 10.0,
  filterType2: false,
  filterType3: false,
  filterType4: false,
  filterType5: false,
  filterType5Len: 50,
  filterType5Bars: 1,
  filterType6: false,
  filterType6MaxRisk: 6.0,
  filterType7: false,
  filterType7IncPct: 6.0,
  filterType8: false,
  filterType9: false,
  filterType9Len: 20,
  filterType9OS: 25,
  filterType9OB: 75,
  filterType10: true,
  filterType10Len: 20,
  filterType10Mult: 3,
  filterType11: false,
  filterType11Len1: 5,
  filterType11Len2: 21,
  showEntryStop: SE1,
  entryStopType: ES2,
  entryStopType2Mult: 1.5,
  entryStopType2Len: 14,
  entryStopType3Pct: 3.0,
  entryStopType4Val: 0.001,
  showInTradeStop: true,
  inTradeStopType: IS7,
  inTradeStopType1Mult: 1.0,
  inTradeStopType2Pct: 2.0,
  inTradeStopType3Val: 0.001,
  inTradeStopType4Len: 26,
  inTradeStopType567Len: 20,
  inTradeStopType567Mult: 3.0,
  inTradeKickType: IK1,
  inTradeKickType2Mult: 2.0,
  inTradeKickType3Pct: 3.0,
  inTradeKickType4Val: 0.001,
  pyramiding: PY1,
  pyramidingType: PT6,
  pyramidingFilterNeeded: false,
  pyramidingMaxCnt: 10,
  pyramidingPosMult: 1.0,
  pyramiding1MultX: 1.0,
  pyramiding2Pct: 2.0,
  pyramiding3Val: 0.00001,
  hardExitsSection: true,
  exitType1: false,
  exitType1Freq: 10.0,
  exitType2: false,
  exitType3: false,
  exitType4: false,
  exitType4Len: 20,
  exitType4LongLvl: 70,
  exitType4ShortLvl: 30,
  exitType5: false,
  exitType5TLen: 9,
  exitType5KLen: 26,
  exitType6: false,
  exitType6Mult: 2.0,
  slippageType: SL1,
  slippageType2InPct: 0.25,
  slippageType2OutPct: 0.25,
  slippageType3InVal: 0.0001,
  slippageType3OutVal: 0.0001,
  feesType: FE1,
  feesType2InPct: 0.075,
  feesType2OutPct: 0.075,
  feesType3InVal: 10.0,
  feesType3OutVal: 10.0,
  eventsSection: true,
  eventType1: false,
  eventType1Mult: 1.0,
  eventType2: false,
  eventType3: false,
  eventType3Mult: 0.2,
  eventType4: false,
  eventType4Mult: 2.0,
  eventAtrLen: 14,
  pea: PA2,
  peaBars: 10,
  dateFilter: false,
  fromYear: 1900,
  fromMonth: 1,
  fromDay: 1,
  toYear: 2999,
  toMonth: 1,
  toDay: 1,
  alertsSection: true,
  alertType1: false,
  alertType2: false,
  alertType3: false,
  alertType4: false,
  alertType5: false,
  alertType6: false,
  alertType7: false,
  alertType8: false,
  alertType9: false,
  alertType10: false,
  posType: PS2,
  posTypeCapital: 100000,
  posType1Risk: 1.0,
  posType1Cap: 50.0,
  posType2Pct: 10.0,
  posType3Pct: 10.0,
  externalSection: true,
  externalIndie: 'close',
};

const BIG = 1e12;
const d = defaultInputs;
export const inputConfig: InputConfig[] = [
  { id: 'displaySection', type: 'bool', title: '═════════════ Display', defval: d.displaySection },
  { id: 'showTradedBackground', type: 'bool', title: 'Color Traded Background', defval: d.showTradedBackground },
  { id: 'showMarkers', type: 'bool', title: 'Show Entry/Exit Markers', defval: d.showMarkers },
  { id: 'showEntry', type: 'bool', title: 'Show Entry Level', defval: d.showEntry },
  { id: 'showTakeProfit', type: 'bool', title: 'Show Take Profit Level', defval: d.showTakeProfit },
  { id: 'entriesSection', type: 'bool', title: '═════════════ Entries', defval: d.entriesSection },
  { id: 'tradeDirection', type: 'string', title: 'Trade Direction', defval: d.tradeDirection, options: [TD1, TD2, TD3] },
  { id: 'entryA', type: 'string', title: 'Main Entry Strat', defval: d.entryA, options: [EN0, EN1, EN2, EN3, EN4, EN5, EN6] },
  { id: 'entryB', type: 'string', title: 'Alternate Entry Strat', defval: d.entryB, options: [EN0, EN1, EN2, EN3, EN4, EN5, EN6] },
  { id: 'entryType1Freq', type: 'float', title: '1. Frequency (approx. 1/n bars)', defval: d.entryType1Freq, min: 2, step: 4 },
  { id: 'entryType5Len', type: 'int', title: '5. Length', defval: d.entryType5Len, min: 2 },
  { id: 'entryType5LongLvl', type: 'int', title: '5. Long Crossover Level', defval: d.entryType5LongLvl, min: 0, max: 100 },
  { id: 'entryType5ShortLvl', type: 'int', title: '5. Short Crossunder Level', defval: d.entryType5ShortLvl, min: 0, max: 100 },
  { id: 'entryType6TLen', type: 'int', title: '6. Tenkan Length', defval: d.entryType6TLen, min: 2 },
  { id: 'entryType6KLen', type: 'int', title: '6. Kijun Length', defval: d.entryType6KLen, min: 2 },
  { id: 'showFilter', type: 'bool', title: '═════════════ Show Filter State', defval: d.showFilter },
  { id: 'showFilteredOut', type: 'bool', title: 'Show Filtered Out Entries', defval: d.showFilteredOut },
  { id: 'filterType1', type: 'bool', title: '1. Random', defval: d.filterType1 },
  { id: 'filterType1Freq', type: 'float', title: '... Frequency (approx. 1/n bars)', defval: d.filterType1Freq, min: 2, step: 4 },
  { id: 'filterType2', type: 'bool', title: '2. External Indicator (+1/-1)', defval: d.filterType2 },
  { id: 'filterType3', type: 'bool', title: '3. Bar direction=Trade direction', defval: d.filterType3 },
  { id: 'filterType4', type: 'bool', title: '4. Rising Volume', defval: d.filterType4 },
  { id: 'filterType5', type: 'bool', title: '5. Rising/Falling MA', defval: d.filterType5 },
  { id: 'filterType5Len', type: 'int', title: '... Length', defval: d.filterType5Len, min: 2 },
  { id: 'filterType5Bars', type: 'int', title: '... For n Bars', defval: d.filterType5Bars, min: 1 },
  { id: 'filterType6', type: 'bool', title: '6. Maximum % Stop allowed on entry', defval: d.filterType6 },
  { id: 'filterType6MaxRisk', type: 'float', title: '... %', defval: d.filterType6MaxRisk, min: 0.0, step: 0.5 },
  { id: 'filterType7', type: 'bool', title: '7. Maximum close change (%) allowed on entry', defval: d.filterType7 },
  { id: 'filterType7IncPct', type: 'float', title: '... %', defval: d.filterType7IncPct, min: 0.0, step: 0.5 },
  { id: 'filterType8', type: 'bool', title: '8. Ichimoku', defval: d.filterType8 },
  { id: 'filterType9', type: 'bool', title: '9. RSI OB/OS', defval: d.filterType9 },
  { id: 'filterType9Len', type: 'int', title: '... Length', defval: d.filterType9Len, min: 2 },
  { id: 'filterType9OS', type: 'int', title: '... Oversold Level', defval: d.filterType9OS, min: 0, max: 100 },
  { id: 'filterType9OB', type: 'int', title: '... Overbought Level', defval: d.filterType9OB, min: 0, max: 100 },
  { id: 'filterType10', type: 'bool', title: '10. Chandelier', defval: d.filterType10 },
  { id: 'filterType10Len', type: 'int', title: '... Length', defval: d.filterType10Len, min: 2 },
  { id: 'filterType10Mult', type: 'float', title: '... ATR Multiple', defval: d.filterType10Mult, min: 0, step: 0.25 },
  { id: 'filterType11', type: 'bool', title: '11. MA Squize', defval: d.filterType11 },
  { id: 'filterType11Len1', type: 'int', title: '... Fast MA', defval: d.filterType11Len1, min: 2 },
  { id: 'filterType11Len2', type: 'int', title: '... Slow MA', defval: d.filterType11Len2, min: 2 },
  { id: 'showEntryStop', type: 'string', title: '═══════════════ Show Entry Stops', defval: d.showEntryStop, options: [SE1, SE2, SE3] },
  { id: 'entryStopType', type: 'string', title: 'Entry Stop Selection', defval: d.entryStopType, options: [ES1, ES2, ES3, ES4] },
  { id: 'entryStopType2Mult', type: 'float', title: '2. ATR Multiple', defval: d.entryStopType2Mult, min: 0.05, step: 0.1 },
  { id: 'entryStopType2Len', type: 'int', title: '2. ATR Length', defval: d.entryStopType2Len, min: 2 },
  { id: 'entryStopType3Pct', type: 'float', title: '3. %', defval: d.entryStopType3Pct, min: 0.0001, step: 0.1 },
  { id: 'entryStopType4Val', type: 'float', title: '4. Value', defval: d.entryStopType4Val, min: 0.00000001, step: 0.0001 },
  { id: 'showInTradeStop', type: 'bool', title: '═════════════ Show In-Trade Stops', defval: d.showInTradeStop },
  { id: 'inTradeStopType', type: 'string', title: 'In-Trade Stop Selection', defval: d.inTradeStopType, options: [IS0, IS1, IS2, IS3, IS4, IS5, IS6, IS7, IS8] },
  { id: 'inTradeStopType1Mult', type: 'float', title: "1. X (Entry Stop's Amplitude) Multiple", defval: d.inTradeStopType1Mult, min: 0.001, step: 0.1 },
  { id: 'inTradeStopType2Pct', type: 'float', title: '2. %', defval: d.inTradeStopType2Pct, min: 0.001, step: 0.1 },
  { id: 'inTradeStopType3Val', type: 'float', title: '3. Value', defval: d.inTradeStopType3Val, min: 0.00000001, step: 0.0001 },
  { id: 'inTradeStopType4Len', type: 'int', title: '4. Length', defval: d.inTradeStopType4Len, min: 2 },
  { id: 'inTradeStopType567Len', type: 'int', title: '5-6-7. Length', defval: d.inTradeStopType567Len, min: 2 },
  { id: 'inTradeStopType567Mult', type: 'float', title: '5-6-7. Multiple', defval: d.inTradeStopType567Mult, min: 0.001, step: 0.5 },
  { id: 'inTradeKickType', type: 'string', title: '════ In-Trade Stop Kicks In When It Passes...', defval: d.inTradeKickType, options: [IK1, IK2, IK3, IK4] },
  { id: 'inTradeKickType2Mult', type: 'float', title: '2. X Multiple (+ is in trade direction, - is against)', defval: d.inTradeKickType2Mult, min: -BIG, step: 0.05 },
  { id: 'inTradeKickType3Pct', type: 'float', title: '3. %  (+/-)', defval: d.inTradeKickType3Pct, min: -BIG, step: 0.1 },
  { id: 'inTradeKickType4Val', type: 'float', title: '4. Value  (+/-)', defval: d.inTradeKickType4Val, min: -BIG, step: 0.0001 },
  { id: 'pyramiding', type: 'string', title: '═══════════════ Pyramiding', defval: d.pyramiding, options: [PY1, PY2, PY3] },
  { id: 'pyramidingType', type: 'string', title: 'Pyramiding is allowed...', defval: d.pyramidingType, options: [PT1, PT2, PT3, PT4, PT5, PT6] },
  { id: 'pyramidingFilterNeeded', type: 'bool', title: 'Filter must allow entry', defval: d.pyramidingFilterNeeded },
  { id: 'pyramidingMaxCnt', type: 'int', title: 'Maximum number of pyramiding entries', defval: d.pyramidingMaxCnt, min: 1 },
  { id: 'pyramidingPosMult', type: 'float', title: 'Position Size Multiple of Original Entry Position', defval: d.pyramidingPosMult, min: 0.00000001, step: 0.1 },
  { id: 'pyramiding1MultX', type: 'float', title: '1. Multiple of X (stop)', defval: d.pyramiding1MultX, min: 0.00000001 },
  { id: 'pyramiding2Pct', type: 'float', title: '2. % Increment', defval: d.pyramiding2Pct, min: 0.00000001 },
  { id: 'pyramiding3Val', type: 'float', title: '3. Price Increment', defval: d.pyramiding3Val, min: 0.00000001 },
  { id: 'hardExitsSection', type: 'bool', title: '═════════════ Hard Exits', defval: d.hardExitsSection },
  { id: 'exitType1', type: 'bool', title: '1. Random', defval: d.exitType1 },
  { id: 'exitType1Freq', type: 'float', title: '... Frequency (approx. 1/n bars)', defval: d.exitType1Freq, min: 2, step: 4 },
  { id: 'exitType2', type: 'bool', title: '2. External Indicator (+3/-3)', defval: d.exitType2 },
  { id: 'exitType3', type: 'bool', title: '3. Filter Transitions', defval: d.exitType3 },
  { id: 'exitType4', type: 'bool', title: '4. RSI Crosses', defval: d.exitType4 },
  { id: 'exitType4Len', type: 'int', title: '... Length', defval: d.exitType4Len, min: 2 },
  { id: 'exitType4LongLvl', type: 'int', title: '... Exit Long Crossunder Level', defval: d.exitType4LongLvl, min: 0, max: 100 },
  { id: 'exitType4ShortLvl', type: 'int', title: '... Exit Short Crossover Level', defval: d.exitType4ShortLvl, min: 0, max: 100 },
  { id: 'exitType5', type: 'bool', title: '5. Tenkan/Kijun Crosses', defval: d.exitType5 },
  { id: 'exitType5TLen', type: 'int', title: '... Tenkan Length', defval: d.exitType5TLen, min: 2 },
  { id: 'exitType5KLen', type: 'int', title: '... Kijun Length', defval: d.exitType5KLen, min: 2 },
  { id: 'exitType6', type: 'bool', title: '6. When Take Profit Level (multiple of X) is reached', defval: d.exitType6 },
  { id: 'exitType6Mult', type: 'float', title: '... X Multiple', defval: d.exitType6Mult, min: 0.0 },
  { id: 'slippageType', type: 'string', title: '═══════════════ Slippage', defval: d.slippageType, options: [SL1, SL2, SL3] },
  { id: 'slippageType2InPct', type: 'float', title: '2. % Slippage on Entry', defval: d.slippageType2InPct, min: 0.0, step: 0.1 },
  { id: 'slippageType2OutPct', type: 'float', title: '2. % Slippage on Exit', defval: d.slippageType2OutPct, min: 0.0, step: 0.1 },
  { id: 'slippageType3InVal', type: 'float', title: '3. Fixed Slippage on Entry (quote)', defval: d.slippageType3InVal, min: 0.0, step: 0.0001 },
  { id: 'slippageType3OutVal', type: 'float', title: '3. Fixed Slippage on Exit (quote)', defval: d.slippageType3OutVal, min: 0.0, step: 0.0001 },
  { id: 'feesType', type: 'string', title: '═══════════════ Fees', defval: d.feesType, options: [FE1, FE2, FE3] },
  { id: 'feesType2InPct', type: 'float', title: '2. % of Position on Entry (Curr)', defval: d.feesType2InPct, min: 0.0, step: 0.1 },
  { id: 'feesType2OutPct', type: 'float', title: '2. % of Position on Exit (Curr)', defval: d.feesType2OutPct, min: 0.0, step: 0.1 },
  { id: 'feesType3InVal', type: 'float', title: '3. Fixed Amount on Entry (Curr)', defval: d.feesType3InVal, min: 0.0 },
  { id: 'feesType3OutVal', type: 'float', title: '3. Fixed Amount on Exit (Curr)', defval: d.feesType3OutVal, min: 0.0 },
  { id: 'eventsSection', type: 'bool', title: '═════════════ In-Trade Events', defval: d.eventsSection },
  { id: 'eventType1', type: 'bool', title: '1. Show When Price Is Within... (orange)', defval: d.eventType1 },
  { id: 'eventType1Mult', type: 'float', title: '... ATR Multiple of Stop', defval: d.eventType1Mult, min: 0.0, step: 0.1 },
  { id: 'eventType2', type: 'bool', title: '2. Show Possible Tops/Bottoms (red)', defval: d.eventType2 },
  { id: 'eventType3', type: 'bool', title: '3. Show Stop Move Larger than... (yellow)', defval: d.eventType3 },
  { id: 'eventType3Mult', type: 'float', title: '... ATR multiple', defval: d.eventType3Mult, min: 0.0, step: 0.05 },
  { id: 'eventType4', type: 'bool', title: '4. Show Favorable Price Move Larger than... (green)', defval: d.eventType4 },
  { id: 'eventType4Mult', type: 'float', title: '... ATR Multiple', defval: d.eventType4Mult, min: 0.0, step: 0.25 },
  { id: 'eventAtrLen', type: 'int', title: 'ATR Length for Events', defval: d.eventAtrLen, min: 2 },
  { id: 'pea', type: 'string', title: '═══════════════ Post-Exit Analysis (PEA)', defval: d.pea, options: [PA1, PA2] },
  { id: 'peaBars', type: 'int', title: 'Look n bars after Exit', defval: d.peaBars, min: 3 },
  { id: 'dateFilter', type: 'bool', title: '═════════════ Date Range Filtering', defval: d.dateFilter },
  { id: 'fromYear', type: 'int', title: 'From Year', defval: d.fromYear, min: 1900 },
  { id: 'fromMonth', type: 'int', title: 'From Month', defval: d.fromMonth, min: 1, max: 12 },
  { id: 'fromDay', type: 'int', title: 'From Day', defval: d.fromDay, min: 1, max: 31 },
  { id: 'toYear', type: 'int', title: 'To Year', defval: d.toYear, min: 1900 },
  { id: 'toMonth', type: 'int', title: 'To Month', defval: d.toMonth, min: 1, max: 12 },
  { id: 'toDay', type: 'int', title: 'To Day', defval: d.toDay, min: 1, max: 31 },
  { id: 'alertsSection', type: 'bool', title: '═════════════ Alert Triggers', defval: d.alertsSection },
  { id: 'alertType1', type: 'bool', title: 'Long Entry', defval: d.alertType1 },
  { id: 'alertType2', type: 'bool', title: 'Long Pyramiding Entry', defval: d.alertType2 },
  { id: 'alertType3', type: 'bool', title: 'Short Entry', defval: d.alertType3 },
  { id: 'alertType4', type: 'bool', title: 'Short Pyramiding Entry', defval: d.alertType4 },
  { id: 'alertType5', type: 'bool', title: 'Long Exit', defval: d.alertType5 },
  { id: 'alertType6', type: 'bool', title: 'Short Exit', defval: d.alertType6 },
  { id: 'alertType7', type: 'bool', title: 'Event 1: Price nearing Stop', defval: d.alertType7 },
  { id: 'alertType8', type: 'bool', title: 'Event 2: Possible Tops/Bottoms', defval: d.alertType8 },
  { id: 'alertType9', type: 'bool', title: 'Event 3: Stop Move', defval: d.alertType9 },
  { id: 'alertType10', type: 'bool', title: 'Event 4: Price Swing', defval: d.alertType10 },
  { id: 'posType', type: 'string', title: '═══════════════ Position Sizing', defval: d.posType, options: [PS1, PS2, PS3] },
  { id: 'posTypeCapital', type: 'float', title: 'Initial Capital (In Units of Currency)', defval: d.posTypeCapital, min: 0.0, step: 10000 },
  { id: 'posType1Risk', type: 'float', title: '1. % of Equity Risked Per Trade (Stop% * Position)', defval: d.posType1Risk, min: 0.0, max: 100.0, step: 0.1 },
  { id: 'posType1Cap', type: 'float', title: '1. Cap on position sizes (% of Equity)', defval: d.posType1Cap, min: 0.0, max: 100.0, step: 10.0 },
  { id: 'posType2Pct', type: 'float', title: '2. % of Equity', defval: d.posType2Pct, min: 0.0, max: 100.0, step: 5.0 },
  { id: 'posType3Pct', type: 'float', title: '3. % of Initial Capital', defval: d.posType3Pct, min: 0.0, max: 100.0, step: 5.0 },
  { id: 'externalSection', type: 'bool', title: '═════════════ External Indicator', defval: d.externalSection },
  { id: 'externalIndie', type: 'source', title: 'Connect your indicator here (Study mode only)', defval: d.externalIndie },
];

// Colours (0. Inputs, Colors; 14. Plots): color(c, 0) colours are opaque
const GREEN_RAW = '#00FF00', GREEN_MEDIUM = '#00B300', GREEN_SEMI_DARK = '#009900', GREEN_DARK = '#006600';
const RED_RAW = '#FF0000', RED_MEDIUM = '#CC0000', RED_SEMI_DARK = '#990000', RED_DARK = '#330000';
const FUCHSIA_MEDIUM = '#C000C0', YELLOW_MEDIUM = '#C0C000', ORANGE_MEDIUM = '#CC8400', ORANGE_DARK = '#996300';
const BLUE_MEDIUM = '#4985E7', YELLOW = '#FFFF00';
/** color(#00FF00, 93) / color(#FF0000, 90) */
const GREEN_BACKGROUND = '#00FF0012', RED_BACKGROUND = '#FF00001A';
/** orange, #00cdcd: colours of the P&L colour series (as the series gives them) */
const AAA = '#FF7F00', TI2 = '#00CDCD';
/** Plain colours of static plots: Pine version 3 default transparency 35 (alpha byte A6) */
const V3 = (c: string) => `${c}A6`;
const BLK_P = V3('#171B29'), AAA_P = V3(AAA), GF1_P = V3('#6C9CEC'), GF2_P = V3('#4978E7'), TI1_P = V3('#009A9A'), TI2_P = V3(TI2);
/** Default text colour of a plotchar without textcolor */
const PINE_TEXT = '#2962FF';
/** Default colour of a plot coloured by a series */
const SERIES_DEFAULT = '#3BB3E4';

const DW = 'data_window' as const;
/** The data-window values (plotchar with an empty character), in the order of the original */
const DATA_WINDOW: [string, string][] = [
  ['═════════ Global Information', BLK_P],
  ['ALL: Avg Profitability Per Trade (X)', SERIES_DEFAULT],
  ['ALL: Avg Profitability Per Trade (curr)', SERIES_DEFAULT],
  ['ALL: Avg Profitability Per Bar (X)', GF2_P],
  ['ALL: Profit Factor', GF1_P],
  ['ALL: Win Rate (%)', GF1_P],
  ['ALL: Equity (curr)', AAA_P],
  ['ALL: Return On Capital (%)', GF1_P],
  ['ALL: Max drawdown (%)', RED_RAW],
  ['ALL: Avg Win (X)', GREEN_MEDIUM],
  ['ALL: Avg Loss (X)', RED_MEDIUM],
  ['ALL: Trades', GF1_P],
  ['ALL: Avg Trade Length', GF2_P],
  ['ALL: Avg X (%) = Stop% = Risk', RED_SEMI_DARK],
  ['ALL: Avg X (currency)', RED_SEMI_DARK],
  ['ALL: Traded Volume (curr)', GF2_P],
  ['PYR: Avg Profitability Per Entry (X)', SERIES_DEFAULT],
  ['PEA: Avg Max Opp. Available (X)', GREEN_MEDIUM],
  ['PEA: Avg Drawdown to Max Opp. (X)', RED_MEDIUM],
  ['═════════ Trade Information', BLK_P],
  ['1ST: Entry Fill after slippage', TI1_P],
  ['1ST: Exit Fill after slippage', TI1_P],
  ['ALL: P&L (X) after slippage', SERIES_DEFAULT],
  ['ALL: P&L/Bar (X)', TI2_P],
  ['ALL: P&L (%) after slippage', TI2_P],
  ['ALL: P&L (curr) after slippage & fees', TI2_P],
  ['ALL: Impact on Equity (%)', TI1_P],
  ['1ST: Trade Length', TI1_P],
  ['ALL: X (% of fill) = Stop = Risk', RED_MEDIUM],
  ['ALL: X (curr)', RED_MEDIUM],
  ['ALL: Slippage cost (curr)', RED_MEDIUM],
  ['ALL: Fees paid (curr)', RED_MEDIUM],
  ['ALL: Position Size (curr)', TI1_P],
  ['ALL: Position Size (qty)', TI1_P],
  ['PYR: Avg P&L (X) after slippage & fees', SERIES_DEFAULT],
  ['PEA: Max Opportunity Available (X)', GREEN_MEDIUM],
  ['PEA: Drawdown to Max Opp. (X)', RED_MEDIUM],
];
const NDW = DATA_WINDOW.length;

export const plotConfig: PlotConfig[] = [
  ...DATA_WINDOW.map(([title, c], k): PlotConfig => ({ id: `plot${k}`, title, color: c, lineWidth: 1, display: DW })),
  { id: `plot${NDW}`, title: 'Entry Level', color: BLUE_MEDIUM, lineWidth: 1, style: 'circles' },
  // transp = 30 is not applied to a color(c, 0) colour
  { id: `plot${NDW + 1}`, title: 'Long Entry Stop', color: ORANGE_DARK, lineWidth: 1, style: 'circles' },
  { id: `plot${NDW + 2}`, title: 'Short Entry Stop', color: ORANGE_DARK, lineWidth: 1, style: 'circles' },
  { id: `plot${NDW + 3}`, title: 'In-trade stop', color: ORANGE_MEDIUM, lineWidth: 2, style: 'circles' },
  { id: `plot${NDW + 4}`, title: 'Take-Profit Level', color: FUCHSIA_MEDIUM, lineWidth: 2, style: 'circles' },
];

const TRADE_ID = 'BTE';
/** plotshape (shape<k>) and plotchar (char<k>) declarations drawn on the chart; char0..char36 are the data-window plots */
export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Bull Filter OK', style: 'triangleup', location: 'top', color: GREEN_MEDIUM, size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Bear Filter OK', style: 'triangledown', location: 'top', color: RED_MEDIUM, size: 'tiny' },
  { id: 'shape2', kind: 'shape', title: 'Event 1: Price nearing stop', style: 'circle', location: 'absolute', color: ORANGE_MEDIUM, size: 'tiny' },
  { id: 'shape3', kind: 'shape', title: 'Event 2: Possible Top/Bottom', style: 'circle', location: 'absolute', color: RED_SEMI_DARK, size: 'tiny' },
  { id: 'shape4', kind: 'shape', title: 'Event 3: Stop Moved', style: 'circle', location: 'absolute', color: YELLOW_MEDIUM, size: 'tiny' },
  { id: 'shape5', kind: 'shape', title: 'Event 4: Big Price Swing', style: 'circle', location: 'absolute', color: GREEN_MEDIUM, size: 'tiny' },
  { id: 'char37', kind: 'char', title: 'Long Entry A', char: '╚', location: 'absolute', color: GREEN_RAW, size: 'small', text: `${TRADE_ID}\nEnter\nLong A\n▲`, textcolor: GREEN_RAW },
  { id: 'char38', kind: 'char', title: 'Long Entry B', char: '╚', location: 'absolute', color: GREEN_RAW, size: 'small', text: `${TRADE_ID}\nEnter\nLong B\n▲`, textcolor: GREEN_RAW },
  { id: 'char39', kind: 'char', title: 'Short Entry A', char: '╔', location: 'absolute', color: RED_RAW, size: 'small', text: `${TRADE_ID}\nEnter\nShort A\n▼`, textcolor: RED_RAW },
  { id: 'char40', kind: 'char', title: 'Short Entry B', char: '╔', location: 'absolute', color: RED_RAW, size: 'small', text: `${TRADE_ID}\nEnter\nShort B\n▼`, textcolor: RED_RAW },
  { id: 'char41', kind: 'char', title: 'Exit Long', char: '╗', location: 'absolute', color: GREEN_MEDIUM, size: 'small', text: `${TRADE_ID}\nExit\nLong\n▼`, textcolor: PINE_TEXT },
  { id: 'char42', kind: 'char', title: 'Exit Short', char: '╝', location: 'absolute', color: RED_MEDIUM, size: 'small', text: `${TRADE_ID}\nExit\nShort\n▲`, textcolor: PINE_TEXT },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'bgcolor0', kind: 'bgcolor', title: 'Traded Background' }];

const SYSTEM_NAME = 'Backtesting & Trading Engine [PineCoders]';
/** The original's alertcondition */
export const alertConditions: AlertConditionDecl[] = [{ id: 'alert0', title: SYSTEM_NAME, message: TRADE_ID }];

export const metadata = {
  title: SYSTEM_NAME,
  shortTitle: SYSTEM_NAME,
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; na (and +-infinity for == / !=) compare false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > EPS;
/** nz(): na and +-infinity give the replacement */
const nz = (x: number, r = 0) => (Number.isFinite(x) ? x : r);
/** Pine round(): half away from zero */
const pround = (x: number) => (x < 0 ? -Math.round(-x) : Math.round(x));
/** Round(_val, _decimals) of the original */
const Round = (v: number, dec: number) => {
  const p = Math.pow(10, dec);
  return pround(Math.abs(v) * p) / p * Math.sign(v);
};
/** A float used as a condition (change(x) ? ...): true when not na and not 0 */
const truthy = (x: number) => !Number.isNaN(x) && x !== 0;
const plotValue = (x: number) => (Number.isFinite(x) ? x : NaN);

/** f_pseudo_random_number(_range, _seed) at one call site (its own history of _return: state[k]) */
function randomSite(state: number[], k: number, range: number, seed: number) {
  return (n: number) => {
    let r = (3.14159 * nz(state[k]!, 1)) % (n + seed);
    r = r % range;
    state[k] = r;
    return r;
  };
}

type Point = { time: Bar['time']; value: number; color?: string };

/** ta.rising / ta.falling one bar at a time (the counter rules of the oakscriptjs array function, same results) */
class MonotonicStep implements Committable {
  private prev = NaN;
  private count = 0;
  private nextPrev = NaN;
  private nextCount = 0;
  private stepped = false;

  constructor(private readonly length: number, private readonly test: (newer: number, older: number) => boolean) {
    if (!(length > 0)) throw new Error(`ta: length must be positive (${length})`);
  }

  step(value: number): boolean {
    this.stepped = true;
    let count = this.count;
    if (Number.isFinite(value) && Number.isFinite(this.prev)) count = this.test(value, this.prev) ? count + 1 : 0;
    this.nextPrev = value;
    this.nextCount = count;
    return count >= this.length;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.prev = this.nextPrev;
    this.count = this.nextCount;
  }
}

/** (ta.lowest(low, len) + ta.highest(high, len)) / 2 */
class DonchianStep implements Committable {
  private readonly hi = taStep.highest();
  private readonly lo = taStep.lowest();

  constructor(private readonly length: number) {}

  step(high: number, low: number): number {
    const lo = this.lo.step(low, this.length);
    const hi = this.hi.step(high, this.length);
    return (lo + hi) / 2;
  }

  commit(): void {
    this.hi.commit();
    this.lo.commit();
  }
}

function machines(cfg: BacktestingTradingEngineInputs) {
  return {
    atr567: taStep.atr(cfg.inTradeStopType567Len),
    hh567: taStep.highest(),
    ll567: taStep.lowest(),
    atrF10: taStep.atr(cfg.filterType10Len),
    hhF10: taStep.highest(),
    llF10: taStep.lowest(),
    upma: taStep.ema(cfg.filterType11Len1),
    dnma: taStep.ema(cfg.filterType11Len2),
    atr50: taStep.atr(50),
    atrES: taStep.atr(cfg.entryStopType2Len),
    volRising: new MonotonicStep(1, gt),
    ma5: taStep.sma(),
    ma5Rising: new MonotonicStep(cfg.filterType5Bars, gt),
    ma5Falling: new MonotonicStep(cfg.filterType5Bars, lt),
    tenkan: new DonchianStep(20),
    kijun: new DonchianStep(60),
    kumoB: new DonchianStep(120),
    kijunRising: new MonotonicStep(1, gt),
    tenkanRising: new MonotonicStep(1, gt),
    kijunFalling: new MonotonicStep(1, lt),
    tenkanFalling: new MonotonicStep(1, lt),
    rsi: taStep.rsi(cfg.filterType9Len),
    rsi5: taStep.rsi(cfg.entryType5Len),
    rsiUp5: taStep.crossover(),
    rsiDn5: taStep.crossunder(),
    e6T: new DonchianStep(cfg.entryType6TLen),
    e6K: new DonchianStep(cfg.entryType6KLen),
    tkUp6: taStep.crossover(),
    tkDn6: taStep.crossunder(),
    stop4: new DonchianStep(cfg.inTradeStopType4Len),
    rsiX: taStep.rsi(cfg.exitType4Len),
    rsiDnX: taStep.crossunder(),
    rsiUpX: taStep.crossover(),
    x5T: new DonchianStep(cfg.exitType5TLen),
    x5K: new DonchianStep(cfg.exitType5KLen),
    tkDnX: taStep.crossunder(),
    tkUpX: taStep.crossover(),
    eventAtr: taStep.atr(cfg.eventAtrLen),
    atr14: taStep.atr(14),
    rsiPh: new PivotStep(1, 1, true),
    rsiPl: new PivotStep(1, 1, false),
  };
}

/** ——— 1. Variable initializations (state carried from bar to bar) */
const initialVars = () => ({
  All_Entries: 0,
  All_PLXTot: 0,
  All_PLXAvg: 0,
  All_ProfitFactor: 0,
  All_TradeLengthsTot: 0,
  All_TradeLengthsAvg: 0,
  All_VolumeTraded: 0,
  All_Winning: 0,
  All_Losing: 0,
  All_WinsX: 0,
  All_LoseX: 0,
  All_WinsEqu: 0,
  All_LoseEqu: 0,
  All_XEquTot: 0,
  All_XEquAvg: 0,
  All_XPctTot: 0,
  All_XPctAvg: 0,
  First_Entries: 0,
  First_Winning: 0,
  First_Losing: 0,
  First_WinsEqu: 0,
  First_LoseEqu: 0,
  Pyr_Entries: 0,
  Pyr_PLXTot: 0,
  Pyr_PLXAvg: 0,
  PEA_Analyses: 0,
  PEA_MaxDrawdownTot: 0,
  PEA_MaxOppReachedTot: 0,
  Equity: NaN,
  ReturnOnEquity: 0,
  Ruin: false,
  EquityMin: NaN,
  EquityMax: NaN,
  MaxDrawdown: NaN,
  InTradeEquity: 0,
  InTradeStartEquity: 0,
  EntryOrder: NaN,
  EntryFill: NaN,
  EntryStop: NaN,
  EntryX: NaN,
  EntryXPct: NaN,
  EntryXEqu: NaN,
  ExitOrder: NaN,
  ExitFill: NaN,
  FeesPaidIn: NaN,
  FeesPaidOut: NaN,
  LastEntryNumber: NaN,
  LastEntryPrice: NaN,
  PositionIn: NaN,
  PositionOut: NaN,
  SlipPaidIn: NaN,
  SlipPaidOut: NaN,
  SlippageEqu: NaN,
  TradeLength: NaN,
  PyrEntries: 0,
  PyrEntryXPctTot: 0,
  PyrEntryXPctAvg: 0,
  PyrFeesEquTot: 0,
  PyrPositionInTot: 0,
  PyrPositionInQtyTot: 0,
  PyrSlipEquTot: 0,
  PyrTradeLengthsTot: 0,
  PyrTradeLengthsAvg: 0,
  PEAInLong: false,
  PEABarToMaxOpp: 0,
  PEAMaxOppReached: 0,
  PEAMaxRiskReached: 0,
  PEAMaxDrawdown: 0,
  PEAReferenceLevel: 0,
  PEAX: 0,
  PEABar: 0,
  InPEA: false,
  peaOppLastCall: NaN,
  pLongEntryTrigger: false,
  pShortEntryTrigger: false,
  pInLong: false,
  pInShort: false,
  pExitCondition: false,
  pEntryTrigger: false,
  pPyramidEntry: false,
  pEntryNumber: NaN,
  pInTradeStop: NaN,
  pMaxReached: NaN,
  pExitTrigger: false,
  pLongExitTrigger: false,
  pShortExitTrigger: false,
  pLongEntry: false,
  pShortEntry: false,
  pFilterLongOK: false,
  pFilterShortOK: false,
  pPyramidLongEntry: false,
  pPyramidShortEntry: false,
  pEntryIsALong: false,
  pEntryIsBLong: false,
  pEntryIsAShort: false,
  pEntryIsBShort: false,
  pEquity: NaN,
  pEvent1: false,
  pClongStop: NaN,
  pCshortStop: NaN,
  pC2longStop: NaN,
  pC2shortStop: NaN,
  pC2dir: NaN,
  pVSmax: NaN,
  pVSmin: NaN,
  pVSvstop: NaN,
  pVSisUptrend: null as boolean | null,
  /** _return[1] of each f_pseudo_random_number call site */
  rnd: [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN],
});
type BteVars = ReturnType<typeof initialVars>;

interface BteRun extends BarRunState<BteVars> {
  m: ReturnType<typeof machines>;
  ctx: { mintick: number; RoundToTick: (p: number) => number; TradeDateIsAllowed: (t: number) => boolean };
  /** Values of another study's output connected as the external indicator (null: a bar source) */
  external: number[] | null;
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  MinOCs: number[];
  MaxOCs: number[];
  FKumoA: number[];
  FKumoB: number[];
  ExternalIndie: number[];
  DWV: number[][];
  DWC: string[][];
  entryLevel: number[];
  longEntryStop: number[];
  shortEntryStop: number[];
  inTradeStopPlot: number[];
  takeProfitPlot: number[];
  alertFlags: boolean[];
  points: Point[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
  alertTimes: number[];
}

function study(inputs: Partial<BacktestingTradingEngineInputs>): BarStudy<BteRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const externalValue = barSource(cfg.externalIndie);

  // Inputs and states
  const GenerateLongs = cfg.tradeDirection !== TD3;
  const GenerateShorts = cfg.tradeDirection !== TD2;
  const EntryType1A = cfg.entryA === EN1, EntryType1B = cfg.entryB === EN1;
  const EntryType2 = cfg.entryA === EN2 || cfg.entryB === EN2;
  const EntryType3 = cfg.entryA === EN3 || cfg.entryB === EN3;
  const EntryType4 = cfg.entryA === EN4 || cfg.entryB === EN4;
  const EntryType5 = cfg.entryA === EN5 || cfg.entryB === EN5;
  const EntryType6 = cfg.entryA === EN6 || cfg.entryB === EN6;
  const ShowEntryStopEntry = cfg.showEntryStop === SE2, ShowEntryStopAll = cfg.showEntryStop === SE3;
  const InTradeStopDisabled = cfg.inTradeStopType === IS0;
  const PyramidingOff = cfg.pyramiding === PY1, PyramidingOffButShow = cfg.pyramiding === PY2, PyramidingOn = cfg.pyramiding === PY3;
  const pyrType = (t: string) => !PyramidingOff && cfg.pyramidingType === t;
  const PyramidingType1 = pyrType(PT1), PyramidingType2 = pyrType(PT2), PyramidingType3 = pyrType(PT3);
  const PyramidingType4 = pyrType(PT4), PyramidingType5 = pyrType(PT5), PyramidingType6 = pyrType(PT6);
  const SlippageType2 = cfg.slippageType === SL2, SlippageType3 = cfg.slippageType === SL3;
  // FeesType2 = FeesType == SL2 (same strings as FE2 / FE3)
  const FeesType2 = cfg.feesType === SL2, FeesType3 = cfg.feesType === SL3;
  const PEAOn = cfg.pea === PA2;
  const PosType1 = cfg.posType === PS1, PosType2 = cfg.posType === PS2;
  const Cap = cfg.posTypeCapital;
  // Fixed fees converted to equ: nz(FeesType3In[1], FeesType3InVal / PosTypeCapital)
  const FeesType3In = cfg.feesType3InVal / Cap, FeesType3Out = cfg.feesType3OutVal / Cap;

  const PMC = (v: number) => (ge(v, 0.0) ? GREEN_MEDIUM : RED_RAW);
  const dir = (long: boolean) => (long ? 1 : -1);

  return {
    fullRunReason: () => (isBarSource(cfg.externalIndie) ? null : 'source of another study'),
    init(bars, chart) {
      const mintick = mintickOf(chart);
      const RoundToTick = (p: number) => pround(p / mintick) * mintick;
      // timestamp(FromYear, FromMonth, FromDay, 00, 00) / (ToYear, ToMonth, ToDay, 23, 59): exchange time zone
      const tz = timezoneOf(chart);
      const FromDate = ptime.timestamp(tz, cfg.fromYear, cfg.fromMonth, cfg.fromDay, 0, 0);
      const ToDate = ptime.timestamp(tz, cfg.toYear, cfg.toMonth, cfg.toDay, 23, 59);
      const msOf = (t: number) => (t < 1e12 ? t * 1000 : t);
      const TradeDateIsAllowed = (time: number) => {
        const t = msOf(time);
        return cfg.dateFilter ? t >= FromDate && t <= ToDate : true;
      };
      const m = machines(cfg);
      const s: BteRun = {
        m,
        ctx: { mintick, RoundToTick, TradeDateIsAllowed },
        external: isBarSource(cfg.externalIndie) ? null : getSourceSeries(bars, cfg.externalIndie).toArray().map((v) => v ?? NaN),
        open: [], high: [], low: [], close: [], MinOCs: [], MaxOCs: [], FKumoA: [], FKumoB: [], ExternalIndie: [],
        DWV: Array.from({ length: NDW }, () => []),
        DWC: Array.from({ length: NDW }, () => []),
        entryLevel: [], longEntryStop: [], shortEntryStop: [], inTradeStopPlot: [], takeProfitPlot: [], alertFlags: [],
        points: Array.from({ length: NDW + 5 }, () => []),
        markers: [], bgColors: [], alertTimes: [],
        steps: Object.values(m),
        vars: initialVars(),
        lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, s.alertTimes];
      s.series = [
        s.open, s.high, s.low, s.close, s.MinOCs, s.MaxOCs, s.FKumoA, s.FKumoB, s.ExternalIndie, ...s.DWV, ...s.DWC,
        s.entryLevel, s.longEntryStop, s.shortEntryStop, s.inTradeStopPlot, s.takeProfitPlot, s.alertFlags, ...s.points,
      ];
      return s;
    },
    copyVars: (v) => ({ ...v, rnd: v.rnd.slice() }),
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const m = s.m;
      const { mintick, RoundToTick, TradeDateIsAllowed } = s.ctx;
      const { open, high, low, close, MinOCs, MaxOCs, FKumoA, FKumoB, ExternalIndie, DWV, DWC } = s;
      const { entryLevel, longEntryStop, shortEntryStop, inTradeStopPlot, takeProfitPlot, markers, bgColors, alertFlags } = s;
      let { All_Entries, All_PLXTot, All_PLXAvg, All_ProfitFactor, All_TradeLengthsTot, All_TradeLengthsAvg, All_VolumeTraded, All_Winning, All_Losing, All_WinsX, All_LoseX, All_WinsEqu, All_LoseEqu, All_XEquTot, All_XEquAvg, All_XPctTot, All_XPctAvg, First_Entries, First_Winning, First_Losing, First_WinsEqu, First_LoseEqu, Pyr_Entries, Pyr_PLXTot, Pyr_PLXAvg, PEA_Analyses, PEA_MaxDrawdownTot, PEA_MaxOppReachedTot, Equity, ReturnOnEquity, Ruin, EquityMin, EquityMax, MaxDrawdown, InTradeEquity, InTradeStartEquity, EntryOrder, EntryFill, EntryStop, EntryX, EntryXPct, EntryXEqu, ExitOrder, ExitFill, FeesPaidIn, FeesPaidOut, LastEntryNumber, LastEntryPrice, PositionIn, PositionOut, SlipPaidIn, SlipPaidOut, SlippageEqu, TradeLength, PyrEntries, PyrEntryXPctTot, PyrEntryXPctAvg, PyrFeesEquTot, PyrPositionInTot, PyrPositionInQtyTot, PyrSlipEquTot, PyrTradeLengthsTot, PyrTradeLengthsAvg, PEAInLong, PEABarToMaxOpp, PEAMaxOppReached, PEAMaxRiskReached, PEAMaxDrawdown, PEAReferenceLevel, PEAX, PEABar, InPEA, peaOppLastCall, pLongEntryTrigger, pShortEntryTrigger, pInLong, pInShort, pExitCondition, pEntryTrigger, pPyramidEntry, pEntryNumber, pInTradeStop, pMaxReached, pExitTrigger, pLongExitTrigger, pShortExitTrigger, pLongEntry, pShortEntry, pFilterLongOK, pFilterShortOK, pPyramidLongEntry, pPyramidShortEntry, pEntryIsALong, pEntryIsBLong, pEntryIsAShort, pEntryIsBShort, pEquity, pEvent1, pClongStop, pCshortStop, pC2longStop, pC2shortStop, pC2dir, pVSmax, pVSmin, pVSvstop, pVSisUptrend } = v;
      open[i] = b.open;
      high[i] = b.high;
      low[i] = b.low;
      close[i] = b.close;
      ExternalIndie[i] = nz(s.external ? s.external[i]! : externalValue(b));
      for (let k = 0; k < NDW; k++) DWC[k][i] = DATA_WINDOW[k][1];

      // 2. Indicators
      const atr567 = m.atr567.step(b.high, b.low, b.close);
      const hh567 = m.hh567.step(b.high, cfg.inTradeStopType567Len), ll567 = m.ll567.step(b.low, cfg.inTradeStopType567Len);
      const atrF10 = m.atrF10.step(b.high, b.low, b.close);
      const hhF10 = m.hhF10.step(b.high, cfg.filterType10Len), llF10 = m.llF10.step(b.low, cfg.filterType10Len);
      // MA Squize (Filter 11): MAsThreSHoldPips = 15, ATRmode = true, ATRperiod = 50, ATRmultipl = 0.4
      const upma = m.upma.step(b.close), dnma = m.dnma.step(b.close);
      const atr50 = m.atr50.step(b.high, b.low, b.close);
      const atrES = m.atrES.step(b.high, b.low, b.close);
      // 4. Filters
      const volRising = m.volRising.step(b.volume ?? NaN);
      const Filter5Ma = nz(m.ma5.step(b.close, cfg.filterType5Len));
      const ma5Rising = m.ma5Rising.step(Filter5Ma), ma5Falling = m.ma5Falling.step(Filter5Ma);
      const FTenkan = m.tenkan.step(b.high, b.low), FKijun = m.kijun.step(b.high, b.low);
      FKumoB[i] = m.kumoB.step(b.high, b.low);
      FKumoA[i] = (FTenkan + FKijun) / 2;
      const fKijunRising = m.kijunRising.step(FKijun), fTenkanRising = m.tenkanRising.step(FTenkan);
      const fKijunFalling = m.kijunFalling.step(FKijun), fTenkanFalling = m.tenkanFalling.step(FTenkan);
      const Rsi = m.rsi.step(b.close);
      // 5. Entries
      const Entry5Rsi = m.rsi5.step(b.close);
      const rsiUp5 = m.rsiUp5.step(Entry5Rsi, cfg.entryType5LongLvl), rsiDn5 = m.rsiDn5.step(Entry5Rsi, cfg.entryType5ShortLvl);
      const e6T = m.e6T.step(b.high, b.low), e6K = m.e6K.step(b.high, b.low);
      const tkUp6 = m.tkUp6.step(e6T, e6K), tkDn6 = m.tkDn6.step(e6T, e6K);
      // 8. In-trade stop 4
      const InTradeStop4 = m.stop4.step(b.high, b.low);
      // 9. Exits
      const Exit4Rsi = m.rsiX.step(b.close);
      const rsiDnX = m.rsiDnX.step(Exit4Rsi, cfg.exitType4LongLvl), rsiUpX = m.rsiUpX.step(Exit4Rsi, cfg.exitType4ShortLvl);
      const x5T = m.x5T.step(b.high, b.low), x5K = m.x5K.step(b.high, b.low);
      const tkDnX = m.tkDnX.step(x5T, x5K), tkUpX = m.tkUpX.step(x5T, x5K);
      // 13. Events, 14. Plots
      const EventAtr = m.eventAtr.step(b.high, b.low, b.close);
      const atr14 = m.atr14.step(b.high, b.low, b.close);
      const rsiPh = m.rsiPh.step(i, Rsi), rsiPl = m.rsiPl.step(i, Rsi);

      // Pseudo-random call sites
      const rF1L = randomSite(v.rnd, 0, cfg.filterType1Freq, 0.5), rF1S = randomSite(v.rnd, 1, cfg.filterType1Freq, 0.6);
      const rE1AL = randomSite(v.rnd, 2, cfg.entryType1Freq, 0.1), rE1AS = randomSite(v.rnd, 3, cfg.entryType1Freq, 0.2);
      const rE1BL = randomSite(v.rnd, 4, cfg.entryType1Freq, 0.25), rE1BS = randomSite(v.rnd, 5, cfg.entryType1Freq, 0.15);
      const rX1L = randomSite(v.rnd, 6, cfg.exitType1Freq, 0.5), rX1S = randomSite(v.rnd, 7, cfg.exitType1Freq, 0.6);

      const n = i;
      const c = close[i], o = open[i];
      // X := nz(X[1]): na (and +-infinity) carried from the bar before become 0
      All_Entries = nz(All_Entries); All_PLXTot = nz(All_PLXTot); All_PLXAvg = nz(All_PLXAvg);
      All_ProfitFactor = nz(All_ProfitFactor); All_TradeLengthsTot = nz(All_TradeLengthsTot);
      All_TradeLengthsAvg = nz(All_TradeLengthsAvg); All_VolumeTraded = nz(All_VolumeTraded);
      All_Winning = nz(All_Winning); All_Losing = nz(All_Losing); All_WinsX = nz(All_WinsX); All_LoseX = nz(All_LoseX);
      All_WinsEqu = nz(All_WinsEqu); All_LoseEqu = nz(All_LoseEqu); All_XEquTot = nz(All_XEquTot);
      All_XEquAvg = nz(All_XEquAvg); All_XPctTot = nz(All_XPctTot); All_XPctAvg = nz(All_XPctAvg);
      First_Entries = nz(First_Entries); First_Winning = nz(First_Winning); First_Losing = nz(First_Losing);
      First_WinsEqu = nz(First_WinsEqu); First_LoseEqu = nz(First_LoseEqu);
      Pyr_Entries = nz(Pyr_Entries); Pyr_PLXTot = nz(Pyr_PLXTot); Pyr_PLXAvg = nz(Pyr_PLXAvg);
      PEA_Analyses = nz(PEA_Analyses); PEA_MaxDrawdownTot = nz(PEA_MaxDrawdownTot);
      PEA_MaxOppReachedTot = nz(PEA_MaxOppReachedTot);
      ReturnOnEquity = nz(ReturnOnEquity); InTradeEquity = nz(InTradeEquity); InTradeStartEquity = nz(InTradeStartEquity);
      PyrEntries = nz(PyrEntries); PyrEntryXPctTot = nz(PyrEntryXPctTot); PyrEntryXPctAvg = nz(PyrEntryXPctAvg);
      PyrFeesEquTot = nz(PyrFeesEquTot); PyrPositionInTot = nz(PyrPositionInTot);
      PyrPositionInQtyTot = nz(PyrPositionInQtyTot); PyrSlipEquTot = nz(PyrSlipEquTot);
      PyrTradeLengthsTot = nz(PyrTradeLengthsTot); PyrTradeLengthsAvg = nz(PyrTradeLengthsAvg);
      PEABarToMaxOpp = nz(PEABarToMaxOpp); PEAMaxOppReached = nz(PEAMaxOppReached); PEAMaxRiskReached = nz(PEAMaxRiskReached);
      PEAMaxDrawdown = nz(PEAMaxDrawdown); PEAReferenceLevel = nz(PEAReferenceLevel); PEAX = nz(PEAX); PEABar = nz(PEABar);
      const time = bars[i].time as number;

      // ——— 2. Indicators
      // Chandelier for in-trade stop 6
      const Catr = cfg.inTradeStopType567Mult * atr567;
      const Clong = hh567 - Catr, Cshort = ll567 + Catr;
      const ClongStop = gt(close[i - 1], pClongStop) ? Math.max(Clong, pClongStop) : Clong;
      const CshortStop = lt(close[i - 1], pCshortStop) ? Math.min(Cshort, pCshortStop) : Cshort;
      // Chandelier for filter 10
      const C2atr = cfg.filterType10Mult * atrF10;
      const C2long = hhF10 - C2atr, C2short = llF10 + C2atr;
      const C2longStop = gt(close[i - 1], pC2longStop) ? Math.max(C2long, pC2longStop) : C2long;
      const C2shortStop = lt(close[i - 1], pC2shortStop) ? Math.min(C2short, pC2shortStop) : C2short;
      const C2dir = gt(c, pC2shortStop) ? 1 : lt(c, pC2longStop) ? -1 : nz(pC2dir, 1);
      const C2Bull = C2dir === 1, C2Bear = !C2Bull;
      // MA Squize
      const delta = atr50 * 0.4 / mintick;
      const madif = Math.abs(upma - dnma);
      const squeeze = lt(madif / mintick, delta); // SqLup is not na
      const MASqzBull = !squeeze && gt(upma, dnma);
      const MASqzBear = !squeeze && lt(upma, dnma);
      // Volatility stop for in-trade stop 7
      const VSmult = cfg.inTradeStopType567Mult, VSatr = atr567;
      const VSmax1 = Math.max(nz(pVSmax), c), VSmin1 = Math.min(nz(pVSmin), c);
      const VSisUptrendPrev: boolean = pVSisUptrend ?? true;
      const VSstop = VSisUptrendPrev ? VSmax1 - VSmult * VSatr : VSmin1 + VSmult * VSatr;
      const VSvstopPrev = nz(pVSvstop);
      const VSvstop1: number = VSisUptrendPrev ? Math.max(VSvstopPrev, VSstop) : Math.min(VSvstopPrev, VSstop);
      // Pine version 3: a comparison with na is an na bool (null here); nz(VSis_uptrend[1], true) makes it true, `!=`
      // with na is false, and na is false in a condition (probe debug/backtesting-trading-engine/probe_bool.pine)
      const vsDiff: number = c - VSvstop1;
      const VSisUptrend: boolean | null = Number.isNaN(vsDiff) ? null : ge(vsDiff, 0);
      const VSchanged = VSisUptrend !== null && VSisUptrend !== VSisUptrendPrev;
      const VSmax = VSchanged ? c : VSmax1, VSmin = VSchanged ? c : VSmin1;
      const VSvstop = VSchanged ? (VSisUptrend ? VSmax - VSmult * VSatr : VSmin + VSmult * VSatr) : VSvstop1;

      // ——— 3. Entry stops
      const Ropen = RoundToTick(o), Rhigh = RoundToTick(high[i]), Rlow = RoundToTick(low[i]), Rclose = RoundToTick(c);
      const MinOC = RoundToTick(Math.min(o, c)), MaxOC = RoundToTick(Math.max(o, c));
      MinOCs[i] = MinOC;
      MaxOCs[i] = MaxOC;
      const es1 = i > 0 ? ExternalIndie[i - 1] : NaN;
      const EntryStop1Long = gt(es1, 0) && ne(es1, 1) && ne(es1, 2) && ne(es1, 3) ? es1 : NaN;
      const EntryStop1Short = lt(es1, 0) && ne(es1, -1) && ne(es1, -2) && ne(es1, -3) ? -es1 : NaN;
      const gap = nz(atrES) * cfg.entryStopType2Mult;
      const esLong = cfg.entryStopType === ES1 ? EntryStop1Long : cfg.entryStopType === ES2 ? MinOC - gap
        : cfg.entryStopType === ES3 ? MinOC * (1.0 - (cfg.entryStopType3Pct / 100))
          : cfg.entryStopType === ES4 ? Math.max(MinOC - cfg.entryStopType4Val, 0.0) : 0.0;
      const esShort = cfg.entryStopType === ES1 ? EntryStop1Short : cfg.entryStopType === ES2 ? MaxOC + gap
        : cfg.entryStopType === ES3 ? MaxOC * (1.0 + (cfg.entryStopType3Pct / 100))
          : cfg.entryStopType === ES4 ? MaxOC + cfg.entryStopType4Val : 0.0;
      const EntryStopLong = RoundToTick(esLong), EntryStopShort = RoundToTick(esShort);

      // ——— 4. Filters
      const ext = ExternalIndie[i];
      const Filter1Long = cfg.filterType1 ? pround(rF1L(n)) === 1 : true;
      const Filter1Short = cfg.filterType1 ? pround(rF1S(n)) === 1 : true;
      const Filter2Long = cfg.filterType2 ? eq(ext, 1.0) : true, Filter2Short = cfg.filterType2 ? eq(ext, -1.0) : true;
      const Filter3Long = cfg.filterType3 ? gt(c, o) : true, Filter3Short = cfg.filterType3 ? lt(c, o) : true;
      const Filter4Long = cfg.filterType4 ? volRising : true, Filter4Short = Filter4Long;
      const Filter5Long = cfg.filterType5 ? ma5Rising : true, Filter5Short = cfg.filterType5 ? ma5Falling : true;
      const Filter6Long = cfg.filterType6 ? lt(c - EntryStopLong, c * cfg.filterType6MaxRisk / 100) : true;
      const Filter6Short = cfg.filterType6 ? lt(EntryStopShort - c, c * cfg.filterType6MaxRisk / 100) : true;
      const c1 = i > 0 ? close[i - 1] : NaN;
      const Filter7Long = cfg.filterType7 ? lt(c, c1 * (1 + cfg.filterType7IncPct / 100)) : true;
      const Filter7Short = cfg.filterType7 ? gt(c, c1 * (1 - cfg.filterType7IncPct / 100)) : true;
      let Filter8Long = true, Filter8Short = true;
      if (cfg.filterType8) {
        // FIchiDisplacement = 30
        const KA = i >= 30 ? FKumoA[i - 30] : NaN, KB = i >= 30 ? FKumoB[i - 30] : NaN, KH = Math.max(KA, KB);
        const T = FTenkan, K = FKijun;
        Filter8Long = (gt(FKumoA[i], FKumoB[i]) && gt(KA, KB) && gt(c, KH))
          || (gt(T, K) && gt(K, KH) && gt(T, KH) && gt(c, KH) && fKijunRising && fTenkanRising);
        Filter8Short = (lt(FKumoA[i], FKumoB[i]) && lt(KA, KB) && lt(c, KH))
          || (lt(T, K) && lt(K, KH) && lt(T, KH) && lt(c, KH) && fKijunFalling && fTenkanFalling);
      }
      const RsiOS = lt(Rsi, cfg.filterType9OS), RsiOB = gt(Rsi, cfg.filterType9OB);
      const Filter9Long = cfg.filterType9 ? !RsiOB : true, Filter9Short = cfg.filterType9 ? !RsiOS : true;
      const Filter10Long = cfg.filterType10 ? C2Bull : true, Filter10Short = cfg.filterType10 ? C2Bear : true;
      const Filter11Long = cfg.filterType11 ? MASqzBull : true, Filter11Short = cfg.filterType11 ? MASqzBear : true;
      const FilterLongOK = Filter1Long && Filter2Long && Filter3Long && Filter4Long && Filter5Long && Filter6Long
        && Filter7Long && Filter8Long && Filter9Long && Filter10Long && Filter11Long;
      const FilterShortOK = Filter1Short && Filter2Short && Filter3Short && Filter4Short && Filter5Short && Filter6Short
        && Filter7Short && Filter8Short && Filter9Short && Filter10Short && Filter11Short;

      // ——— 5. Entries (the random calls run on every bar: v3 `and` is not lazy)
      const r1AL = pround(rE1AL(n)) === 1, r1AS = pround(rE1AS(n)) === 1;
      const r1BL = pround(rE1BL(n)) === 1, r1BS = pround(rE1BS(n)) === 1;
      const Entry1ALong = EntryType1A && r1AL, Entry1AShort = EntryType1A && r1AS;
      const Entry1BLong = EntryType1B && r1BL, Entry1BShort = EntryType1B && r1BS;
      const Entry2Long = EntryType2 && gt(ext, 0.0) && ne(ext, 1.0) && ne(ext, 3.0);
      const Entry2Short = EntryType2 && lt(ext, 0.0) && ne(ext, -1.0) && ne(ext, -3.0);
      const Entry3Long = EntryType3 && FilterLongOK && !pFilterLongOK;
      const Entry3Short = EntryType3 && FilterShortOK && !pFilterShortOK;
      // `not InTrade`: InTrade is still false here (it is set in module 6)
      const Entry4Long = EntryType4 && FilterLongOK, Entry4Short = EntryType4 && FilterShortOK;
      const Entry5Long = EntryType5 && rsiUp5, Entry5Short = EntryType5 && rsiDn5;
      const Entry6Long = EntryType6 && tkUp6, Entry6Short = EntryType6 && tkDn6;
      const entryNumberOf = (sel: string, e1L: boolean, e1S: boolean) =>
        e1L && sel === EN1 ? 1 : Entry2Long && sel === EN2 ? 2 : Entry3Long && sel === EN3 ? 3 : Entry4Long && sel === EN4 ? 4
          : Entry5Long && sel === EN5 ? 5 : Entry6Long && sel === EN6 ? 6
            : e1S && sel === EN1 ? -1 : Entry2Short && sel === EN2 ? -2 : Entry3Short && sel === EN3 ? -3
              : Entry4Short && sel === EN4 ? -4 : Entry5Short && sel === EN5 ? -5 : Entry6Short && sel === EN6 ? -6 : 0;
      const EntryNumberA = entryNumberOf(cfg.entryA, Entry1ALong, Entry1AShort);
      const EntryNumberB = entryNumberOf(cfg.entryB, Entry1BLong, Entry1BShort);
      const EntryNumber = EntryNumberA !== 0 ? EntryNumberA : EntryNumberB !== 0 ? EntryNumberB + (EntryNumberB > 0 ? 100 : -100) : 0;
      const EntryIsALong = EntryNumberA > 0, EntryIsBLong = !EntryIsALong && EntryNumberB > 0;
      const EntryIsAShort = EntryNumberA < 0, EntryIsBShort = !EntryIsAShort && EntryNumberB < 0;

      // ——— 6. Trade entry and in-trade processing
      if (!Number.isFinite(Equity)) Equity = 1.0; // nz(Equity[1], 1.0)
      const InLong: boolean = pLongEntryTrigger || (pInLong && !pExitCondition);
      const InShort: boolean = pShortEntryTrigger || (pInShort && !pExitCondition);
      const InTrade: boolean = InLong || InShort;
      const FirstEntry1stBar = pEntryTrigger && !pPyramidEntry;
      const PyramidEntry1stBar = pEntryTrigger && pPyramidEntry;
      // Values set on this bar only (0 otherwise)
      let MaxReached = 0.0, TradePLX = 0.0, TradePLPct = 0.0, TradePLEqu = 0.0;
      let PyrEntryFill = 0.0, PyrPositionOut = 0.0, PyrTradePLX = 0.0, PyrTradePLPct = 0.0, PyrTradePLEqu = 0.0;
      const slipIn = (order: number) => (SlippageType2 ? RoundToTick(order * cfg.slippageType2InPct / 100) : SlippageType3 ? RoundToTick(cfg.slippageType3InVal) : 0.0);
      const slipOut = (order: number) => (SlippageType2 ? RoundToTick(order * cfg.slippageType2OutPct / 100) : SlippageType3 ? RoundToTick(cfg.slippageType3OutVal) : 0.0);
      const positionOf = () => Math.min(Equity, PosType1
        ? Math.min(Equity * cfg.posType1Cap / 100, Equity * cfg.posType1Risk / 100 / EntryXPct)
        : PosType2 ? Equity * cfg.posType2Pct / 100 : cfg.posType3Pct / 100);
      /** Exit order at the open, slippage, fill capped by the bar */
      const exitFill = () => {
        ExitOrder = Ropen;
        SlipPaidOut = slipOut(ExitOrder);
        ExitFill = Math.max(0.0, ExitOrder + (pInLong ? -SlipPaidOut : SlipPaidOut));
        ExitFill = pInLong ? Math.max(Rlow, ExitFill) : Math.min(Rhigh, ExitFill);
        SlipPaidOut = Math.abs(ExitFill - ExitOrder);
        TradePLX = (ExitFill - EntryFill) * dir(pInLong) / EntryX;
        TradePLPct = TradePLX * EntryXPct;
        TradePLEqu = PositionIn * TradePLX * EntryXPct;
        PositionOut = TradePLEqu + PositionIn;
      };
      if (FirstEntry1stBar) {
        EntryOrder = Ropen;
        TradeLength = 1;
        MaxReached = InLong ? Rhigh : Rlow;
        LastEntryNumber = pEntryNumber;
        SlipPaidIn = slipIn(EntryOrder);
        EntryFill = Math.max(0.0, EntryOrder + (InLong ? SlipPaidIn : -SlipPaidIn));
        EntryFill = InLong ? Math.min(Rhigh, EntryFill) : Math.max(Rlow, EntryFill);
        SlipPaidIn = Math.abs(EntryFill - EntryOrder);
        LastEntryPrice = EntryFill;
        EntryStop = InLong ? EntryStopLong : EntryStopShort;
        EntryX = Math.abs(EntryFill - EntryStop);
        EntryXPct = EntryX / EntryFill;
        PositionIn = positionOf();
        FeesPaidIn = FeesType2 ? PositionIn * cfg.feesType2InPct / 100 : FeesType3 ? FeesType3In : 0.0;
        EntryXEqu = PositionIn * EntryXPct;
        SlippageEqu = SlipPaidIn / EntryOrder * PositionIn;
        ExitOrder = 0.0;
        ExitFill = 0.0;
        SlipPaidOut = 0.0;
        FeesPaidOut = 0.0;
        InTradeStartEquity = Equity;
        InTradeEquity = Equity;
      } else {
        if (PyramidEntry1stBar) {
          PyrEntries = PyrEntries + 1;
          PyrTradeLengthsTot = PyrTradeLengthsTot + PyrEntries;
          PyrTradeLengthsAvg = PyrTradeLengthsTot / PyrEntries;
          const PyrEntryOrder = Ropen;
          const PyrSlipPaidIn = slipIn(PyrEntryOrder);
          PyrEntryFill = Math.max(0.0, PyrEntryOrder + (InLong ? PyrSlipPaidIn : -PyrSlipPaidIn));
          PyrEntryFill = InLong ? Math.min(Rhigh, PyrEntryFill) : Math.max(Rlow, PyrEntryFill);
          const PyrEntryX = Math.abs(PyrEntryFill - pInTradeStop);
          const PyrEntryXPct = PyrEntryX / PyrEntryFill;
          const PyrPositionIn = cfg.pyramidingPosMult * positionOf();
          const PyrPositionInQty = PyrPositionIn * Cap / PyrEntryFill;
          const PyrFeesPaidIn = FeesType2 ? PyrPositionIn * cfg.feesType2InPct / 100 : FeesType3 ? FeesType3In : 0.0;
          const PyrSlipPaidEqu = PyrSlipPaidIn / PyrEntryOrder * PyrPositionIn;
          PyrEntryXPctTot = PyrEntryXPctTot + PyrEntryXPct;
          PyrEntryXPctAvg = PyrEntryXPctTot / PyrEntries;
          PyrPositionInTot = PyrPositionInTot + PyrPositionIn;
          PyrPositionInQtyTot = PyrPositionInQtyTot + PyrPositionInQty;
          PyrFeesEquTot = PyrFeesEquTot + PyrFeesPaidIn;
          PyrSlipEquTot = PyrSlipEquTot + PyrSlipPaidEqu;
          LastEntryPrice = PyrEntryFill;
        }
        if (InTrade) {
          TradeLength = TradeLength + 1;
          MaxReached = InLong ? Math.max(nz(pMaxReached, Rhigh), Rhigh) : Math.min(nz(pMaxReached, Rlow), Rlow);
          // Simulated exit at the open (display only: no fees)
          exitFill();
          SlippageEqu = SlipPaidIn / EntryOrder * PositionIn + SlipPaidOut / ExitOrder * PositionOut;
          InTradeEquity = InTradeStartEquity + PositionOut - PositionIn;
          if (PyrEntries > 0) {
            PyrTradeLengthsTot = PyrTradeLengthsTot + (PyramidEntry1stBar ? 0 : PyrEntries);
            PyrTradeLengthsAvg = PyrTradeLengthsTot / PyrEntries;
            PyrPositionOut = PyrPositionInQtyTot * ExitFill / Cap;
            PyrTradePLEqu = (PyrPositionOut - PyrPositionInTot) * dir(pInLong);
            PyrTradePLPct = PyrTradePLEqu / PyrPositionInTot;
            PyrTradePLX = PyrTradePLPct / PyrEntryXPctAvg;
          }
        }
      }

      // ——— 7. Pyramiding rules
      const Pyramiding1Long = PyramidingType1 && gt(Rclose, LastEntryPrice + (EntryX * cfg.pyramiding1MultX));
      const Pyramiding1Short = PyramidingType1 && lt(Rclose, LastEntryPrice - (EntryX * cfg.pyramiding1MultX));
      const Pyramiding2Long = PyramidingType2 && gt(Rclose, LastEntryPrice * (1 + (cfg.pyramiding2Pct / 100)));
      const Pyramiding2Short = PyramidingType2 && lt(Rclose, LastEntryPrice * (1 - (cfg.pyramiding2Pct / 100)));
      const Pyramiding3Long = PyramidingType3 && gt(Rclose, LastEntryPrice + cfg.pyramiding3Val);
      const Pyramiding3Short = PyramidingType3 && lt(Rclose, LastEntryPrice - cfg.pyramiding3Val);
      const Pyramiding4 = PyramidingType4 && EntryNumber === LastEntryNumber;
      const Pyramiding5 = PyramidingType5 && !Number.isNaN(LastEntryNumber) && EntryNumber !== LastEntryNumber;
      const Pyramiding6 = PyramidingType6;
      const PyramidLongOK: boolean = pInLong && InLong && PyrEntries < cfg.pyramidingMaxCnt && (cfg.pyramidingFilterNeeded ? FilterLongOK : true)
        && (Pyramiding1Long || Pyramiding2Long || Pyramiding3Long || Pyramiding4 || Pyramiding5 || Pyramiding6);
      const PyramidShortOK: boolean = pInShort && InShort && PyrEntries < cfg.pyramidingMaxCnt && (cfg.pyramidingFilterNeeded ? FilterShortOK : true)
        && (Pyramiding1Short || Pyramiding2Short || Pyramiding3Short || Pyramiding4 || Pyramiding5 || Pyramiding6);

      // ——— 8. In-trade stops
      const stopType = cfg.inTradeStopType;
      const prevStop = nz(pInTradeStop);
      const minOC1 = i >= 1 ? MinOCs[i - 1] : NaN, minOC2 = i >= 2 ? MinOCs[i - 2] : NaN;
      const maxOC1 = i >= 1 ? MaxOCs[i - 1] : NaN, maxOC2 = i >= 2 ? MaxOCs[i - 2] : NaN;
      let itsLong = 0.0, itsShort = 0.0;
      if (stopType === IS1) {
        itsLong = MaxReached - EntryX * cfg.inTradeStopType1Mult;
        itsShort = MaxReached + EntryX * cfg.inTradeStopType1Mult;
      } else if (stopType === IS2) {
        itsLong = MaxReached * (1 - cfg.inTradeStopType2Pct / 100);
        itsShort = MaxReached * (1 + cfg.inTradeStopType2Pct / 100);
      } else if (stopType === IS3) {
        itsLong = MaxReached - cfg.inTradeStopType3Val;
        itsShort = MaxReached + cfg.inTradeStopType3Val;
      } else if (stopType === IS4) {
        itsLong = InTradeStop4;
        itsShort = InTradeStop4;
      } else if (stopType === IS5) {
        itsLong = (minOC1 + minOC2) / 2 - (atr567 * cfg.inTradeStopType567Mult);
        itsShort = (maxOC1 + maxOC2) / 2 + (atr567 * cfg.inTradeStopType567Mult);
      } else if (stopType === IS6) {
        itsLong = ClongStop;
        itsShort = CshortStop;
      } else if (stopType === IS7) {
        itsLong = VSisUptrend ? VSvstop : prevStop;
        itsShort = !VSisUptrend ? VSvstop : prevStop;
      } else if (stopType === IS8) {
        itsLong = i > 0 ? low[i - 1] : NaN;
        itsShort = i > 0 ? high[i - 1] : NaN;
      }
      const InTradeStopLong_ = pInLong && gt(itsLong, Rhigh) ? prevStop : RoundToTick(itsLong);
      const InTradeStopShort_ = pInShort && lt(itsShort, Rlow) ? prevStop : RoundToTick(itsShort);
      let InTradeKickLong = false, InTradeKickShort = false;
      if (cfg.inTradeKickType === IK1) {
        InTradeKickLong = gt(InTradeStopLong_, EntryStop);
        InTradeKickShort = lt(InTradeStopShort_, EntryStop);
      } else if (cfg.inTradeKickType === IK2) {
        InTradeKickLong = gt(InTradeStopLong_, Math.max(RoundToTick(EntryFill + EntryX * cfg.inTradeKickType2Mult), EntryStop));
        InTradeKickShort = lt(InTradeStopShort_, Math.min(RoundToTick(EntryFill - EntryX * cfg.inTradeKickType2Mult), EntryStop));
      } else if (cfg.inTradeKickType === IK3) {
        InTradeKickLong = gt(InTradeStopLong_, Math.max(RoundToTick(EntryFill * (1.0 + (cfg.inTradeKickType3Pct / 100))), EntryStop));
        InTradeKickShort = lt(InTradeStopShort_, Math.min(RoundToTick(EntryFill * (1.0 - (cfg.inTradeKickType3Pct / 100))), EntryStop));
      } else if (cfg.inTradeKickType === IK4) {
        InTradeKickLong = gt(InTradeStopLong_, Math.max(RoundToTick(EntryFill + cfg.inTradeKickType4Val), EntryStop));
        InTradeKickShort = lt(InTradeStopShort_, Math.min(RoundToTick(EntryFill - cfg.inTradeKickType4Val), EntryStop));
      }
      const InTradeStop_ = FirstEntry1stBar ? EntryStop
        : InLong ? (InTradeKickLong ? Math.max(InTradeStopLong_, prevStop) : prevStop)
          : InTradeKickShort ? Math.min(InTradeStopShort_, prevStop) : prevStop;
      const InTradeStop = Math.max(0.0, InTradeStop_);

      // ——— 9. Exits
      const x1L = pround(rX1L(n)) === 1, x1S = pround(rX1S(n)) === 2;
      const Exit1Long = cfg.exitType1 && x1L, Exit1Short = cfg.exitType1 && x1S;
      const Exit2Long = cfg.exitType2 && eq(ext, 3.0), Exit2Short = cfg.exitType2 && eq(ext, -3.0);
      const Exit3Long = cfg.exitType3 && FilterShortOK && !pFilterShortOK;
      const Exit3Short = cfg.exitType3 && FilterLongOK && !pFilterLongOK;
      const Exit4Long = cfg.exitType4 && rsiDnX, Exit4Short = cfg.exitType4 && rsiUpX;
      const Exit5Long = cfg.exitType5 && tkDnX, Exit5Short = cfg.exitType5 && tkUpX;
      const Exit6TakeProfitLevel: number = InLong ? RoundToTick(EntryFill + EntryX * cfg.exitType6Mult)
        : InShort ? RoundToTick(EntryFill - EntryX * cfg.exitType6Mult) : 0.0;
      const Exit6Long: boolean = cfg.exitType6 && gt(RoundToTick(c), Exit6TakeProfitLevel);
      const Exit6Short: boolean = cfg.exitType6 && lt(RoundToTick(c), Exit6TakeProfitLevel);
      const TakeProfitLevel = cfg.exitType6 ? Exit6TakeProfitLevel : NaN;
      const ExitLong: boolean = Exit1Long || Exit2Long || Exit3Long || Exit4Long || Exit5Long || Exit6Long;
      const ExitShort: boolean = Exit1Short || Exit2Short || Exit3Short || Exit4Short || Exit5Short || Exit6Short;

      // ——— 10. Trade entry / exit trigger detection
      // InTradeStop[LongEntryTrigger[1] ? 0 : 1]
      const StoppedCondition: boolean = !InTradeStopDisabled && ((InLong && lt(Rclose, pLongEntryTrigger ? InTradeStop : pInTradeStop))
        || (InShort && gt(Rclose, pShortEntryTrigger ? InTradeStop : pInTradeStop)));
      const ExitTradeCondition: boolean = (InLong && ExitLong) || (InShort && ExitShort);
      const ExitCondition: boolean = StoppedCondition || ExitTradeCondition;
      const LongExitTrigger = InLong && ExitCondition, ShortExitTrigger = InShort && ExitCondition;
      const LongEntry = EntryNumber > 0, ShortEntry = EntryNumber < 0;
      const PyramidLongEntry: boolean = LongEntry && PyramidLongOK && !ExitCondition;
      const PyramidShortEntry: boolean = ShortEntry && PyramidShortOK && !ExitCondition;
      const LongEntryConfirmed: boolean = (LongEntry && FilterLongOK && !InTrade) || (PyramidLongEntry && PyramidingOn);
      const ShortEntryConfirmed: boolean = !LongEntryConfirmed && ((ShortEntry && FilterShortOK && !InTrade) || (PyramidShortEntry && PyramidingOn));
      const allowed = TradeDateIsAllowed(bars[i].time as number) && n > cfg.entryStopType2Len && !Ruin;
      const LongEntryTrigger: boolean = GenerateLongs && LongEntryConfirmed && allowed;
      const ShortEntryTrigger: boolean = GenerateShorts && ShortEntryConfirmed && allowed;
      const EntryTrigger = LongEntryTrigger || ShortEntryTrigger;
      const ExitTrigger = LongExitTrigger || ShortExitTrigger;
      const PyramidEntry = PyramidLongEntry || PyramidShortEntry;

      // ——— 11. Trade exit processing
      if (pExitTrigger) {
        exitFill();
        FeesPaidOut = Math.abs(FeesType2 ? PositionOut * cfg.feesType2OutPct / 100 : FeesType3 ? FeesType3Out : 0.0);
        TradePLEqu = TradePLEqu - FeesPaidIn - FeesPaidOut;
        TradePLX = TradePLEqu / EntryXEqu;
        TradePLPct = TradePLX * EntryXPct;
        SlippageEqu = SlipPaidIn / EntryOrder * PositionIn + SlipPaidOut / ExitOrder * PositionOut;
        First_Entries = First_Entries + 1;
        // WinningTrade = TradePLX >= 0.0: an na bool (null) when TradePLX is na; `not na` is true
        const WinningTrade: boolean | null = Number.isNaN(TradePLX) ? null : ge(TradePLX, 0.0);
        First_WinsEqu = First_WinsEqu + (WinningTrade ? PositionOut - PositionIn : 0.0);
        First_LoseEqu = First_LoseEqu + (!WinningTrade ? PositionOut - PositionIn : 0.0);
        First_Winning = First_Winning + (WinningTrade ? 1 : 0);
        First_Losing = First_Losing + (!WinningTrade ? 1 : 0);
        if (PyrEntries > 0) {
          PyrPositionOut = PyrPositionInQtyTot * ExitFill / Cap;
          const PyrFeesPaidOut = Math.abs(FeesType2 ? PyrPositionOut * cfg.feesType2OutPct / 100 : FeesType3 ? FeesType3Out : 0.0);
          PyrFeesEquTot = PyrFeesEquTot + PyrFeesPaidOut;
          PyrSlipEquTot = PyrSlipEquTot + SlipPaidOut / ExitOrder * PyrPositionOut;
          PyrTradePLEqu = ((PyrPositionOut - PyrPositionInTot) * dir(pInLong)) - PyrFeesEquTot;
          PyrTradePLPct = PyrTradePLEqu / PyrPositionInTot;
          PyrTradePLX = PyrTradePLPct / PyrEntryXPctAvg;
          Pyr_Entries = Pyr_Entries + PyrEntries;
          Pyr_PLXTot = Pyr_PLXTot + PyrTradePLX * PyrEntries;
          Pyr_PLXAvg = Pyr_PLXTot / Pyr_Entries;
        }
        All_Entries = All_Entries + 1 + PyrEntries;
        // WinningTrade := (TradePLX + PyrTradePLX * PyrEntries) / (PyrEntries + 1) >= 0.0 has no effect in the original
        // (Pine version 3, measured: probes debug/backtesting-trading-engine/probe_bool4.pine / probe_bool5.pine): the
        // combined results keep the first entry's WinningTrade
        All_PLXTot = All_PLXTot + TradePLX + PyrTradePLX * PyrEntries;
        All_PLXAvg = All_PLXTot / All_Entries;
        All_XPctTot = All_XPctTot + EntryXPct + PyrEntryXPctAvg * PyrEntries;
        All_XPctAvg = All_XPctTot / All_Entries;
        All_XEquTot = All_XEquTot + PositionIn * EntryXPct + PyrPositionInTot * PyrEntryXPctAvg;
        All_XEquAvg = All_XEquTot / All_Entries;
        All_WinsX = All_WinsX + (WinningTrade ? TradePLX + PyrTradePLX * PyrEntries : 0.0);
        All_LoseX = All_LoseX + (!WinningTrade ? TradePLX + PyrTradePLX * PyrEntries : 0.0);
        All_WinsEqu = All_WinsEqu + (WinningTrade ? PositionOut - PositionIn + PyrTradePLEqu : 0.0);
        All_LoseEqu = All_LoseEqu + (!WinningTrade ? PositionOut - PositionIn + PyrTradePLEqu : 0.0);
        All_Winning = All_Winning + (WinningTrade ? 1 : 0) + (WinningTrade ? 1 : 0) * PyrEntries;
        All_Losing = All_Losing + (!WinningTrade ? 1 : 0) + (!WinningTrade ? 1 : 0) * PyrEntries;
        All_TradeLengthsTot = All_TradeLengthsTot + TradeLength + PyrTradeLengthsAvg * PyrEntries;
        All_TradeLengthsAvg = All_TradeLengthsTot / All_Entries;
        All_VolumeTraded = All_VolumeTraded + PositionIn + PositionOut + PyrPositionOut + PyrPositionInTot;
        All_ProfitFactor = eq(All_LoseEqu, 0.0) ? 0.0 : Math.abs(nz(All_WinsEqu / All_LoseEqu));
        Equity = Equity + PositionOut - PositionIn - FeesPaidIn - FeesPaidOut + PyrTradePLEqu;
        ReturnOnEquity = Equity - 1.0;
        Ruin = le(Equity, 0);
        InTradeEquity = Equity;
      }
      // Drawdown (InTradeEquity at every bar)
      const pEquityMax = EquityMax;
      EquityMax = Math.max(InTradeEquity, nz(pEquityMax));
      EquityMin = truthy(EquityMax - pEquityMax) ? EquityMax : Math.min(InTradeEquity, nz(EquityMin));
      const Drawdown = (EquityMin - EquityMax) / EquityMax;
      MaxDrawdown = Math.min(Drawdown, nz(MaxDrawdown));

      // ——— 12. Post-exit analysis
      if (PEAOn) {
        if (pExitTrigger && !InPEA) {
          InPEA = true;
          PEAInLong = pInLong;
          PEAX = EntryX;
          PEAReferenceLevel = Rclose;
          PEAMaxOppReached = Rclose;
          PEAMaxRiskReached = Rclose;
          PEAMaxDrawdown = Rclose;
        } else if (InPEA) {
          if (PEABar === cfg.peaBars) {
            PEA_Analyses = PEA_Analyses + 1;
            InPEA = false;
            PEA_MaxOppReachedTot = PEABarToMaxOpp > 0 ? PEA_MaxOppReachedTot + Math.abs(PEAReferenceLevel - PEAMaxOppReached) / PEAX : PEA_MaxOppReachedTot;
            PEA_MaxDrawdownTot = PEA_MaxDrawdownTot + Math.abs(PEAReferenceLevel - PEAMaxDrawdown) / PEAX;
            PEABar = 0;
            PEABarToMaxOpp = 0;
            PEAMaxOppReached = 0.0;
            PEAMaxRiskReached = 0.0;
            PEAMaxDrawdown = 0.0;
            PEAX = 0.0;
            PEAReferenceLevel = 0.0;
          } else {
            PEABar = PEABar + 1;
            PEAMaxOppReached = PEAInLong ? Math.max(PEAMaxOppReached, Rclose) : Math.min(PEAMaxOppReached, Rclose);
            PEAMaxRiskReached = PEAInLong ? Math.min(PEAMaxRiskReached, Rclose) : Math.max(PEAMaxRiskReached, Rclose);
            // change(PEAMaxOppReached) inside the block: compared with its value at the last call
            const oppChanged = truthy(PEAMaxOppReached - peaOppLastCall);
            peaOppLastCall = PEAMaxOppReached;
            PEABarToMaxOpp = oppChanged ? PEABar : PEABarToMaxOpp;
            PEAMaxDrawdown = oppChanged ? PEAMaxRiskReached : PEAMaxDrawdown;
          }
        }
      }

      // ——— 13. Events
      const ea = EventAtr;
      const Event1_ = !pEntryTrigger && ((InLong && lt(Rclose - pInTradeStop, ea * cfg.eventType1Mult))
        || (InShort && lt(pInTradeStop - Rclose, ea * cfg.eventType1Mult)));
      const Event1 = Event1_ && !pEvent1;
      const Event2 = (InLong && truthy(rsiPh) && RsiOB) || (InShort && truthy(rsiPl) && RsiOS);
      const Event3 = !pEntryTrigger && ((InLong && gt(InTradeStop, pInTradeStop + ea * cfg.eventType3Mult))
        || (InShort && lt(InTradeStop, pInTradeStop - ea * cfg.eventType3Mult)));
      const Event4 = (InLong && gt(Rclose - Ropen, ea * cfg.eventType4Mult)) || (InShort && gt(Ropen - Rclose, ea * cfg.eventType4Mult));

      // ——— 14. Plots
      // A.1 Global numbers
      const APPTCur11 = nz((First_Winning / First_Entries * First_WinsEqu * Cap / First_Winning)
        - (-First_Losing / First_Entries * First_LoseEqu * Cap / First_Losing));
      const dw = [
        0,
        Round(All_PLXAvg, 4),
        APPTCur11,
        Round(nz(All_PLXAvg / All_TradeLengthsAvg), 4),
        Round(All_ProfitFactor, 4),
        Round(nz(100 * All_Winning / All_Entries), 2),
        Equity * Cap,
        Round(ReturnOnEquity * 100, 2),
        Round(MaxDrawdown * 100, 2),
        Round(nz(All_WinsX / All_Winning), 4),
        Round(nz(All_LoseX / All_Losing), 4),
        All_Entries,
        Round(All_TradeLengthsAvg, 2),
        Round(-All_XPctAvg * 100, 4),
        -All_XEquAvg * Cap,
        All_VolumeTraded * Cap,
        Round(Pyr_PLXAvg, 4),
        nz(PEA_MaxOppReachedTot / PEA_Analyses),
        nz(PEA_MaxDrawdownTot / PEA_Analyses),
        // A.2 Trade numbers
        0,
        EntryFill,
        ExitFill,
        Round((TradePLX + PyrTradePLX * PyrEntries) / (PyrEntries + 1), 4),
        Round(nz((TradePLX + PyrTradePLX * PyrEntries) / (PyrEntries + 1) / TradeLength), 4),
        Round((TradePLPct + PyrTradePLPct * PyrEntries) / (PyrEntries + 1) * 100, 4),
        Round((TradePLEqu + PyrTradePLEqu) * Cap, 4),
        Round((TradePLEqu + PyrTradePLEqu) / nz(pEquity) * 100, 2),
        Round(TradeLength, 2),
        Round(-(EntryXPct + PyrEntryXPctAvg * PyrEntries) / (PyrEntries + 1) * 100, 4),
        -(EntryXEqu + PyrPositionInTot * PyrEntryXPctAvg) * Cap,
        (SlippageEqu + PyrSlipEquTot) * Cap,
        nz(FeesPaidIn + FeesPaidOut + PyrFeesEquTot) * Cap,
        Cap * ((pEntryTrigger ? PositionIn : PositionOut) + PyrPositionInTot),
        Round(nz(PositionIn * Cap / EntryFill) + PyrPositionInQtyTot, 2),
        Round(PyrTradePLX, 4),
        nz(Math.abs(PEAReferenceLevel - PEAMaxOppReached) / PEAX),
        -nz(Math.abs(PEAReferenceLevel - PEAMaxDrawdown) / PEAX),
      ];
      for (let k = 0; k < NDW; k++) DWV[k][i] = plotValue(dw[k]);
      DWC[1][i] = PMC(All_PLXAvg);
      DWC[2][i] = PMC(APPTCur11);
      DWC[16][i] = PMC(Pyr_PLXAvg);
      DWC[22][i] = pExitTrigger ? PMC(TradePLX) : InTrade ? AAA : TI2;
      DWC[34][i] = PMC(PyrTradePLX);

      // B. Chart plots
      const PrintingAtr = nz(atr14);
      entryLevel[i] = cfg.showEntry && InTrade ? EntryFill : NaN;
      longEntryStop[i] = ShowEntryStopAll || (ShowEntryStopEntry && pLongEntryTrigger && FirstEntry1stBar) ? EntryStopLong : NaN;
      shortEntryStop[i] = ShowEntryStopAll || (ShowEntryStopEntry && pShortEntryTrigger && FirstEntry1stBar) ? EntryStopShort : NaN;
      inTradeStopPlot[i] = cfg.showInTradeStop && InTrade ? InTradeStop : NaN;
      takeProfitPlot[i] = cfg.showTakeProfit && InTrade ? TakeProfitLevel : NaN;
      // Filter state (bool series at the top)
      if (cfg.showFilter && FilterLongOK) markers.push({ id: 'shape0', time, position: 'top', shape: 'triangleUp', color: GREEN_MEDIUM, size: 'tiny' });
      if (cfg.showFilter && FilterShortOK) markers.push({ id: 'shape1', time, position: 'top', shape: 'triangleDown', color: RED_MEDIUM, size: 'tiny' });
      // Events (location.absolute)
      const EventPrintLevel = InLong ? (Event1 || Event3 ? pInTradeStop : MinOC) - 2 * PrintingAtr
        : InShort ? (Event1 || Event3 ? pInTradeStop : MaxOC) + 2 * PrintingAtr : NaN;
      const EventPrintLevelTopBot = InShort ? MinOC - 2 * PrintingAtr : InLong ? MinOC + 2 * PrintingAtr : NaN;
      const event = (id: string, on: boolean, price: number, col: string) => {
        if (on && Number.isFinite(price)) markers.push({ id, time, position: 'atPriceMiddle', price, shape: 'circle', color: col, size: 'tiny' });
      };
      event('shape2', cfg.eventType1 && Event1, EventPrintLevel, ORANGE_MEDIUM);
      event('shape3', cfg.eventType2 && Event2, EventPrintLevelTopBot, RED_SEMI_DARK);
      event('shape4', cfg.eventType3 && Event3, EventPrintLevel, YELLOW_MEDIUM);
      event('shape5', cfg.eventType4 && Event4, EventPrintLevel, GREEN_MEDIUM);
      // Entry markers (on the bar after the trigger)
      const PrintFilteredOutLong = cfg.showFilteredOut && GenerateLongs && pLongEntry && !pFilterLongOK;
      const PrintFilteredOutShort = cfg.showFilteredOut && GenerateShorts && pShortEntry && !pFilterShortOK;
      const PrintPyramidedOutLong = PyramidingOffButShow && GenerateLongs && pPyramidLongEntry;
      const PrintPyramidedOutShort = PyramidingOffButShow && GenerateShorts && pPyramidShortEntry;
      const EntryToPrintLong = pLongEntryTrigger || PrintFilteredOutLong || PrintPyramidedOutLong;
      const EntryToPrintShort = pShortEntryTrigger || PrintFilteredOutShort || PrintPyramidedOutShort;
      const EntryMarkerColorLong = PrintFilteredOutLong ? GREEN_DARK : pLongEntryTrigger ? (pPyramidLongEntry ? GREEN_MEDIUM : GREEN_RAW)
        : PrintPyramidedOutLong ? GREEN_SEMI_DARK : YELLOW;
      const EntryMarkerColorShort = PrintFilteredOutShort ? RED_DARK : pShortEntryTrigger ? (pPyramidShortEntry ? RED_MEDIUM : RED_RAW)
        : PrintPyramidedOutShort ? RED_SEMI_DARK : YELLOW;
      const EntryPrintLevelLong = pLongEntryTrigger && FirstEntry1stBar ? EntryFill
        : pLongEntryTrigger && PyramidEntry1stBar ? PyrEntryFill : MinOC - 2 * PrintingAtr;
      const EntryPrintLevelShort = pShortEntryTrigger && FirstEntry1stBar ? EntryFill
        : pShortEntryTrigger && PyramidEntry1stBar ? PyrEntryFill : MaxOC + 2 * PrintingAtr;
      const mark = (id: string, on: boolean, price: number, ch: string, col: string, text: string, textColor: string) => {
        if (on && Number.isFinite(price)) {
          markers.push({ id, time, position: 'atPriceMiddle', price, shape: 'circle', char: ch, color: col, text, textColor, size: 'small' });
        }
      };
      mark('char37', cfg.showMarkers && EntryToPrintLong && pEntryIsALong, EntryPrintLevelLong, '╚', EntryMarkerColorLong, `${TRADE_ID}\nEnter\nLong A\n▲`, GREEN_RAW);
      mark('char38', cfg.showMarkers && EntryToPrintLong && pEntryIsBLong, EntryPrintLevelLong, '╚', EntryMarkerColorLong, `${TRADE_ID}\nEnter\nLong B\n▲`, GREEN_RAW);
      mark('char39', cfg.showMarkers && EntryToPrintShort && pEntryIsAShort, EntryPrintLevelShort, '╔', EntryMarkerColorShort, `${TRADE_ID}\nEnter\nShort A\n▼`, RED_RAW);
      mark('char40', cfg.showMarkers && EntryToPrintShort && pEntryIsBShort, EntryPrintLevelShort, '╔', EntryMarkerColorShort, `${TRADE_ID}\nEnter\nShort B\n▼`, RED_RAW);
      // Exit markers (one bar late)
      mark('char41', cfg.showMarkers && pLongExitTrigger, ExitFill, '╗', GREEN_MEDIUM, `${TRADE_ID}\nExit\nLong\n▼`, PINE_TEXT);
      mark('char42', cfg.showMarkers && pShortExitTrigger, ExitFill, '╝', RED_MEDIUM, `${TRADE_ID}\nExit\nShort\n▲`, PINE_TEXT);
      // Traded background
      if (cfg.showTradedBackground && (InLong || InShort)) {
        bgColors.push({ id: 'bgcolor0', time, color: InLong ? GREEN_BACKGROUND : RED_BACKGROUND });
      }

      // ——— 15. Alerts
      alertFlags[i] = (cfg.alertType1 && LongEntryTrigger && !PyramidLongEntry) || (cfg.alertType2 && LongEntryTrigger && PyramidLongEntry)
        || (cfg.alertType3 && ShortEntryTrigger && !PyramidShortEntry) || (cfg.alertType4 && ShortEntryTrigger && PyramidShortEntry)
        || (cfg.alertType5 && LongExitTrigger) || (cfg.alertType6 && ShortExitTrigger) || (cfg.alertType7 && Event1)
        || (cfg.alertType8 && Event2) || (cfg.alertType9 && Event3) || (cfg.alertType10 && Event4);

      // ——— 16. Variable resets after an exit
      if (pExitTrigger) {
        EntryFill = 0.0;
        EntryOrder = 0.0;
        EntryX = 0.0;
        EntryXPct = 0.0;
        EntryXEqu = 0.0;
        ExitOrder = 0.0;
        ExitFill = 0.0;
        FeesPaidIn = 0.0;
        FeesPaidOut = 0.0;
        InTradeEquity = Equity;
        InTradeStartEquity = Equity;
        LastEntryPrice = 0;
        PositionIn = 0.0;
        PositionOut = 0.0;
        SlippageEqu = 0.0;
        SlipPaidIn = 0.0;
        SlipPaidOut = 0.0;
        TradeLength = 0;
        PyrEntries = 0;
        PyrEntryXPctTot = 0.0;
        PyrEntryXPctAvg = 0.0;
        PyrFeesEquTot = 0.0;
        PyrPositionInQtyTot = 0.0;
        PyrPositionInTot = 0.0;
        PyrSlipEquTot = 0.0;
        PyrTradeLengthsTot = 0;
        PyrTradeLengthsAvg = 0.0;
      }

      // Values of this bar for the next one
      pLongEntryTrigger = LongEntryTrigger;
      pShortEntryTrigger = ShortEntryTrigger;
      pInLong = InLong;
      pInShort = InShort;
      pExitCondition = ExitCondition;
      pEntryTrigger = EntryTrigger;
      pPyramidEntry = PyramidEntry;
      pEntryNumber = EntryNumber;
      pInTradeStop = InTradeStop;
      pMaxReached = MaxReached;
      pExitTrigger = ExitTrigger;
      pLongExitTrigger = LongExitTrigger;
      pShortExitTrigger = ShortExitTrigger;
      pLongEntry = LongEntry;
      pShortEntry = ShortEntry;
      pFilterLongOK = FilterLongOK;
      pFilterShortOK = FilterShortOK;
      pPyramidLongEntry = PyramidLongEntry;
      pPyramidShortEntry = PyramidShortEntry;
      pEntryIsALong = EntryIsALong;
      pEntryIsBLong = EntryIsBLong;
      pEntryIsAShort = EntryIsAShort;
      pEntryIsBShort = EntryIsBShort;
      pEquity = Equity;
      pEvent1 = Event1_;
      pClongStop = ClongStop;
      pCshortStop = CshortStop;
      pC2longStop = C2longStop;
      pC2shortStop = C2shortStop;
      pC2dir = C2dir;
      pVSmax = VSmax;
      pVSmin = VSmin;
      pVSvstop = VSvstop;
      pVSisUptrend = VSisUptrend;

      Object.assign(v, { All_Entries, All_PLXTot, All_PLXAvg, All_ProfitFactor, All_TradeLengthsTot, All_TradeLengthsAvg, All_VolumeTraded, All_Winning, All_Losing, All_WinsX, All_LoseX, All_WinsEqu, All_LoseEqu, All_XEquTot, All_XEquAvg, All_XPctTot, All_XPctAvg, First_Entries, First_Winning, First_Losing, First_WinsEqu, First_LoseEqu, Pyr_Entries, Pyr_PLXTot, Pyr_PLXAvg, PEA_Analyses, PEA_MaxDrawdownTot, PEA_MaxOppReachedTot, Equity, ReturnOnEquity, Ruin, EquityMin, EquityMax, MaxDrawdown, InTradeEquity, InTradeStartEquity, EntryOrder, EntryFill, EntryStop, EntryX, EntryXPct, EntryXEqu, ExitOrder, ExitFill, FeesPaidIn, FeesPaidOut, LastEntryNumber, LastEntryPrice, PositionIn, PositionOut, SlipPaidIn, SlipPaidOut, SlippageEqu, TradeLength, PyrEntries, PyrEntryXPctTot, PyrEntryXPctAvg, PyrFeesEquTot, PyrPositionInTot, PyrPositionInQtyTot, PyrSlipEquTot, PyrTradeLengthsTot, PyrTradeLengthsAvg, PEAInLong, PEABarToMaxOpp, PEAMaxOppReached, PEAMaxRiskReached, PEAMaxDrawdown, PEAReferenceLevel, PEAX, PEABar, InPEA, peaOppLastCall, pLongEntryTrigger, pShortEntryTrigger, pInLong, pInShort, pExitCondition, pEntryTrigger, pPyramidEntry, pEntryNumber, pInTradeStop, pMaxReached, pExitTrigger, pLongExitTrigger, pShortExitTrigger, pLongEntry, pShortEntry, pFilterLongOK, pFilterShortOK, pPyramidLongEntry, pPyramidShortEntry, pEntryIsALong, pEntryIsBLong, pEntryIsAShort, pEntryIsBShort, pEquity, pEvent1, pClongStop, pCshortStop, pC2longStop, pC2shortStop, pC2dir, pVSmax, pVSmin, pVSvstop, pVSisUptrend });
      if (alertFlags[i]) s.alertTimes.push(time);
      const pts = s.points;
      for (let k = 0; k < NDW; k++) pts[k][i] = { time: b.time, value: DWV[k][i], color: DWC[k][i] };
      pts[NDW][i] = { time: b.time, value: plotValue(entryLevel[i]), color: BLUE_MEDIUM };
      pts[NDW + 1][i] = { time: b.time, value: plotValue(longEntryStop[i]), color: ORANGE_DARK };
      pts[NDW + 2][i] = { time: b.time, value: plotValue(shortEntryStop[i]), color: ORANGE_DARK };
      pts[NDW + 3][i] = { time: b.time, value: plotValue(inTradeStopPlot[i]), color: ORANGE_MEDIUM };
      pts[NDW + 4][i] = { time: b.time, value: plotValue(takeProfitPlot[i]), color: FUCHSIA_MEDIUM };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < NDW + 5; k++) plots[`plot${k}`] = s.points[k].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, [s.alertTimes], [n > 0 && s.alertFlags[n - 1]]),
      } as IndicatorResult;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BacktestingTradingEngineInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BacktestingTradingEngineInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const BacktestingTradingEngine = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  barColorConfig,
  alertConditions,
};
