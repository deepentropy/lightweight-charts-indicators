/**
 * Peak Reversal v3
 *
 * Keltner Channels: a moving average of the close (EMA, SMA, RMA, VWMA or HMA) +- ATR * inner / outer multiplier.
 * Squeeze: the percent rank (over the lookback) of the band width / basis of the signal band; at or below the
 * percentile threshold the inner (or outer, when it is shown) channel is filled with a gradient colour. With the
 * signal band: bars are coloured by the number of bars since the last bar that stayed inside the upper band (high and
 * close at or below it) and since the last bar that stayed inside the lower band, with a gradient that reaches the
 * full colour after the max momentum bars (the lower band colour is drawn over the upper one). Triangles mark the
 * first bar of a high (or close) at or above the upper band and of a low (or close) at or below the lower band; stars
 * mark free bars (low at or above the upper band, high at or below the lower band).
 *
 * Reference: "Peak Reversal v3" by Zettt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zettt 2021
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PeakReversalV3Inputs {
  /** MA type of the Keltner basis */
  maType: 'EMA' | 'SMA' | 'RMA' | 'VMA' | 'HMA';
  /** MA length of the Keltner basis */
  keltnerEMAlength: number;
  /** ATR length of the Keltner bands */
  atrLength: number;
  /** Inner band multiplier */
  innerBandMultiplier: number;
  /** Outer band multiplier */
  outerBandMultiplier: number;
  showMeanEMA: boolean;
  showInnerBand: boolean;
  showOuterBand: boolean;
  /** Only the first signal after a reset */
  showOnlyFirstSignal: boolean;
  /** Band cross triangles */
  showBandCross: boolean;
  /** Free bar stars */
  showFreeBars: boolean;
  /** Bar colours of the mean deviations */
  showDeviations: boolean;
  /** Band used for the signals */
  signalBand: 'Inner' | 'Outer';
  /** Wick (high / low) or close */
  signalSource: 'Wick' | 'Close';
  /** Bars at which the momentum colour reaches its full intensity */
  maxMomentumBars: number;
  upMomentumColor: string;
  downMomentumColor: string;
  showSqueeze: boolean;
  /** Lookback of the band width percent rank */
  squeezeLength: number;
  /** Percentile threshold of the squeeze */
  squeezeThresh: number;
  squeezeColorInput: string;
}

export const defaultInputs: PeakReversalV3Inputs = {
  maType: 'EMA',
  keltnerEMAlength: 20,
  atrLength: 14,
  innerBandMultiplier: 2,
  outerBandMultiplier: 3,
  showMeanEMA: true,
  showInnerBand: true,
  showOuterBand: false,
  showOnlyFirstSignal: true,
  showBandCross: true,
  showFreeBars: false,
  showDeviations: true,
  signalBand: 'Inner',
  signalSource: 'Wick',
  maxMomentumBars: 5,
  upMomentumColor: '#ee5e48',
  downMomentumColor: '#25bc3e',
  showSqueeze: true,
  squeezeLength: 200,
  squeezeThresh: 5.0,
  squeezeColorInput: 'rgba(120, 123, 134, 0.4)',
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA', 'RMA', 'VMA', 'HMA'] },
  { id: 'keltnerEMAlength', type: 'int', title: 'MA Length', defval: 20, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'innerBandMultiplier', type: 'float', title: 'Inner', defval: 2, min: 0.1, step: 0.25 },
  { id: 'outerBandMultiplier', type: 'float', title: 'Outer', defval: 3, min: 0.1, step: 0.25 },
  { id: 'showMeanEMA', type: 'bool', title: 'Show Mean EMA?', defval: true },
  { id: 'showInnerBand', type: 'bool', title: 'Inner Band?', defval: true },
  { id: 'showOuterBand', type: 'bool', title: 'Outer Band?', defval: false },
  { id: 'showOnlyFirstSignal', type: 'bool', title: 'Show Only First Signal', defval: true },
  { id: 'showBandCross', type: 'bool', title: 'Band Crosses?', defval: true },
  { id: 'showFreeBars', type: 'bool', title: 'Free Bars?', defval: false },
  { id: 'showDeviations', type: 'bool', title: 'Show Mean Deviations?', defval: true },
  { id: 'signalBand', type: 'string', title: 'Signal Band', defval: 'Inner', options: ['Inner', 'Outer'] },
  { id: 'signalSource', type: 'string', title: 'Signal Source', defval: 'Wick', options: ['Wick', 'Close'] },
  { id: 'maxMomentumBars', type: 'int', title: 'Max Momentum Bars', defval: 5, min: 1 },
  { id: 'upMomentumColor', type: 'color', title: 'Up', defval: '#ee5e48' },
  { id: 'downMomentumColor', type: 'color', title: 'Down', defval: '#25bc3e' },
  { id: 'showSqueeze', type: 'bool', title: 'Show Squeeze?', defval: true },
  { id: 'squeezeLength', type: 'int', title: 'Lookback', defval: 200, min: 1 },
  { id: 'squeezeThresh', type: 'float', title: 'Percentile', defval: 5.0, min: 0.1, max: 100.0, step: 0.1 },
  { id: 'squeezeColorInput', type: 'color', title: 'Squeeze Color', defval: 'rgba(120, 123, 134, 0.4)' },
];

const MEAN_COLOR = String(color.new('#BB6083', 40));
const INNER_COLOR = String(color.new('#DD8EAD', 30));
const OUTER_COLOR = String(color.new('#DD8EAD', 40));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Keltner Channel EMA (Mean)', color: MEAN_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Inner Upper Band', color: INNER_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Inner Lower Band', color: INNER_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Outer Upper Band', color: OUTER_COLOR, lineWidth: 1 },
  { id: 'plot4', title: 'Outer Lower Band', color: OUTER_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Peak Reversal v3',
  shortTitle: 'Peak Reversal',
  overlay: true,
};

/** Pine float comparisons: a <= b unless a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface PeakVars {
  /** ta.barssince(firstFreeBarUp) / ta.barssince(firstFreeBarDown) */
  numFreeBarsUp: number;
  numFreeBarsDown: number;
  /** longCross[1] / shortCross[1] */
  prevLongCross: boolean;
  prevShortCross: boolean;
}

interface PeakRun extends BarRunState<PeakVars> {
  basis: { step(v: number, volume: number): number; commit(): void } | null;
  atr: ReturnType<typeof taStep.atr>;
  rank: ReturnType<typeof taStep.percentrank>;
  plots: Point[][];
  innerFill: string[];
  outerFill: string[];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<PeakReversalV3Inputs>): BarStudy<PeakRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.keltnerEMAlength;
  const inner = cfg.signalBand === 'Inner';
  const startColor = String(color.new(color.black, 100));
  const upFaint = String(color.new(cfg.upMomentumColor, 80));
  const downFaint = String(color.new(cfg.downMomentumColor, 80));
  const upSignal = String(color.new(cfg.upMomentumColor, 50));
  const downSignal = String(color.new(cfg.downMomentumColor, 50));

  // Keltner basis: only the branch of the selected MA type runs
  const basisStep = (): PeakRun['basis'] => {
    switch (cfg.maType) {
      case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'SMA': { const m = taStep.sma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
      case 'RMA': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'VMA': { const m = taStep.vwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
      case 'HMA': {
        if (len === 1) return null;
        const m = taStep.hma(len);
        return { step: (v) => m.step(v), commit: () => m.commit() };
      }
      default: return { step: () => NaN, commit: () => {} };
    }
  };

  return {
    init() {
      const s: PeakRun = {
        basis: basisStep(), atr: taStep.atr(cfg.atrLength), rank: taStep.percentrank(cfg.squeezeLength),
        plots: Array.from({ length: 5 }, () => []), innerFill: [], outerFill: [], markers: [], barColors: [],
        steps: [],
        vars: { numFreeBarsUp: NaN, numFreeBarsDown: NaN, prevLongCross: false, prevShortCross: false },
        lists: [], series: [],
      };
      s.steps = [...(s.basis ? [s.basis] : []), s.atr, s.rank];
      s.lists = [s.markers, s.barColors];
      s.series = [...s.plots, s.innerFill, s.outerFill];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      if (!s.basis) throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      const basis = s.basis.step(b.close, b.volume ?? NaN);
      const atrRange = s.atr.step(b.high, b.low, b.close);
      const upInner = basis + atrRange * cfg.innerBandMultiplier;
      const downInner = basis - atrRange * cfg.innerBandMultiplier;
      const upOuter = basis + atrRange * cfg.outerBandMultiplier;
      const downOuter = basis - atrRange * cfg.outerBandMultiplier;

      // Squeeze: percent rank of the band width / basis (plain division)
      const bandwidth = inner ? (upInner - downInner) / basis : (upOuter - downOuter) / basis;
      const bandwidthRank = s.rank.step(bandwidth);
      const inSqueeze = le(bandwidthRank, cfg.squeezeThresh);
      const squeezeColor = color.from_gradient(bandwidthRank, 0, cfg.squeezeThresh, cfg.squeezeColorInput, startColor);
      s.innerFill[i] = cfg.showSqueeze && inSqueeze && !cfg.showOuterBand ? squeezeColor : 'transparent';
      s.outerFill[i] = cfg.showSqueeze && inSqueeze && cfg.showOuterBand ? squeezeColor : 'transparent';

      const u = inner ? upInner : upOuter;
      const d = inner ? downInner : downOuter;
      const v = s.vars;

      // Mean deviations
      const firstFreeBarUp = le(b.high, u) && le(b.close, u);
      v.numFreeBarsUp = firstFreeBarUp ? 0 : isNaN(v.numFreeBarsUp) ? NaN : v.numFreeBarsUp + 1;
      const colorBarUp = color.from_gradient(v.numFreeBarsUp, 0, cfg.maxMomentumBars, upFaint, cfg.upMomentumColor);
      const firstFreeBarDown = ge(b.low, d) && ge(b.close, d);
      v.numFreeBarsDown = firstFreeBarDown ? 0 : isNaN(v.numFreeBarsDown) ? NaN : v.numFreeBarsDown + 1;
      const colorBarDown = color.from_gradient(v.numFreeBarsDown, 0, cfg.maxMomentumBars, downFaint, cfg.downMomentumColor);
      // barcolor(Mean Deviations Up) then barcolor(Mean Deviations Down): the later non-na colour is drawn
      const up = cfg.showDeviations && gt(v.numFreeBarsUp, 0) ? colorBarUp : null;
      const down = cfg.showDeviations && gt(v.numFreeBarsDown, 0) ? colorBarDown : null;
      if (up) s.barColors.push({ id: 'barcolor0', time, color: up });
      if (down) s.barColors.push({ id: 'barcolor1', time, color: down });

      // Band crosses (every historical bar is confirmed)
      const longCrossCandle = cfg.signalSource === 'Wick' ? b.high : b.close;
      const shortCrossCandle = cfg.signalSource === 'Wick' ? b.low : b.close;
      const longCross = ge(longCrossCandle, u);
      const shortCross = le(shortCrossCandle, d);
      const showLongCross = cfg.showOnlyFirstSignal ? longCross && !v.prevLongCross : longCross;
      const showShortCross = cfg.showOnlyFirstSignal ? shortCross && !v.prevShortCross : shortCross;
      v.prevLongCross = longCross;
      v.prevShortCross = shortCross;
      if (cfg.showBandCross && showLongCross) {
        s.markers.push({ id: 'shape0', time, position: 'aboveBar', shape: 'triangleDown', color: upSignal, size: 'tiny' });
      }
      if (cfg.showBandCross && showShortCross) {
        s.markers.push({ id: 'shape1', time, position: 'belowBar', shape: 'triangleUp', color: downSignal, size: 'tiny' });
      }

      // Free bars; the Pine source uses the inner lower band for shortFreeBar with both signal bands
      const longFreeBar = ge(b.low, u);
      const shortFreeBar = le(b.high, downInner);
      // plotchar('★', size.tiny): the character as text in the plotchar colour
      if (cfg.showFreeBars && longFreeBar) {
        s.markers.push({ id: 'char2', time, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '★',
          textColor: upSignal, size: 'tiny' });
      }
      if (cfg.showFreeBars && shortFreeBar) {
        s.markers.push({ id: 'char3', time, position: 'belowBar', shape: 'circle', color: 'transparent', text: '★',
          textColor: downSignal, size: 'tiny' });
      }

      s.plots[0][i] = { time, value: cfg.showMeanEMA ? basis : NaN, color: MEAN_COLOR };
      s.plots[1][i] = { time, value: cfg.showInnerBand ? upInner : NaN, color: INNER_COLOR };
      s.plots[2][i] = { time, value: cfg.showInnerBand ? downInner : NaN, color: INNER_COLOR };
      s.plots[3][i] = { time, value: cfg.showOuterBand ? upOuter : NaN, color: OUTER_COLOR };
      s.plots[4][i] = { time, value: cfg.showOuterBand ? downOuter : NaN, color: OUTER_COLOR };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        fills: [
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Inner Band Squeeze Fill' }, colors: s.innerFill.slice() },
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Outer Band Squeeze Fill' }, colors: s.outerFill.slice() },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PeakReversalV3Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PeakReversalV3Inputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const PeakReversalV3 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
