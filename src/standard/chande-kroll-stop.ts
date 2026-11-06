/**
 * Chande Kroll Stop Indicator
 *
 * ATR-based trailing stop system that identifies potential stop levels
 * for both long and short positions.
 *
 * Based on the standard Chande Kroll Stop indicator.
 */

import { taStep, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ChandeKrollStopInputs {
  /** ATR period length */
  atrLength: number;
  /** ATR multiplier */
  atrCoeff: number;
  /** Stop smoothing length */
  stopLength: number;
}

export const defaultInputs: ChandeKrollStopInputs = {
  atrLength: 10,
  atrCoeff: 1,
  stopLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length (p)', defval: 10, min: 1 },
  { id: 'atrCoeff', type: 'int', title: 'ATR Coefficient (x)', defval: 1, min: 1 },
  { id: 'stopLength', type: 'int', title: 'Stop Length (q)', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stop Long', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Stop Short', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Chande Kroll Stop',
  shortTitle: 'CKS',
  overlay: true,
};

type Point = { time: number; value: number };

interface CksRun extends BarRunState<Record<string, never>> {
  highestHigh: WindowExtreme;
  lowestLow: WindowExtreme;
  atr: ReturnType<typeof taStep.atr>;
  stopShort: WindowExtreme;
  stopLong: WindowExtreme;
  plotData0: Point[];
  plotData1: Point[];
}

function study(inputs: Partial<ChandeKrollStopInputs>): BarStudy<CksRun, IndicatorResult> {
  const { atrLength, atrCoeff, stopLength } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // Highest and lowest over atrLength period, ATR (RMA-based), then the final stops over stopLength
      const highestHigh = new WindowExtreme(false, atrLength);
      const lowestLow = new WindowExtreme(true, atrLength);
      const atr = taStep.atr(atrLength);
      const stopShort = new WindowExtreme(false, stopLength);
      const stopLong = new WindowExtreme(true, stopLength);
      const s: CksRun = {
        highestHigh, lowestLow, atr, stopShort, stopLong, plotData0: [], plotData1: [],
        steps: [highestHigh, lowestLow, atr, stopShort, stopLong], vars: {}, lists: [], series: [],
      };
      s.series = [s.plotData0, s.plotData1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const hh = s.highestHigh.step(b.high);
      const ll = s.lowestLow.step(b.low);
      const atrVal = s.atr.step(b.high, b.low, b.close);
      // first stop levels
      const firstHighStop = hh - atrCoeff * atrVal;
      const firstLowStop = ll + atrCoeff * atrVal;
      s.plotData0[i] = { time: b.time, value: s.stopLong.step(firstLowStop) };
      s.plotData1[i] = { time: b.time, value: s.stopShort.step(firstHighStop) };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.plotData0.slice(),
          'plot1': s.plotData1.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ChandeKrollStopInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

/**
 * Calculate Chande Kroll Stop
 *
 * Algorithm from PineScript:
 * first_high_stop = ta.highest(high, p) - x * ta.atr(p)
 * first_low_stop = ta.lowest(low, p) + x * ta.atr(p)
 * stop_short = ta.highest(first_high_stop, q)
 * stop_long = ta.lowest(first_low_stop, q)
 */
export function calculate(bars: Bar[], inputs: Partial<ChandeKrollStopInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ChandeKrollStop = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
