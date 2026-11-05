/**
 * CM Guppy EMA
 *
 * Guppy system: 6 short EMAs (3,5,8,10,12,15) + 6 long EMAs (30,35,40,45,50,60).
 * Short group shows trader activity, long group shows investor sentiment.
 *
 * Reference: "CM_Guppy EMA" by ChrisMoody
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CMGuppyEMAInputs {
  src: SourceType;
}

export const defaultInputs: CMGuppyEMAInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short EMA 3', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Short EMA 5', color: '#2E7D32', lineWidth: 1 },
  { id: 'plot2', title: 'Short EMA 8', color: '#388E3C', lineWidth: 1 },
  { id: 'plot3', title: 'Short EMA 10', color: '#43A047', lineWidth: 1 },
  { id: 'plot4', title: 'Short EMA 12', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot5', title: 'Short EMA 15', color: '#66BB6A', lineWidth: 1 },
  { id: 'plot6', title: 'Long EMA 30', color: '#EF5350', lineWidth: 1 },
  { id: 'plot7', title: 'Long EMA 35', color: '#E53935', lineWidth: 1 },
  { id: 'plot8', title: 'Long EMA 40', color: '#D32F2F', lineWidth: 1 },
  { id: 'plot9', title: 'Long EMA 45', color: '#C62828', lineWidth: 1 },
  { id: 'plot10', title: 'Long EMA 50', color: '#B71C1C', lineWidth: 1 },
  { id: 'plot11', title: 'Long EMA 60', color: '#880E4F', lineWidth: 1 },
];

export const metadata = {
  title: 'CM Guppy EMA',
  shortTitle: 'GuppyEMA',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface GuppyRun extends BarRunState<Record<string, never>> {
  emas: ReturnType<typeof taStep.ema>[];
  e: number[];
  plotData: Point[][];
  shortFillColors: string[];
  longFillColors: string[];
}

const shortLengths = [3, 5, 8, 10, 12, 15];
const longLengths = [30, 35, 40, 45, 50, 60];
const allLengths = [...shortLengths, ...longLengths];
const warmup = 60;

function study(inputs: Partial<CMGuppyEMAInputs>): BarStudy<GuppyRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const emas = allLengths.map((len) => taStep.ema(len));
      const s: GuppyRun = {
        emas, e: new Array(allLengths.length).fill(NaN), plotData: allLengths.map(() => []), shortFillColors: [],
        longFillColors: [], steps: emas, vars: {}, lists: [], series: [],
      };
      s.series = [...s.plotData, s.shortFillColors, s.longFillColors];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const v = value(bars[i]);
      const e = s.e;
      for (let idx = 0; idx < allLengths.length; idx++) e[idx] = s.emas[idx].step(v);

      // Pine color rules:
      // colfastL = ema1>ema2>ema3>ema4>ema5>ema6 (fast group aligned up)
      // colfastS = ema1<ema2<ema3<ema4<ema5<ema6 (fast group aligned down)
      // colslowL = ema7>ema8>ema9>ema10>ema11>ema12 (slow group aligned up)
      // colslowS = ema7<ema8<ema9<ema10<ema11<ema12 (slow group aligned down)
      // Fast EMAs: colFinal = colfastL && colslowL ? aqua : colfastS && colslowS ? orange : gray
      // Slow EMAs: colFinal2 = colslowL ? lime : colslowS ? red : gray
      const colfastL = e[0]>e[1] && e[1]>e[2] && e[2]>e[3] && e[3]>e[4] && e[4]>e[5];
      const colfastS = e[0]<e[1] && e[1]<e[2] && e[2]<e[3] && e[3]<e[4] && e[4]<e[5];
      const colslowL = e[6]>e[7] && e[7]>e[8] && e[8]>e[9] && e[9]>e[10] && e[10]>e[11];
      const colslowS = e[6]<e[7] && e[7]<e[8] && e[8]<e[9] && e[9]<e[10] && e[10]<e[11];
      // Fast EMA color / slow EMA color
      const fastColor = (colfastL && colslowL) ? '#00FFFF' : (colfastS && colslowS) ? '#FFA500' : '#808080';
      const slowColor = colslowL ? '#00FF00' : colslowS ? '#FF0000' : '#808080';

      for (let idx = 0; idx < allLengths.length; idx++) {
        const ev = e[idx];
        s.plotData[idx][i] = i < warmup || isNaN(ev)
          ? { time, value: NaN }
          : { time, value: ev, color: idx < 6 ? fastColor : slowColor };
      }

      // Short cloud fill between plot0 (EMA 3) and plot5 (EMA 15)
      s.shortFillColors[i] = i < warmup ? 'transparent' : '#26A69A40';
      // Long cloud fill between plot6 (EMA 30) and plot11 (EMA 60)
      s.longFillColors[i] = i < warmup ? 'transparent' : '#EF535040';
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      for (let idx = 0; idx < allLengths.length; idx++) plots[`plot${idx}`] = s.plotData[idx].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          { plot1: 'plot0', plot2: 'plot5', colors: s.shortFillColors.slice() },
          { plot1: 'plot6', plot2: 'plot11', colors: s.longFillColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CMGuppyEMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMGuppyEMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CMGuppyEMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
