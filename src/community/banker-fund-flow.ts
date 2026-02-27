/**
 * Banker Fund Flow Trend Oscillator
 *
 * Models institutional fund flow using a weighted simple average normalization
 * combined with EMA smoothing. Produces two lines: fund flow trend and bull/bear line.
 * Fund flow trend = double-smoothed stochastic-like normalization over 27 bars.
 * Bull/bear line = EMA(13) of typical price normalized over 34-bar highest/lowest.
 * Entry signal fires when fund_flow crosses above bull_bear and bull_bear < 25.
 *
 * Reference: TradingView "[blackcat] L3 Banker Fund Flow Trend Oscillator"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';

export interface BankerFundFlowInputs {
  normLength: number;
  typicalLength: number;
  emaLength: number;
  entryThreshold: number;
}

export const defaultInputs: BankerFundFlowInputs = {
  normLength: 27,
  typicalLength: 34,
  emaLength: 13,
  entryThreshold: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'normLength', type: 'int', title: 'Normalization Length', defval: 27, min: 2 },
  { id: 'typicalLength', type: 'int', title: 'Typical Price Length', defval: 34, min: 2 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 13, min: 1 },
  { id: 'entryThreshold', type: 'int', title: 'Entry Threshold', defval: 25, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fund Flow Trend', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Bull Bear Line', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Banker Fund Flow Trend Oscillator',
  shortTitle: 'BankerFlow',
  overlay: false,
};

/**
 * PineScript calculate_weighted_simple_average:
 *   sum_float := nz(sum_float[1]) - nz(src[length]) + src
 *   moving_average := na(src[length]) ? na : sum_float / length
 *   output := na(output[1]) ? moving_average : (src * weight + output[1] * (length - weight)) / length
 *
 * This is a stateful running sum + weighted EMA-like smoothing.
 */
function calcWeightedSimpleAverage(srcArr: number[], length: number, weight: number): number[] {
  const n = srcArr.length;
  const output: number[] = new Array(n);
  let sumFloat = 0;
  let prevOutput = NaN;

  for (let i = 0; i < n; i++) {
    const src = srcArr[i];
    const srcLag = i >= length ? srcArr[i - length] : NaN;

    // nz(sum_float[1]) - nz(src[length]) + src
    sumFloat = (isNaN(sumFloat) ? 0 : sumFloat) - (isNaN(srcLag) ? 0 : srcLag) + src;

    // moving_average := na(src[length]) ? na : sum_float / length
    const movingAverage = (i < length || isNaN(srcLag)) ? NaN : sumFloat / length;

    // output := na(output[1]) ? moving_average : (src * weight + output[1] * (length - weight)) / length
    if (isNaN(prevOutput)) {
      output[i] = movingAverage;
    } else {
      output[i] = (src * weight + prevOutput * (length - weight)) / length;
    }

    prevOutput = output[i];
  }

  return output;
}

export function calculate(bars: Bar[], inputs: Partial<BankerFundFlowInputs> = {}): IndicatorResult & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  const { normLength, typicalLength, emaLength, entryThreshold } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const lowSeries = new Series(bars, (b) => b.low);
  const highSeries = new Series(bars, (b) => b.high);

  // Highest/lowest over normLength (27) for stochastic normalization
  const hhNorm = ta.highest(highSeries, normLength).toArray();
  const llNorm = ta.lowest(lowSeries, normLength).toArray();

  // Raw stochastic normalization: (close - lowest(low, 27)) / (highest(high, 27) - lowest(low, 27)) * 100
  const rawNorm: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const h = hhNorm[i];
    const l = llNorm[i];
    if (h == null || isNaN(h) || l == null || isNaN(l) || h === l) {
      rawNorm[i] = NaN;
    } else {
      rawNorm[i] = ((bars[i].close - l) / (h - l)) * 100;
    }
  }

  // fund_flow_trend = (3 * WSA(rawNorm, 5, 1) - 2 * WSA(WSA(rawNorm, 5, 1), 3, 1) - 50) * 1.032 + 50
  const wsa1 = calcWeightedSimpleAverage(rawNorm, 5, 1);
  const wsa2 = calcWeightedSimpleAverage(wsa1, 3, 1);

  const fundFlowTrend: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const w1 = wsa1[i];
    const w2 = wsa2[i];
    if (isNaN(w1) || isNaN(w2)) {
      fundFlowTrend[i] = NaN;
    } else {
      fundFlowTrend[i] = (3 * w1 - 2 * w2 - 50) * 1.032 + 50;
    }
  }

  // Bull bear line: EMA((typical_price - lowest_low_34) / (highest_high_34 - lowest_low_34) * 100, 13)
  const typicalPrice: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    typicalPrice[i] = (2 * bars[i].close + bars[i].high + bars[i].low + bars[i].open) / 5;
  }

  const hhTyp = ta.highest(highSeries, typicalLength).toArray();
  const llTyp = ta.lowest(lowSeries, typicalLength).toArray();

  const normTypical: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const h = hhTyp[i];
    const l = llTyp[i];
    if (h == null || isNaN(h) || l == null || isNaN(l) || h === l) {
      normTypical[i] = NaN;
    } else {
      normTypical[i] = ((typicalPrice[i] - l) / (h - l)) * 100;
    }
  }

  const bullBearArr = ta.ema(Series.fromArray(bars, normTypical), emaLength).toArray();

  const warmup = Math.max(normLength, typicalLength) + emaLength;

  // Markers for entry signals: crossover of fund_flow_trend and bull_bear_line when bull_bear < threshold
  const markers: MarkerData[] = [];
  for (let i = warmup; i < n; i++) {
    const fft = fundFlowTrend[i];
    const bbl = bullBearArr[i];
    const fftPrev = fundFlowTrend[i - 1];
    const bblPrev = bullBearArr[i - 1];
    if (isNaN(fft) || bbl == null || isNaN(bbl) || isNaN(fftPrev) || bblPrev == null || isNaN(bblPrev)) continue;

    // crossover: fft crosses above bbl and bbl < threshold
    if (fftPrev <= bblPrev && fft > bbl && bbl < entryThreshold) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#FFD700', text: 'Entry' });
    }
  }

  const plot0 = fundFlowTrend.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  const plot1 = bullBearArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  // plotCandle: color-coded candles showing fund flow status
  // Pine: plotcandle(fund_flow_trend, bull_bear_line, fund_flow_trend, bull_bear_line, color=...)
  const candles: PlotCandleData[] = [];
  for (let i = warmup; i < n; i++) {
    const fft = fundFlowTrend[i];
    const bbl = bullBearArr[i];
    if (isNaN(fft) || bbl == null || isNaN(bbl)) continue;
    const prevFft = i > 0 ? fundFlowTrend[i - 1] : NaN;
    const threshold95 = isNaN(prevFft) ? fft : prevFft * 0.95;

    let color: string | undefined;
    if (fft > bbl) {
      // Banker increase position (green)
      color = '#26A69A';
    } else if (fft < bbl) {
      if (fft > threshold95) {
        // Weak rebound (blue)
        color = '#2196F3';
      } else {
        // Exit/quit (red)
        color = '#EF5350';
      }
    }
    if (fft < threshold95) {
      // Decrease position (white) overrides
      color = '#FFFFFF';
    }

    candles.push({
      time: bars[i].time,
      open: fft,
      high: Math.max(fft, bbl),
      low: Math.min(fft, bbl),
      close: bbl,
      color,
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 90, options: { color: '#E040FB', linestyle: 'dotted' as const, title: 'Strong' } },
      { value: 80, options: { color: '#EF5350', linestyle: 'dotted' as const, title: 'Overbought' } },
      { value: 20, options: { color: '#FFD700', linestyle: 'dotted' as const, title: 'Oversold' } },
      { value: 10, options: { color: '#66BB6A', linestyle: 'dotted' as const, title: 'Weak' } },
    ],
    fills: [
      { plot1: 'hline_oversold', plot2: 'hline_weak', options: { color: 'rgba(255, 235, 59, 0.3)' } },
      { plot1: 'hline_overbought', plot2: 'hline_strong', options: { color: 'rgba(224, 64, 251, 0.3)' } },
    ],
    markers,
    plotCandles: { candle0: candles },
  };
}

export const BankerFundFlow = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
