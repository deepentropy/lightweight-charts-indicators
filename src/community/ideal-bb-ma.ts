/**
 * IDEAL BB with MA
 *
 * Bollinger Bands with a configurable moving average type overlay.
 * Combines BB upper/basis/lower with an independent MA line.
 *
 * Reference: TradingView "IDEAL Bollinger Bands with MA" (TV#322)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface IdealBbMaInputs {
  bbLen: number;
  bbMult: number;
  maLen: number;
  maType: string;
  src: SourceType;
}

export const defaultInputs: IdealBbMaInputs = {
  bbLen: 20,
  bbMult: 2.0,
  maLen: 50,
  maType: 'ema',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 50, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ema', options: ['sma', 'ema', 'wma', 'hma', 'rma'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Basis', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'MA', color: '#E040FB', lineWidth: 2 },
];

export const metadata = {
  title: 'IDEAL BB with MA',
  shortTitle: 'IBBMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IdealBbMaInputs> = {}): IndicatorResult {
  const { bbLen, bbMult, maLen, maType, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  const [bbMiddle, bbUpper, bbLower] = ta.bb(source, bbLen, bbMult);
  const bbMidArr = bbMiddle.toArray();
  const bbUpArr = bbUpper.toArray();
  const bbLoArr = bbLower.toArray();

  let maArr: (number | null)[];
  switch (maType) {
    case 'ema': maArr = ta.ema(source, maLen).toArray(); break;
    case 'wma': maArr = ta.wma(source, maLen).toArray(); break;
    case 'hma': maArr = ta.hma(source, maLen).toArray(); break;
    case 'rma': maArr = ta.rma(source, maLen).toArray(); break;
    default: maArr = ta.sma(source, maLen).toArray(); break;
  }

  const warmup = Math.max(bbLen, maLen);

  const plot0 = bbUpArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot1 = bbMidArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot2 = bbLoArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot3 = maArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    fills: [{ plot1: 'plot0', plot2: 'plot2', options: { color: '#2962FF20' } }],
  };
}

export const IdealBbMa = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
