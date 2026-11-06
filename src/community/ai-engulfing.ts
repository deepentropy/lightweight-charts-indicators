/**
 * AI-EngulfingCandle
 *
 * Engulfing candlestick pattern detection with SMA trend context.
 * Bullish engulfing in downtrend, bearish engulfing in uptrend.
 *
 * Reference: "AI-EngulfingCandle" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AIEngulfingInputs {
  trendLen: number;
}

export const defaultInputs: AIEngulfingInputs = {
  trendLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'trendLen', type: 'int', title: 'Trend Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'AI Engulfing Candle',
  shortTitle: 'AIEngulf',
  overlay: true,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface AieRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  plot0: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<AIEngulfingInputs>): BarStudy<AieRun, Result> {
  const { trendLen } = { ...defaultInputs, ...inputs };
  const warmup = trendLen;
  return {
    init() {
      const sma = new WindowSma(trendLen);
      const s: AieRun = { sma, plot0: [], markers: [], steps: [sma], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const curr = bars[i];
      const sma = s.sma.step(curr.close);
      if (i < warmup || isNaN(sma)) {
        s.plot0[i] = { time: curr.time, value: NaN };
        return;
      }
      s.plot0[i] = { time: curr.time, value: sma };
      const prev = bars[i - 1];

      const prevBearish = prev.close < prev.open;
      const currBullish = curr.close > curr.open;
      const bullishEngulfing = prevBearish && currBullish && curr.open <= prev.close && curr.close >= prev.open;

      const prevBullish = prev.close > prev.open;
      const currBearish = curr.close < curr.open;
      const bearishEngulfing = prevBullish && currBearish && curr.open >= prev.close && curr.close <= prev.open;

      if (bullishEngulfing && curr.close < sma) {
        s.markers.push({ time: curr.time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Bull' });
      }
      if (bearishEngulfing && curr.close > sma) {
        s.markers.push({ time: curr.time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Bear' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AIEngulfingInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AIEngulfingInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}


export const AIEngulfing = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
