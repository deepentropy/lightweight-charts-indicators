/**
 * GBR Micro Kernel Trend
 *
 * Laplace kernel smoothing of the source: the weighted mean of src[i] for i = 0 .. window with the weights
 * exp(-i / h) (na history values count as 0 but keep their weight). The direction is up when the kernel rises and
 * down when it falls (it keeps its value on a flat bar); the line is green up and red down. Labels mark the bars
 * where the direction turns up (below the bar) or down (above the bar).
 *
 * Reference: "GBR Micro Kernel Trend [Laplace Smoothing]" by THEGBR
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GbrMicroKernelTrendInputs {
  /** Smoothing bandwidth (h) */
  h: number;
  /** Calculation window (the loop runs over window + 1 bars) */
  window: number;
  src: SourceType;
}

export const defaultInputs: GbrMicroKernelTrendInputs = {
  h: 14.0,
  window: 50,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'h', type: 'float', title: 'Smoothing Bandwidth (h)', defval: 14.0, step: 1.0 },
  { id: 'window', type: 'int', title: 'Calculation Window', defval: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

const COL_BUY = String(color.new('#00FF00', 0));
const COL_SELL = String(color.new('#FF0033', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'GBR Kernel Line', color: COL_BUY, lineWidth: 3 },
];

export const metadata = {
  title: 'GBR Micro Kernel Trend',
  shortTitle: 'GBR Micro Kernel Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface GbrVars {
  dir: number;
}

interface GbrRun extends BarRunState<GbrVars> {
  src: number[];
  kernel: number[];
  dirs: number[];
  plot0: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<GbrMicroKernelTrendInputs>): BarStudy<GbrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { h, window } = cfg;
  const source = barSource(cfg.src);
  // for i = 0 to window: counts down when window < 0
  const step = window >= 0 ? 1 : -1;
  const buyShape = String(color.new(COL_BUY, 85));
  const sellShape = String(color.new(COL_SELL, 85));
  return {
    // a negative window reads the source of the next bars
    fullRunReason: () => (!isBarSource(cfg.src) ? 'source of another study' : window < 0 ? 'negative window (next bars)' : null),
    init() {
      const s: GbrRun = {
        src: [], kernel: [], dirs: [], plot0: [], markers: [],
        steps: [], vars: { dir: 1 }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.src, s.kernel, s.dirs, s.plot0];
      return s;
    },
    bar(s, bar, bars) {
      const n = bars.length;
      const src = s.src;
      const b = bars[bar];
      src[bar] = source(b);
      let sum = 0.0;
      let sumw = 0.0;
      for (let i = 0; step > 0 ? i <= window : i >= window; i += step) {
        const weight = Math.exp(-Math.abs(i) / h);
        const j = bar - i;
        const x = j >= 0 && j < n ? (j <= bar ? src[j] : source(bars[j])) : NaN;
        // nz(src[i]): na (and +-infinity) is 0
        sum += (Number.isFinite(x) ? x : 0) * weight;
        sumw += weight;
      }
      const kernel = sum / sumw;
      s.kernel[bar] = kernel;

      const prev = bar > 0 ? s.kernel[bar - 1] : NaN;
      if (gt(kernel, prev)) s.vars.dir = 1;
      else if (gt(prev, kernel)) s.vars.dir = -1;
      const dir = s.vars.dir;
      s.dirs[bar] = dir;

      s.plot0[bar] = { time: b.time, value: Number.isFinite(kernel) ? kernel : NaN, color: dir === 1 ? COL_BUY : COL_SELL };

      if (bar >= 1) {
        if (dir === 1 && s.dirs[bar - 1] === -1) {
          s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: buyShape, text: '▲',
            textColor: COL_BUY, size: 'tiny' });
        }
        if (dir === -1 && s.dirs[bar - 1] === 1) {
          s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: sellShape, text: '▼',
            textColor: COL_SELL, size: 'tiny' });
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GbrMicroKernelTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<GbrMicroKernelTrendInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const GbrMicroKernelTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
