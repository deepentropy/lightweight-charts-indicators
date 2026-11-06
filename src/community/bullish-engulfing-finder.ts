/**
 * Bullish Engulfing
 *
 * Colours yellow the bars that complete a bullish engulfing: the bar before is a down bar (open[1] > close[1]), this
 * bar is an up bar (close > open) whose body contains the body before (close >= open[1], close[1] >= open) and is
 * longer than it (close - open > open[1] - close[1]).
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close): "Bullish Engulfing Formed" on each such bar.
 *
 * Reference: "Bullish Engulfing" by HPotter
 * Original notice: Copyright by HPotter v1.0 01/04/2014
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface BullishEngulfingFinderInputs {}

export const defaultInputs: BullishEngulfingFinderInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the output is the bar colour
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Bullish Engulfing',
  shortTitle: 'Bullish Engulfing',
  overlay: true,
};

type Result = IndicatorResult & { barColors: BarColorData[]; alertCalls: AlertCall[] };

interface EngulfingRun extends BarRunState<Record<string, never>> {
  barColors: BarColorData[];
  alertCalls: AlertCall[];
}

function study(): BarStudy<EngulfingRun, Result> {
  return {
    init() {
      const s: EngulfingRun = { barColors: [], alertCalls: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.barColors, s.alertCalls];
      return s;
    },
    bar(s, i, bars) {
      // bar 0: open[1] / close[1] are na, the signal is false
      if (i < 1) return;
      const p = bars[i - 1];
      const b = bars[i];
      const signal = p.open > p.close && b.close > b.open && b.close >= p.open && p.close >= b.open
        && b.close - b.open > p.open - p.close;
      if (!signal) return;
      // if signal: alert("Bullish Engulfing Formed", alert.freq_once_per_bar_close)
      s.alertCalls.push({ time: b.time, message: 'Bullish Engulfing Formed', freq: 'once_per_bar_close' });
      // barcolor(signal ? color.yellow : na)
      s.barColors.push({ id: 'barcolor0', time: b.time, color: '#FFEB3B' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        barColors: s.barColors.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<BullishEngulfingFinderInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<BullishEngulfingFinderInputs> = {},
): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const BullishEngulfingFinder = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction };
