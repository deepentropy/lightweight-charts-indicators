/**
 * Support and Resistance Levels with Breaks
 *
 * Pivot-based S/R with break detection.
 * Tracks pivot highs as resistance and pivot lows as support.
 * Detects breaks when close crosses above resistance or below support.
 *
 * Reference: TradingView "Support and Resistance Levels with Breaks" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface SRLevelsBreaksInputs {
  pivotLen: number;
  volumeThresh: number;
}

export const defaultInputs: SRLevelsBreaksInputs = {
  pivotLen: 10,
  volumeThresh: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Pivot Length', defval: 10, min: 1 },
  { id: 'volumeThresh', type: 'float', title: 'Volume Threshold', defval: 20, min: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'Support', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Support and Resistance Levels with Breaks',
  shortTitle: 'S/R Breaks',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SRLevelsBreaksInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { pivotLen, volumeThresh } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Volume oscillator: osc = 100 * (ema(vol,5) - ema(vol,10)) / ema(vol,10)
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const volEma5 = ta.ema(volSeries, 5).toArray();
  const volEma10 = ta.ema(volSeries, 10).toArray();
  const volOsc: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const e5 = volEma5[i] ?? 0;
    const e10 = volEma10[i] ?? 0;
    volOsc[i] = e10 !== 0 ? 100 * (e5 - e10) / e10 : 0;
  }

  const phArr = ta.pivothigh(highSeries, pivotLen, pivotLen).toArray();
  const plArr = ta.pivotlow(lowSeries, pivotLen, pivotLen).toArray();

  const warmup = pivotLen * 2;
  let lastResistance = NaN;
  let lastSupport = NaN;

  const resistancePlot = [];
  const supportPlot = [];
  const markers: MarkerData[] = [];

  for (let i = 0; i < n; i++) {
    if (i >= warmup && !isNaN(phArr[i]) && phArr[i] !== 0) {
      lastResistance = phArr[i];
    }
    if (i >= warmup && !isNaN(plArr[i]) && plArr[i] !== 0) {
      lastSupport = plArr[i];
    }

    // Break detection: invalidate level when price breaks through
    // Volume filter: only generate markers when volume oscillator > threshold
    const volPass = volOsc[i] > volumeThresh;
    if (!isNaN(lastResistance) && bars[i].close > lastResistance) {
      // Resistance break (bullish)
      if (i >= warmup && volPass) {
        const bullWick = (bars[i].open - bars[i].low) > (bars[i].close - bars[i].open);
        markers.push({
          time: bars[i].time, position: 'belowBar', shape: 'labelUp',
          color: '#26A69A', text: bullWick ? 'Bull Wick' : 'B',
        });
      }
      lastResistance = NaN;
    }
    if (!isNaN(lastSupport) && bars[i].close < lastSupport) {
      // Support break (bearish)
      if (i >= warmup && volPass) {
        const bearWick = (bars[i].open - bars[i].close) < (bars[i].high - bars[i].open);
        markers.push({
          time: bars[i].time, position: 'aboveBar', shape: 'labelDown',
          color: '#EF5350', text: bearWick ? 'Bear Wick' : 'B',
        });
      }
      lastSupport = NaN;
    }

    resistancePlot.push({ time: bars[i].time, value: i < warmup ? NaN : lastResistance });
    supportPlot.push({ time: bars[i].time, value: i < warmup ? NaN : lastSupport });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': resistancePlot, 'plot1': supportPlot },
    markers,
  };
}

export const SRLevelsBreaks = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
