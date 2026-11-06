/**
 * RSI Multicolor editable V2
 *
 * RSI of the close: up = rma(max(change(close), 0), len), down = rma(-min(change(close), 0), len),
 * rsi = 100 when down is 0, 0 when up is 0, else 100 - 100 / (1 + up / down). Five horizontal levels (overbought,
 * overbought noise level, neutral, oversold noise level, oversold) with grey fills between the noise levels and the
 * outer levels. The part of the RSI above the overbought level is filled red, the part below the oversold level green.
 * Alerts (alertcondition, `alerts` of the result), with the expressions of the original: 'Entry Into Overbought Area'
 * = ta.crossover(ob, rsi), 'Exit From Overbought Area' = ta.crossunder(ob, rsi), 'Crossing Neutral Level' =
 * ta.cross(nt, rsi), 'Entry Into Oversold Area' = ta.crossover(os, rsi), 'Exit From Oversold area' =
 * ta.crossunder(ob, rsi) (the overbought level, as in the original).
 *
 * Reference: "RSI Multicolor editable V2" by Guillaume46
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Guillaume46
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiMulticolorEditableInputs {
  /** RSI length */
  len: number;
  /** Overbought level */
  ob: number;
  /** Overbought noise level */
  onl: number;
  /** Neutral level */
  nt: number;
  /** Oversold noise level */
  osdl: number;
  /** Oversold level */
  os: number;
}

export const defaultInputs: RsiMulticolorEditableInputs = {
  len: 14,
  ob: 70,
  onl: 60,
  nt: 50,
  osdl: 40,
  os: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'ob', type: 'int', title: 'Overbought', defval: 70 },
  { id: 'onl', type: 'int', title: 'Overbought Noise Level', defval: 60 },
  { id: 'nt', type: 'int', title: 'Neutral', defval: 50 },
  { id: 'osdl', type: 'int', title: 'Oversold Noise Level', defval: 40 },
  { id: 'os', type: 'int', title: 'Oversold', defval: 30 },
];

const RSI_COLOR = String(color.new('#000000', 0));
const LEVEL_COLOR = '#b2b5be';
const NOISE_FILL = String(color.new('#b2b5be', 90));
const NEUTRAL_FILL = String(color.new(color.white, 100));
const OB_FILL = String(color.new(color.red, 50));
const OS_FILL = String(color.new(color.green, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: RSI_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Overbought', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Oversold', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Noise Top', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Noise Bottom', color: 'transparent', lineWidth: 1, display: 'none' },
];

/** The five levels with the default inputs (the result `hlines` follow the inputs) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 70, title: 'Overbought', color: LEVEL_COLOR, linestyle: 'dotted' },
  { id: 'hline_onl', price: 60, title: 'Overbought Noise Level', color: LEVEL_COLOR, linestyle: 'dotted' },
  { id: 'hline_nt', price: 50, title: 'Neutral', color: color.black, linestyle: 'dashed' },
  { id: 'hline_osdl', price: 40, title: 'Oversold Noise Level', color: LEVEL_COLOR, linestyle: 'dotted' },
  { id: 'hline_os', price: 30, title: 'Oversold', color: LEVEL_COLOR, linestyle: 'dotted' },
];

/** Fills between the levels */
export const fillConfig: FillConfig[] = [
  { id: 'fill_ob_noise', plot1: 'hline_ob', plot2: 'hline_onl', color: NOISE_FILL, title: 'Bg Overbought Noise Level' },
  { id: 'fill_neutral_top', plot1: 'hline_onl', plot2: 'hline_nt', color: NEUTRAL_FILL, title: 'Background Neutral Top' },
  { id: 'fill_neutral_bottom', plot1: 'hline_nt', plot2: 'hline_osdl', color: NEUTRAL_FILL, title: 'Background Neutral Bottom' },
  { id: 'fill_os_noise', plot1: 'hline_os', plot2: 'hline_osdl', color: NOISE_FILL, title: 'Bg Oversold Noise Level' },
];

export const metadata = {
  title: 'RSI Multicolor editable V2',
  shortTitle: 'RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface RsiMcRun extends BarRunState<Record<string, never>> {
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  rsi: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RsiMulticolorEditableInputs>): BarStudy<RsiMcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // ta.crossover(level, rsi) / ta.crossunder(level, rsi) with the values of the bar before (na compares false)
  const over = (l: number, v: number, pv: number) => l > v && l <= pv;
  const under = (l: number, v: number, pv: number) => l < v && l >= pv;
  return {
    init() {
      const up = taStep.rma(cfg.len);
      const down = taStep.rma(cfg.len);
      const s: RsiMcRun = {
        up, down, rsi: [], plot0: [], plot1: [], plot2: [], plot3: [], plot4: [],
        flags: [[], [], [], [], []], times: [[], [], [], [], []],
        steps: [up, down], vars: {}, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.rsi, s.plot0, s.plot1, s.plot2, s.plot3, s.plot4, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time;
      // ta.change(close): na on the first bar; math.max / math.min of na is na
      const ch = i > 0 ? b.close - bars[i - 1]!.close : NaN;
      const u = s.up.step(Math.max(ch, 0)) ?? NaN;
      const d = s.down.step(-Math.min(ch, 0)) ?? NaN;
      // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - 100 / (1 + up / down)
      const v = d === 0 ? 100 : u === 0 ? 0 : 100 - 100 / (1 + u / d);
      s.rsi[i] = v;
      s.plot0[i] = { time, value: v, color: RSI_COLOR };
      // plot(ob, display = display.none) / plot(os, display = display.none)
      s.plot1[i] = { time, value: cfg.ob };
      s.plot2[i] = { time, value: cfg.os };
      // plot(rv > ob ? rv : ob) / plot(rv < os ? rv : os), display.none
      s.plot3[i] = { time, value: gt(v, cfg.ob) ? v : cfg.ob };
      s.plot4[i] = { time, value: lt(v, cfg.os) ? v : cfg.os };
      // coben = ta.crossover(ob, rv), cobex = ta.crossunder(ob, rv), cosen = ta.crossover(os, rv),
      // cosex = ta.crossunder(ob, rv), cnt = ta.cross(nt, rv): the levels are the first series
      const pv = i > 0 ? s.rsi[i - 1]! : NaN;
      const flags = [
        over(cfg.ob, v, pv),
        under(cfg.ob, v, pv),
        over(cfg.nt, v, pv) || under(cfg.nt, v, pv),
        over(cfg.os, v, pv),
        under(cfg.ob, v, pv),
      ];
      for (let k = 0; k < 5; k++) {
        s.flags[k]![i] = flags[k]!;
        if (flags[k]) s.times[k]!.push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const constant = (c: string) => new Array<string>(n).fill(c);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
        hlines: [
          { value: cfg.ob, options: { title: 'Overbought', color: LEVEL_COLOR, linestyle: 'dotted' } },
          { value: cfg.onl, options: { title: 'Overbought Noise Level', color: LEVEL_COLOR, linestyle: 'dotted' } },
          { value: cfg.nt, options: { title: 'Neutral', color: color.black, linestyle: 'dashed' } },
          { value: cfg.osdl, options: { title: 'Oversold Noise Level', color: LEVEL_COLOR, linestyle: 'dotted' } },
          { value: cfg.os, options: { title: 'Oversold', color: LEVEL_COLOR, linestyle: 'dotted' } },
        ],
        fills: [
          { plot1: 'hline_ob', plot2: 'hline_onl', options: { title: 'Bg Overbought Noise Level' }, colors: constant(NOISE_FILL) },
          { plot1: 'hline_onl', plot2: 'hline_nt', options: { title: 'Background Neutral Top' }, colors: constant(NEUTRAL_FILL) },
          { plot1: 'hline_nt', plot2: 'hline_osdl', options: { title: 'Background Neutral Bottom' }, colors: constant(NEUTRAL_FILL) },
          { plot1: 'hline_os', plot2: 'hline_osdl', options: { title: 'Bg Oversold Noise Level' }, colors: constant(NOISE_FILL) },
          // fill(oblv, obl, color.new(color.red, 50)) / fill(osl, oslv, color.new(color.green, 50))
          { plot1: 'plot3', plot2: 'plot1', options: { title: 'Overbought' }, colors: constant(OB_FILL) },
          { plot1: 'plot2', plot2: 'plot4', options: { title: 'Oversold' }, colors: constant(OS_FILL) },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiMulticolorEditableInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiMulticolorEditableInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '* Entry Into Overbought Area', message: 'Entry Into Overbought Area!' },
  { id: 'alert1', title: '* Exit From Overbought Area', message: 'Exit From Overbought Area!' },
  { id: 'alert2', title: '* Crossing Neutral Level', message: 'Crossing Neutral Level' },
  { id: 'alert3', title: '* Entry Into Oversold Area', message: 'Entry Into Oversold Area!' },
  { id: 'alert4', title: '* Exit From Oversold area', message: 'Exit From Oversold Area!' },
];

export const RsiMulticolorEditable = {
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
