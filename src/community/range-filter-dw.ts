/**
 * Range Filter [DW]
 *
 * Smoothed range filter that tracks price movement.
 * smoothRange = EMA(|close - close[1]|, period) * mult
 * Filter moves up when close > filter + smoothRange, down vice versa.
 * Upper and lower bands derived from filter +/- smoothRange.
 *
 * Reference: "Range Filter [DW]"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RangeFilterDWInputs {
  period: number;
  mult: number;
  src: SourceType;
}

export const defaultInputs: RangeFilterDWInputs = {
  period: 50,
  mult: 3.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'period', type: 'int', title: 'Period', defval: 50, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 3.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filter', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Range Filter [DW]',
  shortTitle: 'RngFilt',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface RangeFilterRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  srcArr: number[];
  filter: number[];
  fdir: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<RangeFilterDWInputs>): BarStudy<RangeFilterRun, Result> {
  const { period, mult, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = period;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const ema = taStep.ema(period);
      const s: RangeFilterRun = {
        ema, srcArr: [], filter: [], fdir: [], plot0: [], plot1: [], plot2: [], barColors: [],
        steps: [ema], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.srcArr, s.filter, s.fdir, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(st, i, bars) {
      const { srcArr, filter, fdir } = st;
      srcArr[i] = value(bars[i]);
      // Calculate bar-to-bar absolute range
      const absRange = i === 0 ? 0 : Math.abs((srcArr[i] ?? 0) - (srcArr[i - 1] ?? 0));
      // Smooth range using EMA
      const v = st.ema.step(absRange);
      // Apply multiplier (default to 0 during EMA warmup to avoid NaN propagation)
      const sr = (v != null && !isNaN(v) ? v : 0) * mult;

      // Range filter calculation
      const s = srcArr[i] ?? 0;
      if (i === 0) {
        filter[i] = s;
        fdir[i] = 0;
      } else {
        const prevFilter = filter[i - 1];

        if (s > prevFilter) {
          // Price above filter: filter moves up, ratchets
          filter[i] = Math.max(prevFilter, s - sr);
        } else if (s < prevFilter) {
          // Price below filter: filter moves down, ratchets
          filter[i] = Math.min(prevFilter, s + sr);
        } else {
          filter[i] = prevFilter;
        }

        fdir[i] = filter[i] > filter[i - 1] ? 1 : filter[i] < filter[i - 1] ? -1 : fdir[i - 1];
      }

      const time = bars[i].time;
      // Bar colors based on trend direction and close vs filter
      // Pine: upward and close>filt ? (close>close[1] ? #05ff9b : #00b36b) : downward and close<filt ? (close<close[1] ? #ff0583 : #b8005d) : #cccccc
      if (i >= warmup) {
        const close = bars[i].close;
        const prevClose = i > 0 ? bars[i - 1].close : close;
        let color: string;
        if (fdir[i] === 1 && close > filter[i]) {
          color = close > prevClose ? '#05ff9b' : '#00b36b';
        } else if (fdir[i] === -1 && close < filter[i]) {
          color = close < prevClose ? '#ff0583' : '#b8005d';
        } else {
          color = '#cccccc';
        }
        st.barColors.push({ time, color });
      }

      const f = filter[i];
      if (i < warmup) {
        st.plot0[i] = { time, value: NaN };
      } else {
        const upward = fdir[i] === 1;
        const downward = fdir[i] === -1;
        const color = upward ? '#26A69A' : downward ? '#EF5350' : '#787B86';
        st.plot0[i] = { time, value: f, color };
      }
      st.plot1[i] = { time, value: i < warmup ? NaN : f + sr };
      st.plot2[i] = { time, value: i < warmup ? NaN : f - sr };
    },
    result(s) {
      // Fills: high band to filter (green), low band to filter (red)
      // Pine: fill(h_band_plot, filt_plot, color=#00b36b, transp=85)
      // Pine: fill(l_band_plot, filt_plot, color=#b8005d, transp=85)
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [
          { plot1: 'plot1', plot2: 'plot0', options: { color: 'rgba(0,179,107,0.15)' } },
          { plot1: 'plot2', plot2: 'plot0', options: { color: 'rgba(184,0,93,0.15)' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RangeFilterDWInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RangeFilterDWInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RangeFilterDW = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
