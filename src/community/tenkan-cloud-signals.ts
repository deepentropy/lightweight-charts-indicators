/**
 * [codapro] Tenkan Cloud Signals
 *
 * Ichimoku-style lines from Donchian midpoints: Tenkan (midpoint of the highest high and lowest low over the Tenkan
 * length), Kijun (same over the Kijun length), Senkou Span A = (Tenkan + Kijun) / 2 and Senkou Span B (midpoint over
 * the Span B length). Both spans are drawn `displace` bars forward with a green / red cloud fill (Span A at or above
 * Span B: bull). BUY / SELL flags mark a cross of the Kijun over / under the Span B value plotted on the current bar
 * (Span B of `displace` bars ago) that holds for `confirmBars` bars.
 *
 * Reference: "[codapro] Tenkan Cloud Signals" by CodaPro
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © ArisCodes
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TenkanCloudSignalsInputs {
  /** Tenkan length */
  tenkanLen: number;
  /** Kijun length */
  kijunLen: number;
  /** Senkou Span B length */
  spanBLen: number;
  /** Forward displacement of the cloud (bars) */
  displace: number;
  showTenkan: boolean;
  showKijun: boolean;
  showCloud: boolean;
  tenkanCol: string;
  kijunCol: string;
  spanACol: string;
  spanBCol: string;
  bullFill: string;
  bearFill: string;
  /** Show the BUY / SELL flags */
  showSignals: boolean;
  /** Number of closes the Kijun must stay above / below Span B (1..10) */
  confirmBars: number;
}

const BULL_FILL = String(color.new(color.green, 85));
const BEAR_FILL = String(color.new(color.red, 85));

export const defaultInputs: TenkanCloudSignalsInputs = {
  tenkanLen: 7,
  kijunLen: 22,
  spanBLen: 44,
  displace: 22,
  showTenkan: true,
  showKijun: false,
  showCloud: true,
  tenkanCol: color.teal,
  kijunCol: color.orange,
  spanACol: color.green,
  spanBCol: color.red,
  bullFill: BULL_FILL,
  bearFill: BEAR_FILL,
  showSignals: true,
  confirmBars: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'tenkanLen', type: 'int', title: 'Tenkan Length', defval: 7, min: 1, group: 'Ichimoku Parameters' },
  { id: 'kijunLen', type: 'int', title: 'Kijun Length (calculated)', defval: 22, min: 1, group: 'Ichimoku Parameters' },
  { id: 'spanBLen', type: 'int', title: 'Senkou Span B Length', defval: 44, min: 1, group: 'Ichimoku Parameters' },
  { id: 'displace', type: 'int', title: 'Cloud Forward Displacement', defval: 22, min: 0, group: 'Ichimoku Parameters' },
  { id: 'showTenkan', type: 'bool', title: 'Plot Tenkan Line', defval: true, group: 'Visuals' },
  { id: 'showKijun', type: 'bool', title: 'Plot Kijun Line (optional)', defval: false, group: 'Visuals' },
  { id: 'showCloud', type: 'bool', title: 'Show Cloud Fill', defval: true, group: 'Visuals' },
  { id: 'tenkanCol', type: 'color', title: 'Tenkan Color', defval: color.teal, group: 'Visuals' },
  { id: 'kijunCol', type: 'color', title: 'Kijun Color', defval: color.orange, group: 'Visuals' },
  { id: 'spanACol', type: 'color', title: 'Span A Color', defval: color.green, group: 'Visuals' },
  { id: 'spanBCol', type: 'color', title: 'Span B Color', defval: color.red, group: 'Visuals' },
  { id: 'bullFill', type: 'color', title: 'Bull Cloud Fill', defval: BULL_FILL, group: 'Visuals' },
  { id: 'bearFill', type: 'color', title: 'Bear Cloud Fill', defval: BEAR_FILL, group: 'Visuals' },
  { id: 'showSignals', type: 'bool', title: 'Show Buy/Sell Flags', defval: true, group: 'Signals' },
  { id: 'confirmBars', type: 'int', title: 'Confirmation Bars (close)', defval: 1, min: 1, max: 10, group: 'Signals' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan', color: color.teal, lineWidth: 2 },
  { id: 'plot1', title: 'Kijun (calc)', color: color.orange, lineWidth: 2 },
  { id: 'plot2', title: 'Senkou Span A', color: color.green, lineWidth: 1 },
  { id: 'plot3', title: 'Senkou Span B', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: '[codapro] Tenkan Cloud Signals',
  shortTitle: '[codapro] Tenkan Cloud Signals',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

/**
 * One Pine ta.highest / ta.lowest call site that only runs on some bars (right side of a lazy `and`); rule of
 * batch 5 (adaptive-ml-trailing-stop): the source history is a ring of len + 1 slots indexed by bar, written only
 * on the bars where the call runs (a slot never written is skipped); the extreme is kept with its bar and replaced
 * by a value that passes it; the window of the last len bars is scanned again when the extreme is len bars old (the
 * oldest bar wins a tie); an na source resets the extreme and returns na; na before bar len - 1. Stepped on a bar,
 * kept when the bar is committed (live runs).
 */
class PineExtreme {
  private readonly ring: number;
  private readonly slot: number[];
  private ext = NaN;
  private extBar = -1;
  private stepped = false;
  private pBar = 0;
  private pX = NaN;
  private pExt = NaN;
  private pExtBar = -1;

  constructor(private readonly len: number, private readonly isLow: boolean) {
    this.ring = len + 1;
    this.slot = new Array(this.ring).fill(NaN);
  }

  step(bar: number, x: number): number {
    const { len, isLow, ring, slot } = this;
    this.stepped = true;
    this.pBar = bar;
    this.pX = x;
    let ext = this.ext;
    let extBar = this.extBar;
    if (isNaN(x)) {
      this.pExt = NaN;
      this.pExtBar = extBar;
      return NaN;
    }
    if (isNaN(ext) || bar - extBar >= len) {
      ext = NaN;
      for (let k = 0; k < len && bar - k >= 0; k++) {
        const v = k === 0 ? x : slot[(bar - k) % ring];
        if (!isNaN(v) && (isNaN(ext) || (isLow ? v <= ext : v >= ext))) {
          ext = v;
          extBar = bar - k;
        }
      }
    } else if (isLow ? x < ext : x > ext) {
      ext = x;
      extBar = bar;
    }
    this.pExt = ext;
    this.pExtBar = extBar;
    return bar < len - 1 ? NaN : ext;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.slot[this.pBar % this.ring] = this.pX;
    this.ext = this.pExt;
    this.extBar = this.pExtBar;
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface TenkanVars {
  /** ta.crossover / ta.crossunder compare with the last bar where both values were not na */
  prevK: number;
  prevB: number;
}

interface TenkanRun extends BarRunState<TenkanVars> {
  mids: { hh: WindowExtreme; ll: WindowExtreme }[];
  lowest: PineExtreme;
  highest: PineExtreme;
  spanA: number[];
  spanB: number[];
  crossUp: boolean[];
  crossDown: boolean[];
  plot0: Point[];
  plot1: Point[];
  cloud: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<TenkanCloudSignalsInputs>): BarStudy<TenkanRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const k = cfg.displace;
  const c = cfg.confirmBars;
  return {
    init() {
      // donchianMid(len) = (ta.highest(high, len) + ta.lowest(low, len)) / 2: Tenkan, Kijun, Span B
      const mids = [cfg.tenkanLen, cfg.kijunLen, cfg.spanBLen].map((len) => ({
        hh: new WindowExtreme(false, len), ll: new WindowExtreme(true, len),
      }));
      // Signals
      const lowest = new PineExtreme(c, true);
      const highest = new PineExtreme(c, false);
      const s: TenkanRun = {
        mids, lowest, highest, spanA: [], spanB: [], crossUp: [], crossDown: [], plot0: [], plot1: [], cloud: [],
        markers: [],
        steps: [...mids.flatMap((m) => [m.hh, m.ll]), lowest, highest], vars: { prevK: NaN, prevB: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.spanA, s.spanB, s.crossUp, s.crossDown, s.plot0, s.plot1, s.cloud];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const mid = (m: TenkanRun['mids'][number]) => (m.hh.step(b.high) + m.ll.step(b.low)) / 2.0;
      const tenkan = mid(s.mids[0]);
      const kj = mid(s.mids[1]);
      const spanB = mid(s.mids[2]);
      const spanA = (tenkan + kj) / 2.0;
      s.spanA[i] = spanA;
      s.spanB[i] = spanB;
      // spanB_asPlottedNow = displace > 0 ? spanB_now[displace] : spanB_now
      const sb = k > 0 ? (i - k >= 0 ? s.spanB[i - k] : NaN) : spanB;

      const both = !isNaN(kj) && !isNaN(sb);
      // compared exactly (no 1e-10 tolerance; na compares false)
      s.crossUp[i] = both && kj > sb && v.prevK <= v.prevB;
      s.crossDown[i] = both && kj < sb && v.prevK >= v.prevB;
      if (both) {
        v.prevK = kj;
        v.prevB = sb;
      }
      const aboveNow = gt(kj, sb);
      const belowNow = lt(kj, sb);
      // aboveConfirmed = confirmBars == 1 ? aboveNow : (aboveNow and ta.lowest(kijun - spanB_asPlottedNow, confirmBars) > 0)
      // the lazy `and` runs ta.lowest / ta.highest only on the bars where aboveNow / belowNow is true
      const aboveConfirmed = c === 1 ? aboveNow : aboveNow && gt(s.lowest.step(i, kj - sb), 0);
      const belowConfirmed = c === 1 ? belowNow : belowNow && lt(s.highest.step(i, kj - sb), 0);
      // buySignal = showSignals and crossUp[confirmBars - 1] and aboveConfirmed
      const j = i - (c - 1);
      const buySignal = cfg.showSignals && j >= 0 && s.crossUp[j] && aboveConfirmed;
      const sellSignal = cfg.showSignals && j >= 0 && s.crossDown[j] && belowConfirmed;
      const t = b.time;
      if (buySignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'flag', color: String(color.new(color.lime, 0)), text: 'BUY',
          textColor: color.black, size: 'small' });
      }
      if (sellSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'flag', color: String(color.new(color.red, 0)), text: 'SELL',
          textColor: color.white, size: 'small' });
      }
      s.plot0[i] = { time: t, value: cfg.showTenkan ? tenkan : NaN, color: cfg.tenkanCol };
      s.plot1[i] = { time: t, value: cfg.showKijun ? kj : NaN, color: cfg.kijunCol };
      // cloudBull = spanA_now >= spanB_now; fill colour of bar i goes with the plot points of bar i
      s.cloud[i] = cfg.showCloud ? (ge(spanA, spanB) ? cfg.bullFill : cfg.bearFill) : 'transparent';
    },
    result(s, bars) {
      // plot(..., offset = displace): the value of bar i is drawn on bar i + displace (future bars with barTime,
      // from the last bar: built from the per-bar values on each update)
      const interval = barInterval(bars);
      const shifted = (vals: number[], col: string) => bars.map((_b, i) => ({
        time: barTime(bars, i + k, interval), value: vals[i], color: col,
      }));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
          plot2: shifted(s.spanA, cfg.spanACol),
          plot3: shifted(s.spanB, cfg.spanBCol),
        },
        fills: [{ plot1: 'plot2', plot2: 'plot3', options: { title: 'Cloud Fill' }, colors: s.cloud.slice() }],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TenkanCloudSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TenkanCloudSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const TenkanCloudSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
