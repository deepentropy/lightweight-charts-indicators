/**
 * Intraday TS, BB + Buy_Sell + Squeeze Mom + ADX-DMI
 *
 * Bollinger Band %B oscillator. %B = (close - lowerBB) / (upperBB - lowerBB).
 * Useful for identifying overbought/oversold and squeeze conditions.
 *
 * Reference: TradingView "Intraday TS, BB + Buy_Sell + Squeeze Mom + ADX-DMI" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<IntradayTSBBInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
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

  // Markers: signal when %B crosses above 1 (overbought breakout) or below 0 (oversold breakout)
  // and when it returns to the band (mean-reversion entry)
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  for (let i = warmup + 1; i < bars.length; i++) {
    const prevPctB = plot0[i - 1].value;
    const curPctB = plot0[i].value;
    if (isNaN(prevPctB) || isNaN(curPctB)) continue;

    // Crossover above 1 = breakout bullish
    if (prevPctB <= 1 && curPctB > 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleUp', color: '#00E676', text: 'OB' });
    }
    // Crossunder below 0 = breakout bearish
    if (prevPctB >= 0 && curPctB < 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleDown', color: '#FF5252', text: 'OS' });
    }
    // Return inside from overbought
    if (prevPctB > 1 && curPctB <= 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FF9800', text: 'Ret' });
    }

    // Bar colors: aqua if inside bands, orange if near entry zones, fuchsia if at targets
    if (curPctB > 1) {
      barColors.push({ time: bars[i].time, color: '#FF00FF' }); // fuchsia - overbought
    } else if (curPctB < 0) {
      barColors.push({ time: bars[i].time, color: '#FF00FF' }); // fuchsia - oversold
    } else if (curPctB > 0.8 || curPctB < 0.2) {
      barColors.push({ time: bars[i].time, color: '#FFA500' }); // orange - near extremes
    } else {
      barColors.push({ time: bars[i].time, color: '#00FFFF' }); // aqua - inside bands
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 1.0, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Upper' } },
      { value: 0.5, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Mid' } },
      { value: 0.0, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'Lower' } },
    ],
    markers,
    barColors,
  };
}

export const IntradayTSBB = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
