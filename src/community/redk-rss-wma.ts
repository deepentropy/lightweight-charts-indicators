/**
 * RedK Slow/Smooth Average (RSS_WMA)
 *
 * Double-smoothed WMA: WMA(WMA(source, length), smoothLength).
 *
 * Reference: TradingView "RedK RSS_WMA" by RedKTrader
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface RedKRSSWMAInputs {
  length: number;
  smoothLength: number;
  src: SourceType;
}

export const defaultInputs: RedKRSSWMAInputs = {
  length: 10,
  smoothLength: 5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smooth Length', defval: 5, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSS_WMA', color: '#FFEB3B', lineWidth: 2 },
];

export const metadata = {
  title: 'RedK RSS_WMA',
  shortTitle: 'RSS',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RedKRSSWMAInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, smoothLength, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  const wma1 = ta.wma(srcSeries, length);
  const wma1Arr = wma1.toArray();

  // Create Series from first WMA for second smoothing
  const wma1Series = new Series(bars, (_bar, i) => wma1Arr[i] ?? 0);
  const rssArr = ta.wma(wma1Series, smoothLength).toArray();

  const warmup = length + smoothLength;

  // Color: green (#33ff00) when rising, red (#ff1111) when falling
  const plot = rssArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? rssArr[i - 1] : null;
    const color = (prev != null && v > prev) ? '#33ff00' : '#ff1111';
    return { time: bars[i].time, value: v, color };
  });

  // Markers: swing up (was falling, now rising) and swing down (was rising, now falling)
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < bars.length; i++) {
    const cur = rssArr[i];
    const prev = rssArr[i - 1];
    const prevPrev = rssArr[i - 2];
    if (cur == null || prev == null || prevPrev == null) continue;
    const uptrend = cur > prev;
    const prevUptrend = prev > prevPrev;
    if (uptrend && !prevUptrend) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#33ff00', text: 'Up' });
    } else if (!uptrend && prevUptrend) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#ff1111', text: 'Dn' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot },
    markers,
  };
}

export const RedKRSSWMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
