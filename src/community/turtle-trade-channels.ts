/**
 * Turtle Trade Channels
 *
 * Classic Turtle Trading channel breakout system.
 * Entry channel: highest high / lowest low over entryLength bars.
 * Exit channel: highest high / lowest low over exitLength bars.
 *
 * Reference: "Turtle Trade Channels" by Richard Dennis / William Eckhardt
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TurtleTradeChannelsInputs {
  entryLength: number;
  exitLength: number;
}

export const defaultInputs: TurtleTradeChannelsInputs = {
  entryLength: 20,
  exitLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'entryLength', type: 'int', title: 'Entry Length', defval: 20, min: 1 },
  { id: 'exitLength', type: 'int', title: 'Exit Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Entry High', color: '#0094FF', lineWidth: 1 },
  { id: 'plot1', title: 'Entry Low', color: '#0094FF', lineWidth: 1 },
  { id: 'plot2', title: 'Exit High', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'Exit Low', color: '#FF6D00', lineWidth: 1 },
  { id: 'trendLine', title: 'Trend Line', color: '#FF0000', lineWidth: 2 },
  { id: 'exitLine', title: 'Exit Line', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Turtle Trade Channels',
  shortTitle: 'TTC',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface TurtleVars {
  /** Last bar where high >= up[1] / low <= down[1] */
  lastHighBreak: number;
  lastLowBreak: number;
  /** Last bars of the long / short entries and exits (the markers and the fill colour) */
  lastBuyEntry: number;
  lastSellEntry: number;
  lastBuyExit: number;
  lastSellExit: number;
}

interface TurtleRun extends BarRunState<TurtleVars> {
  entryHigh: WindowExtreme;
  entryLow: WindowExtreme;
  exitHigh: WindowExtreme;
  exitLow: WindowExtreme;
  entryHighArr: number[];
  entryLowArr: number[];
  exitHighArr: number[];
  exitLowArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  trendLine: Point[];
  exitLine: Point[];
  fillColors: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<TurtleTradeChannelsInputs>): BarStudy<TurtleRun, Result> {
  const { entryLength, exitLength } = { ...defaultInputs, ...inputs };
  const warmup = entryLength;
  return {
    init() {
      const s: TurtleRun = {
        entryHigh: new WindowExtreme(false, entryLength), entryLow: new WindowExtreme(true, entryLength),
        exitHigh: new WindowExtreme(false, exitLength), exitLow: new WindowExtreme(true, exitLength),
        entryHighArr: [], entryLowArr: [], exitHighArr: [], exitLowArr: [], plot0: [], plot1: [], plot2: [], plot3: [],
        trendLine: [], exitLine: [], fillColors: [], markers: [],
        steps: [],
        vars: {
          lastHighBreak: -Infinity, lastLowBreak: -Infinity, lastBuyEntry: -Infinity, lastSellEntry: -Infinity,
          lastBuyExit: -Infinity, lastSellExit: -Infinity,
        },
        lists: [], series: [],
      };
      s.steps = [s.entryHigh, s.entryLow, s.exitHigh, s.exitLow];
      s.lists = [s.markers];
      s.series = [
        s.entryHighArr, s.entryLowArr, s.exitHighArr, s.exitLowArr, s.plot0, s.plot1, s.plot2, s.plot3, s.trendLine,
        s.exitLine, s.fillColors,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const entryHigh = s.entryHigh.step(b.high);
      const entryLow = s.entryLow.step(b.low);
      const exitHigh = s.exitHigh.step(b.high);
      const exitLow = s.exitLow.step(b.low);
      s.entryHighArr[i] = entryHigh;
      s.entryLowArr[i] = entryLow;
      s.exitHighArr[i] = exitHigh;
      s.exitLowArr[i] = exitLow;

      // Compute K1 (Trend Line) and K2 (Exit Line) per Pine:
      // K1 = barssince(high>=up[1]) <= barssince(low<=down[1]) ? down : up
      // K2 = barssince(high>=up[1]) <= barssince(low<=down[1]) ? sdown : sup
      let k1 = NaN;
      let k2 = NaN;
      if (i >= warmup + 1) {
        const up1 = s.entryHighArr[i - 1];
        const down1 = s.entryLowArr[i - 1];
        if (b.high >= up1) v.lastHighBreak = i;
        if (b.low <= down1) v.lastLowBreak = i;
        const bsHigh = v.lastHighBreak >= 0 ? i - v.lastHighBreak : Infinity;
        const bsLow = v.lastLowBreak >= 0 ? i - v.lastLowBreak : Infinity;
        if (bsHigh <= bsLow) {
          // Long direction: trend line = entry low (down), exit line = exit low (sdown)
          k1 = entryLow;
          k2 = exitLow;
        } else {
          // Short direction: trend line = entry high (up), exit line = exit high (sup)
          k1 = entryHigh;
          k2 = exitHigh;
        }

        // Turtle signals with barssince logic:
        // buySignal = high >= upper[1], sellSignal = low <= lower[1]
        // buyExit = low <= exitLow[1], sellExit = high >= exitHigh[1]
        // Simplified: track last signal times for entry/exit filtering
        const buySignal = b.high >= up1;
        const sellSignal = b.low <= down1;
        const buyExit = b.low <= s.exitLowArr[i - 1];
        const sellExit = b.high >= s.exitHighArr[i - 1];

        // Pine: plotshape(buySignal and O3<O1[1] ? down : na) -- long entry if last buyExit before last buyEntry
        if (buySignal && v.lastBuyExit > v.lastBuyEntry) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Long' });
          v.lastBuyEntry = i;
        }
        if (sellSignal && v.lastSellExit > v.lastSellEntry) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Short' });
          v.lastSellEntry = i;
        }
        if (buyExit && v.lastBuyEntry > v.lastBuyExit) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#2196F3', text: 'Exit L' });
          v.lastBuyExit = i;
        }
        if (sellExit && v.lastSellEntry > v.lastSellExit) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#2196F3', text: 'Exit S' });
          v.lastSellExit = i;
        }
      }

      // Fill: Pine fills upper channel to exit line (green for long, red for short)
      // Determine fill color based on which entry signal is most recent
      if (i < warmup) {
        s.fillColors[i] = 'rgba(0,0,0,0)';
      } else if (v.lastBuyEntry > v.lastSellEntry && v.lastBuyEntry > v.lastBuyExit) {
        s.fillColors[i] = 'rgba(38,166,154,0.12)';
      } else if (v.lastSellEntry > v.lastBuyEntry && v.lastSellEntry > v.lastSellExit) {
        s.fillColors[i] = 'rgba(239,83,80,0.12)';
      } else {
        s.fillColors[i] = 'rgba(0,0,0,0)';
      }

      s.plot0[i] = { time, value: i < warmup || isNaN(entryHigh) ? NaN : entryHigh };
      s.plot1[i] = { time, value: i < warmup || isNaN(entryLow) ? NaN : entryLow };
      s.plot2[i] = { time, value: i < warmup || isNaN(exitHigh) ? NaN : exitHigh };
      s.plot3[i] = { time, value: i < warmup || isNaN(exitLow) ? NaN : exitLow };
      s.trendLine[i] = { time, value: isNaN(k1) ? NaN : k1 };
      s.exitLine[i] = { time, value: isNaN(k2) ? NaN : k2 };
    },
    result(s) {
      const fillColors = s.fillColors.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice(),
          'trendLine': s.trendLine.slice(), 'exitLine': s.exitLine.slice(),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(38,166,154,0.12)' }, colors: fillColors },
          { plot1: 'plot1', plot2: 'plot3', options: { color: 'rgba(239,83,80,0.12)' }, colors: fillColors },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TurtleTradeChannelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TurtleTradeChannelsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TurtleTradeChannels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
