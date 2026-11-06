/**
 * Sharp Modified Moving Average
 *
 * SHMMA = 3 * WMA(src, length) - 2 * SMA(src, length). The line is green when the SHMMA rises (ma > ma[1]) and pink
 * otherwise. Optional bar colours, wick colours and background colours follow the SHMMA direction.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Color Change' / 'Bearish Color Change' when the line
 * takes the bullish / bearish colour, 'Any Color Change' when its colour changes (na colour of the bar before bar 0
 * compares false).
 *
 * Reference: "Sharp Modified Moving Average" by everget
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright (c) 2018-present, Alex Orekhov (everget). Sharp Modified Moving Average script may be
 * freely distributed under the terms of the GPL-3.0 license.
 */

import { taStep, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData, PlotCandleData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { WindowSma, barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SharpModifiedMovingAverageInputs {
  /** WMA / SMA length */
  length: number;
  src: SourceType;
  /** Colour the SHMMA by its direction */
  highlightDirection: boolean;
  /** Colour the price bars (and wicks) by the SHMMA direction */
  applyBarColors: boolean;
  /** Colour the background by the SHMMA direction */
  applyBgColors: boolean;
}

export const defaultInputs: SharpModifiedMovingAverageInputs = {
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
  { id: 'plot0', title: 'SHMMA', color: BULLISH, lineWidth: 2 },
];

export const metadata = {
  title: 'Sharp Modified Moving Average',
  shortTitle: 'SHMMA',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

interface ShmmaRun extends BarRunState<{ prevMa: number; prevColor: string }> {
  wma: ReturnType<typeof taStep.wma>;
  sma: WindowSma;
  ext: number[] | null;
  plot0: { time: number; value: number; color: string }[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  candles: PlotCandleData[];
  flags: boolean[][];
}

function study(inputs: Partial<SharpModifiedMovingAverageInputs>): BarStudy<ShmmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const barValue = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init(bars) {
      const wma = taStep.wma();
      const sma = new WindowSma(cfg.length);
      const s: ShmmaRun = {
        wma, sma,
        ext: isBarSource(cfg.src) ? null : getSourceSeries(bars, cfg.src).toArray().map((v) => v ?? NaN),
        plot0: [], barColors: [], bgColors: [], candles: [], flags: [[], [], []],
        steps: [wma, sma],
        vars: { prevMa: NaN, prevColor: '' },
        lists: [], series: [],
      };
      s.lists = [s.barColors, s.bgColors];
      s.series = [s.plot0, s.candles, ...s.flags];
      return s;
    },
    bar(s, b, bars) {
      const v = s.vars;
      const bar = bars[b];
      const t = bar.time;
      const src = s.ext ? s.ext[b] : barValue(bar);
      // ma = 3 * ta.wma(src, length) - 2 * ta.sma(src, length)
      const ma = 3 * s.wma.step(src, cfg.length) - 2 * s.sma.step(src);
      const bull = b > 0 && gt(ma, v.prevMa); // isBullishSlope = ma > ma[1]
      const maColor = cfg.highlightDirection ? (bull ? BULLISH : BEARISH) : NEUTRAL;
      s.plot0[b] = { time: t, value: Number.isFinite(ma) ? ma : NaN, color: maColor };
      // bullishColorChangeAlert = maColor[1] != bullishColor and maColor == bullishColor; bearish alike;
      // anyColorChangeAlert = maColor != maColor[1] (maColor[1] is na on bar 0: false)
      const prevColor = v.prevColor;
      s.flags[0][b] = b > 0 && prevColor !== BULLISH && maColor === BULLISH;
      s.flags[1][b] = b > 0 && prevColor !== BEARISH && maColor === BEARISH;
      s.flags[2][b] = b > 0 && maColor !== prevColor;
      v.prevColor = maColor;
      v.prevMa = ma;
      if (cfg.applyBarColors) s.barColors.push({ time: t, color: bull ? BULLISH_BAR : BEARISH_BAR });
      // plotcandle(open, high, low, close, 'Bar Color', color = na, wickcolor = maWickColor, bordercolor = na,
      //   display = display.pane): only the wicks are drawn (none when Apply Bar Colors is off)
      s.candles[b] = {
        time: t, open: bar.open, high: bar.high, low: bar.low, close: bar.close,
        color: 'transparent', borderColor: 'transparent',
        wickColor: cfg.applyBarColors ? (bull ? BULLISH : BEARISH) : 'transparent',
      };
      if (cfg.applyBgColors) s.bgColors.push({ time: t, color: bull ? BULLISH_BG : BEARISH_BG });
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        plotCandles: { wickCandles: s.candles.slice() },
        alerts: alertStates(alertConditions, bars, s.flags),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SharpModifiedMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SharpModifiedMovingAverageInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Color Change', message: 'SHMMA - Bullish Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
  { id: 'alert1', title: 'Bearish Color Change', message: 'SHMMA - Bearish Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
  { id: 'alert2', title: 'Any Color Change', message: 'SHMMA - Any Color Change\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
];

export const SharpModifiedMovingAverage = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
