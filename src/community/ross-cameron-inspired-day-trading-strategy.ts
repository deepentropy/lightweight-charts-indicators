/**
 * Ross Cameron-Inspired Day Trading Strategy
 *
 * Buy / sell labels from three rules: a gap of at least `gapPercentage` % between the previous close and the open
 * (gap up: buy, gap down: sell); a momentum rule (RSI crossing over the oversold level with the close above the EMA:
 * buy; RSI crossing under the overbought level or the close below the EMA: sell); a mean reversion rule (RSI crossing
 * under the overbought level with the close below the SMA: buy; RSI crossing over the oversold level with the close
 * above the SMA: sell). The momentum and mean reversion signals are confirmed when the close is beyond the close of
 * the signal `confirmationPeriod` occurrences before. The EMA and the SMA are plotted, with horizontal lines at the
 * overbought / oversold levels (on the price scale, as the original script).
 *
 * Reference: "Ross Cameron-Inspired Day Trading Strategy" by manaziir
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RossCameronInspiredDayTradingStrategyInputs {
  /** Gap percentage (%) */
  gapPercentage: number;
  rsiLength: number;
  overBought: number;
  overSold: number;
  emaLength: number;
  smaLength: number;
  /** Occurrence of the earlier signal used for the confirmation (ta.valuewhen occurrence) */
  confirmationPeriod: number;
}

export const defaultInputs: RossCameronInspiredDayTradingStrategyInputs = {
  gapPercentage: 4.0,
  rsiLength: 14,
  overBought: 70,
  overSold: 30,
  emaLength: 20,
  smaLength: 50,
  confirmationPeriod: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'gapPercentage', type: 'float', title: 'Gap Percentage', defval: 4.0 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'overBought', type: 'int', title: 'Over Bought', defval: 70 },
  { id: 'overSold', type: 'int', title: 'Over Sold', defval: 30 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 20 },
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 50 },
  { id: 'confirmationPeriod', type: 'int', title: 'Confirmation Period', defval: 3 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'SMA', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'Ross Cameron-Inspired Day Trading Strategy',
  shortTitle: 'RC_Day_Trader',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface RossVars {
  /** The closes of the bars where each ta.valuewhen pair runs, latest last (the last confirmationPeriod + 1 of them;
   *  changed in place, copied by copyVars) */
  momBuyCloses: number[];
  momSellCloses: number[];
  mrBuyCloses: number[];
  mrSellCloses: number[];
}

interface RossRun extends BarRunState<RossVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ema: ReturnType<typeof taStep.ema>;
  sma: WindowSma;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<RossCameronInspiredDayTradingStrategyInputs>): BarStudy<RossRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const gapPercentage = cfg.gapPercentage / 100;
  const occ = cfg.confirmationPeriod;
  /** Closes kept: occurrence `occ` back is the only older one read */
  const keep = Math.max(occ + 1, 1);

  // ta.valuewhen(cond, close, 0) > / < ta.valuewhen(cond, close, confirmationPeriod): the calls run on the bars where
  // cond is true (right side of a lazy `and`); the closes of those bars, latest last
  const confirmed = (closes: number[], close: number, up: boolean) => {
    closes.push(close);
    while (closes.length > keep) closes.shift();
    const k = closes.length - 1 - occ;
    const earlier = k >= 0 && k < closes.length ? closes[k] : NaN;
    return up ? gt(close, earlier) : lt(close, earlier);
  };
  return {
    init() {
      const rsi = taStep.rsi(cfg.rsiLength);
      const ema = taStep.ema(cfg.emaLength);
      const sma = new WindowSma(cfg.smaLength);
      // ta.crossover / ta.crossunder (exact comparisons, last bar where both values were not na)
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: RossRun = {
        rsi, ema, sma, over, under, plot0: [], plot1: [], markers: [],
        steps: [rsi, ema, sma, over, under],
        vars: { momBuyCloses: [], momSellCloses: [], mrBuyCloses: [], mrSellCloses: [] },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    copyVars: (v) => ({
      momBuyCloses: v.momBuyCloses.slice(), momSellCloses: v.momSellCloses.slice(), mrBuyCloses: v.mrBuyCloses.slice(),
      mrSellCloses: v.mrSellCloses.slice(),
    }),
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const rsi = s.rsi.step(b.close);
      const ema = s.ema.step(b.close);
      const sma = s.sma.step(b.close);
      const rsiOverOversold = s.over.step(rsi, cfg.overSold);
      const rsiUnderOverbought = s.under.step(rsi, cfg.overBought);

      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const gap = (b.open - prevClose) / prevClose;
      const gapUp = ge(gap, gapPercentage);
      const gapDown = le(gap, -gapPercentage);

      const momentumBuy = rsiOverOversold && gt(b.close, ema);
      const momentumBuyConfirmed = momentumBuy && confirmed(v.momBuyCloses, b.close, true);
      const momentumSell = rsiUnderOverbought || lt(b.close, ema);
      const momentumSellConfirmed = momentumSell && confirmed(v.momSellCloses, b.close, false);
      const meanReversionBuy = rsiUnderOverbought && lt(b.close, sma);
      const meanReversionBuyConfirmed = meanReversionBuy && confirmed(v.mrBuyCloses, b.close, false);
      const meanReversionSell = rsiOverOversold && gt(b.close, sma);
      const meanReversionSellConfirmed = meanReversionSell && confirmed(v.mrSellCloses, b.close, true);

      const longCondition = gapUp || momentumBuyConfirmed || meanReversionBuyConfirmed;
      const shortCondition = gapDown || momentumSellConfirmed || meanReversionSellConfirmed;
      // plotshape(..., location.belowbar / abovebar, shape.labelup / labeldown, text, size.small); default text colour
      if (longCondition) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue, size: 'small' });
      }
      if (shortCondition) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue, size: 'small' });
      }
      s.plot0[i] = { time: t, value: ema };
      s.plot1[i] = { time: t, value: sma };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: cfg.overBought, options: { title: 'Over Bought', color: color.red, linestyle: 'dashed' } },
          { value: cfg.overSold, options: { title: 'Over Sold', color: color.green, linestyle: 'dashed' } },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RossCameronInspiredDayTradingStrategyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RossCameronInspiredDayTradingStrategyInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RossCameronInspiredDayTradingStrategy = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
