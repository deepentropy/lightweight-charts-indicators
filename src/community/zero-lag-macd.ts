/**
 * Zero Lag MACD Enhanced
 *
 * MACD calculated from Zero-Lag EMAs instead of standard EMAs.
 * Zero-Lag EMA = 2*EMA - EMA(EMA) (removes one period of lag).
 * Signal line also zero-lag smoothed. Histogram = MACD - signal.
 *
 * Reference: "Zero Lag MACD Enhanced - Version 1.2" by AC (based on Glaz)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ZeroLagMACDInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  macdEmaLength: number;
  showDots: boolean;
}

export const defaultInputs: ZeroLagMACDInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  macdEmaLength: 9,
  showDots: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Period', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Period', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Period', defval: 9, min: 1 },
  { id: 'macdEmaLength', type: 'int', title: 'MACD EMA Length', defval: 9, min: 1 },
  { id: 'showDots', type: 'bool', title: 'Show Crossing Dots', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Positive Histogram', color: '#008000', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Negative Histogram', color: '#800080', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'MACD', color: '#000000', lineWidth: 2 },
  { id: 'plot3', title: 'Signal', color: '#787B86', lineWidth: 2 },
  { id: 'plot4', title: 'EMA on MACD', color: '#FF0000', lineWidth: 2 },
  { id: 'plot5', title: 'Cross Dots', color: '#008000', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'Zero Lag MACD',
  shortTitle: 'ZLMACD',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Ema = ReturnType<typeof taStep.ema>;

interface ZlMacdRun extends BarRunState<Record<string, never>> {
  emas: Ema[];
  macdArr: number[];
  sigArr: number[];
  plots: Point[][];
  fillColors: string[];
}

function study(inputs: Partial<ZeroLagMACDInputs>): BarStudy<ZlMacdRun, IndicatorResult> {
  const { fastLength, slowLength, signalLength, macdEmaLength, showDots } = { ...defaultInputs, ...inputs };
  const warmup = slowLength * 2;
  return {
    init() {
      const s: ZlMacdRun = {
        emas: [
          taStep.ema(fastLength), taStep.ema(fastLength), taStep.ema(slowLength), taStep.ema(slowLength),
          taStep.ema(signalLength), taStep.ema(signalLength), taStep.ema(macdEmaLength),
        ],
        macdArr: [], sigArr: [], plots: [[], [], [], [], [], []], fillColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = s.emas;
      s.series = [s.macdArr, s.sigArr, ...s.plots, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const src = bars[i].close;
      const e = s.emas;
      // Zero-lag fast line: 2*EMA(src, fast) - EMA(EMA(src, fast), fast)
      const ma1 = e[0].step(src);
      const ma2 = e[1].step(ma1);
      const zlFast = ma1 * 2 - ma2;

      // Zero-lag slow line
      const mas1 = e[2].step(src);
      const mas2 = e[3].step(mas1);
      const zlSlow = mas1 * 2 - mas2;

      // MACD = zlFast - zlSlow
      const macd = zlFast - zlSlow;

      // Zero-lag signal: 2*EMA(MACD, signal) - EMA(EMA(MACD, signal), signal)
      const emasig1 = e[4].step(macd);
      const emasig2 = e[5].step(emasig1);
      const signal = emasig1 * 2 - emasig2;

      const v = macd - signal;
      const macdEma = e[6].step(macd);
      s.macdArr[i] = macd;
      s.sigArr[i] = signal;

      // Separate positive and negative histograms
      s.plots[0][i] = { time, value: i < warmup ? NaN : (v > 0 ? v : NaN) };
      s.plots[1][i] = { time, value: i < warmup ? NaN : (v <= 0 ? v : NaN) };
      s.plots[2][i] = { time, value: i < warmup ? NaN : macd };
      s.plots[3][i] = { time, value: i < warmup ? NaN : signal };
      s.plots[4][i] = { time, value: i < warmup ? NaN : macdEma };

      // Cross dots at MACD/signal crossovers
      let dot: Point = { time, value: NaN };
      if (showDots && !(i < warmup + 1)) {
        const prev = s.macdArr[i - 1];
        const prevSig = s.sigArr[i - 1];
        const cross = (prev <= prevSig && macd > signal) || (prev >= prevSig && macd < signal);
        if (cross) dot = { time, value: macd, color: v > 0 ? '#008000' : '#800080' };
      }
      s.plots[5][i] = dot;

      // Dynamic fill colors: green when MACD > signal, purple otherwise
      s.fillColors[i] = i < warmup ? 'transparent' : v > 0 ? 'rgba(0,128,0,0.25)' : 'rgba(128,0,128,0.25)';
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0].slice(), 'plot1': p[1].slice(), 'plot2': p[2].slice(), 'plot3': p[3].slice(), 'plot4': p[4].slice(), 'plot5': p[5].slice() },
        fills: [{ plot1: 'plot2', plot2: 'plot3', colors: s.fillColors.slice() }],
        hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dotted', title: 'Zero' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZeroLagMACDInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZeroLagMACDInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ZeroLagMACD = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
