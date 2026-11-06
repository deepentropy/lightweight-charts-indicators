/**
 * PMax on RSI with T3
 *
 * Tillson T3 smoothing applied to RSI, then PMax trailing stop.
 * T3 is a triple-smoothed EMA with a volume factor for reduced lag.
 * Alerts (alertcondition, `alerts` of the result): crosses of T3 and PMax (either way, over, under) and crosses of
 * hl2 (the default source of the original's price alerts; the port has no source input) and PMax, on the bars where
 * the lines are drawn (after the warm-up).
 *
 * Reference: "PMax on RSI with T3"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PMaxRSIT3Inputs {
  rsiLen: number;
  t3Len: number;
  t3Factor: number;
  atrMult: number;
}

export const defaultInputs: PMaxRSIT3Inputs = {
  rsiLen: 14,
  t3Len: 5,
  t3Factor: 0.7,
  atrMult: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 't3Len', type: 'int', title: 'T3 Length', defval: 5, min: 1 },
  { id: 't3Factor', type: 'float', title: 'T3 Factor', defval: 0.7, min: 0, max: 1, step: 0.1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3 RSI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'PMax', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot2', title: 'RSI', color: '#8E1599', lineWidth: 1 },
  { id: 'band1', title: 'OB Band', color: 'transparent', lineWidth: 0 },
  { id: 'band0', title: 'OS Band', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'PMax on RSI with T3',
  shortTitle: 'PMaxRSIT3',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface PmaxVars {
  /** The previous values of the six cascaded EMAs (changed in place, copied by copyVars) */
  e: number[];
}

interface PmaxRun extends BarRunState<PmaxVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  t3: number[];
  rsiAtr: number[];
  pmaxArr: number[];
  dirArr: number[];
  hl2: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  band1: Point[];
  band0: Point[];
  fillColors: string[];
  bandFillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PMaxRSIT3Inputs>): BarStudy<PmaxRun, Result> {
  const { rsiLen, t3Len, t3Factor, atrMult } = { ...defaultInputs, ...inputs };

  // Tillson T3: six cascaded EMAs with volume factor coefficients
  const b = t3Factor;
  const c1 = -(b * b * b);
  const c2 = 3 * b * b + 3 * b * b * b;
  const c3 = -6 * b * b - 3 * b - 3 * b * b * b;
  const c4 = 1 + 3 * b + b * b * b + 3 * b * b;
  // EMA helper: result[0] = data[0], then alpha * data + (1 - alpha) * result[1]
  const alpha = 2 / (t3Len + 1);
  const warmup = rsiLen + t3Len * 6;

  return {
    init() {
      const s: PmaxRun = {
        rsi: taStep.rsi(rsiLen), t3: [], rsiAtr: [], pmaxArr: [], dirArr: [], hl2: [], plot0: [], plot1: [], plot2: [],
        band1: [], band0: [], fillColors: [], bandFillColors: [], markers: [],
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [], vars: { e: [NaN, NaN, NaN, NaN, NaN, NaN] }, lists: [], series: [],
      };
      s.steps = [s.rsi];
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.t3, s.rsiAtr, s.pmaxArr, s.dirArr, s.hl2, s.plot0, s.plot1, s.plot2, s.band1, s.band0, s.fillColors,
        s.bandFillColors, ...s.flags,
      ];
      return s;
    },
    copyVars: (v) => ({ e: v.e.slice() }),
    bar(s, i, bars) {
      const bar = bars[i];
      const time = bar.time as number;
      const { t3, rsiAtr, pmaxArr, dirArr } = s;
      const rsiV = s.rsi.step(bar.close);

      // Fill NaN RSI values with 50 for smoothing
      let x = (rsiV == null || isNaN(rsiV)) ? 50 : rsiV;
      const e = s.vars.e;
      for (let k = 0; k < 6; k++) {
        x = i === 0 ? x : alpha * x + (1 - alpha) * e[k];
        e[k] = x;
      }
      t3[i] = c1 * e[5] + c2 * e[4] + c3 * e[3] + c4 * e[2];

      // ATR for PMax calculation (on the RSI scale, use absolute changes)
      if (i === 0) {
        rsiAtr[i] = 0;
      } else {
        const trVal = Math.abs(t3[i] - t3[i - 1]);
        if (i < rsiLen) {
          rsiAtr[i] = trVal;
        } else if (i === rsiLen) {
          let sum = 0;
          for (let j = 1; j <= rsiLen; j++) sum += Math.abs(t3[j] - t3[j - 1]);
          rsiAtr[i] = sum / rsiLen;
        } else {
          rsiAtr[i] = (rsiAtr[i - 1] * (rsiLen - 1) + trVal) / rsiLen;
        }
      }

      // PMax trailing stop on T3 RSI
      const val = t3[i];
      const atr = rsiAtr[i] * atrMult;
      const up = val - atr;
      const dn = val + atr;
      if (i === 0) {
        pmaxArr[i] = up;
        dirArr[i] = 1;
      } else {
        const prevDir = dirArr[i - 1];
        const prevPmax = pmaxArr[i - 1];
        const prevVal = t3[i - 1];

        const trailUp = prevVal > prevPmax && prevDir === 1 ? Math.max(up, prevPmax) : up;
        const trailDn = prevVal < prevPmax && prevDir === -1 ? Math.min(dn, prevPmax) : dn;

        if (prevDir === 1) {
          if (val < trailUp) {
            dirArr[i] = -1;
            pmaxArr[i] = trailDn;
          } else {
            dirArr[i] = 1;
            pmaxArr[i] = trailUp;
          }
        } else {
          if (val > trailDn) {
            dirArr[i] = 1;
            pmaxArr[i] = trailUp;
          } else {
            dirArr[i] = -1;
            pmaxArr[i] = trailDn;
          }
        }
      }

      s.plot0[i] = { time, value: i < warmup ? NaN : val };
      s.plot1[i] = i < warmup
        ? { time, value: NaN }
        : { time, value: pmaxArr[i], color: dirArr[i] === 1 ? '#26A69A' : '#EF5350' };

      // Markers: Buy when T3 crosses above PMax, Sell when T3 crosses below PMax
      if (i >= warmup + 1) {
        const prevT3 = t3[i - 1];
        const prevPmax = pmaxArr[i - 1];
        // Crossover: T3 crosses above PMax = Buy
        if (prevT3 <= prevPmax && val > pmaxArr[i]) {
          s.markers.push({ time: bar.time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
        }
        // Crossunder: T3 crosses below PMax = Sell
        if (prevT3 >= prevPmax && val < pmaxArr[i]) {
          s.markers.push({ time: bar.time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
        }
      }

      // cross / crossover / crossunder of (T3, PMax) and of (hl2, PMax), on the drawn bars only (na before the warm-up)
      const hl2 = s.hl2;
      hl2[i] = (bar.high + bar.low) / 2;
      const xo = (a: number[]) => i > warmup && a[i] > pmaxArr[i] && a[i - 1] <= pmaxArr[i - 1];
      const xu = (a: number[]) => i > warmup && a[i] < pmaxArr[i] && a[i - 1] >= pmaxArr[i - 1];
      const t3Over = xo(t3), t3Under = xu(t3);
      const srcOver = xo(hl2), srcUnder = xu(hl2);
      [t3Over || t3Under, t3Over, t3Under, srcOver || srcUnder, srcOver, srcUnder].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time);
      });

      // RSI line plot (Pine: plot(showrsi ? rsi : na, "RSI", color=#8E1599))
      s.plot2[i] = { time, value: i < rsiLen || rsiV == null || isNaN(rsiV) ? NaN : rsiV };

      // Fill between T3 (plot0) and PMax (plot1): green when T3 > PMax, red otherwise
      s.fillColors[i] = i < warmup ? 'transparent' : val > pmaxArr[i] ? 'rgba(38,166,154,0.20)' : 'rgba(239,83,80,0.20)';

      // Invisible constant plots at 70 and 30 for OB/OS zone fill
      // Pine: fill(band1, band0, color=#9915FF, transp=90)
      s.band1[i] = { time, value: i < warmup ? NaN : 70 };
      s.band0[i] = { time, value: i < warmup ? NaN : 30 };
      s.bandFillColors[i] = i < warmup ? 'transparent' : 'rgba(153,21,255,0.10)';
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice(), 'band1': s.band1.slice(), 'band0': s.band0.slice() },
        hlines: [
          { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
          { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
        ],
        fills: [
          { plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() },
          { plot1: 'band1', plot2: 'band0', colors: s.bandFillColors.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PMaxRSIT3Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PMaxRSIT3Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Cross Alert', message: 'PMax - Moving Avg Crossing!' },
  { id: 'alert1', title: 'Crossover Alarm', message: 'Moving Avg BUY SIGNAL!' },
  { id: 'alert2', title: 'Crossunder Alarm', message: 'Moving Avg SELL SIGNAL!' },
  { id: 'alert3', title: 'Price Cross Alert', message: 'PMax - Price Crossing!' },
  { id: 'alert4', title: 'Price Crossover Alarm', message: 'PRICE OVER PMax - BUY SIGNAL!' },
  { id: 'alert5', title: 'Price Crossunder Alarm', message: 'PRICE UNDER PMax - SELL SIGNAL!' },
];

export const PMaxRSIT3 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
