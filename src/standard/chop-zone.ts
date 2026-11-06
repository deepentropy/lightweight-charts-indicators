/**
 * Chop Zone Indicator
 *
 * Uses EMA angle to determine trending vs choppy market conditions.
 * Output is a constant 1 (column plot) with color based on the EMA angle.
 *
 * PineScript reference: plot(1, "Chop Zone", color = chopZoneColor, style = plot.style_columns)
 * Plus barcolor is not used — the columns themselves are colored per-bar.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ChopZoneInputs {
  // No configurable inputs in the standard indicator
}

export const defaultInputs: ChopZoneInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Chop Zone', color: '#26C6DA', lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'Chop Zone',
  shortTitle: 'Chop Zone',
  overlay: false,
};

// Color constants matching PineScript
const COLOR_TURQUOISE = '#26C6DA';
const COLOR_DARK_GREEN = '#43A047';
const COLOR_PALE_GREEN = '#A5D6A7';
const COLOR_LIME = '#009688';
const COLOR_DARK_RED = '#D50000';
const COLOR_RED = '#E91E63';
const COLOR_ORANGE = '#FF6D00';
const COLOR_LIGHT_ORANGE = '#FFB74D';
const COLOR_YELLOW = '#FDD835';

function getChopZoneColor(emaAngle: number): string {
  if (emaAngle >= 5) return COLOR_TURQUOISE;
  if (emaAngle >= 3.57) return COLOR_DARK_GREEN;
  if (emaAngle >= 2.14) return COLOR_PALE_GREEN;
  if (emaAngle >= 0.71) return COLOR_LIME;
  if (emaAngle <= -5) return COLOR_DARK_RED;
  if (emaAngle <= -3.57) return COLOR_RED;
  if (emaAngle <= -2.14) return COLOR_ORANGE;
  if (emaAngle <= -0.71) return COLOR_LIGHT_ORANGE;
  return COLOR_YELLOW;
}

type Point = { time: any; value: number; color?: string };

interface ChopZoneRun extends BarRunState<{ prevEma34: number }> {
  ema: ReturnType<typeof taStep.ema>;
  hi: WindowExtreme;
  lo: WindowExtreme;
  plotData: Point[];
}

function study(_inputs: Partial<ChopZoneInputs>): BarStudy<ChopZoneRun, IndicatorResult> {
  const periods = 30;
  const pi = Math.PI;
  return {
    init() {
      // Calculate EMA(close, 34), highest(high, 30) and lowest(low, 30)
      const ema = taStep.ema(34);
      const hi = new WindowExtreme(false, periods);
      const lo = new WindowExtreme(true, periods);
      const s: ChopZoneRun = { ema, hi, lo, plotData: [], steps: [ema, hi, lo], vars: { prevEma34: NaN }, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const avg = (bar.high + bar.low + bar.close) / 3; // hlc3
      const ema34 = s.ema.step(bar.close);
      const prevEma34 = i > 0 ? s.vars.prevEma34 : null;
      s.vars.prevEma34 = ema34;
      const hh = s.hi.step(bar.high);
      const ll = s.lo.step(bar.low);

      if (ema34 == null || prevEma34 == null || hh == null || ll == null || hh === ll) {
        s.plotData[i] = { time: bar.time, value: 1, color: COLOR_YELLOW };
        return;
      }

      const span = 25 / (hh - ll) * ll;

      // Calculate EMA angle using atan2-based formula from PineScript
      const y2 = (prevEma34 - ema34) / avg * span;
      const c = Math.sqrt(1 + y2 * y2);
      let emaAngle = Math.round(180 * Math.acos(1 / c) / pi);
      if (y2 > 0) emaAngle = -emaAngle;

      s.plotData[i] = { time: bar.time, value: 1, color: getChopZoneColor(emaAngle) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plotData.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ChopZoneInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ChopZoneInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ChopZone = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
