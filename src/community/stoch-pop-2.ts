/**
 * CM Stochastic POP Method 2
 *
 * Enhanced POP: K crosses above D while both below 20 = buy,
 * K crosses below D while both above 80 = sell.
 *
 * Reference: "CM_Stochastic POP Method 2" by ChrisMoody
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface StochPOP2Inputs {
  kLen: number;
  kSmooth: number;
  ul: number;
  ll: number;
}

export const defaultInputs: StochPOP2Inputs = {
  kLen: 14,
  kSmooth: 5,
  ul: 55,
  ll: 45,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: 'Stochastic Length', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: 'Smooth K', defval: 5, min: 1 },
  { id: 'ul', type: 'int', title: 'Buy Entry/Exit Line', defval: 55, min: 50 },
  { id: 'll', type: 'int', title: 'Sell Entry/Exit Line', defval: 45, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stochastic', color: '#2962FF', lineWidth: 4 },
  { id: 'upperLine', title: 'Upper Line', color: '#00E676', lineWidth: 4 },
  { id: 'line100', title: '100 Line', color: '#FFFFFF', lineWidth: 1 },
  { id: 'lowerLine', title: 'Lower Line', color: '#FF0000', lineWidth: 4 },
  { id: 'line0', title: '0 Line', color: '#FFFFFF', lineWidth: 1 },
];

export const metadata = {
  title: 'CM Stochastic POP Method 2',
  shortTitle: 'StochPOP2',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface StochPop2Run extends BarRunState<{ prevK: number }> {
  lo: WindowExtreme;
  hi: WindowExtreme;
  sma: WindowSma;
  plot0: Point[];
  upperLine: Point[];
  line100: Point[];
  lowerLine: Point[];
  line0: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<StochPOP2Inputs>): BarStudy<StochPop2Run, Result> {
  const { kLen, kSmooth, ul, ll } = { ...defaultInputs, ...inputs };
  const warmup = kLen + kSmooth;
  return {
    init() {
      // ta.stoch(close, high, low, kLen) checks its length as ta.highest does
      taStep.stoch(kLen);
      const lo = new WindowExtreme(true, kLen);
      const hi = new WindowExtreme(false, kLen);
      const sma = new WindowSma(kSmooth);
      const s: StochPop2Run = {
        lo, hi, sma, plot0: [], upperLine: [], line100: [], lowerLine: [], line0: [], barColors: [],
        steps: [lo, hi, sma], vars: { prevK: NaN }, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.plot0, s.upperLine, s.line100, s.lowerLine, s.line0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // rawK = ta.stoch(close, high, low, kLen) (an na result keeps the previous one); k = ta.sma(rawK, kSmooth)
      const lo = s.lo.step(b.low);
      const st = (100 * (b.close - lo)) / (s.hi.step(b.high) - lo);
      const rawK = Number.isNaN(st) ? s.vars.prevK : st;
      s.vars.prevK = rawK;
      const v = s.sma.step(rawK);

      // Stochastic line with per-bar color: green >= ul, red <= ll, blue otherwise
      if (v == null || i < warmup) s.plot0[i] = { time, value: NaN };
      else s.plot0[i] = { time, value: v, color: v >= ul ? '#00E676' : v <= ll ? '#FF0000' : '#2962FF' };

      // Zone boundary plots
      s.upperLine[i] = { time, value: ul };
      s.line100[i] = { time, value: 100 };
      s.lowerLine[i] = { time, value: ll };
      s.line0[i] = { time, value: 0 };

      // Barcolor: lime when k >= ul (Long), red when k <= ll (Short), blue otherwise (NoTrade)
      if (i >= warmup) {
        const k = v ?? 0;
        s.barColors.push({ time, color: k >= ul ? '#00FF00' : k <= ll ? '#FF0000' : '#2962FF' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'upperLine': s.upperLine.slice(), 'line100': s.line100.slice(), 'lowerLine': s.lowerLine.slice(), 'line0': s.line0.slice() },
        fills: [
          { plot1: 'upperLine', plot2: 'line100', options: { color: 'rgba(0,230,118,0.1)' } },
          { plot1: 'upperLine', plot2: 'lowerLine', options: { color: 'rgba(41,98,255,0.1)' } },
          { plot1: 'lowerLine', plot2: 'line0', options: { color: 'rgba(255,0,0,0.1)' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StochPOP2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StochPOP2Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const StochPOP2 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
