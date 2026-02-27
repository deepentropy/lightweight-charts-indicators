/**
 * FX Sniper T3-CCI
 *
 * CCI smoothed with Tillson T3 moving average.
 * T3 uses a 6-stage EMA cascade with factor-based coefficients.
 * Pine plots both a line (blue) and a histogram (green >= 0, red < 0) of the same T3-CCI value.
 *
 * Reference: TradingView "FX Sniper T3-CCI" community indicator
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface FXSniperT3CCIInputs {
  cciLength: number;
  t3Length: number;
  t3Factor: number;
  src: SourceType;
}

export const defaultInputs: FXSniperT3CCIInputs = {
  cciLength: 14,
  t3Length: 5,
  t3Factor: 0.618,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 14, min: 1 },
  { id: 't3Length', type: 'int', title: 'T3 Length', defval: 5, min: 1 },
  { id: 't3Factor', type: 'float', title: 'T3 Factor', defval: 0.618, min: 0.0, max: 1.0, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3-CCI', color: '#2962FF', lineWidth: 2 },
  { id: 'histogram', title: 'CCIH', color: '#008000', lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'FX Sniper T3-CCI',
  shortTitle: 'T3CCI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<FXSniperT3CCIInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { cciLength, t3Length, t3Factor, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const srcArr = source.toArray();

  // Manual CCI on source
  const smaArr = ta.sma(source, cciLength).toArray();
  const cciArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const sma = smaArr[i];
    if (sma == null || i < cciLength - 1) {
      cciArr[i] = NaN;
      continue;
    }
    let sumDev = 0;
    for (let j = 0; j < cciLength; j++) {
      sumDev += Math.abs((srcArr[i - j] ?? 0) - sma);
    }
    const meanDev = sumDev / cciLength;
    cciArr[i] = meanDev === 0 ? 0 : ((srcArr[i] ?? 0) - sma) / (0.015 * meanDev);
  }

  // T3 smoothing: 6-stage EMA cascade
  // T3 coefficients: b = t3Factor
  // c1 = -b^3, c2 = 3b^2 + 3b^3, c3 = -6b^2 - 3b - 3b^3, c4 = 1 + 3b + b^3 + 3b^2
  const b = t3Factor;
  const b2 = b * b;
  const b3 = b2 * b;
  const c1 = -b3;
  const c2 = 3 * b2 + 3 * b3;
  const c3 = -6 * b2 - 3 * b - 3 * b3;
  const c4 = 1 + 3 * b + b3 + 3 * b2;

  // Pine: nr = 1 + 0.5*(nn-1), w1 = 2/(nr+1), w2 = 1-w1
  // This is EMA with period = nr (not t3Length directly)
  const nn = Math.max(1, t3Length);
  const nr = 1 + 0.5 * (nn - 1);
  const w1 = 2 / (nr + 1);
  const w2 = 1 - w1;

  // EMA helper using Pine's w1/w2 weighting
  const emaArray = (input: number[]): number[] => {
    const result: number[] = new Array(input.length);
    let prev = NaN;
    for (let i = 0; i < input.length; i++) {
      const v = input[i];
      if (isNaN(v)) {
        result[i] = prev;
      } else if (isNaN(prev)) {
        prev = v;
        result[i] = v;
      } else {
        prev = w1 * v + w2 * prev;
        result[i] = prev;
      }
    }
    return result;
  };

  const e1 = emaArray(cciArr);
  const e2 = emaArray(e1);
  const e3 = emaArray(e2);
  const e4 = emaArray(e3);
  const e5 = emaArray(e4);
  const e6 = emaArray(e5);

  const t3Arr: number[] = new Array(bars.length);
  const warmup = cciLength + t3Length * 6;
  for (let i = 0; i < bars.length; i++) {
    if (i < cciLength - 1 || isNaN(e6[i])) {
      t3Arr[i] = NaN;
    } else {
      t3Arr[i] = c1 * e6[i] + c2 * e5[i] + c3 * e4[i] + c4 * e3[i];
    }
  }

  // Pine: plot(xccir, color=blue, title="T3-CCI") -- line plot
  const plot0 = t3Arr.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
  }));

  // Pine: plot(xccir, color=cciHcolor, title="CCIH", style=histogram)
  // cciHcolor = xccir >= 0 ? green : xccir < 0 ? red : black
  const histogram = t3Arr.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
    color: isNaN(v) ? undefined : (v >= 0 ? '#008000' : '#FF0000'),
  }));

  // Pine: pos = xccir > 0 ? 1 : xccir < 0 ? -1 : pos[1]
  // barcolor(pos == -1 ? red : pos == 1 ? green : blue)
  const barColors: BarColorData[] = [];
  let pos = 0;
  for (let i = 0; i < bars.length; i++) {
    const v = t3Arr[i];
    if (!isNaN(v)) {
      if (v > 0) pos = 1;
      else if (v < 0) pos = -1;
    }
    if (i >= cciLength - 1 && !isNaN(t3Arr[i])) {
      const color = pos === 1 ? '#008000' : pos === -1 ? '#FF0000' : '#0000FF'; // green/red/blue
      barColors.push({ time: bars[i].time as number, color });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'histogram': histogram },
    hlines: [
      { value: 0, options: { color: '#800080', linestyle: 'solid', title: 'Zero' } },
    ],
    barColors,
  };
}

export const FXSniperT3CCI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
