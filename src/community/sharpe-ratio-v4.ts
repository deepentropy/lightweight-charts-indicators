/**
 * Sharpe Ratio v4 INDI
 *
 * The "average return" is the rate of change of the close over `lookbackLength` bars (ta.roc, in percent); the risk
 * is the standard deviation of that rate of change over the same number of bars. The Sharpe ratio is the return
 * divided by the risk. The return and risk lines are hidden by default; a horizontal line at 0.
 * The "Standard Deviation Multipliert" input is not used by the computation (as in the original script).
 *
 * Reference: "Sharpe Ratio v4 INDI" by Zettt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SharpeRatioV4Inputs {
  /** Lookback length of the rate of change and of its standard deviation */
  lookbackLength: number;
  /** Standard deviation multiplier (not used by the computation) */
  stdevMultiplier: number;
}

export const defaultInputs: SharpeRatioV4Inputs = {
  lookbackLength: 20,
  stdevMultiplier: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackLength', type: 'int', title: 'Lookback Length', defval: 20, min: 1 },
  { id: 'stdevMultiplier', type: 'float', title: 'Standard Deviation Multipliert', defval: 2, min: 1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Average Return', color: color.red, lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Risk', color: color.orange, lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Sharpe Ratio', color: color.blue, lineWidth: 1 },
];

/** hline(0) with the Pine default style (colour #787B86, dashed, width 1) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 },
];

export const metadata = {
  title: 'Sharpe Ratio v4 INDI',
  shortTitle: 'Sharpe Ratio v4 INDI',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface SharpeRun extends BarRunState<Record<string, never>> {
  roc: ReturnType<typeof taStep.roc>;
  dev: WindowStdev;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<SharpeRatioV4Inputs>): BarStudy<SharpeRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const roc = taStep.roc(cfg.lookbackLength);
      const dev = new WindowStdev(cfg.lookbackLength);
      const s: SharpeRun = { roc, dev, plot0: [], plot1: [], plot2: [], steps: [roc, dev], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // averageReturn = ta.roc(close, lookbackLength); stdev = ta.stdev(averageReturn, lookbackLength)
      const averageReturn = s.roc.step(b.close);
      const stdev = s.dev.step(averageReturn);
      // sharpe = averageReturn / stdev: a plain division (x / 0 is +-infinity, shown as na)
      const sharpe = averageReturn / stdev;
      s.plot0[i] = { time: b.time, value: fin(averageReturn), color: color.red };
      s.plot1[i] = { time: b.time, value: fin(stdev), color: color.orange };
      s.plot2[i] = { time: b.time, value: fin(sharpe), color: color.blue };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [{ value: 0, options: { title: 'Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SharpeRatioV4Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SharpeRatioV4Inputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SharpeRatioV4 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
