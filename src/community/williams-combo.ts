/**
 * Bill Williams Alligator + Fractals
 *
 * Alligator: 3 SMMA (RMA) lines on HL2 with forward offsets.
 * Jaw = RMA(hl2, 13) shifted 8 bars, Teeth = RMA(hl2, 8) shifted 5, Lips = RMA(hl2, 5) shifted 3.
 * Fractals: 5-bar pivot high/low detection.
 * Resistance: valuewhen(high >= highest(high, lengthRS), high, 0) - held until new fractal high.
 * Support: valuewhen(low <= lowest(low, lengthRS), low, 0) - held until new fractal low.
 *
 * Reference: TradingView "Bill Williams Alligator + Fractals + S/R" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface WilliamsComboInputs {
  lengthRS: number;
}

export const defaultInputs: WilliamsComboInputs = {
  lengthRS: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthRS', type: 'int', title: 'Res-Sup Length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Jaw', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Teeth', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Lips', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'Resistance', color: '#808000', lineWidth: 1, style: 'linebr' },
  { id: 'plot4', title: 'Support', color: '#800000', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Williams Alligator + Fractals',
  shortTitle: 'WilliamsCombo',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<WilliamsComboInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { lengthRS } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const hl2Series = new Series(bars, (b) => (b.high + b.low) / 2);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // SMMA = RMA
  const jawRaw = ta.rma(hl2Series, 13).toArray();
  const teethRaw = ta.rma(hl2Series, 8).toArray();
  const lipsRaw = ta.rma(hl2Series, 5).toArray();

  // Shift forward by padding NaN at start
  const shift = (arr: number[], offset: number): number[] => {
    const result: number[] = new Array(n).fill(NaN);
    for (let i = 0; i < n - offset; i++) {
      result[i + offset] = arr[i];
    }
    return result;
  };

  const jawArr = shift(jawRaw, 8);
  const teethArr = shift(teethRaw, 5);
  const lipsArr = shift(lipsRaw, 3);

  // Fractals: 5-bar pivots (2 left, 2 right)
  const phArr = ta.pivothigh(highSeries, 2, 2).toArray();
  const plArr = ta.pivotlow(lowSeries, 2, 2).toArray();

  // Pine: highRS = valuewhen(high >= highest(high, lengthRS), high, 0)
  // Pine: lowRS  = valuewhen(low  <= lowest(low, lengthRS),  low, 0)
  // Resistance line holds value; breaks (na) when value changes.
  const hhArr = ta.highest(highSeries, lengthRS).toArray();
  const llArr = ta.lowest(lowSeries, lengthRS).toArray();

  const markers: MarkerData[] = [];
  let highRS = NaN;
  let lowRS = NaN;
  let prevHighRS = NaN;
  let prevLowRS = NaN;

  const plot3: { time: number; value: number }[] = [];
  const plot4: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    if (!isNaN(phArr[i]) && phArr[i] !== 0) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#EF5350', text: 'F' });
    }
    if (!isNaN(plArr[i]) && plArr[i] !== 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#26A69A', text: 'F' });
    }

    // Save previous raw values before updating (Pine: highRS[1], lowRS[1])
    prevHighRS = highRS;
    prevLowRS = lowRS;

    // Pine: highRS = valuewhen(high >= highest(high, lengthRS), high, 0)
    if (i >= lengthRS && bars[i].high >= hhArr[i]) {
      highRS = bars[i].high;
    }
    // Pine: lowRS = valuewhen(low <= lowest(low, lengthRS), low, 0)
    if (i >= lengthRS && bars[i].low <= llArr[i]) {
      lowRS = bars[i].low;
    }

    // Pine: color = highRS != highRS[1] ? na : olive (break line when level changes)
    const resVal = (i < lengthRS || isNaN(highRS)) ? NaN : (highRS !== prevHighRS && i > 0 ? NaN : highRS);
    const supVal = (i < lengthRS || isNaN(lowRS)) ? NaN : (lowRS !== prevLowRS && i > 0 ? NaN : lowRS);

    plot3.push({ time: bars[i].time, value: resVal });
    plot4.push({ time: bars[i].time, value: supVal });
  }

  const warmup = 13;
  const plot0 = jawArr.map((v, i) => ({ time: bars[i].time, value: i < warmup || isNaN(v) ? NaN : v }));
  const plot1 = teethArr.map((v, i) => ({ time: bars[i].time, value: i < warmup || isNaN(v) ? NaN : v }));
  const plot2 = lipsArr.map((v, i) => ({ time: bars[i].time, value: i < warmup || isNaN(v) ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4 },
    markers,
  };
}

export const WilliamsCombo = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
