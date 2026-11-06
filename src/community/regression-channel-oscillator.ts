/**
 * Regression Channel Oscillator
 *
 * A linear regression of the previous `len` source values (built from cumulative sums: a = WMA, b = SMA of src[1],
 * line start B = 3a - 2b, slope m = (4b - 3a - B) / (len - 1)), with a channel half width of mult * RMSE of the
 * values around that line. The oscillator is 50 * (src - B) / (mult * RMSE), clamped to -150..150 and smoothed
 * (SMA / EMA / none); the signal line is its SMA. Glow plots, a five-layer fill to zero, band glows coloured when the
 * signal passes its thresholds, and triangles on crosses of the oversold / overbought levels.
 * Alerts (alertcondition, `alerts` of the result): the oscillator crosses over the oversold / under the overbought
 * level, the signal crosses over / under 0, over the MA oversold and under the MA overbought threshold.
 *
 * Reference: "Regression Channel Oscillator" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RegressionChannelOscillatorInputs {
  /** Regression length */
  len: number;
  /** RMSE multiplier (channel) */
  mult: number;
  src: SourceType;
  showSignalLine: boolean;
  signalColorMode: 'Direction' | 'Position vs Zero';
  /** Signal SMA length */
  sigLen: number;
  smoothType: 'None' | 'SMA' | 'EMA';
  smoothLen: number;
  obLevel: number;
  osLevel: number;
  maOverbought: number;
  maOversold: number;
  bullColor: string;
  bearColor: string;
  signalColorBull: string;
  signalColorBear: string;
  obColor: string;
  osColor: string;
  midLineColor: string;
  showOverboughtGradient: boolean;
  showOversoldGradient: boolean;
  showOscillatorGradient: boolean;
  showMaGradient: boolean;
  fillEnabled: boolean;
  fillTransparency: number;
  bandTransparency: number;
}

export const defaultInputs: RegressionChannelOscillatorInputs = {
  len: 50,
  mult: 2.5,
  src: 'close',
  showSignalLine: true,
  signalColorMode: 'Position vs Zero',
  sigLen: 30,
  smoothType: 'SMA',
  smoothLen: 3,
  obLevel: 50,
  osLevel: -50,
  maOverbought: 25,
  maOversold: -25,
  bullColor: 'rgb(22, 193, 67)',
  bearColor: 'rgb(229, 11, 11)',
  signalColorBull: 'rgb(22, 193, 67)',
  signalColorBear: 'rgb(229, 11, 11)',
  obColor: color.red,
  osColor: color.green,
  midLineColor: color.gray,
  showOverboughtGradient: true,
  showOversoldGradient: true,
  showOscillatorGradient: true,
  showMaGradient: true,
  fillEnabled: true,
  fillTransparency: 70,
  bandTransparency: 40,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Regression Length', defval: 50, min: 5 },
  { id: 'mult', type: 'float', title: 'RMSE Multiplier (channel)', defval: 2.5 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showSignalLine', type: 'bool', title: 'Show Signal MA', defval: true },
  { id: 'signalColorMode', type: 'string', title: 'Signal Color Mode', defval: 'Position vs Zero', options: ['Direction', 'Position vs Zero'] },
  { id: 'sigLen', type: 'int', title: 'Signal SMA Length', defval: 30 },
  { id: 'smoothType', type: 'string', title: 'Smooth Oscillator', defval: 'SMA', options: ['None', 'SMA', 'EMA'] },
  { id: 'smoothLen', type: 'int', title: 'Smooth Length', defval: 3, min: 1 },
  { id: 'obLevel', type: 'float', title: 'Overbought Level', defval: 50, min: 0, max: 150 },
  { id: 'osLevel', type: 'float', title: 'Oversold Level', defval: -50, min: -150, max: 0 },
  { id: 'maOverbought', type: 'float', title: 'MA Overbought Threshold', defval: 25, min: 0, max: 150 },
  { id: 'maOversold', type: 'float', title: 'MA Oversold Threshold', defval: -25, min: -150, max: 0 },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: 'rgb(22, 193, 67)' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: 'rgb(229, 11, 11)' },
  { id: 'signalColorBull', type: 'color', title: 'Signal SMA Bullish', defval: 'rgb(22, 193, 67)' },
  { id: 'signalColorBear', type: 'color', title: 'Signal SMA Bearish', defval: 'rgb(229, 11, 11)' },
  { id: 'obColor', type: 'color', title: 'Overbought Line Color', defval: color.red },
  { id: 'osColor', type: 'color', title: 'Oversold Line Color', defval: color.green },
  { id: 'midLineColor', type: 'color', title: 'Midline 0 Color', defval: color.gray },
  { id: 'showOverboughtGradient', type: 'bool', title: 'Show Overbought Gradient', defval: true },
  { id: 'showOversoldGradient', type: 'bool', title: 'Show Oversold Gradient', defval: true },
  { id: 'showOscillatorGradient', type: 'bool', title: 'Show Oscillator Gradient', defval: true },
  { id: 'showMaGradient', type: 'bool', title: 'Show Moving Average Gradient', defval: true },
  { id: 'fillEnabled', type: 'bool', title: 'Enable Gradient Fill', defval: true },
  { id: 'fillTransparency', type: 'int', title: 'Gradient Fill Transparency', defval: 70, min: 0, max: 100 },
  { id: 'bandTransparency', type: 'int', title: 'Band Gradient Transparency', defval: 40, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Overbought Gradient', color: color.gray, lineWidth: 8 },
  { id: 'plot1', title: 'Oversold Gradient', color: color.gray, lineWidth: 8 },
  { id: 'plot2', title: 'Oscillator', color: 'rgb(22, 193, 67)', lineWidth: 3 },
  { id: 'plot3', title: 'Oscillator Gradient', color: 'rgb(22, 193, 67)', lineWidth: 10 },
  { id: 'plot4', title: 'Signal SMA', color: color.gray, lineWidth: 1 },
  { id: 'plot5', title: 'Signal Gradient 1', color: color.gray, lineWidth: 4 },
  { id: 'plot6', title: 'Signal Gradient 2', color: color.gray, lineWidth: 2 },
  { id: 'plot7', title: 'Signal Gradient 3', color: color.gray, lineWidth: 1 },
  { id: 'plot8', title: 'Mid Layer 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot9', title: 'Mid Layer 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot10', title: 'Mid Layer 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot11', title: 'Mid Layer 4', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot12', title: 'Zero Line for Fill', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Regression Channel Oscillator',
  shortTitle: 'Regression Channel Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface RcoRun extends BarRunState<Record<string, never>> {
  cumW: ReturnType<typeof taStep.cum>;
  cum2: ReturnType<typeof taStep.cum>;
  smooth: { step(v: number): number; commit(): void } | null;
  sig: ReturnType<typeof taStep.sma>;
  longX: ReturnType<typeof taStep.crossover>;
  shortX: ReturnType<typeof taStep.crossunder>;
  src: number[];
  cumWArr: number[];
  cum2Arr: number[];
  signal: number[];
  plots: Point[][];
  layers: string[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<RegressionChannelOscillatorInputs>): BarStudy<RcoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.len;
  const value = barSource(cfg.src);
  const gradientTransparency = 85;
  // Wma(_src, _len) => denom = _len * (_len + 1) / 2
  const denom = (len * (len + 1)) / 2;
  const gray = color.gray;
  const showSig = cfg.showSignalLine;
  const showSigGrad = cfg.showSignalLine && cfg.showMaGradient;
  const layerAdd = [0, 4, 8, 12, 16];
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const cumW = taStep.cum();
      const cum2 = taStep.cum();
      let smooth: RcoRun['smooth'] = null;
      if (cfg.smoothType === 'SMA') {
        const m = taStep.sma();
        smooth = { step: (v) => m.step(v, cfg.smoothLen), commit: () => m.commit() };
      } else if (cfg.smoothType === 'EMA') {
        smooth = taStep.ema(cfg.smoothLen);
      }
      const sig = taStep.sma();
      const longX = taStep.crossover();
      const shortX = taStep.crossunder();
      const s: RcoRun = {
        cumW, cum2, smooth, sig, longX, shortX, src: [], cumWArr: [], cum2Arr: [], signal: [],
        plots: Array.from({ length: 13 }, () => []), layers: layerAdd.map(() => []),
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []), markers: [],
        steps: [cumW, cum2, ...(smooth ? [smooth] : []), sig, longX, shortX], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [s.src, s.cumWArr, s.cum2Arr, s.signal, ...s.plots, ...s.layers, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const ago = (x: number[], k: number) => (i - k >= 0 ? x[i - k] : NaN);
      const src = value(bars[i]);
      s.src[i] = src;
      const src1 = ago(s.src, 1); // src[1]
      // Sum(_src, _len) => a = ta.cum(_src); a - a[_len] (one ta.cum per call)
      // Wma(_src, _len) => a = ta.cum(_src); (_len * a - Sum(a[1], _len)) / denom
      const cumW = s.cumW.step(src1);
      s.cumWArr[i] = cumW;
      const c2 = s.cum2.step(ago(s.cumWArr, 1));
      s.cum2Arr[i] = c2;
      const sumW = c2 - ago(s.cum2Arr, len);
      const a = (len * cumW - sumW) / denom;
      // b = Sum(src[1], len) / len (its ta.cum of src[1] has the values of the Wma one)
      const sumB = cumW - ago(s.cumWArr, len);
      const b = sumB / len;

      const A0 = 4 * b - 3 * a;
      const B = 3 * a - 2 * b;
      const m = (A0 - B) / (len - 1);
      // for i = 0 to len - 1: l = B + m * i; d += math.pow(src[i + 1] - l, 2)
      let d = 0.0;
      for (let k = 0; k <= len - 1; k++) {
        const l = B + m * k;
        d += Math.pow(ago(s.src, k + 1) - l, 2);
      }
      const rmse = Math.sqrt(d / (len - 1)) * cfg.mult;
      // rawOsc = rmse != 0 ? (src - mid) / rmse : 0.0 (na != 0 is false: 0.0 while rmse is na)
      const rawOsc = ne(rmse, 0) ? (src - B) / rmse : 0.0;
      const o = rawOsc * 50;
      const osc0 = Math.max(Math.min(o, 150), -150);

      const osc = s.smooth ? s.smooth.step(osc0) : osc0;
      const signal = s.sig.step(osc, cfg.sigLen);
      s.signal[i] = signal;
      const prevSignal = ago(s.signal, 1);

      // Signal colour
      let sigColor = gray;
      if (cfg.signalColorMode === 'Direction') {
        sigColor = gt(signal, prevSignal) ? cfg.signalColorBull : lt(signal, prevSignal) ? cfg.signalColorBear : gray;
      }
      if (cfg.signalColorMode === 'Position vs Zero') {
        sigColor = gt(signal, 0) ? cfg.signalColorBull : lt(signal, 0) ? cfg.signalColorBear : gray;
      }
      const lineColor = gt(osc, 0) ? cfg.bullColor : cfg.bearColor;

      const p = s.plots;
      // plot(showOverboughtGradient ? obLevel : na, color = color.new(signal >= maOverbought ? obColor : color.gray, bandTransparency), linewidth = 8)
      p[0][i] = {
        time, value: cfg.showOverboughtGradient ? cfg.obLevel : NaN,
        color: String(color.new(ge(signal, cfg.maOverbought) ? cfg.obColor : gray, cfg.bandTransparency)),
      };
      p[1][i] = {
        time, value: cfg.showOversoldGradient ? cfg.osLevel : NaN,
        color: String(color.new(le(signal, cfg.maOversold) ? cfg.osColor : gray, cfg.bandTransparency)),
      };
      p[2][i] = { time, value: osc, color: lineColor };
      p[3][i] = {
        time, value: cfg.showOscillatorGradient ? osc : NaN,
        color: String(color.new(lineColor, gradientTransparency)),
      };
      p[4][i] = { time, value: showSig ? signal : NaN, color: sigColor };
      p[5][i] = { time, value: showSigGrad ? signal : NaN, color: String(color.new(sigColor, 60)) };
      p[6][i] = { time, value: showSigGrad ? signal : NaN, color: String(color.new(sigColor, 35)) };
      p[7][i] = { time, value: showSigGrad ? signal : NaN, color: String(color.new(sigColor, 0)) };
      p[8][i] = { time, value: osc * 0.8 };
      p[9][i] = { time, value: osc * 0.6 };
      p[10][i] = { time, value: osc * 0.4 };
      p[11][i] = { time, value: osc * 0.2 };
      p[12][i] = { time, value: 0 };

      // fill(pOsc, pMid1, color = fillEnabled ? color.new(lineColor, fillTransparency) : na) ... + 4, + 8, + 12, + 16
      for (let k = 0; k < layerAdd.length; k++) {
        s.layers[k][i] = cfg.fillEnabled ? String(color.new(lineColor, cfg.fillTransparency + layerAdd[k])) : 'transparent';
      }

      // longOBOS = ta.crossover(osc, osLevel); shortOBOS = ta.crossunder(osc, obLevel)
      const longObos = s.longX.step(osc, cfg.osLevel);
      const shortObos = s.shortX.step(osc, cfg.obLevel);
      // plotshape(longOBOS ? osLevel - 3 : na, style = shape.triangleup, location = location.absolute, color = osColor, size = size.small)
      if (longObos) {
        s.markers.push({ time, position: 'atPriceMiddle', price: cfg.osLevel - 3, shape: 'triangleUp',
          color: cfg.osColor, size: 'small' });
      }
      if (shortObos) {
        s.markers.push({ time, position: 'atPriceMiddle', price: cfg.obLevel + 3, shape: 'triangleDown',
          color: cfg.obColor, size: 'small' });
      }

      // the alerts: crosses of the signal compared with the bar before
      const over = (w: number) => signal > w && prevSignal <= w;
      const under = (w: number) => signal < w && prevSignal >= w;
      const flags = [!!longObos, !!shortObos, over(0), under(0), over(cfg.maOversold), under(cfg.maOverbought)];
      for (let k = 0; k < flags.length; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      const pairs = [['plot2', 'plot8'], ['plot8', 'plot9'], ['plot9', 'plot10'], ['plot10', 'plot11'], ['plot11', 'plot12']];
      const fills = pairs.map(([plot1, plot2], k) => ({ plot1, plot2, colors: s.layers[k].slice() }));
      const band = String(color.new(color.gray, 80));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: cfg.obLevel, options: { title: 'Overbought', color: cfg.obColor, linestyle: 'dashed' } },
          { value: cfg.osLevel, options: { title: 'Oversold', color: cfg.osColor, linestyle: 'dashed' } },
          { value: 0, options: { title: 'Midline 0', color: cfg.midLineColor, linestyle: 'dashed' } },
          { value: -150, options: { title: 'Min', color: band, linestyle: 'dotted' } },
          { value: 150, options: { title: 'Max', color: band, linestyle: 'dotted' } },
        ],
        fills,
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RegressionChannelOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RegressionChannelOscillatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy (Oversold)', message: 'Oscillator crossed above oversold.' },
  { id: 'alert1', title: 'Sell (Overbought)', message: 'Oscillator crossed below overbought.' },
  { id: 'alert2', title: 'Signal MA Cross Above 0', message: 'Signal MA crossed ABOVE zero line.' },
  { id: 'alert3', title: 'Signal MA Cross Below 0', message: 'Signal MA crossed BELOW zero line.' },
  { id: 'alert4', title: 'Signal MA Cross Above MA OS', message: 'Signal MA crossed ABOVE its oversold threshold.' },
  { id: 'alert5', title: 'Signal MA Cross Below MA OB', message: 'Signal MA crossed BELOW its overbought threshold.' },
];

export const RegressionChannelOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
