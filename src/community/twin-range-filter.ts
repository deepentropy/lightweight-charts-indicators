/**
 * Twin Range Filter
 *
 * As the original: two smooth average ranges of the source, EMA(EMA(|source - source[1]|, t), 2t - 1) * m for the fast
 * (27, 1.6) and slow (55, 2) settings, averaged; the range filter follows the source but moves only when the source
 * leaves the range around it (na until the range exists). Long condition = source above the filter, not equal to the
 * source of the bar before, with the filter rising (count of rising bars > 0); short condition the mirror; CondIni = 1
 * on a long condition, -1 on a short one, else the value of the bar before. Long label below the bar (shape0) on a
 * long condition after CondIni -1, Short label above it (shape1) on a short condition after CondIni 1.
 * Alerts (alertcondition, `alerts` of the result): 'Long' and 'Short' on the bars of the labels.
 * As the original, only the two labels are drawn (no filter line, fills or bar colours).
 *
 * Reference: "Twin Range Filter" by colinmck
 */

import { taCore, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TwinRangeFilterInputs {
  src: SourceType;
  fastPeriod: number;
  fastRange: number;
  slowPeriod: number;
  slowRange: number;
}

export const defaultInputs: TwinRangeFilterInputs = {
  src: 'close',
  fastPeriod: 27,
  fastRange: 1.6,
  slowPeriod: 55,
  slowRange: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'fastPeriod', type: 'int', title: 'Fast period', defval: 27, min: 1 },
  { id: 'fastRange', type: 'float', title: 'Fast range', defval: 1.6, min: 0.1 },
  { id: 'slowPeriod', type: 'int', title: 'Slow period', defval: 55, min: 1 },
  { id: 'slowRange', type: 'float', title: 'Slow range', defval: 2, min: 0.1 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Twin Range Filter',
  shortTitle: 'TRF',
  overlay: true,
};

/** smoothrng(x, t, m) of the original */
export function smoothRange(x: number[], t: number, m: number): number[] {
  const absChange = x.map((v, i) => (i > 0 ? Math.abs(v - x[i - 1]) : NaN));
  return taCore.ema(taCore.ema(absChange, t), t * 2 - 1).map((v) => v * m);
}

/** rngfilt(x, r) of the original: nz() of the filter of the bar before */
export function rangeFilter(x: number[], r: number[]): number[] {
  const out: number[] = new Array(x.length);
  let prevRaw = NaN;
  for (let i = 0; i < x.length; i++) {
    const p = Number.isFinite(prevRaw) ? prevRaw : 0;
    const v = x[i] > p ? (x[i] - r[i] < p ? p : x[i] - r[i]) : (x[i] + r[i] > p ? p : x[i] + r[i]);
    out[i] = Number.isFinite(v) ? v : NaN;
    prevRaw = out[i];
  }
  return out;
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface TrfVars {
  prevSource: number;
  /** rngfilt of the bar before */
  prevFilt: number;
  upward: number;
  downward: number;
  condIni: number;
}

interface TrfRun extends BarRunState<TrfVars> {
  ema1a: ReturnType<typeof taStep.ema>;
  ema1b: ReturnType<typeof taStep.ema>;
  ema2a: ReturnType<typeof taStep.ema>;
  ema2b: ReturnType<typeof taStep.ema>;
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TwinRangeFilterInputs>): BarStudy<TrfRun, Result> {
  const { fastPeriod, fastRange, slowPeriod, slowRange, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // smoothrng(x, t, m) = ta.ema(ta.ema(math.abs(x - x[1]), t), t * 2 - 1) * m
      const ema1a = taStep.ema(fastPeriod);
      const ema1b = taStep.ema(fastPeriod * 2 - 1);
      const ema2a = taStep.ema(slowPeriod);
      const ema2b = taStep.ema(slowPeriod * 2 - 1);
      const s: TrfRun = {
        ema1a, ema1b, ema2a, ema2b, markers: [], flags: [[], []], times: [[], []],
        steps: [ema1a, ema1b, ema2a, ema2b],
        vars: { prevSource: NaN, prevFilt: NaN, upward: 0, downward: 0, condIni: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = s.flags;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const x = value(b);
      const s1 = i > 0 ? v.prevSource : NaN;
      const absChange = i > 0 ? Math.abs(x - s1) : NaN;
      const smrng1 = s.ema1b.step(s.ema1a.step(absChange)) * fastRange;
      const smrng2 = s.ema2b.step(s.ema2a.step(absChange)) * slowRange;
      const r = (smrng1 + smrng2) / 2;
      // rngfilt(x, r): nz() of the filter of the bar before
      const p = Number.isFinite(v.prevFilt) ? v.prevFilt : 0;
      const raw = x > p ? (x - r < p ? p : x - r) : (x + r > p ? p : x + r);
      const filt = Number.isFinite(raw) ? raw : NaN;
      const f1 = i > 0 ? v.prevFilt : NaN;

      // upward / downward: counts of rising / falling filter bars (na comparisons false)
      const up1 = v.upward, dn1 = v.downward;
      const upward = filt > f1 ? up1 + 1 : filt < f1 ? 0 : up1;
      const downward = filt < f1 ? dn1 + 1 : filt > f1 ? 0 : dn1;

      // longCond := source > filt and source > source[1] and upward > 0 or source > filt and source < source[1] and
      // upward > 0 (shortCond the mirror); CondIni := longCond ? 1 : shortCond ? -1 : CondIni[1] (na on the first bar);
      // long = longCond and CondIni[1] == -1, short = shortCond and CondIni[1] == 1
      const longCond = (x > filt && x > s1 && upward > 0) || (x > filt && x < s1 && upward > 0);
      const shortCond = (x < filt && x < s1 && downward > 0) || (x < filt && x > s1 && downward > 0);
      const long = longCond && v.condIni === -1;
      const short = shortCond && v.condIni === 1;
      if (long) {
        s.markers.push({ id: 'shape0', time: b.time, position: 'belowBar', shape: 'labelUp', color: '#00E676', text: 'Long', textColor: '#000000', size: 'tiny' });
      }
      if (short) {
        s.markers.push({ id: 'shape1', time: b.time, position: 'aboveBar', shape: 'labelDown', color: '#FF5252', text: 'Short', textColor: '#FFFFFF', size: 'tiny' });
      }
      v.condIni = longCond ? 1 : shortCond ? -1 : v.condIni;
      v.prevSource = x;
      v.prevFilt = filt;
      v.upward = upward;
      v.downward = downward;
      [long, short].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        // the original plots only the two labels
        plots: {},
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TwinRangeFilterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TwinRangeFilterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long', message: 'Long' },
  { id: 'alert1', title: 'Short', message: 'Short' },
];

export const TwinRangeFilter = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
