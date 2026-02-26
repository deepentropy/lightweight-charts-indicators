/**
 * Bollinger Bands Stochastic RSI Extreme Signal
 *
 * StochRSI with BB extreme signals.
 * RSI -> Stochastic of RSI -> K = SMA(stochRSI, kSmooth) -> D = SMA(K, dSmooth).
 *
 * Reference: TradingView "BB Stochastic RSI Extreme Signal"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface BBStochRSIInputs {
  rsiLen: number;
  stochLen: number;
  kSmooth: number;
  dSmooth: number;
  src: SourceType;
}

export const defaultInputs: BBStochRSIInputs = {
  rsiLen: 14,
  stochLen: 14,
  kSmooth: 3,
  dSmooth: 3,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: '%K Smoothing', defval: 3, min: 1 },
  { id: 'dSmooth', type: 'int', title: '%D Smoothing', defval: 3, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'D', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'BB Stochastic RSI Extreme Signal',
  shortTitle: 'BBStochRSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BBStochRSIInputs> = {}): IndicatorResult {
  const { rsiLen, stochLen, kSmooth, dSmooth, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();

  // Stochastic of RSI: (rsi - lowest(rsi, stochLen)) / (highest(rsi, stochLen) - lowest(rsi, stochLen)) * 100
  const rsiHigh = ta.highest(rsi, stochLen);
  const rsiLow = ta.lowest(rsi, stochLen);
  const rsiHighArr = rsiHigh.toArray();
  const rsiLowArr = rsiLow.toArray();

  const stochRSI: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = rsiArr[i];
    const h = rsiHighArr[i];
    const l = rsiLowArr[i];
    if (r == null || h == null || l == null || h === l) {
      stochRSI[i] = 0;
    } else {
      stochRSI[i] = (r - l) / (h - l) * 100;
    }
  }

  const stochSeries = Series.fromArray(bars, stochRSI);
  const k = ta.sma(stochSeries, kSmooth);
  const d = ta.sma(k, dSmooth);

  const kArr = k.toArray();
  const dArr = d.toArray();
  const warmup = rsiLen + stochLen + kSmooth;

  const plot0 = kArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = dArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 80, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Midline' } },
      { value: 20, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const BBStochRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
