/**
 * Williams %R Indicator
 *
 * A momentum indicator showing the level of the close relative to the highest high
 * over a lookback period. Range: -100 to 0.
 * Williams %R = -100 * (highest - close) / (highest - lowest)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WilliamsRInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: WilliamsRInputs = {
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%R', color: '#7E57C2', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: -20, color: '#787B86', linestyle: 'solid', title: 'Upper Band' },
  { id: 'hline_mid',   price: -50, color: '#787B86', linestyle: 'dotted', title: 'Middle Level' },
  { id: 'hline_lower', price: -80, color: '#787B86', linestyle: 'solid', title: 'Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#7E57C219' },
];

export const metadata = {
  title: 'Williams %R',
  shortTitle: '%R',
  overlay: false,
};

type Point = { time: number; value: number };

interface WilliamsRRun extends BarRunState<Record<string, never>> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  wrData: Point[];
}

function study(inputs: Partial<WilliamsRInputs>): BarStudy<WilliamsRRun, IndicatorResult> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // Get highest high and lowest low over the period
      const highest = new WindowExtreme(false, length);
      const lowest = new WindowExtreme(true, length);
      const s: WilliamsRRun = { highest, lowest, wrData: [], steps: [highest, lowest], vars: {}, lists: [], series: [] };
      s.series = [s.wrData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const highest = s.highest.step(b.high);
      const lowest = s.lowest.step(b.low);
      const srcVal = value(b);
      // Williams %R = -100 * (highest - src) / (highest - lowest)
      let wr: number;
      if (highest == null || lowest == null || srcVal == null) {
        wr = NaN;
      } else {
        const range = highest - lowest;
        wr = range === 0 ? -50 : -100 * (highest - srcVal) / range; // Midpoint when no range
      }
      s.wrData[i] = { time: b.time, value: wr ?? NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.wrData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WilliamsRInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WilliamsRInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WilliamsPercentRange = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
