/**
 * Simple Moving Average (SMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Matches the standard built-in SMA indicator.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/**
 * SMA indicator input parameters
 */
export interface SMAInputs {
  len: number;
  src: SourceType;
  offset: number;
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: SMAInputs = {
  len: 9,
  src: 'close',
  offset: 0,
  maType: 'None',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500, display: 'none' },
  { id: 'maType', type: 'string', title: 'Type', defval: 'None', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], group: 'Smoothing', display: 'none' },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'none', active: { input: 'maType', ne: 'None' } },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, group: 'Smoothing', tooltip: 'Only applies when \'SMA + Bollinger Bands\' is selected. Determines the distance between the SMA and the bands.', display: 'none', step: 0.5, active: { input: 'maType', eq: 'SMA + Bollinger Bands' } },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'SMA-based MA', color: '#E2CC00', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#089981', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#089981', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Simple Moving Average',
  shortTitle: 'SMA',
  overlay: true,
};

type Point = { time: number; value: number };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface SmaRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  ma: Ma | null;
  dev: WindowStdev | null;
  plotData: Point[];
  maData: Point[];
  bbUpperData: Point[];
  bbLowerData: Point[];
}

function study(inputs: Partial<SMAInputs>): BarStudy<SmaRun, IndicatorResult> {
  const { len, src, maType, maLength, bbMult } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';
  const maStep = (): Ma | null => {
    if (!enableMA) return null;
    switch (maType) {
      case 'EMA': { const m = taStep.ema(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, maLength), commit: () => m.commit() }; }
      case 'VWMA': { const m = new WindowVwma(maLength); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = new WindowSma(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const sma = new WindowSma(len);
      const ma = maStep();
      const dev = enableMA && isBB ? new WindowStdev(maLength) : null;
      const s: SmaRun = {
        sma, ma, dev, plotData: [], maData: [], bbUpperData: [], bbLowerData: [],
        steps: [sma, ...(ma ? [ma] : []), ...(dev ? [dev] : [])], vars: {}, lists: [], series: [],
      };
      s.series = [s.plotData, s.maData, s.bbUpperData, s.bbLowerData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      const v = s.sma.step(value(b));
      s.plotData[i] = { time, value: v };
      const ma = s.ma ? s.ma.step(v, b.volume ?? 0) : NaN;
      s.maData[i] = { time, value: ma };
      const sd = s.dev ? s.dev.step(v) : NaN;
      s.bbUpperData[i] = { time, value: s.dev ? ma + sd * bbMult : NaN };
      s.bbLowerData[i] = { time, value: s.dev ? ma - sd * bbMult : NaN };
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
export function createRun(inputs: Partial<SMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

/**
 * Calculate SMA indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<SMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * SMA indicator module
 */
export const SMA = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
