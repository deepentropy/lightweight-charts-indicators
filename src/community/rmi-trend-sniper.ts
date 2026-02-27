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
import type { BarColorData, PlotCandleData } from '../types';

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

  // Track positive/negative state like Pine: positive when RMI crosses above obLevel, negative when below osLevel
  // Pine: p_mom triggers when rsi_mfi crosses above pmom with rising EMA(close,5)
  // Pine: n_mom triggers when rsi_mfi < nmom with falling EMA(close,5)
  const ema5 = ta.ema(close, 5).toArray();
  let positive = false;
  let negative = false;
  const posArr: boolean[] = new Array(n);
  const negArr: boolean[] = new Array(n);

  for (let i = warmup; i < n; i++) {
    const u = rmaUp[i] ?? 0;
    const d = rmaDown[i] ?? 0;
    const rmi = d === 0 ? 100 : 100 - 100 / (1 + u / d);
    const prevU = i > 0 ? (rmaUp[i - 1] ?? 0) : 0;
    const prevD = i > 0 ? (rmaDown[i - 1] ?? 0) : 0;
    const prevRmi = prevD === 0 ? 100 : 100 - 100 / (1 + prevU / prevD);

    const emaChange = (ema5[i] ?? 0) - (ema5[i - 1] ?? 0);

    // p_mom: rmi[1] < obLevel and rmi > obLevel and rmi > osLevel and change(ema5) > 0
    const pMom = prevRmi < obLevel && rmi > obLevel && rmi > osLevel && emaChange > 0;
    // n_mom: rmi < osLevel and change(ema5) < 0
    const nMom = rmi < osLevel && emaChange < 0;

    if (pMom) { positive = true; negative = false; }
    if (nMom) { positive = false; negative = true; }

    posArr[i] = positive;
    negArr[i] = negative;
  }

  // barcolor: green when positive, red when negative (Pine: barcolor(Barcol) where Barcol = positive ? green : red)
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    barColors.push({
      time: bars[i].time,
      color: posArr[i] ? '#26A69A' : '#EF5350',
    });
  }

  // plotcandle: overlay candles colored by trend (Pine: plotcandle(open,high,low,close,color=Barcol,...))
  const candles: PlotCandleData[] = [];
  for (let i = warmup; i < n; i++) {
    const col = posArr[i] ? '#26A69A' : '#EF5350';
    candles.push({
      time: bars[i].time,
      open: bars[i].open,
      high: bars[i].high,
      low: bars[i].low,
      close: bars[i].close,
      color: col,
      borderColor: col,
      wickColor: col,
    });
  }

  // fills: between RMI ob/os hlines (Pine fills are between RWMA bands - approximated with hline fill)
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: obLevel, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: osLevel, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    fills: [
      { plot1: 'obLevel', plot2: 'osLevel', options: { color: 'rgba(33, 150, 243, 0.05)' } },
    ],
    barColors,
    plotCandles: { candle0: candles },
  } as IndicatorResult & { barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> };
}

export const RMITrendSniper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
