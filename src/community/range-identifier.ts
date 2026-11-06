/**
 * Range Identifier
 *
 * Tracks expanding consolidation ranges. When price stays within the
 * previous range, the range expands to encompass new highs/lows.
 * When price breaks out, the range resets.
 *
 * Reference: "Range Identifier [LazyBear]"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RangeIdentifierInputs {
  emaLength: number;
}

export const defaultInputs: RangeIdentifierInputs = {
  emaLength: 34,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 34, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Lower', color: '#EF5350', lineWidth: 2 },
  { id: 'plot2', title: 'Midline', color: '#787B86', lineWidth: 1 },
  { id: 'plot3', title: 'EMA', color: '#000000', lineWidth: 2 },
];

export const metadata = {
  title: 'Range Identifier',
  shortTitle: 'RangeID',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface RangeIdRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  rangeUp: number[];
  rangeDn: number[];
  plots: Point[][];
  fillUpColors: string[];
  fillDownColors: string[];
}

function study(inputs: Partial<RangeIdentifierInputs>): BarStudy<RangeIdRun, IndicatorResult> {
  const { emaLength } = { ...defaultInputs, ...inputs };
  const warmup = emaLength;
  return {
    init() {
      const ema = taStep.ema(emaLength);
      const s: RangeIdRun = {
        ema, rangeUp: [], rangeDn: [], plots: [[], [], [], []], fillUpColors: [], fillDownColors: [],
        steps: [ema], vars: {}, lists: [], series: [],
      };
      s.series = [s.rangeUp, s.rangeDn, ...s.plots, s.fillUpColors, s.fillDownColors];
      return s;
    },
    bar(s, i, bars) {
      const { rangeUp, rangeDn } = s;
      const high = bars[i].high;
      const low = bars[i].low;
      const close = bars[i].close;
      const emaV = s.ema.step(close);

      if (i === 0) {
        rangeUp[i] = high;
        rangeDn[i] = low;
      } else {
        const prevUp = rangeUp[i - 1];
        const prevDn = rangeDn[i - 1];

        if (close >= prevDn && close <= prevUp) {
          // Inside range — expand
          rangeUp[i] = Math.max(prevUp, high);
          rangeDn[i] = Math.min(prevDn, low);
        } else {
          // Breakout — reset
          rangeUp[i] = high;
          rangeDn[i] = low;
        }
      }

      const mid = (rangeUp[i] + rangeDn[i]) / 2;
      const time = bars[i].time;
      const p = s.plots;
      // fill(ul, dummy, lime) / fill(dummy, ll, red) with dummy = close > ema ? down : up (a hidden plot, not ported):
      // the first fill covers the range when the close is above the EMA, the second one when it is not
      if (i < warmup) {
        p[0][i] = { time, value: NaN };
        p[1][i] = { time, value: NaN };
        p[2][i] = { time, value: NaN };
        s.fillUpColors[i] = 'transparent';
        s.fillDownColors[i] = 'transparent';
      } else {
        const ema = emaV ?? 0;
        const bullish = close > ema;
        const color = bullish ? '#26A69A' : '#EF5350';
        p[0][i] = { time, value: rangeUp[i], color };
        p[1][i] = { time, value: rangeDn[i], color };
        p[2][i] = { time, value: mid };
        s.fillUpColors[i] = bullish ? '#26A69A40' : 'transparent';
        s.fillDownColors[i] = bullish ? 'transparent' : '#EF535040';
      }
      p[3][i] = { time, value: (emaV == null || i < warmup) ? NaN : emaV };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': p[0].slice(), 'plot1': p[1].slice(), 'plot2': p[2].slice(), 'plot3': p[3].slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.fillUpColors.slice() },
          { plot1: 'plot1', plot2: 'plot0', options: { title: 'Plots Background' }, colors: s.fillDownColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RangeIdentifierInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RangeIdentifierInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RangeIdentifier = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
