/**
 * Triple MA Forecast
 *
 * Three SMAs colored by slope direction: green when rising, red when falling.
 *
 * Reference: TradingView "Triple MA Forecast" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface TripleMAForecastInputs {
  len1: number;
  len2: number;
  len3: number;
  src: SourceType;
  forecastType: 'flat' | 'linreg';
  linregLen: number;
}

export const defaultInputs: TripleMAForecastInputs = {
  len1: 10,
  len2: 20,
  len3: 50,
  src: 'close',
  forecastType: 'flat',
  linregLen: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'Short MA Len', defval: 10, min: 1 },
  { id: 'len2', type: 'int', title: 'Mid MA Len', defval: 20, min: 1 },
  { id: 'len3', type: 'int', title: 'Long MA Len', defval: 50, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'forecastType', type: 'string', title: 'Forecast Type', defval: 'flat', options: ['flat', 'linreg'] },
  { id: 'linregLen', type: 'int', title: 'LinReg Candles', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short MA', color: '#FF6D00', lineWidth: 3 },
  { id: 'plot1', title: 'Mid MA', color: '#9C27B0', lineWidth: 3 },
  { id: 'plot2', title: 'Long MA', color: '#2196F3', lineWidth: 3 },
  { id: 'plot3', title: 'Short Forecast 1', color: '#FF6D00', lineWidth: 2, style: 'circles' },
  { id: 'plot4', title: 'Short Forecast 2', color: '#FF6D00', lineWidth: 2, style: 'circles' },
  { id: 'plot5', title: 'Short Forecast 3', color: '#FF6D00', lineWidth: 2, style: 'circles' },
  { id: 'plot6', title: 'Mid Forecast 1', color: '#9C27B0', lineWidth: 2, style: 'circles' },
  { id: 'plot7', title: 'Mid Forecast 2', color: '#9C27B0', lineWidth: 2, style: 'circles' },
  { id: 'plot8', title: 'Mid Forecast 3', color: '#9C27B0', lineWidth: 2, style: 'circles' },
  { id: 'plot9', title: 'Long Forecast 1', color: '#2196F3', lineWidth: 2, style: 'circles' },
  { id: 'plot10', title: 'Long Forecast 2', color: '#2196F3', lineWidth: 2, style: 'circles' },
  { id: 'plot11', title: 'Long Forecast 3', color: '#2196F3', lineWidth: 2, style: 'circles' },
];

export const metadata = {
  title: 'Triple MA Forecast',
  shortTitle: '3MAF',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TripleMAForecastInputs> = {}): IndicatorResult {
  const { len1, len2, len3, src, forecastType, linregLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();

  const lengths = [len1, len2, len3];
  const colors = ['#FF6D00', '#9C27B0', '#2196F3'];
  const smaArrays = lengths.map((len) => ta.sma(srcSeries, len).toArray());

  const plots: Record<string, Array<{ time: number; value: number; color?: string }>> = {};

  // Main MA plots (plot0, plot1, plot2)
  for (let idx = 0; idx < lengths.length; idx++) {
    const arr = smaArrays[idx];
    plots[`plot${idx}`] = arr.map((v, i) => {
      if (i < lengths[idx]) return { time: bars[i].time, value: NaN };
      const val = v ?? NaN;
      const prev = i > 0 ? (arr[i - 1] ?? val) : val;
      const color = val > prev ? '#26A69A' : val < prev ? '#EF5350' : '#787B86';
      return { time: bars[i].time, value: val, color };
    });
  }

  // Compute forecast values per bar
  // Pine: forecast(_type,_src,_flen,_lrlen)
  //   "flat" => _src (current source value)
  //   "linreg" => linreg(_src, _lrlen, _flen)
  // For linreg forecasting, we compute inline since ta.linreg with offset>0 projects forward
  const linregForecast = (i: number, flen: number): number => {
    if (i < linregLen - 1) return NaN;
    // Simple linear regression: y = a + b*x, extrapolated to x = linregLen - 1 + flen
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let j = 0; j < linregLen; j++) {
      const idx = i - linregLen + 1 + j;
      const y = srcArr[idx] ?? NaN;
      if (isNaN(y)) return NaN;
      sumX += j;
      sumY += y;
      sumXY += j * y;
      sumX2 += j * j;
    }
    const nLr = linregLen;
    const b = (nLr * sumXY - sumX * sumY) / (nLr * sumX2 - sumX * sumX);
    const a = (sumY - b * sumX) / nLr;
    return a + b * (nLr - 1 + flen);
  };

  // Forecast circle plots (9 total: 3 MAs x 3 forward steps)
  // Pine: shortmaforecast_k = (SMA(src, L-k) * (L-k) + forecast1 + ... + forecastk) / L
  for (let maIdx = 0; maIdx < lengths.length; maIdx++) {
    const L = lengths[maIdx];
    for (let fstep = 1; fstep <= 3; fstep++) {
      const plotId = `plot${3 + maIdx * 3 + (fstep - 1)}`;
      const forecastPlot: Array<{ time: number; value: number; color?: string }> = [];

      for (let i = 0; i < n; i++) {
        // Only show on the last bar (Pine: show_last=1)
        if (i !== n - 1) {
          forecastPlot.push({ time: bars[i].time, value: NaN });
          continue;
        }

        if (i < L) {
          forecastPlot.push({ time: bars[i].time, value: NaN });
          continue;
        }

        // Compute forecasted source values
        const forecasts: number[] = [];
        for (let f = 1; f <= fstep; f++) {
          if (forecastType === 'flat') {
            forecasts.push(srcArr[i] ?? NaN);
          } else {
            forecasts.push(linregForecast(i, f));
          }
        }
        if (forecasts.some(isNaN)) {
          forecastPlot.push({ time: bars[i].time, value: NaN });
          continue;
        }

        // SMA(src, L-fstep) * (L-fstep) = sum of last (L-fstep) source values
        const partialLen = L - fstep;
        if (partialLen <= 0) {
          forecastPlot.push({ time: bars[i].time, value: NaN });
          continue;
        }
        let partialSum = 0;
        for (let j = 0; j < partialLen; j++) {
          partialSum += srcArr[i - partialLen + 1 + j] ?? 0;
        }
        const forecastSum = forecasts.reduce((s, v) => s + v, 0);
        const val = (partialSum + forecastSum) / L;

        forecastPlot.push({ time: bars[i].time, value: val, color: colors[maIdx] });
      }

      plots[plotId] = forecastPlot;
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const TripleMAForecast = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
