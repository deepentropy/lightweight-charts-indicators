/**
 * Z-Score
 *
 * z = (source - sma(source, length)) / stdev(source, length). Over the same length, the highest (100th percentile)
 * and lowest (0th percentile, linear interpolation) z-scores, the mean z-score (SMA) and the root mean square of
 * the z-score (sqrt(sma(z * z, length))), plotted as a positive and a negative line.
 *
 * Reference: "Z-Score" by joecalledher
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev,
  type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export interface ZScoreInputs {
  /** Length of the mean, the deviation and the z-score statistics */
  length: number;
  /** Source */
  source: SourceType;
  colorScore: string;
  colorHigh: string;
  colorLow: string;
  colorAverage: string;
  colorRms: string;
}

export const defaultInputs: ZScoreInputs = {
  length: 20,
  source: 'close',
  colorScore: color.orange,
  colorHigh: color.red,
  colorLow: color.blue,
  colorAverage: color.purple,
  colorRms: color.white,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'colorScore', type: 'color', title: 'Z-Score', defval: color.orange },
  { id: 'colorHigh', type: 'color', title: 'High', defval: color.red },
  { id: 'colorLow', type: 'color', title: 'Low', defval: color.blue },
  { id: 'colorAverage', type: 'color', title: 'Average', defval: color.purple },
  { id: 'colorRms', type: 'color', title: 'RMS', defval: color.white },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: color.orange, lineWidth: 1 },
  { id: 'plot1', title: 'High', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Low', color: color.blue, lineWidth: 1 },
  { id: 'plot3', title: 'Average', color: color.purple, lineWidth: 1 },
  { id: 'plot4', title: 'Pos RMS', color: color.white, lineWidth: 1 },
  { id: 'plot5', title: 'Neg RMS', color: color.white, lineWidth: 1 },
];

export const metadata = {
  title: 'Z-Score',
  shortTitle: 'Zscore',
  overlay: false,
};

/**
 * `ta.percentile_linear_interpolation(source, length, percentage)` one bar at a time, with the sorted window of the
 * library function: the new value inserted before the first value `>=` it (an na goes last), then the value of the
 * bar leaving the window removed; na for the first `length - 1` bars (the same doubles). The step reads the window
 * of the bar without changing it; the commit inserts and removes.
 */
class PercentileLinearStep implements Committable {
  private readonly values: number[] = [];
  private readonly ids: number[] = [];
  private bars = 0;
  private stepped = false;
  private pending = NaN;
  /** Insertion place of the pending value, place of the leaving value in the kept window (-1: none) */
  private at = 0;
  private leaving = -1;

  constructor(private readonly length: number, private readonly percentage: number) {}

  /** Value `p` of the window after the insertion and the removal */
  private get(p: number): number {
    const k = this.at;
    const r = this.leaving < 0 ? -1 : this.leaving < k ? this.leaving : this.leaving + 1;
    const q = r >= 0 && p >= r ? p + 1 : p;
    return q < k ? this.values[q]! : q === k ? this.pending : this.values[q - 1]!;
  }

  step(v: number): number {
    this.stepped = true;
    this.pending = v;
    const i = this.bars;
    const length = this.length;
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    this.at = k;
    this.leaving = i >= length ? this.ids.indexOf(i - length) : -1;
    if (i < length - 1) return NaN;
    const pos = (this.percentage / 100) * length - 0.5;
    if (pos <= 0) return this.get(0);
    if (pos >= length - 1) return this.get(length - 1);
    const lo = Math.floor(pos);
    const a = this.get(lo);
    return a + (pos - lo) * (this.get(lo + 1) - a);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const i = this.bars++;
    this.values.splice(this.at, 0, this.pending);
    this.ids.splice(this.at, 0, i);
    if (i >= this.length) {
      const old = this.ids.indexOf(i - this.length);
      this.values.splice(old, 1);
      this.ids.splice(old, 1);
    }
  }
}

type Point = { time: number; value: number; color: string };

interface ZScoreRun extends BarRunState<Record<string, never>> {
  mean: WindowSma;
  deviation: WindowStdev;
  ranklo: PercentileLinearStep;
  rankhi: PercentileLinearStep;
  zmean: WindowSma;
  zrms: WindowSma;
  plots: Point[][];
}

function study(inputs: Partial<ZScoreInputs>): BarStudy<ZScoreRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  const value = barSource(cfg.source);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const colors = [cfg.colorScore, cfg.colorHigh, cfg.colorLow, cfg.colorAverage, cfg.colorRms, cfg.colorRms];
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: ZScoreRun = {
        mean: new WindowSma(length),
        deviation: new WindowStdev(length),
        ranklo: new PercentileLinearStep(length, 0),
        rankhi: new PercentileLinearStep(length, 100),
        zmean: new WindowSma(length),
        zrms: new WindowSma(length),
        plots: colors.map(() => []),
        steps: [],
        vars: {},
        lists: [], series: [],
      };
      s.steps = [s.mean, s.deviation, s.ranklo, s.rankhi, s.zmean, s.zrms];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const x = value(bars[i]);
      const mean = s.mean.step(x);
      const deviation = s.deviation.step(x);
      // zscore = displacement / deviation: a plain division (x / 0 is +-infinity, 0 / 0 NaN), passed as it is to the
      // ta functions; plots show na for non-finite values
      const zscore = (x - mean) / deviation;
      const zranklo = s.ranklo.step(zscore);
      const zrankhi = s.rankhi.step(zscore);
      const zmean = s.zmean.step(zscore);
      const zrms = Math.sqrt(s.zrms.step(zscore * zscore));
      const p = s.plots;
      p[0]![i] = { time, value: fin(zscore), color: colors[0]! };
      p[1]![i] = { time, value: fin(zrankhi), color: colors[1]! };
      p[2]![i] = { time, value: fin(zranklo), color: colors[2]! };
      p[3]![i] = { time, value: fin(zmean), color: colors[3]! };
      p[4]![i] = { time, value: fin(zrms), color: colors[4]! };
      p[5]![i] = { time, value: fin(zrms * -1), color: colors[5]! };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0]!.slice(),
          plot1: s.plots[1]!.slice(),
          plot2: s.plots[2]!.slice(),
          plot3: s.plots[3]!.slice(),
          plot4: s.plots[4]!.slice(),
          plot5: s.plots[5]!.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZScoreInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZScoreInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ZScore = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
