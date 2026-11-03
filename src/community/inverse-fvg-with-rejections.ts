/**
 * Inverse FVG with Rejections [TFO]
 *
 * Fair value gaps (FVG) on the chart timeframe or on a higher timeframe. On each new bar of the timeframe the
 * script keeps the open / high / low / close / time of the bar before (at most 300 bars). With 3 completed bars:
 * a bullish gap when the middle bar closes above its open and the high of the first bar is below the low of the
 * third bar (the middle bar spans the gap), a bearish gap the other way. The gap must be larger than
 * "Displacement" / 10 times the average range of the last 21 bars (sum / 20, as the original), and the first bar must
 * be inside the session (New York time). A gap is a box from the middle bar with a dashed centre line.
 * A close of the timeframe bar beyond the far side of a gap turns it into an inverse FVG (a copy in the inverse
 * colour); a close beyond the other side of an inverse FVG deletes it. At most "Display Limit" boxes of each kind
 * are kept (one is dropped per new bar). While the script holds gaps of both kinds, a swing high / low pivot
 * ("Rejection Strength" bars on each side) inside a gap is a rejection; the triangles show the rejections of the bar
 * before (regular gaps, inverse gaps, both).
 *
 * On a higher timeframe the detection block runs on every chart bar after a new timeframe bar until a gap is
 * found, as in the original (the rejections are checked on those bars).
 *
 * Reference: "Inverse FVG with Rejections [TFO]" by tradeforopp
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tradeforopp
 */

import {
  color, callsite, time as pineTime, timeframe as pineTimeframe, box, line, resetDrawings, setDrawingBar,
  type Bar, type Box, type Line, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { BoxData, LineDrawingData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { chartTimeframe, higherTimeframeBars, periodChanges } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface InverseFvgWithRejectionsInputs {
  show_rfvg: boolean;
  show_ifvg: boolean;
  extend_right: boolean;
  rfvg_color: string;
  ifvg_color: string;
  /** Timeframe of the gaps ("" = chart) */
  tf: string;
  disp_x: number;
  disp_limit: number;
  /** Gaps are only kept when their first bar is in this session (New York time) */
  session: string;
  /** Bars on each side of a rejection pivot */
  ps: number;
  show_rrj: boolean;
  show_irj: boolean;
  show_brj: boolean;
  rrj_color: string;
  irj_color: string;
  brj_color: string;
}

export const defaultInputs: InverseFvgWithRejectionsInputs = {
  show_rfvg: true,
  show_ifvg: true,
  extend_right: true,
  rfvg_color: 'rgba(41, 98, 255, 0.4)',
  ifvg_color: 'rgba(242, 54, 69, 0.4)',
  tf: '',
  disp_x: 3,
  disp_limit: 10,
  session: '0000-0000',
  ps: 1,
  show_rrj: false,
  show_irj: false,
  show_brj: true,
  rrj_color: '#2962ff',
  irj_color: '#f23645',
  brj_color: '#363A45',
};

export const inputConfig: InputConfig[] = [
  { id: 'show_rfvg', type: 'bool', title: 'Show Regular FVG', defval: true, inline: 'RFVG', group: 'Settings' },
  { id: 'show_ifvg', type: 'bool', title: 'Show Inverse FVG', defval: true, inline: 'IFVG', group: 'Settings' },
  { id: 'extend_right', type: 'bool', title: 'Extend Boxes', defval: true, group: 'Settings' },
  { id: 'rfvg_color', type: 'color', title: '', defval: 'rgba(41, 98, 255, 0.4)', inline: 'RFVG', group: 'Settings' },
  { id: 'ifvg_color', type: 'color', title: '', defval: 'rgba(242, 54, 69, 0.4)', inline: 'IFVG', group: 'Settings' },
  { id: 'tf', type: 'timeframe', title: 'Timeframe', defval: '', group: 'Settings' },
  {
    id: 'disp_x', type: 'int', title: 'Displacement', defval: 3, min: 1, max: 10, group: 'Settings',
    tooltip: 'Larger Displacement will require larger FVGs',
  },
  {
    id: 'disp_limit', type: 'int', title: 'Display Limit', defval: 10, min: 1, max: 50, group: 'Settings',
    tooltip: 'The maximum amount of FVGs and IFVGs to display',
  },
  {
    id: 'session', type: 'session', title: 'Session', defval: '0000-0000', group: 'Settings',
    tooltip: 'FVGs will only be saved if they are created within this time period',
  },
  {
    id: 'ps', type: 'int', title: 'Rejection Strength', defval: 1, group: 'Rejections',
    tooltip: 'Larger values will require larger fractals/swing pivots to justify as rejections',
  },
  {
    id: 'show_rrj', type: 'bool', title: 'Regular FVG', defval: false, inline: 'RRJ', group: 'Rejections',
    tooltip: 'Show rejections made within regular FVGs',
  },
  {
    id: 'show_irj', type: 'bool', title: 'Inverse FVG', defval: false, inline: 'IRJ', group: 'Rejections',
    tooltip: 'Show rejections made within inverse FVGs',
  },
  {
    id: 'show_brj', type: 'bool', title: 'Regular + Inverse FVG', defval: true, inline: 'BRJ', group: 'Rejections',
    tooltip: 'Show rejections made within both regular and inverse FVGs',
  },
  { id: 'rrj_color', type: 'color', title: '', defval: '#2962ff', inline: 'RRJ', group: 'Rejections' },
  { id: 'irj_color', type: 'color', title: '', defval: '#f23645', inline: 'IRJ', group: 'Rejections' },
  { id: 'brj_color', type: 'color', title: '', defval: '#363A45', inline: 'BRJ', group: 'Rejections' },
];

export const plotConfig: PlotConfig[] = [];

/** The six plotshape() calls: bear (triangle down above the bar) and bull (triangle up below) of each kind */
export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Shapes', style: 'triangledown', location: 'abovebar', color: '#2962ff', size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'Shapes', style: 'triangleup', location: 'belowbar', color: '#2962ff', size: 'small' },
  { id: 'shape2', kind: 'shape', title: 'Shapes', style: 'triangledown', location: 'abovebar', color: '#f23645', size: 'small' },
  { id: 'shape3', kind: 'shape', title: 'Shapes', style: 'triangleup', location: 'belowbar', color: '#f23645', size: 'small' },
  { id: 'shape4', kind: 'shape', title: 'Shapes', style: 'triangledown', location: 'abovebar', color: '#363A45', size: 'small' },
  { id: 'shape5', kind: 'shape', title: 'Shapes', style: 'triangleup', location: 'belowbar', color: '#363A45', size: 'small' },
];

export const drawingKinds: StudyDrawingKind[] = ['box', 'line'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Any Regular FVG Rejection', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Regular FVG Bear Rejection', message: 'Alert Fired!' },
  { id: 'alert2', title: 'Regular FVG Bull Rejection', message: 'Alert Fired!' },
  { id: 'alert3', title: 'Any Inverse FVG Rejection', message: 'Alert Fired!' },
  { id: 'alert4', title: 'Inverse FVG Bear Rejection', message: 'Alert Fired!' },
  { id: 'alert5', title: 'Inverse FVG Bull Rejection', message: 'Alert Fired!' },
  { id: 'alert6', title: 'Any FVG + IFVG Rejection', message: 'Alert Fired!' },
  { id: 'alert7', title: 'FVG + IFVG Bear Rejection', message: 'Alert Fired!' },
  { id: 'alert8', title: 'FVG + IFVG Bull Rejection', message: 'Alert Fired!' },
];

export const metadata = {
  title: 'Inverse FVG with Rejections [TFO]',
  shortTitle: 'Inverse FVG [TFO]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && b - a <= EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a - b <= EPS;

/** Default max_boxes_count / max_lines_count of indicator() */
const MAX_OBJECTS = 50;

type Side = 'bull' | 'bear' | 'inv bull' | 'inv bear';

export function calculate(
  bars: Bar[],
  inputs: Partial<InverseFvgWithRejectionsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & {
  boxes: BoxData[]; lines: LineDrawingData[]; markers: MarkerData[]; alerts: AlertConditionState[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const toMs = n > 0 && bars[0].time < 1e12 ? 1000 : 1;
  const chartTf = chartTimeframe(bars, chart);
  const tfSeconds = (tf: string) => (tf.trim() === '' ? pineTimeframe.in_seconds(chartTf) : pineTimeframe.in_seconds(tf));
  const sameTf = cfg.tf.trim() === '' || tfSeconds(cfg.tf) === tfSeconds(chartTf);
  // timeframe.change(tf) and timeframe.in_seconds(tf) >= timeframe.in_seconds(timeframe.period)
  const higherOrSame = n > 0 && tfSeconds(cfg.tf) >= tfSeconds(chartTf);
  const changes = !higherOrSame ? bars.map(() => false) : sameTf ? bars.map((_b, i) => i > 0) : periodChanges(bars, cfg.tf, chart);
  // request.security(syminfo.tickerid, tf, [open[1], high[1], low[1], close[1], time[1]], lookahead_on): the bar of
  // the timeframe before the current one
  const htf = higherOrSame && !sameTf ? higherTimeframeBars(bars, cfg.tf, chart) : null;
  const prevBar = (i: number): Bar | null => {
    if (htf === null) return i > 0 ? bars[i - 1] : null;
    const g = htf.group[i] - 1;
    return g >= 0 ? htf.htf[g] : null;
  };

  // t = not na(time(tf, session, "America/New_York"))
  const barMs = n > 1 ? (bars[1].time - bars[0].time) * toMs : 60000;
  const t = bars.map((b) => pineTime.inSession(b.time * toMs, cfg.session, 'America/New_York', barMs));

  const tf_o: number[] = [];
  const tf_h: number[] = [];
  const tf_l: number[] = [];
  const tf_c: number[] = [];
  const tf_t: boolean[] = [];
  const tf_time: number[] = [];

  const reg_fvg: Box[] = [];
  const reg_fvg_ce: Line[] = [];
  const reg_fvg_side: Side[] = [];
  const inv_fvg: Box[] = [];
  const inv_fvg_ce: Line[] = [];
  const inv_fvg_side: Side[] = [];

  const regBear: boolean[] = new Array(n).fill(false);
  const regBull: boolean[] = new Array(n).fill(false);
  const invBear: boolean[] = new Array(n).fill(false);
  const invBull: boolean[] = new Array(n).fill(false);

  const solid = (c: string) => String(color.new(c, 0));
  const ext = cfg.extend_right ? 'right' : 'none';
  const ps = cfg.ps;
  // the four ta.pivothigh / ta.pivotlow calls in the loops
  const rrjHigh = callsite.pivothigh();
  const rrjLow = callsite.pivotlow();
  const irjHigh = callsite.pivothigh();
  const irjLow = callsite.pivotlow();

  const avgOver = (len: number) => {
    let sum = 0;
    for (let i = 0; i <= len; i++) sum += tf_h[i] - tf_l[i];
    return sum / len;
  };

  resetDrawings({ box: MAX_OBJECTS, line: MAX_OBJECTS });
  let tf_new = false;
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const time = b.time;

    if (changes[i]) {
      const p = prevBar(i);
      tf_o.unshift(p ? p.open : NaN);
      tf_h.unshift(p ? p.high : NaN);
      tf_l.unshift(p ? p.low : NaN);
      tf_c.unshift(p ? p.close : NaN);
      tf_t.unshift(i > 0 ? t[i - 1] : false);
      tf_time.unshift(p ? p.time : NaN);
      tf_new = true;
      if (tf_o.length > 300) {
        tf_o.pop();
        tf_h.pop();
        tf_l.pop();
        tf_c.pop();
        tf_t.pop();
        tf_time.pop();
      }
    }

    if (!cfg.extend_right) {
      for (let k = 0; k < reg_fvg.length; k++) {
        box.set_right(reg_fvg[k], time);
        line.set_x2(reg_fvg_ce[k], time);
      }
      for (let k = 0; k < inv_fvg.length; k++) {
        box.set_right(inv_fvg[k], time);
        line.set_x2(inv_fvg_ce[k], time);
      }
    }

    if (tf_o.length > 20 && tf_new) {
      const bull = gt(tf_c[1], tf_o[1]);
      const fvg = bull
        ? lt(tf_h[2], tf_l[0]) && le(tf_l[1], tf_h[2]) && ge(tf_h[1], tf_l[0])
        : gt(tf_l[2], tf_h[0]) && le(tf_l[1], tf_h[0]) && le(tf_l[2], tf_h[1]);
      const fvgLen = bull ? tf_l[0] - tf_h[2] : tf_l[2] - tf_h[0];
      const atrCheck = gt(fvgLen, (avgOver(20) * cfg.disp_x) / 10);

      if (tf_t[2] && fvg && atrCheck) {
        const top = bull ? tf_l[0] : tf_l[2];
        const bottom = bull ? tf_h[2] : tf_h[0];
        const mid = (top + bottom) / 2;
        reg_fvg.unshift(box.new(tf_time[1], top, time, bottom, 'transparent', undefined, undefined, ext, 'bar_time',
          cfg.show_rfvg ? cfg.rfvg_color : 'transparent'));
        reg_fvg_ce.unshift(line.new(tf_time[1], mid, time, mid, 'bar_time', ext,
          cfg.show_rfvg ? solid(cfg.rfvg_color) : 'transparent', 'dashed'));
        reg_fvg_side.unshift(bull ? 'bull' : 'bear');
        tf_new = false;
      }

      if (reg_fvg.length > 0) {
        for (let k = reg_fvg.length - 1; k >= 0; k--) {
          const removeBull = reg_fvg_side[k] === 'bull' && lt(tf_c[0], box.get_bottom(reg_fvg[k]));
          const removeBear = reg_fvg_side[k] === 'bear' && gt(tf_c[0], box.get_top(reg_fvg[k]));
          if (removeBull || removeBear) {
            inv_fvg.unshift(box.copy(reg_fvg[k]));
            inv_fvg_ce.unshift(line.copy(reg_fvg_ce[k]));
            box.set_bgcolor(inv_fvg[0], cfg.show_ifvg ? cfg.ifvg_color : 'transparent');
            line.set_color(inv_fvg_ce[0], cfg.show_ifvg ? solid(cfg.ifvg_color) : 'transparent');
            box.delete(reg_fvg[k]);
            line.delete(reg_fvg_ce[k]);
            reg_fvg.splice(k, 1);
            reg_fvg_ce.splice(k, 1);
            reg_fvg_side.splice(k, 1);
            if (removeBear) inv_fvg_side.unshift('inv bear');
            else if (removeBull) inv_fvg_side.unshift('inv bull');
          }
        }
        if (reg_fvg.length > cfg.disp_limit) {
          box.delete(reg_fvg.pop()!);
          line.delete(reg_fvg_ce.pop()!);
          reg_fvg_side.pop();
        }
      }

      if (inv_fvg.length > 0) {
        for (let k = inv_fvg.length - 1; k >= 0; k--) {
          const removeInvBear = inv_fvg_side[k] === 'inv bear' && lt(tf_c[0], box.get_bottom(inv_fvg[k]));
          const removeInvBull = inv_fvg_side[k] === 'inv bull' && gt(tf_c[0], box.get_top(inv_fvg[k]));
          if (removeInvBear || removeInvBull) {
            box.delete(inv_fvg[k]);
            line.delete(inv_fvg_ce[k]);
            inv_fvg.splice(k, 1);
            inv_fvg_ce.splice(k, 1);
            inv_fvg_side.splice(k, 1);
          }
        }
        if (inv_fvg.length > cfg.disp_limit) {
          box.delete(inv_fvg.pop()!);
          line.delete(inv_fvg_ce.pop()!);
          inv_fvg_side.pop();
        }
      }

      if (Math.min(reg_fvg.length, inv_fvg.length) > 0) {
        const back = i >= ps ? bars[i - ps] : null;
        const hBack = back ? back.high : NaN;
        const lBack = back ? back.low : NaN;
        const inside = (v: number, bx: Box) => ge(v, box.get_bottom(bx)) && le(v, box.get_top(bx));
        const isPivot = (v: number) => !Number.isNaN(v) && v !== 0;
        for (const bx of reg_fvg) {
          const ph = rrjHigh(i, b.high, ps, ps);
          const pl = rrjLow(i, b.low, ps, ps);
          if (isPivot(ph) && inside(hBack, bx)) regBear[i] = true;
          if (isPivot(pl) && inside(lBack, bx)) regBull[i] = true;
        }
        for (const bx of inv_fvg) {
          const ph = irjHigh(i, b.high, ps, ps);
          const pl = irjLow(i, b.low, ps, ps);
          if (isPivot(ph) && inside(hBack, bx)) invBear[i] = true;
          if (isPivot(pl) && inside(lBack, bx)) invBull[i] = true;
        }
      }
    }
  }
  setDrawingBar(null);

  // the flags of the bar before
  const prev = (a: boolean[]) => a.map((_v, i) => i > 0 && a[i - 1]);
  const rBear = prev(regBear);
  const rBull = prev(regBull);
  const iBear = prev(invBear);
  const iBull = prev(invBull);
  const s0 = rBear.map((v) => cfg.show_rrj && v);
  const s1 = rBull.map((v) => cfg.show_rrj && v);
  const s2 = iBear.map((v) => cfg.show_irj && v);
  const s3 = iBull.map((v) => cfg.show_irj && v);
  const s4 = rBear.map((v, i) => cfg.show_brj && v && iBear[i]);
  const s5 = rBull.map((v, i) => cfg.show_brj && v && iBull[i]);

  const markers: MarkerData[] = [];
  const shapes: [boolean[], string, boolean][] = [
    [s0, cfg.rrj_color, true], [s1, cfg.rrj_color, false], [s2, cfg.irj_color, true],
    [s3, cfg.irj_color, false], [s4, cfg.brj_color, true], [s5, cfg.brj_color, false],
  ];
  shapes.forEach(([flags, c, bear], k) => {
    flags.forEach((f, i) => {
      if (!f) return;
      markers.push({
        id: `shape${k}`, time: bars[i].time, position: bear ? 'aboveBar' : 'belowBar',
        shape: bear ? 'triangleDown' : 'triangleUp', color: c, size: 'small',
      });
    });
  });
  markers.sort((a, b) => a.time - b.time);

  const alerts = alertStates(alertConditions, bars, [
    rBear.map((v, i) => cfg.show_rrj && (v || rBull[i])), s0, s1,
    iBear.map((v, i) => cfg.show_irj && (v || iBull[i])), s2, s3,
    s4.map((v, i) => v || s5[i]), s4, s5,
  ]);

  const colour = (c: unknown) => (c === undefined || c === null ? 'transparent' : String(c));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    boxes: box.all().map((bx) => ({
      time1: bx.left, price1: bx.top, time2: bx.right, price2: bx.bottom, xloc: 'bar_time' as const,
      bgColor: colour(bx.bgcolor), borderColor: 'transparent', extend: bx.extend,
    })),
    lines: line.all().map((l) => ({
      time1: l.x1, price1: l.y1, time2: l.x2, price2: l.y2, xloc: 'bar_time' as const,
      color: colour(l.color), style: 'dashed' as const, extend: l.extend,
    })),
    alerts,
  };
}

export const InverseFvgWithRejections = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
  alertConditions,
};
