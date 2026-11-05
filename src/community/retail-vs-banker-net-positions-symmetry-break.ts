/**
 * Retail vs Banker Net Positions - Symmetry Break (Institution Focus)
 *
 * Volume proxies of institutional and retail positions. The z-score of the true range over `rngLen` bars splits the
 * bars into big (z >= big level) and small (z <= small level) bars. Institutional volume: big bars that move with
 * the trend (close above the EMA and an up bar, or below it and a down bar). Retail volume: small bars or bars
 * against the trend. Each line is 100 * (up volume - down volume) / total volume over `lenNet` bars, smoothed by
 * an EMA. A symmetry break is a bar where the institutional line change is an outlier (z-score of the change over
 * `lenSpike` bars), larger than the retail z-score by a gap, larger than a minimum, while the retail line is quiet
 * or moves the other way; a cooldown separates two breaks. Markers: retail zero crosses, institutional extremes
 * (confirmed pivots of the line, or a new high / low of a window) and the breaks; optional background shading.
 * Alerts (alertcondition, `alerts` of the result): the six conditions of the original, retail flips up / down / either
 * direction, institutional extreme high / low, symmetry break.
 *
 * Reference: "Retail vs Banker Net Positions – Symmetry Break" by JasonHyde
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface RetailVsBankerNetPositionsSymmetryBreakInputs {
  /** Trend EMA length */
  lenTrend: number;
  /** Net position lookback (bars) */
  lenNet: number;
  /** Range z-score lookback */
  rngLen: number;
  /** Big-bar z-score level (institutional) */
  zBigBar: number;
  /** Small-bar z-score level (retail) */
  zSmallBar: number;
  /** Use the input z-score levels (else 0.5 / -0.5) */
  useZAdapt: boolean;
  /** EMA smoothing length of the two lines */
  smooth: number;
  /** Level of the +- threshold lines */
  thrShow: number;
  /** Lookback of the z-score of the line changes */
  lenSpike: number;
  /** Minimum |z| of the institutional change */
  zInstCut: number;
  /** Minimum gap |zInst| - |zRet| */
  zGapCut: number;
  /** Retail quiet: |retail change| <= k * stdev of the retail change */
  retQuietK: number;
  /** Minimum |institutional change| */
  minInstROC: number;
  /** Cooldown bars between two symmetry breaks */
  coolOff: number;
  /** Shade the background on a symmetry break */
  shadeBG: boolean;
  /** Show the symmetry break markers */
  showMarks: boolean;
  /** Show the retail zero-cross markers */
  showRetFlips: boolean;
  /** Pivot left / right bars (window size without pivots) */
  extLen: number;
  /** Extremes from confirmed pivots (else a new high / low of the window) */
  usePivots: boolean;
  /** Minimum bars between two extremes of the same side */
  dedupeBars: number;
  /** Shade the background on an extreme */
  showExtBG: boolean;
  /** An extreme must be on a symmetry break bar */
  requireSym: boolean;
}

export const defaultInputs: RetailVsBankerNetPositionsSymmetryBreakInputs = {
  lenTrend: 50,
  lenNet: 200,
  rngLen: 50,
  zBigBar: 0.5,
  zSmallBar: -0.5,
  useZAdapt: true,
  smooth: 5,
  thrShow: 50,
  lenSpike: 80,
  zInstCut: 3.0,
  zGapCut: 1.0,
  retQuietK: 0.8,
  minInstROC: 3.0,
  coolOff: 40,
  shadeBG: true,
  showMarks: true,
  showRetFlips: true,
  extLen: 8,
  usePivots: true,
  dedupeBars: 6,
  showExtBG: false,
  requireSym: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenTrend', type: 'int', title: 'Trend EMA', defval: 50, min: 5 },
  { id: 'lenNet', type: 'int', title: 'Net Position Lookback (bars)', defval: 200, min: 20 },
  { id: 'rngLen', type: 'int', title: 'Range Z-Score Lookback', defval: 50, min: 20 },
  { id: 'zBigBar', type: 'float', title: 'Big-Bar z >= (Institutional)', defval: 0.5, step: 0.1 },
  { id: 'zSmallBar', type: 'float', title: 'Small-Bar z <= (Retail)', defval: -0.5, step: 0.1 },
  { id: 'useZAdapt', type: 'bool', title: 'Use adaptive (z-score) bar-size split', defval: true },
  { id: 'smooth', type: 'int', title: 'Smoothing (EMA)', defval: 5, min: 1 },
  { id: 'thrShow', type: 'float', title: 'Show ±Threshold Lines', defval: 50, min: 0, max: 100 },
  { id: 'lenSpike', type: 'int', title: 'Inst ROC z-score lookback', defval: 80, min: 30 },
  { id: 'zInstCut', type: 'float', title: 'Min |z(Inst ROC)| to trigger', defval: 3.0, step: 0.1 },
  { id: 'zGapCut', type: 'float', title: 'Min z-gap: |zInst|-|zRet|', defval: 1.0, step: 0.1 },
  { id: 'retQuietK', type: 'float', title: 'Retail quiet ≤ k·stdev(ROC_ret)', defval: 0.8, step: 0.1 },
  { id: 'minInstROC', type: 'float', title: 'Min |Inst ROC| (absolute)', defval: 3.0, step: 0.5 },
  { id: 'coolOff', type: 'int', title: 'Cooldown bars between signals', defval: 40, min: 0 },
  { id: 'shadeBG', type: 'bool', title: 'Shade background on symmetry break', defval: true },
  { id: 'showMarks', type: 'bool', title: 'Show pink circle markers', defval: true },
  { id: 'showRetFlips', type: 'bool', title: 'Show Retail color-flip symbols on line', defval: true },
  { id: 'extLen', type: 'int', title: 'Extreme: pivot left/right bars (also window size if not using pivots)', defval: 8, min: 2 },
  { id: 'usePivots', type: 'bool', title: 'Extreme mode: confirmed swing pivots (non-repaint)', defval: true },
  { id: 'dedupeBars', type: 'int', title: 'Extreme: min bars between same-side marks', defval: 6, min: 0 },
  { id: 'showExtBG', type: 'bool', title: 'Extreme: shade background when marked', defval: false },
  { id: 'requireSym', type: 'bool', title: 'Extreme must coincide with a Symmetry Break', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Institutional (proxy)', color: color.aqua, lineWidth: 2 },
  { id: 'plot1', title: 'Retail (proxy)', color: color.lime, lineWidth: 2 },
];

const ZERO_COLOR = String(color.new(color.gray, 70));
const THR_COLOR = String(color.new(color.gray, 80));
const THR_FILL = String(color.new(color.gray, 92));

/** hline(0 / +thrShow / -thrShow) with the default level (the result `hlines` carry the input level) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero', color: ZERO_COLOR, linestyle: 'dashed' },
  { id: 'hline_plus', price: 50, title: ' +Thr', color: THR_COLOR, linestyle: 'dashed' },
  { id: 'hline_minus', price: -50, title: ' -Thr', color: THR_COLOR, linestyle: 'dashed' },
];

/** fill(hp, hm, color = color.new(color.gray, 92)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_thr', plot1: 'hline_plus', plot2: 'hline_minus', color: THR_FILL },
];

export const metadata = {
  title: 'Retail vs Banker Net Positions – Symmetry Break (Institution Focus)',
  shortTitle: 'Retail vs Banker Net Positions – Symmetry Break (Institution Focus)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/**
 * `math.sum(source, length)` with a constant length, one bar at a time: the correctly rounded sum of the last `length`
 * non-na values (exact partials, as the oakscriptjs window sums: the same doubles), the previous result on a bar with
 * an na value. The kept partials are copied into a second buffer on a step (no allocation per bar).
 */
class WindowSum implements Committable {
  private values: number[] = [];
  private p = new Float64Array(16);
  private n = 0;
  private q = new Float64Array(16);
  private qn = 0;
  private last = NaN;
  private next = NaN;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(length: number) {
    this.len = Math.floor(length);
  }

  /** Adds `x` to the partials of `q` exactly (Shewchuk) */
  private add(x: number): void {
    let q = this.q;
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
      this.q = q = grown;
    }
    q[i] = x;
    this.qn = i + 1;
  }

  /** The exact sum of the partials of `q` rounded once (round half to even) */
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

  step(value: number): number {
    this.stepped = true;
    if (!(this.len >= 1)) { this.pending = NaN; this.next = NaN; return NaN; }
    if (value === undefined || value === null || !Number.isFinite(value)) {
      this.pending = NaN;
      this.next = this.last;
      return this.last;
    }
    if (this.q.length < this.p.length) this.q = new Float64Array(this.p.length);
    this.q.set(this.p.subarray(0, this.n));
    this.qn = this.n;
    const count = this.values.length;
    if (count >= this.len) this.add(-this.values[count - this.len]!);
    this.add(value);
    this.pending = value;
    this.next = count + 1 >= this.len ? this.round() : NaN;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    if (Number.isNaN(this.pending)) return;
    const p = this.p;
    this.p = this.q;
    this.n = this.qn;
    this.q = p;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

/** `ta.sma(source, length)` with a constant length: {@link WindowSum} divided by the length */
class WindowSma extends WindowSum {
  private readonly div: number;

  constructor(length: number) {
    super(length);
    this.div = Math.floor(length);
  }

  override step(value: number): number {
    return super.step(value) / this.div;
  }
}

/** `ta.stdev(source, length)` (biased) with a constant length, from {@link WindowSum}s of the values and squares */
class WindowStdev implements Committable {
  private readonly sums: WindowSum;
  private readonly squares: WindowSum;
  private readonly len: number;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.sums = new WindowSum(length);
    this.squares = new WindowSum(length);
  }

  /** The biased variance */
  variance(value: number): number {
    const sum = this.sums.step(value);
    const sq = this.squares.step(value === undefined || value === null || !Number.isFinite(value) ? NaN : value * value);
    if (this.len <= 0) return NaN;
    const mean = sum / this.len;
    return sq / this.len - mean * mean;
  }

  step(value: number): number {
    const v = this.variance(value);
    return Number.isNaN(v) ? NaN : v > 0 ? Math.sqrt(v) : 0;
  }

  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface RvbVars {
  lastIdx: number;
  lastTopIdx: number;
  lastBotIdx: number;
  /** ta.crossover / ta.crossunder(retNet, 0): the last bar where retNet was not na */
  prevRet: number;
}

interface RvbRun extends BarRunState<RvbVars> {
  rngMu: WindowSma;
  rngSd: WindowStdev;
  ema: ReturnType<typeof taStep.ema>;
  /** rollSum of instUp, instDn, retUp, retDn */
  sums: WindowSma[];
  instEma: ReturnType<typeof taStep.ema>;
  retEma: ReturnType<typeof taStep.ema>;
  sdInst: WindowStdev;
  sdRet: WindowStdev;
  hi: ReturnType<typeof taStep.highest>;
  lo: ReturnType<typeof taStep.lowest>;
  ph: PivotStep;
  pl: PivotStep;
  instNet: number[];
  retNet: number[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RetailVsBankerNetPositionsSymmetryBreakInputs>): BarStudy<RvbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const L = cfg.extLen;
  const nz = (v: number) => (isNaN(v) ? 0 : v);
  const instColor = (v: number) => (ge(v, 0) ? color.aqua : color.orange);
  const retColor = (v: number) => (ge(v, 0) ? color.lime : color.red);
  const extTopBg = String(color.new(color.aqua, 90));
  const extBotBg = String(color.new(color.orange, 90));
  const symBg = String(color.new(color.fuchsia, 88));
  // net(up, dn) of the rolling sums
  const net = (u: number, d: number) => {
    const tot = u + d;
    return eq(tot, 0) ? 0 : (100 * (u - d)) / tot;
  };
  return {
    init() {
      const s: RvbRun = {
        rngMu: new WindowSma(cfg.rngLen), rngSd: new WindowStdev(cfg.rngLen), ema: taStep.ema(cfg.lenTrend),
        sums: [0, 1, 2, 3].map(() => new WindowSma(cfg.lenNet)),
        instEma: taStep.ema(cfg.smooth), retEma: taStep.ema(cfg.smooth), sdInst: new WindowStdev(cfg.lenSpike), sdRet: new WindowStdev(cfg.lenSpike),
        hi: taStep.highest(), lo: taStep.lowest(), ph: new PivotStep(L, L, true), pl: new PivotStep(L, L, false),
        instNet: [], retNet: [], plot0: [], plot1: [], markers: [], bgColors: [],
        flags: [0, 1, 2, 3, 4, 5].map(() => []), times: [0, 1, 2, 3, 4, 5].map(() => []),
        steps: [], vars: { lastIdx: NaN, lastTopIdx: NaN, lastBotIdx: NaN, prevRet: NaN }, lists: [], series: [],
      };
      s.steps = [s.rngMu, s.rngSd, s.ema, ...s.sums, s.instEma, s.retEma, s.sdInst, s.sdRet,
        ...(cfg.usePivots ? [s.ph, s.pl] : [s.hi, s.lo])];
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.instNet, s.retNet, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const vars = s.vars;
      const bar = bars[i];
      const t = bar.time;
      const { open, close } = bar;
      const volume = bar.volume ?? NaN;
      // rng = ta.tr(true): high - low when close[1] is na
      const rng = i === 0
        ? bar.high - bar.low
        : Math.max(bar.high - bar.low, Math.abs(bar.high - bars[i - 1].close), Math.abs(bar.low - bars[i - 1].close));
      const rngMu = s.rngMu.step(rng);
      const rngSd = s.rngSd.step(rng);
      const ema = s.ema.step(close);

      const zRng = eq(rngSd, 0) ? 0 : (rng - rngMu) / rngSd;
      const upBar = gt(close, open);
      const dnBar = lt(close, open);
      const withTrend = (ge(close, ema) && upBar) || (lt(close, ema) && dnBar);
      const against = (ge(close, ema) && dnBar) || (lt(close, ema) && upBar);
      const isBig = cfg.useZAdapt ? ge(zRng, cfg.zBigBar) : ge(zRng, 0.5);
      const isSmall = cfg.useZAdapt ? le(zRng, cfg.zSmallBar) : le(zRng, -0.5);
      // rollSum(x, n) = ta.sma(x, n) * n
      const sumInstUp = s.sums[0].step(withTrend && isBig && upBar ? volume : 0) * cfg.lenNet;
      const sumInstDn = s.sums[1].step(withTrend && isBig && dnBar ? volume : 0) * cfg.lenNet;
      const sumRetUp = s.sums[2].step((against || isSmall) && upBar ? volume : 0) * cfg.lenNet;
      const sumRetDn = s.sums[3].step((against || isSmall) && dnBar ? volume : 0) * cfg.lenNet;
      const v = s.instEma.step(net(sumInstUp, sumInstDn));
      const r = s.retEma.step(net(sumRetUp, sumRetDn));
      s.instNet[i] = v;
      s.retNet[i] = r;

      // Symmetry-break detection
      const prevInst = i > 0 ? s.instNet[i - 1] : NaN;
      const instROC = v - nz(prevInst);
      const retROC = r - nz(i > 0 ? s.retNet[i - 1] : NaN);
      const sdInstROC = s.sdInst.step(instROC);
      const sdRetROC = s.sdRet.step(retROC);

      // Extremes: ta.highest / ta.lowest of instNet[1] (window mode) or ta.pivothigh / pivotlow (pivot mode); each
      // only runs in its mode (lazy `and`, ternary)
      const hi = cfg.usePivots ? NaN : s.hi.step(prevInst, cfg.extLen - 1);
      const lo = cfg.usePivots ? NaN : s.lo.step(prevInst, cfg.extLen - 1);
      const ph = cfg.usePivots ? s.ph.step(i, v) : NaN;
      const pl = cfg.usePivots ? s.pl.step(i, v) : NaN;

      const zInst = eq(sdInstROC, 0) ? 0 : instROC / sdInstROC;
      const zRet = eq(sdRetROC, 0) ? 0 : retROC / sdRetROC;
      const retQuiet = le(Math.abs(retROC), cfg.retQuietK * sdRetROC);
      // math.sign(instROC) != math.sign(retROC): false when one side is na
      const sI = Math.sign(instROC);
      const sR = Math.sign(retROC);
      const opposite = !isNaN(sI) && !isNaN(sR) && sI !== sR;
      const zGapOK = ge(Math.abs(zInst) - Math.abs(zRet), cfg.zGapCut);
      const instBig = ge(Math.abs(instROC), cfg.minInstROC);
      const symBreakRaw = ge(Math.abs(zInst), cfg.zInstCut) && zGapOK && instBig && (retQuiet || opposite);
      const canFire = isNaN(vars.lastIdx) || i - vars.lastIdx > cfg.coolOff;
      const symBreak = symBreakRaw && canFire;
      if (symBreak) vars.lastIdx = i;

      const prevRet = vars.prevRet;
      const retFlipUp = !isNaN(r) && !isNaN(prevRet) && r > 0 && prevRet <= 0;
      const retFlipDown = !isNaN(r) && !isNaN(prevRet) && r < 0 && prevRet >= 0;
      if (!isNaN(r)) vars.prevRet = r;
      const markers = s.markers;
      // plotchar(showRetFlips and retFlipUp ? retNet : na, char = "▲", location.absolute, color.lime, size.tiny)
      if (cfg.showRetFlips && retFlipUp) {
        markers.push({ id: 'char0', time: t, position: 'atPriceMiddle', price: r, shape: 'circle', color: 'transparent', text: '▲',
          textColor: color.lime, size: 'tiny' });
      }
      if (cfg.showRetFlips && retFlipDown) {
        markers.push({ id: 'char1', time: t, position: 'atPriceMiddle', price: r, shape: 'circle', color: 'transparent', text: '▼',
          textColor: color.red, size: 'tiny' });
      }

      const newHighNow = !cfg.usePivots && gt(v, hi);
      const newLowNow = !cfg.usePivots && lt(v, lo);
      const pivotTopNow = cfg.usePivots && !isNaN(ph);
      const pivotBotNow = cfg.usePivots && !isNaN(pl);
      const topNowRaw = newHighNow || pivotTopNow;
      const botNowRaw = newLowNow || pivotBotNow;
      const topNow = cfg.requireSym ? topNowRaw && symBreak : topNowRaw;
      const botNow = cfg.requireSym ? botNowRaw && symBreak : botNowRaw;
      const canTop = isNaN(vars.lastTopIdx) || i - vars.lastTopIdx > cfg.dedupeBars;
      const canBot = isNaN(vars.lastBotIdx) || i - vars.lastBotIdx > cfg.dedupeBars;
      const topFire = topNow && canTop;
      const botFire = botNow && canBot;
      if (topFire) vars.lastTopIdx = i;
      if (botFire) vars.lastBotIdx = i;
      // alertcondition flags in the original's order
      const f = s.flags;
      f[0][i] = retFlipUp;
      f[1][i] = retFlipDown;
      f[2][i] = retFlipUp || retFlipDown;
      f[3][i] = topFire;
      f[4][i] = botFire;
      f[5][i] = symBreak;
      for (let k = 0; k < 6; k++) if (f[k][i]) s.times[k].push(t as number);
      // plotchar(topFire ? instNet : na, "Institutional Extreme High", "●", location.absolute, size.tiny, aqua)
      if (topFire && !isNaN(v)) {
        markers.push({ id: 'char2', time: t, position: 'atPriceMiddle', price: v, shape: 'circle', color: 'transparent', text: '●',
          textColor: color.aqua, size: 'tiny' });
      }
      if (botFire && !isNaN(v)) {
        markers.push({ id: 'char3', time: t, position: 'atPriceMiddle', price: v, shape: 'circle', color: 'transparent', text: '●',
          textColor: color.orange, size: 'tiny' });
      }
      // bgcolor layers in Pine order (the later call is drawn on top)
      if (cfg.showExtBG && topFire) s.bgColors.push({ time: t, color: extTopBg });
      if (cfg.showExtBG && botFire) s.bgColors.push({ time: t, color: extBotBg });
      if (cfg.shadeBG && symBreak) s.bgColors.push({ time: t, color: symBg });
      // plotshape(showMarks and symBreak, style = shape.circle, location = location.top, size = size.tiny,
      //           color = color.fuchsia, text = "Break"): Pine default text colour (blue)
      if (cfg.showMarks && symBreak) {
        markers.push({ id: 'shape4', time: t, position: 'top', shape: 'circle', color: color.fuchsia, text: 'Break', textColor: color.blue,
          size: 'tiny' });
      }
      s.plot0[i] = { time: t, value: v, color: instColor(v) };
      s.plot1[i] = { time: t, value: r, color: retColor(r) };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero', color: ZERO_COLOR, linestyle: 'dashed' } },
          { value: cfg.thrShow, options: { title: ' +Thr', color: THR_COLOR, linestyle: 'dashed' } },
          { value: -cfg.thrShow, options: { title: ' -Thr', color: THR_COLOR, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_plus', plot2: 'hline_minus', colors: new Array<string>(n).fill(THR_FILL) },
        ],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RetailVsBankerNetPositionsSymmetryBreakInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RetailVsBankerNetPositionsSymmetryBreakInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Retail Flip: Red → Green', message: 'Retail (proxy) crossed above zero — color changed from red to green.' },
  { id: 'alert1', title: 'Retail Flip: Green → Red', message: 'Retail (proxy) crossed below zero — color changed from green to red.' },
  { id: 'alert2', title: 'Retail Flip: Either Direction', message: 'Retail (proxy) changed color (crossed the zero line).' },
  { id: 'alert3', title: 'Institutional Extreme HIGH', message: 'Institutional proxy reached an extreme HIGH (pivot/window).' },
  { id: 'alert4', title: 'Institutional Extreme LOW', message: 'Institutional proxy reached an extreme LOW (pivot/window).' },
  {
    id: 'alert5',
    title: 'Symmetry Break (Institution)',
    message: 'Institution line made a sudden, outsized move while Retail was quiet or opposite (symmetry broken).',
  },
];

export const RetailVsBankerNetPositionsSymmetryBreak = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  alertConditions,
};
