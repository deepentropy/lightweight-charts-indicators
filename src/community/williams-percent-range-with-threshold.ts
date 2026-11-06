/**
 * Williams Percent Range with Threshold
 *
 * Williams %R of the source over `length` bars: 100 * (src - highest high) / (highest high - lowest low). The trend
 * state turns up when %R is above the uptrend threshold and down when it is below the downtrend threshold (it is
 * kept between them). The %R line is green / red / gray by the state, and the price candles are drawn in the
 * state colour on the price pane.
 *
 * Reference: "Williams Percent Range with Threshold" by xdextra
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { PlotCandleData } from '../types';

export interface WilliamsPercentRangeWithThresholdInputs {
  /** Lookback length of the highest high / lowest low */
  length: number;
  /** Source */
  src: SourceType;
  /** %R above this level: uptrend */
  upperthreshold: number;
  /** %R below this level: downtrend */
  lowerthreshold: number;
}

export const defaultInputs: WilliamsPercentRangeWithThresholdInputs = {
  length: 50,
  src: 'close',
  upperthreshold: -16,
  lowerthreshold: -67,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'upperthreshold', type: 'float', title: 'Uptrend Threshold', defval: -16, step: 1 },
  { id: 'lowerthreshold', type: 'float', title: 'Downtrend Threshold', defval: -67, step: 1 },
];

const UP_LINE = String(color.rgb(14, 255, 122));
const DOWN_LINE = '#F10A3C';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%R', color: UP_LINE, lineWidth: 2 },
];

export const metadata = {
  title: 'Williams Percent Range with Threshold',
  shortTitle: 'Williams %R with Threshold',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };

interface WprVars {
  /** var wr_is_up = false, var wr_is_down = false */
  wrIsUp: boolean;
  wrIsDown: boolean;
}

interface WprRun extends BarRunState<WprVars> {
  hi: WindowExtreme;
  lo: WindowExtreme;
  plot0: { time: number; value: number; color: string }[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<WilliamsPercentRangeWithThresholdInputs>): BarStudy<WprRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const hi = new WindowExtreme(false, cfg.length);
      const lo = new WindowExtreme(true, cfg.length);
      const s: WprRun = {
        hi, lo, plot0: [], candles: [], steps: [hi, lo], vars: { wrIsUp: false, wrIsDown: false }, lists: [], series: [],
      };
      s.series = [s.plot0, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const hi = s.hi.step(b.high);
      const lo = s.lo.step(b.low);
      // 100 * (src - max) / (max - min): a plain division (x / 0 is +-infinity, 0 / 0 na)
      const percentR = (100 * (value(b) - hi)) / (hi - lo);
      if (gt(percentR, cfg.upperthreshold)) {
        v.wrIsUp = true;
        v.wrIsDown = false;
      } else if (lt(percentR, cfg.lowerthreshold)) {
        v.wrIsUp = false;
        v.wrIsDown = true;
      }
      const trendColor = v.wrIsUp ? UP_LINE : v.wrIsDown ? DOWN_LINE : color.gray;
      const candleColor = v.wrIsUp ? color.green : v.wrIsDown ? color.red : color.gray;
      s.plot0[i] = { time: b.time, value: Number.isFinite(percentR) ? percentR : NaN, color: trendColor };
      // plotcandle(open, high, low, close, "Candle Color", color = wickcolor = bordercolor = candle_color, force_overlay = true)
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close,
        color: candleColor, wickColor: candleColor, borderColor: candleColor, forceOverlay: true };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: cfg.upperthreshold, options: { title: 'Uptrend Threshold', color: color.gray, linestyle: 'dashed' } },
          { value: cfg.lowerthreshold, options: { title: 'Downtrend Threshold', color: color.gray, linestyle: 'dashed' } },
        ],
        plotCandles: { candleColor: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<WilliamsPercentRangeWithThresholdInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WilliamsPercentRangeWithThresholdInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const WilliamsPercentRangeWithThreshold = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
