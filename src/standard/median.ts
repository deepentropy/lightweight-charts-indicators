/**
 * Median Indicator
 *
 * The median (50th percentile, nearest rank) of the source over `length` bars, with bands at
 * median +- ATR multiplier * ATR and an EMA of the median. The area between the median and its EMA is green
 * when the median is above the EMA, fuchsia otherwise.
 *
 * Based on the standard "Median" indicator.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MedianInputs {
  /** Median source */
  source: SourceType;
  /** Median calculation length */
  length: number;
  /** ATR length */
  atrLength: number;
  /** ATR multiplier for bands */
  atrMult: number;
}

export const defaultInputs: MedianInputs = {
  source: 'hl2',
  length: 3,
  atrLength: 14,
  atrMult: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Median Source', defval: 'hl2' },
  { id: 'length', type: 'int', title: 'Median Length', defval: 3 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMult', type: 'int', title: 'ATR Multiplier', defval: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Median', color: '#F23645', lineWidth: 3 },
  { id: 'plot1', title: 'Upper Band', color: '#00E676', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#E040FB', lineWidth: 1 },
  { id: 'plot3', title: 'Median EMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Median',
  shortTitle: 'Median',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<MedianInputs> = {}): IndicatorResult {
  const { source, length, atrLength, atrMult } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // median = ta.percentile_nearest_rank(source, length, 50)
  const median = A(ta.percentile_nearest_rank(getSourceSeries(bars, source), length, 50));
  // atr_ = atr_mult * ta.atr(atr_length)
  const atr = A(ta.atr(bars, atrLength)).map((v) => atrMult * v);
  // median_ema = ta.ema(median, length)
  const medianEma = A(ta.ema(Series.fromArray(bars, median), length));

  const t = (i: number) => bars[i].time;
  // fill colour: median > median_ema ? color.new(color.lime, 10) : color.new(color.fuchsia, 10)
  const fillColors = bars.map((_b, i) => (gt(median[i], medianEma[i]) ? '#00E676E6' : '#E040FBE6'));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      plot0: bars.map((_b, i) => ({ time: t(i), value: median[i] })),
      plot1: bars.map((_b, i) => ({ time: t(i), value: median[i] + atr[i] })),
      plot2: bars.map((_b, i) => ({ time: t(i), value: median[i] - atr[i] })),
      plot3: bars.map((_b, i) => ({ time: t(i), value: medianEma[i] })),
    },
    fills: [{ plot1: 'plot0', plot2: 'plot3', options: { title: 'Fill color' }, colors: fillColors }],
  };
}

export const Median = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
