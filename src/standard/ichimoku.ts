/**
 * Ichimoku Cloud Indicator
 *
 * A trend-following system that shows support/resistance, momentum and trend direction at once.
 * Conversion and Base lines are Donchian midlines; the Leading Spans are drawn `displacement - 1` bars ahead
 * (on future bars after the last bar) and the Lagging Span `displacement - 1` bars back. The cloud between the
 * Leading Spans is green when Leading Span A is above Leading Span B, red otherwise.
 *
 * Based on the standard "Ichimoku Cloud" indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * Ichimoku Cloud indicator input parameters
 */
export interface IchimokuInputs {
  /** Conversion Line (Tenkan-sen) period */
  conversionPeriods: number;
  /** Base Line (Kijun-sen) period */
  basePeriods: number;
  /** Leading Span B (Senkou Span B) period */
  laggingSpan2Periods: number;
  /** Displacement for Leading Spans and Lagging Span */
  displacement: number;
}

/**
 * Default input values matching the standard indicator defaults
 */
export const defaultInputs: IchimokuInputs = {
  conversionPeriods: 9,
  basePeriods: 26,
  laggingSpan2Periods: 52,
  displacement: 26,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'conversionPeriods', type: 'int', title: 'Conversion Line Length', defval: 9, min: 1 },
  { id: 'basePeriods', type: 'int', title: 'Base Line Length', defval: 26, min: 1 },
  { id: 'laggingSpan2Periods', type: 'int', title: 'Leading Span B Length', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'Lagging Span', defval: 26, min: 1 },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Conversion Line', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Base Line', color: '#B71C1C', lineWidth: 1 },
  { id: 'plot2', title: 'Lagging Span', color: '#43A047', lineWidth: 1 },
  { id: 'plot3', title: 'Leading Span A', color: '#A5D6A7', lineWidth: 1 },
  { id: 'plot4', title: 'Leading Span B', color: '#EF9A9A', lineWidth: 1 },
  { id: 'plot7', title: 'Kumo Cloud Upper Line', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Kumo Cloud Lower Line', color: '#2962FF', lineWidth: 1, display: 'none' },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Ichimoku Cloud',
  shortTitle: 'Ichimoku',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number };

/** The plots in the order of the result: plot id, offset (set in study) */
const PLOT_IDS = ['plot0', 'plot1', 'plot2', 'plot3', 'plot4', 'plot7', 'plot8'] as const;

interface IchimokuRun extends BarRunState<Record<string, never>> {
  lows: WindowExtreme[];
  highs: WindowExtreme[];
  /** The value of each plot on each bar (before its offset) */
  values: number[][];
  /** The points of each plot whose bar exists (the time of bar i + offset) */
  points: Point[][];
  cloudColors: string[];
}

function study(inputs: Partial<IchimokuInputs>): BarStudy<IchimokuRun, IndicatorResult> {
  const { conversionPeriods, basePeriods, laggingSpan2Periods, displacement } = { ...defaultInputs, ...inputs };
  const lengths = [conversionPeriods, basePeriods, laggingSpan2Periods];
  const lead = displacement - 1;
  // plot(value, offset = off): the value of bar i is drawn on bar i + off (future bars after the last bar)
  const offsets = [0, 0, -displacement + 1, lead, lead, lead, lead];
  return {
    init() {
      const s: IchimokuRun = {
        lows: lengths.map((len) => new WindowExtreme(true, len)),
        highs: lengths.map((len) => new WindowExtreme(false, len)),
        values: PLOT_IDS.map(() => []), points: PLOT_IDS.map(() => []), cloudColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [...s.lows, ...s.highs];
      s.lists = s.points;
      s.series = [...s.values, s.cloudColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // donchian(len) => math.avg(ta.lowest(len), ta.highest(len))
      const conversionLine = (s.lows[0].step(b.low) + s.highs[0].step(b.high)) / 2;
      const baseLine = (s.lows[1].step(b.low) + s.highs[1].step(b.high)) / 2;
      const leadLine2 = (s.lows[2].step(b.low) + s.highs[2].step(b.high)) / 2;
      const leadLine1 = (conversionLine + baseLine) / 2;
      // leadLine1 > leadLine2 ? leadLine1 : leadLine2 (na compares false)
      const upper = gt(leadLine1, leadLine2) ? leadLine1 : leadLine2;
      // leadLine1 < leadLine2 ? leadLine1 : leadLine2
      const lower = gt(leadLine2, leadLine1) ? leadLine1 : leadLine2;
      const v = s.values;
      v[0][i] = conversionLine;
      v[1][i] = baseLine;
      v[2][i] = b.close;
      v[3][i] = leadLine1;
      v[4][i] = leadLine2;
      v[5][i] = upper;
      v[6][i] = lower;
      // fill(p1, p2, color = leadLine1 > leadLine2 ? color.rgb(67, 160, 71, 90) : color.rgb(244, 67, 54, 90));
      // the colour of bar i goes with the plot points of bar i
      s.cloudColors[i] = gt(leadLine1, leadLine2) ? '#43A0471A' : '#F443361A';
      for (let k = 0; k < PLOT_IDS.length; k++) {
        const off = offsets[k];
        if (off >= 0) {
          // this bar is the bar of the point of bar i - off
          if (i - off >= 0) s.points[k].push({ time: b.time, value: v[k][i - off] });
        } else if (i + off >= 0) {
          s.points[k].push({ time: bars[i + off].time, value: v[k][i] });
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      const interval = n > 0 ? barInterval(bars) : NaN;
      const plots: Record<string, Point[]> = {};
      PLOT_IDS.forEach((id, k) => {
        const out = s.points[k].slice();
        const off = offsets[k];
        // the points of the last bars after the last bar
        if (off > 0) for (let i = Math.max(0, n - off); i < n; i++) out.push({ time: barTime(bars, i + off, interval), value: s.values[k][i] });
        plots[id] = out;
      });
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots,
        fills: [{ plot1: 'plot3', plot2: 'plot4', options: { title: 'Cloud Fill' }, colors: s.cloudColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IchimokuInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

/**
 * Calculate Ichimoku Cloud indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<IchimokuInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * Ichimoku Cloud indicator module
 */
export const IchimokuCloud = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
