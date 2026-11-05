/**
 * Nadaraya-Watson Trend [QuantAlgo]
 *
 * Kernel regression of the source over the last `lookback` bars: weights from a kernel (Gaussian, Epanechnikov,
 * Triangular, Quartic, Cosine or Rational Quadratic) of the bar distance with bandwidth = bandwidth * multiplier.
 * Residual bands at the kernel-weighted mean absolute deviation * band multiplier. The trend colour follows the
 * slope of the line; six fills fade from the line to the price, markers show the slope reversals, and bars and
 * background can take the trend colour.
 *
 * Alerts (alertcondition, `alerts` of the result): bullish / bearish / any kernel reversal, source crossing above the
 * upper / below the lower residual band (the bands as computed, also when they are not shown).
 *
 * Reference: "Nadaraya-Watson Trend [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Kernel Reversal', message: 'Nadaraya-Watson Trend: BULLISH kernel reversal on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Kernel Reversal', message: 'Nadaraya-Watson Trend: BEARISH kernel reversal on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Any Kernel Reversal', message: 'Nadaraya-Watson Trend: Kernel path direction changed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert3', title: 'Source Cross Above Upper Band', message: 'Nadaraya-Watson Trend: Source crossed above upper residual band on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert4', title: 'Source Cross Below Lower Band', message: 'Nadaraya-Watson Trend: Source crossed below lower residual band on {{exchange}}:{{ticker}} - {{interval}}' },
];

const KERNELS = ['Gaussian', 'Epanechnikov', 'Triangular', 'Quartic', 'Cosine', 'Rational Quadratic'];
const COLOR_PAIRS: Record<string, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00d4ff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Cyber: ['#00cccc', '#ff6600'],
  Neon: ['#ffff00', '#ff00ff'],
};

export interface NadarayaWatsonTrendInputs {
  /** Default uses the inputs below; Fast Response 25 / 5 / 1.5; Smooth Trend 100 / 12 / 2.5 */
  preset: string;
  src: SourceType;
  kernelType: string;
  lookback: number;
  bandwidth: number;
  hMult: number;
  /** Relative weighting of the Rational Quadratic kernel */
  relWeight: number;
  showBands: boolean;
  bandMult: number;
  showFill: boolean;
  showMarkers: boolean;
  /** Colour preset; Custom uses bullishColor / bearishColor */
  colorPreset: string;
  bullishColor: string;
  bearishColor: string;
  showCandles: boolean;
  barTrans: number;
  showBgcolor: boolean;
  bgTrans: number;
}

export const defaultInputs: NadarayaWatsonTrendInputs = {
  preset: 'Default',
  src: 'close',
  kernelType: 'Gaussian',
  lookback: 50,
  bandwidth: 8,
  hMult: 2.0,
  relWeight: 8.0,
  showBands: false,
  bandMult: 1.5,
  showFill: true,
  showMarkers: true,
  colorPreset: 'Custom',
  bullishColor: '#00ffaa',
  bearishColor: '#ff0000',
  showCandles: false,
  barTrans: 0,
  showBgcolor: false,
  bgTrans: 90,
};

export const inputConfig: InputConfig[] = [
  { id: 'preset', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'kernelType', type: 'string', title: 'Kernel Type', defval: 'Gaussian', options: KERNELS },
  { id: 'lookback', type: 'int', title: 'Lookback Window', defval: 50, min: 1, max: 500 },
  { id: 'bandwidth', type: 'int', title: 'Kernel Bandwidth', defval: 8, min: 1 },
  { id: 'hMult', type: 'float', title: 'Bandwidth Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'relWeight', type: 'float', title: 'Relative Weighting (RQ)', defval: 8.0, min: 0.1, step: 0.25 },
  { id: 'showBands', type: 'bool', title: 'Show Residual Bands', defval: false },
  { id: 'bandMult', type: 'float', title: 'Band Multiplier', defval: 1.5, min: 0.1, step: 0.1 },
  { id: 'showFill', type: 'bool', title: 'Show Gradient Fill', defval: true },
  { id: 'showMarkers', type: 'bool', title: 'Show Reversal Markers', defval: true },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'] },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#ff0000' },
  { id: 'showCandles', type: 'bool', title: 'Enable Bar Coloring', defval: false },
  { id: 'barTrans', type: 'int', title: 'Bar Color Transparency', defval: 0, min: 0, max: 100 },
  { id: 'showBgcolor', type: 'bool', title: 'Enable Background Coloring', defval: false },
  { id: 'bgTrans', type: 'int', title: 'Background Color Transparency', defval: 90, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'NW Trend', color: '#00ffaa', lineWidth: 3 },
  { id: 'plot1', title: 'Price Anchor', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Gradient 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Gradient 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Gradient 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Gradient 4', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Gradient 5', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'NW Upper Band', color: '#00ffaa', lineWidth: 1 },
  { id: 'plot8', title: 'NW Lower Band', color: '#00ffaa', lineWidth: 1 },
];

export const metadata = {
  title: 'Nadaraya-Watson Trend [QuantAlgo]',
  shortTitle: 'Nadaraya-Watson Trend',
  overlay: true,
};

/** kernel_weight(dist, h, ktype, rq) */
function kernelWeight(dist: number, h: number, ktype: string, rq: number): number {
  if (!(h > 0)) return 0;
  const u = dist / h;
  if (ktype === 'Gaussian') return Math.exp(-(dist * dist) / (2.0 * h * h));
  if (ktype === 'Rational Quadratic') return Math.pow(1.0 + (dist * dist) / (2.0 * rq * h * h), -rq);
  if (Math.abs(u) <= 1.0) {
    if (ktype === 'Epanechnikov') return 0.75 * (1.0 - u * u);
    if (ktype === 'Triangular') return 1.0 - Math.abs(u);
    if (ktype === 'Quartic') return (15.0 / 16.0) * Math.pow(1.0 - u * u, 2.0);
    if (ktype === 'Cosine') return (Math.PI / 4.0) * Math.cos((Math.PI * u) / 2.0);
  }
  return 0;
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface NwRun extends BarRunState<Record<string, never>> {
  src: number[];
  nw: number[];
  upper: number[];
  lower: number[];
  plots: Point[][];
  fillCols: string[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<NadarayaWatsonTrendInputs>): BarStudy<NwRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lookback = cfg.preset === 'Fast Response' ? 25 : cfg.preset === 'Smooth Trend' ? 100 : cfg.lookback;
  const bandwidth = cfg.preset === 'Fast Response' ? 5 : cfg.preset === 'Smooth Trend' ? 12 : cfg.bandwidth;
  const hMult = cfg.preset === 'Fast Response' ? 1.5 : cfg.preset === 'Smooth Trend' ? 2.5 : cfg.hMult;
  const [bullish, bearish] = COLOR_PAIRS[cfg.colorPreset] ?? [cfg.bullishColor, cfg.bearishColor];
  const value = barSource(cfg.src);
  const h = bandwidth * hMult;
  const weights = Array.from({ length: lookback + 1 }, (_, k) => kernelWeight(k, h, cfg.kernelType, cfg.relWeight));
  const c = (col: string, transp: number) => String(color.new(col, transp));
  const fillTransp = [60, 68, 76, 84, 92, 96];
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: NwRun = {
        src: [], nw: [], upper: [], lower: [],
        plots: Array.from({ length: 9 }, () => []),
        fillCols: Array.from({ length: 7 }, () => []),
        markers: [], barColors: [], bgColors: [],
        flags: Array.from({ length: 5 }, () => []), times: Array.from({ length: 5 }, () => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, s.bgColors, ...s.times];
      s.series = [s.src, s.nw, s.upper, s.lower, ...s.plots, ...s.fillCols, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const { src } = s;
      src[i] = value(bars[i]);
      // sum over i = 0..lookback of src[i] * w (na when a source value before bar 0 is used)
      let sumW = 0;
      let sumP = 0;
      for (let k = 0; k <= lookback; k++) {
        sumW += weights[k];
        sumP += (i - k >= 0 ? src[i - k] : NaN) * weights[k];
      }
      const cur = sumW !== 0 ? sumP / sumW : NaN;
      s.nw[i] = cur;
      // residual: kernel-weighted mean of |src - nw_trend| over the non-na values
      let sumAbs = 0;
      let sumResW = 0;
      for (let k = 0; k <= lookback; k++) {
        const v = i - k >= 0 ? src[i - k] : NaN;
        if (weights[k] > 0 && !isNaN(v) && !isNaN(cur)) {
          sumAbs += weights[k] * Math.abs(v - cur);
          sumResW += weights[k];
        }
      }
      const residual = sumResW !== 0 ? sumAbs / sumResW : NaN;
      const ok = !isNaN(cur) && !isNaN(residual);
      const upper = ok ? cur + residual * cfg.bandMult : NaN;
      const lower = ok ? cur - residual * cfg.bandMult : NaN;
      s.upper[i] = upper;
      s.lower[i] = lower;

      const t = bars[i].time;
      const { plots, fillCols } = s;
      const p1 = i > 0 ? s.nw[i - 1] : NaN;
      const p2 = i > 1 ? s.nw[i - 2] : NaN;
      // trend_color = na(nw) or na(nw[1]) ? bullish : nw > nw[1] ? bullish : bearish
      const trend = isNaN(cur) || isNaN(p1) ? bullish : cur > p1 ? bullish : bearish;
      const step = !isNaN(cur) ? (src[i] - cur) / 6.0 : NaN;
      plots[0][i] = { time: t, value: cur, color: c(trend, 0) };
      plots[1][i] = { time: t, value: src[i] };
      for (let g = 1; g <= 5; g++) plots[g + 1][i] = { time: t, value: !isNaN(step) ? cur + step * g : NaN };
      plots[7][i] = { time: t, value: cfg.showBands ? upper : NaN, color: c(trend, 55) };
      plots[8][i] = { time: t, value: cfg.showBands ? lower : NaN, color: c(trend, 55) };
      for (let g = 0; g < 6; g++) fillCols[g][i] = cfg.showFill && !isNaN(cur) ? c(trend, fillTransp[g]) : 'transparent';
      fillCols[6][i] = cfg.showBands ? c(trend, 90) : 'transparent';

      // turned_bullish: nw[1] < nw[2] and nw > nw[1] (all three not na); turned_bearish the other way
      const valid = !isNaN(cur) && !isNaN(p1) && !isNaN(p2);
      const turnedBull = valid && p1 < p2 && cur > p1;
      const turnedBear = valid && p1 > p2 && cur < p1;
      if (cfg.showMarkers && valid && p1 < p2 && cur > p1) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: c(bullish, 0), size: 'small' });
      }
      if (cfg.showMarkers && valid && p1 > p2 && cur < p1) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: c(bearish, 0), size: 'small' });
      }
      if (cfg.showCandles && !isNaN(cur)) s.barColors.push({ time: t, color: c(trend, cfg.barTrans) });
      if (cfg.showBgcolor && !isNaN(cur)) s.bgColors.push({ time: t, color: c(trend, cfg.bgTrans) });

      // band_cross_up = not na(upper) and ta.crossover(src, upper); band_cross_dn the same with lower / crossunder
      const ps = i > 0 ? src[i - 1] : NaN;
      const crossUp = src[i] > upper && ps <= (i > 0 ? s.upper[i - 1] : NaN) && !isNaN(upper);
      const crossDn = src[i] < lower && ps >= (i > 0 ? s.lower[i - 1] : NaN) && !isNaN(lower);
      const flags = [turnedBull, turnedBear, turnedBull || turnedBear, crossUp, crossDn];
      for (let k = 0; k < 5; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k <= 8; k++) plots[`plot${k}`] = s.plots[k].slice();
      const f = s.fillCols;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          { plot1: 'plot0', plot2: 'plot2', colors: f[0].slice() },
          { plot1: 'plot2', plot2: 'plot3', colors: f[1].slice() },
          { plot1: 'plot3', plot2: 'plot4', colors: f[2].slice() },
          { plot1: 'plot4', plot2: 'plot5', colors: f[3].slice() },
          { plot1: 'plot5', plot2: 'plot6', colors: f[4].slice() },
          { plot1: 'plot6', plot2: 'plot1', colors: f[5].slice() },
          { plot1: 'plot7', plot2: 'plot8', colors: f[6].slice() },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((fl) => n > 0 && fl[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NadarayaWatsonTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<NadarayaWatsonTrendInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const NadarayaWatsonTrend = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
