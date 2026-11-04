/**
 * Relative Strength (of a stock)
 *
 * RS = (source / source `length` bars back) / (comparative / comparative `length` bars back) - 1, where the
 * comparative series is the same source on another symbol ("Comparative Symbol", chart timeframe, no lookahead, no
 * gaps). The RS line is green above zero and red below (blue when the crossover colours are off); a zero line
 * (maroon, or green / maroon by the angle of the RS over `base` bars when "RS Trend" is on); an optional SMA of the
 * RS coloured by its 3-bar rise / fall; confirmation bubbles on the RS while the 50-bar SMA of the price rises with
 * the price above it (+ve colour) or falls with the price below it (-ve colour). On the last bar a label marks the
 * reference bar (`length` bars back) with its date in the exchange time zone.
 * The bars of the comparative symbol come from the chart context (`requiredSymbols`, `chart.bars`): without them
 * the port throws a MissingSymbolDataError.
 * Alerts (alertcondition, `alerts` of the result): Rising Strength / Declining Strength (the SMA of the RS rises /
 * falls over 3 bars, whatever "RS Mean" shows).
 *
 * Reference: "Relative Strength of a stock" by bharatTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © bharatTrader
 */

import {
  ta, Series, color, str, getSourceSeries, time as pineTime,
  type Bar, type IndicatorResult, type InputConfig, type LabelData, type PlotConfig, type SourceType,
} from 'oakscriptjs';
import { symbolBarsOf, timezoneOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { otherSymbolChart, securityOtherValues } from '../other-symbol';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

export interface RelativeStrengthOfAStockInputs {
  source: SourceType;
  /** Comparative Symbol */
  comparativeTickerId: string;
  /** Period of the RS */
  length: number;
  showZeroLine: boolean;
  showRefDateLbl: boolean;
  toggleRSColor: boolean;
  /** RS Trend: colour the zero line by the angle of the RS */
  showRSTrend: boolean;
  /** Range of the RS Trend angle */
  base: number;
  /** RS Mean: show the SMA of the RS */
  showMA: boolean;
  lengthRSMA: number;
  showMAColor: boolean;
  /** Price Confirmation: show the bubbles */
  showBubbles: boolean;
  lengthPriceSMA: number;
  bullishColor: string;
  bearishColor: string;
}

const BULL_INPUT = String(color.new('#4CAF50', 85));
const BEAR_INPUT = String(color.new('#F23645', 85));

export const defaultInputs: RelativeStrengthOfAStockInputs = {
  source: 'close',
  comparativeTickerId: 'NSE:NIFTY',
  length: 123,
  showZeroLine: true,
  showRefDateLbl: true,
  toggleRSColor: true,
  showRSTrend: false,
  base: 5,
  showMA: false,
  lengthRSMA: 50,
  showMAColor: true,
  showBubbles: true,
  lengthPriceSMA: 50,
  bullishColor: BULL_INPUT,
  bearishColor: BEAR_INPUT,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'comparativeTickerId', type: 'symbol', title: 'Comparative Symbol', defval: 'NSE:NIFTY' },
  { id: 'length', type: 'int', title: 'Period', defval: 123, min: 1 },
  { id: 'showZeroLine', type: 'bool', title: 'Show Zero Line', defval: true },
  { id: 'showRefDateLbl', type: 'bool', title: 'Show Reference Label', defval: true },
  { id: 'toggleRSColor', type: 'bool', title: 'Toggle RS color on crossovers', defval: true },
  { id: 'showRSTrend', type: 'bool', title: 'RS Trend,', defval: false, group: 'RS Trend', inline: 'RS Trend' },
  { id: 'base', type: 'int', title: 'Range', defval: 5, min: 1, group: 'RS Trend', inline: 'RS Trend' },
  { id: 'showMA', type: 'bool', title: '', defval: false, group: 'RS Mean', inline: 'RS Mean' },
  { id: 'lengthRSMA', type: 'int', title: 'Period', defval: 50, min: 1, group: 'RS Mean', inline: 'RS Mean' },
  { id: 'showMAColor', type: 'bool', title: 'Trend Color', defval: true, group: 'RS Mean', inline: 'RS Mean' },
  { id: 'showBubbles', type: 'bool', title: '', defval: true, group: 'Price Confirmation', inline: 'Color' },
  { id: 'lengthPriceSMA', type: 'int', title: 'Period', defval: 50, min: 1, group: 'Price Confirmation', inline: 'Color' },
  { id: 'bullishColor', type: 'color', title: '+ve', defval: BULL_INPUT, group: 'Price Confirmation', inline: 'Color' },
  { id: 'bearishColor', type: 'color', title: '-ve', defval: BEAR_INPUT, group: 'Price Confirmation', inline: 'Color' },
];

/** Pine v6 colours */
const GREEN = '#4CAF50';
const RED = '#F23645';
const BLUE = '#2962FF';
const MAROON = '#880E4F';
const GRAY = '#787B86';
const WHITE = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line / RS Trend', color: MAROON, lineWidth: 2 },
  { id: 'plot1', title: 'RS', color: GREEN, lineWidth: 3 },
  { id: 'plot2', title: 'MA', color: GRAY, lineWidth: 2 },
  { id: 'plot3', title: 'Confirmation Bubbles', color: BULL_INPUT, lineWidth: 10, style: 'circles' },
];

export const drawingKinds: StudyDrawingKind[] = ['label'];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Rising Strength', message: 'Rising Strength' },
  { id: 'alert1', title: 'Declining Strength', message: 'Declining Strength' },
];

export const metadata = {
  title: 'Relative Strength',
  shortTitle: 'Relative Strength',
  overlay: false,
};

/** Bars of the comparative symbol on the chart timeframe (`timeframe.period`) */
export function requiredSymbols(inputs: Partial<RelativeStrengthOfAStockInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const { comparativeTickerId } = { ...defaultInputs, ...inputs };
  return [{ symbol: comparativeTickerId, timeframe: chartTimeframe([], chart) }];
}

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > 1e-10);
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

export function calculate(
  bars: Bar[],
  inputs: Partial<RelativeStrengthOfAStockInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'labels'> & { labels: LabelData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, base } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));
  const S = (a: number[]) => Series.fromArray(bars, a);

  // baseSymbol = request.security(syminfo.tickerid, timeframe.period, source): the chart series
  const baseSym = A(getSourceSeries(bars, cfg.source));
  const tf = chartTimeframe(bars, chart);
  const [other] = symbolBarsOf([{ symbol: cfg.comparativeTickerId, timeframe: tf }], chart);
  const comp = securityOtherValues(bars, other, '', A(getSourceSeries([...other], cfg.source)),
    otherSymbolChart(bars, chart), { other: chart?.symbolInfo?.(cfg.comparativeTickerId) });

  const res = bars.map((_, i) => (i >= length
    ? baseSym[i] / baseSym[i - length] / (comp[i] / comp[i - length]) - 1
    : NaN));
  const smaRes = A(ta.sma(S(res), cfg.lengthRSMA));
  const smaSymb = A(ta.sma(S(baseSym), cfg.lengthPriceSMA));
  const symbRising = A(ta.rising(S(smaSymb), 3));
  const symbFalling = A(ta.falling(S(smaSymb), 3));
  const maRising = A(ta.rising(S(smaRes), 3)).map((v) => v === 1);
  const maFalling = A(ta.falling(S(smaRes), 3)).map((v) => v === 1);

  const p0: Array<{ time: number; value: number; color: string }> = [];
  const p1: Array<{ time: number; value: number; color: string }> = [];
  const p2: Array<{ time: number; value: number; color: string }> = [];
  const p3: Array<{ time: number; value: number; color?: string }> = [];
  for (let i = 0; i < n; i++) {
    const time = bars[i].time;
    const r = res[i];
    const resColor = cfg.toggleRSColor ? (gt(r, 0) ? GREEN : RED) : BLUE;
    const y0 = i >= base ? r - res[i - base] : NaN;
    const angle0 = Math.atan(y0 / base);
    const zeroLineColor = cfg.showRSTrend ? (gt(angle0, 0.0) ? GREEN : MAROON) : MAROON;
    const posDiv = symbRising[i] === 1 && ge(baseSym[i], smaSymb[i]);
    const negDiv = symbFalling[i] === 1 && lt(baseSym[i], smaSymb[i]);
    const divStarted = posDiv || negDiv;
    const divColor = divStarted ? (posDiv ? cfg.bullishColor : cfg.bearishColor) : undefined;
    const maColor = cfg.showMAColor && maRising[i] ? GREEN : cfg.showMAColor && maFalling[i] ? RED : GRAY;
    p0.push({ time, value: cfg.showZeroLine ? 0 : NaN, color: zeroLineColor });
    p1.push({ time, value: fin(r), color: resColor });
    p2.push({ time, value: cfg.showMA ? fin(smaRes[i]) : NaN, color: maColor });
    p3.push(divColor !== undefined
      ? { time, value: cfg.showBubbles ? fin(r) : NaN, color: divColor }
      : { time, value: NaN });
  }

  // label.new(bar_index - length, 0, 'RS-<length> reference, d-m-y', color.blue, style by res[length] > 0) on the
  // last bar; the date of time[length] in the exchange time zone
  const labels: LabelData[] = [];
  const last = n - 1;
  if (cfg.showRefDateLbl && n > 0 && last - length >= 0) {
    const ref = last - length;
    const tz = timezoneOf(chart);
    const msOf = (t: number) => (chart?.timeUnit === 'ms' || t >= 1e12 ? t : t * 1000);
    const tRef = msOf(bars[ref].time);
    const text = `RS-${str.tostring(length)} reference, ${str.tostring(pineTime.dayofmonth(tRef, tz))}-`
      + `${str.tostring(pineTime.month(tRef, tz))}-${str.tostring(pineTime.year(tRef, tz))}`;
    labels.push({
      time: bars[ref].time, price: 0, text, color: BLUE, textColor: WHITE,
      style: gt(res[ref], 0) ? 'label_up' : 'label_down', size: 'normal', yloc: 'price',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: p0, plot1: p1, plot2: p2, plot3: p3 },
    labels,
    alerts: alertStates(alertConditions, bars, [maRising, maFalling]),
  };
}

export const RelativeStrengthOfAStock = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds, alertConditions, requiredSymbols,
};
