/**
 * CM Price-Action-Bars
 *
 * Price action bar coloring by pattern type.
 * Inside bar (yellow), outside bar (blue), up key bar (green), down key bar (red).
 * Key bar = body > 50% of range.
 *
 * Reference: "CM_Price-Action-Bars" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CMPriceActionInputs {
  pctP: number;
  pblb: number;
  pctS: number;
  showPinBars: boolean;
  showShavedBars: boolean;
  showInsideBars: boolean;
  showOutsideBars: boolean;
  showGrayBars: boolean;
}

export const defaultInputs: CMPriceActionInputs = {
  pctP: 66,
  pblb: 6,
  pctS: 5,
  showPinBars: true,
  showShavedBars: true,
  showInsideBars: true,
  showOutsideBars: true,
  showGrayBars: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'pctP', type: 'int', title: 'Pin Bar Wick %', defval: 66, min: 1, max: 99 },
  { id: 'pblb', type: 'int', title: 'PBar Lookback', defval: 6, min: 1 },
  { id: 'pctS', type: 'int', title: 'Shaved Bar %', defval: 5, min: 1, max: 99 },
  { id: 'showPinBars', type: 'bool', title: 'Show Pin Bars', defval: true },
  { id: 'showShavedBars', type: 'bool', title: 'Show Shaved Bars', defval: true },
  { id: 'showInsideBars', type: 'bool', title: 'Show Inside Bars', defval: true },
  { id: 'showOutsideBars', type: 'bool', title: 'Show Outside Bars', defval: true },
  { id: 'showGrayBars', type: 'bool', title: 'Check Box To Turn Bars Gray?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'CM Price Action Bars',
  shortTitle: 'CMPriceAction',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface CMRun extends BarRunState<Record<string, never>> {
  plot0: { time: number; value: number }[];
  barColors: BarColorData[];
}

function study(inputs: Partial<CMPriceActionInputs>): BarStudy<CMRun, Result> {
  const { pctP, pblb, pctS, showPinBars, showShavedBars, showInsideBars, showOutsideBars, showGrayBars } = { ...defaultInputs, ...inputs };
  const pctCp = pctP * 0.01;
  const pctCPO = 1 - pctCp;
  const pctCs = pctS * 0.01;
  return {
    init() {
      const s: CMRun = { plot0: [], barColors: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.barColors];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const curr = bars[i];
      s.plot0[i] = { time: curr.time, value: NaN };
      if (i < 1) return;
      const prev = bars[i - 1];
      const range = curr.high - curr.low;

      // Pine: lowest(pblb) / highest(pblb) lookback
      let lowestLow = curr.low;
      let highestHigh = curr.high;
      for (let j = 0; j < pblb && (i - j) >= 0; j++) {
        lowestLow = Math.min(lowestLow, bars[i - j].low);
        highestHigh = Math.max(highestHigh, bars[i - j].high);
      }

      // Pin Bar Up: wick >= pctP% of range, body at top, low == lowest
      const pBarUp = showPinBars &&
        curr.open > curr.high - range * pctCPO &&
        curr.close > curr.high - range * pctCPO &&
        curr.low <= lowestLow;

      // Pin Bar Down: wick >= pctP% of range, body at bottom, high == highest
      const pBarDn = showPinBars &&
        curr.open < curr.high - range * pctCp &&
        curr.close < curr.high - range * pctCp &&
        curr.high >= highestHigh;

      // Shaved Bar Up: close near high
      const sBarUp = showShavedBars && curr.close >= (curr.high - range * pctCs);

      // Shaved Bar Down: close near low
      const sBarDn = showShavedBars && curr.close <= (curr.low + range * pctCs);

      // Inside Bar
      const insideBar = showInsideBars && curr.high <= prev.high && curr.low >= prev.low;

      // Outside Bar
      const outsideBar = showOutsideBars && curr.high > prev.high && curr.low < prev.low;

      // Pine applies barcolor in order: pin bars, shaved bars, inside/outside
      // Later barcolor calls override earlier ones in Pine
      let color: string | undefined;
      if (pBarUp) color = '#00FF00';    // lime - pin bar up
      if (pBarDn) color = '#FF0000';    // red - pin bar down
      if (sBarDn) color = '#FF00FF';    // fuchsia - shaved bar down
      if (sBarUp) color = '#00FFFF';    // aqua - shaved bar up
      if (insideBar) color = '#FFFF00'; // yellow - inside bar
      if (outsideBar) color = '#FFA500'; // orange - outside bar

      // If showGrayBars and no pattern matched, color gray
      if (color == null && showGrayBars) color = '#787B86';

      if (color != null) s.barColors.push({ time: curr.time as number, color });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        barColors: s.barColors.slice(),
      } as Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CMPriceActionInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMPriceActionInputs> = {}): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const CMPriceAction = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
