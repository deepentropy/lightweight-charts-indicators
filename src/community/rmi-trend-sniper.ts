/**
 * RMI Trend Sniper
 *
 * Relative Momentum Index: RSI variant using change(close, momLen) instead of change(close, 1).
 * up = max(0, close - close[momLen]), down = max(0, close[momLen] - close), then RMA smooth.
 * RMI = 100 - 100 / (1 + RMA(up, rmiLen) / RMA(down, rmiLen))
 *
 * Reference: TradingView "RMI Trend Sniper" (TV#596)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RMITrendSniperInputs {
  rmiLen: number;
  momLen: number;
  obLevel: number;
  osLevel: number;
}

export const defaultInputs: RMITrendSniperInputs = {
  rmiLen: 14,
  momLen: 5,
  obLevel: 70,
  osLevel: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'rmiLen', type: 'int', title: 'RMI Length', defval: 14, min: 1 },
  { id: 'momLen', type: 'int', title: 'Momentum Length', defval: 5, min: 1 },
  { id: 'obLevel', type: 'int', title: 'Overbought', defval: 70, min: 1, max: 100 },
  { id: 'osLevel', type: 'int', title: 'Oversold', defval: 30, min: 1, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RMI', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'RMI Trend Sniper',
  shortTitle: 'RMI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RMITrendSniperInputs> = {}): IndicatorResult {
  const { rmiLen, momLen, obLevel, osLevel } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);
  const closeArr = close.toArray();

  // Compute up/down arrays based on momentum change
  const upArr: number[] = new Array(n);
  const downArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < momLen || closeArr[i] == null || closeArr[i - momLen] == null) {
      upArr[i] = 0;
      downArr[i] = 0;
    } else {
      const diff = closeArr[i]! - closeArr[i - momLen]!;
      upArr[i] = Math.max(0, diff);
      downArr[i] = Math.max(0, -diff);
    }
  }

  const upSeries = Series.fromArray(bars, upArr);
  const downSeries = Series.fromArray(bars, downArr);
  const rmaUp = ta.rma(upSeries, rmiLen).toArray();
  const rmaDown = ta.rma(downSeries, rmiLen).toArray();

  const warmup = momLen + rmiLen;

  const plot0 = bars.map((bar, i) => {
    if (i < warmup || rmaUp[i] == null || rmaDown[i] == null) {
      return { time: bar.time, value: NaN };
    }
    const u = rmaUp[i]!;
    const d = rmaDown[i]!;
    const rmi = d === 0 ? 100 : 100 - 100 / (1 + u / d);
    return { time: bar.time, value: rmi };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: obLevel, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: osLevel, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const RMITrendSniper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
