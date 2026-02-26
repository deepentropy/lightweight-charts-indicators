/**
 * SuperTrend Channels
 *
 * Standard SuperTrend with channel bands derived from highest/lowest
 * of the SuperTrend line over a lookback period.
 *
 * Reference: TradingView "SuperTrend Channels" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SupertrendChannelsInputs {
  atrLen: number;
  factor: number;
  channelLen: number;
}

export const defaultInputs: SupertrendChannelsInputs = {
  atrLen: 10,
  factor: 3.0,
  channelLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 3.0, min: 0.1, step: 0.1 },
  { id: 'channelLen', type: 'int', title: 'Channel Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperTrend', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Channel Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Channel Lower', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'SuperTrend Channels',
  shortTitle: 'STCh',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SupertrendChannelsInputs> = {}): IndicatorResult {
  const { atrLen, factor, channelLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, atrLen).toArray();

  // SuperTrend calculation
  const stArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atr = (atrArr[i] ?? 0) * factor;
    const up = hl2 - atr;
    const dn = hl2 + atr;

    if (i === 0) {
      stArr[i] = up;
      dirArr[i] = 1;
      continue;
    }

    const prevDir = dirArr[i - 1];
    const prevSt = stArr[i - 1];
    const close = bars[i].close;
    const prevClose = bars[i - 1].close;

    const trailUp = prevClose > prevSt && prevDir === 1 ? Math.max(up, prevSt) : up;
    const trailDn = prevClose < prevSt && prevDir === -1 ? Math.min(dn, prevSt) : dn;

    if (prevDir === 1) {
      if (close < trailUp) {
        dirArr[i] = -1;
        stArr[i] = trailDn;
      } else {
        dirArr[i] = 1;
        stArr[i] = trailUp;
      }
    } else {
      if (close > trailDn) {
        dirArr[i] = 1;
        stArr[i] = trailUp;
      } else {
        dirArr[i] = -1;
        stArr[i] = trailDn;
      }
    }
  }

  // Channel = highest/lowest of SuperTrend over channelLen
  const stSeries = new Series(bars, (_b, i) => stArr[i]);
  const chUpperArr = ta.highest(stSeries, channelLen).toArray();
  const chLowerArr = ta.lowest(stSeries, channelLen).toArray();

  const warmup = atrLen + channelLen;

  const plot0 = stArr.map((v, i) => {
    if (i < atrLen) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = chUpperArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null ? NaN : v,
  }));

  const plot2 = chLowerArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
  };
}

export const SupertrendChannels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
