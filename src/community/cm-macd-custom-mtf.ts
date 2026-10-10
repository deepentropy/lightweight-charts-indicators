/**
 * MacD Custom Indicator - Multiple Time Frame
 *
 * MACD = ema(close, fast) - ema(close, slow), signal = sma(MACD, signal length), histogram = MACD - signal, computed
 * on the chart timeframe or on another timeframe of the same symbol. The MACD line is lime above the signal and red
 * below, the histogram has four colours (rising / falling, above / below zero) and a circle marks each cross of
 * MACD and signal.
 *
 * Other timeframe: the bars of that timeframe are built from the chart bars (periods from the UTC calendar and the
 * bars, see src/anchor-period.ts), so its averages start at the first chart bar. As in the original (a version 1
 * script), every chart bar of a period shows the value of that period at its end (on past bars the value of a
 * period is known from its first bar; the last period is still open). A timeframe below the chart timeframe needs
 * data that the bars do not carry: the port throws an Error.
 *
 * Reference: "MacD Custom Indicator-Multiple Time Frame+All Available Options!" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { ta, Series, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import { periodStarts, chartTimeframe } from '../anchor-period';

export interface CmMacdCustomMtfInputs {
  /** Use the chart timeframe (the timeframe input is ignored) */
  useCurrentRes: boolean;
  /** Timeframe used when `useCurrentRes` is false ("60", "240", "D", "W", "M", ...) */
  resCustom: string;
  showMacd: boolean;
  showDots: boolean;
  showHistogram: boolean;
  macdColorChange: boolean;
  histColorChange: boolean;
  fastLength: number;
  slowLength: number;
  signalLength: number;
}

export const defaultInputs: CmMacdCustomMtfInputs = {
  useCurrentRes: true,
  resCustom: '60',
  showMacd: true,
  showDots: true,
  showHistogram: true,
  macdColorChange: true,
  histColorChange: true,
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'useCurrentRes', type: 'bool', title: 'Use Current Chart Resolution?', defval: true },
  { id: 'resCustom', type: 'timeframe', title: 'Use Different Timeframe? Uncheck Box Above', defval: '60' },
  { id: 'showMacd', type: 'bool', title: 'Show MacD & Signal Line? Also Turn Off Dots Below', defval: true },
  { id: 'showDots', type: 'bool', title: 'Show Dots When MacD Crosses Signal Line?', defval: true },
  { id: 'showHistogram', type: 'bool', title: 'Show Histogram?', defval: true },
  { id: 'macdColorChange', type: 'bool', title: 'Change MacD Line Color-Signal Line Cross?', defval: true },
  { id: 'histColorChange', type: 'bool', title: 'MacD Histogram 4 Colors?', defval: true },
  { id: 'fastLength', type: 'int', title: 'fastLength', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'slowLength', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'signalLength', defval: 9, min: 1 },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const LIME = V1('#00FF00');
const RED = V1('#FF0000');
const YELLOW = V1('#FFFF00');
const AQUA = V1('#00FFFF');
const BLUE = V1('#0000FF');
const MAROON = V1('#800000');
const GRAY = V1('#808080');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: LIME, lineWidth: 4 },
  { id: 'plot1', title: 'Signal Line', color: YELLOW, lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: AQUA, lineWidth: 4, style: 'histogram' },
  { id: 'plot3', title: 'Cross', color: LIME, lineWidth: 4, style: 'circles' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 0, color: '#FFFFFF', linestyle: 'solid', linewidth: 2, title: '0 Line' },
];

export const metadata = {
  title: 'CM_MacD_Ult_MTF',
  shortTitle: 'CM_Ult_MacD_MTF',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
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

export function calculate(bars: Bar[], inputs: Partial<CmMacdCustomMtfInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // res = useCurrentRes ? period : resCustom
  const { htf, toChart } = timeframeBars(bars, cfg.useCurrentRes ? '' : cfg.resCustom);
  const source = Series.fromArray(htf, htf.map((b) => b.close));
  const fastMA = A(ta.ema(source, cfg.fastLength));
  const slowMA = A(ta.ema(source, cfg.slowLength));
  const macd = fastMA.map((v, i) => v - slowMA[i]);
  const signal = A(ta.sma(Series.fromArray(htf, macd), cfg.signalLength));
  const hist = macd.map((v, i) => v - signal[i]);

  const outMacD = toChart(macd);
  const outSignal = toChart(signal);
  const outHist = toChart(hist);
  // cross(outMacD, outSignal) on the chart bars
  const crossed = ta.cross(Series.fromArray(bars, outMacD), Series.fromArray(bars, outSignal)).toArray();

  const t = (i: number) => bars[i].time;
  const plot0: Array<{ time: number; value: number; color: string }> = [];
  const plot1: typeof plot0 = [];
  const plot2: typeof plot0 = [];
  const plot3: typeof plot0 = [];
  for (let i = 0; i < n; i++) {
    const h = outHist[i];
    const h1 = i > 0 ? outHist[i - 1] : NaN;
    const histAIsUp = gt(h, h1) && gt(h, 0);
    const histAIsDown = lt(h, h1) && gt(h, 0);
    const histBIsDown = lt(h, h1) && le(h, 0);
    const histBIsUp = gt(h, h1) && le(h, 0);
    const macdIsAbove = ge(outMacD[i], outSignal[i]);

    const plotColor = cfg.histColorChange
      ? histAIsUp ? AQUA : histAIsDown ? BLUE : histBIsDown ? RED : histBIsUp ? MAROON : YELLOW
      : GRAY;
    const macdColor = cfg.macdColorChange ? (macdIsAbove ? LIME : RED) : RED;
    const signalColor = cfg.macdColorChange ? YELLOW : LIME;

    // plot(smd and outMacD ? outMacD : na): a value of 0 or na is not drawn
    plot0.push({ time: t(i), value: cfg.showMacd && truthy(outMacD[i]) ? outMacD[i] : NaN, color: macdColor });
    plot1.push({ time: t(i), value: cfg.showMacd && truthy(outSignal[i]) ? outSignal[i] : NaN, color: signalColor });
    plot2.push({ time: t(i), value: cfg.showHistogram && truthy(h) ? h : NaN, color: plotColor });
    plot3.push({ time: t(i), value: cfg.showDots && crossed[i] ? outSignal[i] : NaN, color: macdColor });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3 },
    hlines: [{ value: 0, options: { title: '0 Line', color: '#FFFFFF', linestyle: 'solid', linewidth: 2 } }],
  };
}

export const CmMacdCustomMtf = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
