/**
 * OBV MACD Indicator
 *
 * Applies MACD calculation to On Balance Volume instead of price.
 * MACD Line = EMA(OBV, fast) - EMA(OBV, slow)
 * Signal = EMA(MACD, signal)
 * Histogram = MACD - Signal
 *
 * Reference: community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface OBVMACDInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  showSignal: boolean;
}

export const defaultInputs: OBVMACDInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  showSignal: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'showSignal', type: 'bool', title: 'Show Cross Signals', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend', color: '#2962FF', lineWidth: 4 },
  { id: 'plot1', title: 'Up Signal', color: '#2962FF', lineWidth: 4, style: 'cross' },
  { id: 'plot2', title: 'Down Signal', color: '#FF0000', lineWidth: 4, style: 'cross' },
];

export const metadata = {
  title: 'OBV MACD',
  shortTitle: 'OBVMACD',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface ObvMacdRun extends BarRunState<{ obvCum: number }> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  histArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<OBVMACDInputs>): BarStudy<ObvMacdRun, Result> {
  const { fastLength, slowLength, signalLength, showSignal } = { ...defaultInputs, ...inputs };
  const lookback = 5;
  return {
    init() {
      const fast = taStep.ema(fastLength);
      const slow = taStep.ema(slowLength);
      const sig = taStep.ema(signalLength);
      const s: ObvMacdRun = {
        fast, slow, sig, histArr: [], plot0: [], plot1: [], plot2: [], markers: [],
        steps: [fast, slow, sig], vars: { obvCum: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.histArr, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      // Compute OBV
      if (i > 0) {
        const vol = bars[i].volume ?? 0;
        if (bars[i].close > bars[i - 1].close) s.vars.obvCum += vol;
        else if (bars[i].close < bars[i - 1].close) s.vars.obvCum -= vol;
      }
      const obv = s.vars.obvCum;
      const macdLine = s.fast.step(obv) - s.slow.step(obv);
      const signalLine = s.sig.step(macdLine);
      const histArr = s.histArr;
      histArr[i] = macdLine - signalLine;
      const v = histArr[i];

      // oc: 1=uptrend (MACD > signal), -1=downtrend
      const h0 = v ?? 0;
      const oc = h0 >= 0 ? 1 : -1;

      // b5 = macd - signal (same as histogram), colored by trend direction
      s.plot0[i] = { time, value: v ?? NaN, color: oc === 1 ? '#2962FF' : '#FF0000' };

      // Cross signals: up when histogram crosses above 0, down when crosses below
      if (!showSignal || i < 1) {
        s.plot1[i] = { time, value: NaN };
        s.plot2[i] = { time, value: NaN };
      } else {
        const prev = histArr[i - 1] ?? 0;
        const cur = v ?? 0;
        const up = prev <= 0 && cur > 0;
        s.plot1[i] = { time, value: up ? cur : NaN };
        const down = prev >= 0 && cur < 0;
        s.plot2[i] = { time, value: down ? cur : NaN };
      }

      // Pivot markers: the bar lookback bars back, once its right side is known
      const p = i - lookback;
      if (p >= lookback) {
        const h = histArr[p] ?? 0;
        let isHigh = true;
        let isLow = true;
        for (let j = 1; j <= lookback; j++) {
          if ((histArr[p - j] ?? 0) >= h || (histArr[p + j] ?? 0) >= h) isHigh = false;
          if ((histArr[p - j] ?? 0) <= h || (histArr[p + j] ?? 0) <= h) isLow = false;
        }
        if (isHigh && h > 0) {
          s.markers.push({ time: bars[p].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Pivot' });
        }
        if (isLow && h < 0) {
          s.markers.push({ time: bars[p].time, position: 'belowBar', shape: 'labelUp', color: '#2962FF', text: 'Pivot' });
        }
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        hlines: [{ value: 0, options: { color: '#000000', linestyle: 'solid', linewidth: 3, title: 'Zero' } }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OBVMACDInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<OBVMACDInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const OBVMACD = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
