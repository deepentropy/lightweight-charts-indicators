/**
 * Packed series (#29): a packed list reads and writes as the array of points it stands for, and every registry entry
 * with a live run gives the same results in packed mode as without it (full run, forming-bar updates, new bars).
 */
import { afterEach, describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { indicatorRegistry } from '../../src/index';
import { isPackedSeries, packedColumns, packedFromColumns, packedSeries, setPackedSeries } from '../../src/packed-series';

function generateBars(count: number): Bar[] {
  const bars: Bar[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    price = Math.max(10, price + (Math.sin(i * 0.1) + Math.cos(i * 0.07)) * 2 + Math.sin(i * 1.7) * 3);
    const high = price + Math.abs(Math.sin(i * 0.3)) * 3 + 0.5;
    const low = price - Math.abs(Math.cos(i * 0.3)) * 3 - 0.5;
    bars.push({ time: 1700000000 + i * 60, open: price + (Math.sin(i * 0.5) > 0 ? 1 : -1), high, low, close: price, volume: 1000 + i });
  }
  return bars;
}

/** A result with its packed lists as arrays (JSON: NaN and undefined compare as null; the fields' order counts). */
const plain = (r: unknown) => JSON.stringify(r, (_k, v) => (isPackedSeries(v) ? [...(v as unknown[])] : v));

afterEach(() => setPackedSeries(false));

describe('packed series', () => {
  it('reads, grows, is cut back and sliced as the array of points', () => {
    const src = Array.from({ length: 50 }, (_, i) => ({ time: i, value: i % 5 ? i : NaN, ...(i % 3 === 0 && { color: '#fff' }) }));
    const p = packedSeries(src);
    expect(Array.isArray(p)).toBe(true);
    expect([...p]).toEqual(src);
    expect(p[3]).toEqual(src[3]);
    const s = p.slice(10, 20);
    expect(isPackedSeries(s)).toBe(true);
    expect([...s]).toEqual(src.slice(10, 20));
    expect([...p.slice(-3)]).toEqual(src.slice(-3));
    p.length = 48;
    p.push({ time: 100, value: 1 });
    p[52] = { time: 101, value: 2 };
    expect(p.length).toBe(53);
    expect(p[48]).toEqual({ time: 100, value: 1 });
    // an index past the end leaves holes, as in an array
    expect(p[50]).toBeUndefined();
    expect(50 in p).toBe(false);
    const whole = packedSeries(src);
    const back = packedFromColumns(structuredClone(packedColumns(whole)!));
    expect(JSON.stringify([...back])).toBe(JSON.stringify(src));
  });

  it('holds numbers, and turns plain when a value of another kind comes', () => {
    const n = packedSeries<number>([]);
    n[0] = 1.5;
    n[1] = NaN;
    expect([...n]).toEqual([1.5, NaN]);
    n[2] = 'x' as unknown as number;
    expect([...n]).toEqual([1.5, NaN, 'x']);
    const points = packedSeries([{ time: 1, value: 2 }]);
    points[1] = null as never;
    expect([...points]).toEqual([{ time: 1, value: 2 }, null]);
    // a bar colour ({ id, time, color }) is not a plot point: kept as written, its fields in order
    const colours = packedSeries([{ id: 'b', time: 3, color: '#f00' }]);
    expect(JSON.stringify(colours[0])).toBe(JSON.stringify({ id: 'b', time: 3, color: '#f00' }));
  });

  it('every live run gives the same results in packed mode', () => {
    const differs: string[] = [];
    let runs = 0;
    for (const e of indicatorRegistry) {
      const make = (e as { createRun?: (i: unknown, c?: unknown) => { update(b: Bar[], c?: unknown): unknown } }).createRun;
      if (!make) continue;
      const inputs = (e as { defaultInputs?: Record<string, unknown> }).defaultInputs ?? {};
      const steps: Bar[][] = [];
      const bars = generateBars(300);
      steps.push(bars.slice());
      for (let k = 0; k < 4; k++) {
        const last = bars[bars.length - 1]!;
        if (k % 2) bars.push({ ...last, time: (last.time as number) + 60, open: last.close, close: last.close + 0.5 });
        else bars[bars.length - 1] = { ...last, close: last.close + 0.25, high: last.high + 0.25 };
        steps.push(bars.slice());
      }
      const outputs = (packed: boolean): string[] | null => {
        setPackedSeries(packed);
        try {
          const run = make(inputs, {});
          setPackedSeries(false);
          return steps.map((b) => plain(run.update(b, {})));
        } catch {
          return null;
        } finally {
          setPackedSeries(false);
        }
      };
      const a = outputs(false);
      if (a === null) continue;
      runs++;
      const b = outputs(true);
      if (b === null || b.some((x, i) => x !== a[i])) differs.push(e.id);
    }
    expect(runs).toBeGreaterThan(1000);
    expect(differs).toEqual([]);
  });
});
