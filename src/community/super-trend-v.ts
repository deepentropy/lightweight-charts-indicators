/**
 * Super trend V
 *
 * A volume-weighted price: spreadvol = (close - open) * 100 * volume / ((high - low) * 100), v = spreadvol + its
 * running sum; the distance of v from its 14-bar SMA, divided by its 28-bar standard deviation and multiplied by the
 * 28-bar standard deviation of the range, is added to the high (when positive) or the low. Its EMA and the EMA of the
 * open (length 7 on daily and higher bars, tf / chart multiplier * 7 on intraday bars) are plotted with a cloud
 * (lime while the first is above the second, orange otherwise). A SuperTrend on the volume-weighted EMA (ATR bands)
 * is plotted one bar late as crosses; Buy / Sell labels mark crosses of the close over / under the SuperTrend line on
 * the side of the open EMA. TP labels mark crosses of the close over the lower / under the upper band of a 150-bar
 * linear regression end value +/- 2 standard deviations.
 * Alerts (alertcondition, `alerts` of the result): buy, sell, sell tp, buy tp.
 *
 * Reference: "Super trend V" by RafaelZioni
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, Series, color, timeframe,
  type Bar, type FillConfig, type FillData, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface SuperTrendVInputs {
  /** tf: minutes of the EMA window on intraday bars (length = tf / chart multiplier * 7) */
  tf: number;
  /** SuperTrend Multiplier */
  stMult: number;
  /** SuperTrend Period (ATR length) */
  stPeriod: number;
  /** TP: standard deviation multiplier of the regression bands */
  multiplier: number;
  /** TP length: regression / standard deviation length */
  len5: number;
}

export const defaultInputs: SuperTrendVInputs = {
  tf: 720,
  stMult: 1,
  stPeriod: 10,
  multiplier: 2,
  len5: 150,
};

export const inputConfig: InputConfig[] = [
  { id: 'tf', type: 'int', title: 'tf', defval: 720 },
  { id: 'stMult', type: 'float', title: 'SuperTrend Multiplier', defval: 1, min: 0, max: 100, step: 0.01 },
  { id: 'stPeriod', type: 'int', title: 'SuperTrend Period', defval: 10, min: 1 },
  { id: 'multiplier', type: 'float', title: 'TP', defval: 2, min: 1 },
  { id: 'len5', type: 'int', title: 'TP length', defval: 150, min: 1 },
];

/** Pine v4 colours */
const RED = '#FF5252';
const BLUE = '#2196F3';
const LIME = '#00E676';
const ORANGE = '#FF9800';
const GREEN = '#4CAF50';
const WHITE = '#FFFFFF';
const C_LIME_60 = String(color.new(LIME, 60));
const C_ORANGE_60 = String(color.new(ORANGE, 60));
const C_LIME_80 = String(color.new(LIME, 80));
const C_ORANGE_80 = String(color.new(ORANGE, 80));
const F_LIME = String(color.new(LIME, 70));
const F_ORANGE = String(color.new(ORANGE, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Weighted EMA', color: RED, lineWidth: 1 },
  { id: 'plot1', title: 'Open EMA', color: BLUE, lineWidth: 1 },
  { id: 'plot2', title: 'Weighted EMA Cloud', color: C_LIME_60, lineWidth: 1 },
  { id: 'plot3', title: 'Open EMA Cloud', color: C_LIME_80, lineWidth: 2 },
  { id: 'plot4', title: 'SuperTrend', color: GREEN, lineWidth: 2, style: 'cross' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot2', plot2: 'plot3', title: 'Plots Background', palette: [F_LIME, F_ORANGE] },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'buy', style: 'labelup', location: 'belowbar', color: GREEN, text: 'Buy', textcolor: WHITE, size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'sell', style: 'labeldown', location: 'abovebar', color: RED, text: 'Sell', textcolor: WHITE, size: 'small' },
  { id: 'shape2', kind: 'shape', title: 'low', style: 'labelup', location: 'belowbar', color: RED, text: 'TP', textcolor: WHITE, size: 'small' },
  { id: 'shape3', kind: 'shape', title: 'high', style: 'labeldown', location: 'abovebar', color: GREEN, text: 'TP', textcolor: WHITE, size: 'small' },
];

/** The original's alertconditions (title only: the default message) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'buy', message: 'Alert Fired!' },
  { id: 'alert1', title: 'sell', message: 'Alert Fired!' },
  { id: 'alert2', title: 'sell tp', message: 'Alert Fired!' },
  { id: 'alert3', title: 'buy tp', message: 'Alert Fired!' },
];

export const metadata = {
  title: 'Super trend V',
  shortTitle: 'Super trend V',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

export function calculate(
  bars: Bar[],
  inputs: Partial<SuperTrendVInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[] } {
  const { tf, stMult, stPeriod, multiplier, len5 } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const S = (a: number[]) => Series.fromArray(bars, a);

  // Volume-weighted price
  const spreadvol = bars.map((b) => (b.close - b.open) * 100 * ((b.volume ?? NaN) / ((b.high - b.low) * 100)));
  const cumSv = A(ta.cum(S(spreadvol)));
  const v = spreadvol.map((x, i) => x + cumSv[i]);
  const priceSpread = A(ta.stdev(S(bars.map((b) => b.high - b.low)), 28));
  const smooth = A(ta.sma(S(v), 14));
  const dv = v.map((x, i) => x - smooth[i]);
  const vSpread = A(ta.stdev(S(dv), 28));
  const out = bars.map((b, i) => {
    const shadow = dv[i] / vSpread[i] * priceSpread[i];
    return gt(shadow, 0) ? b.high + shadow : b.low + shadow;
  });

  // len = isintraday and multiplier >= 1 ? tf / multiplier * 7 : ... : 7
  const tfInfo = timeframe.info(chartTimeframe(bars, chart) || '1D');
  const len = tfInfo.isintraday && tfInfo.multiplier >= 1 ? Math.trunc(tf / tfInfo.multiplier * 7) : 7;
  const c = A(ta.ema(S(out), len));
  const o = A(ta.ema(S(bars.map((b) => b.open)), len));

  // SuperTrend on vpt = ema(out, len) = c
  const atr = A(ta.atr(bars, stPeriod));
  const upTrend: number[] = new Array(n);
  const downTrend: number[] = new Array(n);
  const trend: number[] = new Array(n);
  const stLine: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const upLev = c[i] - stMult * atr[i];
    const dnLev = c[i] + stMult * atr[i];
    const close1 = i > 0 ? bars[i - 1].close : NaN;
    const up1 = i > 0 ? upTrend[i - 1] : NaN;
    const dn1 = i > 0 ? downTrend[i - 1] : NaN;
    upTrend[i] = gt(close1, up1) ? Math.max(upLev, up1) : upLev;
    downTrend[i] = lt(close1, dn1) ? Math.min(dnLev, dn1) : dnLev;
    const close = bars[i].close;
    trend[i] = gt(close, dn1) ? 1 : lt(close, up1) ? -1 : (i > 0 ? trend[i - 1] : 1);
    stLine[i] = trend[i] === 1 ? upTrend[i] : downTrend[i];
  }
  const closeS = S(bars.map((b) => b.close));
  const crossUp = ta.crossover(closeS, S(stLine)).toArray();
  const crossDn = ta.crossunder(closeS, S(stLine)).toArray();

  // calcSlope(close, len5): least squares over the last len5 closes, x = 2 .. len5 + 1
  const vwap1: number[] = new Array(n);
  for (let k = 0; k < n; k++) {
    let sumX = 0, sumY = 0, sumXSqr = 0, sumXY = 0;
    for (let i = 1; i <= len5; i++) {
      const j = k - (len5 - i);
      const val = j >= 0 ? bars[j].close : NaN;
      const per = i + 1.0;
      sumX = sumX + per;
      sumY = sumY + val;
      sumXSqr = sumXSqr + per * per;
      sumXY = sumXY + val * per;
    }
    const slope = (len5 * sumXY - sumX * sumY) / (len5 * sumXSqr - sumX * sumX);
    const average = sumY / len5;
    const intercept = average - slope * sumX / len5 + slope;
    vwap1[k] = fin(intercept + slope * (len5 - 0));
  }
  const sdev = A(ta.stdev(closeS, len5));
  const z1 = vwap1.map((x, i) => x + multiplier * sdev[i]);
  const x1 = vwap1.map((x, i) => x - multiplier * sdev[i]);
  const low1 = ta.crossover(closeS, S(x1)).toArray();
  const high1 = ta.crossunder(closeS, S(z1)).toArray();

  const p0: Array<{ time: number; value: number }> = [];
  const p1: Array<{ time: number; value: number }> = [];
  const p2: Array<{ time: number; value: number; color: string }> = [];
  const p3: Array<{ time: number; value: number; color: string }> = [];
  const p4: Array<{ time: number; value: number; color: string }> = [];
  const fillColors: string[] = [];
  const markers: MarkerData[] = [];
  const flags: boolean[][] = [[], [], [], []];
  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    const up = gt(c[i], o[i]);
    p0.push({ time, value: fin(c[i]) });
    p1.push({ time, value: fin(o[i]) });
    p2.push({ time, value: fin(c[i]), color: up ? C_LIME_60 : C_ORANGE_60 });
    p3.push({ time, value: fin(o[i]), color: up ? C_LIME_80 : C_ORANGE_80 });
    fillColors.push(up ? F_LIME : F_ORANGE);
    // plot(st_line[1], color = trend == 1 ? green : red)
    p4.push({ time, value: i > 0 ? fin(stLine[i - 1]) : NaN, color: trend[i] === 1 ? GREEN : RED });

    const close = bars[i].close;
    const buy = !!crossUp[i] && gt(close, o[i]);
    const sell = !!crossDn[i] && lt(close, o[i]);
    const tpLow = !!low1[i];
    const tpHigh = !!high1[i];
    flags[0].push(buy);
    flags[1].push(sell);
    flags[2].push(tpLow);
    flags[3].push(tpHigh);
    if (buy) markers.push({ id: 'shape0', time, position: 'belowBar', shape: 'labelUp', color: GREEN, text: 'Buy', textColor: WHITE, size: 'small' });
    if (sell) markers.push({ id: 'shape1', time, position: 'aboveBar', shape: 'labelDown', color: RED, text: 'Sell', textColor: WHITE, size: 'small' });
    if (tpLow) markers.push({ id: 'shape2', time, position: 'belowBar', shape: 'labelUp', color: RED, text: 'TP', textColor: WHITE, size: 'small' });
    if (tpHigh) markers.push({ id: 'shape3', time, position: 'aboveBar', shape: 'labelDown', color: GREEN, text: 'TP', textColor: WHITE, size: 'small' });
  }

  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot2', plot2: 'plot3', options: { title: 'Plots Background' }, colors: fillColors },
  ];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: p0, plot1: p1, plot2: p2, plot3: p3, plot4: p4 },
    fills,
    markers,
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const SuperTrendV = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, shapeConfig, alertConditions,
};
