/**
 * Volatility Channel Oscillator
 *
 * A channel around the SMA of the candle midpoint, with a half width of the average range * scale, widened by the
 * ratio of the average body to the average range. The oscillator is the close position in the channel
 * (-50 at the lower band, +50 at the upper band, clamped to -100..100), with an SMA signal line. Glow plots and a
 * five-layer fill to zero draw the oscillator; pivot divergences between price and oscillator give Bull / Bear
 * labels, and crosses of the thresholds, of zero and of the signal with zero give triangle signals.
 * Alerts (alertcondition, `alerts` of the result): the two divergences and the six crosses (whatever the Signal Type).
 *
 * Reference: "Volatility Channel Oscillator" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolatilityChannelOscillatorInputs {
  /** SMA length / volatility window */
  length: number;
  /** Band scaling (%) */
  scale: number;
  /** SMA length of the signal line */
  signalLength: number;
  overbought: number;
  oversold: number;
  maOverbought: number;
  maOversold: number;
  /** Pivot length (left / right) of the divergence detection */
  pivotLength: number;
  calculateDivergence: boolean;
  signalType: 'None' | 'Overbought/Oversold' | 'Zero Line' | 'MA Zero Line' | 'All';
  oscColorPositive: string;
  oscColorNegative: string;
  signalColor: string;
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
  showMaGradient: boolean;
  fillEnabled: boolean;
  fillTransparency: number;
  bandTransparency: number;
}

export const defaultInputs: VolatilityChannelOscillatorInputs = {
  length: 30,
  scale: 200.0,
  signalLength: 20,
  overbought: 50.0,
  oversold: -50.0,
  maOverbought: 30.0,
  maOversold: -30.0,
  pivotLength: 2,
  calculateDivergence: true,
  signalType: 'Overbought/Oversold',
  oscColorPositive: 'rgb(6, 162, 47)',
  oscColorNegative: 'rgb(207, 23, 23)',
  signalColor: color.yellow,
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
  showMaGradient: true,
  fillEnabled: true,
  fillTransparency: 70,
  bandTransparency: 40,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'SMA Length / Volatility Window', defval: 30 },
  { id: 'scale', type: 'float', title: 'Band Scaling (%)', defval: 200.0, min: 100.0 },
  { id: 'signalLength', type: 'int', title: 'SMA Length for Signal', defval: 20 },
  { id: 'overbought', type: 'float', title: 'Overbought Threshold', defval: 50.0, step: 0.1 },
  { id: 'oversold', type: 'float', title: 'Oversold Threshold', defval: -50.0, step: 0.1 },
  { id: 'maOverbought', type: 'float', title: 'MA Overbought Threshold', defval: 30.0, step: 0.1 },
  { id: 'maOversold', type: 'float', title: 'MA Oversold Threshold', defval: -30.0, step: 0.1 },
  { id: 'pivotLength', type: 'int', title: 'Pivot Length (Left/Right)', defval: 2, min: 1 },
  { id: 'calculateDivergence', type: 'bool', title: 'Enable Divergence Detection', defval: true },
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'Overbought/Oversold', options: ['None', 'Overbought/Oversold', 'Zero Line', 'MA Zero Line', 'All'] },
  { id: 'oscColorPositive', type: 'color', title: 'Bullish Oscillator Color', defval: 'rgb(6, 162, 47)' },
  { id: 'oscColorNegative', type: 'color', title: 'Bearish Oscillator Color', defval: 'rgb(207, 23, 23)' },
  { id: 'signalColor', type: 'color', title: 'Signal SMA Color', defval: color.yellow },
  { id: 'zeroLineColor', type: 'color', title: 'Zero Line Color', defval: color.gray },
  { id: 'overboughtColor', type: 'color', title: 'Overbought Line Color', defval: color.red },
  { id: 'oversoldColor', type: 'color', title: 'Oversold Line Color', defval: color.green },
  { id: 'bullDivColor', type: 'color', title: 'Bullish Divergence Color', defval: color.green },
  { id: 'bearDivColor', type: 'color', title: 'Bearish Divergence Color', defval: color.red },
  { id: 'textColor', type: 'color', title: 'Text Color', defval: color.white },
  { id: 'showZeroLineGradient', type: 'bool', title: 'Show Zero Line Gradient', defval: true },
  { id: 'showOverboughtGradient', type: 'bool', title: 'Show Overbought Gradient', defval: true },
  { id: 'showOversoldGradient', type: 'bool', title: 'Show Oversold Gradient', defval: true },
  { id: 'showOscillatorGradient', type: 'bool', title: 'Show Oscillator Gradient', defval: true },
  { id: 'showMaGradient', type: 'bool', title: 'Show Moving Average Gradient', defval: true },
  { id: 'fillEnabled', type: 'bool', title: 'Enable Gradient Fill', defval: true },
  { id: 'fillTransparency', type: 'int', title: 'Gradient Fill Transparency', defval: 70, min: 0, max: 100 },
  { id: 'bandTransparency', type: 'int', title: 'Band and Label Gradient Transparency', defval: 40, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line Gradient', color: color.gray, lineWidth: 10 },
  { id: 'plot1', title: 'Overbought Gradient', color: color.gray, lineWidth: 10 },
  { id: 'plot2', title: 'Oversold Gradient', color: color.gray, lineWidth: 10 },
  { id: 'plot3', title: 'Oscillator', color: 'rgb(6, 162, 47)', lineWidth: 2 },
  { id: 'plot4', title: 'Oscillator Gradient', color: 'rgb(6, 162, 47)', lineWidth: 10 },
  { id: 'plot5', title: 'Signal SMA', color: color.yellow, lineWidth: 2 },
  { id: 'plot6', title: 'Moving Average Gradient', color: color.yellow, lineWidth: 6 },
  { id: 'plot7', title: 'Mid Layer 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Mid Layer 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot9', title: 'Mid Layer 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot10', title: 'Mid Layer 4', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot11', title: 'Zero Line for Fill', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot12', title: 'Bullish Divergence', color: color.green, lineWidth: 2 },
  { id: 'plot13', title: 'Bearish Divergence', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'Volatility Channel Oscillator',
  shortTitle: 'VCO',
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

interface VcoVars {
  /** ta.valuewhen(found, x, 1) histories: the last two values (older first) */
  plOsc: readonly number[];
  plLow: readonly number[];
  phOsc: readonly number[];
  phHigh: readonly number[];
  /** Calls of the ta.barssince in _inRange (Pine v6 `and` is lazy) */
  plCalls: number;
  phCalls: number;
  /** var bool plFound / phFound */
  plFoundVar: boolean;
  phFoundVar: boolean;
}

interface VcoRun extends BarRunState<VcoVars> {
  midSma: ReturnType<typeof taStep.sma>;
  avgRange: ReturnType<typeof taStep.sma>;
  avgBody: ReturnType<typeof taStep.sma>;
  signalSma: ReturnType<typeof taStep.sma>;
  ph: PivotStep;
  pl: PivotStep;
  osc: number[];
  oscSignal: number[];
  plots: Point[][];
  /** plot12 / plot13: the point of bar i - lb written by bar i (index i; none before bar lb) */
  divBull: Point[];
  divBear: Point[];
  layers: string[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** ta.valuewhen(cond, source, 1) history: the value added on a bar where the condition is true */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1], v]);
/** occurrence 1 of the history (na before two values) */
const second = (h: readonly number[]): number => (h.length === 2 ? h[0] : NaN);

function study(inputs: Partial<VolatilityChannelOscillatorInputs>): BarStudy<VcoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const rangeUpper = 60;
  const rangeLower = 5;
  const gradientTransparency = 85;
  const lb = cfg.pivotLength;
  const zeroGrad = String(color.new(cfg.zeroLineColor, gradientTransparency));
  const signalGrad = String(color.new(cfg.signalColor, gradientTransparency));
  const noDiv = String(color.new(color.white, 100));
  const bullLabel = String(color.new(cfg.bullDivColor, cfg.bandTransparency));
  const bearLabel = String(color.new(cfg.bearDivColor, cfg.bandTransparency));
  const showObos = cfg.signalType === 'Overbought/Oversold' || cfg.signalType === 'All';
  const showZero = cfg.signalType === 'Zero Line' || cfg.signalType === 'All';
  const showMaZero = cfg.signalType === 'MA Zero Line' || cfg.signalType === 'All';
  const LAYER_STEPS = [0, 5, 10, 15, 20];
  return {
    init() {
      const s: VcoRun = {
        midSma: taStep.sma(), avgRange: taStep.sma(), avgBody: taStep.sma(), signalSma: taStep.sma(),
        ph: new PivotStep(lb, lb, true), pl: new PivotStep(lb, lb, false), osc: [], oscSignal: [],
        plots: Array.from({ length: 12 }, () => []), divBull: [], divBear: [], layers: LAYER_STEPS.map(() => []),
        markers: [], flags: Array.from({ length: 8 }, () => []), times: Array.from({ length: 8 }, () => []),
        steps: [],
        vars: { plOsc: [], plLow: [], phOsc: [], phHigh: [], plCalls: NaN, phCalls: NaN, plFoundVar: false, phFoundVar: false },
        lists: [], series: [],
      };
      s.steps = [s.midSma, s.avgRange, s.avgBody, s.signalSma, ...(cfg.calculateDivergence ? [s.ph, s.pl] : [])];
      s.lists = [s.markers, ...s.times];
      s.series = [s.osc, s.oscSignal, ...s.plots, s.divBull, s.divBear, ...s.layers, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;

      // Channel
      const midSma = s.midSma.step((b.high + b.low) / 2, cfg.length);
      const avgRange = s.avgRange.step(b.high - b.low, cfg.length);
      const avgBody = s.avgBody.step(Math.abs(b.close - b.open), cfg.length);
      // offset = avgRange * scale / 100 * (1 + avgBody / math.max(avgRange, 1e-10))
      const off = ((avgRange * cfg.scale) / 100) * (1 + avgBody / Math.max(avgRange, 1e-10));
      const upperBand = midSma + off;
      const lowerBand = midSma - off;
      const bandWidth = Math.max(upperBand - lowerBand, 1e-10);
      const rawBaseOsc = (100 * (b.close - lowerBand)) / bandWidth - 50;
      const osc = Math.max(Math.min(rawBaseOsc, 100), -100);
      s.osc[i] = osc;
      const oscSignal = s.signalSma.step(osc, cfg.signalLength);
      s.oscSignal[i] = oscSignal;

      // Divergence detection
      const o = i - lb >= 0 ? s.osc[i - lb] : NaN;
      let bullCond = false;
      let bearCond = false;
      let plFound = false;
      let phFound = false;
      if (cfg.calculateDivergence) {
        const v = s.vars;
        const pivotHighOsc = s.ph.step(i, osc);
        const pivotLowOsc = s.pl.step(i, osc);
        const lowLbr = i - lb >= 0 ? bars[i - lb].low : NaN;
        const highLbr = i - lb >= 0 ? bars[i - lb].high : NaN;

        // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
        const prevPlFound = v.plFoundVar; // plFound[1]
        v.plFoundVar = !isNaN(pivotLowOsc);
        if (v.plFoundVar) {
          v.plOsc = pushed(v.plOsc, o);
          v.plLow = pushed(v.plLow, lowLbr);
        }
        // Pine v6 `and` is lazy: the ta.barssince inside _inRange(...) only runs on the bars where the left side
        // (oscLbr > ta.valuewhen(...)) is true, so it counts those calls. One state per call site.
        let oscHl = false;
        if (gt(o, second(v.plOsc))) {
          if (prevPlFound) v.plCalls = 0;
          else if (!isNaN(v.plCalls)) v.plCalls++;
          oscHl = rangeLower <= v.plCalls && v.plCalls <= rangeUpper;
        }
        const priceLl = lt(lowLbr, second(v.plLow));
        bullCond = priceLl && oscHl && v.plFoundVar;
        plFound = v.plFoundVar;

        const prevPhFound = v.phFoundVar; // phFound[1]
        v.phFoundVar = !isNaN(pivotHighOsc);
        if (v.phFoundVar) {
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
        bearCond = priceHh && oscLh && v.phFoundVar;
        phFound = v.phFoundVar;
      }

      // Colours
      const oscColor = ge(osc, 0) ? cfg.oscColorPositive : cfg.oscColorNegative;
      const p = s.plots;
      // plot(showZeroLineGradient ? 0 : na, color.new(zeroLineColor, 85), linewidth = 10)
      p[0][i] = { time, value: cfg.showZeroLineGradient ? 0 : NaN, color: zeroGrad };
      // plot(showOverboughtGradient ? overbought : na, color.new(oscSignal >= maOverbought ? overboughtColor : zeroLineColor, bandTransparency))
      p[1][i] = {
        time, value: cfg.showOverboughtGradient ? cfg.overbought : NaN,
        color: String(color.new(ge(oscSignal, cfg.maOverbought) ? cfg.overboughtColor : cfg.zeroLineColor, cfg.bandTransparency)),
      };
      // plot(showOversoldGradient ? oversold : na, color.new(oscSignal <= maOversold ? oversoldColor : zeroLineColor, bandTransparency))
      p[2][i] = {
        time, value: cfg.showOversoldGradient ? cfg.oversold : NaN,
        color: String(color.new(le(oscSignal, cfg.maOversold) ? cfg.oversoldColor : cfg.zeroLineColor, cfg.bandTransparency)),
      };
      p[3][i] = { time, value: osc, color: oscColor };
      p[4][i] = { time, value: cfg.showOscillatorGradient ? osc : NaN, color: String(color.new(oscColor, gradientTransparency)) };
      p[5][i] = { time, value: oscSignal, color: cfg.signalColor };
      p[6][i] = { time, value: cfg.showMaGradient ? oscSignal : NaN, color: signalGrad };
      p[7][i] = { time, value: osc * 0.8 };
      p[8][i] = { time, value: osc * 0.6 };
      p[9][i] = { time, value: osc * 0.4 };
      p[10][i] = { time, value: osc * 0.2 };
      p[11][i] = { time, value: 0 };
      // plot(calculateDivergence and plFound ? oscLbr : na, offset = -lookbackRight,
      //      color = bullCond ? bullDivColor : color.new(color.white, 100)): the value of bar i is drawn on bar i - lb
      if (i - lb >= 0) {
        const backTime = bars[i - lb].time;
        s.divBull[i] = { time: backTime, value: cfg.calculateDivergence && plFound ? o : NaN, color: bullCond ? cfg.bullDivColor : noDiv };
        s.divBear[i] = { time: backTime, value: cfg.calculateDivergence && phFound ? o : NaN, color: bearCond ? cfg.bearDivColor : noDiv };
      }

      // fill(pOsc, pMid1, fillEnabled ? color.new(oscColor, fillTransparency) : na) ... + 5, + 10, + 15, + 20
      for (let k = 0; k < LAYER_STEPS.length; k++) {
        s.layers[k][i] = cfg.fillEnabled ? String(color.new(oscColor, cfg.fillTransparency + LAYER_STEPS[k])) : 'transparent';
      }

      // plotshape(bullCond ? oscLbr : na, offset = -lookbackRight, text = ' Bull ', shape.labelup, location.absolute,
      //   color.new(bullDivColor, bandTransparency), textcolor = textColor, display = calculateDivergence ? all : none)
      if (cfg.calculateDivergence && i - lb >= 0) {
        const price = o;
        if (bullCond && !isNaN(price)) {
          s.markers.push({ time: bars[i - lb].time, position: 'atPriceBottom', price, shape: 'labelUp',
            color: bullLabel, text: ' Bull ', textColor: cfg.textColor, id: 'shape0' });
        }
        if (bearCond && !isNaN(price)) {
          s.markers.push({ time: bars[i - lb].time, position: 'atPriceTop', price, shape: 'labelDown',
            color: bearLabel, text: ' Bear ', textColor: cfg.textColor, id: 'shape1' });
        }
      }
      // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1]; both compare exactly
      // (no 1e-10 tolerance; na compares false)
      const po = i > 0 ? s.osc[i - 1] : NaN;
      const ps = i > 0 ? s.oscSignal[i - 1] : NaN;
      const sig = [
        i > 0 && osc > cfg.oversold && po <= cfg.oversold, i > 0 && osc < cfg.overbought && po >= cfg.overbought,
        i > 0 && osc > 0 && po <= 0, i > 0 && osc < 0 && po >= 0,
        i > 0 && oscSignal > 0 && ps <= 0, i > 0 && oscSignal < 0 && ps >= 0,
      ];
      // Signal triangles: location.bottom (buy) / location.top (sell), size.tiny
      // Style ids: shape2 .. shape7 in the original's declaration order
      const buy = (on: boolean, val: number, id: string) => {
        if (on && !isNaN(val)) s.markers.push({ time, position: 'bottom', shape: 'triangleUp', color: cfg.oversoldColor, size: 'tiny', id });
      };
      const sell = (on: boolean, val: number, id: string) => {
        if (on && !isNaN(val)) s.markers.push({ time, position: 'top', shape: 'triangleDown', color: cfg.overboughtColor, size: 'tiny', id });
      };
      buy(showObos && sig[0], osc, 'shape2');
      sell(showObos && sig[1], osc, 'shape3');
      buy(showZero && sig[2], osc, 'shape4');
      sell(showZero && sig[3], osc, 'shape5');
      buy(showMaZero && sig[4], oscSignal, 'shape6');
      sell(showMaZero && sig[5], oscSignal, 'shape7');

      // alertcondition(bullCond / bearCond / longSignalObos / shortSignalObos / longSignalZero / shortSignalZero /
      // longSignalMaZero / shortSignalMaZero)
      for (let k = 0; k < 8; k++) {
        const f = k === 0 ? bullCond : k === 1 ? bearCond : sig[k - 2];
        s.flags[k][i] = f;
        if (f) s.times[k].push(time as number);
      }
    },
    copyVars: (v) => ({ ...v }),
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      plots.plot12 = s.divBull.slice(lb);
      plots.plot13 = s.divBear.slice(lb);
      const fills = [
        { plot1: 'plot3', plot2: 'plot7', colors: s.layers[0].slice() },
        { plot1: 'plot7', plot2: 'plot8', colors: s.layers[1].slice() },
        { plot1: 'plot8', plot2: 'plot9', colors: s.layers[2].slice() },
        { plot1: 'plot9', plot2: 'plot10', colors: s.layers[3].slice() },
        { plot1: 'plot10', plot2: 'plot11', colors: s.layers[4].slice() },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: cfg.zeroLineColor, linestyle: 'dashed' } },
          { value: cfg.overbought, options: { title: 'Overbought Level', color: cfg.overboughtColor, linestyle: 'dashed' } },
          { value: cfg.oversold, options: { title: 'Oversold Level', color: cfg.oversoldColor, linestyle: 'dashed' } },
        ],
        fills,
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolatilityChannelOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolatilityChannelOscillatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Divergence Detected', message: 'Bullish divergence detected at pivot, lookback right bars ago.' },
  { id: 'alert1', title: 'Bearish Divergence Detected', message: 'Bearish divergence detected at pivot, lookback right bars ago.' },
  { id: 'alert2', title: 'Buy Signal (Oversold)', message: 'Oscillator crossed above the oversold threshold.' },
  { id: 'alert3', title: 'Sell Signal (Overbought)', message: 'Oscillator crossed below the overbought threshold.' },
  { id: 'alert4', title: 'Buy Signal (Zero Line)', message: 'Oscillator crossed above the zero line.' },
  { id: 'alert5', title: 'Sell Signal (Zero Line)', message: 'Oscillator crossed below the zero line.' },
  { id: 'alert6', title: 'Buy Signal (MA Zero Line)', message: 'Moving Average crossed above the zero line.' },
  { id: 'alert7', title: 'Sell Signal (MA Zero Line)', message: 'Moving Average crossed below the zero line.' },
];

export const VolatilityChannelOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
