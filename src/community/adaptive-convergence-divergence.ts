/**
 * Adaptive Convergence Divergence
 *
 * A MACD (or PPO) built from two adaptive moving averages instead of EMAs. Each adaptive average is
 * ma = alpha * src + (1 - alpha) * nz(ma[1], sma(src, len)), with alpha = clamp(2 / (len + 1) * factor, 0.01, 1).
 * The factor comes from the MA type: ACMO |cmo| / 100, ARSI |rsi - 50| / 50, FRMA the normalized range roughness
 * (2 * range of len / 2 bars / range of len bars), VOLA the normalized volume ratio (volume / sma(volume) - 1); the
 * last two are normalized to 0..1 by their min / max over len bars. The fast average uses the source and the fast
 * length; the slow one uses the fast average, the slow length and half the alpha. ACD = fast - slow (PPO: in % of
 * the slow one), signal = EMA (or Wilder's RMA) of ACD, histogram = ACD - signal. Colours follow ACD vs signal.
 * Alerts (alertcondition, `alerts` of the result): ACD crosses over the signal, under it, and either cross.
 *
 * Reference: "Adaptive Convergence Divergence" by singhxgurjit
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright (c) 2025 Gurjit Singh. This source code is licensed under the Creative Commons
 * Attribution-ShareAlike: https://creativecommons.org/licenses/by-sa/4.0/.
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowExtreme, WindowSma, WindowSum,
  type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export type AdaptiveConvergenceDivergenceMaType = 'ACMO' | 'ARSI' | 'FRMA' | 'VOLA';

export interface AdaptiveConvergenceDivergenceInputs {
  src: SourceType;
  maType: AdaptiveConvergenceDivergenceMaType;
  /** Fast length */
  length: number;
  slowLen: number;
  signalLen: number;
  /** PPO (percent) instead of MACD (difference) */
  usePPO: boolean;
  /** Wilder's RMA instead of EMA for the signal line */
  useWilders: boolean;
  bullishColor: string;
  bearishColor: string;
  fillTrans: number;
  histTransUp: number;
  histTransDown: number;
}

export const defaultInputs: AdaptiveConvergenceDivergenceInputs = {
  src: 'close',
  maType: 'ARSI',
  length: 12,
  slowLen: 26,
  signalLen: 9,
  usePPO: false,
  useWilders: false,
  bullishColor: 'rgb(176, 190, 197)',
  bearishColor: 'rgb(141, 110, 99)',
  fillTrans: 94,
  histTransUp: 25,
  histTransDown: 65,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close', inline: 'src' },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ARSI', options: ['ACMO', 'ARSI', 'FRMA', 'VOLA'], inline: 'src' },
  { id: 'length', type: 'int', title: 'Length: Fast', defval: 12, inline: 'len' },
  { id: 'slowLen', type: 'int', title: 'Slow', defval: 26, inline: 'len' },
  { id: 'signalLen', type: 'int', title: 'Signal', defval: 9, inline: 'len' },
  { id: 'usePPO', type: 'bool', title: 'Use PPO (vs MACD)', defval: false },
  { id: 'useWilders', type: 'bool', title: "Use Wilder's (vs EMA) smoothing for signal line", defval: false },
  { id: 'bullishColor', type: 'color', title: 'Bullish', defval: 'rgb(176, 190, 197)', inline: 'Clr' },
  { id: 'bearishColor', type: 'color', title: 'Bearish', defval: 'rgb(141, 110, 99)', inline: 'Clr' },
  { id: 'fillTrans', type: 'int', title: 'Fill Transparency', defval: 94, inline: 'Clr' },
  { id: 'histTransUp', type: 'int', title: 'Histogram Trans: Up', defval: 25, inline: 'Clr1' },
  { id: 'histTransDown', type: 'int', title: 'Down', defval: 65, inline: 'Clr1' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ACD', color: 'rgb(176, 190, 197)', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: 'rgb(176, 190, 197)', lineWidth: 1 },
  { id: 'plot2', title: 'Histogram', color: 'rgb(176, 190, 197)', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Adaptive Convergence Divergence',
  shortTitle: 'ACD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; `x != 0` is false when x is na */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const neZero = (x: number) => !isNaN(x) && Math.abs(x) > EPS;
/** math.max / math.min: na when an argument is na */
const clampAlpha = (alpha: number) => (isNaN(alpha) ? NaN : Math.max(0.01, Math.min(alpha, 1)));

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

const getAlphaBase = (len: number) => 2 / (len + 1);

/**
 * maCalc(src, len, half) one bar at a time: the adaptive average of one length with the factor of the MA type,
 * adaptiveMA(src, len, alpha): ma = alpha * src + (1 - alpha) * nz(ma[1], sma(src, len)). Committed with the bar.
 */
class AdaptiveMa implements Committable {
  private readonly initSma: WindowSma;
  private readonly steps: Committable[];
  // ACMO: ta.cmo(src, len) from math.sum of the up / down changes
  private up: WindowSum | null = null;
  private down: WindowSum | null = null;
  // ARSI
  private rsi: ReturnType<typeof taStep.rsi> | null = null;
  // FRMA
  private hiL: WindowExtreme | null = null;
  private loL: WindowExtreme | null = null;
  private hiS: WindowExtreme | null = null;
  private loS: WindowExtreme | null = null;
  // VOLA
  private avgVol: WindowSma | null = null;
  // normalize(x, len)
  private normLo: WindowExtreme | null = null;
  private normHi: WindowExtreme | null = null;
  /** src[1] and ma[1] */
  private prevSrc = NaN;
  private prev = NaN;
  private nextSrc = NaN;
  private next = NaN;

  constructor(private readonly maType: AdaptiveConvergenceDivergenceMaType, private readonly len: number, private readonly halfAlpha: boolean) {
    this.initSma = new WindowSma(len);
    const steps: Committable[] = [this.initSma];
    if (maType === 'ACMO') {
      this.up = new WindowSum(len);
      this.down = new WindowSum(len);
      steps.push(this.up, this.down);
    } else if (maType === 'ARSI') {
      this.rsi = taStep.rsi(len);
      steps.push(this.rsi);
    } else {
      if (maType === 'FRMA') {
        const half = Math.floor(len / 2);
        this.hiL = new WindowExtreme(false, len);
        this.loL = new WindowExtreme(true, len);
        this.hiS = new WindowExtreme(false, half);
        this.loS = new WindowExtreme(true, half);
        steps.push(this.hiL, this.loL, this.hiS, this.loS);
      } else {
        this.avgVol = new WindowSma(len);
        steps.push(this.avgVol);
      }
      this.normLo = new WindowExtreme(true, len);
      this.normHi = new WindowExtreme(false, len);
      steps.push(this.normLo, this.normHi);
    }
    this.steps = steps;
  }

  /** normalize(x, len): (x - lowest) / (highest - lowest); 0.5 when the range is 0 or na */
  private normalize(x: number): number {
    const lo = this.normLo!.step(x);
    const hi = this.normHi!.step(x);
    const fullRange = hi - lo;
    return neZero(fullRange) ? (x - lo) / fullRange : 0.5;
  }

  step(src: number, volume: number): number {
    const len = this.len;
    let alpha: number;
    if (this.maType === 'ACMO') {
      // cmo = math.abs(ta.cmo(src, len) / 100); alpha = clampAlpha(base * cmo)
      const mom = src - this.prevSrc;
      const sm1 = this.up!.step(mom >= 0 ? mom : 0);
      const sm2 = this.down!.step(mom >= 0 ? 0 : -mom);
      // a flat window is 0 / 0 = na
      const cmo = (100 * (sm1 - sm2)) / (sm1 + sm2);
      alpha = clampAlpha(getAlphaBase(len) * Math.abs(cmo / 100));
    } else if (this.maType === 'ARSI') {
      // rsi = math.abs(ta.rsi(src, len) - 50) / 50
      const rsi = this.rsi!.step(src);
      alpha = clampAlpha(getAlphaBase(len) * (Math.abs(rsi - 50) / 50));
    } else if (this.maType === 'FRMA') {
      const rangeLong = this.hiL!.step(src) - this.loL!.step(src);
      const rangeShort = (this.hiS!.step(src) - this.loS!.step(src)) * 2;
      const roughness = neZero(rangeLong) ? rangeShort / rangeLong : 1;
      alpha = clampAlpha(getAlphaBase(len) * this.normalize(roughness));
    } else {
      // VOLA: volRatio = avgVol != 0 ? volume / avgVol - 1 : 0
      const avgVol = this.avgVol!.step(volume);
      const volRatio = neZero(avgVol) ? volume / avgVol - 1 : 0;
      alpha = clampAlpha(getAlphaBase(len) * this.normalize(volRatio));
    }
    // getHalfAlpha(alpha, half) => half ? alpha / 2 : alpha
    if (this.halfAlpha) alpha = alpha / 2;
    const initSMA = this.initSma.step(src);
    const base = isNaN(this.prev) ? initSMA : this.prev;
    const ma = alpha * src + (1 - alpha) * base;
    this.nextSrc = src;
    this.next = ma;
    return ma;
  }

  commit(): void {
    for (const m of this.steps) m.commit();
    this.prevSrc = this.nextSrc;
    this.prev = this.next;
  }
}

interface AcdRun extends BarRunState<Record<string, never>> {
  fast: AdaptiveMa;
  slow: AdaptiveMa;
  sig: { step(v: number): number; commit(): void };
  osc: number[];
  signal: number[];
  hist: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AdaptiveConvergenceDivergenceInputs>): BarStudy<AcdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const fast = new AdaptiveMa(cfg.maType, cfg.length, false);
      const slow = new AdaptiveMa(cfg.maType, cfg.slowLen, true);
      const sig = cfg.useWilders ? taStep.rma(cfg.signalLen) : taStep.ema(cfg.signalLen);
      const s: AcdRun = {
        fast, slow, sig, osc: [], signal: [], hist: [], plot0: [], plot1: [], plot2: [], fillColors: [],
        flags: [[], [], []], times: [[], [], []], steps: [fast, slow, sig], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.osc, s.signal, s.hist, s.plot0, s.plot1, s.plot2, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const ma = s.fast.step(value(b), volume);
      const fama = s.slow.step(ma, volume);
      // Plain division: x / 0 is +-infinity (0 / 0 na), as Pine
      const osc = cfg.usePPO ? ((ma - fama) / fama) * 100 : ma - fama;
      const signal = s.sig.step(osc);
      const hist = osc - signal;
      s.osc[i] = osc;
      s.signal[i] = signal;
      s.hist[i] = hist;

      const trendColor = gt(osc, signal) ? cfg.bullishColor : cfg.bearishColor;
      s.plot0[i] = { time: b.time, value: fin(osc), color: trendColor };
      s.plot1[i] = { time: b.time, value: fin(signal), color: trendColor };
      // color = hist[1] < hist ? color.new(trendColor, histTransUp) : color.new(trendColor, histTransDown)
      s.plot2[i] = {
        time: b.time, value: fin(hist),
        color: String(color.new(trendColor, i > 0 && lt(s.hist[i - 1], hist) ? cfg.histTransUp : cfg.histTransDown)),
      };
      // fill(plotOsc, plotSign, color = color.new(trendColor, fillTrans))
      s.fillColors[i] = String(color.new(trendColor, cfg.fillTrans));

      // co = ta.crossover(osc, signal); cu = ta.crossunder(osc, signal)
      const po = i > 0 ? s.osc[i - 1] : NaN;
      const ps = i > 0 ? s.signal[i - 1] : NaN;
      const co = osc > signal && po <= ps;
      const cu = osc < signal && po >= ps;
      // alertcondition(co, ...), alertcondition(cu, ...), alertcondition(co or cu, ...)
      const either = co || cu;
      s.flags[0][i] = co;
      s.flags[1][i] = cu;
      s.flags[2][i] = either;
      if (co) s.times[0].push(b.time as number);
      if (cu) s.times[1].push(b.time as number);
      if (either) s.times[2].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveConvergenceDivergenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptiveConvergenceDivergenceInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish 🐂', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Bearish 🐻', message: 'Alert Fired!' },
  { id: 'alert2', title: '🐂 Bulls ⚔️ Bears 🐻', message: 'Alert Fired!' },
];

export const AdaptiveConvergenceDivergence = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
