/**
 * Ultimate Moving Average - Multi-TimeFrame - 7 MA Types
 *
 * A moving average of the close (SMA, EMA, WMA, Hull MA, VWMA, RMA or TEMA) computed on the chart timeframe or on
 * another timeframe of the same symbol, coloured by its direction over `smoothe` chart bars (lime rising, red
 * falling). An optional second moving average is drawn as circles, and crosses mark the bars where the two averages
 * cross.
 *
 * As in the original, type 7 (TEMA) of the second average gives the TEMA of the first average (first length), and
 * the second average takes its direction colour from the first one.
 *
 * Other timeframe: the bars of that timeframe are built from the chart bars (periods from the UTC calendar and the
 * bars, see src/anchor-period.ts), so its averages start at the first chart bar. As in the original (a version 1
 * script), every chart bar of a period shows the value of that period at its end (on past bars the value of a
 * period is known from its first bar; the last period is still open). A timeframe below the chart timeframe needs
 * data that the bars do not carry: the port throws an Error.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), and a bar of a higher timeframe is complete on the chart bar whose close reaches the end of
 * its period, see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "Ultimate Moving Average-Multi-TimeFrame-7 MA Types" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, taStep, Series, color, timeframe, resample, mapToChart, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { periodStarts, chartTimeframe, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface UltimateMovingAverageMtfInputs {
  /** Use the chart timeframe (the timeframe input is ignored) */
  useCurrentRes: boolean;
  /** Timeframe used when `useCurrentRes` is false ("60", "240", "D", "W", "M", ...) */
  resCustom: string;
  len: number;
  /** 1 = SMA, 2 = EMA, 3 = WMA, 4 = Hull MA, 5 = VWMA, 6 = RMA, 7 = TEMA */
  atype: number;
  /** Colour by direction */
  cc: boolean;
  /** Number of chart bars of the direction test */
  smoothe: number;
  /** Show the second moving average */
  doma2: boolean;
  len2: number;
  atype2: number;
  cc2: boolean;
  /** Notes of the original settings dialog (no effect) */
  warn: boolean;
  warn2: boolean;
  /** Show a cross where the two averages cross */
  sd: boolean;
}

export const defaultInputs: UltimateMovingAverageMtfInputs = {
  useCurrentRes: true,
  resCustom: 'D',
  len: 20,
  atype: 1,
  cc: true,
  smoothe: 2,
  doma2: false,
  len2: 50,
  atype2: 1,
  cc2: true,
  warn: false,
  warn2: false,
  sd: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'useCurrentRes', type: 'bool', title: 'Use Current Chart Resolution?', defval: true },
  { id: 'resCustom', type: 'timeframe', title: 'Use Different Timeframe? Uncheck Box Above', defval: 'D' },
  { id: 'len', type: 'int', title: 'Moving Average Length - LookBack Period', defval: 20 },
  { id: 'atype', type: 'int', title: '1=SMA, 2=EMA, 3=WMA, 4=HullMA, 5=VWMA, 6=RMA, 7=TEMA', defval: 1, min: 1, max: 7 },
  { id: 'cc', type: 'bool', title: 'Change Color Based On Direction?', defval: true },
  { id: 'smoothe', type: 'int', title: 'Color Smoothing - 1 = No Smoothing', defval: 2, min: 1, max: 10 },
  { id: 'doma2', type: 'bool', title: 'Optional 2nd Moving Average', defval: false },
  { id: 'len2', type: 'int', title: 'Moving Average Length - Optional 2nd MA', defval: 50 },
  { id: 'atype2', type: 'int', title: '1=SMA, 2=EMA, 3=WMA, 4=HullMA, 5=VWMA, 6=RMA, 7=TEMA', defval: 1, min: 1, max: 7 },
  { id: 'cc2', type: 'bool', title: 'Change Color Based On Direction 2nd MA?', defval: true },
  { id: 'warn', type: 'bool', title: '***You Can Turn On The Show Dots Parameter Below Without Plotting 2nd MA to See Crosses***', defval: false },
  { id: 'warn2', type: 'bool', title: '***If Using Cross Feature W/O Plotting 2ndMA - Make Sure 2ndMA Parameters are Set Correctly***', defval: false },
  { id: 'sd', type: 'bool', title: "Show Dots on Cross of Both MA's", defval: false },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const LIME = V1('#00FF00');
const RED = V1('#FF0000');
const AQUA = V1('#00FFFF');
const YELLOW = V1('#FFFF00');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Multi-Timeframe Moving Avg', color: LIME, lineWidth: 4 },
  { id: 'plot1', title: '2nd Multi-TimeFrame Moving Average', color: LIME, lineWidth: 4, style: 'circles' },
  { id: 'plot2', title: 'MA Cross', color: YELLOW, lineWidth: 5, style: 'cross' },
];

export const metadata = {
  title: 'CM_Ultimate_MA_MTF',
  shortTitle: 'CM_Ultimate_MA_MTF',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** A number used as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;

/**
 * security(tickerid, tf, ...) on the chart symbol: the bars of timeframe `tf` built from the chart bars, and the
 * function that brings one value per bar of that timeframe back to the chart bars. Version 1 rule: every chart bar
 * of a period shows the value of the period (no gaps).
 */
function timeframeBars(bars: Bar[], tf: string, context?: ChartContext): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars, context);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  // With the exchange calendar of the chart context (time zone and session): the periods and the bars that
  // complete them come from the library rule (see anchor-period.ts)
  const exchange = securityBars(bars, tf, context);
  if (exchange) {
    return { htf: exchange.htf, toChart: (values) => mapToChart(values, exchange.group, exchange.latest, true, false) };
  }
  // Without it: the periods of the UTC calendar rule (see anchor-period.ts), grouped by the library
  const { bars: htf, group } = resample(bars, periodStarts(bars, tf));
  // lookahead on: the latest completed period is not read
  return { htf, toChart: (values) => mapToChart(values, group, group, true, false) };
}

type Point = { time: number; value: number; color?: string };
type Ma = { step(close: number, volume: number): number; commit(): void };

/** One moving average of the close on the chart bars, stepped bar by bar */
function maStep(type: number, len: number, temaLen: number): Ma {
  switch (type) {
    case 1: { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 2: { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 3: { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 4: {
      // hullma = wma(2 * wma(src, len / 2) - wma(src, len), round(sqrt(len))); len / 2 is an integer division
      const half = taStep.wma();
      const full = taStep.wma();
      const hull = taStep.wma();
      const halfLen = Math.trunc(len / 2);
      const hullLen = Math.round(Math.sqrt(len));
      return {
        step: (v) => {
          const h = half.step(v, halfLen);
          const f = full.step(v, len);
          return hull.step(2 * h - f, hullLen);
        },
        commit: () => { half.commit(); full.commit(); hull.commit(); },
      };
    }
    case 5: { const m = new WindowVwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
    case 6: { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    default: {
      // tema = 3 * (ema1 - ema2) + ema3, with the first length (type 7 of the second average uses it too)
      const ema1 = taStep.ema(temaLen);
      const ema2 = taStep.ema(temaLen);
      const ema3 = taStep.ema(temaLen);
      return {
        step: (v) => {
          const e1 = ema1.step(v);
          const e2 = ema2.step(e1);
          const e3 = ema3.step(e2);
          return 3 * (e1 - e2) + e3;
        },
        commit: () => { ema1.commit(); ema2.commit(); ema3.commit(); },
      };
    }
  }
}

interface UmaRun extends BarRunState<Record<string, never>> {
  /** Chart timeframe: the average machines; another timeframe: the values on the chart bars, calculated by init */
  ma1: Ma | null;
  ma2: Ma | null;
  pre: { out1: number[]; out2: number[] } | null;
  cross: ReturnType<typeof taStep.cross>;
  out1: number[];
  plots: Point[][];
}

function study(inputs: Partial<UltimateMovingAverageMtfInputs>): BarStudy<UmaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // res = useCurrentRes ? period : resCustom
  const tf = cfg.useCurrentRes ? '' : cfg.resCustom;
  return {
    // another timeframe: every chart bar of a period shows the value of the period at its end (from the later bars)
    fullRunReason: () => (tf.trim() === '' ? null : 'another timeframe, calculated on the whole bar set'),
    init(bars, chart) {
      const { htf, toChart } = timeframeBars(bars, tf, chart);
      let pre: UmaRun['pre'] = null;
      if (htf !== bars) {
        const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
        const S = (a: number[]) => Series.fromArray(htf, a);
        const src = S(htf.map((b) => b.close));
        const volume = S(htf.map((b) => b.volume ?? NaN));

        // tema = 3 * (ema1 - ema2) + ema3, with the first length (type 7 of the second average uses it too)
        const tema = (): number[] => {
          const ema1 = ta.ema(src, cfg.len);
          const ema2 = ta.ema(ema1, cfg.len);
          const e1 = A(ema1);
          const e2 = A(ema2);
          const e3 = A(ta.ema(ema2, cfg.len));
          return e1.map((v, i) => 3 * (v - e2[i]) + e3[i]);
        };
        const average = (type: number, len: number): number[] => {
          switch (type) {
            case 1: return A(ta.sma(src, len));
            case 2: return A(ta.ema(src, len));
            case 3: return A(ta.wma(src, len));
            case 4: {
              // hullma = wma(2 * wma(src, len / 2) - wma(src, len), round(sqrt(len))); len / 2 is an integer division
              const half = A(ta.wma(src, Math.trunc(len / 2)));
              const full = A(ta.wma(src, len));
              return A(ta.wma(S(half.map((v, i) => 2 * v - full[i])), Math.round(Math.sqrt(len))));
            }
            case 5: return A(ta.vwma(src, len, volume));
            case 6: return A(ta.rma(src, len));
            default: return tema();
          }
        };
        pre = { out1: toChart(average(cfg.atype, cfg.len)), out2: toChart(average(cfg.atype2, cfg.len2)) };
      }
      const ma1 = pre ? null : maStep(cfg.atype, cfg.len, cfg.len);
      const ma2 = pre ? null : maStep(cfg.atype2, cfg.len2, cfg.len);
      const s: UmaRun = {
        ma1, ma2, pre, cross: taStep.cross(), out1: [], plots: [[], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [...(ma1 ? [ma1, ma2!] : []), s.cross];
      s.series = [s.out1, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      let out1: number;
      let out2: number;
      if (s.pre) {
        out1 = s.pre.out1[i];
        out2 = s.pre.out2[i];
      } else {
        const vol = b.volume ?? NaN;
        out1 = s.ma1!.step(b.close, vol);
        out2 = s.ma2!.step(b.close, vol);
      }
      s.out1[i] = out1;
      const crossed = s.cross.step(out1, out2);

      const prev = i - cfg.smoothe >= 0 ? s.out1[i - cfg.smoothe] : NaN;
      const maUp = ge(out1, prev);
      const maDown = lt(out1, prev);
      const direction = maUp ? LIME : maDown ? RED : AQUA;
      const time = b.time;
      s.plots[0][i] = { time, value: out1, color: cfg.cc ? direction : AQUA };
      // plot(doma2 and out2 ? out2 : na): a value of 0 or na is not drawn
      s.plots[1][i] = { time, value: cfg.doma2 && truthy(out2) ? out2 : NaN, color: cfg.cc2 ? direction : AQUA };
      s.plots[2][i] = { time, value: cfg.sd && crossed ? out2 : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<UltimateMovingAverageMtfInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<UltimateMovingAverageMtfInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const UltimateMovingAverageMtf = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
