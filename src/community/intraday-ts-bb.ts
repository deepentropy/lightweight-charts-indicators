/**
 * Intraday TS, BB + Buy/Sell + Squeeze Mom + ADX-DMI
 *
 * Full overlay: Bollinger Bands with entry/SL/TP levels, buy/sell arrows,
 * squeeze momentum on midBB, DMI directional shapes, and bar coloring. The buy / sell arrows are the original's
 * plotarrow outputs (`arrows` of the result): an up arrow of value 1 on the first bar above the upper band, a down
 * arrow of value -1 on the first bar below the lower band (transparency 40 as the original).
 *
 * Reference: "Intraday TS ,BB + Buy/Sell +Squeeze Mom.+ adx-dmi" (community)
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type ArrowData } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; arrows: ArrowData[] };

/** The running state of the rma() helper: the sum of the first `len` values, then the last average */
interface RmaState { sum: number; prev: number }

interface ItsbbVars {
  /** Running sums of the sma() helper: BB basis, squeeze BB basis, squeeze KC basis, squeeze KC range */
  sumBB: number;
  sumSqzBB: number;
  sumKC: number;
  sumRange: number;
  trRma: RmaState;
  plusRma: RmaState;
  minusRma: RmaState;
  adxRma: RmaState;
  lastHighRange: number;
  lastLowRange: number;
  lastBblow: number;
  lastBbhigh: number;
}

interface ItsbbRun extends BarRunState<ItsbbVars> {
  isOverBBTop: boolean[];
  isUnderBBBottom: boolean[];
  highRange: number[];
  lowRange: number[];
  trArr: number[];
  sqzSrc: number[];
  sqzVal: number[];
  plots: Point[][];
  markers: MarkerData[];
  arrows: ArrowData[];
  barColors: BarColorData[];
}

/** One step of the stdev() helper over the closes of bars i - len + 1 .. i (NaN before) */
function stdevAt(bars: Bar[], i: number, len: number): number {
  if (i < len - 1) return NaN;
  let sum = 0;
  for (let j = 0; j < len; j++) sum += bars[i - j].close;
  const mean = sum / len;
  let sumSq = 0;
  for (let j = 0; j < len; j++) sumSq += (bars[i - j].close - mean) ** 2;
  return Math.sqrt(sumSq / len);
}

/** One step of the rma() helper on bar i with value x */
function rmaAt(st: RmaState, i: number, len: number, x: number): number {
  if (i < len) {
    st.sum += x;
    if (i === len - 1) {
      st.prev = st.sum / len;
      return st.prev;
    }
    return NaN;
  }
  const alpha = 1 / len;
  st.prev = alpha * x + (1 - alpha) * st.prev;
  return st.prev;
}

const PLOT_IDS = ['upperBB', 'lowerBB', 'buyEntry', 'sellEntry', 'slBuy', 'slSell', 'tpBuy', 'tpSell', 'tp2Buy', 'tp2Sell', 'sqzMom', 'sqzState'];

function study(inputs: Partial<IntradayTSBBInputs>): BarStudy<ItsbbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { bbLen, bbStdev, tp, sqzBBLen, sqzBBMult, sqzKCLen, sqzKCMult, useTrueRange, diLen, adxSmooth, adxThresh } = cfg;
  // === Build plots ===
  const warmup = Math.max(bbLen, sqzKCLen + sqzKCLen, diLen + adxSmooth);
  const arrowUp = String(color.new('#008000', 40));
  const arrowDown = String(color.new('#FFA500', 40));
  return {
    init() {
      const s: ItsbbRun = {
        isOverBBTop: [], isUnderBBBottom: [], highRange: [], lowRange: [], trArr: [], sqzSrc: [], sqzVal: [],
        plots: PLOT_IDS.map(() => []), markers: [], arrows: [], barColors: [],
        steps: [], lists: [], series: [],
        vars: {
          sumBB: 0, sumSqzBB: 0, sumKC: 0, sumRange: 0,
          trRma: { sum: 0, prev: NaN }, plusRma: { sum: 0, prev: NaN }, minusRma: { sum: 0, prev: NaN },
          adxRma: { sum: 0, prev: NaN },
          lastHighRange: NaN, lastLowRange: NaN, lastBblow: NaN, lastBbhigh: NaN,
        },
      };
      s.lists = [s.markers, s.arrows, s.barColors];
      s.series = [s.isOverBBTop, s.isUnderBBBottom, s.highRange, s.lowRange, s.trArr, s.sqzSrc, s.sqzVal, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const t = b.time;
      const close = b.close;
      // sma(arr, len) helper: sum += arr[i]; sum -= arr[i - len]; the mean from bar len - 1
      const sma = (sum: number, len: number) => (i >= len - 1 ? sum / len : NaN);

      // === BB (main overlay) ===
      v.sumBB += close;
      if (i >= bbLen) v.sumBB -= bars[i - bbLen].close;
      const basis = sma(v.sumBB, bbLen);
      const sd = stdevAt(bars, i, bbLen);
      let upper = NaN;
      let lower = NaN;
      let mid = NaN;
      if (!isNaN(basis) && !isNaN(sd)) {
        upper = basis + bbStdev * sd;
        lower = basis - bbStdev * sd;
        mid = (upper + lower) / 2;
      }

      // === isOverBBTop / isUnderBBBottom ===
      const isOver = !isNaN(upper) ? b.low > upper : false;
      const isUnder = !isNaN(lower) ? b.high < lower : false;
      s.isOverBBTop[i] = isOver;
      s.isUnderBBBottom[i] = isUnder;

      // === State transitions ===
      const newIsOverBBTop = i >= 1 && isOver !== s.isOverBBTop[i - 1];
      const newIsUnderBBBottom = i >= 1 && isUnder !== s.isUnderBBBottom[i - 1];

      // === valuewhen logic ===
      // high_range = valuewhen(newIsOverBBTop, high, 0)
      // low_range = valuewhen(newIsUnderBBBottom, low, 0)
      // bblow = valuewhen(newIsOverBBTop, (lowerBB/0.00005)*0.00005, 0)
      // bbhigh = valuewhen(newIsUnderBBBottom, ((upperBB*1000)/5+5)*5/1000, 0)
      if (newIsOverBBTop) {
        v.lastHighRange = b.high;
        v.lastBblow = Math.floor(lower / 0.00005) * 0.00005;
      }
      if (newIsUnderBBBottom) {
        v.lastLowRange = b.low;
        v.lastBbhigh = (Math.floor((upper * 1000) / 5) + 5) * 5 / 1000;
      }
      const highRange = v.lastHighRange;
      const lowRange = v.lastLowRange;
      const bblow = v.lastBblow;
      const bbhigh = v.lastBbhigh;
      s.highRange[i] = highRange;
      s.lowRange[i] = lowRange;

      // === Entry / SL / TP levels ===
      let buyEntry = NaN, sellEntry = NaN, slBuy = NaN, slSell = NaN, tpBuy = NaN, tpSell = NaN, tp2Buy = NaN, tp2Sell = NaN;
      if (i >= 1) {
        if (isOver && highRange === s.highRange[i - 1] && !isNaN(highRange)) {
          const entry = highRange + 0.001;
          buyEntry = entry;
          slBuy = bblow;
          tpBuy = (entry + entry - bblow) + (entry + entry - bblow) * tp / 500;
          tp2Buy = entry + 2 * (entry - bblow) + (entry + 2 * (entry - bblow)) * tp / 500;
        }
        if (isUnder && lowRange === s.lowRange[i - 1] && !isNaN(lowRange)) {
          const entry = lowRange - 0.001;
          sellEntry = entry;
          slSell = bbhigh;
          tpSell = (entry - (bbhigh - entry)) - (entry - (bbhigh - entry)) * tp / 500;
          tp2Sell = entry - 2 * (bbhigh - entry) - (entry - 2 * (bbhigh - entry)) * tp / 500;
        }
      }

      // === Squeeze Momentum ===
      v.sumSqzBB += close;
      if (i >= sqzBBLen) v.sumSqzBB -= bars[i - sqzBBLen].close;
      const sqzBasis = sma(v.sumSqzBB, sqzBBLen);
      const sqzDev = stdevAt(bars, i, sqzBBLen);
      let sqzUpperBB = NaN;
      let sqzLowerBB = NaN;
      if (!isNaN(sqzBasis) && !isNaN(sqzDev)) {
        sqzUpperBB = sqzBasis + sqzBBMult * sqzDev;
        sqzLowerBB = sqzBasis - sqzBBMult * sqzDev;
      }

      // KC
      v.sumKC += close;
      if (i >= sqzKCLen) v.sumKC -= bars[i - sqzKCLen].close;
      const sqzMA = sma(v.sumKC, sqzKCLen);
      let tr: number;
      if (i === 0) tr = b.high - b.low;
      else if (useTrueRange) {
        const pc = bars[i - 1].close;
        tr = Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc));
      } else {
        tr = b.high - b.low;
      }
      s.trArr[i] = tr;
      v.sumRange += tr;
      if (i >= sqzKCLen) v.sumRange -= s.trArr[i - sqzKCLen];
      const rangema = sma(v.sumRange, sqzKCLen);
      let sqzUpperKC = NaN;
      let sqzLowerKC = NaN;
      if (!isNaN(sqzMA) && !isNaN(rangema)) {
        sqzUpperKC = sqzMA + rangema * sqzKCMult;
        sqzLowerKC = sqzMA - rangema * sqzKCMult;
      }

      // Squeeze states
      let sqzOn = false;
      let sqzOff = false;
      if (!isNaN(sqzLowerBB) && !isNaN(sqzLowerKC)) {
        sqzOn = sqzLowerBB > sqzLowerKC && sqzUpperBB < sqzUpperKC;
        sqzOff = sqzLowerBB < sqzLowerKC && sqzUpperBB > sqzUpperKC;
      }

      // Squeeze momentum value = linreg(source - avg(avg(highest(high,KC), lowest(low,KC)), sma(close,KC)), KC, 0)
      let highestKC = NaN;
      let lowestKC = NaN;
      if (i >= sqzKCLen - 1) {
        let hh = -Infinity, ll = Infinity;
        for (let j = 0; j < sqzKCLen; j++) {
          hh = Math.max(hh, bars[i - j].high);
          ll = Math.min(ll, bars[i - j].low);
        }
        highestKC = hh;
        lowestKC = ll;
      }
      // smaKC = sma(close, sqzKCLen): the values of sqzMA
      const smaKC = sqzMA;
      let sqzSrc = NaN;
      if (!isNaN(highestKC) && !isNaN(lowestKC) && !isNaN(smaKC)) {
        const avgHL = (highestKC + lowestKC) / 2;
        const avgAll = (avgHL + smaKC) / 2;
        sqzSrc = close - avgAll;
      }
      s.sqzSrc[i] = sqzSrc;
      // linreg(sqzSrc, sqzKCLen, 0)
      let sqzVal = NaN;
      const len = sqzKCLen;
      if (i >= len - 1) {
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        for (let j = 0; j < len; j++) {
          const x = j;
          const y = s.sqzSrc[i - (len - 1 - j)];
          if (isNaN(y)) { sumX = NaN; break; }
          sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x;
        }
        if (!isNaN(sumX)) {
          const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
          const intercept = (sumY - slope * sumX) / len;
          sqzVal = intercept + slope * (len - 1);
        }
      }
      s.sqzVal[i] = sqzVal;

      // === DMI / ADX ===
      let dmiTR = 0;
      let plusDM = 0;
      let minusDM = 0;
      if (i >= 1) {
        const h = b.high;
        const l = b.low;
        const pc = bars[i - 1].close;
        dmiTR = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
        const up = h - bars[i - 1].high;
        const dn = bars[i - 1].low - l;
        plusDM = up > dn && up > 0 ? up : 0;
        minusDM = dn > up && dn > 0 ? dn : 0;
      }
      const trRma = rmaAt(v.trRma, i, diLen, dmiTR);
      const plusRma = rmaAt(v.plusRma, i, diLen, plusDM);
      const minusRma = rmaAt(v.minusRma, i, diLen, minusDM);
      let plusDI = NaN;
      let minusDI = NaN;
      let dx = 0;
      if (!isNaN(trRma) && trRma !== 0) {
        plusDI = 100 * plusRma / trRma;
        minusDI = 100 * minusRma / trRma;
        const sum = plusDI + minusDI;
        dx = sum === 0 ? 0 : 100 * Math.abs(plusDI - minusDI) / sum;
      }
      const adxRma = rmaAt(v.adxRma, i, adxSmooth, dx);
      const adx = !isNaN(adxRma) ? adxRma : NaN;

      const plots = s.plots;
      const early = i < warmup;
      const plain = (x: number): Point => ({ time: t, value: early || isNaN(x) ? NaN : x });
      // BB upper/lower with conditional color
      plots[0][i] = early || isNaN(upper) ? { time: t, value: NaN } : { time: t, value: upper, color: isOver ? '#00FF00' : '#00FFFF' };
      plots[1][i] = early || isNaN(lower) ? { time: t, value: NaN } : { time: t, value: lower, color: isUnder ? '#00FF00' : '#00FFFF' };
      // Buy/Sell entry (blue/red with transp=80 => 20% opacity)
      plots[2][i] = plain(buyEntry);
      plots[3][i] = plain(sellEntry);
      // Stop loss (maroon circles)
      plots[4][i] = plain(slBuy);
      plots[5][i] = plain(slSell);
      // TP plots with dynamic color: lime when target hit, fuchsia otherwise
      plots[6][i] = early || isNaN(tpBuy) ? { time: t, value: NaN } : { time: t, value: tpBuy, color: close >= tpBuy ? '#00FF00' : '#FF00FF' };
      plots[7][i] = early || isNaN(tpSell) ? { time: t, value: NaN } : { time: t, value: tpSell, color: close <= tpSell ? '#00FF00' : '#FF00FF' };
      plots[8][i] = early || isNaN(tp2Buy) ? { time: t, value: NaN } : { time: t, value: tp2Buy, color: close >= tp2Buy ? '#00FF00' : '#FF00FF' };
      plots[9][i] = early || isNaN(tp2Sell) ? { time: t, value: NaN } : { time: t, value: tp2Sell, color: close <= tp2Sell ? '#00FF00' : '#FF00FF' };

      // Squeeze momentum plotted at midBB, color = bcolor (momentum direction)
      // bcolor: val > 0 ? (val > val[1] ? lime : green) : (val < val[1] ? red : maroon)
      if (early || isNaN(mid) || isNaN(sqzVal)) plots[10][i] = { time: t, value: NaN };
      else {
        const prevVal = i > 0 ? s.sqzVal[i - 1] : 0;
        let c: string;
        if (sqzVal > 0) {
          c = sqzVal > prevVal ? '#00FF00' : '#008000'; // lime : green
        } else {
          c = sqzVal < prevVal ? '#FF0000' : '#800000'; // red : maroon
        }
        plots[10][i] = { time: t, value: mid, color: c };
      }

      // Squeeze state dots plotted at midBB, color = scolor
      // noSqz ? blue : sqzOn ? black : gray
      if (early || isNaN(mid)) plots[11][i] = { time: t, value: NaN };
      else {
        const noSqz = !sqzOn && !sqzOff;
        let c: string;
        if (noSqz) c = '#0000FF'; // blue
        else if (sqzOn) c = '#000000'; // black
        else c = '#808080'; // gray
        plots[11][i] = { time: t, value: mid, color: c };
      }

      if (early) return;
      // === Markers ===
      // plotarrow: codiff (buy arrows when compra==1) and codiff2 (sell arrows when vendi==1)
      // compra = isOverBBTop ? (highRange == highRange[1] ? highRange+0.001 : 1) : 0
      // codiff = compra == 1 ? compra : 0  => arrow when compra exactly equals 1 (state just started)
      // vendi = isUnderBBBottom ? (lowRange == lowRange[1] ? lowRange-0.001 : 1) : 0
      // codiff2 = vendi == 1 ? vendi : 0
      // plotarrow(codiff, colorup = green, transp = 40) / plotarrow(codiff2 * -1, colordown = orange, transp = 40)
      let compra = 0;
      if (isOver) {
        compra = (i > 0 && highRange === s.highRange[i - 1] && !isNaN(highRange)) ? highRange + 0.001 : 1;
      }
      if (compra === 1) {
        s.arrows.push({ time: t, id: 'arrow0', value: 1, color: arrowUp });
      }

      let vendi = 0;
      if (isUnder) {
        vendi = (i > 0 && lowRange === s.lowRange[i - 1] && !isNaN(lowRange)) ? lowRange - 0.001 : 1;
      }
      if (vendi === 1) {
        s.arrows.push({ time: t, id: 'arrow1', value: -1, color: arrowDown });
      }

      // DMI plotshape
      if (!isNaN(plusDI) && !isNaN(minusDI) && !isNaN(adx)) {
        if (plusDI >= minusDI && adx >= adxThresh) {
          s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleUp', color: '#008000', text: '' });
        }
        if (minusDI >= plusDI && adx >= adxThresh) {
          s.markers.push({ time: t, position: 'belowBar', shape: 'triangleDown', color: '#800000', text: '' });
        }
        if (adx <= 20) {
          s.markers.push({ time: t, position: 'aboveBar', shape: 'diamond', color: '#FF0000', text: '' });
        }
      }

      // === Bar colors ===
      // Priority order (last applied wins in Pine):
      // 1. aqua: high >= lowerBB and low <= upperBB (inside bands)
      // 2. orange: between sell_limit_entry and take_profit_sell, or between buy_limit_entry and take_profit_buy
      // 3. fuchsia: hit take_profit_buy or take_profit_sell
      let c: string | null = null;
      // aqua: bar touches both bands
      if (!isNaN(upper) && !isNaN(lower) && b.high >= lower && b.low <= upper) {
        c = '#00FFFF';
      }
      // orange: between short entry and sell TP
      if (!isNaN(sellEntry) && !isNaN(tpSell) && b.high < sellEntry && b.low > tpSell) {
        c = '#FFA500';
      }
      // orange: between buy entry and buy TP
      if (!isNaN(buyEntry) && !isNaN(tpBuy) && b.low > buyEntry && b.high < tpBuy) {
        c = '#FFA500';
      }
      // fuchsia: hit buy TP or sell TP
      if (!isNaN(buyEntry) && b.high >= tpBuy) {
        c = '#FF00FF';
      } else if (!isNaN(sellEntry) && b.low <= tpSell) {
        c = '#FF00FF';
      }
      if (c) s.barColors.push({ time: t, color: c });
    },
    copyVars: (v) => ({
      ...v, trRma: { ...v.trRma }, plusRma: { ...v.plusRma }, minusRma: { ...v.minusRma }, adxRma: { ...v.adxRma },
    }),
    result(s) {
      const plots: Record<string, Point[]> = {};
      PLOT_IDS.forEach((id, k) => { plots[id] = s.plots[k].slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          { plot1: 'upperBB', plot2: 'lowerBB', options: { color: 'rgba(0, 255, 255, 0.13)' } },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        arrows: s.arrows.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IntradayTSBBInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IntradayTSBBInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const IntradayTSBB = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
