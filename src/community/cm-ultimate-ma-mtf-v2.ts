/**
 * CM Ultimate MA MTF V2
 *
 * A moving average of the close (SMA, EMA, WMA, Hull MA, VWMA, RMA, TEMA or Tilson T3) computed on the chart
 * timeframe or on another timeframe of the same symbol, coloured by its direction over `smoothe` chart bars (lime
 * rising, red falling). An optional second moving average is drawn as circles, crosses mark the bars where the two
 * averages cross, and bars whose open and close are on both sides of an average can be coloured yellow.
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
 * Reference: "CM_Ultimate_MA_MTF_V2" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, taStep, Series, color, timeframe, resample, mapToChart,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { BarColorData } from '../types';
import { periodStarts, chartTimeframe, securityBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowVwma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface CmUltimateMaMtfV2Inputs {
  /** Use the chart timeframe (the timeframe input is ignored) */
  useCurrentRes: boolean;
  /** Timeframe used when `useCurrentRes` is false ("60", "240", "D", "W", "M", ...) */
  resCustom: string;
  len: number;
  /** Tilson T3 factor in tenths (7 = 0.7) */
  factorT3: number;
  /** 1 = SMA, 2 = EMA, 3 = WMA, 4 = Hull MA, 5 = VWMA, 6 = RMA, 7 = TEMA, 8 = Tilson T3 */
  atype: number;
  /** Colour the bars whose open and close are on both sides of the first average */
  spc: boolean;
  /** Colour by direction */
  cc: boolean;
  /** Number of chart bars of the direction test */
  smoothe: number;
  /** Show the second moving average */
  doma2: boolean;
  /** Colour the bars whose open and close are on both sides of the second average */
  spc2: boolean;
  len2: number;
  /** Tilson T3 factor of the second average in tenths */
  sfactorT3: number;
  atype2: number;
  cc2: boolean;
  /** Notes of the original settings dialog (no effect) */
  warn: boolean;
  warn2: boolean;
  /** Show a cross where the two averages cross */
  sd: boolean;
}

export const defaultInputs: CmUltimateMaMtfV2Inputs = {
  useCurrentRes: true,
  resCustom: 'D',
  len: 20,
  factorT3: 7,
  atype: 1,
  spc: false,
  cc: true,
  smoothe: 2,
  doma2: false,
  spc2: false,
  len2: 50,
  sfactorT3: 7,
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
  { id: 'factorT3', type: 'int', title: 'Tilson T3 Factor - *.10 - so 7 = .7 etc.', defval: 7, min: 0 },
  { id: 'atype', type: 'int', title: '1=SMA, 2=EMA, 3=WMA, 4=HullMA, 5=VWMA, 6=RMA, 7=TEMA, 8=Tilson T3', defval: 1, min: 1, max: 8 },
  { id: 'spc', type: 'bool', title: 'Show Price Crossing 1st Mov Avg - Highlight Bar?', defval: false },
  { id: 'cc', type: 'bool', title: 'Change Color Based On Direction?', defval: true },
  { id: 'smoothe', type: 'int', title: 'Color Smoothing - Setting 1 = No Smoothing', defval: 2, min: 1, max: 10 },
  { id: 'doma2', type: 'bool', title: 'Optional 2nd Moving Average', defval: false },
  { id: 'spc2', type: 'bool', title: 'Show Price Crossing 2nd Mov Avg?', defval: false },
  { id: 'len2', type: 'int', title: 'Moving Average Length - Optional 2nd MA', defval: 50 },
  { id: 'sfactorT3', type: 'int', title: 'Tilson T3 Factor - *.10 - so 7 = .7 etc.', defval: 7, min: 0 },
  { id: 'atype2', type: 'int', title: '1=SMA, 2=EMA, 3=WMA, 4=HullMA, 5=VWMA, 6=RMA, 7=TEMA, 8=Tilson T3', defval: 1, min: 1, max: 8 },
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
const WHITE = V1('#FFFFFF');
// barcolor has no transparency
const BAR_YELLOW = '#FFFF00';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Multi-Timeframe Moving Avg', color: LIME, lineWidth: 4 },
  { id: 'plot1', title: '2nd Multi-TimeFrame Moving Average', color: LIME, lineWidth: 4, style: 'circles' },
  { id: 'plot2', title: 'MA Cross', color: AQUA, lineWidth: 15, style: 'cross' },
];

export const metadata = {
  title: 'CM_Ultimate_MA_MTF_V2',
  shortTitle: 'CM_Ultimate_MA_MTF_V2',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
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
  // With the exchange calendar of the chart context (time zone and session): the periods come from the library rule
  // (see anchor-period.ts); without it, the periods of the UTC calendar and the bars, grouped by the library
  const exchange = securityBars(bars, tf, context);
  const { bars: htf, group } = exchange ? { bars: exchange.htf, group: exchange.group } : resample(bars, periodStarts(bars, tf));
  // lookahead: every chart bar of a period shows the value of the period
  return { htf, toChart: (values) => mapToChart(values, group, [], true, false) };
}

type Point = { time: number; value: number; color: string };
/** One average of the chart bars, one bar at a time */
type Average = Committable & { step(close: number, volume: number): number };

function emaPair(len: number): [ReturnType<typeof taStep.ema>, ReturnType<typeof taStep.ema>] {
  return [taStep.ema(len), taStep.ema(len)];
}

/** average(type, len, factor) of the chart bars as machines: the doubles of the Series functions */
function averageStep(type: number, len: number, factor: number, temaLen: number): Average {
  switch (type) {
    case 1: { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 2: { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 3: { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 4: {
      // hullma = wma(2 * wma(src, len / 2) - wma(src, len), round(sqrt(len))); len / 2 is an integer division
      const half = taStep.wma();
      const full = taStep.wma();
      const outer = taStep.wma();
      const halfLen = Math.trunc(len / 2);
      const sqrtLen = Math.round(Math.sqrt(len));
      return {
        step: (v) => outer.step(2 * half.step(v, halfLen) - full.step(v, len), sqrtLen),
        commit: () => { half.commit(); full.commit(); outer.commit(); },
      };
    }
    case 5: { const m = new WindowVwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
    case 6: { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 7: {
    // tema = 3 * (ema1 - ema2) + ema3, with the first length (type 7 of the second average uses it too)
    const m1 = taStep.ema(temaLen);
    const m2 = taStep.ema(temaLen);
    const m3 = taStep.ema(temaLen);
    return {
      step: (v) => { const e1 = m1.step(v); const e2 = m2.step(e1); return 3 * (e1 - e2) + m3.step(e2); },
      commit: () => { m1.commit(); m2.commit(); m3.commit(); },
    };
    }
    default: {
    // gd(src, len, factor) = ema(src, len) * (1 + factor) - ema(ema(src, len), len) * factor; t3 = gd(gd(gd(src)))
    const g = [emaPair(len), emaPair(len), emaPair(len)];
    return {
      step: (v) => {
        let x = v;
        for (const [e, ee] of g) {
          const a = e.step(x);
          x = a * (1 + factor) - ee.step(a) * factor;
        }
        return x;
      },
      commit: () => { for (const [e, ee] of g) { e.commit(); ee.commit(); } },
    };
    }
  }
}

interface CmuRun extends BarRunState<Record<string, never>> {
  /** The averages of the chart bars (null: precalculated) */
  ma1: Average | null;
  ma2: Average | null;
  /** The averages of the other timeframe (or of a negative smoothing) brought to the chart bars */
  pre: { out1: number[]; out2: number[] } | null;
  cross: ReturnType<typeof taStep.cross>;
  out1: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: { time: number; value: number }[];
  barColors: BarColorData[];
}

function study(inputs: Partial<CmUltimateMaMtfV2Inputs>): BarStudy<CmuRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // another timeframe: every chart bar of a period shows the value of the period at its end (from the later bars);
  // a negative smoothing reads later bars
  const whole = !cfg.useCurrentRes || cfg.smoothe < 0;
  return {
    fullRunReason: () => (!cfg.useCurrentRes ? 'another timeframe, calculated on the whole bar set'
    : cfg.smoothe < 0 ? 'negative smoothing reads the next bars' : null),
    init(bars, chart) {
    let pre: CmuRun['pre'] = null;
    if (whole) {
      pre = precalculated(bars, chart);
    }
    const ma1 = pre ? null : averageStep(cfg.atype, cfg.len, cfg.factorT3 * 0.1, cfg.len);
    const ma2 = pre ? null : averageStep(cfg.atype2, cfg.len2, cfg.sfactorT3 * 0.1, cfg.len);
    const s: CmuRun = {
      ma1, ma2, pre, cross: taStep.cross(), out1: [], plot0: [], plot1: [], plot2: [], barColors: [],
      steps: [], vars: {}, lists: [], series: [],
    };
    s.steps = [...(ma1 ? [ma1, ma2!] : []), s.cross];
    s.lists = [s.barColors];
    s.series = [s.out1, s.plot0, s.plot1, s.plot2];
    return s;
    },
    bar(s, i, bars) {
    const bar = bars[i]!;
    const { open, close } = bar;
    let o1: number;
    let o2: number;
    if (s.pre) {
      o1 = s.pre.out1[i]!;
      o2 = s.pre.out2[i]!;
    } else {
      o1 = s.ma1!.step(close, bar.volume ?? NaN);
      o2 = s.ma2!.step(close, bar.volume ?? NaN);
    }
    s.out1[i] = o1;
    const crossed = s.cross.step(o1, o2);

    const prev = i - cfg.smoothe >= 0 ? (s.pre ? s.pre.out1 : s.out1)[i - cfg.smoothe]! : NaN;
    const maUp = ge(o1, prev);
    const maDown = lt(o1, prev);
    const direction = maUp ? LIME : maDown ? RED : AQUA;
    const time = bar.time as number;
    s.plot0[i] = { time, value: o1, color: cfg.cc ? direction : AQUA };
    // plot(doma2 and out2 ? out2 : na): a value of 0 or na is not drawn
    s.plot1[i] = { time, value: cfg.doma2 && truthy(o2) ? o2 : NaN, color: cfg.cc2 ? direction : WHITE };
    s.plot2[i] = { time, value: cfg.sd && crossed ? o2 : NaN };

    // barcolor: yellow when the bar opens on one side of an average and closes on the other side, one entry per
    // barcolor() call of the original (cr_up, cr_Down of the first average, cr_up2, cr_Down2 of the second)
    if (cfg.spc && lt(open, o1) && gt(close, o1)) s.barColors.push({ id: 'barcolor0', time, color: BAR_YELLOW });
    if (cfg.spc && gt(open, o1) && lt(close, o1)) s.barColors.push({ id: 'barcolor1', time, color: BAR_YELLOW });
    if (cfg.spc2 && lt(open, o2) && gt(close, o2)) s.barColors.push({ id: 'barcolor2', time, color: BAR_YELLOW });
    if (cfg.spc2 && gt(open, o2) && lt(close, o2)) s.barColors.push({ id: 'barcolor3', time, color: BAR_YELLOW });
    },
    result(s) {
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
      barColors: s.barColors.slice(),
    };
    },
  };

  /** The two averages calculated on the whole bar set (another timeframe) and brought to the chart bars */
  function precalculated(bars: Bar[], chart: ChartContext): { out1: number[]; out2: number[] } {
    const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

    // res = useCurrentRes ? period : resCustom
    const { htf, toChart } = timeframeBars(bars, cfg.useCurrentRes ? '' : cfg.resCustom, chart);
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
    // gd(src, len, factor) = ema(src, len) * (1 + factor) - ema(ema(src, len), len) * factor; t3 = gd(gd(gd(src)))
    const gd = (x: Series, len: number, factor: number): Series => {
      const e = ta.ema(x, len);
      const a = A(e);
      const b = A(ta.ema(e, len));
      return S(a.map((v, i) => v * (1 + factor) - b[i] * factor));
    };
    const t3 = (len: number, factor: number): number[] => A(gd(gd(gd(src, len, factor), len, factor), len, factor));
    const average = (type: number, len: number, factor: number): number[] => {
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
        case 7: return tema();
        default: return t3(len, factor);
      }
    };
    return {
      out1: toChart(average(cfg.atype, cfg.len, cfg.factorT3 * 0.1)),
      out2: toChart(average(cfg.atype2, cfg.len2, cfg.sfactorT3 * 0.1)),
    };
  }
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CmUltimateMaMtfV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CmUltimateMaMtfV2Inputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CmUltimateMaMtfV2 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
