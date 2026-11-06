/**
 * Quantitative Qualitative Estimation (QQE)
 *
 * FAST = EMA of the RSI. Its absolute bar-to-bar change is smoothed twice with a Wilder factor (1 / RSI length)
 * and multiplied by 4.236 to give a band above and below FAST. SLOW is a trailing line that follows the lower band
 * while FAST is above it and the upper band while FAST is below it. The area between FAST and SLOW is green when
 * FAST is above and red when it is below; Buy / Sell labels mark the crosses of FAST and SLOW.
 * Alerts (alertcondition, `alerts` of the result): the original's five conditions, crosses of FAST with SLOW (any
 * cross, crossover, crossunder) and with 50.
 *
 * Reference: "Quantitative Qualitative Estimation" (QQE) by KivancOzbilgic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © KivancOzbilgic
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface QqeKivancInputs {
  src: SourceType;
  /** RSI length */
  length: number;
  /** EMA length of the RSI smoothing */
  SSF: number;
  /** Show the Buy / Sell labels on the crosses */
  showsignals: boolean;
  /** Fill the area between FAST and SLOW */
  highlighting: boolean;
}

export const defaultInputs: QqeKivancInputs = {
  src: 'close',
  length: 14,
  SSF: 5,
  showsignals: true,
  highlighting: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'src', defval: 'close' },
  { id: 'length', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'SSF', type: 'int', title: 'SF RSI SMoothing Factor', defval: 5, min: 1 },
  { id: 'showsignals', type: 'bool', title: 'Show Crossing Signals?', defval: true },
  { id: 'highlighting', type: 'bool', title: 'Highlighter On/Off ?', defval: true },
];

// Colour constants of Pine version 4
const MAROON = '#880E4F';
const BLUE = '#2196F3';
const GRAY = '#787B86';
const GREEN = '#4CAF50';
const RED = '#FF5252';
const WHITE = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'FAST', color: MAROON, lineWidth: 2 },
  { id: 'plot1', title: 'SLOW', color: BLUE, lineWidth: 1 },
  { id: 'plot2', title: 'Mid Line', color: GRAY, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'Quantitative Qualitative Estimation',
  shortTitle: 'QQE',
  overlay: false,
  precision: 4,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (v: number) => (isNaN(v) ? 0 : v);

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface QqeVars {
  wwma: number;
  atrRsi: number;
}

interface QqeRun extends BarRunState<QqeVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ema: ReturnType<typeof taStep.ema>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  fast: number[];
  slow: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  longFill: string[];
  shortFill: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<QqeKivancInputs>): BarStudy<QqeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const wwalpha = 1 / cfg.length;
  // fill(QQF, QQS, color = ...): default fill transparency 90
  const greenFill = String(color.new(GREEN, 90));
  const redFill = String(color.new(RED, 90));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(cfg.length);
      const ema = taStep.ema(cfg.SSF);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: QqeRun = {
        rsi, ema, over, under, fast: [], slow: [], plot0: [], plot1: [], plot2: [], longFill: [], shortFill: [],
        markers: [], flags: [[], [], [], [], []], times: [[], [], [], [], []],
        steps: [rsi, ema, over, under], vars: { wwma: NaN, atrRsi: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.fast, s.slow, s.plot0, s.plot1, s.plot2, s.longFill, s.shortFill, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const time = bars[i].time;
      // QQEF = ema(rsi(src, length), SSF) (RSII is the same series)
      const f = s.ema.step(s.rsi.step(value(bars[i])));
      s.fast[i] = f;
      const f1 = i > 0 ? s.fast[i - 1] : NaN;
      const tr = Math.abs(f - f1);
      v.wwma = wwalpha * tr + (1 - wwalpha) * nz(v.wwma);
      v.atrRsi = wwalpha * v.wwma + (1 - wwalpha) * nz(v.atrRsi);
      const qup = f + v.atrRsi * 4.236;
      const qdn = f - v.atrRsi * 4.236;
      const s1 = nz(i > 0 ? s.slow[i - 1] : NaN);
      const sl = lt(qup, s1) ? qup
        : gt(f, s1) && lt(f1, s1) ? qdn
          : gt(qdn, s1) ? qdn
            : lt(f, s1) && gt(f1, s1) ? qup
              : s1;
      s.slow[i] = sl;

      const buy = s.over.step(f, sl);
      const sell = s.under.step(f, sl);
      s.plot0[i] = { time, value: f };
      s.plot1[i] = { time, value: sl };
      s.plot2[i] = { time, value: 50 };
      s.longFill[i] = cfg.highlighting && gt(f, sl) ? greenFill : 'transparent';
      s.shortFill[i] = cfg.highlighting && lt(f, sl) ? redFill : 'transparent';
      // plotshape(buySignalr and showsignals ? QQES * 0.995 : na, location.absolute, shape.labelup, size.tiny)
      if (cfg.showsignals && buy && !isNaN(sl)) {
        s.markers.push({ time, position: 'atPriceBottom', price: sl * 0.995, shape: 'labelUp', color: GREEN,
          text: 'Buy', textColor: WHITE, size: 'tiny' });
      }
      if (cfg.showsignals && sell && !isNaN(sl)) {
        s.markers.push({ time, position: 'atPriceTop', price: sl * 1.005, shape: 'labelDown', color: RED,
          text: 'Sell', textColor: WHITE, size: 'tiny' });
      }
      // alertcondition(cross / crossover / crossunder(QQEF, QQES), crossover / crossunder(QQEF, 50))
      const flags = [!!buy || !!sell, !!buy, !!sell, f > 50 && f1 <= 50, f < 50 && f1 >= 50];
      flags.forEach((x, k) => {
        s.flags[k][i] = x;
        if (x) s.times[k].push(time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'UpTrend Highligter' }, colors: s.longFill.slice() },
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'DownTrend Highligter' }, colors: s.shortFill.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<QqeKivancInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<QqeKivancInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Cross Alert', message: 'QQE Crossing Signal!' },
  { id: 'alert1', title: 'Crossover Alarm', message: 'QQE BUY SIGNAL!' },
  { id: 'alert2', title: 'Crossunder Alarm', message: 'QQE SELL SIGNAL!' },
  { id: 'alert3', title: 'Cross 50 Up Alert', message: 'QQE FAST Crossing 50 UP!' },
  { id: 'alert4', title: 'Cross 50 Down Alert', message: 'QQE FAST Crossing 50 DOWN!' },
];

export const QqeKivanc = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
