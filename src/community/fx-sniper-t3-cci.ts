/**
 * FX Sniper T3-CCI
 *
 * CCI smoothed with Tillson T3 moving average.
 * T3 uses a 6-stage EMA cascade with factor-based coefficients.
 *
 * Reference: TradingView "FX Sniper T3-CCI" community indicator
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface FXSniperT3CCIInputs {
  cciLength: number;
  t3Length: number;
  t3Factor: number;
  src: SourceType;
}

export const defaultInputs: FXSniperT3CCIInputs = {
  cciLength: 14,
  t3Length: 5,
  t3Factor: 0.7,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 14, min: 1 },
  { id: 't3Length', type: 'int', title: 'T3 Length', defval: 5, min: 1 },
  { id: 't3Factor', type: 'float', title: 'T3 Factor', defval: 0.7, min: 0.0, max: 1.0, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3-CCI', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'FX Sniper T3-CCI',
  shortTitle: 'T3CCI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<FXSniperT3CCIInputs> = {}): IndicatorResult {
  const { cciLength, t3Length, t3Factor, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const srcArr = source.toArray();

  // Manual CCI on source
  const smaArr = ta.sma(source, cciLength).toArray();
  const cciArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const sma = smaArr[i];
    if (sma == null || i < cciLength - 1) {
      cciArr[i] = NaN;
      continue;
    }
    let sumDev = 0;
    for (let j = 0; j < cciLength; j++) {
      sumDev += Math.abs((srcArr[i - j] ?? 0) - sma);
    }
    const meanDev = sumDev / cciLength;
    cciArr[i] = meanDev === 0 ? 0 : ((srcArr[i] ?? 0) - sma) / (0.015 * meanDev);
  }

  // T3 smoothing: 6-stage EMA cascade
  // T3 coefficients: b = t3Factor
  // c1 = -b^3, c2 = 3b^2 + 3b^3, c3 = -6b^2 - 3b - 3b^3, c4 = 1 + 3b + b^3 + 3b^2
  const b = t3Factor;
  const b2 = b * b;
  const b3 = b2 * b;
  const c1 = -b3;
  const c2 = 3 * b2 + 3 * b3;
  const c3 = -6 * b2 - 3 * b - 3 * b3;
  const c4 = 1 + 3 * b + b3 + 3 * b2;

  // EMA helper for plain arrays
  const emaArray = (input: number[], len: number): number[] => {
    const result: number[] = new Array(input.length);
    const k = 2 / (len + 1);
    let prev = NaN;
    for (let i = 0; i < input.length; i++) {
      const v = input[i];
      if (isNaN(v)) {
        result[i] = prev;
      } else if (isNaN(prev)) {
        prev = v;
        result[i] = v;
      } else {
        prev = v * k + prev * (1 - k);
        result[i] = prev;
      }
    }
    return result;
  };

  const e1 = emaArray(cciArr, t3Length);
  const e2 = emaArray(e1, t3Length);
  const e3 = emaArray(e2, t3Length);
  const e4 = emaArray(e3, t3Length);
  const e5 = emaArray(e4, t3Length);
  const e6 = emaArray(e5, t3Length);

  const t3Arr: number[] = new Array(bars.length);
  const warmup = cciLength + t3Length * 6;
  for (let i = 0; i < bars.length; i++) {
    if (i < cciLength - 1 || isNaN(e6[i])) {
      t3Arr[i] = NaN;
    } else {
      t3Arr[i] = c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i];
    }
  }

  const plot0 = t3Arr.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid', title: 'Zero' } },
      { value: 100, options: { color: '#EF5350', linestyle: 'dashed', title: 'OB' } },
      { value: -100, options: { color: '#26A69A', linestyle: 'dashed', title: 'OS' } },
    ],
  };
}

export const FXSniperT3CCI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
