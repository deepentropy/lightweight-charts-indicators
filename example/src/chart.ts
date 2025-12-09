/**
 * Chart Setup and Management
 * Creates and manages the LightweightCharts instance
 */

import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
  ColorType,
  LineStyle,
} from 'lightweight-charts';
import type {Bar} from 'oakscriptjs';
import { toCandlestickData } from './data-loader';

/**
 * Series configuration
 */
export interface SeriesConfig {
  color?: string;
  lineWidth?: number;
  lineStyle?: number;
  overlay?: boolean;  // Whether to overlay on price chart
  paneIndex?: number; // Which pane to use (0 = main, 1+ = separate)
}

/**
 * Chart wrapper class
 */
export class ChartManager {
  private chart: IChartApi;
  private candlestickSeries: ISeriesApi<'Candlestick'>;
  private indicatorSeries: Map<string, ISeriesApi<'Line'>> = new Map();
  private indicatorPanes: Map<string, number> = new Map(); // Track which pane each indicator is in
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    // Create chart with dark theme
    this.chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#1e222d' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b2b43' },
        horzLines: { color: '#2b2b43' },
      },
      crosshair: {
        mode: 1, // Normal mode
      },
      rightPriceScale: {
        borderColor: '#2b2b43',
      },
      timeScale: {
        borderColor: '#2b2b43',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Create candlestick series
    this.candlestickSeries = this.chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      this.chart.resize(width, height);
    });
    resizeObserver.observe(container);
  }

  /**
   * Set candlestick data
   */
  setCandlestickData(bars: Bar[]): void {
    const data = toCandlestickData(bars) as CandlestickData<Time>[];
    this.candlestickSeries.setData(data);
    this.chart.timeScale().fitContent();
  }

  /**
   * Add or update an indicator series
   */
  setIndicatorData(
    id: string,
    data: Array<{ time: number; value: number }>,
    config: SeriesConfig = {}
  ): void {
    console.log('[ChartManager] setIndicatorData - id:', id);
    console.log('[ChartManager] setIndicatorData - data length:', data.length);
    console.log('[ChartManager] setIndicatorData - first 3 values:', data.slice(0, 3).map(d => ({ time: d.time, value: d.value, valueType: typeof d.value })));
    console.log('[ChartManager] setIndicatorData - config:', config);
    
    let series = this.indicatorSeries.get(id);

    if (!series) {
      // Create new line series - validate lineWidth is within valid range (1-4)
      const lineWidth = config.lineWidth && config.lineWidth >= 1 && config.lineWidth <= 4
        ? config.lineWidth as 1 | 2 | 3 | 4
        : 2;
      series = this.chart.addSeries(LineSeries, {
        color: config.color || '#2962FF',
        lineWidth,
        lineStyle: config.lineStyle ?? LineStyle.Solid,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });

      // Handle pane placement for non-overlay indicators
      // Note: We use === false to require explicit opt-in for separate panes.
      // When overlay is undefined or true, the indicator is placed on the main price chart.
      if (config.overlay === false) {
        // Create a new pane for this indicator
        // In LightweightCharts v5, moveToPane creates a new pane if it doesn't exist
        // paneIndex can be explicitly specified, otherwise auto-assign the next available pane
        const paneIndex = config.paneIndex ?? this.getNextPaneIndex();
        series.moveToPane(paneIndex);
        this.indicatorPanes.set(id, paneIndex);
      } else {
        // Explicitly move overlay indicators to main price chart (pane 0)
        series.moveToPane(0);
        this.indicatorPanes.set(id, 0);
      }

      this.indicatorSeries.set(id, series);
    }

    // Set data - filter out NaN, null, and undefined values
    const lineData = data.filter(d => 
      d.value != null && !Number.isNaN(d.value)
    ) as LineData<Time>[];
    console.log('[ChartManager] setIndicatorData - filtered data length:', lineData.length);
    series.setData(lineData);
  }

  /**
   * Get the next available pane index
   */
  private getNextPaneIndex(): number {
    const usedPanes = new Set(this.indicatorPanes.values());
    let nextPane = 1; // Start from 1 (0 is main chart)
    while (usedPanes.has(nextPane)) {
      nextPane++;
    }
    return nextPane;
  }

  /**
   * Remove an indicator series
   */
  removeIndicator(id: string): void {
    const series = this.indicatorSeries.get(id);
    if (series) {
      this.chart.removeSeries(series);
      this.indicatorSeries.delete(id);
      this.indicatorPanes.delete(id);
    }
  }

  /**
   * Remove all indicator series
   */
  clearIndicators(): void {
    for (const [id, series] of this.indicatorSeries) {
      this.chart.removeSeries(series);
    }
    this.indicatorSeries.clear();
    this.indicatorPanes.clear();

    // Remove empty panes (keep pane 0 which is the main price chart)
    this.removeEmptyPanes();
  }

  /**
   * Remove any empty panes except the main chart (pane 0)
   */
  private removeEmptyPanes(): void {
    const panes = this.chart.panes();
    // Iterate in reverse to avoid index shifting issues when removing
    for (let i = panes.length - 1; i > 0; i--) {
      const pane = panes[i];
      // Check if the pane has no series (empty)
      const seriesInPane = pane.getSeries();
      if (seriesInPane.length === 0) {
        // Remove the empty pane using v5 API
        this.chart.removePane(i);
      }
    }
  }

  /**
   * Get the chart instance
   */
  getChart(): IChartApi {
    return this.chart;
  }

  /**
   * Fit content to view
   */
  fitContent(): void {
    this.chart.timeScale().fitContent();
  }
}
