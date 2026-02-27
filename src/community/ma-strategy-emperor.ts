/**
 * MA Strategy Emperor
 *
 * Multi-MA overlay with selectable MA type and crossover buy/sell signals.
 * Supports EMA, SMA, WMA, DEMA, Smoothed MA, Zero-Lag, Wilders,
 * Super Smoother, and McGuinley dynamic moving average types.
 *
 * Reference: TradingView "MA Strategy Emperor" by insiliconot
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface MAStrategyEmperorInputs {
  maType: string;
  len1: number;
  len2: number;
  len3: number;
  len4: number;
  len5: number;
  enable1: boolean;
  enable2: boolean;
  enable3: boolean;
  enable4: boolean;
  enable5: boolean;
}

export const defaultInputs: MAStrategyEmperorInputs = {
  maType: 'EMA',
  len1: 8,
  len2: 13,
  len3: 21,
  len4: 55,
  len5: 89,
  enable1: true,
  enable2: true,
  enable3: true,
  enable4: false,
  enable5: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'WMA', 'DEMA', 'Smoothed_MA', 'Zero_Lag', 'Wilders', 'Super_Smoother', 'McGuinley'] },
  { id: 'len1', type: 'int', title: 'MA 1 Length', defval: 8, min: 1 },
  { id: 'len2', type: 'int', title: 'MA 2 Length', defval: 13, min: 1 },
  { id: 'len3', type: 'int', title: 'MA 3 Length', defval: 21, min: 1 },
  { id: 'len4', type: 'int', title: 'MA 4 Length', defval: 55, min: 1 },
  { id: 'len5', type: 'int', title: 'MA 5 Length', defval: 89, min: 1 },
  { id: 'enable1', type: 'bool', title: 'Enable MA 1', defval: true },
  { id: 'enable2', type: 'bool', title: 'Enable MA 2', defval: true },
  { id: 'enable3', type: 'bool', title: 'Enable MA 3', defval: true },
  { id: 'enable4', type: 'bool', title: 'Enable MA 4', defval: false },
  { id: 'enable5', type: 'bool', title: 'Enable MA 5', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 1', color: '#44E2D6', lineWidth: 2 },
  { id: 'plot1', title: 'MA 2', color: '#DDD10D', lineWidth: 2 },
  { id: 'plot2', title: 'MA 3', color: '#0AA368', lineWidth: 2 },
  { id: 'plot3', title: 'MA 4', color: '#E0670E', lineWidth: 2 },
  { id: 'plot4', title: 'MA 5', color: '#AB40B2', lineWidth: 2 },
];

export const metadata = {
  title: 'MA Strategy Emperor',
  shortTitle: 'MAEmperor',
  overlay: true,
};

/**
 * Compute a moving average of the given type on raw source array.
 * Returns a number[] of the same length as src.
 */
function computeMA(bars: Bar[], src: number[], len: number, type: string): number[] {
  const n = src.length;
  const srcSeries = new Series(bars, (_, i) => src[i]);

  switch (type) {
    case 'SMA':
      return ta.sma(srcSeries, len).toArray().map(v => v ?? NaN);

    case 'EMA':
      return ta.ema(srcSeries, len).toArray().map(v => v ?? NaN);

    case 'WMA':
      return ta.wma(srcSeries, len).toArray().map(v => v ?? NaN);

    case 'DEMA': {
      const e1 = ta.ema(srcSeries, len).toArray();
      const e1Series = new Series(bars, (_, i) => e1[i] ?? NaN);
      const e2 = ta.ema(e1Series, len).toArray();
      return e1.map((v, i) => {
        const v1 = v ?? NaN;
        const v2 = e2[i] ?? NaN;
        return 2 * v1 - v2;
      });
    }

    case 'Smoothed_MA': {
      // sm = na(sm[1]) ? sma(src,len) : (sm[1]*(len-1)+src)/len
      const smaArr = ta.sma(srcSeries, len).toArray();
      const result: number[] = new Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        if (isNaN(result[i - 1] ?? NaN)) {
          result[i] = smaArr[i] ?? NaN;
        } else {
          result[i] = (result[i - 1] * (len - 1) + src[i]) / len;
        }
      }
      return result;
    }

    case 'Zero_Lag': {
      // d = src + (src - src[floor((len-1)/2)]), ema(d, len)
      const lag = Math.floor((len - 1) / 2);
      const d: number[] = new Array(n);
      for (let i = 0; i < n; i++) {
        const prev = i >= lag ? src[i - lag] : NaN;
        d[i] = src[i] + (src[i] - prev);
      }
      const dSeries = new Series(bars, (_, i) => d[i]);
      return ta.ema(dSeries, len).toArray().map(v => v ?? NaN);
    }

    case 'Wilders': {
      // WiMA = (src + WiMA[1]*(len-1))/len
      const result: number[] = new Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        if (isNaN(src[i])) continue;
        if (isNaN(result[i - 1] ?? NaN)) {
          // Seed with SMA
          if (i >= len - 1) {
            let sum = 0;
            for (let j = i - len + 1; j <= i; j++) sum += src[j];
            result[i] = sum / len;
          }
        } else {
          result[i] = (src[i] + result[i - 1] * (len - 1)) / len;
        }
      }
      return result;
    }

    case 'Super_Smoother': {
      // 2-pole Super Smoother filter
      const pi = Math.PI;
      const a1 = Math.exp(-1.414 * pi / len);
      const b1 = 2 * a1 * Math.cos(1.414 * pi / len);
      const c2 = b1;
      const c3 = -(a1 * a1);
      const c1 = 1 - c2 - c3;
      const result: number[] = new Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        if (isNaN(src[i])) continue;
        if (i < 2 || isNaN(result[i - 1]) || isNaN(result[i - 2])) {
          result[i] = src[i];
        } else {
          result[i] = c1 * (src[i] + src[i - 1]) / 2 + c2 * result[i - 1] + c3 * result[i - 2];
        }
      }
      return result;
    }

    case 'McGuinley': {
      // mg = mg[1] + (src - mg[1]) / (len * pow(src/mg[1], 4))
      const result: number[] = new Array(n).fill(NaN);
      for (let i = 0; i < n; i++) {
        if (isNaN(src[i])) continue;
        if (isNaN(result[i - 1] ?? NaN)) {
          result[i] = src[i];
        } else {
          const prev = result[i - 1];
          const ratio = src[i] / prev;
          result[i] = prev + (src[i] - prev) / (len * Math.pow(ratio, 4));
        }
      }
      return result;
    }

    default:
      return ta.ema(srcSeries, len).toArray().map(v => v ?? NaN);
  }
}

export function calculate(bars: Bar[], inputs: Partial<MAStrategyEmperorInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeArr = bars.map(b => b.close);
  const lengths = [cfg.len1, cfg.len2, cfg.len3, cfg.len4, cfg.len5];
  const enables = [cfg.enable1, cfg.enable2, cfg.enable3, cfg.enable4, cfg.enable5];

  // Compute all MAs
  const maArrays: number[][] = lengths.map(len => computeMA(bars, closeArr, len, cfg.maType));

  // Build plots
  const plots: Record<string, { time: number; value: number }[]> = {};
  for (let p = 0; p < 5; p++) {
    const key = `plot${p}`;
    plots[key] = maArrays[p].map((v, i) => ({
      time: bars[i].time,
      value: enables[p] ? v : NaN,
    }));
  }

  // Buy/Sell signals: crossover/crossunder of MA2 and MA3
  const markers: MarkerData[] = [];
  const ma2 = maArrays[1]; // MA2
  const ma3 = maArrays[2]; // MA3

  for (let i = 1; i < n; i++) {
    if (isNaN(ma2[i]) || isNaN(ma3[i]) || isNaN(ma2[i - 1]) || isNaN(ma3[i - 1])) continue;

    // Buy: crossover(MA2, MA3)
    if (ma2[i - 1] <= ma3[i - 1] && ma2[i] > ma3[i]) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#00FF00', text: 'P' });
    }
    // Sell: crossunder(MA2, MA3)
    if (ma2[i - 1] >= ma3[i - 1] && ma2[i] < ma3[i]) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#FF0000', text: 'N' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    markers,
  };
}

export const MAStrategyEmperor = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
