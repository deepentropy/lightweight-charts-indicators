/**
 * Auto Trend Detector
 *
 * Automatically draws the prevailing trendlines by connecting the two most
 * recent confirmed pivot highs (resistance) and the two most recent confirmed
 * pivot lows (support), extending both to the right. Pivot points are marked.
 *
 * Approximation of the standard "Auto Trend Detector" indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AutoTrendDetectorInputs {
  /** Bars on each side required to confirm a pivot */
  pivotLength: number;
}

export const defaultInputs: AutoTrendDetectorInputs = {
  pivotLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLength', type: 'int', title: 'Pivot Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Trend Detector',
  shortTitle: 'Auto Trend',
  overlay: true,
};

const RESISTANCE = '#F23645';
const SUPPORT = '#089981';

type Result = Omit<IndicatorResult, 'markers'> & { lines: LineDrawingData[]; markers: MarkerData[] };

interface TrendRun extends BarRunState<Record<string, never>> {
  highPivots: { barIndex: number; price: number }[];
  lowPivots: { barIndex: number; price: number }[];
  markers: MarkerData[];
}

function study(inputs: Partial<AutoTrendDetectorInputs>): BarStudy<TrendRun, Result> {
  const { pivotLength: p } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: TrendRun = { highPivots: [], lowPivots: [], markers: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.highPivots, s.lowPivots, s.markers];
      return s;
    },
    bar(s, k, bars) {
      // the pivot of bar i = k - p: confirmed by the p bars after it, the last one being bar k
      const i = k - p;
      if (i < p) return;
      let isHigh = true;
      let isLow = true;
      for (let j = 1; j <= p; j++) {
        if (bars[i].high <= bars[i - j].high || bars[i].high <= bars[i + j].high) isHigh = false;
        if (bars[i].low >= bars[i - j].low || bars[i].low >= bars[i + j].low) isLow = false;
        if (!isHigh && !isLow) break;
      }
      if (isHigh) {
        s.highPivots.push({ barIndex: i, price: bars[i].high });
        s.markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: RESISTANCE, id: 'pivotHigh' });
      }
      if (isLow) {
        s.lowPivots.push({ barIndex: i, price: bars[i].low });
        s.markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: SUPPORT, id: 'pivotLow' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      const lastTime = n > 0 ? bars[n - 1].time : 0;
      const lines: LineDrawingData[] = [];

      const connectLast = (pivots: { barIndex: number; price: number }[], color: string) => {
        if (pivots.length < 2) return;
        const a = pivots[pivots.length - 2];
        const b = pivots[pivots.length - 1];
        const t1 = bars[a.barIndex].time;
        const t2 = bars[b.barIndex].time;
        // Project the line to the right edge using its slope.
        const slope = t2 !== t1 ? (b.price - a.price) / (t2 - t1) : 0;
        const projected = b.price + slope * (lastTime - t2);
        lines.push({
          time1: t1,
          price1: a.price,
          time2: lastTime,
          price2: projected,
          color,
          width: 2,
          style: 'solid',
          extend: 'right',
        });
      };

      connectLast(s.highPivots, RESISTANCE);
      connectLast(s.lowPivots, SUPPORT);

      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {},
        lines,
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoTrendDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AutoTrendDetectorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AutoTrendDetector = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
