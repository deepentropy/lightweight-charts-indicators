/**
 * Volume Weighted Average Price (VWAP)
 *
 * Cumulative volume-weighted average of the source, anchored to a period
 * (session/week/month) and reset at each new anchor boundary. Optional bands
 * use the volume-weighted standard deviation of the source from the VWAP.
 *
 *   vwap   = sum(volume * src) / sum(volume)               (within anchor)
 *   stdev  = sqrt( sum(volume*src^2)/sum(volume) - vwap^2 )
 *   bands  = vwap +/- mult * stdev
 *
 * Based on TradingView's built-in "Volume Weighted Average Price" (STD;VWAP).
 */

import { getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface VWAPInputs {
  anchor: string;
  src: SourceType;
  showBands: boolean;
  bandMult: number;
}

export const defaultInputs: VWAPInputs = {
  anchor: '1D',
  src: 'hlc3',
  showBands: false,
  bandMult: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'anchor', type: 'string', title: 'Anchor Period', defval: '1D', options: ['1D', '1W', '1M'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
  { id: 'showBands', type: 'bool', title: 'Show Bands', defval: false },
  { id: 'bandMult', type: 'float', title: 'Band Multiplier', defval: 1.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band', color: '#089981', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: '#F23645', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Weighted Average Price',
  shortTitle: 'VWAP',
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

export function calculate(bars: Bar[], inputs: Partial<VWAPInputs> = {}): IndicatorResult {
  const { anchor, src, showBands, bandMult } = { ...defaultInputs, ...inputs };
  const sourceArr = getSourceSeries(bars, src).toArray();

  let cumVol = 0;
  let cumVolPrice = 0;
  let cumVolPrice2 = 0;
  let prevPeriodStart: number | null = null;

  const vwapData: { time: number; value: number }[] = [];
  const upperData: { time: number; value: number }[] = [];
  const lowerData: { time: number; value: number }[] = [];

  for (let i = 0; i < bars.length; i++) {
    const periodStart = getStartOfPeriod(bars[i].time, anchor);
    if (prevPeriodStart === null || periodStart !== prevPeriodStart) {
      cumVol = 0;
      cumVolPrice = 0;
      cumVolPrice2 = 0;
    }

    const price = sourceArr[i];
    const vol = bars[i].volume ?? 0;
    if (price != null && !isNaN(price)) {
      cumVol += vol;
      cumVolPrice += vol * price;
      cumVolPrice2 += vol * price * price;
    }

    const vwap = cumVol > 0 ? cumVolPrice / cumVol : NaN;
    vwapData.push({ time: bars[i].time, value: vwap });

    if (showBands && cumVol > 0) {
      const variance = Math.max(cumVolPrice2 / cumVol - vwap * vwap, 0);
      const sd = Math.sqrt(variance);
      upperData.push({ time: bars[i].time, value: vwap + bandMult * sd });
      lowerData.push({ time: bars[i].time, value: vwap - bandMult * sd });
    } else {
      upperData.push({ time: bars[i].time, value: NaN });
      lowerData.push({ time: bars[i].time, value: NaN });
    }

    prevPeriodStart = periodStart;
  }

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': vwapData,
      'plot1': upperData,
      'plot2': lowerData,
    },
  };
}

export const VWAP = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
