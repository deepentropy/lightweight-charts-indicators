/**
 * KDJ Indicator
 *
 * Extended Stochastic with J line = 3K - 2D.
 * J > 100 = extreme overbought, J < 0 = extreme oversold.
 *
 * K = bcwsma(RSV, signal, 1)  // equivalent to RMA
 * D = bcwsma(K, signal, 1)
 * J = 3K - 2D
 *
 * Reference: TradingView "KDJ Indicator" by KingThies
 */

import type { Bar, IndicatorResult, InputConfig, PlotConfig } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface KDJInputs {
  period: number;
  signal: number;
}

export const defaultInputs: KDJInputs = {
  period: 9,
  signal: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 9, min: 1 },
  { id: 'signal', type: 'int', title: 'Signal', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#FF9800', lineWidth: 2 },
  { id: 'plot1', title: 'D', color: '#00E676', lineWidth: 2 },
  { id: 'plot2', title: 'J', color: '#FF00FF', lineWidth: 1 },
];

export const metadata = {
  title: 'KDJ',
  shortTitle: 'KDJ',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<KDJInputs> = {}): IndicatorResult {
  const { period, signal } = { ...defaultInputs, ...inputs };

  const kArr: number[] = [];
  const dArr: number[] = [];
  const jArr: number[] = [];

  let pK = 0;
  let pD = 0;

  for (let i = 0; i < bars.length; i++) {
    const c = bars[i].close;

    // Highest high and lowest low over period
    let hh = bars[i].high;
    let ll = bars[i].low;
    const lookback = Math.min(i + 1, period);
    for (let j = 0; j < lookback; j++) {
      const b = bars[i - j];
      if (b.high > hh) hh = b.high;
      if (b.low < ll) ll = b.low;
    }

    const rsv = hh !== ll ? 100 * (c - ll) / (hh - ll) : 0;

    // bcwsma(s, l, m) = (m * s + (l - m) * prev) / l  where m=1
    // This is equivalent to RMA with alpha = 1/signal
    pK = (rsv + (signal - 1) * pK) / signal;
    pD = (pK + (signal - 1) * pD) / signal;
    const pJ = 3 * pK - 2 * pD;

    kArr.push(pK);
    dArr.push(pD);
    jArr.push(pJ);
  }

  const warmup = period - 1;
  const toPlot = (arr: number[]) =>
    arr.map((value, i) => ({ time: bars[i].time, value: i < warmup ? NaN : value }));

  // bgcolor: green when J > D, red otherwise, 70% transparency
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    bgColors.push({
      time: bars[i].time as number,
      color: jArr[i] > dArr[i] ? 'rgba(0,128,0,0.3)' : 'rgba(255,0,0,0.3)',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(kArr), 'plot1': toPlot(dArr), 'plot2': toPlot(jArr) },
    bgColors,
  } as IndicatorResult & { bgColors: BgColorData[] };
}

export const KDJ = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
