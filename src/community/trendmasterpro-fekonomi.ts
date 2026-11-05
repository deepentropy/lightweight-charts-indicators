/**
 * TrendMasterPro_Fekonomi
 *
 * A weighted vote of four signals: MACD line / signal crossover (weight 2), RSI above / below 50 (weight 2), short /
 * long EMA crossover with a +DI / -DI / ADX filter (weight 1), and the price above / below a cloud of two
 * Ichimoku-like spans built from SMAs of the high and low (weight 1, the buy side also needs a volume spike on a
 * green candle). A BUY / SELL label is drawn when the vote share reaches the confidence level. The script plots the
 * two EMAs, the two spans with a green / red fill between them, and the close.
 *
 * The Pine script destructures ta.dmi as [adx, adx_plus_di, adx_minus_di], while ta.dmi returns
 * [+DI, -DI, ADX]: its "adx" is +DI, its "adx_plus_di" is -DI and its "adx_minus_di" is the ADX. The port keeps
 * this behaviour.
 *
 * Reference: "TrendMasterPro_Fekonomi" by fekonomi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendMasterProFekonomiInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  shortEmaLength: number;
  longEmaLength: number;
  adxLength: number;
  adxSmoothing: number;
  adxThreshold: number;
  plusDiThreshold: number;
  minusDiThreshold: number;
  conversionLength: number;
  baseLength: number;
  laggingSpan: number;
  /** Not used by the Pine script */
  displacement: number;
  rsiLength: number;
  /** Volume increase threshold (x times the 20-bar average volume) */
  volumeThreshold: number;
  macdWeight: number;
  rsiWeight: number;
  emaWeight: number;
  cloudWeight: number;
  /** Confidence level (%) */
  confidenceLevel: number;
}

export const defaultInputs: TrendMasterProFekonomiInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  shortEmaLength: 9,
  longEmaLength: 21,
  adxLength: 14,
  adxSmoothing: 14,
  adxThreshold: 20,
  plusDiThreshold: 25,
  minusDiThreshold: 25,
  conversionLength: 9,
  baseLength: 26,
  laggingSpan: 52,
  displacement: 26,
  rsiLength: 14,
  volumeThreshold: 1.5,
  macdWeight: 2,
  rsiWeight: 2,
  emaWeight: 1,
  cloudWeight: 1,
  confidenceLevel: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'MACD Fast Length', defval: 12 },
  { id: 'slowLength', type: 'int', title: 'MACD Slow Length', defval: 26 },
  { id: 'signalLength', type: 'int', title: 'MACD Signal Length', defval: 9 },
  { id: 'shortEmaLength', type: 'int', title: 'Short EMA Length', defval: 9 },
  { id: 'longEmaLength', type: 'int', title: 'Long EMA Length', defval: 21 },
  { id: 'adxLength', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxSmoothing', type: 'int', title: 'ADX Smoothing', defval: 14 },
  { id: 'adxThreshold', type: 'int', title: 'ADX Threshold', defval: 20 },
  { id: 'plusDiThreshold', type: 'int', title: '+DI Threshold', defval: 25 },
  { id: 'minusDiThreshold', type: 'int', title: '-DI Threshold', defval: 25 },
  { id: 'conversionLength', type: 'int', title: 'Ichimoku Conversion Line Length', defval: 9 },
  { id: 'baseLength', type: 'int', title: 'Ichimoku Base Line Length', defval: 26 },
  { id: 'laggingSpan', type: 'int', title: 'Ichimoku Lagging Span Length', defval: 52 },
  { id: 'displacement', type: 'int', title: 'Ichimoku Displacement', defval: 26 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'volumeThreshold', type: 'float', title: 'Volume Increase Threshold (x times avg volume)', defval: 1.5 },
  { id: 'macdWeight', type: 'int', title: 'MACD Weight', defval: 2 },
  { id: 'rsiWeight', type: 'int', title: 'RSI Weight', defval: 2 },
  { id: 'emaWeight', type: 'int', title: 'EMA Weight', defval: 1 },
  { id: 'cloudWeight', type: 'int', title: 'Ichimoku Cloud Weight', defval: 1 },
  { id: 'confidenceLevel', type: 'int', title: 'Confidence Level (%)', defval: 70 },
];

const SPAN_A_COL = String(color.new(color.green, 80));
const SPAN_B_COL = String(color.new(color.red, 80));
const FILL_UP = String(color.new(color.green, 90));
const FILL_DOWN = String(color.new(color.red, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short EMA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Long EMA', color: color.orange, lineWidth: 1 },
  { id: 'plot2', title: 'Leading Span A', color: SPAN_A_COL, lineWidth: 1 },
  { id: 'plot3', title: 'Leading Span B', color: SPAN_B_COL, lineWidth: 1 },
  { id: 'plot4', title: 'Plot', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'TrendMasterPro_Fekonomi',
  shortTitle: 'TrendMasterPro_Fekonomi',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type Sma = ReturnType<typeof taStep.sma>;

interface TmpRun extends BarRunState<Record<string, never>> {
  macd: ReturnType<typeof taStep.macd>;
  rsi: ReturnType<typeof taStep.rsi>;
  shortEmaStep: ReturnType<typeof taStep.ema>;
  longEmaStep: ReturnType<typeof taStep.ema>;
  dmi: ReturnType<typeof taStep.dmi>;
  /** sma(high, len) / sma(low, len) of the conversion, base and lagging lengths */
  smas: Sma[];
  averageVolume: Sma;
  macdLine: number[];
  signalLine: number[];
  shortEma: number[];
  longEma: number[];
  plots: Point[][];
  fillColors: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<TrendMasterProFekonomiInputs>): BarStudy<TmpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const totalWeight = cfg.macdWeight + cfg.rsiWeight + cfg.emaWeight + cfg.cloudWeight;
  const confidence = cfg.confidenceLevel / 100;
  // ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1]; exact comparisons
  const crossover = (a: number[], b: number[], i: number) => i > 0 && a[i] > b[i] && a[i - 1] <= b[i - 1];
  const crossunder = (a: number[], b: number[], i: number) => i > 0 && a[i] < b[i] && a[i - 1] >= b[i - 1];
  return {
    init() {
      const s: TmpRun = {
        macd: taStep.macd(cfg.fastLength, cfg.slowLength, cfg.signalLength), rsi: taStep.rsi(cfg.rsiLength),
        shortEmaStep: taStep.ema(cfg.shortEmaLength), longEmaStep: taStep.ema(cfg.longEmaLength),
        dmi: taStep.dmi(cfg.adxLength, cfg.adxSmoothing), smas: Array.from({ length: 6 }, () => taStep.sma()),
        averageVolume: taStep.sma(), macdLine: [], signalLine: [], shortEma: [], longEma: [],
        plots: Array.from({ length: 5 }, () => []), fillColors: [], markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.macd, s.rsi, s.shortEmaStep, s.longEmaStep, s.dmi, ...s.smas, s.averageVolume];
      s.lists = [s.markers];
      s.series = [s.macdLine, s.signalLine, s.shortEma, s.longEma, ...s.plots, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time as number;
      const close = b.close;
      const volume = b.volume ?? NaN;

      const [macdLine, signalLine] = s.macd.step(close);
      s.macdLine[i] = macdLine;
      s.signalLine[i] = signalLine;
      const rsi = s.rsi.step(close);
      const shortEma = s.shortEmaStep.step(close);
      const longEma = s.longEmaStep.step(close);
      s.shortEma[i] = shortEma;
      s.longEma[i] = longEma;
      // [adx, adx_plus_di, adx_minus_di] = ta.dmi(...): ta.dmi returns [+DI, -DI, ADX]
      const [adx, adxPlusDi, adxMinusDi] = s.dmi.step(b.high, b.low, close);
      const smaHL = (k: number, len: number) => (s.smas[2 * k].step(b.high, len) + s.smas[2 * k + 1].step(b.low, len)) / 2;
      const conversionLine = smaHL(0, cfg.conversionLength);
      const baseLine = smaHL(1, cfg.baseLength);
      const spanA = (conversionLine + baseLine) / 2;
      const spanB = smaHL(2, cfg.laggingSpan);
      const averageVolume = s.averageVolume.step(volume, 20);

      const macdBuy = crossover(s.macdLine, s.signalLine, i);
      const macdSell = crossunder(s.macdLine, s.signalLine, i);
      const rsiBuy = gt(rsi, 50);
      const rsiSell = lt(rsi, 50);
      const emaBuy = crossover(s.shortEma, s.longEma, i);
      const emaSell = crossunder(s.shortEma, s.longEma, i);
      const adxBuy = gt(adx, cfg.adxThreshold) && gt(adxPlusDi, adxMinusDi) && gt(adxPlusDi, cfg.plusDiThreshold);
      const adxSell = gt(adx, cfg.adxThreshold) && gt(adxMinusDi, adxPlusDi) && gt(adxMinusDi, cfg.minusDiThreshold);
      const cloudBuy = gt(close, Math.max(spanA, spanB)) && gt(spanA, spanB);
      const cloudSell = lt(close, Math.min(spanA, spanB)) && lt(spanA, spanB);
      // volume_increase = na(average_volume) ? false : volume > average_volume * volume_threshold and close > open
      const volumeIncrease = isNaN(averageVolume)
        ? false
        : gt(volume, averageVolume * cfg.volumeThreshold) && gt(close, b.open);
      const buyConditions = (macdBuy ? cfg.macdWeight : 0) + (rsiBuy ? cfg.rsiWeight : 0)
        + (emaBuy && adxBuy ? cfg.emaWeight : 0) + (cloudBuy && volumeIncrease ? cfg.cloudWeight : 0);
      const sellConditions = (macdSell ? cfg.macdWeight : 0) + (rsiSell ? cfg.rsiWeight : 0)
        + (emaSell && adxSell ? cfg.emaWeight : 0) + (cloudSell ? cfg.cloudWeight : 0);
      if (ge(buyConditions / totalWeight, confidence)) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue });
      }
      if (ge(sellConditions / totalWeight, confidence)) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue });
      }
      // fill_color = leading_span_a > leading_span_b ? color.new(color.green, 90) : color.new(color.red, 90)
      s.fillColors[i] = gt(spanA, spanB) ? FILL_UP : FILL_DOWN;

      const p = s.plots;
      p[0][i] = { time: t, value: shortEma };
      p[1][i] = { time: t, value: longEma };
      p[2][i] = { time: t, value: spanA };
      p[3][i] = { time: t, value: spanB };
      p[4][i] = { time: t, value: close };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        fills: [{ plot1: 'plot2', plot2: 'plot3', options: { title: 'Plots Background' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendMasterProFekonomiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendMasterProFekonomiInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendMasterProFekonomi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
