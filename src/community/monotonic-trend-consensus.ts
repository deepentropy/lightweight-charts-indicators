/**
 * Monotonic Trend Consensus
 *
 * Spearman rank correlation between the source and time over up to five windows (default 8, 13, 21, 34): each
 * window scores -1 (a clean staircase down) to +1 (a clean staircase up). The consensus is the average of the
 * active window scores; the conviction is the share of windows with the sign of the consensus. A bullish trend is a
 * consensus above the threshold with enough conviction, a bearish trend below minus the threshold. The consensus
 * line is coloured by the trend, with four fill layers to zero, threshold lines and optional window lines, bar and
 * background colours. Presets override the windows, the threshold and the conviction.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Trend Signal', 'Bearish Trend Signal', 'Trend Lost /
 * Neutral' (the trend direction turns 1 / -1 / 0) and 'Any Trend Change' (turns bullish or bearish).
 *
 * Reference: "Monotonic Trend Consensus [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © QuantAlgo
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MonotonicTrendConsensusInputs {
  preset: 'Default' | 'Fast Response' | 'Smooth Trend';
  src: SourceType;
  threshold: number;
  minConviction: number;
  e1: boolean;
  l1: number;
  e2: boolean;
  l2: number;
  e3: boolean;
  l3: number;
  e4: boolean;
  l4: number;
  e5: boolean;
  l5: number;
  showNeutral: boolean;
  showComp: boolean;
  colorPreset: 'Classic' | 'Aqua' | 'Cosmic' | 'Cyber' | 'Neon' | 'Custom';
  bullishColor: string;
  bearishColor: string;
  neutralColor: string;
  showCandles: boolean;
  barTrans: number;
  showBgcolor: boolean;
  bgTrans: number;
}

export const defaultInputs: MonotonicTrendConsensusInputs = {
  preset: 'Default',
  src: 'close',
  threshold: 0.35,
  minConviction: 60,
  e1: true,
  l1: 8,
  e2: true,
  l2: 13,
  e3: true,
  l3: 21,
  e4: true,
  l4: 34,
  e5: false,
  l5: 55,
  showNeutral: true,
  showComp: false,
  colorPreset: 'Custom',
  bullishColor: '#00ffaa',
  bearishColor: '#ff0000',
  neutralColor: '#808080',
  showCandles: false,
  barTrans: 0,
  showBgcolor: false,
  bgTrans: 90,
};

const G_CORE = '════════ Core Settings ════════';
const G_TIME = '════════ Timescale Settings ════════';
const G_VIS = '════════ Visual Settings ════════';

export const inputConfig: InputConfig[] = [
  { id: 'preset', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'], group: G_CORE },
  { id: 'src', type: 'source', title: 'Price Source', defval: 'close', group: G_CORE },
  { id: 'threshold', type: 'float', title: 'Trend Threshold', defval: 0.35, min: 0.0, max: 1.0, step: 0.05, group: G_CORE },
  { id: 'minConviction', type: 'int', title: 'Min Conviction %', defval: 60, min: 0, max: 100, step: 10, group: G_CORE },
  { id: 'e1', type: 'bool', title: 'Window 1', defval: true, group: G_TIME },
  { id: 'l1', type: 'int', title: 'Window 1 Length', defval: 8, min: 3, max: 200, group: G_TIME },
  { id: 'e2', type: 'bool', title: 'Window 2', defval: true, group: G_TIME },
  { id: 'l2', type: 'int', title: 'Window 2 Length', defval: 13, min: 3, max: 200, group: G_TIME },
  { id: 'e3', type: 'bool', title: 'Window 3', defval: true, group: G_TIME },
  { id: 'l3', type: 'int', title: 'Window 3 Length', defval: 21, min: 3, max: 200, group: G_TIME },
  { id: 'e4', type: 'bool', title: 'Window 4', defval: true, group: G_TIME },
  { id: 'l4', type: 'int', title: 'Window 4 Length', defval: 34, min: 3, max: 200, group: G_TIME },
  { id: 'e5', type: 'bool', title: 'Window 5', defval: false, group: G_TIME },
  { id: 'l5', type: 'int', title: 'Window 5 Length', defval: 55, min: 3, max: 200, group: G_TIME },
  { id: 'showNeutral', type: 'bool', title: 'Show Neutral', defval: true, group: G_VIS },
  { id: 'showComp', type: 'bool', title: 'Show Component Lines', defval: false, group: G_VIS },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Cyber', 'Neon', 'Custom'], group: G_VIS },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: '#00ffaa', group: G_VIS },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: '#ff0000', group: G_VIS },
  { id: 'neutralColor', type: 'color', title: 'Neutral Color', defval: '#808080', group: G_VIS },
  { id: 'showCandles', type: 'bool', title: 'Enable Bar Coloring', defval: false, group: G_VIS },
  { id: 'barTrans', type: 'int', title: 'Bar Color Transparency', defval: 0, min: 0, max: 100, group: G_VIS },
  { id: 'showBgcolor', type: 'bool', title: 'Enable Background Coloring', defval: false, group: G_VIS },
  { id: 'bgTrans', type: 'int', title: 'Background Color Transparency', defval: 90, min: 0, max: 100, group: G_VIS },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Consensus', color: '#808080', lineWidth: 3 },
  { id: 'plot1', title: 'Zero', color: '#808080', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Gradient 75%', color: '#808080', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Gradient 50%', color: '#808080', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Gradient 25%', color: '#808080', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Window 1', color: color.blue, lineWidth: 1 },
  { id: 'plot6', title: 'Window 2', color: color.orange, lineWidth: 1 },
  { id: 'plot7', title: 'Window 3', color: color.lime, lineWidth: 1 },
  { id: 'plot8', title: 'Window 4', color: color.fuchsia, lineWidth: 1 },
  { id: 'plot9', title: 'Window 5', color: color.yellow, lineWidth: 1 },
  { id: 'plot10', title: 'Bull Threshold', color: String(color.new('#00ffaa', 60)), lineWidth: 1 },
  { id: 'plot11', title: 'Bear Threshold', color: String(color.new('#ff0000', 60)), lineWidth: 1 },
];

export const metadata = {
  title: 'Monotonic Trend Consensus [QuantAlgo]',
  shortTitle: 'Monotonic Trend Consensus [QuantAlgo]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };

type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface MtcVars {
  /** var int trend_dir = 0 */
  dir: number;
}

interface MtcRun extends BarRunState<MtcVars> {
  src: number[];
  trendDir: number[];
  plots: Point[][];
  fills: string[][];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MonotonicTrendConsensusInputs>): BarStudy<MtcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { e1, e2, e3, e4, e5, l1, l2, l3, l4, threshold, minConviction } = cfg;
  const l5 = cfg.l5;
  if (cfg.preset === 'Fast Response') {
    [e1, e2, e3, e4, e5] = [true, true, true, true, false];
    [l1, l2, l3, l4] = [5, 8, 13, 21];
    threshold = 0.25;
    minConviction = 50;
  } else if (cfg.preset === 'Smooth Trend') {
    [e1, e2, e3, e4, e5] = [true, true, true, true, false];
    [l1, l2, l3, l4] = [21, 34, 55, 89];
    threshold = 0.45;
    minConviction = 75;
  }
  const presets: Record<string, [string, string]> = {
    Classic: ['#00ff00', '#ff0000'],
    Aqua: ['#00d4ff', '#ff8c00'],
    Cosmic: ['#49ffce', '#9932cc'],
    Cyber: ['#00cccc', '#ff6600'],
    Neon: ['#ffff00', '#ff00ff'],
    Custom: [cfg.bullishColor, cfg.bearishColor],
  };
  const [bullishColor, bearishColor] = presets[cfg.colorPreset] ?? presets.Custom;
  const neutral = cfg.neutralColor;
  const value = barSource(cfg.src);
  const windows: Array<[boolean, number]> = [[e1, l1], [e2, l2], [e3, l3], [e4, l4], [e5, l5]];
  const winColors = [color.blue, color.orange, color.lime, color.fuchsia, color.yellow];
  const bullTh = String(color.new(bullishColor, 60));
  const bearTh = String(color.new(bearishColor, 60));

  // f_spearman(src, len) runs only on the bars where `e and bar_index >= len` is true (from bar `len` on): its
  // argument history s[i] holds the values of the calls, so s[i] is na before the first call
  const spearman = (src: number[], t: number, len: number): number => {
    const first = len; // first bar of the calls
    const s = (i: number) => (t - i >= first ? src[t - i] : NaN);
    let sumd2 = 0.0;
    for (let i = 0; i <= len - 1; i++) {
      const pi = s(i);
      let less = 0.0;
      let eqc = 0.0;
      for (let j = 0; j <= len - 1; j++) {
        const pj = s(j);
        if (lt(pj, pi)) less += 1.0;
        else if (eq(pj, pi)) eqc += 1.0;
      }
      const priceRank = less + (eqc + 1.0) / 2.0;
      const timeRank = len - i;
      const d = priceRank - timeRank;
      sumd2 += d * d;
    }
    const denom = len * len * len - len;
    const rho = gt(denom, 0) ? 1.0 - (6.0 * sumd2) / denom : 0.0;
    return Math.max(-1.0, Math.min(1.0, rho));
  };

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: MtcRun = {
        src: [], trendDir: [], plots: Array.from({ length: 12 }, () => []), fills: [[], [], [], []],
        barColors: [], bgColors: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: { dir: 0 }, lists: [], series: [],
      };
      s.lists = [s.barColors, s.bgColors, ...s.times];
      s.series = [s.src, s.trendDir, ...s.plots, ...s.fills, ...s.flags];
      return s;
    },
    bar(s, t, bars) {
      const time = bars[t].time;
      s.src[t] = value(bars[t]) ?? NaN;
      const rhos: number[] = [];
      const r: number[] = windows.map(([on, len]) => {
        const v = on && t >= len ? spearman(s.src, t, len) : NaN;
        if (!isNaN(v)) rhos.push(v);
        return v;
      });
      const active = rhos.length;
      let cons = 0.0;
      if (active > 0) cons = rhos.reduce((a, b) => a + b, 0) / active; // array.avg
      let agree = 0;
      if (active > 0) {
        const sgn = ge(cons, 0) ? 1 : -1;
        for (const v of rhos) if ((ge(v, 0) ? 1 : -1) === sgn) agree += 1;
      }
      const conviction = active > 0 ? (100.0 * agree) / active : 0.0;
      const rawBull = gt(cons, threshold) && ge(conviction, minConviction);
      const rawBear = lt(cons, -threshold) && ge(conviction, minConviction);
      const rawState = rawBull ? 1 : rawBear ? -1 : 0;
      const dir = rawState !== 0 ? rawState : cfg.showNeutral ? 0 : s.vars.dir;
      s.vars.dir = dir;
      s.trendDir[t] = dir;

      const lineColor = dir === 1 ? bullishColor : dir === -1 ? bearishColor : neutral;
      const p = s.plots;
      p[0][t] = { time, value: cons, color: lineColor };
      p[1][t] = { time, value: 0 };
      p[2][t] = { time, value: cons * 0.75 };
      p[3][t] = { time, value: cons * 0.5 };
      p[4][t] = { time, value: cons * 0.25 };
      // plot(show_comp and not na(rN) ? rN : na, 'Window N', color = ...)
      r.forEach((rk, k) => { p[5 + k][t] = { time, value: cfg.showComp ? rk : NaN, color: winColors[k] }; });
      p[10][t] = { time, value: threshold, color: bullTh };
      p[11][t] = { time, value: -threshold, color: bearTh };

      // fill(p_line, p_g1, color.new(line_color, 55)), (p_g1, p_g2, 70), (p_g2, p_g3, 82), (p_g3, p_zero, 92)
      [55, 70, 82, 92].forEach((tr, k) => { s.fills[k][t] = String(color.new(lineColor, tr)); });

      if (cfg.showCandles) s.barColors.push({ time, color: String(color.new(lineColor, cfg.barTrans)) });
      if (cfg.showBgcolor) s.bgColors.push({ time, color: String(color.new(lineColor, cfg.bgTrans)) });

      // turned_bullish = trend_dir == 1 and trend_dir[1] != 1 (and -1 / 0); trend_changed = turned_bullish or turned_bearish
      // (trend_dir[1] is na on the first bar: false)
      const turned = (d: number) => t > 0 && dir === d && s.trendDir[t - 1] !== d;
      const turnedBull = turned(1);
      const turnedBear = turned(-1);
      [turnedBull, turnedBear, turned(0), turnedBull || turnedBear].forEach((f, k) => {
        s.flags[k][t] = f;
        if (f) s.times[k].push(time as number);
      });
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: 0, options: { title: 'Zero', color: String(color.new(neutral, 70)), linestyle: 'dashed' } },
          { value: 1, options: { title: '+1', color: String(color.new(neutral, 85)), linestyle: 'dotted' } },
          { value: -1, options: { title: '-1', color: String(color.new(neutral, 85)), linestyle: 'dotted' } },
        ],
        fills: [
          { plot1: 'plot0', plot2: 'plot2', colors: s.fills[0].slice() },
          { plot1: 'plot2', plot2: 'plot3', colors: s.fills[1].slice() },
          { plot1: 'plot3', plot2: 'plot4', colors: s.fills[2].slice() },
          { plot1: 'plot4', plot2: 'plot1', colors: s.fills[3].slice() },
        ],
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MonotonicTrendConsensusInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MonotonicTrendConsensusInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend Signal', message: 'Monotonic Trend Consensus: BULLISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Trend Signal', message: 'Monotonic Trend Consensus: BEARISH trend confirmed on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert2', title: 'Trend Lost / Neutral', message: 'Monotonic Trend Consensus: trend lost, consensus flat on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert3', title: 'Any Trend Change', message: 'Monotonic Trend Consensus: trend direction changed on {{exchange}}:{{ticker}} - {{interval}}' },
];

export const MonotonicTrendConsensus = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
