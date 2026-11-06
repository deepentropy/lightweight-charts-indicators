/**
 * MFI [seiglerj]
 *
 * Money flow index: the sum over `length` bars of volume * typical price on the bars where the typical price rose
 * (upper sum) and on the bars where it fell (lower sum), then 100 - 100 / (1 + upper / lower). The background is
 * red above the upper level and green below the lower level, and the area between the two levels is filled.
 *
 * Reference: "MFI [seiglerj]" by seiglerj
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MfiSeiglerjInputs {
  /** Bars of the two money flow sums */
  length: number;
  /** Oversold level */
  lower: number;
  /** Overbought level */
  upper: number;
  /** Colour the background above the upper level and below the lower level */
  highlightBreaches: boolean;
}

export const defaultInputs: MfiSeiglerjInputs = {
  length: 14,
  lower: 20,
  upper: 80,
  highlightBreaches: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 14, min: 1 },
  { id: 'lower', type: 'int', title: 'lower', defval: 20, min: 0, max: 50 },
  { id: 'upper', type: 'int', title: 'upper', defval: 80, min: 50, max: 100 },
  { id: 'highlightBreaches', type: 'bool', title: 'Highlight Oversold/Overbought?', defval: true },
];

// Colour constants of Pine version 1 (gray #808080, red #FF0000, green #008000, black #000000)
const GRAY = '#808080';
/** color(gray, 0) */
const LINE = String(color.new(GRAY, 0));
/** color(gray, 100): an invisible level */
const LEVEL = String(color.new(GRAY, 100));
/** color(black, 100): an invisible level */
const EDGE = String(color.new('#000000', 100));
/** color(red, 70) */
const OVERBOUGHT = String(color.new('#FF0000', 70));
/** color(green, 60) */
const OVERSOLD = String(color.new('#008000', 60));
/** fill(top, bottom, color = gray, transp = 75) */
const BACKGROUND = String(color.new(GRAY, 75));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: LINE, lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 80, title: 'Level', color: LEVEL, linestyle: 'dashed' },
  { id: 'hline_1', price: 20, title: 'Level', color: LEVEL, linestyle: 'dashed' },
  { id: 'hline_2', price: 0, title: 'Level', color: EDGE, linestyle: 'dashed' },
  { id: 'hline_3', price: 100, title: 'Level', color: EDGE, linestyle: 'dashed' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_0', plot1: 'hline_0', plot2: 'hline_1', color: BACKGROUND, title: 'Hlines Background' },
];

export const metadata = {
  title: 'MFI [seiglerj]',
  shortTitle: 'MFI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = IndicatorResult & { bgColors: BgColorData[] };

interface MfiRun extends BarRunState<Record<string, never>> {
  upperSum: WindowSum;
  lowerSum: WindowSum;
  plot0: { time: number; value: number }[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<MfiSeiglerjInputs>): BarStudy<MfiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const length = Math.trunc(cfg.length);
  return {
    init() {
      const upperSum = new WindowSum(length);
      const lowerSum = new WindowSum(length);
      const s: MfiRun = { upperSum, lowerSum, plot0: [], bgColors: [], steps: [upperSum, lowerSum], vars: {}, lists: [], series: [] };
      s.lists = [s.bgColors];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      // upper_s = sum(volume * (change(source) <= 0 ? 0 : source), length)
      // lower_s = sum(volume * (change(source) >= 0 ? 0 : source), length)
      const source = (bars[i].high + bars[i].low + bars[i].close) / 3;
      const change = i > 0 ? source - (bars[i - 1].high + bars[i - 1].low + bars[i - 1].close) / 3 : NaN;
      const volume = bars[i].volume ?? NaN;
      const upperSum = s.upperSum.step(volume * (le(change, 0) ? 0 : source));
      const lowerSum = s.lowerSum.step(volume * (ge(change, 0) ? 0 : source));

      // mf = rsi(upper_s, lower_s): with two series, 100 - 100 / (1 + upper_s / lower_s)
      const mf = 100 - 100 / (1 + upperSum / lowerSum);
      // b_color = (mf > upper) ? color(red, 70) : (mf < lower) ? color(green, 60) : na
      if (cfg.highlightBreaches) {
        if (gt(mf, cfg.upper)) s.bgColors.push({ time: bars[i].time as number, color: OVERBOUGHT });
        else if (lt(mf, cfg.lower)) s.bgColors.push({ time: bars[i].time as number, color: OVERSOLD });
      }
      s.plot0[i] = { time: bars[i].time, value: Number.isFinite(mf) ? mf : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: cfg.upper, options: { title: 'Level', color: LEVEL, linestyle: 'dashed' } },
          { value: cfg.lower, options: { title: 'Level', color: LEVEL, linestyle: 'dashed' } },
          { value: 0, options: { title: 'Level', color: EDGE, linestyle: 'dashed' } },
          { value: 100, options: { title: 'Level', color: EDGE, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_0', plot2: 'hline_1', options: { title: 'Hlines Background', color: BACKGROUND } },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MfiSeiglerjInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MfiSeiglerjInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MfiSeiglerj = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
