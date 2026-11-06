/**
 * AutoFiboIndicators
 *
 * Auto Fibonacci Retracement Levels on various oscillator indicators.
 * Calculates Fibonacci retracement levels on a selectable indicator
 * (RSI/CCI/MFI/Stoch/CMO), auto-detecting highs/lows over a lookback period.
 *
 * Reference: "Auto Fibo on Indicators" by KivancOzbilgic
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSum, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface AutoFiboIndicatorsInputs {
  fiboLen: number;
  indLen: number;
  indicator: 'RSI' | 'CCI' | 'MFI' | 'STOCHASTIC' | 'CMO';
  showOBOS: boolean;
  overbought: number;
  oversold: number;
  midLine: number;
  adjFiboLevel: number;
  showAdjFibo: boolean;
  showFibo1618: boolean;
  showFibo2618: boolean;
  showFibo3618: boolean;
}

export const defaultInputs: AutoFiboIndicatorsInputs = {
  fiboLen: 144,
  indLen: 14,
  indicator: 'RSI',
  showOBOS: true,
  overbought: 70,
  oversold: 30,
  midLine: 50,
  adjFiboLevel: 1.272,
  showAdjFibo: false,
  showFibo1618: false,
  showFibo2618: false,
  showFibo3618: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'fiboLen', type: 'int', title: 'Auto Fibo Length', defval: 144, min: 1 },
  { id: 'indLen', type: 'int', title: 'Indicator Length', defval: 14, min: 1 },
  { id: 'indicator', type: 'string', title: 'Target Indicator', defval: 'RSI', options: ['RSI', 'CCI', 'MFI', 'STOCHASTIC', 'CMO'] },
  { id: 'showOBOS', type: 'bool', title: 'Show OB/OS Levels', defval: true },
  { id: 'overbought', type: 'int', title: 'Overbought Level', defval: 70 },
  { id: 'oversold', type: 'int', title: 'Oversold Level', defval: 30 },
  { id: 'midLine', type: 'int', title: 'Middle Line', defval: 50 },
  { id: 'adjFiboLevel', type: 'float', title: 'Adjustable Fibo Level', defval: 1.272, step: 0.001 },
  { id: 'showAdjFibo', type: 'bool', title: 'Show Adjustable Fibo Level', defval: false },
  { id: 'showFibo1618', type: 'bool', title: 'Show 1.618 Fibo Level', defval: false },
  { id: 'showFibo2618', type: 'bool', title: 'Show 2.618 Fibo Level', defval: false },
  { id: 'showFibo3618', type: 'bool', title: 'Show 3.618 Fibo Level', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'low', title: 'LOW', color: '#4B0082', lineWidth: 3 },
  { id: 'high', title: 'HIGH', color: '#4B0082', lineWidth: 3 },
  { id: 'f236', title: '0.236', color: '#000000', lineWidth: 1 },
  { id: 'f382', title: '0.382', color: '#0000FF', lineWidth: 1 },
  { id: 'f500', title: '0.5', color: '#060CBA', lineWidth: 2 },
  { id: 'f618', title: '0.618', color: '#0F8000', lineWidth: 3 },
  { id: 'f786', title: '0.786', color: '#000000', lineWidth: 1 },
  { id: 'f1272', title: '1.272', color: '#E252FF', lineWidth: 2 },
  { id: 'f1618', title: '1.618', color: '#E252FF', lineWidth: 2 },
  { id: 'f2618', title: '2.618', color: '#E252FF', lineWidth: 2 },
  { id: 'f3618', title: '3.618', color: '#E252FF', lineWidth: 2 },
  { id: 'ind', title: 'IND', color: '#C25757', lineWidth: 3 },
  { id: 'midLinePlot', title: 'Middle Line', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'Auto Fibo on Indicators',
  shortTitle: 'AutoFibo',
  overlay: false,
};

/**
 * `ta.highestbars(source, length)` / `ta.lowestbars` with a constant length, one bar at a time: the offset to the best
 * of the last `length` non-na values (the newest one on ties), the distance in bars; na before bar `length - 1` and
 * while there is no value (the doubles of the library function: -0 for the current bar).
 */
class ExtremeBarsStep implements Committable {
  private vals: number[] = [];
  private ids: number[] = [];
  private barOf: number[] = [];
  private head = 0;
  /** Non-na values committed */
  private kept = 0;
  private bars = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
  }

  /** `b` (newer) beats or ties `a` */
  private wins(a: number, b: number): boolean {
    return this.lowest ? !(a < b) : !(a > b);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const i = this.bars;
    const own = Number.isFinite(value);
    const total = this.kept + (own ? 1 : 0);
    if (i < this.len - 1 || total === 0) return NaN;
    const from = total - this.len;
    let h = this.head;
    while (h < this.ids.length && this.ids[h]! < from) h++;
    if (own && (h >= this.ids.length || this.wins(this.vals[h]!, value))) return -(i - i);
    return -(i - this.barOf[h]!);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const bar = this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    const id = this.kept++;
    while (this.vals.length > this.head && this.wins(this.vals[this.vals.length - 1]!, v)) {
      this.vals.pop();
      this.ids.pop();
      this.barOf.pop();
    }
    this.vals.push(v);
    this.ids.push(id);
    this.barOf.push(bar);
    while (this.ids[this.head]! < this.kept - this.len) this.head++;
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals = this.vals.slice(this.head);
      this.ids = this.ids.slice(this.head);
      this.barOf = this.barOf.slice(this.head);
      this.head = 0;
    }
  }
}

/** ta.cmo(close, len): math.sum of the up / down changes (the library definition) */
class CmoStep implements Committable {
  private readonly up: WindowSum;
  private readonly down: WindowSum;
  private prev = NaN;
  private last = NaN;

  constructor(length: number) {
    this.up = new WindowSum(length);
    this.down = new WindowSum(length);
  }

  step(value: number): number {
    this.last = value;
    const mom = value - this.prev;
    const sm1 = this.up.step(mom >= 0 ? mom : 0);
    const sm2 = this.down.step(mom >= 0 ? 0 : -mom);
    // a flat window is 0 / 0 = na
    return (100 * (sm1 - sm2)) / (sm1 + sm2);
  }

  commit(): void {
    this.up.commit();
    this.down.commit();
    this.prev = this.last;
  }
}

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { hlines?: any[]; fills?: any[] };

const PLOT_IDS = ['low', 'high', 'f236', 'f382', 'f500', 'f618', 'f786', 'f1272', 'f1618', 'f2618', 'f3618', 'ind', 'midLinePlot'] as const;

interface AutoFiboRun extends BarRunState<Record<string, never>> {
  ind: (b: Bar) => number;
  highest: WindowExtreme;
  lowest: WindowExtreme;
  hBars: ExtremeBarsStep;
  lBars: ExtremeBarsStep;
  plots: Point[][];
}

function study(inputs: Partial<AutoFiboIndicatorsInputs>): BarStudy<AutoFiboRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const steps: Committable[] = [];
      // Compute selected indicator
      let ind: AutoFiboRun['ind'] = () => NaN;
      if (cfg.indicator === 'RSI') {
        const m = taStep.rsi(cfg.indLen);
        steps.push(m);
        ind = (b) => m.step(b.close);
      } else if (cfg.indicator === 'CCI') {
        const m = taStep.cci(cfg.indLen);
        steps.push(m);
        ind = (b) => m.step(b.close);
      } else if (cfg.indicator === 'MFI') {
        const m = taStep.mfi(cfg.indLen);
        steps.push(m);
        ind = (b) => m.step((b.high + b.low + b.close) / 3, b.volume ?? 0);
      } else if (cfg.indicator === 'STOCHASTIC') {
        const m = taStep.stoch(cfg.indLen);
        steps.push(m);
        ind = (b) => m.step(b.close, b.high, b.low);
      } else if (cfg.indicator === 'CMO') {
        const m = new CmoStep(cfg.indLen);
        steps.push(m);
        ind = (b) => m.step(b.close);
      }
      // Highest/lowest of indicator over fiboLen; highestbars/lowestbars on price to determine fib direction
      const highest = new WindowExtreme(false, cfg.fiboLen);
      const lowest = new WindowExtreme(true, cfg.fiboLen);
      const hBars = new ExtremeBarsStep(false, cfg.fiboLen);
      const lBars = new ExtremeBarsStep(true, cfg.fiboLen);
      steps.push(highest, lowest, hBars, lBars);
      const plots = PLOT_IDS.map(() => [] as Point[]);
      return { ind, highest, lowest, hBars, lBars, plots, steps, vars: {}, lists: [], series: plots };
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time as number;
      const v = s.ind(b);
      // na before bar fiboLen - 1 and while the indicator has no value: the library rule of ta.highest / ta.lowest
      const h1 = s.highest.step(v);
      const l1 = s.lowest.step(v);
      const fark = h1 - l1;

      // Pine: hbars = -ta.highestbars(high, len), lbars = -ta.lowestbars(low, len)
      // highestbars returns negative offset, so negate to get positive bars-ago
      const hbars = -s.hBars.step(b.high);
      const lbars = -s.lBars.step(b.low);

      let f236: number, f382: number, f500: number, f618: number, f786: number;
      let f1272: number, f1618: number, f2618: number, f3618: number;
      // When high bar is more bars ago than low bar, fib goes up (hl*); otherwise goes down (lh*)
      if (hbars > lbars) {
        f236 = l1 + fark * 0.236;
        f382 = l1 + fark * 0.382;
        f500 = l1 + fark * 0.5;
        f618 = l1 + fark * 0.618;
        f786 = l1 + fark * 0.786;
        f1272 = l1 + fark * cfg.adjFiboLevel;
        f1618 = l1 + fark * 1.618;
        f2618 = l1 + fark * 2.618;
        f3618 = l1 + fark * 3.618;
      } else {
        f236 = h1 - fark * 0.236;
        f382 = h1 - fark * 0.382;
        f500 = h1 - fark * 0.5;
        f618 = h1 - fark * 0.618;
        f786 = h1 - fark * 0.786;
        f1272 = h1 - fark * cfg.adjFiboLevel;
        f1618 = h1 - fark * 1.618;
        f2618 = h1 - fark * 2.618;
        f3618 = h1 - fark * 3.618;
      }
      const p = s.plots;
      p[0][i] = { time, value: l1 };
      p[1][i] = { time, value: h1 };
      p[2][i] = { time, value: f236 };
      p[3][i] = { time, value: f382 };
      p[4][i] = { time, value: f500 };
      p[5][i] = { time, value: f618 };
      p[6][i] = { time, value: f786 };
      // conditional plots for extended fib levels
      p[7][i] = { time, value: cfg.showAdjFibo ? f1272 : NaN };
      p[8][i] = { time, value: cfg.showFibo1618 ? f1618 : NaN };
      p[9][i] = { time, value: cfg.showFibo2618 ? f2618 : NaN };
      p[10][i] = { time, value: cfg.showFibo3618 ? f3618 : NaN };
      p[11][i] = { time, value: v };
      // Pine: midLinePlot = plot(show ? na : 50, color = na, display = display.none)
      p[12][i] = { time, value: cfg.showOBOS ? NaN : 50 };
    },
    result(s, bars) {
      const plots: Record<string, Point[]> = {};
      PLOT_IDS.forEach((id, k) => { plots[id] = s.plots[k].slice(); });
      const result: Result = {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };

      // Pine (v5 colours), drawn only where midLinePlot is not na:
      //   fill(indPlot, midLinePlot, 100, 70, top_color = color.new(color.green, 0), bottom_color = color.new(color.green, 100))
      //   fill(indPlot, midLinePlot, 30, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
      const constant = <T>(v: T): T[] => new Array(bars.length).fill(v);
      result.fills = [
        {
          plot1: 'ind', plot2: 'midLinePlot', options: { title: 'Overbought Gradient Fill' },
          gradient: { topValue: constant(100), bottomValue: constant(70), topColor: constant('#4CAF50'), bottomColor: constant('#4CAF5000') },
        },
        {
          plot1: 'ind', plot2: 'midLinePlot', options: { title: 'Oversold Gradient Fill' },
          gradient: { topValue: constant(30), bottomValue: constant(0), topColor: constant('#FF525200'), bottomColor: constant('#FF5252') },
        },
      ];

      // OB/OS hlines and fill (only when showOBOS is false in Pine => "Do not Show" is unchecked)
      if (!cfg.showOBOS) {
        result.hlines = [
          { value: cfg.overbought, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Overbought Level' } },
          { value: cfg.midLine, options: { color: 'rgba(120,123,134,0.5)', linestyle: 'solid' as const, title: 'Middle Line' } },
          { value: cfg.oversold, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Oversold Level' } },
        ];
        result.fills.unshift({ plot1: 'hlineOB', plot2: 'hlineOS', options: { color: 'rgba(126,87,194,0.10)' } });
      }

      return result;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AutoFiboIndicatorsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AutoFiboIndicatorsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AutoFiboIndicators = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
