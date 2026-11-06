/**
 * Fourier Series Model of the Market
 *
 * The 2-bar momentum of the source (source - source[2], na as 0) goes through one second-order IIR bandpass filter
 * per harmonic h = 1..N, tuned to the period `period / h` with the bandwidth parameter:
 * value = a * input + b * value[1] - c * value[2] (a = 0.5 * (1 - d), b = cos(w) * (1 + d), c = d, with
 * d = 1 / cos(bw * w) - sqrt(1 / cos(bw * w)^2 - 1)). Each harmonic keeps a rolling energy over `period` bars
 * (value^2 + (period / 2pi * (value - value[1]))^2). The wave is the first harmonic plus each higher harmonic scaled
 * by sqrt(its energy / the energy of the harmonic before). The quadrature is period / 4pi * (wave - wave[2]).
 * Optional threshold bands: k * 0.6745 * stdev (MAD mode), k * stdev, or a percentile (nearest rank) of |wave|.
 * Alerts (alertcondition, `alerts` of the result): the wave crossing the bands (when they are shown) and zero.
 *
 * Reference: "Fourier Series Model of the Market" by e2e4
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowStdev, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface FourierSeriesModelOfTheMarketInputs {
  /** Price series to decompose into harmonic components */
  src: SourceType;
  /** Base period of the fundamental harmonic */
  period: number;
  /** Bandpass filter selectivity */
  bandwidth: number;
  /** Number of harmonic components */
  numHarmonics: number;
  showWave: boolean;
  colorWave: string;
  showRoc: boolean;
  colorRoc: string;
  showZeroLine: boolean;
  colorZeroLine: string;
  showThreshold: boolean;
  colorThresholdTop: string;
  colorThresholdBottom: string;
  thresholdMode: 'MAD' | 'Standard Deviation' | 'Percentile Rank';
  thresholdPeriod: number;
  thresholdMultiplier: number;
  thresholdPercentile: number;
}

export const defaultInputs: FourierSeriesModelOfTheMarketInputs = {
  src: 'close',
  period: 20,
  bandwidth: 0.1,
  numHarmonics: 3,
  showWave: true,
  colorWave: '#FF5933',
  showRoc: true,
  colorRoc: '#3A6DFF',
  showZeroLine: true,
  colorZeroLine: '#4DB8FF',
  showThreshold: true,
  colorThresholdTop: '#FFB340',
  colorThresholdBottom: '#A6FF4D',
  thresholdMode: 'MAD',
  thresholdPeriod: 50,
  thresholdMultiplier: 1.5,
  thresholdPercentile: 90.0,
};

const G_MODEL = '》 FOURIER SERIES MODEL     ───────────────────────────────────────────     ';
const G_DISP = '》 DISPLAY SETTINGS     ───────────────────────────────────────────     ';
const G_DIAG = '》 DIAGNOSTICS     ───────────────────────────────────────────     ';

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: G_MODEL,
    tooltip: 'Price series to decompose into harmonic components' },
  { id: 'period', type: 'int', title: 'Period', defval: 20, min: 6, max: 100, step: 1, group: G_MODEL,
    tooltip: 'Base period for fundamental harmonic. Higher harmonics divide this period (e.g., harmonic 2 = period/2)' },
  { id: 'bandwidth', type: 'float', title: 'Bandwidth', defval: 0.1, min: 0.05, max: 0.5, step: 0.05, group: G_MODEL,
    tooltip: 'Bandpass filter selectivity. Lower = narrower passband, more precise harmonic isolation (0.05-0.5)' },
  { id: 'numHarmonics', type: 'int', title: 'Harmonics', defval: 3, min: 1, max: 20, step: 1, group: G_MODEL,
    tooltip: 'Number of harmonic components to extract. More harmonics capture finer detail but increase computation' },
  { id: 'showWave', type: 'bool', title: 'Wave outputs', defval: true, group: G_DISP, inline: 'DISP1' },
  { id: 'colorWave', type: 'color', title: '', defval: '#FF5933', group: G_DISP, inline: 'DISP1',
    tooltip: 'Show/hide the composite Fourier wave output' },
  { id: 'showRoc', type: 'bool', title: 'Quadrature (Rate of Change)', defval: true, group: G_DISP, inline: 'DISP2' },
  { id: 'colorRoc', type: 'color', title: '', defval: '#3A6DFF', group: G_DISP, inline: 'DISP2',
    tooltip: 'Show/hide the quadrature component (90° phase; scaled rate-of-change)' },
  { id: 'showZeroLine', type: 'bool', title: 'Zero Line', defval: true, group: G_DISP, inline: 'DISP3' },
  { id: 'colorZeroLine', type: 'color', title: '', defval: '#4DB8FF', group: G_DISP, inline: 'DISP3',
    tooltip: 'Show/hide zero reference line' },
  { id: 'showThreshold', type: 'bool', title: 'Dynamic Threshold', defval: true, group: G_DIAG, inline: 'DIAG1',
    tooltip: 'Show/hide dynamic threshold bands for identifying significant wave behavior' },
  { id: 'colorThresholdTop', type: 'color', title: '', defval: '#FFB340', group: G_DIAG, inline: 'DIAG1' },
  { id: 'colorThresholdBottom', type: 'color', title: '', defval: '#A6FF4D', group: G_DIAG, inline: 'DIAG1' },
  { id: 'thresholdMode', type: 'string', title: 'Threshold Mode', defval: 'MAD',
    options: ['MAD', 'Standard Deviation', 'Percentile Rank'], group: G_DIAG,
    tooltip: 'MAD (outlier-resistant), Standard deviation (volatility-sensitive), or Percentile rank (fixed probability)' },
  { id: 'thresholdPeriod', type: 'int', title: 'Period', defval: 50, min: 2, max: 200, step: 1, group: G_DIAG,
    tooltip: 'Lookback period for threshold calculations (2-200)' },
  { id: 'thresholdMultiplier', type: 'float', title: 'Multiplier (k)', defval: 1.5, min: 0.0, max: 5.0, step: 0.1, group: G_DIAG,
    tooltip: 'Scaling factor (k) for MAD/Standard deviation modes' },
  { id: 'thresholdPercentile', type: 'float', title: 'Percentile (%)', defval: 90.0, min: 0.0, max: 100.0, step: 0.5, group: G_DIAG,
    tooltip: 'Percentile of |wave| for threshold. E.g., 90% means only 10% of values exceed (0-100%)' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Wave', color: '#FF5933', lineWidth: 2, visible: 'showWave' },
  { id: 'plot1', title: 'Rate of Change', color: '#3A6DFF', lineWidth: 1, visible: 'showRoc' },
  { id: 'plot2', title: 'Threshold +', color: '#FFB340', lineWidth: 1, visible: 'showThreshold' },
  { id: 'plot3', title: 'Threshold -', color: '#A6FF4D', lineWidth: 1, visible: 'showThreshold' },
];

export const metadata = {
  title: 'Fourier Series Model of the Market',
  shortTitle: 'FSMM',
  overlay: false,
};

const TWO_PI = 2.0 * Math.PI;
const FOUR_PI = 4.0 * Math.PI;
const MAD_SCALE = 0.6745;

/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time: the sorted window of the oakscriptjs
 * array function (na values kept where its insertion puts them, the value of `length` bars back removed by bar), the
 * same doubles. A step reads the window the bar's value would give without changing it; commit changes it.
 */
class PercentileNearestRankStep implements Committable {
  private values: number[] = [];
  private bars: number[] = [];
  private count = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;
  private readonly rank: number;

  constructor(length: number, percentage: number) {
    this.len = length;
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  /** Position of `v` in the sorted window (after the values it is not greater than or equal to) */
  private insertAt(v: number): number {
    const values = this.values;
    let k = 0;
    while (k < values.length && !(values[k]! >= v)) k++;
    return k;
  }

  step(v: number): number {
    this.stepped = true;
    this.pending = v;
    const i = this.count;
    if (i < this.len - 1) return NaN;
    const k = this.insertAt(v);
    // the window with v inserted at k, without the value of bar i - length (at `old` once v is inserted)
    let old = -1;
    if (i >= this.len) {
      const at = this.bars.indexOf(i - this.len);
      old = at < k ? at : at + 1;
    }
    const r = this.rank - 1;
    const idx = old >= 0 && r >= old ? r + 1 : r;
    return idx === k ? v : idx < k ? this.values[idx]! : this.values[idx - 1]!;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const i = this.count++;
    const v = this.pending;
    const k = this.insertAt(v);
    this.values.splice(k, 0, v);
    this.bars.splice(k, 0, i);
    if (i >= this.len) {
      const old = this.bars.indexOf(i - this.len);
      this.values.splice(old, 1);
      this.bars.splice(old, 1);
    }
  }
}

/** Harmonic states: bandpass coefficients (bandpassCoefficients(bandwidth, period, i)) and filter memory */
type Harmonic = { value: number; prev1: number; prev2: number; energy: number; coefA: number; coefB: number; coefC: number };

interface FsmmVars {
  harmonics: Harmonic[];
  /** Flattened energy ring buffer: index = harmonic * period + ringIndex */
  energyBuffer: number[];
  ringIndex: number;
  /** wave[1], thresholdVal[1] */
  prevWave: number;
  prevThreshold: number;
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface FsmmRun extends BarRunState<FsmmVars> {
  source: number[];
  wave: number[];
  dev: WindowStdev | null;
  rank: PercentileNearestRankStep | null;
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<FourierSeriesModelOfTheMarketInputs>): BarStudy<FsmmRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { period, bandwidth, numHarmonics } = cfg;
  const value = barSource(cfg.src);
  const nz = (v: number) => (isNaN(v) ? 0 : v);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const rateScale = period / TWO_PI;
  const quadScale = period / FOUR_PI;
  const pr = cfg.showThreshold && cfg.thresholdMode !== 'MAD' && cfg.thresholdMode !== 'Standard Deviation';
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const harmonics: Harmonic[] = [];
      for (let i = 0; i <= numHarmonics - 1; i++) {
        const angularFreq = TWO_PI / (period / (i + 1));
        const freqCos = Math.cos(angularFreq);
        const bandwidthCos = Math.cos(bandwidth * angularFreq);
        const discriminant = 1.0 / (bandwidthCos * bandwidthCos) - 1.0;
        const damping = 1.0 / bandwidthCos - Math.sqrt(discriminant);
        harmonics.push({ value: 0, prev1: 0, prev2: 0, energy: 0,
          coefA: 0.5 * (1.0 - damping), coefB: freqCos * (1.0 + damping), coefC: damping });
      }
      const s: FsmmRun = {
        source: [], wave: [],
        dev: cfg.showThreshold && !pr ? new WindowStdev(cfg.thresholdPeriod) : null,
        rank: pr ? new PercentileNearestRankStep(cfg.thresholdPeriod, cfg.thresholdPercentile) : null,
        plots: [[], [], [], []], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [],
        vars: {
          harmonics, energyBuffer: new Array<number>(numHarmonics * period).fill(0.0), ringIndex: 0,
          prevWave: NaN, prevThreshold: NaN,
        },
        lists: [], series: [],
      };
      if (s.dev) s.steps.push(s.dev);
      if (s.rank) s.steps.push(s.rank);
      s.lists = [...s.times];
      s.series = [s.source, s.wave, ...s.plots, ...s.flags];
      return s;
    },
    copyVars: (v) => ({
      ...v,
      harmonics: v.harmonics.map((h) => ({ ...h })),
      energyBuffer: v.energyBuffer.slice(),
    }),
    bar(s, k, bars) {
      const b = bars[k];
      const time = b.time;
      const v = s.vars;
      const src = value(b);
      s.source[k] = src;
      // Debias: 2-bar momentum
      const input = nz(src) - nz(k >= 2 ? s.source[k - 2] : NaN);
      let w = 0.0;
      let prevEnergy = 0.0;
      const { harmonics, energyBuffer } = v;
      for (let i = 0; i < harmonics.length; i++) {
        const h = harmonics[i];
        // computeHarmonic
        const value = h.coefA * input + h.coefB * h.prev1 - h.coefC * h.prev2;
        const rate = rateScale * (value - h.prev1);
        const energy = value * value + rate * rate;
        h.prev2 = h.prev1;
        h.prev1 = value;
        h.value = value;
        const idx = i * period + v.ringIndex;
        const oldEnergy = energyBuffer[idx];
        energyBuffer[idx] = energy;
        h.energy += energy - oldEnergy;
        // Weighted synthesis (a plain division: x / 0 is +-infinity, 0 / 0 NaN, as Pine)
        if (i === 0) w = h.value;
        else w += Math.sqrt(h.energy / prevEnergy) * h.value;
        prevEnergy = h.energy;
      }
      v.ringIndex = (v.ringIndex + 1) % period;
      s.wave[k] = w;

      // computeQuadrature(wave, period): period / 4pi * (wave - nz(wave[2]))
      const roc = quadScale * (w - nz(k >= 2 ? s.wave[k - 2] : NaN));

      // threshold(wave, mode, thresholdPeriod, k, percentile), only when showThreshold (var float thresholdVal = na)
      let threshold = NaN;
      if (cfg.showThreshold) {
        if (cfg.thresholdMode === 'MAD') threshold = cfg.thresholdMultiplier * (MAD_SCALE * s.dev!.step(w));
        else if (cfg.thresholdMode === 'Standard Deviation') threshold = cfg.thresholdMultiplier * s.dev!.step(w);
        else threshold = s.rank!.step(Math.abs(w));
      }

      s.plots[0][k] = { time, value: cfg.showWave ? fin(w) : NaN, color: cfg.colorWave };
      s.plots[1][k] = { time, value: cfg.showRoc ? fin(roc) : NaN, color: cfg.colorRoc };
      s.plots[2][k] = { time, value: cfg.showThreshold ? fin(threshold) : NaN, color: cfg.colorThresholdTop };
      s.plots[3][k] = { time, value: cfg.showThreshold ? fin(-threshold) : NaN, color: cfg.colorThresholdBottom };

      // crossedAboveThreshold = showThreshold and ta.crossover(wave, thresholdVal); crossedBelowThreshold = showThreshold
      // and ta.crossunder(wave, -thresholdVal); ta.crossover / crossunder(wave, 0)
      const pw = k > 0 ? v.prevWave : NaN;
      const pt = k > 0 ? v.prevThreshold : NaN;
      const f0 = cfg.showThreshold && w > threshold && pw <= pt;
      const f1 = cfg.showThreshold && w < -threshold && pw >= -pt;
      const f2 = w > 0 && pw <= 0;
      const f3 = w < 0 && pw >= 0;
      v.prevWave = w;
      v.prevThreshold = threshold;
      s.flags[0][k] = f0;
      s.flags[1][k] = f1;
      s.flags[2][k] = f2;
      s.flags[3][k] = f3;
      if (f0) s.times[0].push(time as number);
      if (f1) s.times[1].push(time as number);
      if (f2) s.times[2].push(time as number);
      if (f3) s.times[3].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
        },
        // hline(showZeroLine ? 0 : na, 'Zero', colorZeroLine, display = showZeroLine ? display.all : display.none)
        hlines: cfg.showZeroLine
          ? [{ value: 0, options: { title: 'Zero', color: cfg.colorZeroLine, linestyle: 'dashed' } }]
          : [],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<FourierSeriesModelOfTheMarketInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<FourierSeriesModelOfTheMarketInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'FSMM: Above +Threshold', message: 'FSMM: wave crossed above +threshold' },
  { id: 'alert1', title: 'FSMM: Below -Threshold', message: 'FSMM: wave crossed below -threshold' },
  { id: 'alert2', title: 'FSMM: Above Zero', message: 'FSMM: wave crossed above zero' },
  { id: 'alert3', title: 'FSMM: Below Zero', message: 'FSMM: wave crossed below zero' },
];

export const FourierSeriesModelOfTheMarket = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
