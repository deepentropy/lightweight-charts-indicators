/**
 * Trend Strength Index
 *
 * Measures trend strength using the Pearson correlation between
 * closing prices and bar indices over a rolling window.
 * Range: -1 to 1, where positive = uptrend, negative = downtrend.
 * Formula: correlation(close, bar_index, length)
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillData, type Bar } from 'oakscriptjs';

export interface TrendStrengthInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: TrendStrengthInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Strength Index', color: '#7E57C2', lineWidth: 1 },
  { id: 'plot1', title: 'TSI Bullish', color: '#089981', lineWidth: 0, display: 'none' },
  { id: 'plot2', title: 'TSI Bearish', color: '#F23645', lineWidth: 0, display: 'none' },
  { id: 'plot3', title: 'Middle Line', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_bull', price: 1, color: '#089981', linestyle: 'solid', title: 'TSI Bullish Band' },
  { id: 'hline_mid',  price: 0, color: '#787B8680', linestyle: 'solid', title: 'TSI Middle Band' },
  { id: 'hline_bear', price: -1, color: '#F23645', linestyle: 'solid', title: 'TSI Bearish Band' },
];

export const metadata = {
  title: 'Trend Strength Index',
  shortTitle: 'TSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TrendStrengthInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);
  const barIndex = new Series(bars, (_, i) => i);

  const tsArr = ta.correlation(close, barIndex, length).toArray();

  const tsData = tsArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

  // Split TSI into bullish (>0) and bearish (<0) for fill zones
  const bullishData = tsArr.map((v, i) => ({
    time: bars[i].time,
    value: (v != null && v > 0) ? v : NaN,
  }));
  const bearishData = tsArr.map((v, i) => ({
    time: bars[i].time,
    value: (v != null && v < 0) ? v : NaN,
  }));
  const midlineData = bars.map(b => ({ time: b.time, value: 0 }));

  const fills: FillData[] = [
    { plot1: 'plot1', plot2: 'plot3', options: { color: '#089981', transp: 90, title: 'Bullish Gradient Fill' } },
    { plot1: 'plot2', plot2: 'plot3', options: { color: '#F23645', transp: 90, title: 'Bearish Gradient Fill' } },
  ];

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': tsData,
      'plot1': bullishData,
      'plot2': bearishData,
      'plot3': midlineData,
    },
    fills,
  };
}

export const TrendStrengthIndex = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
