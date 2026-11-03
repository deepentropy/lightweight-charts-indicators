/**
 * [IMBA] ALGO
 *
 * Trend signals on a price channel and a trade simulator. The channel is the highest high and the lowest low of
 * "Sensitive" * 10 bars; its middle (50 %) is the trend line, red or green after the trend of the bar before. From
 * the "Start calculating date" on, a close at or above the middle and the 23.6 % level (counted from the top) while
 * the trend is not long starts a long trend (a green triangle below the bar); a close at or below the middle and the
 * 78.6 % level while the trend is not short starts a short trend (a red triangle above the bar).
 *
 * Each signal opens a simulated trade at the close: stop at the 78.6 % level for a long (23.6 % for a short), moved
 * by "SL %" (or "SL %" from the entry with "Fixed stoploss %"), and 4 targets at "TP 1" to "TP 4" % from the entry
 * (all rounded to the tick). Each target hit closes its "Fix %" of the position; the "BE target" moves the stop to
 * the entry (a bar that comes back to the entry against its colour closes the trade); TP 4, the stop or a trend
 * change close it. The profit is counted in % of the deposit with a risk of "Risk %" per trade (the original's
 * formulas, also the one that counts the profit twice for a long closed below the entry at a trend change).
 *
 * Drawings ("Show"): entry, stop and target lines from the entry bar to the next bar while the trade runs, with
 * price labels 3 bars back (removed at the close), a label with the trade profit above the targets, fills between
 * the lines of the targets hit (and the stop) with "Fill", and a dotted close line at a trend change. The profit
 * table (top right) gives the trade statistics and the deposit; the strategy table (bottom right) and the old panel
 * label are options. RSI crosses ("Show" of the RSI group) mark overbought / oversold bars. "Show" of the developer
 * group keeps the event labels (hits, closes, trade info).
 *
 * Alerts: three alertconditions (`alerts` of the result) and an alert() call with the trade levels in JSON on every
 * new trade (`alertCalls`, once per bar close).
 *
 * The STRATEGY presets other than MANUAL, "UNIVERSAL 15m" and "SOL 5m" (the separator entries) give a channel length
 * of 0: as the original, a runtime error.
 *
 * Chart values read: the tick size (round_to_mintick) and the symbol ticker and chart timeframe (strategy table). The
 * date of the first trade is written in UTC, as the reference does.
 *
 * Reference: "[imba]lance algo" by IMBA_TRADER
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, color, math, Series, line, label, linefill, table, resetDrawings, setDrawingBar, varDrawing,
  drawingOutputs,
  type Bar, type Label, type Line, type Table, type IndicatorResult, type InputConfig, type PlotConfig,
  type ShapeConfig, type MarkerData,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { AlertCall } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import { mintickOf, tickerOf, type ChartContext } from '../chart-context';
import { chartTimeframe } from '../anchor-period';

const STRATEGIES = [
  'MANUAL', 'UNIVERSAL 15m', '===============',
  '-------A-------', '-------B-------', '-------C-------', '-------D-------', '-------E-------', '-------F-------',
  '-------G-------', '-------H-------', '-------I-------', '-------J-------', '-------K-------', '-------L-------',
  '-------M-------', '-------N-------', '-------O-------', '-------P-------', '-------Q-------', '-------R-------',
  '-------S-------', 'SOL 5m', '-------T-------', '-------U-------', '-------V-------', '-------W-------',
  '-------X-------', '-------Y-------', '-------Z-------',
];

export interface LanceAlgoInputs {
  strategy: string;
  sensitivity: number;
  startDate: number;
  showTpEntrySl: boolean;
  fillPositions: boolean;
  riskPercent: number;
  breakEvenTarget: 'WITHOUT' | '1' | '2' | '3';
  initialDeposit: number;
  fixedStop: boolean;
  slPercent: number;
  tp1Percent: number;
  tp1PercentFix: number;
  tp2Percent: number;
  tp2PercentFix: number;
  tp3Percent: number;
  tp3PercentFix: number;
  tp4Percent: number;
  tp4PercentFix: number;
  showRsi: boolean;
  len: number;
  overbought: number;
  oversold: number;
  showProfitPanel: boolean;
  showStrategyPanel: boolean;
  showOldPanel: boolean;
  showDevLabels: boolean;
}

/** timestamp("1 June 2023") */
const START_DATE = 1685577600000;

export const defaultInputs: LanceAlgoInputs = {
  strategy: 'MANUAL',
  sensitivity: 18,
  startDate: START_DATE,
  showTpEntrySl: true,
  fillPositions: true,
  riskPercent: 1,
  breakEvenTarget: '1',
  initialDeposit: 1000,
  fixedStop: false,
  slPercent: 0,
  tp1Percent: 1,
  tp1PercentFix: 40,
  tp2Percent: 2,
  tp2PercentFix: 30,
  tp3Percent: 3,
  tp3PercentFix: 20,
  tp4Percent: 4,
  tp4PercentFix: 10,
  showRsi: false,
  len: 14,
  overbought: 78,
  oversold: 22,
  showProfitPanel: true,
  showStrategyPanel: false,
  showOldPanel: false,
  showDevLabels: false,
};

const G_POSITION = 'POSITION';
const G_STOP = 'STOPLOSS';
const G_TP = 'TAKE PROFITS';
const G_RSI = 'RSI';
const G_PANELS = 'INFOPANELS';
const G_DEV = 'DEVELOPER MODE';

export const inputConfig: InputConfig[] = [
  {
    id: 'strategy', type: 'string', title: 'STRATEGY', defval: 'MANUAL', options: STRATEGIES,
    tooltip: 'EN:\nTo manually configure the strategy, select MANUAL otherwise, changing the settings won\'t have any effect\nRU:\nЧтобы настроить стратегию вручную, выберите MANUAL в противном случае изменение настроек не будет иметь никакого эффекта',
  },
  { id: 'sensitivity', type: 'float', title: 'Sensitive', defval: 18, step: 0.1 },
  { id: 'startDate', type: 'time', title: 'Start calculating date', defval: START_DATE },
  { id: 'showTpEntrySl', type: 'bool', title: 'Show', defval: true, group: G_POSITION, inline: '2.1' },
  { id: 'fillPositions', type: 'bool', title: 'Fill', defval: true, group: G_POSITION, inline: '2.1' },
  {
    id: 'riskPercent', type: 'float', title: 'Risk %', defval: 1, step: 1, group: G_POSITION,
    tooltip: 'EN:\nMaximum allowable loss % of the deposit per 1 trade\nRU:\nМаксимально допустимая потеря % от депозита на 1 сделку',
  },
  { id: 'breakEvenTarget', type: 'string', title: 'BE target', defval: '1', options: ['WITHOUT', '1', '2', '3'], group: G_POSITION },
  { id: 'initialDeposit', type: 'float', title: 'Initial deposit', defval: 1000, step: 100, group: G_POSITION },
  {
    id: 'fixedStop', type: 'bool', title: 'Fixed stoploss %', defval: false, group: G_STOP,
    tooltip: 'EN:\nIf choosed: stoploss will be calculated manually \nIf NOT choosed: stoploss will be calculated automatic\nRU:\nЕсли выбрано: стоп будет рассчитываться вручную \nЕсли НЕ выбрано: стоп будет рассчитываться автоматически',
  },
  { id: 'slPercent', type: 'float', title: 'SL %', defval: 0, step: 0.1, group: G_STOP },
  { id: 'tp1Percent', type: 'float', title: 'TP 1', defval: 1, step: 0.05, min: 0, group: G_TP, inline: '2.2' },
  { id: 'tp1PercentFix', type: 'float', title: 'Fix %', defval: 40, step: 5, group: G_TP, inline: '2.2' },
  { id: 'tp2Percent', type: 'float', title: 'TP 2', defval: 2, step: 0.05, min: 0, group: G_TP, inline: '2.3' },
  { id: 'tp2PercentFix', type: 'float', title: 'Fix %', defval: 30, step: 5, group: G_TP, inline: '2.3' },
  { id: 'tp3Percent', type: 'float', title: 'TP 3', defval: 3, step: 0.05, min: 0, group: G_TP, inline: '2.4' },
  { id: 'tp3PercentFix', type: 'float', title: 'Fix %', defval: 20, step: 5, group: G_TP, inline: '2.4' },
  { id: 'tp4Percent', type: 'float', title: 'TP 4', defval: 4, step: 0.05, min: 0, group: G_TP, inline: '2.5' },
  { id: 'tp4PercentFix', type: 'float', title: 'Fix %', defval: 10, step: 5, group: G_TP, inline: '2.5' },
  { id: 'showRsi', type: 'bool', title: 'Show', defval: false, group: G_RSI, inline: '3.1' },
  { id: 'len', type: 'int', title: 'Length', defval: 14, group: G_RSI, inline: '3.2' },
  { id: 'overbought', type: 'int', title: 'Overbought', defval: 78, group: G_RSI, inline: '3.3' },
  { id: 'oversold', type: 'int', title: 'Oversold', defval: 22, group: G_RSI, inline: '3.3' },
  { id: 'showProfitPanel', type: 'bool', title: 'Show profit panel', defval: true, group: G_PANELS },
  { id: 'showStrategyPanel', type: 'bool', title: 'Show strategy panel', defval: false, group: G_PANELS },
  { id: 'showOldPanel', type: 'bool', title: 'Show old panel', defval: false, group: G_PANELS },
  { id: 'showDevLabels', type: 'bool', title: 'Show', defval: false, group: G_DEV, tooltip: 'Shows all possible events' },
];

/** v5 colour constants */
const GREEN = '#4CAF50';
const RED = '#FF5252';
const GRAY = '#787B86';
const WHITE = '#FFFFFF';
/** v5 default text colour of a label (set explicitly) */
const LABEL_TEXT = '#363A45';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: GREEN, lineWidth: 3, palette: [GREEN, RED] },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Long', style: 'triangleup', location: 'belowbar', color: GREEN, size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'Short', style: 'triangledown', location: 'abovebar', color: RED, size: 'small' },
  { id: 'shape2', kind: 'shape', title: 'Shapes', style: 'cross', location: 'abovebar', color: RED, size: 'tiny' },
  { id: 'shape3', kind: 'shape', title: 'Shapes', style: 'cross', location: 'belowbar', color: GREEN, size: 'tiny' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'linefill', 'table'];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long signal', message: 'Long' },
  { id: 'alert1', title: 'Short signal', message: 'Short' },
  { id: 'alert2', title: 'New signal', message: 'Check chart to see signal direction' },
];

/** The script calls alert() */
export const hasAlertFunction = true;

export const metadata = {
  title: '[IMBA] ALGO',
  shortTitle: '[IMBA] ALGO',
  overlay: true,
};

/** Pine float comparisons (within 1e-10; na compares false) */
const ge = (a: number, b: number) => a - b >= -1e-10;
const le = (a: number, b: number) => a - b <= 1e-10;

interface StrategySettings {
  sensitivity: number;
  riskPercent: number;
  breakEvenTarget: string;
  tp1Percent: number;
  tp1PercentFix: number;
  tp2Percent: number;
  tp2PercentFix: number;
  tp3Percent: number;
  tp3PercentFix: number;
  tp4Percent: number;
  tp4PercentFix: number;
  fixedStop: boolean;
  slPercent: number;
}

interface Trade {
  startBarIndex: number;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  entryHit: boolean;
  slPrice: number;
  tp1Price: number;
  tp1PercentFix: number;
  tp2Price: number;
  tp2PercentFix: number;
  tp3Price: number;
  tp3PercentFix: number;
  tp4Price: number;
  tp4PercentFix: number;
  breakEvenPrice: number;
  slHit: boolean;
  tp1Hit: boolean;
  tp2Hit: boolean;
  tp3Hit: boolean;
  tp4Hit: boolean;
  positionSizeLeft: number;
  riskPercent: number;
  isClosed: boolean;
  closePrice: number;
  canBreakEven: boolean;
  forceClosed: boolean;
  profit: number;
  riskReward: number;
}

/** selector(): the presets (other entries give the Strategy_settings defaults) */
function selector(name: string): StrategySettings {
  const preset = (sensitivity: number): StrategySettings => ({
    sensitivity, riskPercent: 1, breakEvenTarget: '1', tp1Percent: 1, tp1PercentFix: 40, tp2Percent: 2,
    tp2PercentFix: 30, tp3Percent: 3, tp3PercentFix: 20, tp4Percent: 4, tp4PercentFix: 10, fixedStop: false, slPercent: 0,
  });
  if (name === 'MANUAL') return preset(18);
  if (name === 'UNIVERSAL 15m' || name === 'SOL 5m') return preset(20);
  return {
    sensitivity: 0, riskPercent: 1, breakEvenTarget: '1', tp1Percent: 0, tp1PercentFix: 0, tp2Percent: 0,
    tp2PercentFix: 0, tp3Percent: 0, tp3PercentFix: 0, tp4Percent: 0, tp4PercentFix: 0, fixedStop: false, slPercent: 0,
  };
}

/** RoundUp(number, decimals) */
const roundUp = (x: number, decimals: number) => {
  const factor = Math.pow(10, decimals);
  return Math.ceil(x * factor) / factor;
};

/** calc_rr(entry, sl, take) */
const calcRr = (entry: number, sl: number, take: number) =>
  entry - sl > 1e-10 ? (take - entry) / (entry - sl) : (entry - take) / (sl - entry);

/** str.tostring of a float: non-finite values are NaN */
const fmt = (x: number, f?: string) => (Number.isFinite(x) ? str.tostring(x, f) : 'NaN');

export function calculate(
  bars: Bar[],
  inputs: Partial<LanceAlgoInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const toMs = (t: number) => (ms ? t : t * 1000);
  const mintick = mintickOf(chart);

  // strategy_s := strategy_input == "MANUAL" ? Strategy_settings.new(inputs...) : selector(strategy_input)
  const s: StrategySettings = cfg.strategy === 'MANUAL'
    ? {
      sensitivity: cfg.sensitivity, riskPercent: cfg.riskPercent, breakEvenTarget: cfg.breakEvenTarget,
      tp1Percent: cfg.tp1Percent, tp1PercentFix: cfg.tp1PercentFix, tp2Percent: cfg.tp2Percent,
      tp2PercentFix: cfg.tp2PercentFix, tp3Percent: cfg.tp3Percent, tp3PercentFix: cfg.tp3PercentFix,
      tp4Percent: cfg.tp4Percent, tp4PercentFix: cfg.tp4PercentFix, fixedStop: cfg.fixedStop, slPercent: cfg.slPercent,
    }
    : selector(cfg.strategy);
  const sensitivity = s.sensitivity * 10;
  const riskPercent = s.riskPercent;
  const breakEvenTarget = s.breakEvenTarget;
  const tp1Percent = s.tp1Percent / 100;
  const tp2Percent = s.tp2Percent / 100;
  const tp3Percent = s.tp3Percent / 100;
  const tp4Percent = s.tp4Percent / 100;
  const tp1PercentFix = s.tp1PercentFix / 100;
  const tp2PercentFix = s.tp2PercentFix / 100;
  const tp3PercentFix = s.tp3PercentFix / 100;
  const tp4PercentFix = s.tp4PercentFix / 100;
  const fixedStop = s.fixedStop;
  const slPercent = s.slPercent / 100;
  const length = Math.trunc(sensitivity);
  if (n > 0 && !(length >= 1)) {
    throw new Error(`Invalid value of the 'length' argument (${length}) in the 'highest' function. It must be > 0.`);
  }

  const num = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);
  const A = (x: Series) => x.toArray().map(num);
  const highLine = n > 0 ? A(ta.highest(new Series(bars, (b) => b.high), length)) : [];
  const lowLine = n > 0 ? A(ta.lowest(new Series(bars, (b) => b.low), length)) : [];
  const rsi = A(ta.rsi(new Series(bars, (b) => b.close), Math.trunc(cfg.len)));

  resetDrawings({ line: 500, label: 500 });

  const plot0: { time: number; value: number; color: string }[] = [];
  const markers: MarkerData[] = [];
  const alertFlags: boolean[][] = [[], [], []];
  const alertCalls: AlertCall[] = [];

  // Global var state
  let totalProfit = 0;
  let tradeCount = 0;
  let profitTrades = 0;
  let lossTrades = 0;
  let lossStreak = 0;
  let lossInARow = 0;
  let winStreak = 0;
  let winsInARow = 0;
  let firstTradeDate = NaN;
  let trade: Trade | null = null;
  let isLongTrendStarted = false;
  let isShortTrendStarted = false;
  let isLongTrend = false;
  let isShortTrend = false;
  let canLong = false;
  let canShort = false;
  let prevIsLongTrend = false;
  const tp1Line = varDrawing<Line>();
  const tp1Label = varDrawing<Label>();
  const tp2Line = varDrawing<Line>();
  const tp2Label = varDrawing<Label>();
  const tp3Line = varDrawing<Line>();
  const tp3Label = varDrawing<Label>();
  const tp4Line = varDrawing<Line>();
  const tp4Label = varDrawing<Label>();
  const entryLine = varDrawing<Line>();
  const entryLabel = varDrawing<Label>();
  const closeLine = varDrawing<Line>();
  const slLine = varDrawing<Line>();
  const slLabel = varDrawing<Label>();
  const labelAtSignal = varDrawing<Label>();
  const profitTable = varDrawing<Table>();
  const strategyTable = varDrawing<Table>();
  let dep = cfg.initialDeposit;
  let oldPanel: Label | null = null;

  const del = (l: Label | null | undefined) => {
    if (l) label.delete(l);
  };

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const { high, low, open, close } = b;
    const isLast = i === n - 1;
    setDrawingBar(i, isLast);

    const channelRange = highLine[i] - lowLine[i];
    const fib236 = highLine[i] - channelRange * 0.236;
    const fib5 = highLine[i] - channelRange * 0.5;
    const fib786 = highLine[i] - channelRange * 0.786;
    const imbaTrendLine = fib5;

    // CAN LONG/SHORT
    if (toMs(b.time) >= cfg.startDate) {
      canLong = ge(close, imbaTrendLine) && ge(close, fib236) && !isLongTrend;
      canShort = le(close, imbaTrendLine) && le(close, fib786) && !isShortTrend;
    }
    if (canLong) {
      isLongTrend = true;
      isShortTrend = false;
      isLongTrendStarted = !isLongTrendStarted;
    } else if (canShort) {
      isShortTrend = true;
      isLongTrend = false;
      isShortTrendStarted = !isShortTrendStarted;
    } else {
      canLong = false;
      canShort = false;
      isShortTrendStarted = false;
      isLongTrendStarted = false;
    }
    const isTrendChange = isShortTrendStarted || isLongTrendStarted;
    // plotshape(is_long_trend and is_long_trend_started ? imba_trend_line : na, ...): read as a bool
    const shapeOn = (v: number) => !Number.isNaN(v) && v !== 0;
    if (isLongTrend && isLongTrendStarted && shapeOn(imbaTrendLine)) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: GREEN, size: 'small', id: 'shape0' });
    }
    if (isShortTrend && isShortTrendStarted && shapeOn(imbaTrendLine)) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: RED, size: 'small', id: 'shape1' });
    }
    // plot(imba_trend_line, color = is_long_trend[1] ? color.green : color.red)
    plot0.push({ time: b.time, value: imbaTrendLine, color: prevIsLongTrend ? GREEN : RED });

    // LOGIC
    if (trade !== null) {
      const t = trade;
      // calc_profit(trade, show_dev_labels)
      {
        let entryHitLabel: Label | null = null;
        let tradeInfoLabel: Label | null = null;
        let tp1HitLabel: Label | null = null;
        let tp2HitLabel: Label | null = null;
        let tp3HitLabel: Label | null = null;
        let tp4HitLabel: Label | null = null;
        let slHitLabel: Label | null = null;
        let beHitLabel: Label | null = null;
        let profit = 0.0;
        const long = t.side === 'LONG';
        const info = () => `Trade info:\nEntry: ${str.tostring(t.entryPrice)}\nTp1: ${str.tostring(t.tp1Price)}\nTp2: ${
          str.tostring(t.tp2Price)}\nTp3:${str.tostring(t.tp3Price)}\nTp4: ${str.tostring(t.tp4Price)}\nSl: ${str.tostring(t.slPrice)}`;
        const hitText = (k: number) => `TP${k} HIT +${fmt(profit, '#.##')}%\nPosition size %: ${str.tostring(t.positionSizeLeft)}`;
        const hitLabel = (k: number, price: number) =>
          label.new(t.startBarIndex, price, hitText(k), 'bar_index', 'price', undefined, 'label_right', LABEL_TEXT);
        // a target is hit when the high (long) / the low (short) reaches it
        const reach = (p: number) => (long ? ge(high, p) : le(low, p));
        if ((long ? le(low, t.entryPrice) : ge(high, t.entryPrice)) && !t.entryHit) {
          t.startBarIndex = i;
          t.entryHit = true;
          entryHitLabel = label.new(t.startBarIndex, t.entryPrice, 'ENTRY HIT', 'bar_index', 'price', undefined, 'label_right', LABEL_TEXT);
          tradeInfoLabel = label.new(i, high, info(), 'bar_index', 'price', undefined, undefined, LABEL_TEXT);
        }
        if (reach(t.tp1Price) && !t.tp1Hit && t.entryHit) {
          t.tp1Hit = true;
          t.positionSizeLeft -= t.tp1PercentFix;
          profit += calcRr(t.entryPrice, t.slPrice, t.tp1Price) * t.tp1PercentFix / 100 * t.riskPercent;
          tp1HitLabel = hitLabel(1, t.tp1Price);
        }
        if (reach(t.tp2Price) && !t.tp2Hit && t.entryHit) {
          t.tp2Hit = true;
          if (long) t.canBreakEven = true;
          t.positionSizeLeft -= t.tp2PercentFix;
          profit += calcRr(t.entryPrice, t.slPrice, t.tp2Price) * t.tp2PercentFix / 100 * t.riskPercent;
          tp2HitLabel = hitLabel(2, t.tp2Price);
        }
        if (reach(t.tp3Price) && !t.tp3Hit && t.entryHit) {
          t.tp3Hit = true;
          t.positionSizeLeft -= t.tp3PercentFix;
          profit += calcRr(t.entryPrice, t.slPrice, t.tp3Price) * t.tp3PercentFix / 100 * t.riskPercent;
          tp3HitLabel = hitLabel(3, t.tp3Price);
        }
        if (reach(t.tp4Price) && !t.tp4Hit && t.entryHit) {
          t.tp4Hit = true;
          t.isClosed = true;
          t.positionSizeLeft -= t.tp4PercentFix;
          profit += calcRr(t.entryPrice, t.slPrice, t.tp4Price) * t.tp4PercentFix / 100 * t.riskPercent;
          tp4HitLabel = hitLabel(4, t.tp4Price);
        }
        if (reach(t.breakEvenPrice) && !t.canBreakEven && t.entryHit) t.canBreakEven = true;
        // BE ENTRY HIT
        if (t.canBreakEven && t.entryHit) {
          const back = long ? le(low, t.entryPrice) && !ge(close, open) : ge(high, t.entryPrice) && !le(close, open);
          if (back && i !== t.startBarIndex) {
            t.isClosed = true;
            beHitLabel = label.new(i, t.entryPrice, 'BE HIT', 'bar_index', 'price', undefined, 'label_left', LABEL_TEXT);
          }
        }
        // SL HIT
        const slReached = long ? le(low, t.slPrice) : ge(high, t.slPrice);
        if (slReached && !t.canBreakEven && t.entryHit && i !== t.startBarIndex) {
          t.slHit = true;
          t.isClosed = true;
          profit += -t.riskPercent * t.positionSizeLeft / 100;
          slHitLabel = label.new(i, t.slPrice, `SL HIT ${fmt(profit, '#.##')}%`, 'bar_index', 'price', RED, 'label_left', LABEL_TEXT);
        }
        t.profit += profit;
        if (!cfg.showDevLabels) {
          del(entryHitLabel);
          del(tp1HitLabel);
          del(tp2HitLabel);
          del(tp3HitLabel);
          del(tp4HitLabel);
          del(slHitLabel);
          del(beHitLabel);
          del(tradeInfoLabel);
        }
      }
      if (isTrendChange && !t.isClosed) {
        // close_trade(trade, show_dev_labels)
        let profit = 0.0;
        let closedLabel: Label | null = null;
        t.forceClosed = true;
        if (!t.slHit) {
          t.isClosed = true;
          t.closePrice = close;
          if (t.side === 'SHORT') {
            profit = calcRr(t.entryPrice, t.slPrice, close) * t.positionSizeLeft / 100 * t.riskPercent;
            const sign = ge(profit, 0) ? '+' : '';
            closedLabel = label.new(i, high, `TRADE CLOSED ${sign}${fmt(profit, '#.##')}%`, 'bar_index', 'price', undefined,
              undefined, LABEL_TEXT);
          } else {
            if (le(close, t.entryPrice)) {
              const pctClose = Math.abs((close / t.entryPrice - 1) * 100);
              const pctSl = Math.abs((t.entryPrice / t.slPrice - 1) * 100);
              profit = -t.riskPercent * (pctClose / pctSl) * t.positionSizeLeft / 100 + t.profit;
            } else {
              profit = calcRr(t.entryPrice, t.slPrice, close) * t.positionSizeLeft / 100 * t.riskPercent;
            }
            const sign = ge(profit, 0) ? '+' : '';
            closedLabel = label.new(i, low, `TRADE CLOSED ${sign}${fmt(profit, '#.##')}%`, 'bar_index', 'price', undefined,
              'label_up', LABEL_TEXT);
          }
        }
        if (!cfg.showDevLabels) del(closedLabel);
        t.profit += profit;
      }
      if (!t.isClosed) {
        const setLabel = (l: Label | undefined, text: string) => {
          if (!l) return;
          label.set_x(l, i - 3);
          label.set_text(l, text);
        };
        setLabel(entryLabel.value, `🔰${str.tostring(t.entryPrice)}`);
        setLabel(slLabel.value, `⛔${str.tostring(t.slPrice)}`);
        setLabel(tp1Label.value, `${t.tp1Hit ? '✅' : '1️⃣'}${str.tostring(t.tp1Price)}`);
        setLabel(tp2Label.value, `${t.tp2Hit ? '✅' : '2️⃣'}${str.tostring(t.tp2Price)}`);
        setLabel(tp3Label.value, `${t.tp3Hit ? '✅' : '3️⃣'}${str.tostring(t.tp3Price)}`);
        setLabel(tp4Label.value, `${t.tp4Hit ? '✅' : '4️⃣'}${str.tostring(t.tp4Price)}`);
        const setLine = (l: Line | undefined, price: number) => {
          if (!l) return;
          line.set_xy1(l, t.startBarIndex, price);
          line.set_xy2(l, i + 1, price);
        };
        setLine(tp1Line.value, t.tp1Price);
        setLine(tp2Line.value, t.tp2Price);
        setLine(tp3Line.value, t.tp3Price);
        setLine(tp4Line.value, t.tp4Price);
        setLine(entryLine.value, t.entryPrice);
        setLine(slLine.value, t.slPrice);
      }
      const sig = labelAtSignal.value;
      if (sig) {
        label.set_x(sig, Math.trunc((i + t.startBarIndex) / 2));
        // sign = trade.profit >= 0 ? "+" : na (an na string adds nothing)
        label.set_text(sig, `${ge(t.profit, 0) ? '+' : ''}${fmt(t.profit, '#.##')}%`);
        label.set_color(sig, ge(t.profit, 0) ? GREEN : RED);
      }

      // FILLING (a linefill on a pair of lines that has one replaces it: the library returns that linefill)
      if (cfg.fillPositions) {
        const fill = (a: Line | undefined, c: Line | undefined, col: string) => {
          if (a && c) linefill.new(a, c, col);
        };
        const green85 = String(color.new(GREEN, 85));
        const red85 = String(color.new(RED, 85));
        if (t.tp1Hit) fill(entryLine.value, tp1Line.value, green85);
        if (t.tp2Hit) fill(tp1Line.value, tp2Line.value, green85);
        if (t.tp3Hit) fill(tp2Line.value, tp3Line.value, green85);
        if (t.tp4Hit) fill(tp3Line.value, tp4Line.value, green85);
        if (t.slHit) fill(slLine.value, entryLine.value, red85);
        if (t.forceClosed) {
          closeLine.value = line.new(t.startBarIndex, t.closePrice, i, t.closePrice, 'bar_index', 'none', WHITE, 'dotted', 2);
          if (le(t.profit, 0)) fill(closeLine.value, entryLine.value, red85);
        }
      }

      if (t.isClosed) {
        dep = (t.profit / 100) * dep + dep;
        del(entryLabel.value);
        del(slLabel.value);
        del(tp1Label.value);
        del(tp2Label.value);
        del(tp3Label.value);
        del(tp4Label.value);
        totalProfit += t.profit;
        tradeCount += 1;
        if (ge(t.profit, 0)) {
          profitTrades += 1;
          winsInARow += 1;
          lossInARow = 0;
          winStreak = winsInARow > winStreak ? winsInARow : winStreak;
        } else {
          lossTrades += 1;
          lossInARow += 1;
          winsInARow = 0;
          lossStreak = lossInARow > lossStreak ? lossInARow : lossStreak;
        }
        trade = null;
      }
    }

    alertFlags[0].push(canLong && trade === null);
    alertFlags[1].push(canShort && trade === null);
    alertFlags[2].push(canShort || (canLong && trade === null));
    if (canLong || (canShort && trade === null)) {
      firstTradeDate = tradeCount === 0 ? toMs(b.time) : firstTradeDate;
      const entry = close;
      const r = (x: number) => math.round_to_mintick(x, mintick);
      const t: Trade = {
        startBarIndex: i,
        side: canLong ? 'LONG' : 'SHORT',
        entryPrice: entry,
        entryHit: true,
        slPrice: r(canLong
          ? (fixedStop ? entry * (1 - slPercent) : fib786 * (1 - slPercent))
          : (fixedStop ? entry * (1 + slPercent) : fib236 * (1 + slPercent))),
        tp1Price: r(canLong ? entry * (1 + tp1Percent) : entry * (1 - tp1Percent)),
        tp1PercentFix: tp1PercentFix * 100,
        tp2Price: r(canLong ? entry * (1 + tp2Percent) : entry * (1 - tp2Percent)),
        tp2PercentFix: tp2PercentFix * 100,
        tp3Price: r(canLong ? entry * (1 + tp3Percent) : entry * (1 - tp3Percent)),
        tp3PercentFix: tp3PercentFix * 100,
        tp4Price: r(canLong ? entry * (1 + tp4Percent) : entry * (1 - tp4Percent)),
        tp4PercentFix: tp4PercentFix * 100,
        breakEvenPrice: NaN,
        slHit: false,
        tp1Hit: false,
        tp2Hit: false,
        tp3Hit: false,
        tp4Hit: false,
        positionSizeLeft: 100,
        riskPercent,
        isClosed: false,
        closePrice: 0,
        canBreakEven: false,
        forceClosed: false,
        profit: 0,
        riskReward: NaN,
      };
      t.breakEvenPrice = breakEvenTarget === '1' ? t.tp1Price : breakEvenTarget === '2' ? t.tp2Price
        : breakEvenTarget === '3' ? t.tp3Price : breakEvenTarget === 'WITHOUT' ? t.tp4Price : NaN;
      t.riskReward = calcRr(t.entryPrice, t.slPrice, t.tp4Price);
      trade = t;
      const winrate = fmt(roundUp(profitTrades / tradeCount * 100, 2));
      const message = `\n{\n    "side": "${t.side}",\n    "entry": "${str.tostring(t.entryPrice)}",\n    "tp1": "${
        str.tostring(t.tp1Price)}",\n    "tp2": "${str.tostring(t.tp2Price)}",\n    "tp3": "${str.tostring(t.tp3Price)}",\n    "tp4": "${
        str.tostring(t.tp4Price)}",\n    "winrate": "${winrate}%",\n    "strategy": "${cfg.strategy}",\n    "beTargetTrigger": "${
        breakEvenTarget}",\n    "stop": "${str.tostring(t.slPrice)}"\n}\n`;
      alertCalls.push({ time: b.time, message, freq: 'once_per_bar_close' });
      if (cfg.showTpEntrySl) {
        const levelLine = (price: number, col: string, style: 'solid' | 'dotted') =>
          line.new(i, price, i, price, 'bar_index', 'none', col, style, 2);
        const priceLabel = (price: number, textColor: string) =>
          label.new(i, price, str.tostring(price), 'bar_index', 'price', String(color.rgb(255, 255, 255, 100)), 'label_left', textColor);
        const tpColor = String(color.new(GREEN, 30));
        entryLine.value = levelLine(t.entryPrice, String(color.rgb(120, 123, 134, 30)), 'solid');
        entryLabel.value = priceLabel(t.entryPrice, GRAY);
        slLine.value = levelLine(t.slPrice, String(color.new(RED, 30)), 'dotted');
        slLabel.value = priceLabel(t.slPrice, RED);
        tp1Line.value = levelLine(t.tp1Price, tpColor, 'dotted');
        tp1Label.value = priceLabel(t.tp1Price, GREEN);
        tp2Line.value = levelLine(t.tp2Price, tpColor, 'dotted');
        tp2Label.value = priceLabel(t.tp2Price, GREEN);
        tp3Line.value = levelLine(t.tp3Price, tpColor, 'dotted');
        tp3Label.value = priceLabel(t.tp3Price, GREEN);
        tp4Line.value = levelLine(t.tp4Price, tpColor, 'dotted');
        tp4Label.value = priceLabel(t.tp4Price, GREEN);
        labelAtSignal.value = label.new(i, isLongTrend ? t.tp4Price * 1.004 : t.tp4Price * 0.996, '', 'bar_index', 'price',
          undefined, 'label_center', WHITE);
      }
    }

    // RSI
    if (ge(rsi[i], cfg.overbought) && cfg.showRsi) {
      markers.push({ time: b.time, position: 'aboveBar', shape: 'cross', color: RED, size: 'tiny', id: 'shape2' });
    }
    if (le(rsi[i], cfg.oversold) && cfg.showRsi) {
      markers.push({ time: b.time, position: 'belowBar', shape: 'cross', color: GREEN, size: 'tiny', id: 'shape3' });
    }

    // PANELS
    const winrateText = `${fmt(roundUp(profitTrades / tradeCount * 100, 2))}%`;
    // str.format("{0,date,long}", first_trade_date): the reference formats the date in UTC (AAPL: 14:30 UTC is "02:30")
    const dateLong = (t: number) => str.format('{0,date,long}', t);
    if (cfg.showOldPanel) {
      const lim = '-------------------------------------------------------';
      const highIdk = '╔════════════════════════════╗';
      const lowIdk = '╚════════════════════════════╝';
      const first = str.format('{0,date,hh:mm} {0,date,long}', firstTradeDate);
      const text = [
        `${highIdk}\n[IMBA] ALGO\n${lowIdk}`,
        `First signal: ${first}\n${lim}`,
        `Signal closed: ${str.tostring(tradeCount)}                 Winrate: ${winrateText}`,
        `Profit signals: ${str.tostring(profitTrades)}              Loss signals: ${str.tostring(tradeCount - profitTrades)}`,
        `Win streak: ${str.tostring(winStreak)}                  Loss streak: ${str.tostring(lossStreak)}\n${lim}`,
        `💰 Profit: ${fmt(totalProfit, '#.##')}% 💰`,
        '╚════════════════════════════╝',
      ].join('\n');
      const l = label.new(i + 20, close, text, 'bar_index', 'price', String(color.rgb(0, 0, 0, 87)), 'label_left',
        String(color.rgb(76, 187, 72)), undefined, 'center');
      // label.delete(l[1])
      del(oldPanel);
      oldPanel = l;
    }

    if (isLast && cfg.showProfitPanel) {
      // The table is made again on every bar (a new table at the same position replaces the old one): the last one
      const bg = String(color.rgb(0, 0, 0, 87));
      const tb = table.new('top_right', 3, 10, undefined, undefined, undefined, GREEN, 0);
      profitTable.value = tb;
      const cell = (c: number, r: number, text: string, w: number, h: number, halign?: 'left' | 'center', valign?: 'top') =>
        table.cell(tb, c, r, text, w, h, GREEN, halign, valign, 'normal', bg);
      const bar29 = '═════════════════════════════';
      cell(0, 0, `${bar29}\n[IMBA] ALGO\n${bar29}`, 6, 5);
      cell(1, 0, '', 6, 3);
      table.merge_cells(tb, 0, 0, 1, 0);
      cell(0, 1, 'First trade:', 8, 3, 'left');
      cell(1, 1, dateLong(firstTradeDate), 8, 3);
      cell(0, 2, 'Total trades:', 5, 3, 'left');
      cell(1, 2, str.tostring(tradeCount), 5, 3);
      cell(0, 3, 'Profit trades:', 5, 3, 'left');
      cell(1, 3, str.tostring(profitTrades), 5, 3);
      cell(0, 4, 'Loss trades:', 5, 3, 'left');
      cell(1, 4, str.tostring(lossTrades), 5, 3);
      cell(0, 5, 'Winrate:', 5, 3, 'left');
      cell(1, 5, winrateText, 5, 3);
      cell(0, 6, 'Win streak:', 5, 3, 'left');
      cell(1, 6, str.tostring(winStreak), 5, 3);
      cell(0, 7, 'Loss streak:', 5, 3, 'left');
      cell(1, 7, str.tostring(lossStreak), 5, 3);
      cell(0, 8, 'Deposit: ', 5, 3, 'left');
      cell(1, 8, fmt(dep, '##.##'), 5, 3);
      cell(0, 9, `${bar29}\n💰 Profit: ${fmt(totalProfit, '#.##')}% 💰\n${bar29}`, 5, 10, 'center', 'top');
      cell(1, 9, '', 5, 3);
      table.merge_cells(tb, 0, 9, 1, 9);
    }

    if (isLast && cfg.showStrategyPanel) {
      const bg = String(color.rgb(0, 0, 0, 87));
      const tb = table.new('bottom_right', 5, 6, undefined, undefined, undefined, GREEN);
      strategyTable.value = tb;
      const cell = (c: number, r: number, text: string, w: number, h: number, halign?: 'left', valign?: 'bottom') =>
        table.cell(tb, c, r, text, w, h, GREEN, halign, valign, 'normal', bg);
      const bar42 = '══════════════════════════════════════════';
      // timeframe.period of Pine v5: "D" / "W" / "M" without the multiplier 1
      const period = chartTimeframe(bars, chart).replace(/^1([DWM])$/, '$1');
      const wr = fmt(profitTrades / (profitTrades + (tradeCount - profitTrades)) * 100, '##,##');
      cell(1, 0, `${bar42}\n${tickerOf(chart)} ${period} | WR: ${wr}% | TT: ${str.tostring(tradeCount)} | P: ${
        fmt(totalProfit, '#.##')}%\n${bar42}`, 6, 7, undefined, 'bottom');
      cell(2, 0, '', 6, 3);
      cell(3, 0, '', 6, 3);
      cell(4, 0, '', 6, 3);
      table.merge_cells(tb, 1, 0, 4, 0);
      cell(1, 1, 'Strategy:', 6, 3, 'left');
      cell(2, 1, cfg.strategy, 6, 3);
      cell(1, 2, 'Sensitivity:', 5, 3, 'left');
      cell(2, 2, str.tostring(sensitivity / 10), 5, 3);
      cell(1, 3, 'Risk:', 5, 3, 'left');
      cell(2, 3, `${str.tostring(riskPercent)}%`, 5, 3);
      cell(1, 4, 'BE target:', 5, 3, 'left');
      cell(2, 4, breakEvenTarget, 5, 3);
      cell(1, 5, 'Fixed stop:', 5, 3, 'left');
      cell(2, 5, String(fixedStop), 5, 3);
      const tpText = (p: number, f: number) => `${str.tostring(p * 100)}% (${str.tostring(f * 100)}%)`;
      cell(3, 1, 'TP1:', 4, 3);
      cell(4, 1, tpText(tp1Percent, tp1PercentFix), 5, 3);
      cell(3, 2, 'TP2:', 4, 3);
      cell(4, 2, tpText(tp2Percent, tp2PercentFix), 5, 3);
      cell(3, 3, 'TP3:', 4, 3);
      cell(4, 3, tpText(tp3Percent, tp3PercentFix), 5, 3);
      cell(3, 4, 'TP4:', 4, 3);
      cell(4, 4, tpText(tp4Percent, tp4PercentFix), 5, 3);
      cell(3, 5, 'Stop:', 4, 3);
      cell(4, 5, `${str.tostring(slPercent * 100)}%`, 8, 3);
    }

    prevIsLongTrend = isLongTrend;
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: plot0.map((p) => (Number.isFinite(p.value) ? p : { ...p, value: NaN })) },
    markers,
    alerts: alertStates(alertConditions, bars, alertFlags),
    alertCalls,
    ...drawingOutputs(bars, ms ? 'ms' : 's'),
  };
}

export const LanceAlgo = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
  alertConditions,
  hasAlertFunction,
};
