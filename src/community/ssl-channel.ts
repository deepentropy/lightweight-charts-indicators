/**
 * SSL Channel
 *
 * Simple crossover channel: SMA of highs and SMA of lows.
 * When close > SMA(high): uptrend → sslUp = SMA(high), sslDown = SMA(low).
 * When close < SMA(low): downtrend → sslUp = SMA(low), sslDown = SMA(high).
 *
 * Reference: "SSL channel"
 */

import type { IndicatorResult, InputConfig, PlotConfig, Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// Pine comparison operators: equal within 1e-10; a comparison with na is false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;


export interface SSLChannelInputs {
  period: number;
}

export const defaultInputs: SSLChannelInputs = {
  period: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SSL Down', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'SSL Up', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'SSL Channel',
  shortTitle: 'SSL',
  overlay: true,
};

type Point = { time: number; value: number };

interface SslRun extends BarRunState<{ hlv: number }> {
  smaHigh: WindowSma;
  smaLow: WindowSma;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<SSLChannelInputs>): BarStudy<SslRun, IndicatorResult> {
  const { period } = { ...defaultInputs, ...inputs };
  const warmup = period;
  return {
    init() {
      const smaHigh = new WindowSma(period);
      const smaLow = new WindowSma(period);
      const s: SslRun = { smaHigh, smaLow, plot0: [], plot1: [], steps: [smaHigh, smaLow], vars: { hlv: 0 }, lists: [], series: [] };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const smaH = s.smaHigh.step(b.high) ?? 0;
      const smaL = s.smaLow.step(b.low) ?? 0;
      const c = b.close;

      if (gt(c, smaH)) s.vars.hlv = 1;
      else if (lt(c, smaL)) s.vars.hlv = -1;
      const hlv = s.vars.hlv;

      const sslDown = hlv < 0 ? smaH : smaL;
      const sslUp = hlv < 0 ? smaL : smaH;
      s.plot0[i] = { time: b.time, value: i < warmup ? NaN : sslDown };
      s.plot1[i] = { time: b.time, value: i < warmup ? NaN : sslUp };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SSLChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SSLChannelInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SSLChannel = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
