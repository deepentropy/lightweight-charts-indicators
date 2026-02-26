/**
 * Chart Setup and Management
 * Creates and manages the LightweightCharts instance
 */

import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  BaselineSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type ISeriesPrimitive,
  type IPrimitivePaneView,
  type IPrimitivePaneRenderer,
  type SeriesAttachedParameter,
  type SeriesMarker,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type BaselineData,
  type AreaData,
  type WhitespaceData,
  type Time,
  type SeriesType,
  ColorType,
  LineStyle,
  LineType,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import type { Bar, HLineConfig, FillConfig, FillData } from 'oakscriptjs';
import type {
  BarColorData,
  BgColorData,
  PlotCandleData,
  LabelData,
  LineDrawingData,
  BoxData,
  TableData,
  MarkerData,
} from '../../src/types';
import { toCandlestickData } from './data-loader';

// ─── Series Primitives ──────────────────────────────────────────────────────

/**
 * Base class for Series Primitives that need access to chart/series references
 */
class BasePrimitive implements ISeriesPrimitive<Time> {
  protected _chart: IChartApi | null = null;
  protected _series: ISeriesApi<SeriesType, Time> | null = null;
  protected _requestUpdate: (() => void) | null = null;

  attached(param: SeriesAttachedParameter<Time, SeriesType>): void {
    this._chart = param.chart as IChartApi;
    this._series = param.series as ISeriesApi<SeriesType, Time>;
    this._requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }
}

/**
 * Line-break primitive — draws a line that breaks at NaN gaps.
 * Used for plot.style_linebr where the line disappears during NaN runs.
 */
class LineBrPrimitive extends BasePrimitive {
  private _data: Array<{ time: number; value: number }> = [];
  private _color: string = '#2962FF';
  private _lineWidth: number = 2;
  private _lineStyle: number = 0; // LineStyle.Solid
  private _withSteps: boolean = false;
  private _views: IPrimitivePaneView[] = [new LineBrPaneView(this)];

  setData(data: Array<{ time: number; value: number }>, color: string, lineWidth: number = 2, lineStyle: number = 0, withSteps: boolean = false): void {
    this._data = data;
    this._color = color;
    this._lineWidth = lineWidth;
    this._lineStyle = lineStyle;
    this._withSteps = withSteps;
    this._requestUpdate?.();
  }

  getData() { return this._data; }
  getColor() { return this._color; }
  getLineWidth() { return this._lineWidth; }
  getLineStyle() { return this._lineStyle; }
  getWithSteps() { return this._withSteps; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class LineBrPaneView implements IPrimitivePaneView {
  constructor(private _source: LineBrPrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new LineBrRenderer(this._source);
  }
}

class LineBrRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: LineBrPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const data = this._source.getData();
    const color = this._source.getColor();
    const lineWidth = this._source.getLineWidth();
    const lineStyle = this._source.getLineStyle();
    const withSteps = this._source.getWithSteps();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      if (lineStyle === 1) { // Dashed
        ctx.setLineDash([4, 4]);
      } else if (lineStyle === 2) { // Dotted
        ctx.setLineDash([2, 2]);
      }

      let drawing = false;
      let prevY = 0;

      for (const point of data) {
        const isNaN = point.value == null || Number.isNaN(point.value);

        if (isNaN) {
          // End current segment
          if (drawing) {
            ctx.stroke();
            drawing = false;
          }
          continue;
        }

        const x = timeScale.timeToCoordinate(point.time as unknown as Time);
        const y = series.priceToCoordinate(point.value);
        if (x == null || y == null) {
          if (drawing) { ctx.stroke(); drawing = false; }
          continue;
        }

        if (!drawing) {
          ctx.beginPath();
          ctx.moveTo(x as number, y as number);
          drawing = true;
        } else {
          if (withSteps) {
            ctx.lineTo(x as number, prevY);
          }
          ctx.lineTo(x as number, y as number);
        }
        prevY = y as number;
      }

      if (drawing) {
        ctx.stroke();
      }

      ctx.setLineDash([]);
    });
  }
}

/**
 * Cross marker plot style — draws X marks at data points
 */
class CrossPlotPrimitive extends BasePrimitive {
  private _data: Array<{ time: number; value: number }> = [];
  private _color: string = '#2962FF';
  private _size: number = 6;
  private _views: IPrimitivePaneView[] = [new CrossPlotPaneView(this)];

  setData(data: Array<{ time: number; value: number }>, color: string, size: number = 6): void {
    this._data = data;
    this._color = color;
    this._size = size;
    this._requestUpdate?.();
  }

  getData() { return this._data; }
  getColor() { return this._color; }
  getSize() { return this._size; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class CrossPlotPaneView implements IPrimitivePaneView {
  constructor(private _source: CrossPlotPrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new CrossPlotRenderer(this._source);
  }
}

class CrossPlotRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: CrossPlotPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const data = this._source.getData();
    const color = this._source.getColor();
    const halfSize = this._source.getSize();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (const point of data) {
        if (point.value == null || Number.isNaN(point.value)) continue;
        const x = timeScale.timeToCoordinate(point.time as unknown as Time);
        const y = series.priceToCoordinate(point.value);
        if (x == null || y == null) continue;

        ctx.beginPath();
        ctx.moveTo(x - halfSize, y - halfSize);
        ctx.lineTo(x + halfSize, y + halfSize);
        ctx.moveTo(x + halfSize, y - halfSize);
        ctx.lineTo(x - halfSize, y + halfSize);
        ctx.stroke();
      }
    });
  }
}

/**
 * Background color primitive — fills rectangular areas behind bars
 */
class BgColorPrimitive extends BasePrimitive {
  private _data: BgColorData[] = [];
  private _views: IPrimitivePaneView[] = [new BgColorPaneView(this)];

  setData(data: BgColorData[]): void {
    this._data = data;
    this._requestUpdate?.();
  }

  getData() { return this._data; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class BgColorPaneView implements IPrimitivePaneView {
  constructor(private _source: BgColorPrimitive) {}

  zOrder(): 'bottom' { return 'bottom'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new BgColorRenderer(this._source);
  }
}

class BgColorRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: BgColorPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    if (!chart) return;

    const data = this._source.getData();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const barWidth = getBarWidth(timeScale, mediaSize.width);
      for (const bar of data) {
        const x = timeScale.timeToCoordinate(bar.time as unknown as Time);
        if (x == null) continue;
        ctx.fillStyle = bar.color;
        ctx.fillRect(x - barWidth / 2, 0, barWidth, mediaSize.height);
      }
    });
  }
}

/**
 * Plot fill primitive — draws filled areas between two price levels per bar.
 * Used instead of AreaSeries pairs to avoid masking overlay candlesticks.
 */
interface PlotFillBar {
  time: number;
  upper: number;
  lower: number;
}

class PlotFillPrimitive extends BasePrimitive {
  private _data: PlotFillBar[] = [];
  private _color: string = '#2962FF40';
  private _views: IPrimitivePaneView[] = [new PlotFillPaneView(this)];

  setData(data: PlotFillBar[], color: string): void {
    this._data = data;
    this._color = color;
    this._requestUpdate?.();
  }

  getData() { return this._data; }
  getColor() { return this._color; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class PlotFillPaneView implements IPrimitivePaneView {
  constructor(private _source: PlotFillPrimitive) {}

  zOrder(): 'bottom' { return 'bottom'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new PlotFillRenderer(this._source);
  }
}

class PlotFillRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: PlotFillPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const data = this._source.getData();
    const color = this._source.getColor();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      ctx.fillStyle = color;
      const barWidth = getBarWidth(timeScale, mediaSize.width);

      for (const bar of data) {
        const x = timeScale.timeToCoordinate(bar.time as unknown as Time);
        if (x == null) continue;
        const yUpper = series.priceToCoordinate(bar.upper);
        const yLower = series.priceToCoordinate(bar.lower);
        if (yUpper == null || yLower == null) continue;

        const top = Math.min(yUpper as number, yLower as number);
        const bottom = Math.max(yUpper as number, yLower as number);
        ctx.fillRect((x as number) - barWidth / 2, top, barWidth, bottom - top);
      }
    });
  }
}

/**
 * Extended marker primitive — draws shapes beyond the 4 built-in ones
 */
class ExtendedMarkerPrimitive extends BasePrimitive {
  private _markers: MarkerData[] = [];
  private _views: IPrimitivePaneView[] = [new ExtendedMarkerPaneView(this)];

  setMarkers(markers: MarkerData[]): void {
    this._markers = markers;
    this._requestUpdate?.();
  }

  getMarkers() { return this._markers; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class ExtendedMarkerPaneView implements IPrimitivePaneView {
  constructor(private _source: ExtendedMarkerPrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new ExtendedMarkerRenderer(this._source);
  }
}

class ExtendedMarkerRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: ExtendedMarkerPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const markers = this._source.getMarkers();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const marker of markers) {
        const x = timeScale.timeToCoordinate(marker.time as unknown as Time);
        if (x == null) continue;

        // For price, get from series data at this time
        const logical = timeScale.coordinateToLogical(x as number);
        if (logical == null) continue;
        const barData = series.dataByIndex(logical);
        if (!barData) continue;

        const bar = barData as any;
        let baseY: number | null;
        if (marker.position === 'aboveBar') {
          baseY = series.priceToCoordinate(bar.high ?? bar.value ?? 0);
          if (baseY != null) baseY -= 10;
        } else if (marker.position === 'belowBar') {
          baseY = series.priceToCoordinate(bar.low ?? bar.value ?? 0);
          if (baseY != null) baseY += 10;
        } else {
          baseY = series.priceToCoordinate(bar.close ?? bar.value ?? 0);
        }
        if (baseY == null) continue;

        const size = (marker.size ?? 1) * 6;
        ctx.fillStyle = marker.color;
        ctx.strokeStyle = marker.color;
        ctx.lineWidth = 2;

        drawExtendedShape(ctx, marker.shape, x, baseY, size);

        // Draw text if present
        if (marker.text) {
          ctx.fillStyle = marker.color;
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          const textY = marker.position === 'aboveBar' ? baseY - size - 4 : baseY + size + 12;
          ctx.fillText(marker.text, x, textY);
        }
      }
    });
  }
}

function drawExtendedShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  x: number,
  y: number,
  size: number
): void {
  switch (shape) {
    case 'triangleUp':
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size, y + size);
      ctx.lineTo(x + size, y + size);
      ctx.closePath();
      ctx.fill();
      break;
    case 'triangleDown':
      ctx.beginPath();
      ctx.moveTo(x, y + size);
      ctx.lineTo(x - size, y - size);
      ctx.lineTo(x + size, y - size);
      ctx.closePath();
      ctx.fill();
      break;
    case 'diamond':
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size, y);
      ctx.closePath();
      ctx.fill();
      break;
    case 'cross':
      ctx.beginPath();
      ctx.moveTo(x - size, y);
      ctx.lineTo(x + size, y);
      ctx.moveTo(x, y - size);
      ctx.lineTo(x, y + size);
      ctx.stroke();
      break;
    case 'xcross':
      ctx.beginPath();
      ctx.moveTo(x - size, y - size);
      ctx.lineTo(x + size, y + size);
      ctx.moveTo(x + size, y - size);
      ctx.lineTo(x - size, y + size);
      ctx.stroke();
      break;
    case 'flag':
      // Draw pole
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - size * 2);
      ctx.stroke();
      // Draw flag pennant
      ctx.beginPath();
      ctx.moveTo(x, y - size * 2);
      ctx.lineTo(x + size * 1.5, y - size * 1.5);
      ctx.lineTo(x, y - size);
      ctx.closePath();
      ctx.fill();
      break;
    case 'labelUp':
      // Rounded rect with arrow pointing up
      ctx.beginPath();
      ctx.moveTo(x, y - size * 2);
      ctx.lineTo(x - size, y - size);
      ctx.lineTo(x + size, y - size);
      ctx.closePath();
      ctx.fill();
      break;
    case 'labelDown':
      // Rounded rect with arrow pointing down
      ctx.beginPath();
      ctx.moveTo(x, y + size * 2);
      ctx.lineTo(x - size, y + size);
      ctx.lineTo(x + size, y + size);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

/**
 * Label primitive — draws text labels with backgrounds
 */
class LabelPrimitive extends BasePrimitive {
  private _labels: LabelData[] = [];
  private _views: IPrimitivePaneView[] = [new LabelPaneView(this)];

  setLabels(labels: LabelData[]): void {
    this._labels = labels;
    this._requestUpdate?.();
  }

  getLabels() { return this._labels; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class LabelPaneView implements IPrimitivePaneView {
  constructor(private _source: LabelPrimitive) {}

  zOrder(): 'top' { return 'top'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new LabelRenderer(this._source);
  }
}

const LABEL_FONT_SIZES: Record<string, number> = {
  tiny: 9, small: 11, normal: 13, large: 16, huge: 20,
};

class LabelRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: LabelPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const labels = this._source.getLabels();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const label of labels) {
        const x = timeScale.timeToCoordinate(label.time as unknown as Time);
        const y = series.priceToCoordinate(label.price);
        if (x == null || y == null) continue;

        const fontSize = LABEL_FONT_SIZES[label.size ?? 'normal'] ?? 13;
        ctx.font = `${fontSize}px sans-serif`;
        const textMetrics = ctx.measureText(label.text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        const padding = 4;

        // Draw background
        if (label.color) {
          ctx.fillStyle = label.color;
          const rx = x - textWidth / 2 - padding;
          const ry = y - textHeight / 2 - padding;
          const rw = textWidth + padding * 2;
          const rh = textHeight + padding * 2;
          ctx.beginPath();
          ctx.roundRect(rx, ry, rw, rh, 3);
          ctx.fill();
        }

        // Draw text
        ctx.fillStyle = label.textColor ?? '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label.text, x, y);
      }
    });
  }
}

/**
 * Line drawing primitive — draws lines between two time/price points
 */
class LinePrimitive extends BasePrimitive {
  private _lines: LineDrawingData[] = [];
  private _views: IPrimitivePaneView[] = [new LinePaneView(this)];

  setLines(lines: LineDrawingData[]): void {
    this._lines = lines;
    this._requestUpdate?.();
  }

  getLines() { return this._lines; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class LinePaneView implements IPrimitivePaneView {
  constructor(private _source: LinePrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new LineDrawingRenderer(this._source);
  }
}

class LineDrawingRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: LinePrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const lines = this._source.getLines();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      for (const line of lines) {
        const x1 = timeScale.timeToCoordinate(line.time1 as unknown as Time);
        const y1 = series.priceToCoordinate(line.price1);
        const x2 = timeScale.timeToCoordinate(line.time2 as unknown as Time);
        const y2 = series.priceToCoordinate(line.price2);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;

        ctx.strokeStyle = line.color ?? '#2962FF';
        ctx.lineWidth = line.width ?? 1;

        // Set line dash style
        if (line.style === 'dashed') {
          ctx.setLineDash([6, 3]);
        } else if (line.style === 'dotted') {
          ctx.setLineDash([2, 2]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();

        // Handle line extension
        const extend = line.extend ?? 'none';
        let startX: number = x1, startY: number = y1, endX: number = x2, endY: number = y2;

        if (extend === 'left' || extend === 'both') {
          const dx = (x2 as number) - (x1 as number);
          const dy = (y2 as number) - (y1 as number);
          if (dx !== 0) {
            const t = -(x1 as number) / dx;
            startX = 0;
            startY = (y1 as number) + dy * t;
          }
        }
        if (extend === 'right' || extend === 'both') {
          const dx = (x2 as number) - (x1 as number);
          const dy = (y2 as number) - (y1 as number);
          if (dx !== 0) {
            const t = (mediaSize.width - (x1 as number)) / dx;
            endX = mediaSize.width;
            endY = (y1 as number) + dy * t;
          }
        }

        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });
  }
}

/**
 * Box primitive — draws filled rectangles
 */
class BoxPrimitive extends BasePrimitive {
  private _boxes: BoxData[] = [];
  private _views: IPrimitivePaneView[] = [new BoxPaneView(this)];

  setBoxes(boxes: BoxData[]): void {
    this._boxes = boxes;
    this._requestUpdate?.();
  }

  getBoxes() { return this._boxes; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

class BoxPaneView implements IPrimitivePaneView {
  constructor(private _source: BoxPrimitive) {}

  zOrder(): 'bottom' { return 'bottom'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new BoxRenderer(this._source);
  }
}

class BoxRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: BoxPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const boxes = this._source.getBoxes();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      for (const box of boxes) {
        const x1 = timeScale.timeToCoordinate(box.time1 as unknown as Time);
        const y1 = series.priceToCoordinate(box.price1);
        const x2 = timeScale.timeToCoordinate(box.time2 as unknown as Time);
        const y2 = series.priceToCoordinate(box.price2);
        if (x1 == null || y1 == null || x2 == null || y2 == null) continue;

        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);

        // Fill
        if (box.bgColor) {
          ctx.fillStyle = box.bgColor;
          ctx.fillRect(left, top, width, height);
        }

        // Border
        if (box.borderColor) {
          ctx.strokeStyle = box.borderColor;
          ctx.lineWidth = box.borderWidth ?? 1;
          if (box.borderStyle === 'dashed') {
            ctx.setLineDash([6, 3]);
          } else if (box.borderStyle === 'dotted') {
            ctx.setLineDash([2, 2]);
          } else {
            ctx.setLineDash([]);
          }
          ctx.strokeRect(left, top, width, height);
          ctx.setLineDash([]);
        }
      }
    });
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────

/**
 * Estimate bar width from the time scale's visible range
 */
function getBarWidth(timeScale: ReturnType<IChartApi['timeScale']>, mediaWidth: number): number {
  const visibleRange = timeScale.getVisibleLogicalRange();
  if (!visibleRange) return 8;
  const barsCount = visibleRange.to - visibleRange.from;
  if (barsCount <= 0) return 8;
  return Math.max(1, mediaWidth / barsCount);
}

// ─── Series configuration ─────────────────────────────────────────────────

/**
 * Series configuration
 */
export interface SeriesConfig {
  color?: string;
  lineWidth?: number;
  lineStyle?: number;
  lineType?: number;
  overlay?: boolean;
  paneIndex?: number;
  pointMarkersVisible?: boolean;
  lineVisible?: boolean;
  /** When true, NaN values create gaps (whitespace) instead of being filtered out */
  preserveGaps?: boolean;
}

/**
 * Chart wrapper class
 */
export class ChartManager {
  private chart: IChartApi;
  private container: HTMLElement;
  private candlestickSeries: ISeriesApi<'Candlestick'>;
  private indicatorSeries: Map<string, ISeriesApi<'Line'>> = new Map();
  private areaSeries: Map<string, ISeriesApi<'Area'>> = new Map();
  private histogramSeriesMap: Map<string, ISeriesApi<'Histogram'>> = new Map();
  private indicatorPanes: Map<string, number> = new Map();
  private hlineSeries: Map<string, ISeriesApi<'Line'>> = new Map();
  private fillSeries: Map<string, ISeriesApi<'Baseline'>> = new Map();
  private plotFillPrimitives: PlotFillPrimitive[] = [];
  private plotFillAnchorSeries: ISeriesApi<'Line'>[] = [];
  private markerPlugin: ISeriesMarkersPluginApi<Time> | null = null;
  // New display component state
  private crossPrimitives: Map<string, CrossPlotPrimitive> = new Map();
  private crossAnchorSeries: Map<string, ISeriesApi<'Line'>> = new Map();
  private lineBrPrimitives: Map<string, LineBrPrimitive> = new Map();
  private lineBrAnchorSeries: Map<string, ISeriesApi<'Line'>> = new Map();
  private candlePlotSeries: Map<string, ISeriesApi<'Candlestick'>> = new Map();
  private bgColorPrimitive: BgColorPrimitive | null = null;
  private bgColorAnchorSeries: ISeriesApi<'Line'> | null = null;
  private extendedMarkerPrimitive: ExtendedMarkerPrimitive | null = null;
  private labelPrimitive: LabelPrimitive | null = null;
  private labelAnchorSeries: ISeriesApi<'Line'> | null = null;
  private linePrimitive: LinePrimitive | null = null;
  private lineAnchorSeries: ISeriesApi<'Line'> | null = null;
  private boxPrimitive: BoxPrimitive | null = null;
  private boxAnchorSeries: ISeriesApi<'Line'> | null = null;
  private tableElement: HTMLElement | null = null;
  private originalBarColors: CandlestickData<Time>[] | null = null;

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
    this.originalBarColors = data.map(d => ({ ...d }));
    this.candlestickSeries.setData(data);
    this.chart.timeScale().fitContent();
  }

  // ─── Phase 1: Plot Styles ──────────────────────────────────────────────

  /**
   * Add or update an indicator series (line, linebr, stepline, steplinebr, circles)
   */
  setIndicatorData(
    id: string,
    data: Array<{ time: number; value: number; color?: string }>,
    config: SeriesConfig = {}
  ): void {
    let series = this.indicatorSeries.get(id);

    if (!series) {
      const lineWidth = config.lineWidth && config.lineWidth >= 1 && config.lineWidth <= 4
        ? config.lineWidth as 1 | 2 | 3 | 4
        : 2;
      series = this.chart.addSeries(LineSeries, {
        color: config.color || '#2962FF',
        lineWidth,
        lineStyle: config.lineStyle ?? LineStyle.Solid,
        lineType: config.lineType ?? LineType.Simple,
        pointMarkersVisible: config.pointMarkersVisible ?? false,
        lineVisible: config.lineVisible ?? true,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      });

      if (config.overlay === false) {
        const paneIndex = config.paneIndex ?? this.getNextPaneIndex();
        series.moveToPane(paneIndex);
        this.indicatorPanes.set(id, paneIndex);
      } else {
        series.moveToPane(0);
        this.indicatorPanes.set(id, 0);
      }

      this.indicatorSeries.set(id, series);
    }

    if (config.preserveGaps) {
      // linebr/steplinebr: NaN values become whitespace entries to create gaps
      const lineData: (LineData<Time> | WhitespaceData<Time>)[] = data.map(d => {
        if (d.value == null || Number.isNaN(d.value)) {
          return { time: d.time as unknown as Time };
        }
        const pt: LineData<Time> = { time: d.time as unknown as Time, value: d.value };
        if (d.color) pt.color = d.color;
        return pt;
      });
      series.setData(lineData);
    } else {
      const lineData = data.filter(d =>
        d.value != null && !Number.isNaN(d.value)
      ) as LineData<Time>[];
      series.setData(lineData);
    }
  }

  /**
   * Add or update an area series (for 'area' plot style)
   */
  setAreaPlotData(
    id: string,
    data: Array<{ time: number; value: number; color?: string }>,
    config: SeriesConfig = {}
  ): void {
    let series = this.areaSeries.get(id);

    if (!series) {
      const color = config.color || '#2962FF';
      series = this.chart.addSeries(AreaSeries, {
        topColor: color + '40',
        bottomColor: color + '10',
        lineColor: color,
        lineWidth: (config.lineWidth && config.lineWidth >= 1 && config.lineWidth <= 4
          ? config.lineWidth : 2) as 1 | 2 | 3 | 4,
        crosshairMarkerVisible: true,
      });

      if (config.overlay === false) {
        const paneIndex = config.paneIndex ?? this.getNextPaneIndex();
        series.moveToPane(paneIndex);
        this.indicatorPanes.set(id, paneIndex);
      } else {
        series.moveToPane(0);
        this.indicatorPanes.set(id, 0);
      }

      this.areaSeries.set(id, series);
    }

    const areaData = data.filter(d =>
      d.value != null && !Number.isNaN(d.value)
    ) as AreaData<Time>[];
    series.setData(areaData);
  }

  /**
   * Add or update a cross marker series (for 'cross' plot style)
   */
  setCrossPlotData(
    id: string,
    data: Array<{ time: number; value: number }>,
    config: SeriesConfig = {}
  ): void {
    let primitive = this.crossPrimitives.get(id);

    if (!primitive) {
      // Create invisible anchor series to attach the primitive
      const anchor = this.chart.addSeries(LineSeries, {
        color: 'transparent',
        lineVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });

      if (config.overlay === false) {
        const paneIndex = config.paneIndex ?? this.getNextPaneIndex();
        anchor.moveToPane(paneIndex);
        this.indicatorPanes.set(id, paneIndex);
      } else {
        anchor.moveToPane(0);
        this.indicatorPanes.set(id, 0);
      }

      // Set minimal data so the series exists
      const anchorData = data.filter(d =>
        d.value != null && !Number.isNaN(d.value)
      ) as LineData<Time>[];
      anchor.setData(anchorData);
      this.crossAnchorSeries.set(id, anchor);

      primitive = new CrossPlotPrimitive();
      anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
      this.crossPrimitives.set(id, primitive);
    }

    primitive.setData(data, config.color || '#2962FF', (config.lineWidth ?? 2) * 3);
  }

  /**
   * Add or update a line-break series (linebr/steplinebr) using a canvas primitive.
   * The line breaks at NaN gaps instead of connecting across them.
   */
  setLineBrData(
    id: string,
    data: Array<{ time: number; value: number }>,
    config: SeriesConfig = {}
  ): void {
    let primitive = this.lineBrPrimitives.get(id);

    if (!primitive) {
      const anchor = this.chart.addSeries(LineSeries, {
        color: 'transparent',
        lineVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });

      if (config.overlay === false) {
        const paneIndex = config.paneIndex ?? this.getNextPaneIndex();
        anchor.moveToPane(paneIndex);
        this.indicatorPanes.set(id, paneIndex);
      } else {
        anchor.moveToPane(0);
        this.indicatorPanes.set(id, 0);
      }

      const anchorData = data.filter(d =>
        d.value != null && !Number.isNaN(d.value)
      ) as LineData<Time>[];
      anchor.setData(anchorData);
      this.lineBrAnchorSeries.set(id, anchor);

      primitive = new LineBrPrimitive();
      anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
      this.lineBrPrimitives.set(id, primitive);
    }

    const withSteps = config.lineType === LineType.WithSteps;
    primitive.setData(data, config.color || '#2962FF', config.lineWidth ?? 2, config.lineStyle ?? 0, withSteps);
  }

  /**
   * Clear all area series
   */
  private clearAreaSeries(): void {
    for (const [id, series] of this.areaSeries) {
      this.chart.removeSeries(series);
      this.indicatorPanes.delete(id);
    }
    this.areaSeries.clear();
  }

  /**
   * Clear all cross plot primitives
   */
  private clearCrossPlots(): void {
    for (const [id, primitive] of this.crossPrimitives) {
      const anchor = this.crossAnchorSeries.get(id);
      if (anchor) {
        anchor.detachPrimitive(primitive as ISeriesPrimitive<Time>);
        this.chart.removeSeries(anchor);
      }
      this.indicatorPanes.delete(id);
    }
    this.crossPrimitives.clear();
    this.crossAnchorSeries.clear();
  }

  private clearLineBrPlots(): void {
    for (const [id, primitive] of this.lineBrPrimitives) {
      const anchor = this.lineBrAnchorSeries.get(id);
      if (anchor) {
        anchor.detachPrimitive(primitive as ISeriesPrimitive<Time>);
        this.chart.removeSeries(anchor);
      }
      this.indicatorPanes.delete(id);
    }
    this.lineBrPrimitives.clear();
    this.lineBrAnchorSeries.clear();
  }

  // ─── Phase 2: barcolor ─────────────────────────────────────────────────

  /**
   * Apply per-bar colors to the main candlestick series
   */
  setBarColors(barColors: BarColorData[]): void {
    if (!this.originalBarColors) return;

    const colorMap = new Map(barColors.map(bc => [bc.time, bc.color]));
    const data = this.originalBarColors.map(bar => {
      const color = colorMap.get(bar.time as unknown as number);
      if (color) {
        return { ...bar, color, borderColor: color, wickColor: color };
      }
      return bar;
    });
    this.candlestickSeries.setData(data);
  }

  /**
   * Reset candlestick colors to defaults
   */
  private clearBarColors(): void {
    if (this.originalBarColors) {
      this.candlestickSeries.setData(this.originalBarColors);
    }
  }

  // ─── Phase 3: bgcolor ──────────────────────────────────────────────────

  /**
   * Apply background colors behind bars
   */
  setBgColors(bgColors: BgColorData[], paneIndex: number): void {
    this.clearBgColors();

    // Create invisible anchor series
    const anchor = this.chart.addSeries(LineSeries, {
      color: 'transparent',
      lineVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    anchor.moveToPane(paneIndex);

    // Set minimal data
    if (bgColors.length > 0) {
      anchor.setData([
        { time: bgColors[0].time as unknown as Time, value: 0 },
        { time: bgColors[bgColors.length - 1].time as unknown as Time, value: 0 },
      ] as LineData<Time>[]);
    }

    const primitive = new BgColorPrimitive();
    anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
    primitive.setData(bgColors);

    this.bgColorPrimitive = primitive;
    this.bgColorAnchorSeries = anchor;
  }

  /**
   * Clear background colors
   */
  private clearBgColors(): void {
    if (this.bgColorPrimitive && this.bgColorAnchorSeries) {
      this.bgColorAnchorSeries.detachPrimitive(this.bgColorPrimitive as ISeriesPrimitive<Time>);
      this.chart.removeSeries(this.bgColorAnchorSeries);
      this.bgColorPrimitive = null;
      this.bgColorAnchorSeries = null;
    }
  }

  // ─── Phase 4: plotcandle ───────────────────────────────────────────────

  /**
   * Add an overlay candlestick series
   */
  setCandlePlotData(
    id: string,
    data: PlotCandleData[],
    paneIndex: number
  ): void {
    let series = this.candlePlotSeries.get(id);

    if (!series) {
      series = this.chart.addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: true,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      });
      series.moveToPane(paneIndex);
      this.indicatorPanes.set(`candle_${id}`, paneIndex);
      this.candlePlotSeries.set(id, series);
    }

    const candleData = data.map(d => ({
      time: d.time as unknown as Time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
      ...(d.color && { color: d.color, borderColor: d.borderColor ?? d.color, wickColor: d.wickColor ?? d.color }),
    })) as CandlestickData<Time>[];
    series.setData(candleData);
  }

  /**
   * Clear all plotcandle series
   */
  private clearCandlePlots(): void {
    for (const [id, series] of this.candlePlotSeries) {
      this.chart.removeSeries(series);
      this.indicatorPanes.delete(`candle_${id}`);
    }
    this.candlePlotSeries.clear();
  }

  // ─── Phase 5: Extended Markers ─────────────────────────────────────────

  /**
   * Set markers — splits into built-in (arrow/circle/square) and extended shapes
   */
  setMarkers(markers: SeriesMarker<Time>[], extendedMarkers?: MarkerData[]): void {
    // Built-in markers
    if (markers.length > 0) {
      if (!this.markerPlugin) {
        this.markerPlugin = createSeriesMarkers(this.candlestickSeries, markers);
      } else {
        this.markerPlugin.setMarkers(markers);
      }
    } else if (this.markerPlugin) {
      this.markerPlugin.setMarkers([]);
    }

    // Extended markers
    if (extendedMarkers && extendedMarkers.length > 0) {
      if (!this.extendedMarkerPrimitive) {
        this.extendedMarkerPrimitive = new ExtendedMarkerPrimitive();
        this.candlestickSeries.attachPrimitive(this.extendedMarkerPrimitive as ISeriesPrimitive<Time>);
      }
      this.extendedMarkerPrimitive.setMarkers(extendedMarkers);
    } else {
      this.clearExtendedMarkers();
    }
  }

  /**
   * Clear all markers
   */
  clearMarkers(): void {
    if (this.markerPlugin) {
      this.markerPlugin.setMarkers([]);
    }
    this.clearExtendedMarkers();
  }

  private clearExtendedMarkers(): void {
    if (this.extendedMarkerPrimitive) {
      this.candlestickSeries.detachPrimitive(this.extendedMarkerPrimitive as ISeriesPrimitive<Time>);
      this.extendedMarkerPrimitive = null;
    }
  }

  // ─── Phase 6: Labels ──────────────────────────────────────────────────

  /**
   * Draw text labels on the chart
   */
  setLabels(labels: LabelData[], paneIndex: number): void {
    this.clearLabels();

    const anchor = this.chart.addSeries(LineSeries, {
      color: 'transparent',
      lineVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    anchor.moveToPane(paneIndex);

    if (labels.length > 0) {
      anchor.setData(labels.map(l => ({
        time: l.time as unknown as Time,
        value: l.price,
      })) as LineData<Time>[]);
    }

    const primitive = new LabelPrimitive();
    anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
    primitive.setLabels(labels);

    this.labelPrimitive = primitive;
    this.labelAnchorSeries = anchor;
  }

  private clearLabels(): void {
    if (this.labelPrimitive && this.labelAnchorSeries) {
      this.labelAnchorSeries.detachPrimitive(this.labelPrimitive as ISeriesPrimitive<Time>);
      this.chart.removeSeries(this.labelAnchorSeries);
      this.labelPrimitive = null;
      this.labelAnchorSeries = null;
    }
  }

  // ─── Phase 7: Line Drawings ───────────────────────────────────────────

  /**
   * Draw lines on the chart
   */
  setLineDrawings(lines: LineDrawingData[], paneIndex: number): void {
    this.clearLineDrawings();

    const anchor = this.chart.addSeries(LineSeries, {
      color: 'transparent',
      lineVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    anchor.moveToPane(paneIndex);

    if (lines.length > 0) {
      // Set anchor data from line endpoints
      const times = new Set<number>();
      const prices: Record<number, number> = {};
      for (const line of lines) {
        times.add(line.time1);
        times.add(line.time2);
        prices[line.time1] = line.price1;
        prices[line.time2] = line.price2;
      }
      const sortedTimes = Array.from(times).sort((a, b) => a - b);
      anchor.setData(sortedTimes.map(t => ({
        time: t as unknown as Time,
        value: prices[t],
      })) as LineData<Time>[]);
    }

    const primitive = new LinePrimitive();
    anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
    primitive.setLines(lines);

    this.linePrimitive = primitive;
    this.lineAnchorSeries = anchor;
  }

  private clearLineDrawings(): void {
    if (this.linePrimitive && this.lineAnchorSeries) {
      this.lineAnchorSeries.detachPrimitive(this.linePrimitive as ISeriesPrimitive<Time>);
      this.chart.removeSeries(this.lineAnchorSeries);
      this.linePrimitive = null;
      this.lineAnchorSeries = null;
    }
  }

  // ─── Phase 8: Boxes ───────────────────────────────────────────────────

  /**
   * Draw boxes on the chart
   */
  setBoxes(boxes: BoxData[], paneIndex: number): void {
    this.clearBoxes();

    const anchor = this.chart.addSeries(LineSeries, {
      color: 'transparent',
      lineVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });
    anchor.moveToPane(paneIndex);

    if (boxes.length > 0) {
      const times = new Set<number>();
      const prices: Record<number, number> = {};
      for (const box of boxes) {
        times.add(box.time1);
        times.add(box.time2);
        prices[box.time1] = box.price1;
        prices[box.time2] = box.price2;
      }
      const sortedTimes = Array.from(times).sort((a, b) => a - b);
      anchor.setData(sortedTimes.map(t => ({
        time: t as unknown as Time,
        value: prices[t],
      })) as LineData<Time>[]);
    }

    const primitive = new BoxPrimitive();
    anchor.attachPrimitive(primitive as ISeriesPrimitive<Time>);
    primitive.setBoxes(boxes);

    this.boxPrimitive = primitive;
    this.boxAnchorSeries = anchor;
  }

  private clearBoxes(): void {
    if (this.boxPrimitive && this.boxAnchorSeries) {
      this.boxAnchorSeries.detachPrimitive(this.boxPrimitive as ISeriesPrimitive<Time>);
      this.chart.removeSeries(this.boxAnchorSeries);
      this.boxPrimitive = null;
      this.boxAnchorSeries = null;
    }
  }

  // ─── Phase 9: Tables ──────────────────────────────────────────────────

  /**
   * Display a data table as a DOM overlay
   */
  setTable(table: TableData): void {
    this.clearTable();

    const el = document.createElement('div');
    el.className = 'chart-table-overlay';

    // Position mapping
    const positionStyles: Record<string, string> = {
      top_left: 'top:8px;left:8px',
      top_center: 'top:8px;left:50%;transform:translateX(-50%)',
      top_right: 'top:8px;right:8px',
      middle_left: 'top:50%;left:8px;transform:translateY(-50%)',
      middle_center: 'top:50%;left:50%;transform:translate(-50%,-50%)',
      middle_right: 'top:50%;right:8px;transform:translateY(-50%)',
      bottom_left: 'bottom:8px;left:8px',
      bottom_center: 'bottom:8px;left:50%;transform:translateX(-50%)',
      bottom_right: 'bottom:8px;right:8px',
    };

    el.style.cssText = `
      position:absolute;${positionStyles[table.position] ?? 'top:8px;right:8px'};
      z-index:10;pointer-events:none;
      background:rgba(30,34,45,0.9);border:1px solid #2b2b43;border-radius:4px;
      padding:4px;font-family:monospace;font-size:11px;color:#d1d4dc;
    `;

    // Build table HTML
    const grid: string[][] = Array.from({ length: table.rows }, () =>
      Array.from({ length: table.columns }, () => '')
    );
    const cellStyles: Record<string, { bgColor?: string; textColor?: string; textSize?: string }> = {};

    for (const cell of table.cells) {
      if (cell.row < table.rows && cell.column < table.columns) {
        grid[cell.row][cell.column] = cell.text;
        cellStyles[`${cell.row}_${cell.column}`] = {
          bgColor: cell.bgColor,
          textColor: cell.textColor,
          textSize: cell.textSize,
        };
      }
    }

    const fontSizes: Record<string, string> = {
      tiny: '9px', small: '10px', normal: '11px', large: '13px', huge: '16px',
    };

    let html = '<table style="border-collapse:collapse">';
    for (let r = 0; r < table.rows; r++) {
      html += '<tr>';
      for (let c = 0; c < table.columns; c++) {
        const style = cellStyles[`${r}_${c}`] ?? {};
        const bg = style.bgColor ? `background:${style.bgColor};` : '';
        const tc = style.textColor ? `color:${style.textColor};` : '';
        const fs = style.textSize ? `font-size:${fontSizes[style.textSize] ?? '11px'};` : '';
        html += `<td style="padding:2px 6px;${bg}${tc}${fs}">${grid[r][c]}</td>`;
      }
      html += '</tr>';
    }
    html += '</table>';
    el.innerHTML = html;

    this.container.style.position = 'relative';
    this.container.appendChild(el);
    this.tableElement = el;
  }

  /**
   * Remove table overlay
   */
  clearTable(): void {
    if (this.tableElement) {
      this.tableElement.remove();
      this.tableElement = null;
    }
  }

  // ─── Existing methods ──────────────────────────────────────────────────

  /**
   * Add or update a histogram series (per-bar colored)
   */
  setHistogramData(
    id: string,
    data: Array<{ time: number; value: number; color?: string }>,
    config: SeriesConfig = {}
  ): void {
    let series = this.histogramSeriesMap.get(id);

    if (!series) {
      series = this.chart.addSeries(HistogramSeries, {
        color: config.color || '#26A69A',
        lastValueVisible: false,
        priceLineVisible: false,
      });

      const paneIndex = config.paneIndex ?? (config.overlay === false ? this.getNextPaneIndex() : 0);
      series.moveToPane(paneIndex);
      this.indicatorPanes.set(id, paneIndex);
      this.histogramSeriesMap.set(id, series);
    }

    const histData = data.filter(d =>
      d.value != null && !Number.isNaN(d.value)
    ) as HistogramData<Time>[];
    series.setData(histData);
  }

  /**
   * Remove all histogram series
   */
  clearHistograms(): void {
    for (const [id, series] of this.histogramSeriesMap) {
      this.chart.removeSeries(series);
      this.indicatorPanes.delete(id);
    }
    this.histogramSeriesMap.clear();
  }

  /**
   * Get the next available pane index
   */
  private getNextPaneIndex(): number {
    const usedPanes = new Set(this.indicatorPanes.values());
    let nextPane = 1;
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
   * Draw horizontal lines (hlines) in a specific pane
   */
  setHLines(hlines: HLineConfig[], paneIndex: number, bars: Bar[]): void {
    this.clearHLines();
    if (!bars.length) return;
    const firstTime = bars[0].time as unknown as Time;
    const lastTime = bars[bars.length - 1].time as unknown as Time;

    const lineStyleMap: Record<string, LineStyle> = {
      solid: LineStyle.Solid,
      dashed: LineStyle.Dashed,
      dotted: LineStyle.Dotted,
    };

    for (const hline of hlines) {
      const series = this.chart.addSeries(LineSeries, {
        color: hline.color ?? '#787B86',
        lineWidth: (hline.linewidth ?? 1) as 1 | 2 | 3 | 4,
        lineStyle: lineStyleMap[hline.linestyle ?? 'solid'] ?? LineStyle.Solid,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
      });
      series.moveToPane(paneIndex);
      series.setData([
        { time: firstTime, value: hline.price },
        { time: lastTime, value: hline.price },
      ] as LineData<Time>[]);
      this.hlineSeries.set(hline.id, series);
    }
  }

  /**
   * Remove all hline series
   */
  clearHLines(): void {
    for (const [, series] of this.hlineSeries) {
      this.chart.removeSeries(series);
    }
    this.hlineSeries.clear();
  }

  /**
   * Draw filled regions between hline pairs using BaselineSeries
   */
  setFills(fills: FillConfig[], hlines: HLineConfig[], paneIndex: number, bars: Bar[]): void {
    this.clearFills();
    if (!bars.length) return;
    const firstTime = bars[0].time as unknown as Time;
    const lastTime = bars[bars.length - 1].time as unknown as Time;

    const hlineMap = new Map(hlines.map(h => [h.id, h.price]));

    for (const fill of fills) {
      const price1 = hlineMap.get(fill.plot1);
      const price2 = hlineMap.get(fill.plot2);
      if (price1 == null || price2 == null) continue;

      const upperPrice = Math.max(price1, price2);
      const lowerPrice = Math.min(price1, price2);
      const color = fill.color ?? 'rgba(41,98,255,0.1)';

      const series = this.chart.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: lowerPrice },
        topFillColor1: color,
        topFillColor2: color,
        bottomFillColor1: 'transparent',
        bottomFillColor2: 'transparent',
        topLineColor: 'transparent',
        bottomLineColor: 'transparent',
        lineVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      series.moveToPane(paneIndex);
      series.setData([
        { time: firstTime, value: upperPrice },
        { time: lastTime, value: upperPrice },
      ] as BaselineData<Time>[]);
      this.fillSeries.set(fill.id, series);
    }
  }

  /**
   * Remove all fill series
   */
  clearFills(): void {
    for (const [, series] of this.fillSeries) {
      this.chart.removeSeries(series);
    }
    this.fillSeries.clear();
  }

  /**
   * Remove all indicator series and display components
   */
  clearIndicators(): void {
    for (const [, series] of this.indicatorSeries) {
      this.chart.removeSeries(series);
    }
    this.indicatorSeries.clear();
    this.indicatorPanes.clear();
    this.clearAreaSeries();
    this.clearCrossPlots();
    this.clearLineBrPlots();
    this.clearHistograms();
    this.clearHLines();
    this.clearFills();
    this.clearPlotFills();
    this.clearMarkers();
    this.clearBarColors();
    this.clearBgColors();
    this.clearCandlePlots();
    this.clearLabels();
    this.clearLineDrawings();
    this.clearBoxes();
    this.clearTable();

    // Remove empty panes (keep pane 0 which is the main price chart)
    this.removeEmptyPanes();
  }

  /**
   * Draw filled cloud/band between two plot series using stacked AreaSeries
   */
  setPlotFills(
    fills: FillData[],
    plotData: Record<string, Array<{ time: number; value: number }>>,
    paneIndex: number
  ): void {
    this.clearPlotFills();

    for (const fill of fills) {
      const p1Data = plotData[fill.plot1];
      const p2Data = plotData[fill.plot2];
      if (!p1Data?.length || !p2Data?.length) continue;

      // Resolve fill color with alpha
      let fillColor: string;
      if (fill.options?.color) {
        const transp = fill.options.transp;
        if (transp != null) {
          const alpha = Math.round((1 - transp / 100) * 255);
          fillColor = fill.options.color + alpha.toString(16).padStart(2, '0');
        } else {
          fillColor = fill.options.color + '40';
        }
      } else {
        fillColor = '#2962FF40';
      }

      // Build per-bar fill data aligned by time (skip bars where either value is NaN)
      const p2Map = new Map(p2Data.map(d => [d.time, d.value]));
      const fillBars: PlotFillBar[] = [];
      for (const d1 of p1Data) {
        const v1 = d1.value;
        const v2 = p2Map.get(d1.time);
        if (v1 == null || v2 == null || Number.isNaN(v1) || Number.isNaN(v2)) continue;
        fillBars.push({
          time: d1.time,
          upper: Math.max(v1, v2),
          lower: Math.min(v1, v2),
        });
      }
      if (!fillBars.length) continue;

      // Create anchor series + primitive for this fill
      const anchor = this.chart.addSeries(LineSeries, {
        color: 'transparent',
        lineVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        crosshairMarkerVisible: false,
      });
      anchor.moveToPane(paneIndex);
      // Set anchor data to all valid fill bars so price scale includes the fill range
      anchor.setData(fillBars.map(b => ({ time: b.time as unknown as Time, value: b.upper })));

      const primitive = new PlotFillPrimitive();
      primitive.setData(fillBars, fillColor);
      anchor.attachPrimitive(primitive);

      this.plotFillPrimitives.push(primitive);
      this.plotFillAnchorSeries.push(anchor);
    }
  }

  /**
   * Remove all plot-to-plot fill primitives
   */
  clearPlotFills(): void {
    for (let i = 0; i < this.plotFillAnchorSeries.length; i++) {
      const series = this.plotFillAnchorSeries[i];
      const primitive = this.plotFillPrimitives[i];
      if (primitive) {
        series.detachPrimitive(primitive);
      }
      this.chart.removeSeries(series);
    }
    this.plotFillPrimitives = [];
    this.plotFillAnchorSeries = [];
  }

  /**
   * Remove any empty panes except the main chart (pane 0)
   */
  private removeEmptyPanes(): void {
    const panes = this.chart.panes();
    for (let i = panes.length - 1; i > 0; i--) {
      const pane = panes[i];
      const seriesInPane = pane.getSeries();
      if (seriesInPane.length === 0) {
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
