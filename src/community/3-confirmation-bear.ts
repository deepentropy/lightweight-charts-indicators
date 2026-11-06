/**
 * Price Below EMA15 with RSI & Downtrend (3 Confirmation Bear)
 *
 * A bearish signal (red label above the bar) when three conditions hold: the close is below its EMA, the RSI is
 * below a threshold, and the bar makes a lower high and a lower low: high < highest(high, lookback)[1] and
 * low < lowest(low, lookback)[1]. Plots the EMA and a hidden RSI line; a dotted horizontal line at the RSI threshold.
 *
 * Reference: "3 Confirmation Bear" by AirianM
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AirianM
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface ThreeConfirmationBearInputs {
  /** EMA length */
  emaLength: number;
  /** RSI length */
  rsiLength: number;
  /** RSI threshold: the RSI must be below it */
  rsiThreshold: number;
  /** Lookback of the lower high / lower low test */
  lookback: number;
}

export const defaultInputs: ThreeConfirmationBearInputs = {
  emaLength: 15,
  rsiLength: 14,
  rsiThreshold: 50,
  lookback: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 15, min: 1 },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiThreshold', type: 'int', title: 'RSI Threshold', defval: 50, min: 1 },
  { id: 'lookback', type: 'int', title: 'Downtrend Lookback Period', defval: 5, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 15', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'RSI Value', color: color.purple, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Price Below EMA15 with RSI & Downtrend',
  shortTitle: 'Price Below EMA15 with RSI & Downtrend',
  overlay: true,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface ThreeConfirmationBearRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi>;
  hh: WindowExtreme;
  ll: WindowExtreme;
  hhArr: number[];
  llArr: number[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<ThreeConfirmationBearInputs>): BarStudy<ThreeConfirmationBearRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(cfg.emaLength);
      const rsi = taStep.rsi(cfg.rsiLength);
      const hh = new WindowExtreme(false, cfg.lookback);
      const ll = new WindowExtreme(true, cfg.lookback);
      const s: ThreeConfirmationBearRun = {
        ema, rsi, hh, ll, hhArr: [], llArr: [], plot0: [], plot1: [], markers: [],
        steps: [ema, rsi, hh, ll], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.hhArr, s.llArr, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const ema = s.ema.step(b.close);
      const rsi = s.rsi.step(b.close);
      s.hhArr[i] = s.hh.step(b.high);
      s.llArr[i] = s.ll.step(b.low);
      // isLowerHigh = high < ta.highest(high, lookback)[1]; isLowerLow = low < ta.lowest(low, lookback)[1]
      const prevHh = i > 0 ? s.hhArr[i - 1] : NaN;
      const prevLl = i > 0 ? s.llArr[i - 1] : NaN;
      const isDowntrend = lt(b.high, prevHh) && lt(b.low, prevLl);
      const signal = lt(b.close, ema) && lt(rsi, cfg.rsiThreshold) && isDowntrend;
      if (signal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, size: 'small' });
      }
      s.plot0[i] = { time: b.time, value: ema };
      s.plot1[i] = { time: b.time, value: rsi };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [{ value: cfg.rsiThreshold, options: { title: 'RSI Threshold', color: color.gray, linestyle: 'dotted' } }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ThreeConfirmationBearInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ThreeConfirmationBearInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ThreeConfirmationBear = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
