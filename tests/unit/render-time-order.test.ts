/**
 * Points out of time order (#33): the chart library's release build takes them and throws "Value is null" at its next
 * paint, outside render(). The renderer gives the chart its points in ascending time order and tells the host.
 */
import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { IndicatorRenderer, type UnorderedData } from '../../src/render';
import { inTimeOrder } from '../../src/render/renderer';

type Point = { time: number; value?: number };

function fakeChart() {
  const series: Array<{ type: string; data: Point[]; updates: Point[] }> = [];
  const make = (type: string, pane: number) => {
    const s = { type, data: [] as Point[], updates: [] as Point[] };
    series.push(s);
    return {
      setData: (d: Point[]) => { s.data = [...d]; },
      update: (p: Point) => {
        s.updates.push(p);
        const i = s.data.findIndex((d) => d.time === p.time);
        if (i >= 0) s.data[i] = p;
        else s.data.push(p);
      },
      applyOptions: () => {},
      options: () => ({}),
      attachPrimitive: () => {},
      detachPrimitive: () => {},
      getPane: () => ({ paneIndex: () => pane }),
      seriesType: () => type,
    };
  };
  const pane = (i: number) => ({
    getSeries: () => [],
    preserveEmptyPane: () => false,
    setPreserveEmptyPane: () => {},
    paneIndex: () => i,
    detachPrimitive: () => {},
  });
  const chart = {
    addSeries: (def: { type?: string }, _o: unknown, p = 0) => make(def?.type ?? 'Line', p),
    addCustomSeries: (_v: unknown, _o: unknown, p = 0) => make('Custom', p),
    removeSeries: () => {},
    panes: () => [pane(0), pane(1)],
    removePane: () => {},
    timeScale: () => ({}),
    priceScale: () => ({ width: () => 0 }),
  };
  return { chart: chart as never, series };
}

const T = 1_600_000_000;
const D = 86_400;
const bars: Bar[] = Array.from({ length: 6 }, (_, i) => ({ time: T + i * D, open: 1, high: 2, low: 0, close: 1, volume: 10 }));
const times = (pts: Point[]) => pts.map((p) => (p.time - T) / D);
const plot = (days: number[]) => days.map((d, i) => ({ time: T + d * D, value: i + 1 }));

describe('inTimeOrder', () => {
  it('gives the same array when the times ascend', () => {
    const d = plot([0, 1, 2]);
    expect(inTimeOrder(d)).toBe(d);
  });

  it('keeps the later point of a time and leaves out the points earlier than the one before them', () => {
    const told: number[][] = [];
    const out = inTimeOrder(plot([0, 1, 1, 3, 2, 4]), (...a) => told.push(a));
    expect(times(out as Point[])).toEqual([0, 1, 3, 4]);
    expect((out as Point[])[1].value).toBe(3);
    expect(told).toEqual([[2, T + D, T + D, 2]]);
  });
});

describe('a render with points out of time order', () => {
  for (const style of ['columns', 'histogram', 'line'] as const) {
    it(`gives the chart ascending times and tells the host (${style})`, () => {
      const f = fakeChart();
      const told: UnorderedData[] = [];
      const r = new IndicatorRenderer(f.chart, { paneIndex: 1, onUnorderedData: (u) => told.push(u) });
      const entry = { overlay: false, plotConfig: [{ id: 'vol', title: 'Volume', style }] } as never;
      r.render(entry, { plots: { vol: plot([0, 1, 1, 3, 2, 4]) } } as never, bars);
      const drawn = f.series.find((s) => s.data.length)!;
      const t = times(drawn.data);
      expect(t).toEqual([...new Set(t)].sort((a, b) => a - b));
      expect(told).toHaveLength(1);
      expect(told[0]).toMatchObject({ output: 'vol', points: 6, dropped: 2, index: 2 });
    });
  }

  it('updates a live render with ascending times only', () => {
    const f = fakeChart();
    const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
    const entry = { overlay: false, plotConfig: [{ id: 'vol', title: 'Volume', style: 'columns' }] } as never;
    r.render(entry, { plots: { vol: plot([0, 1, 2, 3]) } } as never, bars);
    // the newest point given again at its time and once at an older one
    r.render(entry, { plots: { vol: plot([0, 1, 2, 3, 3, 1]) } } as never, bars, { reuseSeries: true });
    const s = f.series[0];
    expect(times(s.data)).toEqual([0, 1, 2, 3]);
    expect(s.data[3].value).toBe(5);
  });

  it('draws a plot whose points have no value (na) without leaving them to the chart as values', () => {
    const f = fakeChart();
    const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
    const entry = { overlay: false, plotConfig: [{ id: 'h', title: 'H', style: 'columns' }] } as never;
    r.render(entry, { plots: { h: [{ time: T, value: 1 }, { time: T + D, value: null }, { time: T + 2 * D, value: NaN }, { time: T + 3 * D, value: 2 }] } } as never, bars);
    expect(f.series[0].data.every((p) => typeof p.value === 'number' && !Number.isNaN(p.value))).toBe(true);
  });
});
