/**
 * Vdub FX SniperVX2 Color v2
 *
 * Overlay indicator (overlay=true) with:
 * - SMA body channel (highest/lowest of close over 13 bars) with fill (black, linebr)
 * - LB Resistance channel (self-referencing up/down) with red/green linebr plots
 * - S/R lines from valuewhen(pivothigh/pivotlow) with red/green colors
 * - EMA 13 trend line (colored lime/red based on direction)
 * - EMA 21 signal line (colored lime/red based on direction)
 * - Hull MA (black, linewidth 3)
 * - Buy/Sell markers from TEMA/DEMA signal logic
 * - Supertrend arrows on trend change
 * - Fills: body channel (black), resistance (red), support (green)
 *
 * Reference: TradingView "Vdub FX SniperVX2 Color v2" by Vdubus
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
  { id: 'channelTop', title: 'Candle body resistance level top', color: '#000000', lineWidth: 1 },
  { id: 'channelBottom', title: 'Candle body resistance level bottom', color: '#000000', lineWidth: 1 },
  { id: 'resistTop', title: 'Resistance Level top', color: '#EF5350', lineWidth: 1 },
  { id: 'resistBottom', title: 'Resistance level bottom', color: '#26A69A', lineWidth: 1 },
  { id: 'srTop', title: 'S/R Top', color: '#EF5350', lineWidth: 1 },
  { id: 'srBottom', title: 'S/R Bottom', color: '#26A69A', lineWidth: 1 },
  { id: 'ema1', title: 'EMA', color: '#00E676', lineWidth: 1 },
  { id: 'ema2', title: 'EMA Signal 2', color: '#00E676', lineWidth: 1 },
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
  const closeArr = closeSeries.toArray();
  const highArr = highSeries.toArray();
  const lowArr = lowSeries.toArray();

  // ===== Candle body resistance Channel (ul2/ll2) =====
  // out = sma(close, 34) -- computed but not directly plotted as a line
  // last8h = highest(close, 13), lastl8 = lowest(close, 13)
  // Pine: plot(channel2?last8h:last8h==nz(last8h[1])?last8h:na, ...)
  // channel2 defaults to false, so: show last8h only when last8h == last8h[1] (stable)
  const last8h = ta.highest(closeSeries, bodyChannelPeriod).toArray();
  const lastl8 = ta.lowest(closeSeries, bodyChannelPeriod).toArray();

  const channelTopPlot = bars.map((b, i) => {
    if (i < bodyChannelPeriod) return { time: b.time, value: NaN };
    const v = last8h[i];
    if (v == null) return { time: b.time, value: NaN };
    // linebr: show only when value is stable (same as previous)
    if (i > 0 && last8h[i - 1] != null && v !== last8h[i - 1]) return { time: b.time, value: NaN };
    return { time: b.time, value: v };
  });

  const channelBottomPlot = bars.map((b, i) => {
    if (i < bodyChannelPeriod) return { time: b.time, value: NaN };
    const v = lastl8[i];
    if (v == null) return { time: b.time, value: NaN };
    if (i > 0 && lastl8[i - 1] != null && v !== lastl8[i - 1]) return { time: b.time, value: NaN };
    return { time: b.time, value: v };
  });

  // ===== LB Resistance Channel (ul/ll) =====
  // up = close<nz(up[1]) and close>down[1] ? nz(up[1]) : high
  // down = close<nz(up[1]) and close>down[1] ? nz(down[1]) : low
  // channel defaults to false: show only when stable (up==up[1])
  const upArr: number[] = new Array(n);
  const downArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const c = closeArr[i] ?? 0;
    const h = highArr[i] ?? 0;
    const l = lowArr[i] ?? 0;
    if (i === 0) {
      upArr[i] = h;
      downArr[i] = l;
    } else {
      const prevUp = upArr[i - 1] ?? 0; // nz(up[1])
      const prevDown = downArr[i - 1] ?? 0;
      if (c < prevUp && c > prevDown) {
        upArr[i] = prevUp;
        downArr[i] = prevDown;
      } else {
        upArr[i] = h;
        downArr[i] = l;
      }
    }
  }

  const resistTopPlot = bars.map((b, i) => {
    if (i < 1) return { time: b.time, value: NaN };
    const v = upArr[i];
    // channel=false: show only when stable
    if (i > 0 && v !== upArr[i - 1]) return { time: b.time, value: NaN };
    return { time: b.time, value: v, color: '#EF5350' };
  });

  const resistBottomPlot = bars.map((b, i) => {
    if (i < 1) return { time: b.time, value: NaN };
    const v = downArr[i];
    if (i > 0 && v !== downArr[i - 1]) return { time: b.time, value: NaN };
    return { time: b.time, value: v, color: '#26A69A' };
  });

  // ===== Support and Resistance (RT2/RB2) =====
  // RSTT = valuewhen(high >= highest(high, RST), high, 0)
  // RSTB = valuewhen(low <= lowest(low, RST), low, 0)
  // plot color = RSTT != RSTT[1] ? na : red
  const highestH = ta.highest(highSeries, sRLength).toArray();
  const lowestL = ta.lowest(lowSeries, sRLength).toArray();

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

  const srTopPlot = bars.map((b, i) => {
    if (i < sRLength + 1 || rsttArr[i] == null) return { time: b.time, value: NaN };
    if (i > 0 && rsttArr[i] !== rsttArr[i - 1]) return { time: b.time, value: NaN };
    return { time: b.time, value: rsttArr[i]!, color: '#EF5350' };
  });

  const srBottomPlot = bars.map((b, i) => {
    if (i < sRLength + 1 || rstbArr[i] == null) return { time: b.time, value: NaN };
    if (i > 0 && rstbArr[i] !== rstbArr[i - 1]) return { time: b.time, value: NaN };
    return { time: b.time, value: rstbArr[i]!, color: '#26A69A' };
  });

  // ===== Trend colour EMA 1 =====
  // ema(close, 13), direction = rising(ema0,2) ? +1 : falling(ema0,2) ? -1 : 0
  // plot color = direction > 0 ? lime : direction < 0 ? red : na
  const ema0 = ta.ema(closeSeries, ema1Len);
  const ema0Arr = ema0.toArray();
  const ema0Rising = ta.rising(ema0, 2).toArray();
  const ema0Falling = ta.falling(ema0, 2).toArray();

  const directionArr: number[] = new Array(n);
  const ema1Plot = bars.map((b, i) => {
    if (i < ema1Len || ema0Arr[i] == null) {
      directionArr[i] = 0;
      return { time: b.time, value: NaN };
    }
    const dir = ema0Rising[i] ? 1 : ema0Falling[i] ? -1 : 0;
    directionArr[i] = dir;
    if (dir > 0) return { time: b.time, value: ema0Arr[i]!, color: '#00E676' }; // lime
    if (dir < 0) return { time: b.time, value: ema0Arr[i]!, color: '#EF5350' }; // red
    return { time: b.time, value: NaN }; // na color = don't draw
  });

  // ===== Trend colour EMA 2 =====
  const ema02 = ta.ema(closeSeries, ema2Len);
  const ema02Arr = ema02.toArray();
  const ema02Rising = ta.rising(ema02, 2).toArray();
  const ema02Falling = ta.falling(ema02, 2).toArray();

  const ema2Plot = bars.map((b, i) => {
    if (i < ema2Len || ema02Arr[i] == null) return { time: b.time, value: NaN };
    if (ema02Rising[i]) return { time: b.time, value: ema02Arr[i]!, color: '#00E676' };
    if (ema02Falling[i]) return { time: b.time, value: ema02Arr[i]!, color: '#EF5350' };
    return { time: b.time, value: NaN };
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

  // TEMA: e1=ema(close,1), e2=ema(e1,1), e3=ema(e2,1), tema = 1*(e1-e2)+e3
  const e1 = ta.ema(closeSeries, 1).toArray();
  const e1S = Series.fromArray(bars, e1);
  const e2 = ta.ema(e1S, 1).toArray();
  const e2S = Series.fromArray(bars, e2);
  const e3 = ta.ema(e2S, 1).toArray();
  const tema: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    tema[i] = 1 * ((e1[i] ?? 0) - (e2[i] ?? 0)) + (e3[i] ?? 0);
  }

  // DEMA: ee1=ema(close,8), ee2=ema(ee1,5), dema = 2*ee1 - ee2
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
    const dir = directionArr[i];

    // is_call = tema > dema and signal > low and (signal-signal[1] > signal[1]-signal[2]) and direction > 0
    const isCall = tema[i] > dema[i] &&
      signal[i] > lowArr[i]! &&
      (signal[i] - signal[i - 1] > signal[i - 1] - signal[i - 2]) &&
      dir > 0;

    // is_put = tema < dema and signal < high and (signal[1]-signal > signal[2]-signal[1]) and direction < 0
    const isPut = tema[i] < dema[i] &&
      signal[i] < highArr[i]! &&
      (signal[i - 1] - signal[i] > signal[i - 2] - signal[i - 1]) &&
      dir < 0;

    if (isCall) {
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'arrowUp',
        color: '#26A69A', // green
        text: '*BUY*',
      });
    }
    if (isPut) {
      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: '#EF5350', // red
        text: '*SELL*',
      });
    }
  }

  // ===== Signal 2: Supertrend arrows =====
  // Factor=3, Pd=1
  // Up=hl2-(Factor*atr(Pd)), Dn=hl2+(Factor*atr(Pd))
  // TrendUp=close[1]>TrendUp[1]? max(Up,TrendUp[1]) : Up
  // TrendDown=close[1]<TrendDown[1]? min(Dn,TrendDown[1]) : Dn
  // Trend = close > TrendDown[1] ? 1: close< TrendUp[1]? -1: nz(Trend[1],0)
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

  // plotarrow: Trend==1 and Trend[1]==-1 => up arrow (lime, transp=85)
  //            Trend==-1 and Trend[1]==1 => down arrow (red, transp=85)
  for (let i = warmup + 1; i < n; i++) {
    if (trend[i] === 1 && trend[i - 1] === -1) {
      markers.push({
        time: bars[i].time,
        position: 'belowBar',
        shape: 'arrowUp',
        color: 'rgba(0,230,118,0.15)', // lime transp=85
        text: '',
      });
    }
    if (trend[i] === -1 && trend[i - 1] === 1) {
      markers.push({
        time: bars[i].time,
        position: 'aboveBar',
        shape: 'arrowDown',
        color: 'rgba(239,83,80,0.15)', // red transp=85
        text: '',
      });
    }
  }

  // Sort markers by time
  markers.sort((a, b) => a.time - b.time);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'channelTop': channelTopPlot,
      'channelBottom': channelBottomPlot,
      'resistTop': resistTopPlot,
      'resistBottom': resistBottomPlot,
      'srTop': srTopPlot,
      'srBottom': srBottomPlot,
      'ema1': ema1Plot,
      'ema2': ema2Plot,
      'hullMA': hullMAPlot,
    },
    fills: [
      // fill(ul2, ll2, color=black, transp=90) -- body channel
      { plot1: 'channelTop', plot2: 'channelBottom', options: { color: 'rgba(0,0,0,0.10)', title: 'Candle body resistance Channel' } },
      // fill(ul2, RT2, color=red, transp=75) -- resistance
      { plot1: 'channelTop', plot2: 'srTop', options: { color: 'rgba(255,0,0,0.25)', title: 'Resistance Fill' } },
      // fill(ll2, RB2, color=green, transp=75) -- support
      { plot1: 'channelBottom', plot2: 'srBottom', options: { color: 'rgba(0,128,0,0.25)', title: 'Support Fill' } },
    ],
    markers,
  };
}

export const VdubSniper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
