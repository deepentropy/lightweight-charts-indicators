/**
 * PPO Divergence Alerts
 *
 * Percentage Price Oscillator with smoothed signal, bottom/top circles,
 * and 4 types each of bearish (orange) and bullish (purple) divergence circles.
 * Source defaults to open. Uses SMA smoother (default 2) on PPO.
 *
 * Reference: "PPO Divergence Alerts" community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PPOAlertsInputs {
  fastLength: number;
  slowLength: number;
  smoother: number;
  divLookbackPeriod: number;
  longTermDiv: boolean;
  src: SourceType;
}

export const defaultInputs: PPOAlertsInputs = {
  fastLength: 12,
  slowLength: 26,
  smoother: 2,
  divLookbackPeriod: 55,
  longTermDiv: true,
  src: 'open',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'smoother', type: 'int', title: 'Smoother', defval: 2, min: 1 },
  { id: 'divLookbackPeriod', type: 'int', title: 'Lookback Period', defval: 55, min: 1 },
  { id: 'longTermDiv', type: 'bool', title: 'Use Long Term Divergences', defval: true },
  { id: 'src', type: 'source', title: 'Source', defval: 'open' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PPO', color: '#000000', lineWidth: 2 },
  { id: 'plot1', title: 'Bottoms', color: '#800000', lineWidth: 3, style: 'circles' },
  { id: 'plot2', title: 'Tops', color: '#008000', lineWidth: 3, style: 'circles' },
  { id: 'plot3', title: 'Bearish Divergence', color: '#FF8C00', lineWidth: 6, style: 'circles' },
  { id: 'plot4', title: 'Bullish Divergence', color: '#800080', lineWidth: 6, style: 'circles' },
];

export const metadata = {
  title: 'PPO Alerts',
  shortTitle: 'PPOAlerts',
  overlay: false,
};

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface PpoVars {
  /** currenttrough6 = valuewhen(priceMins, low[1], 0) / currenttrough7 = valuewhen(priceMax, high[1], 0) */
  ct6: number;
  ct7: number;
  /** The bar of the last priceMins / priceMax (barssince) */
  lastPM: number;
  lastPX: number;
  /** d[1] at the last two oscMins (currenttrough4 = y7, y8) and oscMax (currenttrough5 = y3, y4) */
  ct4: number;
  ct4Prev: number;
  ct5: number;
  ct5Prev: number;
  /** y9 = valuewhen(oscMins, currenttrough6, 0) / y10 = valuewhen(oscMax, currenttrough7, 0) */
  y9: number;
  y10: number;
  /** filter / filter2 at the last two oscMins / oscMax (y6 / y2: the older) */
  fMin: number;
  fMinPrev: number;
  fMax: number;
  fMaxPrev: number;
  /** lowest(low, div_lookback_period) / highest(high, ...) at the last two priceMins / priceMax */
  ltBull: number;
  ltBullPrev: number;
  ltBear: number;
  ltBearPrev: number;
}

interface PpoRun extends BarRunState<PpoVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  sma: ReturnType<typeof taStep.sma>;
  d: number[];
  oscMins: boolean[];
  oscMaxs: boolean[];
  ct6: number[];
  ct7: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
}

function study(inputs: Partial<PPOAlertsInputs>): BarStudy<PpoRun, Result> {
  const { fastLength, slowLength, smoother, divLookbackPeriod, longTermDiv, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = slowLength + smoother;

  // lowest/highest over lookback ending at bar i (na skipped, a shorter window on the first bars)
  function lowestLow(bars: Bar[], atBar: number, period: number): number {
    let min = Infinity;
    const start = Math.max(0, atBar - period + 1);
    for (let j = start; j <= atBar; j++) {
      const v = bars[j].low;
      if (!isNaN(v) && v < min) min = v;
    }
    return min === Infinity ? NaN : min;
  }
  function highestHigh(bars: Bar[], atBar: number, period: number): number {
    let max = -Infinity;
    const start = Math.max(0, atBar - period + 1);
    for (let j = start; j <= atBar; j++) {
      const v = bars[j].high;
      if (!isNaN(v) && v > max) max = v;
    }
    return max === -Infinity ? NaN : max;
  }
  function lowestN(series: number[], atBar: number, period: number): number {
    let min = Infinity;
    const start = Math.max(0, atBar - period + 1);
    for (let j = start; j <= atBar; j++) {
      if (!isNaN(series[j]) && series[j] < min) min = series[j];
    }
    return min === Infinity ? NaN : min;
  }
  function highestN(series: number[], atBar: number, period: number): number {
    let max = -Infinity;
    const start = Math.max(0, atBar - period + 1);
    for (let j = start; j <= atBar; j++) {
      if (!isNaN(series[j]) && series[j] > max) max = series[j];
    }
    return max === -Infinity ? NaN : max;
  }

  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(fastLength);
      const slow = taStep.ema(slowLength);
      const sma = taStep.sma();
      const s: PpoRun = {
        fast, slow, sma, d: [], oscMins: [], oscMaxs: [], ct6: [], ct7: [],
        plot0: [], plot1: [], plot2: [], plot3: [], plot4: [],
        steps: [fast, slow, sma],
        vars: {
          ct6: NaN, ct7: NaN, lastPM: -Infinity, lastPX: -Infinity, ct4: NaN, ct4Prev: NaN, ct5: NaN, ct5Prev: NaN,
          y9: NaN, y10: NaN, fMin: NaN, fMinPrev: NaN, fMax: NaN, fMaxPrev: NaN, ltBull: NaN, ltBullPrev: NaN,
          ltBear: NaN, ltBearPrev: NaN,
        },
        lists: [], series: [],
      };
      s.series = [s.d, s.oscMins, s.oscMaxs, s.ct6, s.ct7, s.plot0, s.plot1, s.plot2, s.plot3, s.plot4];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time as number;
      const x = value(b);

      // macd2 = ((fastMA - slowMA) / slowMA) * 100  (PPO)
      const f = s.fast.step(x);
      const sl = s.slow.step(x);
      const ppo = f == null || sl == null || sl === 0 ? NaN : ((f - sl) / sl) * 100;
      // d = sma(ppo, smoother)
      const d = s.sma.step(ppo, smoother);
      s.d[i] = d;

      // Price bottom detection (Pine priceMins) - handles plateaus up to 4 equal lows
      // Pine: bullishPrice > bullishPrice[1] and bullishPrice[1] < bullishPrice[2]
      //   or plateau patterns with 2-4 equal lows followed by rise
      let priceMin = false;
      let priceMax = false;
      if (i >= 5) {
        const lo = b.low, lo1 = bars[i - 1].low, lo2 = bars[i - 2].low;
        const lo3 = bars[i - 3].low, lo4 = bars[i - 4].low, lo5 = bars[i - 5].low;
        priceMin =
          (lo > lo1 && lo1 < lo2) ||
          (lo1 === lo2 && lo1 < lo && lo1 < lo3) ||
          (lo1 === lo2 && lo1 === lo3 && lo1 < lo && lo1 < lo4) ||
          (lo1 === lo2 && lo1 === lo3 && lo1 === lo4 && lo1 < lo && lo1 < lo5);
        // Price top detection (Pine priceMax) - handles plateaus
        const hi = b.high, hi1 = bars[i - 1].high, hi2 = bars[i - 2].high;
        const hi3 = bars[i - 3].high, hi4 = bars[i - 4].high, hi5 = bars[i - 5].high;
        priceMax =
          (hi < hi1 && hi1 > hi2) ||
          (hi1 === hi2 && hi1 > hi && hi1 > hi3) ||
          (hi1 === hi2 && hi1 === hi3 && hi1 > hi && hi1 > hi4) ||
          (hi1 === hi2 && hi1 === hi3 && hi1 === hi4 && hi1 > hi && hi1 > hi5);
      }

      // Oscillator bottoms/tops
      let oscMin = false;
      let oscMax = false;
      if (i >= 2) {
        const d1 = s.d[i - 1], d2 = s.d[i - 2];
        if (!(isNaN(d) || isNaN(d1) || isNaN(d2))) {
          oscMin = d > d1 && d1 < d2;
          oscMax = d < d1 && d1 > d2;
        }
      }
      s.oscMins[i] = oscMin;
      s.oscMaxs[i] = oscMax;
      const dLag1 = i > 0 ? s.d[i - 1] : NaN;

      // barssince(priceMins) / barssince(priceMax) before this bar (exclusive of the current one)
      const bspMin = i - v.lastPM;
      const bspMax = i - v.lastPX;
      // currenttrough6 = valuewhen(priceMins, low[1], 0)
      // long_term_bull_filt = valuewhen(priceMins, lowest(div_lookback_period), 1) (lowest(N): lowest(low, N))
      if (priceMin) {
        v.lastPM = i;
        v.ct6 = bars[i - 1].low;
        v.ltBullPrev = v.ltBull;
        v.ltBull = lowestLow(bars, i, divLookbackPeriod);
      }
      if (priceMax) {
        v.lastPX = i;
        v.ct7 = bars[i - 1].high;
        v.ltBearPrev = v.ltBear;
        v.ltBear = highestHigh(bars, i, divLookbackPeriod);
      }
      s.ct6[i] = v.ct6;
      s.ct7[i] = v.ct7;

      // At an oscillator bottom: currenttrough4 = valuewhen(oscMins, d[1], 0), y9 = valuewhen(oscMins, currenttrough6, 0),
      // filter = barssince(priceMins) < 5 ? lowest(currenttrough6, 4) : na, y6 = valuewhen(oscMins, filter, 1)
      if (oscMin) {
        v.ct4Prev = v.ct4;
        v.ct4 = dLag1;
        v.y9 = v.ct6;
        let filter = NaN;
        if (bspMin < 5) {
          let minCt6 = Infinity;
          for (let k = i; k >= Math.max(0, i - 3); k--) {
            const c = s.ct6[k];
            if (!isNaN(c) && c < minCt6) minCt6 = c;
          }
          filter = minCt6 === Infinity ? NaN : minCt6;
        }
        v.fMinPrev = v.fMin;
        v.fMin = filter;
      }
      // At an oscillator top: currenttrough5, y10 = valuewhen(oscMax, currenttrough7, 0),
      // filter2 = barssince(priceMax) < 5 ? highest(currenttrough7, 4) : na, y2 = valuewhen(oscMax, filter2, 1)
      if (oscMax) {
        v.ct5Prev = v.ct5;
        v.ct5 = dLag1;
        v.y10 = v.ct7;
        let filter2 = NaN;
        if (bspMax < 5) {
          let maxCt7 = -Infinity;
          for (let k = i; k >= Math.max(0, i - 3); k--) {
            const c = s.ct7[k];
            if (!isNaN(c) && c > maxCt7) maxCt7 = c;
          }
          filter2 = maxCt7 === -Infinity ? NaN : maxCt7;
        }
        v.fMaxPrev = v.fMax;
        v.fMax = filter2;
      }

      // delayedlow = priceMins and barssince(oscMins) < 3 ? low[1] : na (and delayedhigh)
      const delayedlow = priceMin && (s.oscMins[i - 1] || (i >= 2 && s.oscMins[i - 2])) ? bars[i - 1].low : NaN;
      const delayedhigh = priceMax && (s.oscMaxs[i - 1] || (i >= 2 && s.oscMaxs[i - 2])) ? bars[i - 1].high : NaN;

      s.plot0[i] = { time, value: i < warmup || isNaN(d) ? NaN : d };
      s.plot1[i] = { time, value: NaN };
      s.plot2[i] = { time, value: NaN };
      s.plot3[i] = { time, value: NaN };
      s.plot4[i] = { time, value: NaN };
      // Bottoms/Tops circles: plot at d[1] with offset=-1 (bar i is the only writer of the point of bar i - 1)
      if (i > 0) {
        const prevTime = bars[i - 1].time as number;
        s.plot1[i - 1] = { time: prevTime, value: NaN };
        s.plot2[i - 1] = { time: prevTime, value: NaN };
      }
      if (i < warmup || isNaN(d)) return;
      if (oscMin) {
        const d1 = s.d[i - 1];
        if (!isNaN(d1)) s.plot1[i - 1] = { time: bars[i - 1].time as number, value: d1 };
      }
      if (oscMax) {
        const d1 = s.d[i - 1];
        if (!isNaN(d1)) s.plot2[i - 1] = { time: bars[i - 1].time as number, value: d1 };
      }

      const currenttrough4 = v.ct4;
      const currenttrough5 = v.ct5;
      const y9 = v.y9, y7 = v.ct4, y8 = v.ct4Prev, y6 = v.fMinPrev;
      const y10 = v.y10, y3 = v.ct5, y4 = v.ct5Prev, y2 = v.fMaxPrev;
      const longTermBullFilt = v.ltBullPrev;
      const longTermBearFilt = v.ltBearPrev;

      // i_cond = currenttrough5 < highest(d, div_lookback_period) -- long term bearish osc div
      const iCond = currenttrough5 < highestN(s.d, i, divLookbackPeriod);
      // i2 = y10 > long_term_bear_filt
      const i2 = y10 > longTermBearFilt;
      // i3 = delayedhigh > long_term_bear_filt
      const i3 = delayedhigh > longTermBearFilt;
      // i4 = currenttrough4 > lowest(d, div_lookback_period) -- long term bullish osc div
      const i4 = currenttrough4 > lowestN(s.d, i, divLookbackPeriod);
      // i5 = y9 < long_term_bull_filt
      const i5 = y9 < longTermBullFilt;
      // i6 = delayedlow < long_term_bull_filt
      const i6 = delayedlow < longTermBullFilt;

      // Bearish divergences (orange circles at d)
      const bearishdiv1 = !isNaN(y10) && !isNaN(y2) && y10 > y2 && oscMax && y3 < y4;
      const bearishdiv2 = !isNaN(delayedhigh) && !isNaN(y2) && delayedhigh > y2 && y3 < y4;
      const bearishdiv3 = longTermDiv && oscMax && iCond && i2;
      const bearishdiv4 = longTermDiv && iCond && i3;
      const bearish = bearishdiv1 || bearishdiv2 || bearishdiv3 || bearishdiv4;

      // Bullish divergences (purple circles at d)
      const bullishdiv1 = !isNaN(y9) && !isNaN(y6) && y9 < y6 && oscMin && y7 > y8;
      const bullishdiv2 = !isNaN(delayedlow) && !isNaN(y6) && delayedlow < y6 && y7 > y8;
      const bullishdiv3 = longTermDiv && oscMin && i4 && i5;
      const bullishdiv4 = longTermDiv && i4 && i6;
      const bullish = bullishdiv1 || bullishdiv2 || bullishdiv3 || bullishdiv4;

      if (bearish) s.plot3[i] = { time, value: d };
      if (bullish) s.plot4[i] = { time, value: d };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice(), 'plot4': s.plot4.slice() },
        hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
        markers: [],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PPOAlertsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PPOAlertsInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const PPOAlerts = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
