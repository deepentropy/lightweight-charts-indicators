/**
 * Bollinger Awesome Alert
 *
 * Awesome Oscillator (AO) = SMA(hl2, fast) - SMA(hl2, slow).
 * Bollinger Bands applied to AO: upper/lower/mid bands.
 * Signals when AO crosses above/below BB bounds.
 *
 * Reference: TradingView "Bollinger Awesome Alert" (TV#89)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BollingerAwesomeAlertInputs {
  aoFast: number;
  aoSlow: number;
  bbLen: number;
  bbMult: number;
}

export const defaultInputs: BollingerAwesomeAlertInputs = {
  aoFast: 5,
  aoSlow: 34,
  bbLen: 20,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'aoFast', type: 'int', title: 'AO Fast', defval: 5, min: 1 },
  { id: 'aoSlow', type: 'int', title: 'AO Slow', defval: 34, min: 1 },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.01, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AO', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Upper', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'Mid', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Bollinger Awesome Alert',
  shortTitle: 'BBAO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BollingerAwesomeAlertInputs> = {}): IndicatorResult {
  const { aoFast, aoSlow, bbLen, bbMult } = { ...defaultInputs, ...inputs };

  const hl2 = getSourceSeries(bars, 'hl2');
  const ao = ta.sma(hl2, aoFast).sub(ta.sma(hl2, aoSlow));

  // BB on AO
  const mid = ta.sma(ao, bbLen);
  const dev = ta.stdev(ao, bbLen).mul(bbMult);
  const upper = mid.add(dev);
  const lower = mid.sub(dev);

  const aoArr = ao.toArray();
  const upperArr = upper.toArray();
  const lowerArr = lower.toArray();
  const midArr = mid.toArray();

  const warmup = aoSlow + bbLen;

  const plot0 = aoArr.map((v, i) => {
    if (i < aoSlow || v == null) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (aoArr[i - 1] ?? NaN) : NaN;
    const color = v >= prev ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = upperArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  const plot2 = lowerArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  const plot3 = midArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
    ],
  };
}

export const BollingerAwesomeAlert = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
