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

  // Pine: p2=close, v2=volume, p1=p2[lookback], v1=v2[lookback]
  // Green: p2>p1 and v2>v1 (price up + volume up vs N bars ago)
  // Blue: p2>p1 and v2<v1 (price up + volume down — note: Pine swaps blue/orange vs typical)
  // Orange: p2<p1 and v2<v1 (price down + volume down)
  // Red: p2<p1 and v2>v1 (price down + volume up)
  const data = bars.map((bar, i) => {
    const vol = bar.volume ?? 0;
    if (i < lookback) return { time: bar.time, value: vol, color: '#808080' };
    const prevClose = bars[i - lookback].close;
    const prevVol = bars[i - lookback].volume ?? 0;
    const priceUp = bar.close > prevClose;
    const volUp = vol > prevVol;
    let color: string;
    if (priceUp && volUp) color = '#00FF00';        // green
    else if (!priceUp && volUp) color = '#FF0000';   // red
    else if (priceUp && !volUp) color = '#0000FF';   // blue
    else if (!priceUp && !volUp) color = '#FFA500';  // orange
    else color = '#808080';                           // gray
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
