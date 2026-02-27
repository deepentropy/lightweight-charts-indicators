/**
 * EMA + SuperTrend Combo
 *
 * Overlay with 5 EMAs + SuperTrend + NovaWave cloud (fast/slow EMA + fill) +
 * Signal MA + 3 DMAs + Buy/Sell labels on NovaWave fast/slow crossover.
 *
 * Plots:
 *   plot0: EMA 9       (#E0FFFF)
 *   plot1: EMA 21      (#ff0040)
 *   plot2: EMA 50      (#1900ff, lineWidth 2)
 *   plot3: EMA 100     (#87CEFA)
 *   plot4: EMA 200     (#FAFAD2)
 *   plot5: SuperTrend Up   (green, linebr)
 *   plot6: SuperTrend Down (red, linebr)
 *   plot7: bodyMiddle   (hidden, for fill)
 *   plot8: NovaWave Fast EMA (#D8EDFC)
 *   plot9: NovaWave Slow EMA (#7AE671)
 *   plot10: NovaWave Signal MA (purple)
 *   plot11: DMA 20     (fuchsia, lineWidth 2)
 *   plot12: DMA 50     (yellow, lineWidth 2)
 *   plot13: DMA 200    (teal, lineWidth 2)
 *
 * Fills:
 *   bodyMiddle <-> upTrend (green 90% transparent)
 *   bodyMiddle <-> downTrend (red 90% transparent)
 *   NovaWave Fast <-> NovaWave Slow (green/red based on fast > slow)
 *
 * Markers:
 *   BUY on NovaWave fast crossover slow, SELL on crossunder
 *
 * Reference: TradingView "EMA+Super" by All_in_Traders
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface EMASuperTrendInputs {
  ema1Len: number;
  ema2Len: number;
  ema3Len: number;
  ema4Len: number;
  ema5Len: number;
  emaSrc: SourceType;
  atrLen: number;
  factor: number;
  nwFastLen: number;
  nwSlowLen: number;
  nwSignalLen: number;
  dmaSrc: SourceType;
  dmaDisp20: number;
  dmaDisp50: number;
  dmaDisp200: number;
}

export const defaultInputs: EMASuperTrendInputs = {
  ema1Len: 9,
  ema2Len: 21,
  ema3Len: 50,
  ema4Len: 100,
  ema5Len: 200,
  emaSrc: 'close',
  atrLen: 10,
  factor: 4.0,
  nwFastLen: 9,
  nwSlowLen: 21,
  nwSignalLen: 10,
  dmaSrc: 'close',
  dmaDisp20: 0,
  dmaDisp50: 0,
  dmaDisp200: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'ema1Len', type: 'int', title: 'EMA 9', defval: 9, min: 1 },
  { id: 'ema2Len', type: 'int', title: 'EMA 21', defval: 21, min: 1 },
  { id: 'ema3Len', type: 'int', title: 'EMA 50', defval: 50, min: 1 },
  { id: 'ema4Len', type: 'int', title: 'EMA 100', defval: 100, min: 1 },
  { id: 'ema5Len', type: 'int', title: 'EMA 200', defval: 200, min: 1 },
  { id: 'emaSrc', type: 'source', title: 'EMA Source', defval: 'close' },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'factor', type: 'float', title: 'SuperTrend Factor', defval: 4.0, min: 0.01, step: 0.01 },
  { id: 'nwFastLen', type: 'int', title: 'NovaWave Fast EMA', defval: 9, min: 1 },
  { id: 'nwSlowLen', type: 'int', title: 'NovaWave Slow EMA', defval: 21, min: 1 },
  { id: 'nwSignalLen', type: 'int', title: 'NovaWave Signal MA', defval: 10, min: 1 },
  { id: 'dmaSrc', type: 'source', title: 'DMA Source', defval: 'close' },
  { id: 'dmaDisp20', type: 'int', title: 'DMA 20 Displacement', defval: 0 },
  { id: 'dmaDisp50', type: 'int', title: 'DMA 50 Displacement', defval: 0 },
  { id: 'dmaDisp200', type: 'int', title: 'DMA 200 Displacement', defval: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 9', color: '#E0FFFF', lineWidth: 1 },
  { id: 'plot1', title: 'EMA 21', color: '#ff0040', lineWidth: 1 },
  { id: 'plot2', title: 'EMA 50', color: '#1900ff', lineWidth: 2 },
  { id: 'plot3', title: 'EMA 100', color: '#87CEFA', lineWidth: 1 },
  { id: 'plot4', title: 'EMA 200', color: '#FAFAD2', lineWidth: 1 },
  { id: 'plot5', title: 'SuperTrend Up', color: '#26A69A', lineWidth: 2 },
  { id: 'plot6', title: 'SuperTrend Down', color: '#EF5350', lineWidth: 2 },
  { id: 'plot7', title: 'Body Middle', color: 'rgba(0,0,0,0)', lineWidth: 0 },
  { id: 'plot8', title: 'NovaWave Fast', color: '#D8EDFC', lineWidth: 1 },
  { id: 'plot9', title: 'NovaWave Slow', color: '#7AE671', lineWidth: 1 },
  { id: 'plot10', title: 'NovaWave Signal', color: '#9C27B0', lineWidth: 1 },
  { id: 'plot11', title: 'DMA 20', color: '#E040FB', lineWidth: 2 },
  { id: 'plot12', title: 'DMA 50', color: '#FFEB3B', lineWidth: 2 },
  { id: 'plot13', title: 'DMA 200', color: '#009688', lineWidth: 2 },
];

export const metadata = {
  title: 'EMA + SuperTrend',
  shortTitle: 'EMA+ST',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EMASuperTrendInputs> = {}): IndicatorResult {
  const {
    ema1Len, ema2Len, ema3Len, ema4Len, ema5Len, emaSrc,
    atrLen, factor,
    nwFastLen, nwSlowLen, nwSignalLen,
    dmaSrc, dmaDisp20, dmaDisp50, dmaDisp200,
  } = { ...defaultInputs, ...inputs };

  const n = bars.length;
  const emaSrcSeries = getSourceSeries(bars, emaSrc);

  // 5 EMAs
  const ema1Arr = ta.ema(emaSrcSeries, ema1Len).toArray();
  const ema2Arr = ta.ema(emaSrcSeries, ema2Len).toArray();
  const ema3Arr = ta.ema(emaSrcSeries, ema3Len).toArray();
  const ema4Arr = ta.ema(emaSrcSeries, ema4Len).toArray();
  const ema5Arr = ta.ema(emaSrcSeries, ema5Len).toArray();

  // SuperTrend
  const atrArr = ta.atr(bars, atrLen).toArray();
  const stArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n);
  const upperBand: number[] = new Array(n);
  const lowerBand: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atr = atrArr[i] ?? 0;
    upperBand[i] = hl2 + factor * atr;
    lowerBand[i] = hl2 - factor * atr;

    if (i === 0) {
      dirArr[i] = 1;
      stArr[i] = lowerBand[i];
      continue;
    }

    if (lowerBand[i] > lowerBand[i - 1] || bars[i - 1].close < lowerBand[i - 1]) {
      // keep new
    } else {
      lowerBand[i] = lowerBand[i - 1];
    }

    if (upperBand[i] < upperBand[i - 1] || bars[i - 1].close > upperBand[i - 1]) {
      // keep new
    } else {
      upperBand[i] = upperBand[i - 1];
    }

    const prevDir = dirArr[i - 1];
    if (prevDir === -1 && bars[i].close > upperBand[i - 1]) {
      dirArr[i] = 1;
    } else if (prevDir === 1 && bars[i].close < lowerBand[i - 1]) {
      dirArr[i] = -1;
    } else {
      dirArr[i] = prevDir;
    }

    stArr[i] = dirArr[i] === 1 ? lowerBand[i] : upperBand[i];
  }

  // NovaWave
  const closeSeries = getSourceSeries(bars, 'close');
  const nwFastArr = ta.ema(closeSeries, nwFastLen).toArray();
  const nwSlowArr = ta.ema(closeSeries, nwSlowLen).toArray();
  const nwSignalArr = ta.sma(closeSeries, nwSignalLen).toArray();

  // DMAs
  const dmaSrcSeries = getSourceSeries(bars, dmaSrc);
  const dma20Arr = ta.sma(dmaSrcSeries, 20).toArray();
  const dma50Arr = ta.sma(dmaSrcSeries, 50).toArray();
  const dma200Arr = ta.sma(dmaSrcSeries, 200).toArray();

  const warmup = Math.max(ema5Len, atrLen, 200);

  const makePlot = (arr: (number | null)[], wu?: number) => arr.map((v, i) => ({
    time: bars[i].time,
    value: (i < (wu ?? warmup) || v == null || isNaN(v)) ? NaN : v,
  }));

  // Displaced DMA: shift array by displacement offset
  const displace = (arr: (number | null)[], disp: number): (number | null)[] => {
    if (disp === 0) return arr;
    const result: (number | null)[] = new Array(n).fill(null);
    for (let i = 0; i < n; i++) {
      const srcIdx = i - disp;
      if (srcIdx >= 0 && srcIdx < n) result[i] = arr[srcIdx];
    }
    return result;
  };

  const plot0 = makePlot(ema1Arr, ema1Len);
  const plot1 = makePlot(ema2Arr, ema2Len);
  const plot2 = makePlot(ema3Arr, ema3Len);
  const plot3 = makePlot(ema4Arr, ema4Len);
  const plot4 = makePlot(ema5Arr, ema5Len);

  // SuperTrend Up/Down: linebr style - NaN where not active
  const plot5 = stArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < atrLen || dirArr[i] !== -1) ? NaN : v, // direction < 0 means uptrend
    color: '#26A69A',
  }));
  // Wait - Pine convention: direction < 0 means UP trend (bullish).
  // plot(direction < 0 ? supertrend : na, "Up Trend", green)
  // plot(direction < 0 ? na : supertrend, "Down Trend", red)
  // So we need to check: ta.supertrend returns [value, direction] where direction = -1 for bullish, 1 for bearish
  // But our custom calc uses 1 = up (bullish), -1 = down (bearish)
  // Fix: our dirArr 1 = bullish, -1 = bearish. Pine's direction -1 = bullish.
  // So upTrend in Pine (direction < 0) = our dirArr === 1 (bullish)
  const plot5Fixed = stArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < atrLen || dirArr[i] !== 1) ? NaN : v,
  }));
  const plot6 = stArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < atrLen || dirArr[i] !== -1) ? NaN : v,
  }));

  // bodyMiddle = (open + close) / 2 (hidden plot for fill)
  const plot7 = bars.map((b, i) => ({
    time: b.time,
    value: i < atrLen ? NaN : (b.open + b.close) / 2,
  }));

  const plot8 = makePlot(nwFastArr, nwFastLen);
  const plot9 = makePlot(nwSlowArr, nwSlowLen);
  const plot10 = makePlot(nwSignalArr, nwSignalLen);
  const plot11 = makePlot(displace(dma20Arr, dmaDisp20), 20);
  const plot12 = makePlot(displace(dma50Arr, dmaDisp50), 50);
  const plot13 = makePlot(displace(dma200Arr, dmaDisp200), 200);

  // Fill colors: bodyMiddle <-> upTrend/downTrend, NovaWave cloud
  // SuperTrend fills: per-bar color based on direction
  const stFillUpColors: string[] = [];
  const stFillDownColors: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i < atrLen) {
      stFillUpColors.push('rgba(0,0,0,0)');
      stFillDownColors.push('rgba(0,0,0,0)');
    } else {
      stFillUpColors.push(dirArr[i] === 1 ? 'rgba(0,128,0,0.10)' : 'rgba(0,0,0,0)');
      stFillDownColors.push(dirArr[i] === -1 ? 'rgba(255,0,0,0.10)' : 'rgba(0,0,0,0)');
    }
  }

  // NovaWave cloud fill: green when fast > slow, red when fast < slow
  const nwFillColors: string[] = [];
  const nwWarmup = Math.max(nwFastLen, nwSlowLen);
  for (let i = 0; i < n; i++) {
    if (i < nwWarmup || nwFastArr[i] == null || nwSlowArr[i] == null) {
      nwFillColors.push('rgba(0,0,0,0)');
    } else {
      nwFillColors.push(
        (nwFastArr[i] as number) > (nwSlowArr[i] as number)
          ? 'rgba(0,128,0,0.20)' : 'rgba(255,0,0,0.20)'
      );
    }
  }

  // Markers: BUY/SELL on NovaWave fast crossover/crossunder slow
  const markers: MarkerData[] = [];
  for (let i = nwWarmup + 1; i < n; i++) {
    const fCur = nwFastArr[i];
    const fPrev = nwFastArr[i - 1];
    const sCur = nwSlowArr[i];
    const sPrev = nwSlowArr[i - 1];
    if (fCur == null || fPrev == null || sCur == null || sPrev == null) continue;

    if (fPrev <= sPrev && fCur > sCur) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#4CAF50', text: 'BUY' });
    }
    if (fPrev >= sPrev && fCur < sCur) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#F44336', text: 'SELL' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4,
      'plot5': plot5Fixed, 'plot6': plot6, 'plot7': plot7,
      'plot8': plot8, 'plot9': plot9, 'plot10': plot10,
      'plot11': plot11, 'plot12': plot12, 'plot13': plot13,
    },
    fills: [
      { plot1: 'plot7', plot2: 'plot5', options: { color: 'rgba(0,128,0,0.10)' }, colors: stFillUpColors },
      { plot1: 'plot7', plot2: 'plot6', options: { color: 'rgba(255,0,0,0.10)' }, colors: stFillDownColors },
      { plot1: 'plot8', plot2: 'plot9', options: { color: 'rgba(0,128,0,0.20)' }, colors: nwFillColors },
    ],
    markers,
  } as IndicatorResult & { markers: MarkerData[] };
}

export const EMASupertrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
