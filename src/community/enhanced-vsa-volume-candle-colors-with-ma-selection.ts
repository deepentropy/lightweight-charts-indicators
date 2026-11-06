/**
 * Enhanced VSA Volume & Candle Colors with MA Selection
 *
 * Volume columns coloured by volume class: extreme (volume above its `percentile` nearest-rank percentile over
 * `length` bars), high (above the selected volume MA * high multiplier, not extreme), low (below the selected MA *
 * low multiplier) or neutral. High and low colours get a transparency of 60 - min(max(volume / MA * 30, 0), 40)
 * (the low colour plus an extra transparency). The selected MA (SMA, EMA or VWMA of the volume over `length`) and a
 * reference EMA of the volume are drawn as lines; the price bars take the extreme / high / low colours.
 * Alerts (alertcondition, `alerts` of the result): 'Extreme Volume', 'High Volume' and 'Low Volume', true on the bars
 * of each volume class.
 *
 * Reference: "Enhanced VSA Volume & Candle Colors with MA Selection" by ViZiV
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export interface EnhancedVsaVolumeCandleColorsInputs {
  /** Volume lookback period (MA and percentile window) */
  length: number;
  /** High volume multiplier of the selected MA */
  highMult: number;
  /** Low volume multiplier of the selected MA */
  lowMult: number;
  /** Extreme volume percentile (nearest rank) */
  percentileThreshold: number;
  /** Colour the price bars from the volume class */
  colorBars: boolean;
  /** Moving average of the volume */
  maType: 'SMA' | 'EMA' | 'VWMA';
  /** Length of the reference EMA of the volume */
  refEmaLength: number;
  /** Transparency of the neutral volume columns */
  neutralTransp: number;
  /** Extra transparency of the low volume colour */
  lowTranspOffset: number;
  highColor: string;
  lowColor: string;
  neutralColor: string;
  veryHighColor: string;
}

export const defaultInputs: EnhancedVsaVolumeCandleColorsInputs = {
  length: 200,
  highMult: 1.5,
  lowMult: 0.5,
  percentileThreshold: 90,
  colorBars: true,
  maType: 'SMA',
  refEmaLength: 400,
  neutralTransp: 80,
  lowTranspOffset: 20,
  highColor: color.purple,
  lowColor: color.gray,
  neutralColor: color.blue,
  veryHighColor: color.orange,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Volume Lookback Period', defval: 200 },
  { id: 'highMult', type: 'float', title: 'High Volume Multiplier', defval: 1.5 },
  { id: 'lowMult', type: 'float', title: 'Low Volume Multiplier', defval: 0.5 },
  { id: 'percentileThreshold', type: 'int', title: 'Extreme Volume Percentile', defval: 90, min: 1, max: 99 },
  { id: 'colorBars', type: 'bool', title: 'Color Price Bars Based on Volume', defval: true },
  { id: 'maType', type: 'string', title: 'Select Moving Average', defval: 'SMA', options: ['SMA', 'EMA', 'VWMA'] },
  { id: 'refEmaLength', type: 'int', title: 'Reference EMA Length', defval: 400, min: 1 },
  { id: 'neutralTransp', type: 'int', title: 'Neutral Volume Transparency', defval: 80, min: 0, max: 100 },
  { id: 'lowTranspOffset', type: 'int', title: 'Low Volume Extra Transparency', defval: 20, min: 0, max: 100 },
  { id: 'highColor', type: 'color', title: 'High Volume Color', defval: color.purple },
  { id: 'lowColor', type: 'color', title: 'Low Volume Color', defval: color.gray },
  { id: 'neutralColor', type: 'color', title: 'Neutral Volume Color', defval: color.blue },
  { id: 'veryHighColor', type: 'color', title: 'Extreme Volume Color', defval: color.orange },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: color.blue, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Selected MA (SMA, EMA, or VWMA)', color: color.green, lineWidth: 2 },
  { id: 'plot2', title: 'Reference Smoothed Volume (EMA)', color: color.purple, lineWidth: 2 },
];

export const metadata = {
  title: 'Enhanced VSA Volume & Candle Colors with MA Selection',
  shortTitle: 'Enhanced VSA Volume & Candle Colors with MA Selection',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time, with the rules of the oakscriptjs
 * function (same doubles): the window kept sorted (a new value goes before the first value >= it, na last), the value
 * of the bar leaving it removed, the value at rank `ceil(percentage / 100 * length)`; na for the first `length - 1`
 * bars. A step reads the committed window without changing it.
 */
class PercentileNearestRank implements Committable {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private readonly rank: number;
  private pending: { i: number; v: number; k: number } | null = null;

  constructor(private readonly length: number, percentage: number) {
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  step(i: number, v: number): number {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    this.pending = { i, v, k };
    if (i < this.length - 1) return NaN;
    // the window with v inserted at k, without the value of bar i - length
    const removed = i >= this.length ? this.bars.indexOf(i - this.length) : -1;
    const removedW = removed < 0 ? -1 : removed < k ? removed : removed + 1;
    const j = this.rank - 1;
    const w = removedW >= 0 && j >= removedW ? j + 1 : j;
    return w < k ? values[w]! : w === k ? v : values[w - 1]!;
  }

  commit(): void {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    this.values.splice(p.k, 0, p.v);
    this.bars.splice(p.k, 0, p.i);
    if (p.i >= this.length) {
      const old = this.bars.indexOf(p.i - this.length);
      this.values.splice(old, 1);
      this.bars.splice(old, 1);
    }
  }
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface VsaRun extends BarRunState<Record<string, never>> {
  userMa: { step(v: number): number; commit(): void };
  pct: PercentileNearestRank;
  refEma: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<EnhancedVsaVolumeCandleColorsInputs>): BarStudy<VsaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const neutral = String(color.new(cfg.neutralColor, cfg.neutralTransp));
  const veryHigh = String(color.new(cfg.veryHighColor, 40));
  return {
    init() {
      let userMa: VsaRun['userMa'];
      if (cfg.maType === 'SMA') userMa = new WindowSma(cfg.length);
      else if (cfg.maType === 'EMA') userMa = taStep.ema(cfg.length);
      else {
        // ta.vwma(volume, length) of the volume weighted by itself
        const m = taStep.vwma(cfg.length);
        userMa = { step: (v) => m.step(v, v), commit: () => m.commit() };
      }
      const s: VsaRun = {
        userMa,
        pct: new PercentileNearestRank(cfg.length, cfg.percentileThreshold),
        refEma: taStep.ema(cfg.refEmaLength),
        plot0: [], plot1: [], plot2: [], barColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.userMa, s.pct, s.refEma];
      s.lists = [s.barColors, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i]!.time;
      const v = bars[i]!.volume ?? NaN;
      const ma = s.userMa.step(v);
      const pct = s.pct.step(i, v);
      const refEma = s.refEma.step(v);
      const veryHighVol = gt(v, pct);
      const isHighVol = gt(v, ma * cfg.highMult) && !veryHighVol;
      const isLowVol = lt(v, ma * cfg.lowMult);
      // transp_level = 60 - math.min(math.max(volume / user_ma * 30, 0), 40) (na when user_ma is na)
      const r = (v / ma) * 30;
      const transp = 60 - Math.min(Math.max(r, 0), 40);
      const highC = String(color.new(cfg.highColor, transp));
      const lowC = String(color.new(cfg.lowColor, Math.min(transp + cfg.lowTranspOffset, 100)));
      const c = veryHighVol ? veryHigh : isHighVol ? highC : isLowVol ? lowC : neutral;
      s.plot0[i] = { time: t, value: Number.isFinite(v) ? v : NaN, color: c };
      s.plot1[i] = { time: t, value: Number.isFinite(ma) ? ma : NaN };
      s.plot2[i] = { time: t, value: Number.isFinite(refEma) ? refEma : NaN };
      if (cfg.colorBars && (veryHighVol || isHighVol || isLowVol)) s.barColors.push({ time: t, color: c });
      // alertcondition(very_high_vol) / alertcondition(is_high_vol) / alertcondition(is_low_vol)
      s.flags[0]![i] = veryHighVol;
      s.flags[1]![i] = isHighVol;
      s.flags[2]![i] = isLowVol;
      if (veryHighVol) s.times[0]!.push(t as number);
      if (isHighVol) s.times[1]!.push(t as number);
      if (isLowVol) s.times[2]!.push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EnhancedVsaVolumeCandleColorsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EnhancedVsaVolumeCandleColorsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Extreme Volume', message: 'Extreme volume spike detected!' },
  { id: 'alert1', title: 'High Volume', message: 'High volume detected.' },
  { id: 'alert2', title: 'Low Volume', message: 'Low volume detected.' },
];

export const EnhancedVsaVolumeCandleColorsWithMaSelection = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
