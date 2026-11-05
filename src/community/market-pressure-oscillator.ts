/**
 * Market Pressure Oscillator (MPO)
 *
 * Each candle gives +1 (up), -1 (down) or 0 times its body divided by the average body of `len` bars (1 when the
 * average is not known or 0). The sum of the last `len` contributions, as a percent of len * 2, is smoothed by an EMA
 * (the oscillator) and averaged by an SMA (the moving average). Glow plots and a five-layer fill to zero draw the
 * oscillator; pivot divergences between price and oscillator give Bull / Bear labels, and crosses of the thresholds,
 * of zero and of the moving average with zero give triangle signals.
 * Alerts (alertcondition, `alerts` of the result): the bullish / bearish divergences (on the bar that confirms the
 * pivot) and the six threshold / zero-line crosses (whatever the signal type shown).
 *
 * Reference: "Market Pressure Oscillator" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barTime } from '../bar-time';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MarketPressureOscillatorInputs {
  overbought: number;
  oversold: number;
  maOverbought: number;
  maOversold: number;
  /** Lookback length (average body and rolling sum) */
  len: number;
  /** EMA length of the oscillator */
  smoothLen: number;
  /** SMA length of the moving average */
  maLength: number;
  /** Pivot length (left / right) of the divergence detection */
  pivotLength: number;
  calculateDivergence: boolean;
  signalType: 'None' | 'Overbought/Oversold' | 'Zero Line' | 'MA Zero Line' | 'All';
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

export const defaultInputs: MarketPressureOscillatorInputs = {
  overbought: 30.0,
  oversold: -30.0,
  maOverbought: 10.0,
  maOversold: -10.0,
  len: 14,
  smoothLen: 1,
  maLength: 14,
  pivotLength: 2,
  calculateDivergence: true,
  signalType: 'Overbought/Oversold',
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

export const inputConfig: InputConfig[] = [
  { id: 'overbought', type: 'float', title: 'Overbought Threshold', defval: 30.0, step: 0.1 },
  { id: 'oversold', type: 'float', title: 'Oversold Threshold', defval: -30.0, step: 0.1 },
  { id: 'maOverbought', type: 'float', title: 'MA Overbought Threshold', defval: 10.0, step: 0.1 },
  { id: 'maOversold', type: 'float', title: 'MA Oversold Threshold', defval: -10.0, step: 0.1 },
  { id: 'len', type: 'int', title: 'Lookback Length', defval: 14 },
  { id: 'smoothLen', type: 'int', title: 'Smoothing Length (EMA)', defval: 1 },
  { id: 'maLength', type: 'int', title: 'Moving Average Length (SMA)', defval: 14, min: 1 },
  { id: 'pivotLength', type: 'int', title: 'Pivot Length (Left/Right)', defval: 2, min: 1 },
  { id: 'calculateDivergence', type: 'bool', title: 'Enable Divergence Detection', defval: true },
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'Overbought/Oversold', options: ['None', 'Overbought/Oversold', 'Zero Line', 'MA Zero Line', 'All'] },
  { id: 'showMa', type: 'bool', title: 'Show Moving Average', defval: true },
  { id: 'maColor', type: 'color', title: 'Moving Average Color', defval: color.yellow },
  { id: 'oscColorPositive', type: 'color', title: 'Bullish Oscillator Color', defval: 'rgb(6, 162, 47)' },
  { id: 'oscColorNegative', type: 'color', title: 'Bearish Oscillator Color', defval: 'rgb(207, 23, 23)' },
  { id: 'zeroLineColor', type: 'color', title: 'Zero Line Color', defval: color.gray },
  { id: 'overboughtColor', type: 'color', title: 'Overbought Line Color', defval: color.red },
  { id: 'oversoldColor', type: 'color', title: 'Oversold Line Color', defval: color.green },
  { id: 'bullDivColor', type: 'color', title: 'Bullish Divergence Color', defval: color.green },
  { id: 'bearDivColor', type: 'color', title: 'Bearish Divergence Color', defval: color.red },
  { id: 'textColor', type: 'color', title: 'Text Color', defval: color.white },
  { id: 'fillEnabled', type: 'bool', title: 'Enable Gradient Fill', defval: true },
  { id: 'fillTransparency', type: 'int', title: 'Gradient Fill Transparency', defval: 70, min: 0, max: 100 },
  { id: 'bandTransparency', type: 'int', title: 'Band and Label Gradient Transparency', defval: 40, min: 0, max: 100 },
  { id: 'showZeroLineGradient', type: 'bool', title: 'Show Zero Line Gradient', defval: true },
  { id: 'showOverboughtGradient', type: 'bool', title: 'Show Overbought Gradient', defval: true },
  { id: 'showOversoldGradient', type: 'bool', title: 'Show Oversold Gradient', defval: true },
  { id: 'showOscillatorGradient', type: 'bool', title: 'Show Oscillator Gradient', defval: true },
  { id: 'showMaGradient', type: 'bool', title: 'Show Moving Average Gradient', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line Gradient', color: String(color.new(color.gray, 85)), lineWidth: 10 },
  { id: 'plot1', title: 'Overbought Gradient', color: String(color.new(color.gray, 40)), lineWidth: 10 },
  { id: 'plot2', title: 'Oversold Gradient', color: String(color.new(color.gray, 40)), lineWidth: 10 },
  { id: 'plot3', title: 'CPO Oscillator', color: 'rgb(6, 162, 47)', lineWidth: 2 },
  { id: 'plot4', title: 'Oscillator Gradient', color: String(color.new('rgb(6, 162, 47)', 85)), lineWidth: 10 },
  { id: 'plot5', title: 'Moving Average (SMA)', color: color.yellow, lineWidth: 2 },
  { id: 'plot6', title: 'Moving Average Gradient', color: String(color.new(color.yellow, 85)), lineWidth: 6 },
  { id: 'plot7', title: 'Intermediate Layer 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Intermediate Layer 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot9', title: 'Intermediate Layer 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot10', title: 'Intermediate Layer 4', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot11', title: 'Zero Line for Fill', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot12', title: 'Bullish Divergence', color: color.green, lineWidth: 2 },
  { id: 'plot13', title: 'Bearish Divergence', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'Market Pressure Oscillator',
  shortTitle: 'MPO',
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

interface MpoVars {
  /** ta.valuewhen(found, x, 1): the last two values of x on the found bars (older first) */
  plOsc: readonly number[];
  plLow: readonly number[];
  phOsc: readonly number[];
  phHigh: readonly number[];
  /** Calls of the ta.barssince in _inRange (Pine v6 `and` is lazy) */
  plCalls: number;
  phCalls: number;
  /** var bool plFound / phFound */
  plFound: boolean;
  phFound: boolean;
}

interface MpoRun extends BarRunState<MpoVars> {
  avgBody: ReturnType<typeof taStep.sma>;
  ema: ReturnType<typeof taStep.ema>;
  ma: ReturnType<typeof taStep.sma>;
  ph: PivotStep;
  pl: PivotStep;
  contrib: number[];
  osc: number[];
  maCpo: number[];
  /** plot0 .. plot11 by bar; plot12 / plot13 by the bar that draws them (drawn lb bars back, from bar lb) */
  plots: Point[][];
  layers: string[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** ta.valuewhen history: the value added on a found bar */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (na before two values) */
const second = (h: readonly number[]): number => (h.length === 2 ? h[0]! : NaN);

function study(inputs: Partial<MarketPressureOscillatorInputs>): BarStudy<MpoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const rangeUpper = 60;
  const rangeLower = 5;
  const gradientTransparency = 85;
  const lb = cfg.pivotLength;
  const zeroGrad = String(color.new(cfg.zeroLineColor, gradientTransparency));
  const maGrad = String(color.new(cfg.maColor, gradientTransparency));
  const noDiv = String(color.new(color.white, 100));
  const bullLabel = String(color.new(cfg.bullDivColor, cfg.bandTransparency));
  const bearLabel = String(color.new(cfg.bearDivColor, cfg.bandTransparency));
  const showObos = cfg.signalType === 'Overbought/Oversold' || cfg.signalType === 'All';
  const showZero = cfg.signalType === 'Zero Line' || cfg.signalType === 'All';
  const showMaZero = cfg.signalType === 'MA Zero Line' || cfg.signalType === 'All';
  const layerOffsets = [0, 5, 10, 15, 20];
  return {
    init() {
      const s: MpoRun = {
        avgBody: taStep.sma(), ema: taStep.ema(cfg.smoothLen), ma: taStep.sma(),
        ph: new PivotStep(lb, lb, true), pl: new PivotStep(lb, lb, false),
        contrib: [], osc: [], maCpo: [], plots: Array.from({ length: 14 }, () => []), layers: layerOffsets.map(() => []),
        markers: [], flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [],
        vars: { plOsc: [], plLow: [], phOsc: [], phHigh: [], plCalls: NaN, phCalls: NaN, plFound: false, phFound: false },
        lists: [], series: [],
      };
      s.steps = [s.avgBody, s.ema, s.ma, ...(cfg.calculateDivergence ? [s.ph, s.pl] : [])];
      s.lists = [s.markers, ...s.times];
      s.series = [s.contrib, s.osc, s.maCpo, ...s.plots, ...s.layers, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const osc = s.osc;
      const maCpoArr = s.maCpo;

      // Candle contributions
      const body = Math.abs(b.close - b.open);
      const avgBody = s.avgBody.step(body, cfg.len) ?? NaN;
      const direction = gt(b.close, b.open) ? 1.0 : lt(b.close, b.open) ? -1.0 : 0.0;
      // avgBody != 0 ? body / avgBody : 1.0 (na != 0 is false: weight 1 while avgBody is na)
      const weight = !isNaN(avgBody) && avgBody !== 0 ? body / avgBody : 1.0;
      s.contrib[i] = direction * weight;
      // for i = 0 to len - 1: rolling += contrib[i] (na before the first len bars)
      let rolling = 0.0;
      for (let k = 0; k <= cfg.len - 1; k++) rolling += i - k >= 0 ? s.contrib[i - k] : NaN;
      const norm = (rolling / (cfg.len * 2)) * 100.0;
      const o0 = s.ema.step(norm) ?? NaN;
      osc[i] = o0;
      const maCpo = s.ma.step(o0, cfg.maLength) ?? NaN;
      maCpoArr[i] = maCpo;

      // Divergence detection
      let bullCond = false;
      let bearCond = false;
      let plFound = false;
      let phFound = false;
      const o = i - lb >= 0 ? osc[i - lb] : NaN;
      if (cfg.calculateDivergence) {
        const v = s.vars;
        const pivotLowOsc = s.pl.step(i, o0);
        const pivotHighOsc = s.ph.step(i, o0);
        const lowLbr = i - lb >= 0 ? bars[i - lb].low : NaN;
        const highLbr = i - lb >= 0 ? bars[i - lb].high : NaN;

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
      const oscColor = ge(o0, 0) ? cfg.oscColorPositive : cfg.oscColorNegative;
      const p = s.plots;
      // plot(showZeroLineGradient ? 0 : na, color.new(zeroLineColor, 85), linewidth = 10)
      p[0][i] = { time, value: cfg.showZeroLineGradient ? 0 : NaN, color: zeroGrad };
      // plot(showOverboughtGradient ? overbought : na, color.new(maCpo >= maOverbought ? overboughtColor : zeroLineColor, bandTransparency))
      p[1][i] = {
        time, value: cfg.showOverboughtGradient ? cfg.overbought : NaN,
        color: String(color.new(ge(maCpo, cfg.maOverbought) ? cfg.overboughtColor : cfg.zeroLineColor, cfg.bandTransparency)),
      };
      // plot(showOversoldGradient ? oversold : na, color.new(maCpo <= maOversold ? oversoldColor : zeroLineColor, bandTransparency))
      p[2][i] = {
        time, value: cfg.showOversoldGradient ? cfg.oversold : NaN,
        color: String(color.new(le(maCpo, cfg.maOversold) ? cfg.oversoldColor : cfg.zeroLineColor, cfg.bandTransparency)),
      };
      p[3][i] = { time, value: o0, color: oscColor };
      p[4][i] = { time, value: cfg.showOscillatorGradient ? o0 : NaN, color: String(color.new(oscColor, gradientTransparency)) };
      p[5][i] = { time, value: cfg.showMa ? maCpo : NaN, color: cfg.maColor };
      p[6][i] = { time, value: cfg.showMa && cfg.showMaGradient ? maCpo : NaN, color: maGrad };
      p[7][i] = { time, value: o0 * 0.8 };
      p[8][i] = { time, value: o0 * 0.6 };
      p[9][i] = { time, value: o0 * 0.4 };
      p[10][i] = { time, value: o0 * 0.2 };
      p[11][i] = { time, value: 0 };
      // plot(calculateDivergence and plFound ? oscLbr : na, offset = -lookbackRight,
      //      color = bullCond ? bullDivColor : color.new(color.white, 100)): the value of bar i is drawn on bar i - lb
      if (i - lb >= 0) {
        const backTime = barTime(bars, i - lb);
        p[12][i] = { time: backTime, value: cfg.calculateDivergence && plFound ? o : NaN, color: bullCond ? cfg.bullDivColor : noDiv };
        p[13][i] = { time: backTime, value: cfg.calculateDivergence && phFound ? o : NaN, color: bearCond ? cfg.bearDivColor : noDiv };
      }

      // fill(p1, p_mid1, fillEnabled ? color.new(plotColor, fillTransparency) : na) ... + 5, + 10, + 15, + 20
      for (let k = 0; k < layerOffsets.length; k++) {
        s.layers[k][i] = cfg.fillEnabled ? String(color.new(oscColor, cfg.fillTransparency + layerOffsets[k])) : 'transparent';
      }

      // plotshape(bullCond ? oscLbr : na, offset = -lookbackRight, text = ' Bull ', shape.labelup, location.absolute,
      //   color.new(bullDivColor, bandTransparency), textcolor = textColor, display = calculateDivergence ? all : none)
      if (cfg.calculateDivergence && i - lb >= 0) {
        const price = o;
        if (bullCond && !isNaN(price)) {
          s.markers.push({ time: barTime(bars, i - lb), id: 'shape6', position: 'atPriceBottom', price, shape: 'labelUp',
            color: bullLabel, text: ' Bull ', textColor: cfg.textColor });
        }
        if (bearCond && !isNaN(price)) {
          s.markers.push({ time: barTime(bars, i - lb), id: 'shape7', position: 'atPriceTop', price, shape: 'labelDown',
            color: bearLabel, text: ' Bear ', textColor: cfg.textColor });
        }
      }
      // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1]
      // (exact comparisons, no 1e-10 tolerance; na gives false)
      // longSignalObos, shortSignalObos, longSignalZero, shortSignalZero, longSignalMaZero, shortSignalMaZero
      const po = i > 0 ? osc[i - 1] : NaN;
      const pm = i > 0 ? maCpoArr[i - 1] : NaN;
      const f = s.flags;
      f[0][i] = bullCond;
      f[1][i] = bearCond;
      f[2][i] = i > 0 && o0 > cfg.oversold && po <= cfg.oversold;
      f[3][i] = i > 0 && o0 < cfg.overbought && po >= cfg.overbought;
      f[4][i] = i > 0 && o0 > 0 && po <= 0;
      f[5][i] = i > 0 && o0 < 0 && po >= 0;
      f[6][i] = i > 0 && maCpo > 0 && pm <= 0;
      f[7][i] = i > 0 && maCpo < 0 && pm >= 0;
      // Signal triangles: location.bottom (buy) / location.top (sell), size.tiny
      for (let k = 0; k < 6; k++) {
        const on = (k < 2 ? showObos : k < 4 ? showZero : showMaZero) && f[k + 2][i];
        const v = k < 4 ? o0 : maCpo;
        if (!on || isNaN(v)) continue;
        const id = `shape${k}`;
        if (k % 2 === 0) s.markers.push({ time, id, position: 'bottom', shape: 'triangleUp', color: cfg.oversoldColor, size: 'tiny' });
        else s.markers.push({ time, id, position: 'top', shape: 'triangleDown', color: cfg.overboughtColor, size: 'tiny' });
      }
      for (let k = 0; k < f.length; k++) if (f[k][i]) s.times[k].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = k >= 12 ? p.slice(Math.min(n, Math.max(0, Math.ceil(lb)))) : p.slice(); });
      const titles = ['Fill Layer 1', 'Fill Layer 2', 'Fill Layer 3', 'Fill Layer 4', 'Fill Layer 5'];
      const pairs = [['plot3', 'plot7'], ['plot7', 'plot8'], ['plot8', 'plot9'], ['plot9', 'plot10'], ['plot10', 'plot11']];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: cfg.zeroLineColor, linestyle: 'dashed' } },
          { value: cfg.overbought, options: { title: 'Overbought Level', color: cfg.overboughtColor, linestyle: 'dashed' } },
          { value: cfg.oversold, options: { title: 'Oversold Level', color: cfg.oversoldColor, linestyle: 'dashed' } },
        ],
        fills: s.layers.map((colors, k) => ({ plot1: pairs[k][0], plot2: pairs[k][1], options: { title: titles[k] }, colors: colors.slice() })),
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketPressureOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MarketPressureOscillatorInputs> = {}): Result {
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

export const MarketPressureOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
