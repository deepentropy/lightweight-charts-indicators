/**
 * Scalp Pro
 *
 * A MACD built with two-pole "super smoother" filters instead of moving averages. Each filter is
 * `c1 * (x + x[1]) / 2 + c2 * y[1] + c3 * y[2]` with `a = exp(-1.414 * pi / length)`, `c2 = 2 * a * cos(1.414 * pi /
 * length)`, `c3 = -a * a` and `c1 = 1 - c2 - c3`. The main line is the fast filter of the close minus the slow one,
 * times 10,000,000; the signal line is the filter of the main line. A "Buy" label is drawn when the main line crosses
 * above the signal line, a "Sell" label when it crosses below.
 *
 * Limit of the port: the 2 alert conditions give no output.
 *
 * Reference: "Scalp Pro" by ovelix
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ScalpProInputs {
  /** Length of the fast filter */
  fastLength: number;
  /** Length of the slow filter */
  slowLength: number;
  /** Length of the filter of the signal line */
  smoothLength: number;
}

export const defaultInputs: ScalpProInputs = {
  fastLength: 8,
  slowLength: 10,
  smoothLength: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Line', defval: 8, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Line', defval: 10, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smoothness', defval: 8, min: 1 },
];

// Colour constants of Pine version 2, with the default plot transparency of that version (35)
const LIME = String(color.new('#00FF00', 35));
const YELLOW = String(color.new('#FFFF00', 35));
const GREEN = '#008000';
const RED = '#FF0000';
const WHITE = '#FFFFFF';
// fill(p1, p2, color = black): the default fill transparency of that version is 90
const FILL = String(color.new('#000000', 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: LIME, lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: YELLOW, lineWidth: 1 },
];

export const metadata = {
  title: 'Scalp Pro',
  shortTitle: 'Scalp Pro',
  overlay: false,
};

/** nz(): na becomes 0 */
const nz = (v: number) => (Number.isNaN(v) ? 0 : v);

/** y = c1 * (x + x[1]) * 0.5 + c2 * nz(y[1]) + c3 * nz(y[2]), one bar at a time */
class SuperSmoother {
  private readonly c1: number;
  private readonly c2: number;
  private readonly c3: number;
  private x1 = NaN;
  private y1 = NaN;
  private y2 = NaN;
  private pendingX = NaN;
  private pendingY = NaN;
  private stepped = false;

  constructor(length: number) {
    const f = (1.414 * 3.141592653589793238462643) / length;
    const a = Math.exp(-f);
    this.c2 = 2 * a * Math.cos(f);
    this.c3 = -a * a;
    this.c1 = 1 - this.c2 - this.c3;
  }

  step(x: number): number {
    this.stepped = true;
    this.pendingX = x;
    this.pendingY = this.c1 * (x + this.x1) * 0.5 + this.c2 * nz(this.y1) + this.c3 * nz(this.y2);
    return this.pendingY;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.x1 = this.pendingX;
    this.y2 = this.y1;
    this.y1 = this.pendingY;
  }
}

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface ScalpRun extends BarRunState<Record<string, never>> {
  fast: SuperSmoother;
  slow: SuperSmoother;
  sig: SuperSmoother;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<ScalpProInputs>): BarStudy<ScalpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const fast = new SuperSmoother(cfg.fastLength);
      const slow = new SuperSmoother(cfg.slowLength);
      const sig = new SuperSmoother(cfg.smoothLength);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: ScalpRun = {
        fast, slow, sig, over, under, plot0: [], plot1: [], markers: [],
        steps: [fast, slow, sig, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const macd = (s.fast.step(close) - s.slow.step(close)) * 10000000;
      const signal = s.sig.step(macd);
      const buy = s.over.step(macd, signal);
      const sell = s.under.step(macd, signal);
      // plotshape(buy, text = 'Buy', style = shape.labelup, location = location.belowbar, color = green,
      //   textcolor = white, transp = 0, size = size.tiny)
      if (buy) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: GREEN, text: 'Buy', textColor: WHITE, size: 'tiny' });
      }
      if (sell) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: RED, text: 'Sell', textColor: WHITE, size: 'tiny' });
      }
      s.plot0[i] = { time: b.time as number, value: macd };
      s.plot1[i] = { time: b.time as number, value: signal };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: FILL } }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ScalpProInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ScalpProInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ScalpPro = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
