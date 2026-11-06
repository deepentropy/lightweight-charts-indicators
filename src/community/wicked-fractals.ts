/**
 * WICK.ED Fractals
 *
 * Bill Williams fractals on the wicks (high/low), 3-bar or 5-bar.
 * Down fractal (triangle above the bar): high[n] strictly above its neighbours.
 * Up fractal (triangle below the bar): low[n] strictly below its neighbours.
 * Pine draws both shapes with offset=-2 (fixed, whatever n is).
 *
 * Reference: "WICK.ED Fractals" by Mit Nayi (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WickedFractalsInputs {
  n: number;
  fractalBars: '3' | '5';
}

export const defaultInputs: WickedFractalsInputs = {
  n: 2,
  fractalBars: '3',
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Periods', defval: 2, min: 2 },
  { id: 'fractalBars', type: 'string', title: '3 or 5 Bar Fractal', defval: '3', options: ['3', '5'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'WICK.ED Fractals',
  shortTitle: 'WFrac',
  overlay: true,
};

// Pine: color = color.white, transp = 25
const SHAPE_COLOR = 'rgba(255,255,255,0.75)';

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface WickedRun extends BarRunState<Record<string, never>> {
  plot0: { time: any; value: number }[];
  markers: MarkerData[];
}

// x[k] on bar i is bar i - k; a bar before the first one is na, and a comparison with na is false
const highAt = (bars: Bar[], i: number, k: number) => (i - k >= 0 ? bars[i - k].high : NaN);
const lowAt = (bars: Bar[], i: number, k: number) => (i - k >= 0 ? bars[i - k].low : NaN);

function study(inputs: Partial<WickedFractalsInputs>): BarStudy<WickedRun, Result> {
  const { n, fractalBars } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: WickedRun = { plot0: [], markers: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      s.plot0[i] = { time: bars[i].time, value: NaN };
      if (i < 2) return;
      let dnFractal = false;
      let upFractal = false;
      if (fractalBars === '5') {
        dnFractal = highAt(bars, i, n - 2) < highAt(bars, i, n) && highAt(bars, i, n - 1) < highAt(bars, i, n) && highAt(bars, i, n + 1) < highAt(bars, i, n) && highAt(bars, i, n + 2) < highAt(bars, i, n);
        upFractal = lowAt(bars, i, n - 2) > lowAt(bars, i, n) && lowAt(bars, i, n - 1) > lowAt(bars, i, n) && lowAt(bars, i, n + 1) > lowAt(bars, i, n) && lowAt(bars, i, n + 2) > lowAt(bars, i, n);
      } else if (fractalBars === '3') {
        dnFractal = highAt(bars, i, n - 1) < highAt(bars, i, n) && highAt(bars, i, n + 1) < highAt(bars, i, n);
        upFractal = lowAt(bars, i, n - 1) > lowAt(bars, i, n) && lowAt(bars, i, n + 1) > lowAt(bars, i, n);
      }
      // Pine: plotshape(..., offset=-2): the shape computed on bar i is drawn on bar i - 2
      const time = bars[i - 2].time;
      if (dnFractal) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: SHAPE_COLOR });
      }
      if (upFractal) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: SHAPE_COLOR });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WickedFractalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WickedFractalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const WickedFractals = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
