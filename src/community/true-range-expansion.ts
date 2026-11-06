/**
 * True Range eXpansion (TRX)
 *
 * Draws each bar as a candle from its low (open and low) to its high (high and close), coloured by the real bar
 * direction (close >= open: up colour, else down colour). Two moving averages (SMA / EMA / WMA / RMA / HMA) of the
 * high and of the low are moved out by an ATR offset: offset = rma(atr(atrLen), atrSmoothing) * multiplier, times
 * |ATR Adj| for each line (high line up, low line down). The basis is the middle of the two lines.
 *
 * Reference: "True Range eXpansion" by Sherlock_MacGyver
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrueRangeExpansionInputs {
  upColor: string;
  downColor: string;
  /** Candle transparency */
  transp: number;
  showMA: boolean;
  maLen: number;
  maType: 'SMA' | 'EMA' | 'WMA' | 'RMA' | 'HMA';
  atrLen: number;
  atrSmoothing: number;
  atrGlobalMult: number;
  showBasis: boolean;
  basisColor: string;
  /** Basis width (the plot width is static: 2) */
  basisWidth: number;
  basisTransp: number;
  maHighColor: string;
  /** High line width (the plot width is static: 2) */
  maHighWidth: number;
  maHighTransp: number;
  maHighATRMult: number;
  maLowColor: string;
  /** Low line width (the plot width is static: 2) */
  maLowWidth: number;
  maLowTransp: number;
  maLowATRMult: number;
}

export const defaultInputs: TrueRangeExpansionInputs = {
  upColor: color.green,
  downColor: color.red,
  transp: 20,
  showMA: true,
  maLen: 100,
  maType: 'WMA',
  atrLen: 3,
  atrSmoothing: 15,
  atrGlobalMult: 10,
  showBasis: true,
  basisColor: color.silver,
  basisWidth: 2,
  basisTransp: 50,
  maHighColor: color.orange,
  maHighWidth: 2,
  maHighTransp: 50,
  maHighATRMult: 0.5,
  maLowColor: color.blue,
  maLowWidth: 2,
  maLowTransp: 50,
  maLowATRMult: -0.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'upColor', type: 'color', title: 'Up', defval: color.green },
  { id: 'downColor', type: 'color', title: 'Down', defval: color.red },
  { id: 'transp', type: 'int', title: 'Transparency', defval: 20, min: 0, max: 100, step: 10 },
  { id: 'showMA', type: 'bool', title: 'Show High/Low Moving Averages', defval: true },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 100, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'WMA', options: ['SMA', 'EMA', 'WMA', 'RMA', 'HMA'] },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 3, min: 1 },
  { id: 'atrSmoothing', type: 'int', title: 'ATR Smoothing', defval: 15, min: 1 },
  { id: 'atrGlobalMult', type: 'float', title: 'ATR Multiplier', defval: 10, min: 0.0, step: 1 },
  { id: 'showBasis', type: 'bool', title: 'Show Basis', defval: true },
  { id: 'basisColor', type: 'color', title: 'Color', defval: color.silver },
  { id: 'basisWidth', type: 'int', title: 'Width', defval: 2, min: 1, max: 5 },
  { id: 'basisTransp', type: 'int', title: 'Transparency', defval: 50, min: 0, max: 100 },
  { id: 'maHighColor', type: 'color', title: 'Color', defval: color.orange },
  { id: 'maHighWidth', type: 'int', title: 'Width', defval: 2 },
  { id: 'maHighTransp', type: 'int', title: 'Transp', defval: 50 },
  { id: 'maHighATRMult', type: 'float', title: 'ATR Adj ↑', defval: 0.5, step: 0.1 },
  { id: 'maLowColor', type: 'color', title: 'Color', defval: color.blue },
  { id: 'maLowWidth', type: 'int', title: 'Width', defval: 2 },
  { id: 'maLowTransp', type: 'int', title: 'Transp', defval: 50 },
  { id: 'maLowATRMult', type: 'float', title: 'ATR Adj ↓', defval: -0.5, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA of High', color: String(color.new(color.orange, 50)), lineWidth: 2 },
  { id: 'plot1', title: 'MA of Low', color: String(color.new(color.blue, 50)), lineWidth: 2 },
  { id: 'plot2', title: 'Basis', color: String(color.new(color.silver, 50)), lineWidth: 2 },
];

export const metadata = {
  title: 'True Range eXpansion',
  shortTitle: 'TRX',
  overlay: true,
};

/** Pine a >= b: not (b - a > 1e-10), false with na */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };

/** One moving average of getMA stepped bar by bar */
type Ma = { step(v: number): number; commit(): void };

/** getMA(src, len): switch maType */
function maStep(type: TrueRangeExpansionInputs['maType'], len: number): Ma {
  switch (type) {
    case 'EMA': return taStep.ema(len);
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 'RMA': return taStep.rma(len);
    case 'HMA': {
      // w = ta.wma(src, len / 2); ta.wma(2 * w - ta.wma(src, len), math.round(math.sqrt(len)))
      const half = taStep.wma();
      const full = taStep.wma();
      const out = taStep.wma();
      const outLen = Math.round(Math.sqrt(len));
      return {
        step: (v) => out.step(2 * half.step(v, len / 2) - full.step(v, len), outLen),
        commit: () => { half.commit(); full.commit(); out.commit(); },
      };
    }
    default: { const m = taStep.sma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
  }
}

interface TrxRun extends BarRunState<Record<string, never>> {
  hiMa: Ma;
  loMa: Ma;
  atr: ReturnType<typeof taStep.atr>;
  smooth: ReturnType<typeof taStep.rma>;
  plots: Point[][];
  candles: PlotCandleData[];
}

function study(inputs: Partial<TrueRangeExpansionInputs>): BarStudy<TrxRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const highCol = String(color.new(cfg.maHighColor, cfg.maHighTransp));
  const lowCol = String(color.new(cfg.maLowColor, cfg.maLowTransp));
  const basisCol = String(color.new(cfg.basisColor, cfg.basisTransp));
  const upCol = String(color.new(cfg.upColor, cfg.transp));
  const downCol = String(color.new(cfg.downColor, cfg.transp));
  return {
    init() {
      const s: TrxRun = {
        hiMa: maStep(cfg.maType, cfg.maLen), loMa: maStep(cfg.maType, cfg.maLen),
        atr: taStep.atr(cfg.atrLen), smooth: taStep.rma(cfg.atrSmoothing),
        plots: [[], [], []], candles: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.hiMa, s.loMa, s.atr, s.smooth];
      s.series = [...s.plots, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const baseHighMA = s.hiMa.step(b.high);
      const baseLowMA = s.loMa.step(b.low);
      const smoothATR = s.smooth.step(s.atr.step(b.high, b.low, b.close));
      const adjATR = smoothATR * cfg.atrGlobalMult;
      const maHighAdj = baseHighMA + adjATR * Math.abs(cfg.maHighATRMult);
      const maLowAdj = baseLowMA - adjATR * Math.abs(cfg.maLowATRMult);
      const basis = (maHighAdj + maLowAdj) / 2;
      s.plots[0][i] = { time: b.time, value: cfg.showMA ? maHighAdj : NaN, color: highCol };
      s.plots[1][i] = { time: b.time, value: cfg.showMA ? maLowAdj : NaN, color: lowCol };
      s.plots[2][i] = { time: b.time, value: cfg.showMA && cfg.showBasis ? basis : NaN, color: basisCol };
      // plotcandle(low, high, low, high, color = col, bordercolor = col, wickcolor = col)
      const col = ge(b.close, b.open) ? upCol : downCol;
      s.candles[i] = { time: b.time, open: b.low, high: b.high, low: b.low, close: b.high, color: col, borderColor: col, wickColor: col };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        markers: [],
        plotCandles: { trueRangeCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrueRangeExpansionInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TrueRangeExpansionInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  return fullResult(createRun(inputs).update(bars));
}

export const TrueRangeExpansion = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
