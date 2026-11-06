/**
 * RSI-50 Step Line
 *
 * A step line on the price: the close of the last bar where the RSI crossed 50 (either direction); it stays flat
 * until the next cross. The line and the cross circles have one of four colours: close above the level with the
 * RSI rising / falling, close at or below the level with the RSI falling / rising.
 *
 * Reference: "RSI-50 Step Line" by Devjames
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Devjames
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface Rsi50StepLineInputs {
  rsiLength: number;
  rsiSource: SourceType;
  /** Line width (the plot width is static: the default width 2 is drawn) */
  lineWidth: number;
  /** Above + Rising (bullish, strengthening) */
  colorAboveRising: string;
  /** Above + Falling (bullish, fading) */
  colorAboveFalling: string;
  /** Below + Falling (bearish, strengthening) */
  colorBelowFalling: string;
  /** Below + Rising (bearish, recovering) */
  colorBelowRising: string;
}

export const defaultInputs: Rsi50StepLineInputs = {
  rsiLength: 9,
  rsiSource: 'close',
  lineWidth: 2,
  colorAboveRising: '#00FF00',
  colorAboveFalling: '#006400',
  colorBelowFalling: '#FF0000',
  colorBelowRising: '#8B0000',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 9, min: 1 },
  { id: 'rsiSource', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 2, min: 1, max: 5 },
  { id: 'colorAboveRising', type: 'color', title: 'Above + Rising (Bullish, Strengthening)', defval: '#00FF00' },
  { id: 'colorAboveFalling', type: 'color', title: 'Above + Falling (Bullish, Fading)', defval: '#006400' },
  { id: 'colorBelowFalling', type: 'color', title: 'Below + Falling (Bearish, Strengthening)', defval: '#FF0000' },
  { id: 'colorBelowRising', type: 'color', title: 'Below + Rising (Bearish, Recovering)', defval: '#8B0000' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI-50 Level', color: '#00FF00', lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'RSI-50 Step Line',
  shortTitle: 'RSI-50 Step Line',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface Rsi50Vars {
  /** var float level = na */
  level: number;
  /** rsiValue[1] */
  prev: number;
}

interface Rsi50Run extends BarRunState<Rsi50Vars> {
  rsi: ReturnType<typeof taStep.rsi>;
  plot0: { time: number; value: number; color: string }[];
  markers: MarkerData[];
}

function study(inputs: Partial<Rsi50StepLineInputs>): BarStudy<Rsi50Run, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.rsiSource);
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(cfg.rsiLength);
      const s: Rsi50Run = { rsi, plot0: [], markers: [], steps: [rsi], vars: { level: NaN, prev: NaN }, lists: [], series: [] };
      s.lists = [s.markers];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const close = bars[i].close;
      const r = s.rsi.step(value(bars[i])) ?? NaN;
      // ta.cross(rsiValue, 50): (a[1] <= 50 and a > 50) or (a[1] >= 50 and a < 50), compared exactly (no 1e-10
      // tolerance; na compares false)
      const prev = i > 0 ? v.prev : NaN;
      const crossed = (prev <= 50 && r > 50) || (prev >= 50 && r < 50);
      if (crossed) v.level = close;
      const level = v.level;
      const above = gt(close, level);
      const rising = gt(r, prev);
      const stateColor = above && rising ? cfg.colorAboveRising
        : above && !rising ? cfg.colorAboveFalling
          : !above && !rising ? cfg.colorBelowFalling
            : cfg.colorBelowRising;
      s.plot0[i] = { time: bars[i].time, value: level, color: stateColor };
      // plotshape(crossed ? close : na, style = shape.circle, location = location.absolute, size = size.tiny)
      if (crossed) {
        s.markers.push({ time: bars[i].time, position: 'atPriceMiddle', price: close, shape: 'circle', color: stateColor, size: 'tiny' });
      }
      v.prev = r;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Rsi50StepLineInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<Rsi50StepLineInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const Rsi50StepLine = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
