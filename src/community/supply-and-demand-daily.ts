/**
 * Supply and Demand Daily [LuxAlgo]
 *
 * On the first bar of each day, finds the supply zone and the demand zone of the day before from its volume. The
 * price range of the day before (highest high to lowest low) is cut in "Resolution" equal steps. Going down from the
 * top one step at a time, the volume of the bars whose high is inside the steps passed so far is added; the supply
 * zone ends at the first step where this volume is above "Threshold %" of the volume of the day. The demand zone is
 * found the same way from the bottom with the lows. Each zone is drawn over the day before: a box (area), a solid
 * line at the middle of the zone (average) and a dashed line at the volume weighted mean of its steps (weighted).
 * The latest zones are extended to the last bar. At most 500 boxes and 500 lines are kept.
 *
 * "Intrabar TF" reads the bars of a lower timeframe, which the chart bars do not have: the port works with the
 * default (the chart timeframe: one value per bar) and throws an Error for another timeframe.
 *
 * Chart context (optional third argument):
 * - `chart.timezone`: the days are those of the exchange time zone. Without it UTC.
 * - `chart.timeframe`: the chart timeframe, compared with "Intrabar TF". Without it, from the gaps between the bars.
 *
 * Reference: "Supply and Demand Daily [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { color, time as ptime, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData, LineDrawingData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { chartTimeframe } from '../anchor-period';
import { timezoneOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SupplyAndDemandDailyInputs {
  /** Threshold % */
  per: number;
  /** Resolution */
  div: number;
  /** Intrabar TF ('' = chart timeframe) */
  tf: string;
  showSupply: boolean;
  supplyCss: string;
  supplyArea: boolean;
  supplyAvg: boolean;
  supplyWavg: boolean;
  showEqui: boolean;
  equiCss: string;
  equiAvg: boolean;
  equiWavg: boolean;
  showDemand: boolean;
  demandCss: string;
  demandArea: boolean;
  demandAvg: boolean;
  demandWavg: boolean;
}

export const defaultInputs: SupplyAndDemandDailyInputs = {
  per: 10,
  div: 50,
  tf: '',
  showSupply: true,
  supplyCss: '#2157f3',
  supplyArea: true,
  supplyAvg: true,
  supplyWavg: true,
  showEqui: true,
  equiCss: '#787B86',
  equiAvg: true,
  equiWavg: true,
  showDemand: true,
  demandCss: '#ff5d00',
  demandArea: true,
  demandAvg: true,
  demandWavg: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'per', type: 'float', title: 'Threshold %', defval: 10, min: 0, max: 100 },
  { id: 'div', type: 'int', title: 'Resolution', defval: 50, min: 2, max: 500 },
  { id: 'tf', type: 'timeframe', title: 'Intrabar TF', defval: '' },
  { id: 'showSupply', type: 'bool', title: 'Supply        ', defval: true, inline: 'supply', group: 'Style' },
  { id: 'supplyCss', type: 'color', title: '', defval: '#2157f3', inline: 'supply', group: 'Style' },
  { id: 'supplyArea', type: 'bool', title: 'Area', defval: true, inline: 'supply', group: 'Style' },
  { id: 'supplyAvg', type: 'bool', title: 'Average', defval: true, inline: 'supply', group: 'Style' },
  { id: 'supplyWavg', type: 'bool', title: 'Weighted', defval: true, inline: 'supply', group: 'Style' },
  { id: 'showEqui', type: 'bool', title: 'Equilibrium', defval: true, inline: 'equi', group: 'Style' },
  { id: 'equiCss', type: 'color', title: '', defval: '#787B86', inline: 'equi', group: 'Style' },
  { id: 'equiAvg', type: 'bool', title: 'Average', defval: true, inline: 'equi', group: 'Style' },
  { id: 'equiWavg', type: 'bool', title: 'Weighted', defval: true, inline: 'equi', group: 'Style' },
  { id: 'showDemand', type: 'bool', title: 'Demand    ', defval: true, inline: 'demand', group: 'Style' },
  { id: 'demandCss', type: 'color', title: '', defval: '#ff5d00', inline: 'demand', group: 'Style' },
  { id: 'demandArea', type: 'bool', title: 'Area', defval: true, inline: 'demand', group: 'Style' },
  { id: 'demandAvg', type: 'bool', title: 'Average', defval: true, inline: 'demand', group: 'Style' },
  { id: 'demandWavg', type: 'bool', title: 'Weighted', defval: true, inline: 'demand', group: 'Style' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Supply and Demand Daily [LuxAlgo]',
  shortTitle: 'LuxAlgo - Supply and Demand Daily',
  overlay: true,
};

/** indicator(max_boxes_count = 500, max_lines_count = 500) */
const MAX_OBJECTS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** type bin */
interface Bin {
  lvl: number;
  prev: number;
  sum: number;
  prevSum: number;
  csum: number;
  avg: number;
  isreached: boolean;
}

interface Bx {
  left: number;
  top: number;
  right: number;
  bottom: number;
  bg: string;
}
interface Ln {
  x1: number;
  x2: number;
  y: number;
  color: string;
  dashed: boolean;
}
/** type area */
interface Area {
  bx: Bx;
  avg: Ln;
  wavg: Ln;
}

type Result = IndicatorResult & { boxes: BoxData[]; lines: LineDrawingData[] };

/** The drawings of an area: its box and its two lines (indices in the lists of the run) */
interface AreaRef {
  bx: number;
  avg: number;
  wavg: number;
}

interface SddVars {
  max: number;
  min: number;
  x1: number;
  csum: number;
  supplyArea: AreaRef | null;
  demandArea: AreaRef | null;
  prevDay: number;
}

interface SddRun extends BarRunState<SddVars> {
  /** Every drawing in creation order (the oldest beyond the limit are left out in result) */
  boxes: Bx[];
  lines: Ln[];
}

/** The drawings kept of `count` created: when a creation brings the count above max + 5, the oldest are deleted until
 *  max remain (the number of the newest kept) */
function keptCount(count: number): number {
  return count <= MAX_OBJECTS + 5 ? count : MAX_OBJECTS + ((count - MAX_OBJECTS - 6) % 6);
}

function study(inputs: Partial<SupplyAndDemandDailyInputs>): BarStudy<SddRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const per = cfg.per;
  const div = Math.trunc(cfg.div);
  let tz = 'UTC';
  return {
    init(_bars, chart) {
      tz = timezoneOf(chart);
      const s: SddRun = {
        boxes: [], lines: [], steps: [],
        vars: { max: 0, min: 0, x1: 0, csum: 0, supplyArea: null, demandArea: null, prevDay: NaN },
        lists: [], series: [],
      };
      s.lists = [s.boxes, s.lines];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { boxes, lines } = s;
      const newArea = (css: string): AreaRef => {
        boxes.push({ left: NaN, top: NaN, right: NaN, bottom: NaN, bg: String(color.new(css, 80)) });
        lines.push({ x1: NaN, x2: NaN, y: NaN, color: css, dashed: false });
        lines.push({ x1: NaN, x2: NaN, y: NaN, color: css, dashed: true });
        return { bx: boxes.length - 1, avg: lines.length - 2, wavg: lines.length - 1 };
      };
      /** method set_area (on the drawings of the bar that creates them) */
      const setArea = (
        id: AreaRef, bar: number, x1: number, top: number, btm: number, avg: number, wavg: number,
        showArea: boolean, showAvg: boolean, showWavg: boolean,
      ) => {
        if (showArea) {
          const bx = boxes[id.bx];
          bx.left = x1;
          bx.top = top;
          bx.right = bar;
          bx.bottom = btm;
        }
        if (showAvg) {
          const l = lines[id.avg];
          l.x1 = x1;
          l.x2 = bar;
          l.y = avg;
        }
        if (showWavg) {
          const l = lines[id.wavg];
          l.x1 = x1;
          l.x2 = bar;
          l.y = wavg;
        }
      };

      const b = bars[i];
      const prev = i > 0 ? bars[i - 1] : null;
      // Accumulate (math.max / math.min with an na value give na)
      v.max = prev === null || isNaN(v.max) ? NaN : Math.max(prev.high, v.max);
      v.min = prev === null || isNaN(v.min) ? NaN : Math.min(prev.low, v.min);
      v.csum += prev === null ? NaN : (prev.volume ?? NaN);
      const { max, min, csum, x1 } = v;

      const day = ptime.dayofmonth(b.time * 1000, tz);
      if (i > 0 && day !== v.prevDay) {
        const r = (max - min) / div;
        const supply: Bin = { lvl: max, prev: max, sum: 0, prevSum: 0, csum: 0, avg: 0, isreached: false };
        const demand: Bin = { lvl: min, prev: min, sum: 0, prevSum: 0, csum: 0, avg: 0, isreached: false };
        // for j = 1 to (n - x1) - 1: a loop whose end is below its start counts down (daily bars: j = 1, 0)
        const end = i - x1 - 1;
        const step = end >= 1 ? 1 : -1;
        // Loop through the intervals
        intervals: for (let k = 0; k < div; k++) {
          supply.lvl -= r;
          demand.lvl += r;
          // Loop through the bars; each bar has one intrabar, the bar itself
          for (let j = 1; step > 0 ? j <= end : j >= end; j += step) {
            const bj = bars[i - j];
            const vol = bj.volume ?? NaN;
            // Accumulate if within the upper interval
            supply.sum += gt(bj.high, supply.lvl) && lt(bj.high, supply.prev) ? vol : 0;
            supply.avg += supply.lvl * (supply.sum - supply.prevSum);
            supply.csum += supply.sum - supply.prevSum;
            supply.prevSum = supply.sum;
            // Accumulate if within the lower interval
            demand.sum += lt(bj.low, demand.lvl) && gt(bj.low, demand.prev) ? vol : 0;
            demand.avg += demand.lvl * (demand.sum - demand.prevSum);
            demand.csum += demand.sum - demand.prevSum;
            demand.prevSum = demand.sum;

            // Supply: the accumulated volume is above the threshold
            if (gt((supply.sum / csum) * 100, per) && !supply.isreached) {
              const avg = (max + supply.lvl) / 2;
              const wavg = supply.avg / supply.csum;
              if (cfg.showSupply) {
                v.supplyArea = newArea(cfg.supplyCss);
                setArea(v.supplyArea, i, x1, max, supply.lvl, avg, wavg, cfg.supplyArea, cfg.supplyAvg, cfg.supplyWavg);
              }
              supply.isreached = true;
            }
            // Demand: the accumulated volume is above the threshold
            if (gt((demand.sum / csum) * 100, per) && !demand.isreached && cfg.showDemand) {
              const avg = (min + demand.lvl) / 2;
              const wavg = demand.avg / demand.csum;
              v.demandArea = newArea(cfg.demandCss);
              setArea(v.demandArea, i, x1, demand.lvl, min, avg, wavg, cfg.demandArea, cfg.demandAvg, cfg.demandWavg);
              demand.isreached = true;
            }
            // The original only leaves the loop of the bars here; nothing more can change once both are found
            if (supply.isreached && demand.isreached) break intervals;
          }
          supply.prev = supply.lvl;
          demand.prev = demand.lvl;
        }
        v.max = b.high;
        v.min = b.low;
        v.csum = b.volume ?? NaN;
        v.x1 = i;
      }
      v.prevDay = day;
    },
    result(s, bars, chart) {
      const n = bars.length;
      if (cfg.tf !== '' && n > 0) {
        const chartTf = chartTimeframe(bars, chart);
        if (chartTf === '' || timeframe.in_seconds(cfg.tf) !== timeframe.in_seconds(chartTf)) {
          throw new Error('Supply and Demand Daily: "Intrabar TF" needs the bars of a lower timeframe, which the chart bars do not have');
        }
      }
      // Last bar: the latest zones reach the current bar (their right / x2 replaced in the output)
      const extBoxes = new Set<number>();
      const extLines = new Set<number>();
      if (n > 0) {
        const extend = (area: AreaRef | null) => {
          if (area === null) throw new Error("Cannot access the 'area.bx' field of an undefined object. The object is 'na'.");
          extBoxes.add(area.bx);
          extLines.add(area.avg);
          extLines.add(area.wavg);
        };
        if (cfg.showSupply) extend(s.vars.supplyArea);
        if (cfg.showDemand) extend(s.vars.demandArea);
      }
      const last = n - 1;
      const interval = barInterval(bars);
      const T = (index: number) => barTime(bars, index, interval);
      const boxes: BoxData[] = [];
      for (let k = s.boxes.length - keptCount(s.boxes.length); k < s.boxes.length; k++) {
        const b = s.boxes[k];
        const right = extBoxes.has(k) ? last : b.right;
        // an object with an na coordinate is not drawn
        if (isNaN(b.left) || isNaN(b.top) || isNaN(b.bottom) || isNaN(right)) continue;
        boxes.push({ time1: T(b.left), price1: b.top, time2: T(right), price2: b.bottom, bgColor: b.bg, borderColor: 'transparent' });
      }
      const lines: LineDrawingData[] = [];
      for (let k = s.lines.length - keptCount(s.lines.length); k < s.lines.length; k++) {
        const l = s.lines[k];
        const x2 = extLines.has(k) ? last : l.x2;
        if (isNaN(l.x1) || isNaN(x2) || isNaN(l.y)) continue;
        lines.push({
          time1: T(l.x1), price1: l.y, time2: T(x2), price2: l.y, color: l.color,
          ...(l.dashed ? { style: 'dashed' as const } : {}),
        });
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        boxes,
        lines,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupplyAndDemandDailyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SupplyAndDemandDailyInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { boxes: BoxData[]; lines: LineDrawingData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const SupplyAndDemandDaily = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
