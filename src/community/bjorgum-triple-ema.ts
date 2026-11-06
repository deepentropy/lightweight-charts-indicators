/**
 * Bjorgum Triple EMA Strategy
 *
 * Three EMAs (5, 9, 21) computed on Heiken Ashi open for trend detection.
 * A hidden fast EMA (ema(hl2, 1)) is used for the first area fill.
 * EMA line colors change directionally: blue when rising, red when falling.
 * Bar color: blue when close > EMA-5 and close > EMA-9; pink when below both; gray otherwise.
 *
 * Pine fills:
 *   fill(emaslowplot, emafastplot, fillCol1, transp=85)  -- EMA-5 vs hidden fast
 *   fill(emaslowplot, emaslowplot2, fillCol2, transp=80) -- EMA-5 vs EMA-9
 *   fill(emaslowplot2, emaslowplot3, fillCol3, transp=75) -- EMA-9 vs EMA-21
 *
 * Alert (alertcondition, `alerts` of the result): 'Alert Signal', the close crossing EMA-5 and EMA-9 on the same bar.
 *
 * Reference: "Bjorgum Triple EMA Strategy"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Alert Signal', message: 'Price is crossing EMAs' },
];

export interface BjorgumTripleEmaInputs {
  fastLen: number;
  medLen: number;
  slowLen: number;
}

export const defaultInputs: BjorgumTripleEmaInputs = {
  fastLen: 5,
  medLen: 9,
  slowLen: 21,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'EMA-Fast', defval: 5, min: 1 },
  { id: 'medLen', type: 'int', title: 'EMA-Medium', defval: 9, min: 1 },
  { id: 'slowLen', type: 'int', title: 'EMA-Slow', defval: 21, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA-5', color: '#64b5f6', lineWidth: 2 },
  { id: 'plot1', title: 'EMA fast', color: '#000000', lineWidth: 0 },
  { id: 'plot2', title: 'EMA-9', color: '#64b5f6', lineWidth: 2 },
  { id: 'plot3', title: 'EMA-21', color: '#64b5f6', lineWidth: 2 },
];

export const metadata = {
  title: 'Bjorgum Triple EMA Strategy',
  shortTitle: 'BJ HEMA',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Ema = ReturnType<typeof taStep.ema>;

interface BjorgumRun extends BarRunState<Record<string, never>> {
  fast: Ema;
  med: Ema;
  slow: Ema;
  hiddenFast: Ema;
  haOpen: number[];
  haClose: number[];
  fastArr: number[];
  medArr: number[];
  slowArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  fillCol1: string[];
  fillCol2: string[];
  fillCol3: string[];
  barColors: BarColorData[];
  signal: boolean[];
  times: number[];
}

function study(inputs: Partial<BjorgumTripleEmaInputs>): BarStudy<BjorgumRun, Result> {
  const { fastLen, medLen, slowLen } = { ...defaultInputs, ...inputs };
  const warmup = slowLen;
  return {
    init() {
      const fast = taStep.ema(fastLen);
      const med = taStep.ema(medLen);
      const slow = taStep.ema(slowLen);
      const hiddenFast = taStep.ema(1);
      const s: BjorgumRun = {
        fast, med, slow, hiddenFast, haOpen: [], haClose: [], fastArr: [], medArr: [], slowArr: [], plot0: [], plot1: [],
        plot2: [], plot3: [], fillCol1: [], fillCol2: [], fillCol3: [], barColors: [], signal: [], times: [],
        steps: [fast, med, slow, hiddenFast], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors, s.times];
      s.series = [
        s.haOpen, s.haClose, s.fastArr, s.medArr, s.slowArr, s.plot0, s.plot1, s.plot2, s.plot3, s.fillCol1, s.fillCol2,
        s.fillCol3, s.signal,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // Heiken Ashi values
      const haClose = (b.open + b.high + b.low + b.close) / 4;
      const haOpen = i === 0 ? (b.open + b.close) / 2 : (s.haOpen[i - 1] + s.haClose[i - 1]) / 2;
      s.haClose[i] = haClose;
      s.haOpen[i] = haOpen;

      // Three EMAs on haOpen
      const f = s.fast.step(haOpen);
      const m = s.med.step(haOpen);
      const sl = s.slow.step(haOpen);
      // Hidden fast EMA: ema(hl2, 1) -- plotted with transp=100 (invisible line)
      const hf = s.hiddenFast.step((b.high + b.low) / 2);
      s.fastArr[i] = f;
      s.medArr[i] = m;
      s.slowArr[i] = sl;

      // c = cross(close, bjemaslow) and cross(close, bjemaslow2)
      const c = b.close;
      const pc = i > 0 ? bars[i - 1].close : NaN;
      const fPrev = i > 0 ? s.fastArr[i - 1] : NaN;
      const mPrev = i > 0 ? s.medArr[i - 1] : NaN;
      const sPrev = i > 0 ? s.slowArr[i - 1] : NaN;
      const crossFast = (c > f && pc <= fPrev) || (c < f && pc >= fPrev);
      const crossMed = (c > m && pc <= mPrev) || (c < m && pc >= mPrev);
      const signal = crossFast && crossMed;
      s.signal[i] = signal;
      if (signal) s.times.push(t as number);

      // Build plot data with directional colors
      // Pine: mycolor = up ? #64b5f6 : down ? #d32f2f : na
      // up = ema > ema[1], down = ema < ema[1]
      if (i < warmup) {
        s.plot0[i] = { time: t, value: NaN };
        s.plot1[i] = { time: t, value: NaN };
        s.plot2[i] = { time: t, value: NaN };
        s.plot3[i] = { time: t, value: NaN };
        s.fillCol1[i] = 'transparent';
        s.fillCol2[i] = 'transparent';
        s.fillCol3[i] = 'transparent';
        return;
      }

      // EMA-5 directional color (transp=55 -> alpha ~0.45)
      const fColor = f > fPrev ? 'rgba(100, 181, 246, 0.45)' : f < fPrev ? 'rgba(211, 47, 47, 0.45)' : undefined;
      s.plot0[i] = { time: t, value: f, color: fColor };

      // Hidden fast EMA (transp=100 -> invisible)
      s.plot1[i] = { time: t, value: hf };

      // EMA-9 directional color (transp=45 -> alpha ~0.55)
      const mColor = m > mPrev ? 'rgba(100, 181, 246, 0.55)' : m < mPrev ? 'rgba(211, 47, 47, 0.55)' : undefined;
      s.plot2[i] = { time: t, value: m, color: mColor };

      // EMA-21 directional color (transp=35 -> alpha ~0.65)
      const sColor = sl > sPrev ? 'rgba(100, 181, 246, 0.65)' : sl < sPrev ? 'rgba(211, 47, 47, 0.65)' : undefined;
      s.plot3[i] = { time: t, value: sl, color: sColor };

      // Fill colors
      // fill1: EMA-5 vs hidden fast EMA (Pine transp=85 -> alpha ~0.15)
      // fillCol1 = bjemaslow > bjemafast ? #ef5350 : bjemaslow < bjemafast ? #64b5f6 : na
      s.fillCol1[i] = f > hf ? 'rgba(239, 83, 80, 0.15)' : f < hf ? 'rgba(100, 181, 246, 0.15)' : 'transparent';
      // fill2: EMA-5 vs EMA-9 (Pine transp=80 -> alpha ~0.20)
      // fillCol2 = bjemaslow2 > bjemaslow ? #ef5350 : bjemaslow2 < bjemaslow ? #64b5f6 : na
      s.fillCol2[i] = m > f ? 'rgba(239, 83, 80, 0.20)' : m < f ? 'rgba(100, 181, 246, 0.20)' : 'transparent';
      // fill3: EMA-9 vs EMA-21 (Pine transp=75 -> alpha ~0.25)
      // fillCol3 = bjemaslow3 > bjemaslow2 ? #ef5350 : bjemaslow3 < bjemaslow2 ? #64b5f6 : na
      s.fillCol3[i] = sl > m ? 'rgba(239, 83, 80, 0.25)' : sl < m ? 'rgba(100, 181, 246, 0.25)' : 'transparent';

      // barcolor: uc = close > fast AND close > med -> #64b5f6
      //           dc = close < fast AND close < med -> #e91e63
      //           else -> #b2b5be
      if (isNaN(f) || isNaN(m)) return;
      const color = (c > f && c > m) ? '#64B5F6' : (c < f && c < m) ? '#E91E63' : '#B2B5BE';
      s.barColors.push({ time: t, color });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'plot3': s.plot3.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(100, 181, 246, 0.15)' }, colors: s.fillCol1.slice() },
          { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(100, 181, 246, 0.20)' }, colors: s.fillCol2.slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(100, 181, 246, 0.25)' }, colors: s.fillCol3.slice() },
        ],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, [s.times], [n > 0 && s.signal[n - 1]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BjorgumTripleEmaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BjorgumTripleEmaInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BjorgumTripleEma = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
