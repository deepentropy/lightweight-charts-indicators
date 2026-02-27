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
  lookbackPct: number;
  pctHighest: number;
  ltLB: number;
  mtLB: number;
  str: number;
  sbc: boolean;
  sbcc: boolean;
  sbcFilt: boolean;
  sbcAggr: boolean;
  sgb: boolean;
}

export const defaultInputs: CMVixFixV3Inputs = {
  length: 22,
  bbLen: 20,
  bbMult: 2.0,
  lookbackPct: 50,
  pctHighest: 0.85,
  ltLB: 40,
  mtLB: 14,
  str: 3,
  sbc: true,
  sbcc: false,
  sbcFilt: true,
  sbcAggr: false,
  sgb: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'WVF Length', defval: 22, min: 1 },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'lookbackPct', type: 'int', title: 'Pct Lookback', defval: 50, min: 1 },
  { id: 'pctHighest', type: 'float', title: 'Pct Highest', defval: 0.85, min: 0.01, max: 0.99, step: 0.01 },
  { id: 'ltLB', type: 'int', title: 'Long-Term LB', defval: 40, min: 1 },
  { id: 'mtLB', type: 'int', title: 'Medium-Term LB', defval: 14, min: 1 },
  { id: 'str', type: 'int', title: 'Entry Strength', defval: 3, min: 1 },
  { id: 'sbc', type: 'bool', title: 'Highlight WVF Was True Now False', defval: true },
  { id: 'sbcc', type: 'bool', title: 'Highlight WVF Is True', defval: false },
  { id: 'sbcFilt', type: 'bool', title: 'Highlight Filtered Entry', defval: true },
  { id: 'sbcAggr', type: 'bool', title: 'Highlight Aggressive Filtered Entry', defval: false },
  { id: 'sgb', type: 'bool', title: 'Turn All Bars Gray', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Williams Vix Fix', color: '#787B86', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Alert If WVF = True', color: '#00FF00', lineWidth: 2 },
  { id: 'plot2', title: 'Alert If WVF Was True Now False', color: '#00FFFF', lineWidth: 2 },
  { id: 'plot3', title: 'Alert Filtered Entry', color: '#FF00FF', lineWidth: 2 },
  { id: 'plot4', title: 'Alert Aggressive Filtered Entry', color: '#FFA500', lineWidth: 2 },
];

export const metadata = {
  title: 'CM Williams Vix Fix V3',
  shortTitle: 'VixFixV3',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CMVixFixV3Inputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { length, bbLen, bbMult, lookbackPct, pctHighest, ltLB, mtLB, str, sbc, sbcc, sbcFilt, sbcAggr, sgb } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const highestClose = ta.highest(closeSeries, length).toArray();

  // WVF = ((highest(close, pd) - low) / highest(close, pd)) * 100
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
  const sDevArr = ta.stdev(wvfSeries, bbLen).toArray();

  // Range high for percentile threshold: rangeHigh = highest(wvf, lb) * ph
  const wvfHighestPct = ta.highest(wvfSeries, lookbackPct).toArray();

  const warmup = Math.max(length, bbLen, lookbackPct);

  // Compute per-bar upperBand and rangeHigh
  const upperBandArr: number[] = new Array(n);
  const rangeHighArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    upperBandArr[i] = (midLine[i] ?? 0) + bbMult * (sDevArr[i] ?? 0);
    rangeHighArr[i] = (wvfHighestPct[i] ?? 0) * pctHighest;
  }

  // Alert signals (Pine: alert1-4)
  const alert1Arr: number[] = new Array(n).fill(0);
  const alert2Arr: number[] = new Array(n).fill(0);
  const alert3Arr: number[] = new Array(n).fill(0);
  const alert4Arr: number[] = new Array(n).fill(0);

  for (let i = warmup; i < n; i++) {
    const wvf = wvfArr[i];
    const ub = upperBandArr[i];
    const rh = rangeHighArr[i];

    // alert1: wvf >= upperBand or wvf >= rangeHigh
    const isActive = wvf >= ub || wvf >= rh;
    alert1Arr[i] = isActive ? 1 : 0;

    // alert2: (wvf[1] >= upperBand[1] or wvf[1] >= rangeHigh[1]) and (wvf < upperBand and wvf < rangeHigh)
    if (i > 0) {
      const prevWvf = wvfArr[i - 1];
      const prevUb = upperBandArr[i - 1];
      const prevRh = rangeHighArr[i - 1];
      const wasActive = prevWvf >= prevUb || prevWvf >= prevRh;
      alert2Arr[i] = (wasActive && !isActive) ? 1 : 0;
    }

    // Filtered entry criteria
    if (i >= Math.max(str, ltLB, mtLB) + 1) {
      // upRange = low > low[1] and close > high[1]
      const upRange = bars[i].low > bars[i - 1].low && bars[i].close > bars[i - 1].high;
      // filtered = ((wvf[1] >= upperBand[1] or wvf[1] >= rangeHigh[1]) and (wvf < upperBand and wvf < rangeHigh))
      const prevWvf2 = wvfArr[i - 1];
      const prevUb2 = upperBandArr[i - 1];
      const prevRh2 = rangeHighArr[i - 1];
      const filtered = (prevWvf2 >= prevUb2 || prevWvf2 >= prevRh2) && (wvf < ub && wvf < rh);
      const closeStr = bars[i].close > bars[i - str].close;
      const closeLt = bars[i].close < bars[i - ltLB].close || bars[i].close < bars[i - mtLB].close;
      // alert3 = upRange and close > close[str] and (close < close[ltLB] or close < close[mtLB]) and filtered
      alert3Arr[i] = (upRange && closeStr && closeLt && filtered) ? 1 : 0;

      // upRange_Aggr = close > close[1] and close > open[1]
      const upRangeAggr = bars[i].close > bars[i - 1].close && bars[i].close > bars[i - 1].open;
      // filtered_Aggr = (wvf[1] >= upperBand[1] or wvf[1] >= rangeHigh[1]) and not (wvf < upperBand and wvf < rangeHigh)
      const filteredAggr = (prevWvf2 >= prevUb2 || prevWvf2 >= prevRh2) && !(wvf < ub && wvf < rh);
      // alert4 = upRange_Aggr and close > close[str] and (close < close[ltLB] or close < close[mtLB]) and filtered_Aggr
      alert4Arr[i] = (upRangeAggr && closeStr && closeLt && filteredAggr) ? 1 : 0;
    }
  }

  // Pine: col = wvf >= upperBand or wvf >= rangeHigh ? lime : gray
  // Pine: plot(wvf * -1, style=columns, linewidth=4, color=col)
  const plot0 = wvfArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const isActive = v >= upperBandArr[i] || v >= rangeHighArr[i];
    const color = isActive ? '#00FF00' : '#808080';
    return { time: bars[i].time, value: v * -1, color };
  });

  // Pine: plot(sa1 and alert1 ? alert1 : 0, style=line, linewidth=2, color=lime)
  // Always show (sa1 defaults not toggled, but we always plot for display fidelity)
  const plot1 = alert1Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  // Pine: plot(sa2 and alert2 ? alert2 : 0, style=line, linewidth=2, color=aqua)
  const plot2 = alert2Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  // Pine: plot(sa3 and alert3 ? alert3 : 0, style=line, linewidth=2, color=fuchsia)
  const plot3 = alert3Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  // Pine: plot(sa4 and alert4 ? alert4 : 0, style=line, linewidth=2, color=orange)
  const plot4 = alert4Arr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  // barcolor: Pine applies multiple barcolor() calls; later calls override earlier.
  // Priority (lowest to highest): alert4 orange, alert3 fuchsia, alert2 aqua, alert1 lime
  // Each is gated by its boolean toggle (sbcAggr, sbcFilt, sbc, sbcc).
  // sgb = gray overrides everything when enabled.
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    let color: string | null = null;
    if (sbcAggr && alert4Arr[i] === 1) color = '#FFA500';  // orange
    if (sbcFilt && alert3Arr[i] === 1) color = '#FF00FF';  // fuchsia
    if (sbc && alert2Arr[i] === 1) color = '#00FFFF';      // aqua
    if (sbcc && alert1Arr[i] === 1) color = '#00FF00';      // lime
    if (sgb) color = '#808080';                              // gray overrides all
    if (color) {
      barColors.push({ time: bars[i].time, color });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4 },
    barColors,
  };
}

export const CMVixFixV3 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
