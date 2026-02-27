/**
 * Volume Accumulation Percentage Indicator
 *
 * Measures buying/selling pressure as a percentage using volume-weighted
 * price position within the bar range.
 * VA = volume * ((close - low) - (high - close)) / range
 * VA% = SMA(VA, length) / SMA(volume, length) * 100
 *
 * Reference: TradingView "Volume Accumulation Percentage Indicator [LazyBear]"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeAccumulationPctInputs {
  length: number;
}

export const defaultInputs: VolumeAccumulationPctInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VA%', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'VAPI Histogram', color: '#787B86', lineWidth: 4, style: 'histogram' },
  { id: 'plotU', title: 'DummyU', color: '#787B86', lineWidth: 1 },
  { id: 'plotL', title: 'DummyL', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Accumulation Percentage',
  shortTitle: 'VA%',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeAccumulationPctInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Compute VA for each bar
  const vaArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const range = bars[i].high - bars[i].low;
    const vol = bars[i].volume ?? 0;
    vaArr[i] = range > 0 ? vol * ((bars[i].close - bars[i].low) - (bars[i].high - bars[i].close)) / range : 0;
  }

  const vaSeries = new Series(bars, (_b, i) => vaArr[i]);
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const smaVAArr = ta.sma(vaSeries, length).toArray();
  const smaVolArr = ta.sma(volSeries, length).toArray();

  const warmup = length;

  const vaValues: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const smaVA = smaVAArr[i];
    const smaVol = smaVolArr[i];
    if (i < warmup || isNaN(smaVA) || isNaN(smaVol) || smaVol === 0) {
      vaValues[i] = NaN;
    } else {
      vaValues[i] = (smaVA / smaVol) * 100;
    }
  }

  // plot0: VA% oscillator line
  const plot0 = vaValues.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
  }));

  // plot1: histogram (same values, colored)
  const plot1 = vaValues.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
    color: v >= 0 ? '#787B86' : '#787B86',
  }));

  // DummyU: us = va<0 ? 0 : (va==0 ? va[prev] : va) — positive portion capped at 0 on negative side
  // DummyL: ls = va>0 ? 0 : (va==0 ? va[prev] : va) — negative portion capped at 0 on positive side
  const plotU = vaValues.map((v, i) => {
    if (isNaN(v)) return { time: bars[i].time, value: NaN };
    const us = v < 0 ? 0 : (v === 0 ? (vaValues[i - 1] ?? 0) : v);
    return { time: bars[i].time, value: us };
  });

  const plotL = vaValues.map((v, i) => {
    if (isNaN(v)) return { time: bars[i].time, value: NaN };
    const ls = v > 0 ? 0 : (v === 0 ? (vaValues[i - 1] ?? 0) : v);
    return { time: bars[i].time, value: ls };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plotU': plotU, 'plotL': plotL },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
    fills: [
      { plot1: 'plotU', plot2: 'plot1', options: { color: 'rgba(255, 0, 0, 0.5)' } },
      { plot1: 'plotL', plot2: 'plot1', options: { color: 'rgba(0, 255, 0, 0.5)' } },
    ],
  };
}

export const VolumeAccumulationPct = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
