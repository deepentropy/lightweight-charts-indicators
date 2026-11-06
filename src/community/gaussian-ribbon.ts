/**
 * Gaussian Ribbon
 *
 * Two ALMAs of the source over the same length: a fixed one (offset 0.85, sigma 6) and one with the offset and
 * sigma inputs. Both lines are drawn `lag` bars forward, green when the fixed ALMA is above the other one, else red,
 * with a fill between them in the same colour (80 % transparent).
 *
 * Reference: "Gaussian Ribbon" by NantzOS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©NantzOS
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { AlmaStep, barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GaussianRibbonInputs {
  /** Source */
  source: SourceType;
  /** ALMA length */
  windowsize: number;
  /** ALMA offset of the second line */
  offset: number;
  /** ALMA sigma of the second line */
  sigma: number;
  /** Bars the lines are drawn forward (plot offset) */
  lag: number;
}

export const defaultInputs: GaussianRibbonInputs = {
  source: 'close',
  windowsize: 49,
  offset: 0.55,
  sigma: 7,
  lag: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'windowsize', type: 'int', title: 'Length', defval: 49 },
  { id: 'offset', type: 'float', title: 'Offset', defval: 0.55, step: 0.01 },
  { id: 'sigma', type: 'float', title: 'Sigma', defval: 7, step: 0.5 },
  { id: 'lag', type: 'int', title: 'lag', defval: 21 },
];

const UP = '#1cbe21';
const DOWN = '#e02020';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Average Line', color: UP, lineWidth: 1 },
  { id: 'plot1', title: 'Offset Line', color: UP, lineWidth: 1 },
];

export const metadata = {
  title: 'Gaussian Ribbon',
  shortTitle: 'Gauss-R',
  overlay: true,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

interface GaussRun extends BarRunState<Record<string, never>> {
  alma1: AlmaStep;
  alma2: AlmaStep;
  almaValue: number[];
  almaValue2: number[];
  col: string[];
}

function study(inputs: Partial<GaussianRibbonInputs>): BarStudy<GaussRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const alma1 = new AlmaStep(cfg.windowsize, 0.85, 6);
      const alma2 = new AlmaStep(cfg.windowsize, cfg.offset, cfg.sigma);
      const s: GaussRun = { alma1, alma2, almaValue: [], almaValue2: [], col: [], steps: [alma1, alma2], vars: {}, lists: [], series: [] };
      s.series = [s.almaValue, s.almaValue2, s.col];
      return s;
    },
    bar(s, i, bars) {
      const v = value(bars[i]);
      const a = s.alma1.step(v) ?? NaN;
      const a2 = s.alma2.step(v) ?? NaN;
      s.almaValue[i] = a;
      s.almaValue2[i] = a2;
      // color_smoothalma = alma_value > alma_value2 ? #1cbe21 : #e02020
      s.col[i] = gt(a, a2) ? UP : DOWN;
    },
    result(s, bars) {
      const { almaValue, almaValue2, col } = s;
      // plot(..., offset = lag): the value of bar i is drawn on bar i + lag (future bars with barTime; a negative lag
      // drops the first bars, which have no bar to be drawn on): the times follow the bar count, built here
      const interval = barInterval(bars);
      const idx = bars.map((_b, i) => i).filter((i) => i + cfg.lag >= 0);
      const shifted = (vals: number[]) => idx.map((i) => ({
        time: barTime(bars, i + cfg.lag, interval), value: vals[i], color: col[i],
      }));

      // fill(aPlot, oPlot, color.new(color_smoothalma, 80)): fill colour of bar i goes with the plot points of bar i
      const fillColors = idx.map((i) => String(color.new(col[i], 80)));

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: shifted(almaValue),
          plot1: shifted(almaValue2),
        },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Fill' }, colors: fillColors }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GaussianRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GaussianRibbonInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const GaussianRibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
