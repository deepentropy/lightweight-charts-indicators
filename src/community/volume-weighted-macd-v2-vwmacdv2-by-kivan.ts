/**
 * Volume Weighted MACD V2 (VWMACDV2)
 *
 * MACD of volume weighted averages: fastMA = ema(volume * close, fast) / ema(volume, fast), slowMA the same with the
 * slow period, vwmacd = fastMA - slowMA, signal = ema(vwmacd, signal period), histogram = vwmacd - signal. A line at
 * 0. Plot colours are those of a Pine version 3 script (transparency 35).
 *
 * Reference: "VOLUME WEIGHTED MACD V2" by KivancOzbilgic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: created by Buff DORMEIER; author: KIVANC @fr3762 on twitter
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeWeightedMacdV2VwmacdV2ByKivanInputs {
  /** Fast period */
  fastperiod: number;
  /** Slow period */
  slowperiod: number;
  /** Signal period */
  signalperiod: number;
}

export const defaultInputs: VolumeWeightedMacdV2VwmacdV2ByKivanInputs = {
  fastperiod: 12,
  slowperiod: 26,
  signalperiod: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastperiod', type: 'int', title: 'fastperiod', defval: 12, min: 1, max: 500 },
  { id: 'slowperiod', type: 'int', title: 'slowperiod', defval: 26, min: 1, max: 500 },
  { id: 'signalperiod', type: 'int', title: 'signalperiod', defval: 9, min: 1, max: 500 },
];

/** Pine version 3 plot colours: transparency 35 */
const V3 = (c: string) => String(color.new(c, 35));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMACD', color: V3('#0000FF'), lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: V3('#FF0000'), lineWidth: 2 },
  { id: 'plot2', title: 'Histogram', color: V3('#008000'), lineWidth: 4, style: 'histogram' },
  { id: 'plot3', title: 'Zero', color: V3('#000000'), lineWidth: 1 },
];

export const metadata = {
  title: 'VOLUME WEIGHTED MACD V2',
  shortTitle: 'VWMACDV2',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeWeightedMacdV2VwmacdV2ByKivanInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const vc = new Series(bars, (b) => (b.volume ?? NaN) * b.close);
  const vol = new Series(bars, (b) => b.volume ?? NaN);
  // plain divisions: 0 / 0 is na, as Pine
  const vwma = (len: number) => {
    const num = A(ta.ema(vc, len));
    const den = A(ta.ema(vol, len));
    return num.map((v, i) => v / den[i]);
  };
  const fastMA = vwma(cfg.fastperiod);
  const slowMA = vwma(cfg.slowperiod);
  const vwmacd = fastMA.map((v, i) => v - slowMA[i]);
  const signal = A(ta.ema(Series.fromArray(bars, vwmacd), cfg.signalperiod));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: bars.map((b, i) => ({ time: b.time, value: fin(vwmacd[i]) })),
      plot1: bars.map((b, i) => ({ time: b.time, value: fin(signal[i]) })),
      plot2: bars.map((b, i) => ({ time: b.time, value: fin(vwmacd[i] - signal[i]) })),
      plot3: bars.map((b) => ({ time: b.time, value: 0 })),
    },
  };
}

export const VolumeWeightedMacdV2VwmacdV2ByKivan = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
