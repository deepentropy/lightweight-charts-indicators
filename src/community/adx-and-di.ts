/**
 * ADX and DI
 *
 * Directional movement with Wilder sums: the true range, the plus and the minus directional movement are summed
 * with `s = s[1] - s[1] / len + x` (the first bar uses 0 for the missing previous close, high and low).
 * DI+ = 100 * smoothed DM+ / smoothed TR, DI- = 100 * smoothed DM- / smoothed TR,
 * DX = 100 * |DI+ - DI-| / (DI+ + DI-) and ADX = sma(DX, len). A horizontal line marks the threshold.
 *
 * Reference: "ADX and DI for v4" by BeikabuOyaji
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BeikabuOyaji
 */

import type { IndicatorResult, InputConfig, PlotConfig, Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdxAndDiInputs {
  /** Length of the Wilder sums and of the ADX average */
  len: number;
  /** Level of the horizontal line */
  th: number;
}

export const defaultInputs: AdxAndDiInputs = {
  len: 14,
  th: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'len', defval: 14 },
  { id: 'th', type: 'int', title: 'th', defval: 20 },
];

// Pine v4 colours: color.green, color.red, color.navy
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DI+', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot1', title: 'DI-', color: '#FF5252', lineWidth: 1 },
  { id: 'plot2', title: 'ADX', color: '#311B92', lineWidth: 1 },
];

export const metadata = {
  title: 'ADX and DI for v4',
  shortTitle: 'ADX and DI for v4',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number };

interface AdxRun extends BarRunState<{ sTr: number; sPlus: number; sMinus: number }> {
  adx: WindowSma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<AdxAndDiInputs>): BarStudy<AdxRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, th } = cfg;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const adx = new WindowSma(len);
      const s: AdxRun = {
        adx, plot0: [], plot1: [], plot2: [], steps: [adx], vars: { sTr: 0, sPlus: 0, sMinus: 0 }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const { high, low } = b;
      // nz(close[1]), nz(high[1]), nz(low[1]): 0 on the first bar
      const pc = i > 0 ? bars[i - 1].close : 0;
      const ph = i > 0 ? bars[i - 1].high : 0;
      const pl = i > 0 ? bars[i - 1].low : 0;
      const tr = Math.max(Math.max(high - low, Math.abs(high - pc)), Math.abs(low - pc));
      const up = high - ph;
      const down = pl - low;
      const dmPlus = gt(up, down) ? Math.max(up, 0) : 0;
      const dmMinus = gt(down, up) ? Math.max(down, 0) : 0;
      v.sTr = v.sTr - v.sTr / len + tr;
      v.sPlus = v.sPlus - v.sPlus / len + dmPlus;
      v.sMinus = v.sMinus - v.sMinus / len + dmMinus;
      // Plain divisions, as Pine: x / 0 is +-infinity, 0 / 0 is na
      const diPlus = (v.sPlus / v.sTr) * 100;
      const diMinus = (v.sMinus / v.sTr) * 100;
      const dx = (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100;
      const adx = s.adx.step(dx) ?? NaN;
      s.plot0[i] = { time: b.time, value: fin(diPlus) };
      s.plot1[i] = { time: b.time, value: fin(diMinus) };
      s.plot2[i] = { time: b.time, value: fin(adx) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        // Pine v4 color.black; hline default style: dashed
        hlines: [{ value: th, options: { color: '#363A45', linestyle: 'dashed', linewidth: 1 } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdxAndDiInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdxAndDiInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AdxAndDi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
