/**
 * Bull Market Support Band
 *
 * The 20-week SMA and the 21-week EMA of the close, with a fill between them. The original runs on weekly bars
 * (`indicator(timeframe = 'W', timeframe_gaps = true)`): the values are computed on the weekly bars built from the
 * chart bars and shown on the chart bar that completes each week (na on the other bars; the lines join the points).
 * On a weekly chart the chart bars are used; a chart timeframe above one week throws (no weekly data).
 * The weeks follow the exchange calendar of the chart context (time zone and session), else the UTC rule of
 * anchor-period.ts. The Timeframe / "Wait for timeframe closes" settings that the host adds for such a script are
 * not ported.
 *
 * Reference: "Bull Market Support Band (20w SMA, 21w EMA)" by zkdev
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © zkdev
 */

import {
  ta, Series, timeframe, mapToChart,
  type Bar, type FillConfig, type FillData, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';

export interface BullMarketSupportBandInputs {}

export const defaultInputs: BullMarketSupportBandInputs = {};

export const inputConfig: InputConfig[] = [];

const SMA_COLOR = '#FF5252';
const EMA_COLOR = '#4CAF50';
const FILL_COLOR = 'rgba(255, 152, 0, 0.25)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '20w SMA', color: SMA_COLOR, lineWidth: 1 },
  { id: 'plot1', title: '21w EMA', color: EMA_COLOR, lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Plots Background', palette: [FILL_COLOR] },
];

export const metadata = {
  title: 'Bull Market Support Band',
  shortTitle: 'Bull Market Support Band',
  overlay: true,
};

/** Script timeframe of the original's indicator() */
const TF = 'W';

export function calculate(
  bars: Bar[],
  _inputs: Partial<BullMarketSupportBandInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const n = bars.length;
  const smaLength = 20;
  const emaLength = 21;
  const chartTf = chartTimeframe(bars, chart);

  let sma: number[] = [];
  let ema: number[] = [];
  if (n > 0) {
    if (chartTf === '' || timeframe.in_seconds(TF) === timeframe.in_seconds(chartTf)) {
      // a weekly chart: the script runs on the chart bars
      const close = Series.fromArray(bars, bars.map((b) => b.close));
      sma = ta.sma(close, smaLength).toArray().map((v) => v ?? NaN);
      ema = ta.ema(close, emaLength).toArray().map((v) => v ?? NaN);
    } else if (timeframe.in_seconds(TF) < timeframe.in_seconds(chartTf)) {
      throw new Error(`Bull Market Support Band: the chart timeframe "${chartTf}" is above the script timeframe "W"`);
    } else {
      // the weekly bars built from the chart bars; each value on the chart bar that completes its week (gaps on)
      const { htf, group, latest } = higherTimeframeBars(bars, TF, chart);
      const close = Series.fromArray(htf, htf.map((b) => b.close));
      // request.security(syminfo.tickerid, timeframe.period, x) on the script timeframe is x itself
      const smaW = ta.sma(close, smaLength).toArray().map((v) => v ?? NaN);
      const emaW = ta.ema(close, emaLength).toArray().map((v) => v ?? NaN);
      sma = mapToChart(smaW, group, latest, false, true);
      ema = mapToChart(emaW, group, latest, false, true);
    }
  }

  const points = (values: number[], col: string) => values.map((value, i) => ({ time: bars[i].time, value, color: col }));
  const fills: FillData[] = [
    {
      id: 'fill0', plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background', color: FILL_COLOR, fillgaps: true },
    },
  ];
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: points(sma, SMA_COLOR), plot1: points(ema, EMA_COLOR) },
    fills,
  };
}

export const BullMarketSupportBand = { calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig };
