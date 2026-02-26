/**
 * Average True Range Trailing Stops Colored
 *
 * ATR trailing stop with trend coloring.
 * Green in uptrend (price above stop), red in downtrend (price below stop).
 * Stop ratchets in favorable direction only.
 *
 * Reference: TradingView "Average True Range Trailing Stops Colored" (community)
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ATRTrailingColoredInputs {
  length: number;
  mult: number;
}

export const defaultInputs: ATRTrailingColoredInputs = {
  length: 14,
  mult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trailing Stop', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Average True Range Trailing Stops Colored',
  shortTitle: 'ATRTSC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ATRTrailingColoredInputs> = {}): IndicatorResult {
  const { length, mult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, length).toArray();

  const stopArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const nLoss = mult * (atrArr[i] ?? 0);
    const close = bars[i].close;

    if (i === 0) {
      stopArr[i] = close - nLoss;
      dirArr[i] = 1;
      continue;
    }

    const prevStop = stopArr[i - 1];
    const prevClose = bars[i - 1].close;

    if (close > prevStop && prevClose > prevStop) {
      // Uptrend continuation
      stopArr[i] = Math.max(prevStop, close - nLoss);
      dirArr[i] = 1;
    } else if (close < prevStop && prevClose < prevStop) {
      // Downtrend continuation
      stopArr[i] = Math.min(prevStop, close + nLoss);
      dirArr[i] = -1;
    } else if (close > prevStop) {
      // Flip to uptrend
      stopArr[i] = close - nLoss;
      dirArr[i] = 1;
    } else {
      // Flip to downtrend
      stopArr[i] = close + nLoss;
      dirArr[i] = -1;
    }
  }

  const warmup = length;
  const plot0 = stopArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const ATRTrailingColored = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
