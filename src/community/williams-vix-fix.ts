/**
 * CM Williams Vix Fix
 *
 * Finds market bottoms using synthetic VIX calculation.
 * WVF = (highest(close, pd) - low) / highest(close, pd) * 100
 * Highlights when WVF exceeds upper Bollinger Band or percentile range.
 *
 * Reference: "CM_Williams_Vix_Fix" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WilliamsVixFixInputs {
  pd: number;
  bbl: number;
  mult: number;
  lb: number;
  ph: number;
  pl: number;
  hp: boolean;
  sd: boolean;
}

export const defaultInputs: WilliamsVixFixInputs = {
  pd: 22,
  bbl: 20,
  mult: 2.0,
  lb: 50,
  ph: 0.85,
  pl: 1.01,
  hp: false,
  sd: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'pd', type: 'int', title: 'LookBack Period', defval: 22, min: 1 },
  { id: 'bbl', type: 'int', title: 'BB Length', defval: 20, min: 1 },
  { id: 'mult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'lb', type: 'int', title: 'Percentile Lookback', defval: 50, min: 1 },
  { id: 'ph', type: 'float', title: 'Highest Percentile', defval: 0.85, min: 0.01, step: 0.01 },
  { id: 'pl', type: 'float', title: 'Lowest Percentile', defval: 1.01, min: 0.01, step: 0.01 },
  { id: 'hp', type: 'bool', title: 'Show High Range', defval: false },
  { id: 'sd', type: 'bool', title: 'Show StdDev Line', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WVF', color: '#787B86', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Upper Band', color: '#00BCD4', lineWidth: 3 },
  { id: 'plot2', title: 'Range High Pct', color: '#FF9800', lineWidth: 4 },
  { id: 'plot3', title: 'Range Low Pct', color: '#FF9800', lineWidth: 4 },
];

export const metadata = {
  title: 'Williams Vix Fix',
  shortTitle: 'WVF',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface WvfRun extends BarRunState<Record<string, never>> {
  highestClose: WindowExtreme;
  mid: WindowSma;
  dev: WindowStdev;
  wvfHigh: WindowExtreme;
  wvfLow: WindowExtreme;
  wvfPlot: Point[];
  upperPlot: Point[];
  rangeHighPlot: Point[];
  rangeLowPlot: Point[];
}

function study(inputs: Partial<WilliamsVixFixInputs>): BarStudy<WvfRun, IndicatorResult> {
  const { pd, bbl, mult, lb, ph, pl, hp, sd } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(pd, bbl);
  return {
    init() {
      const highestClose = new WindowExtreme(false, pd);
      const mid = new WindowSma(bbl);
      const dev = new WindowStdev(bbl);
      const wvfHigh = new WindowExtreme(false, lb);
      const wvfLow = new WindowExtreme(true, lb);
      const s: WvfRun = {
        highestClose, mid, dev, wvfHigh, wvfLow, wvfPlot: [], upperPlot: [], rangeHighPlot: [], rangeLowPlot: [],
        steps: [highestClose, mid, dev, wvfHigh, wvfLow], vars: {}, lists: [], series: [],
      };
      s.series = [s.wvfPlot, s.upperPlot, s.rangeHighPlot, s.rangeLowPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // WVF
      const hc = s.highestClose.step(b.close);
      const v = hc == null || hc === 0 || isNaN(hc) ? 0 : ((hc - b.low) / hc) * 100;

      // BB on WVF
      const midLine = s.mid.step(v);
      const sDev = s.dev.step(v);

      // Percentile range
      const wvfHighest = s.wvfHigh.step(v);
      const wvfLowest = s.wvfLow.step(v);

      if (i < warmup) {
        s.wvfPlot[i] = { time, value: NaN };
      } else {
        const upperBand = (midLine ?? 0) + mult * (sDev ?? 0);
        const rangeHigh = (wvfHighest ?? 0) * ph;
        const alert = v >= upperBand || v >= rangeHigh;
        const color = alert ? '#00E676' : '#787B86';
        s.wvfPlot[i] = { time, value: v, color };
      }

      // Pine: plot(sd and upperBand ? upperBand : na) - conditional on sd input
      s.upperPlot[i] = !sd || i < warmup || midLine == null || sDev == null
        ? { time, value: NaN }
        : { time, value: midLine + mult * sDev };

      // Pine: plot(hp and rangeHigh ? rangeHigh : na) - conditional on hp input
      s.rangeHighPlot[i] = !hp || i < Math.max(warmup, lb) || wvfHighest == null || isNaN(wvfHighest)
        ? { time, value: NaN }
        : { time, value: wvfHighest * ph };

      // Pine: rangeLow = lowest(wvf, lb) * pl
      // Pine: plot(hp and rangeLow ? rangeLow : na, title="Range Low Percentile", style=line, linewidth=4, color=orange)
      s.rangeLowPlot[i] = !hp || i < Math.max(warmup, lb) || wvfLowest == null || isNaN(wvfLowest)
        ? { time, value: NaN }
        : { time, value: wvfLowest * pl };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.wvfPlot.slice(), 'plot1': s.upperPlot.slice(), 'plot2': s.rangeHighPlot.slice(), 'plot3': s.rangeLowPlot.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WilliamsVixFixInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WilliamsVixFixInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WilliamsVixFix = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
