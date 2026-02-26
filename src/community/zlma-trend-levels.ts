/**
 * Zero-Lag MA Trend Levels
 *
 * Zero-lag EMA: zlema = 2*EMA(src) - EMA(EMA(src)).
 * Detects trend changes when ZLEMA direction flips.
 * Plots support level (last bullish flip price) and resistance level (last bearish flip price).
 *
 * Reference: TradingView "Zero-Lag MA Trend Levels" (TV#861)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface ZlmaTrendLevelsInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: ZlmaTrendLevelsInputs = {
  length: 50,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 50, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZLEMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Support', color: '#26A69A', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Resistance', color: '#EF5350', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Zero-Lag MA Trend Levels',
  shortTitle: 'ZLMA-TL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ZlmaTrendLevelsInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  // ZLEMA = 2 * EMA(src, length) - EMA(EMA(src, length), length)
  const ema1 = ta.ema(source, length);
  const ema2 = ta.ema(ema1, length);
  const zlema = ema1.mul(2).sub(ema2);
  const zlArr = zlema.toArray();

  const warmup = length * 2;
  let support = NaN;
  let resistance = NaN;
  let prevTrend = 0; // 1 = up, -1 = down

  const plot0: { time: number; value: number; color?: string }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const plot2: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    const val = i < warmup ? NaN : (zlArr[i] ?? NaN);
    const prev = i > 0 ? (zlArr[i - 1] ?? NaN) : NaN;

    // Determine trend direction
    let trend = prevTrend;
    if (!isNaN(val) && !isNaN(prev)) {
      if (val > prev) trend = 1;
      else if (val < prev) trend = -1;
    }

    // Detect trend flip and set levels
    if (trend !== prevTrend && prevTrend !== 0 && !isNaN(val)) {
      if (trend === 1) {
        // Flip to bullish: set support at ZLEMA value
        support = val;
      } else if (trend === -1) {
        // Flip to bearish: set resistance at ZLEMA value
        resistance = val;
      }
    }
    prevTrend = trend;

    const color = trend === 1 ? '#26A69A' : trend === -1 ? '#EF5350' : '#787B86';
    plot0.push({ time: bars[i].time, value: val, color });
    plot1.push({ time: bars[i].time, value: support });
    plot2.push({ time: bars[i].time, value: resistance });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
  };
}

export const ZlmaTrendLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
