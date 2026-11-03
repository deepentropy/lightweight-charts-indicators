/**
 * Heiken Ashi Candles
 *
 * Draws Heikin Ashi candles of the chart symbol on the chart timeframe (the open, high, low and close of the Heikin
 * Ashi series of the symbol): HA close = (open + high + low + close) / 4, HA open = (previous HA open + previous HA
 * close) / 2 ((open + close) / 2 on the first bar), HA high / low = the extremes of high / low and the HA open and
 * close. With "HA Candles" off the regular candles are drawn. Green when close > open, else red; black border.
 *
 * Reference: "Heiken Ashi Candles" by CryptoRox
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, heikinAshi, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface HeikenAshiCandlesInputs {
  /** Heikin Ashi candles (off: regular candles) */
  isHA: boolean;
}

export const defaultInputs: HeikenAshiCandlesInputs = {
  isHA: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'isHA', type: 'bool', title: 'HA Candles', defval: true },
];

// Only candles (plotcandle): no line plots
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candles', title: 'Heiken Ashi' },
];

export const metadata = {
  title: 'Heiken Ashi Candles',
  shortTitle: 'Heiken Ashi',
  overlay: true,
};

/** plotcandle without wickcolor: the style default of the plotcandle */
const DEFAULT_WICK = '#363A45';

export function calculate(
  bars: Bar[],
  inputs: Partial<HeikenAshiCandlesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } {
  const { isHA } = { ...defaultInputs, ...inputs };
  // request.security(isHA ? ticker.heikinashi(syminfo.tickerid) : syminfo.tickerid, timeframe.period, ...)
  const src = isHA ? heikinAshi(bars) : bars;
  const candles: PlotCandleData[] = src.map((b) => {
    // col = c > o ? color.green : color.red (Pine comparison within 1e-10)
    const col = b.close - b.open > 1e-10 ? color.green : color.red;
    return {
      time: b.time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
      color: col,
      wickColor: DEFAULT_WICK,
      borderColor: color.black,
    };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { candles },
  };
}

export const HeikenAshiCandles = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
};
