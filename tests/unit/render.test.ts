/**
 * IndicatorRenderer ownership rules on a fake chart (no canvas): a render replaces what the instance drew before,
 * clear() removes everything it created (series and primitives), two instances do not touch each other, the pane of
 * the host is used, force_overlay output goes to pane 0.
 * Drawing defaults: what the draw functions use for a property the result omits (fake canvas context and document).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { IndicatorRenderer } from '../../src/render';
import { indicatorRegistry } from '../../src/index';
import {
  buildTable,
  drawBox,
  drawLabel,
  drawLine,
  DEFAULT_BOX_TEXT_COLOR,
  DEFAULT_LABEL_TEXT_COLOR,
  DEFAULT_TABLE_TEXT_COLOR,
  PINE_BLUE,
  type DrawEnv,
} from '../../src/render/primitives';

interface FakeSeries {
  pane: number;
  primitives: Set<unknown>;
  options: Record<string, unknown>;
  data: unknown[];
  setDataCalls: number;
  updateCalls: number;
  optionsCalls: number;
}

function fakeChart() {
  const series = new Set<FakeSeries>();
  const preserve = new Map<number, boolean>();
  let paneCount = 1;
  const make = (options: Record<string, unknown> = {}, pane = 0) => {
    const s: FakeSeries = { pane, primitives: new Set(), options: { ...options }, data: [], setDataCalls: 0, updateCalls: 0, optionsCalls: 0 };
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
      applyOptions: (o: Record<string, unknown>) => { s.optionsCalls++; Object.assign(s.options, o); },
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

    /** Data of the primitives that keep points (fills, line breaks...), series by series */
    const primitiveData = (r: IndicatorRenderer) =>
      r.series().map((s) => [...fake(s).primitives].map((p) => (p as { getData?: () => unknown }).getData?.() ?? null));
    const freshPrimitives = (id: string, b: Bar[]) => {
      const r = new IndicatorRenderer(fakeChart().chart, { paneIndex: 1 });
      r.render(entry(id), entry(id).calculate(b, {}), b);
      return primitiveData(r);
    };

    for (const id of ['rsi', 'bb', 'ichimoku', 'macd', 'supertrend', 'ma-ribbon']) {
      it(`${id}: points kept from the previous render give the data of a fresh render (series and fills)`, () => {
        const r = new IndicatorRenderer(fakeChart().chart, { paneIndex: 1 });
        const e = entry(id);
        r.render(e, e.calculate(bars, {}), bars);
        let b = bars;
        for (const step of [tick, tick, append, tick, append, append, tick]) {
          b = step(b);
          r.render(e, e.calculate(b, {}), b, { reuseSeries: true });
          expect(r.series().map((s) => fake(s).data)).toEqual(freshData(id, b));
          expect(primitiveData(r)).toEqual(freshPrimitives(id, b));
        }
      });
    }

    it('a result whose arrays change in place (the host applies the changes of a live update) is drawn as a fresh one', () => {
      const r = new IndicatorRenderer(fakeChart().chart, { paneIndex: 1 });
      const e = entry('bb');
      const held = e.calculate(bars, {}) as { plots: Record<string, Array<{ time: number; value: number }>> };
      r.render(e, held as never, bars);
      let b = bars;
      for (const step of [tick, append, tick]) {
        b = step(b);
        const next = e.calculate(b, {}) as typeof held;
        // the host keeps its arrays: the shared prefix stays, the tail is replaced
        for (const [k, list] of Object.entries(next.plots)) {
          const mine = held.plots[k];
          mine.length = Math.min(mine.length, list.length - 2);
          for (let i = mine.length; i < list.length; i++) mine.push(list[i]);
        }
        r.render(e, held as never, b, { reuseSeries: true });
        expect(r.series().map((s) => fake(s).data)).toEqual(freshData('bb', b));
        expect(primitiveData(r)).toEqual(freshPrimitives('bb', b));
      }
    });

    it('gives a reused series its options again only when they changed', () => {
      const f = fakeChart();
      const r = new IndicatorRenderer(f.chart, { paneIndex: 1 });
      const rsi = entry('rsi');
      r.render(rsi, rsi.calculate(bars, {}), bars);
      const s = fake(r.series()[0]);
      r.render(rsi, rsi.calculate(tick(bars), {}), tick(bars), { reuseSeries: true });
      expect(s.optionsCalls).toBe(0);
      r.render(rsi, rsi.calculate(tick(bars), {}), tick(bars), { reuseSeries: true, plots: { [rsi.plotConfig[0].id]: { color: '#123456' } } });
      expect(s.optionsCalls).toBe(1);
      expect(s.options.color).toBe('#123456');
    });

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

// ─── Drawing defaults ───────────────────────────────────────────────────────

interface DrawCall { op: string; style: string; text?: string; lineWidth?: number; dash?: number[]; font?: string; align?: string }

/** Canvas context that records the colour (and width, dash, font) of every fill, stroke and text */
function fakeContext() {
  const calls: DrawCall[] = [];
  let dash: number[] = [];
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '', lineJoin: '', lineCap: '',
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {}, rect() {}, clip() {}, roundRect() {},
    setLineDash(d: number[]) { dash = d; },
    measureText: (t: string) => ({ width: t.length * 6 }),
    fill() { calls.push({ op: 'fill', style: this.fillStyle }); },
    stroke() { calls.push({ op: 'stroke', style: this.strokeStyle, lineWidth: this.lineWidth, dash }); },
    fillRect() { calls.push({ op: 'fillRect', style: this.fillStyle }); },
    strokeRect() { calls.push({ op: 'strokeRect', style: this.strokeStyle, lineWidth: this.lineWidth, dash }); },
    fillText(text: string) { calls.push({ op: 'fillText', style: this.fillStyle, text, font: this.font, align: this.textAlign }); },
    strokeText(text: string) { calls.push({ op: 'strokeText', style: this.strokeStyle, text }); },
  };
  const env = {
    ctx, width: 800, height: 400,
    series: { priceToCoordinate: (p: number) => 400 - p },
    grid: { x: (_scale: unknown, time: number) => time, byTime: new Map() },
    timeScale: {},
  } as unknown as DrawEnv;
  return { env, calls };
}

interface FakeElement {
  style: Record<string, string>;
  children: FakeElement[];
  textContent?: string;
  insertRow(): FakeElement;
  insertCell(): FakeElement;
}

function fakeElement(): FakeElement {
  const el: FakeElement = {
    style: {},
    children: [],
    insertRow() { const row = fakeElement(); el.children.push(row); return row; },
    insertCell() { const cell = fakeElement(); el.children.push(cell); return cell; },
  };
  return el;
}

describe('drawing defaults (a property the result omits)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('has the text colours of the current language version', () => {
    expect(DEFAULT_LABEL_TEXT_COLOR).toBe('#FFFFFF');
    expect(DEFAULT_BOX_TEXT_COLOR).toBe('#FFFFFF');
    expect(DEFAULT_TABLE_TEXT_COLOR).toBe('#363A45');
    expect(PINE_BLUE).toBe('#2962FF');
  });

  it('label: blue label_down box, white centred text of normal size', () => {
    const { env, calls } = fakeContext();
    drawLabel(env, { time: 100, price: 50, text: 'L' });
    // box and tip
    expect(calls.filter((c) => c.op === 'fill').map((c) => c.style)).toEqual(['#2962FF', '#2962FF']);
    const text = calls.filter((c) => c.op === 'fillText');
    expect(text).toHaveLength(1);
    expect(text[0]).toMatchObject({ style: '#FFFFFF', text: 'L', font: '13px sans-serif', align: 'center' });
  });

  it('label: keeps a text colour that the result sets', () => {
    const { env, calls } = fakeContext();
    drawLabel(env, { time: 100, price: 50, text: 'L', textColor: '#363A45' });
    expect(calls.find((c) => c.op === 'fillText')!.style).toBe('#363A45');
  });

  it('box: blue background, blue solid border of width 1, white centred text', () => {
    const { env, calls } = fakeContext();
    drawBox(env, { time1: 100, price1: 300, time2: 300, price2: 100, text: 'B' });
    expect(calls.find((c) => c.op === 'fillRect')!.style).toBe('#2962FF');
    expect(calls.find((c) => c.op === 'strokeRect')).toMatchObject({ style: '#2962FF', lineWidth: 1, dash: [] });
    expect(calls.find((c) => c.op === 'fillText')).toMatchObject({ style: '#FFFFFF', text: 'B', align: 'center' });
  });

  it('box: keeps a text colour that the result sets, draws no text for a transparent one', () => {
    const set = fakeContext();
    drawBox(set.env, { time1: 100, price1: 300, time2: 300, price2: 100, text: 'B', textColor: '#363A45' });
    expect(set.calls.find((c) => c.op === 'fillText')!.style).toBe('#363A45');
    const na = fakeContext();
    drawBox(na.env, { time1: 100, price1: 300, time2: 300, price2: 100, text: 'B', textColor: 'transparent' });
    expect(na.calls.some((c) => c.op === 'fillText')).toBe(false);
  });

  it('line: blue, solid, width 1', () => {
    const { env, calls } = fakeContext();
    drawLine(env, { time1: 100, price1: 300, time2: 300, price2: 100 });
    expect(calls).toEqual([{ op: 'stroke', style: '#2962FF', lineWidth: 1, dash: [] }]);
  });

  it('table: no background, frame or border; cell text in #363A45, centred, 11 px', () => {
    vi.stubGlobal('document', { createElement: () => fakeElement() });
    const table = buildTable(
      { position: 'top_right', columns: 2, rows: 1, cells: [{ column: 0, row: 0, text: 'C' }, { column: 1, row: 0, text: 'D', textColor: '#AA5500' }] },
      { width: 800, height: 400 },
    ) as unknown as FakeElement;
    expect(table.style.background).toBeUndefined();
    expect(table.style.border).toBeUndefined();
    const [first, second] = table.children[0].children;
    expect(first.textContent).toBe('C');
    expect(first.style.color).toBe('#363A45');
    expect(first.style.textAlign).toBe('center');
    expect(first.style.verticalAlign).toBe('middle');
    expect(first.style.font).toBe('11px sans-serif');
    expect(first.style.background).toBeUndefined();
    expect(first.style.border).toBeUndefined();
    expect(second.style.color).toBe('#AA5500');
  });
});
