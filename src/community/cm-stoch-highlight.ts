/**
 * CM Stochastic Highlight Bars
 *
 * Overlay indicator that uses Stochastic K/D values to color price bars
 * and highlight backgrounds. No K/D lines plotted on chart.
 *
 * - barcolor: orange when overbought (K > upLine), fuchsia when oversold (K < lowLine)
 * - bgcolor: red when overbought, lime when oversold (sbh mode)
 * - bgcolor: lime on strict crossUp, red on strict crossDn (sch mode)
 * - bgcolor: lime on any crossUp, red on any crossDown (sac mode)
 * - plotchar 'B'/'S' on strict crosses (sl mode)
 * - plotchar 'B'/'S' on any crosses (sacl mode)
 *
 * Reference: TradingView "CM_Stochastic Highlight Bars" by ChrisMoody
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';

export interface CMStochHighlightInputs {
  kLen: number;
  kSmooth: number;
  dSmooth: number;
  upLine: number;
  lowLine: number;
  sbc: boolean;
  sbh: boolean;
  sch: boolean;
  sl: boolean;
  sac: boolean;
  sacl: boolean;
}

export const defaultInputs: CMStochHighlightInputs = {
  kLen: 14,
  kSmooth: 3,
  dSmooth: 3,
  upLine: 80,
  lowLine: 20,
  sbc: true,
  sbh: false,
  sch: false,
  sl: true,
  sac: false,
  sacl: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: 'Length for Stochastic', defval: 14, min: 1 },
  { id: 'kSmooth', type: 'int', title: 'SmoothK for Stochastic', defval: 3, min: 1 },
  { id: 'dSmooth', type: 'int', title: 'SmoothD for Stochastic', defval: 3, min: 1 },
  { id: 'upLine', type: 'int', title: 'Upper Line Value', defval: 80, min: 50 },
  { id: 'lowLine', type: 'int', title: 'Lower Line Value', defval: 20, min: 10 },
  { id: 'sbc', type: 'bool', title: 'Show Price Bar Highlight', defval: true },
  { id: 'sbh', type: 'bool', title: 'Show Background Highlight Above/Below', defval: false },
  { id: 'sch', type: 'bool', title: 'Show Background Highlight Strict Cross', defval: false },
  { id: 'sl', type: 'bool', title: 'Show B/S Letters Strict Cross', defval: true },
  { id: 'sac', type: 'bool', title: 'Show Background Highlight Any Cross', defval: false },
  { id: 'sacl', type: 'bool', title: 'Show B/S Letters Any Cross', defval: false },
];

// No visible plots on chart - this is overlay=true with barcolor/bgcolor/markers only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'CM Stochastic Highlight Bars',
  shortTitle: 'CMStochHL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMStochHighlightInputs> = {}): IndicatorResult {
  const { kLen, kSmooth, dSmooth, upLine, lowLine, sbc, sbh, sch, sl, sac, sacl } = { ...defaultInputs, ...inputs };

  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const rawK = ta.stoch(closeSeries, highSeries, lowSeries, kLen);
  const k = ta.sma(rawK, kSmooth);
  const d = ta.sma(k, dSmooth);

  const kArr = k.toArray();
  const dArr = d.toArray();
  const warmup = kLen + kSmooth + dSmooth;

  const barColors: BarColorData[] = [];
  const bgColors: BgColorData[] = [];
  const markers: MarkerData[] = [];

  for (let i = warmup; i < bars.length; i++) {
    const kVal = kArr[i];
    const dVal = dArr[i];
    if (kVal == null || dVal == null) continue;

    const aboveLine = kVal > upLine;
    const belowLine = kVal < lowLine;

    // barcolor: orange when overbought, fuchsia when oversold
    if (sbc) {
      if (aboveLine) {
        barColors.push({ time: bars[i].time, color: '#FF9800' }); // orange
      } else if (belowLine) {
        barColors.push({ time: bars[i].time, color: '#E040FB' }); // fuchsia
      }
    }

    // bgcolor: above/below line highlights
    if (sbh) {
      if (aboveLine) {
        bgColors.push({ time: bars[i].time, color: 'rgba(239, 83, 80, 0.30)' }); // red transp=70
      } else if (belowLine) {
        bgColors.push({ time: bars[i].time, color: 'rgba(0, 230, 118, 0.30)' }); // lime transp=70
      }
    }

    if (i < warmup + 1) continue;

    const k1 = kArr[i - 1] ?? NaN;
    const d1 = dArr[i - 1] ?? NaN;
    if (isNaN(k1) || isNaN(d1)) continue;

    // Strict cross definitions: K[1] was below lowLine and below D[1], now K > D
    const crossUp = (k1 < d1 && k1 < lowLine) && (kVal > dVal);
    // K[1] was above upLine and above D[1], now K < D
    const crossDn = (k1 > d1 && k1 > upLine) && (kVal < dVal);

    // Any cross definitions
    const crossUpAll = (k1 < d1) && (kVal > dVal);
    const crossDownAll = (k1 > d1) && (kVal < dVal);

    // bgcolor: strict cross highlights
    if (sch) {
      if (crossUp) {
        bgColors.push({ time: bars[i].time, color: 'rgba(0, 230, 118, 0.60)' }); // lime transp=40
      }
      if (crossDn) {
        bgColors.push({ time: bars[i].time, color: 'rgba(239, 83, 80, 0.60)' }); // red transp=40
      }
    }

    // bgcolor: any cross highlights
    if (sac) {
      if (crossUpAll) {
        bgColors.push({ time: bars[i].time, color: 'rgba(0, 230, 118, 0.60)' }); // lime transp=40
      }
      if (crossDownAll) {
        bgColors.push({ time: bars[i].time, color: 'rgba(239, 83, 80, 0.60)' }); // red transp=40
      }
    }

    // markers: strict cross B/S
    if (sl) {
      if (crossUp) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00E676', text: 'B' });
      }
      if (crossDn) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'S' });
      }
    }

    // markers: any cross B/S
    if (sacl) {
      if (crossUpAll) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00E676', text: 'B' });
      }
      if (crossDownAll) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'S' });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    barColors,
    bgColors,
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] };
}

export const CMStochHighlight = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
