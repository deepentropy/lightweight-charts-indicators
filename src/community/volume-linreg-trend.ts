/**
 * Volume-Supported Linear Regression Trend (VSLRT)
 *
 * Pine: overlay=false, 2 plots:
 *   1) Short-term linreg slope * len1 as columns with 6-level conditional coloring
 *   2) Long-term linreg slope * len2 as line (linewidth=3) with 6-level conditional coloring
 *
 * Coloring logic uses buy/sell volume regression slopes to determine color intensity.
 *
 * Reference: TradingView "Volume-Supported Linear Regression Trend" by LonesomeTheBlue
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface VolumeLinRegTrendInputs {
  src: SourceType;
  len1: number;
  len2: number;
}

export const defaultInputs: VolumeLinRegTrendInputs = {
  src: 'close',
  len1: 20,
  len2: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'len1', type: 'int', title: 'Short Term Length', defval: 20, min: 5 },
  { id: 'len2', type: 'int', title: 'Long Term Length', defval: 50, min: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short Term', color: '#00FF00', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Long Term', color: '#008EFF', lineWidth: 3, style: 'line' },
];

export const metadata = {
  title: 'Volume-Supported Linear Regression Trend',
  shortTitle: 'VSLRT',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeLinRegTrendInputs> = {}): IndicatorResult {
  const { src, len1, len2 } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const source = getSourceSeries(bars, src);

  // linreg(src, len, 0) - linreg(src, len, 1) = regression slope
  const lr1_0 = ta.linreg(source, len1, 0).toArray();
  const lr1_1 = ta.linreg(source, len1, 1).toArray();
  const lr2_0 = ta.linreg(source, len2, 0).toArray();
  const lr2_1 = ta.linreg(source, len2, 1).toArray();

  // Candle components for buy/sell volume rate
  const tw: number[] = new Array(n);
  const bw: number[] = new Array(n);
  const body: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    tw[i] = bars[i].high - Math.max(bars[i].open, bars[i].close);
    bw[i] = Math.min(bars[i].open, bars[i].close) - bars[i].low;
    body[i] = Math.abs(bars[i].close - bars[i].open);
  }

  // _rate(cond): proportion of volume attributed to buy or sell
  function rate(i: number, cond: boolean): number {
    const total = tw[i] + bw[i] + body[i];
    if (total === 0) return 0.5;
    const r = 0.5 * (tw[i] + bw[i] + (cond ? 2 * body[i] : 0)) / total;
    return isNaN(r) ? 0.5 : r;
  }

  // Buy/sell volume arrays
  const deltaUp: number[] = new Array(n);
  const deltaDown: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const vol = bars[i].volume ?? 0;
    deltaUp[i] = vol * rate(i, bars[i].open <= bars[i].close);
    deltaDown[i] = vol * rate(i, bars[i].open > bars[i].close);
  }

  const deltaUpSeries = Series.fromArray(bars, deltaUp);
  const deltaDownSeries = Series.fromArray(bars, deltaDown);

  // Short-term volume slopes
  const svUp0 = ta.linreg(deltaUpSeries, len1, 0).toArray();
  const svUp1 = ta.linreg(deltaUpSeries, len1, 1).toArray();
  const svDn0 = ta.linreg(deltaDownSeries, len1, 0).toArray();
  const svDn1 = ta.linreg(deltaDownSeries, len1, 1).toArray();

  // Long-term volume slopes
  const lvUp0 = ta.linreg(deltaUpSeries, len2, 0).toArray();
  const lvUp1 = ta.linreg(deltaUpSeries, len2, 1).toArray();
  const lvDn0 = ta.linreg(deltaDownSeries, len2, 0).toArray();
  const lvDn1 = ta.linreg(deltaDownSeries, len2, 1).toArray();

  // Column colors for short term
  const ccol11 = '#00FF00';   // strong bull
  const ccol12 = '#00BC00';   // medium bull
  const ccol13 = '#00FF006f'; // weak bull
  const ccol21 = '#FF0000';   // strong bear
  const ccol22 = '#BF0000';   // medium bear
  const ccol23 = '#FF00006f'; // weak bear

  // Line colors for long term
  const col11 = '#008EFF'; // strong bull
  const col12 = '#006ec5'; // medium bull
  const col13 = '#024478'; // weak bull
  const col21 = '#fd9701'; // strong bear
  const col22 = '#CE7A00'; // medium bear
  const col23 = '#663d00'; // weak bear

  const shortPlot = new Array(n);
  const longPlot = new Array(n);

  for (let i = 0; i < n; i++) {
    // Short-term: needs len1 bars of warmup
    if (i < len1 || lr1_0[i] == null || lr1_1[i] == null) {
      shortPlot[i] = { time: bars[i].time, value: NaN };
    } else {
      const slopePrice = lr1_0[i] - lr1_1[i];
      const slopeVolUp = svUp0[i] - svUp1[i];
      const slopeVolDn = svDn0[i] - svDn1[i];

      let colCol: string;
      if (slopePrice > 0) {
        if (slopeVolUp > 0) {
          colCol = slopeVolUp > slopeVolDn ? ccol11 : ccol12;
        } else {
          colCol = ccol13;
        }
      } else if (slopePrice < 0) {
        if (slopeVolDn > 0) {
          colCol = slopeVolUp < slopeVolDn ? ccol21 : ccol22;
        } else {
          colCol = ccol23;
        }
      } else {
        colCol = '#808080';
      }

      shortPlot[i] = { time: bars[i].time, value: slopePrice * len1, color: colCol };
    }

    // Long-term: needs len2 bars of warmup
    if (i < len2 || lr2_0[i] == null || lr2_1[i] == null) {
      longPlot[i] = { time: bars[i].time, value: NaN };
    } else {
      const slopePriceLt = lr2_0[i] - lr2_1[i];
      const slopeVolUpLt = lvUp0[i] - lvUp1[i];
      const slopeVolDnLt = lvDn0[i] - lvDn1[i];

      let lineCol: string;
      if (slopePriceLt > 0) {
        if (slopeVolUpLt > 0) {
          lineCol = slopeVolUpLt > slopeVolDnLt ? col11 : col12;
        } else {
          lineCol = col13;
        }
      } else if (slopePriceLt < 0) {
        if (slopeVolDnLt > 0) {
          lineCol = slopeVolUpLt < slopeVolDnLt ? col21 : col22;
        } else {
          lineCol = col23;
        }
      } else {
        lineCol = '#808080';
      }

      longPlot[i] = { time: bars[i].time, value: slopePriceLt * len2, color: lineCol };
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: shortPlot, plot1: longPlot },
  };
}

export const VolumeLinRegTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
