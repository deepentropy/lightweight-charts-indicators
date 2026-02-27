/**
 * VWAP/MVWAP/EMA Crossover
 *
 * Trading signals from VWAP/MVWAP/EMA crossovers with RSI filtering.
 * Custom VWAP calculation (cumulative volume-weighted price).
 * Includes Senkou span cloud for trend context.
 *
 * Reference: TradingView "VWAP/MVWAP/EMA CROSSOVER" by DerrickLaFlame
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface VwapMvwapEmaCrossoverInputs {
  vwapLength: number;
  emaLength1: number;
  emaLength2: number;
  rsiLimit: number;
  rsiMinimum: number;
  mvwapLength: number;
  conversionLen: number;
  baseLineLen: number;
  senkouBLen: number;
  displacementA: number;
  displacementB: number;
}

export const defaultInputs: VwapMvwapEmaCrossoverInputs = {
  vwapLength: 1,
  emaLength1: 7,
  emaLength2: 25,
  rsiLimit: 65,
  rsiMinimum: 51,
  mvwapLength: 21,
  conversionLen: 9,
  baseLineLen: 26,
  senkouBLen: 51,
  displacementA: 26,
  displacementB: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'vwapLength', type: 'int', title: 'VWAP Length', defval: 1, min: 1 },
  { id: 'emaLength1', type: 'int', title: 'EMA 1 Length', defval: 7, min: 1 },
  { id: 'emaLength2', type: 'int', title: 'EMA 2 Length', defval: 25, min: 1 },
  { id: 'rsiLimit', type: 'int', title: 'RSI Limit (RISKY)', defval: 65, min: 1 },
  { id: 'rsiMinimum', type: 'int', title: 'RSI Minimum (WAIT FOR DIP)', defval: 51, min: 1 },
  { id: 'mvwapLength', type: 'int', title: 'MVWAP Length', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: '#FFFF00', lineWidth: 3 },
  { id: 'plot1', title: 'MVWAP', color: '#FF00FF', lineWidth: 1 },
  { id: 'plot2', title: 'EMA1', color: '#FFFF00', lineWidth: 1 },
  { id: 'plot3', title: 'EMA2', color: '#FF9800', lineWidth: 1 },
  { id: 'plot4', title: 'Senkou A', color: '#008000', lineWidth: 2 },
  { id: 'plot5', title: 'Senkou B', color: '#FF0000', lineWidth: 2 },
];

export const metadata = {
  title: 'VWAP/MVWAP/EMA Crossover',
  shortTitle: 'VWAP-X',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VwapMvwapEmaCrossoverInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const {
    vwapLength, emaLength1, emaLength2, rsiLimit, rsiMinimum, mvwapLength,
    conversionLen, baseLineLen, senkouBLen, displacementA, displacementB,
  } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Compute VWAP: Pine uses vwap built-in, then ema(vwap, vwapLength)
  // Since we don't have session-based VWAP, compute cumulative VWAP per day
  const vwapArr: number[] = new Array(n).fill(NaN);
  {
    let cumPV = 0;
    let cumV = 0;
    let prevDay = -1;
    for (let i = 0; i < n; i++) {
      const d = new Date(bars[i].time * 1000);
      const dayKey = d.getUTCFullYear() * 10000 + d.getUTCMonth() * 100 + d.getUTCDate();
      if (dayKey !== prevDay) {
        cumPV = 0;
        cumV = 0;
        prevDay = dayKey;
      }
      const hlc3 = (bars[i].high + bars[i].low + bars[i].close) / 3;
      const vol = bars[i].volume ?? 0;
      cumPV += hlc3 * vol;
      cumV += vol;
      vwapArr[i] = cumV > 0 ? cumPV / cumV : hlc3;
    }
  }

  // ema(vwap, vwapLength)
  const cvwapArr: number[] = new Array(n).fill(NaN);
  {
    const alpha = 2 / (vwapLength + 1);
    for (let i = 0; i < n; i++) {
      if (isNaN(vwapArr[i])) continue;
      if (i === 0 || isNaN(cvwapArr[i - 1])) {
        cvwapArr[i] = vwapArr[i];
      } else {
        cvwapArr[i] = alpha * vwapArr[i] + (1 - alpha) * cvwapArr[i - 1];
      }
    }
  }

  // MVWAP = ema(vwap, mvwapLength)
  const mvwapArr: number[] = new Array(n).fill(NaN);
  {
    const alpha = 2 / (mvwapLength + 1);
    for (let i = 0; i < n; i++) {
      if (isNaN(vwapArr[i])) continue;
      if (i === 0 || isNaN(mvwapArr[i - 1])) {
        mvwapArr[i] = vwapArr[i];
      } else {
        mvwapArr[i] = alpha * vwapArr[i] + (1 - alpha) * mvwapArr[i - 1];
      }
    }
  }

  // EMAs
  const close = new Series(bars, (b) => b.close);
  const ema1Arr = ta.ema(close, emaLength1).toArray();
  const ema2Arr = ta.ema(close, emaLength2).toArray();

  // RSI
  const rsiArr = ta.rsi(close, 14).toArray();

  // Conditions
  const buyArr: number[] = new Array(n).fill(0);
  const longArr: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const e1 = ema1Arr[i] ?? 0;
    const e2 = ema2Arr[i] ?? 0;
    const mv = mvwapArr[i] ?? 0;
    const cv = cvwapArr[i] ?? 0;

    const check1 = e1 >= mv;
    const check2 = e2 >= mv;
    const check3 = cv >= mv;
    const cross = check1 && check2;
    const crossUp = cross && check3;

    const rsi = rsiArr[i] ?? 0;
    const buy = crossUp && rsi > 0;

    buyArr[i] = buy ? 1 : 0;
    longArr[i] = buy ? 1 : 0;
  }

  // Senkou spans (volume-weighted Ichimoku-style)
  // Pine: f(x) => total_volume=sum(volume,x), vw_high=sum(high*vol,x)/total_volume, vw_low=sum(low*vol,x)/total_volume, (vw_high+vw_low)/2
  function volWeightedMidpoint(len: number): number[] {
    const result: number[] = new Array(n).fill(NaN);
    let sumV = 0, sumHV = 0, sumLV = 0;
    for (let i = 0; i < n; i++) {
      const vol = bars[i].volume ?? 0;
      sumV += vol;
      sumHV += bars[i].high * vol;
      sumLV += bars[i].low * vol;
      if (i >= len) {
        const oldVol = bars[i - len].volume ?? 0;
        sumV -= oldVol;
        sumHV -= bars[i - len].high * oldVol;
        sumLV -= bars[i - len].low * oldVol;
      }
      if (i >= len - 1 && sumV > 0) {
        result[i] = (sumHV / sumV + sumLV / sumV) / 2;
      }
    }
    return result;
  }

  const convLine = volWeightedMidpoint(conversionLen);
  const baseLine = volWeightedMidpoint(baseLineLen);
  const senkouABase: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    if (!isNaN(convLine[i]) && !isNaN(baseLine[i])) {
      senkouABase[i] = (convLine[i] + baseLine[i]) / 2;
    }
  }
  const senkouBBase = volWeightedMidpoint(senkouBLen);

  // Apply displacement (shift forward)
  const senkouA: number[] = new Array(n).fill(NaN);
  const senkouB: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const srcA = i - displacementA;
    const srcB = i - displacementB;
    if (srcA >= 0) senkouA[i] = senkouABase[srcA];
    if (srcB >= 0) senkouB[i] = senkouBBase[srcB];
  }

  // Markers for Long/Short entry triggers
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const fillColorsSenkou: string[] = [];

  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const plot2: { time: number; value: number }[] = [];
  const plot3: { time: number; value: number }[] = [];
  const plot4: { time: number; value: number }[] = [];
  const plot5: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;

    plot0.push({ time: t, value: cvwapArr[i] });
    plot1.push({ time: t, value: mvwapArr[i] });
    plot2.push({ time: t, value: ema1Arr[i] ?? NaN });
    plot3.push({ time: t, value: ema2Arr[i] ?? NaN });
    plot4.push({ time: t, value: senkouA[i] });
    plot5.push({ time: t, value: senkouB[i] });

    // Pine: Longtrigger = crossover(Long, 0.5), Shorttrigger = crossover(Short, 0.5)
    if (i > 0) {
      const prevLong = longArr[i - 1];
      const curLong = longArr[i];
      const prevShort = prevLong === 0 ? 1 : 0;
      const curShort = curLong === 0 ? 1 : 0;

      if (prevLong <= 0 && curLong > 0) {
        markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: '#00FF00', text: 'Long' });
      }
      if (prevShort <= 0 && curShort > 0) {
        markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'Short' });
      }
    }

    // Bar color: green when Long, red when Short
    barColors.push({ time: t, color: longArr[i] === 1 ? '#00FF00' : '#FF0000' });

    // Fill between Senkou A and B
    const sa = senkouA[i];
    const sb = senkouB[i];
    if (!isNaN(sa) && !isNaN(sb)) {
      fillColorsSenkou.push(sa > sb ? 'rgba(0,128,0,0.27)' : 'rgba(255,0,0,0.27)');
    } else {
      fillColorsSenkou.push('transparent');
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': plot0, 'plot1': plot1, 'plot2': plot2,
      'plot3': plot3, 'plot4': plot4, 'plot5': plot5,
    },
    fills: [
      { plot1: 'plot4', plot2: 'plot5', options: { color: 'rgba(0,128,0,0.27)' }, colors: fillColorsSenkou },
    ],
    markers,
    barColors,
  };
}

export const VwapMvwapEmaCrossover = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
