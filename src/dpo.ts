/**
 * Detrended Price Oscillator (DPO) Indicator
 *
 * Removes trend from price to identify cycles.
 * DPO = Close - SMA(Close, length)[length/2 + 1]
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DPOInputs {
  /** Period length */
  length: number;
  /** Whether to center the DPO */
  centered: boolean;
}

export const defaultInputs: DPOInputs = {
  length: 21,
  centered: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21, min: 1 },
  { id: 'centered', type: 'bool', title: 'Centered', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DPO', color: '#43A047', lineWidth: 1 },
];

export const metadata = {
  title: 'Detrended Price Oscillator',
  shortTitle: 'DPO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<DPOInputs> = {}): IndicatorResult {
  const { length, centered } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);
  const ma = ta.sma(close, length);
  const maArr = ma.toArray();
  const closeArr = close.toArray();

  const barsback = Math.floor(length / 2) + 1;

  // DPO = close - ma[barsback] (non-centered)
  // For regression testing, we use non-centered mode
  const dpoData = bars.map((bar, i) => {
    const maIndex = i - barsback;
    if (centered) {
      // centered: close[barsback] - ma
      const closeIndex = i + barsback;
      if (closeIndex >= bars.length || maArr[i] == null) {
        return { time: bar.time, value: NaN };
      }
      return { time: bar.time, value: closeArr[closeIndex]! - maArr[i]! };
    } else {
      // non-centered: close - ma[barsback]
      if (maIndex < 0 || maArr[maIndex] == null) {
        return { time: bar.time, value: NaN };
      }
      return { time: bar.time, value: closeArr[i]! - maArr[maIndex]! };
    }
  });

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': dpoData,
    },
  };
}

export const DPO = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
