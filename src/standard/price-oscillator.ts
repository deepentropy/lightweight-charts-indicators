/**
 * Price Oscillator (Percentage Price Oscillator, PPO)
 *
 * Difference between a fast and a slow moving average of the source, as a percentage of the slow one:
 * ppo = 100 * (fastMA - slowMA) / slowMA. A signal line (MA of the PPO) and a histogram (ppo - signal) complete it.
 * The histogram is teal above 0 and red below 0, bright when it rises versus the previous bar and pale otherwise.
 * The moving averages are EMA or SMA (oscillator and signal types chosen separately).
 *
 * Based on the standard "Percentage Price Oscillator" indicator.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';

export type PriceOscillatorMaType = 'EMA' | 'SMA';

export interface PriceOscillatorInputs {
  /** Price source */
  src: SourceType;
  /** Fast MA length */
  shortLength: number;
  /** Slow MA length */
  longLength: number;
  /** Signal MA length */
  signalLength: number;
  /** MA type of the fast and slow averages */
  oscMaType: PriceOscillatorMaType;
  /** MA type of the signal line */
  signalMaType: PriceOscillatorMaType;
}

export const defaultInputs: PriceOscillatorInputs = {
  src: 'close',
  shortLength: 12,
  longLength: 26,
  signalLength: 9,
  oscMaType: 'EMA',
  signalMaType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'shortLength', type: 'int', title: 'Fast length', defval: 12, min: 1 },
  { id: 'longLength', type: 'int', title: 'Slow length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal length', defval: 9, min: 1 },
  { id: 'oscMaType', type: 'string', title: 'Oscillator MA type', defval: 'EMA', options: ['EMA', 'SMA'], display: 'none' },
  { id: 'signalMaType', type: 'string', title: 'Signal MA type', defval: 'EMA', options: ['EMA', 'SMA'], display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#2962FF', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'PPO', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Signal line', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B8680', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: 'Percentage Price Oscillator',
  shortTitle: 'PPO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<PriceOscillatorInputs> = {}): IndicatorResult {
  const { src, shortLength, longLength, signalLength, oscMaType, signalMaType } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const ma = (source: Series, length: number, maType: PriceOscillatorMaType) =>
    maType === 'SMA' ? ta.sma(source, length) : ta.ema(source, length);

  const source = getSourceSeries(bars, src);
  const maFast = A(ma(source, shortLength, oscMaType));
  const maSlow = A(ma(source, longLength, oscMaType));
  // A plain division: x / 0 is +-infinity (0 / 0 NaN); the plots show na for infinity
  const ppo = maFast.map((f, i) => (100.0 * (f - maSlow[i])) / maSlow[i]);
  const signal = A(ma(Series.fromArray(bars, ppo), signalLength, signalMaType));
  const hist = ppo.map((p, i) => p - signal[i]);

  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  const histData = hist.map((h, i) => {
    const prev = i > 0 ? hist[i - 1] : NaN;
    const color = ge(h, 0) ? (gt(h, prev) ? '#26A69A' : '#B2DFDB') : gt(h, prev) ? '#FFCDD2' : '#FF5252';
    return { time: bars[i].time, value: val(h), color };
  });

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': histData,
      'plot1': ppo.map((v, i) => ({ time: bars[i].time, value: val(v) })),
      'plot2': signal.map((v, i) => ({ time: bars[i].time, value: val(v) })),
    },
  };
}

export const PriceOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
