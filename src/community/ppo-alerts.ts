/**
 * PPO Divergence Alerts
 *
 * Percentage Price Oscillator with smoothed signal, bottom/top circles,
 * and 4 types each of bearish (orange) and bullish (purple) divergence circles.
 * Source defaults to open. Uses SMA smoother (default 2) on PPO.
 *
 * Reference: TradingView "PPO Divergence Alerts" community indicator
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<PPOAlertsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { fastLength, slowLength, smoother, divLookbackPeriod, longTermDiv, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const source = getSourceSeries(bars, src);

  const emaFast = ta.ema(source, fastLength);
  const emaSlow = ta.ema(source, slowLength);
  const emaFastArr = emaFast.toArray();
  const emaSlowArr = emaSlow.toArray();

  // macd2 = ((fastMA - slowMA) / slowMA) * 100  (PPO)
  const ppoArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = emaFastArr[i];
    const s = emaSlowArr[i];
    if (f == null || s == null || s === 0) {
      ppoArr[i] = NaN;
    } else {
      ppoArr[i] = ((f - s) / s) * 100;
    }
  }

  // d = sma(ppo, smoother)
  const ppoSeries = new Series(bars, (_b, i) => ppoArr[i]);
  const dSeries = ta.sma(ppoSeries, smoother);
  const dArr = dSeries.toArray();

  const warmup = slowLength + smoother;

  // Price bottom detection (Pine priceMins) - handles plateaus up to 4 equal lows
  const priceMins: boolean[] = new Array(n).fill(false);
  for (let i = 5; i < n; i++) {
    const lo = bars[i].low, lo1 = bars[i - 1].low, lo2 = bars[i - 2].low;
    const lo3 = bars[i - 3].low, lo4 = bars[i - 4].low, lo5 = bars[i - 5].low;
    // Pine: bullishPrice > bullishPrice[1] and bullishPrice[1] < bullishPrice[2]
    //   or plateau patterns with 2-4 equal lows followed by rise
    priceMins[i] =
      (lo > lo1 && lo1 < lo2) ||
      (lo1 === lo2 && lo1 < lo && lo1 < lo3) ||
      (lo1 === lo2 && lo1 === lo3 && lo1 < lo && lo1 < lo4) ||
      (lo1 === lo2 && lo1 === lo3 && lo1 === lo4 && lo1 < lo && lo1 < lo5);
  }

  // Price top detection (Pine priceMax) - handles plateaus
  const priceMaxs: boolean[] = new Array(n).fill(false);
  for (let i = 5; i < n; i++) {
    const hi = bars[i].high, hi1 = bars[i - 1].high, hi2 = bars[i - 2].high;
    const hi3 = bars[i - 3].high, hi4 = bars[i - 4].high, hi5 = bars[i - 5].high;
    priceMaxs[i] =
      (hi < hi1 && hi1 > hi2) ||
      (hi1 === hi2 && hi1 > hi && hi1 > hi3) ||
      (hi1 === hi2 && hi1 === hi3 && hi1 > hi && hi1 > hi4) ||
      (hi1 === hi2 && hi1 === hi3 && hi1 === hi4 && hi1 > hi && hi1 > hi5);
  }

  // Oscillator bottoms/tops
  const oscMins: boolean[] = new Array(n).fill(false);
  const oscMaxs: boolean[] = new Array(n).fill(false);
  for (let i = 2; i < n; i++) {
    const d0 = dArr[i], d1 = dArr[i - 1], d2 = dArr[i - 2];
    if (d0 == null || d1 == null || d2 == null || isNaN(d0) || isNaN(d1) || isNaN(d2)) continue;
    oscMins[i] = d0 > d1 && d1 < d2;
    oscMaxs[i] = d0 < d1 && d1 > d2;
  }

  // barssince helper: how many bars since condition was last true (exclusive of current)
  function barssince(cond: boolean[], atBar: number): number {
    for (let j = atBar - 1; j >= 0; j--) {
      if (cond[j]) return atBar - j;
    }
    return n; // never found
  }

  // valuewhen helper: value of series when condition was true, occurrence-th time back (0=most recent)
  function valuewhen(cond: boolean[], vals: number[], atBar: number, occurrence: number): number {
    let count = 0;
    for (let j = atBar; j >= 0; j--) {
      if (cond[j]) {
        if (count === occurrence) return vals[j];
        count++;
      }
    }
    return NaN;
  }

  // lowest/highest over lookback ending at bar i
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

  // Pre-compute d[i-1] series for valuewhen (Pine: d[1] at bar where condition fires)
  const dLag1: number[] = new Array(n);
  const lowLag1: number[] = new Array(n);
  const highLag1: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    dLag1[i] = i > 0 ? (dArr[i - 1] ?? NaN) : NaN;
    lowLag1[i] = i > 0 ? bars[i - 1].low : NaN;
    highLag1[i] = i > 0 ? bars[i - 1].high : NaN;
  }

  // Pre-compute low and high arrays for lowestN/highestN
  const lowArr: number[] = bars.map(b => b.low);
  const highArr: number[] = bars.map(b => b.high);

  // Compute delayedlow / delayedhigh per bar
  const delayedlow: number[] = new Array(n).fill(NaN);
  const delayedhigh: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (priceMins[i] && barssince(oscMins, i) < 3) {
      delayedlow[i] = bars[i - 1]?.low ?? NaN;
    }
    if (priceMaxs[i] && barssince(oscMaxs, i) < 3) {
      delayedhigh[i] = bars[i - 1]?.high ?? NaN;
    }
  }

  // Build per-bar filter / filter2 (Pine: running values depending on barssince)
  // filter = barssince(priceMins) < 5 ? lowest(currenttrough6, 4) : na
  // currenttrough6 = valuewhen(priceMins, low[1], 0)
  // We'll compute these inline in the main loop.

  // Output arrays
  const plot0: { time: number; value: number }[] = new Array(n); // d line
  const plot1: { time: number; value: number }[] = new Array(n); // Bottoms
  const plot2: { time: number; value: number }[] = new Array(n); // Tops
  const plot3: { time: number; value: number }[] = new Array(n); // Bearish Div
  const plot4: { time: number; value: number }[] = new Array(n); // Bullish Div

  for (let i = 0; i < n; i++) {
    const dv = dArr[i];
    plot0[i] = { time: bars[i].time, value: (i < warmup || dv == null || isNaN(dv)) ? NaN : dv };
    plot1[i] = { time: bars[i].time, value: NaN };
    plot2[i] = { time: bars[i].time, value: NaN };
    plot3[i] = { time: bars[i].time, value: NaN };
    plot4[i] = { time: bars[i].time, value: NaN };
  }

  const markers: MarkerData[] = [];

  // Pre-compute numeric d array for lowestN/highestN
  const dArrNum: number[] = dArr.map(v => v ?? NaN);

  // Main loop: compute all divergence signals
  for (let i = warmup; i < n; i++) {
    const d = dArr[i];
    if (d == null || isNaN(d)) continue;

    // Bottoms/Tops circles: plot at d[1] with offset=-1, so effectively at bar i-1
    if (oscMins[i] && i > 0) {
      const d1 = dArr[i - 1];
      if (d1 != null && !isNaN(d1)) {
        plot1[i - 1] = { time: bars[i - 1].time, value: d1 };
      }
    }
    if (oscMaxs[i] && i > 0) {
      const d1 = dArr[i - 1];
      if (d1 != null && !isNaN(d1)) {
        plot2[i - 1] = { time: bars[i - 1].time, value: d1 };
      }
    }

    // Compute valuewhen quantities needed for divergence checks
    // currenttrough4 = valuewhen(oscMins, d[1], 0) -- PPO value at most recent osc bottom
    // currenttrough5 = valuewhen(oscMax, d[1], 0) -- PPO value at most recent osc top
    // currenttrough6 = valuewhen(priceMins, low[1], 0)
    // currenttrough7 = valuewhen(priceMax, high[1], 0)
    const currenttrough4 = valuewhen(oscMins, dLag1, i, 0);
    const currenttrough5 = valuewhen(oscMaxs, dLag1, i, 0);
    const currenttrough6 = valuewhen(priceMins, lowLag1, i, 0);
    const currenttrough7 = valuewhen(priceMaxs, highLag1, i, 0);

    // y9 = valuewhen(oscMins, currenttrough6, 0)
    // For this we need currenttrough6 evaluated at each oscMins bar.
    // We'll compute it dynamically.
    // y10 = valuewhen(oscMax, currenttrough7, 0)
    // y2 = valuewhen(oscMax, filter2, 1)
    // y6 = valuewhen(oscMins, filter, 1)
    // y3 = valuewhen(oscMax, currenttrough5, 0)
    // y4 = valuewhen(oscMax, currenttrough5, 1)
    // y7 = valuewhen(oscMins, currenttrough4, 0)
    // y8 = valuewhen(oscMins, currenttrough4, 1)

    // Build per-bar currenttrough6/7 for valuewhen usage
    // These are already computed via valuewhen above, but for the nested valuewhen
    // (e.g., y9 = valuewhen(oscMins, currenttrough6@eachBar, 0))
    // we need the value of currenttrough6 at each oscMins bar.

    // Helper: compute currenttrough6 at a specific bar j
    const ct6AtBar = (j: number) => valuewhen(priceMins, lowLag1, j, 0);
    const ct7AtBar = (j: number) => valuewhen(priceMaxs, highLag1, j, 0);
    const ct4AtBar = (j: number) => valuewhen(oscMins, dLag1, j, 0);
    const ct5AtBar = (j: number) => valuewhen(oscMaxs, dLag1, j, 0);

    // y9 = valuewhen(oscMins, currenttrough6, 0) -- at the most recent oscMin, what was currenttrough6?
    let y9 = NaN, y10 = NaN;
    let y3 = NaN, y4 = NaN, y7 = NaN, y8 = NaN;
    let y6 = NaN, y2 = NaN;
    let y11 = NaN, y12 = NaN;

    // Find most recent and 2nd most recent oscMins/oscMaxs bars up to i
    {
      let oscMinCount = 0;
      for (let j = i; j >= 0 && oscMinCount < 2; j--) {
        if (oscMins[j]) {
          if (oscMinCount === 0) {
            y9 = ct6AtBar(j);
            y7 = ct4AtBar(j);
            y11 = valuewhen(oscMins, delayedlow, j, 0);
          } else {
            y8 = ct4AtBar(j);
            // y6 = valuewhen(oscMins, filter, 1)
            // filter at bar j = barssince(priceMins, j) < 5 ? lowest(ct6AtBar(j), 4) : NaN
            // "lowest(currenttrough6, 4)" means the lowest of the last 4 bars of currenttrough6
            // But currenttrough6 is a step function (changes only at priceMins events).
            // In Pine, lowest(currenttrough6, 4) at bar j takes the min of ct6 over last 4 bars.
            // Since ct6 only changes at priceMins, this effectively finds the lowest price bottom
            // among price bottoms within a 4+5 bar window. We'll approximate by taking ct6 at bar j
            // and checking if there's a lower one in recent bars.
            const bsp = barssince(priceMins, j);
            if (bsp < 5) {
              // lowest of ct6 over 4 bars ending at j
              let minCt6 = Infinity;
              for (let k = j; k >= Math.max(0, j - 3); k--) {
                const v = ct6AtBar(k);
                if (!isNaN(v) && v < minCt6) minCt6 = v;
              }
              y6 = minCt6 === Infinity ? NaN : minCt6;
            }
          }
          oscMinCount++;
        }
      }

      let oscMaxCount = 0;
      for (let j = i; j >= 0 && oscMaxCount < 2; j--) {
        if (oscMaxs[j]) {
          if (oscMaxCount === 0) {
            y10 = ct7AtBar(j);
            y3 = ct5AtBar(j);
            y12 = valuewhen(oscMaxs, delayedhigh, j, 0);
          } else {
            y4 = ct5AtBar(j);
            const bsp = barssince(priceMaxs, j);
            if (bsp < 5) {
              let maxCt7 = -Infinity;
              for (let k = j; k >= Math.max(0, j - 3); k--) {
                const v = ct7AtBar(k);
                if (!isNaN(v) && v > maxCt7) maxCt7 = v;
              }
              y2 = maxCt7 === -Infinity ? NaN : maxCt7;
            }
          }
          oscMaxCount++;
        }
      }
    }

    // Long-term divergence filters
    // long_term_bull_filt = valuewhen(priceMins, lowest(div_lookback_period), 1)
    // In Pine, lowest(N) without a source means lowest(low, N)
    const longTermBullFilt = (() => {
      let count = 0;
      for (let j = i; j >= 0; j--) {
        if (priceMins[j]) {
          if (count === 1) return lowestN(lowArr, j, divLookbackPeriod);
          count++;
        }
      }
      return NaN;
    })();

    const longTermBearFilt = (() => {
      let count = 0;
      for (let j = i; j >= 0; j--) {
        if (priceMaxs[j]) {
          if (count === 1) return highestN(highArr, j, divLookbackPeriod);
          count++;
        }
      }
      return NaN;
    })();

    // i_cond = currenttrough5 < highest(d, div_lookback_period) -- long term bearish osc div
    const iCond = currenttrough5 < highestN(dArrNum, i, divLookbackPeriod);
    // i2 = y10 > long_term_bear_filt
    const i2 = y10 > longTermBearFilt;
    // i3 = delayedhigh[i] > long_term_bear_filt (current bar delayed high)
    const i3 = delayedhigh[i] > longTermBearFilt;
    // i4 = currenttrough4 > lowest(d, div_lookback_period) -- long term bullish osc div
    const i4 = currenttrough4 > lowestN(dArrNum, i, divLookbackPeriod);
    // i5 = y9 < long_term_bull_filt
    const i5 = y9 < longTermBullFilt;
    // i6 = delayedlow[i] < long_term_bull_filt
    const i6 = delayedlow[i] < longTermBullFilt;

    // Bearish divergences (orange circles at d)
    const bearishdiv1 = !isNaN(y10) && !isNaN(y2) && y10 > y2 && oscMaxs[i] && y3 < y4;
    const bearishdiv2 = !isNaN(delayedhigh[i]) && !isNaN(y2) && delayedhigh[i] > y2 && y3 < y4;
    const bearishdiv3 = longTermDiv && oscMaxs[i] && iCond && i2;
    const bearishdiv4 = longTermDiv && iCond && i3;
    const bearish = bearishdiv1 || bearishdiv2 || bearishdiv3 || bearishdiv4;

    // Bullish divergences (purple circles at d)
    const bullishdiv1 = !isNaN(y9) && !isNaN(y6) && y9 < y6 && oscMins[i] && y7 > y8;
    const bullishdiv2 = !isNaN(delayedlow[i]) && !isNaN(y6) && delayedlow[i] < y6 && y7 > y8;
    const bullishdiv3 = longTermDiv && oscMins[i] && i4 && i5;
    const bullishdiv4 = longTermDiv && i4 && i6;
    const bullish = bullishdiv1 || bullishdiv2 || bullishdiv3 || bullishdiv4;

    if (bearish) {
      plot3[i] = { time: bars[i].time, value: d };
    }
    if (bullish) {
      plot4[i] = { time: bars[i].time, value: d };
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4 },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
    markers,
  };
}

export const PPOAlerts = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
