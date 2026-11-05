/**
 * MACD Overlay v1
 *
 * MACD drawn on the price: a ribbon between the fast and slow averages (Classic: EMA / SMA of the source; VW: rolling
 * VWAPs of `vwapSrc`), filled with the MACD sign colour (stronger while the histogram rises), and the candles tinted
 * the same way. Compare mode adds the VW pair as a ghost ribbon. Optional channel: slow +- k * |MACD|.
 * MACD / signal crosses give triangles, filtered by two adaptive gates built from 100-bar means and stdevs:
 * - Weakness-Lite: at least 2 of RVOL deficit, effort vs result failure (high volume z, low body efficiency),
 *   extension from the slow VWAP in ATR with low RVOL, and (Strict) wick pressure; a 2-bar cooldown debounces it.
 *   Weak bars get circles above (up bar) or below (down bar).
 * - Expansion-Only: the ribbon is tight and the histogram flat (squeeze) while the true range bursts at a histogram
 *   slope flip or near a cross (release).
 * Crosses blocked by a gate are gray dots; with the weakness gate off, weak crosses are faded triangles.
 * Alerts (alertcondition, `alerts` of the result): 'MACD Signal Cross Up' / 'MACD Signal Cross Down' (any cross while
 * the signals are shown, whatever the gates) and 'Weakness-Lite Flag' (a Weakness-Lite bar).
 *
 * Reference: "MACD Overlay v1 [JopAlgo]" by JopAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface MacdOverlayV1Inputs {
  /** Calculation mode: Classic (MA MACD), VW (rolling VWAP MACD) or Compare (Classic + VW ghost ribbon) */
  calcMode: 'Classic' | 'VW' | 'Compare';
  showSignals: boolean;
  /** Hide weak crosses (Weakness-Lite gate) */
  gateByWeak: boolean;
  /** Triangles only when the cross comes with an expansion out of a squeeze */
  expansionOnlyOn: boolean;
  weakSensitivity: 'Off' | 'Auto' | 'Strict';
  showRibbon: boolean;
  showBarTint: boolean;
  showWeakMk: boolean;
  /** Only evaluate weakness near signals and histogram slope flips */
  weakOnlyOnSignals: boolean;
  showChannel: boolean;
  channelK: number;
  stylePreset: 'Subtle' | 'Normal' | 'Bold';
  fastLen: number;
  slowLen: number;
  sigLen: number;
  src: SourceType;
  maType: 'SMA' | 'EMA';
  sigType: 'SMA' | 'EMA';
  vwapSrc: SourceType;
  vwapFastL: number;
  vwapSlowL: number;
}

export const defaultInputs: MacdOverlayV1Inputs = {
  calcMode: 'Classic',
  showSignals: true,
  gateByWeak: true,
  expansionOnlyOn: true,
  weakSensitivity: 'Auto',
  showRibbon: true,
  showBarTint: true,
  showWeakMk: true,
  weakOnlyOnSignals: false,
  showChannel: false,
  channelK: 0.75,
  stylePreset: 'Normal',
  fastLen: 12,
  slowLen: 26,
  sigLen: 9,
  src: 'close',
  maType: 'EMA',
  sigType: 'EMA',
  vwapSrc: 'hlc3',
  vwapFastL: 12,
  vwapSlowL: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'calcMode', type: 'string', title: 'Calculation Mode', defval: 'Classic', options: ['Classic', 'VW', 'Compare'], group: 'Mode' },
  { id: 'showSignals', type: 'bool', title: 'Show Signal Cross Markers', defval: true, group: 'Signals' },
  { id: 'gateByWeak', type: 'bool', title: 'Gate triangles by Weakness', defval: true, group: 'Signals' },
  { id: 'expansionOnlyOn', type: 'bool', title: 'Expansion-Only (Impulse/Squeeze)', defval: true, group: 'Signals' },
  { id: 'weakSensitivity', type: 'string', title: 'Sensitivity', defval: 'Auto', options: ['Off', 'Auto', 'Strict'], group: 'Weakness' },
  { id: 'showRibbon', type: 'bool', title: 'Show Ribbon (Fast vs Slow)', defval: true, group: 'Display' },
  { id: 'showBarTint', type: 'bool', title: 'Show Candle Tint', defval: true, group: 'Display' },
  { id: 'showWeakMk', type: 'bool', title: 'Show Weakness Markers', defval: true, group: 'Display' },
  { id: 'weakOnlyOnSignals', type: 'bool', title: 'Only evaluate Weakness on signal bars', defval: false, group: 'Advanced' },
  { id: 'showChannel', type: 'bool', title: 'Show Channel (k × |MACD| of primary)', defval: false, group: 'Advanced' },
  { id: 'channelK', type: 'float', title: 'Channel Multiplier k', defval: 0.75, step: 0.05, min: 0.0, group: 'Advanced' },
  { id: 'stylePreset', type: 'string', title: 'Style Preset', defval: 'Normal', options: ['Subtle', 'Normal', 'Bold'], group: 'Advanced' },
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 12, min: 1, group: 'Classic MACD' },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 26, min: 1, group: 'Classic MACD' },
  { id: 'sigLen', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, group: 'Classic MACD' },
  { id: 'src', type: 'source', title: 'Source (Classic)', defval: 'close', group: 'Classic MACD' },
  { id: 'maType', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['SMA', 'EMA'], group: 'Classic MACD' },
  { id: 'sigType', type: 'string', title: 'Signal Line MA Type', defval: 'EMA', options: ['SMA', 'EMA'], group: 'Classic MACD' },
  { id: 'vwapSrc', type: 'source', title: 'VWAP Source', defval: 'hlc3', group: 'Rolling VWAP (value baseline)' },
  { id: 'vwapFastL', type: 'int', title: 'RVWAP Fast Length', defval: 12, min: 2, group: 'Rolling VWAP (value baseline)' },
  { id: 'vwapSlowL', type: 'int', title: 'RVWAP Slow Length', defval: 26, min: 2, group: 'Rolling VWAP (value baseline)' },
];

const BULL_BASE = String(color.rgb(38, 166, 154));
const BEAR_BASE = String(color.rgb(255, 82, 82));
const GHOST_TEAL = String(color.new(color.teal, 0));
const GHOST_PINK = String(color.new(color.fuchsia, 0));
const NOTE_DOT = String(color.new(color.gray, 0));
const FAST_COL = String(color.new(color.aqua, 0));
const SLOW_COL = String(color.new(color.orange, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Primary Fast', color: FAST_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Primary Slow', color: SLOW_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Ghost Fast (VW-MACD)', color: GHOST_TEAL, lineWidth: 1 },
  { id: 'plot3', title: 'Ghost Slow (VW-MACD)', color: GHOST_PINK, lineWidth: 1 },
  { id: 'plot4', title: 'Channel Upper', color: NOTE_DOT, lineWidth: 1 },
  { id: 'plot5', title: 'Channel Lower', color: NOTE_DOT, lineWidth: 1 },
];

export const metadata = {
  title: 'MACD Overlay v1 [JopAlgo]',
  shortTitle: 'MACDOV1',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** Pine math.min / math.max: na with an na argument */
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));

/** Style preset transparencies */
const PRESETS = {
  Subtle: { fillStrongTr: 80, fillWeakTr: 92, barExpTr: 90, barConTr: 94, ghostAlpha: 85, weakFadeTr: 70 },
  Bold: { fillStrongTr: 60, fillWeakTr: 78, barExpTr: 75, barConTr: 88, ghostAlpha: 80, weakFadeTr: 40 },
  Normal: { fillStrongTr: 70, fillWeakTr: 88, barExpTr: 85, barConTr: 92, ghostAlpha: 85, weakFadeTr: 60 },
};

/**
 * Window sum of the last `length` non-na values (constant length), one bar at a time: the exact sum kept as
 * non-overlapping partials and rounded once, with the operations of the oakscriptjs window sums (the value that
 * leaves, then the one that enters), so the same doubles as `taStep.sum` without a copy of the state per step.
 */
class WindowSum implements Committable {
  private p = new Float64Array(16);
  private n = 0;
  private q = new Float64Array(16);
  private qn = 0;
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(length: number) {
    this.len = Math.floor(length);
  }

  /** Adds x to the partials q (count qn), exactly */
  private add(x: number): void {
    let q = this.q;
    const n = this.qn;
    let i = 0;
    for (let j = 0; j < n; j++) {
      let y = q[j]!;
      if (Math.abs(x) < Math.abs(y)) {
        const t = x;
        x = y;
        y = t;
      }
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) q[i++] = lo;
      x = hi;
    }
    if (i === q.length) {
      const grown = new Float64Array(q.length * 2);
      grown.set(q);
      this.q = q = grown;
    }
    q[i] = x;
    this.qn = i + 1;
  }

  /** The exact sum of the partials q rounded once (round half to even) */
  private round(): number {
    const q = this.q;
    let n = this.qn;
    if (n === 0) return 0;
    let hi = q[--n]!;
    while (n > 0) {
      const x = hi;
      const y = q[--n]!;
      hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) {
        if (n > 0 && ((lo < 0 && q[n - 1]! < 0) || (lo > 0 && q[n - 1]! > 0))) {
          const y2 = lo * 2;
          const x2 = hi + y2;
          if (y2 === x2 - hi) hi = x2;
        }
        break;
      }
    }
    return hi;
  }

  /** The sum with `value` (na: the sum of the earlier values), NaN before `length` values */
  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    if (this.q.length < this.p.length) this.q = new Float64Array(this.p.length);
    this.q.set(this.p.subarray(0, this.n));
    this.qn = this.n;
    const count = this.values.length;
    if (!Number.isFinite(value)) return count > 0 && count >= this.len ? this.round() : NaN;
    if (count >= this.len) this.add(-this.values[count - this.len]!);
    this.add(value);
    return count + 1 >= this.len ? this.round() : NaN;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    if (!Number.isFinite(this.pending)) return;
    const p = this.p;
    this.p = this.q;
    this.n = this.qn;
    this.q = p;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

/** `ta.sma(source, length)` from a {@link WindowSum} (the taStep operations) */
class WindowSma implements Committable {
  private readonly sum: WindowSum;
  private readonly len: number;

  constructor(length: number) {
    this.sum = new WindowSum(length);
    this.len = Math.floor(length);
  }

  step(value: number): number {
    return this.sum.step(value) / this.len;
  }

  commit(): void {
    this.sum.commit();
  }
}

/** `ta.stdev(source, length)` (biased) from the window sums of the values and of their squares (the taStep operations) */
class WindowStdev implements Committable {
  private readonly sums: WindowSum;
  private readonly squares: WindowSum;
  private readonly len: number;

  constructor(length: number) {
    this.sums = new WindowSum(length);
    this.squares = new WindowSum(length);
    this.len = Math.floor(length);
  }

  step(value: number): number {
    const len = this.len;
    const sum = this.sums.step(value);
    const sq = this.squares.step(Number.isFinite(value) ? value * value : NaN);
    if (len <= 0) return NaN;
    const mean = sum / len;
    const v = sq / len - mean * mean;
    return Number.isNaN(v) ? NaN : v > 0 ? Math.sqrt(v) : 0;
  }

  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };
type Sma = WindowSma;
type Stdev = WindowStdev;

/** f_rvwap(src, len): the two window means of the volume and of src * volume */
interface Rvwap { vol: Sma; pv: Sma }

interface MacdOvRun extends BarRunState<{ weakCD: number }> {
  fastMaC: Ma;
  slowMaC: Ma;
  signalCMa: Ma;
  signalVMa: Ma;
  fastRv: Rvwap;
  slowRv: Rvwap;
  atr: ReturnType<typeof taStep.atr>;
  rvMean: Sma;
  /** The window means and stdevs of the Weakness-Lite and Expansion-Only measures (length 100) */
  means: Sma[];
  sds: Stdev[];
  macdP: number[];
  signalP: number[];
  histP: number[];
  isExpanding: boolean[];
  crossUp: boolean[];
  crossDown: boolean[];
  plots: Point[][];
  fillColors: string[];
  ghostColors: string[];
  barColors: BarColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MacdOverlayV1Inputs>): BarStudy<MacdOvRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const style = cfg.stylePreset === 'Subtle' ? PRESETS.Subtle : cfg.stylePreset === 'Bold' ? PRESETS.Bold : PRESETS.Normal;
  const srcOf = barSource(cfg.src);
  const vwapSrcOf = barSource(cfg.vwapSrc);
  // f_ma(x, l, _type) => _type == "SMA" ? ta.sma(x, l) : ta.ema(x, l) (the type is a constant input)
  const fMa = (l: number, type: string): Ma => {
    return type === 'SMA' ? new WindowSma(l) : taStep.ema(l);
  };
  // f_rvwap: sma(src * volume, len) * len / (sma(volume, len) * len); na when the volume sum is 0 or na
  const rvwap = (rv: Rvwap, src: number, volume: number, len: number): number => {
    const vm = rv.vol.step(volume);
    const pm = rv.pv.step(src * volume);
    const volSum = isNaN(vm) ? NaN : vm * len;
    const pvSum = isNaN(pm) ? NaN : pm * len;
    return !isNaN(volSum) && Math.abs(volSum) > EPS && !isNaN(pvSum) ? pvSum / volSum : NaN;
  };
  const isCompare = cfg.calcMode === 'Compare';
  const classicPrimary = cfg.calcMode === 'Classic' || isCompare;
  // Weakness-Lite measures
  const useWeak = cfg.weakSensitivity !== 'Off';
  const isStrict = cfg.weakSensitivity === 'Strict';
  const volLen = 100;
  const fadeUpCol = String(color.new(BULL_BASE, style.weakFadeTr));
  const fadeDownCol = String(color.new(BEAR_BASE, style.weakFadeTr));
  return {
    fullRunReason: () => (isBarSource(cfg.src) && isBarSource(cfg.vwapSrc) ? null : 'source of another study'),
    init() {
      const s: MacdOvRun = {
        fastMaC: fMa(cfg.fastLen, cfg.maType), slowMaC: fMa(cfg.slowLen, cfg.maType),
        signalCMa: fMa(cfg.sigLen, cfg.sigType), signalVMa: fMa(cfg.sigLen, cfg.sigType),
        fastRv: { vol: new WindowSma(cfg.vwapFastL), pv: new WindowSma(cfg.vwapFastL) },
        slowRv: { vol: new WindowSma(cfg.vwapSlowL), pv: new WindowSma(cfg.vwapSlowL) },
        atr: taStep.atr(14), rvMean: new WindowSma(20),
        means: Array.from({ length: 7 }, () => new WindowSma(volLen)), sds: Array.from({ length: 7 }, () => new WindowStdev(volLen)),
        macdP: [], signalP: [], histP: [], isExpanding: [], crossUp: [], crossDown: [],
        plots: Array.from({ length: 6 }, () => []), fillColors: [], ghostColors: [], barColors: [], markers: [],
        flags: [[], [], []], times: [[], [], []],
        steps: [], lists: [], series: [], vars: { weakCD: 0 },
      };
      s.steps = [s.fastMaC, s.slowMaC, s.signalCMa, s.signalVMa, s.fastRv.vol, s.fastRv.pv, s.slowRv.vol, s.slowRv.pv,
        s.atr, s.rvMean, ...s.means, ...s.sds];
      s.lists = [s.barColors, s.markers, ...s.times];
      s.series = [s.macdP, s.signalP, s.histP, s.isExpanding, s.crossUp, s.crossDown, ...s.plots, s.fillColors,
        s.ghostColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const volume = b.volume ?? NaN;
      // window mean / stdev k of the measure x (length 100)
      const mean = (k: number, x: number) => s.means[k].step(x);
      const sd = (k: number, x: number) => s.sds[k].step(x);

      // Core MACD
      const src = srcOf(b);
      const fastMaC = s.fastMaC.step(src);
      const slowMaC = s.slowMaC.step(src);
      const macdC = fastMaC - slowMaC;
      const signalC = s.signalCMa.step(macdC);
      // VW-MACD
      const vwapSrc = vwapSrcOf(b);
      const fastVW = rvwap(s.fastRv, vwapSrc, volume, cfg.vwapFastL);
      const slowVW = rvwap(s.slowRv, vwapSrc, volume, cfg.vwapSlowL);
      const macdV = fastVW - slowVW;
      const signalV = s.signalVMa.step(macdV);

      const macdP = classicPrimary ? macdC : macdV;
      const signalP = classicPrimary ? signalC : signalV;
      const histP = macdP - signalP;
      const fastP = classicPrimary ? fastMaC : fastVW;
      const slowP = classicPrimary ? slowMaC : slowVW;
      s.macdP[i] = macdP;
      s.signalP[i] = signalP;
      s.histP[i] = histP;

      // Ribbon state
      const isBull = ge(macdP, 0.0);
      const isExpanding = i > 0 && gt(histP, s.histP[i - 1]);
      s.isExpanding[i] = isExpanding;
      const expFlip = i > 0 ? isExpanding !== s.isExpanding[i - 1] : false;

      // Crosses: a > b and a[1] <= b[1] (crossover); a < b and a[1] >= b[1] (crossunder), compared exactly (no 1e-10 tolerance)
      const crossUp = i > 0 && macdP > signalP && s.macdP[i - 1] <= s.signalP[i - 1];
      const crossDown = i > 0 && macdP < signalP && s.macdP[i - 1] >= s.signalP[i - 1];
      s.crossUp[i] = crossUp;
      s.crossDown[i] = crossDown;
      const signalProx = crossUp || crossDown || (i > 0 && (s.crossUp[i - 1] || s.crossDown[i - 1]));

      // f_tr(): prev = nz(close[1], close)
      const prev = i > 0 && !isNaN(bars[i - 1].close) ? bars[i - 1].close : b.close;
      const tr = max(b.high - b.low, max(Math.abs(b.high - prev), Math.abs(b.low - prev)));
      const atr = s.atr.step(b.high, b.low, b.close);
      const rvMean = s.rvMean.step(volume);
      const rvol = gt(rvMean, 0) ? volume / rvMean : 1.0;
      const volMean = mean(0, volume);
      const volSd = sd(0, volume);
      // f_z(x, mean, sd) => sd > 0 ? (x - mean) / sd : 0.0
      const zVol = gt(volSd, 0) ? (volume - volMean) / volSd : 0.0;
      const bodyEff = gt(tr, 0) ? Math.abs(b.close - b.open) / tr : 0.0;
      const beMean = mean(1, bodyEff);
      const beSd = sd(1, bodyEff);
      const valueBase = isNaN(slowVW) ? slowMaC : slowVW;
      const distATR = gt(atr, 0) && !isNaN(valueBase) ? Math.abs(b.close - valueBase) / atr : 0.0;
      const dMean = mean(2, distATR);
      const dSd = sd(2, distATR);
      const rvolMean = mean(3, rvol);
      const rvolSd = sd(3, rvol);

      // Expansion-Only measures
      const atrSafe = gt(atr, 0) ? atr : 1.0;
      const spreadNorm = gt(atrSafe, 0) ? Math.abs(fastP - slowP) / atrSafe : 0.0;
      const spreadMean = mean(4, spreadNorm);
      const spreadSd = sd(4, spreadNorm);
      const histDelta = i > 0 ? Math.abs(histP - s.histP[i - 1]) : NaN;
      const hDeltaMean = mean(5, histDelta);
      const hDeltaSd = sd(5, histDelta);
      const burstNorm = gt(atrSafe, 0) ? tr / atrSafe : 0.0;
      const burstMean = mean(6, burstNorm);
      const burstSd = sd(6, burstNorm);

      const base = isBull ? BULL_BASE : BEAR_BASE;
      // fill(pFast, pSlow, color = showRibbon ? color.new(base, isExpanding ? fillStrongTr : fillWeakTr) : na)
      s.fillColors[i] = cfg.showRibbon ? String(color.new(base, isExpanding ? style.fillStrongTr : style.fillWeakTr)) : 'transparent';
      // ghostFill = color.new(nz(macd_v) >= 0 ? bullBase : bearBase, ghostAlpha), drawn in Compare mode
      const mv = isNaN(macdV) ? 0 : macdV;
      s.ghostColors[i] = isCompare ? String(color.new(ge(mv, 0) ? BULL_BASE : BEAR_BASE, style.ghostAlpha)) : 'transparent';
      // barcolor(showBarTint ? color.new(base, isExpanding ? barExpTr : barConTr) : na)
      if (cfg.showBarTint) s.barColors.push({ time: t, color: String(color.new(base, isExpanding ? style.barExpTr : style.barConTr)) });

      // Weakness rules
      const rvFloorAuto = min(1.0, rvolMean + -0.385 * rvolSd);
      const beLowAuto = beMean + -0.674 * beSd;
      const dHighAuto = dMean + (isStrict ? 0.842 : 0.674) * dSd;
      const ruleRVOL = lt(rvol, isStrict ? min(1.0, rvFloorAuto + 0.05) : rvFloorAuto);
      const ruleEVR = ge(zVol, isStrict ? 0.8 : 0.524) && le(bodyEff, beLowAuto);
      const ruleEXT = gt(distATR, dHighAuto) && lt(rvol, 1.0);
      const upperW = b.high - Math.max(b.open, b.close);
      const lowerW = Math.min(b.open, b.close) - b.low;
      const upBar = ge(b.close, b.open);
      const dirWickFrac = gt(tr, 0) ? (upBar ? upperW / tr : lowerW / tr) : 0.0;
      const ruleWICK = isStrict && ge(dirWickFrac, 0.40);
      const weakCount = (ruleRVOL ? 1 : 0) + (ruleEVR ? 1 : 0) + (ruleEXT ? 1 : 0) + (ruleWICK ? 1 : 0);
      const isWeakRaw = useWeak && weakCount >= 2;
      const considerBar = !cfg.weakOnlyOnSignals || signalProx || expFlip;
      const isWeakPre = considerBar && isWeakRaw;
      // Debounce: 2-bar cooldown unless near a cross
      v.weakCD = Math.max(v.weakCD - 1, 0);
      const isWeakLite = (v.weakCD === 0 && isWeakPre) || (signalProx && isWeakPre);
      v.weakCD = isWeakLite ? 2 : v.weakCD;

      // Expansion-Only gate
      const tightThresh = spreadMean + -0.385 * spreadSd;
      const flatThresh = hDeltaMean + -0.385 * hDeltaSd;
      const burstThresh = burstMean + (isStrict ? 0.842 : 0.524) * burstSd;
      const squeezeCond = le(spreadNorm, tightThresh) && le(histDelta, flatThresh);
      const releaseCond = ge(burstNorm, burstThresh) && (expFlip || signalProx);
      const expansionOk = cfg.expansionOnlyOn ? squeezeCond && releaseCond : true;

      const eligibleLong = cfg.showSignals && crossUp && expansionOk;
      const eligibleShort = cfg.showSignals && crossDown && expansionOk;
      const solidUp = eligibleLong && (cfg.gateByWeak ? !isWeakLite : true);
      const solidDown = eligibleShort && (cfg.gateByWeak ? !isWeakLite : true);
      const fadeUp = eligibleLong && !cfg.gateByWeak && isWeakLite;
      const fadeDown = eligibleShort && !cfg.gateByWeak && isWeakLite;
      const dotUp = (cfg.showSignals && crossUp && !expansionOk) || (cfg.showSignals && crossUp && expansionOk && cfg.gateByWeak && isWeakLite);
      const dotDown = (cfg.showSignals && crossDown && !expansionOk) || (cfg.showSignals && crossDown && expansionOk && cfg.gateByWeak && isWeakLite);

      // alertcondition(showSignals and crossUp / crossDown, ...), alertcondition(weakSensitivity != "Off" and isWeakLite, ...)
      const f0 = cfg.showSignals && crossUp;
      const f1 = cfg.showSignals && crossDown;
      const f2 = useWeak && isWeakLite;
      s.flags[0][i] = f0;
      s.flags[1][i] = f1;
      s.flags[2][i] = f2;
      if (f0) s.times[0].push(t as number);
      if (f1) s.times[1].push(t as number);
      if (f2) s.times[2].push(t as number);

      // plotshape calls in Pine order, all size.tiny (ids shape0..shape7 in declaration order)
      const markers = s.markers;
      if (useWeak && cfg.showWeakMk && isWeakLite && upBar) markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: BEAR_BASE, size: 'tiny', id: 'shape0' });
      if (useWeak && cfg.showWeakMk && isWeakLite && !upBar) markers.push({ time: t, position: 'belowBar', shape: 'circle', color: BULL_BASE, size: 'tiny', id: 'shape1' });
      if (solidUp) markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: BULL_BASE, size: 'tiny', id: 'shape2' });
      if (solidDown) markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: BEAR_BASE, size: 'tiny', id: 'shape3' });
      if (fadeUp) markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: fadeUpCol, size: 'tiny', id: 'shape4' });
      if (fadeDown) markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: fadeDownCol, size: 'tiny', id: 'shape5' });
      if (dotUp) markers.push({ time: t, position: 'belowBar', shape: 'circle', color: NOTE_DOT, size: 'tiny', id: 'shape6' });
      if (dotDown) markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: NOTE_DOT, size: 'tiny', id: 'shape7' });

      const plots = s.plots;
      plots[0][i] = { time: t, value: cfg.showRibbon ? fastP : NaN, color: FAST_COL };
      plots[1][i] = { time: t, value: cfg.showRibbon ? slowP : NaN, color: SLOW_COL };
      plots[2][i] = { time: t, value: isCompare ? fastVW : NaN, color: GHOST_TEAL };
      plots[3][i] = { time: t, value: isCompare ? slowVW : NaN, color: GHOST_PINK };
      // Channel: slow_p +- channelK * |macd_p|
      plots[4][i] = { time: t, value: cfg.showChannel ? slowP + cfg.channelK * Math.abs(macdP) : NaN, color: NOTE_DOT };
      plots[5][i] = { time: t, value: cfg.showChannel ? slowP - cfg.channelK * Math.abs(macdP) : NaN, color: NOTE_DOT };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(), plot4: s.plots[4].slice(), plot5: s.plots[5].slice(),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Primary Ribbon Fill' }, colors: s.fillColors.slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Ghost Ribbon Fill' }, colors: s.ghostColors.slice() },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdOverlayV1Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MacdOverlayV1Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'MACD Signal Cross Up', message: 'MACD crossed above Signal (primary).' },
  { id: 'alert1', title: 'MACD Signal Cross Down', message: 'MACD crossed below Signal (primary).' },
  { id: 'alert2', title: 'Weakness-Lite Flag', message: 'Weakness-Lite triggered on this bar.' },
];

export const MacdOverlayV1 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
