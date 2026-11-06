/**
 * MACD Pro
 *
 * MACD = EMA(src, fast) - EMA(src, slow), signal = EMA(MACD, signal length), histogram = MACD - signal. The MACD
 * Leader adds to each EMA the EMA of the source distance to it, scaled by the leader factor:
 * i1 = EMA(src, fast) + factor * EMA(src - EMA(src, fast), fast), i2 likewise with the slow length, leader = i1 - i2.
 * The MACD line colour shows the market regime: lime when the 10-bar momentum of the close is positive and the
 * absolute change of SMA(close, 14) is above its 21-bar SMA, red when the momentum is negative with the same trend
 * strength, blue otherwise. Histogram columns are strong / faded lime above zero (rising / not rising) and strong /
 * faded red below zero (falling / not falling).
 *
 * Reference: "MACD Pro" by VEGAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © VEGAlgo
 */

import { taStep, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { WindowSma, barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MacdProInputs {
  /** Fast EMA period */
  fastPeriod: number;
  /** Slow EMA period */
  slowPeriod: number;
  /** Signal EMA period */
  signalPeriod: number;
  /** Price source */
  source: SourceType;
  /** Draw the MACD Leader */
  enableLeader: boolean;
  /** Leader sensitivity */
  leaderFactor: number;
  /** Draw the histogram */
  showHistogram: boolean;
}

export const defaultInputs: MacdProInputs = {
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
  source: 'close',
  enableLeader: true,
  leaderFactor: 1.0,
  showHistogram: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastPeriod', type: 'int', title: 'Fast EMA Period', defval: 12, min: 1, max: 100 },
  { id: 'slowPeriod', type: 'int', title: 'Slow EMA Period', defval: 26, min: 1, max: 200 },
  { id: 'signalPeriod', type: 'int', title: 'Signal Period', defval: 9, min: 1, max: 50 },
  { id: 'source', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'enableLeader', type: 'bool', title: 'Enable Leader', defval: true },
  { id: 'leaderFactor', type: 'float', title: 'Leader Sensitivity', defval: 1.0, min: 0.5, max: 2.0, step: 0.1 },
  { id: 'showHistogram', type: 'bool', title: 'Show Histogram', defval: true },
];

const MACD_BULL = String(color.new(color.lime, 20));
const MACD_BEAR = String(color.new(color.red, 20));
const MACD_NEUTRAL = String(color.new('#2e5a8f', 40));
const SIGNAL_COL = String(color.new('#b3b0c2', 30));
const LEADER_COL = String(color.new('#49e0e8', 0));
const HIST_BULL_STRONG = String(color.new(color.lime, 0));
const HIST_BULL_WEAK = String(color.new(color.lime, 60));
const HIST_BEAR_STRONG = String(color.new(color.red, 0));
const HIST_BEAR_WEAK = String(color.new(color.red, 60));
const ZERO_COL = String(color.new(color.white, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD Line', color: MACD_NEUTRAL, lineWidth: 2 },
  { id: 'plot1', title: 'Signal Line', color: SIGNAL_COL, lineWidth: 1 },
  { id: 'plot2', title: 'MACD Leader', color: LEADER_COL, lineWidth: 1 },
  { id: 'plot3', title: 'MACD Histogram', color: HIST_BULL_STRONG, lineWidth: 1, style: 'histogram' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline0', price: 0, title: 'Zero Line', color: ZERO_COL, linestyle: 'dashed' },
];

export const metadata = {
  title: 'MACD Pro',
  shortTitle: 'VEGA MACD Pro',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Ema = ReturnType<typeof taStep.ema>;

interface MacdProVars {
  /** smaClose and hist of the bar before */
  sma1: number;
  hist1: number;
}

interface MacdProRun extends BarRunState<MacdProVars> {
  fast: Ema;
  slow: Ema;
  sig: Ema;
  e1: Ema;
  e2: Ema;
  mom: ReturnType<typeof taStep.mom>;
  sma: WindowSma;
  strengthAvg: WindowSma;
  /** The source of another study (null: a bar source) */
  ext: number[] | null;
  plots: Point[][];
}

function study(inputs: Partial<MacdProInputs>): BarStudy<MacdProRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const barValue = barSource(cfg.source);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init(bars) {
      // MACD; Leader: sema / lema are the same EMAs as fast_ema / slow_ema
      const fast = taStep.ema(cfg.fastPeriod);
      const slow = taStep.ema(cfg.slowPeriod);
      const sig = taStep.ema(cfg.signalPeriod);
      const e1 = taStep.ema(cfg.fastPeriod);
      const e2 = taStep.ema(cfg.slowPeriod);
      // Market regime
      const mom = taStep.mom(10);
      const sma = new WindowSma(14);
      const strengthAvg = new WindowSma(21);
      const s: MacdProRun = {
        fast, slow, sig, e1, e2, mom, sma, strengthAvg,
        ext: isBarSource(cfg.source) ? null : getSourceSeries(bars, cfg.source).toArray().map((v) => v ?? NaN),
        plots: [[], [], [], []],
        steps: [fast, slow, sig, e1, e2, mom, sma, strengthAvg],
        vars: { sma1: NaN, hist1: NaN },
        lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const src = s.ext ? s.ext[i] : barValue(b);
      const fastEma = s.fast.step(src);
      const slowEma = s.slow.step(src);
      const macd = fastEma - slowEma;
      const signal = s.sig.step(macd);
      const h = macd - signal;

      const e1 = s.e1.step(src - fastEma);
      const e2 = s.e2.step(src - slowEma);
      const i1 = fastEma + cfg.leaderFactor * e1;
      const i2 = slowEma + cfg.leaderFactor * e2;
      const leader = cfg.enableLeader ? i1 - i2 : NaN;

      const momentum = s.mom.step(b.close);
      const smaClose = s.sma.step(b.close);
      const trendStrength = i > 0 ? Math.abs(smaClose - v.sma1) : NaN;
      const trendStrengthAvg = s.strengthAvg.step(trendStrength);

      const strong = gt(trendStrength, trendStrengthAvg);
      const bullish = gt(momentum, 0) && strong;
      const bearish = lt(momentum, 0) && strong;
      const macdColor = bullish ? MACD_BULL : bearish ? MACD_BEAR : MACD_NEUTRAL;
      const h1 = i > 0 ? v.hist1 : NaN;
      const histColor = gt(h, 0) ? (gt(h, h1) ? HIST_BULL_STRONG : HIST_BULL_WEAK) : lt(h, h1) ? HIST_BEAR_STRONG : HIST_BEAR_WEAK;
      s.plots[0][i] = { time: t, value: macd, color: macdColor };
      s.plots[1][i] = { time: t, value: signal, color: SIGNAL_COL };
      s.plots[2][i] = { time: t, value: leader, color: LEADER_COL };
      s.plots[3][i] = { time: t, value: cfg.showHistogram ? h : NaN, color: histColor };
      v.sma1 = smaClose;
      v.hist1 = h;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: ZERO_COL, linestyle: 'dashed' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdProInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MacdProInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MacdPro = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
