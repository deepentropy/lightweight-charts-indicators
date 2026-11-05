/**
 * Golden & Death Cross Re-Activation Ribbon BB
 *
 * Two moving averages (SMA, EMA, WMA, HMA or RMA of the close). A golden cross (MA 1 crosses above MA 2) starts a
 * long state and a death cross a short state; the state keeps the extreme distance MA 1 - MA 2 since the cross and
 * ends when the distance falls (long) or rises (short) for 2 bars. An ended state is re-activated when the distance
 * passes its kept extreme by the threshold while moving in the state direction for 2 bars. The state is drawn as a
 * ribbon in the outer 32 % of the Bollinger Bands (short: below the upper band, long: above the lower band); its
 * colour goes from a dark to a light hue and from faint to visible with a strength made of the distance / ATR and
 * the RSI distance from 50 (a faint ribbon while the state cools down). Bollinger lines, MA glow lines and dots on
 * the crosses.
 *
 * Reference: "Golden & Death Cross Re-Activation Ribbon BB [by Oberlunar]" by oberlunar_tr
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, compare, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type MaType = 'SMA' | 'EMA' | 'WMA' | 'HMA' | 'RMA';

export interface GoldenDeathCrossWithReActivationInputs {
  /** Type of MA 1 (small) */
  maType1: MaType;
  /** Type of MA 2 (big) */
  maType2: MaType;
  maLen1: number;
  maLen2: number;
  /** Distance threshold for re-activation */
  treshold: number;
  bbLen: number;
  bbMult: number;
  rsiLen: number;
  atrLen: number;
  /** Show the Bollinger ribbon fills */
  showRibbon: boolean;
  /** MA line width (the port keeps the default widths: 2 for the MA lines, 6 for the glow lines) */
  maWidth: number;
  showBBLines: boolean;
  showBasis: boolean;
  /** MA soft glow lines */
  showGlow: boolean;
}

export const defaultInputs: GoldenDeathCrossWithReActivationInputs = {
  maType1: 'HMA',
  maType2: 'HMA',
  maLen1: 21,
  maLen2: 200,
  treshold: 0.5,
  bbLen: 20,
  bbMult: 2.0,
  rsiLen: 14,
  atrLen: 14,
  showRibbon: true,
  maWidth: 2,
  showBBLines: true,
  showBasis: true,
  showGlow: true,
};

const MA_TYPES = ['SMA', 'EMA', 'WMA', 'HMA', 'RMA'];
const G_MA = 'Moving Averages';
const G_RB = 'Ribbon (Bollinger)';
const G_ST = 'Style';

export const inputConfig: InputConfig[] = [
  { id: 'maType1', type: 'string', title: 'Type MA 1 (small)', defval: 'HMA', options: MA_TYPES, group: G_MA },
  { id: 'maType2', type: 'string', title: 'Type MA 2 (big)', defval: 'HMA', options: MA_TYPES, group: G_MA },
  { id: 'maLen1', type: 'int', title: 'Length MA 1', defval: 21, min: 1, group: G_MA },
  { id: 'maLen2', type: 'int', title: 'Length MA 2', defval: 200, min: 1, group: G_MA },
  { id: 'treshold', type: 'float', title: 'Distance threshold for re-activation', defval: 0.5, step: 0.1, group: G_RB },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 5, group: G_RB },
  { id: 'bbMult', type: 'float', title: 'BB Mult', defval: 2.0, step: 0.1, group: G_RB },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 2, group: G_RB },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 2, group: G_RB },
  { id: 'showRibbon', type: 'bool', title: 'Show BB ribbon', defval: true, group: G_RB },
  { id: 'maWidth', type: 'int', title: 'MA line width', defval: 2, min: 1, max: 6, group: G_ST },
  { id: 'showBBLines', type: 'bool', title: 'Show BB envelope lines', defval: true, group: G_ST },
  { id: 'showBasis', type: 'bool', title: 'Show BB basis (mid)', defval: true, group: G_ST },
  { id: 'showGlow', type: 'bool', title: 'MA soft glow', defval: true, group: G_ST },
];

// Palette
const C_AQUA_LO = color.rgb(64, 168, 181);
const C_AQUA_HI = color.rgb(120, 220, 232);
const C_TIT_LO = color.rgb(190, 92, 80);
const C_TIT_HI = color.rgb(228, 130, 110);
const C_BASIS = color.rgb(160, 160, 170);
const C_BB_EDGE = color.rgb(120, 125, 140);

const COL_EDGE = String(color.new(C_BB_EDGE, 70));
const COL_BASIS = String(color.new(C_BASIS, 60));
const COL_GLOW1 = String(color.new(C_AQUA_LO, 86));
const COL_GLOW2 = String(color.new(C_TIT_LO, 86));
const COL_MA1 = String(color.new(C_AQUA_HI, 10));
const COL_MA2 = String(color.new(C_TIT_HI, 10));
const COL_GOLDEN = String(color.new(C_AQUA_HI, 0));
const COL_DEATH = String(color.new(C_TIT_HI, 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ribbon Short Top', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Ribbon Short Bottom', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Ribbon Long Bottom', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Ribbon Long Top', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot4', title: 'BB Upper', color: COL_EDGE, lineWidth: 1 },
  { id: 'plot5', title: 'BB Lower', color: COL_EDGE, lineWidth: 1 },
  { id: 'plot6', title: 'BB Basis', color: COL_BASIS, lineWidth: 1 },
  { id: 'plot7', title: 'MA1 glow', color: COL_GLOW1, lineWidth: 6 },
  { id: 'plot8', title: 'MA2 glow', color: COL_GLOW2, lineWidth: 6 },
  { id: 'plot9', title: 'MA 1', color: COL_MA1, lineWidth: 2 },
  { id: 'plot10', title: 'MA 2', color: COL_MA2, lineWidth: 2 },
];

export const metadata = {
  title: 'Golden & Death Cross Re-Activation Ribbon BB [by Oberlunar]',
  shortTitle: 'Golden & Death Cross Re-Activation Ribbon BB [by Oberlunar]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (x: number, y: number) => (Number.isFinite(x) ? x : y);

/** f_clamp01(x): x below 0 -> 0, above 1 -> 1 (na stays na) */
const clamp01 = (x: number) => {
  let y = x;
  if (lt(y, 0.0)) y = 0.0;
  if (gt(y, 1.0)) y = 1.0;
  return y;
};

/** f_alpha_from_strength(s, isCooling): transparency 92 (faint) .. 55, + 6 while cooling, clamped to 40..95 */
const alphaFromStrength = (s: number, isCooling: boolean) => {
  let a = 92 - Math.trunc(Math.round(37.0 * nz(s, 0.0)));
  if (isCooling) a += 6;
  return Math.max(40, Math.min(95, a));
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type MaStep = { step(value: number): number; commit(): void };

/**
 * ta.rising(source, length) / ta.falling(source, length) of the library, one bar at a time: a counter of rises (falls)
 * from the bar before beyond the 1e-10 tolerance, reset by any other step, unchanged by a step from or to na
 */
class MonotonicStep {
  private count = 0;
  private prev = NaN;
  private nextCount = 0;
  private nextPrev = NaN;
  constructor(private readonly length: number, private readonly test: (a: number, b: number) => boolean) {}
  step(v: number): boolean {
    let count = this.count;
    if (Number.isFinite(v) && Number.isFinite(this.prev)) count = this.test(v, this.prev) ? count + 1 : 0;
    this.nextCount = count;
    this.nextPrev = v;
    return count >= this.length;
  }
  commit(): void {
    this.count = this.nextCount;
    this.prev = this.nextPrev;
  }
}

/** calc_ma(type, close, len): the type is a constant input, so one branch runs on every bar */
function maStep(type: MaType, len: number): MaStep {
  switch (type) {
    case 'SMA': { const m = taStep.sma(); return { step: (x) => m.step(x, len), commit: () => m.commit() }; }
    case 'EMA': return taStep.ema(len);
    case 'WMA': { const m = taStep.wma(); return { step: (x) => m.step(x, len), commit: () => m.commit() }; }
    case 'HMA': return taStep.hma(len);
    default: return taStep.rma(len);
  }
}

interface GdVars {
  longAttivo: boolean;
  shortAttivo: boolean;
  massimoLocaleLong: number;
  minimoLocaleShort: number;
}

interface GdRun extends BarRunState<GdVars> {
  ma1: MaStep;
  ma2: MaStep;
  atr: ReturnType<typeof taStep.atr>;
  rsi: ReturnType<typeof taStep.rsi>;
  falling: MonotonicStep;
  rising: MonotonicStep;
  golden: ReturnType<typeof taStep.crossover>;
  death: ReturnType<typeof taStep.crossunder>;
  basis: ReturnType<typeof taStep.sma>;
  dev: ReturnType<typeof taStep.stdev>;
  plots: Point[][];
  colLong: string[];
  colShort: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<GoldenDeathCrossWithReActivationInputs>): BarStudy<GdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const t = cfg.treshold;
  const laneFrac = 0.32;
  // ta.hma(x, 1) calls ta.wma(x, 0): a Pine runtime error
  const hmaError = (cfg.maType1 === 'HMA' && Math.floor(cfg.maLen1 / 2) < 1) ||
    (cfg.maType2 === 'HMA' && Math.floor(cfg.maLen2 / 2) < 1);
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: GdRun = {
        ma1: maStep(cfg.maType1, cfg.maLen1), ma2: maStep(cfg.maType2, cfg.maLen2), atr: taStep.atr(cfg.atrLen),
        rsi: taStep.rsi(cfg.rsiLen), falling: new MonotonicStep(2, compare.lt), rising: new MonotonicStep(2, compare.gt),
        golden: taStep.crossover(), death: taStep.crossunder(), basis: taStep.sma(), dev: taStep.stdev(),
        plots: Array.from({ length: 11 }, () => []), colLong: [], colShort: [], markers: [],
        steps: [],
        vars: { longAttivo: false, shortAttivo: false, massimoLocaleLong: NaN, minimoLocaleShort: NaN },
        lists: [], series: [],
      };
      s.steps = [s.ma1, s.ma2, s.atr, s.rsi, s.falling, s.rising, s.golden, s.death, s.basis, s.dev];
      s.lists = [s.markers];
      s.series = [...s.plots, s.colLong, s.colShort];
      return s;
    },
    bar(s, i, bars) {
      if (hmaError) throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
      const b = bars[i];
      const v = s.vars;
      const close = b.close;
      const ma1 = s.ma1.step(close);
      const ma2 = s.ma2.step(close);
      const d = ma1 - ma2;

      const atrVal = s.atr.step(b.high, b.low, b.close);
      const rsi = s.rsi.step(close);
      const distFalling2 = s.falling.step(d);
      const distRising2 = s.rising.step(d);
      const goldenCross = s.golden.step(ma1, ma2);
      const deathCross = s.death.step(ma1, ma2);

      // Bollinger ribbon anchors
      const basis = s.basis.step(close, cfg.bbLen);
      const dev = cfg.bbMult * s.dev.step(close, cfg.bbLen);
      const bbUpper = basis + dev;
      const bbLower = basis - dev;
      const ribShortTop = bbUpper;
      const ribShortBot = bbUpper - (bbUpper - basis) * laneFrac;
      const ribLongBot = bbLower;
      const ribLongTop = bbLower + (basis - bbLower) * laneFrac;

      if (goldenCross) {
        v.longAttivo = true;
        v.shortAttivo = false;
        v.massimoLocaleLong = d;
      }
      if (deathCross) {
        v.shortAttivo = true;
        v.longAttivo = false;
        v.minimoLocaleShort = d;
      }
      // Pine math.max / math.min: na when an argument is na
      if (v.longAttivo) v.massimoLocaleLong = Math.max(nz(v.massimoLocaleLong, d), d);
      if (v.shortAttivo) v.minimoLocaleShort = Math.min(nz(v.minimoLocaleShort, d), d);
      if (v.longAttivo && distFalling2) v.longAttivo = false;
      if (v.shortAttivo && distRising2) v.shortAttivo = false;

      const coolingLong = !v.longAttivo && distFalling2;
      const coolingShort = !v.shortAttivo && distRising2;
      const canReactivateLong = !v.longAttivo && gt(d, nz(v.massimoLocaleLong, d) + t) && distRising2;
      const canReactivateShort = !v.shortAttivo && lt(d, nz(v.minimoLocaleShort, d) - t) && distFalling2;
      let justReactLong = false;
      let justReactShort = false;
      if (canReactivateLong) {
        v.longAttivo = true;
        justReactLong = true;
      }
      if (canReactivateShort) {
        v.shortAttivo = true;
        justReactShort = true;
      }

      // Strength
      let distNorm = 0.0;
      if (gt(atrVal, 0.0)) distNorm = clamp01(Math.abs(d) / atrVal);
      const rsiLong = clamp01((50.0 - rsi) / 20.0);
      const rsiShort = clamp01((rsi - 50.0) / 20.0);
      const baseLong = clamp01(0.65 * distNorm + 0.35 * rsiLong);
      const baseShort = clamp01(0.65 * distNorm + 0.35 * rsiShort);
      let reactEdgeLong = 0.0;
      let reactEdgeShort = 0.0;
      if (gt(atrVal, 0.0)) {
        reactEdgeLong = clamp01((d - (nz(v.massimoLocaleLong, d) + t)) / atrVal);
        reactEdgeShort = clamp01((nz(v.minimoLocaleShort, d) - t - d) / atrVal);
      }
      const reactLong = clamp01(0.55 * reactEdgeLong + 0.45 * rsiLong);
      const reactShort = clamp01(0.55 * reactEdgeShort + 0.45 * rsiShort);

      let sLong = NaN;
      let sShort = NaN;
      if (justReactLong) sLong = reactLong;
      else if (v.longAttivo) sLong = baseLong;
      else if (coolingLong) sLong = 0.35 * baseLong;
      if (justReactShort) sShort = reactShort;
      else if (v.shortAttivo) sShort = baseShort;
      else if (coolingShort) sShort = 0.35 * baseShort;

      // Colours
      const hueLong = color.from_gradient(nz(sLong, 0.0), 0.0, 1.0, C_AQUA_LO, C_AQUA_HI);
      const hueShort = color.from_gradient(nz(sShort, 0.0), 0.0, 1.0, C_TIT_LO, C_TIT_HI);
      const aLong = alphaFromStrength(sLong, coolingLong && !v.longAttivo && !justReactLong);
      const aShort = alphaFromStrength(sShort, coolingShort && !v.shortAttivo && !justReactShort);
      s.colLong[i] = cfg.showRibbon && !isNaN(sLong) ? String(color.new(hueLong, aLong)) : 'transparent';
      s.colShort[i] = cfg.showRibbon && !isNaN(sShort) ? String(color.new(hueShort, aShort)) : 'transparent';

      // Cross dots
      if (goldenCross) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: COL_GOLDEN, size: 'tiny' });
      }
      if (deathCross) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: COL_DEATH, size: 'tiny' });
      }

      const time = b.time;
      const p = s.plots;
      p[0][i] = { time, value: fin(cfg.showRibbon ? ribShortTop : NaN) };
      p[1][i] = { time, value: fin(cfg.showRibbon ? ribShortBot : NaN) };
      p[2][i] = { time, value: fin(cfg.showRibbon ? ribLongBot : NaN) };
      p[3][i] = { time, value: fin(cfg.showRibbon ? ribLongTop : NaN) };
      p[4][i] = { time, value: fin(cfg.showBBLines ? bbUpper : NaN), color: COL_EDGE };
      p[5][i] = { time, value: fin(cfg.showBBLines ? bbLower : NaN), color: COL_EDGE };
      p[6][i] = { time, value: fin(cfg.showBasis ? basis : NaN), color: COL_BASIS };
      p[7][i] = { time, value: fin(cfg.showGlow ? ma1 : NaN), color: COL_GLOW1 };
      p[8][i] = { time, value: fin(cfg.showGlow ? ma2 : NaN), color: COL_GLOW2 };
      p[9][i] = { time, value: fin(ma1), color: COL_MA1 };
      p[10][i] = { time, value: fin(ma2), color: COL_MA2 };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(), plot7: p[7].slice(), plot8: p[8].slice(), plot9: p[9].slice(),
          plot10: p[10].slice(),
        },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', colors: s.colShort.slice(), options: { title: 'BB Upper Ribbon (SHORT)' } },
          { plot1: 'plot3', plot2: 'plot2', colors: s.colLong.slice(), options: { title: 'BB Lower Ribbon (LONG)' } },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GoldenDeathCrossWithReActivationInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GoldenDeathCrossWithReActivationInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const GoldenDeathCrossWithReActivation = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
