/**
 * WaveTrend Oscillator [WT]
 *
 * ap = hlc3, esa = ema(ap, n1), d = ema(|ap - esa|, n1), ci = (ap - esa) / (0.015 * d), wt1 = ema(ci, n2),
 * wt2 = sma(wt1, 4). Plots: the zero line, two overbought and two oversold levels, wt1, wt2 (crosses) and the
 * difference wt1 - wt2 as an area.
 *
 * Reference: "WaveTrend [LazyBear]" by LazyBear
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @author LazyBear. If you use this code in its original/modified form, do drop me a note.
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface WavetrendOscillatorWtInputs {
  /** Channel length (EMA of the price and of the absolute deviation) */
  n1: number;
  /** Average length (EMA of the channel index) */
  n2: number;
  obLevel1: number;
  obLevel2: number;
  osLevel1: number;
  osLevel2: number;
}

export const defaultInputs: WavetrendOscillatorWtInputs = {
  n1: 10,
  n2: 21,
  obLevel1: 60,
  obLevel2: 53,
  osLevel1: -60,
  osLevel2: -53,
};

export const inputConfig: InputConfig[] = [
  { id: 'n1', type: 'int', title: 'Channel Length', defval: 10 },
  { id: 'n2', type: 'int', title: 'Average Length', defval: 21 },
  { id: 'obLevel1', type: 'int', title: 'Over Bought Level 1', defval: 60 },
  { id: 'obLevel2', type: 'int', title: 'Over Bought Level 2', defval: 53 },
  { id: 'osLevel1', type: 'int', title: 'Over Sold Level 1', defval: -60 },
  { id: 'osLevel2', type: 'int', title: 'Over Sold Level 2', defval: -53 },
];

// Pine v1 colours (gray #808080, red #FF0000, green #008000, blue #0000FF) with the v1 default plot transparency
// of 35; the area has transp = 80
const GRAY = String(color.new('#808080', 35));
const RED = String(color.new('#FF0000', 35));
const GREEN = String(color.new('#008000', 35));
const BLUE = String(color.new('#0000FF', 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero', color: GRAY, lineWidth: 1 },
  { id: 'plot1', title: 'Over Bought Level 1', color: RED, lineWidth: 1 },
  { id: 'plot2', title: 'Over Sold Level 1', color: GREEN, lineWidth: 1 },
  { id: 'plot3', title: 'Over Bought Level 2', color: RED, lineWidth: 1, style: 'cross' },
  { id: 'plot4', title: 'Over Sold Level 2', color: GREEN, lineWidth: 1, style: 'cross' },
  { id: 'plot5', title: 'WT1', color: GREEN, lineWidth: 1 },
  { id: 'plot6', title: 'WT2', color: RED, lineWidth: 1, style: 'cross' },
  { id: 'plot7', title: 'WT1 - WT2', color: BLUE, lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: 'WaveTrend [LazyBear]',
  shortTitle: 'WT_LB',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<WavetrendOscillatorWtInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { n1, n2, obLevel1, obLevel2, osLevel1, osLevel2 } = cfg;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);

  const ap = bars.map((b) => (b.high + b.low + b.close) / 3);
  const esa = A(ta.ema(S(ap), n1));
  const d = A(ta.ema(S(ap.map((v, i) => Math.abs(v - esa[i]))), n1));
  // A plain division, as Pine: x / 0 is +-infinity, 0 / 0 is na (the EMA skips both)
  const ci = ap.map((v, i) => (v - esa[i]) / (0.015 * d[i]));
  const wt1 = A(ta.ema(S(ci), n2));
  const wt2 = A(ta.sma(S(wt1), 4));

  const out = (f: (i: number) => number) =>
    bars.map((b, i) => {
      const v = f(i);
      return { time: b.time, value: Number.isFinite(v) ? v : NaN };
    });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: out(() => 0),
      plot1: out(() => obLevel1),
      plot2: out(() => osLevel1),
      plot3: out(() => obLevel2),
      plot4: out(() => osLevel2),
      plot5: out((i) => wt1[i]),
      plot6: out((i) => wt2[i]),
      plot7: out((i) => wt1[i] - wt2[i]),
    },
  };
}

export const WavetrendOscillatorWt = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
