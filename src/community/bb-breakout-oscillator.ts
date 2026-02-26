/**
 * Bollinger Bands Breakout Oscillator
 *
 * Cumulative breakout above/below Bollinger Bands over lookback window.
 * Bull = cumulative bars above upper BB / length * 100
 * Bear = cumulative bars below lower BB / length * 100
 *
 * Reference: TradingView "Bollinger Bands Breakout Oscillator" by LuxAlgo
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

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
];

export const hlineConfig = [
  { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Midline' } },
];

export const metadata = {
  title: 'BB Breakout Oscillator',
  shortTitle: 'BBBO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BBBreakoutOscInputs> = {}): IndicatorResult {
  const { length, mult, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);
  const sma = ta.sma(source, length);
  const stdev = ta.stdev(source, length);
  const smaArr = sma.toArray();
  const stdevArr = stdev.toArray();
  const sourceArr = source.toArray();

  const bullArr: number[] = new Array(n);
  const bearArr: number[] = new Array(n);

  // Track breakout counts over lookback window
  const aboveUpper: number[] = new Array(n);
  const belowLower: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const s = sourceArr[i] ?? 0;
    const m = smaArr[i];
    const d = stdevArr[i];
    if (m == null || d == null) {
      aboveUpper[i] = 0;
      belowLower[i] = 0;
    } else {
      aboveUpper[i] = s > m + d * mult ? 1 : 0;
      belowLower[i] = s < m - d * mult ? 1 : 0;
    }
  }

  // Cumulative sum over lookback window
  const warmup = length;
  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      bullArr[i] = NaN;
      bearArr[i] = NaN;
      continue;
    }
    let bullCount = 0;
    let bearCount = 0;
    for (let j = i - length + 1; j <= i; j++) {
      bullCount += aboveUpper[j];
      bearCount += belowLower[j];
    }
    bullArr[i] = (bullCount / length) * 100;
    bearArr[i] = (bearCount / length) * 100;
  }

  const bullPlot = bullArr.map((v, i) => ({ time: bars[i].time, value: v }));
  const bearPlot = bearArr.map((v, i) => ({ time: bars[i].time, value: v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': bullPlot, 'plot1': bearPlot },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
  };
}

export const BBBreakoutOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
