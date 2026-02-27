/**
 * Elliott Wave Oscillator (EWO)
 *
 * Difference between a fast SMA and a slow SMA, optionally expressed as a
 * percentage of the current price. Plotted as a two-color histogram (green
 * when positive, red when zero or negative).
 *
 * Reference: TradingView "Elliot Wave Oscillator" by Koryu
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface ElliottWaveOscInputs {
  src: SourceType;
  sma1Length: number;
  sma2Length: number;
  usePercent: boolean;
}

export const defaultInputs: ElliottWaveOscInputs = {
  src: 'close',
  sma1Length: 5,
  sma2Length: 35,
  usePercent: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'sma1Length', type: 'int', title: 'SMA 1 Length', defval: 5, min: 1 },
  { id: 'sma2Length', type: 'int', title: 'SMA 2 Length', defval: 35, min: 1 },
  { id: 'usePercent', type: 'bool', title: 'Show Dif as percent of current Candle', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EWO', color: '#26A69A', lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'Elliott Wave Oscillator',
  shortTitle: 'EWO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ElliottWaveOscInputs> = {}): IndicatorResult {
  const { src, sma1Length, sma2Length, usePercent } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const sma1 = ta.sma(source, sma1Length);
  const sma2 = ta.sma(source, sma2Length);
  const sma1Arr = sma1.toArray();
  const sma2Arr = sma2.toArray();
  const srcArr = source.toArray();

  const n = bars.length;
  const ewoData: { time: any; value: number; color: string }[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const s1 = sma1Arr[i];
    const s2 = sma2Arr[i];
    const sv = srcArr[i];
    if (s1 == null || s2 == null || sv == null || (usePercent && sv === 0)) {
      ewoData[i] = { time: bars[i].time, value: NaN, color: '#26A69A' };
      continue;
    }
    const dif = s1 - s2;
    const value = usePercent ? (dif / sv) * 100 : dif;
    const color = value <= 0 ? '#FF5252' : '#26A69A';
    ewoData[i] = { time: bars[i].time, value, color };
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': ewoData },
  };
}

export const ElliottWaveOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
