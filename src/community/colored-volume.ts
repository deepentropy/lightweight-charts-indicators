/**
 * Colored Volume Bars
 *
 * Colors volume bars based on price/volume trend comparison:
 * - Green: price up + volume up
 * - Blue: price up + volume down
 * - Orange: price down + volume down
 * - Red: price down + volume up
 *
 * Reference: TradingView "Colored Volume Bars" by LazyBear
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ColoredVolumeInputs {
  lookback: number;
  showMA: boolean;
  lengthMA: number;
}

export const defaultInputs: ColoredVolumeInputs = {
  lookback: 10,
  showMA: false,
  lengthMA: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 10, min: 1 },
  { id: 'showMA', type: 'bool', title: 'Show MA', defval: false },
  { id: 'lengthMA', type: 'int', title: 'MA Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: '#787B86', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Volume MA', color: '#800000', lineWidth: 2 },
];

export const metadata = {
  title: 'Colored Volume Bars',
  shortTitle: 'CVolBars',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ColoredVolumeInputs> = {}): IndicatorResult {
  const { lookback, showMA, lengthMA } = { ...defaultInputs, ...inputs };

  const data = bars.map((bar, i) => {
    const vol = bar.volume ?? 0;
    if (i < lookback) return { time: bar.time, value: NaN };
    const prevVol = bars[i - 1]?.volume ?? 0;
    const priceUp = bar.close >= bar.open;
    const volUp = vol >= prevVol;
    let color: string;
    if (priceUp && volUp) color = '#00FF00';      // green
    else if (priceUp && !volUp) color = '#0000FF'; // blue
    else if (!priceUp && !volUp) color = '#FFA500'; // orange
    else color = '#FF0000';                         // red
    return { time: bar.time, value: vol, color };
  });

  // Optional SMA of volume
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const smaArr = ta.sma(volSeries, lengthMA).toArray();
  const maData = smaArr.map((v, i) => ({
    time: bars[i].time,
    value: showMA ? (v ?? NaN) : NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': data, 'plot1': maData },
  };
}

export const ColoredVolume = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
