/**
 * MACD Sniper
 *
 * MACD with a choice of moving average for the oscillator and the signal line (SMA, EMA, WMA, VWMA, KAMA, HMA, ZLEMA,
 * TEMA, ALMA, DEMA). Histogram signals: a buy when the histogram rises below zero after at least `min falling bars`
 * bars of falling negative values, a sell when it falls above zero after `min growing bars` bars of growing positive
 * values; one signal per histogram phase. MA signals: crosses of the MACD and the signal line. Both kinds wait a
 * re-entry pause after the last signal and can be filtered by RSI, MFI, Stochastic and Supertrend ranges and by an
 * alternation rule (wait for the opposite signal). Signals are drawn as triangles on the price chart (Buy / Sell) and
 * at the top / bottom of the MACD pane (H / MA). A hidden connector plot gives 1 (buy), -1 (sell) or 0.
 * Alerts (alertcondition, `alerts` of the result): 'MACD Buy Signal' / 'MACD Sell Signal', true on the bars of an
 * enabled histogram or MA buy / sell signal.
 *
 * Reference: "MACD Sniper [trade_lexx]" by trade_lexx
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

const MA_TYPES = ['SMA', 'EMA', 'WMA', 'VWMA', 'KAMA', 'HMA', 'ZLEMA', 'TEMA', 'ALMA', 'DEMA'] as const;
export type MacdSniperMaType = (typeof MA_TYPES)[number];

export interface MacdSniperInputs {
  useHistSignals: boolean;
  useMaSignals: boolean;
  minFallingBars: number;
  minGrowingBars: number;
  /** Re-entry pause (bars) after a signal */
  minBarsBetweenSignals: number;
  /** Only alternate buy / sell signals */
  waitForOppositeSignal: boolean;
  useSupertrendFilter: boolean;
  atrPeriod: number;
  factor: number;
  plotSupertrend: boolean;
  useRsiFilter: boolean;
  rsiLength: number;
  overboughtLowerLevel: number;
  overboughtUpperLevel: number;
  oversoldLowerLevel: number;
  oversoldUpperLevel: number;
  useMfiFilter: boolean;
  mfiLength: number;
  mfiOverboughtLowerLevel: number;
  mfiOverboughtUpperLevel: number;
  mfiOversoldLowerLevel: number;
  mfiOversoldUpperLevel: number;
  useStochFilter: boolean;
  stochLength: number;
  stochOverboughtLowerLevel: number;
  stochOverboughtUpperLevel: number;
  stochOversoldLowerLevel: number;
  stochOversoldUpperLevel: number;
  /** Oscillator MA type */
  smaSource: MacdSniperMaType;
  /** Signal line MA type */
  smaSignal: MacdSniperMaType;
  src: SourceType;
  signalLength: number;
  fastLength: number;
  slowLength: number;
}

export const defaultInputs: MacdSniperInputs = {
  useHistSignals: true,
  useMaSignals: true,
  minFallingBars: 3,
  minGrowingBars: 3,
  minBarsBetweenSignals: 5,
  waitForOppositeSignal: false,
  useSupertrendFilter: false,
  atrPeriod: 10,
  factor: 0.6,
  plotSupertrend: false,
  useRsiFilter: true,
  rsiLength: 14,
  overboughtLowerLevel: 70,
  overboughtUpperLevel: 100,
  oversoldLowerLevel: 1,
  oversoldUpperLevel: 35,
  useMfiFilter: false,
  mfiLength: 14,
  mfiOverboughtLowerLevel: 70,
  mfiOverboughtUpperLevel: 100,
  mfiOversoldLowerLevel: 1,
  mfiOversoldUpperLevel: 30,
  useStochFilter: false,
  stochLength: 14,
  stochOverboughtLowerLevel: 70,
  stochOverboughtUpperLevel: 120,
  stochOversoldLowerLevel: 1,
  stochOversoldUpperLevel: 30,
  smaSource: 'EMA',
  smaSignal: 'EMA',
  src: 'close',
  signalLength: 9,
  fastLength: 12,
  slowLength: 26,
};

const G1 = 'Settings Signals';
const G2 = 'Filters';
const G4 = 'MACD Settings';

export const inputConfig: InputConfig[] = [
  { id: 'useHistSignals', type: 'bool', title: 'Histogram Signals', defval: true, group: G1 },
  { id: 'useMaSignals', type: 'bool', title: 'MA Signals', defval: true, group: G1 },
  { id: 'minFallingBars', type: 'int', title: 'Min ⬇Falling Bars', defval: 3, min: 1, group: G1 },
  { id: 'minGrowingBars', type: 'int', title: 'Min ⬆Growing Bars', defval: 3, min: 1, group: G1 },
  { id: 'minBarsBetweenSignals', type: 'int', title: 'Reentry pause', defval: 5, min: 1, group: G2 },
  { id: 'waitForOppositeSignal', type: 'bool', title: 'Wait Opposite', defval: false, group: G2 },
  { id: 'useSupertrendFilter', type: 'bool', title: 'Supertrend Filter ⮕', defval: false, group: G2 },
  { id: 'atrPeriod', type: 'int', title: 'Supertrend Length', defval: 10, min: 1, group: G2 },
  { id: 'factor', type: 'float', title: 'Supertrend Factor', defval: 0.6, min: 0.01, step: 0.1, group: G2 },
  { id: 'plotSupertrend', type: 'bool', title: 'Plot Supertrend', defval: false, group: G2 },
  { id: 'useRsiFilter', type: 'bool', title: 'RSI Filter ⮕', defval: true, group: G2 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1, group: G2 },
  { id: 'overboughtLowerLevel', type: 'int', title: 'RSI 🪫 Sell ⮕ Above⬆', defval: 70, min: 0, max: 100, group: G2 },
  { id: 'overboughtUpperLevel', type: 'int', title: 'RSI Sell Below⬇', defval: 100, min: 0, max: 100, group: G2 },
  { id: 'oversoldLowerLevel', type: 'int', title: 'RSI 🔋 Buy ⮕ Above⬆', defval: 1, min: 0, max: 100, group: G2 },
  { id: 'oversoldUpperLevel', type: 'int', title: 'RSI Buy Below⬇', defval: 35, min: 0, max: 100, group: G2 },
  { id: 'useMfiFilter', type: 'bool', title: 'MFI Filter ⮕', defval: false, group: G2 },
  { id: 'mfiLength', type: 'int', title: 'MFI Length', defval: 14, min: 1, group: G2 },
  { id: 'mfiOverboughtLowerLevel', type: 'int', title: 'MFI 🪫 Sell ⮕ Above⬆', defval: 70, min: 0, max: 100, group: G2 },
  { id: 'mfiOverboughtUpperLevel', type: 'int', title: 'MFI Sell Below⬇', defval: 100, min: 0, max: 100, group: G2 },
  { id: 'mfiOversoldLowerLevel', type: 'int', title: 'MFI 🔋 Buy ⮕ Above⬆', defval: 1, min: 0, max: 100, group: G2 },
  { id: 'mfiOversoldUpperLevel', type: 'int', title: 'MFI Buy Below⬇', defval: 30, min: 0, max: 100, group: G2 },
  { id: 'useStochFilter', type: 'bool', title: 'Stoch Filter ⮕', defval: false, group: G2 },
  { id: 'stochLength', type: 'int', title: 'Stoch Length', defval: 14, min: 1, group: G2 },
  { id: 'stochOverboughtLowerLevel', type: 'int', title: 'Stoch 🪫 Sell ⮕ Above⬆', defval: 70, min: 0, max: 100, group: G2 },
  { id: 'stochOverboughtUpperLevel', type: 'int', title: 'Stoch Sell Below⬇', defval: 120, min: 0, max: 120, group: G2 },
  { id: 'stochOversoldLowerLevel', type: 'int', title: 'Stoch 🔋 Buy ⮕ Above⬆', defval: 1, min: 0, max: 100, group: G2 },
  { id: 'stochOversoldUpperLevel', type: 'int', title: 'Stoch Buy Below⬇', defval: 30, min: 0, max: 100, group: G2 },
  { id: 'smaSource', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: [...MA_TYPES], group: G4 },
  { id: 'smaSignal', type: 'string', title: 'Signal Line MA Type', defval: 'EMA', options: [...MA_TYPES], group: G4 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: G4 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, max: 50, group: G4 },
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, group: G4 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, group: G4 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Supertrend', color: color.green, lineWidth: 1, style: 'linebr', forceOverlay: true },
  { id: 'plot1', title: 'Histogram', color: '#26A69A', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'MACD', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot4', title: '🔌Connector🔌', color: String(color.new(color.white, 100)), lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'MACD Sniper [trade_lexx]',
  shortTitle: 'MACD Sniper [trade_lexx]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** Pine `for i = a to b`: counts up, or down when a > b */
function pineRange(a: number, b: number): number[] {
  const out: number[] = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
}

/** A moving average stepped once or more per bar (the bar gives the volume and the prices of the ATR) */
interface MaStep extends Committable {
  step(value: number, bar: Bar): number;
}

const wrap = (m: { step(v: number): number; commit(): void }): MaStep => ({ step: (v) => m.step(v), commit: () => m.commit() });

/**
 * kama(source, length): `var float sma_val = ta.sma(source, length)` is set on the first bar only, so the line
 * starts from the SMA of the first bar (na unless length is 1) and stays na while it is na
 */
class KamaStep implements MaStep {
  private readonly sma = taStep.sma();
  private readonly volatility = taStep.stdev();
  private readonly atr: ReturnType<typeof taStep.atr>;
  private count = 0;
  private smaVal = NaN;
  private k = NaN;
  private nextSma = NaN;
  private nextK = NaN;
  private stepped = false;

  constructor(private readonly length: number) {
    this.atr = taStep.atr(length);
  }

  step(value: number, bar: Bar): number {
    this.stepped = true;
    this.nextSma = this.count === 0 ? this.sma.step(value, this.length) : this.smaVal;
    const er = this.volatility.step(value, this.length) / this.atr.step(bar.high, bar.low, bar.close);
    // sc := math.max(0.666, math.min(0.0645, math.pow(efficiency_ratio, 2))): na stays na
    const sc = Math.max(0.666, Math.min(0.0645, Math.pow(er, 2)));
    this.nextK = isNaN(this.k) ? this.nextSma : sc * value + (1 - sc) * this.k;
    return this.nextK;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    if (this.count === 0) this.sma.commit();
    this.volatility.commit();
    this.atr.commit();
    this.smaVal = this.nextSma;
    this.k = this.nextK;
    this.count++;
  }
}

/** ZLEMA: ema[lag] with lag = (length - 1) / 2 (the fractional history offset is truncated) */
class LaggedEmaStep implements MaStep {
  private readonly ema: ReturnType<typeof taStep.ema>;
  private readonly values: number[] = [];
  private current = NaN;
  private stepped = false;

  constructor(length: number, private readonly lag: number) {
    this.ema = taStep.ema(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.current = this.ema.step(value);
    const j = this.values.length - this.lag;
    return j < 0 ? NaN : j === this.values.length ? this.current : this.values[j]!;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.ema.commit();
    this.values.push(this.current);
  }
}

/** ta.alma(source, length, 0.85, 6): the weighted sum of the last `length` values, in the order of the oakscriptjs function */
class AlmaStep implements MaStep {
  private readonly weights: number[] = [];
  private readonly values: number[] = [];
  private current = NaN;
  private stepped = false;

  constructor(private readonly length: number, offset: number, sigma: number) {
    checkAlmaLength(length);
    const m = offset * (length - 1);
    const s = length / sigma;
    let weightSum = 0;
    for (let i = 0; i < length; i++) {
      const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
      this.weights.push(weight);
      weightSum += weight;
    }
    for (let i = 0; i < length; i++) this.weights[i]! /= weightSum;
  }

  step(value: number): number {
    this.stepped = true;
    this.current = value;
    const i = this.values.length;
    const length = this.length;
    if (i < length - 1) return NaN;
    let almaValue = 0;
    for (let j = 0; j < length; j++) {
      const k = i - length + 1 + j;
      almaValue += (k === i ? value : this.values[k]!) * this.weights[j]!;
    }
    return almaValue;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.current);
  }
}

/** The length check of ta.alma (an error for a length below 1) */
function checkAlmaLength(length: number): void {
  taCore.alma([], length, 0.85, 6);
}

/** EMA chains: TEMA 3 * e1 - 3 * e2 + e3, DEMA 2 * e1 - e2 */
class EmaChainStep implements MaStep {
  private readonly e1: ReturnType<typeof taStep.ema>;
  private readonly e2: ReturnType<typeof taStep.ema>;
  private readonly e3: ReturnType<typeof taStep.ema> | null;

  constructor(length: number, triple: boolean) {
    this.e1 = taStep.ema(length);
    this.e2 = taStep.ema(length);
    this.e3 = triple ? taStep.ema(length) : null;
  }

  step(value: number): number {
    const v1 = this.e1.step(value);
    const v2 = this.e2.step(v1);
    if (!this.e3) return 2 * v1 - v2;
    const v3 = this.e3.step(v2);
    return 3 * v1 - 3 * v2 + v3;
  }

  commit(): void {
    this.e1.commit();
    this.e2.commit();
    this.e3?.commit();
  }
}

/** All na (an unknown type) */
const naStep: MaStep = { step: () => NaN, commit: () => {} };

function maStep(length: number, type: MacdSniperMaType): MaStep {
  switch (type) {
    case 'SMA': { const m = taStep.sma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'EMA': return wrap(taStep.ema(length));
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'VWMA': { const m = taStep.vwma(length); return { step: (v, b) => m.step(v, b.volume ?? NaN), commit: () => m.commit() }; }
    case 'KAMA': return new KamaStep(length);
    case 'HMA': return wrap(taStep.hma(length));
    case 'ZLEMA': {
      const lag = Math.trunc((length - 1) / 2);
      if (lag < 0) throw new Error(`Invalid number of bars back: ${lag}`);
      return new LaggedEmaStep(length, lag);
    }
    case 'TEMA': return new EmaChainStep(length, true);
    case 'ALMA': return new AlmaStep(length, 0.85, 6);
    case 'DEMA': return new EmaChainStep(length, false);
    default: return naStep;
  }
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface SniperVars {
  lastSignalBar: number; // var int last_signal_bar = na
  lastSignal: number; // var int last_signal = na
  histIncreasing: boolean;
  histDecreasing: boolean;
  buySignalGiven: boolean;
  sellSignalGiven: boolean;
  plotHistBuy: boolean;
  plotHistSell: boolean;
  plotMaBuy: boolean;
  plotMaSell: boolean;
}

interface SniperRun extends BarRunState<SniperVars> {
  fast: MaStep;
  slow: MaStep;
  signal: MaStep;
  rsi: ReturnType<typeof taStep.rsi>;
  mfi: ReturnType<typeof taStep.mfi>;
  stoch: ReturnType<typeof taStep.stoch>;
  st: ReturnType<typeof taStep.supertrend>;
  macd: number[];
  signalArr: number[];
  hist: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MacdSniperInputs>): BarStudy<SniperRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const hlc3 = barSource('hlc3');
  const inRange = (v: number, lo: number, hi: number) => ge(v, lo) && le(v, hi);
  const growingRange = pineRange(1, cfg.minGrowingBars);
  const fallingRange = pineRange(1, cfg.minFallingBars);
  const checkIndex = (k: number) => {
    if (k < 0) throw new Error(`Invalid number of bars back: ${k}`);
  };
  const green = color.green;
  const red = color.red;
  const textColor = color.blue; // Pine plotshape default text colour
  const connectorColor = String(color.new(color.white, 100));
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  // id: the plotshape output (shape0 .. shape7 in declaration order)
  const shape = (s: SniperRun, t: number, on: boolean, buy: boolean, onPrice: boolean, text: string, id: string) => {
    if (!on) return;
    s.markers.push({
      time: t,
      position: onPrice ? (buy ? 'belowBar' : 'aboveBar') : buy ? 'bottom' : 'top',
      shape: buy ? 'triangleUp' : 'triangleDown',
      color: buy ? green : red,
      text,
      textColor,
      ...(onPrice ? { forceOverlay: true } : {}),
      id,
    });
  };
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const fast = maStep(cfg.fastLength, cfg.smaSource);
      const slow = maStep(cfg.slowLength, cfg.smaSource);
      const signal = maStep(cfg.signalLength, cfg.smaSignal);
      const rsi = taStep.rsi(cfg.rsiLength);
      const mfi = taStep.mfi(cfg.mfiLength);
      const stoch = taStep.stoch(cfg.stochLength);
      const st = taStep.supertrend(cfg.factor, cfg.atrPeriod);
      const s: SniperRun = {
        fast, slow, signal, rsi, mfi, stoch, st,
        macd: [], signalArr: [], hist: [],
        plots: Array.from({ length: 5 }, () => []),
        markers: [], flags: [[], []], times: [[], []],
        steps: [fast, slow, signal, rsi, mfi, stoch, st],
        vars: {
          lastSignalBar: NaN, lastSignal: NaN, histIncreasing: false, histDecreasing: false, buySignalGiven: false,
          sellSignalGiven: false, plotHistBuy: false, plotHistSell: false, plotMaBuy: false, plotMaSell: false,
        },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.macd, s.signalArr, s.hist, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = value(b);
      const macd = s.fast.step(src, b) - s.slow.step(src, b);
      const signal = s.signal.step(macd, b);
      const h = macd - signal;
      s.macd[i] = macd;
      s.signalArr[i] = signal;
      s.hist[i] = h;
      const histAt = (k: number) => (i - k >= 0 ? s.hist[i - k] : NaN);
      const rsi = s.rsi.step(src);
      const mfi = s.mfi.step(hlc3(b), b.volume ?? NaN);
      const stoch = s.stoch.step(b.close, b.high, b.low);
      const [supertrend, direction] = s.st.step(b.high, b.low, b.close);

      const h1 = histAt(1);
      const prevIncreasing = v.histIncreasing; // hist_increasing[1]
      const prevDecreasing = v.histDecreasing; // hist_decreasing[1]
      if (gt(h, h1)) {
        v.histIncreasing = true;
        v.histDecreasing = false;
      } else if (lt(h, h1)) {
        v.histIncreasing = false;
        v.histDecreasing = true;
      }
      if (v.histIncreasing && prevDecreasing) v.buySignalGiven = false;
      if (v.histDecreasing && prevIncreasing) v.sellSignalGiven = false;
      // is_growing_above_zero(n) / is_falling_below_zero(n): na history values do not reset the flag
      let growing = true;
      for (const k of growingRange) {
        checkIndex(k);
        if (le(histAt(k), histAt(k + 1)) || le(histAt(k), 0)) growing = false;
      }
      let falling = true;
      for (const k of fallingRange) {
        checkIndex(k);
        if (ge(histAt(k), histAt(k + 1)) || ge(histAt(k), 0)) falling = false;
      }
      const newSignalAllowed = isNaN(v.lastSignalBar) || i - v.lastSignalBar > cfg.minBarsBetweenSignals;
      let preciseBuy: boolean = newSignalAllowed && !v.buySignalGiven && v.histIncreasing && lt(h1, 0) && lt(h, 0) && gt(h, h1) && falling;
      let preciseSell: boolean = newSignalAllowed && !v.sellSignalGiven && v.histDecreasing && gt(h1, 0) && gt(h, 0) && lt(h, h1) && growing;
      const filters = (buy: boolean, sell: boolean): [boolean, boolean] => {
        if (cfg.useRsiFilter) {
          buy = buy && inRange(rsi, cfg.oversoldLowerLevel, cfg.oversoldUpperLevel);
          sell = sell && inRange(rsi, cfg.overboughtLowerLevel, cfg.overboughtUpperLevel);
        }
        if (cfg.useMfiFilter) {
          buy = buy && inRange(mfi, cfg.mfiOversoldLowerLevel, cfg.mfiOversoldUpperLevel);
          sell = sell && inRange(mfi, cfg.mfiOverboughtLowerLevel, cfg.mfiOverboughtUpperLevel);
        }
        if (cfg.useStochFilter) {
          buy = buy && inRange(stoch, cfg.stochOversoldLowerLevel, cfg.stochOversoldUpperLevel);
          sell = sell && inRange(stoch, cfg.stochOverboughtLowerLevel, cfg.stochOverboughtUpperLevel);
        }
        if (cfg.useSupertrendFilter) {
          buy = buy && gt(direction, 0);
          sell = sell && lt(direction, 0);
        }
        if (cfg.waitForOppositeSignal) {
          buy = buy && (isNaN(v.lastSignal) || v.lastSignal === -1);
          sell = sell && (isNaN(v.lastSignal) || v.lastSignal === 1);
        }
        return [buy, sell];
      };
      [preciseBuy, preciseSell] = filters(preciseBuy, preciseSell);
      if (preciseBuy || preciseSell) {
        v.lastSignalBar = i;
        v.lastSignal = preciseBuy ? 1 : -1;
        v.buySignalGiven = preciseBuy;
        v.sellSignalGiven = preciseSell;
      }
      // ta.crossover / ta.crossunder(macd, signal): exact comparisons
      const crossUp = i > 0 && macd > signal && s.macd[i - 1] <= s.signalArr[i - 1];
      const crossDown = i > 0 && macd < signal && s.macd[i - 1] >= s.signalArr[i - 1];
      let maBuy = newSignalAllowed && crossUp;
      let maSell = newSignalAllowed && crossDown;
      [maBuy, maSell] = filters(maBuy, maSell);
      if (maBuy || maSell) {
        v.lastSignalBar = i;
        v.lastSignal = maBuy ? 1 : -1;
      }
      if (cfg.useHistSignals) {
        v.plotHistBuy = preciseBuy;
        v.plotHistSell = preciseSell;
      }
      if (cfg.useMaSignals) {
        v.plotMaBuy = maBuy;
        v.plotMaSell = maSell;
      }
      const finalBuy = (cfg.useHistSignals && preciseBuy) || (cfg.useMaSignals && maBuy);
      const finalSell = (cfg.useHistSignals && preciseSell) || (cfg.useMaSignals && maSell);
      const finalSignal = finalBuy ? 1 : finalSell ? -1 : 0;
      const t = b.time;
      s.flags[0][i] = finalBuy;
      s.flags[1][i] = finalSell;
      if (finalBuy) s.times[0].push(t as number);
      if (finalSell) s.times[1].push(t as number);
      shape(s, t, v.plotHistBuy, true, true, 'Buy', 'shape0');
      shape(s, t, v.plotHistSell, false, true, 'Sell', 'shape1');
      shape(s, t, v.plotHistBuy, true, false, 'H', 'shape2');
      shape(s, t, v.plotHistSell, false, false, 'H', 'shape3');
      shape(s, t, v.plotMaBuy, true, true, 'Buy', 'shape4');
      shape(s, t, v.plotMaSell, false, true, 'Sell', 'shape5');
      shape(s, t, v.plotMaBuy, true, false, 'MA', 'shape6');
      shape(s, t, v.plotMaSell, false, false, 'MA', 'shape7');

      const histColor = ge(h, 0) ? (lt(h1, h) ? '#26A69A' : '#B2DFDB') : lt(h1, h) ? '#FFCDD2' : '#FF5252';
      // plot(plot_supertrend ? supertrend : na, "Supertrend", direction < 0 ? green : red, style_linebr, force_overlay)
      s.plots[0][i] = { time: t, value: cfg.plotSupertrend ? finite(supertrend) : NaN, color: lt(direction, 0) ? green : red };
      s.plots[1][i] = { time: t, value: finite(h), color: histColor };
      s.plots[2][i] = { time: t, value: finite(macd), color: '#2962FF' };
      s.plots[3][i] = { time: t, value: finite(signal), color: '#FF6D00' };
      s.plots[4][i] = { time: t, value: finalSignal, color: connectorColor };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: String(color.new('#787B86', 50)), linestyle: 'dashed' } }],
        markers: s.markers.slice(),
        // alertcondition(final_buy_signal, ...) / alertcondition(final_sell_signal, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdSniperInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MacdSniperInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'MACD Buy Signal', message: 'MACD Buy Signal Triggered' },
  { id: 'alert1', title: 'MACD Sell Signal', message: 'MACD Sell Signal Triggered' },
];

export const MacdSniper = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
