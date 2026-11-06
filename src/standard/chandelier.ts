/**
 * Chandelier Exit
 *
 * Trailing exit levels at a multiple of the Average True Range from the highest high and the lowest low:
 *
 *   atr        = atr(atrLength) * multiplier
 *   Long exit  = highest(high, length) - atr
 *   Short exit = lowest(low, length) + atr
 *
 * Based on the standard Chandelier Exit indicator. The function chandelier of the standard "ta" library is ported in
 * this file.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ChandelierExitStandardInputs {
  /** Bars of the highest high and lowest low */
  length: number;
  /** ATR length */
  atrLength: number;
  /** ATR multiplier */
  atrMult: number;
}

export const defaultInputs: ChandelierExitStandardInputs = {
  length: 22,
  atrLength: 22,
  atrMult: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 22, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR length', defval: 22, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR multiplier', defval: 3.0, min: 0.0, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long exit', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Short exit', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Chandelier Exit',
  shortTitle: 'Chandelier',
  overlay: true,
};

type Point = { time: any; value: number };

interface ChandelierRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  highest: WindowExtreme;
  lowest: WindowExtreme;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<ChandelierExitStandardInputs>): BarStudy<ChandelierRun, IndicatorResult> {
  const { length, atrLength, atrMult } = { ...defaultInputs, ...inputs };
  const point = (v: number, time: any): Point => ({ time, value: Number.isFinite(v) ? v : NaN });
  return {
    init() {
      // chandelier() of the "ta" library
      const atr = taStep.atr(atrLength);
      const highest = new WindowExtreme(false, length);
      const lowest = new WindowExtreme(true, length);
      const s: ChandelierRun = {
        atr, highest, lowest, plot0: [], plot1: [], steps: [atr, highest, lowest], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const atr = s.atr.step(b.high, b.low, b.close) * atrMult;
      const h = s.highest.step(b.high);
      const l = s.lowest.step(b.low);
      s.plot0[i] = point(h - atr, b.time);
      s.plot1[i] = point(l + atr, b.time);
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ChandelierExitStandardInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ChandelierExitStandardInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ChandelierExitStandard = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
