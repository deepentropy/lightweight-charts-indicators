/**
 * Choppiness Index Indicator
 *
 * Measures market choppiness vs trending.
 * High values (>61.8) indicate choppy/ranging markets.
 * Low values (<38.2) indicate trending markets.
 * CI = 100 * log10(sum(ATR, n) / (highest - lowest)) / log10(n)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ChoppinessInputs {
  /** Period length */
  length: number;
  /** Plot offset */
  offset: number;
}

export const defaultInputs: ChoppinessInputs = {
  length: 14,
  offset: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 14, min: 1 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CHOP', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 61.8, color: '#787B86', linestyle: 'dashed', title: 'Upper Band' },
  { id: 'hline_mid',   price: 50, color: '#787B8680', linestyle: 'solid', title: 'Middle Band' },
  { id: 'hline_lower', price: 38.2, color: '#787B86', linestyle: 'dashed', title: 'Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF1A' },
];

export const metadata = {
  title: 'Choppiness Index',
  shortTitle: 'CHOP',
  overlay: false,
};

interface ChopRun extends BarRunState<Record<string, never>> {
  atr1: ReturnType<typeof taStep.atr>;
  highest: WindowExtreme;
  lowest: WindowExtreme;
  atr1Arr: number[];
  chop: number[];
}

function study(inputs: Partial<ChoppinessInputs>): BarStudy<ChopRun, IndicatorResult> {
  const { length, offset } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // Calculate ATR(1) for each bar
      const atr1 = taStep.atr(1);
      const highest = new WindowExtreme(false, length);
      const lowest = new WindowExtreme(true, length);
      const s: ChopRun = { atr1, highest, lowest, atr1Arr: [], chop: [], steps: [atr1, highest, lowest], vars: {}, lists: [], series: [] };
      s.series = [s.atr1Arr, s.chop];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      s.atr1Arr[i] = s.atr1.step(b.high, b.low, b.close);
      const h = s.highest.step(b.high);
      const l = s.lowest.step(b.low);

      // CI = 100 * log10(sum(ATR(1), length) / (highest - lowest)) / log10(length)
      if (i < length - 1) {
        s.chop[i] = NaN;
        return;
      }

      // Sum of ATR(1) over length
      const atr1Arr = s.atr1Arr;
      let sumATR = 0;
      for (let j = i - length + 1; j <= i; j++) {
        const atrVal = atr1Arr[j];
        if (atrVal != null && !isNaN(atrVal)) {
          sumATR += atrVal;
        }
      }

      if (h == null || l == null || h === l) {
        s.chop[i] = NaN;
      } else {
        const range = h - l;
        s.chop[i] = 100 * Math.log10(sumATR / range) / Math.log10(length);
      }
    },
    result(s, bars) {
      const chop = s.chop;
      // plot(..., offset = offset): the value of bar i is drawn on bar i + offset (future bars after the last bar)
      const interval = barInterval(bars);
      const plotData: { time: number; value: number }[] = [];
      for (let i = 0; i < bars.length; i++) {
        if (i + offset < 0) continue;
        plotData.push({ time: barTime(bars, i + offset, interval), value: chop[i] });
      }

      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': plotData,
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ChoppinessInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ChoppinessInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Choppiness = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
