/**
 * [RS] Support and Resistance V0
 *
 * Short-term and long-term support/resistance from the last high (low) that reached the
 * highest high (lowest low) of a lookback window. No pivots.
 *
 * Pine:
 *   short_term_top = ta.valuewhen(h >= ta.highest(h, window1), h, 0)   (bot, long-term: same form)
 *   short_term_resist = ta.change(short_term_top) != 0 ? na : short_term_top   (linebr)
 *   long_term_resist_marker = ta.change(fixnan(long_term_resist)) != 0 ? long_term_resist : na
 *   trade limits: kept from the previous bar while the short-term level lasts.
 *
 * Reference: "[RS]Support and Resistance V0" by RicardoSantos (community)
 */

import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RSSupportResistanceInputs {
  /** Use alternative source? */
  useAltSeries: boolean;
  /** Alternative source */
  altSrc: SourceType;
  /** lookback window 1 */
  window1: number;
  /** lookback window 2 */
  window2: number;
  /** Percent of the diff to use for trade zone */
  tradeZonePct: number;
}

export const defaultInputs: RSSupportResistanceInputs = {
  useAltSeries: false,
  altSrc: 'close',
  window1: 8,
  window2: 21,
  tradeZonePct: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'useAltSeries', type: 'bool', title: 'Use alternative source?', defval: false },
  { id: 'altSrc', type: 'source', title: 'Alternative source:', defval: 'close' },
  { id: 'window1', type: 'int', title: 'lookback window 1:', defval: 8 },
  { id: 'window2', type: 'int', title: 'lookback window 2:', defval: 21 },
  { id: 'tradeZonePct', type: 'float', title: 'Percent of the diff to use for trade zone', defval: 25 },
];

// Pine colours: color.navy #311B92, color.rgb(33,150,243,70), color.blue #2962FF (v5 values), color.red #FF5252, color.lime #00E676
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'STR', color: '#311B92', lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'STS', color: '#311B92', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'LTR', color: 'rgba(33,150,243,0.3)', lineWidth: 4, style: 'linebr' },
  { id: 'plot3', title: 'LTS', color: 'rgba(33,150,243,0.3)', lineWidth: 4, style: 'linebr' },
  { id: 'plot4', title: 'L', color: '#FF5252', lineWidth: 1, style: 'linebr' },
  { id: 'plot5', title: 'L', color: '#00E676', lineWidth: 1, style: 'linebr' },
  { id: 'ltResistMarker', title: '.R', color: '#2962FF', lineWidth: 4, style: 'circles' },
  { id: 'ltSupportMarker', title: '.S', color: '#2962FF', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: '[RS] Support and Resistance V0',
  shortTitle: 'RS S/R',
  overlay: true,
};

/** Pine float comparison: a == b when |a - b| <= 1e-10 */
const EPS = 1e-10;

/**
 * One bar of ta.valuewhen(src >= ta.highest(src, len), src, 0) (isHigh) or the lowest form: the new value, or `last`.
 * Comparisons with na are false.
 */
function lastExtreme(src: number[], i: number, len: number, isHigh: boolean, last: number): number {
  if (i >= len - 1) {
    let ext = NaN;
    for (let j = i - len + 1; j <= i; j++) {
      const v = src[j];
      if (Number.isNaN(v)) continue;
      if (Number.isNaN(ext) || (isHigh ? v > ext : v < ext)) ext = v;
    }
    const v = src[i];
    if (!Number.isNaN(v) && !Number.isNaN(ext) && (isHigh ? ext - v <= EPS : v - ext <= EPS)) return v;
  }
  return last;
}

/** ta.change(x) != 0 on bar i : na when either value is na (then the condition is false). */
function changed(x: number[], i: number): boolean {
  if (i === 0) return false;
  const a = x[i];
  const b = x[i - 1];
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return Math.abs(a - b) > EPS;
}

/** fixnan(x) of one bar from the value of the bar before */
const fixnan = (v: number, last: number) => (Number.isNaN(v) ? last : v);

type Point = { time: number; value: number };

interface RssrVars {
  /** The valuewhen of shortTermTop, shortTermBot, longTermTop, longTermBot */
  last: number[];
  /** fixnan of longTermResist, longTermSuport, shortTermResist, shortTermSuport */
  fixed: number[];
}

interface RssrRun extends BarRunState<RssrVars> {
  h: number[];
  l: number[];
  /** shortTermTop, shortTermBot, longTermTop, longTermBot */
  tops: number[][];
  /** fixnan(longTermResist), fixnan(longTermSuport) */
  fixedLong: number[][];
  resistLimit: number[];
  suportLimit: number[];
  /** plot0..plot5, ltResistMarker, ltSupportMarker */
  plots: Point[][];
}

function study(inputs: Partial<RSSupportResistanceInputs>): BarStudy<RssrRun, IndicatorResult> {
  const { useAltSeries, altSrc, window1, window2, tradeZonePct } = { ...defaultInputs, ...inputs };
  const alt = barSource(altSrc);
  const pct = 0.01 * tradeZonePct;
  return {
    fullRunReason: () => (!useAltSeries || isBarSource(altSrc) ? null : 'source of another study'),
    copyVars: (v) => ({ last: v.last.slice(), fixed: v.fixed.slice() }),
    init() {
      const s: RssrRun = {
        h: [], l: [], tops: [[], [], [], []], fixedLong: [[], []], resistLimit: [], suportLimit: [],
        plots: Array.from({ length: 8 }, () => []),
        steps: [], vars: { last: [NaN, NaN, NaN, NaN], fixed: [NaN, NaN, NaN, NaN] }, lists: [], series: [],
      };
      s.series = [s.h, s.l, ...s.tops, ...s.fixedLong, s.resistLimit, s.suportLimit, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const { last, fixed } = s.vars;
      const a = useAltSeries ? alt(b) : NaN;
      s.h[i] = useAltSeries ? a : b.high;
      s.l[i] = useAltSeries ? a : b.low;

      const tops = s.tops;
      last[0] = lastExtreme(s.h, i, window1, true, last[0]);
      last[1] = lastExtreme(s.l, i, window1, false, last[1]);
      last[2] = lastExtreme(s.h, i, window2, true, last[2]);
      last[3] = lastExtreme(s.l, i, window2, false, last[3]);
      for (let k = 0; k < 4; k++) tops[k][i] = last[k];

      // x_resist = ta.change(top) != 0 ? na : top
      const shortTermResist = changed(tops[0], i) ? NaN : last[0];
      const shortTermSuport = changed(tops[1], i) ? NaN : last[1];
      const longTermResist = changed(tops[2], i) ? NaN : last[2];
      const longTermSuport = changed(tops[3], i) ? NaN : last[3];

      // ta.change(fixnan(level)) != 0 ? level : na
      fixed[0] = fixnan(longTermResist, fixed[0]);
      fixed[1] = fixnan(longTermSuport, fixed[1]);
      s.fixedLong[0][i] = fixed[0];
      s.fixedLong[1][i] = fixed[1];
      const longTermResistMarker = changed(s.fixedLong[0], i) ? longTermResist : NaN;
      const longTermSuportMarker = changed(s.fixedLong[1], i) ? longTermSuport : NaN;

      // Entry zone: diff = fixnan(short_term_resist) - fixnan(short_term_suport)
      fixed[2] = fixnan(shortTermResist, fixed[2]);
      fixed[3] = fixnan(shortTermSuport, fixed[3]);
      const diff = fixed[2] - fixed[3];
      let resistLimit = NaN;
      let suportLimit = NaN;
      if (!Number.isNaN(shortTermResist)) {
        const prev = i > 0 ? s.resistLimit[i - 1] : NaN;
        resistLimit = !Number.isNaN(prev) ? prev : shortTermResist - diff * pct;
      }
      if (!Number.isNaN(shortTermSuport)) {
        const prev = i > 0 ? s.suportLimit[i - 1] : NaN;
        suportLimit = !Number.isNaN(prev) ? prev : shortTermSuport + diff * pct;
      }
      s.resistLimit[i] = resistLimit;
      s.suportLimit[i] = suportLimit;

      const p = s.plots;
      p[0][i] = { time, value: shortTermResist };
      p[1][i] = { time, value: shortTermSuport };
      p[2][i] = { time, value: longTermResist };
      p[3][i] = { time, value: longTermSuport };
      p[4][i] = { time, value: resistLimit };
      p[5][i] = { time, value: suportLimit };
      p[6][i] = { time, value: longTermResistMarker };
      p[7][i] = { time, value: longTermSuportMarker };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': p[0].slice(),
          'plot1': p[1].slice(),
          'plot2': p[2].slice(),
          'plot3': p[3].slice(),
          'plot4': p[4].slice(),
          'plot5': p[5].slice(),
          'ltResistMarker': p[6].slice(),
          'ltSupportMarker': p[7].slice(),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(255,152,0,0.2)', title: 'Resistance' } },
          { plot1: 'plot1', plot2: 'plot3', options: { color: 'rgba(128,128,0,0.2)', title: 'Support' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSSupportResistanceInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSSupportResistanceInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RSSupportResistance = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
