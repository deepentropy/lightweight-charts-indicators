/**
 * Buying Selling Volume
 *
 * Splits volume into buying and selling components based on price position
 * within the bar range. Displayed as histogram.
 *
 * Reference: TradingView "Buying Selling Volume" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BuyingSellVolumeInputs {
  length: number;
}

export const defaultInputs: BuyingSellVolumeInputs = {
  length: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 1, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buy Volume', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Sell Volume', color: '#EF5350', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Buying Selling Volume',
  shortTitle: 'BSVol',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<BuyingSellVolumeInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const buyArr: number[] = new Array(n);
  const sellArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const vol = bars[i].volume ?? 0;
    const range = bars[i].high - bars[i].low;
    if (range === 0) {
      buyArr[i] = vol / 2;
      sellArr[i] = vol / 2;
    } else {
      buyArr[i] = vol * (bars[i].close - bars[i].low) / range;
      sellArr[i] = vol * (bars[i].high - bars[i].close) / range;
    }
  }

  // Optional smoothing
  let buyFinal: number[];
  let sellFinal: number[];
  if (length > 1) {
    const buySeries = new Series(bars, (_b, i) => buyArr[i]);
    const sellSeries = new Series(bars, (_b, i) => sellArr[i]);
    buyFinal = ta.sma(buySeries, length).toArray().map(v => v ?? NaN);
    sellFinal = ta.sma(sellSeries, length).toArray().map(v => v ?? NaN);
  } else {
    buyFinal = buyArr;
    sellFinal = sellArr;
  }

  const plot0 = buyFinal.map((v, i) => ({
    time: bars[i].time,
    value: v,
    color: '#26A69A',
  }));

  const plot1 = sellFinal.map((v, i) => ({
    time: bars[i].time,
    value: -v,
    color: '#EF5350',
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const BuyingSellVolume = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
