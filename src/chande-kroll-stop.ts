/**
 * Chande Kroll Stop Indicator
 *
 * ATR-based trailing stop system that identifies potential stop levels
 * for both long and short positions.
 *
 * Based on TradingView's Chande Kroll Stop indicator.
 */

import { Series, ta, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';

export interface ChandeKrollStopInputs {
  /** ATR period length */
  atrLength: number;
  /** ATR multiplier */
  atrCoeff: number;
  /** Stop smoothing length */
  stopLength: number;
}

export const defaultInputs: ChandeKrollStopInputs = {
  atrLength: 10,
  atrCoeff: 1,
  stopLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length (p)', defval: 10, min: 1 },
  { id: 'atrCoeff', type: 'int', title: 'ATR Coefficient (x)', defval: 1, min: 1 },
  { id: 'stopLength', type: 'int', title: 'Stop Length (q)', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stop Long', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Stop Short', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'Chande Kroll Stop',
  shortTitle: 'CKS',
  overlay: true,
};

/**
 * Calculate Chande Kroll Stop
 *
 * Algorithm from PineScript:
 * first_high_stop = ta.highest(high, p) - x * ta.atr(p)
 * first_low_stop = ta.lowest(low, p) + x * ta.atr(p)
 * stop_short = ta.highest(first_high_stop, q)
 * stop_long = ta.lowest(first_low_stop, q)
 */
export function calculate(bars: Bar[], inputs: Partial<ChandeKrollStopInputs> = {}): IndicatorResult {
  const { atrLength, atrCoeff, stopLength } = { ...defaultInputs, ...inputs };

  // Extract high and low series
  const high = Series.fromBars(bars, 'high');
  const low = Series.fromBars(bars, 'low');

  // Calculate highest and lowest over atrLength period
  const highestHighArr = ta.highest(high, atrLength).toArray();
  const lowestLowArr = ta.lowest(low, atrLength).toArray();

  // Calculate ATR using ta.atr (RMA-based)
  const atrArr = ta.atr(bars, atrLength).toArray();

  // Calculate first stop levels
  const firstHighStop: (number | null)[] = [];
  const firstLowStop: (number | null)[] = [];

  for (let i = 0; i < bars.length; i++) {
    const hh = highestHighArr[i];
    const ll = lowestLowArr[i];
    const atrVal = atrArr[i];

    if (hh === null || atrVal === null) {
      firstHighStop.push(null);
    } else {
      firstHighStop.push(hh - atrCoeff * atrVal);
    }

    if (ll === null || atrVal === null) {
      firstLowStop.push(null);
    } else {
      firstLowStop.push(ll + atrCoeff * atrVal);
    }
  }

  // Calculate final stop levels
  const firstHighStopSeries = new Series(bars, (_, i) => firstHighStop[i] ?? NaN);
  const firstLowStopSeries = new Series(bars, (_, i) => firstLowStop[i] ?? NaN);
  const stopShortArr = ta.highest(firstHighStopSeries, stopLength).toArray();
  const stopLongArr = ta.lowest(firstLowStopSeries, stopLength).toArray();

  const plotData0 = stopLongArr.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const plotData1 = stopShortArr.map((value, i) => ({
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

export const ChandeKrollStop = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
