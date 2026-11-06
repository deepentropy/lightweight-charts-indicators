/**
 * HalfTrend
 *
 * ATR-based trend detection with amplitude-filtered state transitions.
 * Tracks highest lows / lowest highs over the amplitude period, flips direction
 * when SMA of high/low crosses these extremes and price confirms.
 *
 * Alerts (alertcondition, `alerts` of the result): 'HalfTrend Buy' on the bars the trend turns up, 'HalfTrend Sell' on
 * the bars it turns down (from the first bar with an ATR).
 *
 * Reference: "HalfTrend" by everget
 */

import { taCore, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface HalfTrendInputs {
  amplitude: number;
  channelDeviation: number;
  showArrows: boolean;
  showLabels: boolean;
}

export const defaultInputs: HalfTrendInputs = {
  amplitude: 2,
  channelDeviation: 2,
  showArrows: true,
  showLabels: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'amplitude', type: 'int', title: 'Amplitude', defval: 2, min: 1 },
  { id: 'channelDeviation', type: 'int', title: 'Channel Deviation', defval: 2, min: 0 },
  { id: 'showArrows', type: 'bool', title: 'Show Arrows', defval: true },
  { id: 'showLabels', type: 'bool', title: 'Show Labels', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'HalfTrend', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'ATR High', color: '#EF5350', lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'ATR Low', color: '#2962FF', lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'HalfTrend',
  shortTitle: 'HT',
  overlay: true,
};

/**
 * `ta.highestbars(source, length)` / `ta.lowestbars` with a constant length, one bar at a time (no taStep machine):
 * the offset to the best of the last `length` non-na values, the newest one on equal values, na before bar
 * `length - 1` and while there is no value (the rules of the oakscriptjs array function, the same values).
 */
class ExtremeBarsStep implements Committable {
  private values: number[] = [];
  private bars: number[] = [];
  private pendingValue = NaN;
  private pendingBar = -1;
  private readonly len: number;

  constructor(length: number, private readonly lowest: boolean) {
    // the length check of ta.highestbars / ta.lowestbars (the same runtime error)
    (lowest ? taCore.lowestbars : taCore.highestbars)([], length);
    this.len = Math.trunc(length);
  }

  step(bar: number, value: number): number {
    const kept = Number.isFinite(value);
    this.pendingValue = kept ? value : NaN;
    this.pendingBar = kept ? bar : -1;
    const n = this.values.length;
    if (bar < this.len - 1 || (n === 0 && !kept)) return NaN;
    let bestValue = kept ? value : this.values[n - 1]!;
    let bestBar = kept ? bar : this.bars[n - 1]!;
    // the older kept values of the window (the newest wins on equal values: only a strictly better one replaces it)
    const from = kept ? n - 1 : n - 2;
    for (let j = from, c = 0; j >= 0 && c < this.len - 1; j--, c++) {
      const v = this.values[j]!;
      if (this.lowest ? v < bestValue : v > bestValue) {
        bestValue = v;
        bestBar = this.bars[j]!;
      }
    }
    return -(bar - bestBar);
  }

  commit(): void {
    if (this.pendingBar >= 0) {
      this.values.push(this.pendingValue);
      this.bars.push(this.pendingBar);
      if (this.values.length > this.len * 2 + 1024) {
        this.values = this.values.slice(-this.len);
        this.bars = this.bars.slice(-this.len);
      }
    }
    this.pendingBar = -1;
  }
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface HalfTrendVars {
  trend: number;
  nextTrend: number;
  maxLowPrice: number;
  minHighPrice: number;
  up: number;
  down: number;
}

interface HalfTrendRun extends BarRunState<HalfTrendVars> {
  atr: ReturnType<typeof taStep.atr>;
  highest: ExtremeBarsStep;
  lowest: ExtremeBarsStep;
  highma: WindowSma;
  lowma: WindowSma;
  trendArr: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<HalfTrendInputs>): BarStudy<HalfTrendRun, Result> {
  const { amplitude, channelDeviation, showArrows, showLabels } = { ...defaultInputs, ...inputs };
  const warmup = 100; // ATR(100) warmup
  return {
    init() {
      const atr = taStep.atr(100);
      const highest = new ExtremeBarsStep(amplitude, false);
      const lowest = new ExtremeBarsStep(amplitude, true);
      const highma = new WindowSma(amplitude);
      const lowma = new WindowSma(amplitude);
      const s: HalfTrendRun = {
        atr, highest, lowest, highma, lowma, trendArr: [], plots: [[], [], []], markers: [], flags: [[], []],
        times: [[], []], steps: [atr, highest, lowest, highma, lowma],
        vars: { trend: 0, nextTrend: 0, maxLowPrice: NaN, minHighPrice: NaN, up: 0, down: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.trendArr, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      if (i === 0) {
        v.maxLowPrice = b.low;
        v.minHighPrice = b.high;
      }
      const atr: number | null = s.atr.step(b.high, b.low, b.close);
      const highest: number | null = s.highest.step(i, b.high);
      const lowest: number | null = s.lowest.step(i, b.low);
      const highmaV: number | null = s.highma.step(b.high);
      const lowmaV: number | null = s.lowma.step(b.low);
      const atr2 = ((atr ?? 0) / 2);
      const dev = channelDeviation * atr2;
      const hbars = Math.abs(highest ?? 0);
      const lbars = Math.abs(lowest ?? 0);
      const highPrice = bars[Math.max(0, i - hbars)]?.high ?? b.high;
      const lowPrice = bars[Math.max(0, i - lbars)]?.low ?? b.low;
      const highma = highmaV ?? b.high;
      const lowma = lowmaV ?? b.low;
      const prevLow = i > 0 ? bars[i - 1].low : b.low;
      const prevHigh = i > 0 ? bars[i - 1].high : b.high;

      if (v.nextTrend === 1) {
        v.maxLowPrice = Math.max(lowPrice, v.maxLowPrice);
        if (highma < v.maxLowPrice && b.close < prevLow) {
          v.trend = 1;
          v.nextTrend = 0;
          v.minHighPrice = highPrice;
        }
      } else {
        v.minHighPrice = Math.min(highPrice, v.minHighPrice);
        if (lowma > v.minHighPrice && b.close > prevHigh) {
          v.trend = 0;
          v.nextTrend = 1;
          v.maxLowPrice = lowPrice;
        }
      }

      const trend = v.trend;
      s.trendArr[i] = trend;
      let ht: number;
      if (trend === 0) {
        v.up = (i === 0) ? v.maxLowPrice : Math.max(v.maxLowPrice, v.up);
        ht = v.up;
      } else {
        v.down = (i === 0) ? v.minHighPrice : Math.min(v.minHighPrice, v.down);
        ht = v.down;
      }
      const time = b.time;
      // Dynamic HT line color: blue for uptrend (0), red for downtrend (1)
      s.plots[0][i] = i < warmup ? { time, value: NaN } : { time, value: ht, color: trend === 0 ? '#2962FF' : '#EF5350' };
      s.plots[1][i] = { time, value: i < warmup ? NaN : ht + dev };
      s.plots[2][i] = { time, value: i < warmup ? NaN : ht - dev };

      const prevTrend = i > 0 ? s.trendArr[i - 1] : NaN;
      // Markers: arrows and/or labels on trend flip
      if (i >= warmup && i > 0 && trend !== prevTrend) {
        if (trend === 0) {
          if (showArrows) s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: '#2962FF', text: '' });
          if (showLabels) s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#2962FF', text: 'Buy' });
        } else {
          if (showArrows) s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: '#FF6D00', text: '' });
          if (showLabels) s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#FF6D00', text: 'Sell' });
        }
      }

      // buySignal = not na(arrowUp) and trend == 0 and trend[1] == 1; sellSignal = not na(arrowDown) and trend == 1 and
      // trend[1] == 0 (arrowUp / arrowDown are set on the flip bars, na while the ATR is na)
      const hasAtr = atr != null && !isNaN(atr);
      const buy = i > 0 && hasAtr && trend === 0 && prevTrend === 1;
      const sell = i > 0 && hasAtr && trend === 1 && prevTrend === 0;
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(time as number);
      if (sell) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plots[0].slice(), 'plot1': s.plots[1].slice(), 'plot2': s.plots[2].slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(239,83,80,0.15)' } },
          { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(41,98,255,0.15)' } },
        ],
        markers: s.markers.slice(),
        // alertcondition(buySignal, 'HalfTrend Buy') / alertcondition(sellSignal, 'HalfTrend Sell')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HalfTrendInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HalfTrendInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'HalfTrend Buy', message: 'HalfTrend Buy, {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'HalfTrend Sell', message: 'HalfTrend Sell, {{exchange}}:{{ticker}}' },
];

export const HalfTrend = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
