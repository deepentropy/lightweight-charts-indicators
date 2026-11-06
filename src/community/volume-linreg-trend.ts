/**
 * Volume-Supported Linear Regression Trend (VSLRT)
 *
 * Pine: overlay=false, 2 plots:
 *   1) Short-term linreg slope * len1 as columns with 6-level conditional coloring
 *   2) Long-term linreg slope * len2 as line (linewidth=3) with 6-level conditional coloring
 *
 * Coloring logic uses buy/sell volume regression slopes to determine color intensity.
 *
 * Reference: "Volume-Supported Linear Regression Trend" by LonesomeTheBlue
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface VolumeLinRegTrendInputs {
  src: SourceType;
  len1: number;
  len2: number;
}

export const defaultInputs: VolumeLinRegTrendInputs = {
  src: 'close',
  len1: 20,
  len2: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len1', type: 'int', title: 'Short Term Length', defval: 20, min: 5 },
  { id: 'len2', type: 'int', title: 'Long Term Length', defval: 50, min: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short Term', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Long Term', color: '#008EFF', lineWidth: 3, style: 'line' },
];

export const metadata = {
  title: 'Volume-Supported Linear Regression Trend',
  shortTitle: 'VSLRT',
  overlay: false,
};

/**
 * `ta.linreg(source, length, 0)` and `ta.linreg(source, length, 1)` of one source, one bar at a time: the sums of the
 * library function (x = 1 oldest .. length newest, summed from the oldest value), na before bar `length - 1` and when
 * a value of the window is NaN. `r0` / `r1`: the two lines of the last step.
 */
class LinregPair implements Committable {
  private readonly values: number[] = [];
  private pending = NaN;
  private stepped = false;
  private readonly len: number;
  r0 = NaN;
  r1 = NaN;

  constructor(length: number) {
    const len = Math.trunc(length);
    if (len <= 0) throw new Error(`linreg: length must be greater than 0, got ${len}`);
    this.len = Math.floor(length);
  }

  step(value: number): void {
    this.stepped = true;
    this.pending = value;
    const len = this.len;
    const h = this.values;
    this.r0 = NaN;
    this.r1 = NaN;
    if (h.length < len - 1) return;
    // window: h[h.length - len + 1 .. h.length - 1], then the value
    const from = h.length - len + 1;
    if (isNaN(value)) return;
    for (let j = from; j < h.length; j++) if (isNaN(h[j])) return;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let j = 0; j < len; j++) {
      const x = j + 1;
      const y = j === len - 1 ? value : h[from + j];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = sumY / len - (slope * sumX) / len + slope;
    this.r0 = intercept + slope * (len - 1 - 0);
    this.r1 = intercept + slope * (len - 1 - 1);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pending);
  }
}

/** _rate(cond): proportion of volume attributed to buy or sell */
function rate(tw: number, bw: number, body: number, cond: boolean): number {
  const total = tw + bw + body;
  if (total === 0) return 0.5;
  const r = 0.5 * (tw + bw + (cond ? 2 * body : 0)) / total;
  return isNaN(r) ? 0.5 : r;
}

type Point = { time: number; value: number; color?: string };

interface VlrtRun extends BarRunState<Record<string, never>> {
  /** linreg(src, len, 0) and linreg(src, len, 1), then the same of the buy and the sell volume (len1, then len2) */
  lr: LinregPair[];
  shortPlot: Point[];
  longPlot: Point[];
}

// Column colors for short term
const ccol11 = '#00FF00';   // strong bull
const ccol12 = '#00BC00';   // medium bull
const ccol13 = '#00FF006f'; // weak bull
const ccol21 = '#FF0000';   // strong bear
const ccol22 = '#BF0000';   // medium bear
const ccol23 = '#FF00006f'; // weak bear

// Line colors for long term
const col11 = '#008EFF'; // strong bull
const col12 = '#006ec5'; // medium bull
const col13 = '#024478'; // weak bull
const col21 = '#fd9701'; // strong bear
const col22 = '#CE7A00'; // medium bear
const col23 = '#663d00'; // weak bear

function study(inputs: Partial<VolumeLinRegTrendInputs>): BarStudy<VlrtRun, IndicatorResult> {
  const { src, len1, len2 } = { ...defaultInputs, ...inputs };
  const source = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const lr: LinregPair[] = [];
      for (const len of [len1, len2]) for (let k = 0; k < 3; k++) lr.push(new LinregPair(len));
      const s: VlrtRun = { lr, shortPlot: [], longPlot: [], steps: lr, vars: {}, lists: [], series: [] };
      s.series = [s.shortPlot, s.longPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const lr = s.lr;
      const v = source(b);
      // Candle components for buy/sell volume rate
      const tw = b.high - Math.max(b.open, b.close);
      const bw = Math.min(b.open, b.close) - b.low;
      const body = Math.abs(b.close - b.open);
      const vol = b.volume ?? 0;
      const deltaUp = vol * rate(tw, bw, body, b.open <= b.close);
      const deltaDown = vol * rate(tw, bw, body, b.open > b.close);

      // linreg(src, len, 0) - linreg(src, len, 1) = regression slope
      for (let k = 0; k < 6; k += 3) {
        lr[k].step(v);
        lr[k + 1].step(deltaUp);
        lr[k + 2].step(deltaDown);
      }
      const lr1_0 = lr[0].r0;
      const lr1_1 = lr[0].r1;
      // Short-term volume slopes
      const slopeVolUp = lr[1].r0 - lr[1].r1;
      const slopeVolDn = lr[2].r0 - lr[2].r1;
      const lr2_0 = lr[3].r0;
      const lr2_1 = lr[3].r1;
      // Long-term volume slopes
      const slopeVolUpLt = lr[4].r0 - lr[4].r1;
      const slopeVolDnLt = lr[5].r0 - lr[5].r1;

      // Short-term: needs len1 bars of warmup
      if (i < len1 || lr1_0 == null || lr1_1 == null) {
        s.shortPlot[i] = { time: b.time, value: NaN };
      } else {
        const slopePrice = lr1_0 - lr1_1;

        let colCol: string;
        if (slopePrice > 0) {
          if (slopeVolUp > 0) {
            colCol = slopeVolUp > slopeVolDn ? ccol11 : ccol12;
          } else {
            colCol = ccol13;
          }
        } else if (slopePrice < 0) {
          if (slopeVolDn > 0) {
            colCol = slopeVolUp < slopeVolDn ? ccol21 : ccol22;
          } else {
            colCol = ccol23;
          }
        } else {
          colCol = '#808080';
        }

        s.shortPlot[i] = { time: b.time, value: slopePrice * len1, color: colCol };
      }

      // Long-term: needs len2 bars of warmup
      if (i < len2 || lr2_0 == null || lr2_1 == null) {
        s.longPlot[i] = { time: b.time, value: NaN };
      } else {
        const slopePriceLt = lr2_0 - lr2_1;

        let lineCol: string;
        if (slopePriceLt > 0) {
          if (slopeVolUpLt > 0) {
            lineCol = slopeVolUpLt > slopeVolDnLt ? col11 : col12;
          } else {
            lineCol = col13;
          }
        } else if (slopePriceLt < 0) {
          if (slopeVolDnLt > 0) {
            lineCol = slopeVolUpLt < slopeVolDnLt ? col21 : col22;
          } else {
            lineCol = col23;
          }
        } else {
          lineCol = '#808080';
        }

        s.longPlot[i] = { time: b.time, value: slopePriceLt * len2, color: lineCol };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.shortPlot.slice(), plot1: s.longPlot.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeLinRegTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeLinRegTrendInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeLinRegTrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
