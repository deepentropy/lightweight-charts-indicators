/**
 * SExI - Super Exhaustion Indicator
 *
 * RSI of the source with Aroon-based exhaustion counts. The upper Aroon is 100 * (offset of the highest high of the
 * last `Aroon Reference` + 1 bars + Aroon Reference) / Aroon Reference. Each new 100 reading (after a reading below
 * 100) adds one to the top count, a 0 reading resets it; each new 0 reading adds one to the bottom count, a 100
 * reading resets it. When the RSI is beyond a trigger line and the matching count has reached the exhaustion value,
 * the background is highlighted. Two thick lines above and below the trigger lines show the counts in colour.
 * Alerts (alertcondition, `alerts` of the result): any exhaustion top or bottom, any top, any bottom, exhaustion top /
 * bottom and extreme exhaustion top / bottom, true on the bars of each trigger.
 *
 * Reference: "SExI - Super Exhaustion Indicator [Da_Prof]" by Da_Prof
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SExISuperExhaustionIndicatorInputs {
  /** RSI source */
  src: SourceType;
  /** RSI length */
  len: number;
  /** Aroon reference length */
  lenAroon: number;
  /** Count of Aroon drives that marks an exhaustion */
  exhaustion: number;
  /** Top trigger line value */
  topTrigger: number;
  /** Extreme top line value */
  topExtremeTrigger: number;
  /** Bottom trigger line value */
  bottomTrigger: number;
  /** Extreme bottom line value */
  bottomExtremeTrigger: number;
}

export const defaultInputs: SExISuperExhaustionIndicatorInputs = {
  src: 'close',
  len: 14,
  lenAroon: 14,
  exhaustion: 5,
  topTrigger: 72,
  topExtremeTrigger: 80,
  bottomTrigger: 32,
  bottomExtremeTrigger: 25,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'len', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'lenAroon', type: 'int', title: 'Aroon Reference', defval: 14, min: 1 },
  { id: 'exhaustion', type: 'int', title: 'Exhaustion Value', defval: 5, min: 1 },
  { id: 'topTrigger', type: 'int', title: 'Top Trigger Line Value', defval: 72 },
  { id: 'topExtremeTrigger', type: 'int', title: 'Extreme Top Line Value', defval: 80 },
  { id: 'bottomTrigger', type: 'int', title: 'Bottom Trigger Line Value', defval: 32 },
  { id: 'bottomExtremeTrigger', type: 'int', title: 'Extreme Bottom Line Value', defval: 25 },
];

const TOP_TRIGGER_COLOR = 'rgb(110, 77, 255)';
const BOTTOM_TRIGGER_COLOR = 'rgb(76, 109, 255)';
const BOTTOM_EXTREME_COLOR = '#2dff34';
const TOP_EXTREME_COLOR = '#d9c515';
const TRANSPARENT = 'rgba(0, 0, 0, 0)'; // color.rgb(0, 0, 0, 100)

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Top Trigger Line Background', color: color.black, lineWidth: 4 },
  { id: 'plot1', title: 'Top Trigger Line', color: TOP_TRIGGER_COLOR, lineWidth: 2 },
  { id: 'plot2', title: 'Bottom Trigger Line Background', color: color.black, lineWidth: 4 },
  { id: 'plot3', title: 'Bottom Trigger Line', color: BOTTOM_TRIGGER_COLOR, lineWidth: 2 },
  { id: 'plot4', title: 'Extreme Top Line Background', color: color.black, lineWidth: 4 },
  { id: 'plot5', title: 'Extreme Top Line', color: TOP_EXTREME_COLOR, lineWidth: 2 },
  { id: 'plot6', title: 'Extreme Bottom Line Background', color: color.black, lineWidth: 4 },
  { id: 'plot7', title: 'Extreme Bottom Line', color: BOTTOM_EXTREME_COLOR, lineWidth: 2 },
  { id: 'plot8', title: 'Upper Spacer', color: TRANSPARENT, lineWidth: 4 },
  { id: 'plot9', title: 'Lower Spacer', color: TRANSPARENT, lineWidth: 4 },
  { id: 'plot10', title: 'Exhaustion Top Background', color: color.black, lineWidth: 6, style: 'linebr' },
  { id: 'plot11', title: 'Exhaustion Top', color: 'rgb(254, 135, 135)', lineWidth: 4, style: 'linebr' },
  { id: 'plot12', title: 'Exhaustion Bottom Background', color: color.black, lineWidth: 6, style: 'linebr' },
  { id: 'plot13', title: 'Exhaustion Bottom', color: String(color.rgb(177, 255, 149, 10)), lineWidth: 4, style: 'linebr' },
  { id: 'plot14', title: 'RSI Background', color: color.black, lineWidth: 4, style: 'linebr' },
  { id: 'plot15', title: 'RSI', color: '#29dfff', lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'SExI - Super Exhaustion Indicator [Da_Prof]',
  shortTitle: 'SExI [Da_Prof]',
  overlay: false,
};

/** Pine float comparisons: a == b within 1e-10, a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };

/**
 * `ta.highestbars(source, length)` with a constant length, one bar at a time, with the rules of the oakscriptjs
 * function (same values): the non-na values kept with their bar, the best of the last `length` of them (the newest on
 * equal values), the offset -(bar - its bar); na before bar `length - 1` and while no value was kept.
 */
class HighestBarsStep {
  private values: number[] = [];
  private bars: number[] = [];
  private pendingValue = NaN;
  private pendingBar = -1;
  private readonly len: number;

  constructor(length: number) {
    this.len = Math.trunc(length);
  }

  step(bar: number, value: number): number {
    const kept = Number.isFinite(value);
    this.pendingValue = kept ? value : NaN;
    this.pendingBar = kept ? bar : -1;
    const count = this.values.length + (kept ? 1 : 0);
    if (bar < this.len - 1 || count === 0) return NaN;
    const at = (j: number) => (j === this.values.length ? value : this.values[j]!);
    const k = count - 1;
    let best = k;
    for (let j = k - 1; j >= 0 && j > k - this.len; j--) if (at(j) > at(best)) best = j;
    const bestBar = best === this.values.length ? bar : this.bars[best]!;
    return -(bar - bestBar);
  }

  commit(): void {
    if (this.pendingBar >= 0) {
      this.values.push(this.pendingValue);
      this.bars.push(this.pendingBar);
      if (this.values.length > this.len * 2 + 1024) {
        this.values = this.values.slice(-this.len);
        this.bars = this.bars.slice(-this.len);
      }
    }
    this.pendingBar = -1;
  }
}

type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface SexiRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  hb: HighestBarsStep;
  aroon: number[];
  topA: number[];
  bottomA: number[];
  plots: Point[][];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SExISuperExhaustionIndicatorInputs>): BarStudy<SexiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const ex = cfg.exhaustion;
  const topColor = (t: number) => (t === ex ? 'rgb(254, 135, 135)' : t === ex + 1 ? 'rgb(255, 92, 92)'
    : t === ex + 2 ? 'rgb(255, 36, 36)' : t >= ex + 3 ? 'rgb(200, 0, 0)'
      : t >= 1 && t < ex ? String(color.rgb(149, 191, 255, 60)) : TRANSPARENT);
  const bottomColor = (t: number) => (t === ex ? String(color.rgb(177, 255, 149, 10))
    : t === ex + 1 ? String(color.rgb(156, 255, 121, 7)) : t === ex + 2 ? 'rgb(85, 235, 69)'
      : t >= ex + 3 ? '#25cb0f' : t >= 1 && t < ex ? String(color.rgb(149, 191, 255, 60)) : TRANSPARENT);
  // plot(not na(RSI) ? level : na, ...): the levels and colours of plot0 .. plot9
  const levels: [number, string][] = [
    [cfg.topTrigger, color.black],
    [cfg.topTrigger, TOP_TRIGGER_COLOR],
    [cfg.bottomTrigger, color.black],
    [cfg.bottomTrigger, BOTTOM_TRIGGER_COLOR],
    [cfg.topExtremeTrigger, color.black],
    [cfg.topExtremeTrigger, TOP_EXTREME_COLOR],
    [cfg.bottomExtremeTrigger, color.black],
    [cfg.bottomExtremeTrigger, BOTTOM_EXTREME_COLOR],
    [cfg.topExtremeTrigger + 20, TRANSPARENT],
    [cfg.bottomExtremeTrigger - 20, TRANSPARENT],
  ];
  const topLine = cfg.topExtremeTrigger + 10;
  const bottomLine = cfg.bottomExtremeTrigger - 10;
  // bgcolor layers, in the Pine order (a later layer is drawn on top)
  const bgAbove = color.maroon;
  const bgBelow = String(color.rgb(45, 255, 52, 60));
  const bgExtremeAbove = '#ffee00d9';
  const bgExtremeBelow = 'rgb(2, 255, 166)';
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: SexiRun = {
        rsi: taStep.rsi(cfg.len), hb: new HighestBarsStep(cfg.lenAroon + 1), aroon: [], topA: [], bottomA: [],
        plots: Array.from({ length: 16 }, () => []), bgColors: [], flags: alertConditions.map(() => []),
        times: alertConditions.map(() => []), vars: {}, steps: [], lists: [], series: [],
      };
      s.steps = [s.rsi, s.hb];
      s.lists = [s.bgColors, ...s.times];
      s.series = [s.aroon, s.topA, s.bottomA, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // RSI = ta.rsi(src, len)
      const rsi = s.rsi.step(value(b)) ?? NaN;
      // upperAroon = 100 * (ta.highestbars(high, lenAroon + 1) + lenAroon) / lenAroon
      const aroon = (100 * (s.hb.step(i, b.high) + cfg.lenAroon)) / cfg.lenAroon;
      s.aroon[i] = aroon;

      // topA / bottomA: re-declared as 0 on every bar, then set from their own history (topA[1] is na on bar 0, so the
      // counts stay na until the first reset to 0)
      const prevTop = i > 0 ? s.topA[i - 1] : NaN;
      const prevBottom = i > 0 ? s.bottomA[i - 1] : NaN;
      const prevAroon = i > 0 ? s.aroon[i - 1] : NaN;
      const topA = eq(aroon, 100) && lt(prevAroon, 100) ? prevTop + 1 : eq(aroon, 0) ? 0 : prevTop;
      const bottomA = eq(aroon, 0) && gt(prevAroon, 0) ? prevBottom + 1 : eq(aroon, 100) ? 0 : prevBottom;
      s.topA[i] = topA;
      s.bottomA[i] = bottomA;

      for (let k = 0; k < levels.length; k++) {
        s.plots[k][i] = { time, value: isNaN(rsi) ? NaN : levels[k][0], color: levels[k][1] };
      }
      s.plots[10][i] = { time, value: topLine, color: topA >= 1 ? color.black : TRANSPARENT };
      s.plots[11][i] = { time, value: topLine, color: topA >= 1 ? topColor(topA) : TRANSPARENT };
      s.plots[12][i] = { time, value: bottomLine, color: bottomA >= 1 ? color.black : TRANSPARENT };
      s.plots[13][i] = { time, value: bottomLine, color: bottomA >= 1 ? bottomColor(bottomA) : TRANSPARENT };
      s.plots[14][i] = { time, value: rsi, color: color.black };
      s.plots[15][i] = { time, value: rsi, color: '#29dfff' };

      const topOk = topA >= ex;
      const bottomOk = bottomA >= ex;
      const prxTop = ge(rsi, cfg.topTrigger) && topOk;
      const prxBottom = le(rsi, cfg.bottomTrigger) && bottomOk;
      const prxTopExtreme = ge(rsi, cfg.topExtremeTrigger) && topOk;
      const prxBottomExtreme = le(rsi, cfg.bottomExtremeTrigger) && bottomOk;
      if (prxTop) s.bgColors.push({ time, color: bgAbove });
      if (prxBottom) s.bgColors.push({ time, color: bgBelow });
      if (prxTopExtreme) s.bgColors.push({ time, color: bgExtremeAbove });
      if (prxBottomExtreme) s.bgColors.push({ time, color: bgExtremeBelow });
      // any_top_trigger / any_bottom_trigger: the trigger or the extreme trigger
      const anyTop = prxTop || prxTopExtreme;
      const anyBottom = prxBottom || prxBottomExtreme;
      const flags = [anyBottom || anyTop, anyTop, anyBottom, prxTop, prxBottom, prxTopExtreme, prxBottomExtreme];
      for (let k = 0; k < flags.length; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SExISuperExhaustionIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SExISuperExhaustionIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0', title: 'SExI - Any Exhaustion Top or Bottom Triggered',
    message: '{{ticker}} {{interval}}: SExI - Any Exhaustion Top or Bottom Triggered',
  },
  { id: 'alert1', title: 'SExI - Any Exhaustion Top Triggered', message: '{{ticker}} {{interval}}: SExI - Any Exhaustion Top Triggered' },
  {
    id: 'alert2', title: 'SExI - Any Exhaustion Bottom Triggered',
    message: '{{ticker}} {{interval}}: SExI - Any Exhaustion Bottom Triggered',
  },
  { id: 'alert3', title: 'SExI - Exhaustion Top', message: 'SExI - Exhaustion Top' },
  { id: 'alert4', title: 'SExI - Exhaustion Bottom', message: 'SExI - Exhaustion Bottom' },
  { id: 'alert5', title: 'SExI - Extreme Exhaustion Top', message: 'SExI - Extreme Exhaustion Top' },
  { id: 'alert6', title: 'SExI - Extreme Exhaustion Bottom', message: 'SExI - Extreme Exhaustion Bottom' },
];

export const SExISuperExhaustionIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
