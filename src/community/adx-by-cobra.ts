/**
 * ADX by cobra
 *
 * Directional movement with Wilder sums: the true range, the plus and the minus directional movement are summed
 * with `s = nz(s[1]) - nz(s[1]) / len + x` (the first bar uses 0 for the missing previous close, high and low).
 * DI+ = 100 * smoothed DM+ / smoothed TR, DI- = 100 * smoothed DM- / smoothed TR,
 * DX = 100 * |DI+ - DI-| / (DI+ + DI-) and ADX = sma(DX, len). A dashed horizontal line marks the threshold.
 * Four background layers: lime when DI- > 60, orange when DI+ > 60, green when sma(DI+ > DI-, len1) is not 0 and
 * red when sma(DI- > DI+, len1) is not 0.
 *
 * Colours are those of Pine version 1; version 1 plots have a default transparency of 35.
 *
 * Reference: "ADX by cobra" by binary_trader66
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  color,
  type BarColorConfig, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdxByCobraInputs {
  /** Length of the Wilder sums and of the ADX average */
  len: number;
  /** Length of the averages of the DI+ > DI- and DI- > DI+ flags */
  len1: number;
  /** Level of the horizontal line */
  th: number;
}

export const defaultInputs: AdxByCobraInputs = {
  len: 3,
  len1: 1,
  th: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 3 },
  { id: 'len1', type: 'int', title: 'Length1', defval: 1 },
  { id: 'th', type: 'int', title: 'threshold', defval: 20 },
];

// Pine version 1 colours (green #008000, red #FF0000, white #FFFFFF) with the version 1 plot transparency (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const DI_PLUS_COLOR = V1('#008000');
const DI_MINUS_COLOR = V1('#FF0000');
const ADX_COLOR = V1('#FFFFFF');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DI+', color: DI_PLUS_COLOR, lineWidth: 3 },
  { id: 'plot1', title: 'DI-', color: DI_MINUS_COLOR, lineWidth: 3 },
  { id: 'plot2', title: 'ADX', color: ADX_COLOR, lineWidth: 1 },
];

/** The four bgcolor() calls, in declaration order */
export const barColorConfig: BarColorConfig[] = Array.from({ length: 4 }, (_, k) => ({
  id: `bgcolor${k}`, kind: 'bgcolor' as const, title: 'Background Color',
}));

export const metadata = {
  title: 'ADX and DI',
  shortTitle: 'ADX and DI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

// bgcolor colours: version 1 lime, orange, green and red with the transp of each call
const LIME_40 = String(color.new('#00FF00', 40));
const ORANGE_20 = String(color.new('#FF7F00', 20));
const GREEN_60 = String(color.new('#008000', 60));
const RED_60 = String(color.new('#FF0000', 60));

type Result = IndicatorResult & { bgColors: BgColorData[] };
type Point = { time: number; value: number };

interface AdxVars {
  sTr: number;
  sPlus: number;
  sMinus: number;
}

interface AdxRun extends BarRunState<AdxVars> {
  adxSma: WindowSma;
  callSma: WindowSma;
  putSma: WindowSma;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  bgColors: BgColorData[];
}

// A number used as a condition: na and 0 are false
const truthy = (v: number) => !Number.isNaN(v) && v !== 0;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

function study(inputs: Partial<AdxByCobraInputs>): BarStudy<AdxRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, len1, th } = cfg;
  return {
    init() {
      const adxSma = new WindowSma(len);
      const callSma = new WindowSma(len1);
      const putSma = new WindowSma(len1);
      const s: AdxRun = {
        adxSma, callSma, putSma, plot0: [], plot1: [], plot2: [], bgColors: [],
        steps: [adxSma, callSma, putSma], vars: { sTr: 0, sPlus: 0, sMinus: 0 }, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { high, low } = bars[i];
      // nz(close[1]), nz(high[1]), nz(low[1]): 0 on the first bar
      const pc = i > 0 ? bars[i - 1].close : 0;
      const ph = i > 0 ? bars[i - 1].high : 0;
      const pl = i > 0 ? bars[i - 1].low : 0;
      const tr = Math.max(Math.max(high - low, Math.abs(high - pc)), Math.abs(low - pc));
      const dmPlus = gt(high - ph, pl - low) ? Math.max(high - ph, 0) : 0;
      const dmMinus = gt(pl - low, high - ph) ? Math.max(pl - low, 0) : 0;
      v.sTr = v.sTr - v.sTr / len + tr;
      v.sPlus = v.sPlus - v.sPlus / len + dmPlus;
      v.sMinus = v.sMinus - v.sMinus / len + dmMinus;
      // Plain divisions, as Pine: x / 0 is +-infinity, 0 / 0 is na
      const diPlus = (v.sPlus / v.sTr) * 100;
      const diMinus = (v.sMinus / v.sTr) * 100;
      const dx = (Math.abs(diPlus - diMinus) / (diPlus + diMinus)) * 100;
      // crosscall / crossput: bools used as numbers by sma (true 1, false 0)
      const call = gt(diPlus, diMinus) ? 1 : 0;
      const put = gt(diMinus, diPlus) ? 1 : 0;
      const adx = s.adxSma.step(dx);
      const callAvg = s.callSma.step(call);
      const putAvg = s.putSma.step(put);

      const time = bars[i].time;
      if (gt(diMinus, 60)) s.bgColors.push({ id: 'bgcolor0', time, color: LIME_40 });
      if (gt(diPlus, 60)) s.bgColors.push({ id: 'bgcolor1', time, color: ORANGE_20 });
      if (truthy(callAvg)) s.bgColors.push({ id: 'bgcolor2', time, color: GREEN_60 });
      if (truthy(putAvg)) s.bgColors.push({ id: 'bgcolor3', time, color: RED_60 });

      s.plot0[i] = { time, value: fin(diPlus) };
      s.plot1[i] = { time, value: fin(diMinus) };
      s.plot2[i] = { time, value: fin(adx) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [{ value: th, options: { color: '#FFFFFF', linestyle: 'dashed', linewidth: 1 } }],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdxByCobraInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdxByCobraInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AdxByCobra = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  barColorConfig,
};
