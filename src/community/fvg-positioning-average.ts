/**
 * FVG Positioning Average
 *
 * Identifies Fair Value Gaps (bullish: low > high[2], bearish: high < low[2])
 * and computes weighted averages of recent FVG levels. ATR filter for minimum gap size.
 * Tracks arrays of bullish/bearish gaps within a lookback and plots their averages.
 *
 * Reference: "FVG Positioning Average [LuxAlgo]" by LuxAlgo
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BoxData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FvgPositioningAverageInputs {
  lookback: number;
  lookbackType: string;
  atrMultiplier: number;
}

export const defaultInputs: FvgPositioningAverageInputs = {
  lookback: 30,
  lookbackType: 'Bar Count',
  atrMultiplier: 0.25,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'FVG Lookback', defval: 30, min: 1 },
  { id: 'lookbackType', type: 'string', title: 'Lookback Type', defval: 'Bar Count', options: ['Bar Count', 'FVG Count'] },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 0.25, min: 0, step: 0.25 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull Average', color: '#089981', lineWidth: 2 },
  { id: 'plot1', title: 'Bear Average', color: '#f23645', lineWidth: 2 },
  { id: 'ul', title: 'Plot', color: 'transparent', lineWidth: 0, display: 'none' },
  { id: 'dl', title: 'Plot', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'FVG Positioning Average',
  shortTitle: 'FVG Pos Avg',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { boxes: BoxData[] };
type Fvg = { barIdx: number; value: number };

interface FvgVars {
  /** Cumulative (high - low) for the fallback ATR */
  cumSum: number;
  /** FVG arrays: { barIndex, value } for bullish (bottom of gap) and bearish (top of gap); changed in place */
  upFvgs: Fvg[];
  downFvgs: Fvg[];
}

interface FvgRun extends BarRunState<FvgVars> {
  atr: ReturnType<typeof taStep.atr>;
  hst: WindowExtreme;
  lst: WindowExtreme;
  upSma: WindowSma;
  downSma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  ul: Point[];
  dl: Point[];
  up: { topValue: number[]; bottomValue: number[]; topColor: (string | null)[]; bottomColor: (string | null)[] };
  down: { topValue: number[]; bottomValue: number[]; topColor: (string | null)[]; bottomColor: (string | null)[] };
  boxes: BoxData[];
}

function study(inputs: Partial<FvgPositioningAverageInputs>): BarStudy<FvgRun, Result> {
  const { lookback, lookbackType, atrMultiplier } = { ...defaultInputs, ...inputs };
  const invis = '#00000000'; // Pine: color.rgb(0,0,0,100); also color.new(chart.bg_color,100)
  const greenFill = color.new_color('#089981', 50) as string;
  const redFill = color.new_color('#f23645', 50) as string;
  const gradient = () => ({ topValue: [] as number[], bottomValue: [] as number[], topColor: [] as (string | null)[], bottomColor: [] as (string | null)[] });
  return {
    init() {
      const s: FvgRun = {
        // ATR(200); Highest(5) and Lowest(5) for display visibility
        atr: taStep.atr(200), hst: new WindowExtreme(false, 5), lst: new WindowExtreme(true, 5),
        upSma: new WindowSma(10), downSma: new WindowSma(10),
        plot0: [], plot1: [], ul: [], dl: [], up: gradient(), down: gradient(), boxes: [],
        steps: [], vars: { cumSum: 0, upFvgs: [], downFvgs: [] }, lists: [], series: [],
      };
      s.steps = [s.atr, s.hst, s.lst, s.upSma, s.downSma];
      s.lists = [s.boxes];
      s.series = [s.plot0, s.plot1, s.ul, s.dl, ...Object.values(s.up), ...Object.values(s.down)];
      return s;
    },
    copyVars: (v) => ({ cumSum: v.cumSum, upFvgs: v.upFvgs.slice(), downFvgs: v.downFvgs.slice() }),
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const { upFvgs, downFvgs } = v;
      const atrV = s.atr.step(b.high, b.low, b.close);
      v.cumSum += b.high - b.low;
      const cumHl = v.cumSum / (i + 1);
      // ATR with fallback
      const atr = !isNaN(atrV) && atrV !== 0 ? atrV * atrMultiplier : cumHl * atrMultiplier;

      // FVG Detection (need at least 3 bars)
      if (i >= 2) {
        const low0 = b.low;
        const high2 = bars[i - 2].high;
        const close1 = bars[i - 1].close;
        const high0 = b.high;
        const low2 = bars[i - 2].low;

        // Bullish FVG: low > high[2] and close[1] > high[2] and gap > atr
        if (low0 > high2 && close1 > high2 && (low0 - high2) > atr) {
          upFvgs.push({ barIdx: i, value: high2 }); // bottom of gap = high[2]
          // Box: left=bar[2], top=current low, right=current bar, bottom=high[2]
          s.boxes.push({
            time1: bars[i - 2].time, price1: low0,
            time2: b.time, price2: high2,
            bgColor: 'rgba(8,153,129,0.50)', borderColor: 'rgba(8,153,129,0.50)',
          });
        }

        // Bearish FVG: high < low[2] and close[1] < low[2] and gap > atr
        if (high0 < low2 && close1 < low2 && (low2 - high0) > atr) {
          downFvgs.push({ barIdx: i, value: high0 }); // top of gap = high[0]
          // Box: left=bar[2], top=low[2], right=current bar, bottom=current high
          s.boxes.push({
            time1: bars[i - 2].time, price1: low2,
            time2: b.time, price2: high0,
            bgColor: 'rgba(242,54,69,0.50)', borderColor: 'rgba(242,54,69,0.50)',
          });
        }
      }

      // Array size management
      if (lookbackType === 'FVG Count') {
        while (upFvgs.length > lookback) upFvgs.shift();
        while (downFvgs.length > lookback) downFvgs.shift();
      } else {
        // Bar Count: remove FVGs older than lookback bars
        while (upFvgs.length > 0 && upFvgs[0].barIdx < i - lookback) upFvgs.shift();
        while (downFvgs.length > 0 && downFvgs[0].barIdx < i - lookback) downFvgs.shift();
      }

      // Compute averages
      let upAvg = NaN;
      if (upFvgs.length > 0) {
        let sum = 0;
        for (let j = 0; j < upFvgs.length; j++) sum += upFvgs[j].value;
        upAvg = sum / upFvgs.length;
      }

      let downAvg = NaN;
      if (downFvgs.length > 0) {
        let sum = 0;
        for (let j = 0; j < downFvgs.length; j++) sum += downFvgs[j].value;
        downAvg = sum / downFvgs.length;
      }

      // Pine: plot up_avg only if hst >= up_avg (transparent otherwise)
      const hst = s.hst.step(b.high);
      const lst = s.lst.step(b.low);

      const upVisible = !isNaN(upAvg) && hst >= upAvg;
      const downVisible = !isNaN(downAvg) && lst <= downAvg;

      s.plot0[i] = { time: b.time, value: upAvg, color: upVisible ? '#089981' : 'transparent' };
      s.plot1[i] = { time: b.time, value: downAvg, color: downVisible ? '#f23645' : 'transparent' };

      // Pine: c_mid_h = math.max(math.avg(open,close),up_avg); c_mid_l = math.min(math.avg(open,close),down_avg)
      const cMidH = Math.max((b.open + b.close) / 2, upAvg);
      const cMidL = Math.min((b.open + b.close) / 2, downAvg);
      const upSma = s.upSma.step(upAvg);
      const downSma = s.downSma.step(downAvg);
      // Pine: ul = plot(c_mid_h,display = display.none, editable = false)
      s.ul[i] = { time: b.time, value: cMidH };
      // Pine: dl = plot(c_mid_l,display = display.none, editable = false)
      s.dl[i] = { time: b.time, value: cMidL };

      // Pine: fill(ua, ul, c_mid_h, math.min(ta.sma(up_avg,10),up_avg), color.new(chart.bg_color,100),
      //   c_mid_h<=up_avg?invis:color.new(green,50))
      s.up.topValue[i] = cMidH;
      s.up.bottomValue[i] = Math.min(upSma, upAvg);
      s.up.topColor[i] = invis;
      s.up.bottomColor[i] = cMidH <= upAvg ? invis : greenFill;
      // Pine: fill(da, dl, math.max(ta.sma(down_avg,10),down_avg), c_mid_l,
      //   c_mid_l>=down_avg?invis:color.new(red,50), color.new(chart.bg_color,100))
      s.down.topValue[i] = Math.max(downSma, downAvg);
      s.down.bottomValue[i] = cMidL;
      s.down.topColor[i] = cMidL >= downAvg ? invis : redFill;
      s.down.bottomColor[i] = invis;
    },
    result(s) {
      const g = (x: FvgRun['up']) => ({
        topValue: x.topValue.slice(), bottomValue: x.bottomValue.slice(), topColor: x.topColor.slice(), bottomColor: x.bottomColor.slice(),
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.plot0.slice(),
          'plot1': s.plot1.slice(),
          'ul': s.ul.slice(),
          'dl': s.dl.slice(),
        },
        fills: [
          { plot1: 'plot0', plot2: 'ul', gradient: g(s.up) },
          { plot1: 'plot1', plot2: 'dl', gradient: g(s.down) },
        ],
        boxes: s.boxes.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FvgPositioningAverageInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FvgPositioningAverageInputs> = {}): Omit<IndicatorResult, 'markers'> & { boxes: BoxData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const FvgPositioningAverage = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
