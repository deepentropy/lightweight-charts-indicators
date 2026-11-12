/**
 * Applies the Style-settings declarations of style-outputs.ts to the registry entries: line plots the reference does
 * not list get `editable: false`, hlines and fills their titles, and the entry its shapes, background / bar colours,
 * candle colours and drawing kinds. `calculate` then stamps the id of its declaration on the background / bar colours
 * and the fills between plots of its result, so a host can change or hide each of them.
 */
import type { IndicatorRun } from './live-run';
import type { ArrowConfig, BarColorConfig, CandleConfig, FillConfig, HLineConfig, PlotConfig } from 'oakscriptjs';
import { STYLE_OUTPUTS, type StudyDrawingKind, type StyleOutputs, type StyleShapeConfig } from './style-outputs';

/** A plotcandle() / plotbar() output of an entry: id of its candles in the result's `plotCandles`, title, colours */
export type PlotCandleDecl = { id: string; title: string } & Partial<Omit<CandleConfig, 'id' | 'title' | 'kind'>>;

interface StyleTarget {
  id: string;
  /** Live run of the study (live-run.ts): its updates get the same ids as the results of calculate */
  createRun?: (...args: any[]) => IndicatorRun;
  plotConfig: PlotConfig[];
  hlineConfig?: HLineConfig[];
  fillConfig?: FillConfig[];
  plotCandleConfig?: PlotCandleDecl[];
  shapeConfig?: StyleShapeConfig[];
  barColorConfig?: BarColorConfig[];
  arrowConfig?: ArrowConfig[];
  styleOrder?: StyleOutputs['styleOrder'];
  markerDrawing?: StudyDrawingKind;
  drawingKinds?: StudyDrawingKind[];
  /** Style declarations of the hlines of the result (built-ins without hlineConfig): `hline<k>` for the k-th */
  resultHlineConfig?: HLineConfig[];
  calculate: (...args: any[]) => any;
}

/** Colour as [r, g, b, a]; null when not parsed */
function rgba(c: unknown): number[] | null {
  if (typeof c !== 'string') return null;
  const s = c.trim();
  if (s === 'transparent') return [0, 0, 0, 0];
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(s);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), m[2] ? parseInt(m[2], 16) / 255 : 1];
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m) return [parseInt(m[1] + m[1], 16), parseInt(m[2] + m[2], 16), parseInt(m[3] + m[3], 16), 1];
  m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (m) { const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] ?? 1]; }
  return null;
}

/** Same colour (by value) */
export function sameColor(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const x = rgba(a), y = rgba(b);
  return !!x && !!y && x.every((v, i) => Math.abs(v - y[i]) < (i === 3 ? 0.01 : 0.6));
}

/** The result with the declaration ids on its background / bar colours and its fills between plots. */
function stampIds(result: any, decl: StyleOutputs): any {
  if (!result || typeof result !== 'object') return result;
  if (typeof result.then === 'function') return result.then((r: any) => stampIds(r, decl));
  let out = result;
  const copy = () => (out === result ? (out = { ...result }) : out);
  for (const [key, kind] of [['bgColors', 'bgcolor'], ['barColors', 'barcolor']] as const) {
    const list = result[key];
    const own = (decl.barColors ?? []).filter((b) => b.kind === kind);
    if (!Array.isArray(list) || !own.length || list.every((x: any) => x.id)) continue;
    // one declaration of the kind: every entry is its; several: the one whose palette has the colour
    const of = (x: any) => (own.length === 1 ? own[0] : own.find((d) => d.palette?.some((c) => sameColor(c, x.color))));
    copy()[key] = list.map((x: any) => {
      if (x.id) return x;
      const d = of(x);
      return d ? { ...x, id: d.id } : x;
    });
  }
  // markers without an id: the shape output whose rule fits
  if (decl.markerMatch?.length && Array.isArray(result.markers) && result.markers.some((m: any) => !m.id)) {
    copy().markers = result.markers.map((m: any) => {
      if (m.id) return m;
      const rule = decl.markerMatch!.find((r) =>
        (r.shape === undefined || r.shape === m.shape) &&
        (r.position === undefined || r.position === m.position) &&
        (r.text === undefined || r.text === (m.text ?? '')) &&
        (r.char === undefined || r.char === m.char) &&
        (r.colors === undefined || r.colors.some((c) => sameColor(c, m.color))));
      return rule ? { ...m, id: rule.id } : m;
    });
  }
  // hlines of the result: the id of their declaration (k-th = hline<k>)
  if (decl.resultHlines?.length && Array.isArray(result.hlines) && result.hlines.some((x: any) => !x.id)) {
    copy().hlines = result.hlines.map((x: any, k: number) => (x.id ? x : { ...x, id: `hline${k}` }));
  }
  const plotFills = (decl.fills ?? []).filter((f) => !String(f.plot1).startsWith('hline'));
  if (Array.isArray(result.fills) && plotFills.length && result.fills.some((f: any) => !f.id)) {
    const used = new Set<string>();
    copy().fills = result.fills.map((f: any) => {
      if (f.id) return f;
      const same = (d: FillConfig) => !used.has(d.id) && d.plot1 === f.plot1 && d.plot2 === f.plot2;
      const d = plotFills.find((x) => same(x) && (x.title ?? '') === (f.options?.title ?? '')) ?? plotFills.find(same);
      if (!d) return f;
      used.add(d.id);
      return { ...f, id: d.id };
    });
  }
  return out;
}

export function withStyleOutputs<T extends StyleTarget>(entry: T): T {
  const decl = STYLE_OUTPUTS[entry.id];
  if (!decl) return entry;
  const hidden = new Set(decl.hiddenPlots ?? []);
  const e: T = { ...entry };
  const palettes = decl.plotPalettes ?? {};
  if (hidden.size || Object.keys(palettes).length) {
    e.plotConfig = entry.plotConfig.map((p) => ({
      ...p,
      ...(hidden.has(p.id) ? { editable: false } : {}),
      ...(palettes[p.id] ? { palette: palettes[p.id] } : {}),
    }));
  }
  if (decl.hlines && entry.hlineConfig) {
    e.hlineConfig = entry.hlineConfig.map((h) => (decl.hlines![h.id] ? { ...h, ...decl.hlines![h.id] } : h));
  }
  if (decl.fills) {
    const own = new Map((entry.fillConfig ?? []).map((f) => [f.id, f]));
    const merged = (entry.fillConfig ?? []).map((f) => {
      const d = decl.fills!.find((x) => x.id === f.id);
      return d ? { ...f, ...d } : f;
    });
    for (const d of decl.fills) if (!own.has(d.id)) merged.push(d);
    e.fillConfig = merged;
  }
  if (decl.shapes) e.shapeConfig = decl.shapes;
  if (decl.markerDrawing) e.markerDrawing = decl.markerDrawing;
  if (decl.barColors) e.barColorConfig = decl.barColors;
  if (decl.arrows && !entry.arrowConfig) e.arrowConfig = decl.arrows;
  if (decl.styleOrder) e.styleOrder = decl.styleOrder;
  if (decl.candles && entry.plotCandleConfig) {
    e.plotCandleConfig = entry.plotCandleConfig.map((c) => (decl.candles![c.id] ? { ...c, ...decl.candles![c.id], id: c.id } as PlotCandleDecl : c));
  } else if (decl.candles) {
    // a built-in without candle declarations: the ones of its result's plotCandles / plotBars
    e.plotCandleConfig = Object.entries(decl.candles).map(([id, c]) => ({ title: '', ...c, id }) as PlotCandleDecl);
  }
  if (decl.drawings) e.drawingKinds = decl.drawings;
  if (decl.resultHlines) e.resultHlineConfig = decl.resultHlines;
  return withStampedIds(e);
}

/**
 * `calculate` / `createRun` of the study `id` stamping the ids of its Style declarations on their results (the
 * registry's entries do; the loader gives the same functions without the registry).
 */
export function withStampedIds<T extends { id: string; calculate: (...args: any[]) => any; createRun?: (...args: any[]) => IndicatorRun }>(entry: T): T {
  const decl = STYLE_OUTPUTS[entry.id];
  if (!decl || !(decl.barColors || decl.fills || decl.markerMatch || decl.resultHlines)) return entry;
  const e: T = { ...entry };
  const calculate = entry.calculate;
  e.calculate = (...args: any[]) => stampIds(calculate(...args), decl);
  const createRun = entry.createRun;
  if (createRun) {
    e.createRun = (...args: any[]) => {
      const run = createRun(...args);
      return {
        update: (...u: Parameters<IndicatorRun['update']>) => stampIds(run.update(...u), decl),
        get fullRunReason() {
          return run.fullRunReason;
        },
      };
    };
  }
  return e;
}
