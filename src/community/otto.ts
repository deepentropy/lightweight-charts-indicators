/**
 * Optimized Trend Tracker Oscillator (OTTO)
 *
 * Plots HOTT (High OTT) and LOTT (Low OTT) as overlay lines with fill.
 * HOTT = adjusted OTT trailing stop, LOTT = VIDYA-ratio source.
 * Buy signal when LOTT crosses above HOTT, Sell when LOTT crosses below HOTT.
 *
 * Reference: TradingView "Optimized Trend Tracker Oscillator OTTO" by KivancOzbilgic
 */

import { getSourceSeries, Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface OTTOInputs {
  period: number;
  percent: number;
  fastVidyaLen: number;
  slowVidyaLen: number;
  correctingConst: number;
  src: SourceType;
}

export const defaultInputs: OTTOInputs = {
  period: 2,
  percent: 0.6,
  fastVidyaLen: 10,
  slowVidyaLen: 25,
  correctingConst: 100000,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'OTT Period', defval: 2, min: 1 },
  { id: 'percent', type: 'float', title: 'OTT Optimization Coeff', defval: 0.6, min: 0, step: 0.1 },
  { id: 'fastVidyaLen', type: 'int', title: 'Fast VIDYA Length', defval: 10, min: 1 },
  { id: 'slowVidyaLen', type: 'int', title: 'Slow VIDYA Length', defval: 25, min: 1 },
  { id: 'correctingConst', type: 'int', title: 'Correcting Constant', defval: 100000, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'hott', title: 'HOTT', color: '#FF0000', lineWidth: 2 },
  { id: 'lott', title: 'LOTT', color: '#0000FF', lineWidth: 2 },
];

export const metadata = {
  title: 'OTT Oscillator',
  shortTitle: 'OTTO',
  overlay: false,
};

// VAR (Variable Index Dynamic Average) calculation
function varFunc(srcArr: number[], length: number): number[] {
  const n = srcArr.length;
  const out: number[] = new Array(n);
  const valpha = 2 / (length + 1);

  for (let i = 0; i < n; i++) {
    const s = srcArr[i];
    let vUD = 0;
    let vDD = 0;
    for (let j = Math.max(0, i - 8); j <= i; j++) {
      const cur = srcArr[j];
      const prev = j > 0 ? srcArr[j - 1] : cur;
      if (cur > prev) vUD += cur - prev;
      if (cur < prev) vDD += prev - cur;
    }
    const vCMO = (vUD + vDD) === 0 ? 0 : (vUD - vDD) / (vUD + vDD);
    out[i] = i === 0 ? s : valpha * Math.abs(vCMO) * s + (1 - valpha * Math.abs(vCMO)) * out[i - 1];
  }
  return out;
}

export function calculate(bars: Bar[], inputs: Partial<OTTOInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { period, percent, fastVidyaLen, slowVidyaLen, correctingConst, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray().map(v => v ?? 0);

  // Pine: mov1 = Var_Func1(src1, slength/2), mov2 = Var_Func1(src1, slength), mov3 = Var_Func1(src1, slength*flength)
  const mov1 = varFunc(srcArr, Math.max(1, Math.floor(slowVidyaLen / 2)));
  const mov2 = varFunc(srcArr, slowVidyaLen);
  const mov3 = varFunc(srcArr, slowVidyaLen * fastVidyaLen);

  // Pine: src = mov1 / (mov2 - mov3 + coco)
  const normalizedSrc: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    normalizedSrc[i] = mov1[i] / (mov2[i] - mov3[i] + correctingConst);
  }

  // OTT on normalized source using VAR MA
  const mavg = varFunc(normalizedSrc, period);

  const fark = mavg.map(v => v * percent * 0.01);
  const longStop: number[] = new Array(n);
  const shortStop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const ott: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    longStop[i] = mavg[i] - fark[i];
    shortStop[i] = mavg[i] + fark[i];

    if (i > 0) {
      if (mavg[i] > longStop[i - 1]) longStop[i] = Math.max(longStop[i], longStop[i - 1]);
      if (mavg[i] < shortStop[i - 1]) shortStop[i] = Math.min(shortStop[i], shortStop[i - 1]);

      dir[i] = dir[i - 1];
      if (dir[i - 1] === -1 && mavg[i] > shortStop[i - 1]) dir[i] = 1;
      else if (dir[i - 1] === 1 && mavg[i] < longStop[i - 1]) dir[i] = -1;
    } else {
      dir[i] = 1;
    }

    const mt = dir[i] === 1 ? longStop[i] : shortStop[i];
    ott[i] = mavg[i] > mt ? mt * (200 + percent) / 200 : mt * (200 - percent) / 200;
  }

  const warmup = period + 9;

  // Pine: HOTT = nz(HOTT[2]), LOTT = src (normalizedSrc)
  const hottPlot = ott.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup + 2) ? NaN : ott[i - 2],
  }));

  const lottPlot = normalizedSrc.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  // Fill color: red when LOTT < HOTT[2], green otherwise
  const fillColors = normalizedSrc.map((v, i) => {
    if (i < warmup + 2) return 'transparent';
    return v < ott[i - 2] ? 'rgba(255, 0, 0, 0.80)' : 'rgba(0, 255, 0, 0.80)';
  });

  // Markers: Buy = crossunder(HOTT[2], LOTT), Sell = crossover(HOTT[2], LOTT)
  const markers: MarkerData[] = [];
  for (let i = warmup + 3; i < n; i++) {
    const curHOTT = ott[i - 2];
    const prevHOTT = ott[i - 3];
    const curLOTT = normalizedSrc[i];
    const prevLOTT = normalizedSrc[i - 1];

    // Buy: HOTT crosses under LOTT (HOTT was above, now below)
    if (prevHOTT >= prevLOTT && curHOTT < curLOTT) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'Buy' });
    }
    // Sell: HOTT crosses over LOTT (HOTT was below, now above)
    if (prevHOTT <= prevLOTT && curHOTT > curLOTT) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'hott': hottPlot, 'lott': lottPlot },
    fills: [{ plot1: 'hott', plot2: 'lott', options: { color: '#00FF00' }, colors: fillColors }],
    markers,
  };
}

export const OTTO = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
