/**
 * Acceleration Bands HTF
 *
 * Acceleration Bands (Price Headley): the upper band is the SMA of high * (1 + 4 * (high - low) / (high + low)), the
 * lower band the SMA of low * (1 - 4 * (high - low) / (high + low)) and the middle line the SMA of the close, all over
 * `p` bars. The Pine script runs on the chart timeframe by default (indicator timeframe = ""); the extra Timeframe
 * setting of the original is not ported.
 *
 * Reference: "Acceleration Bands HTF" by ZoharCho
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © zoharcho. Thanks to © capissimo who provided the base code
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AccelerationBandsHtfInputs {
  /** Lookback window */
  p: number;
}

export const defaultInputs: AccelerationBandsHtfInputs = {
  p: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'p', type: 'int', title: 'Lookback Window (20,80)', defval: 80, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Lower', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Middle', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'Acceleration Bands HTF',
  shortTitle: 'Acceleration Bands HTF',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

interface AbRun extends BarRunState<Record<string, never>> {
  upper: WindowSma;
  ma: WindowSma;
  lower: WindowSma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

const na = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? NaN : v);

function study(inputs: Partial<AccelerationBandsHtfInputs>): BarStudy<AbRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const upper = new WindowSma(cfg.p);
      const ma = new WindowSma(cfg.p);
      const lower = new WindowSma(cfg.p);
      const s: AbRun = { upper, ma, lower, plot0: [], plot1: [], plot2: [], steps: [upper, ma, lower], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // A plain division: high + low = 0 gives +-infinity (or na), skipped by ta.sma as na
      const upSrc = b.high * (1 + (4 * (b.high - b.low)) / (b.high + b.low));
      const lowSrc = b.low * (1 - (4 * (b.high - b.low)) / (b.high + b.low));
      const upper = s.upper.step(upSrc);
      const ma = s.ma.step(b.close);
      const lower = s.lower.step(lowSrc);
      s.plot0[i] = { time: b.time, value: na(upper), color: color.gray };
      s.plot1[i] = { time: b.time, value: na(lower), color: color.gray };
      s.plot2[i] = { time: b.time, value: na(ma), color: color.orange };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AccelerationBandsHtfInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AccelerationBandsHtfInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AccelerationBandsHtf = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
