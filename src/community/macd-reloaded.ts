/**
 * MACD ReLoaded
 *
 * MACD with 11 selectable moving average types for fast, slow, and trigger lines.
 * Supports SMA, EMA, WMA, DEMA, TMA, VAR, WWMA, ZLEMA, TSF, HULL, and TILL (Tillson T3).
 *
 * 4-color histogram: bright/faded green/red based on histogram momentum direction.
 *
 * Reference: TradingView "MACD ReLoaded" by KivancOzbilgic
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export type MaType = 'SMA' | 'EMA' | 'WMA' | 'DEMA' | 'TMA' | 'VAR' | 'WWMA' | 'ZLEMA' | 'TSF' | 'HULL' | 'TILL';

export interface MacdReloadedInputs {
  fastLength: number;
  slowLength: number;
  triggerLength: number;
  maType: MaType;
  t3Volume: number;
  showHistogram: boolean;
}

export const defaultInputs: MacdReloadedInputs = {
  fastLength: 12,
  slowLength: 26,
  triggerLength: 9,
  maType: 'VAR',
  t3Volume: 0.7,
  showHistogram: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Short Moving Average Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Long Moving Average Length', defval: 26, min: 1 },
  { id: 'triggerLength', type: 'int', title: 'Trigger Length', defval: 9, min: 1 },
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'VAR', options: ['SMA', 'EMA', 'WMA', 'DEMA', 'TMA', 'VAR', 'WWMA', 'ZLEMA', 'TSF', 'HULL', 'TILL'] },
  { id: 't3Volume', type: 'float', title: 'TILLSON T3 Volume Factor', defval: 0.7, min: 0, max: 1, step: 0.1 },
  { id: 'showHistogram', type: 'bool', title: 'Show MACD Histogram', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'histogram', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'columns' },
  { id: 'macd', title: 'MACDRe', color: '#426BE6', lineWidth: 2 },
  { id: 'trigger', title: 'TRIGGER', color: '#E60000', lineWidth: 2 },
];

export const metadata = {
  title: 'MACD ReLoaded',
  shortTitle: 'MACDRe',
  overlay: false,
};

/**
 * Compute a specific MA type on a source array, returning a number[].
 * Some types (VAR, WWMA, ZLEMA, TSF, TILL) need bar-by-bar iteration;
 * others delegate to ta.* helpers.
 */
function computeMA(bars: Bar[], srcArr: number[], length: number, maType: MaType, t3a: number): number[] {
  const n = srcArr.length;
  const srcSeries = Series.fromArray(bars, srcArr);

  switch (maType) {
    case 'SMA':
      return ta.sma(srcSeries, length).toArray();
    case 'EMA':
      return ta.ema(srcSeries, length).toArray();
    case 'WMA':
      return ta.wma(srcSeries, length).toArray();
    case 'DEMA': {
      const ema1 = ta.ema(srcSeries, length).toArray();
      const ema1Series = Series.fromArray(bars, ema1);
      const ema2 = ta.ema(ema1Series, length).toArray();
      return ema1.map((v, i) => 2 * v - ema2[i]);
    }
    case 'TMA': {
      // TRIMA = SMA(SMA(src, ceil(len/2)), floor(len/2)+1)
      const innerLen = Math.ceil(length / 2);
      const outerLen = Math.floor(length / 2) + 1;
      const sma1 = ta.sma(srcSeries, innerLen).toArray();
      const sma1Series = Series.fromArray(bars, sma1);
      return ta.sma(sma1Series, outerLen).toArray();
    }
    case 'VAR': {
      // Variable Index Dynamic Average (VIDYA) using CMO
      const valpha = 2 / (length + 1);
      const result: number[] = new Array(n);
      // Compute vud1, vdd1 arrays
      const vud1: number[] = new Array(n);
      const vdd1: number[] = new Array(n);
      vud1[0] = 0;
      vdd1[0] = 0;
      for (let i = 1; i < n; i++) {
        vud1[i] = srcArr[i] > srcArr[i - 1] ? srcArr[i] - srcArr[i - 1] : 0;
        vdd1[i] = srcArr[i] < srcArr[i - 1] ? srcArr[i - 1] - srcArr[i] : 0;
      }
      // Rolling sum(9)
      const vUD: number[] = new Array(n).fill(0);
      const vDD: number[] = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        let su = 0, sd = 0;
        for (let j = Math.max(0, i - 8); j <= i; j++) {
          su += vud1[j];
          sd += vdd1[j];
        }
        vUD[i] = su;
        vDD[i] = sd;
      }
      result[0] = srcArr[0];
      for (let i = 1; i < n; i++) {
        const denom = vUD[i] + vDD[i];
        const vCMO = denom !== 0 ? (vUD[i] - vDD[i]) / denom : 0;
        const k = valpha * Math.abs(vCMO);
        result[i] = k * srcArr[i] + (1 - k) * result[i - 1];
      }
      return result;
    }
    case 'WWMA': {
      // Welles Wilder MA (= RMA with alpha=1/length)
      const alpha = 1 / length;
      const result: number[] = new Array(n);
      result[0] = srcArr[0];
      for (let i = 1; i < n; i++) {
        result[i] = alpha * srcArr[i] + (1 - alpha) * result[i - 1];
      }
      return result;
    }
    case 'ZLEMA': {
      // Zero-Lag EMA
      const zxLag = length % 2 === 0 ? length / 2 : (length - 1) / 2;
      const zxData: number[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const lagged = i >= zxLag ? srcArr[i - zxLag] : srcArr[0];
        zxData[i] = srcArr[i] + (srcArr[i] - lagged);
      }
      const zxSeries = Series.fromArray(bars, zxData);
      return ta.ema(zxSeries, length).toArray();
    }
    case 'TSF': {
      // Time Series Forecast: linreg(src, len, 0) + (linreg(src, len, 0) - linreg(src, len, 1))
      const lr0 = ta.linreg(srcSeries, length, 0).toArray();
      const lr1 = ta.linreg(srcSeries, length, 1).toArray();
      return lr0.map((v, i) => v + (v - lr1[i]));
    }
    case 'HULL': {
      // HMA = WMA(2*WMA(src, len/2) - WMA(src, len), round(sqrt(len)))
      const halfLen = Math.max(Math.round(length / 2), 1);
      const sqrtLen = Math.max(Math.round(Math.sqrt(length)), 1);
      const wma1 = ta.wma(srcSeries, halfLen).toArray();
      const wma2 = ta.wma(srcSeries, length).toArray();
      const diff = wma1.map((v, i) => 2 * v - wma2[i]);
      const diffSeries = Series.fromArray(bars, diff);
      return ta.wma(diffSeries, sqrtLen).toArray();
    }
    case 'TILL': {
      // Tillson T3: chain of 6 EMAs with cubic coefficients
      const e1 = ta.ema(srcSeries, length).toArray();
      const e2 = ta.ema(Series.fromArray(bars, e1), length).toArray();
      const e3 = ta.ema(Series.fromArray(bars, e2), length).toArray();
      const e4 = ta.ema(Series.fromArray(bars, e3), length).toArray();
      const e5 = ta.ema(Series.fromArray(bars, e4), length).toArray();
      const e6 = ta.ema(Series.fromArray(bars, e5), length).toArray();
      const a = t3a;
      const c1 = -a * a * a;
      const c2 = 3 * a * a + 3 * a * a * a;
      const c3 = -6 * a * a - 3 * a - 3 * a * a * a;
      const c4 = 1 + 3 * a + a * a * a + 3 * a * a;
      return e6.map((_, i) => c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i]);
    }
    default:
      return ta.ema(srcSeries, length).toArray();
  }
}

export function calculate(bars: Bar[], inputs: Partial<MacdReloadedInputs> = {}): IndicatorResult {
  const { fastLength, slowLength, triggerLength, maType, t3Volume, showHistogram } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeArr = bars.map(b => b.close);

  // Fast MA (MA12) and Slow MA (MA26) on close
  const ma12 = computeMA(bars, closeArr, fastLength, maType, t3Volume);
  const ma26 = computeMA(bars, closeArr, slowLength, maType, t3Volume);

  // MACD line = MA12 - MA26
  const macdArr = ma12.map((v, i) => v - ma26[i]);

  // Trigger/Signal line = MA of MACD line with triggerLength
  const triggerArr = computeMA(bars, macdArr, triggerLength, maType, t3Volume);

  // Histogram = MACD - Trigger
  const histArr = macdArr.map((v, i) => v - triggerArr[i]);

  // Warmup: use slowLength as the minimum warmup
  const warmup = slowLength;

  const histPlot: { time: number | string; value: number; color?: string }[] = new Array(n);
  const macdPlot: { time: number | string; value: number }[] = new Array(n);
  const triggerPlot: { time: number | string; value: number }[] = new Array(n);

  let prevHist = NaN;
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (i < warmup) {
      histPlot[i] = { time: t, value: NaN };
      macdPlot[i] = { time: t, value: NaN };
      triggerPlot[i] = { time: t, value: NaN };
    } else {
      const h = histArr[i];
      const m = macdArr[i];
      const tr = triggerArr[i];
      let color: string;
      if (!isNaN(h) && !isNaN(prevHist)) {
        // Pine: hist>=0 ? (hist[1]<hist ? lime : #B2DFDB) : (hist[1]<hist ? #FFCDD2 : #EF5350)
        if (h >= 0) {
          color = prevHist < h ? '#26A69A' : '#B2DFDB';
        } else {
          color = prevHist < h ? '#FFCDD2' : '#EF5350';
        }
      } else {
        color = '#787B86';
      }
      histPlot[i] = { time: t, value: showHistogram ? h : NaN, color };
      macdPlot[i] = { time: t, value: isNaN(m) ? NaN : m };
      triggerPlot[i] = { time: t, value: isNaN(tr) ? NaN : tr };
      prevHist = h;
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'histogram': histPlot, 'macd': macdPlot, 'trigger': triggerPlot },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const MacdReloaded = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
