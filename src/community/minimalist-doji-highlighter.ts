/**
 * Minimalist Doji Highlighter
 *
 * A doji is a bar whose body (|open - close|) is at most a fraction of its high - low range. Doji bars are coloured
 * white; an optional white cross above the bar marks them too.
 *
 * Reference: "Minimalist Doji Highlighter" by SensitiveSuit
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MinimalistDojiHighlighterInputs {
  /** Doji maximum body size, as a fraction of the high - low range */
  accuracy: number;
  /** Show a cross above the doji bars */
  showcross: boolean;
}

export const defaultInputs: MinimalistDojiHighlighterInputs = {
  accuracy: 0.15,
  showcross: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'accuracy', type: 'float', title: 'Doji Maximum Body Size', defval: 0.15, min: 0.001 },
  { id: 'showcross', type: 'bool', title: 'Show Cross Above Bar?', defval: false },
];

// No plot(): the outputs are bar colours and a plotshape marker
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Minimalist Doji Highlighter',
  shortTitle: 'Minimalist Doji Highlighter',
  overlay: true,
};

/** Pine float comparison: a <= b unless a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface DojiRun extends BarRunState<Record<string, never>> {
  barColors: BarColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<MinimalistDojiHighlighterInputs>): BarStudy<DojiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const white = String(color.white);
  const crossColor = String(color.new(color.white, 0));
  return {
    init() {
      const s: DojiRun = { barColors: [], markers: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.barColors, s.markers];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const doji = le(Math.abs(b.open - b.close), (b.high - b.low) * cfg.accuracy);
      // barcolor(doji ? color.white : na)
      if (doji) s.barColors.push({ time: b.time, color: white });
      // plotshape(showcross ? doji : na, style = shape.cross, location = location.abovebar, size = size.tiny):
      // the 1 / 0 series is a bool for location.abovebar (0 draws nothing)
      if (cfg.showcross && doji) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'cross', color: crossColor, size: 'tiny' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MinimalistDojiHighlighterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MinimalistDojiHighlighterInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MinimalistDojiHighlighter = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
