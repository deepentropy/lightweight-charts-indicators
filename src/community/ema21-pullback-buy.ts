/**
 * EMA21 Pullback Buy
 *
 * EMA21 and SMA50 lines. A test candle is a bar in an uptrend (Strict, Moderate or Loose trend filter) whose
 * previous close was above the EMA21, whose low touches or crosses the EMA21 and whose close is back above it.
 * The tests are counted while the trend holds (optional limit). A valid test colours the bar white and draws a
 * circle below it. The first bullish candle (close > open > EMA21) that takes out the high of the latest test, while
 * the trend holds and the close stays above both averages, draws a "Buy" triangle above the bar.
 * Alerts (alertcondition, `alerts` of the result): 'EMA21 test' on the valid test candles and 'Buy bullish reversal'
 * on the Buy bars.
 *
 * Reference: "EMA21 Pullback Buy" by Kennedy08
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface Ema21PullbackBuyInputs {
  emaLen: number;
  /** SMA length (trend) */
  smaLen: number;
  useTrendFilter: boolean;
  trendSensitivity: 'Strict' | 'Moderate' | 'Loose';
  /** EMA10 momentum filter (Strict trend) */
  useEma10Filter: boolean;
  useMaxTestLimit: boolean;
  /** Max number of EMA21 tests in a trend */
  maxTests: number;
  showTestColor: boolean;
  showBuySignal: boolean;
  /** Min days above EMA21 (Strict) */
  emaTrendDays: number;
  /** Min days SMA50 rising (Strict) */
  smaUpDays: number;
}

export const defaultInputs: Ema21PullbackBuyInputs = {
  emaLen: 21,
  smaLen: 50,
  useTrendFilter: true,
  trendSensitivity: 'Strict',
  useEma10Filter: false,
  useMaxTestLimit: true,
  maxTests: 6,
  showTestColor: true,
  showBuySignal: true,
  emaTrendDays: 5,
  smaUpDays: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLen', type: 'int', title: 'EMA length', defval: 21 },
  { id: 'smaLen', type: 'int', title: 'SMA length (trend)', defval: 50 },
  { id: 'useTrendFilter', type: 'bool', title: 'Use trend filter', defval: true },
  { id: 'trendSensitivity', type: 'string', title: 'Trend Sensitivity', defval: 'Strict', options: ['Strict', 'Moderate', 'Loose'] },
  { id: 'useEma10Filter', type: 'bool', title: 'Use EMA10 momentum filter', defval: false },
  { id: 'useMaxTestLimit', type: 'bool', title: 'Limit max number of EMA21 tests', defval: true },
  { id: 'maxTests', type: 'int', title: 'Max number of EMA21 tests in trend', defval: 6, min: 1, max: 20 },
  { id: 'showTestColor', type: 'bool', title: 'Color EMA21 test candles', defval: true },
  { id: 'showBuySignal', type: 'bool', title: 'Show buy signal after test', defval: true },
  { id: 'emaTrendDays', type: 'int', title: 'Min days above EMA21 (strict)', defval: 5, min: 1 },
  { id: 'smaUpDays', type: 'int', title: 'Min days SMA50 rising (strict)', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA21', color: String(color.new(color.gray, 0)), lineWidth: 1 },
  { id: 'plot1', title: 'SMA50', color: String(color.new(color.silver, 0)), lineWidth: 1 },
];

export const metadata = {
  title: 'EMA21 Pullback Buy',
  shortTitle: '21 Pullback',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface PullbackVars {
  /** var int testCount = 0, var float lastTestHigh = na, var int lastTestBarIndex = na, var bool buyTriggered = false */
  testCount: number;
  lastTestHigh: number;
  lastTestBarIndex: number;
  buyTriggered: boolean;
}

interface PullbackRun extends BarRunState<PullbackVars> {
  ema10: ReturnType<typeof taStep.ema>;
  ema21: ReturnType<typeof taStep.ema>;
  sma50: WindowSma;
  bsSma: ReturnType<typeof taStep.barssince>;
  bsEma: ReturnType<typeof taStep.barssince>;
  e10: number[];
  e21: number[];
  s50: number[];
  plot0: Array<{ time: number; value: number }>;
  plot1: Array<{ time: number; value: number }>;
  flags: boolean[][];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<Ema21PullbackBuyInputs>): BarStudy<PullbackRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const white = String(color.new(color.white, 0));
  const lime = String(color.new(color.lime, 0));
  return {
    init() {
      const ema10 = taStep.ema(10);
      const ema21 = taStep.ema(cfg.emaLen);
      const sma50 = new WindowSma(cfg.smaLen);
      const bsSma = taStep.barssince();
      const bsEma = taStep.barssince();
      const s: PullbackRun = {
        ema10, ema21, sma50, bsSma, bsEma, e10: [], e21: [], s50: [], plot0: [], plot1: [], flags: [[], []], markers: [],
        barColors: [], steps: [ema10, ema21, sma50, bsSma, bsEma],
        vars: { testCount: 0, lastTestHigh: NaN, lastTestBarIndex: NaN, buyTriggered: false }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors];
      s.series = [s.e10, s.e21, s.s50, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const e10 = s.ema10.step(b.close);
      const e21 = s.ema21.step(b.close);
      const s50 = s.sma50.step(b.close);
      s.e10[i] = e10;
      s.e21[i] = e21;
      s.s50[i] = s50;
      const e10p = i > 0 ? s.e10[i - 1] : NaN;
      const e21p = i > 0 ? s.e21[i - 1] : NaN;
      const s50p = i > 0 ? s.s50[i - 1] : NaN;
      const c1 = i > 0 ? bars[i - 1].close : NaN;
      s.plot0[i] = { time: b.time, value: e21 };
      s.plot1[i] = { time: b.time, value: s50 };

      // smaRisingRecently = ta.barssince(not smaRising) >= smaUpDays; aboveEmaRecently = ta.barssince(close < ema21) >= ...
      const bsNotSmaRising = s.bsSma.step(gt(s50, s50p) ? 0 : 1);
      const bsCloseBelowEma = s.bsEma.step(lt(b.close, e21) ? 1 : 0);
      const emaReady = !isNaN(e21) && !isNaN(s50);

      const emaSlopeOk = gt(e21, e21p * 1.001);
      const emaAboveSmaWithMargin = gt(e21, s50 * 1.01);
      const smaRisingRecently = ge(bsNotSmaRising, cfg.smaUpDays);
      const aboveEmaRecently = ge(bsCloseBelowEma, cfg.emaTrendDays);
      const ema10SlopeUp = gt(e10, e10p);

      const strictTrend = emaReady && gt(b.close, e21) && gt(b.close, s50) && emaAboveSmaWithMargin && emaSlopeOk
        && smaRisingRecently && aboveEmaRecently && (!cfg.useEma10Filter || ema10SlopeUp);
      const moderateTrend = emaReady && gt(b.close, e21) && ge(e21, s50);
      const looseTrend = emaReady && gt(b.close, e21);
      const uptrend = (cfg.trendSensitivity === 'Strict' && strictTrend)
        || (cfg.trendSensitivity === 'Moderate' && moderateTrend)
        || (cfg.trendSensitivity === 'Loose' && looseTrend);
      const trendOk = cfg.useTrendFilter ? uptrend : emaReady;

      // EMA21 test candle
      const wasAbovePrev = emaReady && gt(c1, e21p);
      const touchesOrUnder = emaReady && le(b.low, e21);
      const closesAbove = emaReady && gt(b.close, e21);
      const isTestCandidate = trendOk && wasAbovePrev && touchesOrUnder && closesAbove;

      if (!trendOk) v.testCount = 0;
      else if (isTestCandidate) v.testCount += 1;
      const limitOk = !cfg.useMaxTestLimit || v.testCount <= cfg.maxTests;
      const isValidTest = isTestCandidate && limitOk;

      if (isValidTest) {
        v.lastTestHigh = b.high;
        v.lastTestBarIndex = i;
        v.buyTriggered = false;
      }
      // Reset if the trend breaks or the price closes below the averages
      if (!trendOk || lt(b.close, e21) || lt(b.close, s50)) {
        v.lastTestHigh = NaN;
        v.lastTestBarIndex = NaN;
        v.buyTriggered = false;
      }

      // barcolor(showTestColor and isValidTest ? white : na)
      if (cfg.showTestColor && isValidTest) s.barColors.push({ time: b.time as number, color: white });
      // plotshape(isValidTest, style = shape.circle, location = location.belowbar, size = size.tiny)
      if (isValidTest) s.markers.push({ time: b.time as number, position: 'belowBar', shape: 'circle', color: white, size: 'tiny' });

      // Buy trigger: a bullish candle that takes out the last test high
      const hasTest = !isNaN(v.lastTestHigh) && !isNaN(v.lastTestBarIndex);
      const takesOutHigh = hasTest && gt(b.high, v.lastTestHigh) && i > v.lastTestBarIndex;
      const isBullish = gt(b.close, b.open) && gt(b.open, e21) && gt(b.close, e21);
      const isBuy = cfg.showBuySignal && hasTest && trendOk && !v.buyTriggered && takesOutHigh && isBullish;
      if (isBuy) v.buyTriggered = true;
      s.flags[0][i] = isValidTest;
      s.flags[1][i] = isBuy;
      // plotshape(isBuy, style = shape.triangleup, location = location.abovebar, size = size.small, text = "Buy")
      if (isBuy) {
        s.markers.push({ time: b.time as number, position: 'aboveBar', shape: 'triangleUp', color: lime, size: 'small',
          text: 'Buy', textColor: color.lime });
      }
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(isValidTest, "EMA21 test") / alertcondition(isBuy, "Buy bullish reversal")
        alerts: alertStates(alertConditions, bars, s.flags),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Ema21PullbackBuyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Ema21PullbackBuyInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'EMA21 test', message: 'EMA21 test in strong uptrend, price went below ema21 and closed back above.' },
  { id: 'alert1', title: 'Buy bullish reversal', message: 'First bullish reversal that takes out high of latest EMA21 test candle in strong uptrend.' },
];

export const Ema21PullbackBuy = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
