/**
 * + Average Candle Bodies Range
 *
 * The candle body range (close - open in directional mode, the absolute body otherwise) smoothed by a moving
 * average (ACBR, columns), with a signal line (a moving average of the ACBR). Baselines come from a Donchian channel
 * of the ACBR (highest / lowest over a period, or the mean of six periods 5..200 in the RexDog mode) divided by the
 * height input. Background and bar colours show the ACBR beyond the baselines or the signal line, optionally only
 * with a rising / falling signal line, and bar colours can mark the crosses. Arrows mark continuation trades and
 * crosses mark the slow exits (the quick exits are hidden in the original, display.none, and not drawn).
 * Alerts (alertcondition, `alerts` of the result): the 10 conditions of the original (continuation trades, quick /
 * slow exits, baseline crosses, signal line crosses).
 *
 * Reference: "+ Average Candle Bodies Range" by ClassicScott
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Assembled by ©ClassicScott
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

type MaType = 'EMA' | 'HMA' | 'RMA' | 'SMA' | 'VWMA' | 'WMA';

export interface AverageCandleBodiesRangeInputs {
  /** Moving average of the candle body range */
  smoothingType: MaType;
  smoothingPeriod: number;
  /** Baseline period type: 'RexDog Self-Adjusting' or 'User Selected' */
  volPeriodType: 'RexDog Self-Adjusting' | 'User Selected';
  /** Donchian period of the baseline (User Selected) */
  volPeriod: number;
  /** Donchian calculated height: the baselines are the channel divided by this value */
  divisor: number;
  /** Moving average of the signal line */
  signalType: MaType;
  signalPeriod: number;
  /** Require increasing momentum of the signal line */
  signalLineStrongInput: boolean;
  /** ACBR is directional (oscillates around zero) */
  acbrIsDirectional: boolean;
  /** Baseline: colour the background */
  blineBgInput: boolean;
  /** Baseline: colour the bars */
  blineBarcolorInput: boolean;
  /** Baseline: colour the bar on a volatility advancing cross */
  blineStrongXInput: boolean;
  /** Baseline: colour the bar on a volatility declining cross */
  blineWeakXInput: boolean;
  /** Signal line: colour the background */
  signalBgInput: boolean;
  /** Signal line: colour the bars */
  signalBarcolorInput: boolean;
  /** Signal line: colour the bar on a volatility advancing cross */
  signalStrongXInput: boolean;
  /** Signal line: colour the bar on a volatility declining cross */
  signalWeakXInput: boolean;
  bgSwatchAbove: string;
  bgSwatchBelow: string;
  bgSwatchNeutral: string;
  xoverSwatch: string;
  xunderSwatch: string;
  barcolorSwatchAbove: string;
  barcolorSwatchBelow: string;
  barcolorSwatchNeutral: string;
}

const MA_OPTIONS: MaType[] = ['EMA', 'HMA', 'RMA', 'SMA', 'VWMA', 'WMA'];

export const defaultInputs: AverageCandleBodiesRangeInputs = {
  smoothingType: 'HMA',
  smoothingPeriod: 55,
  volPeriodType: 'User Selected',
  volPeriod: 55,
  divisor: 3,
  signalType: 'HMA',
  signalPeriod: 14,
  signalLineStrongInput: true,
  acbrIsDirectional: true,
  blineBgInput: true,
  blineBarcolorInput: true,
  blineStrongXInput: false,
  blineWeakXInput: false,
  signalBgInput: false,
  signalBarcolorInput: false,
  signalStrongXInput: false,
  signalWeakXInput: false,
  bgSwatchAbove: String(color.new('#448484', 50)),
  bgSwatchBelow: String(color.new('#5a4484', 50)),
  bgSwatchNeutral: String(color.new('#808080', 100)),
  xoverSwatch: String(color.new('#448484', 0)),
  xunderSwatch: String(color.new('#5a4484', 0)),
  barcolorSwatchAbove: String(color.new('#448484', 0)),
  barcolorSwatchBelow: String(color.new('#5a4484', 0)),
  barcolorSwatchNeutral: String(color.new('#808080', 0)),
};

export const inputConfig: InputConfig[] = [
  { id: 'smoothingType', type: 'string', title: 'Smoothing Type', defval: 'HMA', options: MA_OPTIONS },
  { id: 'smoothingPeriod', type: 'int', title: 'Period', defval: 55 },
  { id: 'volPeriodType', type: 'string', title: 'Baseline Period Type', defval: 'User Selected', options: ['RexDog Self-Adjusting', 'User Selected'] },
  { id: 'volPeriod', type: 'int', title: 'Period', defval: 55 },
  { id: 'divisor', type: 'float', title: 'Donchian Calculated Height', defval: 3, min: 0.1, step: 0.1 },
  { id: 'signalType', type: 'string', title: 'Signal Type', defval: 'HMA', options: MA_OPTIONS },
  { id: 'signalPeriod', type: 'int', title: 'Period', defval: 14 },
  { id: 'signalLineStrongInput', type: 'bool', title: 'Require Increasing Momentum of Signal Line', defval: true },
  { id: 'acbrIsDirectional', type: 'bool', title: 'ACBR is Directional', defval: true },
  { id: 'blineBgInput', type: 'bool', title: 'Color Background', defval: true },
  { id: 'blineBarcolorInput', type: 'bool', title: 'Color Bars', defval: true },
  { id: 'blineStrongXInput', type: 'bool', title: 'Volatility Advancing', defval: false },
  { id: 'blineWeakXInput', type: 'bool', title: 'Volatility Declining', defval: false },
  { id: 'signalBgInput', type: 'bool', title: 'Color Background', defval: false },
  { id: 'signalBarcolorInput', type: 'bool', title: 'Color Bars', defval: false },
  { id: 'signalStrongXInput', type: 'bool', title: 'Volatility Advancing', defval: false },
  { id: 'signalWeakXInput', type: 'bool', title: 'Volatility Declining', defval: false },
  { id: 'bgSwatchAbove', type: 'color', title: ' + ', defval: defaultInputs.bgSwatchAbove },
  { id: 'bgSwatchBelow', type: 'color', title: ' - ', defval: defaultInputs.bgSwatchBelow },
  { id: 'bgSwatchNeutral', type: 'color', title: ' ± ', defval: defaultInputs.bgSwatchNeutral },
  { id: 'xoverSwatch', type: 'color', title: ' + ', defval: defaultInputs.xoverSwatch },
  { id: 'xunderSwatch', type: 'color', title: ' - ', defval: defaultInputs.xunderSwatch },
  { id: 'barcolorSwatchAbove', type: 'color', title: ' + ', defval: defaultInputs.barcolorSwatchAbove },
  { id: 'barcolorSwatchBelow', type: 'color', title: ' - ', defval: defaultInputs.barcolorSwatchBelow },
  { id: 'barcolorSwatchNeutral', type: 'color', title: ' ± ', defval: defaultInputs.barcolorSwatchNeutral },
];

const RISE_COL = String(color.new('#445b84', 0));
const FALL_COL = String(color.new('#844444', 0));
const SIG_UP_COL = String(color.new('#448484', 0));
const SIG_DOWN_COL = String(color.new('#5a4484', 0));
const BASE_COL = String(color.new('#000000', 75));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Average Candle Bodies Range', color: RISE_COL, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Signal Line', color: SIG_UP_COL, lineWidth: 2 },
  { id: 'plot2', title: 'Upper Baseline', color: BASE_COL, lineWidth: 1, style: 'area' },
  { id: 'plot3', title: 'Lower Baseline', color: BASE_COL, lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: '+ Average Candle Bodies Range',
  shortTitle: '+ AVG CBR',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Colour that draws something: not na and not fully transparent */
const visible = (c: string | null): c is string => c !== null && !/^#[0-9a-f]{6}00$/i.test(c)
  && !/^rgba\([^)]*,\s*0(\.0*)?\s*\)$/.test(c) && c !== 'transparent';

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

/** One moving average of the script stepped bar by bar */
function maStep(type: string, len: number): Ma {
  switch (type) {
    case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'HMA': { const m = taStep.hma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'SMA': { const m = taStep.sma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 'RMA': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'VWMA': { const m = taStep.vwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    default: throw new Error('No matching MA type found.');
  }
}

/** a before b in the order of Math.max / Math.min: the numbers, -0 before +0 */
const before = (a: number, b: number) => a < b || (a === 0 && b === 0 && Object.is(a, -0) && Object.is(b, 0));

/**
 * `ta.highest(source, length)` / `ta.lowest` with a constant length, one bar at a time, with a monotonic queue: the
 * extreme of the last `length` non-na values (+-infinity skipped; all of them when fewer), also on a bar whose own
 * value is na; na before bar `length - 1` and while no value was received; +0 wins over -0 for the highest, -0 for the
 * lowest (the doubles of the library machine). `step` reads the queue without changing it.
 */
class ExtremeStep implements Committable {
  /** Indexes (in the non-na values) of the candidates, from the best; values kept by index */
  private readonly values: number[] = [];
  private readonly queue: number[] = [];
  private head = 0;
  private bars = 0;
  private pending = NaN;
  private stepped = false;

  constructor(private readonly length: number, private readonly lowest: boolean) {
    if (!(Math.trunc(length) >= 1)) throw new Error(`${lowest ? 'lowest' : 'highest'}: length must be at least 1, got ${length}`);
  }

  private better(a: number, b: number): boolean {
    return this.lowest ? before(a, b) : before(b, a);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const len = Math.trunc(this.length);
    const own = Number.isFinite(value);
    const count = this.values.length + (own ? 1 : 0);
    if (this.bars < len - 1 || count === 0) return NaN;
    // the first candidate still in the window of the last `len` values (with the own value)
    const from = count - len;
    let h = this.head;
    while (h < this.queue.length && this.queue[h] < from) h++;
    if (h === this.queue.length) return value;
    const best = this.values[this.queue[h]];
    return own && !this.better(best, value) ? value : best;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    const k = this.values.length;
    this.values.push(v);
    const q = this.queue;
    // drop the candidates the new value equals or beats (the newest of equal values is kept)
    while (q.length > this.head && !this.better(this.values[q[q.length - 1]], v)) q.pop();
    q.push(k);
    const from = k + 1 - Math.trunc(this.length);
    while (this.head < q.length && q[this.head] < from) this.head++;
    if (this.head > 1024 && this.head * 2 > q.length) {
      q.splice(0, this.head);
      this.head = 0;
    }
  }
}

const REX = [5, 9, 24, 50, 100, 200];

interface AcbrRun extends BarRunState<Record<string, never>> {
  acbrMa: Ma;
  signalMa: Ma;
  his: ExtremeStep[];
  los: ExtremeStep[];
  /** ta.crossover / ta.crossunder of the ACBR with the upper / lower baselines and the signal line */
  x: { step(a: number, b: number): boolean; commit(): void }[];
  acbr: number[];
  signalLine: number[];
  acbrColors: string[];
  signalColors: string[];
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AverageCandleBodiesRangeInputs>): BarStudy<AcbrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const dir = cfg.acbrIsDirectional;
  const rexMode = cfg.volPeriodType === 'RexDog Self-Adjusting';
  const {
    signalLineStrongInput: strong, blineBgInput, blineBarcolorInput, blineStrongXInput, blineWeakXInput,
    signalBgInput, signalBarcolorInput, signalStrongXInput, signalWeakXInput,
  } = cfg;
  return {
    init() {
      const lengths = rexMode ? REX : [cfg.volPeriod];
      const st: AcbrRun = {
        acbrMa: maStep(cfg.smoothingType, cfg.smoothingPeriod), signalMa: maStep(cfg.signalType, cfg.signalPeriod),
        his: lengths.map((l) => new ExtremeStep(l, false)), los: lengths.map((l) => new ExtremeStep(l, true)),
        x: [taStep.crossover(), taStep.crossunder(), taStep.crossover(), taStep.crossunder(), taStep.crossover(), taStep.crossunder()],
        acbr: [], signalLine: [], acbrColors: [], signalColors: [], plots: [[], [], [], []], markers: [], barColors: [],
        bgColors: [], flags: Array.from({ length: 10 }, () => []), times: Array.from({ length: 10 }, () => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      st.steps = [st.acbrMa, st.signalMa, ...st.his, ...st.los, ...st.x];
      st.lists = [st.markers, st.barColors, st.bgColors, ...st.times];
      st.series = [st.acbr, st.signalLine, st.acbrColors, st.signalColors, ...st.plots, ...st.flags];
      return st;
    },
    bar(st, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      // Candle body range
      let cbRange = 0.0;
      if (!dir && gt(b.close, b.open)) cbRange = b.close - b.open;
      else if (!dir && lt(b.close, b.open)) cbRange = b.open - b.close;
      else if (dir) cbRange = b.close - b.open;
      const a = st.acbrMa.step(cbRange, volume);
      st.acbr[i] = a;
      const s = st.signalMa.step(a, volume);
      st.signalLine[i] = s;

      // Donchian baseline
      let highestBaseline: number;
      let lowestBaseline: number;
      if (rexMode) {
        let hs = 0;
        let ls = 0;
        for (let k = 0; k < REX.length; k++) hs = hs + st.his[k].step(a);
        for (let k = 0; k < REX.length; k++) ls = ls + st.los[k].step(a);
        highestBaseline = hs / 6;
        lowestBaseline = ls / 6;
      } else {
        highestBaseline = st.his[0].step(a);
        lowestBaseline = st.los[0].step(a);
      }
      const up = dir ? highestBaseline / cfg.divisor : (highestBaseline + lowestBaseline) / cfg.divisor;
      const low = dir ? lowestBaseline / cfg.divisor : NaN;
      const a1 = i > 0 ? st.acbr[i - 1] : NaN;
      const s1 = i > 0 ? st.signalLine[i - 1] : NaN;

      const signalRising = strong && gt(s, s1);
      const signalFalling = strong && lt(s, s1);

      const blineUpperXover = st.x[0].step(a, up);
      const blineUpperXunder = st.x[1].step(a, up);
      const blineLowerXover = st.x[2].step(a, low);
      const blineLowerXunder = st.x[3].step(a, low);
      const signalXover = st.x[4].step(a, s);
      const signalXunder = st.x[5].step(a, s);

      // Baseline, non-directional
      const bgAboveBline = blineBgInput && !dir && gt(a, up);
      const bgBelowBline = blineBgInput && !dir && lt(a, up);
      const barcolorAboveBline = blineBarcolorInput && !dir && gt(a, up);
      const barcolorBelowBline = blineBarcolorInput && !dir && lt(a, up);
      const barcolorBlineStrongX = blineStrongXInput && blineUpperXover && !dir;
      const barcolorBlineWeakX = blineWeakXInput && blineUpperXunder && !dir;
      // Baseline, directional
      const dirBgAboveBline = blineBgInput && dir && gt(a, up);
      const dirBgBelowBline = blineBgInput && dir && lt(a, low);
      const dirBgNeutralBline = (blineBgInput && dir && lt(a, up) && gt(a, low))
        || (blineBgInput && dir && signalFalling && gt(a, up)) || (blineBgInput && dir && signalRising && lt(a, low));
      const dirBarcolorAboveBline = blineBarcolorInput && dir && gt(a, up);
      const dirBarcolorBelowBline = blineBarcolorInput && dir && lt(a, low);
      const dirBarcolorNeutralBline = (blineBarcolorInput && dir && lt(a, up) && gt(a, low))
        || (blineBarcolorInput && dir && signalFalling && gt(a, up))
        || (blineBarcolorInput && dir && signalRising && lt(a, low));
      const dirBarcolorBlineStrongXUp = blineStrongXInput && dir && blineUpperXover;
      const dirBarcolorBlineStrongXDown = blineStrongXInput && dir && blineLowerXunder;
      const dirBarcolorBlineWeakXUp = blineWeakXInput && dir && blineUpperXunder;
      const dirBarcolorBlineWeakXDown = blineWeakXInput && dir && blineLowerXover;

      // Signal line, non-directional
      const bgAboveSignal = signalBgInput && !dir && gt(a, s);
      const bgBelowSignal = signalBgInput && !dir && lt(a, s);
      const barcolorAboveSignal = signalBarcolorInput && !dir && gt(a, s);
      const barcolorBelowSignal = signalBarcolorInput && !dir && lt(a, s);
      const barcolorSignalStrongX = signalStrongXInput && signalXover && !dir;
      const barcolorSignalWeakX = signalWeakXInput && signalXunder && !dir;
      // Signal line, directional
      const dirBgAboveSignal = signalBgInput && dir && gt(a, 0) && gt(a, s);
      const dirBgBelowSignal = signalBgInput && dir && lt(a, 0) && lt(a, s);
      const dirBgNeutralSignal = (signalBgInput && dir && gt(a, 0) && lt(a, s))
        || (signalBgInput && dir && lt(a, 0) && gt(a, s))
        || (signalBgInput && dir && gt(a, 0) && gt(a, s) && signalFalling)
        || (signalBgInput && dir && lt(a, 0) && lt(a, s) && signalRising);
      const dirBarcolorAboveSignal = signalBarcolorInput && dir && gt(a, 0) && gt(a, s);
      const dirBarcolorBelowSignal = signalBarcolorInput && dir && lt(a, 0) && lt(a, s);
      const dirBarcolorNeutralSignal = (signalBarcolorInput && dir && gt(a, 0) && lt(a, s))
        || (signalBarcolorInput && dir && lt(a, 0) && gt(a, s))
        || (signalBarcolorInput && dir && gt(a, 0) && gt(a, s) && signalFalling)
        || (signalBarcolorInput && dir && lt(a, 0) && lt(a, s) && signalRising);
      const dirBarcolorSignalStrongXUp = signalStrongXInput && dir && gt(a, 0) && signalXover;
      const dirBarcolorSignalStrongXDown = signalStrongXInput && dir && lt(a, 0) && signalXunder;
      const dirBarcolorSignalWeakX = (signalWeakXInput && dir && gt(a, 0) && signalXunder)
        || (signalWeakXInput && dir && lt(a, 0) && signalXover);

      // ACBR colour (if chain without else: na)
      let acbrColor: string | null = null;
      if (!dir && gt(a, a1)) acbrColor = RISE_COL;
      else if (!dir && lt(a, a1)) acbrColor = FALL_COL;
      else if (gt(a, 0) && gt(a, a1) && dir) acbrColor = RISE_COL;
      else if (gt(a, 0) && lt(a, a1) && dir) acbrColor = FALL_COL;
      else if (lt(a, 0) && lt(a, a1) && dir) acbrColor = RISE_COL;
      else if (lt(a, 0) && gt(a, a1) && dir) acbrColor = FALL_COL;
      st.acbrColors[i] = acbrColor ?? 'transparent';

      // Signal line colour
      let signalColor: string | null = null;
      if ((gt(s, 0) && gt(s, s1)) || (lt(s, 0) && lt(s, s1))) signalColor = SIG_UP_COL;
      else if ((lt(s, 0) && gt(s, s1)) || (gt(s, 0) && lt(s, s1))) signalColor = SIG_DOWN_COL;
      st.signalColors[i] = signalColor ?? 'transparent';

      const { bgSwatchAbove, bgSwatchBelow, bgSwatchNeutral, xoverSwatch, xunderSwatch } = cfg;
      const { barcolorSwatchAbove, barcolorSwatchBelow, barcolorSwatchNeutral } = cfg;

      // Baseline: background requiring a strong signal line
      let aboveBaselineStrongSignal: string | null = null;
      if (signalRising && bgAboveBline) aboveBaselineStrongSignal = bgSwatchAbove;
      else if ((signalRising && bgBelowBline) || (signalFalling && bgAboveBline) || (signalFalling && bgBelowBline)) {
        aboveBaselineStrongSignal = bgSwatchBelow;
      } else if (signalRising && dirBgAboveBline) aboveBaselineStrongSignal = bgSwatchAbove;
      else if (signalFalling && dirBgBelowBline) aboveBaselineStrongSignal = bgSwatchBelow;
      else if (dirBgNeutralBline) aboveBaselineStrongSignal = bgSwatchNeutral;

      // Baseline: background not requiring a strong signal line
      let aboveBaseline: string | null = null;
      if (!strong && bgAboveBline) aboveBaseline = bgSwatchAbove;
      else if (!strong && bgBelowBline) aboveBaseline = bgSwatchBelow;
      else if (!strong && dirBgAboveBline) aboveBaseline = bgSwatchAbove;
      else if (!strong && dirBgBelowBline) aboveBaseline = bgSwatchBelow;
      else if (dirBgNeutralBline) aboveBaseline = bgSwatchNeutral;

      // Baseline: bar colour requiring a strong signal line
      let barColorAboveBaselineStrongSignal: string | null = null;
      if (signalRising && barcolorAboveBline) barColorAboveBaselineStrongSignal = barcolorSwatchAbove;
      else if ((signalRising && barcolorBelowBline) || (signalFalling && barcolorAboveBline)
        || (signalFalling && barcolorBelowBline)) barColorAboveBaselineStrongSignal = barcolorSwatchBelow;
      else if (signalRising && dirBarcolorAboveBline) barColorAboveBaselineStrongSignal = barcolorSwatchAbove;
      else if (signalFalling && dirBarcolorBelowBline) barColorAboveBaselineStrongSignal = barcolorSwatchBelow;
      else if (dirBarcolorNeutralBline) barColorAboveBaselineStrongSignal = barcolorSwatchNeutral;

      // Baseline: bar colour not requiring a strong signal line
      let barColorAboveBaseline: string | null = null;
      if (!strong && barcolorAboveBline) barColorAboveBaseline = barcolorSwatchAbove;
      else if (!strong && barcolorBelowBline) barColorAboveBaseline = barcolorSwatchBelow;
      else if (!strong && dirBarcolorAboveBline) barColorAboveBaseline = barcolorSwatchAbove;
      else if (!strong && dirBarcolorBelowBline) barColorAboveBaseline = barcolorSwatchBelow;
      else if (dirBarcolorNeutralBline) barColorAboveBaseline = barcolorSwatchNeutral;

      // Baseline crosses: bar colour requiring a strong signal line
      let barColorBaselineCrossStrongSignal: string | null = null;
      if (signalRising && barcolorBlineStrongX) barColorBaselineCrossStrongSignal = xoverSwatch;
      else if (barcolorBlineWeakX) barColorBaselineCrossStrongSignal = xunderSwatch;
      else if ((signalRising && dirBarcolorBlineStrongXUp) || (signalFalling && dirBarcolorBlineStrongXDown)) {
        barColorBaselineCrossStrongSignal = xoverSwatch;
      } else if (dirBarcolorBlineWeakXUp || dirBarcolorBlineWeakXDown) barColorBaselineCrossStrongSignal = xunderSwatch;

      // Baseline crosses: bar colour not requiring a strong signal line
      let barColorBaselineCross: string | null = null;
      if (!strong && barcolorBlineStrongX) barColorBaselineCross = xoverSwatch;
      else if (!strong && barcolorBlineWeakX) barColorBaselineCross = xunderSwatch;
      else if (!strong && dirBarcolorBlineStrongXUp) barColorBaselineCross = xoverSwatch;
      else if (!strong && dirBarcolorBlineStrongXDown) barColorBaselineCross = xoverSwatch;
      else if (!strong && dirBarcolorBlineWeakXUp) barColorBaselineCross = xunderSwatch;
      else if (!strong && dirBarcolorBlineWeakXDown) barColorBaselineCross = xunderSwatch;

      // Signal line: background requiring a strong signal line
      let aboveSignalLineStrongSignal: string | null = null;
      if (signalRising && bgAboveSignal) aboveSignalLineStrongSignal = bgSwatchAbove;
      else if ((signalRising && bgBelowSignal) || (signalFalling && bgAboveSignal) || (signalFalling && bgBelowSignal)) {
        aboveSignalLineStrongSignal = bgSwatchBelow;
      } else if (signalRising && dirBgAboveSignal) aboveSignalLineStrongSignal = bgSwatchAbove;
      else if (signalFalling && dirBgBelowSignal) aboveSignalLineStrongSignal = bgSwatchBelow;
      else if (strong && dirBgNeutralSignal) aboveSignalLineStrongSignal = bgSwatchNeutral;

      // Signal line: background not requiring a strong signal line
      let aboveSignalLine: string | null = null;
      if (!strong && bgAboveSignal) aboveSignalLine = bgSwatchAbove;
      else if (!strong && bgBelowSignal) aboveSignalLine = bgSwatchBelow;
      else if (!strong && dirBgAboveSignal) aboveSignalLine = bgSwatchAbove;
      else if (!strong && dirBgBelowSignal) aboveSignalLine = bgSwatchBelow;
      else if (!strong && dirBgNeutralSignal) aboveSignalLine = bgSwatchNeutral;

      // Signal line: bar colour requiring a strong signal line
      let barColorAboveSignalLineStrongSignal: string | null = null;
      if (signalRising && barcolorAboveSignal) barColorAboveSignalLineStrongSignal = barcolorSwatchAbove;
      else if ((signalRising && barcolorBelowSignal) || (signalFalling && barcolorAboveSignal)
        || (signalFalling && barcolorBelowSignal)) barColorAboveSignalLineStrongSignal = barcolorSwatchBelow;
      else if (signalRising && dirBarcolorAboveSignal) barColorAboveSignalLineStrongSignal = barcolorSwatchAbove;
      else if (signalFalling && dirBarcolorBelowSignal) barColorAboveSignalLineStrongSignal = barcolorSwatchBelow;
      else if (strong && dirBarcolorNeutralSignal) barColorAboveSignalLineStrongSignal = barcolorSwatchNeutral;

      // Signal line: bar colour not requiring a strong signal line
      let barColorAboveSignalLine: string | null = null;
      if (!strong && barcolorAboveSignal) barColorAboveSignalLine = barcolorSwatchAbove;
      else if (!strong && barcolorBelowSignal) barColorAboveSignalLine = barcolorSwatchBelow;
      else if (!strong && dirBarcolorAboveSignal) barColorAboveSignalLine = barcolorSwatchAbove;
      else if (!strong && dirBarcolorBelowSignal) barColorAboveSignalLine = barcolorSwatchBelow;
      else if (!strong && dirBarcolorNeutralSignal) barColorAboveSignalLine = barcolorSwatchNeutral;

      // Signal line crosses: bar colour requiring a strong signal line
      let barColorSignalLineCrossStrongSignal: string | null = null;
      if (signalRising && barcolorSignalStrongX) barColorSignalLineCrossStrongSignal = xoverSwatch;
      else if (barcolorSignalWeakX) barColorSignalLineCrossStrongSignal = xunderSwatch;
      else if (signalRising && dirBarcolorSignalStrongXUp) barColorSignalLineCrossStrongSignal = xoverSwatch;
      else if (signalFalling && dirBarcolorSignalStrongXDown) barColorSignalLineCrossStrongSignal = xoverSwatch;
      else if (dirBarcolorSignalWeakX) barColorSignalLineCrossStrongSignal = xunderSwatch;

      // Signal line crosses: bar colour not requiring a strong signal line
      let barColorSignalLineCross: string | null = null;
      if (!strong && barcolorSignalStrongX) barColorSignalLineCross = xoverSwatch;
      else if (!strong && barcolorSignalWeakX) barColorSignalLineCross = xunderSwatch;
      else if (!strong && dirBarcolorSignalStrongXUp) barColorSignalLineCross = xoverSwatch;
      else if (!strong && dirBarcolorSignalStrongXDown) barColorSignalLineCross = xoverSwatch;
      else if (!strong && dirBarcolorSignalWeakX) barColorSignalLineCross = xunderSwatch;

      const t = bars[i].time;
      // bgcolor calls in Pine order: each later call is drawn on top; na or fully transparent colours draw nothing
      // (ids bgcolor0..3: the bgcolor() calls in their order)
      [aboveBaselineStrongSignal, aboveBaseline, aboveSignalLineStrongSignal, aboveSignalLine].forEach((c, k) => {
        if (visible(c)) st.bgColors.push({ id: `bgcolor${k}`, time: t, color: c });
      });
      // barcolor calls in Pine order, one entry per call with a colour (ids barcolor0..7): the last one sets the bar
      // colour
      [barColorBaselineCrossStrongSignal, barColorBaselineCross, barColorSignalLineCrossStrongSignal,
        barColorSignalLineCross, barColorAboveBaselineStrongSignal, barColorAboveBaseline,
        barColorAboveSignalLineStrongSignal, barColorAboveSignalLine].forEach((c, k) => {
        if (c !== null) st.barColors.push({ id: `barcolor${k}`, time: t, color: c });
      });

      // Continuation trades
      const bullContTrade = dir && gt(a, 0) && lt(a1, s) && signalXover;
      const bearContTrade = dir && lt(a, 0) && gt(a1, s) && signalXunder;
      if (bullContTrade) st.markers.push({ id: 'shape0', time: t, position: 'bottom', shape: 'arrowUp', color: '#445b84' });
      if (bearContTrade) st.markers.push({ id: 'shape1', time: t, position: 'top', shape: 'arrowDown', color: '#844444' });
      // Exits: the quick exits (signalLine > 0 and signalXunder, signalLine < 0 and signalXover) have display.none
      // in Pine: not drawn. exitShortSlowly = ta.crossover(acbr, lowerBaseline),
      // exitLongSlowly = ta.crossunder(acbr, upperBaseline)
      if (blineLowerXover) st.markers.push({ id: 'shape3', time: t, position: 'bottom', shape: 'xcross', color: '#445b84' });
      if (blineUpperXunder) st.markers.push({ id: 'shape5', time: t, position: 'top', shape: 'xcross', color: '#844444' });

      // alertconditions, in the original's order
      const exitLongQuickly = gt(s, 0) && signalXunder;
      const exitShortQuickly = lt(s, 0) && signalXover;
      [
        bullContTrade,
        bearContTrade,
        exitLongQuickly,
        blineUpperXunder, // exitLongSlowly = ta.crossunder(acbr, upperBaseline)
        exitShortQuickly,
        blineLowerXover, // exitShortSlowly = ta.crossover(acbr, lowerBaseline)
        (gt(up, 0) && blineUpperXover) || (gt(low, 0) && blineLowerXover),
        (lt(up, 0) && blineUpperXunder) || (lt(low, 0) && blineLowerXunder),
        gt(a, 0) && signalXover,
        lt(a, 0) && signalXunder,
      ].forEach((f, k) => {
        st.flags[k][i] = f;
        if (f) st.times[k].push(t as number);
      });

      st.plots[0][i] = { time: t, value: a, color: st.acbrColors[i] };
      st.plots[1][i] = { time: t, value: s, color: st.signalColors[i] };
      st.plots[2][i] = { time: t, value: up, color: BASE_COL };
      // plot(acbrIsDirectional ? lowerBaseline : na, ...)
      st.plots[3][i] = { time: t, value: dir ? low : NaN, color: BASE_COL };
    },
    result(st, bars) {
      const n = bars.length;
      const p = st.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: '#000000', linestyle: 'dotted' } }],
        markers: st.markers.slice(),
        barColors: st.barColors.slice(),
        bgColors: st.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, st.times, st.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AverageCandleBodiesRangeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AverageCandleBodiesRangeInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Continuation Trade - Bullish', message: 'Bullish continuation trade by ACBR.' },
  { id: 'alert1', title: 'Continuation Trade - Bearish', message: 'Bearish continuation trade by ACBR.' },
  { id: 'alert2', title: 'Exit Long Quickly', message: 'Exit long trade, by ACBR.' },
  { id: 'alert3', title: 'Exit Long Slowly', message: 'Exit long trade, by ACBR.' },
  { id: 'alert4', title: 'Exit Short Quickly', message: 'Exit short trade, by ACBR.' },
  { id: 'alert5', title: 'Exit Short Slowly', message: 'Exit short trade, by ACBR.' },
  { id: 'alert6', title: 'ACBR Crossing Above Upper Baseline', message: 'ACBR has crossed above the upper baseline.' },
  { id: 'alert7', title: 'ACBR Crossing Below Lower Baseline', message: 'ACBR has crossed below the lower baseline.' },
  { id: 'alert8', title: 'ACBR Crossing Above Signal Line Trade Entry', message: 'ACBR has crossed above the signal line. Possible trade entry.' },
  { id: 'alert9', title: 'ACBR Crossing Below Signal Line Trade Entry', message: 'ACBR has crossed below the signal line. Possible trade entry.' },
];

export const AverageCandleBodiesRange = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
