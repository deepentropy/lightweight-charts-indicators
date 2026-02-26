/**
 * Laguerre RSI
 *
 * Four-element Laguerre filter applied to price, then RSI-like ratio
 * of cumulative ups / (cumulative ups + cumulative downs) across filter stages.
 * gamma controls responsiveness (higher = smoother).
 *
 * Reference: TradingView "laguerre RSI v4" by TheLark
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface LaguerreRSIInputs {
  gamma: number;
  smooth: number;
}

export const defaultInputs: LaguerreRSIInputs = {
  gamma: 0.75,
  smooth: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'gamma', type: 'float', title: 'Gamma', defval: 0.75, min: 0, max: 1, step: 0.01 },
  { id: 'smooth', type: 'int', title: 'Smoothing (1 = off)', defval: 1, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Laguerre RSI', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Laguerre RSI',
  shortTitle: 'LRSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<LaguerreRSIInputs> = {}): IndicatorResult {
  const { gamma, smooth } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const g = gamma;

  const lrsiRaw: number[] = new Array(n);
  let L0 = 0, L1 = 0, L2 = 0, L3 = 0;
  let pL0 = 0, pL1 = 0, pL2 = 0;

  for (let i = 0; i < n; i++) {
    const p = bars[i].close;
    pL0 = L0; pL1 = L1; pL2 = L2;
    L0 = (1 - g) * p + g * pL0;
    L1 = -g * L0 + pL0 + g * pL1;
    L2 = -g * L1 + pL1 + g * pL2;
    L3 = -g * L2 + pL2 + g * L3;

    const cu = (L0 > L1 ? L0 - L1 : 0) + (L1 > L2 ? L1 - L2 : 0) + (L2 > L3 ? L2 - L3 : 0);
    const cd = (L0 < L1 ? L1 - L0 : 0) + (L1 < L2 ? L2 - L1 : 0) + (L2 < L3 ? L3 - L2 : 0);
    lrsiRaw[i] = (cu + cd) === 0 ? 0 : cu / (cu + cd);
  }

  // Optional EMA smoothing
  let finalArr: number[];
  if (smooth > 1) {
    const rawSeries = Series.fromArray(bars, lrsiRaw);
    finalArr = ta.ema(rawSeries, smooth).toArray().map((v) => v ?? NaN);
  } else {
    finalArr = lrsiRaw;
  }

  const warmup = 4; // Minimal warmup for 4-stage Laguerre filter
  const plot0 = finalArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? finalArr[i - 1] : v;
    const color = v > prev ? '#26A69A' : v < prev ? '#EF5350' : '#26A69A';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0.8, options: { color: '#800000', linestyle: 'solid', title: 'Overbought' } },
      { value: 0.2, options: { color: '#800000', linestyle: 'solid', title: 'Oversold' } },
    ],
  };
}

export const LaguerreRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
