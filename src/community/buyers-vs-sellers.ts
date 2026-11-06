/**
 * Buyers vs Sellers
 *
 * Over the last `length` bars, the bodies of the bullish bars (open < close) and of the bearish bars are summed apart,
 * converted to a percent of the ATR and averaged per bar. The average bullish move is drawn above zero, the average
 * bearish move below zero (both filled to the zero line), with an EMA of their sum (the net move). The directional
 * bias is the log of the ratio of the bullish to the bearish average; it colours the background (bullish above the
 * bullish threshold, bearish below the bearish threshold). The ATR and the bias are drawn as transparent lines (values
 * in the status line).
 *
 * Reference: "Buyers vs Sellers" by davorloncarpetrovic
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © davorloncarpetrovic
 */

import { taStep, math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface BuyersVsSellersInputs {
  /** Number of bars in the sums */
  length: number;
  /** ATR length (normalisation of the price changes) */
  atrlength: number;
  /** Bullish bias threshold */
  bullishtreshold: number;
  /** Bearish bias threshold */
  bearishtreshold: number;
  /** EMA length of the net move */
  netmovelength: number;
}

export const defaultInputs: BuyersVsSellersInputs = {
  length: 6,
  atrlength: 288,
  bullishtreshold: 0.0,
  bearishtreshold: 0.0,
  netmovelength: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Number of Bars To Include In The Calculation', defval: 6, group: 'Size of The Data Sample' },
  { id: 'atrlength', type: 'int', title: 'Length of The ATR', defval: 288,
    group: 'Length of The ATR Used For Normalization of The Price Changes' },
  { id: 'bullishtreshold', type: 'float', title: 'Bullish Bias Threshold', defval: 0.0, group: 'Threshold For The Directional Bias' },
  { id: 'bearishtreshold', type: 'float', title: 'Bearish Bias Threshold', defval: 0.0, group: 'Threshold For The Directional Bias' },
  { id: 'netmovelength', type: 'int', title: 'Net Move Average Length', defval: 3,
    group: 'The Average of The Sum of Bullish & Bearish Moves' },
];

const INVISIBLE = String(color.new(color.white, 100));
const BIAS_BULL = String(color.new('#22ab94', 100));
const BIAS_BEAR = String(color.new('#f7525f', 100));
const BULL_FILL = String(color.new('#1848cc', 40));
const BEAR_FILL = String(color.new('#c2185b', 40));
const BULL_BG = String(color.new('#1848cc', 80));
const BEAR_BG = String(color.new('#c2185b', 80));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR - Normalization of Price Movements', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot1', title: 'Directional Bias', color: INVISIBLE, lineWidth: 1 },
  { id: 'plot2', title: 'Zero Line', color: color.gray, lineWidth: 1 },
  { id: 'plot3', title: 'Average Bullish Move', color: '#3179f5', lineWidth: 1 },
  { id: 'plot4', title: 'Average Bearish Move', color: '#ec407a', lineWidth: 1 },
  { id: 'plot5', title: 'The Sum of Bullish & Bearish Moves', color: '#d58a0a', lineWidth: 1 },
];

export const metadata = {
  title: 'Buyers vs Sellers',
  shortTitle: 'Buyers vs Sellers',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface BuyersVsSellersRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  ema: ReturnType<typeof taStep.ema>;
  plots: Point[][];
  bgColors: BgColorData[];
}

function study(inputs: Partial<BuyersVsSellersInputs>): BarStudy<BuyersVsSellersRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, bullishtreshold, bearishtreshold } = cfg;
  return {
    init() {
      const atr = taStep.atr(cfg.atrlength);
      const ema = taStep.ema(cfg.netmovelength);
      const plots: Point[][] = [[], [], [], [], [], []];
      const bgColors: BgColorData[] = [];
      return { atr, ema, plots, bgColors, steps: [atr, ema], vars: {}, lists: [], series: [...plots, bgColors] };
    },
    bar(s, k, bars) {
      const b = bars[k];
      const atr = s.atr.step(b.high, b.low, b.close);
      let bullishsum = 0.0;
      let bearishsum = 0.0;
      for (let i = 0; i <= length - 1; i++) {
        // open[i] - close[i]: na before the first bar; `na < 0` is false, so an na difference goes to the bearish sum
        const difference = k - i >= 0 ? bars[k - i].open - bars[k - i].close : NaN;
        if (lt(difference, 0)) bullishsum = bullishsum + difference;
        else bearishsum = bearishsum + difference;
      }
      const bullishsumcorrect = bullishsum * -1;
      const bearishsumcorrect = bearishsum * -1;
      // plain divisions: x / 0 is +-infinity, 0 / 0 is na (Pine)
      const bullishatr = bullishsumcorrect / (atr / 100);
      const bearishatr = bearishsumcorrect / (atr / 100);
      const bullishaverage = bullishatr / length;
      const bearishaverage = bearishatr / length;
      const bearishaveragepositive = bearishaverage * -1;
      const netmove = bullishaverage + bearishaverage;
      const bias = math.log(bullishaverage / bearishaveragepositive) as number;
      const netmoveaverage = s.ema.step(netmove);

      const time = b.time;
      const bullishbias = gt(bias, bullishtreshold);
      const bearishbias = lt(bias, bearishtreshold);
      const p = s.plots;
      p[0][k] = { time, value: fin(atr), color: INVISIBLE };
      p[1][k] = { time, value: fin(bias), color: bullishbias ? BIAS_BULL : bearishbias ? BIAS_BEAR : INVISIBLE };
      p[2][k] = { time, value: 0, color: color.gray };
      p[3][k] = { time, value: fin(bullishaverage), color: '#3179f5' };
      p[4][k] = { time, value: fin(bearishaverage), color: '#ec407a' };
      p[5][k] = { time, value: fin(netmoveaverage), color: '#d58a0a' };
      // bgcolor(bullishbias ? color.new(#1848cc, 80) : bearishbias ? color.new(#c2185b, 80) : color.new(color.white, 100))
      s.bgColors[k] = { time, color: bullishbias ? BULL_BG : bearishbias ? BEAR_BG : INVISIBLE };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Bullish Move Fill', color: BULL_FILL } },
          { plot1: 'plot2', plot2: 'plot4', options: { title: 'Bearish Move Fill', color: BEAR_FILL } },
        ],
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuyersVsSellersInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BuyersVsSellersInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BuyersVsSellers = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
