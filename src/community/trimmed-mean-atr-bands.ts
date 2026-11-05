/**
 * Trimmed Mean ATR Bands
 *
 * The trimmed mean of the source over `tmLen` bars: the values are sorted, `floor(tmLen * trimPct / 100)` values
 * are dropped at each end and the rest is averaged. The bands are the trimmed mean +- ATR. The signal turns up when
 * the high goes above the upper band and down when the low goes below the lower band; it colours the candles, and
 * the band on the opposite side of the signal (the upper band in a down signal, the lower band in an up signal) is
 * drawn.
 *
 * Reference: "Trimmed Mean ATR Bands [NJ]" by CryptoNejc
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © CryptoNejc
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrimmedMeanAtrBandsInputs {
  /** Colour the candles */
  displayColCandles: boolean;
  /** Show the bands */
  displayBands: boolean;
  /** Trimmed mean source */
  tmSrc: SourceType;
  /** Trim amount (%) at each end */
  trimPct: number;
  /** Trimmed mean length */
  tmLen: number;
  /** ATR length */
  atrLen: number;
}

export const defaultInputs: TrimmedMeanAtrBandsInputs = {
  displayColCandles: true,
  displayBands: true,
  tmSrc: 'close',
  trimPct: 25,
  tmLen: 66,
  atrLen: 18,
};

export const inputConfig: InputConfig[] = [
  { id: 'displayColCandles', type: 'bool', title: 'Color candles', defval: true, group: '✧ DISPLAY ✧' },
  { id: 'displayBands', type: 'bool', title: 'Show bands', defval: true, group: '✧ DISPLAY ✧' },
  { id: 'tmSrc', type: 'source', title: 'TM source', defval: 'close', group: '✧ CALCULATION ✧' },
  { id: 'trimPct', type: 'int', title: 'Trim amount (%)', defval: 25, min: 0, max: 49, group: '✧ CALCULATION ✧' },
  { id: 'tmLen', type: 'int', title: 'TM length', defval: 66, min: 1, group: '✧ CALCULATION ✧' },
  { id: 'atrLen', type: 'int', title: 'ATR length', defval: 18, min: 1, group: '✧ CALCULATION ✧' },
];

const UP_COL = 'rgb(0, 136, 100)';
const DOWN_COL = 'rgb(120, 0, 32)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper band', color: DOWN_COL, lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Lower band', color: UP_COL, lineWidth: 2, style: 'linebr' },
];

export const metadata = {
  title: 'Trimmed Mean ATR Bands [NJ]',
  shortTitle: 'TMAB',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Pine array.sort(order.ascending): na values go to the end */
const ascending = (a: number, b: number) => (isNaN(a) ? (isNaN(b) ? 0 : 1) : isNaN(b) ? -1 : a - b);

type Point = { time: number; value: number; color: string };

type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };

interface TmabVars {
  /** var int NJ = 0 */
  NJ: number;
}

interface TmabRun extends BarRunState<TmabVars> {
  atr: ReturnType<typeof taStep.atr>;
  src: number[];
  plot0: Point[];
  plot1: Point[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<TrimmedMeanAtrBandsInputs>): BarStudy<TmabRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.tmSrc);
  const { tmLen, trimPct } = cfg;

  // tm(tmSrc, tmLen, trimPct)
  const trimCount = Math.floor((tmLen * trimPct) / 100);
  const last = tmLen - 1 - trimCount;
  const step = last >= trimCount ? 1 : -1; // a Pine for loop counts down when its start is above its end
  const trimmedMean = (src: number[], j: number): number => {
    const values: number[] = [];
    for (let i = 0; i <= tmLen - 1; i++) values.push(j - i >= 0 ? src[j - i] : NaN);
    values.sort(ascending);
    let sum = 0;
    let count = 0;
    for (let i = trimCount; step > 0 ? i <= last : i >= last; i += step) {
      if (i < 0 || i >= values.length) {
        throw new Error(`Index ${i} is out of bounds, array size is ${values.length}`);
      }
      sum += values[i];
      count += 1;
    }
    return sum / count;
  };

  return {
    fullRunReason: () => (isBarSource(cfg.tmSrc) ? null : 'source of another study'),
    init() {
      const atr = taStep.atr(cfg.atrLen);
      const s: TmabRun = {
        atr, src: [], plot0: [], plot1: [], candles: [],
        steps: [atr], vars: { NJ: 0 }, lists: [], series: [],
      };
      s.series = [s.src, s.plot0, s.plot1, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      s.src[i] = value(b) ?? NaN;
      const atr = s.atr.step(b.high, b.low, b.close) ?? NaN;
      const tm = trimmedMean(s.src, i);
      const upperBand = tm + atr;
      const lowerBand = tm - atr;
      let NJ = s.vars.NJ;
      if (gt(b.high, upperBand)) NJ = 1;
      if (lt(b.low, lowerBand)) NJ = -1;
      s.vars.NJ = NJ;
      const sigCol = NJ === 1 ? UP_COL : NJ === -1 ? DOWN_COL : 'transparent';
      // plotcandle(open, high, low, close, "Colored candles", displayColCandles ? sigCol : na, ... ,
      //   display = display.all - display.status_line - display.price_scale)
      const c = cfg.displayColCandles ? sigCol : 'transparent';
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c };
      s.plot0[i] = { time: b.time, value: NJ === -1 && cfg.displayBands ? upperBand : NaN, color: DOWN_COL };
      s.plot1[i] = { time: b.time, value: NJ === 1 && cfg.displayBands ? lowerBand : NaN, color: UP_COL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        plotCandles: { coloredCandles: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrimmedMeanAtrBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrimmedMeanAtrBandsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TrimmedMeanAtrBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
