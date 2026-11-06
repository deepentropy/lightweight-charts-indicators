/**
 * UT Bot Alerts
 *
 * ATR-based trailing stop that flips direction with price.
 * Trailing stop = price ± (key * ATR). Ratchets in trend direction only.
 * Alerts (alertcondition, `alerts` of the result): 'UT Long' when the close crosses over the stop (and is above it),
 * 'UT Short' when the stop crosses over the close (and the close is below it).
 *
 * Reference: "UT Bot Alerts"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface UTBotInputs {
  keyValue: number;
  atrPeriod: number;
}

export const defaultInputs: UTBotInputs = {
  keyValue: 1,
  atrPeriod: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'keyValue', type: 'float', title: 'Key Value (Sensitivity)', defval: 1, min: 0.1, step: 0.1 },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trailing Stop', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'UT Bot',
  shortTitle: 'UTBot',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface UtRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  trailStop: number[];
  plot0: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<UTBotInputs>): BarStudy<UtRun, Result> {
  const { keyValue, atrPeriod } = { ...defaultInputs, ...inputs };
  const warmup = atrPeriod;
  return {
    init() {
      const atr = taStep.atr(atrPeriod);
      const s: UtRun = {
        atr, trailStop: [], plot0: [], markers: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [atr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.trailStop, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const trailStop = s.trailStop;
      const nLoss = keyValue * (s.atr.step(bar.high, bar.low, bar.close) ?? 0);
      const src = bar.close;

      if (i === 0) {
        trailStop[i] = src - nLoss;
      } else {
        const prev = trailStop[i - 1];
        const prevSrc = bars[i - 1].close;
        if (src > prev && prevSrc > prev) {
          trailStop[i] = Math.max(prev, src - nLoss);
        } else if (src < prev && prevSrc < prev) {
          trailStop[i] = Math.min(prev, src + nLoss);
        } else if (src > prev) {
          trailStop[i] = src - nLoss;
        } else {
          trailStop[i] = src + nLoss;
        }
      }
      const v = trailStop[i];

      // Dynamic color: green when close > trailing stop, red otherwise
      if (i < warmup) {
        s.plot0[i] = { time: bar.time, value: NaN };
      } else {
        const above = src > v;
        const color = above ? '#26A69A' : '#EF5350';
        s.barColors.push({ time: bar.time as number, color });
        s.plot0[i] = { time: bar.time, value: v, color };
      }

      // Markers: buy when close crosses above trailing stop, sell when crosses below
      if (i >= warmup + 1) {
        const prevAbove = bars[i - 1].close > trailStop[i - 1];
        const curAbove = src > v;
        if (!prevAbove && curAbove) {
          s.markers.push({ time: bar.time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
        } else if (prevAbove && !curAbove) {
          s.markers.push({ time: bar.time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
        }
      }

      // buy = src > xATRTrailingStop and crossover(ema(src, 1), xATRTrailingStop); sell = src < xATRTrailingStop and
      // crossover(xATRTrailingStop, ema(src, 1)) (ema of length 1 = src); the stop is taken after the ATR warm-up
      const stop = i < warmup ? NaN : v;
      const pc = i > 0 ? bars[i - 1].close : NaN;
      const ps = i > 0 ? (i - 1 < warmup ? NaN : trailStop[i - 1]) : NaN;
      const buy = src > stop && pc <= ps;
      const sell = src < stop && ps <= pc;
      [buy, sell].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(bar.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(buy, "UT Long") / alertcondition(sell, "UT Short")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<UTBotInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<UTBotInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'UT Long', message: 'UT Long' },
  { id: 'alert1', title: 'UT Short', message: 'UT Short' },
];

export const UTBot = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
