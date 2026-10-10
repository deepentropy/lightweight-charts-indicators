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
 * Reference: "CM_Ultimate_MA_MTF_V2" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import { periodStarts, chartTimeframe } from '../anchor-period';

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
function timeframeBars(bars: Bar[], tf: string): { htf: Bar[]; toChart: (values: number[]) => number[] } {
  const chart = chartTimeframe(bars);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, toChart: (values) => values };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`The timeframe "${tf}" is lower than the chart timeframe "${chart}": the bars do not carry that data.`);
  }
  const starts = periodStarts(bars, tf);
  const htf: Bar[] = [];
  const group: number[] = [];
  bars.forEach((b, i) => {
    if (i === 0 || starts[i] !== starts[i - 1]) {
      htf.push({ time: starts[i], open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume ?? NaN });
    } else {
      const last = htf[htf.length - 1];
      last.high = Math.max(last.high, b.high);
      last.low = Math.min(last.low, b.low);
      last.close = b.close;
      last.volume = (last.volume ?? NaN) + (b.volume ?? NaN);
    }
    group.push(htf.length - 1);
  });
  return { htf, toChart: (values) => group.map((g) => values[g]) };
}

export function calculate(bars: Bar[], inputs: Partial<CmUltimateMaMtfV2Inputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // res = useCurrentRes ? period : resCustom
  const { htf, toChart } = timeframeBars(bars, cfg.useCurrentRes ? '' : cfg.resCustom);
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
  const out1 = toChart(average(cfg.atype, cfg.len, cfg.factorT3 * 0.1));
  const out2 = toChart(average(cfg.atype2, cfg.len2, cfg.sfactorT3 * 0.1));
  const crossed = ta.cross(Series.fromArray(bars, out1), Series.fromArray(bars, out2)).toArray();

  const plot0: Array<{ time: number; value: number; color: string }> = [];
  const plot1: typeof plot0 = [];
  const plot2: Array<{ time: number; value: number }> = [];
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const prev = i - cfg.smoothe >= 0 ? out1[i - cfg.smoothe] : NaN;
    const maUp = ge(out1[i], prev);
    const maDown = lt(out1[i], prev);
    const direction = maUp ? LIME : maDown ? RED : AQUA;
    const time = bars[i].time;
    plot0.push({ time, value: out1[i], color: cfg.cc ? direction : AQUA });
    // plot(doma2 and out2 ? out2 : na): a value of 0 or na is not drawn
    plot1.push({ time, value: cfg.doma2 && truthy(out2[i]) ? out2[i] : NaN, color: cfg.cc2 ? direction : WHITE });
    plot2.push({ time, value: cfg.sd && crossed[i] ? out2[i] : NaN });

    // barcolor: yellow when the bar opens on one side of an average and closes on the other side
    const { open, close } = bars[i];
    const across = (ma: number) => (lt(open, ma) && gt(close, ma)) || (gt(open, ma) && lt(close, ma));
    if ((cfg.spc && across(out1[i])) || (cfg.spc2 && across(out2[i]))) barColors.push({ time, color: BAR_YELLOW });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2 },
    barColors,
  };
}

export const CmUltimateMaMtfV2 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
