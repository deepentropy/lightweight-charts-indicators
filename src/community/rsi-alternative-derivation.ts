/**
 * RSI: Alternative Derivation
 *
 * An RSI built from the distance of the close to its Wilder average: distance = close - RMA(close, length),
 * standardized by the Wilder average of the absolute close-to-close change (RMA(|close - close[1]|, length)),
 * normalized by (length - 1) and mapped to 0..100: RSI = 50 * (1 + normalized distance). The "Show Steps" input
 * draws one step of the computation instead (change, distance, standardized distance, normalized distance, RSI).
 * An optional line draws the regular ta.rsi for comparison.
 *
 * Reference: "RSI: alternative derivation" by AdaptiveRSI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This Pine Script code is subject to the terms of the Creative Commons
 * Attribution-NonCommercial-ShareAlike 4.0 International License (https://creativecommons.org/licenses/by-nc-sa/4.0/).
 * © AdaptiveRSI
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type RsiAlternativeDerivationStep = 'change' | 'distance' | 'standardized distance' | 'normalized distance' | 'RSI';

export interface RsiAlternativeDerivationInputs {
  /** Length of the Wilder averages */
  length: number;
  /** Step of the computation to draw */
  step: RsiAlternativeDerivationStep;
  /** Draw the regular RSI for comparison */
  rsiComparison: boolean;
}

export const defaultInputs: RsiAlternativeDerivationInputs = {
  length: 14,
  step: 'RSI',
  rsiComparison: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 2 },
  {
    id: 'step', type: 'string', title: 'Show Steps:', defval: 'RSI',
    options: ['change', 'distance', 'standardized distance', 'normalized distance', 'RSI'],
  },
  { id: 'rsiComparison', type: 'bool', title: 'Plot Regular RSI for Comparison', defval: false },
];

const ALT_COL = String(color.new(color.gray, 50));
const RSI_COL = String(color.new(color.red, 25));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'alternative RSI', color: ALT_COL, lineWidth: 3 },
  { id: 'plot1', title: 'regular RSI', color: RSI_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'RSI: Alternative Derivation',
  shortTitle: 'AdaptiveRSI · RSI alternative derivation',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface RsiAltRun extends BarRunState<Record<string, never>> {
  myEma: ReturnType<typeof taStep.rma>;
  ccVol: ReturnType<typeof taStep.rma>;
  rsi: ReturnType<typeof taStep.rsi> | null;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<RsiAlternativeDerivationInputs>): BarStudy<RsiAltRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  const normalizationFactor = length - 1.0;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      // myEMA = ta.rma(close, Length); CC_vol = ta.rma(math.abs(close - close[1]), Length)
      const myEma = taStep.rma(length);
      const ccVol = taStep.rma(length);
      // ta.rsi inside the ternary: it runs on every bar when the input is on, never when it is off
      const rsi = cfg.rsiComparison ? taStep.rsi(length) : null;
      const s: RsiAltRun = {
        myEma, ccVol, rsi, plot0: [], plot1: [],
        steps: [myEma, ccVol, ...(rsi ? [rsi] : [])], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const myEma = s.myEma.step(b.close);
      const ccVol = s.ccVol.step(i > 0 ? Math.abs(b.close - bars[i - 1].close) : NaN);
      const rsi = s.rsi ? s.rsi.step(b.close) : NaN;
      const distance = b.close - myEma;
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); the plot shows na for both
      const standardized = distance / ccVol;
      const normalized = standardized / normalizationFactor;
      const myRsi = 50 * (1 + normalized);
      let v: number;
      switch (cfg.step) {
        case 'change': v = ccVol; break;
        case 'distance': v = distance; break;
        case 'standardized distance': v = standardized; break;
        case 'normalized distance': v = normalized; break;
        case 'RSI': v = myRsi; break;
        default: v = NaN;
      }
      s.plot0[i] = { time: b.time, value: fin(v), color: ALT_COL };
      s.plot1[i] = { time: b.time, value: s.rsi ? fin(rsi) : NaN, color: RSI_COL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiAlternativeDerivationInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiAlternativeDerivationInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiAlternativeDerivation = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
