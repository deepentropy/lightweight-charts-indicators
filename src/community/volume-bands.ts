/**
 * Volume Bands
 *
 * The Hull MA (length round(sqrt(source length))) of the source is sampled on the bar of the highest volume of the
 * last `source length` bars (the oldest such bar on a tie); the bands are the median of that value over the median
 * length +/- ATR * multiplier. The trend turns long when the source closes above the upper band and short when it
 * closes below the lower band. In a long trend the lower band is drawn (green) and in a short trend the upper band
 * (pink), each filled to the close; labels mark the trend changes and the candles take the trend colour (grey before
 * the first trend).
 *
 * Reference: "Volume Bands" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeBandsInputs {
  /** Source */
  src: SourceType;
  /** Source length: volume window and sqrt(length) of the Hull MA */
  len: number;
  /** Median length */
  mlen: number;
  /** ATR length */
  vlen: number;
  /** Multiplier of the upper band */
  mulu: number;
  /** Multiplier of the lower band */
  muld: number;
}

export const defaultInputs: VolumeBandsInputs = {
  src: 'close',
  len: 14,
  mlen: 14,
  vlen: 14,
  mulu: 1.35,
  muld: 1.35,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len', type: 'int', title: 'Source Length', defval: 14 },
  { id: 'mlen', type: 'int', title: 'Median Length', defval: 14 },
  { id: 'vlen', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'mulu', type: 'float', title: 'Multiplier upper', defval: 1.35, step: 0.01 },
  { id: 'muld', type: 'float', title: 'Multiplier lower', defval: 1.35, step: 0.01 },
];

const LONG_COL = String(color.rgb(0, 255, 187));
const SHORT_COL = String(color.rgb(255, 0, 157));
const NEUTRAL_COL = String(color.rgb(72, 72, 72));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: LONG_COL, lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Lower', color: SHORT_COL, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Close', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Volume Bands',
  shortTitle: 'Volume Bands | MisinkoMaster',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };

interface BandsVars {
  /** var trend = 0 */
  trend: number;
}

interface BandsRun extends BarRunState<BandsVars> {
  hma: ReturnType<typeof taStep.hma>;
  hv: WindowExtreme;
  median: ReturnType<typeof taStep.median>;
  atr: ReturnType<typeof taStep.atr>;
  vol: number[];
  xm: number[];
  trend: number[];
  plots: Point[][];
  markers: MarkerData[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<VolumeBandsInputs>): BarStudy<BandsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const source = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: BandsRun = {
        // xm = ta.hma(src, math.round(math.sqrt(len)))
        hma: taStep.hma(Math.round(Math.sqrt(cfg.len))), hv: new WindowExtreme(false, cfg.len),
        median: taStep.median(cfg.mlen), atr: taStep.atr(cfg.vlen), vol: [], xm: [], trend: [],
        plots: [[], [], []], markers: [], candles: [],
        steps: [], vars: { trend: 0 }, lists: [], series: [],
      };
      s.steps = [s.hma, s.hv, s.median, s.atr];
      s.lists = [s.markers];
      s.series = [s.vol, s.xm, s.trend, ...s.plots, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const src = source(b);
      const vol = s.vol;
      const xm = s.xm;
      vol[i] = b.volume ?? NaN;
      xm[i] = s.hma.step(src);
      const hv = s.hv.step(vol[i]);
      // xr = 0.0; for i = 0 to len - 1: if volume[i] == ta.highest(volume, len): xr := xm[i] (the last match wins)
      let xr = 0.0;
      for (let k = 0; k <= cfg.len - 1; k++) {
        if (i - k >= 0 && eq(vol[i - k], hv)) xr = xm[i - k];
      }
      const x = s.median.step(xr);
      const atr = s.atr.step(b.high, b.low, b.close);
      const upper = x + atr * cfg.mulu;
      const lower = x - atr * cfg.muld;

      const L = gt(src, upper);
      const Sh = lt(src, lower);
      if (L && !Sh) s.vars.trend = 1;
      if (Sh) s.vars.trend = -1;
      const dir = s.vars.trend;
      s.trend[i] = dir;
      const upSeries = dir === 1 ? lower : NaN;
      const downSeries = dir === -1 ? upper : NaN;
      // var col = gray; trend == 1 -> green; trend == -1 -> pink
      const col = dir === 1 ? LONG_COL : dir === -1 ? SHORT_COL : NEUTRAL_COL;

      s.plots[0][i] = { time, value: upSeries, color: LONG_COL };
      s.plots[1][i] = { time, value: downSeries, color: SHORT_COL };
      // c = plot(close, display = display.none, editable = false)
      s.plots[2][i] = { time, value: b.close };

      if (i >= 1) {
        // plotshape(trend > trend[1] ? upSeries : na, shape.labelup, location.absolute, size.normal, ...)
        if (dir > s.trend[i - 1] && !isNaN(upSeries)) {
          s.markers.push({ time, position: 'atPriceBottom', price: upSeries, shape: 'labelUp', color: LONG_COL,
            size: 'normal', text: '𝓛𝓸𝓷𝓰', textColor: String(color.rgb(7, 83, 63)) });
        }
        // plotshape(trend < trend[1] ? downSeries : na, shape.labeldown, location.absolute, size.normal, ...)
        if (dir < s.trend[i - 1] && !isNaN(downSeries)) {
          s.markers.push({ time, position: 'atPriceTop', price: downSeries, shape: 'labelDown', color: SHORT_COL,
            size: 'normal', text: '𝓢𝓱𝓸𝓻𝓽', textColor: String(color.rgb(146, 11, 94)) });
        }
      }

      // plotcandle(open, high, low, close, color = col, bordercolor = col, wickcolor = col)
      s.candles[i] = {
        time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: col, borderColor: col, wickColor: col,
      };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice() },
        // fill(a, c, color.rgb(0, 255, 187, 50)); fill(b, c, color.rgb(255, 0, 157, 50))
        fills: [
          { plot1: 'plot0', plot2: 'plot2', options: { color: String(color.rgb(0, 255, 187, 50)) } },
          { plot1: 'plot1', plot2: 'plot2', options: { color: String(color.rgb(255, 0, 157, 50)) } },
        ],
        markers: s.markers.slice(),
        plotCandles: { PlotCandle: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeBandsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
