/**
 * Donchian Trend Ribbon
 *
 * 10 layers of Donchian breakout trend detection at different lengths.
 * Main trend at dlen, sub-trends at dlen-1 through dlen-9.
 * Each layer outputs +1 (bullish) or -1 (bearish).
 *
 * Reference: "Donchian Trend Ribbon" by LonesomeTheBlue
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DonchianTrendRibbonInputs {
  dlen: number;
}

export const defaultInputs: DonchianTrendRibbonInputs = {
  dlen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'dlen', type: 'int', title: 'Donchian Channel Period', defval: 20, min: 10 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Layer 1', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Layer 2', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Layer 3', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Layer 4', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot4', title: 'Layer 5', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot5', title: 'Layer 6', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot6', title: 'Layer 7', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot7', title: 'Layer 8', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot8', title: 'Layer 9', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot9', title: 'Layer 10', color: '#00FF00', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Donchian Trend Ribbon',
  shortTitle: 'DTR',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface DtrRun extends BarRunState<Record<string, never>> {
  /** ta.highest / ta.lowest of each layer (lengths dlen .. dlen - 9) */
  hi: ReturnType<typeof taStep.highest>[];
  lo: ReturnType<typeof taStep.lowest>[];
  /** Per layer: the highest / lowest and the trend of each bar */
  hh: number[][];
  ll: number[][];
  trend: number[][];
  points: Point[][];
}

function study(inputs: Partial<DonchianTrendRibbonInputs>): BarStudy<DtrRun, IndicatorResult> {
  const { dlen } = { ...defaultInputs, ...inputs };
  const warmup = dlen;
  return {
    init() {
      const hi = Array.from({ length: 10 }, () => taStep.highest());
      const lo = Array.from({ length: 10 }, () => taStep.lowest());
      const s: DtrRun = {
        hi, lo,
        hh: Array.from({ length: 10 }, () => []),
        ll: Array.from({ length: 10 }, () => []),
        trend: Array.from({ length: 10 }, () => []),
        points: Array.from({ length: 10 }, () => []),
        steps: [...hi, ...lo], vars: {}, lists: [], series: [],
      };
      s.series = [...s.hh, ...s.ll, ...s.trend, ...s.points];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      // Compute 10 trend layers at dlen, dlen-1, ..., dlen-9 (dchannel: breakout of the previous bar's channel)
      for (let offset = 0; offset < 10; offset++) {
        const len = dlen - offset;
        const hh = s.hh[offset];
        const ll = s.ll[offset];
        const trend = s.trend[offset];
        hh[i] = s.hi[offset].step(b.high, len);
        ll[i] = s.lo[offset].step(b.low, len);
        const prevHh = i > 0 ? (hh[i - 1] ?? 0) : 0;
        const prevLl = i > 0 ? (ll[i - 1] ?? 0) : 0;
        if (close > prevHh) {
          trend[i] = 1;
        } else if (close < prevLl) {
          trend[i] = -1;
        } else {
          trend[i] = i > 0 ? trend[i - 1] : 0;
        }
      }
      // Main trend = layer 0 (the longest period)
      // 10 stacked column plots, each at a fixed value (5, 10, 15, ..., 50)
      // Color: bright green/red if confirming main trend, dim green/red if diverging
      const mt = s.trend[0][i];
      for (let l = 0; l < 10; l++) {
        const value = (l + 1) * 5; // 5, 10, 15, ..., 50
        if (i < warmup) {
          s.points[l][i] = { time: b.time, value: NaN };
          continue;
        }
        const lt = s.trend[l][i];
        let color: string;
        if (mt === 1) {
          color = lt === 1 ? '#00FF00' : 'rgba(0,255,0,0.62)';
        } else if (mt === -1) {
          color = lt === -1 ? '#FF0000' : 'rgba(255,0,0,0.62)';
        } else {
          color = '#787B86';
        }
        s.points[l][i] = { time: b.time, value, color };
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      for (let l = 0; l < 10; l++) plots[`plot${l}`] = s.points[l].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DonchianTrendRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DonchianTrendRibbonInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DonchianTrendRibbon = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
