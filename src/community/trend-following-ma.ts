/**
 * Trend Following Moving Averages
 *
 * Overlay indicator (overlay=true) with 20 moving average plots at lengths
 * 5, 10, 15, ..., 100. Each MA is conditionally colored with a gradient
 * based on trend strength (green for bullish, red for bearish, transparent for neutral).
 *
 * Trend detection uses a channel rate applied to a period of MA highs/lows,
 * optionally smoothed with linear regression.
 *
 * Reference: TradingView "Trend Following Moving Averages" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TrendFollowingMAInputs {
  maType: string;
  period: number;
  channelRate: number;
  useLinReg: boolean;
  linRegPeriod: number;
}

export const defaultInputs: TrendFollowingMAInputs = {
  maType: 'EMA',
  period: 20,
  channelRate: 1,
  useLinReg: true,
  linRegPeriod: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'RMA', 'WMA', 'VWMA'] },
  { id: 'period', type: 'int', title: 'Period to Check Trend', defval: 20, min: 5 },
  { id: 'channelRate', type: 'float', title: 'Trend Channel Rate %', defval: 1, min: 0.1, step: 0.1 },
  { id: 'useLinReg', type: 'bool', title: 'Use Linear Regression', defval: true },
  { id: 'linRegPeriod', type: 'int', title: 'Linear Regression Period', defval: 10, min: 2 },
];

const maLengths = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];

export const plotConfig: PlotConfig[] = maLengths.map((len, idx) => ({
  id: `ma${len}`,
  title: `MA ${len}`,
  color: '#888888',
  lineWidth: 1,
}));

export const metadata = {
  title: 'Trend Following Moving Averages',
  shortTitle: 'TFMA',
  overlay: true,
};

function getColor(trend: number): string | undefined {
  if (trend >= 10.0) return '#00FF00ff';
  if (trend >= 9.0) return '#00FF00ef';
  if (trend >= 8.0) return '#00FF00df';
  if (trend >= 7.0) return '#00FF00cf';
  if (trend >= 6.0) return '#00FF00bf';
  if (trend >= 5.0) return '#00FF00af';
  if (trend >= 4.0) return '#00FF009f';
  if (trend >= 3.0) return '#00FF008f';
  if (trend >= 2.0) return '#00FF007f';
  if (trend >= 1.0) return '#00FF006f';
  if (trend <= -10.0) return '#FF0000ff';
  if (trend <= -9.0) return '#FF0000ef';
  if (trend <= -8.0) return '#FF0000df';
  if (trend <= -7.0) return '#FF0000cf';
  if (trend <= -6.0) return '#FF0000bf';
  if (trend <= -5.0) return '#FF0000af';
  if (trend <= -4.0) return '#FF00009f';
  if (trend <= -3.0) return '#FF00008f';
  if (trend <= -2.0) return '#FF00007f';
  if (trend <= -1.0) return '#FF00006f';
  return undefined; // na - transparent/hidden
}

export function calculate(bars: Bar[], inputs: Partial<TrendFollowingMAInputs> = {}): IndicatorResult {
  const { maType, period: prd, channelRate, useLinReg, linRegPeriod: linprd } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const rate = channelRate / 100;

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const volumeSeries = new Series(bars, (b) => b.volume ?? 0);

  // Pine: highest(280) defaults to high series, lowest(280) defaults to low series
  const highest280 = ta.highest(highSeries, 280).toArray();
  const lowest280 = ta.lowest(lowSeries, 280).toArray();

  function computeMA(len: number): Series {
    switch (maType) {
      case 'EMA': return ta.ema(closeSeries, len);
      case 'RMA': return ta.rma(closeSeries, len);
      case 'WMA': return ta.wma(closeSeries, len);
      case 'VWMA': return ta.vwma(closeSeries, len, volumeSeries);
      default: return ta.sma(closeSeries, len);
    }
  }

  function getTrend(len: number): number[] {
    const masrc = computeMA(len);
    const ma = useLinReg ? ta.linreg(masrc, linprd, 0) : masrc;
    const maArr = ma.toArray();

    const hhMA = ta.highest(ma, prd).toArray();
    const llMA = ta.lowest(ma, prd).toArray();

    const trendArr: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const pricerange = (highest280[i] ?? 0) - (lowest280[i] ?? 0);
      const chan = pricerange * rate;
      const hh = hhMA[i] ?? 0;
      const ll = llMA[i] ?? 0;
      const diff = Math.abs(hh - ll);
      const maVal = maArr[i] ?? 0;

      let trend = 0;
      if (diff > chan) {
        if (maVal > ll + chan) trend = 1;
        else if (maVal < hh - chan) trend = -1;
      }
      trendArr[i] = chan !== 0 ? trend * diff / chan : 0;
    }
    return trendArr;
  }

  const plots: Record<string, { time: number; value: number; color?: string }[]> = {};

  for (const len of maLengths) {
    const maArr = computeMA(len).toArray();
    const trendArr = getTrend(len);
    const warmup = Math.max(len, prd, 280);

    plots[`ma${len}`] = bars.map((b, i) => {
      if (i < warmup || maArr[i] == null || isNaN(maArr[i]!)) {
        return { time: b.time, value: NaN };
      }
      const color = getColor(trendArr[i]);
      if (color === undefined) {
        // na color means don't plot this bar (transparent)
        return { time: b.time, value: NaN };
      }
      return { time: b.time, value: maArr[i]!, color };
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const TrendFollowingMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
