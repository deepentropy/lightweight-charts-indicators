/**
 * CVD & Big Trade Detector
 *
 * Splits the bar volume into buy volume ((close - low) / range * volume) and sell volume ((high - close) / range *
 * volume), 0 on a zero range. The cumulative delta (buy - sell) is drawn as floating candles: open = the previous
 * cumulative delta (0 on the first bar), close = the cumulative delta, high / low = the larger / smaller of both;
 * up colour when close >= open. A big buy (sell) is a buy (sell) volume above the SMA + mult * stdev of the
 * previous `lookback` bars of that volume: a circle at the candle close.
 *
 * Reference: "Big Trade CVD (Floating Bars)" by colacorn
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HK
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CvdBigTradeDetectorInputs {
  /** SMA / stdev length of the big trade thresholds */
  btLookback: number;
  /** Threshold: SMA + this * stdev */
  btMult: number;
  /** Candle colour when the CVD rises or stays */
  cvdUpColor: string;
  /** Candle colour when the CVD falls */
  cvdDownColor: string;
  /** Big buy marker colour */
  btBuyColor: string;
  /** Big sell marker colour */
  btSellColor: string;
}

export const defaultInputs: CvdBigTradeDetectorInputs = {
  btLookback: 50,
  btMult: 2.0,
  // input.color(color.new(color.teal, 10)): the input stores alpha 0.9, byte 230
  cvdUpColor: '#089981E6',
  cvdDownColor: '#880E4FE6',
  btBuyColor: '#00E676',
  btSellColor: '#F23645',
};

export const inputConfig: InputConfig[] = [
  { id: 'btLookback', type: 'int', title: 'Lookback Period', defval: 50, min: 10 },
  { id: 'btMult', type: 'float', title: 'Sensitivity (Sigma)', defval: 2.0, min: 1.0, step: 0.1 },
  { id: 'cvdUpColor', type: 'color', title: 'CVD Up Color', defval: '#089981E6' },
  { id: 'cvdDownColor', type: 'color', title: 'CVD Down Color', defval: '#880E4FE6' },
  { id: 'btBuyColor', type: 'color', title: 'Big Buy Marker', defval: '#00E676' },
  { id: 'btSellColor', type: 'color', title: 'Big Sell Marker', defval: '#F23645' },
];

// No plot(): the outputs are the CVD candles and the big trade markers
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [{ id: 'cvd', title: 'CVD Floating Bars' }];

export const metadata = {
  title: 'Big Trade CVD (Floating Bars)',
  shortTitle: 'IOM CVD Float',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> };

interface CvdVars {
  /** ta.sma(...)[1] + ta.stdev(...)[1] * bt_mult of the bar before */
  threshBuy: number;
  threshSell: number;
}

interface CvdRun extends BarRunState<CvdVars> {
  cum: ReturnType<typeof taStep.cum>;
  avgBuy: WindowSma;
  stdBuy: WindowStdev;
  avgSell: WindowSma;
  stdSell: WindowStdev;
  cvd: number[];
  candles: PlotCandleData[];
  markers: MarkerData[];
}

function study(inputs: Partial<CvdBigTradeDetectorInputs>): BarStudy<CvdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: CvdRun = {
        cum: taStep.cum(),
        avgBuy: new WindowSma(cfg.btLookback),
        stdBuy: new WindowStdev(cfg.btLookback),
        avgSell: new WindowSma(cfg.btLookback),
        stdSell: new WindowStdev(cfg.btLookback),
        cvd: [], candles: [], markers: [],
        steps: [], vars: { threshBuy: NaN, threshSell: NaN }, lists: [], series: [],
      };
      s.steps = [s.cum, s.avgBuy, s.stdBuy, s.avgSell, s.stdSell];
      s.lists = [s.markers];
      s.series = [s.cvd, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const range = b.high - b.low;
      const volume = b.volume ?? NaN;
      const rawBuy = eq(range, 0) ? 0 : ((b.close - b.low) / range) * volume;
      const rawSell = eq(range, 0) ? 0 : ((b.high - b.close) / range) * volume;
      const cvdClose = s.cum.step(rawBuy - rawSell);
      s.cvd[i] = cvdClose;
      const t = b.time;
      const cvdOpen = i > 0 && !isNaN(s.cvd[i - 1]) ? s.cvd[i - 1] : 0; // na(cvd[1]) ? 0 : cvd[1]
      const cvdHigh = Math.max(cvdOpen, cvdClose);
      const cvdLow = Math.min(cvdOpen, cvdClose);
      const col = ge(cvdClose, cvdOpen) ? cfg.cvdUpColor : cfg.cvdDownColor;
      // plotcandle(cvd_open, cvd_high, cvd_low, cvd_close, color = wickcolor = bordercolor = bar_color)
      s.candles[i] = { time: t, open: cvdOpen, high: cvdHigh, low: cvdLow, close: cvdClose, color: col, wickColor: col, borderColor: col };

      // thresholds from the previous bar: ta.sma(...)[1] + ta.stdev(...)[1] * bt_mult
      const threshBuy = v.threshBuy;
      const threshSell = v.threshSell;
      v.threshBuy = s.avgBuy.step(rawBuy) + s.stdBuy.step(rawBuy) * cfg.btMult;
      v.threshSell = s.avgSell.step(rawSell) + s.stdSell.step(rawSell) * cfg.btMult;
      // plotshape(is_bt_buy ? cvd_close : na, shape.circle, location.absolute, c_bt_buy, size.tiny)
      if (gt(rawBuy, threshBuy) && !isNaN(cvdClose)) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: cvdClose, shape: 'circle', color: cfg.btBuyColor, size: 'tiny', id: 'shape0' });
      }
      if (gt(rawSell, threshSell) && !isNaN(cvdClose)) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: cvdClose, shape: 'circle', color: cfg.btSellColor, size: 'tiny', id: 'shape1' });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        plotCandles: { cvd: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CvdBigTradeDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CvdBigTradeDetectorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; plotCandles: Record<string, PlotCandleData[]> } {
  return fullResult(createRun(inputs).update(bars));
}

export const CvdBigTradeDetector = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
