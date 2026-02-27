/**
 * Triple MA Forecast
 *
 * Three SMAs with forecast circle plots projected forward 1/2/3 bars.
 * Forecast can use flat (current price) or linear regression projection.
 *
 * Reference: TradingView "Triple MA Forecast" by yatrader2 (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface TripleMAForecastInputs {
  src: SourceType;
  forecastType: 'flat' | 'linreg';
  linregLen: number;
  showShort: boolean;
  len: number;
  showMid: boolean;
  lenMid: number;
  showLong: boolean;
  lenLong: number;
}

export const defaultInputs: TripleMAForecastInputs = {
  src: 'close',
  forecastType: 'flat',
  linregLen: 3,
  showShort: true,
  len: 7,
  showMid: true,
  lenMid: 30,
  showLong: true,
  lenLong: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'forecastType', type: 'string', title: 'MA Forecast Type', defval: 'flat', options: ['flat', 'linreg'] },
  { id: 'linregLen', type: 'int', title: '# of candles to use in linear regression', defval: 3, min: 1 },
  { id: 'showShort', type: 'bool', title: 'Plot Short MA', defval: true },
  { id: 'len', type: 'int', title: 'Short MA Len', defval: 7, min: 1 },
  { id: 'showMid', type: 'bool', title: 'Plot Mid MA', defval: true },
  { id: 'lenMid', type: 'int', title: 'Mid MA Len', defval: 30, min: 1 },
  { id: 'showLong', type: 'bool', title: 'Plot Long MA', defval: true },
  { id: 'lenLong', type: 'int', title: 'Long MA Len', defval: 50, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short MA', color: '#FF6D00', lineWidth: 3 },
  { id: 'plot1', title: 'Mid MA', color: '#9C27B0', lineWidth: 3 },
  { id: 'plot2', title: 'Long MA', color: '#2196F3', lineWidth: 3 },
  { id: 'plot3', title: 'Short MA Forecast 1', color: '#FF6D00', lineWidth: 2, style: 'circles', offset: 1 },
  { id: 'plot4', title: 'Short MA Forecast 2', color: '#FF6D00', lineWidth: 2, style: 'circles', offset: 2 },
  { id: 'plot5', title: 'Short MA Forecast 3', color: '#FF6D00', lineWidth: 2, style: 'circles', offset: 3 },
  { id: 'plot6', title: 'Mid MA Forecast 1', color: '#9C27B0', lineWidth: 2, style: 'circles', offset: 1 },
  { id: 'plot7', title: 'Mid MA Forecast 2', color: '#9C27B0', lineWidth: 2, style: 'circles', offset: 2 },
  { id: 'plot8', title: 'Mid MA Forecast 3', color: '#9C27B0', lineWidth: 2, style: 'circles', offset: 3 },
  { id: 'plot9', title: 'Long MA Forecast 1', color: '#2196F3', lineWidth: 2, style: 'circles', offset: 1 },
  { id: 'plot10', title: 'Long MA Forecast 2', color: '#2196F3', lineWidth: 2, style: 'circles', offset: 2 },
  { id: 'plot11', title: 'Long MA Forecast 3', color: '#2196F3', lineWidth: 2, style: 'circles', offset: 3 },
];

export const metadata = {
  title: 'Triple MA Forecast',
  shortTitle: '3MAF',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TripleMAForecastInputs> = {}): IndicatorResult {
  const { src, forecastType, linregLen, showShort, len, showMid, lenMid, showLong, lenLong } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();

  const lengths = [len, lenMid, lenLong];
  const showFlags = [showShort, showMid, showLong];
  const smaArrays = lengths.map((l) => ta.sma(srcSeries, l).toArray());

  const plots: Record<string, Array<{ time: number; value: number }>> = {};

  // Main MA plots (plot0, plot1, plot2) -- fixed colors per Pine (no slope coloring)
  for (let idx = 0; idx < 3; idx++) {
    const arr = smaArrays[idx];
    plots[`plot${idx}`] = arr.map((v, i) => ({
      time: bars[i].time,
      value: showFlags[idx] ? (v ?? NaN) : NaN,
    }));
  }

  // Pine: forecast(_type,_src,_flen,_lrlen)
  //   "flat" => _src (current source value)
  //   "linreg" => linreg(_src, _lrlen, _flen)
  const linregForecast = (i: number, flen: number): number => {
    if (i < linregLen - 1) return NaN;
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
    const denom = nLr * sumX2 - sumX * sumX;
    if (denom === 0) return NaN;
    const b = (nLr * sumXY - sumX * sumY) / denom;
    const a = (sumY - b * sumX) / nLr;
    return a + b * (nLr - 1 + flen);
  };

  // Forecast circle plots (9 total: 3 MAs x 3 forward steps)
  // Pine formula: shortmaforecast_k = (SMA(src, L-k) * (L-k) + forecast1 + ... + forecastk) / L
  // Pine: show_last=1 means only the last bar has a visible value
  for (let maIdx = 0; maIdx < 3; maIdx++) {
    const L = lengths[maIdx];
    const show = showFlags[maIdx];
    for (let fstep = 1; fstep <= 3; fstep++) {
      const plotId = `plot${3 + maIdx * 3 + (fstep - 1)}`;
      const forecastPlot: Array<{ time: number; value: number }> = [];

      for (let i = 0; i < n; i++) {
        // Only show on the last bar (Pine: show_last=1)
        if (!show || i !== n - 1) {
          forecastPlot.push({ time: bars[i].time, value: NaN });
          continue;
        }

        const partialLen = L - fstep;
        if (partialLen <= 0 || i < L) {
          forecastPlot.push({ time: bars[i].time, value: NaN });
          continue;
        }

        // Compute forecasted source values for each forward step
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
        let partialSum = 0;
        for (let j = 0; j < partialLen; j++) {
          partialSum += srcArr[i - partialLen + 1 + j] ?? 0;
        }
        const forecastSum = forecasts.reduce((s, v) => s + v, 0);
        const val = (partialSum + forecastSum) / L;

        forecastPlot.push({ time: bars[i].time, value: val });
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
