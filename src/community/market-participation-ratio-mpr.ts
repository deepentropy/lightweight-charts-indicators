/**
 * Market Participation Ratio (MPR)
 *
 * The price ratio close / sma(close, length) times the volume ratio volume / sma(volume, length), scaled by 100,
 * smoothed by an EMA over `smoothLength` bars. The line is magenta above 100, dark grey below 100 and grey at 100.
 * Horizontal lines at 0, 100 and 50.
 *
 * Reference: "Market Participation Ratio-MPR(TechnoBlooms)" by TechnoBlooms
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This indicator is created under TechnoBlooms - Innovating Trading Indicators and Strategies.
 * All rights reserved. Unauthorized copying or distribution is prohibited. © TechnoBlooms
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MarketParticipationRatioMprInputs {
  /** SMA length of the price and of the volume */
  length: number;
  /** EMA length of the smoothing */
  smoothLength: number;
}

export const defaultInputs: MarketParticipationRatioMprInputs = {
  length: 14,
  smoothLength: 7,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smoothing Length', defval: 7, min: 1 },
];

const ABOVE = String(color.rgb(230, 56, 221));
const BELOW = String(color.rgb(85, 85, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Smoothed MPR', color: ABOVE, lineWidth: 3 },
];

export const metadata = {
  title: 'Market Participation Ratio-MPR(TechnoBlooms)',
  shortTitle: 'MPR',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };

interface MprRun extends BarRunState<Record<string, never>> {
  priceMA: WindowSma;
  volumeMA: WindowSma;
  smooth: ReturnType<typeof taStep.ema>;
  plot0: Point[];
}

function study(inputs: Partial<MarketParticipationRatioMprInputs>): BarStudy<MprRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const priceMA = new WindowSma(cfg.length);
      const volumeMA = new WindowSma(cfg.length);
      const smooth = taStep.ema(cfg.smoothLength);
      const s: MprRun = { priceMA, volumeMA, smooth, plot0: [], steps: [priceMA, volumeMA, smooth], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const volume = b.volume ?? NaN;
      const priceMA = s.priceMA.step(close);
      const volumeMA = s.volumeMA.step(volume);
      // Plain divisions: x / 0 is +-infinity (ta.ema skips it like na), 0 / 0 is na
      const mpr = (close / priceMA) * (volume / volumeMA) * 100;
      const v = s.smooth.step(mpr);
      const c = gt(v, 100) ? ABOVE : lt(v, 100) ? BELOW : color.gray;
      s.plot0[i] = { time: b.time, value: Number.isFinite(v) ? v : NaN, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: '#eceff5fb', linestyle: 'dashed', linewidth: 1 } },
          { value: 100, options: { title: 'Level 100', color: String(color.rgb(12, 250, 159)), linestyle: 'dotted', linewidth: 2 } },
          { value: 50, options: { title: 'Level 50', color: color.red, linestyle: 'dotted', linewidth: 1 } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketParticipationRatioMprInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MarketParticipationRatioMprInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MarketParticipationRatioMpr = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
