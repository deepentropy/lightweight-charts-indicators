/**
 * Multiple Exponential Fibnonacci Moving Averages
 *
 * Six moving averages of the source with Fibonacci lengths (21, 55, 144, 233, 377, 610): EMAs, except the fifth
 * line, which is an SMA in the original script (its title stays 'EMA5'). Colours go from cyan to dark teal.
 *
 * Reference: "Multiple Exponential Fibnonacci Moving Averages" by LensOfChartist
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MultipleExponentialFibnonacciMovingAveragesInputs {
  /** Source */
  src: SourceType;
  /** EMA length of line 1 */
  ema1: number;
  /** EMA length of line 2 */
  ema2: number;
  /** EMA length of line 3 */
  ema3: number;
  /** EMA length of line 4 */
  ema4: number;
  /** SMA length of line 5 */
  ema5: number;
  /** EMA length of line 6 */
  ema6: number;
}

export const defaultInputs: MultipleExponentialFibnonacciMovingAveragesInputs = {
  src: 'close',
  ema1: 21,
  ema2: 55,
  ema3: 144,
  ema4: 233,
  ema5: 377,
  ema6: 610,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'src', defval: 'close' },
  { id: 'ema1', type: 'int', title: 'EMA1', defval: 21 },
  { id: 'ema2', type: 'int', title: 'EMA2', defval: 55 },
  { id: 'ema3', type: 'int', title: 'EMA3', defval: 144 },
  { id: 'ema4', type: 'int', title: 'EMA4', defval: 233 },
  { id: 'ema5', type: 'int', title: 'EMA5', defval: 377 },
  { id: 'ema6', type: 'int', title: 'EMA6', defval: 610 },
];

const COLORS = [
  String(color.rgb(0, 230, 250)),
  String(color.rgb(10, 210, 230)),
  String(color.rgb(20, 190, 210)),
  String(color.rgb(30, 170, 190)),
  String(color.rgb(40, 150, 170)),
  String(color.rgb(50, 130, 150)),
];

export const plotConfig: PlotConfig[] = COLORS.map((c, k) => ({
  id: `plot${k}`, title: `EMA${k + 1}`, color: c, lineWidth: 1,
}));

export const metadata = {
  title: 'Multiple Exponential Fibnonacci Moving Averages',
  shortTitle: 'MEFMA',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

interface MefmaRun extends BarRunState<Record<string, never>> {
  mas: Array<{ step(v: number): number; commit(): void }>;
  lines: Point[][];
}

function study(inputs: Partial<MultipleExponentialFibnonacciMovingAveragesInputs>): BarStudy<MefmaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // pema1..pema6: ta.ema, except pema5 = ta.sma(src, ema5)
      const mas = [
        taStep.ema(cfg.ema1),
        taStep.ema(cfg.ema2),
        taStep.ema(cfg.ema3),
        taStep.ema(cfg.ema4),
        new WindowSma(cfg.ema5),
        taStep.ema(cfg.ema6),
      ];
      const s: MefmaRun = { mas, lines: mas.map(() => []), steps: mas, vars: {}, lists: [], series: [] };
      s.series = s.lines;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      for (let k = 0; k < 6; k++) s.lines[k][i] = { time: b.time as number, value: s.mas[k].step(v) ?? NaN, color: COLORS[k] };
    },
    result(s) {
      const plots: IndicatorResult['plots'] = {};
      s.lines.forEach((line, k) => {
        plots[`plot${k}`] = line.slice();
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<MultipleExponentialFibnonacciMovingAveragesInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MultipleExponentialFibnonacciMovingAveragesInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MultipleExponentialFibnonacciMovingAverages = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
