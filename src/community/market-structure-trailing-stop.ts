/**
 * Market Structure Trailing Stop [LuxAlgo]
 *
 * Overlay trailing stop that adapts based on market structure changes.
 * Uses pivot detection to identify bullish/bearish structure shifts.
 * Trailing stop starts at local min/max since pivot and trails using
 * max_change * incr/100 in trend direction.
 * Reset modes: CHoCH (Change of Character only) or All structure breaks.
 *
 * Reference: TradingView "Market Structure Trailing Stop [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MarketStructureTrailingStopInputs {
  length: number;
  incr: number;
  resetOn: string;
  showMS: boolean;
}

export const defaultInputs: MarketStructureTrailingStopInputs = {
  length: 14,
  incr: 100,
  resetOn: 'CHoCH',
  showMS: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Pivot Lookback', defval: 14, min: 1 },
  { id: 'incr', type: 'float', title: 'Increment Factor', defval: 100, min: 0.1, step: 0.1 },
  { id: 'resetOn', type: 'string', title: 'Reset On', defval: 'CHoCH', options: ['CHoCH', 'All'] },
  { id: 'showMS', type: 'bool', title: 'Show Market Structure', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'ts', title: 'Trailing Stop', color: '#089981', lineWidth: 2 },
  { id: 'closeLine', title: 'Close', color: '#00000000', lineWidth: 0 },
];

export const metadata = {
  title: 'Market Structure Trailing Stop',
  shortTitle: 'MSTS',
  overlay: true,
};

const BULL_COLOR = '#089981';  // teal
const BEAR_COLOR = '#f23645';  // red

export function calculate(bars: Bar[], inputs: Partial<MarketStructureTrailingStopInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const len = cfg.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // Pivot detection
  const phArr = ta.pivothigh(highSeries, len, len).toArray();
  const plArr = ta.pivotlow(lowSeries, len, len).toArray();

  // Track pivot high/low values
  let upperPivot = NaN;
  let lowerPivot = NaN;
  let upperPivotIdx = 0;
  let lowerPivotIdx = 0;

  const tsArr: number[] = new Array(n).fill(NaN);
  const osArr: number[] = new Array(n).fill(0);
  const markers: MarkerData[] = [];

  // State
  let os = 0;
  let ts = NaN;
  let top = NaN;
  let btm = NaN;
  let maxChange = 0;
  let structureChanged = false;

  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const high = bars[i].high;
    const low = bars[i].low;
    structureChanged = false;

    // Record pivots (they arrive with len-bar delay)
    const ph = phArr[i];
    const pl = plArr[i];
    if (ph != null && !isNaN(ph) && ph !== 0) {
      upperPivot = ph;
      upperPivotIdx = i - len;
    }
    if (pl != null && !isNaN(pl) && pl !== 0) {
      lowerPivot = pl;
      lowerPivotIdx = i - len;
    }

    if (i < len * 2) {
      tsArr[i] = NaN;
      osArr[i] = os;
      continue;
    }

    const prevOs = os;

    // Bullish structure: close crosses above upper pivot
    if (!isNaN(upperPivot) && i > 0 && bars[i - 1].close <= upperPivot && close > upperPivot) {
      const shouldReset = cfg.resetOn === 'All' || prevOs !== 1;
      if (shouldReset) {
        // Find local minimum from pivot bar to current bar
        let localMin = Infinity;
        const startJ = Math.max(0, upperPivotIdx);
        for (let j = startJ; j <= i; j++) {
          localMin = Math.min(localMin, bars[j].low);
        }
        btm = localMin === Infinity ? low : localMin;
        os = 1;
        ts = btm;
        maxChange = 0;
        structureChanged = prevOs !== 0 && prevOs !== os;

        if (cfg.showMS) {
          markers.push({
            time: bars[i].time,
            position: 'belowBar',
            shape: prevOs === -1 ? 'labelUp' : 'triangleUp',
            color: BULL_COLOR,
            text: prevOs === -1 ? 'CHoCH' : 'BOS',
          });
        }
      }
    }

    // Bearish structure: close crosses below lower pivot
    if (!isNaN(lowerPivot) && i > 0 && bars[i - 1].close >= lowerPivot && close < lowerPivot) {
      const shouldReset = cfg.resetOn === 'All' || prevOs !== -1;
      if (shouldReset) {
        // Find local maximum from pivot bar to current bar
        let localMax = -Infinity;
        const startJ = Math.max(0, lowerPivotIdx);
        for (let j = startJ; j <= i; j++) {
          localMax = Math.max(localMax, bars[j].high);
        }
        top = localMax === -Infinity ? high : localMax;
        os = -1;
        ts = top;
        maxChange = 0;
        structureChanged = prevOs !== 0 && prevOs !== os;

        if (cfg.showMS) {
          markers.push({
            time: bars[i].time,
            position: 'aboveBar',
            shape: prevOs === 1 ? 'labelDown' : 'triangleDown',
            color: BEAR_COLOR,
            text: prevOs === 1 ? 'CHoCH' : 'BOS',
          });
        }
      }
    }

    // Trailing stop adjustment (only if no structure change this bar)
    if (!structureChanged && !isNaN(ts) && os !== 0) {
      if (os === 1) {
        // Bull: trail upward using max_change * incr/100
        const change = high - btm;
        if (change > maxChange) maxChange = change;
        const newTs = btm + maxChange * (cfg.incr / 100);
        ts = Math.max(ts, newTs);
      } else {
        // Bear: trail downward using max_change * incr/100
        const change = top - low;
        if (change > maxChange) maxChange = change;
        const newTs = top - maxChange * (cfg.incr / 100);
        ts = Math.min(ts, newTs);
      }
    }

    // Break line on structure change
    if (structureChanged) {
      tsArr[i] = NaN;
    } else {
      tsArr[i] = isNaN(ts) ? NaN : ts;
    }
    osArr[i] = os;
  }

  const warmup = len * 2;

  // Trailing stop plot with color by direction
  const tsPlot = tsArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    return { time: bars[i].time, value: v, color: osArr[i] === 1 ? BULL_COLOR : BEAR_COLOR };
  });

  // Invisible close plot for fill anchor
  const closePlot = bars.map((b, i) => ({
    time: b.time,
    value: i < warmup || isNaN(tsArr[i]) ? NaN : b.close,
  }));

  // Dynamic fill colors
  const fillColors = bars.map((_b, i) => {
    if (i < warmup || isNaN(tsArr[i])) return 'transparent';
    if (osArr[i] === 1 && bars[i].close < tsArr[i]) return 'rgba(242,54,69,0.15)';
    if (osArr[i] === -1 && bars[i].close > tsArr[i]) return 'rgba(8,153,129,0.15)';
    return osArr[i] === 1 ? 'rgba(8,153,129,0.08)' : 'rgba(242,54,69,0.08)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      ts: tsPlot,
      closeLine: closePlot,
    },
    fills: [{ plot1: 'ts', plot2: 'closeLine', options: { color: 'rgba(8,153,129,0.08)' }, colors: fillColors }],
    markers,
  };
}

export const MarketStructureTrailingStop = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
