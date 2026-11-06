/**
 * Fractional EMA Kalman Filter (Kalman D7)
 *
 * Two EMAs with fractional lengths (alpha = 2 / (length + 1), above 1 for a length below 1; recursive sum seeded by 0)
 * give the measurement. Two adaptive Kalman filters (base and fast) track it: the residual to the previous state,
 * squared and divided by the squared ATR(14), gives the measurement noise R (RMA over `R` bars, floored by the current
 * residual variance times the gate multiplier) and the process noise Q (RMA over 5 bars, clamped to 0.001..10, times
 * the q multiplier). Each filter state is smoothed by a 3-bar (base) or 5-bar (fast) recursive EMA; the fill between
 * the two lines is aqua when the fast line is above the base line, red otherwise. Optional: the EMA and the EMA
 * shifted one bar to the left, with a lag shading between them.
 *
 * Reference: "Kalman D7" by et20tradeview
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © et20tradeview
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FractionalEmaKalmanFilterInputs {
  /** Show the EMA and its one-bar-left copy */
  showPul: boolean;
  source: SourceType;
  /** Length of the first EMA (fractional) */
  factor: number;
  /** Length of the second EMA (fractional) */
  factor2: number;
  /** R lookback of the base filter */
  rRatioB: number;
  /** q multiplier of the base filter */
  qRatioB: number;
  /** R gate multiplier of the base filter */
  rGateMultB: number;
  /** R lookback of the fast filter */
  rRatioS: number;
  /** q multiplier of the fast filter */
  qRatioS: number;
  /** R gate multiplier of the fast filter */
  rGateMultS: number;
}

export const defaultInputs: FractionalEmaKalmanFilterInputs = {
  showPul: false,
  source: 'close',
  factor: 0.5,
  factor2: 0.5,
  rRatioB: 50,
  qRatioB: 0.002,
  rGateMultB: 1,
  rRatioS: 50,
  qRatioS: 0.005,
  rGateMultS: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'showPul', type: 'bool', title: 'Show EMA', defval: false },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'factor', type: 'float', title: 'factor', defval: 0.5, min: 0.1, step: 0.1 },
  { id: 'factor2', type: 'float', title: 'factor2', defval: 0.5, min: 0.1, step: 0.1 },
  { id: 'rRatioB', type: 'int', title: 'R base', defval: 50, step: 5 },
  { id: 'qRatioB', type: 'float', title: 'q multiplier base', defval: 0.002, step: 0.001 },
  { id: 'rGateMultB', type: 'float', title: 'R Gate Multiplier base', defval: 1, step: 0.1 },
  { id: 'rRatioS', type: 'int', title: 'R fast', defval: 50, step: 5 },
  { id: 'qRatioS', type: 'float', title: 'q multiplier fast', defval: 0.005, step: 0.001 },
  { id: 'rGateMultS', type: 'float', title: 'R Gate Multiplier fast', defval: 1, step: 0.1 },
];

const EMA_COL = String(color.new(color.purple, 70));
const BASE_COL = String(color.rgb(230, 65, 195));
const FAST_COL = String(color.rgb(80, 100, 240));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pumori', color: EMA_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Pumori (offset -1)', color: EMA_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Kalman Base', color: BASE_COL, lineWidth: 2 },
  { id: 'plot3', title: 'Kalman Fast', color: FAST_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'Kalman D7',
  shortTitle: 'Kalman D7',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const nz = (x: number, y = 0) => (isNaN(x) ? y : x);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

/** One adaptive Kalman filter (`var float kf_state = na`, `var float p_cov = 1.0`) with its two RMAs */
interface KalmanFilter {
  pState: number;
  pCov: number;
  rmaR: RmaStepper;
  rmaQ: RmaStepper;
}

interface KalmanVars {
  base: KalmanFilter;
  fast: KalmanFilter;
}

type Point = { time: number; value: number; color: string };

interface KalmanRun extends BarRunState<KalmanVars> {
  atr: ReturnType<typeof taStep.atr>;
  ema1: number[];
  ema2: number[];
  stateB: number[];
  stateS: number[];
  smoothb: number[];
  smooths: number[];
  plots: Point[][];
  fillColors: string[];
}

const copyFilter = (f: KalmanFilter): KalmanFilter => ({ ...f, rmaR: f.rmaR.clone(), rmaQ: f.rmaQ.clone() });

function study(inputs: Partial<FractionalEmaKalmanFilterInputs>): BarStudy<KalmanRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const qlen = 5;
  const value = barSource(cfg.source);
  const up = String(color.new(color.aqua, 80));
  const down = String(color.new(color.red, 80));
  const filter = (rRatio: number): KalmanFilter => ({ pState: NaN, pCov: 1.0, rmaR: new RmaStepper(rRatio), rmaQ: new RmaStepper(qlen) });
  /** pine_ema(src, length) on bar i: sum := alpha * src + (1 - alpha) * nz(sum[1]), alpha = 2 / (length + 1) */
  const pineEma = (out: number[], i: number, x: number, length: number) => {
    const alpha = 2 / (length + 1);
    out[i] = alpha * x + (1 - alpha) * nz(i > 0 ? out[i - 1] : NaN);
    return out[i];
  };
  /** One adaptive Kalman filter: the state on bar i */
  const kalman = (f: KalmanFilter, state: number[], i: number, ema2: number, atr: number, qRatio: number, gateMult: number) => {
    // The residual depends on the previous state, so the RMAs of the residual variance are computed bar by bar (same
    // recursion as ta.rma: SMA seed on the first `length` values, then alpha = 1 / length).
    // residual = ema2 - nz(kf_state[1], ema2)
    const residual = ema2 - nz(i > 0 ? state[i - 1] : NaN, ema2);
    const volBase = max(atr, 1e-6);
    const resVar = Math.pow(residual, 2) / Math.pow(volBase, 2);
    const rRaw = nz(f.rmaR.step(resVar), 1.0);
    const qRaw = nz(f.rmaQ.step(resVar), 0.1);
    // calc_kalman
    const qProcess = min(max(nz(qRaw, 0.1), 0.001), 10.0) * qRatio;
    const rDynamicFloor = resVar * gateMult;
    const rAdaptive = max(nz(rRaw, 1.0), rDynamicFloor);
    const currentPCov = f.pCov + qProcess;
    const kGain = currentPCov / (currentPCov + rAdaptive + 1e-10);
    let nextState = nz(f.pState, ema2);
    let nextCov = currentPCov;
    if (!isNaN(kGain)) {
      nextState = nextState + kGain * (ema2 - nextState);
      nextCov = (1 - kGain) * currentPCov;
    }
    f.pState = nextState;
    f.pCov = nextCov;
    state[i] = nextState;
    return nextState;
  };
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: KalmanRun = {
        atr: taStep.atr(14), ema1: [], ema2: [], stateB: [], stateS: [], smoothb: [], smooths: [],
        plots: [[], [], [], []], fillColors: [], steps: [],
        vars: { base: filter(cfg.rRatioB), fast: filter(cfg.rRatioS) }, lists: [], series: [],
      };
      s.steps = [s.atr];
      s.series = [s.ema1, s.ema2, s.stateB, s.stateS, s.smoothb, s.smooths, ...s.plots, s.fillColors];
      return s;
    },
    copyVars: (v) => ({ base: copyFilter(v.base), fast: copyFilter(v.fast) }),
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const ema1 = pineEma(s.ema1, i, value(b), cfg.factor);
      const ema2 = pineEma(s.ema2, i, ema1, cfg.factor2);
      const atr = s.atr.step(b.high, b.low, b.close);
      const stateB = kalman(s.vars.base, s.stateB, i, ema2, atr, cfg.qRatioB, cfg.rGateMultB);
      const stateS = kalman(s.vars.fast, s.stateS, i, ema2, atr, cfg.qRatioS, cfg.rGateMultS);
      const smoothb = pineEma(s.smoothb, i, stateB, 3);
      const smooths = pineEma(s.smooths, i, stateS, 5);

      const emaPlot = cfg.showPul ? ema2 : NaN;
      s.plots[0][i] = { time: t, value: emaPlot, color: EMA_COL };
      // plot(..., offset = -1): the value of bar i is drawn on bar i - 1 (bar i is the only writer of that slot)
      if (i > 0) s.plots[1][i - 1] = { time: bars[i - 1].time, value: emaPlot, color: EMA_COL };
      s.plots[2][i] = { time: t, value: smoothb, color: BASE_COL };
      s.plots[3][i] = { time: t, value: smooths, color: FAST_COL };
      s.fillColors[i] = gt(smooths, smoothb) ? up : down;
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      const fills = [
        { plot1: 'plot0', plot2: 'plot1', options: { title: 'Lag Shading', color: String(color.new('#69359C', 70)) } },
        { plot1: 'plot2', plot2: 'plot3', options: { title: 'Kalman fill' }, colors: s.fillColors.slice() },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(0, Math.max(0, n - 1)), plot2: p[2].slice(), plot3: p[3].slice() },
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FractionalEmaKalmanFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FractionalEmaKalmanFilterInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

/**
 * Bar-by-bar ta.rma(src, length): na until `length` non-na values, seeded by their mean (the SMA of the first full
 * window), then rma = alpha * src + (1 - alpha) * rma[1] (na on a bar with an na source). A class (state changed in
 * place, copied with clone()) so that a live run can keep it at the end of the last confirmed bar.
 */
class RmaStepper {
  private readonly alpha: number;
  private seed: number[] = [];
  private value = NaN;
  private started = false;

  constructor(private readonly length: number) {
    this.alpha = 1 / length;
  }

  step(x: number): number {
    if (!this.started) {
      if (!isNaN(x)) this.seed.push(x);
      if (this.seed.length === this.length) {
        this.started = true;
        this.value = this.seed.reduce((a, b) => a + b, 0) / this.length;
        return this.value;
      }
      return NaN;
    }
    if (isNaN(x)) return NaN;
    this.value = this.alpha * x + (1 - this.alpha) * this.value;
    return this.value;
  }

  clone(): RmaStepper {
    const c = new RmaStepper(this.length);
    c.seed = this.started ? this.seed : this.seed.slice();
    c.value = this.value;
    c.started = this.started;
    return c;
  }
}

export const FractionalEmaKalmanFilter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
