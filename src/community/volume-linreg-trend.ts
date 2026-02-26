/**
 * Volume-Supported Linear Regression Trend
 *
 * Linear regression line with VWMA confirmation. Trend is confirmed
 * when both linreg and VWMA move in the same direction.
 *
 * Reference: TradingView "Volume-Supported Linear Regression Trend" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface VolumeLinRegTrendInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: VolumeLinRegTrendInputs = {
  length: 20,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 2 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'LinReg', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'VWMA', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'Volume LinReg Trend',
  shortTitle: 'VLRTrend',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeLinRegTrendInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const linregArr = ta.linreg(source, length, 0).toArray();
  const vwmaArr = ta.vwma(source, length, volSeries).toArray();

  const warmup = length;

  const plot0 = linregArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };

    // Color based on both rising/falling together
    let color = '#2962FF';
    if (i > 0) {
      const prevLR = linregArr[i - 1];
      const prevVW = vwmaArr[i - 1];
      const curVW = vwmaArr[i];
      if (prevLR != null && prevVW != null && curVW != null) {
        const lrRising = v > prevLR;
        const vwRising = curVW > prevVW;
        if (lrRising && vwRising) color = '#26A69A';
        else if (!lrRising && !vwRising) color = '#EF5350';
      }
    }

    return { time: bars[i].time, value: v, color };
  });

  const plot1 = vwmaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const VolumeLinRegTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
