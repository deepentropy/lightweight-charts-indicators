/**
 * ZigZag with Fibonacci Levels
 *
 * ZigZag using pivot highs/lows with configurable period.
 * Tracks direction changes, draws zigzag line segments between pivots.
 * On the last bar, draws Fibonacci retracement levels between the last two
 * zigzag legs with configurable ratios (0.236, 0.382, 0.500, 0.618, 0.786).
 *
 * Overlay indicator.
 *
 * Reference: TradingView "ZigZag with Fibonacci Levels" by LonesomeTheBlue
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LineDrawingData, LabelData } from '../types';

export interface ZigzagFibonacciInputs {
  period: number;
  showZigzag: boolean;
  showFibo: boolean;
  enable236: boolean;
  enable382: boolean;
  enable500: boolean;
  enable618: boolean;
  enable786: boolean;
}

export const defaultInputs: ZigzagFibonacciInputs = {
  period: 15,
  showZigzag: true,
  showFibo: true,
  enable236: true,
  enable382: true,
  enable500: true,
  enable618: true,
  enable786: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'ZigZag Period', defval: 15, min: 2, max: 50 },
  { id: 'showZigzag', type: 'bool', title: 'Show Zig Zag', defval: true },
  { id: 'showFibo', type: 'bool', title: 'Show Fibonacci Ratios', defval: true },
  { id: 'enable236', type: 'bool', title: 'Enable Level 0.236', defval: true },
  { id: 'enable382', type: 'bool', title: 'Enable Level 0.382', defval: true },
  { id: 'enable500', type: 'bool', title: 'Enable Level 0.500', defval: true },
  { id: 'enable618', type: 'bool', title: 'Enable Level 0.618', defval: true },
  { id: 'enable786', type: 'bool', title: 'Enable Level 0.786', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'ZigZag with Fibonacci Levels',
  shortTitle: 'ZZ Fibo',
  overlay: true,
};

export function calculate(
  bars: Bar[],
  inputs: Partial<ZigzagFibonacciInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[] } {
  const { period, showZigzag, showFibo, enable236, enable382, enable500, enable618, enable786 } = {
    ...defaultInputs,
    ...inputs,
  };
  const n = bars.length;
  const prd = period;

  const lines: LineDrawingData[] = [];
  const labels: LabelData[] = [];

  if (n < prd * 2) {
    return {
      metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
      plots: {},
      lines,
      labels,
    };
  }

  // Build fib ratios array
  const fiboRatios: number[] = [0.0];
  if (enable236) fiboRatios.push(0.236);
  if (enable382) fiboRatios.push(0.382);
  if (enable500) fiboRatios.push(0.500);
  if (enable618) fiboRatios.push(0.618);
  if (enable786) fiboRatios.push(0.786);
  const shownLevels = fiboRatios.length;
  // Extended fib levels
  for (let x = 1; x <= 5; x++) {
    fiboRatios.push(x);
    fiboRatios.push(x + 0.272);
    fiboRatios.push(x + 0.414);
    fiboRatios.push(x + 0.618);
  }

  // Pine: ph = highestbars(high, prd) == 0 ? high : na
  // Pine: pl = lowestbars(low, prd) == 0 ? low : na
  // This means: if current bar IS the highest high over last prd bars, ph = high; else NaN
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hbArr = ta.highestbars(highSeries, prd).toArray();
  const lbArr = ta.lowestbars(lowSeries, prd).toArray();

  // ZigZag array stores [value, barIndex, value, barIndex, ...] (newest first)
  const maxArraySize = 10;
  const zigzag: number[] = [];
  let dir = 0;

  const addToZigzag = (value: number, bindex: number) => {
    zigzag.unshift(bindex);
    zigzag.unshift(value);
    if (zigzag.length > maxArraySize) {
      zigzag.pop();
      zigzag.pop();
    }
  };

  const updateZigzag = (value: number, bindex: number) => {
    if (zigzag.length === 0) {
      addToZigzag(value, bindex);
    } else {
      if ((dir === 1 && value > zigzag[0]) || (dir === -1 && value < zigzag[0])) {
        zigzag[0] = value;
        zigzag[1] = bindex;
      }
    }
  };

  // Track previous zigzag state for line drawing
  let prevZZ0 = NaN;
  let prevZZ1 = NaN;
  let prevZZ2 = NaN;
  let prevZZ3 = NaN;

  const upCol = '#00FF00';
  const dnCol = '#FF0000';
  const fiboLineCol = '#00FF00';
  const fiboLabelCol = '#0000FF';

  for (let i = 0; i < n; i++) {
    const hb = hbArr[i];
    const lb = lbArr[i];

    // ph: current bar is highest over prd bars
    const isPh = hb != null && !isNaN(hb as number) && (hb as number) === 0;
    // pl: current bar is lowest over prd bars
    const isPl = lb != null && !isNaN(lb as number) && (lb as number) === 0;

    const ph = isPh ? bars[i].high : NaN;
    const pl = isPl ? bars[i].low : NaN;

    const prevDir = dir;

    // Update direction
    if (!isNaN(ph) && isNaN(pl)) {
      dir = 1;
    } else if (isNaN(ph) && !isNaN(pl)) {
      dir = -1;
    }

    if (!isNaN(ph) || !isNaN(pl)) {
      // Save previous state
      prevZZ0 = zigzag.length >= 1 ? zigzag[0] : NaN;
      prevZZ1 = zigzag.length >= 2 ? zigzag[1] : NaN;
      prevZZ2 = zigzag.length >= 3 ? zigzag[2] : NaN;
      prevZZ3 = zigzag.length >= 4 ? zigzag[3] : NaN;

      const dirChanged = dir !== prevDir && prevDir !== 0;
      if (dirChanged) {
        addToZigzag(dir === 1 ? ph : pl, i);
      } else {
        updateZigzag(dir === 1 ? ph : pl, i);
      }

      // Draw zigzag line when state changes
      if (showZigzag && zigzag.length >= 4) {
        const zz0 = zigzag[0];
        const zz1 = zigzag[1];
        const zz2 = zigzag[2];
        const zz3 = zigzag[3];

        if (zz0 !== prevZZ0 || zz1 !== prevZZ1) {
          // If the second point hasn't changed, delete previous line segment
          // (we just replace by pushing a new one; earlier duplicate gets overridden visually)
          if (zz2 === prevZZ2 && zz3 === prevZZ3) {
            // Remove the last line if it connects the same second point
            if (lines.length > 0) {
              const last = lines[lines.length - 1];
              if (last.time2 === bars[Math.round(zz3)].time && last.price2 === zz2) {
                lines.pop();
              }
            }
          }

          const idx1 = Math.round(zz1);
          const idx2 = Math.round(zz3);
          if (idx1 >= 0 && idx1 < n && idx2 >= 0 && idx2 < n) {
            lines.push({
              time1: bars[idx1].time,
              price1: zz0,
              time2: bars[idx2].time,
              price2: zz2,
              color: dir === 1 ? upCol : dnCol,
              width: 2,
              style: 'solid',
            });
          }
        }
      }
    }
  }

  // On last bar: draw Fibonacci levels if we have enough zigzag points (>= 6 values = 3 pivots)
  if (showFibo && zigzag.length >= 6) {
    // zigzag: [val0, idx0, val1, idx1, val2, idx2, ...]
    // Pine: diff = zigzag[4] - zigzag[2], base = zigzag[2]
    // Fib levels are drawn from zigzag[5] (bar index of third pivot) extending right
    const base = zigzag[2]; // second-most-recent pivot value
    const prev = zigzag[4]; // third-most-recent pivot value
    const diff = prev - base;
    const fibStartIdx = Math.round(zigzag[5]); // bar index of third pivot

    if (fibStartIdx >= 0 && fibStartIdx < n && !isNaN(diff) && diff !== 0) {
      let stopit = false;

      for (let x = 0; x < fiboRatios.length; x++) {
        if (stopit && x > shownLevels) break;

        const ratio = fiboRatios[x];
        const price = base + diff * ratio;

        lines.push({
          time1: bars[fibStartIdx].time,
          price1: price,
          time2: bars[n - 1].time,
          price2: price,
          color: fiboLineCol,
          width: 1,
          style: 'solid',
          extend: 'right',
        });

        labels.push({
          time: bars[fibStartIdx].time,
          price,
          text: ratio.toFixed(3) + ' (' + price.toFixed(2) + ')',
          textColor: fiboLabelCol,
          style: 'label_right',
          size: 'small',
        });

        // Stop extending fib levels once they pass the most recent pivot
        const recentVal = zigzag[0];
        if ((dir === 1 && price > recentVal) || (dir === -1 && price < recentVal)) {
          stopit = true;
        }
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    labels,
  };
}

export const ZigzagFibonacci = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
