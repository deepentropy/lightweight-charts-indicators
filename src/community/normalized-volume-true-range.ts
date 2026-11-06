/**
 * Normalized Volume & True Range
 *
 * The bar range in percent (|close - open| / min(open, close) for "Body", high / low for "High/Low", close / previous
 * close for "Close/Close") is normalized to 0..100 % by an outlier maximum: cumulative average + scale * a one-sided
 * standard deviation (only the values above the cumulative average count; the sum of squares is divided by their
 * count - 1). The volume is normalized the same way, with a scale chosen so that the average volume sits at the same
 * height as the average range (the Baseline). Optional averages of both (a sum over `length` bars, the first value
 * fills the bars before it) and a 100 % line.
 *
 * Reference: "Normalized Volume & True Range" by The_Peaceful_Lizard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © peacefulLizard50262
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type NormalizedVolumeTrueRangeStyle = 'Body' | 'High/Low' | 'Close/Close';

export interface NormalizedVolumeTrueRangeInputs {
  /** Range used as the true range: Body (open / close), High/Low, Close/Close (previous close / close) */
  trStyle: NormalizedVolumeTrueRangeStyle;
  /** Outlier range: the maximum is the average + this many one-sided deviations */
  mainScale: number;
  /** Show the average of the normalized true range (ATR plot) */
  showAtr: boolean;
  atrLength: number;
  /** Show the average of the normalized volume */
  showAverageVolume: boolean;
  volumeLength: number;
  /** Show the Baseline (normalized average volume) */
  showBaseline: boolean;
}

export const defaultInputs: NormalizedVolumeTrueRangeInputs = {
  trStyle: 'Body',
  mainScale: 5,
  showAtr: false,
  atrLength: 14,
  showAverageVolume: false,
  volumeLength: 14,
  showBaseline: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'trStyle', type: 'string', title: 'True Range Style', defval: 'Body', options: ['Body', 'High/Low', 'Close/Close'] },
  { id: 'mainScale', type: 'float', title: 'Outlier Range', defval: 5, min: 0.5, step: 0.25 },
  { id: 'showAtr', type: 'bool', title: '', defval: false, inline: 'ATR' },
  { id: 'atrLength', type: 'int', title: 'ATR', defval: 14, min: 2, inline: 'ATR' },
  { id: 'showAverageVolume', type: 'bool', title: '', defval: false, inline: 'Volume' },
  { id: 'volumeLength', type: 'int', title: 'Average Volume', defval: 14, min: 2, inline: 'Volume' },
  { id: 'showBaseline', type: 'bool', title: 'Show Baselines', defval: true },
];

const UP_COLOR = '#089981';
const DOWN_COLOR = '#f23645';
const TR_COLOR = '#fafafa';
const BASELINE_COLOR = '#BAD7F2';

// display = show_baseline / show_atr / show_average_volume ? display.all : display.none:
// PlotConfig `visible` = result.visibility entry
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Normalized Volume', color: UP_COLOR, lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Normalized True Range', color: TR_COLOR, lineWidth: 1, style: 'histogram' },
  { id: 'plot2', title: 'Baseline', color: BASELINE_COLOR, lineWidth: 3, style: 'linebr', visible: 'showBaseline' },
  { id: 'plot3', title: 'ATR', color: color.blue, lineWidth: 3, visible: 'showAtr' },
  { id: 'plot4', title: 'Average Volume', color: color.orange, lineWidth: 3, visible: 'showAverageVolume' },
];

export const metadata = {
  title: 'Normalized Volume & True Range',
  shortTitle: 'Normalized Volume & True Range',
  overlay: false,
  format: 'percent',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine na(): na and +-infinity */
const isNa = (x: number) => !Number.isFinite(x);
/** Pine math.min: na when an argument is na (an infinite argument takes part) */
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const finite = (x: number) => (Number.isFinite(x) ? x : NaN);

/** p_stdev(source, average): one-sided deviation of the values above the average (var state per call site) */
interface PStdevState {
  p: number;
  vari: number;
  count: number;
}

function pStdev(st: PStdevState, s: number, average: number): number {
  if (gt(s, average)) {
    st.vari += Math.pow(s - average, 2);
    st.count += 1;
  }
  if (st.count > 0) st.p = Math.sqrt(st.vari / st.count);
  return st.p;
}

/**
 * sma(source, length): sum of nz(source[i], first_value) for i = 0 .. length - 1, divided by length, once the first
 * non-na source value is seen (0 before it).
 */
interface SmaState {
  firstValue: number;
  ready: boolean;
}

function firstFilledSma(st: SmaState, source: number[], bar: number, length: number): number {
  let sum = 0;
  const s = source[bar]!;
  if (!st.ready && isNa(st.firstValue) && !isNa(s)) {
    st.firstValue = s;
    st.ready = true;
  }
  if (st.ready) {
    for (let i = 0; i <= length - 1; i++) {
      const v = bar - i >= 0 ? source[bar - i]! : NaN;
      sum += isNa(v) ? st.firstValue : v;
    }
  }
  return sum / length;
}

type Result = IndicatorResult & { visibility: Record<string, boolean> };
type Point = { time: number; value: number; color: string };

interface NvtrVars {
  pAbs: PStdevState;
  pVol: PStdevState;
  smaTr: SmaState;
  smaVol: SmaState;
}

interface NvtrRun extends BarRunState<NvtrVars> {
  cumAbs: ReturnType<typeof taStep.cum>;
  cumVol: ReturnType<typeof taStep.cum>;
  trPct: number[];
  volPct: number[];
  plots: Point[][];
}

function study(inputs: Partial<NormalizedVolumeTrueRangeInputs>): BarStudy<NvtrRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const plots: Point[][] = Array.from({ length: 5 }, () => []);
      const s: NvtrRun = {
        cumAbs: taStep.cum(), cumVol: taStep.cum(), trPct: [], volPct: [], plots, steps: [], lists: [], series: [],
        vars: {
          pAbs: { p: NaN, vari: 0, count: -1 }, pVol: { p: NaN, vari: 0, count: -1 },
          smaTr: { firstValue: NaN, ready: false }, smaVol: { firstValue: NaN, ready: false },
        },
      };
      s.steps = [s.cumAbs, s.cumVol];
      s.series = [s.trPct, s.volPct, ...plots];
      return s;
    },
    copyVars: (v) => ({ pAbs: { ...v.pAbs }, pVol: { ...v.pVol }, smaTr: { ...v.smaTr }, smaVol: { ...v.smaVol } }),
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = s.vars;
      // true_range_select(tr_style)
      let start: number;
      let finish: number;
      if (cfg.trStyle === 'High/Low') {
        start = b.low;
        finish = b.high;
      } else if (cfg.trStyle === 'Close/Close') {
        const prev = i > 0 ? bars[i - 1]!.close : NaN;
        start = isNa(prev) ? b.close : prev;
        finish = b.close;
      } else {
        start = b.open;
        finish = b.close;
      }
      const absPercent = Math.abs(finish - start) / min(finish, start);
      const volume = b.volume ?? NaN;

      // cum_avg(source) = ta.cum(source) / (bar_index + 1)
      const avgAbsPercent = s.cumAbs.step(absPercent) / (i + 1);
      const pStdevAbsPercent = pStdev(v.pAbs, absPercent, avgAbsPercent);
      const avgVolume = s.cumVol.step(volume) / (i + 1);
      const pStdevVolume = pStdev(v.pVol, volume, avgVolume);

      const absPercentMax = avgAbsPercent + pStdevAbsPercent * cfg.mainScale;
      const normalizedAvgPercent = avgAbsPercent / absPercentMax;
      const scaleFactor = (avgVolume * (1 - normalizedAvgPercent)) / (normalizedAvgPercent * pStdevVolume);
      const maxVolume = avgVolume + pStdevVolume * scaleFactor;
      const normalizedAbsPercent = min(absPercentMax, absPercent) / absPercentMax;
      const normalizedVolume = min(volume, maxVolume) / maxVolume;
      const normalizedAvgVolume = avgVolume / maxVolume;

      s.trPct[i] = normalizedAbsPercent * 100;
      s.volPct[i] = normalizedVolume * 100;
      const averageNormalTr = firstFilledSma(v.smaTr, s.trPct, i, cfg.atrLength);
      const averageNormalVolume = firstFilledSma(v.smaVol, s.volPct, i, cfg.volumeLength);

      const t = b.time as number;
      const p = s.plots;
      p[0]![i] = { time: t, value: finite(normalizedVolume * 100), color: lt(b.open, b.close) ? UP_COLOR : DOWN_COLOR };
      p[1]![i] = { time: t, value: finite(normalizedAbsPercent * 100), color: TR_COLOR };
      p[2]![i] = { time: t, value: finite(normalizedAvgVolume * 100), color: BASELINE_COLOR };
      p[3]![i] = { time: t, value: finite(averageNormalTr), color: color.blue };
      p[4]![i] = { time: t, value: finite(averageNormalVolume), color: color.orange };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
        plots: { plot0: p[0]!.slice(), plot1: p[1]!.slice(), plot2: p[2]!.slice(), plot3: p[3]!.slice(), plot4: p[4]!.slice() },
        hlines: [{ value: 100, options: { title: '100% Max Line', color: '#787b866e', linestyle: 'dashed' } }],
        visibility: { showBaseline: cfg.showBaseline, showAtr: cfg.showAtr, showAverageVolume: cfg.showAverageVolume },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NormalizedVolumeTrueRangeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<NormalizedVolumeTrueRangeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const NormalizedVolumeTrueRange = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
