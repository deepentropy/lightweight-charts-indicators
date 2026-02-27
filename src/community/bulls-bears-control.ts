/**
 * CM_TotalConsecutive_Up_Down_V2
 *
 * Overlay=false histogram showing consecutive bars since price moved down or up
 * (relative to midpoint or previous close). Additional optional overlays:
 * - Highest bar lookback period
 * - Standard deviation bands
 * - Moving average
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
  { id: 'useMidpoint', type: 'bool', title: 'Use Midpoint (uncheck = Prev Close)', defval: true },
  { id: 'showHighestMidpoint', type: 'bool', title: 'Highest Bar Lookback - Midpoint', defval: false },
  { id: 'showHighestClose', type: 'bool', title: 'Highest Bar Lookback - Close', defval: false },
  { id: 'showStdevMidpoint', type: 'bool', title: 'Standard Dev - Midpoint', defval: false },
  { id: 'showStdevClose', type: 'bool', title: 'Standard Dev - Close', defval: false },
  { id: 'showMaMidpoint', type: 'bool', title: 'Moving Average - Midpoint', defval: false },
  { id: 'showMaClose', type: 'bool', title: 'Moving Average - Close', defval: false },
  { id: 'hlength', type: 'int', title: 'Horizontal Line', defval: 4, min: 1 },
  { id: 'lookbackLength', type: 'int', title: 'Highest Bar Look Back Period', defval: 50, min: 1 },
  { id: 'stdevLength', type: 'int', title: 'Standard Dev Length', defval: 50, min: 1 },
  { id: 'stdevMult', type: 'int', title: 'Standard Dev Multiple', defval: 2, min: 1 },
  { id: 'maLength', type: 'int', title: 'Moving Average Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Consecutive Down', color: '#F44336', lineWidth: 3, style: 'histogram' },
  { id: 'plot1', title: 'Consecutive Up', color: '#00FF00', lineWidth: 3, style: 'histogram' },
  { id: 'plot2', title: 'Highest Down Lookback', color: '#F44336', lineWidth: 4 },
  { id: 'plot3', title: 'Highest Up Lookback', color: '#00FF00', lineWidth: 4 },
  { id: 'plot4', title: 'StdDev Down', color: '#F44336', lineWidth: 4 },
  { id: 'plot5', title: 'StdDev Up', color: '#00FF00', lineWidth: 4 },
  { id: 'plot6', title: 'MA Down', color: '#F44336', lineWidth: 4 },
  { id: 'plot7', title: 'MA Up', color: '#00FF00', lineWidth: 4 },
];

export const metadata = {
  title: 'CM TotalConsecutive Up/Down V2',
  shortTitle: 'CM_ConsecUpDn',
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

export function calculate(bars: Bar[], inputs: Partial<BullsBearsInputs> = {}): IndicatorResult {
  const {
    useMidpoint, showHighestMidpoint, showHighestClose,
    showStdevMidpoint, showStdevClose, showMaMidpoint, showMaClose,
    hlength, lookbackLength, stdevLength, stdevMult, maLength
  } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Conditions based on midpoint (hl2[1]) or close[1]
  // down_BarM = close > hl2[1]  (price moved down from midpoint - confusing naming in Pine but that's the source)
  // up_BarM = close < hl2[1]
  // down_BarC = close > close[1]
  // up_BarC = close < close[1]
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

  // Compute barssince arrays
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

  // Primary histogram: use midpoint or close version based on dopm
  // Pine: plot(dopm and barssince(down_BarM) ? barssince(down_BarM) : barssince(down_BarC), ...)
  // This means: if useMidpoint, show midpoint-based; else show close-based
  const downBars = useMidpoint ? bsDownM : bsDownC;
  const upBars = useMidpoint ? bsUpM : bsUpC;

  // Compute highest over lookback
  function highest(arr: number[], len: number, idx: number): number {
    let max = 0;
    for (let j = 0; j < len && idx - j >= 0; j++) {
      max = Math.max(max, arr[idx - j]);
    }
    return max;
  }

  // Compute SMA of array
  function smaOf(arr: number[], len: number, idx: number): number {
    if (idx < len - 1) return NaN;
    let sum = 0;
    for (let j = 0; j < len; j++) sum += arr[idx - j];
    return sum / len;
  }

  // Compute stdev of array
  function stdevOf(arr: number[], len: number, idx: number): number {
    if (idx < len - 1) return NaN;
    let sum = 0;
    for (let j = 0; j < len; j++) sum += arr[idx - j];
    const mean = sum / len;
    let sumSq = 0;
    for (let j = 0; j < len; j++) sumSq += (arr[idx - j] - mean) ** 2;
    return Math.sqrt(sumSq / len);
  }

  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const plot2: { time: number; value: number }[] = [];
  const plot3: { time: number; value: number }[] = [];
  const plot4: { time: number; value: number }[] = [];
  const plot5: { time: number; value: number }[] = [];
  const plot6: { time: number; value: number }[] = [];
  const plot7: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;

    // Plot0: Consecutive down (red histogram)
    plot0.push({ time: t, value: i === 0 ? NaN : downBars[i] });

    // Plot1: Consecutive up (green histogram)
    plot1.push({ time: t, value: i === 0 ? NaN : upBars[i] });

    // Plot2: Highest down bar lookback - show based on midpoint or close toggle
    const showHB = (showHighestMidpoint && useMidpoint) || (showHighestClose && !useMidpoint);
    if (showHB) {
      // Pine shows midpoint or close version depending on toggle
      const hbDownArr = showHighestMidpoint ? bsDownM : bsDownC;
      plot2.push({ time: t, value: highest(hbDownArr, lookbackLength, i) });
    } else {
      plot2.push({ time: t, value: NaN });
    }

    // Plot3: Highest up bar lookback
    if (showHB) {
      const hbUpArr = showHighestMidpoint ? bsUpM : bsUpC;
      plot3.push({ time: t, value: highest(hbUpArr, lookbackLength, i) });
    } else {
      plot3.push({ time: t, value: NaN });
    }

    // Plot4: StdDev down
    const showSt = (showStdevMidpoint && useMidpoint) || (showStdevClose && !useMidpoint);
    if (showSt) {
      const stArr = showStdevMidpoint ? bsDownM : bsDownC;
      const sd = stdevOf(stArr, stdevLength, i);
      plot4.push({ time: t, value: isNaN(sd) ? NaN : sd * stdevMult });
    } else {
      plot4.push({ time: t, value: NaN });
    }

    // Plot5: StdDev up
    if (showSt) {
      const stArr = showStdevMidpoint ? bsUpM : bsUpC;
      const sd = stdevOf(stArr, stdevLength, i);
      plot5.push({ time: t, value: isNaN(sd) ? NaN : sd * stdevMult });
    } else {
      plot5.push({ time: t, value: NaN });
    }

    // Plot6: MA down
    const showMa = (showMaMidpoint && useMidpoint) || (showMaClose && !useMidpoint);
    if (showMa) {
      const maArr = showMaMidpoint ? bsDownM : bsDownC;
      const ma = smaOf(maArr, maLength, i);
      plot6.push({ time: t, value: ma });
    } else {
      plot6.push({ time: t, value: NaN });
    }

    // Plot7: MA up
    if (showMa) {
      const maArr = showMaMidpoint ? bsUpM : bsUpC;
      const ma = smaOf(maArr, maLength, i);
      plot7.push({ time: t, value: ma });
    } else {
      plot7.push({ time: t, value: NaN });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': plot0, 'plot1': plot1,
      'plot2': plot2, 'plot3': plot3,
      'plot4': plot4, 'plot5': plot5,
      'plot6': plot6, 'plot7': plot7,
    },
    hlines: [
      { value: hlength, options: { color: '#FFFF00', linestyle: 'dashed' as const, title: 'Horizontal Line' } },
    ],
  };
}

export const BullsBears = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
