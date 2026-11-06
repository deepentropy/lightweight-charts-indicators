/**
 * MechArt Moving Average and % Above V1.1
 *
 * A moving average of the close (SMA, EMA, WMA or VWMA) and a target line `percentage` % above it:
 * target = MA * (1 + percentage / 100). The background is red when the chosen price (high by default) is above the
 * target, and green when the chosen price (high by default) is below the moving average.
 * Alerts (alertcondition, `alerts` of the result): 'Price Above Target Price (Red)' and 'Price Below Moving Average
 * (Green)', true on the bars of the red and of the green background.
 *
 * Reference: "MechArt Moving Average and % Above V1.1" by MechArt_
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Price Above Target Price (Red)', message: 'Price is above the target price' },
  { id: 'alert1', title: 'Price Below Moving Average (Green)', message: 'Price is below the moving average' },
];

type MaType = 'SMA' | 'EMA' | 'WMA' | 'VWMA';
type PriceType = 'close' | 'open' | 'high' | 'low';

export interface MechartMovingAverageAndAboveV11Inputs {
  /** Moving average type */
  maType: MaType;
  /** Moving average length */
  smaPeriod: number;
  /** Target distance above the moving average (%) */
  percentage: number;
  /** Price compared with the target (red background) */
  priceTypeRed: PriceType;
  /** Price compared with the moving average (green background) */
  priceTypeGreen: PriceType;
}

export const defaultInputs: MechartMovingAverageAndAboveV11Inputs = {
  maType: 'SMA',
  smaPeriod: 200,
  percentage: 100,
  priceTypeRed: 'high',
  priceTypeGreen: 'high',
};

const PRICE_TYPES = ['close', 'open', 'high', 'low'];

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'VWMA'] },
  { id: 'smaPeriod', type: 'int', title: 'SMA Period', defval: 200, min: 1, max: 500 },
  { id: 'percentage', type: 'int', title: 'Percentage Above MA', defval: 100, min: 1, max: 500 },
  { id: 'priceTypeRed', type: 'string', title: 'Price Type for Red Trigger (Above Target)', defval: 'high', options: PRICE_TYPES },
  { id: 'priceTypeGreen', type: 'string', title: 'Price Type for Green Trigger (Below MA)', defval: 'high', options: PRICE_TYPES },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moving Average', color: color.blue, lineWidth: 2 },
  { id: 'plot1', title: 'Target Price', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'MechArt Moving Average and % Above V1.1',
  shortTitle: 'MechArt Moving Average and % Above V1.1',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

/** The moving average of the close (only the selected switch branch runs: the type is an input) */
function maStep(maType: MaType, len: number): Ma {
  switch (maType) {
    case 'EMA': return taStep.ema(len);
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 'VWMA': return new WindowVwma(len);
    default: return new WindowSma(len);
  }
}

interface MechartRun extends BarRunState<Record<string, never>> {
  ma: Ma;
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MechartMovingAverageAndAboveV11Inputs>): BarStudy<MechartRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const price = (b: Bar, type: PriceType) => b[type];
  const red = String(color.new(color.red, 90));
  const green = String(color.new(color.green, 90));
  return {
    init() {
      const s: MechartRun = {
        ma: maStep(cfg.maType, cfg.smaPeriod), plot0: [], plot1: [], bgColors: [], flags: [[], []], times: [[], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.ma];
      s.lists = [s.bgColors, ...s.times];
      s.series = [s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const ma = s.ma.step(b.close, b.volume ?? NaN);
      // targetPrice = maValue * (1 + percentage / 100) (int / int is a float division in Pine v6)
      const target = ma * (1 + cfg.percentage / 100);
      const conditionAbove = gt(price(b, cfg.priceTypeRed), target);
      const conditionBelow = lt(price(b, cfg.priceTypeGreen), ma);
      // bgcolor layers in Pine order (the later call is drawn on top)
      if (conditionAbove) s.bgColors.push({ time: b.time, color: red });
      if (conditionBelow) s.bgColors.push({ time: b.time, color: green });
      s.plot0[i] = { time: b.time, value: ma, color: color.blue };
      s.plot1[i] = { time: b.time, value: target, color: color.red };
      // alertcondition(conditionAbove, ...) / alertcondition(conditionBelow, ...)
      s.flags[0][i] = conditionAbove;
      s.flags[1][i] = conditionBelow;
      if (conditionAbove) s.times[0].push(b.time as number);
      if (conditionBelow) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MechartMovingAverageAndAboveV11Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MechartMovingAverageAndAboveV11Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MechartMovingAverageAndAboveV11 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
