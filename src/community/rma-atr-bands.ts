/**
 * RMA ATR Bands
 *
 * An RMA trend line of the source (high by default) with an upper band RMA + ATR * upper multiplier and a lower band
 * RMA - ATR * lower multiplier. A close above the upper band sets the trend up, a close below the lower band sets it
 * down; the line, the bands, their fills and the bars take the trend colour, and LONG / SHORT triangles mark the bars
 * where the trend turns.
 * Alerts (alertcondition, `alerts` of the result): 'RMA ATR Bands Long' / 'RMA ATR Bands Short', true on the bars where
 * the trend turns up / down.
 *
 * Reference: "RMA ATR Bands" by SchizoQuant
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RMAATRBandsInputs {
  /** Source of the RMA trend line */
  maSrc: SourceType;
  /** RMA length */
  maLength: number;
  /** ATR length */
  atrLength: number;
  /** Upper band: RMA + ATR * upperMult */
  upperMult: number;
  /** Lower band: RMA - ATR * lowerMult */
  lowerMult: number;
  /** Show the ATR bands and their fills */
  showATRBands: boolean;
  /** Colour the bars with the trend colour */
  colorBars: boolean;
  /** Show the LONG / SHORT markers */
  showSignals: boolean;
}

export const defaultInputs: RMAATRBandsInputs = {
  maSrc: 'high',
  maLength: 14,
  atrLength: 13,
  upperMult: 0.4,
  lowerMult: 1.6,
  showATRBands: true,
  colorBars: true,
  showSignals: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'maSrc', type: 'source', title: 'Source', defval: 'high' },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 13, min: 1 },
  { id: 'upperMult', type: 'float', title: 'Upper ATR Multiplier', defval: 0.4, step: 0.1 },
  { id: 'lowerMult', type: 'float', title: 'Lower ATR Multiplier', defval: 1.6, step: 0.1 },
  { id: 'showATRBands', type: 'bool', title: 'Show ATR Bands', defval: true },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: true },
  { id: 'showSignals', type: 'bool', title: 'Show Signals', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'Upper ATR Band', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: 'Lower ATR Band', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'RMA ATR Bands',
  shortTitle: 'RMA ATR Bands',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface RmaAtrVars {
  /** var int trend = 0 */
  trend: number;
  /** trend[1] (na on the first bar) */
  prevTrend: number;
}

interface RmaAtrRun extends BarRunState<RmaAtrVars> {
  ma: ReturnType<typeof taStep.rma>;
  atr: ReturnType<typeof taStep.atr>;
  maPlot: Point[];
  upperPlot: Point[];
  lowerPlot: Point[];
  fillColors: string[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RMAATRBandsInputs>): BarStudy<RmaAtrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.maSrc);
  // longColor = color.rgb(57, 255, 20); shortColor = color.rgb(138, 43, 226)
  const longColor = '#39FF14';
  const shortColor = '#8A2BE2';
  return {
    fullRunReason: () => (isBarSource(cfg.maSrc) ? null : 'source of another study'),
    init() {
      // ma = ta.rma(maSrc, maLength); atr = ta.atr(atrLength)
      const ma = taStep.rma(cfg.maLength);
      const atr = taStep.atr(cfg.atrLength);
      const s: RmaAtrRun = {
        ma, atr, maPlot: [], upperPlot: [], lowerPlot: [], fillColors: [], markers: [], barColors: [],
        flags: [[], []], times: [[], []], steps: [ma, atr], vars: { trend: 0, prevTrend: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.maPlot, s.upperPlot, s.lowerPlot, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const t = b.time;
      const ma = s.ma.step(value(b));
      const atr = s.atr.step(b.high, b.low, b.close);
      const upperLine = ma + atr * cfg.upperMult;
      const lowerLine = ma - atr * cfg.lowerMult;

      // long = close > upperLine; short = close < lowerLine (na compares false)
      let trend = v.trend;
      if (gt(b.close, upperLine)) trend = 1;
      if (lt(b.close, lowerLine)) trend = -1;
      v.trend = trend;

      // longSignal = trend == 1 and trend[1] != 1 (trend[1] na on the first bar: na != 1 is false)
      const prevTrend = v.prevTrend;
      const longSignal = trend === 1 && !isNaN(prevTrend) && prevTrend !== 1;
      const shortSignal = trend === -1 && !isNaN(prevTrend) && prevTrend !== -1;
      v.prevTrend = trend;
      const flags = [longSignal, shortSignal];
      for (let k = 0; k < 2; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }

      const bandColor = trend === 1 ? longColor : trend === -1 ? shortColor : color.gray;
      s.maPlot[i] = { time: t, value: ma, color: bandColor };
      s.upperPlot[i] = { time: t, value: cfg.showATRBands ? upperLine : NaN, color: bandColor };
      s.lowerPlot[i] = { time: t, value: cfg.showATRBands ? lowerLine : NaN, color: bandColor };
      s.fillColors[i] = cfg.showATRBands ? String(color.new(bandColor, 88)) : 'transparent';

      // plotshape(showSignals and longSignal, triangleup, belowbar, longColor, size.small, "LONG", textcolor white)
      if (cfg.showSignals && longSignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: longColor, text: 'LONG',
          textColor: color.white, size: 'small' });
      }
      if (cfg.showSignals && shortSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: shortColor, text: 'SHORT',
          textColor: color.white, size: 'small' });
      }
      // barcolor(colorBars ? bandColor : na)
      if (cfg.colorBars) s.barColors.push({ time: t, color: bandColor });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.maPlot.slice(), plot1: s.upperPlot.slice(), plot2: s.lowerPlot.slice() },
        // fill(maPlot, upperPlot / lowerPlot, color = showATRBands ? color.new(bandColor, 88) : na)
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Upper Fill' }, colors: s.fillColors.slice() },
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Lower Fill' }, colors: s.fillColors.slice() },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(longSignal, "RMA ATR Bands Long") / alertcondition(shortSignal, "RMA ATR Bands Short")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RMAATRBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RMAATRBandsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'RMA ATR Bands Long', message: 'RMA ATR Bands Long Signal on {{ticker}}' },
  { id: 'alert1', title: 'RMA ATR Bands Short', message: 'RMA ATR Bands Short Signal on {{ticker}}' },
];

export const RMAATRBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
