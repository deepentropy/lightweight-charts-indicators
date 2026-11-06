/**
 * Live runs of studies whose state the generic live-run tests do not reach (#24): Pivot Points Standard on an
 * intraday chart with the host's daily bars (the forming daily bar changes on every tick, new accessor functions on
 * each update as a host gives them). Every update equals a full run (Object.is on every output); a new price of the
 * forming bar is calculated from that bar only. The full run of each check is another study on the same drawing
 * registry between two updates of the run. Fibonacci Extension / Retracement / Pivot Points with labels at timenow
 * (the clock of the chart context: the generic tests run without one).
 */
import { describe, expect, it } from 'vitest';
import type { Bar } from 'oakscriptjs';
import * as pivots from '../../src/standard/pivot-points-standard';
import * as fibs from '../../src/community/fibonacci-extension-retracement-pivot-points';
import type { ChartContext } from '../../src/chart-context';
import { makeBars } from './community-top100.helpers';

/** The first difference of two results (numbers with Object.is) */
function diff(a: unknown, b: unknown, path = ''): string | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return `${path}: ${String(a)} vs ${String(b)}`;
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

/** Daily bars (UTC days) of minute bars: the last one is the forming day */
function daily(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  for (const b of bars) {
    const day = Math.floor(b.time / 86400) * 86400;
    const last = out[out.length - 1];
    if (last && last.time === day) {
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
    } else {
      out.push({ ...b, time: day });
    }
  }
  return out;
}

/** The chart context of a host for these bars: new accessor functions on each update */
function chartOf(bars: Bar[]): ChartContext {
  const host = daily(bars);
  return {
    timeframe: '1', tickerid: 'TEST:X', lastBarConfirmed: false, mintick: 0.01,
    bars: (symbol: string, tf: string) => (symbol === 'TEST:X' && tf === '1D' ? host : undefined),
    symbolInfo: () => ({ timezone: 'Etc/UTC', session: '24x7' }),
  } as ChartContext;
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

describe('live runs with drawings and host bars (#24)', () => {
  const day = 1440;
  // minute bars from the start of a UTC day, two full days and the start of the third
  const all = (makeBars(3 * day, 60) as unknown as Bar[]).map((b, i) => ({ ...b, time: 1262304000 + i * 60 }));

  for (const inputs of [{}, { pivotType: 'Woodie' as const, positionLabels: 'Right' as const }, { pivotType: 'DM' as const, showLabels: false }]) {
    it(`Pivot Points Standard ${JSON.stringify(inputs)} with the daily bars of the host: every update equals a full run`, () => {
      const run = pivots.createRun(inputs, chartOf(all.slice(0, 1)));
      const check = (bars: Bar[], k: number): number => {
        const chart = chartOf(bars);
        const { from, ...got } = run.update(bars, chart);
        const d = diff(got, pivots.calculate(bars, inputs, chart));
        if (d) throw new Error(`k=${k}: ${d}`);
        return from;
      };
      expect(check(all.slice(0, 2 * day - 30), -1)).toBe(0);
      // the forming bars across the start of the third day: three prices each, then the next bar
      for (let k = 2 * day - 30; k < 2 * day + 30; k++) {
        ticks(all[k]).forEach((tick, t) => {
          const from = check([...all.slice(0, k), tick], k);
          // a new price of the forming bar resumes from that bar; a new bar runs in full (its key has the bar count)
          expect(from).toBe(t > 0 ? k : 0);
        });
      }
      // a new open of the forming bar: a full run
      expect(check([...all.slice(0, 2 * day + 30), { ...all[2 * day + 30], open: all[2 * day + 30].open + 1 }], -2)).toBe(0);
    });
  }

  it('Pivot Points Standard: a change of the host bars before the newest one runs in full', () => {
    const bars = all.slice(0, 2 * day + 10);
    const run = pivots.createRun({}, chartOf(bars));
    run.update(bars, chartOf(bars));
    expect(run.update(bars.slice(), chartOf(bars)).from).toBe(bars.length - 1);
    const edited = chartOf(bars);
    const host = edited.bars!('TEST:X', '1D')!;
    host[0] = { ...host[0], high: host[0].high + 5 };
    const { from, ...got } = run.update(bars.slice(), edited);
    expect(from).toBe(0);
    expect(diff(got, pivots.calculate(bars, {}, edited))).toBeNull();
  });

  it('Fibonacci Extension / Retracement / Pivot Points with labels at timenow: every update equals a full run', () => {
    const inputs = { levelsPvtP: 'Last Bar' as const, levelsPvt: 'Levels + Prices' as const, zigZag: true };
    let now = 1262304000000 + 3 * day * 60000;
    const run = fibs.createRun(inputs);
    const check = (bars: Bar[], k: number): number => {
      // the clock moves on each update
      const chart: ChartContext = { timeframe: '1', now: (now += 1000) };
      const { from, ...got } = run.update(bars, chart);
      const d = diff(got, fibs.calculate(bars, inputs, chart));
      if (d) throw new Error(`k=${k}: ${d}`);
      return from;
    };
    expect(check(all.slice(0, day - 20), -1)).toBe(0);
    for (let k = day - 20; k < day + 20; k++) {
      ticks(all[k]).forEach((tick, t) => {
        expect(check([...all.slice(0, k), tick], k)).toBe(t > 0 ? k : k - 1);
      });
    }
    // many new bars at once
    expect(check(all.slice(0, 2 * day), -2)).toBe(day + 19);
  });
});
