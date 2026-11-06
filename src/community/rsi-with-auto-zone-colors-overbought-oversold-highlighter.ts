/**
 * RSI (14) with Auto Zone Colors
 *
 * The 14-bar RSI of the close, green at or above 70, red at or below 30, blue otherwise. The background is green
 * when the RSI is above 70 and red when it is below 30. Horizontal lines at 70, 30 and 50.
 *
 * Reference: "RSI (14) with Auto Zone Colors — Overbought/Oversold Highlighter" by tarangbharti18
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tarangbharti18
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiWithAutoZoneColorsOverboughtOversoldHighlighterInputs {}

export const defaultInputs: RsiWithAutoZoneColorsOverboughtOversoldHighlighterInputs = {};

export const inputConfig: InputConfig[] = [];

const UP_COL = String(color.rgb(7, 243, 15));
const DOWN_COL = String(color.rgb(246, 2, 2));
const MID_COL = String(color.rgb(15, 66, 248));
const BG_UP = String(color.new(color.green, 85));
const BG_DOWN = String(color.new(color.red, 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: MID_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'my RSI',
  shortTitle: 'my RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => ge(b, a);

type Result = IndicatorResult & { bgColors: BgColorData[] };

interface AutoZoneRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  plot0: { time: number; value: number; color: string }[];
  bgColors: BgColorData[];
}

function study(): BarStudy<AutoZoneRun, Result> {
  return {
    init() {
      const rsi = taStep.rsi(14);
      const s: AutoZoneRun = { rsi, plot0: [], bgColors: [], steps: [rsi], vars: {}, lists: [], series: [] };
      s.lists = [s.bgColors];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const rsi = s.rsi.step(b.close) ?? NaN;
      s.plot0[i] = { time: b.time, value: rsi, color: ge(rsi, 70) ? UP_COL : le(rsi, 30) ? DOWN_COL : MID_COL };
      // bgcolor(rsivalue > 70 ? color.new(color.green, 85) : na); bgcolor(rsivalue < 30 ? color.new(color.red, 85) : na)
      if (gt(rsi, 70)) s.bgColors.push({ time: b.time, color: BG_UP });
      if (lt(rsi, 30)) s.bgColors.push({ time: b.time, color: BG_DOWN });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: 70, options: { title: 'overbought', color: color.green, linestyle: 'dashed' } },
          { value: 30, options: { title: 'oversold', color: color.red, linestyle: 'dashed' } },
          { value: 50, options: { title: 'oversold', color: color.gray, linestyle: 'dashed' } },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  _inputs: Partial<RsiWithAutoZoneColorsOverboughtOversoldHighlighterInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<RsiWithAutoZoneColorsOverboughtOversoldHighlighterInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(_inputs).update(bars));
}

export const RsiWithAutoZoneColorsOverboughtOversoldHighlighter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
