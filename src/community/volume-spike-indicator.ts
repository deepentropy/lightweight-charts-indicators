/**
 * Volume Spike Indicator
 *
 * Marks the bars where the volume is more than 4 times its 20-bar simple moving average. Each such bar gets a red
 * cross and a red x-cross above the bar. The length (20) and the multiplier (4) are constants of the script.
 *
 * Reference: "Volume Spike Indicator" by rikyu04
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type VolumeSpikeIndicatorInputs = Record<string, never>;

export const defaultInputs: VolumeSpikeIndicatorInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): plotshape markers only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume Spike Indicator',
  shortTitle: 'Volume Spike Indicator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface VolumeSpikeRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  markers: MarkerData[];
}

function study(): BarStudy<VolumeSpikeRun, Result> {
  const length = 20; // Moving average period
  const spikeMultiplier = 4; // Spike multiplier
  const red = String(color.red);
  return {
    init() {
      const sma = new WindowSma(length);
      const s: VolumeSpikeRun = { sma, markers: [], steps: [sma], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const volumeSMA = s.sma.step(volume);
      const isVolumeSpike = gt(volume, volumeSMA * spikeMultiplier);
      if (!isVolumeSpike) return;
      // plotshape(isVolumeSpike, style = shape.cross, location.abovebar, color.red, size.small, title = "Cross")
      s.markers.push({ time: b.time, position: 'aboveBar', shape: 'cross', color: red, size: 'small' });
      // plotshape(isVolumeSpike, style = shape.xcross, location.abovebar, color.red, size.small, title = "X-Cross")
      s.markers.push({ time: b.time, position: 'aboveBar', shape: 'xcross', color: red, size: 'small' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<VolumeSpikeIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<VolumeSpikeIndicatorInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const VolumeSpikeIndicator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
