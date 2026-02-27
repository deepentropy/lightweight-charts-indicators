/**
 * CM Stochastic POP Method 1
 *
 * Stochastic POP: When stochastic is between 40-60, then pops above 60 = buy, below 40 = sell.
 *
 * Reference: TradingView "CM_Stochastic POP Method 1" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface StochPOP1Inputs {
  kLen: number;
  kSmooth: number;
  ul: number;
  ll: number;
}

export const defaultInputs: StochPOP1Inputs = {
  kLen: 14,
  kSmooth: 5,
  ul: 60,
  ll: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: 'Stochastic Length', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: 'Smooth K', defval: 5, min: 1 },
  { id: 'ul', type: 'int', title: 'Buy Entry/Exit Line', defval: 60, min: 50 },
  { id: 'll', type: 'int', title: 'Sell Entry/Exit Line', defval: 30, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stochastic', color: '#2962FF', lineWidth: 4 },
  { id: 'upperLine', title: 'Upper Line', color: '#00E676', lineWidth: 4 },
  { id: 'line100', title: '100 Line', color: '#FFFFFF', lineWidth: 1 },
  { id: 'lowerLine', title: 'Lower Line', color: '#FF0000', lineWidth: 4 },
  { id: 'line0', title: '0 Line', color: '#FFFFFF', lineWidth: 1 },
];

export const metadata = {
  title: 'CM Stochastic POP Method 1',
  shortTitle: 'StochPOP1',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StochPOP1Inputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { kLen, kSmooth, ul, ll } = { ...defaultInputs, ...inputs };

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const rawK = ta.stoch(closeSeries, highSeries, lowSeries, kLen);
  const k = ta.sma(rawK, kSmooth);
  const kArr = k.toArray();
  const warmup = kLen + kSmooth;

  // Stochastic line with per-bar color: green >= ul, red <= ll, blue otherwise
  const plot0 = kArr.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    const color = v >= ul ? '#00E676' : v <= ll ? '#FF0000' : '#2962FF';
    return { time: bars[i].time, value: v, color };
  });

  // Zone boundary plots
  const upperLine = bars.map(b => ({ time: b.time, value: ul }));
  const line100 = bars.map(b => ({ time: b.time, value: 100 }));
  const lowerLine = bars.map(b => ({ time: b.time, value: ll }));
  const line0 = bars.map(b => ({ time: b.time, value: 0 }));

  // Barcolor: green when k >= ul (Long), red when k <= ll (Short), blue otherwise (NoTrade)
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const v = kArr[i] ?? 0;
    if (v >= ul) {
      barColors.push({ time: bars[i].time, color: '#00E676' });
    } else if (v <= ll) {
      barColors.push({ time: bars[i].time, color: '#FF0000' });
    } else {
      barColors.push({ time: bars[i].time, color: '#2962FF' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'upperLine': upperLine, 'line100': line100, 'lowerLine': lowerLine, 'line0': line0 },
    fills: [
      { plot1: 'upperLine', plot2: 'line100', options: { color: 'rgba(0,230,118,0.1)' } },
      { plot1: 'upperLine', plot2: 'lowerLine', options: { color: 'rgba(41,98,255,0.1)' } },
      { plot1: 'lowerLine', plot2: 'line0', options: { color: 'rgba(255,0,0,0.1)' } },
    ],
    barColors,
  };
}

export const StochPOP1 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
