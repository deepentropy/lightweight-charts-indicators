/**
 * CM Heikin-Ashi Candlesticks V1
 *
 * Standard Heikin-Ashi OHLC candle overlay.
 * haClose = (O+H+L+C)/4, haOpen recurrently averaged, haHigh/haLow adjusted.
 *
 * Reference: "CM_Heikin-Ashi" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CMHeikinAshiInputs {}

export const defaultInputs: CMHeikinAshiInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candle0', title: 'HA Candle' },
];

export const metadata = {
  title: 'CM Heikin-Ashi',
  shortTitle: 'CMHA',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]>; barColors: BarColorData[] };

interface CmhaVars {
  /** haOpen and haClose of the bar before */
  haOpen: number;
  haClose: number;
}

interface CmhaRun extends BarRunState<CmhaVars> {
  candles: PlotCandleData[];
  barColors: BarColorData[];
}

function study(): BarStudy<CmhaRun, Result> {
  return {
    init() {
      const s: CmhaRun = { candles: [], barColors: [], steps: [], vars: { haOpen: NaN, haClose: NaN }, lists: [], series: [] };
      s.lists = [s.barColors];
      s.series = [s.candles];
      return s;
    },
    bar(s, i, bars) {
      const { open, high, low, close } = bars[i];
      const v = s.vars;
      const haClose = (open + high + low + close) / 4;
      const haOpen = i === 0 ? (open + close) / 2 : (v.haOpen + v.haClose) / 2;
      const haHigh = Math.max(high, haOpen, haClose);
      const haLow = Math.min(low, haOpen, haClose);
      v.haOpen = haOpen;
      v.haClose = haClose;
      const col = haClose >= haOpen ? '#26A69A' : '#EF5350';
      s.candles[i] = {
        time: bars[i].time as number,
        open: haOpen,
        high: haHigh,
        low: haLow,
        close: haClose,
        color: col,
        borderColor: col,
        wickColor: col,
      };
      // Pine: barcolor(heikUpColor() ? aqua: heikDownColor() ? red : na)
      // heikUpColor = haclose > haopen, heikDownColor = haclose <= haopen
      if (haClose > haOpen) {
        s.barColors.push({ time: bars[i].time as number, color: '#00FFFF' }); // aqua
      } else {
        s.barColors.push({ time: bars[i].time as number, color: '#FF0000' }); // red
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { candle0: s.candles.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<CMHeikinAshiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMHeikinAshiInputs> = {}): Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]>; barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const CMHeikinAshi = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
