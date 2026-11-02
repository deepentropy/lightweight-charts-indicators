/**
 * Example: find an indicator in the registry, run it on OHLCV bars and read its outputs.
 *
 * Bars are `{ time, open, high, low, close, volume? }` in time order, `time` in UNIX seconds (the lightweight-charts
 * unit). Every output point keeps the `time` of its bar.
 */

import {
  indicatorRegistry,
  MissingSymbolDataError,
  type ChartContext,
  type IndicatorRegistryEntry,
} from 'lightweight-charts-indicators';
import type { Bar, IndicatorResult } from 'oakscriptjs';

/** The entry of a registry id (ids are kebab-case: 'rsi', 'bb', 'macd', 'atr-bands', ...) */
export function findIndicator(id: string): IndicatorRegistryEntry {
  const entry = indicatorRegistry.find((e) => e.id === id);
  if (!entry) throw new Error(`No indicator with id "${id}"`);
  return entry;
}

/** Entries whose id, name or short name contains the text, optionally of one group */
export function searchIndicators(text: string, group?: IndicatorRegistryEntry['group']): IndicatorRegistryEntry[] {
  const q = text.toLowerCase();
  return indicatorRegistry.filter(
    (e) => (!group || e.group === group) && [e.id, e.name, e.shortName].some((s) => s.toLowerCase().includes(q)),
  );
}

/** Calculate with the default inputs, some of them replaced (keys are the `id`s of `inputConfig`) */
export function runIndicator(
  entry: IndicatorRegistryEntry,
  bars: Bar[],
  inputs: Record<string, unknown> = {},
  chart?: ChartContext,
): IndicatorResult {
  return entry.calculate(bars, { ...entry.defaultInputs, ...inputs }, chart) as IndicatorResult;
}

/** The last value of each line plot, by plot title (`plotConfig` gives titles and ids; NaN = no value) */
export function lastValues(entry: IndicatorRegistryEntry, result: IndicatorResult): Record<string, number> {
  const out: Record<string, number> = {};
  for (const plot of entry.plotConfig) {
    const points = result.plots[plot.id] ?? [];
    const last = points[points.length - 1];
    out[plot.title || plot.id] = last?.value ?? NaN;
  }
  return out;
}

/** The value of one plot on the bar with this time (undefined when the plot has no point there) */
export function valueAt(result: IndicatorResult, plotId: string, time: number): number | undefined {
  return result.plots[plotId]?.find((p) => p.time === time)?.value;
}

/**
 * Indicators that read other symbols (`requiredSymbols` on the entry) get their bars from `chart.bars(symbol,
 * timeframe)`. Preload what the entry asks for; if bars are still missing `calculate` throws a
 * MissingSymbolDataError whose `requests` list them: load those and calculate again.
 */
export async function runWithOtherSymbols(
  entry: IndicatorRegistryEntry,
  bars: Bar[],
  inputs: Record<string, unknown>,
  load: (symbol: string, timeframe: string) => Promise<Bar[]>,
  chart: Omit<ChartContext, 'bars'> = {},
): Promise<IndicatorResult> {
  const cache = new Map<string, Bar[]>();
  const key = (symbol: string, timeframe: string) => `${symbol}|${timeframe}`;
  const context: ChartContext = { ...chart, bars: (symbol, timeframe) => cache.get(key(symbol, timeframe)) };
  const fetch = async (r: { symbol: string; timeframe: string }) => {
    cache.set(key(r.symbol, r.timeframe), await load(r.symbol, r.timeframe));
  };
  const merged = { ...entry.defaultInputs, ...inputs };

  for (const r of entry.requiredSymbols?.(merged, context) ?? []) await fetch(r);
  try {
    return entry.calculate(bars, merged, context) as IndicatorResult;
  } catch (err) {
    if (!(err instanceof MissingSymbolDataError)) throw err;
    await Promise.all(err.requests.map(fetch));
    return entry.calculate(bars, merged, context) as IndicatorResult;
  }
}
