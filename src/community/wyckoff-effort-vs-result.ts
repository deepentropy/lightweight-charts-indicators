/**
 * Wyckoff Effort vs. Result
 *
 * A bar has high volume when its volume is above the SMA of the volume times a multiplier. A high-volume down bar
 * (close < open) is an accumulation effort, a high-volume up bar (close > open) a distribution effort. Effort bars
 * are coloured (red / green, 60 % transparent) and a line marks their open.
 *
 * Reference: "Wyckoff Effort vs. Result" by TradeTechanalysis
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TradeTechanalysis
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WyckoffEffortVsResultInputs {
  /** Length of the volume SMA */
  avgVolumeLength: number;
  /** Multiplier of the average volume that defines a high volume */
  volumeMultiplier: number;
}

export const defaultInputs: WyckoffEffortVsResultInputs = {
  avgVolumeLength: 50,
  volumeMultiplier: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'avgVolumeLength', type: 'int', title: 'Average Volume Lookback', defval: 50, min: 1 },
  { id: 'volumeMultiplier', type: 'float', title: 'High Volume Multiplier', defval: 1.5, min: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Accumulation Line', color: String(color.new(color.red, 0)), lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Distribution Line', color: String(color.new(color.green, 0)), lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'Wyckoff Effort vs. Result',
  shortTitle: 'Wyckoff E/R',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Result = IndicatorResult & { barColors: BarColorData[] };
type Point = { time: number; value: number; color: string };

interface WyckoffRun extends BarRunState<Record<string, never>> {
  avgVolume: WindowSma;
  plot0: Point[];
  plot1: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<WyckoffEffortVsResultInputs>): BarStudy<WyckoffRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const accColor = String(color.new(color.red, 60));
  const distColor = String(color.new(color.green, 60));
  const accLine = String(color.new(color.red, 0));
  const distLine = String(color.new(color.green, 0));
  return {
    init() {
      const avgVolume = new WindowSma(cfg.avgVolumeLength);
      const s: WyckoffRun = { avgVolume, plot0: [], plot1: [], barColors: [], steps: [avgVolume], vars: {}, lists: [], series: [] };
      s.lists = [s.barColors];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const volume = b.volume ?? NaN;
      const avgVolume = s.avgVolume.step(volume);
      const isHighVolume = gt(volume, avgVolume * cfg.volumeMultiplier);
      const isEffortAccumulation = gt(b.open, b.close) && isHighVolume;
      const isEffortDistribution = gt(b.close, b.open) && isHighVolume;
      // barcolor(accumulation ? color.new(color.red, 60) : distribution ? color.new(color.green, 60) : na)
      if (isEffortAccumulation) s.barColors.push({ time: t, color: accColor });
      else if (isEffortDistribution) s.barColors.push({ time: t, color: distColor });
      s.plot0[i] = { time: t, value: isEffortAccumulation ? b.open : NaN, color: accLine };
      s.plot1[i] = { time: t, value: isEffortDistribution ? b.open : NaN, color: distLine };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WyckoffEffortVsResultInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WyckoffEffortVsResultInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const WyckoffEffortVsResult = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
