/**
 * Radius Trend [ChartPrime]
 *
 * ATR-based trailing band with step-based radius adjustment.
 * Uses SMA of bar range as distance measure. Every n bars, the band
 * is adjusted by a stepped radius (increasing multiplier * distance1).
 * Trend flips when price crosses the band.
 *
 * Reference: TradingView "Radius Trend [ChartPrime]" by ChartPrime
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RadiusTrendInputs {
  step: number;
  multi: number;
}

export const defaultInputs: RadiusTrendInputs = {
  step: 0.15,
  multi: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'step', type: 'float', title: 'Radius Step', defval: 0.15, min: 0.001, step: 0.001 },
  { id: 'multi', type: 'float', title: 'Start Points Distance', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Radius Trend Band', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'Outer Band', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: 'HL2 SMA', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Radius Trend [ChartPrime]',
  shortTitle: 'RadTrend',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RadiusTrendInputs> = {}): IndicatorResult {
  const { step, multi } = { ...defaultInputs, ...inputs };
  const len = bars.length;
  const n = 3; // step interval (hardcoded in PineScript)

  // distance = sma(abs(high - low), 100) * multi
  const rangeSeries = new Series(bars, (b) => Math.abs(b.high - b.low));
  const smaRangeArr = ta.sma(rangeSeries, 100).toArray();

  // State variables (var in PineScript = persistent)
  let multi1 = 0;
  let multi2 = 0;
  let band = 0;
  let trend = true; // true = bullish

  const bandArr: number[] = new Array(len);
  const trendArr: boolean[] = new Array(len);

  const warmup = 101; // PineScript initializes on bar_index == 101

  for (let i = 0; i < len; i++) {
    const smaRange = smaRangeArr[i];
    if (isNaN(smaRange) || i < warmup) {
      // Before warmup, set initial state on bar 101
      if (i === warmup) {
        trend = true;
        band = bars[i].low * 0.8;
      }
      bandArr[i] = NaN;
      trendArr[i] = trend;
      continue;
    }

    const distance = smaRange * multi;
    const distance1 = smaRange * 0.2;
    const close = bars[i].close;

    // Update trend based on price relation to band
    if (close < band) trend = false;
    if (close > band) trend = true;

    // Detect trend change (ta.change(trend) = trend != trend[1])
    const prevTrend: boolean = i > 0 ? trendArr[i - 1] : trend;
    if (!prevTrend && prevTrend !== trend) {
      // Was bearish, now bullish
      band = bars[i].low - distance;
    }
    if (prevTrend && prevTrend !== trend) {
      // Was bullish, now bearish
      band = bars[i].high + distance;
    }

    // Apply step angle every n bars
    if (i % n === 0 && trend) {
      multi1 = 0;
      multi2 += step;
      band += distance1 * multi2;
    }
    if (i % n === 0 && !trend) {
      multi1 += step;
      multi2 = 0;
      band -= distance1 * multi1;
    }

    bandArr[i] = band;
    trendArr[i] = trend;
  }

  // Smooth the band: Sband = sma(band, n)
  const bandSeries = Series.fromArray(bars, bandArr);
  const sbandArr = ta.sma(bandSeries, n).toArray();

  // Upper and lower bands for outer display
  const bandUpperArr: number[] = new Array(len);
  const bandLowerArr: number[] = new Array(len);
  for (let i = 0; i < len; i++) {
    const smaRange = smaRangeArr[i];
    if (isNaN(smaRange) || isNaN(bandArr[i])) {
      bandUpperArr[i] = NaN;
      bandLowerArr[i] = NaN;
    } else {
      const distance = smaRange * multi;
      bandUpperArr[i] = bandArr[i] + distance * 0.5;
      bandLowerArr[i] = bandArr[i] - distance * 0.5;
    }
  }

  const bandUpperSeries = Series.fromArray(bars, bandUpperArr);
  const bandLowerSeries = Series.fromArray(bars, bandLowerArr);
  const smoothUpperArr = ta.sma(bandUpperSeries, n).toArray();
  const smoothLowerArr = ta.sma(bandLowerSeries, n).toArray();

  // plot0: smoothed band (Sband) with linebr on trend change
  const plot0 = sbandArr.map((v, i) => {
    if (i < warmup + n || isNaN(v)) return { time: bars[i].time, value: NaN };
    // linebr: NaN on trend change
    if (i > 0 && trendArr[i] !== trendArr[i - 1]) return { time: bars[i].time, value: NaN };
    const color = trendArr[i] ? '#54b6d4' : '#cf2b2b';
    return { time: bars[i].time, value: v, color };
  });

  // plot1: outer band (band1 = trend ? band_upper : band_lower), every other bar
  const plot1 = bars.map((b, i) => {
    if (i < warmup + n) return { time: b.time, value: NaN };
    const val = trendArr[i] ? smoothUpperArr[i] : smoothLowerArr[i];
    if (isNaN(val)) return { time: b.time, value: NaN };
    // PineScript plots every other bar (bar_index % 2 == 0)
    if (i % 2 !== 0) return { time: b.time, value: NaN };
    const color = trendArr[i] ? '#54b6d4' : '#cf2b2b';
    return { time: b.time, value: val, color };
  });

  // Hidden SMA of hl2 for fill reference (Pine: ta.sma(hl2, 20))
  const hl2Series = getSourceSeries(bars, 'hl2');
  const hl2SmaArr = ta.sma(hl2Series, 20).toArray();
  const plot2 = hl2SmaArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup + n || v == null || isNaN(v)) ? NaN : v,
  }));

  const fillColors = bars.map((_, i) => {
    if (i < warmup + n) return 'transparent';
    return trendArr[i] ? 'rgba(84,182,212,0.15)' : 'rgba(207,43,43,0.15)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [
      { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(84,182,212,0.15)' }, colors: fillColors },
    ],
  };
}

export const RadiusTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
