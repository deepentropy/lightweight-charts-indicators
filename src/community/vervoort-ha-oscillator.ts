/**
 * Vervoort Heiken-Ashi LongTerm Candlestick Oscillator
 *
 * TEMA-smoothed OHLC → Heiken Ashi candles → oscillator from HA close vs open.
 * Oscillator = (haClose - haOpen) / haClose * 100
 *
 * Reference: "Vervoort Heiken Ashi Longterm Candlestick Oscillator [LazyBear]"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VervoortHAOscillatorInputs {
  temaLength: number;
}

export const defaultInputs: VervoortHAOscillatorInputs = {
  temaLength: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'temaLength', type: 'int', title: 'TEMA Length', defval: 55, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Vervoort HA LT Candlestick Oscillator',
  shortTitle: 'VHO',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

type Ema = ReturnType<typeof taStep.ema>;

interface VhoRun extends BarRunState<Record<string, never>> {
  /** [open, high, low, close] x [ema1, ema2, ema3] */
  emas: Ema[][];
  haOpen: number[];
  haClose: number[];
  plot0: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<VervoortHAOscillatorInputs>): BarStudy<VhoRun, Result> {
  const { temaLength } = { ...defaultInputs, ...inputs };
  // Oscillator = (haClose - haOpen) / haClose * 100
  const warmup = temaLength * 3;
  // TEMA for each OHLC component: TEMA = 3*ema1 - 3*ema2 + ema3; each ema of the previous one (the price while
  // it is na)
  const tema = (e: Ema[], price: number) => {
    const v1 = e[0].step(price);
    const e1 = isNaN(v1) ? price : v1;
    const v2 = e[1].step(e1);
    const e2 = isNaN(v2) ? price : v2;
    const v3 = e[2].step(e2);
    const e3 = isNaN(v3) ? price : v3;
    return 3 * e1 - 3 * e2 + e3;
  };
  return {
    init() {
      const s: VhoRun = {
        emas: Array.from({ length: 4 }, () => [taStep.ema(temaLength), taStep.ema(temaLength), taStep.ema(temaLength)]),
        haOpen: [], haClose: [], plot0: [], barColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = s.emas.flat();
      s.lists = [s.barColors];
      s.series = [s.haOpen, s.haClose, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const temaO = tema(s.emas[0], b.open);
      const temaH = tema(s.emas[1], b.high);
      const temaL = tema(s.emas[2], b.low);
      const temaC = tema(s.emas[3], b.close);

      // Build Heiken Ashi on TEMA-smoothed OHLC
      const haClose = (temaO + temaH + temaL + temaC) / 4;
      const haOpen = i === 0 ? (temaO + temaC) / 2 : (s.haOpen[i - 1] + s.haClose[i - 1]) / 2;
      s.haClose[i] = haClose;
      s.haOpen[i] = haOpen;

      if (i < warmup) {
        s.plot0[i] = { time: b.time, value: NaN };
        return;
      }
      const osc = haClose !== 0 ? (haClose - haOpen) / haClose * 100 : 0;
      s.plot0[i] = { time: b.time, value: osc, color: osc >= 0 ? '#26A69A' : '#EF5350' };
      // Pine: barcolor(overlayMode ? hacolt>0?green : hacolt<0?red : blue : na)
      // hacolt maps to oscillator sign: >0 = green, <0 = red, 0 = blue
      const color = osc > 0 ? '#008000' : osc < 0 ? '#FF0000' : '#0000FF'; // green/red/blue
      s.barColors.push({ time: b.time as number, color });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VervoortHAOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VervoortHAOscillatorInputs> = {}): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const VervoortHAOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
