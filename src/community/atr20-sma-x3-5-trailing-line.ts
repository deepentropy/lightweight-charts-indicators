/**
 * ATR20 SMA x3.5 Trailing Line
 *
 * True range tr = max(high - low, |high - close[1]|, |low - close[1]|) (na on the first bar), averaged with an SMA
 * of `atrLen` bars. The line is the highest high of `lookbackHighLen` bars minus `atrMult` times this average.
 *
 * Reference: "ATR20 SMA x3.5 Trailing Line" by hibinomasakazu1991
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © hibinomasakazu1991
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface Atr20SmaX35TrailingLineInputs {
  /** SMA length of the true range */
  atrLen: number;
  /** Multiplier of the average true range */
  atrMult: number;
  /** Length of the highest high */
  lookbackHighLen: number;
}

export const defaultInputs: Atr20SmaX35TrailingLineInputs = {
  atrLen: 20,
  atrMult: 3.5,
  lookbackHighLen: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 20, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3.5, min: 0.1, step: 0.1 },
  { id: 'lookbackHighLen', type: 'int', title: 'High Lookback', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR20 SMA x3.5 Line', color: color.red, lineWidth: 2 },
];

export const metadata = {
  title: 'ATR20 SMA x3.5 Trailing Line',
  shortTitle: 'ATR20 SMA x3.5 Trailing Line',
  overlay: true,
};

type Point = { time: number; value: number };

interface TrailingLineRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  hh: WindowExtreme;
  plot0: Point[];
}

function study(inputs: Partial<Atr20SmaX35TrailingLineInputs>): BarStudy<TrailingLineRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const sma = new WindowSma(cfg.atrLen);
      const hh = new WindowExtreme(false, cfg.lookbackHighLen);
      const s: TrailingLineRun = { sma, hh, plot0: [], steps: [sma, hh], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // tr = math.max(high - low, math.max(math.abs(high - close[1]), math.abs(low - close[1]))): na on bar 0
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const tr = Math.max(b.high - b.low, Math.max(Math.abs(b.high - prevClose), Math.abs(b.low - prevClose)));
      const atrSma = s.sma.step(tr) ?? NaN;
      const hh = s.hh.step(b.high) ?? NaN;
      const v = hh - cfg.atrMult * atrSma;
      s.plot0[i] = { time: b.time, value: Number.isFinite(v) ? v : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Atr20SmaX35TrailingLineInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Atr20SmaX35TrailingLineInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Atr20SmaX35TrailingLine = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
