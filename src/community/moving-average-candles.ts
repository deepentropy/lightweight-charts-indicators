/**
 * Moving Average Candles
 *
 * Candles drawn from a moving average of each of open, high, low and close (same MA type and length for the four
 * prices). MA types: SMA, EMA, RMA, WMA, VWMA, HMA, T3 (six chained EMAs, factor 0.7), DEMA, TEMA, KAMA (efficiency
 * ratio of the 1-bar change over the sum of the last Length 1-bar changes, fast 2 / slow 30), ZLEMA (EMA of
 * src + (src - src[(Length - 1) / 2])), McGinley Dynamic and EPMA (src * alpha + sum of the Length - 1 previous
 * values * (1 - alpha) / (Length - 1)). The candle is green when the MA close >= the MA open, else red.
 *
 * Reference: "Moving Average Candles" by aleskxyz
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowSum, WindowVwma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface MovingAverageCandlesInputs {
  /** 'SMA' | 'EMA' | 'RMA' | 'WMA' | 'VWMA' | 'HMA' | 'T3' | 'DEMA' | 'TEMA' | 'KAMA' | 'ZLEMA' | 'McGinley' | 'EPMA' */
  maType: string;
  maLength: number;
}

export const defaultInputs: MovingAverageCandlesInputs = {
  maType: 'SMA',
  maLength: 14,
};

export const inputConfig: InputConfig[] = [
  {
    id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA',
    options: ['SMA', 'EMA', 'RMA', 'WMA', 'VWMA', 'HMA', 'T3', 'DEMA', 'TEMA', 'KAMA', 'ZLEMA', 'McGinley', 'EPMA'],
  },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14, min: 1, max: 1000 },
];

// Only candles (plotcandle): no line plots
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'maCandles', title: 'MA Candles' },
];

export const metadata = {
  title: 'Moving Average Candles',
  shortTitle: 'MA Candles',
  overlay: true,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10, a != b when |a - b| > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };

interface MacVars {
  /** var float kama / var float mg: one per price (open, high, low, close), changed in place */
  kama: number[];
  mg: number[];
}

/** One moving average of one price, stepped bar by bar */
interface Ma {
  steps: Committable[];
  step(s: MacRun, i: number, v: number, vol: number): number;
}

interface MacRun extends BarRunState<MacVars> {
  mas: Ma[];
  /** The values of each price (for src[1] / src[lag]) */
  src: number[][];
  candles: PlotCandleData[];
}

function study(inputs: Partial<MovingAverageCandlesInputs>): BarStudy<MacRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.maLength;

  const emaChain = (count: number) => Array.from({ length: count }, () => taStep.ema(len));
  const makeMa = (p: number): Ma => {
    switch (cfg.maType) {
      case 'EMA': {
        const m = taStep.ema(len);
        return { steps: [m], step: (_s, _i, v) => m.step(v) };
      }
      case 'RMA': {
        const m = taStep.rma(len);
        return { steps: [m], step: (_s, _i, v) => m.step(v) };
      }
      case 'WMA': {
        const m = taStep.wma();
        return { steps: [m], step: (_s, _i, v) => m.step(v, len) };
      }
      case 'VWMA': {
        const m = new WindowVwma(len);
        return { steps: [m], step: (_s, _i, v, vol) => m.step(v, vol) };
      }
      case 'HMA': {
        const m = taStep.hma(len);
        return { steps: [m], step: (_s, _i, v) => m.step(v) };
      }
      case 'T3': {
        const [m1, m2, m3, m4, m5, m6] = emaChain(6);
        const b = 0.7;
        const c1 = -b * b * b;
        const c2 = 3 * b * b + 3 * b * b * b;
        const c3 = -6 * b * b - 3 * b - 3 * b * b * b;
        const c4 = 1 + 3 * b + b * b * b + 3 * b * b;
        return {
          steps: [m1, m2, m3, m4, m5, m6],
          step: (_s, _i, v) => {
            const xe1 = m1.step(v);
            const xe2 = m2.step(xe1);
            const xe3 = m3.step(xe2);
            const xe4 = m4.step(xe3);
            const xe5 = m5.step(xe4);
            const xe6 = m6.step(xe5);
            return c1 * xe6 + c2 * xe5 + c3 * xe4 + c4 * xe3;
          },
        };
      }
      case 'DEMA': {
        const [m1, m2] = emaChain(2);
        return {
          steps: [m1, m2],
          step: (_s, _i, v) => {
            const e1 = m1.step(v);
            const e2 = m2.step(e1);
            return 2 * e1 - e2;
          },
        };
      }
      case 'TEMA': {
        const [m1, m2, m3] = emaChain(3);
        return {
          steps: [m1, m2, m3],
          step: (_s, _i, v) => {
            const e1 = m1.step(v);
            const e2 = m2.step(e1);
            const e3 = m3.step(e2);
            return 3 * (e1 - e2) + e3;
          },
        };
      }
      case 'KAMA': {
        // mom = math.abs(ta.change(src)); volatility = math.sum(math.abs(ta.change(src)), len)
        const sum = new WindowSum(len);
        const fastSC = 2 / (2 + 1);
        const slowSC = 2 / (30 + 1);
        return {
          steps: [sum],
          step: (s, i, v) => {
            const absChange = i > 0 ? Math.abs(v - s.src[p][i - 1]) : NaN;
            const volatility = sum.step(absChange);
            const er = ne(volatility, 0) ? absChange / volatility : 0;
            const sc = er * (fastSC - slowSC) + slowSC;
            const sc2 = sc * sc;
            // var float kama (one per call)
            const k = s.vars.kama[p];
            const next = isNaN(k) ? v : k + sc2 * (v - k);
            s.vars.kama[p] = next;
            return next;
          },
        };
      }
      case 'ZLEMA': {
        // lag = (len - 1) / 2 (fractional in Pine v6), src[int(lag)]
        const lag = Math.trunc((len - 1) / 2);
        const m = taStep.ema(len);
        return {
          steps: [m],
          step: (s, i, v) => m.step(i - lag >= 0 ? v + (v - s.src[p][i - lag]) : NaN),
        };
      }
      case 'McGinley':
        return {
          steps: [],
          step: (s, _i, v) => {
            // var float mg (one per call); na(mg): Pine na() is also true for an infinite value
            const mg = s.vars.mg[p];
            const next = !Number.isFinite(mg) ? v : mg + (v - mg) / (len * math.pow(v / mg, 4));
            s.vars.mg[p] = next;
            return next;
          },
        };
      case 'EPMA': {
        const alpha = 2 / (len + 1);
        const sum = new WindowSum(len - 1);
        return {
          steps: [sum],
          step: (s, i, v) => v * alpha + (sum.step(i > 0 ? s.src[p][i - 1] : NaN) * (1 - alpha)) / (len - 1),
        };
      }
      default: {
        const m = new WindowSma(len);
        return { steps: [m], step: (_s, _i, v) => m.step(v) };
      }
    }
  };

  return {
    init() {
      if (cfg.maType === 'EPMA' && len - 1 <= 0) {
        throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'sum' function. It must be > 0.");
      }
      if (cfg.maType === 'HMA' && Math.floor(len / 2) < 1) {
        throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      }
      const mas = [0, 1, 2, 3].map(makeMa);
      const s: MacRun = {
        mas, src: [[], [], [], []], candles: [],
        steps: mas.flatMap((m) => m.steps),
        vars: { kama: [NaN, NaN, NaN, NaN], mg: [NaN, NaN, NaN, NaN] },
        lists: [], series: [],
      };
      s.lists = [s.candles];
      s.series = s.src;
      return s;
    },
    copyVars: (v) => ({ kama: v.kama.slice(), mg: v.mg.slice() }),
    bar(s, i, bars) {
      const b = bars[i];
      const vol = b.volume ?? NaN;
      s.src[0][i] = b.open;
      s.src[1][i] = b.high;
      s.src[2][i] = b.low;
      s.src[3][i] = b.close;
      const o = s.mas[0].step(s, i, b.open, vol);
      const h = s.mas[1].step(s, i, b.high, vol);
      const l = s.mas[2].step(s, i, b.low, vol);
      const c = s.mas[3].step(s, i, b.close, vol);
      // plotcandle draws no candle when a value is na
      if (!Number.isFinite(o) || !Number.isFinite(h) || !Number.isFinite(l) || !Number.isFinite(c)) return;
      const col = ge(c, o) ? color.green : color.red;
      s.candles.push({ time: b.time as number, open: o, high: h, low: l, close: c, color: col, wickColor: col, borderColor: col });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { maCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MovingAverageCandlesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MovingAverageCandlesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MovingAverageCandles = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
