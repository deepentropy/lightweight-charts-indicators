/**
 * ATR+ Stop Loss Indicator
 *
 * ATR-based stop loss with trailing long and short stops.
 * Long stop = close - mult*ATR, Short stop = close + mult*ATR.
 * Stops trail in favorable direction only.
 *
 * Reference: TradingView "ATR+ Stop Loss Indicator" (community)
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ATRPlusInputs {
  length: number;
  mult: number;
}

export const defaultInputs: ATRPlusInputs = {
  length: 14,
  mult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Stop', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Short Stop', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'ATR+ Stop Loss Indicator',
  shortTitle: 'ATR+',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ATRPlusInputs> = {}): IndicatorResult {
  const { length, mult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, length).toArray();

  const longStopArr: number[] = new Array(n);
  const shortStopArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const atrVal = (atrArr[i] ?? 0) * mult;
    const close = bars[i].close;
    let longStop = close - atrVal;
    let shortStop = close + atrVal;

    if (i === 0) {
      longStopArr[i] = longStop;
      shortStopArr[i] = shortStop;
      dirArr[i] = 1;
      continue;
    }

    const prevLongStop = longStopArr[i - 1];
    const prevShortStop = shortStopArr[i - 1];
    const prevDir = dirArr[i - 1];

    // Trail long stop up only
    if (close > prevLongStop) {
      longStop = Math.max(longStop, prevLongStop);
    }
    // Trail short stop down only
    if (close < prevShortStop) {
      shortStop = Math.min(shortStop, prevShortStop);
    }

    // Direction
    if (close > prevShortStop) {
      dirArr[i] = 1;
    } else if (close < prevLongStop) {
      dirArr[i] = -1;
    } else {
      dirArr[i] = prevDir;
    }

    longStopArr[i] = longStop;
    shortStopArr[i] = shortStop;
  }

  const warmup = length;

  const plot0 = longStopArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (dirArr[i] === 1 ? v : NaN),
  }));
  const plot1 = shortStopArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (dirArr[i] === -1 ? v : NaN),
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const ATRPlus = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
