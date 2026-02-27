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
import type { BarColorData } from '../types';

export interface CMVixFixV3Inputs {
  length: number;
  bbLen: number;
  bbMult: number;
  percentile: number;
  lookbackPct: number;
  pctHighest: number;
  ltLB: number;
  mtLB: number;
  str: number;
}

export const defaultInputs: CMVixFixV3Inputs = {
  length: 22,
  bbLen: 20,
  bbMult: 2.0,
  percentile: 95,
  lookbackPct: 50,
  pctHighest: 0.85,
  ltLB: 40,
  mtLB: 14,
  str: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'WVF Length', defval: 22, min: 1 },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'percentile', type: 'int', title: 'Percentile', defval: 95, min: 1, max: 100 },
  { id: 'lookbackPct', type: 'int', title: 'Pct Lookback', defval: 50, min: 1 },
  { id: 'pctHighest', type: 'float', title: 'Pct Highest', defval: 0.85, min: 0.01, max: 0.99, step: 0.01 },
  { id: 'ltLB', type: 'int', title: 'Long-Term LB', defval: 40, min: 1 },
  { id: 'mtLB', type: 'int', title: 'Medium-Term LB', defval: 14, min: 1 },
  { id: 'str', type: 'int', title: 'Entry Strength', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WVF', color: '#787B86', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Upper Band', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'WVF Active', color: '#00E676', lineWidth: 2 },
  { id: 'plot3', title: 'WVF Was True', color: '#00BCD4', lineWidth: 2 },
  { id: 'plot4', title: 'Filtered Entry', color: '#E040FB', lineWidth: 2 },
  { id: 'plot5', title: 'Aggressive Entry', color: '#FF9800', lineWidth: 2 },
];

export const metadata = {
  title: 'CM Williams Vix Fix V3',
  shortTitle: 'VixFixV3',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CMVixFixV3Inputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { length, bbLen, bbMult, percentile, lookbackPct, pctHighest, ltLB, mtLB, str } = { ...defaultInputs, ...inputs };
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

  // Compute per-bar upperBand and rangeHigh for alert logic
  const upperBandArr: number[] = new Array(n);
  const rangeHighArr: number[] = new Array(n);
  // Use lookbackPct/pctHighest for rangeHigh (Pine: lb=50, ph=0.85)
  const wvfHighestPct = ta.highest(wvfSeries, lookbackPct).toArray();
  for (let i = 0; i < n; i++) {
    upperBandArr[i] = (midLine[i] ?? 0) + bbMult * (sDev[i] ?? 0);
    rangeHighArr[i] = (wvfHighestPct[i] ?? 0) * pctHighest;
  }

  // Alert signals (Pine: alert1-4)
  const alert1Arr: number[] = new Array(n).fill(0); // WVF active
  const alert2Arr: number[] = new Array(n).fill(0); // WVF was true, now false
  const alert3Arr: number[] = new Array(n).fill(0); // Filtered entry
  const alert4Arr: number[] = new Array(n).fill(0); // Aggressive filtered entry

  for (let i = warmup; i < n; i++) {
    const wvf = wvfArr[i];
    const ub = upperBandArr[i];
    const rh = rangeHighArr[i];
    const isActive = wvf >= ub || wvf >= rh;

    // alert1: WVF is currently active
    alert1Arr[i] = isActive ? 1 : 0;

    // alert2: WVF was true on prev bar, now false
    if (i > 0) {
      const prevWvf = wvfArr[i - 1];
      const prevUb = upperBandArr[i - 1];
      const prevRh = rangeHighArr[i - 1];
      const wasActive = prevWvf >= prevUb || prevWvf >= prevRh;
      alert2Arr[i] = (wasActive && !isActive) ? 1 : 0;
    }

    // Filtered entry criteria (Pine):
    // upRange = low > low[1] and close > high[1]
    // filtered = (wvf[1] >= upperBand[1] or wvf[1] >= rangeHigh[1]) and (wvf < upperBand and wvf < rangeHigh)
    // alert3 = upRange and close > close[str] and (close < close[ltLB] or close < close[mtLB]) and filtered
    if (i >= Math.max(str, ltLB, mtLB) + 1) {
      const upRange = bars[i].low > bars[i - 1].low && bars[i].close > bars[i - 1].high;
      const prevWvf2 = wvfArr[i - 1];
      const prevUb2 = upperBandArr[i - 1];
      const prevRh2 = rangeHighArr[i - 1];
      const filtered = (prevWvf2 >= prevUb2 || prevWvf2 >= prevRh2) && (wvf < ub && wvf < rh);
      const closeStr = bars[i].close > bars[i - str].close;
      const closeLt = bars[i].close < bars[i - ltLB].close || bars[i].close < bars[i - mtLB].close;
      alert3Arr[i] = (upRange && closeStr && closeLt && filtered) ? 1 : 0;

      // Aggressive filtered (Pine):
      // upRange_Aggr = close > close[1] and close > open[1]
      // filtered_Aggr = (wvf[1] >= upperBand[1] or wvf[1] >= rangeHigh[1]) and not (wvf < upperBand and wvf < rangeHigh)
      const upRangeAggr = bars[i].close > bars[i - 1].close && bars[i].close > bars[i - 1].open;
      const filteredAggr = (prevWvf2 >= prevUb2 || prevWvf2 >= prevRh2) && !(wvf < ub && wvf < rh);
      alert4Arr[i] = (upRangeAggr && closeStr && closeLt && filteredAggr) ? 1 : 0;
    }
  }

  const plot2 = alert1Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v === 1 ? v : NaN),
  }));
  const plot3 = alert2Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v === 1 ? v : NaN),
  }));
  const plot4 = alert3Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v === 1 ? v : NaN),
  }));
  const plot5 = alert4Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v === 1 ? v : NaN),
  }));

  // barcolor: lime when WVF alert is active (wvf >= upperBand or wvf >= rangeHigh)
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    if (alert1Arr[i] === 1) {
      barColors.push({ time: bars[i].time, color: '#00E676' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4, 'plot5': plot5 },
    barColors,
  };
}

export const CMVixFixV3 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
