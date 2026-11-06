/**
 * What a live render (reuseSeries) asks of the chart (#27): its drawings ask for one light update of the chart, not
 * the full one (the panes laid out again, then a second paint); its native markers plugin and its tables are kept and
 * set again only when they changed. Fake chart, markers plugin and document.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Bar } from 'oakscriptjs';

const plugins: Array<{ markers: unknown[]; sets: number; detached: boolean }> = [];
vi.mock('lightweight-charts', async (original) => ({
  ...(await original<typeof import('lightweight-charts')>()),
  createSeriesMarkers: (_series: unknown, markers: unknown[]) => {
    const p = { markers, sets: 0, detached: false };
    plugins.push(p);
    return { setMarkers: (m: unknown[]) => { p.markers = m; p.sets++; }, detach: () => { p.detached = true; } };
  },
}));

const { IndicatorRenderer } = await import('../../src/render');
const { indicatorRegistry } = await import('../../src/index');

function fakeChart() {
  const counts = { full: 0, light: 0 };
  const make = (pane = 0) => {
    // eslint-disable-next-line prefer-const
    let api: Record<string, unknown>;
    let data: unknown[] = [];
    return (api = {
      setData: (d: unknown[]) => { data = [...d]; },
      update: (p: { time: number }) => {
        const i = data.findIndex((d) => (d as { time: number }).time === p.time);
        if (i >= 0) data[i] = p;
        else data.push(p);
      },
      applyOptions: () => {},
      options: () => ({}),
      // as the library: requestUpdate is a full update of the chart, attaching or detaching a primitive too
      attachPrimitive: (p: { attached?: (param: unknown) => void }) => { counts.full++; p.attached?.({ series: api, chart: {}, requestUpdate: () => { counts.full++; } }); },
      detachPrimitive: () => { counts.full++; },
      getPane: () => ({ paneIndex: () => pane }),
      seriesType: () => 'Line',
      data: () => data,
    });
  };
  const rect = () => ({ left: 0, top: 0, width: 800, height: 400 });
  const host = { style: { position: 'relative' }, appendChild: () => {}, getBoundingClientRect: rect };
  const pane = (i: number) => ({
    getSeries: () => [],
    preserveEmptyPane: () => false,
    setPreserveEmptyPane: () => {},
    paneIndex: () => i,
    getHTMLElement: () => ({ getBoundingClientRect: rect }),
    // as the library: detaching a pane primitive is a light update
    detachPrimitive: () => { counts.light++; },
  });
  const chart = {
    addSeries: (_def: unknown, _options: unknown, paneIndex = 0) => make(paneIndex),
    addCustomSeries: (_view: unknown, _options: unknown, paneIndex = 0) => make(paneIndex),
    removeSeries: () => {},
    panes: () => [pane(0), pane(1)],
    removePane: () => {},
    timeScale: () => ({}),
    priceScale: () => ({ width: () => 0 }),
    chartElement: () => host,
  };
  return { chart: chart as never, counts, main: make() as never };
}

const bars: Bar[] = Array.from({ length: 300 }, (_, i) => {
  const c = 100 + Math.sin(i / 9) * 10 + i * 0.05;
  return { time: 1_600_000_000 + i * 86_400, open: c - 0.5, high: c + 2, low: c - 2, close: c, volume: 1000 + i };
});
const tick = (b: Bar[]): Bar[] => {
  const last = b[b.length - 1];
  return [...b.slice(0, -1), { ...last, close: last.close + 0.3, high: last.high + 0.3 }];
};
const entry = (id: string) => indicatorRegistry.find((e) => e.id === id)!;

const frames: Array<() => void> = [];
const observers: Array<{ observed: number; disconnected: boolean }> = [];
const tableElements: Array<{ removed: boolean; className?: string }> = [];
const overlays = () => tableElements.filter((el) => el.className === 'chart-table-overlay');

/** An element: what the table code reads or calls (insertRow, insertCell, ...) gives another one */
const node = <T extends object>(own: T): T => new Proxy(Object.assign({ style: {}, offsetWidth: 0, offsetHeight: 0 }, own), {
  get: (t, k) => (k in t ? t[k as keyof typeof t] : () => node({})),
}) as T;

beforeEach(() => {
  plugins.length = 0;
  frames.length = 0;
  observers.length = 0;
  tableElements.length = 0;
  vi.stubGlobal('requestAnimationFrame', (f: () => void) => frames.push(f));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.stubGlobal('getComputedStyle', () => ({ position: 'relative' }));
  vi.stubGlobal('ResizeObserver', class {
    private o = { observed: 0, disconnected: false };
    constructor() { observers.push(this.o); }
    observe() { this.o.observed++; }
    disconnect() { this.o.disconnected = true; }
  });
  vi.stubGlobal('document', {
    createElement: () => {
      const el = node({ removed: false, remove: () => { el.removed = true; } });
      tableElements.push(el);
      return el;
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('a live render', () => {
  for (const id of ['cm-pivot-points-filtered', 'fibonacci-extension-retracement-pivot-points', 'bb']) {
    it(`asks for one light update and no full one (${id})`, () => {
      const f = fakeChart();
      const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
      const e = entry(id);
      r.render(e, e.calculate(bars, {}), bars);
      let b = bars;
      for (let k = 0; k < 3; k++) {
        b = tick(b);
        const before = { ...f.counts };
        r.render(e, e.calculate(b, {}), b, { reuseSeries: true });
        expect(f.counts.full - before.full).toBe(0);
        expect(f.counts.light - before.light).toBe(1);
      }
    });
  }

  it('keeps its native markers plugin and sets its markers only when they changed', () => {
    const f = fakeChart();
    const r = new IndicatorRenderer(f.chart, { mainSeries: f.main });
    const e = entry('williams-fractals');
    const result = (b: Bar[]) => {
      const out = e.calculate(b, {}) as { markers: Array<{ shape: string }> };
      // shapes the chart's own markers draw
      out.markers = out.markers.map((m) => ({ ...m, shape: 'circle' }));
      return out as never;
    };
    r.render(e, result(bars), bars);
    expect(plugins.length).toBe(1);
    // the same markers
    r.render(e, result(bars), bars, { reuseSeries: true });
    expect(plugins.length).toBe(1);
    expect(plugins[0]).toMatchObject({ sets: 0, detached: false });
    const next = tick(bars);
    // a marker more: set on the same plugin
    const more = result(next) as unknown as { markers: Array<{ time: number }> };
    more.markers = [...more.markers, { ...more.markers[0], time: next[next.length - 1].time }];
    r.render(e, more as never, next, { reuseSeries: true });
    expect(plugins.length).toBe(1);
    expect(plugins[0].sets).toBe(1);
    // a render that is not live replaces it
    r.render(e, result(next), next);
    expect(plugins.length).toBe(2);
    expect(plugins[0].detached).toBe(true);
  });

  it('keeps its tables and lays them out again only when they changed', () => {
    const f = fakeChart();
    const r = new IndicatorRenderer(f.chart);
    const e = entry('fibonacci-extension-retracement-pivot-points');
    const result = e.calculate(bars, {}) as { tables: unknown[] };
    expect(result.tables.length).toBeGreaterThan(0);
    r.render(e, result as never, bars);
    expect(frames.length).toBe(1);
    frames.splice(0).forEach((f) => f());
    const elements = overlays().length;
    const next = tick(bars);
    r.render(e, e.calculate(next, {}), next, { reuseSeries: true });
    expect(overlays().length).toBe(elements);
    expect(overlays().some((el) => el.removed)).toBe(false);
    expect(observers.length).toBe(1);
    expect(frames.length).toBe(0);
    // another table: laid out again
    const changed = e.calculate(next, {}) as { tables: Array<Record<string, unknown>> };
    changed.tables = [{ ...changed.tables[0], bgcolor: '#123456' }];
    r.render(e, changed as never, next, { reuseSeries: true });
    expect(frames.length).toBe(1);
    r.clear();
    expect(overlays().every((el) => el.removed)).toBe(true);
    expect(observers[0].disconnected).toBe(true);
  });
});
