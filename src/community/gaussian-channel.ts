/**
 * Gaussian Channel [DW]
 *
 * Gaussian-weighted moving average approximated via linear regression,
 * with upper and lower bands at configurable standard deviation multiples.
 *
 * Reference: TradingView "Gaussian Channel [DW]" (TV#263)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface GaussianChannelInputs {
  length: number;
  mult: number;
  src: SourceType;
}

export const defaultInputs: GaussianChannelInputs = {
  length: 20,
  mult: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Center', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Gaussian Channel',
  shortTitle: 'GC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<GaussianChannelInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { length, mult, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  const center = ta.linreg(source, length, 0);
  const dev = ta.stdev(source, length);
  const centerArr = center.toArray();
  const devArr = dev.toArray();

  const warmup = length;

  const plot0 = centerArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot1 = centerArr.map((v, i) => {
    const c = v ?? NaN;
    const d = devArr[i] ?? NaN;
    return { time: bars[i].time, value: i < warmup ? NaN : c + mult * d };
  });

  const plot2 = centerArr.map((v, i) => {
    const c = v ?? NaN;
    const d = devArr[i] ?? NaN;
    return { time: bars[i].time, value: i < warmup ? NaN : c - mult * d };
  });

  // barcolor: 6-level coloring based on src direction vs filter/band position
  // Pine: (src>src[1]) and (src>filt) and (src<hband) -> #0aff68
  //        (src>src[1]) and (src>=hband) -> #0aff1b
  //        (src<=src[1]) and (src>filt) -> #00752d
  //        (src<src[1]) and (src<filt) and (src>lband) -> #ff0a5a
  //        (src<src[1]) and (src<=lband) -> #ff0a11
  //        (src>=src[1]) and (src<filt) -> #990032
  //        else #cccccc
  const sourceArr = source.toArray();
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < bars.length; i++) {
    const s = sourceArr[i] ?? 0;
    const sPrev = sourceArr[i - 1] ?? 0;
    const f = centerArr[i] ?? 0;
    const d = devArr[i] ?? 0;
    const hb = f + mult * d;
    const lb = f - mult * d;
    let color: string;
    if (s > sPrev && s > f && s < hb) color = '#0aff68';
    else if (s > sPrev && s >= hb) color = '#0aff1b';
    else if (s <= sPrev && s > f) color = '#00752d';
    else if (s < sPrev && s < f && s > lb) color = '#ff0a5a';
    else if (s < sPrev && s <= lb) color = '#ff0a11';
    else if (s >= sPrev && s < f) color = '#990032';
    else color = '#cccccc';
    barColors.push({ time: bars[i].time, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [{ plot1: 'plot1', plot2: 'plot2', options: { color: '#2962FF15' } }],
    barColors,
  };
}

export const GaussianChannel = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
