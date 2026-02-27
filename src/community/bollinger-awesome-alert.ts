/**
 * Bollinger Awesome Alert R1.1 by JustUncleL
 *
 * Overlay=true: Bollinger Bands on price (basis/upper/lower with fill),
 * plus a fast EMA line. Buy/Sell signals when fast EMA crosses BB basis
 * combined with Awesome Oscillator direction.
 *
 * Pine plots:
 *   plot0: bb_basis (red, linewidth 2)
 *   plot1: bb_upper (blue, linewidth 1)  -- "ubi"
 *   plot2: bb_lower (blue, linewidth 1)  -- "lbi"
 *   plot3: bb_sqz_upper (hidden, transp 100)  -- "usqzi"
 *   plot4: bb_sqz_lower (hidden, transp 100)  -- "lsqzi"
 *   plot5: fast_ma (black, linewidth 2)
 *
 * Pine fills:
 *   fill(ubi, lbi) -- center channel, silver transp 90
 *   fill(ubi, usqzi) -- squeeze band upper, dynamic white/blue transp 50
 *   fill(lbi, lsqzi) -- squeeze band lower, dynamic white/blue transp 50
 *
 * Pine plotshape:
 *   break_down -> arrowDown aboveBar red "Sell"
 *   break_up   -> arrowUp belowBar green "Buy"
 *
 * Reference: TradingView "Bollinger Awesome Alert R1.1 by JustUncleL"
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface BollingerAwesomeAlertInputs {
  bbUseEma: boolean;
  bbFilter: boolean;
  sqzFilter: boolean;
  bbLength: number;
  bbMult: number;
  fastMaLen: number;
  aoSlow: number;
  aoFast: number;
  sqzLength: number;
  sqzThreshold: number;
}

export const defaultInputs: BollingerAwesomeAlertInputs = {
  bbUseEma: false,
  bbFilter: false,
  sqzFilter: false,
  bbLength: 20,
  bbMult: 2.0,
  fastMaLen: 3,
  aoSlow: 34,
  aoFast: 5,
  sqzLength: 100,
  sqzThreshold: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'bbUseEma', type: 'bool', title: 'Use EMA for Bollinger Band', defval: false },
  { id: 'bbFilter', type: 'bool', title: 'Filter Buy/Sell with BB', defval: false },
  { id: 'sqzFilter', type: 'bool', title: 'Filter Buy/Sell with BB squeeze', defval: false },
  { id: 'bbLength', type: 'int', title: 'Bollinger Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'Base Multiplier', defval: 2.0, min: 0.5, step: 0.1 },
  { id: 'fastMaLen', type: 'int', title: 'Fast EMA length', defval: 3, min: 2 },
  { id: 'aoSlow', type: 'int', title: 'Awesome Length Slow', defval: 34, min: 1 },
  { id: 'aoFast', type: 'int', title: 'Awesome Length Fast', defval: 5, min: 1 },
  { id: 'sqzLength', type: 'int', title: 'BB Relative Squeeze Length', defval: 100, min: 5 },
  { id: 'sqzThreshold', type: 'int', title: 'BB Squeeze Threshold %', defval: 50, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis Line', color: '#F44336', lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band Inner', color: '#2196F3', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band Inner', color: '#2196F3', lineWidth: 1 },
  { id: 'plot3', title: 'Hide Sqz Upper', color: '#FFFFFF', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Hide Sqz Lower', color: '#FFFFFF', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Fast EMA', color: '#000000', lineWidth: 2 },
];

export const metadata = {
  title: 'Bollinger Awesome Alert R1.1',
  shortTitle: 'BBAWE',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<BollingerAwesomeAlertInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { bbUseEma, bbFilter, sqzFilter, bbLength, bbMult, fastMaLen, aoSlow, aoFast, sqzLength, sqzThreshold } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, 'close');

  // BB basis: EMA or SMA
  const bbBasis = bbUseEma ? ta.ema(source, bbLength) : ta.sma(source, bbLength);
  const dev = ta.stdev(source, bbLength).mul(bbMult);
  const bbUpper = bbBasis.add(dev);
  const bbLower = bbBasis.sub(dev);

  // Fast EMA
  const fastMa = ta.ema(source, fastMaLen);

  // ATR(14) for squeeze band offset
  const atr14 = ta.atr(bars, 14);
  const atr14Arr = atr14.toArray();

  const basisArr = bbBasis.toArray();
  const upperArr = bbUpper.toArray();
  const lowerArr = bbLower.toArray();
  const fastArr = fastMa.toArray();

  // Awesome Oscillator: SMA(hl2, fast) - SMA(hl2, slow)
  const hl2 = getSourceSeries(bars, 'hl2');
  const aoSeries = ta.sma(hl2, aoFast).sub(ta.sma(hl2, aoSlow));
  const aoArr = aoSeries.toArray();

  // AO direction: >= 0 ? (rising ? 1 : 2) : (rising ? -1 : -2)
  const aoDir: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const cur = aoArr[i];
    const prev = i > 0 ? aoArr[i - 1] : null;
    if (cur == null || prev == null) {
      aoDir[i] = 0;
      continue;
    }
    if (cur >= 0) {
      aoDir[i] = cur > prev ? 1 : 2;
    } else {
      aoDir[i] = cur > prev ? -1 : -2;
    }
  }

  // BB spread and squeeze
  const spreadArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const u = upperArr[i];
    const l = lowerArr[i];
    spreadArr[i] = (u != null && l != null) ? u - l : 0;
  }
  const avgSpread: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < sqzLength - 1) { avgSpread[i] = 0; continue; }
    let sum = 0;
    for (let j = 0; j < sqzLength; j++) sum += spreadArr[i - j];
    avgSpread[i] = sum / sqzLength;
  }
  const bbSqueeze: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    bbSqueeze[i] = avgSpread[i] !== 0 ? (spreadArr[i] / avgSpread[i]) * 100 : 0;
  }

  // Calculate squeeze band offsets: bb_offset = atr(14) * 0.5
  // bb_sqz_upper = bb_upper + bb_offset, bb_sqz_lower = bb_lower - bb_offset
  const sqzUpperArr: number[] = new Array(n);
  const sqzLowerArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const offset = (atr14Arr[i] ?? 0) * 0.5;
    const u = upperArr[i];
    const l = lowerArr[i];
    sqzUpperArr[i] = u != null ? u + offset : NaN;
    sqzLowerArr[i] = l != null ? l - offset : NaN;
  }

  const warmup = Math.max(bbLength, aoSlow);

  const plot0 = basisArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));
  const plot1 = upperArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));
  const plot2 = lowerArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));
  const plot3 = sqzUpperArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));
  const plot4 = sqzLowerArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || isNaN(v)) ? NaN : v,
  }));
  const plot5 = fastArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < fastMaLen || v == null) ? NaN : v,
  }));

  // Dynamic squeeze fill colors: white when bb_squeeze > threshold, blue when not
  // Pine: fill(ubi, usqzi, color=bb_squeeze > sqz_threshold ? color.white : color.blue, transp=50)
  // Pine: fill(lbi, lsqzi, color=bb_squeeze > sqz_threshold ? color.white : color.blue, transp=50)
  const sqzFillColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      sqzFillColors[i] = 'rgba(0,0,0,0)';
    } else if (bbSqueeze[i] > sqzThreshold) {
      sqzFillColors[i] = 'rgba(255,255,255,0.50)'; // white transp 50
    } else {
      sqzFillColors[i] = 'rgba(33,150,243,0.50)';  // blue transp 50
    }
  }

  // Buy/Sell signals
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const fastCur = fastArr[i];
    const fastPrev = fastArr[i - 1];
    const basisCur = basisArr[i];
    const basisPrev = basisArr[i - 1];
    const closeCur = bars[i].close;

    if (fastCur == null || fastPrev == null || basisCur == null || basisPrev == null) continue;

    // crossover(fast_ma, bb_basis): fast was <= basis, now >
    const crossUp = fastPrev <= basisPrev && fastCur > basisCur;
    // crossunder(fast_ma, bb_basis): fast was >= basis, now <
    const crossDown = fastPrev >= basisPrev && fastCur < basisCur;

    // Buy: crossover + close > basis + AO direction rising (|AO| == 1)
    // + optional bb_filter (close < upper) + optional sqz_filter (squeeze > threshold)
    if (crossUp && closeCur > basisCur && Math.abs(aoDir[i]) === 1) {
      if (!bbFilter || closeCur < (upperArr[i] ?? Infinity)) {
        if (!sqzFilter || bbSqueeze[i] > sqzThreshold) {
          markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#4CAF50', text: 'Buy' });
        }
      }
    }

    // Sell: crossunder + close < basis + AO direction falling (|AO| == 2)
    // + optional bb_filter (close > lower) + optional sqz_filter (squeeze > threshold)
    if (crossDown && closeCur < basisCur && Math.abs(aoDir[i]) === 2) {
      if (!bbFilter || closeCur > (lowerArr[i] ?? -Infinity)) {
        if (!sqzFilter || bbSqueeze[i] > sqzThreshold) {
          markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#F44336', text: 'Sell' });
        }
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4, 'plot5': plot5 },
    fills: [
      // fill(ubi, lbi) -- center channel silver transp 90
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(192,192,192,0.10)' } },
      // fill(ubi, usqzi) -- squeeze indication upper band, dynamic white/blue transp 50
      { plot1: 'plot1', plot2: 'plot3', options: { color: 'rgba(33,150,243,0.50)' }, colors: sqzFillColors },
      // fill(lbi, lsqzi) -- squeeze indication lower band, dynamic white/blue transp 50
      { plot1: 'plot2', plot2: 'plot4', options: { color: 'rgba(33,150,243,0.50)' }, colors: sqzFillColors },
    ],
    markers,
  };
}

export const BollingerAwesomeAlert = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
