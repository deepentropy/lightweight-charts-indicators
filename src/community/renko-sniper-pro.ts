/**
 * Renko Sniper PRO (Liquidity Sweep + EMA + ST + RSI)
 *
 * A fast and a slow EMA of the close and a Supertrend line (green when the Supertrend direction is 1, red
 * otherwise). A liquidity sweep is marked when the bar goes past the highest high (lowest low) of the last
 * `lookback` bars and closes back inside: high > ta.highest(high, lookback) and close < ta.highest(high, lookback)
 * (low < ta.lowest(low, lookback) and close > ta.lowest(low, lookback)). The window of ta.highest / ta.lowest
 * includes the current bar, so the high is never above it and the sweep shapes never show (as in the original).
 * The long / short conditions (sweep + EMA cross + trend + Supertrend + RSI) feed the original's alert() calls
 * (`alertCalls` of the result, once per bar close); as they need a sweep, they never fire either. The script works on
 * any chart type; it reads no Renko data.
 *
 * Reference: "Renko Sniper PRO (Liquidity Sweep + EMA + ST + RSI)" by zachsprad
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © zachsprad
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { AlertCall, MarkerData } from '../types';

/** The original calls alert() */
export const hasAlertFunction = true;

export interface RenkoSniperProInputs {
  emaFastLen: number;
  emaSlowLen: number;
  /** RSI length (only used by the alert conditions) */
  rsiLen: number;
  atrLen: number;
  factor: number;
  /** Liquidity lookback (bars) */
  lookback: number;
  /** Sweep sensitivity (%): computed by the original script but not used by any output */
  sweepBuffer: number;
}

export const defaultInputs: RenkoSniperProInputs = {
  emaFastLen: 9,
  emaSlowLen: 21,
  rsiLen: 14,
  atrLen: 10,
  factor: 3.0,
  lookback: 10,
  sweepBuffer: 0.1,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFastLen', type: 'int', title: 'Fast EMA', defval: 9 },
  { id: 'emaSlowLen', type: 'int', title: 'Slow EMA', defval: 21 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'atrLen', type: 'int', title: 'Supertrend ATR Length', defval: 10 },
  { id: 'factor', type: 'float', title: 'Supertrend Factor', defval: 3.0 },
  { id: 'lookback', type: 'int', title: 'Liquidity Lookback (bars)', defval: 10 },
  { id: 'sweepBuffer', type: 'float', title: 'Sweep Sensitivity (%)', defval: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 9', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'EMA 21', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Supertrend', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'Renko Sniper PRO',
  shortTitle: 'Renko Sniper PRO',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] };

interface RenkoVars {
  /** emaFast[1], emaSlow[1] */
  prevFast: number;
  prevSlow: number;
}

interface RenkoRun extends BarRunState<RenkoVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  st: ReturnType<typeof taStep.supertrend>;
  hh: WindowExtreme;
  ll: WindowExtreme;
  rsi: ReturnType<typeof taStep.rsi>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<RenkoSniperProInputs>): BarStudy<RenkoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: RenkoRun = {
        fast: taStep.ema(cfg.emaFastLen), slow: taStep.ema(cfg.emaSlowLen), st: taStep.supertrend(cfg.factor, cfg.atrLen),
        hh: new WindowExtreme(false, cfg.lookback), ll: new WindowExtreme(true, cfg.lookback), rsi: taStep.rsi(cfg.rsiLen),
        plot0: [], plot1: [], plot2: [], markers: [], alertCalls: [],
        steps: [], vars: { prevFast: NaN, prevSlow: NaN }, lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.st, s.hh, s.ll, s.rsi];
      s.lists = [s.markers, s.alertCalls];
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const v = s.vars;
      const emaFast = s.fast.step(b.close);
      const emaSlow = s.slow.step(b.close);
      const [supertrend, direction] = s.st.step(b.high, b.low, b.close);
      const highestHigh = s.hh.step(b.high);
      const lowestLow = s.ll.step(b.low);
      const rsi = s.rsi.step(b.close);
      s.plot0[i] = { time: b.time, value: finite(emaFast) };
      s.plot1[i] = { time: b.time, value: finite(emaSlow) };
      // plot(supertrend, color = direction == 1 ? color.green : color.red)
      s.plot2[i] = { time: b.time, value: finite(supertrend), color: eq(direction, 1) ? color.green : color.red };

      const liquiditySweepLow = lt(b.low, lowestLow) && gt(b.close, lowestLow);
      const liquiditySweepHigh = gt(b.high, highestHigh) && lt(b.close, highestHigh);
      // bullCross = ta.crossover(emaFast, emaSlow), bearCross = ta.crossunder(emaFast, emaSlow)
      const bullCross = i > 0 && gt(emaFast, emaSlow) && !gt(v.prevFast, v.prevSlow)
        && !isNaN(v.prevFast) && !isNaN(v.prevSlow);
      const bearCross = i > 0 && lt(emaFast, emaSlow) && !lt(v.prevFast, v.prevSlow)
        && !isNaN(v.prevFast) && !isNaN(v.prevSlow);
      v.prevFast = emaFast;
      v.prevSlow = emaSlow;
      // longCondition = liquiditySweepLow and bullCross and close > emaSlow and direction == 1 and rsi > 50
      const longCondition = liquiditySweepLow && bullCross && gt(b.close, emaSlow) && eq(direction, 1) && gt(rsi, 50);
      const shortCondition = liquiditySweepHigh && bearCross && lt(b.close, emaSlow) && eq(direction, -1) && lt(rsi, 50);
      if (longCondition) {
        s.alertCalls.push({ time: t, message: '🟢 LONG SWEEP: Liquidity Grab + Bullish Confirmation', freq: 'once_per_bar_close' });
      }
      if (shortCondition) {
        s.alertCalls.push({ time: t, message: '🔴 SHORT SWEEP: Liquidity Grab + Bearish Confirmation', freq: 'once_per_bar_close' });
      }
      // liquiditySweepLow = low < lowestLow and close > lowestLow
      if (liquiditySweepLow) {
        s.markers.push({ time: b.time as number, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
      }
      // liquiditySweepHigh = high > highestHigh and close < highestHigh
      if (liquiditySweepHigh) {
        s.markers.push({ time: b.time as number, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RenkoSniperProInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RenkoSniperProInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RenkoSniperPro = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
