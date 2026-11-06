/**
 * Tillson T3 Moving Average
 *
 * Six-stage EMA cascade with volume factor coefficients.
 * Source = (high + low + 2*close) / 4
 * e1..e6 = cascaded EMA(prev, length)
 * T3 = c1*e6 + c2*e5 + c3*e4 + c4*e3
 * where c1=-a^3, c2=3a^2+3a^3, c3=-6a^2-3a-3a^3, c4=1+3a+a^3+3a^2
 *
 * Alerts (alertcondition, `alerts` of the result): 'T3 BUY' when T3 crosses over T3[1] (starts rising), 'T3 SELL'
 * when it crosses under (starts falling), 'Color ALARM' on either cross.
 *
 * Reference: "Tillson T3" by KivancOzbilgic (fr3762)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TillsonT3Inputs {
  length: number;
  volumeFactor: number;
  lengthFibo: number;
  volumeFactorFibo: number;
  showFibo: boolean;
}

export const defaultInputs: TillsonT3Inputs = {
  length: 8,
  volumeFactor: 0.7,
  lengthFibo: 5,
  volumeFactorFibo: 0.618,
  showFibo: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'T3 Length', defval: 8, min: 1 },
  { id: 'volumeFactor', type: 'float', title: 'Volume Factor', defval: 0.7, min: 0, max: 1, step: 0.01 },
  { id: 'lengthFibo', type: 'int', title: 'T3 Length fibo', defval: 5, min: 1 },
  { id: 'volumeFactorFibo', type: 'float', title: 'Volume Factor fibo', defval: 0.618, min: 0, max: 1, step: 0.001 },
  { id: 'showFibo', type: 'bool', title: 'Show T3 Fibonacci Ratio Line?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3', color: '#4CAF50', lineWidth: 3 },
  { id: 'plot1', title: 'T3fibo', color: '#2196F3', lineWidth: 2 },
];

export const metadata = {
  title: 'Tillson T3',
  shortTitle: 'T3',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Ema = ReturnType<typeof taStep.ema>;

/** The six chained EMAs of one T3 and its coefficients */
interface T3Chain {
  e: Ema[];
  c1: number;
  c2: number;
  c3: number;
  c4: number;
}

function t3Chain(length: number, a: number): T3Chain {
  const e: Ema[] = [];
  for (let k = 0; k < 6; k++) e.push(taStep.ema(length));
  return {
    e,
    c1: -a * a * a,
    c2: 3 * a * a + 3 * a * a * a,
    c3: -6 * a * a - 3 * a - 3 * a * a * a,
    c4: 1 + 3 * a + a * a * a + 3 * a * a,
  };
}

function t3Step(c: T3Chain, src: number): number {
  const e1 = c.e[0].step(src);
  const e2 = c.e[1].step(e1);
  const e3 = c.e[2].step(e2);
  const e4 = c.e[3].step(e3);
  const e5 = c.e[4].step(e4);
  const e6 = c.e[5].step(e5);
  return e6 * c.c1 + e5 * c.c2 + e4 * c.c3 + e3 * c.c4;
}

interface T3Run extends BarRunState<Record<string, never>> {
  main: T3Chain;
  fibo: T3Chain | null;
  t3: number[];
  t3f: number[];
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TillsonT3Inputs>): BarStudy<T3Run, Result> {
  const { length, volumeFactor, lengthFibo, volumeFactorFibo, showFibo } = { ...defaultInputs, ...inputs };
  const warmup = length * 6;
  const warmupF = lengthFibo * 6;
  return {
    init() {
      const main = t3Chain(length, volumeFactor);
      // Second T3 with Fibonacci factor (Pine: T3 Length fibo=5, Volume Factor fibo=0.618)
      const fibo = showFibo ? t3Chain(lengthFibo, volumeFactorFibo) : null;
      const s: T3Run = {
        main, fibo, t3: [], t3f: [], plot0: [], plot1: [], flags: [[], [], []], times: [[], [], []],
        steps: [...main.e, ...(fibo ? fibo.e : [])], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.t3, s.t3f, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const src = (b.high + b.low + 2 * b.close) / 4;
      const t3 = t3Step(s.main, src);
      s.t3[i] = t3;
      const prev = i > 0 ? s.t3[i - 1] : NaN;
      const val = i < warmup ? NaN : t3;
      if (isNaN(val)) s.plot0[i] = { time, value: NaN };
      else s.plot0[i] = { time, value: val, color: val > prev ? '#4CAF50' : val < prev ? '#FF5252' : '#FFEB3B' };

      if (s.fibo) {
        const t3f = t3Step(s.fibo, src);
        s.t3f[i] = t3f;
        const valF = i < warmupF ? NaN : t3f;
        if (isNaN(valF)) s.plot1[i] = { time, value: NaN };
        else {
          const prevF = i > 0 ? s.t3f[i - 1] : NaN;
          // Pine: blue if rising, purple if falling, yellow if flat
          s.plot1[i] = { time, value: valF, color: valF > prevF ? '#2196F3' : valF < prevF ? '#9C27B0' : '#FFEB3B' };
        }
      }

      // crossover(T3, T3[1]) / crossunder(T3, T3[1]) / cross(T3, T3[1])
      const prev2 = i > 1 ? s.t3[i - 2] : NaN;
      const buy = t3 > prev && prev <= prev2;
      const sell = t3 < prev && prev >= prev2;
      [buy, sell, buy || sell].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = { 'plot0': s.plot0.slice() };
      if (showFibo) plots['plot1'] = s.plot1.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TillsonT3Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TillsonT3Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'T3 BUY', message: 'T3 BUY!' },
  { id: 'alert1', title: 'T3 SELL', message: 'T3 SELL!' },
  { id: 'alert2', title: 'Color ALARM', message: 'T3 has changed color!' },
];

export const TillsonT3 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
