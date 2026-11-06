/**
 * VIM (Volume in Money)
 *
 * Money volume = volume * close, drawn as columns with its SMA. A column is green / red / gray when the close is
 * above / below / equal to the previous close (mode "Prev Close") or to the open (mode "Candle Direction").
 * Both plots use the volume format.
 *
 * Reference: "VIM (Volume in Money)" by tbtb1111
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type VimColorMode = 'Prev Close' | 'Candle Direction';

export interface VimInputs {
  /** Length of the SMA of the money volume */
  maLength: number;
  /** Column colour: close against the previous close or against the open */
  colorMode: VimColorMode;
}

export const defaultInputs: VimInputs = {
  maLength: 14,
  colorMode: 'Prev Close',
};

// Pine input titles (Hebrew): "moving average length" and "colouring method"
export const inputConfig: InputConfig[] = [
  { id: 'maLength', type: 'int', title: 'אורך ממוצע נע', defval: 14 },
  { id: 'colorMode', type: 'string', title: 'שיטת צביעה', defval: 'Prev Close', options: ['Prev Close', 'Candle Direction'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume in Money', color: color.green, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'MA of Money Volume', color: color.blue, lineWidth: 2 },
];

export const metadata = {
  title: 'Volume in Money + MA (Short Numbers & Coloring)',
  shortTitle: 'Volume in Money + MA (Short Numbers & Coloring)',
  overlay: false,
  // Pine sets format.volume on both plots
  format: 'volume' as const,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };

interface VimRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<VimInputs>): BarStudy<VimRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const sma = new WindowSma(cfg.maLength);
      const s: VimRun = { sma, plot0: [], plot1: [], steps: [sma], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // moneyVol = volume * close
      const moneyVol = (b.volume ?? NaN) * b.close;
      const moneyVolMA = s.sma.step(moneyVol) ?? NaN;
      // f_getBarColor(mode): green / red / gray by close against close[1] (Prev Close) or against open
      const ref = cfg.colorMode === 'Prev Close' ? (i > 0 ? bars[i - 1].close : NaN) : b.open;
      const barColor = gt(b.close, ref) ? color.green : lt(b.close, ref) ? color.red : color.gray;
      s.plot0[i] = { time: b.time, value: moneyVol, color: barColor };
      s.plot1[i] = { time: b.time, value: moneyVolMA, color: color.blue };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VimInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VimInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const Vim = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
