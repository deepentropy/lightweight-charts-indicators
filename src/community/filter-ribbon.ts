/**
 * Filter Ribbon
 *
 * A ribbon around the linear regression of the source (length 90). The trend score counts, over the last
 * `lookback` regression values, the ordered pairs (i < j bars ago) where the newer value is above (+1) or below
 * (-1) the older one. The state is bull when the score is above `tolerance` % of the pair count, bear otherwise
 * (a neutral score is drawn with the bear colour). The ribbon is the regression +/- 0.1 * ATR(14); its colour is
 * more opaque when the absolute score is closer to the pair count.
 *
 * Reference: "Filter Ribbon" by c9indicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FilterRibbonInputs {
  /** Number of regression values compared pairwise */
  lookback: number;
  /** Range tolerance (%) of the pair count for a bull / bear state */
  tolerance: number;
  /** Regression source */
  src: SourceType;
  /** Linear regression length */
  lrLength: number;
  bullColor: string;
  bearColor: string;
}

export const defaultInputs: FilterRibbonInputs = {
  lookback: 12,
  tolerance: 90,
  src: 'close',
  lrLength: 90,
  bullColor: '#00ffbb',
  bearColor: '#ff1100',
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback Period', defval: 12, min: 2 },
  { id: 'tolerance', type: 'int', title: 'Range Tolerance (%)', defval: 90, min: 0, max: 100 },
  { id: 'src', type: 'source', title: 'Regression Source', defval: 'close' },
  { id: 'lrLength', type: 'int', title: 'Linear Regression Length', defval: 90, min: 1 },
  { id: 'bullColor', type: 'color', title: 'Bull Ribbon Color', defval: '#00ffbb' },
  { id: 'bearColor', type: 'color', title: 'Bear Ribbon Color', defval: '#ff1100' },
];

const LR_COLOR = String(color.new(color.white, 60));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ribbon Top', color: '#ff1100', lineWidth: 3 },
  { id: 'plot1', title: 'Ribbon Bottom', color: '#ff1100', lineWidth: 3 },
  // fill(plot(ribbon_top), plot(ribbon_bottom), ...): plots without a colour, drawn with the Pine default colour
  { id: 'plot2', title: 'Ribbon Top (fill)', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'Ribbon Bottom (fill)', color: '#2962FF', lineWidth: 1 },
  { id: 'plot4', title: 'Linear Regression', color: LR_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Filter Ribbon',
  shortTitle: 'Filter Ribbon',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

interface RibbonRun extends BarRunState<Record<string, never>> {
  linreg: ReturnType<typeof taStep.linreg>;
  atr: ReturnType<typeof taStep.atr>;
  lr: number[];
  cols: string[];
  plots: Point[][];
}

function study(inputs: Partial<FilterRibbonInputs>): BarStudy<RibbonRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const k = cfg.lookback;
  // total_pairs = n * (n - 1) / 2; threshold = total_pairs * (p / 100)
  const totalPairs = (k * (k - 1)) / 2;
  const threshold = totalPairs * (cfg.tolerance / 100);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: RibbonRun = {
        linreg: taStep.linreg(cfg.lrLength, 0), atr: taStep.atr(14), lr: [], cols: [],
        plots: Array.from({ length: 5 }, () => []), steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.linreg, s.atr];
      s.series = [s.lr, s.cols, ...s.plots];
      return s;
    },
    bar(s, t, bars) {
      const bar = bars[t];
      const lrT = s.linreg.step(value(bar));
      const atr = s.atr.step(bar.high, bar.low, bar.close);
      const lr = s.lr;
      lr[t] = lrT;
      let trend = 0;
      for (let i = 0; i <= k - 2; i++) {
        for (let j = i + 1; j <= k - 1; j++) {
          const a = t - i >= 0 ? lr[t - i] : NaN;
          const b = t - j >= 0 ? lr[t - j] : NaN;
          trend += gt(a, b) ? 1 : gt(b, a) ? -1 : 0;
        }
      }
      const state = trend > threshold ? 1 : trend < -threshold ? -1 : 0;
      const intensity = Math.abs(trend) / totalPairs;
      // alpha = 90 - int(intensity * 70)
      const alpha = 90 - Math.trunc(intensity * 70);
      const col = String(color.new(state === 1 ? cfg.bullColor : cfg.bearColor, alpha));
      s.cols[t] = col;
      const offset = atr * 0.1;
      const top = lrT + offset;
      const bottom = lrT - offset;
      const time = bar.time;
      // plot(ribbon_top, color = ribbon_col, linewidth = 3); plot(ribbon_bottom, ...)
      s.plots[0][t] = { time, value: top, color: col };
      s.plots[1][t] = { time, value: bottom, color: col };
      s.plots[2][t] = { time, value: top };
      s.plots[3][t] = { time, value: bottom };
      // plot(lr, color = color.new(color.white, 60), linewidth = 1)
      s.plots[4][t] = { time, value: lrT, color: LR_COLOR };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        // fill(plot(ribbon_top), plot(ribbon_bottom), color = ribbon_col)
        fills: [{ plot1: 'plot2', plot2: 'plot3', colors: s.cols.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FilterRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FilterRibbonInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const FilterRibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
