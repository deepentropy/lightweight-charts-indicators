/**
 * The calculation of one study without the whole library (`lightweight-charts-indicators/loader`): the code of the
 * study it is asked for is loaded, the others' is not. The library's entry carries every study (about 20 MB of
 * script): a host that calculates studies in workers holds it in each worker; with the loader, the code of the
 * studies they calculate.
 *
 * `loadIndicator(id)` gives the `calculate` and `createRun` of the registry entry `id`, the same functions (the ids of
 * its Style declarations stamped on their results as the registry's are). Packed mode (#29) of the runs it makes is
 * this entry's `setPackedSeries`: the loader carries its own copy of the run code.
 */
import type { Bar } from 'oakscriptjs';
import type { IndicatorRun } from './live-run';
import { INDICATOR_MODULES } from './indicator-modules';
import { withStampedIds } from './style-apply';

export { setPackedSeries } from './packed-series';

export interface LoadedIndicator {
  id: string;
  calculate: (bars: Bar[], inputs?: any, chart?: any) => any;
  createRun?: (inputs?: any, chart?: any) => IndicatorRun;
}

type StudyModule = { calculate: LoadedIndicator['calculate']; createRun?: LoadedIndicator['createRun'] };

const loaded = new Map<string, Promise<LoadedIndicator | null>>();

async function load(id: string): Promise<LoadedIndicator | null> {
  const own = INDICATOR_MODULES[id];
  let m: StudyModule | undefined;
  if (own) m = (await own()) as StudyModule;
  else {
    // The candlestick patterns: one module makes them all.
    const port = await import('./candlestick-port/adapter');
    m = id === port.candlestickPortAllPatterns.id ? port.candlestickPortAllPatterns.indicator : port.candlestickPortIndicators[id];
  }
  if (!m || typeof m.calculate !== 'function') return null;
  return withStampedIds({ id, calculate: m.calculate, ...(m.createRun ? { createRun: m.createRun } : {}) });
}

/** The calculation of the registry entry `id`, null for an id the registry does not have. */
export function loadIndicator(id: string): Promise<LoadedIndicator | null> {
  let p = loaded.get(id);
  if (!p) loaded.set(id, (p = load(id)));
  return p;
}
