/**
 * Trend Volatility Index (TVI)
 *
 * The TVI is the mean absolute difference (Gini mean difference) of four SMAs of the source (10, 20, 40, 70): the
 * average of the six pairwise distances. It is drawn as candles: open = previous TVI, close = TVI, high / low
 * extended to the TVI rounded up / down to the step factor, or as Heikin-Ashi candles of these values. Candles are
 * green when the close is above the open (of the plain or Heikin-Ashi candle, by the colour mode). ATR and the SMA
 * of the high-low range are drawn as areas for reference.
 *
 * Reference: "Trend Volatility Index (TVI)" by chikaharu
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendVolatilityIndexInputs {
  /** Base price */
  src: SourceType;
  /** Step factor: the candle high / low reach the TVI rounded to this step */
  tickStep: number;
  /** Candle values: 'Candle' or 'Heikin-Ashi' */
  mode: string;
  /** Candle colour from the 'Candle' or 'Heikin-Ashi' values */
  colorMode: string;
  /** ATR length */
  atrLen: number;
  /** Length of the SMA of high - low */
  rangeLen: number;
}

export const defaultInputs: TrendVolatilityIndexInputs = {
  src: 'close',
  tickStep: 1.0,
  mode: 'Candle',
  colorMode: 'Candle',
  atrLen: 14,
  rangeLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Base Price', defval: 'close' },
  { id: 'tickStep', type: 'float', title: 'Step Factor', defval: 1.0 },
  { id: 'mode', type: 'string', title: 'mode', defval: 'Candle', options: ['Candle', 'Heikin-Ashi'] },
  { id: 'colorMode', type: 'string', title: 'colorMode', defval: 'Candle', options: ['Candle', 'Heikin-Ashi'] },
  { id: 'atrLen', type: 'int', title: 'ATR_len', defval: 14 },
  { id: 'rangeLen', type: 'int', title: 'Range_len', defval: 14 },
];

const ATR_COL = String(color.new(color.red, 70));
const RANGE_COL = String(color.new(color.black, 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR (28)', color: ATR_COL, lineWidth: 1, style: 'area' },
  { id: 'plot1', title: 'High-Low Range MA (28)', color: RANGE_COL, lineWidth: 1, style: 'area' },
];

export const metadata = {
  title: 'Trend Volatility Index (TVI)',
  shortTitle: 'Trend Volatility Index (TVI)',
  overlay: false,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };
type Point = { time: number; value: number; color: string };

interface TviVars {
  /** var float ha_op = na */
  haOp: number;
  /** var float ha_cl = na */
  haCl: number;
}

interface TviRun extends BarRunState<TviVars> {
  sma1: WindowSma;
  sma4: WindowSma;
  sma6: WindowSma;
  sma9: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  hlRange: WindowSma;
  tvi: number[];
  plots: Point[][];
  candles: PlotCandleData[];
}

function study(inputs: Partial<TrendVolatilityIndexInputs>): BarStudy<TviRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const up = '#009076';
  const down = '#F8213D';
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: TviRun = {
        sma1: new WindowSma(10), sma4: new WindowSma(20), sma6: new WindowSma(40), sma9: new WindowSma(70),
        atr: taStep.atr(cfg.atrLen), hlRange: new WindowSma(cfg.rangeLen), tvi: [], plots: [[], []], candles: [],
        steps: [], vars: { haOp: NaN, haCl: NaN }, lists: [], series: [],
      };
      s.steps = [s.sma1, s.sma4, s.sma6, s.sma9, s.atr, s.hlRange];
      s.lists = [s.candles];
      s.series = [s.tvi, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = value(b);
      const sma1 = s.sma1.step(src);
      const sma4 = s.sma4.step(src);
      const sma6 = s.sma6.step(src);
      const sma9 = s.sma9.step(src);
      const atr = s.atr.step(b.high, b.low, b.close);
      const hlRange = s.hlRange.step(b.high - b.low);

      // gini_mean_diff of the four SMAs (math.abs(math.pow(x, 1)))
      const d = [sma1 - sma4, sma1 - sma6, sma1 - sma9, sma4 - sma6, sma4 - sma9, sma6 - sma9];
      const cl = d.reduce((acc, x) => acc + Math.abs(Math.pow(x, 1)), 0) / 6;
      s.tvi[i] = cl;
      // TVI / tickStep: a plain division (Step Factor 0 gives +-infinity or NaN, as in Pine)
      const lowerTVI = Math.floor(cl / cfg.tickStep) * cfg.tickStep;
      const upperTVI = Math.ceil(cl / cfg.tickStep) * cfg.tickStep;
      const op = i > 0 ? s.tvi[i - 1] : NaN;
      const hi = Math.max(op, upperTVI, cl);
      const lo = Math.min(op, lowerTVI, cl);

      // if na(ha_op): initialise; else ha_op := (ha_op[1] + ha_cl[1]) / 2
      if (isNaN(v.haOp)) {
        v.haCl = (op + hi + lo + cl) / 4;
        v.haOp = (op + cl) / 2;
      } else {
        v.haOp = (v.haOp + v.haCl) / 2;
        v.haCl = (op + hi + lo + cl) / 4;
      }
      const haOp = v.haOp;
      const haCl = v.haCl;
      const haHi = Math.max(hi, haOp, haCl);
      const haLo = Math.min(lo, haOp, haCl);

      const candle = cfg.mode === 'Candle' ? [op, hi, lo, cl] : [haOp, haHi, haLo, haCl];
      const col = cfg.colorMode === 'Candle' ? (gt(cl, op) ? up : down) : gt(haCl, haOp) ? up : down;
      // plotcandle draws no candle when a value is na
      if (candle.every((x) => !isNaN(x))) {
        const [o, h, l, c] = candle;
        s.candles.push({ time: b.time, open: o, high: h, low: l, close: c, color: col, wickColor: col, borderColor: col });
      }

      // plot(atr, 'ATR (28)', color.new(color.red, 70), style = plot.style_area)
      s.plots[0][i] = { time: b.time, value: atr, color: ATR_COL };
      // plot(hl_range, 'High-Low Range MA (28)', color.new(color.black, 80), style = plot.style_area)
      s.plots[1][i] = { time: b.time, value: hlRange, color: RANGE_COL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice() },
        markers: [],
        plotCandles: { tviCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendVolatilityIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendVolatilityIndexInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendVolatilityIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
