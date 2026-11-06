/**
 * Polyphase MACD (PMACD)
 *
 * `phases` MACD engines run side by side; on each bar only the engine of phase bar_index % phases is updated, so
 * each engine sees every `phases`-th bar (as a `phases` times higher timeframe). An engine keeps the last
 * max(fast, slow) source values and the last `signal` MACD values (filled with the first source value and with 0);
 * fast / slow are an EMA (alpha = 2 / (length + 1), seeded with the source) or the average of the last `length`
 * values; the signal is the same filter of the MACD; hist = MACD - signal. The outputs of the updated engine are
 * smoothed by an SMA of a WMA over `phases` bars (no smoothing with 1 phase). The histogram colour depends on the
 * sign and on the change from the previous bar.
 *
 * Reference: "Polyphase MACD (PMACD)" by The_Peaceful_Lizard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © The_Peaceful_Lizard
 */

import { array, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type FilterStyle = 'SMA' | 'EMA';

export interface PolyphaseMacdInputs {
  source: SourceType;
  /** Number of phases (a timeframe multiplier) */
  phases: number;
  fastLength: number;
  slowLength: number;
  signalLength: number;
  oscillatorStyle: FilterStyle;
  signalStyle: FilterStyle;
  macdColor: string;
  signalColor: string;
  /** Histogram >= 0 and rising */
  risingUp: string;
  /** Histogram >= 0 and falling */
  risingDown: string;
  /** Histogram < 0 and falling */
  fallingDown: string;
  /** Histogram < 0 and rising */
  fallingUp: string;
  zeroLine: string;
}

// #787b8680 as Pine stores an input colour default (alpha with 2 decimals: 0.5)
const DEF_ZERO = 'rgba(120, 123, 134, 0.5)';

export const defaultInputs: PolyphaseMacdInputs = {
  source: 'close',
  phases: 1,
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  oscillatorStyle: 'EMA',
  signalStyle: 'EMA',
  macdColor: '#2962FF',
  signalColor: '#FF6D00',
  risingUp: '#26A69A',
  risingDown: '#B2DFDB',
  fallingDown: '#FF5252',
  fallingUp: '#FFCDD2',
  zeroLine: DEF_ZERO,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close', group: 'Global' },
  { id: 'phases', type: 'int', title: 'Phases', defval: 1, min: 1, group: 'Global' },
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1, group: 'Polyphase MACD' },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 2, group: 'Polyphase MACD' },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1, group: 'Polyphase MACD' },
  { id: 'oscillatorStyle', type: 'string', title: 'Oscillator MA Type', defval: 'EMA', options: ['SMA', 'EMA'], group: 'Polyphase MACD' },
  { id: 'signalStyle', type: 'string', title: 'Signal MA Type', defval: 'EMA', options: ['SMA', 'EMA'], group: 'Polyphase MACD' },
  { id: 'macdColor', type: 'color', title: 'MACD', defval: '#2962FF', group: 'Visuals' },
  { id: 'signalColor', type: 'color', title: 'Signal', defval: '#FF6D00', group: 'Visuals' },
  { id: 'risingUp', type: 'color', title: 'Histogram', defval: '#26A69A', group: 'Visuals' },
  { id: 'risingDown', type: 'color', title: 'Histogram (>= 0, falling)', defval: '#B2DFDB', group: 'Visuals' },
  { id: 'fallingDown', type: 'color', title: 'Histogram (< 0, falling)', defval: '#FF5252', group: 'Visuals' },
  { id: 'fallingUp', type: 'color', title: 'Histogram (< 0, rising)', defval: '#FFCDD2', group: 'Visuals' },
  { id: 'zeroLine', type: 'color', title: 'Zero Line', defval: DEF_ZERO, group: 'Visuals' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#26A69A', lineWidth: 1, style: 'columns' },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'MACD', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Polyphase MACD (PMACD)',
  shortTitle: 'Polyphase MACD (PMACD)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (x: number, y: number) => (isNaN(x) ? y : x);

/** One MACD engine (Pine type MACD) */
interface Macd {
  source: number[];
  fast: number;
  slow: number;
  macd: number[];
  signal: number;
  hist: number;
}

/** method unshift_pop(float[] self, float value): pop the last value, insert the new one at the front */
const unshiftPop = (self: number[], value: number) => {
  self.pop();
  self.unshift(value);
};

/** method ema(float self, float source, int period): one EMA step seeded with the source */
const emaStep = (self: number, source: number, period: number) => {
  const alpha = 2.0 / (period + 1);
  const iAlpha = 1 - alpha;
  return source * alpha + nz(self, source) * iAlpha;
};

/** method sma(float[] self, int period): average of the first `period` values (all values when fewer) */
const arraySma = (self: number[], period: number) =>
  period < self.length ? array.avg(array.slice(self, 0, period)) : array.avg(self);

/** filter(source, input_array, input_variable, period, style) */
const filter = (source: number, inputArray: number[], inputVariable: number, period: number, style: FilterStyle) =>
  style === 'SMA' ? arraySma(inputArray, period) : emaStep(inputVariable, source, period);

/**
 * Pine user functions sma(source, length) / wma(source, length): an SMA / WMA over min(bar_index + 1, length) bars,
 * na history values replaced by the first non-na source; the value is kept on a bar with an na source. Each call
 * site has its own state and history (the last `length` values: the older ones are not read). A class so that a live
 * run can copy its state at the end of the last confirmed bar.
 */
class WeightedSite {
  private hist: number[] = [];
  private value = NaN;
  private firstSource = NaN;

  constructor(private readonly weighted: boolean) {}

  call(barIndex: number, source: number, length: number): number {
    const hist = this.hist;
    hist.push(source);
    if (hist.length > length && hist.length > 1) hist.shift();
    const maxLength = Math.min(barIndex, length - 1);
    if (!isNaN(source)) {
      if (isNaN(this.firstSource)) this.firstSource = source;
      const firstSource = this.firstSource;
      const at = (k: number) => {
        const j = hist.length - 1 - k;
        return nz(j >= 0 ? hist[j] : NaN, firstSource);
      };
      let sum = 0;
      if (this.weighted) {
        let weight = 0;
        for (let k = 0; k <= maxLength; k++) {
          const w = maxLength + 1 - k;
          weight += w;
          sum += at(k) * w;
        }
        this.value = sum / weight;
      } else {
        const w = 1.0 / (maxLength + 1);
        for (let k = 0; k <= maxLength; k++) sum += at(k) * w;
        this.value = sum;
      }
    }
    return this.value;
  }

  clone(): WeightedSite {
    const c = new WeightedSite(this.weighted);
    c.hist = this.hist.slice();
    c.value = this.value;
    c.firstSource = this.firstSource;
    return c;
  }
}

/** output_filter(source, config) = sma(wma(source, phases), phases): one wma and one sma site per call */
class OutputFilterSite {
  constructor(private readonly wma = new WeightedSite(true), private readonly sma = new WeightedSite(false)) {}

  call(barIndex: number, source: number, phases: number): number {
    return this.sma.call(barIndex, this.wma.call(barIndex, source, phases), phases);
  }

  clone(): OutputFilterSite {
    return new OutputFilterSite(this.wma.clone(), this.sma.clone());
  }
}

type Point = { time: number; value: number; color: string };

interface PolyphaseVars {
  macdPhases: Macd[];
  ready: boolean;
  macdFilter: OutputFilterSite;
  signalFilter: OutputFilterSite;
  histFilter: OutputFilterSite;
  /** self[1] of histogram_color */
  prevHist: number;
  histColor: string;
}

interface PolyphaseRun extends BarRunState<PolyphaseVars> {
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

function study(inputs: Partial<PolyphaseMacdInputs>): BarStudy<PolyphaseRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.source);
  const { phases, fastLength, slowLength, signalLength, oscillatorStyle, signalStyle } = cfg;
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: PolyphaseRun = {
        plot0: [], plot1: [], plot2: [], steps: [], lists: [], series: [],
        vars: {
          macdPhases: [], ready: false, macdFilter: new OutputFilterSite(), signalFilter: new OutputFilterSite(),
          histFilter: new OutputFilterSite(), prevHist: NaN, histColor: '',
        },
      };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    copyVars: (v) => ({
      ...v,
      macdPhases: v.macdPhases.map((m) => ({ ...m, source: m.source.slice(), macd: m.macd.slice() })),
      macdFilter: v.macdFilter.clone(),
      signalFilter: v.signalFilter.clone(),
      histFilter: v.histFilter.clone(),
    }),
    bar(s, i, bars) {
      const v = s.vars;
      const source = value(bars[i]);
      // bar_index counts from the first bar of the data
      const phase = i % phases;
      if (!v.ready) {
        // init_macd(source, config)
        v.macdPhases.push({
          source: array.new_float(Math.max(fastLength, slowLength), source),
          fast: NaN,
          slow: NaN,
          macd: array.new_float(signalLength, 0),
          signal: NaN,
          hist: NaN,
        });
        v.ready = v.macdPhases.length === phases;
      }
      // method update(MACD self, float source, settings config)
      const m = v.macdPhases[phase];
      unshiftPop(m.source, source);
      m.fast = filter(source, m.source, m.fast, fastLength, oscillatorStyle);
      m.slow = filter(source, m.source, m.slow, slowLength, oscillatorStyle);
      const newMacd = m.fast - m.slow;
      unshiftPop(m.macd, newMacd);
      const newSignal = filter(newMacd, m.macd, m.signal, signalLength, signalStyle);
      m.signal = newSignal;
      m.hist = newMacd - newSignal;

      const macd = v.macdFilter.call(i, m.macd[0], phases);
      const signal = v.signalFilter.call(i, m.signal, phases);
      const hist = v.histFilter.call(i, m.hist, phases);

      // method histogram_color(float self, settings config)
      const ref = nz(v.prevHist, hist);
      if (ge(hist, 0)) {
        v.histColor = ge(hist, ref) ? cfg.risingUp : cfg.risingDown;
      } else {
        v.histColor = le(hist, ref) ? cfg.fallingDown : cfg.fallingUp;
      }
      v.prevHist = hist;

      const time = bars[i].time;
      s.plot0[i] = { time, value: fin(hist), color: v.histColor };
      s.plot1[i] = { time, value: fin(signal), color: cfg.signalColor };
      s.plot2[i] = { time, value: fin(macd), color: cfg.macdColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [{ value: 0, options: { title: 'Zero Line', color: cfg.zeroLine, linestyle: 'dashed' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PolyphaseMacdInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PolyphaseMacdInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PolyphaseMacd = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
