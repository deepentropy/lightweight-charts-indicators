/**
 * Traders Dynamic Index Indicator Alert (TDIALT)
 *
 * Traders Dynamic Index (TDI) on an RSI of the close: a volatility band (SMA of the RSI +/- 1.6185 standard
 * deviations over "lengthband" bars) with its middle line (MBL), the RSI price line (SMA 2 of the RSI) and the trade
 * signal line (SMA 7 of the RSI), with a fill between the two RSI lines (green when the price line is above).
 *
 * A Price Action Channel (smoothed moving average of the highs and of the lows) and an optional MACD direction
 * filter give the alert strength of each bar:
 * - long 1 / 2 / 3 (strong / medium / weak) when the price line is above the signal line, between the oversold and
 *   overbought levels, the high above the channel high and the bar rising; short 1 / 2 / 3 the same way down;
 * - the bar colour shows the strength (gold / aqua / blue for long, fuchsia / purple / black for short) up to the
 *   "Strength Level" input; optionally the other bars are gray;
 * - a dot at the bottom of the pane (drawn one bar back) marks the first alert bar of each sequence;
 * - optional spikes (100) on the first long / short signal of a run.
 *
 * Optionally every calculation uses Heikin Ashi candles of the chart.
 *
 * Reference: "Traders Dynamic Index Indicator Alert v1.3 by JustUncleL" by JustUncleL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, taCore, Series, heikinAshi,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig,
  type FillData, type ShapeConfig, type BarColorConfig,
} from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface TradersDynamicIndexIndicatorAlertV01ByInputs {
  /** RSI length */
  lengthrsi: number;
  /** Volatility band length */
  lengthband: number;
  /** RSI price line length */
  lengthrsipl: number;
  /** Trade signal line length */
  lengthtradesl: number;
  /** Price Action Channel length */
  lenH: number;
  rsiOSL: number;
  rsiOBL: number;
  /** 1 strong only, 2 strong and medium, 3 all */
  strength: number;
  /** Gray bars when there is no alert */
  sgb: boolean;
  /** Colour the alert bars */
  sbr: boolean;
  /** Dots of the alert condition */
  sal: boolean;
  /** Heikin Ashi candles for all calculations */
  uha: boolean;
  /** Spikes on the first long / short signals */
  sspikes: boolean;
  umacd: boolean;
  fastMA: number;
  slowMA: number;
  signal: number;
}

export const defaultInputs: TradersDynamicIndexIndicatorAlertV01ByInputs = {
  lengthrsi: 13,
  lengthband: 34,
  lengthrsipl: 2,
  lengthtradesl: 7,
  lenH: 5,
  rsiOSL: 22,
  rsiOBL: 78,
  strength: 2,
  sgb: false,
  sbr: true,
  sal: true,
  uha: false,
  sspikes: false,
  umacd: false,
  fastMA: 8,
  slowMA: 16,
  signal: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthrsi', type: 'int', title: 'lengthrsi', defval: 13 },
  { id: 'lengthband', type: 'int', title: 'lengthband', defval: 34 },
  { id: 'lengthrsipl', type: 'int', title: 'lengthrsipl', defval: 2 },
  { id: 'lengthtradesl', type: 'int', title: 'lengthtradesl', defval: 7 },
  { id: 'lenH', type: 'int', title: 'Price Action Channel Length', defval: 5, min: 1 },
  { id: 'rsiOSL', type: 'int', title: 'RSI Oversold Level', defval: 22, min: 0, max: 49 },
  { id: 'rsiOBL', type: 'int', title: 'RSI Overbought Level', defval: 78, min: 51, max: 100 },
  { id: 'strength', type: 'int', title: 'Strength Level: (1)Strong (2)Medium (3)All', defval: 2, min: 1, max: 3, step: 1 },
  { id: 'sgb', type: 'bool', title: 'Check Box To Turn Bars Gray', defval: false },
  { id: 'sbr', type: 'bool', title: 'Highlight TDI Alert Bars', defval: true },
  { id: 'sal', type: 'bool', title: 'Show Alert Condition Status', defval: true },
  { id: 'uha', type: 'bool', title: 'Use Heikin Ashi Candles for Calculations', defval: false },
  { id: 'sspikes', type: 'bool', title: 'Show Spike LONG and SHORT Signals', defval: false },
  { id: 'umacd', type: 'bool', title: 'Use MACD Filtering', defval: false },
  { id: 'fastMA', type: 'int', title: 'MACD Fast MA Length', defval: 8, min: 2, active: { input: 'umacd' } },
  { id: 'slowMA', type: 'int', title: 'MACD Slow MA Length', defval: 16, min: 7, active: { input: 'umacd' } },
  { id: 'signal', type: 'int', title: 'MACD Signal Length', defval: 1, min: 1, active: { input: 'umacd' } },
];

// Pine v3 colour constants; plots without transp have the v3 default transparency 35 (alpha byte A6)
const BLUE35 = '#0000FFA6';
const ORANGE35 = '#FF7F00A6';
const GREEN35 = '#008000A6';
const RED35 = '#FF0000A6';
/** transp = 50 */
const BLUE50 = '#0000FF80';
const RED50 = '#FF000080';
/** fill(..., transp = 90) */
const FILL_GREEN = '#0080001A';
const FILL_RED = '#FF00001A';
const GOLD = '#FFD700';
const AQUA = '#00FFFF';
const BLUE = '#0000FF';
const FUCHSIA = '#FF00FF';
const PURPLE = '#800080';
const BLACK = '#000000';
const GRAY = '#808080';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VB Channel High', color: BLUE35, lineWidth: 2 },
  { id: 'plot1', title: 'VB Channel Low', color: BLUE35, lineWidth: 2 },
  { id: 'plot2', title: 'MBL', color: ORANGE35, lineWidth: 2 },
  { id: 'plot3', title: 'RSI PL', color: GREEN35, lineWidth: 2 },
  { id: 'plot4', title: 'TSL Signal', color: RED35, lineWidth: 2 },
  { id: 'plot5', title: 'LONG', color: BLUE50, lineWidth: 1 },
  { id: 'plot6', title: 'SHORT', color: RED50, lineWidth: 1 },
];

/** hline(rsiOSL / 50 / rsiOBL), the v3 default style (dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline0', price: 22, color: '#FF0000', linestyle: 'dashed', linewidth: 1 },
  { id: 'hline1', price: 50, color: BLACK, linestyle: 'dashed', linewidth: 1 },
  { id: 'hline2', price: 78, color: '#00FF00', linestyle: 'dashed', linewidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot3', plot2: 'plot4', title: 'Plots Background', palette: [FILL_GREEN, FILL_RED] },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Alert Indicator', style: 'circle', location: 'bottom', color: '#3BB3E4', offset: -1 },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bars Colours' }];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'TDIALT Alert', message: 'TDIALT Alert' },
  { id: 'alert1', title: 'TDIALT Long Alert', message: 'TDIALT Long' },
  { id: 'alert2', title: 'TDIALT Short Alert', message: 'TDIALT Short' },
];

export const metadata = {
  title: 'Traders Dynamic Index Indicator Alert v1.3 by JustUncleL',
  shortTitle: 'TDIALT',
  overlay: false,
};

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<TradersDynamicIndexIndicatorAlertV01ByInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (v: number[]) => Series.fromArray(bars, v);

  // security(heikinashi(tickerid), period, x) or security(ticker, period, x): the chart series itself
  const src = cfg.uha ? heikinAshi(bars) : bars;
  const srcClose = src.map((b) => b.close);
  const srcOpen = src.map((b) => b.open);
  const srcHigh = src.map((b) => b.high);
  const srcLow = src.map((b) => b.low);

  const rS = ta.rsi(S(srcClose), cfg.lengthrsi);
  const ma = A(ta.sma(rS, cfg.lengthband));
  const sd = A(ta.stdev(rS, cfg.lengthband));
  const upZone = ma.map((m, i) => m + 1.6185 * sd[i]);
  const dnZone = ma.map((m, i) => m - 1.6185 * sd[i]);
  const mid = upZone.map((u, i) => (u + dnZone[i]) / 2);
  const mab = A(ta.sma(rS, cfg.lengthrsipl));
  const mbb = A(ta.sma(rS, cfg.lengthtradesl));

  // Price Action Channel: smma seeded with the sma (the sma call runs only while the previous value is na)
  const lenH = cfg.lenH;
  const smaH = A(ta.sma(S(srcHigh), lenH));
  const smaL = A(ta.sma(S(srcLow), lenH));
  const smmaH = new Array<number>(n).fill(NaN);
  const smmaL = new Array<number>(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const pH = i > 0 ? smmaH[i - 1] : NaN;
    const pL = i > 0 ? smmaL[i - 1] : NaN;
    smmaH[i] = isNaN(pH) ? smaH[i] : (pH * (lenH - 1) + srcHigh[i]) / lenH;
    smmaL[i] = isNaN(pL) ? smaL[i] : (pL * (lenH - 1) + srcLow[i]) / lenH;
  }

  // [currMacd, _, _] = macd(srcClose, fastMA, slowMA, signal)
  const fastE = A(ta.ema(S(srcClose), cfg.fastMA));
  const slowE = A(ta.ema(S(srcClose), cfg.slowMA));
  const currMacd = fastE.map((f, i) => f - slowE[i]);
  // rising / falling in the two ternary branches: in this version 3 script both keep the history of every bar
  // (measured on the reference: a history of only the bars of their branch gives other signals)
  const pos = currMacd.map((m) => gt(m, 0));
  const risingM = taCore.rising(currMacd, 2);
  const fallingM = taCore.falling(currMacd, 2);
  // macdH == green
  const macdGreen = pos.map((p, i) => (p ? Boolean(risingM[i]) : !fallingM[i]));

  const long = new Array<number>(n).fill(0);
  const short = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const a = mab[i];
    const b = mbb[i];
    const m = mid[i];
    if ((!cfg.umacd || macdGreen[i]) && gt(a, b) && lt(a, cfg.rsiOBL) && gt(a, cfg.rsiOSL)
      && gt(srcHigh[i], smmaH[i]) && gt(srcClose[i], srcOpen[i])) {
      long[i] = gt(b, m) ? 1 : gt(a, m) && lt(b, m) ? 2 : lt(a, m) && lt(b, m) ? 3 : 0;
    }
    if ((!cfg.umacd || !macdGreen[i]) && lt(a, b) && lt(a, cfg.rsiOBL) && gt(a, cfg.rsiOSL)
      && lt(srcLow[i], smmaL[i]) && lt(srcClose[i], srcOpen[i])) {
      short[i] = lt(b, m) ? 1 : lt(a, m) && gt(b, m) ? 2 : gt(a, m) && gt(b, m) ? 3 : 0;
    }
  }

  const strength = cfg.strength;
  const barColors: BarColorData[] = [];
  const longA: boolean[] = [];
  const shortA: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const l = long[i];
    const s = short[i];
    const c = !cfg.sbr ? null
      : l === 1 ? GOLD : l === 2 && strength > 1 ? AQUA : l === 3 && strength > 2 ? BLUE
        : s === 1 ? FUCHSIA : s === 2 && strength > 1 ? PURPLE : s === 3 && strength > 2 ? BLACK
          : cfg.sgb ? GRAY : null;
    if (c) barColors.push({ id: 'barcolor0', time: bars[i].time, color: c });
    // long != long[1]: false on the first bar (na)
    longA.push(l > 0 && i > 0 && l !== long[i - 1] && l <= strength);
    shortA.push(s > 0 && i > 0 && s !== short[i - 1] && s <= strength);
  }
  const cAlert = longA.map((l, i) => l || shortA[i]);

  // Single alert state: stateLong_ = nz(stateLong[1]), counted after a signal of the bar before
  const spikeLong = new Array<number>(n).fill(NaN);
  const spikeShort = new Array<number>(n).fill(NaN);
  let stateLong = 0;
  let stateShort = 0;
  for (let i = 0; i < n; i++) {
    let sl = stateLong;
    let ss = stateShort;
    if (i > 0 && long[i - 1] > 0 && long[i - 1] <= strength) {
      sl = sl > 0 ? sl + 1 : 1;
      ss = 0;
    }
    if (i > 0 && short[i - 1] > 0 && short[i - 1] <= strength) {
      ss = ss > 0 ? ss + 1 : 1;
      sl = 0;
    }
    if (cfg.sspikes) {
      spikeLong[i] = sl === 1 ? 100 : 0;
      spikeShort[i] = ss === 1 ? 100 : 0;
    }
    stateLong = sl > 0 ? sl + 1 : 0;
    stateShort = ss > 0 ? ss + 1 : 0;
  }

  // plotshape(sal and c_alert[1], location.bottom, offset = -1): the dot of bar i is drawn on bar i - 1
  const markers: MarkerData[] = [];
  if (cfg.sal) {
    for (let j = 0; j + 1 < n; j++) {
      if (!cAlert[j]) continue;
      const l = long[j];
      const s = short[j];
      const c = l === 1 ? GOLD : l === 2 ? AQUA : l === 3 ? BLUE : s === 1 ? FUCHSIA : s === 2 ? PURPLE : s === 3 ? BLACK : null;
      if (c) markers.push({ id: 'shape0', time: bars[j].time, position: 'bottom', shape: 'circle', color: c });
    }
  }

  const points = (v: number[]) => v.map((value, i) => ({ time: bars[i].time, value }));
  const fills: FillData[] = [{
    id: 'fill0', plot1: 'plot3', plot2: 'plot4', options: { title: 'Plots Background' },
    colors: mab.map((a, i) => (gt(a, mbb[i]) ? FILL_GREEN : FILL_RED)),
  }];

  // alertcondition(x[1] and barstate.isnew): barstate.isnew is true on every historical bar
  const prev = (f: boolean[]) => f.map((_v, i) => i > 0 && f[i - 1]);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: points(upZone),
      plot1: points(dnZone),
      plot2: points(mid),
      plot3: points(mab),
      plot4: points(mbb),
      plot5: points(spikeLong),
      plot6: points(spikeShort),
    },
    hlines: [
      { id: 'hline0', value: cfg.rsiOSL, options: { color: '#FF0000', linestyle: 'dashed', linewidth: 1 } },
      { id: 'hline1', value: 50, options: { color: BLACK, linestyle: 'dashed', linewidth: 1 } },
      { id: 'hline2', value: cfg.rsiOBL, options: { color: '#00FF00', linestyle: 'dashed', linewidth: 1 } },
    ],
    fills,
    markers,
    barColors,
    alerts: alertStates(alertConditions, bars, [prev(cAlert), prev(longA), prev(shortA)]),
  };
}

export const TradersDynamicIndexIndicatorAlertV01By = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  shapeConfig,
  barColorConfig,
  alertConditions,
};
