/**
 * Ehlers Maclaurin Ultimate Smoother [CT]
 *
 * Two smoothers of the source. Original: John F. Ehlers' UltimateSmoother(src, length) (the source on the first 4
 * bars, then the 2-pole recursion). Maclaurin: a high-pass filter of the source (period hpLength, sine / cosine by a
 * 5-term Maclaurin series) smoothed by the same 2-pole recursion with a Maclaurin cosine. The line colour comes from
 * the Original smoother: in Normal mode the up colour when it rises, the down colour when it falls, else the previous
 * colour; in Intensity mode a green / red shade whose strength is |change| / ATR(14) * 10 * 255 * multiplier. The
 * line uses the colour of the previous bar; the bars take the current colour with a transparency of 30.
 *
 * Reference: "Ehlers Maclaurin Ultimate Smoother [CT]" by Mupsje
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © 2024 by Mupsje aka CasaTropical. Based on original work by John F. Ehlers (TASC April 2024,
 * The Ultimate Smoother), provided by PineCoders. Enhanced with Maclaurin Series by Casa Tropical (CT), based on
 * John F. Ehlers' SuperSmoother.
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EhlersMaclaurinUltimateSmootherInputs {
  /** Plotted smoother */
  plotType: 'Original SuperSmoother' | 'Maclaurin SuperSmoother';
  /** Smoothing period */
  length: number;
  /** Period of the high-pass filter (Maclaurin smoother) */
  hpLength: number;
  /** Source */
  src: SourceType;
  /** Normal: fixed up / down colours; Intensity: shade by the change / ATR */
  colorMode: 'Normal' | 'Intensity';
  /** Colour by movement (off: the base colour) */
  smartColor: boolean;
  /** Multiplier of the colour intensity (Intensity mode) */
  intensityMultiplier: number;
  /** Base colour when Colorize is off */
  colorMono: string;
  /** Colour of a rising line */
  colorUp: string;
  /** Colour of a falling line */
  colorDown: string;
}

export const defaultInputs: EhlersMaclaurinUltimateSmootherInputs = {
  plotType: 'Original SuperSmoother',
  length: 30,
  hpLength: 10,
  src: 'close',
  colorMode: 'Normal',
  smartColor: true,
  intensityMultiplier: 1.0,
  colorMono: '#2196F3',
  colorUp: '#4CAF50',
  colorDown: '#F44336',
};

export const inputConfig: InputConfig[] = [
  { id: 'plotType', type: 'string', title: 'Plot Type', defval: 'Original SuperSmoother',
    options: ['Original SuperSmoother', 'Maclaurin SuperSmoother'] },
  { id: 'length', type: 'int', title: 'Length', defval: 30 },
  { id: 'hpLength', type: 'int', title: 'hpLength', defval: 10 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'colorMode', type: 'string', title: 'Color Mode', defval: 'Normal', options: ['Normal', 'Intensity'] },
  { id: 'smartColor', type: 'bool', title: 'Colorize', defval: true },
  { id: 'intensityMultiplier', type: 'float', title: 'Intensity Multiplier', defval: 1.0, min: 0.1, max: 5.0, step: 0.1,
    group: 'Color Settings' },
  { id: 'colorMono', type: 'color', title: 'Colours', defval: '#2196F3' },
  { id: 'colorUp', type: 'color', title: 'Up colour', defval: '#4CAF50' },
  { id: 'colorDown', type: 'color', title: 'Down colour', defval: '#F44336' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperSmoother Plot', color: '#2196F3', lineWidth: 2 },
];

export const metadata = {
  title: 'Ehlers Maclaurin Ultimate Smoother [CT]',
  shortTitle: 'EMSS [CT]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

/** power(base, exponent): iterative product */
function power(base: number, exponent: number): number {
  let result = 1.0;
  for (let i = 1; i <= exponent; i++) result = result * base;
  return result;
}

/** factorial(n): iterative product */
function factorial(n: number): number {
  let result = 1.0;
  for (let i = 1; i <= n; i++) result = result * i;
  return result;
}

/** Sine by the first 5 terms of the Maclaurin series */
function approxSin(x: number): number {
  const term1 = x;
  const term2 = (-1 * power(x, 3)) / factorial(3);
  const term3 = power(x, 5) / factorial(5);
  const term4 = (-1 * power(x, 7)) / factorial(7);
  const term5 = power(x, 9) / factorial(9);
  return term1 + term2 + term3 + term4 + term5;
}

/** Cosine by the first 5 terms of the Maclaurin series */
function approxCos(x: number): number {
  const term1 = 1;
  const term2 = (-1 * power(x, 2)) / factorial(2);
  const term3 = power(x, 4) / factorial(4);
  const term4 = (-1 * power(x, 6)) / factorial(6);
  const term5 = power(x, 8) / factorial(8);
  return term1 + term2 + term3 + term4 + term5;
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface EmssRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr> | null;
  src: number[];
  us: number[];
  hp: number[];
  usEnh: number[];
  clrMa: (string | undefined)[];
  plot0: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<EhlersMaclaurinUltimateSmootherInputs>): BarStudy<EmssRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, hpLength } = cfg;
  const value = barSource(cfg.src);

  // UltimateSmoother(src, length) coefficients
  const a1 = Math.exp((-1.414 * Math.PI) / length);
  const c2 = 2.0 * a1 * Math.cos((1.414 * Math.PI) / length);
  const c3 = -a1 * a1;
  const c1 = (1.0 + c2 - c3) / 4.0;

  // erf_ultimatesmoother_enhanced(src, hpLength, length) coefficients
  const pi = 2 * Math.asin(1);
  const twoPiPrd = (2 * pi) / hpLength;
  const alpha1 = (approxCos(twoPiPrd) + approxSin(twoPiPrd) - 1) / approxCos(twoPiPrd);
  const ea1 = Math.exp((-1.414 * pi) / length);
  const ec2 = 2.0 * ea1 * approxCos((1.414 * pi) / length);
  const ec3 = -ea1 * ea1;
  const ec1 = (1.0 + ec2 - ec3) / 4.0;

  const noAtr = !cfg.smartColor || cfg.colorMode === 'Normal';
  const plotOriginal = cfg.plotType === 'Original SuperSmoother';
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const atr = noAtr ? null : taStep.atr(14);
      const s: EmssRun = {
        atr, src: [], us: [], hp: [], usEnh: [], clrMa: [], plot0: [], barColors: [],
        steps: atr ? [atr] : [], vars: {}, lists: [], series: [],
      };
      s.series = [s.src, s.us, s.hp, s.usEnh, s.clrMa, s.plot0, s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { src, us, hp, usEnh, clrMa } = s;
      src[i] = value(b) ?? NaN;

      // UltimateSmoother(src, length): us = src; from bar_index 4 on the 2-pole recursion
      us[i] = src[i];
      if (i >= 4) {
        us[i] = (1.0 - c1) * src[i] + (2.0 * c1 - c2) * src[i - 1] - (c1 + c3) * src[i - 2]
          + c2 * nz(us[i - 1]) + c3 * nz(us[i - 2]);
      }

      // hp := (1 - alpha1 / 2) * (src - nz(src[1])) + (1 - alpha1) * nz(hp[1])
      hp[i] = (1 - alpha1 / 2) * (src[i] - nz(i > 0 ? src[i - 1] : NaN)) + (1 - alpha1) * nz(i > 0 ? hp[i - 1] : NaN);
      usEnh[i] = hp[i];
      if (i >= 4) {
        usEnh[i] = (1.0 - ec1) * hp[i] + (2.0 * ec1 - ec2) * hp[i - 1] - (ec1 + ec3) * hp[i - 2]
          + ec2 * nz(usEnh[i - 1]) + ec3 * nz(usEnh[i - 2]);
      }

      // MA_Smart_Color(us, smart_clr_ON, clr_up, clr_dn, clr_mono, color_mode); na colour = undefined
      const atr = s.atr ? s.atr.step(b.high, b.low, b.close) ?? NaN : NaN;
      const prev = i > 0 ? us[i - 1] : NaN;
      if (!cfg.smartColor) {
        clrMa[i] = cfg.colorMono;
      } else if (cfg.colorMode === 'Normal') {
        clrMa[i] = gt(us[i], prev) ? cfg.colorUp : lt(us[i], prev) ? cfg.colorDown : (i > 0 ? clrMa[i - 1] : undefined);
      } else {
        // intensity_color(ma - ma[1]): value / ta.atr(14) * 10 (a plain division: x / 0 is +-infinity)
        const change = us[i] - prev;
        const normalized = (change / atr) * 10;
        const strength = Math.abs(normalized) * 255 * cfg.intensityMultiplier;
        clrMa[i] = gt(change, 0)
          ? String(color.rgb(0, Math.min(strength, 255), 0, 70))
          : String(color.rgb(Math.min(strength, 255), 0, 0, 70));
      }

      const v = plotOriginal ? us[i] : usEnh[i];
      const c = i > 0 ? clrMa[i - 1] : undefined; // color = clr_ma[1]
      s.plot0[i] = { time: b.time, value: Number.isFinite(v) ? v : NaN, ...(c !== undefined ? { color: c } : {}) };

      // barcolor(color.new(clr_ma, 30)): color.new(na, 30) is black with a transparency of 30
      s.barColors[i] = {
        time: b.time as number,
        color: clrMa[i] === undefined ? 'rgba(0, 0, 0, 0.7)' : String(color.new(clrMa[i] as string, 30)),
      };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EhlersMaclaurinUltimateSmootherInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<EhlersMaclaurinUltimateSmootherInputs> = {},
): IndicatorResult & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const EhlersMaclaurinUltimateSmoother = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
