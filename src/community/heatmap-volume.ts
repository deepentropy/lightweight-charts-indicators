/**
 * HeatmapVolume
 *
 * Volume heatmap using standard deviation distance from SMA.
 * 5-tier coloring: Extra High / High / Medium / Normal / Low based on
 * how many standard deviations volume is from the moving average.
 *
 * Reference: TradingView "Heatmap Volume [xdecow]" by xdecow
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface HeatmapVolumeInputs {
  maLength: number;
  stdLength: number;
  thresholdExtraHigh: number;
  thresholdHigh: number;
  thresholdMedium: number;
  thresholdNormal: number;
  coloredBars: boolean;
  displayZones: 'None' | 'Lines' | 'Backgrounds' | 'Both';
  colorMode: 'Heatmap' | 'Up/Down';
}

export const defaultInputs: HeatmapVolumeInputs = {
  maLength: 610,
  stdLength: 610,
  thresholdExtraHigh: 4,
  thresholdHigh: 2.5,
  thresholdMedium: 1,
  thresholdNormal: -0.5,
  coloredBars: true,
  displayZones: 'Backgrounds',
  colorMode: 'Heatmap',
};

export const inputConfig: InputConfig[] = [
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 610, min: 2 },
  { id: 'stdLength', type: 'int', title: 'Standard Deviation Length', defval: 610, min: 2 },
  { id: 'thresholdExtraHigh', type: 'float', title: 'Extra High Multiplier', defval: 4, step: 0.1 },
  { id: 'thresholdHigh', type: 'float', title: 'High Multiplier', defval: 2.5, step: 0.1 },
  { id: 'thresholdMedium', type: 'float', title: 'Medium Multiplier', defval: 1, step: 0.1 },
  { id: 'thresholdNormal', type: 'float', title: 'Normal Multiplier', defval: -0.5, step: 0.1 },
  { id: 'coloredBars', type: 'bool', title: 'Colored Bars', defval: true },
  { id: 'displayZones', type: 'string', title: 'Display Heatmap Zones', defval: 'Backgrounds', options: ['None', 'Lines', 'Backgrounds', 'Both'] },
  { id: 'colorMode', type: 'string', title: 'Color Mode', defval: 'Heatmap', options: ['Heatmap', 'Up/Down'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'volume', title: 'Volume', color: '#787B86', lineWidth: 1, style: 'columns' },
  { id: 'ma', title: 'Moving Average', color: '#000000', lineWidth: 2 },
  { id: 'tsExtraHigh', title: 'Extra High heatmap line', color: '#ff0000', lineWidth: 1 },
  { id: 'tsHigh', title: 'High heatmap line', color: '#ff7800', lineWidth: 1 },
  { id: 'tsMedium', title: 'Medium heatmap line', color: '#ffcf03', lineWidth: 1 },
  { id: 'tsNormal', title: 'Normal heatmap line', color: '#a0d6dc', lineWidth: 1 },
];

export const metadata = {
  title: 'Heatmap Volume',
  shortTitle: 'HMV',
  overlay: false,
};

// Heatmap colors
const HM_EXTRA_HIGH = '#ff0000';
const HM_HIGH = '#ff7800';
const HM_MEDIUM = '#ffcf03';
const HM_NORMAL = '#a0d6dc';
const HM_LOW = '#1f9cac';

// Up/Down colors
const UP_EXTRA_HIGH = '#00FF00';
const UP_HIGH = '#30FF30';
const UP_MEDIUM = '#60FF60';
const UP_NORMAL = '#8FFF8F';
const UP_LOW = '#BFFFBF';
const DN_EXTRA_HIGH = '#FF0000';
const DN_HIGH = '#FF3030';
const DN_MEDIUM = '#FF6060';
const DN_NORMAL = '#FF8F8F';
const DN_LOW = '#FFBFBF';

export function calculate(bars: Bar[], inputs: Partial<HeatmapVolumeInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const volSeries = new Series(bars, (b) => b.volume ?? 0);

  // Pine: length := length > bar_index + 1 ? bar_index + 1 : length
  // We use the full arrays from ta functions which handle warmup naturally
  const meanArr = ta.sma(volSeries, cfg.maLength).toArray();
  const stdArr = ta.stdev(volSeries, cfg.stdLength).toArray();

  const warmup = Math.max(cfg.maLength, cfg.stdLength);

  // Determine per-bar color based on stdbar thresholds
  function getBarColor(stdbar: number, isUp: boolean): string {
    if (cfg.colorMode === 'Heatmap') {
      if (stdbar > cfg.thresholdExtraHigh) return HM_EXTRA_HIGH;
      if (stdbar > cfg.thresholdHigh) return HM_HIGH;
      if (stdbar > cfg.thresholdMedium) return HM_MEDIUM;
      if (stdbar > cfg.thresholdNormal) return HM_NORMAL;
      return HM_LOW;
    }
    // Up/Down mode
    if (stdbar > cfg.thresholdExtraHigh) return isUp ? UP_EXTRA_HIGH : DN_EXTRA_HIGH;
    if (stdbar > cfg.thresholdHigh) return isUp ? UP_HIGH : DN_HIGH;
    if (stdbar > cfg.thresholdMedium) return isUp ? UP_MEDIUM : DN_MEDIUM;
    if (stdbar > cfg.thresholdNormal) return isUp ? UP_NORMAL : DN_NORMAL;
    return isUp ? UP_LOW : DN_LOW;
  }

  const showLines = cfg.displayZones === 'Lines' || cfg.displayZones === 'Both';
  const showBgs = cfg.displayZones === 'Backgrounds' || cfg.displayZones === 'Both';

  const volumePlot: { time: number; value: number; color?: string }[] = [];
  const maPlot: { time: number; value: number }[] = [];
  const tsExtraHighPlot: { time: number; value: number }[] = [];
  const tsHighPlot: { time: number; value: number }[] = [];
  const tsMediumPlot: { time: number; value: number }[] = [];
  const tsNormalPlot: { time: number; value: number }[] = [];
  const barColors: BarColorData[] = [];

  for (let i = 0; i < n; i++) {
    const vol = bars[i].volume ?? 0;
    const mean = meanArr[i] ?? NaN;
    const std = stdArr[i] ?? NaN;
    const isUp = bars[i].close > bars[i].open;

    // stdbar = (volume - mean) / std
    const stdbar = std > 0 ? (vol - mean) / std : 0;
    const color = i < warmup ? '#787B86' : getBarColor(stdbar, isUp);

    volumePlot.push({ time: bars[i].time, value: i < warmup ? NaN : vol, color });
    maPlot.push({ time: bars[i].time, value: i < warmup ? NaN : mean });

    // Threshold lines: ts1 = std * thresholdExtraHigh + mean, etc.
    const ts1 = std * cfg.thresholdExtraHigh + mean;
    const ts2 = std * cfg.thresholdHigh + mean;
    const ts3 = std * cfg.thresholdMedium + mean;
    const ts4 = std * cfg.thresholdNormal + mean;

    tsExtraHighPlot.push({ time: bars[i].time, value: i < warmup ? NaN : (showLines ? ts1 : NaN) });
    tsHighPlot.push({ time: bars[i].time, value: i < warmup ? NaN : (showLines ? ts2 : NaN) });
    tsMediumPlot.push({ time: bars[i].time, value: i < warmup ? NaN : (showLines ? ts3 : NaN) });
    tsNormalPlot.push({ time: bars[i].time, value: i < warmup ? NaN : (showLines ? ts4 : NaN) });

    if (cfg.coloredBars && i >= warmup) {
      barColors.push({ time: bars[i].time, color });
    }
  }

  // Build fills for background zones if enabled
  const fills: any[] = [];
  if (showBgs) {
    fills.push(
      { plot1: 'tsExtraHigh', plot2: 'tsHigh', options: { color: 'rgba(255,0,0,0.15)' } },
      { plot1: 'tsHigh', plot2: 'tsMedium', options: { color: 'rgba(255,120,0,0.15)' } },
      { plot1: 'tsMedium', plot2: 'tsNormal', options: { color: 'rgba(255,207,3,0.15)' } },
    );
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      volume: volumePlot,
      ma: maPlot,
      tsExtraHigh: tsExtraHighPlot,
      tsHigh: tsHighPlot,
      tsMedium: tsMediumPlot,
      tsNormal: tsNormalPlot,
    },
    fills,
    barColors,
  };
}

export const HeatmapVolume = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
