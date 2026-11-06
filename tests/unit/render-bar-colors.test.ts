/**
 * The OHLC by time of the main series read by the bar-colour primitive (#24): after live updates (the forming bar
 * replaced, bars appended, bars popped) it equals a rebuild from the whole series, and it reads the newest rows only.
 * Fake series and time scale with the lightweight-charts rules: `data()` gives new objects on every call, the logical
 * index is the index of the time on the time scale, which has the times of other series too.
 */
import { describe, expect, it } from 'vitest';
import { seriesOhlc } from '../../src/render/primitives';

type Row = { time: number; open?: number; high?: number; low?: number; close?: number };

function fakeChart(otherTimes: number[]) {
  let rows: Row[] = [];
  const handlers: Array<(scope: 'full' | 'update') => void> = [];
  const calls = { data: 0, dataByIndex: 0 };
  /** The time scale: the times of the main series and of the other series, in order */
  const points = () => [...new Set([...rows.map((r) => r.time), ...otherTimes])].sort((a, b) => a - b);
  const fire = (scope: 'full' | 'update') => handlers.forEach((h) => h(scope));
  const series = {
    data: () => {
      calls.data++;
      return rows.map((r) => ({ ...r }));
    },
    dataByIndex: (index: number, direction: number) => {
      calls.dataByIndex++;
      const p = points();
      let found: Row | null = null;
      for (const r of rows) {
        const at = p.indexOf(r.time);
        if (at === index || (direction === -1 && at < index)) found = r;
      }
      return found ? { ...found } : null;
    },
    subscribeDataChanged: (h: (scope: 'full' | 'update') => void) => handlers.push(h),
    setData: (data: Row[]) => {
      rows = data.map((r) => ({ ...r }));
      fire('full');
    },
    update: (row: Row) => {
      const last = rows[rows.length - 1];
      if (last && last.time === row.time) rows[rows.length - 1] = { ...row };
      else rows.push({ ...row });
      fire('update');
    },
    pop: (count: number) => {
      rows.splice(rows.length - count, count);
      fire('update');
    },
  };
  const timeScale = {
    timeToIndex: (time: number) => {
      const k = points().indexOf(time);
      return k < 0 ? null : k;
    },
  };
  return { series, timeScale, calls };
}

/** The map of a rebuild from the whole series, as plain values */
function rebuilt(rows: Row[]): Array<[number, number[]]> {
  return rows
    .filter((r) => r.open != null && r.high != null && r.low != null && r.close != null)
    .map((r) => [r.time, [r.open!, r.high!, r.low!, r.close!]]);
}

const values = (m: Map<number, { open: number; high: number; low: number; close: number }>) =>
  [...m].map(([t, b]) => [t, [b.open, b.high, b.low, b.close]] as [number, number[]]).sort((a, b) => a[0] - b[0]);

describe('bar colours: OHLC of the main series (#24)', () => {
  for (const start of [5, 11, 23, 47, 101]) {
    it(`after live updates equals a rebuild from the whole series, reading the newest rows only (seed ${start})`, () => {
      let seed = start;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      const bar = (time: number): Row => {
        const open = 100 + rnd() * 10;
        // a row without its OHLC now and then (left out of the map)
        if (rnd() < 0.05) return { time };
        return { time, open, high: open + rnd(), low: open - rnd(), close: open + rnd() - 0.5 };
      };
      // other series: points between the bars and after the last one
      const { series, timeScale, calls } = fakeChart([1005, 1995, 3000, 3010, 3020]);
      const s = series as never;
      const ts = timeScale as never;
      const history = Array.from({ length: 200 }, (_, i) => bar(1000 + i * 10));
      series.setData(history);
      expect(values(seriesOhlc(s, ts))).toEqual(rebuilt(series.data()));
      let next = 1000 + 200 * 10;
      for (let step = 0; step < 300; step++) {
        const r = rnd();
        if (r < 0.6) series.update(bar(next - 10)); // a tick of the forming bar
        else if (r < 0.85) series.update(bar((next += 10) - 10)); // a new bar
        else if (r < 0.9) {
          for (let k = 0; k < 3; k++) series.update(bar((next += 10) - 10)); // several new bars before a paint
        } else {
          const count = 1 + Math.floor(rnd() * 3);
          series.pop(count);
          next -= 10 * count;
        }
        // a paint after some of the updates
        if (rnd() < 0.7) {
          const before = { ...calls };
          const got = values(seriesOhlc(s, ts));
          // the rows read: the newest ones only, never the whole series
          expect(calls.data - before.data).toBe(0);
          expect(calls.dataByIndex - before.dataByIndex).toBeLessThan(20);
          expect(got, `step ${step}`).toEqual(rebuilt(series.data()));
        }
      }
      // setData: rebuilt
      series.setData(history.slice(0, 50));
      expect(values(seriesOhlc(s, ts))).toEqual(rebuilt(series.data()));
    });
  }

  it('a series emptied by pops, then filled again', () => {
    const { series, timeScale } = fakeChart([]);
    const s = series as never;
    const ts = timeScale as never;
    series.setData([{ time: 1, open: 1, high: 2, low: 0, close: 1 }, { time: 2, open: 1, high: 3, low: 0, close: 2 }]);
    expect(values(seriesOhlc(s, ts))).toEqual(rebuilt(series.data()));
    series.pop(2);
    expect(values(seriesOhlc(s, ts))).toEqual([]);
    series.update({ time: 5, open: 4, high: 5, low: 3, close: 4 });
    series.update({ time: 6, open: 4, high: 6, low: 3, close: 5 });
    expect(values(seriesOhlc(s, ts))).toEqual(rebuilt(series.data()));
  });
});
