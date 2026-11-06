/**
 * Exponential Moving Average (EMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A weighted moving average that gives more weight to recent prices.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EMAInputs {
  length: number;
  src: SourceType;
  offset: number;
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: EMAInputs = {
  length: 9,
  src: 'close',
  offset: 0,
  maType: 'None',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500, display: 'none' },
  { id: 'maType', type: 'string', title: 'Type', defval: 'None', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], group: 'Smoothing', display: 'none' },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'none', active: { input: 'maType', ne: 'None' } },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, group: 'Smoothing', tooltip: 'Only applies when \'SMA + Bollinger Bands\' is selected. Determines the distance between the SMA and the bands.', display: 'none', step: 0.5, active: { input: 'maType', eq: 'SMA + Bollinger Bands' } },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'EMA-based MA', color: '#E2CC00', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#089981', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#089981', lineWidth: 1 },
];

export const metadata = {
  title: 'Moving Average Exponential',
  shortTitle: 'EMA',
  overlay: true,
};

type Point = { time: number; value: number };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface EmaRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  ma: Ma | null;
  dev: WindowStdev | null;
  plotData: Point[];
  maData: Point[];
  bbUpperData: Point[];
  bbLowerData: Point[];
}

function study(inputs: Partial<EMAInputs>): BarStudy<EmaRun, IndicatorResult> {
  const { length, src, maType, maLength, bbMult } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';
  const maStep = (): Ma | null => {
    if (!enableMA) return null;
    switch (maType) {
      case 'EMA': { const m = taStep.ema(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, maLength), commit: () => m.commit() }; }
      case 'VWMA': return new WindowVwma(maLength);
      default: { const m = new WindowSma(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const ema = taStep.ema(length);
      const ma = maStep();
      const dev = enableMA && isBB ? new WindowStdev(maLength) : null;
      const s: EmaRun = {
        ema, ma, dev, plotData: [], maData: [], bbUpperData: [], bbLowerData: [],
        steps: [ema, ...(ma ? [ma] : []), ...(dev ? [dev] : [])], vars: {}, lists: [], series: [],
      };
      s.series = [s.plotData, s.maData, s.bbUpperData, s.bbLowerData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const ema = s.ema.step(value(b));
      s.plotData[i] = { time, value: ema };
      // the MA of the EMA (VWMA: volume na read as 0)
      const ma = s.ma ? s.ma.step(ema, b.volume ?? 0) : NaN;
      s.maData[i] = { time, value: ma };
      if (s.dev) {
        const sd = s.dev.step(ema);
        s.bbUpperData[i] = { time, value: ma + sd * bbMult };
        s.bbLowerData[i] = { time, value: ma - sd * bbMult };
      } else {
        s.bbUpperData[i] = { time, value: NaN };
        s.bbLowerData[i] = { time, value: NaN };
      }
    },
    result(s) {
      const fills: FillData[] = [];
      if (enableMA && isBB) fills.push({ plot1: 'plot2', plot2: 'plot3', options: { color: '#089981', transp: 90, title: 'BB Background' } });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plotData.slice(), 'plot1': s.maData.slice(), 'plot2': s.bbUpperData.slice(), 'plot3': s.bbLowerData.slice() },
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const EMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
