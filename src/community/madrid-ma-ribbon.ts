/**
 * Madrid Moving Average Ribbon
 *
 * Ten moving averages (5,10,15,20,25,30,35,40,45,50) creating a ribbon.
 * Supports SMA and EMA types. Gradient coloring from fast to slow.
 *
 * Reference: TradingView "Madrid Moving Average Ribbon" (TV#416/417)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MadridMaRibbonInputs {
  maType: string;
  src: SourceType;
}

export const defaultInputs: MadridMaRibbonInputs = {
  maType: 'sma',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'sma', options: ['sma', 'ema'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

const lengths = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
const colors = ['#64DD17', '#76FF03', '#AEEA00', '#C6FF00', '#FFD600', '#FFAB00', '#FF6D00', '#FF3D00', '#DD2C00', '#B71C1C'];

export const plotConfig: PlotConfig[] = lengths.map((len, idx) => ({
  id: `plot${idx}`,
  title: `MA ${len}`,
  color: colors[idx],
  lineWidth: 1,
}));

export const metadata = {
  title: 'Madrid MA Ribbon',
  shortTitle: 'MAR',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MadridMaRibbonInputs> = {}): IndicatorResult {
  const { maType, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  const maFn = maType === 'ema' ? ta.ema : ta.sma;
  const warmup = lengths[lengths.length - 1]; // 50

  const plots: Record<string, { time: number; value: number }[]> = {};

  for (let idx = 0; idx < lengths.length; idx++) {
    const arr = maFn(source, lengths[idx]).toArray();
    plots[`plot${idx}`] = arr.map((v, i) => ({
      time: bars[i].time,
      value: i < warmup ? NaN : (v ?? NaN),
    }));
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const MadridMaRibbon = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
