/**
 * POC Volume Bar (Highest Volume in Range)
 *
 * Volume columns: aqua on up bars (close >= open), blue on down bars, and yellow on the bar whose volume equals the
 * highest volume of the last `length` bars.
 *
 * Reference: "POC Volume Bar (Highest Volume in Range)" by greatbrownball
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PocVolumeBarInputs {
  /** Lookback bars for the highest volume */
  length: number;
}

export const defaultInputs: PocVolumeBarInputs = {
  length: 60,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback bars for POC', defval: 60, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: color.aqua, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'POC Volume Bar (Highest Volume in Range)',
  shortTitle: 'POC Volume Bar (Highest Volume in Range)',
  overlay: false,
};

/** Pine float comparisons: a == b within 1e-10; a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

interface PocRun extends BarRunState<Record<string, never>> {
  highest: WindowExtreme;
  plot0: { time: number; value: number; color: string }[];
}

function study(inputs: Partial<PocVolumeBarInputs>): BarStudy<PocRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const highest = new WindowExtreme(false, cfg.length);
      const s: PocRun = { highest, plot0: [], steps: [highest], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const highestVol = s.highest.step(volume);
      const isPOC = eq(volume, highestVol);
      const baseColor = ge(b.close, b.open) ? color.aqua : color.blue;
      s.plot0[i] = { time: b.time, value: volume, color: isPOC ? color.yellow : baseColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PocVolumeBarInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PocVolumeBarInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PocVolumeBar = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
