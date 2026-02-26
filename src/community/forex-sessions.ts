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

export function calculate(bars: Bar[], inputs: Partial<ForexSessionsInputs> = {}): IndicatorResult {
  const { sessionLen } = { ...defaultInputs, ...inputs };
  const totalCycle = sessionLen * 4;

  const sessionColors = ['#FFEB3B', '#2962FF', '#26A69A', '#EF5350']; // Sydney, Tokyo, London, NY

  const plot0 = bars.map((b, i) => {
    const cycle = i % totalCycle;
    const phase = Math.floor(cycle / sessionLen);
    const color = sessionColors[phase];
    return { time: b.time, value: b.volume ?? 0, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const ForexSessions = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
