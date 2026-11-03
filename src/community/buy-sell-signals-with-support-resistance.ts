/**
 * buy/sell signals with Support/Resistance (InvestYourAsset)
 *
 * Two simple moving averages of the close (short and long) and their difference as a histogram ("MACD Oscillator").
 * A crossover of the short average above the long one is a long signal (triangle below the bar); a crossunder is a
 * short signal (triangle above the bar). Pivot highs and lows (`lookback` bars on each side) are plotted on the bar
 * where they are confirmed, as diamonds. The daily close of the "Ticker Symbol" input is plotted as "Close Price".
 *
 * The original keeps the close only when the bar opens between 00:00 and 23:59 of its own day in the exchange time
 * zone: every bar opens inside its own day, so this filtered close is the close of every bar.
 *
 * Other symbol: `request.security(symbol, "D", close)` takes the daily bars of the "Ticker Symbol" input from the
 * chart context (`requiredSymbols`); without them the port throws a MissingSymbolDataError.
 *
 * Reference: "buy/sell signals with Support/Resistance (InvestYourAsset)" by InvestyourAsset
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, callsite, Series,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ShapeConfig,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import { symbolBarsOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { otherSymbolChart, securityOtherValues } from '../other-symbol';

export interface BuySellSignalsWithSupportResistanceInputs {
  /** Short MA Period */
  ma1: number;
  /** Long MA Period */
  ma2: number;
  /** Ticker Symbol */
  symbol: string;
  /** Lookback Period for S&R */
  lookback: number;
}

export const defaultInputs: BuySellSignalsWithSupportResistanceInputs = {
  ma1: 12,
  ma2: 26,
  symbol: 'NA',
  lookback: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'ma1', type: 'int', title: 'Short MA Period', defval: 12 },
  { id: 'ma2', type: 'int', title: 'Long MA Period', defval: 26 },
  { id: 'symbol', type: 'string', title: 'Ticker Symbol', defval: 'NA' },
  { id: 'lookback', type: 'int', title: 'Lookback Period for S&R', defval: 20 },
];

// v5 colours: blue #2962FF, green #4CAF50, red #FF5252, orange #FF9800, purple #9C27B0, gray #787B86
const BLUE = '#2962FF';
const GREEN = '#4CAF50';
const RED = '#FF5252';
const ORANGE = '#FF9800';
const PURPLE = '#9C27B0';
const GRAY = '#787B86';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close Price', color: BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'MACD Oscillator', color: RED, lineWidth: 1, style: 'histogram' },
  { id: 'plot2', title: 'Short MA', color: ORANGE, lineWidth: 1 },
  { id: 'plot3', title: 'Long MA', color: PURPLE, lineWidth: 1 },
  { id: 'plot4', title: 'Swing High', color: RED, lineWidth: 2, style: 'stepline_diamond' },
  { id: 'plot5', title: 'Swing Low', color: GREEN, lineWidth: 2, style: 'stepline_diamond' },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Long Signal', style: 'triangleup', location: 'belowbar', color: GREEN, size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'Short Signal', style: 'triangledown', location: 'abovebar', color: RED, size: 'small' },
];

export const metadata = {
  title: 'buy/sell signals with Support/Resistance (InvestYourAsset)',
  shortTitle: 'buy/sell signals with Support/Resistance (InvestYourAsset)',
  overlay: true,
};

/** Bars the indicator needs: the daily bars of the "Ticker Symbol" input. */
export function requiredSymbols(inputs: Partial<BuySellSignalsWithSupportResistanceInputs> = {}): SymbolRequest[] {
  return [{ symbol: { ...defaultInputs, ...inputs }.symbol, timeframe: 'D' }];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BuySellSignalsWithSupportResistanceInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // data = request.security(symbol, "D", close)
  const [daily] = symbolBarsOf(requiredSymbols(cfg), chart);
  const data = securityOtherValues(bars, daily, 'D', daily.map((b) => b.close), otherSymbolChart(bars, chart),
    { other: chart?.symbolInfo?.(cfg.symbol) });

  // filteredClose: the close of every bar (see the header)
  const close = new Series(bars, (b) => b.close);
  const shortMa = A(ta.sma(close, cfg.ma1));
  const longMa = A(ta.sma(close, cfg.ma2));
  const swingHigh = A(ta.pivothigh(new Series(bars, (b) => b.high), cfg.lookback, cfg.lookback));
  const swingLow = A(ta.pivotlow(new Series(bars, (b) => b.low), cfg.lookback, cfg.lookback));

  // signals = positions ? 1 : ta.crossunder(short_ma, long_ma) ? -1 : 0
  // ta.crossunder runs only on the bars where the crossover is false (ternary branch)
  const over = callsite.crossover();
  const under = callsite.crossunder();
  const markers: MarkerData[] = [];
  const val = (v: number) => (Number.isFinite(v) ? v : NaN);
  const plot0 = [], plot1 = [], plot2 = [], plot3 = [], plot4 = [], plot5 = [];
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const positions = over(shortMa[i], longMa[i]);
    const signals = positions ? 1 : under(shortMa[i], longMa[i]) ? -1 : 0;
    if (signals === 1) {
      markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: GREEN, size: 'small', id: 'shape0' });
    } else if (signals === -1) {
      markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: RED, size: 'small', id: 'shape1' });
    }
    plot0.push({ time: t, value: val(data[i]) });
    plot1.push({ time: t, value: val(shortMa[i] - longMa[i]) });
    plot2.push({ time: t, value: val(shortMa[i]) });
    plot3.push({ time: t, value: val(longMa[i]) });
    plot4.push({ time: t, value: val(swingHigh[i]) });
    plot5.push({ time: t, value: val(swingLow[i]) });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1, plot2, plot3, plot4, plot5 },
    hlines: [{ value: 0, options: { title: 'Zero Line', color: GRAY, linestyle: 'dashed', linewidth: 1 } }],
    markers,
  };
}

export const BuySellSignalsWithSupportResistance = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, shapeConfig, requiredSymbols,
};
