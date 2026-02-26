/**
 * Elastic Volume Weighted MA & Envelope
 *
 * EVWMA with envelope bands. Running average weighted by volume relative to
 * average volume over the window. Envelope bands at +/- percentage.
 *
 * Reference: TradingView "Elastic Volume Weighted MA & Envelope" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EVWMAEnvelopeInputs {
  length: number;
  envelopePct: number;
  src: SourceType;
}

export const defaultInputs: EVWMAEnvelopeInputs = {
  length: 20,
  envelopePct: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'envelopePct', type: 'float', title: 'Envelope %', defval: 2.0, min: 0.01, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EVWMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'EVWMA Envelope',
  shortTitle: 'EVWMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EVWMAEnvelopeInputs> = {}): IndicatorResult {
  const { length, envelopePct, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const source = getSourceSeries(bars, src);
  const srcArr = source.toArray();

  // Volume SMA for normalization
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const volSmaArr = ta.sma(volSeries, length).toArray();

  // EVWMA calculation
  const evwmaArr: number[] = new Array(n);
  evwmaArr[0] = srcArr[0] ?? 0;

  for (let i = 1; i < n; i++) {
    const vol = bars[i].volume ?? 0;
    const avgVol = volSmaArr[i] ?? 0;
    const cumVol = avgVol * length;
    const alpha = cumVol > 0 ? Math.min(vol / cumVol, 1) : 0;
    evwmaArr[i] = alpha * (srcArr[i] ?? 0) + (1 - alpha) * evwmaArr[i - 1];
  }

  const warmup = length;
  const pctMult = envelopePct / 100;

  const plot0 = evwmaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot1 = evwmaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v * (1 + pctMult),
  }));

  const plot2 = evwmaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v * (1 - pctMult),
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(41,98,255,0.1)' } },
    ],
  };
}

export const EVWMAEnvelope = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
