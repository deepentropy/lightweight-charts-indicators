/**
 * Relative Volatility Index (RVI) Indicator
 *
 * Measures volatility direction using standard deviation and EMA.
 * RVI = upper / (upper + lower) * 100
 * where upper = EMA of stddev when price rises, lower = EMA of stddev when price falls.
 * Includes SMA smoothing (enabled by default). BB bands excluded (display=none).
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar } from 'oakscriptjs';

export interface RelativeVolatilityIndexInputs {
  length: number;
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: RelativeVolatilityIndexInputs = {
  length: 10,
  maType: 'SMA',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RVI', color: '#7E57C2', lineWidth: 2 },
  { id: 'plot1', title: 'RVI-based MA', color: '#E2CC00', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#089981', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#089981', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Relative Volatility Index',
  shortTitle: 'RVI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RelativeVolatilityIndexInputs> = {}): IndicatorResult {
  const { length, maType, maLength, bbMult } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, b => b.close);
  const len = 14; // EMA smoothing length (hardcoded in PineScript)

  const stddevArr = ta.stdev(close, length).toArray();
  const changeArr: number[] = [NaN];
  for (let i = 1; i < bars.length; i++) {
    changeArr.push(bars[i].close - bars[i - 1].close);
  }

  const upperInput = new Series(bars, (_, i) => {
    const chg = changeArr[i];
    const std = stddevArr[i];
    if (isNaN(chg)) return NaN;
    return chg <= 0 ? 0 : (std ?? NaN);
  });
  const lowerInput = new Series(bars, (_, i) => {
    const chg = changeArr[i];
    const std = stddevArr[i];
    if (isNaN(chg)) return NaN;
    return chg > 0 ? 0 : (std ?? NaN);
  });

  const upperArr = ta.ema(upperInput, len).toArray();
  const lowerArr = ta.ema(lowerInput, len).toArray();

  // RVI = upper / (upper + lower) * 100
  const rviSeries = new Series(bars, (_, i) => {
    const u = upperArr[i], l = lowerArr[i];
    if (u == null || l == null || isNaN(u) || isNaN(l)) return NaN;
    const denom = u + l;
    return denom === 0 ? 0 : (u / denom) * 100;
  });

  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';

  let smoothingArr: (number | null)[] = bars.map(() => null);
  let bbUpperArr: (number | null)[] = bars.map(() => null);
  let bbLowerArr: (number | null)[] = bars.map(() => null);

  if (enableMA) {
    let maSeries: Series;
    switch (maType) {
      case 'EMA': maSeries = ta.ema(rviSeries, maLength); break;
      case 'SMMA (RMA)': maSeries = ta.rma(rviSeries, maLength); break;
      case 'WMA': maSeries = ta.wma(rviSeries, maLength); break;
      case 'VWMA': {
        const vol = new Series(bars, b => b.volume ?? 0);
        maSeries = ta.vwma(rviSeries, maLength, vol);
        break;
      }
      default: maSeries = ta.sma(rviSeries, maLength); break;
    }
    smoothingArr = maSeries.toArray();

    if (isBB) {
      const stdevArr = ta.stdev(rviSeries, maLength).toArray();
      bbUpperArr = smoothingArr.map((v, i) => (v != null && stdevArr[i] != null) ? v + stdevArr[i]! * bbMult : null);
      bbLowerArr = smoothingArr.map((v, i) => (v != null && stdevArr[i] != null) ? v - stdevArr[i]! * bbMult : null);
    }
  }

  const rviArr = rviSeries.toArray();
  const rviData = rviArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));
  const maData = smoothingArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));
  const bbUpperData = bbUpperArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));
  const bbLowerData = bbLowerArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

  const fills: FillData[] = [];
  if (isBB) {
    fills.push({ plot1: 'plot2', plot2: 'plot3', options: { color: '#089981', transp: 90, title: 'BB Background' } });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': rviData,
      'plot1': maData,
      'plot2': bbUpperData,
      'plot3': bbLowerData,
    },
    fills,
  };
}

export const RelativeVolatilityIndex = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
