/**
 * Long Short dom
 *
 * Vortex indicator: VI+ = sum(|high - low[1]|, length) / sum(ATR(1), length) and
 * VI- = sum(|low - high[1]|, length) / sum(ATR(1), length). VI+ and VI- are drawn where they are above zero (or
 * always with "show values below zero"), with their difference as green / maroon columns, the highest and the
 * lowest of the two lines, a dashed zero line and a green / red background when VI+ is above / not above VI-.
 * Alerts (alertcondition, `alerts` of the result): VI+ crossing over VI- and VI+ crossing under VI-.
 *
 * Reference: "Long Short dom" by Robin-Hood-trading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LongShortDomInputs {
  /** Vortex length */
  period: number;
  /** Show the VI+ - VI- histogram */
  showHistogram: boolean;
  /** Show the trend background */
  showBackground: boolean;
  /** Show values below zero */
  showBelowZero: boolean;
}

export const defaultInputs: LongShortDomInputs = {
  period: 14,
  showHistogram: true,
  showBackground: true,
  showBelowZero: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Length', defval: 14, min: 2 },
  { id: 'showHistogram', type: 'bool', title: 'Показывать гистограмму разницы VI+ - VI-', defval: true },
  { id: 'showBackground', type: 'bool', title: 'Показывать фоновую зону тренда', defval: true },
  { id: 'showBelowZero', type: 'bool', title: 'Показывать значения ниже нуля?', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VI +', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'VI -', color: color.red, lineWidth: 2 },
  { id: 'plot2', title: 'VI+ - VI-', color: color.lime, lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Highest Line', color: color.teal, lineWidth: 1 },
  { id: 'plot4', title: 'Lowest Line', color: color.orange, lineWidth: 1 },
];

export const metadata = {
  title: 'Long Short dom',
  shortTitle: 'VI+',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface VortexRun extends BarRunState<Record<string, never>> {
  vmp: WindowSum;
  vmm: WindowSum;
  atr: ReturnType<typeof taStep.atr>;
  str: WindowSum;
  vipArr: number[];
  vimArr: number[];
  plots: Point[][];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LongShortDomInputs>): BarStudy<VortexRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.period;
  const bull = String(color.new(color.green, 85));
  const bear = String(color.new(color.red, 85));
  return {
    init() {
      // the length check of math.sum (the same runtime error)
      math.sum([], len);
      const vmp = new WindowSum(len);
      const vmm = new WindowSum(len);
      const atr = taStep.atr(1);
      const str = new WindowSum(len);
      const s: VortexRun = {
        vmp, vmm, atr, str, vipArr: [], vimArr: [], plots: Array.from({ length: 5 }, () => []), bgColors: [],
        flags: [[], []], times: [[], []], steps: [vmp, vmm, atr, str], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, ...s.times];
      s.series = [s.vipArr, s.vimArr, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // VMP = math.sum(math.abs(high - low[1]), period_), VMM = math.sum(math.abs(low - high[1]), period_)
      const vmp = s.vmp.step(i > 0 ? Math.abs(b.high - bars[i - 1].low) : NaN);
      const vmm = s.vmm.step(i > 0 ? Math.abs(b.low - bars[i - 1].high) : NaN);
      // STR = math.sum(ta.atr(1), period_)
      const str = s.str.step(s.atr.step(b.high, b.low, b.close));
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); comparisons use the infinite value, plots show na
      const vip = vmp / str;
      const vim = vmm / str;
      s.vipArr[i] = vip;
      s.vimArr[i] = vim;
      const finalVip = cfg.showBelowZero ? vip : gt(vip, 0) ? vip : NaN;
      const finalVim = cfg.showBelowZero ? vim : gt(vim, 0) ? vim : NaN;
      const p = s.plots;
      p[0][i] = { time, value: fin(finalVip), color: color.green };
      p[1][i] = { time, value: fin(finalVim), color: color.red };
      // bgcolor(showBackground ? (VIP > VIM ? color.new(color.green, 85) : color.new(color.red, 85)) : na)
      if (cfg.showBackground) s.bgColors.push({ time, color: gt(vip, vim) ? bull : bear });
      // plot(showHistogram ? delta : na, 'VI+ - VI-', style_columns, color = delta >= 0 ? color.lime : color.maroon)
      const delta = vip - vim;
      p[2][i] = { time, value: cfg.showHistogram ? fin(delta) : NaN, color: ge(delta, 0) ? color.lime : color.maroon };
      p[3][i] = { time, value: fin(max(finalVip, finalVim)), color: color.teal };
      p[4][i] = { time, value: fin(min(finalVip, finalVim)), color: color.orange };
      // crossUp = ta.crossover(VIP, VIM), crossDown = ta.crossunder(VIP, VIM)
      const pv = i > 0 ? s.vipArr[i - 1] : NaN;
      const pw = i > 0 ? s.vimArr[i - 1] : NaN;
      const up = vip > vim && pv <= pw;
      const down = vip < vim && pv >= pw;
      s.flags[0][i] = up;
      s.flags[1][i] = down;
      if (up) s.times[0].push(time as number);
      if (down) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed', linewidth: 1 } }],
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LongShortDomInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LongShortDomInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'VI+ пересекает VI- вверх', message: 'VI+ пересек VI- вверх (возможный лонг)' },
  { id: 'alert1', title: 'VI+ пересекает VI- вниз', message: 'VI+ пересек VI- вниз (возможный шорт)' },
];

export const LongShortDom = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
