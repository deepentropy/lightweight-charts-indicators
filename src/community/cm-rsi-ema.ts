/**
 * CM RSI Plus EMA
 *
 * RSI with EMA overlay applied to the RSI line.
 * Useful for identifying RSI trend direction and crossover signals.
 *
 * Reference: "CM_RSI Plus EMA" by ChrisMoody
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CMRSIPlusEMAInputs {
  rsiLen: number;
  emaLen: number;
  src: SourceType;
}

export const defaultInputs: CMRSIPlusEMAInputs = {
  rsiLen: 20,
  emaLen: 10,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 20, min: 1 },
  { id: 'emaLen', type: 'int', title: 'EMA of RSI Length', defval: 10, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 2 },
  { id: 'plot1', title: 'EMA of RSI', color: '#FF6D00', lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'Upper Band', color: 'transparent', lineWidth: 0 },
  { id: 'plot3', title: 'Lower Band', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'CM RSI Plus EMA',
  shortTitle: 'CMRSIEMA',
  overlay: false,
};

type Point = { time: number; value: number };

interface CmRsiRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  emaArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(inputs: Partial<CMRSIPlusEMAInputs>): BarStudy<CmRsiRun, IndicatorResult> {
  const { rsiLen, emaLen, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const alpha = 2 / (emaLen + 1);
  const warmup = rsiLen;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(rsiLen);
      const s: CmRsiRun = {
        rsi, emaArr: [], plot0: [], plot1: [], plot2: [], plot3: [], steps: [rsi], vars: {}, lists: [], series: [],
      };
      s.series = [s.emaArr, s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const r = s.rsi.step(value(b));
      const emaArr = s.emaArr;
      // EMA of RSI computed bar-by-bar
      if (r == null) {
        emaArr[i] = NaN;
      } else if (i === 0 || isNaN(emaArr[i - 1])) {
        emaArr[i] = r;
      } else {
        emaArr[i] = alpha * r + (1 - alpha) * emaArr[i - 1];
      }
      const v = emaArr[i];
      s.plot0[i] = { time: b.time, value: (r == null || i < warmup) ? NaN : r };
      s.plot1[i] = { time: b.time, value: (isNaN(v) || i < warmup) ? NaN : v };
      s.plot2[i] = { time: b.time, value: 80 };
      s.plot3[i] = { time: b.time, value: 20 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice() },
        hlines: [
          { value: 80, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Upper Line' } },
          { value: 20, options: { color: '#00E676', linestyle: 'dashed' as const, title: 'Lower Line' } },
        ],
        fills: [
          { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(126,87,194,0.1)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CMRSIPlusEMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMRSIPlusEMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CMRSIPlusEMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
