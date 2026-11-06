/**
 * Volume-Weighted MA Crossover [AlphaAlgos]
 *
 * VWMA of the source over `lenVwma` bars, coloured by its last cross with the SMA over `lenSma` bars: cyan after the
 * VWMA crosses over the SMA, magenta after it crosses under (magenta before the first cross).
 * Alerts (alertcondition, `alerts` of the result): 'VWMA Crossover Long' on a cross over the SMA and 'VWMA Crossover
 * Short' on a cross under it.
 *
 * Reference: "Volume-Weighted MA Crossover [AlphaAlgos]" by AlphaNatt
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeWeightedMaCrossoverInputs {
  /** VWMA length */
  lenVwma: number;
  /** SMA length */
  lenSma: number;
  /** Source */
  src: SourceType;
}

export const defaultInputs: VolumeWeightedMaCrossoverInputs = {
  lenVwma: 20,
  lenSma: 50,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'lenVwma', type: 'int', title: 'VWMA Length', defval: 20, group: 'Volume-Weighted Moving Average Settings' },
  { id: 'lenSma', type: 'int', title: 'SMA Length', defval: 50, group: 'Simple Moving Average Settings' },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'General Settings' },
];

const LONG_COL = '#00F1FF';
const SHORT_COL = '#FF019A';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMA', color: SHORT_COL, lineWidth: 2 },
];

export const metadata = {
  title: 'Volume-Weighted MA Crossover [AlphaAlgos]',
  shortTitle: 'Volume-Weighted MA Crossover [AlphaAlgos]',
  overlay: true,
};

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };

interface VwmaCrossVars {
  /** var color signal_color = na ('' for na) */
  signal: string;
  /** The values of the last bar where both were not na */
  pv: number;
  ps: number;
}

interface VwmaCrossRun extends BarRunState<VwmaCrossVars> {
  vwma: WindowVwma;
  sma: WindowSma;
  plot0: Point[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolumeWeightedMaCrossoverInputs>): BarStudy<VwmaCrossRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const vwma = new WindowVwma(cfg.lenVwma);
      const sma = new WindowSma(cfg.lenSma);
      const s: VwmaCrossRun = {
        vwma, sma, plot0: [], flags: [[], []], times: [[], []],
        steps: [vwma, sma], vars: { signal: '', pv: NaN, ps: NaN }, lists: [], series: [],
      };
      s.lists = s.times;
      s.series = [s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const x = value(b);
      const v = s.vwma.step(x, b.volume ?? NaN);
      const sm = s.sma.step(x);
      const st = s.vars;
      // var color signal_color = na: set on the crosses (crossover / crossunder compared with the last bar where both
      // values were not na; a tie there counts; exact comparisons: no 1e-10 tolerance, unlike the operators)
      const longCondition = v > sm && st.pv <= st.ps;
      const shortCondition = v < sm && st.pv >= st.ps;
      s.flags[0][i] = longCondition;
      s.flags[1][i] = shortCondition;
      if (longCondition) s.times[0].push(b.time as number);
      if (shortCondition) s.times[1].push(b.time as number);
      if (!isNaN(v) && !isNaN(sm)) {
        st.pv = v;
        st.ps = sm;
      }
      if (longCondition) st.signal = LONG_COL;
      if (shortCondition) st.signal = SHORT_COL;
      // color = signal_color == #00F1FF ? #00F1FF : #FF019A
      s.plot0[i] = { time: b.time, value: v, color: st.signal === LONG_COL ? LONG_COL : SHORT_COL };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        // alertcondition(long_condition, 'VWMA Crossover Long') / alertcondition(short_condition, 'VWMA Crossover Short')
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeWeightedMaCrossoverInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeWeightedMaCrossoverInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'VWMA Crossover Long', message: 'VWMA Crossover Long {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'VWMA Crossover Short', message: 'VWMA Crossover Short {{exchange}}:{{ticker}}' },
];

export const VolumeWeightedMaCrossover = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
