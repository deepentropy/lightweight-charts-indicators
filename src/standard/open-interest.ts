/**
 * Open Interest
 *
 * The open interest of the chart symbol, in its own pane: the series of the symbol `<SYMBOL>_OI` (PineScript
 * `request.security(syminfo.tickerid + "_OI", timeframe.period, …)`), whose bars the host gives through the chart
 * context (`requiredSymbols`). Teal when the open interest rose from its previous bar, red when it fell or held.
 *
 * Based on the standard Open Interest indicator: no inputs, values in the volume format (5.37 K, 47.46 M).
 * - A series with open, high, low and close values (open interest sampled through each bar) is drawn as candles.
 * - A series with one value per bar (open, high, low and close equal, or no open) is drawn as a thick step line.
 * - A series without intraday bars (sources that publish one open interest a day, as futures exchanges do) is read
 *   on the daily timeframe on an intraday chart: each intraday bar shows the day's value.
 * - No bars at all (a symbol without open interest, a stock): an error.
 */

import { timeframe, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import { chartTimeframe } from '../anchor-period';
import { symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { otherSymbolChart, securityOther } from '../other-symbol';

export interface OpenInterestInputs {}

export const defaultInputs: OpenInterestInputs = {};

export const inputConfig: InputConfig[] = [];

const RISING = '#089981';
const FALLING = '#F23645';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Open Interest', color: '#2962FF', lineWidth: 4, style: 'stepline', palette: [RISING, FALLING] },
];

export const plotCandleConfig = [
  { id: 'oi', title: 'Open Interest' },
];

export const metadata = {
  title: 'Open Interest',
  shortTitle: 'OI',
  overlay: false,
  format: 'volume',
};

/** The open interest series of the chart symbol: "NFO:NIFTY26NOVFUT" → "NFO:NIFTY26NOVFUT_OI"; '' without a symbol */
export function openInterestSymbol(chart?: ChartContext): string {
  const id = tickeridOf(chart);
  return id ? `${id}_OI` : '';
}

/** Bars the indicator reads: the open interest series on the chart timeframe (the daily one follows when it has none) */
export function requiredSymbols(_inputs: Partial<OpenInterestInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const symbol = openInterestSymbol(chart);
  return symbol ? [{ symbol, timeframe: chartTimeframe([], chart) }] : [];
}

/** One value per bar: every bar flat (or without an open), as a source that publishes a single number gives it */
function singleValued(bars: ReadonlyArray<Bar>): boolean {
  return bars.every((b) => !b.open || (b.open === b.high && b.high === b.low && b.low === b.close));
}

type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };

export function calculate(bars: Bar[], _inputs: Partial<OpenInterestInputs> = {}, chart?: ChartContext): Result {
  const meta = { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay };
  const symbol = openInterestSymbol(chart);
  if (bars.length === 0) return { metadata: meta, plots: { plot0: [] }, plotCandles: { oi: [] } };
  if (!symbol) throw new Error('Open Interest: the chart symbol is not known.');

  const chartTf = chartTimeframe(bars, chart);
  let tf = chartTf;
  let oi = symbolBarsOf([{ symbol, timeframe: tf }], chart)[0];
  const info = chartTf ? timeframe.info(chartTf) : null;
  if (oi.length === 0 && info && (info.isminutes || info.isseconds)) {
    tf = '1D';
    oi = symbolBarsOf([{ symbol, timeframe: tf }], chart)[0];
  }
  if (oi.length === 0) throw new Error(`No open interest data for ${symbol}.`);

  // [open, high, low, close, close > close[1]] of the series, on each chart bar
  const index = securityOther(bars, oi, tf === chartTf ? '' : tf, otherSymbolChart(bars, chart), { other: chart?.symbolInfo?.(symbol) });
  const rising = (j: number) => j > 0 && oi[j].close > oi[j - 1].close;
  const line = singleValued(oi);
  const plot0 = bars.map((b, i) => {
    const j = index[i];
    return { time: b.time, value: line && j >= 0 ? oi[j].close : NaN, color: rising(j) ? RISING : FALLING };
  });
  const candles: PlotCandleData[] = [];
  if (!line) {
    bars.forEach((b, i) => {
      const j = index[i];
      if (j < 0) return;
      const color = rising(j) ? RISING : FALLING;
      candles.push({ time: b.time, open: oi[j].open, high: oi[j].high, low: oi[j].low, close: oi[j].close, color, borderColor: color, wickColor: color });
    });
  }
  return { metadata: meta, plots: { plot0 }, plotCandles: { oi: candles } };
}

export const OpenInterest = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, requiredSymbols };
