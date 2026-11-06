/**
 * Liquidity Delta Profiler [LuxAlgo]
 *
 * Liquidity zones at the swing highs and lows, with the volume delta traded inside them.
 * - A swing high (pivot with "Pivot Length" bars on each side) gives a buy-side zone from the top of the candle body
 *   to the high; a swing low gives a sell-side zone from the low to the bottom of the body. A zone is at least 10 %
 *   of the ATR(14) high. With "Filter Overlapping Zones", a new zone that overlaps an active zone replaces it when it
 *   is more extreme, else it is not created. At most "Max Zones per Type" zones are kept per side.
 * - Each zone is cut into four quadrants. The delta of a bar is estimated from the bar itself:
 *   volume * (close - open) / (high - low). On every bar, each quadrant of an active zone gets the part of that delta
 *   (and of the volume) that matches the share of the bar range inside the quadrant. The quadrant shows its
 *   cumulative delta, coloured by its sign and with an opacity that follows its size.
 * - Zone decay: a label at the right of an active zone shows its remaining "health", 100 % minus the volume traded
 *   in the zone as a share of its capacity (average volume at its creation * "Zone Volume Capacity").
 * - A zone is swept when price goes beyond its extreme: it stops growing and is drawn dashed and faded (or hidden).
 * - Reversal detection: on a bar that touches or sweeps a zone, one label is drawn per zone at most: ABS (the delta
 *   of the outer quadrant opposes the sweep), EXH (almost no delta in the outer quadrant), DIV (most of the delta is
 *   in the outer quadrant but the bar closes inside the zone) or REJ (a sweep with a close back beyond the middle of
 *   the zone and a strong opposite bar delta). The label size and opacity follow the strength of the signal.
 * - Dashboard: each signal is followed for at most "Eval Window" bars; it is a win when the close stays on the
 *   reversal side of the signal close for "Hold Time" bars in a row. The table shows the totals, the wins and the
 *   win rate per signal type. "Highlight Eval Bars" colours the bars under evaluation.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar): "Price testing Resistance BSL Zone at <top>" /
 * "Price testing Support SSL Zone at <bottom>" on the first bar of a run of bars that touch an active zone,
 * "Resistance BSL Zone Swept at <top>" / "Support SSL Zone Swept at <bottom>" when a zone is swept, and
 * "Reversal Signal (<type>) detected at <close>" with each reversal label.
 *
 * Reference: "Liquidity Delta Profiler [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { taStep, str, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, BarColorData, BoxData, LabelData, TableData, TableCellData, TableMergeData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface LiquidityDeltaProfilerInputs {
  /** Bars on each side of a swing */
  length: number;
  maxZones: number;
  showSwept: boolean;
  filterOverlaps: boolean;
  showDecay: boolean;
  /** Multiplier of the average volume: the volume a zone absorbs before its health is 0 % */
  zoneCapacity: number;
  enableReversals: boolean;
  dashboardInput: boolean;
  dashboardPositionInput: 'Top Right' | 'Bottom Right' | 'Bottom Left';
  dashboardSizeInput: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
  /** Maximum number of bars to wait for the reversal */
  dashboardWindowInput: number;
  /** Bars in a row that the close must stay in profit */
  dashboardHoldInput: number;
  dashboardHighlightInput: boolean;
  bslColor: string;
  sslColor: string;
  buyDeltaColor: string;
  sellDeltaColor: string;
}

export const defaultInputs: LiquidityDeltaProfilerInputs = {
  length: 15,
  maxZones: 10,
  showSwept: true,
  filterOverlaps: true,
  showDecay: true,
  zoneCapacity: 5,
  enableReversals: true,
  dashboardInput: true,
  dashboardPositionInput: 'Top Right',
  dashboardSizeInput: 'Tiny',
  dashboardWindowInput: 10,
  dashboardHoldInput: 3,
  dashboardHighlightInput: false,
  bslColor: '#f23645',
  sslColor: '#089981',
  buyDeltaColor: '#089981',
  sellDeltaColor: '#f23645',
};

const G_DASH = 'Dashboard';

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Pivot Length', defval: 15, min: 2, tooltip: 'Lookback and lookforward length for detecting major swing highs/lows.' },
  { id: 'maxZones', type: 'int', title: 'Max Zones per Type', defval: 10, min: 1, max: 40, tooltip: 'Maximum number of active/historical buy and sell zones to keep on the chart.' },
  { id: 'showSwept', type: 'bool', title: 'Show Swept Zones', defval: true, tooltip: 'Keep zones visible (with dashed outlines and reduced opacity) after price sweeps them.' },
  { id: 'filterOverlaps', type: 'bool', title: 'Filter Overlapping Zones', defval: true, tooltip: 'When enabled, prevents creating new zones that overlap with existing active zones. Only the most significant (highest for BSL, lowest for SSL) level is kept.' },
  { id: 'showDecay', type: 'bool', title: 'Show Zone Decay', defval: true, tooltip: "Displays the remaining 'health' of active zones based on the volume traded inside them. Health drops from 100% to 0%." },
  { id: 'zoneCapacity', type: 'float', title: 'Zone Volume Capacity', defval: 5, min: 1, tooltip: 'Multiplier for average volume to determine how much volume a zone can absorb before reaching 0% health.' },
  { id: 'enableReversals', type: 'bool', title: 'Enable Reversal Detection', defval: true, group: 'Reversals', tooltip: 'Detects unusual volume delta patterns during liquidity sweeps to signal potential reversals. Plots a bubble with signal type (ABS, EXH, DIV, REJ) and hover tooltip.' },
  { id: 'dashboardInput', type: 'bool', title: 'Show Dashboard', defval: true, group: G_DASH, tooltip: 'Enable or disable the dashboard.' },
  { id: 'dashboardPositionInput', type: 'string', title: 'Position', defval: 'Top Right', options: ['Top Right', 'Bottom Right', 'Bottom Left'], group: G_DASH, tooltip: 'Select the dashboard location.' },
  { id: 'dashboardSizeInput', type: 'string', title: 'Size', defval: 'Tiny', options: ['Tiny', 'Small', 'Normal', 'Large', 'Huge'], group: G_DASH, tooltip: 'Select the dashboard size.' },
  { id: 'dashboardWindowInput', type: 'int', title: 'Eval Window (Bars)', defval: 10, min: 1, group: G_DASH, tooltip: 'Maximum number of bars to wait for the reversal to occur.' },
  { id: 'dashboardHoldInput', type: 'int', title: 'Hold Time (Bars)', defval: 3, min: 1, group: G_DASH, tooltip: 'Number of consecutive bars price must stay in profit (opposite direction) to be considered a win.' },
  { id: 'dashboardHighlightInput', type: 'bool', title: 'Highlight Eval Bars', defval: false, group: G_DASH, tooltip: 'Highlights bars actively evaluated. Yellow = Evaluating, Aqua = Holding in profit.' },
  { id: 'bslColor', type: 'color', title: 'BSL Outline Color', defval: '#f23645', group: 'Style', tooltip: 'Color for Buy-Side Liquidity zones (above price).' },
  { id: 'sslColor', type: 'color', title: 'SSL Outline Color', defval: '#089981', group: 'Style', tooltip: 'Color for Sell-Side Liquidity zones (below price).' },
  { id: 'buyDeltaColor', type: 'color', title: 'Buy Delta Fill', defval: '#089981', group: 'Style', tooltip: 'Fill color when buy volume dominates a zone quadrant.' },
  { id: 'sellDeltaColor', type: 'color', title: 'Sell Delta Fill', defval: '#f23645', group: 'Style', tooltip: 'Fill color when sell volume dominates a zone quadrant.' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Liquidity Delta Profiler [LuxAlgo]',
  shortTitle: 'LuxAlgo - Liquidity Delta Profiler',
  overlay: true,
};

/** indicator(max_labels_count = 500) */
const MAX_LABELS = 500;

const DATA = '#DBDBDB';
const HEADERS = '#808080';
const BACKGROUND = '#161616';
const BORDERS = '#2E2E2E';
const WHITE = '#FFFFFF';

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

interface Bx {
  left: number;
  top: number;
  right: number;
  bottom: number;
  borderColor: string | null;
  dashed: boolean;
  bg: string | null;
  text: string;
  textColor: string | null;
  /** A quadrant box: its text is aligned to the right */
  quad: boolean;
  deleted: boolean;
}
interface Lb {
  x: number;
  y: number;
  text: string;
  color: string;
  style: 'label_left' | 'label_down' | 'label_up';
  size: 'tiny' | 'small' | 'normal';
  tooltip?: string;
  deleted: boolean;
}
interface Zone {
  top: number;
  bottom: number;
  swept: boolean;
  signaled: boolean;
  quads: Bx[];
  deltas: number[];
  outline: Bx;
  volumeTraded: number;
  capacity: number;
  wasHit: boolean;
  decayLabel: Lb;
}
interface Trade {
  type: 'ABS' | 'EXH' | 'DIV' | 'REJ';
  dir: number;
  entry: number;
  entryBar: number;
  consecBars: number;
}

type Result = Omit<IndicatorResult, 'boxes' | 'labels' | 'tables' | 'barColors'> & {
  boxes: BoxData[]; labels: LabelData[]; tables: TableData[]; barColors: BarColorData[]; alertCalls: AlertCall[];
};

type Counts = { ABS: number; EXH: number; DIV: number; REJ: number };

/** The drawings and the state of the script, changed in place: copyVars copies them (one copy per update) */
interface LdpVars {
  boxes: Bx[];
  /**
   * Labels in creation order: when a creation brings the count above max + 5, the oldest are deleted until max
   * remain. A deleted label ignores later changes.
   */
  labels: Lb[];
  bsl: Zone[];
  ssl: Zone[];
  trades: Trade[];
  totals: Counts;
  wins: Counts;
}

interface LdpRun extends BarRunState<LdpVars> {
  atrStep: ReturnType<typeof taStep.atr>;
  ph: PivotStep;
  pl: PivotStep;
  volSma: ReturnType<typeof taStep.sma>;
  atr: number[];
  barColors: BarColorData[];
  alertCalls: AlertCall[];
}

/** A copy of the state: the zones point to the copies of their boxes and labels (also the deleted ones) */
function copyState(v: LdpVars): LdpVars {
  const boxCopies = new Map<Bx, Bx>();
  const labelCopies = new Map<Lb, Lb>();
  const box = (b: Bx) => {
    let c = boxCopies.get(b);
    if (!c) {
      c = { ...b };
      boxCopies.set(b, c);
    }
    return c;
  };
  const label = (l: Lb) => {
    let c = labelCopies.get(l);
    if (!c) {
      c = { ...l };
      labelCopies.set(l, c);
    }
    return c;
  };
  const zone = (z: Zone): Zone => ({
    ...z, quads: z.quads.map(box), deltas: z.deltas.slice(), outline: box(z.outline), decayLabel: label(z.decayLabel),
  });
  return {
    boxes: v.boxes.map(box), labels: v.labels.map(label), bsl: v.bsl.map(zone), ssl: v.ssl.map(zone),
    trades: v.trades.map((t) => ({ ...t })), totals: { ...v.totals }, wins: { ...v.wins },
  };
}

function study(inputs: Partial<LiquidityDeltaProfilerInputs>): BarStudy<LdpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const length = Math.trunc(cfg.length);
  const { maxZones, showSwept, showDecay, bslColor, sslColor, buyDeltaColor, sellDeltaColor } = cfg;

  /** color.rgb(color.r(c), color.g(c), color.b(c), transp) */
  const rgbT = (c: string, transp: number) => String(color.rgb(color.r(c), color.g(c), color.b(c), transp));
  const newT = (c: string, transp: number) => String(color.new(c, transp));

  /** The state, the bars and the vars of the bar being calculated (set by bar()) */
  let S: LdpRun;
  let B: Bar[];
  let V: LdpVars;
  const alert = (i: number, message: string) => S.alertCalls.push({ time: B[i].time, message, freq: 'once_per_bar' });

  const newBox = (b: Omit<Bx, 'deleted'>): Bx => {
    const o = { ...b, deleted: false };
    V.boxes.push(o);
    return o;
  };
  const deleteBox = (b: Bx) => {
    if (b.deleted) return;
    b.deleted = true;
    V.boxes.splice(V.boxes.indexOf(b), 1);
  };
  const deleteLabel = (l: Lb) => {
    if (l.deleted) return;
    l.deleted = true;
    V.labels.splice(V.labels.indexOf(l), 1);
  };
  const newLabel = (l: Omit<Lb, 'deleted'>): Lb => {
    const o = { ...l, deleted: false };
    V.labels.push(o);
    if (V.labels.length > MAX_LABELS + 5) {
      for (const old of V.labels.splice(0, V.labels.length - MAX_LABELS)) old.deleted = true;
    }
    return o;
  };
  const deleteZone = (z: Zone) => {
    for (const b of z.quads) deleteBox(b);
    deleteBox(z.outline);
    deleteLabel(z.decayLabel);
  };

  /** A new zone at the pivot of `length` bars ago (top / bottom already known) */
  const createZone = (i: number, isBsl: boolean, zTop: number, zBot: number, capacity: number) => {
    const zones = isBsl ? V.bsl : V.ssl;
    const baseC = isBsl ? bslColor : sslColor;
    const pivotIdx = i - length;
    const step = (zTop - zBot) / 4;
    const quads: Bx[] = [];
    for (let k = 0; k < 4; k++) {
      const qBot = zBot + k * step;
      const qTop = zBot + (k + 1) * step;
      const gap = step * 0.05;
      const bTop = k === 3 ? qTop : qTop - gap;
      const bBot = k === 0 ? qBot : qBot + gap;
      quads.push(newBox({
        left: pivotIdx, top: bTop, right: pivotIdx, bottom: bBot, borderColor: newT(baseC, 60), dashed: false,
        bg: rgbT(baseC, 60 + (isBsl ? 3 - k : k) * 10), text: '0', textColor: newT(baseC, 50), quad: true,
      }));
    }
    const outline = newBox({
      left: pivotIdx, top: zTop, right: pivotIdx, bottom: zBot, borderColor: newT(baseC, 80), dashed: false,
      bg: null, text: '', textColor: null, quad: false,
    });
    const decayLabel = newLabel({
      x: i, y: zBot + (zTop - zBot) / 2, text: '100%', color: newT(baseC, 80), style: 'label_left', size: 'small',
    });
    if (!showDecay) decayLabel.x = NaN;
    zones.unshift({
      top: zTop, bottom: zBot, swept: false, signaled: false, quads, deltas: [0, 0, 0, 0], outline,
      volumeTraded: 0, capacity, wasHit: false, decayLabel,
    });
    if (zones.length > maxZones) deleteZone(zones.pop()!);
  };

  /** The overlap filter: true when the new zone must not be created */
  const overlapSkip = (isBsl: boolean, zTop: number, zBot: number): boolean => {
    const zones = isBsl ? V.bsl : V.ssl;
    if (!cfg.filterOverlaps) return false;
    for (let k = zones.length - 1; k >= 0; k--) {
      if (k >= zones.length) continue;
      const ex = zones[k];
      if (ex.swept) continue;
      if (!le(Math.max(zBot, ex.bottom), Math.min(zTop, ex.top))) continue;
      if (isBsl ? gt(zTop, ex.top) : lt(zBot, ex.bottom)) {
        deleteZone(ex);
        zones.splice(k, 1);
      } else {
        return true;
      }
    }
    return false;
  };

  const evaluateReversals = (z: Zone, isBsl: boolean, i: number, barDelta: number, barVol: number) => {
    if (!cfg.enableReversals || z.signaled) return;
    const b = B[i];
    let absTotalD = 0;
    for (const d of z.deltas) absTotalD += Math.abs(d);
    if (!gt(absTotalD, 0)) return;
    const outerD = z.deltas[isBsl ? 3 : 0];
    const isSweeping = isBsl ? gt(b.high, z.top) : lt(b.low, z.bottom);
    const closesInside = le(b.close, z.top) && ge(b.close, z.bottom);
    const midPoint = (z.top + z.bottom) / 2;
    const closesRejecting = isBsl ? lt(b.close, midPoint) : gt(b.close, midPoint);
    const outerText = str.tostring(outerD, 'volume');

    let signalType: Trade['type'] | '' = '';
    let tooltip = '';
    let significance = 0;
    const ratio = Math.abs(outerD) / (absTotalD + 0.0001);
    // 1. Absorption at the extreme
    if (isSweeping && (isBsl ? lt(outerD, 0) : gt(outerD, 0)) && gt(ratio, 0.2)) {
      signalType = 'ABS';
      tooltip = `Absorption at Extreme\n${isBsl ? 'Sellers' : 'Buyers'} aggressively absorbed the sweep.\nOuter Quadrant Delta: ${outerText}`;
      significance = ratio * 2;
    }
    // 2. Exhaustion
    if (signalType === '' && isSweeping && lt(ratio, 0.1)) {
      signalType = 'EXH';
      tooltip = `Exhaustion (Dry Sweep)\nMinimal volume at the extreme edge.\nOuter Quadrant Delta: ${outerText}`;
      significance = 1.0 - ratio * 5;
    }
    // 3. Delta divergence
    if (signalType === '' && closesInside && gt(ratio, 0.6) && (isBsl ? gt(outerD, 0) : lt(outerD, 0))) {
      signalType = 'DIV';
      tooltip = `Delta Divergence (FOMO)\nHigh volume trapped at the extreme, but price failed to breakout.\nOuter Quadrant Delta: ${outerText}`;
      significance = ratio;
    }
    // 4. Snapback
    if (signalType === '' && isSweeping && closesRejecting) {
      const barRatio = Math.abs(barDelta) / (barVol + 0.0001);
      if ((isBsl ? lt(barDelta, 0) : gt(barDelta, 0)) && gt(barRatio, 0.2)) {
        signalType = 'REJ';
        tooltip = `Snapback Rejection\nSweep followed by immediate strong rejection.\nBar Delta: ${str.tostring(barDelta, 'volume')}`;
        significance = barRatio * 2;
      }
    }
    if (signalType === '') return;

    z.signaled = true;
    // alert("Reversal Signal (" + signalType + ") detected at " + str.tostring(barC), alert.freq_once_per_bar)
    alert(i, `Reversal Signal (${signalType}) detected at ${str.tostring(b.close)}`);
    significance = Math.min(Math.max(significance, 0.0), 1.0);
    let size: Lb['size'] = 'tiny';
    let trans = 50;
    if (gt(significance, 0.7)) {
      size = 'normal';
      trans = 10;
    } else if (gt(significance, 0.4)) {
      size = 'small';
      trans = 30;
    }
    newLabel({
      x: i, y: isBsl ? b.high : b.low, text: signalType, color: newT(isBsl ? color.red : color.green, trans),
      style: isBsl ? 'label_down' : 'label_up', size, tooltip,
    });
    V.trades.push({ type: signalType, dir: isBsl ? -1 : 1, entry: b.close, entryBar: i, consecBars: 0 });
  };

  const updateVisuals = (z: Zone, isBsl: boolean) => {
    const sideC = isBsl ? bslColor : sslColor;
    const hidden = !showSwept && z.swept;
    let maxD = 0;
    for (const d of z.deltas) maxD = Math.max(maxD, Math.abs(d));
    for (let k = 0; k < 4; k++) {
      const d = z.deltas[k];
      let c: string;
      let txt: string;
      let tColor: string;
      if (gt(maxD, 0) && gt(Math.abs(d), 0.001)) {
        const baseC = gt(d, 0) ? buyDeltaColor : sellDeltaColor;
        const trans = z.swept ? 90 : 100 - Math.trunc((Math.abs(d) / maxD) * 60);
        c = rgbT(baseC, trans);
        txt = (gt(d, 0) ? '+' : lt(d, 0) ? '-' : '') + str.tostring(Math.abs(d), 'volume');
        tColor = newT(baseC, z.swept ? 50 : 0);
      } else {
        c = rgbT(sideC, z.swept ? 90 : 60 + (isBsl ? 3 - k : k) * 10);
        txt = '0';
        tColor = newT(sideC, z.swept ? 80 : 50);
      }
      const q = z.quads[k];
      if (q.deleted) continue;
      q.bg = hidden ? null : c;
      q.text = hidden ? '' : txt;
      q.textColor = hidden ? null : tColor;
      if (z.swept) {
        q.borderColor = showSwept ? newT(sideC, 80) : null;
        q.dashed = true;
      } else {
        q.borderColor = newT(sideC, 60);
        q.dashed = false;
      }
    }
    if (z.swept && !z.outline.deleted) {
      if (showSwept) {
        z.outline.dashed = true;
        z.outline.borderColor = newT(sideC, 80);
      } else {
        z.outline.borderColor = null;
      }
    }
  };

  /** The active zones of one side on bar i */
  const processZones = (isBsl: boolean, i: number, vol: number, totalRange: number, barDelta: number) => {
    const zones = isBsl ? V.bsl : V.ssl;
    const b = B[i];
    for (let k = zones.length - 1; k >= 0; k--) {
      const z = zones[k];
      if (z.swept) continue;
      z.outline.right = i;
      for (const q of z.quads) q.right = i;

      let hit = false;
      const step = (z.top - z.bottom) / 4;
      for (let j = 0; j < 4; j++) {
        const qBot = z.bottom + j * step;
        const qTop = z.bottom + (j + 1) * step;
        // barOverlap(high, low, qTop, qBot)
        const overlapTop = Math.min(b.high, qTop);
        const overlapBot = Math.max(b.low, qBot);
        const overlap = gt(overlapTop, overlapBot) ? overlapTop - overlapBot : 0;
        if (gt(overlap, 0)) {
          hit = true;
          const overlapRatio = eq(totalRange, 0) ? 0 : overlap / totalRange;
          z.deltas[j] += barDelta * overlapRatio;
          z.volumeTraded += vol * overlapRatio;
        }
      }

      // if hit and not z.wasHit: alert("Price testing Resistance BSL Zone at " + str.tostring(z.top)) (SSL: z.bottom)
      if (hit && !z.wasHit) {
        alert(i, isBsl ? `Price testing Resistance BSL Zone at ${str.tostring(z.top)}` : `Price testing Support SSL Zone at ${str.tostring(z.bottom)}`);
      }
      if (isBsl ? gt(b.high, z.top) : lt(b.low, z.bottom)) {
        z.swept = true;
        alert(i, isBsl ? `Resistance BSL Zone Swept at ${str.tostring(z.top)}` : `Support SSL Zone Swept at ${str.tostring(z.bottom)}`);
      }

      if (!z.swept) {
        if (!z.decayLabel.deleted) {
          if (showDecay) {
            const health = Math.trunc(Math.max(0, 100 - (z.volumeTraded / z.capacity) * 100));
            z.decayLabel.x = i + 1;
            z.decayLabel.text = `${str.tostring(health)}%`;
          } else {
            z.decayLabel.x = NaN;
          }
        }
      } else {
        deleteLabel(z.decayLabel);
      }

      z.wasHit = hit;
      if (hit || z.swept) {
        evaluateReversals(z, isBsl, i, barDelta, vol);
        updateVisuals(z, isBsl);
      }
    }
  };


  return {
    init() {
      const s: LdpRun = {
        atrStep: taStep.atr(14), ph: new PivotStep(length, length, true), pl: new PivotStep(length, length, false),
        volSma: taStep.sma(), atr: [], barColors: [], alertCalls: [],
        steps: [], vars: {
          boxes: [], labels: [], bsl: [], ssl: [], trades: [],
          totals: { ABS: 0, EXH: 0, DIV: 0, REJ: 0 }, wins: { ABS: 0, EXH: 0, DIV: 0, REJ: 0 },
        },
        lists: [], series: [],
      };
      s.steps = [s.atrStep, s.ph, s.pl, s.volSma];
      s.lists = [s.barColors, s.alertCalls];
      s.series = [s.atr];
      return s;
    },
    bar(s, i, bars) {
      S = s;
      B = bars;
      V = s.vars;
      const b = bars[i];
      // avgVol = nz(ta.sma(volume, length)); 0 -> 1
      const sma = s.volSma.step(b.volume ?? NaN, length);
      s.atr[i] = s.atrStep.step(b.high, b.low, b.close);
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);
      let avgVol = sma === null || sma === undefined || !Number.isFinite(sma) ? 0 : sma;
      if (eq(avgVol, 0)) avgVol = 1;
      const currentZoneCap = avgVol * cfg.zoneCapacity;

      const high = ph;
      if (high !== null && high !== undefined && !isNaN(high) && i >= length) {
        const p = bars[i - length];
        const minHeight = s.atr[i - length] * 0.1;
        let pBot = Math.max(p.close, p.open);
        if (lt(p.high - pBot, minHeight)) pBot = p.high - minHeight;
        if (!overlapSkip(true, p.high, pBot)) createZone(i, true, p.high, pBot, currentZoneCap);
      }
      const low = pl;
      if (low !== null && low !== undefined && !isNaN(low) && i >= length) {
        const p = bars[i - length];
        const minHeight = s.atr[i - length] * 0.1;
        let pTop = Math.min(p.close, p.open);
        if (lt(pTop - p.low, minHeight)) pTop = p.low + minHeight;
        if (!overlapSkip(false, pTop, p.low)) createZone(i, false, pTop, p.low, currentZoneCap);
      }

      const volume = b.volume ?? NaN;
      const vol = Number.isFinite(volume) ? volume : 0;
      const totalRange = b.high - b.low;
      const barDelta = eq(totalRange, 0) ? 0 : (vol * (b.close - b.open)) / totalRange;

      processZones(true, i, vol, totalRange, barDelta);
      processZones(false, i, vol, totalRange, barDelta);

      // Signals under evaluation
      let barHighlight: string | null = null;
      for (let k = V.trades.length - 1; k >= 0; k--) {
        const t = V.trades[k];
        if (i <= t.entryBar) continue;
        const inProfit = (t.dir === 1 && gt(b.close, t.entry)) || (t.dir === -1 && lt(b.close, t.entry));
        if (inProfit) {
          t.consecBars += 1;
          if (barHighlight === null || barHighlight === color.yellow) barHighlight = color.aqua;
        } else {
          t.consecBars = 0;
          if (barHighlight === null) barHighlight = color.yellow;
        }
        let done = false;
        if (t.consecBars >= cfg.dashboardHoldInput) {
          done = true;
          V.wins[t.type] += 1;
        } else if (i - t.entryBar >= cfg.dashboardWindowInput) {
          done = true;
        }
        if (done) {
          V.totals[t.type] += 1;
          V.trades.splice(k, 1);
        }
      }
      if (cfg.dashboardHighlightInput && barHighlight !== null) s.barColors.push({ time: b.time, color: barHighlight });
    },
    copyVars: copyState,
    result(s, bars) {
      const n = bars.length;
      const V = s.vars;
      // Dashboard (barstate.islast). Without it the table stays, with no cell and no colour: nothing is drawn.
      const tables: TableData[] = [];
      const position = cfg.dashboardPositionInput === 'Bottom Right' ? 'bottom_right'
        : cfg.dashboardPositionInput === 'Bottom Left' ? 'bottom_left' : 'top_right';
      if (n > 0 && !cfg.dashboardInput) {
        tables.push({
          position, columns: 4, rows: 11, cells: [], bgColor: 'transparent', frameColor: 'transparent', frameWidth: 1,
          borderWidth: 0, forceOverlay: true,
        });
      }
      if (n > 0 && cfg.dashboardInput) {
        const textSize = cfg.dashboardSizeInput.toLowerCase() as 'tiny' | 'small' | 'normal' | 'large' | 'huge';
        const cells: TableCellData[] = [];
        const merges: TableMergeData[] = [];
        const cell = (column: number, row: number, text: string, textColor: string, textHAlign: 'left' | 'center' | 'right', height = 0) => {
          cells.push({ column, row, text, textColor, textSize, textHAlign, ...(height ? { height } : {}) });
        };
        const mergeRow = (row: number) => merges.push({ startColumn: 0, startRow: row, endColumn: 3, endRow: row });
        const divider = (row: number) => {
          mergeRow(row);
          cell(0, row, '━━━━━━━━━━━━━━━━', BORDERS, 'center', 0.5);
        };
        mergeRow(0);
        cell(0, 0, 'Reversal Performance (Time-Based)', DATA, 'center');
        divider(1);
        cell(0, 2, 'Signal', HEADERS, 'left');
        cell(1, 2, 'Total', HEADERS, 'right');
        cell(2, 2, 'Wins', HEADERS, 'right');
        cell(3, 2, 'Win %', HEADERS, 'right');
        (['ABS', 'EXH', 'DIV', 'REJ'] as const).forEach((type, k) => {
          divider(3 + 2 * k);
          const row = 4 + 2 * k;
          const total = V.totals[type];
          const rate = total > 0 ? (V.wins[type] / total) * 100 : 0;
          cell(0, row, type, DATA, 'left');
          cell(1, row, str.tostring(total), DATA, 'right');
          cell(2, row, str.tostring(V.wins[type]), DATA, 'right');
          cell(3, row, `${str.tostring(rate, '#.##')}%`, total > 0 ? (ge(rate, 50) ? color.green : color.red) : DATA, 'right');
        });
        tables.push({
          position, columns: 4, rows: 11, cells, merges, bgColor: BACKGROUND, frameColor: BORDERS, frameWidth: 1,
          borderWidth: 0, forceOverlay: true,
        });
      }

      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        boxes: V.boxes.map((b) => ({
          time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom,
          bgColor: b.bg ?? 'transparent', borderColor: b.borderColor ?? 'transparent',
          ...(b.dashed ? { borderStyle: 'dashed' as const } : {}),
          ...(b.quad ? { text: b.text, textColor: b.textColor ?? 'transparent', textHAlign: 'right' as const, textSize: 'auto' as const } : {}),
        })),
        // a label with an na x (the decay label when "Show Zone Decay" is off) is not drawn
        labels: V.labels.filter((l) => !isNaN(l.x)).map((l) => ({
          time: T(l.x), price: l.y, text: l.text, color: l.color, textColor: WHITE, style: l.style, size: l.size,
          ...(l.tooltip ? { tooltip: l.tooltip } : {}),
        })),
        tables,
        barColors: s.barColors.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LiquidityDeltaProfilerInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LiquidityDeltaProfilerInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const LiquidityDeltaProfiler = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
