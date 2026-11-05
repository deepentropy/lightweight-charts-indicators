/**
 * Fibonacci Trend [ChartPrime]
 *
 * A SuperTrend (factor "Trend", ATR 25) gives the trend. It is plotted with a gradient fill up to the bar midpoint
 * (hl2). From each trend change the script tracks the lowest low and the highest high of the trend (the first range
 * runs from the change bar to 3 ATR(200) beyond it) and draws, on every bar, a Fibonacci retracement of that range:
 * two thick lines for the levels 0 and 1, four levels from the inputs, a dotted 0.5 level, a price label per level,
 * a dashed diagonal between the low and the high, labels on the high and the low, and a filled area between the
 * levels 0.5 / 0.618 and 0.786. Lines and labels run "Extend" bars after the current bar.
 *
 * Chart context (optional third argument): the lines and labels use the foreground and background colours of the
 * chart, read from the context (`foregroundColor`, `backgroundColor`). Without them the colours are those of a dark
 * chart (foreground #DBDBDB, background #0F0F0F).
 *
 * Reference: "Fibonacci Trend [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ChartPrime
 */

import { taStep, str, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LineDrawingData, LinefillData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { foregroundColorOf, backgroundColorOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FibonacciTrendInputs {
  trendOn: boolean;
  trend: number;
  col1: string;
  col2: string;
  extend: number;
  fillCol: string;
  v236: number;
  v382: number;
  v618: number;
  v786: number;
}

export const defaultInputs: FibonacciTrendInputs = {
  trendOn: true,
  trend: 4,
  col1: '#26905d',
  col2: '#74286d',
  extend: 15,
  fillCol: '#2689901c',
  v236: 0.236,
  v382: 0.382,
  v618: 0.618,
  v786: 0.786,
};

export const inputConfig: InputConfig[] = [
  { id: 'trendOn', type: 'bool', title: '', defval: true, inline: 'trend', group: 'Trend' },
  { id: 'trend', type: 'float', title: 'Trend', defval: 4, step: 0.01, inline: 'trend', group: 'Trend' },
  { id: 'col1', type: 'color', title: '', defval: '#26905d', inline: 'trend', group: 'Trend' },
  { id: 'col2', type: 'color', title: '', defval: '#74286d', inline: 'trend', group: 'Trend' },
  { id: 'extend', type: 'int', title: 'Extend', defval: 15, inline: '1', group: 'Fibonacci' },
  { id: 'fillCol', type: 'color', title: '', defval: '#2689901c', inline: '1', group: 'Fibonacci' },
  { id: 'v236', type: 'float', title: '1', defval: 0.236 },
  { id: 'v382', type: 'float', title: '2', defval: 0.382 },
  { id: 'v618', type: 'float', title: '3', defval: 0.618 },
  { id: 'v786', type: 'float', title: '4', defval: 0.786 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend', color: '#2962ff', lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Plot', color: '#2962ff', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Fibonacci Trend [ChartPrime]',
  shortTitle: 'Fibonacci Trend [ChartPrime]',
  overlay: true,
};

/** chart.fg_color and chart.bg_color of the reference run (dark theme) */

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

interface Ln {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'dotted';
}
interface Lb {
  x: number;
  y: number;
  text: string;
  color: string;
  textColor: string | null;
  style: 'label_down' | 'label_up' | 'label_left';
}

type Result = Omit<IndicatorResult, 'labels' | 'lines' | 'linefills'> & { labels: LabelData[]; lines: LineDrawingData[]; linefills: LinefillData[] };

interface FibVars {
  // The objects of `fib_d` (null: na). The script deletes every object before it makes the next one, so the counts
  // stay far below the limits (500 lines, 50 labels). fibLow / fib0 are changed in place (copied in copyVars), the
  // others are replaced.
  fibLow: Ln | null; // fib_
  fib0: Ln | null;
  fibDi: Ln | null;
  levels: Ln[]; // fib236, fib382, fib05, fib618, fib786
  labH: Lb | null;
  labL: Lb | null;
  levelLabels: Lb[]; // L0, L_, L236, L382, L618, L786
  fills: Array<[Ln, Ln]>;
  h: number;
  l: number;
  hi: number;
  li: number;
  val0: number;
  val1: number;
}

interface FibRun extends BarRunState<FibVars> {
  st: ReturnType<typeof taStep.supertrend>;
  atr: ReturnType<typeof taStep.atr>;
  direction: number[];
  plot0: Array<{ time: number; value: number; color: string }>;
  plot1: Array<{ time: number; value: number }>;
  topValue: number[];
  bottomValue: number[];
  bottomColor: Array<string | null>;
}

function study(inputs: Partial<FibonacciTrendInputs>): BarStudy<FibRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const extend = Math.trunc(cfg.extend);
  const v236 = cfg.v236 * 100;
  const v382 = cfg.v382 * 100;
  const v618 = cfg.v618 * 100;
  const v786 = cfg.v786 * 100;
  // chart.fg_color / chart.bg_color (set by init from the chart of the run)
  let chartFg = '';
  let chartBg = '';
  let fg50 = '';
  const flat = (x1: number, y: number, x2: number, width: number, lineColor = chartFg, style: Ln['style'] = 'solid'): Ln =>
    ({ x1, y1: y, x2, y2: y, color: lineColor, width, style });
  const copy = <T extends object>(o: T | null): T | null => (o ? { ...o } : null);

  return {
    init(_bars, chart) {
      chartFg = foregroundColorOf(chart);
      chartBg = backgroundColorOf(chart);
      fg50 = String(color.new(chartFg, 50));
      const s: FibRun = {
        st: taStep.supertrend(cfg.trend, 25), atr: taStep.atr(200), direction: [], plot0: [], plot1: [], topValue: [],
        bottomValue: [], bottomColor: [], steps: [],
        vars: {
          fibLow: null, fib0: null, fibDi: null, levels: [], labH: null, labL: null, levelLabels: [], fills: [],
          h: NaN, l: NaN, hi: NaN, li: NaN, val0: NaN, val1: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.st, s.atr];
      s.series = [s.direction, s.plot0, s.plot1, s.topValue, s.bottomValue, s.bottomColor];
      return s;
    },
    copyVars: (v) => ({ ...v, fibLow: copy(v.fibLow), fib0: copy(v.fib0) }),
    bar(s, i, bars) {
      const bar = bars[i];
      const v = s.vars;
      const [stValue, dir] = s.st.step(bar.high, bar.low, bar.close);
      const a = s.atr.step(bar.high, bar.low, bar.close) ?? NaN;
      const trend = dir ?? NaN;
      s.direction[i] = trend;
      const prev = i > 0 ? s.direction[i - 1] : NaN;
      const known = !isNaN(trend) && !isNaN(prev);
      const changed = known && trend !== prev;
      const same = known && trend === prev;

      if (changed) {
        // every line and label of the trend before is deleted
        v.fibLow = v.fib0 = v.fibDi = v.labH = v.labL = null;
        v.levels = [];
        v.levelLabels = [];
        v.fills = [];
        if (trend === -1) {
          v.fibLow = flat(i, bar.low, i, 2);
          v.fib0 = flat(i, bar.high + a * 3, i, 2);
        } else if (trend === 1) {
          v.fibLow = flat(i, bar.high, i, 2);
          v.fib0 = flat(i, bar.low - a * 3, i, 2);
          v.fibDi = { x1: v.li, y1: v.l, x2: v.hi, y2: v.h, color: chartFg, width: 1, style: 'dashed' };
        }
      }

      if (same) {
        const fibLow = v.fibLow;
        const fib0 = v.fib0;
        if (fibLow && lt(bar.low, fibLow.y1)) fibLow.y1 = fibLow.y2 = bar.low;
        if (fib0 && gt(bar.high, fib0.y1)) fib0.y1 = fib0.y2 = bar.high;

        if (fib0 && eq(bar.high, fib0.y1)) {
          v.h = bar.high;
          v.hi = i;
          v.labH = { x: v.hi, y: v.h, text: str.tostring(v.h, '#,###.####'), color: '#15373b', textColor: null, style: 'label_down' };
        }
        if (fibLow && eq(bar.low, fibLow.y1)) {
          v.l = bar.low;
          v.li = i;
          v.labL = { x: v.li, y: v.l, text: str.tostring(v.l, '#,###.####'), color: '#15373b', textColor: null, style: 'label_up' };
        }

        if (fibLow) fibLow.x2 = i + extend;
        if (fib0) fib0.x2 = i + extend;

        v.fibDi = { x1: v.li, y1: v.l, x2: v.hi, y2: v.h, color: chartFg, width: 1, style: 'dashed' };
        const start = fib0 ? fib0.x1 : NaN;
        if (v.fibDi.x1 < start || v.fibDi.x2 < start) v.fibDi = null;

        const top = fib0 ? fib0.y1 : NaN;
        const bottom = fibLow ? fibLow.y1 : NaN;
        const sizeStep = (top - bottom) / 100;
        if (trend === -1) {
          v.val0 = top;
          v.val1 = bottom;
        }
        if (trend === 1) {
          v.val0 = bottom;
          v.val1 = top;
        }

        const x1 = fib0 ? fib0.x1 : NaN;
        const x2 = fib0 ? fib0.x2 : NaN;
        const val0 = v.val0;
        const level = (lv: number) => val0 - sizeStep * lv * trend * -1;
        const fib236 = flat(x1, level(v236), x2, 1);
        const fib382 = flat(x1, level(v382), x2, 1);
        const fib05 = flat(x1, level(50), x2, 1, fg50, 'dotted');
        const fib618 = flat(x1, level(v618), x2, 1);
        const fib786 = flat(x1, level(v786), x2, 1);
        v.levels = [fib236, fib382, fib05, fib618, fib786];

        const side = (y: number, text: string): Lb => ({ x: i + extend, y, text, color: chartBg, textColor: chartFg, style: 'label_left' });
        const priced = (lv: number, line: Ln) => side(line.y1, str.tostring(lv / 100) + str.tostring(line.y1, ' (#,###.####)'));
        v.levelLabels = [
          side(v.val0, '0 ' + str.tostring(v.val0, '(#,###.####)')),
          side(v.val1, '1 ' + str.tostring(v.val1, '(#,###.####)')),
          priced(v236, fib236),
          priced(v382, fib382),
          priced(v618, fib618),
          priced(v786, fib786),
        ];

        // a fill on deleted lines is not drawn: only the two fills of the current lines remain
        v.fills = [[fib618, fib786], [fib05, fib786]];
      }

      // color = trend_on ? (direction == 1 ? col2 : col1) : na
      const trendColor = cfg.trendOn ? (trend === 1 ? cfg.col2 : cfg.col1) : null;
      const st = stValue ?? NaN;
      const hl2 = (bar.high + bar.low) / 2;
      s.plot0[i] = { time: bar.time, value: st, color: changed || trendColor === null ? 'transparent' : trendColor };
      s.plot1[i] = { time: bar.time, value: hl2 };
      s.topValue[i] = hl2;
      s.bottomValue[i] = st;
      const faded = changed ? null : color.new(trendColor as string, 90);
      s.bottomColor[i] = faded === null || faded === undefined ? null : String(faded);
    },
    result(s, bars) {
      const n = bars.length;
      const v = s.vars;
      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      // a line or a label with an na coordinate is not drawn
      const drawn = (ln: Ln) => !isNaN(ln.x1) && !isNaN(ln.x2) && !isNaN(ln.y1) && !isNaN(ln.y2);
      const toLine = (ln: Ln): LineDrawingData => ({
        time1: T(ln.x1), price1: ln.y1, time2: T(ln.x2), price2: ln.y2, color: ln.color,
        ...(ln.width !== 1 ? { width: ln.width } : {}),
        ...(ln.style !== 'solid' ? { style: ln.style } : {}),
      });
      const allLines = [v.fibLow, v.fib0, v.fibDi, ...v.levels].filter((ln): ln is Ln => ln !== null && drawn(ln));
      const allLabels = [v.labH, v.labL, ...v.levelLabels].filter((lb): lb is Lb => lb !== null && !isNaN(lb.x) && !isNaN(lb.y));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [
          // fill(p1, p2, hl2, supertrend, na, direction != direction[1] ? na : color.new(color, 90))
          { plot1: 'plot0', plot2: 'plot1', gradient: { topValue: s.topValue.slice(), bottomValue: s.bottomValue.slice(),
            topColor: new Array(n).fill(null), bottomColor: s.bottomColor.slice() } },
        ],
        lines: allLines.map(toLine),
        labels: allLabels.map((lb) => ({
          time: T(lb.x), price: lb.y, text: lb.text, color: lb.color,
          ...(lb.textColor !== null ? { textColor: lb.textColor } : {}),
          ...(lb.style !== 'label_down' ? { style: lb.style } : {}),
        })),
        linefills: v.fills.filter(([a, b]) => drawn(a) && drawn(b)).map(([a, b]) => ({ line1: toLine(a), line2: toLine(b), color: cfg.fillCol })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibonacciTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FibonacciTrendInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const FibonacciTrend = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
