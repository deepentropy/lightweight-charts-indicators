/**
 * Trend Double Pullback [Stable 20] v1.0
 *
 * EMAs 15 / 25 (short band), 50 / 70 (medium band) and 199 (baseline). An uptrend is a short band fully above the
 * medium band; it is stable when that holds for `trend_stability` bars, and it ends when the close stays under the
 * EMA 70 for more than `breakout_tolerance` bars (downtrend: the mirror). In a stable trend, a first pullback to
 * the short band (low <= EMA 15 and close >= EMA 25) or to the medium band (low <= EMA 50 and close >= EMA 70) with
 * a green candle or a long lower shadow (> 30 % of the range) is a "watch" signal (after a cooldown); a second
 * pullback to the same band is the buy signal (sell: the mirror). The background shows the stable (85 %) and the
 * unstable (95 % transparency) trends.
 * Alerts (alertcondition, `alerts` of the result): '[Alert] Buy Signal' and '[Alert] Sell Signal', true on the bars of
 * the buy / sell signals.
 *
 * Reference: "Trend Double Pullback [Stable 20]" by puduxbt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendDoublePullbackV10Inputs {
  /** Short EMA 1 (top) */
  lenEma15: number;
  /** Short EMA 2 (bottom) */
  lenEma25: number;
  /** Medium EMA 1 (top) */
  lenEma50: number;
  /** Medium EMA 2 (bottom, stop line) */
  lenEma70: number;
  /** Baseline (visual only) */
  lenEma199: number;
  /** Bars the EMA order must hold for a stable trend */
  trendStability: number;
  /** Bars between two signals */
  signalCooldown: number;
  /** Bars the close may stay beyond the EMA 70 before the trend ends */
  breakoutTolerance: number;
  showBg: boolean;
}

export const defaultInputs: TrendDoublePullbackV10Inputs = {
  lenEma15: 15,
  lenEma25: 25,
  lenEma50: 50,
  lenEma70: 70,
  lenEma199: 199,
  trendStability: 20,
  signalCooldown: 10,
  breakoutTolerance: 5,
  showBg: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenEma15', type: 'int', title: 'Short EMA 1 (Top/动力)', defval: 15 },
  { id: 'lenEma25', type: 'int', title: 'Short EMA 2 (Bottom/支撑)', defval: 25 },
  { id: 'lenEma50', type: 'int', title: 'Medium EMA 1 (Top/防守)', defval: 50 },
  { id: 'lenEma70', type: 'int', title: 'Medium EMA 2 (Bottom/终结)', defval: 70 },
  { id: 'lenEma199', type: 'int', title: 'Baseline (Visual Only)', defval: 199 },
  { id: 'trendStability', type: 'int', title: 'Trend Stability Bars (稳定K线数)', defval: 20, min: 1 },
  { id: 'signalCooldown', type: 'int', title: 'Signal Cooldown Bars (信号冷却期)', defval: 10, min: 1 },
  { id: 'breakoutTolerance', type: 'int', title: 'Breakout Tolerance Bars (破位容忍度)', defval: 5, min: 1 },
  { id: 'showBg', type: 'bool', title: 'Show Trend Background', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 15', color: String(color.new(color.fuchsia, 0)), lineWidth: 1 },
  { id: 'plot1', title: 'EMA 25', color: String(color.new('#C71585', 0)), lineWidth: 1 },
  { id: 'plot2', title: 'EMA 50', color: String(color.new(color.orange, 0)), lineWidth: 1 },
  { id: 'plot3', title: 'EMA 70 (Stop Line)', color: String(color.new(color.orange, 0)), lineWidth: 2 },
  { id: 'plot4', title: 'EMA 199 Baseline', color: color.purple, lineWidth: 2 },
];

export const metadata = {
  title: 'Trend Double Pullback [Stable 20]',
  shortTitle: 'Trend Double Pullback [Stable 20]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Band = 'NA' | 'SHORT' | 'MEDIUM';

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface TdpVars {
  /** var int consecutive_break_long / short */
  breakLong: number;
  breakShort: number;
  /** var int last_long_signal_bar / last_short_signal_bar */
  lastLong: number;
  lastShort: number;
  stateLong: number;
  bandLong: Band;
  stateShort: number;
  bandShort: Band;
  /** state_long[1] (na on the first bar) and the others of the bar before */
  prevStateLong: number;
  prevBandLong: Band | null;
  prevStateShort: number;
  prevBandShort: Band | null;
}

interface TdpRun extends BarRunState<TdpVars> {
  emas: Array<ReturnType<typeof taStep.ema>>;
  sumUp: WindowSum;
  sumDown: WindowSum;
  plots: Point[][];
  bgColors: BgColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TrendDoublePullbackV10Inputs>): BarStudy<TdpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const blue = String(color.new(color.blue, 0));
  const red = String(color.new(color.red, 0));
  const bgStableUp = String(color.new(color.green, 85));
  const bgUnstableUp = String(color.new(color.green, 95));
  const bgStableDown = String(color.new(color.red, 85));
  const bgUnstableDown = String(color.new(color.red, 95));
  const lineColors = [
    String(color.new(color.fuchsia, 0)), String(color.new('#C71585', 0)), String(color.new(color.orange, 0)),
    String(color.new(color.orange, 0)), color.purple,
  ];
  return {
    init() {
      const emas = [cfg.lenEma15, cfg.lenEma25, cfg.lenEma50, cfg.lenEma70, cfg.lenEma199].map((l) => taStep.ema(l));
      const sumUp = new WindowSum(cfg.trendStability);
      const sumDown = new WindowSum(cfg.trendStability);
      const s: TdpRun = {
        emas, sumUp, sumDown, plots: [[], [], [], [], []], bgColors: [], markers: [], flags: [[], []], times: [[], []],
        steps: [...emas, sumUp, sumDown],
        vars: {
          breakLong: 0, breakShort: 0, lastLong: -999999, lastShort: -999999, stateLong: 0, bandLong: 'NA',
          stateShort: 0, bandShort: 'NA', prevStateLong: NaN, prevBandLong: null, prevStateShort: NaN, prevBandShort: null,
        },
        lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers, ...s.times];
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const ema15 = s.emas[0]!.step(b.close);
      const ema25 = s.emas[1]!.step(b.close);
      const ema50 = s.emas[2]!.step(b.close);
      const ema70 = s.emas[3]!.step(b.close);
      const ema199 = s.emas[4]!.step(b.close);
      const values = [ema15, ema25, ema50, ema70, ema199];
      for (let k = 0; k < 5; k++) s.plots[k]![i] = { time: t, value: values[k]!, color: lineColors[k]! };

      // Raw structure: short band above (below) the medium band; math.max / math.min give na with an na EMA
      const fastTop = Math.max(ema15, ema25);
      const fastBottom = Math.min(ema15, ema25);
      const slowTop = Math.max(ema50, ema70);
      const slowBottom = Math.min(ema50, ema70);
      const rawUp = gt(fastBottom, slowTop);
      const rawDown = lt(fastTop, slowBottom);
      // math.sum(raw ? 1 : 0, trend_stability) == trend_stability (na during the first bars)
      const sumUp = s.sumUp.step(rawUp ? 1 : 0);
      const sumDown = s.sumDown.step(rawDown ? 1 : 0);

      const range = b.high - b.low;
      const lowerShadow = gt(range, 0) ? (lt(b.close, b.open) ? (b.close - b.low) / range : (b.open - b.low) / range) : 0;
      const upperShadow = gt(range, 0) ? (lt(b.close, b.open) ? (b.high - b.open) / range : (b.high - b.close) / range) : 0;
      const isGreen = gt(b.close, b.open);
      const isRed = lt(b.close, b.open);

      const stableUp = !isNaN(sumUp) && Math.abs(sumUp - cfg.trendStability) <= EPS;
      const stableDown = !isNaN(sumDown) && Math.abs(sumDown - cfg.trendStability) <= EPS;

      if (lt(b.close, ema70)) v.breakLong += 1;
      else v.breakLong = 0;
      if (gt(b.close, ema70)) v.breakShort += 1;
      else v.breakShort = 0;
      const brokenLong = v.breakLong > cfg.breakoutTolerance;
      const brokenShort = v.breakShort > cfg.breakoutTolerance;

      const isUp = stableUp && !brokenLong;
      const isDown = stableDown && !brokenShort;
      const isUnstableUp = rawUp && !stableUp && !brokenLong;
      const isUnstableDown = rawDown && !stableDown && !brokenShort;

      // Support / resistance
      const supportShort = le(b.low, ema15) && ge(b.close, ema25);
      const supportMedium = le(b.low, ema50) && ge(b.close, ema70);
      const validLong = isGreen || gt(lowerShadow, 0.3);
      const longTrigShort = isUp && supportShort && validLong;
      const longTrigMedium = isUp && supportMedium && validLong;
      const resistShort = ge(b.high, ema15) && le(b.close, ema25);
      const resistMedium = ge(b.high, ema50) && le(b.close, ema70);
      const validShort = isRed || gt(upperShadow, 0.3);
      const shortTrigShort = isDown && resistShort && validShort;
      const shortTrigMedium = isDown && resistMedium && validShort;

      // Cooldown
      const longCooldown = i - v.lastLong > cfg.signalCooldown;
      const shortCooldown = i - v.lastShort > cfg.signalCooldown;

      // Long state machine
      if (brokenLong) {
        v.stateLong = 0;
        v.bandLong = 'NA';
      } else if (isUp) {
        if (v.stateLong === 0) {
          if (longCooldown) {
            if (longTrigShort) {
              v.stateLong = 1;
              v.bandLong = 'SHORT';
              v.lastLong = i;
            } else if (longTrigMedium) {
              v.stateLong = 1;
              v.bandLong = 'MEDIUM';
              v.lastLong = i;
            }
          }
        } else if (v.stateLong === 1) {
          if ((v.bandLong === 'SHORT' && longTrigShort) || (v.bandLong === 'MEDIUM' && longTrigMedium)) {
            // state_long := 2, then 0 on the same bar
            v.lastLong = i;
            v.stateLong = 0;
            v.bandLong = 'NA';
          }
        }
      }
      // Short state machine
      if (brokenShort) {
        v.stateShort = 0;
        v.bandShort = 'NA';
      } else if (isDown) {
        if (v.stateShort === 0) {
          if (shortCooldown) {
            if (shortTrigShort) {
              v.stateShort = 1;
              v.bandShort = 'SHORT';
              v.lastShort = i;
            } else if (shortTrigMedium) {
              v.stateShort = 1;
              v.bandShort = 'MEDIUM';
              v.lastShort = i;
            }
          }
        } else if (v.stateShort === 1) {
          if ((v.bandShort === 'SHORT' && shortTrigShort) || (v.bandShort === 'MEDIUM' && shortTrigMedium)) {
            v.lastShort = i;
            v.stateShort = 0;
            v.bandShort = 'NA';
          }
        }
      }

      // Background (var color, only written when show_bg)
      if (cfg.showBg) {
        const bg = isUp ? bgStableUp : isUnstableUp ? bgUnstableUp : isDown ? bgStableDown
          : isUnstableDown ? bgUnstableDown : null;
        if (bg) s.bgColors.push({ time: t, color: bg });
      }

      // Signals
      const markers = s.markers;
      if (v.stateLong === 1 && v.prevStateLong === 0) {
        markers.push({ time: t, position: 'belowBar', shape: 'arrowUp', color: blue, size: 'tiny', text: '一探', textColor: color.blue });
      }
      const isBuy = v.prevStateLong === 1
        && ((v.prevBandLong === 'SHORT' && longTrigShort) || (v.prevBandLong === 'MEDIUM' && longTrigMedium));
      if (isBuy) {
        markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: blue, size: 'tiny', text: '买入', textColor: color.blue });
      }
      if (v.stateShort === 1 && v.prevStateShort === 0) {
        markers.push({ time: t, position: 'aboveBar', shape: 'arrowDown', color: red, size: 'tiny', text: '一探', textColor: color.red });
      }
      const isSell = v.prevStateShort === 1
        && ((v.prevBandShort === 'SHORT' && shortTrigShort) || (v.prevBandShort === 'MEDIUM' && shortTrigMedium));
      if (isSell) {
        markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: red, size: 'tiny', text: '卖出', textColor: color.red });
      }

      s.flags[0]![i] = isBuy;
      s.flags[1]![i] = isSell;
      if (isBuy) s.times[0]!.push(t as number);
      if (isSell) s.times[1]!.push(t as number);
      v.prevStateLong = v.stateLong;
      v.prevBandLong = v.bandLong;
      v.prevStateShort = v.stateShort;
      v.prevBandShort = v.bandShort;
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0]!.slice(), plot1: p[1]!.slice(), plot2: p[2]!.slice(), plot3: p[3]!.slice(), plot4: p[4]!.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Short Band Fill', color: String(color.new(color.fuchsia, 85)) } },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Medium Band Fill', color: String(color.new(color.orange, 85)) } },
        ],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
        // alertcondition(is_buy_signal, "[Alert] Buy Signal") / alertcondition(is_sell_signal, "[Alert] Sell Signal")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendDoublePullbackV10Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendDoublePullbackV10Inputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '[Alert] Buy Signal', message: 'Stable Trend Buy: Double pullback 🚀' },
  { id: 'alert1', title: '[Alert] Sell Signal', message: 'Stable Trend Sell: Double pullback 🩸' },
];

export const TrendDoublePullbackV10 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
