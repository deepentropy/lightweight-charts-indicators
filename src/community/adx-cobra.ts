/**
 * ADX by cobra
 *
 * ADX with +DI/-DI lines and visual styling.
 * ADX colored green when rising, red when falling.
 * Manual Wilder's smoothing calculation for DM, DI, DX, ADX.
 *
 * Reference: TradingView "ADX" by cobra (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface ADXCobraInputs {
  adxLen: number;
}

export const defaultInputs: ADXCobraInputs = {
  adxLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: '+DI', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: '-DI', color: '#EF5350', lineWidth: 1 },
];

export const hlineConfig = [
  { value: 25, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Strong Trend' } },
];

export const metadata = {
  title: 'ADX by cobra',
  shortTitle: 'ADX Cobra',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ADXCobraInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
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

  const toPlot = (arr: number[], wu: number) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < wu ? NaN : v }));

  const adxPlot = adxArr.map((v, i) => {
    if (i < adxWarmup) return { time: bars[i].time, value: NaN };
    const rising = i > adxWarmup && v > adxArr[i - 1];
    const color = rising ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // bgColors from Pine: 4 bgcolor() calls
  // 1. DIMOVS (DI- > 60) → lime/green background (transp=40)
  // 2. DIPOVB (DI+ > 60) → orange background (transp=20)
  // 3. DIPcross (DI+ > DI-) → green background (transp=60)
  // 4. DIPput (DI- > DI+) → red background (transp=60)
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < n; i++) {
    const diPlus = diPlusArr[i];
    const diMinus = diMinusArr[i];

    // Priority: DIMOVS and DIPOVB are stronger signals, shown on top
    if (diMinus > 60) {
      bgColors.push({ time: bars[i].time, color: 'rgba(0,255,0,0.60)' }); // lime, transp=40
    } else if (diPlus > 60) {
      bgColors.push({ time: bars[i].time, color: 'rgba(255,165,0,0.80)' }); // orange, transp=20
    } else if (diPlus > diMinus) {
      bgColors.push({ time: bars[i].time, color: 'rgba(0,128,0,0.40)' }); // green, transp=60
    } else if (diMinus > diPlus) {
      bgColors.push({ time: bars[i].time, color: 'rgba(255,0,0,0.40)' }); // red, transp=60
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': adxPlot, 'plot1': toPlot(diPlusArr, warmup), 'plot2': toPlot(diMinusArr, warmup) },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
    bgColors,
  };
}

export const ADXCobra = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
