/**
 * Chop Zone Indicator
 *
 * Uses EMA angle to determine trending vs choppy market conditions.
 * Output is a constant 1 (column plot) with color based on the EMA angle.
 *
 * PineScript reference: plot(1, "Chop Zone", color = chopZoneColor, style = plot.style_columns)
 * Plus barcolor is not used — the columns themselves are colored per-bar.
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ChopZoneInputs {
  // No configurable inputs in the standard indicator
}

export const defaultInputs: ChopZoneInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Chop Zone', color: '#26C6DA', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Chop Zone',
  shortTitle: 'Chop Zone',
  overlay: false,
};

// Color constants matching PineScript
const COLOR_TURQUOISE = '#26C6DA';
const COLOR_DARK_GREEN = '#43A047';
const COLOR_PALE_GREEN = '#A5D6A7';
const COLOR_LIME = '#009688';
const COLOR_DARK_RED = '#D50000';
const COLOR_RED = '#E91E63';
const COLOR_ORANGE = '#FF6D00';
const COLOR_LIGHT_ORANGE = '#FFB74D';
const COLOR_YELLOW = '#FDD835';

function getChopZoneColor(emaAngle: number): string {
  if (emaAngle >= 5) return COLOR_TURQUOISE;
  if (emaAngle >= 3.57) return COLOR_DARK_GREEN;
  if (emaAngle >= 2.14) return COLOR_PALE_GREEN;
  if (emaAngle >= 0.71) return COLOR_LIME;
  if (emaAngle <= -5) return COLOR_DARK_RED;
  if (emaAngle <= -3.57) return COLOR_RED;
  if (emaAngle <= -2.14) return COLOR_ORANGE;
  if (emaAngle <= -0.71) return COLOR_LIGHT_ORANGE;
  return COLOR_YELLOW;
}

export function calculate(bars: Bar[], _inputs: Partial<ChopZoneInputs> = {}): IndicatorResult {
  const periods = 30;
  const pi = Math.PI;

  // Calculate EMA(close, 34)
  const closeSeries = new Series(bars, (b) => b.close);
  const ema34Series = ta.ema(closeSeries, 34);
  const ema34Values = ema34Series.toArray();

  // Calculate highest(high, 30) and lowest(low, 30)
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const highestValues = ta.highest(highSeries, periods).toArray();
  const lowestValues = ta.lowest(lowSeries, periods).toArray();

  const plotData: { time: any; value: number; color?: string }[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const avg = (bar.high + bar.low + bar.close) / 3; // hlc3
    const ema34 = ema34Values[i];
    const prevEma34 = i > 0 ? ema34Values[i - 1] : null;
    const hh = highestValues[i];
    const ll = lowestValues[i];

    if (ema34 == null || prevEma34 == null || hh == null || ll == null || hh === ll) {
      plotData.push({ time: bar.time, value: 1, color: COLOR_YELLOW });
      continue;
    }

    const span = 25 / (hh - ll) * ll;

    // Calculate EMA angle using atan2-based formula from PineScript
    const y2 = (prevEma34 - ema34) / avg * span;
    const c = Math.sqrt(1 + y2 * y2);
    let emaAngle = Math.round(180 * Math.acos(1 / c) / pi);
    if (y2 > 0) emaAngle = -emaAngle;

    plotData.push({ time: bar.time, value: 1, color: getChopZoneColor(emaAngle) });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const ChopZone = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
