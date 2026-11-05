/**
 * Wavelet-Trend ML Integration [Alpha Extract]
 *
 * Trend filter: two high-pass filters of the close (short and long scale, each smoothed by EMA(3)); their
 * difference times long / short, noise-reduced (mean of EMA(1) and EMA(2)), divided by ATR and normalised by its
 * highest absolute value over `lookback` bars (clamped to -1..1). Binary classifier: a logistic unit on six binary
 * features (RSI > 50, CCI crossing +/-100, DMI, highest / lowest bar position, fast / slow EMA, SuperTrend
 * direction) whose weights learn online against the sign of the standardised close. The signal is the mean of both,
 * EMA smoothed, scaled by the ratio of its stdev over `lookback` to its stdev over 2 * lookback, clamped to -2..2.
 * Candles on the price pane, reference lines, a gradient fill to zero and labels on the zero crossings.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Signal' / 'Bearish Signal' on the zero crossings (the
 * bars of the labels).
 *
 * Reference: "Wavelet-Trend ML Integration [Alpha Extract]" by AlphaExtract
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface WaveletTrendMLIntegrationInputs {
  shortLength: number;
  longLength: number;
  smoothing: number;
  /** Normalisation lookback (max 1000) */
  lookback: number;
  atrLength: number;
  /** Enable the high-pass filter (else EMAs) */
  useWavelet: boolean;
  noiseReduction: boolean;
  wnMin: number;
  wnMax: number;
  /** Enable the binary classifier */
  enableAI: boolean;
  adaptivePeriod: number;
  /** Learning rate */
  adaptationRate: number;
  momentumPeriod: number;
  volatilityPeriod: number;
  trendStrengthPeriod: number;
  oscillationPeriod: number;
  velocityPeriod: number;
  resistanceFactor: number;
  resistancePeriod: number;
  upperCol: string;
  lowerCol: string;
  showHLines: boolean;
  hlineColor: string;
  hlineStyle: string;
}

export const defaultInputs: WaveletTrendMLIntegrationInputs = {
  shortLength: 12,
  longLength: 23,
  smoothing: 8,
  lookback: 1000,
  atrLength: 8,
  useWavelet: true,
  noiseReduction: true,
  wnMin: 1,
  wnMax: 2,
  enableAI: true,
  adaptivePeriod: 50,
  adaptationRate: 0.08,
  momentumPeriod: 29,
  volatilityPeriod: 45,
  trendStrengthPeriod: 35,
  oscillationPeriod: 35,
  velocityPeriod: 30,
  resistanceFactor: 3.2,
  resistancePeriod: 2,
  upperCol: '#00b35f',
  lowerCol: '#cf1059',
  showHLines: true,
  hlineColor: String(color.new(color.gray, 70)),
  hlineStyle: 'Dashed',
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLength', type: 'int', title: 'Short Scale Length', defval: 12 },
  { id: 'longLength', type: 'int', title: 'Long Scale Length', defval: 23 },
  { id: 'smoothing', type: 'int', title: 'Final Signal Smoothing', defval: 8 },
  { id: 'lookback', type: 'int', title: 'Normalization Lookback', defval: 1000, min: 1, max: 1000, step: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 8 },
  { id: 'useWavelet', type: 'bool', title: 'Enable High-Pass Filter', defval: true },
  { id: 'noiseReduction', type: 'bool', title: 'Enable Noise Reduction', defval: true },
  { id: 'wnMin', type: 'int', title: 'NoiseR Min Length', defval: 1 },
  { id: 'wnMax', type: 'int', title: 'NoiseR Max Length', defval: 2 },
  { id: 'enableAI', type: 'bool', title: 'Enable Binary Classifier', defval: true },
  { id: 'adaptivePeriod', type: 'int', title: 'Adaptive Normalization Period', defval: 50 },
  { id: 'adaptationRate', type: 'float', title: 'Learning Rate', defval: 0.08, step: 0.01, max: 0.15 },
  { id: 'momentumPeriod', type: 'int', title: 'Momentum Detector Length', defval: 29 },
  { id: 'volatilityPeriod', type: 'int', title: 'Volatility Detector Length', defval: 45 },
  { id: 'trendStrengthPeriod', type: 'int', title: 'Trend Strength Length', defval: 35 },
  { id: 'oscillationPeriod', type: 'int', title: 'Oscillation Detector Length', defval: 35 },
  { id: 'velocityPeriod', type: 'int', title: 'Price Velocity Length', defval: 30 },
  { id: 'resistanceFactor', type: 'float', title: 'Dynamic Resistance Factor', defval: 3.2, step: 0.1 },
  { id: 'resistancePeriod', type: 'int', title: 'Resistance Detection Period', defval: 2, step: 1 },
  { id: 'upperCol', type: 'color', title: 'Up Color', defval: '#00b35f' },
  { id: 'lowerCol', type: 'color', title: 'Down Color', defval: '#cf1059' },
  { id: 'showHLines', type: 'bool', title: 'Show Horizontal Reference Lines', defval: true },
  { id: 'hlineColor', type: 'color', title: 'Reference Line Color', defval: String(color.new(color.gray, 70)) },
  { id: 'hlineStyle', type: 'string', title: 'Reference Line Style', defval: 'Dashed', options: ['Solid', 'Dashed', 'Dotted'] },
];

const LEVELS: [string, number, number][] = [
  ['Upper Extreme', 1.0, 1], ['Strong Bullish', 0.75, 1], ['Bullish Zone', 0.5, 1], ['Weak Bullish', 0.25, 1],
  ['Zero Line', 0, 2], ['Weak Bearish', -0.25, 1], ['Bearish Zone', -0.5, 1], ['Strong Bearish', -0.75, 1],
  ['Lower Extreme', -1.0, 1],
];

export const plotConfig: PlotConfig[] = [
  ...LEVELS.map(([title, , width], k) => ({ id: `plot${k}`, title, color: '#787B864D', lineWidth: width })),
  { id: 'plot9', title: 'Signal', color: '#00b35f', lineWidth: 1 },
  { id: 'plot10', title: 'Zero Line', color: '#00b35f', lineWidth: 2 },
];

export const metadata = {
  title: 'Trend Filter with Pattern Recognition',
  shortTitle: 'Wavelet-Trend ML',
  overlay: false,
};

/**
 * `ta.highest(source, length)` / `ta.lowest` with a constant length, one bar at a time with a queue of the best values
 * (same doubles as the oakscriptjs taStep machine, which scans the window): the best of the last `length` non-na
 * values, na before bar `length - 1`; +0 wins over -0 for the highest, -0 for the lowest.
 */
class WindowExtreme implements Committable {
  private vals: number[] = [];
  private ids: number[] = [];
  private head = 0;
  /** Non-na values committed */
  private kept = 0;
  private bars = 0;
  /** Preferred zeros in the queue */
  private zeros = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;
  private readonly zero: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
    this.zero = lowest ? -0 : 0;
  }

  private beats(a: number, b: number): boolean {
    return this.lowest ? a < b : a > b;
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const own = Number.isFinite(value);
    const total = this.kept + (own ? 1 : 0);
    if (this.bars < this.len - 1 || total === 0) return NaN;
    let h = this.head;
    let z = this.zeros;
    if (h < this.ids.length && this.ids[h]! < total - this.len) {
      if (Object.is(this.vals[h], this.zero)) z--;
      h++;
    }
    const has = h < this.ids.length;
    let best: number;
    if (own) {
      best = has && !this.beats(value, this.vals[h]!) ? this.vals[h]! : value;
      if (Object.is(value, this.zero)) z++;
    } else {
      best = this.vals[h]!;
    }
    return best === 0 && z > 0 ? this.zero : best;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    while (this.ids.length > this.head && this.beats(v, this.vals[this.vals.length - 1]!)) {
      if (Object.is(this.vals.pop(), this.zero)) this.zeros--;
      this.ids.pop();
    }
    this.vals.push(v);
    this.ids.push(this.kept);
    if (Object.is(v, this.zero)) this.zeros++;
    this.kept++;
    while (this.head < this.ids.length && this.ids[this.head]! < this.kept - this.len) {
      if (Object.is(this.vals[this.head], this.zero)) this.zeros--;
      this.head++;
    }
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals.splice(0, this.head);
      this.ids.splice(0, this.head);
      this.head = 0;
    }
  }
}

/**
 * `ta.cci(source, length)` one bar at a time: the operations of the taStep machine (one sma for the mean and the
 * mean deviation, a zero dev keeps the previous value) with the window kept here.
 */
class CciWindow implements Committable {
  private readonly mean = taStep.sma();
  private values: number[] = [];
  private last = 0;
  private next = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(length: number) {
    this.len = Math.floor(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.next = this.last;
    this.pending = value;
    const len = this.len;
    const mean = this.mean.step(value, len);
    const h = this.values;
    const n = h.length;
    if (Number.isNaN(mean) || n < len - 1) return NaN;
    let sum = 0;
    for (let k = 0; k < len; k++) sum += Math.abs((k === 0 ? value : h[n - k]!) - mean);
    const d = sum / len;
    if (Number.isNaN(d)) return NaN;
    if (!(Math.abs(d) <= 1e-10)) this.next = (value - mean) / (0.015 * d);
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    this.mean.commit();
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

/**
 * `ta.highestbars(source, length)` / `ta.lowestbars` with a constant length, one bar at a time with a queue: the
 * offset to the bar of the best of the last `length` non-na values (the newest one on equal values), na before bar
 * `length - 1` and while no value was received (the rules of the oakscriptjs function).
 */
class BarsExtreme implements Committable {
  private vals: number[] = [];
  private ids: number[] = [];
  private bars: number[] = [];
  private head = 0;
  private kept = 0;
  private count = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
  }

  /** a beats b or equals it (the newest wins) */
  private wins(a: number, b: number): boolean {
    return this.lowest ? a <= b : a >= b;
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const i = this.count;
    const own = Number.isFinite(value);
    const total = this.kept + (own ? 1 : 0);
    if (i < this.len - 1 || total === 0) return NaN;
    let h = this.head;
    if (h < this.ids.length && this.ids[h]! < total - this.len) h++;
    const has = h < this.ids.length;
    const bar = own && (!has || this.wins(value, this.vals[h]!)) ? i : this.bars[h]!;
    return -(i - bar);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const v = this.pending;
    const i = this.count++;
    if (!Number.isFinite(v)) return;
    while (this.ids.length > this.head && this.wins(v, this.vals[this.vals.length - 1]!)) {
      this.vals.pop();
      this.ids.pop();
      this.bars.pop();
    }
    this.vals.push(v);
    this.ids.push(this.kept);
    this.bars.push(i);
    this.kept++;
    while (this.head < this.ids.length && this.ids[this.head]! < this.kept - this.len) this.head++;
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals.splice(0, this.head);
      this.ids.splice(0, this.head);
      this.bars.splice(0, this.head);
      this.head = 0;
    }
  }
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

interface WaveletVars {
  /** hp[1] of the short and long high-pass filters */
  hpShort: number;
  hpLong: number;
  /** var learning adjustments, changed in place */
  adj: number[];
}

type Ema = ReturnType<typeof taStep.ema>;

interface WaveletRun extends BarRunState<WaveletVars> {
  atr: ReturnType<typeof taStep.atr>;
  fastEma: Ema;
  slowEma: Ema;
  emaMin: Ema;
  emaMax: Ema;
  absMax: WindowExtreme;
  mean: ReturnType<typeof taStep.sma>;
  dev: ReturnType<typeof taStep.stdev>;
  rsi: ReturnType<typeof taStep.rsi>;
  cci: CciWindow;
  dmi: ReturnType<typeof taStep.dmi>;
  hb: BarsExtreme;
  lb: BarsExtreme;
  velFast: Ema;
  velSlow: Ema;
  st: ReturnType<typeof taStep.supertrend>;
  mom: ReturnType<typeof taStep.mom>;
  smoothFinal: Ema;
  recentVol: ReturnType<typeof taStep.stdev>;
  longVol: ReturnType<typeof taStep.stdev>;
  cciArr: number[];
  finalSignal: number[];
  plots: Point[][];
  candles: PlotCandleData[];
  fillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<WaveletTrendMLIntegrationInputs>): BarStudy<WaveletRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const nz = (v: number) => (isNaN(v) ? 0 : v);
  // highPassFilter(src, len): hp := (1 - alpha / 2) * (src - src[1]) + (1 - alpha) * nz(hp[1]); ta.ema(hp, 3)
  const pi = 3.14159265359;
  const hpAlpha = (len: number) => (1 - Math.sin((2 * pi) / len)) / Math.cos((2 * pi) / len);
  const alphaShort = hpAlpha(cfg.shortLength);
  const alphaLong = hpAlpha(cfg.longLength);
  const scaleRatio = cfg.longLength / cfg.shortLength;
  const base = [1, 4, 1, 2, 5, 4]; // alpha_momentum, beta_volatility, gamma_trend, delta_oscillation, epsilon_velocity, zeta_resistance
  const bias = 1.0;
  const f = [0, 0, 0, 0, 0, 0];
  const zeroLineColor = String(color.new(cfg.hlineColor, 30));
  return {
    init() {
      const s: WaveletRun = {
        atr: taStep.atr(cfg.atrLength),
        fastEma: taStep.ema(cfg.useWavelet ? 3 : cfg.shortLength),
        slowEma: taStep.ema(cfg.useWavelet ? 3 : cfg.longLength),
        emaMin: taStep.ema(cfg.wnMin), emaMax: taStep.ema(cfg.wnMax),
        absMax: new WindowExtreme(false, cfg.lookback),
        mean: taStep.sma(), dev: taStep.stdev(), rsi: taStep.rsi(cfg.momentumPeriod),
        cci: new CciWindow(cfg.volatilityPeriod), dmi: taStep.dmi(cfg.trendStrengthPeriod, 10),
        hb: new BarsExtreme(false, cfg.oscillationPeriod), lb: new BarsExtreme(true, cfg.oscillationPeriod),
        velFast: taStep.ema(cfg.velocityPeriod), velSlow: taStep.ema(cfg.velocityPeriod - 10),
        st: taStep.supertrend(cfg.resistanceFactor, cfg.resistancePeriod), mom: taStep.mom(14),
        smoothFinal: taStep.ema(cfg.smoothing), recentVol: taStep.stdev(), longVol: taStep.stdev(),
        cciArr: [], finalSignal: [], plots: Array.from({ length: 11 }, () => []), candles: [], fillColors: [],
        markers: [], flags: [[], []], times: [[], []],
        steps: [], lists: [], series: [],
        vars: { hpShort: NaN, hpLong: NaN, adj: [0, 0, 0, 0, 0, 0] },
      };
      s.steps = [s.atr, s.fastEma, s.slowEma, s.emaMin, s.emaMax, s.absMax, s.mean, s.dev, s.rsi, s.cci, s.dmi, s.hb,
        s.lb, s.velFast, s.velSlow, s.st, s.mom, s.smoothFinal, s.recentVol, s.longVol];
      s.lists = [s.markers, ...s.times];
      s.series = [s.cciArr, s.finalSignal, ...s.plots, s.candles, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const close = b.close;
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const atr = s.atr.step(b.high, b.low, close);

      let fastC: number;
      let slowC: number;
      if (cfg.useWavelet) {
        const hpS = (1 - alphaShort / 2) * (close - prevClose) + (1 - alphaShort) * nz(v.hpShort);
        const hpL = (1 - alphaLong / 2) * (close - prevClose) + (1 - alphaLong) * nz(v.hpLong);
        v.hpShort = hpS;
        v.hpLong = hpL;
        fastC = s.fastEma.step(hpS);
        slowC = s.slowEma.step(hpL);
      } else {
        fastC = s.fastEma.step(close);
        slowC = s.slowEma.step(close);
      }
      const rawSignal = (fastC - slowC) * scaleRatio;
      // wn(src): noiseReduction ? (ema(src, wnMin) + ema(src, wnMax)) / 2 : src
      const emaMin = s.emaMin.step(rawSignal);
      const emaMax = s.emaMax.step(rawSignal);
      const smoothed = cfg.noiseReduction ? (emaMin + emaMax) / 2 : rawSignal;
      // math.max(na, x) is na
      const atrAdj = smoothed / (isNaN(atr) ? NaN : Math.max(atr * scaleRatio, 0.001));
      const absMax = s.absMax.step(Math.abs(atrAdj));
      const filterNorm = Math.min(Math.max(atrAdj / (isNaN(absMax) ? NaN : Math.max(absMax, 0.001)), -1), 1);

      // Binary classifier features
      const mean = s.mean.step(close, cfg.adaptivePeriod);
      const dev = s.dev.step(close, cfg.adaptivePeriod);
      const rsi = s.rsi.step(close);
      const cci = s.cci.step((b.high + b.low + b.close) / 3);
      s.cciArr[i] = cci;
      const [diPlus, diMinus] = s.dmi.step(b.high, b.low, close);
      const hb = s.hb.step(b.high);
      const lb = s.lb.step(b.low);
      const velFast = s.velFast.step(close);
      const velSlow = s.velSlow.step(close);
      const [, stDir] = s.st.step(b.high, b.low, close);
      const mom = s.mom.step(close);

      // market_direction = standardize_data(close) > 0 ? 1 : 0
      const std = (close - mean) / (isNaN(dev) ? NaN : Math.max(dev, 0.0001));
      const target = std > 0 ? 1 : 0;
      let fVol = 0.5;
      const cci1 = i > 0 ? s.cciArr[i - 1] : NaN;
      if (i > 0 && cci > 100 && cci1 <= 100) fVol = 1;
      if (i > 0 && cci < -100 && cci1 >= -100) fVol = 0;
      const osUp = ((cfg.oscillationPeriod + hb) / cfg.oscillationPeriod) * 100;
      const osDn = ((cfg.oscillationPeriod + lb) / cfg.oscillationPeriod) * 100;
      f[0] = rsi > 50 ? 1 : 0;
      f[1] = fVol;
      f[2] = diPlus > diMinus ? 1 : 0;
      f[3] = osUp > osDn ? 1 : 0;
      f[4] = velFast > velSlow ? 1 : 0;
      f[5] = stDir === -1 ? 1 : 0;
      let ai = 0.0;
      if (cfg.enableAI) {
        // the weights used for both predictions are the ones before this bar's update
        let sum = 0;
        for (let k = 0; k < 6; k++) sum = sum + (base[k] + v.adj[k]) * f[k];
        const input = bias + sum;
        const prediction = 1 / (1 + Math.exp(-input));
        const gradient = prediction - target;
        for (let k = 0; k < 6; k++) v.adj[k] -= cfg.adaptationRate * gradient * f[k];
        ai = (prediction - 0.5) * 2;
      }
      let rawFinal: number;
      if (cfg.useWavelet && cfg.enableAI) rawFinal = (filterNorm + ai) / 2;
      else if (cfg.useWavelet) rawFinal = filterNorm;
      else if (cfg.enableAI) rawFinal = ai;
      else rawFinal = mom / close; // ta.mom(close, 14) / close

      const smoothedFinal = s.smoothFinal.step(rawFinal);
      const recentVol = s.recentVol.step(smoothedFinal, cfg.lookback);
      const longVol = s.longVol.step(smoothedFinal, cfg.lookback * 2);
      const scale = recentVol / (isNaN(longVol) ? NaN : Math.max(longVol, 0.0001));
      const finalSignal = Math.min(Math.max(smoothedFinal * scale, -2), 2);
      s.finalSignal[i] = finalSignal;

      const t = b.time;
      // lineCondition: Dashed -> bar_index % 4 <= 1; Dotted -> bar_index % 2 == 0; Solid -> true
      const cond = cfg.hlineStyle === 'Dashed' ? i % 4 <= 1 : cfg.hlineStyle === 'Dotted' ? i % 2 === 0 : true;
      const refCol = cfg.showHLines && cond ? cfg.hlineColor : 'transparent';
      const zeroCol = cfg.showHLines && cond ? zeroLineColor : 'transparent';
      for (let k = 0; k < LEVELS.length; k++) {
        const level = LEVELS[k][1];
        s.plots[k][i] = { time: t, value: cfg.showHLines ? level : NaN, color: level === 0 ? zeroCol : refCol };
      }
      const trend = finalSignal >= 0 ? cfg.upperCol : cfg.lowerCol;
      s.plots[9][i] = { time: t, value: finalSignal, color: trend };
      s.plots[10][i] = { time: t, value: 0, color: trend };
      s.candles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close,
        color: trend, wickColor: trend, borderColor: trend, forceOverlay: true };
      s.fillColors[i] = String(color.new(trend, 70));
      // plotshape(finalSignal > 0 and finalSignal[1] <= 0, labelup, belowbar, text "︿") and the bearish label
      const prev = i > 0 ? s.finalSignal[i - 1] : NaN;
      // alertcondition(finalSignal > 0 and finalSignal[1] <= 0) / alertcondition(finalSignal < 0 and finalSignal[1] >= 0)
      const bull = finalSignal > 0 && prev <= 0;
      const bear = finalSignal < 0 && prev >= 0;
      s.flags[0][i] = bull;
      s.flags[1][i] = bear;
      if (bull) {
        s.times[0].push(t as number);
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: cfg.upperCol, text: '︿', textColor: color.white,
          size: 'tiny', forceOverlay: true });
      }
      if (bear) {
        s.times[1].push(t as number);
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: cfg.lowerCol, text: '﹀', textColor: color.white,
          size: 'tiny', forceOverlay: true });
      }
    },
    copyVars: (v) => ({ ...v, adj: v.adj.slice() }),
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k <= 10; k++) plots[`plot${k}`] = s.plots[k].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        // fill(p1, p2, finalSignal, 0, na, color.new(trend_col, 70))
        fills: [{
          plot1: 'plot9', plot2: 'plot10',
          gradient: { topValue: s.finalSignal.slice(), bottomValue: new Array(n).fill(0), topColor: new Array(n).fill(null), bottomColor: s.fillColors.slice() },
        }],
        markers: s.markers.slice(),
        plotCandles: { signalCandles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((fl) => n > 0 && fl[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WaveletTrendMLIntegrationInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WaveletTrendMLIntegrationInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Signal', message: 'Bullish Signal Detected' },
  { id: 'alert1', title: 'Bearish Signal', message: 'Bearish Signal Detected' },
];

export const WaveletTrendMLIntegration = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
