/**
 * QQE MOD
 *
 * Dual QQE (Quantitative Qualitative Estimation) with Bollinger Bands overlay.
 * Primary QQE: RSI smoothed via EMA, with dynamic ATR-RSI bands.
 * Secondary QQE: Same logic, different parameters.
 * BB on primary QQE trend line highlights strong momentum zones.
 * Draws plots only: the secondary QQE trend line, the secondary RSI histogram (grey beyond the threshold) and the
 * QQE up / down columns where both QQEs agree.
 * Alerts (alertcondition, `alerts` of the result): 'Primary RSI Cross Above Zero' / 'Primary RSI Cross Below Zero',
 * the smoothed primary RSI crossing over / under 50.
 *
 * Reference: "QQE MOD"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Primary RSI Cross Above Zero', message: 'Primary RSI crossed above zero' },
  { id: 'alert1', title: 'Primary RSI Cross Below Zero', message: 'Primary RSI crossed below zero' },
];

export interface QQEModInputs {
  rsiLengthPrimary: number;
  rsiSmoothingPrimary: number;
  qqeFactorPrimary: number;
  rsiLengthSecondary: number;
  rsiSmoothingSecondary: number;
  qqeFactorSecondary: number;
  thresholdSecondary: number;
  bollingerLength: number;
  bollingerMultiplier: number;
}

export const defaultInputs: QQEModInputs = {
  rsiLengthPrimary: 6,
  rsiSmoothingPrimary: 5,
  qqeFactorPrimary: 3.0,
  rsiLengthSecondary: 6,
  rsiSmoothingSecondary: 5,
  qqeFactorSecondary: 1.61,
  thresholdSecondary: 3.0,
  bollingerLength: 50,
  bollingerMultiplier: 0.35,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLengthPrimary', type: 'int', title: 'Primary RSI Length', defval: 6, min: 1 },
  { id: 'rsiSmoothingPrimary', type: 'int', title: 'Primary RSI Smoothing', defval: 5, min: 1 },
  { id: 'qqeFactorPrimary', type: 'float', title: 'Primary QQE Factor', defval: 3.0, min: 0.01, step: 0.01 },
  { id: 'rsiLengthSecondary', type: 'int', title: 'Secondary RSI Length', defval: 6, min: 1 },
  { id: 'rsiSmoothingSecondary', type: 'int', title: 'Secondary RSI Smoothing', defval: 5, min: 1 },
  { id: 'qqeFactorSecondary', type: 'float', title: 'Secondary QQE Factor', defval: 1.61, min: 0.01, step: 0.01 },
  { id: 'thresholdSecondary', type: 'float', title: 'Secondary Threshold', defval: 3.0, min: 0 },
  { id: 'bollingerLength', type: 'int', title: 'BB Length', defval: 50, min: 1 },
  { id: 'bollingerMultiplier', type: 'float', title: 'BB Multiplier', defval: 0.35, min: 0.001, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Secondary QQE Trend Line', color: '#FFFFFF', lineWidth: 2 },
  { id: 'plot1', title: 'Secondary RSI Histogram', color: '#707070', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'QQE Up Signal', color: '#00c3ff', lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'QQE Down Signal', color: '#ff0062', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'QQE MOD',
  shortTitle: 'QQEM',
  overlay: false,
};

/** The running state of one QQE: longBand, shortBand and trendDir of the previous bar */
interface QqeVars {
  longBand: number;
  shortBand: number;
  trendDir: number;
}

/** One QQE stepped bar by bar: RSI smoothed by an EMA, the EMA of its absolute change, the trailing bands */
class QqeCalc {
  readonly rsi: ReturnType<typeof taStep.rsi>;
  readonly ema: ReturnType<typeof taStep.ema>;
  readonly atrEma: ReturnType<typeof taStep.ema>;
  /** The smoothed RSI of each bar (na kept, NaN) */
  readonly sr: number[] = [];

  constructor(rsiLength: number, smoothingFactor: number, private readonly qqeFactor: number) {
    const wildersLength = rsiLength * 2 - 1;
    this.rsi = taStep.rsi(rsiLength);
    this.ema = taStep.ema(smoothingFactor);
    this.atrEma = taStep.ema(wildersLength);
  }

  /** The trend line of bar `i` (`v` changed in place); the smoothed RSI goes to `sr[i]` */
  step(v: QqeVars, i: number, close: number): number {
    const sr = this.ema.step(this.rsi.step(close));
    this.sr[i] = sr;
    // atrRsi = abs(smoothedRsi[1] - smoothedRsi)
    const prevSr = i > 0 ? (this.sr[i - 1] ?? 0) : 0;
    const dar = this.atrEma.step(Math.abs(prevSr - sr)) * this.qqeFactor;
    const newLong = sr - dar;
    const newShort = sr + dar;

    if (i === 0) {
      v.longBand = newLong;
      v.shortBand = newShort;
      v.trendDir = 0;
    } else {
      const prevLong = v.longBand;
      const prevShort = v.shortBand;
      v.longBand = (prevSr > prevLong && sr > prevLong) ? Math.max(prevLong, newLong) : newLong;
      v.shortBand = (prevSr < prevShort && sr < prevShort) ? Math.min(prevShort, newShort) : newShort;

      // Cross detection
      const crossLong = (prevSr <= prevLong && sr > prevLong) || (prevSr >= prevLong && sr < prevLong);
      // Use crossover for short (RSI crosses above shortBand)
      const crossoverShort = prevSr <= prevShort && sr > prevShort;
      if (crossoverShort || (prevSr < prevShort && sr >= prevShort)) {
        v.trendDir = 1;
      } else if (crossLong) {
        v.trendDir = -1;
      }
    }
    return v.trendDir === 1 ? v.longBand : v.shortBand;
  }
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface QqeRun extends BarRunState<{ pri: QqeVars; sec: QqeVars }> {
  primary: QqeCalc;
  secondary: QqeCalc;
  basis: WindowSma;
  dev: WindowStdev;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<QQEModInputs>): BarStudy<QqeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const warmup = Math.max(cfg.rsiLengthPrimary * 2, cfg.rsiLengthSecondary * 2, cfg.bollingerLength);
  return {
    init() {
      const primary = new QqeCalc(cfg.rsiLengthPrimary, cfg.rsiSmoothingPrimary, cfg.qqeFactorPrimary);
      const secondary = new QqeCalc(cfg.rsiLengthSecondary, cfg.rsiSmoothingSecondary, cfg.qqeFactorSecondary);
      // Bollinger on primary QQE trend line - 50 (basis = sma, dev = stdev)
      const basis = new WindowSma(cfg.bollingerLength);
      const dev = new WindowStdev(cfg.bollingerLength);
      const s: QqeRun = {
        primary, secondary, basis, dev, plot0: [], plot1: [], plot2: [], plot3: [], flags: [[], []], times: [[], []],
        steps: [primary.rsi, primary.ema, primary.atrEma, secondary.rsi, secondary.ema, secondary.atrEma, basis, dev],
        vars: { pri: { longBand: NaN, shortBand: NaN, trendDir: 0 }, sec: { longBand: NaN, shortBand: NaN, trendDir: 0 } },
        lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [primary.sr, secondary.sr, s.plot0, s.plot1, s.plot2, s.plot3, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const close = bars[i].close;
      const priTrend = s.primary.step(s.vars.pri, i, close);
      const secTrend = s.secondary.step(s.vars.sec, i, close);
      const qqeMinus50 = priTrend - 50;
      const bbBasis = s.basis.step(qqeMinus50);
      const bbDev = s.dev.step(qqeMinus50);

      const w = i < warmup;
      const secTrend50 = secTrend - 50;
      const secRsi50 = s.secondary.sr[i] - 50;
      const priSr = s.primary.sr[i];
      const priRsi50 = priSr - 50;
      const bbUp = (bbBasis ?? 0) + (bbDev ?? 0) * cfg.bollingerMultiplier;
      const bbLo = (bbBasis ?? 0) - (bbDev ?? 0) * cfg.bollingerMultiplier;

      s.plot0[i] = { time: t, value: w ? NaN : secTrend50 };

      // Dynamic histogram color: gray at extremes, transparent in neutral
      let histColor: string | undefined;
      if (!w) {
        if (secRsi50 > cfg.thresholdSecondary || secRsi50 < -cfg.thresholdSecondary) {
          histColor = 'rgba(112,112,112,0.80)';
        } else {
          histColor = 'transparent';
        }
      }
      s.plot1[i] = { time: t, value: w ? NaN : secRsi50, color: histColor };

      s.plot2[i] = { time: t, value: w ? NaN : (secRsi50 > cfg.thresholdSecondary && priRsi50 > bbUp ? secRsi50 : NaN) };
      s.plot3[i] = { time: t, value: w ? NaN : (secRsi50 < -cfg.thresholdSecondary && priRsi50 < bbLo ? secRsi50 : NaN) };

      // alertcondition(ta.crossover(primaryRSI, 50)) / alertcondition(ta.crossunder(primaryRSI, 50))
      const prev = i > 0 ? s.primary.sr[i - 1] : NaN;
      const up = priSr > 50 && prev <= 50;
      const down = priSr < 50 && prev >= 50;
      s.flags[0][i] = up;
      s.flags[1][i] = down;
      if (up) s.times[0].push(t as number);
      if (down) s.times[1].push(t as number);
    },
    copyVars: (v) => ({ pri: { ...v.pri }, sec: { ...v.sec } }),
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice() },
        hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dotted', title: 'Zero' } }],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QQEModInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<QQEModInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const QQEMod = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
