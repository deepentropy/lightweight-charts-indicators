/**
 * Auto AVWAP (Anchored VWAP) with Breakout Screener
 *
 * Two anchored VWAPs that re-anchor by themselves. The high AVWAP (of the high, or hlc3) is anchored at the highest
 * high so far, the low AVWAP (of the low, or hlc3) at the lowest low so far. A smoothed stochastic RSI (K = moving
 * average of the stochastic of the RSI, D = SMA of K) drives the "next" anchors: the next high anchor moves to each
 * new high while D is under the lower band (or the high makes a new pivot high), the next low anchor likewise with D
 * above the upper band. After a move up (D above the upper band) and a K drop under D and under the lower reversal
 * level, the high AVWAP takes the next high anchor; the low AVWAP does the same after a move down. Breakout: the close
 * crosses above the high AVWAP (triangle above the bar and a circle at the bar midpoint).
 *
 * Alerts (alertcondition, `alerts` of the result): "Resistance Broken" when the open (or the close, see useOpen) is
 * above the high AVWAP, "Support Broken" when it is below the low AVWAP, and "Breakout" for either of them.
 *
 * Reference: "Auto AVWAP (Anchored-VWAP) with Breakout Screener" by manoharvs
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Electrified (electrifiedtrading)
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowVwma,
  type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export type AutoAvwapKMode = 'SMA' | 'EMA' | 'WMA' | 'VWMA' | 'VAWMA';

export interface AutoAvwapWithBreakoutScreenerInputs {
  /** Use the high and the low instead of hlc3 for the AVWAPs */
  useHiLow: boolean;
  /** Use the open instead of the close for the alerts */
  useOpen: boolean;
  /** Moving average of the stochastic that gives K */
  kMode: AutoAvwapKMode;
  /** Source of the RSI */
  src: SourceType;
  /** K smoothing length */
  smoothK: number;
  /** D smoothing length */
  smoothD: number;
  /** RSI length */
  lengthRSI: number;
  /** Stochastic length */
  lengthStoch: number;
  lowerBand: number;
  upperBand: number;
  /** Level that, when broken down, signals a reversal */
  lowerReversal: number;
  /** Level that, when broken up, signals a reversal */
  upperReversal: number;
}

export const defaultInputs: AutoAvwapWithBreakoutScreenerInputs = {
  useHiLow: true,
  useOpen: true,
  kMode: 'WMA',
  src: 'hlc3',
  smoothK: 4,
  smoothD: 4,
  lengthRSI: 55,
  lengthStoch: 21,
  lowerBand: 20,
  upperBand: 80,
  lowerReversal: 20,
  upperReversal: 80,
};

export const inputConfig: InputConfig[] = [
  { id: 'useHiLow', type: 'bool', title: 'Use High/Low instead of HLC3', defval: true, group: 'Anchored VWAP' },
  { id: 'useOpen', type: 'bool', title: 'Use open instead of close for alerts.', defval: true, group: 'Anchored VWAP' },
  { id: 'kMode', type: 'string', title: 'K Mode', defval: 'WMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'VAWMA'], group: 'Stochastic RSI' },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3', group: 'Stochastic RSI' },
  { id: 'smoothK', type: 'int', title: 'K', defval: 4, min: 1, group: 'Stochastic RSI' },
  { id: 'smoothD', type: 'int', title: 'D', defval: 4, min: 1, group: 'Stochastic RSI' },
  { id: 'lengthRSI', type: 'int', title: 'RSI', defval: 55, min: 1, group: 'Lengths' },
  { id: 'lengthStoch', type: 'int', title: 'Stochastic', defval: 21, min: 1, group: 'Lengths' },
  { id: 'lowerBand', type: 'int', title: 'Lower', defval: 20, min: 0, max: 50, group: 'Band' },
  { id: 'upperBand', type: 'int', title: 'Upper', defval: 80, min: 50, max: 100, group: 'Band' },
  { id: 'lowerReversal', type: 'int', title: 'Lower', defval: 20, min: 0, max: 100, group: 'Reversal' },
  { id: 'upperReversal', type: 'int', title: 'Upper', defval: 80, min: 0, max: 100, group: 'Reversal' },
];

const HIGH_NEXT = String(color.new(color.red, 75));
const LOW_NEXT = String(color.new(color.green, 75));
const HIGH = String(color.new(color.red, 50));
const LOW = String(color.new(color.green, 50));
const BREAKOUT = String(color.new(color.green, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'High Next', color: HIGH_NEXT, lineWidth: 1, style: 'circles' },
  { id: 'plot1', title: 'Low Next', color: LOW_NEXT, lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'High', color: HIGH, lineWidth: 2, style: 'circles' },
  { id: 'plot3', title: 'Low', color: LOW, lineWidth: 2, style: 'circles' },
  { id: 'plot4', title: 'Breakout Above High Overlay', color: BREAKOUT, lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'Auto AVWAP (Anchored-VWAP) with Breakout Screener',
  shortTitle: 'Auto AVWAP Breakout',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** Pine nz(): na and +-infinity give the replacement */
const nz = (x: number, r: number) => (Number.isFinite(x) ? x : r);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface AvwapVars {
  hi: number;
  lo: number;
  phi: number;
  plo: number;
  state: number;
  hiS: number;
  loS: number;
  hiV: number;
  loV: number;
  hiSNext: number;
  loSNext: number;
  hiVNext: number;
  loVNext: number;
}

interface AvwapRun extends BarRunState<AvwapVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  stoch: ReturnType<typeof taStep.stoch>;
  /** K = getMA(stoch, kMode, smoothK) on bar i */
  k: (x: number, volume: number, i: number) => number;
  d: WindowSma;
  volume: number[];
  stochArr: number[];
  hiAVWAP: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AutoAvwapWithBreakoutScreenerInputs>): BarStudy<AvwapRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: AvwapRun = {
        rsi: taStep.rsi(cfg.lengthRSI), stoch: taStep.stoch(cfg.lengthStoch), k: () => NaN, d: new WindowSma(1),
        volume: [], stochArr: [], hiAVWAP: [], plots: [[], [], [], [], []], markers: [], flags: [[], [], []],
        times: [[], [], []], steps: [],
        vars: {
          hi: NaN, lo: NaN, phi: NaN, plo: NaN, state: 0, hiS: 0, loS: 0, hiV: 0, loV: 0, hiSNext: 0, loSNext: 0,
          hiVNext: 0, loVNext: 0,
        },
        lists: [], series: [],
      };
      const len = cfg.smoothK;
      let kStep: Committable | null = null;
      switch (cfg.kMode) {
        case 'WMA': {
          const m = taStep.wma();
          kStep = m;
          s.k = (x) => m.step(x, len);
          break;
        }
        case 'EMA': {
          const m = taStep.ema(len);
          kStep = m;
          s.k = (x) => m.step(x);
          break;
        }
        case 'VWMA': {
          const m = new WindowVwma(len);
          kStep = m;
          s.k = (x, vol) => m.step(x, vol);
          break;
        }
        case 'VAWMA':
          // vawma(src, len): sum(src[len - m] * volume[len - m] * m) / sum(volume[len - m] * m), m = 1..len
          s.k = (_x, _vol, bar) => {
            let sum = 0;
            let vol = 0;
            for (let m = 1; m <= len; m++) {
              const i = len - m;
              const v = bar - i >= 0 ? s.volume[bar - i] * m : NaN;
              vol = vol + v;
              sum = sum + (bar - i >= 0 ? s.stochArr[bar - i] : NaN) * v;
            }
            return sum / vol;
          };
          break;
        default: {
          const m = new WindowSma(len);
          kStep = m;
          s.k = (x) => m.step(x);
        }
      }
      s.d = new WindowSma(cfg.smoothD);
      s.steps = [s.rsi, s.stoch, ...(kStep ? [kStep] : []), s.d];
      s.lists = [s.markers, ...s.times];
      s.series = [s.volume, s.stochArr, s.hiAVWAP, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { high, low, close, time } = b;
      const v = s.vars;
      const volume = b.volume ?? NaN;
      s.volume[i] = volume;
      const rsi1 = s.rsi.step(value(b));
      const stoch = s.stoch.step(rsi1, rsi1, rsi1);
      s.stochArr[i] = stoch;
      const k = s.k(stoch, volume, i);
      const d = s.d.step(k);

      if (i === 0) {
        v.hi = bars[0].high;
        v.lo = bars[0].low;
        v.phi = bars[0].high;
        v.plo = bars[0].low;
      }
      if (lt(d, cfg.lowerBand) || gt(high, v.phi)) {
        v.phi = high;
        v.hiSNext = 0;
        v.hiVNext = 0;
      }
      if (gt(d, cfg.upperBand) || lt(low, v.plo)) {
        v.plo = low;
        v.loSNext = 0;
        v.loVNext = 0;
      }
      if (gt(high, v.hi)) {
        v.hi = high;
        v.hiS = 0;
        v.hiV = 0;
      }
      if (lt(low, v.lo)) {
        v.lo = low;
        v.loS = 0;
        v.loV = 0;
      }
      const hlc3 = (high + low + close) / 3;
      const vwapHi = cfg.useHiLow ? high : hlc3;
      const vwapLo = cfg.useHiLow ? low : hlc3;
      const vol = volume;
      v.hiS += vwapHi * vol;
      v.loS += vwapLo * vol;
      v.hiV += vol;
      v.loV += vol;
      v.hiSNext += vwapHi * vol;
      v.loSNext += vwapLo * vol;
      v.hiVNext += vol;
      v.loVNext += vol;

      if (v.state !== -1 && lt(d, cfg.lowerBand)) v.state = -1;
      else if (v.state !== 1 && gt(d, cfg.upperBand)) v.state = 1;
      if (gt(v.hi, v.phi) && v.state === 1 && lt(k, d) && lt(k, cfg.lowerReversal)) {
        v.hi = v.phi;
        v.hiS = v.hiSNext;
        v.hiV = v.hiVNext;
      }
      if (lt(v.lo, v.plo) && v.state === -1 && gt(k, d) && gt(k, cfg.upperReversal)) {
        v.lo = v.plo;
        v.loS = v.loSNext;
        v.loV = v.loVNext;
      }
      const hiAVWAP = v.hiS / v.hiV;
      const loAVWAP = v.loS / v.loV;
      s.hiAVWAP[i] = hiAVWAP;

      // breakout_above_high = close > hiAVWAP and nz(close[1], close) <= nz(hiAVWAP[1], hiAVWAP)
      const breakout = gt(close, hiAVWAP)
        && le(nz(i > 0 ? bars[i - 1].close : NaN, close), nz(i > 0 ? s.hiAVWAP[i - 1] : NaN, hiAVWAP));
      if (breakout) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleUp', color: color.green, size: 'small' });
      }

      s.plots[0][i] = { time, value: fin(v.hiSNext / v.hiVNext), color: HIGH_NEXT };
      s.plots[1][i] = { time, value: fin(v.loSNext / v.loVNext), color: LOW_NEXT };
      s.plots[2][i] = { time, value: fin(hiAVWAP), color: HIGH };
      s.plots[3][i] = { time, value: fin(loAVWAP), color: LOW };
      s.plots[4][i] = { time, value: breakout ? (high + low) / 2 : NaN, color: BREAKOUT };

      // alertValue = useOpen ? open : close; resistance = alertValue - hiAVWAP; support = alertValue - loAVWAP
      const resistanceBroken = gt((cfg.useOpen ? b.open : close) - hiAVWAP, 0);
      const supportBroken = lt((cfg.useOpen ? b.open : close) - loAVWAP, 0);
      // alertcondition(resistance > 0 or support < 0) / (resistance > 0) / (support < 0)
      const flags = [resistanceBroken || supportBroken, resistanceBroken, supportBroken];
      for (let k2 = 0; k2 < 3; k2++) {
        s.flags[k2][i] = flags[k2];
        if (flags[k2]) s.times[k2].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoAvwapWithBreakoutScreenerInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AutoAvwapWithBreakoutScreenerInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Breakout (▲▼)', message: 'Breakout ({{ticker}} {{interval}})' },
  { id: 'alert1', title: 'Resistance Broken ▲', message: 'Resistance Broken ▲ ({{ticker}} {{interval}})' },
  { id: 'alert2', title: 'Support Broken ▼', message: 'Support Broken ▼ ({{ticker}} {{interval}})' },
];

export const AutoAvwapWithBreakoutScreener = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
