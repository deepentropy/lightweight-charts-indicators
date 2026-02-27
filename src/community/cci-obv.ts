/**
 * CCI coded OBV
 *
 * Pine: overlay=false, 2 plots:
 *   1) OBV line colored by CCI: green when CCI(close, length) >= threshold, red otherwise
 *   2) EMA(OBV, emaLength) in orange
 *
 * The OBV is cum(change(src) > 0 ? volume : change(src) < 0 ? -volume : 0)
 * The CCI is computed on close (standard CCI), NOT on OBV.
 * Color coding: OBV line is green when CCI >= threshold, red otherwise.
 *
 * Reference: TradingView "CCI coded OBV" by LazyBear
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CCIOBVInputs {
  cciLength: number;
  threshold: number;
  emaLength: number;
}

export const defaultInputs: CCIOBVInputs = {
  cciLength: 20,
  threshold: 0,
  emaLength: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 20, min: 1 },
  { id: 'threshold', type: 'int', title: 'CCI threshold for OBV coding', defval: 0 },
  { id: 'emaLength', type: 'int', title: 'EMA length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'obv', title: 'OBV_CCI coded', color: '#26A69A', lineWidth: 2 },
  { id: 'obvEma', title: 'EMA of OBV', color: '#FF9800', lineWidth: 2 },
];

export const metadata = {
  title: 'CCI coded OBV',
  shortTitle: 'CCIOBV',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CCIOBVInputs> = {}): IndicatorResult {
  const { cciLength, threshold, emaLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Compute OBV: cum(change(src) > 0 ? volume : change(src) < 0 ? -volume : 0)
  const obvArr: number[] = new Array(n);
  obvArr[0] = 0;
  for (let i = 1; i < n; i++) {
    const chg = bars[i].close - bars[i - 1].close;
    const vol = bars[i].volume ?? 0;
    if (chg > 0) {
      obvArr[i] = obvArr[i - 1] + vol;
    } else if (chg < 0) {
      obvArr[i] = obvArr[i - 1] - vol;
    } else {
      obvArr[i] = obvArr[i - 1];
    }
  }

  // Compute CCI on close (standard)
  const closeSeries = new Series(bars, (b) => b.close);
  const cciArr = ta.cci(closeSeries, cciLength).toArray();

  // EMA of OBV
  const obvSeries = Series.fromArray(bars, obvArr);
  const emaOBVArr = ta.ema(obvSeries, emaLength).toArray();

  const GREEN = '#26A69A';
  const RED = '#EF5350';

  // Pine: color=c>=threshold?green:red  (na >= threshold is false → red during warmup)
  const obvPlot = obvArr.map((v, i) => ({
    time: bars[i].time,
    value: v,
    color: !isNaN(cciArr[i]) && cciArr[i] >= threshold ? GREEN : RED,
  }));

  const emaPlot = emaOBVArr.map((v, i) => ({
    time: bars[i].time,
    value: v ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { obv: obvPlot, obvEma: emaPlot },
  };
}

export const CCIOBV = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
