/**
 * TFO + ADX with Histogram & Signal
 *
 * The TFO is the MFI of the source scaled to -1..+1 ((mfi - 50) / 50) plus the Chaikin Money Flow (sum of the close
 * location value times the volume over the sum of the volume), smoothed by an SMA. A signal line (WMA, HMA or EMA)
 * follows the TFO; the histogram is TFO - signal (green at or above 0, red below). The ADX (Wilder DI with a
 * fixnan, ADX smoothing by RMA) is scaled as (adx - 25) / 25 and clipped to -1.5..1.5. The background is gray where
 * |TFO| > 1.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Hist Cross' / 'Bearish Hist Cross' when the histogram
 * crosses over / under 0; 'Extreme High Alert' (TFO crosses under 1 and is above 1) and 'Extreme Low Alert' (TFO
 * crosses over -1 and is below -1) as the original writes them, so they are never true.
 *
 * Reference: "TFO + ADX with Histogram & Signal" by WalrusQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © VP_Futures
 */

import { taStep, color, compare, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowSum, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type TfoSignalType = 'EMA' | 'WMA' | 'HMA';

export interface TfoAdxWithHistogramSignalInputs {
  mfiLen: number;
  cmfLen: number;
  /** Price source of the MFI */
  src: SourceType;
  /** TFO SMA smoothing length (1 = no smoothing) */
  smoothLen: number;
  signalType: TfoSignalType;
  signalLen: number;
  /** ADX smoothing length */
  adxLen: number;
  /** DI length */
  diLen: number;
}

export const defaultInputs: TfoAdxWithHistogramSignalInputs = {
  mfiLen: 14,
  cmfLen: 20,
  src: 'hlc3',
  smoothLen: 2,
  signalType: 'WMA',
  signalLen: 3,
  adxLen: 10,
  diLen: 12,
};

export const inputConfig: InputConfig[] = [
  { id: 'mfiLen', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'cmfLen', type: 'int', title: 'CMF Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Price Source', defval: 'hlc3' },
  { id: 'smoothLen', type: 'int', title: 'TFO Smoothing', defval: 2, min: 1, max: 10 },
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'WMA', options: ['EMA', 'WMA', 'HMA'] },
  { id: 'signalLen', type: 'int', title: 'Signal Line Length', defval: 3, min: 1 },
  { id: 'adxLen', type: 'int', title: 'ADX Smoothing (Shorter for Resp)', defval: 10, min: 1 },
  { id: 'diLen', type: 'int', title: 'DI Length (Shorter for Resp)', defval: 12, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TFO Histogram', color: String(color.new(color.green, 0)), lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'TFO Signal', color: '#5b9cf6', lineWidth: 2 },
  { id: 'plot2', title: 'TFO', color: String(color.new(color.white, 80)), lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'ADX (scaled)', color: '#fdd835', lineWidth: 1 },
];

// Pine hline default style: dashed
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_upper', price: 0.7, title: 'Upper', color: String(color.new(color.gray, 70)), linestyle: 'dashed' },
  { id: 'hline_lower', price: -0.7, title: 'Lower', color: String(color.new(color.gray, 70)), linestyle: 'dashed' },
];

export const metadata = {
  title: 'TFO + ADX with Histogram & Signal',
  shortTitle: 'TFO+ADX+Hist',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** `ta.mfi(source, length)` with a constant length: the {@link WindowSum}s of the money flow of the up and down bars
 *  (the operations of taStep.mfi: the same doubles) */
class WindowMfi implements Committable {
  private readonly upper: WindowSum;
  private readonly lower: WindowSum;
  private prev = NaN;
  private bars = 0;
  private pending = NaN;
  private stepped = false;

  constructor(length: number) {
    // the length checks of ta.mfi (the same errors)
    taStep.mfi(length);
    this.upper = new WindowSum(length);
    this.lower = new WindowSum(length);
  }

  step(value: number, volume: number): number {
    this.stepped = true;
    this.pending = value;
    const change = this.bars === 0 ? NaN : value - this.prev;
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
    if (!this.stepped) return;
    this.stepped = false;
    this.prev = this.pending;
    this.bars++;
    this.upper.commit();
    this.lower.commit();
  }
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Step = { step(v: number): number; commit(): void };

interface TfoVars {
  /** fixnan of the DI values (keeps +-infinity: only na is replaced) */
  lastPlus: number;
  lastMinus: number;
}

interface TfoRun extends BarRunState<TfoVars> {
  mfi: WindowMfi;
  adSum: WindowSum;
  volSum: WindowSum;
  smooth: WindowSma | null;
  signal: Step;
  up: ReturnType<typeof taStep.change>;
  down: ReturnType<typeof taStep.change>;
  tr: ReturnType<typeof taStep.tr>;
  trRma: ReturnType<typeof taStep.rma>;
  plusRma: ReturnType<typeof taStep.rma>;
  minusRma: ReturnType<typeof taStep.rma>;
  adxRma: ReturnType<typeof taStep.rma>;
  tfo: number[];
  hist: number[];
  plots: Point[][];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TfoAdxWithHistogramSignalInputs>): BarStudy<TfoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const green = String(color.new(color.green, 0));
  const red = String(color.new(color.red, 0));
  const tfoColor = String(color.new(color.white, 80));
  const extremeColor = String(color.new(color.gray, 95));
  const lt = (a: number, b: number) => b - a > EPS;
  // ta.crossover / ta.crossunder of the alerts: plain comparisons with the previous bar
  const over = (v: number, w: number, pv: number, pw: number) => v > w && pv <= pw;
  const under = (v: number, w: number, pv: number, pw: number) => v < w && pv >= pw;
  const signalStep = (): Step => {
    if (cfg.signalType === 'WMA') {
      const m = taStep.wma();
      return { step: (v) => m.step(v, cfg.signalLen), commit: () => m.commit() };
    }
    if (cfg.signalType === 'HMA') {
      // ta.hma(x, 1) is a Pine runtime error (wma of length 0)
      if (Math.floor(cfg.signalLen / 2) < 1) {
        throw new Error("Error on bar 0: Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      }
      return taStep.hma(cfg.signalLen);
    }
    return taStep.ema(cfg.signalLen);
  };
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: TfoRun = {
        mfi: new WindowMfi(cfg.mfiLen), adSum: new WindowSum(cfg.cmfLen), volSum: new WindowSum(cfg.cmfLen),
        smooth: cfg.smoothLen > 1 ? new WindowSma(cfg.smoothLen) : null, signal: signalStep(), up: taStep.change(), down: taStep.change(),
        tr: taStep.tr(false), trRma: taStep.rma(cfg.diLen), plusRma: taStep.rma(cfg.diLen), minusRma: taStep.rma(cfg.diLen),
        adxRma: taStep.rma(cfg.adxLen), tfo: [], hist: [], plots: [[], [], [], []], bgColors: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: { lastPlus: NaN, lastMinus: NaN }, lists: [], series: [],
      };
      s.steps = [
        s.mfi, s.adSum, s.volSum, ...(s.smooth ? [s.smooth] : []), s.signal, s.up, s.down, s.tr, s.trRma, s.plusRma,
        s.minusRma, s.adxRma,
      ];
      s.lists = [s.bgColors, ...s.times];
      s.series = [s.tfo, s.hist, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const volume = b.volume ?? NaN;
      // MFI scaled to -1..+1
      const mfi = (s.mfi.step(value(b), volume) - 50) / 50;

      // CMF: ad = high == low ? 0 : ((2 * close - high - low) / (high - low)) * volume; plain division of the sums
      const ad = eq(b.high, b.low) ? 0 : ((2 * b.close - b.high - b.low) / (b.high - b.low)) * volume;
      const cmf = s.adSum.step(ad) / s.volSum.step(volume);

      const tfoRaw = cmf + mfi;
      const tfo = s.smooth ? s.smooth.step(tfoRaw) : tfoRaw;
      const signal = s.signal.step(tfo);
      const hist = tfo - signal;
      s.tfo[i] = tfo;
      s.hist[i] = hist;

      // dirmov(diLen): up = ta.change(high), down = -ta.change(low)
      const up = s.up.step(b.high);
      const down = -s.down.step(b.low);
      const plusDM = isNaN(up) ? NaN : gt(up, down) && gt(up, 0) ? up : 0;
      const minusDM = isNaN(down) ? NaN : gt(down, up) && gt(down, 0) ? down : 0;
      const trRma = s.trRma.step(s.tr.step(b.high, b.low, b.close));
      // fixnan keeps +-infinity (x / 0); only na is replaced
      const p = (100 * s.plusRma.step(plusDM)) / trRma;
      const m = (100 * s.minusRma.step(minusDM)) / trRma;
      if (!Number.isNaN(p)) v.lastPlus = p;
      if (!Number.isNaN(m)) v.lastMinus = m;
      const plus = v.lastPlus;
      const minus = v.lastMinus;
      // adx_calc: 100 * ta.rma(math.abs(p - m) / (sumDM == 0 ? 1 : sumDM), adxS)
      const sumDM = plus + minus;
      const adxRaw = 100 * s.adxRma.step(Math.abs(plus - minus) / (eq(sumDM, 0) ? 1 : sumDM));
      const adxClipped = Math.max(-1.5, Math.min(1.5, (adxRaw - 25) / 25));

      const pl = s.plots;
      pl[0][i] = { time: t, value: fin(hist), color: ge(hist, 0) ? green : red };
      pl[1][i] = { time: t, value: fin(signal), color: '#5b9cf6' };
      pl[2][i] = { time: t, value: fin(tfo), color: tfoColor };
      pl[3][i] = { time: t, value: fin(adxClipped), color: '#fdd835' };
      // bgcolor(math.abs(tfo) > 1.0 ? color.new(color.gray, 95) : na, title = "Extreme Zones")
      if (gt(Math.abs(tfo), 1.0)) s.bgColors.push({ time: t, color: extremeColor });

      // bullCross = ta.crossover(hist, 0), bearCross = ta.crossunder(hist, 0)
      // extremeHigh = ta.crossunder(tfo, 1.0) and tfo > 1.0, extremeLow = ta.crossover(tfo, -1.0) and tfo < -1.0
      const pHist = i > 0 ? s.hist[i - 1] ?? NaN : NaN;
      const pTfo = i > 0 ? s.tfo[i - 1] ?? NaN : NaN;
      const f = s.flags;
      f[0][i] = over(hist ?? NaN, 0, pHist, i > 0 ? 0 : NaN);
      f[1][i] = under(hist ?? NaN, 0, pHist, i > 0 ? 0 : NaN);
      f[2][i] = under(tfo ?? NaN, 1.0, pTfo, i > 0 ? 1.0 : NaN) && gt(tfo, 1.0);
      f[3][i] = over(tfo ?? NaN, -1.0, pTfo, i > 0 ? -1.0 : NaN) && lt(tfo, -1.0);
      for (let k = 0; k < 4; k++) if (f[k][i]) s.times[k].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const pl = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: pl[0].slice(), plot1: pl[1].slice(), plot2: pl[2].slice(), plot3: pl[3].slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
        hlines: hlineConfig.map((h) => ({ value: h.price, options: { title: h.title, color: h.color, linestyle: h.linestyle } })),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TfoAdxWithHistogramSignalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TfoAdxWithHistogramSignalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Hist Cross', message: 'TFO Hist Bullish Cross!' },
  { id: 'alert1', title: 'Bearish Hist Cross', message: 'TFO Hist Bearish Cross!' },
  { id: 'alert2', title: 'Extreme High Alert', message: 'TFO Extreme High - Potential Reversal!' },
  { id: 'alert3', title: 'Extreme Low Alert', message: 'TFO Extreme Low - Potential Reversal!' },
];

export const TfoAdxWithHistogramSignal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  alertConditions,
};
