/**
 * Big Snapper Alerts R3.0 by JustUncleL
 *
 * Multi-MA signal indicator with ColouredMA (HullMA default), Fast/Medium/Slow MAs,
 * SuperTrend filtering, Bollinger Band OutsideIn swing filter, and buy/sell markers.
 * Supports 11 MA types: SMA, EMA, WMA, VWMA, SMMA, DEMA, TEMA, HullMA, ZEMA, TMA, SSMA.
 *
 * Reference: TradingView "Big Snapper Alerts R3.0 by JustUncleL"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface BigSnapperAlertsInputs {
  typeColoured: string;
  lenColoured: number;
  typeFast: string;
  lenFast: number;
  typeMedium: string;
  lenMedium: number;
  typeSlow: string;
  lenSlow: number;
  filterOption: string;
  showMALines: boolean;
  showSuperTrend: boolean;
  sFactor: number;
  sPd: number;
  bbLength: number;
  bbStddev: number;
  oiLength: number;
}

export const defaultInputs: BigSnapperAlertsInputs = {
  typeColoured: 'HullMA',
  lenColoured: 18,
  typeFast: 'EMA',
  lenFast: 21,
  typeMedium: 'EMA',
  lenMedium: 55,
  typeSlow: 'EMA',
  lenSlow: 89,
  filterOption: 'SuperTrend',
  showMALines: true,
  showSuperTrend: false,
  sFactor: 3.618,
  sPd: 5,
  bbLength: 20,
  bbStddev: 2.0,
  oiLength: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'typeColoured', type: 'string', title: 'Coloured MA Type', defval: 'HullMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'TMA', 'SSMA'] },
  { id: 'lenColoured', type: 'int', title: 'Coloured MA Length', defval: 18, min: 1 },
  { id: 'typeFast', type: 'string', title: 'Fast MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'TMA', 'SSMA'] },
  { id: 'lenFast', type: 'int', title: 'Fast MA Length', defval: 21, min: 1 },
  { id: 'typeMedium', type: 'string', title: 'Medium MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'TMA', 'SSMA'] },
  { id: 'lenMedium', type: 'int', title: 'Medium MA Length', defval: 55, min: 1 },
  { id: 'typeSlow', type: 'string', title: 'Slow MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'TMA', 'SSMA'] },
  { id: 'lenSlow', type: 'int', title: 'Slow MA Length', defval: 89, min: 1 },
  { id: 'filterOption', type: 'string', title: 'Signal Filter', defval: 'SuperTrend', options: ['SuperTrend', '3xMATrend', 'SuperTrend+3xMA', 'MACross', 'MACross+ST', 'MACross+3xMA', 'OutsideIn:MACross', 'OutsideIn:MACross+ST', 'OutsideIn:MACross+3xMA', 'ColouredMA', 'No Alerts'] },
  { id: 'showMALines', type: 'bool', title: 'Show MA Lines', defval: true },
  { id: 'showSuperTrend', type: 'bool', title: 'Show SuperTrend', defval: false },
  { id: 'sFactor', type: 'float', title: 'SuperTrend Factor', defval: 3.618, min: 1, step: 0.1 },
  { id: 'sPd', type: 'int', title: 'SuperTrend Length', defval: 5, min: 1 },
  { id: 'bbLength', type: 'int', title: 'Bollinger Length', defval: 20, min: 2 },
  { id: 'bbStddev', type: 'float', title: 'Bollinger StdDevs', defval: 2.0, min: 0.5, step: 0.1 },
  { id: 'oiLength', type: 'int', title: 'OutsideIn LookBack', defval: 8, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'colouredMA', title: 'Coloured MA', color: '#1E90FF', lineWidth: 3 },
  { id: 'fastMA', title: 'Fast MA', color: '#00FF00', lineWidth: 2 },
  { id: 'mediumMA', title: 'Medium MA', color: '#FF0000', lineWidth: 2 },
  { id: 'slowMA', title: 'Slow MA', color: '#808080', lineWidth: 2 },
  { id: 'superTrend', title: 'SuperTrend', color: '#008000', lineWidth: 2 },
];

export const metadata = {
  title: 'Big Snapper Alerts R3.0',
  shortTitle: 'SNAPPER',
  overlay: true,
};

/**
 * Compute a moving average of the given type on raw source array.
 */
function variant(bars: Bar[], src: number[], len: number, type: string): number[] {
  const n = src.length;
  const srcSeries = new Series(bars, (_, i) => src[i]);

  switch (type) {
    case 'SMA':
      return ta.sma(srcSeries, len).toArray().map(v => v ?? NaN);
    case 'EMA':
      return ta.ema(srcSeries, len).toArray().map(v => v ?? NaN);
    case 'WMA':
      return ta.wma(srcSeries, len).toArray().map(v => v ?? NaN);
    case 'VWMA': {
      const volSeries = new Series(bars, b => b.volume ?? 0);
      return ta.vwma(srcSeries, len, volSeries).toArray().map(v => v ?? NaN);
    }
    case 'SMMA': {
      const smaArr = ta.sma(srcSeries, len).toArray();
      const result: number[] = new Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        if (isNaN(result[i - 1] ?? NaN)) {
          result[i] = smaArr[i] ?? NaN;
        } else {
          result[i] = (result[i - 1] * (len - 1) + src[i]) / len;
        }
      }
      return result;
    }
    case 'DEMA': {
      const e1 = ta.ema(srcSeries, len).toArray();
      const e1Series = new Series(bars, (_, i) => e1[i] ?? NaN);
      const e2 = ta.ema(e1Series, len).toArray();
      return e1.map((v, i) => 2 * (v ?? NaN) - (e2[i] ?? NaN));
    }
    case 'TEMA': {
      const e1 = ta.ema(srcSeries, len).toArray();
      const e1Series = new Series(bars, (_, i) => e1[i] ?? NaN);
      const e2 = ta.ema(e1Series, len).toArray();
      const e2Series = new Series(bars, (_, i) => e2[i] ?? NaN);
      const e3 = ta.ema(e2Series, len).toArray();
      return e1.map((v, i) => 3 * ((v ?? NaN) - (e2[i] ?? NaN)) + (e3[i] ?? NaN));
    }
    case 'HullMA': {
      const halfLen = Math.max(1, Math.floor(len / 2));
      const sqrtLen = Math.max(1, Math.round(Math.sqrt(len)));
      const wma1 = ta.wma(srcSeries, halfLen).toArray();
      const wma2 = ta.wma(srcSeries, len).toArray();
      const diff: number[] = wma1.map((v, i) => 2 * (v ?? NaN) - (wma2[i] ?? NaN));
      const diffSeries = new Series(bars, (_, i) => diff[i]);
      return ta.wma(diffSeries, sqrtLen).toArray().map(v => v ?? NaN);
    }
    case 'ZEMA': {
      // ZEMA: v1 = sma(src, len), e = ema(v1, len), zema = v1 + (v1 - e)
      const v1 = ta.sma(srcSeries, len).toArray().map(v => v ?? NaN);
      const v1Series = new Series(bars, (_, i) => v1[i]);
      const e = ta.ema(v1Series, len).toArray().map(v => v ?? NaN);
      return v1.map((v, i) => v + (v - e[i]));
    }
    case 'TMA': {
      const sma1 = ta.sma(srcSeries, len).toArray().map(v => v ?? NaN);
      const sma1Series = new Series(bars, (_, i) => sma1[i]);
      return ta.sma(sma1Series, len).toArray().map(v => v ?? NaN);
    }
    case 'SSMA': {
      // SuperSmoother filter (Ehlers)
      const pi = Math.PI;
      const a1 = Math.exp(-1.414 * pi / len);
      const b1 = 2 * a1 * Math.cos(1.414 * pi / len);
      const c2 = b1;
      const c3 = -(a1 * a1);
      const c1 = 1 - c2 - c3;
      const result: number[] = new Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        if (isNaN(src[i])) continue;
        if (i < 2 || isNaN(result[i - 1]) || isNaN(result[i - 2])) {
          result[i] = src[i];
        } else {
          result[i] = c1 * (src[i] + src[i - 1]) / 2 + c2 * result[i - 1] + c3 * result[i - 2];
        }
      }
      return result;
    }
    default:
      return ta.sma(srcSeries, len).toArray().map(v => v ?? NaN);
  }
}

export function calculate(bars: Bar[], inputs: Partial<BigSnapperAlertsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const closeArr = bars.map(b => b.close);

  // Compute MAs
  const maColoured = variant(bars, closeArr, cfg.lenColoured, cfg.typeColoured);
  const maFast = variant(bars, closeArr, cfg.lenFast, cfg.typeFast);
  const maMedium = variant(bars, closeArr, cfg.lenMedium, cfg.typeMedium);
  const maSlow = variant(bars, closeArr, cfg.lenSlow, cfg.typeSlow);

  // Coloured MA direction: rising(2) = 1, falling(2) = -1, else prev
  const clrDirection: number[] = new Array(n).fill(1);
  for (let i = 2; i < n; i++) {
    if (maColoured[i] > maColoured[i - 2]) {
      clrDirection[i] = 1;
    } else if (maColoured[i] < maColoured[i - 2]) {
      clrDirection[i] = -1;
    } else {
      clrDirection[i] = clrDirection[i - 1];
    }
  }
  // Fix first bars
  for (let i = 0; i < Math.min(2, n); i++) {
    clrDirection[i] = 1;
  }

  // 3xMA Trend direction
  const maDirection: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (maFast[i] > maMedium[i] && maMedium[i] > maSlow[i]) maDirection[i] = 1;
    else if (maFast[i] < maMedium[i] && maMedium[i] < maSlow[i]) maDirection[i] = -1;
    else maDirection[i] = 0;
  }

  // SuperTrend calculation
  const atrArr = ta.atr(bars, cfg.sPd).toArray();
  const sTrendUp: number[] = new Array(n).fill(0);
  const sTrendDown: number[] = new Array(n).fill(0);
  const sTrend: number[] = new Array(n).fill(1);
  const tsl: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atrVal = atrArr[i] ?? 0;
    const sUp = hl2 - cfg.sFactor * atrVal;
    const sDn = hl2 + cfg.sFactor * atrVal;

    if (i === 0) {
      sTrendUp[i] = sUp;
      sTrendDown[i] = sDn;
      sTrend[i] = 1;
    } else {
      sTrendUp[i] = bars[i - 1].close > sTrendUp[i - 1] ? Math.max(sUp, sTrendUp[i - 1]) : sUp;
      sTrendDown[i] = bars[i - 1].close < sTrendDown[i - 1] ? Math.min(sDn, sTrendDown[i - 1]) : sDn;

      if (bars[i].close > sTrendDown[i - 1]) sTrend[i] = 1;
      else if (bars[i].close < sTrendUp[i - 1]) sTrend[i] = -1;
      else sTrend[i] = sTrend[i - 1];
    }
    tsl[i] = sTrend[i] === 1 ? sTrendUp[i] : sTrendDown[i];
  }

  // Bollinger Bands (for OutsideIn filters)
  const closeSeries = new Series(bars, b => b.close);
  const bbBasis = ta.sma(closeSeries, cfg.bbLength).toArray().map(v => v ?? NaN);
  const bbDev = ta.stdev(closeSeries, cfg.bbLength).toArray().map(v => (v ?? 0) * cfg.bbStddev);
  const bbUpper: number[] = bbBasis.map((b, i) => b + bbDev[i]);
  const bbLower: number[] = bbBasis.map((b, i) => b - bbDev[i]);

  // Parse filter option
  const fo = cfg.filterOption;
  const uSuperTrendFilter = fo === 'SuperTrend';
  const u3xMATrendFilter = fo === '3xMATrend';
  const uBothTrendFilters = fo === 'SuperTrend+3xMA';
  const uMACrossFilter = fo === 'MACross';
  const uMACrossSTFilter = fo === 'MACross+ST';
  const uMACross3xMAFilter = fo === 'MACross+3xMA';
  const uOIMACrossFilter = fo === 'OutsideIn:MACross';
  const uOISTFilter = fo === 'OutsideIn:MACross+ST';
  const uOI3xMAFilter = fo === 'OutsideIn:MACross+3xMA';
  const disableAllFilters = fo === 'ColouredMA';
  const noAlerts = fo === 'No Alerts';

  // Signal computation
  const markers: MarkerData[] = [];
  const warmup = Math.max(cfg.lenColoured, cfg.lenFast, cfg.lenMedium, cfg.lenSlow, cfg.sPd, cfg.bbLength) + 5;

  // Accumulators for filtering
  const stBuy: number[] = new Array(n).fill(0);
  const stSell: number[] = new Array(n).fill(0);
  const _3xmaBuy: number[] = new Array(n).fill(0);
  const _3xmaSell: number[] = new Array(n).fill(0);
  const hBuy: number[] = new Array(n).fill(0);
  const hSell: number[] = new Array(n).fill(0);
  const macrossBuy: number[] = new Array(n).fill(0);
  const macrossSell: number[] = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const crossoverFastColoured = maFast[i - 1] <= maColoured[i - 1] && maFast[i] > maColoured[i];
    const crossunderFastColoured = maFast[i - 1] >= maColoured[i - 1] && maFast[i] < maColoured[i];

    // SuperTrend filter
    stBuy[i] = clrDirection[i] === 1 && sTrend[i] === 1 ? stBuy[i - 1] + 1 : 0;
    stSell[i] = clrDirection[i] === -1 && sTrend[i] === -1 ? stSell[i - 1] + 1 : 0;

    // 3xMA filter
    _3xmaBuy[i] = clrDirection[i] === 1 && bars[i].close > maFast[i] && maDirection[i] === 1
      ? _3xmaBuy[i - 1] + 1
      : (clrDirection[i] === 1 && maDirection[i] === 1 && _3xmaBuy[i - 1] > 0 ? _3xmaBuy[i - 1] + 1 : 0);
    _3xmaSell[i] = clrDirection[i] === -1 && bars[i].close < maFast[i] && maDirection[i] === -1
      ? _3xmaSell[i - 1] + 1
      : (clrDirection[i] === -1 && maDirection[i] === -1 && _3xmaSell[i - 1] > 0 ? _3xmaSell[i - 1] + 1 : 0);

    // Hull/ColouredMA direction signals
    hBuy[i] = clrDirection[i] === 1 ? hBuy[i - 1] + 1 : 0;
    hSell[i] = clrDirection[i] === -1 ? hSell[i - 1] + 1 : 0;

    // MA Cross signals
    macrossBuy[i] = crossoverFastColoured ? macrossBuy[i - 1] + 1 : 0;
    macrossSell[i] = crossunderFastColoured ? macrossSell[i - 1] + 1 : 0;

    if (i < warmup || noAlerts) continue;

    // Combined SuperTrend+3xMA
    const st3xmaBuyV = (_3xmaBuy[i] > 0) && stBuy[i] > 0;
    const st3xmaSellV = (_3xmaSell[i] > 0) && stSell[i] > 0;

    // MACross + SuperTrend
    const macrossSTBuyV = crossoverFastColoured && sTrend[i] === 1;
    const macrossSTSellV = crossunderFastColoured && sTrend[i] === -1;

    // MACross + 3xMA
    const macross3xMABuyV = crossoverFastColoured && maDirection[i] === 1;
    const macross3xMASellV = crossunderFastColoured && maDirection[i] === -1;

    // OutsideIn MACross: check if highest/lowest within lookback broke BB
    let oiMACrossBuyV = false;
    let oiMACrossSellV = false;
    if (uOIMACrossFilter || uOISTFilter || uOI3xMAFilter) {
      // Find highest bar index in lookback
      let highestVal = -Infinity;
      let highestIdx = 0;
      let lowestVal = Infinity;
      let lowestIdx = 0;
      const lookStart = Math.max(0, i - cfg.oiLength + 1);
      for (let j = lookStart; j <= i; j++) {
        if (bars[j].high > highestVal) { highestVal = bars[j].high; highestIdx = j; }
        if (bars[j].low < lowestVal) { lowestVal = bars[j].low; lowestIdx = j; }
      }
      const noiUpper = i - highestIdx;
      const noiLower = i - lowestIdx;

      if (crossunderFastColoured && noiUpper > 0 && highestVal > bbUpper[highestIdx]) {
        oiMACrossSellV = true;
      }
      if (crossoverFastColoured && noiLower > 0 && lowestVal < bbLower[lowestIdx]) {
        oiMACrossBuyV = true;
      }
    }

    // Check long signals
    let longSignal = false;
    let shortSignal = false;

    if (uSuperTrendFilter && stBuy[i] === 1) longSignal = true;
    if (u3xMATrendFilter && _3xmaBuy[i] === 1) longSignal = true;
    if (uBothTrendFilters && st3xmaBuyV && (stBuy[i] === 1 || _3xmaBuy[i] === 1)) longSignal = true;
    if (uMACrossFilter && macrossBuy[i] === 1) longSignal = true;
    if (uMACrossSTFilter && macrossSTBuyV) longSignal = true;
    if (uMACross3xMAFilter && macross3xMABuyV) longSignal = true;
    if (uOIMACrossFilter && oiMACrossBuyV) longSignal = true;
    if (uOISTFilter && oiMACrossBuyV && sTrend[i] === 1) longSignal = true;
    if (uOI3xMAFilter && oiMACrossBuyV && maDirection[i] === 1) longSignal = true;
    if (disableAllFilters && hBuy[i] === 1) longSignal = true;

    if (uSuperTrendFilter && stSell[i] === 1) shortSignal = true;
    if (u3xMATrendFilter && _3xmaSell[i] === 1) shortSignal = true;
    if (uBothTrendFilters && st3xmaSellV && (stSell[i] === 1 || _3xmaSell[i] === 1)) shortSignal = true;
    if (uMACrossFilter && macrossSell[i] === 1) shortSignal = true;
    if (uMACrossSTFilter && macrossSTSellV) shortSignal = true;
    if (uMACross3xMAFilter && macross3xMASellV) shortSignal = true;
    if (uOIMACrossFilter && oiMACrossSellV) shortSignal = true;
    if (uOISTFilter && oiMACrossSellV && sTrend[i] === -1) shortSignal = true;
    if (uOI3xMAFilter && oiMACrossSellV && maDirection[i] === -1) shortSignal = true;
    if (disableAllFilters && hSell[i] === 1) shortSignal = true;

    if (longSignal) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#00FF00', text: 'Buy' });
    }
    if (shortSignal) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#800000', text: 'Sell' });
    }
  }

  // Build plots
  const bullCss = '#1E90FF';
  const bearCss = '#F08080';

  const plotColouredMA = maColoured.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: clrDirection[i] < 0 ? bearCss : bullCss,
  }));
  const plotFastMA = maFast.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || !cfg.showMALines) ? NaN : v,
  }));
  const plotMediumMA = maMedium.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || !cfg.showMALines) ? NaN : v,
  }));
  const plotSlowMA = maSlow.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || !cfg.showMALines) ? NaN : v,
  }));
  const plotSuperTrend = tsl.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || !cfg.showSuperTrend) ? NaN : v,
    color: sTrend[i] === 1 ? '#008000' : '#800000',
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      colouredMA: plotColouredMA,
      fastMA: plotFastMA,
      mediumMA: plotMediumMA,
      slowMA: plotSlowMA,
      superTrend: plotSuperTrend,
    },
    markers,
  };
}

export const BigSnapperAlerts = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
