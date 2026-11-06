/**
 * NY ORB + Fakeout Detector
 *
 * Opening range of one fixed window: the bars whose open time is from 2025-06-03 13:30 to 13:45 UTC (the times are
 * constants of the script) build the range high / low; the range is cleared on the first bar after the window. A
 * shape marks the bars that close above the range high after an open below it, with an upper wick of more than half
 * the bar range. Outside that window (e.g. on daily bars other than 2025-06-03) the plots are na.
 *
 * Reference: "NY ORB + Fakeout Detector" by STEFANGAS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface NyOrbFakeoutDetectorInputs {}

export const defaultInputs: NyOrbFakeoutDetectorInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ORB High', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'ORB Low', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'NY ORB + Fakeout Detector',
  shortTitle: 'NY ORB + Fakeout Detector',
  overlay: true,
};

/** Pine default colour of a plotshape without a colour */
const PINE_BLUE = '#2962FF';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

// orb_start = timestamp("2025-06-03T13:30:00"); orb_end = timestamp("2025-06-03T13:45:00"): a date string without a
// time zone is UTC (bar times in seconds)
const ORB_START = Date.UTC(2025, 5, 3, 13, 30, 0) / 1000;
const ORB_END = Date.UTC(2025, 5, 3, 13, 45, 0) / 1000;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number; color: string };

interface OrbVars {
  /** var float orb_high = na, var float orb_low = na */
  orbHigh: number;
  orbLow: number;
}

interface OrbRun extends BarRunState<OrbVars> {
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
}

function study(): BarStudy<OrbRun, Result> {
  return {
    init() {
      const s: OrbRun = {
        plot0: [], plot1: [], markers: [],
        steps: [], vars: { orbHigh: NaN, orbLow: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const inOrb = b.time >= ORB_START && b.time <= ORB_END;
      if (inOrb) {
        v.orbHigh = isNaN(v.orbHigh) ? b.high : Math.max(v.orbHigh, b.high);
        v.orbLow = isNaN(v.orbLow) ? b.low : Math.min(v.orbLow, b.low);
      }
      if (b.time > ORB_END && !inOrb) {
        v.orbHigh = NaN;
        v.orbLow = NaN;
      }
      const orbHigh = v.orbHigh;
      s.plot0[i] = { time: b.time, value: orbHigh, color: color.green };
      s.plot1[i] = { time: b.time, value: v.orbLow, color: color.red };
      // breakout_up = close > orb_high and open < orb_high and high - close > (high - low) * 0.5
      const breakoutUp = gt(b.close, orbHigh) && lt(b.open, orbHigh) && gt(b.high - b.close, (b.high - b.low) * 0.5);
      // plotshape(breakout_up): shape.xcross above the bar, default colour
      if (breakoutUp) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'xcross', color: PINE_BLUE });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
        },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<NyOrbFakeoutDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<NyOrbFakeoutDetectorInputs> = {},
): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const NyOrbFakeoutDetector = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
