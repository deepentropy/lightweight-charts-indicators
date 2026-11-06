/**
 * Corrected Moving Average
 *
 * The CMA follows the SMA of the source with a gain k that depends on the variance of the source: with
 * v1 = variance(src, length) and v2 = (CMA[1] - SMA)^2, v3 = v2 / (v1 + v2) (1 when v1 or v2 is 0) and
 * k = max(0, 2 - 1 / v3); CMA = CMA[1] + k * (SMA - CMA[1]). The CMA can take its direction colour, and a ribbon
 * fill between the SMA and the CMA shows whether the SMA is above or below the CMA.
 * Alerts (alertcondition, `alerts` of the result): 'Long Signal' / 'Short Signal', true on the bars where the SMA
 * crosses above / below the CMA.
 *
 * Reference: "Corrected Moving Average" by everget
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright (c) 2020-present, Alex Orekhov (everget). Corrected Moving Average script may be freely
 * distributed under the terms of the GPL-3.0 license.
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowStdev,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface CorrectedMovingAverageInputs {
  length: number;
  src: SourceType;
  /** Colour the CMA by its direction (green up, red down); orange otherwise */
  highlightDirection: boolean;
  /** Fill between the SMA and the CMA */
  applyRibbonFilling: boolean;
}

export const defaultInputs: CorrectedMovingAverageInputs = {
  length: 35,
  src: 'close',
  highlightDirection: false,
  applyRibbonFilling: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 35, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'highlightDirection', type: 'bool', title: 'Highlight CMA', defval: false },
  { id: 'applyRibbonFilling', type: 'bool', title: 'Apply Ribbon Filling', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CMA', color: '#FF9800', lineWidth: 2 },
  { id: 'plot1', title: 'SMA', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Corrected Moving Average',
  shortTitle: 'CMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface CmaRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  variance: WindowStdev;
  smaArr: number[];
  cma: number[];
  cmaPlot: Point[];
  smaPlot: Point[];
  fillColors: string[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CorrectedMovingAverageInputs>): BarStudy<CmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const bullishFillColor = String(color.new('#0ebb23', 75));
  const bearishFillColor = String(color.new('#cc0000', 75));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // sma = ta.sma(src, length); v1 = ta.variance(src, length)
      const sma = new WindowSma(cfg.length);
      const variance = new WindowStdev(cfg.length);
      const s: CmaRun = {
        sma, variance, smaArr: [], cma: [], cmaPlot: [], smaPlot: [], fillColors: [], flags: [[], []], times: [[], []],
        steps: [sma, variance], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.smaArr, s.cma, s.cmaPlot, s.smaPlot, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const src = value(b);
      const sma = s.sma.step(src);
      const v1 = s.variance.variance(src);
      // cmaPrev = nz(cma[1], sma)
      const prev = i > 0 ? s.cma[i - 1]! : NaN;
      const cmaPrev = isNaN(prev) ? sma : prev;
      const dev = cmaPrev - sma;
      const v2 = dev * dev;
      // v3 = v1 == 0 or v2 == 0 ? 1 : v2 / (v1 + v2) (na == 0 is false). Plain division: v2 / 0 is +infinity,
      // then 1 / v3 is 0 and k is 2
      const v3 = v1 === 0 || v2 === 0 ? 1 : v2 / (v1 + v2);
      // k = math.max(0.0, 2 - 1 / v3) (na when v3 is na)
      const k = isNaN(v3) ? NaN : Math.max(0.0, 2 - 1 / v3);
      const cma = cmaPrev + k * (sma - cmaPrev);
      s.smaArr[i] = sma;
      s.cma[i] = cma;
      const time = b.time as number;
      // cmaColor = highlightDirection ? cma > cma[1] ? color.green : color.red : color.orange
      const cmaColor = cfg.highlightDirection ? (gt(cma, prev) ? color.green : color.red) : color.orange;
      s.cmaPlot[i] = { time, value: cma, color: cmaColor };
      s.smaPlot[i] = { time, value: sma, color: color.blue };
      // fillColor = applyRibbonFilling ? (sma > cma ? bullishFillColor : bearishFillColor) : #ffffff00
      s.fillColors[i] = cfg.applyRibbonFilling ? (gt(sma, cma) ? bullishFillColor : bearishFillColor) : '#ffffff00';
      // longSignal = ta.crossover(sma, cma) / shortSignal = ta.crossunder(sma, cma)
      const pSma = i > 0 ? s.smaArr[i - 1]! : NaN;
      const flags = [sma > cma && pSma <= prev, sma < cma && pSma >= prev];
      flags.forEach((f, j) => {
        s.flags[j]![i] = f;
        if (f) s.times[j]!.push(time);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          // plot(cma, 'CMA', linewidth = 2, color = cmaColor); plot(sma, 'SMA', linewidth = 2, color = color.blue)
          plot0: s.cmaPlot.slice(),
          plot1: s.smaPlot.slice(),
        },
        // fill(smaPlot, cmaPlot, color = fillColor)
        fills: [{ plot1: 'plot1', plot2: 'plot0', colors: s.fillColors.slice() }],
        markers: [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CorrectedMovingAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CorrectedMovingAverageInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Signal', message: 'Enter Long\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
  { id: 'alert1', title: 'Short Signal', message: 'Enter Short\nSymbol: {{exchange}}:{{ticker}}\nPrice: {{close}}' },
];

export const CorrectedMovingAverage = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
