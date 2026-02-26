/**
 * DecisionPoint Price Momentum Oscillator (PMO)
 *
 * Double-smoothed ROC oscillator.
 * ROC_MA = custom EMA of 1-bar ROC (period = firstLength)
 * PMO = custom EMA of 10 * ROC_MA (period = secondLength)
 * Signal = custom EMA of PMO (period = signalLength)
 *
 * Reference: TradingView "DecisionPoint Price Momentum Oscillator [LazyBear]"
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface PriceMomentumOscInputs {
  firstLength: number;
  secondLength: number;
  signalLength: number;
}

export const defaultInputs: PriceMomentumOscInputs = {
  firstLength: 35,
  secondLength: 20,
  signalLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'firstLength', type: 'int', title: '1st Smoothing', defval: 35, min: 1 },
  { id: 'secondLength', type: 'int', title: '2nd Smoothing', defval: 20, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PMO', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Price Momentum Oscillator',
  shortTitle: 'PMO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PriceMomentumOscInputs> = {}): IndicatorResult {
  const { firstLength, secondLength, signalLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Custom EMA: val = prev + (src - prev) * (2 / period)
  const alpha1 = 2 / firstLength;
  const alpha2 = 2 / secondLength;
  const alpha3 = 2 / signalLength;

  const rocMA: number[] = new Array(n);
  const pmo: number[] = new Array(n);
  const signal: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    // 1-bar ROC
    const roc = i > 0 && bars[i - 1].close !== 0
      ? ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * 100
      : 0;

    // 1st smoothing
    rocMA[i] = i === 0 ? roc : rocMA[i - 1] + (roc - rocMA[i - 1]) * alpha1;

    // 2nd smoothing (multiply by 10)
    const rocMA10 = 10 * rocMA[i];
    pmo[i] = i === 0 ? rocMA10 : pmo[i - 1] + (rocMA10 - pmo[i - 1]) * alpha2;

    // Signal
    signal[i] = i === 0 ? pmo[i] : signal[i - 1] + (pmo[i] - signal[i - 1]) * alpha3;
  }

  const warmup = firstLength;
  const toPlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(pmo), 'plot1': toPlot(signal) },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
    ],
  };
}

export const PriceMomentumOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
