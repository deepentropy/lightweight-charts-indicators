/**
 * RedK EVEREX - Effort Versus Results Explorer v2.0
 *
 * Compares volume "effort" against price "result" using 6 price strength
 * components (bar closing, spread-to-range, relative spread, 2-bar closing,
 * 2-bar shift-to-range, 2-bar relative shift). Normalizes volume and price
 * via EMA, then computes bulls/bears RSI-like index (RROF).
 * Bias/Sentiment from longer-period RROF. EVEREX equalizer histogram
 * with 4-color scheme. Markers for EoM (Ease of Move) and Compression.
 *
 * Reference: TradingView "RedK EVEREX v2.0" by RedKTrader
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface RedkEverexInputs {
  length: number;
  smooth: number;
  sigLength: number;
  lookback: number;
  biasLength: number;
  showMarkers: boolean;
}

export const defaultInputs: RedkEverexInputs = {
  length: 10,
  smooth: 3,
  sigLength: 5,
  lookback: 20,
  biasLength: 30,
  showMarkers: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'RoF Length', defval: 10, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smooth', defval: 3, min: 1 },
  { id: 'sigLength', type: 'int', title: 'Signal Length', defval: 5, min: 1 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 20, min: 1 },
  { id: 'biasLength', type: 'int', title: 'Bias Length', defval: 30, min: 1 },
  { id: 'showMarkers', type: 'bool', title: 'Show EVEREX Markers', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RROF Smooth', color: '#b2b5be', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#00FFFF', lineWidth: 3 },
  { id: 'plot2', title: 'Bias', color: '#00aa00', lineWidth: 4, style: 'area' },
  { id: 'plot3', title: 'Zero', color: '#1163f6', lineWidth: 1 },
];

export const metadata = {
  title: 'RedK EVEREX',
  shortTitle: 'EVEREX',
  overlay: false,
};

/**
 * Pine Normalize() equivalent: maps value/avg ratio to discrete bands.
 */
function normalize(value: number, avg: number): number {
  if (avg === 0 || isNaN(avg)) return 0.1;
  const x = value / avg;
  if (x > 1.50) return 1.00;
  if (x > 1.20) return 0.90;
  if (x > 1.00) return 0.80;
  if (x > 0.80) return 0.70;
  if (x > 0.60) return 0.60;
  if (x > 0.40) return 0.50;
  if (x > 0.20) return 0.25;
  return 0.1;
}

export function calculate(bars: Bar[], inputs: Partial<RedkEverexInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, smooth, sigLength, lookback, biasLength, showMarkers } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Extract arrays
  const openArr = bars.map(b => b.open);
  const highArr = bars.map(b => b.high);
  const lowArr = bars.map(b => b.low);
  const closeArr = bars.map(b => b.close);
  const volArr = bars.map(b => (b.volume != null && !isNaN(b.volume)) ? b.volume : 1);
  const noVol = bars.map(b => b.volume == null || isNaN(b.volume));

  // Highest(2) and lowest(2) for 2-bar range
  const highSeries = new Series(bars, b => b.high);
  const lowSeries = new Series(bars, b => b.low);
  const highest2 = ta.highest(highSeries, 2).toArray();
  const lowest2 = ta.lowest(lowSeries, 2).toArray();

  // SMA of volume over lookback
  const volSeries = Series.fromArray(bars, volArr);
  const volAvgArr = ta.sma(volSeries, lookback).toArray();

  // Change of close (1-bar)
  const closeSeries = new Series(bars, b => b.close);
  const srcShiftArr = ta.change(closeSeries, 1).toArray();

  // SMA of abs(barSpread) and abs(srcShift) over lookback
  const barSpreadAbsArr: number[] = new Array(n);
  const srcShiftAbsArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    barSpreadAbsArr[i] = Math.abs(closeArr[i] - openArr[i]);
    srcShiftAbsArr[i] = Math.abs(srcShiftArr[i] != null ? srcShiftArr[i] : 0);
  }
  const barSpreadAbsSeries = Series.fromArray(bars, barSpreadAbsArr);
  const srcShiftAbsSeries = Series.fromArray(bars, srcShiftAbsArr);
  const barSpreadAvgArr = ta.sma(barSpreadAbsSeries, lookback).toArray();
  const srcShiftAvgArr = ta.sma(srcShiftAbsSeries, lookback).toArray();

  // Per-bar: compute 6 price strength components, volume normalization, bar_flow
  const barFlowArr: number[] = new Array(n);
  const nPriceArr: number[] = new Array(n);
  const nVolArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const o = openArr[i];
    const h = highArr[i];
    const l = lowArr[i];
    const c = closeArr[i];
    const barSpread = c - o;
    const barRange = h - l;
    const r2 = (highest2[i] ?? h) - (lowest2[i] ?? l);
    const srcShift = srcShiftArr[i] ?? 0;
    const signShift = srcShift > 0 ? 1 : srcShift < 0 ? -1 : 0;
    const signSpread = barSpread > 0 ? 1 : barSpread < 0 ? -1 : 0;

    // 1. Bar closing within bar
    const barclosing = barRange !== 0 ? 2 * (c - l) / barRange * 100 - 100 : 0;

    // 2. Spread to range ratio
    const s2r = barRange !== 0 ? barSpread / barRange * 100 : 0;

    // 3. Relative spread
    const bsAvg = barSpreadAvgArr[i] ?? 0;
    const barSpreadRatioN = bsAvg !== 0
      ? normalize(Math.abs(barSpread), bsAvg) * 100 * signSpread
      : 0;

    // 4. 2-bar closing
    const barclosing2 = r2 !== 0 ? 2 * (c - (lowest2[i] ?? l)) / r2 * 100 - 100 : 0;

    // 5. 2-bar shift to range
    const shift2BarToR2 = r2 !== 0 ? srcShift / r2 * 100 : 0;

    // 6. 2-bar relative shift
    const ssAvg = srcShiftAvgArr[i] ?? 0;
    const srcShiftRatioN = ssAvg !== 0
      ? normalize(Math.abs(srcShift), ssAvg) * 100 * signShift
      : 0;

    // Combined price strength
    const priceaN = (barclosing + s2r + barSpreadRatioN + barclosing2 + shift2BarToR2 + srcShiftRatioN) / 6;

    // Volume normalization
    const va = volAvgArr[i] ?? 0;
    const volaNPre = normalize(volArr[i], va) * 100;
    const volaN = noVol[i] ? 100 : volaNPre;

    // Bar flow = price strength * volume ratio
    barFlowArr[i] = priceaN * volaN / 100;

    // Store for markers
    nPriceArr[i] = Math.max(Math.min(priceaN, 100), -100);
    nVolArr[i] = Math.max(Math.min(volaN, 100), -100);
  }

  // Bulls / bears
  const bullsArr: number[] = new Array(n);
  const bearsArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    bullsArr[i] = Math.max(barFlowArr[i], 0);
    bearsArr[i] = -1 * Math.min(barFlowArr[i], 0);
  }

  const bullsSeries = Series.fromArray(bars, bullsArr);
  const bearsSeries = Series.fromArray(bars, bearsArr);

  // WMA averages for RROF
  const bullsAvgArr = ta.wma(bullsSeries, length).toArray();
  const bearsAvgArr = ta.wma(bearsSeries, length).toArray();

  // RROF = 2 * (100 - 100/(1+bulls_avg/bears_avg)) - 100
  const rrofArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ba = bullsAvgArr[i] ?? 0;
    const bea = bearsAvgArr[i] ?? 0;
    if (isNaN(ba) || isNaN(bea) || bea === 0) {
      rrofArr[i] = ba > 0 ? 100 : 0;
    } else {
      const dx = ba / bea;
      rrofArr[i] = 2 * (100 - 100 / (1 + dx)) - 100;
    }
  }

  // WMA smooth of RROF
  const rrofSeries = Series.fromArray(bars, rrofArr);
  const rrofSArr = ta.wma(rrofSeries, smooth).toArray();

  // Signal = WMA of RROF_s
  const rrofSSeries = Series.fromArray(bars, rrofSArr.map(v => v ?? 0));
  const signalArr = ta.wma(rrofSSeries, sigLength).toArray();

  // Bias: longer-period bulls/bears
  const bullsBiasArr = ta.wma(bullsSeries, biasLength).toArray();
  const bearsBiasArr = ta.wma(bearsSeries, biasLength).toArray();

  const rrofBArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ba = bullsBiasArr[i] ?? 0;
    const bea = bearsBiasArr[i] ?? 0;
    if (isNaN(ba) || isNaN(bea) || bea === 0) {
      rrofBArr[i] = ba > 0 ? 100 : 0;
    } else {
      const dx = ba / bea;
      rrofBArr[i] = 2 * (100 - 100 / (1 + dx)) - 100;
    }
  }

  const rrofBSeries = Series.fromArray(bars, rrofBArr);
  const rrofBsArr = ta.wma(rrofBSeries, smooth).toArray();

  const warmup = Math.max(lookback, length, biasLength) + smooth;

  // Plot 0: RROF_s (smoothed)
  const plot0 = rrofSArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
  }));

  // Plot 1: Signal line colored by direction
  const plot1 = signalArr.map((v, i) => {
    const rs = rrofSArr[i];
    const up = rs != null && !isNaN(rs) && rs >= 0;
    return {
      time: bars[i].time,
      value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
      color: up ? '#00FFFF' : '#FFA500',
    };
  });

  // Plot 2: Bias / Sentiment area
  const plot2 = rrofBsArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null || isNaN(v)) ? NaN : v,
    color: (v != null && !isNaN(v) && v >= 0) ? '#00aa0048' : '#ff180b48',
  }));

  // Plot 3: Zero line
  const plot3 = bars.map(b => ({ time: b.time, value: 0 }));

  // Markers: EoM and Compression
  const markers: MarkerData[] = [];
  if (showMarkers) {
    for (let i = 0; i < n; i++) {
      if (i < warmup) continue;
      const nP = nPriceArr[i];
      const nV = nVolArr[i];
      if (nV === 0) continue;
      const evRatio = 100 * Math.abs(nP) / nV;
      const isPositive = nP > 0;

      if (evRatio >= 120) {
        // Ease of Move
        markers.push({
          time: bars[i].time,
          position: isPositive ? 'belowBar' : 'aboveBar',
          shape: isPositive ? 'triangleUp' : 'triangleDown',
          color: isPositive ? '#00FF00' : '#FF0000',
          text: 'EoM',
        });
      } else if (evRatio <= 50) {
        // Compression
        markers.push({
          time: bars[i].time,
          position: 'inBar',
          shape: 'circle',
          color: isPositive ? '#00FF00' : '#FF0000',
          text: 'Comp',
        });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    hlines: [
      { value: 0, options: { color: '#1163f6', linestyle: 'solid' as const, title: 'Zero' } },
    ],
    markers,
  };
}

export const RedkEverex = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
