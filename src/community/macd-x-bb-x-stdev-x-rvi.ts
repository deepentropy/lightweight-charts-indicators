/**
 * [Venturose] MACD x BB x STDEV x RVI
 *
 * MACD line (fast EMA - slow EMA) with Bollinger-style bands: the EMA of the MACD (midline) plus / minus the
 * standard deviation of the MACD times a factor, and a long EMA of the MACD (trend). The MACD line is green above the
 * upper band, red below the lower band and, inside the bands, green when rising and red when falling ("Inside"
 * trigger); with the "Flipped" trigger it is red below the upper band, green above the lower band, else neutral.
 * Buy / sell signals are the first bar of a green / red line (optionally only at or below / at or above the
 * midline). A Relative Volatility Index (EMA of the standard deviation of the close on up / down bars) above / below
 * its thresholds gives sell / buy hint flags.
 * Alerts (alertcondition, `alerts` of the result): 'Buy & Sell', 'Buy' and 'Sell', true on the bars of the buy / sell
 * signals (whether or not they are plotted).
 *
 * Reference: "[Venturose] MACD x BB x STDEV x RVI" by Vaquant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Vaquant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MacdXBbXStdevXRviInputs {
  fastEmaPeriod: number;
  slowEmaPeriod: number;
  /** EMA / stdev period of the MACD (midline and bands) */
  avgPeriod: number;
  /** EMA period of the MACD trend line */
  smoothedAvgPeriod: number;
  stdevFactor: number;
  /** RVI standard deviation length */
  rviLength: number;
  /** RVI offset (an input of the Pine source that is not used) */
  rviOffset: number;
  /** RVI EMA length */
  rviMaLength: number;
  rviUpperThreshold: number;
  rviLowerThreshold: number;
  bearishColor: string;
  bullishColor: string;
  neutralLineColor: string;
  neutralColor: string;
  neutralFillColor: string;
  avgColor: string;
  smoothedAvgColor: string;
  plotBuyHints: boolean;
  plotSellHints: boolean;
  plotBuySignals: boolean;
  plotSellSignals: boolean;
  /** Trigger: 'Inside' or 'Flipped' */
  triggerAt: 'Inside' | 'Flipped';
  enableSignalFilter: boolean;
}

export const defaultInputs: MacdXBbXStdevXRviInputs = {
  fastEmaPeriod: 12,
  slowEmaPeriod: 26,
  avgPeriod: 9,
  smoothedAvgPeriod: 100,
  stdevFactor: 0.89,
  rviLength: 10,
  rviOffset: 0,
  rviMaLength: 14,
  rviUpperThreshold: 81,
  rviLowerThreshold: 19,
  bearishColor: color.red,
  bullishColor: color.green,
  neutralLineColor: color.white,
  // input.color(color.new(color.gray, 60)) / input.color(color.new(color.gray, 90)): input alpha 0.4 / 0.1
  neutralColor: 'rgba(120, 123, 134, 0.4)',
  neutralFillColor: 'rgba(120, 123, 134, 0.1)',
  avgColor: color.black,
  smoothedAvgColor: color.blue,
  plotBuyHints: false,
  plotSellHints: true,
  plotBuySignals: true,
  plotSellSignals: false,
  triggerAt: 'Inside',
  enableSignalFilter: true,
};

const G_VALUES = 'MACD / BB / STDEV';
const G_RVI = 'Relative Volatility Index';
const G_COLORS = 'Colors';
const G_DISPLAY = 'Display';
const G_LOGIC = 'Logic';

export const inputConfig: InputConfig[] = [
  { id: 'fastEmaPeriod', type: 'int', title: 'Fast Moving Average Period', defval: 12, group: G_VALUES },
  { id: 'slowEmaPeriod', type: 'int', title: 'Slow Moving Average Period', defval: 26, group: G_VALUES },
  { id: 'avgPeriod', type: 'int', title: 'Average Period', defval: 9, group: G_VALUES },
  { id: 'smoothedAvgPeriod', type: 'int', title: 'Smoothed Average Period', defval: 100, group: G_VALUES },
  { id: 'stdevFactor', type: 'float', title: 'Standard Deviation Multiplier', defval: 0.89, group: G_VALUES },
  { id: 'rviLength', type: 'int', title: 'Length', defval: 10, min: 1, group: G_RVI },
  { id: 'rviOffset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500, group: G_RVI },
  { id: 'rviMaLength', type: 'int', title: 'MA Length', defval: 14, min: 1, group: G_VALUES },
  { id: 'rviUpperThreshold', type: 'int', title: 'Upper Threshold', defval: 81, min: 50, max: 100 },
  { id: 'rviLowerThreshold', type: 'int', title: 'Lower Threshold', defval: 19, min: 0, max: 50 },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: color.red, group: G_COLORS },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: color.green, group: G_COLORS },
  { id: 'neutralLineColor', type: 'color', title: 'Neutral Line Color', defval: color.white, group: G_COLORS },
  { id: 'neutralColor', type: 'color', title: 'Neutral Bands Color', defval: 'rgba(120, 123, 134, 0.4)', group: G_COLORS },
  { id: 'neutralFillColor', type: 'color', title: 'Neutral Fill Color', defval: 'rgba(120, 123, 134, 0.1)', group: G_COLORS },
  { id: 'avgColor', type: 'color', title: 'Midline Color', defval: color.black, group: G_COLORS },
  { id: 'smoothedAvgColor', type: 'color', title: 'Smoothed Midline Color', defval: color.blue, group: G_COLORS },
  { id: 'plotBuyHints', type: 'bool', title: 'Plot Buy Hints', defval: false, group: G_DISPLAY,
    tooltip: 'Hint when it could be interesting to buy, instead of waiting for an "official" signal.' },
  { id: 'plotSellHints', type: 'bool', title: 'Plot Sell Hints', defval: true, group: G_DISPLAY,
    tooltip: 'Hint when it could be interesting to sell, instead of waiting for an "official" signal.' },
  { id: 'plotBuySignals', type: 'bool', title: 'Plot Buy Signals', defval: true, group: G_DISPLAY },
  { id: 'plotSellSignals', type: 'bool', title: 'Plot Sell Signals', defval: false, group: G_DISPLAY },
  { id: 'triggerAt', type: 'string', title: 'Trigger', defval: 'Inside', options: ['Inside', 'Flipped'], group: G_LOGIC },
  { id: 'enableSignalFilter', type: 'bool', title: 'Enable Signal Filter', defval: true, group: G_LOGIC },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'BB + MACD', color: color.white, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: 'rgba(120, 123, 134, 0.4)', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: 'rgba(120, 123, 134, 0.4)', lineWidth: 1 },
  { id: 'plot3', title: 'Midline', color: color.black, lineWidth: 1 },
  { id: 'plot4', title: 'Trend', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: '[Venturose] MACD x BB x STDEV x RVI',
  shortTitle: '[Venturose] MACD,BB,STDEV,RVI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

/** Colour key for Pine colour == / != (same RGBA) */
const colorKey = (c: string): string => {
  const s = String(c).trim().toLowerCase();
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s);
  if (m) return `#${m[1]}${m[2] ?? 'ff'}`;
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(s);
  if (m) {
    const h = (x: number) => Math.round(x).toString(16).padStart(2, '0');
    const a = m[4] === undefined ? 255 : Math.floor(Number(m[4]) * 255 + 0.5);
    return `#${h(+m[1])}${h(+m[2])}${h(+m[3])}${h(a)}`;
  }
  return s;
};

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface VenturoseRun extends BarRunState<Record<string, never>> {
  fastEma: ReturnType<typeof taStep.ema>;
  slowEma: ReturnType<typeof taStep.ema>;
  avg: ReturnType<typeof taStep.ema>;
  stdev: ReturnType<typeof taStep.stdev>;
  smoothedAvg: ReturnType<typeof taStep.ema>;
  rviStdev: ReturnType<typeof taStep.stdev>;
  upper: ReturnType<typeof taStep.ema>;
  lower: ReturnType<typeof taStep.ema>;
  macd: number[];
  keys: string[];
  plots: Point[][];
  bearFills: string[];
  bullFills: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MacdXBbXStdevXRviInputs>): BarStudy<VenturoseRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bull = cfg.bullishColor;
  const bear = cfg.bearishColor;
  const bullKey = colorKey(bull);
  const bearKey = colorKey(bear);
  const inside = cfg.triggerAt === 'Inside';
  const bearFill = String(color.new(bear, 90 / 1.5));
  const bullFill = String(color.new(bull, 90 / 1.5));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: VenturoseRun = {
        fastEma: taStep.ema(cfg.fastEmaPeriod), slowEma: taStep.ema(cfg.slowEmaPeriod), avg: taStep.ema(cfg.avgPeriod),
        stdev: taStep.stdev(), smoothedAvg: taStep.ema(cfg.smoothedAvgPeriod), rviStdev: taStep.stdev(),
        upper: taStep.ema(cfg.rviMaLength), lower: taStep.ema(cfg.rviMaLength), macd: [], keys: [],
        plots: [[], [], [], [], []], bearFills: [], bullFills: [], markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.fastEma, s.slowEma, s.avg, s.stdev, s.smoothedAvg, s.rviStdev, s.upper, s.lower];
      s.lists = [s.markers, ...s.times];
      s.series = [s.macd, s.keys, ...s.plots, s.bearFills, s.bullFills, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const close = b.close;

      // MACD and its bands
      const m = s.fastEma.step(close) - s.slowEma.step(close);
      s.macd[i] = m;
      const avg = s.avg.step(m);
      const stdev = s.stdev.step(m, cfg.avgPeriod);
      const smoothedAvg = s.smoothedAvg.step(m);
      const upperBand = avg + cfg.stdevFactor * stdev;
      const lowerBand = avg - cfg.stdevFactor * stdev;

      // RVI: upper = ema(change(close) <= 0 ? 0 : stddev), lower = ema(change(close) > 0 ? 0 : stddev)
      const stddev = s.rviStdev.step(close, cfg.rviLength);
      const change = i > 0 ? close - bars[i - 1].close : NaN;
      const upper = s.upper.step(le(change, 0) ? 0 : stddev);
      const lower = s.lower.step(gt(change, 0) ? 0 : stddev);
      // rvi = upper + lower != 0 ? upper / (upper + lower) * 100 : 0 (na != 0 is false)
      const rvi = ne(upper + lower, 0) ? (upper / (upper + lower)) * 100 : 0;

      let c = cfg.neutralLineColor;
      if (inside) {
        if (gt(m, upperBand)) c = bull;
        else if (lt(m, lowerBand)) c = bear;
        else c = gt(m, i > 0 ? s.macd[i - 1] : NaN) ? bull : bear;
      } else {
        // bearish_trigger = lower_band, bullish_trigger = upper_band
        c = cfg.neutralLineColor;
        if (lt(m, lowerBand)) c = bear;
        if (gt(m, upperBand)) c = bull;
      }

      const key = colorKey(c);
      s.keys[i] = key;
      // plot_color[1] != x: false on bar 0 (na)
      const prevKey = i > 0 ? s.keys[i - 1] : null;
      const buySignal = key === bullKey && prevKey !== null && prevKey !== bullKey
        && (!cfg.enableSignalFilter || le(m, avg));
      const sellSignal = key === bearKey && prevKey !== null && prevKey !== bearKey
        && (!cfg.enableSignalFilter || ge(m, avg));
      // alertcondition(buy_signal or sell_signal, 'Buy & Sell') / (buy_signal, 'Buy') / (sell_signal, 'Sell')
      const flags = [buySignal || sellSignal, buySignal, sellSignal];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
      if (buySignal && cfg.plotBuySignals) {
        s.markers.push({ time: t, position: 'bottom', shape: 'triangleUp', color: bull, size: 'small' });
      }
      if (sellSignal && cfg.plotSellSignals) {
        s.markers.push({ time: t, position: 'top', shape: 'triangleDown', color: bear, size: 'small' });
      }
      if (gt(rvi, cfg.rviUpperThreshold) && cfg.plotSellHints) {
        s.markers.push({ time: t, position: 'top', shape: 'flag', color: bear, size: 'small' });
      }
      if (lt(rvi, cfg.rviLowerThreshold) && cfg.plotBuyHints) {
        s.markers.push({ time: t, position: 'bottom', shape: 'flag', color: bull, size: 'small' });
      }
      // bearish_color_plot = macd < lower_band ? color.new(bearish_color, 60) : na; bullish: macd > upper_band
      s.bearFills[i] = lt(m, lowerBand) ? bearFill : 'transparent';
      s.bullFills[i] = gt(m, upperBand) ? bullFill : 'transparent';

      const p = s.plots;
      p[0][i] = { time: t, value: fin(m), color: c };
      p[1][i] = { time: t, value: fin(upperBand), color: cfg.neutralColor };
      p[2][i] = { time: t, value: fin(lowerBand), color: cfg.neutralColor };
      p[3][i] = { time: t, value: fin(avg), color: cfg.avgColor };
      p[4][i] = { time: t, value: fin(smoothedAvg), color: cfg.smoothedAvgColor };
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        fills: [
          { plot1: 'plot1', plot2: 'plot2', colors: new Array<string>(n).fill(cfg.neutralFillColor) },
          { plot1: 'plot0', plot2: 'plot2', colors: s.bearFills.slice() },
          { plot1: 'plot0', plot2: 'plot1', colors: s.bullFills.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MacdXBbXStdevXRviInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MacdXBbXStdevXRviInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy & Sell', message: 'Price entered buy / sell area' },
  { id: 'alert1', title: 'Buy', message: 'Price entered buying area' },
  { id: 'alert2', title: 'Sell', message: 'Price entered selling area' },
];

export const MacdXBbXStdevXRvi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
