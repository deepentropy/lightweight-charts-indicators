/**
 * Triangular Momentum Oscillator & Real Time Divergences [LuxAlgo]
 *
 * osc = mom(sma(sma(src, length), length), length)
 * Momentum of a double-SMA smoothed source.
 * Histogram with 4-color scheme + divergence markers and lines.
 *
 * Reference: TradingView "Triangular Momentum Oscillator & Real Time Divergences [LuxAlgo]"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';

export interface TriangularMomentumOscInputs {
  length: number;
  src: SourceType;
  showLines: boolean;
}

export const defaultInputs: TriangularMomentumOscInputs = {
  length: 7,
  src: 'close',
  showLines: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 7, min: 2 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showLines', type: 'bool', title: 'Show Lines', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Osc', color: '#2962FF', lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'Triangular Momentum Oscillator',
  shortTitle: 'TMO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TriangularMomentumOscInputs> = {}): IndicatorResult & { markers: MarkerData[]; lines: LineDrawingData[] } {
  const { length, src, showLines } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const source = getSourceSeries(bars, src);

  // Pine: osc = mom(sma(sma(src, length), length), length)
  // Step 1: sma(src, length)
  const sma1 = ta.sma(source, length);
  // Step 2: sma(sma1, length)
  const sma2 = ta.sma(sma1, length);
  const sma2Arr = sma2.toArray();

  // Step 3: mom(sma2, length) = sma2 - sma2[length]
  const oscArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < length || sma2Arr[i] == null || sma2Arr[i - length] == null) {
      oscArr[i] = NaN;
    } else {
      oscArr[i] = sma2Arr[i]! - sma2Arr[i - length]!;
    }
  }

  // Pine: up = highest(src, length), dn = lowest(src, length)
  const srcArr = source.toArray();
  const upArr: number[] = new Array(n);
  const dnArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < length - 1) {
      upArr[i] = NaN;
      dnArr[i] = NaN;
    } else {
      let hi = -Infinity, lo = Infinity;
      for (let j = i - length + 1; j <= i; j++) {
        const v = srcArr[j];
        if (v != null) {
          if (v > hi) hi = v;
          if (v < lo) lo = v;
        }
      }
      upArr[i] = hi === -Infinity ? NaN : hi;
      dnArr[i] = lo === Infinity ? NaN : lo;
    }
  }

  // Warmup: need length bars for sma1, another length for sma2, another length for mom
  const warmup = 3 * length - 2;

  // Histogram plot with 4-color conditional coloring (Pine: simple_css)
  const plot0 = oscArr.map((val, i) => {
    if (isNaN(val) || i < warmup) return { time: bars[i].time, value: NaN };
    const prev = (i > 0 && !isNaN(oscArr[i - 1]) && i - 1 >= warmup) ? oscArr[i - 1] : val;
    let color: string;
    if (val > 0) {
      color = (val > prev) ? '#00c42b' : '#4ee567';
    } else {
      color = (val < prev) ? '#ff441f' : '#c03920';
    }
    return { time: bars[i].time, value: val, color };
  });

  const markers: MarkerData[] = [];
  const lines: LineDrawingData[] = [];

  // Divergence detection using valuewhen logic from Pine:
  // phosc = crossunder(change(osc), 0) -- peak in osc
  // plosc = crossover(change(osc), 0) -- trough in osc
  // Track previous crossover/crossunder bar indices and values for valuewhen

  // For phosc (bearish peaks): stores { idx, osc, up } at each crossunder
  let prevPhoscIdx = -1, prevPhoscOsc = NaN, prevPhoscUp = NaN;
  let curPhoscIdx = -1, curPhoscOsc = NaN, curPhoscUp = NaN;

  // For plosc (bullish troughs): stores { idx, osc, dn } at each crossover
  let prevPloscIdx = -1, prevPloscOsc = NaN, prevPloscDn = NaN;
  let curPloscIdx = -1, curPloscOsc = NaN, curPloscDn = NaN;

  for (let i = warmup + 2; i < n; i++) {
    const osc = oscArr[i];
    const oscPrev = oscArr[i - 1];
    const oscPrev2 = oscArr[i - 2];
    if (isNaN(osc) || isNaN(oscPrev) || isNaN(oscPrev2)) continue;

    const chg = osc - oscPrev;
    const prevChg = oscPrev - oscPrev2;

    // phosc: crossunder(change(osc), 0) -- prevChg > 0 && chg <= 0
    const phosc = prevChg > 0 && chg <= 0;
    // plosc: crossover(change(osc), 0) -- prevChg < 0 && chg >= 0
    const plosc = prevChg < 0 && chg >= 0;

    if (phosc) {
      prevPhoscIdx = curPhoscIdx;
      prevPhoscOsc = curPhoscOsc;
      prevPhoscUp = curPhoscUp;
      curPhoscIdx = i;
      curPhoscOsc = osc;
      curPhoscUp = upArr[i];
    }

    if (plosc) {
      prevPloscIdx = curPloscIdx;
      prevPloscOsc = curPloscOsc;
      prevPloscDn = curPloscDn;
      curPloscIdx = i;
      curPloscOsc = osc;
      curPloscDn = dnArr[i];
    }

    // Pine: bear = osc > 0 and phosc and valuewhen(phosc,osc,0) < valuewhen(phosc,osc,1)
    //        and valuewhen(phosc,up,0) > valuewhen(phosc,up,1)
    const bear = osc > 0 && phosc &&
      !isNaN(curPhoscOsc) && !isNaN(prevPhoscOsc) &&
      curPhoscOsc < prevPhoscOsc &&
      !isNaN(curPhoscUp) && !isNaN(prevPhoscUp) &&
      curPhoscUp > prevPhoscUp;

    // Pine: bull = osc < 0 and plosc and valuewhen(plosc,osc,0) > valuewhen(plosc,osc,1)
    //        and valuewhen(plosc,dn,0) < valuewhen(plosc,dn,1)
    const bull = osc < 0 && plosc &&
      !isNaN(curPloscOsc) && !isNaN(prevPloscOsc) &&
      curPloscOsc > prevPloscOsc &&
      !isNaN(curPloscDn) && !isNaN(prevPloscDn) &&
      curPloscDn < prevPloscDn;

    // Pine: plotshape(iff(bull,osc,na), shape.circle, location.absolute, #00c42b)
    // Pine: plotshape(iff(bull,osc,na), shape.labelup, location.absolute, #00c42b, text="Buy")
    if (bull) {
      markers.push({ time: bars[i].time, position: 'inBar', shape: 'circle', color: '#00c42b' });
      markers.push({ time: bars[i].time, position: 'inBar', shape: 'labelUp', color: '#00c42b', text: 'Buy' });
    }

    // Pine: plotshape(iff(bear,osc,na), shape.circle, location.absolute, #ff441f)
    // Pine: plotshape(iff(bear,osc,na), shape.labeldown, location.absolute, #ff441f, text="Sell")
    if (bear) {
      markers.push({ time: bars[i].time, position: 'inBar', shape: 'circle', color: '#ff441f' });
      markers.push({ time: bars[i].time, position: 'inBar', shape: 'labelDown', color: '#ff441f', text: 'Sell' });
    }

    // Pine: line.new from previous crossover/crossunder to current
    if (showLines) {
      if (bull && prevPloscIdx >= 0) {
        // bull_line := line.new(bull_x1, bull_y1, n, osc, color=#00c42b)
        lines.push({
          time1: bars[prevPloscIdx].time, price1: prevPloscOsc,
          time2: bars[i].time, price2: osc,
          color: '#00c42b', width: 1, style: 'solid',
        });
      }
      if (bear && prevPhoscIdx >= 0) {
        // bear_line := line.new(bear_x1, bear_y1, n, osc, color=#ff441f)
        lines.push({
          time1: bars[prevPhoscIdx].time, price1: prevPhoscOsc,
          time2: bars[i].time, price2: osc,
          color: '#ff441f', width: 1, style: 'solid',
        });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
    ],
    markers,
    lines,
  };
}

export const TriangularMomentumOsc = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
