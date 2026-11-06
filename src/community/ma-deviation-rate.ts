/**
 * Moving Average Deviation Rate
 *
 * Measures how far price deviates from its MA as a percentage.
 * deviation_rate = (source - ma) / ma * 100
 *
 * Reference: "Moving Average Deviation Rate" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MADeviationRateInputs {
  length: number;
  numStdDev: number;
  maType: string;
  src: SourceType;
}

export const defaultInputs: MADeviationRateInputs = {
  length: 21,
  numStdDev: 2,
  maType: 'sma',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Moving average period', defval: 21, min: 1 },
  { id: 'numStdDev', type: 'int', title: 'Number of Std Deviations', defval: 2, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'sma', options: ['sma', 'ema', 'wma'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Deviation Rate', color: '#EF5350', lineWidth: 1 },
  { id: 'plot1', title: 'Center', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: 'HiBound', color: 'rgba(255,255,255,0.7)', lineWidth: 1 },
  { id: 'plot3', title: 'LoBound', color: 'rgba(255,255,255,0.7)', lineWidth: 1 },
];

export const hlineConfig = [
  { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
];

export const metadata = {
  title: 'Moving Average Deviation Rate',
  shortTitle: 'MADR',
  overlay: false,
};

type Point = { time: number; value: number };
type Ma = { step(v: number): number; commit(): void };

/** The moving average of the source stepped bar by bar */
function maStep(length: number, maType: string): Ma {
  switch (maType) {
    case 'ema': return taStep.ema(length);
    case 'wma': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    default: return new WindowSma(length);
  }
}

interface MadrRun extends BarRunState<Record<string, never>> {
  ma: Ma;
  center: WindowSma;
  dev: WindowStdev;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  hiFillColors: string[];
  loFillColors: string[];
}

function study(inputs: Partial<MADeviationRateInputs>): BarStudy<MadrRun, IndicatorResult> {
  const { length, numStdDev, maType, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  // stdCenter = SMA(rate, length * numStdDev), std = STDEV(rate, length * numStdDev)
  const devPeriod = length * numStdDev;
  const warmup = length + devPeriod;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const ma = maStep(length, maType);
      const center = new WindowSma(devPeriod);
      const dev = new WindowStdev(devPeriod);
      const s: MadrRun = {
        ma, center, dev, plot0: [], plot1: [], plot2: [], plot3: [], hiFillColors: [], loFillColors: [],
        steps: [ma, center, dev], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.hiFillColors, s.loFillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time;
      const srcV = value(b);
      const maVal = s.ma.step(srcV);
      // deviation rate = close / sma * 100 - 100
      const rate = i < length || !maVal || maVal === 0 ? NaN : (srcV ?? 0) / maVal * 100 - 100;
      const center = s.center.step(rate);
      const std = s.dev.step(rate);
      let plusDev: number;
      let minusDev: number;
      if (i < warmup || isNaN(center) || isNaN(std)) {
        plusDev = NaN;
        minusDev = NaN;
      } else {
        plusDev = center + std * numStdDev;
        minusDev = center - std * numStdDev;
      }
      // Dynamic fill colors: rate > plusDev → red, rate < minusDev → lime, else transparent
      s.hiFillColors[i] = (!isNaN(rate) && !isNaN(plusDev) && rate > plusDev) ? 'rgba(252, 3, 3, 0.5)' : 'rgba(128, 128, 128, 0)';
      s.loFillColors[i] = (!isNaN(rate) && !isNaN(minusDev) && rate < minusDev) ? 'rgba(0, 255, 0, 0.5)' : 'rgba(128, 128, 128, 0)';
      s.plot0[i] = { time, value: isNaN(rate) ? NaN : rate };
      s.plot1[i] = { time, value: (i < warmup || isNaN(center)) ? NaN : center };
      s.plot2[i] = { time, value: isNaN(plusDev) ? NaN : plusDev };
      s.plot3[i] = { time, value: isNaN(minusDev) ? NaN : minusDev };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice() },
        hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
        fills: [
          { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(128, 128, 128, 0.1)' } },
          { plot1: 'plot1', plot2: 'plot3', options: { color: 'rgba(128, 128, 128, 0.1)' } },
          { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(252, 3, 3, 0.3)' }, colors: s.hiFillColors.slice() },
          { plot1: 'plot0', plot2: 'plot3', options: { color: 'rgba(0, 255, 0, 0.3)' }, colors: s.loFillColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MADeviationRateInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MADeviationRateInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MADeviationRate = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
