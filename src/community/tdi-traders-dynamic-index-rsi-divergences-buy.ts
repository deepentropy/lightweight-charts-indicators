/**
 * TDI - Traders Dynamic Index + RSI Divergences + Buy/Sell Signals
 *
 * Traders Dynamic Index on the RSI of the close: volatility bands = SMA(RSI, band length) +/- 1.6185 * standard
 * deviation, their middle (MBL), a fast price line (SMA of the RSI over "Slow MA on RSI" bars, RSI PL) and a signal
 * line (SMA over "Fast MA on RSI" bars, TSL Signal) with a green / red cloud between the two. Long / short labels
 * (bottom / top of the pane) mark crosses of the price line over / under the signal line when the signal line is
 * above / below both the MBL and 50; the background is lime while the price line is above the MBL. RSI divergences
 * (pivots of a second RSI, lookback left / right): regular and hidden bullish / bearish lines and labels, drawn
 * `lbR` bars back on the pivot.
 * Alerts (alertcondition, `alerts` of the result): Long, Short, RSI Crosses Yellow (price line over the MBL).
 *
 * Reference: "TDI - Traders Dynamic Index + RSI Divergences + Buy/Sell Signals" by ZyadaCharts
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Credits to LazyBear and JustUncleL.. more features added by ZyadaCharts
 */

import {
  ta, Series, color, getSourceSeries,
  type Bar, type BarColorConfig, type FillConfig, type FillData, type HLineConfig, type IndicatorResult,
  type InputConfig, type PlotConfig, type ShapeConfig, type SourceType,
} from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface TdiTradersDynamicIndexRsiDivergencesBuyInputs {
  /** RSI Period of the TDI */
  rsiPeriod: number;
  bandLength: number;
  /** Fast MA on RSI (signal line length) */
  lengthrsipl: number;
  /** Slow MA on RSI (price line length) */
  lengthtradesl: number;
  /** RSI Period of the divergences */
  len: number;
  /** RSI Source of the divergences */
  src: SourceType;
  lbR: number;
  lbL: number;
  rangeUpper: number;
  rangeLower: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
}

export const defaultInputs: TdiTradersDynamicIndexRsiDivergencesBuyInputs = {
  rsiPeriod: 14,
  bandLength: 34,
  lengthrsipl: 7,
  lengthtradesl: 2,
  len: 14,
  src: 'close',
  lbR: 5,
  lbL: 5,
  rangeUpper: 60,
  rangeLower: 5,
  plotBull: true,
  plotHiddenBull: false,
  plotBear: true,
  plotHiddenBear: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 14, min: 1 },
  { id: 'bandLength', type: 'int', title: 'Band Length', defval: 34, min: 1 },
  { id: 'lengthrsipl', type: 'int', title: 'Fast MA on RSI', defval: 7, min: 0 },
  { id: 'lengthtradesl', type: 'int', title: 'Slow MA on RSI', defval: 2, min: 1 },
  { id: 'len', type: 'int', title: 'RSI Period', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5 },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 5 },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60 },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 5 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
];

/** Pine v4 colours */
const RED = '#FF5252';
const ORANGE = '#FF9800';
const GREEN = '#4CAF50';
const LIME = '#00E676';
const WHITE = '#FFFFFF';
const BAND = String(color.new('#12bcc9', 60));
const MBL = String(color.new(ORANGE, 40));
const RSI_PL = String(color.new(LIME, 30));
const TSL = String(color.new(RED, 60));
const CLOUD_UP = String(color.new(GREEN, 80));
const CLOUD_DN = String(color.new(RED, 80));
const BG = String(color.new(LIME, 95));
const HIDDEN_BULL = String(color.new(GREEN, 80));
const HIDDEN_BEAR = String(color.new(RED, 80));
const NONE = String(color.new(WHITE, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VB Channel High', color: BAND, lineWidth: 2 },
  { id: 'plot1', title: 'VB Channel Low', color: BAND, lineWidth: 2 },
  { id: 'plot2', title: 'MBL', color: MBL, lineWidth: 2 },
  { id: 'plot3', title: 'RSI PL', color: RSI_PL, lineWidth: 2 },
  { id: 'plot4', title: 'TSL Signal', color: TSL, lineWidth: 2 },
  { id: 'plot5', title: 'Regular Bullish', color: GREEN, lineWidth: 2, offset: -5 },
  { id: 'plot6', title: 'Hidden Bullish', color: HIDDEN_BULL, lineWidth: 2, offset: -5 },
  { id: 'plot7', title: 'Regular Bearish', color: RED, lineWidth: 2, offset: -5 },
  { id: 'plot8', title: 'Hidden Bearish', color: HIDDEN_BEAR, lineWidth: 2, offset: -5 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline0', price: 30, title: 'Level', color: RED, linestyle: 'dotted', linewidth: 1 },
  { id: 'hline1', price: 50, title: 'Level', color: ORANGE, linestyle: 'dotted', linewidth: 1 },
  { id: 'hline2', price: 70, title: 'Level', color: GREEN, linestyle: 'dotted', linewidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot3', plot2: 'plot4', title: 'Plots Background', palette: [CLOUD_UP, CLOUD_DN] },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Shapes', style: 'labelup', location: 'bottom', color: LIME, size: 'tiny' },
  { id: 'shape1', kind: 'shape', title: 'Shapes', style: 'labeldown', location: 'top', color: RED, size: 'tiny' },
  { id: 'shape2', kind: 'shape', title: 'Regular Bullish Label', style: 'labelup', location: 'absolute', color: GREEN, text: ' Bull ', textcolor: WHITE, offset: -5 },
  { id: 'shape3', kind: 'shape', title: 'Hidden Bullish Label', style: 'labelup', location: 'absolute', color: GREEN, text: ' H Bull ', textcolor: WHITE, offset: -5 },
  { id: 'shape4', kind: 'shape', title: 'Regular Bearish Label', style: 'labeldown', location: 'absolute', color: RED, text: ' Bear ', textcolor: WHITE, offset: -5 },
  { id: 'shape5', kind: 'shape', title: 'Hidden Bearish Label', style: 'labeldown', location: 'absolute', color: RED, text: ' H Bear ', textcolor: WHITE, offset: -5 },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' }];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long', message: 'Crossover' },
  { id: 'alert1', title: 'Short', message: 'Crossunder' },
  { id: 'alert2', title: 'RSI Crosses Yellow', message: 'rsi crosses mid' },
];

export const metadata = {
  title: 'TDI - Traders Dynamic Index + RSI Divergences + Buy/Sell Signals',
  shortTitle: 'TDI + RSI Div',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color?: string };

export function calculate(
  bars: Bar[],
  inputs: Partial<TdiTradersDynamicIndexRsiDivergencesBuyInputs> = {},
): Omit<IndicatorResult, 'markers' | 'bgColors'> & { markers: MarkerData[]; bgColors: BgColorData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { lbR, lbL, rangeUpper, rangeLower } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));

  // TDI
  const rS = ta.rsi(new Series(bars, (b) => b.close), cfg.rsiPeriod);
  const r = A(rS);
  const ma = A(ta.sma(rS, cfg.bandLength));
  const sd = A(ta.stdev(rS, cfg.bandLength));
  const up = ma.map((m, i) => m + 1.6185 * sd[i]);
  const dn = ma.map((m, i) => m - 1.6185 * sd[i]);
  const mid = up.map((u, i) => (u + dn[i]) / 2);
  const mbb = A(ta.sma(rS, cfg.lengthrsipl));
  const mab = A(ta.sma(rS, cfg.lengthtradesl));
  const S = (a: number[]) => Series.fromArray(bars, a);
  const xUp = ta.crossover(S(mab), S(mbb)).toArray();
  const xDn = ta.crossunder(S(mab), S(mbb)).toArray();
  const xMid = ta.crossover(S(mab), S(mid)).toArray();

  // Divergences
  const oscS = ta.rsi(getSourceSeries(bars, cfg.src), cfg.len);
  const osc = A(oscS);
  const pl = A(ta.pivotlow(oscS, lbL, lbR));
  const ph = A(ta.pivothigh(oscS, lbL, lbR));
  const plFound = pl.map((v) => !Number.isNaN(v));
  const phFound = ph.map((v) => !Number.isNaN(v));

  const line = (): Point[] => bars.map((b) => ({ time: b.time, value: NaN }));
  const regBull = line();
  const hidBull = line();
  const regBear = line();
  const hidBear = line();
  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];
  const fillColors: string[] = [];
  const flags: boolean[][] = [[], [], []];
  const p = (a: number[]): Point[] => a.map((value, i) => ({ time: bars[i].time, value: fin(value) }));

  // barssince(plFound[1] == true), valuewhen(plFound, x, 1): the values of the pivot before
  let plBars = NaN;
  let phBars = NaN;
  let plOsc = NaN, plLow = NaN, phOsc = NaN, phHigh = NaN;
  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    fillColors.push(gt(mab[i], mbb[i]) ? CLOUD_UP : CLOUD_DN);
    const long1 = !!xUp[i] && gt(mbb[i], mid[i]) && gt(mbb[i], 50);
    const short1 = !!xDn[i] && lt(mbb[i], mid[i]) && lt(mbb[i], 50);
    flags[0].push(long1);
    flags[1].push(short1);
    flags[2].push(!!xMid[i]);
    if (long1) markers.push({ id: 'shape0', time, position: 'bottom', shape: 'labelUp', color: LIME, size: 'tiny' });
    if (short1) markers.push({ id: 'shape1', time, position: 'top', shape: 'labelDown', color: RED, size: 'tiny' });
    if (gt(mab[i], mid[i])) bgColors.push({ id: 'bgcolor0', time, color: BG });

    if (i > 0 && plFound[i - 1]) plBars = 0;
    else if (!Number.isNaN(plBars)) plBars++;
    if (i > 0 && phFound[i - 1]) phBars = 0;
    else if (!Number.isNaN(phBars)) phBars++;
    const plInRange = rangeLower <= plBars && plBars <= rangeUpper;
    const phInRange = rangeLower <= phBars && phBars <= rangeUpper;
    const k = i - lbR; // the pivot bar (osc[lbR]), where the offset -lbR draws
    if (plFound[i]) {
      const o = osc[k];
      const low = bars[k].low;
      const bullCond = cfg.plotBull && lt(low, plLow) && gt(o, plOsc) && plInRange;
      const hiddenBullCond = cfg.plotHiddenBull && gt(low, plLow) && lt(o, plOsc) && plInRange;
      regBull[k] = { time: bars[k].time, value: o, color: bullCond ? GREEN : NONE };
      hidBull[k] = { time: bars[k].time, value: o, color: hiddenBullCond ? HIDDEN_BULL : NONE };
      if (bullCond) markers.push({ id: 'shape2', time: bars[k].time, position: 'atPriceBottom', price: o, shape: 'labelUp', color: GREEN, text: ' Bull ', textColor: WHITE });
      if (hiddenBullCond) markers.push({ id: 'shape3', time: bars[k].time, position: 'atPriceBottom', price: o, shape: 'labelUp', color: GREEN, text: ' H Bull ', textColor: WHITE });
      plOsc = o;
      plLow = low;
    }
    if (phFound[i]) {
      const o = osc[k];
      const high = bars[k].high;
      const bearCond = cfg.plotBear && gt(high, phHigh) && lt(o, phOsc) && phInRange;
      const hiddenBearCond = cfg.plotHiddenBear && lt(high, phHigh) && gt(o, phOsc) && phInRange;
      regBear[k] = { time: bars[k].time, value: o, color: bearCond ? RED : NONE };
      hidBear[k] = { time: bars[k].time, value: o, color: hiddenBearCond ? HIDDEN_BEAR : NONE };
      if (bearCond) markers.push({ id: 'shape4', time: bars[k].time, position: 'atPriceTop', price: o, shape: 'labelDown', color: RED, text: ' Bear ', textColor: WHITE });
      if (hiddenBearCond) markers.push({ id: 'shape5', time: bars[k].time, position: 'atPriceTop', price: o, shape: 'labelDown', color: RED, text: ' H Bear ', textColor: WHITE });
      phOsc = o;
      phHigh = high;
    }
  }
  // Markers in time order (the divergence labels are drawn lbR bars back)
  markers.sort((a, b) => a.time - b.time);

  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot3', plot2: 'plot4', options: { title: 'Plots Background' }, colors: fillColors },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: p(up), plot1: p(dn), plot2: p(mid), plot3: p(mab), plot4: p(mbb),
      plot5: regBull, plot6: hidBull, plot7: regBear, plot8: hidBear,
    },
    hlines: [
      { value: 30, options: { title: 'Level', color: RED, linestyle: 'dotted', linewidth: 1 } },
      { value: 50, options: { title: 'Level', color: ORANGE, linestyle: 'dotted', linewidth: 1 } },
      { value: 70, options: { title: 'Level', color: GREEN, linestyle: 'dotted', linewidth: 1 } },
    ],
    fills,
    markers,
    bgColors,
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const TdiTradersDynamicIndexRsiDivergencesBuy = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig, shapeConfig, barColorConfig,
  alertConditions,
};
