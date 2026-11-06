/**
 * Henderson Weighted Moving Average
 *
 * A weighted moving average with the Henderson weights of a (2m + 1)-term filter, m = (length - 1) / 2:
 * w(j) = 315 ((m+1)^2 - j^2) ((m+2)^2 - j^2) ((m+3)^2 - j^2) (3 (m+2)^2 - 11 j^2 - 16) /
 * (8 (m+2) ((m+2)^2 - 1) (4 (m+2)^2 - 1) (4 (m+2)^2 - 9) (4 (m+2)^2 - 25)), for j = i - m, i = 0 .. length - 1.
 * HWMA = sum(src[i] * w) / sum(w); a missing older value (first bars) is replaced by the current source. The line is
 * green when the HWMA rises and pink when it falls. Optional bar colours, wick colours and background colours follow
 * the HWMA direction.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Color Change' / 'Bearish Color Change' when the line turns
 * green / pink, 'Any Color Change' when its colour changes (from the second bar).
 *
 * Reference: "Henderson Weighted Moving Average" by everget
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright (c) 2018-present, Alex Orekhov (everget). Henderson Weighted Moving Average script may
 * be freely distributed under the terms of the GPL-3.0 license.
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HendersonWeightedMovingAverageInputs {
  /** Number of filter terms */
  length: number;
  src: SourceType;
  /** Colour the HWMA by its direction */
  highlightDirection: boolean;
  /** Colour the price bars (and wicks) by the HWMA direction */
  applyBarColors: boolean;
  /** Colour the background by the HWMA direction */
  applyBgColors: boolean;
}

export const defaultInputs: HendersonWeightedMovingAverageInputs = {
  length: 7,
  src: 'close',
  highlightDirection: true,
  applyBarColors: true,
  applyBgColors: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 7, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  {
    id: 'highlightDirection', type: 'bool', title: 'Highlight Direction', defval: true,
    tooltip: 'Colors the HWMA according to its direction:\n• Green = rising\n• Pink = falling',
  },
  {
    id: 'applyBarColors', type: 'bool', title: 'Apply Bar Colors', defval: true,
    tooltip: 'Colors price bars according to the HWMA direction:\n• Bullish color = rising HWMA\n• Bearish color = falling HWMA',
  },
  {
    id: 'applyBgColors', type: 'bool', title: 'Apply Background Colors', defval: false,
    tooltip: 'Colors the chart background according to the HWMA direction:\n• Bullish color = rising HWMA\n• Bearish color = falling HWMA',
  },
];

const BULLISH = '#09b71e';
const BEARISH = '#e91e63';
const NEUTRAL = '#512da8';
const BULLISH_BAR = String(color.new(BULLISH, 50));
const BEARISH_BAR = String(color.new(BEARISH, 50));
const BULLISH_BG = String(color.new(BULLISH, 88));
const BEARISH_BG = String(color.new(BEARISH, 88));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'HWMA', color: BULLISH, lineWidth: 2 },
];

export const metadata = {
  title: 'Henderson Weighted Moving Average',
  shortTitle: 'HWMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a != b when |a - b| > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

/** _hwmaWeight(m, j): the general form of the weights of the (2m + 1)-term Henderson filter */
function hwmaWeight(m: number, j: number): number {
  const m1 = m + 1;
  const m2 = m + 2;
  const m3 = m + 3;
  const powj2 = j * j;
  const powm22 = m2 * m2;
  const numerator = 315 * (m1 * m1 - powj2) * (powm22 - powj2) * (m3 * m3 - powj2) * (3 * powm22 - 11 * powj2 - 16);
  const denominator = 8 * m2 * (powm22 - 1) * (4 * powm22 - 1) * (4 * powm22 - 9) * (4 * powm22 - 25);
  return ne(denominator, 0) ? numerator / denominator : 0;
}

type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

interface HwmaRun extends BarRunState<Record<string, never>> {
  src: number[];
  ma: number[];
  plot0: { time: number; value: number; color: string }[];
  candles: PlotCandleData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<HendersonWeightedMovingAverageInputs>): BarStudy<HwmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);

  // The kernel is built once (var array, filled on the first bar). termMult = (length - 1) / 2 keeps the
  // fractional part for an even length (Pine v6 int division)
  const weights: number[] = [];
  let weightSum = 0.0;
  const termMult = (cfg.length - 1) / 2;
  for (let i = 0; i <= cfg.length - 1; i++) {
    const weight = hwmaWeight(termMult, i - termMult);
    weights.push(weight);
    weightSum += weight;
  }

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: HwmaRun = {
        src: [], ma: [], plot0: [], candles: [], barColors: [], bgColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.series = [s.src, s.ma, s.plot0, s.candles, ...s.flags];
      s.lists = [s.barColors, s.bgColors, ...s.times];
      return s;
    },
    bar(s, b, bars) {
      const src = s.src;
      src[b] = value(bars[b]);
      let sum = 0.0;
      for (let i = 0; i <= cfg.length - 1; i++) {
        // nz(src[i], src): na (before the first bar, or an na source) is replaced by the current source
        const v = b - i >= 0 ? src[b - i] : NaN;
        sum += (isNaN(v) ? src[b] : v) * weights[i];
      }
      // ma = weightSum != 0 ? sum / weightSum : src
      const ma = ne(weightSum, 0) ? sum / weightSum : src[b];
      s.ma[b] = ma;

      const t = bars[b].time;
      const bull = b > 0 && gt(ma, s.ma[b - 1]); // isBullishSlope = ma > ma[1]
      const maColor = cfg.highlightDirection ? (bull ? BULLISH : BEARISH) : NEUTRAL;
      s.plot0[b] = { time: t, value: Number.isFinite(ma) ? ma : NaN, color: maColor };
      // barcolor(title = 'Bar Color', color = applyBarColors ? (bull ? bullishBarColor : bearishBarColor) : na)
      if (cfg.applyBarColors) s.barColors.push({ time: t, color: bull ? BULLISH_BAR : BEARISH_BAR });
      // plotcandle(open, high, low, close, 'Bar Color', color = na, wickcolor = maWickColor, bordercolor = na,
      //   display = display.pane): only the wicks are drawn (none when Apply Bar Colors is off)
      const bar = bars[b];
      s.candles[b] = {
        time: t, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        color: 'transparent', borderColor: 'transparent',
        wickColor: cfg.applyBarColors ? (bull ? BULLISH : BEARISH) : 'transparent',
      };
      // bgcolor(title = 'Background Color', color = applyBgColors ? ... : na)
      if (cfg.applyBgColors) s.bgColors.push({ time: t, color: bull ? BULLISH_BG : BEARISH_BG });

      // bullishColorChangeAlert = maColor[1] != bullishColor and maColor == bullishColor; bearish: the same with
      // bearishColor; anyColorChangeAlert = maColor != maColor[1] (no history on the first bar: false)
      const prev = b > 0 ? s.plot0[b - 1].color : '';
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
export function createRun(inputs: Partial<HendersonWeightedMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HendersonWeightedMovingAverageInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Color Change', message: 'HWMA - Bullish Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
  { id: 'alert1', title: 'Bearish Color Change', message: 'HWMA - Bearish Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
  { id: 'alert2', title: 'Any Color Change', message: 'HWMA - Any Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
];

export const HendersonWeightedMovingAverage = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
