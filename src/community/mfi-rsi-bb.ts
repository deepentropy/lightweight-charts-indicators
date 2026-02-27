/**
 * MFI or RSI enclosed by Bollinger Bands
 *
 * RSI (or MFI) with Bollinger Bands overlay for overbought/oversold detection.
 *
 * Reference: TradingView "MFI or RSI enclosed by Bollinger Bands" community indicator
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface MFIRSIBollingerBandsInputs {
  rsiLength: number;
  bbLength: number;
  bbMult: number;
  useRSI: boolean;
  src: SourceType;
}

export const defaultInputs: MFIRSIBollingerBandsInputs = {
  rsiLength: 14,
  bbLength: 20,
  bbMult: 2.0,
  useRSI: true,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI/MFI Length', defval: 14, min: 1 },
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.01, step: 0.5 },
  { id: 'useRSI', type: 'bool', title: 'Use RSI (false=MFI)', defval: true },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI/MFI', color: '#7E57C2', lineWidth: 2 },
  { id: 'plot1', title: 'BB Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'BB Lower', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot3', title: 'BB Basis', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'MFI/RSI Bollinger Bands',
  shortTitle: 'MFIRSBB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MFIRSIBollingerBandsInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  const { rsiLength, bbLength, bbMult, useRSI, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  let oscArr: number[];

  if (useRSI) {
    oscArr = ta.rsi(source, rsiLength).toArray().map(v => v ?? NaN);
  } else {
    // Manual MFI calculation
    const hlc3Arr = bars.map(b => (b.high + b.low + b.close) / 3);
    const rawMoneyFlow = hlc3Arr.map((v, i) => v * (bars[i].volume ?? 0));

    const posFlow: number[] = new Array(bars.length).fill(0);
    const negFlow: number[] = new Array(bars.length).fill(0);
    for (let i = 1; i < bars.length; i++) {
      if (hlc3Arr[i] > hlc3Arr[i - 1]) {
        posFlow[i] = rawMoneyFlow[i];
      } else if (hlc3Arr[i] < hlc3Arr[i - 1]) {
        negFlow[i] = rawMoneyFlow[i];
      }
    }

    oscArr = new Array(bars.length).fill(NaN);
    for (let i = rsiLength; i < bars.length; i++) {
      let sumPos = 0, sumNeg = 0;
      for (let j = 0; j < rsiLength; j++) {
        sumPos += posFlow[i - j];
        sumNeg += negFlow[i - j];
      }
      oscArr[i] = sumNeg === 0 ? 100 : 100 - 100 / (1 + sumPos / sumNeg);
    }
  }

  // BB on oscillator values
  const oscSeries = new Series(bars, (_b, i) => oscArr[i]);
  const bbBasis = ta.sma(oscSeries, bbLength);
  const bbDev = ta.stdev(oscSeries, bbLength).mul(bbMult);
  const bbUpper = bbBasis.add(bbDev);
  const bbLower = bbBasis.sub(bbDev);

  const basisArr = bbBasis.toArray();
  const upperArr = bbUpper.toArray();
  const lowerArr = bbLower.toArray();

  const warmup = Math.max(rsiLength, bbLength);

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => {
      const val = typeof v === 'number' ? v : NaN;
      return { time: bars[i].time, value: (i < warmup || isNaN(val)) ? NaN : val };
    });

  const oscPlot = oscArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));

  // Pine bgcolor: bb_s > upper => red; bb_s < lower => green (highlight breaches)
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const osc = oscArr[i];
    const u = upperArr[i];
    const l = lowerArr[i];
    if (isNaN(osc) || u == null || l == null) continue;
    if (osc > u) {
      bgColors.push({ time: bars[i].time, color: 'rgba(239, 83, 80, 0.1)' });
    } else if (osc < l) {
      bgColors.push({ time: bars[i].time, color: 'rgba(38, 166, 154, 0.1)' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': oscPlot, 'plot1': toPlot(upperArr), 'plot2': toPlot(lowerArr), 'plot3': toPlot(basisArr) },
    hlines: [
      { value: 70, options: { color: '#EF5350', linestyle: 'dashed', title: 'OB' } },
      { value: 30, options: { color: '#26A69A', linestyle: 'dashed', title: 'OS' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dotted', title: 'Mid' } },
    ],
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(33, 150, 243, 0.12)' } },
    ],
    bgColors,
  };
}

export const MFIRSIBollingerBands = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
