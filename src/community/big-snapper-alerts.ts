/**
 * Big Snapper Alerts R3.0 by JustUncleL
 *
 * Multi-MA signal indicator with ColouredMA (HullMA default), Fast/Medium/Slow MAs,
 * SuperTrend filtering, Bollinger Band OutsideIn swing filter, and buy/sell markers.
 * Supports 11 MA types: SMA, EMA, WMA, VWMA, SMMA, DEMA, TEMA, HullMA, ZEMA, TMA, SSMA.
 * The ColouredMA and MACross signals are big arrows (the original's plotarrow, `arrows` of the result); the
 * Bollinger Bands (hidden by default, as in the original) carry the "BB fill".
 *
 * Reference: "Big Snapper Alerts R3.0 by JustUncleL"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ArrowData } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface BigSnapperAlertsInputs {
  typeColoured: string;
  lenColoured: number;
  typeFast: string;
  lenFast: number;
  typeMedium: string;
  lenMedium: number;
  typeSlow: string;
  lenSlow: number;
  filterOption: string;
  showMALines: boolean;
  showSuperTrend: boolean;
  showBollingerBands: boolean;
  sFactor: number;
  sPd: number;
  bbLength: number;
  bbStddev: number;
  oiLength: number;
}

export const defaultInputs: BigSnapperAlertsInputs = {
  typeColoured: 'HullMA',
  lenColoured: 18,
  typeFast: 'EMA',
  lenFast: 21,
  typeMedium: 'EMA',
  lenMedium: 55,
  typeSlow: 'EMA',
  lenSlow: 89,
  filterOption: 'SuperTrend',
  showMALines: true,
  showSuperTrend: false,
  showBollingerBands: false,
  sFactor: 3.618,
  sPd: 5,
  bbLength: 20,
  bbStddev: 2.0,
  oiLength: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'typeColoured', type: 'string', title: 'Coloured MA Type', defval: 'HullMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'TMA', 'SSMA'] },
  { id: 'lenColoured', type: 'int', title: 'Coloured MA Length', defval: 18, min: 1 },
  { id: 'typeFast', type: 'string', title: 'Fast MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'TMA', 'SSMA'] },
  { id: 'lenFast', type: 'int', title: 'Fast MA Length', defval: 21, min: 1 },
  { id: 'typeMedium', type: 'string', title: 'Medium MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'TMA', 'SSMA'] },
  { id: 'lenMedium', type: 'int', title: 'Medium MA Length', defval: 55, min: 1 },
  { id: 'typeSlow', type: 'string', title: 'Slow MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'TMA', 'SSMA'] },
  { id: 'lenSlow', type: 'int', title: 'Slow MA Length', defval: 89, min: 1 },
  { id: 'filterOption', type: 'string', title: 'Signal Filter', defval: 'SuperTrend', options: ['SuperTrend', '3xMATrend', 'SuperTrend+3xMA', 'MACross', 'MACross+ST', 'MACross+3xMA', 'OutsideIn:MACross', 'OutsideIn:MACross+ST', 'OutsideIn:MACross+3xMA', 'ColouredMA', 'No Alerts'] },
  { id: 'showMALines', type: 'bool', title: 'Show MA Lines', defval: true },
  { id: 'showSuperTrend', type: 'bool', title: 'Show SuperTrend', defval: false },
  { id: 'showBollingerBands', type: 'bool', title: 'Show Bollinger Bands', defval: false },
  { id: 'sFactor', type: 'float', title: 'SuperTrend Factor', defval: 3.618, min: 1, step: 0.1 },
  { id: 'sPd', type: 'int', title: 'SuperTrend Length', defval: 5, min: 1 },
  { id: 'bbLength', type: 'int', title: 'Bollinger Length', defval: 20, min: 2 },
  { id: 'bbStddev', type: 'float', title: 'Bollinger StdDevs', defval: 2.0, min: 0.5, step: 0.1 },
  { id: 'oiLength', type: 'int', title: 'OutsideIn LookBack', defval: 8, min: 1 },
];

/** dodgerblue #1E90FF with transp 20 (lines) / 96 (fill) */
const BB_LINE = 'rgba(30, 144, 255, 0.8)';
const BB_FILL = 'rgba(30, 144, 255, 0.04)';
/** plotarrow colours: colorup = green, colordown = maroon (Pine v3 constants), transp 20 */
const ARROW_UP = 'rgba(0, 128, 0, 0.8)';
const ARROW_DOWN = 'rgba(128, 0, 0, 0.8)';

export const plotConfig: PlotConfig[] = [
  { id: 'colouredMA', title: 'Coloured MA', color: '#1E90FF', lineWidth: 3 },
  { id: 'fastMA', title: 'Fast MA', color: '#00FF00', lineWidth: 2 },
  { id: 'mediumMA', title: 'Medium MA', color: '#FF0000', lineWidth: 2 },
  { id: 'slowMA', title: 'Slow MA', color: '#808080', lineWidth: 2 },
  { id: 'superTrend', title: 'SuperTrend', color: '#008000', lineWidth: 2 },
  { id: 'bbUpper', title: 'BB upper', color: BB_LINE, lineWidth: 1 },
  { id: 'bbLower', title: 'BB lower', color: BB_LINE, lineWidth: 1 },
];

export const metadata = {
  title: 'Big Snapper Alerts R3.0',
  shortTitle: 'SNAPPER',
  overlay: true,
};

/** One moving average of {@link variant} stepped bar by bar (step(source, volume), commit at the end of a bar) */
type MaStep = Committable & { step(v: number, volume: number): number };

/** SMMA: the SMA until the first value, then (prev * (len - 1) + src) / len */
class SmmaStep implements MaStep {
  private readonly sma = taStep.sma();
  private prev = NaN;
  private next = NaN;

  constructor(private readonly len: number) {}

  step(v: number): number {
    const sma = this.sma.step(v, this.len);
    this.next = isNaN(this.prev) ? sma : (this.prev * (this.len - 1) + v) / this.len;
    return this.next;
  }

  commit(): void {
    this.sma.commit();
    this.prev = this.next;
  }
}

/** SSMA: the SuperSmoother filter (Ehlers) of the source, the source while the two results before are na */
class SsmaStep implements MaStep {
  private readonly c1: number;
  private readonly c2: number;
  private readonly c3: number;
  /** bars stepped, the source and the two results before */
  private count = 0;
  private src1 = NaN;
  private r1 = NaN;
  private r2 = NaN;
  private nextSrc = NaN;
  private next = NaN;

  constructor(len: number) {
    const pi = Math.PI;
    const a1 = Math.exp(-1.414 * pi / len);
    const b1 = 2 * a1 * Math.cos(1.414 * pi / len);
    this.c2 = b1;
    this.c3 = -(a1 * a1);
    this.c1 = 1 - this.c2 - this.c3;
  }

  step(v: number): number {
    this.nextSrc = v;
    if (isNaN(v)) this.next = NaN;
    else if (this.count < 2 || isNaN(this.r1) || isNaN(this.r2)) this.next = v;
    else this.next = this.c1 * (v + this.src1) / 2 + this.c2 * this.r1 + this.c3 * this.r2;
    return this.next;
  }

  commit(): void {
    this.count++;
    this.src1 = this.nextSrc;
    this.r2 = this.r1;
    this.r1 = this.next;
  }
}

/**
 * A moving average of the given type, one bar at a time.
 */
function variant(len: number, type: string): MaStep {
  const sma = (l: number): MaStep => {
    const m = taStep.sma();
    return { step: (v) => m.step(v, l), commit: () => m.commit() };
  };
  const wma = (l: number): MaStep => {
    const m = taStep.wma();
    return { step: (v) => m.step(v, l), commit: () => m.commit() };
  };
  switch (type) {
    case 'SMA':
      return sma(len);
    case 'EMA':
      return taStep.ema(len);
    case 'WMA':
      return wma(len);
    case 'VWMA': {
      const m = taStep.vwma(len);
      return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() };
    }
    case 'SMMA':
      return new SmmaStep(len);
    case 'DEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      return {
        step: (v) => { const a = e1.step(v); return 2 * a - e2.step(a); },
        commit: () => { e1.commit(); e2.commit(); },
      };
    }
    case 'TEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      const e3 = taStep.ema(len);
      return {
        step: (v) => { const a = e1.step(v); const b = e2.step(a); return 3 * (a - b) + e3.step(b); },
        commit: () => { e1.commit(); e2.commit(); e3.commit(); },
      };
    }
    case 'HullMA': {
      const halfLen = Math.max(1, Math.floor(len / 2));
      const sqrtLen = Math.max(1, Math.round(Math.sqrt(len)));
      const w1 = wma(halfLen);
      const w2 = wma(len);
      const w3 = wma(sqrtLen);
      return {
        step: (v) => w3.step(2 * w1.step(v, 0) - w2.step(v, 0), 0),
        commit: () => { w1.commit(); w2.commit(); w3.commit(); },
      };
    }
    case 'ZEMA': {
      // ZEMA: v1 = sma(src, len), e = ema(v1, len), zema = v1 + (v1 - e)
      const v1 = sma(len);
      const e = taStep.ema(len);
      return {
        step: (v) => { const a = v1.step(v, 0); return a + (a - e.step(a)); },
        commit: () => { v1.commit(); e.commit(); },
      };
    }
    case 'TMA': {
      const s1 = sma(len);
      const s2 = sma(len);
      return { step: (v) => s2.step(s1.step(v, 0), 0), commit: () => { s1.commit(); s2.commit(); } };
    }
    case 'SSMA':
      // SuperSmoother filter (Ehlers)
      return new SsmaStep(len);
    default:
      return sma(len);
  }
}

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

/** `ta.sma(source, length)` and `ta.stdev(source, length)` (biased) with a constant length, from one {@link WindowSum}
 *  of the values and one of the squares (the operations of taStep.sma / taStep.stdev) */
class WindowBb implements Committable {
  private readonly sums: WindowSum;
  private readonly squares: WindowSum;
  private readonly len: number;
  basis = NaN;
  dev = NaN;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.sums = new WindowSum(length);
    this.squares = new WindowSum(length);
  }

  step(value: number): void {
    const sum = this.sums.step(value);
    const sq = this.squares.step(value === undefined || value === null || !Number.isFinite(value) ? NaN : value * value);
    this.basis = sum / this.len;
    if (this.len <= 0) { this.dev = NaN; return; }
    const mean = sum / this.len;
    const v = sq / this.len - mean * mean;
    this.dev = Number.isNaN(v) ? NaN : v > 0 ? Math.sqrt(v) : 0;
  }

  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; arrows: ArrowData[] };
type Point = { time: number; value: number; color?: string };

interface SnapperRun extends BarRunState<Record<string, never>> {
  mas: MaStep[];
  atr: ReturnType<typeof taStep.atr>;
  bb: WindowBb;
  maColoured: number[];
  maFast: number[];
  clrDirection: number[];
  sTrendUp: number[];
  sTrendDown: number[];
  sTrend: number[];
  bbUpper: number[];
  bbLower: number[];
  /** stBuy, stSell, 3xmaBuy, 3xmaSell, hBuy, hSell, macrossBuy, macrossSell */
  counts: number[][];
  plots: Point[][];
  markers: MarkerData[];
  arrows: ArrowData[];
}

function study(inputs: Partial<BigSnapperAlertsInputs>): BarStudy<SnapperRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // Parse filter option
  const fo = cfg.filterOption;
  const uSuperTrendFilter = fo === 'SuperTrend';
  const u3xMATrendFilter = fo === '3xMATrend';
  const uBothTrendFilters = fo === 'SuperTrend+3xMA';
  const uMACrossFilter = fo === 'MACross';
  const uMACrossSTFilter = fo === 'MACross+ST';
  const uMACross3xMAFilter = fo === 'MACross+3xMA';
  const uOIMACrossFilter = fo === 'OutsideIn:MACross';
  const uOISTFilter = fo === 'OutsideIn:MACross+ST';
  const uOI3xMAFilter = fo === 'OutsideIn:MACross+3xMA';
  const disableAllFilters = fo === 'ColouredMA';
  const noAlerts = fo === 'No Alerts';
  const warmup = Math.max(cfg.lenColoured, cfg.lenFast, cfg.lenMedium, cfg.lenSlow, cfg.sPd, cfg.bbLength) + 5;
  const bullCss = '#1E90FF';
  const bearCss = '#F08080';
  return {
    init() {
      // Compute MAs
      const mas = [
        variant(cfg.lenColoured, cfg.typeColoured), variant(cfg.lenFast, cfg.typeFast),
        variant(cfg.lenMedium, cfg.typeMedium), variant(cfg.lenSlow, cfg.typeSlow),
      ];
      const atr = taStep.atr(cfg.sPd);
      const bb = new WindowBb(cfg.bbLength);
      const s: SnapperRun = {
        mas, atr, bb, maColoured: [], maFast: [], clrDirection: [], sTrendUp: [], sTrendDown: [], sTrend: [],
        bbUpper: [], bbLower: [], counts: Array.from({ length: 8 }, () => []), plots: Array.from({ length: 7 }, () => []),
        markers: [], arrows: [],
        steps: [...mas, atr, bb], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.arrows];
      s.series = [
        s.maColoured, s.maFast, s.clrDirection, s.sTrendUp, s.sTrendDown, s.sTrend, s.bbUpper, s.bbLower, ...s.counts,
        ...s.plots,
      ];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const time = bar.time;
      const close = bar.close;
      const vol = bar.volume ?? 0;
      const maColoured = s.mas[0].step(close, vol);
      const maFast = s.mas[1].step(close, vol);
      const maMedium = s.mas[2].step(close, vol);
      const maSlow = s.mas[3].step(close, vol);
      s.maColoured[i] = maColoured;
      s.maFast[i] = maFast;

      // Coloured MA direction: rising(2) = 1, falling(2) = -1, else prev (1 on the first two bars)
      let clrDirection = 1;
      if (i >= 2) {
        if (maColoured > s.maColoured[i - 2]) clrDirection = 1;
        else if (maColoured < s.maColoured[i - 2]) clrDirection = -1;
        else clrDirection = s.clrDirection[i - 1];
      }
      s.clrDirection[i] = clrDirection;

      // 3xMA Trend direction
      let maDirection = 0;
      if (maFast > maMedium && maMedium > maSlow) maDirection = 1;
      else if (maFast < maMedium && maMedium < maSlow) maDirection = -1;

      // SuperTrend calculation
      const hl2 = (bar.high + bar.low) / 2;
      const atrVal = s.atr.step(bar.high, bar.low, close) ?? 0;
      const sUp = hl2 - cfg.sFactor * atrVal;
      const sDn = hl2 + cfg.sFactor * atrVal;
      let sTrendUp: number;
      let sTrendDown: number;
      let sTrend: number;
      if (i === 0) {
        sTrendUp = sUp;
        sTrendDown = sDn;
        sTrend = 1;
      } else {
        const prevClose = bars[i - 1].close;
        sTrendUp = prevClose > s.sTrendUp[i - 1] ? Math.max(sUp, s.sTrendUp[i - 1]) : sUp;
        sTrendDown = prevClose < s.sTrendDown[i - 1] ? Math.min(sDn, s.sTrendDown[i - 1]) : sDn;

        if (close > s.sTrendDown[i - 1]) sTrend = 1;
        else if (close < s.sTrendUp[i - 1]) sTrend = -1;
        else sTrend = s.sTrend[i - 1];
      }
      s.sTrendUp[i] = sTrendUp;
      s.sTrendDown[i] = sTrendDown;
      s.sTrend[i] = sTrend;
      const tsl = sTrend === 1 ? sTrendUp : sTrendDown;

      // Bollinger Bands (for OutsideIn filters)
      s.bb.step(close);
      const bbBasis = s.bb.basis;
      const bbDev = (s.bb.dev ?? 0) * cfg.bbStddev;
      const bbUpper = bbBasis + bbDev;
      const bbLower = bbBasis - bbDev;
      s.bbUpper[i] = bbUpper;
      s.bbLower[i] = bbLower;

      // Accumulators for filtering (0 on the first bar)
      const [stBuy, stSell, _3xmaBuy, _3xmaSell, hBuy, hSell, macrossBuy, macrossSell] = s.counts;
      if (i === 0) {
        for (const c of s.counts) c[i] = 0;
      } else {
        const crossoverFastColoured = s.maFast[i - 1] <= s.maColoured[i - 1] && maFast > maColoured;
        const crossunderFastColoured = s.maFast[i - 1] >= s.maColoured[i - 1] && maFast < maColoured;

        // SuperTrend filter
        stBuy[i] = clrDirection === 1 && sTrend === 1 ? stBuy[i - 1] + 1 : 0;
        stSell[i] = clrDirection === -1 && sTrend === -1 ? stSell[i - 1] + 1 : 0;

        // 3xMA filter
        _3xmaBuy[i] = clrDirection === 1 && close > maFast && maDirection === 1
          ? _3xmaBuy[i - 1] + 1
          : (clrDirection === 1 && maDirection === 1 && _3xmaBuy[i - 1] > 0 ? _3xmaBuy[i - 1] + 1 : 0);
        _3xmaSell[i] = clrDirection === -1 && close < maFast && maDirection === -1
          ? _3xmaSell[i - 1] + 1
          : (clrDirection === -1 && maDirection === -1 && _3xmaSell[i - 1] > 0 ? _3xmaSell[i - 1] + 1 : 0);

        // Hull/ColouredMA direction signals
        hBuy[i] = clrDirection === 1 ? hBuy[i - 1] + 1 : 0;
        hSell[i] = clrDirection === -1 ? hSell[i - 1] + 1 : 0;

        // MA Cross signals
        macrossBuy[i] = crossoverFastColoured ? macrossBuy[i - 1] + 1 : 0;
        macrossSell[i] = crossunderFastColoured ? macrossSell[i - 1] + 1 : 0;

        if (!(i < warmup || noAlerts)) {
          // Combined SuperTrend+3xMA
          const st3xmaBuyV = (_3xmaBuy[i] > 0) && stBuy[i] > 0;
          const st3xmaSellV = (_3xmaSell[i] > 0) && stSell[i] > 0;

          // MACross + SuperTrend
          const macrossSTBuyV = crossoverFastColoured && sTrend === 1;
          const macrossSTSellV = crossunderFastColoured && sTrend === -1;

          // MACross + 3xMA
          const macross3xMABuyV = crossoverFastColoured && maDirection === 1;
          const macross3xMASellV = crossunderFastColoured && maDirection === -1;

          // OutsideIn MACross: check if highest/lowest within lookback broke BB
          let oiMACrossBuyV = false;
          let oiMACrossSellV = false;
          if (uOIMACrossFilter || uOISTFilter || uOI3xMAFilter) {
            // Find highest bar index in lookback
            let highestVal = -Infinity;
            let highestIdx = 0;
            let lowestVal = Infinity;
            let lowestIdx = 0;
            const lookStart = Math.max(0, i - cfg.oiLength + 1);
            for (let j = lookStart; j <= i; j++) {
              if (bars[j].high > highestVal) { highestVal = bars[j].high; highestIdx = j; }
              if (bars[j].low < lowestVal) { lowestVal = bars[j].low; lowestIdx = j; }
            }
            const noiUpper = i - highestIdx;
            const noiLower = i - lowestIdx;

            if (crossunderFastColoured && noiUpper > 0 && highestVal > s.bbUpper[highestIdx]) {
              oiMACrossSellV = true;
            }
            if (crossoverFastColoured && noiLower > 0 && lowestVal < s.bbLower[lowestIdx]) {
              oiMACrossBuyV = true;
            }
          }

          // Check long signals
          let longSignal = false;
          let shortSignal = false;

          if (uSuperTrendFilter && stBuy[i] === 1) longSignal = true;
          if (u3xMATrendFilter && _3xmaBuy[i] === 1) longSignal = true;
          if (uBothTrendFilters && st3xmaBuyV && (stBuy[i] === 1 || _3xmaBuy[i] === 1)) longSignal = true;
          if (uMACrossSTFilter && macrossSTBuyV) longSignal = true;
          if (uMACross3xMAFilter && macross3xMABuyV) longSignal = true;
          if (uOIMACrossFilter && oiMACrossBuyV) longSignal = true;
          if (uOISTFilter && oiMACrossBuyV && sTrend === 1) longSignal = true;
          if (uOI3xMAFilter && oiMACrossBuyV && maDirection === 1) longSignal = true;

          if (uSuperTrendFilter && stSell[i] === 1) shortSignal = true;
          if (u3xMATrendFilter && _3xmaSell[i] === 1) shortSignal = true;
          if (uBothTrendFilters && st3xmaSellV && (stSell[i] === 1 || _3xmaSell[i] === 1)) shortSignal = true;
          if (uMACrossSTFilter && macrossSTSellV) shortSignal = true;
          if (uMACross3xMAFilter && macross3xMASellV) shortSignal = true;
          if (uOIMACrossFilter && oiMACrossSellV) shortSignal = true;
          if (uOISTFilter && oiMACrossSellV && sTrend === -1) shortSignal = true;
          if (uOI3xMAFilter && oiMACrossSellV && maDirection === -1) shortSignal = true;

          // plotarrow(along ? 1 : ashort ? -1 : na, "ColouredMA or MACross Arrow", colorup = green, colordown = maroon)
          const along = (disableAllFilters && hBuy[i] === 1) || (uMACrossFilter && macrossBuy[i] === 1);
          const ashort = (disableAllFilters && hSell[i] === 1) || (uMACrossFilter && macrossSell[i] === 1);
          if (along) s.arrows.push({ time, id: 'arrow0', value: 1, color: ARROW_UP });
          else if (ashort) s.arrows.push({ time, id: 'arrow0', value: -1, color: ARROW_DOWN });

          if (longSignal) {
            s.markers.push({ time, position: 'belowBar', shape: 'arrowUp', color: '#00FF00', text: 'Buy' });
          }
          if (shortSignal) {
            s.markers.push({ time, position: 'aboveBar', shape: 'arrowDown', color: '#800000', text: 'Sell' });
          }
        }
      }

      // Build plots
      const p = s.plots;
      p[0][i] = { time, value: i < warmup ? NaN : maColoured, color: clrDirection < 0 ? bearCss : bullCss };
      p[1][i] = { time, value: (i < warmup || !cfg.showMALines) ? NaN : maFast };
      p[2][i] = { time, value: (i < warmup || !cfg.showMALines) ? NaN : maMedium };
      p[3][i] = { time, value: (i < warmup || !cfg.showMALines) ? NaN : maSlow };
      p[4][i] = { time, value: (i < warmup || !cfg.showSuperTrend) ? NaN : tsl, color: sTrend === 1 ? '#008000' : '#800000' };
      // plot(hideBollingerBands ? na : upper / lower, "BB upper" / "BB lower", dodgerblue, transp = 20)
      p[5][i] = { time, value: cfg.showBollingerBands ? bbUpper : NaN };
      p[6][i] = { time, value: cfg.showBollingerBands ? bbLower : NaN };
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          colouredMA: p[0].slice(),
          fastMA: p[1].slice(),
          mediumMA: p[2].slice(),
          slowMA: p[3].slice(),
          superTrend: p[4].slice(),
          bbUpper: p[5].slice(),
          bbLower: p[6].slice(),
        },
        // fill(p1, p2, color = dodgerblue, transp = 96, title = "BB fill")
        fills: [{ plot1: 'bbUpper', plot2: 'bbLower', options: { title: 'BB fill', color: BB_FILL } }],
        markers: s.markers.slice(),
        arrows: s.arrows.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BigSnapperAlertsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<BigSnapperAlertsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; arrows: ArrowData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const BigSnapperAlerts = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
