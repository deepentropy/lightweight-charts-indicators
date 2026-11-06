/**
 * Auto Fibonacci
 *
 * Fibonacci levels between the highest high and the lowest low of the last "Fibo Period" bars (144). When the
 * highest high is older than the lowest low (a downward leg) the levels go up from the low (low + range x ratio,
 * green #00cc00), else down from the high (high - range x ratio, red #E41019). Levels 0, 0.236, 0.382, 0.5, 0.618,
 * 0.786, 1 and 1.618 (the last one when "Plot 1.618 Level?" is on and the level is not 0).
 * As in the original, each level plot has a value on the last bar only (show_last = 1) and a price line at that value
 * across the chart (trackprice = true, `lines` of the result, dashed, in the level colour); na until "Fibo Period"
 * bars exist. On the last bar, the original's level labels (%0 ... %161.8, 15 bars after the last bar) and the
 * High / Low labels on the bars of the highest high / lowest low.
 * Alerts (alertcondition, `alerts` of the result): the close crossing over / under the 0.236 ... 0.786 levels of the
 * original, in an upward (highest high more recent than the lowest low) or a downward retracement.
 *
 * Reference: "Auto Fibonacci" (community)
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  createBarRun, fullResult, liveAlertStates, WindowExtreme,
  type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export interface AutoFibInputs {
  /** Fibo Period */
  length: number;
  /** Draw the 1.618 level label */
  plotF1618: boolean;
}

export const defaultInputs: AutoFibInputs = {
  length: 144,
  plotF1618: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Fibo Period', defval: 144, min: 1 },
  { id: 'plotF1618', type: 'bool', title: 'Plot 1.618 Level?', defval: true },
];

/** Level colours: downward leg (levels from the low up) / upward leg (from the high down) */
const DOWN_COLOR = '#00cc00';
const UP_COLOR = '#E41019';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '0', color: DOWN_COLOR, lineWidth: 2 },
  { id: 'plot1', title: '0.236', color: DOWN_COLOR, lineWidth: 1 },
  { id: 'plot2', title: '0.382', color: DOWN_COLOR, lineWidth: 1 },
  { id: 'plot3', title: '0.5', color: DOWN_COLOR, lineWidth: 2 },
  { id: 'plot4', title: '0.618', color: DOWN_COLOR, lineWidth: 1 },
  { id: 'plot5', title: '0.786', color: DOWN_COLOR, lineWidth: 1 },
  { id: 'plot6', title: '1', color: DOWN_COLOR, lineWidth: 2 },
  { id: 'plot7', title: '1.618', color: DOWN_COLOR, lineWidth: 3 },
];

export const metadata = {
  title: 'Auto Fibonacci',
  shortTitle: 'AutoFib',
  overlay: true,
};

/**
 * `ta.highestbars(source, length)` / `ta.lowestbars` with a constant length, one bar at a time: the offset to the best
 * of the last `length` non-na values (the newest one on ties), the distance in bars; na before bar `length - 1` and
 * while there is no value (the doubles of the library function: -0 for the current bar).
 */
class ExtremeBarsStep implements Committable {
  private vals: number[] = [];
  private ids: number[] = [];
  private barOf: number[] = [];
  private head = 0;
  /** Non-na values committed */
  private kept = 0;
  private bars = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
  }

  /** `b` (newer) beats or ties `a` */
  private wins(a: number, b: number): boolean {
    return this.lowest ? !(a < b) : !(a > b);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const i = this.bars;
    const own = Number.isFinite(value);
    const total = this.kept + (own ? 1 : 0);
    if (i < this.len - 1 || total === 0) return NaN;
    const from = total - this.len;
    let h = this.head;
    while (h < this.ids.length && this.ids[h]! < from) h++;
    if (own && (h >= this.ids.length || this.wins(this.vals[h]!, value))) return -(i - i);
    return -(i - this.barOf[h]!);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const bar = this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    const id = this.kept++;
    while (this.vals.length > this.head && this.wins(this.vals[this.vals.length - 1]!, v)) {
      this.vals.pop();
      this.ids.pop();
      this.barOf.pop();
    }
    this.vals.push(v);
    this.ids.push(id);
    this.barOf.push(bar);
    while (this.ids[this.head]! < this.kept - this.len) this.head++;
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals = this.vals.slice(this.head);
      this.ids = this.ids.slice(this.head);
      this.barOf = this.barOf.slice(this.head);
      this.head = 0;
    }
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers' | 'lines'> & { markers: MarkerData[]; lines: LineDrawingData[] } & { alerts: AlertConditionState[] };

const RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.618];
const ALERT_LEVELS = [1, 2, 3, 4, 5];

interface AutoFibRun extends BarRunState<Record<string, never>> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  hBars: ExtremeBarsStep;
  lBars: ExtremeBarsStep;
  highestArr: number[];
  lowestArr: number[];
  FH: number[];
  FL: number[];
  F: number[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AutoFibInputs>): BarStudy<AutoFibRun, Result> {
  const { length, plotF1618 } = { ...defaultInputs, ...inputs };
  // plot(plotF1618 and F1618 ? F1618 : na, ...): na when off, 0 or na
  const shown = (k: number, v: number) => (k === 7 && !(plotF1618 && v !== 0 && !isNaN(v)) ? NaN : v);
  return {
    init() {
      const s: AutoFibRun = {
        highest: new WindowExtreme(false, length),
        lowest: new WindowExtreme(true, length),
        hBars: new ExtremeBarsStep(false, length),
        lBars: new ExtremeBarsStep(true, length),
        highestArr: [], lowestArr: [], FH: [], FL: [],
        F: RATIOS.map(() => []),
        flags: alertConditions.map(() => []),
        times: alertConditions.map(() => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.highest, s.lowest, s.hBars, s.lBars];
      s.lists = s.times;
      s.series = [s.highestArr, s.lowestArr, s.FH, s.FL, ...s.F, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Fhigh = ta.highest(FPeriod), Flow = ta.lowest(FPeriod): na until FPeriod bars exist
      const h = s.highest.step(b.high);
      const l = s.lowest.step(b.low);
      s.highestArr[i] = h;
      s.lowestArr[i] = l;
      // The original's levels: FH / FL = ta.highestbars(high) / ta.lowestbars(low), downfibo = FH < FL; a downward fib
      // goes up from the low (Flow + range * r), an upward fib down from the high (Fhigh - range * r)
      const FH = s.hBars.step(b.high);
      const FL = s.lBars.step(b.low);
      s.FH[i] = FH;
      s.FL[i] = FL;
      const down = FH < FL;
      for (let k = 0; k < RATIOS.length; k++) {
        const r = RATIOS[k]!;
        s.F[k]![i] = down ? (h - l) * r + l : h - (h - l) * r;
      }
      // alertcondition(FH > FL and ta.crossover(close, F<r>)) ... for r = 0.236 ... 0.786: upward buy, upward sell,
      // downward buy (FH < FL), downward sell
      const up = FH > FL;
      const dn = FH < FL;
      const v = b.close;
      const pv = i > 0 ? bars[i - 1].close : NaN;
      const nl = ALERT_LEVELS.length;
      for (let j = 0; j < nl; j++) {
        const f = s.F[ALERT_LEVELS[j]!]!;
        const w = f[i]!;
        const pw = i > 0 ? f[i - 1]! : NaN;
        const over = v > w && pv <= pw;
        const under = v < w && pv >= pw;
        for (let q = 0; q < 4; q++) {
          const flag = q === 0 ? over && up : q === 1 ? under && up : q === 2 ? over && dn : under && dn;
          const k = q * nl + j;
          s.flags[k]![i] = flag;
          if (flag) s.times[k]!.push(b.time as number);
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      const num = (x: number | undefined) => (x === undefined ? NaN : x);
      const FH = s.FH;
      const FL = s.FL;
      // plot(F<r>, color = Fcolor, trackprice = true, show_last = 1): only the value of the last bar is drawn, with a
      // price line at that value across the chart
      const last = n - 1;
      const lastColor = last >= 0 && FH[last]! < FL[last]! ? DOWN_COLOR : UP_COLOR;
      const plots: Record<string, Point[]> = {};
      const lines: LineDrawingData[] = [];
      RATIOS.forEach((_r, k) => {
        const lastValue = last >= 0 ? shown(k, s.F[k]![last]!) : NaN;
        plots[`plot${k}`] = bars.map((b, i) => (i === last && !isNaN(lastValue)
          ? { time: b.time, value: lastValue, color: lastColor }
          : { time: b.time, value: NaN }));
        if (!isNaN(lastValue)) {
          lines.push({ time1: bars[0].time as number, price1: lastValue, time2: bars[last].time as number, price2: lastValue,
            color: lastColor, width: 1, style: 'dashed', extend: 'both' });
        }
      });

      // plotshape(F<r>, style = shape.labeldown, location.absolute, color = Fcolor, show_last = 1, text = '%<r>',
      // offset = 15) and the High / Low labels (size.large, yellow, offset = FH / FL): drawn on the last bar only
      const markers: MarkerData[] = [];
      if (last >= 0) {
        const interval = barInterval(bars);
        const down = FH[last]! < FL[last]!;
        const fColor = down ? DOWN_COLOR : UP_COLOR;
        const textColor = String(color.new(color.black, 30));
        const texts = ['%0', '%23.6', '%38.2', '%50', '%61.8', '%78.6', '%100', '%161.8'];
        texts.forEach((text, k) => {
          // plotF1618 and F1618 ? F1618 : na
          const v = shown(k, s.F[k]![last]!);
          if (isNaN(v)) return;
          markers.push({ id: `shape${k}`, time: barTime(bars, last + 15, interval), position: 'atPriceTop', price: v,
            shape: 'labelDown', color: fColor, text, textColor });
        });
        const yellow = '#FFEB3B';
        const lo = num(s.lowestArr[last]), hi = num(s.highestArr[last]);
        if (!isNaN(lo) && !isNaN(FL[last]!)) {
          markers.push({ id: 'shape8', time: barTime(bars, last + FL[last]!, interval), position: 'atPriceBottom', price: lo,
            shape: 'labelUp', color: yellow, text: 'Low', textColor: color.black, size: 'large' });
        }
        if (!isNaN(hi) && !isNaN(FH[last]!)) {
          markers.push({ id: 'shape9', time: barTime(bars, last + FH[last]!, interval), position: 'atPriceTop', price: hi,
            shape: 'labelDown', color: yellow, text: 'High', textColor: color.black, size: 'large' });
        }
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers,
        lines,
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoFibInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AutoFibInputs> = {},
): Omit<IndicatorResult, 'markers' | 'lines'> & { markers: MarkerData[]; lines: LineDrawingData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = (['Upward Buy', 'Upward Sell', 'Downward Buy', 'Downward Sell'] as const)
  .flatMap((kind) => ['F236', 'F382', 'F500', 'F618', 'F786'].map((lvl) => `${kind} ${lvl}`))
  .map((m, k) => ({ id: `alert${k}`, title: `${m} Signal`, message: m }));

export const AutoFib = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
