/**
 * Price Above EMA15 with RSI & Uptrend (3 Confirmation Bull)
 *
 * A bullish signal (green label below the bar) when three conditions hold: the close is above its EMA, the RSI is
 * above a threshold, and the bar makes a higher high and a higher low: high > highest(high, lookback)[1] and
 * low > lowest(low, lookback)[1]. Plots the close, the EMA and a hidden RSI line; a dotted horizontal line at the
 * RSI threshold.
 *
 * Reference: "3 Confirmation Bull" by AirianM
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AirianM
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ThreeConfirmationBullInputs {
  /** EMA length */
  emaLength: number;
  /** RSI length */
  rsiLength: number;
  /** RSI threshold: the RSI must be above it */
  rsiThreshold: number;
  /** Lookback of the higher high / higher low test */
  lookback: number;
}

export const defaultInputs: ThreeConfirmationBullInputs = {
  emaLength: 15,
  rsiLength: 14,
  rsiThreshold: 50,
  lookback: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 15, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiThreshold', type: 'int', title: 'RSI Threshold', defval: 50, min: 1 },
  { id: 'lookback', type: 'int', title: 'Uptrend Lookback Period', defval: 5, min: 1 },
];

/** Pine default plot colour */
const PINE_BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: PINE_BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'EMA 15', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'RSI Value', color: color.purple, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Price Above EMA15 with RSI & Uptrend',
  shortTitle: 'Price Above EMA15 with RSI & Uptrend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface ThreeConfirmationBullRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  hh: WindowExtreme;
  ll: WindowExtreme;
  hhArr: number[];
  llArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<ThreeConfirmationBullInputs>): BarStudy<ThreeConfirmationBullRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(cfg.emaLength);
      const rsi = taStep.rsi(cfg.rsiLength);
      const hh = new WindowExtreme(false, cfg.lookback);
      const ll = new WindowExtreme(true, cfg.lookback);
      const s: ThreeConfirmationBullRun = {
        ema, rsi, hh, ll, hhArr: [], llArr: [], plot0: [], plot1: [], plot2: [], markers: [],
        steps: [ema, rsi, hh, ll], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.hhArr, s.llArr, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const ema = s.ema.step(b.close);
      const rsi = s.rsi.step(b.close);
      s.hhArr[i] = s.hh.step(b.high);
      s.llArr[i] = s.ll.step(b.low);
      // isHigherHigh = high > ta.highest(high, lookback)[1]; isHigherLow = low > ta.lowest(low, lookback)[1]
      const prevHh = i > 0 ? s.hhArr[i - 1] : NaN;
      const prevLl = i > 0 ? s.llArr[i - 1] : NaN;
      const isUptrend = gt(b.high, prevHh) && gt(b.low, prevLl);
      const signal = gt(b.close, ema) && gt(rsi, cfg.rsiThreshold) && isUptrend;
      if (signal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, size: 'small' });
      }
      s.plot0[i] = { time: b.time, value: b.close };
      s.plot1[i] = { time: b.time, value: ema };
      s.plot2[i] = { time: b.time, value: rsi };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [{ value: cfg.rsiThreshold, options: { title: 'RSI Threshold', color: color.gray, linestyle: 'dotted' } }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ThreeConfirmationBullInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ThreeConfirmationBullInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const ThreeConfirmationBull = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
