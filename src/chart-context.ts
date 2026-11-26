/**
 * What the caller knows about the chart and its symbol, for the indicators whose output depends on it: the optional
 * third argument of `calculate(bars, inputs, chart)`.
 *
 * It is the oakscriptjs ChartContext (chart timeframe, exchange time zone, session, symbol tick, ticker id, symbol
 * type, currency, base currency and root, chart colours, current time, state of the last bar, and the bars and
 * properties of other symbols) with the visible range of the chart. Every value is optional. Without a value the
 * indicator uses the fallback given below, which is what it did before this argument existed.
 *
 * Other symbols (PineScript `request.security` of another ticker): `bars(symbol, timeframe)` gives the bars the caller
 * has loaded for `symbol` ("NASDAQ:MSFT", "CRYPTOCAP:BTC") on `timeframe` (the timeframe the indicator asks for, the
 * chart timeframe when the script uses `timeframe.period`), in the time unit of the chart bars, or `undefined` when it
 * has not loaded them yet: the indicator then throws a `MissingSymbolDataError` that lists what it needs; load those
 * bars and calculate again. `symbolInfo(symbol)` gives the exchange time zone and session of another symbol (when its
 * bars close and which trading day they belong to) and its other properties. An indicator that reads other symbols has
 * `requiredSymbols` in its registry entry.
 */

import type { Bar } from 'oakscriptjs';
import {
  MissingSymbolDataError, type ChartContext as ScriptChartContext, type SymbolDataRequest, type SymbolInfo,
} from 'oakscriptjs/script';

export { MissingSymbolDataError };
export type { SymbolInfo };

export interface ChartContext extends ScriptChartContext {
  /**
   * Time of the first bar visible on the chart, in ms (PineScript `chart.left_visible_bar_time`); fallback: the
   * first bar given to the indicator
   */
  leftVisibleBarTime?: number;
  /**
   * Time of the last bar visible on the chart, in ms (PineScript `chart.right_visible_bar_time`); fallback: the
   * last bar given to the indicator. An indicator that reads the visible range (`usesVisibleRange` in its registry
   * entry) must be calculated again when the user scrolls or zooms the chart.
   */
  rightVisibleBarTime?: number;
}

/** Bars of another symbol that an indicator needs: `{ symbol, timeframe }` ("NASDAQ:MSFT", "1D") */
export type SymbolRequest = SymbolDataRequest;

/**
 * Bars of other symbols from the chart context, all at once: throws one `MissingSymbolDataError` (the library error,
 * as `executeScript` throws it) that lists every request the context cannot give, so that the caller loads them
 * together.
 */
export function symbolBarsOf(requests: SymbolRequest[], chart?: ChartContext): Bar[][] {
  const out = requests.map((r) => chart?.bars?.(r.symbol, r.timeframe));
  const missing = requests.filter((_, i) => out[i] === undefined);
  if (missing.length) throw new MissingSymbolDataError(missing);
  return out as Bar[][];
}

/** Symbol tick (PineScript `syminfo.mintick`); fallback 0.01 */
export function mintickOf(chart?: ChartContext): number {
  if (chart?.mintick !== undefined) return chart.mintick;
  if (chart?.minmove !== undefined && chart.pricescale !== undefined) return chart.minmove / chart.pricescale;
  return 0.01;
}

/**
 * Session hours of the symbol (the hours of `chart.session`, a string or the `session` of a session object), e.g.
 * "0930-1600"; fallback: an empty string
 */
export function sessionHoursOf(chart?: ChartContext): string {
  return (typeof chart?.session === 'string' ? chart.session : chart?.session?.session) ?? '';
}

/** Exchange time zone (PineScript `syminfo.timezone`); fallback UTC */
export function timezoneOf(chart?: ChartContext): string {
  return chart?.timezone ?? 'Etc/UTC';
}

/** PineScript `syminfo.tickerid` ("NASDAQ:AAPL"); fallback: an empty string */
export function tickeridOf(chart?: ChartContext): string {
  return chart?.tickerid ?? '';
}

/** PineScript `syminfo.ticker` ("AAPL"): the ticker id without its exchange prefix; fallback: an empty string */
export function tickerOf(chart?: ChartContext): string {
  const id = tickeridOf(chart);
  return id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
}

/** PineScript `syminfo.type`; fallback: an empty string (no type-specific rule applies) */
export function symbolTypeOf(chart?: ChartContext): string {
  return chart?.symbolType ?? '';
}

/** PineScript `syminfo.currency`; fallback "USD" */
export function currencyOf(chart?: ChartContext): string {
  return chart?.currency ?? 'USD';
}

/**
 * PineScript `syminfo.basecurrency` ("BTC" for BTCUSDT.P, '' for a stock): `chart.basecurrency`. Fallback for a
 * context without it: the ticker of a crypto or forex pair (`chart.symbolType`) without ".P" and without its quote
 * currency (`chart.currency`), else ''
 */
export function basecurrencyOf(chart?: ChartContext): string {
  if (chart?.basecurrency !== undefined) return chart.basecurrency ?? '';
  const type = symbolTypeOf(chart);
  if (type !== 'crypto' && type !== 'forex') return '';
  const pair = tickerOf(chart).replace(/\.P$/, '');
  const quote = currencyOf(chart);
  return pair.length > quote.length && pair.endsWith(quote) ? pair.slice(0, -quote.length) : '';
}

/**
 * PineScript `syminfo.root` ("ES" for ES1!, "AAPL" for AAPL): `chart.root`. Fallback for a context without it: the
 * ticker, without its contract suffix for futures ("ES1!" -> "ES", "ESH2025" -> "ES")
 */
export function rootOf(chart?: ChartContext): string {
  if (chart?.root !== undefined) return chart.root ?? '';
  const ticker = tickerOf(chart);
  if (symbolTypeOf(chart) !== 'futures') return ticker;
  return ticker.replace(/\d+!$/, '').replace(/[FGHJKMNQUVXZ]\d{4}$/, '');
}

/** PineScript `chart.fg_color`; fallback #DBDBDB */
export function foregroundColorOf(chart?: ChartContext): string {
  return chart?.foregroundColor ?? '#DBDBDB';
}

/** PineScript `chart.bg_color`; fallback #0F0F0F */
export function backgroundColorOf(chart?: ChartContext): string {
  return chart?.backgroundColor ?? '#0F0F0F';
}

/**
 * True when the last bar is closed (PineScript `barstate.isconfirmed` on the last bar). Fallback true: without a
 * context every bar given to an indicator is taken as closed.
 */
export function lastBarConfirmedOf(chart?: ChartContext): boolean {
  return chart?.lastBarConfirmed ?? true;
}

/** PineScript `timenow` (ms); fallback: the clock of the computer */
export function nowOf(chart?: ChartContext): number {
  return chart?.now ?? Date.now();
}

/** The bars visible on the chart: indexes in `bars` and times in ms. */
export interface VisibleRange {
  /** Index of the first visible bar */
  left: number;
  /** Index of the last visible bar */
  right: number;
  /** PineScript `chart.left_visible_bar_time` (ms) */
  leftTime: number;
  /** PineScript `chart.right_visible_bar_time` (ms) */
  rightTime: number;
}

/**
 * Visible range of the chart (PineScript `chart.left_visible_bar_time` / `chart.right_visible_bar_time`); fallback:
 * all the bars. The times of the context are in ms; `Bar.time` is in seconds unless `chart.timeUnit` is 'ms'. A
 * visible time between two bars is taken as the next bar on the left side and the previous bar on the right side.
 */
export function visibleRangeOf(bars: ReadonlyArray<{ time: number }>, chart?: ChartContext): VisibleRange {
  const toMs = chart?.timeUnit === 'ms' ? 1 : 1000;
  const last = bars.length - 1;
  if (last < 0) return { left: 0, right: -1, leftTime: NaN, rightTime: NaN };
  const leftTime = chart?.leftVisibleBarTime ?? bars[0].time * toMs;
  const rightTime = chart?.rightVisibleBarTime ?? bars[last].time * toMs;
  let left = 0;
  while (left < last && bars[left].time * toMs < leftTime) left++;
  let right = last;
  while (right > 0 && bars[right].time * toMs > rightTime) right--;
  return { left, right, leftTime, rightTime };
}
