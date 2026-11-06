/**
 * Stochastic OTT
 *
 * Optimized Trend Tracker applied to Stochastic oscillator.
 * Smooths raw Stochastic %K with VAR (CMO-based adaptive MA),
 * then applies OTT trailing stop logic to the smoothed value.
 * Alerts (alertcondition, `alerts` of the result): Price Cross / Crossover / Crossunder of the %K line (+1000) and
 * the OTT two bars back.
 *
 * Reference: "Stochastic Optimized Trend Tracker" by KivancOzbilgic
 */

import { taCore, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface StochasticOTTInputs {
  kLen: number;
  kSmooth: number;
  ottPeriod: number;
  ottPct: number;
  showSupport: boolean;
}

export const defaultInputs: StochasticOTTInputs = {
  kLen: 500,
  kSmooth: 200,
  ottPeriod: 2,
  ottPct: 0.5,
  showSupport: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: '%K Length', defval: 500, min: 1 },
  { id: 'kSmooth', type: 'int', title: '%K Smoothing', defval: 200, min: 1 },
  { id: 'ottPeriod', type: 'int', title: 'OTT Period', defval: 2, min: 1 },
  { id: 'ottPct', type: 'float', title: 'OTT Percent', defval: 0.5, min: 0, step: 0.1 },
  { id: 'showSupport', type: 'bool', title: 'Show Support Line?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%K', color: '#0094FF', lineWidth: 1 },
  { id: 'plot1', title: 'OTT', color: '#B800D9', lineWidth: 2 },
  { id: 'plot2', title: 'Support Line', color: '#0585E1', lineWidth: 2 },
];

export const metadata = {
  title: 'Stochastic OTT',
  shortTitle: 'StochOTT',
  overlay: false,
};

/**
 * VAR function (VIDYA-like using CMO over 9 bars) matching PineScript Var_Func, on bar `i` of `srcArr` (its values up
 * to bar i) from the results of the earlier bars
 */
function varFunc(srcArr: number[], result: number[], i: number, length: number): number {
  const valpha = 2 / (length + 1);
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
  return i === 0 ? s : valpha * Math.abs(vCMO) * s + (1 - valpha * Math.abs(vCMO)) * result[i - 1];
}

/**
 * `ta.stoch(source, high, low, length)` with a constant length on {@link WindowExtreme}s (the doubles of taStep.stoch,
 * whose highest / lowest loop over the window): an na result keeps the previous one.
 */
class StochStep implements Committable {
  private readonly highest: WindowExtreme;
  private readonly lowest: WindowExtreme;
  private previous = NaN;
  private next = NaN;
  private stepped = false;

  constructor(length: number) {
    // the length check of ta.stoch (the same runtime error)
    taCore.stoch([], [], [], length);
    this.highest = new WindowExtreme(false, length);
    this.lowest = new WindowExtreme(true, length);
  }

  step(source: number, high: number, low: number): number {
    this.stepped = true;
    const lo = this.lowest.step(low);
    const k = (100 * (source - lo)) / (this.highest.step(high) - lo);
    this.next = Number.isNaN(k) ? this.previous : k;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.previous = this.next;
    this.highest.commit();
    this.lowest.commit();
  }
}

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface StochOttRun extends BarRunState<Record<string, never>> {
  stoch: StochStep;
  rawK: number[];
  kArr: number[];
  srcArr: number[];
  mAvg: number[];
  longStop: number[];
  shortStop: number[];
  dir: number[];
  ott: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<StochasticOTTInputs>): BarStudy<StochOttRun, Result> {
  const { kLen, kSmooth, ottPeriod, ottPct, showSupport } = { ...defaultInputs, ...inputs };
  const warmup = kLen + kSmooth;
  return {
    init() {
      const stoch = new StochStep(kLen);
      const s: StochOttRun = {
        stoch, rawK: [], kArr: [], srcArr: [], mAvg: [], longStop: [], shortStop: [], dir: [], ott: [],
        plot0: [], plot1: [], plot2: [], markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [stoch], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [
        s.rawK, s.kArr, s.srcArr, s.mAvg, s.longStop, s.shortStop, s.dir, s.ott, s.plot0, s.plot1, s.plot2, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // Pine: stoch(close, high, low, periodK)
      const raw = s.stoch.step(b.close, b.high, b.low);
      s.rawK[i] = (raw != null && !isNaN(raw)) ? raw : 0;
      // Pine: k = Var_Func1(stoch(...), smoothK) -- VAR-smooth the raw stochastic
      s.kArr[i] = varFunc(s.rawK, s.kArr, i, kSmooth);
      // Pine: src = k + 1000
      const src = s.kArr[i] + 1000;
      s.srcArr[i] = src;
      // Pine: MAvg = Var_Func(src, length) -- VAR of the offset source
      const mAvg = varFunc(s.srcArr, s.mAvg, i, ottPeriod);
      s.mAvg[i] = mAvg;

      // OTT trailing stop on MAvg
      const fark = mAvg * ottPct * 0.01;
      const { longStop, shortStop, dir, ott } = s;
      longStop[i] = mAvg - fark;
      shortStop[i] = mAvg + fark;
      if (i > 0) {
        if (mAvg > longStop[i - 1]) longStop[i] = Math.max(longStop[i], longStop[i - 1]);
        if (mAvg < shortStop[i - 1]) shortStop[i] = Math.min(shortStop[i], shortStop[i - 1]);

        dir[i] = dir[i - 1];
        if (dir[i - 1] === -1 && mAvg > shortStop[i - 1]) dir[i] = 1;
        else if (dir[i - 1] === 1 && mAvg < longStop[i - 1]) dir[i] = -1;
      } else {
        dir[i] = 1;
      }
      const mt = dir[i] === 1 ? longStop[i] : shortStop[i];
      ott[i] = mAvg > mt ? mt * (200 + ottPct) / 200 : mt * (200 - ottPct) / 200;

      // Pine: plot(k+1000, title="%K", color=#0094FF)
      s.plot0[i] = { time, value: i < warmup ? NaN : src };
      // Pine: pALL=plot(nz(OTT[2]), color=#B800D9, linewidth=2, title="OTT") -- 2-bar lag
      s.plot1[i] = { time, value: (i < warmup + 2) ? NaN : ott[i - 2] };
      // Pine: plot(showsupport ? MAvg : na, color=#0585E1, linewidth=2, title="Support Line")
      s.plot2[i] = { time, value: (i < warmup || !showSupport) ? NaN : mAvg };

      // Markers: buy when src crosses above OTT[2], sell when crosses below
      // Pine: buySignalc = crossover(src, OTT[2])
      // Pine: sellSignallc = crossunder(src, OTT[2])
      if (i >= warmup + 3) {
        const srcPrev = s.srcArr[i - 1];
        const ottLag = ott[i - 2];
        const ottLagPrev = ott[i - 3];
        if (srcPrev <= ottLagPrev && src > ottLag) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
        }
        if (srcPrev >= ottLagPrev && src < ottLag) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
        }
      }

      // alertcondition(cross(src, OTT[2])) / crossover(src, OTT[2]) / crossunder(src, OTT[2]), on every bar
      const w = i >= 2 ? ott[i - 2] : NaN;
      const pv = i > 0 ? s.srcArr[i - 1] : NaN;
      const pw = i >= 3 ? ott[i - 3] : NaN;
      const up = src > w && pv <= pw;
      const down = src < w && pv >= pw;
      s.flags[0][i] = up || down;
      s.flags[1][i] = up;
      s.flags[2][i] = down;
      if (up || down) s.times[0].push(time as number);
      if (up) s.times[1].push(time as number);
      if (down) s.times[2].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [
          // Pine: fill(h0, h1, color=#9915FF, transp=80) between hlines at 1080 and 1020
          { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(153,21,255,0.2)' } },
        ],
        hlines: [
          { value: 1080, options: { color: '#606060', linestyle: 'solid' as const, title: 'Upper Band' } },
          { value: 1020, options: { color: '#606060', linestyle: 'solid' as const, title: 'Lower Band' } },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StochasticOTTInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StochasticOTTInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Price Cross Alert', message: 'OTT - Price Crossing!' },
  { id: 'alert1', title: 'Price Crossover Alarm', message: 'PRICE OVER OTT - BUY SIGNAL!' },
  { id: 'alert2', title: 'Price Crossunder Alarm', message: 'PRICE UNDER OTT - SELL SIGNAL!' },
];

export const StochasticOTT = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
