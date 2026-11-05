/**
 * Signal Forge [LuxAlgo]
 *
 * Combines up to eleven classic indicators into one long / short signal and backtests it on the chart bars.
 * Each indicator gives a bullish and a bearish state: SMA crossover (fast above / below slow), RSI (above / below a
 * level), MACD (line above / below signal), Supertrend direction, Stochastic %K (above / below 50), Bollinger Bands
 * (close above / below the middle band), EMA crossover, Awesome Oscillator (above / below 0), Parabolic SAR (close
 * above / below), CCI (above / below a level) and ADX (above the threshold with +DI above / below -DI).
 * The long condition is that all enabled indicators are bullish ("Require All") or that any of them is; the short
 * condition is the same with the bearish states.
 *
 * A trade opens on the bar where its condition becomes true and closes on the opposite condition, or at an optional
 * stop loss, take profit or trailing stop placed at a multiple of the ATR from the entry close. The same trade model
 * runs for each indicator alone, which gives its standalone win rate.
 *
 * Drawings: at each entry a vertical line from the bar low (long) or high (short) to an orb "Orb Distance" ATR away
 * (three circles of decreasing size) and a label with the win rate so far; a cross where a trade closes without an
 * immediate reversal; the stop loss, take profit and trailing stop of the open trade, with a gradient fill between
 * the trailing stop and the close; and two tables on the last bar: the state, standalone win rate and enabled flag
 * of each indicator with the current signal, and the backtest results (trades, wins, losses, win rate, profit
 * factor, sum of the returns in %). At most 500 lines and 500 labels are kept.
 *
 * The label text colour is the chart foreground colour (chart context; #DBDBDB without one). The circle widths
 * follow "Orb Base Size" in the original; the plot configuration has the widths of the default size.
 *
 * Reference: "Signal Forge [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, str, color, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData, MarkerData, PineSize, TableCellData, TableData, TableMergeData, TablePosition } from '../types';
import { foregroundColorOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type Corner = 'Top Right' | 'Bottom Right' | 'Bottom Left';

export interface SignalForgeInputs {
  /** All enabled indicators must agree (true) or any of them is enough (false) */
  requireAll: boolean;
  atrLen: number;
  enableTp: boolean;
  tpMult: number;
  enableSl: boolean;
  slMult: number;
  enableTs: boolean;
  tsMult: number;
  /** Distance of the entry orb from the bar, in ATR */
  orbDist: number;
  orbSize: number;
  enableSma: boolean;
  smaFastLen: number;
  smaSlowLen: number;
  enableRsi: boolean;
  rsiLen: number;
  rsiLongLevel: number;
  rsiShortLevel: number;
  enableMacd: boolean;
  macdFastLen: number;
  macdSlowLen: number;
  macdSignalLen: number;
  enableSt: boolean;
  stFactor: number;
  stLen: number;
  enableStoch: boolean;
  stochK: number;
  stochD: number;
  stochSmooth: number;
  enableBb: boolean;
  bbLen: number;
  bbMult: number;
  enableEma: boolean;
  emaFastLen: number;
  emaSlowLen: number;
  enableAo: boolean;
  enableSar: boolean;
  sarStart: number;
  sarInc: number;
  sarMax: number;
  enableCci: boolean;
  cciLen: number;
  cciLongLevel: number;
  cciShortLevel: number;
  enableAdx: boolean;
  adxLen: number;
  diLen: number;
  adxThreshold: number;
  dashboard: boolean;
  dashboardPosition: Corner;
  perfDashboardPosition: Corner;
  dashboardSize: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
}

export const defaultInputs: SignalForgeInputs = {
  requireAll: true,
  atrLen: 14,
  enableTp: false,
  tpMult: 2.0,
  enableSl: false,
  slMult: 1.5,
  enableTs: false,
  tsMult: 1.0,
  orbDist: 1.5,
  orbSize: 10,
  enableSma: true,
  smaFastLen: 10,
  smaSlowLen: 20,
  enableRsi: false,
  rsiLen: 14,
  rsiLongLevel: 50,
  rsiShortLevel: 50,
  enableMacd: false,
  macdFastLen: 12,
  macdSlowLen: 26,
  macdSignalLen: 9,
  enableSt: false,
  stFactor: 3.0,
  stLen: 10,
  enableStoch: false,
  stochK: 14,
  stochD: 3,
  stochSmooth: 3,
  enableBb: false,
  bbLen: 20,
  bbMult: 2.0,
  enableEma: false,
  emaFastLen: 10,
  emaSlowLen: 20,
  enableAo: false,
  enableSar: false,
  sarStart: 0.02,
  sarInc: 0.02,
  sarMax: 0.2,
  enableCci: false,
  cciLen: 20,
  cciLongLevel: 0,
  cciShortLevel: 0,
  enableAdx: false,
  adxLen: 14,
  diLen: 14,
  adxThreshold: 20,
  dashboard: true,
  dashboardPosition: 'Top Right',
  perfDashboardPosition: 'Bottom Right',
  dashboardSize: 'Normal',
};

const G_LOGIC = 'Signal Logic';
const G_RISK = 'Risk Management (ATR)';
const G_VISUALS = 'Visuals';
const G_SMA = 'SMA Crossover';
const G_RSI = 'RSI Filter';
const G_MACD = 'MACD Crossover';
const G_ST = 'Supertrend';
const G_STOCH = 'Stochastic';
const G_BB = 'Bollinger Bands';
const G_EMA = 'EMA Crossover';
const G_AO = 'Awesome Oscillator';
const G_SAR = 'Parabolic SAR';
const G_CCI = 'CCI Filter';
const G_ADX = 'ADX Filter';
const G_DASH = 'Dashboard';
const CORNERS = ['Top Right', 'Bottom Right', 'Bottom Left'];

export const inputConfig: InputConfig[] = [
  {
    id: 'requireAll', type: 'bool', title: 'Require All Enabled Indicators to Align', defval: true, group: G_LOGIC,
    tooltip: 'If enabled, ALL checked indicators must agree to generate a signal. If disabled, ANY checked indicator can generate a signal.',
  },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, group: G_RISK },
  { id: 'enableTp', type: 'bool', title: 'Take Profit', defval: false, inline: 'tp', group: G_RISK },
  { id: 'tpMult', type: 'float', title: 'Multiplier', defval: 2.0, step: 0.1, inline: 'tp', group: G_RISK },
  { id: 'enableSl', type: 'bool', title: 'Stop Loss', defval: false, inline: 'sl', group: G_RISK },
  { id: 'slMult', type: 'float', title: 'Multiplier', defval: 1.5, step: 0.1, inline: 'sl', group: G_RISK },
  { id: 'enableTs', type: 'bool', title: 'Trailing Stop', defval: false, inline: 'ts', group: G_RISK },
  { id: 'tsMult', type: 'float', title: 'Multiplier', defval: 1.0, step: 0.1, inline: 'ts', group: G_RISK },
  { id: 'orbDist', type: 'float', title: 'Orb Distance (ATR)', defval: 1.5, step: 0.1, group: G_VISUALS },
  { id: 'orbSize', type: 'int', title: 'Orb Base Size', defval: 10, min: 3, max: 20, group: G_VISUALS },
  { id: 'enableSma', type: 'bool', title: 'Enable SMA Crossover', defval: true, group: G_SMA },
  { id: 'smaFastLen', type: 'int', title: 'Fast Length', defval: 10, min: 1, group: G_SMA },
  { id: 'smaSlowLen', type: 'int', title: 'Slow Length', defval: 20, min: 1, group: G_SMA },
  { id: 'enableRsi', type: 'bool', title: 'Enable RSI Filter', defval: false, group: G_RSI },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1, group: G_RSI },
  { id: 'rsiLongLevel', type: 'float', title: 'Long Above', defval: 50, group: G_RSI },
  { id: 'rsiShortLevel', type: 'float', title: 'Short Below', defval: 50, group: G_RSI },
  { id: 'enableMacd', type: 'bool', title: 'Enable MACD Crossover', defval: false, group: G_MACD },
  { id: 'macdFastLen', type: 'int', title: 'Fast Length', defval: 12, min: 1, group: G_MACD },
  { id: 'macdSlowLen', type: 'int', title: 'Slow Length', defval: 26, min: 1, group: G_MACD },
  { id: 'macdSignalLen', type: 'int', title: 'Signal Length', defval: 9, min: 1, group: G_MACD },
  { id: 'enableSt', type: 'bool', title: 'Enable Supertrend', defval: false, group: G_ST },
  { id: 'stFactor', type: 'float', title: 'Factor', defval: 3.0, min: 0.1, step: 0.1, group: G_ST },
  { id: 'stLen', type: 'int', title: 'Length', defval: 10, min: 1, group: G_ST },
  { id: 'enableStoch', type: 'bool', title: 'Enable Stochastic', defval: false, group: G_STOCH },
  { id: 'stochK', type: 'int', title: 'K Length', defval: 14, min: 1, group: G_STOCH },
  { id: 'stochD', type: 'int', title: 'D Length', defval: 3, min: 1, group: G_STOCH },
  { id: 'stochSmooth', type: 'int', title: 'Smooth', defval: 3, min: 1, group: G_STOCH },
  {
    id: 'enableBb', type: 'bool', title: 'Enable BB Trend', defval: false, group: G_BB,
    tooltip: 'Looks for price trading in the upper/lower half of the bands.',
  },
  { id: 'bbLen', type: 'int', title: 'Length', defval: 20, min: 1, group: G_BB },
  { id: 'bbMult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1, group: G_BB },
  { id: 'enableEma', type: 'bool', title: 'Enable EMA Crossover', defval: false, group: G_EMA },
  { id: 'emaFastLen', type: 'int', title: 'Fast Length', defval: 10, min: 1, group: G_EMA },
  { id: 'emaSlowLen', type: 'int', title: 'Slow Length', defval: 20, min: 1, group: G_EMA },
  { id: 'enableAo', type: 'bool', title: 'Enable AO', defval: false, group: G_AO },
  { id: 'enableSar', type: 'bool', title: 'Enable Parabolic SAR', defval: false, group: G_SAR },
  { id: 'sarStart', type: 'float', title: 'Start', defval: 0.02, step: 0.01, group: G_SAR },
  { id: 'sarInc', type: 'float', title: 'Increment', defval: 0.02, step: 0.01, group: G_SAR },
  { id: 'sarMax', type: 'float', title: 'Max Value', defval: 0.2, step: 0.1, group: G_SAR },
  { id: 'enableCci', type: 'bool', title: 'Enable CCI Filter', defval: false, group: G_CCI },
  { id: 'cciLen', type: 'int', title: 'Length', defval: 20, min: 1, group: G_CCI },
  { id: 'cciLongLevel', type: 'float', title: 'Long Above', defval: 0, group: G_CCI },
  { id: 'cciShortLevel', type: 'float', title: 'Short Below', defval: 0, group: G_CCI },
  { id: 'enableAdx', type: 'bool', title: 'Enable ADX Filter', defval: false, group: G_ADX },
  { id: 'adxLen', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1, group: G_ADX },
  { id: 'diLen', type: 'int', title: 'DI Length', defval: 14, min: 1, group: G_ADX },
  { id: 'adxThreshold', type: 'float', title: 'ADX Threshold', defval: 20, group: G_ADX },
  { id: 'dashboard', type: 'bool', title: 'Dashboards', defval: true, group: G_DASH, tooltip: 'Enable or disable the dashboards.' },
  { id: 'dashboardPosition', type: 'string', title: 'Indicator Dashboard Position', defval: 'Top Right', options: CORNERS, group: G_DASH },
  { id: 'perfDashboardPosition', type: 'string', title: 'Performance Dashboard Position', defval: 'Bottom Right', options: CORNERS, group: G_DASH },
  {
    id: 'dashboardSize', type: 'string', title: 'Size', defval: 'Normal', options: ['Tiny', 'Small', 'Normal', 'Large', 'Huge'], group: G_DASH,
    tooltip: 'Select the dashboard size.',
  },
];

const GREEN = '#089981';
const RED = '#f23645';
const BLUE = '#2962ff';
const C = (c: string, transp: number) => String(color.new(c, transp));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Glow 1', color: C(GREEN, 80), lineWidth: 10, style: 'circles' },
  { id: 'plot1', title: 'Long Glow 2', color: C(GREEN, 50), lineWidth: 7, style: 'circles' },
  { id: 'plot2', title: 'Long Glow 3', color: C(GREEN, 0), lineWidth: 4, style: 'circles' },
  { id: 'plot3', title: 'Short Glow 1', color: C(RED, 80), lineWidth: 10, style: 'circles' },
  { id: 'plot4', title: 'Short Glow 2', color: C(RED, 50), lineWidth: 7, style: 'circles' },
  { id: 'plot5', title: 'Short Glow 3', color: C(RED, 0), lineWidth: 4, style: 'circles' },
  { id: 'plot6', title: 'Stop Loss', color: C(RED, 0), lineWidth: 1, style: 'linebr' },
  { id: 'plot7', title: 'Take Profit', color: C(GREEN, 0), lineWidth: 1, style: 'linebr' },
  { id: 'plot8', title: 'Trailing Stop', color: C(BLUE, 0), lineWidth: 2, style: 'linebr' },
  { id: 'plot9', title: 'Price for TS', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Signal Forge [LuxAlgo]',
  shortTitle: 'LuxAlgo - Signal Forge',
  overlay: true,
};

/** indicator(max_labels_count = 500, max_lines_count = 500) */
const MAX_OBJECTS = 500;

// Dashboard colours
const DATA = '#DBDBDB';
const HEADERS = '#808080';
const BACKGROUND = '#161616';
const BORDERS = '#2E2E2E';
const ROW_DIVIDER = '━━━━━━━━━━━━━━';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);

const cornerOf = (s: string): TablePosition => (s === 'Bottom Right' ? 'bottom_right' : s === 'Bottom Left' ? 'bottom_left' : 'top_right');

/** One trade model: the combined signal or one indicator alone */
interface Model {
  state: number;
  entry: number;
  sl: number;
  tp: number;
  ts: number;
  total: number;
  wins: number;
}

const newModel = (): Model => ({ state: 0, entry: NaN, sl: NaN, tp: NaN, ts: NaN, total: 0, wins: 0 });

interface Ln {
  x: number;
  y1: number;
  y2: number;
  color: string;
  width: number;
}
interface Lb {
  x: number;
  y: number;
  text: string;
  style: 'label_up' | 'label_down';
}

type Result = IndicatorResult & { markers: MarkerData[]; lines: LineDrawingData[]; labels: LabelData[]; tables: TableData[] };
type Point = { time: number; value: number; color?: string };

/**
 * `ta.sar(start, inc, max)` one bar at a time, with the operations of the oakscriptjs function (same doubles): the
 * state of the last committed bar, the state of the bar stepped last kept until commit.
 */
class SarStep {
  private sarValue = NaN;
  private extremePoint = NaN;
  private acceleration: number;
  private isUpTrend = false;
  private next: { sarValue: number; extremePoint: number; acceleration: number; isUpTrend: boolean } | null = null;

  constructor(private readonly start: number, private readonly inc: number, private readonly max: number) {
    this.acceleration = start;
  }

  step(bars: Bar[], i: number): number {
    this.next = null;
    if (i === 0) return NaN;
    const { start, inc, max } = this;
    const high = bars[i].high;
    const low = bars[i].low;
    let { sarValue, extremePoint, acceleration, isUpTrend } = this;
    let isFirstTrendBar = false;

    if (i === 1) {
      if (bars[i].close > bars[i - 1].close) {
        isUpTrend = true;
        extremePoint = high;
        sarValue = bars[i - 1].low;
      } else {
        isUpTrend = false;
        extremePoint = low;
        sarValue = bars[i - 1].high;
      }
      isFirstTrendBar = true;
      acceleration = start;
    }

    sarValue = sarValue + acceleration * (extremePoint - sarValue);

    if (isUpTrend) {
      if (sarValue > low) {
        isFirstTrendBar = true;
        isUpTrend = false;
        sarValue = Math.max(high, extremePoint);
        extremePoint = low;
        acceleration = start;
      }
    } else {
      if (sarValue < high) {
        isFirstTrendBar = true;
        isUpTrend = true;
        sarValue = Math.min(low, extremePoint);
        extremePoint = high;
        acceleration = start;
      }
    }

    if (!isFirstTrendBar) {
      if (isUpTrend) {
        if (high > extremePoint) {
          extremePoint = high;
          acceleration = Math.min(acceleration + inc, max);
        }
      } else {
        if (low < extremePoint) {
          extremePoint = low;
          acceleration = Math.min(acceleration + inc, max);
        }
      }
    }

    if (isUpTrend) {
      sarValue = Math.min(sarValue, bars[i - 1].low);
      if (i > 1) {
        sarValue = Math.min(sarValue, bars[i - 2].low);
      }
    } else {
      sarValue = Math.max(sarValue, bars[i - 1].high);
      if (i > 1) {
        sarValue = Math.max(sarValue, bars[i - 2].high);
      }
    }

    this.next = { sarValue, extremePoint, acceleration, isUpTrend };
    return sarValue;
  }

  commit(): void {
    if (this.next) Object.assign(this, this.next);
    this.next = null;
  }
}

interface SignalForgeVars {
  /** Trade models (changed in place: copied by copyVars) */
  ind: Model[];
  prevBull: boolean[];
  prevBear: boolean[];
  main: Model;
  netProfitPct: number;
  grossProfit: number;
  grossLoss: number;
  prevLong: boolean;
  prevShort: boolean;
  /** The states of the bar (replaced on each bar) */
  bullArr: boolean[];
  bearArr: boolean[];
  longCond: boolean;
  shortCond: boolean;
}

interface SignalForgeRun extends BarRunState<SignalForgeVars> {
  smaFastStep: ReturnType<typeof taStep.sma>;
  smaSlowStep: ReturnType<typeof taStep.sma>;
  rsiStep: ReturnType<typeof taStep.rsi>;
  macdStep: ReturnType<typeof taStep.macd>;
  stStep: ReturnType<typeof taStep.supertrend>;
  stochStep: ReturnType<typeof taStep.stoch>;
  kStep: ReturnType<typeof taStep.sma>;
  bbStep: ReturnType<typeof taStep.bb>;
  emaFastStep: ReturnType<typeof taStep.ema>;
  emaSlowStep: ReturnType<typeof taStep.ema>;
  ao5Step: ReturnType<typeof taStep.sma>;
  ao34Step: ReturnType<typeof taStep.sma>;
  sarStep: SarStep;
  cciStep: ReturnType<typeof taStep.cci>;
  dmiStep: ReturnType<typeof taStep.dmi>;
  atrStep: ReturnType<typeof taStep.atr>;
  glow: Point[][];
  slPlot: Point[];
  tpPlot: Point[];
  tsPlot: Point[];
  pricePlot: Point[];
  tsTopVal: number[];
  tsBotVal: number[];
  tsTopCol: Array<string | null>;
  tsBotCol: Array<string | null>;
  markers: MarkerData[];
  /** Every line and label created (the limit of the object count is applied in the result) */
  lineList: Ln[];
  labelList: Lb[];
}

/**
 * The objects kept of `count` created one at a time when each creation that brings the count above max + 5 deletes
 * the oldest until max remain: the newest of them
 */
const keptCount = (count: number): number => (count <= MAX_OBJECTS + 5 ? count : MAX_OBJECTS + ((count - MAX_OBJECTS) % 6));

function study(inputs: Partial<SignalForgeInputs>): BarStudy<SignalForgeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  const enabled = [
    cfg.enableSma, cfg.enableRsi, cfg.enableMacd, cfg.enableSt, cfg.enableStoch, cfg.enableBb,
    cfg.enableEma, cfg.enableAo, cfg.enableSar, cfg.enableCci, cfg.enableAdx,
  ];
  const anyEnabled = enabled.some((e) => e);

  /** Exit test of an open trade: stop loss, take profit, trailing stop, then the opposite state. Returns the exit price, na when the trade stays open. */
  const exitPrice = (m: Model, side: number, bar: Bar, opposite: boolean): number => {
    const { high, low, close } = bar;
    if (side === 1) {
      if (cfg.enableSl && le(low, m.sl)) return m.sl;
      if (cfg.enableTp && ge(high, m.tp)) return m.tp;
      if (cfg.enableTs && le(low, m.ts)) return m.ts;
      return opposite ? close : NaN;
    }
    if (cfg.enableSl && ge(high, m.sl)) return m.sl;
    if (cfg.enableTp && le(low, m.tp)) return m.tp;
    if (cfg.enableTs && ge(high, m.ts)) return m.ts;
    return opposite ? close : NaN;
  };
  const enter = (m: Model, side: number, c: number, atr: number): void => {
    m.state = side;
    m.entry = c;
    if (cfg.enableSl) m.sl = c - side * (atr * cfg.slMult);
    if (cfg.enableTp) m.tp = c + side * (atr * cfg.tpMult);
    if (cfg.enableTs) m.ts = c - side * (atr * cfg.tsMult);
  };
  /** Pine math.max / math.min: na when a value is na */
  const trail = (m: Model, side: number, c: number, atr: number): void => {
    m.ts = side === 1 ? Math.max(m.ts, c - atr * cfg.tsMult) : Math.min(m.ts, c + atr * cfg.tsMult);
  };

  const SL_COLOR = C(RED, 0);
  const TP_COLOR = C(GREEN, 0);
  const TS_SHOWN = C(BLUE, 70);
  const TS_HIDDEN = C(BLUE, 100);
  const LONG_LINE = [C(GREEN, 80), C(GREEN, 40)];
  const SHORT_LINE = [C(RED, 80), C(RED, 40)];

  return {
    init() {
      const s: SignalForgeRun = {
        // ── Indicators ──
        smaFastStep: taStep.sma(), smaSlowStep: taStep.sma(), rsiStep: taStep.rsi(cfg.rsiLen),
        macdStep: taStep.macd(cfg.macdFastLen, cfg.macdSlowLen, cfg.macdSignalLen),
        stStep: taStep.supertrend(cfg.stFactor, cfg.stLen), stochStep: taStep.stoch(cfg.stochK), kStep: taStep.sma(),
        bbStep: taStep.bb(cfg.bbLen, cfg.bbMult), emaFastStep: taStep.ema(cfg.emaFastLen),
        emaSlowStep: taStep.ema(cfg.emaSlowLen), ao5Step: taStep.sma(), ao34Step: taStep.sma(),
        sarStep: new SarStep(cfg.sarStart, cfg.sarInc, cfg.sarMax), cciStep: taStep.cci(cfg.cciLen),
        dmiStep: taStep.dmi(cfg.diLen, cfg.adxLen), atrStep: taStep.atr(cfg.atrLen),
        // ── Outputs ──
        glow: Array.from({ length: 6 }, () => []), slPlot: [], tpPlot: [], tsPlot: [], pricePlot: [], tsTopVal: [],
        tsBotVal: [], tsTopCol: [], tsBotCol: [], markers: [], lineList: [], labelList: [],
        steps: [],
        vars: {
          ind: Array.from({ length: 11 }, newModel), prevBull: new Array(11).fill(false),
          prevBear: new Array(11).fill(false), main: newModel(), netProfitPct: 0.0, grossProfit: 0.0, grossLoss: 0.0,
          prevLong: false, prevShort: false, bullArr: new Array(11).fill(false), bearArr: new Array(11).fill(false),
          longCond: false, shortCond: false,
        },
        lists: [], series: [],
      };
      s.steps = [
        s.smaFastStep, s.smaSlowStep, s.rsiStep, s.macdStep, s.stStep, s.stochStep, s.kStep, s.bbStep, s.emaFastStep,
        s.emaSlowStep, s.ao5Step, s.ao34Step, s.sarStep, s.cciStep, s.dmiStep, s.atrStep,
      ];
      s.lists = [s.markers, s.lineList, s.labelList];
      s.series = [
        ...s.glow, s.slPlot, s.tpPlot, s.tsPlot, s.pricePlot, s.tsTopVal, s.tsBotVal, s.tsTopCol, s.tsBotCol,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { ind, prevBull, prevBear, main } = v;
      const b = bars[i];
      const { high, low, close } = b;
      const time = b.time;
      const hl2 = (high + low) / 2;

      // ── Indicators ──
      const smaFast = s.smaFastStep.step(close, cfg.smaFastLen) ?? NaN;
      const smaSlow = s.smaSlowStep.step(close, cfg.smaSlowLen) ?? NaN;
      const rsi = s.rsiStep.step(close) ?? NaN;
      const [macdLine, signalLine] = s.macdStep.step(close);
      const stDir = s.stStep.step(high, low, close)[1] ?? NaN;
      const k = s.kStep.step(s.stochStep.step(close, high, low) ?? NaN, cfg.stochSmooth) ?? NaN;
      const bbMiddle = s.bbStep.step(close)[0] ?? NaN;
      const emaFast = s.emaFastStep.step(close) ?? NaN;
      const emaSlow = s.emaSlowStep.step(close) ?? NaN;
      const ao = (s.ao5Step.step(hl2, 5) ?? NaN) - (s.ao34Step.step(hl2, 34) ?? NaN);
      const sar = s.sarStep.step(bars, i) ?? NaN;
      const cci = s.cciStep.step(close) ?? NaN;
      const [diPlus, diMinus, adx] = s.dmiStep.step(high, low, close);
      const atr = s.atrStep.step(high, low, close) ?? NaN;

      const bullArr = [
        gt(smaFast, smaSlow), gt(rsi, cfg.rsiLongLevel), gt(macdLine ?? NaN, signalLine ?? NaN), Math.abs(stDir + 1) <= EPS,
        gt(k, 50), gt(close, bbMiddle), gt(emaFast, emaSlow), gt(ao, 0), gt(close, sar),
        gt(cci, cfg.cciLongLevel), gt(adx ?? NaN, cfg.adxThreshold) && gt(diPlus ?? NaN, diMinus ?? NaN),
      ];
      const bearArr = [
        lt(smaFast, smaSlow), lt(rsi, cfg.rsiShortLevel), lt(macdLine ?? NaN, signalLine ?? NaN), Math.abs(stDir - 1) <= EPS,
        lt(k, 50), lt(close, bbMiddle), lt(emaFast, emaSlow), lt(ao, 0), lt(close, sar),
        lt(cci, cfg.cciShortLevel), gt(adx ?? NaN, cfg.adxThreshold) && gt(diMinus ?? NaN, diPlus ?? NaN),
      ];
      v.bullArr = bullArr;
      v.bearArr = bearArr;

      // Standalone performance of each indicator
      for (let j = 0; j < 11; j++) {
        const m = ind[j];
        const bull = bullArr[j];
        const bear = bearArr[j];
        let state = m.state;
        if (state !== 0) {
          const price = exitPrice(m, state, b, state === 1 ? bear : bull);
          if (!Number.isNaN(price)) {
            const ret = (state * (price - m.entry) / m.entry) * 100;
            m.total += 1;
            if (gt(ret, 0)) m.wins += 1;
            m.state = 0;
            m.sl = NaN;
            m.tp = NaN;
            m.ts = NaN;
            state = 0;
          }
        }
        const enterLong = bull && !prevBull[j] && state !== 1;
        const enterShort = bear && !prevBear[j] && state !== -1;
        if (enterLong) enter(m, 1, close, atr);
        if (enterShort) enter(m, -1, close, atr);
        if (state === 1 && !enterLong && cfg.enableTs) trail(m, 1, close, atr);
        if (state === -1 && !enterShort && cfg.enableTs) trail(m, -1, close, atr);
        prevBull[j] = bull;
        prevBear[j] = bear;
      }

      // Combined signal
      let longCond: boolean;
      let shortCond: boolean;
      if (!anyEnabled) {
        longCond = false;
        shortCond = false;
      } else if (cfg.requireAll) {
        longCond = enabled.every((e, j) => !e || bullArr[j]);
        shortCond = enabled.every((e, j) => !e || bearArr[j]);
      } else {
        longCond = enabled.some((e, j) => e && bullArr[j]);
        shortCond = enabled.some((e, j) => e && bearArr[j]);
      }
      v.longCond = longCond;
      v.shortCond = shortCond;

      // 1-2. Exits
      let exitLong = false;
      let exitShort = false;
      if (main.state !== 0) {
        const side = main.state;
        const price = exitPrice(main, side, b, side === 1 ? shortCond : longCond);
        if (!Number.isNaN(price)) {
          const tradeRet = (side * (price - main.entry) / main.entry) * 100;
          v.netProfitPct += tradeRet;
          main.total += 1;
          if (gt(tradeRet, 0)) {
            main.wins += 1;
            v.grossProfit += tradeRet;
          } else {
            v.grossLoss += Math.abs(tradeRet);
          }
          main.state = 0;
          main.sl = NaN;
          main.tp = NaN;
          main.ts = NaN;
          if (side === 1) exitLong = true;
          else exitShort = true;
        }
      }

      // 3. Entries
      const enterLong = longCond && !v.prevLong && main.state !== 1;
      const enterShort = shortCond && !v.prevShort && main.state !== -1;
      if (enterLong) enter(main, 1, close, atr);
      if (enterShort) enter(main, -1, close, atr);

      // 4. Trailing stop of an ongoing trade
      if (main.state === 1 && !enterLong && cfg.enableTs) trail(main, 1, close, atr);
      if (main.state === -1 && !enterShort && cfg.enableTs) trail(main, -1, close, atr);

      // 5. Visuals
      const longGlowY = enterLong ? low - atr * cfg.orbDist : NaN;
      const shortGlowY = enterShort ? high + atr * cfg.orbDist : NaN;
      for (let g = 0; g < 3; g++) {
        s.glow[g][i] = { time, value: longGlowY };
        s.glow[3 + g][i] = { time, value: shortGlowY };
      }
      const currentWR = main.total > 0 ? (main.wins / main.total) * 100 : 0;
      const wrText = str.tostring(currentWR, '#.#') + '%';
      if (enterLong) {
        s.lineList.push({ x: i, y1: low, y2: longGlowY, color: LONG_LINE[0], width: 2 });
        s.lineList.push({ x: i, y1: low, y2: longGlowY, color: LONG_LINE[1], width: 1 });
        s.labelList.push({ x: i, y: longGlowY, text: wrText, style: 'label_up' });
      }
      if (enterShort) {
        s.lineList.push({ x: i, y1: high, y2: shortGlowY, color: SHORT_LINE[0], width: 2 });
        s.lineList.push({ x: i, y1: high, y2: shortGlowY, color: SHORT_LINE[1], width: 1 });
        s.labelList.push({ x: i, y: shortGlowY, text: wrText, style: 'label_down' });
      }

      if (exitLong && !enterShort) s.markers.push({ time, position: 'aboveBar', shape: 'xcross', color: RED, size: 'tiny' });
      if (exitShort && !enterLong) s.markers.push({ time, position: 'belowBar', shape: 'xcross', color: GREEN, size: 'tiny' });

      const inTrade = main.state !== 0;
      const entering = enterLong || enterShort;
      // plot(..., color = na): 'transparent'
      const sl = inTrade && cfg.enableSl;
      s.slPlot[i] = { time, value: sl ? main.sl : NaN, color: sl && !entering ? SL_COLOR : 'transparent' };
      const tp = inTrade && cfg.enableTp;
      s.tpPlot[i] = { time, value: tp ? main.tp : NaN, color: tp && !entering ? TP_COLOR : 'transparent' };
      const ts = inTrade && cfg.enableTs && !entering;
      s.tsPlot[i] = { time, value: ts ? main.ts : NaN };
      s.pricePlot[i] = { time, value: ts ? close : NaN };
      if (main.state === 1) {
        s.tsTopVal[i] = close;
        s.tsBotVal[i] = main.ts;
        s.tsTopCol[i] = TS_SHOWN;
        s.tsBotCol[i] = TS_HIDDEN;
      } else if (main.state === -1) {
        s.tsTopVal[i] = main.ts;
        s.tsBotVal[i] = close;
        s.tsTopCol[i] = TS_HIDDEN;
        s.tsBotCol[i] = TS_SHOWN;
      } else {
        s.tsTopVal[i] = NaN;
        s.tsBotVal[i] = NaN;
        s.tsTopCol[i] = null;
        s.tsBotCol[i] = null;
      }

      v.prevLong = longCond;
      v.prevShort = shortCond;
    },
    copyVars: (v) => ({
      ...v, ind: v.ind.map((m) => ({ ...m })), prevBull: v.prevBull.slice(), prevBear: v.prevBear.slice(),
      main: { ...v.main },
    }),
    result(s, bars, chart) {
      const n = bars.length;
      const fgColor = foregroundColorOf(chart);
      const { ind, main, netProfitPct, grossProfit, grossLoss, bullArr, bearArr, longCond, shortCond } = s.vars;

      // ── Dashboards (tables of the last bar) ──
      const sizeOf: Record<string, PineSize> = { Tiny: 'tiny', Small: 'small', Normal: 'normal', Large: 'large', Huge: 'huge' };
      const textSize = sizeOf[cfg.dashboardSize];
      const tableOf = (position: string, columns: number, rows: number): TableData & { merges: TableMergeData[] } => ({
        position: cornerOf(position), columns, rows, cells: [], merges: [],
        bgColor: BACKGROUND, borderWidth: 0, frameColor: BORDERS, frameWidth: 1, forceOverlay: true,
      });
      const tAble = tableOf(cfg.dashboardPosition, 4, 30);
      const tPerf = tableOf(cfg.perfDashboardPosition, 6, 10);

      if (cfg.dashboard && n > 0) {
        const cell = (
          t: TableData, column: number, row: number, text: string, textColor: string,
          textHAlign: TableCellData['textHAlign'], bgColor?: string, height = 0,
        ): void => {
          t.cells.push({ column, row, text, textColor, textSize, textHAlign, ...(bgColor ? { bgColor } : {}), height });
        };
        const divider = (t: TableData & { merges: TableMergeData[] }, row: number, lastColumn: number): void => {
          t.merges.push({ startColumn: 0, startRow: row, endColumn: lastColumn, endRow: row });
          cell(t, 0, row, ROW_DIVIDER, BORDERS, 'center', undefined, 0.5);
        };
        const gradStart = String(color.rgb(18, 20, 26));
        const gradEnd = String(color.rgb(32, 36, 48));
        const perfBg = (c: number, maxC: number, isHeader: boolean): string => {
          const baseCol = color.from_gradient(c, 0, maxC, gradStart, gradEnd);
          return isHeader ? C(baseCol, 30) : String(baseCol);
        };
        const titleBg = String(color.rgb(12, 14, 18));
        /** Blocks of the win rate and its text */
        const hist = (win: number, total: number): [string, string] => {
          const wr = total > 0 ? (win / total) * 100 : 0;
          const blocks = Math.max(0, Math.min(10, Math.trunc(math.round(wr / 10))));
          let s = '';
          for (let b = 1; b <= 10; b++) s += b <= blocks ? '█' : '░';
          const colorHist = ge(wr, 50) ? GREEN : total === 0 ? DATA : RED;
          return [s + '  ' + str.tostring(wr, '#.#') + '%', colorHist];
        };

        const winRate = main.total > 0 ? (main.wins / main.total) * 100 : 0;
        const profitFactor = gt(grossLoss, 0) ? grossProfit / grossLoss : gt(grossProfit, 0) ? 999 : 0;

        // Indicator dashboard
        let r = 0;
        tAble.merges.push({ startColumn: 0, startRow: r, endColumn: 3, endRow: r });
        cell(tAble, 0, r, 'Indicator Dashboard', DATA, 'center', titleBg);
        r += 1;
        divider(tAble, r, 3);
        r += 1;
        cell(tAble, 0, r, 'Indicator', HEADERS, 'left', perfBg(0, 3, true));
        cell(tAble, 1, r, 'Status', HEADERS, 'center', perfBg(1, 3, true));
        cell(tAble, 2, r, 'Standalone WR', HEADERS, 'left', perfBg(2, 3, true));
        cell(tAble, 3, r, 'Enabled', HEADERS, 'right', perfBg(3, 3, true));
        r += 1;
        divider(tAble, r, 3);
        r += 1;
        const names = ['SMA Cross', 'RSI', 'MACD', 'Supertrend', 'Stochastic', 'Bollinger', 'EMA Cross', 'AO', 'SAR', 'CCI', 'ADX Filter'];
        for (let j = 0; j < 11; j++) {
          const bull = bullArr[j];
          const bear = bearArr[j];
          const [histText, histCol] = hist(ind[j].wins, ind[j].total);
          cell(tAble, 0, r, names[j], DATA, 'left', perfBg(0, 3, false));
          cell(tAble, 1, r, bull ? 'Bullish' : bear ? 'Bearish' : 'Neutral', bull ? GREEN : bear ? RED : HEADERS, 'center', perfBg(1, 3, false));
          cell(tAble, 2, r, histText, histCol, 'left', perfBg(2, 3, false));
          cell(tAble, 3, r, enabled[j] ? '✓' : '✗', enabled[j] ? GREEN : RED, 'right', perfBg(3, 3, false));
          r += 1;
          divider(tAble, r, 3);
          r += 1;
        }
        tAble.merges.push({ startColumn: 0, startRow: r, endColumn: 2, endRow: r });
        cell(tAble, 0, r, 'Current Signal', HEADERS, 'left', perfBg(0, 3, false));
        cell(tAble, 3, r, longCond ? 'LONG' : shortCond ? 'SHORT' : 'NEUTRAL', longCond ? GREEN : shortCond ? RED : HEADERS, 'right', perfBg(3, 3, false));

        // Performance dashboard
        let pR = 0;
        tPerf.merges.push({ startColumn: 0, startRow: pR, endColumn: 5, endRow: pR });
        cell(tPerf, 0, pR, 'Backtest Results [LuxAlgo]', DATA, 'center', titleBg);
        pR += 1;
        divider(tPerf, pR, 5);
        pR += 1;
        ['Total Trades', 'Wins', 'Losses', 'Winrate', 'PF', 'PNL %'].forEach((title, c) => {
          cell(tPerf, c, pR, title, HEADERS, 'center', perfBg(c, 5, true));
        });
        pR += 1;
        divider(tPerf, pR, 5);
        pR += 1;
        const lossTrades = main.total - main.wins;
        cell(tPerf, 0, pR, str.tostring(main.total), DATA, 'center', perfBg(0, 5, false));
        cell(tPerf, 1, pR, str.tostring(main.wins), DATA, 'center', perfBg(1, 5, false));
        cell(tPerf, 2, pR, str.tostring(lossTrades), DATA, 'center', perfBg(2, 5, false));
        cell(tPerf, 3, pR, str.tostring(winRate, '#.##') + ' %', ge(winRate, 50) ? GREEN : main.total === 0 ? DATA : RED, 'center', perfBg(3, 5, false));
        cell(
          tPerf, 4, pR, profitFactor === 999 ? 'MAX' : str.tostring(profitFactor, '#.##'),
          gt(profitFactor, 1) ? GREEN : Math.abs(profitFactor) <= EPS ? DATA : RED, 'center', perfBg(4, 5, false),
        );
        cell(
          tPerf, 5, pR, str.tostring(netProfitPct, '#.##') + ' %',
          gt(netProfitPct, 0) ? GREEN : lt(netProfitPct, 0) ? RED : DATA, 'center', perfBg(5, 5, false),
        );
      }

      // ── Output ──
      const clear = C('#000000', 100);
      // indicator(max_labels_count = 500, max_lines_count = 500): the objects kept of every one created
      const lineList = s.lineList.slice(s.lineList.length - keptCount(s.lineList.length));
      const labelList = s.labelList.slice(s.labelList.length - keptCount(s.labelList.length));

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.glow[0].slice(),
          plot1: s.glow[1].slice(),
          plot2: s.glow[2].slice(),
          plot3: s.glow[3].slice(),
          plot4: s.glow[4].slice(),
          plot5: s.glow[5].slice(),
          plot6: s.slPlot.slice(),
          plot7: s.tpPlot.slice(),
          plot8: s.tsPlot.slice(),
          plot9: s.pricePlot.slice(),
        },
        fills: [
          {
            plot1: 'plot8', plot2: 'plot9',
            gradient: { topValue: s.tsTopVal.slice(), bottomValue: s.tsBotVal.slice(), topColor: s.tsTopCol.slice(), bottomColor: s.tsBotCol.slice() },
          },
        ],
        markers: s.markers.slice(),
        // an object created with an na price (no ATR yet) counts in the limit but is not drawn
        lines: lineList.filter((l) => !Number.isNaN(l.y2)).map((l) => ({ time1: bars[l.x].time, price1: l.y1, time2: bars[l.x].time, price2: l.y2, color: l.color, width: l.width })),
        labels: labelList.filter((l) => !Number.isNaN(l.y)).map((l) => ({
          time: bars[l.x].time, price: l.y, text: l.text, color: clear, textColor: fgColor, style: l.style, size: 'tiny' as const,
        })),
        tables: [tAble, tPerf],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SignalForgeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SignalForgeInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; lines: LineDrawingData[]; labels: LabelData[]; tables: TableData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const SignalForge = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
