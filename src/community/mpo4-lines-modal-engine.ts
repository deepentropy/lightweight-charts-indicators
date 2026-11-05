/**
 * MPO4 Lines – Modal Engine
 *
 * Candle pressure oscillator lines. Each bar contributes its direction (+1 up, -1 down, 0 flat) times its body
 * divided by the SMA of the bodies over the lookback (1 when that SMA is 0 or na); the contributions are summed over
 * the lookback, normalised to rolling / (2 * lookback) * 100 and smoothed by an EMA. The slow line gets a second
 * EMA. Fast line B has a five-layer fill to zero and a fill to fast line A; bands at the overbought / oversold
 * levels change colour with the order of the fast lines. Circles mark fast line A crossing back from the oversold /
 * overbought levels; pivot divergences between price and fast line A give Bull / Bear labels.
 *
 * Alerts (alertcondition, `alerts` of the result): the buy / sell return signals (when shown), the slow line colour
 * change (Direction mode / Position vs Zero mode) and the bullish / bearish divergences on fast line A.
 *
 * Reference: "MPO4 Lines – Modal Engine" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type Mpo4SlowColorMode = 'Direction' | 'Position vs Zero';

export interface Mpo4LinesModalEngineInputs {
  /** Slow line colouring: direction (rising / falling) or position against zero */
  slowColorMode: Mpo4SlowColorMode;
  showLine1: boolean;
  showLine2: boolean;
  showLine3: boolean;
  showLine4: boolean;
  /** Slow line lookback */
  len1: number;
  /** Slow line primary EMA */
  smoothLen1: number;
  /** Slow line extra EMA */
  extraSmoothLen: number;
  len2: number;
  smoothLen2: number;
  len3: number;
  smoothLen3: number;
  len4: number;
  smoothLen4: number;
  overbought: number;
  oversold: number;
  /** Circles when fast line A crosses back from the oversold / overbought levels */
  showObosSignals: boolean;
  /** Divergences on fast line A */
  calculateDivergence: boolean;
  /** Pivot length (left / right) */
  pivotLength: number;
  line1ColorPositive: string;
  line1ColorNegative: string;
  line2ColorPositive: string;
  line2ColorNegative: string;
  line3ColorPositive: string;
  line3ColorNegative: string;
  line4ColorPositive: string;
  line4ColorNegative: string;
  zeroLineColor: string;
  overboughtLineColor: string;
  oversoldLineColor: string;
  bullDivColor: string;
  bearDivColor: string;
  textColor: string;
  gradientTransparency: number;
  line2Line3GradientTransparency: number;
  bandTransparency: number;
  showOverboughtGradient: boolean;
  showOversoldGradient: boolean;
  showFastBToZeroGradient: boolean;
}

export const defaultInputs: Mpo4LinesModalEngineInputs = {
  slowColorMode: 'Direction',
  showLine1: true,
  showLine2: true,
  showLine3: true,
  showLine4: false,
  len1: 20,
  smoothLen1: 5,
  extraSmoothLen: 5,
  len2: 6,
  smoothLen2: 7,
  len3: 6,
  smoothLen3: 10,
  len4: 14,
  smoothLen4: 1,
  overbought: 30.0,
  oversold: -30.0,
  showObosSignals: true,
  calculateDivergence: true,
  pivotLength: 2,
  line1ColorPositive: 'rgb(6, 162, 47)',
  line1ColorNegative: 'rgb(207, 23, 23)',
  line2ColorPositive: 'rgb(163, 231, 172)',
  line2ColorNegative: 'rgb(237, 121, 121)',
  line3ColorPositive: 'rgb(6, 162, 47)',
  line3ColorNegative: 'rgb(207, 23, 23)',
  line4ColorPositive: 'rgb(6, 162, 47)',
  line4ColorNegative: 'rgb(207, 23, 23)',
  zeroLineColor: color.gray,
  overboughtLineColor: color.red,
  oversoldLineColor: color.green,
  bullDivColor: color.green,
  bearDivColor: color.red,
  textColor: color.white,
  gradientTransparency: 75,
  line2Line3GradientTransparency: 50,
  bandTransparency: 40,
  showOverboughtGradient: true,
  showOversoldGradient: true,
  showFastBToZeroGradient: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'slowColorMode', type: 'string', title: 'Slow Line Coloring Mode', defval: 'Direction', options: ['Direction', 'Position vs Zero'] },
  { id: 'showLine1', type: 'bool', title: 'Show Slow Line', defval: true },
  { id: 'showLine2', type: 'bool', title: 'Show Fast Line A', defval: true },
  { id: 'showLine3', type: 'bool', title: 'Show Fast Line B', defval: true },
  { id: 'showLine4', type: 'bool', title: 'Show Line 4', defval: false },
  { id: 'len1', type: 'int', title: 'Slow Line Lookback (Base)', defval: 20 },
  { id: 'smoothLen1', type: 'int', title: 'Slow Line Primary Smoothing (EMA)', defval: 5 },
  { id: 'extraSmoothLen', type: 'int', title: 'Slow Line Extra Smoothing (EMA)', defval: 5, min: 1 },
  { id: 'len2', type: 'int', title: 'Fast Line A Lookback', defval: 6 },
  { id: 'smoothLen2', type: 'int', title: 'Fast Line A Smoothing (EMA)', defval: 7 },
  { id: 'len3', type: 'int', title: 'Fast Line B Lookback', defval: 6 },
  { id: 'smoothLen3', type: 'int', title: 'Fast Line B Smoothing (EMA)', defval: 10 },
  { id: 'len4', type: 'int', title: 'Line 4 Lookback', defval: 14 },
  { id: 'smoothLen4', type: 'int', title: 'Line 4 Smoothing (EMA)', defval: 1 },
  { id: 'overbought', type: 'float', title: 'Overbought Threshold', defval: 30.0, step: 0.1 },
  { id: 'oversold', type: 'float', title: 'Oversold Threshold', defval: -30.0, step: 0.1 },
  { id: 'showObosSignals', type: 'bool', title: 'Show Fast A OB/OS Return Signals', defval: true },
  { id: 'calculateDivergence', type: 'bool', title: 'Enable Divergence (on Fast Line A)', defval: true },
  { id: 'pivotLength', type: 'int', title: 'Pivot Length (Left/Right)', defval: 2, min: 1 },
  { id: 'line1ColorPositive', type: 'color', title: 'Slow Line Bullish', defval: 'rgb(6, 162, 47)' },
  { id: 'line1ColorNegative', type: 'color', title: 'Slow Line Bearish', defval: 'rgb(207, 23, 23)' },
  { id: 'line2ColorPositive', type: 'color', title: 'Fast Line A Bullish', defval: 'rgb(163, 231, 172)' },
  { id: 'line2ColorNegative', type: 'color', title: 'Fast Line A Bearish', defval: 'rgb(237, 121, 121)' },
  { id: 'line3ColorPositive', type: 'color', title: 'Fast Line B Bullish', defval: 'rgb(6, 162, 47)' },
  { id: 'line3ColorNegative', type: 'color', title: 'Fast Line B Bearish', defval: 'rgb(207, 23, 23)' },
  { id: 'line4ColorPositive', type: 'color', title: 'Line 4 Bullish', defval: 'rgb(6, 162, 47)' },
  { id: 'line4ColorNegative', type: 'color', title: 'Line 4 Bearish', defval: 'rgb(207, 23, 23)' },
  { id: 'zeroLineColor', type: 'color', title: 'Zero Line Color', defval: color.gray },
  { id: 'overboughtLineColor', type: 'color', title: 'Overbought Line Color', defval: color.red },
  { id: 'oversoldLineColor', type: 'color', title: 'Oversold Line Color', defval: color.green },
  { id: 'bullDivColor', type: 'color', title: 'Bullish Divergence Color', defval: color.green },
  { id: 'bearDivColor', type: 'color', title: 'Bearish Divergence Color', defval: color.red },
  { id: 'textColor', type: 'color', title: 'Divergence Text Color', defval: color.white },
  { id: 'gradientTransparency', type: 'int', title: 'Fast B to Zero Gradient Transparency', defval: 75, min: 0, max: 100 },
  { id: 'line2Line3GradientTransparency', type: 'int', title: 'Fast A to B Fill Transparency', defval: 50, min: 0, max: 100 },
  { id: 'bandTransparency', type: 'int', title: 'Band Gradient Transparency', defval: 40, min: 0, max: 100 },
  { id: 'showOverboughtGradient', type: 'bool', title: 'Show Overbought Gradient', defval: true },
  { id: 'showOversoldGradient', type: 'bool', title: 'Show Oversold Gradient', defval: true },
  { id: 'showFastBToZeroGradient', type: 'bool', title: 'Show Fast B to Zero Gradient', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Slow Line', color: 'rgb(6, 162, 47)', lineWidth: 3 },
  { id: 'plot1', title: 'Fast Line A', color: 'rgb(163, 231, 172)', lineWidth: 2 },
  { id: 'plot2', title: 'Fast Line B', color: 'rgb(6, 162, 47)', lineWidth: 2 },
  { id: 'plot3', title: 'Line 4', color: 'rgb(6, 162, 47)', lineWidth: 2 },
  { id: 'plot4', title: 'Intermediate Layer 1', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Intermediate Layer 2', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Intermediate Layer 3', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'Intermediate Layer 4', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Zero Line for Fill', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot9', title: 'Overbought Gradient', color: String(color.new(color.gray, 40)), lineWidth: 10 },
  { id: 'plot10', title: 'Oversold Gradient', color: String(color.new(color.gray, 40)), lineWidth: 10 },
  { id: 'plot11', title: 'Bullish Divergence', color: color.green, lineWidth: 2 },
  { id: 'plot12', title: 'Bearish Divergence', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'MPO4 Lines – Modal Engine',
  shortTitle: 'MPO4',
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
type Sma = ReturnType<typeof taStep.sma>;
type Ema = ReturnType<typeof taStep.ema>;

interface Mpo4Vars {
  /** Calls of the ta.barssince in _inRange (Pine v6 `and` is lazy) */
  plCalls: number;
  phCalls: number;
  /** var bool plFound / phFound / bullCond / bearCond */
  plFoundVar: boolean;
  phFoundVar: boolean;
  bullVar: boolean;
  bearVar: boolean;
}

/** calcCPO(_len, _smooth): the SMA of the bodies, the contributions of each bar and the EMA of the normalised sum */
interface Cpo {
  len: number;
  avgBody: Sma;
  ema: Ema;
  contrib: number[];
}

interface Mpo4Run extends BarRunState<Mpo4Vars> {
  cpo: Cpo[];
  line1Ema: Ema;
  pl: PivotStep;
  ph: PivotStep;
  line1: number[];
  line2: number[];
  line3: number[];
  line4: number[];
  plots: Point[][];
  /** plot11 / plot12: the value of bar i drawn on bar i - lb (no point for the first lb bars) */
  bullLine: Point[];
  bearLine: Point[];
  layers: string[][];
  fastAB: string[];
  /** ta.valuewhen(found, x, 1) histories */
  plOsc: number[];
  plLow: number[];
  phOsc: number[];
  phHigh: number[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<Mpo4LinesModalEngineInputs>): BarStudy<Mpo4Run, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const rangeUpper = 60;
  const rangeLower = 5;
  const lb = cfg.pivotLength;
  const showMid = cfg.showLine3 && cfg.showFastBToZeroGradient;
  const noDiv = String(color.new(color.white, 100));
  const gT = cfg.gradientTransparency;
  const buyColor = String(color.new(cfg.oversoldLineColor, 60));
  const sellColor = String(color.new(cfg.overboughtLineColor, 60));
  const bullLabel = String(color.new(cfg.bullDivColor, 40));
  const bearLabel = String(color.new(cfg.bearDivColor, 40));
  // Colours (color.new(c, 0))
  const c0 = (c: string) => String(color.new(c, 0));
  const cpo = (len: number, smooth: number): Cpo => ({ len, avgBody: taStep.sma(), ema: taStep.ema(smooth), contrib: [] });
  const cpoStep = (c: Cpo, i: number, bd: number, direction: number): number => {
    const avgBody = c.avgBody.step(bd, c.len);
    // weight = avgBody != 0 ? body / avgBody : 1.0 (na != 0 is false)
    c.contrib[i] = direction * (!isNaN(avgBody) && Math.abs(avgBody) > EPS ? bd / avgBody : 1.0);
    // rolling = sum of contrib[i] for i = 0 to _len - 1 (na before bar 0; the SMA has checked _len >= 1)
    const len = c.len;
    let rolling = 0.0;
    for (let k = 0; k <= len - 1; k++) rolling += i - k >= 0 ? c.contrib[i - k] : NaN;
    return c.ema.step((rolling / (len * 2)) * 100);
  };
  return {
    init() {
      const s: Mpo4Run = {
        cpo: [cpo(cfg.len1, cfg.smoothLen1), cpo(cfg.len2, cfg.smoothLen2), cpo(cfg.len3, cfg.smoothLen3), cpo(cfg.len4, cfg.smoothLen4)],
        line1Ema: taStep.ema(cfg.extraSmoothLen),
        pl: new PivotStep(lb, lb, false), ph: new PivotStep(lb, lb, true),
        line1: [], line2: [], line3: [], line4: [],
        plots: Array.from({ length: 11 }, () => []), bullLine: [], bearLine: [],
        layers: Array.from({ length: 5 }, () => []), fastAB: [],
        plOsc: [], plLow: [], phOsc: [], phHigh: [], markers: [],
        flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [],
        vars: { plCalls: NaN, phCalls: NaN, plFoundVar: false, phFoundVar: false, bullVar: false, bearVar: false },
        lists: [], series: [],
      };
      s.steps = [...s.cpo.flatMap((c) => [c.avgBody, c.ema]), s.line1Ema, s.pl, s.ph];
      s.lists = [s.plOsc, s.plLow, s.phOsc, s.phHigh, s.markers, ...s.times];
      s.series = [
        ...s.cpo.map((c) => c.contrib), s.line1, s.line2, s.line3, s.line4, ...s.plots, ...s.layers, s.fastAB, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time;
      const bd = Math.abs(b.close - b.open);
      const direction = gt(b.close, b.open) ? 1.0 : lt(b.close, b.open) ? -1.0 : 0.0;
      const line1Raw = cpoStep(s.cpo[0], i, bd, direction);
      const l1 = s.line1Ema.step(line1Raw);
      const l2 = cpoStep(s.cpo[1], i, bd, direction);
      const l3 = cpoStep(s.cpo[2], i, bd, direction);
      const l4 = cpoStep(s.cpo[3], i, bd, direction);
      s.line1[i] = l1;
      s.line2[i] = l2;
      s.line3[i] = l3;
      s.line4[i] = l4;
      const line1 = s.line1;
      const line2 = s.line2;

      const line1Color = cfg.slowColorMode === 'Position vs Zero'
        ? (ge(l1, 0) ? c0(cfg.line1ColorPositive) : c0(cfg.line1ColorNegative))
        : (gt(l1, i > 0 ? line1[i - 1] : NaN) ? c0(cfg.line1ColorPositive) : c0(cfg.line1ColorNegative));
      const line2Color = ge(l2, 0) ? c0(cfg.line2ColorPositive) : c0(cfg.line2ColorNegative);
      const line3Color = ge(l3, 0) ? c0(cfg.line3ColorPositive) : c0(cfg.line3ColorNegative);
      const line4Color = ge(l4, 0) ? c0(cfg.line4ColorPositive) : c0(cfg.line4ColorNegative);

      // Divergence on fast line A
      const o = i - lb >= 0 ? line2[i - lb] : NaN;
      if (cfg.calculateDivergence) {
        const pivotLowOsc = s.pl.step(i, l2);
        const pivotHighOsc = s.ph.step(i, l2);
        const lowLbr = i - lb >= 0 ? bars[i - lb].low : NaN;
        const highLbr = i - lb >= 0 ? bars[i - lb].high : NaN;

        // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
        // Pine v6 `and` is lazy: the ta.barssince inside _inRange(...) only runs on the bars where the left side
        // (oscLbr > ta.valuewhen(...)) is true, so it counts those calls. One state per call site.
        const prevPlFound = v.plFoundVar; // plFound[1]
        v.plFoundVar = !isNaN(pivotLowOsc);
        if (v.plFoundVar) {
          s.plOsc.push(o);
          s.plLow.push(lowLbr);
        }
        const vwPlOsc = s.plOsc.length >= 2 ? s.plOsc[s.plOsc.length - 2] : NaN;
        const vwPlLow = s.plLow.length >= 2 ? s.plLow[s.plLow.length - 2] : NaN;
        let oscHl = false;
        if (gt(o, vwPlOsc)) {
          if (prevPlFound) v.plCalls = 0;
          else if (!isNaN(v.plCalls)) v.plCalls++;
          oscHl = rangeLower <= v.plCalls && v.plCalls <= rangeUpper;
        }
        const priceLl = lt(lowLbr, vwPlLow);
        v.bullVar = priceLl && oscHl && v.plFoundVar;

        const prevPhFound = v.phFoundVar; // phFound[1]
        v.phFoundVar = !isNaN(pivotHighOsc);
        if (v.phFoundVar) {
          s.phOsc.push(o);
          s.phHigh.push(highLbr);
        }
        const vwPhOsc = s.phOsc.length >= 2 ? s.phOsc[s.phOsc.length - 2] : NaN;
        const vwPhHigh = s.phHigh.length >= 2 ? s.phHigh[s.phHigh.length - 2] : NaN;
        let oscLh = false;
        if (lt(o, vwPhOsc)) {
          if (prevPhFound) v.phCalls = 0;
          else if (!isNaN(v.phCalls)) v.phCalls++;
          oscLh = rangeLower <= v.phCalls && v.phCalls <= rangeUpper;
        }
        const priceHh = gt(highLbr, vwPhHigh);
        v.bearVar = priceHh && oscLh && v.phFoundVar;
      }
      const plFound = v.plFoundVar;
      const phFound = v.phFoundVar;
      const bullCond = v.bullVar;
      const bearCond = v.bearVar;

      const p = s.plots;
      p[0][i] = { time, value: cfg.showLine1 ? l1 : NaN, color: line1Color };
      p[1][i] = { time, value: cfg.showLine2 ? l2 : NaN, color: line2Color };
      p[2][i] = { time, value: cfg.showLine3 ? l3 : NaN, color: line3Color };
      p[3][i] = { time, value: cfg.showLine4 ? l4 : NaN, color: line4Color };
      // plot(showLine3 and showFastBToZeroGradient ? line3 * k : na, color = na, display = display.none)
      p[4][i] = { time, value: showMid ? l3 * 0.8 : NaN };
      p[5][i] = { time, value: showMid ? l3 * 0.6 : NaN };
      p[6][i] = { time, value: showMid ? l3 * 0.4 : NaN };
      p[7][i] = { time, value: showMid ? l3 * 0.2 : NaN };
      p[8][i] = { time, value: 0 };
      // plot(showOverboughtGradient ? overbought : na,
      //      color.new(line2 <= line3 ? overboughtLineColor : zeroLineColor, bandTransparency), linewidth = 10)
      p[9][i] = {
        time, value: cfg.showOverboughtGradient ? cfg.overbought : NaN,
        color: String(color.new(le(l2, l3) ? cfg.overboughtLineColor : cfg.zeroLineColor, cfg.bandTransparency)),
      };
      // plot(showOversoldGradient ? oversold : na, color.new(line2 > line3 ? oversoldLineColor : zeroLineColor, ...))
      p[10][i] = {
        time, value: cfg.showOversoldGradient ? cfg.oversold : NaN,
        color: String(color.new(gt(l2, l3) ? cfg.oversoldLineColor : cfg.zeroLineColor, cfg.bandTransparency)),
      };
      // plot(calculateDivergence and plFound ? oscLbr : na, offset = -lookbackRight,
      //      color = bullCond ? bullDivColor : color.new(color.white, 100)): the value of bar i is drawn on bar i - lb
      // (bar i is the only writer of that slot)
      if (i - lb >= 0) {
        const at = bars[i - lb].time;
        s.bullLine[i - lb] = { time: at, value: cfg.calculateDivergence && plFound ? o : NaN, color: bullCond ? cfg.bullDivColor : noDiv };
        s.bearLine[i - lb] = { time: at, value: cfg.calculateDivergence && phFound ? o : NaN, color: bearCond ? cfg.bearDivColor : noDiv };
      }

      // fillColor = line3 >= 0 ? color.new(line3ColorPositive, gradientTransparency) : color.new(line3ColorNegative, ...)
      for (let k = 0; k < 5; k++) {
        s.layers[k][i] = !showMid ? 'transparent'
          : k === 0 ? String(color.new(ge(l3, 0) ? cfg.line3ColorPositive : cfg.line3ColorNegative, gT))
            : String(color.new(line3Color, gT + k * 5));
      }
      // fill(plot_line2, plot_line3, showLine2 and showLine3 ? color.new(line2Color, line2Line3GradientTransparency) : na)
      s.fastAB[i] = cfg.showLine2 && cfg.showLine3 ? String(color.new(line2Color, cfg.line2Line3GradientTransparency)) : 'transparent';

      // ta.crossover(line2, oversold) / ta.crossunder(line2, overbought): exact comparisons (na compares false)
      const longSignal = i > 0 && l2 > cfg.oversold && line2[i - 1] <= cfg.oversold;
      const shortSignal = i > 0 && l2 < cfg.overbought && line2[i - 1] >= cfg.overbought;
      const L1 = (j: number) => (j >= 0 ? line1[j] : NaN);
      const f = s.flags;
      // supBuySignal / supSellSignal
      f[0][i] = cfg.showObosSignals && longSignal;
      f[1][i] = cfg.showObosSignals && shortSignal;
      // colorChangeDirection = slowColorMode == 'Direction' and (line1 > line1[1]) != (line1[1] > line1[2])
      f[2][i] = cfg.slowColorMode === 'Direction' && gt(L1(i), L1(i - 1)) !== gt(L1(i - 1), L1(i - 2));
      // colorChangePosition = slowColorMode == 'Position vs Zero' and (line1 >= 0) != (line1[1] >= 0)
      f[3][i] = cfg.slowColorMode === 'Position vs Zero' && ge(L1(i), 0) !== ge(L1(i - 1), 0);
      f[4][i] = bullCond;
      f[5][i] = bearCond;
      for (let k = 0; k < 6; k++) if (f[k][i]) s.times[k].push(time as number);
      // plotshape(supBuySignal ? line2 : na, location.bottom, color.new(oversoldLineColor, 60), shape.circle, size.tiny)
      if (cfg.showObosSignals && longSignal) {
        s.markers.push({ time, position: 'bottom', shape: 'circle', color: buyColor, size: 'tiny' });
      }
      // plotshape(supSellSignal ? line2 : na, location.top, color.new(overboughtLineColor, 60), shape.circle, size.tiny)
      if (cfg.showObosSignals && shortSignal) {
        s.markers.push({ time, position: 'top', shape: 'circle', color: sellColor, size: 'tiny' });
      }
      // plotshape(bullCond ? oscLbr : na, offset = -lookbackRight, text = ' Bull ', shape.labelup, location.absolute,
      //   color.new(bullDivColor, 40), textcolor = textColor, size.small)
      if (i - lb >= 0) {
        const price = o;
        if (bullCond && !isNaN(price)) {
          s.markers.push({ time: bars[i - lb].time, position: 'atPriceBottom', price, shape: 'labelUp',
            color: bullLabel, text: ' Bull ', textColor: cfg.textColor, size: 'small' });
        }
        if (bearCond && !isNaN(price)) {
          s.markers.push({ time: bars[i - lb].time, position: 'atPriceTop', price, shape: 'labelDown',
            color: bearLabel, text: ' Bear ', textColor: cfg.textColor, size: 'small' });
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      const shifted = Math.max(0, n - lb);
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      plots.plot11 = s.bullLine.slice(0, shifted);
      plots.plot12 = s.bearLine.slice(0, shifted);
      const fills = [
        { plot1: 'plot2', plot2: 'plot4', options: { title: 'Fill Layer 1' }, colors: s.layers[0].slice() },
        { plot1: 'plot4', plot2: 'plot5', options: { title: 'Fill Layer 2' }, colors: s.layers[1].slice() },
        { plot1: 'plot5', plot2: 'plot6', options: { title: 'Fill Layer 3' }, colors: s.layers[2].slice() },
        { plot1: 'plot6', plot2: 'plot7', options: { title: 'Fill Layer 4' }, colors: s.layers[3].slice() },
        { plot1: 'plot7', plot2: 'plot8', options: { title: 'Fill Layer 5' }, colors: s.layers[4].slice() },
        { plot1: 'plot1', plot2: 'plot2', options: { title: 'Fast A to B Fill' }, colors: s.fastAB.slice() },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots,
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: cfg.zeroLineColor, linestyle: 'dashed' } },
          { value: cfg.overbought, options: { title: 'Overbought', color: cfg.overboughtLineColor, linestyle: 'dashed' } },
          { value: cfg.oversold, options: { title: 'Oversold', color: cfg.oversoldLineColor, linestyle: 'dashed' } },
        ],
        fills,
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Mpo4LinesModalEngineInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Mpo4LinesModalEngineInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy: Fast A Return from Oversold', message: 'Fast Line A crossed above oversold level.' },
  { id: 'alert1', title: 'Sell: Fast A Return from Overbought', message: 'Fast Line A crossed below overbought level.' },
  { id: 'alert2', title: 'Slow Line Color Change (Direction Mode)', message: 'Slow Line changed direction.' },
  { id: 'alert3', title: 'Slow Line Color Change (Position vs Zero Mode)', message: 'Slow Line crossed zero level.' },
  { id: 'alert4', title: 'Bullish Divergence (Fast A)', message: 'Bullish divergence detected on Fast Line A.' },
  { id: 'alert5', title: 'Bearish Divergence (Fast A)', message: 'Bearish divergence detected on Fast Line A.' },
];

export const Mpo4LinesModalEngine = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
