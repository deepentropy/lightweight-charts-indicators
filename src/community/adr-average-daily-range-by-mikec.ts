/**
 * ADR% - Average Daily Range %
 *
 * Average daily range in percent: 100 * (sma(dailyHigh / dailyLow, length) - 1), where the daily high and low come
 * from the daily bars of the chart symbol (security(tickerid, 'D', ...) without lookahead: an intraday bar shows the
 * high and low of the latest completed day, and the sma runs on the chart bars). On a daily chart the daily bars are
 * the chart bars. The daily periods follow the exchange calendar of the chart context (time zone and session, see
 * src/anchor-period.ts); without it the UTC calendar of the bars. A chart timeframe above one day is not ported (the
 * bars do not carry the lower-timeframe data): the port throws an Error.
 *
 * Reference: "ADR% - Average Daily Range % by MikeC (AKA TheScrutiniser)" by TheScrutiniser
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Original: alpine_trader. Amended 08/12/20 by TheScrutiniser, MikeC on advise from GlinckEastwoot
 */

import { ta, Series, timeframe, mapToChart, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';

export interface AdrAverageDailyRangeByMikecInputs {
  /** sma length */
  length: number;
}

export const defaultInputs: AdrAverageDailyRangeByMikecInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 20 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADR', color: '#FF9800', lineWidth: 1 },
];

export const metadata = {
  title: 'ADR% - Average Daily Range %',
  shortTitle: 'ADR% - Average Daily Range %',
  overlay: false,
};

/** security(tickerid, 'D', high / low): the daily high and low seen by each chart bar (lookahead off, no gaps). */
function dailyHighLow(bars: Bar[], chart?: ChartContext): { high: number[]; low: number[] } {
  const chartTf = chartTimeframe(bars, chart);
  if (chartTf === '' || timeframe.in_seconds(chartTf) === timeframe.in_seconds('D')) {
    return { high: bars.map((b) => b.high), low: bars.map((b) => b.low) };
  }
  if (timeframe.in_seconds(chartTf) > timeframe.in_seconds('D')) {
    throw new Error(`The chart timeframe "${chartTf}" is above one day: the daily bars are not in the chart bars.`);
  }
  const { htf, group, latest } = higherTimeframeBars(bars, 'D', chart);
  return {
    high: mapToChart(htf.map((b) => b.high), group, latest, false, false),
    low: mapToChart(htf.map((b) => b.low), group, latest, false, false),
  };
}

export function calculate(bars: Bar[], inputs: Partial<AdrAverageDailyRangeByMikecInputs> = {}, chart?: ChartContext): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const { high, low } = dailyHighLow(bars, chart);
  const ratio = Series.fromArray(bars, high.map((h, i) => h / low[i]));
  const avg = ta.sma(ratio, length).toArray();
  const plot0 = bars.map((b, i) => {
    const adr = 100 * ((avg[i] ?? NaN) - 1);
    return { time: b.time, value: Number.isFinite(adr) ? adr : NaN };
  });
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const AdrAverageDailyRangeByMikec = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
