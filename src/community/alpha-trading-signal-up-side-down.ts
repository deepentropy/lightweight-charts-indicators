/**
 * Alpha Trading Signal (Up side Down)
 *
 * A SuperTrend: up = src - multiplier * ATR, kept from falling while the previous close is above the previous up
 * line; dn = src + multiplier * ATR, kept from rising while the previous close is below the previous dn line. The
 * ATR is ta.atr (RMA of the true range) or an SMA of the true range. The trend turns up when the close goes above
 * the previous dn line and turns down when it goes below the previous up line. The up line is drawn in an up trend,
 * the dn line in a down trend, with circles and Buy / Sell labels where the trend turns. A fill between OHLC4 and
 * the trend line is green in an up trend, red in a down trend (white when the highlighter is off).
 * Alerts (alertcondition, `alerts` of the result): 'SuperTrend Buy' and 'SuperTrend Sell' on the bars where the trend
 * turns up / down, 'SuperTrend Direction Change' on both.
 *
 * Reference: "Alpha Trading Signal _ Up side Down" by giaodichdsmart
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AlphaTradingSignalUpSideDownInputs {
  /** ATR period */
  periods: number;
  /** Source of the up / dn lines */
  src: SourceType;
  /** ATR multiplier */
  multiplier: number;
  /** true: ta.atr (RMA of the true range); false: SMA of the true range */
  changeATR: boolean;
  /** Show the Buy / Sell labels */
  showSignals: boolean;
  /** Trend colours in the fills (white when off) */
  highlighting: boolean;
}

export const defaultInputs: AlphaTradingSignalUpSideDownInputs = {
  periods: 10,
  src: 'hl2',
  multiplier: 3.0,
  changeATR: true,
  showSignals: true,
  highlighting: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'periods', type: 'int', title: 'ATR Period', defval: 10 },
  { id: 'src', type: 'source', title: 'Source', defval: 'hl2' },
  { id: 'multiplier', type: 'float', title: 'ATR Multiplier', defval: 3.0, step: 0.1 },
  { id: 'changeATR', type: 'bool', title: 'Change ATR Calculation Method ?', defval: true },
  { id: 'showSignals', type: 'bool', title: 'Show Buy/Sell Signals ?', defval: true },
  { id: 'highlighting', type: 'bool', title: 'Highlighter On/Off ?', defval: true },
];

const GREEN = String(color.new(color.green, 0));
const RED = String(color.new(color.red, 0));
const WHITE = String(color.new(color.white, 0));
/** Pine default plot colour (the OHLC4 plot has no colour) */
const PINE_BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: GREEN, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Down Trend', color: RED, lineWidth: 2, style: 'linebr' },
  { id: 'plot2', title: 'OHLC4', color: PINE_BLUE, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'buy sell',
  shortTitle: 'buy sell',
  overlay: true,
  format: 'price',
  precision: 2,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface AlphaRun extends BarRunState<{ trend: number }> {
  atr: { step(high: number, low: number, close: number): number; commit(): void };
  up: number[];
  dn: number[];
  trendArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  upColors: string[];
  dnColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AlphaTradingSignalUpSideDownInputs>): BarStudy<AlphaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // atr2 = ta.sma(ta.tr, Periods); atr = changeATR ? ta.atr(Periods) : atr2
      let atr: AlphaRun['atr'];
      if (cfg.changeATR) {
        atr = taStep.atr(cfg.periods);
      } else {
        const tr = taStep.tr();
        const sma = new WindowSma(cfg.periods);
        atr = { step: (h, l, c) => sma.step(tr.step(h, l, c)), commit: () => { tr.commit(); sma.commit(); } };
      }
      const s: AlphaRun = {
        atr, up: [], dn: [], trendArr: [], plot0: [], plot1: [], plot2: [], upColors: [], dnColors: [], markers: [],
        flags: [[], [], []], times: [[], [], []],
        steps: [atr], vars: { trend: 1 }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.up, s.dn, s.trendArr, s.plot0, s.plot1, s.plot2, s.upColors, s.dnColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { up, dn, trendArr } = s;
      const src = value(b) ?? NaN;
      const atr = s.atr.step(b.high, b.low, b.close) ?? NaN;
      const c1 = i > 0 ? bars[i - 1].close : NaN;
      let u = src - cfg.multiplier * atr;
      const up1 = i > 0 && !isNaN(up[i - 1]) ? up[i - 1] : u; // nz(up[1], up)
      u = gt(c1, up1) ? Math.max(u, up1) : u;
      let d = src + cfg.multiplier * atr;
      const dn1 = i > 0 && !isNaN(dn[i - 1]) ? dn[i - 1] : d; // nz(dn[1], dn)
      d = lt(c1, dn1) ? Math.min(d, dn1) : d;
      up[i] = u;
      dn[i] = d;
      // trend := nz(trend[1], trend); trend := trend == -1 and close > dn1 ? 1 : trend == 1 and close < up1 ? -1 : trend
      const close = b.close;
      let trend = s.vars.trend;
      trend = trend === -1 && gt(close, dn1) ? 1 : trend === 1 && lt(close, up1) ? -1 : trend;
      s.vars.trend = trend;
      trendArr[i] = trend;

      const time = b.time;
      const prev = i > 0 ? trendArr[i - 1] : NaN;
      const buySignal = trend === 1 && prev === -1;
      const sellSignal = trend === -1 && prev === 1;
      // changeCond = trend != trend[1] (na on the first bar: false)
      const change = i > 0 && trend !== prev;
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      s.flags[2][i] = change;
      if (buySignal) s.times[0].push(time as number);
      if (sellSignal) s.times[1].push(time as number);
      if (change) s.times[2].push(time as number);
      if (buySignal && !isNaN(u)) {
        // plotshape(buySignal ? up : na, 'UpTrend Begins', location.absolute, shape.circle, size.tiny)
        s.markers.push({ time, position: 'atPriceMiddle', price: u, shape: 'circle', color: GREEN, size: 'tiny', id: 'shape0' });
        // plotshape(buySignal and showsignals ? up : na, 'Buy', text 'Buy', location.absolute, shape.labelup, size.tiny)
        if (cfg.showSignals) {
          s.markers.push({ time, position: 'atPriceBottom', price: u, shape: 'labelUp', color: GREEN,
            size: 'tiny', text: 'Buy', textColor: WHITE, id: 'shape1' });
        }
      }
      if (sellSignal && !isNaN(d)) {
        s.markers.push({ time, position: 'atPriceMiddle', price: d, shape: 'circle', color: RED, size: 'tiny', id: 'shape2' });
        if (cfg.showSignals) {
          s.markers.push({ time, position: 'atPriceTop', price: d, shape: 'labelDown', color: RED,
            size: 'tiny', text: 'Sell', textColor: WHITE, id: 'shape3' });
        }
      }

      s.plot0[i] = { time, value: trend === 1 ? u : NaN, color: GREEN };
      s.plot1[i] = { time, value: trend === 1 ? NaN : d, color: RED };
      s.plot2[i] = { time, value: (b.open + b.high + b.low + b.close) / 4, color: PINE_BLUE };
      // fill(mPlot, upPlot, color = highlighting ? trend == 1 ? color.green : color.white : color.white)
      s.upColors[i] = cfg.highlighting && trend === 1 ? GREEN : WHITE;
      // fill(mPlot, dnPlot, color = highlighting ? trend == -1 ? color.red : color.white : color.white)
      s.dnColors[i] = cfg.highlighting && trend === -1 ? RED : WHITE;
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: {
          title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay,
          format: metadata.format, precision: metadata.precision,
        },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [
          { plot1: 'plot2', plot2: 'plot0', options: { title: 'UpTrend Highligter' }, colors: s.upColors.slice() },
          { plot1: 'plot2', plot2: 'plot1', options: { title: 'DownTrend Highligter' }, colors: s.dnColors.slice() },
        ],
        markers: s.markers.slice(),
        // alertcondition(buySignal) / alertcondition(sellSignal) / alertcondition(changeCond)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AlphaTradingSignalUpSideDownInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AlphaTradingSignalUpSideDownInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'SuperTrend Buy', message: 'SuperTrend Buy!' },
  { id: 'alert1', title: 'SuperTrend Sell', message: 'SuperTrend Sell!' },
  { id: 'alert2', title: 'SuperTrend Direction Change', message: 'SuperTrend has changed direction!' },
];

export const AlphaTradingSignalUpSideDown = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
