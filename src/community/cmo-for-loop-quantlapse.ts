/**
 * CMO For Loop | QuantLapse
 *
 * Chande Momentum Oscillator: 100 * (up - down) / (up + down), with up / down the sums over `length` bars of the
 * positive / negative changes of the source. The trend turns long when the CMO is above the long threshold and short
 * when it is below the short threshold; it colours the CMO histogram and the price candles. Triangles on the price
 * pane mark a change of trend; the two thresholds are drawn as lines with a fill between them.
 *
 * Reference: "CMO For Loop | QuantLapse" by QuantLapse
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Chande Momentum Oscillator script may be freely distributed under the MIT license.
 * Creds to Alex Orekhov (everget)
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CmoForLoopQuantlapseInputs {
  /** CMO length */
  length: number;
  /** Source */
  src: SourceType;
  /** Long threshold */
  LongThreshold: number;
  /** Short threshold */
  ShortThreshold: number;
}

export const defaultInputs: CmoForLoopQuantlapseInputs = {
  length: 14,
  src: 'close',
  LongThreshold: 25,
  ShortThreshold: -25,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'LongThreshold', type: 'int', title: 'Long Threshold', defval: 25 },
  { id: 'ShortThreshold', type: 'int', title: 'Short Threshold', defval: -25 },
];

const LONG_COL = '#0dfb84';
const SHORT_COL = '#f8274a';
const FILL_COL = String(color.new(color.purple, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Overbought Level', color: color.white, lineWidth: 1 },
  { id: 'plot1', title: 'Oversold Level', color: color.white, lineWidth: 1 },
  { id: 'plot2', title: 'CMO For Loop', color: color.gray, lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'CMO For Loop | QuantLapse',
  shortTitle: 'CMO For Loop ✧˚ | QuantLapse',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };

interface CmoVars {
  /** var trend_CMO = 0 */
  trendCMO: number;
  prevSignalL: boolean;
  prevSignalS: boolean;
}

interface CmoRun extends BarRunState<CmoVars> {
  change: ReturnType<typeof taStep.change>;
  sumUp: WindowSum;
  sumDown: WindowSum;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  candles: PlotCandleData[];
  markers: MarkerData[];
}

function study(inputs: Partial<CmoForLoopQuantlapseInputs>): BarStudy<CmoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, LongThreshold, ShortThreshold } = cfg;
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const change = taStep.change();
      const sumUp = new WindowSum(length);
      const sumDown = new WindowSum(length);
      const s: CmoRun = {
        change, sumUp, sumDown, plot0: [], plot1: [], plot2: [], candles: [], markers: [],
        steps: [change, sumUp, sumDown], vars: { trendCMO: 0, prevSignalL: false, prevSignalS: false }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1, s.plot2, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const m = s.change.step(value(b));
      // math.max(na, 0) / math.min(na, 0) are na
      const sumUp = s.sumUp.step(isNaN(m) ? NaN : Math.max(m, 0));
      const sumDown = s.sumDown.step(isNaN(m) ? NaN : -Math.min(m, 0));
      // plain division: 0 / 0 is na
      const cmo = (100 * (sumUp - sumDown)) / (sumUp + sumDown);
      const longCondition1 = gt(cmo, LongThreshold);
      const shortCondition1 = lt(cmo, ShortThreshold);
      if (longCondition1 && !shortCondition1) v.trendCMO = 1;
      else if (shortCondition1) v.trendCMO = -1;
      const signalL = v.trendCMO === 1;
      const signalS = v.trendCMO === -1;
      // signalS[1] / signalL[1]: false on bar 0 (na history)
      const signalL1 = signalL && i > 0 && v.prevSignalS;
      const signalS1 = signalS && i > 0 && v.prevSignalL;
      v.prevSignalL = signalL;
      v.prevSignalS = signalS;

      const trendcolor = v.trendCMO === 1 ? LONG_COL : v.trendCMO === -1 ? SHORT_COL : color.gray;
      s.plot0[i] = { time, value: LongThreshold, color: color.white };
      s.plot1[i] = { time, value: ShortThreshold, color: color.white };
      s.plot2[i] = { time, value: Number.isFinite(cmo) ? cmo : NaN, color: trendcolor };
      // plotshape(signalL1, color = #0dfb84, style = shape.triangleup, location = location.belowbar, force_overlay = true, size = size.small)
      if (signalL1) s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: LONG_COL, size: 'small', forceOverlay: true });
      if (signalS1) s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: SHORT_COL, size: 'small', forceOverlay: true });
      // plotcandle(open, high, low, close, "Color", color = trendcolor, wickcolor = trendcolor, bordercolor = trendcolor, force_overlay = true)
      s.candles[i] = { time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: trendcolor, wickColor: trendcolor, borderColor: trendcolor, forceOverlay: true };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        // hline(0, title = 'Zero Level', linestyle = hline.style_dotted): Pine default colour #787B86
        hlines: [{ value: 0, options: { title: 'Zero Level', color: '#787B86', linestyle: 'dotted' } }],
        // fill(plotLong, plotShort, color = color.new(color.purple, 90))
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background', color: FILL_COL } }],
        markers: s.markers.slice(),
        plotCandles: { cmoCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CmoForLoopQuantlapseInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CmoForLoopQuantlapseInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CmoForLoopQuantlapse = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
