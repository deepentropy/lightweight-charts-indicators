/**
 * Volume Flow v3
 *
 * Bull/bear volume analysis with moving averages, spike detection, and difference area.
 * Plots: Volume (columns), Bull MA, Bear MA, Bull Vol Spike, Bear Vol Spike, Difference Value.
 * MA type selectable: Simple, Exponential, Double Exponential.
 *
 * Reference: TradingView "Volume Flow v3" by DepthHouse / oh92 (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeFlowV3Inputs {
  maType: string;
  length: number;
  factor: number;
}

export const defaultInputs: VolumeFlowV3Inputs = {
  maType: 'Simple',
  length: 14,
  factor: 3.1,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'Simple', options: ['Simple', 'Exponential', 'Double Exponential'] },
  { id: 'length', type: 'int', title: 'MA Length', defval: 14, min: 1 },
  { id: 'factor', type: 'float', title: 'Spike Factor', defval: 3.1, min: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'volume', title: 'Volume', color: '#787B86', lineWidth: 1, style: 'columns' },
  { id: 'bullMa', title: 'Bull MA', color: '#5AA650', lineWidth: 1 },
  { id: 'bearMa', title: 'Bear MA', color: '#FF510D', lineWidth: 1 },
  { id: 'bullSpike', title: 'Bull Vol Spike', color: '#5AA650', lineWidth: 1, style: 'columns' },
  { id: 'bearSpike', title: 'Bear Vol Spike', color: '#FF510D', lineWidth: 1, style: 'columns' },
  { id: 'diffValue', title: 'Difference Value', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Flow v3',
  shortTitle: 'VFv3',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeFlowV3Inputs> = {}): IndicatorResult {
  const { maType, length, factor } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Basic volume split: bull = close > open ? vol : 0, bear = open > close ? vol : 0
  const bullArr: number[] = new Array(n);
  const bearArr: number[] = new Array(n);
  const volArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const vol = bars[i].volume ?? 0;
    volArr[i] = vol;
    bullArr[i] = bars[i].close > bars[i].open ? vol : 0;
    bearArr[i] = bars[i].open > bars[i].close ? vol : 0;
  }

  // MA function selection
  const bullSeries = new Series(bars, (_b, i) => bullArr[i]);
  const bearSeries = new Series(bars, (_b, i) => bearArr[i]);

  let bullmaArr: (number | null)[];
  let bearmaArr: (number | null)[];

  if (maType === 'Exponential') {
    bullmaArr = ta.ema(bullSeries, length).toArray();
    bearmaArr = ta.ema(bearSeries, length).toArray();
  } else if (maType === 'Double Exponential') {
    // DEMA = 2 * EMA - EMA(EMA)
    const bullEma1 = ta.ema(bullSeries, length).toArray();
    const bullEma1Series = new Series(bars, (_b, i) => bullEma1[i] ?? 0);
    const bullEma2 = ta.ema(bullEma1Series, length).toArray();
    bullmaArr = bullEma1.map((v, i) => v != null && bullEma2[i] != null ? 2 * v - (bullEma2[i] ?? 0) : null);

    const bearEma1 = ta.ema(bearSeries, length).toArray();
    const bearEma1Series = new Series(bars, (_b, i) => bearEma1[i] ?? 0);
    const bearEma2 = ta.ema(bearEma1Series, length).toArray();
    bearmaArr = bearEma1.map((v, i) => v != null && bearEma2[i] != null ? 2 * v - (bearEma2[i] ?? 0) : null);
  } else {
    bullmaArr = ta.sma(bullSeries, length).toArray();
    bearmaArr = ta.sma(bearSeries, length).toArray();
  }

  const warmup = maType === 'Double Exponential' ? length * 2 : length;

  // Volume spikes: crossover(bull, bullma * factor) ? vol : na
  const volumePlot: { time: number; value: number; color?: string }[] = [];
  const bullMaPlot: { time: number; value: number }[] = [];
  const bearMaPlot: { time: number; value: number }[] = [];
  const bullSpikePlot: { time: number; value: number }[] = [];
  const bearSpikePlot: { time: number; value: number }[] = [];
  const diffPlot: { time: number; value: number; color?: string }[] = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (i < warmup) {
      volumePlot.push({ time: t, value: NaN });
      bullMaPlot.push({ time: t, value: NaN });
      bearMaPlot.push({ time: t, value: NaN });
      bullSpikePlot.push({ time: t, value: NaN });
      bearSpikePlot.push({ time: t, value: NaN });
      diffPlot.push({ time: t, value: NaN });
      continue;
    }

    const bma = bullmaArr[i] ?? 0;
    const bema = bearmaArr[i] ?? 0;

    // Volume colored by direction
    const vClr = bars[i].close > bars[i].open ? '#5AA650' : '#FF510D';
    volumePlot.push({ time: t, value: volArr[i], color: vClr });

    // Bull/Bear MA * 2 (Pine plots bullma*2 and bearma*2)
    bullMaPlot.push({ time: t, value: bma * 2 });
    bearMaPlot.push({ time: t, value: bema * 2 });

    // Volume spikes: crossover detection
    const prevBull = i > 0 ? bullArr[i - 1] : 0;
    const prevBullThresh = i > 0 ? (bullmaArr[i - 1] ?? 0) * factor : 0;
    const gsig = prevBull <= prevBullThresh && bullArr[i] > bma * factor;
    bullSpikePlot.push({ time: t, value: gsig ? volArr[i] : NaN });

    const prevBear = i > 0 ? bearArr[i - 1] : 0;
    const prevBearThresh = i > 0 ? (bearmaArr[i - 1] ?? 0) * factor : 0;
    const rsig = prevBear <= prevBearThresh && bearArr[i] > bema * factor;
    bearSpikePlot.push({ time: t, value: rsig ? volArr[i] : NaN });

    // Difference: |bullma - bearma| / 2.5, colored by direction
    const vfDif = bma - bema;
    const vfAbsolute = Math.abs(vfDif);
    const dClr = vfDif > 0 ? '#5AA650' : '#FF510D';
    diffPlot.push({ time: t, value: vfAbsolute / 2.5, color: dClr });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      volume: volumePlot,
      bullMa: bullMaPlot,
      bearMa: bearMaPlot,
      bullSpike: bullSpikePlot,
      bearSpike: bearSpikePlot,
      diffValue: diffPlot,
    },
  };
}

export const VolumeFlowV3 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
