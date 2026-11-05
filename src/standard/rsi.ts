/**
 * Relative Strength Index (RSI) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Momentum oscillator measuring the speed and magnitude of price changes.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, OutputDecl, OutputValues } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSIInputs {
  length: number;
  src: SourceType;
  calculateDivergence: boolean;
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: RSIInputs = {
  length: 14,
  src: 'close',
  calculateDivergence: false,
  maType: 'SMA',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'RSI Length', defval: 14, min: 1, group: 'RSI Settings' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'RSI Settings' },
  { id: 'calculateDivergence', type: 'bool', title: 'Calculate Divergence', defval: false, group: 'RSI Settings', tooltip: 'Calculating divergences is needed in order for divergence alerts to fire.', display: 'none' },
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], group: 'Smoothing', display: 'none' },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'none', active: { input: 'maType', ne: 'None' } },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, group: 'Smoothing', tooltip: 'Only applies when \'SMA + Bollinger Bands\' is selected. Determines the distance between the SMA and the bands.', display: 'none', step: 0.5, active: { input: 'maType', eq: 'SMA + Bollinger Bands' } },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 1 },
  { id: 'plot1', title: 'RSI-based MA', color: '#E2CC00', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#089981', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#089981', lineWidth: 1 },
  { id: 'plot6', title: 'Plot', color: 'transparent', lineWidth: 0, display: 'none' },
  { id: 'plot4', title: 'Regular Bullish', color: '#4CAF50', lineWidth: 2, display: 'pane' },
  { id: 'plot5', title: 'Regular Bearish', color: '#FF5252', lineWidth: 2, display: 'pane' },
];

/** Reference outputs: RSI, the mid line (plot(50), "Plot"), the MA, the bands, then each divergence line followed by
 *  its label. */
export const outputs: OutputDecl[] = [
  { kind: 'plot', id: 'plot0' },
  { kind: 'plot', id: 'plot6' },
  { kind: 'plot', id: 'plot1' },
  { kind: 'plot', id: 'plot2' },
  { kind: 'plot', id: 'plot3' },
  { kind: 'plot', id: 'plot4' },
  { kind: 'shape', id: 'bullLabel', title: 'Regular Bullish Label' },
  { kind: 'plot', id: 'plot5' },
  { kind: 'shape', id: 'bearLabel', title: 'Regular Bearish Label' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 70, color: '#787B86', linestyle: 'solid', title: 'RSI Upper Band' },
  { id: 'hline_mid',   price: 50, color: '#787B8680', linestyle: 'solid', title: 'RSI Middle Band' },
  { id: 'hline_lower', price: 30, color: '#787B86', linestyle: 'solid', title: 'RSI Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#7E57C219' },
];

export const metadata = {
  title: 'Relative Strength Index',
  shortTitle: 'RSI',
  overlay: false,
};

/** Reference alertconditions (bullCond / bearCond: false while "Calculate Divergence" is off) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Regular Bullish Divergence', message: 'Found a new Regular Bullish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar.' },
  { id: 'alert1', title: 'Regular Bearish Divergence', message: 'Found a new Regular Bearish Divergence, `Pivot Lookback Right` number of bars to the left of the current bar.' },
];

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers?: MarkerData[]; outputValues: OutputValues; alerts: AlertConditionState[] };

interface RsiVars {
  /** ta.valuewhen(plFound, rsiLBR / low[lbR], 1): the last two values (older first) */
  plRsi: readonly number[];
  phRsi: readonly number[];
  plLow: readonly number[];
  phHigh: readonly number[];
  /** Calls of the ta.barssince in _inRange (Pine v6 `and` is lazy) */
  plCalls: number;
  phCalls: number;
}

interface RsiRun extends BarRunState<RsiVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  ma: { step(v: number, volume: number): number; commit(): void } | null;
  dev: ReturnType<typeof taStep.stdev> | null;
  pl: PivotStep;
  ph: PivotStep;
  rsiArr: number[];
  plFound: boolean[];
  phFound: boolean[];
  plotData: Point[];
  maData: Point[];
  bbUpperData: Point[];
  bbLowerData: Point[];
  midlineData: Point[];
  bullLine: Point[];
  bearLine: Point[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  bullLabel: { time: number; value: number }[];
  bearLabel: { time: number; value: number }[];
}

/** ta.valuewhen(cond, source, 1) history: the value added on a bar where the condition is true */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (null before two values) */
const second = (h: readonly number[]): number | null => (h.length === 2 ? h[0]! : null);

function study(inputs: Partial<RSIInputs>): BarStudy<RsiRun, Result> {
  const { length, src, calculateDivergence, maType, maLength, bbMult } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';
  const lookbackLeft = 5;
  const lookbackRight = 5;
  const rangeLower = 5;
  const rangeUpper = 60;
  const maStep = (): RsiRun['ma'] => {
    switch (maType) {
      case 'None': return null;
      case 'EMA': { const m = taStep.ema(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMMA (RMA)': { const m = taStep.rma(maLength); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, maLength), commit: () => m.commit() }; }
      case 'VWMA': { const m = taStep.vwma(maLength); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      default: { const m = taStep.sma(); return { step: (v) => m.step(v, maLength), commit: () => m.commit() }; }
    }
  };
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(length);
      const ma = maStep();
      const dev = isBB ? taStep.stdev() : null;
      const pl = new PivotStep(lookbackLeft, lookbackRight, false);
      const ph = new PivotStep(lookbackLeft, lookbackRight, true);
      const s: RsiRun = {
        rsi, ma, dev, pl, ph, rsiArr: [], plFound: [], phFound: [], plotData: [], maData: [], bbUpperData: [],
        bbLowerData: [], midlineData: [], bullLine: [], bearLine: [], flags: [[], []], times: [[], []], markers: [],
        bullLabel: [], bearLabel: [],
        steps: [rsi, ...(ma ? [ma] : []), ...(dev ? [dev] : []), ...(calculateDivergence ? [pl, ph] : [])],
        vars: { plRsi: [], phRsi: [], plLow: [], phHigh: [], plCalls: NaN, phCalls: NaN },
        lists: [], series: [],
      };
      s.lists = [...s.times, s.markers, s.bullLabel, s.bearLabel];
      s.series = [
        s.rsiArr, s.plFound, s.phFound, s.plotData, s.maData, s.bbUpperData, s.bbLowerData, s.midlineData, s.bullLine,
        s.bearLine, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const r = s.rsi.step(value(b));
      s.rsiArr[i] = r;
      s.plotData[i] = { time, value: r };
      s.midlineData[i] = { time, value: 50 };
      // Smoothing MA of the RSI (and the bands of its stdev)
      const ma = s.ma ? s.ma.step(r, b.volume ?? 0) : NaN;
      s.maData[i] = { time, value: ma };
      const sd = s.dev ? s.dev.step(r, maLength) : NaN;
      s.bbUpperData[i] = { time, value: isBB ? ma + sd * bbMult : NaN };
      s.bbLowerData[i] = { time, value: isBB ? ma - sd * bbMult : NaN };

      // Divergence detection: the lines are plotted lookbackRight bars back (offset = -lookbackRight); bar i sets
      // its own point to na and the point of bar i - lookbackRight, so a new price of the forming bar writes both again
      s.bullLine[i] = { time, value: NaN };
      s.bearLine[i] = { time, value: NaN };
      let bull = false;
      let bear = false;
      if (calculateDivergence) {
        // plFound = not na(ta.pivotlow(rsi, lookbackLeft, lookbackRight)), lookbackRight bars after the pivot bar
        s.plFound[i] = !Number.isNaN(s.pl.step(i, r));
        s.phFound[i] = !Number.isNaN(s.ph.step(i, r));
        if (i >= lookbackRight) {
          const v = s.vars;
          const back = bars[i - lookbackRight];
          const rv = s.rsiArr[i - lookbackRight];
          const rsiVal: number | null = rv ?? null;
          const lowLBR = back.low;
          const highLBR = back.high;
          const plFound = s.plFound[i];
          const phFound = s.phFound[i];
          // ta.valuewhen(plFound, x, 1) includes the current bar
          if (plFound) {
            v.plRsi = pushed(v.plRsi, rsiVal as number);
            v.plLow = pushed(v.plLow, lowLBR);
          }
          if (phFound) {
            v.phRsi = pushed(v.phRsi, rsiVal as number);
            v.phHigh = pushed(v.phHigh, highLBR);
          }
          // Regular Bullish: RSI higher low + price lower low at pivot low
          const prevRsiL = second(v.plRsi);
          let rsiHL = false;
          if (rsiVal != null && prevRsiL != null && rsiVal > prevRsiL) {
            if (s.plFound[i - 1]) v.plCalls = 0;
            else if (!isNaN(v.plCalls)) v.plCalls++;
            rsiHL = v.plCalls >= rangeLower && v.plCalls <= rangeUpper;
          }
          const prevLow = second(v.plLow);
          bull = plFound && rsiHL && prevLow != null && lowLBR < prevLow;
          if (plFound && rsiVal != null) s.bullLine[i - lookbackRight] = { time: back.time, value: rsiVal, color: bull ? '#4CAF50' : 'transparent' };
          else s.bullLine[i - lookbackRight] = { time: back.time, value: NaN };
          if (bull && rsiVal != null) s.bullLabel.push({ time: time as number, value: rsiVal });

          // Regular Bearish: RSI lower high + price higher high at pivot high
          const prevRsiH = second(v.phRsi);
          let rsiLH = false;
          if (rsiVal != null && prevRsiH != null && rsiVal < prevRsiH) {
            if (s.phFound[i - 1]) v.phCalls = 0;
            else if (!isNaN(v.phCalls)) v.phCalls++;
            rsiLH = v.phCalls >= rangeLower && v.phCalls <= rangeUpper;
          }
          const prevHigh = second(v.phHigh);
          bear = phFound && rsiLH && prevHigh != null && highLBR > prevHigh;
          if (phFound && rsiVal != null) s.bearLine[i - lookbackRight] = { time: back.time, value: rsiVal, color: bear ? '#FF5252' : 'transparent' };
          else s.bearLine[i - lookbackRight] = { time: back.time, value: NaN };
          if (bear && rsiVal != null) s.bearLabel.push({ time: time as number, value: rsiVal });

          // Pine: plotshape(bullCond ? rsiLBR : na, offset = -lookbackRight, text = " Bull ", shape.labelup,
          //   location.absolute, color = bullColor, textcolor = textColor (white)), and the bearish one
          if (bull) {
            s.markers.push({ time: back.time, position: 'atPriceBottom', price: rsiVal!, shape: 'labelUp', color: '#4CAF50', text: ' Bull ', textColor: '#FFFFFF', id: 'bullLabel' });
          }
          if (bear) {
            s.markers.push({ time: back.time, position: 'atPriceTop', price: rsiVal!, shape: 'labelDown', color: '#FF5252', text: ' Bear ', textColor: '#FFFFFF', id: 'bearLabel' });
          }
        }
      }
      [bull, bear].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time as number);
      });
    },
    copyVars: (v) => ({ ...v }),
    result(s, bars) {
      const n = bars.length;
      const constant = <T>(v: T): T[] => new Array(n).fill(v);
      // Pine: midLinePlot = plot(50, display = display.none)
      //   fill(rsiPlot, midLinePlot, 100, 70, top_color = color.new(color.green, 0), bottom_color = color.new(color.green, 100))
      //   fill(rsiPlot, midLinePlot, 30, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
      const fills: FillData[] = [
        {
          plot1: 'plot0', plot2: 'plot6', options: { title: 'Overbought Gradient Fill' },
          gradient: { topValue: constant(100), bottomValue: constant(70), topColor: constant('#4CAF50'), bottomColor: constant('#4CAF5000') },
        },
        {
          plot1: 'plot0', plot2: 'plot6', options: { title: 'Oversold Gradient Fill' },
          gradient: { topValue: constant(30), bottomValue: constant(0), topColor: constant('#F2364500'), bottomColor: constant('#F23645') },
        },
      ];
      if (enableMA && isBB) fills.push({ plot1: 'plot2', plot2: 'plot3', options: { color: '#089981', transp: 90, title: 'BB Background' } });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.plotData.slice(),
          'plot1': s.maData.slice(),
          'plot2': s.bbUpperData.slice(),
          'plot3': s.bbLowerData.slice(),
          'plot6': s.midlineData.slice(),
          'plot4': s.bullLine.slice(),
          'plot5': s.bearLine.slice(),
        },
        fills,
        markers: s.markers.length > 0 ? s.markers.slice() : undefined,
        outputValues: { bullLabel: s.bullLabel.slice(), bearLabel: s.bearLabel.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSIInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSIInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}


export const RSI = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig, outputs, alertConditions };
