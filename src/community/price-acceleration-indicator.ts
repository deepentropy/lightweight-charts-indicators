/**
 * Price Acceleration Indicator (PAI)
 *
 * velocity = change(src), acceleration = change(velocity), smoothed = EMA(acceleration, smoothing length), drawn as
 * columns: bright green when above zero and rising, dark green when above zero and not rising, bright red when at or
 * below zero and falling, dark red otherwise. Upper / lower trigger lines are 0.3 times the highest / lowest smoothed
 * acceleration over the lookback.
 *
 * Reference: "Price Acceleration Indicator" by PHICAPITALINVESTMENTS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Phi Capital Investments
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PriceAccelerationIndicatorInputs {
  src: SourceType;
  /** EMA length of the acceleration */
  smoothLen: number;
  /** Lookback of the highest / lowest smoothed acceleration */
  lookback: number;
}

export const defaultInputs: PriceAccelerationIndicatorInputs = {
  src: 'close',
  smoothLen: 10,
  lookback: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'smoothLen', type: 'int', title: 'Smoothing Length', defval: 10 },
  { id: 'lookback', type: 'int', title: 'Lookback for Peaks', defval: 100 },
];

const UPPER_COLOR = String(color.new(color.green, 60));
const LOWER_COLOR = String(color.new(color.red, 60));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Acceleration Bars', color: '#00ff00', lineWidth: 2, style: 'columns' },
  { id: 'plot1', title: 'Upper Trigger', color: UPPER_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Trigger', color: LOWER_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Price Acceleration Indicator',
  shortTitle: 'PAI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color?: string };

interface PaiRun extends BarRunState<Record<string, never>> {
  velocity: ReturnType<typeof taStep.change>;
  acceleration: ReturnType<typeof taStep.change>;
  ema: ReturnType<typeof taStep.ema>;
  highest: WindowExtreme;
  lowest: WindowExtreme;
  smoothed: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<PriceAccelerationIndicatorInputs>): BarStudy<PaiRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const velocity = taStep.change();
      const acceleration = taStep.change();
      const ema = taStep.ema(cfg.smoothLen);
      const highest = new WindowExtreme(false, cfg.lookback);
      const lowest = new WindowExtreme(true, cfg.lookback);
      const s: PaiRun = {
        velocity, acceleration, ema, highest, lowest, smoothed: [], plot0: [], plot1: [], plot2: [],
        steps: [velocity, acceleration, ema, highest, lowest], vars: {}, lists: [], series: [],
      };
      s.series = [s.smoothed, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(st, i, bars) {
      const t = bars[i].time;
      const velocity = st.velocity.step(value(bars[i]));
      const acceleration = st.acceleration.step(velocity);
      const s = st.ema.step(acceleration) ?? NaN;
      st.smoothed[i] = s;
      const highest = st.highest.step(s) ?? NaN;
      const lowest = st.lowest.step(s) ?? NaN;
      const prev = i > 0 ? st.smoothed[i - 1] : NaN;
      // smoothed_acc > 0 ? (smoothed_acc > smoothed_acc[1] ? #00ff00 : #006400)
      //                  : (smoothed_acc < smoothed_acc[1] ? #ff0000 : #8b0000)
      const c = gt(s, 0) ? (gt(s, prev) ? '#00ff00' : '#006400') : lt(s, prev) ? '#ff0000' : '#8b0000';
      st.plot0[i] = { time: t, value: fin(s), color: c };
      st.plot1[i] = { time: t, value: fin(highest * 0.3), color: UPPER_COLOR };
      st.plot2[i] = { time: t, value: fin(lowest * 0.3), color: LOWER_COLOR };
    },
    result(st) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: st.plot0.slice(), plot1: st.plot1.slice(), plot2: st.plot2.slice() },
        hlines: [{ value: 0, options: { title: 'Zero Median', color: color.gray, linestyle: 'solid', linewidth: 1 } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceAccelerationIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PriceAccelerationIndicatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceAccelerationIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
