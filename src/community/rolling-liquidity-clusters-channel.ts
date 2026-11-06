/**
 * Rolling Liquidity Clusters Channel
 *
 * Over a rolling window of `length` bars, the highest candle body top and the lowest candle body bottom are found.
 * The upper level is the lowest bar high in the window that is at or above the highest body top; the lower level is
 * the highest bar low in the window that is at or below the lowest body bottom. The mid level is their average.
 * Two vertical gradient fills go from each level (90 % transparency) to the mid level (100 %).
 *
 * Reference: "Rolling Liquidity Clusters Channel [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RollingLiquidityClustersChannelInputs {
  /** Window size: number of bars to look back for the levels */
  length: number;
  upperColor: string;
  lowerColor: string;
  midColor: string;
}

export const defaultInputs: RollingLiquidityClustersChannelInputs = {
  length: 20,
  upperColor: String(color.new('#f23645', 0)),
  lowerColor: String(color.new('#089981', 0)),
  midColor: String(color.new('#ff5d00', 0)),
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Window Size', defval: 20, min: 2, group: 'Settings',
    tooltip: 'Number of bars to look back for calculating the levels.' },
  { id: 'upperColor', type: 'color', title: 'Upper Level', defval: defaultInputs.upperColor, group: 'Visuals', inline: 'Upper' },
  { id: 'lowerColor', type: 'color', title: 'Lower Level', defval: defaultInputs.lowerColor, group: 'Visuals', inline: 'Lower' },
  { id: 'midColor', type: 'color', title: 'Mid Level', defval: defaultInputs.midColor, group: 'Visuals', inline: 'Mid' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Level', color: defaultInputs.upperColor, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Mid Level', color: defaultInputs.midColor, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Lower Level', color: defaultInputs.lowerColor, lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'Rolling Liquidity Clusters Channel [LuxAlgo]',
  shortTitle: 'LuxAlgo - Rolling Liquidity Clusters Channel',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };

interface RollingRun extends BarRunState<Record<string, never>> {
  maxBody: WindowExtreme;
  minBody: WindowExtreme;
  upper: number[];
  lower: number[];
  mid: number[];
  upperData: Point[];
  midData: Point[];
  lowerData: Point[];
}

function study(inputs: Partial<RollingLiquidityClustersChannelInputs>): BarStudy<RollingRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.length;
  return {
    init() {
      const maxBody = new WindowExtreme(false, len);
      const minBody = new WindowExtreme(true, len);
      const s: RollingRun = {
        maxBody, minBody, upper: [], lower: [], mid: [], upperData: [], midData: [], lowerData: [],
        steps: [maxBody, minBody], vars: {}, lists: [], series: [],
      };
      s.series = [s.upper, s.lower, s.mid, s.upperData, s.midData, s.lowerData];
      return s;
    },
    bar(s, k, bars) {
      const b = bars[k]!;
      // bodyHigh = math.max(open, close); bodyLow = math.min(open, close)
      const maxBodyHigh = s.maxBody.step(Math.max(b.open, b.close));
      const minBodyLow = s.minBody.step(Math.min(b.open, b.close));
      let upperLevel = NaN;
      let lowerLevel = NaN;
      for (let i = 0; i <= len - 1; i++) {
        // high[i] / low[i]: na before the first bar
        const h = k - i >= 0 ? bars[k - i]!.high : NaN;
        const l = k - i >= 0 ? bars[k - i]!.low : NaN;
        // Minimum high that is above all bodies of the window
        if (ge(h, maxBodyHigh)) {
          if (isNaN(upperLevel) || lt(h, upperLevel)) upperLevel = h;
        }
        // Maximum low that is below all bodies of the window
        if (le(l, minBodyLow)) {
          if (isNaN(lowerLevel) || gt(l, lowerLevel)) lowerLevel = l;
        }
      }
      const midLevel = (upperLevel + lowerLevel) / 2;
      s.upper[k] = upperLevel;
      s.lower[k] = lowerLevel;
      s.mid[k] = midLevel;
      s.upperData[k] = { time: b.time as number, value: upperLevel, color: cfg.upperColor };
      s.midData[k] = { time: b.time as number, value: midLevel, color: cfg.midColor };
      s.lowerData[k] = { time: b.time as number, value: lowerLevel, color: cfg.lowerColor };
    },
    result(s, bars) {
      const n = bars.length;
      const upperTop = String(color.new(cfg.upperColor, 90));
      const upperMid = String(color.new(cfg.upperColor, 100));
      const lowerMid = String(color.new(cfg.lowerColor, 100));
      const lowerBottom = String(color.new(cfg.lowerColor, 90));
      const constant = (c: string) => new Array<string | null>(n).fill(c);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.upperData.slice(), plot1: s.midData.slice(), plot2: s.lowerData.slice() },
        fills: [
          // fill(pUpper, pMid, upperLevel, midLevel, color.new(upperColorInput, 90), color.new(upperColorInput, 100),
          //      "Upper Gradient Fill")
          { plot1: 'plot0', plot2: 'plot1',
            gradient: { topValue: s.upper.slice(), bottomValue: s.mid.slice(), topColor: constant(upperTop), bottomColor: constant(upperMid) } },
          // fill(pMid, pLower, midLevel, lowerLevel, color.new(lowerColorInput, 100), color.new(lowerColorInput, 90),
          //      "Lower Gradient Fill")
          { plot1: 'plot1', plot2: 'plot2',
            gradient: { topValue: s.mid.slice(), bottomValue: s.lower.slice(), topColor: constant(lowerMid), bottomColor: constant(lowerBottom) } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RollingLiquidityClustersChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RollingLiquidityClustersChannelInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RollingLiquidityClustersChannel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
