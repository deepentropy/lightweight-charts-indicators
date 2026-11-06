/**
 * ATR Based Zigzag w EMA
 *
 * An ATR zigzag gives the trend: in an uptrend the highest high is tracked and the trend turns down when the low
 * falls more than `atrMult` * ATR below it; in a downtrend the lowest low is tracked and the trend turns up when the
 * high rises more than `atrMult` * ATR above it. The line is the EMA of the median price (high + low) / 2, coloured
 * by the trend, and the bars are coloured the same way.
 *
 * Reference: "ATR Based Zigzag w EMA" by HabibiBudo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AtrBasedZigzagWEmaInputs {
  atrLength: number;
  atrMult: number;
  /** Line smoothness (EMA length of the median price) */
  lineSmoothLength: number;
  upTrendColor: string;
  downTrendColor: string;
}

export const defaultInputs: AtrBasedZigzagWEmaInputs = {
  atrLength: 14,
  atrMult: 5.0,
  lineSmoothLength: 50,
  upTrendColor: 'rgb(0, 255, 132)',
  downTrendColor: 'rgb(255, 0, 0)',
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 5.0 },
  { id: 'lineSmoothLength', type: 'int', title: 'Line Smoothness (EMA Length)', defval: 50 },
  { id: 'upTrendColor', type: 'color', title: 'Uptrend Line Color', defval: 'rgb(0, 255, 132)' },
  { id: 'downTrendColor', type: 'color', title: 'Downtrend Line Color', defval: 'rgb(255, 0, 0)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Line', color: 'rgb(0, 255, 132)', lineWidth: 3 },
];

export const metadata = {
  title: 'ATR Based Zigzag w EMA',
  shortTitle: 'ATR Based Zigzag w EMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = IndicatorResult & { barColors: BarColorData[] };

interface ZigzagVars {
  LL: number;
  HH: number;
  trend: number;
}

interface ZigzagRun extends BarRunState<ZigzagVars> {
  atr: ReturnType<typeof taStep.atr>;
  ema: ReturnType<typeof taStep.ema>;
  plot0: { time: number; value: number; color: string }[];
  barColors: BarColorData[];
}

function study(inputs: Partial<AtrBasedZigzagWEmaInputs>): BarStudy<ZigzagRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const atr = taStep.atr(cfg.atrLength);
      const ema = taStep.ema(cfg.lineSmoothLength);
      const s: ZigzagRun = {
        atr, ema, plot0: [], barColors: [], steps: [atr, ema],
        // var float LL = na; var float HH = na; var int trend = 1
        vars: { LL: NaN, HH: NaN, trend: 1 },
        lists: [], series: [],
      };
      s.series = [s.plot0, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { high, low } = b;
      const atr = s.atr.step(high, low, b.close);
      const smooth = s.ema.step((high + low) / 2);
      const v = s.vars;
      // LL := na(LL[1]) ? low : LL[1]; HH := na(HH[1]) ? high : HH[1]
      if (isNaN(v.LL)) v.LL = low;
      if (isNaN(v.HH)) v.HH = high;
      const band = atr * cfg.atrMult;
      if (v.trend > 0) {
        if (ge(high, v.HH)) v.HH = high;
        else if (gt(v.HH - band, low)) {
          v.trend = -1;
          v.LL = low;
        }
      } else if (ge(v.LL, low)) {
        v.LL = low;
      } else if (gt(high, v.LL + band)) {
        v.trend = 1;
        v.HH = high;
      }
      const c = v.trend === 1 ? cfg.upTrendColor : cfg.downTrendColor;
      // plot(smoothLine, color = trend == 1 ? upTrendColor : downTrendColor, linewidth = 3, title = 'Trend Line')
      s.plot0[i] = { time: b.time, value: smooth, color: c };
      // barcolor(trend == 1 ? upTrendColor : downTrendColor)
      s.barColors[i] = { time: b.time as number, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AtrBasedZigzagWEmaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AtrBasedZigzagWEmaInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AtrBasedZigzagWEma = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
