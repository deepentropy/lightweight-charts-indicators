/**
 * Double Zig Zag with HHLL
 *
 * Two zig zags with their own period. A bar is a pivot high when its high is the highest of the period, a pivot low
 * when its low is the lowest. The direction turns up on a pivot high (without a pivot low on the same bar) and down
 * on a pivot low. A change of direction adds a point to the zig zag; a more extreme pivot in the same direction
 * moves the last point. Each zig zag keeps its last 5 points.
 *
 * Drawings (when a zig zag has at least 3 points and its last point changed): a line from the last point to the
 * point before (the line of a moved point is replaced), and a label at the last point: HH / LH on a high, LL / HL on
 * a low, compared with the point two steps back. At most 50 lines and 50 labels are kept (the oldest are removed).
 *
 * Reference: "Double Zig Zag with HHLL" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DoubleZigZagWithHhllInputs {
  prd1: number;
  prd2: number;
  showzz: 'Show Zig Zag 1' | 'Show Zig Zag 2' | 'Show Both' | 'Show None';
  showhhll: 'Show HHLL 1' | 'Show HHLL 2' | 'Show Both' | 'Show None';
  upcol1: string;
  dncol1: string;
  upcol2: string;
  dncol2: string;
  txtcol: string;
  zz1style: 'Dashed' | 'Dotted';
  zz1width: number;
  zz2width: number;
}

export const defaultInputs: DoubleZigZagWithHhllInputs = {
  prd1: 8,
  prd2: 20,
  showzz: 'Show Both',
  showhhll: 'Show Both',
  upcol1: '#00E676',
  dncol1: '#FF5252',
  upcol2: '#2196F3',
  dncol2: '#9C27B0',
  txtcol: '#363A45',
  zz1style: 'Dashed',
  zz1width: 2,
  zz2width: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'prd1', type: 'int', title: 'ZigZag Period 1', defval: 8, min: 2, max: 20 },
  { id: 'prd2', type: 'int', title: 'ZigZag Period 2', defval: 20, min: 2, max: 50 },
  { id: 'showzz', type: 'string', title: 'Show Zig Zags', defval: 'Show Both',
    options: ['Show Zig Zag 1', 'Show Zig Zag 2', 'Show Both', 'Show None'] },
  { id: 'showhhll', type: 'string', title: 'Show HHLL', defval: 'Show Both',
    options: ['Show HHLL 1', 'Show HHLL 2', 'Show Both', 'Show None'] },
  { id: 'upcol1', type: 'color', title: 'Zig Zag 1 Up Color', defval: '#00E676' },
  { id: 'dncol1', type: 'color', title: 'Zig Zag 1 Down Color', defval: '#FF5252' },
  { id: 'upcol2', type: 'color', title: 'Zig Zag 2 Up Color', defval: '#2196F3' },
  { id: 'dncol2', type: 'color', title: 'Zig Zag 2 Down Color', defval: '#9C27B0' },
  { id: 'txtcol', type: 'color', title: 'Text Color', defval: '#363A45' },
  { id: 'zz1style', type: 'string', title: 'Zig Zag 1 Line Style', defval: 'Dashed', options: ['Dashed', 'Dotted'] },
  { id: 'zz1width', type: 'int', title: 'Zig zag 1 Line Width', defval: 2, min: 1, max: 4 },
  { id: 'zz2width', type: 'int', title: 'Zig zag 2 Line Width', defval: 3, min: 1, max: 6 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Double Zig Zag with HHLL',
  shortTitle: 'Double Zig Zag with HHLL',
  overlay: true,
};

/** Default max_lines_count / max_labels_count of study() */
const MAX_OBJECTS = 50;
/** A [5, 2] matrix: 5 points as value, bar index */
const MAX_ARRAY_SIZE = 10;

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
/** A float read as a bool: na and 0 are false */
const truthy = (x: number) => !isNaN(x) && x !== 0;

interface Ln { x1: number; y1: number; x2: number; y2: number; color: string; width: number; style: 'solid' | 'dashed' | 'dotted'; deleted: boolean }
interface Lb { x: number; y: number; text: string; color: string; style: 'label_down' | 'label_up'; deleted: boolean }

type Result = IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[] };

/** The state of one zig zag */
interface ZzState {
  dir: number;
  prevDir: number;
  /** [5, 2] matrix as a flat array: value, bar index of each point (newest first) */
  zz: number[];
  zzline: Ln | null;
  zzlabel: Lb | null;
}

interface ZzVars {
  z: ZzState[];
  /** Live drawings in creation order */
  lines: Ln[];
  labels: Lb[];
}

interface ZzRun extends BarRunState<ZzVars> {
  hb: WindowExtreme[];
  lb: WindowExtreme[];
}

/** One zig zag's settings */
interface ZzConfig { prd: number; upcol: string; dncol: string; showLine: boolean; showLabel: boolean; width: number; style: Ln['style'] }

function study(inputs: Partial<DoubleZigZagWithHhllInputs>): BarStudy<ZzRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const one = cfg.showzz === 'Show Zig Zag 1' || cfg.showzz === 'Show Both';
  const two = cfg.showzz === 'Show Zig Zag 2' || cfg.showzz === 'Show Both';
  const hhll1 = cfg.showhhll === 'Show HHLL 1' || cfg.showhhll === 'Show Both';
  const hhll2 = cfg.showhhll === 'Show HHLL 2' || cfg.showhhll === 'Show Both';
  const configs: ZzConfig[] = [
    { prd: cfg.prd1, upcol: cfg.upcol1, dncol: cfg.dncol1, showLine: one, showLabel: hhll1, width: cfg.zz1width,
      style: cfg.zz1style === 'Dashed' ? 'dashed' : 'dotted' },
    { prd: cfg.prd2, upcol: cfg.upcol2, dncol: cfg.dncol2, showLine: two, showLabel: hhll2, width: cfg.zz2width, style: 'solid' },
  ];

  // Live drawings in creation order: when a creation brings the count above max + 5, the oldest are deleted until
  // max remain. An object held by a `var` variable of the script (zzline / zzlabel of a zig zag) is never deleted by
  // this limit, but it counts.
  const limit = <T extends { deleted: boolean }>(list: T[], v: ZzVars) => {
    if (list.length <= MAX_OBJECTS + 5) return;
    const held = (o: object) => v.z.some((z) => z.zzline === o || z.zzlabel === o);
    for (let k = 0; k < list.length && list.length > MAX_OBJECTS; ) {
      if (held(list[k])) k++;
      else list.splice(k, 1)[0].deleted = true;
    }
  };
  const remove = <T extends { deleted: boolean }>(list: T[], o: T | null) => {
    if (o && !o.deleted) {
      o.deleted = true;
      list.splice(list.indexOf(o), 1);
    }
  };
  const add = (zz: number[], value: number, bindex: number) => {
    zz.unshift(bindex);
    zz.unshift(value);
    if (zz.length > MAX_ARRAY_SIZE) {
      zz.pop();
      zz.pop();
    }
  };

  /** One zig zag on bar i */
  const zigzag = (s: ZzRun, g: number, i: number, bars: Bar[]) => {
    const c = configs[g]!;
    const v = s.vars;
    const st = v.z[g]!;
    const zz = st.zz;
    // ta.highestbars(prd) == 0 / ta.lowestbars(prd) == 0: the bar's value is the extreme of the window (the newest of
    // equal values), na before bar prd - 1
    const hi = bars[i].high;
    const lo = bars[i].low;
    const hh = s.hb[g]!.step(hi);
    const ll = s.lb[g]!.step(lo);
    const ph = Number.isFinite(hi) && hh === hi ? hi : NaN;
    const pl = Number.isFinite(lo) && ll === lo ? lo : NaN;
    st.dir = truthy(ph) && isNaN(pl) ? 1 : truthy(pl) && isNaN(ph) ? -1 : st.dir;
    const dir = st.dir;
    const old = zz.slice();

    // change(dir): na on the first bar
    const dirChanged = dir - st.prevDir;
    st.prevDir = dir;
    if (truthy(ph) || truthy(pl)) {
      const value = dir === 1 ? ph : pl;
      if (truthy(dirChanged)) {
        add(zz, value, i);
      } else if (zz.length === 0) {
        add(zz, value, i);
      } else if ((dir === 1 && gt(value, zz[0])) || (dir === -1 && lt(value, zz[0]))) {
        zz[0] = value;
        zz[1] = i;
      }
    }

    if (zz.length >= 6) {
      if (ne(zz[0], old[0]) || ne(zz[1], old[1])) {
        if (eq(zz[2], old[2]) && eq(zz[3], old[3])) {
          remove(v.lines, st.zzline);
          remove(v.labels, st.zzlabel);
        }
        if (c.showLine) {
          const l: Ln = {
            x1: Math.round(zz[1]), y1: zz[0], x2: Math.round(zz[3]), y2: zz[2], color: dir === 1 ? c.upcol : c.dncol,
            width: c.width, style: c.style, deleted: false,
          };
          v.lines.push(l);
          st.zzline = l;
          limit(v.lines, v);
        }
        if (c.showLabel) {
          const text = dir === 1 ? (gt(zz[0], zz[4]) ? 'HH' : 'LH') : lt(zz[0], zz[4]) ? 'LL' : 'HL';
          const labelcol = dir === 1 ? (gt(zz[0], zz[4]) ? c.upcol : c.dncol) : lt(zz[0], zz[4]) ? c.dncol : c.upcol;
          const l: Lb = {
            x: Math.round(zz[1]), y: zz[0], text, color: labelcol, style: dir === 1 ? 'label_down' : 'label_up',
            deleted: false,
          };
          v.labels.push(l);
          st.zzlabel = l;
          limit(v.labels, v);
        }
      }
    }
  };

  return {
    init() {
      const zState = (): ZzState => ({ dir: 0, prevDir: NaN, zz: [], zzline: null, zzlabel: null });
      const s: ZzRun = {
        hb: configs.map((c) => new WindowExtreme(false, c.prd)),
        lb: configs.map((c) => new WindowExtreme(true, c.prd)),
        steps: [],
        vars: { z: [zState(), zState()], lines: [], labels: [] },
        lists: [], series: [],
      };
      s.steps = [...s.hb, ...s.lb];
      return s;
    },
    bar(s, i, bars) {
      zigzag(s, 0, i, bars);
      zigzag(s, 1, i, bars);
    },
    // the drawings are changed in place (moved, deleted): copied with the zig zags pointing at the copies
    copyVars(v) {
      const lineMap = new Map<Ln, Ln>();
      const labelMap = new Map<Lb, Lb>();
      const lines = v.lines.map((l) => { const c = { ...l }; lineMap.set(l, c); return c; });
      const labels = v.labels.map((l) => { const c = { ...l }; labelMap.set(l, c); return c; });
      const z = v.z.map((st) => ({
        ...st,
        zz: st.zz.slice(),
        zzline: st.zzline ? lineMap.get(st.zzline) ?? { ...st.zzline } : null,
        zzlabel: st.zzlabel ? labelMap.get(st.zzlabel) ?? { ...st.zzlabel } : null,
      }));
      return { z, lines, labels };
    },
    result(s, bars) {
      const { lines, labels } = s.vars;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        lines: lines.map((l) => ({
          time1: bars[l.x1].time, price1: l.y1, time2: bars[l.x2].time, price2: l.y2, color: l.color, width: l.width,
          ...(l.style !== 'solid' ? { style: l.style } : {}),
        })),
        labels: labels.map((l) => ({
          time: bars[l.x].time, price: l.y, text: l.text, color: l.color, textColor: cfg.txtcol, style: l.style,
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DoubleZigZagWithHhllInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<DoubleZigZagWithHhllInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const DoubleZigZagWithHhll = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
