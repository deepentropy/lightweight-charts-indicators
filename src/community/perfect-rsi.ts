/**
 * Perfect RSI (Enhanced RSI)
 *
 * The average of thirteen RSI variants. Set 1 (on the close): RSI of the source, a "dynamic" RSI (RSI of
 * (high + close) / 2 when the close fell, else of (low + close) / 2), an EMA-based Wilder RSI, the RSI of the momentum
 * src - src[len], the RSI of the close (PPO group) and the RSI of the TSI (EMA 10 then EMA 5 of the change, over the
 * same of its absolute value). Set 2 does the same on hlcc4 and adds the RSI of the +DI (DMI on hlcc4 changes, true
 * range RMA). The line is the average of the two set averages. The background is red when the line is above
 * OB - |line - RSI of TSI| * (0.972741476 - 0.95) (not below 0) and green when it is below
 * OS + |line - RSI of TSI| * (0.972741476 - 0.95) (not above 100).
 * Alerts (alertcondition, `alerts` of the result): 'RSI Oversold' / 'RSI Overbought', true on the bars of each zone.
 *
 * Reference: "Perfect RSI" by HabibiBudo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, type InputConfig, type PlotConfig, type Bar, type IndicatorResult, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface PerfectRsiInputs {
  /** RSI length (Regular) - 1 */
  len: number;
  /** Source (Regular) - 1 */
  src: SourceType;
  /** RSI length (Dynamic) - 1 */
  rsiLength: number;
  /** RSI length (DMI) - 1: not used by the outputs (the set 1 DMI RSI is not in the average) */
  len1: number;
  /** RSI length (Wilder) - 1 */
  rsiLength2: number;
  /** Long length (TSI) - 1 */
  long: number;
  /** Short length (TSI) - 1 */
  short: number;
  /** RSI length (Momentum) - 1 */
  len4: number;
  /** Source (Momentum) - 1 */
  src2: SourceType;
  /** Short length (PPO) - 1: not used by the outputs */
  shortlen: number;
  /** Long length (PPO) - 1: not used by the outputs */
  longlen: number;
  /** Source (PPO) - 1: not used by the outputs */
  src3: SourceType;
  /** exponential (PPO) - 1: not used by the outputs */
  exp: boolean;
  /** RSI length (PPO) - 1 (RSI of the close) */
  lengthRsi: number;
  /** RSI length (Regular) - 2 */
  len3_1: number;
  /** Source (Regular) - 2 */
  src_1: SourceType;
  /** RSI length (Dynamic) - 2 */
  rsiLength_2: number;
  /** RSI length (DMI) - 2 */
  len_3: number;
  /** RSI length (Wilder) - 2 */
  rsiLength2_2: number;
  /** Long length (TSI) - 2 */
  long_3: number;
  /** Short length (TSI) - 2 */
  short_3: number;
  /** RSI length (Momentum) - 2 */
  len4_4: number;
  /** Source (Momentum) - 2 */
  src4_4: SourceType;
  /** Short length (PPO) - 2: not used by the outputs */
  shortlen_5: number;
  /** Long length (PPO) - 2: not used by the outputs */
  longlen_5: number;
  /** Source (PPO) - 2: not used by the outputs */
  src2_5: SourceType;
  /** exponential (PPO) - 2: not used by the outputs */
  exp_5: boolean;
  /** RSI length (PPO) - 2 (RSI of hlcc4) */
  lengthRsi_5: number;
  /** OB level */
  ob: number;
  /** OS level */
  os: number;
}

export const defaultInputs: PerfectRsiInputs = {
  len: 5,
  src: 'close',
  rsiLength: 5,
  len1: 5,
  rsiLength2: 5,
  long: 10,
  short: 5,
  len4: 5,
  src2: 'close',
  shortlen: 5,
  longlen: 10,
  src3: 'close',
  exp: false,
  lengthRsi: 5,
  len3_1: 5,
  src_1: 'hlcc4',
  rsiLength_2: 5,
  len_3: 5,
  rsiLength2_2: 5,
  long_3: 10,
  short_3: 5,
  len4_4: 5,
  src4_4: 'hlcc4',
  shortlen_5: 5,
  longlen_5: 10,
  src2_5: 'hlcc4',
  exp_5: false,
  lengthRsi_5: 5,
  ob: 70,
  os: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'RSI Length (Regular) - 1', defval: 5, min: 1, group: 'RSI' },
  { id: 'src', type: 'source', title: 'Source (Regular) - 1', defval: 'close' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length (Dynamic) - 1', defval: 5, min: 1, group: 'Dynamic RSI' },
  { id: 'len1', type: 'int', title: 'RSI Length (DMI) - 1', defval: 5, min: 1, group: 'DMI RSI' },
  { id: 'rsiLength2', type: 'int', title: 'RSI Length (Wilder) - 1', defval: 5, group: 'Wilder RSI' },
  { id: 'long', type: 'int', title: 'Long Length (TSI) - 1', defval: 10, group: 'TSI RSI' },
  { id: 'short', type: 'int', title: 'Short Length (TSI) - 1', defval: 5, group: 'TSI RSI' },
  { id: 'len4', type: 'int', title: 'RSI Length (Momentum) - 1', defval: 5, min: 1, group: 'Momentum RSI' },
  { id: 'src2', type: 'source', title: 'Source (Momentum) - 1', defval: 'close', group: 'Momentum RSI' },
  { id: 'shortlen', type: 'int', title: 'Short Length (PPO) - 1', defval: 5, min: 1, group: 'PPO RSI' },
  { id: 'longlen', type: 'int', title: 'Long Length (PPO) - 1', defval: 10, min: 1, group: 'PPO RSI' },
  { id: 'src3', type: 'source', title: 'Source (PPO) - 1', defval: 'close', group: 'PPO RSI' },
  { id: 'exp', type: 'bool', title: 'exponential (PPO) - 1', defval: false, group: 'PPO RSI' },
  { id: 'lengthRsi', type: 'int', title: 'RSI Length (PPO) - 1', defval: 5, min: 1, group: 'PPO RSI' },
  { id: 'len3_1', type: 'int', title: 'RSI Length (Regular - 2)', defval: 5, min: 1, group: 'RSI' },
  { id: 'src_1', type: 'source', title: 'Source (Regular) - 2', defval: 'hlcc4', group: 'RSI' },
  { id: 'rsiLength_2', type: 'int', title: 'RSI Length (Dynamic) - 2', defval: 5, min: 1, group: 'Dynamic RSI' },
  { id: 'len_3', type: 'int', title: 'RSI Length (DMI) - 2', defval: 5, min: 1, group: 'DMI RSI' },
  { id: 'rsiLength2_2', type: 'int', title: 'RSI Length (Wilder) - 2', defval: 5, group: 'Wilder RSI' },
  { id: 'long_3', type: 'int', title: 'Long Length (TSI) - 2', defval: 10, group: 'TSI RSI' },
  { id: 'short_3', type: 'int', title: 'Short Length (TSI) - 2', defval: 5, group: 'TSI RSI' },
  { id: 'len4_4', type: 'int', title: 'RSI Length (Momentum) - 2', defval: 5, min: 1, group: 'Momentum RSI' },
  { id: 'src4_4', type: 'source', title: 'Source (Momentum) - 2', defval: 'hlcc4', group: 'Momentum RSI' },
  { id: 'shortlen_5', type: 'int', title: 'Short Length (PPO) - 2', defval: 5, min: 1, group: 'PPO RSI' },
  { id: 'longlen_5', type: 'int', title: 'Long Length (PPO) - 2', defval: 10, min: 1, group: 'PPO RSI' },
  { id: 'src2_5', type: 'source', title: 'Source (PPO) - 2', defval: 'hlcc4', group: 'PPO RSI' },
  { id: 'exp_5', type: 'bool', title: 'exponential (PPO) - 2', defval: false, group: 'PPO RSI' },
  { id: 'lengthRsi_5', type: 'int', title: 'RSI Length (PPO) - 2', defval: 5, min: 1, group: 'PPO RSI' },
  { id: 'ob', type: 'int', title: 'OB Level', defval: 70, group: 'OB/OS Levels' },
  { id: 'os', type: 'int', title: 'OS Level', defval: 30, group: 'OB/OS Levels' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Improved RSI', color: 'rgb(246, 249, 252)', lineWidth: 1 },
];

export const metadata = {
  title: 'Enhanced RSI',
  shortTitle: 'Enhanced RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

/** Correlation coefficient of the dynamic levels */
const CC = 0.972741476;
const CORRELATION_THRESHOLD = 0.95;

type Result = IndicatorResult & { bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Price = (b: Bar) => number;
type Rsi = ReturnType<typeof taStep.rsi>;
type Ema = ReturnType<typeof taStep.ema>;
/** One RSI variant: its machines and its value on a bar */
type Variant = { steps: Committable[]; step(bars: Bar[], i: number): number };

const hlcc4Of: Price = (b) => (b.high + b.low + b.close + b.close) / 4;
const closeOf: Price = (b) => b.close;

/** Dynamic RSI: priceDiff = p[1] - p; priceDiff > 0 ? rsi((high + p) / 2) : rsi((low + p) / 2) */
function dynamicRsi(p: Price, len: number) {
  const rHigh = taStep.rsi(len);
  const rLow = taStep.rsi(len);
  return {
    steps: [rHigh, rLow],
    step(bars: Bar[], i: number): number {
      const b = bars[i];
      const v = p(b);
      const h = rHigh.step((b.high + v) / 2);
      const l = rLow.step((b.low + v) / 2);
      return gt((i >= 1 ? p(bars[i - 1]) : NaN) - v, 0) ? h : l;
    },
  };
}

/** Wilder's RSI: EMA of the gains / losses, 100 - 100 / (1 + avgGains / avgLosses) (plain division) */
function wilderRsi(p: Price, len: number) {
  const gains: Ema = taStep.ema(len);
  const losses: Ema = taStep.ema(len);
  return {
    steps: [gains, losses],
    step(bars: Bar[], i: number): number {
      const d = p(bars[i]) - (i >= 1 ? p(bars[i - 1]) : NaN);
      const g = gains.step(max(d, 0));
      return 100 - 100 / (1 + g / losses.step(Math.abs(min(d, 0))));
    },
  };
}

/** TSI RSI: tsi = 100 * ema(ema(pc, long), short) / ema(ema(|pc|, long), short); rsi(tsi, short) */
function tsiRsi(p: Price, long: number, short: number) {
  const num1 = taStep.ema(long);
  const num2 = taStep.ema(short);
  const den1 = taStep.ema(long);
  const den2 = taStep.ema(short);
  const rsi: Rsi = taStep.rsi(short);
  return {
    steps: [num1, num2, den1, den2, rsi],
    step(bars: Bar[], i: number): number {
      const pc = p(bars[i]) - (i >= 1 ? p(bars[i - 1]) : NaN);
      const num = num2.step(num1.step(pc));
      const den = den2.step(den1.step(Math.abs(pc)));
      return rsi.step(100 * (num / den));
    },
  };
}

/** Momentum RSI: rsi(p - p[len], len) */
function momRsi(p: Price, len: number) {
  const rsi: Rsi = taStep.rsi(len);
  return {
    steps: [rsi],
    step(bars: Bar[], i: number): number {
      return rsi.step(p(bars[i]) - (i - len >= 0 ? p(bars[i - len]) : NaN));
    },
  };
}

/** One RSI of a price */
function plainRsi(p: Price, len: number) {
  const rsi: Rsi = taStep.rsi(len);
  return { steps: [rsi], step: (bars: Bar[], i: number): number => rsi.step(p(bars[i])) };
}

interface PerfectRsiVars {
  /** fixnan of the +DI of set 2: the last value that was not na */
  lastPlus: number;
}

interface PerfectRsiRun extends BarRunState<PerfectRsiVars> {
  tr: ReturnType<typeof taStep.tr>;
  trur: ReturnType<typeof taStep.rma>;
  rmaPlus: ReturnType<typeof taStep.rma>;
  plusRsi: Rsi;
  plot0: { time: number; value: number; color: string }[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<PerfectRsiInputs>): BarStudy<PerfectRsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lineColor = 'rgb(246, 249, 252)';
  let set1: Variant[] = [];
  let set2: Variant[] = [];
  return {
    fullRunReason: () =>
      ([cfg.src, cfg.src2, cfg.src_1, cfg.src4_4].every(isBarSource) ? null : 'source of another study'),
    init() {
      // Set 1: rsiValue, rsiPlusDynamic, rsi2Advanced, RSITSI, rsimom, rsiPpo
      set1 = [
        plainRsi(barSource(cfg.src), cfg.len),
        dynamicRsi(closeOf, cfg.rsiLength),
        wilderRsi(closeOf, cfg.rsiLength2),
        tsiRsi(closeOf, cfg.long, cfg.short),
        momRsi(barSource(cfg.src2), cfg.len4),
        plainRsi(closeOf, cfg.lengthRsi),
      ];
      // Set 2: rsiValue1, rsiPlusDynamic2, rsi2Advanced2, RSITSI3, rsimom4, rsiPpo5 (rsiPlus1: below)
      set2 = [
        plainRsi(barSource(cfg.src_1), cfg.len3_1),
        dynamicRsi(hlcc4Of, cfg.rsiLength_2),
        wilderRsi(hlcc4Of, cfg.rsiLength2_2),
        tsiRsi(hlcc4Of, cfg.long_3, cfg.short_3),
        momRsi(barSource(cfg.src4_4), cfg.len4_4),
        plainRsi(hlcc4Of, cfg.lengthRsi_5),
      ];
      const s: PerfectRsiRun = {
        tr: taStep.tr(false), trur: taStep.rma(cfg.len_3), rmaPlus: taStep.rma(cfg.len_3), plusRsi: taStep.rsi(cfg.len_3),
        plot0: [], bgColors: [], flags: [[], []], times: [[], []],
        steps: [], vars: { lastPlus: NaN }, lists: [], series: [],
      };
      s.steps = [...set1.flatMap((x) => x.steps), ...set2.flatMap((x) => x.steps), s.tr, s.trur, s.rmaPlus, s.plusRsi];
      s.lists = [s.bgColors, ...s.times];
      s.series = [s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const tr = s.tr.step(b.high, b.low, b.close);
      const [rsiValue, rsiPlusDynamic, rsi2Advanced, RSITSI, rsimom, rsiPpo] = set1.map((x) => x.step(bars, i));
      const [rsiValue1, rsiPlusDynamic2, rsi2Advanced2, RSITSI3, rsimom4, rsiPpo5] = set2.map((x) => x.step(bars, i));
      // DMI RSI (+DI): plusDM on the changes of p, plus = fixnan(100 * rma(plusDM, len) / rma(ta.tr, len)); rsi(plus, len)
      const u = hlcc4Of(b) - (i >= 1 ? hlcc4Of(bars[i - 1]) : NaN);
      const plusDM = isNaN(u) ? NaN : gt(u, -u) && gt(u, 0) ? u : 0;
      const trur = s.trur.step(tr);
      const pv = (100 * s.rmaPlus.step(plusDM)) / trur;
      if (!Number.isNaN(pv)) s.vars.lastPlus = pv;
      const rsiPlus1 = s.plusRsi.step(Number.isNaN(pv) ? s.vars.lastPlus : pv);

      const RSI1 = (rsiPlusDynamic + rsi2Advanced + rsimom + rsiPpo + RSITSI + rsiValue) / 6;
      const RSI2 = (rsiValue1 + rsiPlusDynamic2 + rsimom4 + rsiPpo5 + RSITSI3 + rsi2Advanced2 + rsiPlus1) / 7;
      const RSI = (RSI1 + RSI2) / 2;
      const rsiDiff = Math.abs(RSI - RSITSI);
      const overboughtLevel = max(cfg.ob - rsiDiff * (CC - CORRELATION_THRESHOLD), 0);
      const oversoldLevel = min(cfg.os + rsiDiff * (CC - CORRELATION_THRESHOLD), 100);
      const overboughtZone = gt(RSI, overboughtLevel);
      const oversoldZone = lt(RSI, oversoldLevel);
      s.flags[0][i] = oversoldZone;
      s.flags[1][i] = overboughtZone;
      if (oversoldZone) s.times[0].push(b.time as number);
      if (overboughtZone) s.times[1].push(b.time as number);
      // bgcolor(overboughtZone ? #ff000080 : oversoldZone ? #00ff0880 : na)
      if (overboughtZone) s.bgColors.push({ time: b.time, color: '#ff000080' });
      else if (oversoldZone) s.bgColors.push({ time: b.time, color: '#00ff0880' });
      s.plot0[i] = { time: b.time, value: Number.isFinite(RSI) ? RSI : NaN, color: lineColor };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: cfg.ob, options: { title: 'Overbought', color: '#6a00ff', linestyle: 'dashed' } },
          { value: cfg.os, options: { title: 'Oversold', color: '#6a00ff', linestyle: 'dashed' } },
        ],
        bgColors: s.bgColors.slice(),
        // alertcondition(oversoldZone, 'RSI Oversold') / alertcondition(overboughtZone, 'RSI Overbought')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PerfectRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PerfectRsiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'RSI Oversold', message: 'RSI is oversold!' },
  { id: 'alert1', title: 'RSI Overbought', message: 'RSI is overbought!' },
];

export const PerfectRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
