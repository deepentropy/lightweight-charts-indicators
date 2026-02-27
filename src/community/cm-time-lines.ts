/**
 * CM Time Based Vertical Lines
 *
 * Time-based marker indicator. Outputs a spike every N bars to mark time intervals.
 *
 * Reference: TradingView "CM_Time Based Vertical Lines" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface CMTimeLinesInputs {
  period: number;
}

export const defaultInputs: CMTimeLinesInputs = {
  period: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Time Marker', color: '#787B86', lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'CM Time Based Vertical Lines',
  shortTitle: 'CMTime',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CMTimeLinesInputs> = {}): IndicatorResult {
  const { period } = { ...defaultInputs, ...inputs };

  const plot0 = bars.map((b, i) => ({
    time: b.time,
    value: (i % period === 0) ? 1 : NaN,
  }));

  // Pine bgcolor: yellow on session bar (transp=40)
  const bgColors: BgColorData[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i % period === 0) {
      bgColors.push({ time: bars[i].time, color: 'rgba(255,255,0,0.60)' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    bgColors,
  } as IndicatorResult & { bgColors: BgColorData[] };
}

export const CMTimeLines = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
