/**
 * Cabal Dev Indicator
 *
 * A stochastic momentum index (SMI): the close position against the middle of the `Percent K Length` high / low range,
 * rdiff = close - (highest + lowest) / 2, and the range diff = highest - lowest, both smoothed with an EMA of
 * `Percent D Length`; SMI = ema(rdiff) / (ema(diff) / 2) * 100 (0 when ema(diff) is 0 or na). The SMI is smoothed
 * with an SMA of `Smoothing Period` (the "Stochastic" line), and an EMA of `EMA Signal Length` of it is the signal.
 * The parts of the line above the overbought level and below the oversold level are filled.
 *
 * Reference: "Cabal Dev Indicator" by SolanaMemeCoins
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Cabal_Dev_Indicator, Author: Senyor, Release: v2.1
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CabalDevIndicatorInputs {
  /** Length of the highest high / lowest low range */
  percentKLength: number;
  /** EMA length of the range and of the relative position */
  percentDLength: number;
  /** EMA length of the signal line */
  emaSignalLength: number;
  /** SMA length of the SMI */
  smoothingPeriod: number;
  overbought: number;
  oversold: number;
}

export const defaultInputs: CabalDevIndicatorInputs = {
  percentKLength: 15,
  percentDLength: 3,
  emaSignalLength: 15,
  smoothingPeriod: 5,
  overbought: 40,
  oversold: -40,
};

export const inputConfig: InputConfig[] = [
  { id: 'percentKLength', type: 'int', title: 'Percent K Length', defval: 15, min: 1 },
  { id: 'percentDLength', type: 'int', title: 'Percent D Length', defval: 3, min: 1 },
  { id: 'emaSignalLength', type: 'int', title: 'EMA Signal Length', defval: 15, min: 1 },
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 5, min: 1 },
  { id: 'overbought', type: 'float', title: 'Overbought', defval: 40, min: -100, max: 100 },
  { id: 'oversold', type: 'float', title: 'Oversold', defval: -40, min: -100, max: 100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stochastic', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'EMA', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Overbought Level', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Overbought SMI', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Oversold Level', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Oversold SMI', color: color.blue, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Cabal Dev Indicator',
  shortTitle: 'Cabal_Dev_iNDEX',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine `x != y`: false when one side is na, true when they differ by more than 1e-10 */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color?: string };
type Ema = ReturnType<typeof taStep.ema>;

interface CabalRun extends BarRunState<Record<string, never>> {
  lowest: WindowExtreme;
  highest: WindowExtreme;
  avgrel: Ema;
  avgdiff: Ema;
  smoothed: WindowSma;
  signal: Ema;
  plots: Point[][];
}

function study(inputs: Partial<CabalDevIndicatorInputs>): BarStudy<CabalRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const ob = cfg.overbought;
  const os = cfg.oversold;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const obFill = String(color.new(color.red, 60));
  const osFill = String(color.new(color.green, 60));
  return {
    init() {
      const s: CabalRun = {
        lowest: new WindowExtreme(true, cfg.percentKLength), highest: new WindowExtreme(false, cfg.percentKLength),
        avgrel: taStep.ema(cfg.percentDLength), avgdiff: taStep.ema(cfg.percentDLength),
        smoothed: new WindowSma(cfg.smoothingPeriod), signal: taStep.ema(cfg.emaSignalLength),
        plots: [[], [], [], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.lowest, s.highest, s.avgrel, s.avgdiff, s.smoothed, s.signal];
      s.series = [...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Range
      const ll = s.lowest.step(b.low);
      const hh = s.highest.step(b.high);
      const diff = hh - ll;
      const rdiff = b.close - (hh + ll) / 2;
      const avgrel = s.avgrel.step(rdiff);
      const avgdiff = s.avgdiff.step(diff);

      // SMI = avgdiff != 0 ? avgrel / (avgdiff / 2) * 100 : 0.0 (plain division, as Pine)
      const smi = ne(avgdiff, 0) ? (avgrel / (avgdiff / 2)) * 100 : 0.0;
      const smiSmoothed = s.smoothed.step(smi);
      const emaSignal = s.signal.step(smiSmoothed);

      const t = b.time;
      const p = s.plots;
      p[0][i] = { time: t, value: fin(smiSmoothed), color: color.green };
      p[1][i] = { time: t, value: fin(emaSignal), color: color.red };
      // level_obsmi = SMI_smoothed > ob ? SMI_smoothed : ob; level_ossmi = SMI_smoothed < os ? SMI_smoothed : os
      p[2][i] = { time: t, value: ob };
      p[3][i] = { time: t, value: fin(gt(smiSmoothed, ob) ? smiSmoothed : ob) };
      p[4][i] = { time: t, value: os };
      p[5][i] = { time: t, value: fin(lt(smiSmoothed, os) ? smiSmoothed : os) };
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(), plot5: p[5].slice() },
        hlines: [
          { value: ob, options: { title: 'Overbought', color: color.gray, linestyle: 'dashed' } },
          { value: os, options: { title: 'Oversold', color: color.gray, linestyle: 'dashed' } },
        ],
        fills: [
          // fill(p1, p2, color = color.new(color.red, 60), title = 'OverBought')
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'OverBought' }, colors: new Array<string>(n).fill(obFill) },
          // fill(p3, p4, color = color.new(color.green, 60), title = 'OverSold')
          { plot1: 'plot4', plot2: 'plot5', options: { title: 'OverSold' }, colors: new Array<string>(n).fill(osFill) },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CabalDevIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CabalDevIndicatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const CabalDevIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
