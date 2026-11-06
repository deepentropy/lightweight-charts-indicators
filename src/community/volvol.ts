/**
 * VolVol
 *
 * Direction: the z-score of the close (100 * (close - EMA) / stdev), smoothed by two SMAs. Intensity: the same
 * z-score of the low (when the direction is positive) or of the high, smoothed by two EMAs of length / 2. Momentum:
 * the EMA of the balance of up-close and down-close volume of the last `length` bars, weighted by (length - i)^2.
 * The three lines are drawn on the price scale. A sum of intensity and momentum above 50 (below -50) is a spike.
 * Squares mark exits (a spike against the direction), triangles mark adds and circles mark new entries.
 *
 * Reference: "VolVol" by kunalgolani
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © kunalgolani
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun, WindowSma, WindowStdev } from '../live-run';

export interface VolVolInputs {
  /** Length of the EMA / stdev / SMA (the intensity and momentum EMAs use length / 2) */
  length: number;
}

export const defaultInputs: VolVolInputs = {
  length: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Direction', color: String(color.rgb(62, 228, 98, 92)), lineWidth: 1, style: 'area' },
  { id: 'plot1', title: 'Intensity', color: String(color.rgb(33, 243, 233)), lineWidth: 1 },
  { id: 'plot2', title: 'Momentum', color: String(color.rgb(225, 29, 247, 19)), lineWidth: 1 },
];

export const metadata = {
  title: 'VolVol',
  shortTitle: 'VolVol',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface VolVolRun extends BarRunState<Record<string, never>> {
  emaC: ReturnType<typeof taStep.ema>;
  sdC: WindowStdev;
  dir1: WindowSma;
  dir2: WindowSma;
  emaS: ReturnType<typeof taStep.ema>;
  sdS: WindowStdev;
  int1: ReturnType<typeof taStep.ema>;
  int2: ReturnType<typeof taStep.ema>;
  mom: ReturnType<typeof taStep.ema>;
  direction: number[];
  sum: number[];
  bullEntry: boolean[];
  bearEntry: boolean[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<VolVolInputs>): BarStudy<VolVolRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.length;
  // Pine v6: length / 2 keeps the fraction (2.5 for 5)
  const half = len / 2;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const posCol = String(color.rgb(62, 228, 98, 92));
  const negCol = String(color.rgb(228, 62, 68, 92));
  return {
    init() {
      const s: VolVolRun = {
        emaC: taStep.ema(len), sdC: new WindowStdev(len), dir1: new WindowSma(len), dir2: new WindowSma(len),
        emaS: taStep.ema(len), sdS: new WindowStdev(len), int1: taStep.ema(half), int2: taStep.ema(half), mom: taStep.ema(half),
        direction: [], sum: [], bullEntry: [], bearEntry: [], plot0: [], plot1: [], plot2: [], markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.emaC, s.sdC, s.dir1, s.dir2, s.emaS, s.sdS, s.int1, s.int2, s.mom];
      s.lists = [s.markers];
      s.series = [s.direction, s.sum, s.bullEntry, s.bearEntry, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // raw_direction = 100 * (close - ta.ema(close, length)) / ta.stdev(close, length) (plain division)
      const emaC = s.emaC.step(b.close);
      const sdC = s.sdC.step(b.close);
      const rawDirection = (100 * (b.close - emaC)) / sdC;
      const direction = s.dir2.step(s.dir1.step(rawDirection));
      s.direction[i] = direction;

      // source = direction > 0 ? low : high
      const source = gt(direction, 0) ? b.low : b.high;
      const emaS = s.emaS.step(source);
      const sdS = s.sdS.step(source);
      const rawIntensity = (100 * (source - emaS)) / sdS;
      const intensity = s.int2.step(s.int1.step(rawIntensity));

      let bull = 0;
      let bear = 0;
      for (let k = 0; k <= len - 1; k++) {
        const c0 = i - k >= 0 ? bars[i - k].close : NaN;
        const c1 = i - k - 1 >= 0 ? bars[i - k - 1].close : NaN;
        const vol = i - k >= 0 ? (bars[i - k].volume ?? NaN) : NaN;
        // na compares false: the else branch adds the volume (na volume makes the sum na)
        if (gt(c0, c1)) bull += vol * (len - k) * (len - k);
        else bear += vol * (len - k) * (len - k);
      }
      const rawMomentum = (100 * (bull - bear)) / (bull + bear);
      const momentum = s.mom.step(rawMomentum);

      s.plot0[i] = { time: t, value: fin(direction), color: gt(direction, 0) ? posCol : negCol };
      s.plot1[i] = { time: t, value: fin(intensity) };
      // plot(momentum == 0 ? intensity : momentum)
      s.plot2[i] = { time: t, value: fin(eq(momentum, 0) ? intensity : momentum) };

      const sum = intensity + momentum;
      s.sum[i] = sum;
      const sum1 = i >= 1 ? s.sum[i - 1] : NaN;
      const dir1 = i >= 1 ? s.direction[i - 1] : NaN;
      const bullSpike = gt(sum, 50);
      const bearSpike = lt(sum, -50);
      const bullSpike1 = gt(sum1, 50);
      const bearSpike1 = lt(sum1, -50);
      const bullEntry = gt(sum, sum1) && (gt(direction, dir1) || bullSpike);
      const bearEntry = lt(sum, sum1) && (lt(direction, dir1) || bearSpike);
      s.bullEntry[i] = bullEntry;
      s.bearEntry[i] = bearEntry;
      const bullEntry1 = i >= 1 && s.bullEntry[i - 1];
      const bearEntry1 = i >= 1 && s.bearEntry[i - 1];

      const markers = s.markers;
      const up = gt(direction, 0);
      const down = lt(direction, 0);
      // bullish_exit = direction > 0 and bearish_spike and not bearish_spike[1]
      if (up && bearSpike && !bearSpike1) {
        markers.push({ time: t, position: 'belowBar', shape: 'square', color: color.red, forceOverlay: true });
      }
      if (down && bullSpike && !bullSpike1) {
        markers.push({ time: t, position: 'aboveBar', shape: 'square', color: color.green, forceOverlay: true });
      }
      // bullish_add = direction > 0 and ((bearish_spike[1] and not bearish_spike) or (intensity < 0 and momentum > 0))
      if (up && ((bearSpike1 && !bearSpike) || (lt(intensity, 0) && gt(momentum, 0)))) {
        markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, forceOverlay: true });
      }
      if (down && ((bullSpike1 && !bullSpike) || (gt(intensity, 0) && lt(momentum, 0)))) {
        markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, forceOverlay: true });
      }
      // plotshape(bullish_entry and not bullish_entry[1], "LONG", shape.circle)
      if (bullEntry && !bullEntry1) {
        markers.push({ time: t, position: 'belowBar', shape: 'circle', color: color.green, forceOverlay: true });
      }
      if (bearEntry && !bearEntry1) {
        markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: color.red, forceOverlay: true });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolVolInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolVolInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VolVol = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
