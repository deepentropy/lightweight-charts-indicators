/**
 * CCI Stochastic
 *
 * CCI = (close - SMA(close, len)) / (0.015 * meanDev(close, len))
 * Then apply Stochastic to CCI: K = stoch(CCI, CCI, CCI, stochLen), smoothed.
 *
 * Reference: TradingView "CCI Stochastic" (TV#117)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CCIStochasticInputs {
  cciLen: number;
  stochLen: number;
  smoothK: number;
  smoothD: number;
  showArrows: boolean;
  showArrowsCenter: boolean;
}

export const defaultInputs: CCIStochasticInputs = {
  cciLen: 14,
  stochLen: 14,
  smoothK: 3,
  smoothD: 3,
  showArrows: true,
  showArrowsCenter: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'cciLen', type: 'int', title: 'CCI Length', defval: 14, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'smoothK', type: 'int', title: 'Smooth K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'Smooth D', defval: 3, min: 1 },
  { id: 'showArrows', type: 'bool', title: 'Show Arrows', defval: true },
  { id: 'showArrowsCenter', type: 'bool', title: 'Show Arrows on Center zone', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'MA', color: '#787B86', lineWidth: 3 },
  { id: 'plot2', title: 'Max Level', color: 'transparent', lineWidth: 0 },
  { id: 'plot3', title: 'OB Level', color: 'transparent', lineWidth: 0 },
  { id: 'plot4', title: 'Min Level', color: 'transparent', lineWidth: 0 },
  { id: 'plot5', title: 'OS Level', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'CCI Stochastic',
  shortTitle: 'CCIStoch',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CCIStochasticInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { cciLen, stochLen, smoothK, smoothD, showArrows, showArrowsCenter } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = getSourceSeries(bars, 'close');
  const smaClose = ta.sma(close, cciLen).toArray();
  const closeArr = close.toArray();

  // CCI = (close - SMA) / (0.015 * meanDeviation)
  const cciArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < cciLen - 1 || smaClose[i] == null) {
      cciArr[i] = NaN;
      continue;
    }
    // Mean deviation over cciLen
    const mean = smaClose[i]!;
    let sumDev = 0;
    for (let j = 0; j < cciLen; j++) {
      sumDev += Math.abs((closeArr[i - j] ?? 0) - mean);
    }
    const meanDev = sumDev / cciLen;
    cciArr[i] = meanDev === 0 ? 0 : (closeArr[i]! - mean) / (0.015 * meanDev);
  }

  // Stochastic of CCI: use CCI as close/high/low
  const cciSeries = Series.fromArray(bars, cciArr);
  const rawK = ta.stoch(cciSeries, cciSeries, cciSeries, stochLen);
  const k = ta.sma(rawK, smoothK);
  const d = ta.sma(k, smoothD);

  const kArr = k.toArray();
  const dArr = d.toArray();

  const warmup = cciLen + stochLen + smoothK + smoothD;

  const plot0 = kArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const OB = 80;
  const OS = 20;
  const plot1 = dArr.map((v, i) => {
    const val = (v == null || i < warmup) ? NaN : v;
    let color: string;
    if (!isNaN(val) && val > OB) color = '#EF5350';     // red above overbought
    else if (!isNaN(val) && val < OS) color = '#26A69A'; // green below oversold
    else color = '#787B86';                                // gray otherwise
    return { time: bars[i].time, value: val, color };
  });

  // Pine markers:
  // trend_enter: crossunder(ma, OS) => buy arrow at 0; crossover(ma, OB) => sell arrow at 100
  // trend_exit: crossunder(ma, OB) => sell arrow at 100; crossover(ma, OS) => buy arrow at 0
  const markers: MarkerData[] = [];
  // Use D line (plot1) as the "ma" per Pine default d_or_k="D"
  for (let i = warmup + 1; i < bars.length; i++) {
    const cur = dArr[i];
    const prev = dArr[i - 1];
    if (cur == null || prev == null) continue;

    // Enter zone: crossunder(ma, OS=20) -> buy; crossover(ma, OB=80) -> sell
    if (prev >= 20 && cur < 20) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Enter Buy' });
    }
    if (prev <= 80 && cur > 80) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Enter Sell' });
    }
    // Exit zone: crossunder(ma, OB=80) -> sell exit; crossover(ma, OS=20) -> buy exit
    if (prev >= 80 && cur < 80) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#880E4F', text: 'Exit Sell' });
    }
    if (prev <= 20 && cur > 20) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#FF9800', text: 'Exit Buy' });
    }

    // Center zone: crossover(ma, 50) -> buy; crossunder(ma, 50) -> sell
    if (showArrows && showArrowsCenter) {
      if (prev <= 50 && cur > 50) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#00BCD4', text: 'Center Buy' });
      }
      if (prev >= 50 && cur < 50) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#E040FB', text: 'Center Sell' });
      }
    }
  }

  // OB/OS zone fill: Pine fills between maxLevelPlot(100)/overbought(80) and minLevelPlot(0)/oversold(20)
  // color_fill_os = ma > OB ? red@90% : transparent  (fill between 100 and 80)
  // color_fill_ob = ma < OS ? green@90% : transparent (fill between 0 and 20)
  const plot2: { time: number; value: number }[] = [];
  const plot3: { time: number; value: number }[] = [];
  const plot4: { time: number; value: number }[] = [];
  const plot5: { time: number; value: number }[] = [];
  const obFillColors: string[] = [];
  const osFillColors: string[] = [];

  for (let i = 0; i < n; i++) {
    plot2.push({ time: bars[i].time, value: 100 });
    plot3.push({ time: bars[i].time, value: OB });
    plot4.push({ time: bars[i].time, value: 0 });
    plot5.push({ time: bars[i].time, value: OS });

    const d = dArr[i];
    const maValid = d != null && !isNaN(d) && i >= warmup;
    obFillColors.push(maValid && d > OB ? 'rgba(239,83,80,0.10)' : 'transparent');
    osFillColors.push(maValid && d < OS ? 'rgba(38,166,154,0.10)' : 'transparent');
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4, 'plot5': plot5 },
    fills: [
      { plot1: 'plot2', plot2: 'plot3', colors: obFillColors },
      { plot1: 'plot4', plot2: 'plot5', colors: osFillColors },
    ],
    hlines: [
      { value: 100, options: { color: '#FFFFFF00', linestyle: 'dotted' as const, title: 'Max Level' } },
      { value: 80, options: { color: '#EF5350', linestyle: 'solid' as const, title: 'Overbought' } },
      { value: 50, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Mid Line' } },
      { value: 20, options: { color: '#26A69A', linestyle: 'solid' as const, title: 'Oversold' } },
      { value: 0, options: { color: '#FFFFFF00', linestyle: 'dotted' as const, title: 'Min Level' } },
    ],
    markers,
  };
}

export const CCIStochastic = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
