/**
 * MACD-V with Volatility Normalisation
 *
 * MACD line normalised by volatility: MACD-V = (EMA(src, fast) - EMA(src, slow)) / ATR(atrLength) * 100, with an EMA
 * signal line and a histogram of 2 * (MACD-V - signal). Circles mark the crosses of MACD-V over (green) and under
 * (red) the signal line. The background is green when MACD-V is above zero, red otherwise. Histogram columns use four
 * colours: above zero growing / falling, below zero growing / falling (compared with the previous histogram value,
 * na read as 0). Horizontal lines every 50 from -250 to 250.
 *
 * Reference: "MACD-V with Volatility Normalisation [DCD]" by DutchCryptoDad
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © DutchCryptoDad
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MacdVWithVolatilityNormalisationInputs {
  /** MACD fast EMA length */
  fastLength: number;
  /** MACD slow EMA length */
  slowLength: number;
  /** Price source */
  source: SourceType;
  /** Signal line EMA length */
  signalLength: number;
  /** ATR length */
  atrLength: number;
  macdColor: string;
  signalColor: string;
  colGrowAbove: string;
  colFallAbove: string;
  colGrowBelow: string;
  colFallBelow: string;
}

export const defaultInputs: MacdVWithVolatilityNormalisationInputs = {
  fastLength: 12,
  slowLength: 26,
  source: 'close',
  signalLength: 9,
  atrLength: 26,
  macdColor: '#2962FF',
  signalColor: '#FF6D00',
  colGrowAbove: '#26A69A',
  colFallAbove: '#B2DFDB',
  colGrowBelow: '#FFCDD2',
  colFallBelow: '#FF5252',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26, min: 1 },
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Line Smoothing Length', defval: 9, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 26, min: 1 },
  { id: 'macdColor', type: 'color', title: 'MACD Line', defval: '#2962FF' },
  { id: 'signalColor', type: 'color', title: 'Signal Line', defval: '#FF6D00' },
  { id: 'colGrowAbove', type: 'color', title: 'Above Grow', defval: '#26A69A' },
  { id: 'colFallAbove', type: 'color', title: 'Fall', defval: '#B2DFDB' },
  { id: 'colGrowBelow', type: 'color', title: 'Below Grow', defval: '#FFCDD2' },
  { id: 'colFallBelow', type: 'color', title: 'Fall', defval: '#FF5252' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Crossover', color: color.green, lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'Crossdown', color: color.red, lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'MACD Line', color: '#2962FF', lineWidth: 1 },
  { id: 'plot3', title: 'Signal Line', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot4', title: 'Histogram', color: '#26A69A', lineWidth: 1, style: 'columns' },
];

const LEVEL_COL = String(color.new(color.gray, 60));
const ZERO_COL = String(color.new(color.gray, 40));
const LEVELS = [250, 200, 150, 100, 50, 0, -50, -100, -150, -200, -250];

export const hlineConfig: HLineConfig[] = LEVELS.map((v, k) => ({
  id: `hline${k}`,
  price: v,
  title: String(v),
  color: v === 0 ? ZERO_COL : LEVEL_COL,
  linestyle: v === 0 ? 'solid' : 'dotted',
}));

export const metadata = {
  title: 'MACD-V with Volatility Normalisation [DCD]',
  shortTitle: 'MACD-V',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface MacdVRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  sig: ReturnType<typeof taStep.ema>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  hist: number[];
  plots: Point[][];
  bgColors: BgColorData[];
}

const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
/** Pine nz(): na and +-infinity give 0 */
const nz = (v: number) => (Number.isFinite(v) ? v : 0);

function study(inputs: Partial<MacdVWithVolatilityNormalisationInputs>): BarStudy<MacdVRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  const bgUp = String(color.new(color.green, 90));
  const bgDown = String(color.new(color.red, 90));
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(cfg.fastLength);
      const slow = taStep.ema(cfg.slowLength);
      const atr = taStep.atr(cfg.atrLength);
      const sig = taStep.ema(cfg.signalLength);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: MacdVRun = {
        fast, slow, atr, sig, over, under, hist: [], plots: [[], [], [], [], []], bgColors: [],
        steps: [fast, slow, atr, sig, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.hist, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = value(b);
      // macd = ((ta.ema(source, fast_len) - ta.ema(source, slow_len)) / ta.atr(atr_len)) * 100
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); ta.ema skips an infinite value, comparisons and crosses use it
      const f = s.fast.step(v);
      const sl = s.slow.step(v);
      const atr = s.atr.step(b.high, b.low, b.close);
      const macd = ((f - sl) / atr) * 100;
      const signal = s.sig.step(macd);
      const h = (macd - signal) * 2;
      s.hist[i] = h;
      const crossover = s.over.step(macd, signal);
      const crossdown = s.under.step(macd, signal);

      s.plots[0][i] = { time: t, value: crossover ? fin(macd) : NaN, color: color.green };
      s.plots[1][i] = { time: t, value: crossdown ? fin(macd) : NaN, color: color.red };
      s.plots[2][i] = { time: t, value: fin(macd), color: cfg.macdColor };
      s.plots[3][i] = { time: t, value: fin(signal), color: cfg.signalColor };
      s.bgColors.push({ time: t, color: gt(macd, 0) ? bgUp : bgDown });
      const h1 = nz(i > 0 ? s.hist[i - 1] : NaN);
      const histColor = ge(h, 0)
        ? (gt(h, h1) ? cfg.colGrowAbove : cfg.colFallAbove)
        : (lt(h, h1) ? cfg.colFallBelow : cfg.colGrowBelow);
      s.plots[4][i] = { time: t, value: fin(h), color: histColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice(), plot4: s.plots[4].slice() },
        hlines: LEVELS.map((v) => ({
          value: v,
          options: { title: String(v), color: v === 0 ? ZERO_COL : LEVEL_COL, linestyle: v === 0 ? 'solid' : 'dotted' },
        })),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<MacdVWithVolatilityNormalisationInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MacdVWithVolatilityNormalisationInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MacdVWithVolatilityNormalisation = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
};
