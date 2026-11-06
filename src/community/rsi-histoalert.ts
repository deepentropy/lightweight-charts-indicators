/**
 * RSI HistoAlert Strategy
 *
 * A modified RSI: RSIMain = (RSI(close, RSIPeriod) - 50) * RSIHistoModify, drawn as a blue line and as a histogram
 * coloured green when RSIMain >= 0 and red when it is below 0. Levels at 0 (purple, solid), BuyAlertLevel (green,
 * dashed) and SellAlertLevel (red, dashed). The price bars are coloured from the position: 1 (green) when RSIMain is
 * above BuyAlertLevel, -1 (red) when it is below SellAlertLevel, else the position of the bar before (0 at the start:
 * blue).
 *
 * Reference: "RSI HistoAlert Strategy" by HPotter
 * Original notice: Copyright by HPotter v1.0 07/08/2014
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSIHistoAlertInputs {
  /** RSIPeriod */
  rsiLen: number;
  /** BuyAlertLevel */
  buyAlertLevel: number;
  /** SellAlertLevel */
  sellAlertLevel: number;
  /** RSIHistoModify */
  rsiHistoModify: number;
}

export const defaultInputs: RSIHistoAlertInputs = {
  rsiLen: 13,
  buyAlertLevel: -10,
  sellAlertLevel: 10,
  rsiHistoModify: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSIPeriod', defval: 13, min: 1 },
  { id: 'buyAlertLevel', type: 'int', title: 'BuyAlertLevel', defval: -10 },
  { id: 'sellAlertLevel', type: 'int', title: 'SellAlertLevel', defval: 10 },
  { id: 'rsiHistoModify', type: 'float', title: 'RSIHistoModify', defval: 1.5 },
];

/** Pine v1 colour constants */
const GREEN = '#008000';
const RED = '#FF0000';
const BLUE = '#0000FF';
const PURPLE = '#800080';
const BLACK = '#000000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI HistoAlert', color: BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'Histogram', color: GREEN, lineWidth: 1, style: 'histogram' },
];

/** hline(0 / BuyAlertLevel / SellAlertLevel) with the default inputs (the result `hlines` carry the input levels) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline0', price: 0, title: 'Level', color: PURPLE, linestyle: 'solid' },
  { id: 'hline1', price: -10, title: 'Level', color: GREEN, linestyle: 'dashed' },
  { id: 'hline2', price: 10, title: 'Level', color: RED, linestyle: 'dashed' },
];

export const metadata = {
  title: 'RSI HistoAlert Strategy',
  shortTitle: 'RSI HistoAlert Strategy',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface HistoRun extends BarRunState<{ pos: number }> {
  rsi: ReturnType<typeof taStep.rsi>;
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number; color: string }[];
  barColors: BarColorData[];
}

function study(inputs: Partial<RSIHistoAlertInputs>): BarStudy<HistoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const rsi = taStep.rsi(cfg.rsiLen);
      const s: HistoRun = { rsi, plot0: [], plot1: [], barColors: [], steps: [rsi], vars: { pos: 0 }, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time as number;
      // xPrice = close; RSIMain = (rsi(xPrice, RSIPeriod) - 50) * RSIHistoModify
      const v = s.rsi.step(bars[i].close);
      const r = v == null || isNaN(v) ? NaN : (v - 50) * cfg.rsiHistoModify;
      // rsiHcolor = iff(RSIMain >= 0, green, iff(RSIMain < 0, red, black))
      const hColor = ge(r, 0) ? GREEN : lt(r, 0) ? RED : BLACK;
      // pos = iff(RSIMain > BuyAlertLevel, 1, iff(RSIMain < SellAlertLevel, -1, nz(pos[1], 0)))
      const pos = gt(r, cfg.buyAlertLevel) ? 1 : lt(r, cfg.sellAlertLevel) ? -1 : s.vars.pos;
      s.vars.pos = pos;
      // barcolor(pos == -1 ? red : pos == 1 ? green : blue)
      s.barColors[i] = { id: 'barcolor0', time: t, color: pos === -1 ? RED : pos === 1 ? GREEN : BLUE };
      // plot(RSIMain, color=blue, title="RSI HistoAlert")
      s.plot0[i] = { time: t, value: r };
      // plot(RSIMain, color=rsiHcolor, title="Histogram", style=histogram, linewidth=1)
      s.plot1[i] = { time: t, value: r, color: hColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          // hline(0, color=purple, linestyle=line)
          { id: 'hline0', value: 0, options: { title: 'Level', color: PURPLE, linestyle: 'solid' } },
          // hline(BuyAlertLevel, color=green, linestyle=dashed)
          { id: 'hline1', value: cfg.buyAlertLevel, options: { title: 'Level', color: GREEN, linestyle: 'dashed' } },
          // hline(SellAlertLevel, color=red, linestyle=dashed)
          { id: 'hline2', value: cfg.sellAlertLevel, options: { title: 'Level', color: RED, linestyle: 'dashed' } },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSIHistoAlertInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSIHistoAlertInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RSIHistoAlert = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig };
