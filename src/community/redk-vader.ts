/**
 * RedK Volume-Accelerated Directional Energy Ratio (VADER)
 *
 * Bull power = close > open ? vol * (close-low)/(high-low) : vol * (close-open)/(high-low)
 * Bear power = close <= open ? vol * (open-low)/(high-low) : vol * (open-close)/(high-low)
 * VADER = RMA(bull, length) - RMA(bear, length)
 *
 * Reference: TradingView "RedK VADER" (TV#581)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RedKVADERInputs {
  length: number;
}

export const defaultInputs: RedKVADERInputs = {
  length: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VADER Signal', color: '#359bfc', lineWidth: 4 },
  { id: 'plot1', title: 'Demand Energy', color: 'rgba(0, 255, 255, 0.7)', lineWidth: 2 },
  { id: 'plot2', title: 'Supply Energy', color: 'rgba(255, 165, 0, 0.7)', lineWidth: 2 },
];

export const metadata = {
  title: 'RedK VADER',
  shortTitle: 'VADER',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RedKVADERInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const bullArr: number[] = new Array(n);
  const bearArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const { open, high, low, close, volume } = bars[i];
    const hl = high - low;
    if (hl === 0) {
      bullArr[i] = 0;
      bearArr[i] = 0;
      continue;
    }
    const vol = volume ?? 0;
    if (close > open) {
      bullArr[i] = vol * (close - low) / hl;
      bearArr[i] = vol * (open - close) / hl; // negative concept, but we take abs via formula
    } else {
      bullArr[i] = vol * (close - open) / hl; // close <= open, so close-open <= 0
      bearArr[i] = vol * (open - low) / hl;
    }
    // Ensure non-negative
    if (bullArr[i] < 0) bullArr[i] = 0;
    if (bearArr[i] < 0) bearArr[i] = 0;
  }

  const bullSeries = Series.fromArray(bars, bullArr);
  const bearSeries = Series.fromArray(bars, bearArr);
  const rmaBull = ta.rma(bullSeries, length).toArray();
  const rmaBear = ta.rma(bearSeries, length).toArray();

  const warmup = length;

  // VADER signal = demand - supply (colored by direction)
  const plot0 = bars.map((bar, i) => {
    if (i < warmup || rmaBull[i] == null || rmaBear[i] == null) {
      return { time: bar.time, value: NaN };
    }
    const v = rmaBull[i]! - rmaBear[i]!;
    const color = v >= 0 ? '#359bfc' : '#f57f17';
    return { time: bar.time, value: v, color };
  });

  // Demand and supply energy plots (for fill)
  const plot1 = bars.map((bar, i) => ({
    time: bar.time,
    value: (i < warmup || rmaBull[i] == null) ? NaN : rmaBull[i]!,
  }));

  const plot2 = bars.map((bar, i) => ({
    time: bar.time,
    value: (i < warmup || rmaBear[i] == null) ? NaN : rmaBear[i]!,
  }));

  // Dynamic fill: green when demand > supply, red when supply > demand
  const fillColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < warmup || rmaBull[i] == null || rmaBear[i] == null) {
      fillColors[i] = 'rgba(0,0,0,0)';
    } else {
      fillColors[i] = rmaBull[i]! > rmaBear[i]! ? 'rgba(0, 128, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    hlines: [
      { value: 0, options: { color: 'rgba(255, 238, 0, 0.3)', linestyle: 'solid' as const, title: 'Zero' } },
    ],
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(0, 128, 0, 0.2)' }, colors: fillColors },
    ],
  };
}

export const RedKVADER = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
