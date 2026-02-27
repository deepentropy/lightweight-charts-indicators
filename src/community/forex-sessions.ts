/**
 * Forex Sessions
 *
 * Session indicator based on bar index with cyclic pattern showing 4 session phases.
 * Volume displayed as histogram colored by session phase.
 * Sydney (yellow), Tokyo (blue), London (green), New York (red).
 *
 * Reference: TradingView "Code for All 4 Forex Sessions" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface ForexSessionsInputs {
  sessionLen: number;
}

export const defaultInputs: ForexSessionsInputs = {
  sessionLen: 6,
};

export const inputConfig: InputConfig[] = [
  { id: 'sessionLen', type: 'int', title: 'Session Length (bars)', defval: 6, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Session Volume', color: '#787B86', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'Forex Sessions',
  shortTitle: 'FXSessions',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ForexSessionsInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  const { sessionLen } = { ...defaultInputs, ...inputs };
  const totalCycle = sessionLen * 4;

  const sessionColors = ['#FFEB3B', '#2962FF', '#26A69A', '#EF5350']; // Sydney, Tokyo, London, NY

  const plot0 = bars.map((b, i) => {
    const cycle = i % totalCycle;
    const phase = Math.floor(cycle / sessionLen);
    const color = sessionColors[phase];
    return { time: b.time, value: b.volume ?? 0, color };
  });

  // Background color per session phase (Pine: bgcolor for each session time range)
  // Sydney=yellow, Tokyo=blue, London=green, NY=red at ~transp=75 (0.1 alpha)
  const bgSessionColors = [
    'rgba(255,235,59,0.1)',  // Sydney - yellow
    'rgba(41,98,255,0.1)',   // Tokyo - blue
    'rgba(38,166,154,0.1)',  // London - green
    'rgba(239,83,80,0.1)',   // NY - red
  ];
  const bgColors: BgColorData[] = bars.map((b, i) => {
    const cycle = i % totalCycle;
    const phase = Math.floor(cycle / sessionLen);
    return { time: b.time, color: bgSessionColors[phase] };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    bgColors,
  };
}

export const ForexSessions = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
