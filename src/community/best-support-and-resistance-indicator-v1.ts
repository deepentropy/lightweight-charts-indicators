/**
 * Best Support And Resistance Indicator V1 [ForexBee]
 *
 * Swing pivots with "Swing Lookback" bars on each side (crosses drawn on the pivot bar). A resistance zone forms
 * when a new swing high is below the high of an earlier swing high but above the top of that pivot's candle body
 * (with 3 or 4 pivot tests, every newer swing high in between must also be in that range); the zone runs from the
 * earlier pivot's high to its body top. Support zones are the mirror image with swing lows (low to body bottom). Each
 * zone is two lines with a fill between them, extended bar by bar while the zone is active. A close beyond the zone
 * breaks it (its lines turn grey when "Show Broken Zones" is on); a zone older than "Zone Expiry" bars stops too.
 * A close back inside an active zone after it was away from it gives a retest label. Candle patterns (Evening /
 * Morning Star, Inside Bar, Tweezer Top / Bottom) inside an active zone are labelled on their middle candle.
 * Three alert conditions: a new zone, the close near a resistance or near a support (within "Proximity %" of the
 * zone).
 *
 * Reference: "Best S&R Indicator With Candlestick Patterns" by ForexBee
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, color, Series, line, label, linefill, resetDrawings, setDrawingBar,
  type Bar, type Line, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData, LinefillData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { barInterval, barTime } from '../bar-time';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface BestSupportAndResistanceIndicatorV1Inputs {
  /** Bars on each side of a swing pivot */
  Bars: number;
  /** Pivots that test the zone (2, 3 or 4) */
  NoOfPivots: number;
  /** Bars after which a zone stops (0 = never) */
  ZoneExpiry: number;
  ResColor: string;
  SupColor: string;
  BrokenColor: string;
  /** Transparency of the zone fill */
  ZoneAlpha: number;
  ShowBroken: boolean;
  ShowPatterns: boolean;
  /** Buffer around a zone for the proximity alerts, in % of the zone top */
  ProximityPct: number;
  ShowRetest: boolean;
}

export const defaultInputs: BestSupportAndResistanceIndicatorV1Inputs = {
  Bars: 10,
  NoOfPivots: 2,
  ZoneExpiry: 200,
  ResColor: '#F23645',
  SupColor: '#4CAF50',
  BrokenColor: 'rgba(120, 123, 134, 0.4)',
  ZoneAlpha: 80,
  ShowBroken: true,
  ShowPatterns: true,
  ProximityPct: 0.3,
  ShowRetest: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'Bars', type: 'int', title: 'Swing Lookback (Bars)', defval: 10, min: 5 },
  { id: 'NoOfPivots', type: 'int', title: 'Pivot Tests for Valid Zone', defval: 2, min: 2, max: 4 }, // Pine options = [2, 3, 4]
  { id: 'ZoneExpiry', type: 'int', title: 'Zone Expiry (candles, 0 = never)', defval: 200, min: 0 },
  { id: 'ResColor', type: 'color', title: 'Resistance Color', defval: '#F23645', group: 'Zone Style' },
  { id: 'SupColor', type: 'color', title: 'Support Color', defval: '#4CAF50', group: 'Zone Style' },
  { id: 'BrokenColor', type: 'color', title: 'Broken Zone Color', defval: 'rgba(120, 123, 134, 0.4)', group: 'Zone Style' },
  { id: 'ZoneAlpha', type: 'int', title: 'Zone Fill Transparency %', defval: 80, min: 0, max: 100, group: 'Zone Style' },
  { id: 'ShowBroken', type: 'bool', title: 'Show Broken Zones (grayed)', defval: true, group: 'Zone Style' },
  { id: 'ShowPatterns', type: 'bool', title: 'Show Candle Pattern Labels', defval: true, group: 'Patterns' },
  {
    id: 'ProximityPct', type: 'float', title: 'Proximity % (buffer around zone)', defval: 0.3, min: 0.05, step: 0.05,
    group: 'Proximity & Alerts',
  },
  { id: 'ShowRetest', type: 'bool', title: 'Show Zone Retest Labels', defval: true, group: 'Retest' },
];

const RED = '#F23645';
const PIVOT_LOW = '#00D034';
/** v6 color.orange */
const ORANGE = '#FF9800';
const WHITE = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pivot High', color: RED, lineWidth: 3, style: 'cross' },
  { id: 'plot1', title: 'Pivot Low', color: PIVOT_LOW, lineWidth: 3, style: 'cross' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'linefill', 'label'];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'New S/R Zone Detected', message: 'A new Support or Resistance zone has formed' },
  { id: 'alert1', title: 'Price Near Resistance', message: 'Price is approaching a Resistance zone' },
  { id: 'alert2', title: 'Price Near Support', message: 'Price is approaching a Support zone' },
];

export const metadata = {
  title: 'Best S&R Indicator With Candlestick Patterns',
  shortTitle: 'Best S&R Indicator With Candlestick Patterns',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && b - a <= EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a - b <= EPS;

/** indicator(max_lines_count = 500); labels keep the default 50 */
const MAX_LINES = 500;

/** ta.valuewhen(cond, src, k) for k = 0 .. count - 1 */
function valuewhen(cond: boolean[], src: number[], count: number): number[][] {
  const out = Array.from({ length: count }, () => new Array<number>(cond.length).fill(NaN));
  const hist: number[] = [];
  for (let i = 0; i < cond.length; i++) {
    if (cond[i]) hist.unshift(src[i]);
    if (hist.length > count) hist.pop();
    for (let k = 0; k < count; k++) out[k][i] = k < hist.length ? hist[k] : NaN;
  }
  return out;
}

interface Zone {
  top: Line;
  bot: Line;
  zH: number;
  zL: number;
  start: number;
  wasAway: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BestSupportAndResistanceIndicatorV1Inputs> = {},
): IndicatorResult & {
  lines: LineDrawingData[]; linefills: LinefillData[]; labels: LabelData[]; alerts: AlertConditionState[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const B = Math.trunc(cfg.Bars);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const open = bars.map((b) => b.open);
  const close = bars.map((b) => b.close);
  const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);

  const pivotHigh = A(ta.pivothigh(new Series(bars, (b) => b.high), B, B));
  const pivotLow = A(ta.pivotlow(new Series(bars, (b) => b.low), B, B));
  const isPh = pivotHigh.map((v) => gt(v, 0));
  const isPl = pivotLow.map((v) => gt(v, 0));

  const idxBack = bars.map((_b, i) => i - B);
  const highBack = bars.map((_b, i) => at(high, i - B));
  const lowBack = bars.map((_b, i) => at(low, i - B));
  const upperBack = bars.map((_b, i) => Math.max(at(close, i - B), at(open, i - B)));
  const lowerBack = bars.map((_b, i) => Math.min(at(close, i - B), at(open, i - B)));
  const [, idxH1, idxH2, idxH3] = valuewhen(isPh, idxBack, 4);
  const hAt = valuewhen(isPh, highBack, 4);
  const upAt = valuewhen(isPh, upperBack, 4);
  const [, idxL1, idxL2, idxL3] = valuewhen(isPl, idxBack, 4);
  const lAt = valuewhen(isPl, lowBack, 4);
  const loAt = valuewhen(isPl, lowerBack, 4);

  // Candle patterns
  const candle = bars.map((b) => Math.abs(b.high - b.low));
  const body = bars.map((b) => Math.abs(b.open - b.close));
  const bodyPerc = body.map((v, i) => (v / candle[i]) * 100);
  const evnCan: boolean[] = [];
  const bInBar: boolean[] = [];
  const morCan: boolean[] = [];
  const tbc: boolean[] = [];
  const ttc: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const c1 = at(candle, i - 1);
    const c2 = at(candle, i - 2);
    const b1 = at(body, i - 1);
    const b2 = at(body, i - 2);
    evnCan.push(gt(body[i], candle[i] * 0.6) && gt(open[i], close[i]) && lt(b1, c1 * 0.3) && gt(b2, c2 * 0.6)
      && lt(at(open, i - 2), at(close, i - 2)));
    morCan.push(gt(body[i], candle[i] * 0.6) && lt(open[i], close[i]) && lt(b1, c1 * 0.3) && gt(b2, c2 * 0.6)
      && gt(at(open, i - 2), at(close, i - 2)));
    // BInBar and BullInBar are the same expression
    bInBar.push(lt(high[i], at(high, i - 1)) && gt(low[i], at(low, i - 1)) && gt(b1, c1 * 0.4));
    const h1 = at(high, i - 1);
    const l1 = at(low, i - 1);
    const o1 = at(open, i - 1);
    const cl1 = at(close, i - 1);
    const bperc = ((h1 - l1) / 100) * 5;
    const bpercc = ((h1 - l1) / 100) * 60;
    tbc.push(gt(low[i], l1 - bperc) && lt(low[i], l1 + bperc) && gt(close[i], l1 + bpercc) && gt(o1, cl1)
      && lt(cl1 - l1, bperc) && lt(open[i] - low[i], bperc) && gt(bodyPerc[i], 60) && gt(at(bodyPerc, i - 1), 60));
    ttc.push(gt(high[i], h1 - bperc) && lt(high[i], h1 + bperc) && lt(close[i], h1 - bpercc) && lt(o1, cl1)
      && lt(h1 - cl1, bperc) && lt(high[i] - open[i], bperc) && gt(bodyPerc[i], 60) && gt(at(bodyPerc, i - 1), 60));
  }
  const high1 = bars.map((_b, i) => at(high, i - 1));
  const low1 = bars.map((_b, i) => at(low, i - 1));
  const [evnCanHigh] = valuewhen(evnCan, high1, 1);
  const [bInBarHigh] = valuewhen(bInBar, high1, 1);
  const [morCanLow] = valuewhen(morCan, low1, 1);
  const [bullInBarLow] = valuewhen(bInBar, low1, 1);
  const [tTopH] = valuewhen(ttc, bars.map((b, i) => Math.max(b.high, high1[i])), 1);
  const [tBotL] = valuewhen(tbc, bars.map((b, i) => Math.min(b.low, low1[i])), 1);

  const resZones: Zone[] = [];
  const supZones: Zone[] = [];
  const newZone: boolean[] = new Array(n).fill(false);
  const nearRes: boolean[] = new Array(n).fill(false);
  const nearSup: boolean[] = new Array(n).fill(false);

  resetDrawings({ line: MAX_LINES });
  const addZone = (zones: Zone[], css: string, i: number, startIdx: number, zH: number, zL: number) => {
    const tl = line.new(startIdx, zH, i, zH, 'bar_index', 'none', css, 'solid', 1);
    const bl = line.new(startIdx, zL, i, zL, 'bar_index', 'none', css, 'solid', 1);
    linefill.new(tl, bl, String(color.new(css, cfg.ZoneAlpha)));
    zones.push({ top: tl, bot: bl, zH, zL, start: i, wasAway: true });
  };
  const newLabel = (x: number, y: number, text: string, css: string, down: boolean, size: string) => {
    label.new(x, y, text, 'bar_index', 'price', css, down ? 'label_down' : 'label_up', WHITE, size);
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];

    // New resistance zones
    if (isPh[i]) {
      const [h0, h1, h2, h3] = [hAt[0][i], hAt[1][i], hAt[2][i], hAt[3][i]];
      const [, u1, u2, u3] = [upAt[0][i], upAt[1][i], upAt[2][i], upAt[3][i]];
      if (cfg.NoOfPivots === 2 && lt(h0, h1) && gt(h0, u1)) {
        newZone[i] = true;
        addZone(resZones, cfg.ResColor, i, idxH1[i], h1, u1);
      }
      if (cfg.NoOfPivots === 3 && lt(h0, h2) && gt(h0, u2) && lt(h1, h2) && gt(h1, u2)) {
        newZone[i] = true;
        addZone(resZones, cfg.ResColor, i, idxH2[i], h2, u2);
      }
      if (cfg.NoOfPivots === 4 && lt(h0, h3) && gt(h0, u3) && lt(h1, h3) && gt(h1, u3) && lt(h2, h3) && gt(h2, u3)) {
        newZone[i] = true;
        addZone(resZones, cfg.ResColor, i, idxH3[i], h3, u3);
      }
    }
    // New support zones
    if (isPl[i]) {
      const [l0, l1, l2, l3] = [lAt[0][i], lAt[1][i], lAt[2][i], lAt[3][i]];
      // LowerAtPivotl is the body bottom of the pivot before (occurrence 1)
      const [, w1, w2, w3] = [loAt[0][i], loAt[1][i], loAt[2][i], loAt[3][i]];
      if (cfg.NoOfPivots === 2 && gt(l0, l1) && lt(l0, w1)) {
        newZone[i] = true;
        addZone(supZones, cfg.SupColor, i, idxL1[i], w1, l1);
      }
      if (cfg.NoOfPivots === 3 && gt(l0, l2) && lt(l0, w2) && gt(l1, l2) && lt(l1, w2)) {
        newZone[i] = true;
        addZone(supZones, cfg.SupColor, i, idxL2[i], w2, l2);
      }
      if (cfg.NoOfPivots === 4 && gt(l0, l3) && lt(l0, w3) && gt(l1, l3) && lt(l1, w3) && gt(l2, l3) && lt(l2, w3)) {
        newZone[i] = true;
        addZone(supZones, cfg.SupColor, i, idxL3[i], w3, l3);
      }
    }

    // Update the zones (extend / break / expire / proximity / retest), newest first
    const update = (zones: Zone[], isRes: boolean) => {
      for (let k = zones.length - 1; k >= 0; k--) {
        const z = zones[k];
        const age = i - z.start;
        const isBroken = isRes ? gt(b.close, z.zH) : lt(b.close, z.zL);
        const isExpired = cfg.ZoneExpiry > 0 && age > cfg.ZoneExpiry;
        if (isBroken || isExpired) {
          if (cfg.ShowBroken && isBroken) {
            line.set_color(z.top, cfg.BrokenColor);
            line.set_color(z.bot, cfg.BrokenColor);
          }
          zones.splice(k, 1);
          continue;
        }
        line.set_x2(z.top, i);
        line.set_x2(z.bot, i);
        const buf = (z.zH * cfg.ProximityPct) / 100;
        if (gt(b.close, z.zL - buf) && lt(b.close, z.zH + buf)) {
          if (isRes) nearRes[i] = true;
          else nearSup[i] = true;
        }
        const wasAway = z.wasAway;
        if (isRes ? lt(b.close, z.zL) : gt(b.close, z.zH)) z.wasAway = true;
        if (wasAway && ge(b.close, z.zL) && le(b.close, z.zH) && age > 2) {
          if (cfg.ShowRetest) {
            if (isRes) newLabel(i, b.high, '⟳ R Retest', cfg.ResColor, true, 'small');
            else newLabel(i, b.low, '⟳ S Retest', cfg.SupColor, false, 'small');
          }
          z.wasAway = false;
        }
      }
    };
    update(resZones, true);
    update(supZones, false);

    // Patterns, checked against all active zones
    if (cfg.ShowPatterns && i >= 1) {
      const off = (high[i - 1] - low[i - 1]) * 0.6;
      const inZone = (zones: Zone[], v: number) => zones.some((z) => lt(v, z.zH) && gt(v, z.zL));
      const above = high[i - 1] + off;
      const below = low[i - 1] - off;
      if (evnCan[i] && resZones.length > 0 && inZone(resZones, evnCanHigh[i])) {
        newLabel(i - 1, above, 'Evening Star', ORANGE, true, 'normal');
      }
      if (bInBar[i] && resZones.length > 0 && inZone(resZones, bInBarHigh[i])) {
        newLabel(i - 1, above, 'Inside Bar', '#E04305', true, 'normal');
      }
      if (ttc[i] && resZones.length > 0 && inZone(resZones, tTopH[i])) {
        newLabel(i - 1, above, 'Tweezer Top', '#FF00D0', true, 'normal');
      }
      if (morCan[i] && supZones.length > 0 && inZone(supZones, morCanLow[i])) {
        newLabel(i - 1, below, 'Morning Star', ORANGE, false, 'normal');
      }
      if (bInBar[i] && supZones.length > 0 && inZone(supZones, bullInBarLow[i])) {
        newLabel(i - 1, below, 'Inside Bar', '#FF4800', false, 'normal');
      }
      if (tbc[i] && supZones.length > 0 && inZone(supZones, tBotL[i])) {
        newLabel(i - 1, below, 'Tweezer Bottom', '#FF00D0', false, 'normal');
      }
    }
  }
  setDrawingBar(null);

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  // plot(PivotHigh, offset = -Bars): the value of bar i is drawn on bar i - Bars
  const shifted = (v: number[], c: string) => {
    const pts: { time: number; value: number; color: string }[] = [];
    for (let i = B; i < n; i++) pts.push({ time: bars[i - B].time, value: v[i], color: c });
    return pts;
  };
  const lineData = (l: Line): LineDrawingData => ({
    time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color ?? 'transparent'), width: 1,
  });

  const alive = new Set(line.all());

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: shifted(pivotHigh, RED), plot1: shifted(pivotLow, PIVOT_LOW) },
    lines: line.all().map(lineData),
    // a linefill whose line was deleted by the line limit is not drawn
    linefills: linefill.all().filter((f) => alive.has(f.line1) && alive.has(f.line2))
      .map((f) => ({ line1: lineData(f.line1), line2: lineData(f.line2), color: String(f.color) })),
    labels: label.all().map((l) => ({
      time: T(l.x), price: l.y, text: l.text ?? '', color: String(l.color), textColor: WHITE,
      style: l.style as 'label_down' | 'label_up', size: l.size as 'small' | 'normal',
    })),
    alerts: alertStates(alertConditions, bars, [newZone, nearRes, nearSup]),
  };
}

export const BestSupportAndResistanceIndicatorV1 = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  alertConditions,
};
