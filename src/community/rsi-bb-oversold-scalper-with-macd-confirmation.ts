/**
 * RSI & BB Oversold Scalper with MACD Confirmation
 *
 * Setup (each filter can be turned off): the lowest Bollinger %b of the last `lookbackBB` bars is below 0, the
 * lowest RSI of the last `lookbackRSI` bars is below 30, and the Double Smoothed Stochastic (Bressert DSS) crosses
 * over its EMA signal below 20. A setup stays active for `validWindow` bars; a MACD line crossing over its signal
 * line while the setup is active gives a buy signal (a label below the bar) and ends the setup.
 *
 * Reference: "RSI & BB Oversold Scalper with MACD Confirmation" by DotGain
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © DotGain
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiBbOversoldScalperWithMacdConfirmationInputs {
  useBB: boolean;
  useRSI: boolean;
  useDSS: boolean;
  lookbackBB: number;
  lookbackRSI: number;
  validWindow: number;
  rsiLen: number;
  bbLen: number;
  bbMult: number;
  dssLen: number;
  dssSmooth: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
}

export const defaultInputs: RsiBbOversoldScalperWithMacdConfirmationInputs = {
  useBB: true,
  useRSI: true,
  useDSS: true,
  lookbackBB: 20,
  lookbackRSI: 10,
  validWindow: 15,
  rsiLen: 14,
  bbLen: 20,
  bbMult: 2.0,
  dssLen: 10,
  dssSmooth: 5,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'useBB', type: 'bool', title: '1. BB%b Filter active?', defval: true, group: 'Filter' },
  { id: 'useRSI', type: 'bool', title: '2. RSI Filter active?', defval: true, group: 'Filter' },
  { id: 'useDSS', type: 'bool', title: '3. DSS Crossover filter active?', defval: true, group: 'Filter' },
  { id: 'lookbackBB', type: 'int', title: 'BB%b Lookback (candles)', defval: 20, group: 'Lookback Periods' },
  { id: 'lookbackRSI', type: 'int', title: 'RSI Lookback (candles)', defval: 10, group: 'Lookback Periods' },
  { id: 'validWindow', type: 'int', title: 'MACD Lookback(candles)', defval: 15, group: 'Lookback Periods' },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, group: 'Relative Strength Index' },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, group: 'Bollinger Bands' },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, group: 'Bollinger Bands' },
  { id: 'dssLen', type: 'int', title: 'DSS P-Period', defval: 10, group: 'Double Smoothed Stochastic' },
  { id: 'dssSmooth', type: 'int', title: 'DSS EMA-Smoothing', defval: 5, group: 'Double Smoothed Stochastic' },
  { id: 'macdFast', type: 'int', title: 'MACD Fast', defval: 12, group: 'Moving Average Convergence Divergence' },
  { id: 'macdSlow', type: 'int', title: 'MACD Slow', defval: 26, group: 'Moving Average Convergence Divergence' },
  { id: 'macdSignal', type: 'int', title: 'MACD Signal', defval: 9, group: 'Moving Average Convergence Divergence' },
];

// Only markers (plotshape): no line plots
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'RSI & BB Oversold Scalper with MACD Confirmation',
  shortTitle: 'Oversold Scalper',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface ScalperVars {
  setupIsActive: boolean;
  barsSinceSetup: number;
}

interface ScalperRun extends BarRunState<ScalperVars> {
  bb: ReturnType<typeof taStep.bb>;
  rsi: ReturnType<typeof taStep.rsi>;
  high_: ReturnType<typeof taStep.highest>;
  low_: ReturnType<typeof taStep.lowest>;
  ema1: ReturnType<typeof taStep.ema>;
  high_2: ReturnType<typeof taStep.highest>;
  low_2: ReturnType<typeof taStep.lowest>;
  dssLine: ReturnType<typeof taStep.ema>;
  dssSig: ReturnType<typeof taStep.ema>;
  macd: ReturnType<typeof taStep.macd>;
  lowestBB: ReturnType<typeof taStep.lowest>;
  lowestRSI: ReturnType<typeof taStep.lowest>;
  dssCross: ReturnType<typeof taStep.crossover>;
  macdCross: ReturnType<typeof taStep.crossover>;
  markers: MarkerData[];
}

function study(inputs: Partial<RsiBbOversoldScalperWithMacdConfirmationInputs>): BarStudy<ScalperRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const buyColor = String(color.new(color.lime, 60));
  return {
    init() {
      const s: ScalperRun = {
        bb: taStep.bb(cfg.bbLen, cfg.bbMult), rsi: taStep.rsi(cfg.rsiLen),
        high_: taStep.highest(), low_: taStep.lowest(), ema1: taStep.ema(cfg.dssSmooth),
        high_2: taStep.highest(), low_2: taStep.lowest(), dssLine: taStep.ema(cfg.dssSmooth), dssSig: taStep.ema(cfg.dssSmooth),
        macd: taStep.macd(cfg.macdFast, cfg.macdSlow, cfg.macdSignal),
        lowestBB: taStep.lowest(), lowestRSI: taStep.lowest(), dssCross: taStep.crossover(), macdCross: taStep.crossover(),
        markers: [],
        steps: [], vars: { setupIsActive: false, barsSinceSetup: 0 }, lists: [], series: [],
      };
      s.steps = [
        s.bb, s.rsi, s.high_, s.low_, s.ema1, s.high_2, s.low_2, s.dssLine, s.dssSig, s.macd, s.lowestBB, s.lowestRSI,
        s.dssCross, s.macdCross,
      ];
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;
      // [_, upper_b, lower_b] = ta.bb(close, bbLen, bbMult): [basis, upper, lower]
      // (the first ta.bb call of the Pine script gives the same values and its result is not used)
      const [, upperB, lowerB] = s.bb.step(c);
      // bbPercentB = (close - lower_b) / (upper_b - lower_b): plain division (x / 0 is +-infinity, 0 / 0 is na)
      const bbPercentB = (c - lowerB) / (upperB - lowerB);

      const rsiVal = s.rsi.step(c);

      // calc_dss(dssLen, dssSmooth): called on every bar
      const high_ = s.high_.step(b.high, cfg.dssLen);
      const low_ = s.low_.step(b.low, cfg.dssLen);
      const delta = high_ - low_;
      const frac = gt(delta, 0) ? ((c - low_) / delta) * 100 : 0;
      const ema1 = s.ema1.step(frac);
      const high_2 = s.high_2.step(ema1, cfg.dssLen);
      const low_2 = s.low_2.step(ema1, cfg.dssLen);
      const delta2 = high_2 - low_2;
      const frac2 = gt(delta2, 0) ? ((ema1 - low_2) / delta2) * 100 : 0;
      const dssLine = s.dssLine.step(frac2);
      const dssSig = s.dssSig.step(dssLine);

      const [macdLine, signalLine] = s.macd.step(c);

      const lowestBB = s.lowestBB.step(bbPercentB, cfg.lookbackBB);
      const lowestRSI = s.lowestRSI.step(rsiVal, cfg.lookbackRSI);
      const dssCross = s.dssCross.step(dssLine, dssSig);
      const macdBullishCross = s.macdCross.step(macdLine, signalLine);

      const v = s.vars;
      const condBB = lt(lowestBB, 0);
      const condRSI = lt(lowestRSI, 30);
      const condDSS = dssCross && lt(dssLine, 20);
      const setupTrigger = (cfg.useBB ? condBB : true) && (cfg.useRSI ? condRSI : true) && (cfg.useDSS ? condDSS : true);

      if (setupTrigger) {
        v.setupIsActive = true;
        v.barsSinceSetup = 0;
      }
      if (v.setupIsActive) v.barsSinceSetup = v.barsSinceSetup + 1;
      if (v.barsSinceSetup > cfg.validWindow) v.setupIsActive = false;

      const buySignal = v.setupIsActive && macdBullishCross;
      if (buySignal) {
        v.setupIsActive = false;
        v.barsSinceSetup = 0;
        // plotshape(buySignal, 'Buy Signal', shape.labelup, location.belowbar, color.new(color.lime, 60), size.small)
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: buyColor, size: 'small' });
      }
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
export function createRun(
  inputs: Partial<RsiBbOversoldScalperWithMacdConfirmationInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RsiBbOversoldScalperWithMacdConfirmationInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiBbOversoldScalperWithMacdConfirmation = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
