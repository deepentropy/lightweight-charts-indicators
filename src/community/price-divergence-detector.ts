/**
 * Price Divergence Detector V3
 *
 * Fractal-based divergence detection supporting multiple oscillator methods
 * (RSI, MACD, Stochastic, CCI, BB %B, Fisher Transform, Volume).
 * Uses 5-bar fractal pattern to identify pivot points, then compares
 * consecutive fractal values for regular and hidden divergences.
 *
 * Reference: TradingView "Price Divergence Detector V3" by JustUncleL
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface PriceDivergenceDetectorInputs {
  method: string;
  length: number;
  showLabels: boolean;
  showChannel: boolean;
  showHidden: boolean;
  showRegular: boolean;
  macdFast: number;
  macdSlow: number;
  macdSmooth: number;
}

export const defaultInputs: PriceDivergenceDetectorInputs = {
  method: 'RSI',
  length: 20,
  showLabels: true,
  showChannel: false,
  showHidden: true,
  showRegular: true,
  macdFast: 12,
  macdSlow: 26,
  macdSmooth: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'method', type: 'string', title: 'Divergence Method', defval: 'RSI', options: ['RSI', 'MACD', 'Stochastic', 'CCI', 'BB %B', 'Fisher Transform', 'Volume'] },
  { id: 'length', type: 'int', title: 'Indicator Length', defval: 20, min: 1 },
  { id: 'showLabels', type: 'bool', title: 'Show Labels', defval: true },
  { id: 'showChannel', type: 'bool', title: 'Show Channel', defval: false },
  { id: 'showHidden', type: 'bool', title: 'Show Hidden Divergence', defval: true },
  { id: 'showRegular', type: 'bool', title: 'Show Regular Divergence', defval: true },
  { id: 'macdFast', type: 'int', title: 'MACD Fast', defval: 12, min: 1 },
  { id: 'macdSlow', type: 'int', title: 'MACD Slow', defval: 26, min: 1 },
  { id: 'macdSmooth', type: 'int', title: 'MACD Signal', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'High Fractal', color: '#C0C0C0', lineWidth: 0 },
  { id: 'plot1', title: 'Low Fractal', color: '#C0C0C0', lineWidth: 0 },
];

export const metadata = {
  title: 'Price Divergence Detector',
  shortTitle: 'Div Detect',
  overlay: true,
};

/**
 * 5-bar top fractal: src[4] < src[2] && src[3] < src[2] && src[2] > src[1] && src[2] > src[0]
 * Centered on [2], so at bar i we check the pattern ending at i (meaning center is i-2).
 */
function isTopFractal(arr: number[], i: number): boolean {
  if (i < 4) return false;
  const s0 = arr[i], s1 = arr[i - 1], s2 = arr[i - 2], s3 = arr[i - 3], s4 = arr[i - 4];
  if (isNaN(s0) || isNaN(s1) || isNaN(s2) || isNaN(s3) || isNaN(s4)) return false;
  return s4 < s2 && s3 < s2 && s2 > s1 && s2 > s0;
}

function isBottomFractal(arr: number[], i: number): boolean {
  if (i < 4) return false;
  const s0 = arr[i], s1 = arr[i - 1], s2 = arr[i - 2], s3 = arr[i - 3], s4 = arr[i - 4];
  if (isNaN(s0) || isNaN(s1) || isNaN(s2) || isNaN(s3) || isNaN(s4)) return false;
  return s4 > s2 && s3 > s2 && s2 < s1 && s2 < s0;
}

function computeOscillator(
  bars: Bar[], method: string, length: number, macdFast: number, macdSlow: number, macdSmooth: number
): { oscHigh: number[]; oscLow: number[] } {
  const n = bars.length;
  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const volumeSeries = new Series(bars, (b) => b.volume ?? 0);

  switch (method) {
    case 'RSI': {
      const rsiH = ta.rsi(highSeries, length).toArray().map((v) => v ?? NaN);
      const rsiL = ta.rsi(lowSeries, length).toArray().map((v) => v ?? NaN);
      return { oscHigh: rsiH, oscLow: rsiL };
    }
    case 'MACD': {
      // SMA-based MACD per JustUncleL's implementation
      const smaFastH = ta.sma(highSeries, macdFast).toArray();
      const smaSlowH = ta.sma(highSeries, macdSlow).toArray();
      const smaFastL = ta.sma(lowSeries, macdFast).toArray();
      const smaSlowL = ta.sma(lowSeries, macdSlow).toArray();
      const oscHigh: number[] = new Array(n);
      const oscLow: number[] = new Array(n);
      for (let i = 0; i < n; i++) {
        oscHigh[i] = (smaFastH[i] ?? NaN) - (smaSlowH[i] ?? NaN);
        oscLow[i] = (smaFastL[i] ?? NaN) - (smaSlowL[i] ?? NaN);
      }
      return { oscHigh, oscLow };
    }
    case 'Stochastic': {
      const rawK = ta.stoch(closeSeries, highSeries, lowSeries, length);
      const kArr = ta.sma(rawK, 3).toArray().map((v) => v ?? NaN);
      return { oscHigh: kArr, oscLow: kArr };
    }
    case 'CCI': {
      const cciH = ta.cci(highSeries, length).toArray().map((v) => v ?? NaN);
      const cciL = ta.cci(lowSeries, length).toArray().map((v) => v ?? NaN);
      return { oscHigh: cciH, oscLow: cciL };
    }
    case 'BB %B': {
      // Bollinger Band %B: (price - lower) / (upper - lower), using mult=0.1
      const [, upperH, lowerH] = ta.bb(highSeries, length, 0.1);
      const [, upperL, lowerL] = ta.bb(lowSeries, length, 0.1);
      const upperHArr = upperH.toArray();
      const lowerHArr = lowerH.toArray();
      const upperLArr = upperL.toArray();
      const lowerLArr = lowerL.toArray();
      const oscHigh: number[] = new Array(n);
      const oscLow: number[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const uH = upperHArr[i] ?? NaN, lH = lowerHArr[i] ?? NaN;
        const uL = upperLArr[i] ?? NaN, lL = lowerLArr[i] ?? NaN;
        const rangeH = uH - lH;
        const rangeL = uL - lL;
        oscHigh[i] = rangeH === 0 ? NaN : (bars[i].high - lH) / rangeH;
        oscLow[i] = rangeL === 0 ? NaN : (bars[i].low - lL) / rangeL;
      }
      return { oscHigh, oscLow };
    }
    case 'Fisher Transform': {
      // Fisher Transform: hl2 normalized to [-1,1] range over length bars, then fisher = 0.5*ln((1+v)/(1-v))
      const hl2: number[] = bars.map((b) => (b.high + b.low) / 2);
      const oscHigh: number[] = new Array(n).fill(NaN);
      const oscLow: number[] = new Array(n).fill(NaN);
      let val1 = 0, fish1 = 0;
      for (let i = 0; i < n; i++) {
        if (i < length - 1) continue;
        let maxH = -Infinity, minL = Infinity;
        for (let j = i - length + 1; j <= i; j++) {
          if (hl2[j] > maxH) maxH = hl2[j];
          if (hl2[j] < minL) minL = hl2[j];
        }
        const range = maxH - minL;
        const norm = range === 0 ? 0 : 0.66 * ((hl2[i] - minL) / range - 0.5) + 0.67 * val1;
        val1 = Math.max(-0.999, Math.min(0.999, norm));
        const fish = 0.5 * Math.log((1 + val1) / (1 - val1)) + 0.5 * fish1;
        fish1 = fish;
        oscHigh[i] = fish;
        oscLow[i] = fish;
      }
      return { oscHigh, oscLow };
    }
    case 'Volume': {
      const volSmoothed = ta.sma(volumeSeries, length).toArray().map((v) => v ?? NaN);
      return { oscHigh: volSmoothed, oscLow: volSmoothed };
    }
    default: {
      const rsiH = ta.rsi(highSeries, length).toArray().map((v) => v ?? NaN);
      const rsiL = ta.rsi(lowSeries, length).toArray().map((v) => v ?? NaN);
      return { oscHigh: rsiH, oscLow: rsiL };
    }
  }
}

export function calculate(bars: Bar[], inputs: Partial<PriceDivergenceDetectorInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { method, length, showLabels, showChannel, showHidden, showRegular, macdFast, macdSlow, macdSmooth } =
    { ...defaultInputs, ...inputs };

  const n = bars.length;
  const { oscHigh, oscLow } = computeOscillator(bars, method, length, macdFast, macdSlow, macdSmooth);

  const highArr = bars.map((b) => b.high);
  const lowArr = bars.map((b) => b.low);

  // Track previous fractal values for divergence comparison
  let prevTopOsc = NaN, prevTopPrice = NaN;
  let prevBotOsc = NaN, prevBotPrice = NaN;

  const markers: MarkerData[] = [];
  const highFractalPlot: { time: number; value: number; color?: string }[] = new Array(n);
  const lowFractalPlot: { time: number; value: number; color?: string }[] = new Array(n);

  for (let i = 0; i < n; i++) {
    highFractalPlot[i] = { time: bars[i].time, value: NaN };
    lowFractalPlot[i] = { time: bars[i].time, value: NaN };
  }

  const warmup = Math.max(length, 30);

  for (let i = 4; i < n; i++) {
    const centerBar = i - 2; // fractal center

    // Top fractal detection (bearish divergence check)
    if (isTopFractal(oscHigh, i)) {
      const curOsc = oscHigh[centerBar];
      const curPrice = highArr[centerBar];
      let fractalColor = '#C0C0C0'; // silver default

      if (!isNaN(prevTopOsc) && centerBar >= warmup) {
        // Regular bearish: price HH but osc LH
        if (showRegular && curPrice > prevTopPrice && curOsc < prevTopOsc) {
          fractalColor = '#800000'; // maroon
          if (showLabels) {
            markers.push({ time: bars[centerBar].time, position: 'aboveBar', shape: 'labelDown', color: '#800000', text: 'R' });
          }
        }
        // Hidden bearish: price LH but osc HH
        if (showHidden && curPrice < prevTopPrice && curOsc > prevTopOsc) {
          fractalColor = '#800000';
          if (showLabels) {
            markers.push({ time: bars[centerBar].time, position: 'aboveBar', shape: 'labelDown', color: '#800000', text: 'H' });
          }
        }
      }

      highFractalPlot[centerBar] = { time: bars[centerBar].time, value: highArr[centerBar], color: fractalColor };
      prevTopOsc = curOsc;
      prevTopPrice = curPrice;
    }

    // Bottom fractal detection (bullish divergence check)
    if (isBottomFractal(oscLow, i)) {
      const curOsc = oscLow[centerBar];
      const curPrice = lowArr[centerBar];
      let fractalColor = '#C0C0C0';

      if (!isNaN(prevBotOsc) && centerBar >= warmup) {
        // Regular bullish: price LL but osc HL
        if (showRegular && curPrice < prevBotPrice && curOsc > prevBotOsc) {
          fractalColor = '#008000'; // green
          if (showLabels) {
            markers.push({ time: bars[centerBar].time, position: 'belowBar', shape: 'labelUp', color: '#008000', text: 'R' });
          }
        }
        // Hidden bullish: price HL but osc LL
        if (showHidden && curPrice > prevBotPrice && curOsc < prevBotOsc) {
          fractalColor = '#008000';
          if (showLabels) {
            markers.push({ time: bars[centerBar].time, position: 'belowBar', shape: 'labelUp', color: '#008000', text: 'H' });
          }
        }
      }

      lowFractalPlot[centerBar] = { time: bars[centerBar].time, value: lowArr[centerBar], color: fractalColor };
      prevBotOsc = curOsc;
      prevBotPrice = curPrice;
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': highFractalPlot, 'plot1': lowFractalPlot },
    markers,
  };
}

export const PriceDivergenceDetector = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
