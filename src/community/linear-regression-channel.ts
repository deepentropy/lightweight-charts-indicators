/**
 * Linear Regression Channel
 *
 * Separate linear regressions on high and low, plus deviation bands.
 * a = linreg(high, len)
 * b = linreg(low, len)
 * c = b - dev(low, len)   (lower band)
 * d = a + dev(high, len)  (upper band)
 * c and d colored by direction (green rising, red falling).
 *
 * Reference: TradingView "Linear Regression Channel" (LRC_SH)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface LinearRegressionChannelInputs {
  length: number;
}

export const defaultInputs: LinearRegressionChannelInputs = {
  length: 300,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 300, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'LinReg High', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'LinReg Low', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'Upper Band', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'Linear Regression Channel',
  shortTitle: 'LRC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<LinearRegressionChannelInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Pine: a = linreg(high, len, 0), b = linreg(low, len, 0)
  const aArr = ta.linreg(highSeries, length, 0).toArray();
  const bArr = ta.linreg(lowSeries, length, 0).toArray();

  // Pine: c = -dev(low, len) + b, d = dev(high, len) + a
  const devHighArr = ta.stdev(highSeries, length).toArray();
  const devLowArr = ta.stdev(lowSeries, length).toArray();

  const warmup = length;

  // Plot a = linreg(high)
  const plot0 = bars.map((b, i) => {
    const v = aArr[i];
    if (i < warmup || v == null || isNaN(v)) return { time: b.time, value: NaN };
    return { time: b.time, value: v };
  });

  // Plot b = linreg(low)
  const plot1 = bars.map((b, i) => {
    const v = bArr[i];
    if (i < warmup || v == null || isNaN(v)) return { time: b.time, value: NaN };
    return { time: b.time, value: v };
  });

  // Plot c = b - dev(low, len) -- lower band, colored by direction
  const plot2 = bars.map((b, i) => {
    const bv = bArr[i];
    const dv = devLowArr[i];
    if (i < warmup || bv == null || isNaN(bv) || dv == null || isNaN(dv)) return { time: b.time, value: NaN };
    const val = bv - dv;
    let color = '#26A69A';
    if (i > warmup) {
      const prevB = bArr[i - 1];
      const prevD = devLowArr[i - 1];
      if (prevB != null && prevD != null) {
        const prevVal = prevB - prevD;
        color = val > prevVal ? '#26A69A' : '#EF5350';
      }
    }
    return { time: b.time, value: val, color };
  });

  // Plot d = a + dev(high, len) -- upper band, colored by direction
  const plot3 = bars.map((b, i) => {
    const av = aArr[i];
    const dv = devHighArr[i];
    if (i < warmup || av == null || isNaN(av) || dv == null || isNaN(dv)) return { time: b.time, value: NaN };
    const val = av + dv;
    let color = '#26A69A';
    if (i > warmup) {
      const prevA = aArr[i - 1];
      const prevD = devHighArr[i - 1];
      if (prevA != null && prevD != null) {
        const prevVal = prevA + prevD;
        color = val > prevVal ? '#26A69A' : '#EF5350';
      }
    }
    return { time: b.time, value: val, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
  };
}

export const LinearRegressionChannel = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
