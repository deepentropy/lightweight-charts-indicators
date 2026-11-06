/**
 * PulseWave + Divergence
 *
 * The oscillator is the RSI of the source minus its SMA. Glow plots and a five-layer fill to zero draw the
 * oscillator. Pivot divergences between price and oscillator give Bull / Bear lines and labels (drawn on the pivot
 * bar), and crosses of the overbought / oversold levels or of zero give triangle signals at the pane edges.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Divergence' and 'Bearish Divergence', true on the bar
 * that confirms the divergence (the pivot is pivotLength bars back).
 *
 * Reference: "PulseWave + Divergence" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PulsewaveDivergenceInputs {
  /** RSI length */
  rsiLen: number;
  /** SMA length of the RSI */
  maLen: number;
  /** RSI source */
  rsiSrc: SourceType;
  overbought: number;
  oversold: number;
  calculateDivergence: boolean;
  /** Pivot length (left / right) of the divergence detection */
  pivotLength: number;
  signalType: 'None' | 'Overbought/Oversold' | 'Zero Line' | 'Both';
  oscColorPositive: string;
  oscColorNegative: string;
  zeroLineColor: string;
  overboughtColor: string;
  oversoldColor: string;
  bullDivColor: string;
  bearDivColor: string;
  textColor: string;
  showZeroLineGradient: boolean;
  showOverboughtGradient: boolean;
  showOversoldGradient: boolean;
  showOscillatorGradient: boolean;
  fillEnabled: boolean;
}

export const defaultInputs: PulsewaveDivergenceInputs = {
  rsiLen: 20,
  maLen: 20,
  rsiSrc: 'close',
  overbought: 12.0,
  oversold: -12.0,
  calculateDivergence: true,
  pivotLength: 5,
  signalType: 'Overbought/Oversold',
  oscColorPositive: 'rgb(6, 162, 47)',
  oscColorNegative: 'rgb(207, 23, 23)',
  zeroLineColor: color.gray,
  overboughtColor: color.red,
  oversoldColor: color.green,
  bullDivColor: color.green,
  bearDivColor: color.red,
  textColor: color.white,
  showZeroLineGradient: true,
  showOverboughtGradient: true,
  showOversoldGradient: true,
  showOscillatorGradient: true,
  fillEnabled: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 20 },
  { id: 'maLen', type: 'int', title: 'RSI MA Length', defval: 20 },
  { id: 'rsiSrc', type: 'source', title: 'Source', defval: 'close' },
  { id: 'overbought', type: 'float', title: 'Overbought Level (Oscillator)', defval: 12.0, step: 0.1 },
  { id: 'oversold', type: 'float', title: 'Oversold Level (Oscillator)', defval: -12.0, step: 0.1 },
  { id: 'calculateDivergence', type: 'bool', title: 'Calculate Divergence', defval: true },
  { id: 'pivotLength', type: 'int', title: 'Pivot Length (Left/Right)', defval: 5, min: 1 },
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'Overbought/Oversold', options: ['None', 'Overbought/Oversold', 'Zero Line', 'Both'] },
  { id: 'oscColorPositive', type: 'color', title: 'Oscillator Color (Positive)', defval: 'rgb(6, 162, 47)' },
  { id: 'oscColorNegative', type: 'color', title: 'Oscillator Color (Negative)', defval: 'rgb(207, 23, 23)' },
  { id: 'zeroLineColor', type: 'color', title: 'Zero Line Color', defval: color.gray },
  { id: 'overboughtColor', type: 'color', title: 'Overbought Line Color', defval: color.red },
  { id: 'oversoldColor', type: 'color', title: 'Oversold Line Color', defval: color.green },
  { id: 'bullDivColor', type: 'color', title: 'Bullish Divergence Color', defval: color.green },
  { id: 'bearDivColor', type: 'color', title: 'Bearish Divergence Color', defval: color.red },
  { id: 'textColor', type: 'color', title: 'Label Text Color', defval: color.white },
  { id: 'showZeroLineGradient', type: 'bool', title: 'Show Zero Line Gradient', defval: true },
  { id: 'showOverboughtGradient', type: 'bool', title: 'Show Overbought Gradient', defval: true },
  { id: 'showOversoldGradient', type: 'bool', title: 'Show Oversold Gradient', defval: true },
  { id: 'showOscillatorGradient', type: 'bool', title: 'Show Oscillator Gradient', defval: true },
  { id: 'fillEnabled', type: 'bool', title: 'Enable Gradient Fill', defval: true },
];

const GRADIENT_TRANSPARENCY = 85;
const FILL_TRANSPARENCY = 60;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PulseWave Oscillator', color: 'rgb(6, 162, 47)', lineWidth: 2 },
  { id: 'plot1', title: 'Oscillator Gradient', color: String(color.new('rgb(6, 162, 47)', GRADIENT_TRANSPARENCY)), lineWidth: 10, display: 'pane' },
  { id: 'plot2', title: 'Zero Line', color: color.gray, lineWidth: 1 },
  { id: 'plot3', title: 'Zero Line Gradient', color: String(color.new(color.gray, GRADIENT_TRANSPARENCY)), lineWidth: 10, display: 'pane' },
  { id: 'plot4', title: 'Mid Layer 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Mid Layer 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Mid Layer 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'Mid Layer 4', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Bullish Divergence', color: color.green, lineWidth: 2 },
  { id: 'plot9', title: 'Bearish Divergence', color: color.red, lineWidth: 2 },
  { id: 'plot10', title: 'Overbought Gradient', color: String(color.new(color.red, GRADIENT_TRANSPARENCY)), lineWidth: 10, display: 'pane' },
  { id: 'plot11', title: 'Oversold Gradient', color: String(color.new(color.green, GRADIENT_TRANSPARENCY)), lineWidth: 10, display: 'pane' },
];

export const metadata = {
  title: 'PulseWave + Divergence',
  shortTitle: 'PulseWave + Divergence',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface PulseVars {
  /** ta.valuewhen(found, x, 1): the last two values of x on the found bars (older first) */
  plOsc: readonly number[];
  plLow: readonly number[];
  phOsc: readonly number[];
  phHigh: readonly number[];
  /** Calls of the ta.barssince in _inRange (Pine v6 `and` is lazy) */
  plCalls: number;
  phCalls: number;
  /** var bool plFound = false / var bool phFound = false */
  plFound: boolean;
  phFound: boolean;
}

interface PulseRun extends BarRunState<PulseVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  rsiMa: ReturnType<typeof taStep.sma>;
  ph: PivotStep;
  pl: PivotStep;
  osc: number[];
  plots: Point[][];
  /** plot8 / plot9: the point of bar i is in slot i - pivotLength */
  divPlots: Point[][];
  layers: string[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

/** ta.valuewhen history: the value added on a found bar */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (na before two values) */
const second = (h: readonly number[]): number => (h.length === 2 ? h[0]! : NaN);

function study(inputs: Partial<PulsewaveDivergenceInputs>): BarStudy<PulseRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.rsiSrc);
  const rangeUpper = 60;
  const rangeLower = 5;
  const lb = cfg.pivotLength;
  const zeroGrad = String(color.new(cfg.zeroLineColor, GRADIENT_TRANSPARENCY));
  const obGrad = String(color.new(cfg.overboughtColor, GRADIENT_TRANSPARENCY));
  const osGrad = String(color.new(cfg.oversoldColor, GRADIENT_TRANSPARENCY));
  const noDiv = String(color.new(color.white, 100));
  const posGrad = String(color.new(cfg.oscColorPositive, GRADIENT_TRANSPARENCY));
  const negGrad = String(color.new(cfg.oscColorNegative, GRADIENT_TRANSPARENCY));
  // fill(pOsc, pMid1, fillEnabled ? color.new(oscColor, fillTransparency) : na) ... + 5, + 5, + 10, + 15
  const LAYER_STEPS = [0, 5, 5, 10, 15];
  const layerPos = LAYER_STEPS.map((k) => (cfg.fillEnabled ? String(color.new(cfg.oscColorPositive, FILL_TRANSPARENCY + k)) : 'transparent'));
  const layerNeg = LAYER_STEPS.map((k) => (cfg.fillEnabled ? String(color.new(cfg.oscColorNegative, FILL_TRANSPARENCY + k)) : 'transparent'));
  const showObos = cfg.signalType === 'Overbought/Oversold' || cfg.signalType === 'Both';
  const showZero = cfg.signalType === 'Zero Line' || cfg.signalType === 'Both';
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSrc) ? null : 'source of another study'),
    init() {
      const s: PulseRun = {
        rsi: taStep.rsi(cfg.rsiLen), rsiMa: taStep.sma(), ph: new PivotStep(lb, lb, true), pl: new PivotStep(lb, lb, false),
        osc: [], plots: Array.from({ length: 10 }, () => []), divPlots: [[], []], layers: LAYER_STEPS.map(() => []),
        flags: [[], []], times: [[], []], markers: [],
        steps: [],
        vars: { plOsc: [], plLow: [], phOsc: [], phHigh: [], plCalls: NaN, phCalls: NaN, plFound: false, phFound: false },
        lists: [], series: [],
      };
      s.steps = [s.rsi, s.rsiMa, ...(cfg.calculateDivergence ? [s.ph, s.pl] : [])];
      s.lists = [s.markers, ...s.times];
      s.series = [s.osc, ...s.plots, ...s.divPlots, ...s.layers, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // osc = rsi - sma(rsi, maLen)
      const rsi = s.rsi.step(value(b));
      const osc = rsi - s.rsiMa.step(rsi, cfg.maLen);
      s.osc[i] = osc;

      // Divergence detection
      const o = i - lb >= 0 ? s.osc[i - lb] : NaN;
      let bullCond = false;
      let bearCond = false;
      let plFound = false;
      let phFound = false;
      if (cfg.calculateDivergence) {
        const v = s.vars;
        const lowLbr = i - lb >= 0 ? bars[i - lb].low : NaN;
        const highLbr = i - lb >= 0 ? bars[i - lb].high : NaN;
        const pivotHighOsc = s.ph.step(i, osc);
        const pivotLowOsc = s.pl.step(i, osc);

        // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
        // Pine v6 `and` is lazy: the ta.barssince inside _inRange(...) only runs on the bars where the left side
        // (oscLbr > ta.valuewhen(...)) is true, so it counts those calls. One state per call site.
        const prevPlFound = v.plFound; // plFound[1]
        v.plFound = !isNaN(pivotLowOsc);
        if (v.plFound) {
          v.plOsc = pushed(v.plOsc, o);
          v.plLow = pushed(v.plLow, lowLbr);
        }
        let oscHl = false;
        if (gt(o, second(v.plOsc))) {
          if (prevPlFound) v.plCalls = 0;
          else if (!isNaN(v.plCalls)) v.plCalls++;
          oscHl = rangeLower <= v.plCalls && v.plCalls <= rangeUpper;
        }
        const priceLl = lt(lowLbr, second(v.plLow));
        bullCond = priceLl && oscHl && v.plFound;
        plFound = v.plFound;

        const prevPhFound = v.phFound; // phFound[1]
        v.phFound = !isNaN(pivotHighOsc);
        if (v.phFound) {
          v.phOsc = pushed(v.phOsc, o);
          v.phHigh = pushed(v.phHigh, highLbr);
        }
        let oscLh = false;
        if (lt(o, second(v.phOsc))) {
          if (prevPhFound) v.phCalls = 0;
          else if (!isNaN(v.phCalls)) v.phCalls++;
          oscLh = rangeLower <= v.phCalls && v.phCalls <= rangeUpper;
        }
        const priceHh = gt(highLbr, second(v.phHigh));
        bearCond = priceHh && oscLh && v.phFound;
        phFound = v.phFound;
      }
      s.flags[0][i] = bullCond;
      s.flags[1][i] = bearCond;
      if (bullCond) s.times[0].push(time as number);
      if (bearCond) s.times[1].push(time as number);

      // Colours: oscColor = osc >= 0 ? oscColorPositive : oscColorNegative (na: negative)
      const pos = ge(osc, 0);
      const p = s.plots;
      p[0][i] = { time, value: osc, color: pos ? cfg.oscColorPositive : cfg.oscColorNegative };
      // plot(showOscillatorGradient ? osc : na, color.new(oscColor, 85), linewidth = 10, display = display.pane)
      p[1][i] = { time, value: cfg.showOscillatorGradient ? osc : NaN, color: pos ? posGrad : negGrad };
      p[2][i] = { time, value: 0, color: cfg.zeroLineColor };
      p[3][i] = { time, value: cfg.showZeroLineGradient ? 0 : NaN, color: zeroGrad };
      p[4][i] = { time, value: osc * 0.8 };
      p[5][i] = { time, value: osc * 0.6 };
      p[6][i] = { time, value: osc * 0.4 };
      p[7][i] = { time, value: osc * 0.2 };
      p[8][i] = { time, value: cfg.showOverboughtGradient ? cfg.overbought : NaN, color: obGrad };
      p[9][i] = { time, value: cfg.showOversoldGradient ? cfg.oversold : NaN, color: osGrad };
      // plot(calculateDivergence and plFound ? oscLbr : na, offset = -lookbackRight,
      //      color = bullCond ? bullDivColor : color.new(color.white, 100)): the value of bar i is drawn on bar i - lb
      // (bar i is the only writer of slot i - lb)
      if (i - lb >= 0) {
        const at = barTime(bars, i - lb);
        s.divPlots[0][i - lb] = { time: at, value: cfg.calculateDivergence && plFound ? o : NaN, color: bullCond ? cfg.bullDivColor : noDiv };
        s.divPlots[1][i - lb] = { time: at, value: cfg.calculateDivergence && phFound ? o : NaN, color: bearCond ? cfg.bearDivColor : noDiv };
      }
      for (let k = 0; k < LAYER_STEPS.length; k++) s.layers[k][i] = pos ? layerPos[k] : layerNeg[k];

      const markers = s.markers;
      // plotshape(bullCond ? oscLbr : na, offset = -lookbackRight, text = ' Bull ', shape.labelup, location.absolute,
      //   color = bullDivColor, textcolor = textColor, display = calculateDivergence ? display.pane : display.none)
      if (cfg.calculateDivergence && i - lb >= 0) {
        if (bullCond && !isNaN(o)) {
          markers.push({ time: barTime(bars, i - lb), position: 'atPriceBottom', price: o, shape: 'labelUp',
            color: cfg.bullDivColor, text: ' Bull ', textColor: cfg.textColor, id: 'shape0' });
        }
        if (bearCond && !isNaN(o)) {
          markers.push({ time: barTime(bars, i - lb), position: 'atPriceTop', price: o, shape: 'labelDown',
            color: cfg.bearDivColor, text: ' Bear ', textColor: cfg.textColor, id: 'shape1' });
        }
      }
      // Signal triangles: plotshape(cond ? osc : na, location.bottom (buy) / location.top (sell), size.tiny)
      // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1]
      // (exact comparisons, no 1e-10 tolerance; na gives false)
      if (!isNaN(osc) && i > 0) {
        const prev = s.osc[i - 1];
        if (showObos && osc > cfg.oversold && prev <= cfg.oversold) {
          markers.push({ time, position: 'bottom', shape: 'triangleUp', color: cfg.oversoldColor, size: 'tiny', id: 'shape2' });
        }
        if (showObos && osc < cfg.overbought && prev >= cfg.overbought) {
          markers.push({ time, position: 'top', shape: 'triangleDown', color: cfg.overboughtColor, size: 'tiny', id: 'shape3' });
        }
        if (showZero && osc > 0 && prev <= 0) {
          markers.push({ time, position: 'bottom', shape: 'triangleUp', color: cfg.oversoldColor, size: 'tiny', id: 'shape4' });
        }
        if (showZero && osc < 0 && prev >= 0) {
          markers.push({ time, position: 'top', shape: 'triangleDown', color: cfg.overboughtColor, size: 'tiny', id: 'shape5' });
        }
      }
    },
    copyVars: (v) => ({ ...v }),
    result(s, bars) {
      const n = bars.length;
      const divCount = Math.max(0, n - lb);
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < 8; k++) plots[`plot${k}`] = s.plots[k].slice();
      plots.plot8 = s.divPlots[0].slice(0, divCount);
      plots.plot9 = s.divPlots[1].slice(0, divCount);
      plots.plot10 = s.plots[8].slice();
      plots.plot11 = s.plots[9].slice();
      const titles = ['Fill Layer 1', 'Fill Layer 2', 'Fill Layer 3', 'Fill Layer 4', 'Fill Layer 5'];
      const pairs = [['plot0', 'plot4'], ['plot4', 'plot5'], ['plot5', 'plot6'], ['plot6', 'plot7'], ['plot7', 'plot2']];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: cfg.overbought, options: { title: 'Overbought', color: cfg.overboughtColor, linestyle: 'dashed' } },
          { value: cfg.oversold, options: { title: 'Oversold', color: cfg.oversoldColor, linestyle: 'dashed' } },
        ],
        fills: pairs.map(([plot1, plot2], k) => ({ plot1, plot2, options: { title: titles[k] }, colors: s.layers[k].slice() })),
        markers: s.markers.slice(),
        // alertcondition(bullCond, "Bullish Divergence") / alertcondition(bearCond, "Bearish Divergence")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PulsewaveDivergenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PulsewaveDivergenceInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Divergence', message: 'New bullish divergence detected, Pivot Lookback Right bars to the left of current bar.' },
  { id: 'alert1', title: 'Bearish Divergence', message: 'New bearish divergence detected, Pivot Lookback Right bars to the left of current bar.' },
];

export const PulsewaveDivergence = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
