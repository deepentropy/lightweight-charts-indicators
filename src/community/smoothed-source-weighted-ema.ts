/**
 * Smoothed Source Weighted EMA
 *
 * EMA of the close with a band of one standard deviation of the close around the close (upper / lower source).
 * Long when the lower source is above EMA * upper weight, short when the upper source is below EMA * lower weight;
 * the state is kept until the other signal. The EMA is coloured by the state (grey before the first signal), with
 * three wider glow lines; optional logic plots (weighted EMAs, sources, close) with fills; triangles when the state
 * turns long / short and optional bar colouring.
 *
 * Reference: "Smoothed Source Weighted EMA" by Clokivez
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Clokivez
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SmoothedSourceWeightedEmaInputs {
  /** Colour the bars with the state colour */
  barColor: boolean;
  /** Draw the glow lines */
  glow: boolean;
  /** Draw the logic plots and fills */
  plotLogic: boolean;
  /** Length of the standard deviation of the close */
  smoothingLength: number;
  /** EMA length */
  emaLength: number;
  /** EMA upper weight (long condition) */
  upperWeight: number;
  /** EMA lower weight (short condition) */
  lowerWeight: number;
}

export const defaultInputs: SmoothedSourceWeightedEmaInputs = {
  barColor: true,
  glow: true,
  plotLogic: false,
  smoothingLength: 32,
  emaLength: 36,
  upperWeight: 1.004,
  lowerWeight: 1.028,
};

const T1 = "Length of the price's close Standard Deviations, the higher the value, the smoother(slower) the signal";
const T3 = "EMA's upper weight (smoothing the long condition), the more weight you add, the slower the long condition will be, since the long condition is ~Lower SD's close must be superior to this Weighted EMA~";
const T4 = "EMA's lower weight (smoothing the short condition), the more weight you add, the slower the short condition will be, since the short condition is ~Upper SD's close must be inferior to this Weighted EMA~";

export const inputConfig: InputConfig[] = [
  { id: 'barColor', type: 'bool', title: 'Bar Color', defval: true, inline: 'A' },
  { id: 'glow', type: 'bool', title: 'Make it Glow?', defval: true, inline: 'A' },
  { id: 'plotLogic', type: 'bool', title: "Plot Indicator's Logic?", defval: false },
  { id: 'smoothingLength', type: 'int', title: 'Smoothing Length', defval: 32, tooltip: T1 },
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 36 },
  { id: 'upperWeight', type: 'float', title: 'EMA Upper Weight', defval: 1.004, step: 0.002, tooltip: T3 },
  { id: 'lowerWeight', type: 'float', title: 'EMA Lower Weight', defval: 1.028, step: 0.002, tooltip: T4 },
];

const LONG = '#00ffbf';
const SHORT = '#ff0040';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: color.gray, lineWidth: 2 },
  { id: 'plot1', title: 'EMA', color: String(color.new(color.gray, 30)), lineWidth: 4 },
  { id: 'plot2', title: 'EMA', color: String(color.new(color.gray, 80)), lineWidth: 10 },
  { id: 'plot3', title: 'EMA', color: String(color.new(color.gray, 85)), lineWidth: 16 },
  { id: 'plot4', title: 'Upper EMA Weight', color: color.green, lineWidth: 1 },
  { id: 'plot5', title: 'Lower EMA Weight', color: color.red, lineWidth: 1 },
  { id: 'plot6', title: 'Upper Source', color: String(color.new(color.red, 85)), lineWidth: 1 },
  { id: 'plot7', title: 'Lower Source', color: String(color.new(color.lime, 85)), lineWidth: 1 },
  { id: 'plot8', title: 'Close', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Smoothed Source Weighted EMA',
  shortTitle: 'SS WEMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface SswemaVars {
  /** T := L ? 1 : S ? -1 : T[1]; col := L ? #00ffbf : S ? #ff0040 : col[1] (both na before the first signal) */
  t: number;
  col: string | null;
}

interface SswemaRun extends BarRunState<SswemaVars> {
  sd: WindowStdev;
  ema: ReturnType<typeof taStep.ema>;
  up: ReturnType<typeof taStep.crossover>;
  down: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
  logicCol: string[];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<SmoothedSourceWeightedEmaInputs>): BarStudy<SswemaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const NA = 'transparent';
  const sourceUpCol = String(color.new(color.red, 85));
  const sourceDnCol = String(color.new(color.lime, 85));
  return {
    init() {
      const s: SswemaRun = {
        sd: new WindowStdev(cfg.smoothingLength),
        ema: taStep.ema(cfg.emaLength),
        up: taStep.crossover(),
        down: taStep.crossunder(),
        plots: Array.from({ length: 9 }, () => []),
        logicCol: [], markers: [], barColors: [],
        steps: [], vars: { t: NaN, col: null }, lists: [], series: [],
      };
      s.steps = [s.sd, s.ema, s.up, s.down];
      s.lists = [s.markers, s.barColors];
      s.series = [...s.plots, s.logicCol];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const time = b.time;
      const cl = b.close;
      const srcsd = s.sd.step(cl);
      const ema = s.ema.step(cl);
      const L = gt(cl - srcsd, ema * cfg.upperWeight);
      const S = lt(cl + srcsd, ema * cfg.lowerWeight);
      if (L) {
        v.t = 1;
        v.col = LONG;
      } else if (S) {
        v.t = -1;
        v.col = SHORT;
      }
      const col = v.col;
      const arrowL = s.up.step(v.t, 0);
      const arrowS = s.down.step(v.t, 0);

      const p = s.plots;
      // plot(ema, "EMA", col, 2)
      p[0][i] = { time, value: ema, color: col ?? NA };
      // plot(ema, "EMA", gy ? gcol : na, 4) / (gy ? gcol2 : na, 10) / (gy ? gcol3 : na, 16)
      // color.new(col, x): a na col gives black with that transparency
      p[1][i] = { time, value: ema, color: cfg.glow ? String(color.new(col as string, 30)) : NA };
      p[2][i] = { time, value: ema, color: cfg.glow ? String(color.new(col as string, 80)) : NA };
      p[3][i] = { time, value: ema, color: cfg.glow ? String(color.new(col as string, 85)) : NA };
      // plot(ema * wl, "Upper EMA Weight", pl ? color.green : na, 1); plot(ema * ws, "Lower EMA Weight", pl ? color.red : na, 1)
      p[4][i] = { time, value: ema * cfg.upperWeight, color: cfg.plotLogic ? color.green : NA };
      p[5][i] = { time, value: ema * cfg.lowerWeight, color: cfg.plotLogic ? color.red : NA };
      // plot(uppersrc, "Upper Source", pl ? color.new(color.red, 85) : na, 1); plot(lowersrc, "Lower Source", ...)
      p[6][i] = { time, value: cl + srcsd, color: cfg.plotLogic ? sourceUpCol : NA };
      p[7][i] = { time, value: cl - srcsd, color: cfg.plotLogic ? sourceDnCol : NA };
      // closeplot = plot(pl ? close : na)
      p[8][i] = { time, value: cfg.plotLogic ? cl : NaN, color: '#2962FF' };
      // fill(emaplot, emaUPplot, pl ? col : na); fill(emaplot, emaDNplot, pl ? col : na)
      s.logicCol[i] = cfg.plotLogic && col !== null ? col : NA;

      // plotshape(arrowL, "Real Buy", shape.triangleup, location.belowbar, #00ffbf, size = size.tiny, force_overlay = true)
      if (arrowL) s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: LONG, size: 'tiny', forceOverlay: true });
      // plotshape(arrowS, "Real Sell", shape.triangledown, location.abovebar, #ff0040, size = size.tiny, force_overlay = true)
      if (arrowS) s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: SHORT, size: 'tiny', forceOverlay: true });
      // barcolor(bc ? col : na)
      if (cfg.barColor && col !== null) s.barColors.push({ time, color: col });
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      const plots: Record<string, Point[]> = {};
      p.forEach((pl, k) => { plots[`plot${k}`] = pl.slice(); });
      const fills = [
        { plot1: 'plot0', plot2: 'plot4', colors: s.logicCol.slice() },
        { plot1: 'plot0', plot2: 'plot5', colors: s.logicCol.slice() },
        // fill(closeplot, uppersrcplot, pl ? color.new(color.red, 85) : na); fill(closeplot, lowersrcplot, pl ? color.new(color.lime, 85) : na)
        { plot1: 'plot8', plot2: 'plot6', colors: new Array<string>(n).fill(cfg.plotLogic ? sourceUpCol : NA) },
        { plot1: 'plot8', plot2: 'plot7', colors: new Array<string>(n).fill(cfg.plotLogic ? sourceDnCol : NA) },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SmoothedSourceWeightedEmaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SmoothedSourceWeightedEmaInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const SmoothedSourceWeightedEma = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
