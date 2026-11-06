/**
 * Aroon with RSI Confirmation (92.86%)
 *
 * Aroon up / down over length + 1 bars: 100 * (highestbars(high) + length) / length and the same with lowestbars(low).
 * A buy circle is drawn below the bar when Aroon down is 92.86 within the tolerance, the RSI is above its SMA and
 * the distance between the RSI and its SMA is at most the threshold. A sell circle is drawn above the bar when Aroon
 * up is 92.86 within the tolerance, the RSI is below its SMA and the distance is at most the threshold. The two Aroon
 * lines are hidden plots.
 *
 * Reference: "Aroon with RSI Confirmation (92.86%)" by jaydipali622018
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';

export interface AroonWithRsiConfirmationInputs {
  /** Aroon length */
  length: number;
  /** RSI length */
  rsiLength: number;
  /** SMA length of the RSI */
  smoothLength: number;
  /** Maximum distance between the RSI and its SMA (points) */
  diffThreshold: number;
  /** Tolerance around the Aroon level 92.86 */
  tolerance: number;
}

export const defaultInputs: AroonWithRsiConfirmationInputs = {
  length: 14,
  rsiLength: 14,
  smoothLength: 14,
  diffThreshold: 4.6,
  tolerance: 0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Aroon Length', defval: 14, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smoothed RSI Length', defval: 14, min: 1 },
  { id: 'diffThreshold', type: 'float', title: 'Max RSI Difference (pts)', defval: 4.6 },
  { id: 'tolerance', type: 'float', title: 'Aroon 92.86 Tolerance ±', defval: 0.2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Aroon Up', color: color.orange, lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Aroon Down', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Aroon with RSI Confirmation (92.86%)',
  shortTitle: 'Aroon+RSI',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/**
 * `ta.highestbars(source, length)` / `ta.lowestbars` with a constant length, one bar at a time: the offset to the bar
 * of the best of the last `length` non-na values (the newest one on equal values), na before bar `length - 1` and
 * while no value was received (the rules of the oakscriptjs array function).
 */
class ExtremeBarsStep {
  private vals: number[] = [];
  private bars: number[] = [];
  private ids: number[] = [];
  private head = 0;
  /** Non-na values committed */
  private kept = 0;
  private pendingValue = NaN;
  private pendingBar = -1;
  private readonly len: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
  }

  /** `a` stays the extreme over the newer `b`: strictly better */
  private better(a: number, b: number): boolean {
    return this.lowest ? a < b : a > b;
  }

  step(bar: number, value: number): number {
    const own = Number.isFinite(value);
    this.pendingValue = value;
    this.pendingBar = own ? bar : -1;
    const total = this.kept + (own ? 1 : 0);
    if (bar < this.len - 1 || total === 0) return NaN;
    const from = total - this.len;
    let h = this.head;
    while (h < this.ids.length && this.ids[h]! < from) h++;
    let best: number;
    if (h < this.ids.length && (!own || this.better(this.vals[h]!, value))) best = this.bars[h]!;
    else best = bar;
    return -(bar - best);
  }

  commit(): void {
    if (this.pendingBar < 0) return;
    const v = this.pendingValue;
    const id = this.kept++;
    while (this.vals.length > this.head && !this.better(this.vals[this.vals.length - 1]!, v)) {
      this.vals.pop();
      this.bars.pop();
      this.ids.pop();
    }
    this.vals.push(v);
    this.bars.push(this.pendingBar);
    this.ids.push(id);
    this.pendingBar = -1;
    while (this.ids[this.head]! < this.kept - this.len) this.head++;
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals = this.vals.slice(this.head);
      this.bars = this.bars.slice(this.head);
      this.ids = this.ids.slice(this.head);
      this.head = 0;
    }
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface AroonRun extends BarRunState<Record<string, never>> {
  hb: ExtremeBarsStep;
  lb: ExtremeBarsStep;
  rsi: ReturnType<typeof taStep.rsi>;
  sma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<AroonWithRsiConfirmationInputs>): BarStudy<AroonRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length } = cfg;
  const buyColor = String(color.new(color.green, 0));
  const sellColor = String(color.new(color.red, 0));
  return {
    init() {
      const hb = new ExtremeBarsStep(false, length + 1);
      const lb = new ExtremeBarsStep(true, length + 1);
      const rsi = taStep.rsi(cfg.rsiLength);
      const sma = new WindowSma(cfg.smoothLength);
      const s: AroonRun = {
        hb, lb, rsi, sma, plot0: [], plot1: [], markers: [],
        steps: [hb, lb, rsi, sma], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const upper = (100 * (s.hb.step(i, b.high) + length)) / length;
      const lower = (100 * (s.lb.step(i, b.low) + length)) / length;
      const rsi = s.rsi.step(b.close);
      const smoothRsi = s.sma.step(rsi);

      const rsiDiff = Math.abs(rsi - smoothRsi);
      const aroonUpHit = le(Math.abs(upper - 92.86), cfg.tolerance);
      const aroonDownHit = le(Math.abs(lower - 92.86), cfg.tolerance);
      const buyCond = aroonDownHit && le(rsiDiff, cfg.diffThreshold) && gt(rsi, smoothRsi);
      const sellCond = aroonUpHit && le(rsiDiff, cfg.diffThreshold) && lt(rsi, smoothRsi);
      // plotshape(..., style = shape.circle, size = size.small, text = "BUY" / "SELL"); default text colour (blue)
      if (buyCond) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: buyColor, size: 'small',
          text: 'BUY', textColor: color.blue });
      }
      if (sellCond) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: sellColor, size: 'small',
          text: 'SELL', textColor: color.blue });
      }
      s.plot0[i] = { time: b.time, value: upper, color: color.orange };
      s.plot1[i] = { time: b.time, value: lower, color: color.blue };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AroonWithRsiConfirmationInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AroonWithRsiConfirmationInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AroonWithRsiConfirmation = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
