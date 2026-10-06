/**
 * IndicatorRenderer: draws ONE indicator result on a chart the host owns.
 *
 * Everything an instance creates (series, primitives, marker plugins, table overlays, time-scale slots) belongs to it
 * and is removed by clear() or by the next render(). Several instances can draw on one chart (several indicators,
 * in the price pane or in their own panes). The host gives the pane of a non-overlay indicator and its main price
 * series; force_overlay outputs go to the price pane (pane 0), bar colours always recolour the main series.
 */
import {
  createSeriesMarkers,
  LineSeries,
  HistogramSeries,
  BaselineSeries,
  CandlestickSeries,
  BarSeries,
  LineStyle,
  LineType,
  type IChartApi,
  type ISeriesApi,
  type ISeriesPrimitive,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type SeriesType,
  type LineWidth,
  type LineData,
  type BarData,
  type CandlestickData,
  type BaselineData,
  type HistogramData,
  type WhitespaceData,
  type Time,
  type DeepPartial,
  type SeriesOptionsCommon,
  type SeriesDefinition,
  type SeriesPartialOptionsMap,
  type CustomData,
  type CustomSeriesOptions,
  type ICustomSeriesPaneView,
} from 'lightweight-charts';
import type {
  Bar,
  PlotConfig,
  HLineConfig,
  FillConfig,
  FillData,
  ArrowConfig,
  ArrowData,
  IndicatorResult,
} from 'oakscriptjs';
import type {
  BarColorData,
  BgColorData,
  PlotCandleData,
  PlotBarData,
  LabelData,
  LineDrawingData,
  BoxData,
  LinefillData,
  PolylineData,
  TableData,
  MarkerData,
} from '../types';
import { isTransparent, withOpacity } from './color';
import {
  BarGrid,
  anchorData,
  markerSizeMult,
  gradientAt,
  BUILTIN_MARKER_SHAPES,
  DEFAULT_PLOT_FILL_COLOR,
  LineBrPrimitive,
  CrossPlotPrimitive,
  BgColorPrimitive,
  PlotFillPrimitive,
  ExtendedMarkerPrimitive,
  DrawingPrimitive,
  BarColorPrimitive,
  drawLabel,
  drawLine,
  drawBox,
  drawLinefill,
  drawPolyline,
  drawArrowSeries,
  buildTable,
  type ArrowSeries,
  type DrawEnv,
  type PlotFill,
  type PlotFillPoint,
  type FillGradientData,
} from './primitives';
import { ThinHistogramPaneView, type HistogramItem } from './histogram-series';

/** The indicator description the renderer needs: a registry entry or an indicator module satisfies it */
export interface RenderableIndicator {
  /** Overlay indicator (price pane) or own pane */
  overlay: boolean;
  plotConfig: PlotConfig[];
  hlineConfig?: HLineConfig[];
  fillConfig?: FillConfig[];
  arrowConfig?: ArrowConfig[];
}

/** Host overrides of one plot (by plot id) */
export interface PlotOverride {
  visible?: boolean;
  color?: string;
  lineWidth?: number;
  /** Plot type (PineScript plot style name) */
  style?: NonNullable<PlotConfig['style']>;
  /** Replacement of per-point colours: original colour string -> colour drawn */
  palette?: Record<string, string>;
}

export interface IndicatorRendererOptions {
  /** Pane of a non-overlay indicator (default 1); an overlay indicator draws in pane 0 */
  paneIndex?: number;
  /**
   * The host's main price series: marker positions next to the bars (aboveBar / belowBar / inBar) and bar colours.
   * Without it markers are drawn by the renderer's own primitive and bar colours are not drawn.
   */
  mainSeries?: ISeriesApi<SeriesType, Time>;
  /** Add bar slots after the last bar for drawings on future bars (default false: placed without extending) */
  extendTimeScale?: boolean;
  /** Keep the indicator pane when clear() empties it (pane height kept; default false) */
  preserveEmptyPane?: boolean;
}

export interface RenderOptions {
  /** Input values: plots whose `visible` names an input follow it */
  inputs?: Record<string, unknown>;
  /** Per-plot overrides by plot id */
  plots?: Record<string, PlotOverride>;
  /** Last value label of the plot series on the price scale (default false) */
  lastValueVisible?: boolean;
  /** Plot title next to the last value label (default false) */
  titleVisible?: boolean;
  /** Price line of the plot series (default false) */
  priceLineVisible?: boolean;
  /** Price precision of the plot series (default: the chart's) */
  precision?: number | null;
  /** Series in the price pane take part in its autoscale (default true; false = scale on the price only) */
  autoscale?: boolean;
  /**
   * Keep the series of the previous render (same indicator, bars changed at the end: a live update). A series of the
   * same type in the same pane and creation order is kept with the new options; when only its newest points changed
   * they are updated, else its data is replaced. Default false: every series is created again.
   */
  reuseSeries?: boolean;
}

type PlotPoint = { time: number; value: number; color?: string };

const LINE_STYLES: Record<string, LineStyle> = { solid: LineStyle.Solid, dashed: LineStyle.Dashed, dotted: LineStyle.Dotted };

export class IndicatorRenderer {
  private readonly opts: IndicatorRendererOptions;
  private readonly grid = new BarGrid();
  /** Plot series, in plotConfig order */
  private plotSeries: Array<ISeriesApi<SeriesType, Time>> = [];
  /** Every other series created (anchors, hlines, fills, candles, ...) */
  private otherSeries: Array<ISeriesApi<SeriesType, Time>> = [];
  private attached: Array<{ series: ISeriesApi<SeriesType, Time>; primitive: ISeriesPrimitive<Time> }> = [];
  private markerPlugins: Array<ISeriesMarkersPluginApi<Time>> = [];
  private tables: Array<{ table: TableData; pane: number; el: HTMLElement }> = [];
  private tableObserver: ResizeObserver | null = null;
  private tableFrame = 0;
  private renderOpts: RenderOptions = {};
  /** Series of this render in creation order, with their type (series definition or custom pane view class) */
  private created: Array<{ series: ISeriesApi<SeriesType, Time>; kind: unknown }> = [];
  /** Series of the previous render a reuseSeries render can take again (by creation order); null = taken */
  private pool: Array<{ series: ISeriesApi<SeriesType, Time>; kind: unknown } | null> = [];
  private kinds = new WeakMap<object, unknown>();
  /** Series taken from the pool in this render */
  private reused = new Set<object>();
  /** Data last set on each series */
  private lastData = new WeakMap<object, readonly unknown[]>();

  constructor(private readonly chart: IChartApi, options: IndicatorRendererOptions = {}) {
    this.opts = { ...options };
  }

  /** Pane of a non-overlay indicator for the next render() */
  setPaneIndex(paneIndex: number): void {
    this.opts.paneIndex = paneIndex;
  }

  /** The series this instance created: plot series first (plotConfig order), then the others */
  series(): Array<ISeriesApi<SeriesType, Time>> {
    return [...this.plotSeries, ...this.otherSeries];
  }

  /**
   * Draw one indicator result, replacing what this instance drew before. The indicator pane is kept during the
   * redraw (its height is not lost).
   */
  render(entry: RenderableIndicator, result: IndicatorResult, bars: Bar[], options: RenderOptions = {}): void {
    const pane = entry.overlay ? 0 : this.opts.paneIndex ?? 1;
    const paneApi = pane > 0 ? this.chart.panes()[pane] : undefined;
    const preserved = paneApi?.preserveEmptyPane();
    paneApi?.setPreserveEmptyPane(true);
    try {
      this.clearOwned(options.reuseSeries === true);
      this.renderOpts = options;
      this.grid.setBars(bars);
      if (bars.length) this.draw(entry, result as IndicatorResult & Record<string, any>, bars, pane);
    } finally {
      // series of the previous render not taken again
      for (const p of this.pool.splice(0)) if (p) this.chart.removeSeries(p.series);
      if (paneApi && !this.opts.preserveEmptyPane) paneApi.setPreserveEmptyPane(preserved ?? false);
    }
  }

  private draw(entry: RenderableIndicator, r: IndicatorResult & Record<string, any>, bars: Bar[], pane: number): void {

    this.drawPlots(entry, r, pane);
    this.drawHLines(entry, r, pane, bars);
    if (r.fills?.length) {
      const overlayPlots = new Set(entry.plotConfig.filter((p) => p.forceOverlay).map((p) => p.id));
      this.drawPlotFills(r.fills as PlotFill[], r.plots, pane, bars, overlayPlots);
    }
    if (r.markers?.length) this.drawMarkers(r.markers as MarkerData[], pane, entry.overlay);
    if (r.arrows?.length) this.drawArrows(r.arrows, entry.arrowConfig ?? [], pane, entry.overlay);
    if (r.barColors?.length) this.drawBarColors(r.barColors);
    if (r.bgColors?.length) this.drawBgColors(r.bgColors, pane);
    for (const [id, data] of Object.entries(r.plotCandles ?? {})) {
      if (Array.isArray(data) && data.length) this.drawCandles(id, data, pane);
    }
    for (const data of Object.values(r.plotBars ?? {})) {
      if (Array.isArray(data) && data.length) this.drawBars(data, pane);
    }
    if (r.labels?.length) this.drawLabels(r.labels, pane);
    if (r.lines?.length) this.drawLines(r.lines, pane);
    if (r.boxes?.length) this.drawBoxes(r.boxes, pane);
    if (r.linefills?.length) this.drawLinefills(r.linefills, pane);
    if (r.polylines?.length) this.drawPolylines(r.polylines, pane);
    if (this.opts.extendTimeScale) this.addFutureSlots(lastOutputTime(r));
    if (r.tables?.length) this.drawTables(r.tables, pane);
  }

  /** Remove everything this instance drew (and its pane when it becomes empty, unless preserveEmptyPane) */
  clear(): void {
    const panes = new Set<number>();
    for (const s of this.series()) panes.add(s.getPane().paneIndex());
    this.clearOwned();
    if (this.opts.preserveEmptyPane) return;
    const all = this.chart.panes();
    for (const i of [...panes].sort((a, b) => b - a)) {
      if (i > 0 && all[i] && all[i].getSeries().length === 0 && !all[i].preserveEmptyPane()) this.chart.removePane(i);
    }
  }

  /** Remove what the last render drew; `keepSeries`: its series go to the pool instead (reuseSeries) */
  private clearOwned(keepSeries = false): void {
    for (const { series, primitive } of this.attached) series.detachPrimitive(primitive);
    this.attached = [];
    for (const p of this.markerPlugins) p.detach();
    this.markerPlugins = [];
    if (keepSeries) this.pool = this.created;
    else for (const s of this.series()) this.chart.removeSeries(s);
    this.created = [];
    this.reused.clear();
    this.plotSeries = [];
    this.otherSeries = [];
    for (const { el } of this.tables) el.remove();
    this.tables = [];
    this.tableObserver?.disconnect();
    this.tableObserver = null;
    if (this.tableFrame) cancelAnimationFrame(this.tableFrame);
    this.tableFrame = 0;
  }

  // ─── Series helpers ──────────────────────────────────────────────────────

  /** Options of a series in `pane`: left out of the autoscale in the price pane when autoscale is off */
  private scaleOptions(pane: number): DeepPartial<SeriesOptionsCommon> {
    return pane === 0 && this.renderOpts.autoscale === false ? { autoscaleInfoProvider: () => null } : {};
  }

  /** Plot series options from the render options (labels on the price scale, precision) */
  private plotOptions(title: string): DeepPartial<SeriesOptionsCommon> {
    const o = this.renderOpts;
    const precision = o.precision;
    return {
      lastValueVisible: o.lastValueVisible ?? false,
      priceLineVisible: o.priceLineVisible ?? false,
      title: o.titleVisible ? title : '',
      ...(precision != null && { priceFormat: { type: 'price' as const, precision, minMove: Math.pow(10, -precision) } }),
    };
  }

  private own<T extends ISeriesApi<SeriesType, Time>>(series: T, plot = false): T {
    const s = series as unknown as ISeriesApi<SeriesType, Time>;
    (plot ? this.plotSeries : this.otherSeries).push(s);
    this.created.push({ series: s, kind: this.kinds.get(s) });
    return series;
  }

  /** The pool series of this creation slot when it has the same type and pane (options re-applied), else null */
  private take(kind: unknown, pane: number, options: object): ISeriesApi<SeriesType, Time> | null {
    const slot = this.created.length;
    const p = this.pool[slot];
    if (!p || p.kind !== kind || p.series.getPane().paneIndex() !== pane) return null;
    this.pool[slot] = null;
    p.series.applyOptions(options);
    this.reused.add(p.series);
    return p.series;
  }

  private addSeries<T extends SeriesType>(
    definition: SeriesDefinition<T>,
    options: SeriesPartialOptionsMap[T],
    pane: number
  ): ISeriesApi<T, Time> {
    const reused = this.take(definition, pane, options);
    if (reused) return reused as unknown as ISeriesApi<T, Time>;
    const series = this.chart.addSeries(definition, options, pane);
    this.kinds.set(series, definition);
    return series;
  }

  private addCustomSeries<TData extends CustomData<Time>, TOptions extends CustomSeriesOptions>(
    view: ICustomSeriesPaneView<Time, TData, TOptions>,
    options: DeepPartial<TOptions & SeriesOptionsCommon>,
    pane: number
  ): ISeriesApi<'Custom', Time, TData | WhitespaceData<Time>, TOptions> {
    const reused = this.take(view.constructor, pane, options);
    if (reused) return reused as unknown as ISeriesApi<'Custom', Time, TData | WhitespaceData<Time>, TOptions>;
    const series = this.chart.addCustomSeries(view, options, pane);
    this.kinds.set(series, view.constructor);
    return series;
  }

  /** Series data; a reused series whose newest points alone changed (or that has new bars) gets them as updates */
  private setData(series: ISeriesApi<any, Time, any>, data: readonly unknown[]): void {
    const s = series as ISeriesApi<SeriesType, Time>;
    const old = this.reused.has(s) ? this.lastData.get(s) : undefined;
    this.lastData.set(s, data);
    const from = old ? changedTail(old, data) : -1;
    if (from < 0) {
      s.setData(data as never);
      return;
    }
    for (let i = from; i < data.length; i++) s.update(data[i] as never, i < old!.length - 1);
  }

  private attach(series: ISeriesApi<SeriesType, Time>, primitive: ISeriesPrimitive<Time>): void {
    series.attachPrimitive(primitive);
    this.attached.push({ series, primitive });
  }

  /** Invisible line series that holds primitives (and, with autoscale, the price range of what they draw) */
  private anchor(pane: number, autoscale = true): ISeriesApi<'Line', Time> {
    return this.own(this.addSeries(LineSeries, {
      color: 'transparent',
      lineVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
      ...(autoscale ? this.scaleOptions(pane) : { autoscaleInfoProvider: () => null }),
    }, pane));
  }

  // ─── Plots ────────────────────────────────────────────────────────────────

  private drawPlots(entry: RenderableIndicator, r: Record<string, any>, pane: number): void {
    for (const def of entry.plotConfig) {
      const override = this.renderOpts.plots?.[def.id] ?? {};
      const raw = r.plots?.[def.id] as PlotPoint[] | undefined;
      if (!raw?.length || !this.plotVisible(def, override, r)) continue;
      const palette = override.palette;
      const data = palette ? raw.map((p) => (p.color && palette[p.color] ? { ...p, color: palette[p.color] } : p)) : raw;
      const color = override.color ?? def.color ?? '#2962FF';
      const lineWidth = override.lineWidth ?? def.lineWidth;
      const plotPane = def.forceOverlay ? 0 : pane;
      const style = override.style ?? def.style ?? 'line';
      const lineStyle = LINE_STYLES[def.linestyle ?? 'solid'] ?? LineStyle.Solid;
      const title = def.title ?? def.id;
      switch (style) {
        case 'histogram':
          this.addThinHistogram(data, color, lineWidth, def.histbase ?? 0, plotPane, title);
          break;
        case 'columns':
          this.addColumns(data, color, def.histbase ?? 0, plotPane, title);
          break;
        case 'circles':
          this.addLine(data, { color, lineWidth, lineStyle, pointMarkersVisible: true, lineVisible: false }, plotPane, title);
          break;
        case 'cross':
          this.addCross(data, color, lineWidth, plotPane);
          break;
        case 'stepline':
        case 'stepline_diamond':
          this.addLine(data, { color, lineWidth, lineStyle, lineType: LineType.WithSteps }, plotPane, title);
          break;
        case 'steplinebr':
          this.addLineBr(data, color, lineWidth, lineStyle, true, plotPane);
          break;
        case 'linebr':
          this.addLineBr(data, color, lineWidth, lineStyle, false, plotPane);
          break;
        case 'area':
        case 'areabr':
          this.addArea(data, color, lineWidth, lineStyle, def.histbase ?? 0, plotPane, title);
          break;
        default:
          this.addLine(data, { color, lineWidth, lineStyle }, plotPane, title);
      }
    }
  }

  /** plotConfig visibility: display, the visible flag or the input it names, the host override */
  private plotVisible(def: PlotConfig, override: PlotOverride, r: Record<string, any>): boolean {
    if (override.visible !== undefined) return override.visible;
    if (def.display === 'none' || def.display === 'data_window' || def.display === 'status_line') return false;
    if (def.visible === undefined || typeof def.visible === 'boolean') return def.visible ?? true;
    const inputs = this.renderOpts.inputs ?? {};
    if (inputs[def.visible] !== undefined) return Boolean(inputs[def.visible]);
    if (r.visibility?.[def.visible] !== undefined) return Boolean(r.visibility[def.visible]);
    return (r.plots?.[def.id] ?? []).some((p: PlotPoint) => p.value != null && !Number.isNaN(p.value));
  }

  private addLine(
    data: PlotPoint[],
    o: { color: string; lineWidth?: number; lineStyle: LineStyle; lineType?: LineType; pointMarkersVisible?: boolean; lineVisible?: boolean },
    pane: number,
    title: string
  ): ISeriesApi<'Line', Time> {
    // PineScript widths go above 4 (glow lines): the canvas draws any width, the LineWidth type lists 1..4
    const lineWidth = (o.lineWidth && o.lineWidth >= 1 ? o.lineWidth : 2) as LineWidth;
    const series = this.own(this.addSeries(LineSeries, {
      color: o.color,
      lineWidth,
      lineStyle: o.lineStyle,
      lineType: o.lineType ?? LineType.Simple,
      pointMarkersVisible: o.pointMarkersVisible ?? false,
      lineVisible: o.lineVisible ?? true,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      ...this.plotOptions(title),
      ...this.scaleOptions(pane),
    }, pane), true);
    const valid = data.filter((d) => d.value != null && !Number.isNaN(d.value)) as unknown as LineData<Time>[];
    const simpleLine = (o.lineType ?? LineType.Simple) === LineType.Simple && o.lineVisible !== false && !o.pointMarkersVisible;
    this.setData(series, simpleLine ? segmentColors(valid, o.color) : valid);
    return series;
  }

  /**
   * plot.style_area: the plot line and, per bar, the area between the value and histbase in the colour of that bar.
   * histbase is not part of the price scale (only the plot values are).
   */
  private addArea(data: PlotPoint[], color: string, lineWidth: number | undefined, lineStyle: LineStyle, base: number, pane: number, title: string): void {
    const series = this.addLine(data, { color, lineWidth, lineStyle }, pane, title);
    const primitive = new PlotFillPrimitive();
    this.attach(series as unknown as ISeriesApi<SeriesType, Time>, primitive as ISeriesPrimitive<Time>);
    primitive.setData(
      data
        .filter((d) => d.value != null && !Number.isNaN(d.value))
        .map((d) => {
          const c = d.color ?? color;
          return { time: d.time, v1: d.value, v2: base, color: isTransparent(c) ? null : withOpacity(c, 1) };
        })
    );
  }

  /** plot.style_histogram: bars of the plot line width from histbase (thin histogram series) */
  private addThinHistogram(data: PlotPoint[], color: string, lineWidth: number | undefined, base: number, pane: number, title: string): void {
    const series = this.own(this.addCustomSeries(new ThinHistogramPaneView(), {
      histColor: color,
      histWidth: Math.max(1, lineWidth ?? 1),
      histBase: base,
      ...this.plotOptions(title),
      ...this.scaleOptions(pane),
    }, pane) as unknown as ISeriesApi<SeriesType, Time>, true);
    this.setData(series, 
      data.map((d) => {
        const time = d.time as unknown as Time;
        if (d.value == null || Number.isNaN(d.value)) return { time } as unknown as HistogramItem;
        return d.color ? { time, value: d.value, fill: d.color } : { time, value: d.value };
      })
    );
  }

  /** plot.style_columns: bars of the bar slot width from histbase */
  private addColumns(data: PlotPoint[], color: string, base: number, pane: number, title: string): void {
    const series = this.own(this.addSeries(HistogramSeries, {
      color,
      base,
      ...this.plotOptions(title),
      ...this.scaleOptions(pane),
    }, pane), true);
    this.setData(series, data.filter((d) => d.value != null && !Number.isNaN(d.value)) as unknown as HistogramData<Time>[]);
  }

  private addCross(data: PlotPoint[], color: string, lineWidth: number | undefined, pane: number): void {
    const anchor = this.anchor(pane);
    this.setData(anchor, data.filter((d) => d.value != null && !Number.isNaN(d.value)) as unknown as LineData<Time>[]);
    const primitive = new CrossPlotPrimitive();
    this.attach(anchor as unknown as ISeriesApi<SeriesType, Time>, primitive as ISeriesPrimitive<Time>);
    primitive.setData(data, color, (lineWidth ?? 2) * 3);
  }

  /** linebr / steplinebr: a line that breaks at na values */
  private addLineBr(data: PlotPoint[], color: string, lineWidth: number | undefined, lineStyle: LineStyle, steps: boolean, pane: number): void {
    const anchor = this.anchor(pane);
    this.setData(anchor, data.filter((d) => d.value != null && !Number.isNaN(d.value)) as unknown as LineData<Time>[]);
    const primitive = new LineBrPrimitive();
    this.attach(anchor as unknown as ISeriesApi<SeriesType, Time>, primitive as ISeriesPrimitive<Time>);
    primitive.setData(data, color, lineWidth ?? 2, lineStyle, steps);
  }

  // ─── hlines and fills ─────────────────────────────────────────────────────

  /** hlines: the entry's hlineConfig, else the hlines of the result; then the fills between hlines */
  private drawHLines(entry: RenderableIndicator, r: Record<string, any>, pane: number, bars: Bar[]): void {
    const hlines: HLineConfig[] = entry.hlineConfig?.length
      ? entry.hlineConfig
      : (r.hlines ?? []).map((h: any, i: number) => ({
        id: `hline${i}`,
        price: h.value,
        title: h.options?.title,
        color: h.options?.color,
        linestyle: h.options?.linestyle,
        linewidth: h.options?.linewidth,
      }));
    const first = bars[0].time as unknown as Time;
    const last = bars[bars.length - 1].time as unknown as Time;
    for (const h of hlines) {
      // hline(..., display = display.none): not drawn (it can still bound a fill)
      if (h.display === 'none') continue;
      const series = this.own(this.addSeries(LineSeries, {
        color: h.color ?? '#787B86',
        lineWidth: (h.linewidth ?? 1) as LineWidth,
        lineStyle: LINE_STYLES[h.linestyle ?? 'solid'] ?? LineStyle.Solid,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        ...this.scaleOptions(pane),
      }, pane));
      this.setData(series, [{ time: first, value: h.price }, { time: last, value: h.price }]);
    }

    // fills between hlines: the ones of the result (they follow the inputs), else the entry's fillConfig
    if (!entry.hlineConfig?.length) return;
    const ids = new Set(entry.hlineConfig.map((h) => h.id));
    const fromResult: FillConfig[] = (r.fills ?? [])
      .filter((f: any) => ids.has(f.plot1) && ids.has(f.plot2))
      .map((f: any, k: number) => ({
        id: `hlineFill${k}`,
        plot1: f.plot1,
        plot2: f.plot2,
        color: f.options?.color ?? f.color,
        colors: f.colors,
        gradient: f.gradient,
        title: f.options?.title,
      }));
    const fills = fromResult.length ? fromResult : entry.fillConfig ?? [];
    if (fills.length) this.drawHLineFills(fills, entry.hlineConfig, pane, bars);
  }

  /**
   * Fills between two hlines; a gradient or per-bar colours (FillConfig.gradient / colors) are drawn bar by bar by
   * the plot fill primitive.
   */
  private drawHLineFills(fills: FillConfig[], hlines: HLineConfig[], pane: number, bars: Bar[]): void {
    const first = bars[0].time as unknown as Time;
    const last = bars[bars.length - 1].time as unknown as Time;
    const prices = new Map(hlines.map((h) => [h.id, h.price]));
    for (const fill of fills) {
      const p1 = prices.get(fill.plot1);
      const p2 = prices.get(fill.plot2);
      if (p1 == null || p2 == null) continue;
      if (fill.gradient || fill.colors) {
        const gradient = fill.gradient as FillGradientData | undefined;
        const colors = fill.colors;
        const anchor = this.anchor(pane);
        this.setData(anchor, bars.map((b) => ({ time: b.time as unknown as Time, value: Math.max(p1, p2) })));
        const primitive = new PlotFillPrimitive();
        primitive.setData(bars.map((b, i) => ({
          time: b.time,
          v1: p1,
          v2: p2,
          color: colors && !isTransparent(colors[i]) ? colors[i] : null,
          gradient: gradient ? gradientAt(gradient, i) : undefined,
        })));
        this.attach(anchor as unknown as ISeriesApi<SeriesType, Time>, primitive as ISeriesPrimitive<Time>);
        continue;
      }
      const color = fill.color ?? 'rgba(41,98,255,0.1)';
      const series = this.own(this.addSeries(BaselineSeries, {
        baseValue: { type: 'price', price: Math.min(p1, p2) },
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
        ...this.scaleOptions(pane),
      }, pane));
      this.setData(series, [
        { time: first, value: Math.max(p1, p2) },
        { time: last, value: Math.max(p1, p2) },
      ] as BaselineData<Time>[]);
    }
  }

  /**
   * Fills between two plots (fill(plot1, plot2, color)). Colour of bar i: `fill.colors[i]` when the result gives
   * per-bar colours, else `fill.options.color`; an na colour draws nothing on that bar. `fill.options.transp`
   * (PineScript v4 transp, 0..100) multiplies the alpha. `fill.gradient` replaces the colour (gradient of bar i).
   * Pane: `pane`, or the price pane when both plots have force_overlay.
   */
  private drawPlotFills(
    fills: PlotFill[],
    plotData: Record<string, PlotPoint[]>,
    pane: number,
    bars: Bar[],
    overlayPlots: Set<string>
  ): void {
    const barIndex = new Map(bars.map((b, i) => [b.time, i]));
    for (const fill of fills as Array<PlotFill & FillData>) {
      const p1 = plotData[fill.plot1];
      const p2 = plotData[fill.plot2];
      if (!p1?.length || !p2?.length) continue;
      const transp = fill.options?.transp;
      const opacity = transp != null ? 1 - transp / 100 : 1;
      // no colour in the result: renderer default (not a PineScript value)
      const staticColor = fill.options?.color ?? DEFAULT_PLOT_FILL_COLOR;
      const resolved = new Map<string, string | null>();
      const resolve = (raw: string | null | undefined): string | null => {
        if (raw == null) return null;
        let c = resolved.get(raw);
        if (c === undefined) {
          c = withOpacity(raw, opacity);
          resolved.set(raw, c);
        }
        return c;
      };
      const p2Map = new Map(p2.map((d) => [d.time, d.value]));
      const gradient = fill.gradient as FillGradientData | undefined;
      const points: PlotFillPoint[] = p1.map((d1, i) => {
        const v2 = p2Map.get(d1.time);
        if (gradient) {
          const bi = barIndex.get(d1.time);
          return { time: d1.time, v1: d1.value ?? NaN, v2: v2 ?? NaN, color: null, gradient: bi === undefined ? null : gradientAt(gradient, bi) };
        }
        const raw = fill.colors && i < fill.colors.length ? fill.colors[i] : staticColor;
        return { time: d1.time, v1: d1.value ?? NaN, v2: v2 ?? NaN, color: resolve(raw) };
      });
      const valid = points.filter((p) => Number.isFinite(p.v1) && Number.isFinite(p.v2));
      if (!valid.length) continue;
      const bothOverlay = overlayPlots.has(String(fill.plot1)) && overlayPlots.has(String(fill.plot2));
      const anchor = this.anchor(bothOverlay ? 0 : pane);
      this.setData(anchor, valid.map((p) => ({ time: p.time as unknown as Time, value: Math.max(p.v1, p.v2) })));
      const primitive = new PlotFillPrimitive();
      primitive.setData(points);
      this.attach(anchor as unknown as ISeriesApi<SeriesType, Time>, primitive as ISeriesPrimitive<Time>);
    }
  }

  // ─── Markers, arrows, colours ─────────────────────────────────────────────

  /**
   * Markers. Bar positions (aboveBar / belowBar / inBar) and the atPrice* markers of an overlay indicator (or with
   * forceOverlay) go to the price pane; the atPrice* / top / bottom markers of a non-overlay indicator to its pane.
   * The lightweight-charts markers plugin (on the main series) draws its 4 shapes when the text has the shape colour
   * and one line; the extended marker primitive draws the others (other shapes, plotchar characters, textColor,
   * transparent shape colour, labels, multi-line text, top / bottom, and every marker without a main series).
   */
  private drawMarkers(markers: MarkerData[], pane: number, overlay: boolean): void {
    const isPrice = (m: MarkerData) => m.position.startsWith('atPrice');
    const isEdge = (m: MarkerData) => m.position === 'top' || m.position === 'bottom';
    const inPane = (m: MarkerData) => (isPrice(m) || isEdge(m)) && !overlay && !m.forceOverlay && pane !== 0;
    const main = this.opts.mainSeries;

    const split = (list: MarkerData[], nativeAllowed: boolean) => {
      const native: SeriesMarker<Time>[] = [];
      const extended: MarkerData[] = [];
      for (const m of list) {
        if (isPrice(m) && (m.price == null || Number.isNaN(m.price))) continue;
        const nativeOk = nativeAllowed
          && !isEdge(m)
          && !m.char
          && BUILTIN_MARKER_SHAPES.has(m.shape)
          && (m.textColor == null || m.textColor === m.color)
          && !isTransparent(m.color)
          && !(m.text ?? '').includes('\n');
        if (!nativeOk) {
          extended.push(m);
          continue;
        }
        const base = {
          time: m.time as unknown as Time,
          shape: m.shape as 'arrowUp' | 'arrowDown' | 'circle' | 'square',
          color: m.color,
          text: m.text ?? '',
          size: markerSizeMult(m.size),
        };
        native.push(isPrice(m)
          ? { ...base, position: m.position as 'atPriceTop' | 'atPriceBottom' | 'atPriceMiddle', price: m.price! }
          : { ...base, position: m.position as 'aboveBar' | 'belowBar' | 'inBar' });
      }
      native.sort((a, b) => (a.time as unknown as number) - (b.time as unknown as number));
      return { native, extended };
    };

    // price pane: on the main series, else on an anchor that is left out of the autoscale
    const onPrice = split(markers.filter((m) => !inPane(m)), !!main);
    if (onPrice.native.length || onPrice.extended.length) {
      const target = main ?? (this.anchor(0, false) as unknown as ISeriesApi<SeriesType, Time>);
      if (!main) this.setData(target, anchorData(this.grid.bars.map((b) => ({ time: b.time, value: b.close })), this.grid));
      if (onPrice.native.length) this.markerPlugins.push(createSeriesMarkers(target, onPrice.native));
      if (onPrice.extended.length) {
        const primitive = new ExtendedMarkerPrimitive(this.grid);
        this.attach(target, primitive as ISeriesPrimitive<Time>);
        primitive.setMarkers(onPrice.extended);
      }
    }

    // indicator pane: on an anchor that holds the marker prices
    const paneMarkers = markers.filter(inPane);
    if (paneMarkers.length) {
      const parts = split(paneMarkers, true);
      const anchor = this.anchor(pane);
      this.setData(anchor, anchorData(paneMarkers.map((m) => ({ time: m.time, value: m.price! })), this.grid));
      if (parts.native.length) this.markerPlugins.push(createSeriesMarkers(anchor, parts.native));
      if (parts.extended.length) {
        const primitive = new ExtendedMarkerPrimitive(this.grid);
        this.attach(anchor as unknown as ISeriesApi<SeriesType, Time>, primitive as ISeriesPrimitive<Time>);
        primitive.setMarkers(parts.extended);
      }
    }
  }

  /** plotarrow arrows, one group per plotarrow id (minheight / maxheight / forceOverlay / display of arrowConfig) */
  private drawArrows(arrows: ArrowData[], configs: ArrowConfig[], pane: number, overlay: boolean): void {
    const byId = new Map<string, ArrowData[]>();
    for (const a of arrows) {
      if (!byId.has(a.id)) byId.set(a.id, []);
      byId.get(a.id)!.push(a);
    }
    const series: ArrowSeries[] = [];
    for (const [id, list] of byId) {
      const cfg = configs.find((c) => c.id === id);
      if (cfg?.display === 'none') continue;
      const forceOverlay = !!cfg?.forceOverlay;
      series.push({
        arrows: list,
        minheight: cfg?.minheight ?? 5,
        maxheight: cfg?.maxheight ?? 100,
        forceOverlay,
        onBars: overlay || forceOverlay || pane === 0,
      });
    }
    this.drawLayers(series, pane, (s) => s.forceOverlay, (s) => s.arrows.map((a) => ({ time: a.time as number, value: 0 })), drawArrowSeries, 'normal', false);
  }

  /** barcolor: repainted over the host's main series (nothing without a main series) */
  private drawBarColors(barColors: BarColorData[]): void {
    const main = this.opts.mainSeries;
    if (!main) return;
    this.attach(main, new BarColorPrimitive(barColors) as ISeriesPrimitive<Time>);
  }

  /** bgcolor: per pane (force_overlay entries go to the price pane), left out of the autoscale */
  private drawBgColors(bgColors: BgColorData[], pane: number): void {
    const byPane = new Map<number, BgColorData[]>();
    for (const bg of bgColors) {
      const p = bg.forceOverlay ? 0 : pane;
      if (!byPane.has(p)) byPane.set(p, []);
      byPane.get(p)!.push(bg);
    }
    for (const [p, list] of byPane) {
      const anchor = this.anchor(p, false);
      // one point when the layer has one bar (times must be ascending)
      const first = list[0].time;
      const last = list[list.length - 1].time;
      this.setData(anchor, (first === last ? [first] : [first, last]).map((time) => ({ time: time as unknown as Time, value: 0 })));
      const primitive = new BgColorPrimitive();
      this.attach(anchor as unknown as ISeriesApi<SeriesType, Time>, primitive as ISeriesPrimitive<Time>);
      primitive.setData(list);
    }
  }

  /** plotcandle: a candlestick series (force_overlay candles go to the price pane) */
  private drawCandles(_id: string, data: PlotCandleData[], pane: number): void {
    const p = data.some((d) => d.forceOverlay) ? 0 : pane;
    const series = this.own(this.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: true,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      lastValueVisible: false,
      priceLineVisible: false,
      ...this.scaleOptions(p),
    }, p));
    // a bar with an na value draws no candle (whitespace point)
    this.setData(series, data.map((d): CandlestickData<Time> | WhitespaceData<Time> => {
      const time = d.time as unknown as Time;
      if (![d.open, d.high, d.low, d.close].every((v) => Number.isFinite(v))) return { time };
      return {
        time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
        ...(d.color && { color: d.color, borderColor: d.borderColor ?? d.color, wickColor: d.wickColor ?? d.color }),
      };
    }));
  }

  /** plotbar: an OHLC bar series in the bar colour (PineScript default colour when none) */
  private drawBars(data: PlotBarData[], pane: number): void {
    const p = data.some((d) => d.forceOverlay) ? 0 : pane;
    const series = this.own(this.addSeries(BarSeries, {
      upColor: '#2962FF',
      downColor: '#2962FF',
      openVisible: true,
      thinBars: false,
      lastValueVisible: false,
      priceLineVisible: false,
      ...this.scaleOptions(p),
    }, p));
    this.setData(series, data.map((d): BarData<Time> | WhitespaceData<Time> => {
      const time = d.time as unknown as Time;
      if (![d.open, d.high, d.low, d.close].every((v) => Number.isFinite(v))) return { time };
      return { time, open: d.open, high: d.high, low: d.low, close: d.close, ...(d.color && { color: d.color }) };
    }));
  }

  // ─── Drawings ─────────────────────────────────────────────────────────────

  /**
   * One primitive per pane on an anchor series that holds the drawing prices (autoscale: also their price range).
   * force_overlay drawings go to the price pane.
   */
  private drawLayers<T>(
    items: T[],
    pane: number,
    forceOverlay: (item: T) => boolean | undefined,
    points: (item: T) => Array<{ time: number; value: number }>,
    draw: (env: DrawEnv, item: T) => void,
    zOrder: 'bottom' | 'normal' | 'top',
    autoscale = true
  ): void {
    const groups = new Map<number, T[]>();
    for (const item of items) {
      const p = forceOverlay(item) ? 0 : pane;
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p)!.push(item);
    }
    for (const [p, group] of groups) {
      const anchor = this.anchor(p, autoscale);
      this.setData(anchor, anchorData(group.flatMap(points), this.grid));
      this.attach(anchor as unknown as ISeriesApi<SeriesType, Time>, new DrawingPrimitive(this.grid, group, draw, zOrder) as ISeriesPrimitive<Time>);
    }
  }

  private drawLabels(labels: LabelData[], pane: number): void {
    this.drawLayers(labels, pane, (l) => l.forceOverlay, (l) => [{ time: l.time, value: l.price }], drawLabel, 'top');
  }

  private drawLines(lines: LineDrawingData[], pane: number): void {
    this.drawLayers(lines, pane, (l) => l.forceOverlay, (l) => [
      { time: l.time1, value: l.price1 },
      { time: l.time2, value: l.price2 },
    ], drawLine, 'normal');
  }

  private drawBoxes(boxes: BoxData[], pane: number): void {
    this.drawLayers(boxes, pane, (b) => b.forceOverlay, (b) => [
      { time: b.time1, value: b.price1 },
      { time: b.time2, value: b.price2 },
    ], drawBox, 'bottom');
  }

  private drawLinefills(fills: LinefillData[], pane: number): void {
    this.drawLayers(fills, pane, (f) => f.line1.forceOverlay, (f) => [
      { time: f.line1.time1, value: f.line1.price1 },
      { time: f.line1.time2, value: f.line1.price2 },
      { time: f.line2.time1, value: f.line2.price1 },
      { time: f.line2.time2, value: f.line2.price2 },
    ], drawLinefill, 'bottom');
  }

  private drawPolylines(polylines: PolylineData[], pane: number): void {
    this.drawLayers(polylines, pane, (p) => p.forceOverlay, (p) => p.points.map((pt) => ({ time: pt.time, value: pt.price })), drawPolyline, 'normal');
  }

  /** Whitespace points after the last bar up to `maxTime` (bar slots for drawings and plot points on future bars) */
  private addFutureSlots(maxTime: number): void {
    const k = this.grid.slotsAfter(maxTime);
    if (k <= 0) return;
    const series = this.anchor(0, false);
    const data: WhitespaceData<Time>[] = [];
    for (let i = 1; i <= k; i++) data.push({ time: (this.grid.lastTime + i * this.grid.interval) as unknown as Time });
    this.setData(series, data);
  }

  // ─── Tables ───────────────────────────────────────────────────────────────

  /**
   * Tables (table.new) as DOM overlays in the chart element, on their pane (the price pane with force_overlay), at
   * their position inside the plotting area. PineScript defaults: no background, frame or borders; black cell text.
   */
  private drawTables(tables: TableData[], pane: number): void {
    const host = this.chart.chartElement();
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    for (const table of tables) {
      const el = document.createElement('div');
      el.className = 'chart-table-overlay';
      el.style.cssText = 'position:absolute;z-index:10;pointer-events:none;visibility:hidden';
      host.appendChild(el);
      this.tables.push({ table, pane: table.forceOverlay ? 0 : pane, el });
    }
    this.tableObserver = new ResizeObserver(() => this.scheduleTableLayout());
    this.tableObserver.observe(host);
    this.scheduleTableLayout();
  }

  /** Lay out the tables after the chart has laid out its panes */
  private scheduleTableLayout(): void {
    if (!this.tables.length || this.tableFrame) return;
    this.tableFrame = requestAnimationFrame(() => {
      this.tableFrame = 0;
      this.layoutTables();
    });
  }

  private layoutTables(): void {
    const host = this.chart.chartElement();
    const cr = host.getBoundingClientRect();
    const panes = this.chart.panes();
    const leftScale = this.chart.priceScale('left').width();
    const rightScale = this.chart.priceScale('right').width();
    for (const { table, pane, el } of this.tables) {
      const pr = (panes[pane] ?? panes[0])?.getHTMLElement()?.getBoundingClientRect() ?? cr;
      // plotting area of the pane (without the price scales)
      const area = { left: pr.left - cr.left + leftScale, top: pr.top - cr.top, width: pr.width - leftScale - rightScale, height: pr.height };
      el.replaceChildren(buildTable(table, area));
      const margin = 8;
      const [v, h] = table.position.split('_');
      const left = h === 'left' ? margin : h === 'right' ? area.width - el.offsetWidth - margin : (area.width - el.offsetWidth) / 2;
      const top = v === 'top' ? margin : v === 'bottom' ? area.height - el.offsetHeight - margin : (area.height - el.offsetHeight) / 2;
      el.style.left = `${area.left + left}px`;
      el.style.top = `${area.top + top}px`;
      el.style.visibility = 'visible';
    }
  }
}

/**
 * Per-point colours of a simple line: PineScript colours the segment that leads into a point with the colour of that
 * point, lightweight-charts the segment from a point with the colour of that point. So each point gets the colour of
 * the next point.
 */
function segmentColors<T extends { color?: string }>(data: T[], base: string): T[] {
  if (!data.some((d) => d.color)) return data;
  return data.map((d, i) => {
    const next = data[i + 1];
    return next ? { ...d, color: next.color ?? base } : d;
  });
}

/** Newest points a live update can change: the last bar and the one before it */
const TAIL_POINTS = 2;

/**
 * Index of the first point of `next` to update on a series that shows `old`: only the last TAIL_POINTS points changed
 * their values (same times) and at most TAIL_POINTS points were added. -1: anything else (the data is replaced).
 */
function changedTail(old: readonly unknown[], next: readonly unknown[]): number {
  const m = old.length;
  if (next.length < m || next.length - m > TAIL_POINTS) return -1;
  let i = 0;
  while (i < m && samePoint(old[i], next[i])) i++;
  if (i < m - TAIL_POINTS) return -1;
  for (let j = i; j < m; j++) if ((old[j] as { time: unknown }).time !== (next[j] as { time: unknown }).time) return -1;
  return i;
}

/** Same data point: the same fields with the same values */
function samePoint(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  let n = 0;
  for (const k in y) {
    if (x[k] !== y[k]) return false;
    n++;
  }
  for (const _ in x) n--;
  return n === 0;
}

/** Latest time of the outputs (last non-na plot points, markers, arrows, drawings) */
function lastOutputTime(r: Record<string, any>): number {
  let max = -Infinity;
  const see = (t: unknown) => {
    if (typeof t === 'number' && t > max) max = t;
  };
  for (const points of Object.values(r.plots ?? {}) as PlotPoint[][]) {
    for (let i = points.length - 1; i >= 0; i--) {
      const v = points[i].value;
      if (v != null && !Number.isNaN(v)) {
        see(points[i].time);
        break;
      }
    }
  }
  for (const m of r.markers ?? []) see(m.time);
  for (const a of r.arrows ?? []) see(a.time);
  for (const l of r.labels ?? []) see(l.time);
  for (const l of r.lines ?? []) { see(l.time1); see(l.time2); }
  for (const b of r.boxes ?? []) { see(b.time1); see(b.time2); }
  for (const f of r.linefills ?? []) { see(f.line1.time1); see(f.line1.time2); see(f.line2.time1); see(f.line2.time2); }
  for (const p of r.polylines ?? []) for (const pt of p.points) see(pt.time);
  return max;
}
