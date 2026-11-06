/**
 * KDJ Indicator
 *
 * Extended Stochastic with J line = 3K - 2D.
 * J > 100 = extreme overbought, J < 0 = extreme oversold.
 *
 * K = bcwsma(RSV, signal, 1)  // equivalent to RMA
 * D = bcwsma(K, signal, 1)
 * J = 3K - 2D
 *
 * Reference: "KDJ Indicator" by KingThies
 */

import type { Bar, IndicatorResult, InputConfig, PlotConfig } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KDJInputs {
  period: number;
  signal: number;
}

export const defaultInputs: KDJInputs = {
  period: 9,
  signal: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 9, min: 1 },
  { id: 'signal', type: 'int', title: 'Signal', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#FF9800', lineWidth: 2 },
  { id: 'plot1', title: 'D', color: '#00E676', lineWidth: 2 },
  { id: 'plot2', title: 'J', color: '#FF00FF', lineWidth: 1 },
];

export const metadata = {
  title: 'KDJ',
  shortTitle: 'KDJ',
  overlay: false,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] };

interface KdjRun extends BarRunState<{ pK: number; pD: number }> {
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<KDJInputs>): BarStudy<KdjRun, Result> {
  const { period, signal } = { ...defaultInputs, ...inputs };
  const warmup = period - 1;
  return {
    init() {
      const s: KdjRun = { plot0: [], plot1: [], plot2: [], bgColors: [], steps: [], vars: { pK: 0, pD: 0 }, lists: [], series: [] };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const c = bars[i].close;

      // Highest high and lowest low over period
      let hh = bars[i].high;
      let ll = bars[i].low;
      const lookback = Math.min(i + 1, period);
      for (let j = 0; j < lookback; j++) {
        const b = bars[i - j];
        if (b.high > hh) hh = b.high;
        if (b.low < ll) ll = b.low;
      }

      const rsv = hh !== ll ? 100 * (c - ll) / (hh - ll) : 0;

      // bcwsma(s, l, m) = (m * s + (l - m) * prev) / l  where m=1
      // This is equivalent to RMA with alpha = 1/signal
      v.pK = (rsv + (signal - 1) * v.pK) / signal;
      v.pD = (v.pK + (signal - 1) * v.pD) / signal;
      const pK = v.pK;
      const pD = v.pD;
      const pJ = 3 * pK - 2 * pD;

      const time = bars[i].time;
      s.plot0[i] = { time, value: i < warmup ? NaN : pK };
      s.plot1[i] = { time, value: i < warmup ? NaN : pD };
      s.plot2[i] = { time, value: i < warmup ? NaN : pJ };

      // bgcolor: green when J > D, red otherwise, 70% transparency
      if (i >= warmup) {
        s.bgColors.push({ time: time as number, color: pJ > pD ? 'rgba(0,128,0,0.3)' : 'rgba(255,0,0,0.3)' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KDJInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KDJInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars)) as IndicatorResult;
}

export const KDJ = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
