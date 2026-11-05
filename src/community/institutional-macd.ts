/**
 * Institutional MACD (Z-Score Edition)
 *
 * The classic MACD (fast EMA - slow EMA, EMA signal line, histogram = MACD - signal) with each series replaced by its
 * z-score over a lookback: (x - SMA(x)) / stdev(x). The z-scored histogram is drawn as columns coloured by sign and by
 * rising / falling, with the z-scored MACD and signal lines and +/- threshold lines.
 * Alerts (alertcondition, `alerts` of the result): the z-scored histogram above the threshold, below minus the
 * threshold, crossing over 0 and crossing under 0.
 *
 * Reference: "Institutional MACD (Z-Score Edition) [VolumeVigilante]" by VolumeVigilante
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © VolumeVigilante | Trade Smart. Trade Vigilantly.
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface InstitutionalMacdInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
  /** Z-score lookback length */
  zScoreLength: number;
  /** Level of the +/- threshold lines */
  zScoreThreshold: number;
  showZHistogram: boolean;
  showZLines: boolean;
  showZBands: boolean;
}

export const defaultInputs: InstitutionalMacdInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  src: 'close',
  zScoreLength: 50,
  zScoreThreshold: 1.0,
  showZHistogram: true,
  showZLines: true,
  showZBands: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing Length', defval: 9 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'zScoreLength', type: 'int', title: 'Z-Score Lookback Length', defval: 50 },
  { id: 'zScoreThreshold', type: 'float', title: 'Z-Score Threshold Level', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'showZHistogram', type: 'bool', title: 'Show Z-Scored Histogram', defval: true },
  { id: 'showZLines', type: 'bool', title: 'Show Z-Scored MACD Lines', defval: true },
  { id: 'showZBands', type: 'bool', title: 'Show ±Z Threshold Bands', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score Histogram', color: '#26A69A', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Z-MACD Line', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Z-Signal Line', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot3', title: '+Z Threshold', color: '#26A69A', lineWidth: 1 },
  { id: 'plot4', title: '-Z Threshold', color: '#FF5252', lineWidth: 1 },
];

/** hline(0, "Zero", color = color.new(#787B86, 50)), Pine default hline style (dashed) */
const ZERO_COLOR = String(color.new('#787B86', 50));

export const metadata = {
  title: 'Institutional MACD (Z-Score Edition) [VolumeVigilante]',
  shortTitle: 'Institutional MACD (Z-Score Edition) [VolumeVigilante]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

/**
 * z = (x - ta.sma(x, len)) / ta.stdev(x, len) stepped bar by bar: the window sums of x and of its squares of the
 * oakscriptjs ta.sma / ta.stdev (biased) machines, shared (same doubles)
 */
class ZScore {
  private readonly sums = taStep.sum();
  private readonly squares = taStep.sum();
  private readonly len: number;
  constructor(length: number) {
    // the length checks of ta.sma and ta.stdev
    taStep.sma().step(0, length);
    taStep.stdev().step(0, length);
    this.len = Math.floor(length);
  }
  step(x: number): number {
    const len = this.len;
    const sum = this.sums.step(x, len);
    const sq = this.squares.step(Number.isFinite(x) ? x * x : NaN, len);
    const mean = sum / len;
    const variance = sq / len - mean * mean;
    const sd = Number.isNaN(variance) ? NaN : variance > 0 ? Math.sqrt(variance) : 0;
    return (x - mean) / sd;
  }
  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

interface ImacdRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  zH: ZScore;
  zM: ZScore;
  zS: ZScore;
  zHist: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<InstitutionalMacdInputs>): BarStudy<ImacdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const plotValue = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(cfg.fastLength);
      const slow = taStep.ema(cfg.slowLength);
      const sig = taStep.ema(cfg.signalLength);
      const zH = new ZScore(cfg.zScoreLength);
      const zM = new ZScore(cfg.zScoreLength);
      const zS = new ZScore(cfg.zScoreLength);
      const s: ImacdRun = {
        fast, slow, sig, zH, zM, zS, zHist: [], plots: [[], [], [], [], []], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [fast, slow, sig, zH, zM, zS], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.zHist, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = value(b);
      const macdLine = s.fast.step(v) - s.slow.step(v);
      const signalLine = s.sig.step(macdLine);
      const hist = macdLine - signalLine;

      // z = (x - ta.sma(x, len)) / ta.stdev(x, len): a plain division (x / 0 is +-infinity, 0 / 0 NaN); the histogram
      // colour compares the infinite value, the plots show na for it
      const zHist = s.zH.step(hist);
      const macdZ = s.zM.step(macdLine);
      const signalZ = s.zS.step(signalLine);
      s.zHist[i] = zHist;
      const prev = i > 0 ? s.zHist[i - 1] : NaN;

      const isRising = i > 0 && gt(zHist, prev);
      const c = ge(zHist, 0) ? (isRising ? '#26A69A' : '#B2DFDB') : isRising ? '#FFCDD2' : '#FF5252';
      s.plots[0][i] = { time, value: cfg.showZHistogram ? plotValue(zHist) : NaN, color: c };
      s.plots[1][i] = { time, value: cfg.showZLines ? plotValue(macdZ) : NaN };
      s.plots[2][i] = { time, value: cfg.showZLines ? plotValue(signalZ) : NaN };
      s.plots[3][i] = { time, value: cfg.showZBands ? cfg.zScoreThreshold : NaN };
      s.plots[4][i] = { time, value: cfg.showZBands ? -cfg.zScoreThreshold : NaN };

      // alertcondition(zHist > zScoreThreshold, ...), (zHist < -zScoreThreshold, ...), (ta.crossover(zHist, 0), ...),
      // (ta.crossunder(zHist, 0), ...)
      const flags = [
        gt(zHist, cfg.zScoreThreshold),
        lt(zHist, -cfg.zScoreThreshold),
        zHist > 0 && prev <= 0,
        zHist < 0 && prev >= 0,
      ];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        hlines: [{ value: 0, options: { title: 'Zero', color: ZERO_COLOR, linestyle: 'dashed' } }],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<InstitutionalMacdInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<InstitutionalMacdInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Z-Score > Threshold', message: 'Z-Score is above threshold (Overbought)' },
  { id: 'alert1', title: 'Z-Score < Threshold', message: 'Z-Score is below threshold (Oversold)' },
  { id: 'alert2', title: 'Z-Score Bull Cross', message: 'Z-Score crossed above 0' },
  { id: 'alert3', title: 'Z-Score Bear Cross', message: 'Z-Score crossed below 0' },
];

export const InstitutionalMacd = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
  createRun,
};
