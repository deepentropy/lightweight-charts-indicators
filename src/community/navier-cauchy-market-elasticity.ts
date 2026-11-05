/**
 * Navier-Cauchy Market Elasticity [PhenLabs]
 *
 * An elasticity analogy: the strain is the price change over `lengthDisplacement` bars divided by the old close;
 * the Young modulus is 1 / (stdev(close) / sma(close)) over `lengthElasticity` bars; with the Poisson ratio nu the
 * Lame parameters are lambda = E * nu / ((1 + nu) * (1 - 2 * nu)) and mu = E / (2 * (1 + nu)). The stress
 * (lambda + 2 * mu) * strain * multiplier is smoothed with an SMA. A histogram shows the stress normalised by its
 * 20-bar average absolute value; the line, a wide glow line, bands at +-2 standard deviations (and 1.5 times them),
 * dots and lines on extreme values, an optional momentum ribbon and background zones show the stress level. The
 * colours go from a light to a strong bullish / bearish colour with the stress size.
 *
 * Alerts (alertcondition, `alerts` of the result): the smoothed stress crossing above the upper band / 1.5 times it
 * ("High Stress" / "Extreme High Stress") and below the lower band / 1.5 times it ("High Compression" / "Extreme
 * Compression"), with the bands as computed (also when they are not shown).
 *
 * Reference: "Navier-Cauchy Market Elasticity [PhenLabs]" by PhenLabs
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © PhenLabs
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'High Stress', message: 'Market under high tension' },
  { id: 'alert1', title: 'High Compression', message: 'Market under high compression' },
  { id: 'alert2', title: 'Extreme High Stress', message: 'Market under extreme tension' },
  { id: 'alert3', title: 'Extreme Compression', message: 'Market under extreme compression' },
];

export type NcmeDisplayStyle = 'Histogram' | 'Line' | 'Both' | 'Advanced';
export type NcmeColorScheme = 'Modern' | 'Classic' | 'Neon' | 'Ocean' | 'Fire';

export interface NavierCauchyMarketElasticityInputs {
  displayStyle: NcmeDisplayStyle;
  /** SMA length of the stress (1 = no smoothing) */
  smoothingPeriod: number;
  /** Show the reference bands */
  showBands: boolean;
  /** Colour the background by stress level */
  showZones: boolean;
  /** Gradient colours */
  showGradient: boolean;
  /** Glow line (Advanced mode) */
  showGlow: boolean;
  /** Momentum ribbon (Advanced mode) */
  showMomentumRibbon: boolean;
  /** Dots on extreme values (Advanced mode) */
  showExtremeDots: boolean;
  /** More subtle colours in Advanced mode */
  reducedOpacity: boolean;
  /** Length of the price displacement (strain) */
  lengthDisplacement: number;
  /** Length of the elasticity (volatility) and of the bands */
  lengthElasticity: number;
  /** Ratio of lateral to axial strain */
  poissonRatio: number;
  /** Scale factor of the stress */
  stressMultiplier: number;
  colorScheme: NcmeColorScheme;
}

export const defaultInputs: NavierCauchyMarketElasticityInputs = {
  displayStyle: 'Advanced',
  smoothingPeriod: 3,
  showBands: true,
  showZones: true,
  showGradient: true,
  showGlow: true,
  showMomentumRibbon: false,
  showExtremeDots: true,
  reducedOpacity: true,
  lengthDisplacement: 14,
  lengthElasticity: 30,
  poissonRatio: 0.3,
  stressMultiplier: 100,
  colorScheme: 'Modern',
};

const G_DISPLAY = 'Display Settings';
const G_ADVANCED = 'Advanced Mode Options';
const G_CORE = 'Elasticity Parameters';
const G_COLORS = 'Color Settings';

export const inputConfig: InputConfig[] = [
  { id: 'displayStyle', type: 'string', title: 'Display Style', defval: 'Advanced', options: ['Histogram', 'Line', 'Both', 'Advanced'], group: G_DISPLAY },
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 3, min: 1, group: G_DISPLAY, tooltip: 'Number of periods for moving average smoothing (1 = no smoothing)' },
  { id: 'showBands', type: 'bool', title: 'Show Reference Bands', defval: true, group: G_DISPLAY, tooltip: 'Display upper and lower reference bands for extreme values' },
  { id: 'showZones', type: 'bool', title: 'Show Background Zones', defval: true, group: G_DISPLAY, tooltip: 'Color background based on stress levels' },
  { id: 'showGradient', type: 'bool', title: 'Enable Gradient Effects', defval: true, group: G_DISPLAY, tooltip: 'Use gradient coloring for smoother transitions' },
  { id: 'showGlow', type: 'bool', title: 'Show Glow Effect', defval: true, group: G_ADVANCED, tooltip: 'Enable glow effect in advanced mode' },
  { id: 'showMomentumRibbon', type: 'bool', title: 'Show Momentum Ribbon', defval: false, group: G_ADVANCED, tooltip: 'Display momentum ribbon overlay' },
  { id: 'showExtremeDots', type: 'bool', title: 'Show Extreme Dots', defval: true, group: G_ADVANCED, tooltip: 'Mark extreme values with dots' },
  { id: 'reducedOpacity', type: 'bool', title: 'Reduced Opacity Mode', defval: true, group: G_ADVANCED, tooltip: 'Use more subtle colors in advanced mode' },
  { id: 'lengthDisplacement', type: 'int', title: 'Displacement Length', defval: 14, min: 1, group: G_CORE, tooltip: 'The lookback period for measuring price displacement (strain)' },
  { id: 'lengthElasticity', type: 'int', title: 'Elasticity Length', defval: 30, min: 1, group: G_CORE, tooltip: 'The period for calculating market elasticity based on volatility' },
  { id: 'poissonRatio', type: 'float', title: 'Poisson Ratio', defval: 0.3, min: 0, max: 0.5, step: 0.05, group: G_CORE, tooltip: 'Theoretical ratio of lateral to axial strain (0.3 is standard for most markets)' },
  { id: 'stressMultiplier', type: 'float', title: 'Stress Multiplier', defval: 100, min: 1, group: G_CORE, tooltip: 'Scaling factor to make stress values more visible' },
  { id: 'colorScheme', type: 'string', title: 'Color Scheme', defval: 'Modern', options: ['Modern', 'Classic', 'Neon', 'Ocean', 'Fire'], group: G_COLORS },
];

/** bullish, bullish strong, bearish, bearish strong colours of each scheme */
const SCHEMES: Record<NcmeColorScheme, [string, string, string, string]> = {
  Modern: ['#26D0CE', '#1A9B9A', '#E06B9D', '#B84A7D'],
  Classic: ['#00C176', '#009959', '#FF6B6B', '#DE4747'],
  Neon: ['#00FF88', '#00CC66', '#FF1744', '#D50000'],
  Ocean: ['#00B4D8', '#0077B6', '#F72585', '#B5179E'],
  Fire: ['#FFB700', '#FF8C00', '#DC2F02', '#9D0208'],
};

const NEUTRAL_COLOR = '#7B8794';
const ZERO_LINE_COLOR = String(color.new('#FFFFFF', 80));
const BANDS_COLOR = String(color.new('#FFFFFF', 90));
const BANDS2_COLOR = String(color.new('#FFFFFF', 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stress Histogram', color: '#26D0CE', lineWidth: 3, style: 'histogram' },
  { id: 'plot1', title: 'Stress Line', color: '#26D0CE', lineWidth: 2, style: 'line' },
  { id: 'plot2', title: 'Stress Glow', color: String(color.new('#26D0CE', 85)), lineWidth: 9, style: 'line' },
  { id: 'plot3', title: 'Upper Band', color: BANDS_COLOR, lineWidth: 1, style: 'line' },
  { id: 'plot4', title: 'Lower Band', color: BANDS_COLOR, lineWidth: 1, style: 'line' },
  { id: 'plot5', title: 'Upper Band 2', color: BANDS2_COLOR, lineWidth: 1 },
  { id: 'plot6', title: 'Lower Band 2', color: BANDS2_COLOR, lineWidth: 1 },
  { id: 'plot7', title: 'Momentum Ribbon', color: String(color.new('#26D0CE', 90)), lineWidth: 1, style: 'area' },
  { id: 'plot8', title: 'Extreme High Line', color: String(color.new('#1A9B9A', 70)), lineWidth: 1, style: 'linebr' },
  { id: 'plot9', title: 'Extreme Low Line', color: String(color.new('#B84A7D', 70)), lineWidth: 1, style: 'linebr' },
];

/** hline(0, 'Zero Line', color.new(#FFFFFF, 80), solid, 1) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero Line', color: ZERO_LINE_COLOR, linestyle: 'solid', linewidth: 1 },
];

/** fill(Upper Band, Lower Band) with the default inputs (Advanced mode: transparency 98) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_bands', plot1: 'plot3', plot2: 'plot4', color: String(color.new(NEUTRAL_COLOR, 98)), title: 'Band Fill' },
];

export const metadata = {
  title: 'Navier-Cauchy Market Elasticity [PhenLabs]',
  shortTitle: 'NCME - PhenLabs',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
/** Pine math.max / math.min: na when an argument is na (NaN in JS too) */
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

/**
 * `math.sum(source, length)` with a constant length, one bar at a time: the exact sum of the window (non-overlapping
 * partials, the value that leaves then the one that enters, rounded once), the operations of the oakscriptjs running
 * sum (same doubles as taStep.sum), the partials kept in typed arrays (no copy of an array per bar).
 */
class ExactSum implements Committable {
  private readonly len: number;
  private readonly values: number[] = [];
  private p = new Float64Array(64);
  private pn = 0;
  private q = new Float64Array(64);
  private qn = 0;
  private last = NaN;
  private next = NaN;
  private pending = NaN;
  private stepped = false;

  constructor(length: number) {
    this.len = Math.floor(length);
  }

  private add(x: number): void {
    const q = this.q;
    const n = this.qn;
    let i = 0;
    for (let j = 0; j < n; j++) {
      let y = q[j]!;
      if (Math.abs(x) < Math.abs(y)) {
        const t = x;
        x = y;
        y = t;
      }
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) q[i++] = lo;
      x = hi;
    }
    if (i === q.length) {
      const grown = new Float64Array(q.length * 2);
      grown.set(q);
      this.q = grown;
    }
    this.q[i] = x;
    this.qn = i + 1;
  }

  private round(): number {
    const p = this.q;
    let n = this.qn;
    if (n === 0) return 0;
    let hi = p[--n]!;
    while (n > 0) {
      const x = hi;
      const y = p[--n]!;
      hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) {
        if (n > 0 && ((lo < 0 && p[n - 1]! < 0) || (lo > 0 && p[n - 1]! > 0))) {
          const y2 = lo * 2;
          const x2 = hi + y2;
          if (y2 === x2 - hi) hi = x2;
        }
        break;
      }
    }
    return hi;
  }

  /** The sum with `x` on this bar (an na value keeps the previous sum) */
  step(x: number): number {
    const len = this.len;
    this.stepped = len >= 1;
    if (!this.stepped) return NaN;
    if (x === undefined || x === null || !Number.isFinite(x)) {
      this.pending = NaN;
      this.next = this.last;
      return this.last;
    }
    if (this.q.length < this.p.length) this.q = new Float64Array(this.p.length);
    const p = this.p;
    const q = this.q;
    for (let k = 0; k < this.pn; k++) q[k] = p[k]!;
    this.qn = this.pn;
    const count = this.values.length;
    if (count >= len) this.add(-this.values[count - len]!);
    this.add(x);
    this.pending = x;
    this.next = count + 1 >= len ? this.round() : NaN;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    if (Number.isNaN(this.pending)) return;
    this.values.push(this.pending);
    const p = this.p;
    this.p = this.q;
    this.pn = this.qn;
    this.q = p;
  }
}

/** `ta.stdev(source, length)` (biased) with a constant length from two {@link ExactSum} (the operations of taStep.stdev) */
class ExactStdev implements Committable {
  private readonly len: number;
  private readonly sums: ExactSum;
  private readonly squares: ExactSum;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.sums = new ExactSum(length);
    this.squares = new ExactSum(length);
  }

  step(value: number): number {
    const len = this.len;
    const sum = this.sums.step(value);
    const sq = this.squares.step(value === undefined || value === null || !Number.isFinite(value) ? NaN : value * value);
    if (len <= 0) return NaN;
    const mean = sum / len;
    const v = sq / len - mean * mean;
    return Number.isNaN(v) ? NaN : v > 0 ? Math.sqrt(v) : 0;
  }

  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

/** `ta.sma(source, length)` with a constant length: the {@link ExactSum} divided by the length */
class ExactSma implements Committable {
  private readonly len: number;
  private readonly sum: ExactSum;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.sum = new ExactSum(length);
  }

  step(value: number): number {
    return this.sum.step(value) / this.len;
  }

  commit(): void {
    this.sum.commit();
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface NcmeRun extends BarRunState<Record<string, never>> {
  sdClose: ExactStdev;
  smaClose: ExactSma;
  smooth: ExactSma;
  avgAbs: ExactSma;
  dev50: ExactStdev;
  devBand: ExactStdev;
  change: ReturnType<typeof taStep.change>;
  smoothed: number[];
  upperBand: number[];
  plots: Point[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<NavierCauchyMarketElasticityInputs>): BarStudy<NcmeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const adv = cfg.displayStyle === 'Advanced';
  const [bullishColor, bullishStrongColor, bearishColor, bearishStrongColor] = SCHEMES[cfg.colorScheme] ?? SCHEMES.Modern;
  const nu = cfg.poissonRatio;
  const L = cfg.lengthDisplacement;

  const baseOpacity = adv && cfg.reducedOpacity ? 70 : 100;
  const stressColor = (value: number, thr: number, thr2: number): string => {
    if (cfg.showGradient) {
      const ratio = Math.min(Math.abs(value) / thr2, 1);
      if (gt(value, 0)) {
        return gt(value, thr)
          ? color.from_gradient(ratio, 0, 1, bullishColor, bullishStrongColor)
          : color.from_gradient(ratio, 0, 1, String(color.new(bullishColor, 50)), bullishColor);
      }
      return lt(value, -thr)
        ? color.from_gradient(ratio, 0, 1, bearishColor, bearishStrongColor)
        : color.from_gradient(ratio, 0, 1, String(color.new(bearishColor, 50)), bearishColor);
    }
    return gt(value, 0) ? (gt(value, thr) ? bullishStrongColor : bullishColor)
      : lt(value, -thr) ? bearishStrongColor : bearishColor;
  };

  const showHist = cfg.displayStyle === 'Histogram' || cfg.displayStyle === 'Both' || adv;
  const histScale = adv ? 50 : 75;
  const showLine = cfg.displayStyle === 'Line' || cfg.displayStyle === 'Both' || adv;
  const showGlowEffect = adv && showLine && cfg.showGlow;
  const showSecondaryBands = adv && cfg.showBands;
  const showDots = adv && cfg.showExtremeDots;
  const showMomentum = adv && cfg.showMomentumRibbon;
  const zoneOpacity = adv ? 98 : 95;
  const extremeHighColor = String(color.new(bullishStrongColor, 70));
  const extremeLowColor = String(color.new(bearishStrongColor, 70));
  const fillColor = cfg.showBands ? String(color.new(NEUTRAL_COLOR, adv ? 98 : 95)) : 'transparent';

  return {
    init() {
      const s: NcmeRun = {
        sdClose: new ExactStdev(cfg.lengthElasticity), smaClose: new ExactSma(cfg.lengthElasticity),
        smooth: new ExactSma(cfg.smoothingPeriod), avgAbs: new ExactSma(20), dev50: new ExactStdev(50),
        devBand: new ExactStdev(cfg.lengthElasticity), change: taStep.change(1),
        smoothed: [], upperBand: [], plots: Array.from({ length: 10 }, () => []), markers: [], bgColors: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.sdClose, s.smaClose, s.smooth, s.avgAbs, s.dev50, s.devBand, s.change];
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.smoothed, s.upperBand, ...s.plots, ...s.flags];
      return s;
    },
    bar(st, i, bars) {
      const b = bars[i];
      const c = b.close;
      // Stress
      const sdClose = st.sdClose.step(c);
      const smaClose = st.smaClose.step(c);
      const old = i - L >= 0 ? bars[i - L].close : NaN;
      const priceStrain = (c - old) / old;
      const volatility = sdClose / smaClose;
      const youngsModulus = 1 / volatility;
      const lambda = (youngsModulus * nu) / ((1 + nu) * (1 - 2 * nu));
      const mu = youngsModulus / (2 * (1 + nu));
      const normalStress = (lambda + 2 * mu) * priceStrain;
      const stressValue = normalStress * cfg.stressMultiplier;
      const s = st.smooth.step(stressValue);
      const absSmoothed = Math.abs(s);
      const avgStress = st.avgAbs.step(absSmoothed);
      const normalized = s / (eq(avgStress, 0) ? 1 : avgStress);
      const stressDev = st.dev50.step(s);
      const ub = st.devBand.step(s) * 2;
      const momentum = st.change.step(s);
      st.smoothed[i] = s;
      st.upperBand[i] = ub;

      const t = b.time;
      const thr = 1.5 * stressDev;
      const thr2 = 2.5 * stressDev;
      // opacity = math.min(math.max(|s| / thr2 * baseOpacity, 30), baseOpacity): na when an argument is na
      const opacity = Math.min(Math.max((absSmoothed / thr2) * baseOpacity, 30), baseOpacity);
      const sc = stressColor(s, thr, thr2);
      const sizeMultiplier = adv ? Math.max(0.5, Math.min(2, Math.abs(normalized))) : 1;
      const lb = -ub;
      const ub2 = ub * 1.5;
      const lb2 = lb * 1.5;

      // Background zones
      const topZone = gt(s, ub2);
      const highZone = gt(s, ub) && le(s, ub2);
      const lowZone = lt(s, lb) && ge(s, lb2);
      const bottomZone = lt(s, lb2);
      if (cfg.showZones) {
        const bg = topZone ? String(color.new(bullishStrongColor, zoneOpacity))
          : highZone ? String(color.new(bullishColor, zoneOpacity + 2))
            : lowZone ? String(color.new(bearishColor, zoneOpacity + 2))
              : bottomZone ? String(color.new(bearishStrongColor, zoneOpacity)) : null;
        if (bg !== null) st.bgColors.push({ time: t, color: bg });
      }

      // Stress Histogram: color.new(stressColor, histOpacity)
      const histOpacity = adv ? 100 - opacity + 20 : 100 - opacity;
      const p = st.plots;
      p[0][i] = {
        time: t, value: showHist ? fin(normalized * histScale * sizeMultiplier) : NaN,
        color: String(color.new(sc, histOpacity)),
      };
      p[1][i] = { time: t, value: showLine ? fin(s) : NaN, color: sc };
      p[2][i] = { time: t, value: showGlowEffect ? fin(s) : NaN, color: String(color.new(sc, 85)) };
      p[3][i] = { time: t, value: cfg.showBands ? fin(ub) : NaN };
      p[4][i] = { time: t, value: cfg.showBands ? fin(lb) : NaN };
      p[5][i] = { time: t, value: showSecondaryBands ? fin(ub2) : NaN };
      p[6][i] = { time: t, value: showSecondaryBands ? fin(lb2) : NaN };

      // plotshape(dotHigh / dotLow, shape.circle, location.absolute, size.tiny)
      if (showDots && gt(s, ub2) && Number.isFinite(s)) {
        st.markers.push({ time: t, position: 'atPriceMiddle', price: s, shape: 'circle',
          color: String(color.new(bullishStrongColor, 30)), size: 'tiny', id: 'shape0' });
      }
      if (showDots && lt(s, lb2) && Number.isFinite(s)) {
        st.markers.push({ time: t, position: 'atPriceMiddle', price: s, shape: 'circle',
          color: String(color.new(bearishStrongColor, 30)), size: 'tiny', id: 'shape1' });
      }

      // Momentum Ribbon
      const momentumColor = gt(momentum, 0) ? String(color.new(bullishColor, 90)) : String(color.new(bearishColor, 90));
      p[7][i] = { time: t, value: showMomentum ? fin(s + momentum * 5) : NaN, color: momentumColor };

      // Extreme stress lines
      p[8][i] = { time: t, value: gt(s, ub2) && adv ? fin(ub2) : NaN, color: extremeHighColor };
      p[9][i] = { time: t, value: lt(s, lb2) && adv ? fin(lb2) : NaN, color: extremeLowColor };

      // alertcondition: crossover(smoothedStress, upperBand) / crossunder(.., lowerBand) / the same with the 1.5x bands
      const ps = i > 0 ? st.smoothed[i - 1] : NaN;
      const pub = i > 0 ? st.upperBand[i - 1] : NaN;
      const plb = -pub;
      const flags = [
        s > ub && ps <= pub,
        s < lb && ps >= plb,
        s > ub * 1.5 && ps <= pub * 1.5,
        s < lb * 1.5 && ps >= plb * 1.5,
      ];
      for (let k = 0; k < 4; k++) {
        st.flags[k][i] = flags[k];
        if (flags[k]) st.times[k].push(t as number);
      }
    },
    result(st, bars) {
      const n = bars.length;
      const p = st.plots;
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < 10; k++) plots[`plot${k}`] = p[k].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: ZERO_LINE_COLOR, linestyle: 'solid', linewidth: 1 } },
        ],
        fills: [{ plot1: 'plot3', plot2: 'plot4', options: { title: 'Band Fill', color: fillColor }, colors: new Array<string>(n).fill(fillColor) }],
        markers: st.markers.slice(),
        bgColors: st.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, st.times, st.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NavierCauchyMarketElasticityInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<NavierCauchyMarketElasticityInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const NavierCauchyMarketElasticity = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
