/**
 * AI Adaptive Oscillator
 *
 * An ensemble of five normalised oscillators: (RSI - 50) / 50, CCI / 200, (Stochastic %K - 50) / 50,
 * (MACD(len/2, len) - signal) / ATR and the volume weighted momentum change(close, len) * volume / SMA(volume, len)
 * divided by its standard deviation. Each oscillator gets a score: the share of the last `lookback` bars where its
 * sign on the bar before matched the sign of the close change. The scores (of the first `ensembleSize` oscillators)
 * weight the oscillators; the sum is smoothed with an alpha = adaptiveSpeed * ATR / SMA(ATR, 5 * len) clamped to
 * 0.1..0.9 and scaled by 6. Thresholds are 0.8 times the highest / lowest value over `lookback` bars (capped to
 * +-6). Bullish / bearish labels mark local bottoms below the lower threshold / tops above the upper one, with a
 * cooldown and a minimum change from the previous signal; the label text gives a confidence level from the scores,
 * the agreement of the oscillators and the signal strength. Gradient fills colour the 3..6 and -3..-6 zones and the
 * area between the oscillator and zero.
 *
 * Alerts (alertcondition, `alerts` of the result): the oscillator crossing zero (either way) and the bullish /
 * bearish signals.
 *
 * Reference: "AI Adaptive Oscillator [PhenLabs]" by PhenLabs
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © PhenLabs
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface AiAdaptiveOscillatorInputs {
  bullishColor: string;
  bearishColor: string;
  /** Minimum number of bars between two signals of the same side */
  signalCooldownBars: number;
  /** Minimum change of the oscillator from the previous signal of the same side */
  signalMinChange: number;
  /** Length of the oscillators */
  baseLength: number;
  /** Adaptive speed of the smoothing */
  adaptiveSpeed: number;
  /** Lookback of the scores and of the thresholds */
  lookbackPeriod: number;
  /** Number of oscillators used (2..5) */
  ensembleSize: number;
}

export const defaultInputs: AiAdaptiveOscillatorInputs = {
  bullishColor: '#2b62fa',
  bearishColor: '#ce9851',
  signalCooldownBars: 10,
  signalMinChange: 1.5,
  baseLength: 14,
  adaptiveSpeed: 0.1,
  lookbackPeriod: 150,
  ensembleSize: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#2b62fa', group: 'Colors' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#ce9851', group: 'Colors' },
  { id: 'signalCooldownBars', type: 'int', title: 'Signal Cooldown (bars)', defval: 10, min: 1, max: 50, group: 'Signal Settings' },
  { id: 'signalMinChange', type: 'float', title: 'Min Change For New Signal', defval: 1.5, min: 0.5, max: 3.0, step: 0.1, group: 'Signal Settings' },
  { id: 'baseLength', type: 'int', title: 'Base Length', defval: 14, min: 2, group: 'AI Core' },
  { id: 'adaptiveSpeed', type: 'float', title: 'Adaptive Speed', defval: 0.1, min: 0.01, max: 0.3, step: 0.01, group: 'AI Core' },
  { id: 'lookbackPeriod', type: 'int', title: 'Learning Lookback Period', defval: 150, min: 10, group: 'AI Core' },
  { id: 'ensembleSize', type: 'int', title: 'Ensemble Size', defval: 5, min: 2, max: 5, group: 'AI Core' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Range Fill Level', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Lower Range Fill Level', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Zero Fill Level', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'AI Oscillator', color: '#2b62fa', lineWidth: 2 },
  { id: 'plot4', title: 'zero Line', color: String(color.new(color.gray, 100)), lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 6, title: 'Upper Range', color: String(color.new(color.gray, 70)), linestyle: 'dotted' },
  { id: 'hline_lower', price: -6, title: 'Lower Range', color: String(color.new(color.gray, 70)), linestyle: 'dotted' },
  { id: 'hline_zero', price: 0, title: 'Zero Line', color: String(color.new(color.gray, 50)), linestyle: 'dashed' },
];

export const metadata = {
  title: 'AI Adaptive Oscillator [PhenLabs]',
  shortTitle: 'PhenLabs - AIAO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

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

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface AiVars {
  /** aiOscillator[1] */
  prevAi: number;
  /** Running hit counts of the scores (one per oscillator), changed in place */
  correct: number[];
  lastBullishLevel: number;
  lastBearishLevel: number;
  barsSinceLastBullish: number;
  barsSinceLastBearish: number;
}

interface AiRun extends BarRunState<AiVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  cci: CciWindow;
  stoch: ReturnType<typeof taStep.stoch>;
  emaFast: ReturnType<typeof taStep.ema>;
  emaSlow: ReturnType<typeof taStep.ema>;
  macdSignal: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  change: ReturnType<typeof taStep.change>;
  volSma: ReturnType<typeof taStep.sma>;
  vmStdev: ReturnType<typeof taStep.stdev>;
  atrSma: ReturnType<typeof taStep.sma>;
  highestVf: WindowExtreme;
  lowestVf: WindowExtreme;
  /** The five oscillators per bar */
  oscs: number[][];
  /** Hits of the scores per bar (one array per oscillator) */
  hits: number[][];
  vf: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
  upperTop: string[];
  lowerBottom: string[];
  bullTop: (string | null)[];
  bullBottom: (string | null)[];
  bearTop: (string | null)[];
  bearBottom: (string | null)[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AiAdaptiveOscillatorInputs>): BarStudy<AiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.baseLength;
  const lookback = cfg.lookbackPeriod;
  const ens = cfg.ensembleSize;
  // array.push: RSI, CCI, Stochastic always; MACD when ensembleSize >= 4; volume when ensembleSize >= 5
  const size = 3 + (ens >= 4 ? 1 : 0) + (ens >= 5 ? 1 : 0);
  const used = Math.min(ens, size);
  const white = color.white;
  const texts = ['', ' ', '+', '++'];
  // plotshape ids by confidence (3: High, 2: Medium, 1: Average)
  const bullIds = ['', 'shape2', 'shape1', 'shape0'];
  const bearIds = ['', 'shape5', 'shape4', 'shape3'];
  const gray100 = String(color.new(color.gray, 100));
  const bear95 = String(color.new(cfg.bearishColor, 95));
  const bear30 = String(color.new(cfg.bearishColor, 30));
  const bull95 = String(color.new(cfg.bullishColor, 95));
  const bull30 = String(color.new(cfg.bullishColor, 30));
  const bull85 = String(color.new(cfg.bullishColor, 85));
  const bear85 = String(color.new(cfg.bearishColor, 85));
  // scratch values of the current bar (scores and oscillators)
  const score = [0, 0, 0, 0, 0];
  const osc = [0, 0, 0, 0, 0];
  const confidence = (isSignal: boolean, bullish: boolean, scoreAvg: number, vf: number, lowerThreshold: number, upperThreshold: number): number => {
    if (!isSignal) return 0;
    let agreement = 0.0;
    for (let k = 0; k < used; k++) {
      if ((bullish && gt(osc[k], 0)) || (!bullish && lt(osc[k], 0))) agreement = agreement + 1;
    }
    const agreementScore = agreement / ens;
    let strength = bullish ? Math.abs(vf / lowerThreshold) : Math.abs(vf / upperThreshold);
    strength = Math.min(strength, 1.5);
    const conf = scoreAvg * 0.5 + agreementScore * 0.3 + strength * 0.2;
    return ge(conf, 0.8) ? 3 : ge(conf, 0.6) ? 2 : 1;
  };
  return {
    init() {
      const fastLength = Math.round(len * 0.5);
      const s: AiRun = {
        rsi: taStep.rsi(len), cci: new CciWindow(len), stoch: taStep.stoch(len), emaFast: taStep.ema(fastLength),
        emaSlow: taStep.ema(len), macdSignal: taStep.ema(Math.round(len * 0.3)), atr: taStep.atr(len),
        change: taStep.change(len), volSma: taStep.sma(), vmStdev: taStep.stdev(), atrSma: taStep.sma(),
        highestVf: new WindowExtreme(false, lookback), lowestVf: new WindowExtreme(true, lookback),
        oscs: [[], [], [], [], []], hits: [[], [], [], [], []], vf: [], plot0: [], plot1: [], plot2: [], plot3: [],
        plot4: [], upperTop: [], lowerBottom: [], bullTop: [], bullBottom: [], bearTop: [], bearBottom: [],
        markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [], lists: [], series: [],
        vars: {
          prevAi: NaN, correct: [0, 0, 0, 0, 0], lastBullishLevel: NaN, lastBearishLevel: NaN,
          barsSinceLastBullish: 999, barsSinceLastBearish: 999,
        },
      };
      s.steps = [s.rsi, s.cci, s.stoch, s.emaFast, s.emaSlow, s.macdSignal, s.atr, s.change, s.volSma, s.vmStdev,
        s.atrSma, s.highestVf, s.lowestVf];
      s.lists = [s.markers, ...s.times];
      s.series = [...s.oscs, ...s.hits, s.vf, s.plot0, s.plot1, s.plot2, s.plot3, s.plot4, s.upperTop, s.lowerBottom,
        s.bullTop, s.bullBottom, s.bearTop, s.bearBottom, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const close = b.close;
      const volume = b.volume ?? NaN;

      // Ensemble components (plain divisions: x / 0 is +-infinity, 0 / 0 na, as in Pine)
      const rsiOsc = (s.rsi.step(close) - 50) / 50;
      const cciOsc = s.cci.step(close) / 200;
      const stochOsc = (s.stoch.step(close, b.high, b.low) - 50) / 50;
      const macdLine = s.emaFast.step(close) - s.emaSlow.step(close);
      const macdSignal = s.macdSignal.step(macdLine);
      const atr = s.atr.step(b.high, b.low, close);
      const macdOsc = (macdLine - macdSignal) / atr;
      const volumeMomentum = (s.change.step(close) * volume) / s.volSma.step(volume, len);
      const volumeOsc = volumeMomentum / s.vmStdev.step(volumeMomentum, len);
      s.oscs[0][i] = rsiOsc;
      s.oscs[1][i] = cciOsc;
      s.oscs[2][i] = stochOsc;
      s.oscs[3][i] = macdOsc;
      s.oscs[4][i] = volumeOsc;

      // getPerformanceScore(signal, length): share of the last `length` bars k where signal[k - 1] > 0 and
      // close[k] - close[k - 1] > 0, or both < 0 (a running count of the hits)
      const pc = i > 0 ? close - bars[i - 1].close : NaN;
      for (let k = 0; k < 5; k++) {
        let hit = 0;
        if (i > 0) {
          const sp = s.oscs[k][i - 1];
          hit = (gt(sp, 0) && gt(pc, 0)) || (lt(sp, 0) && lt(pc, 0)) ? 1 : 0;
        }
        s.hits[k][i] = hit;
        v.correct[k] += hit;
        if (i - lookback >= 0) v.correct[k] -= s.hits[k][i - lookback];
      }
      for (let k = 0; k < 5; k++) {
        score[k] = v.correct[k] / lookback;
        osc[k] = s.oscs[k][i];
      }

      let totalScore = 0;
      for (let k = 0; k < size; k++) totalScore += score[k];
      totalScore = Math.max(totalScore, 0.001);
      let ai = 0.0;
      for (let k = 0; k < used; k++) ai = ai + osc[k] * (score[k] / totalScore);
      // volatility = ta.atr(len) / ta.sma(ta.atr(len), len * 5)
      const volatility = atr / s.atrSma.step(atr, len * 5);
      const alpha = Math.min(0.9, Math.max(0.1, cfg.adaptiveSpeed * volatility));
      // nz(aiOscillator[1]): na and +-infinity give 0
      ai = ai * alpha + (Number.isFinite(v.prevAi) ? v.prevAi : 0) * (1 - alpha);
      v.prevAi = ai;
      const vf = ai * 6;
      s.vf[i] = vf;

      const upperThreshold = Math.min(6, s.highestVf.step(vf) * 0.8);
      const lowerThreshold = Math.max(-6, s.lowestVf.step(vf) * 0.8);

      // Signals
      v.barsSinceLastBullish = v.barsSinceLastBullish + 1;
      v.barsSinceLastBearish = v.barsSinceLastBearish + 1;
      const v1 = i >= 1 ? s.vf[i - 1] : NaN;
      const v2 = i >= 2 ? s.vf[i - 2] : NaN;
      const bullishPattern = lt(vf, lowerThreshold) && gt(vf, v1) && lt(v1, v2);
      const bearishPattern = gt(vf, upperThreshold) && lt(vf, v1) && gt(v1, v2);
      const bullishSignal = bullishPattern && v.barsSinceLastBullish >= cfg.signalCooldownBars
        && (isNaN(v.lastBullishLevel) || ge(Math.abs(vf - v.lastBullishLevel), cfg.signalMinChange));
      const bearishSignal = bearishPattern && v.barsSinceLastBearish >= cfg.signalCooldownBars
        && (isNaN(v.lastBearishLevel) || ge(Math.abs(vf - v.lastBearishLevel), cfg.signalMinChange));
      if (bullishSignal) {
        v.lastBullishLevel = vf;
        v.barsSinceLastBullish = 0;
      }
      if (bearishSignal) {
        v.lastBearishLevel = vf;
        v.barsSinceLastBearish = 0;
      }
      const avgScore = (score[0] + score[1] + score[2] + (ens >= 4 ? score[3] : 0)
        + (ens >= 5 ? score[4] : 0)) / ens;
      const bullC = confidence(bullishSignal, true, avgScore, vf, lowerThreshold, upperThreshold);
      const bearC = confidence(bearishSignal, false, avgScore, vf, lowerThreshold, upperThreshold);
      // plotshape(bullishSignal and bullishConfidence == k ? vf : na, shape.labelup, location.absolute, size.small)
      if (bullishSignal && !isNaN(vf)) {
        s.markers.push({ id: bullIds[bullC], time: b.time, position: 'atPriceBottom', price: vf, shape: 'labelUp',
          color: cfg.bullishColor, text: texts[bullC], textColor: white, size: 'small' });
      }
      // plotshape(bearishSignal and bearishConfidence == k ? vf : na, shape.labeldown, location.absolute, size.small)
      if (bearishSignal && !isNaN(vf)) {
        s.markers.push({ id: bearIds[bearC], time: b.time, position: 'atPriceTop', price: vf, shape: 'labelDown',
          color: cfg.bearishColor, text: texts[bearC], textColor: white, size: 'small' });
      }

      const t = b.time;
      const pos = gt(vf, 0);
      const neg = lt(vf, 0);
      // f = plot(6, display = display.none), negf = plot(-6, ...), z = plot(0, ...)
      s.plot0[i] = { time: t, value: 6 };
      s.plot1[i] = { time: t, value: -6 };
      s.plot2[i] = { time: t, value: 0 };
      // plot(vf, color = vf > 0 ? bullishColor : bearishColor, linewidth = 2)
      s.plot3[i] = { time: t, value: Number.isFinite(vf) ? vf : NaN, color: pos ? cfg.bullishColor : cfg.bearishColor };
      // p1 = plot(level, 'zero Line', color.new(color.gray, 100))
      s.plot4[i] = { time: t, value: 0, color: gray100 };
      s.upperTop[i] = String(color.from_gradient(vf, -6, 6, bear95, bear30));
      s.lowerBottom[i] = String(color.from_gradient(-vf, -6, 6, bull95, bull30));
      s.bullTop[i] = pos ? bull85 : null;
      s.bullBottom[i] = pos ? cfg.bullishColor : null;
      s.bearTop[i] = neg ? cfg.bearishColor : null;
      s.bearBottom[i] = neg ? bear85 : null;

      // alertcondition(ta.cross(vf, 0)) / (bullishSignal) / (bearishSignal)
      const cross = (vf > 0 && v1 <= 0) || (vf < 0 && v1 >= 0);
      s.flags[0][i] = cross;
      s.flags[1][i] = bullishSignal;
      s.flags[2][i] = bearishSignal;
      if (cross) s.times[0].push(t as number);
      if (bullishSignal) s.times[1].push(t as number);
      if (bearishSignal) s.times[2].push(t as number);
    },
    copyVars: (v) => ({ ...v, correct: v.correct.slice() }),
    result(s, bars) {
      const n = bars.length;
      // Fills
      const full = (x: number) => new Array<number>(n).fill(x);
      const nulls = () => new Array<string | null>(n).fill(null);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
        hlines: [
          { value: 6, options: { title: 'Upper Range', color: String(color.new(color.gray, 70)), linestyle: 'dotted' } },
          { value: -6, options: { title: 'Lower Range', color: String(color.new(color.gray, 70)), linestyle: 'dotted' } },
          { value: 0, options: { title: 'Zero Line', color: String(color.new(color.gray, 50)), linestyle: 'dashed' } },
        ],
        fills: [
          // fill(z, f, top_value = 6, bottom_value = 3, bottom_color = na,
          //      top_color = color.from_gradient(vf, -6, 6, color.new(bearishColor, 95), color.new(bearishColor, 30)))
          { plot1: 'plot2', plot2: 'plot0', options: { title: 'Upper Zone' },
            gradient: { topValue: full(6), bottomValue: full(3), topColor: s.upperTop.slice(), bottomColor: nulls() } },
          // fill(z, negf, top_value = -3, bottom_value = -6, top_color = na,
          //      bottom_color = color.from_gradient(-vf, -6, 6, color.new(bullishColor, 95), color.new(bullishColor, 30)))
          { plot1: 'plot2', plot2: 'plot1', options: { title: 'Lower Zone' },
            gradient: { topValue: full(-3), bottomValue: full(-6), topColor: nulls(), bottomColor: s.lowerBottom.slice() } },
          // fill(p1, v1, level, vf, vf > 0 ? color.new(bullishColor, 85) : na, vf > 0 ? bullishColor : na)
          { plot1: 'plot4', plot2: 'plot3', options: { title: 'Bullish Area' },
            gradient: { topValue: full(0), bottomValue: s.vf.slice(), topColor: s.bullTop.slice(), bottomColor: s.bullBottom.slice() } },
          // fill(p1, v1, vf, -level, vf < 0 ? bearishColor : na, vf < 0 ? color.new(bearishColor, 85) : na)
          { plot1: 'plot4', plot2: 'plot3', options: { title: 'Bearish Area' },
            gradient: { topValue: s.vf.slice(), bottomValue: full(0), topColor: s.bearTop.slice(), bottomColor: s.bearBottom.slice() } },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AiAdaptiveOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AiAdaptiveOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'AI Oscillator Zero Line Cross', message: 'AI Oscillator crossed the zero line' },
  { id: 'alert1', title: 'AI Oscillator Bullish Signal', message: 'AI Oscillator shows potential bullish move' },
  { id: 'alert2', title: 'AI Oscillator Bearish Signal', message: 'AI Oscillator shows potential bearish move' },
];

export const AiAdaptiveOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  alertConditions,
};
