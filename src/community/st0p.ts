/**
 * ST0P
 *
 * Percent trailing stop. SHORT = src + Unit + src * Percent / 100 and LONG = src - Unit - src * Percent / 100; the
 * short stop SUB takes SHORT when SHORT is below the previous SUB or the previous source closed above it, else it
 * keeps its value; the long stop SLB takes LONG when LONG is above the previous SLB or the previous source closed
 * below it. ST0P is SLB with "LONG=1 SHORT=2" = 1, else SUB; it is drawn green when rising, red when falling, blue
 * when flat. Two fills between an OHLC4 circle plot and the ST0P line highlight the selected side ("LONG
 * Highligter" green in long mode, "SHORT Highligter" red in short mode, white otherwise). A "ST0P" label marks the
 * source crossing over the short stop (short mode, at SHORT) or under the long stop (long mode, at LONG).
 * Alerts (alertcondition, `alerts` of the result): 'LONG POSITION ST0P!' (long mode, source crosses under ST0P) and
 * 'SHORT POSITION ST0P!' (short mode, source crosses over ST0P).
 *
 * Reference: "ST0P" by KivancOzbilgic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ST0PInputs {
  /** Percent */
  percent: number;
  /** Source */
  src: SourceType;
  /** LONG=1 SHORT=2 */
  changeLongShort: number;
  /** Unit (Pine KADEME) */
  unit: number;
  /** Show ST0P Signals ? */
  showSignals: boolean;
  /** Highlighter On/Off ? */
  highlighting: boolean;
}

export const defaultInputs: ST0PInputs = {
  percent: 3,
  src: 'close',
  changeLongShort: 1,
  unit: 0.0,
  showSignals: true,
  highlighting: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'percent', type: 'float', title: 'Percent', defval: 3 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'changeLongShort', type: 'int', title: 'LONG=1 SHORT=2', defval: 1, min: 1, max: 2 },
  { id: 'unit', type: 'float', title: 'Unit', defval: 0.0, step: 0.1 },
  { id: 'showSignals', type: 'bool', title: 'Show ST0P Signals ?', defval: true },
  { id: 'highlighting', type: 'bool', title: 'Highlighter On/Off ?', defval: true },
];

// Pine v4 colours
const GREEN = '#4CAF50';
const RED = '#FF5252';
const WHITE = '#FFFFFF';
const BLUE = '#2196F3';
const FLAT = '#001AE1';

/** Each fill() has its own pair of plots: plot(ohlc4, title = "", circles, linewidth 0) and plot(ST0P, linewidth 3) */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '', color: BLUE, lineWidth: 0, style: 'circles' },
  { id: 'plot1', title: 'Plot', color: BLUE, lineWidth: 3 },
  { id: 'plot2', title: '', color: BLUE, lineWidth: 0, style: 'circles' },
  { id: 'plot3', title: 'Plot', color: BLUE, lineWidth: 3 },
];

export const metadata = {
  title: 'ST0P',
  shortTitle: 'ST0P',
  overlay: true,
};

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'LONG POSITION ST0P!', message: 'SELL!' },
  { id: 'alert1', title: 'SHORT POSITION ST0P!', message: 'BUY!' },
];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (v: number, d = 0) => (isNaN(v) ? d : v);

/** fill() default transparency 90 */
const fillColor = (hex: string) => {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, 0.1)`;
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface St0pVars {
  /** SUB[1] (na before bar 0: nz -> 0) */
  sub: number;
  slb: number;
}

interface St0pRun extends BarRunState<St0pVars> {
  src: number[];
  st0p: number[];
  stPlot: Point[];
  ohlc4Plot: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ST0PInputs>): BarStudy<St0pRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const isLong = cfg.changeLongShort === 1;
  const isShort = cfg.changeLongShort === 2;
  const longFill = cfg.highlighting ? (isLong ? GREEN : WHITE) : WHITE;
  const shortFill = cfg.highlighting ? (isShort ? RED : WHITE) : WHITE;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: St0pRun = {
        src: [], st0p: [], stPlot: [], ohlc4Plot: [], markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: { sub: 0.0, slb: 0.0 }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.src, s.st0p, s.stPlot, s.ohlc4Plot, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = s.src;
      const st0p = s.st0p;
      const x = value(b) ?? NaN;
      src[i] = x;
      const s1 = i > 0 ? src[i - 1] : NaN;
      const SHORT = x + cfg.unit + (x * cfg.percent) / 100;
      const LONG = x - cfg.unit - (x * cfg.percent) / 100;
      // SUB := SHORT < nz(SUB[1]) or src[1] > nz(SUB[1]) ? SHORT : nz(SUB[1])
      const sub1 = nz(v.sub);
      v.sub = lt(SHORT, sub1) || gt(s1, sub1) ? SHORT : sub1;
      // SLB := LONG > nz(SLB[1]) or src[1] < nz(SLB[1]) ? LONG : nz(SLB[1])
      const slb1 = nz(v.slb);
      v.slb = gt(LONG, slb1) || lt(s1, slb1) ? LONG : slb1;
      const st = isLong ? v.slb : v.sub;
      st0p[i] = st;

      // color2 = ST0P > ST0P[1] ? green : ST0P < ST0P[1] ? red : #001AE1
      const p = i > 0 ? st0p[i - 1] : NaN;
      const c = gt(st, p) ? GREEN : lt(st, p) ? RED : FLAT;
      s.stPlot[i] = { time: b.time, value: st, color: c };
      s.ohlc4Plot[i] = { time: b.time, value: (b.open + b.high + b.low + b.close) / 4 };

      // ta.crossover(src, ST0P) / ta.crossunder(src, ST0P) (exact comparisons)
      const crossUp = x > st && s1 <= p;
      const crossDn = x < st && s1 >= p;
      const longStop = isLong && crossDn;
      const shortStop = isShort && crossUp;
      const t = b.time as number;
      // plotshape(changeLONGSHORT==2 and crossover(src,ST0P) and showsignals ? SHORT : na, "Buy", labelup, absolute, tiny)
      if (shortStop && cfg.showSignals && !isNaN(SHORT)) {
        s.markers.push({ time: t, id: 'shape0', position: 'atPriceBottom', price: SHORT, shape: 'labelUp', color: GREEN,
          text: 'ST0P', textColor: WHITE, size: 'tiny' });
      }
      // plotshape(changeLONGSHORT==1 and crossunder(src,ST0P) and showsignals ? LONG : na, "Sell", labeldown, absolute, tiny)
      if (longStop && cfg.showSignals && !isNaN(LONG)) {
        s.markers.push({ time: t, id: 'shape1', position: 'atPriceTop', price: LONG, shape: 'labelDown', color: RED,
          text: 'ST0P', textColor: WHITE, size: 'tiny' });
      }
      // alertcondition(changeLONGSHORT==1 and crossunder(src,ST0P)) / alertcondition(changeLONGSHORT==2 and crossover(src,ST0P))
      s.flags[0][i] = longStop;
      s.flags[1][i] = shortStop;
      if (longStop) s.times[0].push(t);
      if (shortStop) s.times[1].push(t);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.ohlc4Plot.slice(), plot1: s.stPlot.slice(),
          plot2: s.ohlc4Plot.map((p) => ({ ...p })), plot3: s.stPlot.map((p) => ({ ...p })),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'LONG Highligter', color: fillColor(longFill) } },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'SHORT Highligter', color: fillColor(shortFill) } },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ST0PInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ST0PInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ST0P = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
