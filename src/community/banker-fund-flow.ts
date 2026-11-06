/**
 * Banker Fund Flow Trend Oscillator
 *
 * Models institutional fund flow using a weighted simple average normalization
 * combined with EMA smoothing. Computes two series: fund flow trend and bull/bear line (drawn as candles only).
 * Fund flow trend = double-smoothed stochastic-like normalization over 27 bars.
 * Bull/bear line = EMA(13) of typical price normalized over 34-bar highest/lowest.
 * Entry signal fires when fund_flow crosses above bull_bear and bull_bear < 25.
 * Candles, as the original's five plotcandle outputs (in their order, each drawn on the bars where its colour is not
 * na): yellow 0..50 entry candle; green (fund flow above the bull bear line), white (fund flow below 95 % of the
 * previous fund flow), red (fund flow below the line) and blue (below the line and above 95 % of the previous fund
 * flow) candles from the fund flow to the bull bear line.
 * Alerts (alertcondition, `alerts` of the result): one per candle colour, with the candle's condition.
 * No entry markers: the original shows the entry as the yellow candle only.
 *
 * Reference: "[blackcat] L3 Banker Fund Flow Trend Oscillator"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface BankerFundFlowInputs {
  normLength: number;
  typicalLength: number;
  emaLength: number;
  entryThreshold: number;
}

export const defaultInputs: BankerFundFlowInputs = {
  normLength: 27,
  typicalLength: 34,
  emaLength: 13,
  entryThreshold: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'normLength', type: 'int', title: 'Normalization Length', defval: 27, min: 2 },
  { id: 'typicalLength', type: 'int', title: 'Typical Price Length', defval: 34, min: 2 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 13, min: 1 },
  { id: 'entryThreshold', type: 'int', title: 'Entry Threshold', defval: 25, min: 1 },
];

// No line plots: the original draws the fund flow and the bull bear line only as its candles
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Banker Fund Flow Trend Oscillator',
  shortTitle: 'BankerFlow',
  overlay: false,
};

/**
 * PineScript calculate_weighted_simple_average:
 *   sum_float := nz(sum_float[1]) - nz(src[length]) + src
 *   moving_average := na(src[length]) ? na : sum_float / length
 *   output := na(output[1]) ? moving_average : (src * weight + output[1] * (length - weight)) / length
 *
 * This is a stateful running sum + weighted EMA-like smoothing, stepped bar by bar.
 */
class WeightedSimpleAverage implements Committable {
  /** The source values of the confirmed bars */
  private values: number[] = [];
  private sumFloat = 0;
  private prevOutput = NaN;
  private pendingValue = NaN;
  private pendingSum = 0;
  private pendingOutput = NaN;
  private stepped = false;

  constructor(private readonly length: number, private readonly weight: number) {}

  step(src: number): number {
    const { length, weight } = this;
    const i = this.values.length;
    const srcLag = i >= length ? this.values[i - length] : NaN;

    // nz(sum_float[1]) - nz(src[length]) + src
    const sumFloat = (isNaN(this.sumFloat) ? 0 : this.sumFloat) - (isNaN(srcLag) ? 0 : srcLag) + src;

    // moving_average := na(src[length]) ? na : sum_float / length
    const movingAverage = (i < length || isNaN(srcLag)) ? NaN : sumFloat / length;

    // output := na(output[1]) ? moving_average : (src * weight + output[1] * (length - weight)) / length
    const output = isNaN(this.prevOutput) ? movingAverage : (src * weight + this.prevOutput * (length - weight)) / length;

    this.stepped = true;
    this.pendingValue = src;
    this.pendingSum = sumFloat;
    this.pendingOutput = output;
    return output;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pendingValue);
    this.sumFloat = this.pendingSum;
    this.prevOutput = this.pendingOutput;
  }
}

const YELLOW = '#FFEB3B', GREEN = '#4CAF50', WHITE = '#FFFFFF', RED = '#FF5252', BLUE = '#2962FF';

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

interface BankerRun extends BarRunState<Record<string, never>> {
  hhNorm: WindowExtreme;
  llNorm: WindowExtreme;
  hhTyp: WindowExtreme;
  llTyp: WindowExtreme;
  wsa1: WeightedSimpleAverage;
  wsa2: WeightedSimpleAverage;
  ema: ReturnType<typeof taStep.ema>;
  fundFlowTrend: number[];
  bullBearArr: number[];
  entryCandles: PlotCandleData[];
  greenCandles: PlotCandleData[];
  whiteCandles: PlotCandleData[];
  redCandles: PlotCandleData[];
  blueCandles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<BankerFundFlowInputs>): BarStudy<BankerRun, Result> {
  const { normLength, typicalLength, emaLength, entryThreshold } = { ...defaultInputs, ...inputs };
  return {
    init() {
      // Highest/lowest over normLength (27) for stochastic normalization
      const hhNorm = new WindowExtreme(false, normLength);
      const llNorm = new WindowExtreme(true, normLength);
      const wsa1 = new WeightedSimpleAverage(5, 1);
      const wsa2 = new WeightedSimpleAverage(3, 1);
      const hhTyp = new WindowExtreme(false, typicalLength);
      const llTyp = new WindowExtreme(true, typicalLength);
      const ema = taStep.ema(emaLength);
      const s: BankerRun = {
        hhNorm, llNorm, hhTyp, llTyp, wsa1, wsa2, ema, fundFlowTrend: [], bullBearArr: [], entryCandles: [],
        greenCandles: [], whiteCandles: [], redCandles: [], blueCandles: [], flags: [[], [], [], [], []],
        times: [[], [], [], [], []],
        steps: [hhNorm, llNorm, wsa1, wsa2, hhTyp, llTyp, ema], vars: {}, lists: [], series: [],
      };
      s.lists = [s.entryCandles, s.greenCandles, s.whiteCandles, s.redCandles, s.blueCandles, ...s.times];
      s.series = [s.fundFlowTrend, s.bullBearArr, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Raw stochastic normalization: (close - lowest(low, 27)) / (highest(high, 27) - lowest(low, 27)) * 100
      const hn = s.hhNorm.step(b.high);
      const ln = s.llNorm.step(b.low);
      const rawNorm = isNaN(hn) || isNaN(ln) || hn === ln ? NaN : ((b.close - ln) / (hn - ln)) * 100;

      // fund_flow_trend = (3 * WSA(rawNorm, 5, 1) - 2 * WSA(WSA(rawNorm, 5, 1), 3, 1) - 50) * 1.032 + 50
      const w1 = s.wsa1.step(rawNorm);
      const w2 = s.wsa2.step(w1);
      const fft = isNaN(w1) || isNaN(w2) ? NaN : (3 * w1 - 2 * w2 - 50) * 1.032 + 50;
      s.fundFlowTrend[i] = fft;

      // Bull bear line: EMA((typical_price - lowest_low_34) / (highest_high_34 - lowest_low_34) * 100, 13)
      const typicalPrice = (2 * b.close + b.high + b.low + b.open) / 5;
      const ht = s.hhTyp.step(b.high);
      const lt = s.llTyp.step(b.low);
      const normTypical = isNaN(ht) || isNaN(lt) || ht === lt ? NaN : ((typicalPrice - lt) / (ht - lt)) * 100;
      const bbl = s.ema.step(normTypical) ?? NaN;
      s.bullBearArr[i] = bbl;

      // The original's five plotcandle() outputs, in their order, each with its own colour condition (bordercolor = na).
      // find_recent_value(fund_flow_trend * 0.95, 1): the previous value * 0.95, or the current one when it is na.
      const prevFft = i > 0 ? s.fundFlowTrend[i - 1] : NaN;
      const prevBbl = i > 0 ? s.bullBearArr[i - 1] : NaN;
      const recent95 = isNaN(prevFft) ? fft * 0.95 : prevFft * 0.95;
      // banker_entry_signal = ta.crossover(fund_flow_trend, bull_bear_line) and bull_bear_line < 25
      const entry = fft > bbl && prevFft <= prevBbl && bbl < entryThreshold;
      const green = fft > bbl;
      const white = fft < recent95;
      const red = fft < bbl;
      const blue = fft < bbl && fft > recent95;
      const time = b.time;
      [entry, green, white, red, blue].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time as number);
      });

      // plotcandle(0, 50, 0, 50, color = banker_entry_signal ? yellow : na, bordercolor = na)
      if (entry) s.entryCandles.push({ time, open: 0, high: 50, low: 0, close: 50, color: YELLOW, borderColor: 'transparent' });
      // plotcandle(fund_flow_trend, bull_bear_line, fund_flow_trend, bull_bear_line, color = <cond> ? <colour> : na)
      if (isNaN(fft) || isNaN(bbl)) return;
      const candle = (color: string): PlotCandleData => ({
        time, open: fft, high: Math.max(fft, bbl), low: Math.min(fft, bbl), close: bbl, color, borderColor: 'transparent',
      });
      if (green) s.greenCandles.push(candle(GREEN));
      if (white) s.whiteCandles.push(candle(WHITE));
      if (red) s.redCandles.push(candle(RED));
      if (blue) s.blueCandles.push(candle(BLUE));
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        hlines: [
          { value: 90, options: { color: '#E040FB', linestyle: 'dotted' as const, title: 'Strong' } },
          { value: 80, options: { color: '#EF5350', linestyle: 'dotted' as const, title: 'Overbought' } },
          { value: 20, options: { color: '#FFD700', linestyle: 'dotted' as const, title: 'Oversold' } },
          { value: 10, options: { color: '#66BB6A', linestyle: 'dotted' as const, title: 'Weak' } },
        ],
        fills: [
          { plot1: 'hline_oversold', plot2: 'hline_weak', options: { color: 'rgba(255, 235, 59, 0.3)' } },
          { plot1: 'hline_overbought', plot2: 'hline_strong', options: { color: 'rgba(224, 64, 251, 0.3)' } },
        ],
        // later candles are drawn on top
        plotCandles: {
          entrySignal: s.entryCandles.slice(), green: s.greenCandles.slice(), white: s.whiteCandles.slice(),
          red: s.redCandles.slice(), blue: s.blueCandles.slice(),
        },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BankerFundFlowInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BankerFundFlowInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Alert on Yellow Candle', message: 'Yellow Candle!' },
  { id: 'alert1', title: 'Alert on Green Candle', message: 'Green Candle!' },
  { id: 'alert2', title: 'Alert on White Candle', message: 'White Candle!' },
  { id: 'alert3', title: 'Alert on Red Candle', message: 'Red Candle!' },
  { id: 'alert4', title: 'Alert on Blue Candle', message: 'Blue Candle!' },
];

export const BankerFundFlow = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
