/**
 * Donchian Reversal Signals with Labels
 *
 * Two Donchian channels (highest high / lowest low over length1 and length2 bars, current bar included). A yellow
 * "B" label below a green candle that follows a red candle whose low is at or below one of the lower bands (bands
 * of the current bar). A green "S" label above a red candle that follows a green candle whose high is at or above
 * one of the upper bands.
 *
 * Reference: "Donchian Reversal Signals with Labels" by Trader-Hitesh
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';

export interface DonchianReversalSignalsWithLabelsInputs {
  length1: number;
  length2: number;
}

export const defaultInputs: DonchianReversalSignalsWithLabelsInputs = {
  length1: 20,
  length2: 34,
};

export const inputConfig: InputConfig[] = [
  { id: 'length1', type: 'int', title: 'Donchian Channel Length 1', defval: 20 },
  { id: 'length2', type: 'int', title: 'Donchian Channel Length 2', defval: 34 },
];

// Markers only (plotshape)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Donchian Reversal Signals with Labels',
  shortTitle: 'Donchian Reversal Signals with Labels',
  overlay: true,
};

/** Pine float comparisons: equal within 1e-10; na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** Pine default plotshape text colour (color.blue) */
const TEXT_COLOR = '#2962FF';

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface DonchianRun extends BarRunState<Record<string, never>> {
  upper1: WindowExtreme;
  lower1: WindowExtreme;
  upper2: WindowExtreme;
  lower2: WindowExtreme;
  markers: MarkerData[];
}

function study(inputs: Partial<DonchianReversalSignalsWithLabelsInputs>): BarStudy<DonchianRun, Result> {
  const { length1, length2 } = { ...defaultInputs, ...inputs };
  const num = (x: number | null | undefined) => (x == null ? NaN : x);
  return {
    init() {
      const upper1 = new WindowExtreme(false, length1);
      const lower1 = new WindowExtreme(true, length1);
      const upper2 = new WindowExtreme(false, length2);
      const lower2 = new WindowExtreme(true, length2);
      const s: DonchianRun = {
        upper1, lower1, upper2, lower2, markers: [], steps: [upper1, lower1, upper2, lower2], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const u1 = num(s.upper1.step(b.high));
      const l1 = num(s.lower1.step(b.low));
      const u2 = num(s.upper2.step(b.high));
      const l2 = num(s.lower2.step(b.low));
      if (i < 1) return;
      const p = bars[i - 1];
      const isGreen = gt(b.close, b.open);
      const isRed = lt(b.close, b.open);
      const prevIsGreen = gt(p.close, p.open);
      const prevIsRed = lt(p.close, p.open);
      const t = b.time as number;
      if (isGreen && prevIsRed && (le(p.low, l1) || le(p.low, l2))) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.yellow, text: 'B', textColor: TEXT_COLOR, size: 'auto' });
      }
      if (isRed && prevIsGreen && (ge(p.high, u1) || ge(p.high, u2))) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.green, text: 'S', textColor: TEXT_COLOR, size: 'auto' });
      }
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
export function createRun(inputs: Partial<DonchianReversalSignalsWithLabelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DonchianReversalSignalsWithLabelsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const DonchianReversalSignalsWithLabels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
