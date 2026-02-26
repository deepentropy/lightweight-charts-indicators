/**
 * Nick Rypock Trailing Reverse (NRTR)
 *
 * ATR-based dynamic trailing reverse indicator.
 * In uptrend, trail = max(prev_trail, close - k*ATR).
 * If close < trail, flip to downtrend (and vice versa).
 * Two plot series: green for uptrend, red for downtrend.
 *
 * Reference: TradingView "Nick Rypock Trailing Reverse" (TV#479)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface NRTRInputs {
  atrPeriod: number;
  mult: number;
}

export const defaultInputs: NRTRInputs = {
  atrPeriod: 14,
  mult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 14, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'NRTR Up', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'NRTR Down', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Nick Rypock Trailing Reverse',
  shortTitle: 'NRTR',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<NRTRInputs> = {}): IndicatorResult {
  const { atrPeriod, mult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, atrPeriod).toArray();

  const trailArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n); // 1 = up, -1 = down

  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const rawAtr = atrArr[i];
    const atrVal = (rawAtr != null && !isNaN(rawAtr) ? rawAtr : 0) * mult;

    if (i === 0 || atrVal === 0) {
      trailArr[i] = close;
      dirArr[i] = 1;
      continue;
    }

    const prevTrail = trailArr[i - 1];
    const prevDir = dirArr[i - 1];

    if (prevDir === 1) {
      // Uptrend: trail ratchets up
      const newTrail = close - atrVal;
      trailArr[i] = Math.max(prevTrail, newTrail);
      if (close < trailArr[i]) {
        dirArr[i] = -1;
        trailArr[i] = close + atrVal;
      } else {
        dirArr[i] = 1;
      }
    } else {
      // Downtrend: trail ratchets down
      const newTrail = close + atrVal;
      trailArr[i] = Math.min(prevTrail, newTrail);
      if (close > trailArr[i]) {
        dirArr[i] = 1;
        trailArr[i] = close - atrVal;
      } else {
        dirArr[i] = -1;
      }
    }
  }

  const warmup = atrPeriod;

  const plot0 = trailArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || dirArr[i] !== 1) ? NaN : v,
  }));

  const plot1 = trailArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || dirArr[i] !== -1) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const NRTR = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
