/**
 * High Volume Arrow Signals (Ajustável)
 *
 * SMA of the volume over `lookbackLength` bars. A bar has high volume when its volume is above the SMA times the
 * multiplier. A high-volume bullish bar (close > open) gets a blue up arrow below the bar; a high-volume bearish bar
 * (close < open) gets a fuchsia down arrow above the bar. The volume SMA is also plotted.
 *
 * Reference: "High Volume Arrow Signals (Ajustável)" by IdeManson
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HighVolumeArrowSignalsInputs {
  /** Volume MA length */
  lookbackLength: number;
  /** Volume multiplier */
  multiplier: number;
}

export const defaultInputs: HighVolumeArrowSignalsInputs = {
  lookbackLength: 20,
  multiplier: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackLength', type: 'int', title: 'Volume MA Length', defval: 20, min: 5 },
  { id: 'multiplier', type: 'float', title: 'Volume Multiplier', defval: 1.5, min: 1.0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume MA', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'High Volume Arrow Signals (Ajustável)',
  shortTitle: 'High Volume Arrow Signals (Ajustável)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface HighVolumeRun extends BarRunState<Record<string, never>> {
  volMa: WindowSma;
  plot0: { time: number; value: number; color: string }[];
  markers: MarkerData[];
}

function study(inputs: Partial<HighVolumeArrowSignalsInputs>): BarStudy<HighVolumeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const buyColor = String(color.new(color.blue, 0));
  const sellColor = String(color.new(color.fuchsia, 0));
  return {
    init() {
      const volMa = new WindowSma(cfg.lookbackLength);
      const s: HighVolumeRun = { volMa, plot0: [], markers: [], steps: [volMa], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const volume = b.volume ?? NaN;
      const volMa = s.volMa.step(volume);
      const isHighVol = gt(volume, volMa * cfg.multiplier);
      const t = b.time as number;
      // plotshape(buy_signal, "High Volume Buy", shape.arrowup, location.belowbar, color.new(color.blue, 0), size.normal)
      if (isHighVol && gt(b.close, b.open)) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'arrowUp', color: buyColor, size: 'normal' });
      }
      // plotshape(sell_signal, "High Volume Sell", shape.arrowdown, location.abovebar, color.new(color.fuchsia, 0), size.normal)
      if (isHighVol && gt(b.open, b.close)) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'arrowDown', color: sellColor, size: 'normal' });
      }
      s.plot0[i] = { time: t, value: volMa, color: color.gray };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HighVolumeArrowSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HighVolumeArrowSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const HighVolumeArrowSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
