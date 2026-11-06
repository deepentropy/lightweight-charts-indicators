/**
 * Three-Bar Reversal/Continuation
 *
 * Bar strength 0 to 3: one point each when the bar range, the volume and range * volume are above `coeff` times
 * their `length`-bar simple averages. Strength dots at the bottom of the chart (white 1, yellow 2, lime 3).
 * Pattern: the bar two bars back has a strength of at least `detectLevel` (and the bar before it is not also that
 * strong with the same direction), the previous bar has strength 0, and the current bar has a larger range or a
 * larger volume than the previous bar. Bullish: a green bar with a higher high that closes above hl2; bearish: a
 * red bar with a lower low that closes below hl2. Without continuation, a bullish signal needs a `length`-bar
 * lowest low on one of the last 3 bars and a bearish signal a `length`-bar highest high.
 *
 * Alerts (alert() calls, `alertCalls` of the result): "Bullish R/C Detected" on a bullish signal, else "Bearish R/C
 * Detected" on a bearish signal; once per bar when the bar's volume and range are above their averages, once per bar
 * close otherwise.
 *
 * Reference: "Three-Bar Reversal/Continuation" by abuzka
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData, AlertCall } from '../types';

export interface ThreeBarReversalContinuationInputs {
  /** Period of the averages and of the lowest / highest window */
  length: number;
  /** Coefficient applied to the averages */
  coeff: number;
  /** Strength needed on the signal bar (1 to 3) */
  detectLevel: number;
  /** Char of the bullish signal */
  symbolUp: string;
  /** Char of the bearish signal */
  symbolDown: string;
  /** Show continuation signals (no lowest / highest filter) */
  showCont: boolean;
  /** Show the strength dots */
  showStrength: boolean;
  /** Colour of the signal chars */
  plotColor: string;
}

export const defaultInputs: ThreeBarReversalContinuationInputs = {
  length: 10,
  coeff: 2,
  detectLevel: 3,
  symbolUp: '⇧',
  symbolDown: '⇩',
  showCont: true,
  showStrength: true,
  plotColor: color.aqua,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Period', defval: 10, min: 1, step: 1 },
  { id: 'coeff', type: 'float', title: 'Coefficient', defval: 2, min: 0.1, step: 0.1 },
  { id: 'detectLevel', type: 'int', title: 'Detection Level', defval: 3, min: 1, max: 3, step: 1 },
  { id: 'symbolUp', type: 'string', title: 'Symbol Up', defval: '⇧', options: ['⇧', '↑', '▲', '⇑'] },
  { id: 'symbolDown', type: 'string', title: 'Symbol Down', defval: '⇩', options: ['⇩', '↓', '▼', '⇓'] },
  { id: 'showCont', type: 'bool', title: 'Show Continuation', defval: true },
  { id: 'showStrength', type: 'bool', title: 'Show Strength Dots', defval: true },
  { id: 'plotColor', type: 'color', title: 'Signal Color', defval: color.aqua },
];

// No plot(): the outputs are plotchar markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Three-Bar Reversal/Continuation',
  shortTitle: 'Three-Bar Reversal/Continuation',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] };

interface ThreeBarRun extends BarRunState<Record<string, never>> {
  avgRange: WindowSma;
  avgVolume: WindowSma;
  avgRngVol: WindowSma;
  lowest: WindowExtreme;
  highest: WindowExtreme;
  strength: number[];
  isLowest: boolean[];
  isHighest: boolean[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<ThreeBarReversalContinuationInputs>): BarStudy<ThreeBarRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, coeff, detectLevel, symbolUp, symbolDown, showCont, showStrength, plotColor } = cfg;
  const white = color.white;
  const yellow = color.yellow;
  const lime = color.lime;
  const barColor = (b: Bar) => gt(b.open, b.close); // open > close
  return {
    init() {
      const avgRange = new WindowSma(length);
      const avgVolume = new WindowSma(length);
      const avgRngVol = new WindowSma(length);
      const lowest = new WindowExtreme(true, length);
      const highest = new WindowExtreme(false, length);
      const s: ThreeBarRun = {
        avgRange, avgVolume, avgRngVol, lowest, highest, strength: [], isLowest: [], isHighest: [], markers: [],
        alertCalls: [],
        steps: [avgRange, avgVolume, avgRngVol, lowest, highest], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls];
      s.series = [s.strength, s.isLowest, s.isHighest];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const volume = b.volume ?? NaN;
      const barRange = b.high - b.low;
      const rngVol = barRange * volume;
      const avgRange = s.avgRange.step(barRange);
      const avgVolume = s.avgVolume.step(volume);
      const avgRngVol = s.avgRngVol.step(rngVol);
      const lowest = s.lowest.step(b.low);
      const highest = s.highest.step(b.high);

      const condRange = gt(barRange, coeff * avgRange) ? 1 : 0;
      const condVol = gt(volume, coeff * avgVolume) ? 1 : 0;
      const condRngVol = gt(rngVol, coeff * avgRngVol) ? 1 : 0;
      const strength = condRange + condVol + condRngVol;
      s.strength[i] = strength;

      // plotchar(strength == k and showStrength, char = ".", location = location.bottom, size = size.tiny)
      // `id`: the plotchar output (char0 to char4 in declaration order)
      if (showStrength && strength >= 1 && strength <= 3) {
        const c = strength === 1 ? white : strength === 2 ? yellow : lime;
        s.markers.push({ time: t, position: 'bottom', shape: 'circle', color: 'transparent', text: '.', textColor: c, size: 'tiny',
          id: `char${strength - 1}` });
      }

      // strength[k] / barRange[1] / volume[1] before the first bar are na (comparisons false); bool history is false
      const b1 = i >= 1 ? bars[i - 1] : undefined;
      const s1 = i >= 1 ? s.strength[i - 1] : NaN;
      const s2 = i >= 2 ? s.strength[i - 2] : NaN;
      const s3 = i >= 3 ? s.strength[i - 3] : NaN;
      const bc2 = i >= 2 ? barColor(bars[i - 2]) : false;
      const bc3 = i >= 3 ? barColor(bars[i - 3]) : false;
      const range1 = b1 ? b1.high - b1.low : NaN;
      const vol1 = b1 ? b1.volume ?? NaN : NaN;
      const high1 = b1 ? b1.high : NaN;
      const low1 = b1 ? b1.low : NaN;
      const validPattern = !(s3 >= detectLevel && bc3 === bc2)
        && s2 >= detectLevel && s1 === 0
        && (gt(barRange, range1) || gt(volume, vol1));

      const hl2 = (b.high + b.low) / 2;
      let bullCond = gt(b.close, b.open) && gt(b.high, high1) && gt(b.close, hl2) && validPattern;
      let bearCond = lt(b.close, b.open) && lt(b.low, low1) && lt(b.close, hl2) && validPattern;

      const isLowest = eq(lowest, b.low);
      s.isLowest[i] = isLowest;
      const lo1 = i >= 1 ? s.isLowest[i - 1] : false;
      const lo2 = i >= 2 ? s.isLowest[i - 2] : false;
      if (!(isLowest || lo1 || lo2) && !showCont) bullCond = false;

      const isHighest = eq(highest, b.high);
      s.isHighest[i] = isHighest;
      const hi1 = i >= 1 ? s.isHighest[i - 1] : false;
      const hi2 = i >= 2 ? s.isHighest[i - 2] : false;
      if (!(isHighest || hi1 || hi2) && !showCont) bearCond = false;

      // plotchar(bullCond, char = symbolUp, location = location.belowbar, color = plotColor, size = size.tiny)
      if (bullCond) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'circle', color: 'transparent', text: symbolUp,
          textColor: plotColor, size: 'tiny', id: 'char3' });
      }
      // plotchar(bearCond, char = symbolDown, location = location.abovebar, color = plotColor, size = size.tiny)
      if (bearCond) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: 'transparent', text: symbolDown,
          textColor: plotColor, size: 'tiny', id: 'char4' });
      }

      // reqConfirm = volume > avgVolume and barRange > avgRange; alert() on bullCond, else on bearCond
      const reqConfirm = gt(volume, avgVolume) && gt(barRange, avgRange);
      const freq = reqConfirm ? 'once_per_bar' : 'once_per_bar_close';
      if (bullCond) s.alertCalls.push({ time: t, message: 'Bullish R/C Detected', freq });
      else if (bearCond) s.alertCalls.push({ time: t, message: 'Bearish R/C Detected', freq });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ThreeBarReversalContinuationInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ThreeBarReversalContinuationInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const hasAlertFunction = true;

export const ThreeBarReversalContinuation = {
  calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction,
};
