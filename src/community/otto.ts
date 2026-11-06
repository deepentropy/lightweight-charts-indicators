/**
 * Optimized Trend Tracker Oscillator (OTTO)
 *
 * Plots HOTT (High OTT) and LOTT (Low OTT) as non-overlay lines with fill.
 * HOTT = adjusted OTT trailing stop (lagged 2 bars), LOTT = VIDYA-ratio source.
 * Buy signal when LOTT crosses above HOTT, Sell when LOTT crosses below HOTT.
 *
 * Pine: overlay=false, two line plots + fill + buy/sell markers.
 * Supports 10 MA types: SMA, EMA, WMA, DEMA, TMA, VAR, WWMA, ZLEMA, TSF, HULL.
 * Alerts (alertcondition, `alerts` of the result): 'Crossover Alarm' when HOTT[2] crosses under LOTT (buy),
 * 'Crossunder Alarm' when HOTT[2] crosses over LOTT (sell).
 *
 * Reference: "Optimized Trend Tracker Oscillator OTTO" by KivancOzbilgic
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface OTTOInputs {
  period: number;
  percent: number;
  fastVidyaLen: number;
  slowVidyaLen: number;
  correctingConst: number;
  src: SourceType;
  showSignals: boolean;
  highlighting: boolean;
  mav: string;
}

export const defaultInputs: OTTOInputs = {
  period: 2,
  percent: 0.6,
  fastVidyaLen: 10,
  slowVidyaLen: 25,
  correctingConst: 100000,
  src: 'close',
  showSignals: true,
  highlighting: true,
  mav: 'VAR',
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'OTT Period', defval: 2, min: 1 },
  { id: 'percent', type: 'float', title: 'OTT Optimization Coeff', defval: 0.6, min: 0, step: 0.1 },
  { id: 'fastVidyaLen', type: 'int', title: 'Fast VIDYA Length', defval: 10, min: 1 },
  { id: 'slowVidyaLen', type: 'int', title: 'Slow VIDYA Length', defval: 25, min: 1 },
  { id: 'correctingConst', type: 'int', title: 'Correcting Constant', defval: 100000, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showSignals', type: 'bool', title: 'OTTO Crossing Signals?', defval: true },
  { id: 'highlighting', type: 'bool', title: 'Highlighter On/Off?', defval: true },
  { id: 'mav', type: 'string', title: 'Moving Average Type', defval: 'VAR', options: ['SMA', 'EMA', 'WMA', 'DEMA', 'TMA', 'VAR', 'WWMA', 'ZLEMA', 'TSF', 'HULL'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'hott', title: 'HOTT', color: '#FF0000', lineWidth: 2 },
  { id: 'lott', title: 'LOTT', color: '#0000FF', lineWidth: 2 },
];

export const metadata = {
  title: 'OTT Oscillator',
  shortTitle: 'OTTO',
  overlay: false,
};

/// VAR (Variable Index Dynamic Average) calculation: the value of bar `i` (`out` holds the values of the bars before it),
// valpha = 2 / (length + 1)
function varAt(srcArr: number[], out: number[], i: number, valpha: number): number {
  const s = srcArr[i];
  let vUD = 0;
  let vDD = 0;
  for (let j = Math.max(0, i - 8); j <= i; j++) {
    const cur = srcArr[j];
    const prev = j > 0 ? srcArr[j - 1] : cur;
    if (cur > prev) vUD += cur - prev;
    if (cur < prev) vDD += prev - cur;
  }
  const vCMO = (vUD + vDD) === 0 ? 0 : (vUD - vDD) / (vUD + vDD);
  return i === 0 ? s : valpha * Math.abs(vCMO) * s + (1 - valpha * Math.abs(vCMO)) * out[i - 1];
}

// WWMA (Welles Wilder Moving Average): the value of bar `i`, wwalpha = 1 / length
function wwmaAt(srcArr: number[], out: number[], i: number, wwalpha: number): number {
  return i === 0 ? srcArr[i] : wwalpha * srcArr[i] + (1 - wwalpha) * out[i - 1];
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface OttoRun extends BarRunState<Record<string, never>> {
  /** The selected MA of the normalized source on bar i */
  ma: (v: number, i: number) => number;
  srcArr: number[];
  mov1: number[];
  mov2: number[];
  mov3: number[];
  ns: number[];
  /** Raw VAR / WWMA output (before na -> 0) */
  raw: number[];
  longStop: number[];
  shortStop: number[];
  dir: number[];
  ott: number[];
  hottPlot: Array<{ time: number; value: number }>;
  lottPlot: Array<{ time: number; value: number }>;
  fillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<OTTOInputs>): BarStudy<OttoRun, Result> {
  const { period, percent, fastVidyaLen, slowVidyaLen, correctingConst, src, showSignals, highlighting, mav } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = period + 9;
  const valpha1 = 2 / (slowVidyaLen / 2 + 1);
  const valpha2 = 2 / (slowVidyaLen + 1);
  const valpha3 = 2 / (slowVidyaLen * fastVidyaLen + 1);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const s: OttoRun = {
        ma: () => NaN, srcArr: [], mov1: [], mov2: [], mov3: [], ns: [], raw: [], longStop: [], shortStop: [], dir: [],
        ott: [], hottPlot: [], lottPlot: [], fillColors: [], markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      const steps: Committable[] = [];
      const add = <T extends Committable>(m: T): T => {
        steps.push(m);
        return m;
      };
      // Compute selected MA on normalizedSrc
      if (mav === 'SMA') {
        const m = add(new WindowSma(period));
        s.ma = (v) => m.step(v);
      } else if (mav === 'EMA') {
        const m = add(taStep.ema(period));
        s.ma = (v) => m.step(v);
      } else if (mav === 'WMA') {
        const m = add(taStep.wma());
        s.ma = (v) => m.step(v, period);
      } else if (mav === 'DEMA') {
        // Pine: DEMA = 2 * ta.ema(src, length) - ta.ema(ta.ema(src, length), length)
        const e1 = add(taStep.ema(period));
        const e2 = add(taStep.ema(period));
        s.ma = (v) => {
          const ema1 = e1.step(v);
          return ema1 * 2 - e2.step(ema1);
        };
      } else if (mav === 'TMA') {
        // Pine: ta.sma(ta.sma(src, ceil(length/2)), floor(length/2) + 1)
        const a = add(new WindowSma(Math.max(1, Math.ceil(period / 2))));
        const b = add(new WindowSma(Math.floor(period / 2) + 1));
        s.ma = (v) => b.step(a.step(v));
      } else if (mav === 'WWMA') {
        s.ma = (_v, i) => (s.raw[i] = wwmaAt(s.ns, s.raw, i, 1 / period));
      } else if (mav === 'ZLEMA') {
        // Pine: zxLag = length/2 == round(length/2) ? length/2 : (length-1)/2
        // Pine: zxEMAData = src + src - src[zxLag]
        // Pine: ZLEMA = ema(zxEMAData, length)
        const zxLag = (period / 2) === Math.round(period / 2) ? Math.floor(period / 2) : Math.floor((period - 1) / 2);
        const e = add(taStep.ema(period));
        s.ma = (v, i) => {
          const lagged = i >= zxLag ? s.ns[i - zxLag] : s.ns[0];
          return e.step(v + v - lagged);
        };
      } else if (mav === 'TSF') {
        // Pine: lrc = linreg(src,length,0), lrc1 = linreg(src,length,1), lrs = lrc-lrc1, TSF = linreg(src,length,0)+lrs
        const l0 = add(taStep.linreg(period, 0));
        const l1 = add(taStep.linreg(period, 1));
        s.ma = (v) => {
          const lrc = l0.step(v);
          const lrc1 = l1.step(v);
          return (lrc ?? 0) + ((lrc ?? 0) - (lrc1 ?? 0));
        };
      } else if (mav === 'HULL') {
        const m = add(taStep.hma(period));
        s.ma = (v) => m.step(v);
      } else {
        // Default: VAR
        const valpha = 2 / (period + 1);
        s.ma = (_v, i) => (s.raw[i] = varAt(s.ns, s.raw, i, valpha));
      }
      s.steps = steps;
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.srcArr, s.mov1, s.mov2, s.mov3, s.ns, s.raw, s.longStop, s.shortStop, s.dir, s.ott, s.hottPlot, s.lottPlot,
        s.fillColors, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      s.srcArr[i] = value(bars[i]) ?? 0;

      // Pine: mov1 = Var_Func1(src1, slength/2)  -- Pine float division: 25/2 = 12.5
      // Pine: mov2 = Var_Func1(src1, slength)
      // Pine: mov3 = Var_Func1(src1, slength*flength)
      const mov1 = (s.mov1[i] = varAt(s.srcArr, s.mov1, i, valpha1));
      const mov2 = (s.mov2[i] = varAt(s.srcArr, s.mov2, i, valpha2));
      const mov3 = (s.mov3[i] = varAt(s.srcArr, s.mov3, i, valpha3));

      // Pine: src = mov1 / (mov2 - mov3 + coco)
      const ns = (s.ns[i] = mov1 / (mov2 - mov3 + correctingConst));

      let mavg = s.ma(ns, i);
      // Replace NaN/undefined with 0 for downstream computation
      if (mavg == null || isNaN(mavg)) mavg = 0;

      // OTT trailing stop logic
      const fark = mavg * percent * 0.01;
      let longStop = mavg - fark;
      let shortStop = mavg + fark;
      let dir: number;
      if (i > 0) {
        if (mavg > s.longStop[i - 1]) longStop = Math.max(longStop, s.longStop[i - 1]);
        if (mavg < s.shortStop[i - 1]) shortStop = Math.min(shortStop, s.shortStop[i - 1]);

        dir = s.dir[i - 1];
        if (s.dir[i - 1] === -1 && mavg > s.shortStop[i - 1]) dir = 1;
        else if (s.dir[i - 1] === 1 && mavg < s.longStop[i - 1]) dir = -1;
      } else {
        dir = 1;
      }
      s.longStop[i] = longStop;
      s.shortStop[i] = shortStop;
      s.dir[i] = dir;

      const mt = dir === 1 ? longStop : shortStop;
      s.ott[i] = mavg > mt ? mt * (200 + percent) / 200 : mt * (200 - percent) / 200;
      const ott = s.ott;

      // Pine: HOTTLine = plot(nz(HOTT[2]), title='HOTT', color=red, linewidth=2)
      s.hottPlot[i] = { time, value: (i < warmup + 2) ? NaN : ott[i - 2] };

      // Pine: LOTTLine = plot(nz(LOTT), title='LOTT', color=blue, linewidth=2)  where LOTT = src (normalizedSrc)
      s.lottPlot[i] = { time, value: i < warmup ? NaN : ns };

      // Pine: FillColor = highlighting and LOTT < HOTT[2] ? color.new(red, 20) : color.new(green, 20)
      // Pine transparency 20 = CSS opacity 0.80
      s.fillColors[i] = i < warmup + 2 || !highlighting ? 'transparent'
        : ns < ott[i - 2] ? 'rgba(255,0,0,0.80)' : 'rgba(0,128,0,0.80)';

      // Pine: buySignalc = crossunder(HOTT[2], LOTT)  -- HOTT was >= LOTT, now < LOTT => Buy
      // Pine: sellSignallc = crossover(HOTT[2], LOTT) -- HOTT was <= LOTT, now > LOTT => Sell
      if (showSignals && i >= warmup + 3) {
        const curHOTT = ott[i - 2];
        const prevHOTT = ott[i - 3];
        const prevLOTT = s.ns[i - 1];
        if (prevHOTT >= prevLOTT && curHOTT < ns) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#00FF00', text: 'Buy' });
        }
        if (prevHOTT <= prevLOTT && curHOTT > ns) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#FF0000', text: 'Sell' });
        }
      }

      // HOTT[2] (na on the first two bars) and LOTT = src
      // alertcondition(ta.crossunder(HOTT[2], LOTT), 'Crossover Alarm') / alertcondition(ta.crossover(HOTT[2], LOTT), 'Crossunder Alarm')
      const h2 = i >= 2 ? ott[i - 2] : NaN;
      const ph2 = i >= 3 ? ott[i - 3] : NaN;
      const pns = i > 0 ? s.ns[i - 1] : NaN;
      const under = h2 < ns && ph2 >= pns;
      const over = h2 > ns && ph2 <= pns;
      s.flags[0][i] = under;
      s.flags[1][i] = over;
      if (under) s.times[0].push(time as number);
      if (over) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'hott': s.hottPlot.slice(), 'lott': s.lottPlot.slice() },
        fills: [{ plot1: 'hott', plot2: 'lott', options: { color: '#008000' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OTTOInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<OTTOInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Crossover Alarm', message: 'OTTO - BUY SIGNAL!' },
  { id: 'alert1', title: 'Crossunder Alarm', message: 'OTTO - SELL SIGNAL!' },
];

export const OTTO = { calculate, createRun,
 metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
