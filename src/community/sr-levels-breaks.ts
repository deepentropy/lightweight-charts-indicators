/**
 * Support and Resistance Levels with Breaks
 *
 * Pivot-based S/R with break detection.
 * Resistance = fixnan(pivothigh(leftBars, rightBars)[1]), Support = fixnan(pivotlow(leftBars, rightBars)[1]).
 * Breaks: crossover(close, resistance) / crossunder(close, support). The volume filter
 * (osc > volumeThresh) applies only to the 'B' labels; the wick labels have no volume filter.
 * Alerts (alertcondition, `alerts` of the result): 'Support Broken' (crossunder(close, support) and osc > volumeThresh)
 * and 'Resistance Broken' (crossover(close, resistance) and osc > volumeThresh), not gated by Show Breaks.
 *
 * Reference: "Support and Resistance Levels with Breaks" [LuxAlgo] (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SRLevelsBreaksInputs {
  toggleBreaks: boolean;
  leftBars: number;
  rightBars: number;
  volumeThresh: number;
}

export const defaultInputs: SRLevelsBreaksInputs = {
  toggleBreaks: true,
  leftBars: 15,
  rightBars: 15,
  volumeThresh: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'toggleBreaks', type: 'bool', title: 'Show Breaks', defval: true },
  { id: 'leftBars', type: 'int', title: 'Left Bars ', defval: 15 },
  { id: 'rightBars', type: 'int', title: 'Right Bars', defval: 15 },
  { id: 'volumeThresh', type: 'int', title: 'Volume Threshold', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: '#FF0000', lineWidth: 3 },
  { id: 'plot1', title: 'Support', color: '#233dee', lineWidth: 3 },
];

export const metadata = {
  title: 'Support and Resistance Levels with Breaks',
  shortTitle: 'S/R Breaks',
  overlay: true,
};

// Pine v4 color constants
const RED = '#FF5252';
const GREEN = '#4CAF50';

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface SrVars {
  lastHigh: number;
  lastLow: number;
}

interface SrRun extends BarRunState<SrVars> {
  ema5: ReturnType<typeof taStep.ema>;
  ema10: ReturnType<typeof taStep.ema>;
  phStep: PivotStep;
  plStep: PivotStep;
  phArr: number[];
  plArr: number[];
  highUse: number[];
  lowUse: number[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SRLevelsBreaksInputs>): BarStudy<SrRun, Result> {
  const { toggleBreaks, leftBars, rightBars, volumeThresh } = { ...defaultInputs, ...inputs };
  // Pine: plot(level, color = change(level) ? na : col, offset = -(rightBars + 1)).
  // The value of bar j is drawn at bar j - (rightBars + 1); on the bars where the level changes the colour is na
  // (value kept, drawn transparent).
  const shift = rightBars + 1;
  return {
    init() {
      const ema5 = taStep.ema(5);
      const ema10 = taStep.ema(10);
      const phStep = new PivotStep(leftBars, rightBars, true);
      const plStep = new PivotStep(leftBars, rightBars, false);
      const s: SrRun = {
        ema5, ema10, phStep, plStep, phArr: [], plArr: [], highUse: [], lowUse: [], plot0: [], plot1: [], markers: [],
        flags: [[], []], times: [[], []],
        steps: [ema5, ema10, phStep, plStep], vars: { lastHigh: NaN, lastLow: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.phArr, s.plArr, s.highUse, s.lowUse, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = s.vars;
      // Pine: osc = 100 * (ema(volume, 5) - ema(volume, 10)) / ema(volume, 10)  (na while the emas are na)
      const volume = b.volume ?? NaN;
      const e5 = s.ema5.step(volume) ?? NaN;
      const e10 = s.ema10.step(volume) ?? NaN;
      const osc = 100 * (e5 - e10) / e10;

      s.phArr[i] = s.phStep.step(i, b.high);
      s.plArr[i] = s.plStep.step(i, b.low);
      // Pine: highUsePivot = fixnan(pivothigh(leftBars, rightBars)[1]); lowUsePivot = fixnan(pivotlow(leftBars, rightBars)[1])
      const ph = i > 0 ? s.phArr[i - 1]! : NaN;
      const pl = i > 0 ? s.plArr[i - 1]! : NaN;
      if (ph != null && !isNaN(ph)) v.lastHigh = ph;
      if (pl != null && !isNaN(pl)) v.lastLow = pl;
      s.highUse[i] = v.lastHigh;
      s.lowUse[i] = v.lastLow;

      let supportBroken = false;
      let resistanceBroken = false;
      if (i >= 1) {
        const { open, high, low, close } = b;
        const prevClose = bars[i - 1]!.close;
        // Pine crossover / crossunder: false when a value is na
        const crossOver = close > s.highUse[i]! && prevClose <= s.highUse[i - 1]!;
        const crossUnder = close < s.lowUse[i]! && prevClose >= s.lowUse[i - 1]!;
        const volPass = osc > volumeThresh;
        // alertcondition(crossunder(close, lowUsePivot) and osc > volumeThresh, "Support Broken")
        // alertcondition(crossover(close, highUsePivot) and osc > volumeThresh, "Resistance Broken")
        supportBroken = crossUnder && volPass;
        resistanceBroken = crossOver && volPass;
        if (toggleBreaks) {
          // Pine plotshape(..., style = shape.labeldown / labelup, color = color.red / color.green,
          //   textcolor = color.white, size = size.tiny)
          // For breaks with volume
          if (crossUnder && !(open - close < high - open) && volPass) {
            s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: RED, text: 'B', id: 'shape0', textColor: '#FFFFFF', size: 'tiny' });
          }
          if (crossOver && !(open - low > close - open) && volPass) {
            s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: GREEN, text: 'B', id: 'shape1', textColor: '#FFFFFF', size: 'tiny' });
          }
          // For bull / bear wicks (no volume filter)
          if (crossOver && open - low > close - open) {
            s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: GREEN, text: 'Bull Wick', id: 'shape2', textColor: '#FFFFFF', size: 'tiny' });
          }
          if (crossUnder && open - close < high - open) {
            s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: RED, text: 'Bear Wick', id: 'shape3', textColor: '#FFFFFF', size: 'tiny' });
          }
        }
      }
      const flags = [supportBroken, resistanceBroken];
      for (let k = 0; k < 2; k++) {
        s.flags[k]![i] = flags[k]!;
        if (flags[k]) s.times[k]!.push(b.time as number);
      }

      // the level plots: bar i is the only writer of its own slot (na until a later bar writes it) and of the slot
      // shift bars back, written on every run
      s.plot0[i] = { time: b.time, value: NaN };
      s.plot1[i] = { time: b.time, value: NaN };
      const k = i - shift;
      if (k >= 0) {
        const time = bars[k]!.time;
        const level = (arr: number[], col: string): Point => {
          const changed = i > 0 && arr[i]! - arr[i - 1]! !== 0 && !isNaN(arr[i]! - arr[i - 1]!);
          return { time, value: arr[i]!, color: changed ? 'transparent' : col };
        };
        s.plot0[k] = level(s.highUse, '#FF0000');
        s.plot1[k] = level(s.lowUse, '#233dee');
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SRLevelsBreaksInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SRLevelsBreaksInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Support Broken', message: 'Support Broken' },
  { id: 'alert1', title: 'Resistance Broken', message: 'Resistance Broken' },
];

export const SRLevelsBreaks = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
