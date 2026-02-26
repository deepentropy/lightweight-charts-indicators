/**
 * CM ADX V1
 *
 * ADX with +DI/-DI and CM styling.
 * Bars colored green when +DI > -DI, red when -DI > +DI.
 *
 * Reference: TradingView "CM_ADX V1" by ChrisMoody (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface CMADXInputs {
  adxLen: number;
}

export const defaultInputs: CMADXInputs = {
  adxLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: '+DI', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: '-DI', color: '#EF5350', lineWidth: 1 },
];

export const hlineConfig = [
  { value: 20, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Threshold' } },
];

export const metadata = {
  title: 'CM ADX V1',
  shortTitle: 'CM ADX',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CMADXInputs> = {}): IndicatorResult {
  const { adxLen } = { ...defaultInputs, ...inputs };
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
  const barColors: BarColorData[] = [];

  const toPlot = (arr: number[], wu: number) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < wu ? NaN : v }));

  const adxPlot = adxArr.map((v, i) => ({
    time: bars[i].time,
    value: i < adxWarmup ? NaN : v,
  }));

  // Bar colors based on DI comparison
  for (let i = warmup; i < n; i++) {
    barColors.push({
      time: bars[i].time as number,
      color: diPlusArr[i] > diMinusArr[i] ? '#26A69A' : '#EF5350',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': adxPlot, 'plot1': toPlot(diPlusArr, warmup), 'plot2': toPlot(diMinusArr, warmup) },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
    barColors,
  } as IndicatorResult & { barColors: BarColorData[] };
}

export const CMADX = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
