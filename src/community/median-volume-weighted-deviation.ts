/**
 * Median Volume Weighted Deviation
 *
 * A rolling VWAP of the close over `n` bars, sum(close * volume) / sum(volume), and the volume weighted standard
 * deviation of the close around it, sqrt(sum(volume * (close - vwap)^2) / sum(volume)). Bands are the VWAP +- k * the
 * median of that deviation over `m` bars. The close crossing over the upper band gives a long state (yellow-green),
 * crossing under the lower band a short state (purple); the VWAP line, the band fill, the bar colour and the
 * background follow the last signal.
 *
 * Reference: "Median Volume Weighted Deviation" by Burggg
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Burggg
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MedianVolumeWeightedDeviationInputs {
  /** Lookback of the VWAP and of the deviation */
  n: number;
  /** Length of the median of the deviation */
  m: number;
  /** Deviation multiplier */
  k: number;
  /** Colour the bars with the last signal */
  barOn: boolean;
  /** Show the bands */
  bandOn: boolean;
  /** Colour the background with the last signal */
  bgOn: boolean;
}

export const defaultInputs: MedianVolumeWeightedDeviationInputs = {
  n: 14,
  m: 2,
  k: 1.7,
  barOn: true,
  bandOn: false,
  bgOn: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'n', type: 'int', title: 'Lookback', defval: 14, min: 1, group: '~~~~~~ Inputs ~~~~~~' },
  { id: 'm', type: 'int', title: 'Median StDev', defval: 2, min: 1, group: '~~~~~~ Inputs ~~~~~~' },
  { id: 'k', type: 'float', title: 'StDev Multiplier', defval: 1.7, min: 0.1, step: 0.1, group: '~~~~~~ Inputs ~~~~~~' },
  { id: 'barOn', type: 'bool', title: 'Bar Color', defval: true, group: '~~~~~~ Plots ~~~~~~' },
  { id: 'bandOn', type: 'bool', title: 'Bands', defval: false, group: '~~~~~~ Plots ~~~~~~' },
  { id: 'bgOn', type: 'bool', title: 'Background Color', defval: false, group: '~~~~~~ Plots ~~~~~~' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: String(color.new('#999999', 50)), lineWidth: 2, style: 'linebr' },
  { id: 'plot1', title: 'Upper Band', color: 'transparent', lineWidth: 2 },
  { id: 'plot2', title: 'Lower Band', color: 'transparent', lineWidth: 2 },
];

export const metadata = {
  title: 'Median Volume Weighted Deviation',
  shortTitle: 'MVWD',
  overlay: true,
};

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] };

interface MvwdVars {
  score: number; // var score = 0
  bandColor: string | null; // var color bandColor = na
  barColor: string | null; // var color barColor = na
  bgColor: string | null; // var color bgColor = na
}

interface MvwdRun extends BarRunState<MvwdVars> {
  sumClosevol: WindowSum;
  sumVol: WindowSum;
  sumSqDev: WindowSum;
  median: ReturnType<typeof taStep.median>;
  buy: ReturnType<typeof taStep.crossover>;
  sell: ReturnType<typeof taStep.crossunder>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<MedianVolumeWeightedDeviationInputs>): BarStudy<MvwdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const longColor = '#ddff00';
  const shortColor = '#b300ff';
  const neutral = String(color.new('#999999', 50));
  const longBand = String(color.new(longColor, 90));
  const shortBand = String(color.new(shortColor, 90));
  const longBar = String(color.new(longColor, 0));
  const shortBar = String(color.new(shortColor, 0));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: MvwdRun = {
        sumClosevol: new WindowSum(cfg.n),
        sumVol: new WindowSum(cfg.n),
        sumSqDev: new WindowSum(cfg.n),
        median: taStep.median(cfg.m),
        buy: taStep.crossover(),
        sell: taStep.crossunder(),
        plot0: [], plot1: [], plot2: [], fillColors: [], barColors: [], bgColors: [],
        steps: [],
        vars: { score: 0, bandColor: null, barColor: null, bgColor: null },
        lists: [], series: [],
      };
      s.steps = [s.sumClosevol, s.sumVol, s.sumSqDev, s.median, s.buy, s.sell];
      s.lists = [s.barColors, s.bgColors];
      s.series = [s.plot0, s.plot1, s.plot2, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const volume = b.volume ?? NaN;
      // vwapN = math.sum(close * volume, n) / math.sum(volume, n)
      const sumVol = s.sumVol.step(volume);
      const vwapN = s.sumClosevol.step(close * volume) / sumVol;
      // variance = math.sum(volume * math.pow(close - vwapN, 2), n) / sumVol
      const variance = s.sumSqDev.step(volume * Math.pow(close - vwapN, 2)) / sumVol;
      const stdN = Math.sqrt(variance);
      const medianStd = s.median.step(stdN);
      const upper = vwapN + cfg.k * medianStd;
      const lower = vwapN - cfg.k * medianStd;

      // buy = ta.crossover(close, upper); sell = ta.crossunder(close, lower) (exact comparisons)
      const isBuy = s.buy.step(close, upper);
      const isSell = s.sell.step(close, lower);
      const v = s.vars;
      if (isBuy && !isSell) v.score = 1;
      if (isSell) v.score = -1;
      const col = v.score === 1 ? longColor : v.score === -1 ? shortColor : neutral;
      if (isBuy && cfg.bandOn) v.bandColor = longBand;
      if (isSell && cfg.bandOn) v.bandColor = shortBand;
      if (isBuy && cfg.barOn) v.barColor = longBar;
      if (isSell && cfg.barOn) v.barColor = shortBar;
      if (isBuy && cfg.bgOn) v.bgColor = longBand;
      if (isSell && cfg.bgOn) v.bgColor = shortBand;

      const t = b.time as number;
      s.plot0[i] = { time: t, value: fin(vwapN), color: col };
      s.plot1[i] = { time: t, value: cfg.bandOn ? fin(upper) : NaN, color: v.bandColor ?? 'transparent' };
      s.plot2[i] = { time: t, value: cfg.bandOn ? fin(lower) : NaN, color: v.bandColor ?? 'transparent' };
      // fill(upperPlot, lowerPlot, color = color.new(col, 90))
      s.fillColors[i] = String(color.new(col, 90));
      if (v.barColor !== null) s.barColors.push({ time: t, color: v.barColor });
      if (v.bgColor !== null) s.bgColors.push({ time: t, color: v.bgColor });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { title: 'Deviation Zone' }, colors: s.fillColors.slice() }],
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MedianVolumeWeightedDeviationInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MedianVolumeWeightedDeviationInputs> = {},
): IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const MedianVolumeWeightedDeviation = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
