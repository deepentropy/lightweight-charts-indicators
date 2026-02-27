/**
 * RedK Volume-Accelerated Directional Energy Ratio (VADER)
 *
 * Bull power = close > open ? vol * (close-low)/(high-low) : vol * (close-open)/(high-low)
 * Bear power = close <= open ? vol * (open-low)/(high-low) : vol * (open-close)/(high-low)
 * VADER = RMA(bull, length) - RMA(bear, length)
 *
 * Reference: TradingView "RedK VADER" (TV#581)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RedKVADERInputs {
  length: number;
  DER_avg: number;
  smooth: number;
  showSenti: boolean;
  senti: number;
  vCalc: string;
  vlookbk: number;
}

export const defaultInputs: RedKVADERInputs = {
  length: 10,
  DER_avg: 5,
  smooth: 3,
  showSenti: false,
  senti: 20,
  vCalc: 'Relative',
  vlookbk: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
  { id: 'DER_avg', type: 'int', title: 'Average', defval: 5, min: 1 },
  { id: 'smooth', type: 'int', title: 'Smooth', defval: 3, min: 1 },
  { id: 'showSenti', type: 'bool', title: 'Sentiment', defval: false },
  { id: 'senti', type: 'int', title: 'Sentiment Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VADER Signal', color: '#359bfc', lineWidth: 4 },
  { id: 'plot1', title: 'Demand Energy', color: 'rgba(0, 255, 255, 0.7)', lineWidth: 2, style: 'cross' },
  { id: 'plot2', title: 'Supply Energy', color: 'rgba(255, 165, 0, 0.7)', lineWidth: 2, style: 'circles' },
  { id: 'plot3', title: 'Sentiment', color: '#1b5e20', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'RedK VADER',
  shortTitle: 'VADER',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RedKVADERInputs> = {}): IndicatorResult {
  const { length, DER_avg, smooth, showSenti, senti } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // Pine v4: uses DER (directional energy ratio) approach with volume acceleration
  // Simplified: bull/bear power based on bar position relative to range
  const bullArr: number[] = new Array(n);
  const bearArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const { open, high, low, close, volume } = bars[i];
    const hl = high - low;
    if (hl === 0) {
      bullArr[i] = 0;
      bearArr[i] = 0;
      continue;
    }
    const vol = volume ?? 0;
    if (close > open) {
      bullArr[i] = vol * (close - low) / hl;
      bearArr[i] = vol * (open - close) / hl;
    } else {
      bullArr[i] = vol * (close - open) / hl;
      bearArr[i] = vol * (open - low) / hl;
    }
    if (bullArr[i] < 0) bullArr[i] = 0;
    if (bearArr[i] < 0) bearArr[i] = 0;
  }

  const bullSeries = Series.fromArray(bars, bullArr);
  const bearSeries = Series.fromArray(bars, bearArr);
  const rmaBull = ta.rma(bullSeries, length).toArray();
  const rmaBear = ta.rma(bearSeries, length).toArray();

  // Pine: adp = 100 * wma(dem, DER_avg), asp = 100 * wma(sup, DER_avg)
  // Since we're using simplified bull/bear, scale via WMA averaging
  const demSeries = Series.fromArray(bars, rmaBull);
  const supSeries = Series.fromArray(bars, rmaBear);
  const adpRaw = ta.wma(demSeries, DER_avg).toArray();
  const aspRaw = ta.wma(supSeries, DER_avg).toArray();

  // anp = adp - asp, anp_s = wma(anp, smooth)
  const anpArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = adpRaw[i];
    const s = aspRaw[i];
    anpArr[i] = (a != null && !isNaN(a) && s != null && !isNaN(s)) ? a - s : 0;
  }
  const anpSeries = Series.fromArray(bars, anpArr);
  const anpSmooth = ta.wma(anpSeries, smooth).toArray();

  const warmup = length + DER_avg;

  // Sentiment: Pine v3 4-color histogram
  // s_adp = 100 * wma(dem, senti), s_asp = 100 * wma(sup, senti), V_senti = wma(s_adp - s_asp, smooth)
  const sAdp = ta.wma(demSeries, senti).toArray();
  const sAsp = ta.wma(supSeries, senti).toArray();
  const sentiArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const sa = sAdp[i];
    const ss = sAsp[i];
    sentiArr[i] = (sa != null && !isNaN(sa) && ss != null && !isNaN(ss)) ? sa - ss : 0;
  }
  const sentiSeries = Series.fromArray(bars, sentiArr);
  const vSenti = ta.wma(sentiSeries, smooth).toArray();

  // VADER signal (anp_s) colored by direction
  const plot0 = bars.map((bar, i) => {
    const v = anpSmooth[i];
    if (i < warmup || v == null || isNaN(v)) return { time: bar.time, value: NaN };
    const color = v >= 0 ? '#359bfc' : '#f57f17';
    return { time: bar.time, value: v, color };
  });

  // Pine: d = plot(adp, 'Demand Energy', c_adp, 2, style=plot.style_cross, join=true)
  const plot1 = bars.map((bar, i) => ({
    time: bar.time,
    value: (i < warmup || adpRaw[i] == null || isNaN(adpRaw[i])) ? NaN : adpRaw[i],
  }));

  // Pine: s = plot(asp, 'Supply Energy', c_asp, 2, style=plot.style_circles, join=true)
  const plot2 = bars.map((bar, i) => ({
    time: bar.time,
    value: (i < warmup || aspRaw[i] == null || isNaN(aspRaw[i])) ? NaN : aspRaw[i],
  }));

  // Pine: Sentiment 4-color histogram
  // c_grow_above = #1b5e2080, c_grow_below = #dc4c4a80, c_fall_above = #66bb6a80, c_fall_below = #ef8e9880
  const sentiWarmup = Math.max(warmup, senti + smooth);
  const plot3 = bars.map((bar, i) => {
    const v = vSenti[i];
    if (!showSenti || i < sentiWarmup || v == null || isNaN(v)) return { time: bar.time, value: NaN };
    const prevV = i > 0 ? vSenti[i - 1] : NaN;
    const sUp = v >= 0;
    const sFlagUp = prevV != null && !isNaN(prevV) && Math.abs(v) >= Math.abs(prevV);
    let color: string;
    if (sUp) {
      color = sFlagUp ? 'rgba(27,94,32,0.5)' : 'rgba(102,187,106,0.5)';
    } else {
      color = sFlagUp ? 'rgba(220,76,74,0.5)' : 'rgba(239,142,152,0.5)';
    }
    return { time: bar.time, value: v, color };
  });

  // Dynamic fill: green when demand > supply, red when supply > demand
  const fillColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < warmup || adpRaw[i] == null || aspRaw[i] == null) {
      fillColors[i] = 'rgba(0,0,0,0)';
    } else {
      fillColors[i] = adpRaw[i] > aspRaw[i] ? 'rgba(0, 128, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)';
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3 },
    hlines: [
      { value: 0, options: { color: 'rgba(255, 238, 0, 0.3)', linestyle: 'solid' as const, title: 'Zero' } },
    ],
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(0, 128, 0, 0.2)' }, colors: fillColors },
    ],
  };
}

export const RedKVADER = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
