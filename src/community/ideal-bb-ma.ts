/**
 * IDEAL BB with MA (With Alerts) by Adarsh
 *
 * Pine: overlay=true, multiple visual elements:
 *   1) NMA (3rd-gen Moving Average) as stepline in black
 *   2) VWAP in pink
 *   3) BB basis (SMA 20) in red, BB upper in blue, BB lower in dark purple
 *   4) Fill between BB upper and lower (blue)
 *   5) Hull trend line A (HMA with Kahlman)
 *   6) Hull trend line B (HMA3 with Kahlman)
 *   7) Fill between Hull lines (lime when bullish, red when bearish)
 *   8) Buy/Sell markers from Hull crossovers
 *
 * Alerts (alertcondition, `alerts` of the result): 'Buy' (Hull B crosses above Hull A) and 'Sell' (Hull A crosses
 * above Hull B), true on the bar of the cross (the markers are drawn one bar back).
 *
 * VWAP: the original restarts it on each trading day. With the exchange time zone and the session of the symbol in
 * the optional third argument (see src/chart-context.ts) the port does the same (on daily and higher bars: on every
 * bar). Without them the sums never restart.
 *
 * Reference: "IDEAL BB with MA (With Alerts) by Adarsh" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { chartTimeframe, hasCalendar, periodChanges } from '../anchor-period';
import { barInterval } from '../bar-time';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface IdealBbMaInputs {
  length1: number;
  length2: number;
  maType: string;
  src: SourceType;
  hullLength: number;
  hullGain: number;
  useKahlman: boolean;
}

export const defaultInputs: IdealBbMaInputs = {
  length1: 120,
  length2: 12,
  maType: 'EMA',
  src: 'hl2',
  hullLength: 24,
  hullGain: 10000,
  useKahlman: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length1', type: 'int', title: '1st Length (NMA)', defval: 120, min: 1 },
  { id: 'length2', type: 'int', title: '2nd Length (NMA)', defval: 12, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'VWMA', 'WMA'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'hl2' },
  { id: 'hullLength', type: 'int', title: 'Hull Lookback', defval: 24, min: 2 },
  { id: 'hullGain', type: 'int', title: 'Kahlman Gain', defval: 10000, min: 1 },
  { id: 'useKahlman', type: 'bool', title: 'Use Kahlman', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'nma', title: 'NMA Black Line', color: '#000000', lineWidth: 2, style: 'stepline' },
  { id: 'vwap', title: 'VWAP', color: '#e91e63', lineWidth: 2 },
  { id: 'bbBasis', title: 'BB Basis', color: '#EF5350' },
  { id: 'bbUpper', title: 'BB Upper', color: '#2962FF' },
  { id: 'bbLower', title: 'BB Lower', color: '#311b92' },
  { id: 'hullA', title: 'Hull Long', color: '#26A69A', lineWidth: 1 },
  { id: 'hullB', title: 'Hull Short', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'IDEAL BB with MA',
  shortTitle: 'IBBMA',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

interface IdealVars {
  /** ta.vwap sums */
  sumPV: number;
  sumV: number;
  /** Kahlman filter states of hull A and B */
  kfA: number;
  veloA: number;
  kfB: number;
  veloB: number;
}

interface IdealRun extends BarRunState<IdealVars> {
  ma1: Ma;
  ma2: Ma;
  bb: ReturnType<typeof taStep.bb>;
  hmaHalf: ReturnType<typeof taStep.wma>;
  hmaFull: ReturnType<typeof taStep.wma>;
  hmaRaw: ReturnType<typeof taStep.wma>;
  wmaP3: ReturnType<typeof taStep.wma>;
  wmaP2: ReturnType<typeof taStep.wma>;
  wmaP1: ReturnType<typeof taStep.wma>;
  hma3Raw: ReturnType<typeof taStep.wma>;
  hullA: number[];
  hullB: number[];
  plots: Point[][];
  hullFillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<IdealBbMaInputs>): BarStudy<IdealRun, Result> {
  const { length1, length2, maType, src, hullLength, hullGain, useKahlman } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  // getMA based on maType (Pine: EMA/SMA/VWMA/WMA)
  const getMA = (length: number): Ma => {
    switch (maType) {
      case 'SMA': { const m = new WindowSma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(length); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
      default: { const m = taStep.ema(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    }
  };
  const lambda = length1 / length2;
  const alpha = lambda * (length1 - 1) / (length1 - lambda);
  const bbLen = 20;
  const bbMult = 2;
  const p = Math.floor(hullLength / 2);
  const warmup = Math.max(length1, length2, bbLen, hullLength + p);
  // Hull coloring: lime when b > a, red otherwise
  const LIME = '#00E676';
  const RED_HULL = '#EF5350';
  // alertcondition(crossup, 'Buy', 'Go Long') / alertcondition(crossdn, 'Sell', 'Go Short'), on every bar (na is false)
  const EPS = 1e-10;
  const gt = (x: number, y: number) => x - y > EPS;
  const lt = (x: number, y: number) => y - x > EPS;
  /** Chart context of the day changes (with the chart timeframe), daily or higher bars, set by init */
  let calChart: ChartContext | null = null;
  let daily = false;

  /** timeframe.change("1D") of bar i (periodChanges(bars, "1D", chart)[i]): the one of bars i - 1 and i */
  const dayChange = (bars: Bar[], i: number): boolean =>
    i > 0 && periodChanges([bars[i - 1], bars[i]], '1D', calChart!)[1]!;

  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    // the day changes read the chart timeframe (from the bar gaps or the context), the bar gap and the time unit
    key: (bars, chart) => (hasCalendar(chart)
      ? `${chartTimeframe(bars, chart)}|${barInterval(bars)}|${bars.length > 0 && bars[0].time >= 1e12}`
      : ''),
    init(bars, chart) {
      if (hasCalendar(chart)) {
        // vwap(hlc3): the anchor is a new trading day (timeframe.change("1D")). With the chart context: the trading
        // days of the exchange (and the first bar); every bar on daily and higher bars. Without it: no anchor.
        daily = barInterval(bars) >= 86400;
        const tfName = chartTimeframe(bars, chart);
        calChart = tfName === '' || chart.timeframe ? chart : { ...chart, timeframe: tfName };
      } else {
        calChart = null;
      }
      const s: IdealRun = {
        ma1: getMA(length1),
        ma2: getMA(length2),
        bb: taStep.bb(bbLen, bbMult),
        hmaHalf: taStep.wma(), hmaFull: taStep.wma(), hmaRaw: taStep.wma(),
        wmaP3: taStep.wma(), wmaP2: taStep.wma(), wmaP1: taStep.wma(), hma3Raw: taStep.wma(),
        hullA: [], hullB: [],
        plots: Array.from({ length: 7 }, () => []),
        hullFillColors: [],
        markers: [],
        flags: [[], []],
        times: [[], []],
        steps: [],
        vars: { sumPV: NaN, sumV: NaN, kfA: NaN, veloA: 0, kfB: NaN, veloB: 0 },
        lists: [], series: [],
      };
      s.steps = [s.ma1, s.ma2, s.bb, s.hmaHalf, s.hmaFull, s.hmaRaw, s.wmaP3, s.wmaP2, s.wmaP1, s.hma3Raw];
      s.lists = [s.markers, ...s.times];
      s.series = [s.hullA, s.hullB, ...s.plots, s.hullFillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const vol = b.volume ?? 0;

      // --- NMA (3rd generation MA) ---
      const ma1 = s.ma1.step(value(b), vol);
      const ma2 = s.ma2.step(ma1, vol);
      const nma = (1 + alpha) * ma1 - alpha * ma2;

      // --- VWAP ---
      const hlc3 = (b.high + b.low + b.close) / 3;
      const anchor = calChart ? i === 0 || daily || dayChange(bars, i) : i === 0;
      if (anchor) {
        v.sumPV = hlc3 * vol;
        v.sumV = vol;
      } else {
        // An na source or volume makes the sums na until the next anchor
        v.sumPV += hlc3 * vol;
        v.sumV += vol;
      }
      const vwap = v.sumV === 0 ? NaN : v.sumPV / v.sumV;

      // --- Bollinger Bands (SMA 20, mult 2) ---
      const [bbMid, bbUp, bbLo] = s.bb.step(b.close);

      // --- Hull MA Trend with Kahlman filter ---
      const hl2 = (b.high + b.low) / 2;
      // hma(src, len) of the original: wma(2 * wma(src, len / 2) - wma(src, len), round(sqrt(len))) (round, not floor)
      const hmaHalf = s.hmaHalf.step(hl2, Math.max(Math.floor(hullLength / 2), 1));
      const hmaFull = s.hmaFull.step(hl2, hullLength);
      const hmaRaw = s.hmaRaw.step(2 * hmaHalf - hmaFull, Math.max(Math.round(Math.sqrt(hullLength)), 1));

      // HMA3: wma(wma(close,p/3)*3 - wma(close,p/2) - wma(close,p), p)
      const wmaP3 = s.wmaP3.step(b.close, Math.max(Math.floor(p / 3), 1));
      const wmaP2 = s.wmaP2.step(b.close, Math.max(Math.floor(p / 2), 1));
      const wmaP1 = s.wmaP1.step(b.close, Math.max(p, 1));
      const hma3Raw = s.hma3Raw.step(wmaP3 * 3 - wmaP2 - wmaP1, Math.max(p, 1));

      // Kahlman filter
      const g = hullGain / 10000;
      let a = hmaRaw;
      let bh = hma3Raw;
      if (useKahlman) {
        if (isNaN(hmaRaw)) a = NaN;
        else {
          if (isNaN(v.kfA)) { v.kfA = hmaRaw; v.veloA = 0; }
          const dk = hmaRaw - v.kfA;
          const smooth = v.kfA + dk * Math.sqrt((hullGain / 10000) * 2);
          v.veloA = v.veloA + g * dk;
          v.kfA = smooth + v.veloA;
          a = v.kfA;
        }
        if (isNaN(hma3Raw)) bh = NaN;
        else {
          if (isNaN(v.kfB)) { v.kfB = hma3Raw; v.veloB = 0; }
          const dk = hma3Raw - v.kfB;
          const smooth = v.kfB + dk * Math.sqrt((hullGain / 10000) * 2);
          v.veloB = v.veloB + g * dk;
          v.kfB = smooth + v.veloB;
          bh = v.kfB;
        }
      }
      s.hullA[i] = a;
      s.hullB[i] = bh;

      const pl = s.plots;
      pl[0]![i] = { time, value: i < Math.max(length1, length2) ? NaN : (isNaN(nma) ? NaN : nma) };
      pl[1]![i] = { time, value: vwap };
      pl[2]![i] = { time, value: i < bbLen ? NaN : bbMid };
      pl[3]![i] = { time, value: i < bbLen ? NaN : bbUp };
      pl[4]![i] = { time, value: i < bbLen ? NaN : bbLo };
      pl[5]![i] = { time, value: i < warmup ? NaN : a, color: (!isNaN(bh) && bh > a) ? LIME : RED_HULL };
      pl[6]![i] = { time, value: i < warmup ? NaN : bh, color: (bh > (a ?? 0)) ? LIME : RED_HULL };

      // Dynamic hull fill colors: lime when b > a, red otherwise (Pine: c = b > a ? color.lime : color.red)
      s.hullFillColors[i] = i < warmup || isNaN(a) || isNaN(bh) ? 'transparent' : bh > a ? '#00E67638' : '#EF535038';

      const prevA = i > 0 ? s.hullA[i - 1]! : NaN;
      const prevB = i > 0 ? s.hullB[i - 1]! : NaN;
      // Buy/Sell markers from Hull crossover (Pine offset=-1: marker placed one bar back)
      if (i >= warmup + 1 && !(isNaN(a) || isNaN(bh) || isNaN(prevA) || isNaN(prevB))) {
        // crossup: b > a and b[1] < a[1]  (offset=-1 → place at i-1)
        if (bh > a && prevB < prevA) {
          s.markers.push({ time: bars[i - 1].time, position: 'belowBar', shape: 'labelUp', color: '#4CAF50', text: 'Buy' });
        }
        // crossdn: a > b and a[1] < b[1]  (offset=-1 → place at i-1)
        if (a > bh && prevA < prevB) {
          s.markers.push({ time: bars[i - 1].time, position: 'aboveBar', shape: 'labelDown', color: '#F44336', text: 'Sell' });
        }
      }

      const up = gt(bh, a) && lt(prevB, prevA);
      const dn = gt(a, bh) && lt(prevA, prevB);
      s.flags[0]![i] = up;
      s.flags[1]![i] = dn;
      if (up) s.times[0]!.push(time as number);
      if (dn) s.times[1]!.push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const pl = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          nma: pl[0]!.slice(),
          vwap: pl[1]!.slice(),
          bbBasis: pl[2]!.slice(),
          bbUpper: pl[3]!.slice(),
          bbLower: pl[4]!.slice(),
          hullA: pl[5]!.slice(),
          hullB: pl[6]!.slice(),
        },
        fills: [
          { plot1: 'bbUpper', plot2: 'bbLower', options: { color: '#2962FF1A' } },
          { plot1: 'hullA', plot2: 'hullB', options: { color: '#00E67638' }, colors: s.hullFillColors.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IdealBbMaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IdealBbMaInputs> = {}, chart?: ChartContext): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy', message: 'Go Long' },
  { id: 'alert1', title: 'Sell', message: 'Go Short' },
];

export const IdealBbMa = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
