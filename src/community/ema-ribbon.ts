/**
 * EMA Ribbon
 *
 * Eight EMA lines at Fibonacci-related periods: 5, 8, 13, 21, 34, 55, 89, 144.
 * Expansion signals strong trends, contraction signals consolidation.
 *
 * Reference: "EMA Ribbon" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EMARibbonInputs {
  src: SourceType;
}

export const defaultInputs: EMARibbonInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 5', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'EMA 8', color: '#FF9100', lineWidth: 1 },
  { id: 'plot2', title: 'EMA 13', color: '#FFC107', lineWidth: 1 },
  { id: 'plot3', title: 'EMA 21', color: '#CDDC39', lineWidth: 1 },
  { id: 'plot4', title: 'EMA 34', color: '#66BB6A', lineWidth: 1 },
  { id: 'plot5', title: 'EMA 55', color: '#26A69A', lineWidth: 1 },
  { id: 'plot6', title: 'EMA 89', color: '#42A5F5', lineWidth: 1 },
  { id: 'plot7', title: 'EMA 144', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'EMA Ribbon',
  shortTitle: 'EMAR',
  overlay: true,
};

const LENGTHS = [5, 8, 13, 21, 34, 55, 89, 144];

interface RibbonRun extends BarRunState<Record<string, never>> {
  emas: Array<ReturnType<typeof taStep.ema>>;
  plots: Array<Array<{ time: number; value: number }>>;
}

function study(inputs: Partial<EMARibbonInputs>): BarStudy<RibbonRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const source = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const emas = LENGTHS.map((len) => taStep.ema(len));
      const s: RibbonRun = { emas, plots: LENGTHS.map(() => []), steps: emas, vars: {}, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const v = source(bars[i]);
      for (let idx = 0; idx < LENGTHS.length; idx++) {
        const e = s.emas[idx].step(v);
        s.plots[idx][i] = { time, value: i < LENGTHS[idx] ? NaN : (e ?? NaN) };
      }
    },
    result(s) {
      const plots: Record<string, Array<{ time: number; value: number }>> = {};
      for (let idx = 0; idx < LENGTHS.length; idx++) plots[`plot${idx}`] = s.plots[idx].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EMARibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EMARibbonInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const EMARibbon = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
