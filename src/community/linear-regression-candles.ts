/**
 * Linear Regression Candles
 *
 * OHLC replaced by linear regression values with optional SMA smoothing.
 * Provides a smoothed candlestick representation of price. Two candle outputs as the original: the rising candles
 * (open < close) and the others.
 *
 * Reference: "Linear Regression Candles" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface LinRegCandlesInputs {
  length: number;
  smoothLen: number;
  signalLength: number;
  smaSignal: boolean;
}

export const defaultInputs: LinRegCandlesInputs = {
  length: 11,
  smoothLen: 1,
  signalLength: 11,
  smaSignal: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Linear Regression Length', defval: 11, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Smooth Length', defval: 1, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 11, min: 1 },
  { id: 'smaSignal', type: 'bool', title: 'Simple MA (Signal Line)', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'signal', title: 'Signal', color: '#FFFFFF', lineWidth: 1 },
];

/** The original's two plotcandle() outputs: open < close (candle0), the other candles (candle1) */
export const plotCandleConfig = [
  { id: 'candle0', title: 'LinReg Candles' },
  { id: 'candle1', title: 'LinReg Candles' },
];

export const metadata = {
  title: 'Linear Regression Candles',
  shortTitle: 'LRCandle',
  overlay: true,
};

/**
 * `ta.linreg(source, length, 0)` one bar at a time: the loops and the operation order of taStep.linreg (the same
 * doubles) on a plain window of the last values, without its per-bar closure.
 */
class LinregStep {
  /** The committed values from position 0 to `count - 1`, the value of the bar stepped at `count` */
  private values: number[] = [];
  private count = 0;
  private stepped = false;
  private readonly len: number;

  constructor(length: number) {
    // the length check of ta.linreg (the same runtime error)
    taStep.linreg(length, 0);
    this.len = Math.floor(length);
  }

  step(value: number): number {
    this.stepped = true;
    const h = this.values;
    const n = this.count;
    h[n] = value;
    const len = this.len;
    if (n < len - 1) return NaN;
    // window position j: h[base + j] (0 the oldest, len - 1 this bar)
    const base = n - len + 1;
    for (let j = 0; j < len; j++) if (isNaN(h[base + j]!)) return NaN;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let j = 0; j < len; j++) {
      const x = j + 1;
      const y = h[base + j]!;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = sumY / len - (slope * sumX) / len + slope;
    return intercept + slope * (len - 1);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.count++;
    if (this.count > this.len * 2 + 1024) {
      // keep the last len values
      this.values = this.values.slice(this.count - this.len, this.count);
      this.count = this.len;
    }
  }
}

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };
type Step = { step(v: number): number; commit(): void };

interface LinRegCandlesRun extends BarRunState<Record<string, never>> {
  lr: Step[];
  smooth: Step[] | null;
  sig: Step;
  candles: PlotCandleData[];
  downCandles: PlotCandleData[];
  signalPlot: { time: number; value: number }[];
}

function study(inputs: Partial<LinRegCandlesInputs>): BarStudy<LinRegCandlesRun, Result> {
  const { length, smoothLen, signalLength, smaSignal } = { ...defaultInputs, ...inputs };
  const warmup = length + smoothLen;
  const signalWarmup = warmup + signalLength;
  const none = (t: number): PlotCandleData => ({ time: t, open: NaN, high: NaN, low: NaN, close: NaN });
  return {
    init() {
      // LinReg on each OHLC component
      const lr: Step[] = [0, 1, 2, 3].map(() => new LinregStep(length));
      // Optional SMA smoothing
      const smooth = smoothLen > 1 ? [0, 1, 2, 3].map(() => new WindowSma(smoothLen)) : null;
      // Pine: signal = sma_signal ? sma(bclose, signal_length) : ema(bclose, signal_length)
      const sig: Step = smaSignal ? new WindowSma(signalLength) : taStep.ema(signalLength);
      const s: LinRegCandlesRun = {
        lr, smooth, sig, candles: [], downCandles: [], signalPlot: [],
        steps: [...lr, ...(smooth ?? []), sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.candles, s.downCandles, s.signalPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const lrO = s.lr[0].step(b.open);
      const lrH = s.lr[1].step(b.high);
      const lrL = s.lr[2].step(b.low);
      const lrC = s.lr[3].step(b.close);
      let o: number | null = lrO;
      let h: number | null = lrH;
      let l: number | null = lrL;
      let c: number | null = lrC;
      if (s.smooth) {
        o = s.smooth[0].step(lrO ?? NaN);
        h = s.smooth[1].step(lrH ?? NaN);
        l = s.smooth[2].step(lrL ?? NaN);
        c = s.smooth[3].step(lrC ?? NaN);
      }

      if (i < warmup || o == null || c == null) {
        s.candles[i] = none(time);
        s.downCandles[i] = none(time);
      } else {
        // r = bopen < bclose: the first plotcandle draws the candle when r, the second one otherwise
        const r = o < c;
        const col = r ? '#26A69A' : '#EF5350';
        const candle: PlotCandleData = { time, open: o, high: h!, low: l!, close: c, color: col, borderColor: col, wickColor: col };
        s.candles[i] = r ? candle : none(time);
        s.downCandles[i] = r ? none(time) : candle;
      }

      // Compute signal from the linreg close values (finalC)
      const v = s.sig.step(c != null && i >= warmup ? c : NaN);
      s.signalPlot[i] = { time: b.time, value: (i < signalWarmup || v == null || isNaN(v)) ? NaN : v };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { signal: s.signalPlot.slice() },
        plotCandles: { candle0: s.candles.slice(), candle1: s.downCandles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LinRegCandlesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LinRegCandlesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const LinRegCandles = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
