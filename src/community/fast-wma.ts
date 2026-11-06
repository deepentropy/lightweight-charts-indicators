/**
 * Fast WMA
 *
 * WMA of the source with an upper band (WMA * upper weight) and a lower band (WMA * lower weight), the source +-
 * its standard deviation, and the normalised WMA nwma = source / WMA(source, length) - 1. The signal turns long
 * when source - stdev is above the upper band and nwma is above the long threshold, short when source + stdev is
 * below the lower band and nwma is below the short threshold, and else keeps its value. The signal sets the colour
 * of the nwma line (in the pane), of the WMA lines, of the optional source bands and fills and of the candles (on
 * the price pane). Triangles one bar after a change of signal mark the new long / short state.
 *
 * Reference: "Fast WMA" by Clokivez
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Clokivez
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type FastWmaColorType = 'Trend' | 'ETHBTC' | 'SOLETH' | 'SOLBTC';

export interface FastWmaInputs {
  /** Colour scheme */
  coltype: FastWmaColorType;
  /** Colour the candles */
  bc: boolean;
  /** Draw the source +- stdev lines and the fills */
  pl: boolean;
  /** Source */
  wmasrc: SourceType;
  /** Length of the standard deviation of the source */
  wmasrclen: number;
  /** WMA length */
  wmalen: number;
  /** Upper band = WMA * this weight */
  wwl: number;
  /** Lower band = WMA * this weight */
  wws: number;
  /** Length of the WMA of the normalised WMA */
  nwmalen: number;
  /** Long threshold of the normalised WMA */
  lt: number;
  /** Short threshold of the normalised WMA */
  st: number;
}

export const defaultInputs: FastWmaInputs = {
  coltype: 'ETHBTC',
  bc: true,
  pl: false,
  wmasrc: 'close',
  wmasrclen: 13,
  wmalen: 10,
  wwl: 1.016,
  wws: 1.05,
  nwmalen: 26,
  lt: 0.03,
  st: 0.032,
};

export const inputConfig: InputConfig[] = [
  { id: 'coltype', type: 'string', title: 'Color Type', defval: 'ETHBTC', options: ['Trend', 'ETHBTC', 'SOLETH', 'SOLBTC'], group: 'Plots' },
  { id: 'bc', type: 'bool', title: 'Bar Color', defval: true, group: 'Plots' },
  { id: 'pl', type: 'bool', title: 'Plot Logic', defval: false, group: 'Plots' },
  { id: 'wmasrc', type: 'source', title: 'Source', defval: 'close', group: 'WMA' },
  { id: 'wmasrclen', type: 'int', title: 'Source Length', defval: 13, group: 'WMA' },
  { id: 'wmalen', type: 'int', title: 'WMA Length', defval: 10, group: 'WMA' },
  { id: 'wwl', type: 'float', title: 'WMA Upper Weight', defval: 1.016, step: 0.002, group: 'WMA' },
  { id: 'wws', type: 'float', title: 'WMA Lower Weight', defval: 1.05, step: 0.002, group: 'WMA' },
  { id: 'nwmalen', type: 'int', title: 'Length', defval: 26, group: 'NWMA' },
  { id: 'lt', type: 'float', title: 'Long Threshold', defval: 0.03, step: 0.005, group: 'NWMA' },
  { id: 'st', type: 'float', title: 'Short Threshold', defval: 0.032, step: 0.005, group: 'NWMA' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'NMA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'WMA', color: color.blue, lineWidth: 3, forceOverlay: true },
  { id: 'plot2', title: 'Upper Band', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot3', title: 'Lower Band', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot4', title: 'Upper Source SD', color: color.blue, lineWidth: 1, forceOverlay: true },
  { id: 'plot5', title: 'Lower Source SD', color: color.blue, lineWidth: 1, forceOverlay: true },
];

export const metadata = {
  title: 'Fast WMA',
  shortTitle: 'WMA',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const COLOURS: Record<FastWmaColorType, [string, string]> = {
  Trend: [color.lime, color.red],
  ETHBTC: [color.yellow, color.blue],
  SOLETH: [color.green, color.yellow],
  SOLBTC: [color.green, color.blue],
};

type Point = { time: number; value: number; color: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };

interface FastWmaRun extends BarRunState<{ prevSignal: number }> {
  wma: ReturnType<typeof taStep.wma>;
  wcd: WindowStdev;
  wmaN: ReturnType<typeof taStep.wma>;
  arrowL: ReturnType<typeof taStep.crossover>;
  arrowS: ReturnType<typeof taStep.crossunder>;
  col: string[];
  plots: Point[][];
  fill80: string[];
  fill95: string[];
  candles: PlotCandleData[];
  /** Bars of the arrows (drawn one bar later) and their kind (0: buy, 1: sell) */
  arrowBars: number[];
  arrowKinds: number[];
}

function study(inputs: Partial<FastWmaInputs>): BarStudy<FastWmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.wmasrc);
  const [upCol, downCol] = COLOURS[cfg.coltype] ?? COLOURS.ETHBTC;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.wmasrc) ? null : 'source of another study'),
    init() {
      const s: FastWmaRun = {
        wma: taStep.wma(), wcd: new WindowStdev(cfg.wmasrclen), wmaN: taStep.wma(), arrowL: taStep.crossover(),
        arrowS: taStep.crossunder(), col: [], plots: [[], [], [], [], [], []], fill80: [], fill95: [], candles: [],
        arrowBars: [], arrowKinds: [], steps: [], vars: { prevSignal: NaN }, lists: [], series: [],
      };
      s.steps = [s.wma, s.wcd, s.wmaN, s.arrowL, s.arrowS];
      s.lists = [s.arrowBars, s.arrowKinds];
      s.series = [s.col, ...s.plots, s.fill80, s.fill95, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      const src = value(b);
      const wma = s.wma.step(src, cfg.wmalen);
      const wcd = s.wcd.step(src);
      const wmaN = s.wmaN.step(src, cfg.nwmalen);

      const wmah = wma * cfg.wwl;
      const wmal = wma * cfg.wws;
      const wcsdh = src + wcd;
      const wcsdl = src - wcd;
      // plain division: x / 0 is +-infinity (the comparisons use it, the plot shows na)
      const nwma = src / wmaN - 1;
      const long = gt(wcsdl, wmah) && gt(nwma, cfg.lt);
      const short = lt(wcsdh, wmal) && lt(nwma, cfg.st);
      // Signal := Long ? 1 : Short ? -1 : Signal[1]
      const signal = long ? 1 : short ? -1 : v.prevSignal;
      v.prevSignal = signal;
      const col = gt(signal, 0) ? upCol : downCol;
      s.col[i] = col;

      const sdCol = cfg.pl ? col : 'transparent';
      const p = s.plots;
      p[0][i] = { time, value: fin(nwma), color: col };
      p[1][i] = { time, value: fin(wma), color: col };
      p[2][i] = { time, value: fin(wmah), color: col };
      p[3][i] = { time, value: fin(wmal), color: col };
      p[4][i] = { time, value: fin(wcsdh), color: sdCol };
      p[5][i] = { time, value: fin(wcsdl), color: sdCol };

      // fill(wmalplot, wmahplot, pl ? color.new(col, 80) : na); fill(sdhplot, sdlplot, pl ? color.new(col, 95) : na)
      s.fill80[i] = cfg.pl ? String(color.new(col, 80)) : 'transparent';
      s.fill95[i] = cfg.pl ? String(color.new(col, 95)) : 'transparent';

      // plotcandle(open, high, low, close, "Bar Color", bcol, bcol, bordercolor = bcol, force_overlay = true)
      const c = cfg.bc ? col : 'transparent';
      s.candles[i] = { time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c,
        borderColor: c, forceOverlay: true };

      // plotshape(ta.crossover(Signal, 0), "Real Buy", shape.triangleup, location.belowbar, col, offset = 1, size.tiny)
      // plotshape(ta.crossunder(Signal, 0), "Real Sell", shape.triangledown, location.abovebar, col, offset = 1, size.tiny)
      // (placed in the result: the time of the next bar)
      if (s.arrowL.step(signal, 0)) { s.arrowBars.push(i); s.arrowKinds.push(0); }
      if (s.arrowS.step(signal, 0)) { s.arrowBars.push(i); s.arrowKinds.push(1); }
    },
    result(s, bars) {
      const n = bars.length;
      const ab = s.arrowBars;
      // the time of the bar after the last one: the bar interval of the whole set
      const interval = ab.length > 0 && ab[ab.length - 1] + 1 >= n ? barInterval(bars) : undefined;
      const markers: MarkerData[] = [];
      for (let k = 0; k < ab.length; k++) {
        const i = ab[k];
        const time = barTime(bars, i + 1, interval);
        if (s.arrowKinds[k] === 0) {
          markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: s.col[i], size: 'tiny', forceOverlay: true });
        } else {
          markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: s.col[i], size: 'tiny', forceOverlay: true });
        }
      }
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
        hlines: [
          { value: cfg.lt, options: { title: 'Long Threshold', color: color.green, linestyle: 'dashed' } },
          { value: cfg.st, options: { title: 'Short Threshold', color: color.red, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'plot3', plot2: 'plot2', options: { title: 'Plots Background' }, colors: s.fill80.slice() },
          { plot1: 'plot4', plot2: 'plot5', options: { title: 'Plots Background' }, colors: s.fill95.slice() },
        ],
        markers,
        plotCandles: { barColor: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FastWmaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FastWmaInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const FastWma = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
