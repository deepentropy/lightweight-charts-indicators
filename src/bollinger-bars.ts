/**
 * Bollinger Bars Indicator
 *
 * Visual candle indicator with two plotcandle layers:
 * 1. Wicks: (high, high, low, low) - colored outline
 * 2. Body: (open, high, low, close) - standard candle body
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BollingerBarsInputs {
  // No configurable inputs
}

export const defaultInputs: BollingerBarsInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  // Wicks plotcandle: open=high, high=high, low=low, close=low
  { id: 'plot0', title: 'Wicks Open', color: '#0D349E', lineWidth: 1, display: 'pane' },
  { id: 'plot1', title: 'Wicks High', color: '#0D349E', lineWidth: 1, display: 'pane' },
  { id: 'plot2', title: 'Wicks Low', color: '#0D349E', lineWidth: 1, display: 'pane' },
  { id: 'plot3', title: 'Wicks Close', color: '#0D349E', lineWidth: 1, display: 'pane' },
  // Body plotcandle: open=open, high=high, low=low, close=close
  { id: 'plot4', title: 'Body Open', color: '#089981', lineWidth: 1 },
  { id: 'plot5', title: 'Body High', color: '#089981', lineWidth: 1 },
  { id: 'plot6', title: 'Body Low', color: '#089981', lineWidth: 1 },
  { id: 'plot7', title: 'Body Close', color: '#089981', lineWidth: 1 },
];

export const metadata = {
  title: 'Bollinger Bars',
  shortTitle: 'BB Bars',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<BollingerBarsInputs> = {}): IndicatorResult {
  // Wicks: plotcandle(high, high, low, low)
  const wicksOpen = bars.map(b => ({ time: b.time, value: b.high }));
  const wicksHigh = bars.map(b => ({ time: b.time, value: b.high }));
  const wicksLow = bars.map(b => ({ time: b.time, value: b.low }));
  const wicksClose = bars.map(b => ({ time: b.time, value: b.low }));

  // Body: plotcandle(open, high, low, close)
  const bodyOpen = bars.map(b => ({ time: b.time, value: b.open }));
  const bodyHigh = bars.map(b => ({ time: b.time, value: b.high }));
  const bodyLow = bars.map(b => ({ time: b.time, value: b.low }));
  const bodyClose = bars.map(b => ({ time: b.time, value: b.close }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': wicksOpen,
      'plot1': wicksHigh,
      'plot2': wicksLow,
      'plot3': wicksClose,
      'plot4': bodyOpen,
      'plot5': bodyHigh,
      'plot6': bodyLow,
      'plot7': bodyClose,
    },
  };
}

export const BollingerBars = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
