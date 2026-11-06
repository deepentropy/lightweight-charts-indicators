/**
 * Inverse Distance Weighted Moving Average
 *
 * A weighted average of the last `length` source values. The weight of each value is the sum of its absolute
 * distances to all other values of the window: IDWMA = sum(src[i] * w[i]) / sum(w[i]), w[i] = sum_j |src[i] - src[j]|.
 * A missing older value (first bars) is replaced by the current source; a flat window (all weights zero) gives the
 * source. The line is green when the IDWMA rises and pink when it falls. Optional bar colours, wick colours and
 * background colours follow the IDWMA direction.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Color Change' / 'Bearish Color Change' when the line turns
 * green / pink, 'Any Color Change' when its colour changes (from the second bar).
 *
 * Reference: "Inverse Distance Weighted Moving Average" by everget
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright (c) 2019-present, Alex Orekhov (everget). Inverse Distance Weighted Moving Average
 * script may be freely distributed under the GPL-3.0 license.
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface InverseDistanceWeightedMovingAverageInputs {
  /** Number of bars in the window */
  length: number;
  src: SourceType;
  /** Colour the IDWMA by its direction */
  highlightDirection: boolean;
  /** Colour the price bars (and wicks) by the IDWMA direction */
  applyBarColors: boolean;
  /** Colour the background by the IDWMA direction */
  applyBgColors: boolean;
}

export const defaultInputs: InverseDistanceWeightedMovingAverageInputs = {
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
  { id: 'plot0', title: 'IDWMA', color: BULLISH, lineWidth: 2 },
];

export const metadata = {
  title: 'Inverse Distance Weighted Moving Average',
  shortTitle: 'IDWMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a != b only when |a - b| > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const ne = (a: number, b: number) => Math.abs(a - b) > 1e-10;

type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

interface IdwmaRun extends BarRunState<Record<string, never>> {
  src: number[];
  ma: number[];
  weights: number[];
  maColors: string[];
  plot0: { time: number; value: number; color: string }[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<InverseDistanceWeightedMovingAverageInputs>): BarStudy<IdwmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.length;
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: IdwmaRun = {
        src: [], ma: [], weights: new Array(len).fill(0), maColors: [], plot0: [], barColors: [], bgColors: [],
        candles: [], flags: [[], [], []], times: [[], [], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors, s.bgColors, s.candles, ...s.times];
      s.series = [s.src, s.ma, s.maColors, s.plot0, ...s.flags];
      return s;
    },
    bar(s, b, bars) {
      const bar = bars[b];
      const v0 = value(bar);
      const src = s.src;
      src[b] = v0 ?? NaN;
      // nz(src[i], src): na (before the first bar, or an na source) is replaced by the current source
      const at = (i: number) => {
        const v = b - i >= 0 ? src[b - i] : NaN;
        return isNaN(v) ? src[b] : v;
      };
      const weights = s.weights;
      weights.fill(0);
      // Each unordered pair once; the distance is added to both taps (Pine order)
      if (len > 1) {
        for (let i = 0; i <= len - 2; i++) {
          for (let j = i + 1; j <= len - 1; j++) {
            const d = Math.abs(at(i) - at(j));
            weights[i] = weights[i] + d;
            weights[j] = weights[j] + d;
          }
        }
      }
      let sum = 0.0;
      let weightSum = 0.0;
      for (let i = 0; i < len; i++) {
        sum += at(i) * weights[i];
        weightSum += weights[i];
      }
      // ma = weightSum != 0 ? sum / weightSum : src
      const ma = ne(weightSum, 0) ? sum / weightSum : src[b];
      s.ma[b] = ma;

      const t = bar.time;
      const bull = b > 0 && gt(ma, s.ma[b - 1]); // isBullishSlope = ma > ma[1]
      const maColor = cfg.highlightDirection ? (bull ? BULLISH : BEARISH) : NEUTRAL;
      s.maColors[b] = maColor;
      s.plot0[b] = { time: t, value: Number.isFinite(ma) ? ma : NaN, color: maColor };
      if (cfg.applyBarColors) s.barColors.push({ time: t, color: bull ? BULLISH_BAR : BEARISH_BAR });
      // plotcandle(open, high, low, close, 'Bar Color', color = na, wickcolor = maWickColor, bordercolor = na,
      //   display = display.pane): only the wicks are drawn (none when Apply Bar Colors is off)
      s.candles.push({
        time: t, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        color: 'transparent', borderColor: 'transparent',
        wickColor: cfg.applyBarColors ? (bull ? BULLISH : BEARISH) : 'transparent',
      });
      if (cfg.applyBgColors) s.bgColors.push({ time: t, color: bull ? BULLISH_BG : BEARISH_BG });

      // bullishColorChangeAlert = maColor[1] != bullishColor and maColor == bullishColor; bearish the same;
      // anyColorChangeAlert = maColor != maColor[1] (maColor[1] is na on the first bar)
      const prev = b > 0 ? s.maColors[b - 1] : undefined;
      const flags = [
        b > 0 && prev !== BULLISH && maColor === BULLISH,
        b > 0 && prev !== BEARISH && maColor === BEARISH,
        b > 0 && maColor !== prev,
      ];
      for (let k = 0; k < 3; k++) {
        s.flags[k][b] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
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
export function createRun(inputs: Partial<InverseDistanceWeightedMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<InverseDistanceWeightedMovingAverageInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Color Change', message: 'IDWMA - Bullish Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
  { id: 'alert1', title: 'Bearish Color Change', message: 'IDWMA - Bearish Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
  { id: 'alert2', title: 'Any Color Change', message: 'IDWMA - Any Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
];

export const InverseDistanceWeightedMovingAverage = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
