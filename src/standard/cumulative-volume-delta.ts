/**
 * Cumulative Volume Delta (CVD) Indicator
 *
 * Tracks cumulative volume delta within anchor periods (daily, weekly, etc.).
 * Approximates up/down volume by comparing close to open price.
 * Resets at each anchor period boundary.
 *
 * PineScript display:
 *   hline(0)
 *   plotcandle(openVolume, maxVolume, minVolume, lastVolume, "CVD", color=col, bordercolor=col, wickcolor=col)
 *
 * Note: TradingView's version uses intrabar data for more precise calculation.
 * This implementation uses close vs open as an approximation.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface CumulativeVolumeDeltaInputs {
  /** Anchor timeframe for period boundaries */
  anchorTimeframe: string;
}

export const defaultInputs: CumulativeVolumeDeltaInputs = {
  anchorTimeframe: '1D',
};

export const inputConfig: InputConfig[] = [
  { id: 'anchorTimeframe', type: 'string', title: 'Anchor Period', defval: '1D', options: ['1D', '1W', '1M'] },
];

// No line plots — rendered via plotCandles
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'cvd', title: 'CVD' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero' },
];

export const metadata = {
  title: 'Cumulative Volume Delta',
  shortTitle: 'CVD',
  overlay: false,
};

/**
 * Get the start of the period for a given timestamp based on the anchor timeframe
 */
function getStartOfPeriod(timestamp: number, timeframe: string): number {
  const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const date = new Date(ts);
  const tf = timeframe.toUpperCase();

  if (tf === '1W' || tf === 'W') {
    const day = date.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - diff);
    date.setUTCHours(0, 0, 0, 0);
  } else if (tf === '1M' || tf === 'M') {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }

  return timestamp < 1e12 ? Math.floor(date.getTime() / 1000) : date.getTime();
}

function isNewPeriod(currentTime: number, previousTime: number | null, timeframe: string): boolean {
  if (previousTime === null) return true;
  return getStartOfPeriod(currentTime, timeframe) !== getStartOfPeriod(previousTime, timeframe);
}

export function calculate(bars: Bar[], inputs: Partial<CumulativeVolumeDeltaInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const { anchorTimeframe } = { ...defaultInputs, ...inputs };

  const candles: PlotCandleData[] = [];

  let prevTime: number | null = null;
  let cumDelta = 0;
  let periodOpenDelta = 0;
  let periodMaxDelta = 0;
  let periodMinDelta = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const barTime = typeof bar.time === 'number' ? bar.time : new Date(bar.time as string).getTime() / 1000;
    const volume = bar.volume ?? 0;

    const isAnchor = isNewPeriod(barTime, prevTime, anchorTimeframe);

    let delta: number;
    if (bar.close > bar.open) {
      delta = volume;
    } else if (bar.close < bar.open) {
      delta = -volume;
    } else {
      delta = 0;
    }

    if (isAnchor) {
      cumDelta = delta;
      periodOpenDelta = 0;
      periodMaxDelta = cumDelta;
      periodMinDelta = cumDelta;
    } else {
      cumDelta += delta;
      periodMaxDelta = Math.max(periodMaxDelta, cumDelta);
      periodMinDelta = Math.min(periodMinDelta, cumDelta);
    }

    const col = cumDelta >= periodOpenDelta ? '#26A69A' : '#EF5350';
    candles.push({
      time: bar.time as number,
      open: periodOpenDelta,
      high: periodMaxDelta,
      low: periodMinDelta,
      close: cumDelta,
      color: col,
      borderColor: col,
      wickColor: col,
    });

    prevTime = barTime;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { cvd: candles },
  };
}

export const CumulativeVolumeDelta = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
  hlineConfig,
};
