/**
 * JOPA Channel (Dual-Volumed) v1
 *
 * A channel around a rolling VWAP (sum of src * volume / sum of volume over `lenVWAP` bars, from cumulative sums).
 * Inner value bands: a width of kSTD * stdev(residual) + kATR * ATR + kMAD * sma(|residual|) (residual = src - VWAP),
 * times a volume factor (relative volume ^ betaRVOL * (1 + betaDVal * z-score of the dollar volume), clamped to
 * 0.25..3) and a regime factor from the efficiency ratio (erMin in a trend .. erMax in chop), tilted up / down by the
 * z-score of the OBV slope. The bands follow a tracking mode (base, EMA-smoothed parallel, slope or linreg forecast),
 * blended with the base bands by the attach strength. Outer containment bands: VWAP + EMA of the highest / lowest
 * residual over `lenExt` bars, plus / minus a margin of marginK * smoothed width. Guides at 20 % and 80 % of the
 * channel, fills between the inner and the outer bands, and squeeze dots when the width is at most sqThresh times
 * its `sqLen`-bar average.
 *
 * Alerts (alertcondition, `alerts` of the result): breakout long / short (close beyond the upper / lower value band
 * with a relative volume of at least `rvolMinBr`) and top / bottom zone (close at or beyond the 80 % / 20 % guide, the
 * guides shown).
 *
 * Reference: "JOPA Channel (Dual-Volumed) v1 [JopAlgo]" by JopAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright (c) 2025 JopAlgo. © 2025 JopAlgo [JopAlgo]
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

type TrackMode = 'Base' | 'Parallel-Lock' | 'Slope-Lock' | 'Forecast-Lock';

export interface JopaChannelV1Inputs {
  src: SourceType;
  lenVWAP: number;
  lenVol: number;
  kSTD: number;
  kATR: number;
  kMAD: number;
  lenSTD: number;
  lenATR: number;
  lenMAD: number;
  betaRVOL: number;
  betaDVal: number;
  lenDVal: number;
  useTilt: boolean;
  tiltGain: number;
  lenOBV: number;
  lenER: number;
  erMin: number;
  erMax: number;
  trackMode: TrackMode;
  attach: number;
  trackLen: number;
  slopeGain: number;
  leadBars: number;
  useContain: boolean;
  lenExt: number;
  smoothExt: number;
  marginK: number;
  sqLen: number;
  sqThresh: number;
  /** Used by the alert conditions only */
  rvolMinBr: number;
  showValueRails: boolean;
  showValueFill: boolean;
  showGuides: boolean;
  showContainFill: boolean;
  showSqueeze: boolean;
}

export const defaultInputs: JopaChannelV1Inputs = {
  src: 'close',
  lenVWAP: 120,
  lenVol: 50,
  kSTD: 1.0,
  kATR: 0.35,
  kMAD: 0.75,
  lenSTD: 50,
  lenATR: 14,
  lenMAD: 50,
  betaRVOL: 0.65,
  betaDVal: 0.25,
  lenDVal: 50,
  useTilt: true,
  tiltGain: 0.35,
  lenOBV: 34,
  lenER: 20,
  erMin: 0.8,
  erMax: 1.25,
  trackMode: 'Parallel-Lock',
  attach: 0.85,
  trackLen: 12,
  slopeGain: 0.5,
  leadBars: 1,
  useContain: true,
  lenExt: 220,
  smoothExt: 16,
  marginK: 0.25,
  sqLen: 100,
  sqThresh: 0.85,
  rvolMinBr: 1.0,
  showValueRails: false,
  showValueFill: true,
  showGuides: true,
  showContainFill: true,
  showSqueeze: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'lenVWAP', type: 'int', title: 'Rolling VWAP Length', defval: 120, min: 2 },
  { id: 'lenVol', type: 'int', title: 'Volume Baseline (RVOL)', defval: 50, min: 5 },
  { id: 'kSTD', type: 'float', title: 'k * StdDev(residuals)', defval: 1.0, min: 0.0, step: 0.1 },
  { id: 'kATR', type: 'float', title: 'k * ATR', defval: 0.35, min: 0.0, step: 0.05 },
  { id: 'kMAD', type: 'float', title: 'k * MAD(residuals)', defval: 0.75, min: 0.0, step: 0.05 },
  { id: 'lenSTD', type: 'int', title: 'StdDev Length', defval: 50, min: 5 },
  { id: 'lenATR', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'lenMAD', type: 'int', title: 'MAD Length', defval: 50, min: 5 },
  { id: 'betaRVOL', type: 'float', title: 'RVOL Exponent', defval: 0.65, min: 0.0, step: 0.05 },
  { id: 'betaDVal', type: 'float', title: 'Dollar-Flow Gain', defval: 0.25, min: 0.0, step: 0.05 },
  { id: 'lenDVal', type: 'int', title: 'Dollar-Flow Z-Window', defval: 50, min: 5 },
  { id: 'useTilt', type: 'bool', title: 'Enable Tilt (OBV)', defval: true },
  { id: 'tiltGain', type: 'float', title: 'Tilt Strength (0..1)', defval: 0.35, min: 0.0, max: 1.0, step: 0.05 },
  { id: 'lenOBV', type: 'int', title: 'OBV Slope Z-Window', defval: 34, min: 5 },
  { id: 'lenER', type: 'int', title: 'Efficiency Ratio Lookback', defval: 20, min: 2 },
  { id: 'erMin', type: 'float', title: 'ER Width Min (trend)', defval: 0.8, min: 0.2, max: 2.0, step: 0.05 },
  { id: 'erMax', type: 'float', title: 'ER Width Max (chop)', defval: 1.25, min: 0.2, max: 3.0, step: 0.05 },
  { id: 'trackMode', type: 'string', title: 'Tracking Mode', defval: 'Parallel-Lock',
    options: ['Base', 'Parallel-Lock', 'Slope-Lock', 'Forecast-Lock'] },
  { id: 'attach', type: 'float', title: 'Attach Strength (0..1)', defval: 0.85, min: 0.0, max: 1.0, step: 0.05 },
  { id: 'trackLen', type: 'int', title: 'Tracking Smooth Length', defval: 12, min: 1 },
  { id: 'slopeGain', type: 'float', title: 'Slope Influence (Slope-Lock)', defval: 0.5, min: 0.0, max: 2.0, step: 0.05 },
  { id: 'leadBars', type: 'int', title: 'Forecast Lead Bars (Forecast-Lock)', defval: 1, min: 1, max: 3 },
  { id: 'useContain', type: 'bool', title: 'Show Containment Bands', defval: true },
  { id: 'lenExt', type: 'int', title: 'Residual Extremes Lookback', defval: 220, min: 20 },
  { id: 'smoothExt', type: 'int', title: 'Extreme Smoothing (EMA)', defval: 16, min: 1 },
  { id: 'marginK', type: 'float', title: 'Margin vs inner width (k * wS)', defval: 0.25, min: 0.0, max: 2.0, step: 0.05 },
  { id: 'sqLen', type: 'int', title: 'Squeeze Window', defval: 100, min: 20 },
  { id: 'sqThresh', type: 'float', title: 'Squeeze <= (ratio vs avg)', defval: 0.85, min: 0.3, max: 1.5, step: 0.05 },
  { id: 'rvolMinBr', type: 'float', title: 'Min RVOL for Breakout', defval: 1.0, min: 0.0, step: 0.05 },
  { id: 'showValueRails', type: 'bool', title: 'Upper & Lower Value (inner rails)', defval: false },
  { id: 'showValueFill', type: 'bool', title: 'Inner (Value) Fill', defval: true },
  { id: 'showGuides', type: 'bool', title: 'Channel 20–80% Guides', defval: true },
  { id: 'showContainFill', type: 'bool', title: 'Containment Fill', defval: true },
  { id: 'showSqueeze', type: 'bool', title: 'Squeeze Dots (orange, below candles)', defval: false },
];

const GUIDE20 = 'rgb(102, 178, 255)';
const GUIDE80 = 'rgb(255, 128, 128)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RVWAP', color: color.teal, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Value', color: color.green, lineWidth: 1, style: 'stepline' },
  { id: 'plot2', title: 'Lower Value', color: color.red, lineWidth: 1, style: 'stepline' },
  { id: 'plot3', title: 'Upper Containment', color: color.green, lineWidth: 2, style: 'stepline' },
  { id: 'plot4', title: 'Lower Containment', color: color.red, lineWidth: 2, style: 'stepline' },
  { id: 'plot5', title: 'Channel 20%', color: GUIDE20, lineWidth: 1, linestyle: 'dashed' },
  { id: 'plot6', title: 'Channel 80%', color: GUIDE80, lineWidth: 1, linestyle: 'dashed' },
];

export const metadata = {
  title: 'JOPA Channel (Dual-Volumed) v1 [JopAlgo]',
  shortTitle: 'JOPAV1',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a != b beyond 1e-10 (na and +-infinity: false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) > EPS;
/** Pine nz(): na and +-infinity give 0 */
const nz = (x: number) => (Number.isFinite(x) ? x : 0);
/** f_clamp(x, lo, hi) = math.min(math.max(x, lo), hi): na stays na */
const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);
const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Step = ReturnType<typeof taStep.sma>;

/**
 * f_z(x, l) = na(sd) or sd == 0 ? 0 : (x - ta.sma(x, l)) / ta.stdev(x, l), the sma and the stdev from the same window
 * sums (the sums of taStep.sma / taStep.stdev: same doubles)
 */
class ZStep {
  private readonly sums = taStep.sum();
  private readonly squares = taStep.sum();
  constructor(private readonly length: number) {}
  step(x: number): number {
    const len = Math.floor(this.length);
    const sum = this.sums.step(x, len);
    const sq = this.squares.step(Number.isFinite(x) ? x * x : NaN, len);
    const ma = sum / len;
    const variance = len <= 0 ? NaN : sq / len - ma * ma;
    const sd = Number.isNaN(variance) ? NaN : variance > 0 ? Math.sqrt(variance) : 0;
    return isNaN(sd) || !ne(sd, 0) ? 0.0 : (x - ma) / sd;
  }
  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

interface JopaVars {
  /** obv, rvwapS of the bar before */
  prevObv: number;
  prevRvwapS: number;
}

interface JopaRun extends BarRunState<JopaVars> {
  csNum: ReturnType<typeof taStep.cum>;
  csDen: ReturnType<typeof taStep.cum>;
  csEr: ReturnType<typeof taStep.cum>;
  cumObv: ReturnType<typeof taStep.cum>;
  stdRes: ReturnType<typeof taStep.stdev>;
  atr: ReturnType<typeof taStep.atr>;
  madRes: Step;
  volSma: Step;
  zDVal: ZStep;
  change: ReturnType<typeof taStep.change>;
  /** null when the result is not read (no tilt) */
  obvZ: ZStep | null;
  rvwapEma: ReturnType<typeof taStep.ema>;
  wEma: ReturnType<typeof taStep.ema>;
  /** null when the result is not read (other tracking modes) */
  rvwapLr: ReturnType<typeof taStep.linreg> | null;
  resHighest: ReturnType<typeof taStep.highest>;
  resLowest: ReturnType<typeof taStep.lowest>;
  resHiEma: ReturnType<typeof taStep.ema>;
  resLoEma: ReturnType<typeof taStep.ema>;
  /** null when the result is not read (no squeeze dots) */
  wAvg: Step | null;
  /** values of earlier bars: source, the cumulative sums, rvwap */
  src: number[];
  numCs: number[];
  denCs: number[];
  erCs: number[];
  rvwap: number[];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<JopaChannelV1Inputs>): BarStudy<JopaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const lrLen = Math.trunc(Math.max(2, cfg.trackLen));
  const attachClamped = clamp(cfg.attach, 0.0, 1.0);
  const teal = color.teal;
  const purple = color.purple;
  // f_rollsum(x, l): cs = ta.cum(x); not na(cs[l]) ? cs - cs[l] : na
  const rollsum = (cs: number[], i: number, l: number) => (i >= l && !isNaN(cs[i - l]) ? cs[i] - cs[i - l] : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: JopaRun = {
        csNum: taStep.cum(), csDen: taStep.cum(), csEr: taStep.cum(), cumObv: taStep.cum(),
        stdRes: taStep.stdev(), atr: taStep.atr(cfg.lenATR), madRes: taStep.sma(), volSma: taStep.sma(),
        zDVal: new ZStep(cfg.lenDVal), change: taStep.change(), obvZ: cfg.useTilt ? new ZStep(cfg.lenOBV) : null,
        rvwapEma: taStep.ema(cfg.trackLen), wEma: taStep.ema(cfg.trackLen),
        rvwapLr: cfg.trackMode === 'Forecast-Lock' ? taStep.linreg(lrLen, -cfg.leadBars) : null,
        resHighest: taStep.highest(), resLowest: taStep.lowest(), resHiEma: taStep.ema(cfg.smoothExt),
        resLoEma: taStep.ema(cfg.smoothExt), wAvg: cfg.showSqueeze ? taStep.sma() : null,
        src: [], numCs: [], denCs: [], erCs: [], rvwap: [],
        plots: Array.from({ length: 7 }, () => []), flags: [[], [], [], []], times: [[], [], [], []], markers: [],
        steps: [], vars: { prevObv: NaN, prevRvwapS: NaN }, lists: [], series: [],
      };
      s.steps = [
        s.csNum, s.csDen, s.csEr, s.cumObv, s.stdRes, s.atr, s.madRes, s.volSma, s.zDVal, s.change, s.rvwapEma,
        s.wEma, s.resHighest, s.resLowest, s.resHiEma, s.resLoEma,
        ...(s.obvZ ? [s.obvZ] : []), ...(s.rvwapLr ? [s.rvwapLr] : []), ...(s.wAvg ? [s.wAvg] : []),
      ];
      s.lists = [...s.times, s.markers];
      s.series = [s.src, s.numCs, s.denCs, s.erCs, s.rvwap, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const time = b.time;
      const src = value(b);
      const volume = b.volume ?? NaN;
      s.src[i] = src;

      // Rolling VWAP (centre)
      s.numCs[i] = s.csNum.step(src * volume);
      s.denCs[i] = s.csDen.step(volume);
      const num = rollsum(s.numCs, i, cfg.lenVWAP);
      const den = rollsum(s.denCs, i, cfg.lenVWAP);
      const rvwap = ne(den, 0) && !isNaN(den) ? num / den : NaN;
      s.rvwap[i] = rvwap;

      // Inner value-band width
      const residual = src - rvwap;
      const stdRes = s.stdRes.step(residual, cfg.lenSTD);
      const atrV = s.atr.step(b.high, b.low, b.close);
      const madRes = s.madRes.step(Math.abs(residual), cfg.lenMAD);
      const baseWidth = cfg.kSTD * nz(stdRes) + cfg.kATR * nz(atrV) + cfg.kMAD * nz(madRes);

      const volSma = s.volSma.step(volume, cfg.lenVol);
      const rvol = volume / volSma;
      const dVal = volume * src;
      const zDVal = s.zDVal.step(dVal);
      const volFac = clamp(Math.pow(Math.max(rvol, 0.0001), cfg.betaRVOL) * (1.0 + cfg.betaDVal * nz(zDVal)), 0.25, 3.0);

      const change = s.change.step(src);
      s.erCs[i] = s.csEr.step(Math.abs(change));
      const erDen = rollsum(s.erCs, i, cfg.lenER);
      const erNum = Math.abs(src - (i >= cfg.lenER ? s.src[i - cfg.lenER] : NaN));
      let er = !isNaN(erDen) && ne(erDen, 0) ? erNum / erDen : 0.0;
      er = clamp(er, 0.0, 1.0);
      const erFac = cfg.erMin + (cfg.erMax - cfg.erMin) * (1.0 - er);

      const obv = s.cumObv.step(volume * Math.sign(change));
      const obvSlp = obv - (i >= 1 ? v.prevObv : NaN);
      v.prevObv = obv;
      const tiltN = s.obvZ ? clamp(s.obvZ.step(obvSlp) * cfg.tiltGain, -1.0, 1.0) : 0.0;

      const wBase = baseWidth * volFac * erFac;
      const upperBase = rvwap + wBase * (1.0 + tiltN);
      const lowerBase = rvwap - wBase * (1.0 - tiltN);

      // Tracking of the inner bands
      const rvwapS = s.rvwapEma.step(rvwap);
      const wS = s.wEma.step(wBase);
      const rvwapF = s.rvwapLr ? s.rvwapLr.step(rvwap) : NaN;
      const up = wS * (1.0 + tiltN);
      const dn = wS * (1.0 - tiltN);
      const slope = rvwapS - (i >= 1 ? v.prevRvwapS : NaN);
      v.prevRvwapS = rvwapS;
      let upperRaw: number;
      let lowerRaw: number;
      if (cfg.trackMode === 'Parallel-Lock') {
        upperRaw = rvwapS + up;
        lowerRaw = rvwapS - dn;
      } else if (cfg.trackMode === 'Slope-Lock') {
        upperRaw = rvwapS + up + cfg.slopeGain * slope;
        lowerRaw = rvwapS - dn + cfg.slopeGain * slope;
      } else if (cfg.trackMode === 'Forecast-Lock') {
        upperRaw = rvwapF + up;
        lowerRaw = rvwapF - dn;
      } else {
        upperRaw = upperBase;
        lowerRaw = lowerBase;
      }
      const upperValue = attachClamped * upperRaw + (1.0 - attachClamped) * upperBase;
      const lowerValue = attachClamped * lowerRaw + (1.0 - attachClamped) * lowerBase;

      // Outer containment bands
      const resHi = s.resHiEma.step(s.resHighest.step(residual, cfg.lenExt));
      const resLo = s.resLoEma.step(s.resLowest.step(residual, cfg.lenExt));
      const upperContain = rvwap + resHi + cfg.marginK * wS;
      const lowerContain = rvwap + resLo - cfg.marginK * wS;

      // Squeeze
      const wAvg = s.wAvg ? s.wAvg.step(wBase, cfg.sqLen) : NaN;
      const squeeze = !isNaN(wAvg) && ne(wAvg, 0) ? le(wBase / wAvg, cfg.sqThresh) : false;

      // Plots
      const p = s.plots;
      p[0][i] = { time, value: fin(rvwap), color: i >= 1 && gt(rvwap, s.rvwap[i - 1]) ? teal : purple };
      p[1][i] = { time, value: fin(cfg.showValueRails ? upperValue : NaN), color: color.green };
      p[2][i] = { time, value: fin(cfg.showValueRails ? lowerValue : NaN), color: color.red };
      p[3][i] = { time, value: fin(cfg.useContain ? upperContain : NaN), color: color.green };
      p[4][i] = { time, value: fin(cfg.useContain ? lowerContain : NaN), color: color.red };
      // rngGuides = (useContain ? upperContain : upperValue) - (useContain ? lowerContain : lowerValue)
      const top = cfg.useContain ? upperContain : upperValue;
      const bottom = cfg.useContain ? lowerContain : lowerValue;
      const rng = top - bottom;
      const g20 = cfg.showGuides && !isNaN(rng) ? bottom + 0.2 * rng : NaN;
      const g80 = cfg.showGuides && !isNaN(rng) ? bottom + 0.8 * rng : NaN;
      p[5][i] = { time, value: fin(g20), color: GUIDE20 };
      p[6][i] = { time, value: fin(g80), color: GUIDE80 };

      // plotshape(showSqueeze and squeeze, style = shape.circle, size.tiny, color.orange, location.belowbar)
      if (cfg.showSqueeze && squeeze) {
        s.markers.push({ time, position: 'belowBar', shape: 'circle', color: color.orange, size: 'tiny' });
      }

      // Alerts: breakoutUp_val = close > upperValue and rvol >= rvolMinBr (breakoutDown_val: close < lowerValue);
      // inTopZone = showGuides and not na(rngGuides) and close >= line80 (inBottomZone: close <= line20)
      const close = b.close;
      const rvolOk = ge(fin(rvol), cfg.rvolMinBr);
      const valid = cfg.showGuides && !isNaN(fin(rng));
      const f0 = gt(close, fin(upperValue)) && rvolOk;
      const f1 = lt(close, fin(lowerValue)) && rvolOk;
      const f2 = valid && ge(close, fin(g80));
      const f3 = valid && le(close, fin(g20));
      s.flags[0][i] = f0;
      s.flags[1][i] = f1;
      s.flags[2][i] = f2;
      s.flags[3][i] = f3;
      if (f0) s.times[0].push(time as number);
      if (f1) s.times[1].push(time as number);
      if (f2) s.times[2].push(time as number);
      if (f3) s.times[3].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      const innerFill = cfg.showValueFill ? String(color.new(color.gray, 88)) : 'transparent';
      const containFill = cfg.showContainFill && cfg.useContain ? String(color.new(color.gray, 85)) : 'transparent';
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(),
        },
        fills: [
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Inner Fill' }, colors: new Array<string>(n).fill(innerFill) },
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Containment Fill' },
            colors: new Array<string>(n).fill(containFill) },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<JopaChannelV1Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<JopaChannelV1Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'DVWAP Breakout Long (Value Bands)', message: 'Breakout above inner value band [JopAlgo]' },
  { id: 'alert1', title: 'DVWAP Breakout Short (Value Bands)', message: 'Breakout below inner value band [JopAlgo]' },
  { id: 'alert2', title: 'Top Zone (Containment/Value)', message: 'Price in top 20% of channel [JopAlgo]' },
  { id: 'alert3', title: 'Bottom Zone (Containment/Value)', message: 'Price in bottom 20% of channel [JopAlgo]' },
];

export const JopaChannelV1 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
