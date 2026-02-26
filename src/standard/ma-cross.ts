/**
 * MA Cross Indicator
 *
 * Shows two moving averages and their crossover signals.
 * Uses SMA by default.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface MACrossInputs {
  /** Short MA period */
  shortLength: number;
  /** Long MA period */
  longLength: number;
}

export const defaultInputs: MACrossInputs = {
  shortLength: 9,
  longLength: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLength', type: 'int', title: 'Short Length', defval: 9, min: 1 },
  { id: 'longLength', type: 'int', title: 'Long Length', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short MA', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'Long MA', color: '#43A047', lineWidth: 1 },
  { id: 'plot2', title: 'Cross', color: '#2962FF', lineWidth: 4, style: 'cross' },
];

export const metadata = {
  title: 'MA Cross',
  shortTitle: 'MA Cross',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MACrossInputs> = {}): IndicatorResult {
  const { shortLength, longLength } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);

  // Calculate SMAs
  const shortMA = ta.sma(close, shortLength);
  const longMA = ta.sma(close, longLength);

  const shortArr = shortMA.toArray();
  const longArr = longMA.toArray();

  const shortData = shortArr.map((value: number | null, i: number) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const longData = longArr.map((value: number | null, i: number) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  // Cross plot: show short MA value at crossover points, NaN elsewhere
  const crossData = shortArr.map((s: number | null, i: number) => {
    if (i === 0) return { time: bars[i].time, value: NaN };
    const sP = shortArr[i - 1], l = longArr[i], lP = longArr[i - 1];
    if (s == null || sP == null || l == null || lP == null) return { time: bars[i].time, value: NaN };
    const isCross = (sP <= lP && s > l) || (sP >= lP && s < l);
    return { time: bars[i].time, value: isCross ? s : NaN };
  });

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': shortData,
      'plot1': longData,
      'plot2': crossData,
    },
  };
}

export const MACross = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
