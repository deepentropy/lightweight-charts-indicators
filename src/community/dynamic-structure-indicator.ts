/**
 * Dynamic Structure Indicator
 *
 * ATR(14)-based S/R zone detection using fractal swing highs/lows.
 * Zones are defined by wick-to-body range, filtered by maxZoneSize * ATR.
 * Potential zones must see significant price movement (atrMovement * ATR)
 * before becoming active. Active zones get resistance and support plot pairs.
 * Previous zones (flipped S/R) are also plotted. Zone violation resets.
 *
 * Reference: TradingView "Dynamic Structure Indicator" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface DynamicStructureIndicatorInputs {
  atrMovement: number;
  lookback: number;
  maxZoneSize: number;
  newStructureReset: number;
  drawPreviousStructure: boolean;
}

export const defaultInputs: DynamicStructureIndicatorInputs = {
  atrMovement: 1.0,
  lookback: 25,
  maxZoneSize: 2.5,
  newStructureReset: 25,
  drawPreviousStructure: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrMovement', type: 'float', title: 'ATR Movement', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 25, min: 1 },
  { id: 'maxZoneSize', type: 'float', title: 'Max Zone Size (ATR)', defval: 2.5, min: 0.1, step: 0.1 },
  { id: 'newStructureReset', type: 'int', title: 'New Structure Reset', defval: 25, min: 1 },
  { id: 'drawPreviousStructure', type: 'bool', title: 'Draw Previous Structure', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'r1', title: 'Resistance 1', color: '#EF5350', lineWidth: 1 },
  { id: 'r2', title: 'Resistance 2', color: '#EF5350', lineWidth: 1 },
  { id: 's1', title: 'Support 1', color: '#26A69A', lineWidth: 1 },
  { id: 's2', title: 'Support 2', color: '#26A69A', lineWidth: 1 },
  { id: 'pr1', title: 'Prev Resistance 1', color: '#26A69A', lineWidth: 1 },
  { id: 'pr2', title: 'Prev Resistance 2', color: '#26A69A', lineWidth: 1 },
  { id: 'ps1', title: 'Prev Support 1', color: '#EF5350', lineWidth: 1 },
  { id: 'ps2', title: 'Prev Support 2', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'Dynamic Structure Indicator',
  shortTitle: 'DSI',
  overlay: true,
};

interface Zone {
  top: number;    // upper boundary (wick)
  bottom: number; // lower boundary (body)
  startIdx: number;
  active: boolean;
  potential: boolean; // waiting for ATR movement confirmation
  potentialHigh: number;
  potentialLow: number;
}

export function calculate(bars: Bar[], inputs: Partial<DynamicStructureIndicatorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lb = cfg.lookback;

  const atrArr = ta.atr(bars, 14).toArray();

  // Output arrays
  const r1Arr: number[] = new Array(n).fill(NaN);
  const r2Arr: number[] = new Array(n).fill(NaN);
  const s1Arr: number[] = new Array(n).fill(NaN);
  const s2Arr: number[] = new Array(n).fill(NaN);
  const pr1Arr: number[] = new Array(n).fill(NaN);
  const pr2Arr: number[] = new Array(n).fill(NaN);
  const ps1Arr: number[] = new Array(n).fill(NaN);
  const ps2Arr: number[] = new Array(n).fill(NaN);

  // Active zones
  let resZone: Zone | null = null;
  let supZone: Zone | null = null;
  let prevResZone: Zone | null = null;
  let prevSupZone: Zone | null = null;

  // Helper: rolling highest/lowest
  function highest(arr: Bar[], idx: number, period: number, field: 'high' | 'low' | 'close'): number {
    let max = -Infinity;
    const start = Math.max(0, idx - period + 1);
    for (let j = start; j <= idx; j++) max = Math.max(max, arr[j][field]);
    return max;
  }
  function lowest(arr: Bar[], idx: number, period: number, field: 'high' | 'low' | 'close'): number {
    let min = Infinity;
    const start = Math.max(0, idx - period + 1);
    for (let j = start; j <= idx; j++) min = Math.min(min, arr[j][field]);
    return min;
  }

  const warmup = Math.max(14, lb + 1);

  for (let i = warmup; i < n; i++) {
    const atr = atrArr[i] ?? 0;
    if (atr === 0) continue;

    const close = bars[i].close;
    const high = bars[i].high;
    const low = bars[i].low;

    // Fractal swing high detection:
    // high[1] == highest(high, lookback) at [1] AND high < high[1]
    if (i >= 2) {
      const prevHigh = bars[i - 1].high;
      const highestHigh = highest(bars, i - 1, lb, 'high');

      if (prevHigh === highestHigh && high < prevHigh) {
        // Swing high found at bar i-1
        const wickTop = bars[i - 1].high;
        const bodyTop = Math.max(bars[i - 1].open, bars[i - 1].close);
        const zoneSize = wickTop - bodyTop;

        if (zoneSize <= cfg.maxZoneSize * atr && zoneSize > 0) {
          // Create potential resistance zone
          const zone: Zone = {
            top: wickTop,
            bottom: bodyTop,
            startIdx: i - 1,
            active: false,
            potential: true,
            potentialHigh: high,
            potentialLow: low,
          };

          // Save current resistance as previous if it exists
          if (resZone && resZone.active && cfg.drawPreviousStructure) {
            prevSupZone = { ...resZone, active: true, potential: false, potentialHigh: 0, potentialLow: 0 };
          }
          resZone = zone;
        }
      }

      // Fractal swing low detection:
      // low[1] == lowest(low, lookback) at [1] AND low > low[1]
      const prevLow = bars[i - 1].low;
      const lowestLow = lowest(bars, i - 1, lb, 'low');

      if (prevLow === lowestLow && low > prevLow) {
        // Swing low found at bar i-1
        const wickBottom = bars[i - 1].low;
        const bodyBottom = Math.min(bars[i - 1].open, bars[i - 1].close);
        const zoneSize = bodyBottom - wickBottom;

        if (zoneSize <= cfg.maxZoneSize * atr && zoneSize > 0) {
          // Create potential support zone
          const zone: Zone = {
            top: bodyBottom,
            bottom: wickBottom,
            startIdx: i - 1,
            active: false,
            potential: true,
            potentialHigh: high,
            potentialLow: low,
          };

          // Save current support as previous if it exists
          if (supZone && supZone.active && cfg.drawPreviousStructure) {
            prevResZone = { ...supZone, active: true, potential: false, potentialHigh: 0, potentialLow: 0 };
          }
          supZone = zone;
        }
      }
    }

    // Check potential zones for ATR movement confirmation
    if (resZone && resZone.potential) {
      resZone.potentialLow = Math.min(resZone.potentialLow, low);
      if (resZone.top - resZone.potentialLow >= cfg.atrMovement * atr) {
        resZone.active = true;
        resZone.potential = false;
      }
      // Reset if too many bars without confirmation
      if (i - resZone.startIdx > cfg.newStructureReset && !resZone.active) {
        resZone = null;
      }
    }

    if (supZone && supZone.potential) {
      supZone.potentialHigh = Math.max(supZone.potentialHigh, high);
      if (supZone.potentialHigh - supZone.bottom >= cfg.atrMovement * atr) {
        supZone.active = true;
        supZone.potential = false;
      }
      // Reset if too many bars without confirmation
      if (i - supZone.startIdx > cfg.newStructureReset && !supZone.active) {
        supZone = null;
      }
    }

    // Zone violation checks
    if (resZone && resZone.active && close > resZone.top) {
      // Resistance violated - becomes previous support
      if (cfg.drawPreviousStructure) {
        prevSupZone = { ...resZone };
      }
      resZone = null;
    }

    if (supZone && supZone.active && close < supZone.bottom) {
      // Support violated - becomes previous resistance
      if (cfg.drawPreviousStructure) {
        prevResZone = { ...supZone };
      }
      supZone = null;
    }

    // Previous zone violations
    if (prevResZone && close < prevResZone.bottom) {
      prevResZone = null;
    }
    if (prevSupZone && close > prevSupZone.top) {
      prevSupZone = null;
    }

    // Output active zone levels
    if (resZone && resZone.active) {
      r1Arr[i] = resZone.top;
      r2Arr[i] = resZone.bottom;
    }
    if (supZone && supZone.active) {
      s1Arr[i] = supZone.top;
      s2Arr[i] = supZone.bottom;
    }

    // Output previous zone levels (flipped S/R)
    if (cfg.drawPreviousStructure) {
      if (prevResZone && prevResZone.active) {
        // Previous support turned resistance
        ps1Arr[i] = prevResZone.top;
        ps2Arr[i] = prevResZone.bottom;
      }
      if (prevSupZone && prevSupZone.active) {
        // Previous resistance turned support
        pr1Arr[i] = prevSupZone.top;
        pr2Arr[i] = prevSupZone.bottom;
      }
    }
  }

  const makePlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: isNaN(v) ? NaN : v }));

  // Fill colors
  const resFillColors = bars.map((_b, i) => {
    if (isNaN(r1Arr[i]) || isNaN(r2Arr[i])) return 'transparent';
    return bars[i].close > r2Arr[i] ? 'rgba(239,83,80,0.08)' : 'rgba(239,83,80,0.15)';
  });

  const supFillColors = bars.map((_b, i) => {
    if (isNaN(s1Arr[i]) || isNaN(s2Arr[i])) return 'transparent';
    return bars[i].close < s1Arr[i] ? 'rgba(38,166,154,0.08)' : 'rgba(38,166,154,0.15)';
  });

  const prevResFillColors = bars.map((_b, i) => {
    if (isNaN(ps1Arr[i]) || isNaN(ps2Arr[i])) return 'transparent';
    return 'rgba(239,83,80,0.06)';
  });

  const prevSupFillColors = bars.map((_b, i) => {
    if (isNaN(pr1Arr[i]) || isNaN(pr2Arr[i])) return 'transparent';
    return 'rgba(38,166,154,0.06)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      r1: makePlot(r1Arr),
      r2: makePlot(r2Arr),
      s1: makePlot(s1Arr),
      s2: makePlot(s2Arr),
      pr1: makePlot(pr1Arr),
      pr2: makePlot(pr2Arr),
      ps1: makePlot(ps1Arr),
      ps2: makePlot(ps2Arr),
    },
    fills: [
      { plot1: 'r1', plot2: 'r2', options: { color: 'rgba(239,83,80,0.15)' }, colors: resFillColors },
      { plot1: 's1', plot2: 's2', options: { color: 'rgba(38,166,154,0.15)' }, colors: supFillColors },
      { plot1: 'ps1', plot2: 'ps2', options: { color: 'rgba(239,83,80,0.06)' }, colors: prevResFillColors },
      { plot1: 'pr1', plot2: 'pr2', options: { color: 'rgba(38,166,154,0.06)' }, colors: prevSupFillColors },
    ],
  };
}

export const DynamicStructureIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
