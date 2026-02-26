/**
 * Volume Based Coloured Bars
 *
 * Volume bars colored by price direction with brightness based on
 * whether volume exceeds its moving average.
 *
 * Reference: TradingView "Volume Based Coloured Bars" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeColoredBarsInputs {
  length: number;
}

export const defaultInputs: VolumeColoredBarsInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'MA Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: '#787B86', lineWidth: 4, style: 'columns' },
];

export const metadata = {
  title: 'Volume Colored Bars',
  shortTitle: 'VCBars',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeColoredBarsInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const avgVol = ta.sma(volSeries, length).toArray();

  const plot0 = bars.map((bar, i) => {
    const vol = bar.volume ?? 0;
    const avg = avgVol[i] ?? 0;
    const isUp = bar.close > bar.open;
    const isAboveAvg = vol > avg;

    let color: string;
    if (isUp && isAboveAvg) color = '#26A69A';        // bright green
    else if (isUp && !isAboveAvg) color = '#80CBC4';   // dim green
    else if (!isUp && isAboveAvg) color = '#EF5350';   // bright red
    else color = '#EF9A9A';                             // dim red

    return { time: bar.time, value: vol, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const VolumeColoredBars = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
