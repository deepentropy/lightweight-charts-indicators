/**
 * Trend Regularity Adaptive Moving Average (TRAMA)
 *
 * Adaptive MA that adjusts speed based on trend regularity.
 * Counts how many bars are trending (|change| > avg |change|), computes ratio,
 * then alpha = ratio * (2/(length+1)). trama = alpha * src + (1-alpha) * prev.
 *
 * Reference: "Trend Regularity Adaptive Moving Average" by LuxAlgo
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TRAMAInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: TRAMAInputs = {
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 2 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TRAMA', color: '#FFEB3B', lineWidth: 2 },
];

export const metadata = {
  title: 'Trend Regularity Adaptive MA',
  shortTitle: 'TRAMA',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface TramaRun extends BarRunState<Record<string, never>> {
  srcArr: number[];
  absChg: number[];
  trama: number[];
  plot: Point[];
}

function study(inputs: Partial<TRAMAInputs>): BarStudy<TramaRun, IndicatorResult> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const fastAlpha = 2 / (length + 1);
  const warmup = length;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: TramaRun = { srcArr: [], absChg: [], trama: [], plot: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.srcArr, s.absChg, s.trama, s.plot];
      return s;
    },
    bar(st, i, bars) {
      const srcArr = st.srcArr;
      const trama = st.trama;
      srcArr[i] = value(bars[i]);
      const s = srcArr[i] ?? 0;
      // |src - src[1]| of this bar (read by the bars after it)
      const absChg = st.absChg;
      absChg[i] = i > 0 ? Math.abs(s - (srcArr[i - 1] ?? 0)) : NaN;

      if (i < length) {
        trama[i] = s;
      } else {
        // Calculate average absolute change over lookback
        let sumAbsChange = 0;
        for (let j = 0; j < length; j++) {
          sumAbsChange += absChg[i - j];
        }
        const avgAbsChange = sumAbsChange / length;

        // Count how many of the last `length` bars are trending
        let trendingCount = 0;
        for (let j = 0; j < length; j++) {
          const absChange = absChg[i - j];
          if (absChange > avgAbsChange) trendingCount++;
        }

        const ratio = trendingCount / length;
        const alpha = ratio * fastAlpha;
        trama[i] = alpha * s + (1 - alpha) * trama[i - 1];
      }

      const v = trama[i];
      if (i < warmup) {
        st.plot[i] = { time: bars[i].time, value: NaN };
      } else {
        const prev = i > 0 ? trama[i - 1] : v;
        const color = v > prev ? '#26A69A' : v < prev ? '#EF5350' : '#FFEB3B';
        st.plot[i] = { time: bars[i].time, value: v, color };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TRAMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TRAMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TRAMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
