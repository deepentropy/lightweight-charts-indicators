/**
 * Ideal Entry Point (IEP)
 *
 * Marks candles whose price levels are NOT retraced (touched again) in the
 * following N bars. Long-only: looks at the MIN LOW of the next N bars
 * versus the candle's low / open / close / high.
 *
 * Levels (stronger gradient = higher level survived):
 *   1 (weakest)  : LOW not retraced  -> subsequent lows stayed above the low
 *   2            : lower body not retraced
 *   3            : upper body not retraced
 *   4 (strongest): HIGH not retraced -> subsequent lows stayed above the high
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface IdealEntryPointInputs {
  lookforward: number;
  colLow: string;
  colLower: string;
  colUpper: string;
  colHigh: string;
  showOnlyStrong: boolean;
}

export const defaultInputs: IdealEntryPointInputs = {
  lookforward: 10,
  colLow: '#ffeb3b',
  colLower: '#ffa726',
  colUpper: '#fb8c00',
  colHigh: '#e53935',
  showOnlyStrong: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookforward', type: 'int', title: 'Lookforward Bars', defval: 10, min: 1, max: 500 },
  { id: 'colLow', type: 'color', title: '1 - LOW not retraced', defval: '#ffeb3b' },
  { id: 'colLower', type: 'color', title: '2 - lower body not retraced', defval: '#ffa726' },
  { id: 'colUpper', type: 'color', title: '3 - upper body not retraced', defval: '#fb8c00' },
  { id: 'colHigh', type: 'color', title: '4 - HIGH not retraced', defval: '#e53935' },
  { id: 'showOnlyStrong', type: 'bool', title: 'Only show level >= 3 (upper body / high)', defval: false },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Ideal Entry Point',
  shortTitle: 'IEP',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IdealEntryPointInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const N = cfg.lookforward;
  const threshold = cfg.showOnlyStrong ? 3 : 1;

  const markers: MarkerData[] = [];

  for (let c = 0; c + N < bars.length; c++) {
    const ev = bars[c];
    const bodyHigh = Math.max(ev.open, ev.close);
    const bodyLow = Math.min(ev.open, ev.close);

    let minSubLow = Infinity;
    for (let k = 1; k <= N; k++) {
      const lo = bars[c + k].low;
      if (lo < minSubLow) minSubLow = lo;
    }

    let level = 0;
    if (minSubLow > ev.high) level = 4;
    else if (minSubLow > bodyHigh) level = 3;
    else if (minSubLow > bodyLow) level = 2;
    else if (minSubLow > ev.low) level = 1;

    if (level >= threshold) {
      const color =
        level === 4 ? cfg.colHigh :
        level === 3 ? cfg.colUpper :
        level === 2 ? cfg.colLower :
        cfg.colLow;
      markers.push({
        time: ev.time as number,
        position: 'belowBar',
        shape: 'triangleUp',
        color,
        size: 1,
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
  };
}

export const IdealEntryPoint = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
