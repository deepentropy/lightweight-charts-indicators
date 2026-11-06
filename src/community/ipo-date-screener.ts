/**
 * IPO Stock Screener
 *
 * Counts the bars available on the chart (bar_index + 1). While this count is below the "IPO Days" threshold the
 * symbol is a recent IPO: the background is green, a red label is drawn at the top of the pane and a blue column of
 * height 1 is plotted. An orange column shows the bar count on every bar.
 * Alert (alertcondition, `alerts` of the result): 'IPO Date within IPO Days' on the bars where the count is below the
 * threshold.
 *
 * Reference: "IPO Date Screener" by starshiptrade
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © starshiptrade
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IpoDateScreenerInputs {
  /** Number of bars (days) of the IPO threshold */
  barThreshold: number;
}

export const defaultInputs: IpoDateScreenerInputs = {
  barThreshold: 498,
};

export const inputConfig: InputConfig[] = [
  { id: 'barThreshold', type: 'int', title: 'IPO Days', defval: 498, min: 1, max: 499 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'IPO Date within IPO Days', color: color.blue, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Days Since IPO', color: color.orange, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'IPO Stock Screener',
  shortTitle: 'IPO Stock Screener',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface IpoRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  bgColors: BgColorData[];
  plot0: { time: number; value: number }[];
  plot1: { time: number; value: number }[];
  newFlags: boolean[];
  times: number[][];
}

function study(inputs: Partial<IpoDateScreenerInputs>): BarStudy<IpoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: IpoRun = {
        markers: [], bgColors: [], plot0: [], plot1: [], newFlags: [], times: [[]],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.plot0, s.plot1, s.newFlags];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      // barsAvailable = bar_index + 1 (bar_index counts from the first bar given to the port)
      const barsAvailable = i + 1;
      const isStockNew = barsAvailable < cfg.barThreshold;
      s.newFlags[i] = isStockNew;
      if (isStockNew) s.times[0].push(t as number);
      // bgcolor(isStockNew ? color.green : na)
      if (isStockNew) s.bgColors.push({ time: t, color: color.green });
      // plotshape(isStockNew, location = location.top, color = color.red, style = shape.labeldown)
      if (isStockNew) s.markers.push({ time: t, position: 'top', shape: 'labelDown', color: color.red });
      // plot(isStockNew ? 1 : na, style = plot.style_columns, color = color.blue)
      s.plot0[i] = { time: t, value: isStockNew ? 1 : NaN };
      // plot(barsAvailable, style = plot.style_columns, color = color.orange)
      s.plot1[i] = { time: t, value: barsAvailable };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(isStockNew, "IPO Date within IPO Days")
        alerts: liveAlertStates(alertConditions, s.times, [n > 0 && s.newFlags[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IpoDateScreenerInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<IpoDateScreenerInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'IPO Date within IPO Days', message: 'This stock has fewer bars than the user-defined threshold.' },
];

export const IpoDateScreener = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
