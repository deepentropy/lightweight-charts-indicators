/**
 * DN MACD
 *
 * MACD = MA(fast) - MA(slow) of the source (EMA or SMA), signal = MA of the MACD (EMA or SMA), histogram =
 * 2 * (MACD - signal). The histogram is drawn as candles from the histogram value (open) to 0 (high, low and
 * close are 0): the border is green at or above 0 and red below; the body is hollow (transparent) when the
 * histogram rises, filled otherwise. The background is green when the signal is above 0, red otherwise.
 *
 * Reference: "DN MACD" by lihulu123
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © lihulu123
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type DnMacdMaType = 'SMA' | 'EMA';

export interface DnMacdInputs {
  fastLength: number;
  slowLength: number;
  src: SourceType;
  /** Signal smoothing length */
  signalLength: number;
  /** Oscillator MA type */
  smaSource: DnMacdMaType;
  /** Signal line MA type */
  smaSignal: DnMacdMaType;
}

export const defaultInputs: DnMacdInputs = {
  fastLength: 12,
  slowLength: 26,
  src: 'close',
  signalLength: 9,
  smaSource: 'EMA',
  smaSignal: 'EMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, max: 50 },
  { id: 'smaSource', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['SMA', 'EMA'] },
  { id: 'smaSignal', type: 'string', title: 'Signal Line MA Type', defval: 'EMA', options: ['SMA', 'EMA'] },
];

const MACD_COL = '#FFFFFF';
const SIGNAL_COL = '#fbff0d';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD', color: MACD_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: SIGNAL_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'DN MACD',
  shortTitle: 'DN MACD',
  overlay: false,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

/** plotcandle without wickcolor: the style default of the plot */
const CANDLE_WICK = '#737375';

type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]>; bgColors: BgColorData[] };
type Ma = { step(v: number): number; commit(): void };

interface DnRun extends BarRunState<Record<string, never>> {
  fast: Ma;
  slow: Ma;
  sig: Ma;
  hist: number[];
  candles: PlotCandleData[];
  bgColors: BgColorData[];
  plot0: { time: number; value: number; color: string }[];
  plot1: { time: number; value: number; color: string }[];
}

function study(inputs: Partial<DnMacdInputs>): BarStudy<DnRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  // The MA types are inputs (constant): the selected branch runs on every bar
  const maStep = (sma: boolean, length: number): Ma => (sma ? new WindowSma(length) : taStep.ema(length));

  const green = String(color.new('#089981', 0));
  const greenHollow = String(color.new('#089981', 100));
  const red = String(color.new('#FF5252', 0));
  const redHollow = String(color.new('#FF5252', 100));
  const bgRed = String(color.new(color.red, 80));
  const bgGreen = String(color.new(color.green, 80));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const fast = maStep(cfg.smaSource === 'SMA', cfg.fastLength);
      const slow = maStep(cfg.smaSource === 'SMA', cfg.slowLength);
      const sig = maStep(cfg.smaSignal === 'SMA', cfg.signalLength);
      const s: DnRun = {
        fast, slow, sig, hist: [], candles: [], bgColors: [], plot0: [], plot1: [],
        steps: [fast, slow, sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.hist, s.candles, s.bgColors, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const v = value(bars[i]);
      const macd = s.fast.step(v) - s.slow.step(v);
      const signal = s.sig.step(macd);
      const h = (macd - signal) * 2;
      s.hist[i] = h;
      const prev = i > 0 ? s.hist[i - 1] : NaN;
      const borderColor = ge(h, 0) ? green : red;
      const histColor = ge(h, 0) ? (lt(prev, h) ? greenHollow : green) : lt(prev, h) ? redHollow : red;
      // plotcandle(hist, 0, 0, 0, bordercolor = bordercolor, color = histColor): an na open gives NaN (no candle)
      s.candles[i] = { time, open: h, high: 0, low: 0, close: 0, color: histColor, wickColor: CANDLE_WICK, borderColor };
      // GetBackgroundColor = signal > 0 ? 1 : -1 (na signal gives -1: red)
      s.bgColors[i] = { time, color: gt(signal, 0) ? bgGreen : bgRed };
      s.plot0[i] = { time, value: macd, color: MACD_COL };
      s.plot1[i] = { time, value: signal, color: SIGNAL_COL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: String(color.new('#787B86', 50)), linestyle: 'dashed' } }],
        plotCandles: { histCandles: s.candles.slice() },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DnMacdInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DnMacdInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const DnMacd = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
