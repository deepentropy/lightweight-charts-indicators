/**
 * Nick Rypock Trailing Reverse (NRTR)
 *
 * ATR-based dynamic trailing reverse indicator.
 * In uptrend, trail = max(prev_trail, close - k*ATR).
 * If close < trail, flip to downtrend (and vice versa).
 * Two plot series: green for uptrend, red for downtrend, each filled to ohlc4 (hidden plot) while its trend is on.
 *
 * Alerts (alertcondition, `alerts` of the result): "NRTR Direction Change", "NRTR Buy" and "NRTR Sell" (the trend
 * changes, from the first drawn bar).
 *
 * Reference: "Nick Rypock Trailing Reverse"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'NRTR Direction Change', message: 'NRTR has changed direction, {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'NRTR Buy', message: 'NRTR Buy, {{exchange}}:{{ticker}}' },
  { id: 'alert2', title: 'NRTR Sell', message: 'NRTR Sell, {{exchange}}:{{ticker}}' },
];

export interface NRTRInputs {
  atrPeriod: number;
  mult: number;
}

export const defaultInputs: NRTRInputs = {
  atrPeriod: 14,
  mult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 14, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'NRTR Up', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'NRTR Down', color: '#EF5350', lineWidth: 2 },
  { id: 'plot2', title: 'Mid Price', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Nick Rypock Trailing Reverse',
  shortTitle: 'NRTR',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface NrtrRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  trail: number[];
  /** 1 = up, -1 = down */
  dir: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  longFill: string[];
  shortFill: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<NRTRInputs>): BarStudy<NrtrRun, Result> {
  const { atrPeriod, mult } = { ...defaultInputs, ...inputs };
  const warmup = atrPeriod;
  return {
    init() {
      const atr = taStep.atr(atrPeriod);
      const s: NrtrRun = {
        atr, trail: [], dir: [], plot0: [], plot1: [], plot2: [], longFill: [], shortFill: [], markers: [],
        flags: [[], [], []], times: [[], [], []],
        steps: [atr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.trail, s.dir, s.plot0, s.plot1, s.plot2, s.longFill, s.shortFill, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const rawAtr = s.atr.step(b.high, b.low, close);
      const atrVal = (rawAtr != null && !isNaN(rawAtr) ? rawAtr : 0) * mult;

      let trail: number;
      let dir: number;
      if (i === 0 || atrVal === 0) {
        trail = close;
        dir = 1;
      } else {
        const prevTrail = s.trail[i - 1];
        const prevDir = s.dir[i - 1];
        if (prevDir === 1) {
          // Uptrend: trail ratchets up
          const newTrail = close - atrVal;
          trail = Math.max(prevTrail, newTrail);
          if (close < trail) {
            dir = -1;
            trail = close + atrVal;
          } else {
            dir = 1;
          }
        } else {
          // Downtrend: trail ratchets down
          const newTrail = close + atrVal;
          trail = Math.min(prevTrail, newTrail);
          if (close > trail) {
            dir = 1;
            trail = close - atrVal;
          } else {
            dir = -1;
          }
        }
      }
      s.trail[i] = trail;
      s.dir[i] = dir;

      // Markers: buy when trend flips to 1, sell when trend flips to -1
      const on = i >= warmup;
      const prevDir = i > 0 ? s.dir[i - 1] : undefined;
      const buy = on && dir === 1 && prevDir === -1;
      const sell = on && dir === -1 && prevDir === 1;
      if (buy) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: '#26A69A', text: '' });
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
      } else if (sell) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: '#EF5350', text: '' });
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
      }
      const change = buy || sell;
      s.flags[0][i] = change;
      s.flags[1][i] = buy;
      s.flags[2][i] = sell;
      if (change) s.times[0].push(b.time as number);
      if (buy) s.times[1].push(b.time as number);
      if (sell) s.times[2].push(b.time as number);

      s.plot0[i] = { time: b.time, value: (!on || dir !== 1) ? NaN : trail };
      s.plot1[i] = { time: b.time, value: (!on || dir !== -1) ? NaN : trail };
      // midPricePlot = plot(ohlc4, display = display.none)
      s.plot2[i] = { time: b.time, value: (b.open + b.high + b.low + b.close) / 4 };
      // fill(midPricePlot, longStopPlot, 'Long State Filling', trend == 1 ? long fill : na)
      // fill(midPricePlot, shortStopPlot, 'Short State Filling', trend == -1 ? short fill : na)
      s.longFill[i] = on && dir === 1 ? 'rgba(38,166,154,0.15)' : 'rgba(0,0,0,0)';
      s.shortFill[i] = on && dir === -1 ? 'rgba(239,83,80,0.15)' : 'rgba(0,0,0,0)';
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [
          { plot1: 'plot2', plot2: 'plot0', options: { title: 'Long State Filling', color: 'rgba(38,166,154,0.15)' }, colors: s.longFill.slice() },
          { plot1: 'plot2', plot2: 'plot1', options: { title: 'Short State Filling', color: 'rgba(239,83,80,0.15)' }, colors: s.shortFill.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NRTRInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<NRTRInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const NRTR = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
