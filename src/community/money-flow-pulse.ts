/**
 * Money Flow Pulse
 *
 * MFI of the source over `length` bars and its one-bar change (MFI ROC, drawn as an area: green when rising, red when
 * falling, lemon when flat). The MFI line is coloured by zone: orchid above 80 or below 20, lime above 60, peach
 * below 40, lemon between 40 and 60.
 *
 * Reference: "Money Flow Pulse" by TheLeadingIndicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Open Source | Designed by Adrian Dyer for "The Leading Indicator", Engineered by PineForge Laboratory (2025)
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSum, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface MoneyFlowPulseInputs {
  /** MFI length */
  length: number;
  src: SourceType;
}

export const defaultInputs: MoneyFlowPulseInputs = {
  length: 13,
  src: 'hlc3',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'MFI Length', defval: 13 },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
];

const LEMON = String(color.rgb(250, 243, 178));
const PEACH = String(color.rgb(255, 179, 128));
const LIME = String(color.rgb(178, 255, 128));
const ORCHID = String(color.rgb(186, 104, 200));
const ROC_UP = String(color.new(color.green, 33));
const ROC_DOWN = String(color.new(color.red, 33));
const ROC_FLAT = String(color.new(LEMON, 33));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MFI ROC', color: ROC_UP, lineWidth: 2, style: 'area' },
  { id: 'plot1', title: 'MFI', color: LEMON, lineWidth: 1 },
];

export const metadata = {
  title: 'Money Flow Pulse',
  shortTitle: 'Money Flow Pulse',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color: string };

/** Pine `a <= b` / `a >= b` (1e-10; na compares false) */
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && a - b <= EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && b - a <= EPS;
const zero = (x: number): number => (Math.abs(x) <= 1e-10 ? 0 : x);

/**
 * `ta.mfi(source, length)` with a constant length, one bar at a time: the operations of taStep.mfi with
 * {@link WindowSum}s of the up and down money flows (the same doubles, faster)
 */
class MfiWindow implements Committable {
  private readonly upper: WindowSum;
  private readonly lower: WindowSum;
  private prev = NaN;
  private pending = NaN;
  private stepped = false;

  constructor(length: number) {
    // the length check of ta.mfi (the same runtime error)
    taStep.mfi(length);
    this.upper = new WindowSum(length);
    this.lower = new WindowSum(length);
  }

  step(value: number, volume: number): number {
    this.stepped = true;
    this.pending = value;
    const change = value - this.prev;
    const flow = volume * value;
    const u = zero(this.upper.step(le(change, 0) ? 0 : flow));
    const l = zero(this.lower.step(ge(change, 0) ? 0 : flow));
    if (Number.isNaN(u) || Number.isNaN(l)) return NaN;
    if (l === 0) return 100;
    const ratio = 1 + u / l;
    return ratio === 0 ? NaN : 100 - 100 / ratio;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.prev = this.pending;
    this.upper.commit();
    this.lower.commit();
  }
}

interface MfpRun extends BarRunState<Record<string, never>> {
  mfi: MfiWindow;
  mfiArr: number[];
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<MoneyFlowPulseInputs>): BarStudy<MfpRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const source = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const mfi = new MfiWindow(cfg.length);
      const s: MfpRun = { mfi, mfiArr: [], plot0: [], plot1: [], steps: [mfi], vars: {}, lists: [], series: [] };
      s.series = [s.mfiArr, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const m = s.mfi.step(source(b), b.volume ?? NaN);
      s.mfiArr[i] = m;
      // mfi_score: > 80 -> 2, > 60 -> 1, < 20 -> -2, < 40 -> -1, else 0
      const score = gt(m, 80) ? 2 : gt(m, 60) ? 1 : lt(m, 20) ? -2 : lt(m, 40) ? -1 : 0;
      const mfiColor = score === 2 || score === -2 ? ORCHID : score === 1 ? LIME : score === -1 ? PEACH : LEMON;
      // mfi_roc = mfi_val - mfi_val[1]
      const roc = i > 0 ? m - s.mfiArr[i - 1]! : NaN;
      const rocColor = gt(roc, 0) ? ROC_UP : lt(roc, 0) ? ROC_DOWN : ROC_FLAT;
      s.plot0[i] = { time: t, value: fin(roc), color: rocColor };
      s.plot1[i] = { time: t, value: fin(m), color: mfiColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: String(color.new(LEMON, 50)), linestyle: 'solid', linewidth: 1 } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MoneyFlowPulseInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MoneyFlowPulseInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MoneyFlowPulse = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
