/**
 * Live runs (#23): for every study with `createRun`, a run created on the history and updated up to bar k (several
 * prices of each forming bar, then the next bar) equals a full `calculate()` on bars 0..k, every output compared with
 * Object.is, for every k. An edited history bar, fewer bars or other chart fields give a full run.
 */
import { describe, expect, it } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { indicatorRegistry } from '../../src/index';
import { makeBars } from './community-top100.helpers';

/** The first difference of two results (numbers with Object.is: NaN equal, -0 not 0; undefined fields ignored) */
function diff(a: unknown, b: unknown, path = ''): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return `${path}: ${String(a)} vs ${String(b)}`;
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`;
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra).filter((k) => ra[k] !== undefined);
  const kb = Object.keys(rb).filter((k) => rb[k] !== undefined);
  if (ka.length !== kb.length) return `${path}: keys ${ka.join(',')} vs ${kb.join(',')}`;
  for (const k of ka) {
    const d = diff(ra[k], rb[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}

/** The forming bar before its close: the open, a midpoint, then its final values */
function ticks(bar: Bar): Bar[] {
  const mid = (bar.open + bar.close) / 2;
  return [
    { ...bar, high: bar.open, low: bar.open, close: bar.open },
    { ...bar, high: Math.max(bar.open, mid), low: Math.min(bar.open, mid), close: mid },
    bar,
  ];
}

/** Inputs tried for each study besides its defaults */
const INPUTS: Record<string, Record<string, unknown>[]> = {
  rsi: [{ calculateDivergence: true }, { calculateDivergence: true, maType: 'SMA + Bollinger Bands', src: 'hl2' }, { maType: 'VWMA' }],
  macd: [{ oscMaType: 'SMA', signalMaType: 'SMA', src: 'hlc3' }],
  bb: [{ maType: 'VWMA', src: 'ohlc4' }, { maType: 'WMA' }, { maType: 'EMA' }, { maType: 'SMMA (RMA)' }],
  stoch: [{ periodK: 5, smoothK: 1 }],
  supertrend: [{ factor: 2, atrPeriod: 7 }],
  'sessions-on-chart': [{ bgColor: true, res: 'W', Sydney: true }],
  'ml-momentum-index': [{ k: 20, momentumWindow: 10 }],
  'volumatic-sr-levels': [{ length: 5, barsThreshold: 50, upperThreshold: 50 }],
  'wavelet-filter-with-adaptive-upsampling': [{ showlr: true, upsampleType: 'Simple Upsample' }, { showlr: true, upsampleType: 'Advanced Upsample', npast: 3 }],
  'adaptive-ml-trailing-stop': [{ knnEnabled: false, showGradient: false }, { knnK: 3, knnLookback: 50, knnFeatureLength: 3 }],
};

/** Intraday bars for the studies that read the time of day */
const STEP: Record<string, number> = { 'sessions-on-chart': 900 };

const entries = indicatorRegistry.filter((e) => e.createRun);
/** Above 200 bars: Volumatic S/R Levels takes ATR(min(200, bar count)), a full run below 200 bars */
const HISTORY = 220;
const LIVE = 60;

describe('live runs (createRun)', () => {
  it('the pilot studies have a live run', () => {
    expect(entries.map((e) => e.id).sort()).toEqual(Object.keys(INPUTS).sort());
  });

  for (const entry of entries) {
    for (const inputs of [{}, ...(INPUTS[entry.id] ?? [])]) {
      it(`${entry.id} ${JSON.stringify(inputs)}: every update equals a full run`, () => {
        const all = makeBars(HISTORY + LIVE, STEP[entry.id] ?? 86400) as unknown as Bar[];
        const run = entry.createRun!(inputs);
        // the history: a full run on every k first (every k of the history equal too)
        for (let k = 1; k <= HISTORY; k++) {
          const bars = all.slice(0, k);
          const { from, ...got } = run.update(bars);
          // resumed from the forming bar of the previous update (k - 2), or a full run
          expect([0, Math.max(0, k - 2)]).toContain(from);
          const d = diff(got, entry.calculate(bars, inputs));
          if (d) throw new Error(`k=${k}: ${d}`);
        }
        // the forming bars: three prices each, then the next bar
        for (let k = HISTORY; k < all.length; k++) {
          for (const tick of ticks(all[k])) {
            const bars = [...all.slice(0, k), tick];
            const { from, ...got } = run.update(bars);
            expect(from).toBeGreaterThan(0);
            const d = diff(got, entry.calculate(bars, inputs));
            if (d) throw new Error(`k=${k}: ${d}`);
          }
        }
        // an edited history bar: a full run, equal to calculate
        const edited = all.slice();
        edited[5] = { ...edited[5], close: edited[5].close * 1.01 };
        const { from, ...got } = run.update(edited);
        expect(from).toBe(0);
        expect(diff(got, entry.calculate(edited, inputs))).toBeNull();
        // fewer bars: a full run
        expect(run.update(edited.slice(0, 50)).from).toBe(0);
        // other chart fields: a full run
        expect(run.update(edited.slice(0, 51), { symbol: 'OTHER' }).from).toBe(0);
        expect(run.fullRunReason).toBeNull();
      });
    }
  }
});
