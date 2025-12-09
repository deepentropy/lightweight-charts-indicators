/**
 * Price Oscillator (PPO) Indicator
 *
 * Similar to MACD but expressed as a percentage.
 * PPO = ((Short MA - Long MA) / Long MA) * 100
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface PriceOscillatorInputs {
  /** Short MA length */
  shortLength: number;
  /** Long MA length */
  longLength: number;
  /** Signal line length */
  signalLength: number;
  /** Price source */
  src: SourceType;
  /** Use exponential MA */
  exponential: boolean;
}

export const defaultInputs: PriceOscillatorInputs = {
  shortLength: 12,
  longLength: 26,
  signalLength: 9,
  src: 'close',
  exponential: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 12, min: 1 },
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'exponential', type: 'bool', title: 'Use Exponential MA', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'PPO', color: '#009688', lineWidth: 1 },
  { id: 'plot2', title: 'Signal Line', color: '#FF9800', lineWidth: 1 },
];

export const metadata = {
  title: 'Price Oscillator',
  shortTitle: 'PPO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PriceOscillatorInputs> = {}): IndicatorResult {
  const { shortLength, longLength, signalLength, src, exponential } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);

  // Calculate short and long MAs
  const shortMA = exponential ? ta.ema(source, shortLength) : ta.sma(source, shortLength);
  const longMA = exponential ? ta.ema(source, longLength) : ta.sma(source, longLength);

  const shortArr = shortMA.toArray();
  const longArr = longMA.toArray();

  // PPO = ((short - long) / long) * 100
  const ppo: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const s = shortArr[i];
    const l = longArr[i];

    if (s == null || l == null || l === 0) {
      ppo.push(NaN);
    } else {
      ppo.push(((s - l) / l) * 100);
    }
  }

  // Signal line = MA of PPO
  const ppoSeries = new Series(bars, (_, i) => ppo[i]);
  const signalSeries = exponential ? ta.ema(ppoSeries, signalLength) : ta.sma(ppoSeries, signalLength);
  const signalArr = signalSeries.toArray();

  // Histogram = PPO - Signal
  const histogram: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const p = ppo[i];
    const s = signalArr[i];

    if (isNaN(p) || s == null) {
      histogram.push(NaN);
    } else {
      histogram.push(p - s);
    }
  }

  const histData = histogram.map((value, i) => ({ time: bars[i].time, value }));
  const ppoData = ppo.map((value, i) => ({ time: bars[i].time, value }));
  const signalData = signalArr.map((value, i) => ({ time: bars[i].time, value: value ?? NaN }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': histData,
      'plot1': ppoData,
      'plot2': signalData,
    },
  };
}

export const PriceOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
