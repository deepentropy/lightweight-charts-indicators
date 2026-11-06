/**
 * Mean Reversion Channel - (fareid's MRI Variant)
 *
 * A channel around a smoothed mean of the price. The mean is the SuperSmoother filter of the source (or one of the
 * Ehlers "Swiss Army Knife" filters: Ehlers EMA, Gaussian, Butterworth, BandStop, SMA, EMA, RMA). The channel size
 * is the SuperSmoother of the true range: inner channel (R1 / S1) = mean +- range * pi * inner multiplier, outer
 * channel (R2 / S2) = mean +- range * pi * outer multiplier. Around each outer band a zone of eight coloured layers
 * goes from band - 2 ranges to band + 2 ranges (half a range per layer).
 *
 * On the last bar the five levels are extended to the left with lines, and a label ("Check MTF", with the full text
 * as tooltip, or the full text with "Always Display") gives the state of the price in the channel (overbought /
 * oversold weak, normal or strong; near, above or below the mean) and its distance from the mean in percent, on the
 * chart timeframe and on two higher timeframes of the same symbol. "Auto" picks the two timeframes from the chart
 * timeframe (e.g. W and M on a daily chart, 240 and D on a 60-minute chart).
 *
 * Higher timeframes: their bars are built from the chart bars (periods from the UTC calendar and the bars, see
 * src/anchor-period.ts), so their filters start at the first chart bar. The label shows the latest completed bar of
 * each timeframe (every bar is taken as a closed bar). A timeframe below the chart timeframe needs data that the bars
 * do not carry: the port throws an Error.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), and a bar of a higher timeframe is complete on the chart bar whose close reaches the end of
 * its period, see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "Mean Reversion Channel - (fareid's MRI Variant)" by fareidzulkifli
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Author: ©fareidzulkifli. REUSING THIS CODE: You are welcome to reuse this code without
 * permission, including in closed-source publications, as long as proper credits are given.
 */

import {
  str, color, timeframe,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MeanReversionChannelInputs {
  /** Section title of the original settings (no effect) */
  indiSet: boolean;
  /** Price Source */
  source: SourceType;
  /** Filter Type */
  type: 'SuperSmoother' | 'Ehlers EMA' | 'Gaussian' | 'Butterworth' | 'BandStop' | 'SMA' | 'EMA' | 'RMA';
  /** Lookback Period */
  length: number;
  /** Inner Channel Size Multiplier */
  innermult: number;
  /** Outer Channel Size Multiplier */
  outermult: number;
  /** Section title of the original settings (no effect) */
  chartSet: boolean;
  /** Draw Channel */
  drawchannel: boolean;
  /** Draw Zone (With Channel) */
  displayzone: boolean;
  /** Zone Transparency */
  zonetransp: number;
  /** Display Line Extension */
  displayline: boolean;
  /** Section title of the original settings (no effect) */
  mtfSet: boolean;
  /** Enable Multiple TimeFrame Analysis */
  enableMtf: boolean;
  /** MTF Display Type */
  mtfDispTyp: 'Always Display' | 'On Hover';
  /** Multiple TimeFrame Type */
  mtfTyp: 'Auto' | 'Custom';
  /** Custom MTF Level 1 */
  mtfLvl1: string;
  /** Custom MTF Level 2 */
  mtfLvl2: string;
}

export const defaultInputs: MeanReversionChannelInputs = {
  indiSet: false,
  source: 'hlc3',
  type: 'SuperSmoother',
  length: 200,
  innermult: 1.0,
  outermult: 2.415,
  chartSet: false,
  drawchannel: true,
  displayzone: true,
  zonetransp: 60,
  displayline: true,
  mtfSet: false,
  enableMtf: true,
  mtfDispTyp: 'On Hover',
  mtfTyp: 'Auto',
  mtfLvl1: 'D',
  mtfLvl2: 'W',
};

export const inputConfig: InputConfig[] = [
  { id: 'indiSet', type: 'bool', title: '═════════ MRC Parameter ════════', defval: false },
  { id: 'source', type: 'source', title: 'Price Source', defval: 'hlc3' },
  { id: 'type', type: 'string', title: 'Filter Type', defval: 'SuperSmoother', options: ['SuperSmoother', 'Ehlers EMA', 'Gaussian', 'Butterworth', 'BandStop', 'SMA', 'EMA', 'RMA'] },
  { id: 'length', type: 'int', title: 'Lookback Period', defval: 200, min: 1 },
  { id: 'innermult', type: 'float', title: 'Inner Channel Size Multiplier', defval: 1.0, min: 0.1 },
  { id: 'outermult', type: 'float', title: 'Outer Channel Size Multiplier', defval: 2.415, min: 0.1 },
  { id: 'chartSet', type: 'bool', title: '═════════ Chart Setting ════════', defval: false },
  { id: 'drawchannel', type: 'bool', title: 'Draw Channel', defval: true },
  { id: 'displayzone', type: 'bool', title: 'Draw Zone (With Channel)', defval: true },
  { id: 'zonetransp', type: 'int', title: 'Zone Transparency', defval: 60, min: 0, max: 100 },
  { id: 'displayline', type: 'bool', title: 'Display Line Extension', defval: true },
  { id: 'mtfSet', type: 'bool', title: '═════════ MTF Setting ════════', defval: false },
  { id: 'enableMtf', type: 'bool', title: 'Enable Multiple TimeFrame Analysis', defval: true },
  { id: 'mtfDispTyp', type: 'string', title: 'MTF Display Type', defval: 'On Hover', options: ['Always Display', 'On Hover'] },
  { id: 'mtfTyp', type: 'string', title: 'Multiple TimeFrame Type', defval: 'Auto', options: ['Auto', 'Custom'] },
  { id: 'mtfLvl1', type: 'timeframe', title: 'Custom MTF Level 1', defval: 'D' },
  { id: 'mtfLvl2', type: 'timeframe', title: 'Custom MTF Level 2', defval: 'W' },
];

// Colour constants of Pine version 4
const MEAN = '#FFCD00';
const GREEN = '#4CAF50';
const RED = '#FF5252';
const BLACK = '#363A45';
const WHITE = '#FFFFFF';
/** Zone colours, from the outside of the zone to the inside */
const ZONE = ['#FF0000', '#FF4200', '#FF5D00', '#FF7400', '#FF9700', '#FFAE00', '#FFC500', '#FFCD00'];

/** The 18 zone edges: upper edge k and lower edge k (k = 1 to 9), not drawn; the fills run between them */
const zonePlots: PlotConfig[] = [];
for (let k = 1; k <= 9; k++) {
  zonePlots.push({ id: `plot${3 + 2 * k}`, title: `Upper Zone Edge ${k}`, color: 'transparent', lineWidth: 1, display: 'none' });
  zonePlots.push({ id: `plot${4 + 2 * k}`, title: `Lower Zone Edge ${k}`, color: 'transparent', lineWidth: 1, display: 'none' });
}

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: ' Mean', color: MEAN, lineWidth: 2 },
  { id: 'plot1', title: ' R1', color: String(color.new(GREEN, 50)), lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: ' S1', color: String(color.new(GREEN, 50)), lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: ' R2', color: String(color.new(RED, 50)), lineWidth: 1 },
  { id: 'plot4', title: ' S2', color: String(color.new(RED, 50)), lineWidth: 1 },
  ...zonePlots,
];

export const metadata = {
  title: 'Mean Reversion Channel - MRI Variant',
  shortTitle: 'MRC',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (v: number | undefined, other = 0) => (v === undefined || isNaN(v) ? other : v);

const PI = 2 * Math.asin(1);
const GRADSIZE = 0.5;

/**
 * security(syminfo.tickerid, tf, ...) without lookahead: the bars of timeframe `tf` built from the chart bars, and
 * for each chart bar the index of the latest completed bar of that timeframe (-1: none yet).
 */
function timeframeBars(bars: Bar[], tf: string, context?: ChartContext): { htf: Bar[]; latest: number[] } {
  const chart = chartTimeframe(bars, context);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, latest: bars.map((_b, i) => i) };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`Mean Reversion Channel: the timeframe "${tf}" is lower than the chart timeframe "${chart}": the chart bars do not have that data`);
  }
  // The periods and the bars that complete them: the exchange calendar of the chart context (time zone and
  // session), else the UTC calendar rule; grouped and completed by the library (see anchor-period.ts)
  return higherTimeframeBars(bars, tf, context);
}

/** supersmoother() coefficients: 2-pole filter */
function ssCoefs(length: number): { c1: number; c2: number; c3: number } {
  const a1 = Math.exp((-Math.sqrt(2) * PI) / length);
  const b1 = 2 * a1 * Math.cos((Math.sqrt(2) * PI) / length);
  const c3 = -Math.pow(a1, 2);
  const c2 = b1;
  const c1 = 1 - c2 - c3;
  return { c1, c2, c3 };
}

/** supersmoother() on bar i (src and ss by bar, ss up to bar i - 1): the first values are seeded with the source */
function ssAt(src: number[], ss: number[], i: number, c: { c1: number; c2: number; c3: number }): number {
  const s1 = i >= 1 ? src[i - 1] : NaN;
  const s2 = i >= 2 ? src[i - 2] : NaN;
  return c.c1 * src[i]! + c.c2 * nz(ss[i - 1], s1) + c.c3 * nz(ss[i - 2], s2);
}

interface SakCoefs { c0: number; c1: number; b0: number; b1: number; b2: number; a1: number; a2: number; length: number }

/** SAK_smoothing() coefficients: Ehlers "Swiss Army Knife" filter */
function sakCoefs(type: string, length: number): SakCoefs {
  let c0 = 1.0;
  let c1 = 0.0;
  let b0 = 1.0;
  let b1 = 0.0;
  let b2 = 0.0;
  let a1 = 0.0;
  let a2 = 0.0;
  let alpha = 0.0;
  let beta = 0.0;
  const cycle = (2 * PI) / length;
  if (type === 'Ehlers EMA') {
    alpha = (Math.cos(cycle) + Math.sin(cycle) - 1) / Math.cos(cycle);
    b0 = alpha;
    a1 = 1 - alpha;
  }
  if (type === 'Gaussian') {
    beta = 2.415 * (1 - Math.cos(cycle));
    alpha = -beta + Math.sqrt(beta * beta + 2 * beta);
    c0 = alpha * alpha;
    a1 = 2 * (1 - alpha);
    a2 = -(1 - alpha) * (1 - alpha);
  }
  if (type === 'Butterworth') {
    beta = 2.415 * (1 - Math.cos(cycle));
    alpha = -beta + Math.sqrt(beta * beta + 2 * beta);
    c0 = (alpha * alpha) / 4;
    b1 = 2;
    b2 = 1;
    a1 = 2 * (1 - alpha);
    a2 = -(1 - alpha) * (1 - alpha);
  }
  if (type === 'BandStop') {
    beta = Math.cos(cycle);
    const gamma = 1 / Math.cos(cycle * 2 * 0.1);
    alpha = gamma - Math.sqrt(gamma * gamma - 1);
    c0 = (1 + alpha) / 2;
    b1 = -2 * beta;
    b2 = 1;
    a1 = beta * (1 + alpha);
    a2 = -alpha;
  }
  if (type === 'SMA') {
    c1 = 1 / length;
    b0 = 1 / length;
    a1 = 1;
  }
  if (type === 'EMA') {
    alpha = 2 / (length + 1);
    b0 = alpha;
    a1 = 1 - alpha;
  }
  if (type === 'RMA') {
    alpha = 1 / length;
    b0 = alpha;
    a1 = 1 - alpha;
  }
  return { c0, c1, b0, b1, b2, a1, a2, length };
}

/** SAK_smoothing() on bar i (src and out by bar, out up to bar i - 1) */
function sakAt(src: number[], out: number[], i: number, c: SakCoefs): number {
  const at = (k: number) => (i - k >= 0 ? nz(src[i - k]) : 0);
  return c.c0 * (c.b0 * src[i]! + c.b1 * at(1) + c.b2 * at(2)) + c.a1 * nz(out[i - 1]) + c.a2 * nz(out[i - 2]) - c.c1 * at(c.length);
}

interface Mrc {
  source: number[]; tr: number[];
  meanline: number[]; meanrange: number[]; upband1: number[]; loband1: number[]; upband2: number[]; loband2: number[];
  condition: number[];
}

/** get_mrc() of one timeframe, bar by bar */
class MrcCalc {
  private readonly ss: { c1: number; c2: number; c3: number };
  private readonly sak: SakCoefs | null;
  private readonly value: (b: Bar) => number;
  private readonly mult: number;
  private readonly mult2: number;

  constructor(cfg: MeanReversionChannelInputs) {
    this.ss = ssCoefs(cfg.length);
    this.sak = cfg.type === 'SuperSmoother' ? null : sakCoefs(cfg.type, cfg.length);
    this.value = barSource(cfg.source);
    this.mult = PI * cfg.innermult;
    this.mult2 = PI * cfg.outermult;
  }

  /** Bar i of `bars` into the arrays of `out` */
  bar(out: Mrc, i: number, bars: Bar[]): void {
    const b = bars[i]!;
    const { high, low, close } = b;
    out.source[i] = this.value(b);
    // tr: na on the first bar
    out.tr[i] = i === 0 ? NaN
      : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1]!.close), Math.abs(b.low - bars[i - 1]!.close));
    const range = ssAt(out.tr, out.meanrange, i, this.ss);
    out.meanrange[i] = range;
    const mean = this.sak ? sakAt(out.source, out.meanline, i, this.sak) : ssAt(out.source, out.meanline, i, this.ss);
    out.meanline[i] = mean;
    const upband2 = mean + range * this.mult2;
    const loband2 = mean - range * this.mult2;
    out.upband1[i] = mean + range * this.mult;
    out.loband1[i] = mean - range * this.mult;
    out.upband2[i] = upband2;
    out.loband2[i] = loband2;
    let condition = 0;
    if (gt(close, mean)) {
      const upband21 = upband2 + range * GRADSIZE * 4;
      const upband29 = upband2 + range * GRADSIZE * -4;
      if (ge(high, upband29) && lt(high, upband2)) condition = 1;
      else if (ge(high, upband2) && lt(high, upband21)) condition = 2;
      else if (ge(high, upband21)) condition = 3;
      else if (le(close, mean + range)) condition = 4;
      else condition = 5;
    }
    if (lt(close, mean)) {
      const loband21 = loband2 - range * GRADSIZE * 4;
      const loband29 = loband2 - range * GRADSIZE * -4;
      if (le(low, loband29) && gt(low, loband2)) condition = -1;
      else if (le(low, loband2) && gt(low, loband21)) condition = -2;
      else if (le(low, loband21)) condition = -3;
      else if (ge(close, mean + range)) condition = -4;
      else condition = -5;
    }
    out.condition[i] = condition;
  }
}

const emptyMrc = (): Mrc => ({
  source: [], tr: [], meanline: [], meanrange: [], upband1: [], loband1: [], upband2: [], loband2: [], condition: [],
});

/** get_mrc() on the bars of one timeframe */
function getMrc(bars: Bar[], cfg: MeanReversionChannelInputs): Mrc {
  const calc = new MrcCalc(cfg);
  const out = emptyMrc();
  for (let i = 0; i < bars.length; i++) calc.bar(out, i, bars);
  return out;
}

/** get_stat() */
function getStat(cond: number): string {
  switch (cond) {
    case 1: return 'Overbought (Weak)\n';
    case 2: return 'Overbought\n';
    case 3: return 'Overbought (Strong)\n';
    case 4: return 'Price Near Mean\n';
    case 5: return 'Price Above Mean\n';
    case -1: return 'Oversold (Weak)\n';
    case -2: return 'Oversold\n';
    case -3: return 'Oversold (Strong)\n';
    case -4: return 'Price Near Mean\n';
    case -5: return 'Price Below Mean\n';
    default: return 'Price at Mean Line\n';
  }
}

type Point = { time: number; value: number };
type Result = IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[] };

/** A timeframe of the label on the last bar: the value of its latest completed bar */
interface MtfValue {
  mean: number;
  condition: number;
  /** True when that bar contains the last chart bar (its value changes with the prices of the forming bar) */
  readsLast: boolean;
}

/**
 * The label values of the previous update. The periods of the timeframes and the chart timeframe come from the bar
 * times only: an update with the same bars but the last one (resumed on the forming bar, same time) has the same
 * periods, and the value of a completed bar that does not contain the last chart bar does not change.
 */
interface MtfCache {
  n: number;
  lastTime: number;
  chartTf: string;
  values: Map<string, MtfValue>;
}

interface MrcRun extends BarRunState<Record<string, never>> {
  calc: MrcCalc;
  mrc: Mrc;
  /** plot0..plot22 */
  plots: Point[][];
  /** The first bar calculated since the last result */
  firstBar: number;
  cache: MtfCache | null;
}

function study(inputs: Partial<MeanReversionChannelInputs>): BarStudy<MrcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const zone = cfg.drawchannel && cfg.displayzone;
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const mrc = emptyMrc();
      const s: MrcRun = {
        calc: new MrcCalc(cfg), mrc, plots: Array.from({ length: 23 }, () => []), firstBar: Infinity, cache: null,
        steps: [], vars: {}, lists: [], series: [],
      };
      s.series = [...Object.values(mrc), ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      if (i < s.firstBar) s.firstBar = i;
      const m = s.mrc;
      s.calc.bar(m, i, bars);
      const time = bars[i]!.time;
      const p = s.plots;
      const ch = cfg.drawchannel;
      p[0]![i] = { time, value: ch ? m.meanline[i]! : NaN };
      p[1]![i] = { time, value: ch ? m.upband1[i]! : NaN };
      p[2]![i] = { time, value: ch ? m.loband1[i]! : NaN };
      p[3]![i] = { time, value: ch ? m.upband2[i]! : NaN };
      p[4]![i] = { time, value: ch ? m.loband2[i]! : NaN };
      // Zone edges: upband2 + meanrange * gradsize * (5 - k), loband2 - meanrange * gradsize * (5 - k), k = 1 to 9
      const up = m.upband2[i]!;
      const lo = m.loband2[i]!;
      const range = m.meanrange[i]!;
      for (let k = 1; k <= 9; k++) {
        p[3 + 2 * k]![i] = { time, value: zone ? up + range * GRADSIZE * (5 - k) : NaN };
        p[4 + 2 * k]![i] = { time, value: zone ? lo - range * GRADSIZE * (5 - k) : NaN };
      }
    },
    result(s, bars, chart) {
      const n = bars.length;
      const last = n - 1;
      const mrc = s.mrc;
      // the label values of the previous update are kept when only the forming bar (same time) was calculated again
      const prev = s.cache;
      const cached = prev !== null && prev.n === n && s.firstBar === last && n > 0 && bars[last]!.time === prev.lastTime
        ? prev : null;
      s.firstBar = Infinity;
      s.cache = null;
      const values = new Map<string, MtfValue>();
      let chartTf = '';
      const t = (i: number) => bars[i]!.time;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      const fills: NonNullable<IndicatorResult['fills']> = [];
      for (let k = 1; k <= 8; k++) {
        const css = String(color.new(ZONE[k - 1]!, cfg.zonetransp));
        fills.push({ plot1: `plot${3 + 2 * k}`, plot2: `plot${5 + 2 * k}`, options: { color: css } });
        fills.push({ plot1: `plot${4 + 2 * k}`, plot2: `plot${6 + 2 * k}`, options: { color: css } });
      }

      const lines: LineDrawingData[] = [];
      const labels: LabelData[] = [];
      if (n > 0) {
        // if displayline and enable_mtf and mtf_disp_typ == "Always Display": displayline := false
        const displayline = cfg.displayline && !(cfg.enableMtf && cfg.mtfDispTyp === 'Always Display');
        // Level extensions of the last bar: from the last bar to the bar before, extended to the left
        if (displayline && n >= 2) {
          const level = (y: number, css: string) => {
            if (!isNaN(y)) lines.push({ time1: t(last), price1: y, time2: t(last - 1), price2: y, extend: 'left', color: css });
          };
          level(mrc.meanline[last]!, MEAN);
          level(mrc.upband1[last]!, GREEN);
          level(mrc.loband1[last]!, GREEN);
          level(mrc.upband2[last]!, RED);
          level(mrc.loband2[last]!, RED);
        }

        // The label of the last bar: built from the whole bar set on each update (the higher timeframe bars)
        if (cfg.enableMtf && n >= 2 && !isNaN(mrc.meanline[last]!)) {
          // timeframe.period: "D", "W", "M" without a multiplier of 1
          chartTf = cached ? cached.chartTf : chartTimeframe(bars, chart);
          const tfInfo = timeframe.info(chartTf);
          const period = /^1[DWM]$/.test(tfInfo.period) ? tfInfo.period.slice(1) : tfInfo.period;
          // f_resInMinutes()
          const minutes = tfInfo.multiplier * (tfInfo.isseconds ? 1 / 60 : tfInfo.isminutes ? 1 : tfInfo.isdaily ? 60 * 24
            : tfInfo.isweekly ? 60 * 24 * 7 : tfInfo.ismonthly ? 60 * 24 * 30.4375 : NaN);
          // get_tf()
          const getTf = (lvl: 1 | 2): string => {
            if (cfg.mtfTyp !== 'Auto') return lvl === 1 ? cfg.mtfLvl1 : cfg.mtfLvl2;
            const pick = (a: string, b: string) => (lvl === 1 ? a : b);
            if (lt(minutes, 1)) return pick('1', '5');
            if (le(minutes, 3)) return pick('5', '15');
            if (le(minutes, 10)) return pick('15', '60');
            if (le(minutes, 30)) return pick('60', '240');
            if (le(minutes, 120)) return pick('240', 'D');
            if (le(minutes, 240)) return pick('D', 'W');
            if (le(minutes, 1440)) return pick('W', 'M');
            if (le(minutes, 10080)) return pick('M', period);
            return period;
          };
          const tf1 = getTf(1);
          const tf2 = getTf(2);
          const close = bars[last]!.close;
          // security(syminfo.tickerid, tf, get_mrc()) on the last bar: the latest completed bar of the timeframe
          const mtf = (tf: string): { mean: number; condition: number } => {
            const known = cached?.values.get(tf);
            if (known && !known.readsLast) {
              values.set(tf, known);
              return known;
            }
            const { htf, latest, group } = timeframeBars(bars, tf, chart) as { htf: Bar[]; latest: number[]; group?: number[] };
            const k = latest[last]!;
            let v: MtfValue;
            if (k < 0) v = { mean: NaN, condition: NaN, readsLast: false };
            else if (htf === bars) {
              // the chart timeframe: get_mrc() of the chart bars, the values of the run
              v = { mean: mrc.meanline[k]!, condition: mrc.condition[k]!, readsLast: true };
            } else {
              const m = getMrc(htf, cfg);
              v = { mean: m.meanline[k]!, condition: m.condition[k]!, readsLast: !(group && k < group[last]!) };
            }
            values.set(tf, v);
            return v;
          };
          const dist = (mean: number) => `Distance from Mean: ${str.tostring(((close - mean) / close) * 100, '#.##')} %`;
          const brl = '\n--------------------------------------';
          let text = `Mean Reversion Channel\nMultiple TimeFrame Analysis${brl}`;
          text += `\n\nTimeframe: ${period} (Current)\n\nStatus: ${getStat(mrc.condition[last]!)}${dist(mrc.meanline[last]!)}${brl}`;
          if (!tfInfo.ismonthly) {
            const m1 = mtf(tf1);
            text += `\n\nTimeframe: ${tf1}\n\nStatus: ${getStat(m1.condition)}${dist(m1.mean)}${brl}`;
          }
          if (!tfInfo.isweekly && !tfInfo.ismonthly) {
            const m2 = mtf(tf2);
            text += `\n\nTimeframe: ${tf2}\n\nStatus: ${getStat(m2.condition)}${dist(m2.mean)}${brl}`;
          }
          const always = cfg.mtfDispTyp === 'Always Display';
          labels.push({
            // x = time + round(change(time) * 20)
            time: t(last) + Math.round((t(last) - t(last - 1)) * 20),
            price: mrc.meanline[last]!,
            text: always ? text : 'Check MTF',
            ...(always ? {} : { tooltip: text }),
            color: BLACK,
            textColor: WHITE,
            size: 'normal',
            style: !always && displayline ? 'label_lower_left' : 'label_left',
            textAlign: 'left',
          });
        }
      }

      if (values.size > 0) s.cache = { n, lastTime: bars[last]!.time as number, chartTf, values };
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        lines,
        labels,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MeanReversionChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MeanReversionChannelInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const MeanReversionChannel = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
