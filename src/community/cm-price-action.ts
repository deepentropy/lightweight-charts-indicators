/**
 * CM Price-Action-Bars
 *
 * Price action bar coloring by pattern type.
 * Inside bar (yellow), outside bar (blue), up key bar (green), down key bar (red).
 * Key bar = body > 50% of range.
 *
 * Reference: TradingView "CM_Price-Action-Bars" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface CMPriceActionInputs {}

export const defaultInputs: CMPriceActionInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'CM Price Action Bars',
  shortTitle: 'CMPriceAction',
  overlay: true,
};

export function calculate(bars: Bar[], _inputs: Partial<CMPriceActionInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const barColors: BarColorData[] = [];
  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = 1; i < bars.length; i++) {
    const curr = bars[i];
    const prev = bars[i - 1];

    const range = curr.high - curr.low;
    const body = Math.abs(curr.close - curr.open);

    const insideBar = curr.high < prev.high && curr.low > prev.low;
    const outsideBar = curr.high > prev.high && curr.low < prev.low;
    const keyBar = range > 0 && body > 0.5 * range;

    let color: string;
    if (insideBar) {
      color = '#FFEB3B'; // yellow
    } else if (outsideBar) {
      color = '#2962FF'; // blue
    } else if (keyBar && curr.close > curr.open) {
      color = '#26A69A'; // green - up key bar
    } else if (keyBar && curr.close < curr.open) {
      color = '#EF5350'; // red - down key bar
    } else {
      color = '#787B86'; // gray - normal bar
    }

    barColors.push({ time: curr.time as number, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    barColors,
  } as IndicatorResult & { barColors: BarColorData[] };
}

export const CMPriceAction = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
