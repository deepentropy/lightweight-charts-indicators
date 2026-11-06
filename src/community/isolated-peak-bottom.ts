/**
 * Isolated Peak and Bottom (Tuncer SENGOZ)
 *
 * Detects 4 specific isolated peak/bottom patterns using bar-offset comparisons:
 *   - Peak Type 1 (PEAK2): high[2] is highest of bars 0..4, confirmed by low breakdown
 *   - Peak Type 2 (PEAK1): high[1] is highest of bars 0..3, confirmed by low breakdown
 *   - Bottom Type 1 (BOT2): low[2] is lowest of bars 0..4, confirmed by high breakout
 *   - Bottom Type 2 (BOT1): low[1] is lowest of bars 0..3, confirmed by high breakout
 * Alerts (alertcondition, `alerts` of the result, on the bar that confirms the pattern): 'SELL Alarm' ISOPEAK 1
 * (PEAK2) and ISOPEAK 2 (PEAK1), 'BUY Alarm' ISOBOTTOM 1 (BOT2) and ISOBOTTOM 2, which the original also gives on
 * BOT2 (its condition is the same as ISOBOTTOM 1).
 * Each pattern is tested on every bar with the original's history (na compares false): PEAK1 / BOT1 read 3 bars
 * back and can show from bar 3, PEAK2 / BOT2 read 4 bars back and can show from bar 4; the labels are drawn with the
 * original's offsets (-1 / -2 bars).
 *
 * Reference: "Isolated Peak and Bottom" (community) by KivancOzbilgic
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IsolatedPeakBottomInputs {
  // No user-configurable inputs in the original PineScript
}

export const defaultInputs: IsolatedPeakBottomInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Isolated Peak and Bottom',
  shortTitle: 'ISOPB',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface IpbRun extends BarRunState<Record<string, never>> {
  plot0: { time: number; value: number }[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(): BarStudy<IpbRun, Result> {
  const green = '#4CAF50', red = '#F23645';
  return {
    init() {
      const s: IpbRun = {
        plot0: [], markers: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      s.plot0[i] = { time: bars[i].time, value: NaN };
      // The original's conditions on every bar (na history compares false)
      const hi = (k: number) => (k >= 0 ? bars[k].high : NaN);
      const lo = (k: number) => (k >= 0 ? bars[k].low : NaN);
      // izotepe1 = high[2] > high and high[2] >= high[1] and high[2] > high[3] and high[2] > high[4]
      //            and low[1] > math.min(low[3], low[2]) and low < math.min(low[3], low[2])
      const minL = Math.min(lo(i - 3), lo(i - 2));
      const peak1 = hi(i - 2) > hi(i) && hi(i - 2) >= hi(i - 1) && hi(i - 2) > hi(i - 3) && hi(i - 2) > hi(i - 4)
        && lo(i - 1) > minL && lo(i) < minL;
      // izotepe2 = high[1] > high and high[1] > high[2] and high[1] > high[3] and low < math.min(low[2], low[1])
      const peak2 = hi(i - 1) > hi(i) && hi(i - 1) > hi(i - 2) && hi(i - 1) > hi(i - 3) && lo(i) < Math.min(lo(i - 2), lo(i - 1));
      // izodip1 = low[2] < low and low[2] < low[1] and low[2] < low[3] and low[2] < low[4]
      //           and high[1] < math.max(high[3], high[2]) and high > math.max(high[3], high[2])
      const maxH = Math.max(hi(i - 3), hi(i - 2));
      const bot1 = lo(i - 2) < lo(i) && lo(i - 2) < lo(i - 1) && lo(i - 2) < lo(i - 3) && lo(i - 2) < lo(i - 4)
        && hi(i - 1) < maxH && hi(i) > maxH;
      // izodip2 = low[1] < low and low[1] < low[2] and low[1] < low[3] and high > math.max(high[2], high[1])
      const bot2 = lo(i - 1) < lo(i) && lo(i - 1) < lo(i - 2) && lo(i - 1) < lo(i - 3) && hi(i) > Math.max(hi(i - 2), hi(i - 1));

      // plotshape(izodip1, 'BOT2', offset = -2), plotshape(izodip2, 'BOT1', offset = -1),
      // plotshape(izotepe1, 'PEAK2', offset = -2), plotshape(izotepe2, 'PEAK1', offset = -1)
      if (bot1) s.markers.push({ id: 'shape0', time: bars[i - 2].time, position: 'belowBar', shape: 'labelUp', color: green, text: 'BOT2', textColor: '#FFFFFF', size: 'tiny' });
      if (bot2) s.markers.push({ id: 'shape1', time: bars[i - 1].time, position: 'belowBar', shape: 'labelUp', color: green, text: 'BOT1', textColor: '#FFFFFF', size: 'tiny' });
      if (peak1) s.markers.push({ id: 'shape2', time: bars[i - 2].time, position: 'aboveBar', shape: 'labelDown', color: red, text: 'PEAK2', textColor: '#FFFFFF', size: 'tiny' });
      if (peak2) s.markers.push({ id: 'shape3', time: bars[i - 1].time, position: 'aboveBar', shape: 'labelDown', color: red, text: 'PEAK1', textColor: '#FFFFFF', size: 'tiny' });

      // alertcondition(bool(izotepe1)), alertcondition(bool(izotepe2)), alertcondition(bool(izodip1)) twice
      const flags = [peak1, peak2, bot1, bot1];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(bars[i].time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<IsolatedPeakBottomInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<IsolatedPeakBottomInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(_inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'SELL Alarm', message: 'ISOPEAK 1!' },
  { id: 'alert1', title: 'SELL Alarm', message: 'ISOPEAK 2!' },
  { id: 'alert2', title: 'BUY Alarm', message: 'ISOBOTTOM 1!' },
  { id: 'alert3', title: 'BUY Alarm', message: 'ISOBOTTOM 2!' },
];

export const IsolatedPeakBottom = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
