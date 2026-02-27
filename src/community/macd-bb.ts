/**
 * AK MACD BB Indicator
 *
 * MACD histogram enclosed by Bollinger Bands.
 * BB applied to MACD histogram for overbought/oversold detection.
 *
 * Reference: TradingView "AK MACD BB INDICATOR" by Algokid
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface MACDBBInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  bbLength: number;
  bbMult: number;
  src: SourceType;
}

export const defaultInputs: MACDBBInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  bbLength: 20,
  bbMult: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.01, step: 0.5 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'BB Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'BB Lower', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot3', title: 'BB Basis', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'AK MACD BB',
  shortTitle: 'MACDBB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACDBBInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { fastLength, slowLength, signalLength, bbLength, bbMult, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const macdLine = fastEMA.sub(slowEMA);
  const signalLine = ta.ema(macdLine, signalLength);
  const histogram = macdLine.sub(signalLine);
  const histArr = histogram.toArray();

  // BB on histogram
  const bbBasis = ta.sma(histogram, bbLength);
  const bbDev = ta.stdev(histogram, bbLength).mul(bbMult);
  const bbUpper = bbBasis.add(bbDev);
  const bbLower = bbBasis.sub(bbDev);

  const basisArr = bbBasis.toArray();
  const upperArr = bbUpper.toArray();
  const lowerArr = bbLower.toArray();

  const warmup = Math.max(slowLength, bbLength);

  const plot0 = histArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (histArr[i - 1] ?? NaN) : NaN;
    let color: string;
    if (v >= 0) {
      color = v > prev ? '#00E676' : '#26A69A';
    } else {
      color = v < prev ? '#FF5252' : '#EF5350';
    }
    return { time: bars[i].time, value: v, color };
  });

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  // Pine barcolor: macd > Upper => yellow; macd < Lower => aqua
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const h = histArr[i];
    const u = upperArr[i];
    const l = lowerArr[i];
    if (h == null || u == null || l == null) continue;
    if (h > u) {
      barColors.push({ time: bars[i].time, color: '#FFEB3B' });
    } else if (h < l) {
      barColors.push({ time: bars[i].time, color: '#00BCD4' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': toPlot(upperArr), 'plot2': toPlot(lowerArr), 'plot3': toPlot(basisArr) },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(33, 150, 243, 0.15)' } },
    ],
    barColors,
  };
}

export const MACDBB = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
