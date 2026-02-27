/**
 * Moving Average Deviation Rate
 *
 * Measures how far price deviates from its MA as a percentage.
 * deviation_rate = (source - ma) / ma * 100
 *
 * Reference: TradingView "Moving Average Deviation Rate" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MADeviationRateInputs {
  length: number;
  numStdDev: number;
  maType: string;
  src: SourceType;
}

export const defaultInputs: MADeviationRateInputs = {
  length: 21,
  numStdDev: 2,
  maType: 'sma',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Moving average period', defval: 21, min: 1 },
  { id: 'numStdDev', type: 'int', title: 'Number of Std Deviations', defval: 2, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'sma', options: ['sma', 'ema', 'wma'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Deviation Rate', color: '#EF5350', lineWidth: 1 },
  { id: 'plot1', title: 'Center', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: 'HiBound', color: 'rgba(255,255,255,0.7)', lineWidth: 1 },
  { id: 'plot3', title: 'LoBound', color: 'rgba(255,255,255,0.7)', lineWidth: 1 },
];

export const hlineConfig = [
  { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
];

export const metadata = {
  title: 'Moving Average Deviation Rate',
  shortTitle: 'MADR',
  overlay: false,
};

function applyMA(src: Series, length: number, maType: string): number[] {
  switch (maType) {
    case 'ema': return ta.ema(src, length).toArray();
    case 'wma': return ta.wma(src, length).toArray();
    default: return ta.sma(src, length).toArray();
  }
}

export function calculate(bars: Bar[], inputs: Partial<MADeviationRateInputs> = {}): IndicatorResult {
  const { length, numStdDev, maType, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();
  const n = bars.length;

  const maArr = applyMA(srcSeries, length, maType);

  // deviation rate = close / sma * 100 - 100
  const rateArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const maVal = maArr[i];
    if (i < length || !maVal || maVal === 0) { rateArr[i] = NaN; continue; }
    rateArr[i] = (srcArr[i] ?? 0) / maVal * 100 - 100;
  }

  // stdCenter = SMA(rate, length * numStdDev), std = STDEV(rate, length * numStdDev)
  const devPeriod = length * numStdDev;
  const rateSeries = Series.fromArray(bars, rateArr);
  const stdCenterArr = ta.sma(rateSeries, devPeriod).toArray();
  const stdArr = ta.stdev(rateSeries, devPeriod).toArray();

  const warmup = length + devPeriod;

  const plusDevArr: number[] = new Array(n);
  const minusDevArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const center = stdCenterArr[i];
    const std = stdArr[i];
    if (i < warmup || isNaN(center) || isNaN(std)) {
      plusDevArr[i] = NaN;
      minusDevArr[i] = NaN;
    } else {
      plusDevArr[i] = center + std * numStdDev;
      minusDevArr[i] = center - std * numStdDev;
    }
  }

  // Dynamic fill colors: rate > plusDev → red, rate < minusDev → lime, else transparent
  const hiFillColors: string[] = new Array(n);
  const loFillColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    hiFillColors[i] = (!isNaN(rateArr[i]) && !isNaN(plusDevArr[i]) && rateArr[i] > plusDevArr[i])
      ? 'rgba(252, 3, 3, 0.5)' : 'rgba(128, 128, 128, 0)';
    loFillColors[i] = (!isNaN(rateArr[i]) && !isNaN(minusDevArr[i]) && rateArr[i] < minusDevArr[i])
      ? 'rgba(0, 255, 0, 0.5)' : 'rgba(128, 128, 128, 0)';
  }

  const plot0 = rateArr.map((v, i) => ({ time: bars[i].time, value: isNaN(v) ? NaN : v }));
  const plot1 = stdCenterArr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || isNaN(v)) ? NaN : v }));
  const plot2 = plusDevArr.map((v, i) => ({ time: bars[i].time, value: isNaN(v) ? NaN : v }));
  const plot3 = minusDevArr.map((v, i) => ({ time: bars[i].time, value: isNaN(v) ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(128, 128, 128, 0.1)' } },
      { plot1: 'plot1', plot2: 'plot3', options: { color: 'rgba(128, 128, 128, 0.1)' } },
      { plot1: 'plot0', plot2: 'plot2', options: { color: 'rgba(252, 3, 3, 0.3)' }, colors: hiFillColors },
      { plot1: 'plot0', plot2: 'plot3', options: { color: 'rgba(0, 255, 0, 0.3)' }, colors: loFillColors },
    ],
  };
}

export const MADeviationRate = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
