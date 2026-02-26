/**
 * Gann High Low
 *
 * SMA-based trend direction indicator. Uses SMA of highs and SMA of lows
 * to determine trend direction, then plots the appropriate SMA level.
 *
 * Reference: TradingView "Gann High Low" by KivancOzbilgic
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface GannHighLowInputs {
  highLength: number;
  lowLength: number;
}

export const defaultInputs: GannHighLowInputs = {
  highLength: 13,
  lowLength: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'highLength', type: 'int', title: 'High Length', defval: 13, min: 1 },
  { id: 'lowLength', type: 'int', title: 'Low Length', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'GannHL', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Gann High Low',
  shortTitle: 'GannHL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<GannHighLowInputs> = {}): IndicatorResult {
  const { highLength, lowLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const smaHighArr = ta.sma(highSeries, highLength).toArray();
  const smaLowArr = ta.sma(lowSeries, lowLength).toArray();

  const warmup = Math.max(highLength, lowLength);

  // Direction: true = up, false = down
  const direction: boolean[] = new Array(n);
  const gannHL: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      direction[i] = true;
      gannHL[i] = NaN;
      continue;
    }

    const prevSmaHigh = i > 0 ? (smaHighArr[i - 1] ?? 0) : 0;
    const prevSmaLow = i > 0 ? (smaLowArr[i - 1] ?? 0) : 0;
    const close = bars[i].close;
    const prevDir = i > 0 ? direction[i - 1] : true;

    if (close > prevSmaHigh) {
      direction[i] = true;
    } else if (close < prevSmaLow) {
      direction[i] = false;
    } else {
      direction[i] = prevDir;
    }

    gannHL[i] = direction[i] ? (smaLowArr[i] ?? NaN) : (smaHighArr[i] ?? NaN);
  }

  const plot = gannHL.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = direction[i] ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot },
  };
}

export const GannHighLow = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
