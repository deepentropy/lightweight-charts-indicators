/**
 * ATR Trailing Stoploss
 *
 * The stop is the highest value of (high - Multiplier * ATR(Atr Period)) over the last "HHV Period" bars, and the
 * close on the first 15 bars. The line and the bars are green while the close is above the stop, red while it is
 * below and dark grey on a tie. Buy / sell signals are the close crossing the stop (the original BUY / SELL labels
 * have display.none: they are not drawn; the crossings are the two alert conditions).
 *
 * Reference: "ATR Trailing Stoploss" by ceyhun
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ceyhun
 */

import {
  ta, Series, callsite,
  type Bar, type BarColorConfig, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { BarColorData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface AtrTrailingStoplossInputs {
  /** ATR period */
  Atr: number;
  /** Bars of the highest value */
  Hhv: number;
  /** ATR multiplier */
  Mult: number;
  /** Colour the bars */
  Barcolor: boolean;
}

export const defaultInputs: AtrTrailingStoplossInputs = {
  Atr: 5,
  Hhv: 10,
  Mult: 2.5,
  Barcolor: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'Atr', type: 'int', title: 'Atr Period', defval: 5, min: 1, max: 500 },
  { id: 'Hhv', type: 'int', title: 'HHV Period', defval: 10, min: 1, max: 500 },
  { id: 'Mult', type: 'float', title: 'Multiplier', defval: 2.5, min: 0.1 },
  { id: 'Barcolor', type: 'bool', title: 'Barcolor', defval: true },
];

/** v5 colour constants */
const GREEN = '#4CAF50';
const RED = '#FF5252';
const BLACK = '#363A45';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR Trailing Stoploss', color: '#2962ff', lineWidth: 3, palette: [RED, BLACK, GREEN] },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy ATR Trailing Stoploss' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell ATR Trailing Stoploss' },
];

export const metadata = {
  title: 'ATR Trailing Stoploss',
  shortTitle: 'ATR Trailing Stoploss',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<AtrTrailingStoplossInputs> = {},
): Omit<IndicatorResult, 'barColors' | 'alerts'> & { barColors: BarColorData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  // Prev = ta.highest(high - Mult * ta.atr(Atr), Hhv); the other ta.highest calls of the script give the same value,
  // so iff_1 is that value on every bar
  const atr = A(ta.atr(bars, cfg.Atr));
  const base = Series.fromArray(bars, bars.map((b, i) => b.high - cfg.Mult * atr[i]));
  const prev = A(ta.highest(base, cfg.Hhv));
  // TS = ta.cum(1) < 16 ? close : iff_1
  const ts = bars.map((b, i) => (i + 1 < 16 ? b.close : prev[i]));

  const colours = bars.map((b, i) => (gt(b.close, ts[i]) ? GREEN : lt(b.close, ts[i]) ? RED : BLACK));
  // Buy = ta.crossover(close, TS), Sell = ta.crossunder(close, TS)
  const over = callsite.crossover();
  const under = callsite.crossunder();
  const buy = bars.map((b, i) => over(b.close, ts[i]));
  const sell = bars.map((b, i) => under(b.close, ts[i]));

  const plot0 = bars.map((b, i) => ({ time: b.time, value: Number.isFinite(ts[i]) ? ts[i] : NaN, color: colours[i] }));
  const barColors: BarColorData[] = [];
  if (cfg.Barcolor) {
    for (let i = 0; i < n; i++) barColors.push({ id: 'barcolor0', time: bars[i].time, color: colours[i] });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    barColors,
    alerts: alertStates(alertConditions, bars, [buy, sell]),
  };
}

export const AtrTrailingStoploss = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  barColorConfig,
  alertConditions,
};
