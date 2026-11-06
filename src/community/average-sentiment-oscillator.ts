/**
 * Average Sentiment Oscillator
 *
 * Measures bull/bear sentiment based on intrabar and group candle analysis.
 * Bulls = bullish candle count / total * 100, Bears = bearish / total * 100.
 * Smoothed with SMA.
 *
 * Reference: "Average Sentiment Oscillator" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AverageSentimentOscInputs {
  length: number;
}

export const defaultInputs: AverageSentimentOscInputs = {
  length: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bulls', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Bears', color: '#EF5350', lineWidth: 2 },
];

export const hlineConfig = [
  { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Midline' } },
];

export const metadata = {
  title: 'Average Sentiment Oscillator',
  shortTitle: 'ASO',
  overlay: false,
};

type Point = { time: number; value: number };

interface AsoRun extends BarRunState<Record<string, never>> {
  bull: WindowSma;
  bear: WindowSma;
  bullPlot: Point[];
  bearPlot: Point[];
}

function study(inputs: Partial<AverageSentimentOscInputs>): BarStudy<AsoRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  const warmup = length;
  return {
    init() {
      const bull = new WindowSma(length);
      const bear = new WindowSma(length);
      const s: AsoRun = { bull, bear, bullPlot: [], bearPlot: [], steps: [bull, bear], vars: {}, lists: [], series: [] };
      s.series = [s.bullPlot, s.bearPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Raw bull/bear per bar: bull if close > open, bear if close < open
      const rawBull = b.close >= b.open ? 1 : 0;
      const rawBear = b.close < b.open ? 1 : 0;
      // SMA of raw signals * 100 to get percentage
      const bullV = s.bull.step(rawBull) * 100;
      const bearV = s.bear.step(rawBear) * 100;
      s.bullPlot[i] = { time: b.time, value: (i < warmup || bullV == null) ? NaN : bullV };
      s.bearPlot[i] = { time: b.time, value: (i < warmup || bearV == null) ? NaN : bearV };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.bullPlot.slice(), 'plot1': s.bearPlot.slice() },
        hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AverageSentimentOscInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AverageSentimentOscInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AverageSentimentOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
