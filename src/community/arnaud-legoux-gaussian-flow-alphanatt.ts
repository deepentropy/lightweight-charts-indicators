/**
 * Arnaud Legoux Gaussian Flow | AlphaNatt
 *
 * A Gaussian-weighted average of the last `length` closes (weight of close[i] = exp(-(i - m)^2 / (2 s^2)),
 * m = offset * (length - 1), s = length / sigma), smoothed by an EMA. An envelope around it: the base width is
 * ATR * multiplier (Fixed), ATR * multiplier * (1 + acceleration / SMA of acceleration) (Adaptive) or
 * (ATR + stdev(close - average)) / 2 * multiplier (Hybrid), times a Gaussian factor exp(-0.5^2 / (2 * 0.3^2)) and a
 * momentum factor 1 + |EMA(5) of the momentum| / average * 10; the bands are at average +- 2 * envelope. Ten hidden
 * gradient levels on each side are filled with fading colours. The average is cyan when the close is above it,
 * else magenta.
 * Alerts (alertcondition, `alerts` of the result): trend long / short (the close crosses the average in a strong up /
 * down trend: EMA(5) of the trend strength beyond +-0.5), mean reversion long / short (the close beyond the average
 * -+ 0.95 envelope) and the first bar of a strong up / down trend.
 *
 * Reference: "Arnaud Legoux Gaussian Flow | AlphaNatt" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type AlmaGaussianEnvelopeMode = 'Fixed' | 'Adaptive' | 'Hybrid';

export interface ArnaudLegouxGaussianFlowAlphanattInputs {
  /** Number of closes in the Gaussian average */
  almaLength: number;
  /** Gaussian offset (0 .. 1) */
  almaOffset: number;
  /** Gaussian sigma */
  almaSigma: number;
  /** Envelope width mode */
  envelopeMode: AlmaGaussianEnvelopeMode;
  envelopeMultiplier: number;
  /** ATR / SMA / stdev length of the envelope */
  adaptivePeriod: number;
  /** Number of gradient steps between the band and the average */
  gradientDepth: number;
  /** Momentum lookback */
  momentumLength: number;
  /** EMA length of the average */
  signalSmoothing: number;
}

export const defaultInputs: ArnaudLegouxGaussianFlowAlphanattInputs = {
  almaLength: 21,
  almaOffset: 0.85,
  almaSigma: 6.0,
  envelopeMode: 'Adaptive',
  envelopeMultiplier: 1.5,
  adaptivePeriod: 20,
  gradientDepth: 10,
  momentumLength: 14,
  signalSmoothing: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'almaLength', type: 'int', title: 'ALMA Period', defval: 21, min: 5, max: 100 },
  { id: 'almaOffset', type: 'float', title: 'Gaussian Offset', defval: 0.85, min: 0.0, max: 1.0, step: 0.05 },
  { id: 'almaSigma', type: 'float', title: 'Gaussian Sigma', defval: 6.0, min: 1.0, max: 10.0, step: 0.5 },
  { id: 'envelopeMode', type: 'string', title: 'Envelope Mode', defval: 'Adaptive', options: ['Fixed', 'Adaptive', 'Hybrid'] },
  { id: 'envelopeMultiplier', type: 'float', title: 'Envelope Multiplier', defval: 1.5, min: 0.5, max: 3.0, step: 0.1 },
  { id: 'adaptivePeriod', type: 'int', title: 'Adaptive Period', defval: 20, min: 10, max: 50 },
  { id: 'gradientDepth', type: 'int', title: 'Gradient Depth', defval: 10, min: 5, max: 15 },
  { id: 'momentumLength', type: 'int', title: 'Momentum Length', defval: 14, min: 5, max: 30 },
  { id: 'signalSmoothing', type: 'int', title: 'Signal Smoothing', defval: 3, min: 1, max: 10 },
];

const BULL = '#00F1FF';
const BEAR = '#FF019A';
/** Transparencies of the band plot and of the gradient levels 2 .. 10 */
const LEVEL_TRANSP = [0, 70, 75, 80, 83, 86, 89, 92, 95, 98];
/** Transparencies of the fills: band-2, 2-3, ..., 9-10, 10-average */
const FILL_TRANSP = [70, 75, 80, 83, 86, 89, 92, 95, 98, 99];

const levelPlots = (side: 'Upper' | 'Lower', first: number, c: string): PlotConfig[] =>
  LEVEL_TRANSP.map((t, k) => ({
    id: `plot${first + k}`,
    title: k === 0 ? `${side} Envelope` : `${side === 'Upper' ? 'UB' : 'LB'}${k + 1}`,
    color: String(color.new(c, t)),
    lineWidth: 1,
    display: 'none' as const,
  }));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ALMA Gaussian', color: BULL, lineWidth: 2 },
  ...levelPlots('Upper', 1, BEAR),
  ...levelPlots('Lower', 11, BULL),
];

export const metadata = {
  title: 'Arnaud Legoux Gaussian Flow | AlphaNatt',
  shortTitle: 'Arnaud Legoux Gaussian Flow | AlphaNatt',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface AlmaRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  avgAccel: WindowSma;
  std: WindowStdev;
  momEma: ReturnType<typeof taStep.ema>;
  trendEma: ReturnType<typeof taStep.ema>;
  close: number[];
  almaSmooth: number[];
  strongUp: boolean[];
  strongDown: boolean[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ArnaudLegouxGaussianFlowAlphanattInputs>): BarStudy<AlmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.almaLength;
  // Gaussian weighted average of close[0 .. len - 1]: the weights, and their sum added in the same order
  const m = cfg.almaOffset * (len - 1);
  const sg = len / cfg.almaSigma;
  const weights: number[] = [];
  let weightSum = 0.0;
  for (let i = 0; i <= len - 1; i++) {
    const weight = Math.exp(-Math.pow(i - m, 2) / (2 * Math.pow(sg, 2)));
    weights.push(weight);
    weightSum = weightSum + weight;
  }
  const prev = (a: number[], i: number, k = 1) => (i - k >= 0 ? a[i - k] : NaN);
  // baseWidth = switch envelopeMode (the mode is the same on every bar: each branch runs on all bars or on none)
  const p = cfg.adaptivePeriod;
  const mult = cfg.envelopeMultiplier;
  const gaussianMult = Math.exp(-Math.pow(0.5, 2) / (2 * Math.pow(0.3, 2)));
  const depth = cfg.gradientDepth;
  const cu = LEVEL_TRANSP.map((tr) => String(color.new(BEAR, tr)));
  const cl = LEVEL_TRANSP.map((tr) => String(color.new(BULL, tr)));
  // Plot values: na for na and +-infinity
  const pv = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    init() {
      const s: AlmaRun = {
        ema: taStep.ema(cfg.signalSmoothing), atr: taStep.atr(p), avgAccel: new WindowSma(p), std: new WindowStdev(p),
        momEma: taStep.ema(5), trendEma: taStep.ema(5), close: [], almaSmooth: [], strongUp: [], strongDown: [],
        plots: Array.from({ length: 21 }, () => []), flags: alertConditions.map(() => []),
        times: alertConditions.map(() => []), vars: {}, steps: [], lists: [], series: [],
      };
      s.steps = [
        s.ema, s.atr, ...(cfg.envelopeMode === 'Adaptive' ? [s.avgAccel] : []),
        ...(cfg.envelopeMode === 'Hybrid' ? [s.std] : []), s.momEma, s.trendEma,
      ];
      s.lists = s.times;
      s.series = [s.close, s.almaSmooth, s.strongUp, s.strongDown, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, bar, bars) {
      const b = bars[bar];
      const time = b.time;
      const close = s.close;
      const c = b.close;
      close[bar] = c;
      let wtdSum = 0.0;
      for (let i = 0; i <= len - 1; i++) wtdSum = wtdSum + (bar - i >= 0 ? close[bar - i] : NaN) * weights[i];
      const alma = wtdSum / weightSum;
      const almaSmooth = s.ema.step(alma) ?? NaN;
      s.almaSmooth[bar] = almaSmooth;

      const atr = s.atr.step(b.high, b.low, b.close) ?? NaN;
      let baseWidth: number;
      if (cfg.envelopeMode === 'Adaptive') {
        const accel = Math.abs(almaSmooth - prev(s.almaSmooth, bar));
        const avgAccel = s.avgAccel.step(accel);
        baseWidth = atr * mult * (1 + accel / avgAccel);
      } else if (cfg.envelopeMode === 'Hybrid') {
        const std = s.std.step(c - almaSmooth);
        baseWidth = ((atr + std) / 2) * mult;
      } else {
        baseWidth = atr * mult;
      }

      const momentum = almaSmooth - prev(s.almaSmooth, bar, cfg.momentumLength);
      const momentumNorm = s.momEma.step(momentum) ?? NaN;
      const envelopeWidth = baseWidth * gaussianMult;
      const momentumAdjust = 1 + (Math.abs(momentumNorm) / almaSmooth) * 10;
      const finalEnvelope = envelopeWidth * momentumAdjust;
      const upper = almaSmooth + 2 * finalEnvelope;
      const lower = almaSmooth - 2 * finalEnvelope;

      // Alerts: trendStrength = (almaSmooth - almaSmooth[momentumLength]) / almaSmooth * 100, trendMA = ta.ema(trendStrength, 5)
      const trendMA = s.trendEma.step((momentum / almaSmooth) * 100) ?? NaN;
      const strongUp = gt(trendMA, 0.5) && gt(c, almaSmooth);
      const strongDown = lt(trendMA, -0.5) && lt(c, almaSmooth);
      s.strongUp[bar] = strongUp;
      s.strongDown[bar] = strongDown;
      // ta.crossover / ta.crossunder(close, almaSmooth)
      const pc = prev(close, bar);
      const pa = prev(s.almaSmooth, bar);
      const crossUp = c > almaSmooth && pc <= pa;
      const crossDown = c < almaSmooth && pc >= pa;
      const flags = [
        // trendLong = ta.crossover(close, almaSmooth) and strongUptrend / trendShort
        crossUp && strongUp,
        crossDown && strongDown,
        // meanRevLong = close < almaSmooth - finalEnvelope * 0.95 and trendMA > -0.5 / meanRevShort
        lt(c, almaSmooth - finalEnvelope * 0.95) && gt(trendMA, -0.5),
        gt(c, almaSmooth + finalEnvelope * 0.95) && lt(trendMA, 0.5),
        // strongUptrend and not strongUptrend[1] (false before the first bar) / the same for the down trend
        strongUp && !(bar > 0 && s.strongUp[bar - 1]),
        strongDown && !(bar > 0 && s.strongDown[bar - 1]),
      ];
      for (let k = 0; k < flags.length; k++) {
        s.flags[k][bar] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }

      s.plots[0][bar] = { time, value: pv(almaSmooth), color: gt(c, almaSmooth) ? BULL : BEAR };
      // Upper: upperEnvelope - upperGradStep * k (k = 0 .. 9); lower: lowerEnvelope + lowerGradStep * k
      const upStep = (upper - almaSmooth) / depth;
      const loStep = (almaSmooth - lower) / depth;
      for (let k = 0; k < LEVEL_TRANSP.length; k++) {
        s.plots[1 + k][bar] = { time, value: pv(k === 0 ? upper : k === 1 ? upper - upStep : upper - upStep * k), color: cu[k] };
        s.plots[11 + k][bar] = { time, value: pv(k === 0 ? lower : k === 1 ? lower + loStep : lower + loStep * k), color: cl[k] };
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      plots.plot0 = s.plots[0].slice();
      for (let k = 0; k < LEVEL_TRANSP.length; k++) {
        plots[`plot${1 + k}`] = s.plots[1 + k].slice();
        plots[`plot${11 + k}`] = s.plots[11 + k].slice();
      }
      // fill(upperMain, ub2), ..., fill(ub10, almaPlot); the same on the lower side
      const fills = [
        ...FILL_TRANSP.map((tr, k) => ({
          plot1: `plot${1 + k}`, plot2: k === 9 ? 'plot0' : `plot${2 + k}`, options: { color: String(color.new(BEAR, tr)) },
        })),
        ...FILL_TRANSP.map((tr, k) => ({
          plot1: `plot${11 + k}`, plot2: k === 9 ? 'plot0' : `plot${12 + k}`, options: { color: String(color.new(BULL, tr)) },
        })),
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ArnaudLegouxGaussianFlowAlphanattInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ArnaudLegouxGaussianFlowAlphanattInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'ALMA Trend Long', message: 'Price crossed above ALMA in strong uptrend' },
  { id: 'alert1', title: 'ALMA Trend Short', message: 'Price crossed below ALMA in strong downtrend' },
  { id: 'alert2', title: 'ALMA Mean Reversion Long', message: 'Price in lower Gaussian zone - potential bounce' },
  { id: 'alert3', title: 'ALMA Mean Reversion Short', message: 'Price in upper Gaussian zone - potential pullback' },
  { id: 'alert4', title: 'ALMA Strong Uptrend', message: 'Strong uptrend detected' },
  { id: 'alert5', title: 'ALMA Strong Downtrend', message: 'Strong downtrend detected' },
];

export const ArnaudLegouxGaussianFlowAlphanatt = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
