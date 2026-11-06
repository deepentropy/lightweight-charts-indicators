/**
 * Pullback Scalp Trade V2
 *
 * SMA 50 and SMA 200 of the close with a fill between them: green when the close is above the SMA 200, red otherwise.
 * A Supertrend (factor, ATR length) is drawn as an up-trend line (direction < 0) and a down-trend line. A Buy signal
 * marks the bar where the Supertrend turns up (direction < 0 after direction > 0) with the close above the SMA 200;
 * a Sell signal the bar where it turns down with the close below the SMA 200.
 *
 * Reference: "Pullback Scalp Trade V2" by Sinyalbak_App
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PullbackScalpTradeV2Inputs {
  /** ATR length of the Supertrend */
  atrPeriod: number;
  /** ATR factor of the Supertrend */
  factor: number;
}

export const defaultInputs: PullbackScalpTradeV2Inputs = {
  atrPeriod: 10,
  factor: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrPeriod', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 1, min: 0.1, step: 0.1 },
];

const MA50_COLOR = String(color.new(color.red, 50));
const MA200_COLOR = String(color.new(color.green, 50));
const UP_COLOR = String(color.new(color.lime, 70));
const DOWN_COLOR = String(color.new(color.orange, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Medium Trend MA', color: MA50_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Long Trend MA', color: MA200_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'upTrend2', color: UP_COLOR, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'downTrend2', color: DOWN_COLOR, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Pullback Scalp Trade V2',
  shortTitle: 'Pullback Scalp Trade V2',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface PullbackRun extends BarRunState<Record<string, never>> {
  ma50: WindowSma;
  ma200: WindowSma;
  st: ReturnType<typeof taStep.supertrend>;
  dir: number[];
  plots: Point[][];
  fillColors: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<PullbackScalpTradeV2Inputs>): BarStudy<PullbackRun, Result> {
  const { atrPeriod, factor } = { ...defaultInputs, ...inputs };
  const trendUp = String(color.new(color.green, 90));
  const trendDown = String(color.new(color.red, 90));
  return {
    init() {
      const ma50 = new WindowSma(50);
      const ma200 = new WindowSma(200);
      const st = taStep.supertrend(factor, atrPeriod);
      const s: PullbackRun = {
        ma50, ma200, st, dir: [], plots: [[], [], [], []], fillColors: [], markers: [],
        steps: [ma50, ma200, st], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.dir, ...s.plots, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const ma50 = s.ma50.step(b.close);
      const ma200 = s.ma200.step(b.close);
      const [st, dir] = s.st.step(b.high, b.low, b.close);
      s.dir[i] = dir;
      // trendColor = close > ma200 ? color.green : color.red
      s.fillColors[i] = gt(b.close, ma200) ? trendUp : trendDown;
      s.plots[0][i] = { time: b.time, value: ma50, color: MA50_COLOR };
      s.plots[1][i] = { time: b.time, value: ma200, color: MA200_COLOR };
      // supertrend2 := barstate.isfirst ? na : supertrend2
      const st2 = i === 0 ? NaN : st;
      s.plots[2][i] = { time: b.time, value: lt(dir, 0) ? st2 : NaN, color: UP_COLOR };
      s.plots[3][i] = { time: b.time, value: lt(dir, 0) ? NaN : st2, color: DOWN_COLOR };

      const prevDir = i > 0 ? s.dir[i - 1] : NaN;
      const buySignal = lt(dir, 0) && gt(prevDir, 0) && gt(b.close, ma200);
      const sellSignal = gt(dir, 0) && lt(prevDir, 0) && lt(b.close, ma200);
      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'tiny',
          text: 'Buy', textColor: color.lime });
      }
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.orange, size: 'tiny',
          text: 'Sell', textColor: color.orange });
      }
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        // fill(ma50Plot, ma200Plot, color = color.new(trendColor, 90), title = "Trend Zone")
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Trend Zone' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PullbackScalpTradeV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PullbackScalpTradeV2Inputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const PullbackScalpTradeV2 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
