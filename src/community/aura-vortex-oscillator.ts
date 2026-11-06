/**
 * Aura Vortex Oscillator
 *
 * The z-score of the close over `Vortex Sensitivity` bars ((close - sma) / stdev), times the intensity, goes through
 * an arctangent scaled to about -100..100 (atan(z * intensity) * 63.66). Its EMA over `Aura Smoothing` bars is the
 * pulse line, green above 0 and red below. Five hidden EMAs of the raw signal (lengths smooth + 2, + 4, + 8, + 12,
 * + 16) carry a fill between the fastest and the slowest, coloured by the pulse sign. Circles mark the crosses of the
 * pulse with 0; the background is coloured when the pulse is above 50 or below -50.
 *
 * Reference: "Aura Vortex Oscillator [Pineify]" by Pineify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Pineify
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AuraVortexOscillatorInputs {
  /** Length of the SMA / stdev of the z-score */
  len: number;
  /** Multiplier of the z-score before the arctangent */
  preGain: number;
  /** EMA length of the pulse line */
  smooth: number;
  /** Compute the five mesh EMAs (the fill between them) */
  meshEnabled: boolean;
  bullColor: string;
  bearColor: string;
  neutColor: string;
}

export const defaultInputs: AuraVortexOscillatorInputs = {
  len: 20,
  preGain: 2.0,
  smooth: 8,
  meshEnabled: true,
  bullColor: '#00ffbb',
  bearColor: '#ff0055',
  neutColor: '#787b86',
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Vortex Sensitivity', defval: 20, min: 5, tooltip: 'Base period for momentum calculation' },
  { id: 'preGain', type: 'float', title: 'Vortex Intensity', defval: 2.0, min: 0.1, step: 0.1,
    tooltip: "Amplifies the 'squarification' of the signal" },
  { id: 'smooth', type: 'int', title: 'Aura Smoothing', defval: 8, min: 1 },
  { id: 'meshEnabled', type: 'bool', title: 'Enable Vortex Mesh', defval: true, tooltip: 'Displays layered oscillators for a depth effect' },
  { id: 'bullColor', type: 'color', title: 'Bullish Aura', defval: '#00ffbb', inline: 'color' },
  { id: 'bearColor', type: 'color', title: 'Bearish Aura', defval: '#ff0055', inline: 'color' },
  { id: 'neutColor', type: 'color', title: 'Neutral', defval: '#787b86', inline: 'color' },
];

const MESH_COL = String(color.new('#00ffbb', 95));
const GLOW_COL = String(color.new(color.white, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Mesh 1', color: MESH_COL, lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Mesh 2', color: MESH_COL, lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Mesh 3', color: MESH_COL, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Mesh 4', color: MESH_COL, lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Mesh 5', color: MESH_COL, lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Vortex Pulse', color: '#00ffbb', lineWidth: 3 },
  { id: 'plot6', title: 'Glow Core', color: GLOW_COL, lineWidth: 1 },
];

/** hline(0 / 50 / -50) with the default colours (the result `hlines` carry the input colours) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Equilibrium', color: String(color.new('#787b86', 50)), linestyle: 'dashed' },
  { id: 'hline_upper', price: 50, title: 'Upper Boundary', color: String(color.new('#00ffbb', 80)), linestyle: 'dashed' },
  { id: 'hline_lower', price: -50, title: 'Lower Boundary', color: String(color.new('#ff0055', 80)), linestyle: 'dashed' },
];

/** fill(m1, m5): per-bar colour in the result, the default bullish colour here */
export const fillConfig: FillConfig[] = [
  { id: 'fill_aura', plot1: 'plot0', plot2: 'plot4', color: String(color.new('#00ffbb', 75)), title: 'Vortex Aura Fill' },
];

export const metadata = {
  title: 'Aura Vortex Oscillator [Pineify]',
  shortTitle: 'Aura Vortex',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface VortexRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  sd: WindowStdev;
  ema: ReturnType<typeof taStep.ema>;
  mesh: ReturnType<typeof taStep.ema>[];
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDown: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
  fillColors: string[];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<AuraVortexOscillatorInputs>): BarStudy<VortexRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const meshCol = String(color.new(cfg.bullColor, 95));
  const bullFill = String(color.new(cfg.bullColor, 75));
  const bearFill = String(color.new(cfg.bearColor, 75));
  const bullBg = String(color.new(cfg.bullColor, 95));
  const bearBg = String(color.new(cfg.bearColor, 95));
  return {
    init() {
      const s: VortexRun = {
        sma: new WindowSma(cfg.len), sd: new WindowStdev(cfg.len), ema: taStep.ema(cfg.smooth),
        // plot_aura(index) = ta.ema(mainSignal, smooth + index * 2), for index 1, 2, 4, 6, 8
        mesh: cfg.meshEnabled ? [1, 2, 4, 6, 8].map((k) => taStep.ema(cfg.smooth + k * 2)) : [],
        crossUp: taStep.crossover(), crossDown: taStep.crossunder(), plots: Array.from({ length: 7 }, () => []),
        fillColors: [], markers: [], bgColors: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.sma, s.sd, s.ema, ...s.mesh, s.crossUp, s.crossDown];
      s.lists = [s.markers, s.bgColors];
      s.series = [...s.plots, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // vortex_calc(close, len, preGain): z = (src - sma) / stdev (a plain division); atan(z * intensity) * 63.66
      const ma = s.sma.step(b.close);
      const sd = s.sd.step(b.close);
      const mainSignal = Math.atan(((b.close - ma) / sd) * cfg.preGain) * 63.66;
      const smoothed = s.ema.step(mainSignal);
      const p = s.plots;
      for (let k = 0; k < 5; k++) {
        p[k][i] = { time: t, value: cfg.meshEnabled ? s.mesh[k].step(mainSignal) : NaN, color: meshCol };
      }
      p[5][i] = { time: t, value: smoothed, color: gt(smoothed, 0) ? cfg.bullColor : cfg.bearColor };
      p[6][i] = { time: t, value: smoothed, color: GLOW_COL };
      // fill(m1, m5, color = smoothed > 0 ? color.new(bullColor, 75) : color.new(bearColor, 75))
      s.fillColors[i] = gt(smoothed, 0) ? bullFill : bearFill;

      // crossUp = ta.crossover(smoothed, 0); crossDown = ta.crossunder(smoothed, 0) (exact comparisons)
      const crossUp = s.crossUp.step(smoothed, 0);
      const crossDown = s.crossDown.step(smoothed, 0);
      // plotshape(crossUp ? 0 : na, shape.circle, location.absolute, size = size.tiny)
      if (crossUp) {
        s.markers.push({ id: 'shape0', time: t, position: 'atPriceMiddle', price: 0, shape: 'circle', color: cfg.bullColor, size: 'tiny' });
      }
      if (crossDown) {
        s.markers.push({ id: 'shape1', time: t, position: 'atPriceMiddle', price: 0, shape: 'circle', color: cfg.bearColor, size: 'tiny' });
      }
      if (gt(smoothed, 50)) s.bgColors.push({ time: t, color: bullBg });
      else if (lt(smoothed, -50)) s.bgColors.push({ time: t, color: bearBg });
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(),
        },
        hlines: [
          { value: 0, options: { title: 'Equilibrium', color: String(color.new(cfg.neutColor, 50)), linestyle: 'dashed' } },
          { value: 50, options: { title: 'Upper Boundary', color: String(color.new(cfg.bullColor, 80)), linestyle: 'dashed' } },
          { value: -50, options: { title: 'Lower Boundary', color: String(color.new(cfg.bearColor, 80)), linestyle: 'dashed' } },
        ],
        fills: [{
          plot1: 'plot0', plot2: 'plot4', options: { title: 'Vortex Aura Fill' },
          colors: s.fillColors.slice(),
        }],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AuraVortexOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AuraVortexOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AuraVortexOscillator = {
  calculate,
  createRun,
  metadata,

  defaultInputs,
  inputConfig,
  plotConfig,
};
