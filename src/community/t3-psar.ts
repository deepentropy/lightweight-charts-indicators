/**
 * TKP T3 Trend with PSAR
 *
 * Tillson T3 moving average combined with Parabolic SAR for trend confirmation.
 * T3 uses a 6-stage EMA cascade with volume factor coefficients.
 * PSAR provides additional trend direction via manual computation.
 * Heikin-Ashi bars (plotbar 'Heikin-Ashi', `plotBars.ha` of the result) on every bar, coloured only with the
 * Heikin-Ashi overlay input (else transparent).
 * Alerts (alertcondition, `alerts` of the result): 'Close crosses T3' (close crosses the T3 Slow) and 'T3 crossing T3'
 * (T3 Slow crosses T3 Fast).
 *
 * Reference: "TKP T3 Trend with PSAR"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, PlotBarData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Close crosses T3', message: 'Reversal candle is forming!' },
  { id: 'alert1', title: 'T3 crossing T3', message: 'A new trend may be forming!' },
];

export interface T3PsarInputs {
  t3Len: number;
  t3SlowLen: number;
  t3Factor: number;
  sarStart: number;
  sarInc: number;
  sarMax: number;
  src: SourceType;
  showHA: boolean;
}

export const defaultInputs: T3PsarInputs = {
  t3Len: 5,
  t3SlowLen: 8,
  t3Factor: 0.7,
  sarStart: 0.02,
  sarInc: 0.02,
  sarMax: 0.2,
  src: 'close',
  showHA: false,
};

export const inputConfig: InputConfig[] = [
  { id: 't3Len', type: 'int', title: 'T3 Fast Length', defval: 5, min: 1 },
  { id: 't3SlowLen', type: 'int', title: 'T3 Slow Length', defval: 8, min: 1 },
  { id: 't3Factor', type: 'float', title: 'T3 Volume Factor', defval: 0.7, min: 0, max: 1, step: 0.01 },
  { id: 'sarStart', type: 'float', title: 'SAR Start', defval: 0.02, min: 0.001, step: 0.01 },
  { id: 'sarInc', type: 'float', title: 'SAR Increment', defval: 0.02, min: 0.001, step: 0.01 },
  { id: 'sarMax', type: 'float', title: 'SAR Max', defval: 0.2, min: 0.01, step: 0.01 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showHA', type: 'bool', title: 'Heikin-Ashi Bar Overlay', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3 Fast', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Up SAR', color: '#64B5F6', lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'Down SAR', color: '#EF5350', lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'T3 Slow', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'TKP T3 Trend with PSAR',
  shortTitle: 'T3+SAR',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; plotBars: Record<string, PlotBarData[]> } & { alerts: AlertConditionState[] };
type Ema = ReturnType<typeof taStep.ema>;

interface T3Vars {
  /** Manual SAR state */
  af: number;
  ep: number;
}

interface T3Run extends BarRunState<T3Vars> {
  fastEmas: Ema[];
  slowEmas: Ema[];
  pcEma1: Ema;
  pcEma2: Ema;
  absEma1: Ema;
  absEma2: Ema;
  sigEma: Ema;
  t3: number[];
  t3Slow: number[];
  sar: number[];
  sarDir: number[];
  haOpen: number[];
  haClose: number[];
  tsi: number[];
  plots: Point[][];
  haBars: PlotBarData[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<T3PsarInputs>): BarStudy<T3Run, Result> {
  const { t3Len, t3SlowLen, t3Factor, sarStart, sarInc, sarMax, src, showHA } = { ...defaultInputs, ...inputs };
  const value = barSource(src);

  // T3 coefficients
  const a = t3Factor;
  const c1 = -a * a * a;
  const c2 = 3 * a * a + 3 * a * a * a;
  const c3 = -6 * a * a - 3 * a - 3 * a * a * a;
  const c4 = 1 + 3 * a + a * a * a + 3 * a * a;
  const warmup = Math.max(t3Len, t3SlowLen) * 6;
  const tsiWarmup = 30 + 14;

  /** The 6-stage EMA cascade: e6 * c1 + e5 * c2 + e4 * c3 + e3 * c4 */
  const cascade = (emas: Ema[], x: number): number => {
    const e1 = emas[0]!.step(x);
    const e2 = emas[1]!.step(e1);
    const e3 = emas[2]!.step(e2);
    const e4 = emas[3]!.step(e3);
    const e5 = emas[4]!.step(e4);
    const e6 = emas[5]!.step(e5);
    return e6 * c1 + e5 * c2 + e4 * c3 + e3 * c4;
  };
  const trendPoint = (arr: number[], i: number, time: number): Point => {
    const val = i < warmup ? NaN : (arr[i] ?? NaN);
    if (isNaN(val)) return { time, value: NaN };
    const prev = i > 0 ? (arr[i - 1] ?? NaN) : NaN;
    const color = val > prev ? '#64B5F6' : val < prev ? '#EF5350' : '#FFEB3B';
    return { time, value: val, color };
  };

  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init(bars) {
      // the SAR starts from the first bar (the original reads it without a check)
      if (bars.length === 0) void bars[0]!.high;
      const s: T3Run = {
        // T3 Fast / T3 Slow calculation: 6-stage EMA cascades
        fastEmas: Array.from({ length: 6 }, () => taStep.ema(t3Len)),
        slowEmas: Array.from({ length: 6 }, () => taStep.ema(t3SlowLen)),
        // double_smooth(src, long, short) = ema(ema(src, long), short)
        pcEma1: taStep.ema(25), pcEma2: taStep.ema(5),
        absEma1: taStep.ema(25), absEma2: taStep.ema(5),
        sigEma: taStep.ema(14),
        t3: [], t3Slow: [], sar: [], sarDir: [], haOpen: [], haClose: [], tsi: [],
        plots: Array.from({ length: 4 }, () => []),
        haBars: [], markers: [], barColors: [],
        flags: [[], []], times: [[], []],
        steps: [],
        vars: { af: sarStart, ep: NaN },
        lists: [], series: [],
      };
      s.steps = [...s.fastEmas, ...s.slowEmas, s.pcEma1, s.pcEma2, s.absEma1, s.absEma2, s.sigEma];
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.t3, s.t3Slow, s.sar, s.sarDir, s.haOpen, s.haClose, s.tsi, ...s.plots, s.haBars, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      const time = bar.time;
      const x = value(bar);
      const t3 = cascade(s.fastEmas, x);
      const t3Slow = cascade(s.slowEmas, x);
      s.t3[i] = t3;
      s.t3Slow[i] = t3Slow;

      // Manual SAR computation
      if (i === 0) {
        v.af = sarStart;
        v.ep = bar.high;
        s.sar[0] = bar.low;
        s.sarDir[0] = 1;
      } else {
        const prevDir = s.sarDir[i - 1];
        let sar = s.sar[i - 1]! + v.af * (v.ep - s.sar[i - 1]!);
        if (prevDir === 1) {
          sar = Math.min(sar, bars[i - 1].low);
          if (i >= 2) sar = Math.min(sar, bars[i - 2].low);
          if (bar.low < sar) {
            s.sarDir[i] = -1;
            sar = v.ep;
            v.ep = bar.low;
            v.af = sarStart;
          } else {
            s.sarDir[i] = 1;
            if (bar.high > v.ep) {
              v.ep = bar.high;
              v.af = Math.min(v.af + sarInc, sarMax);
            }
          }
        } else {
          sar = Math.max(sar, bars[i - 1].high);
          if (i >= 2) sar = Math.max(sar, bars[i - 2].high);
          if (bar.high > sar) {
            s.sarDir[i] = 1;
            sar = v.ep;
            v.ep = bar.high;
            v.af = sarStart;
          } else {
            s.sarDir[i] = -1;
            if (bar.low < v.ep) {
              v.ep = bar.low;
              v.af = Math.min(v.af + sarInc, sarMax);
            }
          }
        }
        s.sar[i] = sar;
      }
      const sarV = s.sar[i]!;

      // Heikin-Ashi OHLC (Pine lines 116-120)
      const { open: o, high: h, low: l, close: c } = bar;
      const hc = (o + h + l + c) / 4;
      const ho = i === 0 ? (o + c) / 2 : (s.haOpen[i - 1]! + s.haClose[i - 1]!) / 2;
      s.haClose[i] = hc;
      s.haOpen[i] = ho;
      const haHigh = Math.max(h, ho, hc);
      const haLow = Math.min(l, ho, hc);

      const p = s.plots;
      p[0]![i] = trendPoint(s.t3, i, time);
      // Up SAR: shown only when close >= SAR (bullish, Pine: colUp = close >= sarDown ? #64b5f6 : na)
      p[1]![i] = { time, value: (i < 1 || c < sarV) ? NaN : sarV, color: '#64B5F6' };
      // Down SAR: shown only when close <= SAR (bearish, Pine: colDown = close <= sarUp ? #ef5350 : na)
      p[2]![i] = { time, value: (i < 1 || c > sarV) ? NaN : sarV, color: '#EF5350' };
      // T3 Slow
      p[3]![i] = trendPoint(s.t3Slow, i, time);

      // markers: TSI curl arrows (Pine: plotshape for TSI momentum curl up/down)
      // TSI = 100 * double_smooth(change(close), long=25, short=5) / double_smooth(abs(change(close)), long=25, short=5)
      const pc = i > 0 ? (c - bars[i - 1].close) : 0;
      const dsPc = s.pcEma2.step(s.pcEma1.step(pc));
      const dsAbsPc = s.absEma2.step(s.absEma1.step(Math.abs(pc)));
      const denom = dsAbsPc ?? 0;
      const tsi = denom !== 0 ? 100 * (dsPc ?? 0) / denom : 0;
      s.tsi[i] = tsi;
      const sig = s.sigEma.step(tsi) ?? NaN;
      if (i >= tsiWarmup + 1 && !isNaN(sig)) {
        const prevTsi = s.tsi[i - 1]!;
        // curl up: tsi rising and tsi < signal (momentum headwind turning)
        if (tsi > prevTsi && tsi < sig) {
          s.markers.push({
            time,
            position: 'belowBar',
            shape: 'arrowUp',
            color: '#00E676', // #17ff00 ≈ bright green
            text: '',
          });
        }
        // curl down: tsi falling and tsi > signal
        if (tsi < prevTsi && tsi > sig) {
          s.markers.push({
            time,
            position: 'aboveBar',
            shape: 'arrowDown',
            color: '#FFEB3B',
            text: '',
          });
        }
      }

      // barcolor: 4-state coloring based on close vs T3 Slow (nT3Average) and T3 Fast vs T3 Slow (anT3Average >= nT3Average)
      // Pine: uc = close > nT3Average and anT3Average >= nT3Average (bull blue)
      //        dc = close < nT3Average and anT3Average <= nT3Average (bear red)
      //        dr = close < nT3Average and anT3Average >= nT3Average (bearish reversal yellow)
      //        ur = close > nT3Average and anT3Average <= nT3Average (bullish reversal yellow)
      const t3Fast = t3 ?? NaN;
      const t3SlowVal = t3Slow ?? NaN;
      if (i >= warmup + 1 && !isNaN(t3Fast) && !isNaN(t3SlowVal)) {
        const closeAboveSlow = c > t3SlowVal;
        const fastAboveSlow = t3Fast >= t3SlowVal;
        let col: string;
        if (closeAboveSlow && fastAboveSlow) {
          col = '#64B5F6'; // bull trend blue
        } else if (!closeAboveSlow && !fastAboveSlow) {
          col = '#EF5350'; // bear trend red
        } else {
          col = '#FFF176'; // reversal yellow
        }
        s.barColors.push({ time, color: col });
      }

      // plotbar(haOpen, haHigh, haLow, haClose, 'Heikin-Ashi', color = haover ? habarColor : na) on every bar (Pine lines
      // 134-161); habarColor: hauc=bullcol, hadc=bearcol, hadr=bearrev, haur=bullrev, else hadefval
      let col: string;
      if (i > warmup && !isNaN(t3Fast) && !isNaN(t3SlowVal)) {
        const hauc = hc > t3SlowVal && t3Fast >= t3SlowVal;
        const hadc = hc < t3SlowVal && t3Fast <= t3SlowVal;
        const hadr = hc < t3SlowVal && t3Fast >= t3SlowVal;
        const haur = hc > t3SlowVal && t3Fast <= t3SlowVal;
        if (hauc) col = '#64B5F6';        // bull blue
        else if (hadc) col = '#EF5350';    // bear red
        else if (hadr) col = '#FFF176';    // bearish reversal yellow
        else if (haur) col = '#FFF176';    // bullish reversal yellow
        else col = hc >= ho ? '#64B5F6' : '#EF5350'; // hadefval
      } else {
        col = hc >= ho ? '#64B5F6' : '#EF5350'; // hadefval before warmup
      }
      s.haBars[i] = { time: time as number, open: ho, high: haHigh, low: haLow, close: hc, color: showHA ? col : 'transparent' };

      // c = cross(close, nT3Average) / d = cross(nT3Average, anT3Average) (exact compares, na is false)
      const pClose = i > 0 ? bars[i - 1].close : NaN;
      const pSlow = i > 0 ? s.t3Slow[i - 1]! : NaN;
      const pFast = i > 0 ? s.t3[i - 1]! : NaN;
      const closeCross = (c > t3SlowVal && pClose <= pSlow) || (c < t3SlowVal && pClose >= pSlow);
      const slowCross = (t3SlowVal > t3Fast && pSlow <= pFast) || (t3SlowVal < t3Fast && pSlow >= pFast);
      s.flags[0]![i] = closeCross;
      s.flags[1]![i] = slowCross;
      if (closeCross) s.times[0]!.push(time as number);
      if (slowCross) s.times[1]!.push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0]!.slice(), 'plot1': p[1]!.slice(), 'plot2': p[2]!.slice(), 'plot3': p[3]!.slice() },
        // Pine: fill between T3 Slow (plot3) and T3 Fast (plot0), colored by T3 relationship
        fills: [
          { plot1: 'plot0', plot2: 'plot3', options: { color: 'rgba(100, 181, 246, 0.20)' } },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        plotBars: { ha: s.haBars.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<T3PsarInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<T3PsarInputs> = {}): Omit<IndicatorResult, 'markers'> & { plotBars: Record<string, PlotBarData[]> } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const T3Psar = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
