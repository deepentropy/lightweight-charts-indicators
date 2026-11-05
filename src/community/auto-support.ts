/**
 * Auto-Support v0.3
 *
 * Pine: overlay=true, 28 pairs of resistance (highest) and support (lowest) lines
 * at various multipliers of a sensitivity parameter.
 * Each pair: resistance = highest(close, sensitivity * mult), support = lowest(close, sensitivity * mult)
 *
 * Pine uses offset=-9999 with trackprice=true so only the latest value shows as a horizontal line.
 * In lightweight-charts we render full time-series since trackprice is unavailable.
 *
 * Multipliers: 1,2,3,4,5,6,7,8,9,10,15,20,25,30,35,40,45,50,75,100,150,200,250,300,350,400,450,500
 *
 * Reference: "Auto-Support v 0.3" (community)
 */

import type { IndicatorResult, InputConfig, PlotConfig, Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface AutoSupportInputs {
  sensitivity: number;
}

export const defaultInputs: AutoSupportInputs = {
  sensitivity: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'sensitivity', type: 'int', title: 'Sensitivity', defval: 10, min: 1, max: 10 },
];

const MULTIPLIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 35, 40, 45, 50, 75, 100, 150, 200, 250, 300, 350, 400, 450, 500];

// Pine: b = #FF0000 (resistance), c = #0000FF (support), transp=85 default
// 85% transparency = 0.15 alpha → rgba
const R_COLOR = 'rgba(255,0,0,0.15)';
const S_COLOR = 'rgba(0,0,255,0.15)';

// Generate plotConfig for all 56 plots (28 resistance + 28 support)
export const plotConfig: PlotConfig[] = MULTIPLIERS.flatMap((m) => [
  { id: `r${m}`, title: `Resistance ${m}x`, color: R_COLOR, lineWidth: 2 },
  { id: `s${m}`, title: `Support ${m}x`, color: S_COLOR, lineWidth: 2 },
]);

export const metadata = {
  title: 'Auto-Support',
  shortTitle: 'AutoSup',
  overlay: true,
};

/**
 * `ta.highest(source, length)` / `ta.lowest` one bar at a time with a queue of the candidates (the doubles of the
 * library function): the extreme of the last `length` finite values, na before bar `length - 1`; when the extreme is
 * a zero, +0 for the highest (-0 for the lowest) when the window holds one.
 */
class WindowExtreme implements Committable {
  /** Candidates: index among the kept values and value, from the best to the worst (the oldest first on ties) */
  private qi: number[] = [];
  private qv: number[] = [];
  private head = 0;
  private kept = 0;
  private bars = 0;
  /** Kept index of the last preferred zero */
  private lastPref = -1;
  private len = 1;
  private pending = NaN;
  private stepped = false;
  private readonly pref: number;

  constructor(private readonly lowest: boolean) {
    this.pref = lowest ? -0 : 0;
  }

  step(value: number, length: number): number {
    this.stepped = true;
    this.pending = value;
    const len = Math.trunc(length);
    this.len = len;
    const own = Number.isFinite(value);
    const n = this.kept + (own ? 1 : 0);
    if (this.bars < len - 1 || n === 0) return NaN;
    const from = n - len;
    let h = this.head;
    while (h < this.qi.length && this.qi[h]! < from) h++;
    let best: number;
    if (h < this.qi.length) {
      best = this.qv[h]!;
      if (own && (this.lowest ? value < best : value > best)) best = value;
    } else {
      best = value;
    }
    if (best === 0) {
      const hasPref = (own && Object.is(value, this.pref)) || this.lastPref >= from;
      return hasPref ? this.pref : -this.pref;
    }
    return best;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const x = this.pending;
    if (Number.isFinite(x)) {
      const { qi, qv } = this;
      while (qi.length > this.head) {
        const last = qv[qv.length - 1]!;
        if (!(this.lowest ? last > x : last < x)) break;
        qi.pop();
        qv.pop();
      }
      qi.push(this.kept);
      qv.push(x);
      if (Object.is(x, this.pref)) this.lastPref = this.kept;
      this.kept++;
    }
    const from = this.kept - this.len;
    while (this.head < this.qi.length && this.qi[this.head]! < from) this.head++;
    if (this.head > 1024 && this.head * 2 > this.qi.length) {
      this.qi = this.qi.slice(this.head);
      this.qv = this.qv.slice(this.head);
      this.head = 0;
    }
  }
}

type Point = { time: number; value: number };

interface AutoSupportRun extends BarRunState<Record<string, never>> {
  highs: WindowExtreme[];
  lows: WindowExtreme[];
  rPlots: Point[][];
  sPlots: Point[][];
}

function study(inputs: Partial<AutoSupportInputs>): BarStudy<AutoSupportRun, IndicatorResult> {
  const { sensitivity } = { ...defaultInputs, ...inputs };
  const lens = MULTIPLIERS.map((m) => sensitivity * m);
  return {
    init() {
      const highs = MULTIPLIERS.map(() => new WindowExtreme(false));
      const lows = MULTIPLIERS.map(() => new WindowExtreme(true));
      const s: AutoSupportRun = {
        highs, lows, rPlots: MULTIPLIERS.map(() => []), sPlots: MULTIPLIERS.map(() => []),
        steps: [...highs, ...lows], vars: {}, lists: [], series: [],
      };
      s.series = [...s.rPlots, ...s.sPlots];
      return s;
    },
    bar(s, i, bars) {
      const { time, close } = bars[i];
      for (let k = 0; k < lens.length; k++) {
        const len = lens[k];
        // Pine: highest(a*N) = highest(close, a*N), lowest(a*N) = lowest(close, a*N)
        const hi = s.highs[k].step(close, Math.max(len, 1));
        const lo = s.lows[k].step(close, Math.max(len, 1));
        const ready = i >= len - 1;
        s.rPlots[k][i] = { time, value: ready ? hi : NaN };
        s.sPlots[k][i] = { time, value: ready ? lo : NaN };
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      MULTIPLIERS.forEach((m, k) => {
        plots[`r${m}`] = s.rPlots[k].slice();
        plots[`s${m}`] = s.sPlots[k].slice();
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoSupportInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AutoSupportInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AutoSupport = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
