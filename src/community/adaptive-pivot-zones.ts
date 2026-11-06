/**
 * Adaptive Pivot Zones
 *
 * The range runs from the last pivot low to the last pivot high (pivots with `lenSwing` bars on each side). Three
 * levels inside it (low + range * level 1 / 2 / 3), each smoothed by an SMA, are drawn with fills between them. The
 * lines and fills are bullish when the close is above the highest level, bearish below the lowest one, and keep
 * their previous colour (or take the neutral colour) in between. Optional bar colours: bull above the middle level,
 * bear below it.
 * Alerts (alertcondition, `alerts` of the result): the close crosses over / under the middle level.
 *
 * Reference: "Adaptive Pivot Zones" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdaptivePivotZonesInputs {
  /** Pivot length (bars on each side) */
  lenSwing: number;
  /** SMA length of the levels */
  smoothLen: number;
  pivotLevel1: number;
  pivotLevel2: number;
  pivotLevel3: number;
  /** Bullish colour (line) */
  bullColor: string;
  /** Bearish colour (line) */
  bearColor: string;
  /** Use the neutral colour between the lowest and the highest level */
  useNeutral: boolean;
  /** Neutral colour (line) */
  neutralColor: string;
  /** Fill transparency (0-100) */
  fillOpacity: number;
  /** Paint bars (middle level) */
  paintBars: boolean;
  paintBullColor: string;
  paintBearColor: string;
}

export const defaultInputs: AdaptivePivotZonesInputs = {
  lenSwing: 10,
  smoothLen: 1,
  pivotLevel1: 0.382,
  pivotLevel2: 0.5,
  pivotLevel3: 0.618,
  bullColor: 'rgb(22, 193, 67)',
  bearColor: 'rgb(229, 11, 11)',
  useNeutral: false,
  neutralColor: color.gray,
  fillOpacity: 80,
  paintBars: false,
  paintBullColor: color.green,
  paintBearColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenSwing', type: 'int', title: 'Pivot Length', defval: 10, min: 2 },
  { id: 'smoothLen', type: 'int', title: 'Smoothing Length', defval: 1, min: 1 },
  { id: 'pivotLevel1', type: 'float', title: 'Pivot Level 1', defval: 0.382, min: 0.0, max: 1.0, step: 0.001 },
  { id: 'pivotLevel2', type: 'float', title: 'Pivot Level 2', defval: 0.5, min: 0.0, max: 1.0, step: 0.001 },
  { id: 'pivotLevel3', type: 'float', title: 'Pivot Level 3', defval: 0.618, min: 0.0, max: 1.0, step: 0.001 },
  { id: 'bullColor', type: 'color', title: 'Bullish Color (line)', defval: 'rgb(22, 193, 67)' },
  { id: 'bearColor', type: 'color', title: 'Bearish Color (line)', defval: 'rgb(229, 11, 11)' },
  { id: 'useNeutral', type: 'bool', title: 'Use Neutral Color?', defval: false },
  { id: 'neutralColor', type: 'color', title: 'Neutral Color (line)', defval: color.gray },
  { id: 'fillOpacity', type: 'int', title: 'Fill Opacity (0–100)', defval: 80, min: 0, max: 100 },
  { id: 'paintBars', type: 'bool', title: 'Paint Bars (Mid Pivot)', defval: false },
  { id: 'paintBullColor', type: 'color', title: 'Bull Candle Color', defval: color.green },
  { id: 'paintBearColor', type: 'color', title: 'Bear Candle Color', defval: color.red },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Pivot Line 1', color: 'rgb(22, 193, 67)', lineWidth: 2 },
  { id: 'plot1', title: 'Pivot Line 2', color: 'rgb(22, 193, 67)', lineWidth: 1 },
  { id: 'plot2', title: 'Pivot Line 3', color: 'rgb(22, 193, 67)', lineWidth: 2 },
];

export const metadata = {
  title: 'Adaptive Pivot Zones',
  shortTitle: 'Adaptive Pivot Zones',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };

type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface ApzVars {
  /** var drHigh / drLow: last pivot high / low */
  drHigh: number;
  drLow: number;
  /** var color prevColor = bullColor */
  prevColor: string;
}

interface ApzRun extends BarRunState<ApzVars> {
  ph: PivotStep;
  pl: PivotStep;
  sma: WindowSma[];
  s2: number[];
  plots: Point[][];
  fillColors: string[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AdaptivePivotZonesInputs>): BarStudy<ApzRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      // ph = ta.pivothigh(high, lenSwing, lenSwing); pl = ta.pivotlow(low, lenSwing, lenSwing)
      const ph = new PivotStep(cfg.lenSwing, cfg.lenSwing, true);
      const pl = new PivotStep(cfg.lenSwing, cfg.lenSwing, false);
      const sma = [new WindowSma(cfg.smoothLen), new WindowSma(cfg.smoothLen), new WindowSma(cfg.smoothLen)];
      const s: ApzRun = {
        ph, pl, sma, s2: [], plots: [[], [], []], fillColors: [], barColors: [], flags: [[], []], times: [[], []],
        steps: [ph, pl, ...sma],
        vars: { drHigh: NaN, drLow: NaN, prevColor: cfg.bullColor },
        lists: [], series: [],
      };
      s.lists = [s.barColors, ...s.times];
      s.series = [s.s2, ...s.plots, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);
      // var drHigh / drLow: last pivot high / low; the levels exist once both are known
      if (!isNaN(ph)) v.drHigh = ph;
      if (!isNaN(pl)) v.drLow = pl;
      let line1 = NaN;
      let line2 = NaN;
      let line3 = NaN;
      if (!isNaN(v.drHigh) && !isNaN(v.drLow)) {
        const rng = v.drHigh - v.drLow;
        line1 = v.drLow + rng * cfg.pivotLevel1;
        line2 = v.drLow + rng * cfg.pivotLevel2;
        line3 = v.drLow + rng * cfg.pivotLevel3;
      }
      const s1 = s.sma[0].step(line1);
      const s2 = s.sma[1].step(line2);
      const s3 = s.sma[2].step(line3);
      s.s2[i] = s2;

      let lowerLine = NaN;
      let upperLine = NaN;
      if (!isNaN(s1) && !isNaN(s2) && !isNaN(s3)) {
        lowerLine = Math.min(Math.min(s1, s2), s3);
        upperLine = Math.max(Math.max(s1, s2), s3);
      }
      // calcColor(lowerLine, upperLine)
      let col = v.prevColor;
      if (!isNaN(lowerLine) && !isNaN(upperLine)) {
        if (lt(b.close, lowerLine)) col = cfg.bearColor;
        else if (gt(b.close, upperLine)) col = cfg.bullColor;
        else if (cfg.useNeutral) col = cfg.neutralColor;
        else col = v.prevColor;
      }
      v.prevColor = col;

      s.plots[0][i] = { time: b.time, value: s1, color: col };
      s.plots[1][i] = { time: b.time, value: s2, color: col };
      s.plots[2][i] = { time: b.time, value: s3, color: col };
      // fillColor = color.new(combinedColor, fillOpacity)
      s.fillColors[i] = String(color.new(col, cfg.fillOpacity));

      // barcolor(paintBars ? (close > mid ? paintBullColor : close < mid ? paintBearColor : na) : na)
      if (cfg.paintBars && !isNaN(s2)) {
        if (gt(b.close, s2)) s.barColors.push({ time: b.time, color: cfg.paintBullColor });
        else if (lt(b.close, s2)) s.barColors.push({ time: b.time, color: cfg.paintBearColor });
      }

      // bullCross = not na(smoothedLine2) and ta.crossover(close, smoothedLine2); bearCross alike with ta.crossunder
      const pc = i > 0 ? bars[i - 1].close : NaN;
      const ps = i > 0 ? s.s2[i - 1] : NaN;
      const flags = [!isNaN(s2) && b.close > s2 && pc <= ps, !isNaN(s2) && b.close < s2 && pc >= ps];
      for (let k = 0; k < 2; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(b.time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const fillColors = s.fillColors.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Fill 1-2' }, colors: fillColors },
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Fill 2-3' }, colors: fillColors },
        ],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptivePivotZonesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdaptivePivotZonesInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Change', message: 'Price crossed ABOVE mid pivot → Bullish bias' },
  { id: 'alert1', title: 'Bearish Trend Change', message: 'Price crossed BELOW mid pivot → Bearish bias' },
];

export const AdaptivePivotZones = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
