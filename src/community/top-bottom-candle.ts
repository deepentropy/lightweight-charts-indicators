/**
 * UCS Top & Bottom Candle
 *
 * Panel indicator (overlay=false) with:
 * - Momentum histogram (plot.style_columns, yellow)
 * - SMI line (blue)
 * - SMI Signal line (red)
 * - 3 hlines: 40 (overbought/red), -40 (oversold/green), 0 (zero/blue)
 * - Fills between hlines: H0-H2 green (oversold zone), H0-H1 red (overbought zone)
 * - barcolor: lime when SMI < -35 and mom crosses above 0, red when SMI > 35 and mom crosses below 0
 *
 * Reference: TradingView "UCS_Top & Bottom Candle" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface TopBottomCandleInputs {
  percentKLength: number;
  percentDLength: number;
}

export const defaultInputs: TopBottomCandleInputs = {
  percentKLength: 5,
  percentDLength: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'percentKLength', type: 'int', title: 'Percent K Length', defval: 5, min: 1 },
  { id: 'percentDLength', type: 'int', title: 'Percent D Length', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'momentum', title: 'Momentum', color: '#FFEB3B', lineWidth: 1, style: 'histogram' },
  { id: 'smi', title: 'Stochastic Momentum Index', color: '#2196F3', lineWidth: 1 },
  { id: 'smiSignal', title: 'SMI Signal Line', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Top & Bottom Candle',
  shortTitle: 'UCS_T&B',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TopBottomCandleInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { percentKLength: a, percentDLength: b } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const lowSeries = new Series(bars, (bar) => bar.low);
  const highSeries = new Series(bars, (bar) => bar.high);
  const closeSeries = new Series(bars, (bar) => bar.close);

  const ll = ta.lowest(lowSeries, a);
  const hh = ta.highest(highSeries, a);
  const hhArr = hh.toArray();
  const llArr = ll.toArray();
  const closeArr = closeSeries.toArray();

  // diff = hh - ll, rdiff = close - (hh+ll)/2
  const diffArr: number[] = new Array(n);
  const rdiffArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    diffArr[i] = (hhArr[i] ?? 0) - (llArr[i] ?? 0);
    rdiffArr[i] = (closeArr[i] ?? 0) - ((hhArr[i] ?? 0) + (llArr[i] ?? 0)) / 2;
  }

  // avgrel = ema(ema(rdiff, b), b), avgdiff = ema(ema(diff, b), b)
  const rdiffS = Series.fromArray(bars, rdiffArr);
  const diffS = Series.fromArray(bars, diffArr);
  const avgrelArr = ta.ema(ta.ema(rdiffS, b), b).toArray();
  const avgdiffArr = ta.ema(ta.ema(diffS, b), b).toArray();

  // Momentum = (close - close[b]) / close[b] * 1000
  const momArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i >= b && closeArr[i - b] !== 0 && closeArr[i - b] != null) {
      momArr[i] = ((closeArr[i]! - closeArr[i - b]!) / closeArr[i - b]!) * 1000;
    } else {
      momArr[i] = NaN;
    }
  }

  // SMI = avgdiff != 0 ? (avgrel / (avgdiff / 2) * 100) : 0
  const smiArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ad = avgdiffArr[i] ?? 0;
    smiArr[i] = ad !== 0 ? ((avgrelArr[i] ?? 0) / (ad / 2)) * 100 : 0;
  }

  // SMIsignal = ema(SMI, b)
  const smiS = Series.fromArray(bars, smiArr);
  const smiSignalArr = ta.ema(smiS, b).toArray();

  const warmup = a + b * 2;

  // Momentum plot (histogram, yellow)
  const momentumPlot = momArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
    color: '#FFEB3B',
  }));

  // SMI plot (blue line)
  const smiPlot = smiArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  // SMI Signal plot (red line)
  const smiSignalPlot = smiSignalArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  // barcolor + markers: long setup = SMI < -35 and mom > 0 and mom[1] < 0 -> lime
  //                      short setup = SMI > 35 and mom < 0 and mom[1] > 0 -> red
  const barColors: BarColorData[] = [];
  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < n; i++) {
    const smi = smiArr[i];
    const mom = momArr[i];
    const prevMom = momArr[i - 1];

    if (!isNaN(smi) && !isNaN(mom) && !isNaN(prevMom)) {
      if (smi < -35 && mom > 0 && prevMom < 0) {
        barColors.push({ time: bars[i].time, color: '#00E676' }); // lime
        markers.push({
          time: bars[i].time,
          position: 'belowBar',
          shape: 'triangleUp',
          color: '#00E676',
          text: 'Bot',
        });
      } else if (smi > 35 && mom < 0 && prevMom > 0) {
        barColors.push({ time: bars[i].time, color: '#EF5350' }); // red
        markers.push({
          time: bars[i].time,
          position: 'aboveBar',
          shape: 'triangleDown',
          color: '#EF5350',
          text: 'Top',
        });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'momentum': momentumPlot,
      'smi': smiPlot,
      'smiSignal': smiSignalPlot,
    },
    hlines: [
      { value: 40, options: { color: '#EF5350', linestyle: 'solid' as const, title: 'Over Bought' } },
      { value: -40, options: { color: '#26A69A', linestyle: 'solid' as const, title: 'Over Sold' } },
      { value: 0, options: { color: '#2196F3', linestyle: 'solid' as const, title: 'Zero Line' } },
    ],
    fills: [
      { plot1: 'hline_0', plot2: 'hline_2', options: { color: 'rgba(239, 83, 80, 0.15)', title: 'Overbought' } },
      { plot1: 'hline_0', plot2: 'hline_1', options: { color: 'rgba(38, 166, 154, 0.15)', title: 'Oversold' } },
    ],
    markers,
    barColors,
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] };
}

export const TopBottomCandle = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
