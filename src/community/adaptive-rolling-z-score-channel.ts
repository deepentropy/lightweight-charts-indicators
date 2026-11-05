/**
 * Rolling Z-Score Channel
 *
 * Rolling z-score of the source: z = (src - sma(src, window)) / stdev(src, window, sample), 0 when the deviation is
 * not positive; optionally smoothed (LinReg, Hull MA, Super Smoother or Two-Pole Gaussian). In Adaptive mode the
 * band levels are the average of the upper / lower percentiles (linear interpolation) of the z-score over 50, 100
 * and 200 bars; in Fixed mode they are fixed z values. The levels are floored at +- the minimum band z, optionally
 * smoothed and made symmetric, then mapped back to price: band = sma + z * stdev, inner bands at a fraction of z.
 * The basis takes a gradient colour by the z-score; glow plots, gradient zone fills and breakout fills draw the
 * channel. Triangles mark the re-entries (source crossing back over the lower band / under the upper band).
 * Alerts (alertcondition, `alerts` of the result): the source crosses over the upper band, under the lower band,
 * back under the upper band, back over the lower band, over and under the basis.
 *
 * Reference: "Rolling Z-Score Channel" by B3AR_Trades
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, BgColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type ZChannelTheme = 'Modern' | 'Classic' | 'Neon' | 'Monochrome' | 'Sunset' | 'Ocean';
export type ZChannelSmoothing = 'LinReg' | 'Hull MA' | 'Super Smoother' | 'Two-Pole Gaussian';

export interface AdaptiveRollingZScoreChannelInputs {
  theme: ZChannelTheme;
  /** Basis colour by a gradient of the z-score (else the neutral colour) */
  useGradient: boolean;
  channelFill: 'Gradient' | 'Solid' | 'None';
  fillTransp: number;
  /** Breakout colour fill between the source and the band it crossed */
  showBreakout: boolean;
  showGlow: boolean;
  /** Background tint while the source is outside the channel */
  showBgTint: boolean;
  colorBars: boolean;
  bandMode: 'Fixed Z-Score' | 'Adaptive';
  fixedZUp: number;
  fixedZDn: number;
  symmetricBands: boolean;
  minBandZ: number;
  showInner: boolean;
  /** Inner band level as a fraction of the band z */
  innerFrac: number;
  showBasis: boolean;
  /** Rolling window of the SMA and standard deviation */
  rollWin: number;
  pctUpper: number;
  pctLower: number;
  smoothZ: boolean;
  smoothBands: boolean;
  smoothType: ZChannelSmoothing;
  smoothLength: number;
  showSignals: boolean;
  src: SourceType;
}

export const defaultInputs: AdaptiveRollingZScoreChannelInputs = {
  theme: 'Neon',
  useGradient: true,
  channelFill: 'Gradient',
  fillTransp: 90,
  showBreakout: true,
  showGlow: true,
  showBgTint: false,
  colorBars: false,
  bandMode: 'Adaptive',
  fixedZUp: 2.0,
  fixedZDn: -2.0,
  symmetricBands: false,
  minBandZ: 0.5,
  showInner: true,
  innerFrac: 0.5,
  showBasis: true,
  rollWin: 80,
  pctUpper: 95.0,
  pctLower: 5.0,
  smoothZ: false,
  smoothBands: false,
  smoothType: 'Two-Pole Gaussian',
  smoothLength: 5,
  showSignals: true,
  src: 'close',
};

const G_THEME = 'Theme & Coloring';
const G_BAND = 'Channel Settings';
const G_ZS = 'Z-Score Settings';
const G_PCT = 'Percentile Thresholds';
const G_SMTH = 'Smoothing';
const G_SIG = 'Signals';
const G_SRC = 'Source';

export const inputConfig: InputConfig[] = [
  { id: 'theme', type: 'string', title: 'Theme', defval: 'Neon', options: ['Modern', 'Classic', 'Neon', 'Monochrome', 'Sunset', 'Ocean'], group: G_THEME },
  { id: 'useGradient', type: 'bool', title: 'Gradient Basis Coloring', defval: true, group: G_THEME },
  { id: 'channelFill', type: 'string', title: 'Channel Fill', defval: 'Gradient', options: ['Gradient', 'Solid', 'None'], group: G_THEME },
  { id: 'fillTransp', type: 'int', title: 'Channel Fill Transparency', defval: 90, min: 50, max: 100, group: G_THEME },
  { id: 'showBreakout', type: 'bool', title: 'Breakout Color Fill', defval: true, group: G_THEME },
  { id: 'showGlow', type: 'bool', title: 'Glow Effect on Bands', defval: true, group: G_THEME },
  { id: 'showBgTint', type: 'bool', title: 'Background Tint on Extremes', defval: false, group: G_THEME },
  { id: 'colorBars', type: 'bool', title: 'Color Bars', defval: false, group: G_THEME },
  { id: 'bandMode', type: 'string', title: 'Band Mode', defval: 'Adaptive', options: ['Fixed Z-Score', 'Adaptive'], group: G_BAND },
  { id: 'fixedZUp', type: 'float', title: 'Fixed Upper Z', defval: 2.0, min: 0.1, max: 6.0, step: 0.1, group: G_BAND },
  { id: 'fixedZDn', type: 'float', title: 'Fixed Lower Z', defval: -2.0, min: -6.0, max: -0.1, step: 0.1, group: G_BAND },
  { id: 'symmetricBands', type: 'bool', title: 'Force Symmetric Bands', defval: false, group: G_BAND },
  { id: 'minBandZ', type: 'float', title: 'Minimum Band Z', defval: 0.5, min: 0.1, max: 3.0, step: 0.1, group: G_BAND },
  { id: 'showInner', type: 'bool', title: 'Show Inner Bands', defval: true, group: G_BAND },
  { id: 'innerFrac', type: 'float', title: 'Inner Band Fraction', defval: 0.5, min: 0.1, max: 0.9, step: 0.05, group: G_BAND },
  { id: 'showBasis', type: 'bool', title: 'Show Basis Line', defval: true, group: G_BAND },
  { id: 'rollWin', type: 'int', title: 'Rolling Window', defval: 80, min: 10, max: 500, group: G_ZS },
  { id: 'pctUpper', type: 'float', title: 'Upper Percentile', defval: 95.0, min: 50.0, max: 99.0, step: 0.5, group: G_PCT },
  { id: 'pctLower', type: 'float', title: 'Lower Percentile', defval: 5.0, min: 1.0, max: 50.0, step: 0.5, group: G_PCT },
  { id: 'smoothZ', type: 'bool', title: 'Smooth Z-Score', defval: false, group: G_SMTH },
  { id: 'smoothBands', type: 'bool', title: 'Smooth Band Levels', defval: false, group: G_SMTH },
  { id: 'smoothType', type: 'string', title: 'Smoothing', defval: 'Two-Pole Gaussian', options: ['LinReg', 'Hull MA', 'Super Smoother', 'Two-Pole Gaussian'], group: G_SMTH },
  { id: 'smoothLength', type: 'int', title: 'Smoothing Length', defval: 5, min: 2, max: 50, group: G_SMTH },
  { id: 'showSignals', type: 'bool', title: 'Plot Re-Entry Markers', defval: true, group: G_SIG },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: G_SRC },
];

/** Theme colours (bull, bear, neutral); Modern is the default of the Pine palette */
const THEMES: Record<string, [string, string, string]> = {
  Modern: [color.rgb(0, 255, 255), color.rgb(255, 0, 0), color.rgb(180, 180, 180)],
  Classic: [color.rgb(0, 230, 118), color.rgb(244, 67, 54), color.rgb(160, 160, 160)],
  Neon: [color.rgb(57, 255, 20), color.rgb(255, 20, 147), color.rgb(120, 120, 200)],
  Monochrome: [color.rgb(240, 240, 240), color.rgb(90, 90, 90), color.rgb(160, 160, 160)],
  Sunset: [color.rgb(255, 200, 87), color.rgb(199, 62, 89), color.rgb(180, 140, 140)],
  Ocean: [color.rgb(100, 220, 255), color.rgb(20, 80, 180), color.rgb(140, 160, 200)],
};
const [NEON_BULL, NEON_BEAR, NEON_NEUTRAL] = THEMES.Neon;
/** Pine default plot colour */
const PINE_BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Price Anchor', color: String(color.new(color.white, 100)), lineWidth: 1 },
  { id: 'plot1', title: 'Upper Glow 3', color: String(color.new(NEON_BEAR, 94)), lineWidth: 9 },
  { id: 'plot2', title: 'Upper Glow 2', color: String(color.new(NEON_BEAR, 90)), lineWidth: 6 },
  { id: 'plot3', title: 'Upper Glow 1', color: String(color.new(NEON_BEAR, 84)), lineWidth: 3 },
  { id: 'plot4', title: 'Lower Glow 3', color: String(color.new(NEON_BULL, 94)), lineWidth: 9 },
  { id: 'plot5', title: 'Lower Glow 2', color: String(color.new(NEON_BULL, 90)), lineWidth: 6 },
  { id: 'plot6', title: 'Lower Glow 1', color: String(color.new(NEON_BULL, 84)), lineWidth: 3 },
  { id: 'plot7', title: 'Basis Glow 2', color: String(color.new(NEON_NEUTRAL, 90)), lineWidth: 7 },
  { id: 'plot8', title: 'Basis Glow 1', color: String(color.new(NEON_NEUTRAL, 80)), lineWidth: 4 },
  { id: 'plot9', title: 'Upper Band', color: String(color.new(NEON_BEAR, 10)), lineWidth: 2 },
  { id: 'plot10', title: 'Lower Band', color: String(color.new(NEON_BULL, 10)), lineWidth: 2 },
  { id: 'plot11', title: 'Inner Upper', color: String(color.new(NEON_BEAR, 55)), lineWidth: 1 },
  { id: 'plot12', title: 'Inner Lower', color: String(color.new(NEON_BULL, 55)), lineWidth: 1 },
  { id: 'plot13', title: 'Basis', color: NEON_NEUTRAL, lineWidth: 2 },
  { id: 'plot14', title: 'Z-Score', color: PINE_BLUE, lineWidth: 1, display: 'data_window' },
  { id: 'plot15', title: 'Upper Z', color: PINE_BLUE, lineWidth: 1, display: 'data_window' },
  { id: 'plot16', title: 'Lower Z', color: PINE_BLUE, lineWidth: 1, display: 'data_window' },
];

export const metadata = {
  title: 'Rolling Z-Score Channel',
  shortTitle: 'Z-Channel',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const nz = (x: number, y = 0) => (isNaN(x) ? y : x);

type Point = { time: number; value: number; color: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

/**
 * `ta.percentile_linear_interpolation(source, length, percentage)` one bar at a time, with the sorted window of the
 * library function (the new value inserted before the first value `>=` it, then the value of the bar leaving the
 * window removed): the same doubles. `step` reads the window with the new value without changing it.
 */
class PercentileLinear implements Committable {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private count = 0;
  private pending = NaN;
  private stepped = false;

  constructor(private readonly length: number, private readonly percentage: number) {}

  step(v: number): number {
    this.stepped = true;
    this.pending = v;
    const { values, bars, length } = this;
    const i = this.count;
    if (i < length - 1) return NaN;
    let k = 0;
    while (k < values.length && !(values[k] >= v)) k++;
    // index in the window after the insertion of the bar that leaves it (-1: none)
    let old = -1;
    if (i >= length) {
      const r = bars.indexOf(i - length);
      old = r < k ? r : r + 1;
    }
    const inserted = (j: number) => (j < k ? values[j] : j === k ? v : values[j - 1]);
    const at = (j: number) => (old < 0 || j < old ? inserted(j) : inserted(j + 1));
    const pos = (this.percentage / 100) * length - 0.5;
    if (pos <= 0) return at(0);
    if (pos >= length - 1) return at(length - 1);
    const lo = Math.floor(pos);
    return at(lo) + (pos - lo) * (at(lo + 1) - at(lo));
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const { values, bars, length } = this;
    const v = this.pending;
    const i = this.count++;
    let k = 0;
    while (k < values.length && !(values[k] >= v)) k++;
    values.splice(k, 0, v);
    bars.splice(k, 0, i);
    if (i >= length) {
      const old = bars.indexOf(i - length);
      values.splice(old, 1);
      bars.splice(old, 1);
    }
  }
}

/** The four smoothers of a series (each Pine call keeps its own history), the selected one stepped */
interface Smoother {
  x: number[];
  ss: number[];
  gs: number[];
  lin: ReturnType<typeof taStep.linreg> | null;
  hma: ReturnType<typeof taStep.hma> | null;
}

interface ZChannelVars {
  /** ta.crossover(src, lower) / ta.crossunder(src, upper): the last bar where both values were not na */
  prevLoSrc: number;
  prevLo: number;
  hasPrevLo: boolean;
  prevUpSrc: number;
  prevUp: number;
  hasPrevUp: boolean;
}

interface ZChannelRun extends BarRunState<ZChannelVars> {
  loc: ReturnType<typeof taStep.sma>;
  disp: ReturnType<typeof taStep.stdev>;
  smZ: Smoother | null;
  smU: Smoother | null;
  smD: Smoother | null;
  pcts: PercentileLinear[];
  src: number[];
  plots: Point[][];
  upperArr: number[];
  lowerArr: number[];
  basisArr: number[];
  brkUp: string[];
  brkDn: string[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<AdaptiveRollingZScoreChannelInputs>): BarStudy<ZChannelRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const len = cfg.smoothLength;

  // Theme palettes (Modern when the theme is not listed)
  const [themeBull, themeBear, themeNeutral] = THEMES[cfg.theme] ?? THEMES.Modern;

  // Smoothing coefficients
  const ssA1 = Math.exp(-Math.sqrt(2) * Math.PI / len);
  const ssB1 = 2 * ssA1 * Math.cos(Math.sqrt(2) * Math.PI / len);
  const ssC2 = ssB1;
  const ssC3 = -ssA1 * ssA1;
  const ssC1 = 1 - ssC2 - ssC3;
  const gsBeta = (1 - Math.cos(2 * Math.PI / len)) / (Math.sqrt(2) - 1);
  const gsAlpha = -gsBeta + Math.sqrt(gsBeta * gsBeta + 2 * gsBeta);
  const gsA2 = gsAlpha * gsAlpha;
  const gsOm = 1 - gsAlpha;
  const gsOm2 = gsOm * gsOm;
  const stId = cfg.smoothType === 'Two-Pole Gaussian' ? 3 : cfg.smoothType === 'Super Smoother' ? 2
    : cfg.smoothType === 'Hull MA' ? 1 : 0;
  const smoother = (): Smoother => ({
    x: [], ss: [], gs: [],
    lin: stId === 0 ? taStep.linreg(len, 0) : null,
    hma: stId === 1 ? taStep.hma(len) : null,
  });
  const smooth = (sm: Smoother, i: number, xi: number): number => {
    sm.x[i] = xi;
    if (stId === 0) return sm.lin!.step(xi) ?? NaN;
    if (stId === 1) return sm.hma!.step(xi) ?? NaN;
    if (stId === 2) {
      const x1 = i > 0 ? sm.x[i - 1] : NaN;
      const s1 = i > 0 ? sm.ss[i - 1] : NaN;
      const s2 = i > 1 ? sm.ss[i - 2] : NaN;
      sm.ss[i] = ssC1 * (xi + nz(x1)) / 2 + ssC2 * nz(s1) + ssC3 * nz(s2);
      return sm.ss[i];
    }
    const g1 = i > 0 ? sm.gs[i - 1] : NaN;
    const g2 = i > 1 ? sm.gs[i - 2] : NaN;
    sm.gs[i] = gsA2 * xi + 2 * gsOm * nz(g1) - gsOm2 * nz(g2);
    return sm.gs[i];
  };

  const wSum = 1.0 + 1.0 + 1.0;
  const isFixed = cfg.bandMode === 'Fixed Z-Score';

  // Colours
  const fNear = Math.trunc(Math.max(cfg.fillTransp - 12, 0));
  const fFar = Math.trunc(Math.min(cfg.fillTransp + 6, 100));
  const fillOff = cfg.channelFill === 'None';
  const fOuter = cfg.channelFill === 'Gradient' ? fFar : fNear;
  const C = (c: string, t: number) => String(color.new(c, t));
  const upFillTop = fillOff ? C(themeBear, 100) : C(themeBear, fNear);
  const upFillBot = fillOff ? C(themeBear, 100) : C(themeBear, fOuter);
  const dnFillTop = fillOff ? C(themeBull, 100) : C(themeBull, fOuter);
  const dnFillBot = fillOff ? C(themeBull, 100) : C(themeBull, fNear);
  const NA = 'transparent';
  const anchorCol = C(color.white, 100);
  const pineBlue = PINE_BLUE;

  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: ZChannelRun = {
        loc: taStep.sma(), disp: taStep.stdev(),
        smZ: cfg.smoothZ ? smoother() : null,
        smU: cfg.smoothBands ? smoother() : null,
        smD: cfg.smoothBands ? smoother() : null,
        // Percentile band levels in z units: equal weights of the 50, 100 and 200 bar percentiles
        pcts: [
          new PercentileLinear(50, cfg.pctUpper), new PercentileLinear(100, cfg.pctUpper), new PercentileLinear(200, cfg.pctUpper),
          new PercentileLinear(50, cfg.pctLower), new PercentileLinear(100, cfg.pctLower), new PercentileLinear(200, cfg.pctLower),
        ],
        src: [], plots: Array.from({ length: 17 }, () => []), upperArr: [], lowerArr: [], basisArr: [], brkUp: [], brkDn: [],
        flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        markers: [], barColors: [], bgColors: [],
        steps: [],
        vars: { prevLoSrc: NaN, prevLo: NaN, hasPrevLo: false, prevUpSrc: NaN, prevUp: NaN, hasPrevUp: false },
        lists: [], series: [],
      };
      const sms = [s.smZ, s.smU, s.smD].filter((m): m is Smoother => m !== null);
      s.steps = [s.loc, s.disp, ...s.pcts];
      for (const m of sms) {
        if (m.lin) s.steps.push(m.lin);
        if (m.hma) s.steps.push(m.hma);
      }
      s.lists = [s.markers, s.barColors, s.bgColors, ...s.times];
      s.series = [
        s.src, ...s.plots, s.upperArr, s.lowerArr, s.basisArr, s.brkUp, s.brkDn, ...s.flags,
        ...sms.flatMap((m) => [m.x, m.ss, m.gs]),
      ];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const src = value(bars[i]) ?? NaN;
      s.src[i] = src;

      // Location and dispersion
      const loc = s.loc.step(src, cfg.rollWin) ?? NaN;
      const disp = s.disp.step(src, cfg.rollWin, false) ?? NaN;
      const zRaw = gt(disp, 0) ? (src - loc) / disp : 0.0;
      const z = s.smZ ? smooth(s.smZ, i, zRaw) : zRaw;

      const p = s.pcts;
      const thUpS = p[0].step(z) ?? NaN;
      const thUpM = p[1].step(z) ?? NaN;
      const thUpL = p[2].step(z) ?? NaN;
      const thDnS = p[3].step(z) ?? NaN;
      const thDnM = p[4].step(z) ?? NaN;
      const thDnL = p[5].step(z) ?? NaN;
      const upWsum = thUpS * 1.0 + thUpM * 1.0 + thUpL * 1.0;
      const dnWsum = thDnS * 1.0 + thDnM * 1.0 + thDnL * 1.0;
      const zUpSel = isFixed ? cfg.fixedZUp : upWsum / wSum;
      const zDnSel = isFixed ? cfg.fixedZDn : dnWsum / wSum;
      const zUpFlr = Math.max(nz(zUpSel, cfg.minBandZ), cfg.minBandZ);
      const zDnFlr = Math.min(nz(zDnSel, -cfg.minBandZ), -cfg.minBandZ);

      const zUpPre = s.smU ? smooth(s.smU, i, zUpFlr) : zUpFlr;
      const zDnPre = s.smD ? smooth(s.smD, i, zDnFlr) : zDnFlr;
      const symMag = Math.max(Math.abs(zUpPre), Math.abs(zDnPre));
      const zUp = cfg.symmetricBands ? symMag : zUpPre;
      const zDn = cfg.symmetricBands ? -symMag : zDnPre;

      // Inversion back to price
      const basis = loc;
      const upper = loc + zUp * disp;
      const lower = loc + zDn * disp;
      const innerUp = loc + zUp * cfg.innerFrac * disp;
      const innerDn = loc + zDn * cfg.innerFrac * disp;
      s.upperArr[i] = upper;
      s.lowerArr[i] = lower;
      s.basisArr[i] = basis;

      const inOb = !isNaN(upper) && gt(src, upper);
      const inOs = !isNaN(lower) && lt(src, lower);

      // Gradient colour of the basis
      const gradTop = Math.max(zUp, 0.01);
      const gradBot = Math.min(zDn, -0.01);
      const gradColor = ge(z, 0)
        ? String(color.from_gradient(z, 0, gradTop, themeNeutral, themeBear))
        : String(color.from_gradient(z, gradBot, 0, themeBull, themeNeutral));
      const basisColor = cfg.useGradient ? gradColor : themeNeutral;

      s.brkUp[i] = cfg.showBreakout && inOb ? C(themeBear, 75) : NA;
      s.brkDn[i] = cfg.showBreakout && inOs ? C(themeBull, 75) : NA;
      const glow = (c: string, tr: number) => (cfg.showGlow ? C(c, tr) : NA);

      // bgcolor(show_bg_tint ? (in_ob ? bg_ob : in_os ? bg_os : na) : na)
      if (cfg.showBgTint && (inOb || inOs)) s.bgColors.push({ time: t, color: C(inOb ? themeBear : themeBull, 92) });

      const basisPlot = cfg.showBasis ? basis : NaN;
      const plots = s.plots;
      const put = (k: number, v: number, col: string) => {
        plots[k][i] = { time: t, value: Number.isFinite(v) ? v : NaN, color: col };
      };
      put(0, src, anchorCol);
      put(1, upper, glow(themeBear, inOb ? 88 : 94));
      put(2, upper, glow(themeBear, inOb ? 80 : 90));
      put(3, upper, glow(themeBear, inOb ? 68 : 84));
      put(4, lower, glow(themeBull, inOs ? 88 : 94));
      put(5, lower, glow(themeBull, inOs ? 80 : 90));
      put(6, lower, glow(themeBull, inOs ? 68 : 84));
      put(7, basisPlot, glow(basisColor, 90));
      put(8, basisPlot, glow(basisColor, 80));
      put(9, upper, C(themeBear, 10));
      put(10, lower, C(themeBull, 10));
      put(11, cfg.showInner ? innerUp : NaN, C(themeBear, 55));
      put(12, cfg.showInner ? innerDn : NaN, C(themeBull, 55));
      put(13, basisPlot, basisColor);
      // barcolor(color_bars ? (in_ob ? theme_bear : in_os ? theme_bull : base_bar) : na)
      if (cfg.colorBars) s.barColors.push({ time: t, color: inOb ? themeBear : inOs ? themeBull : basisColor });
      put(14, z, pineBlue);
      put(15, zUp, pineBlue);
      put(16, zDn, pineBlue);

      const v = s.vars;
      let reentryUp = false;
      if (!isNaN(src) && !isNaN(lower)) {
        reentryUp = v.hasPrevLo && src > lower && v.prevLoSrc <= v.prevLo;
        v.hasPrevLo = true;
        v.prevLoSrc = src;
        v.prevLo = lower;
      }
      let reentryDn = false;
      if (!isNaN(src) && !isNaN(upper)) {
        reentryDn = v.hasPrevUp && src < upper && v.prevUpSrc >= v.prevUp;
        v.hasPrevUp = true;
        v.prevUpSrc = src;
        v.prevUp = upper;
      }
      if (cfg.showSignals && reentryUp) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: themeBull, size: 'tiny' });
      }
      if (cfg.showSignals && reentryDn) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: themeBear, size: 'tiny' });
      }

      // alertcondition(ta.crossover(src, upper)), (ta.crossunder(src, lower)), (reentry_dn = ta.crossunder(src, upper)),
      // (reentry_up = ta.crossover(src, lower)), (ta.crossover(src, basis)), (ta.crossunder(src, basis))
      const ps = i > 0 ? s.src[i - 1] : NaN;
      const pu = i > 0 ? s.upperArr[i - 1] : NaN;
      const pl = i > 0 ? s.lowerArr[i - 1] : NaN;
      const pb = i > 0 ? s.basisArr[i - 1] : NaN;
      const f = s.flags;
      f[0][i] = src > upper && ps <= pu;
      f[1][i] = src < lower && ps >= pl;
      f[2][i] = src < upper && ps >= pu;
      f[3][i] = src > lower && ps <= pl;
      f[4][i] = src > basis && ps <= pb;
      f[5][i] = src < basis && ps >= pb;
      for (let k = 0; k < 6; k++) if (f[k][i]) s.times[k].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      const fills = [
        // fill(p_upper, p_basis, upper, basis, up_fill_top, up_fill_bot, title = "Upper Zone")
        { plot1: 'plot9', plot2: 'plot13', options: { title: 'Upper Zone' }, gradient: { topValue: s.upperArr.slice(), bottomValue: s.basisArr.slice(),
          topColor: new Array(n).fill(upFillTop), bottomColor: new Array(n).fill(upFillBot) } },
        // fill(p_basis, p_lower, basis, lower, dn_fill_top, dn_fill_bot, title = "Lower Zone")
        { plot1: 'plot13', plot2: 'plot10', options: { title: 'Lower Zone' }, gradient: { topValue: s.basisArr.slice(), bottomValue: s.lowerArr.slice(),
          topColor: new Array(n).fill(dnFillTop), bottomColor: new Array(n).fill(dnFillBot) } },
        // fill(p_src, p_upper, color = brk_up_col, title = "Breakout Above")
        { plot1: 'plot0', plot2: 'plot9', options: { title: 'Breakout Above' }, colors: s.brkUp.slice() },
        // fill(p_src, p_lower, color = brk_dn_col, title = "Breakdown Below")
        { plot1: 'plot0', plot2: 'plot10', options: { title: 'Breakdown Below' }, colors: s.brkDn.slice() },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveRollingZScoreChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveRollingZScoreChannelInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Break Above Upper', message: 'Closed above upper band' },
  { id: 'alert1', title: 'Break Below Lower', message: 'Closed below lower band' },
  { id: 'alert2', title: 'Re-Entry From Above', message: 'Closed back inside from above' },
  { id: 'alert3', title: 'Re-Entry From Below', message: 'Closed back inside from below' },
  { id: 'alert4', title: 'Basis Cross Up', message: 'Crossed above basis' },
  { id: 'alert5', title: 'Basis Cross Down', message: 'Crossed below basis' },
];

export const AdaptiveRollingZScoreChannel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
