/**
 * CM Parabolic SAR
 *
 * Parabolic SAR with color coding. Green when SAR below price (bullish),
 * red when SAR above price (bearish).
 *
 * Reference: TradingView "CM_Parabolic SAR" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CMParabolicSARInputs {
  start: number;
  increment: number;
  maxVal: number;
}

export const defaultInputs: CMParabolicSARInputs = {
  start: 0.02,
  increment: 0.02,
  maxVal: 0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'start', type: 'float', title: 'Start', defval: 0.02, min: 0.001, step: 0.001 },
  { id: 'increment', type: 'float', title: 'Increment', defval: 0.02, min: 0.001, step: 0.001 },
  { id: 'maxVal', type: 'float', title: 'Max Value', defval: 0.2, min: 0.01, step: 0.01 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SAR', color: '#2962FF', lineWidth: 1, style: 'cross' },
];

export const metadata = {
  title: 'CM Parabolic SAR',
  shortTitle: 'CMSAR',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMParabolicSARInputs> = {}): IndicatorResult {
  const { start, increment, maxVal } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Manual SAR calculation
  const sarArr: number[] = new Array(n);
  let isLong = true;
  let af = start;
  let ep = bars[0]?.high ?? 0;
  let sar = bars[0]?.low ?? 0;

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      sarArr[i] = sar;
      continue;
    }

    const prevSar = sar;

    // Update SAR
    sar = prevSar + af * (ep - prevSar);

    if (isLong) {
      // Ensure SAR doesn't exceed prior lows
      sar = Math.min(sar, bars[i - 1].low);
      if (i >= 2) sar = Math.min(sar, bars[i - 2].low);

      if (bars[i].low < sar) {
        // Flip to short
        isLong = false;
        sar = ep;
        ep = bars[i].low;
        af = start;
      } else {
        if (bars[i].high > ep) {
          ep = bars[i].high;
          af = Math.min(af + increment, maxVal);
        }
      }
    } else {
      // Ensure SAR doesn't go below prior highs
      sar = Math.max(sar, bars[i - 1].high);
      if (i >= 2) sar = Math.max(sar, bars[i - 2].high);

      if (bars[i].high > sar) {
        // Flip to long
        isLong = true;
        sar = ep;
        ep = bars[i].high;
        af = start;
      } else {
        if (bars[i].low < ep) {
          ep = bars[i].low;
          af = Math.min(af + increment, maxVal);
        }
      }
    }

    sarArr[i] = sar;
  }

  const plot0 = sarArr.map((v, i) => {
    const color = v < bars[i].close ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: i < 2 ? NaN : v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const CMParabolicSAR = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
