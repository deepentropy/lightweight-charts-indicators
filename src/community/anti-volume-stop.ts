/**
 * Anti-Volume Stop Loss
 *
 * Volume-based stop loss. Uses ATR scaled by the ratio of current volume
 * to average volume. Trails the stop in the direction of the trend.
 *
 * Reference: TradingView "Anti-Volume Stop Loss" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AntiVolumeStopInputs {
  length: number;
}

export const defaultInputs: AntiVolumeStopInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stop Level', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Anti-Volume Stop Loss',
  shortTitle: 'AVStop',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AntiVolumeStopInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, length).toArray();
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const avgVolArr = ta.sma(volSeries, length).toArray();

  const stopArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n); // 1 = long, -1 = short

  for (let i = 0; i < n; i++) {
    const atrVal = atrArr[i] ?? 0;
    const avgVol = avgVolArr[i] ?? 1;
    const vol = bars[i].volume ?? 0;
    const volRatio = avgVol > 0 ? vol / avgVol : 1;
    const stopDist = atrVal * volRatio;

    if (i === 0) {
      stopArr[i] = bars[i].close - stopDist;
      dirArr[i] = 1;
      continue;
    }

    const prevStop = stopArr[i - 1];
    const prevDir = dirArr[i - 1];
    const close = bars[i].close;

    if (prevDir === 1) {
      const newStop = close - stopDist;
      if (close > prevStop) {
        stopArr[i] = Math.max(newStop, prevStop);
        dirArr[i] = 1;
      } else {
        stopArr[i] = close + stopDist;
        dirArr[i] = -1;
      }
    } else {
      const newStop = close + stopDist;
      if (close < prevStop) {
        stopArr[i] = Math.min(newStop, prevStop);
        dirArr[i] = -1;
      } else {
        stopArr[i] = close - stopDist;
        dirArr[i] = 1;
      }
    }
  }

  const warmup = length;
  const plot0 = stopArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const AntiVolumeStop = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
