/**
 * CM RSI-2 Strategy Upper
 *
 * RSI(2) based overlay. When RSI(2) < 10, bar is green (buy).
 * When RSI(2) > 90, bar is red (sell). Shows SMA(200) for trend filter.
 *
 * Reference: TradingView "CM_RSI-2 Strategy" by ChrisMoody
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface CMRSI2UpperInputs {
  rsiLen: number;
  smaLen: number;
  src: SourceType;
}

export const defaultInputs: CMRSI2UpperInputs = {
  rsiLen: 2,
  smaLen: 200,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 2, min: 1 },
  { id: 'smaLen', type: 'int', title: 'SMA Length', defval: 200, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA 200', color: '#787B86', lineWidth: 2 },
];

export const metadata = {
  title: 'CM RSI-2 Strategy Upper',
  shortTitle: 'CMRSI2',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMRSI2UpperInputs> = {}): IndicatorResult {
  const { rsiLen, smaLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();
  const sma = ta.sma(source, smaLen);
  const smaArr = sma.toArray();

  const warmup = Math.max(rsiLen, smaLen);
  const barColors: BarColorData[] = [];

  const plot0 = smaArr.map((v, i) => {
    if (i >= rsiLen) {
      const r = rsiArr[i];
      if (r != null) {
        if (r < 10) barColors.push({ time: bars[i].time as number, color: '#26A69A' });
        else if (r > 90) barColors.push({ time: bars[i].time as number, color: '#EF5350' });
      }
    }
    return {
      time: bars[i].time,
      value: (v == null || i < smaLen) ? NaN : v,
    };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    barColors,
  } as IndicatorResult & { barColors: BarColorData[] };
}

export const CMRSI2Upper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
