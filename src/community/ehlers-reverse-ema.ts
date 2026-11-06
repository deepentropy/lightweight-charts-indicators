/**
 * Ehlers Reverse EMA
 *
 * An EMA of the close (ema = alpha * close + (1 - alpha) * ema[1]) and the Ehlers reverse EMA cascade:
 * re1 = d * ema + ema[1], then re(k+1) = d^(2^k) * re(k) + re(k)[1] for eight stages (d = 1 - alpha).
 * The line is ema - alpha * re8 after 75 bars, green above zero and red otherwise, with an SMA / EMA / WMA / VWMA of
 * it. Optional triangle signals on zero crosses, MA crosses or both.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar) when "Enable Alerts" is on:
 * "Ehlers Reverse EMA: Buy Signal" on a buy signal and "Ehlers Reverse EMA: Sell Signal" on a sell signal (the
 * signals are computed only when "Show Signals" is on, as in the original).
 *
 * Reference: "Ehlers Reverse EMA" by AlgoCollective
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AlgoCollective
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface EhlersReverseEmaInputs {
  alpha: number;
  /** Max Bars (not used by the computation) */
  maxbars: number;
  showMA: boolean;
  maType: 'SMA' | 'EMA' | 'WMA' | 'VWMA';
  maLength: number;
  showSignals: boolean;
  signalType: 'Zero Cross' | 'MA Cross' | 'Zero & MA Cross';
  plotArrows: boolean;
  /** Enable Alerts: the alert() calls are made (`alertCalls`); no effect on the other outputs */
  alertsOn: boolean;
}

export const defaultInputs: EhlersReverseEmaInputs = {
  alpha: 0.1,
  maxbars: 500,
  showMA: true,
  maType: 'SMA',
  maLength: 14,
  showSignals: false,
  signalType: 'Zero Cross',
  plotArrows: true,
  alertsOn: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'alpha', type: 'float', title: 'Alpha', defval: 0.1, min: 0.01, max: 1.0, step: 0.01, group: 'Main Settings' },
  { id: 'maxbars', type: 'int', title: 'Max Bars', defval: 500, min: 10, group: 'Main Settings' },
  { id: 'showMA', type: 'bool', title: 'Show Moving Average', defval: true, group: 'Moving Average' },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'SMA', options: ['SMA', 'EMA', 'WMA', 'VWMA'], group: 'Moving Average' },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 14, min: 1, group: 'Moving Average' },
  { id: 'showSignals', type: 'bool', title: 'Show Signals', defval: false, group: 'Signal Settings' },
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'Zero Cross', options: ['Zero Cross', 'MA Cross', 'Zero & MA Cross'], group: 'Signal Settings' },
  { id: 'plotArrows', type: 'bool', title: 'Plot Arrows on Chart', defval: true, group: 'Signal Settings' },
  { id: 'alertsOn', type: 'bool', title: 'Enable Alerts', defval: false, group: 'Signal Settings' },
];

const bullColor = 'rgb(0, 180, 0)';
const bearColor = 'rgb(255, 0, 0)';
const maColor = 'rgb(255, 165, 0)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Reverse EMA', color: bullColor, lineWidth: 1 },
  { id: 'plot1', title: 'MA', color: maColor, lineWidth: 1 },
];

export const metadata = {
  title: 'Ehlers Reverse EMA',
  shortTitle: 'Ehlers Reverse EMA',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface EreVars {
  /** ema[1]: na on the first bar */
  emaPrev: number;
  /** re1_1 .. re8_1 (var float = 0.0), changed in place */
  re1: number[];
}

interface EreRun extends BarRunState<EreVars> {
  ma: Ma;
  reverseEma: number[];
  maValue: number[];
  plot0: { time: number; value: number; color: string }[];
  plot1: { time: number; value: number }[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<EhlersReverseEmaInputs>): BarStudy<EreRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { alpha, maLength } = cfg;
  const delta = 1 - alpha;
  const warmupPeriod = 75;
  // math.pow(delta, 2^k) of the stages 2..8
  const pows = [2, 4, 8, 16, 32, 64, 128].map((e) => Math.pow(delta, e));
  const re0 = new Array(8);
  const maStep = (): Ma => {
    switch (cfg.maType) {
      case 'EMA': { const m = taStep.ema(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, maLength), commit: () => m.commit() }; }
      case 'VWMA': { const m = new WindowVwma(maLength); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = new WindowSma(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  return {
    init() {
      const ma = maStep();
      const s: EreRun = {
        ma, reverseEma: [], maValue: [], plot0: [], plot1: [], markers: [], alertCalls: [],
        steps: [ma], vars: { emaPrev: NaN, re1: new Array(8).fill(0) }, lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls];
      s.series = [s.reverseEma, s.maValue, s.plot0, s.plot1];
      return s;
    },
    copyVars: (v) => ({ emaPrev: v.emaPrev, re1: v.re1.slice() }),
    bar(s, i, bars) {
      const v = s.vars;
      const re1 = v.re1;
      const b = bars[i];
      const close = b.close;
      const emaPrev = v.emaPrev;
      // ema := alpha * close + delta * nz(ema[1], close)
      const ema = alpha * close + delta * (isNaN(emaPrev) ? close : emaPrev);
      // re1_0 := delta * ema + nz(ema[1], ema)
      re0[0] = delta * ema + (isNaN(emaPrev) ? ema : emaPrev);
      for (let k = 1; k < 8; k++) re0[k] = pows[k - 1] * re0[k - 1] + re1[k - 1];
      for (let k = 0; k < 8; k++) re1[k] = re0[k];
      const re = i > warmupPeriod ? ema - alpha * re0[7] : NaN;
      s.reverseEma[i] = re;
      v.emaPrev = ema;

      const maV = s.ma.step(re, b.volume ?? NaN);
      s.maValue[i] = maV;

      const rePrev = i > 0 ? s.reverseEma[i - 1] : NaN;
      const maPrev = i > 0 ? s.maValue[i - 1] : NaN;
      let buySignal = false;
      let sellSignal = false;
      if (cfg.showSignals && i > warmupPeriod + 5) {
        if (cfg.signalType === 'Zero Cross') {
          buySignal = gt(re, 0) && le(rePrev, 0);
          sellSignal = lt(re, 0) && ge(rePrev, 0);
        } else if (cfg.signalType === 'MA Cross') {
          buySignal = gt(re, maV) && le(rePrev, maPrev);
          sellSignal = lt(re, maV) && ge(rePrev, maPrev);
        } else if (cfg.signalType === 'Zero & MA Cross') {
          buySignal = gt(re, 0) && gt(re, maV) && (le(rePrev, 0) || le(rePrev, maPrev));
          sellSignal = lt(re, 0) && lt(re, maV) && (ge(rePrev, 0) || ge(rePrev, maPrev));
        }
      }
      const t = b.time;
      // if alertsOn: if buySignal alert("Ehlers Reverse EMA: Buy Signal", alert.freq_once_per_bar) / same for sell
      if (cfg.alertsOn) {
        if (buySignal) s.alertCalls.push({ time: t, message: 'Ehlers Reverse EMA: Buy Signal', freq: 'once_per_bar' });
        if (sellSignal) s.alertCalls.push({ time: t, message: 'Ehlers Reverse EMA: Sell Signal', freq: 'once_per_bar' });
      }
      s.plot0[i] = { time: t, value: re, color: gt(re, 0) ? bullColor : bearColor };
      s.plot1[i] = { time: t, value: cfg.showMA ? maV : NaN };
      // plotshape(buySignal and plotArrows ? reverseEma : na, location.absolute, shape.triangleup, size.small)
      if (buySignal && cfg.plotArrows && !isNaN(re)) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: re, shape: 'triangleUp', color: bullColor, size: 'small' });
      }
      if (sellSignal && cfg.plotArrows && !isNaN(re)) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: re, shape: 'triangleDown', color: bearColor, size: 'small' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: String(color.new(color.gray, 0)), linestyle: 'solid' } }],
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EhlersReverseEmaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EhlersReverseEmaInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EhlersReverseEma = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
