/**
 * Support/Resistance Channel Breakout [SuprAlgo]
 *
 * Resistance = highest high (or close) of the previous `period` bars, support = lowest low (or close) of the previous
 * `period` bars. A thin channel of +- multiplier * 0.0001 around each level is drawn with gradient fills. A breakout
 * label is drawn when the close leaves the resistance channel top (or the support channel bottom) after a close
 * inside it on the previous bar, at least `breakout_cooldown` bars after the previous breakout of the same side.
 *
 * Alerts (alertcondition, `alerts` of the result): '🔔 Breakout Resistance Channel' and '🔔 Breakout Support Channel' on
 * the bars of each breakout, '🔔 Breakout Support/Resistance Channel' on both (whether or not the labels are shown).
 *
 * Reference: "Support/Resistance Channel Breakout [SuprAlgo]" by SuprAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © SuprAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SupportResistanceChannelBreakoutInputs {
  /** Channel multiplier (1 = 0.0001 %) */
  rawChannelMultiplier: number;
  /** Number of bars of the support (lowest) and resistance (highest) */
  period: number;
  /** Price of the levels */
  src: 'High/Low' | 'Close';
  /** Minimum number of bars between two breakouts of the same side */
  breakoutCooldown: number;
  /** Support channel colour (bullish breakout label) */
  colourPositive: string;
  /** Resistance channel colour (bearish breakout label) */
  colourNegative: string;
  /** Show the breakout labels */
  showBreakout: boolean;
}

export const defaultInputs: SupportResistanceChannelBreakoutInputs = {
  rawChannelMultiplier: 5,
  period: 50,
  src: 'High/Low',
  breakoutCooldown: 10,
  colourPositive: '#00ff0a',
  colourNegative: '#ff0000',
  showBreakout: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'rawChannelMultiplier', type: 'float', title: 'Channel Multiplier (1 = 0.0001%)', defval: 5, min: 0 },
  { id: 'period', type: 'int', title: 'Period Support & Resistance', defval: 50, min: 1 },
  { id: 'src', type: 'string', title: 'Source', defval: 'High/Low', options: ['High/Low', 'Close'] },
  { id: 'breakoutCooldown', type: 'int', title: 'Minimum Bars Between Breakouts', defval: 10, min: 1 },
  { id: 'colourPositive', type: 'color', title: 'Support/Resistance Channel Color', defval: '#00ff0a' },
  { id: 'colourNegative', type: 'color', title: '', defval: '#ff0000' },
  { id: 'showBreakout', type: 'bool', title: 'Show BreakOut Labels', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance Channel Top', color: String(color.new('#ff0000', 50)), lineWidth: 1 },
  { id: 'plot1', title: 'Resistance Channel Bottom', color: String(color.new('#ff0000', 50)), lineWidth: 1 },
  { id: 'plot2', title: 'Support Channel Top', color: String(color.new('#00ff0a', 50)), lineWidth: 1 },
  { id: 'plot3', title: 'Support Channel Bottom', color: String(color.new('#00ff0a', 50)), lineWidth: 1 },
  { id: 'plot4', title: 'Support', color: String(color.new('#00ff0a', 100)), lineWidth: 1 },
  { id: 'plot5', title: 'Resistance', color: String(color.new('#ff0000', 100)), lineWidth: 1 },
];

export const metadata = {
  title: 'Support/Resistance Channel Breakout [SuprAlgo]',
  shortTitle: 'Support/Resistance Channel Breakout [SuprAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface ChannelVars {
  /** var int last_top_breakout = na, var int last_bot_breakout = na */
  lastTop: number;
  lastBot: number;
}

interface ChannelRun extends BarRunState<ChannelVars> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  resHigh: number[];
  supLow: number[];
  resTop: number[];
  resBot: number[];
  supTop: number[];
  supBot: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SupportResistanceChannelBreakoutInputs>): BarStudy<ChannelRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const channelMultiplier = cfg.rawChannelMultiplier * 0.0001;
  const hl = cfg.src === 'High/Low';

  const neg50 = String(color.new(cfg.colourNegative, 50));
  const pos50 = String(color.new(cfg.colourPositive, 50));
  const neg100 = String(color.new(cfg.colourNegative, 100));
  const pos100 = String(color.new(cfg.colourPositive, 100));
  const neg30 = String(color.new(cfg.colourNegative, 30));
  const pos30 = String(color.new(cfg.colourPositive, 30));
  return {
    init() {
      const s: ChannelRun = {
        highest: new WindowExtreme(false, cfg.period), lowest: new WindowExtreme(true, cfg.period),
        resHigh: [], supLow: [], resTop: [], resBot: [], supTop: [], supBot: [],
        plots: Array.from({ length: 6 }, () => []), markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [], vars: { lastTop: NaN, lastBot: NaN }, lists: [], series: [],
      };
      s.steps = [s.highest, s.lowest];
      s.lists = [s.markers, ...s.times];
      s.series = [s.resHigh, s.supLow, s.resTop, s.resBot, s.supTop, s.supBot, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const p = i > 0 ? bars[i - 1] : null;
      // ta.highest(source_res[1], period) / ta.lowest(source_sup[1], period)
      const resHigh = s.highest.step(p ? (hl ? p.high : p.close) : NaN);
      const supLow = s.lowest.step(p ? (hl ? p.low : p.close) : NaN);
      const resTop = resHigh * (1 + channelMultiplier);
      const resBot = resHigh * (1 - channelMultiplier);
      const supTop = supLow * (1 + channelMultiplier);
      const supBot = supLow * (1 - channelMultiplier);
      s.resHigh[i] = resHigh;
      s.supLow[i] = supLow;
      s.resTop[i] = resTop;
      s.resBot[i] = resBot;
      s.supTop[i] = supTop;
      s.supBot[i] = supBot;

      const close = b.close;
      const prevClose = p ? p.close : NaN;
      const wasInsideTop = le(prevClose, i > 0 ? s.resTop[i - 1] : NaN);
      const wasInsideBot = ge(prevClose, i > 0 ? s.supBot[i - 1] : NaN);
      const potentialTop = gt(close, resTop) && wasInsideTop;
      const potentialBot = gt(supBot, close) && wasInsideBot;
      const canTop = isNaN(v.lastTop) || i - v.lastTop >= cfg.breakoutCooldown;
      const canBot = isNaN(v.lastBot) || i - v.lastBot >= cfg.breakoutCooldown;
      const finalTop = potentialTop && canTop;
      const finalBot = potentialBot && canBot;
      if (finalTop) v.lastTop = i;
      if (finalBot) v.lastBot = i;
      const both = finalTop || finalBot;
      s.flags[0][i] = finalTop;
      s.flags[1][i] = finalBot;
      s.flags[2][i] = both;
      if (finalTop) s.times[0].push(b.time as number);
      if (finalBot) s.times[1].push(b.time as number);
      if (both) s.times[2].push(b.time as number);
      if (cfg.showBreakout && finalTop) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: pos50,
          text: 'Breakout ↑', textColor: color.white, size: 'normal' });
      }
      if (cfg.showBreakout && finalBot) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: neg50,
          text: 'Breakout ↓', textColor: color.white, size: 'normal' });
      }

      const t = b.time;
      s.plots[0][i] = { time: t, value: resTop, color: neg50 };
      s.plots[1][i] = { time: t, value: resBot, color: neg50 };
      s.plots[2][i] = { time: t, value: supTop, color: pos50 };
      s.plots[3][i] = { time: t, value: supBot, color: pos50 };
      s.plots[4][i] = { time: t, value: supLow, color: pos100 };
      s.plots[5][i] = { time: t, value: resHigh, color: neg100 };
    },
    result(s, bars) {
      const n = bars.length;
      const fill = (c: string): string[] => new Array<string>(n).fill(c);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: Object.fromEntries(s.plots.map((p, k) => [`plot${k}`, p.slice()])),
        fills: [
          { plot1: 'plot1', plot2: 'plot5', options: { title: 'Resistance Fill Down' },
            gradient: { topValue: s.resBot.slice(), bottomValue: s.resHigh.slice(), topColor: fill(neg30), bottomColor: fill(neg100) } },
          { plot1: 'plot0', plot2: 'plot5', options: { title: 'Resistance Fill Up' },
            gradient: { topValue: s.resTop.slice(), bottomValue: s.resHigh.slice(), topColor: fill(neg30), bottomColor: fill(neg100) } },
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Support Fill Down' },
            gradient: { topValue: s.supBot.slice(), bottomValue: s.supLow.slice(), topColor: fill(pos30), bottomColor: fill(pos100) } },
          { plot1: 'plot2', plot2: 'plot4', options: { title: 'Support Fill Up' },
            gradient: { topValue: s.supTop.slice(), bottomValue: s.supLow.slice(), topColor: fill(pos30), bottomColor: fill(pos100) } },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupportResistanceChannelBreakoutInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SupportResistanceChannelBreakoutInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '🔔 Breakout Resistance Channel', message: 'Breakout above resistance Channel detected.' },
  { id: 'alert1', title: '🔔 Breakout Support Channel', message: 'Breakout below support Channel detected.' },
  { id: 'alert2', title: '🔔 Breakout Support/Resistance Channel', message: 'Breakout Support/Resistance Channel detected.' },
];

export const SupportResistanceChannelBreakout = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
