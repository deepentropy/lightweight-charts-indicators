/**
 * Liquidity Sniper Pro
 *
 * Trend: EMA(50) above EMA(200) is bullish, below is bearish. A buy signal is the close crossing above the fast EMA
 * in a bullish trend, a sell signal the close crossing under it in a bearish trend, optionally filtered by the trend
 * of the same EMAs on another timeframe ("HTF Timeframe", 15 minutes by default) and by a strong volume (volume above
 * its SMA(20) x multiplier). Quality: "A" with a strong volume and an EMA gap above the ATR, "B" with a strong volume,
 * else "C". When no trade is open, a signal opens one at the close: stop at ATR x multiplier, targets at 1, 2 and 3
 * times the risk, a profit box and a loss box 30 bars wide, and entry / stop / target labels 30 bars to the right.
 * A target label turns lime when the price reaches it; the third target closes the trade; the stop closes it and
 * deletes its drawings. A table shows the trend, the volume state, the other timeframe trend and the quality.
 *
 * The other timeframe (`request.security(syminfo.tickerid, htfTF, ta.ema(close, len))`): the chart timeframe is the
 * chart series; a higher timeframe is built from the chart bars; a lower timeframe (the default 15 minutes on a
 * daily or hourly chart) needs the bars of the chart symbol on that timeframe from the chart context
 * (`requiredSymbols`, `bars` accessor): the EMAs are computed on the bars given (the original sees a limited number
 * of lower-timeframe bars, 100,000 on the reference daily runs, so the EMAs start where those bars start). Without
 * them the port throws a MissingSymbolDataError.
 *
 * Chart values (optional third argument of calculate): the symbol tick (entry and stop label texts), the ticker id,
 * timeframe, calendar and last bar state (other timeframe), the lower-timeframe bars.
 *
 * Reference: "Liquidity Sniper Pro" by VenusJ
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This pine script code is subject to the terms of the Venusj. All rights reserved.
 */

import {
  ta, str, color, callsite, Series, timeframe, mapToChart, box, label, table, resetDrawings, setDrawingBar,
  drawingOutputs,
  type Bar, type Box, type IndicatorResult, type InputConfig, type Label, type PlotConfig,
} from 'oakscriptjs';
import { mintickOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { otherSymbolChart, securityOtherValues } from '../other-symbol';
import type { StudyDrawingKind } from '../style-outputs';

export interface LiquiditySniperProInputs {
  emaFastLen: number;
  emaSlowLen: number;
  atrLen: number;
  atrMult: number;
  /** Filter the signals by the EMA trend of the other timeframe */
  useHTF: boolean;
  htfTF: string;
  useVolumeFilter: boolean;
  volMultiplier: number;
}

export const defaultInputs: LiquiditySniperProInputs = {
  emaFastLen: 50,
  emaSlowLen: 200,
  atrLen: 14,
  atrMult: 1.5,
  useHTF: true,
  htfTF: '15',
  useVolumeFilter: true,
  volMultiplier: 1.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaFastLen', type: 'int', title: 'Fast EMA', defval: 50 },
  { id: 'emaSlowLen', type: 'int', title: 'Slow EMA', defval: 200 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 1.5 },
  { id: 'useHTF', type: 'bool', title: 'Use Higher Timeframe Trend', defval: true },
  { id: 'htfTF', type: 'timeframe', title: 'HTF Timeframe', defval: '15' },
  { id: 'useVolumeFilter', type: 'bool', title: 'Use Volume Filter', defval: true },
  { id: 'volMultiplier', type: 'float', title: 'Volume Strength Multiplier', defval: 1.2 },
];

const FAST_COLOR = String(color.rgb(20, 83, 12));
const SLOW_COLOR = String(color.rgb(128, 8, 8));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: FAST_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Plot', color: SLOW_COLOR, lineWidth: 1 },
];

export const drawingKinds: StudyDrawingKind[] = ['box', 'label', 'table'];

export const metadata = {
  title: 'Liquidity Sniper Pro',
  shortTitle: 'Liquidity Sniper Pro',
  overlay: true,
};

/** v6 colour constants */
const GREEN = '#4CAF50';
const RED = '#F23645';
const GRAY = '#787B86';
const LIME = '#00E676';
const ORANGE = '#FF9800';
const YELLOW = '#FDD835';
const WHITE = '#FFFFFF';

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);

/** -1: the other timeframe is lower than the chart timeframe, 0: the same, 1: higher */
function timeframeOrder(tf: string, chartTf: string): number {
  if (tf.trim() === '' || chartTf === '') return 0;
  const a = timeframe.in_seconds(tf);
  const b = timeframe.in_seconds(chartTf);
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Bars the indicator needs: the chart symbol on the "HTF Timeframe" when it is lower than the chart timeframe. */
export function requiredSymbols(inputs: Partial<LiquiditySniperProInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const chartTf = chartTimeframe([], chart);
  if (timeframeOrder(cfg.htfTF, chartTf) >= 0) return [];
  return [{ symbol: tickeridOf(chart), timeframe: cfg.htfTF }];
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LiquiditySniperProInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { emaFastLen, emaSlowLen, atrLen, atrMult, useHTF, htfTF, useVolumeFilter, volMultiplier } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const mintick = mintickOf(chart);

  const close = bars.map((b) => b.close);
  const emaFast = A(ta.ema(Series.fromArray(bars, close), emaFastLen));
  const emaSlow = A(ta.ema(Series.fromArray(bars, close), emaSlowLen));
  const atrVal = A(ta.atr(bars, atrLen));

  // htfEmaFast / htfEmaSlow = request.security(syminfo.tickerid, htfTF, ta.ema(close, len))
  let htfFast: number[];
  let htfSlow: number[];
  const order = timeframeOrder(htfTF, chartTimeframe(bars, chart));
  if (order === 0) {
    htfFast = emaFast;
    htfSlow = emaSlow;
  } else if (order > 0) {
    const ctx = higherTimeframeBars(bars, htfTF, chart);
    const htfClose = Series.fromArray(ctx.htf, ctx.htf.map((b) => b.close));
    htfFast = mapToChart(A(ta.ema(htfClose, emaFastLen)), ctx.group, ctx.latest, false, false);
    htfSlow = mapToChart(A(ta.ema(htfClose, emaSlowLen)), ctx.group, ctx.latest, false, false);
  } else {
    const [ltf] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: htfTF }], chart);
    const ltfClose = Series.fromArray(ltf, ltf.map((b) => b.close));
    const merge = otherSymbolChart(bars, chart);
    const calendar = { other: { timezone: chart?.timezone, session: chart?.session } };
    htfFast = securityOtherValues(bars, ltf, htfTF, A(ta.ema(ltfClose, emaFastLen)), merge, calendar);
    htfSlow = securityOtherValues(bars, ltf, htfTF, A(ta.ema(ltfClose, emaSlowLen)), merge, calendar);
  }

  const volume = bars.map((b) => b.volume ?? NaN);
  const volMA = A(ta.sma(Series.fromArray(bars, volume), 20));

  resetDrawings({ box: 20, label: 50 });
  let tradeActive = false;
  let isBuy = false;
  let entry = NaN;
  let stop = NaN;
  let tp1 = NaN;
  let tp2 = NaN;
  let tp3 = NaN;
  let entryLbl: Label | null = null;
  let slLbl: Label | null = null;
  let tp1Lbl: Label | null = null;
  let tp2Lbl: Label | null = null;
  let tp3Lbl: Label | null = null;
  let profitBox: Box | null = null;
  let lossBox: Box | null = null;
  const clearAll = () => {
    for (const l of [entryLbl, slLbl, tp1Lbl, tp2Lbl, tp3Lbl]) if (l) label.delete(l);
    for (const b of [profitBox, lossBox]) if (b) box.delete(b);
  };
  // v6 `and` is lazy: each crossing only runs (and keeps its history) on the bars of its trend
  const crossUp = callsite.crossover();
  const crossDn = callsite.crossunder();
  let dash: ReturnType<typeof table.new> | null = null;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    // var table dash = table.new(position.top_right, 2, 4)
    if (i === 0) dash = table.new('top_right', 2, 4);
    const b = bars[i];
    const htfBull = gt(htfFast[i], htfSlow[i]);
    const htfBear = lt(htfFast[i], htfSlow[i]);
    const strongVol = gt(volume[i], volMA[i] * volMultiplier);
    const bullTrend = gt(emaFast[i], emaSlow[i]);
    const bearTrend = lt(emaFast[i], emaSlow[i]);
    const trendStrength = Math.abs(emaFast[i] - emaSlow[i]);

    let buySignal = bullTrend && crossUp(b.close, emaFast[i]);
    let sellSignal = bearTrend && crossDn(b.close, emaFast[i]);
    buySignal = buySignal && (!useHTF || htfBull) && (!useVolumeFilter || strongVol);
    sellSignal = sellSignal && (!useHTF || htfBear) && (!useVolumeFilter || strongVol);

    let quality = 'C';
    if (strongVol && gt(trendStrength, atrVal[i])) quality = 'A';
    else if (strongVol) quality = 'B';

    if (!tradeActive && (buySignal || sellSignal)) {
      clearAll();
      // box text colour: the v6 default (white), set explicitly
      tradeActive = true;
      isBuy = buySignal;
      entry = b.close;
      if (buySignal) {
        stop = entry - atrVal[i] * atrMult;
        const risk = entry - stop;
        tp1 = entry + risk;
        tp2 = entry + risk * 2;
        tp3 = entry + risk * 3;
      } else {
        stop = entry + atrVal[i] * atrMult;
        const risk = stop - entry;
        tp1 = entry - risk;
        tp2 = entry - risk * 2;
        tp3 = entry - risk * 3;
      }
      profitBox = box.new(i, isBuy ? entry : tp3, i + 30, isBuy ? tp3 : entry, String(color.rgb(4, 199, 20, 70)),
        undefined, undefined, undefined, undefined, String(color.new('#055509', 59)), undefined, undefined, WHITE);
      lossBox = box.new(i, isBuy ? stop : entry, i + 30, isBuy ? entry : stop, RED,
        undefined, undefined, undefined, undefined, String(color.new(RED, 85)), undefined, undefined, WHITE);
      entryLbl = label.new(i + 30, entry, `ENTRY (${quality})\n${str.tostring(entry, 'mintick', mintick)}`,
        'bar_index', 'price', GRAY, 'label_left', WHITE);
      slLbl = label.new(i + 30, stop, `SL\n${str.tostring(stop, 'mintick', mintick)}`,
        'bar_index', 'price', RED, 'label_left', WHITE);
      tp1Lbl = label.new(i + 30, tp1, 'TP1', 'bar_index', 'price', GREEN, 'label_left', WHITE);
      tp2Lbl = label.new(i + 30, tp2, 'TP2', 'bar_index', 'price', GREEN, 'label_left', WHITE);
      tp3Lbl = label.new(i + 30, tp3, 'TP3', 'bar_index', 'price', GREEN, 'label_left', WHITE);
    }

    if (tradeActive) {
      const tp1Hit = isBuy ? ge(b.high, tp1) : le(b.low, tp1);
      const tp2Hit = isBuy ? ge(b.high, tp2) : le(b.low, tp2);
      const tp3Hit = isBuy ? ge(b.high, tp3) : le(b.low, tp3);
      const slHit = isBuy ? le(b.low, stop) : ge(b.high, stop);
      if (tp1Hit && tp1Lbl) label.set_color(tp1Lbl, LIME);
      if (tp2Hit && tp2Lbl) label.set_color(tp2Lbl, LIME);
      if (tp3Hit) {
        if (tp3Lbl) label.set_color(tp3Lbl, LIME);
        tradeActive = false;
      }
      if (slHit) {
        clearAll();
        tradeActive = false;
      }
    }

    // dashboard: the cells of every bar (those of the last bar are shown)
    const trendColor = bullTrend ? GREEN : RED;
    if (!dash) continue;
    table.cell(dash, 0, 0, 'TREND', undefined, undefined, WHITE);
    table.cell(dash, 1, 0, bullTrend ? 'BULLISH' : 'BEARISH', undefined, undefined, trendColor);
    table.cell(dash, 0, 1, 'VOLUME', undefined, undefined, WHITE);
    table.cell(dash, 1, 1, strongVol ? 'HIGH' : 'LOW', undefined, undefined, strongVol ? GREEN : ORANGE);
    table.cell(dash, 0, 2, 'HTF', undefined, undefined, WHITE);
    table.cell(dash, 1, 2, htfBull ? 'BULL' : 'BEAR', undefined, undefined, trendColor);
    table.cell(dash, 0, 3, 'QUALITY', undefined, undefined, WHITE);
    table.cell(dash, 1, 3, quality, undefined, undefined, YELLOW);
  }
  setDrawingBar(null);

  const pts = (values: number[], c: string) => values.map((v, i) => ({ time: bars[i].time, value: v, color: c }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: pts(emaFast, FAST_COLOR), plot1: pts(emaSlow, SLOW_COLOR) },
    ...drawingOutputs(bars),
  };
}

export const LiquiditySniperPro = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  requiredSymbols,
};
