/**
 * Advance/Decline Ratio (Bars)
 *
 * Ratio of up bars to down bars over the last `length` bars of the chart symbol. A bar is up when close - open >= 0:
 *
 *   upBars   = sum(isUp ? 1 : 0, length)
 *   downBars = sum(isUp ? 0 : 1, length)
 *   ADR_B    = downBars == 0 ? upBars : upBars / downBars
 *
 * Drawn with an equality line at 1.
 *
 * Based on the standard Advance/Decline Ratio (Bars) indicator.
 */

import { math, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdvanceDeclineRatioBarsInputs {
  /** Number of bars counted */
  length: number;
}

export const defaultInputs: AdvanceDeclineRatioBarsInputs = {
  length: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADR_B', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_equality', price: 1, color: '#787B86', linestyle: 'dashed', linewidth: 1, title: 'Equality Line' },
];

export const metadata = {
  title: 'Advance/Decline Ratio (Bars)',
  shortTitle: 'ADR_B',
  overlay: false,
};

/** Pine float equality: within 1e-10 (na compares false) */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

type Point = { time: number; value: number };

interface AdrRun extends BarRunState<Record<string, never>> {
  /** Up bars from the first bar to each bar (math.sum of 0 / 1 values: an exact count, the same doubles) */
  upCount: number[];
  data: Point[];
}

function study(inputs: Partial<AdvanceDeclineRatioBarsInputs>): BarStudy<AdrRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  const len = Math.floor(length);
  return {
    init() {
      // the length check of math.sum (the same runtime error)
      math.sum([], length);
      const s: AdrRun = { upCount: [], data: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.upCount, s.data];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      // isUp = (close - open) >= 0.0 (Pine comparison: false only when 0 - x > 1e-10)
      const d = bar.close - bar.open;
      const isUp = !isNaN(d) && !(0 - d > 1e-10);
      const count = (i > 0 ? s.upCount[i - 1]! : 0) + (isUp ? 1 : 0);
      s.upCount[i] = count;
      // upBars = math.sum(isUp ? 1 : 0, length), downBars = math.sum(isUp ? 0 : 1, length): na before `length` bars
      let u = NaN;
      let dn = NaN;
      if (i + 1 >= len) {
        u = count - (i - len >= 0 ? s.upCount[i - len]! : 0);
        dn = len - u;
      }
      const ad = eq(dn, 0) ? u : u / dn;
      s.data[i] = { time: bar.time, value: Number.isFinite(ad) ? ad : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.data.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdvanceDeclineRatioBarsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdvanceDeclineRatioBarsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AdvanceDeclineRatioBars = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
