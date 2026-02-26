/**
 * Directional Movement Index + ADX & Key Levels
 *
 * DMI with ADX and key levels at 20 and 25.
 * Standard Wilder's smoothing for +DI, -DI, ADX.
 *
 * Reference: TradingView "Directional Movement Index + ADX & Key Levels" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DMIADXInputs {
  adxLen: number;
}

export const defaultInputs: DMIADXInputs = {
  adxLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14, min: 1 },
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

export function calculate(bars: Bar[], inputs: Partial<DMIADXInputs> = {}): IndicatorResult {
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

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': toPlot(adxArr, adxWarmup),
      'plot1': toPlot(diPlusArr, warmup),
      'plot2': toPlot(diMinusArr, warmup),
    },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
  };
}

export const DMIADX = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
