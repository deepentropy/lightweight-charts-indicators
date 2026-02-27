/**
 * VolumeBarBreakout
 *
 * Identifies the highest volume bar in a lookback period, then plots
 * its high and low as support/resistance levels. Generates BUY signals
 * on breakout above the high, and SELL signals on breakdown below the low.
 *
 * Reference: TradingView "Volume Bar Breakout and Breakdown Indicator" by tradeswithashish
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface VolumeBarBreakoutInputs {
  lookback: number;
}

export const defaultInputs: VolumeBarBreakoutInputs = {
  lookback: 75,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'How many bars to check', defval: 75, min: 5, max: 500, step: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'highVB', title: 'Candle High', color: 'rgba(255,255,255,0)', lineWidth: 1 },
  { id: 'lowVB', title: 'Candle Low', color: 'rgba(255,255,255,0)', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Bar Breakout',
  shortTitle: 'VolBreak',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeBarBreakoutInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lb = cfg.lookback;

  // Find highest volume over lookback
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const highestVolArr = ta.highest(volSeries, lb).toArray();

  // SMA(volume, 20) for breakout filter
  const volMA = ta.sma(volSeries, 20).toArray();

  // Track high/low of highest volume bar (Pine uses var for persistence)
  let highVB = bars.length > 0 ? bars[0].high : 0;
  let lowVB = bars.length > 0 ? bars[0].low : 0;

  const highVBArr: number[] = new Array(n);
  const lowVBArr: number[] = new Array(n);

  const warmup = lb;

  for (let i = 0; i < n; i++) {
    const vol = bars[i].volume ?? 0;

    if (vol > 0 && i >= 1) {
      const hv = highestVolArr[i] ?? 0;
      // Pine: for i = 1 to lookback, if volume[i] == highestvol
      // Find which bar in the lookback has the highest volume
      for (let j = 1; j <= Math.min(lb, i); j++) {
        if ((bars[i - j].volume ?? 0) === hv) {
          highVB = bars[i - j].high;
          lowVB = bars[i - j].low;
          break;
        }
      }
    }

    highVBArr[i] = highVB;
    lowVBArr[i] = lowVB;
  }

  // Fill color: aqua when level unchanged, white otherwise
  const fillColors = highVBArr.map((v, i) => {
    if (i < warmup) return 'transparent';
    return (i > 0 && v === highVBArr[i - 1]) ? 'rgba(0,255,255,0.20)' : 'rgba(255,255,255,0.20)';
  });

  const highVBPlot = highVBArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const lowVBPlot = lowVBArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  // Breakout/Breakdown signals
  // Pine: breakout = ta.crossover(close, highVB) and volume>volMA and barstate.isconfirmed and volume>volume[1] and (close-low)/(high-low)>0.5
  // Pine: breakdown = ta.crossunder(close, lowVB) and volume>volMA and barstate.isconfirmed and volume>volume[1] and (close-low)/(high-low)<0.5
  // We skip barstate.isconfirmed (always true in historical data)
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const vol = bars[i].volume ?? 0;
    const prevVol = bars[i - 1].volume ?? 0;
    const ma = volMA[i] ?? 0;
    const range = bars[i].high - bars[i].low;
    const closeRatio = range !== 0 ? (bars[i].close - bars[i].low) / range : 0.5;

    // crossover: close crosses above highVB
    const crossOver = bars[i].close > highVBArr[i] && bars[i - 1].close <= highVBArr[i - 1];
    // crossunder: close crosses below lowVB
    const crossUnder = bars[i].close < lowVBArr[i] && bars[i - 1].close >= lowVBArr[i - 1];

    if (crossOver && vol > ma && vol > prevVol && closeRatio > 0.5) {
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'labelUp',
        color: '#0000FF',
        text: 'BUY',
      });
    }

    if (crossUnder && vol > ma && vol > prevVol && closeRatio < 0.5) {
      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'labelDown',
        color: '#000000',
        text: 'SELL',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { highVB: highVBPlot, lowVB: lowVBPlot },
    fills: [{ plot1: 'highVB', plot2: 'lowVB', options: { color: 'rgba(0,255,255,0.20)' }, colors: fillColors }],
    markers,
  };
}

export const VolumeBarBreakout = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
