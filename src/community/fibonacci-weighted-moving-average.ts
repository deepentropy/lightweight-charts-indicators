/**
 * Fibonacci Weighted Moving Average
 *
 * A weighted moving average whose weights are Fibonacci numbers: the newest bar has weight F(length), the oldest
 * F(1). FWMA = sum(src[i] * F(length - i)) / sum(F(1..length)); a missing older value (first bars) is replaced by the
 * current source. The line is green when the FWMA rises and pink when it falls. Optional bar colours, wick colours
 * and background colours follow the FWMA direction.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Color Change' / 'Bearish Color Change' when the line
 * takes the bullish / bearish colour, 'Any Color Change' when its colour changes (na colour of the bar before bar 0
 * compares false).
 *
 * Reference: "Fibonacci Weighted Moving Average" by everget
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright (c) 2018-present, Alex Orekhov (everget). Fibonacci Weighted Moving Average script may
 * be freely distributed under the MIT license.
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FibonacciWeightedMovingAverageInputs {
  /** Number of bars (weights F(1)..F(length)) */
  length: number;
  src: SourceType;
  /** Colour the FWMA by its direction */
  highlightDirection: boolean;
  /** Colour the price bars (and wicks) by the FWMA direction */
  applyBarColors: boolean;
  /** Colour the background by the FWMA direction */
  applyBgColors: boolean;
}

export const defaultInputs: FibonacciWeightedMovingAverageInputs = {
  length: 14,
  src: 'close',
  highlightDirection: true,
  applyBarColors: true,
  applyBgColors: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'highlightDirection', type: 'bool', title: 'Highlight Direction', defval: true },
  { id: 'applyBarColors', type: 'bool', title: 'Apply Bar Colors', defval: true },
  { id: 'applyBgColors', type: 'bool', title: 'Apply Background Colors', defval: false },
];

const BULLISH = '#09b71e';
const BEARISH = '#e91e63';
const NEUTRAL = '#512da8';
const BULLISH_BAR = String(color.new(BULLISH, 50));
const BEARISH_BAR = String(color.new(BEARISH, 50));
const BULLISH_BG = String(color.new(BULLISH, 88));
const BEARISH_BG = String(color.new(BEARISH, 88));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FWMA', color: BULLISH, lineWidth: 2 },
];

export const metadata = {
  title: 'Fibonacci Weighted Moving Average',
  shortTitle: 'FWMA',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface FwmaRun extends BarRunState<Record<string, never>> {
  src: number[];
  ma: number[];
  maColor: string[];
  plot0: Point[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<FibonacciWeightedMovingAverageInputs>): BarStudy<FwmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);

  // Weights F(1)..F(length) built iteratively, reversed so index 0 (newest bar) carries F(length)
  const weights: number[] = [];
  let weightSum = 0.0;
  let prev = 0.0;
  let curr = 1.0;
  for (let i = 1; i <= cfg.length; i++) {
    weights.push(curr);
    weightSum += curr;
    const nextFib = prev + curr;
    prev = curr;
    curr = nextFib;
  }
  weights.reverse();

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: FwmaRun = {
        src: [], ma: [], maColor: [], plot0: [], barColors: [], bgColors: [], candles: [], flags: [[], [], []],
        times: [[], [], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.src, s.ma, s.maColor, s.plot0, s.candles, ...s.flags];
      if (cfg.applyBarColors) s.series.push(s.barColors);
      if (cfg.applyBgColors) s.series.push(s.bgColors);
      return s;
    },
    bar(s, b, bars) {
      const src = s.src;
      src[b] = value(bars[b]);
      let sum = 0.0;
      for (let i = 0; i < cfg.length; i++) {
        // nz(src[i], src): na (before the first bar, or an na source) is replaced by the current source
        const v = b - i >= 0 ? src[b - i] : NaN;
        sum += (isNaN(v) ? src[b] : v) * weights[i];
      }
      const ma = sum / weightSum;
      s.ma[b] = ma;

      const t = bars[b].time;
      const bull = b > 0 && gt(ma, s.ma[b - 1]); // isBullishSlope = ma > ma[1]
      const maColor = cfg.highlightDirection ? (bull ? BULLISH : BEARISH) : NEUTRAL;
      s.maColor[b] = maColor;
      s.plot0[b] = { time: t, value: Number.isFinite(ma) ? ma : NaN, color: maColor };
      // bullishColorChangeAlert = maColor[1] != bullishColor and maColor == bullishColor; bearish alike;
      // anyColorChangeAlert = maColor != maColor[1] (maColor[1] is na on bar 0: false)
      const prevColor = b > 0 ? s.maColor[b - 1] : '';
      const flag = (k: number, f: boolean) => {
        s.flags[k][b] = f;
        if (f) s.times[k].push(t as number);
      };
      flag(0, b > 0 && prevColor !== BULLISH && maColor === BULLISH);
      flag(1, b > 0 && prevColor !== BEARISH && maColor === BEARISH);
      flag(2, b > 0 && maColor !== prevColor);
      if (cfg.applyBarColors) s.barColors[b] = { time: t, color: bull ? BULLISH_BAR : BEARISH_BAR };
      // plotcandle(open, high, low, close, 'Bar Color', color = na, wickcolor = maWickColor, bordercolor = na,
      //   display = display.pane): only the wicks are drawn (none when Apply Bar Colors is off)
      const bar = bars[b];
      s.candles[b] = {
        time: t, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        color: 'transparent', borderColor: 'transparent',
        wickColor: cfg.applyBarColors ? (bull ? BULLISH : BEARISH) : 'transparent',
      };
      if (cfg.applyBgColors) s.bgColors[b] = { time: t, color: bull ? BULLISH_BG : BEARISH_BG };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        plotCandles: { wickCandles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FibonacciWeightedMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FibonacciWeightedMovingAverageInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Color Change', message: 'FWMA - Bullish Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
  { id: 'alert1', title: 'Bearish Color Change', message: 'FWMA - Bearish Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
  { id: 'alert2', title: 'Any Color Change', message: 'FWMA - Any Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
];

export const FibonacciWeightedMovingAverage = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
