/**
 * Moving Average Ribbon Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Displays up to 4 moving averages to visualize trend direction and momentum.
 * Based on TradingView's official MA Ribbon indicator.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MARibbonInputs {
  /** Show MA 1 */
  showMa1: boolean;
  /** MA 1 type */
  ma1Type: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** MA 1 source */
  ma1Source: SourceType;
  /** MA 1 length */
  ma1Length: number;
  /** Show MA 2 */
  showMa2: boolean;
  /** MA 2 type */
  ma2Type: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** MA 2 source */
  ma2Source: SourceType;
  /** MA 2 length */
  ma2Length: number;
  /** Show MA 3 */
  showMa3: boolean;
  /** MA 3 type */
  ma3Type: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** MA 3 source */
  ma3Source: SourceType;
  /** MA 3 length */
  ma3Length: number;
  /** Show MA 4 */
  showMa4: boolean;
  /** MA 4 type */
  ma4Type: 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  /** MA 4 source */
  ma4Source: SourceType;
  /** MA 4 length */
  ma4Length: number;
}

export const defaultInputs: MARibbonInputs = {
  showMa1: true,
  ma1Type: 'SMA',
  ma1Source: 'close',
  ma1Length: 20,
  showMa2: true,
  ma2Type: 'SMA',
  ma2Source: 'close',
  ma2Length: 50,
  showMa3: true,
  ma3Type: 'SMA',
  ma3Source: 'close',
  ma3Length: 100,
  showMa4: true,
  ma4Type: 'SMA',
  ma4Source: 'close',
  ma4Length: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'showMa1', type: 'bool', title: 'Show MA 1', defval: true },
  { id: 'ma1Type', type: 'string', title: 'MA 1 Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'ma1Source', type: 'source', title: 'MA 1 Source', defval: 'close' },
  { id: 'ma1Length', type: 'int', title: 'MA 1 Length', defval: 20, min: 1 },
  { id: 'showMa2', type: 'bool', title: 'Show MA 2', defval: true },
  { id: 'ma2Type', type: 'string', title: 'MA 2 Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'ma2Source', type: 'source', title: 'MA 2 Source', defval: 'close' },
  { id: 'ma2Length', type: 'int', title: 'MA 2 Length', defval: 50, min: 1 },
  { id: 'showMa3', type: 'bool', title: 'Show MA 3', defval: true },
  { id: 'ma3Type', type: 'string', title: 'MA 3 Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'ma3Source', type: 'source', title: 'MA 3 Source', defval: 'close' },
  { id: 'ma3Length', type: 'int', title: 'MA 3 Length', defval: 100, min: 1 },
  { id: 'showMa4', type: 'bool', title: 'Show MA 4', defval: true },
  { id: 'ma4Type', type: 'string', title: 'MA 4 Type', defval: 'SMA', options: ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'ma4Source', type: 'source', title: 'MA 4 Source', defval: 'close' },
  { id: 'ma4Length', type: 'int', title: 'MA 4 Length', defval: 200, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 1', color: '#FFEB3B', lineWidth: 1 }, // Yellow
  { id: 'plot1', title: 'MA 2', color: '#FF9800', lineWidth: 1 }, // Orange
  { id: 'plot2', title: 'MA 3', color: '#2196F3', lineWidth: 1 }, // Blue
  { id: 'plot3', title: 'MA 4', color: '#9C27B0', lineWidth: 1 }, // Purple
];

export const metadata = {
  title: 'Moving Average Ribbon',
  shortTitle: 'MA Ribbon',
  overlay: true,
};

/**
 * Calculate a moving average based on type
 */
function calculateMA(
  bars: Bar[],
  source: SourceType,
  maType: string,
  length: number
): Series {
  const sourceSeries = getSourceSeries(bars, source);
  const volume = new Series(bars, (bar) => bar.volume ?? 0);

  switch (maType) {
    case 'EMA':
      return ta.ema(sourceSeries, length);
    case 'SMMA (RMA)':
      return ta.rma(sourceSeries, length);
    case 'WMA':
      return ta.wma(sourceSeries, length);
    case 'VWMA':
      return ta.vwma(sourceSeries, length, volume);
    case 'SMA':
    default:
      return ta.sma(sourceSeries, length);
  }
}

export function calculate(bars: Bar[], inputs: Partial<MARibbonInputs> = {}): IndicatorResult {
  const {
    showMa1, ma1Type, ma1Source, ma1Length,
    showMa2, ma2Type, ma2Source, ma2Length,
    showMa3, ma3Type, ma3Source, ma3Length,
    showMa4, ma4Type, ma4Source, ma4Length,
  } = { ...defaultInputs, ...inputs };

  const plots: Record<string, { time: number; value: number }[]> = {};

  // Calculate and add each MA if enabled
  const maConfigs = [
    { show: showMa1, type: ma1Type, source: ma1Source, length: ma1Length, plotId: 'plot0' },
    { show: showMa2, type: ma2Type, source: ma2Source, length: ma2Length, plotId: 'plot1' },
    { show: showMa3, type: ma3Type, source: ma3Source, length: ma3Length, plotId: 'plot2' },
    { show: showMa4, type: ma4Type, source: ma4Source, length: ma4Length, plotId: 'plot3' },
  ];

  for (const config of maConfigs) {
    if (config.show) {
      const ma = calculateMA(bars, config.source, config.type, config.length);
      plots[config.plotId] = ma.toArray().map((value, i) => ({
        time: bars[i].time,
        value: value ?? NaN,
      }));
    } else {
      // Return NaN values for hidden MAs
      plots[config.plotId] = bars.map((bar) => ({
        time: bar.time,
        value: NaN,
      }));
    }
  }

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots,
  };
}

export const MARibbon = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
