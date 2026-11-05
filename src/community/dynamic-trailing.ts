/**
 * Dynamic Trailing (Zeiierman)
 *
 * A trailing line built from three parts: a supertrend of hl2 with a band of `mult` x ATR, where the ATR is an SMA
 * of a true range of hl2 (`atrLen`) smoothed by an EMA (`atrSmooth`); dynamic support / resistance from a GD
 * curve (three chained HMAs of the high / low combined with the GD factor) plus / minus mult x ATR, smoothed by an
 * SMA; and the lowest / highest close of `len` bars plus the ATR. Above the supertrend line the trail is the
 * average of the supertrend, the support and the lowest close + ATR; below it, the average of the supertrend, the
 * resistance and the highest close + ATR. A cloud edge is set one ATR x cloud width away from the trail, on the
 * side of the close. Both are smoothed by an EMA (`plotSmooth`). The trail is drawn while the supertrend direction
 * does not change; the line and the cloud are green when the close is above the trail, red otherwise.
 *
 * Reference: "Dynamic Trailing (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DynamicTrailingInputs {
  /** ATR multiplier of the supertrend and of the support / resistance distance */
  mult: number;
  /** Length of the GD curve and of the lowest / highest close */
  len: number;
  /** SMA length of the support / resistance */
  smooth: number;
  /** GD factor */
  gdFactor: number;
  /** SMA length of the true range */
  atrLen: number;
  /** EMA length of the ATR */
  atrSmooth: number;
  /** EMA length of the plotted trail and cloud */
  plotSmooth: number;
  /** Cloud width (x ATR) */
  cloudWidth: number;
  /** Colour when the close is below the trail */
  upcol: string;
  /** Colour when the close is above the trail */
  dncol: string;
}

export const defaultInputs: DynamicTrailingInputs = {
  mult: 7.5,
  len: 26,
  smooth: 15,
  gdFactor: -1.2,
  atrLen: 100,
  atrSmooth: 20,
  plotSmooth: 3,
  cloudWidth: 1.0,
  upcol: '#f23645',
  dncol: '#089981',
};

export const inputConfig: InputConfig[] = [
  { id: 'mult', type: 'float', title: 'Mult', defval: 7.5, min: 1, step: 0.1 },
  { id: 'len', type: 'int', title: 'Len', defval: 26, min: 2 },
  { id: 'smooth', type: 'int', title: 'Smoothness', defval: 15, min: 1, step: 1 },
  { id: 'gdFactor', type: 'float', title: 'GD Factor', defval: -1.2, step: 0.1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 100, min: 1 },
  { id: 'atrSmooth', type: 'int', title: 'ATR Smoothing', defval: 20, min: 1 },
  { id: 'plotSmooth', type: 'int', title: 'Plot Smoothing', defval: 3, min: 1 },
  { id: 'cloudWidth', type: 'float', title: 'Cloud width', defval: 1.0, min: 0, step: 0.5 },
  { id: 'upcol', type: 'color', title: 'Bearish Color', defval: '#f23645' },
  { id: 'dncol', type: 'color', title: 'Bullish Color', defval: '#089981' },
];

const CLOUD_LINE = String(color.new(color.gray, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smart Trailing', color: '#089981', lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Cloud', color: CLOUD_LINE, lineWidth: 1, style: 'linebr', display: 'none' },
];

export const metadata = {
  title: 'Dynamic Trailing (Zeiierman)',
  shortTitle: 'Dynamic Trailing (Zeiierman)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine nz() */
const nz = (x: number) => (isNaN(x) ? 0 : x);

type Point = { time: number; value: number; color?: string };
type Hma = ReturnType<typeof taStep.hma>;

/** The state of one Trends() extreme (see the comment in bar()) */
interface Extreme {
  buf: number[];
  ext: number;
  extBar: number;
}

interface TrailingVars {
  lPrev: number;
  uPrev: number;
  tPrev: number;
  lowest: Extreme;
  highest: Extreme;
}

interface TrailingRun extends BarRunState<TrailingVars> {
  rawAtr: ReturnType<typeof taStep.sma>;
  atrEma: ReturnType<typeof taStep.ema>;
  gdHigh: Hma[];
  gdLow: Hma[];
  up: ReturnType<typeof taStep.sma>;
  down: ReturnType<typeof taStep.sma>;
  tAEma: ReturnType<typeof taStep.ema>;
  tZEma: ReturnType<typeof taStep.ema>;
  hl2: number[];
  atr: number[];
  d: number[];
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
}

const copyExtreme = (e: Extreme): Extreme => ({ buf: e.buf.slice(), ext: e.ext, extBar: e.extBar });

function study(inputs: Partial<DynamicTrailingInputs>): BarStudy<TrailingRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const ring = cfg.len + 1;
  const f = cfg.gdFactor;
  const c1 = -f * f * f;
  const c2 = 3 * f * f + 3 * f * f * f;
  const c3 = -6 * f * f - 3 * f - 3 * f * f * f;
  const c4 = 1 + 3 * f + f * f * f + 3 * f * f;
  // gd(src, len, f): three chained HMAs combined with the GD factor
  const gd = (h: Hma[], x: number) => {
    const e1 = h[0].step(x);
    const e2 = h[1].step(e1);
    const e3 = h[2].step(e2);
    return c1 * e3 + c2 * e2 + c3 * e1 + c4 * x;
  };
  const extreme = (e: Extreme, isLow: boolean, i: number, x: number) => {
    const buf = e.buf;
    buf[i % ring] = x;
    if (isNaN(e.ext) || i - e.extBar >= cfg.len) {
      e.ext = NaN;
      for (let k = 0; k < cfg.len && i - k >= 0; k++) {
        const v = buf[(i - k) % ring];
        if (!isNaN(v) && (isNaN(e.ext) || (isLow ? v <= e.ext : v >= e.ext))) {
          e.ext = v;
          e.extBar = i - k;
        }
      }
    } else if (isLow ? x < e.ext : x > e.ext) {
      e.ext = x;
      e.extBar = i;
    }
    return i < cfg.len - 1 ? NaN : e.ext;
  };
  const dnFill = String(color.new(cfg.dncol, 80));
  const upFill = String(color.new(cfg.upcol, 80));
  const newExtreme = (): Extreme => ({ buf: new Array(ring).fill(NaN), ext: NaN, extBar: -1 });
  return {
    init() {
      const s: TrailingRun = {
        rawAtr: taStep.sma(), atrEma: taStep.ema(cfg.atrSmooth),
        gdHigh: [taStep.hma(cfg.len), taStep.hma(cfg.len), taStep.hma(cfg.len)],
        gdLow: [taStep.hma(cfg.len), taStep.hma(cfg.len), taStep.hma(cfg.len)],
        up: taStep.sma(), down: taStep.sma(), tAEma: taStep.ema(cfg.plotSmooth), tZEma: taStep.ema(cfg.plotSmooth),
        hl2: [], atr: [], d: [], plot0: [], plot1: [], fillColors: [],
        steps: [],
        vars: { lPrev: NaN, uPrev: NaN, tPrev: NaN, lowest: newExtreme(), highest: newExtreme() },
        lists: [], series: [],
      };
      s.steps = [s.rawAtr, s.atrEma, ...s.gdHigh, ...s.gdLow, s.up, s.down, s.tAEma, s.tZEma];
      s.series = [s.hl2, s.atr, s.d, s.plot0, s.plot1, s.fillColors];
      return s;
    },
    copyVars: (v) => ({ ...v, lowest: copyExtreme(v.lowest), highest: copyExtreme(v.highest) }),
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const close = b.close;
      const hl2 = (b.high + b.low) / 2;
      s.hl2[i] = hl2;

      // ATR(hl2, atrLen): tr = max(src[1] - min(low, src[1]), max(high - low, src[1] - high)) (na on bar 0); SMA
      const p = i > 0 ? s.hl2[i - 1] : NaN;
      const tr = Math.max(p - Math.min(b.low, p), Math.max(b.high - b.low, p - b.high));
      const raw = s.rawAtr.step(tr, cfg.atrLen) ?? NaN;
      const atr = s.atrEma.step(raw) ?? NaN;
      // the ATR of the previous bar (na(atr[1]))
      const atr1 = i > 0 ? s.atr[i - 1] : NaN;
      s.atr[i] = atr;

      // supertrend(mult) on hl2
      let u = hl2 + cfg.mult * atr;
      let l = hl2 - cfg.mult * atr;
      const prevL = nz(v.lPrev);
      const prevU = nz(v.uPrev);
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      l = gt(l, prevL) || lt(close1, prevL) ? l : prevL;
      u = lt(u, prevU) || gt(close1, prevU) ? u : prevU;
      // d := na(atr[1]) ? 1 : prevT == prevU ? close > u ? -1 : 1 : close < l ? 1 : -1
      let dir: number;
      if (isNaN(atr1)) dir = 1;
      else if (eq(v.tPrev, prevU)) dir = gt(close, u) ? -1 : 1;
      else dir = lt(close, l) ? 1 : -1;
      s.d[i] = dir;
      const t = dir === -1 ? l : u;
      v.lPrev = l;
      v.uPrev = u;
      v.tPrev = t;

      const gdHigh = gd(s.gdHigh, b.high);
      const gdLow = gd(s.gdLow, b.low);
      const up = s.up.step(gdHigh + atr * cfg.mult, cfg.smooth) ?? NaN;
      const down = s.down.step(gdLow - atr * cfg.mult, cfg.smooth) ?? NaN;

      // Trends(): ta.lowest / ta.highest sit in the two branches of the ternary, so each one only runs on the bars where
      // its branch is taken (rule found with probe plots of the values used):
      // - the source history is a ring of len + 1 slots indexed by bar_index, written only on those bars; close_[k] is
      //   the slot of bar i - k, which still holds an older call (len + 1 bars before) when the branch did not run on
      //   bar i - k; a slot never written is skipped;
      // - the extreme is kept with its bar; it is replaced by a new close that passes it, and the window
      //   close_[0 .. len - 1] is scanned again when the extreme is len bars old (the oldest bar wins a tie);
      // - na before bar len - 1.
      let tA: number;
      if (gt(close, t)) {
        tA = (t + down + (extreme(v.lowest, true, i, close) + atr)) / 3;
      } else {
        tA = (t + up + (extreme(v.highest, false, i, close) + atr)) / 3;
      }
      const tZ = gt(close, tA) ? tA + atr * cfg.cloudWidth : tA - atr * cfg.cloudWidth;

      const tAPlot = s.tAEma.step(tA) ?? NaN;
      const tZPlot = s.tZEma.step(tZ) ?? NaN;
      const above = gt(close, tAPlot);
      // plot(sig and (d < 0 and d[1] < 0 or d > 0 and d[1] > 0) ? tA_plot : na, 'Smart Trailing', trendColor, linebr)
      const same = i > 0 && ((dir < 0 && s.d[i - 1] < 0) || (dir > 0 && s.d[i - 1] > 0));
      s.plot0[i] = { time: b.time, value: same ? tAPlot : NaN, color: above ? cfg.dncol : cfg.upcol };
      // plot(sig ? tZ_plot : na, 'Cloud', color.new(color.gray, 100), display = display.none, linebr)
      s.plot1[i] = { time: b.time, value: tZPlot, color: CLOUD_LINE };
      // fill(sigL, zoneL, close > tA_plot ? color.new(dncol, 80) : color.new(upcol, 80), 'Cloud')
      s.fillColors[i] = above ? dnFill : upFill;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Cloud' }, colors: s.fillColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicTrailingInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DynamicTrailingInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DynamicTrailing = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
