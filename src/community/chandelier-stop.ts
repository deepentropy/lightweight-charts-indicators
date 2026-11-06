/**
 * Chandelier Stop
 *
 * ATR trailing stop with direction-colored circles.
 * Ratcheting trailing stop that flips direction when price crosses.
 *
 * Reference: "Chandelier Stop" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ChandelierStopInputs {
  lookback: number;
  atrPeriod: number;
  atrMult: number;
}

export const defaultInputs: ChandelierStopInputs = {
  lookback: 22,
  atrPeriod: 22,
  atrMult: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 22, min: 1 },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 22, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stop Dots', color: '#2962FF', lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'Stop Line', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Chandelier Stop',
  shortTitle: 'CStop',
  overlay: true,
};

interface ChandelierRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  atr: ReturnType<typeof taStep.atr>;
  stop: number[];
  dir: number[];
  plot0: { time: number; value: number; color?: string }[];
  plot1: { time: number; value: number; color?: string }[];
}

function study(inputs: Partial<ChandelierStopInputs>): BarStudy<ChandelierRun, IndicatorResult> {
  const { lookback, atrPeriod, atrMult } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(lookback, atrPeriod);
  return {
    init() {
      const hh = new WindowExtreme(false, lookback);
      const ll = new WindowExtreme(true, lookback);
      const atr = taStep.atr(atrPeriod);
      const s: ChandelierRun = {
        hh, ll, atr, stop: [], dir: [], plot0: [], plot1: [], steps: [hh, ll, atr], vars: {}, lists: [], series: [],
      };
      s.series = [s.stop, s.dir, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      const atr = (s.atr.step(b.high, b.low, b.close) ?? 0) * atrMult;
      const longStop = (hh ?? b.high) - atr;
      const shortStop = (ll ?? b.low) + atr;

      if (i === 0) {
        s.stop[i] = isNaN(longStop) ? b.high : longStop;
        s.dir[i] = 1;
      } else {
        const prevStop = s.stop[i - 1];
        const prevDir = s.dir[i - 1];
        const close = b.close;

        if (prevDir === 1) {
          // Long: ratchet up
          const ls = isNaN(longStop) ? prevStop : longStop;
          s.stop[i] = isNaN(prevStop) ? ls : Math.max(ls, prevStop);
          s.dir[i] = close < s.stop[i] ? -1 : 1;
        } else {
          // Short: ratchet down
          const ss = isNaN(shortStop) ? prevStop : shortStop;
          s.stop[i] = isNaN(prevStop) ? ss : Math.min(ss, prevStop);
          s.dir[i] = close > s.stop[i] ? 1 : -1;
        }
      }

      // Second plot: same values as line (Pine plots pc twice: circles + line)
      if (i < warmup) {
        s.plot0[i] = { time: b.time, value: NaN };
        s.plot1[i] = { time: b.time, value: NaN };
      } else {
        const color = s.dir[i] === 1 ? '#00BCD4' : '#FF00FF';
        s.plot0[i] = { time: b.time, value: s.stop[i], color };
        s.plot1[i] = { time: b.time, value: s.stop[i], color };
      }
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
export function createRun(inputs: Partial<ChandelierStopInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ChandelierStopInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ChandelierStop = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
