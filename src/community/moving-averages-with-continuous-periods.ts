/**
 * Moving Averages With Continuous Periods (Float MA's)
 *
 * SMA, WMA and HMA of the close with a fractional (float) length. SMA: the last ceil(length) closes, the oldest one
 * weighted by the fractional part of the length, divided by the length. WMA: a linear kernel max(0, length - x) for
 * x = 0..ceil(length), normalised to a sum of 1. HMA: WMA(2 * WMA(close, p / 2) - WMA(close, p), sqrt(p)), p = length - 1.
 * Bars before the first bar use the first value. The line colour follows the angle of the MA change: the change is
 * divided by a WMA of the absolute change (length max(2, length / 1.5), shorter on the first bars), turned into an
 * angle with atan and scaled to 0..1, then coloured as solid, two-tone or three-tone gradients, or polar.
 *
 * Reference: "Float MA's [fpma]" by The_Peaceful_Lizard
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © The_Peaceful_Lizard
 */

import { color, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface MovingAveragesWithContinuousPeriodsInputs {
  /** Source input of the Pine script; the Pine script computes the MA of the close (this input is not used) */
  src: SourceType;
  /** MA length (float) */
  length: number;
  /** MA style */
  style: 'SMA' | 'WMA' | 'HMA';
  /** Colour style of the line */
  gradientType: 'Solid' | 'Two Tone' | 'Three Tone' | 'Polar';
  upColor: string;
  neutralColor: string;
  downColor: string;
  /** Line width (the plot width of the port is fixed at the default 3) */
  lineWidth: number;
}

export const defaultInputs: MovingAveragesWithContinuousPeriodsInputs = {
  src: 'close',
  length: 9,
  style: 'HMA',
  gradientType: 'Three Tone',
  upColor: '#8BFF3D',
  neutralColor: '#9A9A9A',
  downColor: '#FFC01F',
  lineWidth: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'float', title: 'Length', defval: 9, min: 2, step: 0.125 },
  { id: 'style', type: 'string', title: 'MA Style', defval: 'HMA', options: ['SMA', 'WMA', 'HMA'] },
  { id: 'gradientType', type: 'string', title: 'Gradient Style', defval: 'Three Tone', options: ['Solid', 'Two Tone', 'Three Tone', 'Polar'] },
  { id: 'upColor', type: 'color', title: 'Up Color', defval: '#8BFF3D' },
  { id: 'neutralColor', type: 'color', title: 'Neutral/Solid Color', defval: '#9A9A9A' },
  { id: 'downColor', type: 'color', title: 'Down Color', defval: '#FFC01F' },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Float MA', color: '#9A9A9A', lineWidth: 3 },
];

export const metadata = {
  title: "Float MA's [fpma]",
  shortTitle: "Float MA's [fpma]",
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a != b only when |a - b| > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
const nz = (v: number, r = 0) => (Number.isFinite(v) ? v : r);

/** wma_kernel(length): max(0, length - x) for x = 0..ceil(length), times nz(1 / sum, 1) */
function wmaKernel(length: number): number[] {
  const top = Math.ceil(length);
  let nc = 0;
  for (let x = 0; x <= top; x++) nc += Math.max(0, -x + length);
  nc = nz(1.0 / nc, 1);
  const kernel: number[] = [];
  for (let x = 0; x <= top; x++) kernel.push(Math.max(0, -x + length) * nc);
  return kernel;
}

/**
 * wma(source, length) of one Pine call site: `var first_value` (first non-na source) replaces the values before the
 * first bar; the `var` kernel is built on the first bar and again when the length changes (length != length[1]).
 * One bar at a time: `source` holds the values of the bars up to `b`.
 */
class FloatWma implements Committable {
  private firstValue = NaN;
  private kernel: number[] = [];
  private prevLength = NaN;
  private nextFirst = NaN;
  private nextKernel: number[] = [];
  private nextLength = NaN;
  private stepped = false;

  step(source: number[], b: number, length: number): number {
    this.stepped = true;
    let firstValue = this.firstValue;
    if (isNaN(firstValue) && !isNaN(source[b])) firstValue = source[b];
    const prevLength = b > 0 && !isNaN(this.prevLength) ? this.prevLength : length; // nz(length[1], length)
    let kernel = this.kernel;
    if (b === 0 || ne(length, prevLength)) kernel = wmaKernel(length);
    let sum = 0;
    for (let i = 0; i <= kernel.length - 1; i++) {
      const v = b - i >= 0 ? source[b - i] : NaN;
      sum += (isNaN(v) ? firstValue : v) * kernel[i];
    }
    this.nextFirst = firstValue;
    this.nextKernel = kernel;
    this.nextLength = length;
    return sum;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.firstValue = this.nextFirst;
    this.kernel = this.nextKernel;
    this.prevLength = this.nextLength;
  }
}

/** sma(source, length): the oldest of the ceil(length) values weighted by length % 1, sum / length (one bar at a time) */
class FloatSma implements Committable {
  private firstValue = NaN;
  private nextFirst = NaN;
  private stepped = false;
  private readonly realLength: number;
  private readonly mantissa: number;

  constructor(private readonly length: number) {
    this.realLength = Math.ceil(length);
    this.mantissa = length % 1;
  }

  step(source: number[], b: number): number {
    this.stepped = true;
    let firstValue = this.firstValue;
    if (isNaN(firstValue) && !isNaN(source[b])) firstValue = source[b];
    this.nextFirst = firstValue;
    const realLength = this.realLength;
    let sum = 0;
    for (let i = 0; i <= realLength - 1; i++) {
      let w = 1;
      if (ne(this.mantissa, 0) && i === realLength - 1) w = this.mantissa;
      const v = b - i >= 0 ? source[b - i] : NaN;
      sum += (isNaN(v) ? firstValue : v) * w;
    }
    return sum / this.length;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.firstValue = this.nextFirst;
  }
}

interface FpmaRun extends BarRunState<Record<string, never>> {
  sma: FloatSma | null;
  wma: FloatWma | null;
  half: FloatWma | null;
  full: FloatWma | null;
  hma: FloatWma | null;
  atr: FloatWma;
  close: number[];
  hmaSrc: number[];
  ma: number[];
  absDelta: number[];
  plot0: Array<{ time: number; value: number; color: string }>;
}

function study(inputs: Partial<MovingAveragesWithContinuousPeriodsInputs>): BarStudy<FpmaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.length;
  // hma: period = length - 1
  const period = len - 1;
  // trend_gradient(ma, math.max(2, length / 1.5), ...): normal_angle(source, atr_length)
  const atrLength = Math.max(2, len / 1.5);
  return {
    init() {
      const isHma = cfg.style !== 'SMA' && cfg.style !== 'WMA';
      const s: FpmaRun = {
        sma: cfg.style === 'SMA' ? new FloatSma(len) : null,
        wma: cfg.style === 'WMA' ? new FloatWma() : null,
        half: isHma ? new FloatWma() : null,
        full: isHma ? new FloatWma() : null,
        hma: isHma ? new FloatWma() : null,
        atr: new FloatWma(),
        close: [], hmaSrc: [], ma: [], absDelta: [], plot0: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.sma, s.wma, s.half, s.full, s.hma, s.atr].filter((m): m is FloatSma | FloatWma => m !== null);
      s.series = [s.close, s.hmaSrc, s.ma, s.absDelta, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      s.close[i] = bar.close;
      // ma = ma_select(close, length, style): the Pine script uses close, not the Source input
      let ma: number;
      if (s.sma) {
        ma = s.sma.step(s.close, i);
      } else if (s.wma) {
        ma = s.wma.step(s.close, i, len);
      } else {
        // hma: wma(2 * wma(source, period / 2) - wma(source, period), math.sqrt(period))
        const half = s.half!.step(s.close, i, period / 2);
        const full = s.full!.step(s.close, i, period);
        s.hmaSrc[i] = 2 * half - full;
        ma = s.hma!.step(s.hmaSrc, i, Math.sqrt(period));
      }
      s.ma[i] = ma;

      const delta = ma - nz(i > 0 ? s.ma[i - 1] : NaN); // source - nz(source[1])
      // atr(math.abs(delta), atr_length) = wma(source, math.min(bar_index + 1, length))
      s.absDelta[i] = Math.abs(delta);
      const atr = s.atr.step(s.absDelta, i, Math.min(i + 1, atrLength));

      const atrNormalDelta = delta / atr;
      const angle = math.todegrees(Math.atan(atrNormalDelta)) as number;
      const v = (angle + 90) / 180;
      let c: string;
      switch (cfg.gradientType) {
        case 'Solid':
          c = cfg.neutralColor;
          break;
        case 'Two Tone':
          c = String(color.from_gradient(v, 0, 1, cfg.downColor, cfg.upColor));
          break;
        case 'Polar':
          c = lt(v, 0.5) ? cfg.downColor : cfg.upColor;
          break;
        default: {
          // three_tone_gradient(value, 0, 1, ...): center 0.5, epsilon 0
          const center = (1 + 0) / 2;
          c = gt(v, center) ? String(color.from_gradient(v, center + 0, 1, cfg.neutralColor, cfg.upColor))
            : lt(v, center) ? String(color.from_gradient(v, 0, center - 0, cfg.downColor, cfg.neutralColor))
              : cfg.neutralColor;
        }
      }
      s.plot0[i] = { time: bar.time as number, value: Number.isFinite(ma) ? ma : NaN, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MovingAveragesWithContinuousPeriodsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MovingAveragesWithContinuousPeriodsInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MovingAveragesWithContinuousPeriods = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
