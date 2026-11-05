/**
 * R:R Trading System Framework
 *
 * A risk:reward backtest of ten trade types: five longs (0. Stochastic, 1. 2x MA Cross, 2. MACD, 3. Bollinger Bands,
 * 4. Supertrend) taken above the 200-bar SMA of the close and the same five as shorts (5 to 9) taken below it.
 * Entry signals: a %K (SMA 3 of the 14-bar stochastic) cross above %D (SMA 3 of %K) below 20 (cross below above 80
 * for the short); the SMA 9 crossing the SMA 18; the MACD (12, 26, 9) histogram crossing 0; the close crossing back
 * above the lower Bollinger band (20, 2) (below the upper band for the short); a Supertrend (3, 10) direction change.
 *
 * A signal while the trade type has no open trade opens one at the open of the next bar: stop at "Stop %" of the
 * price, take profits TP 1 to TP 4 at those multiples of the stop distance. A trailing stop follows the price at the
 * same stop % and only counts once it is beyond the entry price. A trade ends on the stop ("FAIL" before TP 1, "STOP"
 * after it) or on the trailing stop ("TSL", a win). The signals of the trade type and of the opposite side are also
 * counted while a trade runs (green / red triangles) and measured against the lowest / highest price reached or the
 * trailing stop.
 *
 * Outputs: the trailing stop of the two trade types chosen in "A)" / "B)" (one plot per trade type, broken between
 * trades); for these two types the ENTRY labels, an entry box and a range box per trade, the TP / FAIL / TSL / STOP
 * labels and the triangles; for every open trade, the entry / stop / TP lines and labels to the right of the price
 * and a price box; the Risk:Reward table (entries, hits, % and average bars per event, average R:R, win %, average
 * risk:reward return) and the Trade Tracking table of the open trades. The script keeps 50 ENTRY labels, 350 event
 * labels and 450 boxes per trade type (one deletion per bar), at most 500 lines, 500 labels and 500 boxes.
 *
 * Chart context: the symbol tick (`math.round_to_mintick` in the Trade Tracking table; 0.01 without a context).
 *
 * Reference: "R:R Trading System Framework" by carnagecain
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, math, color, Series, line, box, label, table, resetDrawings, setDrawingBar, drawingOutputs,
  type Box, type Label, type Line, type Table, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { mintickOf, type ChartContext } from '../chart-context';

const TRADE_NAMES = [
  '0. Stochastic', '1. 2x MA Cross', '2. MACD', '3. Bollinger Bands', '4. Supertrend',
  '5. Stochastic (Short)', '6. 2x MA Cross (Short)', '7. MACD (Short)', '8. Bollinger Bands (Short)', '9. Supertrend (Short)',
] as const;
type TradeName = (typeof TRADE_NAMES)[number];
type BacktestChoice = 'None' | TradeName;
type TextSize = 'tiny' | 'small' | 'normal' | 'large';
type YPos = 'top' | 'middle' | 'bottom';
type XPos = 'left' | 'center' | 'right';

export interface RRTradingSystemFrameworkInputs {
  backtestA: BacktestChoice;
  backtestB: BacktestChoice;
  tttActivated: boolean;
  tttTextSize: TextSize;
  tttTableYpos: YPos;
  tttTableXpos: XPos;
  rrtActivated: boolean;
  rrtTextSize: TextSize;
  rrtTableYpos: YPos;
  rrtTableXpos: XPos;
  l0Activated: boolean; l0SlValue: number; l0Tp1Value: number; l0Tp2Value: number; l0Tp3Value: number; l0Tp4Value: number;
  l1Activated: boolean; l1SlValue: number; l1Tp1Value: number; l1Tp2Value: number; l1Tp3Value: number; l1Tp4Value: number;
  l2Activated: boolean; l2SlValue: number; l2Tp1Value: number; l2Tp2Value: number; l2Tp3Value: number; l2Tp4Value: number;
  l3Activated: boolean; l3SlValue: number; l3Tp1Value: number; l3Tp2Value: number; l3Tp3Value: number; l3Tp4Value: number;
  l4Activated: boolean; l4SlValue: number; l4Tp1Value: number; l4Tp2Value: number; l4Tp3Value: number; l4Tp4Value: number;
  s5Activated: boolean; s5SlValue: number; s5Tp1Value: number; s5Tp2Value: number; s5Tp3Value: number; s5Tp4Value: number;
  s6Activated: boolean; s6SlValue: number; s6Tp1Value: number; s6Tp2Value: number; s6Tp3Value: number; s6Tp4Value: number;
  s7Activated: boolean; s7SlValue: number; s7Tp1Value: number; s7Tp2Value: number; s7Tp3Value: number; s7Tp4Value: number;
  s8Activated: boolean; s8SlValue: number; s8Tp1Value: number; s8Tp2Value: number; s8Tp3Value: number; s8Tp4Value: number;
  s9Activated: boolean; s9SlValue: number; s9Tp1Value: number; s9Tp2Value: number; s9Tp3Value: number; s9Tp4Value: number;
}

const KEYS = ['l0', 'l1', 'l2', 'l3', 'l4', 's5', 's6', 's7', 's8', 's9'] as const;
type TradeKey = (typeof KEYS)[number];

export const defaultInputs: RRTradingSystemFrameworkInputs = {
  backtestA: '0. Stochastic',
  backtestB: '1. 2x MA Cross',
  tttActivated: true,
  tttTextSize: 'normal',
  tttTableYpos: 'top',
  tttTableXpos: 'center',
  rrtActivated: true,
  rrtTextSize: 'normal',
  rrtTableYpos: 'bottom',
  rrtTableXpos: 'left',
  l0Activated: true, l0SlValue: 2, l0Tp1Value: 1, l0Tp2Value: 2, l0Tp3Value: 3, l0Tp4Value: 4,
  l1Activated: true, l1SlValue: 2.5, l1Tp1Value: 1, l1Tp2Value: 2, l1Tp3Value: 3, l1Tp4Value: 4,
  l2Activated: true, l2SlValue: 2, l2Tp1Value: 1, l2Tp2Value: 2, l2Tp3Value: 3, l2Tp4Value: 4,
  l3Activated: true, l3SlValue: 2, l3Tp1Value: 1, l3Tp2Value: 2, l3Tp3Value: 3, l3Tp4Value: 4,
  l4Activated: true, l4SlValue: 2, l4Tp1Value: 1, l4Tp2Value: 2, l4Tp3Value: 3, l4Tp4Value: 4,
  s5Activated: true, s5SlValue: 2, s5Tp1Value: 1, s5Tp2Value: 2, s5Tp3Value: 3, s5Tp4Value: 4,
  s6Activated: true, s6SlValue: 2, s6Tp1Value: 1, s6Tp2Value: 2, s6Tp3Value: 3, s6Tp4Value: 4,
  s7Activated: true, s7SlValue: 2, s7Tp1Value: 1, s7Tp2Value: 2, s7Tp3Value: 3, s7Tp4Value: 4,
  s8Activated: true, s8SlValue: 2, s8Tp1Value: 1, s8Tp2Value: 2, s8Tp3Value: 3, s8Tp4Value: 4,
  s9Activated: true, s9SlValue: 2, s9Tp1Value: 1, s9Tp2Value: 2, s9Tp3Value: 3, s9Tp4Value: 4,
};

/** Em space (the original's input titles and line label texts use it) */
const EM = ' ';
const STOP_TEXT = `STOP\n${EM}`;
const G_BACKTEST = '\u{1F4C8} BACKTESTING BOXES / LABELS / TRAILING STOP';
const G_TTT = '\u{1F4CA} TRADE TRACKING TABLE';
const G_RRT = '\u{1F4CA} RISK:REWARD TABLE';
const BACKTEST_OPTIONS: BacktestChoice[] = ['None', ...TRADE_NAMES];
const TABLE_TOOLTIP = '- Activate Table\n- Text Size\n- Table Position (Y)\n- Table Position (X)';
const TP_TOOLTIP = 'Multiple of the Stop % above. This represents your risk:reward ratio for each TP level.';

/** The six inputs of one trade type (group "▷ <name>") */
function tradeInputs(key: TradeKey, name: TradeName): InputConfig[] {
  const group = `▷ ${name}`;
  const first = key === 'l0';
  const d = defaultInputs as unknown as Record<string, number | boolean>;
  const f = (suffix: string, title: string, inline: string, tooltip?: string): InputConfig => ({
    id: `${key}${suffix}`, type: 'float', title, defval: d[`${key}${suffix}`] as number, step: 0.25, group, inline,
    ...(tooltip ? { tooltip } : {}),
  });
  return [
    { id: `${key}Activated`, type: 'bool', title: `Active |${EM}${EM}`, defval: true, group, inline: '1' },
    f('SlValue', 'Stop %', '1', first
      ? '% of price. The Trailing Stop is built to only become active once the Trailing Stop is above the Entry price and uses the same % set here for the Entry Stop.'
      : undefined),
    f('Tp1Value', `${EM}${EM}${EM}${EM}TP 1`, '2'),
    f('Tp2Value', 'TP 2', '2', first ? TP_TOOLTIP : undefined),
    f('Tp3Value', `${EM}${EM}${EM}${EM}TP 3`, '3'),
    f('Tp4Value', 'TP 4', '3', first ? TP_TOOLTIP : undefined),
  ];
}

export const inputConfig: InputConfig[] = [
  { id: 'backtestA', type: 'string', title: `${EM.repeat(5)}A)`, defval: '0. Stochastic', options: BACKTEST_OPTIONS, group: G_BACKTEST, inline: '1' },
  {
    id: 'backtestB', type: 'string', title: `${EM}${EM}B)`, defval: '1. 2x MA Cross', options: BACKTEST_OPTIONS, group: G_BACKTEST, inline: '1',
    tooltip: 'Display 2 different trade types.\n\nCompare and contrast all the different components of the trades and their relationships with one another.\n\nThis system is designed to force you to consider Risk:Reward at all times throughout the trading process. Get creative but try your best to only include things that improve your decision-making process, create consistency, improve risk:reward concepts, and are realsitic once met with the brutal truth of the trading world.',
  },
  { id: 'tttActivated', type: 'bool', title: 'Active', defval: true, group: G_TTT, inline: '1' },
  { id: 'tttTextSize', type: 'string', title: '', defval: 'normal', options: ['tiny', 'small', 'normal', 'large'], group: G_TTT, inline: '1' },
  { id: 'tttTableYpos', type: 'string', title: '', defval: 'top', options: ['top', 'middle', 'bottom'], group: G_TTT, inline: '1' },
  { id: 'tttTableXpos', type: 'string', title: '', defval: 'center', options: ['left', 'center', 'right'], group: G_TTT, inline: '1', tooltip: TABLE_TOOLTIP },
  { id: 'rrtActivated', type: 'bool', title: 'Active', defval: true, group: G_RRT, inline: '1' },
  { id: 'rrtTextSize', type: 'string', title: '', defval: 'normal', options: ['tiny', 'small', 'normal', 'large'], group: G_RRT, inline: '1' },
  { id: 'rrtTableYpos', type: 'string', title: '', defval: 'bottom', options: ['top', 'middle', 'bottom'], group: G_RRT, inline: '1' },
  { id: 'rrtTableXpos', type: 'string', title: '', defval: 'left', options: ['left', 'center', 'right'], group: G_RRT, inline: '1', tooltip: TABLE_TOOLTIP },
  ...KEYS.flatMap((k, i) => tradeInputs(k, TRADE_NAMES[i])),
];

// 1. COLOR
const C_BLUE = '#00e5ff';
const C_ORANGE = '#ffa300';
const C_LIME_GREEN = '#14ff00';
const C_PURPLE = '#e757ff';
const C_YELLOW = '#fdff5f';
const C_DARK_BLUE = '#005ae6';
const C_LIME_YELLOW = '#c9ff00';
const C_DARK_PURPLE = '#a600ff';
const C_MINT = '#00ffa9';
const C_BURNT_ORANGE = '#ff5f00';
const C_PINK = '#ff0078';
const C_BLACK = '#000000';
const C_TV_GRAY_OUTLINE = '#434651';
const C_LIGHT_GRAY = '#d1d4dc';
const C_MEDIUM_GRAY = '#787b86';
const C_TV_BLACK = '#131722';

const TRADE_COLORS = [C_BLUE, C_ORANGE, C_LIME_GREEN, C_PURPLE, C_YELLOW, C_DARK_BLUE, C_LIME_YELLOW, C_DARK_PURPLE, C_MINT, C_BURNT_ORANGE];
const OFFSETS = [2, 11, 20, 29, 38, 47, 56, 65, 74, 83];
const PLOT_TITLES = ['L0 TSL', 'L1 TSL', 'L2 TSL', 'L3 TSL', 'L4 TSL', 'S5 TSL', 'S6 TSL', 'S7 TSL', 'S8 TSL', 'S9 TSL'];

export const plotConfig: PlotConfig[] = PLOT_TITLES.map((title, i) => ({
  id: `plot${i}`, title, color: TRADE_COLORS[i], lineWidth: 2, style: 'linebr' as const,
}));

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'table'];

export const metadata = {
  title: 'R:R Trading System Framework',
  shortTitle: 'R:R Trading System Framework',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** One row of the script's float matrix (columns of the original, all 0 at the start) */
interface TradeState {
  entryPrice: number; exitPrice: number; stopPrice: number; tpPrice: number[]; bullishPrice: number; bearishPrice: number;
  tslPrice: number; maxReached: number; minReached: number;
  entryCount: number; inTradeBarCount: number; tslHitCount: number; tpHitCount: number[]; failHitCount: number;
  bullishHitCount: number; bearishHitCount: number;
  tslBarsCount: number; tpBarsCount: number[]; failBarsCount: number;
  entryIsActive: number; tpHit: number[]; tslHit: number;
  winRRSum: number; lossRRSum: number; bullishAmountSum: number; bearishAmountSum: number; bullishToMin: number;
  bearishToMax: number; plAmount: number; stopAmount: number; tradeRR: number; numberOfWins: number;
  numberOfLosses: number; winPercent: number; lossPercent: number; avgWinRR: number; avgLossRR: number;
  avgRiskReward: number; avgBullishDev: number; avgBearishDev: number; avgBullishRR: number; avgBearishRR: number;
  rrtFailPct: number; rrtTpPct: number[]; rrtTslPct: number;
  rrtAvgFailBars: number; rrtAvgTpBars: number[]; rrtAvgTslBars: number;
}

const newState = (): TradeState => ({
  entryPrice: 0, exitPrice: 0, stopPrice: 0, tpPrice: [0, 0, 0, 0], bullishPrice: 0, bearishPrice: 0,
  tslPrice: 0, maxReached: 0, minReached: 0,
  entryCount: 0, inTradeBarCount: 0, tslHitCount: 0, tpHitCount: [0, 0, 0, 0], failHitCount: 0,
  bullishHitCount: 0, bearishHitCount: 0,
  tslBarsCount: 0, tpBarsCount: [0, 0, 0, 0], failBarsCount: 0,
  entryIsActive: 0, tpHit: [0, 0, 0, 0], tslHit: 0,
  winRRSum: 0, lossRRSum: 0, bullishAmountSum: 0, bearishAmountSum: 0, bullishToMin: 0,
  bearishToMax: 0, plAmount: 0, stopAmount: 0, tradeRR: 0, numberOfWins: 0,
  numberOfLosses: 0, winPercent: 0, lossPercent: 0, avgWinRR: 0, avgLossRR: 0,
  avgRiskReward: 0, avgBullishDev: 0, avgBearishDev: 0, avgBullishRR: 0, avgBearishRR: 0,
  rrtFailPct: 0, rrtTpPct: [0, 0, 0, 0], rrtTslPct: 0,
  rrtAvgFailBars: 0, rrtAvgTpBars: [0, 0, 0, 0], rrtAvgTslBars: 0,
});

/** Line and label columns of the original: Entry, SL, TP1..TP4, TSL (the TSL column is never moved after the first
 * bar: the script sets the SL line and label in its place) */
const ENTRY = 0;
const SL = 1;

export function calculate(
  bars: Bar[],
  inputs: Partial<RRTradingSystemFrameworkInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const mintick = mintickOf(chart);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const B = (s: Series) => s.toArray().map((v) => Boolean(v));
  const cfgRec = cfg as unknown as Record<string, number | boolean>;

  // 4. ENTRY CONDITIONS
  const close = new Series(bars, (b) => b.close);
  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);
  const kS = ta.sma(ta.stoch(close, high, low, 14), 3);
  const dS = ta.sma(kS, 3);
  const k = A(kS);
  const d = A(dS);
  const co = B(ta.crossover(kS, dS));
  const cu = B(ta.crossunder(kS, dS));
  const mafast = ta.sma(close, 9);
  const maslow = ta.sma(close, 18);
  const xoverFastSlow = B(ta.crossover(mafast, maslow));
  const xunderFastSlow = B(ta.crossunder(mafast, maslow));
  const [, , delta] = ta.macd(close, 12, 26, 9);
  const xoverDt = B(ta.crossover(delta, 0));
  const xunderDt = B(ta.crossunder(delta, 0));
  const [, upper, lower] = ta.bb(close, 20, 2);
  const buyEntry = B(ta.crossover(close, lower));
  const sellEntry = B(ta.crossunder(close, upper));
  const [, stDirection] = ta.supertrend(bars, 3.0, 10);
  const chDir = A(ta.change(stDirection));
  const sma200 = A(ta.sma(close, 200));

  // Per trade type: [signal, favourable trigger, non-favourable trigger] of each bar (without the open-trade test)
  const signal = (t: number, i: number): boolean => {
    const stochBull = !isNaN(k[i]) && !isNaN(d[i]) && co[i] && lt(k[i], 20);
    const stochBear = !isNaN(k[i]) && !isNaN(d[i]) && cu[i] && gt(k[i], 80);
    switch (t) {
      case 0: case 5: return t === 0 ? stochBull : stochBear;
      case 1: case 6: return t === 1 ? xoverFastSlow[i] : xunderFastSlow[i];
      case 2: case 7: return t === 2 ? xoverDt[i] : xunderDt[i];
      case 3: case 8: return t === 3 ? buyEntry[i] : sellEntry[i];
      default: return t === 4 ? lt(chDir[i], 0) : gt(chDir[i], 0);
    }
  };

  resetDrawings({ line: 500, label: 500, box: 500 });

  const states = KEYS.map(() => newState());
  const activated = KEYS.map((key) => cfgRec[`${key}Activated`] as boolean);
  const isLong = KEYS.map((_, t) => t < 5);
  const slValue = KEYS.map((key) => cfgRec[`${key}SlValue`] as number);
  const tpValue = KEYS.map((key) => [1, 2, 3, 4].map((j) => cfgRec[`${key}Tp${j}Value`] as number));
  const shown = TRADE_NAMES.map((name) => cfg.backtestA === name || cfg.backtestB === name);
  const col = (c: string, t: number) => String(color.new(c, t));
  const tradeCol = TRADE_COLORS.map((c) => ({
    c0: col(c, 0), c50: col(c, 50), c70: col(c, 70), c80: col(c, 80), c90: col(c, 90), c97: col(c, 97), c98: col(c, 98), c100: col(c, 100),
  }));
  const pink90 = col(C_PINK, 90);

  // 3. MATRICES / ARRAYS
  const aEntryPriceLabel: Label[] = [];
  const aNewLabel: Label[] = [];
  const aNewBox: Box[][] = KEYS.map(() => []);
  let matrixLine: Line[][] = [];
  let matrixLabel: Label[][] = [];
  const aPriceBox: Box[] = [];
  let rrTable: Table | null = null;
  let ttTable: Table | null = null;
  let headerMerged = false;

  const entryHist = KEYS.map(() => false); // entry[1] of each f_Entry call

  const plotArr = KEYS.map(() => [] as { time: number; value: number; color: string }[]);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];

    if (aEntryPriceLabel.length > 50) label.delete(aEntryPriceLabel.pop()!);
    if (aNewLabel.length > 350) label.delete(aNewLabel.pop()!);
    for (const bx of aNewBox) {
      if (bx.length > 450) box.delete(bx.pop()!);
    }

    if (i === 0) {
      // FILL MATRIX: 7 lines and 7 labels per trade type
      matrixLine = KEYS.map(() => []);
      matrixLabel = KEYS.map(() => []);
      for (let t = 0; t < KEYS.length; t++) {
        for (let j = 0; j < 7; j++) matrixLine[t].push(line.new(i, b.close, i, b.close, 'bar_index', undefined, undefined, undefined, 3));
        // label.new(bar_index, close, color = na): the default text colour of a Pine v5 label is #363A45
        for (let j = 0; j < 7; j++) matrixLabel[t].push(label.new(i, b.close, undefined, 'bar_index', 'price', 'transparent', undefined, '#363A45'));
      }
      // PRICE BOXES (array.unshift: index i is the box made in step 9 - i)
      for (let j = 0; j <= 9; j++) aPriceBox.unshift(box.new(i, b.close, i, b.close, 'transparent', undefined, undefined, undefined, undefined, 'transparent'));
      // TABLES
      rrTable = table.new(`${cfg.rrtTableYpos}_${cfg.rrtTableXpos}` as Table['position'], 30, 20, C_TV_BLACK, C_TV_GRAY_OUTLINE, 4, C_TV_GRAY_OUTLINE, 2);
      ttTable = table.new(`${cfg.tttTableYpos}_${cfg.tttTableXpos}` as Table['position'], 20, 20, C_TV_BLACK, C_TV_GRAY_OUTLINE, 4, C_TV_GRAY_OUTLINE, 2);
    }

    const above200 = gt(b.close, sma200[i]);
    const below200 = lt(b.close, sma200[i]);
    // L0_Entry ... S9_Entry: no open trade of the type (state of the bar before), activated, signal, SMA 200 filter
    const entries = KEYS.map((_, t) => states[t].entryIsActive === 0 && activated[t] && signal(t, i) && (t < 5 ? above200 : below200));
    // Bullish / bearish triggers: favourable (with the filter) and non-favourable (opposite signal, no filter)
    const bullish = KEYS.map((_, t) => activated[t] && (t < 5 ? signal(t, i) && above200 : signal(t - 5, i)));
    const bearish = KEYS.map((_, t) => activated[t] && (t < 5 ? signal(t + 5, i) : signal(t, i) && below200));

    for (let t = 0; t < KEYS.length; t++) {
      const entryPrev = entryHist[t];
      entryHist[t] = entries[t];
      if (!activated[t]) continue;
      fEntry(t, i, b, entryPrev, bullish[t], bearish[t]);
    }

    // 7. TRAILING STOP PLOTS
    for (let t = 0; t < KEYS.length; t++) {
      const s = states[t];
      const on = shown[t] && eq(s.entryIsActive, 1);
      const beyond = isLong[t] ? gt(s.tslPrice, s.entryPrice) : lt(s.tslPrice, s.entryPrice);
      plotArr[t].push({ time: b.time, value: on ? s.tslPrice : NaN, color: beyond ? tradeCol[t].c0 : tradeCol[t].c50 });
    }
  }
  setDrawingBar(null);

  function fTpHit(t: number, i: number, j: number): void {
    const s = states[t];
    const gTpPrice = s.tpPrice[j];
    const hit = isLong[t] ? gt(bars[i].high, gTpPrice) && s.tpHit[j] === 0 : lt(bars[i].low, gTpPrice) && s.tpHit[j] === 0;
    if (hit) {
      s.tpHitCount[j] += 1;
      s.tpBarsCount[j] += s.inTradeBarCount;
      s.tpHit[j] = 1;
      if (shown[t]) {
        aNewLabel.unshift(label.new(i, gTpPrice, `TP${j + 1}`, 'bar_index', 'price', tradeCol[t].c0,
          isLong[t] ? 'label_lower_right' : 'label_upper_right', C_BLACK, 'small', undefined, str.tostring(gTpPrice)));
      }
    }
  }

  function fEntry(t: number, i: number, b: Bar, entryPrev: boolean, bullishTrigger: boolean, bearishTrigger: boolean): void {
    const s = states[t];
    const L = isLong[t];
    const tc = tradeCol[t];
    const tradeColor = TRADE_COLORS[t];
    const offset = OFFSETS[t];
    const entryText = TRADE_NAMES[t];
    const sl = slValue[t];
    const boxes = aNewBox[t];
    const { open, high: hi, low: lo, close: cl } = b;

    s.maxReached = Math.max(s.maxReached, hi);
    s.minReached = Math.min(s.minReached, lo);
    const maxReached = s.maxReached;
    const minReached = s.minReached;

    if (entryPrev) {
      s.entryIsActive = 1;
      const stopPrice = L ? open - open * (sl / 100) : open + open * (sl / 100);
      s.stopPrice = stopPrice;
      for (let j = 0; j < 4; j++) {
        s.tpPrice[j] = L ? open + open * (sl * tpValue[t][j] / 100) : open - open * (sl * tpValue[t][j] / 100);
      }
      s.entryPrice = open;
      s.exitPrice = 0;
      s.tpHit = [0, 0, 0, 0];
      s.tslHit = 0;
      s.tradeRR = 0;
      s.stopAmount = open - stopPrice;
      s.entryCount += 1;
      if (shown[t]) {
        aEntryPriceLabel.unshift(label.new(i, open, 'ENTRY', 'bar_index', 'price', tc.c0, 'label_right', C_BLACK, 'small', undefined, str.tostring(open)));
        boxes.unshift(box.new(i, open, i, open, tc.c0, undefined, undefined, undefined, undefined, tc.c90));
        boxes.unshift(box.new(i, hi, i, lo, tc.c70, undefined, undefined, undefined, undefined, tc.c98));
      }
    }

    const gActive = eq(s.entryIsActive, 1);

    // TRAILING STOP LOSS
    let trailingStop = s.tslPrice;
    const trailingStopMax = gActive ? Math.max(open - open * (sl / 100), trailingStop) : 0;
    const trailingStopMin = gActive ? Math.min(open + open * (sl / 100), trailingStop) : 10e6;
    s.tslPrice = L ? trailingStopMax : trailingStopMin;

    // ACTIVE TRADE BLOCK
    const lines = matrixLine[t];
    const labels = matrixLabel[t];
    const gEntryPrice = s.entryPrice;
    const gExitPrice = s.exitPrice;
    const gStopPrice = s.stopPrice;
    const gTpPrice = s.tpPrice.slice();
    let gInTradeBarCount = s.inTradeBarCount;
    const gStopAmount = s.stopAmount;
    // gTSL_Line / gTSL_Label are the SL line and label of the trade type (matrix column SL_Line / SL_Label)
    const gSlLine = lines[SL];
    const gSlLabel = labels[SL];
    const priceBox = aPriceBox[t];

    if (gActive) {
      trailingStop = s.tslPrice;
      const better = (price: number) => (L ? gt(cl, price) : lt(cl, price));
      const x1 = i + offset;
      const x2 = i + offset + 8;
      line.set_xy1(lines[ENTRY], x1, gEntryPrice); line.set_xy2(lines[ENTRY], x2, gEntryPrice);
      line.set_color(lines[ENTRY], better(gEntryPrice) ? tradeColor : tc.c50);
      line.set_xy1(gSlLine, x1, gStopPrice); line.set_xy2(gSlLine, x2, gStopPrice); line.set_color(gSlLine, tc.c50);
      for (let j = 0; j < 4; j++) {
        const ln = lines[2 + j];
        line.set_xy1(ln, x1, gTpPrice[j]); line.set_xy2(ln, x2, gTpPrice[j]);
        line.set_color(ln, better(gTpPrice[j]) ? tradeColor : tc.c50);
      }
      const tslBeyond = L ? gt(trailingStop, gEntryPrice) : lt(trailingStop, gEntryPrice);
      if (tslBeyond) {
        line.set_xy1(gSlLine, x1, trailingStop); line.set_xy2(gSlLine, x2, trailingStop); line.set_color(gSlLine, tc.c50);
      }

      const lx = i + offset + 4;
      label.set_xy(labels[ENTRY], lx, gEntryPrice); label.set_text(labels[ENTRY], `${entryText.toUpperCase()}\n${EM}`);
      label.set_textcolor(labels[ENTRY], tradeColor);
      label.set_xy(gSlLabel, lx, gStopPrice); label.set_text(gSlLabel, STOP_TEXT); label.set_textcolor(gSlLabel, tc.c50);
      for (let j = 0; j < 4; j++) {
        const lb = labels[2 + j];
        label.set_xy(lb, lx, gTpPrice[j]); label.set_text(lb, `TP ${j + 1}\n${EM}`);
        label.set_textcolor(lb, better(gTpPrice[j]) ? tradeColor : tc.c50);
      }
      if (tslBeyond) {
        label.set_xy(gSlLabel, lx, trailingStop); label.set_text(gSlLabel, STOP_TEXT); label.set_textcolor(gSlLabel, tc.c50);
      }
      label.set_tooltip(labels[ENTRY], str.tostring(gEntryPrice));
      label.set_tooltip(gSlLabel, str.tostring(gStopPrice));
      for (let j = 0; j < 4; j++) label.set_tooltip(labels[2 + j], str.tostring(gTpPrice[j]));
      label.set_tooltip(gSlLabel, str.tostring(trailingStop));

      // TPs
      for (let j = 0; j < 4; j++) fTpHit(t, i, j);

      // GREEN ARROWS
      if (bullishTrigger) {
        s.bullishPrice = cl;
        const gBullishPrice = s.bullishPrice;
        s.bullishToMin = lt(gBullishPrice, gEntryPrice) ? gBullishPrice - minReached : gBullishPrice - trailingStop;
        s.bullishAmountSum += s.bullishToMin;
        s.bullishHitCount += 1;
        s.avgBullishDev = s.bullishAmountSum / s.bullishHitCount;
        s.avgBullishRR = s.avgBullishDev / gStopAmount;
        if (shown[t]) {
          aNewLabel.unshift(label.new(i, cl, '', 'bar_index', 'belowbar', col(C_LIME_GREEN, 0), 'triangleup', 'transparent', 'tiny',
            undefined, `${entryText} - ${str.tostring(cl)}`));
        }
      }

      // RED ARROWS
      if (bearishTrigger) {
        s.bearishPrice = cl;
        const gBearishPrice = s.bearishPrice;
        s.bearishToMax = gt(gBearishPrice, gEntryPrice) ? gBearishPrice - maxReached : gBearishPrice - trailingStop;
        s.bearishAmountSum += s.bearishToMax;
        s.bearishHitCount += 1;
        s.avgBearishDev = s.bearishAmountSum / s.bearishHitCount;
        s.avgBearishRR = s.avgBearishDev / gStopAmount;
        if (shown[t]) {
          aNewLabel.unshift(label.new(i, cl, '', 'bar_index', 'abovebar', col(C_PINK, 0), 'triangledown', 'transparent', 'tiny',
            undefined, `${entryText} - ${str.tostring(cl)}`));
        }
      }

      const posLab = L ? 'label_upper_left' : 'label_lower_left';

      // FAIL
      const gTp1Hit = s.tpHit[0];
      const failed = (L ? lt(lo, gStopPrice) : gt(hi, gStopPrice)) && gTp1Hit === 0;
      if (failed) {
        s.exitPrice = gStopPrice;
        s.failHitCount += 1;
        s.failBarsCount += s.inTradeBarCount;
        s.numberOfLosses += 1;
        s.plAmount = s.exitPrice - gEntryPrice;
        s.tradeRR = s.plAmount / gStopAmount;
        s.lossRRSum += s.tradeRR;
        s.entryIsActive = 0;
        if (shown[t]) {
          aNewLabel.unshift(label.new(i, gStopPrice, 'FAIL', 'bar_index', 'price', tc.c0, posLab, C_BLACK, 'small', undefined, str.tostring(gStopPrice)));
        }
      }

      // TRAILING STOP HIT
      trailingStop = s.tslPrice;
      const trailingStopHit = (L ? lt(lo, trailingStop) && gt(trailingStop, gEntryPrice) : gt(hi, trailingStop) && lt(trailingStop, gEntryPrice))
        && s.tslHit === 0;
      if (trailingStopHit) {
        s.exitPrice = trailingStop;
        s.tslHitCount += 1;
        s.tslHit = 1;
        s.tslBarsCount += gInTradeBarCount;
        s.numberOfWins += 1;
        s.plAmount = s.exitPrice - gEntryPrice;
        s.tradeRR = s.plAmount / gStopAmount;
        s.winRRSum += s.tradeRR;
        s.entryIsActive = 0;
        if (shown[t]) {
          aNewLabel.unshift(label.new(i, trailingStop, 'TSL', 'bar_index', 'price', tc.c0, posLab, C_BLACK, 'small', undefined, str.tostring(trailingStop)));
        }
      }

      // STOP HIT
      const stopHit = (L ? lt(lo, gStopPrice) : gt(hi, gStopPrice)) && gTp1Hit === 1;
      if (stopHit) {
        s.exitPrice = gStopPrice;
        s.numberOfLosses += 1;
        s.plAmount = s.exitPrice - gEntryPrice;
        s.tradeRR = s.plAmount / gStopAmount;
        s.lossRRSum += s.tradeRR;
        s.entryIsActive = 0;
        if (shown[t]) {
          aNewLabel.unshift(label.new(i, gStopPrice, 'STOP', 'bar_index', 'price', tc.c0, posLab, C_BLACK, 'small', undefined, str.tostring(gStopPrice)));
        }
      }

      box.set_lefttop(priceBox, i + offset, gStopPrice);
      box.set_rightbottom(priceBox, i + offset + 8,
        L ? (gt(trailingStop, gTpPrice[3]) ? trailingStop : gTpPrice[3]) : (lt(trailingStop, gTpPrice[3]) ? trailingStop : gTpPrice[3]));
      box.set_bgcolor(priceBox, tc.c97);

      if (boxes.length > 0) {
        // Trade Tracking box overlayed onto price.
        box.set_rightbottom(boxes[1], i, failed ? gStopPrice : stopHit ? gStopPrice : trailingStopHit ? trailingStop : cl);
        box.set_top(boxes[1], gEntryPrice);
        // Trade potential box overlayed onto price in lighter shade.
        box.set_rightbottom(boxes[0], i, L ? (gt(minReached, gStopPrice) ? minReached : gStopPrice) : (lt(minReached, gStopPrice) ? minReached : gStopPrice));
        box.set_top(boxes[0], maxReached);
      }

      s.inTradeBarCount = gInTradeBarCount + 1;
    } else {
      for (const c of [ENTRY, SL, 2, 3, 4, 5]) {
        line.set_xy1(lines[c], NaN, NaN);
        label.set_x(labels[c], NaN);
      }
      // gTSL_Line / gTSL_Label: the SL line and label again
      line.set_xy1(gSlLine, NaN, NaN);
      label.set_x(gSlLabel, NaN);
      s.maxReached = L ? lo : hi;
      s.minReached = L ? hi : lo;
      s.inTradeBarCount = 0;
      box.set_bgcolor(priceBox, tc.c100);
      if (boxes.length > 0) {
        box.set_bgcolor(boxes[1], (L && lt(gExitPrice, gEntryPrice)) ? pink90 : (!L && gt(gExitPrice, gEntryPrice)) ? pink90 : tc.c90);
      }
    }

    // TRADE CALCULATIONS
    const gNumberOfWins = s.numberOfWins;
    const gNumberOfLosses = s.numberOfLosses;
    const gLossPercent = s.lossPercent; // value of the bar before: read before it is set below
    const gWinRRSum = s.winRRSum;
    const gLossRRSum = s.lossRRSum;
    const gEntryCount = s.entryCount;
    const gFailHitCount = s.failHitCount;
    const gFailBarsCount = s.failBarsCount;
    const gTpHitCount = s.tpHitCount.slice();
    const gTslHitCount = s.tslHitCount;
    gInTradeBarCount = s.inTradeBarCount;

    s.winPercent = gNumberOfWins / gEntryCount;
    s.lossPercent = gNumberOfLosses / gEntryCount;
    const gWinPercent = s.winPercent;
    const rrtWinPercent = math.round(gWinPercent * 100);
    s.avgWinRR = gWinRRSum / gNumberOfWins;
    s.avgLossRR = gLossRRSum / gNumberOfLosses;
    s.avgRiskReward = gWinPercent * s.avgWinRR - gLossPercent * s.avgLossRR;
    const rrtArrr = math.round(s.avgRiskReward, 2);

    s.rrtFailPct = math.round(gFailHitCount / gEntryCount * 100);
    for (let j = 0; j < 4; j++) s.rrtTpPct[j] = math.round(gTpHitCount[j] / gEntryCount * 100);
    s.rrtTslPct = math.round(gTslHitCount / gEntryCount * 100);
    s.rrtAvgFailBars = math.round(gFailBarsCount / gFailHitCount);
    for (let j = 0; j < 4; j++) s.rrtAvgTpBars[j] = math.round(s.tpBarsCount[j] / gTpHitCount[j]);
    s.rrtAvgTslBars = math.round(s.tslBarsCount / gTslHitCount);

    const S = (x: number) => str.tostring(x);
    // Each call writes the header and the whole row of its trade type (or clears the row), so the tables show what
    // the last bar writes: the cells of the earlier bars are replaced and need not be built
    const lastBar = i === n - 1;

    if (cfg.rrtActivated && rrTable && lastBar) {
      const tb = rrTable;
      const size = cfg.rrtTextSize;
      const cell = (c: number, r: number, text: string, textColor: string, bg: string, tooltip: string, halign: 'left' | 'center' = 'center') =>
        table.cell(tb, c, r, text, 0, 0, textColor, halign, 'center', size, bg, tooltip);
      // COLUMN LABELS
      cell(1, 0, '#', C_LIGHT_GRAY, C_TV_BLACK, '');
      cell(2, 0, 'Fail', C_BLACK, C_PINK, 'Fail means that this strategy failed to hit at least TP 1 before being stopped out.');
      cell(5, 0, 'TP 1', C_BLACK, col(C_LIME_GREEN, 15), 'Price crossed above/below TP 1');
      cell(8, 0, 'TP 2', C_BLACK, col(C_LIME_GREEN, 30), 'Price crossed above/below TP 2');
      cell(11, 0, 'TP 3', C_BLACK, col(C_LIME_GREEN, 15), 'Price crossed above/below TP 3');
      cell(14, 0, 'TP 4', C_BLACK, col(C_LIME_GREEN, 30), 'Price crossed above/below TP 4');
      cell(17, 0, 'TSL', C_BLACK, C_BLUE, 'Price crossed above/below the Trailing Stop Loss (TSL)');
      cell(20, 0, '▲', C_LIME_GREEN, col(C_LIME_GREEN, 92), 'Bullish condition Triangle Signal');
      cell(22, 0, '▼', C_PINK, col(C_PINK, 92), 'Bearish condition Triangle Signal');
      cell(24, 0, 'Win %', C_LIGHT_GRAY, C_TV_BLACK, WIN_TOOLTIP);
      cell(25, 0, 'ARRR', C_LIGHT_GRAY, C_TV_BLACK, ARRR_TOOLTIP_HEADER);

      const r = t + 1;
      const tpBg = [col(C_LIME_GREEN, 15), col(C_LIME_GREEN, 30), col(C_LIME_GREEN, 15), col(C_LIME_GREEN, 30)];
      cell(0, r, entryText, C_BLACK, tc.c0, 'Enter Trade criteria or other useful info here', 'left');
      cell(1, r, S(gEntryCount), C_LIGHT_GRAY, col(C_TV_BLACK, 0), '# of entries of this trade type');
      cell(2, r, S(gFailHitCount), C_BLACK, col(C_PINK, 30), '# total hit of this trade type');
      cell(3, r, `${S(s.rrtFailPct)}%`, C_BLACK, col(C_PINK, 30), '% of trades it occured on of this trade type');
      cell(4, r, S(s.rrtAvgFailBars), C_BLACK, col(C_PINK, 30), 'Avg age when it occured on this trade type');
      for (let j = 0; j < 4; j++) {
        const c = 5 + 3 * j;
        cell(c, r, S(gTpHitCount[j]), C_BLACK, tpBg[j], '# total hit of this trade type');
        cell(c + 1, r, `${S(s.rrtTpPct[j])}%`, C_BLACK, tpBg[j], '% of trades it occured on of this trade type');
        cell(c + 2, r, S(s.rrtAvgTpBars[j]), C_BLACK, tpBg[j], 'Avg age when it occured on this trade type');
      }
      const blue15 = col(C_BLUE, 15);
      cell(17, r, S(gTslHitCount), C_BLACK, blue15, '# total hit of this trade type');
      cell(18, r, S(s.rrtAvgTslBars), C_BLACK, blue15, 'Avg age when it occured on this trade type');
      cell(19, r, S(math.round(s.avgWinRR, 2)), C_BLACK, blue15,
        'Since the TSL is not active until its over your Entry price it can be counted as a winning trade. This number represents the Avg Risk:Reward Ratio for trades of this type that hit your TSL.');
      cell(20, r, S(s.bullishHitCount), C_LIGHT_GRAY, col(C_LIME_GREEN, 95), '- # total hit of this trade type');
      cell(21, r, S(math.round(s.avgBullishRR, 2)), C_LIGHT_GRAY, col(C_LIME_GREEN, 95),
        'Risk:Reward Ratio of where the Avg Green Arrow occurs in relation to either the min-reached price when occuring below (above for Short) the Entry Price or the Trailing Stop when occuring above (below for Short)');
      cell(22, r, S(s.bearishHitCount), C_LIGHT_GRAY, col(C_PINK, 95), '- # total hit of this trade type');
      cell(23, r, S(math.round(s.avgBearishRR, 2)), C_LIGHT_GRAY, col(C_PINK, 95),
        'Risk:Reward Ratio of where the Avg Red Arrow occurs in relation to either the max-reached price when occuring above (below for Long) the Entry Price or the Trailing Stop when occuring below (above for Long)');
      cell(24, r, `${S(rrtWinPercent)}%`, C_BLACK, tradeColor, WIN_TOOLTIP);
      cell(25, r, S(rrtArrr), C_BLACK, tradeColor, ARRR_TOOLTIP_ROW);

      // The original merges the header cells again on every call; a second merge of the same cells changes
      // nothing in Pine, but oakscriptjs keeps every call in `merges` (one entry per call): merge them once.
      if (!headerMerged) {
        headerMerged = true;
        table.merge_cells(tb, 2, 0, 4, 0); // Fail
        table.merge_cells(tb, 5, 0, 7, 0); // TP1
        table.merge_cells(tb, 8, 0, 10, 0); // TP2
        table.merge_cells(tb, 11, 0, 13, 0); // TP3
        table.merge_cells(tb, 14, 0, 16, 0); // TP4
        table.merge_cells(tb, 17, 0, 19, 0); // TSL
        table.merge_cells(tb, 20, 0, 21, 0); // Bullish
        table.merge_cells(tb, 22, 0, 23, 0); // Bearish
      }
    }

    if (cfg.tttActivated && ttTable && lastBar) {
      const tb = ttTable;
      const size = cfg.tttTextSize;
      const cell = (c: number, r: number, text: string, textColor: string, bg: string, tooltip?: string, halign: 'left' | 'center' = 'center') =>
        table.cell(tb, c, r, text, 0, 0, textColor, halign, 'center', size, bg, tooltip);
      // COLUMN LABELS
      cell(0, 0, 'Trade Name', C_LIGHT_GRAY, C_TV_BLACK);
      cell(1, 0, 'Side', C_LIGHT_GRAY, C_TV_BLACK, 'Side of Trade, Long is Green and Short is Red by default');
      cell(2, 0, 'Entry', C_LIGHT_GRAY, C_TV_BLACK);
      cell(3, 0, 'Stop', C_BLACK, C_MEDIUM_GRAY, "Color brightens as the trade gets closer to the Entry Stop's Avg age in RRT");
      cell(4, 0, 'TP 1', C_BLACK, C_MEDIUM_GRAY, "Color brightens as the trade gets closer to TP1's Avg age in RRT");
      cell(5, 0, 'TP 2', C_BLACK, C_MEDIUM_GRAY, "Color brightens as the trade gets closer to TP2's Avg age in RRT");
      cell(6, 0, 'TP 3', C_BLACK, C_MEDIUM_GRAY, "Color brightens as the trade gets closer to TP3's Avg age in RRT");
      cell(7, 0, 'TP 4', C_BLACK, C_MEDIUM_GRAY, "Color brightens as the trade gets closer to TP4's Avg age in RRT");
      cell(8, 0, 'TSL', C_BLACK, C_MEDIUM_GRAY, "Color brightens as the trade gets closer to TSL's Avg age in RRT");
      cell(9, 0, 'Age', C_LIGHT_GRAY, C_TV_BLACK, 'Age (# of bars) of this specific trade');

      const r = t + 1;
      if (gActive) {
        const tick = (x: number) => S(math.round_to_mintick(x, mintick));
        const mark = (price: number) => ((L ? gt(cl, price) : lt(cl, price)) ? `☑️${tick(price)}` : tick(price));
        // f_gradientColor(tradeColor, age, avg bars, 0)
        const grad = (max: number) => color.from_gradient(gInTradeBarCount, 0, max, tc.c80, tc.c0);
        cell(0, r, entryText, C_BLACK, tradeColor, undefined, 'left');
        cell(1, r, L ? 'Long' : 'Short', C_BLACK, L ? C_LIME_GREEN : C_PINK, 'Side of Trade, Long is Green and Short is Red by default');
        cell(2, r, mark(gEntryPrice), C_BLACK, tradeColor);
        cell(3, r, tick(gStopPrice), C_BLACK, grad(s.rrtAvgFailBars), "Color brightens as the trade gets closer to the inital Stop's Avg age in RRT");
        for (let j = 0; j < 4; j++) {
          cell(4 + j, r, mark(gTpPrice[j]), C_BLACK, grad(s.rrtAvgTpBars[j]), `Color brightens as the trade gets closer to TP${j + 1}'s Avg age in RRT`);
        }
        cell(8, r, tick(trailingStop), C_BLACK, grad(s.rrtAvgTslBars), "Color brightens as the trade gets closer to TSL's Avg age in RRT");
        cell(9, r, S(gInTradeBarCount), C_BLACK, tradeColor, 'Age (# of bars) of this specific trade');
      } else {
        table.clear(tb, 0, r, 9, r);
      }
    }
  }

  const plots: IndicatorResult['plots'] = {};
  plotArr.forEach((p, t) => { plots[`plot${t}`] = p; });
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    ...drawingOutputs(bars),
  };
}

const WIN_TOOLTIP = "Winning % of this trade type.\n\n* Of Note - If a trade does not FAIL, but still hits the STOP, it was more than likely due to a large price move occuring after entry, which caused you to hit TP1, but not have the TSL rise above your entry price, and then price reversing to hit your STOP. This does not happen very often and your R:R calculations do account for it, however it is important to note if you notice what looks like a small discrepancy in your Win % and/or Fail %...this explains why because it is still a losing trade when this occurs but is not considered a FAIL due to hitting at least 1 profit taking scenario (TP1).";
const ARRR_TOOLTIP_HEADER = "ARRR - Average Risk:Reward Return of this trade type shown as a multiple of Risk, where a losing trade's risk ratio always equals -1 based on the design of this system.\n\nReturns greater than 1.0 are generally winning systems and less than 1 is a generally losing. For example, if the ARRR was .75, you would expect to only win .75 times (or 75%) the amount you risked on each trade. This is more accurate than profit factor, in my opinion, due to the influence of win/loss percentage and the size of those wins/losses.\n\nFormula:\n\nARRR = (Win % * Avg Winning Trade's R:R Ratio) - (Loss % * Avg Losing Trade's R:R Ratio)";
const ARRR_TOOLTIP_ROW = "ARRR - Average Risk:Reward Return of this trade type shown as a multiple of Risk, where a losing trade's risk always equals -1 based on the design of this system.\n\nReturns greater than 1.0 are generally winning systems and less than 1 is a generally losing. For example, if the ARRR was .75, you would expect to only win .75 times (or 75%) the amount you risked on each trade. This is more accurate than profit factor, in my opinion, due to the influence of win/loss percentage and the size of those wins/losses.\n\nFormula:\n\nARRR = (Win % * Avg Winning Trade's R:R Ratio) - (Loss % * Avg Losing Trade's R:R Ratio)";

export const RRTradingSystemFramework = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
