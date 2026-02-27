/**
 * CM Stochastic Highlight Bars
 *
 * Stochastic with highlighted zones. K line colored green when K > D and rising,
 * red when K < D and falling, else default.
 *
 * Reference: TradingView "CM_Stochastic Highlight Bars" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';

export interface CMStochHighlightInputs {
  kLen: number;
  kSmooth: number;
  dSmooth: number;
}

export const defaultInputs: CMStochHighlightInputs = {
  kLen: 14,
  kSmooth: 3,
  dSmooth: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: '%K Length', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: '%K Smoothing', defval: 3, min: 1 },
  { id: 'dSmooth', type: 'int', title: '%D Smoothing', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'D', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'CM Stochastic Highlight Bars',
  shortTitle: 'CMStochHL',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CMStochHighlightInputs> = {}): IndicatorResult {
  const { kLen, kSmooth, dSmooth } = { ...defaultInputs, ...inputs };

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const rawK = ta.stoch(closeSeries, highSeries, lowSeries, kLen);
  const k = ta.sma(rawK, kSmooth);
  const d = ta.sma(k, dSmooth);

  const kArr = k.toArray();
  const dArr = d.toArray();
  const warmup = kLen + kSmooth + dSmooth;

  const plot0 = kArr.map((v, i) => {
    if (v == null || i < warmup) return { time: bars[i].time, value: NaN };
    const dVal = dArr[i] ?? 0;
    const prevK = i > 0 ? (kArr[i - 1] ?? 0) : 0;
    let color = '#2962FF';
    if (v > dVal && v > prevK) color = '#26A69A';
    else if (v < dVal && v < prevK) color = '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = dArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  // barcolor: orange when overbought (K > upLine), fuchsia when oversold (K < lowLine)
  // Pine: barcolor(overBought() ? orange : overSold() ? fuchsia : na)
  const barColors: BarColorData[] = [];
  const upLine = 80;
  const lowLine = 20;
  for (let i = warmup; i < bars.length; i++) {
    const kVal = kArr[i];
    if (kVal == null) continue;
    if (kVal > upLine) {
      barColors.push({ time: bars[i].time, color: '#FF9800' }); // orange
    } else if (kVal < lowLine) {
      barColors.push({ time: bars[i].time, color: '#E040FB' }); // fuchsia
    }
  }

  // markers: 'B' on strict crossUp (K was < D and < lowLine, now K > D), 'S' on strict crossDn
  // Pine: plotchar(crossUp, 'B', belowbar, lime), plotchar(crossDn, 'S', abovebar, red)
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < bars.length; i++) {
    const k1 = kArr[i - 1] ?? NaN;
    const d1 = dArr[i - 1] ?? NaN;
    const kNow = kArr[i] ?? NaN;
    const dNow = dArr[i] ?? NaN;
    if (isNaN(k1) || isNaN(d1) || isNaN(kNow) || isNaN(dNow)) continue;
    // crossUp: K[1] < D[1] and K[1] < lowLine, and K > D
    if (k1 < d1 && k1 < lowLine && kNow > dNow) {
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'labelUp',
        color: '#00E676', // lime
        text: 'B',
      });
    }
    // crossDn: K[1] > D[1] and K[1] > upLine, and K < D
    if (k1 > d1 && k1 > upLine && kNow < dNow) {
      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'labelDown',
        color: '#EF5350', // red
        text: 'S',
      });
    }
  }

  // bgcolor: highlight background when stoch is above/below lines
  // Pine: bgcolor(sbh and aboveLine ? red : na, transp=70), bgcolor(sbh and belowLine ? lime : na, transp=70)
  const bgColors: BgColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const kVal = kArr[i];
    if (kVal == null) continue;
    if (kVal > upLine) {
      bgColors.push({ time: bars[i].time, color: 'rgba(239, 83, 80, 0.30)' }); // red transp=70
    } else if (kVal < lowLine) {
      bgColors.push({ time: bars[i].time, color: 'rgba(0, 230, 118, 0.30)' }); // lime transp=70
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 80, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 20, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    markers,
    barColors,
    bgColors,
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] };
}

export const CMStochHighlight = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
