/**
 * Premier RSI Oscillator
 *
 * RSI → Stochastic → normalize to [-5,5] → double EMA smoothing → exp sigmoid.
 * Output oscillates between -1 and +1.
 *
 * Reference: TradingView "Premier RSI Oscillator [LazyBear]"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface PremierRSIInputs {
  source: SourceType;
  rsiLength: number;
  stochLength: number;
  smoothLength: number;
}

export const defaultInputs: PremierRSIInputs = {
  source: 'close',
  rsiLength: 14,
  stochLength: 8,
  smoothLength: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'stochLength', type: 'int', title: 'Stoch Length', defval: 8, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smooth Length', defval: 25, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Premier RSI', color: '#000000', lineWidth: 2 },
  { id: 'plot1', title: 'PRO Histo', color: '#787B86', lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Premier RSI Oscillator',
  shortTitle: 'PRO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<PremierRSIInputs> = {}): IndicatorResult {
  const { source, rsiLength, stochLength, smoothLength } = { ...defaultInputs, ...inputs };

  const src = getSourceSeries(bars, source);
  const r = ta.rsi(src, rsiLength);
  // stoch(r, r, r, stochLength) - stochastic of RSI with itself as H/L/C
  const sk = ta.stoch(r, r, r, stochLength);
  const len = Math.round(Math.sqrt(smoothLength));

  // nsk = 0.1 * (sk - 50)
  const nsk = sk.sub(50).mul(0.1);
  // ss = ema(ema(nsk, len), len)
  const ss = ta.ema(ta.ema(nsk, len), len);

  // pro = (exp(ss) - 1) / (exp(ss) + 1) - tanh sigmoid
  const ssArr = ss.toArray();
  const warmup = rsiLength + stochLength + len * 2;

  const barColors: BarColorData[] = [];
  const proValues: number[] = new Array(bars.length).fill(NaN);
  for (let i = 0; i < bars.length; i++) {
    const v = ssArr[i];
    if (i < warmup || v == null) continue;
    const expss = Math.exp(v);
    proValues[i] = (expss - 1) / (expss + 1);
  }

  // Pine: plot(pro, title="Premier RSI Stoch", color=black, linewidth=2) - line plot
  const plot0 = proValues.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
  }));

  // Pine: plot(pro, color=iff(pro<0,red,green), style=histogram, title="PROHisto") - colored histogram
  const plot1 = proValues.map((v, i) => {
    if (isNaN(v)) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v, color: v < 0 ? '#FF0000' : '#00FF00' };
  });

  // barcolor: pro<0 ? (pro<pro[1]?red:orange) : (pro>pro[1]?lime:green)
  for (let i = warmup; i < bars.length; i++) {
    const pro = proValues[i];
    const prevPro = i > 0 ? proValues[i - 1] : NaN;
    if (isNaN(pro)) continue;
    let color: string;
    if (pro < 0) {
      color = pro < prevPro ? '#FF0000' : '#FFA500';
    } else {
      color = pro > prevPro ? '#00FF00' : '#008000';
    }
    barColors.push({ time: bars[i].time as number, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted', title: 'Zero' } },
      { value: 0.9, options: { color: '#26A69A', linestyle: 'solid', title: 'Overbought' } },
      { value: -0.9, options: { color: '#EF5350', linestyle: 'solid', title: 'Oversold' } },
      { value: 0.2, options: { color: '#787B86', linestyle: 'dashed' } },
      { value: -0.2, options: { color: '#787B86', linestyle: 'dashed' } },
    ],
    barColors,
  } as IndicatorResult & { barColors: BarColorData[] };
}

export const PremierRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
