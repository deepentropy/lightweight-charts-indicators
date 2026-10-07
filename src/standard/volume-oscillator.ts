/**
 * Volume Oscillator (Percentage Volume Oscillator, PVO)
 *
 * Difference between a fast and a slow moving average of volume, as a percentage of the slow one:
 * pvo = 100 * (fastMA - slowMA) / slowMA. A signal line (MA of the PVO) and a histogram (pvo - signal) complete it.
 * The histogram is teal above 0 and red below 0, bright when it rises versus the previous bar and pale otherwise.
 * The moving averages are EMA or SMA.
 *
 * Based on the standard "Volume Oscillator" indicator (Percentage Volume Oscillator).
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';

export type VolumeOscillatorMaType = 'EMA' | 'SMA';

export interface VolumeOscillatorInputs {
  /** Fast MA length */
  shortLength: number;
  /** Slow MA length */
  longLength: number;
  /** Signal MA length */
  signalLength: number;
  /** MA type of the fast and slow volume averages */
  oscMaType: VolumeOscillatorMaType;
  /** MA type of the signal line */
  signalMaType: VolumeOscillatorMaType;
}

export const defaultInputs: VolumeOscillatorInputs = {
  shortLength: 12,
  longLength: 26,
  signalLength: 9,
  oscMaType: 'EMA',
  signalMaType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLength', type: 'int', title: 'Fast length', defval: 12, min: 1 },
  { id: 'longLength', type: 'int', title: 'Slow length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal length', defval: 9, min: 1 },
  { id: 'oscMaType', type: 'string', title: 'Oscillator MA type', defval: 'EMA', options: ['EMA', 'SMA'], display: 'none' },
  { id: 'signalMaType', type: 'string', title: 'Signal MA type', defval: 'EMA', options: ['EMA', 'SMA'], display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'histogram', title: 'Histogram', color: '#2962FF', lineWidth: 1, style: 'columns' },
  { id: 'plot0', title: 'PVO', color: '#2962FF', lineWidth: 1 },
  { id: 'signal', title: 'Signal line', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B8680', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: 'Percentage Volume Oscillator',
  shortTitle: 'PVO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<VolumeOscillatorInputs> = {}): IndicatorResult {
  const { shortLength, longLength, signalLength, oscMaType, signalMaType } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const ma = (source: Series, length: number, maType: VolumeOscillatorMaType) =>
    maType === 'SMA' ? ta.sma(source, length) : ta.ema(source, length);

  const volume = Series.fromArray(bars, bars.map((b) => b.volume ?? NaN));
  const maFast = A(ma(volume, shortLength, oscMaType));
  const maSlow = A(ma(volume, longLength, oscMaType));
  // A plain division: x / 0 is +-infinity (0 / 0 NaN); the plots show na for infinity
  const pvo = maFast.map((f, i) => (100.0 * (f - maSlow[i])) / maSlow[i]);
  const signal = A(ma(Series.fromArray(bars, pvo), signalLength, signalMaType));
  const hist = pvo.map((p, i) => p - signal[i]);

  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  const histogram = hist.map((h, i) => {
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
      histogram,
      plot0: pvo.map((v, i) => ({ time: bars[i].time, value: val(v) })),
      signal: signal.map((v, i) => ({ time: bars[i].time, value: val(v) })),
    },
  };
}

export const VolumeOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
