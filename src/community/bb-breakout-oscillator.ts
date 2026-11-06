/**
 * Bollinger Bands Breakout Oscillator
 *
 * Cumulative breakout above/below Bollinger Bands over lookback window.
 * Bull = cumulative bars above upper BB / length * 100
 * Bear = cumulative bars below lower BB / length * 100
 *
 * Reference: "Bollinger Bands Breakout Oscillator" by LuxAlgo
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BBBreakoutOscInputs {
  length: number;
  mult: number;
  src: SourceType;
}

export const defaultInputs: BBBreakoutOscInputs = {
  length: 14,
  mult: 1.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'mult', type: 'float', title: 'StdDev Mult', defval: 1.0, min: 0.01, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Bear', color: '#EF5350', lineWidth: 2 },
  { id: 'plot2', title: 'Zero', color: 'transparent', lineWidth: 0 },
];

export const hlineConfig = [
  { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Midline' } },
];

export const metadata = {
  title: 'BB Breakout Oscillator',
  shortTitle: 'BBBO',
  overlay: false,
};

type Point = { time: number; value: number };

interface BbboRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  stdev: WindowStdev;
  aboveUpper: number[];
  belowLower: number[];
  bullPlot: Point[];
  bearPlot: Point[];
  zeroPlot: Point[];
}

function study(inputs: Partial<BBBreakoutOscInputs>): BarStudy<BbboRun, IndicatorResult> {
  const { length, mult, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const sma = new WindowSma(length);
      const stdev = new WindowStdev(length);
      const s: BbboRun = {
        sma, stdev, aboveUpper: [], belowLower: [], bullPlot: [], bearPlot: [], zeroPlot: [],
        steps: [sma, stdev], vars: {}, lists: [], series: [],
      };
      s.series = [s.aboveUpper, s.belowLower, s.bullPlot, s.bearPlot, s.zeroPlot];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const src0 = value(bars[i]);
      const m = s.sma.step(src0);
      const d = s.stdev.step(src0);
      // Track breakout counts over lookback window
      const v = src0 ?? 0;
      if (m == null || d == null) {
        s.aboveUpper[i] = 0;
        s.belowLower[i] = 0;
      } else {
        s.aboveUpper[i] = v > m + d * mult ? 1 : 0;
        s.belowLower[i] = v < m - d * mult ? 1 : 0;
      }
      // Cumulative sum over lookback window
      const warmup = length;
      let bull = NaN;
      let bear = NaN;
      if (!(i < warmup)) {
        let bullCount = 0;
        let bearCount = 0;
        for (let j = i - length + 1; j <= i; j++) {
          bullCount += s.aboveUpper[j];
          bearCount += s.belowLower[j];
        }
        bull = (bullCount / length) * 100;
        bear = (bearCount / length) * 100;
      }
      s.bullPlot[i] = { time: t, value: bull };
      s.bearPlot[i] = { time: t, value: bear };
      s.zeroPlot[i] = { time: t, value: 0 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.bullPlot.slice(), 'plot1': s.bearPlot.slice(), 'plot2': s.zeroPlot.slice() },
        hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
        fills: [
          { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(38,166,154,0.15)' } },
          { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(239,83,80,0.15)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BBBreakoutOscInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BBBreakoutOscInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BBBreakoutOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
