/**
 * SuperSmoother MA Oscillator
 *
 * The source is smoothed with a 2-pole SuperSmoother; the oscillator is EMA(fast) - EMA(slow) of the smoothed price,
 * with an EMA(25) signal line and their difference as a histogram. The oscillator colour is a hue from red to green
 * (HSV) set by the tanh-normalised acceleration of the oscillator. Crosses of the signal line larger than
 * ATR * sensitivity give buy / sell triangles on the price pane (larger when the oscillator momentum agrees),
 * a background tint, fills to zero and to the signal line, and bar colours.
 *
 * Reference: "SuperSmoother MA Oscillator" by BOSWaves
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SuperSmootherMAOscillatorInputs {
  smoothingLength: number;
  fastLength: number;
  slowLength: number;
  srcMA: SourceType;
  atrLength: number;
  /** Pine input, not used by the Pine calculation */
  atrMultiplier: number;
  signalSensitivity: number;
  showVortexFill: boolean;
  fillTransparency: number;
  enhancedColors: boolean;
  enableCandleColor: boolean;
}

export const defaultInputs: SuperSmootherMAOscillatorInputs = {
  smoothingLength: 5,
  fastLength: 20,
  slowLength: 50,
  srcMA: 'close',
  atrLength: 20,
  atrMultiplier: 1.2,
  signalSensitivity: 0.03,
  showVortexFill: true,
  fillTransparency: 85,
  enhancedColors: true,
  enableCandleColor: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'smoothingLength', type: 'int', title: 'Price Smoothing Length', defval: 5 },
  { id: 'fastLength', type: 'int', title: 'Fast MA', defval: 20 },
  { id: 'slowLength', type: 'int', title: 'Slow MA', defval: 50 },
  { id: 'srcMA', type: 'source', title: 'Source Data', defval: 'close' },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 20 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 1.2 },
  { id: 'signalSensitivity', type: 'float', title: 'Signal Sensitivity', defval: 0.03, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'showVortexFill', type: 'bool', title: 'Show Vortex Fill', defval: true },
  { id: 'fillTransparency', type: 'int', title: 'Fill Transparency', defval: 85, min: 0, max: 100 },
  { id: 'enhancedColors', type: 'bool', title: 'Enhanced Colors', defval: true },
  { id: 'enableCandleColor', type: 'bool', title: 'Enable Candle Coloring', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: color.yellow, lineWidth: 2 },
  { id: 'plot1', title: 'Signal Line', color: '#FF6B35', lineWidth: 1 },
  { id: 'plot2', title: 'Histogram', color: '#00FF7F', lineWidth: 1, style: 'histogram' },
  { id: 'plot3', title: 'Zero Line Plot', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'SuperSmoother MA Oscillator',
  shortTitle: 'SuperSmoother MA Oscillator',
  overlay: false,
};

/** Pine hsv_to_rgb(h, s, v) of the script: color.rgb(int((r + m) * 255), ...); Pine color.rgb takes an na channel as 0 */
function hsvToRgb(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const ch = [r, g, b].map((k) => {
    const v255 = Math.trunc((k + m) * 255);
    return isNaN(v255) ? 0 : v255;
  });
  return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] };
type Ema = ReturnType<typeof taStep.ema>;

interface SsRun extends BarRunState<Record<string, never>> {
  fast: Ema;
  slow: Ema;
  accel: Ema;
  signalEma: Ema;
  atr20: ReturnType<typeof taStep.atr>;
  atr: ReturnType<typeof taStep.atr>;
  ss: number[];
  osc: number[];
  signal: number[];
  hueRaw: number[];
  oscPlot: Point[];
  signalPlot: Point[];
  histPlot: Point[];
  zeroPlot: Point[];
  oscFill: string[];
  crossFill: string[];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<SuperSmootherMAOscillatorInputs>): BarStudy<SsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.srcMA);
  // supersmoother(src, length): ss := c1 * (src + nz(src[1])) / 2 + c2 * nz(ss[1]) + c3 * nz(ss[2])
  const a1 = Math.exp((-1.414 * 3.14159) / cfg.smoothingLength);
  const c2 = 2.0 * a1 * Math.cos((1.414 * 3.14159) / cfg.smoothingLength);
  const c3 = -a1 * a1;
  const c1 = 1 - c2 - c3;
  const nz = (v: number) => (isNaN(v) ? 0 : v);
  const green = cfg.enhancedColors ? '#00FF7F' : color.green;
  const red = cfg.enhancedColors ? '#FF1493' : color.red;
  const signalColor = cfg.enhancedColors ? '#FF6B35' : color.orange;
  return {
    fullRunReason: () => (isBarSource(cfg.srcMA) ? null : 'source of another study'),
    init() {
      const s: SsRun = {
        fast: taStep.ema(cfg.fastLength), slow: taStep.ema(cfg.slowLength), accel: taStep.ema(3),
        signalEma: taStep.ema(25), atr20: taStep.atr(20), atr: taStep.atr(cfg.atrLength),
        ss: [], osc: [], signal: [], hueRaw: [], oscPlot: [], signalPlot: [], histPlot: [], zeroPlot: [],
        oscFill: [], crossFill: [], markers: [], barColors: [], bgColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.accel, s.signalEma, s.atr20, s.atr];
      s.lists = [s.markers, s.barColors, s.bgColors];
      s.series = [
        s.ss, s.osc, s.signal, s.hueRaw, s.oscPlot, s.signalPlot, s.histPlot, s.zeroPlot, s.oscFill, s.crossFill,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const src = value(b);
      const srcPrev = i > 0 ? value(bars[i - 1]) : NaN;
      const ss = (c1 * (src + nz(srcPrev))) / 2 + c2 * nz(i > 0 ? s.ss[i - 1] : NaN) + c3 * nz(i > 1 ? s.ss[i - 2] : NaN);
      s.ss[i] = ss;

      const fast = s.fast.step(ss);
      const slow = s.slow.step(ss);
      const o = fast - slow;
      s.osc[i] = o;
      const oPrev = i > 0 ? s.osc[i - 1] : NaN;
      const accelRaw = i > 0 ? o - oPrev : NaN;
      const accelSmooth = s.accel.step(accelRaw);
      const atr20 = s.atr20.step(b.high, b.low, b.close);
      // tanh(x) = (e^2x - 1) / (e^2x + 1); hue_raw = 60 + accel_norm * 60
      const ex = Math.exp(2 * (accelSmooth / (atr20 * 0.01)));
      const hueRaw = 60 + ((ex - 1) / (ex + 1)) * 60;
      s.hueRaw[i] = hueRaw;
      // hue = na(hue_raw[1]) ? hue_raw : (hue_raw + hue_raw[1]) / 2
      const hue = i === 0 || isNaN(s.hueRaw[i - 1]) ? hueRaw : (hueRaw + s.hueRaw[i - 1]) / 2;

      const sig = s.signalEma.step(o);
      s.signal[i] = sig;
      const atr = s.atr.step(b.high, b.low, b.close);

      const oscColor = cfg.enhancedColors ? hsvToRgb(hue, 1.0, 1.0) : color.yellow;
      s.oscPlot[i] = { time: t, value: o, color: oscColor };
      s.signalPlot[i] = { time: t, value: sig, color: signalColor };
      s.histPlot[i] = { time: t, value: o - sig, color: String(color.new(o > sig ? green : red, 70)) };
      s.zeroPlot[i] = { time: t, value: 0 };
      s.oscFill[i] = cfg.showVortexFill ? String(color.new(o > 0 ? green : red, cfg.fillTransparency)) : 'transparent';
      s.crossFill[i] = cfg.showVortexFill
        ? String(color.new(o > sig ? color.blue : color.purple, cfg.fillTransparency + 10)) : 'transparent';

      // bullishSignal = ta.crossover(osc, signal) and |osc - signal| > atr * signalSensitivity
      const minThreshold = atr * cfg.signalSensitivity;
      const big = Math.abs(o - sig) > minThreshold;
      const sigPrev = i > 0 ? s.signal[i - 1] : NaN;
      const bull = i > 0 && o > sig && oPrev <= sigPrev && big;
      const bear = i > 0 && o < sig && oPrev >= sigPrev && big;
      const momentum = i > 0 ? o - oPrev : NaN;
      const markers = s.markers;
      if (bull) markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small', forceOverlay: true, id: 'shape0' });
      if (bear) markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small', forceOverlay: true, id: 'shape1' });
      if (bull && momentum > 0) markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'normal', forceOverlay: true, id: 'shape2' });
      if (bear && momentum < 0) markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.maroon, size: 'normal', forceOverlay: true, id: 'shape3' });
      // bgcolor(bullishSignal ? color.new(color.green, 95) : na); bgcolor(bearishSignal ? color.new(color.red, 95) : na)
      if (bull) s.bgColors.push({ time: t, color: String(color.new(color.green, 95)), id: 'bgcolor0' });
      if (bear) s.bgColors.push({ time: t, color: String(color.new(color.red, 95)), id: 'bgcolor1' });
      // candleColor: green above the signal, red below, gray otherwise (also when a value is na)
      if (cfg.enableCandleColor) s.barColors.push({ time: t, color: o > sig ? color.green : o < sig ? color.red : color.gray, id: 'barcolor0' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.oscPlot.slice(),
          plot1: s.signalPlot.slice(),
          plot2: s.histPlot.slice(),
          plot3: s.zeroPlot.slice(),
        },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } }],
        fills: [
          { plot1: 'plot0', plot2: 'plot3', colors: s.oscFill.slice() },
          { plot1: 'plot0', plot2: 'plot1', colors: s.crossFill.slice() },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SuperSmootherMAOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SuperSmootherMAOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SuperSmootherMAOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
