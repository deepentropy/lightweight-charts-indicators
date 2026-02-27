/**
 * Premier Stochastic Oscillator
 *
 * Stochastic → normalize to [-5,5] → double EMA smoothing → exp sigmoid (IFT).
 * Output oscillates between -1 and +1.
 *
 * Reference: TradingView "Premier Stochastic Oscillator [LazyBear]"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface PremierStochasticInputs {
  stochLength: number;
  smoothLength: number;
  src: SourceType;
}

export const defaultInputs: PremierStochasticInputs = {
  stochLength: 8,
  smoothLength: 25,
  src: 'close' as SourceType,
};

export const inputConfig: InputConfig[] = [
  { id: 'stochLength', type: 'int', title: 'Stoch Length', defval: 8, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smooth Length', defval: 25, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PSO', color: '#000000', lineWidth: 2 },
  { id: 'plot1', title: 'PSO Histogram', color: '#2196F3', lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Premier Stochastic Oscillator',
  shortTitle: 'PSO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PremierStochasticInputs> = {}): IndicatorResult {
  const { stochLength, smoothLength, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const rawStoch = ta.stoch(srcSeries, highSeries, lowSeries, stochLength).toArray();

  // Normalize: nStoch = 0.1 * (rawStoch - 50)
  const nStoch: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    nStoch[i] = isNaN(rawStoch[i]) ? 0 : 0.1 * (rawStoch[i] - 50);
  }

  const nStochSeries = new Series(bars, (_b, i) => nStoch[i]);
  const ss1 = ta.ema(nStochSeries, smoothLength).toArray();

  const ss1Series = new Series(bars, (_b, i) => isNaN(ss1[i]) ? 0 : ss1[i]);
  const ss = ta.ema(ss1Series, smoothLength).toArray();

  // IFT: PSO = (exp(2*ss) - 1) / (exp(2*ss) + 1)
  const psoArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const v = isNaN(ss[i]) ? 0 : ss[i];
    const e = Math.exp(2 * v);
    psoArr[i] = (e - 1) / (e + 1);
  }

  const warmup = stochLength + smoothLength * 2;

  // Pine: plot(pso, title="Premier Stoch", color=black, linewidth=2) -- line
  const plot0 = psoArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v };
  });

  // Pine: plot(pso, color=iff(pso < 0, red, blue), style=histogram) -- histogram with conditional color
  const plot1 = psoArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = v < 0 ? '#EF5350' : '#2196F3';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
      { value: 0.2, options: { color: '#2196F3', linestyle: 'dashed' as const, title: 'Upper Trigger' } },
      { value: 0.9, options: { color: '#2196F3', linestyle: 'solid' as const, title: 'Upper' } },
      { value: -0.2, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Lower Trigger' } },
      { value: -0.9, options: { color: '#EF5350', linestyle: 'solid' as const, title: 'Lower' } },
    ],
  };
}

export const PremierStochastic = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
