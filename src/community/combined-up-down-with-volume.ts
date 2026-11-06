/**
 * Combined Up down with volume
 *
 * Marks the bars with a large one-bar move (|ta.roc(close, 1)| >= "% check") and the bars with a large volume
 * (volume >= "Volume above"). With "Combine the conditions?" on, one purple circle below the bar marks the bars
 * where both conditions are true; with it off, a circle below the bar marks the large moves and a circle above the
 * bar marks the large volumes (Pine default colour, blue).
 *
 * Reference: "Combined Up down with volume" by ChartMantra_
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CombinedUpDownWithVolumeInputs {
  /** Combine the two conditions (one marker when both are true) */
  use: boolean;
  /** Minimum volume */
  vol: number;
  /** Minimum absolute one-bar change of the close, in % */
  per: number;
}

export const defaultInputs: CombinedUpDownWithVolumeInputs = {
  use: true,
  vol: 1000000,
  per: 5.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'use', type: 'bool', title: '--Combine the conditions?', defval: true },
  { id: 'vol', type: 'int', title: 'Volume above', defval: 1000000 },
  { id: 'per', type: 'float', title: '% check', defval: 5.0 },
];

// No plot(): the only outputs are plotshape markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Combined Up down with volume',
  shortTitle: 'Combined Up down with volume',
  overlay: true,
};

/** Pine float comparison a >= b (equal within 1e-10; na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface CombinedRun extends BarRunState<Record<string, never>> {
  roc: ReturnType<typeof taStep.roc>;
  markers: MarkerData[];
}

function study(inputs: Partial<CombinedUpDownWithVolumeInputs>): BarStudy<CombinedRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // plotshape without a colour: Pine default color.blue
  const blue = String(color.blue);
  const purple = String(color.purple);
  return {
    init() {
      const roc = taStep.roc(1);
      const s: CombinedRun = { roc, markers: [], steps: [roc], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const r = s.roc.step(b.close);
      const roc = ge(Math.abs(r ?? NaN), cfg.per);
      const check = ge(b.volume ?? NaN, cfg.vol);
      const markers = s.markers;
      // plotshape(not use and roc ? 1 : na, style = shape.circle, location = location.belowbar)
      if (!cfg.use && roc) markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: blue, id: 'shape0' });
      // plotshape(not use and check ? 1 : na, style = shape.circle)  (default location.abovebar)
      if (!cfg.use && check) markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: blue, id: 'shape1' });
      // plotshape(use and roc and check ? 1 : na, style = shape.circle, color = color.purple, location = location.belowbar)
      if (cfg.use && roc && check) markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: purple, id: 'shape2' });
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
export function createRun(inputs: Partial<CombinedUpDownWithVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CombinedUpDownWithVolumeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CombinedUpDownWithVolume = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
