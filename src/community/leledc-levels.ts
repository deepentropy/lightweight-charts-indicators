/**
 * Leledc Levels
 *
 * Bar counting method for exhaustion detection.
 * Counts consecutive bars closing above/below close[4].
 * When counter reaches length, signals potential exhaustion (top/bottom).
 * Alerts (alertcondition, `alerts` of the result): 'Up' and 'Down', true on the bars of a bullish / bearish exhaustion.
 *
 * Reference: "Leledc Levels" (community)
 */

import type { IndicatorResult, InputConfig, PlotConfig, Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LeledcLevelsInputs {
  length: number;
  bars: number;
}

export const defaultInputs: LeledcLevelsInputs = {
  length: 40,
  bars: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Swing Length', defval: 40, min: 1 },
  { id: 'bars', type: 'int', title: 'Exhaustion Bar Count', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
  { id: 'plot1', title: 'Resistance Level', color: '#FF0000', lineWidth: 2 },
  { id: 'plot2', title: 'Support Level', color: '#138484', lineWidth: 2 },
];

export const metadata = {
  title: 'Leledc Levels',
  shortTitle: 'Leledc',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface LeledcVars {
  bindex: number;
  sindex: number;
  resistance: number;
  support: number;
}

interface LeledcRun extends BarRunState<LeledcVars> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LeledcLevelsInputs>): BarStudy<LeledcRun, Result> {
  const { length, bars: barCount } = { ...defaultInputs, ...inputs };
  const lookback = 4;
  return {
    init() {
      // Track highest high over length for exhaustion condition
      const highest = new WindowExtreme(false, length);
      const lowest = new WindowExtreme(true, length);
      const s: LeledcRun = {
        highest, lowest, plot0: [], plot1: [], plot2: [], markers: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [highest, lowest], vars: { bindex: 0, sindex: 0, resistance: NaN, support: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const hh = s.highest.step(b.high);
      const ll = s.lowest.step(b.low);
      s.plot0[i] = { time, value: NaN };
      // alertcondition(lowlel, "Up") / alertcondition(highlel, "Down"): lowlel = Lelex == 1 ? low : na (a non-zero value)
      s.flags[0][i] = false;
      s.flags[1][i] = false;
      if (i < lookback) {
        s.plot1[i] = { time, value: NaN };
        s.plot2[i] = { time, value: NaN };
        return;
      }

      const close = b.close;
      const open = b.open;
      const high = b.high;
      const low = b.low;
      const closePrev = bars[i - lookback].close;

      // Pine: bindex increments when close > close[4]
      if (close > closePrev) v.bindex++;
      if (close < closePrev) v.sindex++;

      let lelex = 0;
      // Pine: bearish exhaustion: bindex > bars AND close < open AND high >= highest(high, len)
      if (v.bindex > barCount && close < open && high >= hh) {
        v.bindex = 0;
        lelex = -1;
      }
      // Pine: bullish exhaustion: sindex > bars AND close > open AND low <= lowest(low, len)
      if (v.sindex > barCount && close > open && low <= ll) {
        v.sindex = 0;
        lelex = 1;
      }

      const up = lelex === 1 && !isNaN(low) && low !== 0;
      const down = lelex === -1 && !isNaN(high) && high !== 0;
      s.flags[0][i] = up;
      s.flags[1][i] = down;
      if (up) s.times[0].push(time as number);
      if (down) s.times[1].push(time as number);

      // Markers for exhaustion arrows
      if (lelex === -1) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'Top' });
        s.barColors.push({ time, color: '#EF5350' });
      } else if (lelex === 1) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'Bot' });
        s.barColors.push({ time, color: '#26A69A' });
      } else {
        const bullish = close > closePrev;
        s.barColors.push({ time, color: bullish ? 'rgba(38,166,154,0.3)' : 'rgba(239,83,80,0.3)' });
      }

      // Pine: resistance := close < open and Lelex ? high : resistance[1]
      if (close < open && lelex !== 0) {
        v.resistance = high;
      }
      // Pine: support := close > open and Lelex ? low : support[1]
      if (close > open && lelex !== 0) {
        v.support = low;
      }

      s.plot1[i] = { time, value: isNaN(v.resistance) ? NaN : v.resistance };
      s.plot2[i] = { time, value: isNaN(v.support) ? NaN : v.support };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LeledcLevelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LeledcLevelsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions (no message: the default one) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Up', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Down', message: 'Alert Fired!' },
];

export const LeledcLevels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
