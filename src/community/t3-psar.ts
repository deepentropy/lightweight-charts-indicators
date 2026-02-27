/**
 * TKP T3 Trend with PSAR
 *
 * Tillson T3 moving average combined with Parabolic SAR for trend confirmation.
 * T3 uses a 6-stage EMA cascade with volume factor coefficients.
 * PSAR provides additional trend direction via manual computation.
 *
 * Reference: TradingView "TKP T3 Trend with PSAR" (TV#737)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, PlotCandleData } from '../types';

export interface T3PsarInputs {
  t3Len: number;
  t3SlowLen: number;
  t3Factor: number;
  sarStart: number;
  sarInc: number;
  sarMax: number;
  src: SourceType;
  showHA: boolean;
}

export const defaultInputs: T3PsarInputs = {
  t3Len: 5,
  t3SlowLen: 8,
  t3Factor: 0.7,
  sarStart: 0.02,
  sarInc: 0.02,
  sarMax: 0.2,
  src: 'close',
  showHA: false,
};

export const inputConfig: InputConfig[] = [
  { id: 't3Len', type: 'int', title: 'T3 Fast Length', defval: 5, min: 1 },
  { id: 't3SlowLen', type: 'int', title: 'T3 Slow Length', defval: 8, min: 1 },
  { id: 't3Factor', type: 'float', title: 'T3 Volume Factor', defval: 0.7, min: 0, max: 1, step: 0.01 },
  { id: 'sarStart', type: 'float', title: 'SAR Start', defval: 0.02, min: 0.001, step: 0.01 },
  { id: 'sarInc', type: 'float', title: 'SAR Increment', defval: 0.02, min: 0.001, step: 0.01 },
  { id: 'sarMax', type: 'float', title: 'SAR Max', defval: 0.2, min: 0.01, step: 0.01 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showHA', type: 'bool', title: 'Heikin-Ashi Bar Overlay', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3 Fast', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Up SAR', color: '#64B5F6', lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'Down SAR', color: '#EF5350', lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'T3 Slow', color: '#FF6D00', lineWidth: 2 },
];

export const plotCandleConfig = [
  { id: 'ha', title: 'Heikin-Ashi' },
];

export const metadata = {
  title: 'TKP T3 Trend with PSAR',
  shortTitle: 'T3+SAR',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<T3PsarInputs> = {}): IndicatorResult & { plotCandles?: Record<string, PlotCandleData[]> } {
  const { t3Len, t3SlowLen, t3Factor, sarStart, sarInc, sarMax, src, showHA } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const source = getSourceSeries(bars, src);

  // T3 coefficients
  const a = t3Factor;
  const c1 = -a * a * a;
  const c2 = 3 * a * a + 3 * a * a * a;
  const c3 = -6 * a * a - 3 * a - 3 * a * a * a;
  const c4 = 1 + 3 * a + a * a * a + 3 * a * a;

  // T3 Fast calculation: 6-stage EMA cascade
  const e1 = ta.ema(source, t3Len);
  const e2 = ta.ema(e1, t3Len);
  const e3 = ta.ema(e2, t3Len);
  const e4 = ta.ema(e3, t3Len);
  const e5 = ta.ema(e4, t3Len);
  const e6 = ta.ema(e5, t3Len);
  const t3 = e6.mul(c1).add(e5.mul(c2)).add(e4.mul(c3)).add(e3.mul(c4));
  const t3Arr = t3.toArray();

  // T3 Slow calculation: 6-stage EMA cascade with t3SlowLen
  const se1 = ta.ema(source, t3SlowLen);
  const se2 = ta.ema(se1, t3SlowLen);
  const se3 = ta.ema(se2, t3SlowLen);
  const se4 = ta.ema(se3, t3SlowLen);
  const se5 = ta.ema(se4, t3SlowLen);
  const se6 = ta.ema(se5, t3SlowLen);
  const t3Slow = se6.mul(c1).add(se5.mul(c2)).add(se4.mul(c3)).add(se3.mul(c4));
  const t3SlowArr = t3Slow.toArray();

  // Manual SAR computation
  const sarArr: number[] = new Array(n);
  const sarDirArr: number[] = new Array(n);
  let af = sarStart;
  let ep = bars[0].high;
  sarArr[0] = bars[0].low;
  sarDirArr[0] = 1;

  for (let i = 1; i < n; i++) {
    const prevDir = sarDirArr[i - 1];
    let sar = sarArr[i - 1] + af * (ep - sarArr[i - 1]);

    if (prevDir === 1) {
      sar = Math.min(sar, bars[i - 1].low);
      if (i >= 2) sar = Math.min(sar, bars[i - 2].low);
      if (bars[i].low < sar) {
        sarDirArr[i] = -1;
        sar = ep;
        ep = bars[i].low;
        af = sarStart;
      } else {
        sarDirArr[i] = 1;
        if (bars[i].high > ep) {
          ep = bars[i].high;
          af = Math.min(af + sarInc, sarMax);
        }
      }
    } else {
      sar = Math.max(sar, bars[i - 1].high);
      if (i >= 2) sar = Math.max(sar, bars[i - 2].high);
      if (bars[i].high > sar) {
        sarDirArr[i] = 1;
        sar = ep;
        ep = bars[i].high;
        af = sarStart;
      } else {
        sarDirArr[i] = -1;
        if (bars[i].low < ep) {
          ep = bars[i].low;
          af = Math.min(af + sarInc, sarMax);
        }
      }
    }
    sarArr[i] = sar;
  }

  // Heikin-Ashi OHLC (Pine lines 116-120)
  const haCloseArr: number[] = new Array(n);
  const haOpenArr: number[] = new Array(n);
  const haHighArr: number[] = new Array(n);
  const haLowArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const { open: o, high: h, low: l, close: c } = bars[i];
    haCloseArr[i] = (o + h + l + c) / 4;
    haOpenArr[i] = i === 0 ? (o + c) / 2 : (haOpenArr[i - 1] + haCloseArr[i - 1]) / 2;
    haHighArr[i] = Math.max(h, haOpenArr[i], haCloseArr[i]);
    haLowArr[i] = Math.min(l, haOpenArr[i], haCloseArr[i]);
  }

  const warmup = Math.max(t3Len, t3SlowLen) * 6;

  const plot0 = t3Arr.map((v, i) => {
    const val = i < warmup ? NaN : (v ?? NaN);
    if (isNaN(val)) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (t3Arr[i - 1] ?? NaN) : NaN;
    const color = val > prev ? '#64B5F6' : val < prev ? '#EF5350' : '#FFEB3B';
    return { time: bars[i].time, value: val, color };
  });

  // Up SAR: shown only when close >= SAR (bullish, Pine: colUp = close >= sarDown ? #64b5f6 : na)
  const plot1 = sarArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < 1 || bars[i].close < v) ? NaN : v,
    color: '#64B5F6',
  }));

  // Down SAR: shown only when close <= SAR (bearish, Pine: colDown = close <= sarUp ? #ef5350 : na)
  const plot2 = sarArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < 1 || bars[i].close > v) ? NaN : v,
    color: '#EF5350',
  }));

  // T3 Slow
  const plot3 = t3SlowArr.map((v, i) => {
    const val = i < warmup ? NaN : (v ?? NaN);
    if (isNaN(val)) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? (t3SlowArr[i - 1] ?? NaN) : NaN;
    const color = val > prev ? '#64B5F6' : val < prev ? '#EF5350' : '#FFEB3B';
    return { time: bars[i].time, value: val, color };
  });

  // markers: TSI curl arrows (Pine: plotshape for TSI momentum curl up/down)
  // TSI = 100 * double_smooth(change(close), long=25, short=5) / double_smooth(abs(change(close)), long=25, short=5)
  const closeSeries = new Series(bars, (b) => b.close);
  const closeArr = closeSeries.toArray();
  const pcArr: number[] = new Array(n);
  const absPcArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    pcArr[i] = i > 0 ? (closeArr[i]! - closeArr[i - 1]!) : 0;
    absPcArr[i] = Math.abs(pcArr[i]);
  }
  const pcSeries = Series.fromArray(bars, pcArr);
  const absPcSeries = Series.fromArray(bars, absPcArr);
  // double_smooth(src, long, short) = ema(ema(src, long), short)
  const dsPc = ta.ema(ta.ema(pcSeries, 25), 5).toArray();
  const dsAbsPc = ta.ema(ta.ema(absPcSeries, 25), 5).toArray();
  const tsiArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const denom = dsAbsPc[i] ?? 0;
    tsiArr[i] = denom !== 0 ? 100 * (dsPc[i] ?? 0) / denom : 0;
  }
  const tsiSeries = Series.fromArray(bars, tsiArr);
  const tsiSignalArr = ta.ema(tsiSeries, 14).toArray();

  const markers: MarkerData[] = [];
  const tsiWarmup = 30 + 14;
  for (let i = tsiWarmup + 1; i < n; i++) {
    const tsi = tsiArr[i];
    const prevTsi = tsiArr[i - 1];
    const sig = tsiSignalArr[i] ?? NaN;
    if (isNaN(sig)) continue;
    // curl up: tsi rising and tsi < signal (momentum headwind turning)
    if (tsi > prevTsi && tsi < sig) {
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#00E676', // #17ff00 ≈ bright green
        text: '',
      });
    }
    // curl down: tsi falling and tsi > signal
    if (tsi < prevTsi && tsi > sig) {
      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#FFEB3B',
        text: '',
      });
    }
  }

  // barcolor: 4-state coloring based on close vs T3 Slow (nT3Average) and T3 Fast vs T3 Slow (anT3Average >= nT3Average)
  // Pine: uc = close > nT3Average and anT3Average >= nT3Average (bull blue)
  //        dc = close < nT3Average and anT3Average <= nT3Average (bear red)
  //        dr = close < nT3Average and anT3Average >= nT3Average (bearish reversal yellow)
  //        ur = close > nT3Average and anT3Average <= nT3Average (bullish reversal yellow)
  const barColors: BarColorData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const t3Fast = t3Arr[i] ?? NaN;
    const t3SlowVal = t3SlowArr[i] ?? NaN;
    if (isNaN(t3Fast) || isNaN(t3SlowVal)) continue;
    const closeAboveSlow = bars[i].close > t3SlowVal;
    const fastAboveSlow = t3Fast >= t3SlowVal;

    let col: string;
    if (closeAboveSlow && fastAboveSlow) {
      col = '#64B5F6'; // bull trend blue
    } else if (!closeAboveSlow && !fastAboveSlow) {
      col = '#EF5350'; // bear trend red
    } else {
      col = '#FFF176'; // reversal yellow
    }
    barColors.push({ time: bars[i].time, color: col });
  }

  // Build HA candle overlay when showHA is enabled (Pine lines 134-161)
  // habarColor: hauc=bullcol, hadc=bearcol, hadr=bearrev, haur=bullrev, else hadefval
  const haCandles: PlotCandleData[] | undefined = showHA ? bars.map((b, i) => {
    const t3Fast = t3Arr[i] ?? NaN;
    const t3SlowVal = t3SlowArr[i] ?? NaN;
    const hc = haCloseArr[i];
    const ho = haOpenArr[i];

    let col: string;
    if (i > warmup && !isNaN(t3Fast) && !isNaN(t3SlowVal)) {
      const hauc = hc > t3SlowVal && t3Fast >= t3SlowVal;
      const hadc = hc < t3SlowVal && t3Fast <= t3SlowVal;
      const hadr = hc < t3SlowVal && t3Fast >= t3SlowVal;
      const haur = hc > t3SlowVal && t3Fast <= t3SlowVal;
      if (hauc) col = '#64B5F6';        // bull blue
      else if (hadc) col = '#EF5350';    // bear red
      else if (hadr) col = '#FFF176';    // bearish reversal yellow
      else if (haur) col = '#FFF176';    // bullish reversal yellow
      else col = hc >= ho ? '#64B5F6' : '#EF5350'; // hadefval
    } else {
      col = hc >= ho ? '#64B5F6' : '#EF5350'; // hadefval before warmup
    }

    return {
      time: b.time as number,
      open: ho,
      high: haHighArr[i],
      low: haLowArr[i],
      close: hc,
      color: col,
      borderColor: col,
      wickColor: col,
    };
  }) : undefined;

  const result: IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; plotCandles?: Record<string, PlotCandleData[]> } = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    // Pine: fill between T3 Slow (plot3) and T3 Fast (plot0), colored by T3 relationship
    fills: [
      { plot1: 'plot0', plot2: 'plot3', options: { color: 'rgba(100, 181, 246, 0.20)' } },
    ],
    markers,
    barColors,
  };

  if (haCandles) {
    result.plotCandles = { ha: haCandles };
  }

  return result;
}

export const T3Psar = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
