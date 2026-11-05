/**
 * RCI3lines
 *
 * Three Rank Correlation Index lines (ta.rci: Spearman rank correlation of the source against time, -100..100) of the
 * source over a short, a middle and a long interval, with dashed high / low lines.
 *
 * Reference: "RCI3lines" by Jadbrother (modified by gero)
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface RCI3LinesInputs {
  /** short interval */
  shortLen: number;
  /** middle interval */
  midLen: number;
  /** long interval */
  longLen: number;
  src: SourceType;
  /** High line [%] */
  upperBand: number;
  /** Low line [%] */
  lowerBand: number;
}

export const defaultInputs: RCI3LinesInputs = {
  shortLen: 9,
  midLen: 36,
  longLen: 52,
  src: 'close',
  upperBand: 80,
  lowerBand: -80,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLen', type: 'int', title: 'short interval', defval: 9 },
  { id: 'midLen', type: 'int', title: 'middle interval', defval: 36 },
  { id: 'longLen', type: 'int', title: 'long interval', defval: 52 },
  { id: 'src', type: 'source', title: 'source', defval: 'close' },
  { id: 'upperBand', type: 'int', title: 'High line[%]', defval: 80 },
  { id: 'lowerBand', type: 'int', title: 'Low line[%]', defval: -80 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RCI short', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'RCI middle', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'RCI long', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'RCI3lines',
  shortTitle: 'RCI3lines',
  overlay: false,
};

/**
 * ta.rci(source, length) one bar at a time, with the operations of the oakscriptjs array function (same doubles): the
 * values in a ring of `length + 1` slots by bar index (0 at the start, not written on na bars), an na bar keeps the
 * previous result.
 */
class RciStep implements Committable {
  private readonly len: number;
  private readonly ring: number[];
  private last = NaN;
  private pending: { slot: number; value: number; result: number } | null = null;

  constructor(length: number) {
    // the RE10001 error of ta.rci for a length that is 0 or negative
    const t = Math.trunc(length);
    if (t <= 0) throw new Error(`Error on bar 0: Invalid value of the 'length' argument (${Number.isInteger(t) ? t.toFixed(1) : String(t)}) in the 'rci' function. It must be > 0.`);
    this.len = Math.floor(length);
    this.ring = new Array<number>(this.len + 1).fill(0);
  }

  step(i: number, v: number): number {
    const len = this.len;
    if (Number.isNaN(v)) {
      const r = i > 0 ? this.last : NaN;
      this.pending = { slot: -1, value: v, result: r };
      return r;
    }
    const slot = i % (len + 1);
    const at = (k: number) => (k === slot ? v : this.ring[k]!);
    const r = this.calc(i, at);
    this.pending = { slot, value: v, result: r };
    return r;
  }

  private calc(i: number, at: (k: number) => number): number {
    const len = this.len;
    // the first value is on bar `length` (one bar after the window is full)
    if (i < len) return NaN;
    // window newest first (position 0 = this bar)
    const values = Array.from({ length: len }, (_, j) => at((i - j) % (len + 1)));
    // Ranks: ascending sweep; a group collects the values less than 1e-10 above its smallest value; each group gets
    // its average 0-based rank counted from the largest value
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
    // a window where all values are ties has no correlation
    if (!(varX > 0) || !(varY > 0)) return NaN;
    let cov = 0;
    for (let k = 0; k < len; k++) cov += (k - meanX) * (ranks[k]! - meanY);
    cov /= len;
    return (100 * cov) / (Math.sqrt(varX) * Math.sqrt(varY));
  }

  commit(): void {
    const p = this.pending;
    if (p) {
      if (p.slot >= 0) this.ring[p.slot] = p.value;
      this.last = p.result;
    }
    this.pending = null;
  }
}

type Point = { time: number; value: number; color: string };

interface RciRun extends BarRunState<Record<string, never>> {
  rci: RciStep[];
  lines: Point[][];
}

const COLORS = [color.red, color.blue, color.green];

function study(inputs: Partial<RCI3LinesInputs>): BarStudy<RciRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const rci = [cfg.shortLen, cfg.midLen, cfg.longLen].map((len) => new RciStep(len));
      const s: RciRun = { rci, lines: [[], [], []], steps: rci, vars: {}, lists: [], series: [] };
      s.series = s.lines;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      // plot(ta.rci(src, itvs / itvm / itvl), title = 'RCI short' / 'RCI middle' / 'RCI long', red / blue / green)
      s.rci.forEach((m, k) => { s.lines[k][i] = { time: b.time, value: m.step(i, v), color: COLORS[k] }; });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.lines[0].slice(), plot1: s.lines[1].slice(), plot2: s.lines[2].slice() },
        // hline(upperband / lowerband, color = color.gray, linestyle = hline.style_dashed) (untitled)
        hlines: [
          { value: cfg.upperBand, options: { title: 'Level', color: color.gray, linestyle: 'dashed', linewidth: 1 } },
          { value: cfg.lowerBand, options: { title: 'Level', color: color.gray, linestyle: 'dashed', linewidth: 1 } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RCI3LinesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RCI3LinesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RCI3Lines = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
