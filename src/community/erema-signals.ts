/**
 * EREMA Signals (Ehlers Reverse EMA)
 *
 * An EMA of the close (alpha) is passed through eight reverse-EMA stages: re1 = (1 - alpha) * ema + ema[1], then
 * re_k = (1 - alpha)^(2^(k-1)) * re_(k-1) + re_(k-1)[1]. The Reverse EMA is ema - alpha * re8 (from bar 76). A moving
 * average (SMA / EMA / WMA / VWMA) of it is the signal line. Buy / sell triangles and a light background mark the
 * crosses of the Reverse EMA with zero, with its MA, or both (from bar 82).
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar) when "Enable Alerts" is on:
 * "Ehlers Reverse EMA: Buy Signal" on a buy triangle and "Ehlers Reverse EMA: Sell Signal" on a sell triangle.
 *
 * Reference: "EREMA Signals" by AlgoCollective
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoCollective
 */

import { taStep, color, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface EremaSignalsInputs {
  /** EMA alpha */
  alpha: number;
  /** No effect on the outputs (the Pine script does not use it) */
  maxbars: number;
  /** Moving average of the Reverse EMA */
  maType: 'SMA' | 'EMA' | 'WMA' | 'VWMA';
  maLength: number;
  signalType: 'Zero Cross' | 'MA Cross' | 'Zero & MA Cross';
  /** No effect on the outputs (the Pine plotshape calls use size.normal) */
  signalSize: 'Small' | 'Normal' | 'Large';
  /** The alert() calls are made (`alertCalls`); no effect on the other outputs */
  alertsOn: boolean;
}

export const defaultInputs: EremaSignalsInputs = {
  alpha: 0.1,
  maxbars: 500,
  maType: 'SMA',
  maLength: 14,
  signalType: 'Zero Cross',
  signalSize: 'Normal',
  alertsOn: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'alpha', type: 'float', title: 'Alpha', defval: 0.1, min: 0.01, max: 1.0, step: 0.01 },
  { id: 'maxbars', type: 'int', title: 'Max Bars', defval: 500, min: 10 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14, min: 1 },
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'Zero Cross', options: ['Zero Cross', 'MA Cross', 'Zero & MA Cross'] },
  { id: 'signalSize', type: 'string', title: 'Signal Size', defval: 'Normal', options: ['Small', 'Normal', 'Large'] },
  { id: 'alertsOn', type: 'bool', title: 'Enable Alerts', defval: false },
];

// No plot(): the outputs are the plotshape markers and the background
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'EREMA Signals',
  shortTitle: 'EREMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[]; alertCalls: AlertCall[] };

interface EremaVars {
  /** re1_1 .. re8_1 (var float = 0.0), changed in place */
  re1: number[];
  /** ema[1] (na on bar 0) */
  emaPrev: number;
}

interface EremaRun extends BarRunState<EremaVars> {
  ma: { step(v: number, volume: number): number; commit(): void };
  /** re_k_0 of the bar (recomputed on every bar) */
  re0: number[];
  reverseEma: number[];
  maArr: number[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<EremaSignalsInputs>): BarStudy<EremaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const alpha = cfg.alpha;
  const delta = 1 - alpha;
  const warmupPeriod = 75;

  // var float ema / re1_1 .. re8_1 = 0.0; re_k_0 are recomputed on every bar
  const p = [2, 4, 8, 16, 32, 64, 128].map((e) => math.pow(delta, e));

  const bullColor = color.rgb(0, 180, 0);
  const bearColor = color.rgb(255, 0, 0);
  const bull = String(bullColor);
  const bear = String(bearColor);
  const bullBg = String(color.new(bullColor, 95));
  const bearBg = String(color.new(bearColor, 95));

  // maValue = switch maType (only the selected call runs)
  const maStep = (): EremaRun['ma'] => {
    switch (cfg.maType) {
      case 'EMA': { const m = taStep.ema(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, cfg.maLength), commit: () => m.commit() }; }
      case 'VWMA': { const m = new WindowVwma(cfg.maLength); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = new WindowSma(cfg.maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };

  return {
    init() {
      const ma = maStep();
      const s: EremaRun = {
        ma, re0: new Array<number>(8), reverseEma: [], maArr: [], markers: [], bgColors: [], alertCalls: [],
        steps: [ma], vars: { re1: new Array<number>(8).fill(0), emaPrev: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, s.alertCalls];
      s.series = [s.reverseEma, s.maArr];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const re1 = v.re1;
      const re0 = s.re0;
      const close = b.close;
      const emaPrev = v.emaPrev;
      // ema := alpha * close + delta * nz(ema[1], close)
      const ema = alpha * close + delta * (isNaN(emaPrev) ? close : emaPrev);
      // re1_0 := delta * ema + nz(ema[1], ema)
      re0[0] = delta * ema + (isNaN(emaPrev) ? ema : emaPrev);
      for (let k = 1; k < 8; k++) re0[k] = p[k - 1] * re0[k - 1] + re1[k - 1];
      for (let k = 0; k < 8; k++) re1[k] = re0[k];
      v.emaPrev = ema;
      // reverseEma = na; if bar_index > warmupPeriod: reverseEma := ema - alpha * re8_0
      const r = i > warmupPeriod ? ema - alpha * re0[7] : NaN;
      s.reverseEma[i] = r;
      const m = s.ma.step(r, b.volume ?? NaN);
      s.maArr[i] = m;

      let buySignal = false;
      let sellSignal = false;
      if (i > warmupPeriod + 5) {
        const r1 = s.reverseEma[i - 1];
        const m1 = s.maArr[i - 1];
        if (cfg.signalType === 'Zero Cross') {
          buySignal = gt(r, 0) && le(r1, 0);
          sellSignal = lt(r, 0) && ge(r1, 0);
        } else if (cfg.signalType === 'MA Cross') {
          buySignal = gt(r, m) && le(r1, m1);
          sellSignal = lt(r, m) && ge(r1, m1);
        } else if (cfg.signalType === 'Zero & MA Cross') {
          buySignal = gt(r, 0) && gt(r, m) && (le(r1, 0) || le(r1, m1));
          sellSignal = lt(r, 0) && lt(r, m) && (ge(r1, 0) || ge(r1, m1));
        }
      }
      const t = b.time;
      // if alertsOn: if buySignal alert("Ehlers Reverse EMA: Buy Signal") / if sellSignal alert("... Sell Signal")
      if (cfg.alertsOn) {
        if (buySignal) s.alertCalls.push({ time: t, message: 'Ehlers Reverse EMA: Buy Signal', freq: 'once_per_bar' });
        if (sellSignal) s.alertCalls.push({ time: t, message: 'Ehlers Reverse EMA: Sell Signal', freq: 'once_per_bar' });
      }
      // plotshape(buySignal, 'Buy Signal', location.belowbar, bullColor, shape.triangleup, size.normal)
      if (buySignal) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: bull, size: 'normal' });
      // plotshape(sellSignal, 'Sell Signal', location.abovebar, bearColor, shape.triangledown, size.normal)
      if (sellSignal) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: bear, size: 'normal' });
      // bgcolor(buySignal ? color.new(bullColor, 95) : sellSignal ? color.new(bearColor, 95) : na)
      if (buySignal) s.bgColors.push({ time: t, color: bullBg });
      else if (sellSignal) s.bgColors.push({ time: t, color: bearBg });
    },
    copyVars: (v) => ({ re1: v.re1.slice(), emaPrev: v.emaPrev }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EremaSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EremaSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EremaSignals = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction };
