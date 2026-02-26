/**
 * Parabolic RSI
 *
 * Parabolic SAR logic applied to RSI values instead of price.
 * Compute RSI, then run SAR-style trailing stop on the RSI series.
 *
 * Reference: TradingView "Parabolic RSI" (TV#507)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface ParabolicRSIInputs {
  rsiLen: number;
  sarStart: number;
  sarInc: number;
  sarMax: number;
}

export const defaultInputs: ParabolicRSIInputs = {
  rsiLen: 14,
  sarStart: 0.02,
  sarInc: 0.02,
  sarMax: 0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'sarStart', type: 'float', title: 'SAR Start', defval: 0.02, min: 0.0001, step: 0.01 },
  { id: 'sarInc', type: 'float', title: 'SAR Increment', defval: 0.02, min: 0.0001, step: 0.01 },
  { id: 'sarMax', type: 'float', title: 'SAR Max', defval: 0.2, min: 0.01, step: 0.01 },
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

export function calculate(bars: Bar[], inputs: Partial<ParabolicRSIInputs> = {}): IndicatorResult {
  const { rsiLen, sarStart, sarInc, sarMax } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = getSourceSeries(bars, 'close');
  const rsiArr = ta.rsi(close, rsiLen).toArray();

  // SAR applied to RSI values
  const psarArr: number[] = new Array(n).fill(NaN);
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

  const plot0 = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = psarArr.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
      { value: 50, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Middle' } },
    ],
  };
}

export const ParabolicRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
