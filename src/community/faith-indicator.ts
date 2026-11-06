/**
 * Faith Indicator
 *
 * Momentum-based indicator. Faith = EMA(close, fast) - EMA(close, slow).
 * Signal = SMA(faith, 9). Histogram colored by faith vs signal.
 *
 * Reference: "Faith Indicator" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface FaithIndicatorInputs {
  fastLen: number;
  slowLen: number;
}

export const defaultInputs: FaithIndicatorInputs = {
  fastLen: 14,
  slowLen: 28,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 14, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 28, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Grade of Faith', color: '#2962FF', lineWidth: 5, style: 'histogram' },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Faith Indicator',
  shortTitle: 'Faith',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] };

interface FaithRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  signal: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  fh: ReturnType<typeof taStep.hma>;
  sh: ReturnType<typeof taStep.hma>;
  fhArr: number[];
  shArr: number[];
  faithPlot: Point[];
  signalPlot: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<FaithIndicatorInputs>): BarStudy<FaithRun, Result> {
  const { fastLen, slowLen } = { ...defaultInputs, ...inputs };
  const warmup = slowLen + 9;
  return {
    init() {
      const s: FaithRun = {
        fast: taStep.ema(fastLen), slow: taStep.ema(slowLen), signal: new WindowSma(9),
        // fhl=20, shl=25, trnd=0.1, istrend = 0.1 * ATR(30)
        atr: taStep.atr(30), fh: taStep.hma(20), sh: taStep.hma(25),
        fhArr: [], shArr: [], faithPlot: [], signalPlot: [], bgColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.signal, s.atr, s.fh, s.sh];
      s.lists = [s.bgColors];
      s.series = [s.fhArr, s.shArr, s.faithPlot, s.signalPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.fast.step(b.close) - s.slow.step(b.close);
      const sig = s.signal.step(v);

      if (i < warmup) s.faithPlot[i] = { time, value: NaN };
      else {
        // Pine: dif > 0 ? color.blue : color.red
        const color = v > 0 ? '#2962FF' : '#EF5350';
        s.faithPlot[i] = { time, value: v, color };
      }
      s.signalPlot[i] = { time, value: i < warmup || isNaN(sig) ? NaN : sig };

      // Background color from Hull MA agreement (Pine: hullag = ftrend + strend)
      const atrVal = s.atr.step(b.high, b.low, b.close);
      s.fhArr[i] = s.fh.step(b.close);
      s.shArr[i] = s.sh.step(b.close);
      if (i < 1 || isNaN(atrVal)) return;
      const istrend = 0.1 * atrVal;
      const fh = s.fhArr[i];
      const fhPrev = s.fhArr[i - 1];
      const sh = s.shArr[i];
      const shPrev = s.shArr[i - 1];
      if (isNaN(fh) || isNaN(fhPrev) || isNaN(sh) || isNaN(shPrev)) return;
      const fangle = fh - fhPrev;
      const sangle = sh - shPrev;
      const ftrend = fangle > istrend ? 1 : fangle < -istrend ? -1 : 0;
      const strend = sangle > istrend ? 1 : sangle < -istrend ? -1 : 0;
      const hullag = ftrend + strend;
      // Pine: 2=blue(65%), 1=green(75%), 0=silver(85%), -1=maroon(80%), -2=red(65%)
      let color: string;
      if (hullag === 2) color = 'rgba(33,150,243,0.15)';       // blue
      else if (hullag === 1) color = 'rgba(38,166,154,0.1)';   // green
      else if (hullag === 0) color = 'rgba(120,123,134,0.05)';  // silver/gray
      else if (hullag === -1) color = 'rgba(128,0,0,0.1)';     // maroon
      else color = 'rgba(239,83,80,0.15)';                      // red
      s.bgColors.push({ time, color });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.faithPlot.slice(), 'plot1': s.signalPlot.slice() },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FaithIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FaithIndicatorInputs> = {}): Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const FaithIndicator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
