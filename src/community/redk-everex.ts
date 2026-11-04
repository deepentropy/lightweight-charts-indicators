/**
 * RedK Effort Versus Results Explorer v3.0 (EVEREX)
 *
 * Effort (volume) versus result (price) per bar. The volume is normalized against its lookback average into bands
 * (10 .. 100; 100 without volume data). The price strength is the average of 6 elements: the close within the bar,
 * the spread to range ratio, the relative spread (normalized against its average), the close within the 2-bar range,
 * the close change to the 2-bar range and the relative close change (normalized). The bar flow (price strength *
 * normalized volume / 100) is split into bulls and bears; their averages give an RSI-like Relative Rate of Flow
 * RROF = 2 * (100 - 100 / (1 + bulls / bears)) - 100, smoothed by a WMA, with a signal line and an optional longer
 * Bias / Sentiment area. Stacked "equalizer" candles show the normalized volume and price bands (scaled by the band
 * scale) with guide levels; markers at zero flag Ease of Move, Compression and MegaBar bars; optional control levels.
 *
 * Alerts (alertcondition, `alerts` of the result): RROF Smooth crossing 0 up, down, and either way.
 *
 * Reference: "RedK Effort Versus Results Explorer v3.0" by RedKTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © RedKTrader - March 2023
 */

import { ta, taCore, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type HLineData } from 'oakscriptjs';
import type { MarkerData, PlotCandleData, OutputValues } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export type RedkEverexMaType = 'WMA' | 'EMA' | 'SMA' | 'HMA' | 'RMA';

export interface RedkEverexInputs {
  /** RoF length */
  length: number;
  /** MA type of the RoF (and of the lookback when 'Same as RRoF') */
  maType: RedkEverexMaType;
  /** WMA smoothing of the RROF */
  smooth: number;
  sigLength: number;
  sigType: RedkEverexMaType;
  /** Lookback length of the volume / spread / shift averages */
  lookback: number;
  lookbackCalc: 'Simple' | 'Same as RRoF';
  showBias: boolean;
  biasLength: number;
  biasType: RedkEverexMaType;
  showEverex: boolean;
  bandScale: '100' | '200' | '400';
  bandOption: 'Joint' | 'Separate';
  showMarkers: boolean;
  showLevels: boolean;
  ctrLevel: number;
}

export const defaultInputs: RedkEverexInputs = {
  length: 10,
  maType: 'WMA',
  smooth: 3,
  sigLength: 5,
  sigType: 'WMA',
  lookback: 20,
  lookbackCalc: 'Simple',
  showBias: false,
  biasLength: 30,
  biasType: 'WMA',
  showEverex: true,
  bandScale: '100',
  bandOption: 'Joint',
  showMarkers: true,
  showLevels: true,
  ctrLevel: 25,
};

const GRP_1 = 'Rate of FLow (RoF)';
const GRP_2 = 'Lookback Parameters';
const GRP_3 = 'Bias / Sentiment';
const GRP_4 = 'EVEREX Bands';
const MA_TYPES = ['WMA', 'EMA', 'SMA', 'HMA', 'RMA'];

// Untitled inputs keep their variable names as titles
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 10, min: 1, inline: 'ROF', group: GRP_1 },
  { id: 'maType', type: 'string', title: 'MA type', defval: 'WMA', options: MA_TYPES, inline: 'ROF', group: GRP_1 },
  { id: 'smooth', type: 'int', title: 'Smooth', defval: 3, min: 1, inline: 'ROF', group: GRP_1 },
  { id: 'sigLength', type: 'int', title: 'Signal Length', defval: 5, min: 1, inline: 'Signal', group: GRP_1 },
  { id: 'sigType', type: 'string', title: 'Signal Type', defval: 'WMA', options: MA_TYPES, inline: 'Signal', group: GRP_1 },
  { id: 'lookback', type: 'int', title: 'Length', defval: 20, min: 1, inline: 'Lookback', group: GRP_2 },
  { id: 'lookbackCalc', type: 'string', title: 'Averaging', defval: 'Simple', options: ['Simple', 'Same as RRoF'], inline: 'Lookback', group: GRP_2 },
  { id: 'showBias', type: 'bool', title: 'Bias Plot ? -- ', defval: false, inline: 'Bias', group: GRP_3 },
  { id: 'biasLength', type: 'int', title: 'Length', defval: 30, min: 1, inline: 'Bias', group: GRP_3 },
  { id: 'biasType', type: 'string', title: 'MA type', defval: 'WMA', options: MA_TYPES, inline: 'Bias', group: GRP_3 },
  { id: 'showEverex', type: 'bool', title: 'Show EVEREX Bands ? -- ', defval: true, inline: 'EVEREX', group: GRP_4 },
  { id: 'bandScale', type: 'string', title: 'Band Scale', defval: '100', options: ['100', '200', '400'], inline: 'EVEREX', group: GRP_4 },
  { id: 'bandOption', type: 'string', title: 'Band Option', defval: 'Joint', options: ['Joint', 'Separate'], group: GRP_4 },
  { id: 'showMarkers', type: 'bool', title: 'Show EVEREX Markers ?', defval: true },
  { id: 'showLevels', type: 'bool', title: 'Show Control Levels', defval: true, inline: 'control' },
  { id: 'ctrLevel', type: 'int', title: '     Level', defval: 25, inline: 'control' },
];

const C_UP = color.aqua;
const C_DN = color.orange;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bulls', color: '#11ff20', lineWidth: 2, display: 'none' },
  { id: 'plot1', title: 'Bears', color: '#d5180b', lineWidth: 2, display: 'none' },
  // display = showBias ? display.pane : display.none
  { id: 'plot2', title: 'Bias / Sentiment', color: String(color.new('#00aa00', 70)), lineWidth: 4, style: 'area', visible: 'showBias' },
  { id: 'plot3', title: 'RROF Raw', color: String(color.new('#2470f0', 9)), lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Signal Line', color: String(color.new('#b8b8b8', 33)), lineWidth: 2 },
  { id: 'plot5', title: 'RROF Smooth', color: C_UP, lineWidth: 3 },
];

/** plotcandle 'Volume Band' and 'Price Band' (display = showEVEREX ? display.pane : display.none) */
export const plotCandleConfig = [
  { id: 'candle0', title: 'Volume Band' },
  { id: 'candle1', title: 'Price Band' },
];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '.   RROF Crossing 0 Up', message: 'RROF Up - Buying Action Detected!' },
  { id: 'alert1', title: '..  RROF Crossing 0 Down', message: 'RROF Down - Selling Action Detected!' },
  { id: 'alert2', title: '... RROF Crossing 0', message: 'RROF Swing - Possible Reversal' },
];

export const metadata = {
  title: 'RedK Effort Versus Results Explorer v3.0',
  shortTitle: 'RedK EVEREX v3.0',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** Normalize(_Value, _Avg): the value / average ratio in bands (an na ratio gives 0.1) */
export function normalize(value: number, avg: number): number {
  const x = value / avg;
  return gt(x, 1.5) ? 1.0 : gt(x, 1.2) ? 0.9 : gt(x, 1.0) ? 0.8 : gt(x, 0.8) ? 0.7 : gt(x, 0.6) ? 0.6
    : gt(x, 0.4) ? 0.5 : gt(x, 0.2) ? 0.25 : 0.1;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RedkEverexInputs> = {},
): Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[];
  plotCandles: Record<string, PlotCandleData[]>;
  outputValues: OutputValues;
  alerts: AlertConditionState[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (a: number[]) => Series.fromArray(bars, a);
  const t = (i: number) => bars[i].time;

  // GetAverage(_data, _len, MAOption)
  const getAverage = (data: number[], len: number, opt: string): number[] => {
    const s = S(data);
    switch (opt) {
      case 'SMA': return A(ta.sma(s, len));
      case 'EMA': return A(ta.ema(s, len));
      case 'HMA': return A(ta.hma(s, len));
      case 'RMA': return A(ta.rma(s, len));
      default: return A(ta.wma(s, len));
    }
  };

  // Volume "effort": v = na(volume) ? 1 : volume
  const vol = bars.map((b) => b.volume ?? NaN);
  const v = vol.map((x) => (isNaN(x) ? 1 : x));
  const lkbkType = cfg.lookbackCalc === 'Simple' ? 'SMA' : cfg.maType;
  const vola = getAverage(v, cfg.lookback, lkbkType);
  const volaN = v.map((x, i) => (isNaN(vol[i]) ? 100 : normalize(x, vola[i]) * 100));

  // Price "result"
  const close = bars.map((b) => b.close);
  const hh2 = A(ta.highest(S(bars.map((b) => b.high)), 2));
  const ll2 = A(ta.lowest(S(bars.map((b) => b.low)), 2));
  const srcShift = close.map((c, i) => (i > 0 ? c - close[i - 1] : NaN));
  const barSpread = bars.map((b) => b.close - b.open);
  const barSpreadAbs = barSpread.map(Math.abs);
  const barSpreadAvg = getAverage(barSpreadAbs, cfg.lookback, lkbkType);
  const srcShiftAbs = srcShift.map(Math.abs);
  const srcShiftAvg = getAverage(srcShiftAbs, cfg.lookback, lkbkType);

  const priceaN: number[] = new Array(n);
  const barFlow: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const barRange = b.high - b.low;
    const r2 = hh2[i] - ll2[i];
    // 1. close within the bar, 2. spread to range, 3. relative spread
    const barclosing = ((2 * (b.close - b.low)) / barRange) * 100 - 100;
    const s2r = (barSpread[i] / barRange) * 100;
    const barSpreadRatioN = normalize(barSpreadAbs[i], barSpreadAvg[i]) * 100 * Math.sign(barSpread[i]);
    // 4. close within the 2-bar range, 5. 2-bar shift to range, 6. 2-bar relative shift
    const barclosing2 = ((2 * (b.close - ll2[i])) / r2) * 100 - 100;
    const shift2BarToR2 = (srcShift[i] / r2) * 100;
    const srcShiftRatioN = normalize(srcShiftAbs[i], srcShiftAvg[i]) * 100 * Math.sign(srcShift[i]);
    priceaN[i] = (barclosing + s2r + barSpreadRatioN + barclosing2 + shift2BarToR2 + srcShiftRatioN) / 6;
    barFlow[i] = (priceaN[i] * volaN[i]) / 100;
  }

  // Bulls / bears (math.max / math.min of na are na)
  const bulls = barFlow.map((x) => Math.max(x, 0));
  const bears = barFlow.map((x) => -1 * Math.min(x, 0));
  const bullsAvg = getAverage(bulls, cfg.length, cfg.maType);
  const bearsAvg = getAverage(bears, cfg.length, cfg.maType);
  const rrofOf = (bu: number[], be: number[]) => bu.map((x, i) => 2 * (100 - 100 / (1 + x / be[i])) - 100);
  const rrof = rrofOf(bullsAvg, bearsAvg);
  const rrofS = A(ta.wma(S(rrof), cfg.smooth));
  const signal = getAverage(rrofS, cfg.sigLength, cfg.sigType);
  // Bias / sentiment on the longer length
  const rrofB = rrofOf(getAverage(bulls, cfg.biasLength, cfg.biasType), getAverage(bears, cfg.biasLength, cfg.biasType));
  const rrofBs = A(ta.wma(S(rrofB), cfg.smooth));
  const bullsPlot = A(ta.wma(S(bullsAvg), cfg.smooth));
  const bearsPlot = A(ta.wma(S(bearsAvg), cfg.smooth));

  const cSup = String(color.new('#00aa00', 70));
  const cSdn = String(color.new('#ff180b', 70));
  const cVolGrn = String(color.new('#26a69a', 75));
  const cVolRed = String(color.new('#ef5350', 75));
  const cbVolGrn = String(color.new('#26a69a', 20));
  const cbVolRed = String(color.new('#ef5350', 20));
  const cPriGrn = String(color.new('#3ed73e', 75));
  const cPriRed = String(color.new('#ff870a', 75));
  const cbPriGrn = String(color.new('#3ed73e', 20));
  const cbPriRed = String(color.new('#ff870a', 20));
  const green = color.green;
  const red = color.red;
  const bandscale = Number(cfg.bandScale);

  const plots: Record<string, { time: number; value: number; color?: string }[]> = {
    plot0: [], plot1: [], plot2: [], plot3: [], plot4: [], plot5: [],
  };
  const volumeBand: PlotCandleData[] = [];
  const priceBand: PlotCandleData[] = [];
  const outputValues: OutputValues = { char0: [], char1: [] };
  const markers: MarkerData[] = [];
  const shape = (on: boolean, id: string, time: number, s: MarkerData['shape'], c: string) => {
    // plotshape(cond ? 0 : na, ..., location = location.absolute, size = size.auto)
    if (on) markers.push({ id, time, position: 'atPriceMiddle', price: 0, shape: s, color: c, size: 'auto' });
  };

  for (let i = 0; i < n; i++) {
    const time = t(i);
    plots.plot0.push({ time, value: bullsPlot[i] });
    plots.plot1.push({ time, value: bearsPlot[i] });
    plots.plot2.push({ time, value: rrofBs[i], color: ge(rrofBs[i], 0) ? cSup : cSdn });
    plots.plot3.push({ time, value: rrof[i] });
    plots.plot4.push({ time, value: signal[i] });
    plots.plot5.push({ time, value: rrofS[i], color: ge(rrofS[i], 0) ? C_UP : C_DN });

    // Equalizer bands
    const nPrice = Math.max(Math.min(priceaN[i], 100), -100);
    const nVol = Math.max(Math.min(volaN[i], 100), -100);
    const up = gt(barFlow[i], 0);
    const cVol = up ? cVolGrn : cVolRed;
    const cPri = up ? cPriGrn : cPriRed;
    const vcHi = (nVol * bandscale) / 100 / 2;
    const pcLo = cfg.bandOption === 'Joint' ? vcHi : 0.5 * bandscale;
    const pcHi = pcLo + (Math.abs(nPrice) * bandscale) / 100 / 2;
    if (cfg.showEverex) {
      // plotcandle(vc_lo, vc_hi, vc_lo, vc_hi, 'Volume Band', c_vol, c_vol, bordercolor = cb_vol)
      if (!isNaN(vcHi)) {
        volumeBand.push({ time, open: 0, high: vcHi, low: 0, close: vcHi, color: cVol, wickColor: cVol, borderColor: up ? cbVolGrn : cbVolRed });
      }
      // plotcandle(pc_lo, pc_hi, pc_lo, pc_hi, 'Price Band', c_pri, c_pri, bordercolor = cb_pri)
      if (!isNaN(pcLo) && !isNaN(pcHi)) {
        priceBand.push({ time, open: pcLo, high: pcHi, low: pcLo, close: pcHi, color: cPri, wickColor: cPri, borderColor: up ? cbPriGrn : cbPriRed });
      }
    }
    // plotchar(nVol / nPrice, 'Normalized Vol' / 'Normalized Price', char = '', display = status line + data window)
    if (!isNaN(nVol)) outputValues.char0.push({ time, value: nVol });
    if (!isNaN(nPrice)) outputValues.char1.push({ time, value: nPrice });

    // Markers
    const nPriceAbs = Math.abs(nPrice);
    const evRatio = (100 * nPriceAbs) / nVol;
    const isPositive = gt(nPrice, 0);
    const isMegaBar = ge(nPriceAbs, 80) && ge(nVol, 80);
    const isCompression = le(evRatio, 50);
    const isEoM = ge(evRatio, 120) && !isMegaBar;
    if (cfg.showMarkers) {
      shape(isEoM && isPositive, 'shape2', time, 'triangleUp', green);
      shape(isEoM && !isPositive, 'shape3', time, 'triangleDown', red);
      shape(isCompression && isPositive, 'shape4', time, 'circle', green);
      shape(isCompression && !isPositive, 'shape5', time, 'circle', red);
      shape(isMegaBar && isPositive, 'shape6', time, 'arrowUp', green);
      shape(isMegaBar && !isPositive, 'shape7', time, 'arrowDown', red);
    }
  }

  // hlines (display = showhlines for the band levels; the control levels are na when hidden): ids in declaration order
  // color.new(color.yellow, 40) (Pine v6 color.yellow = #FDD835)
  const cBand = String(color.new('#FDD835', 40));
  const ctrColor = String(color.new('#ffee58', 30));
  const hlines: HLineData[] = [
    { id: 'hline0', value: 0, options: { title: 'Zero Line', color: String(color.new('#1163f6', 25)), linestyle: 'solid', linewidth: 1 } },
  ];
  if (cfg.showEverex) {
    ['1/4 Level', '2/4 Level', '3/4 Level', '4/4 Level'].forEach((title, k) => {
      hlines.push({ id: `hline${k + 1}`, value: 0.25 * (k + 1) * bandscale, options: { title, color: cBand, linestyle: 'dotted', linewidth: 1 } });
    });
  }
  if (cfg.showLevels) {
    hlines.push({ id: 'hline5', value: cfg.ctrLevel, options: { title: 'Level', color: ctrColor, linestyle: 'dashed', linewidth: 2 } });
    hlines.push({ id: 'hline6', value: -cfg.ctrLevel, options: { title: 'Level', color: ctrColor, linestyle: 'dashed', linewidth: 2 } });
  }

  // Alerts: ta.crossover / ta.crossunder / ta.cross of RROF_s and 0
  const zero = new Array<number>(n).fill(0);
  const flags = [taCore.crossover(rrofS, zero), taCore.crossunder(rrofS, zero), taCore.cross(rrofS, zero)];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    hlines,
    markers,
    plotCandles: { candle0: volumeBand, candle1: priceBand },
    outputValues,
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const RedkEverex = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, alertConditions };
