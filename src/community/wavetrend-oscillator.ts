/**
 * WaveTrend Oscillator + Divergence + Direction Detection
 *
 * LazyBear-style WaveTrend with overbought/oversold levels,
 * histogram, directional coloring, buy/sell signals at OB/OS
 * crosses, and fractal-based regular/hidden divergence detection.
 *
 * Reference: TradingView "WaveTrend Oscillator" by LazyBear
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface WavetrendOscillatorInputs {
  channelLength: number;
  avgLength: number;
  obLevel: number;
  osLevel: number;
  showDivergences: boolean;
}

export const defaultInputs: WavetrendOscillatorInputs = {
  channelLength: 10,
  avgLength: 21,
  obLevel: 53,
  osLevel: -53,
  showDivergences: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'channelLength', type: 'int', title: 'Channel Length', defval: 10, min: 1 },
  { id: 'avgLength', type: 'int', title: 'Average Length', defval: 21, min: 1 },
  { id: 'obLevel', type: 'int', title: 'OB Level', defval: 53 },
  { id: 'osLevel', type: 'int', title: 'OS Level', defval: -53 },
  { id: 'showDivergences', type: 'bool', title: 'Show Divergences', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'wt1', title: 'WT1', color: '#26A69A', lineWidth: 1 },
  { id: 'wt2', title: 'WT2', color: '#FF9800', lineWidth: 1 },
  { id: 'histogram', title: 'Histogram', color: '#009BBA', lineWidth: 4, style: 'histogram' },
  { id: 'zero', title: 'Zero', color: '#787B86', lineWidth: 1 },
  { id: 'ob', title: 'Overbought', color: '#EF5350', lineWidth: 1 },
  { id: 'os', title: 'Oversold', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'WaveTrend Oscillator',
  shortTitle: 'WT',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<WavetrendOscillatorInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // ap = hlc3
  const ap = new Series(bars, (b) => (b.high + b.low + b.close) / 3);
  const apArr = ap.toArray().map(v => v ?? NaN);

  // esa = EMA(ap, channelLength)
  const esaArr = ta.ema(ap, cfg.channelLength).toArray().map(v => v ?? NaN);

  // d = EMA(abs(ap - esa), channelLength)
  const absDiff: number[] = apArr.map((v, i) => Math.abs(v - esaArr[i]));
  const absDiffSeries = new Series(
    absDiff.map((v, i) => ({ time: bars[i].time, open: v, high: v, low: v, close: v, volume: 0 }) as unknown as Bar),
    (b) => b.close,
  );
  const dArr = ta.ema(absDiffSeries, cfg.channelLength).toArray().map(v => v ?? NaN);

  // ci = (ap - esa) / (0.015 * d)
  const ci: number[] = apArr.map((v, i) => {
    const dv = dArr[i];
    if (isNaN(dv) || dv === 0) return 0;
    return (v - esaArr[i]) / (0.015 * dv);
  });

  // wt1 = EMA(ci, avgLength)
  const ciSeries = new Series(
    ci.map((v, i) => ({ time: bars[i].time, open: v, high: v, low: v, close: v, volume: 0 }) as unknown as Bar),
    (b) => b.close,
  );
  const wt1Arr = ta.ema(ciSeries, cfg.avgLength).toArray().map(v => v ?? NaN);

  // wt2 = SMA(wt1, 4)
  const wt1Series = new Series(
    wt1Arr.map((v, i) => ({ time: bars[i].time, open: v, high: v, low: v, close: v, volume: 0 }) as unknown as Bar),
    (b) => b.close,
  );
  const wt2Arr = ta.sma(wt1Series, 4).toArray().map(v => v ?? NaN);

  // histogram = wt1 - wt2
  const histArr: number[] = wt1Arr.map((v, i) => v - wt2Arr[i]);

  // Direction: rising(wt1,1) ? 1 : falling(wt1,1) ? -1 : prev direction
  const direction: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    if (isNaN(wt1Arr[i])) { direction[i] = direction[i - 1]; continue; }
    if (wt1Arr[i] > wt1Arr[i - 1]) {
      direction[i] = 1;
    } else if (wt1Arr[i] < wt1Arr[i - 1]) {
      direction[i] = -1;
    } else {
      direction[i] = direction[i - 1];
    }
  }

  const warmup = cfg.channelLength + cfg.avgLength;

  // Buy/Sell signals
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  for (let i = 1; i < n; i++) {
    if (i < warmup || isNaN(wt1Arr[i]) || isNaN(wt2Arr[i])) continue;

    const w1 = wt1Arr[i];
    const w1p = wt1Arr[i - 1];
    const w2 = wt2Arr[i];
    const w2p = wt2Arr[i - 1];

    // Sell: crossunder(wt1, wt2) AND wt1 >= obLevel
    const sellCross = w1p >= w2p && w1 < w2;
    const isSell = sellCross && w1 >= cfg.obLevel;

    // Buy: crossover(wt1, wt2) AND wt1 <= osLevel
    const buyCross = w1p <= w2p && w1 > w2;
    const isBuy = buyCross && w1 <= cfg.osLevel;

    if (isBuy) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'circle', color: '#26A69A', text: 'Buy' });
      barColors.push({ time: bars[i].time, color: '#26A69A' });
    } else if (isSell) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'circle', color: '#EF5350', text: 'Sell' });
      barColors.push({ time: bars[i].time, color: '#EF5350' });
    }
  }

  // --- Fractal-based divergences ---
  if (cfg.showDivergences) {
    // Track fractal highs/lows for wt1 and price
    // Top fractal: src[4] < src[2] && src[3] < src[2] && src[2] > src[1] && src[2] > src[0]
    // (evaluated at i, fractal point is at i-2)
    let prevTopWt = NaN;
    let prevTopPrice = NaN;
    let prevBotWt = NaN;
    let prevBotPrice = NaN;

    for (let i = 4; i < n; i++) {
      if (i - 2 < warmup) continue;
      const w = wt1Arr;
      const h = bars.map(b => b.high);
      const l = bars.map(b => b.low);

      // Top fractal at i-2
      const isTopFractal = w[i - 4] < w[i - 2] && w[i - 3] < w[i - 2] &&
                           w[i - 2] > w[i - 1] && w[i - 2] > w[i];

      // Bottom fractal at i-2
      const isBotFractal = w[i - 4] > w[i - 2] && w[i - 3] > w[i - 2] &&
                           w[i - 2] < w[i - 1] && w[i - 2] < w[i];

      if (isTopFractal && !isNaN(prevTopWt)) {
        const curWt = w[i - 2];
        const curPrice = h[i - 2];
        // Regular bearish: price higher high but wt1 lower high
        if (curPrice > prevTopPrice && curWt < prevTopWt && curWt >= cfg.obLevel) {
          markers.push({ time: bars[i - 2].time, position: 'aboveBar', shape: 'diamond', color: '#EF5350', text: 'Bear Div' });
        }
        // Hidden bearish: price lower high but wt1 higher high
        if (curPrice < prevTopPrice && curWt > prevTopWt && curWt >= cfg.obLevel) {
          markers.push({ time: bars[i - 2].time, position: 'aboveBar', shape: 'diamond', color: '#FF9800', text: 'H.Bear' });
        }
      }

      if (isBotFractal && !isNaN(prevBotWt)) {
        const curWt = w[i - 2];
        const curPrice = l[i - 2];
        // Regular bullish: price lower low but wt1 higher low
        if (curPrice < prevBotPrice && curWt > prevBotWt && curWt <= cfg.osLevel) {
          markers.push({ time: bars[i - 2].time, position: 'belowBar', shape: 'diamond', color: '#26A69A', text: 'Bull Div' });
        }
        // Hidden bullish: price higher low but wt1 lower low
        if (curPrice > prevBotPrice && curWt < prevBotWt && curWt <= cfg.osLevel) {
          markers.push({ time: bars[i - 2].time, position: 'belowBar', shape: 'diamond', color: '#FF9800', text: 'H.Bull' });
        }
      }

      // Update previous fractal values
      if (isTopFractal) {
        prevTopWt = w[i - 2];
        prevTopPrice = h[i - 2];
      }
      if (isBotFractal) {
        prevBotWt = w[i - 2];
        prevBotPrice = l[i - 2];
      }
    }
  }

  // --- Build plot arrays ---
  const wt1Plot = wt1Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: direction[i] === 1 ? '#26A69A' : '#EF5350',
  }));

  const wt2Plot = wt2Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const histPlot = histArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: '#009BBA',
  }));

  const zeroPlot = bars.map(b => ({ time: b.time, value: 0 }));
  const obPlot = bars.map(b => ({ time: b.time, value: cfg.obLevel }));
  const osPlot = bars.map(b => ({ time: b.time, value: cfg.osLevel }));

  // Fill: OB zone (red transparent above obLevel), OS zone (green transparent below osLevel)
  const fillOBColors = wt1Arr.map((v, i) => {
    if (i < warmup || isNaN(v)) return 'transparent';
    return v > cfg.obLevel ? 'rgba(239,83,80,0.15)' : 'transparent';
  });
  const fillOSColors = wt1Arr.map((v, i) => {
    if (i < warmup || isNaN(v)) return 'transparent';
    return v < cfg.osLevel ? 'rgba(38,166,154,0.15)' : 'transparent';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      wt1: wt1Plot,
      wt2: wt2Plot,
      histogram: histPlot,
      zero: zeroPlot,
      ob: obPlot,
      os: osPlot,
    },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
      { value: cfg.obLevel, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'OB' } },
      { value: cfg.osLevel, options: { color: '#26A69A', linestyle: 'dashed' as const, title: 'OS' } },
    ],
    fills: [
      { plot1: 'wt1', plot2: 'ob', colors: fillOBColors },
      { plot1: 'os', plot2: 'wt1', colors: fillOSColors },
    ],
    markers,
    barColors,
  };
}

export const WavetrendOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
