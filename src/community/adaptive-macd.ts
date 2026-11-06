/**
 * Adaptive MACD [LuxAlgo]
 *
 * R-squared correlation-based adaptive MACD.
 * The MACD line adapts its speed based on the Pearson correlation between
 * price and bar index (R²). When price is trending (high R²), MACD behaves
 * like standard MACD. When choppy (low R²), the adaptive factor K changes
 * the lag characteristics.
 *
 * Formula:
 *   a1 = 2/(fast+1), a2 = 2/(slow+1)
 *   r2 = 0.5 * correlation(close, bar_index, length)^2 + 0.5
 *   K = r2 * (1-a1)(1-a2) + (1-r2) * (1-a1)/(1-a2)
 *   macd[i] = (close - close[1]) * (a1-a2) + (2-a1-a2) * macd[1] - K * macd[2]
 *   signal = EMA(macd, signalLen)
 *   histogram = macd - signal
 *
 * Reference: "Adaptive MACD [LuxAlgo]"
 */

import { taCore, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSum, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface AdaptiveMACDInputs {
  r2Period: number;
  fast: number;
  slow: number;
  signal: number;
}

export const defaultInputs: AdaptiveMACDInputs = {
  r2Period: 20,
  fast: 10,
  slow: 20,
  signal: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'r2Period', type: 'int', title: 'R² Period', defval: 20, min: 2 },
  { id: 'fast', type: 'int', title: 'Fast Length', defval: 10, min: 2 },
  { id: 'slow', type: 'int', title: 'Slow Length', defval: 20, min: 2 },
  { id: 'signal', type: 'int', title: 'Signal Length', defval: 9, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: '#5b9cf6', lineWidth: 4, style: 'histogram' },
  { id: 'plot1', title: 'MACD', color: '#787B86', lineWidth: 2 },
  { id: 'plot2', title: 'Signal', color: '#ff5d00', lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive MACD',
  shortTitle: 'AdpMACD',
  overlay: false,
};

/**
 * `ta.correlation(close, bar_index, length)` with a constant length from exact window sums ({@link WindowSum}):
 * sma(x * i) - sma(x) * sma(i) over sqrt(var(x) * var(i)) (biased), the operations of taStep.correlation (the same
 * doubles); the sum of a value serves its mean and its variance. The window sums of the bar indexes and of their
 * squares are integers: added exactly while they are below 2^53 (so equal to the correctly rounded sums), else
 * from window sums filled with the indexes of the window.
 */
class BarIndexCorrelationStep {
  private readonly sumXY: WindowSum;
  private readonly sumX: WindowSum;
  private readonly sqX: WindowSum;
  private sumI: WindowSum | null = null;
  private sqI: WindowSum | null = null;
  private readonly len: number;

  constructor(length: number) {
    // the length check of ta.correlation (the same runtime error)
    taCore.correlation([], [], length);
    this.len = Math.floor(length);
    this.sumXY = new WindowSum(length);
    this.sumX = new WindowSum(length);
    this.sqX = new WindowSum(length);
  }

  /** The window sums of the indexes and of their squares on bar i (na before the window is full) */
  private indexSums(i: number): [number, number] {
    const len = this.len;
    if (i + 1 < len) return [NaN, NaN];
    const first = i - len + 1;
    if (!this.sqI && i * i * len < 2 ** 53) {
      // sum of first..i and of their squares: integers below 2^53
      let sum = 0;
      let sq = 0;
      if (len > 64 && 2 * (i + 1) ** 3 < 2 ** 53) {
        // closed forms: exact products below 2^53
        const tri = (m: number) => (m * (m + 1)) / 2;
        const squares = (m: number) => (m * (m + 1) * (2 * m + 1)) / 6;
        sum = tri(i) - tri(first - 1);
        sq = squares(i) - squares(first - 1);
      } else {
        for (let k = first; k <= i; k++) {
          sum += k;
          sq += k * k;
        }
      }
      return [sum, sq];
    }
    if (!this.sqI) {
      this.sumI = new WindowSum(len);
      this.sqI = new WindowSum(len);
      for (let k = first; k < i; k++) {
        this.sumI.step(k);
        this.sqI.step(k * k);
        this.sumI.commit();
        this.sqI.commit();
      }
    }
    return [this.sumI!.step(i), this.sqI.step(i * i)];
  }

  step(a: number, i: number): number {
    const len = this.len;
    const product = a === null || a === undefined ? NaN : a * i;
    const mxy = this.sumXY.step(product) / len;
    const mx = this.sumX.step(a) / len;
    const [sumI, sqI] = this.indexSums(i);
    const my = sumI / len;
    const cov = mxy - mx * my;
    // biased variances: sumSq / n - mean * mean
    const vx = this.sqX.step(Number.isFinite(a) ? a * a : NaN) / len - mx * mx;
    const vy = sqI / len - my * my;
    if (Number.isNaN(cov)) return NaN;
    if (Math.abs(cov) <= 1e-10) return 0;
    const denominator = Math.sqrt(vx * vy);
    return denominator === 0 ? NaN : cov / denominator;
  }

  commit(): void {
    this.sumXY.commit();
    this.sumX.commit();
    this.sqX.commit();
    this.sumI?.commit();
    this.sqI?.commit();
  }
}

type Point = { time: number | string; value: number; color?: string };

interface AdaptiveMacdVars {
  /** Histogram of the bar before (from the warm-up end on) */
  prevHist: number;
}

interface AdaptiveMacdRun extends BarRunState<AdaptiveMacdVars> {
  corr: BarIndexCorrelationStep;
  sig: ReturnType<typeof taStep.ema>;
  macd: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<AdaptiveMACDInputs>): BarStudy<AdaptiveMacdRun, IndicatorResult> {
  const { r2Period, fast, slow, signal } = { ...defaultInputs, ...inputs };
  const a1 = 2 / (fast + 1);
  const a2 = 2 / (slow + 1);
  const warmup = r2Period;
  return {
    init() {
      // R² = 0.5 * correlation(close, bar_index, r2Period)^2 + 0.5
      const corr = new BarIndexCorrelationStep(r2Period);
      // Signal = EMA(macd, signal)
      const sig = taStep.ema(signal);
      const s: AdaptiveMacdRun = {
        corr, sig, macd: [], plot0: [], plot1: [], plot2: [],
        steps: [corr, sig], vars: { prevHist: NaN }, lists: [], series: [],
      };
      s.series = [s.macd, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const corr = s.corr.step(bars[i].close, i);
      // MACD bar-by-bar (depends on macd[i-1] and macd[i-2])
      const macdArr = s.macd;
      let m = 0;
      if (i >= 1) {
        const r2 = (corr != null && !isNaN(corr)) ? 0.5 * corr * corr + 0.5 : 0.5;

        const K = r2 * ((1 - a1) * (1 - a2)) + (1 - r2) * ((1 - a1) / (1 - a2));

        const prevMacd1 = isNaN(macdArr[i - 1]) ? 0 : macdArr[i - 1];
        const prevMacd2 = i >= 2 && !isNaN(macdArr[i - 2]) ? macdArr[i - 2] : 0;

        m = (bars[i].close - bars[i - 1].close) * (a1 - a2)
          + (-a2 - a1 + 2) * prevMacd1
          - K * prevMacd2;
      }
      macdArr[i] = m;
      const sv = s.sig.step(m);

      const t = bars[i].time;
      if (i < warmup) {
        s.plot0[i] = { time: t, value: NaN };
        s.plot1[i] = { time: t, value: NaN };
        s.plot2[i] = { time: t, value: NaN };
      } else {
        const v = s.vars;
        const prevHist = v.prevHist;
        const sVal = (sv != null && !isNaN(sv)) ? sv : NaN;
        const hist = (!isNaN(m) && !isNaN(sVal)) ? m - sVal : NaN;
        // 4-color histogram: bright/faded green/red based on direction and sign
        let color: string;
        if (!isNaN(hist)) {
          if (hist > 0 && hist > prevHist) color = '#26A69A';       // bright green (rising above zero)
          else if (hist > 0 && hist <= prevHist) color = '#B2DFDB';  // faded green (falling above zero)
          else if (hist < 0 && hist < prevHist) color = '#FF5252';   // bright red (falling below zero)
          else color = '#FFCDD2';                                     // faded red (rising below zero)
        } else {
          color = '#787B86';
        }
        s.plot0[i] = { time: t, value: hist, color };
        s.plot1[i] = { time: t, value: isNaN(m) ? NaN : m };
        s.plot2[i] = { time: t, value: sVal };
        v.prevHist = hist;
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveMACDInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveMACDInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AdaptiveMACD = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
