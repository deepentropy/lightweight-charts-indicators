/**
 * PredictiveChannels
 *
 * Dynamic support/resistance channels that adapt based on ATR.
 * Maintains an adaptive average that resets when price deviates beyond ATR,
 * then creates R2/R1/avg/S1/S2 channel levels.
 *
 * Reference: TradingView "Predictive Channels [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface PredictiveChannelsInputs {
  factor: number;
  slope: number;
}

export const defaultInputs: PredictiveChannelsInputs = {
  factor: 5,
  slope: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'factor', type: 'float', title: 'Factor', defval: 5, min: 0, step: 0.1 },
  { id: 'slope', type: 'float', title: 'Slope', defval: 50, min: 0, step: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'r2', title: 'Upper Resistance', color: '#f23645', lineWidth: 1 },
  { id: 'r1', title: 'Lower Resistance', color: 'rgba(242,54,69,0.5)', lineWidth: 1 },
  { id: 'avg', title: 'Average', color: '#787B86', lineWidth: 1 },
  { id: 's1', title: 'Upper Support', color: 'rgba(8,153,129,0.5)', lineWidth: 1 },
  { id: 's2', title: 'Lower Support', color: '#089981', lineWidth: 1 },
];

export const metadata = {
  title: 'Predictive Channels',
  shortTitle: 'PC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<PredictiveChannelsInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const mult = cfg.factor;
  const slopeVal = cfg.slope * mult;

  // ATR(200) * mult
  const atrArr = ta.atr(bars, 200).toArray();

  const warmup = 200;

  // State variables matching Pine's var declarations
  let pcAvg = bars.length > 0 ? bars[0].close : 0;
  let os = 1;
  let holdAtr = 0;

  const pcAvgArr: number[] = new Array(n);
  const r2Arr: number[] = new Array(n);
  const r1Arr: number[] = new Array(n);
  const s1Arr: number[] = new Array(n);
  const s2Arr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const atr = (atrArr[i] ?? 0) * mult;

    // pc_avg := math.abs(close - pc_avg) > atr ? close : pc_avg + os * hold_atr / slope
    if (Math.abs(close - pcAvg) > atr) {
      pcAvg = close;
    } else {
      pcAvg = pcAvg + os * holdAtr / (slopeVal === 0 ? 1 : slopeVal);
    }

    // hold_atr := pc_avg == close ? atr / 2 : hold_atr
    if (pcAvg === close) {
      holdAtr = atr / 2;
    }

    // os := pc_avg > pc_avg[1] ? 1 : pc_avg < pc_avg[1] ? -1 : os
    if (i > 0) {
      if (pcAvg > pcAvgArr[i - 1]) os = 1;
      else if (pcAvg < pcAvgArr[i - 1]) os = -1;
    }

    pcAvgArr[i] = pcAvg;
    r2Arr[i] = pcAvg + holdAtr;
    r1Arr[i] = pcAvg + holdAtr / 2;
    s1Arr[i] = pcAvg - holdAtr / 2;
    s2Arr[i] = pcAvg - holdAtr;
  }

  const makePlot = (arr: number[]) =>
    arr.map((v, i) => ({
      time: bars[i].time,
      // Pine: close == pc_avg ? na : value (hide when resetting)
      value: i < warmup ? NaN : (bars[i].close === pcAvgArr[i] ? NaN : v),
    }));

  // Dynamic fill colors: green when close > avg, red when close < avg
  const fillColors = pcAvgArr.map((avg, i) => {
    if (i < warmup || bars[i].close === avg) return 'transparent';
    return bars[i].close > avg ? 'rgba(8,153,129,0.20)' : 'rgba(242,54,69,0.20)';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      r2: makePlot(r2Arr),
      r1: makePlot(r1Arr),
      avg: makePlot(pcAvgArr),
      s1: makePlot(s1Arr),
      s2: makePlot(s2Arr),
    },
    fills: [
      { plot1: 'r2', plot2: 's2', options: { color: 'rgba(8,153,129,0.20)' }, colors: fillColors },
    ],
  };
}

export const PredictiveChannels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
