/**
 * HTC peppermint_07 CCI w signal + s&r RSI
 *
 * RSI and CCI lines in one pane, with dotted lines at the CCI overbought / oversold levels. The background is grey
 * when the RSI is above its overbought level and teal when it is below its oversold level. A red label at the top of
 * the pane marks the bars where both the RSI and the CCI are above their overbought levels; a teal label at the bottom
 * marks the bars where both are below their oversold levels.
 *
 * Reference: "HTC peppermint_07 CCI w signal + s&r RSI " by peppermint07
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, taCore, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface HtcPeppermint07CciRsiInputs {
  rsiLength: number;
  rsiOverbought: number;
  rsiOversold: number;
  rsiSource: SourceType;
  cciLength: number;
  cciOverbought: number;
  cciOversold: number;
  cciSource: SourceType;
}

export const defaultInputs: HtcPeppermint07CciRsiInputs = {
  rsiLength: 9,
  rsiOverbought: 70,
  rsiOversold: 30,
  rsiSource: 'close',
  cciLength: 20,
  cciOverbought: 100,
  cciOversold: -100,
  cciSource: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 9 },
  { id: 'rsiOverbought', type: 'int', title: 'RSI Overbought Level', defval: 70 },
  { id: 'rsiOversold', type: 'int', title: 'RSI Oversold Level', defval: 30 },
  { id: 'rsiSource', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'cciLength', type: 'int', title: 'CCI Length', defval: 20 },
  { id: 'cciOverbought', type: 'int', title: 'CCI Overbought Level', defval: 100 },
  { id: 'cciOversold', type: 'int', title: 'CCI Oversold Level', defval: -100 },
  { id: 'cciSource', type: 'source', title: 'CCI Source', defval: 'close' },
];

const RSI_COLOR = 'rgb(20, 126, 168)';
const CCI_COLOR = '#1b1b1b';
const LEVEL_COLOR = 'rgb(71, 71, 71)';
const OB_BG = '#4d4b4b1a';
const OS_BG = '#2ca4b41a';
const OB_SHAPE = '#ee4444e7';
const OS_SHAPE = '#0ea8a1';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: RSI_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'CCI', color: CCI_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'HTC peppermint_07 CCI w signal + s&r RSI ',
  shortTitle: 'HTC peppermint_07 CCI w signal + s&r RSI ',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * `ta.cci(source, length)` one bar at a time with a {@link WindowSma} mean (the doubles of taStep.cci, which steps two
 * slower window sums): (source - sma) / (0.015 * dev); a zero dev keeps the previous value (0 at the start).
 */
class CciStep implements Committable {
  private readonly mean: WindowSma;
  private readonly len: number;
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;
  private last = 0;
  private next = 0;

  constructor(length: number) {
    // the length check of ta.cci (the same runtime error)
    taCore.cci([], length);
    this.len = Math.floor(length);
    this.mean = new WindowSma(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    this.next = this.last;
    const mean = this.mean.step(value);
    const n = this.values.length;
    if (n < this.len - 1 || Number.isNaN(mean)) return NaN;
    // ta.dev: the mean of |source - sma| over the last `length` bars
    let sum = 0;
    for (let k = 0; k < this.len; k++) sum += Math.abs((k === 0 ? value : this.values[n - k]!) - mean);
    const d = sum / this.len;
    if (Number.isNaN(d)) return NaN;
    if (!compare.eq(d, 0)) this.next = (value - mean) / (0.015 * d);
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    this.mean.commit();
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface HtcRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  cci: CciStep;
  plot0: Point[];
  plot1: Point[];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<HtcPeppermint07CciRsiInputs>): BarStudy<HtcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const rsiSrc = barSource(cfg.rsiSource);
  const cciSrc = barSource(cfg.cciSource);
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) && isBarSource(cfg.cciSource) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(cfg.rsiLength);
      const cci = new CciStep(cfg.cciLength);
      const s: HtcRun = {
        rsi, cci, plot0: [], plot1: [], bgColors: [], markers: [],
        steps: [rsi, cci], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const rsi = s.rsi.step(rsiSrc(b));
      const cci = s.cci.step(cciSrc(b));
      // bgcolor(rsiValue > rsiOverbought ? #4d4b4b1a : na, title = "RSI Overbought Background")
      if (gt(rsi, cfg.rsiOverbought)) s.bgColors.push({ time: t, color: OB_BG });
      // bgcolor(rsiValue < rsiOversold ? #2ca4b41a : na, title = "RSI Oversold Background")
      if (lt(rsi, cfg.rsiOversold)) s.bgColors.push({ time: t, color: OS_BG });
      // plotshape(series = cond ? rsiValue : na, location.top / location.bottom, ...): with a location other than
      // absolute the series is read as a bool: na and 0 draw no shape (an RSI of 0 draws nothing)
      if (gt(rsi, cfg.rsiOverbought) && gt(cci, cfg.cciOverbought) && !isNaN(rsi) && rsi !== 0) {
        s.markers.push({ time: t, position: 'top', shape: 'labelUp', color: OB_SHAPE });
      }
      if (lt(rsi, cfg.rsiOversold) && lt(cci, cfg.cciOversold) && !isNaN(rsi) && rsi !== 0) {
        s.markers.push({ time: t, position: 'bottom', shape: 'labelDown', color: OS_SHAPE });
      }
      s.plot0[i] = { time: t, value: rsi, color: RSI_COLOR };
      s.plot1[i] = { time: t, value: cci, color: CCI_COLOR };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: cfg.cciOverbought, options: { title: 'CCI Overbought', color: LEVEL_COLOR, linestyle: 'dotted' } },
          { value: cfg.cciOversold, options: { title: 'CCI Oversold', color: LEVEL_COLOR, linestyle: 'dotted' } },
        ],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HtcPeppermint07CciRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HtcPeppermint07CciRsiInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const HtcPeppermint07CciRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
