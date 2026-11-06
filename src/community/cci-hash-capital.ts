/**
 * CCI Pro (Hash Capital Research)
 *
 * A smoothed CCI: rawCCI = (src - sma(src, length)) / (0.015 * dev(src, length)), cci = ema(ema(rawCCI, smoothing), 2).
 * The line colour follows the CCI: green for a positive CCI, red for a negative one, brighter and more opaque as
 * |cci| / 150 grows (scaled by the colour intensity). A wide glow line (green / red, more opaque past +-100) and
 * a fill to zero draw the CCI as an area; fills past +100 / -100 shade the extreme zones. With the divergence
 * option, regular bullish (CCI higher low, price lower low) and bearish (CCI lower high, price higher high)
 * divergences between 5 / 5 pivots are drawn on the pivot bar with Bull / Bear labels.
 * Alerts (alertcondition, `alerts` of the result): 'Strong Buy' / 'Strong Sell' (CCI beyond 0.8 x the extreme level,
 * 1.3 x the adaptive level 100 + 0.3 x stdev(cci, 30), as the momentum crosses zero), 'Buy Signal' / 'Sell Signal'
 * (CCI beyond the adaptive level x sensitivity / 10 with momentum and velocity turning back) and the two divergences.
 *
 * Reference: "CCI [Hash Adaptive]" by Hash_Capital
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taCore, taStep, math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CciHashCapitalInputs {
  /** CCI period */
  length: number;
  src: SourceType;
  /** EMA length of the first smoothing */
  smoothing: number;
  /** Calculate the divergences (Bull / Bear lines and labels) */
  calculateDivergence: boolean;
  /** Colour intensity (1-10) */
  colorIntensity: number;
  showGlowEffect: boolean;
  /** Glow intensity (1-10) */
  glowIntensity: number;
  /** Signal sensitivity (1-10): the Buy / Sell Signal alerts */
  signalSensitivity: number;
}

export const defaultInputs: CciHashCapitalInputs = {
  length: 20,
  src: 'hlc3',
  smoothing: 5,
  calculateDivergence: false,
  colorIntensity: 7.0,
  showGlowEffect: true,
  glowIntensity: 5.0,
  signalSensitivity: 6.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'CCI Period', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
  { id: 'smoothing', type: 'int', title: 'Smoothing', defval: 5, min: 1, max: 10 },
  { id: 'calculateDivergence', type: 'bool', title: 'Calculate Divergence', defval: false },
  { id: 'colorIntensity', type: 'float', title: 'Color Intensity', defval: 7.0, min: 1.0, max: 10.0, step: 1.0 },
  { id: 'showGlowEffect', type: 'bool', title: 'Glow Effect', defval: true },
  { id: 'glowIntensity', type: 'float', title: 'Glow Intensity', defval: 5.0, min: 1.0, max: 10.0, step: 1.0 },
  { id: 'signalSensitivity', type: 'float', title: 'Signal Sensitivity', defval: 6.0, min: 1.0, max: 10, step: 1.0 },
];

const WHITE_100 = String(color.new(color.white, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CCI Main Line', color: '#00FF00', lineWidth: 2 },
  { id: 'plot1', title: 'CCI Glow Effect', color: '#00FF00', lineWidth: 5 },
  { id: 'plot2', title: 'Zero Reference', color: WHITE_100 },
  { id: 'plot3', title: 'Upper Extreme Area', color: WHITE_100, display: 'none' },
  { id: 'plot4', title: 'Lower Extreme Area', color: WHITE_100, display: 'none' },
  { id: 'plot5', title: 'Regular Bullish', color: '#00FF00', lineWidth: 2, display: 'pane' },
  { id: 'plot6', title: 'Regular Bearish', color: '#FF0000', lineWidth: 2, display: 'pane' },
];

export const metadata = {
  title: 'CCI Pro [Hash Capital Research]',
  shortTitle: 'CCI Pro',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface CciRun extends BarRunState<Record<string, never>> {
  ma: WindowSma;
  /** The source of each bar (the window of ta.dev) */
  src: number[];
  ema1: Ma;
  ema2: Ma;
  vol: WindowStdev;
  pl: PivotStep;
  ph: PivotStep;
  barsBull: ReturnType<typeof taStep.barssince>;
  barsBear: ReturnType<typeof taStep.barssince>;
  vwBullCci: ReturnType<typeof taStep.valuewhen>;
  vwBullLow: ReturnType<typeof taStep.valuewhen>;
  vwBearCci: ReturnType<typeof taStep.valuewhen>;
  vwBearHigh: ReturnType<typeof taStep.valuewhen>;
  cci: number[];
  momentum: number[];
  plFound: boolean[];
  phFound: boolean[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
  plot5: Point[];
  plot6: Point[];
  fill0: string[];
  fill1: string[];
  fill2: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CciHashCapitalInputs>): BarStudy<CciRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);

  // getAdaptiveColor(): green spectrum for a positive CCI, red spectrum for a negative one
  const colorScale = cfg.colorIntensity / 10.0;
  const adaptiveColor = (c: number): string => {
    const normalizedCci = Math.max(-1.0, Math.min(1.0, c / 150));
    if (ge(normalizedCci, 0)) {
      const intensity = math.pow(normalizedCci, 0.5) * colorScale;
      const redVal = math.round(100 * (1 - intensity));
      const blueVal = math.round(100 * (1 - intensity * 0.7));
      const alpha = Math.max(0, math.round(30 * (1 - intensity)));
      return String(color.rgb(redVal, 255, blueVal, alpha));
    }
    const intensity = math.pow(Math.abs(normalizedCci), 0.5) * colorScale;
    const greenVal = math.round(100 * (1 - intensity));
    const blueVal = math.round(100 * (1 - intensity * 0.7));
    const alpha = Math.max(0, math.round(30 * (1 - intensity)));
    return String(color.rgb(255, greenVal, blueVal, alpha));
  };
  // getGlowColor(): brighter past +-100; na when the glow is off
  const glowScale = cfg.glowIntensity / 10.0;
  const glowColor = (c: number): string => {
    if (!cfg.showGlowEffect) return 'transparent';
    const baseIntensity = Math.abs(c) / 120;
    const isExtreme = gt(c, 100) || lt(c, -100);
    const intensityBoost = isExtreme ? 1.5 : 1.0;
    const glowAlpha = math.round(100 - baseIntensity * 60 * glowScale * intensityBoost);
    return String(color.new(ge(c, 0) ? '#00FF00' : '#FF0000', Math.max(30, glowAlpha)));
  };

  // Divergences (5 / 5 pivots of the CCI; the previous pivot 5 to 60 bars back)
  const lookbackRight = 5;
  const lookbackLeft = 5;
  const rangeUpper = 60;
  const rangeLower = 5;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const bullColor = String(color.new('#00FF00', 0));
  const bearColor = String(color.new('#FF0000', 0));
  const overColor = String(color.new('#00FF00', 90));
  const underColor = String(color.new('#FF0000', 90));
  const signalMultiplier = cfg.signalSensitivity / 10.0;
  const devLen = Math.floor(cfg.length);

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const ma = new WindowSma(cfg.length);
      // the length check of ta.dev (the same runtime error)
      taCore.dev([], cfg.length);
      const ema1 = taStep.ema(cfg.smoothing);
      const ema2 = taStep.ema(2);
      const vol = new WindowStdev(30);
      const pl = new PivotStep(lookbackLeft, lookbackRight, false);
      const ph = new PivotStep(lookbackLeft, lookbackRight, true);
      const barsBull = taStep.barssince();
      const barsBear = taStep.barssince();
      const vwBullCci = taStep.valuewhen(1);
      const vwBullLow = taStep.valuewhen(1);
      const vwBearCci = taStep.valuewhen(1);
      const vwBearHigh = taStep.valuewhen(1);
      const div = cfg.calculateDivergence ? [pl, ph, barsBull, barsBear, vwBullCci, vwBullLow, vwBearCci, vwBearHigh] : [];
      const s: CciRun = {
        ma, src: [], ema1, ema2, vol, pl, ph, barsBull, barsBear, vwBullCci, vwBullLow, vwBearCci, vwBearHigh,
        cci: [], momentum: [], plFound: [], phFound: [],
        plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], plot5: [], plot6: [], fill0: [], fill1: [], fill2: [],
        markers: [], flags: [[], [], [], [], [], []], times: [[], [], [], [], [], []],
        steps: [ma, ema1, ema2, vol, ...div], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [
        s.src, s.cci, s.momentum, s.plFound, s.phFound, s.plot0, s.plot1, s.plot2, s.plot3, s.plot4, s.plot5, s.plot6,
        s.fill0, s.fill1, s.fill2, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // Smoothed CCI
      const sv = value(b);
      const ma = s.ma.step(sv);
      // ta.dev(src, length): the mean absolute deviation from the sma of the last `length` values (this bar first)
      const srcs = s.src;
      srcs[i] = sv;
      let deviation = NaN;
      if (i >= devLen - 1 && !Number.isNaN(ma)) {
        let sum = 0;
        for (let k = 0; k < devLen; k++) sum += Math.abs(srcs[i - k] - ma);
        deviation = sum / devLen;
      }
      // A plain division: x / 0 is +-infinity (ta.ema skips it as na), 0 / 0 is na
      const rawCci = (sv - ma) / (0.015 * deviation);
      const cci1 = s.ema1.step(rawCci);
      const cci = s.ema2.step(cci1);
      s.cci[i] = cci;

      const cciLbr = i >= lookbackRight ? s.cci[i - lookbackRight] : NaN;
      let plFound = false;
      let phFound = false;
      let bullCond = false;
      let bearCond = false;
      if (cfg.calculateDivergence) {
        const lowLbr = i >= lookbackRight ? bars[i - lookbackRight].low : NaN;
        const highLbr = i >= lookbackRight ? bars[i - lookbackRight].high : NaN;
        plFound = !isNaN(s.pl.step(i, cci));
        phFound = !isNaN(s.ph.step(i, cci));
        // _inRange(found[1]): rangeLower <= ta.barssince(found[1]) <= rangeUpper
        const barsBull = s.barsBull.step(i > 0 && s.plFound[i - 1]);
        const barsBear = s.barsBear.step(i > 0 && s.phFound[i - 1]);
        const vwBullCci = s.vwBullCci.step(plFound, cciLbr);
        const vwBullLow = s.vwBullLow.step(plFound, lowLbr);
        const vwBearCci = s.vwBearCci.step(phFound, cciLbr);
        const vwBearHigh = s.vwBearHigh.step(phFound, highLbr);
        const inRangeBull = rangeLower <= barsBull && barsBull <= rangeUpper;
        const cciHl = gt(cciLbr, vwBullCci) && inRangeBull;
        const priceLl = lt(lowLbr, vwBullLow);
        bullCond = priceLl && cciHl && plFound;
        const inRangeBear = rangeLower <= barsBear && barsBear <= rangeUpper;
        const cciLh = lt(cciLbr, vwBearCci) && inRangeBear;
        const priceHh = gt(highLbr, vwBearHigh);
        bearCond = priceHh && cciLh && phFound;
      }
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;

      const c = fin(cci);
      const adaptive = adaptiveColor(cci);
      s.plot0[i] = { time, value: c, color: adaptive };
      s.plot1[i] = { time, value: c, color: glowColor(cci) };
      s.plot2[i] = { time, value: 0 };
      // plot(cci > 100 ? cci : 100) / plot(cci < -100 ? cci : -100), display = display.none
      s.plot3[i] = { time, value: gt(cci, 100) ? c : 100 };
      s.plot4[i] = { time, value: lt(cci, -100) ? c : -100 };
      // offset = -lookbackRight: the value of bar i is drawn on bar i - 5 (bar i is the only writer of that slot)
      if (i >= lookbackRight) {
        const at = bars[i - lookbackRight].time;
        const v = fin(cciLbr);
        s.plot5[i - lookbackRight] = { time: at, value: plFound ? v : NaN, color: bullCond ? bullColor : WHITE_100 };
        s.plot6[i - lookbackRight] = { time: at, value: phFound ? v : NaN, color: bearCond ? bearColor : WHITE_100 };
        if (bullCond && !isNaN(v)) {
          s.markers.push({ time: at, position: 'atPriceBottom', price: v, shape: 'labelUp', color: bullColor,
            text: ' Bull ', textColor: color.black });
        }
        if (bearCond && !isNaN(v)) {
          s.markers.push({ time: at, position: 'atPriceTop', price: v, shape: 'labelDown', color: bearColor,
            text: ' Bear ', textColor: color.white });
        }
      }
      // fill(cciMainLine, zeroLinePlot, color.new(getAdaptiveColor(), 85)) and the extreme zones
      s.fill0[i] = String(color.new(adaptive, 85));
      s.fill1[i] = gt(cci, 100) ? overColor : 'transparent';
      s.fill2[i] = lt(cci, -100) ? underColor : 'transparent';

      // Signals: momentum = ta.change(cci), velocity = ta.change(momentum), adaptive levels 100 + 0.3 x ta.stdev(cci, 30)
      const momentum = i > 0 ? cci - s.cci[i - 1] : NaN;
      s.momentum[i] = momentum;
      const prevMomentum = i > 0 ? s.momentum[i - 1] : NaN;
      const velocity = i > 0 ? momentum - prevMomentum : NaN;
      const volatility = s.vol.step(cci);
      const momentumCrossUp = momentum > 0 && prevMomentum <= 0;
      const momentumCrossDown = momentum < 0 && prevMomentum >= 0;
      const upperLevel = 100 + volatility * 0.3;
      const lowerLevel = -100 - volatility * 0.3;
      const extremeUpper = upperLevel * 1.3;
      const extremeLower = lowerLevel * 1.3;
      // extremeOversoldReversal, extremeOverboughtReversal, oversoldReversal, overboughtReversal, bullCond, bearCond
      const f0 = lt(cci, extremeLower * 0.8) && momentumCrossUp;
      const f1 = gt(cci, extremeUpper * 0.8) && momentumCrossDown;
      const f2 = lt(cci, lowerLevel * signalMultiplier) && gt(momentum, 0) && gt(velocity, 0);
      const f3 = gt(cci, upperLevel * signalMultiplier) && lt(momentum, 0) && lt(velocity, 0);
      s.flags[0][i] = f0;
      s.flags[1][i] = f1;
      s.flags[2][i] = f2;
      s.flags[3][i] = f3;
      s.flags[4][i] = bullCond;
      s.flags[5][i] = bearCond;
      if (f0) s.times[0].push(time as number);
      if (f1) s.times[1].push(time as number);
      if (f2) s.times[2].push(time as number);
      if (f3) s.times[3].push(time as number);
      if (bullCond) s.times[4].push(time as number);
      if (bearCond) s.times[5].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const shifted = Math.max(0, n - lookbackRight);
      const lineColor = String(color.new(color.white, 50));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(),
          plot4: s.plot4.slice(), plot5: s.plot5.slice(0, shifted), plot6: s.plot6.slice(0, shifted),
        },
        hlines: [
          { value: 0, options: { title: 'Zero', color: lineColor, linestyle: 'solid', linewidth: 1 } },
          { value: 100, options: { title: 'Extreme Overbought', color: lineColor, linestyle: 'dotted', linewidth: 2 } },
          { value: -100, options: { title: 'Extreme Oversold', color: lineColor, linestyle: 'dotted', linewidth: 2 } },
        ],
        fills: [
          // fill(cciMainLine, zeroLinePlot, color.new(getAdaptiveColor(), 85))
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'CCI Area Fill' }, colors: s.fill0.slice() },
          { plot1: 'plot0', plot2: 'plot3', options: { title: 'Overbought Extreme Zone' }, colors: s.fill1.slice() },
          { plot1: 'plot0', plot2: 'plot4', options: { title: 'Oversold Extreme Zone' }, colors: s.fill2.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CciHashCapitalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CciHashCapitalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}
/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Strong Buy', message: 'Extreme oversold reversal signal' },
  { id: 'alert1', title: 'Strong Sell', message: 'Extreme overbought reversal signal' },
  { id: 'alert2', title: 'Buy Signal', message: 'Oversold reversal detected' },
  { id: 'alert3', title: 'Sell Signal', message: 'Overbought reversal detected' },
  { id: 'alert4', title: 'Bullish Divergence', message: 'Bullish Divergence detected on CCI - Potential reversal UP' },
  { id: 'alert5', title: 'Bearish Divergence', message: 'Bearish Divergence detected on CCI - Potential reversal DOWN' },
];

export const CciHashCapital = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
