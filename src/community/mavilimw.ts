/**
 * MavilimW
 *
 * Cascaded WMA chain: each level feeds into the next with increasing Fibonacci-like periods.
 * M1(fmal) → M2(smal) → M3(fmal+smal) → M4(smal+tmal) → M5(tmal+Fmal) → MAVW(Fmal+Ftmal)
 * Alerts (alertcondition, `alerts` of the result): 'MAVW BUY' (MAVW crosses over its previous value), 'MAVW SELL'
 * (crosses under it) and 'Color ALARM' (either).
 *
 * Reference: "MavilimW" by KivancOzbilgic
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'MAVW BUY', message: 'MAVW BUY!' },
  { id: 'alert1', title: 'MAVW SELL', message: 'MAVW SELL!' },
  { id: 'alert2', title: 'Color ALARM', message: 'MavilimW has changed color!' },
];

export interface MavilimWInputs {
  firstMALength: number;
  secondMALength: number;
}

export const defaultInputs: MavilimWInputs = {
  firstMALength: 3,
  secondMALength: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'firstMALength', type: 'int', title: 'First MA Length', defval: 3, min: 1 },
  { id: 'secondMALength', type: 'int', title: 'Second MA Length', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MavilimW', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'MavWOld', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'MavilimW',
  shortTitle: 'MAVW',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Wma = ReturnType<typeof taStep.wma>;

interface MavilimWRun extends BarRunState<Record<string, never>> {
  chain: Wma[];
  chainOld: Wma[];
  mavw: number[];
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MavilimWInputs>): BarStudy<MavilimWRun, Result> {
  const { firstMALength, secondMALength } = { ...defaultInputs, ...inputs };

  const fmal = firstMALength;
  const smal = secondMALength;
  const tmal = fmal + smal;
  const Fmal = smal + tmal;
  const Ftmal = tmal + Fmal;
  const Smal = Fmal + Ftmal;
  // M1(fmal) -> M2(smal) -> M3(tmal) -> M4(Fmal) -> M5(Ftmal) -> MAVW(Smal)
  const chainLengths = [fmal, smal, tmal, Fmal, Ftmal, Smal];
  // MavWOld: fixed Fibonacci periods 3/5/8/13/21/34
  const oldLengths = [3, 5, 8, 13, 21, 34];
  const warmup = Smal;
  const warmupOld = 34;
  const cascade = (steps: Wma[], lens: number[], x: number) => {
    let v = x;
    for (let k = 0; k < steps.length; k++) v = steps[k].step(v, lens[k]);
    return v;
  };
  return {
    init() {
      const chain = chainLengths.map(() => taStep.wma());
      const chainOld = oldLengths.map(() => taStep.wma());
      const s: MavilimWRun = {
        chain, chainOld, mavw: [], plot0: [], plot1: [], flags: [[], [], []], times: [[], [], []],
        steps: [...chain, ...chainOld], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.mavw, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;
      const mv = cascade(s.chain, chainLengths, close);
      const mavwV = mv ?? NaN;
      s.mavw[i] = mavwV;
      const val = i < warmup ? NaN : mavwV;
      if (isNaN(val)) s.plot0[i] = { time, value: NaN };
      else {
        const prev = i > 0 ? s.mavw[i - 1] : NaN;
        const color = val > prev ? '#2962FF' : val < prev ? '#EF5350' : '#FFEB3B';
        s.plot0[i] = { time, value: val, color };
      }
      const vo = cascade(s.chainOld, oldLengths, close);
      s.plot1[i] = { time, value: i < warmupOld || vo == null || isNaN(vo) ? NaN : vo };

      // crossover(MAVW, MAVW[1]) / crossunder(MAVW, MAVW[1]) / cross(MAVW, MAVW[1])
      const w = i > 0 ? s.mavw[i - 1] : NaN;
      const pv = i > 0 ? s.mavw[i - 1] : NaN;
      const pw = i > 1 ? s.mavw[i - 2] : NaN;
      const buy = mavwV > w && pv <= pw;
      const sell = mavwV < w && pv >= pw;
      [buy, sell, buy || sell].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MavilimWInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MavilimWInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MavilimW = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
