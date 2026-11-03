/**
 * Range Sentiment Profile [LuxAlgo]
 *
 * On the last bar, the range of the last "length" bars (highest high to lowest low) is split into "rows" bins. Each
 * bin sums close - open of the bars whose high / low range overlaps the bin (with "Use Intrabar", the close - open
 * of the lower-timeframe bars whose body is inside the bin). The bins are boxes drawn from "offset" bars after the
 * last bar, with a length proportional to the sum (to the right for a positive sum, to the left for a negative one;
 * the largest absolute sum is "Width %" of "length" bars), blue for a positive sum and orange otherwise, with the sum
 * as a percentage of the sum of the absolute bodies of the range. Lines mark the top, 75 %, 50 %, 25 % and bottom of
 * the range, the bin with the largest sum (bullish maximum) and the one with the smallest sum (bearish minimum),
 * and the area between the top and bottom lines is filled in the colour of the total sum. The "Show Fill" colour
 * inputs are not used by the original (the fill takes the bin colours).
 *
 * "Use Intrabar" reads the bars of the chart symbol on the lower timeframe ("1" by default): `requiredSymbols` asks
 * for them and the port throws a MissingSymbolDataError when the chart context does not give them.
 *
 * Reference: "Range Sentiment Profile [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, color, math as pineMath, timeframe, Series, box, line, linefill, resetDrawings, setDrawingBar, varDrawing,
  type Bar, type Box, type Line, type Linefill, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { BoxData, LineDrawingData, LinefillData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { barInterval, barTime } from '../bar-time';
import { chartTimeframe } from '../anchor-period';
import { tickeridOf, symbolBarsOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { securityLowerTf, otherSymbolChart } from '../other-symbol';

export interface RangeSentimentProfileInputs {
  length: number;
  rows: number;
  /** Sum the bodies of lower-timeframe bars */
  useIb: boolean;
  /** Lower timeframe of "Use Intrabar" */
  tf: string;
  /** Length of the largest bin, in % of "length" */
  width: number;
  showRange: boolean;
  rangeCss: string;
  bullBin: string;
  bullMax: boolean;
  bearBin: string;
  bearMax: boolean;
  showFill: boolean;
  /** Not used by the original */
  bullFill: string;
  /** Not used by the original */
  bearFill: string;
  /** Bars between the last bar and the profile */
  offset: number;
}

export const defaultInputs: RangeSentimentProfileInputs = {
  length: 80,
  rows: 20,
  useIb: false,
  tf: '1',
  width: 20,
  showRange: true,
  rangeCss: '#787B86',
  bullBin: '#2157f3',
  bullMax: true,
  bearBin: '#ff5d00',
  bearMax: true,
  showFill: true,
  bullFill: 'rgba(33, 87, 243, 0.1)',
  bearFill: 'rgba(255, 93, 0, 0.1)',
  offset: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 80, min: 2 },
  { id: 'rows', type: 'int', title: 'rows', defval: 20, min: 2 },
  { id: 'useIb', type: 'bool', title: 'Use Intrabar', defval: false, inline: 'intrabar' },
  { id: 'tf', type: 'timeframe', title: '', defval: '1', inline: 'intrabar' },
  {
    id: 'width', type: 'float', title: 'Width %', defval: 20, min: 0, max: 100, group: 'Style',
    tooltip: 'Bin width percentage. Determine the length of the returned profile bin as a percentage of the Length setting',
  },
  { id: 'showRange', type: 'bool', title: 'Show Range Levels', defval: true, inline: 'range', group: 'Style' },
  { id: 'rangeCss', type: 'color', title: '', defval: '#787B86', inline: 'range', group: 'Style' },
  { id: 'bullBin', type: 'color', title: 'Bullish Bin', defval: '#2157f3', inline: 'bull', group: 'Style' },
  { id: 'bullMax', type: 'bool', title: 'Maximum', defval: true, inline: 'bull', group: 'Style' },
  { id: 'bearBin', type: 'color', title: 'Bearish Bin', defval: '#ff5d00', inline: 'bear', group: 'Style' },
  { id: 'bearMax', type: 'bool', title: 'Minimum', defval: true, inline: 'bear', group: 'Style' },
  { id: 'showFill', type: 'bool', title: 'Show Fill', defval: true, inline: 'fill', group: 'Style' },
  { id: 'bullFill', type: 'color', title: '', defval: 'rgba(33, 87, 243, 0.1)', inline: 'fill', group: 'Style' },
  { id: 'bearFill', type: 'color', title: '', defval: 'rgba(255, 93, 0, 0.1)', inline: 'fill', group: 'Style' },
  {
    id: 'offset', type: 'int', title: 'offset', defval: 8, group: 'Style',
    tooltip: 'Determine the amount of bars each graphical elements are shifted by',
  },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box', 'line', 'linefill'];

export const metadata = {
  title: 'Range Sentiment Profile [LuxAlgo]',
  shortTitle: 'Range Sentiment Profile [LuxAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && b - a <= EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && a - b <= EPS;
const eq = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) <= EPS;

/** indicator(max_boxes_count = 500) */
const MAX_BOXES = 500;

/** True when "Use Intrabar" needs bars of its own: a timeframe below the chart timeframe. */
function needsLowerBars(tf: string, chartTf: string): boolean {
  return tf.trim() !== '' && chartTf !== '' && timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf);
}

/** Bars the indicator needs: the chart symbol on the "Use Intrabar" timeframe when that option is on. */
export function requiredSymbols(inputs: Partial<RangeSentimentProfileInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  if (!cfg.useIb) return [];
  const chartTf = chartTimeframe([], chart);
  if (!needsLowerBars(cfg.tf, chartTf)) return [];
  return [{ symbol: tickeridOf(chart), timeframe: cfg.tf }];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RangeSentimentProfileInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { boxes: BoxData[]; lines: LineDrawingData[]; linefills: LinefillData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const length = cfg.length;
  const rows = cfg.rows;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const upperArr = A(ta.highest(new Series(bars, (b) => b.high), length));
  const lowerArr = A(ta.lowest(new Series(bars, (b) => b.low), length));
  const sumadArr = A(pineMath.sum(new Series(bars, (b) => Math.abs(b.close - b.open)), length));

  // request.security_lower_tf(syminfo.tickerid, tf, [close, open]): the lower-timeframe bars of each chart bar
  let intrabars: ((i: number) => Bar[]) | null = null;
  if (cfg.useIb && n > 0) {
    const chartTf = chartTimeframe(bars, chart);
    if (cfg.tf.trim() !== '' && chartTf !== '' && timeframe.in_seconds(cfg.tf) > timeframe.in_seconds(chartTf)) {
      throw new Error('The timeframe passed to request.security_lower_tf() is higher than the chart timeframe');
    }
    if (needsLowerBars(cfg.tf, chartTf)) {
      const [ltfBars] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: cfg.tf }], chart);
      const merge = otherSymbolChart(bars, chart);
      const ranges = securityLowerTf(bars, ltfBars, cfg.tf, merge, { other: { timezone: chart?.timezone, session: chart?.session } });
      intrabars = (i: number) => ltfBars.slice(ranges[i][0], ranges[i][1]);
    } else {
      intrabars = (i: number) => [bars[i]];
    }
  }

  resetDrawings({ box: MAX_BOXES });
  const boxes: Box[] = [];
  const ltop = varDrawing<Line>();
  const l75 = varDrawing<Line>();
  const l50 = varDrawing<Line>();
  const l25 = varDrawing<Line>();
  const lbtm = varDrawing<Line>();
  const fill = varDrawing<Linefill>();
  const bullMaxLine = varDrawing<Line>();
  const bearMinLine = varDrawing<Line>();

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    if (i === 0) {
      for (let k = 0; k < rows; k++) {
        boxes.push(box.new(NaN, NaN, NaN, NaN, 'transparent', undefined, undefined, undefined, undefined, undefined,
          undefined, undefined, '#FFFFFF', undefined, 'center'));
      }
      ltop.value = line.new(NaN, NaN, NaN, NaN, 'bar_index', 'none', cfg.rangeCss);
      l75.value = line.new(NaN, NaN, NaN, NaN, 'bar_index', 'none', cfg.rangeCss, 'dashed');
      l50.value = line.new(NaN, NaN, NaN, NaN, 'bar_index', 'none', cfg.rangeCss);
      l25.value = line.new(NaN, NaN, NaN, NaN, 'bar_index', 'none', cfg.rangeCss, 'dashed');
      lbtm.value = line.new(NaN, NaN, NaN, NaN, 'bar_index', 'none', cfg.rangeCss);
      fill.value = linefill.new(ltop.value, lbtm.value, 'transparent');
      bullMaxLine.value = line.new(NaN, NaN, NaN, NaN, 'bar_index', 'none', cfg.bullBin);
      bearMinLine.value = line.new(NaN, NaN, NaN, NaN, 'bar_index', 'none', cfg.bearBin);
    }
    if (i !== n - 1) continue;

    // barstate.islast
    const upper = upperArr[i];
    const lower = lowerArr[i];
    const sumad = sumadArr[i];
    const avg = (upper + lower) / 2;
    const avg75 = (upper + avg) / 2;
    const avg25 = (lower + avg) / 2;
    const top = ltop.value!;
    const btm = lbtm.value!;
    line.set_xy1(top, i - length, upper);
    line.set_xy2(top, i + cfg.offset, upper);
    line.set_xy1(btm, i - length, lower);
    line.set_xy2(btm, i + cfg.offset, lower);
    if (cfg.showRange) {
      line.set_xy1(l75.value!, i - length, avg75);
      line.set_xy2(l75.value!, i + cfg.offset, avg75);
      line.set_xy1(l50.value!, i - length, avg);
      line.set_xy2(l50.value!, i + cfg.offset, avg);
      line.set_xy1(l25.value!, i - length, avg25);
      line.set_xy2(l25.value!, i + cfg.offset, avg25);
    } else {
      line.set_color(top, 'transparent');
      line.set_color(btm, 'transparent');
    }

    // bullish / absolute delta sums of each row
    const step = (upper - lower) / rows;
    let up = upper;
    let dn = upper;
    const sums: number[] = [];
    for (let r = 0; r < rows; r++) {
      dn -= step;
      let sum = 0;
      for (let j = 0; j < length; j++) {
        const k = i - j;
        if (intrabars) {
          const ib = k >= 0 ? intrabars(k) : [];
          // for k = 0 to size - 1: an empty array runs k = 0 (and -1), a runtime error
          if (ib.length === 0) throw new Error('Index 0 is out of bounds, array size is 0');
          for (const b of ib) {
            sum += le(Math.max(b.close, b.open), up) && ge(Math.min(b.close, b.open), dn) ? b.close - b.open : 0;
          }
        } else {
          const b = k >= 0 ? bars[k] : null;
          sum += b && gt(b.high, dn) && lt(b.low, up) ? b.close - b.open : 0;
        }
      }
      sums.push(sum);
      up = dn;
    }

    // profile bins
    const max = Math.max(...sums.map(Math.abs));
    const sumsMax = Math.max(...sums);
    const sumsMin = Math.min(...sums);
    up = upper;
    dn = upper;
    sums.forEach((element, index) => {
      dn -= step;
      const w = (element / max) * length * (cfg.width / 100);
      const x2 = i + (Number.isFinite(w) ? Math.trunc(w) : NaN);
      const css = gt(element, 0) ? String(color.new(cfg.bullBin, 50)) : String(color.new(cfg.bearBin, 50));
      const bx = boxes[index];
      box.set_lefttop(bx, i + cfg.offset, 0.9 * up + 0.1 * dn);
      box.set_rightbottom(bx, x2 + cfg.offset, 0.9 * dn + 0.1 * up);
      box.set_bgcolor(bx, css);
      box.set_text(bx, str.tostring((element / sumad) * 100, 'percent'));
      if (eq(element, sumsMax) && cfg.bullMax) {
        const v = (up + dn) / 2;
        line.set_xy1(bullMaxLine.value!, i + cfg.offset, v);
        line.set_xy2(bullMaxLine.value!, i - length, v);
      }
      if (eq(element, sumsMin) && cfg.bearMax) {
        const v = (up + dn) / 2;
        line.set_xy1(bearMinLine.value!, x2 + cfg.offset, v);
        line.set_xy2(bearMinLine.value!, i - length, v);
      }
      up = dn;
    });

    if (cfg.showFill) {
      const total = sums.reduce((a, b) => a + b, 0);
      linefill.set_color(fill.value!, gt(total, 0) ? String(color.new(cfg.bullBin, 90)) : String(color.new(cfg.bearBin, 90)));
    }
  }
  setDrawingBar(null);

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  const drawn = (l: Line) => ![l.x1, l.y1, l.x2, l.y2].some(Number.isNaN);
  const lineData = (l: Line): LineDrawingData => ({
    time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color ?? 'transparent'),
    ...(l.style === 'dashed' ? { style: 'dashed' as const } : {}),
  });
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    // objects with an na coordinate are not drawn
    boxes: box.all().filter((b) => ![b.left, b.top, b.right, b.bottom].some(Number.isNaN)).map((b) => ({
      time1: T(b.left), price1: b.top, time2: T(b.right), price2: b.bottom, bgColor: String(b.bgcolor),
      borderColor: 'transparent', text: b.text ?? '', textColor: '#FFFFFF',
    })),
    lines: line.all().filter(drawn).map(lineData),
    linefills: linefill.all().filter((f) => drawn(f.line1) && drawn(f.line2))
      .map((f) => ({ line1: lineData(f.line1), line2: lineData(f.line2), color: String(f.color ?? 'transparent') })),
  };
}

export const RangeSentimentProfile = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  requiredSymbols,
};
