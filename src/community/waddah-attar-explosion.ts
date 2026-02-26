/**
 * Waddah Attar Explosion V2
 *
 * MACD derivative scaled by sensitivity + Bollinger Band width as explosion threshold.
 * trendUp/trendDown = delta of MACD * sensitivity (positive/negative).
 * Explosion line = BB upper - BB lower.
 * Dead zone = RMA(TR, 100) * 3.7.
 *
 * Reference: TradingView "Waddah Attar Explosion V2 [SHK]" by LazyBear/ShayanKM
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface WaddahAttarExplosionInputs {
  sensitivity: number;
  fastLength: number;
  slowLength: number;
  channelLength: number;
  bbMult: number;
}

export const defaultInputs: WaddahAttarExplosionInputs = {
  sensitivity: 150,
  fastLength: 20,
  slowLength: 40,
  channelLength: 20,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'sensitivity', type: 'int', title: 'Sensitivity', defval: 150, min: 1 },
  { id: 'fastLength', type: 'int', title: 'Fast EMA Length', defval: 20, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA Length', defval: 40, min: 1 },
  { id: 'channelLength', type: 'int', title: 'BB Channel Length', defval: 20, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB Stdev Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Up Trend', color: '#26A69A', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Down Trend', color: '#EF5350', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: 'Explosion Line', color: '#A0522D', lineWidth: 2 },
  { id: 'plot3', title: 'Dead Zone', color: '#2962FF', lineWidth: 1, style: 'cross' },
];

export const metadata = {
  title: 'Waddah Attar Explosion',
  shortTitle: 'WAE',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<WaddahAttarExplosionInputs> = {}): IndicatorResult {
  const { sensitivity, fastLength, slowLength, channelLength, bbMult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = new Series(bars, (b) => b.close);

  // MACD = fastEMA - slowEMA
  const fastEma = ta.ema(close, fastLength).toArray();
  const slowEma = ta.ema(close, slowLength).toArray();

  // BB width
  const [, bbUpper, bbLower] = ta.bb(close, channelLength, bbMult);
  const bbUpperArr = bbUpper.toArray();
  const bbLowerArr = bbLower.toArray();

  // Dead zone = RMA(TR, 100) * 3.7
  const deadZonePeriod = 100;
  const deadZoneArr = ta.rma(ta.tr(bars), deadZonePeriod).toArray();

  const warmup = Math.max(slowLength, channelLength, deadZonePeriod);

  const plot0: Array<{ time: number; value: number; color?: string }> = [];
  const plot1: Array<{ time: number; value: number; color?: string }> = [];
  const plot2: Array<{ time: number; value: number }> = [];
  const plot3: Array<{ time: number; value: number }> = [];

  let prevT1 = 0;
  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const w = i < warmup;

    const macd = (fastEma[i] ?? 0) - (slowEma[i] ?? 0);
    const prevMacd = i > 0 ? ((fastEma[i - 1] ?? 0) - (slowEma[i - 1] ?? 0)) : 0;
    const t1 = (macd - prevMacd) * sensitivity;
    const e1 = (bbUpperArr[i] ?? 0) - (bbLowerArr[i] ?? 0);
    const dz = (deadZoneArr[i] ?? 0) * 3.7;

    const upVal = w ? NaN : (t1 >= 0 ? t1 : 0);
    const dnVal = w ? NaN : (t1 < 0 ? -t1 : 0);

    // Dynamic colors: lime/green for up, orange/red for down (fading = decreasing)
    const upColor = t1 < prevT1 ? '#00FF00' : '#008000';
    const dnColor = -t1 < -prevT1 ? '#FFA500' : '#FF0000';

    plot0.push({ time: t, value: upVal, color: w ? undefined : upColor });
    plot1.push({ time: t, value: dnVal, color: w ? undefined : dnColor });
    plot2.push({ time: t, value: w ? NaN : e1 });
    plot3.push({ time: t, value: w ? NaN : dz });
    prevT1 = t1;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
  };
}

export const WaddahAttarExplosion = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
