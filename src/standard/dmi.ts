/**
 * Directional Movement Index (DMI) Indicator
 *
 * Shows trend direction and strength using +DI, -DI, and ADX lines.
 *
 * Based on TradingView's DMI indicator.
 */

import { Series, ta, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';

export interface DMIInputs {
  /** ADX Smoothing length */
  adxSmoothing: number;
  /** DI Length */
  diLength: number;
}

export const defaultInputs: DMIInputs = {
  adxSmoothing: 14,
  diLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxSmoothing', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1 },
  { id: 'diLength', type: 'int', title: 'DI Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#F50057', lineWidth: 2 },
  { id: 'plot1', title: '+DI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: '-DI', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Directional Movement Index',
  shortTitle: 'DMI',
  overlay: false,
};

/**
 * Calculate DMI
 *
 * Algorithm from PineScript:
 * up = ta.change(high)
 * down = -ta.change(low)
 * plusDM = na(up) ? na : (up > down and up > 0 ? up : 0)
 * minusDM = na(down) ? na : (down > up and down > 0 ? down : 0)
 * trur = ta.rma(ta.tr, len)
 * plus = fixnan(100 * ta.rma(plusDM, len) / trur)
 * minus = fixnan(100 * ta.rma(minusDM, len) / trur)
 * sum = plus + minus
 * adx = 100 * ta.rma(math.abs(plus - minus) / (sum == 0 ? 1 : sum), lensig)
 */
export function calculate(bars: Bar[], inputs: Partial<DMIInputs> = {}): IndicatorResult {
  const { adxSmoothing, diLength } = { ...defaultInputs, ...inputs };

  // Extract high and low series
  const high = Series.fromBars(bars, 'high');
  const low = Series.fromBars(bars, 'low');

  // Calculate change in high and low
  const up = ta.change(high, 1);
  const upArr = up.toArray();
  const downArr = ta.change(low, 1).toArray().map(v => v !== null ? -v : null);

  // Calculate +DM and -DM
  const plusDM: (number | null)[] = [];
  const minusDM: (number | null)[] = [];

  for (let i = 0; i < bars.length; i++) {
    const upVal = upArr[i];
    const downVal = downArr[i];

    if (upVal === null) {
      plusDM.push(null);
    } else if (upVal > (downVal ?? 0) && upVal > 0) {
      plusDM.push(upVal);
    } else {
      plusDM.push(0);
    }

    if (downVal === null) {
      minusDM.push(null);
    } else if (downVal > (upVal ?? 0) && downVal > 0) {
      minusDM.push(downVal);
    } else {
      minusDM.push(0);
    }
  }

  // Calculate True Range and smooth it
  const trueRange = ta.tr(bars, true);
  const trur = ta.rma(trueRange, diLength);
  const trurArr = trur.toArray();

  // Smooth +DM and -DM
  const plusDMSeries = new Series(bars, (_, i) => plusDM[i] ?? NaN);
  const minusDMSeries = new Series(bars, (_, i) => minusDM[i] ?? NaN);
  const smoothedPlusDMArr = ta.rma(plusDMSeries, diLength).toArray();
  const smoothedMinusDMArr = ta.rma(minusDMSeries, diLength).toArray();

  // Calculate +DI and -DI (with fixnan behavior - carry forward last valid value)
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  let lastValidPlus = 0;
  let lastValidMinus = 0;

  for (let i = 0; i < bars.length; i++) {
    const tr = trurArr[i];
    const pDM = smoothedPlusDMArr[i];
    const mDM = smoothedMinusDMArr[i];

    if (tr === null || tr === 0 || pDM === null) {
      plusDI.push(lastValidPlus);
    } else {
      const val = 100 * pDM / tr;
      plusDI.push(val);
      lastValidPlus = val;
    }

    if (tr === null || tr === 0 || mDM === null) {
      minusDI.push(lastValidMinus);
    } else {
      const val = 100 * mDM / tr;
      minusDI.push(val);
      lastValidMinus = val;
    }
  }

  // Calculate DX
  const dx: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const pdi = plusDI[i];
    const mdi = minusDI[i];
    const sum = pdi + mdi;
    dx.push(sum === 0 ? 0 : 100 * Math.abs(pdi - mdi) / sum);
  }

  // Calculate ADX as RMA of DX
  const dxSeries = new Series(bars, (_, i) => dx[i]);
  const adx = ta.rma(dxSeries, adxSmoothing);
  const adxArr = adx.toArray();

  const plotData0 = adxArr.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const plotData1 = plusDI.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  const plotData2 = minusDI.map((value, i) => ({
    time: bars[i].time,
    value: value,
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
      'plot2': plotData2,
    },
  };
}

export const DMI = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
