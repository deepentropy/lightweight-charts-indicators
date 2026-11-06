/**
 * RCYC - Bullish Bearish Indicator
 *
 * A KDJ oscillator: K = 100 * (close - lowest low) / (highest high - lowest low) over `length` bars (50 when the
 * range is 0 or na), pK = RMA(K, signal), pD = RMA(pK, signal), J = 3 * pK - 2 * pD. A crossover of J above the
 * midline sets the bullish state, a crossunder the bearish state. The price candles are redrawn in the state colour:
 * red on the bullish cross bar, then navy; yellow on the bearish cross bar, then aqua; gray while neutral. The
 * initial state is an input; 'Auto' takes the side of J on the first bar where J is known.
 * Alerts (alertcondition, `alerts` of the result): 'Red Candle Alert' (J crosses over the midline) and 'Yellow
 * Candle Alert' (J crosses under the midline).
 *
 * Reference: "RCYC - Bullish Bearish Indicator" by bizarro29
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';


export interface RcycBullishBearishIndicatorInputs {
  /** KDJ length (highest high / lowest low window) */
  length: number;
  /** RMA length of pK and pD */
  signal: number;
  /** Midline level of the J crosses */
  midline: number;
  /** State before the first cross */
  initialStateInput: 'Bullish' | 'Bearish' | 'Neutral' | 'Auto';
}

export const defaultInputs: RcycBullishBearishIndicatorInputs = {
  length: 9,
  signal: 3,
  midline: 50.0,
  initialStateInput: 'Auto',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'KDJ Length', defval: 9, min: 1 },
  { id: 'signal', type: 'int', title: 'Signal Smoothing', defval: 3, min: 1 },
  { id: 'midline', type: 'float', title: 'Midline Level', defval: 50.0, step: 0.1 },
  { id: 'initialStateInput', type: 'string', title: 'Initial State', defval: 'Auto', options: ['Bullish', 'Bearish', 'Neutral', 'Auto'] },
];

/** No plot(): the output is the plotcandle of the price in the state colour */
export const plotConfig: PlotConfig[] = [];

/** plotcandle(open, high, low, close, color = candleColor, wickcolor = candleColor, bordercolor = borderColor) */
export const plotCandleConfig = [{ id: 'candles', title: 'Candles' }];

export const metadata = {
  title: 'RCYC - Bullish Bearish Indicator',
  shortTitle: 'RCYC - Bullish Bearish Indicator',
  overlay: true,
};

/** Pine float comparisons: a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { plotCandles: Record<string, PlotCandleData[]> } & { alerts: AlertConditionState[] };

interface RcycVars {
  /** var int colorState = na */
  colorState: number;
}

interface RcycRun extends BarRunState<RcycVars> {
  hi: WindowExtreme;
  lo: WindowExtreme;
  pK: ReturnType<typeof taStep.rma>;
  pD: ReturnType<typeof taStep.rma>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  candles: PlotCandleData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RcycBullishBearishIndicatorInputs>): BarStudy<RcycRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const hi = new WindowExtreme(false, cfg.length);
      const lo = new WindowExtreme(true, cfg.length);
      const pK = taStep.rma(cfg.signal);
      const pD = taStep.rma(cfg.signal);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: RcycRun = {
        hi, lo, pK, pD, over, under, candles: [], flags: [[], []], times: [[], []],
        steps: [hi, lo, pK, pD, over, under], vars: { colorState: NaN }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.candles, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const hi = s.hi.step(b.high);
      const lo = s.lo.step(b.low);
      // k = range_ != 0 ? 100 * ((close - lo) / range_) : 50 (an na range gives 50: na != 0 is false)
      const range = hi - lo;
      const k = ne(range, 0) ? 100 * ((b.close - lo) / range) : 50;
      const pK = s.pK.step(k);
      const pD = s.pD.step(pK);
      const j = 3 * pK - 2 * pD;
      // ta.crossover / ta.crossunder: exact comparisons, with the last bar where both values were not na
      const up = !!s.over.step(j, cfg.midline);
      const down = !!s.under.step(j, cfg.midline);

      const v = s.vars;
      if (i === 0) {
        // barstate.isfirst: Bullish 1, Bearish 2, Neutral / Auto 0
        v.colorState = cfg.initialStateInput === 'Bullish' ? 1 : cfg.initialStateInput === 'Bearish' ? 2 : 0;
      }
      if (cfg.initialStateInput === 'Auto' && v.colorState === 0 && !isNaN(j)) {
        v.colorState = ge(j, cfg.midline) ? 1 : 2;
      }
      if (up) v.colorState = 1;
      else if (down) v.colorState = 2;

      const colorState = v.colorState;
      const col = colorState === 1 ? (up ? color.red : color.navy)
        : colorState === 2 ? (down ? color.yellow : color.aqua)
          : color.gray;
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: col, wickColor: col, borderColor: col };

      // alertcondition(crossOverMid, "Red Candle Alert") / alertcondition(crossUnderMid, "Yellow Candle Alert")
      s.flags[0][i] = up;
      s.flags[1][i] = down;
      if (up) s.times[0].push(b.time as number);
      if (down) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        plotCandles: { candles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RcycBullishBearishIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RcycBullishBearishIndicatorInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Red Candle Alert', message: 'Red Candle Signal: J Value has crossed above the selected midline.' },
  { id: 'alert1', title: 'Yellow Candle Alert', message: 'Yellow Candle Signal: J Value has crossed below the selected midline.' },
];

export const RcycBullishBearishIndicator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig, alertConditions };
