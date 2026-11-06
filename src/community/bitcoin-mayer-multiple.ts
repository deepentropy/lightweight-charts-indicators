/**
 * Mayer Multiple
 *
 * Mayer Multiple = close / SMA(close, length), drawn as a histogram. Fixed reference lines at 0.55, 0.70, 0.85, 1.00,
 * 1.20, 1.45, 1.90, 2.20, 2.60 and 3.00. The histogram takes the colour of the highest reference level it is above
 * (black at or below 0.55).
 *
 * Reference: "Bitcoin: Mayer Multiple" by sito4713
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BitcoinMayerMultipleInputs {
  /** Length of the price SMA */
  psmaLength: number;
}

export const defaultInputs: BitcoinMayerMultipleInputs = {
  psmaLength: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'psmaLength', type: 'int', title: 'Price SMA Length', defval: 200 },
];

const AZURE = String(color.new(color.rgb(0, 128, 255), 0));
const AQUA = String(color.new(color.rgb(0, 255, 255), 0));
const MINT = String(color.new(color.rgb(0, 255, 128), 0));
const CHARTREUSE = String(color.new(color.rgb(128, 255, 0), 0));
const YELLOW = String(color.new(color.rgb(255, 255, 0), 0));
const AMBER = String(color.new(color.rgb(255, 204, 0), 0));
const ORANGE = String(color.new(color.rgb(255, 128, 0), 0));
const RED = String(color.new(color.rgb(255, 0, 0), 0));
const VIOLET = String(color.new(color.rgb(148, 78, 208), 0));
const BLACK = color.black;

/** Reference levels: value, title, colour, width (Pine plot order) */
const LEVELS: [number, string, string, number][] = [
  [0.55, 'Smash Buy', BLACK, 2],
  [0.7, '90% Higher', VIOLET, 2],
  [0.85, '75% Higher', AZURE, 2],
  [1.0, 'Boost DCA', AQUA, 1],
  [1.2, 'Median', MINT, 1],
  [1.45, 'Caution', CHARTREUSE, 1],
  [1.9, 'Danger', YELLOW, 1],
  [2.2, 'Extreme Euphoria', AMBER, 1],
  [2.6, 'Correction Imminent', ORANGE, 1],
  [3.0, 'Correction Imminent', RED, 1],
];

export const plotConfig: PlotConfig[] = [
  ...LEVELS.map(([, title, c, w], k) => ({ id: `plot${k}`, title, color: c, lineWidth: w })),
  { id: 'plot10', title: 'Mayer Multiple', color: BLACK, lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'Mayer Multiple',
  shortTitle: 'Mayer Multiple',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

interface MayerRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  plots: Point[][];
}

function study(inputs: Partial<BitcoinMayerMultipleInputs>): BarStudy<MayerRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const sma = new WindowSma(cfg.psmaLength);
      const s: MayerRun = { sma, plots: Array.from({ length: LEVELS.length + 1 }, () => []), steps: [sma], vars: {}, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const ma = s.sma.step(b.close);
      LEVELS.forEach(([value, , c], k) => {
        s.plots[k][i] = { time: b.time, value, color: c };
      });
      const multiple = b.close / ma;
      const c = gt(multiple, 2.6) ? RED
        : gt(multiple, 2.2) ? ORANGE
        : gt(multiple, 1.9) ? AMBER
        : gt(multiple, 1.45) ? YELLOW
        : gt(multiple, 1.2) ? CHARTREUSE
        : gt(multiple, 1.0) ? MINT
        : gt(multiple, 0.85) ? AQUA
        : gt(multiple, 0.7) ? AZURE
        : gt(multiple, 0.55) ? VIOLET
        : BLACK;
      s.plots[LEVELS.length][i] = { time: b.time, value: Number.isFinite(multiple) ? multiple : NaN, color: c };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BitcoinMayerMultipleInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BitcoinMayerMultipleInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BitcoinMayerMultiple = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
