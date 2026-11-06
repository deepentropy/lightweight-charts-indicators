/**
 * Key_TDI
 *
 * Traders Dynamic Index lines: the RSI of the close, its SMA over the band length (centre line, orange), bands at
 * the centre +- 1.6185 * the standard deviation of the RSI over the band length (gray), and a fast SMA of the RSI
 * (gray). Dashed levels at 32 and 68. The "Lengthtradesl" input feeds a hidden calculation with no output.
 *
 * Reference: "Key_TDI" by Fibonacci_Code
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KeyTdiInputs {
  /** RSI length */
  rsiLen: number;
  /** Band (SMA / stdev) length */
  bandLen: number;
  /** Fast SMA length of the RSI */
  rsiPlLen: number;
  /** Length of the hidden trade signal line (no output) */
  trSlLen: number;
}

export const defaultInputs: KeyTdiInputs = {
  rsiLen: 13,
  bandLen: 34,
  rsiPlLen: 2,
  trSlLen: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'Lengthrsi', defval: 13 },
  { id: 'bandLen', type: 'int', title: 'Lengthband', defval: 34 },
  { id: 'rsiPlLen', type: 'int', title: 'Lengthrsipl', defval: 2 },
  { id: 'trSlLen', type: 'int', title: 'Lengthtradesl', defval: 7 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot 1', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Plot 2', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'Plot 3', color: color.orange, lineWidth: 1 },
  { id: 'plot3', title: 'Plot 4', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Key_TDI',
  shortTitle: 'Key_TDI',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface KeyTdiRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  base: WindowSma;
  sd: WindowStdev;
  fast: WindowSma;
  upper: Point[];
  lower: Point[];
  mid: Point[];
  fastData: Point[];
}

function study(inputs: Partial<KeyTdiInputs>): BarStudy<KeyTdiRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const rsi = taStep.rsi(cfg.rsiLen);
      const base = new WindowSma(cfg.bandLen);
      const sd = new WindowStdev(cfg.bandLen);
      const fast = new WindowSma(cfg.rsiPlLen);
      const s: KeyTdiRun = {
        rsi, base, sd, fast, upper: [], lower: [], mid: [], fastData: [],
        steps: [rsi, base, sd, fast], vars: {}, lists: [], series: [],
      };
      s.series = [s.upper, s.lower, s.mid, s.fastData];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i]!.time as number;
      const rawRsi = s.rsi.step(bars[i]!.close);
      const baseSma = s.base.step(rawRsi);
      const dev = s.sd.step(rawRsi) * 1.6185;
      const fast = s.fast.step(rawRsi);
      s.upper[i] = { time, value: baseSma + dev, color: color.gray };
      s.lower[i] = { time, value: baseSma - dev, color: color.gray };
      s.mid[i] = { time, value: baseSma, color: color.orange };
      s.fastData[i] = { time, value: fast, color: color.gray };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.upper.slice(),
          plot1: s.lower.slice(),
          plot2: s.mid.slice(),
          plot3: s.fastData.slice(),
        },
        hlines: [
          { value: 32, options: { title: 'Level 32', color: color.gray, linestyle: 'dashed' } },
          { value: 68, options: { title: 'Level 68', color: color.gray, linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KeyTdiInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KeyTdiInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const KeyTdi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
