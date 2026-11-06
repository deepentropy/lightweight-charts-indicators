/**
 * TradingMoja / SQZMOM ADX
 *
 * Squeeze momentum with ADX in one pane. Bands: SMA of the close +- KC multiplier * standard deviation (the script
 * uses the KC multiplier for the bands, the BB multiplier input is not used); Keltner channel: SMA of the close
 * +- KC multiplier * SMA of the true range (or of high - low). The squeeze is on when the bands are inside the
 * channel, off when they are outside it. The momentum is the linear regression of close minus the average of the
 * channel midpoint (highest high + lowest low) / 2 and the SMA of the close; its colour comes from the raw value
 * (lime / green above 0, red / maroon below 0, by its change). The histogram is scaled so that the highest absolute
 * value of the last `scale_lookback` bars has the target height (scale 1 while that maximum is na or 0). Squeeze
 * dots on the zero line (blue no squeeze, black squeeze on, gray squeeze off), the ADX line, optional DI+ / DI-
 * lines and a dashed ADX threshold line.
 *
 * Reference: "TradingMoja / SQZMOM ADX " by Trading_Moja
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun, WindowExtreme, WindowSma, WindowStdev } from '../live-run';

export interface TradingmojaSqzmomAdxInputs {
  /** BB length */
  sqzLengthBB: number;
  /** BB multiplier (not used by the Pine script) */
  sqzMultBB: number;
  /** KC length */
  sqzLengthKC: number;
  /** KC multiplier (also used for the bands) */
  sqzMultKC: number;
  /** Use the true range for the Keltner channel */
  sqzUseTR: boolean;
  adxLen: number;
  adxTh: number;
  /** Show the DI+ / DI- lines */
  showDi: boolean;
  /** Lookback of the auto-scaling */
  scaleLookback: number;
  /** Target height of the squeeze histogram */
  scaleTarget: number;
}

export const defaultInputs: TradingmojaSqzmomAdxInputs = {
  sqzLengthBB: 20,
  sqzMultBB: 2.0,
  sqzLengthKC: 20,
  sqzMultKC: 1.5,
  sqzUseTR: true,
  adxLen: 14,
  adxTh: 20,
  showDi: false,
  scaleLookback: 200,
  scaleTarget: 45,
};

export const inputConfig: InputConfig[] = [
  { id: 'sqzLengthBB', type: 'int', title: 'BB Length', defval: 20 },
  { id: 'sqzMultBB', type: 'float', title: 'BB MultFactor', defval: 2.0 },
  { id: 'sqzLengthKC', type: 'int', title: 'KC Length', defval: 20 },
  { id: 'sqzMultKC', type: 'float', title: 'KC MultFactor', defval: 1.5 },
  { id: 'sqzUseTR', type: 'bool', title: 'Use TrueRange (KC)', defval: true },
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 14 },
  { id: 'adxTh', type: 'int', title: 'ADX Threshold', defval: 20 },
  { id: 'showDi', type: 'bool', title: 'Mostrar lineas DI+ / DI-', defval: false },
  { id: 'scaleLookback', type: 'int', title: 'Periodo Auto-Escala', defval: 200 },
  { id: 'scaleTarget', type: 'int', title: 'Altura Objetivo Squeeze', defval: 45 },
];

const C_LIME = color.rgb(0, 255, 0);
const C_GREEN = color.rgb(0, 128, 0);
const C_RED = color.rgb(255, 0, 0);
const C_MAROON = color.rgb(128, 0, 0);
const DI_PLUS_COLOR = String(color.new(C_LIME, 30));
const DI_MINUS_COLOR = String(color.new(C_RED, 30));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Squeeze Momentum', color: C_LIME, lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'Squeeze Dots', color: color.blue, lineWidth: 2, style: 'cross' },
  { id: 'plot2', title: 'ADX', color: color.white, lineWidth: 2 },
  { id: 'plot3', title: 'DI+', color: DI_PLUS_COLOR, lineWidth: 1 },
  { id: 'plot4', title: 'DI-', color: DI_MINUS_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'TradingMoja / SQZMOM ADX ',
  shortTitle: 'TradingMoja',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (v: number) => (Number.isFinite(v) ? v : 0);

/**
 * `ta.linreg(source, length, 0)` one bar at a time: the sums of the library function (x = 1 oldest .. length newest,
 * summed from the oldest value), na before bar `length - 1` and when a value of the window is NaN.
 */
class LinregStep implements Committable {
  private readonly values: number[] = [];
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(length: number) {
    const len = Math.trunc(length);
    if (len <= 0) throw new Error(`linreg: length must be greater than 0, got ${len}`);
    this.len = Math.floor(length);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const len = this.len;
    const h = this.values;
    if (h.length < len - 1) return NaN;
    // window: h[h.length - len + 1 .. h.length - 1], then the value
    const from = h.length - len + 1;
    if (isNaN(value)) return NaN;
    for (let j = from; j < h.length; j++) if (isNaN(h[j])) return NaN;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let j = 0; j < len; j++) {
      const x = j + 1;
      const y = j === len - 1 ? value : h[from + j];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
    const intercept = sumY / len - (slope * sumX) / len + slope;
    return intercept + slope * (len - 1 - 0);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pending);
  }
}

type Point = { time: number; value: number; color?: string };

interface SqzRun extends BarRunState<{ prevVal: number }> {
  /** ta.sma(close, sqz_lengthBB): null when it is the KC one (same length, same values) */
  basis: WindowSma | null;
  sd: WindowStdev;
  /** ta.sma(close, sqz_lengthKC): ma and the SMA of the momentum */
  ma: WindowSma;
  tr: ReturnType<typeof taStep.tr>;
  rangeMa: WindowSma;
  hh: WindowExtreme;
  ll: WindowExtreme;
  linreg: LinregStep;
  maxRecent: WindowExtreme;
  dmi: ReturnType<typeof taStep.dmi>;
  plots: Point[][];
}

function study(inputs: Partial<TradingmojaSqzmomAdxInputs>): BarStudy<SqzRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: SqzRun = {
        basis: cfg.sqzLengthBB === cfg.sqzLengthKC ? null : new WindowSma(cfg.sqzLengthBB), sd: new WindowStdev(cfg.sqzLengthBB),
        ma: new WindowSma(cfg.sqzLengthKC), tr: taStep.tr(), rangeMa: new WindowSma(cfg.sqzLengthKC),
        hh: new WindowExtreme(false, cfg.sqzLengthKC), ll: new WindowExtreme(true, cfg.sqzLengthKC),
        linreg: new LinregStep(cfg.sqzLengthKC), maxRecent: new WindowExtreme(false, cfg.scaleLookback),
        dmi: taStep.dmi(cfg.adxLen, cfg.adxLen),
        plots: Array.from({ length: 5 }, () => []),
        steps: [], vars: { prevVal: NaN }, lists: [], series: [],
      };
      s.steps = [...(s.basis ? [s.basis] : []), s.sd, s.ma, s.tr, s.rangeMa, s.hh, s.ll, s.linreg, s.maxRecent, s.dmi];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const close = b.close;
      // Bands: basis +- sqz_multKC * stdev (the Pine script uses the KC multiplier here)
      const ma = s.ma.step(close);
      const basis = s.basis ? s.basis.step(close) : ma;
      const sd = s.sd.step(close);
      const trv = s.tr.step(b.high, b.low, b.close);
      const rangeVal = cfg.sqzUseTR ? trv : b.high - b.low;
      const rangeMa = s.rangeMa.step(rangeVal);

      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      const smaKC = ma;
      const x = close - ((hh + ll) / 2 + smaKC) / 2;
      const v = s.linreg.step(x);

      // max_val_recent = ta.highest(math.abs(val_raw), scale_lookback)
      const m = s.maxRecent.step(Math.abs(v));
      const [diPlus, diMinus, adx] = s.dmi.step(b.high, b.low, b.close);

      const dev = cfg.sqzMultKC * sd;
      const upperBB = basis + dev;
      const lowerBB = basis - dev;
      const upperKC = ma + rangeMa * cfg.sqzMultKC;
      const lowerKC = ma - rangeMa * cfg.sqzMultKC;
      const sqzOn = gt(lowerBB, lowerKC) && lt(upperBB, upperKC);
      const sqzOff = lt(lowerBB, lowerKC) && gt(upperBB, upperKC);
      const noSqz = !sqzOn && !sqzOff;

      const prev = nz(s.vars.prevVal);
      s.vars.prevVal = v;
      const bcolor = gt(v, 0) ? (gt(v, prev) ? C_LIME : C_GREEN) : (lt(v, prev) ? C_RED : C_MAROON);
      const scolor = noSqz ? color.blue : sqzOn ? color.black : color.gray;

      // scaler = max_val_recent != 0 ? scale_target / max_val_recent : 1 (na != 0 is false: 1)
      const scaler = Number.isFinite(m) && Math.abs(m) > EPS ? cfg.scaleTarget / m : 1;
      const plotted = v * scaler;
      s.plots[0][i] = { time: t, value: Number.isFinite(plotted) ? plotted : NaN, color: bcolor };
      s.plots[1][i] = { time: t, value: 0, color: scolor };
      s.plots[2][i] = { time: t, value: adx, color: color.white };
      s.plots[3][i] = { time: t, value: cfg.showDi ? diPlus : NaN, color: DI_PLUS_COLOR };
      s.plots[4][i] = { time: t, value: cfg.showDi ? diMinus : NaN, color: DI_MINUS_COLOR };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        hlines: [
          { value: cfg.adxTh, options: { title: 'ADX Threshold', color: String(color.new(color.white, 70)), linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TradingmojaSqzmomAdxInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TradingmojaSqzmomAdxInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TradingmojaSqzmomAdx = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
