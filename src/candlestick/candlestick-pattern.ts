/**
 * Factory for creating candlestick pattern indicators.
 * Each pattern is a thin config that plugs into this shared structure.
 */

import type { Bar, IndicatorResult, InputConfig, PlotConfig } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
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
const BG_COLORS = { bullish: 'rgba(33,150,243,0.1)', bearish: 'rgba(233,30,99,0.1)', neutral: 'rgba(120,123,134,0.1)' };

export function createPattern(config: PatternConfig) {
  const metadata = { title: config.name, shortTitle: config.shortName, overlay: true as const };
  const inputConfig: InputConfig[] = [];
  const plotConfig: PlotConfig[] = [];
  const defaultInputs: Record<string, unknown> = {};
  const numberOfCandles = config.startIndex + 1;

  function calculate(bars: Bar[]): IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] } {
    const c = computeCandles(bars);
    const markers: MarkerData[] = [];
    const bgColors: BgColorData[] = [];
    const bgColor = BG_COLORS[config.signal];
    for (let i = config.startIndex; i < bars.length; i++) {
      if (config.detect(i, c, bars)) {
        markers.push({
          time: bars[i].time,
          position: config.signal === 'bearish' ? 'aboveBar'
            : config.signal === 'neutral' ? 'inBar'
            : 'belowBar',
          shape: config.signal === 'bearish' ? 'arrowDown'
            : config.signal === 'neutral' ? 'diamond'
            : 'arrowUp',
          color: COLORS[config.signal],
          text: config.label,
        });
        for (let j = i - numberOfCandles + 1; j <= i; j++) {
          bgColors.push({ time: bars[j].time as number, color: bgColor });
        }
      }
    }
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: {},
      markers,
      bgColors,
    };
  }

  return { calculate, metadata, defaultInputs, inputConfig, plotConfig };
}
