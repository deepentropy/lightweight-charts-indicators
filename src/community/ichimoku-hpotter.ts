/**
 * Ichimoku (HPotter)
 *
 * Tenkan and Kijun are the middles of the highest high and the lowest low of the conversion and base periods. The
 * Chikou is the close drawn `displacement` bars back. Senkou A is the middle of the lagging span 2 period, read
 * `displacement` bars back; Senkou B is the average of Tenkan and Kijun of `basePeriods` bars back. The cloud
 * between Senkou A and Senkou B is filled.
 *
 * Reference: "Ichimoku2c" (Ichimoku) by HPotter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright by HPotter v1.0 23/05/2014
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { barTime } from '../bar-time';

export interface IchimokuHpotterInputs {
  conversionPeriods: number;
  basePeriods: number;
  laggingSpan2Periods: number;
  displacement: number;
}

export const defaultInputs: IchimokuHpotterInputs = {
  conversionPeriods: 9,
  basePeriods: 26,
  laggingSpan2Periods: 52,
  displacement: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'conversionPeriods', type: 'int', title: 'conversionPeriods', defval: 9, min: 1 },
  { id: 'basePeriods', type: 'int', title: 'basePeriods', defval: 26, min: 1 },
  { id: 'laggingSpan2Periods', type: 'int', title: 'laggingSpan2Periods', defval: 52, min: 1 },
  { id: 'displacement', type: 'int', title: 'displacement', defval: 26, min: 1 },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35); fill: 90
const V1 = (hex: string) => String(color.new(hex, 35));
const GREEN = '#008000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan', color: V1('#FF0000'), lineWidth: 1 },
  { id: 'plot1', title: 'Kijun', color: V1('#0000FF'), lineWidth: 1 },
  { id: 'plot2', title: 'Chikou', color: V1('#008080'), lineWidth: 1 },
  { id: 'plot3', title: 'SenkouA', color: V1('#800080'), lineWidth: 1 },
  { id: 'plot4', title: 'SenkouB', color: V1(GREEN), lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot3', plot2: 'plot4', color: String(color.new(GREEN, 90)), title: 'Plots Background' },
];

export const metadata = {
  title: 'Ichimoku2c',
  shortTitle: 'Ichimoku2c',
  overlay: true,
};

type Point = { time: number; value: number };

interface IchimokuRun extends BarRunState<Record<string, never>> {
  ext: WindowExtreme[];
  tenkan: number[];
  kijun: number[];
  senkouA: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
}

function study(inputs: Partial<IchimokuHpotterInputs>): BarStudy<IchimokuRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const back = (x: number[], i: number, k: number) => (i - k >= 0 ? x[i - k] : NaN);
  return {
    init() {
      // middleDonchian(Length) => avg(highest(Length), lowest(Length)) of the three lengths
      const ext = [cfg.conversionPeriods, cfg.basePeriods, cfg.laggingSpan2Periods]
        .flatMap((length) => [new WindowExtreme(false, length), new WindowExtreme(true, length)]);
      const s: IchimokuRun = {
        ext, tenkan: [], kijun: [], senkouA: [], plot0: [], plot1: [], plot2: [], plot3: [], plot4: [],
        steps: ext, vars: {}, lists: [], series: [],
      };
      s.lists = [s.plot2];
      s.series = [s.tenkan, s.kijun, s.senkouA, s.plot0, s.plot1, s.plot3, s.plot4];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const e = s.ext;
      const tenkan = (e[0].step(b.high) + e[1].step(b.low)) / 2;
      const kijun = (e[2].step(b.high) + e[3].step(b.low)) / 2;
      s.senkouA[i] = (e[4].step(b.high) + e[5].step(b.low)) / 2;
      s.tenkan[i] = tenkan;
      s.kijun[i] = kijun;
      s.plot0[i] = { time, value: tenkan };
      s.plot1[i] = { time, value: kijun };
      // plot(close, offset = -displacement): the close of bar i is drawn on bar i - displacement
      if (i - cfg.displacement >= 0) {
        s.plot2.push({ time: barTime(bars, i - cfg.displacement), value: b.close });
      }
      s.plot3[i] = { time, value: back(s.senkouA, i, cfg.displacement) };
      // SenkouB = (Tenkan[basePeriods] + Kijun[basePeriods]) / 2
      s.plot4[i] = { time, value: (back(s.tenkan, i, cfg.basePeriods) + back(s.kijun, i, cfg.basePeriods)) / 2 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
        fills: fillConfig.map((f) => ({ plot1: f.plot1, plot2: f.plot2, options: { color: f.color, title: f.title } })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IchimokuHpotterInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IchimokuHpotterInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const IchimokuHpotter = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, fillConfig };
