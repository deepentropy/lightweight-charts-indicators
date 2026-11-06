/**
 * Volume Delta Indicator
 *
 * Approximates up/down volume by comparing close to open price.
 * When close > open, volume is considered buying pressure (up volume).
 * When close < open, volume is considered selling pressure (down volume).
 * Delta = upVolume - downVolume
 *
 * PineScript display:
 *   col = lastVolume > 0 ? color.teal : color.red
 *   hline(0)
 *   plotcandle(openVolume, maxVolume, minVolume, lastVolume, "Volume Delta", color=col, bordercolor=col, wickcolor=col)
 *
 * The standard indicator splits the volume of each bar into up and down volume from lower-timeframe (intrabar)
 * volume: 'Use custom timeframe' / 'Timeframe', else automatic ("1S" on seconds charts, "1" intraday, "5" daily,
 * "60" above). See src/lower-tf-volume.ts:
 * - lower timeframe = chart timeframe (e.g. 'Timeframe' "1D" on a daily chart, automatic on a 1-minute chart): the
 *   chart bars are the intrabars and the values are the original ones (library rule: up when close > open, down
 *   when close < open, else by close vs previous close, else as the previous bar)
 * - lower timeframe below the chart timeframe: the chart bars do not have the intrabar volume; the values are an
 *   estimate that gives all the volume of a bar to up or down volume by close vs open (0 when equal)
 * - lower timeframe above the chart timeframe: error, as the original
 * The chart timeframe is `timeframe` of the chart context (third argument of calculate) when given, else it is
 * taken from the bar spacing.
 * The design (colours, zero line) is the one of the standard indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import { lowerTimeframe } from '../lower-tf-volume';
import { chartTimeframe } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeDeltaInputs {
  /** Use the custom lower timeframe instead of the automatic one */
  useCustomTimeframe: boolean;
  /** Custom lower timeframe of the intrabar volume */
  lowerTimeframe: string;
}

export const defaultInputs: VolumeDeltaInputs = {
  useCustomTimeframe: false,
  lowerTimeframe: '1',
};

const LOWER_TF_TOOLTIP = 'The indicator scans lower timeframe data to approximate up and down volume used in the delta calculation. By default, the timeframe is chosen automatically. These inputs override this with a custom timeframe. \n\nHigher timeframes provide more historical data, but the data will be less precise.';

export const inputConfig: InputConfig[] = [
  { id: 'useCustomTimeframe', type: 'bool', title: 'Use custom timeframe', defval: false, tooltip: LOWER_TF_TOOLTIP, display: 'none' },
  { id: 'lowerTimeframe', type: 'timeframe', title: 'Timeframe', defval: '1', active: 'useCustomTimeframe' },
];

// No line plots — rendered via plotCandles
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'delta', title: 'Volume Delta' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'dashed', title: 'Zero' },
];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export const metadata = {
  title: 'Volume Delta',
  shortTitle: 'Vol Delta',
  overlay: false,
};

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> };

interface VolumeDeltaVars {
  /** The side of the last intrabar (library rule of upDownVolumeOfChartBars) */
  isBuyVolume: boolean;
}

interface VolumeDeltaRun extends BarRunState<VolumeDeltaVars> {
  candles: PlotCandleData[];
}

function study(inputs: Partial<VolumeDeltaInputs>): BarStudy<VolumeDeltaRun, Result> {
  const { useCustomTimeframe, lowerTimeframe: customTimeframe } = { ...defaultInputs, ...inputs };
  let exact = false;
  return {
    // the chart timeframe comes from the bar gaps (or the chart context)
    key: (bars, chart) => chartTimeframe(bars, chart),
    init(bars, chart) {
      exact = lowerTimeframe(bars, useCustomTimeframe, customTimeframe, chart).exact;
      const s: VolumeDeltaRun = { candles: [], steps: [], vars: { isBuyVolume: true }, lists: [], series: [] };
      s.series = [s.candles];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const volume = bar.volume ?? 0;

      let delta: number;
      if (exact) {
        // the chart bars are the intrabars (upDownVolumeOfChartBars, one bar at a time)
        const prevClose = i > 0 ? bars[i - 1].close : NaN; // na comparisons are false
        const v = s.vars;
        if (gt(bar.close, bar.open)) v.isBuyVolume = true;
        else if (gt(bar.open, bar.close)) v.isBuyVolume = false;
        else if (gt(bar.close, prevClose)) v.isBuyVolume = true;
        else if (gt(prevClose, bar.close)) v.isBuyVolume = false;
        const pos = v.isBuyVolume ? volume : 0;
        const neg = v.isBuyVolume ? 0 : -volume;
        delta = pos + neg;
      } else if (bar.close > bar.open) {
        delta = volume;
      } else if (bar.close < bar.open) {
        delta = -volume;
      } else {
        delta = 0;
      }

      // open=0, close=delta, high=max(0,delta), low=min(0,delta)
      // col = lastVolume > 0 ? color.teal : color.red
      const col = gt(delta, 0) ? '#089981' : '#F23645';
      s.candles[i] = {
        time: bar.time as number,
        open: 0,
        high: Math.max(0, delta),
        low: Math.min(0, delta),
        close: delta,
        color: col,
        borderColor: col,
        wickColor: col,
      };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { delta: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeDeltaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumeDeltaInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const VolumeDelta = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
  hlineConfig,
};
