/**
 * Primitives and drawing functions of the indicator renderer: plots that lightweight-charts cannot draw (line breaks,
 * crosses, fills between plots, backgrounds), markers beyond the markers plugin, and the drawings of a result
 * (labels, lines, boxes, linefills, polylines, arrows, tables). They draw in the pane of the series they are attached
 * to; times after the last bar are placed by BarGrid.
 */
import type {
  IChartApi,
  ISeriesApi,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  LineData,
  Time,
  SeriesType,
  AutoscaleInfo,
  Logical,
} from 'lightweight-charts';
import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import { barInterval } from 'oakscriptjs';
import type { Bar, FillData, ArrowData } from 'oakscriptjs';
import type {
  BgColorData,
  LabelData,
  LineDrawingData,
  BoxData,
  LinefillData,
  PolylineData,
  TableData,
  MarkerData,
  PineSize,
} from '../types';
import { isTransparent, parseColor, type GradientPart, gradientPart } from './color';

// ─── Bar grid (bars after the last bar) ────────────────────────────────────

/**
 * Bar slots after the last bar of a time after it, on the host's calendar: the number of future bars that open after
 * the last bar and at or before `time` (the slot of the bar that holds the time). `lastTime` and `time` in the units
 * of the bar times.
 */
export type FutureSlots = (time: number, lastTime: number) => number;

/** The x coordinates of a drawing are times given by the script (xloc.bar_time), not bar indexes */
export function scriptTimes(item: object): boolean {
  return (item as { xloc?: string }).xloc === 'bar_time';
}

/**
 * Bars of the chart and the slots after the last bar.
 * Indicators give points on future bars (Pine bar_index + k, plot offsets) the time lastTime + k * interval
 * (barTime): slot k. A drawing in script times (xloc.bar_time) may end at any later time: it is drawn on the slot of
 * the future bar that holds the time, counted on the host's calendar when it gives one (`futureSlots`: the trading
 * sessions, as the time scale of a stock skips nights, weekends and holidays), else one slot per bar interval of
 * calendar time. With extendTimeScale the renderer adds whitespace points up to the last slot drawn.
 */
export class BarGrid {
  bars: Bar[] = [];
  byTime = new Map<number, Bar>();
  interval = 0;
  /** Host's count of the bar slots after the last bar of a script time (null: calendar time) */
  futureSlots: FutureSlots | null = null;
  private slotCache = new Map<number, number>();

  setBars(bars: Bar[]): void {
    this.bars = bars;
    this.byTime = new Map(bars.map(b => [b.time, b]));
    this.interval = barInterval(bars);
    this.slotCache.clear();
  }

  /** Count the slots of script times with `futureSlots` from now on (null: calendar time) */
  setFutureSlots(futureSlots: FutureSlots | null): void {
    this.futureSlots = futureSlots;
    this.slotCache.clear();
  }

  get lastTime(): number {
    return this.bars.length ? this.bars[this.bars.length - 1].time : NaN;
  }

  /**
   * Bar slot after the last bar that holds `time` (0 when time is not after the last bar or the slot is unknown).
   * `script`: a time given by the script (xloc.bar_time), counted on the host's calendar.
   */
  slotsAfter(time: number, script = false): number {
    if (!(time > this.lastTime)) return 0;
    if (!script || !this.futureSlots) return this.interval > 0 ? Math.floor((time - this.lastTime) / this.interval + 1e-9) : 0;
    let k = this.slotCache.get(time);
    if (k === undefined) {
      k = this.futureSlots(time, this.lastTime);
      k = Number.isFinite(k) ? Math.max(0, Math.floor(k)) : 0;
      this.slotCache.set(time, k);
    }
    return k;
  }

  /** A time after the last bar moved to the time of its slot on the bar interval grid; other times unchanged */
  snap(time: number, script = false): number {
    if (!(time > this.lastTime) || !(this.interval > 0)) return time;
    return this.lastTime + this.slotsAfter(time, script) * this.interval;
  }

  /**
   * x coordinate of a time: its bar on the time scale, or for a time after the last bar, its slot counted from the
   * last bar (the time scale may hold whitespace points of other drawings after the last bar, not one per slot). Always
   * a whole bar position: the time scale places no fractional logical index (it answers 0 for one).
   */
  x(timeScale: ReturnType<IChartApi['timeScale']>, time: number, script = false): number | null {
    if (time > this.lastTime) {
      if (!(this.interval > 0) && !(script && this.futureSlots)) return null;
      const lastX = timeScale.timeToCoordinate(this.lastTime as unknown as Time);
      const lastLogical = lastX == null ? null : timeScale.coordinateToLogical(lastX);
      if (lastLogical == null) return null;
      const c = timeScale.logicalToCoordinate((Math.round(lastLogical) + this.slotsAfter(time, script)) as never);
      return c == null ? null : (c as number);
    }
    const x = timeScale.timeToCoordinate(time as unknown as Time);
    return x == null ? null : (x as number);
  }
}

/** Fill of a result; per-bar colours may hold na (null) values */
export type PlotFill = FillData & { colors?: Array<string | null | undefined> };

/** Gradient of a fill (FillData / FillConfig `gradient`), one entry per bar index; na: null / NaN */
export type FillGradientData = {
  topValue: Array<number | null | undefined>;
  bottomValue: Array<number | null | undefined>;
  topColor: Array<string | null | undefined>;
  bottomColor: Array<string | null | undefined>;
};

/** Gradient part of bar `i` of a gradient fill (null: nothing drawn on that part) */
export function gradientAt(g: FillGradientData, i: number): GradientPart | null {
  return gradientPart(g.topValue[i], g.bottomValue[i], g.topColor[i], g.bottomColor[i]);
}

/** Plot fill colour when the result gives none (renderer default, not a Pine value) */
export const DEFAULT_PLOT_FILL_COLOR = '#2962FF40';

/** Marker shapes of the lightweight-charts markers plugin */
export const BUILTIN_MARKER_SHAPES = new Set(['arrowUp', 'arrowDown', 'circle', 'square']);

/** Marker size multiplier of a Pine size */
export const PINE_SIZE_MULT: Record<PineSize, number> = { auto: 1, tiny: 0.5, small: 0.75, normal: 1, large: 1.5, huge: 2 };

export function markerSizeMult(size: MarkerData['size']): number {
  if (size == null) return 1;
  if (typeof size === 'number') return Math.max(0, size);
  return PINE_SIZE_MULT[size] ?? 1;
}

/** A price a drawing reaches on the k-th bar slot after the last bar */
export type FuturePrice = { slot: number; value: number };

/**
 * Anchor line data (invisible series that holds a primitive): one point per time, sorted, so the autoscale includes
 * the drawings. A point after the last bar is not a data point: the chart would take it as its last bar and move the
 * view when the study is added or removed (the reference keeps the view). It goes to `future` (its slot and price,
 * for the primitive's autoscale); when no point is on the bars, the first one is held on the last bar so the series
 * has data.
 */
export function anchorData(
  points: Array<{ time: number; value: number; script?: boolean }>,
  grid: BarGrid,
  future: FuturePrice[] = [],
): LineData<Time>[] {
  const byTime = new Map<number, number>();
  for (const p of points) {
    if (p.value == null || Number.isNaN(p.value) || p.time == null || Number.isNaN(p.time)) continue;
    if (p.time > grid.lastTime) {
      const slot = grid.slotsAfter(p.time, p.script);
      if (slot > 0) {
        future.push({ slot, value: p.value });
        continue;
      }
    }
    const t = grid.snap(p.time, p.script);
    if (!byTime.has(t)) byTime.set(t, p.value);
  }
  if (byTime.size === 0 && future.length && Number.isFinite(grid.lastTime)) byTime.set(grid.lastTime, future[0].value);
  return Array.from(byTime.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([t, v]) => ({ time: t as unknown as Time, value: v }));
}

// ─── Series Primitives ──────────────────────────────────────────────────────

/**
 * Base class for Series Primitives that need access to chart/series references
 */
export class BasePrimitive implements ISeriesPrimitive<Time> {
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
 * Per-point colours follow Pine: the segment that leads into a point has the colour of that point;
 * with steps, the horizontal part at the previous value keeps the previous
 * point colour and the vertical part into the point has the point colour.
 */
export class LineBrPrimitive extends BasePrimitive {
  private _data: Array<{ time: number; value: number; color?: string }> = [];
  private _color: string = '#2962FF';
  private _lineWidth: number = 2;
  private _lineStyle: number = 0; // LineStyle.Solid
  private _withSteps: boolean = false;
  private _views: IPrimitivePaneView[] = [new LineBrPaneView(this)];

  setData(data: Array<{ time: number; value: number; color?: string }>, color: string, lineWidth: number = 2, lineStyle: number = 0, withSteps: boolean = false): void {
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

export class LineBrPaneView implements IPrimitivePaneView {
  constructor(private _source: LineBrPrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new LineBrRenderer(this._source);
  }
}

export class LineBrRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: LineBrPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const data = this._source.getData();
    const defaultColor = this._source.getColor();
    const lineWidth = this._source.getLineWidth();
    const lineStyle = this._source.getLineStyle();
    const withSteps = this._source.getWithSteps();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      ctx.lineWidth = lineWidth;
      if (lineStyle === 1) { // Dashed
        ctx.setLineDash([4, 4]);
      } else if (lineStyle === 2) { // Dotted
        ctx.setLineDash([2, 2]);
      }

      // Path pieces of the same colour are stroked together (dash pattern continues along a run)
      let pathColor: string | null = null;
      const setColor = (color: string, x: number, y: number) => {
        if (color === pathColor) return;
        if (pathColor !== null) ctx.stroke();
        pathColor = color;
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y);
      };
      const flush = () => {
        if (pathColor !== null) ctx.stroke();
        pathColor = null;
      };

      let prev: { x: number; y: number; color: string } | null = null;
      for (const point of data) {
        const isNaN = point.value == null || Number.isNaN(point.value);
        const x = isNaN ? null : timeScale.timeToCoordinate(point.time as unknown as Time);
        const y = isNaN ? null : series.priceToCoordinate(point.value);
        if (x == null || y == null) {
          // gap: end the current line
          flush();
          prev = null;
          continue;
        }
        const color = point.color ?? defaultColor;
        if (prev) {
          if (withSteps) {
            setColor(prev.color, prev.x, prev.y);
            ctx.lineTo(x as number, prev.y);
            setColor(color, x as number, prev.y);
            ctx.lineTo(x as number, y as number);
          } else {
            setColor(color, prev.x, prev.y);
            ctx.lineTo(x as number, y as number);
          }
        }
        prev = { x: x as number, y: y as number, color };
      }
      flush();

      ctx.setLineDash([]);
    });
  }
}

/**
 * Cross marker plot style — draws X marks at data points
 */
export class CrossPlotPrimitive extends BasePrimitive {
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

export class CrossPlotPaneView implements IPrimitivePaneView {
  constructor(private _source: CrossPlotPrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new CrossPlotRenderer(this._source);
  }
}

export class CrossPlotRenderer implements IPrimitivePaneRenderer {
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
export class BgColorPrimitive extends BasePrimitive {
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

export class BgColorPaneView implements IPrimitivePaneView {
  constructor(private _source: BgColorPrimitive) {}

  zOrder(): 'bottom' { return 'bottom'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new BgColorRenderer(this._source);
  }
}

export class BgColorRenderer implements IPrimitivePaneRenderer {
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
 * Plot fill primitive: Pine fill(plot1, plot2, color) between two plots.
 * Pine fills the polygon between the two plot lines; the part between bar i - 1 and bar i has the colour of bar i,
 * and an na colour on
 * bar i removes that part only. A bar where either plot is na breaks the fill (fillgaps = false).
 * Gradient fills: the part between bar i - 1 and bar i gets the vertical gradient of bar i (a canvas linear
 * gradient from the y of top_value to the y of bottom_value; the canvas keeps the end colours outside it, which is
 * the Pine clamping), see drawGradient.
 * Drawn as a primitive (not AreaSeries pairs) to avoid masking overlay candlesticks.
 */
export interface PlotFillPoint {
  time: number;
  /** plot1 / plot2 values (NaN = na) */
  v1: number;
  v2: number;
  /** fill colour of the part that leads into this point (CSS colour with its final alpha); null = na, no fill */
  color: string | null;
  /**
   * Gradient fill (Pine fill(p1, p2, top_value, bottom_value, top_color, bottom_color)): gradient of the part that
   * leads into this point, used instead of `color`; null = nothing drawn on that part (see gradientPart)
   */
  gradient?: GradientPart | null;
}

export class PlotFillPrimitive extends BasePrimitive {
  private _data: PlotFillPoint[] = [];
  private _views: IPrimitivePaneView[] = [new PlotFillPaneView(this)];

  setData(data: PlotFillPoint[]): void {
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

export class PlotFillPaneView implements IPrimitivePaneView {
  constructor(private _source: PlotFillPrimitive) {}

  zOrder(): 'bottom' { return 'bottom'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new PlotFillRenderer(this._source);
  }
}

export class PlotFillRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: PlotFillPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const data = this._source.getData();
    const timeScale = chart.timeScale();
    const isGradient = data.some(p => p.gradient !== undefined);

    target.useMediaCoordinateSpace(({ context: ctx }) => {
      type Pt = { x: number; y1: number; y2: number };
      const pointAt = (p: PlotFillPoint): Pt | null => {
        if (!Number.isFinite(p.v1) || !Number.isFinite(p.v2)) return null;
        const x = timeScale.timeToCoordinate(p.time as unknown as Time);
        const y1 = series.priceToCoordinate(p.v1);
        const y2 = series.priceToCoordinate(p.v2);
        return x != null && y1 != null && y2 != null ? { x: x as number, y1: y1 as number, y2: y2 as number } : null;
      };

      if (isGradient) {
        this.drawGradient(ctx, data, pointAt, series);
        return;
      }

      // consecutive parts of the same colour are filled as one polygon (no seam between bars)
      let run: { color: string; pts: Pt[] } | null = null;
      const flush = () => {
        if (run && run.pts.length >= 2) {
          const pts = run.pts;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y1);
          for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y1);
          for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k].x, pts[k].y2);
          ctx.closePath();
          ctx.fillStyle = run.color;
          ctx.fill();
        }
        run = null;
      };

      let prev: Pt | null = null;
      for (const p of data) {
        const cur = pointAt(p);
        if (!cur) {
          flush();
          prev = null;
          continue;
        }
        if (prev && p.color) {
          if (!run || run.color !== p.color) {
            flush();
            run = { color: p.color, pts: [prev] };
          }
          run.pts.push(cur);
        } else {
          flush();
        }
        prev = cur;
      }
      flush();
    });
  }

  /**
   * Gradient fill: each stretch of bars where both plots have a value is clipped to its polygon, and each part
   * (bar i - 1 to bar i) is painted with the vertical gradient of bar i as a rectangle between the two bar x (rounded
   * to device pixels, so neighbour parts neither overlap nor leave a seam). Consecutive parts with the same gradient
   * share one rectangle.
   */
  private drawGradient(
    ctx: CanvasRenderingContext2D,
    data: PlotFillPoint[],
    pointAt: (p: PlotFillPoint) => { x: number; y1: number; y2: number } | null,
    series: ISeriesApi<SeriesType>
  ): void {
    type Pt = { x: number; y1: number; y2: number };
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const snap = (x: number) => Math.round(x * dpr) / dpr;
    const keyOf = (g: GradientPart) => `${g.top}|${g.bottom}|${g.topColor}|${g.bottomColor}`;

    const paintStretch = (pts: Pt[], parts: Array<GradientPart | null>) => {
      if (pts.length < 2) return;
      let yMin = Infinity;
      let yMax = -Infinity;
      for (const p of pts) {
        yMin = Math.min(yMin, p.y1, p.y2);
        yMax = Math.max(yMax, p.y1, p.y2);
      }
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y1);
      for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y1);
      for (let k = pts.length - 1; k >= 0; k--) ctx.lineTo(pts[k].x, pts[k].y2);
      ctx.closePath();
      ctx.clip();
      // parts[k] is the part from pts[k - 1] to pts[k]
      let k = 1;
      while (k < pts.length) {
        const g = parts[k];
        let end = k;
        if (g) {
          const key = keyOf(g);
          while (end + 1 < pts.length && parts[end + 1] && keyOf(parts[end + 1]!) === key) end++;
          const yTop = series.priceToCoordinate(g.top);
          const yBottom = series.priceToCoordinate(g.bottom);
          if (yTop != null && yBottom != null) {
            const grad = ctx.createLinearGradient(0, yTop as number, 0, yBottom as number);
            grad.addColorStop(0, g.topColor);
            grad.addColorStop(1, g.bottomColor);
            const x0 = snap(pts[k - 1].x);
            const x1 = snap(pts[end].x);
            ctx.fillStyle = grad;
            ctx.fillRect(x0, yMin - 1, x1 - x0, yMax - yMin + 2);
          }
        }
        k = end + 1;
      }
      ctx.restore();
    };

    let pts: Pt[] = [];
    let parts: Array<GradientPart | null> = [];
    for (const p of data) {
      const cur = pointAt(p);
      if (!cur) {
        paintStretch(pts, parts);
        pts = [];
        parts = [];
        continue;
      }
      pts.push(cur);
      parts.push(pts.length > 1 ? p.gradient ?? null : null);
    }
    paintStretch(pts, parts);
  }
}

/**
 * Extended marker primitive — draws the markers that the lightweight-charts markers plugin cannot draw:
 * shapes beyond the 4 built-in ones, a text colour different from the shape colour (Pine textcolor), shapes with
 * a transparent colour (Pine color = na: text only), multi-line text and label shapes (text inside the label).
 * Positions: aboveBar / belowBar / inBar next to the bar of the price series (markers of one bar stacked away from
 * the bar), atPriceTop / atPriceBottom / atPriceMiddle at marker.price (see MarkerData).
 * Pine layout: a label has its text inside and its tip on the bar / price;
 * other shapes have the text on the far side of the shape (above for abovebar, below for belowbar).
 */
export class ExtendedMarkerPrimitive extends BasePrimitive {
  private _markers: MarkerData[] = [];
  private _views: IPrimitivePaneView[] = [new ExtendedMarkerPaneView(this)];

  constructor(private _grid: BarGrid) {
    super();
  }

  setMarkers(markers: MarkerData[]): void {
    this._markers = markers;
    this._requestUpdate?.();
  }

  getMarkers() { return this._markers; }
  getGrid() { return this._grid; }
  getChart() { return this._chart; }
  getSeries() { return this._series; }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }
}

export class ExtendedMarkerPaneView implements IPrimitivePaneView {
  constructor(private _source: ExtendedMarkerPrimitive) {}

  zOrder(): 'normal' { return 'normal'; }

  renderer(): IPrimitivePaneRenderer | null {
    return new ExtendedMarkerRenderer(this._source);
  }
}

/** Font size (px) of the text of a marker */
export function markerFontSize(size: MarkerData['size']): number {
  if (typeof size === 'string') {
    return ({ tiny: 9, small: 10, normal: 12, large: 14, huge: 18, auto: 11 } as Record<string, number>)[size] ?? 11;
  }
  return Math.max(7, Math.round(11 * (size ?? 1)));
}

export const MARKER_BAR_GAP = 4; // px between the bar and the first marker
export const MARKER_STACK_GAP = 2; // px between two stacked markers
export const LABEL_PAD = 3;
export const LABEL_POINTER = 5;

export class ExtendedMarkerRenderer implements IPrimitivePaneRenderer {
  constructor(private _source: ExtendedMarkerPrimitive) {}

  draw(target: CanvasRenderingTarget2D): void {
    const chart = this._source.getChart();
    const series = this._source.getSeries();
    if (!chart || !series) return;

    const markers = this._source.getMarkers();
    const grid = this._source.getGrid();
    const timeScale = chart.timeScale();

    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      // height already used above / below each bar (and from the pane top / bottom) by earlier markers
      const usedAbove = new Map<number, number>();
      const usedBelow = new Map<number, number>();
      const usedTop = new Map<number, number>();
      const usedBottom = new Map<number, number>();

      for (const marker of markers) {
        const x = grid.x(timeScale, marker.time);
        if (x == null) continue;

        const mult = markerSizeMult(marker.size);
        const fontSize = markerFontSize(marker.size);
        const lineHeight = Math.round(fontSize * 1.2);
        const lines = marker.text ? marker.text.split('\n') : [];
        ctx.font = `${fontSize}px sans-serif`;
        const textWidth = lines.reduce((w, l) => Math.max(w, ctx.measureText(l).width), 0);
        const isLabel = marker.shape === 'labelUp' || marker.shape === 'labelDown';
        const half = 6 * mult; // half size of a shape
        const textH = lines.length ? 2 + lines.length * lineHeight : 0;

        // Height of the marker (shape and text)
        const height = isLabel
          ? Math.max(lines.length, 1) * lineHeight + LABEL_PAD * 2 + LABEL_POINTER
          : half * 2 + textH;

        // Anchor y and direction: -1 = the marker extends upward from the anchor, 1 = downward, 0 = centred
        let anchorY: number | null = null;
        let dir: -1 | 0 | 1 = 0;
        if (marker.position === 'top' || marker.position === 'bottom') {
          // pane edge: stacked from the top edge downward / from the bottom edge upward
          const edgeMap = marker.position === 'top' ? usedTop : usedBottom;
          const used = edgeMap.get(marker.time) ?? 0;
          edgeMap.set(marker.time, used + height + MARKER_STACK_GAP);
          anchorY = marker.position === 'top' ? MARKER_BAR_GAP + used : mediaSize.height - MARKER_BAR_GAP - used;
          dir = marker.position === 'top' ? 1 : -1;
        } else if (marker.position === 'atPriceTop' || marker.position === 'atPriceBottom' || marker.position === 'atPriceMiddle') {
          if (marker.price == null || Number.isNaN(marker.price)) continue;
          anchorY = series.priceToCoordinate(marker.price);
          dir = marker.position === 'atPriceTop' ? -1 : marker.position === 'atPriceBottom' ? 1 : 0;
        } else {
          const bar = grid.byTime.get(marker.time);
          if (!bar) continue;
          if (marker.position === 'aboveBar') {
            const y = series.priceToCoordinate(bar.high);
            if (y == null) continue;
            const used = usedAbove.get(marker.time) ?? 0;
            anchorY = (y as number) - MARKER_BAR_GAP - used;
            usedAbove.set(marker.time, used + height + MARKER_STACK_GAP);
            dir = -1;
          } else if (marker.position === 'belowBar') {
            const y = series.priceToCoordinate(bar.low);
            if (y == null) continue;
            const used = usedBelow.get(marker.time) ?? 0;
            anchorY = (y as number) + MARKER_BAR_GAP + used;
            usedBelow.set(marker.time, used + height + MARKER_STACK_GAP);
            dir = 1;
          } else {
            anchorY = series.priceToCoordinate(bar.close);
          }
        }
        if (anchorY == null) continue;
        const top = dir === -1 ? anchorY - height : dir === 1 ? anchorY : anchorY - height / 2;
        const showShape = !isTransparent(marker.color);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (isLabel) {
          // label: box with the text inside and a pointer (on top for labelUp, below for labelDown)
          const boxW = Math.max(textWidth + LABEL_PAD * 2, 2 * half);
          const boxH = height - LABEL_POINTER;
          const up = marker.shape === 'labelUp';
          const boxTop = up ? top + LABEL_POINTER : top;
          if (showShape) {
            ctx.fillStyle = marker.color;
            ctx.beginPath();
            ctx.roundRect(x - boxW / 2, boxTop, boxW, boxH, 2);
            ctx.fill();
            ctx.beginPath();
            if (up) {
              ctx.moveTo(x, top);
              ctx.lineTo(x - LABEL_POINTER, boxTop + 0.5);
              ctx.lineTo(x + LABEL_POINTER, boxTop + 0.5);
            } else {
              ctx.moveTo(x, top + height);
              ctx.lineTo(x - LABEL_POINTER, boxTop + boxH - 0.5);
              ctx.lineTo(x + LABEL_POINTER, boxTop + boxH - 0.5);
            }
            ctx.closePath();
            ctx.fill();
          }
          if (lines.length) {
            ctx.fillStyle = marker.textColor ?? '#ffffff';
            lines.forEach((l, k) => ctx.fillText(l, x, boxTop + LABEL_PAD + lineHeight * (k + 0.5)));
          }
          continue;
        }

        // other shapes: the shape on the anchor side, the text on the far side (above when the marker extends
        // upward, below otherwise)
        const shapeCy = dir === -1 ? top + textH + half : top + half;
        if (showShape && marker.char) {
          // plotchar: the character in place of the shape
          ctx.font = `${Math.round(half * 2.4)}px sans-serif`;
          ctx.fillStyle = marker.color;
          ctx.fillText(marker.char, x, shapeCy);
          ctx.font = `${fontSize}px sans-serif`;
        } else if (showShape) {
          ctx.fillStyle = marker.color;
          ctx.strokeStyle = marker.color;
          ctx.lineWidth = 2;
          drawExtendedShape(ctx, marker.shape, x, shapeCy, half);
        }
        if (lines.length) {
          ctx.fillStyle = marker.textColor ?? marker.color;
          const textTop = dir === -1 ? top : top + half * 2 + 2;
          lines.forEach((l, k) => ctx.fillText(l, x, textTop + lineHeight * (k + 0.5)));
        }
      }
    });
  }
}

export function drawExtendedShape(
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
      // Draw pole (centred on y)
      ctx.beginPath();
      ctx.moveTo(x, y + size);
      ctx.lineTo(x, y - size);
      ctx.stroke();
      // Draw flag pennant
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size * 1.5, y - size * 0.5);
      ctx.lineTo(x, y);
      ctx.closePath();
      ctx.fill();
      break;
    // built-in lightweight-charts shapes, drawn here when the marker needs this primitive (text colour, ...)
    case 'circle':
      ctx.beginPath();
      ctx.arc(x, y, size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'square':
      ctx.fillRect(x - size * 0.8, y - size * 0.8, size * 1.6, size * 1.6);
      break;
    case 'arrowUp':
    case 'arrowDown': {
      const d = shape === 'arrowUp' ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y + d * size);
      ctx.lineTo(x - size * 0.8, y);
      ctx.lineTo(x - size * 0.3, y);
      ctx.lineTo(x - size * 0.3, y - d * size);
      ctx.lineTo(x + size * 0.3, y - d * size);
      ctx.lineTo(x + size * 0.3, y);
      ctx.lineTo(x + size * 0.8, y);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

// ─── Drawings (label.new / line.new / box.new / linefill.new / polyline.new) ─

/**
 * PineScript default colour of drawings (color.blue). Drawing properties follow the oakscriptjs rules: a property
 * the script did not set is omitted and the PineScript default applies; a colour set to na is 'transparent'.
 */
export const PINE_BLUE = '#2962FF';

/**
 * Text colours of drawings whose result omits them: the defaults of PineScript v6 (the current language version).
 * - label text (label.new without textcolor): color.white; scripts of v4 and v5 draw it with color.black (#363A45)
 * - box text (box.new without text_color): color.white; scripts of v5 draw it with color.black (#363A45)
 * - table cell text (table.cell without text_color): color.black (#363A45) in every version
 * The result does not carry the language version: a port of an older script sets the colour of its version.
 * (color.blue is also #2196F3 instead of #2962FF in v4: a port of a v4 script sets the colour of a label, line or
 * box that the script leaves out.)
 */
export const DEFAULT_LABEL_TEXT_COLOR = '#FFFFFF';
export const DEFAULT_BOX_TEXT_COLOR = '#FFFFFF';
export const DEFAULT_TABLE_TEXT_COLOR = '#363A45';

/** Context of a drawing function (media coordinates) */
export interface DrawEnv {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  series: ISeriesApi<SeriesType, Time>;
  grid: BarGrid;
  timeScale: ReturnType<IChartApi['timeScale']>;
}

/**
 * Primitive that draws a list of drawings of one kind with its draw function.
 */
export class DrawingPrimitive<T> extends BasePrimitive {
  private _views: IPrimitivePaneView[];

  constructor(
    private _grid: BarGrid,
    private _items: T[],
    private _draw: (env: DrawEnv, item: T) => void,
    zOrder: 'bottom' | 'normal' | 'top',
    private _future: FuturePrice[] = []
  ) {
    super();
    const renderer: IPrimitivePaneRenderer = { draw: (target) => this.drawAll(target) };
    this._views = [{ zOrder: () => zOrder, renderer: () => renderer }];
  }

  updateAllViews(): void {}

  /** Prices the drawings reach on the visible bar slots after the last bar (they are not points of the anchor) */
  autoscaleInfo(startTimePoint: Logical, endTimePoint: Logical): AutoscaleInfo | null {
    if (!this._future.length || !this._chart) return null;
    const last = this._chart.timeScale().timeToIndex(this._grid.lastTime as unknown as Time, false);
    if (last == null) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const f of this._future) {
      const i = last + f.slot;
      if (i < startTimePoint || i > endTimePoint) continue;
      if (f.value < min) min = f.value;
      if (f.value > max) max = f.value;
    }
    return min <= max ? { priceRange: { minValue: min, maxValue: max } } : null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }

  private drawAll(target: CanvasRenderingTarget2D): void {
    const chart = this._chart;
    const series = this._series;
    if (!chart || !series) return;
    const timeScale = chart.timeScale();
    target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
      const env: DrawEnv = { ctx, width: mediaSize.width, height: mediaSize.height, series, grid: this._grid, timeScale };
      for (const item of this._items) {
        ctx.save();
        this._draw(env, item);
        ctx.restore();
      }
    });
  }
}

/** A colour that draws something: set and not fully transparent */
export function shown(color: string | undefined): color is string {
  return !!color && !isTransparent(color);
}

/** Canvas dash of a PineScript line style (the arrow styles are solid) */
export function lineDash(style: string | undefined): number[] {
  if (style === 'dashed') return [6, 3];
  if (style === 'dotted') return [2, 2];
  return [];
}

/** Font size (px) of label and box text */
export const TEXT_SIZES: Record<PineSize, number> = { auto: 13, tiny: 9, small: 11, normal: 13, large: 16, huge: 20 };

/** Font size (px) of a PineScript size: a size.* constant or a size in points */
export function textPx(size: PineSize | number | undefined): number {
  if (typeof size === 'number') return Math.max(1, size);
  return TEXT_SIZES[size ?? 'normal'] ?? 13;
}

/** Canvas / CSS font: PineScript font family (font.family_*) and text.format_* flags (1 bold, 2 italic) */
export function fontOf(px: number, family?: 'default' | 'monospace', formatting?: number): string {
  const f = formatting ?? 0;
  return `${f & 2 ? 'italic ' : ''}${f & 1 ? 'bold ' : ''}${px}px ${family === 'monospace' ? 'monospace' : 'sans-serif'}`;
}

/** Open arrow head at (tipX, tipY), pointing away from (fromX, fromY) */
export function arrowHead(ctx: CanvasRenderingContext2D, tipX: number, tipY: number, fromX: number, fromY: number, width: number): void {
  const a = Math.atan2(tipY - fromY, tipX - fromX);
  const len = 6 + 2 * width;
  ctx.beginPath();
  ctx.moveTo(tipX - len * Math.cos(a - Math.PI / 7), tipY - len * Math.sin(a - Math.PI / 7));
  ctx.lineTo(tipX, tipY);
  ctx.lineTo(tipX - len * Math.cos(a + Math.PI / 7), tipY - len * Math.sin(a + Math.PI / 7));
  ctx.stroke();
}

/**
 * End points (x1, y1, x2, y2) of a line as drawn: point 1 and point 2, moved to the left / right edge of the pane by
 * the line extension (extend.left continues the line beyond its left point). null when a point is not on the chart.
 */
export function linePoints(env: DrawEnv, line: LineDrawingData): [number, number, number, number] | null {
  const script = scriptTimes(line);
  const x1 = env.grid.x(env.timeScale, line.time1, script);
  const y1 = env.series.priceToCoordinate(line.price1);
  const x2 = env.grid.x(env.timeScale, line.time2, script);
  const y2 = env.series.priceToCoordinate(line.price2);
  if (x1 == null || y1 == null || x2 == null || y2 == null) return null;
  const extend = line.extend ?? 'none';
  const left = extend === 'left' || extend === 'both';
  const right = extend === 'right' || extend === 'both';
  if (x1 === x2) {
    // vertical line: an extension continues it to the pane edges
    return extend === 'none' ? [x1, y1, x2, y2] : [x1, y1 <= y2 ? 0 : env.height, x2, y1 <= y2 ? env.height : 0];
  }
  const slope = (y2 - y1) / (x2 - x1);
  let [ax, ay, bx, by]: number[] = x1 < x2 ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
  if (left) { ay -= slope * ax; ax = 0; }
  if (right) { by += slope * (env.width - bx); bx = env.width; }
  return x1 < x2 ? [ax, ay, bx, by] : [bx, by, ax, ay];
}

export function drawLine(env: DrawEnv, line: LineDrawingData): void {
  const color = line.color ?? PINE_BLUE;
  const width = line.width ?? 1;
  const p = linePoints(env, line);
  if (!p || !shown(color) || width <= 0) return;
  const { ctx } = env;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(lineDash(line.style));
  ctx.beginPath();
  ctx.moveTo(p[0], p[1]);
  ctx.lineTo(p[2], p[3]);
  ctx.stroke();
  ctx.setLineDash([]);
  if (line.style === 'arrow_left' || line.style === 'arrow_both') arrowHead(ctx, p[0], p[1], p[2], p[3], width);
  if (line.style === 'arrow_right' || line.style === 'arrow_both') arrowHead(ctx, p[2], p[3], p[0], p[1], width);
}

/** linefill.new: the area between the two lines as drawn (their extensions included) */
export function drawLinefill(env: DrawEnv, fill: LinefillData): void {
  const color = fill.color ?? PINE_BLUE;
  if (!shown(color)) return;
  const a = linePoints(env, fill.line1);
  const b = linePoints(env, fill.line2);
  if (!a || !b) return;
  // each line from its left point to its right point, so the polygon does not cross itself
  const [al, ar] = a[0] <= a[2] ? [[a[0], a[1]], [a[2], a[3]]] : [[a[2], a[3]], [a[0], a[1]]];
  const [bl, br] = b[0] <= b[2] ? [[b[0], b[1]], [b[2], b[3]]] : [[b[2], b[3]], [b[0], b[1]]];
  const { ctx } = env;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(al[0], al[1]);
  ctx.lineTo(ar[0], ar[1]);
  ctx.lineTo(br[0], br[1]);
  ctx.lineTo(bl[0], bl[1]);
  ctx.closePath();
  ctx.fill();
}

/** Path through the points: straight segments, or a curve through the points (Catmull-Rom spline) */
export function polylinePath(pts: Array<[number, number]>, curved: boolean, closed: boolean): Path2D {
  const path = new Path2D();
  path.moveTo(pts[0][0], pts[0][1]);
  const n = pts.length;
  if (!curved) {
    for (let i = 1; i < n; i++) path.lineTo(pts[i][0], pts[i][1]);
  } else {
    const at = (i: number) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
      path.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1]
      );
    }
  }
  if (closed) path.closePath();
  return path;
}

/** polyline.new: line through the points (curved, closed), fill of the area inside */
export function drawPolyline(env: DrawEnv, poly: PolylineData): void {
  const pts: Array<[number, number]> = [];
  const script = scriptTimes(poly);
  for (const p of poly.points) {
    const x = env.grid.x(env.timeScale, p.time, script);
    const y = env.series.priceToCoordinate(p.price);
    if (x != null && y != null) pts.push([x, y as number]);
  }
  if (pts.length < 2) return;
  const { ctx } = env;
  const path = polylinePath(pts, !!poly.curved, !!poly.closed);
  if (shown(poly.fillColor)) {
    ctx.fillStyle = poly.fillColor;
    ctx.fill(path);
  }
  const color = poly.lineColor ?? PINE_BLUE;
  const width = poly.lineWidth ?? 1;
  if (!shown(color) || width <= 0) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(lineDash(poly.lineStyle));
  ctx.stroke(path);
  ctx.setLineDash([]);
  if (poly.closed) return;
  const n = pts.length;
  if (poly.lineStyle === 'arrow_left' || poly.lineStyle === 'arrow_both') arrowHead(ctx, pts[0][0], pts[0][1], pts[1][0], pts[1][1], width);
  if (poly.lineStyle === 'arrow_right' || poly.lineStyle === 'arrow_both') {
    arrowHead(ctx, pts[n - 1][0], pts[n - 1][1], pts[n - 2][0], pts[n - 2][1], width);
  }
}

/** The arrows of one plotarrow */
export interface ArrowSeries {
  arrows: ArrowData[];
  minheight: number;
  maxheight: number;
  forceOverlay: boolean;
  /** Drawn at the bars (price pane); otherwise from the pane edge */
  onBars: boolean;
}

/**
 * plotarrow: an up arrow for a positive value (below the bar, pointing up), a down arrow for a negative value (above
 * the bar, pointing down). Length lo + |value| * (hi - lo) / largest, where lo / hi are minheight / maxheight and
 * largest is the largest |value| of the arrows on the visible bars. Width and gap to the bar follow the bar spacing:
 * below 4 px of width a line arrow (head, shaft, tail bar), else a filled arrow with an outline at the fill's
 * transparency. In an indicator pane (not on the bars) the arrows start at the pane edge.
 */
export function drawArrowSeries(env: DrawEnv, s: ArrowSeries): void {
  const visible: Array<{ a: ArrowData; x: number }> = [];
  for (const a of s.arrows) {
    const x = env.grid.x(env.timeScale, a.time as number);
    if (x != null && x >= 0 && x <= env.width && a.value !== 0 && Number.isFinite(a.value)) visible.push({ a, x });
  }
  if (!visible.length) return;
  const largest = visible.reduce((m, p) => Math.max(m, Math.abs(p.a.value)), 0);
  if (!largest) return;
  const lo = Math.min(Math.abs(s.minheight), Math.abs(s.maxheight));
  const hi = Math.max(Math.abs(s.minheight), Math.abs(s.maxheight));
  const barSpacing = env.timeScale.options().barSpacing;
  const width = Math.round(barSpacing / 2);
  const gap = Math.round(barSpacing / 4);
  const { ctx } = env;
  for (const { a, x } of visible) {
    if (!shown(a.color)) continue;
    const up = a.value > 0;
    const len = Math.round((Math.abs(a.value) * (hi - lo)) / largest + lo);
    // dir: 1 = the arrow body extends downwards (an up arrow under the low)
    const dir = up ? 1 : -1;
    let tipY: number;
    if (s.onBars) {
      const bar = env.grid.byTime.get(a.time as number);
      const y = bar ? env.series.priceToCoordinate(up ? bar.low : bar.high) : null;
      if (y == null) continue;
      tipY = (y as number) + dir * gap;
    } else {
      tipY = up ? env.height - gap - len : gap + len;
    }
    ctx.save();
    ctx.translate(Math.round(x), Math.round(tipY));
    ctx.beginPath();
    if (width < 4) {
      // line arrow: head lines, shaft, tail bar
      const half = Math.max(1, Math.round(width / 2));
      ctx.moveTo(-half, dir * half);
      ctx.lineTo(0, 0);
      ctx.lineTo(half, dir * half);
      ctx.moveTo(0, 0);
      ctx.lineTo(0, dir * len);
      ctx.moveTo(-half, dir * len);
      ctx.lineTo(half, dir * len);
      ctx.lineWidth = Math.max(1, Math.round(width / 2));
      ctx.lineCap = 'butt';
      ctx.strokeStyle = a.color;
      ctx.stroke();
    } else {
      const headHalf = width;
      const shaftHalf = Math.max(1, Math.round(headHalf / 2));
      const headLen = width;
      ctx.moveTo(0, 0);
      if (len < headLen) {
        ctx.lineTo(headHalf, dir * len);
        ctx.lineTo(-headHalf, dir * len);
      } else {
        ctx.lineTo(headHalf, dir * headLen);
        ctx.lineTo(shaftHalf, dir * headLen);
        ctx.lineTo(shaftHalf, dir * len);
        ctx.lineTo(-shaftHalf, dir * len);
        ctx.lineTo(-shaftHalf, dir * headLen);
        ctx.lineTo(-headHalf, dir * headLen);
      }
      ctx.closePath();
      // outline first, the fill over its inner half
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(0, 0, 0, ${parseColor(a.color)?.a ?? 1})`;
      ctx.stroke();
      ctx.fillStyle = a.color;
      ctx.fill();
    }
    ctx.restore();
  }
}

export const BOX_TEXT_PAD = 4;

/** Words of a text line wrapped to `width` (PineScript text.wrap_auto) */
export function wrapLine(ctx: CanvasRenderingContext2D, line: string, width: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const word of line.split(' ')) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && ctx.measureText(next).width > width) {
      out.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  out.push(cur);
  return out;
}

/** Text of a box (clipped to the box): size auto fits the text in the box */
export function drawBoxText(ctx: CanvasRenderingContext2D, box: BoxData, left: number, top: number, w: number, h: number): void {
  const color = box.textColor ?? DEFAULT_BOX_TEXT_COLOR;
  if (!box.text || !shown(color)) return;
  const innerW = w - BOX_TEXT_PAD * 2;
  const innerH = h - BOX_TEXT_PAD * 2;
  if (innerW <= 0 || innerH <= 0) return;
  let lines = box.text.split('\n');
  let px: number;
  if (box.textSize == null || box.textSize === 'auto') {
    // largest size (up to 64 px) at which the lines fit in the box
    ctx.font = fontOf(100, box.fontFamily, box.textFormatting);
    const widest = lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) / 100;
    px = Math.min(64, innerH / (lines.length * 1.2), widest > 0 ? innerW / widest : 64);
    if (px < 4) return;
  } else {
    px = textPx(box.textSize);
  }
  ctx.font = fontOf(px, box.fontFamily, box.textFormatting);
  if (box.textWrap === 'auto') lines = lines.flatMap((l) => wrapLine(ctx, l, innerW));
  const lineHeight = px * 1.2;
  const textH = lines.length * lineHeight;
  const valign = box.textVAlign ?? 'center';
  const halign = box.textHAlign ?? 'center';
  const y0 = valign === 'top' ? top + BOX_TEXT_PAD : valign === 'bottom' ? top + h - BOX_TEXT_PAD - textH : top + (h - textH) / 2;
  const x = halign === 'left' ? left + BOX_TEXT_PAD : halign === 'right' ? left + w - BOX_TEXT_PAD : left + w / 2;
  ctx.beginPath();
  ctx.rect(left, top, w, h);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.textAlign = halign;
  ctx.textBaseline = 'middle';
  lines.forEach((l, k) => ctx.fillText(l, x, y0 + lineHeight * (k + 0.5)));
}

export function drawBox(env: DrawEnv, box: BoxData): void {
  const script = scriptTimes(box);
  const x1 = env.grid.x(env.timeScale, box.time1, script);
  const y1 = env.series.priceToCoordinate(box.price1);
  const x2 = env.grid.x(env.timeScale, box.time2, script);
  const y2 = env.series.priceToCoordinate(box.price2);
  if (x1 == null || y1 == null || x2 == null || y2 == null) return;
  const { ctx } = env;

  // PineScript box extend: the box continues to the left / right edge of the pane
  const extend = box.extend ?? 'none';
  const left = extend === 'left' || extend === 'both' ? 0 : Math.min(x1, x2);
  const right = extend === 'right' || extend === 'both' ? env.width : Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const width = right - left;
  const height = Math.abs(y2 - y1);

  const bg = box.bgColor ?? PINE_BLUE;
  if (shown(bg)) {
    ctx.fillStyle = bg;
    ctx.fillRect(left, top, width, height);
  }
  const border = box.borderColor ?? PINE_BLUE;
  const borderWidth = box.borderWidth ?? 1;
  if (shown(border) && borderWidth > 0) {
    ctx.strokeStyle = border;
    ctx.lineWidth = borderWidth;
    ctx.setLineDash(lineDash(box.borderStyle));
    ctx.strokeRect(left, top, width, height);
    ctx.setLineDash([]);
  }
  drawBoxText(ctx, box, left, top, width, height);
}

export const LABEL_BAR_GAP = 4; // px between the bar and a yloc.abovebar / belowbar label
export const LABEL_PADDING = 4;
export const LABEL_TIP = 6;

/** Label styles drawn as a shape (label.style_xcross ...): marker shape name */
export const LABEL_SHAPES: Record<string, string> = {
  xcross: 'xcross', cross: 'cross', triangleup: 'triangleUp', triangledown: 'triangleDown', flag: 'flag',
  circle: 'circle', arrowup: 'arrowUp', arrowdown: 'arrowDown', square: 'square', diamond: 'diamond',
};

/** Half size (px) of a label shape */
export const LABEL_SHAPE_HALF: Record<PineSize, number> = { auto: 5, tiny: 3, small: 4, normal: 6, large: 9, huge: 13 };

/** Corner label styles: side of the box from the point (x: 1 right, -1 left; y: 1 below, -1 above) */
export const LABEL_CORNERS: Record<string, [number, number]> = {
  label_lower_left: [1, -1], label_lower_right: [-1, -1], label_upper_left: [1, 1], label_upper_right: [-1, 1],
};

/**
 * Label geometry (PineScript label styles, default label_down): label_down = box above the point with a tip down to
 * it, label_up = box below with a tip up, label_left / label_right = box right / left of the point, the corner styles
 * (label_lower_left ...) = box with that corner at the point, label_center = box centred on the point; the shape
 * styles (xcross, triangleup, ...) draw the shape at the point with the text above it (below for arrowup /
 * triangleup); none = text only; text_outline = text outlined with the label colour. yloc abovebar / belowbar: the
 * point is the bar high / low, and a centred box, a shape or a text is moved above / below it.
 */
export function drawLabel(env: DrawEnv, label: LabelData): void {
  const x = env.grid.x(env.timeScale, label.time, scriptTimes(label));
  if (x == null) return;
  const yloc = label.yloc ?? 'price';
  let y: number | null;
  if (yloc === 'price') {
    y = env.series.priceToCoordinate(label.price);
  } else {
    const bar = env.grid.byTime.get(label.time);
    if (!bar) return;
    const by = env.series.priceToCoordinate(yloc === 'abovebar' ? bar.high : bar.low);
    y = by == null ? null : (by as number) + (yloc === 'abovebar' ? -LABEL_BAR_GAP : LABEL_BAR_GAP);
  }
  if (y == null) return;

  const { ctx } = env;
  const style = label.style ?? 'label_down';
  const color = label.color ?? PINE_BLUE;
  const textColor = label.textColor ?? DEFAULT_LABEL_TEXT_COLOR;
  const px = textPx(label.size);
  ctx.font = fontOf(px, label.fontFamily, label.textFormatting);
  const lines = label.text.split('\n');
  const lineHeight = Math.round(px * 1.2);
  const textWidth = lines.reduce((w, l) => Math.max(w, ctx.measureText(l).width), 0);
  const textH = lines.length * lineHeight;
  const align = label.textAlign ?? 'center';

  // text lines in the column [left, left + w] from `top`; outline: stroke with `outline` before the fill
  const writeLines = (left: number, w: number, top: number, outline?: string) => {
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    const tx = align === 'left' ? left : align === 'right' ? left + w : left + w / 2;
    lines.forEach((l, k) => {
      const ty = top + lineHeight * (k + 0.5);
      if (outline) {
        ctx.strokeStyle = outline;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeText(l, tx, ty);
      }
      if (shown(textColor)) {
        ctx.fillStyle = textColor;
        ctx.fillText(l, tx, ty);
      }
    });
  };

  const shape = LABEL_SHAPES[style];
  if (shape) {
    const half = typeof label.size === 'number' ? Math.max(2, label.size / 2) : LABEL_SHAPE_HALF[label.size ?? 'normal'] ?? 6;
    const cy = yloc === 'abovebar' ? y - half : yloc === 'belowbar' ? y + half : y;
    if (shown(color)) {
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      drawExtendedShape(ctx, shape, x, cy, half);
    }
    const below = style === 'arrowup' || style === 'triangleup';
    writeLines(x - textWidth / 2, textWidth, below ? cy + half + 2 : cy - half - 2 - textH);
    return;
  }

  if (style === 'none' || style === 'text_outline') {
    const top = yloc === 'abovebar' ? y - textH : yloc === 'belowbar' ? y : y - textH / 2;
    writeLines(x - textWidth / 2, textWidth, top, style === 'text_outline' && shown(color) ? color : undefined);
    return;
  }

  // box styles: box position (left, top) and the tip triangle
  const w = textWidth + LABEL_PADDING * 2;
  const h = textH + LABEL_PADDING * 2;
  let left = x - w / 2;
  let top = y - h / 2;
  let tip: Array<[number, number]> | null = null;
  const corner = LABEL_CORNERS[style];
  if (style === 'label_down') {
    top = y - LABEL_TIP - h;
    tip = [[x, y], [x - LABEL_TIP, top + h - 0.5], [x + LABEL_TIP, top + h - 0.5]];
  } else if (style === 'label_up') {
    top = y + LABEL_TIP;
    tip = [[x, y], [x - LABEL_TIP, top + 0.5], [x + LABEL_TIP, top + 0.5]];
  } else if (style === 'label_left') {
    left = x + LABEL_TIP;
    tip = [[x, y], [left + 0.5, y - LABEL_TIP], [left + 0.5, y + LABEL_TIP]];
  } else if (style === 'label_right') {
    left = x - LABEL_TIP - w;
    tip = [[x, y], [left + w - 0.5, y - LABEL_TIP], [left + w - 0.5, y + LABEL_TIP]];
  } else if (corner) {
    const [sx, sy] = corner;
    const cx = x + sx * LABEL_TIP;
    const cy = y + sy * LABEL_TIP;
    left = sx > 0 ? cx : cx - w;
    top = sy > 0 ? cy : cy - h;
    tip = [[x, y], [cx + sx * LABEL_TIP * 1.5, cy], [cx, cy + sy * LABEL_TIP * 1.5]];
  } else if (yloc === 'abovebar') {
    top = y - h;
  } else if (yloc === 'belowbar') {
    top = y;
  }

  if (shown(color)) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(left, top, w, h, 3);
    ctx.fill();
    if (tip) {
      ctx.beginPath();
      ctx.moveTo(tip[0][0], tip[0][1]);
      ctx.lineTo(tip[1][0], tip[1][1]);
      ctx.lineTo(tip[2][0], tip[2][1]);
      ctx.closePath();
      ctx.fill();
    }
  }
  writeLines(left + LABEL_PADDING, w - LABEL_PADDING * 2, top + LABEL_PADDING);
}

/** Font size (px) of table text */
export const TABLE_TEXT_SIZES: Record<PineSize, number> = { auto: 11, tiny: 9, small: 10, normal: 11, large: 13, huge: 16 };

/**
 * DOM table of a table.new table: merged cells (table.merge_cells), frame and cell borders, cell width / height in %
 * of the plotting area (0: fit the text). A cell without a text colour is drawn with DEFAULT_TABLE_TEXT_COLOR, without
 * a text size with size.auto.
 */
export function buildTable(table: TableData, area: { width: number; height: number }): HTMLTableElement {
  const el = document.createElement('table');
  el.style.borderCollapse = 'collapse';
  if (shown(table.bgColor)) el.style.background = table.bgColor;
  if ((table.frameWidth ?? 0) > 0 && shown(table.frameColor)) el.style.border = `${table.frameWidth}px solid ${table.frameColor}`;
  const border = (table.borderWidth ?? 0) > 0 && shown(table.borderColor) ? `${table.borderWidth}px solid ${table.borderColor}` : '';

  const cells = new Map(table.cells.map((c) => [`${c.row}_${c.column}`, c]));
  const spans = new Map<string, { rows: number; cols: number }>();
  const covered = new Set<string>();
  for (const m of table.merges ?? []) {
    spans.set(`${m.startRow}_${m.startColumn}`, { rows: m.endRow - m.startRow + 1, cols: m.endColumn - m.startColumn + 1 });
    for (let r = m.startRow; r <= m.endRow; r++) {
      for (let c = m.startColumn; c <= m.endColumn; c++) {
        if (r !== m.startRow || c !== m.startColumn) covered.add(`${r}_${c}`);
      }
    }
  }

  for (let r = 0; r < table.rows; r++) {
    const tr = el.insertRow();
    for (let c = 0; c < table.columns; c++) {
      const key = `${r}_${c}`;
      if (covered.has(key)) continue;
      const td = tr.insertCell();
      const span = spans.get(key);
      if (span) {
        td.rowSpan = span.rows;
        td.colSpan = span.cols;
      }
      td.style.padding = '2px 6px';
      td.style.whiteSpace = 'pre';
      if (border) td.style.border = border;
      const cell = cells.get(key);
      if (!cell) continue;
      td.textContent = cell.text;
      const px = typeof cell.textSize === 'number' ? Math.max(1, cell.textSize) : TABLE_TEXT_SIZES[cell.textSize ?? 'auto'] ?? 11;
      td.style.font = fontOf(px, cell.fontFamily, cell.textFormatting);
      td.style.color = cell.textColor ?? DEFAULT_TABLE_TEXT_COLOR;
      if (shown(cell.bgColor)) td.style.background = cell.bgColor;
      td.style.textAlign = cell.textHAlign ?? 'center';
      td.style.verticalAlign = cell.textVAlign === 'top' ? 'top' : cell.textVAlign === 'bottom' ? 'bottom' : 'middle';
      if (cell.width) td.style.width = `${(cell.width * area.width) / 100}px`;
      if (cell.height) td.style.height = `${(cell.height * area.height) / 100}px`;
      if (cell.tooltip) {
        td.title = cell.tooltip;
        td.style.pointerEvents = 'auto';
      }
    }
  }
  return el;
}

// ─── Utility ──────────────────────────────────────────────────────────────

/**
 * Estimate bar width from the time scale's visible range
 */
export function getBarWidth(timeScale: ReturnType<IChartApi['timeScale']>, mediaWidth: number): number {
  const visibleRange = timeScale.getVisibleLogicalRange();
  if (!visibleRange) return 8;
  const barsCount = visibleRange.to - visibleRange.from;
  if (barsCount <= 0) return 8;
  return Math.max(1, mediaWidth / barsCount);
}


// ─── Bar colours (barcolor) ─────────────────────────────────────────────────

/** lightweight-charts candle body width (bitmap px) */
function candleWidth(barSpacing: number, pixelRatio: number): number {
  let w: number;
  if (barSpacing >= 2.5 && barSpacing <= 4) {
    w = Math.floor(3 * pixelRatio);
  } else {
    const coeff = 1 - (0.2 * Math.atan(Math.max(4, barSpacing) - 4)) / (Math.PI * 0.5);
    w = Math.max(Math.floor(pixelRatio), Math.min(Math.floor(barSpacing * coeff * pixelRatio), Math.floor(barSpacing * pixelRatio)));
  }
  if (w >= 2 && Math.floor(pixelRatio) % 2 !== w % 2) w--;
  return w;
}

/** lightweight-charts OHLC bar width (bitmap px) */
function ohlcBarWidth(barSpacing: number, pixelRatio: number): number {
  let w = Math.max(Math.floor(pixelRatio), Math.floor(barSpacing * 0.3 * pixelRatio));
  if (w >= 2 && Math.max(1, Math.floor(pixelRatio)) % 2 !== w % 2) w--;
  return w;
}

type Ohlc = { open: number; high: number; low: number; close: number };

/**
 * barcolor: the bars of the host's main series (candlestick or bar series, Heikin Ashi included) repainted in their
 * colour, with the same geometry as lightweight-charts, so the main series data is never rewritten. Other series
 * types have no bars to colour: nothing is drawn.
 */
export class BarColorPrimitive extends BasePrimitive {
  private _colors = new Map<number, string>();
  private _ohlc = new Map<number, Ohlc>();
  private _dataLength = -1;
  private _views: IPrimitivePaneView[];

  constructor(colors: Array<{ time: number; color: string }>) {
    super();
    for (const c of colors) if (shown(c.color)) this._colors.set(c.time, c.color);
    const renderer: IPrimitivePaneRenderer = { draw: (target) => this.drawAll(target) };
    this._views = [{ zOrder: () => 'normal', renderer: () => renderer }];
  }

  updateAllViews(): void {}

  paneViews(): readonly IPrimitivePaneView[] {
    return this._views;
  }

  /** OHLC of the main series by time, rebuilt when its data changed length */
  private ohlc(series: ISeriesApi<SeriesType, Time>): Map<number, Ohlc> {
    const data = series.data() as ReadonlyArray<Partial<Ohlc> & { time: Time }>;
    if (data.length !== this._dataLength) {
      this._ohlc.clear();
      for (const d of data) {
        if (d.open != null && d.high != null && d.low != null && d.close != null) {
          this._ohlc.set(d.time as unknown as number, d as Ohlc);
        }
      }
      this._dataLength = data.length;
    }
    return this._ohlc;
  }

  private drawAll(target: CanvasRenderingTarget2D): void {
    const chart = this._chart;
    const series = this._series;
    if (!chart || !series || !this._colors.size) return;
    const type = series.seriesType();
    if (type !== 'Candlestick' && type !== 'Bar') return;
    const ohlc = this.ohlc(series);
    const timeScale = chart.timeScale();
    const barSpacing = timeScale.options().barSpacing;
    const opts = series.options() as { thinBars?: boolean; openVisible?: boolean };
    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
      for (const [time, color] of this._colors) {
        const bar = ohlc.get(time);
        const x = timeScale.timeToCoordinate(time as unknown as Time);
        if (!bar || x == null) continue;
        const [o, h, l, c] = [bar.open, bar.high, bar.low, bar.close].map((p) => series.priceToCoordinate(p));
        if (o == null || h == null || l == null || c == null) continue;
        ctx.fillStyle = color;
        const cx = Math.round((x as number) * hpr);
        if (type === 'Candlestick') {
          const w = candleWidth(barSpacing, hpr);
          const wick = Math.max(Math.floor(hpr), Math.min(Math.floor(hpr), Math.floor(barSpacing * hpr), w));
          const high = Math.round(h * vpr);
          const low = Math.round(l * vpr);
          ctx.fillRect(cx - Math.floor(wick * 0.5), high, wick, low - high + 1);
          const top = Math.round(Math.min(o, c) * vpr);
          const bottom = Math.round(Math.max(o, c) * vpr);
          ctx.fillRect(cx - Math.floor(w * 0.5), top, w, bottom - top + 1);
        } else {
          const w = ohlcBarWidth(barSpacing, hpr);
          const lineW = opts.thinBars !== false ? Math.min(w, Math.floor(hpr)) : w;
          const half = Math.floor(lineW * 0.5);
          const left = cx - half;
          const top = Math.round(Math.min(h, l) * vpr) - half;
          const height = Math.max(Math.round(Math.max(h, l) * vpr) + half - top, lineW);
          ctx.fillRect(left, top, lineW, height);
          if (lineW <= w && barSpacing >= Math.floor(1.5 * hpr)) {
            const side = Math.ceil(w * 1.5);
            const tick = (y: number) => Math.min(Math.max(top, Math.round(y * vpr) - half), top + height - lineW);
            if (opts.openVisible !== false) ctx.fillRect(cx - side, tick(o), left - (cx - side), lineW);
            ctx.fillRect(left + lineW, tick(c), cx + side - (left + lineW) + 1, lineW);
          }
        }
      }
    });
  }
}
