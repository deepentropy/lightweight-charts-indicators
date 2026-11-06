/**
 * TonyUX EMA Scalper - Buy / Sell
 *
 * Pine: overlay=true, 3 plots + buy/sell markers:
 *   1) EMA(close, 20) in blue
 *   2) highest(close, 8) in red (linewidth=2)
 *   3) lowest(close, 8) in green (linewidth=2)
 *   Buy arrow: cross(close, EMA) and close[1] < close (bullish cross)
 *   Sell arrow: cross(close, EMA) and close[1] > close (bearish cross)
 *
 * Reference: "Tony's EMA Scalper - Buy / Sell" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TonyUXScalperInputs {
  emaLength: number;
  channelLength: number;
}

export const defaultInputs: TonyUXScalperInputs = {
  emaLength: 20,
  channelLength: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 20, min: 1 },
  { id: 'channelLength', type: 'int', title: 'Channel Length', defval: 8, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ema', title: 'EMA', color: '#2962FF', lineWidth: 1 },
  { id: 'highChannel', title: 'High Channel', color: '#EF5350', lineWidth: 2 },
  { id: 'lowChannel', title: 'Low Channel', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'TonyUX EMA Scalper',
  shortTitle: 'TUX EMA Scalper',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Point = { time: number; value: number };

interface ScalperRun extends BarRunState<{ prevEma: number }> {
  ema: ReturnType<typeof taStep.ema>;
  high: WindowExtreme;
  low: WindowExtreme;
  emaPlot: Point[];
  highPlot: Point[];
  lowPlot: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<TonyUXScalperInputs>): BarStudy<ScalperRun, Result> {
  const { emaLength, channelLength } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(emaLength, channelLength);
  return {
    init() {
      const ema = taStep.ema(emaLength);
      const high = new WindowExtreme(false, channelLength);
      const low = new WindowExtreme(true, channelLength);
      const s: ScalperRun = {
        ema, high, low, emaPlot: [], highPlot: [], lowPlot: [], markers: [], steps: [ema, high, low],
        vars: { prevEma: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.emaPlot, s.highPlot, s.lowPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;
      const emaVal = s.ema.step(c);
      const hi = s.high.step(c);
      const lo = s.low.step(c);
      s.emaPlot[i] = { time: b.time, value: i < emaLength ? NaN : emaVal };
      s.highPlot[i] = { time: b.time, value: i < channelLength ? NaN : hi };
      s.lowPlot[i] = { time: b.time, value: i < channelLength ? NaN : lo };
      const prevEma = s.vars.prevEma;
      s.vars.prevEma = emaVal;

      // Buy/Sell markers: cross(close, EMA) means close crosses EMA in either direction
      // bearish = cross(close, out) == 1 and close[1] > close  (price fell through EMA)
      // bullish = cross(close, out) == 1 and close[1] < close  (price rose through EMA)
      if (i < warmup + 1) return;
      const pc = bars[i - 1].close;

      // cross(): true when the two series cross (either direction)
      const crossed = (pc <= prevEma && c > emaVal) || (pc >= prevEma && c < emaVal) ||
                      (pc < prevEma && c >= emaVal) || (pc > prevEma && c <= emaVal);

      if (crossed) {
        if (pc > c) {
          // bearish: close[1] > close
          s.markers.push({ time: b.time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
        } else if (pc < c) {
          // bullish: close[1] < close
          s.markers.push({ time: b.time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Buy' });
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { ema: s.emaPlot.slice(), highChannel: s.highPlot.slice(), lowChannel: s.lowPlot.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TonyUXScalperInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TonyUXScalperInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TonyUXScalper = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
