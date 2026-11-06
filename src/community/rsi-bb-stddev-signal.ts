/**
 * RSI BB StdDev Signal
 *
 * RSI (RMA of the gains and losses) with a moving average of the RSI and Bollinger Bands on the RSI (a moving average
 * +/- a multiple of the standard deviation; 10 average types). Buy / sell signals: the RSI crossing over / under the
 * MA, crossing over the lower band / under the upper band, and regular divergences between RSI pivots (5 left, 1
 * right) and price. Filters: an RSI zone for buys and one for sells, a minimum number of bars between two signals of
 * the same side, waiting for the opposite signal, and an AND mode (signals only when two or three kinds agree).
 * Signals are drawn in the RSI pane and on the price chart; a connector plot gives 1 (buy), -1 (sell) or 0.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' and 'Sell Signal', true on the bars of the final buy
 * / sell signal (the one the connector gives). The two "Div" divergence labels on the pivot bar are hidden by
 * default.
 *
 * Reference: "RSI BB StdDev Signal" by trade_lexx (Pine title "RSI Signal [trade_lexx]")
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, WindowSma, WindowStdev, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

type MaType = 'SMA' | 'EMA' | 'WMA' | 'HMA' | 'KAMA' | 'VWMA' | 'ALMA' | 'TEMA' | 'ZLEMA' | 'LSMA';

export interface RsiBbStddevSignalInputs {
  /** Moving Average signal on / off */
  maModeInput: boolean;
  maTypeInput: MaType;
  maLengthInput: number;
  /** Bollinger Bands signal on / off */
  bbModeInput: boolean;
  bbTypeInput: Exclude<MaType, 'KAMA'>;
  bbLengthInput: number;
  /** Standard deviation multiplier of the bands */
  bbMultInput: number;
  /** Divergence signal on / off */
  divergenceModeInput: boolean;
  /** RSI zone filter on / off */
  overboughtOversold: boolean;
  rsiSourceInput: SourceType;
  rsiLengthInput: number;
  /** Sell signals: RSI above this level */
  overboughtLowerLevel: number;
  /** Sell signals: RSI below this level */
  overboughtUpperLevel: number;
  /** Buy signals: RSI above this level */
  oversoldLowerLevel: number;
  /** Buy signals: RSI below this level */
  oversoldUpperLevel: number;
  /** Minimum bars between two signals of the same side */
  minBarsBetweenSignals: number;
  waitForOppositeSignal: boolean;
  andMode: boolean;
}

export const defaultInputs: RsiBbStddevSignalInputs = {
  maModeInput: true,
  maTypeInput: 'SMA',
  maLengthInput: 14,
  bbModeInput: true,
  bbTypeInput: 'SMA',
  bbLengthInput: 14,
  bbMultInput: 2.0,
  divergenceModeInput: true,
  overboughtOversold: true,
  rsiSourceInput: 'close',
  rsiLengthInput: 14,
  overboughtLowerLevel: 60,
  overboughtUpperLevel: 80,
  oversoldLowerLevel: 20,
  oversoldUpperLevel: 40,
  minBarsBetweenSignals: 5,
  waitForOppositeSignal: false,
  andMode: false,
};

const G1 = '🔧 Signal Settings 🔧';
const G2 = '🛠 Filters 🛠';

export const inputConfig: InputConfig[] = [
  { id: 'maModeInput', type: 'bool', title: 'Moving Average Signal ⮕', defval: true, group: G1, inline: 'MA', display: 'data_window' },
  { id: 'maTypeInput', type: 'string', title: 'Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'HMA', 'KAMA', 'VWMA', 'ALMA', 'TEMA', 'ZLEMA', 'LSMA'], group: G1, inline: 'MA', display: 'data_window' },
  { id: 'maLengthInput', type: 'int', title: 'Length', defval: 14, group: G1, inline: 'MA', display: 'data_window' },
  { id: 'bbModeInput', type: 'bool', title: 'Bollinger Bands Signal ⮕', defval: true, group: G1, inline: 'signal', display: 'data_window' },
  { id: 'bbTypeInput', type: 'string', title: 'Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'HMA', 'VWMA', 'ALMA', 'TEMA', 'ZLEMA', 'LSMA'], group: G1, inline: 'signal', display: 'data_window' },
  { id: 'bbLengthInput', type: 'int', title: 'Length', defval: 14, group: G1, inline: 'signal', display: 'data_window' },
  { id: 'bbMultInput', type: 'float', title: 'StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.1, group: G1, inline: 'signal', display: 'data_window' },
  { id: 'divergenceModeInput', type: 'bool', title: 'Divergence Signal', defval: true, group: G1, inline: 'Div', display: 'data_window' },
  { id: 'overboughtOversold', type: 'bool', title: 'RSI Filter ⮕', defval: true, group: G2, inline: 'RSI' },
  { id: 'rsiSourceInput', type: 'source', title: 'Source', defval: 'close', group: G2, inline: 'RSI' },
  { id: 'rsiLengthInput', type: 'int', title: 'Length', defval: 14, min: 1, group: G2, inline: 'RSI', tooltip: 'This mode works with MA, BB, Div signals' },
  { id: 'overboughtLowerLevel', type: 'int', title: '🪫 Sell ⮕ Above⬆', defval: 60, min: 0, max: 100, group: G2, inline: 'overbought', tooltip: 'For Sell signals' },
  { id: 'overboughtUpperLevel', type: 'int', title: 'Below⬇', defval: 80, min: 0, max: 100, group: G2, inline: 'overbought', tooltip: 'For Sell signals' },
  { id: 'oversoldLowerLevel', type: 'int', title: '🔋 Buy ⮕ Above⬆', defval: 20, min: 0, max: 100, group: G2, inline: 'oversold', tooltip: 'For Buy signals' },
  { id: 'oversoldUpperLevel', type: 'int', title: 'Below⬇', defval: 40, min: 0, max: 100, group: G2, inline: 'oversold', tooltip: 'For Buy signals' },
  { id: 'minBarsBetweenSignals', type: 'int', title: 'Reentry pause', defval: 5, min: 0, group: G2, inline: 'wait' },
  { id: 'waitForOppositeSignal', type: 'bool', title: 'Wait Opposite', defval: false, group: G2, inline: 'wait' },
  { id: 'andMode', type: 'bool', title: 'AND Mode', defval: false, group: G2, inline: 'wait', display: 'data_window' },
];

const NONE_COLOR = String(color.new(color.white, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 1 },
  { id: 'plot1', title: 'RSI-based MA', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'Lower Bollinger Band', color: color.green, lineWidth: 1 },
  { id: 'plot4', title: 'Regular Bullish', color: color.green, lineWidth: 2, display: 'pane' },
  { id: 'plot5', title: 'Regular Bearish', color: color.red, lineWidth: 2, display: 'pane' },
  { id: 'plot6', title: '🔌Connector🔌', color: NONE_COLOR, lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 60, title: 'Upper Band', color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_mid', price: 50, title: 'Middle Level', color: '#787B86', linestyle: 'dotted' },
  { id: 'hline_lower', price: 40, title: 'Lower Band', color: '#787B86', linestyle: 'dashed' },
];

/** fill(obPlot, osPlot, title = "Background", color = color.rgb(126, 87, 194, 90)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_background', plot1: 'hline_upper', plot2: 'hline_lower', color: String(color.rgb(126, 87, 194, 90)), title: 'Background' },
];

export const metadata = {
  title: 'RSI Signal [trade_lexx]',
  shortTitle: 'RSI Signal [trade_lexx]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

/** A ta.sma call site that only runs on some bars: its history is the values of the bars where it runs */
class SmaSite implements Committable {
  private hist: number[] = [];
  private pending = NaN;
  private stepped = false;

  constructor(private readonly length: number) {}

  step(v: number): number {
    this.stepped = true;
    this.pending = v;
    const hist = this.hist;
    const n = hist.length + 1;
    if (n < this.length) return NaN;
    let s = 0;
    for (let k = n - this.length; k < n; k++) s += k < hist.length ? hist[k] : v;
    return s / this.length;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.hist.push(this.pending);
    if (this.hist.length > this.length * 2 + 1024) this.hist = this.hist.slice(-this.length);
  }
}

/** A ta.stdev (biased) call site that only runs on some bars */
class StdevSite implements Committable {
  private hist: number[] = [];
  private pending = NaN;
  private stepped = false;

  constructor(private readonly length: number) {}

  step(v: number): number {
    this.stepped = true;
    this.pending = v;
    const hist = this.hist;
    const length = this.length;
    const n = hist.length + 1;
    if (n < length) return NaN;
    let s = 0;
    for (let k = n - length; k < n; k++) s += k < hist.length ? hist[k] : v;
    const mean = s / length;
    let ss = 0;
    for (let k = n - length; k < n; k++) ss += ((k < hist.length ? hist[k] : v) - mean) ** 2;
    return Math.sqrt(ss / length);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.hist.push(this.pending);
    if (this.hist.length > this.length * 2 + 1024) this.hist = this.hist.slice(-this.length);
  }
}

/** A ta.rma call site that only runs on some bars: SMA seed of its first `length` values, then recursive */
class RmaSite implements Committable {
  private readonly seed: SmaSite;
  private prev = NaN;
  private next = NaN;
  private stepped = false;

  constructor(private readonly length: number) {
    this.seed = new SmaSite(length);
  }

  step(v: number): number {
    this.stepped = true;
    const s = this.seed.step(v);
    this.next = isNaN(this.prev) ? s : (v + (this.length - 1) * this.prev) / this.length;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.seed.commit();
    this.prev = this.next;
  }
}

/** ma(source, length, MAtype) of one call site, on the RSI of bar i */
interface MaSite extends Committable {
  step(i: number, v: number, bars: Bar[]): number;
}

/** The step of a ta.* machine stepped with the value only, as a site */
const valueSite = (m: { step(v: number): number; commit(): void }): MaSite => ({ step: (_i, v) => m.step(v), commit: () => m.commit() });

/** var float kama: ta.sma while kama is na, else ta.stdev / ta.atr (histories of the bars of each branch) */
class KamaSite implements MaSite {
  private readonly sma: SmaSite;
  private readonly sd: StdevSite;
  private readonly atr: RmaSite;
  private kama = NaN;
  private next = NaN;
  private stepped = false;

  constructor(length: number) {
    this.sma = new SmaSite(length);
    this.sd = new StdevSite(length);
    this.atr = new RmaSite(length);
  }

  step(i: number, v: number, bars: Bar[]): number {
    this.stepped = true;
    let kama = this.kama;
    if (isNaN(kama)) {
      kama = this.sma.step(v);
    } else {
      const b = bars[i];
      const tr = i > 0
        ? Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close))
        : b.high - b.low;
      const volatility = this.sd.step(v);
      const atrV = this.atr.step(tr);
      // efficiency_ratio = volatility / ta.atr(length): an ATR of 0 gives +infinity (or na for 0 / 0); math.pow
      // and math.min use the infinite value (sc = 0.666)
      const er = volatility / atrV;
      let sc = Math.pow(er, 2);
      // math.max(0.666, math.min(0.0645, sc)): na when sc is na
      sc = isNaN(sc) ? NaN : Math.max(0.666, Math.min(0.0645, sc));
      kama = sc * v + (1 - sc) * kama;
    }
    this.next = kama;
    return kama;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.sma.commit();
    this.sd.commit();
    this.atr.commit();
    this.kama = this.next;
  }
}

/** var float lsma: ta.sma while lsma is na, else (source + lsma[1] * (length - 1)) / length */
class LsmaSite implements MaSite {
  private readonly sma: SmaSite;
  private lsma = NaN;
  private next = NaN;
  private stepped = false;

  constructor(private readonly length: number) {
    this.sma = new SmaSite(length);
  }

  step(_i: number, v: number): number {
    this.stepped = true;
    this.next = isNaN(this.lsma) ? this.sma.step(v) : (v + this.lsma * (this.length - 1)) / this.length;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.sma.commit();
    this.lsma = this.next;
  }
}

/** ma(source, length, MAtype): one call site for the MA, one for the bands */
function maSite(length: number, type: MaType, rsi: number[]): MaSite {
  switch (type) {
    case 'SMA': return valueSite(new WindowSma(length));
    case 'EMA': return valueSite(taStep.ema(length));
    case 'WMA': { const m = taStep.wma(); return { step: (_i, v) => m.step(v, length), commit: () => m.commit() }; }
    case 'VWMA': { const m = taStep.vwma(length); return { step: (i, v, bars) => m.step(v, bars[i].volume ?? NaN), commit: () => m.commit() }; }
    case 'HMA': return valueSite(taStep.hma(length));
    case 'ALMA': {
      // ta.alma(rsi, length, 0.85, 6): the weights of the oakscriptjs function on the RSI window
      const m = 0.85 * (length - 1);
      const sg = length / 6;
      const weights: number[] = [];
      let weightSum = 0;
      for (let k = 0; k < length; k++) {
        const weight = Math.exp(-1 * Math.pow(k - m, 2) / (2 * Math.pow(sg, 2)));
        weights.push(weight);
        weightSum += weight;
      }
      for (let k = 0; k < length; k++) weights[k] /= weightSum;
      return {
        step: (i) => {
          if (i < length - 1) return NaN;
          let almaValue = 0;
          for (let j = 0; j < length; j++) almaValue += rsi[i - length + 1 + j] * weights[j];
          return almaValue;
        },
        commit: () => {},
      };
    }
    case 'TEMA': {
      const e1 = taStep.ema(length);
      const e2 = taStep.ema(length);
      const e3 = taStep.ema(length);
      return {
        step: (_i, v) => {
          const a1 = e1.step(v);
          const a2 = e2.step(a1);
          return 3 * a1 - 3 * a2 + e3.step(a2);
        },
        commit: () => { e1.commit(); e2.commit(); e3.commit(); },
      };
    }
    case 'ZLEMA': {
      // lag = (length - 1) / 2 (fractional in Pine v6); ema[lag] truncates the index
      const lag = Math.trunc((length - 1) / 2);
      const e = taStep.ema(length);
      const hist: number[] = [];
      return {
        step: (i, v) => {
          hist[i] = e.step(v);
          return i - lag >= 0 ? hist[i - lag] : NaN;
        },
        commit: () => e.commit(),
      };
    }
    case 'KAMA': return new KamaSite(length);
    case 'LSMA': return new LsmaSite(length);
  }
  return { step: () => NaN, commit: () => {} };
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface RsiBbVars {
  /** ta.valuewhen(found, x, 1): the last two values of each history (older first), and the count (up to 2) */
  plRsi0: number; plRsi1: number; plLow0: number; plLow1: number; plN: number;
  phRsi0: number; phRsi1: number; phHigh0: number; phHigh1: number; phN: number;
  /** Calls of the ta.barssince in _inRange (Pine v6 `and` is lazy) */
  plCalls: number;
  phCalls: number;
  /** The last pair of the crossings where both values were not na (NaN: none yet) */
  maA: number; maB: number; loA: number; loB: number; upA: number; upB: number;
  lastBuyBar: number;
  lastSellBar: number;
  lastSignal: number;
}

interface RsiBbRun extends BarRunState<RsiBbVars> {
  change: ReturnType<typeof taStep.change>;
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  maS: MaSite | null;
  bbS: MaSite | null;
  sd: WindowStdev | null;
  pl: PivotStep;
  ph: PivotStep;
  rsi: number[];
  plFound: boolean[];
  phFound: boolean[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<RsiBbStddevSignalInputs>): BarStudy<RsiBbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.rsiSourceInput);
  // Divergence: pivots of the RSI, 5 bars left, 1 bar right
  const lookbackRight = 1;
  const lookbackLeft = 5;
  const rangeUpper = 60;
  const rangeLower = 5;
  const green = String(color.new(color.green, 0));
  const red = String(color.new(color.red, 0));
  const textColor = color.blue; // Pine default plotshape text colour
  const bbFill = String(color.new(color.green, 90));
  const sadText = ['MA+BB', 'MA+Div', 'BB+Div', 'MA+BB+Div'];
  const pauseOk = (last: number, i: number) => isNaN(last) || i - last >= cfg.minBarsBetweenSignals;
  // ta.crossover(a, b): a > b and a <= b on the previous bar where both were not na (Pine keeps the last
  // non-na pair: the KAMA average is na on every other bar during its warm-up); crossunder likewise. Exact
  // comparisons: ta.crossover / ta.crossunder do not use the 1e-10 tolerance of the operators
  const crossover = (a: number, b: number, pa: number, pb: number) => a > b && pa <= pb;
  // id: the plotshape of the original (shape<k>, k counted in declaration order)
  const mark = (
    markers: MarkerData[], id: string, time: number, position: MarkerData['position'], shape: 'triangleUp' | 'triangleDown',
    c: string, text: string, forceOverlay: boolean,
  ) => {
    markers.push({ id, time, position, shape, color: c, text, textColor, ...(forceOverlay ? { forceOverlay } : {}) });
  };
  const crossunder = (a: number, b: number, pa: number, pb: number) => a < b && pa >= pb;
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSourceInput) ? null : 'source of another study'),
    init() {
      const rsi: number[] = [];
      const s: RsiBbRun = {
        change: taStep.change(), up: taStep.rma(cfg.rsiLengthInput), down: taStep.rma(cfg.rsiLengthInput),
        maS: cfg.maModeInput ? maSite(cfg.maLengthInput, cfg.maTypeInput, rsi) : null,
        bbS: cfg.bbModeInput ? maSite(cfg.bbLengthInput, cfg.bbTypeInput, rsi) : null,
        sd: cfg.bbModeInput ? new WindowStdev(cfg.bbLengthInput) : null,
        pl: new PivotStep(lookbackLeft, lookbackRight, false), ph: new PivotStep(lookbackLeft, lookbackRight, true),
        rsi, plFound: [], phFound: [], plots: [[], [], [], [], [], [], []], flags: [[], []], times: [[], []], markers: [],
        steps: [],
        vars: {
          plRsi0: NaN, plRsi1: NaN, plLow0: NaN, plLow1: NaN, plN: 0, phRsi0: NaN, phRsi1: NaN, phHigh0: NaN, phHigh1: NaN,
          phN: 0, plCalls: NaN, phCalls: NaN, maA: NaN, maB: NaN, loA: NaN, loB: NaN, upA: NaN, upB: NaN,
          lastBuyBar: NaN, lastSellBar: NaN, lastSignal: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [
        s.change, s.up, s.down, ...(s.maS ? [s.maS] : []), ...(s.bbS ? [s.bbS] : []), ...(s.sd ? [s.sd] : []),
        ...(cfg.divergenceModeInput ? [s.pl, s.ph] : []),
      ];
      s.lists = [...s.times, s.markers];
      s.series = [s.rsi, s.plFound, s.phFound, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time;
      // RSI
      const change = s.change.step(value(b));
      const up = s.up.step(Math.max(change, 0));
      const down = s.down.step(-Math.min(change, 0));
      // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
      const rsi = eq(down, 0) ? 100 : eq(up, 0) ? 0 : 100 - 100 / (1 + up / down);
      s.rsi[i] = rsi;

      const smoothingMA = s.maS ? s.maS.step(i, rsi, bars) : NaN;
      const smoothingBB = s.bbS ? s.bbS.step(i, rsi, bars) : NaN;
      const smoothingStDev = s.sd ? s.sd.step(rsi) * cfg.bbMultInput : NaN;
      const bbUpper = smoothingBB + smoothingStDev;
      const bbLower = smoothingBB - smoothingStDev;

      const r = i - lookbackRight >= 0 ? s.rsi[i - lookbackRight] : NaN;
      let bullCond0 = false;
      let bearCond0 = false;
      let plFound = false;
      let phFound = false;
      if (cfg.divergenceModeInput) {
        const pl = s.pl.step(i, rsi);
        const ph = s.ph.step(i, rsi);
        // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
        const lowLBR = i - lookbackRight >= 0 ? bars[i - lookbackRight].low : NaN;
        const highLBR = i - lookbackRight >= 0 ? bars[i - lookbackRight].high : NaN;
        const prevPl = i > 0 && s.plFound[i - 1];
        plFound = !isNaN(pl);
        if (plFound) {
          v.plRsi0 = v.plRsi1; v.plRsi1 = r;
          v.plLow0 = v.plLow1; v.plLow1 = lowLBR;
          if (v.plN < 2) v.plN++;
        }
        const vwPlRsi = v.plN >= 2 ? v.plRsi0 : NaN;
        const vwPlLow = v.plN >= 2 ? v.plLow0 : NaN;
        let rsiHL = false;
        // `and` is lazy: the ta.barssince of _inRange(...) only runs when the left side is true (one state per site)
        if (gt(r, vwPlRsi)) {
          if (prevPl) v.plCalls = 0;
          else if (!isNaN(v.plCalls)) v.plCalls++;
          rsiHL = rangeLower <= v.plCalls && v.plCalls <= rangeUpper;
        }
        const priceLL = lt(lowLBR, vwPlLow);
        bullCond0 = priceLL && rsiHL && plFound;

        const prevPh = i > 0 && s.phFound[i - 1];
        phFound = !isNaN(ph);
        if (phFound) {
          v.phRsi0 = v.phRsi1; v.phRsi1 = r;
          v.phHigh0 = v.phHigh1; v.phHigh1 = highLBR;
          if (v.phN < 2) v.phN++;
        }
        const vwPhRsi = v.phN >= 2 ? v.phRsi0 : NaN;
        const vwPhHigh = v.phN >= 2 ? v.phHigh0 : NaN;
        let rsiLH = false;
        if (lt(r, vwPhRsi)) {
          if (prevPh) v.phCalls = 0;
          else if (!isNaN(v.phCalls)) v.phCalls++;
          rsiLH = rangeLower <= v.phCalls && v.phCalls <= rangeUpper;
        }
        const priceHH = gt(highLBR, vwPhHigh);
        bearCond0 = priceHH && rsiLH && phFound;
      }
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;

      const crossMA = crossover(rsi, smoothingMA, v.maA, v.maB);
      const crossMAdn = crossunder(rsi, smoothingMA, v.maA, v.maB);
      const crossLower = crossover(rsi, bbLower, v.loA, v.loB);
      const crossUpper = crossunder(rsi, bbUpper, v.upA, v.upB);
      if (!isNaN(rsi) && !isNaN(smoothingMA)) { v.maA = rsi; v.maB = smoothingMA; }
      if (!isNaN(rsi) && !isNaN(bbLower)) { v.loA = rsi; v.loB = bbLower; }
      if (!isNaN(rsi) && !isNaN(bbUpper)) { v.upA = rsi; v.upB = bbUpper; }

      let buyMA = crossMA && pauseOk(v.lastBuyBar, i);
      let sellMA = crossMAdn && pauseOk(v.lastSellBar, i);
      let buyBB = crossLower && pauseOk(v.lastBuyBar, i);
      let sellBB = crossUpper && pauseOk(v.lastSellBar, i);
      let buyDiv = bullCond0 && pauseOk(v.lastBuyBar, i);
      let sellDiv = bearCond0 && pauseOk(v.lastSellBar, i);
      let bull = bullCond0;
      let bear = bearCond0;

      if (cfg.waitForOppositeSignal) {
        const buyOk = isNaN(v.lastSignal) || v.lastSignal === -1;
        const sellOk = isNaN(v.lastSignal) || v.lastSignal === 1;
        buyMA = buyMA && buyOk;
        sellMA = sellMA && sellOk;
        buyBB = buyBB && buyOk;
        sellBB = sellBB && sellOk;
        buyDiv = buyDiv && buyOk;
        sellDiv = sellDiv && sellOk;
        bull = bull && buyOk;
        bear = bear && sellOk;
      }
      if (cfg.overboughtOversold) {
        const buyZone = ge(rsi, cfg.oversoldLowerLevel) && le(rsi, cfg.oversoldUpperLevel);
        const sellZone = ge(rsi, cfg.overboughtLowerLevel) && le(rsi, cfg.overboughtUpperLevel);
        buyMA = buyMA && buyZone;
        sellMA = sellMA && sellZone;
        buyBB = buyBB && buyZone;
        sellBB = sellBB && sellZone;
        buyDiv = buyDiv && buyZone;
        sellDiv = sellDiv && sellZone;
        bull = bull && buyZone;
        bear = bear && sellZone;
      }

      if (buyMA) { v.lastBuyBar = i; v.lastSignal = 1; }
      if (sellMA) { v.lastSellBar = i; v.lastSignal = -1; }
      if (buyBB) { v.lastBuyBar = i; v.lastSignal = 1; }
      if (sellBB) { v.lastSellBar = i; v.lastSignal = -1; }
      if (buyDiv) { v.lastBuyBar = i; v.lastSignal = 1; }
      if (sellDiv) { v.lastSellBar = i; v.lastSignal = -1; }

      const markers = s.markers;
      const buyAt = (id: string, position: MarkerData['position'], text: string, forceOverlay = false) =>
        mark(markers, id, time, position, 'triangleUp', green, text, forceOverlay);
      const sellAt = (id: string, position: MarkerData['position'], text: string, forceOverlay = false) =>
        mark(markers, id, time, position, 'triangleDown', red, text, forceOverlay);
      const ma = cfg.maModeInput;
      const bb = cfg.bbModeInput;
      const dv = cfg.divergenceModeInput;
      // plotshape(bullCond ? rsiLBR : na, offset = -lookbackRight, location.absolute, text = "Div") and the bearish one
      // ("Regular Bullish / Bearish Label", display.none: hidden by default): the value of bar i drawn on bar i - 1
      if (i - lookbackRight >= 0 && !isNaN(r)) {
        const lblTime = barTime(bars, i - lookbackRight);
        if (bull) markers.push({ id: 'shape0', time: lblTime, position: 'atPriceMiddle', price: r, shape: 'triangleUp', color: green, text: 'Div', textColor });
        if (bear) markers.push({ id: 'shape1', time: lblTime, position: 'atPriceMiddle', price: r, shape: 'triangleDown', color: red, text: 'Div', textColor });
      }
      // Oscillator signals: location.bottom / top, Div at the RSI of the pivot bar (location.absolute)
      if (ma && buyMA) buyAt('shape2', 'bottom', 'MA');
      if (ma && sellMA) sellAt('shape3', 'top', 'MA');
      if (bb && buyBB) buyAt('shape4', 'bottom', 'BB');
      if (bb && sellBB) sellAt('shape5', 'top', 'BB');
      if (buyDiv && !isNaN(r)) {
        markers.push({ id: 'shape6', time, position: 'atPriceMiddle', price: r, shape: 'triangleUp', color: green, text: 'Div', textColor });
      }
      if (sellDiv && !isNaN(r)) {
        markers.push({ id: 'shape7', time, position: 'atPriceMiddle', price: r, shape: 'triangleDown', color: red, text: 'Div', textColor });
      }
      // Chart signals (force_overlay)
      if (!cfg.andMode) {
        if (ma && buyMA) buyAt('shape8', 'belowBar', 'Buy', true);
        if (ma && sellMA) sellAt('shape9', 'aboveBar', 'Sell', true);
        if (bb && buyBB) buyAt('shape10', 'belowBar', 'Buy', true);
        if (bb && sellBB) sellAt('shape11', 'aboveBar', 'Sell', true);
        if (dv && buyDiv) buyAt('shape12', 'belowBar', 'Buy', true);
        if (dv && sellDiv) sellAt('shape13', 'aboveBar', 'Sell', true);
      }
      const bMA = ma && buyMA;
      const bBB = bb && buyBB;
      const bDv = dv && buyDiv;
      const sMA = ma && sellMA;
      const sBB = bb && sellBB;
      const sDv = dv && sellDiv;
      let finalBuy: boolean;
      let finalSell: boolean;
      if (cfg.andMode) {
        const buySaD = [bMA && bBB, bMA && bDv, bBB && bDv, bMA && bBB && bDv];
        const sellSaD = [sMA && sBB, sMA && sDv, sBB && sDv, sMA && sBB && sDv];
        buySaD.forEach((on, k) => { if (on) buyAt(`shape${14 + k}`, 'belowBar', sadText[k], true); });
        sellSaD.forEach((on, k) => { if (on) sellAt(`shape${18 + k}`, 'aboveBar', sadText[k], true); });
        finalBuy = buySaD.some(Boolean);
        finalSell = sellSaD.some(Boolean);
      } else {
        finalBuy = bMA || bBB || bDv;
        finalSell = sMA || sBB || sDv;
      }
      const finalSignal = finalBuy ? 1 : finalSell ? -1 : 0;
      s.flags[0][i] = finalBuy;
      s.flags[1][i] = finalSell;
      if (finalBuy) s.times[0].push(time as number);
      if (finalSell) s.times[1].push(time as number);

      const p = s.plots;
      p[0][i] = { time, value: rsi, color: '#7E57C2' };
      p[1][i] = { time, value: smoothingMA, color: color.yellow };
      p[2][i] = { time, value: bbUpper, color: color.green };
      p[3][i] = { time, value: bbLower, color: color.green };
      // plot(plFound ? rsiLBR : na, offset = -lookbackRight, color = bullCond ? bullColor : noneColor): bar i on bar i - 1
      if (i >= lookbackRight) {
        const lbrTime = barTime(bars, i - lookbackRight);
        p[4][i] = { time: lbrTime, value: plFound ? r : NaN, color: bull ? color.green : NONE_COLOR };
        p[5][i] = { time: lbrTime, value: phFound ? r : NaN, color: bear ? color.red : NONE_COLOR };
      }
      p[6][i] = { time, value: finalSignal, color: NONE_COLOR };
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(lookbackRight),
          plot5: p[5].slice(lookbackRight),
          plot6: p[6].slice(),
        },
        hlines: [
          { value: cfg.overboughtLowerLevel, options: { title: 'Upper Band', color: '#787B86', linestyle: 'dashed' } },
          { value: 50, options: { title: 'Middle Level', color: '#787B86', linestyle: 'dotted' } },
          { value: cfg.oversoldUpperLevel, options: { title: 'Lower Band', color: '#787B86', linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Background' },
            colors: new Array<string>(n).fill(String(color.rgb(126, 87, 194, 90))) },
          // fill(bbUpperBand, bbLowerBand, color = bbModeInput ? color.new(color.green, 90) : na)
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Bollinger Bands Background Fill' },
            colors: new Array<string>(n).fill(cfg.bbModeInput ? bbFill : 'transparent') },
        ],
        markers: s.markers.slice(),
        // alertcondition(finalBuySignal, 'Buy Signal') / alertcondition(finalSellSignal, 'Sell Signal')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiBbStddevSignalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiBbStddevSignalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Final Buy Signal Triggered' },
  { id: 'alert1', title: 'Sell Signal', message: 'Final Sell Signal Triggered' },
];

export const RsiBbStddevSignal = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
