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
import type { BarColorData } from '../types';

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
  { id: 'plot2', title: 'Histogram', color: '#787B86', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Price Momentum Oscillator',
  shortTitle: 'PMO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PriceMomentumOscInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
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

  // Pine: plot(d, style=columns, color=ehc?hc:gray, transp=80, title="Histo")
  // hc = d>0 ? (d>d[1] ? lime : green) : (d<d[1] ? red : orange)
  const histo = pmo.map((v, i) => {
    const d = v - signal[i];
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const dPrev = i > 0 ? pmo[i - 1] - signal[i - 1] : 0;
    let color: string;
    if (d > 0) {
      color = d > dPrev ? '#00E676' : '#26A69A';
    } else {
      color = d < dPrev ? '#EF5350' : '#FF9800';
    }
    return { time: bars[i].time, value: d, color };
  });

  // Fill between PMO and Signal: green when PMO > signal, red when PMO < signal
  // Pine: fill(duml, sigl, green, transp=70) and fill(duml, mdl, red, transp=70)
  const fillColors: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      fillColors.push('rgba(0,0,0,0)');
    } else {
      fillColors.push(pmo[i] > signal[i] ? 'rgba(38,166,154,0.2)' : 'rgba(239,83,80,0.2)');
    }
  }

  // Bar colors: histogram direction
  // Pine: d>0 ? (d>d[1] ? lime : green) : (d<d[1] ? red : orange)
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    const d = pmo[i] - signal[i];
    const dPrev = i > 0 ? pmo[i - 1] - signal[i - 1] : 0;
    let color: string;
    if (d > 0) {
      color = d > dPrev ? '#00E676' : '#26A69A';
    } else {
      color = d < dPrev ? '#EF5350' : '#FF9800';
    }
    barColors.push({ time: bars[i].time, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(pmo), 'plot1': toPlot(signal), 'plot2': histo },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(38,166,154,0.2)' }, colors: fillColors }],
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
      { value: 2.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'OB Level' } },
      { value: -2.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'OS Level' } },
    ],
    barColors,
  };
}

export const PriceMomentumOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
