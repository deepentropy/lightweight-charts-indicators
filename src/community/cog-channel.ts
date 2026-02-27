/**
 * Custom Center of Gravity Double Channel [LazyBear]
 *
 * COG (linreg) base line with inner BB channel (stdev-based) and outer STARC channel (ATR-based).
 * Squeeze markers plotted when ATR channel is inside BB channel.
 *
 * Reference: TradingView "COG Double Channel [LazyBear]" community indicator
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface COGChannelInputs {
  length: number;
  numDevs: number;
  src: SourceType;
}

export const defaultInputs: COGChannelInputs = {
  length: 34,
  numDevs: 2.5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 34, min: 1 },
  { id: 'numDevs', type: 'float', title: 'Num Deviations', defval: 2.5, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'COG', color: '#000080', lineWidth: 2 },
  { id: 'plot1', title: 'BB+', color: '#FF0000', lineWidth: 1 },
  { id: 'plot2', title: 'BB-', color: '#008000', lineWidth: 1 },
  { id: 'plot3', title: 'Starc+', color: '#FF0000', lineWidth: 1, style: 'circles' },
  { id: 'plot4', title: 'Starc-', color: '#008000', lineWidth: 1, style: 'circles' },
  { id: 'sqzHi', title: 'Squeeze Hi', color: '#008080', lineWidth: 2, style: 'cross' },
  { id: 'sqzLo', title: 'Squeeze Lo', color: '#008080', lineWidth: 2, style: 'cross' },
];

export const metadata = {
  title: 'Center of Gravity Channel',
  shortTitle: 'COGCh',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<COGChannelInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { length, numDevs, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  // COG basis = linreg(src, length, 0)
  const cog = ta.linreg(source, length, 0);
  const dev = ta.stdev(source, length).mul(numDevs);
  const upper = cog.add(dev);
  const lower = cog.sub(dev);

  // ATR-based outer channel: Pine uses sma(tr, length) * 2
  // tr_custom = max(high-low, abs(high-close[1]), abs(low-close[1]))
  const trSeries = new Series(bars, (b, i) => {
    const hl = b.high - b.low;
    if (i === 0) return hl;
    const prevClose = bars[i - 1].close;
    return Math.max(hl, Math.abs(b.high - prevClose), Math.abs(b.low - prevClose));
  });
  const atrCustom = ta.sma(trSeries, length);
  const atrMult = atrCustom.mul(2);
  const starcUpper = cog.add(atrMult);
  const starcLower = cog.sub(atrMult);

  const cogArr = cog.toArray();
  const upperArr = upper.toArray();
  const lowerArr = lower.toArray();
  const starcUpperArr = starcUpper.toArray();
  const starcLowerArr = starcLower.toArray();

  const warmup = length;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  // Squeeze: ATR channel inside BB channel => uls > ul and lls < ll
  const markers: MarkerData[] = [];
  const sqzHiPlot: Array<{ time: number; value: number }> = [];
  const sqzLoPlot: Array<{ time: number; value: number }> = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (i < warmup) {
      sqzHiPlot.push({ time: t, value: NaN });
      sqzLoPlot.push({ time: t, value: NaN });
      continue;
    }
    const ul = upperArr[i] ?? NaN;
    const ll = lowerArr[i] ?? NaN;
    const uls = starcUpperArr[i] ?? NaN;
    const lls = starcLowerArr[i] ?? NaN;

    const sqz = !isNaN(uls) && !isNaN(ul) && !isNaN(lls) && !isNaN(ll) && uls > ul && lls < ll;
    if (sqz) {
      // Pine: plot cross markers at uls+offset and lls-offset
      sqzHiPlot.push({ time: t, value: uls + 2 });
      sqzLoPlot.push({ time: t, value: lls - 2 });
    } else {
      sqzHiPlot.push({ time: t, value: NaN });
      sqzLoPlot.push({ time: t, value: NaN });
    }
  }

  // Fills: inner BB fill (silver), outer ATR-to-BB fills (green lower, red upper)
  const fillBB = bars.map((_b, i) => (i < warmup ? 'transparent' : '#C0C0C020'));
  const fillGreen = bars.map((_b, i) => (i < warmup ? 'transparent' : '#00800020'));
  const fillRed = bars.map((_b, i) => (i < warmup ? 'transparent' : '#FF000020'));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': toPlot(cogArr),
      'plot1': toPlot(upperArr),
      'plot2': toPlot(lowerArr),
      'plot3': toPlot(starcUpperArr),
      'plot4': toPlot(starcLowerArr),
      'sqzHi': sqzHiPlot,
      'sqzLo': sqzLoPlot,
    },
    fills: [
      { plot1: 'plot1', plot2: 'plot2', colors: fillBB },
      { plot1: 'plot4', plot2: 'plot2', colors: fillGreen },
      { plot1: 'plot3', plot2: 'plot1', colors: fillRed },
    ],
    markers,
  };
}

export const COGChannel = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
