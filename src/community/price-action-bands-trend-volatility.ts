/**
 * Price Action Bands | Trend & Volatility
 *
 * A trend baseline (moving average of the close, HMA 200 by default) and its EMA signal line, cyan when the baseline is
 * at or above the signal and orange below. Four bands: EMA(EMA(baseline, period) +- width * multiplier, band smoothing)
 * with the width the stdev of the baseline (or the ATR) and the inner / outer multipliers. Gradient fills run from each
 * band to the midline of its inner / outer pair, and a cyan / orange fill shows the trend state between the baseline
 * and the signal.
 *
 * Reference: "Price Action Bands | Trend & Volatility [RadixAlgo]" by RadixAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © radixalgo
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface PriceActionBandsTrendVolatilityInputs {
  /** Moving average type of the trend baseline */
  maType: 'SMA' | 'EMA' | 'HMA' | 'RMA' | 'WMA' | 'SWMA' | 'VWMA';
  /** Moving average period */
  maPeriod: number;
  /** EMA length of the trend signal line */
  trendSmoothing: number;
  /** Band width: ATR or stdev of the baseline */
  bandMethod: 'ATR' | 'Standard Deviation';
  atrPeriod: number;
  sdPeriod: number;
  /** EMA length of the bands */
  bandSmoothing: number;
  innerMult: number;
  outerMult: number;
}

export const defaultInputs: PriceActionBandsTrendVolatilityInputs = {
  maType: 'HMA',
  maPeriod: 200,
  trendSmoothing: 21,
  bandMethod: 'Standard Deviation',
  atrPeriod: 21,
  sdPeriod: 200,
  bandSmoothing: 200,
  innerMult: 2.5,
  outerMult: 3.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'Moving Average Type', defval: 'HMA', options: ['SMA', 'EMA', 'HMA', 'RMA', 'WMA', 'SWMA', 'VWMA'] },
  { id: 'maPeriod', type: 'int', title: 'Moving Average Period', defval: 200 },
  { id: 'trendSmoothing', type: 'int', title: 'Trend Smoothing Period', defval: 21 },
  { id: 'bandMethod', type: 'string', title: 'Band Method', defval: 'Standard Deviation', options: ['ATR', 'Standard Deviation'] },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 21 },
  { id: 'sdPeriod', type: 'int', title: 'Standard Deviation Period', defval: 200 },
  { id: 'bandSmoothing', type: 'int', title: 'Band Smoothing Period', defval: 200 },
  { id: 'innerMult', type: 'float', title: 'Inner Band Multiplier', defval: 2.5, step: 0.1 },
  { id: 'outerMult', type: 'float', title: 'Outer Band Multiplier', defval: 3.5, step: 0.1 },
];

const BULL = '#00e5ff';
const BEAR = '#ffae00';
const GREEN = '#39FF14';
const RED = '#ff0055';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Baseline', color: BULL, lineWidth: 2 },
  { id: 'plot1', title: 'Trend Signal', color: BULL, lineWidth: 2 },
  { id: 'plot2', title: 'Lower Inner Band', color: GREEN, lineWidth: 2 },
  { id: 'plot3', title: 'Lower Outer Band', color: GREEN, lineWidth: 2 },
  { id: 'plot4', title: 'Upper Inner Band', color: RED, lineWidth: 2 },
  { id: 'plot5', title: 'Upper Outer Band', color: RED, lineWidth: 2 },
  { id: 'plot6', title: 'Upper Band Midline', color: 'transparent', lineWidth: 1 },
  { id: 'plot7', title: 'Lower Band Midline', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Price Action Bands | Trend & Volatility [RadixAlgo]',
  shortTitle: 'RadixAlgo | PAB',
  overlay: true,
};

/** Pine a >= b: not (b - a > 1e-10); na compares false */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);

type Point = { time: number; value: number; color: string };
type Step = { step(v: number, volume: number): number; commit(): void };

interface PabRun extends BarRunState<Record<string, never>> {
  baseMa: Step | null;
  sd: ReturnType<typeof taStep.stdev> | null;
  atr: ReturnType<typeof taStep.atr> | null;
  emaBase: ReturnType<typeof taStep.ema>;
  bands: ReturnType<typeof taStep.ema>[];
  signalMa: ReturnType<typeof taStep.ema>;
  signal21Ma: ReturnType<typeof taStep.ema>;
  /** highUp, lowUp, highDown, lowDown, upAvg, downAvg */
  vals: number[][];
  lines: Point[][];
  trendFill: string[];
}

function study(inputs: Partial<PriceActionBandsTrendVolatilityInputs>): BarStudy<PabRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const MAP = cfg.maPeriod;
  // float Base = switch MAT (a constant input: the selected branch runs on every bar)
  const baseStep = (): Step | null => {
    switch (cfg.maType) {
      case 'SMA': { const m = taStep.sma(); return { step: (v) => m.step(v, MAP), commit: () => m.commit() }; }
      case 'EMA': return taStep.ema(MAP);
      case 'HMA': return taStep.hma(MAP);
      case 'RMA': return taStep.rma(MAP);
      case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, MAP), commit: () => m.commit() }; }
      case 'VWMA': return taStep.vwma(MAP);
      // SWMA: ta.swma(close) from the closes of the bars; no case matched: na
      default: return null;
    }
  };
  const isSwma = cfg.maType === 'SWMA';
  const isSd = cfg.bandMethod === 'Standard Deviation';
  const outer = cfg.outerMult;
  const inner = cfg.innerMult;
  return {
    init() {
      const baseMa = baseStep();
      const sd = isSd ? taStep.stdev() : null;
      const atr = isSd ? null : taStep.atr(cfg.atrPeriod);
      const emaBase = taStep.ema(MAP);
      const bands = [0, 1, 2, 3].map(() => taStep.ema(cfg.bandSmoothing));
      const signalMa = taStep.ema(cfg.trendSmoothing);
      const signal21Ma = taStep.ema(21);
      const steps: Committable[] = [...(baseMa ? [baseMa] : []), ...(sd ? [sd] : []), ...(atr ? [atr] : []), emaBase, ...bands, signalMa, signal21Ma];
      const s: PabRun = {
        baseMa, sd, atr, emaBase, bands, signalMa, signal21Ma,
        vals: Array.from({ length: 6 }, () => []), lines: Array.from({ length: 8 }, () => []), trendFill: [],
        steps, vars: {}, lists: [], series: [],
      };
      s.series = [...s.vals, ...s.lines, s.trendFill];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      let base: number;
      if (s.baseMa) base = s.baseMa.step(b.close, b.volume ?? NaN);
      else if (isSwma) base = i < 3 ? NaN : (b.close + 2 * bars[i - 1].close + 2 * bars[i - 2].close + bars[i - 3].close) / 6;
      else base = NaN;
      const width = s.sd ? s.sd.step(base, cfg.sdPeriod) : s.atr!.step(b.high, b.low, b.close);
      const emaBase = s.emaBase.step(base);
      const highUp = s.bands[0].step(emaBase + 1 * width * outer);
      const lowUp = s.bands[1].step(emaBase + 1 * width * inner);
      const highDown = s.bands[2].step(emaBase + -1 * width * outer);
      const lowDown = s.bands[3].step(emaBase + -1 * width * inner);
      const upAvg = (lowUp + highUp) / 2;
      const downAvg = (lowDown + highDown) / 2;
      const v = s.vals;
      v[0][i] = highUp;
      v[1][i] = lowUp;
      v[2][i] = highDown;
      v[3][i] = lowDown;
      v[4][i] = upAvg;
      v[5][i] = downAvg;
      const signal = s.signalMa.step(base);
      // The Trend State fill compares with ta.ema(Base, 21) (a fixed length in the Pine script)
      const signal21 = s.signal21Ma.step(base);
      const trendColor = ge(base, signal) ? BULL : BEAR;
      const l = s.lines;
      l[0][i] = { time, value: base, color: trendColor };
      l[1][i] = { time, value: signal, color: trendColor };
      l[2][i] = { time, value: lowDown, color: GREEN };
      l[3][i] = { time, value: highDown, color: GREEN };
      l[4][i] = { time, value: lowUp, color: RED };
      l[5][i] = { time, value: highUp, color: RED };
      l[6][i] = { time, value: upAvg, color: 'transparent' }; // color = na
      l[7][i] = { time, value: downAvg, color: 'transparent' };
      // fill(BaseLine, BaseLine_MA, color = Base >= ta.ema(Base, 21) ? #00e5ff4f : #ffae0052)
      s.trendFill[i] = ge(base, signal21) ? '#00e5ff4f' : '#ffae0052';
    },
    result(s, bars) {
      const n = bars.length;
      const [highUp, lowUp, highDown, lowDown, upAvg, downAvg] = s.vals;
      const gradient = (top: number[], bottom: number[], topColor: string, bottomColor: string) => ({
        topValue: top.slice(), bottomValue: bottom.slice(), topColor: new Array(n).fill(topColor), bottomColor: new Array(n).fill(bottomColor),
      });
      const plots: Record<string, Point[]> = {};
      s.lines.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          // fill(Lvl_High_Down, Lvl_Down_Avg, High_Down, math.avg(Low_Down, High_Down), #37ff1449, #37ff141a)
          { plot1: 'plot3', plot2: 'plot7', options: { title: 'Lower Outer Zone' },
            gradient: gradient(highDown, downAvg, '#37ff1449', '#37ff141a') },
          { plot1: 'plot2', plot2: 'plot7', options: { title: 'Lower Inner Zone' },
            gradient: gradient(lowDown, downAvg, '#37ff1449', '#37ff141a') },
          { plot1: 'plot5', plot2: 'plot6', options: { title: 'Upper Outer Zone' },
            gradient: gradient(highUp, upAvg, '#ff005565', '#ff005518') },
          { plot1: 'plot4', plot2: 'plot6', options: { title: 'Upper Inner Zone' },
            gradient: gradient(lowUp, upAvg, '#ff005565', '#ff005518') },
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Trend State' }, colors: s.trendFill.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<PriceActionBandsTrendVolatilityInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PriceActionBandsTrendVolatilityInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceActionBandsTrendVolatility = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
