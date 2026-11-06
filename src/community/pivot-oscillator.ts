/**
 * Pivot Oscillator
 *
 * The pivot line is a level between the average of the last pivot highs and the average of the last pivot lows
 * (pivot level 0 = lows, 1 = highs). The oscillator is 50 + 50 * (close - pivot line) / (ATR * multiplier),
 * clamped to 1..100, with glow plots and a four-layer fill towards 50. Its SMA is smoothed again by a second SMA,
 * coloured by its slope; crosses of the overbought / oversold levels give triangle signals.
 * Alerts (alertcondition, `alerts` of the result): 'Buy (Oversold)' / 'Sell (Overbought)', true on the bars of the
 * triangle signals.
 *
 * Reference: "Pivot Oscillator" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PivotOscillatorInputs {
  /** Pivot left / right bars */
  lenSwing: number;
  /** Position of the pivot line between the pivot low average (0) and the pivot high average (1) */
  pivotLevel: number;
  /** Number of last pivots averaged */
  lookback: number;
  atrLen: number;
  multUp: number;
  multDown: number;
  obLevel: number;
  osLevel: number;
  maOverbought: number;
  maOversold: number;
  /** SMA length of the signal */
  signalLength: number;
  /** Length of the second SMA (smoothed signal) */
  extraSmooth: number;
  bullColor: string;
  bearColor: string;
  signalColorBull: string;
  signalColorBear: string;
  obColor: string;
  osColor: string;
  midLineColor: string;
  /** Pine input, not used by the Pine drawing */
  textColor: string;
  showOverboughtGradient: boolean;
  showOversoldGradient: boolean;
  showOscillatorGradient: boolean;
  showMaGradient: boolean;
  fillEnabled: boolean;
  fillTransparency: number;
  bandTransparency: number;
}

export const defaultInputs: PivotOscillatorInputs = {
  lenSwing: 5,
  pivotLevel: 0.5,
  lookback: 5,
  atrLen: 14,
  multUp: 15.0,
  multDown: 15.0,
  obLevel: 70,
  osLevel: 30,
  maOverbought: 60,
  maOversold: 40,
  signalLength: 14,
  extraSmooth: 10,
  bullColor: 'rgb(22, 193, 67)',
  bearColor: 'rgb(229, 11, 11)',
  signalColorBull: 'rgb(22, 193, 67)',
  signalColorBear: 'rgb(229, 11, 11)',
  obColor: color.red,
  osColor: color.green,
  midLineColor: color.gray,
  textColor: color.white,
  showOverboughtGradient: true,
  showOversoldGradient: true,
  showOscillatorGradient: true,
  showMaGradient: true,
  fillEnabled: true,
  fillTransparency: 75,
  bandTransparency: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenSwing', type: 'int', title: 'Pivot Length', defval: 5, min: 1 },
  { id: 'pivotLevel', type: 'float', title: 'Pivot Level', defval: 0.5, min: 0.0, max: 1.0, step: 0.01 },
  { id: 'lookback', type: 'int', title: 'Pivot Lookback', defval: 5, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'multUp', type: 'float', title: 'ATR Multiplier Up', defval: 15.0, min: 0.1 },
  { id: 'multDown', type: 'float', title: 'ATR Multiplier Down', defval: 15.0, min: 0.1 },
  { id: 'obLevel', type: 'float', title: 'Overbought Level', defval: 70, min: 51, max: 99 },
  { id: 'osLevel', type: 'float', title: 'Oversold Level', defval: 30, min: 1, max: 49 },
  { id: 'maOverbought', type: 'float', title: 'MA Overbought Threshold', defval: 60, min: 51, max: 99 },
  { id: 'maOversold', type: 'float', title: 'MA Oversold Threshold', defval: 40, min: 1, max: 49 },
  { id: 'signalLength', type: 'int', title: 'SMA Length for Signal', defval: 14 },
  { id: 'extraSmooth', type: 'int', title: 'SMA Smoothing', defval: 10, min: 1 },
  { id: 'bullColor', type: 'color', title: 'Bullish Color', defval: 'rgb(22, 193, 67)' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color', defval: 'rgb(229, 11, 11)' },
  { id: 'signalColorBull', type: 'color', title: 'Signal SMA Bullish', defval: 'rgb(22, 193, 67)' },
  { id: 'signalColorBear', type: 'color', title: 'Signal SMA Bearish', defval: 'rgb(229, 11, 11)' },
  { id: 'obColor', type: 'color', title: 'Overbought Line Color', defval: color.red },
  { id: 'osColor', type: 'color', title: 'Oversold Line Color', defval: color.green },
  { id: 'midLineColor', type: 'color', title: 'Midline 50 Color', defval: color.gray },
  { id: 'textColor', type: 'color', title: 'Text Color', defval: color.white },
  { id: 'showOverboughtGradient', type: 'bool', title: 'Show Overbought Gradient', defval: true },
  { id: 'showOversoldGradient', type: 'bool', title: 'Show Oversold Gradient', defval: true },
  { id: 'showOscillatorGradient', type: 'bool', title: 'Show Oscillator Gradient', defval: true },
  { id: 'showMaGradient', type: 'bool', title: 'Show Moving Average Gradient', defval: true },
  { id: 'fillEnabled', type: 'bool', title: 'Enable Gradient Fill', defval: true },
  { id: 'fillTransparency', type: 'int', title: 'Gradient Fill Transparency', defval: 75, min: 0, max: 100 },
  { id: 'bandTransparency', type: 'int', title: 'Band/Label Gradient Transparency', defval: 50, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OB Gradient', color: color.gray, lineWidth: 8 },
  { id: 'plot1', title: 'OS Gradient', color: color.gray, lineWidth: 8 },
  { id: 'plot2', title: 'Oscillator 1–100', color: 'rgb(22, 193, 67)', lineWidth: 2 },
  { id: 'plot3', title: 'Osc Gradient', color: 'rgb(22, 193, 67)', lineWidth: 10 },
  { id: 'plot4', title: 'Signal SMA', color: color.gray, lineWidth: 2 },
  { id: 'plot5', title: 'Signal SMA Glow 1', color: color.gray, lineWidth: 5 },
  { id: 'plot6', title: 'Signal SMA Glow 2', color: color.gray, lineWidth: 3 },
  { id: 'plot7', title: 'Signal SMA Glow 3', color: color.gray, lineWidth: 1 },
  { id: 'plot8', title: 'Mid 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot9', title: 'Mid 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot10', title: 'Mid 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot11', title: 'Mid 4', color: 'transparent', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Pivot Oscillator',
  shortTitle: 'Pivot Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface PivotOscVars {
  /** The last pivot highs / lows (changed in place, copied by copyVars) */
  phArray: number[];
  plArray: number[];
}

interface PivotOscRun extends BarRunState<PivotOscVars> {
  ph: PivotStep;
  pl: PivotStep;
  atr: ReturnType<typeof taStep.atr>;
  sig: ReturnType<typeof taStep.sma>;
  smooth: ReturnType<typeof taStep.sma>;
  oscArr: number[];
  smoothArr: number[];
  plots: Point[][];
  layers: string[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PivotOscillatorInputs>): BarStudy<PivotOscRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const gradientTransparency = 85;
  const avg = (a: number[]) => {
    let s = 0;
    for (const v of a) s += v;
    return s / a.length;
  };
  return {
    init() {
      // ph = ta.pivothigh(high, lenSwing, lenSwing); pl = ta.pivotlow(low, lenSwing, lenSwing)
      const ph = new PivotStep(cfg.lenSwing, cfg.lenSwing, true);
      const pl = new PivotStep(cfg.lenSwing, cfg.lenSwing, false);
      const atr = taStep.atr(cfg.atrLen);
      const sig = taStep.sma();
      const smooth = taStep.sma();
      const s: PivotOscRun = {
        ph, pl, atr, sig, smooth, oscArr: [], smoothArr: [],
        plots: Array.from({ length: 12 }, () => []), layers: [[], [], [], []], markers: [], flags: [[], []], times: [[], []],
        steps: [ph, pl, atr, sig, smooth], vars: { phArray: [], plArray: [] }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.oscArr, s.smoothArr, ...s.plots, ...s.layers, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const { phArray, plArray } = s.vars;
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);
      const atr = s.atr.step(b.high, b.low, b.close);
      if (!isNaN(ph)) {
        phArray.push(ph);
        if (phArray.length > cfg.lookback) phArray.shift();
      }
      if (!isNaN(pl)) {
        plArray.push(pl);
        if (plArray.length > cfg.lookback) plArray.shift();
      }
      const avgPH = phArray.length > 0 ? avg(phArray) : NaN;
      const avgPL = plArray.length > 0 ? avg(plArray) : NaN;
      const pivotLine = !isNaN(avgPH) && !isNaN(avgPL) ? avgPL + (avgPH - avgPL) * cfg.pivotLevel : NaN;
      // osc_raw = close - nz(pivotLine)
      const raw = b.close - (isNaN(pivotLine) ? 0 : pivotLine);
      // atr_safe = atr > 0 ? atr : 1 (na > 0 is false)
      const atrSafe = gt(atr, 0) ? atr : 1;
      const upperBound = atrSafe * cfg.multUp;
      const lowerBound = atrSafe * cfg.multDown;
      let scaled: number;
      if (gt(raw, 0)) scaled = 50.0 + 50.0 * (raw / upperBound);
      else if (lt(raw, 0)) scaled = 50.0 + 50.0 * (raw / lowerBound);
      else scaled = 50.0;
      const osc = Math.max(1.0, Math.min(100.0, scaled));
      s.oscArr[i] = osc;
      const oscSignal = s.sig.step(osc, cfg.signalLength);
      const smoothSignal = s.smooth.step(oscSignal, cfg.extraSmooth);
      s.smoothArr[i] = smoothSignal;

      const lineColor = gt(raw, 0) ? cfg.bullColor : cfg.bearColor;
      // dynSignalColor = smoothSignal > smoothSignal[1] ? bull : smoothSignal < smoothSignal[1] ? bear : color.gray
      const prev = i > 0 ? s.smoothArr[i - 1] : NaN;
      const dynColor = gt(smoothSignal, prev) ? cfg.signalColorBull : lt(smoothSignal, prev) ? cfg.signalColorBear : color.gray;
      const p = s.plots;
      // plot(showOverboughtGradient ? obLevel : na, color.new(oscSignal >= maOverbought ? obColor : color.gray, bandTransparency), 8)
      p[0][i] = {
        time, value: cfg.showOverboughtGradient ? cfg.obLevel : NaN,
        color: String(color.new(ge(oscSignal, cfg.maOverbought) ? cfg.obColor : color.gray, cfg.bandTransparency)),
      };
      // plot(showOversoldGradient ? osLevel : na, color.new(oscSignal <= maOversold ? osColor : color.gray, bandTransparency), 8)
      p[1][i] = {
        time, value: cfg.showOversoldGradient ? cfg.osLevel : NaN,
        color: String(color.new(le(oscSignal, cfg.maOversold) ? cfg.osColor : color.gray, cfg.bandTransparency)),
      };
      p[2][i] = { time, value: osc, color: lineColor };
      p[3][i] = { time, value: cfg.showOscillatorGradient ? osc : NaN, color: String(color.new(lineColor, gradientTransparency)) };
      // plot(showMaGradient ? smoothSignal : smoothSignal, "Signal SMA", dynSignalColor, 2)
      p[4][i] = { time, value: smoothSignal, color: dynColor };
      // plot(showMaGradient ? smoothSignal : na, "", color.new(dynSignalColor, 60 / 35 / 0), 5 / 3 / 1)
      p[5][i] = { time, value: cfg.showMaGradient ? smoothSignal : NaN, color: String(color.new(dynColor, 60)) };
      p[6][i] = { time, value: cfg.showMaGradient ? smoothSignal : NaN, color: String(color.new(dynColor, 35)) };
      p[7][i] = { time, value: cfg.showMaGradient ? smoothSignal : NaN, color: String(color.new(dynColor, 0)) };
      // pMid1..4 = plot(osc_scaled * (1 - k) + 50 * k, display = display.none), k = 0.2, 0.4, 0.6, 0.8
      p[8][i] = { time, value: osc * 0.8 + 50 * 0.2 };
      p[9][i] = { time, value: osc * 0.6 + 50 * 0.4 };
      p[10][i] = { time, value: osc * 0.4 + 50 * 0.6 };
      p[11][i] = { time, value: osc * 0.2 + 50 * 0.8 };

      // fill(pOsc, pMid1, fillEnabled ? color.new(lineColor, fillTransparency) : na) ... + 5, + 10, + 15
      for (let k = 0; k < 4; k++) {
        s.layers[k][i] = cfg.fillEnabled ? String(color.new(lineColor, cfg.fillTransparency + k * 5)) : 'transparent';
      }

      // longSignalObos = ta.crossover(osc_scaled, osLevel); shortSignalObos = ta.crossunder(osc_scaled, obLevel)
      // (exact comparisons: crossover / crossunder have no 1e-10 tolerance)
      // plotshape(..., location.bottom / location.top, osColor / obColor, triangleup / triangledown, size.tiny).
      let long = false;
      let short = false;
      if (i >= 1) {
        const prevOsc = s.oscArr[i - 1];
        long = osc > cfg.osLevel && prevOsc <= cfg.osLevel;
        short = osc < cfg.obLevel && prevOsc >= cfg.obLevel;
        if (long) s.markers.push({ time, position: 'bottom', shape: 'triangleUp', color: cfg.osColor, size: 'tiny' });
        if (short) s.markers.push({ time, position: 'top', shape: 'triangleDown', color: cfg.obColor, size: 'tiny' });
      }
      s.flags[0][i] = long;
      s.flags[1][i] = short;
      if (long) s.times[0].push(time as number);
      if (short) s.times[1].push(time as number);
    },
    copyVars: (v) => ({ phArray: v.phArray.slice(), plArray: v.plArray.slice() }),
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      const minMax = String(color.new(color.gray, 80));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: cfg.obLevel, options: { title: 'Overbought', color: cfg.obColor, linestyle: 'dashed', linewidth: 1 } },
          { value: cfg.osLevel, options: { title: 'Oversold', color: cfg.osColor, linestyle: 'dashed', linewidth: 1 } },
          { value: 50, options: { title: 'Midline 50', color: cfg.midLineColor, linestyle: 'dashed', linewidth: 1 } },
          { value: 1, options: { title: 'Min', color: minMax, linestyle: 'dotted' } },
          { value: 100, options: { title: 'Max', color: minMax, linestyle: 'dotted' } },
        ],
        fills: [
          { plot1: 'plot2', plot2: 'plot8', colors: s.layers[0].slice() },
          { plot1: 'plot8', plot2: 'plot9', colors: s.layers[1].slice() },
          { plot1: 'plot9', plot2: 'plot10', colors: s.layers[2].slice() },
          { plot1: 'plot10', plot2: 'plot11', colors: s.layers[3].slice() },
        ],
        markers: s.markers.slice(),
        // alertcondition(longSignalObos, 'Buy (Oversold)') / alertcondition(shortSignalObos, 'Sell (Overbought)')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PivotOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PivotOscillatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy (Oversold)', message: 'Oscillator crossed above oversold.' },
  { id: 'alert1', title: 'Sell (Overbought)', message: 'Oscillator crossed below overbought.' },
];

export const PivotOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
