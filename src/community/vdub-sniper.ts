/**
 * Vdub FX SniperVX2 Color v2
 *
 * Overlay indicator (overlay=true) with:
 * - SMA body channel (highest/lowest of close over 13 bars) with fill
 * - S/R lines from valuewhen(pivothigh/pivotlow)
 * - EMA 13 trend line (colored green/red based on direction)
 * - EMA 21 signal line (colored green/red based on direction)
 * - Hull MA (black, linewidth 3)
 * - Buy/Sell markers from TEMA/DEMA signal logic
 * - Supertrend arrows
 *
 * Reference: TradingView "Vdub FX SniperVX2 Color v2" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface VdubSniperInputs {
  bodyChannelLen: number;
  bodyChannelPeriod: number;
  ema1Len: number;
  ema2Len: number;
  fastSignal: number;
  slowSignal: number;
  supertrendFactor: number;
  supertrendPeriod: number;
  sRLength: number;
  hmaBaseLength: number;
  hmaLengthScalar: number;
}

export const defaultInputs: VdubSniperInputs = {
  bodyChannelLen: 34,
  bodyChannelPeriod: 13,
  ema1Len: 13,
  ema2Len: 21,
  fastSignal: 5,
  slowSignal: 8,
  supertrendFactor: 3,
  supertrendPeriod: 1,
  sRLength: 6,
  hmaBaseLength: 8,
  hmaLengthScalar: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'bodyChannelLen', type: 'int', title: 'Candle Body Resistance Channel', defval: 34, min: 1 },
  { id: 'bodyChannelPeriod', type: 'int', title: 'Channel Period', defval: 13, min: 1 },
  { id: 'ema1Len', type: 'int', title: 'EMA 1', defval: 13, min: 1 },
  { id: 'ema2Len', type: 'int', title: 'EMA 2', defval: 21, min: 1 },
  { id: 'fastSignal', type: 'int', title: 'Short Signal Generator', defval: 5, min: 1 },
  { id: 'slowSignal', type: 'int', title: 'Slow Signal', defval: 8, min: 1 },
  { id: 'supertrendFactor', type: 'int', title: 'Trend Transition Signal', defval: 3, min: 1 },
  { id: 'supertrendPeriod', type: 'int', title: 'Supertrend Period', defval: 1, min: 1 },
  { id: 'sRLength', type: 'int', title: 'Support / Resistance Length', defval: 6, min: 1 },
  { id: 'hmaBaseLength', type: 'int', title: 'Hull MA Base Length', defval: 8, min: 1 },
  { id: 'hmaLengthScalar', type: 'int', title: 'Hull MA Length Scalar', defval: 5, min: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'channelTop', title: 'Channel Top', color: '#000000', lineWidth: 1 },
  { id: 'channelBottom', title: 'Channel Bottom', color: '#000000', lineWidth: 1 },
  { id: 'resistanceTop', title: 'Resistance Top', color: '#EF5350', lineWidth: 1 },
  { id: 'resistanceBottom', title: 'Resistance Bottom', color: '#26A69A', lineWidth: 1 },
  { id: 'ema1', title: 'EMA 1', color: '#26A69A', lineWidth: 1 },
  { id: 'ema2', title: 'EMA 2', color: '#26A69A', lineWidth: 1 },
  { id: 'hullMA', title: 'Hull MA', color: '#000000', lineWidth: 3 },
];

export const metadata = {
  title: 'Vdub FX Sniper',
  shortTitle: 'VSniper',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VdubSniperInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const {
    bodyChannelLen, bodyChannelPeriod,
    ema1Len, ema2Len,
    fastSignal, slowSignal,
    supertrendFactor, supertrendPeriod,
    sRLength,
    hmaBaseLength, hmaLengthScalar,
  } = { ...defaultInputs, ...inputs };

  const n = bars.length;
  const closeSeries = new Series(bars, (b) => b.close);
  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  // ===== Candle body resistance Channel =====
  // out = sma(close, 34)
  // last8h = highest(close, 13), lastl8 = lowest(close, 13)
  const last8h = ta.highest(closeSeries, bodyChannelPeriod).toArray();
  const lastl8 = ta.lowest(closeSeries, bodyChannelPeriod).toArray();

  const channelTopPlot = bars.map((b, i) => ({
    time: b.time,
    value: (i < bodyChannelPeriod || last8h[i] == null) ? NaN : last8h[i]!,
  }));

  const channelBottomPlot = bars.map((b, i) => ({
    time: b.time,
    value: (i < bodyChannelPeriod || lastl8[i] == null) ? NaN : lastl8[i]!,
  }));

  // ===== Support and Resistance =====
  // RSTT = valuewhen(high >= highest(high, RST), high, 0)
  // RSTB = valuewhen(low <= lowest(low, RST), low, 0)
  const highestH = ta.highest(highSeries, sRLength).toArray();
  const lowestL = ta.lowest(lowSeries, sRLength).toArray();
  const highArr = highSeries.toArray();
  const lowArr = lowSeries.toArray();

  // Build condition series for valuewhen
  const resistCondArr: number[] = new Array(n);
  const supportCondArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    resistCondArr[i] = (highArr[i] != null && highestH[i] != null && highArr[i]! >= highestH[i]!) ? 1 : 0;
    supportCondArr[i] = (lowArr[i] != null && lowestL[i] != null && lowArr[i]! <= lowestL[i]!) ? 1 : 0;
  }
  const resistCond = Series.fromArray(bars, resistCondArr);
  const supportCond = Series.fromArray(bars, supportCondArr);

  const rsttArr = ta.valuewhen(resistCond, highSeries, 0).toArray();
  const rstbArr = ta.valuewhen(supportCond, lowSeries, 0).toArray();

  // Pine: plot(RSTT, color=RSTT != RSTT[1] ? na : red) — only show when value is stable
  const resistanceTopPlot = bars.map((b, i) => {
    if (i < sRLength + 1 || rsttArr[i] == null) return { time: b.time, value: NaN };
    if (i > 0 && rsttArr[i] !== rsttArr[i - 1]) return { time: b.time, value: NaN };
    return { time: b.time, value: rsttArr[i]!, color: '#EF5350' };
  });

  const resistanceBottomPlot = bars.map((b, i) => {
    if (i < sRLength + 1 || rstbArr[i] == null) return { time: b.time, value: NaN };
    if (i > 0 && rstbArr[i] !== rstbArr[i - 1]) return { time: b.time, value: NaN };
    return { time: b.time, value: rstbArr[i]!, color: '#26A69A' };
  });

  // ===== Trend colour EMA 1 =====
  // ema(close, 13), direction = rising(ema0,2) ? +1 : falling(ema0,2) ? -1 : 0
  const ema0 = ta.ema(closeSeries, ema1Len);
  const ema0Arr = ema0.toArray();
  const ema0Rising = ta.rising(ema0, 2).toArray();
  const ema0Falling = ta.falling(ema0, 2).toArray();

  const ema1Plot = bars.map((b, i) => {
    if (i < ema1Len || ema0Arr[i] == null) return { time: b.time, value: NaN };
    let color: string | undefined;
    if (ema0Rising[i]) color = '#00E676'; // lime
    else if (ema0Falling[i]) color = '#EF5350'; // red
    else return { time: b.time, value: NaN }; // na color = don't draw
    return { time: b.time, value: ema0Arr[i]!, color };
  });

  // ===== Trend colour EMA 2 =====
  const ema02 = ta.ema(closeSeries, ema2Len);
  const ema02Arr = ema02.toArray();
  const ema02Rising = ta.rising(ema02, 2).toArray();
  const ema02Falling = ta.falling(ema02, 2).toArray();

  const ema2Plot = bars.map((b, i) => {
    if (i < ema2Len || ema02Arr[i] == null) return { time: b.time, value: NaN };
    let color: string | undefined;
    if (ema02Rising[i]) color = '#00E676';
    else if (ema02Falling[i]) color = '#EF5350';
    else return { time: b.time, value: NaN };
    return { time: b.time, value: ema02Arr[i]!, color };
  });

  // ===== Hull MA =====
  // hullma(close, base + scalar * 6) = hullma(close, 8 + 5*6 = 38)
  const hmaLen = hmaBaseLength + hmaLengthScalar * 6;
  const hmaArr = ta.hma(closeSeries, hmaLen).toArray();

  const hullMAPlot = bars.map((b, i) => ({
    time: b.time,
    value: (i < hmaLen || hmaArr[i] == null || isNaN(hmaArr[i]!)) ? NaN : hmaArr[i]!,
  }));

  // ===== Signal 1: TEMA/DEMA buy/sell markers =====
  // vh1 = ema(highest(avg(low,close), fast), 5)
  // vl1 = ema(lowest(avg(high,close), slow), 8)
  const closeArr = closeSeries.toArray();

  const avgLowClose: number[] = new Array(n);
  const avgHighClose: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    avgLowClose[i] = ((lowArr[i] ?? 0) + (closeArr[i] ?? 0)) / 2;
    avgHighClose[i] = ((highArr[i] ?? 0) + (closeArr[i] ?? 0)) / 2;
  }
  const avgLCSeries = Series.fromArray(bars, avgLowClose);
  const avgHCSeries = Series.fromArray(bars, avgHighClose);
  const vh1 = ta.ema(ta.highest(avgLCSeries, fastSignal), 5).toArray();
  const vl1 = ta.ema(ta.lowest(avgHCSeries, slowSignal), 8).toArray();

  // TEMA = 3*(ema1 - ema2) + ema3 where ema1=ema(close,1), etc.
  const e1 = ta.ema(closeSeries, 1).toArray();
  const e1S = Series.fromArray(bars, e1);
  const e2 = ta.ema(e1S, 1).toArray();
  const e2S = Series.fromArray(bars, e2);
  const e3 = ta.ema(e2S, 1).toArray();
  const tema: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    tema[i] = 1 * ((e1[i] ?? 0) - (e2[i] ?? 0)) + (e3[i] ?? 0);
  }

  // DEMA = 2 * ema(close,8) - ema(ema(close,8), 5)
  const ee1 = ta.ema(closeSeries, 8).toArray();
  const ee1S = Series.fromArray(bars, ee1);
  const ee2 = ta.ema(ee1S, 5).toArray();
  const dema: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    dema[i] = 2 * (ee1[i] ?? 0) - (ee2[i] ?? 0);
  }

  // signal = tema > dema ? max(vh1, vl1) : min(vh1, vl1)
  const signal: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (tema[i] > dema[i]) {
      signal[i] = Math.max(vh1[i] ?? 0, vl1[i] ?? 0);
    } else {
      signal[i] = Math.min(vh1[i] ?? 0, vl1[i] ?? 0);
    }
  }

  const markers: MarkerData[] = [];
  const warmup = Math.max(bodyChannelLen, ema1Len, ema2Len, hmaLen, 10);

  for (let i = warmup + 2; i < n; i++) {
    // direction from ema0 (EMA 13)
    const directionUp = ema0Rising[i];
    const directionDown = ema0Falling[i];

    // is_call = tema > dema and signal > low and (signal-signal[1] > signal[1]-signal[2]) and direction > 0
    const isCall = tema[i] > dema[i] &&
      signal[i] > lowArr[i]! &&
      (signal[i] - signal[i - 1] > signal[i - 1] - signal[i - 2]) &&
      directionUp;

    // is_put = tema < dema and signal < high and (signal[1]-signal > signal[2]-signal[1]) and direction < 0
    const isPut = tema[i] < dema[i] &&
      signal[i] < highArr[i]! &&
      (signal[i - 1] - signal[i] > signal[i - 2] - signal[i - 1]) &&
      directionDown;

    if (isCall) {
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#26A69A',
        text: '*BUY*',
      });
    }
    if (isPut) {
      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#EF5350',
        text: '*SELL*',
      });
    }
  }

  // ===== Supertrend arrows (Signal 2) =====
  const atrArr = ta.atr(bars, supertrendPeriod).toArray();
  const hl2Arr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    hl2Arr[i] = ((highArr[i] ?? 0) + (lowArr[i] ?? 0)) / 2;
  }

  const trendUp: number[] = new Array(n).fill(0);
  const trendDown: number[] = new Array(n).fill(0);
  const trend: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    const atrVal = atrArr[i] ?? 0;
    const upVal = hl2Arr[i] - supertrendFactor * atrVal;
    const dnVal = hl2Arr[i] + supertrendFactor * atrVal;

    if (i === 0) {
      trendUp[i] = upVal;
      trendDown[i] = dnVal;
    } else {
      trendUp[i] = closeArr[i - 1]! > trendUp[i - 1] ? Math.max(upVal, trendUp[i - 1]) : upVal;
      trendDown[i] = closeArr[i - 1]! < trendDown[i - 1] ? Math.min(dnVal, trendDown[i - 1]) : dnVal;

      if (closeArr[i]! > trendDown[i - 1]) trend[i] = 1;
      else if (closeArr[i]! < trendUp[i - 1]) trend[i] = -1;
      else trend[i] = trend[i - 1];
    }
  }

  // Supertrend arrows on trend change
  for (let i = warmup + 1; i < n; i++) {
    if (trend[i] === 1 && trend[i - 1] === -1) {
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#00E676',
        text: '',
      });
    }
    if (trend[i] === -1 && trend[i - 1] === 1) {
      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#EF5350',
        text: '',
      });
    }
  }

  // Sort markers by time (buy/sell + supertrend interleaved)
  markers.sort((a, b) => a.time - b.time);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'channelTop': channelTopPlot,
      'channelBottom': channelBottomPlot,
      'resistanceTop': resistanceTopPlot,
      'resistanceBottom': resistanceBottomPlot,
      'ema1': ema1Plot,
      'ema2': ema2Plot,
      'hullMA': hullMAPlot,
    },
    fills: [
      { plot1: 'channelTop', plot2: 'channelBottom', options: { color: 'rgba(0,0,0,0.10)', title: 'Body Channel' } },
      { plot1: 'channelTop', plot2: 'resistanceTop', options: { color: 'rgba(239,83,80,0.25)', title: 'Resistance Fill' } },
      { plot1: 'channelBottom', plot2: 'resistanceBottom', options: { color: 'rgba(38,166,154,0.25)', title: 'Support Fill' } },
    ],
    markers,
  };
}

export const VdubSniper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
