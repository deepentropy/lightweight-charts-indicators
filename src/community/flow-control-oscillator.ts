/**
 * Flow Control Oscillator (FCO)
 *
 * The MFI of the source scaled to -1..+1 ((mfi - 50) / 50) and the Chaikin Money Flow (sum of the close location
 * value times the volume over the sum of the volume) are combined: their sum in Equal mode, else 2 * (cmf * cmfWeight
 * + mfi * mfiWeight). The composite is smoothed (SMA, EMA, WMA, RMA, TEMA, DEMA or VWMA) into the FCO line, with a
 * signal line (EMA, WMA, HMA, TEMA, DEMA or VWMA). The momentum histogram is the change of the FCO over a few bars,
 * optionally divided by the ATR(14) and weighted by the ADX (0.3 + 0.7 * adx / 100), coloured with a gradient. The
 * background is gray where |FCO| > 1 and orange where the ADX is below 20.
 * Alerts (alertcondition, `alerts` of the result): the 14 conditions of the original (reversal setups, strong
 * trends, signal crosses, confirmed zero crosses, zero crosses, extreme zones, strong momentum).
 *
 * Reference: "Flow Control Oscillator (FCO)" by WalrusQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © WalrusQuant
 */

import { taStep, compare, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type FCOWeightMode = 'Equal' | 'MFI Heavy' | 'CMF Heavy' | 'Custom';
export type FCOSmoothType = 'SMA' | 'EMA' | 'WMA' | 'RMA' | 'TEMA' | 'DEMA' | 'VWMA';
export type FCOSignalType = 'EMA' | 'WMA' | 'HMA' | 'TEMA' | 'DEMA' | 'VWMA';

export interface FlowControlOscillatorInputs {
  mfiLen: number;
  cmfLen: number;
  /** Price source of the MFI */
  src: SourceType;
  weightMode: FCOWeightMode;
  /** MFI weight in Custom mode (0 = 100 % CMF, 1 = 100 % MFI) */
  customMFIWeight: number;
  smoothType: FCOSmoothType;
  /** FCO smoothing length (1 = no smoothing) */
  smoothLen: number;
  signalType: FCOSignalType;
  signalLen: number;
  /** Bars of the momentum change */
  momentumLen: number;
  /** Weight the momentum by the ADX */
  useADX: boolean;
  adxLen: number;
  adxSmooth: number;
  showADX: boolean;
  FCOColor: string;
  signalColor: string;
  bullMomentumColor: string;
  bearMomentumColor: string;
  useMomentumGradient: boolean;
  adxColor: string;
  showFCO: boolean;
  showSignal: boolean;
  showMomentum: boolean;
  showExtremeZones: boolean;
  /** Divide the momentum by the ATR(14) */
  useATRNorm: boolean;
}

export const defaultInputs: FlowControlOscillatorInputs = {
  mfiLen: 14,
  cmfLen: 20,
  src: 'hlc3',
  weightMode: 'Equal',
  customMFIWeight: 0.5,
  smoothType: 'SMA',
  smoothLen: 3,
  signalType: 'WMA',
  signalLen: 6,
  momentumLen: 3,
  useADX: true,
  adxLen: 14,
  adxSmooth: 14,
  showADX: false,
  FCOColor: color.white,
  signalColor: '#5b9cf6',
  bullMomentumColor: color.green,
  bearMomentumColor: color.red,
  useMomentumGradient: true,
  adxColor: color.yellow,
  showFCO: true,
  showSignal: true,
  showMomentum: true,
  showExtremeZones: true,
  useATRNorm: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'mfiLen', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'cmfLen', type: 'int', title: 'CMF Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Price Source', defval: 'hlc3' },
  { id: 'weightMode', type: 'string', title: 'Weighting Mode', defval: 'Equal', options: ['Equal', 'MFI Heavy', 'CMF Heavy', 'Custom'] },
  { id: 'customMFIWeight', type: 'float', title: 'Custom MFI Weight', defval: 0.5, min: 0.0, max: 1.0, step: 0.1 },
  { id: 'smoothType', type: 'string', title: 'FCO Smoothing Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'RMA', 'TEMA', 'DEMA', 'VWMA'] },
  { id: 'smoothLen', type: 'int', title: 'FCO Smoothing Length', defval: 3, min: 1, max: 20 },
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'WMA', options: ['EMA', 'WMA', 'HMA', 'TEMA', 'DEMA', 'VWMA'] },
  { id: 'signalLen', type: 'int', title: 'Signal Line Length', defval: 6, min: 1 },
  { id: 'momentumLen', type: 'int', title: 'Momentum Length', defval: 3, min: 1, max: 10 },
  { id: 'useADX', type: 'bool', title: 'Use ADX for Momentum Strength', defval: true },
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14, min: 1 },
  { id: 'adxSmooth', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1 },
  { id: 'showADX', type: 'bool', title: 'Show ADX Line', defval: false },
  { id: 'FCOColor', type: 'color', title: 'FCO Line Color', defval: color.white },
  { id: 'signalColor', type: 'color', title: 'Signal Line Color', defval: '#5b9cf6' },
  { id: 'bullMomentumColor', type: 'color', title: 'Bullish Momentum Color', defval: color.green },
  { id: 'bearMomentumColor', type: 'color', title: 'Bearish Momentum Color', defval: color.red },
  { id: 'useMomentumGradient', type: 'bool', title: 'Use Gradient for Momentum', defval: true },
  { id: 'adxColor', type: 'color', title: 'ADX Line Color', defval: color.yellow },
  { id: 'showFCO', type: 'bool', title: 'Show FCO Line', defval: true },
  { id: 'showSignal', type: 'bool', title: 'Show Signal Line', defval: true },
  { id: 'showMomentum', type: 'bool', title: 'Show Momentum Histogram', defval: true },
  { id: 'showExtremeZones', type: 'bool', title: 'Show Extreme Zone Background', defval: true },
  { id: 'useATRNorm', type: 'bool', title: 'Normalize Momentum by ATR', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Momentum (ADX-Weighted)', color: color.green, lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'FCO (Control)', color: color.white, lineWidth: 2 },
  { id: 'plot2', title: 'Signal Line', color: '#5b9cf6', lineWidth: 2 },
  { id: 'plot3', title: 'ADX (Scaled)', color: String(color.new(color.yellow, 50)), lineWidth: 2 },
  { id: 'plot4', title: 'CMF', color: String(color.new(color.blue, 70)), lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'MFI Scaled', color: String(color.new(color.orange, 70)), lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'ADX Raw', color: String(color.new(color.yellow, 70)), lineWidth: 1, display: 'none' },
];

// Pine hline default style: dashed
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero', color: color.gray, linestyle: 'solid', linewidth: 1 },
  { id: 'hline_upper', price: 0.7, title: 'Upper', color: String(color.new(color.gray, 70)), linestyle: 'dashed' },
  { id: 'hline_lower', price: -0.7, title: 'Lower', color: String(color.new(color.gray, 70)), linestyle: 'dashed' },
  { id: 'hline_xhigh', price: 1.0, title: 'Extreme High', color: String(color.new(color.red, 80)), linestyle: 'dashed' },
  { id: 'hline_xlow', price: -1.0, title: 'Extreme Low', color: String(color.new(color.green, 80)), linestyle: 'dashed' },
];

export const metadata = {
  title: 'Flow Control Oscillator (FCO)',
  shortTitle: 'FCO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/**
 * `math.sum(source, length)` with a constant length, one bar at a time: the exact sum of the window (non-overlapping
 * partials, the value that leaves then the one that enters, rounded once), the operations of the oakscriptjs running
 * sum (same doubles as taStep.sum), the partials kept in typed arrays (no copy of an array per bar).
 */
class ExactSum implements Committable {
  private readonly len: number;
  private readonly values: number[] = [];
  private p = new Float64Array(64);
  private pn = 0;
  private q = new Float64Array(64);
  private qn = 0;
  private last = NaN;
  private next = NaN;
  private pending = NaN;
  private stepped = false;

  constructor(length: number) {
    this.len = Math.floor(length);
  }

  private add(x: number): void {
    const q = this.q;
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
      this.q = grown;
    }
    this.q[i] = x;
    this.qn = i + 1;
  }

  private round(): number {
    const p = this.q;
    let n = this.qn;
    if (n === 0) return 0;
    let hi = p[--n]!;
    while (n > 0) {
      const x = hi;
      const y = p[--n]!;
      hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) {
        if (n > 0 && ((lo < 0 && p[n - 1]! < 0) || (lo > 0 && p[n - 1]! > 0))) {
          const y2 = lo * 2;
          const x2 = hi + y2;
          if (y2 === x2 - hi) hi = x2;
        }
        break;
      }
    }
    return hi;
  }

  /** The sum with `x` on this bar (an na value keeps the previous sum) */
  step(x: number): number {
    const len = this.len;
    this.stepped = len >= 1;
    if (!this.stepped) return NaN;
    if (x === undefined || x === null || !Number.isFinite(x)) {
      this.pending = NaN;
      this.next = this.last;
      return this.last;
    }
    if (this.q.length < this.p.length) this.q = new Float64Array(this.p.length);
    const p = this.p;
    const q = this.q;
    for (let k = 0; k < this.pn; k++) q[k] = p[k]!;
    this.qn = this.pn;
    const count = this.values.length;
    if (count >= len) this.add(-this.values[count - len]!);
    this.add(x);
    this.pending = x;
    this.next = count + 1 >= len ? this.round() : NaN;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    if (Number.isNaN(this.pending)) return;
    this.values.push(this.pending);
    const p = this.p;
    this.p = this.q;
    this.pn = this.qn;
    this.q = p;
  }
}

/** `ta.mfi(source, length)` with {@link ExactSum} (the operations of taStep.mfi) */
class ExactMfi implements Committable {
  private readonly upper: ExactSum;
  private readonly lower: ExactSum;
  private prev = NaN;
  private pending = NaN;
  private count = 0;
  private stepped = false;

  constructor(length: number) {
    this.upper = new ExactSum(length);
    this.lower = new ExactSum(length);
  }

  step(value: number, volume: number): number {
    this.stepped = true;
    this.pending = value;
    const change = this.count === 0 ? NaN : value - this.prev;
    const flow = volume * value;
    const zero = (x: number): number => (Math.abs(x) <= 1e-10 ? 0 : x);
    const u = zero(this.upper.step(compare.le(change, 0) ? 0 : flow));
    const l = zero(this.lower.step(compare.ge(change, 0) ? 0 : flow));
    if (Number.isNaN(u) || Number.isNaN(l)) return NaN;
    if (l === 0) return 100;
    const ratio = 1 + u / l;
    return ratio === 0 ? NaN : 100 - 100 / ratio;
  }

  commit(): void {
    if (this.stepped) {
      this.stepped = false;
      this.prev = this.pending;
      this.count++;
    }
    this.upper.commit();
    this.lower.commit();
  }
}

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Smoother = { step(v: number, volume: number): number; commit(): void };

/** applySmoothing(src, type, len) (and tema / dema): one call per bar of the branch of the (constant) type */
function smoother(type: string, len: number): Smoother {
  if (type === 'EMA') { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
  if (type === 'WMA') { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
  if (type === 'RMA') { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
  if (type === 'TEMA') {
    const e1 = taStep.ema(len), e2 = taStep.ema(len), e3 = taStep.ema(len);
    return {
      step: (v) => { const a = e1.step(v); const b = e2.step(a); const c = e3.step(b); return 3 * a - 3 * b + c; },
      commit: () => { e1.commit(); e2.commit(); e3.commit(); },
    };
  }
  if (type === 'DEMA') {
    const e1 = taStep.ema(len), e2 = taStep.ema(len);
    return {
      step: (v) => { const a = e1.step(v); return 2 * a - e2.step(a); },
      commit: () => { e1.commit(); e2.commit(); },
    };
  }
  if (type === 'VWMA') { const m = taStep.vwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
  // ta.sma: the window sum divided by the length
  const m = new ExactSum(len);
  const l = Math.floor(len);
  return { step: (v) => m.step(v) / l, commit: () => m.commit() };
}

interface FcoRun extends BarRunState<Record<string, never>> {
  mfi: ExactMfi;
  adSum: ExactSum;
  volSum: ExactSum;
  smooth: Smoother | null;
  signal: Smoother;
  dmi: ReturnType<typeof taStep.dmi>;
  change: ReturnType<typeof taStep.change>;
  atr: ReturnType<typeof taStep.atr>;
  fco: number[];
  signalArr: number[];
  momentum: number[];
  plots: Point[][];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<FlowControlOscillatorInputs>): BarStudy<FcoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const mfiWeight = cfg.weightMode === 'MFI Heavy' ? 0.7 : cfg.weightMode === 'CMF Heavy' ? 0.3
    : cfg.weightMode === 'Custom' ? cfg.customMFIWeight : 0.5;
  const cmfWeight = 1 - mfiWeight;

  const bullFaint = String(color.new(cfg.bullMomentumColor, 60));
  const bullFull = String(color.new(cfg.bullMomentumColor, 0));
  const bearFull = String(color.new(cfg.bearMomentumColor, 0));
  const bearFaint = String(color.new(cfg.bearMomentumColor, 60));
  const bull20 = String(color.new(cfg.bullMomentumColor, 20));
  const bear20 = String(color.new(cfg.bearMomentumColor, 20));
  const momentumColor = (m: number) => {
    if (cfg.useMomentumGradient) {
      return gt(m, 0) ? color.from_gradient(m, 0, 0.3, bullFaint, bullFull) : color.from_gradient(m, -0.3, 0, bearFull, bearFaint);
    }
    return gt(m, 0) ? bull20 : bear20;
  };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const adxLineColor = String(color.new(cfg.adxColor, 50));
  const cmfColor = String(color.new(color.blue, 70));
  const mfiColor = String(color.new(color.orange, 70));
  const adxRawColor = String(color.new(color.yellow, 70));
  const extremeColor = String(color.new(color.gray, 95));
  const weakColor = String(color.new(color.orange, 97));

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      let signal: Smoother;
      if (cfg.signalType === 'HMA') {
        // ta.hma(x, 1) is a Pine runtime error
        if (Math.floor(cfg.signalLen / 2) < 1) {
          throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
        }
        const m = taStep.hma(cfg.signalLen);
        signal = { step: (v) => m.step(v), commit: () => m.commit() };
      } else {
        signal = smoother(cfg.signalType, cfg.signalLen);
      }
      const s: FcoRun = {
        mfi: new ExactMfi(cfg.mfiLen), adSum: new ExactSum(cfg.cmfLen), volSum: new ExactSum(cfg.cmfLen),
        smooth: cfg.smoothLen > 1 ? smoother(cfg.smoothType, cfg.smoothLen) : null, signal,
        dmi: taStep.dmi(cfg.adxLen, cfg.adxSmooth), change: taStep.change(cfg.momentumLen), atr: taStep.atr(14),
        fco: [], signalArr: [], momentum: [], plots: [[], [], [], [], [], [], []], bgColors: [],
        flags: Array.from({ length: 14 }, () => []), times: Array.from({ length: 14 }, () => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.mfi, s.adSum, s.volSum, ...(s.smooth ? [s.smooth] : []), s.signal, s.dmi, s.change, s.atr];
      s.lists = [s.bgColors, ...s.times];
      s.series = [s.fco, s.signalArr, s.momentum, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { high, low, close } = b;
      const volume = b.volume ?? NaN;
      // MFI scaled to -1..+1
      const mfi = (s.mfi.step(value(b), volume) - 50) / 50;
      // CMF: ad = high == low ? 0 : ((2 * close - high - low) / (high - low)) * volume
      const ad = eq(high, low) ? 0 : ((2 * close - high - low) / (high - low)) * volume;
      // a plain division (x / 0 is +-infinity, 0 / 0 na)
      const cmf = s.adSum.step(ad) / s.volSum.step(volume);
      const fcoRaw = cfg.weightMode === 'Equal' ? cmf + mfi : (cmf * cmfWeight + mfi * mfiWeight) * 2;
      const fco = s.smooth ? s.smooth.step(fcoRaw, volume) : fcoRaw;
      const signal = s.signal.step(fco, volume);
      // ADX scaled to 0..1
      const adx = s.dmi.step(high, low, close)[2] / 100;
      const momentumBase = s.change.step(fco);
      const atrNorm = s.atr.step(high, low, close);
      const adjusted = cfg.useATRNorm ? momentumBase / atrNorm : momentumBase;
      const momentum = cfg.useADX ? adjusted * (0.3 + adx * 0.7) : adjusted;
      s.fco[i] = fco;
      s.signalArr[i] = signal;
      s.momentum[i] = momentum;

      const t = b.time;
      const p = s.plots;
      p[0][i] = { time: t, value: cfg.showMomentum ? fin(momentum) : NaN, color: momentumColor(momentum) };
      p[1][i] = { time: t, value: cfg.showFCO ? fin(fco) : NaN, color: cfg.FCOColor };
      p[2][i] = { time: t, value: cfg.showSignal ? fin(signal) : NaN, color: cfg.signalColor };
      p[3][i] = { time: t, value: cfg.showADX ? fin(adx * 2 - 1) : NaN, color: adxLineColor };
      p[4][i] = { time: t, value: fin(cmf), color: cmfColor };
      p[5][i] = { time: t, value: fin(mfi), color: mfiColor };
      p[6][i] = { time: t, value: fin(adx), color: adxRawColor };
      // bgcolor(showExtremeZones and math.abs(FCO) > 1.0 ? color.new(color.gray, 95) : na, title = "Extreme Zones")
      if (cfg.showExtremeZones && gt(Math.abs(fco), 1.0)) s.bgColors.push({ time: t, color: extremeColor, id: 'bgcolor0' });
      // bgcolor(useADX and adx < 0.20 ? color.new(color.orange, 97) : na, title = "Weak Trend Zone"), drawn on top
      if (cfg.useADX && lt(adx, 0.2)) s.bgColors.push({ time: t, color: weakColor, id: 'bgcolor1' });

      // Alert conditions
      const pm = i > 0 ? s.momentum[i - 1] : NaN;
      const pf = i > 0 ? s.fco[i - 1] : NaN;
      const ps = i > 0 ? s.signalArr[i - 1] : NaN;
      const bullMomentum = momentum > 0 && pm <= 0;
      const bearMomentum = momentum < 0 && pm >= 0;
      const extremeHigh = gt(fco, 1.0);
      const extremeLow = lt(fco, -1.0);
      const fcoBullCross = fco > 0 && pf <= 0;
      const fcoBearCross = fco < 0 && pf >= 0;
      const strongTrend = gt(adx, 0.25);
      const fcoCrossOverSignal = fco > signal && pf <= ps;
      const fcoCrossUnderSignal = fco < signal && pf >= ps;
      const absPrev = i > 0 ? Math.abs(pm) : NaN;
      const momentumWeakening = lt(Math.abs(momentum), absPrev);
      const momentumGrowing = gt(Math.abs(momentum), absPrev);
      const f = s.flags;
      f[0][i] = extremeLow && fcoCrossOverSignal && momentumWeakening;
      f[1][i] = extremeHigh && fcoCrossUnderSignal && momentumWeakening;
      f[2][i] = fcoBullCross && gt(momentum, 0) && momentumGrowing && strongTrend;
      f[3][i] = fcoBearCross && lt(momentum, 0) && momentumGrowing && strongTrend;
      f[4][i] = fcoCrossOverSignal;
      f[5][i] = fcoCrossUnderSignal;
      f[6][i] = fcoBullCross && gt(signal, ps);
      f[7][i] = fcoBearCross && lt(signal, ps);
      f[8][i] = fcoBullCross;
      f[9][i] = fcoBearCross;
      f[10][i] = extremeHigh;
      f[11][i] = extremeLow;
      f[12][i] = bullMomentum && strongTrend;
      f[13][i] = bearMomentum && strongTrend;
      for (let k = 0; k < 14; k++) if (f[k][i]) s.times[k].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(),
        },
        hlines: hlineConfig.map((h) => ({
          value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle, linewidth: h.linewidth },
        })),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FlowControlOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FlowControlOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Reversal Setup', message: 'REVERSAL: FCO crossing up from extreme oversold with weakening momentum!' },
  { id: 'alert1', title: 'Bearish Reversal Setup', message: 'REVERSAL: FCO crossing down from extreme overbought with weakening momentum!' },
  { id: 'alert2', title: 'Strong Bullish Trend', message: 'TREND: Buyers taking control with growing momentum and strong ADX!' },
  { id: 'alert3', title: 'Strong Bearish Trend', message: 'TREND: Sellers taking control with growing momentum and strong ADX!' },
  { id: 'alert4', title: 'FCO Crossed Above Signal', message: 'FCO crossed above Signal line - bullish momentum shift' },
  { id: 'alert5', title: 'FCO Crossed Below Signal', message: 'FCO crossed below Signal line - bearish momentum shift' },
  { id: 'alert6', title: 'Confirmed Bullish Signal', message: 'FCO crossed zero UP and Signal confirms - strong buy signal!' },
  { id: 'alert7', title: 'Confirmed Bearish Signal', message: 'FCO crossed zero DOWN and Signal confirms - strong sell signal!' },
  { id: 'alert8', title: 'Buyers Take Control', message: 'Buyers Now in Control!' },
  { id: 'alert9', title: 'Sellers Take Control', message: 'Sellers Now in Control!' },
  { id: 'alert10', title: 'Extreme Overbought', message: 'Buyers Exhausted - Watch for reversal!' },
  { id: 'alert11', title: 'Extreme Oversold', message: 'Sellers Exhausted - Watch for reversal!' },
  { id: 'alert12', title: 'Strong Bullish Momentum', message: 'Strong Buyers Gaining Strength!' },
  { id: 'alert13', title: 'Strong Bearish Momentum', message: 'Strong Sellers Gaining Strength!' },
];

export const FlowControlOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  alertConditions,
};
