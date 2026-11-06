/**
 * Dynamic Stop Loss & Take Profit
 *
 * Stop loss and take profit levels around the close, at a multiple of the ATR. Long trades: stop = close - ATR *
 * slMultiplier, target = close + ATR * tpMultiplier; short trades: the other side of the close.
 *
 * Reference: "Dynamic Stop Loss & Take Profit" by criptoblast2
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DynamicStopLossTakeProfitInputs {
  /** ATR length */
  atrLength: number;
  /** Stop loss multiplier of the ATR */
  slMultiplier: number;
  /** Take profit multiplier of the ATR */
  tpMultiplier: number;
  /** Trade type */
  tradeType: 'Long' | 'Short';
}

export const defaultInputs: DynamicStopLossTakeProfitInputs = {
  atrLength: 14,
  slMultiplier: 1.5,
  tpMultiplier: 3,
  tradeType: 'Long',
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'slMultiplier', type: 'float', title: 'Stop Loss Multiplier', defval: 1.5, min: 1.5, max: 4, step: 0.5 },
  { id: 'tpMultiplier', type: 'float', title: 'Take Profit Multiplier', defval: 3, min: 2, max: 5, step: 0.5 },
  { id: 'tradeType', type: 'string', title: 'Trade Type', defval: 'Long', options: ['Long', 'Short'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stop Loss', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'Take Profit', color: color.lime, lineWidth: 1 },
];

export const metadata = {
  title: 'Dynamic Stop Loss & Take Profit',
  shortTitle: 'Dynamic Stop Loss & Take Profit',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

interface DsltpRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<DynamicStopLossTakeProfitInputs>): BarStudy<DsltpRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const isLong = cfg.tradeType === 'Long';
  return {
    init() {
      const atr = taStep.atr(cfg.atrLength);
      const s: DsltpRun = { atr, plot0: [], plot1: [], steps: [atr], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const atr = s.atr.step(b.high, b.low, b.close);
      const sl = atr * cfg.slMultiplier;
      s.plot0[i] = { time: b.time, value: isLong ? b.close - sl : b.close + sl, color: color.red };
      const tp = atr * cfg.tpMultiplier;
      s.plot1[i] = { time: b.time, value: isLong ? b.close + tp : b.close - tp, color: color.lime };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicStopLossTakeProfitInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DynamicStopLossTakeProfitInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DynamicStopLossTakeProfit = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
