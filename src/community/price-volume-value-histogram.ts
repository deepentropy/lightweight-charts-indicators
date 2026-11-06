/**
 * Price/Volume Value Histogram
 *
 * Points from price and volume changes: on a bar where close rises, the point is close / close[1], multiplied by a
 * volume factor (volume / volume[1] capped at 2, reduced by a percent, at least 1) when volume also rises; on a bar
 * where close falls, the point is -(close[1] / close), with the same volume factor when volume rises. The histogram
 * is the average of the last "look back" points, optionally smoothed by an EMA: lime at or above zero, red below.
 * The candles can take the histogram colour; a hidden plot gives 1 / -1 for use by other indicators.
 *
 * Reference: "Price/Volume Value Histogram" by dman103
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PriceVolumeValueHistogramInputs {
  /** Number of points averaged */
  lookBack: number;
  /** Colour the candles with the histogram colour */
  colorBars: boolean;
  /** Percent to reduce from the volume factor (0: full volume factor, 100: no volume factor) */
  percentFactorVol: number;
  /** Smooth the average with an EMA */
  emaSmooth: boolean;
  /** EMA length */
  emaLength: number;
}

export const defaultInputs: PriceVolumeValueHistogramInputs = {
  lookBack: 7,
  colorBars: true,
  percentFactorVol: 0,
  emaSmooth: true,
  emaLength: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookBack', type: 'int', title: 'Look back', defval: 7, min: 1 },
  { id: 'colorBars', type: 'bool', title: 'Color bars', defval: true },
  { id: 'percentFactorVol', type: 'int', title: 'Percent to reduce from volume factor [0 - full volume, 100 - no volume]', defval: 0, min: 0, max: 100 },
  { id: 'emaSmooth', type: 'bool', title: 'EMA smoothing', defval: true },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 7 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero', color: color.orange, lineWidth: 1 },
  { id: 'plot1', title: 'Histogram', color: color.lime, lineWidth: 5, style: 'columns' },
  { id: 'plot2', title: '[External Indicator 1 or -1]', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Price/Volume value histogram',
  shortTitle: 'P/V value histogram',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => b - a <= EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface PvvhVars {
  /** var float[] points_array (changed in place: copied by copyVars) */
  points: number[];
}

interface PvvhRun extends BarRunState<PvvhVars> {
  ema: ReturnType<typeof taStep.ema> | null;
  plot0: { time: number; value: number; color: string }[];
  plot1: { time: number; value: number; color: string }[];
  plot2: { time: number; value: number }[];
  barColors: BarColorData[];
}

function study(inputs: Partial<PriceVolumeValueHistogramInputs>): BarStudy<PvvhRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // reducedPercent := 1.0 - (percent_factor_vol / 100.0) (set on the first bar)
  const reducedPercent = 1.0 - cfg.percentFactorVol / 100.0;
  const orange = String(color.new(color.orange, 0));
  return {
    init() {
      const ema = cfg.emaSmooth ? taStep.ema(cfg.emaLength) : null;
      const s: PvvhRun = {
        ema, plot0: [], plot1: [], plot2: [], barColors: [],
        steps: ema ? [ema] : [], vars: { points: [] }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.barColors];
      return s;
    },
    copyVars: (v) => ({ points: v.points.slice() }),
    bar(s, i, bars) {
      const points = s.vars.points;
      const b = bars[i];
      const close = b.close;
      const volume = b.volume ?? NaN;
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      const volume1 = i > 0 ? bars[i - 1].volume ?? NaN : NaN;
      const priceUp = gt(close, close1);
      const priceDown = lt(close, close1);
      const volUp = gt(volume, volume1);
      // ratioClose = close[1] != 0 ? close / close[1] : 1; ratioVol = volume[1] != 0 ? volume / volume[1] : 1
      const ratioClose = ne(close1, 0) ? close / close1 : 1;
      const ratioVol = ne(volume1, 0) ? volume / volume1 : 1;
      // volumeFactor = math.max(1, math.min(ratioVol, 2) * reducedPercent) (na when ratioVol is na)
      const volumeFactor = isNaN(ratioVol) ? NaN : Math.max(1, Math.min(ratioVol, 2) * reducedPercent);

      if (priceUp) {
        points.push(volUp ? ratioClose * volumeFactor : ratioClose);
        if (points.length > cfg.lookBack) points.shift();
      } else if (priceDown) {
        points.push(volUp ? -(1 / ratioClose) * volumeFactor : -(1 / ratioClose));
        if (points.length > cfg.lookBack) points.shift();
      }
      // sum_total = array.avg(points_array) (na while the array is empty)
      const sumTotal = points.length ? points.reduce((sum, v) => sum + v, 0) / points.length : NaN;

      // plot_result = emaSmooth ? ta.ema(sum_total, emaLength) : sum_total
      const plotResult = s.ema ? s.ema.step(sumTotal) : sumTotal;

      // histColor = plot_result >= 0 ? color.lime : color.red (red when plot_result is na)
      const histColor = ge(plotResult, 0) ? color.lime : color.red;
      // barcolor(color = colorBars ? histColor : na)
      if (cfg.colorBars) s.barColors[i] = { time: b.time, color: histColor };
      // plot(0, color = color.new(color.orange, 0))
      s.plot0[i] = { time: b.time, value: 0, color: orange };
      // plot(plot_result, color = histColor, style = plot.style_columns, linewidth = 5)
      s.plot1[i] = { time: b.time, value: plotResult, color: histColor };
      // plot(plot_result > 0 ? 1 : -1, '[External Indicator 1 or -1]', display = display.none, editable = false)
      s.plot2[i] = { time: b.time, value: gt(plotResult, 0) ? 1 : -1 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        markers: [],
        barColors: cfg.colorBars ? s.barColors.slice() : [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceVolumeValueHistogramInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PriceVolumeValueHistogramInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceVolumeValueHistogram = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
