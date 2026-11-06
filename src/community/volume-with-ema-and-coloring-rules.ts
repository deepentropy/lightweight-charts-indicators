/**
 * Volume with EMA and Coloring Rules
 *
 * The volume as a histogram with the EMA of the volume over `emaLength` bars. A volume bar is blue when the volume
 * is above its EMA, white otherwise. The EMA is a red line.
 *
 * Reference: "Volume with EMA and Coloring Rules" by itisfilipe
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeWithEmaAndColoringRulesInputs {
  /** EMA length of the volume */
  emaLength: number;
}

export const defaultInputs: VolumeWithEmaAndColoringRulesInputs = {
  emaLength: 500,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 500, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: color.blue, lineWidth: 3, style: 'histogram' },
  { id: 'plot1', title: 'Volume EMA', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'Volume with EMA and Coloring Rules',
  shortTitle: 'VolEMA',
  overlay: false,
  format: 'volume',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };

interface VolEmaRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<VolumeWithEmaAndColoringRulesInputs>): BarStudy<VolEmaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(cfg.emaLength);
      const s: VolEmaRun = { ema, plot0: [], plot1: [], steps: [ema], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const volEMA = s.ema.step(volume);
      // barColor = volume > volEMA ? color.blue : color.white
      s.plot0[i] = { time: b.time, value: volume, color: gt(volume, volEMA) ? color.blue : color.white };
      s.plot1[i] = { time: b.time, value: volEMA, color: color.red };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeWithEmaAndColoringRulesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeWithEmaAndColoringRulesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeWithEmaAndColoringRules = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
