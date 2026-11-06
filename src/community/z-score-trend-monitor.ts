/**
 * Z-Score Trend Monitor
 *
 * The spread between a weighted short SMA and a weighted long SMA of the close
 * (spread = sma(close, short) * shortWeight - sma(close, long) * longWeight), turned into a z-score over a lookback
 * window: z = (spread - sma(spread, lookback)) / stdev(spread, lookback). Horizontal lines at +threshold,
 * -threshold and 0.
 *
 * Reference: "Z-Score Trend Monitor [EdgeTerminal]" by EdgeTerminal
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © EdgeTerminal
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ZScoreTrendMonitorInputs {
  /** Short SMA length */
  lenShort: number;
  /** Short term weight */
  weiShort: number;
  /** Long SMA length */
  lenLong: number;
  /** Long term weight */
  weiLong: number;
  /** Z-score threshold (horizontal lines at +threshold / -threshold) */
  zThreshold: number;
  /** Z-score lookback window */
  lookback: number;
}

export const defaultInputs: ZScoreTrendMonitorInputs = {
  lenShort: 14,
  weiShort: 1,
  lenLong: 60,
  weiLong: 1,
  zThreshold: 2.0,
  lookback: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenShort', type: 'int', title: 'Short SMA', defval: 14 },
  { id: 'weiShort', type: 'float', title: 'Short Term Weight', defval: 1, max: 1, step: 0.01 },
  { id: 'lenLong', type: 'int', title: 'Long SMA', defval: 60 },
  { id: 'weiLong', type: 'float', title: 'Long Term Weight', defval: 1, max: 1, step: 0.01 },
  { id: 'zThreshold', type: 'float', title: 'Z-Score Threshold', defval: 2.0, step: 0.1 },
  { id: 'lookback', type: 'int', title: 'Z-Score Lookback Window', defval: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: color.blue, lineWidth: 2 },
];

export const metadata = {
  title: 'Z-Score Trend Monitor [EdgeTerminal]',
  shortTitle: 'Z-Score Trend Monitor [EdgeTerminal]',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface ZRun extends BarRunState<Record<string, never>> {
  smaShort: WindowSma;
  smaLong: WindowSma;
  spreadMean: WindowSma;
  spreadStd: WindowStdev;
  plot0: Point[];
}

function study(inputs: Partial<ZScoreTrendMonitorInputs>): BarStudy<ZRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: ZRun = {
        smaShort: new WindowSma(cfg.lenShort), smaLong: new WindowSma(cfg.lenLong), spreadMean: new WindowSma(cfg.lookback),
        spreadStd: new WindowStdev(cfg.lookback), plot0: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.smaShort, s.smaLong, s.spreadMean, s.spreadStd];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const smaShort = s.smaShort.step(b.close) * cfg.weiShort;
      const smaLong = s.smaLong.step(b.close) * cfg.weiLong;
      const spread = smaShort - smaLong;
      const spreadMean = s.spreadMean.step(spread);
      const spreadStd = s.spreadStd.step(spread);
      // A plain division: x / 0 is +-infinity (the plot shows na), 0 / 0 is na
      const z = (spread - spreadMean) / spreadStd;
      s.plot0[i] = { time: b.time as number, value: Number.isFinite(z) ? z : NaN, color: color.blue };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: cfg.zThreshold, options: { title: 'Upper Threshold', color: color.red, linestyle: 'dashed' } },
          { value: -cfg.zThreshold, options: { title: 'Lower Threshold', color: color.green, linestyle: 'dashed' } },
          { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZScoreTrendMonitorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZScoreTrendMonitorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ZScoreTrendMonitor = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
