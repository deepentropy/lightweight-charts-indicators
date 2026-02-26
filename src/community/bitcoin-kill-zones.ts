/**
 * BITCOIN KILL ZONES v2
 *
 * Volatility-based momentum indicator using Bollinger Band %B.
 * Kill zone when %B > 1.0 (above upper BB) or %B < 0 (below lower BB).
 *
 * Reference: TradingView "BITCOIN KILL ZONES v2" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface BitcoinKillZonesInputs {
  length: number;
  mult: number;
  src: SourceType;
}

export const defaultInputs: BitcoinKillZonesInputs = {
  length: 14,
  mult: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%B', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Bitcoin Kill Zones',
  shortTitle: 'BKZ',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BitcoinKillZonesInputs> = {}): IndicatorResult {
  const { length, mult, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const [bbUpper, , bbLower] = ta.bb(source, length, mult);
  const upperArr = bbUpper.toArray();
  const lowerArr = bbLower.toArray();
  const sourceArr = source.toArray();

  const warmup = length;

  const plot0 = bars.map((b, i) => {
    if (i < warmup) return { time: b.time, value: NaN };
    const upper = upperArr[i] ?? NaN;
    const lower = lowerArr[i] ?? NaN;
    const range = upper - lower;
    if (isNaN(range) || range === 0) return { time: b.time, value: NaN };
    const pctB = ((sourceArr[i] ?? NaN) - lower) / range;
    // Color: red if kill zone (>1 or <0), blue otherwise
    const color = (pctB > 1.0 || pctB < 0) ? '#EF5350' : '#2962FF';
    return { time: b.time, value: pctB, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 1.0, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Upper' } },
      { value: 0.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Mid' } },
      { value: 0.0, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'Lower' } },
    ],
  };
}

export const BitcoinKillZones = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
