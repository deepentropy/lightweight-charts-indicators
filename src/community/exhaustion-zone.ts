/**
 * Exhaustion Zone
 *
 * A rebound line under the price. atr = sma(atr(atrLength), atrSmooth) (0 while na). The highest of
 * low - 2 * atr over highestLength bars and the lowest of low + 2 * atr over lowestLength bars (0 while na) give, on
 * the previous bar, mid = (highest + lowest) / 2 - (highest + lowest) * lineFactor. The rebound line is
 * sma(mid, smaLength) + atr[1] * atrFactor, with a second line at rebound * lineScale and a fill between them. The
 * background and the bars are green when the low is at or below the rebound line.
 *
 * Reference: "Exhaustion Zone [by rukich]" by rukich
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © rukich
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ExhaustionZoneInputs {
  /** ATR length */
  atrLength: number;
  /** SMA length of the ATR */
  atrSmooth: number;
  /** Length of the highest of low - 2 * atr */
  highestLength: number;
  /** Length of the lowest of low + 2 * atr */
  lowestLength: number;
  /** SMA length of the rebound line */
  smaLength: number;
  lineFactor: number;
  atrFactor: number;
  /** Scale of the second line */
  lineScale: number;
}

export const defaultInputs: ExhaustionZoneInputs = {
  atrLength: 14,
  atrSmooth: 34,
  highestLength: 13,
  lowestLength: 50,
  smaLength: 55,
  lineFactor: 0.236,
  atrFactor: 0.5,
  lineScale: 0.86,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrSmooth', type: 'int', title: 'ATR Smoothing', defval: 34 },
  { id: 'highestLength', type: 'int', title: 'Highest Period', defval: 13 },
  { id: 'lowestLength', type: 'int', title: 'Lowest Period', defval: 50 },
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 55 },
  { id: 'lineFactor', type: 'float', title: 'Line Factor', defval: 0.236 },
  { id: 'atrFactor', type: 'float', title: 'ATR Factor', defval: 0.5 },
  { id: 'lineScale', type: 'float', title: 'Line Scale', defval: 0.86 },
];

const REBOUND_COL = String(color.new(color.green, 70));
const SCALED_COL = String(color.new(color.green, 50));
const FILL_COL = String(color.new(color.green, 70));
const BG_COL = String(color.new(color.green, 90));
const BAR_COL = String(color.new(color.green, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Rebound Line', color: REBOUND_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Scaled Line 1', color: SCALED_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Scaled Line 2', color: SCALED_COL, lineWidth: 5 },
];

export const metadata = {
  title: 'Exhaustion Zone [by rukich]',
  shortTitle: 'Exhaustion Zone [by rukich]',
  overlay: true,
};

/** Pine a <= b: not (a - b > 1e-10), false with na */
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > 1e-10);
/** na(x) ? 0.0 : x */
const nz0 = (x: number) => (isNaN(x) ? 0 : x);

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] };

interface ExhaustionRun extends BarRunState<Record<string, never>> {
  atrStep: ReturnType<typeof taStep.atr>;
  atrSma: WindowSma;
  highest: WindowExtreme;
  lowest: WindowExtreme;
  rebSma: WindowSma;
  atr: number[];
  highestS: number[];
  lowestF: number[];
  plots: Point[][];
  barColors: BarColorData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<ExhaustionZoneInputs>): BarStudy<ExhaustionRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: ExhaustionRun = {
        atrStep: taStep.atr(cfg.atrLength), atrSma: new WindowSma(cfg.atrSmooth),
        highest: new WindowExtreme(false, cfg.highestLength), lowest: new WindowExtreme(true, cfg.lowestLength),
        rebSma: new WindowSma(cfg.smaLength),
        atr: [], highestS: [], lowestF: [], plots: [[], [], []], barColors: [], bgColors: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.atrStep, s.atrSma, s.highest, s.lowest, s.rebSma];
      s.lists = [s.barColors, s.bgColors];
      s.series = [s.atr, s.highestS, s.lowestF, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // atr = ta.sma(ta.atr(atrLength), atrSmooth); na -> 0
      const atr = nz0(s.atrSma.step(s.atrStep.step(b.high, b.low, b.close)));
      s.atr[i] = atr;
      // highest_s = ta.highest(low - atr * 2, highestLength); lowest_f = ta.lowest(low + atr * 2, lowestLength); na -> 0
      s.highestS[i] = nz0(s.highest.step(b.low - atr * 2));
      s.lowestF[i] = nz0(s.lowest.step(b.low + atr * 2));

      // adjusted_mid = (highest_s[1] + lowest_f[1]) / 2 - (highest_s[1] + lowest_f[1]) * lineFactor; na -> 0
      let adjustedMid = 0;
      if (i > 0) {
        const sum = s.highestS[i - 1] + s.lowestF[i - 1];
        adjustedMid = nz0(sum / 2 - sum * cfg.lineFactor);
      }
      const rebSma = nz0(s.rebSma.step(adjustedMid));

      // rebound_line = reb_sma + atr[1] * atrFactor; na -> 0
      const rebound = nz0(rebSma + (i > 0 ? s.atr[i - 1] : NaN) * cfg.atrFactor);
      const scaled = nz0(rebound * cfg.lineScale);
      s.plots[0][i] = { time: t, value: rebound, color: REBOUND_COL };
      s.plots[1][i] = { time: t, value: scaled, color: SCALED_COL };
      s.plots[2][i] = { time: t, value: scaled, color: SCALED_COL };
      // signal_cond = low <= rebound_line
      if (le(b.low, rebound)) {
        s.bgColors.push({ time: t, color: BG_COL });
        s.barColors.push({ time: t, color: BAR_COL });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        // fill(h_rebound, l_rebound, color.new(color.green, 70), title = 'Fill Area')
        fills: [{ plot1: 'plot0', plot2: 'plot2', options: { title: 'Fill Area' }, colors: new Array<string>(n).fill(FILL_COL) }],
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ExhaustionZoneInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ExhaustionZoneInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ExhaustionZone = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
