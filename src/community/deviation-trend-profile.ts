/**
 * Deviation Trend Profile [BigBeluga]
 *
 * An SMA of the close with six levels around it at 1, 2 and 3 ATR(200) distances (the "standard deviation"
 * multipliers of the inputs). The slope of the SMA (its change over 5 bars, divided by the largest change of the
 * last 500 bars) colours the SMA from the down colour to the up colour. The trend turns up when that slope crosses
 * above 0.1 and down when it crosses below -0.1; each turn is marked by a circle on the SMA.
 *
 * On the last bar the levels are drawn as short lines with their label, and the "Trend Distribution Profile" is
 * drawn to the right of the chart: the range between the two outer levels is cut into bins, and for each bar since
 * the start of the trend the close is counted in every bin it falls in (one bin of margin on each side, with the
 * levels of that bar). Each bin is a box whose length is its count; a label gives the number of bars of the trend.
 * At most 500 boxes are kept.
 *
 * Chart values read from the optional third argument (see src/chart-context.ts): the chart foreground and
 * background colours (lines, labels, boxes of the last bar). Without them the port uses those of a dark chart
 * (foreground #DBDBDB, background #0F0F0F).
 *
 * Reference: "Deviation Trend Profile [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import { taStep, taCore, str, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData, LabelData, BoxData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { backgroundColorOf, foregroundColorOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface DeviationTrendProfileInputs {
  /** SMA length */
  length: number;
  mult1: number;
  mult2: number;
  mult3: number;
  /** Show the trend distribution profile */
  showTp: boolean;
  /** Number of bins of the profile */
  bins: number;
  /** Distance of the profile from the last bar, in bars */
  offset: number;
  colUp: string;
  colDn: string;
}

export const defaultInputs: DeviationTrendProfileInputs = {
  length: 50,
  mult1: 1,
  mult2: 2,
  mult3: 3,
  showTp: true,
  bins: 50,
  offset: 30,
  colUp: '#12D1EB',
  colDn: '#FA2856',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'SMA Length', defval: 50, group: 'SMA' },
  { id: 'mult1', type: 'int', title: 'Standart Deviation 1', defval: 1, group: 'Standart Deviation Levels' },
  { id: 'mult2', type: 'int', title: 'Standart Deviation 2', defval: 2, group: 'Standart Deviation Levels' },
  { id: 'mult3', type: 'int', title: 'Standart Deviation 3', defval: 3, group: 'Standart Deviation Levels' },
  { id: 'showTp', type: 'bool', title: 'Show', defval: true, group: 'Trend Distribution Profile' },
  { id: 'bins', type: 'int', title: 'Bins Amount', defval: 50, group: 'Trend Distribution Profile' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 30, group: 'Trend Distribution Profile' },
  { id: 'colUp', type: 'color', title: '', defval: '#12D1EB', group: 'Theme', inline: 'c' },
  { id: 'colDn', type: 'color', title: '', defval: '#FA2856', group: 'Theme', inline: 'c' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: '#2962FF', lineWidth: 3 },
];

export const metadata = {
  title: 'Deviation Trend Profile [BigBeluga]',
  shortTitle: 'Deviation Trend Profile [BigBeluga]',
  overlay: true,
};

/** indicator(max_boxes_count = 500) */
const MAX_BOXES = 500;

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;

/** A colour as a string; an na colour (fully transparent) is 'transparent' */
const css = (c: unknown): string => {
  const s = String(c);
  return color.t(s) >= 100 ? 'transparent' : s;
};

/**
 * `ta.percentile_linear_interpolation(source, length, percentage)` one bar at a time, with the sorted window of the
 * oakscriptjs function (same doubles): each bar inserts its value before the first value `>=` it (scanning from the
 * start), then removes the value of the bar leaving the window; na for the first `length - 1` bars.
 */
class PercentileWindow implements Committable {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private count = 0;
  /** The step of the current bar: its value, its insertion index, the post-insertion index of the value that leaves */
  private v = NaN;
  private k = 0;
  private out = -1;
  private stepped = false;

  constructor(private readonly length: number, private readonly percentage: number) {
    // a length below 1 throws as the oakscriptjs function does
    taCore.percentile_linear_interpolation([], length, percentage);
  }

  /** Element `j` of the window after the insertion and the removal of this bar */
  private at(j: number): number {
    const p = this.out >= 0 && j >= this.out ? j + 1 : j;
    return p < this.k ? this.values[p]! : p === this.k ? this.v : this.values[p - 1]!;
  }

  step(v: number): number {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    this.v = v;
    this.k = k;
    const i = this.count;
    if (i >= this.length) {
      const o = this.bars.indexOf(i - this.length);
      this.out = o < k ? o : o + 1;
    } else {
      this.out = -1;
    }
    this.stepped = true;
    if (i < this.length - 1) return NaN;
    const { length, percentage } = this;
    const pos = (percentage / 100) * length - 0.5;
    if (pos <= 0) return this.at(0);
    if (pos >= length - 1) return this.at(length - 1);
    const lo = Math.floor(pos);
    return this.at(lo) + (pos - lo) * (this.at(lo + 1) - this.at(lo));
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.splice(this.k, 0, this.v);
    this.bars.splice(this.k, 0, this.count);
    if (this.out >= 0) {
      this.values.splice(this.out, 1);
      this.bars.splice(this.out, 1);
    }
    this.count++;
  }
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers' | 'lines' | 'labels' | 'boxes'> & {
  markers: MarkerData[];
  lines: LineDrawingData[];
  labels: LabelData[];
  boxes: BoxData[];
};

interface DtpVars {
  /** var trend = bool(na): false (a bool is never na); var start_index = int(na) */
  trend: boolean;
  startIndex: number;
}

interface DtpRun extends BarRunState<DtpVars> {
  sma: WindowSma;
  atrStep: ReturnType<typeof taStep.atr>;
  top: PercentileWindow;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDown: ReturnType<typeof taStep.crossunder>;
  avg: number[];
  atr: number[];
  avgColor: string[];
  plot0: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<DeviationTrendProfileInputs>): BarStudy<DtpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { colUp, colDn } = cfg;
  const up50 = String(color.new(colUp, 50));
  const dn50 = String(color.new(colDn, 50));
  // chart.fg_color / chart.bg_color (read from the chart of the run)
  let CHART_FG = '';
  let CHART_BG = '';
  return {
    init(_bars, chart) {
      CHART_FG = foregroundColorOf(chart);
      CHART_BG = backgroundColorOf(chart);
      const s: DtpRun = {
        sma: new WindowSma(cfg.length), atrStep: taStep.atr(200), top: new PercentileWindow(500, 100), crossUp: taStep.crossover(),
        crossDown: taStep.crossunder(), avg: [], atr: [], avgColor: [], plot0: [], markers: [], steps: [],
        vars: { trend: false, startIndex: NaN }, lists: [], series: [],
      };
      s.steps = [s.sma, s.atrStep, s.top, s.crossUp, s.crossDown];
      s.lists = [s.markers];
      s.series = [s.avg, s.atr, s.avgColor, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const time = bars[i].time;
      const avg = s.sma.step(bars[i].close);
      s.avg[i] = avg;
      s.atr[i] = s.atrStep.step(bars[i].high, bars[i].low, bars[i].close);
      const avgDiff = i >= 5 ? avg - s.avg[i - 5] : NaN;
      const top = s.top.step(avgDiff);
      // a plain division (x / 0 is +-infinity, 0 / 0 is na)
      const avgCol = avgDiff / top;
      const crossUp = s.crossUp.step(avgCol, 0.1);
      const crossDown = s.crossDown.step(avgCol, -0.1);
      const avgColor = css(color.from_gradient(avgCol, -0.3, 0.3, colDn, colUp));
      s.avgColor[i] = avgColor;

      const trendPrev: boolean = v.trend;
      if (crossUp && !v.trend) {
        v.trend = true;
        v.startIndex = i;
      }
      if (crossDown && v.trend) {
        v.trend = false;
        v.startIndex = i;
      }
      const trend = v.trend;
      s.plot0[i] = { time, value: avg, color: avgColor };
      // trend != trend[1] (false on the first bar: trend[1] is na)
      if (i > 0 && trend !== trendPrev && !Number.isNaN(avg)) {
        const c = trend ? colUp : colDn;
        // plotshape "Up" (tiny, small): shape0 / shape1; plotshape "Down" (tiny, small): shape2 / shape3
        s.markers.push({ id: trend ? 'shape0' : 'shape2', time, position: 'atPriceMiddle', price: avg, shape: 'circle', color: c, size: 'tiny' });
        s.markers.push({ id: trend ? 'shape1' : 'shape3', time, position: 'atPriceMiddle', price: avg, shape: 'circle', color: trend ? up50 : dn50, size: 'small' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      const { avg, atr, avgColor } = s;
      // max = stdv3, min = stdv_3
      const maxAt = (i: number) => avg[i] + atr[i] * cfg.mult3;
      const minAt = (i: number) => avg[i] - atr[i] * cfg.mult3;
      const lines: LineDrawingData[] = [];
      const labels: LabelData[] = [];
      let boxes: BoxData[] = [];
      if (n > 0) {
        // barstate.islast
        const last = n - 1;
        const interval = barInterval(bars);
        const T = (index: number) => barTime(bars, index, interval);
        const lastColor = avgColor[last];

        // draw_stdv(): an object with an na price is not drawn
        const drawStdv = (mult: number, text: string, mid = false) => {
          const src = avg[last] + atr[last] * mult;
          if (mid && !Number.isNaN(avg[last])) {
            lines.push({ time1: T(last), price1: avg[last], time2: T(last + 5), price2: avg[last], color: lastColor, width: 2 });
          }
          if (Number.isNaN(src)) return;
          lines.push({ time1: T(last), price1: src, time2: T(last + 5), price2: src, color: CHART_FG, width: 2 });
          labels.push({ time: T(last + 5), price: src, text, style: 'label_left', color: css(color.new(CHART_FG, 100)), textColor: CHART_FG });
        };
        drawStdv(cfg.mult1, '+1', true);
        drawStdv(cfg.mult2, '+2');
        drawStdv(cfg.mult3, '+3');
        drawStdv(-cfg.mult1, '-1');
        drawStdv(-cfg.mult2, '-2');
        drawStdv(-cfg.mult3, '-3');

        // profile(min, max)
        if (cfg.showTp) {
          const bins = cfg.bins;
          const stepAt = (i: number) => (maxAt(i) - minAt(i)) / bins;
          const start = last + cfg.offset;
          const loockback = last - s.vars.startIndex;
          const bin: number[] = new Array(Math.max(0, bins)).fill(0);
          if (!Number.isNaN(loockback)) {
            for (let l = 0; l <= loockback; l++) {
              const c = bars[last - l].close;
              const mi = minAt(last - l);
              const st = stepAt(last - l);
              for (let k = 0; k < bin.length; k++) {
                const lower = mi + st * k;
                const upper = lower + st;
                if (ge(c, lower - st) && le(c, upper + st)) bin[k] += 1;
              }
            }
          }
          const binMax = bin.reduce((m, x) => Math.max(m, x), -Infinity);
          const step = stepAt(last);
          const dim = String(color.new(CHART_FG, 80));
          for (let j = 0; j < bin.length; j++) {
            const val = bin[j];
            const lower = minAt(last) + step * j;
            const upper = lower + step;
            // when a creation brings the count above max + 5, the oldest boxes are deleted until max remain
            if (boxes.length + 1 > MAX_BOXES + 5) boxes = boxes.slice(boxes.length + 1 - MAX_BOXES);
            if (Number.isNaN(lower) || Number.isNaN(upper)) continue;
            boxes.push({
              time1: T(start - val), price1: upper, time2: T(start), price2: lower,
              bgColor: css(color.from_gradient(val, 0, binMax, dim, lastColor)),
              borderColor: val === 0 ? CHART_FG : CHART_BG,
            });
          }
          if (!Number.isNaN(maxAt(last))) {
            const text = str.tostring(loockback);
            labels.push({
              time: T(start), price: maxAt(last), text, color: css(color.new(lastColor === 'transparent' ? null : lastColor, 80)),
              textColor: CHART_FG, tooltip: text + ' bars back beginnig of the trend',
            });
          }
        }
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        lines,
        labels,
        boxes,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DeviationTrendProfileInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DeviationTrendProfileInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const DeviationTrendProfile = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
