/**
 * Big Trades Detector [Volume Anomalies]
 *
 * Splits the bar volume into a buying part ((close - low) / range * volume) and a selling part
 * ((high - close) / range * volume); both are 0 on a zero range. A part is a big trade when it is above the SMA plus
 * `bt_mult` standard deviations of that part over the previous `bt_lookback` bars (SMA and stdev of the previous
 * bar). Three tiers: above mult, above mult + 1.5 and above mult + 3 standard deviations, drawn as small / normal /
 * large circles at the middle of close and low (buys) or of close and high (sells).
 *
 * Reference: "Big Trades Detector [Volume Anomalies] By HF" by Nicolas_Favilla
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface BigTradesDetectorByHfInputs {
  /** Lookback period of the SMA / stdev */
  btLookback: number;
  /** Sensitivity (sigma) */
  btMult: number;
  btBuyColor: string;
  btSellColor: string;
}

export const defaultInputs: BigTradesDetectorByHfInputs = {
  btLookback: 2,
  btMult: 3.0,
  // input.color(color.new(color.lime, 20)) / input.color(color.new(color.red, 20)): alpha 0.8
  btBuyColor: 'rgba(0, 230, 118, 0.8)',
  btSellColor: 'rgba(242, 54, 69, 0.8)',
};

export const inputConfig: InputConfig[] = [
  { id: 'btLookback', type: 'int', title: 'Lookback Period', defval: 2, min: 2 },
  { id: 'btMult', type: 'float', title: 'Sensitivity (Sigma)', defval: 3.0, min: 1.0, step: 0.1 },
  { id: 'btBuyColor', type: 'color', title: 'Big Buy Color', defval: 'rgba(0, 230, 118, 0.8)' },
  { id: 'btSellColor', type: 'color', title: 'Big Sell Color', defval: 'rgba(242, 54, 69, 0.8)' },
];

// Markers only (plotshape)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Big Trades Detector [Volume Anomalies] By HF',
  shortTitle: 'Big Trades Detector',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface BtRun extends BarRunState<Record<string, never>> {
  smaBuyStep: WindowSma;
  stdBuyStep: WindowStdev;
  smaSellStep: WindowSma;
  stdSellStep: WindowStdev;
  smaBuy: number[];
  stdBuy: number[];
  smaSell: number[];
  stdSell: number[];
  markers: MarkerData[];
}

function study(inputs: Partial<BigTradesDetectorByHfInputs>): BarStudy<BtRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const m1 = cfg.btMult;
  const m2 = cfg.btMult + 1.5;
  const m3 = cfg.btMult + 3.0;
  return {
    init() {
      const smaBuyStep = new WindowSma(cfg.btLookback);
      const stdBuyStep = new WindowStdev(cfg.btLookback);
      const smaSellStep = new WindowSma(cfg.btLookback);
      const stdSellStep = new WindowStdev(cfg.btLookback);
      const s: BtRun = {
        smaBuyStep, stdBuyStep, smaSellStep, stdSellStep, smaBuy: [], stdBuy: [], smaSell: [], stdSell: [], markers: [],
        steps: [smaBuyStep, stdBuyStep, smaSellStep, stdSellStep], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.smaBuy, s.stdBuy, s.smaSell, s.stdSell];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vol = b.volume === undefined || b.volume === null ? NaN : b.volume;
      const rangeSize = b.high - b.low;
      const rawBuy = eq(rangeSize, 0) ? 0 : ((b.close - b.low) / rangeSize) * vol;
      const rawSell = eq(rangeSize, 0) ? 0 : ((b.high - b.close) / rangeSize) * vol;
      s.smaBuy[i] = s.smaBuyStep.step(rawBuy);
      s.stdBuy[i] = s.stdBuyStep.step(rawBuy);
      s.smaSell[i] = s.smaSellStep.step(rawSell);
      s.stdSell[i] = s.stdSellStep.step(rawSell);
      if (i < 1) return;

      const t = b.time;
      // ta.sma(...)[1] / ta.stdev(...)[1]: the previous bar
      const avgBuy = s.smaBuy[i - 1];
      const sdBuy = s.stdBuy[i - 1];
      const avgSell = s.smaSell[i - 1];
      const sdSell = s.stdSell[i - 1];
      const buy1 = gt(rawBuy, avgBuy + sdBuy * m1);
      const buy2 = gt(rawBuy, avgBuy + sdBuy * m2);
      const buy3 = gt(rawBuy, avgBuy + sdBuy * m3);
      const sell1 = gt(rawSell, avgSell + sdSell * m1);
      const sell2 = gt(rawSell, avgSell + sdSell * m2);
      const sell3 = gt(rawSell, avgSell + sdSell * m3);
      const posBuy = (b.close + b.low) / 2; // math.avg(close, low)
      const posSell = (b.close + b.high) / 2;
      // plotshape(cond ? price : na, shape.circle, location.absolute, size.small / normal / large)
      // id: the original's output (shape0..shape5 in declaration order)
      const circle = (price: number, c: string, size: 'small' | 'normal' | 'large', id: string) => {
        if (!isNaN(price)) s.markers.push({ time: t, position: 'atPriceMiddle', price, shape: 'circle', color: c, size, id });
      };
      if (buy1 && !buy2) circle(posBuy, cfg.btBuyColor, 'small', 'shape0');
      if (buy2 && !buy3) circle(posBuy, cfg.btBuyColor, 'normal', 'shape1');
      if (buy3) circle(posBuy, cfg.btBuyColor, 'large', 'shape2');
      if (sell1 && !sell2) circle(posSell, cfg.btSellColor, 'small', 'shape3');
      if (sell2 && !sell3) circle(posSell, cfg.btSellColor, 'normal', 'shape4');
      if (sell3) circle(posSell, cfg.btSellColor, 'large', 'shape5');
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
export function createRun(inputs: Partial<BigTradesDetectorByHfInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BigTradesDetectorByHfInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BigTradesDetectorByHf = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
