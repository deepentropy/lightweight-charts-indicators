/**
 * Moving Average ADX
 *
 * MA that colors based on ADX strength. Green when ADX > threshold (trending),
 * gray otherwise (ranging).
 *
 * Reference: TradingView "Moving Average ADX" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MAADXInputs {
  maLength: number;
  adxLength: number;
  adxThreshold: number;
  src: SourceType;
}

export const defaultInputs: MAADXInputs = {
  maLength: 20,
  adxLength: 14,
  adxThreshold: 25,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 20, min: 1 },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14, min: 1 },
  { id: 'adxThreshold', type: 'int', title: 'ADX Threshold', defval: 25, min: 0 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Moving Average ADX',
  shortTitle: 'MAADX',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MAADXInputs> = {}): IndicatorResult {
  const { maLength, adxLength, adxThreshold, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);
  const n = bars.length;

  const emaArr = ta.ema(srcSeries, maLength).toArray();

  // Calculate ADX manually using Wilder's smoothing
  const adxArr: number[] = new Array(n).fill(0);
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
    const plusDM = (high - prevHigh > prevLow - low) ? Math.max(high - prevHigh, 0) : 0;
    const minusDM = (prevLow - low > high - prevHigh) ? Math.max(prevLow - low, 0) : 0;

    if (i <= adxLength) {
      smoothTR += tr;
      smoothPlusDM += plusDM;
      smoothMinusDM += minusDM;
    } else {
      smoothTR = smoothTR - smoothTR / adxLength + tr;
      smoothPlusDM = smoothPlusDM - smoothPlusDM / adxLength + plusDM;
      smoothMinusDM = smoothMinusDM - smoothMinusDM / adxLength + minusDM;
    }

    const diPlus = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const diMinus = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = diPlus + diMinus;
    const dx = diSum !== 0 ? Math.abs(diPlus - diMinus) / diSum * 100 : 0;

    if (i === 2 * adxLength - 1) {
      adx = dx;
    } else if (i >= 2 * adxLength) {
      adx = (adx * (adxLength - 1) + dx) / adxLength;
    }

    adxArr[i] = adx;
  }

  const warmup = Math.max(maLength, 2 * adxLength);

  const plot = emaArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const val = v ?? NaN;
    const color = adxArr[i] > adxThreshold ? '#26A69A' : '#787B86';
    return { time: bars[i].time, value: val, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot },
  };
}

export const MAADX = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
