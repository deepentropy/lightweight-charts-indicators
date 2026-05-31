/**
 * Pring's Special K
 *
 * Martin Pring's "Special K" combines short-, intermediate- and long-term
 * smoothed Rate-of-Change values into a single momentum curve, summing twelve
 * SMA-of-ROC terms with ascending weights (1,2,3,4 within each band).
 *
 * Canonical daily parameters (Pring):
 *   ROC:    10  15  20  30 | 40  65  75 100 | 195 265 390 530
 *   SMA:    10  10  10  15 | 50  65  75 100 | 130 130 130 195
 *   weight:  1   2   3   4 |  1   2   3   4 |   1   2   3   4
 *
 * Based on TradingView's built-in "Pring's Special K" (STD;Prings_Special_K).
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';

export interface PringsSpecialKInputs {
  // Canonical fixed parameters; no user inputs.
}

export const defaultInputs: PringsSpecialKInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Special K', color: '#2962FF', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Zero' },
];

export const metadata = {
  title: "Pring's Special K",
  shortTitle: 'Special K',
  overlay: false,
};

const ROC_LEN = [10, 15, 20, 30, 40, 65, 75, 100, 195, 265, 390, 530];
const SMA_LEN = [10, 10, 10, 15, 50, 65, 75, 100, 130, 130, 130, 195];
const WEIGHT = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4];

export function calculate(bars: Bar[], _inputs: Partial<PringsSpecialKInputs> = {}): IndicatorResult {
  const close = new Series(bars, b => b.close);

  // Each term = weight * sma(roc(close, rocLen), smaLen)
  const terms = ROC_LEN.map((rocLen, k) =>
    ta.sma(ta.roc(close, rocLen), SMA_LEN[k]).toArray(),
  );

  const specialK: number[] = bars.map((_, i) => {
    let sum = 0;
    for (let k = 0; k < terms.length; k++) {
      const v = terms[k][i];
      if (v == null || isNaN(v)) return NaN;
      sum += WEIGHT[k] * v;
    }
    return sum;
  });

  const plotData = specialK.map((value, i) => ({ time: bars[i].time, value }));

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

export const PringsSpecialK = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
