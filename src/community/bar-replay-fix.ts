/**
 * Bar Replay Fix
 *
 * Draws the candle of the previous bar (open[1], high[1], low[1], close[1]) on each bar, so the candles lag one bar
 * behind the chart. Body, wick and border colours are chosen by the direction of the previous bar: bullish when
 * close[1] > open[1], bearish when close[1] < open[1], doji otherwise. The default bullish body colour is fully
 * transparent (hollow up candles). The first bar has no previous bar: no candle.
 *
 * Reference: "Bar Replay Fix" by ivanrdgc
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BarReplayFixInputs {
  /** Candle Body Color: bullish */
  bullishColor: string;
  /** Candle Body Color: bearish */
  bearishColor: string;
  /** Candle Body Color: doji */
  dojiColor: string;
  /** Candle Wick Color: bullish */
  bullishWickColor: string;
  /** Candle Wick Color: bearish */
  bearishWickColor: string;
  /** Candle Wick Color: doji */
  dojiWickColor: string;
  /** Candle Border Color: bullish */
  bullishBorderColor: string;
  /** Candle Border Color: bearish */
  bearishBorderColor: string;
  /** Candle Border Color: doji */
  dojiBorderColor: string;
}

export const defaultInputs: BarReplayFixInputs = {
  bullishColor: '#43465100',
  bearishColor: '#434651',
  dojiColor: '#434651',
  bullishWickColor: '#434651',
  bearishWickColor: '#434651',
  dojiWickColor: '#434651',
  bullishBorderColor: '#434651',
  bearishBorderColor: '#434651',
  dojiBorderColor: '#434651',
};

export const inputConfig: InputConfig[] = [
  { id: 'bullishColor', type: 'color', title: 'Candle Body Color', defval: '#43465100', inline: 'color' },
  { id: 'bearishColor', type: 'color', title: '', defval: '#434651', inline: 'color' },
  { id: 'dojiColor', type: 'color', title: '', defval: '#434651', inline: 'color',
    tooltip: 'Bullish / Bearish / Doji Candle Body Color' },
  { id: 'bullishWickColor', type: 'color', title: 'Candle Wick Color', defval: '#434651', inline: 'wickcolor' },
  { id: 'bearishWickColor', type: 'color', title: '', defval: '#434651', inline: 'wickcolor' },
  { id: 'dojiWickColor', type: 'color', title: '', defval: '#434651', inline: 'wickcolor',
    tooltip: 'Bullish / Bearish / Doji Candle Wick Color' },
  { id: 'bullishBorderColor', type: 'color', title: 'Candle Border Color', defval: '#434651', inline: 'bordercolor' },
  { id: 'bearishBorderColor', type: 'color', title: '', defval: '#434651', inline: 'bordercolor' },
  { id: 'dojiBorderColor', type: 'color', title: '', defval: '#434651', inline: 'bordercolor',
    tooltip: 'Bullish / Bearish / Doji Candle Border Color' },
];

// No plot(): the only output is the plotcandle
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candles', title: 'Previous Bar Candles' },
];

export const metadata = {
  title: 'Bar Replay Fix',
  shortTitle: 'Bar Replay Fix',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };

interface ReplayRun extends BarRunState<Record<string, never>> {
  candles: PlotCandleData[];
}

function study(inputs: Partial<BarReplayFixInputs>): BarStudy<ReplayRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: ReplayRun = { candles: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.candles];
      return s;
    },
    bar(s, i, bars) {
      if (i < 1) return;
      const p = bars[i - 1];
      const bull = gt(p.close, p.open);
      const bear = lt(p.close, p.open);
      // plotcandle(open[1], high[1], low[1], close[1], color / wickcolor / bordercolor by the direction of bar [1])
      s.candles.push({
        time: bars[i].time,
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
        color: bull ? cfg.bullishColor : bear ? cfg.bearishColor : cfg.dojiColor,
        wickColor: bull ? cfg.bullishWickColor : bear ? cfg.bearishWickColor : cfg.dojiWickColor,
        borderColor: bull ? cfg.bullishBorderColor : bear ? cfg.bearishBorderColor : cfg.dojiBorderColor,
      });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { candles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BarReplayFixInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BarReplayFixInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BarReplayFix = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
