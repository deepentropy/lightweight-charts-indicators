/**
 * Relative Strength Index (RSI) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Momentum oscillator measuring the speed and magnitude of price changes.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

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
  { id: 'plot6', title: 'Middle Line', color: 'transparent', lineWidth: 0, display: 'none' },
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

export function calculate(bars: Bar[], inputs: Partial<RSIInputs> = {}): Omit<IndicatorResult, 'markers'> & { markers?: MarkerData[] } {
  const { length, src, calculateDivergence, maType, maLength, bbMult } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, length);
  const rsiArr = rsi.toArray();

  const plotData = rsiArr.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  // Smoothing MA
  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';
  let maData = bars.map(b => ({ time: b.time, value: NaN }));
  let bbUpperData = bars.map(b => ({ time: b.time, value: NaN }));
  let bbLowerData = bars.map(b => ({ time: b.time, value: NaN }));
  const fills: FillData[] = [];

  if (enableMA) {
    let maSeries: Series;
    switch (maType) {
      case 'EMA': maSeries = ta.ema(rsi, maLength); break;
      case 'SMMA (RMA)': maSeries = ta.rma(rsi, maLength); break;
      case 'WMA': maSeries = ta.wma(rsi, maLength); break;
      case 'VWMA': maSeries = ta.vwma(rsi, maLength, new Series(bars, b => b.volume ?? 0)); break;
      default: maSeries = ta.sma(rsi, maLength); break;
    }
    const maArr = maSeries.toArray();
    maData = maArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

    if (isBB) {
      const stdevArr = ta.stdev(rsi, maLength).toArray();
      bbUpperData = maArr.map((v, i) => ({ time: bars[i].time, value: (v != null && stdevArr[i] != null) ? v + stdevArr[i]! * bbMult : NaN }));
      bbLowerData = maArr.map((v, i) => ({ time: bars[i].time, value: (v != null && stdevArr[i] != null) ? v - stdevArr[i]! * bbMult : NaN }));
      fills.push({ plot1: 'plot2', plot2: 'plot3', options: { color: '#089981', transp: 90, title: 'BB Background' } });
    }
  }

  // Pine: midLinePlot = plot(50, display = display.none)
  //   fill(rsiPlot, midLinePlot, 100, 70, top_color = color.new(color.green, 0), bottom_color = color.new(color.green, 100))
  //   fill(rsiPlot, midLinePlot, 30, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
  const midlineData = bars.map(b => ({ time: b.time, value: 50 }));
  const n = bars.length;
  const constant = <T>(v: T): T[] => new Array(n).fill(v);
  fills.unshift(
    {
      plot1: 'plot0', plot2: 'plot6', options: { title: 'Overbought Gradient Fill' },
      gradient: { topValue: constant(100), bottomValue: constant(70), topColor: constant('#4CAF50'), bottomColor: constant('#4CAF5000') },
    },
    {
      plot1: 'plot0', plot2: 'plot6', options: { title: 'Oversold Gradient Fill' },
      gradient: { topValue: constant(30), bottomValue: constant(0), topColor: constant('#F2364500'), bottomColor: constant('#F23645') },
    },
  );

  // Divergence detection
  const markers: MarkerData[] = [];

  if (calculateDivergence) {
    const lookbackLeft = 5;
    const lookbackRight = 5;
    const rangeLower = 5;
    const rangeUpper = 60;

    // Find pivot lows and highs in RSI
    const plArr = ta.pivotlow(rsi, lookbackLeft, lookbackRight).toArray();
    const phArr = ta.pivothigh(rsi, lookbackLeft, lookbackRight).toArray();

    // Pivot conditions
    // Pine: plFound = not na(ta.pivotlow(...)), true `lookbackRight` bars after the pivot bar
    const plFound: boolean[] = plArr.map(v => v != null && !isNaN(v));
    const phFound: boolean[] = phArr.map(v => v != null && !isNaN(v));

    // Helper: value of source when condition was true, nth occurrence back
    function valueWhen(cond: boolean[], source: number[], occurrence: number): (number | null)[] {
      const result: (number | null)[] = [];
      const history: number[] = [];
      for (let i = 0; i < cond.length; i++) {
        if (cond[i]) history.push(source[i]);
        const idx = history.length - 1 - occurrence;
        result.push(idx >= 0 ? history[idx] : null);
      }
      return result;
    }

    // RSI values shifted by lookbackRight
    const rsiLBR: (number | null)[] = rsiArr.map((_, i) =>
      i >= lookbackRight ? rsiArr[i - lookbackRight] ?? null : null
    );
    const lowLBR: number[] = bars.map((_, i) =>
      i >= lookbackRight ? bars[i - lookbackRight].low : NaN
    );
    const highLBR: number[] = bars.map((_, i) =>
      i >= lookbackRight ? bars[i - lookbackRight].high : NaN
    );

    // Use rsiLBR for valuewhen (value at lookbackRight bars ago when pivot found)
    const plRsiVW = valueWhen(plFound, rsiLBR as number[], 1);
    const phRsiVW = valueWhen(phFound, rsiLBR as number[], 1);
    const plLowVW = valueWhen(plFound, lowLBR, 1);
    const phHighVW = valueWhen(phFound, highLBR, 1);

    // Pine v6 `and` is lazy: in `rsiHL = rsiLBR > ta.valuewhen(...) and _inRange(plFound[1])` the ta.barssince
    // inside _inRange only runs on bars where the left side is true, so it counts those calls, not bars.
    let plCalls = NaN;
    let phCalls = NaN;

    for (let i = lookbackRight; i < bars.length; i++) {
      const rsiVal = rsiLBR[i];

      // Regular Bullish: RSI higher low + price lower low at pivot low
      const prevRsiL = plRsiVW[i];
      let rsiHL = false;
      if (rsiVal != null && prevRsiL != null && rsiVal > prevRsiL) {
        if (plFound[i - 1]) plCalls = 0;
        else if (!isNaN(plCalls)) plCalls++;
        rsiHL = plCalls >= rangeLower && plCalls <= rangeUpper;
      }
      if (plFound[i] && rsiHL) {
        const prevLow = plLowVW[i];
        const priceLL = prevLow != null && lowLBR[i] < prevLow;

        if (priceLL) {
          // Pine: plotshape(bullCond ? rsiLBR : na, offset = -lookbackRight, text = " Bull ", shape.labelup,
          //   location.absolute, color = bullColor, textcolor = textColor (white))
          markers.push({
            time: bars[i - lookbackRight].time,
            position: 'atPriceBottom',
            price: rsiVal!,
            shape: 'labelUp',
            color: '#4CAF50',
            text: ' Bull ',
            textColor: '#FFFFFF',
          });
        }
      }

      // Regular Bearish: RSI lower high + price higher high at pivot high
      const prevRsiH = phRsiVW[i];
      let rsiLH = false;
      if (rsiVal != null && prevRsiH != null && rsiVal < prevRsiH) {
        if (phFound[i - 1]) phCalls = 0;
        else if (!isNaN(phCalls)) phCalls++;
        rsiLH = phCalls >= rangeLower && phCalls <= rangeUpper;
      }
      if (phFound[i] && rsiLH) {
        const prevHigh = phHighVW[i];
        const priceHH = prevHigh != null && highLBR[i] > prevHigh;

        if (priceHH) {
          // Pine: plotshape(bearCond ? rsiLBR : na, ..., text = " Bear ", shape.labeldown, location.absolute)
          markers.push({
            time: bars[i - lookbackRight].time,
            position: 'atPriceTop',
            price: rsiVal!,
            shape: 'labelDown',
            color: '#FF5252',
            text: ' Bear ',
            textColor: '#FFFFFF',
          });
        }
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': plotData,
      'plot1': maData,
      'plot2': bbUpperData,
      'plot3': bbLowerData,
      'plot6': midlineData,
    },
    fills,
    markers: markers.length > 0 ? markers : undefined,
  };
}

export const RSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
