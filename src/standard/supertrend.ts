/**
 * Supertrend Indicator
 *
 * A trend-following overlay indicator that uses ATR to calculate
 * dynamic support/resistance levels.
 *
 * PineScript display:
 *   upTrend =   plot(direction < 0 ? supertrend : na, "Up Trend",   style = plot.style_linebr)
 *   downTrend = plot(direction < 0 ? na : supertrend, "Down Trend", style = plot.style_linebr)
 *   bodyMiddle = plot((open + close) / 2, display = display.none)
 *   fill(bodyMiddle, upTrend,   color = color.new(color.green, 90), fillgaps = false)
 *   fill(bodyMiddle, downTrend, color = color.new(color.red,   90), fillgaps = false)
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar } from 'oakscriptjs';

/**
 * Supertrend indicator input parameters
 */
export interface SupertrendInputs {
  /** ATR period length */
  atrPeriod: number;
  /** ATR multiplier factor */
  factor: number;
}

/**
 * Default input values matching TradingView defaults
 */
export const defaultInputs: SupertrendInputs = {
  atrPeriod: 10,
  factor: 3.0,
};

/**
 * Input configuration for UI
 */
export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 3.0, min: 0.01, step: 0.01 },
];

/**
 * Plot configuration
 * plot2 (bodyMiddle) is invisible — used only as a fill anchor
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: '#26A69A', lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Down Trend', color: '#EF5350', lineWidth: 2, style: 'linebr' },
  { id: 'plot2', title: 'Body Middle', color: '#00000000', lineWidth: 0, display: 'none' },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Supertrend',
  shortTitle: 'ST',
  overlay: true,
};

/**
 * Calculate Supertrend indicator
 */
export function calculate(bars: Bar[], inputs: Partial<SupertrendInputs> = {}): IndicatorResult {
  const { atrPeriod, factor } = { ...defaultInputs, ...inputs };

  const [supertrendSeries, directionSeries] = ta.supertrend(bars, factor, atrPeriod);
  const supertrendValues = supertrendSeries.toArray();
  const directions = directionSeries.toArray();

  const upTrendData = supertrendValues.map((value: number | null, i: number) => ({
    time: bars[i].time,
    value: (directions[i] ?? 1) < 0 ? (value ?? NaN) : NaN,
  }));

  const downTrendData = supertrendValues.map((value: number | null, i: number) => ({
    time: bars[i].time,
    value: (directions[i] ?? 1) >= 0 ? (value ?? NaN) : NaN,
  }));

  const bodyMiddleData = bars.map((bar) => ({
    time: bar.time,
    value: (bar.open + bar.close) / 2,
  }));

  const fills: FillData[] = [
    { plot1: 'plot2', plot2: 'plot0', options: { color: '#26A69A', transp: 90, title: 'Uptrend background' } },
    { plot1: 'plot2', plot2: 'plot1', options: { color: '#EF5350', transp: 90, title: 'Downtrend background' } },
  ];

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': upTrendData,
      'plot1': downTrendData,
      'plot2': bodyMiddleData,
    },
    fills,
  };
}

/**
 * Supertrend indicator module
 */
export const Supertrend = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
