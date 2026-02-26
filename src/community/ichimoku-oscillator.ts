/**
 * Ichimoku Oscillator
 *
 * Oscillator derived from Ichimoku components: tenkan - kijun as histogram.
 * Tenkan = (highest high + lowest low) / 2 over conversionPeriods.
 * Kijun = (highest high + lowest low) / 2 over basePeriods.
 *
 * Reference: TradingView "Ichimoku Oscillator" (TV#302)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface IchimokuOscillatorInputs {
  conversionPeriods: number;
  basePeriods: number;
  laggingSpan: number;
}

export const defaultInputs: IchimokuOscillatorInputs = {
  conversionPeriods: 9,
  basePeriods: 26,
  laggingSpan: 52,
};

export const inputConfig: InputConfig[] = [
  { id: 'conversionPeriods', type: 'int', title: 'Conversion Periods', defval: 9, min: 1 },
  { id: 'basePeriods', type: 'int', title: 'Base Periods', defval: 26, min: 1 },
  { id: 'laggingSpan', type: 'int', title: 'Lagging Span', defval: 52, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Ichimoku Oscillator',
  shortTitle: 'IchiOsc',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<IchimokuOscillatorInputs> = {}): IndicatorResult {
  const { conversionPeriods, basePeriods, laggingSpan } = { ...defaultInputs, ...inputs };

  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);

  // Donchian midline: (highest + lowest) / 2
  const tenkan = ta.highest(high, conversionPeriods).add(ta.lowest(low, conversionPeriods)).div(2);
  const kijun = ta.highest(high, basePeriods).add(ta.lowest(low, basePeriods)).div(2);

  const osc = tenkan.sub(kijun);
  const oscArr = osc.toArray();

  const warmup = Math.max(conversionPeriods, basePeriods);

  const plot0 = oscArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const color = v >= 0 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
    ],
  };
}

export const IchimokuOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
