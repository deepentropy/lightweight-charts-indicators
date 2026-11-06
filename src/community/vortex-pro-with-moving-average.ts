/**
 * Vortex Pro with Moving average
 *
 * Vortex indicator: VI+ = sum(|high - low[1]|) / sum(true range) and VI- = sum(|low - high[1]|) / sum(true range)
 * over `length` bars. Vortex Pro = (VI+ - VI-) * 10, with a moving average (EMA, SMA, HMA or WMA) and a zero line.
 * The area between Vortex Pro and zero is green above zero, red otherwise.
 *
 * Reference: "Vortex Pro with Moving average [point algo]" by pointalgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VortexProWithMovingAverageInputs {
  /** Vortex period */
  length: number;
  /** MA period */
  maLength: number;
  /** MA type */
  maType: 'EMA' | 'SMA' | 'HMA' | 'WMA';
}

export const defaultInputs: VortexProWithMovingAverageInputs = {
  length: 14,
  maLength: 9,
  maType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Vortex Period', defval: 14, min: 2 },
  { id: 'maLength', type: 'int', title: 'MA Period', defval: 9, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'HMA', 'WMA'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Vortex Pro', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'Vortex Pro MA', color: color.orange, lineWidth: 1 },
  { id: 'plot2', title: 'Zero Line', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Vortex Pro with Moving average [point algo]',
  shortTitle: 'Vortex Pro with Moving average [point algo]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };

interface VortexRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  sumPlus: WindowSum;
  sumMinus: WindowSum;
  sumTr: WindowSum;
  ma: { step(v: number): number; commit(): void } | null;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fill: string[];
}

function study(inputs: Partial<VortexProWithMovingAverageInputs>): BarStudy<VortexRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const green = String(color.new(color.green, 80));
  const red = String(color.new(color.red, 80));
  return {
    init(bars) {
      let ma: VortexRun['ma'];
      switch (cfg.maType) {
        case 'EMA': ma = taStep.ema(cfg.maLength); break;
        case 'SMA': ma = new WindowSma(cfg.maLength); break;
        case 'HMA':
          // ta.hma(x, 1) calls ta.wma(x, 0): a Pine runtime error
          if (Math.floor(cfg.maLength / 2) < 1 && bars.length > 0) {
            throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
          }
          ma = taStep.hma(cfg.maLength);
          break;
        case 'WMA': { const m = taStep.wma(); ma = { step: (v) => m.step(v, cfg.maLength), commit: () => m.commit() }; break; }
        default: ma = null;
      }
      const s: VortexRun = {
        tr: taStep.tr(false),
        sumPlus: new WindowSum(cfg.length),
        sumMinus: new WindowSum(cfg.length),
        sumTr: new WindowSum(cfg.length),
        ma, plot0: [], plot1: [], plot2: [], fill: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.tr, s.sumPlus, s.sumMinus, s.sumTr, ...(ma ? [ma] : [])];
      s.series = [s.plot0, s.plot1, s.plot2, s.fill];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // tr = ta.tr (na on the first bar); vm_plus = math.abs(high - low[1]); vm_minus = math.abs(low - high[1])
      const tr = s.tr.step(b.high, b.low, b.close);
      const vmPlus = i > 0 ? Math.abs(b.high - bars[i - 1].low) : NaN;
      const vmMinus = i > 0 ? Math.abs(b.low - bars[i - 1].high) : NaN;
      const sumPlus = s.sumPlus.step(vmPlus);
      const sumMinus = s.sumMinus.step(vmMinus);
      const sumTr = s.sumTr.step(tr);
      // Plain divisions: x / 0 is +-infinity (0 / 0 na); the MA skips infinite values, the plot shows na
      const vortexPro = (sumPlus / sumTr - sumMinus / sumTr) * 10;
      const ma = s.ma ? s.ma.step(vortexPro) : NaN;
      const time = b.time;
      s.plot0[i] = { time, value: fin(vortexPro), color: color.blue };
      s.plot1[i] = { time, value: fin(ma), color: color.orange };
      s.plot2[i] = { time, value: 0, color: color.gray };
      // fill(vortex_plot, zero_line, color = vortex_pro > 0 ? color.new(color.green, 80) : color.new(color.red, 80))
      s.fill[i] = gt(vortexPro, 0) ? green : red;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot2', options: { title: 'Vortex Zone Fill' }, colors: s.fill.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VortexProWithMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VortexProWithMovingAverageInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VortexProWithMovingAverage = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
