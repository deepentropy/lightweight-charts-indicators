/**
 * Alpha-Sutte Model
 *
 * Alpha-Sutte forecast: with delta, alpha, beta, gamma = close[4], close[3], close[2], close[1], the three relative
 * changes x / ((alpha + delta) / 2), y / ((beta + alpha) / 2), z / ((gamma + beta) / 2) (x = alpha - delta,
 * y = beta - alpha, z = gamma - beta) are weighted by alpha, beta and gamma, averaged and added to close[1].
 * Sutte: SutteL = (close + close[1]) / 2 + close - low, SutteH = (close + close[1]) / 2 + high - close and their
 * mean. The adaptive line is the mean of Alpha-Sutte and Sutte. SMAs of SutteL and SutteH are drawn.
 *
 * Reference: "Alpha-Sutte Model" by SegaRKO
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SegaRKO
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AlphaSutteModelInputs {
  /** SMA length of the Sutte low / high lines */
  len: number;
}

export const defaultInputs: AlphaSutteModelInputs = {
  len: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Sutte MA length', defval: 1, min: 1 },
];

/** Pine plot default colour */
const DEFAULT_BLUE = '#2962FF';
const COMBO_COL = String(color.new(color.yellow, 40));
const LOW_COL = String(color.new(color.aqua, 0));
const HIGH_COL = String(color.new(color.red, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Alpha-Sutte', color: DEFAULT_BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'Adaptive Alpha Sutte', color: COMBO_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Sutte Low MA', color: LOW_COL, lineWidth: 1 },
  { id: 'plot3', title: 'Sutte High MA', color: HIGH_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Alpha-Sutte Model',
  shortTitle: 'Alpha-Sutte Model',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

interface AsRun extends BarRunState<Record<string, never>> {
  lowMa: WindowSma;
  highMa: WindowSma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(inputs: Partial<AlphaSutteModelInputs>): BarStudy<AsRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  /** Plots show na for non-finite values */
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const lowMa = new WindowSma(cfg.len);
      const highMa = new WindowSma(cfg.len);
      const s: AsRun = {
        lowMa, highMa, plot0: [], plot1: [], plot2: [], plot3: [],
        steps: [lowMa, highMa], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const close = (k: number) => (k >= 0 ? bars[k].close : NaN);
      const delta = close(i - 4);
      const alpha = close(i - 3);
      const beta = close(i - 2);
      const gamma = close(i - 1);
      const x = alpha - delta;
      const y = beta - alpha;
      const z = gamma - beta;
      const a = alpha + delta;
      const b = beta + alpha;
      const g = gamma + beta;
      // Plain divisions (x / 0 is +-infinity, 0 / 0 na), as Pine
      const p1b = (x / (a / 2)) * alpha;
      const p2b = (y / (b / 2)) * beta;
      const p3b = (z / (g / 2)) * gamma;
      const aT = (p1b + p2b + p3b) / 3;
      const alphaSutte = aT + gamma;

      const bar = bars[i];
      const c = bar.close;
      const sutteL = (c + gamma) / 2 + c - bar.low;
      const sutteH = (c + gamma) / 2 + bar.high - c;
      const sutte = (sutteL + sutteH) / 2;
      // math.avg(a_t0, Sutte)
      const combo = (alphaSutte + sutte) / 2;
      const sutteLMA = s.lowMa.step(sutteL);
      const sutteHMA = s.highMa.step(sutteH);

      const time = bar.time;
      s.plot0[i] = { time, value: fin(alphaSutte), color: DEFAULT_BLUE };
      s.plot1[i] = { time, value: fin(combo), color: COMBO_COL };
      s.plot2[i] = { time, value: fin(sutteLMA), color: LOW_COL };
      s.plot3[i] = { time, value: fin(sutteHMA), color: HIGH_COL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AlphaSutteModelInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AlphaSutteModelInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AlphaSutteModel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
