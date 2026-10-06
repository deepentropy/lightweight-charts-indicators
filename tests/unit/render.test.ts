/**
 * IndicatorRenderer ownership rules on a fake chart (no canvas): a render replaces what the instance drew before,
 * clear() removes everything it created (series and primitives), two instances do not touch each other, the pane of
 * the host is used, force_overlay output goes to pane 0.
 */
import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { IndicatorRenderer } from '../../src/render';
import { indicatorRegistry } from '../../src/index';

interface FakeSeries {
  pane: number;
  primitives: Set<unknown>;
  options: Record<string, unknown>;
  data: unknown[];
  setDataCalls: number;
  updateCalls: number;
}

function fakeChart() {
  const series = new Set<FakeSeries>();
  const preserve = new Map<number, boolean>();
  let paneCount = 1;
  const make = (options: Record<string, unknown> = {}, pane = 0) => {
    const s: FakeSeries = { pane, primitives: new Set(), options: { ...options }, data: [], setDataCalls: 0, updateCalls: 0 };
    paneCount = Math.max(paneCount, pane + 1);
    series.add(s);
    return {
      _fake: s,
      setData: (d: unknown[]) => { s.data = [...d]; s.setDataCalls++; },
      // the library's update: the point of that time is replaced, a newer one appended
      update: (p: { time: number }, historical = false) => {
        s.updateCalls++;
        const i = s.data.findIndex((d) => (d as { time: number }).time === p.time);
        const last = s.data.length - 1;
        if (i >= 0 && (i === last || historical)) s.data[i] = p;
        else if (i < 0 && (last < 0 || (s.data[last] as { time: number }).time < p.time)) s.data.push(p);
        else throw new Error('update of an older point');
      },
      applyOptions: (o: Record<string, unknown>) => Object.assign(s.options, o),
      options: () => s.options,
      attachPrimitive: (p: unknown) => { s.primitives.add(p); },
      detachPrimitive: (p: unknown) => { s.primitives.delete(p); },
      getPane: () => ({ paneIndex: () => s.pane }),
      seriesType: () => 'Line',
      data: () => s.data,
    };
  };
  const pane = (i: number) => ({
    getSeries: () => [...series].filter((s) => s.pane === i),
    preserveEmptyPane: () => preserve.get(i) ?? false,
    setPreserveEmptyPane: (v: boolean) => preserve.set(i, v),
    paneIndex: () => i,
    getHTMLElement: () => null,
  });
  const chart = {
    addSeries: (_def: unknown, options: Record<string, unknown>, paneIndex = 0) => make(options, paneIndex),
    addCustomSeries: (_view: unknown, options: Record<string, unknown>, paneIndex = 0) => make(options, paneIndex),
    removeSeries: (s: { _fake: FakeSeries }) => { series.delete(s._fake); },
    panes: () => Array.from({ length: paneCount }, (_, i) => pane(i)),
    removePane: (i: number) => { if (i === paneCount - 1) paneCount--; },
    timeScale: () => ({}),
    priceScale: () => ({ width: () => 0 }),
  };
  return { chart: chart as never, series, primitives: () => [...series].reduce((n, s) => n + s.primitives.size, 0), panes: () => paneCount };
}

const bars: Bar[] = Array.from({ length: 300 }, (_, i) => {
  const c = 100 + Math.sin(i / 9) * 10 + i * 0.05;
  return { time: 1_600_000_000 + i * 86_400, open: c - 0.5, high: c + 2, low: c - 2, close: c, volume: 1000 + i };
});

const entry = (id: string) => indicatorRegistry.find((e) => e.id === id)!;

describe('IndicatorRenderer', () => {
  it('replaces its drawing on render and removes everything on clear', () => {
    const f = fakeChart();
    const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
    const rsi = entry('rsi');
    r.render(rsi, rsi.calculate(bars, {}), bars);
    const count = f.series.size;
    const prims = f.primitives();
    expect(count).toBeGreaterThan(0);
    expect(r.series().length).toBe(count);
    expect([...f.series].every((s) => s.pane === 1)).toBe(true);

    r.render(rsi, rsi.calculate(bars, { length: 7 }), bars);
    expect(f.series.size).toBe(count);
    expect(f.primitives()).toBe(prims);

    r.clear();
    expect(f.series.size).toBe(0);
    expect(f.primitives()).toBe(0);
    expect(r.series()).toEqual([]);
    expect(f.panes()).toBe(1);
  });

  it('keeps the series of other instances', () => {
    const f = fakeChart();
    const bb = new IndicatorRenderer(f.chart);
    const rsi = new IndicatorRenderer(f.chart, { paneIndex: 1 });
    bb.render(entry('bb'), entry('bb').calculate(bars, {}), bars);
    rsi.render(entry('rsi'), entry('rsi').calculate(bars, {}), bars);
    const bbSeries = bb.series().length;
    expect(bbSeries).toBeGreaterThan(0);
    expect([...f.series].filter((s) => s.pane === 0).length).toBe(bbSeries);
    rsi.clear();
    expect(f.series.size).toBe(bbSeries);
  });

  it('puts the plot series first, applies plot overrides and keeps autoscale off on request', () => {
    const f = fakeChart();
    const r = new IndicatorRenderer(f.chart);
    const bb = entry('bb');
    r.render(bb, bb.calculate(bars, {}), bars, {
      autoscale: false,
      lastValueVisible: true,
      plots: { [bb.plotConfig[0].id]: { color: '#123456', lineWidth: 3 } },
    });
    const first = (r.series()[0] as unknown as { _fake: FakeSeries })._fake;
    expect(first.options.color).toBe('#123456');
    expect(first.options.lineWidth).toBe(3);
    expect(first.options.lastValueVisible).toBe(true);
    expect([...f.series].every((s) => typeof s.options.autoscaleInfoProvider === 'function')).toBe(true);
  });

  it('hides a plot with visible: false', () => {
    const f = fakeChart();
    const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
    const rsi = entry('rsi');
    r.render(rsi, rsi.calculate(bars, {}), bars);
    const all = r.series().length;
    r.render(rsi, rsi.calculate(bars, {}), bars, { plots: { [rsi.plotConfig[0].id]: { visible: false } } });
    expect(r.series().length).toBe(all - 1);
  });

  describe('reuseSeries', () => {
    const fake = (s: unknown) => (s as { _fake: FakeSeries })._fake;
    /** Data of every series of a fresh render (the reference for a reused one) */
    const freshData = (id: string, b: Bar[], pane = 1) => {
      const f = fakeChart();
      const r = new IndicatorRenderer(f.chart, { paneIndex: pane });
      r.render(entry(id), entry(id).calculate(b, {}), b);
      return r.series().map((s) => fake(s).data);
    };
    const tick = (b: Bar[]): Bar[] => {
      const last = b[b.length - 1];
      return [...b.slice(0, -1), { ...last, close: last.close + 1.5, high: last.high + 1.5 }];
    };
    const append = (b: Bar[]): Bar[] => {
      const last = b[b.length - 1];
      return [...b, { ...last, time: last.time + 86_400, open: last.close, close: last.close - 2, low: last.low - 2 }];
    };

    for (const id of ['rsi', 'bb', 'macd', 'ma-ribbon']) {
      it(`${id}: a live update keeps the series and updates the newest points`, () => {
        const f = fakeChart();
        const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
        const e = entry(id);
        r.render(e, e.calculate(bars, {}), bars);
        const before = r.series();
        const setData = before.map((s) => fake(s).setDataCalls);
        for (const next of [tick(bars), append(tick(bars))]) {
          r.render(e, e.calculate(next, {}), next, { reuseSeries: true });
          expect(r.series()).toEqual(before);
          expect(f.series.size).toBe(before.length);
          expect(r.series().map((s) => fake(s).data)).toEqual(freshData(id, next));
        }
        // the per-bar series took updates, no new data set (hlines: 2 points whose end moves with a new bar)
        r.series().forEach((s, i) => {
          if (fake(s).data.length < 100) return;
          expect(fake(s).setDataCalls).toBe(setData[i]);
          expect(fake(s).updateCalls).toBeGreaterThan(0);
        });
      });
    }

    it('replaces the data when more than the newest points changed', () => {
      const f = fakeChart();
      const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
      const rsi = entry('rsi');
      r.render(rsi, rsi.calculate(bars, {}), bars);
      const s = fake(r.series()[0]);
      const calls = s.setDataCalls;
      r.render(rsi, rsi.calculate(bars, { length: 7 }), bars, { reuseSeries: true });
      expect(s.setDataCalls).toBe(calls + 1);
      const ref = new IndicatorRenderer(fakeChart().chart, { paneIndex: 1 });
      ref.render(rsi, rsi.calculate(bars, { length: 7 }), bars);
      expect(s.data).toEqual(fake(ref.series()[0]).data);
    });

    it('creates and removes series when the drawing changed', () => {
      const f = fakeChart();
      const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
      const rsi = entry('rsi');
      r.render(rsi, rsi.calculate(bars, {}), bars);
      const all = r.series().length;
      r.render(rsi, rsi.calculate(bars, {}), bars, { reuseSeries: true, plots: { [rsi.plotConfig[0].id]: { visible: false } } });
      expect(r.series().length).toBe(all - 1);
      expect(f.series.size).toBe(all - 1);
      r.render(rsi, rsi.calculate(bars, {}), bars, { reuseSeries: true });
      expect(f.series.size).toBe(all);
      r.clear();
      expect(f.series.size).toBe(0);
    });
  });
});
