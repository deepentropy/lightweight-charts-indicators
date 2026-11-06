/**
 * Vacuum Candles
 *
 * Price candles with a black body whose transparency shows the volume efficiency of the bar: eff = volume /
 * (high - low) * Multiplier, relative to the average efficiency (SMA of volume / SMA of high - low over Length bars),
 * clamped to 0..1. Transparency = int(100 * clamped): bars with a large range for their volume ("vacuum") get a
 * dark body, bars with much volume for their range a transparent body. Wicks and borders are transparent.
 *
 * Reference: "Vacuum Candles [XrayAlgo]" by XrayAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © XrayAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { PlotCandleData } from '../types';

export interface VacuumCandlesInputs {
  /** Length */
  len: number;
  /** Multiplier */
  mult: number;
}

export const defaultInputs: VacuumCandlesInputs = {
  len: 15,
  mult: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 15, min: 1, max: 100 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 1.0, min: 0.1, max: 3, step: 0.1 },
];

// Only candles (plotcandle): no line plots
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'vacuum', title: 'PlotCandle' },
];

export const metadata = {
  title: 'Vacuum Candles [XrayAlgo]',
  shortTitle: 'Vacuum Candles [XrayAlgo]',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };

interface VacuumRun extends BarRunState<Record<string, never>> {
  avgVolume: WindowSma;
  avgMove: WindowSma;
  candles: PlotCandleData[];
}

function study(inputs: Partial<VacuumCandlesInputs>): BarStudy<VacuumRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const transparentCol = color.rgb(0, 0, 0, 100);
  return {
    init() {
      const avgVolume = new WindowSma(cfg.len);
      const avgMove = new WindowSma(cfg.len);
      const s: VacuumRun = { avgVolume, avgMove, candles: [], steps: [avgVolume, avgMove], vars: {}, lists: [], series: [] };
      s.series = [s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const currMove = b.high - b.low;
      const avgVolume = s.avgVolume.step(volume) ?? NaN;
      const avgMove = s.avgMove.step(currMove) ?? NaN;
      // Plain division as Pine: x / 0 is +-infinity, 0 / 0 is na
      const eff = (volume / currMove) * cfg.mult;
      const avgEff = avgVolume / avgMove;
      const relEff = eff / avgEff;
      const clampedEff = Math.max(0, Math.min(relEff, 1));
      const inefficientAlpha = Math.trunc(100 * clampedEff); // int(): na stays na
      s.candles[i] = {
        time: b.time as number,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        color: color.rgb(0, 0, 0, inefficientAlpha),
        wickColor: transparentCol,
        borderColor: transparentCol,
        forceOverlay: true,
      };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { vacuum: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VacuumCandlesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VacuumCandlesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VacuumCandles = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
