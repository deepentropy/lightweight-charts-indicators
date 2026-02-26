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
  { id: 'plot0', title: 'VA%', color: '#26A69A', lineWidth: 4, style: 'histogram' },
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

  const plot0 = bars.map((b, i) => {
    const smaVA = smaVAArr[i];
    const smaVol = smaVolArr[i];
    if (i < warmup || isNaN(smaVA) || isNaN(smaVol) || smaVol === 0) {
      return { time: b.time, value: NaN };
    }
    const vaPct = (smaVA / smaVol) * 100;
    const color = vaPct >= 0 ? '#26A69A' : '#EF5350';
    return { time: b.time, value: vaPct, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const VolumeAccumulationPct = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
