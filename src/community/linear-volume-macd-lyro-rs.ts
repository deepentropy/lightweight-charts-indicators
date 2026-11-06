/**
 * Linear Volume MACD | Lyro RS
 *
 * A MACD of volume-weighted EMAs: fast / slow = ema(src * volume, len) / ema(volume, len), macd = fast - slow,
 * signal = ema(macd, signal length), hist = macd - signal. The plotted histogram is the linear regression of hist
 * (Linear Regression and Strong/Weak Trend modes) or hist itself (Volume MACD mode), with SMA +- 1 and 2 standard
 * deviation bands (stdev multiplier / 2 and stdev multiplier). The histogram and bar colour is up / down: by the
 * sign of the regression (Linear Regression), by the regression rising or not (Strong/Weak Trend) or by the sign of
 * hist (Volume MACD). The background is coloured beyond the 2-stdev bands, in the indicator pane and on the price
 * pane.
 * Alerts (alertcondition, `alerts` of the result): bull / bear state of each signal type (var states, set only while
 * that type is selected, 0 before).
 *
 * Reference: "Linear Volume MACD | Lyro RS" by LyroRS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LyroRS
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LinearVolumeMacdLyroRsInputs {
  src: SourceType;
  sigType: 'Linear Regression' | 'Strong/Weak Trend' | 'Volume MACD';
  fastLength: number;
  slowLength: number;
  signalLength: number;
  /** Linear regression length */
  lrLength: number;
  stdevLength: number;
  /** Multiplier of the 2-stdev bands (the 1-stdev bands use half of it) */
  stdevMult: number;
  colMode: 'Classic' | 'Mystic' | 'Accented' | 'Royal';
  /** Use the custom up / down colours instead of the palette */
  cpyn: boolean;
  cpUpC: string;
  cpDnC: string;
}

export const defaultInputs: LinearVolumeMacdLyroRsInputs = {
  src: 'close',
  sigType: 'Linear Regression',
  fastLength: 12,
  slowLength: 21,
  signalLength: 5,
  lrLength: 35,
  stdevLength: 200,
  stdevMult: 2,
  colMode: 'Mystic',
  cpyn: true,
  cpUpC: '#00ff00',
  cpDnC: '#ff0000',
};

const CORE = '𝗖𝗢𝗥𝗘';
const STDEV = '𝗦𝗧𝗗𝗘𝗩 𝗕𝗔𝗡𝗗𝗦';
const COLORS = '𝗖𝗢𝗟𝗢𝗥𝗦';

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'sigType', type: 'string', title: 'Signal Type', defval: 'Linear Regression', options: ['Linear Regression', 'Strong/Weak Trend', 'Volume MACD'], group: CORE },
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, group: CORE },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 21, group: CORE },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 5, group: CORE },
  { id: 'lrLength', type: 'int', title: 'LR Length', defval: 35, group: CORE },
  { id: 'stdevLength', type: 'int', title: 'Stdev Length', defval: 200, group: STDEV },
  { id: 'stdevMult', type: 'float', title: 'Stdev Multiplier', defval: 2, group: STDEV },
  { id: 'colMode', type: 'string', title: 'Custom Color Palette', defval: 'Mystic', options: ['Classic', 'Mystic', 'Accented', 'Royal'], group: COLORS, inline: 'drop', display: 'none' },
  { id: 'cpyn', type: 'bool', title: 'Use Custom Palette', defval: true, group: COLORS, display: 'none' },
  { id: 'cpUpC', type: 'color', title: 'Custom Up', defval: '#00ff00', group: COLORS, inline: 'Custom Palette', display: 'none' },
  { id: 'cpDnC', type: 'color', title: 'Custom Down', defval: '#ff0000', group: COLORS, inline: 'Custom Palette', display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line', color: String(color.new('#787B86', 50)), lineWidth: 1 },
  { id: 'plot1', title: 'Histogram', color: '#00ff00', lineWidth: 1, style: 'columns' },
  { id: 'plot2', title: '-2 Stdev', color: String(color.new('#00ff00', 50)), lineWidth: 1 },
  { id: 'plot3', title: '-1 Stdev', color: String(color.new('#00ff00', 50)), lineWidth: 1 },
  { id: 'plot4', title: '+2 Stdev', color: String(color.new('#ff0000', 50)), lineWidth: 1 },
  { id: 'plot5', title: '+1 Stdev', color: String(color.new('#ff0000', 50)), lineWidth: 1 },
];

export const metadata = {
  title: 'Linear Volume MACD | Lyro RS',
  shortTitle: 'Linear Volume MACD | 𝓛𝔂𝓻𝓸 𝓡𝓢',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

const PALETTES: Record<LinearVolumeMacdLyroRsInputs['colMode'], [string, string]> = {
  Classic: ['#00E676', '#880E4F'],
  Mystic: ['#30FDCF', '#E117B7'],
  Accented: ['#9618F7', '#FF0078'],
  Royal: ['#FFC107', '#673AB7'],
};

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface LvmVars {
  /** var color pc = na */
  cur: string | null;
  /** var int lr_s = 0, swt_s = 0, vmacd_s = 0: the signal state of each type (alerts) */
  lr: number;
  swt: number;
  vm: number;
}

interface LvmRun extends BarRunState<LvmVars> {
  fastNum: ReturnType<typeof taStep.ema>;
  fastDen: ReturnType<typeof taStep.ema>;
  slowNum: ReturnType<typeof taStep.ema>;
  slowDen: ReturnType<typeof taStep.ema>;
  signal: ReturnType<typeof taStep.ema>;
  linreg: ReturnType<typeof taStep.linreg>;
  base: WindowSma;
  sd: WindowStdev;
  macdLr: number[];
  plots: Point[][];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LinearVolumeMacdLyroRsInputs>): BarStudy<LvmRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const source = barSource(cfg.src);
  const [upC, dnC] = cfg.cpyn ? [cfg.cpUpC, cfg.cpDnC] : PALETTES[cfg.colMode];
  // Plain divisions can give +-infinity: oakscriptjs averages get NaN (Pine skips infinity like na)
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const zeroCol = String(color.new('#787B86', 50));
  const upBand = String(color.new(upC, 50));
  const dnBand = String(color.new(dnC, 50));
  const upFill = String(color.new(upC, 75));
  const dnFill = String(color.new(dnC, 75));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: LvmRun = {
        fastNum: taStep.ema(cfg.fastLength), fastDen: taStep.ema(cfg.fastLength),
        slowNum: taStep.ema(cfg.slowLength), slowDen: taStep.ema(cfg.slowLength),
        signal: taStep.ema(cfg.signalLength), linreg: taStep.linreg(cfg.lrLength, 0),
        base: new WindowSma(cfg.stdevLength), sd: new WindowStdev(cfg.stdevLength),
        macdLr: [], plots: Array.from({ length: 6 }, () => []), barColors: [], bgColors: [],
        flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [], vars: { cur: null, lr: 0, swt: 0, vm: 0 }, lists: [], series: [],
      };
      s.steps = [s.fastNum, s.fastDen, s.slowNum, s.slowDen, s.signal, s.linreg, s.base, s.sd];
      s.lists = [s.barColors, s.bgColors, ...s.times];
      s.series = [s.macdLr, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const vol = b.volume ?? NaN;
      const pv = fin(source(b) * vol);
      const volF = fin(vol);
      // fast_ma = ta.ema(src * volume, fast_length) / ta.ema(volume, fast_length)
      const fastNum = s.fastNum.step(pv);
      const fastDen = s.fastDen.step(volF);
      const slowNum = s.slowNum.step(pv);
      const slowDen = s.slowDen.step(volF);
      const macd = fastNum / fastDen - slowNum / slowDen;
      const signal = s.signal.step(fin(macd));
      const hist = macd - signal;
      const macdLr = s.linreg.step(fin(hist));
      s.macdLr[i] = macdLr;

      // stdv_bands(sig_type == "Volume MACD" ? hist : macd_lr, stdev_length, mult)
      const histType = cfg.sigType === 'Volume MACD' ? hist : macdLr;
      const base = s.base.step(fin(histType));
      const sd = s.sd.step(fin(histType));
      const dev1 = (cfg.stdevMult / 2) * sd;
      const dev2 = cfg.stdevMult * sd;
      const u1 = base + dev1;
      const l1 = base - dev1;
      const u2 = base + dev2;
      const l2 = base - dev2;

      // var color pc = na: the histogram and bar colour by the signal type
      if (cfg.sigType === 'Linear Regression') {
        if (gt(macdLr, 0)) { v.cur = upC; v.lr = 1; }
        if (lt(macdLr, 0)) { v.cur = dnC; v.lr = -1; }
      } else if (cfg.sigType === 'Strong/Weak Trend') {
        // Both branches (macd_lr >= 0 or not, na included): macd_lr[1] < macd_lr ? UpC : DnC
        const prev = i > 0 ? s.macdLr[i - 1] : NaN;
        const up = lt(prev, macdLr);
        v.cur = up ? upC : dnC;
        v.swt = up ? 1 : -1;
      } else {
        if (ge(hist, 0)) { v.cur = upC; v.vm = 1; }
        else if (le(hist, 0)) { v.cur = dnC; v.vm = -1; }
      }
      const pc = v.cur;

      // barcolor(pc, title = "Bar Color")
      if (pc !== null) s.barColors.push({ time: t, color: pc, id: 'barcolor0' });
      // bgcolor(hist_type > u2 ? color.new(DnC, 75) : hist_type < l2 ? color.new(UpC, 75) : na), in the indicator pane
      // and again with force_overlay = true on the price pane
      const bg = gt(histType, u2) ? dnFill : lt(histType, l2) ? upFill : null;
      if (bg !== null) {
        s.bgColors.push({ time: t, color: bg, id: 'bgcolor0' });
        s.bgColors.push({ time: t, color: bg, forceOverlay: true, id: 'bgcolor1' });
      }

      const p = s.plots;
      p[0][i] = { time: t, value: 0, color: zeroCol };
      // plot(hist_type, "Histogram", style = plot.style_columns, color = pc)
      p[1][i] = { time: t, value: fin(histType), color: pc ?? 'transparent' };
      p[2][i] = { time: t, value: fin(l2), color: upBand };
      p[3][i] = { time: t, value: fin(l1), color: upBand };
      p[4][i] = { time: t, value: fin(u2), color: dnBand };
      p[5][i] = { time: t, value: fin(u1), color: dnBand };

      const flags = [v.lr === 1, v.lr === -1, v.swt === 1, v.swt === -1, v.vm === 1, v.vm === -1];
      for (let k = 0; k < 6; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
        fills: [
          // fill(pl2, pl1, color.new(UpC, 75)); fill(pu2, pu1, color.new(DnC, 75))
          { plot1: 'plot2', plot2: 'plot3', colors: new Array<string>(n).fill(upFill) },
          { plot1: 'plot4', plot2: 'plot5', colors: new Array<string>(n).fill(dnFill) },
          // fill(pu1, zline, color.new(DnC, 75)); fill(pl1, zline, color.new(UpC, 75))
          { plot1: 'plot5', plot2: 'plot0', colors: new Array<string>(n).fill(dnFill) },
          { plot1: 'plot3', plot2: 'plot0', colors: new Array<string>(n).fill(upFill) },
        ],
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LinearVolumeMacdLyroRsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<LinearVolumeMacdLyroRsInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Linear Volume MACD - Linear Regression Bull', message: 'Linear Volume MACD, linear regression mode is bullish {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Linear Volume MACD - Linear Regression Bearish', message: 'Linear Volume MACD, linear regression mode is bearish {{exchange}}:{{ticker}}' },
  { id: 'alert2', title: 'Linear Volume MACD - Strong/Weak Trend Bull', message: 'Linear Volume MACD, strong/weak trend mode is bullish {{exchange}}:{{ticker}}' },
  { id: 'alert3', title: 'Linear Volume MACD - Strong/Weak Trend Bearish', message: 'Linear Volume MACD, strong/weak trend mode is bearish {{exchange}}:{{ticker}}' },
  { id: 'alert4', title: 'Linear Volume MACD - Volume MACD Bull', message: 'Linear Volume MACD, volume MACD mode is bullish {{exchange}}:{{ticker}}' },
  { id: 'alert5', title: 'Linear Volume MACD - Volume MACD Bearish', message: 'Linear Volume MACD, volume MACD mode is bearish {{exchange}}:{{ticker}}' },
];

export const LinearVolumeMacdLyroRs = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
