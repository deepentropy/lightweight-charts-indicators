/**
 * Market Pulse-X
 *
 * Three normalised components, each in 0..1: the stochastic momentum index (close relative to the midpoint of the
 * highest high / lowest low, smoothed twice; (smiK + 100) / 200), the stochastic of the RSI over the RSI period, and
 * the position of a smoothed close (signal line) in its range over the signal period. Their mean * 100 is the buy
 * dominance and 100 minus it the sell dominance; both are smoothed over 10 bars and drawn as the bull and bear lines
 * with a 50 level. Smoothing methods: EMA, HMA, zero-lag EMA (ZLA) or a two-pole super smoother (SSE).
 * Alerts (alertcondition, `alerts` of the result): bull line crossing over the bear line, bear over bull, bull line
 * crossing over / under 50.
 *
 * Reference: "Market Pulse-X" by Canhoto-Medium
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export type MarketPulseSmoothing = 'EMA' | 'HMA' | 'ZLA' | 'SSE';

export interface MarketPulseProInputs {
  smiLength: number;
  smiSmoothK: number;
  smiSmoothD: number;
  rsiPeriod: number;
  /** Smoothing length of the close (signal line) and length of its range */
  signalPeriod: number;
  /** Smoothing of the signal line */
  signalSmoothingMethod: MarketPulseSmoothing;
  /** Smoothing of the SMI and of the dominance lines */
  normalSmoothingMethod: MarketPulseSmoothing;
  /** Line width (the plot width of the port stays at the default 4) */
  lineWidth: number;
}

export const defaultInputs: MarketPulseProInputs = {
  smiLength: 21,
  smiSmoothK: 5,
  smiSmoothD: 5,
  rsiPeriod: 14,
  signalPeriod: 20,
  signalSmoothingMethod: 'HMA',
  normalSmoothingMethod: 'HMA',
  lineWidth: 4,
};

export const inputConfig: InputConfig[] = [
  { id: 'smiLength', type: 'int', title: 'SMI Period', defval: 21 },
  { id: 'smiSmoothK', type: 'int', title: 'SMI Smooth K', defval: 5 },
  { id: 'smiSmoothD', type: 'int', title: 'SMI Smooth D', defval: 5 },
  { id: 'rsiPeriod', type: 'int', title: 'RSI Period', defval: 14 },
  { id: 'signalPeriod', type: 'int', title: 'Signal Period', defval: 20 },
  { id: 'signalSmoothingMethod', type: 'string', title: 'Signal Line Smoothing', defval: 'HMA', options: ['EMA', 'HMA', 'ZLA', 'SSE'] },
  { id: 'normalSmoothingMethod', type: 'string', title: 'SMI-RSI Smoothing', defval: 'HMA', options: ['EMA', 'HMA', 'ZLA', 'SSE'] },
  { id: 'lineWidth', type: 'int', title: 'Line Width', defval: 4, min: 1, max: 4 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bull Herd', color: color.lime, lineWidth: 4 },
  { id: 'plot1', title: 'Bear Winter', color: color.fuchsia, lineWidth: 4 },
];

export const metadata = {
  title: 'Market Pulse-X',
  shortTitle: 'Pulse-X',
  overlay: false,
};

/** Pine a == b: within 1e-10 (false with na) */
const eq = (a: number, b: number) => Math.abs(a - b) <= 1e-10;

/** f_smooth(src, length, method), one bar at a time: one call site per use (each keeps its own history) */
class Smoother implements Committable {
  private readonly ma: { step(v: number): number; commit(): void } | null;
  private readonly lag: number;
  /** The source and the SSE values by bar */
  private readonly src: number[] = [];
  private readonly ss: number[] = [];
  private readonly c1: number;
  private readonly c2: number;
  private readonly c3: number;

  constructor(length: number, private readonly method: MarketPulseSmoothing) {
    this.ma = method === 'HMA' ? taStep.hma(length) : method === 'SSE' ? null : taStep.ema(length);
    // lag = math.floor((length - 1) / 2)
    this.lag = Math.floor((length - 1) / 2);
    const a1 = Math.exp((-1.414 * Math.PI) / length);
    const b1 = 2 * a1 * Math.cos((1.414 * Math.PI) / length);
    this.c2 = b1;
    this.c3 = -a1 * a1;
    this.c1 = 1 - this.c2 - this.c3;
  }

  step(i: number, v: number): number {
    switch (this.method) {
      case 'HMA':
        return this.ma!.step(v);
      case 'ZLA': {
        // ta.ema(src + (src - src[lag]), length)
        this.src[i] = v;
        const lag = this.lag;
        return this.ma!.step(i - lag >= 0 ? v + (v - this.src[i - lag]!) : NaN);
      }
      case 'SSE': {
        const nz = (x: number) => (Number.isFinite(x) ? x : 0);
        // ss := c1 * (src + nz(src[1])) / 2 + c2 * nz(ss[1]) + c3 * nz(ss[2])
        this.src[i] = v;
        const src1 = i >= 1 ? this.src[i - 1]! : NaN;
        const ss1 = i >= 1 ? this.ss[i - 1]! : NaN;
        const ss2 = i >= 2 ? this.ss[i - 2]! : NaN;
        const r = (this.c1 * (v + nz(src1))) / 2 + this.c2 * nz(ss1) + this.c3 * nz(ss2);
        this.ss[i] = r;
        return r;
      }
      default:
        return this.ma!.step(v);
    }
  }

  commit(): void {
    this.ma?.commit();
  }
}

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface PulseRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  smiK: Smoother;
  rsi: ReturnType<typeof taStep.rsi>;
  rsiHi: WindowExtreme;
  rsiLo: WindowExtreme;
  signal: Smoother;
  sigHi: WindowExtreme;
  sigLo: WindowExtreme;
  smoothBuy: Smoother;
  smoothSell: Smoother;
  buyLine: number[];
  sellLine: number[];
  plot0: Point[];
  plot1: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MarketPulseProInputs>): BarStudy<PulseRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: PulseRun = {
        hh: new WindowExtreme(false, cfg.smiLength),
        ll: new WindowExtreme(true, cfg.smiLength),
        smiK: new Smoother(cfg.smiSmoothK, cfg.normalSmoothingMethod),
        rsi: taStep.rsi(cfg.rsiPeriod),
        rsiHi: new WindowExtreme(false, cfg.rsiPeriod),
        rsiLo: new WindowExtreme(true, cfg.rsiPeriod),
        signal: new Smoother(cfg.signalPeriod, cfg.signalSmoothingMethod),
        sigHi: new WindowExtreme(false, cfg.signalPeriod),
        sigLo: new WindowExtreme(true, cfg.signalPeriod),
        smoothBuy: new Smoother(10, cfg.normalSmoothingMethod),
        smoothSell: new Smoother(10, cfg.normalSmoothingMethod),
        buyLine: [], sellLine: [], plot0: [], plot1: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.hh, s.ll, s.smiK, s.rsi, s.rsiHi, s.rsiLo, s.signal, s.sigHi, s.sigLo, s.smoothBuy, s.smoothSell];
      s.lists = s.times;
      s.series = [s.buyLine, s.sellLine, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      // SMI
      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      const midpoint = (hh + ll) / 2;
      const rangel = hh - ll;
      const smiInput = ((b.close - midpoint) / (eq(rangel, 0) ? 1 : rangel / 2)) * 100;
      const smiK = s.smiK.step(i, smiInput);
      // smiD = f_smooth(smiK, smiSmoothD, ...) is not used by any output of the Pine script (input kept)

      // Stoch RSI
      const rsi = s.rsi.step(b.close);
      const rsiHi = s.rsiHi.step(rsi);
      const rsiLo = s.rsiLo.step(rsi);
      const r = rsiHi - rsiLo;
      const stochRSI = ((rsi - rsiLo) / (eq(r, 0) ? 1 : r)) * 100;

      // Signal line
      const signal = s.signal.step(i, b.close);
      const sigHi = s.sigHi.step(signal);
      const sigLo = s.sigLo.step(signal);

      const normSmiK = (smiK + 100) / 200;
      const normStochRSI = stochRSI / 100;
      const sigRange = sigHi - sigLo;
      const normSignal = (signal - sigLo) / (eq(sigRange, 0) ? 1 : sigRange);
      const buyDominance = ((normSmiK + normStochRSI + normSignal) / 3) * 100;
      const sellDominance = 100 - buyDominance;
      const buy = fin(s.smoothBuy.step(i, buyDominance));
      const sell = fin(s.smoothSell.step(i, sellDominance));
      s.buyLine[i] = buy;
      s.sellLine[i] = sell;
      s.plot0[i] = { time: b.time, value: buy, color: color.lime };
      s.plot1[i] = { time: b.time, value: sell, color: color.fuchsia };
      // bullCrossOverBear, bearCrossOverBull, buyCross50Up, buyCross50Down
      const pb = i > 0 ? s.buyLine[i - 1]! : NaN;
      const ps = i > 0 ? s.sellLine[i - 1]! : NaN;
      const f0 = buy > sell && pb <= ps;
      const f1 = sell > buy && ps <= pb;
      const f2 = buy > 50 && pb <= 50;
      const f3 = buy < 50 && pb >= 50;
      s.flags[0]![i] = f0;
      s.flags[1]![i] = f1;
      s.flags[2]![i] = f2;
      s.flags[3]![i] = f3;
      if (f0) s.times[0]!.push(b.time as number);
      if (f1) s.times[1]!.push(b.time as number);
      if (f2) s.times[2]!.push(b.time as number);
      if (f3) s.times[3]!.push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [{ value: 50, options: { title: '50%', color: color.gray, linestyle: 'dashed' } }],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketPulseProInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MarketPulseProInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bull 🟢 crossed X 🡅 Bear 🔴', message: 'Pulse-X: Bull 🟢 crossed above Bear 🔴' },
  { id: 'alert1', title: 'Bear 🟠 crossed X 🡅 Bull 🔵', message: 'Pulse-X: Bear 🟠 crossed above Bull 🔵' },
  { id: 'alert2', title: 'Bull Line rose 🡅 level 50', message: 'Pulse-X: Bull Line rose 🡅 level 50' },
  { id: 'alert3', title: 'Bear Line fell 🡇 level 50', message: 'Pulse-X: Bear Line fell 🡇 level 50' },
];

export const MarketPulsePro = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
