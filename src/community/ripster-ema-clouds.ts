/**
 * Ripster EMA Clouds
 *
 * Five pairs of EMAs forming clouds. Each cloud pair is short/long EMA.
 * Default pairs: (8,9), (5,12), (34,50), (72,89), (180,200).
 * Bullish = short >= long (green cloud), Bearish = short < long (red cloud).
 *
 * Reference: "Ripster EMA Clouds" by ripster47
 */

import { taStep, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RipsterEMACloudsInputs {
  source: SourceType;
  shortLen1: number; longLen1: number;
  shortLen2: number; longLen2: number;
  shortLen3: number; longLen3: number;
  shortLen4: number; longLen4: number;
  shortLen5: number; longLen5: number;
}

export const defaultInputs: RipsterEMACloudsInputs = {
  source: 'hl2',
  shortLen1: 8, longLen1: 9,
  shortLen2: 5, longLen2: 12,
  shortLen3: 34, longLen3: 50,
  shortLen4: 72, longLen4: 89,
  shortLen5: 180, longLen5: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'hl2' },
  { id: 'shortLen1', type: 'int', title: 'Short EMA1', defval: 8, min: 1 },
  { id: 'longLen1', type: 'int', title: 'Long EMA1', defval: 9, min: 1 },
  { id: 'shortLen2', type: 'int', title: 'Short EMA2', defval: 5, min: 1 },
  { id: 'longLen2', type: 'int', title: 'Long EMA2', defval: 12, min: 1 },
  { id: 'shortLen3', type: 'int', title: 'Short EMA3', defval: 34, min: 1 },
  { id: 'longLen3', type: 'int', title: 'Long EMA3', defval: 50, min: 1 },
  { id: 'shortLen4', type: 'int', title: 'Short EMA4', defval: 72, min: 1 },
  { id: 'longLen4', type: 'int', title: 'Long EMA4', defval: 89, min: 1 },
  { id: 'shortLen5', type: 'int', title: 'Short EMA5', defval: 180, min: 1 },
  { id: 'longLen5', type: 'int', title: 'Long EMA5', defval: 200, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short EMA1', color: '#036103', lineWidth: 1 },
  { id: 'plot1', title: 'Long EMA1', color: '#036103', lineWidth: 1 },
  { id: 'plot2', title: 'Short EMA2', color: '#4caf50', lineWidth: 1 },
  { id: 'plot3', title: 'Long EMA2', color: '#4caf50', lineWidth: 1 },
  { id: 'plot4', title: 'Short EMA3', color: '#2196f3', lineWidth: 1 },
  { id: 'plot5', title: 'Long EMA3', color: '#2196f3', lineWidth: 1 },
  { id: 'plot6', title: 'Short EMA4', color: '#009688', lineWidth: 1 },
  { id: 'plot7', title: 'Long EMA4', color: '#009688', lineWidth: 1 },
  { id: 'plot8', title: 'Short EMA5', color: '#05bed5', lineWidth: 1 },
  { id: 'plot9', title: 'Long EMA5', color: '#05bed5', lineWidth: 1 },
];

export const metadata = {
  title: 'Ripster EMA Clouds',
  shortTitle: 'REC',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

// Bullish/bearish fill colors per cloud pair
const bullishFillColors = ['#036103', '#4caf50', '#2196f3', '#009688', '#05bed5'];
const bearishFillColors = ['#880e4f', '#f44336', '#ffb74d', '#f06292', '#e65100'];
// Transparency: 45%, 65%, 70%, 65%, 65% mapped to hex alpha
const fillAlphas = ['73', 'A6', 'B3', 'A6', 'A6'];

interface RipsterVars {
  /** Short and long EMA of each pair on the bar before */
  prev: number[];
}

interface RipsterRun extends BarRunState<RipsterVars> {
  emas: Array<ReturnType<typeof taStep.ema>>;
  ext: number[] | null;
  plots: Point[][];
  cloudColors: string[][];
}

function study(inputs: Partial<RipsterEMACloudsInputs>): BarStudy<RipsterRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const barValue = barSource(cfg.source);
  const pairs = [
    [cfg.shortLen1, cfg.longLen1],
    [cfg.shortLen2, cfg.longLen2],
    [cfg.shortLen3, cfg.longLen3],
    [cfg.shortLen4, cfg.longLen4],
    [cfg.shortLen5, cfg.longLen5],
  ];
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init(bars) {
      const emas: Array<ReturnType<typeof taStep.ema>> = [];
      for (const [sLen, lLen] of pairs) emas.push(taStep.ema(sLen), taStep.ema(lLen));
      const s: RipsterRun = {
        emas,
        ext: isBarSource(cfg.source) ? null : getSourceSeries(bars, cfg.source).toArray().map((v) => v ?? NaN),
        plots: Array.from({ length: 10 }, () => []),
        cloudColors: Array.from({ length: 5 }, () => []),
        steps: emas,
        vars: { prev: new Array<number>(10).fill(NaN) },
        lists: [], series: [],
      };
      s.series = [...s.plots, ...s.cloudColors];
      return s;
    },
    copyVars: (v) => ({ prev: v.prev.slice() }),
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const src = s.ext ? s.ext[i] : barValue(b);
      const prevs = s.vars.prev;
      for (let idx = 0; idx < 5; idx++) {
        const [sLen, lLen] = pairs[idx];
        const shortEma = s.emas[idx * 2].step(src);
        const longEma = s.emas[idx * 2 + 1].step(src);
        const warmup = Math.max(sLen, lLen);
        if (i < warmup) {
          s.plots[idx * 2][i] = { time, value: NaN };
          s.plots[idx * 2 + 1][i] = { time, value: NaN };
          s.cloudColors[idx][i] = 'transparent';
        } else {
          // Short EMA: olive if rising, maroon if falling
          const sPrev = i > 0 ? prevs[idx * 2] : shortEma;
          s.plots[idx * 2][i] = { time, value: shortEma, color: shortEma >= sPrev ? '#808000' : '#800000' };
          // Long EMA: green if rising, red if falling
          const lPrev = i > 0 ? prevs[idx * 2 + 1] : longEma;
          s.plots[idx * 2 + 1][i] = { time, value: longEma, color: longEma >= lPrev ? '#008000' : '#FF0000' };
          // Dynamic fill colors per bar
          const baseColor = shortEma >= longEma ? bullishFillColors[idx] : bearishFillColors[idx];
          s.cloudColors[idx][i] = baseColor + fillAlphas[idx];
        }
        prevs[idx * 2] = shortEma;
        prevs[idx * 2 + 1] = longEma;
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      const fills: Array<{ plot1: string; plot2: string; colors: string[] }> = [];
      for (let idx = 0; idx < 5; idx++) {
        plots[`plot${idx * 2}`] = s.plots[idx * 2].slice();
        plots[`plot${idx * 2 + 1}`] = s.plots[idx * 2 + 1].slice();
        fills.push({ plot1: `plot${idx * 2}`, plot2: `plot${idx * 2 + 1}`, colors: s.cloudColors[idx].slice() });
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RipsterEMACloudsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RipsterEMACloudsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RipsterEMAClouds = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
