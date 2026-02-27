/**
 * Faith Indicator
 *
 * Momentum-based indicator. Faith = EMA(close, fast) - EMA(close, slow).
 * Signal = SMA(faith, 9). Histogram colored by faith vs signal.
 *
 * Reference: TradingView "Faith Indicator" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface FaithIndicatorInputs {
  fastLen: number;
  slowLen: number;
}

export const defaultInputs: FaithIndicatorInputs = {
  fastLen: 14,
  slowLen: 28,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 14, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 28, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Grade of Faith', color: '#2962FF', lineWidth: 5, style: 'histogram' },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Faith Indicator',
  shortTitle: 'Faith',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<FaithIndicatorInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  const { fastLen, slowLen } = { ...defaultInputs, ...inputs };

  const closeSeries = getSourceSeries(bars, 'close');
  const fastArr = ta.ema(closeSeries, fastLen).toArray();
  const slowArr = ta.ema(closeSeries, slowLen).toArray();

  const faithValues = fastArr.map((v, i) => v - (slowArr[i] ?? 0));
  const faithSeries = new Series(bars, (_b, i) => faithValues[i]);
  const signalArr = ta.sma(faithSeries, 9).toArray();

  const warmup = slowLen + 9;

  const faithPlot = faithValues.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    // Pine: dif > 0 ? color.blue : color.red
    const color = v > 0 ? '#2962FF' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const signalPlot = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  // Background color from Hull MA agreement (Pine: hullag = ftrend + strend)
  // fhl=20, shl=25, trnd=0.1, istrend = 0.1 * ATR(30)
  const atrArr = ta.atr(bars, 30).toArray();
  const fhArr = ta.hma(closeSeries, 20).toArray();
  const shArr = ta.hma(closeSeries, 25).toArray();
  const bgColors: BgColorData[] = [];
  for (let i = 1; i < bars.length; i++) {
    const atrVal = atrArr[i] ?? NaN;
    if (isNaN(atrVal)) continue;
    const istrend = 0.1 * atrVal;
    const fh = fhArr[i] ?? NaN;
    const fhPrev = fhArr[i - 1] ?? NaN;
    const sh = shArr[i] ?? NaN;
    const shPrev = shArr[i - 1] ?? NaN;
    if (isNaN(fh) || isNaN(fhPrev) || isNaN(sh) || isNaN(shPrev)) continue;
    const fangle = fh - fhPrev;
    const sangle = sh - shPrev;
    const ftrend = fangle > istrend ? 1 : fangle < -istrend ? -1 : 0;
    const strend = sangle > istrend ? 1 : sangle < -istrend ? -1 : 0;
    const hullag = ftrend + strend;
    // Pine: 2=blue(65%), 1=green(75%), 0=silver(85%), -1=maroon(80%), -2=red(65%)
    let color: string;
    if (hullag === 2) color = 'rgba(33,150,243,0.15)';       // blue
    else if (hullag === 1) color = 'rgba(38,166,154,0.1)';   // green
    else if (hullag === 0) color = 'rgba(120,123,134,0.05)';  // silver/gray
    else if (hullag === -1) color = 'rgba(128,0,0,0.1)';     // maroon
    else color = 'rgba(239,83,80,0.15)';                      // red
    bgColors.push({ time: bars[i].time, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': faithPlot, 'plot1': signalPlot },
    bgColors,
  };
}

export const FaithIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
