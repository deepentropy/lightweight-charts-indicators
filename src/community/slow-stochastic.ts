/**
 * Slow Stochastic
 *
 * Stochastic of the close over the high / low range of `smoothK` bars, smoothed with a 3-bar simple average (%K),
 * and the simple average of %K over `smoothD` bars (%D). Two levels at 80 and 20 with a light purple background
 * between them.
 *
 * Reference: "Slow Stochastic" by Oshri17
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SlowStochasticInputs {
  /** Bars of the stochastic range */
  smoothK: number;
  /** Bars of the %D average */
  smoothD: number;
}

export const defaultInputs: SlowStochasticInputs = {
  smoothK: 14,
  smoothD: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'smoothK', type: 'int', title: 'smoothK', defval: 14, min: 1 },
  { id: 'smoothD', type: 'int', title: 'smoothD', defval: 3, min: 1 },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const BLACK = V1('#000000');
const RED = V1('#FF0000');
const LEVEL = '#787B86';
/** fill(h0, h1, color = purple, transp = 95) */
const BACKGROUND = String(color.new('#800080', 95));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%K', color: BLACK, lineWidth: 1 },
  { id: 'plot1', title: '%D', color: RED, lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 80, title: 'Level', color: LEVEL, linestyle: 'dashed' },
  { id: 'hline_1', price: 20, title: 'Level', color: LEVEL, linestyle: 'dashed' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_0', plot1: 'hline_0', plot2: 'hline_1', color: BACKGROUND, title: 'Hlines Background' },
];

export const metadata = {
  title: 'Slow Stochastic',
  shortTitle: 'SlowStoch',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface SlowStochRun extends BarRunState<Record<string, never>> {
  stoch: ReturnType<typeof taStep.stoch>;
  kSma: WindowSma;
  dSma: WindowSma;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<SlowStochasticInputs>): BarStudy<SlowStochRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const smoothK = Math.trunc(cfg.smoothK);
  const smoothD = Math.trunc(cfg.smoothD);
  return {
    init() {
      const stoch = taStep.stoch(smoothK);
      const kSma = new WindowSma(3);
      const dSma = new WindowSma(smoothD);
      const s: SlowStochRun = { stoch, kSma, dSma, plot0: [], plot1: [], steps: [stoch, kSma, dSma], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // k = sma(stoch(close, high, low, smoothK), 3); d = sma(k, smoothD)
      const k = s.kSma.step(s.stoch.step(b.close, b.high, b.low));
      const d = s.dSma.step(k);
      s.plot0[i] = { time: b.time, value: k, color: BLACK };
      s.plot1[i] = { time: b.time, value: d, color: RED };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
        },
        hlines: [
          { value: 80, options: { title: 'Level', color: LEVEL, linestyle: 'dashed' } },
          { value: 20, options: { title: 'Level', color: LEVEL, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_0', plot2: 'hline_1', options: { title: 'Hlines Background', color: BACKGROUND } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SlowStochasticInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SlowStochasticInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SlowStochastic = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
