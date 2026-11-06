/**
 * Bjorgum MTF MA
 *
 * Up to three moving averages (EMA, EMA of the Heikin-Ashi open, SMA, HMA, WMA, DEMA, VWMA, VWAP, T3 or the Ehlers
 * instantaneous trendline), each on the chart timeframe or on a higher timeframe of the same symbol. A line has the
 * bull colour while the average rises (or, with the colour type "RSI", a gradient of the RSI between 30 and 70).
 * Bars are coloured from the close against one of the averages, or from one of the RSI gradients. A length of 0
 * hides the second or the third average.
 *
 * Higher timeframe: the bars of that timeframe are built from the chart bars, so its averages start at the first
 * chart bar. A chart bar shows the value of the latest completed bar of the timeframe as it was known one chart bar
 * before (no repainting). With "Smooth" the value is only given on the chart bar after the one that completes a bar
 * of the timeframe, and the line joins these points; without it the value is repeated on every bar (steps). A
 * timeframe below the chart timeframe needs data that the bars do not carry: the port throws an Error. Every bar is
 * taken as a historical bar.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar, see src/anchor-period.ts;
 * without them the port uses the UTC calendar and the bars. The type "VWAP" restarts on each trading day: on
 * intraday bars it needs the time zone and the session of the context and throws an Error without them; on daily
 * and higher bars it is the typical price of the bar.
 *
 * The line widths are inputs in the original; the plots here have the default width of 1.
 *
 * Alerts (alertcondition, `alerts` of the result): the original's 12 conditions, the close crossing above / below
 * each average and each average crossing above / below a later one (the values on the chart timeframe, the step
 * values of a higher timeframe).
 *
 * Reference: "Bjorgum MTF MA" by Bjorgum
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, taStep, Series, getSourceSeries, color, timeframe, mapToChart, heikinAshi,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { periodStarts, chartTimeframe, higherTimeframeBars, hasCalendar } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

type MaType = 'EMA' | 'HEMA' | 'SMA' | 'HMA' | 'WMA' | 'DEMA' | 'VWMA' | 'VWAP' | 'T3' | 'IT';
type ColType = 'RSI' | 'MA';

export interface BjorgumMtfMaInputs {
  /** Higher timeframe values as points joined by the line (true) or as steps (false) */
  smooth: boolean;
  /** Colour the bars */
  bar: boolean;
  /** What the bar colour is based on */
  bartype: 'MA 1' | 'MA 2' | 'MA 3' | 'RSI 1' | 'RSI 2' | 'RSI 3';
  maType1: MaType;
  maType2: MaType;
  maType3: MaType;
  maLength1: number;
  /** 0 disables the second average */
  maLength2: number;
  /** 0 disables the third average */
  maLength3: number;
  /** Source of the instantaneous trendline (type "IT") */
  inp: SourceType;
  /** Alpha of the instantaneous trendline */
  alpha: number;
  /** Timeframe of each average ("" = the chart timeframe) */
  tf1: string;
  tf2: string;
  tf3: string;
  rsiLen: number;
  colType1: ColType;
  colType2: ColType;
  colType3: ColType;
  maBull1: string;
  maBear1: string;
  maBull2: string;
  maBear2: string;
  maBull3: string;
  maBear3: string;
  /** Line transparency (0 to 100) */
  transp1: number;
  transp2: number;
  transp3: number;
  /** Line widths (not applied: the plot width is static) */
  lineW1: number;
  lineW2: number;
  lineW3: number;
  rsiBull1: string;
  rsiBear1: string;
  rsiBull2: string;
  rsiBear2: string;
  rsiBull3: string;
  rsiBear3: string;
}

export const defaultInputs: BjorgumMtfMaInputs = {
  smooth: true,
  bar: true,
  bartype: 'MA 1',
  maType1: 'EMA',
  maType2: 'EMA',
  maType3: 'EMA',
  maLength1: 50,
  maLength2: 0,
  maLength3: 0,
  inp: 'hl2',
  alpha: 0.07,
  tf1: '',
  tf2: '',
  tf3: '',
  rsiLen: 14,
  colType1: 'MA',
  colType2: 'MA',
  colType3: 'MA',
  maBull1: '#64b5f6',
  maBear1: '#ef5350',
  maBull2: '#64b5f6',
  maBear2: '#ef5350',
  maBull3: '#64b5f6',
  maBear3: '#ef5350',
  transp1: 0,
  transp2: 0,
  transp3: 0,
  lineW1: 1,
  lineW2: 1,
  lineW3: 1,
  rsiBull1: '#0000ff',
  rsiBear1: '#ff0000',
  rsiBull2: '#0000ff',
  rsiBear2: '#ff0000',
  rsiBull3: '#0000ff',
  rsiBear3: '#ff0000',
};

const MA_TYPES: MaType[] = ['EMA', 'HEMA', 'SMA', 'HMA', 'WMA', 'DEMA', 'VWMA', 'VWAP', 'T3', 'IT'];
const G_GENERAL = 'General Settings';
const G_TYPE = 'MA Type';
const G_MA = 'MA Settings';
const G_IT = 'IT Trendline';
const G_RES = 'Resolution';
const G_MOM = 'Momentum';
const G_COLTYPE = 'MA Color Type';
const G_COL = 'MA Color/ Transp/ Linewidth';
const G_RSI = 'RSI Based Colors - Bull/ Bear';
const TIP_ZERO = "Setting to zero disables the MA. Use 1,2 or 3 MA's";
const TIP_TF = 'Go multi-time frame with each MA individually! This effects which time frame the RSI color is based from aswell';
const TIP_COLTYPE = 'Choose color scheme. One is based on RSI value, the other a rising or falling MA';
const TIP_MACOL = "These select MA color if you've chosen rising/ falling scheme";
const TIP_RSICOL = "These select MA color if you've chosen momentum based scheme";
const d = defaultInputs;

export const inputConfig: InputConfig[] = [
  { id: 'smooth', type: 'bool', title: 'Smooth', defval: d.smooth, group: G_GENERAL },
  { id: 'bar', type: 'bool', title: 'Bar Color', defval: d.bar, group: G_GENERAL },
  {
    id: 'bartype', type: 'string', title: 'Bar Color Type', defval: d.bartype, group: G_GENERAL,
    options: ['MA 1', 'MA 2', 'MA 3', 'RSI 1', 'RSI 2', 'RSI 3'], tooltip: 'This selects what your bar color is based on',
  },
  { id: 'maType1', type: 'string', title: 'MA Type #1', defval: d.maType1, group: G_TYPE, options: MA_TYPES },
  { id: 'maType2', type: 'string', title: 'MA Type #2', defval: d.maType2, group: G_TYPE, options: MA_TYPES },
  { id: 'maType3', type: 'string', title: 'MA Type #3', defval: d.maType3, group: G_TYPE, options: MA_TYPES },
  { id: 'maLength1', type: 'int', title: 'MA Length #1', defval: d.maLength1, group: G_MA, min: 1 },
  { id: 'maLength2', type: 'int', title: 'MA Length #2', defval: d.maLength2, group: G_MA, tooltip: TIP_ZERO },
  { id: 'maLength3', type: 'int', title: 'MA Length #3', defval: d.maLength3, group: G_MA, tooltip: TIP_ZERO },
  {
    id: 'inp', type: 'source', title: 'Source', defval: d.inp, group: G_IT,
    tooltip: 'These two are inputs strcity pertaining to Ehlers Instantaneous Trendline (IT)',
  },
  { id: 'alpha', type: 'float', title: 'Alpha', defval: d.alpha, group: G_IT, min: 0.01 },
  { id: 'tf1', type: 'timeframe', title: 'Timeframe 1', defval: d.tf1, group: G_RES, tooltip: TIP_TF },
  { id: 'tf2', type: 'timeframe', title: 'Timeframe 2', defval: d.tf2, group: G_RES, tooltip: TIP_TF },
  { id: 'tf3', type: 'timeframe', title: 'Timeframe 3', defval: d.tf3, group: G_RES, tooltip: TIP_TF },
  {
    id: 'rsiLen', type: 'int', title: 'RSI Length', defval: d.rsiLen, group: G_MOM,
    tooltip: 'RSI input is used for momrntum color schemes. Gievs a visual of momentum along with your trend',
  },
  { id: 'colType1', type: 'string', title: 'Color Type 1', defval: d.colType1, group: G_COLTYPE, options: ['RSI', 'MA'], tooltip: TIP_COLTYPE },
  { id: 'colType2', type: 'string', title: 'Color Type 2', defval: d.colType2, group: G_COLTYPE, options: ['RSI', 'MA'], tooltip: TIP_COLTYPE },
  { id: 'colType3', type: 'string', title: 'Color Type 3', defval: d.colType3, group: G_COLTYPE, options: ['RSI', 'MA'], tooltip: TIP_COLTYPE },
  { id: 'maBull1', type: 'color', title: '', defval: d.maBull1, group: G_COL, inline: '1', tooltip: TIP_MACOL },
  { id: 'maBear1', type: 'color', title: '', defval: d.maBear1, group: G_COL, inline: '1', tooltip: TIP_MACOL },
  { id: 'maBull2', type: 'color', title: '', defval: d.maBull2, group: G_COL, inline: '2', tooltip: TIP_MACOL },
  { id: 'maBear2', type: 'color', title: '', defval: d.maBear2, group: G_COL, inline: '2', tooltip: TIP_MACOL },
  { id: 'maBull3', type: 'color', title: '', defval: d.maBull3, group: G_COL, inline: '3', tooltip: TIP_MACOL },
  { id: 'maBear3', type: 'color', title: '', defval: d.maBear3, group: G_COL, inline: '3', tooltip: TIP_MACOL },
  { id: 'transp1', type: 'int', title: '', defval: d.transp1, group: G_COL, inline: '1' },
  { id: 'transp2', type: 'int', title: '', defval: d.transp2, group: G_COL, inline: '2' },
  { id: 'transp3', type: 'int', title: '', defval: d.transp3, group: G_COL, inline: '3' },
  { id: 'lineW1', type: 'int', title: '', defval: d.lineW1, group: G_COL, inline: '1' },
  { id: 'lineW2', type: 'int', title: '', defval: d.lineW2, group: G_COL, inline: '2' },
  { id: 'lineW3', type: 'int', title: '', defval: d.lineW3, group: G_COL, inline: '3' },
  { id: 'rsiBull1', type: 'color', title: '', defval: d.rsiBull1, group: G_RSI, inline: 'a', tooltip: TIP_RSICOL },
  { id: 'rsiBear1', type: 'color', title: '', defval: d.rsiBear1, group: G_RSI, inline: 'a', tooltip: TIP_RSICOL },
  { id: 'rsiBull2', type: 'color', title: '', defval: d.rsiBull2, group: G_RSI, inline: 'b', tooltip: TIP_RSICOL },
  { id: 'rsiBear2', type: 'color', title: '', defval: d.rsiBear2, group: G_RSI, inline: 'b', tooltip: TIP_RSICOL },
  { id: 'rsiBull3', type: 'color', title: '', defval: d.rsiBull3, group: G_RSI, inline: 'c', tooltip: TIP_RSICOL },
  { id: 'rsiBear3', type: 'color', title: '', defval: d.rsiBear3, group: G_RSI, inline: 'c', tooltip: TIP_RSICOL },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moving Average #1', color: '#2196F3', lineWidth: 1 },
  { id: 'plot1', title: 'Moving Average #2', color: '#2196F3', lineWidth: 1 },
  { id: 'plot2', title: 'Moving Average #3', color: '#2196F3', lineWidth: 1 },
];

export const metadata = {
  title: 'Bjorgum MTF MA',
  shortTitle: 'Bj Multi-MA',
  overlay: true,
};

/** Pine float comparison: a >= b when a - b >= -1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => a - b >= -EPS;
const nz = (v: number) => (Number.isNaN(v) ? 0 : v);

/** The bars of a timeframe, with their place on the chart bars */
interface TimeframeBars {
  /** Bars of the timeframe built from the chart bars (the chart bars themselves for the chart timeframe) */
  htf: Bar[];
  /** Index of the bar of the timeframe of each chart bar */
  group: number[];
  /** Index of the first chart bar of each bar of the timeframe */
  first: number[];
  /** For each chart bar, the index of the latest completed bar of the timeframe (-1: none yet) */
  latest: number[];
}

/**
 * security(syminfo.tickerid, tf, ...) without lookahead: the bars of timeframe `tf` built from the chart bars, and
 * for each chart bar the index of the latest completed bar of that timeframe.
 */
function timeframeBars(bars: Bar[], tf: string, context?: ChartContext): TimeframeBars {
  const chart = chartTimeframe(bars, context);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    const own = bars.map((_b, i) => i);
    return { htf: bars, group: own, first: own, latest: own };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`Bjorgum MTF MA: the timeframe "${tf}" is lower than the chart timeframe "${chart}": the chart bars do not have that data`);
  }
  // The periods and the bars that complete them: the exchange calendar of the chart context (time zone and
  // session), else the UTC calendar rule; grouped and completed by the library (see anchor-period.ts)
  return higherTimeframeBars(bars, tf, context);
}

/** One average on the chart bars: the plotted value, its direction, its RSI, the value of the signals, the bar condition */
interface Slot {
  plot: number[];
  con: boolean[];
  rsi: number[];
  sig: number[];
  bar: boolean[];
}

/**
 * The averages calculated with the series of the whole bar set: a higher timeframe (its bars built from the chart
 * bars), the type "VWAP" (sums restarted on each trading day) and the trendline of another study's output.
 */
function arraySlots(bars: Bar[], cfg: BjorgumMtfMaInputs, chart?: ChartContext): (type: MaType, lengthInput: number, tf: string) => Slot {
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const alpha = cfg.alpha;
  const chartTf = chartTimeframe(bars, chart);
  // start of the trading day of each chart bar (only read by the type "VWAP")
  let dayStarts: number[] | null = null;

  /** The series of the script on the bars of one timeframe */
  const seriesOf = (ctx: TimeframeBars, tf: string) => {
    const b = ctx.htf;
    const m = b.length;
    const S = (a: number[]) => Series.fromArray(b, a);
    const close = S(b.map((x) => x.close));
    const volume = b.map((x) => x.volume ?? NaN);

    // _haOpen(): haOpen := na(haOpen[1]) ? (open + close) / 2 : (nz(haOpen[1]) + nz(haClose[1])) / 2, the open of
    // the Heikin Ashi bars
    const haOpen = heikinAshi(b).map((x) => x.open);

    // _itrend(): Ehlers instantaneous trendline of the source input
    const inp = A(getSourceSeries(b, cfg.inp as Parameters<typeof getSourceSeries>[1]));
    const itrend: number[] = new Array(m);
    for (let i = 0; i < m; i++) {
      const s0 = inp[i];
      const s1 = i > 0 ? nz(inp[i - 1]) : 0;
      const s2 = i > 1 ? nz(inp[i - 2]) : 0;
      const t1 = i > 0 ? nz(itrend[i - 1]) : 0;
      const t2 = i > 1 ? nz(itrend[i - 2]) : 0;
      itrend[i] = i < 7
        ? (s0 + 2 * s1 + s2) / 4
        : (alpha - (alpha ** 2) / 4) * s0 + 0.5 * (alpha ** 2) * s1 - (alpha - 0.75 * (alpha ** 2)) * s2
          + 2 * (1 - alpha) * t1 - ((1 - alpha) ** 2) * t2;
    }

    const vwap = (): number[] => {
      const hlc3 = b.map((x) => (x.high + x.low + x.close) / 3);
      const own = tf.trim() === '' ? chartTf : tf;
      // Daily and higher bars: a new anchor on every bar, so the typical price of the bar (0 / 0 = na without volume)
      if (own !== '' && timeframe.in_seconds(own) >= 86400) return hlc3.map((v, i) => (v * volume[i]) / volume[i]);
      // Intraday bars: the sums restart on each trading day of the exchange (time zone and session of the context)
      if (!hasCalendar(chart)) {
        throw new Error(
          'Bjorgum MTF MA: the type "VWAP" on an intraday timeframe restarts on each trading day, which needs the '
          + 'exchange time zone and session (chart context)',
        );
      }
      dayStarts ??= periodStarts(bars, 'D', chart);
      const days = dayStarts;
      const newDay = b.map((_x, i) => (i === 0 || days[ctx.first[i]] !== days[ctx.first[i - 1]] ? 1 : 0));
      return A(ta.vwap(S(hlc3), S(volume), S(newDay)));
    };

    // getMA(type, length)
    const getMA = (type: MaType, length: number): number[] => {
      const e = (src: Series) => ta.ema(src, length);
      switch (type) {
        case 'HEMA': return A(e(S(haOpen)));
        case 'SMA': return A(ta.sma(close, length));
        case 'HMA': return A(ta.hma(close, length));
        case 'WMA': return A(ta.wma(close, length));
        case 'VWMA': return A(ta.vwma(close, length, S(volume)));
        case 'VWAP': return vwap();
        case 'DEMA': {
          const e1 = e(close);
          const e2 = A(e(e1));
          return A(e1).map((v, i) => 2 * v - e2[i]);
        }
        case 'T3': {
          const axe1 = e(close);
          const axe2 = e(axe1);
          const axe3 = e(axe2);
          const axe4 = e(axe3);
          const axe5 = e(axe4);
          const axe6 = A(e(axe5));
          const a3 = A(axe3);
          const a4 = A(axe4);
          const a5 = A(axe5);
          const ab = 0.7;
          const ac1 = -ab * ab * ab;
          const ac2 = 3 * ab * ab + 3 * ab * ab * ab;
          const ac3 = -6 * ab * ab - 3 * ab - 3 * ab * ab * ab;
          const ac4 = 1 + 3 * ab + ab * ab * ab + 3 * ab * ab;
          return axe6.map((v, i) => ac1 * v + ac2 * a5[i] + ac3 * a4[i] + ac4 * a3[i]);
        }
        case 'IT': return itrend;
        default: return A(e(close));
      }
    };
    return { getMA, rsi: A(ta.rsi(close, cfg.rsiLen)) };
  };

  const contexts = new Map<string, { ctx: TimeframeBars; series: ReturnType<typeof seriesOf> }>();
  const contextOf = (tf: string) => {
    let c = contexts.get(tf);
    if (!c) {
      const ctx = timeframeBars(bars, tf, chart);
      c = { ctx, series: seriesOf(ctx, tf) };
      contexts.set(tf, c);
    }
    return c;
  };

  /** One average: the plotted value, its direction, its RSI and the bar condition, on the chart bars */
  const slot = (type: MaType, lengthInput: number, tf: string): Slot => {
    const { ctx, series } = contextOf(tf);
    const ma = series.getMA(type, lengthInput === 0 ? 1 : lengthInput);
    // maDirec = ma >= ma[1], a bool that can be na (1 / 0 / NaN)
    const direc = ma.map((v, i) => (i > 0 && ge(v, ma[i - 1]) ? 1 : 0));
    const closeOf = (i: number) => bars[i].close;
    if (tf === '') {
      return {
        plot: ma, con: direc.map((v) => v === 1), rsi: series.rsi, sig: ma,
        bar: ma.map((v, i) => ge(closeOf(i), v)),
      };
    }
    const { group, latest } = ctx;
    // _NRPrt: security(tf, src, gaps_off)[1]; _NRP: security(tf, src, gaps_on)[1]
    const security = (values: number[], gapsOn: boolean) => {
      const onChart = mapToChart(values, group, latest, false, gapsOn);
      return onChart.map((_v, i) => (i > 0 ? onChart[i - 1] : NaN));
    };
    const step = (values: number[]) => security(values, false);
    const gaps = (values: number[]) => security(values, true);
    const maStep = step(ma);
    return {
      plot: cfg.smooth ? gaps(ma) : maStep,
      con: step(direc).map((v) => v === 1),
      rsi: step(series.rsi),
      sig: maStep,
      bar: maStep.map((v, i) => ge(closeOf(i), v)),
    };
  };

  return slot;
}

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

/** An average calculated bar by bar on the chart bars (timeframe "" and not "VWAP") */
interface StepMa {
  /** The average of the bar from the close / the Heikin Ashi open / the instantaneous trendline of the bar */
  step(b: Bar, haOpen: number, itrend: number): number;
  steps: Committable[];
}

/** getMA(type, length) on the chart bars, one bar at a time */
function stepMa(type: MaType, length: number): StepMa {
  const ema = () => taStep.ema(length);
  switch (type) {
    case 'HEMA': { const e = ema(); return { step: (_b, ha) => e.step(ha), steps: [e] }; }
    case 'SMA': { const m = taStep.sma(); return { step: (b) => m.step(b.close, length), steps: [m] }; }
    case 'HMA': { const m = taStep.hma(length); return { step: (b) => m.step(b.close), steps: [m] }; }
    case 'WMA': { const m = taStep.wma(); return { step: (b) => m.step(b.close, length), steps: [m] }; }
    case 'VWMA': { const m = taStep.vwma(length); return { step: (b) => m.step(b.close, b.volume ?? NaN), steps: [m] }; }
    case 'DEMA': {
      const e1 = ema();
      const e2 = ema();
      return { step: (b) => { const v = e1.step(b.close); return 2 * v - e2.step(v); }, steps: [e1, e2] };
    }
    case 'T3': {
      const e = [ema(), ema(), ema(), ema(), ema(), ema()];
      const ab = 0.7;
      const ac1 = -ab * ab * ab;
      const ac2 = 3 * ab * ab + 3 * ab * ab * ab;
      const ac3 = -6 * ab * ab - 3 * ab - 3 * ab * ab * ab;
      const ac4 = 1 + 3 * ab + ab * ab * ab + 3 * ab * ab;
      return {
        step: (b) => {
          const axe1 = e[0].step(b.close);
          const axe2 = e[1].step(axe1);
          const axe3 = e[2].step(axe2);
          const axe4 = e[3].step(axe3);
          const axe5 = e[4].step(axe4);
          const axe6 = e[5].step(axe5);
          return ac1 * axe6 + ac2 * axe5 + ac3 * axe4 + ac4 * axe3;
        },
        steps: e,
      };
    }
    case 'IT': return { step: (_b, _ha, it) => it, steps: [] };
    default: { const e = ema(); return { step: (b) => e.step(b.close), steps: [e] }; }
  }
}

/** The alert pairs (a, b) of crossover(a, b) / crossunder(a, b): 0-2 the averages' signal values, 3 the close */
const CROSS_PAIRS: Array<[number, number]> = [[3, 0], [3, 1], [3, 2], [0, 1], [0, 2], [1, 2]];

interface BjVars {
  /** The Heikin Ashi open and close of the bar before */
  haOpen: number;
  haClose: number;
}

/** One of the three averages: bar by bar ("step") or calculated on the whole bar set ("pre") */
interface SlotRun {
  ma: StepMa | null;
  rsi: ReturnType<typeof taStep.rsi> | null;
  pre: Slot | null;
  /** maSig of each bar (the average on the chart timeframe, else the step value of the timeframe) */
  sig: number[];
}

interface BjRun extends BarRunState<BjVars> {
  slots: SlotRun[];
  /** The source of the instantaneous trendline and the trendline (read 1 and 2 bars back) */
  inp: number[];
  itrend: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<BjorgumMtfMaInputs>): BarStudy<BjRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const alpha = cfg.alpha;
  const specs: Array<{ type: MaType; length: number; tf: string }> = [
    { type: cfg.maType1, length: cfg.maLength1, tf: cfg.tf1 },
    { type: cfg.maType2, length: cfg.maLength2, tf: cfg.tf2 },
    { type: cfg.maType3, length: cfg.maLength3, tf: cfg.tf3 },
  ];
  // a higher timeframe, the type "VWAP" (trading days) and the trendline of another study's output are calculated on
  // the whole bar set
  const preOf = (sp: { type: MaType; tf: string }) =>
    sp.tf !== '' || sp.type === 'VWAP' || (sp.type === 'IT' && !isBarSource(cfg.inp));
  const anyPre = specs.some(preOf);
  const anyIt = specs.some((sp) => !preOf(sp) && sp.type === 'IT');
  const anyHa = specs.some((sp) => !preOf(sp) && sp.type === 'HEMA');
  const inpOf = barSource(cfg.inp);
  const bulls = [cfg.maBull1, cfg.maBull2, cfg.maBull3];
  const bears = [cfg.maBear1, cfg.maBear2, cfg.maBear3];
  const rsiBulls = [cfg.rsiBull1, cfg.rsiBull2, cfg.rsiBull3];
  const rsiBears = [cfg.rsiBear1, cfg.rsiBear2, cfg.rsiBear3];
  const colTypes = [cfg.colType1, cfg.colType2, cfg.colType3];
  const transps = [cfg.transp1, cfg.transp2, cfg.transp3];
  // plotMA2 = maType2 == "IT" ? plotMa2 : maLength2 == 0 ? na : plotMa2
  const shown = [true, cfg.maType2 === 'IT' || cfg.maLength2 !== 0, cfg.maType3 === 'IT' || cfg.maLength3 !== 0];
  const barSlot = cfg.bartype === 'MA 1' || cfg.bartype === 'RSI 1' ? 0 : cfg.bartype === 'MA 2' || cfg.bartype === 'RSI 2' ? 1 : 2;
  const barRsi = cfg.bartype.startsWith('RSI');
  const grad = (rsi: number, bear: string, bull: string) => color.from_gradient(rsi, 30, 70, bear, bull);
  // the values of one slot on the current bar
  const plot = [NaN, NaN, NaN];
  const con = [false, false, false];
  const rsis = [NaN, NaN, NaN];
  const sigs = [NaN, NaN, NaN, NaN];
  const prevs = [NaN, NaN, NaN, NaN];
  const barConds = [false, false, false];
  return {
    fullRunReason: () => (anyPre ? 'average calculated on the whole bar set (higher timeframe, VWAP)' : null),
    init(bars, chart) {
      const slotOf = anyPre ? arraySlots(bars, cfg, chart) : null;
      const slots: SlotRun[] = specs.map((sp) => {
        if (preOf(sp)) return { ma: null, rsi: null, pre: slotOf!(sp.type, sp.length, sp.tf), sig: [] };
        return { ma: stepMa(sp.type, sp.length === 0 ? 1 : sp.length), rsi: taStep.rsi(cfg.rsiLen), pre: null, sig: [] };
      });
      const s: BjRun = {
        slots, inp: [], itrend: [], plots: [[], [], []], flags: Array.from({ length: 12 }, () => []),
        times: Array.from({ length: 12 }, () => []), barColors: [],
        steps: slots.flatMap((sl) => (sl.ma ? [...sl.ma.steps, sl.rsi!] : [])),
        vars: { haOpen: NaN, haClose: NaN }, lists: [], series: [],
      };
      s.lists = [s.barColors, ...s.times];
      s.series = [s.inp, s.itrend, ...s.plots, ...s.flags, ...slots.map((sl) => sl.sig)];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      // _haOpen(): the open of the Heikin Ashi bars ((open + close) / 2 on the first bar)
      let haOpen = NaN;
      if (anyHa) {
        haOpen = i > 0 ? (v.haOpen + v.haClose) / 2 : (b.open + b.close) / 2;
        v.haOpen = haOpen;
        v.haClose = (b.open + b.high + b.low + b.close) / 4;
      }
      // _itrend(): Ehlers instantaneous trendline of the source input
      let it = NaN;
      if (anyIt) {
        const s0 = inpOf(b);
        s.inp[i] = s0;
        const s1 = i > 0 ? nz(s.inp[i - 1]) : 0;
        const s2 = i > 1 ? nz(s.inp[i - 2]) : 0;
        const t1 = i > 0 ? nz(s.itrend[i - 1]) : 0;
        const t2 = i > 1 ? nz(s.itrend[i - 2]) : 0;
        it = i < 7
          ? (s0 + 2 * s1 + s2) / 4
          : (alpha - (alpha ** 2) / 4) * s0 + 0.5 * (alpha ** 2) * s1 - (alpha - 0.75 * (alpha ** 2)) * s2
            + 2 * (1 - alpha) * t1 - ((1 - alpha) ** 2) * t2;
        s.itrend[i] = it;
      }
      for (let k = 0; k < 3; k++) {
        const sl = s.slots[k];
        if (sl.pre) {
          plot[k] = sl.pre.plot[i];
          con[k] = sl.pre.con[i];
          rsis[k] = sl.pre.rsi[i];
          sigs[k] = sl.pre.sig[i];
          barConds[k] = sl.pre.bar[i];
        } else {
          const ma = sl.ma!.step(b, haOpen, it);
          // maDirec = ma >= ma[1]
          con[k] = i > 0 && ge(ma, sl.sig[i - 1]);
          plot[k] = ma;
          rsis[k] = sl.rsi!.step(b.close);
          sigs[k] = ma;
          barConds[k] = ge(b.close, ma);
        }
        sl.sig[i] = sigs[k];
      }

      let barColor: string | null = null;
      for (let k = 0; k < 3; k++) {
        const rsiCol = grad(rsis[k], rsiBears[k], rsiBulls[k]);
        const maCol = colTypes[k] === 'MA' ? (con[k] ? bulls[k] : bears[k]) : rsiCol;
        s.plots[k][i] = { time, value: shown[k] ? plot[k] : NaN, color: String(color.new(maCol, transps[k])) };
        if (cfg.bar && k === barSlot) {
          // the gradient of an na RSI is na: the bar keeps its colour
          barColor = barRsi ? (Number.isNaN(rsis[k]) ? null : rsiCol) : barConds[k] ? bulls[k] : bears[k];
        }
      }
      if (barColor !== null) s.barColors.push({ time, color: barColor });

      // maSig = tf == "" ? ma : ma step; crossover / crossunder of the close and of the averages
      // (a > b and a[1] <= b[1] / a < b and a[1] >= b[1]; slot 3 = the close)
      sigs[3] = b.close;
      for (let k = 0; k < 4; k++) prevs[k] = i === 0 ? NaN : k === 3 ? bars[i - 1].close : s.slots[k].sig[i - 1];
      for (let k = 0; k < 6; k++) {
        const [x, y] = CROSS_PAIRS[k];
        const a = sigs[x], w = sigs[y], pa = prevs[x], pw = prevs[y];
        const over = a > w && pa <= pw;
        const under = a < w && pa >= pw;
        s.flags[2 * k][i] = over;
        s.flags[2 * k + 1][i] = under;
        if (over) s.times[2 * k].push(time as number);
        if (under) s.times[2 * k + 1].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BjorgumMtfMaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BjorgumMtfMaInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Close crossed above MA 1', message: 'Close crossed above MA 1 on {{interval}} chart. Price is {{close}}' },
  { id: 'alert1', title: 'Close crossed below MA 1', message: 'Close crossed below MA 1 on {{interval}} chart. Price is {{close}}' },
  { id: 'alert2', title: 'Close crossed above MA 2', message: 'Close crossed above MA 2 on {{interval}} chart. Price is {{close}}' },
  { id: 'alert3', title: 'Close crossed below MA 2', message: 'Close crossed below MA 2 on {{interval}} chart. Price is {{close}}' },
  { id: 'alert4', title: 'Close crossed above MA 3', message: 'Close crossed above MA 3 on {{interval}} chart. Price is {{close}}' },
  { id: 'alert5', title: 'Close crossed below MA 3', message: 'Close crossed below MA 3 on {{interval}} chart. Price is {{close}}' },
  { id: 'alert6', title: 'MA 1 crossed above MA 2', message: "MA 1 crossed above MA 2 on {{interval}} chart. Price is {{close}}'" },
  { id: 'alert7', title: 'MA 1 crossed below MA 2', message: "MA 1 crossed below MA 2 on {{interval}} chart. Price is {{close}}'" },
  { id: 'alert8', title: 'MA 1 crossed above MA 3', message: "MA 1 crossed above MA 3 on {{interval}} chart. Price is {{close}}'" },
  { id: 'alert9', title: 'MA 1 crossed below MA 3', message: "MA 1 crossed below MA 3 on {{interval}} chart. Price is {{close}}'" },
  { id: 'alert10', title: 'MA 2 crossed above MA 3', message: "MA 2 crossed above MA 3 on {{interval}} chart. Price is {{close}}'" },
  { id: 'alert11', title: 'MA 2 crossed below MA 3', message: "MA 2 crossed below MA 3 on {{interval}} chart. Price is {{close}}'" },
];

export const BjorgumMtfMa = {
  alertConditions,
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
