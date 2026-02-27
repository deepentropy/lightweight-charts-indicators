/**
 * Market Cipher B
 *
 * WaveTrend oscillator with MFI area, difference (VWAP) area,
 * cross-detection dots, and buy/sell signal markers.
 *
 * Reference: TradingView "VuManChu Cipher B + Divergences" (community)
 */

import { ta, getSourceSeries, Series, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MarketCipherBInputs {
  wtChannelLen: number;
  wtAvgLen: number;
  wtMALen: number;
  rsiMFIPeriod: number;
  rsiMFIMult: number;
  rsiMFIPosY: number;
  obLevel: number;
  obLevel2: number;
  obLevel3: number;
  osLevel: number;
  osLevel2: number;
  osLevel3: number;
}

export const defaultInputs: MarketCipherBInputs = {
  wtChannelLen: 9,
  wtAvgLen: 12,
  wtMALen: 3,
  rsiMFIPeriod: 60,
  rsiMFIMult: 150,
  rsiMFIPosY: 2.5,
  obLevel: 53,
  obLevel2: 60,
  obLevel3: 100,
  osLevel: -53,
  osLevel2: -60,
  osLevel3: -75,
};

export const inputConfig: InputConfig[] = [
  { id: 'wtChannelLen', type: 'int', title: 'WT Channel Length', defval: 9, min: 1 },
  { id: 'wtAvgLen', type: 'int', title: 'WT Average Length', defval: 12, min: 1 },
  { id: 'wtMALen', type: 'int', title: 'WT MA Length', defval: 3, min: 1 },
  { id: 'rsiMFIPeriod', type: 'int', title: 'MFI Period', defval: 60, min: 1 },
  { id: 'rsiMFIMult', type: 'float', title: 'MFI Area multiplier', defval: 150, min: 1 },
  { id: 'rsiMFIPosY', type: 'float', title: 'MFI Area Y Pos', defval: 2.5 },
  { id: 'obLevel', type: 'int', title: 'WT Overbought Level 1', defval: 53 },
  { id: 'obLevel2', type: 'int', title: 'WT Overbought Level 2', defval: 60 },
  { id: 'obLevel3', type: 'int', title: 'WT Overbought Level 3', defval: 100 },
  { id: 'osLevel', type: 'int', title: 'WT Oversold Level 1', defval: -53 },
  { id: 'osLevel2', type: 'int', title: 'WT Oversold Level 2', defval: -60 },
  { id: 'osLevel3', type: 'int', title: 'WT Oversold Level 3', defval: -75 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'wt1', title: 'WT Wave 1', color: '#4994EC', lineWidth: 2, style: 'area' },
  { id: 'wt2', title: 'WT Wave 2', color: '#1F1559', lineWidth: 1, style: 'area' },
  { id: 'vwap', title: 'VWAP (WT1-WT2)', color: '#FFFFFF80', lineWidth: 2, style: 'area' },
  { id: 'mfiArea', title: 'MFI Area', color: '#3EE145', lineWidth: 1, style: 'area' },
  { id: 'crossDot', title: 'Cross Dot', color: '#00FF00', lineWidth: 3, style: 'circles' },
  { id: 'crossLine', title: 'Cross Line', color: '#000000', lineWidth: 5 },
];

export const metadata = {
  title: 'Market Cipher B',
  shortTitle: 'MCB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MarketCipherBInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const {
    wtChannelLen, wtAvgLen, wtMALen,
    rsiMFIPeriod, rsiMFIMult, rsiMFIPosY,
    obLevel, obLevel2, obLevel3, osLevel, osLevel2, osLevel3,
  } = { ...defaultInputs, ...inputs };

  const n = bars.length;
  const hlc3 = getSourceSeries(bars, 'hlc3');

  // --- WaveTrend ---
  // Pine: esa = ema(hlc3, chlen), de = ema(abs(hlc3-esa), chlen)
  //        ci = (hlc3 - esa) / (0.015 * de)
  //        wt1 = ema(ci, avg), wt2 = sma(wt1, malen)
  const esa = ta.ema(hlc3, wtChannelLen);
  const de = ta.ema(math.abs(hlc3.sub(esa)) as Series, wtChannelLen);
  const ci = hlc3.sub(esa).div(de.mul(0.015));
  const wt1 = ta.ema(ci, wtAvgLen);
  const wt2 = ta.sma(wt1, wtMALen);

  const wt1Arr = wt1.toArray();
  const wt2Arr = wt2.toArray();

  // --- RSI+MFI Area ---
  // Pine: sma(((close - open) / (high - low)) * multiplier, period) - posY
  const mfiRaw: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const range = bars[i].high - bars[i].low;
    mfiRaw[i] = range > 0 ? ((bars[i].close - bars[i].open) / range) * rsiMFIMult : 0;
  }
  const mfiSeries = new Series(bars, (_bar, idx) => mfiRaw[idx]);
  const mfiSma = ta.sma(mfiSeries, rsiMFIPeriod);
  const mfiArr = mfiSma.toArray();

  const warmup = wtChannelLen + wtAvgLen;
  const mfiWarmup = rsiMFIPeriod;

  const toVal = (v: number | null, i: number, wu: number): number => {
    if (v == null || i < wu || !isFinite(v)) return NaN;
    return v;
  };

  // Pine: plot(wt1, style=area, color=#4994EC)
  const wt1Plot = wt1Arr.map((v, i) => ({ time: bars[i].time, value: toVal(v, i, warmup) }));
  // Pine: plot(wt2, style=area, color=#1F1559)
  const wt2Plot = wt2Arr.map((v, i) => ({ time: bars[i].time, value: toVal(v, i, warmup) }));

  // Pine: wtVwap = wt1 - wt2; plot(wtVwap, style=area, color=white)
  const vwapPlot = bars.map((b, i) => {
    const v1 = wt1Arr[i];
    const v2 = wt2Arr[i];
    if (v1 == null || v2 == null || i < warmup) return { time: b.time, value: NaN };
    return { time: b.time, value: v1 - v2 };
  });

  // Pine: plot(rsiMFI, style=area, color=rsiMFIColor)
  const mfiPlot = bars.map((b, i) => {
    const v = mfiArr[i];
    const val = toVal(v, i, mfiWarmup) - rsiMFIPosY;
    const color = val > 0 ? '#3EE14580' : '#FF3D2E80';
    return { time: b.time, value: isFinite(val) ? val : NaN, color };
  });

  // --- Cross detection & signal markers ---
  // Pine: wtCross = cross(wt1, wt2)
  //       plot(wtCross ? wt2 : na, style=circles, color=signalColor, linewidth=3)
  //       buySignal = wtCross and wtCrossUp and wtOversold (wt2 <= osLevel)
  //       sellSignal = wtCross and wtCrossDown and wtOverbought (wt2 >= obLevel)
  const crossDotPlot: { time: number; value: number; color?: string }[] = [];
  const crossLinePlot: { time: number; value: number }[] = [];
  const markers: MarkerData[] = [];

  for (let i = 0; i < n; i++) {
    if (i < warmup + 1 || wt1Arr[i] == null || wt2Arr[i] == null ||
        wt1Arr[i - 1] == null || wt2Arr[i - 1] == null) {
      crossDotPlot.push({ time: bars[i].time, value: NaN });
      crossLinePlot.push({ time: bars[i].time, value: NaN });
      continue;
    }

    const prev1 = wt1Arr[i - 1]!;
    const prev2 = wt2Arr[i - 1]!;
    const curr1 = wt1Arr[i]!;
    const curr2 = wt2Arr[i]!;

    // cross: either crossover or crossunder
    const crossUp = prev1 <= prev2 && curr1 > curr2;
    const crossDown = prev1 >= prev2 && curr1 < curr2;
    const isCross = crossUp || crossDown;

    if (isCross) {
      // Pine: plot(cross(wt1, wt2) ? wt2 : na, color=black, style=line, linewidth=5)
      crossLinePlot.push({ time: bars[i].time, value: curr2 });

      // Small circle at every cross (Pine line 495)
      const dotColor = (curr2 - curr1) > 0 ? '#FF5252' : '#00E676';
      crossDotPlot.push({ time: bars[i].time, value: curr2, color: dotColor });

      // Big green buy circle: cross up while oversold (Pine line 497)
      if (crossUp && curr2 <= osLevel) {
        markers.push({
          time: bars[i].time,
          position: 'belowBar',
          shape: 'circle',
          color: '#3FFF00',
          text: 'Buy',
          size: 3,
        });
      }

      // Big red sell circle: cross down while overbought (Pine line 498)
      if (crossDown && curr2 >= obLevel) {
        markers.push({
          time: bars[i].time,
          position: 'aboveBar',
          shape: 'circle',
          color: '#FF0000',
          text: 'Sell',
          size: 3,
        });
      }
    } else {
      crossDotPlot.push({ time: bars[i].time, value: NaN });
      crossLinePlot.push({ time: bars[i].time, value: NaN });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'wt1': wt1Plot,
      'wt2': wt2Plot,
      'vwap': vwapPlot,
      'mfiArea': mfiPlot,
      'crossDot': crossDotPlot,
      'crossLine': crossLinePlot,
    },
    hlines: [
      { value: 0, options: { color: '#FFFFFF80', linestyle: 'solid' as const, title: 'Zero' } },
      { value: obLevel, options: { color: '#FFFFFF26', linestyle: 'dashed' as const, title: 'OB1 (53)' } },
      { value: osLevel, options: { color: '#FFFFFF26', linestyle: 'dashed' as const, title: 'OS1 (-53)' } },
      { value: obLevel2, options: { color: '#FFFFFF15', linestyle: 'dashed' as const, title: 'OB2 (60)' } },
      { value: osLevel2, options: { color: '#FFFFFF15', linestyle: 'dashed' as const, title: 'OS2 (-60)' } },
      { value: obLevel3, options: { color: '#FFFFFF0A', linestyle: 'dotted' as const, title: 'OB3 (100)' } },
      { value: osLevel3, options: { color: '#FFFFFF0A', linestyle: 'dotted' as const, title: 'OS3 (-75)' } },
    ],
    markers,
  };
}

export const MarketCipherB = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
