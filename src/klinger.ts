/**
 * Klinger Oscillator Indicator
 *
 * Volume-based oscillator that measures long-term money flow trends.
 * Uses the difference between two EMAs of signed volume.
 *
 * Based on TradingView's Klinger Oscillator indicator.
 */

import { Series, ta, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';

export interface KlingerInputs {
  /** Fast EMA period */
  fastLength: number;
  /** Slow EMA period */
  slowLength: number;
  /** Signal line period */
  signalLength: number;
}

export const defaultInputs: KlingerInputs = {
  fastLength: 34,
  slowLength: 55,
  signalLength: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 34, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 55, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Klinger Oscillator', color: '#2962FF', lineWidth: 2 },
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
export function calculate(bars: Bar[], inputs: Partial<KlingerInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, signalLength } = { ...defaultInputs, ...inputs };

  // Calculate HLC3
  const hlc3: number[] = bars.map(b => (b.high + b.low + b.close) / 3);
  const hlc3Series = new Series(bars, (_, i) => hlc3[i]);

  // Calculate change in HLC3
  const hlc3ChangeArr = ta.change(hlc3Series, 1).toArray();

  // Calculate signed volume: sv = ta.change(hlc3) >= 0 ? volume : -volume
  const signedVolume: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const change = hlc3ChangeArr[i];
    const volume = bars[i].volume ?? 0;

    if (change === null) {
      // First bar has no change, PineScript would treat it as 0 which is >= 0
      signedVolume.push(volume);
    } else {
      // Key: >= 0, not just > 0
      signedVolume.push(change >= 0 ? volume : -volume);
    }
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
