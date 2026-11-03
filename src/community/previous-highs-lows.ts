/**
 * Previous Highs & Lows [LuxAlgo]
 *
 * Shows the highs and lows of the last bars of a higher timeframe ("Frequency": hour, day, week, month or year).
 * On the last bar, for each of the last "Show Last" + 1 bars of that timeframe (index 0 is the latest bar that
 * `request.security` gives, without lookahead: the latest completed bar, or the chart bar itself when the frequency
 * is the chart timeframe), the script draws a level line at its high and at its low, from the open time of that bar
 * to the last bar, with a colour that fades with the index (dashed for index 0), a label with the index on the last
 * bar, and a grey vertical line at the open time. "Filter Based On Position" hides the highs below the close and the
 * lows above it. Two areas: from the highest high to the percentile (100 - "Areas Width") of the highs, and from the
 * percentile "Areas Width" of the lows to the lowest low, from the oldest bar to the last bar.
 *
 * The original requests the higher timeframe with `calc_bars_count = showLast + 1`: only the last "Show Last" + 1
 * bars of the timeframe (the bar in progress included) are calculated, so a bar older than that window gives na
 * values (no line drawn, and an na percentile hides the area).
 *
 * Chart context (optional third argument): the exchange time zone and session give the periods of the timeframe
 * (without them the UTC rule of anchor-period.ts) and the time zone of the label tooltips (UTC without it).
 * A frequency below the chart timeframe needs the bars of a lower timeframe, which the chart bars do not have: the
 * port throws an Error.
 *
 * Reference: "Previous Highs & Lows [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  array, color, str, timeframe, line, label, box, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { timezoneOf, type ChartContext } from '../chart-context';

export interface PreviousHighsLowsInputs {
  showLast: number;
  freq: 'Hour' | 'Day' | 'Week' | 'Month' | 'Year';
  areasWidth: number;
  filter: boolean;
  showPrevh: boolean;
  prevhColor: string;
  showPrevl: boolean;
  prevlColor: string;
  minTransp: number;
  showAreas: boolean;
  topCss: string;
  btmCss: string;
}

export const defaultInputs: PreviousHighsLowsInputs = {
  showLast: 4,
  freq: 'Day',
  areasWidth: 20,
  filter: false,
  showPrevh: true,
  prevhColor: '#f23645',
  showPrevl: true,
  prevlColor: '#089981',
  minTransp: 80,
  showAreas: true,
  topCss: 'rgba(242, 54, 69, 0.2)',
  btmCss: 'rgba(8, 153, 129, 0.2)',
};

export const inputConfig: InputConfig[] = [
  { id: 'showLast', type: 'int', title: 'Show Last', defval: 4, min: 1 },
  { id: 'freq', type: 'string', title: 'Frequency', defval: 'Day', options: ['Hour', 'Day', 'Week', 'Month', 'Year'] },
  { id: 'areasWidth', type: 'int', title: 'Areas Width', defval: 20, min: 0, max: 100 },
  {
    id: 'filter', type: 'bool', title: 'Filter Based On Position', defval: false,
    tooltip: "Filter out previous highs below the current closing price, and previous low's above it.",
  },
  { id: 'showPrevh', type: 'bool', title: 'Previous Highs', defval: true, inline: 'inline1', group: 'Style' },
  { id: 'prevhColor', type: 'color', title: '', defval: '#f23645', inline: 'inline1', group: 'Style' },
  { id: 'showPrevl', type: 'bool', title: 'Previous Lows', defval: true, inline: 'inline2', group: 'Style' },
  { id: 'prevlColor', type: 'color', title: '', defval: '#089981', inline: 'inline2', group: 'Style' },
  { id: 'minTransp', type: 'float', title: 'Minimum Gradient Transparency', defval: 80, group: 'Style' },
  { id: 'showAreas', type: 'bool', title: 'Show Areas', defval: true, inline: 'inline3', group: 'Style' },
  { id: 'topCss', type: 'color', title: '', defval: 'rgba(242, 54, 69, 0.2)', inline: 'inline3', group: 'Style' },
  { id: 'btmCss', type: 'color', title: '', defval: 'rgba(8, 153, 129, 0.2)', inline: 'inline3', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box'];

export const metadata = {
  title: 'Previous Highs & Lows [LuxAlgo]',
  shortTitle: 'LuxAlgo - Previous Highs & Lows',
  overlay: true,
};

const TF: Record<PreviousHighsLowsInputs['freq'], string> = {
  Hour: '60', Day: 'D', Week: 'W', Month: 'M', Year: '12M',
};

/** Pine float comparison a <= b (within 1e-10; na compares false) */
const le = (a: number, b: number) => a - b <= 1e-10;

export function calculate(
  bars: Bar[],
  inputs: Partial<PreviousHighsLowsInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const showLast = Math.trunc(cfg.showLast);
  const tf = TF[cfg.freq] ?? 'D';
  const ms = n > 0 && bars[0].time >= 1e12;
  const toMs = (t: number) => (ms ? t : t * 1000);
  const tz = timezoneOf(chart);
  const base = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
  };

  resetDrawings(); // max_lines_count / max_labels_count / max_boxes_count 50
  if (n === 0) return base;

  // request.security(syminfo.tickerid, tf, output(), calc_bars_count = showLast + 1) on the last bar
  const chartTf = chartTimeframe(bars, chart);
  const tfSec = timeframe.in_seconds(tf);
  const chartSec = chartTf === '' ? tfSec : timeframe.in_seconds(chartTf);
  if (tfSec < chartSec) {
    throw new Error(`Previous Highs & Lows: the frequency "${cfg.freq}" is below the chart timeframe and needs lower-timeframe bars, which the chart bars do not have`);
  }
  const count = showLast + 1;
  let src: ReadonlyArray<Bar>;
  let at: number;
  if (tfSec === chartSec) {
    src = bars;
    at = n - 1;
  } else {
    const htf = higherTimeframeBars(bars, tf, chart);
    src = htf.htf;
    at = htf.latest[n - 1];
  }
  const firstCalc = src.length - count; // bars of the timeframe before the calculated window are na
  const prevH: number[] = [];
  const prevL: number[] = [];
  const prevT: number[] = [];
  for (let i = 0; i <= showLast; i++) {
    const k = at - i;
    const ok = at >= 0 && k >= 0 && k >= firstCalc;
    prevH.push(ok ? src[k].high : NaN);
    prevL.push(ok ? src[k].low : NaN);
    prevT.push(ok ? toMs(src[k].time) : NaN);
  }

  // var boxes, created on the first bar with na coordinates
  const areaTop = box.new(NaN, NaN, NaN, NaN, 'transparent', undefined, undefined, undefined, 'bar_time', cfg.topCss);
  const areaBtm = box.new(NaN, NaN, NaN, NaN, 'transparent', undefined, undefined, undefined, 'bar_time', cfg.btmCss);

  // barstate.islast
  setDrawingBar(n - 1, true);
  const last = bars[n - 1];
  const time = toMs(last.time);
  const lineLabel = (x1: number, y: number, index: number, col: string) => {
    const css = color.from_gradient(index, 0, showLast, col, color.new(col, cfg.minTransp));
    line.new(x1, y, time, y, 'bar_time', 'none', css, index === 0 ? 'dashed' : 'solid');
    const lb = label.new(n - 1, y, str.tostring(index), 'bar_index', 'price', 'transparent', 'label_left', col, 'tiny');
    label.set_tooltip(lb, str.format_time(Number.isNaN(x1) ? 0 : x1, 'yyyy-MM-dd HH:mm', tz));
  };
  for (let index = 0; index < prevT.length; index++) {
    const element = prevT[index];
    const getH = prevH[index];
    const getL = prevL[index];
    if (cfg.showPrevh && (!cfg.filter || le(last.close, getH))) lineLabel(element, getH, index, cfg.prevhColor);
    if (cfg.showPrevl && (!cfg.filter || le(getL, last.close))) lineLabel(element, getL, index, cfg.prevlColor);
    line.new(element, getH, element, getL, 'bar_time', 'both', color.gray, index === 0 ? 'dashed' : 'solid');
  }
  if (cfg.showAreas) {
    const p80 = array.percentile_linear_interpolation(prevH, 100 - cfg.areasWidth);
    box.set_lefttop(areaTop, prevT[prevT.length - 1], array.max(prevH));
    box.set_rightbottom(areaTop, time, p80);
    const p20 = array.percentile_linear_interpolation(prevL, cfg.areasWidth);
    box.set_lefttop(areaBtm, prevT[prevT.length - 1], p20);
    box.set_rightbottom(areaBtm, time, array.min(prevL));
  }
  setDrawingBar(null);

  return { ...base, ...drawingOutputs(bars, ms ? 'ms' : 's') };
}

export const PreviousHighsLows = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
