/**
 * Smoothed Heiken Ashi Candles v1
 *
 * Two-pass smoothing: first EMA-smooth raw OHLC, then compute Heiken Ashi
 * on smoothed data, then EMA-smooth the HA candles again.
 *
 * Reference: "Smoothed Heiken Ashi Candles v1" by jackvmk
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SmoothedHeikenAshiInputs {
  emaLength1: number;
  emaLength2: number;
}

export const defaultInputs: SmoothedHeikenAshiInputs = {
  emaLength1: 10,
  emaLength2: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength1', type: 'int', title: 'EMA Length 1', defval: 10, min: 1 },
  { id: 'emaLength2', type: 'int', title: 'EMA Length 2', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'sha', title: 'Smoothed HA' },
];

export const metadata = {
  title: 'Smoothed Heiken Ashi',
  shortTitle: 'SmHA',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };

interface ShaVars {
  /** haOpen[1], haClose[1] */
  prevHaOpen: number;
  prevHaClose: number;
}

interface ShaRun extends BarRunState<ShaVars> {
  /** EMAs of the open, high, low, close, then of the HA open, high, low, close */
  emas: ReturnType<typeof taStep.ema>[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<SmoothedHeikenAshiInputs>): BarStudy<ShaRun, Result> {
  const { emaLength1, emaLength2 } = { ...defaultInputs, ...inputs };
  const warmup = emaLength1 + emaLength2;
  return {
    init() {
      const emas = [
        ...[0, 1, 2, 3].map(() => taStep.ema(emaLength1)),
        ...[0, 1, 2, 3].map(() => taStep.ema(emaLength2)),
      ];
      const s: ShaRun = {
        emas, candles: [], steps: emas, vars: { prevHaOpen: NaN, prevHaClose: NaN }, lists: [], series: [],
      };
      s.series = [s.candles];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const e = s.emas;
      // Step 1: EMA smooth each OHLC
      const o1 = e[0].step(b.open);
      const h1 = e[1].step(b.high);
      const l1 = e[2].step(b.low);
      const c1 = e[3].step(b.close);

      // Step 2: Heiken Ashi on smoothed values
      const oo = isNaN(o1) ? b.open : o1;
      const hh = isNaN(h1) ? b.high : h1;
      const ll = isNaN(l1) ? b.low : l1;
      const cc = isNaN(c1) ? b.close : c1;
      const haClose = (oo + hh + ll + cc) / 4;
      const haOpen = i === 0 ? (oo + cc) / 2 : (v.prevHaOpen + v.prevHaClose) / 2;
      const haHigh = Math.max(hh, haOpen, haClose);
      const haLow = Math.min(ll, haOpen, haClose);
      v.prevHaOpen = haOpen;
      v.prevHaClose = haClose;

      // Step 3: EMA smooth the HA candles
      const o = e[4].step(haOpen);
      const h = e[5].step(haHigh);
      const l = e[6].step(haLow);
      const c = e[7].step(haClose);

      if (i < warmup || !isFinite(o) || !isFinite(c)) {
        s.candles[i] = { time: b.time as number, open: NaN, high: NaN, low: NaN, close: NaN };
        return;
      }
      const col = c >= o ? '#26A69A' : '#EF5350';
      s.candles[i] = {
        time: b.time as number,
        open: o,
        high: h,
        low: l,
        close: c,
        color: col,
        borderColor: col,
        wickColor: col,
      };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { sha: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SmoothedHeikenAshiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SmoothedHeikenAshiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SmoothedHeikenAshi = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
