/**
 * Kalman Ema Crosses - [JTCAPITAL]
 *
 * A one-state Kalman filter (process noise added to the error, gain = error / (error + measurement noise)) smooths the
 * source; two EMAs of the filtered price are filtered again with Kalman filters. The script has two filter states:
 * the price filter shares its state with the EMA 1 filter (option 1) or with the EMA 2 filter (option 2), and a
 * state that becomes na is started again from the next value. The trend is 1 after a crossover of the EMA 1 line
 * above the EMA 2 line, -1 after a crossover below; both lines and the fill between them take the trend colour.
 *
 * Reference: "Kalman Ema Crosses - [JTCAPITAL]" by JTCapitalNL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © JTCapitalNL. Credits for the kalman function goes to @Backquant
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KalmanEmaCrossesInputs {
  src: SourceType;
  ema1len: number;
  ema2len: number;
  /** Process noise */
  proc: number;
  /** Measurement noise */
  measure: number;
  /** Price Kalman filter on the state of EMA 1 (1) or EMA 2 (2); Pine options [1, 2] */
  kalmanusage: number;
}

export const defaultInputs: KalmanEmaCrossesInputs = {
  src: 'close',
  ema1len: 15,
  ema2len: 25,
  proc: 50,
  measure: 10.0,
  kalmanusage: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'ema1len', type: 'int', title: 'EMA 1 Length', defval: 15 },
  { id: 'ema2len', type: 'int', title: 'EMA 2 Length', defval: 25 },
  { id: 'proc', type: 'float', title: 'Process Noise', defval: 50, step: 0.01 },
  { id: 'measure', type: 'float', title: 'Measurement Noise', defval: 10.0 },
  { id: 'kalmanusage', type: 'int', title: 'Price kalman on EMA 1 or 2', defval: 1, min: 1, max: 2 },
];

const BULL = String(color.rgb(49, 133, 228));
const BEAR = String(color.rgb(132, 3, 158));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 1 Kalman', color: BULL, lineWidth: 2 },
  { id: 'plot1', title: 'EMA 2 Kalman', color: BULL, lineWidth: 2 },
];

export const metadata = {
  title: 'Kalman Ema Crosses - [JTCAPITAL]',
  shortTitle: 'Kalman Ema Crosses - [JTCAPITAL]',
  overlay: true,
};

/** One Kalman filter state (Pine `var float[] state / error` with N = 1) */
interface KalmanState {
  state: number;
  error: number;
}

/** f_init: start the state from the value when it is na (error 1.0) */
function kalmanInit(k: KalmanState, source: number): void {
  if (isNaN(k.state)) {
    k.state = source;
    k.error = 1.0;
  }
}

/** f_kalman: one prediction / update step; returns the new state (na when the state or the source is na) */
function kalmanStep(k: KalmanState, source: number, proc: number, measure: number): number {
  const predstate = k.state;
  const prederror = k.error + proc;
  const kg = prederror / (prederror + measure);
  k.state = predstate + kg * (source - predstate);
  k.error = (1 - kg) * prederror;
  return k.state;
}

/**
 * The state of one `ta.ema(x, len)` call fed bar by bar (the same recursion as oakscriptjs ta.ema: the SMA of the
 * first `len` finite values as seed, then (x - ema) * 2 / (len + 1) + ema; an na value gives na on its bar and the
 * next bar continues from the last value). Needed because the EMA input of the next bar depends on this bar's EMA
 * (shared Kalman state).
 */
interface EmaState {
  count: number;
  sum: number;
  value: number;
}

function emaStep(e: EmaState, len: number, mult: number, x: number): number {
  if (!Number.isFinite(x)) return NaN;
  if (e.count < len) {
    e.sum += x;
    e.count++;
    if (e.count < len) return NaN;
    e.value = e.sum / len;
    return e.value;
  }
  e.value = (x - e.value) * mult + e.value;
  return e.value;
}

type Point = { time: number; value: number; color: string };

interface KalmanVars {
  k1: KalmanState;
  k2: KalmanState;
  e1: EmaState;
  e2: EmaState;
  /** var trend = 0 */
  trend: number;
}

interface KalmanRun extends BarRunState<KalmanVars> {
  up: ReturnType<typeof taStep.crossover>;
  down: ReturnType<typeof taStep.crossover>;
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
}

function study(inputs: Partial<KalmanEmaCrossesInputs>): BarStudy<KalmanRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const { proc, measure, kalmanusage } = cfg;
  const len1 = Math.floor(cfg.ema1len);
  const mult1 = 2 / (len1 + 1);
  const len2 = Math.floor(cfg.ema2len);
  const mult2 = 2 / (len2 + 1);
  // fill color = trend > 0 ? color.rgb(49, 133, 228, 30) : trend < 0 ? color.rgb(132, 3, 158, 30) : color.gray
  const bullFill = String(color.rgb(49, 133, 228, 30));
  const bearFill = String(color.rgb(132, 3, 158, 30));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const up = taStep.crossover();
      const down = taStep.crossover();
      const s: KalmanRun = {
        up, down, plot0: [], plot1: [], fillColors: [], steps: [up, down],
        // var float[] state = array.new_float(1, na), error = array.new_float(1, 100.0) (and state2 / error2)
        vars: {
          k1: { state: NaN, error: 100.0 }, k2: { state: NaN, error: 100.0 },
          e1: { count: 0, sum: 0, value: NaN }, e2: { count: 0, sum: 0, value: NaN }, trend: 0,
        },
        lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { k1, k2 } = v;
      const src = value(bars[i]);
      if (kalmanusage === 1) kalmanInit(k1, src);
      if (kalmanusage === 2) kalmanInit(k2, src);
      // pricekalman = kalmanusage == 1 ? f_kalman(src) : kalmanusage == 2 ? f_kalman2(src) : na
      const pricekalman = kalmanusage === 1 ? kalmanStep(k1, src, proc, measure)
        : kalmanusage === 2 ? kalmanStep(k2, src, proc, measure) : NaN;
      const ema1 = emaStep(v.e1, len1, mult1, pricekalman);
      const ema2 = emaStep(v.e2, len2, mult2, pricekalman);
      // f_init(ema1); f_init2(ema2); ema1kalman = f_kalman(ema1); ema2kalman = f_kalman2(ema2)
      kalmanInit(k1, ema1);
      kalmanInit(k2, ema2);
      const ema1kalman = kalmanStep(k1, ema1, proc, measure);
      const ema2kalman = kalmanStep(k2, ema2, proc, measure);

      // var trend = 0; ta.crossover(ema1kalman, ema2kalman) -> 1; ta.crossover(ema2kalman, ema1kalman) -> -1
      // (exact comparisons with the last bar where both values were not na)
      const up = s.up.step(ema1kalman, ema2kalman);
      const down = s.down.step(ema2kalman, ema1kalman);
      if (up) v.trend = 1;
      if (down) v.trend = -1;
      const tr = v.trend;

      // color = trend > 0 ? BullColor : trend < 0 ? Bearcolor : color.gray
      const lineColor = tr > 0 ? BULL : tr < 0 ? BEAR : color.gray;
      const time = bars[i].time;
      // plot1 = plot(ema1kalman, color = ..., linewidth = 2)
      s.plot0[i] = { time, value: ema1kalman, color: lineColor };
      // plot2 = plot(ema2kalman, color = ..., linewidth = 2)
      s.plot1[i] = { time, value: ema2kalman, color: lineColor };
      s.fillColors[i] = tr > 0 ? bullFill : tr < 0 ? bearFill : color.gray;
    },
    copyVars: (v) => ({ k1: { ...v.k1 }, k2: { ...v.k2 }, e1: { ...v.e1 }, e2: { ...v.e2 }, trend: v.trend }),
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.fillColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<KalmanEmaCrossesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<KalmanEmaCrossesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const KalmanEmaCrosses = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
