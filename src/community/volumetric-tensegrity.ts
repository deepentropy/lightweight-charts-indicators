/**
 * Volumetric Tensegrity
 *
 * ZVOL: the z-score of the volume, (volume - sma(volume, maLen)) / stdev(volume, stdLen) (0 when the stdev is 0 or
 * na), times 50,000, drawn as a histogram coloured by zone (red > 2.5, orange > 1, yellow > 0, teal > -1, else blue).
 * OBVX: the spread between the OBV and its rolling volume-weighted average over `fastLen` bars (from cumulative
 * sums), normalised to -1..1 over the highest / lowest spread of `normLen` bars, smoothed by a 5-bar EMA and times
 * 50,000; green when it is at or above its value 2 bars ago, else red.
 *
 * Reference: "Volumetric Tensegrity" by TheLeadingIndicator
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Open Source | Designed by Adrian Dyer for "The Leading Indicator", Engineered by PineForge
 * Laboratory (2025)
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumetricTensegrityInputs {
  /** ZVOL SMA length */
  zvolMaLen: number;
  /** ZVOL standard deviation length */
  zvolStdLen: number;
  /** OBVX rolling VWMA length */
  obvxFastLen: number;
  /** OBVX normalisation length (highest / lowest) */
  obvxNormLen: number;
}

export const defaultInputs: VolumetricTensegrityInputs = {
  zvolMaLen: 55,
  zvolStdLen: 55,
  obvxFastLen: 13,
  obvxNormLen: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'zvolMaLen', type: 'int', title: 'ZVOL MA', defval: 55, min: 2 },
  { id: 'zvolStdLen', type: 'int', title: 'ZVOL Std Deviation', defval: 55, min: 2 },
  { id: 'obvxFastLen', type: 'int', title: 'OBVX Fast VWMA', defval: 13, min: 1 },
  { id: 'obvxNormLen', type: 'int', title: 'OBVX Normalization', defval: 55, min: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '🫁 ZVOL Respiration Histogram', color: color.teal, lineWidth: 1, style: 'histogram' },
  { id: 'plot1', title: '🖐️ OBVX Spread Line', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'Volumetric Tensegrity',
  shortTitle: 'VTense',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a != b beyond 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color?: string };

interface VtRun extends BarRunState<Record<string, never>> {
  zvolMa: WindowSma;
  zvolStd: WindowStdev;
  change: ReturnType<typeof taStep.change>;
  obv: ReturnType<typeof taStep.cum>;
  cumSvStep: ReturnType<typeof taStep.cum>;
  cumVStep: ReturnType<typeof taStep.cum>;
  hi: WindowExtreme;
  lo: WindowExtreme;
  ema: ReturnType<typeof taStep.ema>;
  cumSv: number[];
  cumV: number[];
  smoothed: number[];
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<VolumetricTensegrityInputs>): BarStudy<VtRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.obvxFastLen;
  return {
    init() {
      // the length checks of ta.sma, ta.stdev and ta.highest / ta.lowest
      taStep.sma().step(0, cfg.zvolMaLen);
      taStep.stdev().step(0, cfg.zvolStdLen);
      taStep.highest().step(0, cfg.obvxNormLen);
      const s: VtRun = {
        zvolMa: new WindowSma(cfg.zvolMaLen), zvolStd: new WindowStdev(cfg.zvolStdLen), change: taStep.change(),
        obv: taStep.cum(), cumSvStep: taStep.cum(), cumVStep: taStep.cum(),
        hi: new WindowExtreme(false, cfg.obvxNormLen), lo: new WindowExtreme(true, cfg.obvxNormLen), ema: taStep.ema(5),
        cumSv: [], cumV: [], smoothed: [], plot0: [], plot1: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.zvolMa, s.zvolStd, s.change, s.obv, s.cumSvStep, s.cumVStep, s.hi, s.lo, s.ema];
      s.series = [s.cumSv, s.cumV, s.smoothed, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      // ZVOL
      const zvolMa = s.zvolMa.step(volume);
      const zvolStd = s.zvolStd.step(volume);
      const z = ne(zvolStd, 0) ? (volume - zvolMa) / zvolStd : 0.0;

      // OBVX: obv = ta.cum(math.sign(ta.change(close)) * volume)
      const o = s.obv.step(Math.sign(s.change.step(b.close)) * volume);
      // vwma(src, len): (ta.cum(src * volume) - ta.cum(src * volume)[len]) / (ta.cum(volume) - ta.cum(volume)[len]),
      // src when the denominator is 0 (or na)
      const cumSv = s.cumSvStep.step(o * volume);
      const cumV = s.cumVStep.step(volume);
      s.cumSv[i] = cumSv;
      s.cumV[i] = cumV;
      const num = cumSv - (i >= len ? s.cumSv[i - len] : NaN);
      const den = cumV - (i >= len ? s.cumV[i - len] : NaN);
      const fast = ne(den, 0) ? num / den : o;
      const obvxSpread = o - fast;

      // Normalise the spread
      const obvxHigh = s.hi.step(obvxSpread);
      const obvxLow = s.lo.step(obvxSpread);
      const range = obvxHigh - obvxLow;
      const normalized = ne(range, 0) ? ((obvxSpread - obvxLow) / range) * 2 - 1 : 0;
      const smoothed = s.ema.step(normalized);
      s.smoothed[i] = smoothed;

      const zc = gt(z, 2.5) ? color.red : gt(z, 1.0) ? color.orange : gt(z, 0.0) ? color.yellow
        : gt(z, -1.0) ? color.teal : color.blue;
      const zr = z * 50000;
      s.plot0[i] = { time: b.time, value: Number.isFinite(zr) ? zr : NaN, color: zc };
      const oc = i >= 2 && ge(smoothed, s.smoothed[i - 2]) ? color.green : color.red;
      const or = smoothed * 50000;
      s.plot1[i] = { time: b.time, value: Number.isFinite(or) ? or : NaN, color: oc };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumetricTensegrityInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumetricTensegrityInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VolumetricTensegrity = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
