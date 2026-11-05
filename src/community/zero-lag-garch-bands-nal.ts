/**
 * Zero-Lag GARCH Bands
 *
 * Bands around a zero-lag EMA baseline (EMA of x + (x - x[lag]), lag = floor((length - 1) / 2), with x = EMA 10 of
 * the source). The half width is source / band pressure * 100 * GARCH volatility. The GARCH variance mixes the
 * long-run variance (SMA of the lagged one-bar variance), the squared lagged log return and the lagged one-bar
 * variance; its weights are fitted on each bar by a grid search: beta (1..99) then gamma (1..100 - beta), each the
 * candidate with the lowest sum of squared errors against the realized variance (SMA of the squared returns) over
 * the lookback. The volatility is the square root of a zero-lag EMA of that variance. A close above the upper band
 * gives the bullish colour, below the lower band the bearish colour; the colour is kept between. Glow lines,
 * gradient fills from the bands to the midline and coloured candles.
 *
 * Reference: "Zero-Lag GARCH Bands | NAL" by NordicAlphaLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © NordicAlphaLab
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ZeroLagGarchBandsNalInputs {
  /** Colour mode: Standard, Nordic or Simple */
  colMode: 'Standard' | 'Nordic' | 'Simple';
  /** GARCH lookback (window of the fit and of the variance averages) */
  garchLookback: number;
  /** Length of the zero-lag EMA of the GARCH variance */
  garchSmoothLen: number;
  /** Baseline source */
  baselineSrc: SourceType;
  /** Zero-lag EMA baseline length */
  baselineLen: number;
  /** Band pressure: a higher value gives a tighter band */
  bandPressure: number;
}

export const defaultInputs: ZeroLagGarchBandsNalInputs = {
  colMode: 'Standard',
  garchLookback: 30,
  garchSmoothLen: 60,
  baselineSrc: 'close',
  baselineLen: 52,
  bandPressure: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'colMode', type: 'string', title: 'Color Mode', defval: 'Standard', options: ['Standard', 'Nordic', 'Simple'] },
  { id: 'garchLookback', type: 'int', title: 'GARCH Lookback', defval: 30, min: 2 },
  { id: 'garchSmoothLen', type: 'int', title: 'GARCH ZLEMA Smoothing', defval: 60, min: 1 },
  { id: 'baselineSrc', type: 'source', title: 'Source', defval: 'close' },
  { id: 'baselineLen', type: 'int', title: 'Baseline Length', defval: 52, min: 1 },
  { id: 'bandPressure', type: 'int', title: 'Band Pressure', defval: 30, min: 5 },
];

const STANDARD_UP = String(color.rgb(0, 255, 200));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: STANDARD_UP, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: STANDARD_UP, lineWidth: 1 },
  { id: 'plot2', title: 'Midline', color: color.white, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Upper Band Glow', color: String(color.new(STANDARD_UP, 50)), lineWidth: 5, display: 'pane' },
  { id: 'plot4', title: 'Lower Band Glow', color: String(color.new(STANDARD_UP, 50)), lineWidth: 5, display: 'pane' },
];

export const metadata = {
  title: 'Zero-Lag GARCH Bands | NAL',
  shortTitle: 'Zero-Lag GARCH Bands',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; na operands give false */
const EPS = 1e-10;
const gt = (a: number, b: number): boolean => a - b > EPS;
const lt = (a: number, b: number): boolean => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };

interface GarchVars {
  /** score := close > upperBand ? 1 : close < lowerBand ? -1 : nz(score[1], 0) */
  score: number;
}

interface GarchRun extends BarRunState<GarchVars> {
  laggedVar: ReturnType<typeof taStep.variance>;
  realizedSma: ReturnType<typeof taStep.sma>;
  longRunSma: ReturnType<typeof taStep.sma>;
  lambdaSum: LoopSum;
  gammaSum: LoopSum;
  ema10: ReturnType<typeof taStep.ema>;
  baselineEma: ReturnType<typeof taStep.ema>;
  projectedEma: ReturnType<typeof taStep.ema>;
  close: number[];
  /** ta.ema(src, 10) and the GARCH variance: the sources of the two zero-lag EMAs */
  ema10Arr: number[];
  variance: number[];
  upper: number[];
  lower: number[];
  mid: number[];
  plotColor: string[];
  top: string[];
  bottom: string[];
  plots: Point[][];
  candles: PlotCandleData[];
}

function study(inputs: Partial<ZeroLagGarchBandsNalInputs>): BarStudy<GarchRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lookback = cfg.garchLookback;
  const nz = (v: number, r: number) => (isNaN(v) ? r : v);
  const srcOf = barSource(cfg.baselineSrc);

  const [colUp, colDn, colNu] = cfg.colMode === 'Nordic'
    ? [String(color.rgb(46, 161, 255)), String(color.rgb(150, 154, 169)), color.gray]
    : cfg.colMode === 'Simple'
      ? [color.lime, color.red, color.gray]
      : [STANDARD_UP, String(color.rgb(32, 94, 144)), color.gray];

  // f_zlema(source, len) = ta.ema(source + (source - source[lag]), len), lag = floor((len - 1) / 2)
  const baselineLag = Math.floor((cfg.baselineLen - 1) / 2);
  const projectedLag = Math.floor((cfg.garchSmoothLen - 1) / 2);
  const zlemaInput = (x: number[], i: number, lag: number) => (i >= lag ? x[i] + (x[i] - x[i - lag]) : NaN);

  const lambdaSse: number[] = new Array(99);
  const gammaSse: number[] = [];

  return {
    fullRunReason: () => (isBarSource(cfg.baselineSrc) ? null : 'source of another study'),
    init() {
      const s: GarchRun = {
        laggedVar: taStep.variance(), realizedSma: taStep.sma(), longRunSma: taStep.sma(),
        // math.sum(x, lookback) inside the two loops: one call site each. Its history has one value per bar (the value
        // of its last call in that bar), so each call gives x + the last values of the lookback - 1 previous bars.
        lambdaSum: new LoopSum(lookback), gammaSum: new LoopSum(lookback),
        ema10: taStep.ema(10), baselineEma: taStep.ema(cfg.baselineLen), projectedEma: taStep.ema(cfg.garchSmoothLen),
        close: [], ema10Arr: [], variance: [], upper: [], lower: [], mid: [], plotColor: [], top: [], bottom: [],
        plots: Array.from({ length: 5 }, () => []), candles: [],
        steps: [], vars: { score: 0 }, lists: [], series: [],
      };
      s.steps = [s.laggedVar, s.realizedSma, s.longRunSma, s.lambdaSum, s.gammaSum, s.ema10, s.baselineEma, s.projectedEma];
      s.series = [
        s.close, s.ema10Arr, s.variance, s.upper, s.lower, s.mid, s.plotColor, s.top, s.bottom, ...s.plots, s.candles,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = s.close;
      close[i] = b.close;

      // Lagged return / variance components
      const c1 = i >= 1 ? close[i - 1] : NaN;
      const c2 = i >= 2 ? close[i - 2] : NaN;
      const logReturn = !isNaN(c2) && gt(c1, 0.0) && gt(c2, 0.0) ? Math.log(c1 / c2) : 0.0;
      // nz(ta.variance(close[1], 1), 0.0): the variance of one value (running sums, as Pine)
      const lagged = nz(s.laggedVar.step(i >= 1 ? close[i - 1] : NaN, 1), 0.0);
      const sq = Math.pow(logReturn, 2.0);
      const realized = nz(s.realizedSma.step(sq, lookback), sq);
      const longRun = nz(s.longRunSma.step(lagged, lookback), lagged);

      for (let c = 1; c <= 99; c++) {
        const w = c / 100.0;
        const est = w * lagged + (1.0 - w) * sq;
        lambdaSse[c - 1] = s.lambdaSum.call(Math.pow(est - realized, 2.0));
      }
      const betaIndex = indexOfMin(lambdaSse) + 1;

      gammaSse.length = 0;
      for (let g = 1; g <= 100 - betaIndex; g++) {
        const bw = betaIndex / 100.0;
        const gw = g / 100.0;
        const aw = 1.0 - bw - gw;
        const est = gw * longRun + aw * sq + bw * lagged;
        gammaSse.push(s.gammaSum.call(Math.pow(est - realized, 2.0)));
      }
      const gammaIndex = indexOfMin(gammaSse) + 1;

      const beta = betaIndex / 100.0;
      const gamma = gammaIndex / 100.0;
      const alpha = 1.0 - beta - gamma;
      s.variance[i] = gamma * longRun + alpha * sq + beta * lagged;

      const src = srcOf(b);
      s.ema10Arr[i] = s.ema10.step(src);
      const baseline = s.baselineEma.step(zlemaInput(s.ema10Arr, i, baselineLag));
      const projected = s.projectedEma.step(zlemaInput(s.variance, i, projectedLag));

      const volMult = Math.sqrt(Math.max(projected, 0.0)) * 100.0;
      const upper = baseline + (src / cfg.bandPressure) * volMult;
      const lower = baseline - (src / cfg.bandPressure) * volMult;
      // score := close > upperBand ? 1 : close < lowerBand ? -1 : nz(score[1], 0)
      const score = gt(close[i], upper) ? 1 : lt(close[i], lower) ? -1 : s.vars.score;
      s.vars.score = score;
      // previousPlotColor = na(plotColor[1]) ? col_nu : plotColor[1]
      const prev = i > 0 ? s.plotColor[i - 1] : colNu;
      const plotColor = score === 1 ? colUp : score === -1 ? colDn : prev;
      const mid = (upper + lower) / 2;
      s.upper[i] = upper;
      s.lower[i] = lower;
      s.mid[i] = mid;
      s.plotColor[i] = plotColor;

      const glow = String(color.new(plotColor, 50));
      s.top[i] = String(color.new(plotColor, 30));
      s.bottom[i] = String(color.new(plotColor, 100));
      const time = b.time;
      s.plots[0][i] = { time, value: upper, color: plotColor };
      s.plots[1][i] = { time, value: lower, color: plotColor };
      s.plots[2][i] = { time, value: mid, color: color.white };
      s.plots[3][i] = { time, value: upper, color: glow };
      s.plots[4][i] = { time, value: lower, color: glow };
      s.candles[i] = {
        time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: plotColor, wickColor: plotColor, borderColor: plotColor, forceOverlay: true,
      };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        // fill(upperPlot, midPlot, upperBand, midLine, color.new(plotColor, 30), color.new(plotColor, 100)); same below
        fills: [
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Plots Background' },
            gradient: { topValue: s.upper.slice(), bottomValue: s.mid.slice(), topColor: s.top.slice(), bottomColor: s.bottom.slice() } },
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Plots Background' },
            gradient: { topValue: s.lower.slice(), bottomValue: s.mid.slice(), topColor: s.top.slice(), bottomColor: s.bottom.slice() } },
        ],
        // plotcandle(open, high, low, close, "Bar Color", plotColor, plotColor, bordercolor = plotColor,
        //            display = display.pane, force_overlay = true)
        plotCandles: { barColor: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZeroLagGarchBandsNalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZeroLagGarchBandsNalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * array.indexof(arr, array.min(arr)): array.min skips na; array.indexof compares as Pine `==` (within 1e-10), so it
 * gives the first value within 1e-10 of the smallest one; -1 when every value is na.
 */
function indexOfMin(values: number[]): number {
  let min = NaN;
  for (const v of values) if (!isNaN(v) && (isNaN(min) || v < min)) min = v;
  if (isNaN(min)) return -1;
  return values.findIndex((v) => !isNaN(v) && !(Math.abs(v - min) > EPS));
}

/**
 * Pine math.sum(x, len) of one call site called several times per bar (in a loop): each call gives x + the values
 * of the len - 1 previous bars where it ran (na before); the value kept for a bar is the one of its last call.
 */
class LoopSum {
  private readonly hist: number[] = [];
  private last = NaN;
  constructor(private readonly len: number) {}
  call(x: number): number {
    this.last = x;
    const h = this.hist.length;
    if (h < this.len - 1) return NaN;
    let s = x;
    for (let k = 1; k < this.len; k++) s += this.hist[h - k];
    return s;
  }
  commit(): void {
    this.hist.push(this.last);
    if (this.hist.length > this.len) this.hist.shift();
  }
}

export const ZeroLagGarchBandsNal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
