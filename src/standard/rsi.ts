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
  { id: 'length', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'calculateDivergence', type: 'bool', title: 'Calculate Divergence', defval: false },
  { id: 'maType', type: 'string', title: 'Smoothing Type', defval: 'SMA', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Smoothing Length', defval: 14, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: '#7E57C2', lineWidth: 1 },
  { id: 'plot1', title: 'RSI-based MA', color: '#E2CC00', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#089981', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#089981', lineWidth: 1 },
  { id: 'plot4', title: 'RSI OB', color: '#4CAF50', lineWidth: 0, display: 'none' },
  { id: 'plot5', title: 'RSI OS', color: '#FF5252', lineWidth: 0, display: 'none' },
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

export function calculate(bars: Bar[], inputs: Partial<RSIInputs> = {}): IndicatorResult & { markers?: MarkerData[] } {
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

  // Gradient fill zones: split RSI into OB (>70) and OS (<30) segments
  const obData = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v != null && v > 70) ? v : NaN,
  }));
  const osData = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v != null && v < 30) ? v : NaN,
  }));
  const midlineData = bars.map(b => ({ time: b.time, value: 50 }));

  fills.push(
    { plot1: 'plot4', plot2: 'plot6', options: { color: '#4CAF50', transp: 90, title: 'Overbought Gradient Fill' } },
    { plot1: 'plot5', plot2: 'plot6', options: { color: '#FF5252', transp: 90, title: 'Oversold Gradient Fill' } },
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

    // Build barssince arrays for pivot conditions
    const plFound: boolean[] = plArr.map(v => v != null);
    const phFound: boolean[] = phArr.map(v => v != null);

    // Helper: bars since last condition was true
    function barsSince(cond: boolean[]): number[] {
      const result: number[] = [];
      let count = NaN;
      for (let i = 0; i < cond.length; i++) {
        if (cond[i]) count = 0;
        else if (!isNaN(count)) count++;
        result.push(count);
      }
      return result;
    }

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

    const plBarsSince = barsSince(plFound);
    const phBarsSince = barsSince(phFound);

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

    for (let i = lookbackRight; i < bars.length; i++) {
      const rsiVal = rsiLBR[i];
      if (rsiVal == null) continue;

      // Regular Bullish: RSI higher low + price lower low at pivot low
      if (plFound[i]) {
        const prevPlBars = i > 0 ? plBarsSince[i - 1] : NaN;
        const inRange = !isNaN(prevPlBars) && prevPlBars >= rangeLower && prevPlBars <= rangeUpper;
        const prevRsi = plRsiVW[i];
        const rsiHL = prevRsi != null && rsiVal > prevRsi && inRange;
        const prevLow = plLowVW[i];
        const priceLL = prevLow != null && lowLBR[i] < prevLow;

        if (rsiHL && priceLL) {
          markers.push({
            time: bars[i - lookbackRight].time,
            position: 'belowBar',
            shape: 'labelUp',
            color: '#4CAF50',
            text: 'Bull',
          });
        }
      }

      // Regular Bearish: RSI lower high + price higher high at pivot high
      if (phFound[i]) {
        const prevPhBars = i > 0 ? phBarsSince[i - 1] : NaN;
        const inRange = !isNaN(prevPhBars) && prevPhBars >= rangeLower && prevPhBars <= rangeUpper;
        const prevRsi = phRsiVW[i];
        const rsiLH = prevRsi != null && rsiVal < prevRsi && inRange;
        const prevHigh = phHighVW[i];
        const priceHH = prevHigh != null && highLBR[i] > prevHigh;

        if (rsiLH && priceHH) {
          markers.push({
            time: bars[i - lookbackRight].time,
            position: 'aboveBar',
            shape: 'labelDown',
            color: '#FF5252',
            text: 'Bear',
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
      'plot4': obData,
      'plot5': osData,
      'plot6': midlineData,
    },
    fills,
    markers: markers.length > 0 ? markers : undefined,
  };
}

export const RSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
