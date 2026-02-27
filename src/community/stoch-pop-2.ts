/**
 * CM Stochastic POP Method 2
 *
 * Enhanced POP: K crosses above D while both below 20 = buy,
 * K crosses below D while both above 80 = sell.
 *
 * Reference: TradingView "CM_Stochastic POP Method 2" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface StochPOP2Inputs {
  kLen: number;
  kSmooth: number;
  ul: number;
  ll: number;
}

export const defaultInputs: StochPOP2Inputs = {
  kLen: 14,
  kSmooth: 5,
  ul: 55,
  ll: 45,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: 'Stochastic Length', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: 'Smooth K', defval: 5, min: 1 },
  { id: 'ul', type: 'int', title: 'Buy Entry/Exit Line', defval: 55, min: 50 },
  { id: 'll', type: 'int', title: 'Sell Entry/Exit Line', defval: 45, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stochastic', color: '#2962FF', lineWidth: 4 },
  { id: 'upperLine', title: 'Upper Line', color: '#00E676', lineWidth: 4 },
  { id: 'line100', title: '100 Line', color: '#FFFFFF', lineWidth: 1 },
  { id: 'lowerLine', title: 'Lower Line', color: '#FF0000', lineWidth: 4 },
  { id: 'line0', title: '0 Line', color: '#FFFFFF', lineWidth: 1 },
];

export const metadata = {
  title: 'CM Stochastic POP Method 2',
  shortTitle: 'StochPOP2',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StochPOP2Inputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
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

  // Barcolor: lime when k >= ul (Long), red when k <= ll (Short), blue otherwise (NoTrade)
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const v = kArr[i] ?? 0;
    if (v >= ul) {
      barColors.push({ time: bars[i].time, color: '#00FF00' });
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

export const StochPOP2 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
