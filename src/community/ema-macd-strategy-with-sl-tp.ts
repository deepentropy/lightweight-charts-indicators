/**
 * EMA & MACD Strategy with SL/TP
 *
 * An EMA channel (EMA of the high and EMA of the low) with a long EMA of the close as trend filter, and the MACD
 * histogram. BUY: the channel is above the long EMA, the histogram is positive, the close crossed over the channel
 * top and the histogram crossed over zero within the last `lookbackPeriod` bars, and one of the two crosses is on
 * this bar. SELL is the mirror. On a signal the stop-loss is the opposite channel line and the take-profit is the
 * close plus (or minus) the risk times the reward ratio; both lines are removed when price crosses the stop-loss.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Alert' and 'Sell Alert', true on the BUY / SELL bars.
 *
 * Reference: "EMA & MACD Strategy with SL/TP" by mamachi-
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © mamachi-
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EmaMacdStrategyWithSlTpInputs {
  /** EMA channel length */
  emaShortLen: number;
  /** Long EMA length (trend filter) */
  emaLongLen: number;
  /** MACD fast length */
  macdFast: number;
  /** MACD slow length */
  macdSlow: number;
  /** MACD signal length */
  macdSignal: number;
  /** Bars during which a cross stays valid */
  lookbackPeriod: number;
  /** Reward / risk ratio of the take-profit */
  rewardRatio: number;
}

export const defaultInputs: EmaMacdStrategyWithSlTpInputs = {
  emaShortLen: 15,
  emaLongLen: 200,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  lookbackPeriod: 3,
  rewardRatio: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaShortLen', type: 'int', title: 'EMAチャネル期間', defval: 15, min: 1 },
  { id: 'emaLongLen', type: 'int', title: '長期EMA(環境認識)期間', defval: 200, min: 1 },
  { id: 'macdFast', type: 'int', title: 'MACD 短期(Fast)', defval: 12, min: 1 },
  { id: 'macdSlow', type: 'int', title: 'MACD 長期(Slow)', defval: 26, min: 1 },
  { id: 'macdSignal', type: 'int', title: 'MACD シグナル', defval: 9, min: 1 },
  { id: 'lookbackPeriod', type: 'int', title: '条件成立の有効期限 (本数)', defval: 3, min: 0 },
  { id: 'rewardRatio', type: 'float', title: 'リスクリワード比 (利確/損切)', defval: 1.5, step: 0.1 },
];

const CHANNEL_COL = String(color.new(color.blue, 50));
const FILL_COL = String(color.new(color.blue, 90));
const SL_COL = String(color.new(color.red, 0));
const TP_COL = String(color.new(color.green, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA High', color: CHANNEL_COL, lineWidth: 1 },
  { id: 'plot1', title: 'EMA Low', color: CHANNEL_COL, lineWidth: 1 },
  { id: 'plot2', title: 'EMA 200', color: color.red, lineWidth: 2 },
  { id: 'plot3', title: 'Stop Loss', color: SL_COL, lineWidth: 2, style: 'linebr' },
  { id: 'plot4', title: 'Take Profit', color: TP_COL, lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'EMA & MACD Strategy with SL/TP',
  shortTitle: 'EMA_MACD_SLTP',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface EmaMacdVars {
  /** var float slLine = na, var float tpLine = na */
  sl: number;
  tp: number;
}

interface EmaMacdRun extends BarRunState<EmaMacdVars> {
  emaHigh: ReturnType<typeof taStep.ema>;
  emaLow: ReturnType<typeof taStep.ema>;
  ema200: ReturnType<typeof taStep.ema>;
  macd: ReturnType<typeof taStep.macd>;
  priceUnderLow: ReturnType<typeof taStep.crossunder>;
  priceOverHigh: ReturnType<typeof taStep.crossover>;
  histUnderZero: ReturnType<typeof taStep.crossunder>;
  histOverZero: ReturnType<typeof taStep.crossover>;
  sincePriceLow: ReturnType<typeof taStep.barssince>;
  sincePriceHigh: ReturnType<typeof taStep.barssince>;
  sinceHistLow: ReturnType<typeof taStep.barssince>;
  sinceHistHigh: ReturnType<typeof taStep.barssince>;
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<EmaMacdStrategyWithSlTpInputs>): BarStudy<EmaMacdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lb = cfg.lookbackPeriod;
  return {
    init() {
      const s: EmaMacdRun = {
        emaHigh: taStep.ema(cfg.emaShortLen), emaLow: taStep.ema(cfg.emaShortLen), ema200: taStep.ema(cfg.emaLongLen),
        macd: taStep.macd(cfg.macdFast, cfg.macdSlow, cfg.macdSignal),
        priceUnderLow: taStep.crossunder(), priceOverHigh: taStep.crossover(),
        histUnderZero: taStep.crossunder(), histOverZero: taStep.crossover(),
        sincePriceLow: taStep.barssince(), sincePriceHigh: taStep.barssince(),
        sinceHistLow: taStep.barssince(), sinceHistHigh: taStep.barssince(),
        plots: [[], [], [], [], []], markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: { sl: NaN, tp: NaN }, lists: [], series: [],
      };
      s.steps = [
        s.emaHigh, s.emaLow, s.ema200, s.macd, s.priceUnderLow, s.priceOverHigh, s.histUnderZero, s.histOverZero,
        s.sincePriceLow, s.sincePriceHigh, s.sinceHistLow, s.sinceHistHigh,
      ];
      s.lists = [s.markers, ...s.times];
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const close = b.close;
      const emaHigh = s.emaHigh.step(b.high);
      const emaLow = s.emaLow.step(b.low);
      const ema200 = s.ema200.step(close);
      const macdHist = s.macd.step(close)[2];

      // Crosses (exact comparisons, oakscriptjs)
      const priceCrossUnderLow = s.priceUnderLow.step(close, emaLow);
      const priceCrossOverHigh = s.priceOverHigh.step(close, emaHigh);
      const histCrossUnderZero = s.histUnderZero.step(macdHist, 0);
      const histCrossOverZero = s.histOverZero.step(macdHist, 0);
      const barsSincePriceLow = s.sincePriceLow.step(priceCrossUnderLow);
      const barsSincePriceHigh = s.sincePriceHigh.step(priceCrossOverHigh);
      const barsSinceHistLow = s.sinceHistLow.step(histCrossUnderZero);
      const barsSinceHistHigh = s.sinceHistHigh.step(histCrossOverZero);

      const isAbove200 = gt(emaLow, ema200);
      const isBelow200 = lt(emaHigh, ema200);
      const longCondition = isAbove200 && gt(macdHist, 0) && le(barsSincePriceHigh, lb)
        && le(barsSinceHistHigh, lb) && (priceCrossOverHigh || histCrossOverZero);
      const shortCondition = isBelow200 && lt(macdHist, 0) && le(barsSincePriceLow, lb)
        && le(barsSinceHistLow, lb) && (priceCrossUnderLow || histCrossUnderZero);

      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      if (longCondition) {
        v.sl = emaLow;
        v.tp = close + (close - v.sl) * cfg.rewardRatio;
      } else if (shortCondition) {
        v.sl = emaHigh;
        v.tp = close - (v.sl - close) * cfg.rewardRatio;
      } else if ((lt(b.low, v.sl) && gt(prevClose, v.sl)) || (gt(b.high, v.sl) && lt(prevClose, v.sl))) {
        v.sl = NaN;
        v.tp = NaN;
      }

      const time = b.time;
      s.plots[0][i] = { time, value: emaHigh, color: CHANNEL_COL };
      s.plots[1][i] = { time, value: emaLow, color: CHANNEL_COL };
      s.plots[2][i] = { time, value: ema200, color: color.red };
      s.plots[3][i] = { time, value: v.sl, color: SL_COL };
      s.plots[4][i] = { time, value: v.tp, color: TP_COL };

      // plotshape(longCondition, shape.triangleup, location.belowbar, color.green, size.small, text = 'BUY')
      if (longCondition) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small',
          text: 'BUY', textColor: color.blue });
      }
      // plotshape(shortCondition, shape.triangledown, location.abovebar, color.red, size.small, text = 'SELL')
      if (shortCondition) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small',
          text: 'SELL', textColor: color.blue });
      }
      // alertcondition(longCondition, 'Buy Alert') / alertcondition(shortCondition, 'Sell Alert')
      s.flags[0][i] = longCondition;
      s.flags[1][i] = shortCondition;
      if (longCondition) s.times[0].push(time as number);
      if (shortCondition) s.times[1].push(time as number);
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
        // fill(p_high, p_low, color = color.new(color.blue, 90), title = 'Channel Fill')
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: FILL_COL, title: 'Channel Fill' } }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EmaMacdStrategyWithSlTpInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EmaMacdStrategyWithSlTpInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Alert', message: 'EMAチャネル: 買いサイン (SL: {{plot_4}}, TP: {{plot_5}})' },
  { id: 'alert1', title: 'Sell Alert', message: 'EMAチャネル: 売りサイン (SL: {{plot_4}}, TP: {{plot_5}})' },
];

export const EmaMacdStrategyWithSlTp = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
