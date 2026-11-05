/**
 * Volatility-Driven VWAP Structure
 *
 * A rolling VWAP of hlc3 over a fixed number of bars is followed by a stepped structure (an upper and a lower level
 * one step apart). The step is ATR(length) * multiplier * an adaptive factor 0.5 + 1.5 * sigmoid(4 * (fast ATR /
 * slow ATR - 1) + 0.75 * clamped z-score of the fast ATR). When the rolling VWAP moves more than one step beyond the
 * structure, the structure jumps by a whole number of steps and takes the direction of the move. The structure mean
 * is plotted in the direction colour. On each direction change a VWAP of hlc3 is anchored again, with two standard
 * deviation bands filled around it.
 * Alerts (alertcondition, `alerts` of the result): structure shifts / reversals, closes crossing the anchored VWAP and
 * the structure mean, and touches of the four deviation bands (computed whether the bands are shown or not).
 *
 * Reference: "Volatility-Driven VWAP Structure (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolatilityDrivenVWAPStructureInputs {
  /** Number of bars of the rolling VWAP */
  vwapLengthInput: number;
  /** Multiplier of the adaptive volatility step */
  structureMultInput: number;
  /** ATR length of the volatility step (the slow ATR uses 4 times this length) */
  atrLength: number;
  /** Show the first deviation band of the anchored VWAP */
  showBand1: boolean;
  /** Show the second deviation band of the anchored VWAP */
  showBand2: boolean;
  /** Multiplier of the first deviation band */
  bandMult1: number;
  /** Multiplier of the second deviation band */
  bandMult2: number;
  /** Bullish colour */
  bullColorInput: string;
  /** Bearish colour */
  bearColorInput: string;
}

export const defaultInputs: VolatilityDrivenVWAPStructureInputs = {
  vwapLengthInput: 200,
  structureMultInput: 1.5,
  atrLength: 14,
  showBand1: true,
  showBand2: true,
  bandMult1: 1.0,
  bandMult2: 2.0,
  bullColorInput: '#00e676',
  bearColorInput: '#f23645',
};

export const inputConfig: InputConfig[] = [
  { id: 'vwapLengthInput', type: 'int', title: 'Rolling VWAP Length', defval: 200, min: 1 },
  { id: 'structureMultInput', type: 'float', title: 'Structure Multiplier', defval: 1.5, min: 0.1, step: 0.1 },
  { id: 'atrLength', type: 'int', title: 'Volatility Length', defval: 14, min: 1 },
  { id: 'showBand1', type: 'bool', title: 'Show Band 1', defval: true },
  { id: 'showBand2', type: 'bool', title: 'Show Band 2', defval: true },
  { id: 'bandMult1', type: 'float', title: 'Band 1 Multiplier', defval: 1.0, step: 0.1 },
  { id: 'bandMult2', type: 'float', title: 'Band 2 Multiplier', defval: 2.0, step: 0.1 },
  { id: 'bullColorInput', type: 'color', title: 'Bullish Color', defval: '#00e676' },
  { id: 'bearColorInput', type: 'color', title: 'Bearish Color', defval: '#f23645' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP Structure Mean', color: '#00e676', lineWidth: 3 },
  { id: 'plot1', title: 'Reversal Anchored VWAP', color: '#00e676', lineWidth: 2 },
  { id: 'plot2', title: 'Anchored VWAP Upper 1', color: '#00e676', lineWidth: 1 },
  { id: 'plot3', title: 'Anchored VWAP Lower 1', color: '#00e676', lineWidth: 1 },
  { id: 'plot4', title: 'Anchored VWAP Upper 2', color: '#00e676', lineWidth: 1 },
  { id: 'plot5', title: 'Anchored VWAP Lower 2', color: '#00e676', lineWidth: 1 },
];

export const metadata = {
  title: 'Volatility-Driven VWAP Structure',
  shortTitle: 'VD VWAP Structure',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a != b: |a - b| > 1e-10 (false with na) */
const ne = (a: number, b: number) => Math.abs(a - b) > 1e-10;
/** Pine a >= b: not (b - a > 1e-10) (false with na) */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);
/** Pine division: x / 0 is na */
const div = (a: number, b: number) => (b === 0 ? NaN : a / b);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface VdVwapVars {
  structureUpper: number; // var float structureUpper = na
  structureLower: number; // var float structureLower = na
  dir: number; // var int direction = 0
  anchorSumPV: number;
  anchorSumV: number;
  anchorSumP2V: number;
}

interface VdVwapRun extends BarRunState<VdVwapVars> {
  sumPV: ReturnType<typeof taStep.sum>;
  sumV: ReturnType<typeof taStep.sum>;
  atrFast: ReturnType<typeof taStep.atr>;
  atrSlow: ReturnType<typeof taStep.atr>;
  atrMean: ReturnType<typeof taStep.sma>;
  atrDev: ReturnType<typeof taStep.stdev>;
  mid: number[];
  anchored: number[];
  plots: Point[][];
  fill1: string[];
  fill2: string[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolatilityDrivenVWAPStructureInputs>): BarStudy<VdVwapRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { vwapLengthInput, structureMultInput, atrLength, showBand1, showBand2, bandMult1, bandMult2 } = cfg;
  // plotColor = anchorColor = direction == 1 ? bullColorInput : bearColorInput; color.new(anchorColor, transp)
  const shades = (col: string) => ({
    0: String(color.new(col, 0)), 30: String(color.new(col, 30)), 55: String(color.new(col, 55)),
    92: String(color.new(col, 92)), 95: String(color.new(col, 95)),
  });
  const bullShades = shades(cfg.bullColorInput);
  const bearShades = shades(cfg.bearColorInput);
  const le = (a: number, b: number) => ge(b, a);
  const flags = new Array<boolean>(11).fill(false);
  return {
    init() {
      const sumPV = taStep.sum();
      const sumV = taStep.sum();
      const atrFast = taStep.atr(atrLength);
      const atrSlow = taStep.atr(atrLength * 4);
      const atrMean = taStep.sma();
      const atrDev = taStep.stdev();
      const s: VdVwapRun = {
        sumPV, sumV, atrFast, atrSlow, atrMean, atrDev,
        mid: [], anchored: [],
        plots: Array.from({ length: 6 }, () => []),
        fill1: [], fill2: [],
        flags: Array.from({ length: 11 }, () => []),
        times: Array.from({ length: 11 }, () => []),
        steps: [sumPV, sumV, atrFast, atrSlow, atrMean, atrDev],
        vars: { structureUpper: NaN, structureLower: NaN, dir: 0, anchorSumPV: NaN, anchorSumV: NaN, anchorSumP2V: NaN },
        lists: [], series: [],
      };
      s.lists = [...s.times];
      s.series = [s.mid, s.anchored, ...s.plots, s.fill1, s.fill2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      // src = hlc3; rollingVwap = math.sum(src * volume, len) / math.sum(volume, len)
      const src = (b.high + b.low + b.close) / 3;
      const vol = b.volume ?? NaN;
      const rollingVwap = div(s.sumPV.step(src * vol, vwapLengthInput), s.sumV.step(vol, vwapLengthInput));
      // atrFast = ta.atr(len); atrSlow = ta.atr(len * 4); mean / stdev of atrFast over vwapLength * 4 bars
      const atrFast = s.atrFast.step(b.high, b.low, b.close);
      const atrSlow = s.atrSlow.step(b.high, b.low, b.close);
      const atrMean = s.atrMean.step(atrFast, vwapLengthInput * 4);
      const atrDev = s.atrDev.step(atrFast, vwapLengthInput * 4);
      // atrZ = atrDev != 0 ? (atrFast - atrMean) / atrDev : 0.0 (na != 0 is false: 0.0 while atrDev is na)
      const atrZ = ne(atrDev, 0) ? div(atrFast - atrMean, atrDev) : 0.0;
      const atrZClamped = Math.max(Math.min(atrZ, 3.0), -3.0);
      // volRatio = atrSlow != 0 ? atrFast / atrSlow : 1.0
      const volRatio = ne(atrSlow, 0) ? div(atrFast, atrSlow) : 1.0;
      const sigmoidInput = 4.0 * (volRatio - 1.0) + 0.75 * atrZClamped;
      const sigmoid = 1.0 / (1.0 + Math.exp(-sigmoidInput));
      const adaptiveVolMult = 0.5 + sigmoid * 1.5;
      const structureStep = atrFast * structureMultInput * adaptiveVolMult;
      const vw = rollingVwap;
      const prevDir = v.dir;
      const structureReady = !isNaN(vw) && !isNaN(structureStep) && gt(structureStep, 0);
      if (structureReady) {
        if (isNaN(v.structureUpper)) {
          v.structureUpper = vw;
          v.structureLower = vw - structureStep;
          v.dir = 1;
        } else {
          const upsideExpansion = vw - (v.structureUpper + structureStep);
          const downsideExpansion = (v.structureLower - structureStep) - vw;
          const expandsHigher = gt(upsideExpansion, 0);
          const expandsLower = gt(downsideExpansion, 0);
          const nextDirection = expandsHigher ? 1 : expandsLower ? -1 : v.dir;
          if (expandsHigher || expandsLower) {
            const referenceLevel = nextDirection === 1 ? v.structureUpper : v.structureLower;
            const travelDistance = Math.abs(vw - referenceLevel);
            const transitionSteps = Math.floor(div(travelDistance, structureStep));
            if (nextDirection === 1) {
              v.structureLower = v.structureUpper + (transitionSteps - 1) * structureStep;
              v.structureUpper = v.structureUpper + transitionSteps * structureStep;
            } else {
              v.structureUpper = v.structureLower - (transitionSteps - 1) * structureStep;
              v.structureLower = v.structureLower - transitionSteps * structureStep;
            }
            v.dir = nextDirection;
          }
        }
      }
      // structureMid = (structureUpper + structureLower) / 2.0
      const mid = (v.structureUpper + v.structureLower) / 2.0;
      s.mid[i] = mid;
      const direction = v.dir;

      // Reversal anchored VWAP: sums reset when ta.change(direction) != 0 (na on the first bar: false) or na(anchorSumPV)
      const isReversed = i > 0 && direction - prevDir !== 0;
      if (isReversed || isNaN(v.anchorSumPV)) {
        v.anchorSumPV = src * vol;
        v.anchorSumV = vol;
        v.anchorSumP2V = src * src * vol;
      } else {
        v.anchorSumPV += src * vol;
        v.anchorSumV += vol;
        v.anchorSumP2V += src * src * vol;
      }
      // anchoredVwap = anchorSumV != 0 ? anchorSumPV / anchorSumV : na
      const vwapA = ne(v.anchorSumV, 0) ? v.anchorSumPV / v.anchorSumV : NaN;
      const anchoredVar = ne(v.anchorSumV, 0) ? v.anchorSumP2V / v.anchorSumV - Math.pow(vwapA, 2) : NaN;
      const dev = !isNaN(anchoredVar) ? Math.sqrt(Math.max(anchoredVar, 0)) : NaN;
      s.anchored[i] = vwapA;

      const sh = direction === 1 ? bullShades : bearShades;
      // plot(structureMid, color = plotColor, linestyle = plot.linestyle_dotted, linewidth = 3)
      s.plots[0][i] = { time, value: mid, color: direction === 1 ? cfg.bullColorInput : cfg.bearColorInput };
      // plot(anchoredVwap, color = color.new(anchorColor, 0), linewidth = 2)
      s.plots[1][i] = { time, value: vwapA, color: sh[0] };
      // anchorUpperK = anchoredVwap + anchoredDev * bandMultK; anchorLowerK = anchoredVwap - anchoredDev * bandMultK
      // plot(showBand1 ? anchorUpper1 / anchorLower1 : na, color = color.new(anchorColor, 30))
      s.plots[2][i] = { time, value: !showBand1 ? NaN : vwapA + dev * bandMult1, color: sh[30] };
      s.plots[3][i] = { time, value: !showBand1 ? NaN : vwapA - dev * bandMult1, color: sh[30] };
      // plot(showBand2 ? anchorUpper2 / anchorLower2 : na, color = color.new(anchorColor, 55))
      s.plots[4][i] = { time, value: !showBand2 ? NaN : vwapA + dev * bandMult2, color: sh[55] };
      s.plots[5][i] = { time, value: !showBand2 ? NaN : vwapA - dev * bandMult2, color: sh[55] };
      // fill(aU1, aL1, color.new(anchorColor, 92)); fill(aU2, aL2, color.new(anchorColor, 95))
      s.fill1[i] = sh[92];
      s.fill2[i] = sh[95];

      // Alerts: bullishShift / bearishShift = isReversed and direction == 1 / -1; ta.crossover / ta.crossunder of close
      // with anchoredVwap and structureMid; high >= anchorUpperK, low <= anchorLowerK
      const c = b.close;
      const pc = i > 0 ? bars[i - 1].close : NaN;
      const pa = i > 0 ? s.anchored[i - 1] : NaN;
      const pm = i > 0 ? s.mid[i - 1] : NaN;
      flags[0] = isReversed && direction === 1;
      flags[1] = isReversed && direction === -1;
      flags[2] = isReversed;
      flags[3] = c > vwapA && pc <= pa;
      flags[4] = c < vwapA && pc >= pa;
      flags[5] = c > mid && pc <= pm;
      flags[6] = c < mid && pc >= pm;
      flags[7] = ge(b.high, vwapA + 1 * dev * bandMult1);
      flags[8] = le(b.low, vwapA + -1 * dev * bandMult1);
      flags[9] = ge(b.high, vwapA + 1 * dev * bandMult2);
      flags[10] = le(b.low, vwapA + -1 * dev * bandMult2);
      for (let k = 0; k < 11; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(), plot4: s.plots[4].slice(), plot5: s.plots[5].slice(),
        },
        fills: [
          { plot1: 'plot2', plot2: 'plot3', colors: s.fill1.slice() },
          { plot1: 'plot4', plot2: 'plot5', colors: s.fill2.slice() },
        ],
        markers: [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolatilityDrivenVWAPStructureInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolatilityDrivenVWAPStructureInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish VWAP Structure Shift', message: 'Volatility-Driven VWAP Structure shifted bullish.' },
  { id: 'alert1', title: 'Bearish VWAP Structure Shift', message: 'Volatility-Driven VWAP Structure shifted bearish.' },
  { id: 'alert2', title: 'Any VWAP Structure Reversal', message: 'VWAP structure reversal detected.' },
  { id: 'alert3', title: 'Close Crossed Above Anchored VWAP', message: 'Price crossed above the reversal-anchored VWAP.' },
  { id: 'alert4', title: 'Close Crossed Below Anchored VWAP', message: 'Price crossed below the reversal-anchored VWAP.' },
  { id: 'alert5', title: 'Close Crossed Above VWAP Structure Mean', message: 'Price crossed above the VWAP structure mean.' },
  { id: 'alert6', title: 'Close Crossed Below VWAP Structure Mean', message: 'Price crossed below the VWAP structure mean.' },
  { id: 'alert7', title: 'Price Touched Upper Band 1', message: 'Price touched the first upper anchored VWAP deviation band.' },
  { id: 'alert8', title: 'Price Touched Lower Band 1', message: 'Price touched the first lower anchored VWAP deviation band.' },
  { id: 'alert9', title: 'Price Touched Upper Band 2', message: 'Price touched the second upper anchored VWAP deviation band.' },
  { id: 'alert10', title: 'Price Touched Lower Band 2', message: 'Price touched the second lower anchored VWAP deviation band.' },
];

export const VolatilityDrivenVWAPStructure = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
