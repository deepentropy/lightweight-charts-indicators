/**
 * Bull Bear Power Trend
 *
 * Bull/bear power with fills and hlines.
 * BullTrend = (close - lowest50) / atr5
 * BearTrend = (highest50 - close) / atr5
 * Trend = BullTrend - BearTrend
 *
 * Reference: "Bull Bear Power Trend" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BullBearPowerTrendInputs {
  showRegTrend: boolean;
  regLength: number;
}

export const defaultInputs: BullBearPowerTrendInputs = {
  showRegTrend: false,
  regLength: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'showRegTrend', type: 'bool', title: 'Show Regression Trend', defval: false },
  { id: 'regLength', type: 'int', title: 'Regression Length', defval: 8, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull Trend', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Bear Trend', color: '#EF5350', lineWidth: 2 },
  { id: 'plot2', title: 'Trend', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot3', title: 'Bull Power', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot4', title: 'Bear Power', color: '#EF5350', lineWidth: 4, style: 'histogram' },
  { id: 'plot5', title: 'Level 2', color: 'transparent', lineWidth: 0 },
  { id: 'plot6', title: 'Level -2', color: 'transparent', lineWidth: 0 },
];

export const hlineConfig = [
  { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
  { value: 2, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'Bull Zone' } },
  { value: -2, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Bear Zone' } },
];

export const metadata = {
  title: 'Bull Bear Power Trend',
  shortTitle: 'BBPT',
  overlay: false,
};

type Point = { time: number; value: number };

interface PowerRun extends BarRunState<Record<string, never>> {
  highest50: WindowExtreme;
  lowest50: WindowExtreme;
  atr5: ReturnType<typeof taStep.atr>;
  reg: ReturnType<typeof taStep.linreg> | null;
  plots: Point[][];
}

function study(inputs: Partial<BullBearPowerTrendInputs>): BarStudy<PowerRun, IndicatorResult> {
  const { showRegTrend, regLength } = { ...defaultInputs, ...inputs };
  const warmup = 50;
  return {
    init() {
      const highest50 = new WindowExtreme(false, 50);
      const lowest50 = new WindowExtreme(true, 50);
      const atr5 = taStep.atr(5);
      // Optional linear regression on trend
      const reg = showRegTrend ? taStep.linreg(regLength, 0) : null;
      const s: PowerRun = {
        highest50, lowest50, atr5, reg, plots: Array.from({ length: 7 }, () => []),
        steps: [highest50, lowest50, atr5, ...(reg ? [reg] : [])], vars: {}, lists: [], series: [],
      };
      s.series = [...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const highest50: number | null = s.highest50.step(b.high);
      const lowest50: number | null = s.lowest50.step(b.low);
      const atr = (s.atr5.step(b.high, b.low, b.close) as number | null) ?? 1;
      const safeAtr = atr === 0 ? 1 : atr;
      const bull = ((b.close - (lowest50 ?? b.low)) / safeAtr);
      const bear = -(((highest50 ?? b.high) - b.close) / safeAtr);
      const trend = bull + bear;
      const reg = s.reg ? s.reg.step(trend) : NaN;

      const p = s.plots;
      p[0][i] = { time, value: i < warmup ? NaN : bull };
      p[1][i] = { time, value: i < warmup ? NaN : bear };
      p[2][i] = i < warmup ? { time, value: NaN } : showRegTrend ? { time, value: reg ?? NaN } : { time, value: trend };
      // Histograms: bull power when BullTrend < 2, bear power when BearTrend > -2
      p[3][i] = { time, value: i < warmup ? NaN : (bull < 2 ? bull - 2 : NaN) };
      p[4][i] = { time, value: i < warmup ? NaN : (bear > -2 ? bear + 2 : NaN) };
      p[5][i] = { time, value: 2 };
      p[6][i] = { time, value: -2 };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': p[0].slice(),
          'plot1': p[1].slice(),
          'plot2': p[2].slice(),
          'plot3': p[3].slice(),
          'plot4': p[4].slice(),
          'plot5': p[5].slice(),
          'plot6': p[6].slice(),
        },
        hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
        fills: [
          { plot1: 'plot0', plot2: 'plot5', options: { color: 'rgba(0,128,0,0.15)' } },
          { plot1: 'plot1', plot2: 'plot6', options: { color: 'rgba(255,0,0,0.15)' } },
          { plot1: 'plot6', plot2: 'plot5', options: { color: 'rgba(255,255,255,0.12)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BullBearPowerTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BullBearPowerTrendInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BullBearPowerTrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
