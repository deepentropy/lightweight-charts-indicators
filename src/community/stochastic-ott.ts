/**
 * Stochastic OTT
 *
 * Optimized Trend Tracker applied to Stochastic oscillator.
 * Smooths raw Stochastic %K with VAR (CMO-based adaptive MA),
 * then applies OTT trailing stop logic to the smoothed value.
 *
 * Reference: TradingView "Stochastic Optimized Trend Tracker" by KivancOzbilgic
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface StochasticOTTInputs {
  kLen: number;
  kSmooth: number;
  ottPeriod: number;
  ottPct: number;
  showSupport: boolean;
}

export const defaultInputs: StochasticOTTInputs = {
  kLen: 500,
  kSmooth: 200,
  ottPeriod: 2,
  ottPct: 0.5,
  showSupport: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: '%K Length', defval: 500, min: 1 },
  { id: 'kSmooth', type: 'int', title: '%K Smoothing', defval: 200, min: 1 },
  { id: 'ottPeriod', type: 'int', title: 'OTT Period', defval: 2, min: 1 },
  { id: 'ottPct', type: 'float', title: 'OTT Percent', defval: 0.5, min: 0, step: 0.1 },
  { id: 'showSupport', type: 'bool', title: 'Show Support Line?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%K', color: '#0094FF', lineWidth: 1 },
  { id: 'plot1', title: 'OTT', color: '#B800D9', lineWidth: 2 },
  { id: 'plot2', title: 'Support Line', color: '#0585E1', lineWidth: 2 },
];

export const metadata = {
  title: 'Stochastic OTT',
  shortTitle: 'StochOTT',
  overlay: false,
};

/** VAR function (VIDYA-like using CMO over 9 bars) matching PineScript Var_Func */
function varFunc(srcArr: number[], length: number): number[] {
  const n = srcArr.length;
  const result: number[] = new Array(n);
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
    result[i] = i === 0 ? s : valpha * Math.abs(vCMO) * s + (1 - valpha * Math.abs(vCMO)) * result[i - 1];
  }
  return result;
}

export function calculate(bars: Bar[], inputs: Partial<StochasticOTTInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { kLen, kSmooth, ottPeriod, ottPct, showSupport } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Pine: stoch(close, high, low, periodK)
  const rawK = ta.stoch(closeSeries, highSeries, lowSeries, kLen);
  const rawKArr = rawK.toArray().map(v => (v != null && !isNaN(v)) ? v : 0);

  // Pine: k = Var_Func1(stoch(...), smoothK) -- VAR-smooth the raw stochastic
  const kArr = varFunc(rawKArr, kSmooth);

  // Pine: src = k + 1000
  const srcArr = kArr.map(v => v + 1000);

  // Pine: MAvg = Var_Func(src, length) -- VAR of the offset source
  const mAvg = varFunc(srcArr, ottPeriod);

  // OTT trailing stop on MAvg
  const fark = mAvg.map(v => v * ottPct * 0.01);
  const longStop: number[] = new Array(n);
  const shortStop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const ott: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    longStop[i] = mAvg[i] - fark[i];
    shortStop[i] = mAvg[i] + fark[i];

    if (i > 0) {
      if (mAvg[i] > longStop[i - 1]) longStop[i] = Math.max(longStop[i], longStop[i - 1]);
      if (mAvg[i] < shortStop[i - 1]) shortStop[i] = Math.min(shortStop[i], shortStop[i - 1]);

      dir[i] = dir[i - 1];
      if (dir[i - 1] === -1 && mAvg[i] > shortStop[i - 1]) dir[i] = 1;
      else if (dir[i - 1] === 1 && mAvg[i] < longStop[i - 1]) dir[i] = -1;
    } else {
      dir[i] = 1;
    }

    const mt = dir[i] === 1 ? longStop[i] : shortStop[i];
    ott[i] = mAvg[i] > mt ? mt * (200 + ottPct) / 200 : mt * (200 - ottPct) / 200;
  }

  const warmup = kLen + kSmooth;

  // Pine: plot(k+1000, title="%K", color=#0094FF)
  const plot0 = srcArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  // Pine: pALL=plot(nz(OTT[2]), color=#B800D9, linewidth=2, title="OTT") -- 2-bar lag
  const plot1 = ott.map((_v, i) => ({
    time: bars[i].time,
    value: (i < warmup + 2) ? NaN : ott[i - 2],
  }));

  // Pine: plot(showsupport ? MAvg : na, color=#0585E1, linewidth=2, title="Support Line")
  const plot2 = mAvg.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || !showSupport) ? NaN : v,
  }));

  // Markers: buy when src crosses above OTT[2], sell when crosses below
  // Pine: buySignalc = crossover(src, OTT[2])
  // Pine: sellSignallc = crossunder(src, OTT[2])
  const markers: MarkerData[] = [];
  for (let i = warmup + 3; i < n; i++) {
    const srcCur = srcArr[i];
    const srcPrev = srcArr[i - 1];
    const ottLag = ott[i - 2];
    const ottLagPrev = ott[i - 3];
    if (srcPrev <= ottLagPrev && srcCur > ottLag) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    }
    if (srcPrev >= ottLagPrev && srcCur < ottLag) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [
      // Pine: fill(h0, h1, color=#9915FF, transp=80) between hlines at 1080 and 1020
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(153,21,255,0.2)' } },
    ],
    hlines: [
      { value: 1080, options: { color: '#606060', linestyle: 'solid' as const, title: 'Upper Band' } },
      { value: 1020, options: { color: '#606060', linestyle: 'solid' as const, title: 'Lower Band' } },
    ],
    markers,
  };
}

export const StochasticOTT = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
