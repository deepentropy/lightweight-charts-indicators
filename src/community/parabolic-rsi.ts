/**
 * Parabolic RSI
 *
 * Parabolic SAR logic applied to RSI values instead of price.
 * Compute RSI, then run SAR-style trailing stop on the RSI series.
 *
 * Reference: TradingView "Parabolic RSI" (TV#507)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ParabolicRSIInputs {
  rsiLen: number;
  sarStart: number;
  sarInc: number;
  sarMax: number;
  upperThreshold: number;
  lowerThreshold: number;
}

export const defaultInputs: ParabolicRSIInputs = {
  rsiLen: 14,
  sarStart: 0.02,
  sarInc: 0.02,
  sarMax: 0.2,
  upperThreshold: 70,
  lowerThreshold: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'sarStart', type: 'float', title: 'SAR Start', defval: 0.02, min: 0.0001, step: 0.01 },
  { id: 'sarInc', type: 'float', title: 'SAR Increment', defval: 0.02, min: 0.0001, step: 0.01 },
  { id: 'sarMax', type: 'float', title: 'SAR Max', defval: 0.2, min: 0.01, step: 0.01 },
  { id: 'upperThreshold', type: 'int', title: 'Threshold Upper', defval: 70, min: 1, max: 100 },
  { id: 'lowerThreshold', type: 'int', title: 'Threshold Lower', defval: 30, min: 1, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'PSAR', color: '#FF6D00', lineWidth: 1, style: 'cross' },
];

export const metadata = {
  title: 'Parabolic RSI',
  shortTitle: 'PRSI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ParabolicRSIInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLen, sarStart, sarInc, sarMax, upperThreshold, lowerThreshold } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = getSourceSeries(bars, 'close');
  const rsiArr = ta.rsi(close, rsiLen).toArray();

  // SAR applied to RSI values
  const psarArr: number[] = new Array(n).fill(NaN);
  const isLongArr: boolean[] = new Array(n).fill(true);
  const warmup = rsiLen + 1;

  // Find first valid RSI pair to initialize
  let startIdx = -1;
  for (let i = warmup; i < n; i++) {
    if (rsiArr[i] != null && !isNaN(rsiArr[i]!) && rsiArr[i - 1] != null && !isNaN(rsiArr[i - 1]!)) {
      startIdx = i;
      break;
    }
  }

  if (startIdx >= 0 && startIdx < n) {
    // Initialize SAR state
    let isLong = rsiArr[startIdx]! >= rsiArr[startIdx - 1]!;
    let af = sarStart;
    let ep = isLong ? rsiArr[startIdx]! : rsiArr[startIdx]!;
    let sar = isLong ? 0 : 100; // start at extremes for RSI

    for (let i = startIdx; i < n; i++) {
      const rsi = rsiArr[i];
      if (rsi == null || isNaN(rsi)) {
        psarArr[i] = NaN;
        isLongArr[i] = isLong;
        continue;
      }

      // Check for reversal
      if (isLong) {
        if (rsi < sar) {
          // Reverse to short
          isLong = false;
          sar = ep;
          ep = rsi;
          af = sarStart;
        }
      } else {
        if (rsi > sar) {
          // Reverse to long
          isLong = true;
          sar = ep;
          ep = rsi;
          af = sarStart;
        }
      }

      psarArr[i] = sar;
      isLongArr[i] = isLong;

      // Update EP and AF
      if (isLong) {
        if (rsi > ep) {
          ep = rsi;
          af = Math.min(af + sarInc, sarMax);
        }
      } else {
        if (rsi < ep) {
          ep = rsi;
          af = Math.min(af + sarInc, sarMax);
        }
      }

      // Advance SAR
      sar = sar + af * (ep - sar);

      // Clamp SAR for long: must be below recent lows (RSI values)
      if (isLong) {
        const prev1 = i > 0 && rsiArr[i - 1] != null ? rsiArr[i - 1]! : rsi;
        const prev2 = i > 1 && rsiArr[i - 2] != null ? rsiArr[i - 2]! : prev1;
        sar = Math.min(sar, prev1, prev2);
      } else {
        const prev1 = i > 0 && rsiArr[i - 1] != null ? rsiArr[i - 1]! : rsi;
        const prev2 = i > 1 && rsiArr[i - 2] != null ? rsiArr[i - 2]! : prev1;
        sar = Math.max(sar, prev1, prev2);
      }
    }
  }

  // Markers: diamond at SAR reversal points
  // sig_up: isBelow flips to true (bullish reversal), sig_dn: flips to false (bearish reversal)
  // Normal signals: sig_up when sar >= lowerThreshold, sig_dn when sar <= upperThreshold
  // Strong signals: s_sig_up when sar <= lowerThreshold, s_sig_dn when sar >= upperThreshold
  const markers: MarkerData[] = [];
  for (let i = 1; i < n; i++) {
    if (isNaN(psarArr[i]) || isNaN(psarArr[i - 1])) continue;
    const sigUp = isLongArr[i] && !isLongArr[i - 1];
    const sigDn = !isLongArr[i] && isLongArr[i - 1];
    const sarVal = psarArr[i];
    const sarColor = isLongArr[i] ? '#EEA47F' : '#00539C';

    if (sigUp) {
      // Pine: plotshape(sig_up and sar_rsi >= lower_ ? sar_rsi : na) - normal signal diamond
      if (sarVal >= lowerThreshold) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'diamond', color: sarColor, text: 'Up' });
      }
      // Pine: s_sig_up = isBelow flips true AND sar_rsi <= lower_ - strong signal
      if (sarVal <= lowerThreshold) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'diamond', color: sarColor, text: 'Strong Up', size: 2 });
      }
    } else if (sigDn) {
      // Pine: plotshape(sig_dn and sar_rsi <= upper_ ? sar_rsi : na) - normal signal diamond
      if (sarVal <= upperThreshold) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: sarColor, text: 'Dn' });
      }
      // Pine: s_sig_dn = isBelow flips false AND sar_rsi >= upper_ - strong signal
      if (sarVal >= upperThreshold) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'diamond', color: sarColor, text: 'Strong Dn', size: 2 });
      }
    }
  }

  const plot0 = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = psarArr.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
  }));

  // Fill between RSI and midline (50): overbought gradient above upper, oversold gradient below lower
  // Pine: fill(rsiPlot, midLinePlot, 100, upper_, top: red, bottom: orange) and fill(rsiPlot, midLinePlot, lower_, 0, top: orange, bottom: red)
  // Simplified: fill between RSI plot and hline at 50 with dynamic colors
  const fillColors: string[] = [];
  for (let i = 0; i < n; i++) {
    const rsi = rsiArr[i];
    if (rsi == null || isNaN(rsi) || i < warmup) {
      fillColors.push('rgba(0,0,0,0)');
    } else if (rsi >= upperThreshold) {
      fillColors.push('rgba(239,83,80,0.2)');
    } else if (rsi <= lowerThreshold) {
      fillColors.push('rgba(255,152,0,0.2)');
    } else {
      fillColors.push('rgba(194,146,87,0.1)');
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(194,146,87,0.1)' }, colors: fillColors }],
    hlines: [
      { value: upperThreshold, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: lowerThreshold, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Middle' } },
    ],
    markers,
  };
}

export const ParabolicRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
