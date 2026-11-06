/**
 * MFI + RSI + EMA Dynamic Signals
 *
 * Fast and slow EMAs of the close on the price chart, with the MFI and the RSI of the close (pane-only plots) and
 * their levels. A buy signal on the bar after (the MFI crosses above the oversold level, or the fast EMA crosses above
 * the slow EMA) with (the RSI above the buy threshold, or the EMAs within the proximity percentage of each other); a
 * sell signal on the bar after (the MFI crosses under the overbought level, or the fast EMA crosses under the slow
 * EMA) with (the RSI under the sell threshold, or the EMAs within the proximity percentage).
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' and 'Sell Signal', true on the bars of the signals.
 *
 * Reference: "MFI + RSI + EMA Dynamic Signals" by Raisontgh
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Raisontgh
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'MFI + RSI + EMA Buy Signal v6' },
  { id: 'alert1', title: 'Sell Signal', message: 'MFI + RSI + EMA Sell Signal v6' },
];

export interface MfiRsiEmaDynamicSignalsInputs {
  mfiLength: number;
  mfiOverbought: number;
  mfiOversold: number;
  rsiLength: number;
  rsiBuyThreshold: number;
  rsiSellThreshold: number;
  fastEmaLength: number;
  slowEmaLength: number;
  /** EMA proximity threshold (%) */
  emaProximity: number;
}

export const defaultInputs: MfiRsiEmaDynamicSignalsInputs = {
  mfiLength: 14,
  mfiOverbought: 70,
  mfiOversold: 30,
  rsiLength: 14,
  rsiBuyThreshold: 45,
  rsiSellThreshold: 55,
  fastEmaLength: 9,
  slowEmaLength: 21,
  emaProximity: 0.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'mfiLength', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'mfiOverbought', type: 'int', title: 'MFI Overbought Level', defval: 70, min: 50, max: 100 },
  { id: 'mfiOversold', type: 'int', title: 'MFI Oversold Level', defval: 30, min: 0, max: 50 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiBuyThreshold', type: 'int', title: 'RSI Buy Threshold', defval: 45, min: 0, max: 100 },
  { id: 'rsiSellThreshold', type: 'int', title: 'RSI Sell Threshold', defval: 55, min: 0, max: 100 },
  { id: 'fastEmaLength', type: 'int', title: 'Fast EMA Length', defval: 9, min: 1 },
  { id: 'slowEmaLength', type: 'int', title: 'Slow EMA Length', defval: 21, min: 1 },
  { id: 'emaProximity', type: 'float', title: 'EMA Proximity Threshold (%)', defval: 0.5, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'MFI', color: color.blue, lineWidth: 1, display: 'pane' },
  { id: 'plot3', title: 'RSI', color: color.orange, lineWidth: 1, display: 'pane' },
];

export const metadata = {
  title: 'MFI + RSI + EMA Dynamic Signals',
  shortTitle: 'MFI + RSI + EMA Dynamic Signals',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface MfiRun extends BarRunState<Record<string, never>> {
  mfi: ReturnType<typeof taStep.mfi>;
  rsi: ReturnType<typeof taStep.rsi>;
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  emaUp: ReturnType<typeof taStep.crossover>;
  emaDown: ReturnType<typeof taStep.crossunder>;
  mfiUp: ReturnType<typeof taStep.crossover>;
  mfiDown: ReturnType<typeof taStep.crossunder>;
  mfiArr: number[];
  bullish: boolean[];
  bearish: boolean[];
  near: boolean[];
  crossover: boolean[];
  crossunder: boolean[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<MfiRsiEmaDynamicSignalsInputs>): BarStudy<MfiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: MfiRun = {
        mfi: taStep.mfi(cfg.mfiLength), rsi: taStep.rsi(cfg.rsiLength), fast: taStep.ema(cfg.fastEmaLength),
        slow: taStep.ema(cfg.slowEmaLength), emaUp: taStep.crossover(), emaDown: taStep.crossunder(),
        mfiUp: taStep.crossover(), mfiDown: taStep.crossunder(), mfiArr: [], bullish: [], bearish: [], near: [],
        crossover: [], crossunder: [], plots: [[], [], [], []], flags: [[], []], times: [[], []], markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.mfi, s.rsi, s.fast, s.slow, s.emaUp, s.emaDown, s.mfiUp, s.mfiDown];
      s.lists = [s.markers, ...s.times];
      s.series = [s.mfiArr, s.bullish, s.bearish, s.near, s.crossover, s.crossunder, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;
      const mfi = s.mfi.step(close, b.volume ?? NaN);
      const rsi = s.rsi.step(close);
      const fastEma = s.fast.step(close);
      const slowEma = s.slow.step(close);
      s.mfiArr[i] = mfi;

      s.bullish[i] = gt(rsi, cfg.rsiBuyThreshold);
      s.bearish[i] = lt(rsi, cfg.rsiSellThreshold);
      // ema_diff_percent = math.abs((fast_ema - slow_ema) / slow_ema * 100); a plain division (x / 0 is infinite)
      s.near[i] = le(Math.abs(((fastEma - slowEma) / slowEma) * 100), cfg.emaProximity);
      s.crossover[i] = s.emaUp.step(fastEma, slowEma);
      s.crossunder[i] = s.emaDown.step(fastEma, slowEma);
      // ta.crossover(mfi[1], level) / ta.crossunder(mfi[1], level)
      const mfi1 = i > 0 ? s.mfiArr[i - 1] : NaN;
      const mfiUp = s.mfiUp.step(mfi1, cfg.mfiOversold);
      const mfiDown = s.mfiDown.step(mfi1, cfg.mfiOverbought);

      let buy = false;
      let sell = false;
      if (i >= 1) {
        const near1 = s.near[i - 1];
        buy = (mfiUp || s.crossover[i - 1]) && (s.bullish[i - 1] || near1);
        sell = (mfiDown || s.crossunder[i - 1]) && (s.bearish[i - 1] || near1);
        // plotshape(buy_signal, "Buy Signal", shape.triangleup, location.belowbar, color.green, size = size.small)
        if (buy) s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
        // plotshape(sell_signal, "Sell Signal", shape.triangledown, location.abovebar, color.red, size = size.small)
        if (sell) s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
      }
      // alertcondition(buy_signal, "Buy Signal") / alertcondition(sell_signal, "Sell Signal")
      [buy, sell].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time as number);
      });
      s.plots[0][i] = { time, value: fin(fastEma) };
      s.plots[1][i] = { time, value: fin(slowEma) };
      s.plots[2][i] = { time, value: fin(mfi) };
      s.plots[3][i] = { time, value: fin(rsi) };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        hlines: [
          { value: cfg.mfiOverbought, options: { title: 'Overbought', color: color.red, linestyle: 'dashed' } },
          { value: cfg.mfiOversold, options: { title: 'Oversold', color: color.green, linestyle: 'dashed' } },
          { value: cfg.rsiBuyThreshold, options: { title: 'RSI Buy Threshold', color: color.green, linestyle: 'dashed' } },
          { value: cfg.rsiSellThreshold, options: { title: 'RSI Sell Threshold', color: color.red, linestyle: 'dashed' } },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MfiRsiEmaDynamicSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MfiRsiEmaDynamicSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const MfiRsiEmaDynamicSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
