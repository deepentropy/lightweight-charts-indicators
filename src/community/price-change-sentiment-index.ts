/**
 * Price Change Sentiment Index
 *
 * The close-to-close change divided by the bar range (high - low), mapped around 50: 50 + change / range * 50,
 * clamped to 0..100 and smoothed with an SMA. The background is red at or above the overbought level and green at
 * or below the oversold level. Horizontal lines at the two levels and at 50.
 *
 * Reference: "Price Change Sentiment Index [tradeviZion]" by TradeVizion
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TradeVizion
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PriceChangeSentimentIndexInputs {
  /** SMA length of the clamped value */
  smoothingPeriod: number;
  /** Show the background colours */
  showBgColor: boolean;
  overSold: number;
  overBought: number;
}

export const defaultInputs: PriceChangeSentimentIndexInputs = {
  smoothingPeriod: 3,
  showBgColor: true,
  overSold: 25,
  overBought: 75,
};

export const inputConfig: InputConfig[] = [
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 3, min: 1 },
  { id: 'showBgColor', type: 'bool', title: 'Show Background Colors', defval: true },
  { id: 'overSold', type: 'float', title: 'Oversold Level', defval: 25, min: 0, max: 100 },
  { id: 'overBought', type: 'float', title: 'Overbought Level', defval: 75, min: 0, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Price Change Sentiment', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'Price Change Sentiment Index [tradeviZion]',
  shortTitle: 'P-SentIdx',
  overlay: false,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = IndicatorResult & { bgColors: BgColorData[] };
type Point = { time: number; value: number };

interface PcsiRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  plot0: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<PriceChangeSentimentIndexInputs>): BarStudy<PcsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const overBg = String(color.new(color.red, 90));
  const underBg = String(color.new(color.green, 90));
  return {
    init() {
      const sma = new WindowSma(cfg.smoothingPeriod);
      const s: PcsiRun = { sma, plot0: [], bgColors: [], steps: [sma], vars: {}, lists: [], series: [] };
      s.lists = [s.bgColors];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // changePct = (close - close[1]) / (high - low): a plain division (x / 0 is +-infinity, 0 / 0 is na)
      const changePct = i > 0 ? (b.close - bars[i - 1].close) / (b.high - b.low) : NaN;
      const normalized = 50 + changePct * 50;
      // math.min(math.max(normalized, 0), 100): +-infinity is clamped to 100 / 0, na stays na
      const clamped = Math.min(Math.max(normalized, 0), 100);
      const smoothed = s.sma.step(clamped);
      s.plot0[i] = { time: b.time, value: smoothed };
      if (cfg.showBgColor) {
        if (ge(smoothed, cfg.overBought)) s.bgColors.push({ time: b.time, color: overBg });
        else if (le(smoothed, cfg.overSold)) s.bgColors.push({ time: b.time, color: underBg });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: cfg.overBought, options: { title: 'Overbought', color: color.red, linestyle: 'dashed' } },
          { value: cfg.overSold, options: { title: 'Oversold', color: color.green, linestyle: 'dashed' } },
          { value: 50, options: { title: 'Midline', color: color.gray, linestyle: 'dotted' } },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceChangeSentimentIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PriceChangeSentimentIndexInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceChangeSentimentIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
