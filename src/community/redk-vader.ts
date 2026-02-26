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
  { id: 'plot0', title: 'VADER', color: '#26A69A', lineWidth: 4, style: 'histogram' },
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

  const plot0 = bars.map((bar, i) => {
    if (i < warmup || rmaBull[i] == null || rmaBear[i] == null) {
      return { time: bar.time, value: NaN };
    }
    const v = rmaBull[i]! - rmaBear[i]!;
    const color = v >= 0 ? '#26A69A' : '#EF5350';
    return { time: bar.time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
    ],
  };
}

export const RedKVADER = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
