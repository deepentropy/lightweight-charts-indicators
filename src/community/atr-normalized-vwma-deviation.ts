/**
 * ATR-Normalized VWMA Deviation (ANVD)
 *
 * dev = (ohlc4 - VWMA(ohlc4, vwmaLen)) / ATR(atrLen). A sell setup is a dev above the upper band that is a new
 * `lookback` high of dev while the high is a new `lookback` high of price (and, with the MAD filter, dev above
 * MAD * multiplier, MAD = SMA of |dev - SMA(dev)|); the buy setup is the mirror. A setup on this bar or on the bar
 * before, with a down (sell) / up (buy) candle on this bar, colours the background. Horizontal lines at 0 and at the
 * bands, with a fill between the bands.
 *
 * Reference: "ATR-Normalized VWMA Deviation" by exploretranspose
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ATRNormalizedVWMADeviationInputs {
  /** Lookback of the extremes (and of the MAD averages) */
  lookback: number;
  /** ATR length */
  atrLen: number;
  /** VWMA length */
  vwmaLen: number;
  /** Upper deviation band */
  upperBand: number;
  /** Lower deviation band */
  lowerBand: number;
  /** Use the MAD filter */
  useMad: boolean;
  /** MAD multiplier */
  madMult: number;
}

export const defaultInputs: ATRNormalizedVWMADeviationInputs = {
  lookback: 100,
  atrLen: 100,
  vwmaLen: 100,
  upperBand: 5.0,
  lowerBand: -5.0,
  useMad: false,
  madMult: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback (extremes)', defval: 100, min: 10, group: 'Core Calculations' },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 100, min: 10, group: 'Core Calculations' },
  { id: 'vwmaLen', type: 'int', title: 'VWMA Length', defval: 100, min: 10, group: 'Core Calculations' },
  { id: 'upperBand', type: 'float', title: 'Upper Deviation Band', defval: 5.0, group: 'Signal Levels' },
  { id: 'lowerBand', type: 'float', title: 'Lower Deviation Band', defval: -5.0, group: 'Signal Levels' },
  { id: 'useMad', type: 'bool', title: 'Use MAD filter', defval: false, group: 'Optional Filters' },
  { id: 'madMult', type: 'float', title: 'MAD multiplier', defval: 1.0, step: 0.1, group: 'Optional Filters' },
];

const DEV_COL = String(color.new('#1C3738', 0));
const MAD_COL = String(color.new('#7D2E68', 0));
const SELL_BG = String(color.new('#F15156', 50));
const BUY_BG = String(color.new('#7FD1B9', 0));
const RANGE_FILL = String(color.new(color.blue, 95));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR-Normalized Deviation', color: DEV_COL, lineWidth: 1 },
  { id: 'plot1', title: 'MAD', color: MAD_COL, lineWidth: 1 },
];

/** hline(0) / hline(upper_band) / hline(lower_band) with the default levels (the result `hlines` carry the inputs) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_upper', price: 5, title: 'Upper Band', color: color.gray, linestyle: 'dashed' },
  { id: 'hline_lower', price: -5, title: 'Lower Band', color: color.gray, linestyle: 'dashed' },
];

/** fill(h_up, h_dn, color.new(color.blue, 95)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_range', plot1: 'hline_upper', plot2: 'hline_lower', color: RANGE_FILL, title: 'Deviation Range' },
];

export const metadata = {
  title: 'ATR-Normalized VWMA Deviation',
  shortTitle: 'ANVD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface AnvdRun extends BarRunState<Record<string, never>> {
  vwma: ReturnType<typeof taStep.vwma>;
  atr: ReturnType<typeof taStep.atr>;
  devMean: ReturnType<typeof taStep.sma>;
  mad: ReturnType<typeof taStep.sma>;
  hiDev: ReturnType<typeof taStep.highest>;
  loDev: ReturnType<typeof taStep.lowest>;
  hiHigh: ReturnType<typeof taStep.highest>;
  loLow: ReturnType<typeof taStep.lowest>;
  hiDevArr: number[];
  loDevArr: number[];
  hiHighArr: number[];
  loLowArr: number[];
  sellSetup: boolean[];
  buySetup: boolean[];
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<ATRNormalizedVWMADeviationInputs>): BarStudy<AnvdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // The averages skip +-infinity like na (Pine): they get NaN
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const vwma = taStep.vwma(cfg.vwmaLen);
      const atr = taStep.atr(cfg.atrLen);
      const devMean = taStep.sma();
      const mad = taStep.sma();
      const hiDev = taStep.highest();
      const loDev = taStep.lowest();
      const hiHigh = taStep.highest();
      const loLow = taStep.lowest();
      const s: AnvdRun = {
        vwma, atr, devMean, mad, hiDev, loDev, hiHigh, loLow,
        hiDevArr: [], loDevArr: [], hiHighArr: [], loLowArr: [], sellSetup: [], buySetup: [], plot0: [], plot1: [],
        bgColors: [],
        steps: [vwma, atr, devMean, mad, hiDev, loDev, hiHigh, loLow], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.hiDevArr, s.loDevArr, s.hiHighArr, s.loLowArr, s.sellSetup, s.buySetup, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const ohlc4 = (b.open + b.high + b.low + b.close) / 4;
      const vwma = s.vwma.step(ohlc4, b.volume ?? NaN);
      const atr = s.atr.step(b.high, b.low, b.close);
      // dev = (ohlc4 - vwma) / ta.atr(atr_len): a plain division (x / 0 is +-infinity, 0 / 0 na)
      const dev = (ohlc4 - vwma) / atr;

      // Mean absolute deviation
      const devMean = s.devMean.step(fin(dev), cfg.lookback);
      const mad = s.mad.step(fin(Math.abs(dev - devMean)), cfg.lookback);

      // Extremes of the previous bar: ta.highest(x, lookback)[1]
      s.hiDevArr[i] = s.hiDev.step(dev, cfg.lookback);
      s.loDevArr[i] = s.loDev.step(dev, cfg.lookback);
      s.hiHighArr[i] = s.hiHigh.step(b.high, cfg.lookback);
      s.loLowArr[i] = s.loLow.step(b.low, cfg.lookback);

      const isHighestDev = i > 0 && gt(dev, s.hiDevArr[i - 1]);
      const isLowestDev = i > 0 && lt(dev, s.loDevArr[i - 1]);
      const isHighestPrice = i > 0 && gt(b.high, s.hiHighArr[i - 1]);
      const isLowestPrice = i > 0 && lt(b.low, s.loLowArr[i - 1]);
      const aboveUpper = gt(dev, cfg.upperBand);
      const belowLower = lt(dev, cfg.lowerBand);
      const madOkHigh = !cfg.useMad || gt(dev, mad * cfg.madMult);
      const madOkLow = !cfg.useMad || lt(dev, -mad * cfg.madMult);
      const sellSetup = isHighestDev && isHighestPrice && aboveUpper && madOkHigh;
      const buySetup = isLowestDev && isLowestPrice && belowLower && madOkLow;
      s.sellSetup[i] = sellSetup;
      s.buySetup[i] = buySetup;

      const downCandle = lt(b.close, b.open);
      const upCandle = gt(b.close, b.open);
      const sellSignal = (sellSetup && downCandle) || (i > 0 && s.sellSetup[i - 1] && downCandle);
      const buySignal = (buySetup && upCandle) || (i > 0 && s.buySetup[i - 1] && upCandle);
      // bgcolor(sell_signal ? color.new(#F15156, 50) : na); bgcolor(buy_signal ? color.new(#7FD1B9, 0) : na):
      // the later call is drawn on top
      if (buySignal) s.bgColors.push({ time: b.time, color: BUY_BG });
      else if (sellSignal) s.bgColors.push({ time: b.time, color: SELL_BG });

      // plot(dev, 'ATR-Normalized Deviation', color.new(#1C3738, 0))
      s.plot0[i] = { time: b.time, value: fin(dev), color: DEV_COL };
      // plot(use_mad ? mad : na, 'MAD', color.new(#7D2E68, 0))
      s.plot1[i] = { time: b.time, value: cfg.useMad ? fin(mad) : NaN, color: MAD_COL };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero', color: color.gray, linestyle: 'dashed' } },
          { value: cfg.upperBand, options: { title: 'Upper Band', color: color.gray, linestyle: 'dashed' } },
          { value: cfg.lowerBand, options: { title: 'Lower Band', color: color.gray, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Deviation Range' },
            colors: new Array<string>(n).fill(RANGE_FILL) },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ATRNormalizedVWMADeviationInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ATRNormalizedVWMADeviationInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}
export const ATRNormalizedVWMADeviation = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
