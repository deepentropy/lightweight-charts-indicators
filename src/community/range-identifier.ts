/**
 * Range Identifier
 *
 * Tracks expanding consolidation ranges. When price stays within the
 * previous range, the range expands to encompass new highs/lows.
 * When price breaks out, the range resets.
 *
 * Reference: TradingView "Range Identifier [LazyBear]"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RangeIdentifierInputs {
  emaLength: number;
}

export const defaultInputs: RangeIdentifierInputs = {
  emaLength: 34,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 34, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Lower', color: '#EF5350', lineWidth: 2 },
  { id: 'plot2', title: 'Midline', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Range Identifier',
  shortTitle: 'RangeID',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RangeIdentifierInputs> = {}): IndicatorResult {
  const { emaLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const emaArr = ta.ema(closeSeries, emaLength).toArray();

  const rangeUp: number[] = new Array(n);
  const rangeDn: number[] = new Array(n);
  const mid: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const close = bars[i].close;

    if (i === 0) {
      rangeUp[i] = high;
      rangeDn[i] = low;
    } else {
      const prevUp = rangeUp[i - 1];
      const prevDn = rangeDn[i - 1];

      if (close >= prevDn && close <= prevUp) {
        // Inside range — expand
        rangeUp[i] = Math.max(prevUp, high);
        rangeDn[i] = Math.min(prevDn, low);
      } else {
        // Breakout — reset
        rangeUp[i] = high;
        rangeDn[i] = low;
      }
    }

    mid[i] = (rangeUp[i] + rangeDn[i]) / 2;
  }

  const warmup = emaLength;
  const fillColors: string[] = [];

  const upperPlot = rangeUp.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const ema = emaArr[i] ?? 0;
    const bullish = bars[i].close > ema;
    const color = bullish ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const lowerPlot = rangeDn.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const ema = emaArr[i] ?? 0;
    const bullish = bars[i].close > ema;
    const color = bullish ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const midPlot = mid.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v };
  });

  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      fillColors.push('transparent');
      continue;
    }
    const ema = emaArr[i] ?? 0;
    const bullish = bars[i].close > ema;
    fillColors.push(bullish ? '#26A69A40' : '#EF535040');
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': upperPlot, 'plot1': lowerPlot, 'plot2': midPlot },
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: fillColors }],
  };
}

export const RangeIdentifier = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
