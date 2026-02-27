/**
 * Isolated Peak and Bottom (Tuncer SENGOZ)
 *
 * Detects 4 specific isolated peak/bottom patterns using bar-offset comparisons:
 *   - Peak Type 1 (PEAK2): high[2] is highest of bars 0..4, confirmed by low breakdown
 *   - Peak Type 2 (PEAK1): high[1] is highest of bars 0..3, confirmed by low breakdown
 *   - Bottom Type 1 (BOT2): low[2] is lowest of bars 0..4, confirmed by high breakout
 *   - Bottom Type 2 (BOT1): low[1] is lowest of bars 0..3, confirmed by high breakout
 *
 * Reference: TradingView "Isolated Peak and Bottom" (community) by KivancOzbilgic
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface IsolatedPeakBottomInputs {
  // No user-configurable inputs in the original PineScript
}

export const defaultInputs: IsolatedPeakBottomInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Isolated Peak and Bottom',
  shortTitle: 'ISOPB',
  overlay: true,
};

export function calculate(bars: Bar[], _inputs: Partial<IsolatedPeakBottomInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const n = bars.length;
  const markers: MarkerData[] = [];
  const plot0 = bars.map((b) => ({ time: b.time, value: NaN }));

  for (let i = 4; i < n; i++) {
    const h0 = bars[i].high;
    const h1 = bars[i - 1].high;
    const h2 = bars[i - 2].high;
    const h3 = bars[i - 3].high;
    const h4 = bars[i - 4].high;

    const l0 = bars[i].low;
    const l1 = bars[i - 1].low;
    const l2 = bars[i - 2].low;
    const l3 = bars[i - 3].low;
    const l4 = bars[i - 4].low;

    // Pine: izotepe1 = iztepe2 > t02 and iztepe2 >= t12 and iztepe2 > t32 and iztepe2 > t42
    //                   and low[1] > math.min(L32, L22) and low < math.min(L32, L22)
    // Plotted with offset=-2 as PEAK2
    const minL32_L22 = Math.min(l3, l2);
    if (h2 > h0 && h2 >= h1 && h2 > h3 && h2 > h4 && l1 > minL32_L22 && l0 < minL32_L22) {
      markers.push({ time: bars[i - 2].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'PEAK2' });
    }

    // Pine: izotepe2 = t12 > t02 and t12 > iztepe2 and t12 > t32
    //                   and low < math.min(L22, low[1])
    // Plotted with offset=-1 as PEAK1
    if (h1 > h0 && h1 > h2 && h1 > h3 && l0 < Math.min(l2, l1)) {
      markers.push({ time: bars[i - 1].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'PEAK1' });
    }

    // Pine: izodip1 = izdip2 < d02 and izdip2 < d12 and izdip2 < d32 and izdip2 < d42
    //                  and high[1] < math.max(h32, h22) and high > math.max(h32, h22)
    // Plotted with offset=-2 as BOT2
    const maxH32_H22 = Math.max(h3, h2);
    if (l2 < l0 && l2 < l1 && l2 < l3 && l2 < l4 && h1 < maxH32_H22 && h0 > maxH32_H22) {
      markers.push({ time: bars[i - 2].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'BOT2' });
    }

    // Pine: izodip2 = d12 < d02 and d12 < izdip2 and d12 < d32
    //                  and high > math.max(h22, high[1])
    // Plotted with offset=-1 as BOT1
    if (l1 < l0 && l1 < l2 && l1 < l3 && h0 > Math.max(h2, h1)) {
      markers.push({ time: bars[i - 1].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'BOT1' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const IsolatedPeakBottom = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
