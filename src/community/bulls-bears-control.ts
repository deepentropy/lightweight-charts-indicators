/**
 * CM_TotalConsecutive_Up_Down_V2
 *
 * Overlay=false histogram showing consecutive bars since price moved down or up
 * (relative to midpoint or previous close). Additional optional overlays:
 * - Highest bar lookback period (midpoint and/or close)
 * - Standard deviation bands (midpoint and/or close)
 * - Moving average (midpoint and/or close)
 * Plus an hline at a configurable level.
 *
 * Reference: TradingView "Custom Indicator Clearly Shows If Bulls or Bears are in Control!"
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface BullsBearsInputs {
  useMidpoint: boolean;
  showHighestMidpoint: boolean;
  showHighestClose: boolean;
  showStdevMidpoint: boolean;
  showStdevClose: boolean;
  showMaMidpoint: boolean;
  showMaClose: boolean;
  hlength: number;
  lookbackLength: number;
  stdevLength: number;
  stdevMult: number;
  maLength: number;
}

export const defaultInputs: BullsBearsInputs = {
  useMidpoint: true,
  showHighestMidpoint: false,
  showHighestClose: false,
  showStdevMidpoint: false,
  showStdevClose: false,
  showMaMidpoint: false,
  showMaClose: false,
  hlength: 4,
  lookbackLength: 50,
  stdevLength: 50,
  stdevMult: 2,
  maLength: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'useMidpoint', type: 'bool', title: 'Check = Use Midpoint, UnCheck = Use Prev Close', defval: true },
  { id: 'showHighestMidpoint', type: 'bool', title: 'Highest Bar Look Back Period - Using Midpoint?', defval: false },
  { id: 'showHighestClose', type: 'bool', title: 'Highest Bar Look Back Period - Using Close?', defval: false },
  { id: 'showStdevMidpoint', type: 'bool', title: 'Standard Dev - Using Midpoint?', defval: false },
  { id: 'showStdevClose', type: 'bool', title: 'Standard Dev - Using Close?', defval: false },
  { id: 'showMaMidpoint', type: 'bool', title: 'Moving Average - Using Midpoint?', defval: false },
  { id: 'showMaClose', type: 'bool', title: 'Moving Average - Using Close?', defval: false },
  { id: 'hlength', type: 'int', title: 'Horizontal Line', defval: 4, min: 1 },
  { id: 'lookbackLength', type: 'int', title: 'Highest Bar Look Back Period', defval: 50, min: 1 },
  { id: 'stdevLength', type: 'int', title: 'Standard Dev Length', defval: 50, min: 1 },
  { id: 'stdevMult', type: 'int', title: 'Standard Dev Multiple', defval: 2, min: 1 },
  { id: 'maLength', type: 'int', title: 'Moving Average length', defval: 20, min: 1 },
];

// 14 plots matching Pine source exactly:
// plot0-1: primary histogram (down/up using midpoint or close based on dopm toggle)
// plot2-3: highest lookback midpoint (down/up), gated by dohbM
// plot4-5: highest lookback close (down/up), gated by dohbC
// plot6-7: stdev midpoint (down/up), gated by dostM
// plot8-9: stdev close (down/up), gated by dostC
// plot10-11: MA midpoint (down/up), gated by domaM
// plot12-13: MA close (down/up), gated by domaC
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Price Down Based On Midpoint or Close', color: '#F44336', lineWidth: 3, style: 'histogram' },
  { id: 'plot1', title: 'Price Up Based On Midpoint or Close', color: '#00FF00', lineWidth: 3, style: 'histogram' },
  { id: 'plot2', title: 'Highest Down Bar Lookback - Midpoint', color: '#F44336', lineWidth: 4 },
  { id: 'plot3', title: 'Highest Up Bar Lookback - Midpoint', color: '#00FF00', lineWidth: 4 },
  { id: 'plot4', title: 'Highest Down Bar Lookback - Close', color: '#F44336', lineWidth: 4 },
  { id: 'plot5', title: 'Highest Up Bar Lookback - Close', color: '#00FF00', lineWidth: 4 },
  { id: 'plot6', title: 'StdDev of Down Bars - Midpoint', color: '#F44336', lineWidth: 4 },
  { id: 'plot7', title: 'StdDev of Up Bars - Midpoint', color: '#00FF00', lineWidth: 4 },
  { id: 'plot8', title: 'StdDev of Down Bars - Close', color: '#F44336', lineWidth: 4 },
  { id: 'plot9', title: 'StdDev of Up Bars - Close', color: '#00FF00', lineWidth: 4 },
  { id: 'plot10', title: 'MA of Down Bars - Midpoint', color: '#F44336', lineWidth: 4 },
  { id: 'plot11', title: 'MA of Up Bars - Midpoint', color: '#00FF00', lineWidth: 4 },
  { id: 'plot12', title: 'MA of Down Bars - Close', color: '#F44336', lineWidth: 4 },
  { id: 'plot13', title: 'MA of Up Bars - Close', color: '#00FF00', lineWidth: 4 },
];

export const metadata = {
  title: 'CM TotalConsecutive Up/Down V2',
  shortTitle: 'CM_TotalConsec_Up_Down_V2',
  overlay: false,
};

/**
 * barssince: count bars since condition was last true.
 * Returns 0 on the bar where condition is true, increments each bar after.
 */
function barssince(condition: boolean[], index: number): number {
  for (let i = index; i >= 0; i--) {
    if (condition[i]) return index - i;
  }
  return index; // never been true, return distance from start
}

function highest(arr: number[], len: number, idx: number): number {
  let max = 0;
  for (let j = 0; j < len && idx - j >= 0; j++) {
    max = Math.max(max, arr[idx - j]);
  }
  return max;
}

function smaOf(arr: number[], len: number, idx: number): number {
  if (idx < len - 1) return NaN;
  let sum = 0;
  for (let j = 0; j < len; j++) sum += arr[idx - j];
  return sum / len;
}

function stdevOf(arr: number[], len: number, idx: number): number {
  if (idx < len - 1) return NaN;
  let sum = 0;
  for (let j = 0; j < len; j++) sum += arr[idx - j];
  const mean = sum / len;
  let sumSq = 0;
  for (let j = 0; j < len; j++) sumSq += (arr[idx - j] - mean) ** 2;
  return Math.sqrt(sumSq / len);
}

export function calculate(bars: Bar[], inputs: Partial<BullsBearsInputs> = {}): IndicatorResult {
  const {
    useMidpoint, showHighestMidpoint, showHighestClose,
    showStdevMidpoint, showStdevClose, showMaMidpoint, showMaClose,
    hlength, lookbackLength, stdevLength, stdevMult, maLength,
  } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Pine conditions:
  // down_BarC = close > close[1]   (price went up from prev close - Pine calls this "down" confusingly)
  // up_BarC   = close < close[1]
  // down_BarM = close > hl2[1]
  // up_BarM   = close < hl2[1]
  const downBarM: boolean[] = new Array(n);
  const upBarM: boolean[] = new Array(n);
  const downBarC: boolean[] = new Array(n);
  const upBarC: boolean[] = new Array(n);

  for (let i = 0; i < n; i++) {
    if (i === 0) {
      downBarM[i] = false;
      upBarM[i] = false;
      downBarC[i] = false;
      upBarC[i] = false;
      continue;
    }
    const hl2Prev = (bars[i - 1].high + bars[i - 1].low) / 2;
    downBarM[i] = bars[i].close > hl2Prev;
    upBarM[i] = bars[i].close < hl2Prev;
    downBarC[i] = bars[i].close > bars[i - 1].close;
    upBarC[i] = bars[i].close < bars[i - 1].close;
  }

  // barssince arrays
  const bsDownM: number[] = new Array(n);
  const bsUpM: number[] = new Array(n);
  const bsDownC: number[] = new Array(n);
  const bsUpC: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    bsDownM[i] = barssince(downBarM, i);
    bsUpM[i] = barssince(upBarM, i);
    bsDownC[i] = barssince(downBarC, i);
    bsUpC[i] = barssince(upBarC, i);
  }

  // Pre-compute SMA arrays used by Pine: avg_Down, avg_Up, avg_DownC, avg_UpC
  // Pine: avg_Down = sma(barssince(down_BarM), length3)
  // These are computed unconditionally in Pine (used by plots gated by domaM/domaC)

  type Point = { time: number; value: number };
  const plot0: Point[] = new Array(n);
  const plot1: Point[] = new Array(n);
  const plot2: Point[] = new Array(n);
  const plot3: Point[] = new Array(n);
  const plot4: Point[] = new Array(n);
  const plot5: Point[] = new Array(n);
  const plot6: Point[] = new Array(n);
  const plot7: Point[] = new Array(n);
  const plot8: Point[] = new Array(n);
  const plot9: Point[] = new Array(n);
  const plot10: Point[] = new Array(n);
  const plot11: Point[] = new Array(n);
  const plot12: Point[] = new Array(n);
  const plot13: Point[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;

    // Pine plot 1: plot(dopm and barssince(down_BarM) ? barssince(down_BarM) : barssince(down_BarC), ...)
    // When dopm=true: shows midpoint-based barssince; when false: shows close-based
    const downVal = (useMidpoint && bsDownM[i]) ? bsDownM[i] : bsDownC[i];
    plot0[i] = { time: t, value: i === 0 ? NaN : downVal };

    // Pine plot 2: plot(dopm and barssince(up_BarM) ? barssince(up_BarM) : barssince(up_BarC), ...)
    const upVal = (useMidpoint && bsUpM[i]) ? bsUpM[i] : bsUpC[i];
    plot1[i] = { time: t, value: i === 0 ? NaN : upVal };

    // Pine plot 3: highest down bar lookback - midpoint (gated by dohbM)
    if (showHighestMidpoint) {
      const v = highest(bsDownM, lookbackLength, i);
      plot2[i] = { time: t, value: v || NaN };
    } else {
      plot2[i] = { time: t, value: NaN };
    }

    // Pine plot 4: highest up bar lookback - midpoint (gated by dohbM)
    if (showHighestMidpoint) {
      const v = highest(bsUpM, lookbackLength, i);
      plot3[i] = { time: t, value: v || NaN };
    } else {
      plot3[i] = { time: t, value: NaN };
    }

    // Pine plot 5: highest down bar lookback - close (gated by dohbC)
    if (showHighestClose) {
      const v = highest(bsDownC, lookbackLength, i);
      plot4[i] = { time: t, value: v || NaN };
    } else {
      plot4[i] = { time: t, value: NaN };
    }

    // Pine plot 6: highest up bar lookback - close (gated by dohbC)
    if (showHighestClose) {
      const v = highest(bsUpC, lookbackLength, i);
      plot5[i] = { time: t, value: v || NaN };
    } else {
      plot5[i] = { time: t, value: NaN };
    }

    // Pine plot 7: stdev down - midpoint (gated by dostM)
    if (showStdevMidpoint) {
      const sd = stdevOf(bsDownM, stdevLength, i);
      plot6[i] = { time: t, value: isNaN(sd) ? NaN : sd * stdevMult };
    } else {
      plot6[i] = { time: t, value: NaN };
    }

    // Pine plot 8: stdev up - midpoint (gated by dostM)
    if (showStdevMidpoint) {
      const sd = stdevOf(bsUpM, stdevLength, i);
      plot7[i] = { time: t, value: isNaN(sd) ? NaN : sd * stdevMult };
    } else {
      plot7[i] = { time: t, value: NaN };
    }

    // Pine plot 9: stdev down - close (gated by dostC)
    if (showStdevClose) {
      const sd = stdevOf(bsDownC, stdevLength, i);
      plot8[i] = { time: t, value: isNaN(sd) ? NaN : sd * stdevMult };
    } else {
      plot8[i] = { time: t, value: NaN };
    }

    // Pine plot 10: stdev up - close (gated by dostC)
    if (showStdevClose) {
      const sd = stdevOf(bsUpC, stdevLength, i);
      plot9[i] = { time: t, value: isNaN(sd) ? NaN : sd * stdevMult };
    } else {
      plot9[i] = { time: t, value: NaN };
    }

    // Pine plot 11: MA down - midpoint (gated by domaM)
    if (showMaMidpoint) {
      const ma = smaOf(bsDownM, maLength, i);
      plot10[i] = { time: t, value: isNaN(ma) ? NaN : ma };
    } else {
      plot10[i] = { time: t, value: NaN };
    }

    // Pine plot 12: MA up - midpoint (gated by domaM)
    if (showMaMidpoint) {
      const ma = smaOf(bsUpM, maLength, i);
      plot11[i] = { time: t, value: isNaN(ma) ? NaN : ma };
    } else {
      plot11[i] = { time: t, value: NaN };
    }

    // Pine plot 13: MA down - close (gated by domaC)
    if (showMaClose) {
      const ma = smaOf(bsDownC, maLength, i);
      plot12[i] = { time: t, value: isNaN(ma) ? NaN : ma };
    } else {
      plot12[i] = { time: t, value: NaN };
    }

    // Pine plot 14: MA up - close (gated by domaC)
    if (showMaClose) {
      const ma = smaOf(bsUpC, maLength, i);
      plot13[i] = { time: t, value: isNaN(ma) ? NaN : ma };
    } else {
      plot13[i] = { time: t, value: NaN };
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': plot0, 'plot1': plot1,
      'plot2': plot2, 'plot3': plot3,
      'plot4': plot4, 'plot5': plot5,
      'plot6': plot6, 'plot7': plot7,
      'plot8': plot8, 'plot9': plot9,
      'plot10': plot10, 'plot11': plot11,
      'plot12': plot12, 'plot13': plot13,
    },
    hlines: [
      { value: hlength, options: { color: '#FFFF00', linestyle: 'dashed' as const, title: 'Horizontal Line' } },
    ],
  };
}

export const BullsBears = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
