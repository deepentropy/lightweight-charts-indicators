/**
 * Directional Movement Index + ADX & Key Levels
 *
 * DMI with ADX and key levels at 20 and 25.
 * Standard Wilder's smoothing for +DI, -DI, ADX.
 *
 * Reference: TradingView "Directional Movement Index + ADX & Key Levels" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface DMIADXInputs {
  adxLen: number;
  keyLevel: number;
}

export const defaultInputs: DMIADXInputs = {
  adxLen: 14,
  keyLevel: 23,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14, min: 1 },
  { id: 'keyLevel', type: 'int', title: 'Key Level', defval: 23, min: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#FFEB3B', lineWidth: 2 },
  { id: 'plot1', title: '+DI', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: '-DI', color: '#EF5350', lineWidth: 1 },
];

export const hlineConfig = [
  { value: 25, options: { color: '#FF6D00', linestyle: 'dashed' as const, title: 'Strong Trend' } },
  { value: 20, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Weak Trend' } },
];

export const metadata = {
  title: 'Directional Movement Index + ADX & Key Levels',
  shortTitle: 'DMI ADX',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<DMIADXInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { adxLen, keyLevel } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const diPlusArr: number[] = new Array(n);
  const diMinusArr: number[] = new Array(n);
  const adxArr: number[] = new Array(n);

  let smoothTR = 0;
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;
  let adx = 0;

  for (let i = 0; i < n; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevHigh = i > 0 ? bars[i - 1].high : high;
    const prevLow = i > 0 ? bars[i - 1].low : low;
    const prevClose = i > 0 ? bars[i - 1].close : bars[i].close;

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    const upMove = high - prevHigh;
    const downMove = prevLow - low;
    const plusDM = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDM = downMove > upMove && downMove > 0 ? downMove : 0;

    if (i <= adxLen) {
      smoothTR += tr;
      smoothPlusDM += plusDM;
      smoothMinusDM += minusDM;
    } else {
      smoothTR = smoothTR - smoothTR / adxLen + tr;
      smoothPlusDM = smoothPlusDM - smoothPlusDM / adxLen + plusDM;
      smoothMinusDM = smoothMinusDM - smoothMinusDM / adxLen + minusDM;
    }

    const diPlus = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const diMinus = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = diPlus + diMinus;
    const dx = diSum !== 0 ? Math.abs(diPlus - diMinus) / diSum * 100 : 0;

    if (i === 2 * adxLen - 1) {
      adx = dx;
    } else if (i >= 2 * adxLen) {
      adx = (adx * (adxLen - 1) + dx) / adxLen;
    }

    diPlusArr[i] = diPlus;
    diMinusArr[i] = diMinus;
    adxArr[i] = adx;
  }

  const warmup = adxLen;
  const adxWarmup = 2 * adxLen - 1;

  const toPlot = (arr: number[], wu: number) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < wu ? NaN : v }));

  // Markers: trend entry signals based on DI crossovers + ADX strength
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const hlRange = 20;
  const hlTrend = 35;

  for (let i = adxWarmup + 1; i < n; i++) {
    const sig = adxArr[i];
    const diUp = diPlusArr[i] >= diMinusArr[i];
    const diDn = diMinusArr[i] > diPlusArr[i];
    const diUpPrev = diPlusArr[i - 1] >= diMinusArr[i - 1];
    const diDnPrev = diMinusArr[i - 1] > diPlusArr[i - 1];
    const sigUp = sig > adxArr[i - 1];
    const inRange = sig <= hlRange;
    const inRangePrev = adxArr[i - 1] <= hlRange;

    // Bullish trend entry
    const entryLong = (!inRange && diUp && sigUp && !diUpPrev) ||
                      (!inRange && diUp && sigUp && sig > hlRange && inRangePrev);
    // Bearish trend entry
    const entryShort = (!inRange && diDn && sigUp && !diDnPrev) ||
                       (!inRange && diDn && sigUp && sig > hlRange && inRangePrev);
    // Strong bullish
    const entryLongStr = !inRange && diUp && sigUp && diPlusArr[i] >= hlTrend;
    // Strong bearish
    const entryShortStr = !inRange && diDn && sigUp && diMinusArr[i] > hlTrend;
    // DI cross (exit)
    const crossDi = (diPlusArr[i] >= diMinusArr[i]) !== (diPlusArr[i - 1] >= diMinusArr[i - 1]);
    const exitLong = (crossDi && diUpPrev) || (inRange && !inRangePrev);
    const exitShort = (crossDi && diDnPrev) || (inRange && !inRangePrev);

    if (entryLongStr) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#006400', text: 'Strong Bull' });
    } else if (entryLong) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#006400', text: 'Bull' });
    }
    if (entryShortStr) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#8B0000', text: 'Strong Bear' });
    } else if (entryShort) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#8B0000', text: 'Bear' });
    }
    if (exitLong || exitShort) {
      markers.push({ time: bars[i].time, position: 'inBar', shape: 'xcross', color: '#FF9800', text: 'Exit' });
    }

    // Bar color based on ADX/DI state
    const barCol = inRange ? '#FF9800' :
      (sigUp && diUp) ? '#006400' :
      (!sigUp && diUp) ? '#388e3c' :
      (sigUp && diDn) ? '#8B0000' :
      (!sigUp && diDn) ? '#b71c1c' : '';
    if (barCol) {
      barColors.push({ time: bars[i].time, color: barCol });
    }
  }

  // Fill between +DI and -DI
  const fillColors = bars.map((_b, i) => {
    if (i < adxWarmup) return 'transparent';
    const sig = adxArr[i];
    const diUp = diPlusArr[i] >= diMinusArr[i];
    const inRange = sig <= hlRange;
    if (inRange) return 'rgba(255,152,0,0.10)';
    if (diUp && diPlusArr[i] >= hlTrend) return 'rgba(0,100,0,0.10)';
    if (diUp) return 'rgba(56,142,60,0.10)';
    if (diMinusArr[i] > hlTrend) return 'rgba(139,0,0,0.10)';
    return 'rgba(183,28,28,0.10)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': toPlot(adxArr, adxWarmup),
      'plot1': toPlot(diPlusArr, warmup),
      'plot2': toPlot(diMinusArr, warmup),
    },
    hlines: [
      ...hlineConfig.map(h => ({ value: h.value, options: h.options })),
      { value: keyLevel, options: { color: '#FFFFFF', linestyle: 'dashed' as const, title: 'Key Level' } },
    ],
    fills: [{ plot1: 'plot1', plot2: 'plot2', colors: fillColors }],
    markers,
    barColors,
  };
}

export const DMIADX = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
