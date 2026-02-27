/**
 * Moving Average Shift
 *
 * MA with configurable offset (shifted forward or backward in time).
 *
 * Reference: TradingView "Moving Average Shift" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData, PlotCandleData } from '../types';

export interface MAShiftInputs {
  length: number;
  maType: string;
  offset: number;
  src: SourceType;
}

export const defaultInputs: MAShiftInputs = {
  length: 20,
  maType: 'sma',
  offset: 0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'sma', options: ['sma', 'ema', 'wma'] },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#2962FF', lineWidth: 2 },
  { id: 'osc', title: 'Oscillator', color: '#787B86', lineWidth: 1, style: 'columns' },
  { id: 'oscTop', title: 'Osc Top', color: 'transparent', lineWidth: 0 },
  { id: 'oscZero', title: 'Osc Zero', color: 'transparent', lineWidth: 0 },
  { id: 'oscBot', title: 'Osc Bottom', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Moving Average Shift',
  shortTitle: 'MAS',
  overlay: true,
};

function applyMA(src: Series, length: number, maType: string): number[] {
  switch (maType) {
    case 'ema': return ta.ema(src, length).toArray();
    case 'wma': return ta.wma(src, length).toArray();
    default: return ta.sma(src, length).toArray();
  }
}

export function calculate(bars: Bar[], inputs: Partial<MAShiftInputs> = {}): IndicatorResult {
  const { length, maType, offset, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);
  const n = bars.length;

  const maArr = applyMA(srcSeries, length, maType);

  const plot = bars.map((_bar, i) => {
    const srcIdx = i - offset;
    const val = srcIdx >= 0 && srcIdx < n && srcIdx >= length ? (maArr[srcIdx] ?? NaN) : NaN;
    return { time: bars[i].time, value: val };
  });

  // barcolor: color bars based on source >= MA (Pine: barcolor(color) where color = source >= MA ? bullCol : bearCol)
  const srcArr = srcSeries.toArray();
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    const srcIdx = i - offset;
    const maVal = srcIdx >= 0 && srcIdx < n && srcIdx >= length ? (maArr[srcIdx] ?? NaN) : NaN;
    if (!isNaN(maVal)) {
      barColors.push({
        time: bars[i].time,
        color: (srcArr[i] ?? 0) >= maVal ? '#17a297' : '#FF9800',
      });
    }
  }

  // plotcandle: overlay candles colored by trend (Pine: plotcandle(open,high,low,close,color=color,...))
  const candles: PlotCandleData[] = [];
  for (let i = 0; i < n; i++) {
    const srcIdx = i - offset;
    const maVal = srcIdx >= 0 && srcIdx < n && srcIdx >= length ? (maArr[srcIdx] ?? NaN) : NaN;
    if (!isNaN(maVal)) {
      const col = (srcArr[i] ?? 0) >= maVal ? '#17a297' : '#FF9800';
      candles.push({
        time: bars[i].time,
        open: bars[i].open,
        high: bars[i].high,
        low: bars[i].low,
        close: bars[i].close,
        color: col,
        borderColor: col,
        wickColor: col,
      });
    }
  }

  // markers: diamond shapes on oscillator crossover signals
  // Pine: osc = hma(change(diff/perc_r, osc_len), 10) with sig_up/sig_dn on crossover/crossunder of osc vs osc[2]
  // Simplified: use diff = source - MA, then approximate the oscillator direction
  const markers: MarkerData[] = [];
  const diffArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const srcIdx = i - offset;
    const maVal = srcIdx >= 0 && srcIdx < n && srcIdx >= length ? (maArr[srcIdx] ?? NaN) : NaN;
    diffArr[i] = !isNaN(maVal) ? (srcArr[i] ?? 0) - maVal : NaN;
  }
  // Compute change of diff over osc_len=15 bars, smoothed with HMA(10)
  const changeArr: number[] = new Array(n);
  const oscLen = 15;
  for (let i = 0; i < n; i++) {
    if (i >= oscLen && !isNaN(diffArr[i]) && !isNaN(diffArr[i - oscLen]) && diffArr[i - oscLen] !== 0) {
      // Normalize by a rolling percentile proxy (max abs diff over lookback)
      let maxAbsDiff = 0;
      for (let j = Math.max(0, i - 100); j <= i; j++) {
        if (!isNaN(diffArr[j])) maxAbsDiff = Math.max(maxAbsDiff, Math.abs(diffArr[j]));
      }
      const normDiff = maxAbsDiff > 0 ? diffArr[i] / maxAbsDiff : 0;
      const normDiffPrev = maxAbsDiff > 0 ? diffArr[i - oscLen] / maxAbsDiff : 0;
      changeArr[i] = normDiff - normDiffPrev;
    } else {
      changeArr[i] = NaN;
    }
  }
  const changeSeries = Series.fromArray(bars, changeArr);
  const oscArr = ta.hma(changeSeries, 10).toArray();
  const oscThreshold = 0.5;
  for (let i = 2; i < n; i++) {
    const osc = oscArr[i] ?? NaN;
    const osc2 = oscArr[i - 2] ?? NaN;
    const prevOsc = oscArr[i - 1] ?? NaN;
    const prevOsc2 = oscArr[i - 3] ?? NaN;
    if (isNaN(osc) || isNaN(osc2) || isNaN(prevOsc)) continue;
    // crossover(osc, osc[2]) and osc < -threshold -> sig_up (diamond below bar)
    if (prevOsc <= prevOsc2 && osc > osc2 && osc < -oscThreshold) {
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'diamond',
        color: '#1dd1c2',
        text: 'Up',
      });
    }
    // crossunder(osc, osc[2]) and osc > threshold -> sig_dn (diamond above bar)
    if (prevOsc >= prevOsc2 && osc < osc2 && osc > oscThreshold) {
      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'diamond',
        color: '#FFEB3B',
        text: 'Dn',
      });
    }
  }

  // Build oscillator plots for fills
  const oscPlot = oscArr.map((v, i) => {
    const val = v ?? NaN;
    if (isNaN(val)) return { time: bars[i].time, value: NaN };
    // Color per Pine: osc > 0 ? (rising ? up1 : up2) : (falling ? dn1 : dn2)
    const prev = oscArr[i - 1] ?? NaN;
    let col: string;
    if (val > 0) col = val > prev ? '#1dd1c2' : '#17a297';
    else col = val < prev ? '#FFEB3B' : '#FF9800';
    return { time: bars[i].time, value: val, color: col };
  });
  const oscTopPlot = bars.map(b => ({ time: b.time, value: oscThreshold }));
  const oscZeroPlot = bars.map(b => ({ time: b.time, value: 0 }));
  const oscBotPlot = bars.map(b => ({ time: b.time, value: -oscThreshold }));

  // Dynamic fill colors between threshold and zero (gradient effect)
  const topFillColors: string[] = new Array(n);
  const botFillColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const val = oscArr[i] ?? NaN;
    const prev = oscArr[i - 1] ?? NaN;
    if (isNaN(val)) {
      topFillColors[i] = 'rgba(0,0,0,0)';
      botFillColors[i] = 'rgba(0,0,0,0)';
    } else {
      const col = val > 0
        ? (val > prev ? 'rgba(29, 209, 194, 0.3)' : 'rgba(23, 162, 151, 0.3)')
        : (val < prev ? 'rgba(255, 235, 59, 0.2)' : 'rgba(255, 152, 0, 0.2)');
      topFillColors[i] = col;
      botFillColors[i] = col;
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot, 'osc': oscPlot, 'oscTop': oscTopPlot, 'oscZero': oscZeroPlot, 'oscBot': oscBotPlot },
    markers,
    barColors,
    plotCandles: { candle0: candles },
    fills: [
      { plot1: 'oscTop', plot2: 'oscZero', options: { color: 'rgba(29, 209, 194, 0.15)' }, colors: topFillColors },
      { plot1: 'oscBot', plot2: 'oscZero', options: { color: 'rgba(255, 152, 0, 0.15)' }, colors: botFillColors },
    ],
  } as IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> };
}

export const MAShift = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
