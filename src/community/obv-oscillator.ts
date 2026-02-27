/**
 * OBV Oscillator
 *
 * On Balance Volume minus its EMA, displayed as a histogram.
 * Positive values indicate accumulation, negative indicate distribution.
 *
 * Reference: TradingView community indicator
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface OBVOscillatorInputs {
  length: number;
}

export const defaultInputs: OBVOscillatorInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OBV Oscillator', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'OBV Osc Area', color: '#C0C0C0', lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: 'OBV Oscillator',
  shortTitle: 'OBVOsc',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<OBVOscillatorInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  // Compute cumulative OBV
  const obvArr: number[] = new Array(bars.length);
  obvArr[0] = bars[0]?.volume ?? 0;
  for (let i = 1; i < bars.length; i++) {
    const vol = bars[i].volume ?? 0;
    if (bars[i].close > bars[i - 1].close) {
      obvArr[i] = obvArr[i - 1] + vol;
    } else if (bars[i].close < bars[i - 1].close) {
      obvArr[i] = obvArr[i - 1] - vol;
    } else {
      obvArr[i] = obvArr[i - 1];
    }
  }

  // EMA of OBV
  const obvSeries = new Series(bars, (_b, i) => obvArr[i]);
  const obvEmaArr = ta.ema(obvSeries, length).toArray();

  const warmup = length;

  const plot0 = obvArr.map((obv, i) => {
    const ema = obvEmaArr[i];
    if (i < warmup || ema == null) return { time: bars[i].time, value: NaN };
    const osc = obv - ema;
    const color = osc >= 0 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: osc, color };
  });

  // Area plot: same data, silver color (Pine: plot(obv_osc, color=silver, transp=70, style=area))
  const plot1 = plot0.map(p => ({ time: p.time, value: p.value }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const OBVOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
