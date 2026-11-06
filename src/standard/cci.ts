/**
 * Commodity Channel Index (CCI) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures the variation of a security's price from its statistical mean.
 * High values show the price is unusually high compared to average, low values show it's unusually low.
 */

import { taStep, taCore, compare, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, WindowVwma, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface CCIInputs {
  length: number;
  src: SourceType;
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: CCIInputs = {
  length: 20,
  src: 'hlc3',
  maType: 'SMA',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], group: 'Smoothing', display: 'none' },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'none', active: { input: 'maType', ne: 'None' } },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, group: 'Smoothing', tooltip: 'Only applies when \'SMA + Bollinger Bands\' is selected. Determines the distance between the SMA and the bands.', display: 'none', step: 0.5, active: { input: 'maType', eq: 'SMA + Bollinger Bands' } },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CCI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'CCI-based MA', color: '#E2CC00', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#089981', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#089981', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 100, color: '#787B86', linestyle: 'dashed', title: 'Upper Band' },
  { id: 'hline_mid',   price: 0, color: '#787B8680', linestyle: 'solid', title: 'Middle Band' },
  { id: 'hline_lower', price: -100, color: '#787B86', linestyle: 'dashed', title: 'Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF1A' },
];

export const metadata = {
  title: 'Commodity Channel Index',
  shortTitle: 'CCI',
  overlay: false,
};

/**
 * `ta.cci(source, length)` one bar at a time with a {@link WindowSma} mean (the doubles of taStep.cci, which steps two
 * slower window sums): (source - sma) / (0.015 * dev); a zero dev keeps the previous value (0 at the start).
 */
class CciStep implements Committable {
  private readonly mean: WindowSma;
  private readonly len: number;
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;
  private last = 0;
  private next = 0;

  constructor(length: number) {
    // the length check of ta.cci (the same runtime error)
    taCore.cci([], length);
    this.len = Math.floor(length);
    this.mean = new WindowSma(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    this.next = this.last;
    const mean = this.mean.step(value);
    const n = this.values.length;
    if (n < this.len - 1 || Number.isNaN(mean)) return NaN;
    // ta.dev: the mean of |source - sma| over the last `length` bars
    let sum = 0;
    for (let k = 0; k < this.len; k++) sum += Math.abs((k === 0 ? value : this.values[n - k]!) - mean);
    const d = sum / this.len;
    if (Number.isNaN(d)) return NaN;
    if (!compare.eq(d, 0)) this.next = (value - mean) / (0.015 * d);
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    this.mean.commit();
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

type Point = { time: number; value: number };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface CciRun extends BarRunState<Record<string, never>> {
  cci: CciStep;
  ma: Ma | null;
  dev: WindowStdev | null;
  plotData: Point[];
  maData: Point[];
  bbUpperData: Point[];
  bbLowerData: Point[];
}

function study(inputs: Partial<CCIInputs>): BarStudy<CciRun, IndicatorResult> {
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
      default: return new WindowSma(maLength);
    }
  };
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const cci = new CciStep(length);
      const ma = maStep();
      const dev = enableMA && isBB ? new WindowStdev(maLength) : null;
      const s: CciRun = {
        cci, ma, dev, plotData: [], maData: [], bbUpperData: [], bbLowerData: [],
        steps: [cci, ...(ma ? [ma] : []), ...(dev ? [dev] : [])], vars: {}, lists: [], series: [],
      };
      s.series = [s.plotData, s.maData, s.bbUpperData, s.bbLowerData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const c = s.cci.step(value(b));
      s.plotData[i] = { time, value: c };
      const ma = s.ma ? s.ma.step(c, b.volume ?? 0) : NaN;
      s.maData[i] = { time, value: ma };
      const sd = s.dev ? s.dev.step(c) : NaN;
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
export function createRun(inputs: Partial<CCIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CCIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CCI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
