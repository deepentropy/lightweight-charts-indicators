/**
 * Reversal Candle Pattern SetUp
 *
 * Detects bullish/bearish reversals based on consecutive same-direction
 * candles followed by a reversal candle breaking the previous extreme.
 *
 * Reference: TradingView "Reversal Candle Pattern SetUp" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ReversalCandleSetupInputs {
  lookback: number;
}

export const defaultInputs: ReversalCandleSetupInputs = {
  lookback: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 3, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Reversal Candle Setup',
  shortTitle: 'RevCdl',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ReversalCandleSetupInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { lookback } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const markers: MarkerData[] = [];

  const closePlot = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = lookback; i < n; i++) {
    const cur = bars[i];
    const isGreen = cur.close > cur.open;
    const isRed = cur.close < cur.open;

    // Check for consecutive red candles before current
    let allRed = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i - j].close >= bars[i - j].open) {
        allRed = false;
        break;
      }
    }

    // Bullish reversal: lookback consecutive red candles, then green closing above prev high
    if (allRed && isGreen && cur.close > bars[i - 1].high) {
      markers.push({
        time: cur.time as number,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#26A69A',
        text: 'BullRev',
      });
    }

    // Check for consecutive green candles before current
    let allGreen = true;
    for (let j = 1; j <= lookback; j++) {
      if (bars[i - j].close <= bars[i - j].open) {
        allGreen = false;
        break;
      }
    }

    // Bearish reversal: lookback consecutive green candles, then red closing below prev low
    if (allGreen && isRed && cur.close < bars[i - 1].low) {
      markers.push({
        time: cur.time as number,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#EF5350',
        text: 'BearRev',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': closePlot },
    markers,
  };
}

export const ReversalCandleSetup = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
