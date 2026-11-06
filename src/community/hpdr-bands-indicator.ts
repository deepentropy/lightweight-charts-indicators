/**
 * HPDR Bands
 *
 * A wide range: the highest high over `length` bars * 1.15 and the lowest low * 0.85; the midline is their average.
 * The outer bands blend 70 % of this range with 30 % of the highest high / lowest low over `probLength` bars. Seven
 * levels are drawn on each side, from the outer band (100 %) towards the midline (95, 88, 78, 61, 50, 38 % of the
 * distance between the outer band and the midline).
 *
 * Reference: "HPDR Bands Indicator" by afonso_77
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Trigooo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HpdrBandsIndicatorInputs {
  /** Lookback length of the wide range */
  length: number;
  /** Lookback length of the recent highest high / lowest low */
  probLength: number;
}

export const defaultInputs: HpdrBandsIndicatorInputs = {
  length: 100,
  probLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Lookback Length', defval: 100, min: 1 },
  { id: 'probLength', type: 'int', title: 'Probability Length', defval: 10, min: 1 },
];

/** Levels from the outer band towards the midline, with their colours */
const LEVELS: { pct: number; ratio: number; color: string }[] = [
  { pct: 100, ratio: 0, color: '#00FF00' },
  { pct: 95, ratio: 0.95, color: '#0000FF' },
  { pct: 88, ratio: 0.88, color: '#00FFFF' },
  { pct: 78, ratio: 0.78, color: '#FFFF00' },
  { pct: 61, ratio: 0.61, color: '#FFA500' },
  { pct: 50, ratio: 0.5, color: '#FF0000' },
  { pct: 38, ratio: 0.38, color: '#8B0000' },
];

export const plotConfig: PlotConfig[] = [
  ...LEVELS.map((l, k) => ({ id: `plot${k}`, title: `Level ${l.pct} High`, color: l.color, lineWidth: 1 })),
  ...LEVELS.map((l, k) => ({ id: `plot${k + 7}`, title: `Level ${l.pct} Low`, color: l.color, lineWidth: 1 })),
  { id: 'plot14', title: 'Midline', color: color.white, lineWidth: 3 },
];

export const metadata = {
  title: 'HPDR Bands',
  shortTitle: 'HPDR Bands',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

interface HpdrRun extends BarRunState<Record<string, never>> {
  longHigh: ReturnType<typeof taStep.highest>;
  longLow: ReturnType<typeof taStep.lowest>;
  recentHigh: ReturnType<typeof taStep.highest>;
  recentLow: ReturnType<typeof taStep.lowest>;
  plots: Point[][];
}

function study(inputs: Partial<HpdrBandsIndicatorInputs>): BarStudy<HpdrRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: HpdrRun = {
        longHigh: taStep.highest(), longLow: taStep.lowest(), recentHigh: taStep.highest(), recentLow: taStep.lowest(),
        plots: plotConfig.map(() => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.longHigh, s.longLow, s.recentHigh, s.recentLow];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const visibleHigh = s.longHigh.step(b.high, cfg.length) * 1.15;
      const visibleLow = s.longLow.step(b.low, cfg.length) * 0.85;
      const midline = (visibleHigh + visibleLow) / 2;
      const adaptedHigh = visibleHigh * 0.7 + s.recentHigh.step(b.high, cfg.probLength) * 0.3;
      const adaptedLow = visibleLow * 0.7 + s.recentLow.step(b.low, cfg.probLength) * 0.3;
      for (let k = 0; k < LEVELS.length; k++) {
        const l = LEVELS[k];
        // level_100_high = adaptedHigh; level_X_high = adaptedHigh - (adaptedHigh - midline) * X
        const hi = l.pct === 100 ? adaptedHigh : adaptedHigh - (adaptedHigh - midline) * l.ratio;
        const lo = l.pct === 100 ? adaptedLow : adaptedLow + (midline - adaptedLow) * l.ratio;
        s.plots[k][i] = { time: b.time, value: hi, color: l.color };
        s.plots[k + 7][i] = { time: b.time, value: lo, color: l.color };
      }
      s.plots[14][i] = { time: b.time, value: midline, color: color.white };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      plotConfig.forEach((p, k) => {
        plots[p.id] = s.plots[k].slice();
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HpdrBandsIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HpdrBandsIndicatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const HpdrBandsIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
