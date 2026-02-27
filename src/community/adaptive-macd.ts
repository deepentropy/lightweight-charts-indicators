/**
 * Adaptive MACD [LuxAlgo]
 *
 * R-squared correlation-based adaptive MACD.
 * The MACD line adapts its speed based on the Pearson correlation between
 * price and bar index (R²). When price is trending (high R²), MACD behaves
 * like standard MACD. When choppy (low R²), the adaptive factor K changes
 * the lag characteristics.
 *
 * Formula:
 *   a1 = 2/(fast+1), a2 = 2/(slow+1)
 *   r2 = 0.5 * correlation(close, bar_index, length)^2 + 0.5
 *   K = r2 * (1-a1)(1-a2) + (1-r2) * (1-a1)/(1-a2)
 *   macd[i] = (close - close[1]) * (a1-a2) + (2-a1-a2) * macd[1] - K * macd[2]
 *   signal = EMA(macd, signalLen)
 *   histogram = macd - signal
 *
 * Reference: TradingView "Adaptive MACD [LuxAlgo]"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AdaptiveMACDInputs {
  r2Period: number;
  fast: number;
  slow: number;
  signal: number;
}

export const defaultInputs: AdaptiveMACDInputs = {
  r2Period: 20,
  fast: 10,
  slow: 20,
  signal: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'r2Period', type: 'int', title: 'R² Period', defval: 20, min: 2 },
  { id: 'fast', type: 'int', title: 'Fast Length', defval: 10, min: 2 },
  { id: 'slow', type: 'int', title: 'Slow Length', defval: 20, min: 2 },
  { id: 'signal', type: 'int', title: 'Signal Length', defval: 9, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#5b9cf6', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'MACD', color: '#787B86', lineWidth: 2 },
  { id: 'plot2', title: 'Signal', color: '#ff5d00', lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive MACD',
  shortTitle: 'AdpMACD',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<AdaptiveMACDInputs> = {}): IndicatorResult {
  const { r2Period, fast, slow, signal } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const a1 = 2 / (fast + 1);
  const a2 = 2 / (slow + 1);

  // R² = 0.5 * correlation(close, bar_index, r2Period)^2 + 0.5
  const closeSeries = new Series(bars, (b) => b.close);
  const barIndex = new Series(bars, (_b, i) => i);
  const corrArr = ta.correlation(closeSeries, barIndex, r2Period).toArray();

  // MACD bar-by-bar (depends on macd[i-1] and macd[i-2])
  const macdArr: number[] = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const corr = corrArr[i];
    const r2 = (corr != null && !isNaN(corr)) ? 0.5 * corr * corr + 0.5 : 0.5;

    const K = r2 * ((1 - a1) * (1 - a2)) + (1 - r2) * ((1 - a1) / (1 - a2));

    const prevMacd1 = isNaN(macdArr[i - 1]) ? 0 : macdArr[i - 1];
    const prevMacd2 = i >= 2 && !isNaN(macdArr[i - 2]) ? macdArr[i - 2] : 0;

    macdArr[i] = (bars[i].close - bars[i - 1].close) * (a1 - a2)
      + (-a2 - a1 + 2) * prevMacd1
      - K * prevMacd2;
  }

  // Signal = EMA(macd, signal)
  const macdSeries = Series.fromArray(bars, macdArr);
  const signalArr = ta.ema(macdSeries, signal).toArray();

  const warmup = r2Period;

  const plot0Data: { time: number | string; value: number }[] = new Array(n);
  const plot1Data: { time: number | string; value: number }[] = new Array(n);
  const plot2Data: { time: number | string; value: number }[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (i < warmup) {
      plot0Data[i] = { time: t, value: NaN };
      plot1Data[i] = { time: t, value: NaN };
      plot2Data[i] = { time: t, value: NaN };
    } else {
      const m = macdArr[i];
      const s = signalArr[i];
      const sVal = (s != null && !isNaN(s)) ? s : NaN;
      const hist = (!isNaN(m) && !isNaN(sVal)) ? m - sVal : NaN;
      plot0Data[i] = { time: t, value: hist };
      plot1Data[i] = { time: t, value: isNaN(m) ? NaN : m };
      plot2Data[i] = { time: t, value: sVal };
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0Data, 'plot1': plot1Data, 'plot2': plot2Data },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const AdaptiveMACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
