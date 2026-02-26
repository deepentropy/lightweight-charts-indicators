/**
 * Custom Indicator Bulls or Bears in Control
 *
 * Shows if bulls or bears control the market.
 * Bull Power = high - EMA(close, length). Bear Power = low - EMA(close, length).
 * Total = bullPower + bearPower. Histogram green when > 0, red when < 0.
 *
 * Reference: TradingView "Custom Indicator Bulls or Bears in Control" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BullsBearsInputs {
  length: number;
}

export const defaultInputs: BullsBearsInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Total Power', color: '#2962FF', lineWidth: 1, style: 'histogram' },
];

export const hlineConfig = [
  { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
];

export const metadata = {
  title: 'Bulls or Bears in Control',
  shortTitle: 'BullBear',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BullsBearsInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const closeSeries = getSourceSeries(bars, 'close');
  const emaArr = ta.ema(closeSeries, length).toArray();

  const warmup = length;

  const plot0 = bars.map((b, i) => {
    if (i < warmup || isNaN(emaArr[i])) return { time: b.time, value: NaN };
    const bullPower = b.high - emaArr[i];
    const bearPower = b.low - emaArr[i];
    const total = bullPower + bearPower;
    const color = total > 0 ? '#26A69A' : '#EF5350';
    return { time: b.time, value: total, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
  };
}

export const BullsBears = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
