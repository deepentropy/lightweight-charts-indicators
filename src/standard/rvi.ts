/**
 * Relative Vigor Index (RVI/RVGI) Indicator
 *
 * Measures the conviction of a recent price action.
 * Based on the relationship between close-open and high-low.
 */

import { Series, ta, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';

export interface RVIInputs {
  /** Period length */
  length: number;
  /** Plot offset */
  offset: number;
}

export const defaultInputs: RVIInputs = {
  length: 10,
  offset: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500, display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RVGI', color: '#008000', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#FF0000', lineWidth: 1 },
];


export const metadata = {
  title: 'Relative Vigor Index',
  shortTitle: 'RVGI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RVIInputs> = {}): IndicatorResult {
  const { length, offset } = { ...defaultInputs, ...inputs };
  const S = (a: number[]) => Series.fromArray(bars, a);

  // rvi = math.sum(ta.swma(close - open), len) / math.sum(ta.swma(high - low), len)
  const num = math.sum(ta.swma(S(bars.map((b) => b.close - b.open))), length).toArray();
  const den = math.sum(ta.swma(S(bars.map((b) => b.high - b.low))), length).toArray();
  // A plain division: x / 0 is +-infinity, 0 / 0 is NaN (na); the plots show both as na
  const rviRaw = bars.map((_b, i) => (num[i] ?? NaN) / (den[i] ?? NaN));
  // sig = ta.swma(rvi)
  const sigRaw = ta.swma(S(rviRaw)).toArray().map((v) => v ?? NaN);
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  const rviValues = rviRaw.map(finite);
  const signalValues = sigRaw.map(finite);

  // plot(..., offset = offset): the value of bar i is drawn on bar i + offset (future bars after the last bar)
  const interval = barInterval(bars);
  const applyOffset = (arr: number[]) => {
    const out: { time: number; value: number }[] = [];
    for (let i = 0; i < bars.length; i++) {
      if (i + offset < 0) continue;
      out.push({ time: barTime(bars, i + offset, interval), value: arr[i] });
    }
    return out;
  };

  const rviData = applyOffset(rviValues);
  const signalData = applyOffset(signalValues);

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': rviData,
      'plot1': signalData,
    },
  };
}

export const RVI = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
