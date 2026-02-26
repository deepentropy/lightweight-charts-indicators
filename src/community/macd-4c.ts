/**
 * MACD 4C (Four Color MACD)
 *
 * Standard MACD histogram with 4-color coding:
 * - Lime: positive and rising
 * - Green: positive and falling
 * - Maroon: negative and falling
 * - Red: negative and rising
 *
 * Reference: TradingView "MACD 4C" by vkno422
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MACD4CInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: MACD4CInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast MA', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow MA', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD 4C', color: '#26A69A', lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'MACD 4C',
  shortTitle: 'MACD4C',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MACD4CInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const fastEMA = ta.ema(source, fastLength);
  const slowEMA = ta.ema(source, slowLength);
  const macdLine = fastEMA.sub(slowEMA);
  const macdArr = macdLine.toArray();

  const data = macdArr.map((value, i) => {
    const v = value ?? NaN;
    const prev = i > 0 ? (macdArr[i - 1] ?? NaN) : NaN;
    let color: string;
    if (v > 0) {
      color = v > prev ? '#00FF00' : '#008000'; // lime : green
    } else {
      color = v < prev ? '#800000' : '#FF0000'; // maroon : red
    }
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': data },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'solid', title: 'Zero' } }],
  };
}

export const MACD4C = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
