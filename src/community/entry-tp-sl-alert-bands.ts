/**
 * Entry / TP / SL Alert Bands (Simple & Stable)
 *
 * Two fixed alert bands between a trade entry price and its take-profit / stop-loss prices. Long: the upper band is
 * entry + (TP - entry) * upper % / 100 and the lower band is entry - (entry - SL) * lower % / 100. Short: the upper
 * band is entry - (entry - TP) * upper % / 100 and the lower band is entry + (SL - entry) * lower % / 100. A band
 * is na when its distance is not positive. The close is plotted as a reference line; the entry, TP and SL lines are
 * optional.
 * Alerts (alertcondition, `alerts` of the result): 'Upper Alert Crossed' (close crosses over the upper band), 'Lower
 * Alert Crossed' (close crosses under the lower band) and 'Any Alert Crossed' (either).
 *
 * Reference: "Entry / TP / SL Alert Bands (Simple & Stable)" by drlicht1
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EntryTpSlAlertBandsInputs {
  entry: number;
  takeProfit: number;
  stopLoss: number;
  /** Trade direction */
  dir: 'Long' | 'Short';
  /** Upper alert band in % of the entry to TP distance */
  upperPct: number;
  /** Lower alert band in % of the entry to SL distance */
  lowerPct: number;
  showEntry: boolean;
  showTP: boolean;
  showSL: boolean;
}

export const defaultInputs: EntryTpSlAlertBandsInputs = {
  entry: 150.0,
  takeProfit: 160.0,
  stopLoss: 140.0,
  dir: 'Long',
  upperPct: 50.0,
  lowerPct: 50.0,
  showEntry: false,
  showTP: false,
  showSL: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'entry', type: 'float', title: 'Entry Price', defval: 150.0, step: 0.01 },
  { id: 'takeProfit', type: 'float', title: 'Take Profit Price', defval: 160.0, step: 0.01 },
  { id: 'stopLoss', type: 'float', title: 'Stop Loss Price', defval: 140.0, step: 0.01 },
  { id: 'dir', type: 'string', title: 'Trade Direction', defval: 'Long', options: ['Long', 'Short'] },
  { id: 'upperPct', type: 'float', title: 'Upper Alert % of (Entry→TP)', defval: 50.0, min: 0.0, max: 100.0, step: 1.0 },
  { id: 'lowerPct', type: 'float', title: 'Lower Alert % of (Entry→SL)', defval: 50.0, min: 0.0, max: 100.0, step: 1.0 },
  { id: 'showEntry', type: 'bool', title: 'Show Entry Line', defval: false },
  { id: 'showTP', type: 'bool', title: 'Show Take Profit Line', defval: false },
  { id: 'showSL', type: 'bool', title: 'Show Stop Loss Line', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Entry', color: color.lime, lineWidth: 2 },
  { id: 'plot1', title: 'TakeProfit', color: color.aqua, lineWidth: 2 },
  { id: 'plot2', title: 'StopLoss', color: color.red, lineWidth: 2 },
  { id: 'plot3', title: 'Price', color: color.white, lineWidth: 1 },
  { id: 'plot4', title: 'Upper Alert Band', color: color.green, lineWidth: 3 },
  { id: 'plot5', title: 'Lower Alert Band', color: color.fuchsia, lineWidth: 3 },
];

export const metadata = {
  title: 'Entry / TP / SL Alert Bands (Simple & Stable)',
  shortTitle: 'Entry / TP / SL Alert Bands (Simple & Stable)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface BandsRun extends BarRunState<Record<string, never>> {
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<EntryTpSlAlertBandsInputs>): BarStudy<BandsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { entry, takeProfit, stopLoss, upperPct, lowerPct } = cfg;

  let upperAlert = NaN;
  let lowerAlert = NaN;
  if (cfg.dir === 'Long') {
    const upDist = takeProfit - entry;
    const downDist = entry - stopLoss;
    if (gt(upDist, 0.0)) upperAlert = entry + (upDist * upperPct) / 100.0;
    if (gt(downDist, 0.0)) lowerAlert = entry - (downDist * lowerPct) / 100.0;
  } else {
    const upDist = entry - takeProfit;
    const downDist = stopLoss - entry;
    if (gt(upDist, 0.0)) upperAlert = entry - (upDist * upperPct) / 100.0;
    if (gt(downDist, 0.0)) lowerAlert = entry + (downDist * lowerPct) / 100.0;
  }
  const entryV = cfg.showEntry ? entry : NaN;
  const tpV = cfg.showTP ? takeProfit : NaN;
  const slV = cfg.showSL ? stopLoss : NaN;

  return {
    init() {
      const s: BandsRun = {
        plots: [[], [], [], [], [], []], flags: [[], [], []], times: [[], [], []], steps: [], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times];
      s.series = [...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const p = s.plots;
      p[0][i] = { time: t, value: entryV, color: color.lime };
      p[1][i] = { time: t, value: tpV, color: color.aqua };
      p[2][i] = { time: t, value: slV, color: color.red };
      p[3][i] = { time: t, value: b.close, color: color.white };
      p[4][i] = { time: t, value: upperAlert, color: color.green };
      p[5][i] = { time: t, value: lowerAlert, color: color.fuchsia };
      // crossAbove = ta.crossover(close, upperAlert); crossBelow = ta.crossunder(close, lowerAlert)
      const pc = i > 0 ? bars[i - 1].close : NaN;
      const crossAbove = b.close > upperAlert && pc <= upperAlert;
      const crossBelow = b.close < lowerAlert && pc >= lowerAlert;
      const crossAny = crossAbove || crossBelow;
      s.flags[0][i] = crossAbove;
      s.flags[1][i] = crossBelow;
      s.flags[2][i] = crossAny;
      if (crossAbove) s.times[0].push(t as number);
      if (crossBelow) s.times[1].push(t as number);
      if (crossAny) s.times[2].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(),
          plot1: p[1].slice(),
          plot2: p[2].slice(),
          plot3: p[3].slice(),
          plot4: p[4].slice(),
          plot5: p[5].slice(),
        },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EntryTpSlAlertBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<EntryTpSlAlertBandsInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Upper Alert Crossed', message: 'Price crossed ABOVE the upper alert band.' },
  { id: 'alert1', title: 'Lower Alert Crossed', message: 'Price crossed BELOW the lower alert band.' },
  { id: 'alert2', title: 'Any Alert Crossed', message: 'Price crossed an alert band (upper or lower).' },
];

export const EntryTpSlAlertBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
