/**
 * HMA Breakdown
 *
 * The parts of a Hull moving average: the WMA of the close over `length` (full) and over length / 2 (half), a lower
 * band full - (half - full), the HMA = WMA(2 * half - full, int(sqrt(length))) and its signal WMA(HMA, int(sqrt(length))).
 * The WMA lines take the up colour when the half WMA is above the full WMA, the HMA and signal lines when the HMA is
 * above the signal; fills join the lower band and the half WMA (gradient) and the signal and the HMA. An optional
 * pair of EMAs (10 / 12) of WMA(SMA(close, 3), 5) is lime / red by their cross, with a fill between them.
 * "TMA Candle": candles from tma[gap] to tma (tma = WMA(half WMA, length / 2), gap = 'Candle Lookback'), up colour
 * when tma rises over the gap; hidden by default (display.none in the original).
 *
 * Reference: "HMA Breakdown [NLR]" by NonLinearRookie
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NonLinearRookie
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HmaBreakdownInputs {
  /** HMA length */
  length: number;
  /** Candle Lookback: bars back of the TMA candle open */
  candleGap: number;
  /** Uptrend colour */
  up: string;
  /** Downtrend colour */
  down: string;
  /** Show the two EMAs */
  showMaCross: boolean;
  /** Fast EMA length */
  fastLength: number;
  /** Slow EMA length */
  slowLength: number;
}

export const defaultInputs: HmaBreakdownInputs = {
  length: 50,
  candleGap: 1,
  up: color.lime,
  down: color.fuchsia,
  showMaCross: true,
  fastLength: 10,
  slowLength: 12,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'HMA Length', defval: 50 },
  { id: 'candleGap', type: 'int', title: 'Candle Lookback', defval: 1 },
  { id: 'up', type: 'color', title: 'Uptrend Color', defval: color.lime },
  { id: 'down', type: 'color', title: 'Downtrend Color', defval: color.fuchsia },
  { id: 'showMaCross', type: 'bool', title: 'Show EMA Cross', defval: true },
  { id: 'fastLength', type: 'int', title: 'Fast EMA Length', defval: 10 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA Length', defval: 12 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WMA Half', color: color.lime, lineWidth: 1 },
  { id: 'plot1', title: 'WMA Full', color: color.lime, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: color.lime, lineWidth: 2 },
  { id: 'plot3', title: 'Signal', color: String(color.new(color.lime, 50)), lineWidth: 1 },
  { id: 'plot4', title: 'HMA', color: color.lime, lineWidth: 2 },
  { id: 'plot5', title: 'Fast EMA', color: String(color.new(color.lime, 70)), lineWidth: 1 },
  { id: 'plot6', title: 'Slow EMA', color: color.lime, lineWidth: 1 },
];

/** plotcandle(tmax, tma, tmax, tma, "TMA Candle", ..., display = display.none) */
export const plotCandleConfig = [{ id: 'tmaCandle', title: 'TMA Candle', display: 'none' as const }];

/** Pine plotcandle without wickcolor / bordercolor: the style defaults of the plot */
const CANDLE_WICK = '#737375';
const CANDLE_BORDER = '#000000';

export const metadata = {
  title: 'HMA Breakdown [NLR]',
  shortTitle: 'HMA Breakdown [NLR]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };
type Wma = ReturnType<typeof taStep.wma>;

interface HmaRun extends BarRunState<Record<string, never>> {
  full: Wma;
  half: Wma;
  hma: Wma;
  signal: Wma;
  sma3: WindowSma;
  wma5: Wma;
  mx1: ReturnType<typeof taStep.ema>;
  mx2: ReturnType<typeof taStep.ema>;
  tmaWma: Wma;
  tma: number[];
  lower: number[];
  wmaHalf: number[];
  lowerFill: string[];
  hmaFill: string[];
  mxFill: string[];
  plots: Point[][];
  tmaCandles: PlotCandleData[];
}

function study(inputs: Partial<HmaBreakdownInputs>): BarStudy<HmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // sqrt_len = int(math.sqrt(length)); half_len = length / 2 (int division of two ints)
  const sqrtLen = Math.trunc(Math.sqrt(cfg.length));
  const halfLen = Math.trunc(cfg.length / 2);
  const gap = Math.trunc(cfg.candleGap);
  // the colours with their transparencies
  const tr = (c: string, t: number) => String(color.new(c, t));
  const up = { c: cfg.up, t50: tr(cfg.up, 50), t90: tr(cfg.up, 90) };
  const down = { c: cfg.down, t50: tr(cfg.down, 50), t90: tr(cfg.down, 90) };
  const mxUp = { c: color.lime as string, t70: tr(color.lime, 70), t80: tr(color.lime, 80) };
  const mxDown = { c: '#ff0000', t70: tr('#ff0000', 70), t80: tr('#ff0000', 80) };
  // plotcandle(tmax, tma, tmax, tma, "TMA Candle", tma > tmax ? up : down): no candle when a value is na
  const candle = (time: number, tmax: number, tma: number): PlotCandleData => ({
    time, open: tmax, high: tma, low: tmax, close: tma,
    color: gt(tma, tmax) ? cfg.up : cfg.down, wickColor: CANDLE_WICK, borderColor: CANDLE_BORDER,
  });
  return {
    init() {
      const s: HmaRun = {
        full: taStep.wma(), half: taStep.wma(), hma: taStep.wma(), signal: taStep.wma(), sma3: new WindowSma(3),
        wma5: taStep.wma(), mx1: taStep.ema(cfg.fastLength), mx2: taStep.ema(cfg.slowLength), tmaWma: taStep.wma(),
        tma: [], lower: [], wmaHalf: [], lowerFill: [], hmaFill: [], mxFill: [], plots: Array.from({ length: 7 }, () => []),
        tmaCandles: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.full, s.half, s.hma, s.signal, s.sma3, s.wma5, s.mx1, s.mx2, s.tmaWma];
      s.lists = [s.tmaCandles];
      s.series = [s.tma, s.lower, s.wmaHalf, s.lowerFill, s.hmaFill, s.mxFill, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;
      const wmaFull = s.full.step(close, cfg.length);
      const wmaHalf = s.half.step(close, halfLen);
      const hma = s.hma.step(2 * wmaHalf - wmaFull, sqrtLen);
      const signal = s.signal.step(hma, sqrtLen);
      const lower = wmaFull - (wmaHalf - wmaFull);

      // src2 = ta.wma(ta.sma(close, 3), 5); mx1 / mx2 = ta.ema(src2, fast / slow)
      const src2 = s.wma5.step(s.sma3.step(close), 5);
      const mx1 = s.mx1.step(src2);
      const mx2 = s.mx2.step(src2);

      const wmaClr = gt(wmaHalf, wmaFull) ? up : down;
      const hmaClr = gt(hma, signal) ? up : down;
      const mxClr = gt(mx1, mx2) ? mxUp : mxDown;
      // tma = ta.wma(wma_half, half_len); tmax = tma[candle_gap]
      const tma = s.tmaWma.step(wmaHalf, halfLen);
      s.tma[i] = tma;
      if (gap >= 0) {
        const tmax = i - gap >= 0 ? s.tma[i - gap] : NaN;
        if (!(isNaN(tmax) || isNaN(tma))) s.tmaCandles.push(candle(time as number, tmax, tma));
      }

      s.lower[i] = lower;
      s.wmaHalf[i] = wmaHalf;
      s.plots[0][i] = { time, value: wmaHalf, color: wmaClr.c };
      s.plots[1][i] = { time, value: wmaFull, color: wmaClr.c };
      s.plots[2][i] = { time, value: lower, color: wmaClr.c };
      s.plots[3][i] = { time, value: signal, color: hmaClr.t50 };
      s.plots[4][i] = { time, value: hma, color: hmaClr.c };
      s.plots[5][i] = { time, value: cfg.showMaCross ? mx1 : NaN, color: mxClr.t70 };
      s.plots[6][i] = { time, value: cfg.showMaCross ? mx2 : NaN, color: mxClr.c };
      s.lowerFill[i] = wmaClr.t90;
      s.hmaFill[i] = hmaClr.t90;
      s.mxFill[i] = mxClr.t80;
    },
    result(s, bars) {
      const n = bars.length;
      let tmaCandles = s.tmaCandles.slice();
      if (gap < 0) {
        // a negative lookback reads later bars: the candles of every bar from the whole set
        tmaCandles = [];
        for (let i = 0; i < n; i++) {
          const tmax = i - gap >= 0 && i - gap < n ? s.tma[i - gap] : NaN;
          if (isNaN(tmax) || isNaN(s.tma[i])) continue;
          tmaCandles.push(candle(bars[i].time as number, tmax, s.tma[i]));
        }
      }
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          // fill(plowr, phalf, lower, wma_half, color.new(wma_clr, 90), na)
          { plot1: 'plot2', plot2: 'plot0', options: { title: 'Lower Band / WMA Half' },
            gradient: {
              topValue: s.lower.slice(),
              bottomValue: s.wmaHalf.slice(),
              topColor: s.lowerFill.slice(),
              bottomColor: new Array<string | null>(n).fill(null),
            } },
          // fill(psig, phma, color.new(hma_clr, 90))
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Signal / HMA' }, colors: s.hmaFill.slice() },
          // fill(pmx1, pmx2, color.new(mxclr, 80))
          { plot1: 'plot5', plot2: 'plot6', options: { title: 'Fast / Slow EMA' }, colors: s.mxFill.slice() },
        ],
        plotCandles: { tmaCandle: tmaCandles },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HmaBreakdownInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HmaBreakdownInputs> = {},
): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  return fullResult(createRun(inputs).update(bars));
}

export const HmaBreakdown = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
};
