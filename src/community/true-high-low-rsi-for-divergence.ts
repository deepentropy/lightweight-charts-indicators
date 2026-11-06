/**
 * True High/Low RSI for Divergence
 *
 * Two RSI lines: the RSI of the high and the RSI of the low (RMA of the up and down changes; 100 when the down
 * average is 0, 0 when the up average is 0). The High RSI line becomes more opaque from 50 up to 70 (transparency
 * (70 - RSI) * 2, invisible at or below 50); the Low RSI line becomes more opaque from 50 down to 30.
 *
 * Reference: "True High/Low RSI for Divergence" by Lakt_
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, getSourceSeries, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrueHighLowRsiForDivergenceInputs {
  /** Colour of the High RSI line */
  highRsiColor: string;
  /** Colour of the Low RSI line */
  lowRsiColor: string;
  /** RSI length */
  rsiLength: number;
  /** Source of the High RSI */
  rsiSourceHigh: SourceType;
  /** Source of the Low RSI */
  rsiSourceLow: SourceType;
}

export const defaultInputs: TrueHighLowRsiForDivergenceInputs = {
  highRsiColor: color.blue,
  lowRsiColor: color.red,
  rsiLength: 14,
  rsiSourceHigh: 'high',
  rsiSourceLow: 'low',
};

export const inputConfig: InputConfig[] = [
  { id: 'highRsiColor', type: 'color', title: 'High RSI Color', defval: color.blue },
  { id: 'lowRsiColor', type: 'color', title: 'Low RSI Color', defval: color.red },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiSourceHigh', type: 'source', title: 'High RSI Source', defval: 'high' },
  { id: 'rsiSourceLow', type: 'source', title: 'Low RSI Source', defval: 'low' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'High RSI', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Low RSI', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'True High/Low RSI for Divergence',
  shortTitle: 'RSI',
  overlay: false,
  precision: 2,
  format: 'price',
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color: string };
type Steps = { change: ReturnType<typeof taStep.change>; up: ReturnType<typeof taStep.rma>; down: ReturnType<typeof taStep.rma> };

interface ThlRun extends BarRunState<Record<string, never>> {
  high: Steps;
  low: Steps;
  /** The source values of another study (null: read from the bars) */
  extHigh: number[] | null;
  extLow: number[] | null;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<TrueHighLowRsiForDivergenceInputs>): BarStudy<ThlRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const highValue = barSource(cfg.rsiSourceHigh);
  const lowValue = barSource(cfg.rsiSourceLow);
  const steps = (): Steps => ({ change: taStep.change(), up: taStep.rma(cfg.rsiLength), down: taStep.rma(cfg.rsiLength) });
  const rsiOf = (m: Steps, src: number) => {
    const c = m.change.step(src);
    // math.max(na, 0) and math.min(na, 0) are na
    const u = m.up.step(Math.max(c, 0));
    const d = m.down.step(-Math.min(c, 0));
    return eq(d, 0) ? 100 : eq(u, 0) ? 0 : 100 - 100 / (1 + u / d);
  };
  const ext = (bars: Bar[], src: SourceType) => (isBarSource(src) ? null : getSourceSeries(bars, src).toArray());

  return {
    fullRunReason: () => (isBarSource(cfg.rsiSourceHigh) && isBarSource(cfg.rsiSourceLow) ? null : 'source of another study'),
    init(bars) {
      const high = steps();
      const low = steps();
      const s: ThlRun = {
        high, low, extHigh: ext(bars, cfg.rsiSourceHigh), extLow: ext(bars, cfg.rsiSourceLow), plot0: [], plot1: [],
        steps: [high.change, high.up, high.down, low.change, low.up, low.down], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const rsiHigh = rsiOf(s.high, s.extHigh ? s.extHigh[i] : highValue(b));
      const rsiLow = rsiOf(s.low, s.extLow ? s.extLow[i] : lowValue(b));
      const tHigh = gt(rsiHigh, 50) ? Math.max(0, (70 - rsiHigh) * 2) : 100;
      s.plot0[i] = { time: b.time, value: rsiHigh, color: String(color.new(cfg.highRsiColor, tHigh)) };
      const tLow = lt(rsiLow, 50) ? Math.max(0, (rsiLow - 30) * 2) : 100;
      s.plot1[i] = { time: b.time, value: rsiLow, color: String(color.new(cfg.lowRsiColor, tLow)) };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
          precision: metadata.precision, format: metadata.format,
        },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrueHighLowRsiForDivergenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrueHighLowRsiForDivergenceInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TrueHighLowRsiForDivergence = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
