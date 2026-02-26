/**
 * CCI coded OBV
 *
 * CCI calculated on OBV values instead of price.
 * CCI = (OBV - SMA(OBV, n)) / (0.015 * mean_deviation).
 *
 * Reference: TradingView "CCI coded OBV" community indicator
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CCIOBVInputs {
  cciLength: number;
}

export const defaultInputs: CCIOBVInputs = {
  cciLength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CCI of OBV', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'CCI coded OBV',
  shortTitle: 'CCIOBV',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CCIOBVInputs> = {}): IndicatorResult {
  const { cciLength } = { ...defaultInputs, ...inputs };

  // Compute OBV
  const obvArr: number[] = new Array(bars.length);
  obvArr[0] = bars[0]?.volume ?? 0;
  for (let i = 1; i < bars.length; i++) {
    const vol = bars[i].volume ?? 0;
    if (bars[i].close > bars[i - 1].close) {
      obvArr[i] = obvArr[i - 1] + vol;
    } else if (bars[i].close < bars[i - 1].close) {
      obvArr[i] = obvArr[i - 1] - vol;
    } else {
      obvArr[i] = obvArr[i - 1];
    }
  }

  // CCI = (OBV - SMA(OBV, n)) / (0.015 * mean_deviation)
  // mean_deviation = SMA(|OBV - SMA(OBV, n)|, n)
  const obvSeries = new Series(bars, (_b, i) => obvArr[i]);
  const smaObvArr = ta.sma(obvSeries, cciLength).toArray();

  const cciArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const sma = smaObvArr[i];
    if (sma == null || i < cciLength - 1) {
      cciArr[i] = NaN;
      continue;
    }
    // Mean deviation over the window
    let sumDev = 0;
    for (let j = 0; j < cciLength; j++) {
      sumDev += Math.abs(obvArr[i - j] - sma);
    }
    const meanDev = sumDev / cciLength;
    cciArr[i] = meanDev === 0 ? 0 : (obvArr[i] - sma) / (0.015 * meanDev);
  }

  const plot0 = cciArr.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 100, options: { color: '#EF5350', linestyle: 'dashed', title: 'OB' } },
      { value: -100, options: { color: '#26A69A', linestyle: 'dashed', title: 'OS' } },
      { value: 0, options: { color: '#787B86', linestyle: 'solid', title: 'Zero' } },
    ],
  };
}

export const CCIOBV = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
