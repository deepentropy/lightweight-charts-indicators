/**
 * Relative Strength Index - Divergences - Libertus
 *
 * RSI with labels on divergences and on RSI pivots.
 * - The script keeps a running maximum and minimum of the close and of the RSI. They restart from the current bar
 *   when the RSI is the highest (lowest) of the last "Div lookback period" bars.
 * - Bearish divergence ("BEAR", on the bar before): the price maximum rose on the bar before, the RSI of that bar
 *   was below the RSI maximum and the RSI does not rise now. Bullish divergence ("BULL"): the mirror.
 * - Pivot ("PIVOT", two bars back): the RSI maximum (minimum) is the same as two bars ago and changed on that bar.
 * - One label per bar at most, in this order: BEAR, BULL, pivot high, pivot low. The last 50 labels are kept.
 * - "Hide labels and color background" replaces the labels by background colours on the same bars.
 * Alerts (alertcondition, `alerts` of the result): 'Bear div', 'Bull div', 'Pivot high' and 'Pivot low', true on the
 * bars on which each is found (the bar of the BEAR / BULL / PIVOT label decision, before its offset).
 *
 * Reference: "Relative Strength Index - Divergences - Libertus" by Libertus
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright by Libertus - 2021
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';
import type { BgColorData, LabelData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RelativeStrengthIndexDivergencesLibertusInputs {
  /** RSI Length */
  len: number;
  /** Overbought */
  ob: number;
  /** Oversold */
  os: number;
  /** Midline value */
  omid: number;
  /** Hide midline */
  omidh: boolean;
  /** Hide pivots? */
  piv: boolean;
  /** Shorter labels? */
  shrt: boolean;
  /** Hide labels and color background */
  hidel: boolean;
  /** Div lookback period (bars)? */
  xbars: number;
}

export const defaultInputs: RelativeStrengthIndexDivergencesLibertusInputs = {
  len: 14,
  ob: 70,
  os: 30,
  omid: 50,
  omidh: false,
  piv: false,
  shrt: false,
  hidel: false,
  xbars: 90,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'ob', type: 'int', title: 'Overbought', defval: 70, min: 0, max: 100 },
  { id: 'os', type: 'int', title: 'Oversold', defval: 30, min: 0, max: 100 },
  { id: 'omid', type: 'int', title: 'Midline value', defval: 50, min: 0, max: 100 },
  { id: 'omidh', type: 'bool', title: 'Hide midline', defval: false },
  { id: 'piv', type: 'bool', title: 'Hide pivots?', defval: false },
  { id: 'shrt', type: 'bool', title: 'Shorter labels?', defval: false },
  { id: 'hidel', type: 'bool', title: 'Hide labels and color background', defval: false },
  { id: 'xbars', type: 'int', title: 'Div lookback period (bars)?', defval: 90, min: 1 },
];

// Colour constants of the Pine version of the script
const RED = '#FF5252';
const BLACK = '#363A45';
const LIME = '#00E676';
const GREEN = '#4CAF50';
const BLUE = '#2196F3';
const WHITE = '#FFFFFF';
const HLINE = '#787B86';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: BLACK, lineWidth: 1 },
];

/** hline(ob), hline(os), hline(omid, color = color.new(color.black, 80)) with the default values */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 70, title: 'Overbought', color: HLINE, linestyle: 'dashed' },
  { id: 'hline_os', price: 30, title: 'Oversold', color: HLINE, linestyle: 'dashed' },
  { id: 'hline_mid', price: 50, title: 'Midline', color: String(color.new(BLACK, 80)), linestyle: 'dashed' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_upper', plot1: 'hline_mid', plot2: 'hline_ob', color: String(color.new(LIME, 96)) },
  { id: 'fill_lower', plot1: 'hline_os', plot2: 'hline_mid', color: String(color.new(RED, 96)) },
];

export const metadata = {
  title: 'Relative Strength Index - Divergences - Libertus',
  shortTitle: 'RSI Div - Lib',
  overlay: false,
};

/** Default max_labels_count of the script */
const MAX_LABELS = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10 (a == b within 1e-10); na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

interface Lb {
  x: number;
  y: number;
  text: string;
  color: string;
  style: 'label_down' | 'label_up';
}

/**
 * `ta.highestbars(source, length)` / `ta.lowestbars` with a constant length, one bar at a time: the offset to the bar
 * of the best of the last `length` non-na values (the newest one on equal values), na before bar `length - 1` and
 * while no value was received (the rules of the oakscriptjs array function).
 */
class ExtremeBarsStep {
  private vals: number[] = [];
  private bars: number[] = [];
  private ids: number[] = [];
  private head = 0;
  /** Non-na values committed */
  private kept = 0;
  private pendingValue = NaN;
  private pendingBar = -1;
  private readonly len: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
  }

  /** `a` stays the extreme over the newer `b`: strictly better */
  private better(a: number, b: number): boolean {
    return this.lowest ? a < b : a > b;
  }

  step(bar: number, value: number): number {
    const own = Number.isFinite(value);
    this.pendingValue = value;
    this.pendingBar = own ? bar : -1;
    const total = this.kept + (own ? 1 : 0);
    if (bar < this.len - 1 || total === 0) return NaN;
    const from = total - this.len;
    let h = this.head;
    while (h < this.ids.length && this.ids[h]! < from) h++;
    let best: number;
    if (h < this.ids.length && (!own || this.better(this.vals[h]!, value))) best = this.bars[h]!;
    else best = bar;
    return -(bar - best);
  }

  commit(): void {
    if (this.pendingBar < 0) return;
    const v = this.pendingValue;
    const id = this.kept++;
    while (this.vals.length > this.head && !this.better(this.vals[this.vals.length - 1]!, v)) {
      this.vals.pop();
      this.bars.pop();
      this.ids.pop();
    }
    this.vals.push(v);
    this.bars.push(this.pendingBar);
    this.ids.push(id);
    this.pendingBar = -1;
    while (this.ids[this.head]! < this.kept - this.len) this.head++;
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals = this.vals.slice(this.head);
      this.bars = this.bars.slice(this.head);
      this.ids = this.ids.slice(this.head);
      this.head = 0;
    }
  }
}

type Result = Omit<IndicatorResult, 'labels' | 'bgColors'> & { labels: LabelData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

interface LibertusVars {
  /** The live labels (the last MAX_LABELS + 5 at most), changed in place (copied in copyVars) */
  labels: Lb[];
}

interface LibertusRun extends BarRunState<LibertusVars> {
  rsiStep: ReturnType<typeof taStep.rsi>;
  hbStep: ExtremeBarsStep;
  lbStep: ExtremeBarsStep;
  rsi: number[];
  max: number[];
  maxRsi: number[];
  min: number[];
  minRsi: number[];
  divBg: Array<string | null>;
  pivBg: Array<string | null>;
  plot0: { time: number; value: number; color: string }[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RelativeStrengthIndexDivergencesLibertusInputs>): BarStudy<LibertusRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bearBg = String(color.new(RED, 50));
  const bullBg = String(color.new(GREEN, 50));
  const pivotBg = String(color.new(BLUE, 50));
  return {
    init() {
      const rsiStep = taStep.rsi(cfg.len);
      // hb = abs(highestbars(rsi, xbars)), lb = abs(lowestbars(rsi, xbars))
      const hbStep = new ExtremeBarsStep(false, cfg.xbars);
      const lbStep = new ExtremeBarsStep(true, cfg.xbars);
      const s: LibertusRun = {
        rsiStep, hbStep, lbStep, rsi: [], max: [], maxRsi: [], min: [], minRsi: [], divBg: [], pivBg: [], plot0: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [rsiStep, hbStep, lbStep], vars: { labels: [] }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.rsi, s.max, s.maxRsi, s.min, s.minRsi, s.divBg, s.pivBg, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const { max, maxRsi, min, minRsi } = s;
      const at = (a: number[], k: number) => (k >= 0 ? a[k] : NaN);
      const c = bars[i].close;
      const r = s.rsiStep.step(c) ?? NaN;
      s.rsi[i] = r;
      const hb = Math.abs(s.hbStep.step(i, r) ?? NaN);
      const lb = Math.abs(s.lbStep.step(i, r) ?? NaN);
      // If the bar with the highest / lowest RSI is the current bar, use its value
      max[i] = hb === 0 ? c : isNaN(at(max, i - 1)) ? c : max[i - 1];
      maxRsi[i] = hb === 0 ? r : isNaN(at(maxRsi, i - 1)) ? r : maxRsi[i - 1];
      min[i] = lb === 0 ? c : isNaN(at(min, i - 1)) ? c : min[i - 1];
      minRsi[i] = lb === 0 ? r : isNaN(at(minRsi, i - 1)) ? r : minRsi[i - 1];
      if (gt(c, max[i])) max[i] = c;
      if (gt(r, maxRsi[i])) maxRsi[i] = r;
      if (lt(c, min[i])) min[i] = c;
      if (lt(r, minRsi[i])) minRsi[i] = r;

      // Pivot: the extreme is the same as 2 bars ago and it changed on that bar
      const pivoth = eq(maxRsi[i], at(maxRsi, i - 2)) && ne(at(maxRsi, i - 2), at(maxRsi, i - 3));
      const pivotl = eq(minRsi[i], at(minRsi, i - 2)) && ne(at(minRsi, i - 2), at(minRsi, i - 3));

      // Divergences, with a delay of one bar
      const r1 = at(s.rsi, i - 1);
      const divbear = gt(at(max, i - 1), at(max, i - 2)) && lt(r1, maxRsi[i]) && le(r, r1);
      const divbull = lt(at(min, i - 1), at(min, i - 2)) && gt(r1, minRsi[i]) && ge(r, r1);

      const f = [divbear, divbull, pivoth, pivotl];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = f[k];
        if (f[k]) s.times[k].push(bars[i].time as number);
      }

      let l: Lb | null = null;
      if (divbear) l = { x: i - 1, y: r1 + 1, text: 'BEAR', color: RED, style: 'label_down' };
      else if (divbull) l = { x: i - 1, y: r1 - 1, text: 'BULL', color: GREEN, style: 'label_up' };
      else if (pivoth) l = { x: i - 2, y: maxRsi[i] + 1, text: 'PIVOT', color: BLUE, style: 'label_down' };
      else if (pivotl) l = { x: i - 2, y: minRsi[i] - 1, text: 'PIVOT', color: BLUE, style: 'label_up' };
      if (l) {
        // Shorter labels: label.set_text(l, na)
        if (cfg.shrt) l.text = '';
        // Hides pivots or labels: label.delete(l)
        const deleted = (cfg.piv && (pivoth || pivotl)) || cfg.hidel;
        if (!deleted) {
          const labels = s.vars.labels;
          labels.push(l);
          // above max + 5 labels the oldest are deleted until max remain
          if (labels.length > MAX_LABELS + 5) labels.splice(0, labels.length - MAX_LABELS);
        }
      }

      s.divBg[i] = cfg.hidel ? (divbear ? bearBg : divbull ? bullBg : null) : null;
      s.pivBg[i] = cfg.hidel ? (cfg.piv ? null : pivoth || pivotl ? pivotBg : null) : null;
      s.plot0[i] = { time: bars[i].time, value: r, color: gt(r, cfg.ob) || lt(r, cfg.os) ? RED : BLACK };
    },
    copyVars: (v) => ({ labels: v.labels.slice() }),
    result(s, bars) {
      const n = bars.length;
      // bgcolor(..., offset = -1) and bgcolor(..., offset = -2): the colour of bar i is drawn 1 / 2 bars back
      const bgColors: BgColorData[] = [];
      if (cfg.hidel) {
        for (let i = 0; i < n; i++) {
          const d = i + 1 < n ? s.divBg[i + 1] : null;
          if (d) bgColors.push({ time: bars[i].time, color: d });
          const p = i + 2 < n ? s.pivBg[i + 2] : null;
          if (p) bgColors.push({ time: bars[i].time, color: p });
        }
      }
      const midColor = String(color.new(BLACK, cfg.omidh ? 100 : 80));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: cfg.ob, options: { color: HLINE, linestyle: 'dashed' } },
          { value: cfg.os, options: { color: HLINE, linestyle: 'dashed' } },
          { value: cfg.omid, options: { color: midColor, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_mid', plot2: 'hline_ob', colors: new Array<string>(n).fill(String(color.new(LIME, 96))) },
          { plot1: 'hline_os', plot2: 'hline_mid', colors: new Array<string>(n).fill(String(color.new(RED, 96))) },
        ],
        bgColors,
        // a label on a bar before the first bar, or with an na price, is not drawn
        labels: s.vars.labels.filter((l) => l.x >= 0 && !isNaN(l.y)).map((l) => ({
          time: bars[l.x].time, price: l.y, text: l.text, color: l.color, textColor: WHITE, style: l.style, size: 'small',
        })),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RelativeStrengthIndexDivergencesLibertusInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RelativeStrengthIndexDivergencesLibertusInputs> = {},
): Omit<IndicatorResult, 'labels' | 'bgColors'> & { labels: LabelData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bear div', message: 'Bear div' },
  { id: 'alert1', title: 'Bull div', message: 'Bull div' },
  { id: 'alert2', title: 'Pivot high', message: 'Pivot high' },
  { id: 'alert3', title: 'Pivot low', message: 'Pivot low' },
];

export const RelativeStrengthIndexDivergencesLibertus = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
