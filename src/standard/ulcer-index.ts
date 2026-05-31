/**
 * Ulcer Index (UI)
 *
 * Volatility/risk measure that only considers downside movement. It is the
 * square root of the mean of squared percentage drawdowns from the highest
 * close over the lookback window.
 *
 *   drawdown_i = 100 * (close - highest(close, length)) / highest(close, length)
 *   UI        = sqrt( sma(drawdown^2, length) )
 *
 * Based on TradingView's built-in "Ulcer Index" (STD;Ulcer_Index).
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface UlcerIndexInputs {
  /** Lookback length */
  length: number;
}

export const defaultInputs: UlcerIndexInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ulcer Index', color: '#E91E63', lineWidth: 1 },
];

export const metadata = {
  title: 'Ulcer Index',
  shortTitle: 'UI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<UlcerIndexInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const closeSeries = new Series(bars, b => b.close);
  const highestArr = ta.highest(closeSeries, length).toArray();

  // Squared percentage drawdown from the running highest close.
  const drawdownSq: number[] = bars.map((bar, i) => {
    const hi = highestArr[i];
    if (hi == null || hi === 0) return NaN;
    const dd = (100 * (bar.close - hi)) / hi;
    return dd * dd;
  });

  const ddSeries = new Series(bars, (_, i) => drawdownSq[i]);
  const meanSqArr = ta.sma(ddSeries, length).toArray();

  const plotData = meanSqArr.map((value, i) => ({
    time: bars[i].time,
    value: value != null && !isNaN(value) ? Math.sqrt(value) : NaN,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': plotData,
    },
  };
}

export const UlcerIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
