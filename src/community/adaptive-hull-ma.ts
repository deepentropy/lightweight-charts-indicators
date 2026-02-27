/**
 * 72s: Adaptive Hull Moving Average+
 *
 * Dynamic HMA with adaptive length based on volatility or volume.
 * When volatility is high (ATR(14) > ATR(46)) or volume breaks above average,
 * the HMA length shrinks toward minLength; otherwise it expands toward maxLength.
 * A slope angle is calculated to color the MA:
 *   - Strong trend (|slope| >= flat threshold) + active charger = bright color
 *   - Strong trend + inactive charger = light color
 *   - Consolidation (|slope| < flat threshold) = yellow
 * Also plots a faster minor HMA+ with the same adaptive logic.
 *
 * Reference: TradingView "72s: Adaptive Hull Moving Average+" by io72signals
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';

export interface AdaptiveHullMAInputs {
  charger: string;
  minLength: number;
  maxLength: number;
  flat: number;
  showMinor: boolean;
  minorMin: number;
  minorMax: number;
}

export const defaultInputs: AdaptiveHullMAInputs = {
  charger: 'Volatility',
  minLength: 172,
  maxLength: 233,
  flat: 17,
  showMinor: true,
  minorMin: 89,
  minorMax: 121,
};

export const inputConfig: InputConfig[] = [
  { id: 'charger', type: 'string', title: 'Charger', defval: 'Volatility', options: ['Volatility', 'Volume'] },
  { id: 'minLength', type: 'int', title: 'Minimum Period', defval: 172, min: 2 },
  { id: 'maxLength', type: 'int', title: 'Maximum Period', defval: 233, min: 2 },
  { id: 'flat', type: 'int', title: 'Consolidation Slope Threshold', defval: 17, min: 1 },
  { id: 'showMinor', type: 'bool', title: 'Show Minor HMA+', defval: true },
  { id: 'minorMin', type: 'int', title: 'Minor Minimum', defval: 89, min: 2 },
  { id: 'minorMax', type: 'int', title: 'Minor Maximum', defval: 121, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Dynamic HMA+', color: '#6fbf73', lineWidth: 3 },
  { id: 'plot1', title: 'Minor HMA+', color: '#6fbf73', lineWidth: 1 },
];

export const metadata = {
  title: '72s: Adaptive Hull Moving Average+',
  shortTitle: 'AHMA+',
  overlay: true,
};

/**
 * Compute WMA over a raw number array for a given length, returning a single value
 * using the last `length` elements ending at index `endIdx`.
 */
function wmaAt(arr: number[], endIdx: number, length: number): number {
  const len = Math.max(1, Math.floor(length));
  if (endIdx < len - 1) return NaN;
  let num = 0;
  let den = 0;
  for (let j = 0; j < len; j++) {
    const w = len - j;
    const val = arr[endIdx - j];
    if (isNaN(val)) return NaN;
    num += val * w;
    den += w;
  }
  return num / den;
}

/**
 * Compute HMA for a raw number array at a specific index with a given (possibly fractional) length.
 * HMA(src, len) = WMA(2*WMA(src, len/2) - WMA(src, len), floor(sqrt(len)))
 */
function hmaAt(arr: number[], endIdx: number, length: number): number {
  const halfLen = Math.max(1, Math.floor(length / 2));
  const fullLen = Math.max(1, Math.floor(length));
  const sqrtLen = Math.max(1, Math.floor(Math.sqrt(length)));

  // We need to compute the intermediate series 2*WMA(half) - WMA(full) for sqrtLen bars
  // ending at endIdx
  const needed = sqrtLen;
  const intermediate: number[] = new Array(needed);
  for (let k = 0; k < needed; k++) {
    const idx = endIdx - (needed - 1 - k);
    if (idx < 0) return NaN;
    const wHalf = wmaAt(arr, idx, halfLen);
    const wFull = wmaAt(arr, idx, fullLen);
    if (isNaN(wHalf) || isNaN(wFull)) return NaN;
    intermediate[k] = 2 * wHalf - wFull;
  }

  // WMA of intermediate
  let num = 0;
  let den = 0;
  for (let j = 0; j < needed; j++) {
    const w = needed - j;
    const val = intermediate[needed - 1 - j];
    if (isNaN(val)) return NaN;
    num += val * w;
    den += w;
  }
  return num / den;
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveHullMAInputs> = {}): IndicatorResult {
  const { charger, minLength, maxLength, flat, showMinor, minorMin, minorMax } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const adaptPct = 0.03141;

  // Precompute charger signals
  const atr14 = ta.atr(bars, 14).toArray();
  const atr46 = ta.atr(bars, 46).toArray();

  // Volume charger: rsi(volume, 14) smoothed by hma(10), then > 49
  const volSeries = Series.fromBars(bars, 'volume');
  const rsiVol = ta.rsi(volSeries, 14);
  const oscArr = ta.hma(rsiVol, 10).toArray();

  const plugged: boolean[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (charger === 'Volume') {
      const o = oscArr[i];
      plugged[i] = !isNaN(o) && o > 49;
    } else {
      const a14 = atr14[i];
      const a46 = atr46[i];
      plugged[i] = !isNaN(a14) && !isNaN(a46) && a14 > a46;
    }
  }

  // Adaptive dynamic lengths
  const dynamicLengths: number[] = new Array(n);
  const minorLengths: number[] = new Array(n);
  let dynLen = (minLength + maxLength) / 2;
  let minLen = (minorMin + minorMax) / 2;

  for (let i = 0; i < n; i++) {
    if (plugged[i]) {
      dynLen = Math.max(minLength, dynLen * (1 - adaptPct));
      minLen = Math.max(minorMin, minLen * (1 - adaptPct));
    } else {
      dynLen = Math.min(maxLength, dynLen * (1 + adaptPct));
      minLen = Math.min(minorMax, minLen * (1 + adaptPct));
    }
    dynamicLengths[i] = dynLen;
    minorLengths[i] = minLen;
  }

  // Compute close array
  const closeArr = bars.map(b => b.close);

  // Compute adaptive HMA values bar-by-bar
  const dynamicHMA: number[] = new Array(n);
  const minorHMA: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    dynamicHMA[i] = hmaAt(closeArr, i, dynamicLengths[i]);
    minorHMA[i] = showMinor ? hmaAt(closeArr, i, minorLengths[i]) : NaN;
  }

  // Slope calculation
  const slopePeriod = 34;
  const slopeRange = 25;
  const pi = Math.PI;

  // Precompute highest(high, 34) and lowest(low, 34) for slope_range
  const highSeries = Series.fromBars(bars, 'high');
  const lowSeries = Series.fromBars(bars, 'low');
  const hhArr = ta.highest(highSeries, slopePeriod).toArray();
  const llArr = ta.lowest(lowSeries, slopePeriod).toArray();

  function calcSlope(maArr: number[], i: number): number {
    if (i < 2) return 0;
    const ma0 = maArr[i];
    const ma2 = maArr[i - 2];
    if (isNaN(ma0) || isNaN(ma2)) return 0;
    const hh = hhArr[i];
    const ll = llArr[i];
    if (isNaN(hh) || isNaN(ll) || hh === ll) return 0;
    const sr = slopeRange / (hh - ll) * ll;
    const dt = (ma2 - ma0) / closeArr[i] * sr;
    const c = Math.sqrt(1 + dt * dt);
    const xAngle = Math.round(180 * Math.acos(1 / c) / pi);
    return dt > 0 ? -xAngle : xAngle;
  }

  // Color logic
  function dynColor(slope: number, isPlugged: boolean): string {
    if (slope >= flat) {
      return isPlugged ? '#6fbf73' : '#c0f5ae'; // up: bright green / light green
    } else if (slope <= -flat) {
      return isPlugged ? '#eb4d5c' : '#f2b1d4'; // down: bright red / light pink
    }
    return '#FFD700'; // yellow - consolidation
  }

  const warmup = Math.max(maxLength, slopePeriod + 2);

  // Precompute ATR for signal positioning
  const atr5 = ta.atr(bars, 5).toArray();

  // Precompute slopes for dynamic HMA
  const dynSlopes: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    dynSlopes[i] = calcSlope(dynamicHMA, i);
  }

  const plot0 = dynamicHMA.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = dynColor(dynSlopes[i], plugged[i]);
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = minorHMA.map((v, i) => {
    if (!showMinor || i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const slope = calcSlope(minorHMA, i);
    const color = dynColor(slope, plugged[i]);
    return { time: bars[i].time, value: v, color };
  });

  // Markers: buy/sell signals, fast exits, warning signs (from Pine plotchar)
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const slope = dynSlopes[i];
    const prevSlope = dynSlopes[i - 1];
    const atrPos = 0.72 * (atr5[i] ?? 0);

    // Buy: slope >= flat and plugged, first bar of condition
    const upSig = slope >= flat && plugged[i];
    const prevUpSig = prevSlope >= flat && plugged[i - 1];
    if (upSig && !prevUpSig) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#00FF00', text: 'BUY' });
    }

    // Sell: slope <= -flat and plugged, first bar of condition
    const dnSig = slope <= -flat && plugged[i];
    const prevDnSig = prevSlope <= -flat && plugged[i - 1];
    if (dnSig && !prevDnSig) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FF0000', text: 'SELL' });
    }

    // Fast exits (minor HMA based)
    if (showMinor && !isNaN(minorHMA[i])) {
      const _upExit = slope >= flat && !plugged[i] && bars[i].close < minorHMA[i];
      const prevUpExit = prevSlope >= flat && !plugged[i - 1] && bars[i - 1].close < minorHMA[i - 1];
      const _dnExit = slope <= -flat && !plugged[i] && bars[i].close > minorHMA[i];
      const prevDnExit = prevSlope <= -flat && !plugged[i - 1] && bars[i - 1].close > minorHMA[i - 1];
      if ((_upExit && !prevUpExit) || (_dnExit && !prevDnExit)) {
        const exitColor = _upExit ? '#00FF00' : '#FF0000';
        markers.push({ time: bars[i].time, position: 'inBar', shape: 'xcross', color: exitColor, text: 'Exit' });
      }
    }
  }

  // Background colors: consolidation/low volatility shading (from Pine bgcolor)
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < n; i++) {
    const notGreat = dynSlopes[i] < flat && dynSlopes[i] > -flat;
    if (!plugged[i]) {
      bgColors.push({
        time: bars[i].time,
        color: notGreat ? 'rgba(117,119,121,0.40)' : 'rgba(175,180,185,0.40)',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    markers,
    bgColors,
  } as IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] };
}

export const AdaptiveHullMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
