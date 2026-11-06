/**
 * ANDROMEDA - TrendSync
 *
 * Two moving averages (EMA or SMA) of the close, MACD and a short RSI. The trend is up when the MACD histogram is
 * positive, MA 1 is above MA 2 and MA 2 rises (down: the mirror). A buy signal is an uptrend bar where the low
 * crosses under MA 1 or MA 2; a sell signal is a downtrend bar where the high crosses over MA 1 or MA 2. The MAs are
 * blue / red / grey by the trend; bars are orange when the RSI is above the overbought or below the oversold level,
 * else blue / red by the trend.
 * Alerts (alert() calls, `alertCalls` of the result, once per bar): "ALERTA DE COMPRA" on a buy signal and
 * "ALERTA DE VENDA" on a sell signal.
 *
 * Reference: "ANDROMEDA - TrendSync" by Pedro_Canto
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertCall, BarColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface AndromedaTrendSyncInputs {
  /** Length of moving average 1 */
  emaLength1: number;
  /** Length of moving average 2 */
  emaLength2: number;
  /** Type of moving average 1 */
  maType1: 'EMA' | 'SMA';
  /** Type of moving average 2 */
  maType2: 'EMA' | 'SMA';
  /** MACD fast length */
  fastLength: number;
  /** MACD slow length */
  slowLength: number;
  /** MACD signal length */
  signalLength: number;
  /** RSI source */
  rsiSource: SourceType;
  /** RSI length */
  rsiLength: number;
  /** RSI overbought level */
  rsiOverbought: number;
  /** RSI oversold level */
  rsiOversold: number;
  /** Bar colour when the RSI is overbought */
  rsiOverColor: string;
  /** Bar colour when the RSI is oversold */
  rsiUnderColor: string;
}

export const defaultInputs: AndromedaTrendSyncInputs = {
  emaLength1: 9,
  emaLength2: 20,
  maType1: 'EMA',
  maType2: 'EMA',
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  rsiSource: 'hlc3',
  rsiLength: 6,
  rsiOverbought: 80,
  rsiOversold: 20,
  rsiOverColor: color.orange,
  rsiUnderColor: color.orange,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength1', type: 'int', title: 'Período da Média Móvel 1', defval: 9 },
  { id: 'emaLength2', type: 'int', title: 'Período da Média Móvel 2', defval: 20 },
  { id: 'maType1', type: 'string', title: 'Tipo da Média Móvel 1', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'maType2', type: 'string', title: 'Tipo da Média Móvel 2', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'fastLength', type: 'int', title: 'MACD Média Curta', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'MACD Média Longa', defval: 26 },
  { id: 'signalLength', type: 'int', title: 'MACD Linha de Sinal', defval: 9 },
  { id: 'rsiSource', type: 'source', title: 'Fonte do RSI', defval: 'hlc3' },
  { id: 'rsiLength', type: 'int', title: 'Período RSI', defval: 6, min: 1 },
  { id: 'rsiOverbought', type: 'int', title: 'Nível Sobrecompra RSI', defval: 80 },
  { id: 'rsiOversold', type: 'int', title: 'Nível Sobrevenda RSI', defval: 20 },
  { id: 'rsiOverColor', type: 'color', title: 'Cor Sobrecompra', defval: color.orange },
  { id: 'rsiUnderColor', type: 'color', title: 'Cor Sobrevenda', defval: color.orange },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Média Móvel 1', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Média Móvel 2', color: color.gray, lineWidth: 3 },
];

export const metadata = {
  title: 'ANDROMEDA - TrendSync',
  shortTitle: 'ANDROMEDA - TrendSync',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; alertCalls: AlertCall[] };
type Ma = { step(v: number): number; commit(): void };

interface AndromedaVars {
  /**
   * The four ta.crossunder / ta.crossover call sites (low / ma1, low / ma2, high / ma1, high / ma2): the values of the
   * last bar where the call ran with both values not na, as [a, b] pairs (changed in place, copied by copyVars)
   */
  cross: number[];
}

interface AndromedaRun extends BarRunState<AndromedaVars> {
  ma1: Ma;
  ma2: Ma;
  macd: ReturnType<typeof taStep.macd>;
  rsi: ReturnType<typeof taStep.rsi>;
  ma2Arr: number[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<AndromedaTrendSyncInputs>): BarStudy<AndromedaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const rsiValue = barSource(cfg.rsiSource);
  // ma(src, len, type) => type == "EMA" ? ta.ema(src, len) : ta.sma(src, len) (the type is fixed for the run)
  const ma = (len: number, type: string): Ma => {
    if (type === 'EMA') return taStep.ema(len);
    return new WindowSma(len);
  };
  /**
   * One ta.crossover / ta.crossunder call site (pair k of `cross`): compared with the last bar where the call ran with
   * both values not na (a tie there counts). A call on the right side of a lazy `or` only runs (and keeps its history)
   * when it is reached. Exact comparisons: ta.crossover / ta.crossunder do not use the 1e-10 tolerance of the operators.
   */
  const crossSite = (cross: number[], k: number, over: boolean, a: number, b: number): boolean => {
    const pa = cross[2 * k];
    const pb = cross[2 * k + 1];
    const r = over ? a > b && pa <= pb : a < b && pa >= pb;
    if (!isNaN(a) && !isNaN(b)) {
      cross[2 * k] = a;
      cross[2 * k + 1] = b;
    }
    return r;
  };
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) ? null : 'source of another study'),
    init() {
      const s: AndromedaRun = {
        ma1: ma(cfg.emaLength1, cfg.maType1), ma2: ma(cfg.emaLength2, cfg.maType2),
        macd: taStep.macd(cfg.fastLength, cfg.slowLength, cfg.signalLength), rsi: taStep.rsi(cfg.rsiLength),
        ma2Arr: [], plot0: [], plot1: [], markers: [], barColors: [], alertCalls: [],
        steps: [], vars: { cross: new Array(8).fill(NaN) }, lists: [], series: [],
      };
      s.steps = [s.ma1, s.ma2, s.macd, s.rsi];
      s.lists = [s.markers, s.barColors, s.alertCalls];
      s.series = [s.ma2Arr, s.plot0, s.plot1];
      return s;
    },
    copyVars: (v) => ({ cross: v.cross.slice() }),
    bar(s, i, bars) {
      const b = bars[i];
      const cross = s.vars.cross;
      const ma1 = s.ma1.step(b.close);
      const ma2 = s.ma2.step(b.close);
      s.ma2Arr[i] = ma2;
      const macdHist = s.macd.step(b.close)[2];
      const rsi = s.rsi.step(rsiValue(b));

      const slope = i > 0 ? ma2 - s.ma2Arr[i - 1] : NaN; // ma2_slope = ma2 - ma2[1]
      const trendBuy = gt(macdHist, 0) && gt(ma1, ma2) && gt(slope, 0);
      const trendSell = lt(macdHist, 0) && lt(ma1, ma2) && lt(slope, 0);
      // ta.crossunder(low, ma1) or ta.crossunder(low, ma2): lazy `or`, the second call runs only when the first is false
      const crossUnder = crossSite(cross, 0, false, b.low, ma1) || crossSite(cross, 1, false, b.low, ma2);
      const crossOver = crossSite(cross, 2, true, b.high, ma1) || crossSite(cross, 3, true, b.high, ma2);
      const buySignal = trendBuy && crossUnder;
      const sellSignal = trendSell && crossOver;
      // if buy_signal: alert("ALERTA DE COMPRA", alert.freq_once_per_bar) / if sell_signal: alert("ALERTA DE VENDA", ...)
      if (buySignal) s.alertCalls.push({ time: b.time, message: 'ALERTA DE COMPRA', freq: 'once_per_bar' });
      if (sellSignal) s.alertCalls.push({ time: b.time, message: 'ALERTA DE VENDA', freq: 'once_per_bar' });

      const maColor = trendBuy ? color.blue : trendSell ? color.red : color.gray;
      s.plot0[i] = { time: b.time, value: ma1, color: maColor };
      s.plot1[i] = { time: b.time, value: ma2, color: maColor };

      // final_bar_color = not na(rsi_color) ? rsi_color : (trend_buy ? color.blue : trend_sell ? color.red : na)
      const rsiColor = gt(rsi, cfg.rsiOverbought) ? cfg.rsiOverColor : lt(rsi, cfg.rsiOversold) ? cfg.rsiUnderColor : null;
      const barColor = rsiColor ?? (trendBuy ? color.blue : trendSell ? color.red : null);
      if (barColor !== null) s.barColors.push({ time: b.time, color: barColor });

      // plotshape(buy_signal, "Buy Signal", shape.triangleup, location.belowbar, color.green, size = size.small)
      if (buySignal) s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'small' });
      // plotshape(sell_signal, "Sell Signal", shape.triangledown, location.abovebar, color.red, size = size.small)
      if (sellSignal) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AndromedaTrendSyncInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AndromedaTrendSyncInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AndromedaTrendSync = {
  calculate,
  createRun,
  metadata,

  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
