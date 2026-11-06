/**
 * Parabolic Stoch SAR Visualizer
 *
 * A stochastic %K (length `stochLen`) smoothed twice with a 3-bar SMA, and a parabolic SAR computed on that
 * oscillator (not on price): the SAR follows the extreme point with an acceleration factor that grows by
 * `accelStep` at each new extreme up to `accelMax`; on a reversal the SAR restarts 5 points beyond the oscillator.
 * The SAR is kept within 0..100. The oscillator line has a red-to-green colour gradient between the lower and
 * upper thresholds with two faint "glow" lines; SAR dots are drawn 12 points above (uptrend) or below (downtrend)
 * the SAR, with a minimum number of bars and a minimum SAR move between dots. Bands at the thresholds and at 50,
 * a background fill between the bands and fills between the oscillator and 50.
 *
 * Reference: "Parabolic Stoch SAR Visualizer" by BOSWaves
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ParabolicStochSarVisualizerInputs {
  stochLen: number;
  upperThresh: number;
  lowerThresh: number;
  showSAR: boolean;
  accelStart: number;
  accelStep: number;
  accelMax: number;
  /** Minimum number of bars between two dots */
  minBarsGap: number;
  /** Minimum SAR move between two dots */
  minSARMove: number;
  clrUptrend: string;
  clrDowntrend: string;
}

export const defaultInputs: ParabolicStochSarVisualizerInputs = {
  stochLen: 14,
  upperThresh: 70,
  lowerThresh: 30,
  showSAR: true,
  accelStart: 0.02,
  accelStep: 0.1,
  accelMax: 0.2,
  minBarsGap: 1,
  minSARMove: 0.0,
  clrUptrend: String(color.new('#00c853', 66)),
  clrDowntrend: String(color.new('#d50000', 82)),
};

export const inputConfig: InputConfig[] = [
  { id: 'stochLen', type: 'int', title: 'Stochastic Length', defval: 14, group: 'Oscillator' },
  { id: 'upperThresh', type: 'int', title: 'Upper Threshold', defval: 70, inline: 'thresh' },
  { id: 'lowerThresh', type: 'int', title: 'Lower Threshold', defval: 30, inline: 'thresh' },
  { id: 'showSAR', type: 'bool', title: 'Show SAR Dots', defval: true, group: 'SAR Settings' },
  { id: 'accelStart', type: 'float', title: 'Accel Start', defval: 0.02, step: 0.01, inline: 'accel', group: 'SAR Settings' },
  { id: 'accelStep', type: 'float', title: 'Accel Increment', defval: 0.1, step: 0.01, inline: 'accel', group: 'SAR Settings' },
  { id: 'accelMax', type: 'float', title: 'Accel Max', defval: 0.2, step: 0.01, inline: 'accel', group: 'SAR Settings' },
  { id: 'minBarsGap', type: 'int', title: 'Min Bars Between Dots', defval: 1, min: 1 },
  { id: 'minSARMove', type: 'float', title: 'Min SAR Move Between Dots', defval: 0.0 },
  { id: 'clrUptrend', type: 'color', title: 'Uptrend Color', defval: defaultInputs.clrUptrend, inline: 'clr' },
  { id: 'clrDowntrend', type: 'color', title: 'Downtrend Color', defval: defaultInputs.clrDowntrend, inline: 'clr' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stoch %K Smooth', color: '#00c853', lineWidth: 3 },
  { id: 'plot1', title: 'Glow Upper', color: String(color.new('#00c853', 90)), lineWidth: 6 },
  { id: 'plot2', title: 'Glow Lower', color: String(color.new('#00c853', 90)), lineWidth: 6 },
  { id: 'plot3', title: 'Mid', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'Stoch %K (Overbought Fill)', color: '#2962FF', lineWidth: 1 },
  { id: 'plot5', title: 'Stoch %K (Oversold Fill)', color: '#2962FF', lineWidth: 1 },
  { id: 'plot6', title: 'SAR Dot Glow1', color: String(color.new('#00c853', 66)), lineWidth: 4, style: 'circles' },
  { id: 'plot7', title: 'SAR Dot Glow2', color: String(color.new('#00c853', 66)), lineWidth: 3, style: 'circles' },
  { id: 'plot8', title: 'SAR Dot Main', color: String(color.new('#00c853', 66)), lineWidth: 1, style: 'circles' },
];

/** hline(upperThresh / 50 / lowerThresh) with the default levels */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 70, title: 'Upper Band', color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_mid', price: 50, title: 'Mid Band', color: String(color.new('#787B86', 50)), linestyle: 'dashed' },
  { id: 'hline_lower', price: 30, title: 'Lower Band', color: '#787B86', linestyle: 'dashed' },
];

const BAND_FILL = String(color.new('#c292571a', 90));
const OB_FILL = String(color.new(color.red, 80));
const OS_FILL = String(color.new(color.orange, 80));

/** fill(bandTop, bandLow, color.new(#c292571a, 90), title = "Background Fill") and the fills to the 50 line */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'hline_upper', plot2: 'hline_lower', color: BAND_FILL, title: 'Background Fill' },
  { id: 'fill_ob', plot1: 'plot4', plot2: 'plot3', color: OB_FILL, title: 'Overbought Gradient' },
  { id: 'fill_os', plot1: 'plot3', plot2: 'plot5', color: OS_FILL, title: 'Oversold Gradient' },
];

export const metadata = {
  title: 'Parabolic Stoch SAR Visualizer',
  shortTitle: 'Parabolic Stoch SAR Visualizer',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine math.min / math.max: na when an argument is na */
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));

/** '#rrggbb[aa]' / 'rgb[a](r, g, b[, a])' -> [r, g, b] */
function rgbOf(c: string): [number, number, number] {
  return [color.r(c), color.g(c), color.b(c)];
}

type Point = { time: number; value: number; color?: string };

interface PsarVars {
  /** f_parabolic state */
  sar: number;
  ep: number;
  af: number;
  isUp: boolean;
  /** var lastDotIdx / lastDotVal (bar_index differences do not depend on the first bar index) */
  lastDotIdx: number;
  lastDotVal: number;
}

interface PsarRun extends BarRunState<PsarVars> {
  stoch: ReturnType<typeof taStep.stoch>;
  sma1: WindowSma;
  sma2: WindowSma;
  plots: Point[][];
}

function study(inputs: Partial<ParabolicStochSarVisualizerInputs>): BarStudy<PsarRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  // gradColor(clrDowntrend, clrUptrend, oscPct): color.rgb(math.round(r1 + (r2 - r1) * pct), ...); an na channel
  // (pct na) is 0 in color.rgb
  const [r1, g1, b1] = rgbOf(cfg.clrDowntrend);
  const [r2, g2, b2] = rgbOf(cfg.clrUptrend);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const stoch = taStep.stoch(cfg.stochLen);
      const sma1 = new WindowSma(3);
      const sma2 = new WindowSma(3);
      const s: PsarRun = {
        stoch, sma1, sma2, plots: Array.from({ length: 9 }, () => []),
        steps: [stoch, sma1, sma2],
        vars: { sar: NaN, ep: NaN, af: cfg.accelStart, isUp: true, lastDotIdx: NaN, lastDotVal: NaN },
        lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // smoothedStoch = ta.sma(ta.sma(ta.stoch(close, high, low, stochLen), 3), 3)
      const stoch = s.sma2.step(s.sma1.step(s.stoch.step(b.close, b.high, b.low)));

      // f_parabolic(smoothedStoch, accelStart, accelStep, accelMax)
      const src = stoch;
      if (isNaN(v.sar)) {
        v.sar = src;
        v.ep = src;
        v.isUp = true;
        v.af = cfg.accelStart;
      } else if (v.isUp) {
        v.sar += v.af * (v.ep - v.sar);
        if (gt(src, v.ep)) {
          v.ep = src;
          v.af = min(v.af + cfg.accelStep, cfg.accelMax);
        }
        if (lt(src, v.sar)) {
          v.isUp = false;
          v.sar = src + 5;
          v.ep = src;
          v.af = cfg.accelStart;
        }
      } else {
        v.sar -= v.af * (v.sar - v.ep);
        if (lt(src, v.ep)) {
          v.ep = src;
          v.af = min(v.af + cfg.accelStep, cfg.accelMax);
        }
        if (gt(src, v.sar)) {
          v.isUp = true;
          v.sar = src - 5;
          v.ep = src;
          v.af = cfg.accelStart;
        }
      }
      v.sar = max(0.0, min(100.0, v.sar));
      const sarVal = v.sar;
      const sarUp = v.isUp;

      // Dot placement
      let canDraw = false;
      if (cfg.showSAR) {
        if (isNaN(v.lastDotIdx) || i - v.lastDotIdx >= cfg.minBarsGap) {
          if (isNaN(v.lastDotVal) || ge(Math.abs(sarVal - v.lastDotVal), cfg.minSARMove)) {
            canDraw = true;
            v.lastDotIdx = i;
            v.lastDotVal = sarVal;
          }
        }
      }

      const pct = min(1, max(0, (stoch - cfg.lowerThresh) / (cfg.upperThresh - cfg.lowerThresh)));
      const ch = (a: number, c: number) => Math.round(a + (c - a) * pct);
      const lineColor = String(color.rgb(ch(r1, r2), ch(g1, g2), ch(b1, b2)));

      const dotValue = !(cfg.showSAR && canDraw) ? NaN : fin(sarUp ? sarVal + 12.0 : sarVal - 12.0);
      const dotMain = sarUp ? cfg.clrUptrend : cfg.clrDowntrend;
      const dotShadow = String(color.new(dotMain, 20));

      const time = b.time;
      const P = s.plots;
      P[0][i] = { time, value: fin(stoch), color: lineColor };
      P[1][i] = { time, value: fin(stoch + 0.15), color: String(color.new(lineColor, 90)) };
      P[2][i] = { time, value: fin(stoch - 0.15), color: String(color.new(lineColor, 90)) };
      // midPlot = plot(50, color = na, editable = false, display = display.none)
      P[3][i] = { time, value: 50 };
      // the two plot(smoothedStoch) calls inside the fill() calls (default colour, shown)
      P[4][i] = { time, value: fin(stoch) };
      P[5][i] = { time, value: fin(stoch) };
      P[6][i] = { time, value: dotValue, color: dotShadow };
      P[7][i] = { time, value: dotValue, color: dotShadow };
      P[8][i] = { time, value: dotValue, color: dotMain };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: cfg.upperThresh, options: { title: 'Upper Band', color: '#787B86', linestyle: 'dashed' } },
          { value: 50, options: { title: 'Mid Band', color: String(color.new('#787B86', 50)), linestyle: 'dashed' } },
          { value: cfg.lowerThresh, options: { title: 'Lower Band', color: '#787B86', linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Background Fill', color: BAND_FILL },
            colors: new Array<string>(n).fill(BAND_FILL) },
          { plot1: 'plot4', plot2: 'plot3', options: { title: 'Overbought Gradient', color: OB_FILL },
            colors: new Array<string>(n).fill(OB_FILL) },
          { plot1: 'plot3', plot2: 'plot5', options: { title: 'Oversold Gradient', color: OS_FILL },
            colors: new Array<string>(n).fill(OS_FILL) },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ParabolicStochSarVisualizerInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ParabolicStochSarVisualizerInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ParabolicStochSarVisualizer = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
