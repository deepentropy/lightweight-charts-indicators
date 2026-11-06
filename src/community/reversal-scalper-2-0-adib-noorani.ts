/**
 * Reversal Scalper 2.0
 *
 * Oscillator: the SMA (`kSmoothing`) of the stochastic of the close (`kLength`), with lines at 80 (supply zone) and
 * 20 (demand zone) and a fill between them. Trend ribbon (HalfTrend logic): the trend turns down when the SMA of the
 * high over `amp` bars is below the highest recent low and the close is below the previous low, and up in the mirror
 * case; the baseline follows the highest low (up trend) or the lowest high (down trend), and the bands are the
 * baseline +- `devFactor` times half the ATR(100). The bands and the baseline are hidden plots on the price pane with
 * the ribbon fills between them; bars closing below the low band are black, above the high band white.
 *
 * Reference: "Reversal Scalper 2.0- Adib Noorani" by AdibNoorani
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface ReversalScalper20AdibNooraniInputs {
  /** Stochastic K length */
  kLength: number;
  /** SMA length of the stochastic */
  kSmoothing: number;
  /** Colour of the reversal strength meter */
  revStrengthColor: string;
  /** Amplitude (bars of the highest / lowest and of the SMAs) */
  amp: number;
  /** ATR deviation factor of the bands */
  devFactor: number;
  /** Buy ribbon colour */
  buyCol: string;
  /** Sell ribbon colour */
  sellCol: string;
}

// Input colour defaults: color.rgb(r, g, b, t) is stored with alpha (100 - t) / 100
export const defaultInputs: ReversalScalper20AdibNooraniInputs = {
  kLength: 8,
  kSmoothing: 5,
  revStrengthColor: 'rgba(17, 14, 209, 0.96)',
  amp: 3,
  devFactor: 3.0,
  buyCol: 'rgba(76, 175, 80, 0.15)',
  sellCol: 'rgba(255, 82, 82, 0.15)',
};

export const inputConfig: InputConfig[] = [
  { id: 'kLength', type: 'int', title: 'Stochastic K Length', defval: 8, group: 'Oscillator Settings' },
  { id: 'kSmoothing', type: 'int', title: 'Stochastic Smoothing SMA', defval: 5, group: 'Oscillator Settings' },
  { id: 'revStrengthColor', type: 'color', title: 'Reversal Strength Meter Color', defval: 'rgba(17, 14, 209, 0.96)', group: 'Visual Settings' },
  { id: 'amp', type: 'int', title: 'Amplitude (Highest/Lowest Bars)', defval: 3, group: 'Trend Ribbon Settings' },
  { id: 'devFactor', type: 'float', title: 'ATR Deviation Factor', defval: 3.0, group: 'Trend Ribbon Settings' },
  { id: 'buyCol', type: 'color', title: 'Buy Ribbon Color', defval: 'rgba(76, 175, 80, 0.15)', group: 'Visual Settings' },
  { id: 'sellCol', type: 'color', title: 'Sell Ribbon Color', defval: 'rgba(255, 82, 82, 0.15)', group: 'Visual Settings' },
];

/** Pine default plot colour */
const DEFAULT_PLOT_COL = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Reversal Strength Meter', color: 'rgba(17, 14, 209, 0.96)', lineWidth: 2 },
  { id: 'plot1', title: 'Potential Supply Zone', color: color.black, lineWidth: 2 },
  { id: 'plot2', title: 'Potential Demand Zone', color: color.black, lineWidth: 2 },
  { id: 'plot3', title: 'High Band (Internal)', color: 'rgba(255, 82, 82, 0.15)', lineWidth: 1, style: 'circles', display: 'none', forceOverlay: true },
  { id: 'plot4', title: 'Low Band (Internal)', color: 'rgba(76, 175, 80, 0.15)', lineWidth: 1, style: 'circles', display: 'none', forceOverlay: true },
  { id: 'plot5', title: 'Center Baseline (Internal)', color: DEFAULT_PLOT_COL, lineWidth: 1, display: 'none', forceOverlay: true },
];

export const metadata = {
  title: 'Reversal Scalper 2.0- Adib Noorani',
  shortTitle: 'RevScalper',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));

/**
 * The bar of `ta.highestbars(source, length)` / `ta.lowestbars` with a constant length, one bar at a time: the best of
 * the last `length` non-na values (+/-Infinity skipped), the newest one on equal values; -1 (na) before bar
 * `length - 1` and while no value was received (the rules of the library function).
 */
class ExtremeBarStep implements Committable {
  private vals: number[] = [];
  private bars: number[] = [];
  private ids: number[] = [];
  private head = 0;
  /** Non-na values committed */
  private kept = 0;
  private pendingValue = NaN;
  private pendingBar = -1;
  private readonly len: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
  }

  /** `a` is the extreme over the newer `b`: strictly better (the newest of equal values wins) */
  private better(a: number, b: number): boolean {
    return this.lowest ? a < b : a > b;
  }

  step(bar: number, value: number): number {
    const own = Number.isFinite(value);
    this.pendingValue = value;
    this.pendingBar = own ? bar : -1;
    const total = this.kept + (own ? 1 : 0);
    if (bar < this.len - 1 || total === 0) return -1;
    const first = total - this.len;
    let h = this.head;
    while (h < this.ids.length && this.ids[h]! < first) h++;
    if (h < this.ids.length && (!own || this.better(this.vals[h]!, value))) return this.bars[h]!;
    return own ? bar : -1;
  }

  commit(): void {
    if (this.pendingBar < 0) return;
    const v = this.pendingValue;
    const id = this.kept++;
    while (this.vals.length > this.head && !this.better(this.vals[this.vals.length - 1]!, v)) {
      this.vals.pop();
      this.bars.pop();
      this.ids.pop();
    }
    this.vals.push(v);
    this.bars.push(this.pendingBar);
    this.ids.push(id);
    this.pendingBar = -1;
    // the values out of the window of the next bars
    while (this.head < this.ids.length && this.ids[this.head]! < this.kept - this.len) this.head++;
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals = this.vals.slice(this.head);
      this.bars = this.bars.slice(this.head);
      this.ids = this.ids.slice(this.head);
      this.head = 0;
    }
  }
}

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface ReversalVars {
  /** var int t = 0; var int nt = 0 */
  t: number;
  nt: number;
  /** var float maxLow = na(low[1]) ? low : low[1]; var float minHigh = na(high[1]) ? high : high[1] (bar 0: low / high) */
  maxLow: number;
  minHigh: number;
  /** var float u = 0.0; var float d = 0.0 */
  u: number;
  d: number;
  /** ta.stoch: the last non-na result */
  stoch: number;
}

interface ReversalRun extends BarRunState<ReversalVars> {
  lo: WindowExtreme;
  hi: WindowExtreme;
  kSma: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  hb: ExtremeBarStep;
  lb: ExtremeBarStep;
  hAvg: WindowSma;
  lAvg: WindowSma;
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<ReversalScalper20AdibNooraniInputs>): BarStudy<ReversalRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const colors = [cfg.revStrengthColor, color.black, color.black, cfg.sellCol, cfg.buyCol, DEFAULT_PLOT_COL];
  return {
    init() {
      // the length checks of ta.stoch, ta.highestbars and ta.lowestbars
      taStep.stoch(cfg.kLength);
      taCore.highestbars([], cfg.amp);
      taCore.lowestbars([], cfg.amp);
      const lo = new WindowExtreme(true, cfg.kLength);
      const hi = new WindowExtreme(false, cfg.kLength);
      const kSma = new WindowSma(cfg.kSmoothing);
      const atr = taStep.atr(100);
      const hb = new ExtremeBarStep(false, cfg.amp);
      const lb = new ExtremeBarStep(true, cfg.amp);
      const hAvg = new WindowSma(cfg.amp);
      const lAvg = new WindowSma(cfg.amp);
      const s: ReversalRun = {
        lo, hi, kSma, atr, hb, lb, hAvg, lAvg, plots: colors.map(() => []), barColors: [],
        steps: [lo, hi, kSma, atr, hb, lb, hAvg, lAvg],
        vars: { t: 0, nt: 0, maxLow: NaN, minHigh: NaN, u: 0.0, d: 0.0, stoch: NaN },
        lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // reversalStrength = ta.sma(ta.stoch(close, high, low, kLength), kSmoothing) (an na stoch keeps the previous one)
      const sl = s.lo.step(b.low);
      const st = (100 * (b.close - sl)) / (s.hi.step(b.high) - sl);
      if (!Number.isNaN(st)) v.stoch = st;
      const reversalStrength = s.kSma.step(v.stoch);

      // Trend ribbon
      const halfATR = s.atr.step(b.high, b.low, b.close) / 2;
      const hBar = s.hb.step(i, b.high);
      const lBar = s.lb.step(i, b.low);
      const hAvg = s.hAvg.step(b.high);
      const lAvg = s.lAvg.step(b.low);
      if (i === 0) {
        v.maxLow = b.low;
        v.minHigh = b.high;
      }
      const dev = cfg.devFactor * halfATR;
      // high[math.abs(ta.highestbars(amp))]: a history offset of na reads the current bar
      const hPrice = bars[hBar < 0 ? i : hBar].high;
      const lPrice = bars[lBar < 0 ? i : lBar].low;
      const prevLow = i > 0 ? bars[i - 1].low : NaN;
      const prevHigh = i > 0 ? bars[i - 1].high : NaN;
      // t[1], u[1], d[1]: the values of the previous bar (na on bar 0)
      const tPrev = i > 0 ? v.t : NaN;
      const uPrev = i > 0 ? v.u : NaN;
      const dPrev = i > 0 ? v.d : NaN;

      if (v.nt === 1) {
        v.maxLow = max(lPrice, v.maxLow);
        if (lt(hAvg, v.maxLow) && lt(b.close, prevLow)) {
          v.t = 1;
          v.nt = 0;
          v.minHigh = hPrice;
        }
      } else {
        v.minHigh = min(hPrice, v.minHigh);
        if (gt(lAvg, v.minHigh) && gt(b.close, prevHigh)) {
          v.t = 0;
          v.nt = 1;
          v.maxLow = lPrice;
        }
      }

      let hi: number;
      let lo: number;
      if (v.t === 0) {
        v.u = !isNaN(tPrev) && tPrev !== 0 ? (isNaN(dPrev) ? v.d : dPrev) : isNaN(uPrev) ? v.maxLow : max(v.maxLow, uPrev);
        hi = v.u + dev;
        lo = v.u - dev;
      } else {
        v.d = !isNaN(tPrev) && tPrev !== 1 ? (isNaN(uPrev) ? v.u : uPrev) : isNaN(dPrev) ? v.minHigh : min(v.minHigh, dPrev);
        hi = v.d + dev;
        lo = v.d - dev;
      }
      const center = v.t === 0 ? v.u : v.d;

      // barcolor(close < loBand ? color.black : close > hiBand ? color.white : na)
      if (lt(b.close, lo)) s.barColors.push({ time: b.time, color: color.black });
      else if (gt(b.close, hi)) s.barColors.push({ time: b.time, color: color.white });

      const time = b.time;
      s.plots[0][i] = { time, value: reversalStrength, color: colors[0] };
      s.plots[1][i] = { time, value: 80, color: colors[1] };
      s.plots[2][i] = { time, value: 20, color: colors[2] };
      s.plots[3][i] = { time, value: hi, color: colors[3] };
      s.plots[4][i] = { time, value: lo, color: colors[4] };
      s.plots[5][i] = { time, value: center, color: colors[5] };
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
          plot5: s.plots[5].slice(),
        },
        fills: [
          // fill(supplyZone, demandZone, color = color.new(#0fc5dd, 90), title = 'Zone Fill')
          { plot1: 'plot1', plot2: 'plot2', options: { color: String(color.new('#0fc5dd', 90)), title: 'Zone Fill' } },
          // fill(centerPlot, hiBandPlot, title = 'High Ribbon Fill', color = sellCol)
          { plot1: 'plot5', plot2: 'plot3', options: { color: cfg.sellCol, title: 'High Ribbon Fill' }, colors: bars.map(() => cfg.sellCol) },
          // fill(centerPlot, loBandPlot, title = 'Low Ribbon Fill', color = buyCol)
          { plot1: 'plot5', plot2: 'plot4', options: { color: cfg.buyCol, title: 'Low Ribbon Fill' }, colors: bars.map(() => cfg.buyCol) },
        ],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ReversalScalper20AdibNooraniInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<ReversalScalper20AdibNooraniInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ReversalScalper20AdibNoorani = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
