/**
 * Gamma + Fibonacci EMA Bands
 *
 * Three fast gamma EMAs: ema = gamma * src + (1 - gamma) * ema[1], started at gamma * src on the first bar (the
 * previous value is na, read as 0). Six slow EMAs of the source with the Fibonacci lengths 34, 55, 89, 144, 233
 * and 377.
 *
 * Reference: "Gamma + Fibonacci EMA Bands" by ky_yule1010
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GammaFibonacciEmaBandsInputs {
  /** Source */
  src: SourceType;
  /** Weight of the current source in gamma EMA 1 */
  gamma1: number;
  /** Weight of the current source in gamma EMA 2 */
  gamma2: number;
  /** Weight of the current source in gamma EMA 3 */
  gamma3: number;
}

export const defaultInputs: GammaFibonacciEmaBandsInputs = {
  src: 'close',
  gamma1: 0.2,
  gamma2: 0.5,
  gamma3: 0.8,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'gamma1', type: 'float', title: 'Gamma 1', defval: 0.2, step: 0.01 },
  { id: 'gamma2', type: 'float', title: 'Gamma 2', defval: 0.5, step: 0.01 },
  { id: 'gamma3', type: 'float', title: 'Gamma 3', defval: 0.8, step: 0.01 },
];

const COLORS = [
  String(color.new('#a8457a', 0)),
  String(color.new('#af7ab8', 0)),
  String(color.new('#edd6f5', 0)),
  String(color.new(color.orange, 0)),
  String(color.new('#7e4b00', 0)),
  String(color.new(color.red, 0)),
  String(color.new('#c53333', 0)),
  String(color.new('#7e1010', 0)),
  String(color.new('#350101', 0)),
];
const TITLES = ['GAMMA EMA 1', 'GAMMA EMA 2', 'GAMMA EMA 3', 'EMA 34', 'EMA 55', 'EMA 89', 'EMA 144', 'EMA 233', 'EMA 377'];
const FIB_LENGTHS = [34, 55, 89, 144, 233, 377];

export const plotConfig: PlotConfig[] = TITLES.map((title, k) => ({ id: `plot${k}`, title, color: COLORS[k], lineWidth: 1 }));

export const metadata = {
  title: 'Gamma + Fibonacci EMA Bands',
  shortTitle: 'Gamma + Fibonacci EMA Bands',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

interface GammaRun extends BarRunState<Record<string, never>> {
  emas: ReturnType<typeof taStep.ema>[];
  /** The values of the three gamma EMAs */
  gemas: number[][];
  plots: Point[][];
}

function study(inputs: Partial<GammaFibonacciEmaBandsInputs>): BarStudy<GammaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const gammas = [cfg.gamma1, cfg.gamma2, cfg.gamma3];
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const emas = FIB_LENGTHS.map((len) => taStep.ema(len));
      const s: GammaRun = {
        emas, gemas: [[], [], []], plots: TITLES.map(() => []), steps: emas, vars: {}, lists: [], series: [],
      };
      s.series = [...s.gemas, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b) ?? NaN;
      // calcGEMA(_src, g): if barstate.isfirst: _ema := _src; then _ema := g * _src + (1 - g) * nz(_ema[1])
      for (let k = 0; k < 3; k++) {
        const out = s.gemas[k];
        const g = gammas[k];
        const prev = i > 0 && !isNaN(out[i - 1]) ? out[i - 1] : 0; // nz(_ema[1])
        out[i] = g * v + (1 - g) * prev;
        s.plots[k][i] = { time: b.time, value: out[i], color: COLORS[k] };
      }
      for (let k = 0; k < FIB_LENGTHS.length; k++) {
        s.plots[k + 3][i] = { time: b.time, value: s.emas[k].step(v) ?? NaN, color: COLORS[k + 3] };
      }
    },
    result(s) {
      const plots: Record<string, Array<{ time: number; value: number; color: string }>> = {};
      s.plots.forEach((p, k) => {
        plots[`plot${k}`] = p.slice();
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GammaFibonacciEmaBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GammaFibonacciEmaBandsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const GammaFibonacciEmaBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
