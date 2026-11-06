/**
 * Buyers & Sellers / Range
 *
 * Buying pressure bp = close - min(low, close[1]) and selling pressure sp = max(high, close[1]) - close (minus the
 * lower / upper wick with the Body / Range option). Each one is divided by the true range, smoothed by an EMA of
 * `BSP Length` bars, then by a 10-pole Gaussian filter, and scaled to percent. The lines are coloured by their
 * direction; four fills between them show which side leads and whether it grows or falls. A dashed line at 50 %.
 *
 * Reference: "Buyers & Sellers / Range" by fract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © fract
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BuyersSellersRangeInputs {
  /** EMA length of the pressure / true range ratios */
  ln: number;
  /** Body / Range: subtract the relevant wick from the pressures */
  sw: boolean;
}

export const defaultInputs: BuyersSellersRangeInputs = {
  ln: 10,
  sw: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'ln', type: 'int', title: 'BSP Length', defval: 10, min: 1 },
  {
    id: 'sw', type: 'bool', title: 'Body / Range', defval: false,
    tooltip: 'BSP Body / Range where Bullish & Bearish Body = Buying & Selling Pressure - Relevant Wick',
  },
];

const BP_GROW = '#40af40';
const BP_FALL = '#2962ff';
const SP_GROW = '#f23645';
const SP_FALL = '#f57f17';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BP/ATR', color: BP_FALL, lineWidth: 1 },
  { id: 'plot1', title: 'SP/ATR', color: SP_FALL, lineWidth: 1 },
];

export const metadata = {
  title: 'Buyers & Sellers / Range',
  shortTitle: 'BSP/ATR',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * 10-pole Gaussian filter gaus(source) of the script, one bar at a time; nz() of the previous values. The values are
 * kept by bar (a bar calculated again writes its own slot).
 */
class GausStep {
  private readonly out: number[] = [];
  private readonly alpha: number;
  private readonly p: number[];

  constructor() {
    const pi = Math.PI;
    const beta = (1 - Math.cos((2 * pi) / 10)) / (Math.pow(2, 0.1) - 1);
    const alpha = -beta + Math.sqrt(Math.pow(beta, 2) + 2 * beta);
    this.alpha = alpha;
    this.p = Array.from({ length: 11 }, (_v, k) => Math.pow(1 - alpha, k));
  }

  step(i: number, source: number): number {
    const { alpha, p, out } = this;
    const f = (k: number) => {
      const v = i - k >= 0 ? out[i - k] : NaN;
      return isNaN(v) ? 0 : v;
    };
    const v = Math.pow(alpha, 10) * source + 10 * (1 - alpha) * f(1) - 45 * p[2] * f(2)
      + 120 * p[3] * f(3) - 210 * p[4] * f(4)
      + 252 * p[5] * f(5) - 210 * p[6] * f(6)
      + 120 * p[7] * f(7) - 45 * p[8] * f(8)
      + 10 * p[9] * f(9) - p[10] * f(10);
    out[i] = v;
    return v;
  }

  commit(): void {}
}

type Point = { time: number; value: number; color?: string };

interface BsrRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  bpEma: ReturnType<typeof taStep.ema>;
  spEma: ReturnType<typeof taStep.ema>;
  bpGaus: GausStep;
  spGaus: GausStep;
  bptr: number[];
  sptr: number[];
  plots: Point[][];
  fillColors: string[][];
}

function study(inputs: Partial<BuyersSellersRangeInputs>): BarStudy<BsrRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const c1 = String(color.rgb(0, 255, 0, 85));
  const c2 = String(color.rgb(0, 68, 255, 85));
  const c3 = String(color.rgb(255, 0, 0, 85));
  const c4 = String(color.rgb(255, 172, 48, 85));
  const none = 'transparent';
  return {
    init() {
      const s: BsrRun = {
        tr: taStep.tr(false), bpEma: taStep.ema(cfg.ln), spEma: taStep.ema(cfg.ln), bpGaus: new GausStep(),
        spGaus: new GausStep(), bptr: [], sptr: [], plots: [[], []], fillColors: [[], [], [], []],
        vars: {}, steps: [], lists: [], series: [],
      };
      s.steps = [s.tr, s.bpEma, s.spEma, s.bpGaus, s.spGaus];
      s.series = [s.bptr, s.sptr, ...s.plots, ...s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // ta.tr: na on the first bar (no previous close)
      const tr = s.tr.step(b.high, b.low, b.close) ?? NaN;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const uw = b.high - Math.max(b.open, b.close);
      const lw = Math.min(b.open, b.close) - b.low;
      // math.min / math.max with an na argument give na
      const bp = b.close - Math.min(b.low, prevClose) - (cfg.sw ? lw : 0);
      const sp = Math.max(b.high, prevClose) - b.close - (cfg.sw ? uw : 0);
      // plain division: x / 0 is +-infinity, 0 / 0 NaN (ta.ema skips both)
      const bptr = s.bpGaus.step(i, s.bpEma.step(bp / tr) ?? NaN) * 100;
      const sptr = s.spGaus.step(i, s.spEma.step(sp / tr) ?? NaN) * 100;
      s.bptr[i] = bptr;
      s.sptr[i] = sptr;
      const pb = i > 0 ? s.bptr[i - 1] : NaN;
      const ps = i > 0 ? s.sptr[i - 1] : NaN;
      s.plots[0][i] = { time: b.time, value: fin(bptr), color: gt(bptr, pb) ? BP_GROW : BP_FALL };
      s.plots[1][i] = { time: b.time, value: fin(sptr), color: gt(sptr, ps) ? SP_GROW : SP_FALL };
      // fill(bpp, spp, bptr > sptr and bptr > bptr[1] ? color.rgb(0, 255, 0, 85) : na)
      s.fillColors[0][i] = gt(bptr, sptr) && gt(bptr, pb) ? c1 : none;
      // fill(bpp, spp, bptr > sptr and bptr < bptr[1] ? color.rgb(0, 68, 255, 85) : na)
      s.fillColors[1][i] = gt(bptr, sptr) && lt(bptr, pb) ? c2 : none;
      // fill(bpp, spp, bptr < sptr and sptr > sptr[1] ? color.rgb(255, 0, 0, 85) : na)
      s.fillColors[2][i] = lt(bptr, sptr) && gt(sptr, ps) ? c3 : none;
      // fill(bpp, spp, bptr < sptr and sptr < sptr[1] ? color.rgb(255, 172, 48, 85) : na)
      s.fillColors[3][i] = lt(bptr, sptr) && lt(sptr, ps) ? c4 : none;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice() },
        // hline(50, '50%', color.gray, hline.style_dashed, 1, false)
        hlines: [{ value: 50, options: { title: '50%', color: color.gray, linestyle: 'dashed', linewidth: 1 } }],
        fills: s.fillColors.map((colors) => ({ plot1: 'plot0', plot2: 'plot1', colors: colors.slice() })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuyersSellersRangeInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BuyersSellersRangeInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const BuyersSellersRange = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
