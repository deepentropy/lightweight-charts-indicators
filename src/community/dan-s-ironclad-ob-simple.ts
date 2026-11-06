/**
 * Dan's Ironclad OB - Simple
 *
 * Pivot highs / lows (`pivotLen` bars on each side) set the last structure high / low. When the close crosses above
 * the last high, the last down candle of the 50 bars before becomes the buy zone (its high and low) and the high is
 * cleared until the next pivot; a cross under the last low takes the last up candle as the sell zone. A close below
 * the buy zone or above the sell zone removes the zone. The zones are drawn as fills between hidden plots.
 *
 * Reference: "Dan's Ironclad OB - Simple" by hynaxiii
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DanSIroncladObSimpleInputs {
  /** Pivot length (bars on each side) */
  pivotLen: number;
  /** Buy zone fill colour */
  obColorBull: string;
  /** Sell zone fill colour */
  obColorBear: string;
}

export const defaultInputs: DanSIroncladObSimpleInputs = {
  pivotLen: 5,
  obColorBull: String(color.new('#388e3c', 60)),
  obColorBear: String(color.new('#d32f2f', 60)),
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Structure Lookback', defval: 5 },
  { id: 'obColorBull', type: 'color', title: 'Buy Zone Color', defval: String(color.new('#388e3c', 60)) },
  { id: 'obColorBear', type: 'color', title: 'Sell Zone Color', defval: String(color.new('#d32f2f', 60)) },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Buy Top', color: 'transparent', lineWidth: 1, style: 'linebr' },
  { id: 'plot1', title: 'Buy Btm', color: 'transparent', lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Sell Top', color: 'transparent', lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Sell Btm', color: 'transparent', lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: "Dan's Ironclad OB - Simple",
  shortTitle: "Dan's Ironclad OB - Simple",
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

interface ObVars {
  lastHigh: number;
  lastLow: number;
  buyZoneTop: number;
  buyZoneBtm: number;
  sellZoneTop: number;
  sellZoneBtm: number;
  /** ta.crossover / ta.crossunder: the values of the last bar where both were not na */
  pcH: number;
  pH1: number;
  pcL: number;
  pL1: number;
}

interface ObRun extends BarRunState<ObVars> {
  pH: PivotStep;
  pL: PivotStep;
  plots: Point[][];
  buyColors: string[];
  sellColors: string[];
}

function study(inputs: Partial<DanSIroncladObSimpleInputs>): BarStudy<ObRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const pH = new PivotStep(cfg.pivotLen, cfg.pivotLen, true);
      const pL = new PivotStep(cfg.pivotLen, cfg.pivotLen, false);
      const s: ObRun = {
        pH, pL, plots: Array.from({ length: 4 }, () => []), buyColors: [], sellColors: [], steps: [pH, pL],
        vars: {
          lastHigh: NaN, lastLow: NaN, buyZoneTop: NaN, buyZoneBtm: NaN, sellZoneTop: NaN, sellZoneBtm: NaN,
          pcH: NaN, pH1: NaN, pcL: NaN, pL1: NaN,
        },
        lists: [], series: [],
      };
      s.series = [...s.plots, s.buyColors, s.sellColors];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const close = b.close;
      const pH = s.pH.step(i, b.high);
      const pL = s.pL.step(i, b.low);
      if (!isNaN(pH)) v.lastHigh = pH;
      if (!isNaN(pL)) v.lastLow = pL;

      // ta.crossover(close, lastHigh) / ta.crossunder(close, lastLow) compare exactly (no 1e-10 tolerance; na compares
      // false)
      const bullBreak = close > v.lastHigh && v.pcH <= v.pH1;
      const bearBreak = close < v.lastLow && v.pcL >= v.pL1;
      if (!isNaN(close) && !isNaN(v.lastHigh)) {
        v.pcH = close;
        v.pH1 = v.lastHigh;
      }
      if (!isNaN(close) && !isNaN(v.lastLow)) {
        v.pcL = close;
        v.pL1 = v.lastLow;
      }

      // Buy zone: the last down candle of the 50 bars before the break
      if (bullBreak && !isNaN(v.lastHigh)) {
        for (let k = 1; k <= 50 && i - k >= 0; k++) {
          if (lt(bars[i - k].close, bars[i - k].open)) {
            v.buyZoneTop = bars[i - k].high;
            v.buyZoneBtm = bars[i - k].low;
            break;
          }
        }
        v.lastHigh = NaN;
      }
      // Sell zone: the last up candle of the 50 bars before the break
      if (bearBreak && !isNaN(v.lastLow)) {
        for (let k = 1; k <= 50 && i - k >= 0; k++) {
          if (gt(bars[i - k].close, bars[i - k].open)) {
            v.sellZoneTop = bars[i - k].high;
            v.sellZoneBtm = bars[i - k].low;
            break;
          }
        }
        v.lastLow = NaN;
      }

      // Mitigation
      if (lt(close, v.buyZoneBtm)) {
        v.buyZoneTop = NaN;
        v.buyZoneBtm = NaN;
      }
      if (gt(close, v.sellZoneTop)) {
        v.sellZoneTop = NaN;
        v.sellZoneBtm = NaN;
      }
      const time = b.time;
      const p = s.plots;
      p[0][i] = { time, value: v.buyZoneTop, color: 'transparent' };
      p[1][i] = { time, value: v.buyZoneBtm, color: 'transparent' };
      p[2][i] = { time, value: v.sellZoneTop, color: 'transparent' };
      p[3][i] = { time, value: v.sellZoneBtm, color: 'transparent' };
      // fill(p1, p2, buyZoneTop > 0 ? obColorBull : na, "Buy Zone"); fill(p3, p4, sellZoneTop > 0 ? obColorBear : na, "Sell Zone")
      s.buyColors[i] = gt(v.buyZoneTop, 0) ? cfg.obColorBull : 'transparent';
      s.sellColors[i] = gt(v.sellZoneTop, 0) ? cfg.obColorBear : 'transparent';
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Buy Zone', color: cfg.obColorBull }, colors: s.buyColors.slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Sell Zone', color: cfg.obColorBear }, colors: s.sellColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DanSIroncladObSimpleInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DanSIroncladObSimpleInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DanSIroncladObSimple = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
