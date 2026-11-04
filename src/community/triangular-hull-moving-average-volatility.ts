/**
 * Triangular Hull Moving Average + Volatility
 *
 * THMA = wma(3 * wma(src, len / 3) - wma(src, len / 2) - wma(src, len), len), compared with its value 2 bars back.
 * The candles go from THMA (open) to THMA[2] (close); their high / low add the volatility, an HMA of the bar range
 * (high - low) over the volatility length. The colour is the up colour while THMA is above THMA[2], else the down
 * colour. Triangles mark the crossings of THMA and THMA[2], one ATR(200) away from THMA[2]. A table on the last bar
 * shows the trend of the last crossing and the volatility in percent of its highest value of the last 1,000 bars.
 *
 * Chart values read: the chart foreground and background colours (table background, border and text). Without a
 * chart context the dark theme colours are used.
 *
 * Reference: "Triangular Hull Moving Average + Volatility [BigBeluga]" by BigBeluga
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BigBeluga
 */

import {
  ta, Series, getSourceSeries, color, str,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig, type SourceType,
} from 'oakscriptjs';
import type { MarkerData, PlotCandleData, TableData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { backgroundColorOf, foregroundColorOf, type ChartContext } from '../chart-context';

export interface TriangularHullMovingAverageVolatilityInputs {
  len: number;
  source: SourceType;
  volat: boolean;
  lenVol: number;
  colorUp: string;
  colorDn: string;
}

export const defaultInputs: TriangularHullMovingAverageVolatilityInputs = {
  len: 40,
  source: 'close',
  volat: true,
  lenVol: 15,
  colorUp: '#16e5a0',
  colorDn: '#741ddd',
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 40 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'volat', type: 'bool', title: 'Volatility', defval: true, inline: 'vola' },
  { id: 'lenVol', type: 'int', title: '', defval: 15, inline: 'vola' },
  { id: 'colorUp', type: 'color', title: '', defval: '#16e5a0', inline: 'colors' },
  { id: 'colorDn', type: 'color', title: '', defval: '#741ddd', inline: 'colors' },
];

export const plotConfig: PlotConfig[] = [];

/** plotcandle(thma, thma + volatility, thma1 - volatility, thma1, "") */
export const plotCandleConfig = [{ id: 'candle', title: '' }];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Up', style: 'triangleup', location: 'absolute', color: '#2962ff', size: 'small', forceOverlay: true },
  { id: 'shape1', kind: 'shape', title: 'Up', style: 'triangleup', location: 'absolute', color: '#2962ff', size: 'tiny', forceOverlay: true },
  { id: 'shape2', kind: 'shape', title: 'Dn', style: 'triangledown', location: 'absolute', color: '#2962ff', size: 'small', forceOverlay: true },
  { id: 'shape3', kind: 'shape', title: 'Dn', style: 'triangledown', location: 'absolute', color: '#2962ff', size: 'tiny', forceOverlay: true },
];

export const drawingKinds: StudyDrawingKind[] = ['table'];

export const metadata = {
  title: 'Triangular Hull Moving Average + Volatility [BigBeluga]',
  shortTitle: 'THMA + Volatility [BigBeluga]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

const UP = '\u{1F881}';
const DN = '\u{1F883}';

export function calculate(
  bars: Bar[],
  inputs: Partial<TriangularHullMovingAverageVolatilityInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]>; tables: TableData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const fg = foregroundColorOf(chart);
  const bg = backgroundColorOf(chart);

  // float volatility = ta.hma(high - low, len_vol)
  const volatility = A(ta.hma(new Series(bars, (b) => b.high - b.low), cfg.lenVol));
  // vv = ta.percentile_nearest_rank(volatility, 1000, 100)
  const vv = A(ta.percentile_nearest_rank(Series.fromArray(bars, volatility), 1000, 100));

  // thma(_src, _length) => ta.wma(ta.wma(_src, _length / 3) * 3 - ta.wma(_src, _length / 2) - ta.wma(_src, _length), _length)
  const src = getSourceSeries(bars, cfg.source);
  const w3 = A(ta.wma(src, cfg.len / 3));
  const w2 = A(ta.wma(src, cfg.len / 2));
  const w1 = A(ta.wma(src, cfg.len));
  const inner = w3.map((v, i) => v * 3 - w2[i] - w1[i]);
  const thma = A(ta.wma(Series.fromArray(bars, inner), cfg.len));
  const thma1 = thma.map((_, i) => (i >= 2 ? thma[i - 2] : NaN));
  const thmaS = Series.fromArray(bars, thma);
  const thma1S = Series.fromArray(bars, thma1);
  const up = ta.crossover(thmaS, thma1S).toArray().map(Boolean);
  const dn = ta.crossunder(thmaS, thma1S).toArray().map(Boolean);
  const atr = A(ta.atr(bars, 200));

  const markers: MarkerData[] = [];
  const candles: PlotCandleData[] = [];
  let trend = '';
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (up[i]) trend = UP;
    else if (dn[i]) trend = DN;
    // color = thma > thma1 ? color_u : color_d
    const c = gt(thma[i], thma1[i]) ? cfg.colorUp : cfg.colorDn;
    const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
    candles.push({
      time: t,
      open: fin(thma[i]),
      high: fin(thma[i] + volatility[i]),
      low: fin(thma1[i] - volatility[i]),
      close: fin(thma1[i]),
      color: String(color.new(c, cfg.volat ? 40 : 0)),
      wickColor: String(color.new(c, cfg.volat ? 40 : 100)),
      borderColor: String(color.new(c, 0)),
    });
    // plotshape(signal_up ? thma1 - atr : na, "Up", shape.triangleup, location.absolute, ...)
    if (up[i] && Number.isFinite(thma1[i] - atr[i])) {
      const price = thma1[i] - atr[i];
      markers.push({ time: t, position: 'atPriceMiddle', price, shape: 'triangleUp', color: String(color.new(c, 60)), size: 'small', forceOverlay: true, id: 'shape0' });
      markers.push({ time: t, position: 'atPriceMiddle', price, shape: 'triangleUp', color: String(color.new(c, 0)), size: 'tiny', forceOverlay: true, id: 'shape1' });
    }
    if (dn[i] && Number.isFinite(thma1[i] + atr[i])) {
      const price = thma1[i] + atr[i];
      markers.push({ time: t, position: 'atPriceMiddle', price, shape: 'triangleDown', color: String(color.new(c, 60)), size: 'small', forceOverlay: true, id: 'shape2' });
      markers.push({ time: t, position: 'atPriceMiddle', price, shape: 'triangleDown', color: String(color.new(c, 0)), size: 'tiny', forceOverlay: true, id: 'shape3' });
    }
  }

  // if barstate.islast: dash = table.new(position.bottom_right, 10, 10, bgcolor = color.new(chart.fg_color, 90),
  //   border_color = chart.bg_color, border_width = 5)
  const tables: TableData[] = [];
  if (n > 0) {
    const vol = volatility[n - 1] / vv[n - 1];
    tables.push({
      position: 'bottom_right', columns: 10, rows: 10, bgColor: String(color.new(fg, 90)), borderColor: bg, borderWidth: 5,
      cells: [
        { column: 0, row: 0, text: 'Trend: ' + trend, textColor: trend === DN ? cfg.colorDn : cfg.colorUp, textSize: 'auto' },
        { column: 0, row: 1, text: 'Volatility: ' + str.tostring(vol * 100, 'percent'), textColor: fg, textSize: 'auto' },
      ],
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    plotCandles: { candle: candles },
    tables,
  };
}

export const TriangularHullMovingAverageVolatility = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
  shapeConfig,
  drawingKinds,
};
