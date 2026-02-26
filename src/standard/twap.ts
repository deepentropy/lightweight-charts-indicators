/**
 * Time Weighted Average Price (TWAP) Indicator
 *
 * Cumulative average of source within anchor periods.
 * Resets at each new anchor period boundary.
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface TWAPInputs {
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
  { id: 'anchor', type: 'string', title: 'Anchor Period', defval: '1D', options: ['1D', '1W', '1M'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'ohlc4' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TWAP', color: '#dd7a28', lineWidth: 1 },
];

export const metadata = {
  title: 'Time Weighted Average Price',
  shortTitle: 'TWAP',
  overlay: true,
};

function getStartOfPeriod(timestamp: number, timeframe: string): number {
  const ts = timestamp < 1e12 ? timestamp * 1000 : timestamp;
  const date = new Date(ts);
  const tf = timeframe.toUpperCase();

  if (tf === '1W' || tf === 'W') {
    const day = date.getUTCDay();
    const diff = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - diff);
    date.setUTCHours(0, 0, 0, 0);
  } else if (tf === '1M' || tf === 'M') {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }

  return timestamp < 1e12 ? Math.floor(date.getTime() / 1000) : date.getTime();
}

export function calculate(bars: Bar[], inputs: Partial<TWAPInputs> = {}): IndicatorResult {
  const { anchor, src, offset } = { ...defaultInputs, ...inputs };
  const sourceArr = getSourceSeries(bars, src).toArray();

  let sum = 0;
  let count = 0;
  let prevPeriodStart: number | null = null;
  const twapArr: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const barTime = bars[i].time;
    const periodStart = getStartOfPeriod(barTime, anchor);

    if (prevPeriodStart === null || periodStart !== prevPeriodStart) {
      sum = 0;
      count = 0;
    }

    const val = sourceArr[i];
    if (val != null && !isNaN(val)) {
      sum += val;
      count++;
    }

    twapArr.push(count > 0 ? sum / count : NaN);
    prevPeriodStart = periodStart;
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
