/**
 * CCT Bollinger Band Oscillator
 *
 * Normalizes price position within Bollinger Bands to 0-100 scale.
 * cctbbo = 100 * (src + 2*stdev - sma) / (4 * stdev)
 *
 * Reference: "CCT Bollinger Band Oscillator" by LazyBear
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CCTBBOInputs {
  length: number;
  lengthMA: number;
  src: SourceType;
}

export const defaultInputs: CCTBBOInputs = {
  length: 21,
  lengthMA: 13,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21, min: 1 },
  { id: 'lengthMA', type: 'int', title: 'EMA Length', defval: 13, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CCTBBO', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'EMA', color: '#FF6D00', lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 100, color: '#787B86', linestyle: 'solid' },
  { id: 'hline_mid', price: 50, color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_lower', price: 0, color: '#787B86', linestyle: 'solid' },
];

export const fillConfig = [
  { id: 'fill0', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF20' },
];

export const metadata = {
  title: 'CCT Bollinger Band Oscillator',
  shortTitle: 'CCTBBO',
  overlay: false,
};

type Point = { time: any; value: number };

interface CctRun extends BarRunState<Record<string, never>> {
  sd: WindowStdev;
  sma: WindowSma;
  ema: ReturnType<typeof taStep.ema>;
  cctData: Point[];
  emaData: Point[];
}

function study(inputs: Partial<CCTBBOInputs>): BarStudy<CctRun, IndicatorResult> {
  const { length, lengthMA, src } = { ...defaultInputs, ...inputs };
  const source = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const sd = new WindowStdev(length);
      const sma = new WindowSma(length);
      const ema = taStep.ema(lengthMA);
      const s: CctRun = { sd, sma, ema, cctData: [], emaData: [], steps: [sd, sma, ema], vars: {}, lists: [], series: [] };
      s.series = [s.cctData, s.emaData];
      return s;
    },
    bar(s, i, bars) {
      const v = source(bars[i]);
      const sd = s.sd.step(v);
      const sma = s.sma.step(v);
      // cctbbo = 100 * (src + 2*stdev - sma) / (4 * stdev)
      const cctbbo = (v + sd * 2 - sma) / (sd * 4) * 100;
      const e = s.ema.step(cctbbo);
      s.cctData[i] = { time: bars[i].time, value: cctbbo ?? NaN };
      s.emaData[i] = { time: bars[i].time, value: e ?? NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.cctData.slice(), 'plot1': s.emaData.slice() },
        hlines: [
          { value: 100, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Upper' } },
          { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Mid' } },
          { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Lower' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { color: 'rgba(41, 98, 255, 0.12)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CCTBBOInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CCTBBOInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CCTBBO = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
