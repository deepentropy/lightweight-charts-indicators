/**
 * Stochastic Oscillator Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Compares closing price to its price range over a given period.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';

export interface StochasticInputs {
  periodK: number;
  smoothK: number;
  periodD: number;
}

export const defaultInputs: StochasticInputs = {
  periodK: 14,
  smoothK: 1,
  periodD: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'periodK', type: 'int', title: '%K Length', defval: 14, min: 1 },
  { id: 'smoothK', type: 'int', title: '%K Smoothing', defval: 1, min: 1 },
  { id: 'periodD', type: 'int', title: '%D Smoothing', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%K', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: '%D', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 80, color: '#787B86', linestyle: 'solid', title: 'Upper Band' },
  { id: 'hline_mid',   price: 50, color: '#787B8680', linestyle: 'solid', title: 'Middle Band' },
  { id: 'hline_lower', price: 20, color: '#787B86', linestyle: 'solid', title: 'Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF1A' },
];

export const metadata = {
  title: 'Stochastic',
  shortTitle: 'Stoch',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StochasticInputs> = {}): IndicatorResult {
  const { periodK, smoothK, periodD } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, (bar) => bar.close);
  const high = new Series(bars, (bar) => bar.high);
  const low = new Series(bars, (bar) => bar.low);

  // Raw Stochastic %K = (close - lowest low) / (highest high - lowest low) * 100
  const stochRaw = ta.stoch(close, high, low, periodK);

  // Smooth %K with SMA
  const k = ta.sma(stochRaw, smoothK);

  // %D = SMA of %K
  const d = ta.sma(k, periodD);

  const kData = k.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const dData = d.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': kData,
      'plot1': dData,
    },
  };
}

export const Stochastic = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
