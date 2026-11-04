/**
 * Momentum Ghost Machine [ChartPrime]
 *
 * Momentum as the distance of the source from a smoothed copy of itself:
 * - The smoothed copy is a windowed-sinc low-pass filter (Blackman window) over the last 2 x "Momentum Length" bars,
 *   with a cutoff of 1 / "Momentum Smoothing" (na until the bar after that window is full).
 * - Momentum = (source - filter) / ((length - 1) / 2), smoothed by the "Post Smoothing" moving average (EMA, DEMA,
 *   TEMA, WMA or SMA of the script). MA = the "MA Style" average of the momentum, applied twice (length 2, then
 *   "MA Length").
 * - Convergence divergence = momentum - MA, as a histogram (and a lighter column "glow"): bullish up / down colours
 *   above 0 (rising or not), bearish down / up colours below 0.
 * - Momentum and MA lines with wide transparent glow copies, filled between them (momentum colour when the momentum is
 *   above the MA, else the MA colour).
 * - Ghost mode: two dotted lines from the current bar to 2 bars ahead, the momentum and the MA projected with their
 *   last change, filled between them, and the projected convergence divergence of the next 2 bars (two columns drawn
 *   1 and 2 bars to the right of the last bar, last bar only).
 * - Candle colours: from the convergence divergence ("MA"), from the momentum direction ("Direct"), or from the
 *   convergence divergence lightened / darkened by the momentum sign ("Both").
 *
 * Notes on the port:
 * - "Glow" switches the style of the histogram between histogram and columns: the port keeps the default style
 *   (histogram) in its plot declaration.
 * - The script tests `bar_index` (filter warm-up, SMA): the port counts it from the first bar it gets.
 *
 * Reference: "Momentum Ghost Machine [ChartPrime]" by ChartPrime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ChartPrime
 */

import {
  color, matrix, array, taCore, getSourceSeries,
  type BarColorConfig, type FillConfig, type HLineConfig, type IndicatorResult, type InputConfig, type PlotConfig,
  type Bar, type SourceType, type FillData,
} from 'oakscriptjs';
import type { BarColorData, LineDrawingData, LinefillData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { barInterval, barTime } from '../bar-time';

type MaStyle = 'EMA' | 'DEMA' | 'TEMA' | 'WMA' | 'SMA';

export interface MomentumGhostMachineInputs {
  /** Source */
  source: SourceType;
  /** Half of the sinc filter window */
  momentumLength: number;
  /** Cutoff divisor of the sinc filter */
  momentumSmoothing: number;
  /** Length of the momentum smoothing */
  postSmoothing: number;
  /** Average of the momentum smoothing */
  postSmoothingStyle: MaStyle;
  /** Length of the MA */
  maLength: number;
  /** Average of the MA */
  maStyle: MaStyle;
  /** Projection lines and columns */
  enableProjection: boolean;
  /** Transparency of the convergence divergence histogram */
  cdAlpha: number;
  /** Candle colours */
  candleColorStyle: 'MA' | 'Direct' | 'Both' | 'None';
  momentumColor: string;
  maColor: string;
  cdUpOver: string;
  cdUpUnder: string;
  cdDownUnder: string;
  cdDownOver: string;
  /** Glow copies of the plots */
  glow: boolean;
}

export const defaultInputs: MomentumGhostMachineInputs = {
  source: 'close',
  momentumLength: 50,
  momentumSmoothing: 50,
  postSmoothing: 4,
  postSmoothingStyle: 'WMA',
  maLength: 24,
  maStyle: 'EMA',
  enableProjection: true,
  cdAlpha: 25,
  candleColorStyle: 'Both',
  momentumColor: '#ffffff',
  maColor: '#f7a000',
  cdUpOver: '#2ac075',
  cdUpUnder: '#d5fce9',
  cdDownUnder: '#f82934',
  cdDownOver: '#ffc8cb',
  glow: true,
};

const MA_OPTIONS: MaStyle[] = ['EMA', 'DEMA', 'TEMA', 'WMA', 'SMA'];
const SETTINGS = 'Settings';
const STYLE = 'Style';

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close', group: SETTINGS },
  {
    id: 'momentumLength', type: 'int', title: 'Momentum Length', defval: 50, min: 1, group: SETTINGS,
  },
  {
    id: 'momentumSmoothing', type: 'float', title: 'Momentum Smoothing', defval: 50, min: 1, group: SETTINGS,
    tooltip: 'Adjust the level of smoothing for the momentum length. The longer the momentum length the more you can smooth it.',
  },
  {
    id: 'postSmoothing', type: 'int', title: 'Post Smoothing', defval: 4, min: 1, group: SETTINGS,
    tooltip: 'Adjust the level of smoothing for the indicator.',
  },
  { id: 'postSmoothingStyle', type: 'string', title: 'Post Smoothing Style', defval: 'WMA', options: MA_OPTIONS, group: SETTINGS },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 24, min: 2, group: SETTINGS },
  { id: 'maStyle', type: 'string', title: 'MA Style', defval: 'EMA', options: MA_OPTIONS, group: SETTINGS },
  { id: 'enableProjection', type: 'bool', title: 'Ghost Mode', defval: true, group: STYLE },
  { id: 'cdAlpha', type: 'int', title: 'MA Difference Alpha', defval: 25, min: 0, max: 100, group: STYLE },
  {
    id: 'candleColorStyle', type: 'string', title: 'Candle Color Style', defval: 'Both', options: ['MA', 'Direct', 'Both', 'None'],
    group: STYLE,
    tooltip: 'MA: Use the moving average convergance divergance to color the candles.'
      + '\n\n' + 'Direct: Use the momentum as a source of color. When the momentum is positive it will be the bullish color and when its negative it will be the bearish color.'
      + '\n\n' + 'Both: Color the candles bassed on the ma and the polarity of the momentum. The bullish color will be darker if the momentum is negative and the bearish color will be lighter if the momentum is positive.'
      + '\n\n' + 'None: Dont color the candles.',
  },
  { id: 'momentumColor', type: 'color', title: 'Momentum Color', defval: '#ffffff', group: STYLE },
  { id: 'maColor', type: 'color', title: 'MA Color', defval: '#f7a000', group: STYLE },
  { id: 'cdUpOver', type: 'color', title: 'Bullish Up', defval: '#2ac075', group: STYLE },
  { id: 'cdUpUnder', type: 'color', title: 'Bullish Down', defval: '#d5fce9', group: STYLE },
  { id: 'cdDownUnder', type: 'color', title: 'Bearish Down', defval: '#f82934', group: STYLE },
  { id: 'cdDownOver', type: 'color', title: 'Bearish Up', defval: '#ffc8cb', group: STYLE },
  { id: 'glow', type: 'bool', title: 'Glow', defval: true, group: STYLE },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Convergance Divergence', color: '#2962ff', lineWidth: 5, style: 'histogram' },
  { id: 'plot1', title: 'Convergance Divergence Glow', color: '#2962ff', lineWidth: 1, style: 'columns', display: 'pane' },
  { id: 'plot2', title: 'MA', color: '#f7a000', lineWidth: 1 },
  { id: 'plot3', title: 'MA Glow', color: String(color.new('#f7a000', 80)), lineWidth: 4, display: 'pane' },
  { id: 'plot4', title: 'Momentum', color: '#ffffff', lineWidth: 1 },
  { id: 'plot5', title: 'Momentum Glow', color: String(color.new('#ffffff', 80)), lineWidth: 4, display: 'pane' },
  { id: 'plot6', title: 'Projected Delta', color: '#2962ff', lineWidth: 1, style: 'columns', offset: 1 },
  { id: 'plot7', title: 'Projected Delta', color: '#2962ff', lineWidth: 1, style: 'columns', offset: 2 },
];

/** hline(0): default colour, dashed */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline0', price: 0, title: 'Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot3', plot2: 'plot5', title: 'Momentum Fill', color: String(color.new('#f7a000', 90)) },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'linefill'];

export const metadata = {
  title: 'Momentum Ghost Machine [ChartPrime]',
  shortTitle: 'Momentum Ghost Machine [ChartPrime]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const sinc = (x: number) => (Math.abs(x) <= EPS ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
const blackman = (n: number, length: number) =>
  0.42 - 0.5 * Math.cos((2 * Math.PI * n) / (length - 1)) + 0.08 * Math.cos((4 * Math.PI * n) / (length - 1));

/** sinc_coefficients(): `(x - 1) / 2` keeps its fraction (an int typed value can hold one) */
function sincCoefficients(length: number, fc: number): number[] {
  const coefficients: number[] = [];
  const mid = (length - 1) / 2;
  const cutoff = 1 / fc;
  for (let i = 0; i < length; i++) {
    const n = i - mid;
    coefficients.push(sinc(2 * cutoff * n) * blackman(length % 2 === 0 ? i + 0.5 : i, length));
  }
  return coefficients;
}

/** lti_sinc(): convolution of the last `length` source values (newest first), from bar_index > length */
function ltiSinc(source: number[], length: number, fc: number): number[] {
  const coefficients = sincCoefficients(length, fc);
  const data: number[] = [];
  let normalize = NaN;
  let toeplitz: ReturnType<typeof matrix.new_matrix<number>> | null = null;
  return source.map((x, i) => {
    // get_data()
    data.unshift(x);
    if (data.length > length) data.pop();
    if (!(i > length)) return NaN;
    // convolution(): `var` normalize and Toeplitz matrix (one row: data.size() equals the window here)
    if (toeplitz === null) {
      normalize = array.sum(coefficients);
      const M = data.length;
      const N = coefficients.length;
      const rows = M - N + 1;
      toeplitz = matrix.new_matrix<number>(rows, M, 0);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < N; c++) {
          if (c + r < M) matrix.set(toeplitz, r, c + r, coefficients[c]);
          else break;
        }
      }
    }
    const convolved = (matrix.mult(toeplitz, data.slice()) as number[])[0];
    return convolved / normalize;
  });
}

/** ema() of the script: seeded with the source when the previous value is na */
function ema(source: number[], length: number): number[] {
  const alpha = 2.0 / (length + 1);
  let smoothed = NaN;
  return source.map((x) => {
    smoothed = alpha * x + (1.0 - alpha) * (isNaN(smoothed) ? x : smoothed);
    return smoothed;
  });
}

/** wma() of the script: na until `length` values (an na in the window gives na) */
function wma(source: number[], length: number): number[] {
  const weightSum = length * 0.5 * (length + 1);
  return source.map((_, i) => {
    let sum = 0.0;
    for (let k = 0; k < length; k++) {
      const v = i - k >= 0 ? source[i - k] : NaN;
      sum += v * (length - k);
    }
    return sum / weightSum;
  });
}

/** sma() of the script: running sum (ta.cum), average of the bars so far before `length - 1` */
function sma(source: number[], length: number): number[] {
  const sum = taCore.cum(source);
  return source.map((_, i) => {
    if (i < length - 1) return sum[i] / (i + 1);
    return (sum[i] - (i - length >= 0 ? sum[i - length] : NaN)) / length;
  });
}

function filter(source: number[], length: number, style: MaStyle): number[] {
  if (!(length > 1)) return source;
  switch (style) {
    case 'EMA': return ema(source, length);
    case 'DEMA': {
      const ema1 = ema(source, length);
      const ema2 = ema(ema1, length);
      return ema1.map((e1, i) => 2.0 * e1 - ema2[i]);
    }
    case 'TEMA': {
      const ema1 = ema(source, length);
      const ema2 = ema(ema1, length);
      const ema3 = ema(ema2, length);
      return ema1.map((e1, i) => (e1 - ema2[i]) * 3.0 + ema3[i]);
    }
    case 'WMA': return wma(source, length);
    default: return sma(source, length);
  }
}

/** color_changer(): lighter (direction true) or darker copy of the colour (color.rgb truncates) */
function colorChanger(source: string, direction: boolean): string {
  const r = color.r(source);
  const g = color.g(source);
  const b = color.b(source);
  return direction
    ? String(color.rgb((255 - r) / 3 + r, (255 - g) / 3 + g, (255 - b) / 3 + b))
    : String(color.rgb(r / 1.5, g / 1.5, b / 1.5));
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MomentumGhostMachineInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; fills: FillData[]; lines: LineDrawingData[]; linefills: LinefillData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const source = getSourceSeries(bars, cfg.source).toArray().map((v) => v ?? NaN);

  const lengthCorrection = Math.trunc(cfg.momentumLength) * 2;
  const sincArr = ltiSinc(source, lengthCorrection, cfg.momentumSmoothing);
  const offset = (lengthCorrection - 1) / 2;
  const delta = filter(source.map((x, i) => (x - sincArr[i]) / offset), Math.trunc(cfg.postSmoothing), cfg.postSmoothingStyle);
  const ma = filter(filter(delta, 2, cfg.maStyle), Math.trunc(cfg.maLength), cfg.maStyle);
  const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);

  const cdAlpha = cfg.cdAlpha;
  const glowAlpha = cdAlpha + (100 - cdAlpha) / 2;
  const momo: number[] = [];
  const barColors: BarColorData[] = [];
  const fillColors: string[] = [];
  const plot0: { time: number; value: number; color: string }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  let mColor = '';
  let directColor = '';
  let pMa1 = NaN;
  let pMa2 = NaN;
  let pM1 = NaN;
  let pM2 = NaN;
  const d1Arr: number[] = [];
  const d2Arr: number[] = [];
  const dc1Arr: string[] = [];
  const dc2Arr: string[] = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const dl = delta[i];
    const m = dl - ma[i];
    momo.push(m);
    const m1 = at(momo, i - 1);
    if (gt(m, 0)) mColor = gt(m, m1) ? cfg.cdUpOver : cfg.cdUpUnder;
    else mColor = lt(m, m1) ? cfg.cdDownUnder : cfg.cdDownOver;

    if (cfg.candleColorStyle === 'Both') {
      if (gt(dl, 0)) directColor = lt(m, 0) ? colorChanger(mColor, true) : mColor;
      else directColor = gt(m, 0) ? colorChanger(mColor, false) : mColor;
    } else if (gt(dl, 0)) {
      directColor = gt(dl, at(delta, i - 1)) ? cfg.cdUpOver : cfg.cdUpUnder;
    } else {
      directColor = lt(dl, at(delta, i - 1)) ? cfg.cdDownUnder : cfg.cdDownOver;
    }

    const value = Number.isFinite(m) ? m : NaN;
    plot0.push({ time: t, value, color: String(color.new(mColor, cdAlpha)) });
    plot1.push({ time: t, value: cfg.glow ? value : NaN, color: String(color.new(mColor, glowAlpha)) });
    fillColors.push(String(color.new(gt(dl, ma[i]) ? cfg.momentumColor : cfg.maColor, 90)));

    if (cfg.enableProjection) {
      const projection = ((dl - at(delta, i - 1)) + (dl - at(delta, i - 2)) / 2) / 2;
      const maProject = ((ma[i] - at(ma, i - 1)) + (ma[i] - at(ma, i - 2)) / 2) / 2;
      pMa1 = ma[i] + maProject;
      pM1 = dl + projection;
      pMa2 = ma[i] + maProject * 2;
      pM2 = dl + projection * 2;
    }
    const d1 = pM1 - pMa1;
    const d2 = pM2 - pMa2;
    let dc1: string;
    let dc2: string;
    if (gt(d1, 0)) dc1 = gt(d1, m) ? cfg.cdUpOver : cfg.cdUpUnder;
    else dc1 = lt(d1, m) ? cfg.cdDownUnder : cfg.cdDownOver;
    if (gt(d2, 0)) dc2 = gt(d2, d1) ? cfg.cdUpOver : cfg.cdUpUnder;
    else dc2 = lt(d2, d1) ? cfg.cdDownUnder : cfg.cdDownOver;
    d1Arr.push(d1);
    d2Arr.push(d2);
    dc1Arr.push(dc1);
    dc2Arr.push(dc2);

    const barColor = cfg.candleColorStyle === 'MA' ? mColor : cfg.candleColorStyle === 'None' ? null : directColor;
    if (barColor !== null) barColors.push({ id: 'barcolor0', time: t, color: barColor });
  }

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  const line = (a: number[], col: string) => bars.map((b, i) => ({ time: b.time, value: finite(a[i]), color: col }));
  const glowLine = (a: number[], col: string) =>
    bars.map((b, i) => ({ time: b.time, value: cfg.glow ? finite(a[i]) : NaN, color: col }));
  // plot(..., offset = k, show_last = 1): the value of bar i is drawn k bars to the right; only the value of the last
  // bar is shown (the colours of the earlier bars are kept, without a value)
  const projected = (values: number[], cols: string[], k: number) => {
    const pts: { time: number; value: number; color?: string }[] = [];
    for (let j = 0; j < n + k; j++) {
      const src = j - k;
      const time = j < n ? bars[j].time : T(j);
      if (src < 0) pts.push({ time, value: NaN });
      else pts.push({ time, value: src === n - 1 ? finite(values[src]) : NaN, color: String(color.new(cols[src], 60)) });
    }
    return pts;
  };

  const lines: LineDrawingData[] = [];
  const linefills: LinefillData[] = [];
  if (cfg.enableProjection && n > 0) {
    // `var` lines set on every bar (dotted): those of the last bar remain
    const L = n - 1;
    const projectDelta: LineDrawingData = {
      time1: T(L), price1: delta[L], time2: T(L + 2), price2: pM2, color: cfg.momentumColor, width: 1, style: 'dotted',
    };
    const projectMa: LineDrawingData = {
      time1: T(L), price1: ma[L], time2: T(L + 2), price2: pMa2, color: cfg.maColor, width: 1, style: 'dotted',
    };
    lines.push(projectDelta, projectMa);
    // linefill.new() on the same pair of lines replaces the earlier linefill: the one of the last bar remains
    linefills.push({
      line1: projectDelta, line2: projectMa, color: String(color.new(gt(pMa2, pM2) ? cfg.maColor : cfg.momentumColor, 90)),
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0,
      plot1,
      plot2: line(ma, cfg.maColor),
      plot3: glowLine(ma, String(color.new(cfg.maColor, 80))),
      plot4: line(delta, cfg.momentumColor),
      plot5: glowLine(delta, String(color.new(cfg.momentumColor, 80))),
      plot6: projected(d1Arr, dc1Arr, 1),
      plot7: projected(d2Arr, dc2Arr, 2),
    },
    hlines: [{ value: 0, options: { title: 'Level', color: '#787B86', linestyle: 'dashed', linewidth: 1 } }],
    fills: [{ id: 'fill0', plot1: 'plot3', plot2: 'plot5', options: { title: 'Momentum Fill' }, colors: fillColors }],
    barColors,
    lines,
    linefills,
  };
}

export const MomentumGhostMachine = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig, barColorConfig, drawingKinds,
};
