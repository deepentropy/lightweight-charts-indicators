/**
 * Range Detector
 *
 * Detects trading ranges where price stays within ATR bands around SMA.
 * Counts bars where close deviates more than ATR from SMA; range when count=0.
 * Plots max/min range boundaries with per-bar colors (blue=unbroken, green=broken up, red=broken down).
 *
 * Reference: "Range Detector [LuxAlgo]" by LuxAlgo
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, BoxData, LineDrawingData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[]; boxes: BoxData[]; lines: LineDrawingData[] };
type Point = { time: number; value: number; color?: string };
// Track range segments for boxes and midlines
interface RangeSeg { leftBar: number; rightBar: number; top: number; bottom: number; mid: number; os: number }

interface RangeVars {
  max: number;
  min: number;
  /** 0=unbroken, 1=broken up, -1=broken down */
  os: number;
  // Track box coordinates: left bar index, top, bottom, right
  bxRight: number;
  bxTop: number;
  bxBottom: number;
  /** The current segment (changed in place: copied in copyVars) */
  curSeg: RangeSeg | null;
}

interface RangeRun extends BarRunState<RangeVars> {
  atr: ReturnType<typeof taStep.atr>;
  sma: WindowSma;
  counts: number[];
  maxArr: number[];
  minArr: number[];
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
  rangeSegs: RangeSeg[];
}

const upCss = '#089981';
const dnCss = '#f23645';
const unbrokenCss = '#2157f3';

function study(inputs: Partial<RangeDetectorInputs>): BarStudy<RangeRun, Result> {
  const { length, mult, atrLen } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const atr = taStep.atr(atrLen);
      const sma = new WindowSma(length);
      // State variables matching Pine
      const s: RangeRun = {
        atr, sma, counts: [], maxArr: [], minArr: [], plot0: [], plot1: [], bgColors: [], rangeSegs: [],
        steps: [atr, sma],
        vars: { max: NaN, min: NaN, os: 0, bxRight: -1, bxTop: NaN, bxBottom: NaN, curSeg: null },
        lists: [], series: [],
      };
      s.lists = [s.bgColors, s.rangeSegs];
      s.series = [s.counts, s.maxArr, s.minArr, s.plot0, s.plot1];
      return s;
    },
    copyVars: (v) => ({ ...v, curSeg: v.curSeg ? { ...v.curSeg } : null }),
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const atr = (s.atr.step(b.high, b.low, b.close) ?? 0) * mult;
      const ma = s.sma.step(b.close) ?? b.close;

      // Count bars where |close - ma| > atr within lookback
      let count = 0;
      for (let j = 0; j < length && (i - j) >= 0; j++) {
        if (Math.abs(bars[i - j].close - ma) > atr) count++;
      }
      s.counts[i] = count;

      // Previous count
      const prevCount = i > 0 ? s.counts[i - 1] : -1;

      let detectBg = false;

      if (count === 0 && prevCount !== 0 && prevCount !== -1) {
        // New range detected
        // Check for overlap with previous box
        const rangeLeft = i - length;
        if (rangeLeft <= v.bxRight && !isNaN(v.bxTop)) {
          // Overlap: extend existing range
          v.max = Math.max(ma + atr, v.bxTop);
          v.min = Math.min(ma - atr, v.bxBottom);
          v.bxTop = v.max;
          v.bxBottom = v.min;
          v.bxRight = i;
          if (v.curSeg) {
            v.curSeg.top = v.max;
            v.curSeg.bottom = v.min;
            v.curSeg.mid = (v.max + v.min) / 2;
            v.curSeg.rightBar = i;
          }
        } else {
          // New range - finalize previous segment
          if (v.curSeg) s.rangeSegs.push(v.curSeg);
          v.max = ma + atr;
          v.min = ma - atr;
          v.bxTop = v.max;
          v.bxBottom = v.min;
          v.bxRight = i;
          detectBg = true;
          v.os = 0;
          v.curSeg = { leftBar: Math.max(0, i - length), rightBar: i, top: v.max, bottom: v.min, mid: ma, os: 0 };
        }
      } else if (count === 0) {
        // Extend current range
        v.bxRight = i;
        if (v.curSeg) v.curSeg.rightBar = i;
      }

      // Check for breakout
      if (!isNaN(v.bxTop)) {
        if (b.close > v.bxTop) {
          v.os = 1;
        } else if (b.close < v.bxBottom) {
          v.os = -1;
        }
        if (v.curSeg) v.curSeg.os = v.os;
      }

      s.maxArr[i] = v.max;
      s.minArr[i] = v.min;
      const os = v.os;

      if (detectBg) {
        s.bgColors.push({ time: b.time, color: 'rgba(128,128,128,0.20)' });
      }

      // Build plots with per-bar colors
      // Pine: color = max != max[1] ? na : os == 0 ? unbrokenCss : os == 1 ? upCss : dnCss
      const maxChanged = i > 0 && s.maxArr[i] !== s.maxArr[i - 1];
      s.plot0[i] = { time: b.time, value: v.max, color: maxChanged ? 'transparent' : os === 0 ? unbrokenCss : os === 1 ? upCss : dnCss };
      const minChanged = i > 0 && s.minArr[i] !== s.minArr[i - 1];
      s.plot1[i] = { time: b.time, value: v.min, color: minChanged ? 'transparent' : os === 0 ? unbrokenCss : os === 1 ? upCss : dnCss };
    },
    result(s, bars) {
      // Finalize last range segment
      const rangeSegs = s.vars.curSeg ? [...s.rangeSegs, s.vars.curSeg] : s.rangeSegs;

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
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        bgColors: s.bgColors.slice(),
        boxes,
        lines,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RangeDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RangeDetectorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RangeDetector = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
