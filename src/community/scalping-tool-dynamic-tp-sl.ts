/**
 * Scalping Tool with Dynamic Take Profit & Stop Loss
 *
 * EMA(5) / EMA(13) crossovers give BUY and SELL labels. A buy opens a long trade at the close with a take profit
 * (close * (1 + percent) or close + ATR * multiplier) and a stop loss (entry - ATR * multiplier, moving with the
 * ATR). When the close reaches the take profit, the take profit is recalculated from that close. The long trade
 * ends on the next bearish cross; sell trades work the other way. The take profit and stop loss lines are drawn
 * while the trade is open.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' / 'Sell Signal', true on the bars of the labels.
 *
 * Reference: "Scalping Tool with Dynamic Take Profit & Stop Loss" by TruFREND
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ScalpingToolDynamicTPSLInputs {
  fastLength: number;
  slowLength: number;
  atrLength: number;
  buyTakeProfitEnabled: boolean;
  /** 'Percentage' or 'ATR' */
  buyTakeProfitType: string;
  /** Buy take profit in percent */
  buyTakeProfitPercent: number;
  buyTakeProfitAtrMultiplier: number;
  buyStopLossEnabled: boolean;
  buyStopLossMultiplier: number;
  sellTakeProfitEnabled: boolean;
  /** 'Percentage' or 'ATR' */
  sellTakeProfitType: string;
  /** Sell take profit in percent */
  sellTakeProfitPercent: number;
  sellTakeProfitAtrMultiplier: number;
  sellStopLossEnabled: boolean;
  sellStopLossMultiplier: number;
}

export const defaultInputs: ScalpingToolDynamicTPSLInputs = {
  fastLength: 5,
  slowLength: 13,
  atrLength: 14,
  buyTakeProfitEnabled: true,
  buyTakeProfitType: 'Percentage',
  buyTakeProfitPercent: 0.3,
  buyTakeProfitAtrMultiplier: 1.5,
  buyStopLossEnabled: true,
  buyStopLossMultiplier: 1.5,
  sellTakeProfitEnabled: true,
  sellTakeProfitType: 'Percentage',
  sellTakeProfitPercent: 0.3,
  sellTakeProfitAtrMultiplier: 1.5,
  sellStopLossEnabled: true,
  sellStopLossMultiplier: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 5, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 13, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'buyTakeProfitEnabled', type: 'bool', title: 'Enable Buy Take Profit', defval: true },
  { id: 'buyTakeProfitType', type: 'string', title: 'Buy Take Profit Type', defval: 'Percentage', options: ['Percentage', 'ATR'] },
  { id: 'buyTakeProfitPercent', type: 'float', title: 'Buy Take Profit (%)', defval: 0.3, step: 0.1 },
  { id: 'buyTakeProfitAtrMultiplier', type: 'float', title: 'Buy Take Profit ATR Multiplier', defval: 1.5, step: 0.1 },
  { id: 'buyStopLossEnabled', type: 'bool', title: 'Enable Buy Stop Loss', defval: true },
  { id: 'buyStopLossMultiplier', type: 'float', title: 'Buy Stop Loss ATR Multiplier', defval: 1.5, step: 0.1 },
  { id: 'sellTakeProfitEnabled', type: 'bool', title: 'Enable Sell Take Profit', defval: true },
  { id: 'sellTakeProfitType', type: 'string', title: 'Sell Take Profit Type', defval: 'Percentage', options: ['Percentage', 'ATR'] },
  { id: 'sellTakeProfitPercent', type: 'float', title: 'Sell Take Profit (%)', defval: 0.3, step: 0.1 },
  { id: 'sellTakeProfitAtrMultiplier', type: 'float', title: 'Sell Take Profit ATR Multiplier', defval: 1.5, step: 0.1 },
  { id: 'sellStopLossEnabled', type: 'bool', title: 'Enable Sell Stop Loss', defval: true },
  { id: 'sellStopLossMultiplier', type: 'float', title: 'Sell Stop Loss ATR Multiplier', defval: 1.5, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast MA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Slow MA', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Buy Take Profit', color: color.green, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Buy Stop Loss', color: color.orange, lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Sell Take Profit', color: color.red, lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'Sell Stop Loss', color: color.purple, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Scalping Tool with Dynamic TP (ATR/Percentage), EMA, and ATR [v6]',
  shortTitle: 'Scalping Tool with Dynamic TP (ATR/Percentage), EMA, and ATR [v6]',
  overlay: true,
};

/** Pine float comparisons with the 1e-10 tolerance (false with na) */
const EPS = 1e-10;
const le = (a: number, b: number) => a - b <= EPS;
const ge = (a: number, b: number) => b - a <= EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface ScalpingVars {
  longEntry: number;
  shortEntry: number;
  inLong: boolean;
  inShort: boolean;
  longTp: number;
  shortTp: number;
}

interface ScalpingRun extends BarRunState<ScalpingVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  fastMA: number[];
  slowMA: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ScalpingToolDynamicTPSLInputs>): BarStudy<ScalpingRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // input.float(...) / 100
  const buyTpPct = cfg.buyTakeProfitPercent / 100;
  const sellTpPct = cfg.sellTakeProfitPercent / 100;
  const blue = String(color.new(color.blue, 0));
  const red = String(color.new(color.red, 0));
  const green = String(color.new(color.green, 0));
  const orange = String(color.new(color.orange, 0));
  const purple = String(color.new(color.purple, 0));
  return {
    init() {
      const s: ScalpingRun = {
        fast: taStep.ema(cfg.fastLength), slow: taStep.ema(cfg.slowLength), atr: taStep.atr(cfg.atrLength),
        fastMA: [], slowMA: [], plots: Array.from({ length: 6 }, () => []), markers: [], flags: [[], []], times: [[], []],
        steps: [],
        vars: { longEntry: NaN, shortEntry: NaN, inLong: false, inShort: false, longTp: NaN, shortTp: NaN },
        lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.atr];
      s.lists = [s.markers, ...s.times];
      s.series = [s.fastMA, s.slowMA, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const c = b.close;
      const f = s.fast.step(c);
      const sl = s.slow.step(c);
      const atr = s.atr.step(b.high, b.low, b.close);
      s.fastMA[i] = f;
      s.slowMA[i] = sl;
      const f1 = i > 0 ? s.fastMA[i - 1] : NaN;
      const s1 = i > 0 ? s.slowMA[i - 1] : NaN;
      // ta.crossover(fast_ma, slow_ma): fast > slow and fast[1] <= slow[1]; ta.crossunder the other way
      // (exact comparisons: ta.crossover / ta.crossunder do not use the 1e-10 tolerance of the operators)
      const trendUp = f > sl && f1 <= s1;
      const trendDown = f < sl && f1 >= s1;

      const longSignal = trendUp && !v.inLong;
      const shortSignal = trendDown && !v.inShort;

      if (longSignal) {
        v.longEntry = c;
        v.inLong = true;
        v.longTp = cfg.buyTakeProfitEnabled
          ? (cfg.buyTakeProfitType === 'Percentage' ? v.longEntry * (1 + buyTpPct) : v.longEntry + atr * cfg.buyTakeProfitAtrMultiplier)
          : NaN;
      }
      if (shortSignal) {
        v.shortEntry = c;
        v.inShort = true;
        v.shortTp = cfg.sellTakeProfitEnabled
          ? (cfg.sellTakeProfitType === 'Percentage' ? v.shortEntry * (1 - sellTpPct) : v.shortEntry - atr * cfg.sellTakeProfitAtrMultiplier)
          : NaN;
      }
      if (trendDown && v.inLong) {
        v.inLong = false;
        v.longEntry = NaN;
        v.longTp = NaN;
      }
      if (trendUp && v.inShort) {
        v.inShort = false;
        v.shortEntry = NaN;
        v.shortTp = NaN;
      }
      // Dynamic TP: a new take profit from the close when the close reaches it
      if (v.inLong && cfg.buyTakeProfitEnabled && ge(c, v.longTp)) {
        v.longTp = cfg.buyTakeProfitType === 'Percentage' ? c * (1 + buyTpPct) : c + atr * cfg.buyTakeProfitAtrMultiplier;
      }
      if (v.inShort && cfg.sellTakeProfitEnabled && le(c, v.shortTp)) {
        v.shortTp = cfg.sellTakeProfitType === 'Percentage' ? c * (1 - sellTpPct) : c - atr * cfg.sellTakeProfitAtrMultiplier;
      }
      const buySl = cfg.buyStopLossEnabled && v.inLong ? v.longEntry - atr * cfg.buyStopLossMultiplier : NaN;
      const sellSl = cfg.sellStopLossEnabled && v.inShort ? v.shortEntry + atr * cfg.sellStopLossMultiplier : NaN;

      s.plots[0][i] = { time: t, value: f, color: blue };
      s.plots[1][i] = { time: t, value: sl, color: red };
      s.plots[2][i] = { time: t, value: v.inLong ? v.longTp : NaN, color: green };
      s.plots[3][i] = { time: t, value: v.inLong ? buySl : NaN, color: orange };
      s.plots[4][i] = { time: t, value: v.inShort ? v.shortTp : NaN, color: red };
      s.plots[5][i] = { time: t, value: v.inShort ? sellSl : NaN, color: purple };

      // plotshape(long_signal, location.belowbar, color.green, shape.labelup, text "BUY", size.small); default textcolor
      if (longSignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: green, text: 'BUY', textColor: color.blue, size: 'small' });
      }
      if (shortSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: red, text: 'SELL', textColor: color.blue, size: 'small' });
      }
      [longSignal, shortSignal].forEach((fl, k) => {
        s.flags[k][i] = fl;
        if (fl) s.times[k].push(t as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: Object.fromEntries(s.plots.map((p, k) => [`plot${k}`, p.slice()])),
        markers: s.markers.slice(),
        // alertcondition(long_signal, "Buy Signal") / alertcondition(short_signal, "Sell Signal")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ScalpingToolDynamicTPSLInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ScalpingToolDynamicTPSLInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy Signal' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell Signal' },
];

export const ScalpingToolDynamicTPSL = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
