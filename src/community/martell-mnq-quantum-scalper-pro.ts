/**
 * Martell MNQ Quantum Scalper Pro
 *
 * Trend: ALMA(close, 150, 0.85, 6). Choppiness index over 14 bars: 100 * log10(sum(ATR(1), 14) / (highest high -
 * lowest low)) / log10(14) (50 on a zero range); trending below 50. TSI: 100 * EMA(EMA(change, 13), 25) /
 * EMA(EMA(|change|, 13), 25) with an EMA(7) signal. A long entry when close > ALMA, trending, and the TSI crosses
 * over its signal below 0; a short entry when close < ALMA, trending, and the TSI crosses under its signal above 0.
 * Only one trade at a time: stop loss and take profit at entry -+ 2.5 * ATR(14) (long) or entry +- 2.5 * ATR(14)
 * (short); the trade closes when the bar touches either level. The SL / TP lines and a green / red background show
 * the open trade. The script parameters are constants (no inputs).
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close): one call on each bar of a long entry and
 * one on each bar of a short entry, with the original's messages.
 *
 * Reference: "Martell MNQ Quantum Scalper Pro" by JMartell
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSum, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

/** The original makes alert() calls (`alertCalls` of the result) */
export const hasAlertFunction = true;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface MartellMnqQuantumScalperProInputs {}

export const defaultInputs: MartellMnqQuantumScalperProInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ALMA Macro Trend', color: String(color.new(color.blue, 20)), lineWidth: 2 },
  { id: 'plot1', title: 'Long SL', color: color.red, lineWidth: 2, style: 'linebr' },
  { id: 'plot2', title: 'Long TP', color: color.green, lineWidth: 2, style: 'linebr' },
  { id: 'plot3', title: 'Short SL', color: color.red, lineWidth: 2, style: 'linebr' },
  { id: 'plot4', title: 'Short TP', color: color.green, lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'Martell MNQ Quantum Scalper Pro',
  shortTitle: 'Martell MNQ Quantum Scalper Pro',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

// Script constants
const ALMA_LENGTH = 150;
const ALMA_OFFSET = 0.85;
const ALMA_SIGMA = 6.0;
const CHOP_LENGTH = 14;
const CHOP_LIMIT = 50.0;
const TSI_LONG = 25;
const TSI_SHORT = 13;
const TSI_SIGNAL = 7;
const ATR_PERIOD = 14;
const ATR_MULT = 2.5;

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[]; alertCalls: AlertCall[] };

/** ta.alma(source, length, offset, sigma): the weighted sum of the last `length` values, in the order of the oakscriptjs function */
class AlmaStep implements Committable {
  private readonly weights: number[] = [];
  private readonly values: number[] = [];
  private current = NaN;
  private stepped = false;

  constructor(private readonly length: number, offset: number, sigma: number) {
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

interface MartellVars {
  /** var int tradeState = 0, var float slPrice = na, var float tpPrice = na */
  tradeState: number;
  slPrice: number;
  tpPrice: number;
}

interface MartellRun extends BarRunState<MartellVars> {
  alma: AlmaStep;
  atr1: ReturnType<typeof taStep.atr>;
  atrSum: WindowSum;
  hh: WindowExtreme;
  ll: WindowExtreme;
  pc: ReturnType<typeof taStep.change>;
  pcS: ReturnType<typeof taStep.ema>;
  pcL: ReturnType<typeof taStep.ema>;
  absS: ReturnType<typeof taStep.ema>;
  absL: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  up: ReturnType<typeof taStep.crossover>;
  dn: ReturnType<typeof taStep.crossunder>;
  atr: ReturnType<typeof taStep.atr>;
  plots: Point[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
  alertCalls: AlertCall[];
}

function study(): BarStudy<MartellRun, Result> {
  const bgLong = String(color.new(color.green, 90));
  const bgShort = String(color.new(color.red, 90));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: MartellRun = {
        alma: new AlmaStep(ALMA_LENGTH, ALMA_OFFSET, ALMA_SIGMA),
        atr1: taStep.atr(1), atrSum: new WindowSum(CHOP_LENGTH),
        hh: new WindowExtreme(false, CHOP_LENGTH), ll: new WindowExtreme(true, CHOP_LENGTH),
        pc: taStep.change(), pcS: taStep.ema(TSI_SHORT), pcL: taStep.ema(TSI_LONG),
        absS: taStep.ema(TSI_SHORT), absL: taStep.ema(TSI_LONG), sig: taStep.ema(TSI_SIGNAL),
        up: taStep.crossover(), dn: taStep.crossunder(), atr: taStep.atr(ATR_PERIOD),
        plots: [[], [], [], [], []], markers: [], bgColors: [], alertCalls: [],
        steps: [], vars: { tradeState: 0, slPrice: NaN, tpPrice: NaN }, lists: [], series: [],
      };
      s.steps = [s.alma, s.atr1, s.atrSum, s.hh, s.ll, s.pc, s.pcS, s.pcL, s.absS, s.absL, s.sig, s.up, s.dn, s.atr];
      s.lists = [s.markers, s.bgColors, s.alertCalls];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // macroTrend = ta.alma(close, almaLength, almaOffset, almaSigma)
      const macroTrend = s.alma.step(b.close);

      // Choppiness index
      const atrSum = s.atrSum.step(s.atr1.step(b.high, b.low, b.close));
      const rangeChop = s.hh.step(b.high) - s.ll.step(b.low);
      const chop = eq(rangeChop, 0) ? 50 : (100 * Math.log10(atrSum / rangeChop)) / Math.log10(CHOP_LENGTH);

      // TSI: double_smooth(src, long, short) => ta.ema(ta.ema(src, short), long)
      const pc = s.pc.step(b.close);
      const dsPc = s.pcL.step(s.pcS.step(pc));
      const dsAbsPc = s.absL.step(s.absS.step(Math.abs(pc)));
      // A plain division: 0 / 0 is na; ta.ema skips non-finite values
      const tsi = 100 * (dsPc / dsAbsPc);
      const tsiEma = s.sig.step(tsi);
      const crossUp = s.up.step(tsi, tsiEma);
      const crossDn = s.dn.step(tsi, tsiEma);
      const atr = s.atr.step(b.high, b.low, b.close);

      const isTrending = lt(chop, CHOP_LIMIT);
      const bullishCross = crossUp && lt(tsi, 0);
      const bearishCross = crossDn && gt(tsi, 0);
      const longCond = gt(b.close, macroTrend) && isTrending && bullishCross;
      const shortCond = lt(b.close, macroTrend) && isTrending && bearishCross;

      // A. Close the open trade when the bar touches the SL or the TP
      if (v.tradeState === 1) {
        if (ge(b.high, v.tpPrice) || le(b.low, v.slPrice)) v.tradeState = 0;
      }
      if (v.tradeState === -1) {
        if (le(b.low, v.tpPrice) || ge(b.high, v.slPrice)) v.tradeState = 0;
      }

      // B. New entries only without an open trade
      const triggerLong = longCond && v.tradeState === 0;
      const triggerShort = shortCond && v.tradeState === 0;
      if (triggerLong) {
        v.tradeState = 1;
        v.slPrice = b.close - atr * ATR_MULT;
        v.tpPrice = b.close + atr * ATR_MULT;
      }
      if (triggerShort) {
        v.tradeState = -1;
        v.slPrice = b.close + atr * ATR_MULT;
        v.tpPrice = b.close - atr * ATR_MULT;
      }
      const { tradeState, slPrice, tpPrice } = v;

      s.plots[0][i] = { time: b.time, value: fin(macroTrend) };
      s.plots[1][i] = { time: b.time, value: tradeState === 1 ? fin(slPrice) : NaN };
      s.plots[2][i] = { time: b.time, value: tradeState === 1 ? fin(tpPrice) : NaN };
      s.plots[3][i] = { time: b.time, value: tradeState === -1 ? fin(slPrice) : NaN };
      s.plots[4][i] = { time: b.time, value: tradeState === -1 ? fin(tpPrice) : NaN };

      if (triggerLong) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.rgb(0, 255, 128),
          text: 'BUY', textColor: '#2962FF', size: 'normal' });
      }
      if (triggerShort) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.rgb(255, 0, 64),
          text: 'SELL', textColor: '#2962FF', size: 'normal' });
      }

      // bgcolor(tradeState == 1 ? green 90 : tradeState == -1 ? red 90 : na, title = "Trade Window")
      if (tradeState === 1) s.bgColors.push({ time: b.time, color: bgLong });
      else if (tradeState === -1) s.bgColors.push({ time: b.time, color: bgShort });

      // if triggerLong / triggerShort: alert(..., alert.freq_once_per_bar_close)
      if (triggerLong) {
        s.alertCalls.push({ time: b.time, message: '¡COMPRA MNQ! RR 1:1. Entrada detectada. Gestiona el riesgo.', freq: 'once_per_bar_close' });
      }
      if (triggerShort) {
        s.alertCalls.push({ time: b.time, message: '¡VENTA MNQ! RR 1:1. Entrada detectada. Gestiona el riesgo.', freq: 'once_per_bar_close' });
      }
    },
    result(s) {
      const [plot0, plot1, plot2, plot3, plot4] = s.plots.map((p) => p.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4 },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<MartellMnqQuantumScalperProInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<MartellMnqQuantumScalperProInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[]; alertCalls: AlertCall[] } {
  return fullResult(createRun(_inputs).update(bars));
}

export const MartellMnqQuantumScalperPro = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
