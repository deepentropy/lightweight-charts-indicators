/**
 * EMA/RMA Clouds
 *
 * EMAs and RMAs of the high and the low over `period` bars. Single cloud: the two EMAs with a fill, lime when both
 * EMAs rise, red when both fall, else grey. Double cloud (has priority over the single cloud): the EMA high / RMA high
 * pair and the EMA low / RMA low pair, each with a fill; bullish when both EMAs are above their RMAs, bearish when
 * both are below, else grey.
 *
 * Reference: "EMA/RMA clouds by Alpachino" by Alpachino97
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Alpachino97
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EmaRmaCloudsInputs {
  /** Length of the EMAs and RMAs */
  period: number;
  /** Show the single cloud (EMA high / EMA low) */
  singleCloud: boolean;
  /** Show the double cloud (EMA / RMA of the high and of the low); has priority over the single cloud */
  doubleCloud: boolean;
}

export const defaultInputs: EmaRmaCloudsInputs = {
  period: 50,
  singleCloud: true,
  doubleCloud: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Ma length', defval: 50 },
  { id: 'singleCloud', type: 'bool', title: 'Single cloud', defval: true },
  { id: 'doubleCloud', type: 'bool', title: 'Double cloud', defval: false },
];

const NEUTRAL = String(color.new(color.gray, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA High Single', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot1', title: 'EMA Low Single', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot2', title: 'EMA High Double', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot3', title: 'RMA High Double', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot4', title: 'EMA Low Double', color: NEUTRAL, lineWidth: 1 },
  { id: 'plot5', title: 'RMA Low Double', color: NEUTRAL, lineWidth: 1 },
];

export const metadata = {
  title: 'EMA/RMA clouds by Alpachino',
  shortTitle: 'EMA/RMA clouds by Alpachino',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };

interface CloudsRun extends BarRunState<{ prevHigh: number; prevLow: number }> {
  emaHigh: ReturnType<typeof taStep.ema>;
  emaLow: ReturnType<typeof taStep.ema>;
  rmaHigh: ReturnType<typeof taStep.rma>;
  rmaLow: ReturnType<typeof taStep.rma>;
  lines: Point[][];
  fills: string[][];
}

function study(inputs: Partial<EmaRmaCloudsInputs>): BarStudy<CloudsRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const activeDouble = cfg.doubleCloud;
  const activeSingle = cfg.singleCloud && !cfg.doubleCloud;

  const bullishHigh = String(color.new(color.lime, 70));
  const bullishLow = String(color.new(color.green, 70));
  const bearishHigh = String(color.new(color.red, 70));
  const bearishLow = String(color.new(color.maroon, 70));
  return {
    init() {
      const emaHigh = taStep.ema(cfg.period);
      const emaLow = taStep.ema(cfg.period);
      const rmaHigh = taStep.rma(cfg.period);
      const rmaLow = taStep.rma(cfg.period);
      const s: CloudsRun = {
        emaHigh, emaLow, rmaHigh, rmaLow, lines: [[], [], [], [], [], []], fills: [[], [], []],
        steps: [emaHigh, emaLow, rmaHigh, rmaLow], vars: { prevHigh: NaN, prevLow: NaN }, lists: [], series: [],
      };
      s.series = [...s.lines, ...s.fills];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const emaHigh = s.emaHigh.step(b.high);
      const emaLow = s.emaLow.step(b.low);
      const rmaHigh = s.rmaHigh.step(b.high);
      const rmaLow = s.rmaLow.step(b.low);
      const prevHigh = i > 0 ? v.prevHigh : NaN;
      const prevLow = i > 0 ? v.prevLow : NaN;
      v.prevHigh = emaHigh;
      v.prevLow = emaLow;
      const bullishSingle = gt(emaHigh, prevHigh) && gt(emaLow, prevLow);
      const bearishSingle = lt(emaHigh, prevHigh) && lt(emaLow, prevLow);
      const single = bullishSingle ? bullishHigh : bearishSingle ? bearishHigh : NEUTRAL;
      const bullishDouble = gt(emaHigh, rmaHigh) && gt(emaLow, rmaLow);
      const bearishDouble = lt(emaHigh, rmaHigh) && lt(emaLow, rmaLow);
      const doubleHigh = bullishDouble ? bullishHigh : bearishDouble ? bearishHigh : NEUTRAL;
      const doubleLow = bullishDouble ? bullishLow : bearishDouble ? bearishLow : NEUTRAL;

      const t = b.time;
      const L = s.lines;
      L[0][i] = { time: t, value: activeSingle ? emaHigh : NaN, color: single };
      L[1][i] = { time: t, value: activeSingle ? emaLow : NaN, color: single };
      L[2][i] = { time: t, value: activeDouble ? emaHigh : NaN, color: doubleHigh };
      L[3][i] = { time: t, value: activeDouble ? rmaHigh : NaN, color: doubleHigh };
      L[4][i] = { time: t, value: activeDouble ? emaLow : NaN, color: doubleLow };
      L[5][i] = { time: t, value: activeDouble ? rmaLow : NaN, color: doubleLow };
      s.fills[0][i] = activeSingle ? single : 'transparent';
      s.fills[1][i] = activeDouble ? doubleHigh : 'transparent';
      s.fills[2][i] = activeDouble ? doubleLow : 'transparent';
    },
    result(s) {
      const L = s.lines;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: L[0].slice(),
          plot1: L[1].slice(),
          plot2: L[2].slice(),
          plot3: L[3].slice(),
          plot4: L[4].slice(),
          plot5: L[5].slice(),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Single Cloud' }, colors: s.fills[0].slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Double Cloud High' }, colors: s.fills[1].slice() },
          { plot1: 'plot4', plot2: 'plot5', options: { title: 'Double Cloud Low' }, colors: s.fills[2].slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EmaRmaCloudsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EmaRmaCloudsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const EmaRmaClouds = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
