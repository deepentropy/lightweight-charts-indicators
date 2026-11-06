/**
 * RSI-Colored Price Candles with Background
 *
 * Draws the price candles in lime when the RSI (RMA of the gains and losses of the source) is at or above 50, else
 * in red (also while the RSI is na). An optional background is green above 70 and red below 30.
 *
 * Reference: "Stryder's DikFat RSI Candle Bull/Bear Detector" by Midgar-
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { PlotCandleData, BgColorData } from '../types';

export interface RSIColoredPriceCandlesInputs {
  /** RSI length */
  rsiLength: number;
  /** RSI source */
  src: SourceType;
  /** Show the overbought / oversold background */
  showBackground: boolean;
}

export const defaultInputs: RSIColoredPriceCandlesInputs = {
  rsiLength: 14,
  src: 'close',
  showBackground: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'showBackground', type: 'bool', title: 'Show Overbought/Oversold Background', defval: false },
];

// No plot(): the outputs are the candles and the background
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'candles', title: 'RSI-Colored Price Candles' },
];

export const metadata = {
  title: "Stryder's DikFat RSI Candle Bull/Bear Detector",
  shortTitle: 'DFAT RSI Candles',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]>; bgColors: BgColorData[] };

interface RsiCandlesRun extends BarRunState<Record<string, never>> {
  change: ReturnType<typeof taStep.change>;
  up: ReturnType<typeof taStep.rma>;
  down: ReturnType<typeof taStep.rma>;
  candles: PlotCandleData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<RSIColoredPriceCandlesInputs>): BarStudy<RsiCandlesRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const bull = String(color.new(color.lime, 0));
  const bear = String(color.new(color.red, 0));
  const obCol = String(color.new(color.green, 90));
  const osCol = String(color.new(color.red, 90));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const change = taStep.change();
      const up = taStep.rma(cfg.rsiLength);
      const down = taStep.rma(cfg.rsiLength);
      const s: RsiCandlesRun = { change, up, down, candles: [], bgColors: [], steps: [change, up, down], vars: {}, lists: [], series: [] };
      s.lists = [s.bgColors];
      s.series = [s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // change = ta.change(src); math.max / math.min with na give na
      const c = s.change.step(value(b));
      const up = s.up.step(isNaN(c) ? NaN : Math.max(c, 0));
      const down = s.down.step(isNaN(c) ? NaN : -Math.min(c, 0));
      // rsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))
      const rsi = eq(down, 0) ? 100 : eq(up, 0) ? 0 : 100 - 100 / (1 + up / down);
      // rsiColor = rsi >= 50 ? lime : red (na RSI: red)
      const col = ge(rsi, 50) ? bull : bear;
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: col, wickColor: col, borderColor: col };
      if (cfg.showBackground) {
        if (gt(rsi, 70)) s.bgColors.push({ time: b.time, color: obCol });
        else if (lt(rsi, 30)) s.bgColors.push({ time: b.time, color: osCol });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { candles: s.candles.slice() },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSIColoredPriceCandlesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSIColoredPriceCandlesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RSIColoredPriceCandles = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
