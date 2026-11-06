/**
 * Golden/Death Cross Highlighter
 *
 * A fast and a slow SMA of the close. A golden cross (fast crosses above slow) starts the golden state, a death cross
 * (fast crosses below slow) starts the death state. The background is yellow in the golden state when the close is
 * above both MAs and red in the death state when the close is below both MAs (transparency from the inputs).
 * Alerts (alertcondition, `alerts` of the result): 'Golden Cross' and 'Death Cross', on the bars of the crosses.
 *
 * Reference: "Golden/Death Cross Highlighter" by dripvesting
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { WindowSma, createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type GoldenDeathCrossHighlighterLineStyle = 'Solid' | 'Dashed' | 'Dotted';

export interface GoldenDeathCrossHighlighterInputs {
  fastLength: number;
  slowLength: number;
  /** Transparency (0-100) of the golden state background */
  goldenOpacity: number;
  /** Transparency (0-100) of the death state background */
  deathOpacity: number;
  fastMAColor: string;
  slowMAColor: string;
  /** Line width of the fast MA (static plot width: the port keeps the default 2) */
  fastMAWidth: number;
  /** Line width of the slow MA (static plot width: the port keeps the default 2) */
  slowMAWidth: number;
  /** Solid = line, Dashed = line with breaks, Dotted = circles (static plot style: the port keeps the default) */
  fastMAStyle: GoldenDeathCrossHighlighterLineStyle;
  /** Solid = line, Dashed = line with breaks, Dotted = circles (static plot style: the port keeps the default) */
  slowMAStyle: GoldenDeathCrossHighlighterLineStyle;
}

export const defaultInputs: GoldenDeathCrossHighlighterInputs = {
  fastLength: 50,
  slowLength: 200,
  goldenOpacity: 90,
  deathOpacity: 90,
  fastMAColor: color.blue,
  slowMAColor: color.red,
  fastMAWidth: 2,
  slowMAWidth: 2,
  fastMAStyle: 'Solid',
  slowMAStyle: 'Solid',
};

const STYLES: GoldenDeathCrossHighlighterLineStyle[] = ['Solid', 'Dashed', 'Dotted'];

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast MA Length', defval: 50 },
  { id: 'slowLength', type: 'int', title: 'Slow MA Length', defval: 200 },
  { id: 'goldenOpacity', type: 'int', title: 'Golden Cross Highlight Opacity', defval: 90, min: 0, max: 100 },
  { id: 'deathOpacity', type: 'int', title: 'Death Cross Highlight Opacity', defval: 90, min: 0, max: 100 },
  { id: 'fastMAColor', type: 'color', title: 'Fast MA Color', defval: color.blue },
  { id: 'slowMAColor', type: 'color', title: 'Slow MA Color', defval: color.red },
  { id: 'fastMAWidth', type: 'int', title: 'Fast MA Width', defval: 2, min: 1, max: 4 },
  { id: 'slowMAWidth', type: 'int', title: 'Slow MA Width', defval: 2, min: 1, max: 4 },
  { id: 'fastMAStyle', type: 'string', title: 'Fast MA Style', defval: 'Solid', options: STYLES },
  { id: 'slowMAStyle', type: 'string', title: 'Slow MA Style', defval: 'Solid', options: STYLES },
];

// Plot widths and styles come from inputs in Pine (f_lineStyle: "Dashed" -> plot.style_linebr, "Dotted" ->
// plot.style_circles, else plot.style_line); PlotConfig is static, so the default inputs are used.
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast MA', color: color.blue, lineWidth: 2, style: 'line' },
  { id: 'plot1', title: 'Slow MA', color: color.red, lineWidth: 2, style: 'line' },
];

export const metadata = {
  title: 'Golden/Death Cross Highlighter',
  shortTitle: 'Golden/Death Cross Highlighter',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface GoldenDeathRun extends BarRunState<{ inGoldenCross: boolean; inDeathCross: boolean }> {
  fast: WindowSma;
  slow: WindowSma;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  golden: boolean[];
  death: boolean[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<GoldenDeathCrossHighlighterInputs>): BarStudy<GoldenDeathRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const goldenColor = String(color.new(color.yellow, cfg.goldenOpacity));
  const deathColor = String(color.new(color.red, cfg.deathOpacity));
  return {
    init() {
      const fast = new WindowSma(cfg.fastLength);
      const slow = new WindowSma(cfg.slowLength);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: GoldenDeathRun = {
        fast, slow, over, under, plot0: [], plot1: [], golden: [], death: [], bgColors: [],
        steps: [fast, slow, over, under],
        vars: { inGoldenCross: false, inDeathCross: false },
        lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.plot0, s.plot1, s.golden, s.death];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const fastMA = s.fast.step(b.close);
      const slowMA = s.slow.step(b.close);
      const goldenCross = s.over.step(fastMA, slowMA);
      const deathCross = s.under.step(fastMA, slowMA);
      if (goldenCross) {
        v.inGoldenCross = true;
        v.inDeathCross = false;
      } else if (deathCross) {
        v.inGoldenCross = false;
        v.inDeathCross = true;
      }
      const bullishCondition = v.inGoldenCross && gt(b.close, fastMA) && gt(b.close, slowMA);
      const bearishCondition = v.inDeathCross && lt(b.close, fastMA) && lt(b.close, slowMA);
      if (bullishCondition) s.bgColors.push({ time: b.time, color: goldenColor });
      else if (bearishCondition) s.bgColors.push({ time: b.time, color: deathColor });
      s.plot0[i] = { time: b.time, value: fastMA, color: cfg.fastMAColor };
      s.plot1[i] = { time: b.time, value: slowMA, color: cfg.slowMAColor };
      s.golden[i] = !!goldenCross;
      s.death[i] = !!deathCross;
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        bgColors: s.bgColors.slice(),
        // alertcondition(goldenCross, "Golden Cross") / alertcondition(deathCross, "Death Cross")
        alerts: alertStates(alertConditions, bars, [s.golden, s.death]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GoldenDeathCrossHighlighterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GoldenDeathCrossHighlighterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Golden Cross', message: 'Golden Cross Detected!' },
  { id: 'alert1', title: 'Death Cross', message: 'Death Cross Detected!' },
];

export const GoldenDeathCrossHighlighter = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
