/**
 * UCS Murrey's Math Oscillator V2
 *
 * Murrey Math Lines as oscillator. Normalizes price position within
 * highest high / lowest low range to 0-100 scale.
 * Key levels at 0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100.
 *
 * Reference: TradingView "UCS_Murrey's Math Oscillator V2" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MurreysOscillatorInputs {
  length: number;
}

export const defaultInputs: MurreysOscillatorInputs = {
  length: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 100, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: "Murrey's Math Oscillator",
  shortTitle: 'MMO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MurreysOscillatorInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const hh = ta.highest(highSeries, length);
  const ll = ta.lowest(lowSeries, length);

  const hhArr = hh.toArray();
  const llArr = ll.toArray();

  const plot0 = bars.map((b, i) => {
    if (i < length || hhArr[i] == null || llArr[i] == null) {
      return { time: b.time, value: NaN };
    }
    const top = hhArr[i]!;
    const bottom = llArr[i]!;
    const range = top - bottom;
    const osc = range === 0 ? 50 : ((b.close - bottom) / range) * 100;
    return { time: b.time, value: osc };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 100, options: { color: '#EF5350', linestyle: 'dashed' as const, title: '8/8' } },
      { value: 75, options: { color: '#FF6D00', linestyle: 'dashed' as const, title: '6/8' } },
      { value: 50, options: { color: '#787B86', linestyle: 'solid' as const, title: '4/8' } },
      { value: 25, options: { color: '#FF6D00', linestyle: 'dashed' as const, title: '2/8' } },
      { value: 0, options: { color: '#26A69A', linestyle: 'dashed' as const, title: '0/8' } },
    ],
  };
}

export const MurreysOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
