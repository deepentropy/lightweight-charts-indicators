/**
 * Moving Average Convergence Divergence (MACD) Indicator
 *
 * Trend-following momentum indicator: macd = fastMA - slowMA of the source, a signal line (MA of the MACD) and a
 * histogram (macd - signal). The histogram is teal above 0 and red below 0, bright when it rises versus the previous
 * bar and pale otherwise. The moving averages are EMA or SMA (oscillator and signal types chosen separately).
 *
 * Based on the standard "Moving Average Convergence Divergence" indicator. Its two alertcondition() calls
 * (histogram sign changes) are not ported.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';

export type MACDMaType = 'EMA' | 'SMA';

export interface MACDInputs {
  /** Price source */
  src: SourceType;
  /** Fast MA length */
  fastLength: number;
  /** Slow MA length */
  slowLength: number;
  /** Signal MA length */
  signalLength: number;
  /** MA type of the fast and slow averages */
  oscMaType: MACDMaType;
  /** MA type of the signal line */
  signalMaType: MACDMaType;
}

export const defaultInputs: MACDInputs = {
  src: 'close',
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  oscMaType: 'EMA',
  signalMaType: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'fastLength', type: 'int', title: 'Fast length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal length', defval: 9, min: 1 },
  { id: 'oscMaType', type: 'string', title: 'Oscillator MA type', defval: 'EMA', options: ['EMA', 'SMA'], display: 'none' },
  { id: 'signalMaType', type: 'string', title: 'Signal MA type', defval: 'EMA', options: ['EMA', 'SMA'], display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#2962FF', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'MACD', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Signal line', color: '#FF6D00', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B8680', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: 'Moving Average Convergence Divergence',
  shortTitle: 'MACD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

export function calculate(bars: Bar[], inputs: Partial<MACDInputs> = {}): IndicatorResult {
  const { src, fastLength, slowLength, signalLength, oscMaType, signalMaType } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const ma = (source: Series, length: number, maType: MACDMaType) =>
    maType === 'SMA' ? ta.sma(source, length) : ta.ema(source, length);
  const source = getSourceSeries(bars, src);

  // MACD line = fast MA - slow MA; signal line = MA of the MACD line; histogram = MACD - signal
  const maFast = A(ma(source, fastLength, oscMaType));
  const maSlow = A(ma(source, slowLength, oscMaType));
  const macd = maFast.map((f, i) => f - maSlow[i]);
  const signal = A(ma(Series.fromArray(bars, macd), signalLength, signalMaType));
  const hist = macd.map((m, i) => m - signal[i]);

  const histData = hist.map((h, i) => {
    const prev = i > 0 ? hist[i - 1] : NaN;
    const color = ge(h, 0) ? (gt(h, prev) ? '#26A69A' : '#B2DFDB') : gt(h, prev) ? '#FFCDD2' : '#FF5252';
    return { time: bars[i].time, value: h, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': histData,
      'plot1': macd.map((value, i) => ({ time: bars[i].time, value })),
      'plot2': signal.map((value, i) => ({ time: bars[i].time, value })),
    },
  };
}

export const MACD = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
