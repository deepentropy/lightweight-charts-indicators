/**
 * AK MACD BB Indicator
 *
 * MACD histogram enclosed by Bollinger Bands.
 * BB applied to MACD histogram for overbought/oversold detection.
 *
 * Reference: TradingView "AK MACD BB INDICATOR" by Algokid
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
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
  bbLength: 10,
  bbMult: 1.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'bbLength', type: 'int', title: 'BB Periods', defval: 10, min: 1 },
  { id: 'bbMult', type: 'float', title: 'Deviations', defval: 1.0, min: 0.01, step: 0.5 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: '#26A69A', lineWidth: 3, style: 'circles' },
  { id: 'plot1', title: 'BB Upper', color: '#808080', lineWidth: 2 },
  { id: 'plot2', title: 'BB Lower', color: '#808080', lineWidth: 2 },
  { id: 'plot3', title: 'BB Basis', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'AK MACD BB',
  shortTitle: 'MACDBB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACDBBInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { fastLength, slowLength, bbLength, bbMult, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const macdLine = fastEMA.sub(slowEMA);

  // BB on MACD (Pine applies BB directly to macd, not histogram)
  const bbBasis = ta.sma(macdLine, bbLength);
  const bbDev = ta.stdev(macdLine, bbLength).mul(bbMult);
  const bbUpper = bbBasis.add(bbDev);
  const bbLower = bbBasis.sub(bbDev);

  const basisArr = bbBasis.toArray();
  const upperArr = bbUpper.toArray();
  const lowerArr = bbLower.toArray();

  const warmup = Math.max(slowLength, bbLength);

  const macdArr = macdLine.toArray();

  const plot0 = macdArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const u = upperArr[i];
    const color = (u != null && v >= u) ? '#00FF00' : '#FF0000';
    return { time: bars[i].time, value: v, color };
  });

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  // Pine barcolor: macd > Upper => yellow; macd < Lower => aqua
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const m = macdArr[i];
    const u = upperArr[i];
    const l = lowerArr[i];
    if (m == null || u == null || l == null) continue;
    if (m > u) {
      barColors.push({ time: bars[i].time, color: '#FFEB3B' });
    } else if (m < l) {
      barColors.push({ time: bars[i].time, color: '#00BCD4' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': toPlot(upperArr), 'plot2': toPlot(lowerArr), 'plot3': toPlot(basisArr) },
    hlines: [{ value: 0, options: { color: '#FF7F00', linestyle: 'solid' as const, title: 'Zeroline' } }],
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(33, 150, 243, 0.15)' } },
    ],
    barColors,
  };
}

export const MACDBB = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
