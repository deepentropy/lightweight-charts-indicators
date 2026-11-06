/**
 * Trend Predictor Ribbon
 *
 * A trailing stop around the Hull moving average of the source: long stop = HMA - multiplier * ATR, short stop =
 * HMA + multiplier * ATR (HMA and ATR over the trend length). In an up trend the stop only rises (max of the long stop
 * and the previous stop); in a down trend it only falls. The trend flips when the close crosses the stop, and the
 * stop jumps to the other side. The stop line and the ribbon between the close and the stop are green in an up trend
 * and red in a down trend; triangles mark the crosses of the close over / under the stop.
 *
 * Reference: "Trend Predictor Ribbon Clone - Fixed" by ronitjain18
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendPredictorRibbonInputs {
  /** Source of the HMA */
  src: SourceType;
  /** HMA and ATR length */
  length: number;
  /** ATR multiplier */
  multiplier: number;
}

export const defaultInputs: TrendPredictorRibbonInputs = {
  src: 'close',
  length: 10,
  multiplier: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'Trend Length', defval: 10, min: 1 },
  { id: 'multiplier', type: 'float', title: 'ATR Multiplier', defval: 2.0, min: 0.1 },
];

const BULL = String(color.new(color.green, 10));
const BEAR = String(color.new(color.red, 10));
const CLOUD_BULL = String(color.new(color.green, 85));
const CLOUD_BEAR = String(color.new(color.red, 85));
const FULLY_TRANSPARENT = String(color.new(color.blue, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Price Line', color: FULLY_TRANSPARENT, lineWidth: 1 },
  { id: 'plot1', title: 'Trend Line', color: BULL, lineWidth: 3 },
];

export const metadata = {
  title: 'Trend Predictor Ribbon Clone - Fixed',
  shortTitle: 'Trend Predictor Ribbon Clone - Fixed',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface TprVars {
  /** var float trendStop = na */
  trendStop: number;
  /** var int trendDir = 1 */
  trendDir: number;
}

interface TprRun extends BarRunState<TprVars> {
  atr: ReturnType<typeof taStep.atr>;
  hma: ReturnType<typeof taStep.hma>;
  stop: number[];
  pricePlot: Point[];
  stopPlot: Point[];
  fillColors: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<TrendPredictorRibbonInputs>): BarStudy<TprRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const atr = taStep.atr(cfg.length);
      const hma = taStep.hma(cfg.length);
      const s: TprRun = {
        atr, hma, stop: [], pricePlot: [], stopPlot: [], fillColors: [], markers: [],
        steps: [atr, hma], vars: { trendStop: NaN, trendDir: 1 }, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.stop, s.pricePlot, s.stopPlot, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const atr = s.atr.step(b.high, b.low, b.close);
      const hma = s.hma.step(value(b));
      const close = b.close;
      const longStop = hma - cfg.multiplier * atr;
      const shortStop = hma + cfg.multiplier * atr;
      let trendStop = v.trendStop;
      let trendDir = v.trendDir;
      if (isNaN(trendStop)) trendStop = hma;
      if (trendDir === 1 && lt(close, trendStop)) {
        trendDir = -1;
        trendStop = shortStop;
      } else if (trendDir === -1 && gt(close, trendStop)) {
        trendDir = 1;
        trendStop = longStop;
      } else {
        trendStop = trendDir === 1 ? max(longStop, trendStop) : min(shortStop, trendStop);
      }
      v.trendStop = trendStop;
      v.trendDir = trendDir;
      s.stop[i] = trendStop;

      const t = b.time;
      // plot(close, title = "Price Line", color = fullyTransparent)
      s.pricePlot[i] = { time: t, value: close, color: FULLY_TRANSPARENT };
      // plot(trendStop, title = "Trend Line", color = trendDir == 1 ? bullColor : bearColor, linewidth = 3)
      s.stopPlot[i] = { time: t, value: trendStop, color: trendDir === 1 ? BULL : BEAR };
      // fill(p_price, p_stop, color = trendDir == 1 ? cloudBull : cloudBear, title = "Trend Ribbon")
      s.fillColors[i] = trendDir === 1 ? CLOUD_BULL : CLOUD_BEAR;

      if (i < 1) return;
      const c1 = bars[i - 1].close;
      const stop1 = s.stop[i - 1];
      // ta.crossover / ta.crossunder compare exactly (no 1e-10 tolerance, unlike the operators)
      // plotshape(ta.crossover(close, trendStop), "Buy Signal", shape.triangleup, location.belowbar, color.green, size.small)
      if (close > trendStop && c1 <= stop1) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
      }
      // plotshape(ta.crossunder(close, trendStop), "Sell Signal", shape.triangledown, location.abovebar, color.red, size.small)
      if (close < trendStop && c1 >= stop1) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.pricePlot.slice(), plot1: s.stopPlot.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Trend Ribbon' }, colors: s.fillColors.slice() },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendPredictorRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendPredictorRibbonInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendPredictorRibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
