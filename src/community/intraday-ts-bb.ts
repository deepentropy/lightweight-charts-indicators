/**
 * Intraday TS, BB + Buy/Sell + Squeeze Mom + ADX-DMI
 *
 * Full overlay: Bollinger Bands with entry/SL/TP levels, buy/sell arrows,
 * squeeze momentum on midBB, DMI directional shapes, and bar coloring.
 *
 * Reference: TradingView "Intraday TS ,BB + Buy/Sell +Squeeze Mom.+ adx-dmi" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface IntradayTSBBInputs {
  bbLen: number;
  bbStdev: number;
  tp: number;
  sqzBBLen: number;
  sqzBBMult: number;
  sqzKCLen: number;
  sqzKCMult: number;
  useTrueRange: boolean;
  diLen: number;
  adxSmooth: number;
  adxThresh: number;
}

export const defaultInputs: IntradayTSBBInputs = {
  bbLen: 46,
  bbStdev: 0.35,
  tp: 0.0,
  sqzBBLen: 20,
  sqzBBMult: 2.0,
  sqzKCLen: 20,
  sqzKCMult: 1.5,
  useTrueRange: true,
  diLen: 14,
  adxSmooth: 14,
  adxThresh: 29,
};

export const inputConfig: InputConfig[] = [
  { id: 'bbLen', type: 'int', title: 'Bollinger Bars Length', defval: 46, min: 1 },
  { id: 'bbStdev', type: 'float', title: 'Bollinger Bars Standard Deviation', defval: 0.35, min: 0.1, step: 0.05 },
  { id: 'tp', type: 'float', title: 'Take Profit %', defval: 0.0, step: 0.1 },
  { id: 'sqzBBLen', type: 'int', title: 'Squeeze BB Length', defval: 20, min: 1 },
  { id: 'sqzBBMult', type: 'float', title: 'Squeeze BB MultFactor', defval: 2.0, step: 0.1 },
  { id: 'sqzKCLen', type: 'int', title: 'Squeeze KC Length', defval: 20, min: 1 },
  { id: 'sqzKCMult', type: 'float', title: 'Squeeze KC MultFactor', defval: 1.5, step: 0.1 },
  { id: 'diLen', type: 'int', title: 'DI Length', defval: 14, min: 1 },
  { id: 'adxSmooth', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1 },
  { id: 'adxThresh', type: 'int', title: 'ADX Threshold', defval: 29, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'upperBB', title: 'BB Upper Band', color: '#00FFFF', lineWidth: 2 },
  { id: 'lowerBB', title: 'BB Lower Band', color: '#00FFFF', lineWidth: 2 },
  { id: 'buyEntry', title: 'Buy Entry', color: 'rgba(0,0,255,0.2)', lineWidth: 2 },
  { id: 'sellEntry', title: 'Short Entry', color: 'rgba(255,0,0,0.2)', lineWidth: 2 },
  { id: 'slBuy', title: 'Buy Stop', color: '#800000', lineWidth: 2, style: 'circles' },
  { id: 'slSell', title: 'Short Stop', color: '#800000', lineWidth: 2, style: 'circles' },
  { id: 'tpBuy', title: 'Buy TP 1:1', color: '#FF00FF', lineWidth: 2, style: 'circles' },
  { id: 'tpSell', title: 'Short TP 1:1', color: '#FF00FF', lineWidth: 2, style: 'circles' },
  { id: 'tp2Buy', title: 'Buy TP2 1:2', color: '#FF00FF', lineWidth: 2, style: 'circles' },
  { id: 'tp2Sell', title: 'Short TP2 1:2', color: '#FF00FF', lineWidth: 2, style: 'circles' },
  { id: 'sqzMom', title: 'Squeeze Momentum', color: '#00FF00', lineWidth: 3 },
  { id: 'sqzState', title: 'Squeeze State', color: '#808080', lineWidth: 2, style: 'cross' },
];

export const metadata = {
  title: 'Intraday TS BB',
  shortTitle: 'ITSBB',
  overlay: true,
};

function stdev(arr: number[], len: number): number[] {
  const n = arr.length;
  const out: number[] = new Array(n).fill(NaN);
  for (let i = len - 1; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < len; j++) sum += arr[i - j];
    const mean = sum / len;
    let sumSq = 0;
    for (let j = 0; j < len; j++) sumSq += (arr[i - j] - mean) ** 2;
    out[i] = Math.sqrt(sumSq / len);
  }
  return out;
}

function sma(arr: number[], len: number): number[] {
  const n = arr.length;
  const out: number[] = new Array(n).fill(NaN);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += arr[i];
    if (i >= len) sum -= arr[i - len];
    if (i >= len - 1) out[i] = sum / len;
  }
  return out;
}

function rma(arr: number[], len: number): number[] {
  const out: number[] = new Array(arr.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < len && i < arr.length; i++) sum += arr[i];
  if (len <= arr.length) out[len - 1] = sum / len;
  const alpha = 1 / len;
  for (let i = len; i < arr.length; i++) {
    out[i] = alpha * arr[i] + (1 - alpha) * out[i - 1];
  }
  return out;
}

function linreg(arr: number[], len: number, offset: number): number[] {
  const n = arr.length;
  const out: number[] = new Array(n).fill(NaN);
  for (let i = len - 1 + offset; i < n; i++) {
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < len; j++) {
      const x = j;
      const y = arr[i - offset - (len - 1 - j)];
      if (isNaN(y)) { sumX = NaN; break; }
      sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
    }
    if (isNaN(sumX)) continue;
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / len;
    out[i] = intercept + slope * (len - 1);
  }
  return out;
}

export function calculate(bars: Bar[], inputs: Partial<IntradayTSBBInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { bbLen, bbStdev, tp, sqzBBLen, sqzBBMult, sqzKCLen, sqzKCMult, useTrueRange, diLen, adxSmooth, adxThresh } = cfg;
  const n = bars.length;

  const closeArr = bars.map(b => b.close);
  const highArr = bars.map(b => b.high);
  const lowArr = bars.map(b => b.low);

  // === BB (main overlay) ===
  const basisArr = sma(closeArr, bbLen);
  const stdevArr = stdev(closeArr, bbLen);
  const upperArr: number[] = new Array(n).fill(NaN);
  const lowerArr: number[] = new Array(n).fill(NaN);
  const midArr: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(basisArr[i]) && !isNaN(stdevArr[i])) {
      upperArr[i] = basisArr[i] + bbStdev * stdevArr[i];
      lowerArr[i] = basisArr[i] - bbStdev * stdevArr[i];
      midArr[i] = (upperArr[i] + lowerArr[i]) / 2;
    }
  }

  // === isOverBBTop / isUnderBBBottom ===
  const isOverBBTop: boolean[] = new Array(n).fill(false);
  const isUnderBBBottom: boolean[] = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (!isNaN(upperArr[i])) isOverBBTop[i] = bars[i].low > upperArr[i];
    if (!isNaN(lowerArr[i])) isUnderBBBottom[i] = bars[i].high < lowerArr[i];
  }

  // === State transitions ===
  const newIsOverBBTop: boolean[] = new Array(n).fill(false);
  const newIsUnderBBBottom: boolean[] = new Array(n).fill(false);
  for (let i = 1; i < n; i++) {
    newIsOverBBTop[i] = isOverBBTop[i] !== isOverBBTop[i - 1];
    newIsUnderBBBottom[i] = isUnderBBBottom[i] !== isUnderBBBottom[i - 1];
  }

  // === valuewhen logic ===
  // high_range = valuewhen(newIsOverBBTop, high, 0)
  // low_range = valuewhen(newIsUnderBBBottom, low, 0)
  // bblow = valuewhen(newIsOverBBTop, (lowerBB/0.00005)*0.00005, 0)
  // bbhigh = valuewhen(newIsUnderBBBottom, ((upperBB*1000)/5+5)*5/1000, 0)
  const highRange: number[] = new Array(n).fill(NaN);
  const lowRange: number[] = new Array(n).fill(NaN);
  const bblow: number[] = new Array(n).fill(NaN);
  const bbhigh: number[] = new Array(n).fill(NaN);
  let lastHighRange = NaN;
  let lastLowRange = NaN;
  let lastBblow = NaN;
  let lastBbhigh = NaN;
  for (let i = 0; i < n; i++) {
    if (newIsOverBBTop[i]) {
      lastHighRange = bars[i].high;
      lastBblow = Math.floor(lowerArr[i] / 0.00005) * 0.00005;
    }
    if (newIsUnderBBBottom[i]) {
      lastLowRange = bars[i].low;
      lastBbhigh = (Math.floor((upperArr[i] * 1000) / 5) + 5) * 5 / 1000;
    }
    highRange[i] = lastHighRange;
    lowRange[i] = lastLowRange;
    bblow[i] = lastBblow;
    bbhigh[i] = lastBbhigh;
  }

  // === Entry / SL / TP levels ===
  const buyEntry: number[] = new Array(n).fill(NaN);
  const sellEntry: number[] = new Array(n).fill(NaN);
  const slBuy: number[] = new Array(n).fill(NaN);
  const slSell: number[] = new Array(n).fill(NaN);
  const tpBuy: number[] = new Array(n).fill(NaN);
  const tpSell: number[] = new Array(n).fill(NaN);
  const tp2Buy: number[] = new Array(n).fill(NaN);
  const tp2Sell: number[] = new Array(n).fill(NaN);
  for (let i = 1; i < n; i++) {
    if (isOverBBTop[i] && highRange[i] === highRange[i - 1] && !isNaN(highRange[i])) {
      const entry = highRange[i] + 0.001;
      buyEntry[i] = entry;
      slBuy[i] = bblow[i];
      const tp1 = (entry + entry - bblow[i]) + (entry + entry - bblow[i]) * tp / 500;
      tpBuy[i] = tp1;
      const tp2 = entry + 2 * (entry - bblow[i]) + (entry + 2 * (entry - bblow[i])) * tp / 500;
      tp2Buy[i] = tp2;
    }
    if (isUnderBBBottom[i] && lowRange[i] === lowRange[i - 1] && !isNaN(lowRange[i])) {
      const entry = lowRange[i] - 0.001;
      sellEntry[i] = entry;
      slSell[i] = bbhigh[i];
      const tp1 = (entry - (bbhigh[i] - entry)) - (entry - (bbhigh[i] - entry)) * tp / 500;
      tpSell[i] = tp1;
      const tp2 = entry - 2 * (bbhigh[i] - entry) - (entry - 2 * (bbhigh[i] - entry)) * tp / 500;
      tp2Sell[i] = tp2;
    }
  }

  // === Squeeze Momentum ===
  const sqzBasis = sma(closeArr, sqzBBLen);
  const sqzDev = stdev(closeArr, sqzBBLen);
  const sqzUpperBB: number[] = new Array(n).fill(NaN);
  const sqzLowerBB: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(sqzBasis[i]) && !isNaN(sqzDev[i])) {
      sqzUpperBB[i] = sqzBasis[i] + sqzBBMult * sqzDev[i];
      sqzLowerBB[i] = sqzBasis[i] - sqzBBMult * sqzDev[i];
    }
  }

  // KC
  const sqzMA = sma(closeArr, sqzKCLen);
  const trArr: number[] = new Array(n).fill(0);
  trArr[0] = highArr[0] - lowArr[0];
  for (let i = 1; i < n; i++) {
    if (useTrueRange) {
      trArr[i] = Math.max(highArr[i] - lowArr[i], Math.abs(highArr[i] - closeArr[i - 1]), Math.abs(lowArr[i] - closeArr[i - 1]));
    } else {
      trArr[i] = highArr[i] - lowArr[i];
    }
  }
  const rangema = sma(trArr, sqzKCLen);
  const sqzUpperKC: number[] = new Array(n).fill(NaN);
  const sqzLowerKC: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(sqzMA[i]) && !isNaN(rangema[i])) {
      sqzUpperKC[i] = sqzMA[i] + rangema[i] * sqzKCMult;
      sqzLowerKC[i] = sqzMA[i] - rangema[i] * sqzKCMult;
    }
  }

  // Squeeze states
  const sqzOn: boolean[] = new Array(n).fill(false);
  const sqzOff: boolean[] = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (!isNaN(sqzLowerBB[i]) && !isNaN(sqzLowerKC[i])) {
      sqzOn[i] = sqzLowerBB[i] > sqzLowerKC[i] && sqzUpperBB[i] < sqzUpperKC[i];
      sqzOff[i] = sqzLowerBB[i] < sqzLowerKC[i] && sqzUpperBB[i] > sqzUpperKC[i];
    }
  }

  // Squeeze momentum value = linreg(source - avg(avg(highest(high,KC), lowest(low,KC)), sma(close,KC)), KC, 0)
  const highestKC: number[] = new Array(n).fill(NaN);
  const lowestKC: number[] = new Array(n).fill(NaN);
  for (let i = sqzKCLen - 1; i < n; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = 0; j < sqzKCLen; j++) {
      hh = Math.max(hh, highArr[i - j]);
      ll = Math.min(ll, lowArr[i - j]);
    }
    highestKC[i] = hh;
    lowestKC[i] = ll;
  }
  const smaKC = sma(closeArr, sqzKCLen);
  const sqzSrc: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(highestKC[i]) && !isNaN(lowestKC[i]) && !isNaN(smaKC[i])) {
      const avgHL = (highestKC[i] + lowestKC[i]) / 2;
      const avgAll = (avgHL + smaKC[i]) / 2;
      sqzSrc[i] = closeArr[i] - avgAll;
    }
  }
  const sqzVal = linreg(sqzSrc, sqzKCLen, 0);

  // === DMI / ADX ===
  const dmiTR: number[] = new Array(n).fill(0);
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = bars[i - 1].close;
    dmiTR[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const up = h - bars[i - 1].high;
    const dn = bars[i - 1].low - l;
    plusDM[i] = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
  }
  const trRma = rma(dmiTR, diLen);
  const plusRma = rma(plusDM, diLen);
  const minusRma = rma(minusDM, diLen);
  const plusDI: number[] = new Array(n).fill(NaN);
  const minusDI: number[] = new Array(n).fill(NaN);
  const dx: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (!isNaN(trRma[i]) && trRma[i] !== 0) {
      plusDI[i] = 100 * plusRma[i] / trRma[i];
      minusDI[i] = 100 * minusRma[i] / trRma[i];
      const s = plusDI[i] + minusDI[i];
      dx[i] = s === 0 ? 0 : 100 * Math.abs(plusDI[i] - minusDI[i]) / s;
    }
  }
  const adxRma = rma(dx, adxSmooth);
  const adxArr: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(adxRma[i])) adxArr[i] = adxRma[i];
  }

  // === Build plots ===
  const warmup = Math.max(bbLen, sqzKCLen + sqzKCLen, diLen + adxSmooth);

  const mkPlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < warmup || isNaN(v) ? NaN : v }));

  // BB upper/lower with conditional color
  const upperBBPlot = upperArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v, color: isOverBBTop[i] ? '#00FF00' : '#00FFFF' };
  });
  const lowerBBPlot = lowerArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v, color: isUnderBBBottom[i] ? '#00FF00' : '#00FFFF' };
  });

  // Buy/Sell entry (blue/red with transp=80 => 20% opacity)
  const buyEntryPlot = mkPlot(buyEntry);
  const sellEntryPlot = mkPlot(sellEntry);

  // Stop loss (maroon circles)
  const slBuyPlot = mkPlot(slBuy);
  const slSellPlot = mkPlot(slSell);

  // TP plots with dynamic color: lime when target hit, fuchsia otherwise
  const tpBuyPlot = tpBuy.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = closeArr[i] >= v ? '#00FF00' : '#FF00FF';
    return { time: bars[i].time, value: v, color };
  });
  const tpSellPlot = tpSell.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = closeArr[i] <= v ? '#00FF00' : '#FF00FF';
    return { time: bars[i].time, value: v, color };
  });
  const tp2BuyPlot = tp2Buy.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = closeArr[i] >= v ? '#00FF00' : '#FF00FF';
    return { time: bars[i].time, value: v, color };
  });
  const tp2SellPlot = tp2Sell.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = closeArr[i] <= v ? '#00FF00' : '#FF00FF';
    return { time: bars[i].time, value: v, color };
  });

  // Squeeze momentum plotted at midBB, color = bcolor (momentum direction)
  // bcolor: val > 0 ? (val > val[1] ? lime : green) : (val < val[1] ? red : maroon)
  const sqzMomPlot = midArr.map((v, i) => {
    if (i < warmup || isNaN(v) || isNaN(sqzVal[i])) return { time: bars[i].time, value: NaN };
    const val = sqzVal[i];
    const prevVal = i > 0 ? sqzVal[i - 1] : 0;
    let color: string;
    if (val > 0) {
      color = val > prevVal ? '#00FF00' : '#008000'; // lime : green
    } else {
      color = val < prevVal ? '#FF0000' : '#800000'; // red : maroon
    }
    return { time: bars[i].time, value: v, color };
  });

  // Squeeze state dots plotted at midBB, color = scolor
  // noSqz ? blue : sqzOn ? black : gray
  const sqzStatePlot = midArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const noSqz = !sqzOn[i] && !sqzOff[i];
    let color: string;
    if (noSqz) color = '#0000FF'; // blue
    else if (sqzOn[i]) color = '#000000'; // black
    else color = '#808080'; // gray
    return { time: bars[i].time, value: v, color };
  });

  // === Markers ===
  const markers: MarkerData[] = [];

  // plotarrow: codiff (buy arrows when compra==1) and codiff2 (sell arrows when vendi==1)
  // compra = isOverBBTop ? (highRange == highRange[1] ? highRange+0.001 : 1) : 0
  // codiff = compra == 1 ? compra : 0  => arrow when compra exactly equals 1 (state just started)
  // vendi = isUnderBBBottom ? (lowRange == lowRange[1] ? lowRange-0.001 : 1) : 0
  // codiff2 = vendi == 1 ? vendi : 0
  for (let i = warmup; i < n; i++) {
    let compra = 0;
    if (isOverBBTop[i]) {
      compra = (i > 0 && highRange[i] === highRange[i - 1] && !isNaN(highRange[i])) ? highRange[i] + 0.001 : 1;
    }
    if (compra === 1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#008000', text: '' });
    }

    let vendi = 0;
    if (isUnderBBBottom[i]) {
      vendi = (i > 0 && lowRange[i] === lowRange[i - 1] && !isNaN(lowRange[i])) ? lowRange[i] - 0.001 : 1;
    }
    if (vendi === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FFA500', text: '' });
    }

    // DMI plotshape
    if (!isNaN(plusDI[i]) && !isNaN(minusDI[i]) && !isNaN(adxArr[i])) {
      if (plusDI[i] >= minusDI[i] && adxArr[i] >= adxThresh) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleUp', color: '#008000', text: '' });
      }
      if (minusDI[i] >= plusDI[i] && adxArr[i] >= adxThresh) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleDown', color: '#800000', text: '' });
      }
      if (adxArr[i] <= 20) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: '#FF0000', text: '' });
      }
    }
  }

  // === Bar colors ===
  // Priority order (last applied wins in Pine):
  // 1. aqua: high >= lowerBB and low <= upperBB (inside bands)
  // 2. orange: between sell_limit_entry and take_profit_sell, or between buy_limit_entry and take_profit_buy
  // 3. fuchsia: hit take_profit_buy or take_profit_sell
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    let color: string | null = null;
    // aqua: bar touches both bands
    if (!isNaN(upperArr[i]) && !isNaN(lowerArr[i]) && bars[i].high >= lowerArr[i] && bars[i].low <= upperArr[i]) {
      color = '#00FFFF';
    }
    // orange: between short entry and sell TP
    if (!isNaN(sellEntry[i]) && !isNaN(tpSell[i]) && bars[i].high < sellEntry[i] && bars[i].low > tpSell[i]) {
      color = '#FFA500';
    }
    // orange: between buy entry and buy TP
    if (!isNaN(buyEntry[i]) && !isNaN(tpBuy[i]) && bars[i].low > buyEntry[i] && bars[i].high < tpBuy[i]) {
      color = '#FFA500';
    }
    // fuchsia: hit buy TP or sell TP
    if (!isNaN(buyEntry[i]) && bars[i].high >= tpBuy[i]) {
      color = '#FF00FF';
    } else if (!isNaN(sellEntry[i]) && bars[i].low <= tpSell[i]) {
      color = '#FF00FF';
    }
    if (color) barColors.push({ time: bars[i].time, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      upperBB: upperBBPlot,
      lowerBB: lowerBBPlot,
      buyEntry: buyEntryPlot,
      sellEntry: sellEntryPlot,
      slBuy: slBuyPlot,
      slSell: slSellPlot,
      tpBuy: tpBuyPlot,
      tpSell: tpSellPlot,
      tp2Buy: tp2BuyPlot,
      tp2Sell: tp2SellPlot,
      sqzMom: sqzMomPlot,
      sqzState: sqzStatePlot,
    },
    fills: [
      { plot1: 'upperBB', plot2: 'lowerBB', options: { color: 'rgba(0, 255, 255, 0.13)' } },
    ],
    markers,
    barColors,
  };
}

export const IntradayTSBB = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
