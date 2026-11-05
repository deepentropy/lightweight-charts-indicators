/**
 * Force Pulse
 *
 * Over the last `lookback` bars, the bull force is the sum of the bodies of the up candles and the bear force the
 * sum of the bodies of the down candles ('AVG Body' mode: the 20-bar average body instead of the body). The
 * imbalance (bull - bear) / (bull + bear) is scaled to 0..100, smoothed with an EMA (the oscillator) and averaged
 * with an SMA (the MA). Glow plots and a five-layer fill to the midline 50 draw the oscillator; the overbought /
 * oversold bands turn red / green when the MA is beyond the MA levels. Pivot divergences between price and
 * oscillator give Bull / Bear labels; crosses of the levels, of the midline and of the MA with the midline give
 * triangle signals.
 * Alerts (alertcondition, `alerts` of the result): the level, midline and MA midline crosses and the divergences.
 *
 * Reference: "Force Pulse" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ForcePulseInputs {
  /** Calculation period (bars of the force sums) */
  lookback: number;
  /** 'Body': candle body; 'AVG Body': 20-bar average body */
  mode: 'Body' | 'AVG Body';
  /** EMA length of the oscillator */
  smoothLen: number;
  /** SMA length of the MA */
  maLength: number;
  calculateDivergence: boolean;
  /** Pivot lookback (left / right) of the divergence detection */
  pivotLength: number;
  signalType: 'None' | 'Overbought/Oversold' | 'Midline' | 'MA Midline' | 'All';
  overbought: number;
  oversold: number;
  maOverbought: number;
  maOversold: number;
  showMa: boolean;
  maColor: string;
  oscColorPositive: string;
  oscColorNegative: string;
  zeroLineColor: string;
  overboughtColor: string;
  oversoldColor: string;
  bullDivColor: string;
  bearDivColor: string;
  textColor: string;
  fillEnabled: boolean;
  fillTransparency: number;
  bandTransparency: number;
  showZeroLineGradient: boolean;
  showOverboughtGradient: boolean;
  showOversoldGradient: boolean;
  showOscillatorGradient: boolean;
  showMaGradient: boolean;
}

export const defaultInputs: ForcePulseInputs = {
  lookback: 20,
  mode: 'Body',
  smoothLen: 3,
  maLength: 20,
  calculateDivergence: true,
  pivotLength: 3,
  signalType: 'Overbought/Oversold',
  overbought: 73.0,
  oversold: 27.0,
  maOverbought: 65.0,
  maOversold: 35.0,
  showMa: true,
  maColor: color.yellow,
  oscColorPositive: 'rgb(6, 162, 47)',
  oscColorNegative: 'rgb(207, 23, 23)',
  zeroLineColor: color.gray,
  overboughtColor: color.red,
  oversoldColor: color.green,
  bullDivColor: color.green,
  bearDivColor: color.red,
  textColor: color.white,
  fillEnabled: true,
  fillTransparency: 70,
  bandTransparency: 40,
  showZeroLineGradient: true,
  showOverboughtGradient: true,
  showOversoldGradient: true,
  showOscillatorGradient: true,
  showMaGradient: true,
};

const CALC = 'Calculation Settings';
const DIV = 'Divergence Detection';
const SIG = 'Signal Settings';
const LEVELS = 'Threshold Levels';
const STYLE = 'Style & Colors';
const GRAD = 'Gradient & Fill';

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Calculation Period', defval: 20, min: 10, max: 200, group: CALC },
  { id: 'mode', type: 'string', title: 'Force Mode', defval: 'Body', options: ['Body', 'AVG Body'], group: CALC },
  { id: 'smoothLen', type: 'int', title: 'Smoothing Length (EMA)', defval: 3, group: CALC },
  { id: 'maLength', type: 'int', title: 'Moving Average Length (SMA)', defval: 20, min: 1, group: CALC },
  { id: 'calculateDivergence', type: 'bool', title: 'Enable Divergence Detection', defval: true, group: DIV },
  { id: 'pivotLength', type: 'int', title: 'Pivot Lookback (Left/Right)', defval: 3, min: 1, group: DIV },
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'Overbought/Oversold',
    options: ['None', 'Overbought/Oversold', 'Midline', 'MA Midline', 'All'], group: SIG },
  { id: 'overbought', type: 'float', title: 'Overbought Level', defval: 73.0, step: 0.1, group: LEVELS },
  { id: 'oversold', type: 'float', title: 'Oversold Level', defval: 27.0, step: 0.1, group: LEVELS },
  { id: 'maOverbought', type: 'float', title: 'MA Overbought Level', defval: 65.0, step: 0.1, group: LEVELS },
  { id: 'maOversold', type: 'float', title: 'MA Oversold Level', defval: 35.0, step: 0.1, group: LEVELS },
  { id: 'showMa', type: 'bool', title: 'Show Moving Average', defval: true, group: STYLE },
  { id: 'maColor', type: 'color', title: 'MA Color', defval: color.yellow, group: STYLE },
  { id: 'oscColorPositive', type: 'color', title: 'Oscillator Bullish Color', defval: 'rgb(6, 162, 47)', group: STYLE },
  { id: 'oscColorNegative', type: 'color', title: 'Oscillator Bearish Color', defval: 'rgb(207, 23, 23)', group: STYLE },
  { id: 'zeroLineColor', type: 'color', title: 'Midline Color', defval: color.gray, group: STYLE },
  { id: 'overboughtColor', type: 'color', title: 'Overbought Line Color', defval: color.red, group: STYLE },
  { id: 'oversoldColor', type: 'color', title: 'Oversold Line Color', defval: color.green, group: STYLE },
  { id: 'bullDivColor', type: 'color', title: 'Bullish Divergence Color', defval: color.green, group: STYLE },
  { id: 'bearDivColor', type: 'color', title: 'Bearish Divergence Color', defval: color.red, group: STYLE },
  { id: 'textColor', type: 'color', title: 'Label Text Color', defval: color.white, group: STYLE },
  { id: 'fillEnabled', type: 'bool', title: 'Enable Gradient Fill', defval: true, group: GRAD },
  { id: 'fillTransparency', type: 'int', title: 'Fill Transparency', defval: 70, min: 0, max: 100, group: GRAD },
  { id: 'bandTransparency', type: 'int', title: 'Band/Label Transparency', defval: 40, min: 0, max: 100, group: GRAD },
  { id: 'showZeroLineGradient', type: 'bool', title: 'Midline Gradient', defval: true, group: GRAD },
  { id: 'showOverboughtGradient', type: 'bool', title: 'Overbought Gradient', defval: true, group: GRAD },
  { id: 'showOversoldGradient', type: 'bool', title: 'Oversold Gradient', defval: true, group: GRAD },
  { id: 'showOscillatorGradient', type: 'bool', title: 'Oscillator Gradient', defval: true, group: GRAD },
  { id: 'showMaGradient', type: 'bool', title: 'MA Gradient', defval: true, group: GRAD },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Midline Gradient', color: String(color.new(color.gray, 40)), lineWidth: 2 },
  { id: 'plot1', title: 'Overbought Gradient', color: String(color.new(color.gray, 40)), lineWidth: 10 },
  { id: 'plot2', title: 'Oversold Gradient', color: String(color.new(color.gray, 40)), lineWidth: 10 },
  { id: 'plot3', title: 'Force Pulse', color: 'rgb(6, 162, 47)', lineWidth: 2 },
  { id: 'plot4', title: 'Oscillator Gradient', color: String(color.new('rgb(6, 162, 47)', 85)), lineWidth: 10 },
  { id: 'plot5', title: 'Oscillator Gradient Wide', color: String(color.new('rgb(6, 162, 47)', 94)), lineWidth: 16 },
  { id: 'plot6', title: 'MA', color: color.yellow, lineWidth: 2 },
  { id: 'plot7', title: 'MA Gradient', color: String(color.new(color.yellow, 85)), lineWidth: 6 },
  { id: 'plot8', title: 'Mid Layer 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot9', title: 'Mid Layer 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot10', title: 'Mid Layer 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot11', title: 'Mid Layer 4', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot12', title: 'Midline for Fill', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot13', title: 'Bullish Divergence', color: color.green, lineWidth: 2 },
  { id: 'plot14', title: 'Bearish Divergence', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'Force Pulse',
  shortTitle: 'Force Pulse',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

/** ta.valuewhen(found, x, 1) history: the value added on a found bar (the last two, older first) */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
const second = (h: readonly number[]): number => (h.length === 2 ? h[0]! : NaN);

interface ForcePulseVars {
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
  /** cpo, maCpo of the bar before */
  prevCpo: number;
  prevMa: number;
}

interface ForcePulseRun extends BarRunState<ForcePulseVars> {
  avgBody: ReturnType<typeof taStep.sma>;
  cumBullStep: ReturnType<typeof taStep.cum>;
  cumBearStep: ReturnType<typeof taStep.cum>;
  ema: ReturnType<typeof taStep.ema>;
  ma: ReturnType<typeof taStep.sma>;
  pivotLow: PivotStep;
  pivotHigh: PivotStep;
  cumBull: number[];
  cumBear: number[];
  cpo: number[];
  plots: (Point | null)[][];
  layers: string[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<ForcePulseInputs>): BarStudy<ForcePulseRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const rangeUpper = 60;
  const rangeLower = 5;
  const avg = cfg.mode === 'AVG Body';
  const lb = cfg.lookback;
  const pr = cfg.pivotLength;
  const noDiv = String(color.new(color.white, 100));
  const midGrad = String(color.new(cfg.zeroLineColor, cfg.bandTransparency));
  const maGrad = String(color.new(cfg.maColor, 85));
  const bullLabel = String(color.new(cfg.bullDivColor, cfg.bandTransparency));
  const bearLabel = String(color.new(cfg.bearDivColor, cfg.bandTransparency));
  const showObos = cfg.signalType === 'Overbought/Oversold' || cfg.signalType === 'All';
  const showZero = cfg.signalType === 'Midline' || cfg.signalType === 'All';
  const showMaZero = cfg.signalType === 'MA Midline' || cfg.signalType === 'All';
  // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1]; both compare exactly
  // (no 1e-10 tolerance; na compares false)
  const crossover = (a: number, a1: number, b: number, i: number) => i > 0 && a > b && a1 <= b;
  const crossunder = (a: number, a1: number, b: number, i: number) => i > 0 && a < b && a1 >= b;
  return {
    init() {
      const s: ForcePulseRun = {
        avgBody: taStep.sma(), cumBullStep: taStep.cum(), cumBearStep: taStep.cum(), ema: taStep.ema(cfg.smoothLen),
        ma: taStep.sma(), pivotLow: new PivotStep(pr, pr, false), pivotHigh: new PivotStep(pr, pr, true),
        cumBull: [], cumBear: [], cpo: [], plots: Array.from({ length: 15 }, () => []),
        layers: Array.from({ length: 5 }, () => []), flags: alertConditions.map(() => []),
        times: alertConditions.map(() => []), markers: [],
        steps: [],
        vars: {
          plOsc: [], plLow: [], phOsc: [], phHigh: [], plCalls: NaN, phCalls: NaN, plFound: false, phFound: false,
          prevCpo: NaN, prevMa: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [
        s.avgBody, s.cumBullStep, s.cumBearStep, s.ema, s.ma,
        ...(cfg.calculateDivergence ? [s.pivotLow, s.pivotHigh] : []),
      ];
      s.lists = [...s.times, s.markers];
      s.series = [s.cumBull, s.cumBear, s.cpo, ...s.plots, ...s.layers, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time;

      // Force Pulse calculation
      const body = Math.abs(b.close - b.open);
      const avgBody = s.avgBody.step(body, 20);
      const up = ge(b.close, b.open); // close >= open
      const down = lt(b.close, b.open); // close < open
      const bullForce = avg ? (up ? avgBody : 0) : (up ? body : 0);
      const bearForce = avg ? (down ? avgBody : 0) : (down ? body : 0);
      // bullSum = ta.cum(bullForce) - ta.cum(bullForce)[lookback]
      const cumBull = s.cumBull;
      const cumBear = s.cumBear;
      cumBull[i] = s.cumBullStep.step(bullForce);
      cumBear[i] = s.cumBearStep.step(bearForce);
      const bullSum = i - lb >= 0 ? cumBull[i] - cumBull[i - lb] : NaN;
      const bearSum = i - lb >= 0 ? cumBear[i] - cumBear[i - lb] : NaN;
      const total = bullSum + bearSum;
      // A plain division (as Pine): x / 0 is +-infinity, 0 / 0 is na
      const imbalance = eq(total, 0) ? 0 : (bullSum - bearSum) / total;
      const nv = (imbalance + 1) * 50;
      // norm := math.max(math.min(norm, 100), 0) (na stays na)
      const norm = isNaN(nv) ? NaN : Math.max(Math.min(nv, 100), 0);
      const cpo = s.ema.step(norm);
      s.cpo[i] = cpo;
      const maCpo = s.ma.step(cpo, cfg.maLength);

      // Divergence detection
      const o = i - pr >= 0 ? s.cpo[i - pr] : NaN;
      let plFound = false;
      let phFound = false;
      let bullCond = false;
      let bearCond = false;
      if (cfg.calculateDivergence) {
        const lowLbr = i - pr >= 0 ? bars[i - pr].low : NaN;
        const highLbr = i - pr >= 0 ? bars[i - pr].high : NaN;
        const pivotLowOsc = s.pivotLow.step(i, cpo);
        const pivotHighOsc = s.pivotHigh.step(i, cpo);

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

      // Colours
      const plotColor = ge(cpo, 50) ? cfg.oscColorPositive : cfg.oscColorNegative;
      const p = s.plots;
      // plot(showZeroLineGradient ? 50 : na, color.new(zeroLineColor, bandTransparency), linewidth = 2)
      p[0][i] = { time, value: cfg.showZeroLineGradient ? 50 : NaN, color: midGrad };
      // plot(showOverboughtGradient ? overbought : na,
      //      color.new(maCpo >= maOverbought ? overboughtColor : zeroLineColor, bandTransparency), linewidth = 10)
      p[1][i] = {
        time, value: cfg.showOverboughtGradient ? cfg.overbought : NaN,
        color: String(color.new(ge(maCpo, cfg.maOverbought) ? cfg.overboughtColor : cfg.zeroLineColor, cfg.bandTransparency)),
      };
      p[2][i] = {
        time, value: cfg.showOversoldGradient ? cfg.oversold : NaN,
        color: String(color.new(le(maCpo, cfg.maOversold) ? cfg.oversoldColor : cfg.zeroLineColor, cfg.bandTransparency)),
      };
      p[3][i] = { time, value: cpo, color: plotColor };
      p[4][i] = { time, value: cfg.showOscillatorGradient ? cpo : NaN, color: String(color.new(plotColor, 85)) };
      p[5][i] = { time, value: cfg.showOscillatorGradient ? cpo : NaN, color: String(color.new(plotColor, 94)) };
      p[6][i] = { time, value: cfg.showMa ? maCpo : NaN, color: cfg.maColor };
      p[7][i] = { time, value: cfg.showMa && cfg.showMaGradient ? maCpo : NaN, color: maGrad };
      p[8][i] = { time, value: cpo * 0.8 + 50 * 0.2 };
      p[9][i] = { time, value: cpo * 0.6 + 50 * 0.4 };
      p[10][i] = { time, value: cpo * 0.4 + 50 * 0.6 };
      p[11][i] = { time, value: cpo * 0.2 + 50 * 0.8 };
      p[12][i] = { time, value: 50 };
      // plot(calculateDivergence and plFound ? oscLbr : na, offset = -lookbackRight,
      //      color = bullCond ? bullDivColor : color.new(color.white, 100)): the value of bar i is drawn on bar i - pr
      //      (slot i here, the first pr slots dropped in the result)
      if (i - pr < 0) {
        p[13][i] = null;
        p[14][i] = null;
      } else {
        const lbrTime = bars[i - pr].time;
        p[13][i] = { time: lbrTime, value: cfg.calculateDivergence && plFound ? o : NaN, color: bullCond ? cfg.bullDivColor : noDiv };
        p[14][i] = { time: lbrTime, value: cfg.calculateDivergence && phFound ? o : NaN, color: bearCond ? cfg.bearDivColor : noDiv };
      }

      // fill(p1, p_mid1, fillEnabled ? color.new(plotColor, fillTransparency) : na) ... + 5, + 10, + 15, + 20
      for (let k = 0; k < 5; k++) {
        s.layers[k][i] = cfg.fillEnabled ? String(color.new(plotColor, cfg.fillTransparency + 5 * k)) : 'transparent';
      }

      // Signal triangles: location.bottom (long) / location.top (short), size.tiny
      // (ids shape0..shape5: the plotshapes in the original's order)
      const markers = s.markers;
      const buy = (on: boolean, id: string) => {
        if (on) markers.push({ time, position: 'bottom', shape: 'triangleUp', color: cfg.oversoldColor, size: 'tiny', id });
      };
      const sell = (on: boolean, id: string) => {
        if (on) markers.push({ time, position: 'top', shape: 'triangleDown', color: cfg.overboughtColor, size: 'tiny', id });
      };
      const sig = [
        crossover(cpo, v.prevCpo, cfg.oversold, i), crossunder(cpo, v.prevCpo, cfg.overbought, i),
        crossover(cpo, v.prevCpo, 50, i), crossunder(cpo, v.prevCpo, 50, i),
        crossover(maCpo, v.prevMa, 50, i), crossunder(maCpo, v.prevMa, 50, i), bullCond, bearCond,
      ];
      v.prevCpo = cpo;
      v.prevMa = maCpo;
      for (let k = 0; k < 8; k++) {
        s.flags[k][i] = sig[k];
        if (sig[k]) s.times[k].push(time as number);
      }
      buy(showObos && sig[0], 'shape0');
      sell(showObos && sig[1], 'shape1');
      buy(showZero && sig[2], 'shape2');
      sell(showZero && sig[3], 'shape3');
      buy(showMaZero && sig[4], 'shape4');
      sell(showMaZero && sig[5], 'shape5');
      // plotshape(bullCond ? oscLbr : na, offset = -lookbackRight, text = ' Bull ', shape.labelup, location.absolute,
      //   color.new(bullDivColor, bandTransparency), textcolor = textColor, size.small)
      if (i - pr >= 0) {
        const price = o;
        if (bullCond && !isNaN(price)) {
          markers.push({ time: bars[i - pr].time, position: 'atPriceBottom', price, shape: 'labelUp',
            color: bullLabel, text: ' Bull ', textColor: cfg.textColor, size: 'small', id: 'shape6' });
        }
        if (bearCond && !isNaN(price)) {
          markers.push({ time: bars[i - pr].time, position: 'atPriceTop', price, shape: 'labelDown',
            color: bearLabel, text: ' Bear ', textColor: cfg.textColor, size: 'small', id: 'shape7' });
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((pl, k) => {
        plots[`plot${k}`] = (k === 13 || k === 14 ? pl.slice(Math.min(Math.max(pr, 0), n)) : pl.slice()) as Point[];
      });
      const fills = [
        { plot1: 'plot3', plot2: 'plot8', colors: s.layers[0].slice() },
        { plot1: 'plot8', plot2: 'plot9', colors: s.layers[1].slice() },
        { plot1: 'plot9', plot2: 'plot10', colors: s.layers[2].slice() },
        { plot1: 'plot10', plot2: 'plot11', colors: s.layers[3].slice() },
        { plot1: 'plot11', plot2: 'plot12', colors: s.layers[4].slice() },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots,
        hlines: [
          { value: 50, options: { title: 'Midline', color: cfg.zeroLineColor, linestyle: 'dashed' } },
          { value: cfg.overbought, options: { title: 'Overbought', color: cfg.overboughtColor, linestyle: 'dashed' } },
          { value: cfg.oversold, options: { title: 'Oversold', color: cfg.oversoldColor, linestyle: 'dashed' } },
        ],
        fills,
        markers: s.markers.slice(),
        // alertcondition(longSignalObos / shortSignalObos / longSignalZero / shortSignalZero / longSignalMaZero /
        // shortSignalMaZero / bullCond / bearCond)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ForcePulseInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ForcePulseInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy – Oversold', message: 'Force Pulse: Price crossed above oversold level' },
  { id: 'alert1', title: 'Sell – Overbought', message: 'Force Pulse: Price crossed below overbought level' },
  { id: 'alert2', title: 'Midline Long', message: 'Force Pulse: Oscillator crossed above Midline' },
  { id: 'alert3', title: 'Midline Short', message: 'Force Pulse: Oscillator crossed below Midline' },
  { id: 'alert4', title: 'MA Midline Long', message: 'Force Pulse: MA crossed above Midline' },
  { id: 'alert5', title: 'MA Midline Short', message: 'Force Pulse: MA crossed below Midline' },
  { id: 'alert6', title: 'Bullish Divergence', message: 'Force Pulse: Bullish divergence detected' },
  { id: 'alert7', title: 'Bearish Divergence', message: 'Force Pulse: Bearish divergence detected' },
];

export const ForcePulse = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
