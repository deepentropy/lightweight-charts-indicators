/**
 * Volume Based Coloured Bars
 *
 * Volume bars colored by price direction with brightness based on
 * whether volume exceeds its moving average.
 *
 * Reference: "Volume Based Coloured Bars" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeColoredBarsInputs {
  length: number;
}

export const defaultInputs: VolumeColoredBarsInputs = {
  length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'MA Length', defval: 20, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: '#787B86', lineWidth: 4, style: 'columns' },
];

export const metadata = {
  title: 'Volume Colored Bars',
  shortTitle: 'VCBars',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface VcbRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  plot0: { time: any; value: number; color: string }[];
  barColors: BarColorData[];
}

function study(inputs: Partial<VolumeColoredBarsInputs>): BarStudy<VcbRun, Result> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const sma = new WindowSma(length);
      const s: VcbRun = { sma, plot0: [], barColors: [], steps: [sma], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const vol = bar.volume ?? 0;
      const avg = s.sma.step(vol) ?? 0;
      const isUp = bar.close > bar.open;
      const isAboveAvg = vol > avg;

      let color: string;
      if (isUp && isAboveAvg) color = '#26A69A';        // bright green
      else if (isUp && !isAboveAvg) color = '#80CBC4';   // dim green
      else if (!isUp && isAboveAvg) color = '#EF5350';   // bright red
      else color = '#EF9A9A';                             // dim red
      s.plot0[i] = { time: bar.time, value: vol, color };

      // barcolor: 6-level coloring based on volume vs average and price direction
      // Pine: vold1=vol>avg*1.5 & down -> #800000 (dark red/maroon)
      //        vold2=vol 0.5-1.5x & down -> #FF0000 (red)
      //        vold3=vol<avg*0.5 & down -> orange
      //        volu1=vol>avg*1.5 & up -> #006400 (dark green)
      //        volu2=vol 0.5-1.5x & up -> lime (#00FF00)
      //        volu3=vol<avg*0.5 & up -> #7FFFD4 (aquamarine)
      let barColor: string;
      if (!isUp && vol > avg * 1.5) barColor = '#800000';
      else if (!isUp && vol >= avg * 0.5 && vol <= avg * 1.5) barColor = '#FF0000';
      else if (!isUp && vol < avg * 0.5) barColor = '#FF9800';
      else if (isUp && vol > avg * 1.5) barColor = '#006400';
      else if (isUp && vol >= avg * 0.5 && vol <= avg * 1.5) barColor = '#00FF00';
      else if (isUp && vol < avg * 0.5) barColor = '#7FFFD4';
      else barColor = '#787B86';
      s.barColors[i] = { time: bar.time, color: barColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeColoredBarsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeColoredBarsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumeColoredBars = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
