/**
 * Average Directional Index (ADX) Indicator
 *
 * Measures trend strength regardless of direction.
 * Uses Series-based ta functions from oakscriptjs for consistency.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ADXInputs {
  /** ADX smoothing period */
  adxSmoothing: number;
  /** DI period length */
  diLength: number;
}

export const defaultInputs: ADXInputs = {
  adxSmoothing: 14,
  diLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxSmoothing', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1 },
  { id: 'diLength', type: 'int', title: 'DI Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#FF9800', lineWidth: 1 },
];

export const metadata = {
  title: 'Average Directional Index',
  shortTitle: 'ADX',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ADXInputs> = {}): IndicatorResult {
  const { adxSmoothing, diLength } = { ...defaultInputs, ...inputs };
  const len = bars.length;

  // Calculate True Range using oakscriptjs ta.tr
  const trSeries = ta.tr(bars, true);

  // Calculate +DM and -DM
  const plusDMArr: number[] = [];
  const minusDMArr: number[] = [];

  for (let i = 0; i < len; i++) {
    if (i === 0) {
      plusDMArr.push(0);
      minusDMArr.push(0);
    } else {
      const upMove = bars[i].high - bars[i - 1].high;
      const downMove = bars[i - 1].low - bars[i].low;

      let plusDMVal = 0;
      let minusDMVal = 0;

      if (upMove > downMove && upMove > 0) {
        plusDMVal = upMove;
      }
      if (downMove > upMove && downMove > 0) {
        minusDMVal = downMove;
      }

      plusDMArr.push(plusDMVal);
      minusDMArr.push(minusDMVal);
    }
  }

  // Create Series for RMA calculations
  const plusDMSeries = new Series(bars, (_, i) => plusDMArr[i]);
  const minusDMSeries = new Series(bars, (_, i) => minusDMArr[i]);

  // Smooth +DM, -DM, and TR using RMA
  const smoothedPlusDM = ta.rma(plusDMSeries, diLength);
  const smoothedMinusDM = ta.rma(minusDMSeries, diLength);
  const smoothedTR = ta.rma(trSeries, diLength);

  // Get arrays from Series
  const smoothedPlusDMArr = smoothedPlusDM.toArray();
  const smoothedMinusDMArr = smoothedMinusDM.toArray();
  const smoothedTRArr = smoothedTR.toArray();

  // Calculate +DI and -DI
  const plusDI: number[] = [];
  const minusDI: number[] = [];

  for (let i = 0; i < len; i++) {
    const tr = smoothedTRArr[i];
    if (tr === 0 || tr == null) {
      plusDI.push(0);
      minusDI.push(0);
    } else {
      plusDI.push(((smoothedPlusDMArr[i] ?? 0) / tr) * 100);
      minusDI.push(((smoothedMinusDMArr[i] ?? 0) / tr) * 100);
    }
  }

  // Calculate DX
  const dx: number[] = [];
  for (let i = 0; i < len; i++) {
    const sum = plusDI[i] + minusDI[i];
    if (sum === 0) {
      dx.push(0);
    } else {
      dx.push((Math.abs(plusDI[i] - minusDI[i]) / sum) * 100);
    }
  }

  // Calculate ADX (smoothed DX) using RMA
  const dxSeries = new Series(bars, (_, i) => dx[i]);
  const adxSeries = ta.rma(dxSeries, adxSmoothing);
  const adxArr = adxSeries.toArray();

  const adxData = adxArr.map((value: number | null, i: number) => ({
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
      'plot0': adxData,
    },
  };
}

export const ADX = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
