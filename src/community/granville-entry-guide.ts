/**
 * Granville Entry Guide
 *
 * Three SMAs of the close (short / middle / long). The trend is up when the middle SMA is above the long SMA (and,
 * with the slope condition, both rise); down in the opposite case; the background shows it. A long entry is a pivot
 * low (of the short SMA or of the candle low) confirmed `right bars` later on a bullish candle with a higher close and
 * a rising short SMA, in an uptrend, with the short / middle SMA deviation inside +- the deviation rate on the pivot
 * confirmation bar; a short entry is the mirror with a pivot high. Entries are only shown between the start and stop
 * dates. An optional envelope at +- the deviation rate around the middle SMA.
 *
 * Reference: "Granville Entry Guide" by fightpm
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, PivotStep, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GranvilleEntryGuideInputs {
  /** Start date (UNIX ms, Pine input.time) */
  startDate: number;
  /** Stop date (UNIX ms, Pine input.time) */
  stopDate: number;
  /** Short SMA length */
  len1: number;
  col1: string;
  /** Middle SMA length */
  len2: number;
  col2: string;
  /** Long SMA length */
  len3: number;
  col3: string;
  trendFilter: boolean;
  slopeCondition: boolean;
  showTrend: boolean;
  /** Pivot source: candle low / high or the short SMA */
  source: 'candle' | 'short ma';
  leftBars: number;
  rightBars: number;
  showEntryPoint: boolean;
  deviationFilter: boolean;
  /** Deviation rate (%) */
  deviationRate: number;
  showEnvelope: boolean;
}

export const defaultInputs: GranvilleEntryGuideInputs = {
  startDate: 1672790400000, // timestamp("2023-01-04 00:00")
  stopDate: 253402214400000, // timestamp("9999-12-31 00:00")
  len1: 5,
  col1: color.red,
  len2: 25,
  col2: color.green,
  len3: 75,
  col3: color.blue,
  trendFilter: true,
  slopeCondition: true,
  showTrend: true,
  source: 'short ma',
  leftBars: 3,
  rightBars: 1,
  showEntryPoint: true,
  deviationFilter: true,
  deviationRate: 2.0,
  showEnvelope: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'startDate', type: 'time', title: 'start date', defval: 1672790400000, group: 'period' },
  { id: 'stopDate', type: 'time', title: 'stop date', defval: 253402214400000, group: 'period' },
  { id: 'len1', type: 'int', title: '短期', defval: 5, inline: 'short', group: 'moving average' },
  { id: 'col1', type: 'color', title: '', defval: color.red, inline: 'short', group: 'moving average' },
  { id: 'len2', type: 'int', title: '中期', defval: 25, inline: 'middle', group: 'moving average' },
  { id: 'col2', type: 'color', title: '', defval: color.green, inline: 'middle', group: 'moving average' },
  { id: 'len3', type: 'int', title: '長期', defval: 75, inline: 'long', group: 'moving average' },
  { id: 'col3', type: 'color', title: '', defval: color.blue, inline: 'long', group: 'moving average' },
  { id: 'trendFilter', type: 'bool', title: 'trend filter', defval: true, group: 'trend filter' },
  { id: 'slopeCondition', type: 'bool', title: 'slope condition', defval: true, group: 'trend filter' },
  { id: 'showTrend', type: 'bool', title: 'visible trend', defval: true, group: 'trend filter' },
  { id: 'source', type: 'string', title: 'source', defval: 'short ma', options: ['candle', 'short ma'], group: 'judge dip and retracement' },
  { id: 'leftBars', type: 'int', title: 'left bars', defval: 3, min: 1, display: 'data_window', group: 'judge dip and retracement' },
  { id: 'rightBars', type: 'int', title: 'right bars', defval: 1, min: 1, display: 'data_window', group: 'judge dip and retracement' },
  { id: 'showEntryPoint', type: 'bool', title: 'show entry point', defval: true, group: 'judge dip and retracement' },
  { id: 'deviationFilter', type: 'bool', title: 'deviation filter', defval: true, group: 'deviation filter' },
  { id: 'deviationRate', type: 'float', title: 'deviation rate(%)±', defval: 2.0, min: 0, step: 0.1, display: 'data_window', group: 'deviation filter' },
  { id: 'showEnvelope', type: 'bool', title: 'show envelope', defval: false, group: 'deviation filter' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'short', color: color.red, lineWidth: 2 },
  { id: 'plot1', title: 'middle', color: color.green, lineWidth: 2 },
  { id: 'plot2', title: 'long', color: color.blue, lineWidth: 2 },
  { id: 'plot3', title: 'short slope', color: color.red, lineWidth: 1, display: 'data_window' },
  { id: 'plot4', title: 'middle slope', color: color.green, lineWidth: 1, display: 'data_window' },
  { id: 'plot5', title: 'long slope', color: color.blue, lineWidth: 1, display: 'data_window' },
  { id: 'plot6', title: 'deviation(%)', color: color.black, lineWidth: 1, display: 'data_window' },
  { id: 'plot7', title: 'deviation+', color: String(color.new(color.green, 70)), lineWidth: 1 },
  { id: 'plot8', title: 'deviation-', color: String(color.new(color.green, 70)), lineWidth: 1 },
];

export const metadata = {
  title: 'Granville Entry Guide',
  shortTitle: 'Granville Entry Guide',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface GranvilleRun extends BarRunState<Record<string, never>> {
  sma1: WindowSma;
  sma2: WindowSma;
  sma3: WindowSma;
  pl: PivotStep;
  ph: PivotStep;
  ma1: number[];
  ma2: number[];
  ma3: number[];
  deviation: number[];
  plots: Point[][];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<GranvilleEntryGuideInputs>): BarStudy<GranvilleRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const candle = cfg.source === 'candle';
  // bool(x): false for na and 0
  const bool = (x: number) => !isNaN(x) && x !== 0;
  const bgUp = String(color.new(color.red, 90));
  const bgDown = String(color.new(color.blue, 90));
  const envColor = String(color.new(cfg.col2, 70));
  const plotColors = [cfg.col1, cfg.col2, cfg.col3, cfg.col1, cfg.col2, cfg.col3, color.black, envColor, envColor];
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: GranvilleRun = {
        sma1: new WindowSma(cfg.len1), sma2: new WindowSma(cfg.len2), sma3: new WindowSma(cfg.len3),
        pl: new PivotStep(cfg.leftBars, cfg.rightBars, false), ph: new PivotStep(cfg.leftBars, cfg.rightBars, true),
        ma1: [], ma2: [], ma3: [], deviation: [], plots: plotColors.map(() => []), bgColors: [], markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.sma1, s.sma2, s.sma3, s.pl, s.ph];
      s.lists = [s.bgColors, s.markers];
      s.series = [s.ma1, s.ma2, s.ma3, s.deviation, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const close = b.close;
      const ma1 = s.sma1.step(close);
      const ma2 = s.sma2.step(close);
      const ma3 = s.sma3.step(close);
      // slopeN = ta.change(maN, 1)
      const slope1 = i > 0 ? ma1 - s.ma1[i - 1] : NaN;
      const slope2 = i > 0 ? ma2 - s.ma2[i - 1] : NaN;
      const slope3 = i > 0 ? ma3 - s.ma3[i - 1] : NaN;
      s.ma1[i] = ma1;
      s.ma2[i] = ma2;
      s.ma3[i] = ma3;
      const deviation = ((ma1 - ma2) / ma2) * 100.0;
      s.deviation[i] = deviation;
      const upper = ma2 * (1 + cfg.deviationRate / 100.0);
      const lower = ma2 * (1 - cfg.deviationRate / 100.0);
      const pl = s.pl.step(i, candle ? b.low : ma1);
      const ph = s.ph.step(i, candle ? b.high : ma1);

      const tMs = t * 1000;
      const inDateRange = tMs >= cfg.startDate && tMs <= cfg.stopDate;
      const uptrend = cfg.slopeCondition
        ? gt(ma2, ma3) && gt(slope2, 0) && gt(slope3, 0)
        : gt(ma2, ma3);
      const downtrend = cfg.slopeCondition
        ? lt(ma2, ma3) && lt(slope2, 0) && lt(slope3, 0)
        : lt(ma2, ma3);
      // bgcolor((uptrend and showTrend) ? color.new(color.red, 90) : na); bgcolor((downtrend and showTrend) ? ...blue...)
      // (bgcolor0: the uptrend call, bgcolor1: the downtrend call)
      if (cfg.showTrend && downtrend) s.bgColors.push({ id: 'bgcolor1', time: t, color: bgDown });
      else if (cfg.showTrend && uptrend) s.bgColors.push({ id: 'bgcolor0', time: t, color: bgUp });

      // inRange = math.abs(deviation[rightBars]) < deviationRate
      const devPast = i - cfg.rightBars >= 0 ? s.deviation[i - cfg.rightBars] : NaN;
      const inRange = lt(Math.abs(devPast), cfg.deviationRate);
      const prevClose = i > 0 ? bars[i - 1].close : NaN;
      const dip = bool(pl) && gt(b.close, b.open) && gt(b.close, prevClose) && gt(slope1, 0);
      const trueDip = cfg.deviationFilter ? inRange && dip : dip;
      const longCondition = cfg.trendFilter ? inDateRange && uptrend && trueDip : inDateRange && trueDip;
      const retracement = bool(ph) && lt(b.close, b.open) && lt(b.close, prevClose) && lt(slope1, 0);
      const trueRetracement = cfg.deviationFilter ? inRange && retracement : retracement;
      const shortCondition = cfg.trendFilter
        ? inDateRange && downtrend && trueRetracement
        : inDateRange && trueRetracement;
      if (cfg.showEntryPoint && longCondition) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: color.red, size: 'tiny' });
      }
      if (cfg.showEntryPoint && shortCondition) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'circle', color: color.blue, size: 'tiny' });
      }

      const vals = [
        ma1, ma2, ma3, slope1, slope2, slope3, deviation, cfg.showEnvelope ? upper : NaN, cfg.showEnvelope ? lower : NaN,
      ];
      for (let k = 0; k < vals.length; k++) s.plots[k][i] = { time: t, value: fin(vals[k]), color: plotColors[k] };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        // fill(p1, p2, color.new(col2, 90))
        fills: [{ plot1: 'plot7', plot2: 'plot8', colors: new Array<string>(n).fill(String(color.new(cfg.col2, 90))) }],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GranvilleEntryGuideInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GranvilleEntryGuideInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const GranvilleEntryGuide = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
