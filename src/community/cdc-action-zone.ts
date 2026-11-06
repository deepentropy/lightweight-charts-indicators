/**
 * CDC Action Zone V.2
 *
 * Two-EMA crossover system with an intermediate smoothing layer.
 * AP = EMA(source, 2), Fast = EMA(AP, short), Slow = EMA(AP, long).
 * Zones: Green (bullish + AP > Fast), Red (bearish + AP < Fast),
 * Yellow (bullish + AP < Fast), Blue (bearish + AP > Fast).
 *
 * Reference: "CDC Action Zone V.2"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CDCActionZoneInputs {
  source: SourceType;
  shortPeriod: number;
  longPeriod: number;
}

export const defaultInputs: CDCActionZoneInputs = {
  source: 'ohlc4',
  shortPeriod: 12,
  longPeriod: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'ohlc4' },
  { id: 'shortPeriod', type: 'int', title: 'Short MA Period', defval: 12, min: 1 },
  { id: 'longPeriod', type: 'int', title: 'Long MA Period', defval: 26, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast', color: '#EF5350', lineWidth: 1 },
  { id: 'plot1', title: 'Slow', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'CDC Action Zone',
  shortTitle: 'CDC',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };
type Point = { time: any; value: number };
type Ema = ReturnType<typeof taStep.ema>;

interface CdcRun extends BarRunState<Record<string, never>> {
  ap: Ema;
  fast: Ema;
  slow: Ema;
  fastData: Point[];
  slowData: Point[];
  fillColors: string[];
  barColors: BarColorData[];
}

function study(inputs: Partial<CDCActionZoneInputs>): BarStudy<CdcRun, Result> {
  const { source, shortPeriod, longPeriod } = { ...defaultInputs, ...inputs };
  const value = barSource(source);
  return {
    fullRunReason: () => (isBarSource(source) ? null : 'source of another study'),
    init() {
      const ap = taStep.ema(2);
      const fast = taStep.ema(shortPeriod);
      const slow = taStep.ema(longPeriod);
      const s: CdcRun = {
        ap, fast, slow, fastData: [], slowData: [], fillColors: [], barColors: [], steps: [ap, fast, slow], vars: {},
        lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.fastData, s.slowData, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const apv = s.ap.step(value(bars[i]));
      const fv = s.fast.step(apv);
      const sv = s.slow.step(apv);
      s.fastData[i] = { time, value: i < longPeriod ? NaN : (fv ?? NaN) };
      s.slowData[i] = { time, value: i < longPeriod ? NaN : (sv ?? NaN) };

      // Zone coloring: Green (bull + AP>Fast), Yellow (bull + AP<Fast), Red (bear + AP<Fast), Blue (bear + AP>Fast)
      if (i < longPeriod) { s.fillColors[i] = 'transparent'; return; }
      const f = fv ?? 0;
      const s2 = sv ?? 0;
      const a = apv ?? 0;
      const bullish = f > s2;
      let color: string;
      if (bullish && a > f) color = '#00FF00';       // Green zone
      else if (bullish && a <= f) color = '#FFFF00';  // Yellow zone
      else if (!bullish && a < f) color = '#FF0000';  // Red zone
      else color = '#0000FF';                          // Blue zone
      s.barColors.push({ time: time as number, color });
      s.fillColors[i] = color + '40'; // 25% alpha
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.fastData.slice(), 'plot1': s.slowData.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CDCActionZoneInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CDCActionZoneInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CDCActionZone = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
