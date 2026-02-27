/**
 * Pekipek's PPO Divergence BETA
 *
 * Percentage Price Oscillator smoothed with SMA, plus pivot-based divergence
 * detection including long-term divergences.
 *
 * PPO = ((EMA_fast - EMA_slow) / EMA_slow) * 100, then d = SMA(PPO, smoother).
 *
 * Display elements from Pine source:
 *  - plot(d)                      white line
 *  - plot(bulldiv) "Tops"         aqua circles at PPO bottoms (offset -1)
 *  - plot(beardiv) "Bottoms"      red circles at PPO tops (offset -1)
 *  - Bearish Divergence           orange circles
 *  - Bullish Divergence           purple circles
 *
 * Reference: TradingView "Pekipek's PPO Divergence BETA" by Pekipek
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PPODivergenceInputs {
  fastLength: number;
  slowLength: number;
  smoother: number;
  divLookbackPeriod: number;
  longTermDiv: boolean;
  src: SourceType;
}

export const defaultInputs: PPODivergenceInputs = {
  fastLength: 12,
  slowLength: 26,
  smoother: 2,
  divLookbackPeriod: 55,
  longTermDiv: true,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'smoother', type: 'int', title: 'Smoother', defval: 2, min: 1 },
  { id: 'divLookbackPeriod', type: 'int', title: 'Lookback Period', defval: 55, min: 1 },
  { id: 'longTermDiv', type: 'bool', title: 'Use Long Term Divergences?', defval: true },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PPO', color: '#FFFFFF', lineWidth: 2 },
  { id: 'plot1', title: 'Tops', color: '#00FFFF', lineWidth: 4, style: 'circles' },
  { id: 'plot2', title: 'Bottoms', color: '#FF0000', lineWidth: 4, style: 'circles' },
  { id: 'plot3', title: 'Bearish Divergence', color: '#FF8C00', lineWidth: 4, style: 'circles' },
  { id: 'plot4', title: 'Bullish Divergence', color: '#800080', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'PPO Divergence',
  shortTitle: 'PPODiv',
  overlay: false,
};

// --- Pine-equivalent helpers ---

/** Bars since condArr was last true before atIdx. NaN if never. */
function barssince(condArr: boolean[], atIdx: number): number {
  for (let k = atIdx - 1; k >= 0; k--) {
    if (condArr[k]) return atIdx - k;
  }
  return NaN;
}

/** Value of valArr when condArr was true, occurrence-th time back (0 = most recent, 1 = previous). */
function valuewhen(condArr: boolean[], valArr: number[], atIdx: number, occurrence: number): number {
  let count = 0;
  for (let k = atIdx; k >= 0; k--) {
    if (condArr[k]) {
      if (count === occurrence) return valArr[k];
      count++;
    }
  }
  return NaN;
}

/** Lowest value in arr over last len bars ending at idx. */
function lowestN(arr: number[], idx: number, len: number): number {
  let min = Infinity;
  for (let k = Math.max(0, idx - len + 1); k <= idx; k++) {
    if (!isNaN(arr[k]) && arr[k] < min) min = arr[k];
  }
  return min === Infinity ? NaN : min;
}

/** Highest value in arr over last len bars ending at idx. */
function highestN(arr: number[], idx: number, len: number): number {
  let max = -Infinity;
  for (let k = Math.max(0, idx - len + 1); k <= idx; k++) {
    if (!isNaN(arr[k]) && arr[k] > max) max = arr[k];
  }
  return max === -Infinity ? NaN : max;
}

export function calculate(bars: Bar[], inputs: Partial<PPODivergenceInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { fastLength, slowLength, smoother, divLookbackPeriod, longTermDiv, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const source = getSourceSeries(bars, src);

  const emaFast = ta.ema(source, fastLength).toArray();
  const emaSlow = ta.ema(source, slowLength).toArray();

  // PPO = ((EMA_fast - EMA_slow) / EMA_slow) * 100
  const macd2Arr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const f = emaFast[i];
    const s = emaSlow[i];
    macd2Arr[i] = (f == null || s == null || s === 0) ? NaN : ((f - s) / s) * 100;
  }

  // d = SMA(PPO, smoother)
  const macd2Series = new Series(bars, (_b, i) => macd2Arr[i]);
  const dArr = ta.sma(macd2Series, smoother).toArray().map(v => v ?? NaN);

  const warmup = slowLength + smoother;

  const lowArr = bars.map(b => b.low);
  const highArr = bars.map(b => b.high);

  // --- Price bottoms/tops (Pine priceMins / priceMax) ---
  const priceMins: boolean[] = new Array(n).fill(false);
  for (let i = 2; i < n; i++) {
    const L = lowArr;
    if (L[i] > L[i - 1] && L[i - 1] < L[i - 2]) { priceMins[i] = true; continue; }
    if (i >= 3 && L[i - 1] === L[i - 2] && L[i - 1] < L[i] && L[i - 1] < L[i - 3]) { priceMins[i] = true; continue; }
    if (i >= 4 && L[i - 1] === L[i - 2] && L[i - 1] === L[i - 3] && L[i - 1] < L[i] && L[i - 1] < L[i - 4]) { priceMins[i] = true; continue; }
    if (i >= 5 && L[i - 1] === L[i - 2] && L[i - 1] === L[i - 3] && L[i - 1] === L[i - 4] && L[i - 1] < L[i] && L[i - 1] < L[i - 5]) { priceMins[i] = true; }
  }

  const priceMax: boolean[] = new Array(n).fill(false);
  for (let i = 2; i < n; i++) {
    const H = highArr;
    if (H[i] < H[i - 1] && H[i - 1] > H[i - 2]) { priceMax[i] = true; continue; }
    if (i >= 3 && H[i - 1] === H[i - 2] && H[i - 1] > H[i] && H[i - 1] > H[i - 3]) { priceMax[i] = true; continue; }
    if (i >= 4 && H[i - 1] === H[i - 2] && H[i - 1] === H[i - 3] && H[i - 1] > H[i] && H[i - 1] > H[i - 4]) { priceMax[i] = true; continue; }
    if (i >= 5 && H[i - 1] === H[i - 2] && H[i - 1] === H[i - 3] && H[i - 1] === H[i - 4] && H[i - 1] > H[i] && H[i - 1] > H[i - 5]) { priceMax[i] = true; }
  }

  // --- Oscillator bottoms/tops ---
  const oscMins: boolean[] = new Array(n).fill(false);
  const oscMax: boolean[] = new Array(n).fill(false);
  for (let i = 2; i < n; i++) {
    if (!isNaN(dArr[i]) && !isNaN(dArr[i - 1]) && !isNaN(dArr[i - 2])) {
      oscMins[i] = dArr[i] > dArr[i - 1] && dArr[i - 1] < dArr[i - 2];
      oscMax[i] = dArr[i] < dArr[i - 1] && dArr[i - 1] > dArr[i - 2];
    }
  }

  // --- Precompute shifted arrays ---
  const dShift1: number[] = new Array(n);    // d[1] in Pine = dArr[i-1]
  const lowShift1: number[] = new Array(n);  // low[1]
  const highShift1: number[] = new Array(n); // high[1]
  dShift1[0] = NaN; lowShift1[0] = NaN; highShift1[0] = NaN;
  for (let i = 1; i < n; i++) {
    dShift1[i] = dArr[i - 1];
    lowShift1[i] = lowArr[i - 1];
    highShift1[i] = highArr[i - 1];
  }

  // --- Precompute running Pine series as arrays ---
  // currenttrough4[i] = valuewhen(oscMins, d[1], 0) at bar i
  // currenttrough5[i] = valuewhen(oscMax, d[1], 0) at bar i
  // currenttrough6[i] = valuewhen(priceMins, low[1], 0) at bar i
  // currenttrough7[i] = valuewhen(priceMax, high[1], 0) at bar i
  const ct4: number[] = new Array(n).fill(NaN);
  const ct5: number[] = new Array(n).fill(NaN);
  const ct6: number[] = new Array(n).fill(NaN);
  const ct7: number[] = new Array(n).fill(NaN);
  let lastOscMinVal = NaN, lastOscMaxVal = NaN, lastPriceMinLow = NaN, lastPriceMaxHigh = NaN;
  for (let i = 0; i < n; i++) {
    if (oscMins[i]) lastOscMinVal = dShift1[i];
    if (oscMax[i]) lastOscMaxVal = dShift1[i];
    if (priceMins[i]) lastPriceMinLow = lowShift1[i];
    if (priceMax[i]) lastPriceMaxHigh = highShift1[i];
    ct4[i] = lastOscMinVal;
    ct5[i] = lastOscMaxVal;
    ct6[i] = lastPriceMinLow;
    ct7[i] = lastPriceMaxHigh;
  }

  // delayedlow[i] = priceMins[i] && barssince(oscMins) < 3 ? low[i-1] : NaN
  // delayedhigh[i] = priceMax[i] && barssince(oscMax) < 3 ? high[i-1] : NaN
  const delayedlow: number[] = new Array(n).fill(NaN);
  const delayedhigh: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (priceMins[i]) {
      const bs = barssince(oscMins, i);
      if (!isNaN(bs) && bs < 3) delayedlow[i] = lowShift1[i];
    }
    if (priceMax[i]) {
      const bs = barssince(oscMax, i);
      if (!isNaN(bs) && bs < 3) delayedhigh[i] = highShift1[i];
    }
  }

  // y11[i] = valuewhen(oscMins, delayedlow, 0) at bar i
  // y12[i] = valuewhen(oscMax, delayedhigh, 0) at bar i
  // (not directly plotted but used in delayed checks -- actually Pine directly checks
  //  delayedlow/delayedhigh in the plot conditions, so we already have those.)

  // filter[i] = barssince(priceMins)[i] < 5 ? lowest(ct6, 4)[i] : NaN
  // filter2[i] = barssince(priceMax)[i] < 5 ? highest(ct7, 4)[i] : NaN
  const filterArr: number[] = new Array(n).fill(NaN);
  const filter2Arr: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const bsPM = barssince(priceMins, i);
    if (priceMins[i] || (!isNaN(bsPM) && bsPM < 5)) {
      filterArr[i] = lowestN(ct6, i, 4);
    }
    const bsPX = barssince(priceMax, i);
    if (priceMax[i] || (!isNaN(bsPX) && bsPX < 5)) {
      filter2Arr[i] = highestN(ct7, i, 4);
    }
  }

  // Running highest/lowest over divLookbackPeriod for long-term div
  const runHighD: number[] = new Array(n).fill(NaN);
  const runLowD: number[] = new Array(n).fill(NaN);
  const runHighPrice: number[] = new Array(n).fill(NaN);
  const runLowPrice: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    runHighD[i] = highestN(dArr, i, divLookbackPeriod);
    runLowD[i] = lowestN(dArr, i, divLookbackPeriod);
    runHighPrice[i] = highestN(highArr, i, divLookbackPeriod);
    runLowPrice[i] = lowestN(lowArr, i, divLookbackPeriod);
  }

  // --- valuewhen lookups for divergence plots (precomputed as running series) ---
  // y2  = valuewhen(oscMax, filter2, 1) -- filter2 at second most recent oscMax
  // y3  = valuewhen(oscMax, ct5, 0) -- same as ct5 (most recent oscMax PPO val)
  // y4  = valuewhen(oscMax, ct5, 1) -- ct5 at second most recent oscMax = PPO at prev osc top
  // y6  = valuewhen(oscMins, filter, 1)
  // y7  = valuewhen(oscMins, ct4, 0) -- same as ct4
  // y8  = valuewhen(oscMins, ct4, 1) -- PPO at second most recent osc bottom
  // y9  = valuewhen(oscMins, ct6, 0) -- same as ct6
  // y10 = valuewhen(oscMax, ct7, 0) -- same as ct7

  // long_term_bear_filt = valuewhen(priceMax, highest(div_lookback_period), 1) = valuewhen(priceMax, runHighPrice, 1)
  // long_term_bull_filt = valuewhen(priceMins, lowest(div_lookback_period), 1) = valuewhen(priceMins, runLowPrice, 1)

  // --- Build plot arrays ---
  const plot0: { time: any; value: number }[] = new Array(n);
  const plot1: { time: any; value: number }[] = new Array(n); // Tops (aqua) = bulldiv
  const plot2: { time: any; value: number }[] = new Array(n); // Bottoms (red) = beardiv
  const plot3: { time: any; value: number }[] = new Array(n); // Bearish Div (orange)
  const plot4: { time: any; value: number }[] = new Array(n); // Bullish Div (purple)

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    plot0[i] = { time: t, value: (i < warmup || isNaN(dArr[i])) ? NaN : dArr[i] };
    plot1[i] = { time: t, value: NaN };
    plot2[i] = { time: t, value: NaN };
    plot3[i] = { time: t, value: NaN };
    plot4[i] = { time: t, value: NaN };
  }

  // Tops/Bottoms circles (offset=-1 means plotted at i-1)
  for (let i = 2; i < n; i++) {
    if (i < warmup) continue;
    if (oscMins[i]) {
      plot1[i - 1] = { time: bars[i - 1].time, value: dArr[i - 1] };
    }
    if (oscMax[i]) {
      plot2[i - 1] = { time: bars[i - 1].time, value: dArr[i - 1] };
    }
  }

  // --- Divergence circles ---
  for (let i = 2; i < n; i++) {
    if (i < warmup) continue;

    const y3 = ct5[i];  // PPO at most recent osc top
    const y4 = valuewhen(oscMax, dShift1, i, 1); // PPO at second most recent osc top
    const y7 = ct4[i];  // PPO at most recent osc bottom
    const y8 = valuewhen(oscMins, dShift1, i, 1); // PPO at second most recent osc bottom
    const y9 = ct6[i];  // price low at most recent price bottom
    const y10 = ct7[i]; // price high at most recent price top
    const y6 = valuewhen(oscMins, filterArr, i, 1); // filter at second most recent oscMins
    const y2 = valuewhen(oscMax, filter2Arr, i, 1); // filter2 at second most recent oscMax

    // Short-term bearish: y10 > y2 && oscMax && y3 < y4
    if (oscMax[i] && !isNaN(y10) && !isNaN(y2) && !isNaN(y3) && !isNaN(y4) && y10 > y2 && y3 < y4) {
      plot3[i] = { time: bars[i].time, value: dArr[i] };
    }

    // Short-term bullish: y9 < y6 && oscMins && y7 > y8
    if (oscMins[i] && !isNaN(y9) && !isNaN(y6) && !isNaN(y7) && !isNaN(y8) && y9 < y6 && y7 > y8) {
      plot4[i] = { time: bars[i].time, value: dArr[i] };
    }

    // Delayed bullish: delayedlow < y6 && y7 > y8
    if (!isNaN(delayedlow[i]) && !isNaN(y6) && !isNaN(y7) && !isNaN(y8) && delayedlow[i] < y6 && y7 > y8) {
      plot4[i] = { time: bars[i].time, value: dArr[i] };
    }

    // Delayed bearish: delayedhigh > y2 && y3 < y4
    if (!isNaN(delayedhigh[i]) && !isNaN(y2) && !isNaN(y3) && !isNaN(y4) && delayedhigh[i] > y2 && y3 < y4) {
      plot3[i] = { time: bars[i].time, value: dArr[i] };
    }

    // Long-term divergences
    if (longTermDiv) {
      // i_flag = ct5 < highest(d, divLookbackPeriod)
      const iFlag = ct5[i] < runHighD[i];
      // i4 = ct4 > lowest(d, divLookbackPeriod)
      const i4flag = ct4[i] > runLowD[i];
      // i2 = y10 > long_term_bear_filt
      const ltBearFilt = valuewhen(priceMax, runHighPrice, i, 1);
      // i5 = y9 < long_term_bull_filt
      const ltBullFilt = valuewhen(priceMins, runLowPrice, i, 1);

      // plot(longTermDiv and oscMax and iFlag and i2)
      if (oscMax[i] && iFlag && !isNaN(ltBearFilt) && y10 > ltBearFilt) {
        plot3[i] = { time: bars[i].time, value: dArr[i] };
      }

      // plot(longTermDiv and oscMins and i4 and i5)
      if (oscMins[i] && i4flag && !isNaN(ltBullFilt) && y9 < ltBullFilt) {
        plot4[i] = { time: bars[i].time, value: dArr[i] };
      }

      // plot(longTermDiv and iFlag and i3) -- i3 = delayedhigh > ltBearFilt
      if (iFlag && !isNaN(delayedhigh[i]) && !isNaN(ltBearFilt) && delayedhigh[i] > ltBearFilt) {
        plot3[i] = { time: bars[i].time, value: dArr[i] };
      }

      // plot(longTermDiv and i4 and i6) -- i6 = delayedlow < ltBullFilt
      if (i4flag && !isNaN(delayedlow[i]) && !isNaN(ltBullFilt) && delayedlow[i] < ltBullFilt) {
        plot4[i] = { time: bars[i].time, value: dArr[i] };
      }
    }
  }

  // Build markers from divergence circles for overlay convenience
  const markers: MarkerData[] = [];
  for (let i = 0; i < n; i++) {
    if (!isNaN(plot4[i].value)) {
      markers.push({ time: bars[i].time as number, position: 'belowBar', shape: 'labelUp', color: '#800080', text: 'Bull' });
    }
    if (!isNaN(plot3[i].value)) {
      markers.push({ time: bars[i].time as number, position: 'aboveBar', shape: 'labelDown', color: '#FF8C00', text: 'Bear' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': plot0,
      'plot1': plot1,
      'plot2': plot2,
      'plot3': plot3,
      'plot4': plot4,
    },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
    markers,
  };
}

export const PPODivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
