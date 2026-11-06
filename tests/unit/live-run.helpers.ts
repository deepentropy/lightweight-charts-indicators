/**
 * Live runs (#23): for every study with `createRun`, a run updated bar by bar (several prices of each forming bar, then
 * the next bar, and a jump of many new bars) equals a full `calculate()` on the same bars, every output compared with
 * Object.is, for every k of the updates. An edited history bar, fewer bars or other chart fields give a full run.
 * The studies are split in shards (live-run-<k>.test.ts) that run in parallel.
 */
import { describe, expect, it } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { indicatorRegistry } from '../../src/index';
import { makeBars } from './community-top100.helpers';
import config from './live-run.inputs.json';

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

/**
 * The update of the run and the full calculate on the same bars: equal results, or the same runtime error from both
 * (a study that stops on some bars, as the original). `from` is undefined after an error.
 */
function check(run: { update(b: Bar[]): any }, calc: (b: Bar[]) => unknown, bars: Bar[], k: number): number | undefined {
  let got: any;
  try {
    got = run.update(bars);
  } catch (e) {
    expect(() => calc(bars), `k=${k}: the full run does not throw`).toThrow(String((e as Error).message));
    return undefined;
  }
  const { from, ...result } = got;
  const d = diff(result, calc(bars));
  if (d) throw new Error(`k=${k}: ${d}`);
  return from;
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

/** Per study: inputs tried besides its defaults, and the studies tested on 15-minute bars (they read the time of day) */
const INPUTS: Record<string, Record<string, unknown>[]> = config.inputs;
const INTRADAY = new Set<string>(config.intraday);

/** Every k up to EARLY, a jump to HISTORY bars (above 200: Volumatic S/R Levels takes ATR(min(200, bar count))), then
 *  LIVE forming bars */
const EARLY = 40;
const HISTORY = 220;
const LIVE = 40;

/** The tests of shard `shard` of `shards` (the studies with createRun, in registry order) */
export function liveRunSuite(shard: number, shards: number): void {
 const all = indicatorRegistry.filter((e) => e.createRun);
 const entries = all.filter((_e, k) => k % shards === shard);
 describe(`live runs (createRun) ${shard + 1}/${shards}`, () => {
  if (shard === 0) {
    it('the studies with inputs to try have a live run', () => {
      const ids = new Set(all.map((e) => e.id));
      expect(Object.keys(INPUTS).filter((id) => !ids.has(id))).toEqual([]);
    });
  }

  for (const entry of entries) {
    for (const inputs of [{}, ...(INPUTS[entry.id] ?? [])]) {
      it(`${entry.id} ${JSON.stringify(inputs)}: every update equals a full run`, () => {
        const all = makeBars(HISTORY + LIVE, INTRADAY.has(entry.id) ? 900 : 86400) as unknown as Bar[];
        const run = entry.createRun!(inputs);
        const calc = (b: Bar[]) => entry.calculate(b, inputs);
        // a study that runs in full with these inputs (its fullRunReason) gives the same results, from = 0
        const resumable = run.fullRunReason === null;
        // the first bars one by one, then many new bars at once
        let prev = 0;
        for (const k of [...Array.from({ length: EARLY }, (_v, j) => j + 1), HISTORY]) {
          const from = check(run, calc, all.slice(0, k), k);
          // resumed from the forming bar of the previous update, or a full run
          if (from !== undefined && resumable) expect([0, Math.max(0, prev - 1)]).toContain(from);
          prev = k;
        }
        // the forming bars: three prices each, then the next bar
        for (let k = HISTORY; k < all.length; k++) {
          ticks(all[k]).forEach((tick, t) => {
            const from = check(run, calc, [...all.slice(0, k), tick], k);
            // a new price of the forming bar resumes; a new bar resumes too, or runs in full when the study's key
            // follows the bar count (e.g. a window of the last bars)
            if (from === undefined || !resumable) return;
            if (t > 0) expect(from).toBe(k);
            else expect([0, k - 1]).toContain(from);
          });
        }
        // an edited history bar: a full run, equal to calculate
        const edited = all.slice();
        edited[5] = { ...edited[5], close: edited[5].close * 1.01 };
        const from = check(run, calc, edited, -1);
        if (from !== undefined) expect(from).toBe(0);
        if (resumable) {
          // fewer bars: a full run
          const fewer = check(run, calc, edited.slice(0, 50), -2);
          if (fewer !== undefined) expect(fewer).toBe(0);
          // other chart fields: a full run
          let other: number | undefined;
          try {
            other = run.update(edited.slice(0, 51), { symbol: 'OTHER' }).from;
          } catch {
            other = undefined;
          }
          if (other !== undefined) expect(other).toBe(0);
        }
      });
    }
  }
 });
}
