/**
 * Peak Reversal v2
 *
 * Three Keltner Channels (EMA of the close +- EMA of the true range * multiplier) with the tight, normal and extreme
 * multipliers. With the selected band set: bars are coloured by the number of bars since the last bar that stayed
 * inside the upper band (high and close at or below it) and since the last bar that stayed inside the lower band
 * (low and close at or above it), in three shades (1-2, 3-5, more than 5 bars; the lower band colour is drawn over
 * the upper one). Triangles mark the first bar of a high at or above the upper band and of a close at or below the
 * lower band; stars mark free bars (low at or above the upper band, high at or below the lower band). Advanced mode
 * swaps the colours and the triangle directions.
 *
 * Reference: "Peak Reversal v2" by Zettt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zettt 2021
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type PeakReversalBands = 'Tight' | 'Normal' | 'Extreme';

export interface PeakReversalV2Inputs {
  /** Keltner Channel EMA length */
  keltnerEMAlength: number;
  /** Tight band multiplier */
  tightKeltnerMultiplier: number;
  /** Normal band multiplier */
  keltnerMultiplier: number;
  /** Extreme band multiplier */
  extremePeakMultiplier: number;
  showMeanEMA: boolean;
  showTightBand: boolean;
  showNormalBand: boolean;
  showExtremeBand: boolean;
  /** Bar colours of the mean deviations */
  showDeviations: boolean;
  /** Band cross triangles */
  showBandCross: boolean;
  /** Free bar stars */
  showFreeBars: boolean;
  /** Swaps the colours and the triangle directions */
  advancedMode: boolean;
  /** Bands used for the crosses, the free bars and the bar colours */
  bandsToUse: PeakReversalBands;
}

export const defaultInputs: PeakReversalV2Inputs = {
  keltnerEMAlength: 21,
  tightKeltnerMultiplier: 1.125,
  keltnerMultiplier: 2.25,
  extremePeakMultiplier: 3.375,
  showMeanEMA: false,
  showTightBand: false,
  showNormalBand: true,
  showExtremeBand: true,
  showDeviations: true,
  showBandCross: true,
  showFreeBars: false,
  advancedMode: false,
  bandsToUse: 'Normal',
};

export const inputConfig: InputConfig[] = [
  { id: 'keltnerEMAlength', type: 'int', title: 'Keltner Channel EMA Length', defval: 21, min: 1 },
  { id: 'tightKeltnerMultiplier', type: 'float', title: 'Keltner Bands Normal Multiplier', defval: 1.125, min: 1 },
  { id: 'keltnerMultiplier', type: 'float', title: 'Keltner Bands Normal Multiplier', defval: 2.25, min: 1 },
  { id: 'extremePeakMultiplier', type: 'float', title: 'Keltner Extreme Multiplier', defval: 3.375, min: 1 },
  { id: 'showMeanEMA', type: 'bool', title: 'Show Mean EMA?', defval: false },
  { id: 'showTightBand', type: 'bool', title: 'Show Tight Band?', defval: false },
  { id: 'showNormalBand', type: 'bool', title: 'Show Normal Band?', defval: true },
  { id: 'showExtremeBand', type: 'bool', title: 'Show Extreme Band?', defval: true },
  { id: 'showDeviations', type: 'bool', title: 'Show Mean Deviations?', defval: true },
  { id: 'showBandCross', type: 'bool', title: 'Show Band Crosses?', defval: true },
  { id: 'showFreeBars', type: 'bool', title: 'Show Free Bars?', defval: false },
  { id: 'advancedMode', type: 'bool', title: 'Advanced Mode', defval: false },
  { id: 'bandsToUse', type: 'string', title: 'Bands to Use For Crosses and Free Bars:', defval: 'Normal', options: ['Tight', 'Normal', 'Extreme'] },
];

const MEAN_COLOR = String(color.new('#BB6083', 40));
const TIGHT_COLOR = String(color.new('#DD8EAD', 30));
const NORMAL_COLOR = String(color.new('#DD8EAD', 40));
const EXTREME_COLOR = String(color.new('#DD8EAD', 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Keltner Channel EMA (Mean)', color: MEAN_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Tight Upper Band', color: TIGHT_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Tight Lower Band', color: TIGHT_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Normal Upper Band', color: NORMAL_COLOR, lineWidth: 1 },
  { id: 'plot4', title: 'Normal Lower Band', color: NORMAL_COLOR, lineWidth: 1 },
  { id: 'plot5', title: 'Extreme Upper Band', color: EXTREME_COLOR, lineWidth: 1 },
  { id: 'plot6', title: 'Extreme Lower Band', color: EXTREME_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Peak Reversal v2',
  shortTitle: 'Peak Reversal v2',
  overlay: true,
};

/** Pine float comparisons: a <= b unless a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface PeakVars {
  /** ta.barssince(firstFreeBarUp), ta.barssince(firstFreeBarDown) */
  sinceUp: number;
  sinceDown: number;
  /** longCross[1], shortCross[1] */
  prevLongCross: boolean;
  prevShortCross: boolean;
}

interface PeakRun extends BarRunState<PeakVars> {
  ma: ReturnType<typeof taStep.ema>;
  tr: ReturnType<typeof taStep.tr>;
  rangeEma: ReturnType<typeof taStep.ema>;
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<PeakReversalV2Inputs>): BarStudy<PeakRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const adv = cfg.advancedMode;
  const shade = (k: number, strong: string, mid: string, weak: string): string | null =>
    (k > 5 ? strong : k > 2 ? mid : k > 0 ? weak : null);
  const upTriangleShape: MarkerData['shape'] = adv ? 'triangleUp' : 'triangleDown';
  const upTriangleColor = adv ? '#81c784' : '#e57373';
  const downTriangleShape: MarkerData['shape'] = adv ? 'triangleDown' : 'triangleUp';
  const downTriangleColor = adv ? '#e57373' : '#81c784';
  const upStarColor = adv ? '#81c784' : '#e57373';
  const downStarColor = adv ? '#e57373' : '#81c784';
  // index of the band pair used for the crosses (-1: none, an if without a matching branch gives false)
  const use = cfg.bandsToUse === 'Tight' ? 0 : cfg.bandsToUse === 'Normal' ? 1 : cfg.bandsToUse === 'Extreme' ? 2 : -1;
  const mults = [cfg.tightKeltnerMultiplier, cfg.keltnerMultiplier, cfg.extremePeakMultiplier];
  const shown = [cfg.showMeanEMA, cfg.showTightBand, cfg.showTightBand, cfg.showNormalBand, cfg.showNormalBand,
    cfg.showExtremeBand, cfg.showExtremeBand];
  const colors = [MEAN_COLOR, TIGHT_COLOR, TIGHT_COLOR, NORMAL_COLOR, NORMAL_COLOR, EXTREME_COLOR, EXTREME_COLOR];
  return {
    init() {
      const s: PeakRun = {
        ma: taStep.ema(cfg.keltnerEMAlength), tr: taStep.tr(false), rangeEma: taStep.ema(cfg.keltnerEMAlength),
        plots: colors.map(() => []), markers: [], barColors: [],
        steps: [], vars: { sinceUp: NaN, sinceDown: NaN, prevLongCross: false, prevShortCross: false },
        lists: [], series: [],
      };
      s.steps = [s.ma, s.tr, s.rangeEma];
      s.lists = [s.markers, s.barColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // ta.kc(close, keltnerEMAlength, mult): EMA of the close +- EMA of the true range * mult
      const middle = s.ma.step(b.close);
      const rangeEma = s.rangeEma.step(s.tr.step(b.high, b.low, b.close));
      const upTight = middle + rangeEma * mults[0];
      const downTight = middle - rangeEma * mults[0];
      const upNormal = middle + rangeEma * mults[1];
      const downNormal = middle - rangeEma * mults[1];
      const upExtreme = middle + rangeEma * mults[2];
      const downExtreme = middle - rangeEma * mults[2];
      const u = use === 0 ? upTight : use === 1 ? upNormal : use === 2 ? upExtreme : NaN;
      const d = use === 0 ? downTight : use === 1 ? downNormal : use === 2 ? downExtreme : NaN;

      // firstFreeBarUp = high <= band and close <= band
      const firstFreeBarUp = le(b.high, u) && le(b.close, u);
      v.sinceUp = firstFreeBarUp ? 0 : isNaN(v.sinceUp) ? NaN : v.sinceUp + 1;
      // firstFreeBarDown = low >= band and close >= band
      const firstFreeBarDown = ge(b.low, d) && ge(b.close, d);
      v.sinceDown = firstFreeBarDown ? 0 : isNaN(v.sinceDown) ? NaN : v.sinceDown + 1;

      // na > k is false: colour na
      const colorBarUp = shade(v.sinceUp, adv ? '#1b5e20' : '#b71c1c', adv ? '#66bb6a' : '#ef5350', adv ? '#a5d6a7' : '#ef9a9a');
      const colorBarDown = shade(v.sinceDown, adv ? '#b71c1c' : '#1b5e20', adv ? '#ef5350' : '#66bb6a', adv ? '#ef9a9a' : '#a5d6a7');
      // barcolor(Mean Deviations Up) then barcolor(Mean Deviations Down): the later non-na colour is drawn
      if (cfg.showDeviations && colorBarUp) s.barColors.push({ id: 'barcolor0', time: b.time, color: colorBarUp });
      if (cfg.showDeviations && colorBarDown) s.barColors.push({ id: 'barcolor1', time: b.time, color: colorBarDown });

      const longCross = ge(b.high, u);
      const shortCross = le(b.close, d);
      // showOnlyFirstSignal = true: cross and not cross[1]
      if (cfg.showBandCross && longCross && !v.prevLongCross) {
        s.markers.push({ id: 'shape0', time: b.time, position: 'aboveBar', shape: upTriangleShape, color: upTriangleColor, size: 'tiny' });
      }
      if (cfg.showBandCross && shortCross && !v.prevShortCross) {
        s.markers.push({ id: 'shape1', time: b.time, position: 'belowBar', shape: downTriangleShape, color: downTriangleColor, size: 'tiny' });
      }
      v.prevLongCross = longCross;
      v.prevShortCross = shortCross;

      // plotchar('★', size.tiny): the character as text in the plotchar colour
      if (cfg.showFreeBars && ge(b.low, u)) {
        s.markers.push({ id: 'char2', time: b.time, position: 'aboveBar', shape: 'circle', color: 'transparent', text: '★',
          textColor: upStarColor, size: 'tiny' });
      }
      if (cfg.showFreeBars && le(b.high, d)) {
        s.markers.push({ id: 'char3', time: b.time, position: 'belowBar', shape: 'circle', color: 'transparent', text: '★',
          textColor: downStarColor, size: 'tiny' });
      }

      const values = s.plots;
      const time = b.time;
      values[0][i] = { time, value: shown[0] ? middle : NaN, color: colors[0] };
      values[1][i] = { time, value: shown[1] ? upTight : NaN, color: colors[1] };
      values[2][i] = { time, value: shown[2] ? downTight : NaN, color: colors[2] };
      values[3][i] = { time, value: shown[3] ? upNormal : NaN, color: colors[3] };
      values[4][i] = { time, value: shown[4] ? downNormal : NaN, color: colors[4] };
      values[5][i] = { time, value: shown[5] ? upExtreme : NaN, color: colors[5] };
      values[6][i] = { time, value: shown[6] ? downExtreme : NaN, color: colors[6] };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PeakReversalV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PeakReversalV2Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PeakReversalV2 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
