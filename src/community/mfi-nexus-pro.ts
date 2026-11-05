/**
 * MFI Nexus Pro
 *
 * Money Flow Index from hlc3 * volume: 100 - 100 / (1 + positive flow / max(negative flow, 0.000001)) over the MFI
 * length. A moving average of the MFI (10 types), Bollinger Bands of the MFI and regular divergences between MFI
 * pivots (5 left, 1 right) and price give buy / sell signals: MFI crossing the MA, MFI crossing the lower band up /
 * the upper band down, bullish / bearish divergences. Signals need a minimum number of bars since the last signal of
 * the same side and can be filtered by MFI and RSI zones and by "wait for the opposite signal". Signals are drawn in
 * the pane and on the price chart (each signal, all signals combined by AND, or by OR). The divergences are drawn as
 * lines between the pivots and "Div" triangles on the pivot bar (hidden by default). Five connector plots give
 * 1 (buy), -1 (sell) or 0.
 * Alerts (alertcondition, `alerts` of the result): the buy / sell signals of the MA, BB and divergence modes, of all
 * three combined by OR and by AND, as the original declares them.
 *
 * Reference: "MFI Nexus Pro [trade_lexx]" by trade_lexx
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal MA', message: 'Buy Signal MA: MFI crossed above the MA.' },
  { id: 'alert1', title: 'Sell Signal MA', message: 'Sell Signal MA: MFI crossed below the MA.' },
  { id: 'alert2', title: 'Buy Signal BB', message: 'Buy Signal BB: MFI crossed above the lower Bollinger Band.' },
  { id: 'alert3', title: 'Sell Signal BB', message: 'Sell Signal BB: MFI crossed below the upper Bollinger Band.' },
  { id: 'alert4', title: 'Buy Signal Div', message: 'Buy Signal Div: Bullish divergence detected.' },
  { id: 'alert5', title: 'Sell Signal Div', message: 'Sell Signal Div: Bearish divergence detected.' },
  { id: 'alert6', title: 'Buy OR Signal MA, BB, Div', message: 'Buy Signal: MFI crossed above the MA or BB or bullish divergence' },
  { id: 'alert7', title: 'Sell OR Signal MA, BB, Div', message: 'Sell Signal: MFI crossed below the MA or BB or bearish divergence.' },
  { id: 'alert8', title: 'Buy AND Signal MA, BB, Div', message: 'Buy Signal: MFI crossed above the MA or BB or bullish divergence' },
  { id: 'alert9', title: 'Sell AND Signal MA, BB, Div', message: 'Sell Signal: MFI crossed below the MA or BB or bearish divergence.' },
];

type MaType = 'SMA' | 'EMA' | 'WMA' | 'HMA' | 'KAMA' | 'VWMA' | 'ALMA' | 'TEMA' | 'ZLEMA' | 'DEMA';
type AndOrMode = 'None' | 'MA and BB and Div' | 'MA or BB or Div';

export interface MfiNexusProInputs {
  /** Moving average signal */
  maMode: boolean;
  /** Moving average type */
  maType: MaType;
  /** Moving average length */
  maLength: number;
  /** Bollinger Bands signal */
  bbMode: boolean;
  /** Divergence signal */
  divergenceMode: boolean;
  /** Basis type of the Bollinger Bands */
  bbType: Exclude<MaType, 'KAMA'>;
  /** Bollinger Bands length */
  bbLength: number;
  /** Bollinger Bands standard deviation multiplier */
  bbMult: number;
  /** Minimum bars between two signals of the same side */
  minBarsBetweenSignals: number;
  /** MFI filter */
  mfiFilter: boolean;
  /** MFI length */
  mfiLength: number;
  /** Sell signals: MFI above this level */
  overboughtLowerLevel: number;
  /** Sell signals: MFI below this level */
  overboughtUpperLevel: number;
  /** Buy signals: MFI above this level */
  oversoldLowerLevel: number;
  /** Buy signals: MFI below this level */
  oversoldUpperLevel: number;
  /** RSI filter */
  rsiFilter: boolean;
  /** RSI length */
  rsiLength: number;
  /** Sell signals: RSI above this level */
  rsiOverboughtLowerLevel: number;
  /** Sell signals: RSI below this level */
  rsiOverboughtUpperLevel: number;
  /** Buy signals: RSI above this level */
  rsiOversoldLowerLevel: number;
  /** Buy signals: RSI below this level */
  rsiOversoldUpperLevel: number;
  /** Chart signals: each signal ('None'), MA and BB and Div combinations, or MA or BB or Div */
  andOrMode: AndOrMode;
  /** A signal needs the last signal to be of the other side */
  waitForOppositeSignal: boolean;
}

export const defaultInputs: MfiNexusProInputs = {
  maMode: true,
  maType: 'SMA',
  maLength: 14,
  bbMode: true,
  divergenceMode: true,
  bbType: 'SMA',
  bbLength: 14,
  bbMult: 2.0,
  minBarsBetweenSignals: 5,
  mfiFilter: true,
  mfiLength: 14,
  overboughtLowerLevel: 70,
  overboughtUpperLevel: 100,
  oversoldLowerLevel: 1,
  oversoldUpperLevel: 30,
  rsiFilter: true,
  rsiLength: 14,
  rsiOverboughtLowerLevel: 65,
  rsiOverboughtUpperLevel: 100,
  rsiOversoldLowerLevel: 1,
  rsiOversoldUpperLevel: 30,
  andOrMode: 'None',
  waitForOppositeSignal: false,
};

const MA_TYPES: MaType[] = ['SMA', 'EMA', 'WMA', 'HMA', 'KAMA', 'VWMA', 'ALMA', 'TEMA', 'ZLEMA', 'DEMA'];
const BB_TYPES = ['SMA', 'EMA', 'WMA', 'HMA', 'VWMA', 'ALMA', 'TEMA', 'ZLEMA', 'DEMA'];

export const inputConfig: InputConfig[] = [
  { id: 'maMode', type: 'bool', title: 'Moving Average Signal', defval: true },
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA', options: MA_TYPES },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14 },
  { id: 'bbMode', type: 'bool', title: 'Bollinger Bands Signal', defval: true },
  { id: 'divergenceMode', type: 'bool', title: 'Divergence Signal', defval: true },
  { id: 'bbType', type: 'string', title: 'Type', defval: 'SMA', options: BB_TYPES },
  { id: 'bbLength', type: 'int', title: 'Length', defval: 14 },
  { id: 'bbMult', type: 'float', title: 'StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.1 },
  { id: 'minBarsBetweenSignals', type: 'int', title: 'Minimum Bars Between Signals', defval: 5, min: 0 },
  { id: 'mfiFilter', type: 'bool', title: 'MFI Filter |', defval: true },
  { id: 'mfiLength', type: 'int', title: 'MFI Length', defval: 14, min: 1 },
  { id: 'overboughtLowerLevel', type: 'int', title: 'Sell ⮕ Above⬆', defval: 70, min: 0, max: 100 },
  { id: 'overboughtUpperLevel', type: 'int', title: 'Below⬇', defval: 100, min: 0, max: 100 },
  { id: 'oversoldLowerLevel', type: 'int', title: 'Buy ⮕ Above⬆', defval: 1, min: 0, max: 100 },
  { id: 'oversoldUpperLevel', type: 'int', title: 'Below⬇', defval: 30, min: 0, max: 100 },
  { id: 'rsiFilter', type: 'bool', title: 'RSI Filter |', defval: true },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiOverboughtLowerLevel', type: 'int', title: 'Sell ⮕ Above⬆', defval: 65, min: 0, max: 100 },
  { id: 'rsiOverboughtUpperLevel', type: 'int', title: 'Below⬇', defval: 100, min: 0, max: 100 },
  { id: 'rsiOversoldLowerLevel', type: 'int', title: 'Buy ⮕ Above⬆', defval: 1, min: 0, max: 100 },
  { id: 'rsiOversoldUpperLevel', type: 'int', title: 'Below⬇', defval: 30, min: 0, max: 100 },
  { id: 'andOrMode', type: 'string', title: 'AND/OR Mode', defval: 'None', options: ['None', 'MA and BB and Div', 'MA or BB or Div'] },
  { id: 'waitForOppositeSignal', type: 'bool', title: 'Wait for Opposite Signal', defval: false },
];

const MFI_COL = '#7E57C2';
const BAND_COL = '#787B86';
const NONE_COL = String(color.new(color.white, 100));
/** Pine plotshape default text colour */
const PINE_TEXT = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MFI', color: MFI_COL, lineWidth: 1 },
  { id: 'plot1', title: 'MFI-based MA', color: color.yellow, lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'Lower Bollinger Band', color: color.green, lineWidth: 1 },
  { id: 'plot4', title: 'Regular Bullish', color: color.green, lineWidth: 2, display: 'pane' },
  { id: 'plot5', title: 'Regular Bearish', color: color.red, lineWidth: 2, display: 'pane' },
  { id: 'plot6', title: '🔌Connector Signal MA🔌', color: NONE_COL, lineWidth: 1 },
  { id: 'plot7', title: '🔌Connector Signal BB🔌', color: NONE_COL, lineWidth: 1 },
  { id: 'plot8', title: '🔌Connector Divergence🔌', color: NONE_COL, lineWidth: 1 },
  { id: 'plot9', title: '🔌Connector AND Mode🔌', color: NONE_COL, lineWidth: 1 },
  { id: 'plot10', title: '🔌Connector OR Mode🔌', color: NONE_COL, lineWidth: 1 },
];

/** hline(70 / 50 / 30) with the default levels (the result `hlines` carry the input levels) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 70, title: 'Upper Band', color: BAND_COL, linestyle: 'dashed' },
  { id: 'hline_mid', price: 50, title: 'Middle Level', color: BAND_COL, linestyle: 'dotted' },
  { id: 'hline_lower', price: 30, title: 'Lower Band', color: BAND_COL, linestyle: 'dashed' },
];

/** fill(obPlot, osPlot, color.rgb(126, 87, 194, 90)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'hline_upper', plot2: 'hline_lower', color: String(color.rgb(126, 87, 194, 90)), title: 'Background' },
];

export const metadata = {
  title: 'MFI Nexus Pro [trade_lexx]',
  shortTitle: 'MFI Nexus Pro [trade_lexx]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
/** A moving average of the MFI, one bar at a time */
type MaStep = { step(value: number, volume: number): number; commit(): void };

/** oakscriptjs averages do not skip +-infinity (#119): give them NaN */
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

/** KAMA: var float kama = na; sc = max(0.666, min(0.0645, (stdev / atr)^2)) (na when stdev / atr is na) */
class KamaStep implements MaStep {
  private readonly sma = taStep.sma();
  private readonly vol = taStep.stdev();
  private readonly atr: ReturnType<typeof taStep.atr>;
  private k = NaN;
  private next = NaN;
  constructor(private readonly len: number) {
    this.atr = taStep.atr(len);
  }
  /** `bar`: the bar of the value (ta.atr of the chart bars) */
  stepBar(src: number, bar: Bar): number {
    const sma = this.sma.step(src, this.len);
    const vol = this.vol.step(src, this.len);
    const atr = this.atr.step(bar.high, bar.low, bar.close);
    const er = vol / atr;
    let sc = Math.pow(er, 2);
    sc = isNaN(sc) ? NaN : Math.max(0.666, Math.min(0.0645, sc));
    this.next = isNaN(this.k) ? sma : sc * src + (1 - sc) * this.k;
    return this.next;
  }
  step(): number {
    return NaN;
  }
  commit(): void {
    this.sma.commit();
    this.vol.commit();
    this.atr.commit();
    this.k = this.next;
  }
}

/** ta.alma(src, len, 0.85, 6) of the library: the weighted sum of the last `len` values (na included) */
class AlmaStep implements MaStep {
  private readonly weights: number[] = [];
  private readonly values: number[] = [];
  constructor(private readonly length: number, offset: number, sigma: number) {
    const m = offset * (length - 1);
    const s = length / sigma;
    let weightSum = 0;
    for (let i = 0; i < length; i++) {
      const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
      this.weights.push(weight);
      weightSum += weight;
    }
    for (let i = 0; i < length; i++) this.weights[i] /= weightSum;
  }
  private pending = NaN;
  step(value: number): number {
    this.pending = value;
    const length = this.length;
    const values = this.values;
    const i = values.length;
    if (i < length - 1) return NaN;
    let almaValue = 0;
    for (let j = 0; j < length; j++) {
      const k = i - length + 1 + j;
      almaValue += (k === i ? value : values[k]) * this.weights[j];
    }
    return almaValue;
  }
  commit(): void {
    this.values.push(this.pending);
  }
}

/** ZLEMA: ema[(length - 1) / 2] (a fractional index is truncated) */
class ZlemaStep implements MaStep {
  private readonly ema: ReturnType<typeof taStep.ema>;
  private readonly lag: number;
  private readonly history: number[] = [];
  private pending = NaN;
  constructor(len: number) {
    this.ema = taStep.ema(len);
    this.lag = Math.trunc((len - 1) / 2);
  }
  step(value: number): number {
    const e = this.ema.step(fin(value));
    this.pending = e;
    const at = this.history.length - this.lag;
    return at >= 0 ? (this.lag === 0 ? e : this.history[at]) : NaN;
  }
  commit(): void {
    this.ema.commit();
    this.history.push(this.pending);
  }
}

function maStep(len: number, type: string): MaStep | KamaStep {
  const of = (steps: Committable[], f: (v: number, vol: number) => number): MaStep => ({
    step: f,
    commit: () => { for (const m of steps) m.commit(); },
  });
  switch (type) {
    case 'SMA': { const m = taStep.sma(); return of([m], (v) => m.step(v, len)); }
    case 'EMA': { const m = taStep.ema(len); return of([m], (v) => m.step(fin(v))); }
    case 'WMA': { const m = taStep.wma(); return of([m], (v) => m.step(v, len)); }
    case 'VWMA': { const m = taStep.vwma(len); return of([m], (v, vol) => m.step(v, vol)); }
    case 'KAMA': return new KamaStep(len);
    case 'HMA': { const m = taStep.hma(len); return of([m], (v) => m.step(v)); }
    case 'ZLEMA': return new ZlemaStep(len);
    case 'TEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      const e3 = taStep.ema(len);
      return of([e1, e2, e3], (v) => {
        const a = e1.step(fin(v));
        const b = e2.step(fin(a));
        const c = e3.step(fin(b));
        return 3 * a - 3 * b + c;
      });
    }
    case 'ALMA': return new AlmaStep(len, 0.85, 6);
    case 'DEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      return of([e1, e2], (v) => {
        const a = e1.step(fin(v));
        return 2 * a - e2.step(fin(a));
      });
    }
    default: return of([], () => NaN);
  }
}

/** ta.valuewhen(found, x, 1) history: the value added on a found bar (the last two, older first) */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
const second = (h: readonly number[]): number => (h.length === 2 ? h[0]! : NaN);

interface MfiVars {
  prevTypical: number;
  plMfi: readonly number[];
  plLow: readonly number[];
  phMfi: readonly number[];
  phHigh: readonly number[];
  prevPlFound: boolean;
  prevPhFound: boolean;
  /** ta.barssince(plFound[1]) / ta.barssince(phFound[1]): runs on every bar */
  plSince: number;
  phSince: number;
  /** crossover / crossunder states: the last values where both were not na (MA up, MA down, BB up, BB down) */
  cross: number[];
  lastBuyBar: number;
  lastSellBar: number;
  lastSignal: number;
}

interface MfiRun extends BarRunState<MfiVars> {
  posSum: ReturnType<typeof taStep.sum>;
  negSum: ReturnType<typeof taStep.sum>;
  rsi: ReturnType<typeof taStep.rsi>;
  ma: MaStep | KamaStep | null;
  bb: MaStep | KamaStep | null;
  stdev: ReturnType<typeof taStep.stdev> | null;
  pl: PivotStep;
  ph: PivotStep;
  /** mfi of each bar */
  mfi: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<MfiNexusProInputs>): BarStudy<MfiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lookbackRight = 1;
  const lookbackLeft = 5;
  const rangeUpper = 60;
  const rangeLower = 5;
  const green = String(color.new(color.green, 0));
  const red = String(color.new(color.red, 0));
  const maValue = (m: MaStep | KamaStep | null, v: number, b: Bar) =>
    m === null ? NaN : m instanceof KamaStep ? m.stepBar(v, b) : m.step(v, b.volume ?? NaN);
  // ta.crossover / ta.crossunder: compared with the last bar where both values were not na, exactly (no 1e-10 tolerance)
  const cross = (st: number[], k: number, a: number, b: number, over: boolean) => {
    let res = false;
    if (!isNaN(a) && !isNaN(b)) {
      res = over ? a > b && st[k] <= st[k + 1] : a < b && st[k] >= st[k + 1];
      st[k] = a;
      st[k + 1] = b;
    }
    return res;
  };
  const conn = (buy: boolean, sell: boolean) => (buy ? 1 : sell ? -1 : 0);
  return {
    init() {
      const s: MfiRun = {
        posSum: taStep.sum(), negSum: taStep.sum(), rsi: taStep.rsi(cfg.rsiLength),
        ma: cfg.maMode ? maStep(cfg.maLength, cfg.maType) : null,
        bb: cfg.bbMode ? maStep(cfg.bbLength, cfg.bbType) : null,
        stdev: cfg.bbMode ? taStep.stdev() : null,
        pl: new PivotStep(lookbackLeft, lookbackRight, false),
        ph: new PivotStep(lookbackLeft, lookbackRight, true),
        mfi: [], plots: Array.from({ length: 11 }, () => []),
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []), markers: [],
        steps: [],
        vars: {
          prevTypical: NaN, plMfi: [], plLow: [], phMfi: [], phHigh: [], prevPlFound: false, prevPhFound: false,
          plSince: NaN, phSince: NaN, cross: new Array<number>(8).fill(NaN), lastBuyBar: NaN, lastSellBar: NaN,
          lastSignal: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [
        s.posSum, s.negSum, s.rsi, ...(s.ma ? [s.ma] : []), ...(s.bb ? [s.bb] : []), ...(s.stdev ? [s.stdev] : []),
        ...(cfg.divergenceMode ? [s.pl, s.ph] : []),
      ];
      s.lists = [...s.times, s.markers];
      s.series = [s.mfi, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time;

      // MFI: math.sum of the money flow of the bars where hlc3 rises / falls (hlc3 > hlc3[1] is false on bar 0)
      const typical = (b.high + b.low + b.close) / 3;
      const vol = b.volume ?? NaN;
      const posFlow = vol * typical * (i > 0 && gt(typical, v.prevTypical) ? 1 : 0);
      const negFlow = vol * typical * (i > 0 && lt(typical, v.prevTypical) ? 1 : 0);
      v.prevTypical = typical;
      const p = s.posSum.step(posFlow, cfg.mfiLength);
      const m = 100 - 100 / (1 + p / Math.max(s.negSum.step(negFlow, cfg.mfiLength), 0.000001));
      s.mfi[i] = m;

      const r = s.rsi.step(b.close);

      // Moving averages of the MFI
      const smoothingMA = maValue(s.ma, m, b);
      const smoothingBB = maValue(s.bb, m, b);
      const stdev = s.stdev ? s.stdev.step(fin(m), cfg.bbLength) : NaN;
      const smoothingStDev = stdev * cfg.bbMult;
      const bbUpper = smoothingBB + smoothingStDev;
      const bbLower = smoothingBB - smoothingStDev;

      // Divergence: pivots of the MFI (5 left, 1 right)
      const o = i - lookbackRight >= 0 ? s.mfi[i - lookbackRight] : NaN;
      let plFound = false;
      let phFound = false;
      let bullCond = false;
      let bearCond = false;
      if (cfg.divergenceMode) {
        const lowLBR = i - lookbackRight >= 0 ? bars[i - lookbackRight].low : NaN;
        const highLBR = i - lookbackRight >= 0 ? bars[i - lookbackRight].high : NaN;

        plFound = !isNaN(s.pl.step(i, fin(m)));
        if (i > 0 && v.prevPlFound) v.plSince = 0;
        else if (!isNaN(v.plSince)) v.plSince++;
        const plFoundRange = rangeLower <= v.plSince && v.plSince <= rangeUpper;
        // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
        if (plFound) {
          v.plMfi = pushed(v.plMfi, o);
          v.plLow = pushed(v.plLow, lowLBR);
        }
        const mfiHL = gt(o, second(v.plMfi)) && plFoundRange;
        const priceLL = lt(lowLBR, second(v.plLow));
        bullCond = priceLL && mfiHL && plFound;

        phFound = !isNaN(s.ph.step(i, fin(m)));
        if (i > 0 && v.prevPhFound) v.phSince = 0;
        else if (!isNaN(v.phSince)) v.phSince++;
        const phFoundRange = rangeLower <= v.phSince && v.phSince <= rangeUpper;
        if (phFound) {
          v.phMfi = pushed(v.phMfi, o);
          v.phHigh = pushed(v.phHigh, highLBR);
        }
        const mfiLH = lt(o, second(v.phMfi)) && phFoundRange;
        const priceHH = gt(highLBR, second(v.phHigh));
        bearCond = priceHH && mfiLH && phFound;
        v.prevPlFound = plFound;
        v.prevPhFound = phFound;
      }

      const buyGap = isNaN(v.lastBuyBar) || i - v.lastBuyBar >= cfg.minBarsBetweenSignals;
      const sellGap = isNaN(v.lastSellBar) || i - v.lastSellBar >= cfg.minBarsBetweenSignals;
      let bMA = cross(v.cross, 0, m, smoothingMA, true) && buyGap;
      let sMA = cross(v.cross, 2, m, smoothingMA, false) && sellGap;
      let bBB = cross(v.cross, 4, m, bbLower, true) && buyGap;
      let sBB = cross(v.cross, 6, m, bbUpper, false) && sellGap;
      let bDiv = bullCond && buyGap;
      let sDiv = bearCond && sellGap;
      let bull = bullCond;
      let bear = bearCond;

      if (cfg.waitForOppositeSignal) {
        const okBuy = isNaN(v.lastSignal) || v.lastSignal === -1;
        const okSell = isNaN(v.lastSignal) || v.lastSignal === 1;
        bMA &&= okBuy; sMA &&= okSell; bBB &&= okBuy; sBB &&= okSell; bDiv &&= okBuy; sDiv &&= okSell;
        bull &&= okBuy; bear &&= okSell;
      }
      if (cfg.mfiFilter) {
        const okBuy = ge(m, cfg.oversoldLowerLevel) && le(m, cfg.oversoldUpperLevel);
        const okSell = ge(m, cfg.overboughtLowerLevel) && le(m, cfg.overboughtUpperLevel);
        bMA &&= okBuy; sMA &&= okSell; bBB &&= okBuy; sBB &&= okSell; bDiv &&= okBuy; sDiv &&= okSell;
        bull &&= okBuy; bear &&= okSell;
      }
      if (cfg.rsiFilter) {
        const okBuy = ge(r, cfg.rsiOversoldLowerLevel) && le(r, cfg.rsiOversoldUpperLevel);
        const okSell = ge(r, cfg.rsiOverboughtLowerLevel) && le(r, cfg.rsiOverboughtUpperLevel);
        bMA &&= okBuy; sMA &&= okSell; bBB &&= okBuy; sBB &&= okSell; bDiv &&= okBuy; sDiv &&= okSell;
        bull &&= okBuy; bear &&= okSell;
      }
      if (bMA) { v.lastBuyBar = i; v.lastSignal = 1; }
      if (sMA) { v.lastSellBar = i; v.lastSignal = -1; }
      if (bBB) { v.lastBuyBar = i; v.lastSignal = 1; }
      if (sBB) { v.lastSellBar = i; v.lastSignal = -1; }
      if (bDiv) { v.lastBuyBar = i; v.lastSignal = 1; }
      if (sDiv) { v.lastSellBar = i; v.lastSignal = -1; }

      // Plots
      const pl = s.plots;
      pl[0][i] = { time, value: fin(m), color: MFI_COL };
      pl[1][i] = { time, value: fin(smoothingMA), color: color.yellow };
      pl[2][i] = { time, value: fin(bbUpper), color: color.green };
      pl[3][i] = { time, value: fin(bbLower), color: color.green };
      // plot(plFound ? mfiLBR : na, offset = -lookbackRight, color = bullCond ? bullColor : noneColor): the value of
      // bar i is drawn on bar i - 1 (slot i here, the first one dropped in the result)
      const lbrTime = i - lookbackRight >= 0 ? bars[i - lookbackRight].time : NaN;
      pl[4][i] = { time: lbrTime, value: plFound ? fin(o) : NaN, color: bull ? color.green : NONE_COL };
      pl[5][i] = { time: lbrTime, value: phFound ? fin(o) : NaN, color: bear ? color.red : NONE_COL };
      const sadBuy = [
        cfg.maMode && bMA && cfg.bbMode && bBB,
        cfg.maMode && bMA && cfg.divergenceMode && bDiv,
        cfg.bbMode && bBB && cfg.divergenceMode && bDiv,
        cfg.maMode && bMA && cfg.bbMode && bBB && cfg.divergenceMode && bDiv,
      ];
      const sadSell = [
        cfg.maMode && sMA && cfg.bbMode && sBB,
        cfg.maMode && sMA && cfg.divergenceMode && sDiv,
        cfg.bbMode && sBB && cfg.divergenceMode && sDiv,
        cfg.maMode && sMA && cfg.bbMode && sBB && cfg.divergenceMode && sDiv,
      ];
      const sodBuy = bMA || bBB || bDiv;
      const sodSell = sMA || sBB || sDiv;
      const sadBuyAny = sadBuy.some(Boolean);
      const sadSellAny = sadSell.some(Boolean);
      pl[6][i] = { time, value: conn(cfg.maMode && bMA, cfg.maMode && sMA), color: NONE_COL };
      pl[7][i] = { time, value: conn(cfg.bbMode && bBB, cfg.bbMode && sBB), color: NONE_COL };
      pl[8][i] = { time, value: conn(cfg.divergenceMode && bDiv, cfg.divergenceMode && sDiv), color: NONE_COL };
      pl[9][i] = { time, value: conn(sadBuyAny, sadSellAny), color: NONE_COL };
      pl[10][i] = { time, value: conn(sodBuy, sodSell), color: NONE_COL };

      // Markers
      const markers = s.markers;
      // plotshape(bullCond ? mfiLBR : na, offset = -lookbackRight, triangleup, location.absolute, text = "Div") and the
      // bearish one (display.none: hidden by default, the host shows them from the Style settings); bullCond / bearCond
      // after the filters; the value of bar i is drawn on bar i - 1
      const lbr = fin(o);
      if (i - lookbackRight >= 0 && !isNaN(lbr)) {
        if (bull) {
          markers.push({ time: lbrTime, position: 'atPriceMiddle', price: lbr, shape: 'triangleUp', color: green,
            text: 'Div', textColor: PINE_TEXT, size: 'auto', id: 'shape0' });
        }
        if (bear) {
          markers.push({ time: lbrTime, position: 'atPriceMiddle', price: lbr, shape: 'triangleDown', color: red,
            text: 'Div', textColor: PINE_TEXT, size: 'auto', id: 'shape1' });
        }
      }
      // id: the Style-settings id of the plotshape (shape<k>, k over the plotshapes in declaration order)
      const pane = (on: boolean, buy: boolean, text: string, id: string) => {
        if (on) {
          markers.push({ time, position: buy ? 'bottom' : 'top', shape: buy ? 'triangleUp' : 'triangleDown',
            color: buy ? green : red, text, textColor: PINE_TEXT, size: 'auto', id });
        }
      };
      const chart = (on: boolean, buy: boolean, text: string, id: string) => {
        if (on) {
          markers.push({ time, position: buy ? 'belowBar' : 'aboveBar', shape: buy ? 'triangleUp' : 'triangleDown',
            color: buy ? green : red, text, textColor: PINE_TEXT, size: 'auto', forceOverlay: true, id });
        }
      };
      // Pane signals: location.bottom / location.top; divergence signals at mfiLBR (location.absolute)
      pane(cfg.maMode && bMA, true, 'MA', 'shape2');
      pane(cfg.maMode && sMA, false, 'MA', 'shape3');
      pane(cfg.bbMode && bBB, true, 'BB', 'shape4');
      pane(cfg.bbMode && sBB, false, 'BB', 'shape5');
      if (!isNaN(lbr)) {
        if (bDiv) {
          markers.push({ time, position: 'atPriceMiddle', price: lbr, shape: 'triangleUp', color: green, text: 'Div',
            textColor: PINE_TEXT, size: 'auto', id: 'shape6' });
        }
        if (sDiv) {
          markers.push({ time, position: 'atPriceMiddle', price: lbr, shape: 'triangleDown', color: red, text: 'Div',
            textColor: PINE_TEXT, size: 'auto', id: 'shape7' });
        }
      }
      // Chart signals (force_overlay)
      const none = cfg.andOrMode === 'None';
      chart(none && cfg.maMode && bMA, true, 'Buy', 'shape8');
      chart(none && cfg.maMode && sMA, false, 'Sell', 'shape9');
      chart(none && cfg.bbMode && bBB, true, 'Buy', 'shape10');
      chart(none && cfg.bbMode && sBB, false, 'Sell', 'shape11');
      chart(none && cfg.divergenceMode && bDiv, true, 'Buy', 'shape12');
      chart(none && cfg.divergenceMode && sDiv, false, 'Sell', 'shape13');
      if (cfg.andOrMode === 'MA and BB and Div') {
        const texts = ['MA+BB', 'MA+Div', 'BB+Div', 'MA+BB+Div'];
        sadBuy.forEach((on, k) => chart(on, true, texts[k], `shape${14 + k}`));
        sadSell.forEach((on, k) => chart(on, false, texts[k], `shape${18 + k}`));
      }
      if (cfg.andOrMode === 'MA or BB or Div') {
        chart(sodBuy, true, 'Buy', 'shape22');
        chart(sodSell, false, 'Sell', 'shape23');
      }

      // The alertconditions, in the original's order
      const flags = [
        cfg.maMode && bMA, cfg.maMode && sMA, cfg.bbMode && bBB, cfg.bbMode && sBB, cfg.divergenceMode && bDiv,
        cfg.divergenceMode && sDiv, sodBuy, sodSell, sadBuyAny, sadSellAny,
      ];
      for (let k = 0; k < flags.length; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    copyVars: (v) => ({ ...v, cross: v.cross.slice() }),
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = k === 4 || k === 5 ? p.slice(1) : p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: cfg.overboughtLowerLevel, options: { title: 'Upper Band', color: BAND_COL, linestyle: 'dashed' } },
          { value: 50, options: { title: 'Middle Level', color: BAND_COL, linestyle: 'dotted' } },
          { value: cfg.oversoldUpperLevel, options: { title: 'Lower Band', color: BAND_COL, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Background' },
            colors: new Array<string>(n).fill(String(color.rgb(126, 87, 194, 90))) },
          // fill(bbUpperBand, bbLowerBand, color = bbModeInput ? color.new(color.green, 90) : na)
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Bollinger Bands Background Fill' },
            colors: new Array<string>(n).fill(cfg.bbMode ? String(color.new(color.green, 90)) : 'transparent') },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MfiNexusProInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MfiNexusProInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MfiNexusPro = {
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
