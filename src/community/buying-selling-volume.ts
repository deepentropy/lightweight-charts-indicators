/**
 * Buying Selling Volume
 *
 * Splits volume into buying and selling components based on price position
 * within the bar range. Plots: Volume, BuyVolume, SellVolume, BuyVolume%,
 * SellVolume%, VolumeIndex. Pressure columns show dominant as positive,
 * counterforce as negative.
 *
 * Reference: TradingView "Buying Selling Volume" by ceyhun (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface BuyingSellVolumeInputs {
  vnLen: number;
}

export const defaultInputs: BuyingSellVolumeInputs = {
  vnLen: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'vnLen', type: 'int', title: 'Volume Index Length', defval: 1, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'volume', title: 'Volume', color: '#787B86', lineWidth: 3, style: 'columns' },
  { id: 'buyVol', title: 'BuyVolume', color: '#26A69A', lineWidth: 1, style: 'columns' },
  { id: 'sellVol', title: 'SellVolume', color: '#EF5350', lineWidth: 1, style: 'columns' },
  { id: 'buyPct', title: 'BuyVolume%', color: '#4CAF50', lineWidth: 1, style: 'circles' },
  { id: 'sellPct', title: 'SellVolume%', color: '#EF5350', lineWidth: 1, style: 'circles' },
  { id: 'volIndex', title: 'VolumeIndex', color: '#00FFFF', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Buying Selling Volume',
  shortTitle: 'BSVol',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BuyingSellVolumeInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { vnLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // BV = volume * (close - low) / (high - low); SV = volume * (high - close) / (high - low)
  const bvArr: number[] = new Array(n);
  const svArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const vol = bars[i].volume ?? 0;
    const range = bars[i].high - bars[i].low;
    if (range === 0) {
      bvArr[i] = 0;
      svArr[i] = 0;
    } else {
      bvArr[i] = vol * (bars[i].close - bars[i].low) / range;
      svArr[i] = vol * (bars[i].high - bars[i].close) / range;
    }
  }

  // RAW Pressure Volume Calculations
  const volArr = bars.map(b => Math.max(b.volume ?? 0, 1));
  const tpArr: number[] = new Array(n);
  const bpvArr: number[] = new Array(n);
  const spvArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    tpArr[i] = bvArr[i] + svArr[i];
    bpvArr[i] = tpArr[i] === 0 ? 0 : (bvArr[i] / tpArr[i]) * volArr[i];
    spvArr[i] = tpArr[i] === 0 ? 0 : (svArr[i] / tpArr[i]) * volArr[i];
  }

  // Conditional columns: dominant positive, counterforce negative
  const bpConArr: number[] = new Array(n);
  const spConArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    bpConArr[i] = bpvArr[i] > spvArr[i] ? bpvArr[i] : -Math.abs(bpvArr[i]);
    spConArr[i] = spvArr[i] > bpvArr[i] ? spvArr[i] : -Math.abs(spvArr[i]);
  }

  // BuyVolume% and SellVolume%
  const buyPctArr: number[] = new Array(n);
  const sellPctArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const total = bvArr[i] + svArr[i];
    buyPctArr[i] = total === 0 ? 50 : 100 * bvArr[i] / total;
    sellPctArr[i] = total === 0 ? 50 : 100 * svArr[i] / total;
  }

  // Volume Index: VN = vol / ema(vol, 20)
  const volSeries = new Series(bars, (_b, i) => volArr[i]);
  const volEma20 = ta.ema(volSeries, 20).toArray();

  const vnArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    vnArr[i] = (volEma20[i] ?? 1) === 0 ? 0 : volArr[i] / (volEma20[i] ?? 1);
  }

  const warmup = 20;

  // Volume plot: colored by bar direction
  const volumePlot = volArr.map((v, i) => {
    const color = bars[i].close >= bars[i].open
      ? 'rgba(76,175,80,0.30)' : 'rgba(244,67,54,0.30)';
    return { time: bars[i].time, value: v, color };
  });

  const buyVolPlot = bpConArr.map((v, i) => ({
    time: bars[i].time,
    value: v,
    color: '#26A69A',
  }));

  const sellVolPlot = spConArr.map((v, i) => ({
    time: bars[i].time,
    value: v,
    color: '#EF5350',
  }));

  const buyPctPlot = buyPctArr.map((v, i) => ({
    time: bars[i].time,
    value: v,
    color: '#4CAF50',
  }));

  const sellPctPlot = sellPctArr.map((v, i) => ({
    time: bars[i].time,
    value: v,
    color: '#EF5350',
  }));

  const volIndexPlot = vnArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const isUp = bars[i].close > bars[i].open;
    const color = v > vnLen && isUp ? '#00FFFF' : v > vnLen ? 'rgba(158,158,158,0.90)' : 'rgba(255,255,0,0.90)';
    return { time: bars[i].time, value: v, color };
  });

  // barcolor: blue when buy > sell, purple when sell > buy, gray otherwise
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    if (bpConArr[i] > spConArr[i]) barColors.push({ time: bars[i].time, color: '#2196F3' });
    else if (spConArr[i] > bpConArr[i]) barColors.push({ time: bars[i].time, color: '#9C27B0' });
    else barColors.push({ time: bars[i].time, color: '#787B86' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      volume: volumePlot,
      buyVol: buyVolPlot,
      sellVol: sellVolPlot,
      buyPct: buyPctPlot,
      sellPct: sellPctPlot,
      volIndex: volIndexPlot,
    },
    barColors,
  };
}

export const BuyingSellVolume = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
