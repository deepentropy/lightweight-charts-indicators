/**
 * Twin Range Filter Visualized
 *
 * Two smoothed ranges of the source: ema(ema(|x - x[1]|, period), 2 * period - 1) * range factor, for a fast and a
 * slow period; their average is the range. A range filter follows the source by at most that range. An upper band
 * (filter + range) and a lower band (filter - range) are trailed, and the Twin Range Filter line takes the upper or
 * the lower band, depending on the side of the close. BUY / SELL labels mark the crosses of the close and the line,
 * and the area between ohlc4 and the line is green when the close is above the line, red below.
 * Alerts (alertcondition, `alerts` of the result): 'Long' and 'Short', true on the crosses of the close over / under
 * the line (whatever "Show Buy/Sell Signals ?").
 *
 * Reference: "Twin Range Filter" by KivancOzbilgic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TwinRangeFilterVisualizedInputs {
  source: SourceType;
  /** Show the BUY / SELL labels */
  showsignals: boolean;
  /** Fast period */
  per1: number;
  /** Fast range */
  mult1: number;
  /** Slow period */
  per2: number;
  /** Slow range */
  mult2: number;
}

export const defaultInputs: TwinRangeFilterVisualizedInputs = {
  source: 'close',
  showsignals: true,
  per1: 27,
  mult1: 1.6,
  per2: 55,
  mult2: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showsignals', type: 'bool', title: 'Show Buy/Sell Signals ?', defval: true },
  { id: 'per1', type: 'int', title: 'Fast period', defval: 27, min: 1 },
  { id: 'mult1', type: 'float', title: 'Fast range', defval: 1.6, min: 0.1 },
  { id: 'per2', type: 'int', title: 'Slow period', defval: 55, min: 1 },
  { id: 'mult2', type: 'float', title: 'Slow range', defval: 2, min: 0.1 },
];

const BLUE = '#2962FF';
const SIGNAL = 'rgb(0, 19, 230)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'OHLC4', color: BLUE, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Twin Range Filter',
  shortTitle: 'Twin Range Filter',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const nz = (v: number) => (isNaN(v) ? 0 : v);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Ema = ReturnType<typeof taStep.ema>;

interface TwinRun extends BarRunState<Record<string, never>> {
  /** ema(abs(x - x[1]), t) and ema(.., t * 2 - 1) for the fast and the slow range */
  emas: Ema[];
  long: ReturnType<typeof taStep.crossover>;
  short: ReturnType<typeof taStep.crossunder>;
  x: number[];
  filt: number[];
  fub: number[];
  flb: number[];
  trf: number[];
  plot0: Point[];
  plot1: Point[];
  upColors: string[];
  downColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TwinRangeFilterVisualizedInputs>): BarStudy<TwinRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  // fill(mPlot, Trfff, color = close > TRF ? color.green : na, transp = 90), and the same in red below the line
  const green = String(color.new(color.green, 90));
  const red = String(color.new('#FF5252', 90)); // color.red of Pine v5
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: TwinRun = {
        emas: [taStep.ema(cfg.per1), taStep.ema(cfg.per1 * 2 - 1), taStep.ema(cfg.per2), taStep.ema(cfg.per2 * 2 - 1)],
        long: taStep.crossover(), short: taStep.crossunder(),
        x: [], filt: [], fub: [], flb: [], trf: [], plot0: [], plot1: [], upColors: [], downColors: [], markers: [],
        flags: [[], []], times: [[], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [...s.emas, s.long, s.short];
      s.lists = [s.markers, ...s.times];
      s.series = [s.x, s.filt, s.fub, s.flb, s.trf, s.plot0, s.plot1, s.upColors, s.downColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const xi = value(b);
      s.x[i] = xi;
      // smoothrng(x, t, m) = ema(ema(abs(x - x[1]), t), t * 2 - 1) * m
      const change = i > 0 ? Math.abs(xi - s.x[i - 1]) : NaN;
      const e = s.emas;
      const smrng1 = e[1].step(e[0].step(change)) * cfg.mult1;
      const smrng2 = e[3].step(e[2].step(change)) * cfg.mult2;
      const r = (smrng1 + smrng2) / 2;

      // rngfilt(x, r)
      const prev = nz(i > 0 ? s.filt[i - 1] : NaN);
      const filt = gt(xi, prev) ? (lt(xi - r, prev) ? prev : xi - r) : (gt(xi + r, prev) ? prev : xi + r);
      s.filt[i] = filt;
      const str = filt + r;
      const sts = filt - r;
      const close = b.close;
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      const fub1 = i > 0 ? s.fub[i - 1] : NaN;
      const flb1 = i > 0 ? s.flb[i - 1] : NaN;
      const fub = lt(str, nz(fub1)) || gt(close1, nz(fub1)) ? str : nz(fub1);
      const flb = gt(sts, nz(flb1)) || lt(close1, nz(flb1)) ? sts : nz(flb1);
      s.fub[i] = fub;
      s.flb[i] = flb;
      const t1 = nz(i > 0 ? s.trf[i - 1] : NaN);
      const trf = eq(t1, fub1) && le(close, fub) ? fub
        : eq(t1, fub1) && ge(close, fub) ? flb
          : eq(t1, flb1) && ge(close, flb) ? flb
            : eq(t1, flb1) && le(close, flb) ? fub
              : fub;
      s.trf[i] = trf;

      const long = s.long.step(close, trf);
      const short = s.short.step(close, trf);
      if (cfg.showsignals) {
        if (long) {
          s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: SIGNAL, text: 'BUY', textColor: '#FFFFFF', size: 'tiny' });
        }
        if (short) {
          s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: SIGNAL, text: 'SELL', textColor: '#FFFFFF', size: 'tiny' });
        }
      }
      s.upColors[i] = gt(close, trf) ? green : 'transparent';
      s.downColors[i] = lt(close, trf) ? red : 'transparent';
      s.plot0[i] = { time, value: Number.isFinite(trf) ? trf : NaN, color: BLUE };
      s.plot1[i] = { time, value: (b.open + b.high + b.low + b.close) / 4, color: BLUE };
      // alertcondition(long, 'Long') / alertcondition(short, 'Short')
      s.flags[0][i] = long;
      s.flags[1][i] = short;
      if (long) s.times[0].push(time as number);
      if (short) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        fills: [
          { plot1: 'plot1', plot2: 'plot0', options: { title: 'UpTrend Highligter' }, colors: s.upColors.slice() },
          { plot1: 'plot1', plot2: 'plot0', options: { title: 'DownTrend Highligter' }, colors: s.downColors.slice() },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TwinRangeFilterVisualizedInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TwinRangeFilterVisualizedInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long', message: 'Long' },
  { id: 'alert1', title: 'Short', message: 'Short' },
];

export const TwinRangeFilterVisualized = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
