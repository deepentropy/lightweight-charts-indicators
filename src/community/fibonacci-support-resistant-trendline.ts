/**
 * Fibonacci + Support/Resistant + Trendline (Price action)
 *
 * Pivot highs and lows (left / right bars) are marked with diamonds on the pivot bar. Long setups ("Find entry
 * Long"): when a pivot high is confirmed above the pivot high before it, the script draws an arrow from the latest
 * pivot low to that pivot high, the Fibonacci retracement levels 0, 0.236, 0.382, 0.5, 0.618, 0.786 and 1 of that
 * swing (extended "Extention" bars past the pivot confirmation), a support zone between the previous pivot high and
 * the top of its candle body (with a fill), and, when the previous pivot high is below the one before it, a dotted
 * resistance trendline through those two pivot highs up to the current bar. Labels with the level values sit one
 * bar interval after the current time (they move to the latest setup). Short setups ("Find entry Short", off by
 * default) mirror this on a pivot low below the pivot low before it.
 *
 * alert() calls: when the close of the setup bar is beyond the level chosen in "Set alert ... when price test".
 * The current time (timenow) of the labels comes from the chart context (fallback: the computer clock). At most 500
 * lines and 50 labels are kept.
 *
 * Reference: "Price action as in book: Fibonacci + Support/Resistant + Trendline" by TrendCrypto2022
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @TrendCrypto2022
 */

import {
  ta, color, line, label, linefill, resetDrawings, setDrawingBar, varDrawing, Series,
  type Bar, type IndicatorResult, type InputConfig, type Label, type Line, type MarkerData, type PlotConfig,
  type ShapeConfig,
} from 'oakscriptjs';
import type { AlertCall, LabelData, LineDrawingData, LinefillData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { barInterval, barTime } from '../bar-time';
import { nowOf, type ChartContext } from '../chart-context';

type LongAlert = 'Fibo 0.382' | 'Fibo 0.5' | 'Fibo 0.618' | 'Fibo 0.786' | 'Support Zone' | 'Trendline';
type ShortAlert = 'Fibo 0.382' | 'Fibo 0.5' | 'Fibo 0.618' | 'Fibo 0.786' | 'Resistant Zone' | 'Trendline';

export interface FibonacciSupportResistantTrendlineInputs {
  /** Draw the long setups (pivot high above the one before) */
  buyonly: boolean;
  /** Draw the short setups (pivot low below the one before) */
  sellonly: boolean;
  leftbars: number;
  rightbars: number;
  width_fibo: number;
  width_sup_res: number;
  width_trendline: number;
  /** Bars the Fibonacci levels run past the pivot confirmation */
  extend_fibo: number;
  color_fibo_label: string;
  /** Bars the support / resistance zone runs past the pivot confirmation */
  extend_sup_res: number;
  alert_input: LongAlert;
  alertshort_input: ShortAlert;
}

export const defaultInputs: FibonacciSupportResistantTrendlineInputs = {
  buyonly: true,
  sellonly: false,
  leftbars: 10,
  rightbars: 5,
  width_fibo: 2,
  width_sup_res: 2,
  width_trendline: 2,
  extend_fibo: 5,
  color_fibo_label: '#FFEB3B',
  extend_sup_res: 5,
  alert_input: 'Fibo 0.5',
  alertshort_input: 'Fibo 0.5',
};

export const inputConfig: InputConfig[] = [
  { id: 'buyonly', type: 'bool', title: 'Find entry  Long', defval: true, group: 'Set up Find entry' },
  { id: 'sellonly', type: 'bool', title: 'Find entry Short', defval: false, group: 'Set up Find entry' },
  { id: 'leftbars', type: 'int', title: 'Pivot Detection: Left Bars', defval: 10, min: 1, group: 'Set up Pivot High/Low' },
  { id: 'rightbars', type: 'int', title: 'Pivot Detection: Right Bars', defval: 5, min: 1, group: 'Set up Pivot High/Low' },
  { id: 'width_fibo', type: 'int', title: 'Width Fibonacci levels', defval: 2, min: 1, group: 'Custom Selection', inline: '1' },
  { id: 'width_sup_res', type: 'int', title: 'Width Sup/Res levels', defval: 2, min: 1, group: 'Custom Selection', inline: '2' },
  { id: 'width_trendline', type: 'int', title: 'Width Trendline', defval: 2, min: 1, group: 'Custom Selection' },
  { id: 'extend_fibo', type: 'int', title: 'Extention', defval: 5, min: 1, group: 'Custom Selection', inline: '1' },
  { id: 'color_fibo_label', type: 'color', title: 'Color Labels', defval: '#FFEB3B', group: 'Custom Selection', inline: '1' },
  { id: 'extend_sup_res', type: 'int', title: 'Extention', defval: 5, min: 1, group: 'Custom Selection', inline: '2' },
  {
    id: 'alert_input', type: 'string', title: 'Set alert Long Trade when price test', defval: 'Fibo 0.5', group: 'Set up Alert',
    options: ['Fibo 0.382', 'Fibo 0.5', 'Fibo 0.618', 'Fibo 0.786', 'Support Zone', 'Trendline'],
  },
  {
    id: 'alertshort_input', type: 'string', title: 'Set alert Short Trade when price test', defval: 'Fibo 0.5', group: 'Set up Alert',
    options: ['Fibo 0.382', 'Fibo 0.5', 'Fibo 0.618', 'Fibo 0.786', 'Resistant Zone', 'Trendline'],
  },
];

export const plotConfig: PlotConfig[] = [];

const RED = '#FF5252';
const GREEN = '#4CAF50';
const LIME = '#00E676';
const SILVER = '#B2B5BE';
const AQUA = '#00BCD4';

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Pivot High', style: 'diamond', location: 'abovebar', color: RED, offset: -5 },
  { id: 'shape1', kind: 'shape', title: 'Pivot Low', style: 'diamond', location: 'belowbar', color: GREEN, offset: -5 },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'linefill', 'label'];

export const hasAlertFunction = true;

export const metadata = {
  title: 'Price action as in book: Fibonacci + Support/Resistant + Trendline',
  shortTitle: 'Price action as in book: Fibonacci + Support/Resistant + Trendline',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Fibonacci levels of the labels, in the original order */
const LABEL_LEVELS: Array<[number, string]> = [[0, '0'], [0.236, '0.236'], [0.382, '0.382'], [0.5, '0.5'], [0.618, '0.618'], [0.786, '0.786'], [1, '1']];

/** A swing point at a pivot bar: values read `rightbars` bars back on the confirmation bar */
interface Pivot {
  value: number;
  bar: number;
  /** Top (pivot high) or bottom (pivot low) of the candle body */
  body: number;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FibonacciSupportResistantTrendlineInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; linefills: LinefillData[]; labels: LabelData[]; alertCalls: AlertCall[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const rb = cfg.rightbars;
  const toMs = n > 0 && bars[0].time >= 1e12 ? 1 : 1000;
  const now = nowOf(chart);
  const ph = ta.pivothigh(new Series(bars, (b) => b.high), cfg.leftbars, rb).toArray();
  const pl = ta.pivotlow(new Series(bars, (b) => b.low), cfg.leftbars, rb).toArray();
  // a float used as a condition: na and 0 are false
  const truthy = (v: number | null | undefined) => v !== null && v !== undefined && !Number.isNaN(v) && v !== 0;

  resetDrawings({ line: 500, label: 50 });

  const highs: Pivot[] = [];
  const lows: Pivot[] = [];
  /** ta.valuewhen(cond, src, k): the k-th latest pivot (k = 0: the latest) */
  const at = (list: Pivot[], k: number): Pivot => list[list.length - 1 - k] ?? { value: NaN, bar: NaN, body: NaN };
  // res_x1 := ph ? phbar2 : res_x1[1] ... (the last values carry over)
  let resX1 = NaN, resY1 = NaN, resX2 = NaN, resY2 = NaN;
  let supX1 = NaN, supY1 = NaN, supX2 = NaN, supY2 = NaN;

  const longLabels = LABEL_LEVELS.map(() => varDrawing<Label>());
  const shortLabels = LABEL_LEVELS.map(() => varDrawing<Label>());
  const markers: MarkerData[] = [];
  const alertCalls: AlertCall[] = [];
  const alert = (i: number, message: string) => alertCalls.push({ time: bars[i].time, message, freq: 'once_per_bar' });
  const silver60 = String(color.new(SILVER, 60));
  const fibColours = [String(color.new(RED, 60)), String(color.new('#81c784', 60)), String(color.new(GREEN, 60)),
    String(color.new('#089981', 60)), String(color.new(AQUA, 60))];
  const FIB = [0.236, 0.382, 0.500, 0.618, 0.786];
  const labelBg = String(color.new('#000000', 100));

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const isPh = truthy(ph[i]);
    const isPl = truthy(pl[i]);
    if (isPh) {
      const c = bars[i - rb];
      highs.push({ value: c.high, bar: i - rb, body: gt(c.close, c.open) ? c.close : c.open });
      markers.push({ id: 'shape0', time: bars[i - rb].time, position: 'aboveBar', shape: 'diamond', color: RED });
    }
    if (isPl) {
      const c = bars[i - rb];
      lows.push({ value: c.low, bar: i - rb, body: lt(c.close, c.open) ? c.close : c.open });
      markers.push({ id: 'shape1', time: bars[i - rb].time, position: 'belowBar', shape: 'diamond', color: GREEN });
    }
    const h1 = at(highs, 0), h2 = at(highs, 1), h3 = at(highs, 2);
    const l1 = at(lows, 0), l2 = at(lows, 1), l3 = at(lows, 2);

    if (isPh) {
      resX1 = h2.bar; resY1 = h2.value; resX2 = h3.bar; resY2 = h3.value;
    }
    const resM = (resY2 - resY1) / (resX2 - resX1);
    const resB = resY1 - resM * resX1;
    const resY = resM * i + resB;
    if (isPl) {
      supX1 = l2.bar; supY1 = l2.value; supX2 = l3.bar; supY2 = l3.value;
    }
    const supM = (supY2 - supY1) / (supX2 - supX1);
    const supB = supY1 - supM * supX1;
    const supY = supM * i + supB;

    // distance_x = timenow + math.round(ta.change(time) * 1), xloc.bar_time
    const distanceX = i > 0 ? now + Math.round((b.time - bars[i - 1].time) * toMs * 1) : NaN;

    if (isPh && gt(h1.value, h2.value) && cfg.buyonly) {
      const phv1 = h1.value, plv1 = l1.value;
      const end = h1.bar + rb + cfg.extend_fibo;
      line.new(l1.bar, plv1, h1.bar, phv1, 'bar_index', 'none', LIME, 'arrow_right', 2);
      line.new(l1.bar, phv1, end, phv1, 'bar_index', 'none', silver60, 'solid', cfg.width_fibo);
      FIB.forEach((f, k) => {
        const y = phv1 - (phv1 - plv1) * f;
        line.new(l1.bar, y, end, y, 'bar_index', 'none', fibColours[k], 'solid', cfg.width_fibo);
      });
      line.new(l1.bar, plv1, end, plv1, 'bar_index', 'none', silver60, 'solid', cfg.width_fibo);
      const zoneEnd = h1.bar + rb + cfg.extend_sup_res;
      const lime20 = String(color.new(LIME, 20));
      const p1 = line.new(h2.bar, h2.body, zoneEnd, h2.body, 'bar_index', 'none', lime20, 'solid', cfg.width_sup_res);
      const p2 = line.new(h2.bar, h2.value, zoneEnd, h2.value, 'bar_index', 'none', lime20, 'solid', cfg.width_sup_res);
      linefill.new(p1, p2, String(color.new(LIME, 85)));
      if (lt(h2.value, h3.value)) {
        line.new(h3.bar, h3.value, h2.bar, h2.value, 'bar_index', 'none', RED, 'dotted', cfg.width_trendline);
        line.new(h2.bar, h2.value, i, resY, 'bar_index', 'none', RED, 'dotted', cfg.width_trendline);
      }
      const a = cfg.alert_input;
      if (lt(b.close, phv1 - (phv1 - plv1) * 0.382) && a === 'Fibo 0.382') alert(i, 'Fibo 0.382');
      if (lt(b.close, phv1 - (phv1 - plv1) * 0.500) && a === 'Fibo 0.5') alert(i, 'Fibo 0.5');
      if (lt(b.close, phv1 - (phv1 - plv1) * 0.618) && a === 'Fibo 0.618') alert(i, 'Fibo 0.618');
      if (lt(b.close, phv1 - (phv1 - plv1) * 0.786) && a === 'Fibo 0.786') alert(i, 'Fibo 0.786');
      if (lt(b.close, h2.value) && a === 'Support Zone') alert(i, 'Support Zone');
      if (lt(b.close, resY + resY * 0.005) && a === 'Trendline') alert(i, 'Trendline');
      LABEL_LEVELS.forEach(([f, text], k) => {
        const v = longLabels[k];
        if (v.value) label.delete(v.value);
        v.value = label.new(distanceX, phv1 - (phv1 - plv1) * f, text, 'bar_time', 'price', labelBg, 'label_left',
          cfg.color_fibo_label, 'small');
      });
    }

    if (isPl && lt(l1.value, l2.value) && cfg.sellonly) {
      const phv1 = h1.value, plv1 = l1.value;
      const end = l1.bar + rb + cfg.extend_fibo;
      line.new(h1.bar, phv1, l1.bar, plv1, 'bar_index', 'none', RED, 'arrow_right', 2);
      line.new(h1.bar, plv1, end, plv1, 'bar_index', 'none', silver60, 'solid', cfg.width_fibo);
      FIB.forEach((f, k) => {
        const y = plv1 - (plv1 - phv1) * f;
        line.new(l1.bar, y, end, y, 'bar_index', 'none', fibColours[k], 'solid', cfg.width_fibo);
      });
      line.new(h1.bar, phv1, end, phv1, 'bar_index', 'none', silver60, 'solid', cfg.width_fibo);
      const zoneEnd = l1.bar + rb + cfg.extend_sup_res;
      const red20 = String(color.new(RED, 20));
      const p1 = line.new(l2.bar, l2.body, zoneEnd, l2.body, 'bar_index', 'none', red20, 'solid', cfg.width_sup_res);
      const p2 = line.new(l2.bar, l2.value, zoneEnd, l2.value, 'bar_index', 'none', red20, 'solid', cfg.width_sup_res);
      linefill.new(p1, p2, String(color.new(RED, 85)));
      if (gt(l2.value, l3.value)) {
        line.new(l3.bar, l3.value, l2.bar, l2.value, 'bar_index', 'none', LIME, 'dotted', cfg.width_trendline);
        line.new(l2.bar, l2.value, i, supY, 'bar_index', 'none', LIME, 'dotted', cfg.width_trendline);
      }
      const a = cfg.alertshort_input;
      if (gt(b.close, plv1 - (plv1 - phv1) * 0.382) && a === 'Fibo 0.382') alert(i, 'Fibo 0.382');
      if (gt(b.close, plv1 - (plv1 - phv1) * 0.500) && a === 'Fibo 0.5') alert(i, 'Fibo 0.5');
      if (gt(b.close, plv1 - (plv1 - phv1) * 0.618) && a === 'Fibo 0.618') alert(i, 'Fibo 0.618');
      if (gt(b.close, plv1 - (plv1 - phv1) * 0.786) && a === 'Fibo 0.786') alert(i, 'Fibo 0.786');
      if (gt(b.close, l2.value) && a === 'Resistant Zone') alert(i, 'Resistant Zone');
      if (gt(b.close, supY - supY * 0.005) && a === 'Trendline') alert(i, 'Trendline');
      LABEL_LEVELS.forEach(([f, text], k) => {
        const v = shortLabels[k];
        if (v.value) label.delete(v.value);
        v.value = label.new(distanceX, plv1 - (plv1 - phv1) * f, text, 'bar_time', 'price', labelBg, 'label_left',
          cfg.color_fibo_label, 'small');
      });
    }
  }
  setDrawingBar(null);

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  // a line with an na coordinate (no pivot yet) is not drawn
  const drawn = (l: Line) => ![l.x1, l.y1, l.x2, l.y2].some((v) => Number.isNaN(v));
  const lineData = (l: Line): LineDrawingData => ({
    time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color), width: l.width,
    ...(l.style && l.style !== 'solid' ? { style: l.style } : {}),
  });
  const lines = line.all().filter(drawn).map(lineData);
  const linefills: LinefillData[] = linefill.all()
    .filter((f) => drawn(f.line1) && drawn(f.line2))
    .map((f) => ({ line1: lineData(f.line1), line2: lineData(f.line2), color: String(f.color) }));
  // xloc.bar_time labels: the time is in ms, the result in the unit of the bar times
  const labels: LabelData[] = label.all()
    .filter((l) => !Number.isNaN(l.x) && !Number.isNaN(l.y))
    .map((l) => ({
      time: l.x / toMs, xloc: 'bar_time', price: l.y, text: l.text ?? '', color: labelBg,
      textColor: String(l.textcolor), style: 'label_left', size: 'small',
    }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    lines,
    linefills,
    labels,
    alertCalls,
  };
}

export const FibonacciSupportResistantTrendline = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  shapeConfig,
  drawingKinds,
  hasAlertFunction,
};
