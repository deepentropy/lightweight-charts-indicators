/**
 * Big Trades Whale Detector [Volume Anomalies]
 *
 * Splits the bar volume into a buy part (close - low) / (high - low) * volume and a sell part
 * (high - close) / (high - low) * volume (0 on a zero range). A part is a big trade when it is above the SMA + k x
 * stdev of the previous `lookback` bars (both taken one bar back), with k = sensitivity (small), sensitivity + 1.5
 * (medium) and sensitivity + 3 (large). Circles of three sizes at the mean of close and low (buys) or of close and
 * high (sells).
 *
 * Reference: "Big Trades Whale Detector [Volume Anomalies] By HK" by colacorn
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © HK
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, PineSize } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BigTradesWhaleDetectorInputs {
  /** Lookback period of the SMA / stdev */
  lookback: number;
  /** Sensitivity (sigma) */
  mult: number;
  buyColor: string;
  sellColor: string;
}

export const defaultInputs: BigTradesWhaleDetectorInputs = {
  lookback: 5,
  mult: 3.0,
  // color.new(color.lime, 20) / color.new(color.red, 20) as input defaults (alpha 0.8)
  buyColor: 'rgba(0, 230, 118, 0.8)',
  sellColor: 'rgba(242, 54, 69, 0.8)',
};

const GROUP = 'Big Trade (Whale) Settings';

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback Period', defval: 5, min: 5, group: GROUP },
  { id: 'mult', type: 'float', title: 'Sensitivity (Sigma)', defval: 3.0, min: 1.0, step: 0.1, group: GROUP,
    tooltip: '2.0 = Signifikant, 4.0 = Extrem.' },
  { id: 'buyColor', type: 'color', title: 'Big Buy Color', defval: 'rgba(0, 230, 118, 0.8)', group: GROUP },
  { id: 'sellColor', type: 'color', title: 'Big Sell Color', defval: 'rgba(242, 54, 69, 0.8)', group: GROUP },
];

/** No plot(): the outputs are the six plotshape circles */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Big Trades Whale Detector [Volume Anomalies] By HK',
  shortTitle: 'Big Trades Detector',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface WhaleVars {
  /** ta.sma(raw, lookback)[1], ta.stdev(raw, lookback)[1] */
  smaBuy: number;
  stdBuy: number;
  smaSell: number;
  stdSell: number;
}

interface WhaleRun extends BarRunState<WhaleVars> {
  smaBuy: WindowSma;
  stdBuy: WindowStdev;
  smaSell: WindowSma;
  stdSell: WindowStdev;
  markers: MarkerData[];
}

function study(inputs: Partial<BigTradesWhaleDetectorInputs>): BarStudy<WhaleRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const sizes: PineSize[] = ['small', 'normal', 'large'];
  // tier 0: t1 and not t2, tier 1: t2 and not t3, tier 2: t3 (t1 / t2 / t3: above avg + std * (mult, mult + 1.5,
  // mult + 3))
  const tier = (raw: number, avg: number, std: number): number => {
    const t1 = gt(raw, avg + std * cfg.mult);
    const t2 = gt(raw, avg + std * (cfg.mult + 1.5));
    const t3 = gt(raw, avg + std * (cfg.mult + 3.0));
    return t3 ? 2 : t2 ? 1 : t1 ? 0 : -1;
  };
  return {
    init() {
      const smaBuy = new WindowSma(cfg.lookback);
      const stdBuy = new WindowStdev(cfg.lookback);
      const smaSell = new WindowSma(cfg.lookback);
      const stdSell = new WindowStdev(cfg.lookback);
      const s: WhaleRun = {
        smaBuy, stdBuy, smaSell, stdSell, markers: [], steps: [smaBuy, stdBuy, smaSell, stdSell],
        vars: { smaBuy: NaN, stdBuy: NaN, smaSell: NaN, stdSell: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { high, low, close, time } = bars[i];
      const volume = bars[i].volume ?? NaN;
      const range = high - low;
      const rawBuy = eq(range, 0) ? 0 : ((close - low) / range) * volume;
      const rawSell = eq(range, 0) ? 0 : ((high - close) / range) * volume;
      if (i >= 1) {
        // ta.sma(raw, lookback)[1], ta.stdev(raw, lookback)[1]
        const b = tier(rawBuy, v.smaBuy, v.stdBuy);
        const t = tier(rawSell, v.smaSell, v.stdSell);
        // plotshape(cond ? math.avg(close, low) : na, shape.circle, location.absolute, c_bt_buy, size); id: the
        // original's output (buys shape0..shape2, sells shape3..shape5 by tier)
        const posBuy = (close + low) / 2;
        const posSell = (close + high) / 2;
        if (b >= 0 && !isNaN(posBuy)) {
          s.markers.push({ time, position: 'atPriceMiddle', price: posBuy, shape: 'circle', color: cfg.buyColor, size: sizes[b], id: `shape${b}` });
        }
        if (t >= 0 && !isNaN(posSell)) {
          s.markers.push({ time, position: 'atPriceMiddle', price: posSell, shape: 'circle', color: cfg.sellColor, size: sizes[t], id: `shape${3 + t}` });
        }
      }
      v.smaBuy = s.smaBuy.step(rawBuy) ?? NaN;
      v.stdBuy = s.stdBuy.step(rawBuy) ?? NaN;
      v.smaSell = s.smaSell.step(rawSell) ?? NaN;
      v.stdSell = s.stdSell.step(rawSell) ?? NaN;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BigTradesWhaleDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BigTradesWhaleDetectorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BigTradesWhaleDetector = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
