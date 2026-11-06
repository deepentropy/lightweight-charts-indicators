/**
 * Loacally Weighted MA (LWMA) Direction Histogram
 *
 * The LWMA is a linearly weighted average of the last `length` source values (weight length for the current bar,
 * down to 1 for the oldest). The histogram is LWMA - LWMA[lookback]: blue columns when it is >= 0, yellow otherwise.
 * The price candles take the histogram colour. The LWMA line itself is hidden by default.
 *
 * Reference: "Loacally Weighted MA (LWMA) Direction Histogram" by LuxmiAI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxmiAI
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LoacallyWeightedMaDirectionHistogramInputs {
  /** LWMA length */
  length: number;
  /** Bars back of the LWMA difference */
  dir: number;
  source: SourceType;
}

export const defaultInputs: LoacallyWeightedMaDirectionHistogramInputs = {
  length: 60,
  dir: 1,
  source: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'LWMA Length', defval: 60, min: 1 },
  { id: 'dir', type: 'int', title: 'LWMA Direction Lookback', defval: 1, min: 1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
];

const ABOVE = String(color.new(color.blue, 0));
const BELOW = String(color.new(color.yellow, 0));
const LINE = String(color.new(color.aqua, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA Direction Histogram', color: ABOVE, lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'Plot LWMA', color: LINE, lineWidth: 1, display: 'none', forceOverlay: true },
];

export const metadata = {
  title: 'Loacally Weighted MA (LWMA) Direction Histogram',
  shortTitle: 'Loacally Weighted MA (LWMA) Direction Histogram',
  overlay: false,
};

/** Pine a >= b: false with na, else not (b - a > 1e-10) */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };

interface LwmaRun extends BarRunState<Record<string, never>> {
  src: number[];
  lwma: number[];
  plot0: Point[];
  plot1: Point[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<LoacallyWeightedMaDirectionHistogramInputs>): BarStudy<LwmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.length;
  const value = barSource(cfg.source);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: LwmaRun = { src: [], lwma: [], plot0: [], plot1: [], candles: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.src, s.lwma, s.plot0, s.plot1, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = s.src;
      src[i] = value(b);
      // lwma(src, len): sum of src[i] * (len - i) for i = 0..len-1, divided by the sum of the weights (na when a value
      // of the window is na or before the first bar)
      let totalWeight = 0;
      let weightedSum = 0;
      for (let k = 0; k <= len - 1; k++) {
        const w = len - k;
        totalWeight += w;
        weightedSum += (i - k >= 0 ? src[i - k] : NaN) * w;
      }
      const lwma = weightedSum / totalWeight;
      s.lwma[i] = lwma;
      // histogram = lwmaLine - lwmaLine[dir]
      const hist = i - cfg.dir >= 0 ? lwma - s.lwma[i - cfg.dir] : NaN;
      const col = ge(hist, 0) ? ABOVE : BELOW;
      // plotcandle(open, high, low, close, color / wickcolor / bordercolor = candlecolor, force_overlay = true)
      s.candles[i] = {
        time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: col, wickColor: col, borderColor: col, forceOverlay: true,
      };
      // plot(histogram, style = plot.style_columns, color = histogram >= 0 ? above_color : below_color, linewidth = 2)
      s.plot0[i] = { time: b.time, value: fin(hist), color: col };
      // plot(lwmaLine, color = color.new(color.aqua, 0), force_overlay = true, display = display.none)
      s.plot1[i] = { time: b.time, value: fin(lwma), color: LINE };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        plotCandles: { histogramColoredCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LoacallyWeightedMaDirectionHistogramInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LoacallyWeightedMaDirectionHistogramInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const LoacallyWeightedMaDirectionHistogram = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
