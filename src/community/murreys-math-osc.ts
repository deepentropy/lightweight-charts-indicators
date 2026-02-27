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
import type { BarColorData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<MurreysOscillatorInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { length } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const hh = ta.highest(highSeries, length);
  const ll = ta.lowest(lowSeries, length);

  const hhArr = hh.toArray();
  const llArr = ll.toArray();

  // Murrey Math color zones based on oscillator position (0-100 mapped from Pine's -1 to +1)
  const getOscColor = (osc: number): string => {
    if (osc > 50) {
      if (osc < 62.5) return '#ADFF2F';       // yellow-green
      if (osc < 75) return '#32CD32';          // lime green
      if (osc < 87.5) return '#3CB371';        // medium sea green
      return '#008000';                         // green
    } else {
      if (osc > 37.5) return '#CD5C5C';        // indian red
      if (osc > 25) return '#FA8072';           // salmon
      if (osc > 12.5) return '#FFA07A';         // light salmon
      return '#FF0000';                         // red
    }
  };

  const plot0: Array<{ time: number; value: number; color?: string }> = [];
  const barColors: BarColorData[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < length || hhArr[i] == null || llArr[i] == null) {
      plot0.push({ time: bars[i].time, value: NaN });
      continue;
    }
    const top = hhArr[i]!;
    const bottom = llArr[i]!;
    const range = top - bottom;
    const osc = range === 0 ? 50 : ((bars[i].close - bottom) / range) * 100;
    const color = getOscColor(osc);
    plot0.push({ time: bars[i].time, value: osc, color });
    barColors.push({ time: bars[i].time, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 100, options: { color: '#787B86', linestyle: 'dashed' as const, title: '8/8' } },
      { value: 87.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: '7/8' } },
      { value: 75, options: { color: '#787B86', linestyle: 'dashed' as const, title: '6/8' } },
      { value: 62.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: '5/8' } },
      { value: 50, options: { color: '#787B86', linestyle: 'solid' as const, title: '4/8 Zero' } },
      { value: 37.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: '3/8' } },
      { value: 25, options: { color: '#787B86', linestyle: 'dashed' as const, title: '2/8' } },
      { value: 12.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: '1/8' } },
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: '0/8' } },
    ],
    barColors,
  };
}

export const MurreysOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
