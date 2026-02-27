/**
 * Fibonacci Levels
 *
 * EMA-based midline with 6 symmetric Fibonacci deviation bands above and below.
 * Uses standard deviation of effective close (max/min of open,close) multiplied
 * by Fibonacci-derived factors (lm, lm2, lm3, lm4, lm5, lm6).
 * Total: 13 plots (midline + 6 up + 6 down).
 *
 * Reference: TradingView "Fibonacci levels" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface FibonacciLevelsInputs {
  fastPeriod: number;
  emaPeriod: number;
}

export const defaultInputs: FibonacciLevelsInputs = {
  fastPeriod: 50,
  emaPeriod: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastPeriod', type: 'int', title: '50 MA', defval: 50, min: 1 },
  { id: 'emaPeriod', type: 'int', title: '100 MA', defval: 100, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'midline', title: 'Mid Line', color: '#FF0000', lineWidth: 2 },
  { id: 'up1', title: '1 Up', color: '#787B86', lineWidth: 1 },
  { id: 'up2', title: '2 Up', color: '#787B86', lineWidth: 1 },
  { id: 'up3', title: '3 Up', color: '#787B86', lineWidth: 1 },
  { id: 'up4', title: '4 Up', color: '#787B86', lineWidth: 1 },
  { id: 'up5', title: '5 Up', color: '#787B86', lineWidth: 1 },
  { id: 'up6', title: '6 Up', color: '#787B86', lineWidth: 1 },
  { id: 'down1', title: '1 Down', color: '#787B86', lineWidth: 1 },
  { id: 'down2', title: '2 Down', color: '#787B86', lineWidth: 1 },
  { id: 'down3', title: '3 Down', color: '#787B86', lineWidth: 1 },
  { id: 'down4', title: '4 Down', color: '#787B86', lineWidth: 1 },
  { id: 'down5', title: '5 Down', color: '#787B86', lineWidth: 1 },
  { id: 'down6', title: '6 Down', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Fibonacci Levels',
  shortTitle: 'FibLvl',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<FibonacciLevelsInputs> = {}): IndicatorResult {
  const { emaPeriod } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // effclose = max(open,close) if close>=open, else min(open,close)
  const effCloseSeries = new Series(bars, (b) =>
    b.close >= b.open ? Math.max(b.open, b.close) : Math.min(b.open, b.close)
  );

  const midlineArr = ta.ema(effCloseSeries, emaPeriod).toArray();
  const devArr = ta.stdev(effCloseSeries, emaPeriod).toArray();

  // Compute max deviation multiplier per bar, then EMA it
  const toc = bars.map(b => Math.max(b.open, b.close));
  const boc = bars.map(b => Math.min(b.open, b.close));

  const maxMultArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const mid = midlineArr[i] ?? 0;
    const dev = devArr[i] ?? 0;
    if (dev === 0 || isNaN(mid) || isNaN(dev)) {
      maxMultArr[i] = 0;
    } else {
      const plusDevMult = toc[i] > mid ? (toc[i] - mid) / dev : 0;
      const minusDevMult = boc[i] < mid ? (mid - boc[i]) / dev : 0;
      maxMultArr[i] = Math.max(plusDevMult, minusDevMult);
    }
  }

  const maxMultSeries = new Series(bars, (_b, i) => maxMultArr[i]);
  const lmArr = ta.ema(maxMultSeries, emaPeriod).toArray();

  const warmup = emaPeriod;

  // Pine Fibonacci multipliers:
  // lm, lm2=lm/2, lm3=lm2*0.38196601, lm4=lm*1.38196601, lm5=lm*1.61803399, lm6=(lm+lm2)/2
  const plotIds = ['midline', 'up1', 'up2', 'up3', 'up4', 'up5', 'up6', 'down1', 'down2', 'down3', 'down4', 'down5', 'down6'];
  const plots: Record<string, { time: number; value: number }[]> = {};
  for (const id of plotIds) {
    plots[id] = [];
  }

  for (let i = 0; i < n; i++) {
    const mid = midlineArr[i] ?? NaN;
    const dev = devArr[i] ?? NaN;
    const lm = lmArr[i] ?? NaN;

    if (i < warmup || isNaN(mid) || isNaN(dev) || isNaN(lm)) {
      for (const id of plotIds) {
        plots[id].push({ time: bars[i].time, value: NaN });
      }
    } else {
      const lm2 = lm / 2;
      const lm3 = lm2 * 0.38196601;
      const lm4 = lm * 1.38196601;
      const lm5 = lm * 1.61803399;
      const lm6 = (lm + lm2) / 2;

      plots['midline'].push({ time: bars[i].time, value: mid });
      // Up levels: 1=lm3, 2=lm2, 3=lm6, 4=lm, 5=lm4, 6=lm5 (per Pine plot order)
      plots['up1'].push({ time: bars[i].time, value: mid + dev * lm3 });
      plots['up2'].push({ time: bars[i].time, value: mid + dev * lm2 });
      plots['up3'].push({ time: bars[i].time, value: mid + dev * lm6 });
      plots['up4'].push({ time: bars[i].time, value: mid + dev * lm });
      plots['up5'].push({ time: bars[i].time, value: mid + dev * lm4 });
      plots['up6'].push({ time: bars[i].time, value: mid + dev * lm5 });
      // Down levels: same multipliers, subtracted
      plots['down1'].push({ time: bars[i].time, value: mid - dev * lm3 });
      plots['down2'].push({ time: bars[i].time, value: mid - dev * lm2 });
      plots['down3'].push({ time: bars[i].time, value: mid - dev * lm6 });
      plots['down4'].push({ time: bars[i].time, value: mid - dev * lm });
      plots['down5'].push({ time: bars[i].time, value: mid - dev * lm4 });
      plots['down6'].push({ time: bars[i].time, value: mid - dev * lm5 });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const FibonacciLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
