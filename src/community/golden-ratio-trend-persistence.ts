/**
 * Golden Ratio Trend Persistence
 *
 * A trend state starts on the first confirmed pivot (a pivot high starts a downtrend, a pivot low an uptrend). In an
 * uptrend the extremity is the highest high (or close) since the trend start and the anchor moves up to every higher
 * confirmed pivot low; the trend level is extremity - ratio * (extremity - anchor). A close below the level flips to
 * a downtrend, with the old extremity as the new anchor (the downtrend is the mirror). The level is drawn as a step
 * line, and the background shows the trend direction.
 *
 * Reference: "Golden Ratio Trend Persistence [EWT]" by YetAnotherTA
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ZenTrader
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GoldenRatioTrendPersistenceInputs {
  /** Pivot lookback left */
  pivotLeft: number;
  /** Pivot lookback right (a pivot is confirmed this many bars later) */
  pivotRight: number;
  /** Fibonacci retracement ratio of the trend level */
  fibRatio: number;
  /** Source of the trend extremity: 'High/Low' or 'Close' */
  extremitySource: 'High/Low' | 'Close';
}

export const defaultInputs: GoldenRatioTrendPersistenceInputs = {
  pivotLeft: 15,
  pivotRight: 10,
  fibRatio: 0.618,
  extremitySource: 'High/Low',
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLeft', type: 'int', title: 'Pivot Lookback Left', defval: 15, min: 1 },
  { id: 'pivotRight', type: 'int', title: 'Pivot Lookback Right', defval: 10, min: 1 },
  { id: 'fibRatio', type: 'float', title: 'Fibonacci Ratio', defval: 0.618, min: 0.0, max: 1.0 },
  { id: 'extremitySource', type: 'string', title: 'Source for Extremity', defval: 'High/Low', options: ['High/Low', 'Close'] },
];

const UP_COL = String(color.new(color.teal, 0));
const DOWN_COL = String(color.new(color.maroon, 0));
const UP_BG = String(color.new(color.teal, 90));
const DOWN_BG = String(color.new(color.maroon, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Level', color: UP_COL, lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Golden Ratio Trend Persistence [EWT]',
  shortTitle: 'GRTP',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface GoldenVars {
  /** var int trend = 0 */
  trend: number;
  /** var float anchorPrice = na */
  anchor: number;
  /** var float extremityPrice = na */
  extremity: number;
  /** var float trendLevel = na */
  level: number;
}

interface GoldenRun extends BarRunState<GoldenVars> {
  ph: PivotStep;
  pl: PivotStep;
  plot0: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<GoldenRatioTrendPersistenceInputs>): BarStudy<GoldenRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const useHl = cfg.extremitySource === 'High/Low';
  return {
    init() {
      const ph = new PivotStep(cfg.pivotLeft, cfg.pivotRight, true);
      const pl = new PivotStep(cfg.pivotLeft, cfg.pivotRight, false);
      const s: GoldenRun = {
        ph, pl, plot0: [], bgColors: [],
        steps: [ph, pl], vars: { trend: 0, anchor: NaN, extremity: NaN, level: NaN }, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);
      const sourceUp = useHl ? b.high : b.close;
      const sourceDown = useHl ? b.low : b.close;

      if (v.trend === 0) {
        if (!isNaN(ph)) {
          v.trend = -1;
          v.anchor = ph;
          v.extremity = sourceDown;
        } else if (!isNaN(pl)) {
          v.trend = 1;
          v.anchor = pl;
          v.extremity = sourceUp;
        }
      } else if (v.trend === 1) {
        v.extremity = Math.max(isNaN(v.extremity) ? sourceUp : v.extremity, sourceUp);
        if (!isNaN(pl) && gt(pl, v.anchor)) v.anchor = pl;
        v.level = v.extremity - cfg.fibRatio * (v.extremity - v.anchor);
        if (lt(b.close, v.level)) {
          v.trend = -1;
          v.anchor = v.extremity;
          v.extremity = sourceDown;
        }
      } else if (v.trend === -1) {
        v.extremity = Math.min(isNaN(v.extremity) ? sourceDown : v.extremity, sourceDown);
        if (!isNaN(ph) && lt(ph, v.anchor)) v.anchor = ph;
        v.level = v.extremity + cfg.fibRatio * (v.anchor - v.extremity);
        if (gt(b.close, v.level)) {
          v.trend = 1;
          v.anchor = v.extremity;
          v.extremity = sourceUp;
        }
      }

      s.plot0[i] = { time: b.time, value: v.level, color: v.trend === 1 ? UP_COL : DOWN_COL };
      if (v.trend === 1) s.bgColors.push({ time: b.time, color: UP_BG });
      else if (v.trend === -1) s.bgColors.push({ time: b.time, color: DOWN_BG });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GoldenRatioTrendPersistenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GoldenRatioTrendPersistenceInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const GoldenRatioTrendPersistence = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
