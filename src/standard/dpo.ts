/**
 * Detrended Price Oscillator (DPO) Indicator
 *
 * Removes trend from price to identify cycles.
 * DPO = Close - SMA(Close, length)[length/2 + 1]
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DPOInputs {
  /** Period length */
  length: number;
  /** Whether to center the DPO */
  centered: boolean;
}

export const defaultInputs: DPOInputs = {
  length: 21,
  centered: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21, min: 1 },
  { id: 'centered', type: 'bool', title: 'Centered', defval: false, tooltip: 'When the DPO is centered, the DPO line stays offset towards the left. When it is not centered, it shifts back to the right to match current price.', display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DPO', color: '#43A047', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero Line' },
];

export const metadata = {
  title: 'Detrended Price Oscillator',
  shortTitle: 'DPO',
  overlay: false,
};

type Point = { time: number; value: number };

interface DpoRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  ma: number[];
  dpoData: Point[];
}

function study(inputs: Partial<DPOInputs>): BarStudy<DpoRun, IndicatorResult> {
  const { length, centered } = { ...defaultInputs, ...inputs };
  const barsback = Math.floor(length / 2) + 1;
  return {
    init() {
      const sma = new WindowSma(length);
      const s: DpoRun = { sma, ma: [], dpoData: [], steps: [sma], vars: {}, lists: [], series: [] };
      s.series = [s.ma, s.dpoData];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const ma = s.sma.step(bar.close);
      s.ma[i] = ma;
      if (centered) {
        // Centered: visually equivalent to Pine's close[barsback] - ma with offset = -barsback
        // Which means at display position i: close[i] - ma[i + barsback] (written by bar i + barsback)
        s.dpoData[i] = { time: bar.time, value: NaN };
        const k = i - barsback;
        if (k >= 0) s.dpoData[k] = { time: bars[k].time, value: bars[k].close - ma };
      } else {
        // non-centered: close - ma[barsback]
        const maIndex = i - barsback;
        s.dpoData[i] = maIndex < 0 ? { time: bar.time, value: NaN } : { time: bar.time, value: bar.close - s.ma[maIndex]! };
      }
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.dpoData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DPOInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DPOInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DPO = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
