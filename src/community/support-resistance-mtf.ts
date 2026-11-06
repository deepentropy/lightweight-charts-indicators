/**
 * Support Resistance MTF
 *
 * Two pairs of levels:
 * - chart levels: the latest bar that made the highest high (lowest low) of the last "Period" bars gives the
 *   resistance (support) of the chart timeframe;
 * - higher timeframe levels: the running high (low) of the current period of the higher timeframe, when it is above
 *   (below) the running value at the end of each of the "Period" - 1 periods before, gives the resistance (support)
 *   of the higher timeframe.
 * Each level is drawn only while it does not change, and the area between the two resistances (and between the two
 * supports) is filled. "Extend Lines" adds four lines at the levels of the last bar, extended to the left.
 *
 * The "Auto" higher timeframe depends on the chart timeframe: 1 and 3 minutes use 15 minutes; 5 and 15 minutes use
 * 60; 30 and 45 use 120; 60 uses 240; 120, 180 and 240 use the day; the day uses the week; the week uses the month;
 * any other chart timeframe uses 12 months.
 *
 * Chart values (third argument): the chart timeframe (`chart.timeframe`; without it, it is taken from the bars) and
 * the exchange calendar for the periods of the higher timeframe (without it: the UTC calendar and the bars, see
 * src/anchor-period.ts).
 *
 * Reference: "Support Resistance MTF" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { periodStarts, chartTimeframe } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import type { LineDrawingData } from '../types';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SupportResistanceMtfInputs {
  src: 'High/Low' | 'Close/Open';
  /** Higher timeframe: 'Auto' or a timeframe */
  timeframeU: 'Auto' | '15' | '30' | '60' | '120' | '180' | '240' | '720' | 'D' | 'W' | '2W' | 'M' | '3M' | '6M' | '12M';
  /** Period for the highest / lowest bars */
  prd: number;
  resistanceCol: string;
  supportCol: string;
  /** Transparency of the zones (0 to 100) */
  transp: number;
  extendLines: boolean;
}

export const defaultInputs: SupportResistanceMtfInputs = {
  src: 'High/Low',
  timeframeU: 'Auto',
  prd: 10,
  resistanceCol: '#FF5252',
  supportCol: '#00E676',
  transp: 80,
  extendLines: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'string', title: 'Source', defval: 'High/Low', options: ['High/Low', 'Close/Open'] },
  {
    id: 'timeframeU', type: 'string', title: 'Higher Time Frame', defval: 'Auto',
    options: ['Auto', '15', '30', '60', '120', '180', '240', '720', 'D', 'W', '2W', 'M', '3M', '6M', '12M'],
  },
  { id: 'prd', type: 'int', title: 'Period for Highest/Lowest Bars', defval: 10, min: 1 },
  { id: 'resistanceCol', type: 'color', title: 'Resistance Color', defval: '#FF5252' },
  { id: 'supportCol', type: 'color', title: 'Support Color', defval: '#00E676' },
  { id: 'transp', type: 'int', title: 'Transparency for Zones', defval: 80, min: 0, max: 100 },
  { id: 'extendLines', type: 'bool', title: 'Extend Lines', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: '#2196F3', lineWidth: 1 },
  { id: 'plot1', title: 'Support', color: '#2196F3', lineWidth: 1 },
  { id: 'plot2', title: 'Higher Timeframe Resistance', color: '#2196F3', lineWidth: 1 },
  { id: 'plot3', title: 'Higher Timeframe Support', color: '#2196F3', lineWidth: 1 },
];

export const metadata = {
  title: 'Support Resistance MTF',
  shortTitle: 'Support Resistance MTF',
  overlay: true,
};

/** Pine float comparisons: a == b within 1e-10, a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

/** The "Auto" timeframe of a chart timeframe (timeframe.period: "15", "60", "D", "W" ...) */
function autoTimeframe(period: string): string {
  switch (period) {
    case '1': case '3': return '15';
    case '5': case '15': return '60';
    case '30': case '45': return '120';
    case '60': return '240';
    case '120': case '180': case '240': return 'D';
    case 'D': return 'W';
    case 'W': return 'M';
    default: return '12M';
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'lines'> & { lines: LineDrawingData[] };

/** timeframe.period of the chart ("D" / "W" / "M" without the multiplier 1) and the higher timeframe */
function timeframes(bars: Bar[], chart: ChartContext | undefined, mode: SupportResistanceMtfInputs['timeframeU']) {
  const period = chartTimeframe(bars, chart).replace(/^1(?=[DWM]$)/, '');
  return mode === 'Auto' ? autoTimeframe(period) : mode;
}

/** Bars on Saturdays or Sundays (periodStarts reads it from the whole bar set) */
function hasWeekend(bars: Bar[]): boolean {
  const ms = bars.length > 0 && bars[0].time >= 1e12;
  return bars.some((b) => {
    const wd = new Date(ms ? b.time : b.time * 1000).getUTCDay();
    return wd === 0 || wd === 6;
  });
}

interface SrRun extends BarRunState<Record<string, never>> {
  tf: string;
  chart: ChartContext;
  /** time(Timeframe) of the bars of the current update (calculated once per update) */
  starts: number[];
  startsOf: Bar[] | null;
  /** ta.highestbars(srch, prd) == 0 / ta.lowestbars(srcl, prd) == 0: the current value is the extreme of the window */
  hiMax: WindowExtreme;
  loMin: WindowExtreme;
  hc: number[];
  lc: number[];
  htfh: number[];
  htfl: number[];
  hh: number[];
  ll: number[];
  newbar: boolean[];
  plots: Point[][];
  resFill: string[];
  supFill: string[];
}

function study(inputs: Partial<SupportResistanceMtfInputs>): BarStudy<SrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const prd = Math.trunc(cfg.prd);
  const highLow = cfg.src === 'High/Low';
  const resFill = String(color.new(cfg.resistanceCol, cfg.transp));
  const supFill = String(color.new(cfg.supportCol, cfg.transp));

  /**
   * highestbar() / lowestbar() of the original: counts the period starts back from bar i for which the running
   * value of the bar before the start is below (above) the current value; true when `len` values are reached.
   */
  const extreme = (newbar: boolean[], i: number, values: number[], len: number, breaks: (now: number, before: number) => boolean) => {
    let count = 1;
    if (len > 1) {
      for (let x = 0; x <= 4000; x++) {
        // na(newbar[x]) or na(close[x + 1])
        if (i - x - 1 < 0) break;
        if (newbar[i - x]) {
          if (breaks(values[i], values[i - x - 1])) break;
          count++;
          if (count >= len) break;
        }
      }
    }
    return count >= len;
  };

  const same = (v: number[], i: number) => i > 0 && eq(v[i], v[i - 1]);

  return {
    // the higher timeframe from the bar gaps; the periods of symbols with weekend bars start on UTC days
    key: (bars, chart) => `${timeframes(bars, chart, cfg.timeframeU)}|${hasWeekend(bars)}`,
    init(bars, chart) {
      const tf = timeframes(bars, chart, cfg.timeframeU);
      if (!timeframe.info(tf).period) throw new RangeError(`Unsupported timeframe "${tf}"`);
      const s: SrRun = {
        tf, chart, starts: [], startsOf: null,
        hiMax: new WindowExtreme(false, prd), loMin: new WindowExtreme(true, prd),
        hc: [], lc: [], htfh: [], htfl: [], hh: [], ll: [], newbar: [],
        plots: [[], [], [], []], resFill: [], supFill: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.hiMax, s.loMin];
      s.series = [s.hc, s.lc, s.htfh, s.htfl, s.hh, s.ll, s.newbar, ...s.plots, s.resFill, s.supFill];
      return s;
    },
    bar(s, i, bars) {
      // newbar = change(time(Timeframe)) != 0: na on the first bar
      if (s.startsOf !== bars) {
        s.starts = periodStarts(bars, s.tf, s.chart);
        s.startsOf = bars;
      }
      const b = bars[i];
      const srch = highLow ? b.high : Math.max(b.close, b.open);
      const srcl = highLow ? b.low : Math.min(b.close, b.open);
      const hbar0 = Number.isFinite(srch) && s.hiMax.step(srch) === srch;
      const lbar0 = Number.isFinite(srcl) && s.loMin.step(srcl) === srcl;
      const { hc, lc, htfh, htfl, hh, ll, newbar } = s;
      hc[i] = hbar0 ? srch : i > 0 ? hc[i - 1] : NaN;
      lc[i] = lbar0 ? srcl : i > 0 ? lc[i - 1] : NaN;

      newbar[i] = i > 0 && s.starts[i] !== s.starts[i - 1];
      if (newbar[i]) {
        htfh[i] = srch;
        htfl[i] = srcl;
      } else {
        // max() / min() with an na value give na: the levels start on the first new period
        const ph = i > 0 ? htfh[i - 1] : NaN;
        const pl = i > 0 ? htfl[i - 1] : NaN;
        htfh[i] = isNaN(ph) ? NaN : Math.max(ph, srch);
        htfl[i] = isNaN(pl) ? NaN : Math.min(pl, srcl);
      }

      const hbar = extreme(newbar, i, htfh, prd, le);
      const lbar = extreme(newbar, i, htfl, prd, ge);
      hh[i] = hbar ? htfh[i] : i > 0 ? hh[i - 1] : 0;
      ll[i] = lbar ? htfl[i] : i > 0 ? ll[i - 1] : 0;

      const t = b.time;
      const sameHc = same(hc, i);
      const sameLc = same(lc, i);
      const sameHh = same(hh, i);
      const sameLl = same(ll, i);
      s.plots[0][i] = { time: t, value: hc[i], color: sameHc ? cfg.resistanceCol : 'transparent' };
      s.plots[1][i] = { time: t, value: lc[i], color: sameLc ? cfg.supportCol : 'transparent' };
      s.plots[2][i] = { time: t, value: hh[i], color: sameHh ? cfg.resistanceCol : 'transparent' };
      s.plots[3][i] = { time: t, value: ll[i], color: sameLl ? cfg.supportCol : 'transparent' };
      s.resFill[i] = sameHc && sameHh ? resFill : 'transparent';
      s.supFill[i] = sameLc && sameLl ? supFill : 'transparent';
    },
    result(s, bars) {
      const n = bars.length;
      const lines: LineDrawingData[] = [];
      if (cfg.extendLines && n > 1) {
        // The four lines are deleted and drawn again on every bar: those of the last bar remain
        const last = n - 1;
        const level = (price: number, css: string) => {
          if (!isNaN(price)) {
            lines.push({ time1: bars[last].time, price1: price, time2: bars[last - 1].time, price2: price, color: css, extend: 'left' });
          }
        };
        level(s.lc[last], cfg.supportCol);
        level(s.ll[last], cfg.supportCol);
        level(s.hc[last], cfg.resistanceCol);
        level(s.hh[last], cfg.resistanceCol);
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
        },
        fills: [
          { plot1: 'plot2', plot2: 'plot0', colors: s.resFill.slice() },
          { plot1: 'plot3', plot2: 'plot1', colors: s.supFill.slice() },
        ],
        lines,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupportResistanceMtfInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SupportResistanceMtfInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const SupportResistanceMtf = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
