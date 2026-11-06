/**
 * Trade Price - Spread Compensator
 *
 * Ask and bid candles shifted from the chart prices by a spread: spread = spread (pips) / decimal units. The ask
 * candle is (close, high + spread, low + spread, close + spread), the bid candle (close, high - spread, low - spread,
 * close - spread); both open at the close, as the original script. The anchor mode shows the ask candle, the bid
 * candle or both.
 *
 * Reference: "Trade Price – Spread Compensator" by The_Forex_Steward
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TradePriceSpreadCompensatorOverlayInputs {
  /** Spread in pips */
  spreadPips: number;
  /** Candles shown: Ask, Bid or Both */
  anchorMode: 'Ask' | 'Bid' | 'Both';
  /** Decimal units (pips per price unit) */
  decUnit: number;
}

export const defaultInputs: TradePriceSpreadCompensatorOverlayInputs = {
  spreadPips: 2.0,
  anchorMode: 'Both',
  decUnit: 10000,
};

export const inputConfig: InputConfig[] = [
  { id: 'spreadPips', type: 'float', title: 'Spread (pips)', defval: 2.0, step: 0.1 },
  { id: 'anchorMode', type: 'string', title: 'Anchor Mode', defval: 'Both', options: ['Ask', 'Bid', 'Both'] },
  { id: 'decUnit', type: 'int', title: 'Decimal Units', defval: 10000, min: 1, max: 100000 }, // Pine options = [1, 10, 100, 1000, 10000, 100000]
];

// No plot(): the outputs are two plotcandle series
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'ask', title: 'Ask Candle' },
  { id: 'bid', title: 'Bid Candle' },
];

export const metadata = {
  title: 'Trade Price – Spread Compensator',
  shortTitle: 'Trade Price – Spread Compensator',
  overlay: true,
};

type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };

interface SpreadRun extends BarRunState<Record<string, never>> {
  ask: PlotCandleData[];
  bid: PlotCandleData[];
}

function study(inputs: Partial<TradePriceSpreadCompensatorOverlayInputs>): BarStudy<SpreadRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const pipValue = 1.0 / cfg.decUnit;
  const spread = cfg.spreadPips * pipValue;
  // askColor = bidColor = color.new(color.orange, 25) on every bar
  const col = String(color.new(color.orange, 25));
  // display = showAsk / showBid ? display.all : display.none: a hidden candle series has no output
  const showAsk = cfg.anchorMode === 'Ask' || cfg.anchorMode === 'Both';
  const showBid = cfg.anchorMode === 'Bid' || cfg.anchorMode === 'Both';
  return {
    init() {
      const s: SpreadRun = { ask: [], bid: [], steps: [], vars: {}, lists: [], series: [] };
      // one candle per bar of a shown series (a hidden one stays empty)
      if (showAsk) s.series.push(s.ask);
      if (showBid) s.series.push(s.bid);
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      if (showAsk) {
        s.ask[i] = { time: b.time, open: b.close, high: b.high + spread, low: b.low + spread, close: b.close + spread,
          color: col, wickColor: col, borderColor: col };
      }
      if (showBid) {
        s.bid[i] = { time: b.time, open: b.close, high: b.high - spread, low: b.low - spread, close: b.close - spread,
          color: col, wickColor: col, borderColor: col };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { ask: s.ask.slice(), bid: s.bid.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TradePriceSpreadCompensatorOverlayInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TradePriceSpreadCompensatorOverlayInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TradePriceSpreadCompensatorOverlay = {
  calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig,
};
