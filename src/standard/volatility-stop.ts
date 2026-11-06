/**
 * Volatility Stop
 *
 * An ATR-based trailing stop (SAR-like). Flips between long and short when the source crosses the stop:
 *
 *   atrM = nz(atr(length) * factor, tr)
 *   max  = max(max, src);  min = min(min, src)
 *   stop = nz(uptrend ? max(stop, max - atrM) : min(stop, min + atrM), src)
 *   uptrend = src - stop >= 0
 *   on a flip (not on the first bar): reset max / min to src and stop to the opposite band
 *
 * The stop is drawn as crosses, teal in an uptrend and red in a downtrend.
 * Based on the standard "Volatility Stop" indicator.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolatilityStopInputs {
  /** ATR length */
  length: number;
  /** Source */
  src: SourceType;
  /** ATR multiplier */
  factor: number;
}

export const defaultInputs: VolatilityStopInputs = {
  length: 20,
  src: 'close',
  factor: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 2 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'factor', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.25, step: 0.25 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volatility Stop', color: '#009688', lineWidth: 1, style: 'cross' },
];

export const metadata = {
  title: 'Volatility Stop',
  shortTitle: 'VStop',
  overlay: true,
};

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine math.max / math.min: na when an argument is na */
const pmax = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const pmin = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

interface VStopVars {
  started: boolean;
  max: number;
  min: number;
  uptrend: boolean;
  stop: number;
  /** barstate.isfirst */
  first: boolean;
}

interface VStopRun extends BarRunState<VStopVars> {
  tr: ReturnType<typeof taStep.tr>;
  atr: ReturnType<typeof taStep.atr>;
  data: { time: number; value: number; color: string }[];
}

function study(inputs: Partial<VolatilityStopInputs>): BarStudy<VStopRun, IndicatorResult> {
  const { length, src: srcInput, factor } = { ...defaultInputs, ...inputs };
  const source = barSource(srcInput);
  return {
    fullRunReason: () => (isBarSource(srcInput) ? null : 'source of another study'),
    init() {
      const tr = taStep.tr(false); // ta.tr: na on the first bar
      const atr = taStep.atr(length);
      const s: VStopRun = {
        tr, atr, data: [], steps: [tr, atr],
        // var max = src; var min = src; var uptrend = true; var float stop = na (inside `if not na(src)`)
        vars: { started: false, max: NaN, min: NaN, uptrend: true, stop: NaN, first: true },
        lists: [], series: [],
      };
      s.series = [s.data];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = source(b);
      const tr = s.tr.step(b.high, b.low, b.close);
      const atr = s.atr.step(b.high, b.low, b.close);
      let value = NaN;
      if (!isNaN(src)) {
        if (!v.started) {
          v.max = src;
          v.min = src;
          v.started = true;
        }
        // atrM = nz(ta.atr(atrlen) * atrfactor, ta.tr)
        const atrScaled = atr * factor;
        const atrM = isNaN(atrScaled) ? tr : atrScaled;
        v.max = pmax(v.max, src);
        v.min = pmin(v.min, src);
        const next = v.uptrend ? pmax(v.stop, v.max - atrM) : pmin(v.stop, v.min + atrM);
        v.stop = isNaN(next) ? src : next;
        const prevUptrend: boolean = v.uptrend; // uptrend[1]
        v.uptrend = ge(src - v.stop, 0);
        if (v.uptrend !== prevUptrend && !v.first) {
          v.max = src;
          v.min = src;
          v.stop = v.uptrend ? v.max - atrM : v.min + atrM;
        }
        value = v.stop;
      }
      v.first = false;
      // plot(vStop, "Volatility Stop", style = plot.style_cross, color = uptrend ? #009688 : #F44336)
      s.data[i] = { time: b.time, value, color: v.uptrend ? '#009688' : '#F44336' };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.data.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolatilityStopInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolatilityStopInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolatilityStop = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
