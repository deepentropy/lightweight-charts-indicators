/**
 * Factory for creating candlestick pattern indicators.
 * Each pattern is a thin config that plugs into this shared structure.
 */

import type { Bar, IndicatorResult, InputConfig, PlotConfig } from 'oakscriptjs';
import type { MarkerData } from './index';
import { computeCandles, type CandleContext } from './candlestick-helpers';

export interface PatternConfig {
  name: string;
  shortName: string;
  label: string;
  signal: 'bullish' | 'bearish' | 'neutral';
  startIndex: number;
  detect: (i: number, c: CandleContext, bars: Bar[]) => boolean;
}

const COLORS = { bullish: '#2196F3', bearish: '#e91e63', neutral: '#787b86' };

export function createPattern(config: PatternConfig) {
  const metadata = { title: config.name, shortTitle: config.shortName, overlay: true as const };
  const inputConfig: InputConfig[] = [];
  const plotConfig: PlotConfig[] = [];
  const defaultInputs: Record<string, unknown> = {};

  function calculate(bars: Bar[]): IndicatorResult & { markers: MarkerData[] } {
    const c = computeCandles(bars);
    const markers: MarkerData[] = [];
    for (let i = config.startIndex; i < bars.length; i++) {
      if (config.detect(i, c, bars)) {
        markers.push({
          time: bars[i].time,
          position: config.signal === 'bearish' ? 'aboveBar' : 'belowBar',
          shape: config.signal === 'bearish' ? 'arrowDown' : 'arrowUp',
          color: COLORS[config.signal],
          text: config.label,
        });
      }
    }
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: {},
      markers,
    };
  }

  return { calculate, metadata, defaultInputs, inputConfig, plotConfig };
}
