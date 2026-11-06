/**
 * ADR Contraction Tightness
 *
 * Bar range % = (high - low) / low * 100 (na when low <= 0). The contraction ratio is the SMA of the range % over
 * the short length divided by its SMA over the long length (na when the long SMA is na or 0). The line is lime when
 * the ratio is at or below the super-tight threshold, yellow at or below the tight threshold, dark orange otherwise.
 * Dashed lines at both thresholds; the two SMAs and the tight / super-tight flags (1 / 0) are data-window values.
 *
 * Reference: "ADR Contraction Tightness" by etfbreakouts
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © etfbreakouts
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdrContractionTightnessInputs {
  /** SMA length of the recent range % */
  shortLen: number;
  /** SMA length of the baseline range % */
  longLen: number;
  /** Ratio at or below this: tight */
  tightThresh: number;
  /** Ratio at or below this: super-tight */
  superTightThresh: number;
}

export const defaultInputs: AdrContractionTightnessInputs = {
  shortLen: 20,
  longLen: 50,
  tightThresh: 0.70,
  superTightThresh: 0.50,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLen', type: 'int', title: 'Short ADR% length (recent)', defval: 20, min: 1 },
  { id: 'longLen', type: 'int', title: 'Long ADR% length (baseline)', defval: 50, min: 2 },
  { id: 'tightThresh', type: 'float', title: 'Tight threshold', defval: 0.70, min: 0.0, step: 0.01 },
  { id: 'superTightThresh', type: 'float', title: 'Super-tight threshold', defval: 0.50, min: 0.0, step: 0.01 },
];

const LOOSE = String(color.rgb(176, 58, 22));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Contraction Ratio', color: LOOSE, lineWidth: 2 },
  { id: 'plot1', title: 'ADR% short (recent)', color: color.aqua, lineWidth: 1, display: 'data_window' },
  { id: 'plot2', title: 'ADR% long (baseline)', color: color.gray, lineWidth: 1, display: 'data_window' },
  { id: 'plot3', title: 'isTight (1/0)', color: String(color.new(color.yellow, 100)), lineWidth: 1, display: 'data_window' },
  { id: 'plot4', title: 'isSuperTight (1/0)', color: String(color.new(color.lime, 100)), lineWidth: 1,
    display: 'data_window' },
];

export const metadata = {
  title: 'ADR Contraction Tightness',
  shortTitle: 'ADR Contract',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

interface AdrRun extends BarRunState<Record<string, never>> {
  shortSma: WindowSma;
  longSma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
}

function study(inputs: Partial<AdrContractionTightnessInputs>): BarStudy<AdrRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const shortSma = new WindowSma(cfg.shortLen);
      const longSma = new WindowSma(cfg.longLen);
      const s: AdrRun = {
        shortSma, longSma, plot0: [], plot1: [], plot2: [], plot3: [], plot4: [],
        steps: [shortSma, longSma], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.plot4];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      // bar_range_pct = low > 0 ? (high - low) / low * 100.0 : na
      const rangePct = gt(b.low, 0) ? ((b.high - b.low) / b.low) * 100.0 : NaN;
      const adrShort = s.shortSma.step(rangePct) ?? NaN;
      const adrLong = s.longSma.step(rangePct) ?? NaN;
      // (na(adr_pct_long) or adr_pct_long == 0.0) ? na : adr_pct_short / adr_pct_long
      const ratio = !Number.isFinite(adrLong) || eq(adrLong, 0.0) ? NaN : adrShort / adrLong;
      const naRatio = !Number.isFinite(ratio);
      const isTight = naRatio ? false : le(ratio, cfg.tightThresh);
      const isSuperTight = naRatio ? false : le(ratio, cfg.superTightThresh);
      const c = isSuperTight ? color.lime : isTight ? color.yellow : LOOSE;
      s.plot0[i] = { time, value: fin(ratio), color: c };
      s.plot1[i] = { time, value: fin(adrShort) };
      s.plot2[i] = { time, value: fin(adrLong) };
      s.plot3[i] = { time, value: isTight ? 1 : 0 };
      s.plot4[i] = { time, value: isSuperTight ? 1 : 0 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 1 },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
        hlines: [
          { value: cfg.tightThresh, options: { title: 'Tight threshold', color: color.yellow, linestyle: 'dashed', linewidth: 1 } },
          { value: cfg.superTightThresh,
            options: { title: 'Super-tight threshold', color: color.lime, linestyle: 'dashed', linewidth: 1 } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdrContractionTightnessInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdrContractionTightnessInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AdrContractionTightness = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
