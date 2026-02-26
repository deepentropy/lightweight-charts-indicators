/**
 * MOST on RSI
 *
 * OTT-style trailing stop applied to RSI instead of price.
 * RSI is smoothed with EMA, then percentage-based trailing logic is applied.
 *
 * Reference: TradingView "MOST on RSI" (TV#452)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MOSTRSIInputs {
  rsiLen: number;
  percent: number;
  maLen: number;
}

export const defaultInputs: MOSTRSIInputs = {
  rsiLen: 14,
  percent: 8.0,
  maLen: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'percent', type: 'float', title: 'Percent', defval: 8.0, min: 0.1, step: 0.1 },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI MA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'MOST', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'MOST on RSI',
  shortTitle: 'MOST-RSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MOSTRSIInputs> = {}): IndicatorResult {
  const { rsiLen, percent, maLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const src = getSourceSeries(bars, 'close');
  const rsiSeries = ta.rsi(src, rsiLen);
  const rsiMa = ta.ema(rsiSeries, maLen);
  const rsiMaArr = rsiMa.toArray();

  // OTT trailing stop logic on RSI MA
  const longStop: number[] = new Array(n);
  const shortStop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const most: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const val = rsiMaArr[i] ?? 0;
    const fark = val * percent * 0.01;

    longStop[i] = val - fark;
    shortStop[i] = val + fark;

    if (i > 0) {
      if (val > longStop[i - 1]) longStop[i] = Math.max(longStop[i], longStop[i - 1]);
      if (val < shortStop[i - 1]) shortStop[i] = Math.min(shortStop[i], shortStop[i - 1]);

      dir[i] = dir[i - 1];
      if (dir[i - 1] === -1 && val > shortStop[i - 1]) dir[i] = 1;
      else if (dir[i - 1] === 1 && val < longStop[i - 1]) dir[i] = -1;
    } else {
      dir[i] = 1;
    }

    const mt = dir[i] === 1 ? longStop[i] : shortStop[i];
    most[i] = val > mt ? mt * (200 + percent) / 200 : mt * (200 - percent) / 200;
  }

  const warmup = rsiLen + maLen;

  const plot0 = rsiMaArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = most.map((v, i) => {
    if (i < warmup + 2) return { time: bars[i].time, value: NaN };
    const mostLag = most[i - 2];
    return { time: bars[i].time, value: mostLag };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const MOSTRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
