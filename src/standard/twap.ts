/**
 * Time Weighted Average Price (TWAP) Indicator
 *
 * Cumulative average of source within anchor periods.
 * Resets at each new anchor period boundary (timeframe.change(anchor)).
 *
 * 'Anchor Period' accepts any timeframe ("" = the chart timeframe: every bar is its own period). The original takes
 * the periods from the exchange time zone and sessions, which the bars do not carry: the port takes them from the
 * UTC calendar and the bars (see src/anchor-period.ts). Exact on UTC 24x7 symbols and on symbols whose trading day
 * is inside the UTC day (e.g. US stocks), after the first period of the bars; not on sessions that cross 00:00 UTC.
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import { periodStarts } from '../anchor-period';

export interface TWAPInputs {
  /** Anchor period: any timeframe string ("1D", "1W", "240", ...; "" = chart timeframe) */
  anchor: string;
  src: SourceType;
  offset: number;
}

export const defaultInputs: TWAPInputs = {
  anchor: '1D',
  src: 'ohlc4',
  offset: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'anchor', type: 'timeframe', title: 'Anchor Period', defval: '1D' },
  { id: 'src', type: 'source', title: 'Source', defval: 'ohlc4' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TWAP', color: '#dd7a28', lineWidth: 1 },
];

export const metadata = {
  title: 'Time Weighted Average Price',
  shortTitle: 'TWAP',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TWAPInputs> = {}): IndicatorResult {
  const { anchor, src, offset } = { ...defaultInputs, ...inputs };
  const sourceArr = getSourceSeries(bars, src).toArray();

  let sum = 0;
  let count = 0;
  const starts = periodStarts(bars, anchor);
  const twapArr: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    // timeframe.change(anchor)
    if (i > 0 && starts[i] !== starts[i - 1]) {
      sum = 0;
      count = 0;
    }

    const val = sourceArr[i];
    if (val != null && !isNaN(val)) {
      sum += val;
      count++;
    }

    twapArr.push(count > 0 ? sum / count : NaN);
  }

  const plotData = bars.map((bar, i) => {
    const srcIdx = i - offset;
    return { time: bar.time, value: (srcIdx >= 0 && srcIdx < bars.length) ? twapArr[srcIdx] : NaN };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const TWAP = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
