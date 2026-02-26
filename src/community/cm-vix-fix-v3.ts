/**
 * CM Williams Vix Fix V3 Ultimate
 *
 * Enhanced Williams Vix Fix with Bollinger Band and percentile alerting.
 * WVF = (highest(close, length) - low) / highest(close, length) * 100.
 * Alerts when WVF exceeds BB upper or percentile range high.
 *
 * Reference: TradingView "CM_Williams_Vix_Fix_V3_Ultimate" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface CMVixFixV3Inputs {
  length: number;
  bbLen: number;
  bbMult: number;
  percentile: number;
}

export const defaultInputs: CMVixFixV3Inputs = {
  length: 22,
  bbLen: 20,
  bbMult: 2.0,
  percentile: 95,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'WVF Length', defval: 22, min: 1 },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'percentile', type: 'int', title: 'Percentile', defval: 95, min: 1, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WVF', color: '#787B86', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Upper Band', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'CM Williams Vix Fix V3',
  shortTitle: 'VixFixV3',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CMVixFixV3Inputs> = {}): IndicatorResult {
  const { length, bbLen, bbMult, percentile } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const highestClose = ta.highest(closeSeries, length).toArray();

  // WVF
  const wvfArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const hc = highestClose[i];
    if (hc == null || hc === 0 || isNaN(hc)) {
      wvfArr[i] = 0;
    } else {
      wvfArr[i] = ((hc - bars[i].low) / hc) * 100;
    }
  }

  // BB on WVF
  const wvfSeries = new Series(bars, (_b, i) => wvfArr[i]);
  const midLine = ta.sma(wvfSeries, bbLen).toArray();
  const sDev = ta.stdev(wvfSeries, bbLen).toArray();

  // Range high for percentile threshold
  const wvfHighest = ta.highest(wvfSeries, bbLen).toArray();

  const warmup = Math.max(length, bbLen);

  const plot0 = wvfArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const upperBand = (midLine[i] ?? 0) + bbMult * (sDev[i] ?? 0);
    const rangeHigh = (wvfHighest[i] ?? 0) * (percentile / 100);
    const alert = v >= upperBand || v >= rangeHigh;
    const color = alert ? '#00E676' : '#787B86';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = bars.map((b, i) => {
    if (i < warmup || midLine[i] == null || sDev[i] == null) return { time: b.time, value: NaN };
    return { time: b.time, value: (midLine[i]!) + bbMult * (sDev[i]!) };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const CMVixFixV3 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
