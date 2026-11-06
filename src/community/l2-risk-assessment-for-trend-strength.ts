/**
 * [blackcat] L2 Risk Assessment for Trend Strength
 *
 * var4 = 100 - ema((close - lowest(low, 33)) / (highest(high, 21) - lowest(low, 33)) * 100, 10); the safety level
 * is ema(0.191 * v + 0.809 * var4, 1), where v is var4 (or var4 of the previous bar when var4 is na), drawn as an
 * area; the trend strength is 100 - safety level, fuchsia from 80, red from 50, yellow from 20, green below.
 * Dotted levels at 100 / 80 / 50 / 20 / 0 with coloured zones between them.
 * (The Pine script also computes a risk assessment line that it does not plot; it is not ported.)
 *
 * Reference: "[blackcat] L2 Risk Assessment for Trend Strength" by blackcat1402
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © blackcat1402
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type L2RiskAssessmentForTrendStrengthInputs = Record<string, never>;

export const defaultInputs: L2RiskAssessmentForTrendStrengthInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Current Safety Level', color: String(color.new(color.blue, 30)), lineWidth: 4, style: 'area' },
  { id: 'plot1', title: 'Trend Strength Indicator', color: '#2962FF', lineWidth: 6 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_100', price: 100, title: 'Level', color: color.blue, linestyle: 'dotted' },
  { id: 'hline_80', price: 80, title: 'Level', color: color.red, linestyle: 'dotted' },
  { id: 'hline_50', price: 50, title: 'Level', color: color.yellow, linestyle: 'dotted' },
  { id: 'hline_20', price: 20, title: 'Level', color: color.green, linestyle: 'dotted' },
  { id: 'hline_0', price: 0, title: 'Level', color: color.fuchsia, linestyle: 'dotted' },
];

const ZONE_COLORS = [
  String(color.new(color.fuchsia, 60)),
  String(color.new(color.red, 60)),
  String(color.new(color.yellow, 60)),
  String(color.new(color.green, 60)),
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_100_80', plot1: 'hline_100', plot2: 'hline_80', color: ZONE_COLORS[0] },
  { id: 'fill_80_50', plot1: 'hline_80', plot2: 'hline_50', color: ZONE_COLORS[1] },
  { id: 'fill_50_20', plot1: 'hline_50', plot2: 'hline_20', color: ZONE_COLORS[2] },
  { id: 'fill_20_0', plot1: 'hline_20', plot2: 'hline_0', color: ZONE_COLORS[3] },
];

export const metadata = {
  title: '[blackcat] L2 Risk Assessment for Trend Strength',
  shortTitle: '[blackcat] L2 Risk Assessment for Trend Strength',
  overlay: false,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

interface L2Run extends BarRunState<Record<string, never>> {
  low33: WindowExtreme;
  high21: WindowExtreme;
  ema10: ReturnType<typeof taStep.ema>;
  ema1: ReturnType<typeof taStep.ema>;
  var4: number[];
  plot0: Point[];
  plot1: Point[];
}

function study(): BarStudy<L2Run, IndicatorResult> {
  return {
    init() {
      const low33 = new WindowExtreme(true, 33);
      const high21 = new WindowExtreme(false, 21);
      const ema10 = taStep.ema(10);
      const ema1 = taStep.ema(1);
      const s: L2Run = {
        low33, high21, ema10, ema1, var4: [], plot0: [], plot1: [],
        steps: [low33, high21, ema10, ema1], vars: {}, lists: [], series: [],
      };
      s.series = [s.var4, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const var2 = s.low33.step(b.low);
      const var3 = s.high21.step(b.high);
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); ta.ema skips both like na
      const raw = ((b.close - var2) / (var3 - var2)) * 100;
      const v = s.ema10.step(raw) * -1 + 100;
      s.var4[i] = v;
      // get_last_valid_value(var4, 1): var4, or var4[1] when var4 is na
      const last = !isNaN(v) ? v : i > 0 ? s.var4[i - 1]! : NaN;
      const emaCombined = s.ema1.step(0.191 * last + 0.809 * v);
      s.plot0[i] = { time: b.time as number, value: emaCombined };
      const ts = 100 - emaCombined;
      const c = ge(ts, 80) ? color.fuchsia : ge(ts, 50) ? color.red : ge(ts, 20) ? color.yellow : color.green;
      s.plot1[i] = { time: b.time as number, value: ts, color: c };
    },
    result(s, bars) {
      const n = bars.length;
      const zone = (k: number) => new Array<string>(n).fill(ZONE_COLORS[k]);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: hlineConfig.map((h) => ({
          value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle },
        })),
        fills: fillConfig.map((f, k) => ({ plot1: f.plot1, plot2: f.plot2, colors: zone(k) })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  _inputs: Partial<L2RiskAssessmentForTrendStrengthInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<L2RiskAssessmentForTrendStrengthInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const L2RiskAssessmentForTrendStrength = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
