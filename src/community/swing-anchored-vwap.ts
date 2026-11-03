/**
 * Swing Anchored Vwap [BigBeluga]
 *
 * Two VWAPs anchored at swings: a VWAP of the highs restarts on the bar after a swing high (the high of the bar
 * before equals the highest high of Length bars and the current high is lower), a VWAP of the lows restarts on the
 * bar after a swing low. The trend turns up when the high equals the highest high of Length bars and down when the low
 * equals the lowest low.
 *
 * Drawings: the active VWAP (the low VWAP in an up trend, from the last swing low; the high VWAP in a down trend, from
 * the last swing high) is drawn again on every bar as a polyline with a label at its swing bar, an arrow line 5 bars to
 * the right and a label with its value. On each trend change the VWAP of the other side, from its swing to the current
 * bar, stays on the chart as a thinner, lighter polyline with a label at its swing (at most 50 labels and 100
 * polylines, the platform limits).
 *
 * Chart context: the value label text colour is `chart.fg_color` (`foregroundColorOf`).
 *
 * Reference: "Swing Anchored Vwap [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, Series, color, str, label, line, polyline, chartPoint, resetDrawings, setDrawingBar, drawingOutputs, varDrawing,
  type Bar, type ChartPoint, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig, type Polyline,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { foregroundColorOf, type ChartContext } from '../chart-context';

export interface SwingAnchoredVwapInputs {
  length: number;
  /** Colour of the VWAP of the lows */
  lVwapCol: string;
  /** Colour of the VWAP of the highs */
  hVwapCol: string;
  /** Width of the VWAPs kept on trend changes */
  width1: number;
}

export const defaultInputs: SwingAnchoredVwapInputs = {
  length: 50,
  lVwapCol: '#00E676',
  hVwapCol: '#2962FF',
  width1: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 50 },
  { id: 'lVwapCol', type: 'color', title: '', defval: '#00E676', inline: 'col' },
  { id: 'hVwapCol', type: 'color', title: '', defval: '#2962FF', inline: 'col' },
  { id: 'width1', type: 'int', title: 'Vwap Line Width', defval: 1 },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'polyline'];

export const metadata = {
  title: 'Swing Anchored Vwap [BigBeluga]',
  shortTitle: 'Swing Anchored Vwap [BigBeluga]',
  overlay: true,
};

/** Pine float comparisons: a == b within 1e-10, a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<SwingAnchoredVwapInputs> = {}, chart?: ChartContext): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const fg = foregroundColorOf(chart);
  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  const num = (v: number | null | undefined) => (v === null || v === undefined ? NaN : v);
  const h = ta.highest(Series.fromBars(bars, 'high'), cfg.length).toArray().map(num);
  const l = ta.lowest(Series.fromBars(bars, 'low'), cfg.length).toArray().map(num);

  // Anchors of the two VWAPs: high[1] == h[1] and high < h, low[1] == l[1] and low > l
  const anchorH = bars.map((_, i) => i > 0 && eq(high[i - 1], h[i - 1]) && lt(high[i], h[i]));
  const anchorL = bars.map((_, i) => i > 0 && eq(low[i - 1], l[i - 1]) && lt(l[i], low[i]));
  const vol = Series.fromBars(bars, 'volume');
  const hVwap = ta.vwap(Series.fromBars(bars, 'high'), vol, Series.fromArray(bars, anchorH.map(Number))).toArray().map(num);
  const lVwap = ta.vwap(Series.fromBars(bars, 'low'), vol, Series.fromArray(bars, anchorL.map(Number))).toArray().map(num);

  resetDrawings({ polyline: 100 });
  // `var` objects of draw_active_vwap(): deleted and drawn again on every bar
  const poly = varDrawing<Polyline>();
  const lbl = varDrawing<Label>();
  const lbl1 = varDrawing<Label>();
  const lineVar = varDrawing<Line>();

  let trend = false; // var trend = bool(na): false in v6
  let prevTrend = false;
  let highIndex = NaN;
  let lowIndex = NaN;
  // src = trend ? high : low inside draw_active_vwap(): its history (one value per bar)
  const src = new Array<number>(n).fill(NaN);
  const lineColH = String(color.new(cfg.hVwapCol, 30));
  const lineColL = String(color.new(cfg.lVwapCol, 40));
  const labColH = String(color.new(cfg.hVwapCol, 40));
  const labColL = String(color.new(cfg.lVwapCol, 40));

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    if (anchorH[i]) highIndex = i - 1;
    if (anchorL[i]) lowIndex = i - 1;
    if (eq(high[i], h[i])) trend = true;
    if (eq(low[i], l[i])) trend = false;

    // draw_active_vwap(trend)
    src[i] = trend ? high[i] : low[i];
    const index = trend ? lowIndex : highIndex;
    const vwapColor = trend ? cfg.lVwapCol : cfg.hVwapCol;
    const stl = trend ? 'label_up' : 'label_down';
    const vwapArr = trend ? lVwap : hVwap;
    if (poly.value) polyline.delete(poly.value);
    if (lbl.value) label.delete(lbl.value);
    if (lbl1.value) label.delete(lbl1.value);
    if (lineVar.value) line.delete(lineVar.value);
    const cp: ChartPoint[] = [];
    // for i = 0 to bar_index - index: no loop while index is na
    const last = i - index;
    for (let k = 0; k <= last; k++) {
      const v = vwapArr[i - k];
      if (k === 0) {
        lineVar.value = line.new(i, v, i + 5, v, 'bar_index', 'none', vwapColor, 'arrow_right', 2);
        lbl1.value = label.new(i + 5, v, str.tostring(v, '###,###,###.##'), 'bar_index', 'price', '#00000000', 'label_left', fg);
      }
      if (k === last) lbl.value = label.new(i - k, src[i - k], '', 'bar_index', 'price', vwapColor, stl);
      cp.push(chartPoint.from_index(i - k, v));
    }
    poly.value = polyline.new(cp, false, false, 'bar_index', vwapColor, undefined, undefined, 2);

    // History VWAPs
    if (trend && trend !== prevTrend) {
      const pts: ChartPoint[] = [];
      const end = i - highIndex;
      for (let k = 0; k <= end; k++) {
        if (k === end) label.new(i - k, high[i - k], '', 'bar_index', 'price', labColH, 'label_down');
        pts.push(chartPoint.from_index(i - k, hVwap[i - k]));
      }
      polyline.new(pts, false, false, 'bar_index', lineColH, undefined, undefined, cfg.width1);
    }
    if (!trend && trend !== prevTrend) {
      const pts: ChartPoint[] = [];
      const end = i - lowIndex;
      for (let k = 0; k <= end; k++) {
        if (k === end) label.new(i - k, low[i - k], '', 'bar_index', 'price', labColL, 'label_up');
        pts.push(chartPoint.from_index(i - k, lVwap[i - k]));
      }
      polyline.new(pts, false, false, 'bar_index', lineColL, undefined, undefined, cfg.width1);
    }
    prevTrend = trend;
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
  };
}

export const SwingAnchoredVwap = { calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds };
