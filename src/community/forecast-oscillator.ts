/**
 * Forecast Oscillator (FOSC)
 *
 * Percentage difference between price and its linear regression forecast.
 * fosc = 100 * (src - linreg(src, length, 0)) / src
 *
 * Reference: "Forecast Oscillator" by KivancOzbilgic
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ForecastOscillatorInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: ForecastOscillatorInputs = {
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FOSC', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Forecast Oscillator',
  shortTitle: 'FOSC',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface FoscRun extends BarRunState<Record<string, never>> {
  srcArr: number[];
  fosc: number[];
  plot0: Point[];
}

function study(inputs: Partial<ForecastOscillatorInputs>): BarStudy<FoscRun, IndicatorResult> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const len = Math.floor(length);
  /** ta.linreg(source, length, 0) on bar i: the least squares line of the last `length` bars (na when one is na) */
  const linreg = (srcArr: number[], i: number): number => {
    if (i < len - 1) return NaN;
    const first = i - len + 1;
    for (let j = 0; j < len; j++) if (isNaN(srcArr[first + j])) return NaN;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let j = 0; j < len; j++) {
      const x = j + 1;
      const y = srcArr[first + j];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = sumY / len - (slope * sumX) / len + slope;
    return intercept + slope * (len - 1);
  };
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // the length check of ta.linreg (the same runtime error)
      taStep.linreg(length, 0);
      const s: FoscRun = { srcArr: [], fosc: [], plot0: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.srcArr, s.fosc, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const source = value(bars[i]);
      s.srcArr[i] = source;
      const tsf = linreg(s.srcArr, i);
      // fosc = 100 * (source - tsf) / source
      const v = ((source - tsf) / source) * 100;
      s.fosc[i] = v;
      const prev = i > 0 ? s.fosc[i - 1] : NaN;
      let color: string;
      if (v > prev) color = '#26A69A';       // rising = green
      else if (v < prev) color = '#EF5350';  // falling = red
      else color = '#2962FF';                // neutral = blue
      s.plot0[i] = { time: bars[i].time, value: v, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        hlines: [{ value: 0, options: { color: '#2962FF', linestyle: 'dashed', title: 'Zero' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ForecastOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ForecastOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ForecastOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
