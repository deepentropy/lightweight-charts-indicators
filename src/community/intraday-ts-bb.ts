/**
 * Intraday TS, BB + Buy_Sell + Squeeze Mom + ADX-DMI
 *
 * Bollinger Band %B oscillator. %B = (close - lowerBB) / (upperBB - lowerBB).
 * Useful for identifying overbought/oversold and squeeze conditions.
 *
 * Reference: TradingView "Intraday TS, BB + Buy_Sell + Squeeze Mom + ADX-DMI" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface IntradayTSBBInputs {
  bbLen: number;
  bbMult: number;
  src: SourceType;
}

export const defaultInputs: IntradayTSBBInputs = {
  bbLen: 20,
  bbMult: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%B', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Intraday TS BB',
  shortTitle: 'ITSBB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<IntradayTSBBInputs> = {}): IndicatorResult {
  const { bbLen, bbMult, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const [bbUpper, , bbLower] = ta.bb(source, bbLen, bbMult);
  const upperArr = bbUpper.toArray();
  const lowerArr = bbLower.toArray();
  const warmup = bbLen;

  const plot0 = bars.map((b, i) => {
    if (i < warmup || upperArr[i] == null || lowerArr[i] == null) {
      return { time: b.time, value: NaN };
    }
    const upper = upperArr[i]!;
    const lower = lowerArr[i]!;
    const range = upper - lower;
    const pctB = range === 0 ? 0.5 : (b.close - lower) / range;
    return { time: b.time, value: pctB };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 1.0, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Upper' } },
      { value: 0.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Mid' } },
      { value: 0.0, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'Lower' } },
    ],
  };
}

export const IntradayTSBB = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
