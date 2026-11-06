/**
 * Reversal Candle Pattern SetUp
 *
 * Detects bullish/bearish reversals based on consecutive same-direction
 * candles followed by a reversal candle breaking the previous extreme.
 *
 * Reference: "Reversal Candle Pattern SetUp" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ReversalCandleSetupInputs {
  lookback: number;
}

export const defaultInputs: ReversalCandleSetupInputs = {
  lookback: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 3, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Close', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Reversal Candle Setup',
  shortTitle: 'RevCdl',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface RevRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
  closePlot: { time: number; value: number }[];
}

function study(inputs: Partial<ReversalCandleSetupInputs>): BarStudy<RevRun, Result> {
  const { lookback } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: RevRun = { markers: [], closePlot: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.closePlot];
      return s;
    },
    bar(s, i, bars) {
      const cur = bars[i];
      s.closePlot[i] = { time: cur.time, value: NaN };
      if (i < lookback) return;
      const isGreen = cur.close > cur.open;
      const isRed = cur.close < cur.open;

      // Check for consecutive red candles before current
      let allRed = true;
      for (let j = 1; j <= lookback; j++) {
        if (bars[i - j].close >= bars[i - j].open) {
          allRed = false;
          break;
        }
      }

      // Bullish reversal: lookback consecutive red candles, then green closing above prev high
      if (allRed && isGreen && cur.close > bars[i - 1].high) {
        s.markers.push({
          time: cur.time as number,
          position: 'belowBar',
          shape: 'arrowUp',
          color: '#26A69A',
          text: 'BullRev',
        });
      }

      // Check for consecutive green candles before current
      let allGreen = true;
      for (let j = 1; j <= lookback; j++) {
        if (bars[i - j].close <= bars[i - j].open) {
          allGreen = false;
          break;
        }
      }

      // Bearish reversal: lookback consecutive green candles, then red closing below prev low
      if (allGreen && isRed && cur.close < bars[i - 1].low) {
        s.markers.push({
          time: cur.time as number,
          position: 'aboveBar',
          shape: 'arrowDown',
          color: '#EF5350',
          text: 'BearRev',
        });
      }
    },
    result(s) {
      const markers = s.markers.slice();
      // Background color on reversal bars (Pine: bgcolor lime for long, red for short, transp=70)
      const bgColors: BgColorData[] = [];
      for (const m of markers) {
        if (m.text === 'BullRev') {
          bgColors.push({ time: m.time, color: 'rgba(0,230,118,0.15)' }); // lime
        } else if (m.text === 'BearRev') {
          bgColors.push({ time: m.time, color: 'rgba(239,83,80,0.15)' }); // red
        }
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.closePlot.slice() },
        markers,
        bgColors,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ReversalCandleSetupInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ReversalCandleSetupInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ReversalCandleSetup = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
