/**
 * RCI Ribbon Indicator
 *
 * Displays three Rank Correlation Index (RCI) lines with different lengths.
 * RCI measures the directional consistency of price movements using Spearman's
 * rank correlation coefficient, scaled to -100 to 100.
 *
 * Based on the standard RCI Ribbon indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RCIRibbonInputs {
  /** Source for calculation */
  source: SourceType;
  /** Short RCI length */
  shortLength: number;
  /** Middle RCI length */
  middleLength: number;
  /** Long RCI length */
  longLength: number;
}

export const defaultInputs: RCIRibbonInputs = {
  source: 'close',
  shortLength: 10,
  middleLength: 30,
  longLength: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'shortLength', type: 'int', title: 'Short RCI Length', defval: 10, min: 1 },
  { id: 'middleLength', type: 'int', title: 'Middle RCI Length', defval: 30, min: 1 },
  { id: 'longLength', type: 'int', title: 'Long RCI Length', defval: 50, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short RCI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Middle RCI', color: '#F23645', lineWidth: 1 },
  { id: 'plot2', title: 'Long RCI', color: '#4CAF50', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_mid',   price: 0, color: '#787B86', linestyle: 'dashed', title: 'Middle band' },
  { id: 'hline_upper', price: 80, color: '#787B86', linestyle: 'dashed', title: 'Upper band' },
  { id: 'hline_lower', price: -80, color: '#787B86', linestyle: 'dashed', title: 'Lower band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF1A' },
];

export const metadata = {
  title: 'RCI Ribbon',
  shortTitle: 'RCI Ribbon',
  overlay: false,
};

type Point = { time: number; value: number };

/**
 * ta.rci(source, length) one bar at a time, with the operations of the oakscriptjs array function (same doubles): the
 * values in a ring of `length + 1` slots by bar index (0 at the start, not written on na bars), a bar with an na
 * source keeps the previous result, the first value on bar `length`.
 */
class RciStep {
  private readonly len: number;
  private readonly ring: number[];
  private prev = NaN;
  private pending: { slot: number; value: number; result: number } | null = null;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.ring = new Array<number>(this.len + 1).fill(0);
  }

  step(i: number, v: number): number {
    const len = this.len;
    if (Number.isNaN(v)) {
      const r = i > 0 ? this.prev : NaN;
      this.pending = { slot: -1, value: v, result: r };
      return r;
    }
    const slot = i % (len + 1);
    const at = (k: number) => (k === slot ? v : this.ring[k]!);
    let result: number;
    if (i < len) {
      result = NaN;
    } else {
      // window newest first (position 0 = this bar)
      const values = Array.from({ length: len }, (_, j) => at((i - j) % (len + 1)));
      // Ranks: ascending sweep; a group collects the values less than 1e-10 above its smallest value; each group
      // gets its average 0-based rank counted from the largest value
      const order = values.map((_, j) => j).sort((a, b) => values[a]! - values[b]!);
      const ranks = new Array<number>(len);
      for (let g = 0; g < len; ) {
        const anchor = values[order[g]!]!;
        let end = g + 1;
        while (end < len && values[order[end]!]! - anchor < 1e-10) end++;
        const avgRank = len - 1 - (g + g + (end - g) - 1) / 2;
        for (let k = g; k < end; k++) ranks[order[k]!] = avgRank;
        g = end;
      }
      let sumX = 0;
      let sumY = 0;
      let sumX2 = 0;
      let sumY2 = 0;
      for (let k = 0; k < len; k++) {
        const y = ranks[k]!;
        sumX += k;
        sumY += y;
        sumX2 += k * k;
        sumY2 += y * y;
      }
      const meanX = sumX / len;
      const meanY = sumY / len;
      const varX = sumX2 / len - meanX * meanX;
      const varY = sumY2 / len - meanY * meanY;
      if (!(varX > 0) || !(varY > 0)) {
        // a window where all values are ties has no correlation
        result = NaN;
      } else {
        let cov = 0;
        for (let k = 0; k < len; k++) cov += (k - meanX) * (ranks[k]! - meanY);
        cov /= len;
        result = (100 * cov) / (Math.sqrt(varX) * Math.sqrt(varY));
      }
    }
    this.pending = { slot, value: v, result };
    return result;
  }

  commit(): void {
    if (!this.pending) return;
    if (this.pending.slot >= 0) this.ring[this.pending.slot] = this.pending.value;
    this.prev = this.pending.result;
    this.pending = null;
  }
}

interface RciRun extends BarRunState<Record<string, never>> {
  rcis: RciStep[];
  plots: Point[][];
}

function study(inputs: Partial<RCIRibbonInputs>): BarStudy<RciRun, IndicatorResult> {
  const { source, shortLength, middleLength, longLength } = { ...defaultInputs, ...inputs };
  const value = barSource(source);
  return {
    fullRunReason: () => (isBarSource(source) ? null : 'source of another study'),
    init() {
      // ta.rci(src, short / middle / long length)
      const rcis = [shortLength, middleLength, longLength].map((l) => new RciStep(l));
      const s: RciRun = { rcis, plots: [[], [], []], steps: rcis, vars: {}, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      s.rcis.forEach((r, k) => { s.plots[k][i] = { time: b.time, value: r.step(i, v) ?? NaN }; });
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.plots[0].slice(),
          'plot1': s.plots[1].slice(),
          'plot2': s.plots[2].slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RCIRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RCIRibbonInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RCIRibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
