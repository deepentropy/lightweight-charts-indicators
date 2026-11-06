/**
 * DEMA Flow
 *
 * DEMA of the close (2 * EMA - EMA of the EMA), smoothed by a running median of its last `hlFilterLength` values.
 * ATR bands around the smoothed DEMA: + upper multiplier * ATR and - lower multiplier * ATR. The trend turns
 * bullish when the close is above the upper band and bearish when it is below the lower band (it starts neutral).
 * The line, the candles drawn by the indicator and the bar colours take the trend colour.
 * Alerts (alertcondition, `alerts` of the result): 'DEMA Trend Bullish' / 'DEMA Trend Bearish' when the trend crosses
 * above / below 0 (ta.crossover / ta.crossunder of the trend signal).
 *
 * Reference: "DEMA Flow [Alpha Extract]" by AlphaExtract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DemaFlowInputs {
  /** DEMA length */
  demaLength: number;
  /** Length of the median filter of the DEMA */
  hlFilterLength: number;
  /** ATR length of the bands */
  atrLength: number;
  /** ATR multiplier of the upper band */
  upperAtrMult: number;
  /** ATR multiplier of the lower band */
  lowerAtrMult: number;
  /** Not used by the script */
  showBands: boolean;
  /** Not used by the script */
  showLabels: boolean;
}

export const defaultInputs: DemaFlowInputs = {
  demaLength: 23,
  hlFilterLength: 4,
  atrLength: 14,
  upperAtrMult: 2.1,
  lowerAtrMult: 1.5,
  showBands: true,
  showLabels: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'demaLength', type: 'int', title: 'DEMA Length', defval: 23, min: 5, max: 100 },
  { id: 'hlFilterLength', type: 'int', title: 'HL Median Filter Length', defval: 4, min: 3, max: 15 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 5, max: 50 },
  { id: 'upperAtrMult', type: 'float', title: 'Upper ATR Multiplier', defval: 2.1, min: 0.5, max: 5.0, step: 0.1 },
  { id: 'lowerAtrMult', type: 'float', title: 'Lower ATR Multiplier', defval: 1.5, min: 0.5, max: 5.0, step: 0.1 },
  { id: 'showBands', type: 'bool', title: 'Show ATR Bands', defval: true },
  { id: 'showLabels', type: 'bool', title: 'Show Trend Labels', defval: true },
];

const BULL = String(color.new('#00ff88', 0));
const BEAR = String(color.new('#ff0066', 0));
const NEUTRAL = String(color.new('#888888', 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smooth DEMA Trend', color: NEUTRAL, lineWidth: 2 },
];

export const metadata = {
  title: 'DEMA Flow [Alpha Extract]',
  shortTitle: 'DEMA Flow [Alpha Extract]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface DemaFlowRun extends BarRunState<{ median: number; trendSignal: number }> {
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  dema: number[];
  trend: number[];
  plot0: Point[];
  candles: PlotCandleData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DemaFlowInputs>): BarStudy<DemaFlowRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.hlFilterLength;
  return {
    init() {
      const s: DemaFlowRun = {
        ema1: taStep.ema(cfg.demaLength), ema2: taStep.ema(cfg.demaLength), atr: taStep.atr(cfg.atrLength),
        dema: [], trend: [], plot0: [], candles: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [], vars: { median: NaN, trendSignal: 0 }, lists: [], series: [],
      };
      s.steps = [s.ema1, s.ema2, s.atr];
      s.lists = s.times;
      s.series = [s.dema, s.trend, s.plot0, s.candles, s.barColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // dema(close, demaLength) = 2 * ema1 - ema2
      const ema1 = s.ema1.step(b.close);
      const ema2 = s.ema2.step(ema1);
      s.dema[i] = 2 * ema1 - ema2;

      // hlMedian(demaValue, hlFilterLength): from bar_index >= length - 1, the median of demaValue[0..length-1]
      // (array.sort puts na values last); before that bar the median keeps its var value (na)
      if (i >= len - 1) {
        const w: number[] = [];
        for (let k = 0; k < len; k++) w.push(s.dema[i - k]);
        w.sort((a, b) => (isNaN(a) ? (isNaN(b) ? 0 : 1) : isNaN(b) ? -1 : a - b));
        const m = w.length;
        v.median = m % 2 === 1 ? w[Math.floor(m / 2)] : (w[m / 2 - 1] + w[m / 2]) / 2;
      }
      const smooth = v.median;

      const atr = s.atr.step(b.high, b.low, b.close);
      const upperBand = smooth + cfg.upperAtrMult * atr;
      const lowerBand = smooth - cfg.lowerAtrMult * atr;
      const c = b.close;
      if (gt(c, upperBand)) v.trendSignal = 1;
      if (lt(c, lowerBand)) v.trendSignal = -1;
      const trendSignal = v.trendSignal;
      s.trend[i] = trendSignal;
      const trendColor = trendSignal === 1 ? BULL : trendSignal === -1 ? BEAR : NEUTRAL;
      const t = b.time;
      s.plot0[i] = { time: t, value: smooth, color: trendColor };
      // plotcandle(open, high, low, close, color = trendColor, wickcolor = trendColor, bordercolor = trendColor,
      //   force_overlay = true)
      s.candles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close,
        color: trendColor, wickColor: trendColor, borderColor: trendColor, forceOverlay: true };
      // barcolor(trendColor, title = 'Trend Bars')
      s.barColors[i] = { time: t, color: trendColor };

      // bullishSignal = ta.crossover(trendSignal, 0) / bearishSignal = ta.crossunder(trendSignal, 0)
      const prev = i > 0 ? s.trend[i - 1] : NaN;
      const flags = [trendSignal > 0 && prev <= 0, trendSignal < 0 && prev >= 0];
      for (let k = 0; k < 2; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        plotCandles: { demaTrendCandles: s.candles.slice() },
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DemaFlowInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DemaFlowInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'DEMA Trend Bullish', message: 'DEMA Trend: Turned Bullish ▲' },
  { id: 'alert1', title: 'DEMA Trend Bearish', message: 'DEMA Trend: Turned Bearish ▼' },
];

export const DemaFlow = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
