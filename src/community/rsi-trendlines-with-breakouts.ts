/**
 * RSI Trendlines with Breakouts [HG]
 *
 * Trendlines on the RSI, and their breakouts.
 * - RSI of the source (on another timeframe when "Timeframe" is set: the RSI of the bars of that timeframe, with
 *   lookahead, so each chart bar shows the value of its own period).
 * - Pivots: pivot lows and pivot highs of the RSI (1 bar on the left, "Lookback Range" bars on the right), each kept
 *   until the next one (fixnan).
 * - Lines: when a pivot low is above the pivot low before it (a pivot high below the one before), a solid line joins
 *   the two pivots, but only when no RSI value of the bars from the new pivot to the current bar is on the other
 *   side of the line. A dashed trendline continues it with the same slope up to the current bar.
 * - Breakouts: an RSI more than "RSI Difference" below the line of the lows (above the line of the highs) ends the
 *   trendline: the solid line is extended to the break, a copy of it stays on the chart, and a "Br" ("Break")
 *   label marks the break at the line value. With "Repainting" off a break needs a closed bar.
 * - Levels at 70 (Overbought) and 30 (Oversold).
 *
 * The lines come from the SimpleTrendlines library of the same author (functions new, drawLine and drawTrendline,
 * ported in this file). Each use of the library keeps two lines (a `var` line pair) and its own history; at most
 * 500 lines and 500 labels are kept (drawing registry of oakscriptjs). Alerts (alertcondition, `alerts` of the
 * result): a new trendline and a breakout, for the lows and the highs.
 * A timeframe below the chart timeframe needs lower-timeframe bars: the port throws an Error for it.
 *
 * Reference: "RSI Trendlines with Breakouts [HG]" by HoanGhetti
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HoanGhetti
 */

import {
  ta, line, label, color, Series, timeframe, getSourceSeries, resetDrawings, setDrawingBar, varDrawing,
  type Bar, type IndicatorResult, type InputConfig, type Line, type PlotConfig, type SourceType,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import type { LabelData, LineDrawingData, PineSize } from '../types';
import { barTime } from '../bar-time';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface RsiTrendlinesWithBreakoutsInputs {
  /** Timeframe of the RSI ('' = the chart timeframe) */
  timeframe: string;
  /** Bars on the right of a pivot */
  pLen: number;
  rLen: number;
  rSrc: SourceType;
  repaint: 'On' | 'Off: Bar Confirmation';
  rsiDiff: number;
  rsiCol: string;
  width: number;
  lblType: 'Full' | 'Simple';
  lblSize: 'huge' | 'large' | 'normal' | 'small' | 'tiny';
  pLowCol: string;
  pHighCol: string;
  override: boolean;
  overCol: string;
}

export const defaultInputs: RsiTrendlinesWithBreakoutsInputs = {
  timeframe: '',
  pLen: 4,
  rLen: 14,
  rSrc: 'close',
  repaint: 'On',
  rsiDiff: 3,
  rsiCol: '#2962FF',
  width: 2,
  lblType: 'Simple',
  lblSize: 'small',
  pLowCol: '#FF5252',
  pHighCol: '#089981',
  override: false,
  overCol: '#FFFFFF',
};

export const inputConfig: InputConfig[] = [
  { id: 'timeframe', type: 'timeframe', title: 'Timeframe', defval: '', group: 'Timeframe' },
  {
    id: 'pLen', type: 'int', title: 'Lookback Range', defval: 4, min: 1, group: 'Trendline Settings',
    tooltip: 'How many bars to determine when a swing high/low is detected.',
  },
  { id: 'rLen', type: 'int', title: 'RSI Length', defval: 14, min: 1, group: 'Trendline Settings' },
  { id: 'rSrc', type: 'source', title: 'RSI Source', defval: 'close', group: 'Trendline Settings' },
  {
    id: 'repaint', type: 'string', title: 'Repainting', defval: 'On', options: ['On', 'Off: Bar Confirmation'],
    group: 'Conditions', tooltip: 'Bar Confirmation: Generates alerts when candle closes. (1 Candle Later)',
  },
  {
    id: 'rsiDiff', type: 'int', title: 'RSI Difference', defval: 3, group: 'Conditions',
    tooltip: 'The difference between the current RSI value and the breakout value.\n\nHow much higher in value should the current RSI be compared to the breakout value in order to detect a breakout?',
  },
  { id: 'rsiCol', type: 'color', title: 'RSI Color', defval: '#2962FF', group: 'Styling' },
  { id: 'width', type: 'int', title: 'Line Width', defval: 2, min: 1, group: 'Styling' },
  { id: 'lblType', type: 'string', title: 'Label Type', defval: 'Simple', options: ['Full', 'Simple'], group: 'Styling' },
  {
    id: 'lblSize', type: 'string', title: 'Label Size', defval: 'small',
    options: ['huge', 'large', 'normal', 'small', 'tiny'], group: 'Styling',
  },
  { id: 'pLowCol', type: 'color', title: 'Pivot Low', defval: '#FF5252', group: 'Styling', inline: 'col' },
  { id: 'pHighCol', type: 'color', title: 'Pivot High', defval: '#089981', group: 'Styling', inline: 'col' },
  { id: 'override', type: 'bool', title: 'Override Text Color', defval: false, group: 'Styling', inline: 'override' },
  { id: 'overCol', type: 'color', title: ' ', defval: '#FFFFFF', group: 'Styling', inline: 'override' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Relative Strength Index', color: '#2962FF', lineWidth: 2 },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'RSI Trendlines with Breakouts [HG]',
  shortTitle: 'RSI Trendlines with Breakouts [HG]',
  overlay: false,
};

/** indicator(max_lines_count = 500, max_labels_count = 500) */
const MAX_LINES = 500;
const MAX_LABELS = 500;

/** Pine float comparisons: a == b within 1e-10, a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !lt(a, b);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !gt(a, b);
/** A float used as a condition (v5): na and 0 are false */
const truthy = (x: number) => !Number.isNaN(x) && x !== 0;

/** ta.change(x) of one call site: x - x[1] */
class Change {
  private prev = NaN;
  next(x: number): number {
    const d = x - this.prev;
    this.prev = x;
    return d;
  }
}

/** ta.barssince(cond) of one call site */
class BarsSince {
  private last = NaN;
  next(i: number, cond: boolean): number {
    if (cond) this.last = i;
    return i - this.last;
  }
}

/** One use of the library: its `var` line pair and the history of its drawLine() call */
class Trendline {
  readonly start = varDrawing<Line>();
  readonly trend = varDrawing<Line>();
  savedSlope = NaN;
  savedY1 = NaN;
  savedY2 = NaN;
  readonly y1Change = new Change();
  readonly y1Since = new BarsSince();

  constructor() {
    // var line l1 = line.new(na, na, na, na), var line l2 = line.new(na, na, na, na)
    this.start.value = line.new(NaN, NaN, NaN, NaN);
    this.trend.value = line.new(NaN, NaN, NaN, NaN);
  }

  get startline(): Line { return this.start.value as Line; }
  get trendline(): Line { return this.trend.value as Line; }
}

/** The Trendline object of a bar: settings and values (new on every bar), with the lines of its use */
interface TrendlineBar {
  tl: Trendline;
  xAxis: number;
  offset: number;
  strictMode: boolean;
  strictType: number;
  slope: number;
  x1: number;
  x2: number;
  changeInX: number;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiTrendlinesWithBreakoutsInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { labels: LabelData[]; lines: LineDrawingData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const pLen = Math.trunc(cfg.pLen);
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : (v as number)));
  const close = bars.map((b) => b.close);
  const lblText = cfg.lblType === 'Simple' ? 'Br' : 'Break';
  const repaint = cfg.repaint === 'On';

  // rsi_v = ta.rsi(input_rSrc, input_rLen)
  // rsi = input_timeframe == '' ? rsi_v : request.security(syminfo.tickerid, input_timeframe, rsi_v, lookahead_on)
  let rsi = A(ta.rsi(getSourceSeries(bars, cfg.rSrc), cfg.rLen));
  const tf = cfg.timeframe.trim();
  if (tf !== '') {
    const chartTf = chartTimeframe(bars, chart);
    const secs = timeframe.in_seconds(tf);
    const chartSecs = chartTf === '' ? NaN : timeframe.in_seconds(chartTf);
    if (secs < chartSecs) {
      throw new Error('RSI Trendlines with Breakouts: a timeframe below the chart timeframe needs lower-timeframe bars, which this port does not have.');
    }
    if (secs !== chartSecs) {
      const sec = higherTimeframeBars(bars, tf, chart);
      const htfRsi = A(ta.rsi(getSourceSeries(sec.htf, cfg.rSrc), cfg.rLen));
      // lookahead_on: the value of the bar of the timeframe that holds the chart bar
      rsi = sec.group.map((g) => htfRsi[g]);
    }
  }

  const fixnan = (v: number[]) => {
    let last = NaN;
    return v.map((x) => (Number.isNaN(x) ? last : (last = x)));
  };
  const rsiSeries = Series.fromArray(bars, rsi);
  const pl = fixnan(A(ta.pivotlow(rsiSeries, 1, pLen)));
  const ph = fixnan(A(ta.pivothigh(rsiSeries, 1, pLen)));

  resetDrawings({ line: MAX_LINES, label: MAX_LABELS });

  /** tl.new(x_axis, offset, strictMode = true, strictType): the Trendline of the bar */
  const newTrendline = (tl: Trendline, i: number, xAxis: number, offset: number, strictType: number): TrendlineBar => {
    if (gt(strictType, 1) || lt(strictType, 0)) throw new Error('strictType must be a value of 0 or 1.');
    if (offset < 1) throw new Error('Offset must be over 0 in order to use strictMode.');
    return {
      tl, xAxis, offset, strictMode: true, strictType, slope: NaN,
      x1: i - (xAxis + offset), x2: i - offset, changeInX: NaN,
    };
  };

  /** method drawLine(this, condition, y1, y2, src) with strictMode = true and src = rsi */
  const drawLine = (t: TrendlineBar, i: number, condition: boolean, y1: number, y2: number) => {
    const { tl } = t;
    if (condition) {
      t.slope = (y2 - y1) / t.xAxis;
      let valid = false;
      // na(src) reads the current value of the source: close[j] then
      const useClose = Number.isNaN(rsi[i]);
      for (let k = 0; k <= t.offset; k++) {
        const j = t.offset - k;
        const v = i - j >= 0 ? (useClose ? close[i - j] : rsi[i - j]) : NaN;
        const level = y2 + t.slope * k;
        if (t.strictType === 0 ? ge(v, level) : le(v, level)) {
          valid = true;
        } else {
          valid = false;
          break;
        }
      }
      if (valid) {
        line.set_xy1(tl.startline, t.x1, y1);
        line.set_xy2(tl.startline, t.x2, y2);
        tl.savedSlope = (line.get_y2(tl.startline) - line.get_y1(tl.startline)) / t.xAxis;
        tl.savedY1 = line.get_y1(tl.startline);
        tl.savedY2 = line.get_y2(tl.startline);
      }
    }
    t.slope = tl.savedSlope;
    t.changeInX = tl.y1Since.next(i, truthy(tl.y1Change.next(line.get_y1(tl.startline)))) + t.offset;
  };

  /** method drawTrendline(this, condition) */
  const drawTrendline = (t: TrendlineBar, i: number, condition: boolean) => {
    if (!condition) return;
    const { startline, trendline } = t.tl;
    line.set_xy1(trendline, line.get_x2(startline), line.get_y2(startline));
    line.set_xy2(trendline, i, line.get_y2(startline) + t.slope * t.changeInX);
  };

  // One use of pivot() / breakout() per call of the script: its own history
  interface PivotSite { tl: Trendline; change: Change; changes: Array<{ bar: number; pivot: number }> }
  const pivotSite = (): PivotSite => ({ tl: new Trendline(), change: new Change(), changes: [] });
  interface BreakoutSite { hasCrossed: boolean; y1Change: Change }
  const breakoutSite = (): BreakoutSite => ({ hasCrossed: false, y1Change: new Change() });

  /** pivot(pType) */
  const pivot = (site: PivotSite, i: number, pType: number): TrendlineBar => {
    const isPl = eq(pType, pl[i]);
    const p = isPl ? pl[i] : ph[i];
    const changed = truthy(site.change.next(p));
    if (changed) site.changes.unshift({ bar: i, pivot: p });
    const at = (k: number) => site.changes[k];
    // xAxis = ta.valuewhen(ta.change(pivot), bar_index, 0) - ta.valuewhen(ta.change(pivot), bar_index, 1)
    const xAxis = at(0) && at(1) ? at(0).bar - at(1).bar : NaN;
    const prevPivot = at(1) ? at(1).pivot : NaN;
    const pivotCond = changed && (isPl ? gt(p, prevPivot) : lt(p, prevPivot));
    const data = newTrendline(site.tl, i, xAxis, pLen, isPl ? 0 : 1);
    drawLine(data, i, pivotCond, prevPivot, p);
    return data;
  };

  const lowLabelColor = String(color.new(cfg.pLowCol, 50));
  const highLabelColor = String(color.new(cfg.pHighCol, 50));
  const lowTextColor = cfg.override ? cfg.overCol : cfg.pLowCol;
  const highTextColor = cfg.override ? cfg.overCol : cfg.pHighCol;

  /** breakout(this, pType) */
  const breakout = (site: BreakoutSite, t: TrendlineBar, i: number, pType: number): boolean => {
    const { startline, trendline } = t.tl;
    if (truthy(site.y1Change.next(line.get_y1(startline)))) site.hasCrossed = false;
    drawTrendline(t, i, !site.hasCrossed);
    const isPl = eq(pType, pl[i]);
    const y2 = line.get_y2(trendline);
    const condType = (isPl ? lt(rsi[i], y2 - cfg.rsiDiff) : gt(rsi[i], y2 + cfg.rsiDiff)) && !site.hasCrossed;
    const confirmed = i < n - 1 || lastBarConfirmedOf(chart);
    const condition = repaint ? condType : condType && confirmed;
    if (condition) {
      site.hasCrossed = true;
      line.set_xy2(startline, line.get_x2(trendline), line.get_y2(trendline));
      line.set_xy2(trendline, NaN, NaN);
      line.copy(startline);
      label.new(
        i, line.get_y2(startline), lblText, 'bar_index', 'price', isPl ? lowLabelColor : highLabelColor,
        isPl ? 'label_lower_left' : 'label_upper_left', isPl ? lowTextColor : highTextColor, cfg.lblSize,
      );
    }
    return site.hasCrossed;
  };

  /** method style(this, col) */
  const style = (t: TrendlineBar, col: string) => {
    const { startline, trendline } = t.tl;
    line.set_color(startline, col);
    line.set_width(startline, cfg.width);
    line.set_color(trendline, col);
    line.set_width(trendline, cfg.width);
    line.set_style(trendline, 'dashed');
  };

  const newLowFlags: boolean[] = [], lowBreakFlags: boolean[] = [];
  const newHighFlags: boolean[] = [], highBreakFlags: boolean[] = [];
  try {
    setDrawingBar(0, n === 1);
    // creation order of the `var` lines on the first bar: pivot(pl), then pivot(ph)
    const plSite = pivotSite();
    const phSite = pivotSite();
    const cuSite = breakoutSite();
    const coSite = breakoutSite();
    let cuPrev = false;
    let coPrev = false;
    const plY1Change = new Change();
    const phY1Change = new Change();

    for (let i = 0; i < n; i++) {
      setDrawingBar(i, i === n - 1);
      const plData = pivot(plSite, i, pl[i]);
      const phData = pivot(phSite, i, ph[i]);
      style(plData, cfg.pLowCol);
      style(phData, cfg.pHighCol);
      const cu = breakout(cuSite, plData, i, pl[i]);
      const co = breakout(coSite, phData, i, ph[i]);

      // alertcondition(ta.change(plData.lines.startline.get_y1()), 'New Pivot Low Trendline') ...
      newLowFlags.push(truthy(plY1Change.next(line.get_y1(plData.tl.startline))));
      lowBreakFlags.push(cu && !cuPrev);
      newHighFlags.push(truthy(phY1Change.next(line.get_y1(phData.tl.startline))));
      highBreakFlags.push(co && !coPrev);
      cuPrev = cu;
      coPrev = co;
    }
  } finally {
    setDrawingBar(null);
  }

  // xloc.bar_index drawings; one with an na coordinate is not drawn
  const T = (x: number) => barTime(bars, x);
  const lines: LineDrawingData[] = line.all()
    .filter((l) => [l.x1, l.y1, l.x2, l.y2].every((v) => !Number.isNaN(v)))
    .map((l) => ({
      time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color), width: l.width,
      ...(l.style && l.style !== 'solid' ? { style: l.style as LineDrawingData['style'] } : {}),
    }));
  const labels: LabelData[] = label.all()
    .filter((l) => !Number.isNaN(l.x) && !Number.isNaN(l.y))
    .map((l) => ({
      time: T(l.x), price: l.y, text: l.text ?? '', color: String(l.color), textColor: String(l.textcolor),
      style: l.style as LabelData['style'], size: l.size as PineSize,
    }));
  resetDrawings();

  const value = rsi.map((v, i) => ({ time: bars[i].time, value: Number.isFinite(v) ? v : NaN }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
    plots: { plot0: value.map((p) => ({ ...p, color: cfg.rsiCol })) },
    hlines: [
      { id: 'hline0', value: 70, options: { title: 'Overbought', color: cfg.pHighCol, linestyle: 'dotted', linewidth: 1 } },
      { id: 'hline1', value: 30, options: { title: 'Oversold', color: cfg.pLowCol, linestyle: 'dotted', linewidth: 1 } },
    ],
    lines,
    labels,
    alerts: alertStates(alertConditions, bars, [newLowFlags, lowBreakFlags, newHighFlags, highBreakFlags]),
  };
}

/** The original's alertconditions (no message: the default one) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'New Pivot Low Trendline', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Pivot Low Breakout', message: 'Alert Fired!' },
  { id: 'alert2', title: 'New Pivot High Trendline', message: 'Alert Fired!' },
  { id: 'alert3', title: 'Pivot High Breakout', message: 'Alert Fired!' },
];

export const RsiTrendlinesWithBreakouts = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  drawingKinds,
};
