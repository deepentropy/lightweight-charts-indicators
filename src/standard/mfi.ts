/**
 * Money Flow Index (MFI) Indicator
 *
 * Volume-weighted RSI that measures buying and selling pressure.
 * Range: 0 to 100
 */

import { compare, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type Committable, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MFIInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: MFIInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1, max: 2000 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MF', color: '#7E57C2', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 80, color: '#787B86', linestyle: 'dashed', title: 'Overbought' },
  { id: 'hline_mid',   price: 50, color: '#787B8680', linestyle: 'dashed', title: 'Middle Band' },
  { id: 'hline_lower', price: 20, color: '#787B86', linestyle: 'dashed', title: 'Oversold' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#7E57C21A' },
];

export const metadata = {
  title: 'Money Flow Index',
  shortTitle: 'MFI',
  overlay: false,
};

type Point = { time: number; value: number };

/** A window sum within the comparison tolerance of 0 is 0 */
const zero = (x: number): number => (Math.abs(x) <= 1e-10 ? 0 : x);

/** `ta.mfi(source, length)` with a constant length: the window sums of the money flow of the up and down bars (the
 *  doubles of taStep.mfi, with the faster {@link WindowSum}s) */
class MfiStep implements Committable {
  private readonly upper: WindowSum;
  private readonly lower: WindowSum;
  private prev = NaN;
  private bars = 0;
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
    const change = this.bars === 0 ? NaN : value - this.prev;
    const flow = volume * value;
    const u = zero(this.upper.step(compare.le(change, 0) ? 0 : flow));
    const l = zero(this.lower.step(compare.ge(change, 0) ? 0 : flow));
    if (Number.isNaN(u) || Number.isNaN(l)) return NaN;
    if (l === 0) return 100;
    const ratio = 1 + u / l;
    return ratio === 0 ? NaN : 100 - 100 / ratio;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.prev = this.pending;
    this.bars++;
    this.upper.commit();
    this.lower.commit();
  }
}

interface MfiRun extends BarRunState<Record<string, never>> {
  mfi: MfiStep;
  mfiData: Point[];
}

function study(inputs: Partial<MFIInputs>): BarStudy<MfiRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const mfi = new MfiStep(length);
      const s: MfiRun = { mfi, mfiData: [], steps: [mfi], vars: {}, lists: [], series: [] };
      s.series = [s.mfiData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // mf = ta.mfi(hlc3, length): upper = math.sum(volume * (ta.change(src) <= 0 ? 0 : src), length),
      // lower likewise with >= 0; 100 - 100 / (1 + upper / lower)
      const value = s.mfi.step((b.high + b.low + b.close) / 3, b.volume ?? NaN);
      s.mfiData[i] = { time: b.time as number, value: value ?? NaN };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.mfiData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MFIInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MFIInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MFI = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
