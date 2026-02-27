/**
 * Volume Based Coloured Bars
 *
 * Volume bars colored by price direction with brightness based on
 * whether volume exceeds its moving average.
 *
 * Reference: TradingView "Volume Based Coloured Bars" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<VolumeColoredBarsInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
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

  // barcolor: 6-level coloring based on volume vs average and price direction
  // Pine: vold1=vol>avg*1.5 & down -> #800000 (dark red/maroon)
  //        vold2=vol 0.5-1.5x & down -> #FF0000 (red)
  //        vold3=vol<avg*0.5 & down -> orange
  //        volu1=vol>avg*1.5 & up -> #006400 (dark green)
  //        volu2=vol 0.5-1.5x & up -> lime (#00FF00)
  //        volu3=vol<avg*0.5 & up -> #7FFFD4 (aquamarine)
  const barColors: BarColorData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const vol = bars[i].volume ?? 0;
    const avg = avgVol[i] ?? 0;
    const isUp = bars[i].close > bars[i].open;
    let color: string;
    if (!isUp && vol > avg * 1.5) color = '#800000';
    else if (!isUp && vol >= avg * 0.5 && vol <= avg * 1.5) color = '#FF0000';
    else if (!isUp && vol < avg * 0.5) color = '#FF9800';
    else if (isUp && vol > avg * 1.5) color = '#006400';
    else if (isUp && vol >= avg * 0.5 && vol <= avg * 1.5) color = '#00FF00';
    else if (isUp && vol < avg * 0.5) color = '#7FFFD4';
    else color = '#787B86';
    barColors.push({ time: bars[i].time, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    barColors,
  };
}

export const VolumeColoredBars = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
