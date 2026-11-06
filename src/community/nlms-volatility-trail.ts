/**
 * NLMS Volatility Trail
 *
 * A Normalized Least Mean Squares (Widrow-Hoff) adaptive filter predicts each bar from the previous M bars of the
 * source: pred = sum(w[i] * src[i + 1]), then the weights learn from the error (w += mu / (eps + |x|^2) * err * x),
 * starting from equal weights 1 / M. The trail follows the prediction inside an ATR band: it keeps its previous value
 * unless the prediction -/+ ATR * factor pushes it up / down. The trend turns long when the trail rises, short when
 * it falls. Candles, the trail and a glow take the trend colour; gradient fills join the trail and the close.
 * The Pine 'Line Width' input is not ported: plot widths are fixed by plotConfig (the Pine default, 3). The Pine
 * 'Color Bars' input is not ported: the script does not use it (the trend candles are always drawn).
 *
 * Alerts (alertcondition, `alerts` of the result): "NLMS ATR Bullish" (the trail crosses over its previous value)
 * and "NLMS ATR Bearish" (it crosses under it).
 *
 * Reference: "NLMS Volatility Trail [BackQuant]" by BackQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BackQuant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'NLMS ATR Bullish', message: 'NLMS ATR Trend turned bullish on {{ticker}}' },
  { id: 'alert1', title: 'NLMS ATR Bearish', message: 'NLMS ATR Trend turned bearish on {{ticker}}' },
];

export interface NlmsVolatilityTrailInputs {
  src: SourceType;
  /** Filter taps (M): number of past bars with a learned weight */
  taps: number;
  /** Step size (mu): learning rate */
  mu: number;
  /** Regularization (epsilon) of the input power */
  eps: number;
  /** ATR period */
  periodAtr: number;
  /** ATR factor of the band */
  factorAtr: number;
  longCol: string;
  shortCol: string;
  showFill: boolean;
  showGlow: boolean;
}

export const defaultInputs: NlmsVolatilityTrailInputs = {
  src: 'close',
  taps: 72,
  mu: 0.195,
  eps: 0.6,
  periodAtr: 14,
  factorAtr: 1.7,
  longCol: '#00ff00',
  shortCol: '#ff0000',
  showFill: true,
  showGlow: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'taps', type: 'int', title: 'Filter Taps (M)', defval: 72, min: 2, max: 200 },
  { id: 'mu', type: 'float', title: 'Step Size (μ)', defval: 0.195, min: 0.001, max: 1.5, step: 0.001 },
  { id: 'eps', type: 'float', title: 'Regularization (ε)', defval: 0.6, min: 0.0, step: 0.1 },
  { id: 'periodAtr', type: 'int', title: 'Period', defval: 14 },
  { id: 'factorAtr', type: 'float', title: 'Factor', defval: 1.7, step: 0.01 },
  { id: 'longCol', type: 'color', title: 'Long Color', defval: '#00ff00' },
  { id: 'shortCol', type: 'color', title: 'Short Color', defval: '#ff0000' },
  { id: 'showFill', type: 'bool', title: 'Gradient Fill', defval: true },
  { id: 'showGlow', type: 'bool', title: 'Trail Glow', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trail Ref', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Price Ref', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Glow Lower Ref', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Glow Upper Ref', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'NLMS ATR', color: '#00ff00', lineWidth: 3 },
];

export const metadata = {
  title: 'NLMS Volatility Trail [BackQuant]',
  shortTitle: 'NLMS Volatility Trail [BackQuant]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

interface NlmsVars {
  /** var w = array.new_float(M, 1.0 / M) (changed in place) */
  w: number[];
  /** var color col = na */
  col: string;
  trendDir: number;
}

interface NlmsRun extends BarRunState<NlmsVars> {
  atr: ReturnType<typeof taStep.atr>;
  glowAtr: ReturnType<typeof taStep.atr>;
  src: number[];
  trail: number[];
  plots: Point[][];
  /** bull top / bottom value, top / bottom colour, then the bear ones */
  grad: (number | string | null)[][];
  glowColors: string[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<NlmsVolatilityTrailInputs>): BarStudy<NlmsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const M = cfg.taps;
  const bullTop = String(color.new(cfg.longCol, 90));
  const bullBottom = String(color.new(cfg.longCol, 20));
  const bearTop = String(color.new(cfg.shortCol, 20));
  const bearBottom = String(color.new(cfg.shortCol, 90));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: NlmsRun = {
        atr: taStep.atr(cfg.periodAtr), glowAtr: taStep.atr(14), src: [], trail: [],
        plots: Array.from({ length: 5 }, () => []), grad: Array.from({ length: 8 }, () => []), glowColors: [],
        candles: [], flags: [[], []], times: [[], []], steps: [],
        vars: { w: new Array(M).fill(1.0 / M), col: 'transparent', trendDir: 0 }, lists: [], series: [],
      };
      s.steps = [s.atr, s.glowAtr];
      s.lists = s.times;
      s.series = [s.src, s.trail, ...s.plots, ...s.grad, s.glowColors, s.candles, ...s.flags];
      return s;
    },
    bar(s, b, bars) {
      const bar = bars[b];
      const time = bar.time;
      const v = s.vars;
      const src = s.src;
      src[b] = value(bar);
      // NLMS one-step predictor: var w = array.new_float(M, 1.0 / M), updated from bar_index >= M
      let raw = NaN;
      if (b >= M) {
        const w = v.w;
        let pred = 0.0;
        let power = 0.0;
        for (let i = 0; i < M; i++) {
          const xi = src[b - i - 1];
          pred += w[i] * xi;
          power += xi * xi;
        }
        const err = src[b] - pred;
        const k = cfg.mu / (cfg.eps + power);
        for (let i = 0; i < M; i++) w[i] = w[i] + k * err * src[b - i - 1];
        raw = pred;
      }

      // Trail: nz(trail[1], nlms) clamped into nlms +/- atr * factor
      const atr = s.atr.step(bar.high, bar.low, bar.close);
      const tr = atr * cfg.factorAtr;
      const trail = s.trail;
      let t = b > 0 && !isNaN(trail[b - 1]) ? trail[b - 1] : raw;
      const upper = raw + tr;
      const lower = raw - tr;
      if (gt(lower, t)) t = lower;
      if (lt(upper, t)) t = upper;
      trail[b] = t;

      const glowAtr = s.glowAtr.step(bar.high, bar.low, bar.close);
      // ta.crossover(trail, trail[1]): trail > trail[1] and trail[1] <= trail[2], compared exactly (no 1e-10 tolerance)
      const a1 = b > 0 ? trail[b - 1] : NaN;
      const a2 = b > 1 ? trail[b - 2] : NaN;
      const long = t > a1 && a1 <= a2;
      const short = t < a1 && a1 >= a2;
      if (long) v.col = cfg.longCol;
      else if (short) v.col = cfg.shortCol;
      if (long) v.trendDir = 1;
      else if (short) v.trendDir = -1;
      const lineColor = v.col;
      const trendCol = v.trendDir === 1 ? cfg.longCol : v.trendDir === -1 ? cfg.shortCol : color.gray;
      [long, short].forEach((f, k) => {
        s.flags[k][b] = f;
        if (f) s.times[k].push(time as number);
      });

      const close = bar.close;
      const glow = glowAtr * 0.06;
      const above = gt(close, t);
      const below = lt(close, t);
      const g = s.grad;
      // fill(pPrice, pTrail, close > trail ? close : trail, close > trail ? trail : close,
      //      showFill and close > trail ? color.new(longCol, 90) : na, showFill and close > trail ? color.new(longCol, 20) : na)
      g[0][b] = above ? close : t;
      g[1][b] = above ? t : close;
      g[2][b] = cfg.showFill && above ? bullTop : null;
      g[3][b] = cfg.showFill && above ? bullBottom : null;
      // fill(pPrice, pTrail, close < trail ? trail : close, close < trail ? close : trail,
      //      showFill and close < trail ? color.new(shortCol, 20) : na, showFill and close < trail ? color.new(shortCol, 90) : na)
      g[4][b] = below ? t : close;
      g[5][b] = below ? close : t;
      g[6][b] = cfg.showFill && below ? bearTop : null;
      g[7][b] = cfg.showFill && below ? bearBottom : null;
      // fill(pTrail, pGlowUp / pGlowDn, showGlow ? color.new(trendCol, 55) : na)
      s.glowColors[b] = cfg.showGlow ? String(color.new(trendCol, 55)) : 'transparent';

      // plotcandle(open, high, low, close, "Trend Candles", trendCol, trendCol, bordercolor = trendCol)
      s.candles[b] = {
        time, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        color: trendCol, wickColor: trendCol, borderColor: trendCol,
      };
      const p = s.plots;
      p[0][b] = { time, value: t };
      p[1][b] = { time, value: close };
      p[2][b] = { time, value: t - glow };
      p[3][b] = { time, value: t + glow };
      p[4][b] = { time, value: t, color: lineColor };
    },
    copyVars: (v) => ({ w: v.w.slice(), col: v.col, trendDir: v.trendDir }),
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      const g = s.grad;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        fills: [
          { plot1: 'plot1', plot2: 'plot0', options: { title: 'Bull Fill' }, gradient: {
            topValue: g[0].slice() as number[], bottomValue: g[1].slice() as number[],
            topColor: g[2].slice() as (string | null)[], bottomColor: g[3].slice() as (string | null)[],
          } },
          { plot1: 'plot1', plot2: 'plot0', options: { title: 'Bear Fill' }, gradient: {
            topValue: g[4].slice() as number[], bottomValue: g[5].slice() as number[],
            topColor: g[6].slice() as (string | null)[], bottomColor: g[7].slice() as (string | null)[],
          } },
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Glow Lower' }, colors: s.glowColors.slice() },
          { plot1: 'plot0', plot2: 'plot3', options: { title: 'Glow Upper' }, colors: s.glowColors.slice() },
        ],
        plotCandles: { trendCandles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NlmsVolatilityTrailInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<NlmsVolatilityTrailInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const NlmsVolatilityTrail = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
