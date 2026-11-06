/**
 * Median ATR SD Oscillator
 *
 * Median = 50th percentile (nearest rank) of the source over the median length. Upper SD level = median +
 * stdev(close, SD length); ATR level = median + ATR(ATR length) * factor. The trend turns 1 when the close is above
 * the SD level and -1 when it is below the ATR level (the second rule wins on the same bar). The oscillator is
 * close - ATR level in an up trend, else close - SD level, with an EMA. The hold state is 1 / -1 when the trend
 * agrees with the oscillator position against its EMA (or with the trend alone when the EMA filter is off), and
 * colours the area, the bars and an optional background on the price pane.
 *
 * Reference: "Median ATR SD Oscillator" by Unknownhodler
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Unknownhodler
 */

import { taCore, taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MedianAtrSdOscillatorInputs {
  /** Source of the median */
  medSrc: SourceType;
  /** Median length */
  medLen: number;
  /** ATR length */
  atrLen: number;
  /** ATR factor */
  atrFactor: number;
  /** Standard deviation length */
  sdLen: number;
  /** EMA filter of the hold state */
  useEma: boolean;
  /** EMA length */
  emaLen: number;
  /** Colour the bars */
  barColoring: boolean;
  /** Colour the background of the price pane */
  ShowBGCol: boolean;
  /** Background transparency */
  Transparency: number;
}

export const defaultInputs: MedianAtrSdOscillatorInputs = {
  medSrc: 'hl2',
  medLen: 63,
  atrLen: 4,
  atrFactor: 1,
  sdLen: 29,
  useEma: true,
  emaLen: 35,
  barColoring: true,
  ShowBGCol: false,
  Transparency: 85,
};

export const inputConfig: InputConfig[] = [
  { id: 'medSrc', type: 'source', title: 'Median Source', defval: 'hl2' },
  { id: 'medLen', type: 'int', title: 'Median Length', defval: 63, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 4, min: 1 },
  { id: 'atrFactor', type: 'float', title: 'ATR Factor', defval: 1, min: 0.05, step: 0.05 },
  { id: 'sdLen', type: 'int', title: 'SD Length', defval: 29, min: 1 },
  { id: 'useEma', type: 'bool', title: 'Use EMA', defval: true },
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 35, min: 2 },
  { id: 'barColoring', type: 'bool', title: 'Use Bar Coloring?', defval: true },
  { id: 'ShowBGCol', type: 'bool', title: 'Color Background', defval: false },
  { id: 'Transparency', type: 'int', title: 'Background Transparency', defval: 85, min: 0, max: 100 },
];

const LONG = 'rgb(0, 200, 255)';
const SHORT = 'rgb(255, 0, 0)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Oscillator', color: LONG, lineWidth: 2, style: 'area' },
  { id: 'plot1', title: 'EMA', color: 'rgb(255, 255, 255)', lineWidth: 2 },
  { id: 'plot2', title: 'Zero Line', color: color.gray, lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Median ATR SD Oscillator',
  shortTitle: 'Median ATR SD Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time: the sorted window of the oakscriptjs
 * array function (insertion before the first value not below the new one, na values kept, the value `length` bars
 * back removed), the value at rank `ceil(percentage / 100 * length)` (the same doubles).
 */
class PercentileNearestRankStep {
  private values: number[] = [];
  private bars: number[] = [];
  private pendingBar = -1;
  private pendingValue = NaN;
  private pendingK = 0;
  private readonly rank: number;

  constructor(private readonly length: number, percentage: number) {
    // the length check of ta.percentile_nearest_rank (the same runtime error)
    taCore.percentile_nearest_rank([], length, percentage);
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  step(i: number, v: number): number {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k] >= v)) k++;
    this.pendingBar = i;
    this.pendingValue = v;
    this.pendingK = k;
    if (i < this.length - 1) return NaN;
    // the window with v inserted at k (and the value of bar i - length removed)
    let old = -1;
    if (i >= this.length) {
      const p = this.bars.indexOf(i - this.length);
      old = p < k ? p : p + 1;
    }
    const at = (j: number) => (j < k ? values[j] : j === k ? v : values[j - 1]);
    const r = this.rank - 1;
    return old >= 0 && r >= old ? at(r + 1) : at(r);
  }

  commit(): void {
    if (this.pendingBar < 0) return;
    const i = this.pendingBar;
    this.pendingBar = -1;
    this.values.splice(this.pendingK, 0, this.pendingValue);
    this.bars.splice(this.pendingK, 0, i);
    if (i >= this.length) {
      const old = this.bars.indexOf(i - this.length);
      this.values.splice(old, 1);
      this.bars.splice(old, 1);
    }
  }
}

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[]; bgColors: BgColorData[] };

interface MedianVars {
  /** var trend = 0 */
  trend: number;
  /** var hodl = 0 */
  hodl: number;
}

interface MedianRun extends BarRunState<MedianVars> {
  median: PercentileNearestRankStep;
  atr: ReturnType<typeof taStep.atr>;
  stdev: WindowStdev;
  ema: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<MedianAtrSdOscillatorInputs>): BarStudy<MedianRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.medSrc);
  const bgLong = String(color.new(LONG, cfg.Transparency));
  const bgShort = String(color.new(SHORT, cfg.Transparency));
  return {
    fullRunReason: () => (isBarSource(cfg.medSrc) ? null : 'source of another study'),
    init() {
      const median = new PercentileNearestRankStep(cfg.medLen, 50);
      const atr = taStep.atr(cfg.atrLen);
      const stdev = new WindowStdev(cfg.sdLen);
      const ema = taStep.ema(cfg.emaLen);
      const s: MedianRun = {
        median, atr, stdev, ema, plot0: [], plot1: [], plot2: [], barColors: [], bgColors: [],
        steps: [median, atr, stdev, ema], vars: { trend: 0, hodl: 0 }, lists: [], series: [],
      };
      s.lists = [s.barColors, s.bgColors];
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const t = b.time as number;
      const close = b.close;
      const median = s.median.step(i, value(b)) ?? NaN;
      const atrRaw = s.atr.step(b.high, b.low, close);
      const stdev = s.stdev.step(close);
      const atrLvl = median + atrRaw * cfg.atrFactor;
      const sdLvl = median + stdev;
      if (gt(close, sdLvl)) v.trend = 1;
      if (lt(close, atrLvl)) v.trend = -1;
      const tr = v.trend;
      const diff = tr === 1 ? close - atrLvl : close - sdLvl;
      const ema = s.ema.step(diff);

      if (cfg.useEma) {
        v.hodl = tr === 1 && gt(diff, ema) ? 1 : tr === -1 && lt(diff, ema) ? -1 : v.hodl;
      } else {
        v.hodl = tr === 1 ? 1 : tr === -1 ? -1 : v.hodl;
      }
      const hodl = v.hodl;
      s.plot0[i] = { time: t, value: diff, color: hodl === 1 ? LONG : SHORT };
      s.plot1[i] = { time: t, value: ema, color: 'rgb(255, 255, 255)' };
      s.plot2[i] = { time: t, value: 0, color: color.gray };
      // barcolor(barColoring and hodl == 1 ? long : barColoring and hodl == -1 ? short : na)
      if (cfg.barColoring && hodl === 1) s.barColors.push({ time: t, color: LONG });
      else if (cfg.barColoring && hodl === -1) s.barColors.push({ time: t, color: SHORT });
      // bgcolor(hodl == 1 ? color.new(long, Transparency) : color.new(short, Transparency), force_overlay = true,
      //         display = ShowBGCol ? display.all : display.none)
      if (cfg.ShowBGCol) s.bgColors.push({ time: t, color: hodl === 1 ? bgLong : bgShort, forceOverlay: true });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MedianAtrSdOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MedianAtrSdOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MedianAtrSdOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
