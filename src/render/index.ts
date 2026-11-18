/**
 * lightweight-charts-indicators/render: draws indicator results on a lightweight-charts chart the host owns.
 *
 *   const r = new IndicatorRenderer(chart, { paneIndex, mainSeries });
 *   r.render(entry, entry.calculate(bars, inputs), bars, { inputs });
 *   r.clear();
 *
 * Needs lightweight-charts 5 (optional peer dependency of the package).
 */
export {
  IndicatorRenderer,
  type RenderableIndicator,
  type IndicatorRendererOptions,
  type RenderOptions,
  type PlotOverride,
  type UnorderedData,
} from './renderer';
export { ThinHistogramPaneView, type HistogramItem, type ThinHistogramOptions } from './histogram-series';
export { parseColor, withOpacity, isTransparent, type Rgba } from './color';
export { type FutureSlots } from './primitives';
