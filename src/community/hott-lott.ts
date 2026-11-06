/**
 * HIGH and LOW Optimized Trend Tracker (HOTT LOTT)
 *
 * Applies OTT (Optimized Trend Tracker) to highest-high and lowest-low
 * with selectable MA types. HOTT tracks upper trend, LOTT tracks lower trend.
 * Bar colors indicate breakout direction. VAR (the default MA) follows the original: na values count as 0 (nz), the
 * up / down moves are those of the source and their 9-bar sums are na before the 9th bar.
 * Alerts (alertcondition, `alerts` of the result): 'Price Crossover Alarm' when the close crosses over HOTT[2],
 * 'Price Crossunder Alarm' when it crosses under LOTT[2].
 *
 * Reference: "HOTT-LOTT" by KivancOzbilgic
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HottLottInputs {
  ottPeriod: number;
  percent: number;
  hlLength: number;
  maType: string;
}

export const defaultInputs: HottLottInputs = {
  ottPeriod: 2,
  percent: 0.6,
  hlLength: 10,
  maType: 'VAR',
};

export const inputConfig: InputConfig[] = [
  { id: 'ottPeriod', type: 'int', title: 'OTT Period', defval: 2, min: 1 },
  { id: 'percent', type: 'float', title: 'Percent', defval: 0.6, min: 0.01, step: 0.1 },
  { id: 'hlLength', type: 'int', title: 'HL Length', defval: 10, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'VAR', options: ['SMA', 'EMA', 'WMA', 'DEMA', 'TMA', 'VAR', 'WWMA', 'ZLEMA', 'TSF', 'HULL'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'hott', title: 'HOTT', color: '#2196F3', lineWidth: 2 },
  { id: 'lott', title: 'LOTT', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'HOTT LOTT',
  shortTitle: 'HOTTLOTT',
  overlay: true,
};

/** A selectable MA stepped bar by bar (`i`: the bar); `arr` gives an array indexed by bar (a series of the run) */
interface MaStep {
  step(v: number, i: number): number;
  commit(): void;
}

function maStep(length: number, maType: string, arr: () => number[]): MaStep {
  switch (maType) {
    case 'SMA': {
      const m = new WindowSma(length);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }

    case 'EMA': {
      const m = taStep.ema(length);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }

    case 'WMA': {
      const m = taStep.wma();
      return { step: (v) => m.step(v, length), commit: () => m.commit() };
    }

    case 'DEMA': {
      const ema1 = taStep.ema(length);
      const ema2 = taStep.ema(length);
      return {
        step: (v) => {
          const a = ema1.step(v);
          const b = ema2.step(a);
          return isNaN(a) || isNaN(b) ? NaN : 2 * a - b;
        },
        commit: () => { ema1.commit(); ema2.commit(); },
      };
    }

    case 'TMA': {
      const halfLen = Math.ceil(length / 2);
      const sma1 = new WindowSma(halfLen);
      const sma2Len = Math.floor(length / 2) + 1;
      const sma2 = new WindowSma(sma2Len);
      return { step: (v) => sma2.step(sma1.step(v)), commit: () => { sma1.commit(); sma2.commit(); } };
    }

    case 'VAR': {
      const valpha = 2 / (length + 1);
      const srcArr = arr();
      const result = arr();
      const vud1 = arr();
      const vdd1 = arr();

      // Var_Func: vud1 = src > src[1] ? src - src[1] : 0 (na compares false); vUD = math.sum(vud1, 9) (na before 9
      // bars); vCMO = nz((vUD - vDD) / (vUD + vDD));
      // VAR := nz(valpha * abs(vCMO) * src) + (1 - valpha * abs(vCMO)) * nz(VAR[1])
      const nz = (v: number) => (Number.isFinite(v) ? v : 0);
      return {
        step: (s, i) => {
          srcArr[i] = s;
          const s1 = i > 0 ? srcArr[i - 1] : NaN;

          vud1[i] = s > s1 ? s - s1 : 0;
          vdd1[i] = s < s1 ? s1 - s : 0;

          let sumUD = NaN;
          let sumDD = NaN;
          if (i >= 8) {
            sumUD = 0;
            sumDD = 0;
            for (let j = 0; j < 9; j++) {
              sumUD += vud1[i - j];
              sumDD += vdd1[i - j];
            }
          }

          const vCMO = nz((sumUD - sumDD) / (sumUD + sumDD));
          const prev = i > 0 ? result[i - 1] : NaN;
          result[i] = nz(valpha * Math.abs(vCMO) * s) + (1 - valpha * Math.abs(vCMO)) * nz(prev);
          return result[i];
        },
        commit: () => {},
      };
    }

    case 'WWMA': {
      const alpha = 1 / length;
      const result = arr();
      return {
        step: (v, i) => {
          if (i === 0) {
            result[i] = v;
          } else {
            result[i] = alpha * v + (1 - alpha) * result[i - 1];
          }
          return result[i];
        },
        commit: () => {},
      };
    }

    case 'ZLEMA': {
      const lag = Math.floor((length - 1) / 2);
      const srcArr = arr();
      const m = taStep.ema(length);
      return {
        step: (s, i) => {
          srcArr[i] = s;
          const lagged = i >= lag ? srcArr[i - lag] : srcArr[0];
          return m.step(s + (s - lagged));
        },
        commit: () => m.commit(),
      };
    }

    case 'TSF': {
      const lr0 = taStep.linreg(length, 0);
      const lr1 = taStep.linreg(length, 1);
      return {
        step: (v) => {
          const a = lr0.step(v);
          const b = lr1.step(v);
          return isNaN(a) || isNaN(b) ? NaN : a + (a - b);
        },
        commit: () => { lr0.commit(); lr1.commit(); },
      };
    }

    case 'HULL': {
      const halfLen = Math.max(1, Math.floor(length / 2));
      const sqrtLen = Math.max(1, Math.round(Math.sqrt(length)));
      const wmaHalf = taStep.wma();
      const wmaFull = taStep.wma();
      const wmaDiff = taStep.wma();
      return {
        step: (v) => {
          const diff = wmaHalf.step(v, halfLen) * 2 - wmaFull.step(v, length);
          return wmaDiff.step(diff, sqrtLen);
        },
        commit: () => { wmaHalf.commit(); wmaFull.commit(); wmaDiff.commit(); },
      };
    }

    default: {
      const m = taStep.ema(length);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }
  }
}

/** OTT of a MA, bar by bar: its value on bar `i` (the arrays are series of the run) */
function ottStep(percent: number, arr: () => number[]): (ma: number, i: number) => number {
  const maArr = arr();
  const longStop = arr();
  const shortStop = arr();
  const dir = arr();
  return (ma, i) => {
    maArr[i] = ma;
    if (isNaN(ma)) {
      longStop[i] = NaN;
      shortStop[i] = NaN;
      dir[i] = i > 0 ? dir[i - 1] : 1;
      return NaN;
    }

    const fark = ma * percent * 0.01;

    // Long stop ratchets up
    const rawLong = ma - fark;
    if (i === 0 || isNaN(longStop[i - 1])) {
      longStop[i] = rawLong;
    } else {
      longStop[i] = (maArr[i - 1] > longStop[i - 1]) ? Math.max(rawLong, longStop[i - 1]) : rawLong;
    }

    // Short stop ratchets down
    const rawShort = ma + fark;
    if (i === 0 || isNaN(shortStop[i - 1])) {
      shortStop[i] = rawShort;
    } else {
      shortStop[i] = (maArr[i - 1] < shortStop[i - 1]) ? Math.min(rawShort, shortStop[i - 1]) : rawShort;
    }

    // Direction
    if (i === 0) {
      dir[i] = 1;
    } else if (ma > shortStop[i - 1]) {
      dir[i] = 1;
    } else if (ma < longStop[i - 1]) {
      dir[i] = -1;
    } else {
      dir[i] = dir[i - 1];
    }

    const MT = dir[i] === 1 ? longStop[i] : shortStop[i];
    return ma > MT ? MT * (200 + percent) / 200 : MT * (200 - percent) / 200;
  };
}

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface HottLottRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  maHigh: MaStep;
  maLow: MaStep;
  ottHigh: (ma: number, i: number) => number;
  ottLow: (ma: number, i: number) => number;
  hottRaw: number[];
  lottRaw: number[];
  hottPlot: Point[];
  lottPlot: Point[];
  fillColors: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<HottLottInputs>): BarStudy<HottLottRun, Result> {
  const { ottPeriod, percent, hlLength, maType } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(hlLength, ottPeriod) + 2;
  return {
    init() {
      const series: unknown[][] = [];
      const arr = (): number[] => {
        const a: number[] = [];
        series.push(a);
        return a;
      };
      // Highest high and lowest low over hlLength
      const hh = new WindowExtreme(false, hlLength);
      const ll = new WindowExtreme(true, hlLength);
      // Apply MA to both
      const maHigh = maStep(ottPeriod, maType, arr);
      const maLow = maStep(ottPeriod, maType, arr);
      // Apply OTT to both
      const ottHigh = ottStep(percent, arr);
      const ottLow = ottStep(percent, arr);
      const s: HottLottRun = {
        hh, ll, maHigh, maLow, ottHigh, ottLow, hottRaw: [], lottRaw: [], hottPlot: [], lottPlot: [], fillColors: [],
        barColors: [], flags: [[], []], times: [[], []],
        steps: [hh, ll, maHigh, maLow], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors, ...s.times];
      s.series = [...series, s.hottRaw, s.lottRaw, s.hottPlot, s.lottPlot, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const hottRaw = s.hottRaw;
      const lottRaw = s.lottRaw;
      hottRaw[i] = s.ottHigh(s.maHigh.step(s.hh.step(b.high), i), i);
      lottRaw[i] = s.ottLow(s.maLow.step(s.ll.step(b.low), i), i);

      // 2-bar delay: nz(HOTT[2]), nz(LOTT[2])
      if (i < warmup + 2) {
        s.hottPlot[i] = { time: t, value: NaN };
        s.lottPlot[i] = { time: t, value: NaN };
      } else {
        const h = hottRaw[i - 2];
        const l = lottRaw[i - 2];
        s.hottPlot[i] = { time: t, value: isNaN(h) ? NaN : h };
        s.lottPlot[i] = { time: t, value: isNaN(l) ? NaN : l };
      }

      // Fill between HOTT and LOTT
      s.fillColors[i] = i < warmup + 2 ? 'transparent' : 'rgba(153,21,255,0.2)';

      // Bar colors: close > HOTT[2] -> cyan, close < LOTT[2] -> magenta
      if (i >= warmup + 2) {
        const h2 = hottRaw[i - 2];
        const l2 = lottRaw[i - 2];
        if (!isNaN(h2) && !isNaN(l2)) {
          if (b.close > h2) {
            s.barColors.push({ time: t as number, color: '#00FFFF' });
          } else if (b.close < l2) {
            s.barColors.push({ time: t as number, color: '#FF00FF' });
          }
        }
      }

      // alertcondition(ta.crossover(close, HOTT[2])) / alertcondition(ta.crossunder(close, LOTT[2]))
      const hott2 = i >= 2 ? hottRaw[i - 2] : NaN;
      const lott2 = i >= 2 ? lottRaw[i - 2] : NaN;
      const pc = i > 0 ? bars[i - 1].close : NaN;
      const ph = i >= 3 ? hottRaw[i - 3] : NaN;
      const pl = i >= 3 ? lottRaw[i - 3] : NaN;
      const over = b.close > hott2 && pc <= ph;
      const under = b.close < lott2 && pc >= pl;
      s.flags[0][i] = over;
      s.flags[1][i] = under;
      if (over) s.times[0].push(t as number);
      if (under) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { hott: s.hottPlot.slice(), lott: s.lottPlot.slice() },
        fills: [{ plot1: 'hott', plot2: 'lott', options: { color: 'rgba(153,21,255,0.5)' }, colors: s.fillColors.slice() }],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HottLottInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HottLottInputs> = {},
): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Price Crossover Alarm', message: 'PRICE OVER HOTT - BUY SIGNAL!' },
  { id: 'alert1', title: 'Price Crossunder Alarm', message: 'PRICE UNDER LOTT - SELL SIGNAL!' },
];

export const HottLott = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
