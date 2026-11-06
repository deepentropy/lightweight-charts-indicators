/**
 * Terminal Velocity Stop
 *
 * A trailing stop that chases an ATR target (close - mult * ATR in an uptrend, close + multm * ATR in a downtrend)
 * but moves at most `Terminal Velocity` * ATR per bar, and only in the trend direction. When the close crosses the
 * stop the direction flips and the stop restarts at the target of the new direction. Bull / bear stop lines with a
 * glow, a gradient cloud between the stop and the close, a dot on the flips and candles coloured by the direction.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Flip' and 'Bearish Flip', true on the bars where the
 * direction flips up / down.
 *
 * Reference: "Terminal Velocity Stop | Lyro RS" by LyroRS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LyroRS
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TerminalVelocityStopLyroRsInputs {
  /** ATR length */
  atrLen: number;
  /** Stop distance (ATR multiples) in uptrends */
  mult: number;
  /** Stop distance (ATR multiples) in downtrends */
  multm: number;
  /** Terminal velocity: maximum stop move per bar, in ATR */
  vmax: number;
  /** Predefined colour palette */
  colMode: 'Classic' | 'Mystic' | 'Accented' | 'Royal';
  /** Use the custom up / down colours */
  useCustomPalette: boolean;
  customUpColor: string;
  customDownColor: string;
}

export const defaultInputs: TerminalVelocityStopLyroRsInputs = {
  atrLen: 14,
  mult: 3.0,
  multm: 3.0,
  vmax: 0.3,
  colMode: 'Mystic',
  useCustomPalette: false,
  customUpColor: '#00ff00',
  customDownColor: '#ff0000',
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'mult', type: 'float', title: '+ Multiplier', defval: 3.0, min: 0.5, step: 0.25 },
  { id: 'multm', type: 'float', title: '- Multiplier', defval: 3.0, min: 0.5, step: 0.25 },
  { id: 'vmax', type: 'float', title: 'Terminal Velocity', defval: 0.3, min: 0.05, max: 2, step: 0.05 },
  { id: 'colMode', type: 'string', title: 'Custom Color Palette', defval: 'Mystic', options: ['Classic', 'Mystic', 'Accented', 'Royal'] },
  { id: 'useCustomPalette', type: 'bool', title: 'Use Custom Palette', defval: false },
  { id: 'customUpColor', type: 'color', title: 'Custom Up', defval: '#00ff00' },
  { id: 'customDownColor', type: 'color', title: 'Custom Down', defval: '#ff0000' },
];

const PALETTES: Record<string, [string, string]> = {
  Classic: ['#00E676', '#880E4F'],
  Mystic: ['#30FDCF', '#E117B7'],
  Accented: ['#9618F7', '#FF0078'],
  Royal: ['#FFC107', '#673AB7'],
};

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull Stop [Glow]', color: String(color.new('#30FDCF', 80)), lineWidth: 6, style: 'linebr' },
  { id: 'plot1', title: 'Bull Stop', color: '#30FDCF', lineWidth: 2, style: 'linebr' },
  { id: 'plot2', title: 'Bear Stop [Glow]', color: String(color.new('#E117B7', 80)), lineWidth: 6, style: 'linebr' },
  { id: 'plot3', title: 'Bear Stop', color: '#E117B7', lineWidth: 2, style: 'linebr' },
  { id: 'plot4', title: 'Stop Anchor', color: 'transparent', lineWidth: 1 },
  { id: 'plot5', title: 'Price Anchor', color: 'transparent', lineWidth: 1 },
  { id: 'plot6', title: 'Flip Dot', color: '#30FDCF', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'Terminal Velocity Stop | Lyro RS',
  shortTitle: 'TVS | Lyro RS',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: Bar['time']; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

interface TvsVars {
  /** var float stop = na, var int dir = 1 */
  stop: number;
  dir: number;
}

interface TvsRun extends BarRunState<TvsVars> {
  atr: ReturnType<typeof taStep.atr>;
  plots: Point[][];
  topValue: number[];
  bottomValue: number[];
  topColor: string[];
  bottomColor: string[];
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TerminalVelocityStopLyroRsInputs>): BarStudy<TvsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let [upC, dnC] = PALETTES[cfg.colMode] ?? ['transparent', 'transparent'];
  if (cfg.useCustomPalette) {
    upC = cfg.customUpColor;
    dnC = cfg.customDownColor;
  }
  const upGlow = String(color.new(upC, 80));
  const dnGlow = String(color.new(dnC, 80));
  const up90 = String(color.new(upC, 90));
  const up50 = String(color.new(upC, 50));
  const dn90 = String(color.new(dnC, 90));
  const dn50 = String(color.new(dnC, 50));
  const upDot = String(color.new(upC, 0));
  const dnDot = String(color.new(dnC, 0));
  return {
    init() {
      const atr = taStep.atr(cfg.atrLen);
      const s: TvsRun = {
        atr, plots: Array.from({ length: 7 }, () => []), topValue: [], bottomValue: [], topColor: [], bottomColor: [],
        candles: [], flags: [[], []], times: [[], []],
        steps: [atr], vars: { stop: NaN, dir: 1 }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [...s.plots, s.topValue, s.bottomValue, s.topColor, s.bottomColor, s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const close = b.close;
      const a = s.atr.step(b.high, b.low, close);
      const prevDir = v.dir;
      const target = v.dir === 1 ? close - cfg.mult * a : close + cfg.multm * a;
      if (isNaN(v.stop)) {
        v.stop = target;
      } else {
        const step = Math.max(Math.min(target - v.stop, cfg.vmax * a), -cfg.vmax * a);
        if (v.dir === 1) {
          v.stop = Math.max(v.stop, v.stop + step);
          if (lt(close, v.stop)) {
            v.dir = -1;
            v.stop = close + cfg.multm * a;
          }
        } else {
          v.stop = Math.min(v.stop, v.stop + step);
          if (gt(close, v.stop)) {
            v.dir = 1;
            v.stop = close - cfg.mult * a;
          }
        }
      }
      const stop = v.stop;
      const dir = v.dir;

      const flipUp = dir === 1 && i > 0 && prevDir === -1;
      const flipDown = dir === -1 && i > 0 && prevDir === 1;
      const css = dir === 1 ? upC : dnC;
      const bull = dir === 1 && !flipUp ? stop : NaN;
      const bear = dir === -1 && !flipDown ? stop : NaN;
      const p = s.plots;
      p[0][i] = { time: t, value: bull, color: upGlow };
      p[1][i] = { time: t, value: bull, color: upC };
      p[2][i] = { time: t, value: bear, color: dnGlow };
      p[3][i] = { time: t, value: bear, color: dnC };
      p[4][i] = { time: t, value: stop };
      p[5][i] = { time: t, value: close };
      p[6][i] = { time: t, value: flipUp || flipDown ? stop : NaN, color: dir === 1 ? upDot : dnDot };

      // fill(pStop, pPrice, top = dir == 1 ? stop : close, bottom = dir == 1 ? close : stop, topColor, bottomColor)
      const up = dir === 1;
      s.topValue[i] = up ? stop : close;
      s.bottomValue[i] = up ? close : stop;
      s.topColor[i] = up ? up90 : dn50;
      s.bottomColor[i] = up ? up50 : dn90;

      // plotcandle(open, high, low, close, color = css, wickcolor = css, bordercolor = css)
      s.candles[i] = {
        time: t, open: b.open, high: b.high, low: b.low, close,
        color: css, wickColor: css, borderColor: css,
      };

      // alertcondition(flipUp, 'Bullish Flip') / alertcondition(flipDown, 'Bearish Flip')
      s.flags[0][i] = flipUp;
      s.flags[1][i] = flipDown;
      if (flipUp) s.times[0].push(t as number);
      if (flipDown) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const [plot0, plot1, plot2, plot3, plot4, plot5, plot6] = s.plots.map((x) => x.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1, plot2, plot3, plot4, plot5, plot6 },
        fills: [{
          plot1: 'plot4', plot2: 'plot5',
          gradient: {
            topValue: s.topValue.slice(),
            bottomValue: s.bottomValue.slice(),
            topColor: s.topColor.slice(),
            bottomColor: s.bottomColor.slice(),
          },
        }],
        markers: [],
        plotCandles: { candles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TerminalVelocityStopLyroRsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TerminalVelocityStopLyroRsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Flip', message: 'TVS | Lyro RS: Bullish stop flip on {{ticker}} ({{interval}})' },
  { id: 'alert1', title: 'Bearish Flip', message: 'TVS | Lyro RS: Bearish stop flip on {{ticker}} ({{interval}})' },
];

export const TerminalVelocityStopLyroRs = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
