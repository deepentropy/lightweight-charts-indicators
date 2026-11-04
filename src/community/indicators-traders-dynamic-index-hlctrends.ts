/**
 * Traders Dynamic Index [LazyBear]
 *
 * RSI of the close ("lengthrsi") with a volatility band around its SMA ("lengthband"): upper / lower band = SMA
 * +- 1.6185 standard deviations of the RSI over the same length, middle band = their average. Two more SMAs of the
 * RSI: the RSI price line ("lengthrsipl") and the trade signal line ("lengthtradesl"). Levels at 32 and 68; red fill
 * between the upper and the middle band, green fill between the middle and the lower band.
 *
 * Reference: "Indicators: Traders Dynamic Index, HLCTrends and Trix Ribbon" by LazyBear
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taCore, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';

export interface IndicatorsTradersDynamicIndexHlctrendsInputs {
  lengthrsi: number;
  lengthband: number;
  lengthrsipl: number;
  lengthtradesl: number;
}

export const defaultInputs: IndicatorsTradersDynamicIndexHlctrendsInputs = {
  lengthrsi: 13,
  lengthband: 34,
  lengthrsipl: 2,
  lengthtradesl: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthrsi', type: 'int', title: 'lengthrsi', defval: 13 },
  { id: 'lengthband', type: 'int', title: 'lengthband', defval: 34 },
  { id: 'lengthrsipl', type: 'int', title: 'lengthrsipl', defval: 2 },
  { id: 'lengthtradesl', type: 'int', title: 'lengthtradesl', defval: 7 },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const BLUE = V1('#0000FF');
const ORANGE = V1('#FF7F00');
const GREEN = V1('#008000');
const RED = V1('#FF0000');
/** Default hline colour */
const LEVEL = '#787B86';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band', color: BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Band', color: BLUE, lineWidth: 1 },
  { id: 'plot2', title: 'Middle Band', color: ORANGE, lineWidth: 2 },
  { id: 'plot3', title: 'RSI Price Line', color: GREEN, lineWidth: 2 },
  { id: 'plot4', title: 'Trade Signal Line', color: RED, lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 32, title: 'Level', color: LEVEL, linestyle: 'dashed', linewidth: 1 },
  { id: 'hline_1', price: 68, title: 'Level', color: LEVEL, linestyle: 'dashed', linewidth: 1 },
];

/** fill(upl, midl, red, transp = 90) and fill(midl, dnl, green, transp = 90) */
const FILL_UPPER = String(color.new('#FF0000', 90));
const FILL_LOWER = String(color.new('#008000', 90));

export const fillConfig: FillConfig[] = [
  { id: 'fill_0', plot1: 'plot0', plot2: 'plot2', color: FILL_UPPER, title: 'Plots Background' },
  { id: 'fill_1', plot1: 'plot2', plot2: 'plot1', color: FILL_LOWER, title: 'Plots Background' },
];

export const metadata = {
  title: 'Traders Dynamic Index [LazyBear]',
  shortTitle: 'TDI_LB',
  overlay: false,
};

const num = (v: number | null | undefined): number => (v === null || v === undefined ? NaN : v);

export function calculate(bars: Bar[], inputs: Partial<IndicatorsTradersDynamicIndexHlctrendsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const close = bars.map((b) => b.close);

  const r = Array.from(taCore.rsi(close, cfg.lengthrsi), num);
  const ma = Array.from(taCore.sma(r, cfg.lengthband), num);
  const sd = Array.from(taCore.stdev(r, cfg.lengthband), num);
  const up = ma.map((m, i) => m + 1.6185 * sd[i]);
  const dn = ma.map((m, i) => m - 1.6185 * sd[i]);
  const mid = up.map((u, i) => (u + dn[i]) / 2);
  const mab = Array.from(taCore.sma(r, cfg.lengthrsipl), num);
  const mbb = Array.from(taCore.sma(r, cfg.lengthtradesl), num);

  const series = (values: number[]) => values.map((value, i) => ({ time: bars[i].time, value }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: series(up), plot1: series(dn), plot2: series(mid), plot3: series(mab), plot4: series(mbb) },
    hlines: [
      { value: 32, options: { title: 'Level', color: LEVEL, linestyle: 'dashed', linewidth: 1 } },
      { value: 68, options: { title: 'Level', color: LEVEL, linestyle: 'dashed', linewidth: 1 } },
    ],
    fills: [
      { plot1: 'plot0', plot2: 'plot2', options: { color: FILL_UPPER, title: 'Plots Background' } },
      { plot1: 'plot2', plot2: 'plot1', options: { color: FILL_LOWER, title: 'Plots Background' } },
    ],
  };
}

export const IndicatorsTradersDynamicIndexHlctrends = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig,
};
