/**
 * Range Detector
 *
 * Detects trading ranges where price stays within ATR bands around SMA.
 * Counts bars where close deviates more than ATR from SMA; range when count=0.
 * Plots max/min range boundaries with per-bar colors (blue=unbroken, green=broken up, red=broken down).
 *
 * Reference: TradingView "Range Detector [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, BoxData, LineDrawingData } from '../types';

export interface RangeDetectorInputs {
  length: number;
  mult: number;
  atrLen: number;
}

export const defaultInputs: RangeDetectorInputs = {
  length: 20,
  mult: 1,
  atrLen: 500,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Minimum Range Length', defval: 20, min: 2 },
  { id: 'mult', type: 'float', title: 'Range Width', defval: 1, min: 0, step: 0.1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 500, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Range Top', color: '#2157f3', lineWidth: 2 },
  { id: 'plot1', title: 'Range Bottom', color: '#2157f3', lineWidth: 2 },
];

export const metadata = {
  title: 'Range Detector',
  shortTitle: 'RangeDet',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RangeDetectorInputs> = {}): IndicatorResult & { bgColors: BgColorData[]; boxes: BoxData[]; lines: LineDrawingData[] } {
  const { length, mult, atrLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);
  const atrArr = ta.atr(bars, atrLen).toArray();
  const maArr = ta.sma(closeSeries, length).toArray();

  const upCss = '#089981';
  const dnCss = '#f23645';
  const unbrokenCss = '#2157f3';

  // State variables matching Pine
  let max = NaN;
  let min = NaN;
  let os = 0; // 0=unbroken, 1=broken up, -1=broken down
  // Track box coordinates: left bar index, top, bottom, right
  let bxRight = -1;
  let bxTop = NaN;
  let bxBottom = NaN;

  const maxArr: number[] = new Array(n).fill(NaN);
  const minArr: number[] = new Array(n).fill(NaN);
  const osArr: number[] = new Array(n).fill(0);
  const bgColors: BgColorData[] = [];

  // Track range segments for boxes and midlines
  interface RangeSeg { leftBar: number; rightBar: number; top: number; bottom: number; mid: number; os: number }
  const rangeSegs: RangeSeg[] = [];
  let curSeg: RangeSeg | null = null;

  for (let i = 0; i < n; i++) {
    const atr = (atrArr[i] ?? 0) * mult;
    const ma = maArr[i] ?? bars[i].close;

    // Count bars where |close - ma| > atr within lookback
    let count = 0;
    for (let j = 0; j < length && (i - j) >= 0; j++) {
      if (Math.abs(bars[i - j].close - ma) > atr) count++;
    }

    // Previous count
    let prevCount = -1;
    if (i > 0) {
      const prevAtr = (atrArr[i - 1] ?? 0) * mult;
      const prevMa = maArr[i - 1] ?? bars[i - 1].close;
      prevCount = 0;
      for (let j = 0; j < length && (i - 1 - j) >= 0; j++) {
        if (Math.abs(bars[i - 1 - j].close - prevMa) > prevAtr) prevCount++;
      }
    }

    let detectBg = false;

    if (count === 0 && prevCount !== 0 && prevCount !== -1) {
      // New range detected
      // Check for overlap with previous box
      const rangeLeft = i - length;
      if (rangeLeft <= bxRight && !isNaN(bxTop)) {
        // Overlap: extend existing range
        max = Math.max(ma + atr, bxTop);
        min = Math.min(ma - atr, bxBottom);
        bxTop = max;
        bxBottom = min;
        bxRight = i;
        if (curSeg) {
          curSeg.top = max;
          curSeg.bottom = min;
          curSeg.mid = (max + min) / 2;
          curSeg.rightBar = i;
        }
      } else {
        // New range - finalize previous segment
        if (curSeg) rangeSegs.push(curSeg);
        max = ma + atr;
        min = ma - atr;
        bxTop = max;
        bxBottom = min;
        bxRight = i;
        detectBg = true;
        os = 0;
        curSeg = { leftBar: Math.max(0, i - length), rightBar: i, top: max, bottom: min, mid: ma, os: 0 };
      }
    } else if (count === 0) {
      // Extend current range
      bxRight = i;
      if (curSeg) curSeg.rightBar = i;
    }

    // Check for breakout
    if (!isNaN(bxTop)) {
      if (bars[i].close > bxTop) {
        os = 1;
      } else if (bars[i].close < bxBottom) {
        os = -1;
      }
      if (curSeg) curSeg.os = os;
    }

    maxArr[i] = max;
    minArr[i] = min;
    osArr[i] = os;

    if (detectBg) {
      bgColors.push({ time: bars[i].time, color: 'rgba(128,128,128,0.20)' });
    }
  }

  // Build plots with per-bar colors
  // Pine: color = max != max[1] ? na : os == 0 ? unbrokenCss : os == 1 ? upCss : dnCss
  const plot0 = maxArr.map((v, i) => {
    const changed = i > 0 && maxArr[i] !== maxArr[i - 1];
    const color = changed ? 'transparent' : osArr[i] === 0 ? unbrokenCss : osArr[i] === 1 ? upCss : dnCss;
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = minArr.map((v, i) => {
    const changed = i > 0 && minArr[i] !== minArr[i - 1];
    const color = changed ? 'transparent' : osArr[i] === 0 ? unbrokenCss : osArr[i] === 1 ? upCss : dnCss;
    return { time: bars[i].time, value: v, color };
  });

  // Finalize last range segment
  if (curSeg) rangeSegs.push(curSeg);

  // Convert range segments to BoxData[] and LineDrawingData[]
  const boxes: BoxData[] = [];
  const lines: LineDrawingData[] = [];
  for (const seg of rangeSegs) {
    const css = seg.os === 0 ? unbrokenCss : seg.os === 1 ? upCss : dnCss;
    boxes.push({
      time1: bars[seg.leftBar].time, price1: seg.top,
      time2: bars[seg.rightBar].time, price2: seg.bottom,
      bgColor: css + '33', borderColor: 'transparent',
    });
    lines.push({
      time1: bars[seg.leftBar].time, price1: seg.mid,
      time2: bars[seg.rightBar].time, price2: seg.mid,
      color: css, width: 1, style: 'dotted',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    bgColors,
    boxes,
    lines,
  };
}

export const RangeDetector = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
