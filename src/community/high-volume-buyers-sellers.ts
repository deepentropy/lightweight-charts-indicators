/**
 * High Volume Buyers/Sellers+
 *
 * Volume against its simple moving average: high volume when volume > sma(volume, length) * mult, extreme volume
 * when volume > sma * multExtreme. On a green candle (close > open) a green circle below the bar for high volume
 * (not extreme, or extreme signals off) and a green triangle up for extreme volume; on a red candle a red circle /
 * triangle down above the bar.
 *
 * Reference: "High Volume Buyers/Sellers+" by avitawill
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HighVolumeBuyersSellersInputs {
  length: number;
  mult: number;
  multExtreme: number;
  showExtreme: boolean;
}

export const defaultInputs: HighVolumeBuyersSellersInputs = {
  length: 20,
  mult: 2.5,
  multExtreme: 4.0,
  showExtreme: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Volume MA Period', defval: 20 },
  { id: 'mult', type: 'float', title: 'High Volume Multiplier', defval: 2.5 },
  { id: 'multExtreme', type: 'float', title: 'Extreme Volume Multiplier', defval: 4.0 },
  { id: 'showExtreme', type: 'bool', title: 'Show Extreme Volume Signals', defval: true },
];

// Markers only (plotshape)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'High Volume Buyers/Sellers+',
  shortTitle: 'High Volume Buyers/Sellers+',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface HvRun extends BarRunState<Record<string, never>> {
  volMa: WindowSma;
  markers: MarkerData[];
}

function study(inputs: Partial<HighVolumeBuyersSellersInputs>): BarStudy<HvRun, Result> {
  const { length, mult, multExtreme, showExtreme } = { ...defaultInputs, ...inputs };
  const green = String(color.new(color.green, 0));
  const red = String(color.new(color.red, 0));
  return {
    init() {
      const volMa = new WindowSma(length);
      const s: HvRun = { volMa, markers: [], steps: [volMa], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vol = b.volume ?? NaN;
      const ma = s.volMa.step(vol);
      const isHighVol = gt(vol, ma * mult);
      const isExtremeVol = gt(vol, ma * multExtreme);
      const isGreen = gt(b.close, b.open);
      const isRed = lt(b.close, b.open);
      const t = b.time as number;
      if (isHighVol && isGreen && (!isExtremeVol || !showExtreme)) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'circle', color: green, size: 'tiny' });
      }
      if (isHighVol && isRed && (!isExtremeVol || !showExtreme)) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: red, size: 'tiny' });
      }
      if (showExtreme && isExtremeVol && isGreen) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: green, size: 'small' });
      }
      if (showExtreme && isExtremeVol && isRed) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: red, size: 'small' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HighVolumeBuyersSellersInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HighVolumeBuyersSellersInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const HighVolumeBuyersSellers = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
