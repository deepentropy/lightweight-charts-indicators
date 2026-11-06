/**
 * Moving Average Converging [LuxAlgo]
 *
 * Adaptive MA using alpha adjustment based on crossovers and trend.
 * When price crosses the MA, alpha resets. When trending (new highs/lows),
 * alpha increases by k = 1/increment, making the MA converge faster.
 * A fast MA (fma) tracks extremes and smooths toward price.
 *
 * Reference: "Moving Average Converging [LuxAlgo]" by LuxAlgo
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MAConvergingInputs {
  length: number;
  increment: number;
  fast: number;
}

export const defaultInputs: MAConvergingInputs = {
  length: 100,
  increment: 10,
  fast: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 100, min: 2 },
  { id: 'increment', type: 'int', title: 'Increment', defval: 10, min: 1 },
  { id: 'fast', type: 'int', title: 'Fast', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast MA', color: '#ff5d00', lineWidth: 2 },
  { id: 'plot1', title: 'Converging MA', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Moving Average Converging',
  shortTitle: 'MA Converging',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface MacRun extends BarRunState<Record<string, never>> {
  upper: WindowExtreme;
  lower: WindowExtreme;
  initMa: WindowSma;
  upperArr: number[];
  lowerArr: number[];
  maArr: number[];
  fmaArr: number[];
  alphaArr: number[];
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
}

function study(inputs: Partial<MAConvergingInputs>): BarStudy<MacRun, IndicatorResult> {
  const { length, increment, fast } = { ...defaultInputs, ...inputs };
  const k = 1 / increment;
  const warmup = length;
  return {
    init() {
      const upper = new WindowExtreme(false, length);
      const lower = new WindowExtreme(true, length);
      const initMa = new WindowSma(length);
      const s: MacRun = {
        upper, lower, initMa, upperArr: [], lowerArr: [], maArr: [], fmaArr: [], alphaArr: [], plot0: [], plot1: [],
        fillColors: [], steps: [upper, lower, initMa], vars: {}, lists: [], series: [],
      };
      s.series = [s.upperArr, s.lowerArr, s.maArr, s.fmaArr, s.alphaArr, s.plot0, s.plot1, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const { upperArr, lowerArr, maArr, fmaArr, alphaArr } = s;
      const src = bars[i].close;
      upperArr[i] = s.upper.step(bars[i].high);
      lowerArr[i] = s.lower.step(bars[i].low);
      const initMa = s.initMa.step(src);

      if (i === 0) {
        maArr[i] = (initMa != null && !isNaN(initMa)) ? initMa : src;
        fmaArr[i] = src;
        alphaArr[i] = 2 / (length + 1);
      } else {
        const prevMa = maArr[i - 1];
        const prevFma = fmaArr[i - 1];
        const prevAlpha = alphaArr[i - 1];

        // Detect cross: src crosses prevMa (src and prevMa were on opposite sides)
        const prevSrc = bars[i - 1].close;
        const cross = (prevSrc <= prevMa && src > prevMa) || (prevSrc >= prevMa && src < prevMa);

        // Alpha update
        let alpha: number;
        if (cross) {
          alpha = 2 / (length + 1);
        } else if (src > prevMa && upperArr[i] > upperArr[i - 1]) {
          alpha = prevAlpha + k;
        } else if (src < prevMa && lowerArr[i] < lowerArr[i - 1]) {
          alpha = prevAlpha + k;
        } else {
          alpha = prevAlpha;
        }
        alphaArr[i] = alpha;

        // MA update: ma = nz(ma[1] + alpha[1] * (src - ma[1]), init_ma)
        // Uses previous alpha (alpha[1]) to update
        const rawMa = prevMa + prevAlpha * (src - prevMa);
        maArr[i] = isNaN(rawMa) ? ((initMa != null && !isNaN(initMa)) ? initMa : src) : rawMa;

        // FMA update
        let rawFma: number;
        if (cross) {
          rawFma = (src + prevFma) / 2;
        } else if (src > maArr[i]) {
          rawFma = Math.max(src, prevFma) + (src - prevFma) / fast;
        } else {
          rawFma = Math.min(src, prevFma) + (src - prevFma) / fast;
        }
        fmaArr[i] = isNaN(rawFma) ? src : rawFma;
      }

      const time = bars[i].time;
      s.plot0[i] = { time, value: i < warmup ? NaN : fmaArr[i] };
      s.plot1[i] = {
        time,
        value: i < warmup ? NaN : maArr[i],
        color: (i < warmup) ? undefined : (fmaArr[i] > maArr[i] ? '#008080' : '#FF0000'),
      };
      s.fillColors[i] = i < warmup ? 'transparent' : fmaArr[i] > maArr[i] ? 'rgba(0,150,136,0.15)' : 'rgba(239,83,80,0.15)';
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0,150,136,0.15)' }, colors: s.fillColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MAConvergingInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MAConvergingInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MAConverging = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
