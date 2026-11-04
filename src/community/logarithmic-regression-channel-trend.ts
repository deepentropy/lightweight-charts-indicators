/**
 * Logarithmic Regression Channel-Trend [BigBeluga]
 *
 * A linear regression of the log of the close over "Lookback Period" bars (x = 1 for the current bar, length for the
 * oldest): "Log Regression" is exp(intercept), the fitted value of the current bar, and the start of the fit is
 * exp(intercept + slope * length). The line is coloured by its direction against its value 3 bars back; the band
 * between the two is filled with a gradient of that change (from its 200-bar lowest to its 200-bar highest). A cross
 * mark is drawn when the change crosses 0 (on closed bars).
 *
 * The channel is drawn with lines from "Channel Length" bars back to the current bar, from the start of the fit to its
 * end: the dashed mid line, and the outer lines at +-(width + 0.3) standard deviations of the close (width 3, coloured
 * by the channel direction, end above or below the start) with filled zones down to the inner lines at +-width
 * deviations (no colour). A label at the start of the lower line shows "UP" / "DN", a table the slope (x 100) and the
 * two directions. The mid line, the cross marks and the table use the chart foreground colour, the table border the
 * background colour (chart context).
 *
 * Reference: "Logarithmic Regression Channel-Trend [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, color, str, line, label, linefill, table, Series, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type Bar, type FillConfig, type IndicatorResult, type InputConfig, type Label, type Line, type MarkerData,
  type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import { backgroundColorOf, foregroundColorOf, lastBarConfirmedOf, type ChartContext } from '../chart-context';
import type { StudyDrawingKind } from '../style-outputs';

export interface LogarithmicRegressionChannelTrendInputs {
  /** Bars of the regression and of the standard deviation */
  length: number;
  /** Channel width (standard deviations) */
  channel_width: number;
  /** Bars back of the start of the channel lines */
  channel_len: number;
  /** Draw the mid line */
  mid_disp: boolean;
  /** Fill the band between the line and its value 3 bars back */
  fill_band: boolean;
  /** Up colour */
  col1: string;
  /** Down colour */
  col2: string;
}

export const defaultInputs: LogarithmicRegressionChannelTrendInputs = {
  length: 100,
  channel_width: 1.5,
  channel_len: 100,
  mid_disp: true,
  fill_band: true,
  col1: '#21dfac',
  col2: '#df216d',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Period', defval: 100 },
  { id: 'channel_width', type: 'float', title: 'Channel Width', defval: 1.5, step: 0.1 },
  { id: 'channel_len', type: 'int', title: 'Channel Length', defval: 100 },
  { id: 'mid_disp', type: 'bool', title: 'Mid Line', defval: true, inline: 's' },
  { id: 'fill_band', type: 'bool', title: 'Fill Band', defval: true, inline: 's' },
  { id: 'col1', type: 'color', title: '', defval: '#21dfac', inline: 's1' },
  { id: 'col2', type: 'color', title: '', defval: '#df216d', inline: 's1' },
];

const FG = foregroundColorOf();

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Log Regression', color: '#21dfac', lineWidth: 2 },
  { id: 'plot1', title: 'Plot', color: '#21dfac', lineWidth: 1, display: 'none' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Plots Background' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Up', style: 'xcross', location: 'absolute', color: FG, size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Dn', style: 'xcross', location: 'absolute', color: FG, size: 'tiny' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'linefill', 'label', 'table'];

export const metadata = {
  title: 'Logarithmic Regression Channel-Trend [BigBeluga]',
  shortTitle: 'LogReg Channel-Trend [BigBeluga]',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

/** Pine `na` as a colour argument */
const NA_COLOR = null as unknown as string;

type Pt = { time: number; value: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<LogarithmicRegressionChannelTrendInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const { length, channel_width: width, channel_len: chLen, col1, col2 } = cfg;
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);
  const lastConfirmed = lastBarConfirmedOf(chart);

  const close = bars.map((b) => b.close);
  const logs = close.map((c) => Math.log(c));
  const deviation = ta.stdev(new Series(bars, (b) => b.close), length).toArray().map((v) => v ?? NaN);

  // f_log_regression(close, length): src[i] before the first bar is na
  const slope: number[] = new Array(n).fill(NaN);
  const start: number[] = new Array(n).fill(NaN);
  const end: number[] = new Array(n).fill(NaN);
  for (let b = 0; b < n; b++) {
    let sumX = 0.0;
    let sumY = 0.0;
    let sumXSqr = 0.0;
    let sumXY = 0.0;
    for (let i = 0; i <= length - 1; i++) {
      const val = b - i >= 0 ? logs[b - i] : NaN;
      const per = i + 1.0;
      sumX += per;
      sumY += val;
      sumXSqr += per * per;
      sumXY += val * per;
    }
    const s = (length * sumXY - sumX * sumY) / (length * sumXSqr - sumX * sumX);
    const average = sumY / length;
    const intercept = average - (s * sumX) / length + s;
    slope[b] = s;
    start[b] = Math.exp(intercept + s * length);
    end[b] = Math.exp(intercept);
  }
  const endAt = (i: number) => (i >= 0 ? end[i] : NaN);
  const diff = end.map((e, i) => e - endAt(i - 3));
  const diffSeries = Series.fromArray(bars, diff);
  const lowest = ta.lowest(diffSeries, 200).toArray().map((v) => v ?? NaN);
  const highest = ta.highest(diffSeries, 200).toArray().map((v) => v ?? NaN);
  const crossUp = ta.crossover(diffSeries, 0).toArray();
  const crossDn = ta.crossunder(diffSeries, 0).toArray();

  resetDrawings({});
  const up1 = varDrawing<Line>();
  const up = varDrawing<Line>();
  const base = varDrawing<Line>();
  const lw = varDrawing<Line>();
  const lw1 = varDrawing<Line>();
  const lblT = varDrawing<Label>();

  const p0: Pt[] = [];
  const p1: Pt[] = [];
  const fillColors: string[] = [];
  const markers: MarkerData[] = [];

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const t = bars[i].time;
    const confirmed = i < n - 1 || lastConfirmed;
    const e = end[i];
    const s0 = start[i];
    const e3 = endAt(i - 3);
    const dev = deviation[i];

    const upSig = !!crossUp[i] && confirmed;
    const dnSig = !!crossDn[i] && confirmed;

    // an na colour of color.from_gradient is passed as null (oakScriptJS #191)
    const colorUp = color.from_gradient(diff[i], lowest[i], highest[i], NA_COLOR, col1);
    const colorDn = color.from_gradient(diff[i], lowest[i], highest[i], col2, NA_COLOR);
    const channelCol = gt(e, s0) ? col1 : col2;
    const trendCol = gt(e, e3) ? colorUp : colorDn;
    const trendCol1 = gt(e, e3) ? col1 : col2;
    const trendCss = trendCol == null ? 'transparent' : String(trendCol);

    p0.push({ time: t, value: Number.isFinite(e) ? e : NaN, color: trendCol1 });
    p1.push({ time: t, value: Number.isFinite(e3) ? e3 : NaN, color: trendCss });
    if (upSig && Number.isFinite(e)) {
      markers.push({ id: 'shape0', time: t, position: 'atPriceMiddle', price: e, shape: 'xcross', color: fg, size: 'tiny' });
    }
    if (dnSig && Number.isFinite(e)) {
      markers.push({ id: 'shape1', time: t, position: 'atPriceMiddle', price: e, shape: 'xcross', color: fg, size: 'tiny' });
    }
    fillColors.push(cfg.fill_band ? trendCss : 'transparent');

    // bar_index[channel_len] is na on the first channel_len bars
    const x1 = i - chLen >= 0 ? i - chLen : NaN;
    const wOut = width + 0.3;
    if (!base.value && cfg.mid_disp) {
      base.value = line.new(x1, s0, i, e, 'bar_index', 'none', undefined, 'dashed');
    } else if (base.value) {
      // without the mid line, `base` stays na and its setters do nothing
      line.set_xy1(base.value, x1, s0);
      line.set_xy2(base.value, i, e);
      line.set_color(base.value, fg);
    }

    if (!up1.value) {
      up1.value = line.new(x1, s0 + dev * wOut, i, e + dev * wOut, 'bar_index', 'none', undefined, 'solid', 3);
    } else {
      line.set_xy1(up1.value, x1, s0 + dev * wOut);
      line.set_xy2(up1.value, i, e + dev * wOut);
      line.set_color(up1.value, channelCol);
    }

    if (!up.value) {
      up.value = line.new(x1, s0 + dev * width, i, e + dev * width, 'bar_index', 'none', undefined, 'solid', 1);
    } else {
      line.set_xy1(up.value, x1, s0 + dev * width);
      line.set_xy2(up.value, i, e + dev * width);
      line.set_color(up.value, NA_COLOR);
    }

    if (!lw.value) {
      lw.value = line.new(x1, s0 - dev * width, i, e - dev * width, 'bar_index', 'none', undefined, 'solid', 1);
    } else {
      line.set_xy1(lw.value, x1, s0 - dev * width);
      line.set_xy2(lw.value, i, e - dev * width);
      line.set_color(lw.value, NA_COLOR);
    }

    if (!lw1.value) {
      lw1.value = line.new(x1, s0 - dev * wOut, i, e - dev * wOut, 'bar_index', 'none', undefined, 'solid', 3);
      lblT.value = label.new(x1, s0 - dev * wOut);
    } else {
      line.set_xy1(lw1.value, x1, s0 - dev * wOut);
      line.set_xy2(lw1.value, i, e - dev * wOut);
      line.set_color(lw1.value, channelCol);
      const lb = lblT.value!;
      label.set_xy(lb, x1, s0 - dev * wOut);
      label.set_text(lb, gt(e, s0) ? 'UP' : 'DN');
      label.set_style(lb, gt(s0, e) ? 'label_lower_right' : 'label_upper_right');
      label.set_color(lb, channelCol);
      label.set_textcolor(lb, '#070f23');
    }

    // a linefill on a pair of lines that already has one replaces it
    linefill.new(lw.value!, lw1.value!, color.new(channelCol, 70));
    linefill.new(up.value!, up1.value!, color.new(channelCol, 70));

    if (i === n - 1) {
      const dash = table.new('top_right', 10, 10, color.new(fg, 90), undefined, undefined, bg, 5);
      table.cell(dash, 0, 0, 'Slope: ' + str.tostring(slope[i] * 100, '#,###.###'), undefined, undefined, fg,
        undefined, undefined, 'auto');
      table.cell(dash, 0, 1, 'Log Regression Channel: ' + (gt(e, s0) ? 'UP' : 'DN'), undefined, undefined, channelCol,
        undefined, undefined, 'auto');
      // color.new(na, 0) is black in Pine; oakscriptjs returns na (oakScriptJS #150)
      table.cell(dash, 0, 2, 'Logarithmic Regression: ' + (gt(e, e3) ? 'UP' : 'DN'), undefined, undefined,
        color.new(trendCol, 0), undefined, undefined, 'auto');
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: p0, plot1: p1 },
    fills: [{ id: 'fill0', plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: fillColors }],
    markers,
    ...drawingOutputs(bars),
  };
}

export const LogarithmicRegressionChannelTrend = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  drawingKinds,
};
