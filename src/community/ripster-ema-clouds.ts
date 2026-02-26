/**
 * Ripster EMA Clouds
 *
 * Five pairs of EMAs forming clouds. Each cloud pair is short/long EMA.
 * Default pairs: (8,9), (5,12), (34,50), (72,89), (180,200).
 * Bullish = short >= long (green cloud), Bearish = short < long (red cloud).
 *
 * Reference: TradingView "Ripster EMA Clouds" by ripster47
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RipsterEMACloudsInputs {
  source: SourceType;
  shortLen1: number; longLen1: number;
  shortLen2: number; longLen2: number;
  shortLen3: number; longLen3: number;
  shortLen4: number; longLen4: number;
  shortLen5: number; longLen5: number;
}

export const defaultInputs: RipsterEMACloudsInputs = {
  source: 'hl2',
  shortLen1: 8, longLen1: 9,
  shortLen2: 5, longLen2: 12,
  shortLen3: 34, longLen3: 50,
  shortLen4: 72, longLen4: 89,
  shortLen5: 180, longLen5: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'hl2' },
  { id: 'shortLen1', type: 'int', title: 'Short EMA1', defval: 8, min: 1 },
  { id: 'longLen1', type: 'int', title: 'Long EMA1', defval: 9, min: 1 },
  { id: 'shortLen2', type: 'int', title: 'Short EMA2', defval: 5, min: 1 },
  { id: 'longLen2', type: 'int', title: 'Long EMA2', defval: 12, min: 1 },
  { id: 'shortLen3', type: 'int', title: 'Short EMA3', defval: 34, min: 1 },
  { id: 'longLen3', type: 'int', title: 'Long EMA3', defval: 50, min: 1 },
  { id: 'shortLen4', type: 'int', title: 'Short EMA4', defval: 72, min: 1 },
  { id: 'longLen4', type: 'int', title: 'Long EMA4', defval: 89, min: 1 },
  { id: 'shortLen5', type: 'int', title: 'Short EMA5', defval: 180, min: 1 },
  { id: 'longLen5', type: 'int', title: 'Long EMA5', defval: 200, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short EMA1', color: '#036103', lineWidth: 1 },
  { id: 'plot1', title: 'Long EMA1', color: '#036103', lineWidth: 1 },
  { id: 'plot2', title: 'Short EMA2', color: '#4caf50', lineWidth: 1 },
  { id: 'plot3', title: 'Long EMA2', color: '#4caf50', lineWidth: 1 },
  { id: 'plot4', title: 'Short EMA3', color: '#2196f3', lineWidth: 1 },
  { id: 'plot5', title: 'Long EMA3', color: '#2196f3', lineWidth: 1 },
  { id: 'plot6', title: 'Short EMA4', color: '#009688', lineWidth: 1 },
  { id: 'plot7', title: 'Long EMA4', color: '#009688', lineWidth: 1 },
  { id: 'plot8', title: 'Short EMA5', color: '#05bed5', lineWidth: 1 },
  { id: 'plot9', title: 'Long EMA5', color: '#05bed5', lineWidth: 1 },
];

export const metadata = {
  title: 'Ripster EMA Clouds',
  shortTitle: 'REC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RipsterEMACloudsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.source);

  const pairs = [
    [cfg.shortLen1, cfg.longLen1],
    [cfg.shortLen2, cfg.longLen2],
    [cfg.shortLen3, cfg.longLen3],
    [cfg.shortLen4, cfg.longLen4],
    [cfg.shortLen5, cfg.longLen5],
  ];

  // Bullish/bearish fill colors per cloud pair
  const bullishFillColors = ['#036103', '#4caf50', '#2196f3', '#009688', '#05bed5'];
  const bearishFillColors = ['#880e4f', '#f44336', '#ffb74d', '#f06292', '#e65100'];
  // Transparency: 45%, 65%, 70%, 65%, 65% mapped to hex alpha
  const fillAlphas = ['73', 'A6', 'B3', 'A6', 'A6'];

  const plots: Record<string, Array<{ time: number; value: number; color?: string }>> = {};
  const fills: Array<{ plot1: string; plot2: string; colors: string[] }> = [];

  pairs.forEach(([sLen, lLen], idx) => {
    const shortEma = ta.ema(src, sLen).toArray();
    const longEma = ta.ema(src, lLen).toArray();
    const warmup = Math.max(sLen, lLen);

    // Short EMA: olive if rising, maroon if falling
    plots[`plot${idx * 2}`] = shortEma.map((v, i) => {
      if (i < warmup) return { time: bars[i].time, value: NaN };
      const val = v ?? NaN;
      const prev = i > 0 ? (shortEma[i - 1] ?? val) : val;
      const color = val >= prev ? '#808000' : '#800000';
      return { time: bars[i].time, value: val, color };
    });
    // Long EMA: green if rising, red if falling
    plots[`plot${idx * 2 + 1}`] = longEma.map((v, i) => {
      if (i < warmup) return { time: bars[i].time, value: NaN };
      const val = v ?? NaN;
      const prev = i > 0 ? (longEma[i - 1] ?? val) : val;
      const color = val >= prev ? '#008000' : '#FF0000';
      return { time: bars[i].time, value: val, color };
    });

    // Dynamic fill colors per bar
    const cloudColors = shortEma.map((sv, i) => {
      if (i < warmup) return 'transparent';
      const s = sv ?? 0;
      const l = longEma[i] ?? 0;
      const baseColor = s >= l ? bullishFillColors[idx] : bearishFillColors[idx];
      return baseColor + fillAlphas[idx];
    });
    fills.push({ plot1: `plot${idx * 2}`, plot2: `plot${idx * 2 + 1}`, colors: cloudColors });
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    fills,
  };
}

export const RipsterEMAClouds = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
