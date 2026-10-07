/**
 * Klinger Oscillator Indicator
 *
 * Volume-based oscillator that measures long-term money flow trends.
 * Uses the difference between two EMAs of signed volume.
 *
 * Based on the standard Klinger Oscillator indicator.
 */

import { Series, ta, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';

/** The original has no inputs: the EMA lengths 34, 55 and 13 are fixed. */
export type KlingerInputs = Record<string, never>;

export const defaultInputs: KlingerInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Klinger Oscillator', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#43A047', lineWidth: 1 },
];

export const metadata = {
  title: 'Klinger Oscillator',
  shortTitle: 'KVO',
  overlay: false,
};

/**
 * Calculate Klinger Oscillator
 *
 * Algorithm from PineScript:
 * sv = ta.change(hlc3) >= 0 ? volume : -volume
 * kvo = ta.ema(sv, 34) - ta.ema(sv, 55)
 * sig = ta.ema(kvo, 13)
 */
export function calculate(bars: Bar[], _inputs: Partial<KlingerInputs> = {}): IndicatorResult {
  const fastLength = 34;
  const slowLength = 55;
  const signalLength = 13;

  // Calculate HLC3
  const hlc3: number[] = bars.map(b => (b.high + b.low + b.close) / 3);
  const hlc3Series = new Series(bars, (_, i) => hlc3[i]);

  // Calculate change in HLC3
  const hlc3ChangeArr = ta.change(hlc3Series, 1).toArray();

  // Calculate signed volume: sv = ta.change(hlc3) >= 0 ? volume : -volume
  // Pine float comparison: change >= 0 unless 0 - change > 1e-10; na (first bar) compares false
  const signedVolume: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const change = hlc3ChangeArr[i];
    const volume = bars[i].volume ?? NaN;
    const up = change != null && !isNaN(change) && !(0 - change > 1e-10);
    signedVolume.push(up ? volume : -volume);
  }

  // Calculate EMAs
  const sv = new Series(bars, (_, i) => signedVolume[i]);
  const fastEMAArr = ta.ema(sv, fastLength).toArray();
  const slowEMAArr = ta.ema(sv, slowLength).toArray();

  // Calculate KVO = fast EMA - slow EMA
  const kvo: (number | null)[] = [];
  for (let i = 0; i < bars.length; i++) {
    const fast = fastEMAArr[i];
    const slow = slowEMAArr[i];
    if (fast === null || slow === null) {
      kvo.push(null);
    } else {
      kvo.push(fast - slow);
    }
  }

  // Calculate signal line
  const kvoSeries = new Series(bars, (_, i) => kvo[i] ?? NaN);
  const signalArr = ta.ema(kvoSeries, signalLength).toArray();

  const plotData0 = kvo.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const plotData1 = signalArr.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': plotData0,
      'plot1': plotData1,
    },
  };
}

export const KlingerOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
