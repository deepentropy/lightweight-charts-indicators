/**
 * Curved Trend Channels (Zeiierman)
 *
 * A range threshold r = max(SMA(2.618 * MA(|MA(high) - MA(low[1])|), rLen) * bandMult, 0.0001), with MA the
 * selected smoothing (SMA, EMA, RMA, HMA, KAMA, VIDYA, FRAMA, Super Smoother). A step trend line follows the close:
 * when the close moves more than r away from it, the line jumps to the mean of the close and the line; otherwise it
 * steps by buffer / mult / slope in its direction. The buffer is reset to r when the direction changes; the bands
 * are the line +/- the buffer. In curved mode, the line restarts at the close when the close moves more than r
 * away, and otherwise grows by (baseStep + growth * bars since the restart) * ATR(14), at most 1.1 * ATR. The line
 * is teal in an up direction, red otherwise, with gradient fills to the bands. Optional candle colours: bull when a
 * slower step trend is up and the MA(close, 10), SMA(trend, 2) and SMA(trend, 4) all rise, bear for the opposite.
 *
 * Reference: "Curved Trend Channels (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowSum, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type CurvedTrendChannelsMaType = 'SMA' | 'EMA' | 'RMA' | 'HMA' | 'KAMA' | 'VIDYA' | 'FRAMA' | 'Super Smoother';

export interface CurvedTrendChannelsInputs {
  /** Scaled volatility length (SMA of the volatility) */
  rLen: number;
  /** Smoothing type of the range filter (and of the MA(close, 10) of the candle colours) */
  maType: CurvedTrendChannelsMaType;
  /** Volatility MA length */
  maLen: number;
  /** High / low smoother length */
  hiloLen: number;
  /** Band multiplier */
  bandMult: number;
  /** Slope of the regular trend channel */
  slope: number;
  /** Multiplicative factor of the regular trend channel */
  mult: number;
  /** Curved channel mode */
  useCurvedMode: boolean;
  /** Base step (x ATR) of the curved mode */
  baseStep: number;
  /** Growth per bar (x ATR) of the curved mode */
  boost: number;
  /** Candle colouring */
  showCandleColor: boolean;
  /** Candle trend length */
  candleLen: number;
  bullCandleColor: string;
  bearCandleColor: string;
  /** Gradient fills between the trend line and the bands */
  showArea: boolean;
  upperColor: string;
  lowerColor: string;
}

export const defaultInputs: CurvedTrendChannelsInputs = {
  rLen: 100,
  maType: 'SMA',
  maLen: 100,
  hiloLen: 100,
  bandMult: 1.8,
  slope: 25,
  mult: 2.0,
  useCurvedMode: false,
  baseStep: 0.05,
  boost: 0.001,
  showCandleColor: false,
  candleLen: 200,
  bullCandleColor: color.lime,
  bearCandleColor: color.red,
  showArea: true,
  upperColor: color.teal,
  lowerColor: color.red,
};

const MA_TYPES: CurvedTrendChannelsMaType[] = ['SMA', 'EMA', 'RMA', 'HMA', 'KAMA', 'VIDYA', 'FRAMA', 'Super Smoother'];

export const inputConfig: InputConfig[] = [
  { id: 'rLen', type: 'int', title: 'Scaled Volatility Length', defval: 100, min: 1, group: 'Range Filter' },
  { id: 'maType', type: 'string', title: 'Smoothing Type', defval: 'SMA', options: MA_TYPES, group: 'Range Filter' },
  { id: 'maLen', type: 'int', title: 'Volatility MA Length', defval: 100, min: 2, group: 'Range Filter' },
  { id: 'hiloLen', type: 'int', title: 'High/Low Smoother Length', defval: 100, min: 2, group: 'Range Filter' },
  { id: 'bandMult', type: 'float', title: 'Band Multiplier', defval: 1.8, min: 0.1, step: 0.1, group: 'Range Filter' },
  { id: 'slope', type: 'float', title: 'Slope', defval: 25, min: 0.1, group: 'Regular Trend Channel' },
  { id: 'mult', type: 'float', title: 'Multiplicative Factor', defval: 2.0, min: 0.1, step: 0.1, group: 'Regular Trend Channel' },
  { id: 'useCurvedMode', type: 'bool', title: 'Curved Channel Mode', defval: false, group: 'Curved Channel Mode' },
  { id: 'baseStep', type: 'float', title: 'Base Step (× ATR)', defval: 0.05, max: 0.3, step: 0.001, group: 'Curved Channel Mode' },
  { id: 'boost', type: 'float', title: 'Growth per Bar (× ATR)', defval: 0.001, min: 0, step: 0.001, group: 'Curved Channel Mode' },
  { id: 'showCandleColor', type: 'bool', title: 'Enable Candle Coloring', defval: false, group: 'Candle Coloring' },
  { id: 'candleLen', type: 'int', title: 'Candle Trend Length', defval: 200, min: 1, group: 'Candle Coloring' },
  { id: 'bullCandleColor', type: 'color', title: 'Bull Candle Color', defval: color.lime, group: 'Candle Coloring' },
  { id: 'bearCandleColor', type: 'color', title: 'Bear Candle Color', defval: color.red, group: 'Candle Coloring' },
  { id: 'showArea', type: 'bool', title: 'Show Gradient Fill', defval: true, group: 'Display & Style' },
  { id: 'upperColor', type: 'color', title: 'Trend Up Color', defval: color.teal, group: 'Display & Style' },
  { id: 'lowerColor', type: 'color', title: 'Trend Down Color', defval: color.red, group: 'Display & Style' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Line', color: color.teal, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Curved Trend Channels (Zeiierman)',
  shortTitle: 'Curved Trend Channels (Zeiierman)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);
/** Pine x / y: na when y is 0 */
const div = (x: number, y: number) => (y === 0 ? NaN : x / y);

/**
 * ma(src, len) of the script, one bar at a time: one call of the selected smoothing (each call site has its own
 * state). step(src) gives the value of the current bar from the committed state; commit() keeps it.
 */
class MaStep implements Committable {
  private readonly avg: { step(v: number): number; commit(): void } | null = null;
  private readonly wHalf: ReturnType<typeof taStep.wma> | null = null;
  private readonly wFull: ReturnType<typeof taStep.wma> | null = null;
  private readonly wOut: ReturnType<typeof taStep.wma> | null = null;
  private readonly sum: WindowSum | null = null;
  private readonly sm1: WindowSum | null = null;
  private readonly sm2: WindowSum | null = null;
  private readonly ext: WindowExtreme[] = [];
  /** Committed sources (KAMA, VIDYA) and highs / lows (FRAMA) */
  private readonly srcs: number[] = [];
  private readonly highs: number[] = [];
  private readonly lows: number[] = [];
  /** result[1], result[2] (committed) */
  private out1 = NaN;
  private out2 = NaN;
  private pSrc = NaN;
  private pHigh = NaN;
  private pLow = NaN;
  private pOut = NaN;
  private stepped = false;
  private readonly n3: number;
  private readonly a1: number;
  private readonly c1: number;
  private readonly c2: number;
  private readonly c3: number;

  constructor(private readonly type: CurvedTrendChannelsMaType, private readonly len: number) {
    switch (type) {
      case 'HMA':
        this.wHalf = taStep.wma();
        this.wFull = taStep.wma();
        this.wOut = taStep.wma();
        break;
      case 'KAMA':
        this.sum = new WindowSum(len);
        break;
      case 'VIDYA':
        this.sm1 = new WindowSum(len);
        this.sm2 = new WindowSum(len);
        break;
      case 'SMA': {
        const m = new WindowSma(len);
        this.avg = m;
        break;
      }
      case 'EMA':
        this.avg = taStep.ema(len);
        break;
      case 'RMA':
        this.avg = taStep.rma(len);
        break;
      default:
        break;
    }
    this.n3 = Math.round(len / 2);
    if (type === 'FRAMA') {
      // ta.highest(high, n3), ta.lowest(low, n3), the same on high[n3] / low[n3], then on high / low with len
      this.ext = [
        new WindowExtreme(false, this.n3), new WindowExtreme(true, this.n3),
        new WindowExtreme(false, this.n3), new WindowExtreme(true, this.n3),
        new WindowExtreme(false, len), new WindowExtreme(true, len),
      ];
    }
    this.a1 = Math.exp((-1.414 * 3.14159) / len);
    const b1 = 2 * this.a1 * Math.cos((1.414 * 3.14159) / len);
    this.c2 = b1;
    this.c3 = -this.a1 * this.a1;
    this.c1 = 1 - this.c2 - this.c3;
  }

  /** Recursive filter: result := nz(result[1]) + alpha * (src - nz(result[1])) */
  private adaptive(src: number, alpha: number): number {
    const prev = nz(this.out1);
    return prev + alpha * (src - prev);
  }

  step(src: number, high: number, low: number): number {
    this.stepped = true;
    this.pSrc = src;
    this.pHigh = high;
    this.pLow = low;
    const len = this.len;
    const count = this.srcs.length;
    const prevSrc = count > 0 ? this.srcs[count - 1] : NaN;
    let out: number;
    switch (this.type) {
      case 'HMA': {
        // ta.wma(2 * ta.wma(src, len / 2) - ta.wma(src, len), math.round(math.sqrt(len)))
        const half = this.wHalf!.step(src, Math.trunc(len / 2));
        const full = this.wFull!.step(src, len);
        out = this.wOut!.step(2 * half - full, Math.round(Math.sqrt(len)));
        break;
      }
      case 'KAMA': {
        const change = Math.abs(src - prevSrc);
        const volatility = this.sum!.step(change);
        const fastSC = 2 / (2 + 1);
        const slowSC = 2 / (30 + 1);
        const direction = Math.abs(src - (count - len >= 0 ? this.srcs[count - len] : NaN));
        const er = div(direction, volatility);
        out = this.adaptive(src, Math.pow(er * (fastSC - slowSC) + slowSC, 2));
        break;
      }
      case 'VIDYA': {
        // ta.cmo(src, len): mom = ta.change(src), sm1 = math.sum(mom >= 0 ? mom : 0), sm2 = math.sum(mom >= 0 ? 0 : -mom)
        const mom = count > 0 ? src - prevSrc : NaN;
        const s1 = this.sm1!.step(mom >= 0 ? mom : 0);
        const s2 = this.sm2!.step(mom >= 0 ? 0 : -mom);
        const cmo = (100 * (s1 - s2)) / (s1 + s2);
        out = this.adaptive(src, Math.abs(cmo) / 100);
        break;
      }
      case 'FRAMA': {
        const n3 = this.n3;
        const k = this.highs.length - n3;
        const [eh1, el1, eh2, el2, eh3, el3] = this.ext;
        const h1 = eh1.step(high);
        const l1 = el1.step(low);
        const h2 = eh2.step(k >= 0 ? this.highs[k] : NaN);
        const l2 = el2.step(k >= 0 ? this.lows[k] : NaN);
        const h3 = eh3.step(high);
        const l3 = el3.step(low);
        const hl1 = h1 - l1;
        const hl2 = h2 - l2;
        const hl3 = h3 - l3;
        const dimen = (Math.log(hl1 + hl2) - Math.log(hl3)) / Math.log(2);
        const a = Math.exp(-4.6 * (dimen - 1));
        out = this.adaptive(src, Math.min(Math.max(a, 0.01), 1.0));
        break;
      }
      case 'Super Smoother':
        out = this.c1 * src + this.c2 * nz(this.out1) + this.c3 * nz(this.out2);
        break;
      default:
        out = this.avg!.step(src);
    }
    this.pOut = out;
    return out;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.avg?.commit();
    this.wHalf?.commit();
    this.wFull?.commit();
    this.wOut?.commit();
    this.sum?.commit();
    this.sm1?.commit();
    this.sm2?.commit();
    for (const e of this.ext) e.commit();
    if (this.type === 'KAMA' || this.type === 'VIDYA') this.srcs.push(this.pSrc);
    if (this.type === 'FRAMA') {
      this.highs.push(this.pHigh);
      this.lows.push(this.pLow);
    }
    this.out2 = this.out1;
    this.out1 = this.pOut;
  }
}

/** var tLine = na, tBuff = 0.0, tDir = 1.0 of a step trend (barsCf: the bars of the curved channel's trend) */
interface TrendState {
  line: number;
  buff: number;
  dir: number;
  barsCf: number;
}

/** f_hyperTrend / f_candleTrend (StepTrend) and f_candleTrend_cf (stepTrend_cf), one bar: same arithmetic */
function stepTrend(st: TrendState, price: number, threshold: number, multFactor: number, stepLen: number): void {
  if (isNaN(st.line)) {
    st.line = price;
    st.dir = 1.0;
    st.buff = threshold;
  } else {
    const prevValue = st.line;
    const prevDir = st.dir;
    const prevBuff = st.buff;
    const jumped = gt(Math.abs(price - prevValue), threshold);
    let stepValue = jumped ? (price + prevValue) / 2 : prevValue;
    if (!jumped) {
      const stepDelta = prevBuff / multFactor / stepLen;
      stepValue = gt(prevDir, 0) ? prevValue + stepDelta : lt(prevDir, 0) ? prevValue - stepDelta : prevValue;
    }
    const newDir = gt(stepValue, prevValue) ? 1.0 : lt(stepValue, prevValue) ? -1.0 : 0.0;
    st.buff = ne(newDir, prevDir) ? threshold : prevBuff;
    st.line = stepValue;
    st.dir = newDir;
  }
}

/** f_curvedChannel_cf(close, rangeThresh_cf, baseStep_cf, boost_cf, 1), one bar */
function curvedChannelStep(st: TrendState, price: number, threshold: number, atr: number, baseStep: number, boost: number): void {
  if (isNaN(st.line)) {
    st.line = price;
    st.dir = 1.0;
    st.buff = threshold;
    st.barsCf = 0;
  } else {
    const prevTrend = st.line;
    const prevBuff = st.buff;
    const prevDir = st.dir;
    const startLong = gt(price, prevTrend + threshold);
    const startShort = lt(price, prevTrend - threshold);
    if (startLong || startShort) {
      st.line = price;
      st.dir = startLong ? 1.0 : -1.0;
      st.buff = threshold;
      st.barsCf = 1;
    } else {
      st.barsCf += 1;
      const rawStep = baseStep * atr + boost * atr * st.barsCf;
      const stepGrow = Math.min(rawStep, 1.1 * atr);
      st.line = gt(prevDir, 0) ? prevTrend + stepGrow : lt(prevDir, 0) ? prevTrend - stepGrow : prevTrend;
      st.buff = prevBuff;
    }
    // if not na(tLine_cf[1]): always true here (tLine_cf was not na at the start of the bar)
    st.dir = gt(st.line, prevTrend) ? 1.0 : lt(st.line, prevTrend) ? -1.0 : 0.0;
    if (ne(st.dir, prevDir)) st.buff = threshold;
  }
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> };

interface CtcVars {
  candle: TrendState;
  channel: TrendState;
}

interface CtcRun extends BarRunState<CtcVars> {
  highMa: MaStep;
  lowMa: MaStep;
  volMa: MaStep;
  srcMaStep: MaStep;
  r: WindowSma;
  medium: WindowSma;
  long: WindowSma;
  atr: ReturnType<typeof taStep.atr> | null;
  srcMa: number[];
  trendMedium: number[];
  trendLong: number[];
  tLine: number[];
  upper: number[];
  lower: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  candles: PlotCandleData[];
}

function study(inputs: Partial<CurvedTrendChannelsInputs>): BarStudy<CtcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const curved = cfg.useCurvedMode;
  const neutral = String(color.new(color.gray, 85));
  const newTrend = (): TrendState => ({ line: NaN, buff: 0.0, dir: 1.0, barsCf: 0 });
  return {
    init() {
      const s: CtcRun = {
        // f_rangeFilter(high, low, hilo_len, ma_len, r_len, band_mult); f_rangeFilter_cf is the same computation
        highMa: new MaStep(cfg.maType, cfg.hiloLen), lowMa: new MaStep(cfg.maType, cfg.hiloLen),
        volMa: new MaStep(cfg.maType, cfg.maLen), srcMaStep: new MaStep(cfg.maType, 10),
        r: new WindowSma(cfg.rLen), medium: new WindowSma(2), long: new WindowSma(4),
        atr: curved ? taStep.atr(14) : null,
        srcMa: [], trendMedium: [], trendLong: [], tLine: [], upper: [], lower: [],
        plot0: [], plot1: [], plot2: [], candles: [],
        steps: [], vars: { candle: newTrend(), channel: newTrend() }, lists: [], series: [],
      };
      s.steps = [s.highMa, s.lowMa, s.volMa, s.srcMaStep, s.r, s.medium, s.long, ...(s.atr ? [s.atr] : [])];
      s.series = [
        s.srcMa, s.trendMedium, s.trendLong, s.tLine, s.upper, s.lower, s.plot0, s.plot1, s.plot2, s.candles,
      ];
      return s;
    },
    copyVars: (v) => ({ candle: { ...v.candle }, channel: { ...v.channel } }),
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const prevLow = i > 0 ? bars[i - 1].low : NaN;
      const highMa = s.highMa.step(b.high, b.high, b.low);
      const lowMa = s.lowMa.step(prevLow, b.high, b.low);
      const diff = Math.abs(highMa - lowMa);
      const vol = s.volMa.step(diff, b.high, b.low) * 2.618;
      const r = Math.max(s.r.step(vol) * cfg.bandMult, 0.0001);
      // the curved channel's ATR is read on every bar (ta.atr(14) in the function)
      const atr = s.atr ? s.atr.step(b.high, b.low, b.close) : NaN;

      // Candle trend (regular: StepTrend with mult; curved: stepTrend_cf with factor 1), length candlelen
      const candle = s.vars.candle;
      stepTrend(candle, b.close, r, curved ? 1 : cfg.mult, cfg.candleLen);
      const trendMedium = s.medium.step(candle.line);
      const trendLong = s.long.step(candle.line);
      const srcMa = s.srcMaStep.step(b.close, b.high, b.low);
      s.trendMedium[i] = trendMedium;
      s.trendLong[i] = trendLong;
      s.srcMa[i] = srcMa;
      const channel = s.vars.channel;
      if (curved) curvedChannelStep(channel, b.close, r, atr, cfg.baseStep, cfg.boost);
      else stepTrend(channel, b.close, r, cfg.mult, cfg.slope);
      const tLine = channel.line;
      const upper = channel.line + channel.buff;
      const lower = channel.line - channel.buff;
      s.tLine[i] = tLine;
      s.upper[i] = upper;
      s.lower[i] = lower;

      s.plot0[i] = { time: t, value: tLine, color: channel.dir === 1 ? cfg.upperColor : cfg.lowerColor };
      s.plot1[i] = { time: t, value: cfg.showArea ? upper : NaN };
      s.plot2[i] = { time: t, value: cfg.showArea ? lower : NaN };
      // f_candleColor(cDir, src_ma, TrendMedium_candle, TrendLong_candle, bull, bear)
      const p = i - 1;
      const pSrcMa = p >= 0 ? s.srcMa[p] : NaN;
      const pMedium = p >= 0 ? s.trendMedium[p] : NaN;
      const pLong = p >= 0 ? s.trendLong[p] : NaN;
      const cDir = candle.dir;
      const isBull = cDir === 1 && gt(srcMa, pSrcMa) && gt(trendMedium, pMedium) && gt(trendLong, pLong);
      const isBear = cDir === -1 && lt(srcMa, pSrcMa) && lt(trendMedium, pMedium) && lt(trendLong, pLong);
      const c = cfg.showCandleColor ? (isBull ? cfg.bullCandleColor : isBear ? cfg.bearCandleColor : neutral) : 'transparent';
      s.candles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, color: c, wickColor: c, borderColor: c };
    },
    result(s, bars) {
      const n = bars.length;
      const upperFill = cfg.showArea ? String(color.new(cfg.upperColor, 60)) : null;
      const lowerFill = cfg.showArea ? String(color.new(cfg.lowerColor, 60)) : null;
      const tLine = s.tLine.slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [
          // fill(plotUpper, plotMid, upper_final, tLine_final, showArea ? color.new(upper_col, 60) : na, na)
          { plot1: 'plot1', plot2: 'plot0', gradient: { topValue: s.upper.slice(), bottomValue: tLine,
            topColor: new Array(n).fill(upperFill), bottomColor: new Array(n).fill(null) } },
          // fill(plotLower, plotMid, lower_final, tLine_final, showArea ? color.new(lower_col, 60) : na, na)
          { plot1: 'plot2', plot2: 'plot0', gradient: { topValue: s.lower.slice(), bottomValue: tLine,
            topColor: new Array(n).fill(lowerFill), bottomColor: new Array(n).fill(null) } },
        ],
        // plotcandle(open, high, low, close, color / wickcolor / bordercolor = showCandleColor ? candleColor_final : na)
        plotCandles: { PlotCandle: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CurvedTrendChannelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CurvedTrendChannelsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CurvedTrendChannels = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
