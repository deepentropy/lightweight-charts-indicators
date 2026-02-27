/**
 * Matrix Series
 *
 * Oscillator with plotcandle visualization, S/R zone lines,
 * OB/OS cross markers, hlines, and fills.
 *
 * Reference: TradingView "Matrix Series" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData, MarkerData } from '../types';

export interface MatrixSeriesInputs {
  smoother: number;
  supResPeriod: number;
  supResPercentage: number;
  pricePeriod: number;
  ob: number;
  os: number;
  showOBOS: boolean;
  dynamic: boolean;
}

export const defaultInputs: MatrixSeriesInputs = {
  smoother: 5,
  supResPeriod: 50,
  supResPercentage: 100,
  pricePeriod: 16,
  ob: 200,
  os: -200,
  showOBOS: false,
  dynamic: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'smoother', type: 'int', title: 'Smoother', defval: 5, min: 1 },
  { id: 'supResPeriod', type: 'int', title: 'Sup/Res Period', defval: 50, min: 1 },
  { id: 'supResPercentage', type: 'int', title: 'Sup/Res Percentage', defval: 100, min: 1 },
  { id: 'pricePeriod', type: 'int', title: 'Price Period', defval: 16, min: 1 },
  { id: 'ob', type: 'int', title: 'Overbought', defval: 200 },
  { id: 'os', type: 'int', title: 'Oversold', defval: -200 },
  { id: 'showOBOS', type: 'bool', title: 'Show OB/OS', defval: false },
  { id: 'dynamic', type: 'bool', title: 'Dynamic Zones', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'resistance', title: 'Resistance Line', color: '#26A69A', lineWidth: 1 },
  { id: 'support', title: 'Support Line', color: '#EF5350', lineWidth: 1 },
  { id: 'obMarker', title: 'OB Cross', color: '#00FFFF', lineWidth: 2 },
  { id: 'osMarker', title: 'OS Cross', color: '#00FFFF', lineWidth: 2 },
];

export const metadata = {
  title: 'Matrix Series',
  shortTitle: 'MTX',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MatrixSeriesInputs> = {}): IndicatorResult & { plotCandles: { candle0: PlotCandleData[] }; markers: MarkerData[] } {
  const { smoother, supResPeriod, supResPercentage, pricePeriod, ob, os, showOBOS, dynamic } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const nn = smoother;

  // Pine plotcandle: ys1 = (high+low+close*2)/4, then series of EMA/stdev transforms
  const ys1Series = new Series(bars, (b) => (b.high + b.low + b.close * 2) / 4);
  const rk3 = ta.ema(ys1Series, nn);
  const rk4 = ta.stdev(ys1Series, nn);
  const rk3Arr = rk3.toArray();
  const rk4Arr = rk4.toArray();

  const rk5Arr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const ys1Val = (bars[i].high + bars[i].low + bars[i].close * 2) / 4;
    const r3 = rk3Arr[i] ?? NaN;
    const r4 = rk4Arr[i] ?? NaN;
    rk5Arr[i] = (r4 !== 0 && !isNaN(r4)) ? (ys1Val - r3) * 200 / r4 : 0;
  }
  const rk5Series = new Series(bars, (_b, i) => rk5Arr[i]);
  const rk6 = ta.ema(rk5Series, nn);
  const upSeries = ta.ema(rk6, nn);
  const downSeries = ta.ema(upSeries, nn);
  const upArr = upSeries.toArray();
  const downArr = downSeries.toArray();

  const candleWarmup = nn * 4;
  const candles: PlotCandleData[] = bars.map((b, i) => {
    const up = upArr[i] ?? NaN;
    const dn = downArr[i] ?? NaN;
    if (isNaN(up) || isNaN(dn) || i < candleWarmup) {
      return { time: b.time, open: NaN, high: NaN, low: NaN, close: NaN };
    }
    // Pine: Oo = iff(up<down, up, down), Hh=Oo, Ll=iff(up<down, down, up), Cc=Ll
    // vcolor = Oo > Cc ? red : up > down ? green : red
    const Oo = up < dn ? up : dn;
    const Ll = up < dn ? dn : up;
    const color = up > dn ? '#26A69A' : '#EF5350';
    return { time: b.time, open: Oo, high: Oo, low: Ll, close: Ll, color };
  });

  // S/R Zones: Pine CCI-based
  // C3 = cci(close, Pds), then highest/lowest over Lookback, then percentage calc
  const closeSeries = new Series(bars, (b) => b.close);
  const hlc3Series = new Series(bars, (b) => (b.high + b.low + b.close) / 3);
  const cciArr = ta.cci(hlc3Series, pricePeriod).toArray();
  const cciSeries = new Series(bars, (_b, i) => cciArr[i] ?? 0);
  const value2Arr = ta.highest(cciSeries, supResPeriod).toArray();
  const value3Arr = ta.lowest(cciSeries, supResPeriod).toArray();

  const srWarmup = Math.max(pricePeriod, supResPeriod);

  // Pine: ResistanceLine = Value3 + Value4 * (PerCent/100)
  // Pine: SupportLine = Value2 - Value4 * (PerCent/100)
  const resistancePlot = bars.map((b, i) => {
    if (!dynamic || i < srWarmup || value2Arr[i] == null || value3Arr[i] == null) {
      return { time: b.time, value: NaN };
    }
    const v2 = value2Arr[i]!;
    const v3 = value3Arr[i]!;
    const v4 = v2 - v3;
    const v5 = v4 * (supResPercentage / 100);
    return { time: b.time, value: v3 + v5 };
  });

  const supportPlot = bars.map((b, i) => {
    if (!dynamic || i < srWarmup || value2Arr[i] == null || value3Arr[i] == null) {
      return { time: b.time, value: NaN };
    }
    const v2 = value2Arr[i]!;
    const v3 = value3Arr[i]!;
    const v4 = v2 - v3;
    const v5 = v4 * (supResPercentage / 100);
    return { time: b.time, value: v2 - v5 };
  });

  // OB/OS cross markers
  // Pine: UPshape = up > ob and up>down ? highest(up,1)+20 : up>ob and up<down ? highest(down,1)+20 : na
  // Pine: DOWNshape = down < os and up>down ? lowest(down,1)-20 : down<os and up<down ? lowest(up,1)-20 : na
  const markers: MarkerData[] = [];
  const obMarkerPlot = bars.map((b, i) => {
    if (i < candleWarmup) return { time: b.time, value: NaN };
    const up = upArr[i] ?? NaN;
    const dn = downArr[i] ?? NaN;
    if (isNaN(up) || isNaN(dn)) return { time: b.time, value: NaN };
    if (up > ob && up > dn) return { time: b.time, value: up + 20 };
    if (up > ob && up < dn) return { time: b.time, value: dn + 20 };
    return { time: b.time, value: NaN };
  });

  const osMarkerPlot = bars.map((b, i) => {
    if (i < candleWarmup) return { time: b.time, value: NaN };
    const up = upArr[i] ?? NaN;
    const dn = downArr[i] ?? NaN;
    if (isNaN(up) || isNaN(dn)) return { time: b.time, value: NaN };
    if (dn < os && up > dn) return { time: b.time, value: dn - 20 };
    if (dn < os && up < dn) return { time: b.time, value: up - 20 };
    return { time: b.time, value: NaN };
  });

  // Build hlines conditionally based on showOBOS
  const hlines: any[] = [];
  if (showOBOS) {
    hlines.push({ value: ob, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } });
    hlines.push({ value: os, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'resistance': resistancePlot,
      'support': supportPlot,
      'obMarker': obMarkerPlot,
      'osMarker': osMarkerPlot,
    },
    hlines,
    plotCandles: { candle0: candles },
    markers,
  };
}

export const MatrixSeries = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
