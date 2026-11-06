/**
 * Trend Trigger Factor (TTF)
 *
 * Measures buying/selling pressure by comparing current vs past high/low ranges.
 * TTF = 100 * (BP - SP) / (0.5 * (BP + SP))
 * BP = highest(high, len) - lowest(low, len)[len]
 * SP = highest(high, len)[len] - lowest(low, len)
 *
 * Reference: "Trend Trigger Factor [LazyBear]"
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendTriggerFactorInputs {
  length: number;
  buyTrigger: number;
  sellTrigger: number;
}

export const defaultInputs: TrendTriggerFactorInputs = {
  length: 15,
  buyTrigger: 100,
  sellTrigger: -100,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 15, min: 1 },
  { id: 'buyTrigger', type: 'int', title: 'Buy Trigger', defval: 100 },
  { id: 'sellTrigger', type: 'int', title: 'Sell Trigger', defval: -100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TTF', color: '#800000', lineWidth: 2 },
  { id: 'plot1', title: 'Buy Clip', color: '#FFFFFF', lineWidth: 1 },
  { id: 'plot2', title: 'Sell Clip', color: '#FFFFFF', lineWidth: 1 },
];

export const metadata = {
  title: 'Trend Trigger Factor',
  shortTitle: 'TTF',
  overlay: false,
};

type Point = { time: number; value: number };

interface TtfRun extends BarRunState<Record<string, never>> {
  hhStep: WindowExtreme;
  llStep: WindowExtreme;
  hhArr: number[];
  llArr: number[];
  ttfPlot: Point[];
  bsPlot: Point[];
  usPlot: Point[];
}

function study(inputs: Partial<TrendTriggerFactorInputs>): BarStudy<TtfRun, IndicatorResult> {
  const { length, buyTrigger, sellTrigger } = { ...defaultInputs, ...inputs };
  const warmup = 2 * length;
  return {
    init() {
      const hhStep = new WindowExtreme(false, length);
      const llStep = new WindowExtreme(true, length);
      const s: TtfRun = {
        hhStep, llStep, hhArr: [], llArr: [], ttfPlot: [], bsPlot: [], usPlot: [],
        steps: [hhStep, llStep], vars: {}, lists: [], series: [],
      };
      s.series = [s.hhArr, s.llArr, s.ttfPlot, s.bsPlot, s.usPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      s.hhArr[i] = s.hhStep.step(b.high);
      s.llArr[i] = s.llStep.step(b.low);
      let ttf: number;
      if (i < warmup) {
        ttf = NaN;
      } else {
        const hh = s.hhArr[i] ?? 0;
        const ll = s.llArr[i] ?? 0;
        const hhPrev = s.hhArr[i - length] ?? 0;
        const llPrev = s.llArr[i - length] ?? 0;

        const bp = hh - llPrev; // current highest - past lowest
        const sp = hhPrev - ll; // past highest - current lowest
        const denom = 0.5 * (bp + sp);
        ttf = denom !== 0 ? 100 * (bp - sp) / denom : 0;
      }
      const time = b.time as number;
      s.ttfPlot[i] = { time, value: isNaN(ttf) ? NaN : ttf };
      // Pine: bs = (ttf > bt) ? bt : ttf; us = (ttf < st) ? st : ttf
      s.bsPlot[i] = { time, value: isNaN(ttf) ? NaN : (ttf > buyTrigger ? buyTrigger : ttf) };
      s.usPlot[i] = { time, value: isNaN(ttf) ? NaN : (ttf < sellTrigger ? sellTrigger : ttf) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.ttfPlot.slice(), 'plot1': s.bsPlot.slice(), 'plot2': s.usPlot.slice() },
        // fill(bl, tl, color=green, transp=75); fill(ul, tl, color=red, transp=75)
        fills: [
          { plot1: 'plot1', plot2: 'plot0', options: { color: 'rgba(0,128,0,0.25)' } },
          { plot1: 'plot2', plot2: 'plot0', options: { color: 'rgba(255,0,0,0.25)' } },
        ],
        hlines: [
          { value: buyTrigger, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Buy' } },
          { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
          { value: sellTrigger, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Sell' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendTriggerFactorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendTriggerFactorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendTriggerFactor = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
