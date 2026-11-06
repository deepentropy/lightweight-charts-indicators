/**
 * ATR+ (Stop Loss Indicator)
 *
 * Overlay=false indicator showing 5 circle-style plots:
 * - ATR (whole number conversion)
 * - Long Entry Size (pips from close to recent low + stop)
 * - Long Target Size (long entry * R:R ratio)
 * - Short Entry Size (pips from recent high to close + stop)
 * - Short Target Size (short entry * R:R ratio)
 *
 * Pine plots all 5 with plot.style_circles and color.new(color, 100) (fully transparent).
 * We keep them visible with low opacity so the data is usable in the TS framework.
 *
 * Reference: "ATR+ (Stop Loss Indicator)" by ZenAndTheArtOfTrading
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ATRPlusInputs {
  riskRatio: number;
  atrLength: number;
  lookback: number;
  stopSize: number;
  useATR: boolean;
}

export const defaultInputs: ATRPlusInputs = {
  riskRatio: 1.0,
  atrLength: 14,
  lookback: 3,
  stopSize: 1.0,
  useATR: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'riskRatio', type: 'float', title: 'R/R', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 3, min: 1 },
  { id: 'stopSize', type: 'float', title: 'Stop Distance (pips or ATR)', defval: 1.0, min: 0.0, step: 0.1 },
  { id: 'useATR', type: 'bool', title: 'Use ATR Multiplier', defval: true },
];

// Pine: all 5 plots use plot.style_circles with color.new(color, 100) (fully transparent)
// We use style: 'circles' and keep colors visible for the TS framework
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR', color: '#009688', lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'Long Entry Size', color: '#4CAF50', lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'Long Target Size', color: '#4CAF50', lineWidth: 2, style: 'circles' },
  { id: 'plot3', title: 'Short Entry Size', color: '#F44336', lineWidth: 2, style: 'circles' },
  { id: 'plot4', title: 'Short Target Size', color: '#F44336', lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'ATR+ (Stop Loss Indicator)',
  shortTitle: 'ATR+',
  overlay: false,
};

/**
 * Pine's toWhole: converts a price value to whole-number pips.
 * For forex pairs with 3+ decimals, multiply by 10^(decimals-1).
 * For simplicity in a general context, if the value < 1 we scale it to pips,
 * otherwise we leave it as-is (stocks, crypto).
 */
function toWhole(value: number): number {
  if (value === 0 || isNaN(value)) return 0;
  // If value is already >= 1, return rounded
  if (Math.abs(value) >= 1) return Math.round(value * 10) / 10;
  // Forex-like: multiply until >= 1
  let v = value;
  while (Math.abs(v) < 1) {
    v *= 10;
  }
  return Math.round(v * 10) / 10;
}

function toPips(value: number): number {
  return toWhole(value);
}

type Point = { time: number; value: number };

interface AtrPlusRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
}

function study(inputs: Partial<ATRPlusInputs>): BarStudy<AtrPlusRun, IndicatorResult> {
  const { riskRatio, atrLength, lookback, stopSize, useATR } = { ...defaultInputs, ...inputs };
  const warmup = atrLength;
  return {
    init() {
      const atr = taStep.atr(atrLength);
      const s: AtrPlusRun = { atr, plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], steps: [atr], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.plot4];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const atrValue = s.atr.step(b.high, b.low, b.close);

      // Compute lowest low / highest high over lookback
      let lo = b.low;
      let hi = b.high;
      for (let j = 1; j < lookback && i - j >= 0; j++) {
        lo = Math.min(lo, bars[i - j].low);
        hi = Math.max(hi, bars[i - j].high);
      }

      if (i < warmup || atrValue == null) {
        s.plot0[i] = { time: t, value: NaN };
        s.plot1[i] = { time: t, value: NaN };
        s.plot2[i] = { time: t, value: NaN };
        s.plot3[i] = { time: t, value: NaN };
        s.plot4[i] = { time: t, value: NaN };
        return;
      }

      const atrWhole = toWhole(atrValue);

      // Stop size: either ATR-based or fixed pip
      let stop: number;
      if (useATR) {
        stop = atrValue * stopSize;
      } else {
        stop = toPips(stopSize);
      }

      const close = b.close;
      const longEntrySize = toWhole(close - lo + stop);
      const shortEntrySize = toWhole(hi - close + stop);

      s.plot0[i] = { time: t, value: atrWhole };
      s.plot1[i] = { time: t, value: longEntrySize };
      s.plot2[i] = { time: t, value: longEntrySize * riskRatio };
      s.plot3[i] = { time: t, value: shortEntrySize };
      s.plot4[i] = { time: t, value: shortEntrySize * riskRatio };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice(), 'plot4': s.plot4.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ATRPlusInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ATRPlusInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ATRPlus = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
